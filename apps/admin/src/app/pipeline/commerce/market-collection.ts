"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * MI-COLLECTION-GUARD-1(CEO 지시, 2026-09-13) — **수집은 상품 하나에 한 번이다.**
 *
 * ── 무엇이 실제로 일어나고 있었나 ────────────────────────────────────────
 * 국내/해외 가격비교 두 패널은 마운트되면 조회를 건다. 그 자체는 의도였다
 * (N-3.13 P0 — 버튼을 눌러야만 검색되던 탓에 화면이 늘 비어 보였다). 문제는
 * "한 번만"을 지키던 장치가 **컴포넌트 인스턴스에 묶인 ref**였다는 것이다:
 *
 *   const autoSearchedRef = useRef(false);            // ← 마운트마다 false로 되돌아간다
 *   useEffect(() => {
 *     if (autoSearchedRef.current || !title) return;
 *     autoSearchedRef.current = true;
 *     void runSearch();
 *   }, [title]);
 *
 * ref는 언마운트와 함께 사라진다. 그런데 이 두 패널이 사는 자리는 **수시로
 * 언마운트되는 자리**다. 경로가 셋이고, 셋 다 셀러가 판단과 무관하게 하는
 * 동작이다:
 *
 *   ① 탭 이동      CommerceWorkspace의 `{tab === "source" && …}` 분기가
 *                  상품정보 탭을 떠나는 순간 단계 본문을 통째로 언마운트한다.
 *                  스마트스토어 탭을 보고 돌아오면 두 패널이 새로 태어난다.
 *   ② 접기/펼치기  CollapsibleSection은 닫히면 children을 렌더하지 않는다.
 *                  ③④에서 두 패널은 「📊 시장 가격 비교」 접힘 **안쪽**에
 *                  있으므로, 접었다 펴는 것만으로 다시 태어난다.
 *   ③ 단계 전환    ②에서는 MarketStage가, ③④에서는 접힘이 같은 노드를 든다.
 *                  부모가 바뀌므로 React는 이것을 새 마운트로 처리한다.
 *
 * 그리고 그 조회는 표시용 GET이 아니다. `POST /api/comparison/search`와
 * `POST /api/domestic-price-sources/search`는 판매자가 켜 둔 편집샵을 **실제로
 * 크롤링한다**. 서버의 멱등성 장치(skipIfCheckedToday / hasObservationToday)는
 * 관측을 DB에 쓰는 경로만 지킨다 — 이 두 라우트는 그 경로가 아니라 그때그때
 * 뒤지는 라이브 검색이라, 프런트가 부르면 부르는 만큼 크롤링이 돈다. DB에 이미
 * 데이터가 있다는 사실은 이 호출을 막지 못한다.
 *
 * ── 그래서 고친 것 ──────────────────────────────────────────────────────
 * 캐시를 덧대지 않았다. 고친 것은 **보호장치의 수명**이다. "이 상품은 이미
 * 수집했다"는 사실의 수명은 컴포넌트 인스턴스가 아니라 **상품**이다. 그래서
 * 그 사실을 인스턴스 밖(모듈 스코프)으로 꺼내 상품 키로 보관한다. 언마운트가
 * 지울 수 없는 자리에 있으므로 위 ①②③ 어느 경로로도 되돌아가지 않는다.
 *
 * 함께 따라오는 성질이 하나 더 있다: 결과도 같은 자리에 남는다. 예전에는
 * 언마운트가 results까지 지워서, 돌아온 화면이 "빈 표 → 재조회 → 다시 채워짐"
 * 을 반복했다. 이제 돌아온 화면은 이미 채워진 채로 선다.
 *
 * ── 다시 수집하는 유일한 길 ─────────────────────────────────────────────
 * 셀러가 직접 누르는 것뿐이다(recollect). 화면 이동·탭·접힘·리렌더는 수집을
 * 부르지 못한다 — 그 경로가 코드에 존재하지 않는다.
 */

export interface CollectionState<T> {
  /** 마지막으로 성공한 수집 결과. 한 번도 성공한 적 없으면 null. */
  data: T | null;
  /** 지금 수집이 돌고 있는가. 재마운트는 이 값을 true로 만들지 않는다. */
  loading: boolean;
  /** 마지막 시도가 실패한 사유(사람이 읽는 문장). 성공하면 null로 지워진다. */
  error: string | null;
}

interface Entry<T> extends CollectionState<T> {
  /** 이 상품에 대해 수집을 **시작한 적이 있는가**. 성공/실패와 무관하다 —
   * 실패를 이유로 매 마운트마다 다시 크롤링하면 고친 것이 없다. */
  started: boolean;
  listeners: Set<() => void>;
}

const IDLE = { data: null, loading: false, error: null } as const;

/** 상품 키 → 수집 상태. 모듈 스코프라 마운트/언마운트가 지울 수 없다. */
const entries = new Map<string, Entry<unknown>>();

function entryFor<T>(key: string): Entry<T> {
  let entry = entries.get(key) as Entry<T> | undefined;
  if (!entry) {
    entry = { ...IDLE, started: false, listeners: new Set() };
    entries.set(key, entry as Entry<unknown>);
  }
  return entry;
}

function emit(entry: Entry<unknown>): void {
  for (const listener of [...entry.listeners]) listener();
}

/**
 * 실제 수집. 같은 키로 이미 돌고 있으면 아무것도 하지 않는다 — 두 인스턴스가
 * 동시에 살아 있는 순간(단계 전환 중의 교차 마운트)에 요청이 겹치지 않게 한다.
 */
function runCollection<T>(key: string, collect: () => Promise<T>): void {
  const entry = entryFor<T>(key);
  if (entry.loading) return;
  entry.started = true;
  entry.loading = true;
  entry.error = null;
  emit(entry as Entry<unknown>);
  void collect().then(
    (data) => {
      entry.data = data;
      entry.error = null;
      entry.loading = false;
      emit(entry as Entry<unknown>);
    },
    (cause: unknown) => {
      // 실패해도 data는 지우지 않는다 — 직전에 성공한 관측이 있으면 그것이
      // 여전히 이 상품에 대해 우리가 아는 전부다(빈 화면으로 되돌리지 않는다).
      entry.error = cause instanceof Error ? cause.message : "조회에 실패했습니다.";
      entry.loading = false;
      emit(entry as Entry<unknown>);
    },
  );
}

/**
 * 상품 하나에 한 번만 도는 수집.
 *
 * @param key   상품의 정체(보통 sourceUrl). null이면 아직 물어볼 수 없는
 *              상태라 아무것도 하지 않는다 — 없는 상품을 수집하지 않는다.
 * @param collect 실제 조회. 매 렌더 새 클로저가 와도 **다시 돌지 않는다**
 *              (ref로만 붙잡는다 — 의존성으로 넣는 순간 리렌더가 곧 수집이 된다).
 */
export function useCollectOnce<T>(
  key: string | null,
  collect: () => Promise<T>,
): CollectionState<T> & { recollect: () => void } {
  // 최신 클로저를 붙잡되 **의존성으로는 쓰지 않는다**. 렌더 중에 대입하지 않는
  // 이유는 규칙(react-hooks/refs) 때문만이 아니다 — 이 ref가 가리키는 것은
  // "지금 화면이 들고 있는 조회 방법"이고, 그 갱신은 커밋된 렌더에만 의미가 있다.
  const collectRef = useRef(collect);
  useEffect(() => {
    collectRef.current = collect;
  });

  const [, bump] = useState(0);

  // 구독 — 다른 인스턴스(또는 이전 인스턴스가 띄운 요청)가 끝나도 이 화면이 안다.
  useEffect(() => {
    if (!key) return;
    const entry = entryFor<T>(key);
    const listener = () => bump((n) => n + 1);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }, [key]);

  // 한 번만 — started가 이미 true면 이 마운트는 수집을 부르지 않는다.
  useEffect(() => {
    if (!key) return;
    if (entryFor<T>(key).started) return;
    runCollection(key, () => collectRef.current());
  }, [key]);

  const recollect = useCallback(() => {
    if (!key) return;
    runCollection(key, () => collectRef.current());
  }, [key]);

  const snapshot = key ? entryFor<T>(key) : (IDLE as CollectionState<T>);
  return { data: snapshot.data, loading: snapshot.loading, error: snapshot.error, recollect };
}

/**
 * 테스트 전용. 모듈 스코프 상태는 파일 하나 안의 여러 시나리오 사이에서도
 * 살아남으므로, "첫 진입"을 재현하려면 명시적으로 비워야 한다. 제품 코드에서
 * 부르는 곳은 없다 — 화면에서 수집을 되살리는 길은 recollect 하나뿐이다.
 */
export function resetMarketCollectionsForTests(): void {
  entries.clear();
}
