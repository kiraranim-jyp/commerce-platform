"use client";

import type { JSX } from "react";
import { OverseasReferencePrice } from "./OverseasReferencePrice";
import {
  DOMESTIC_REFERENCE_NOTE,
  DOMESTIC_REFERENCE_SCOPE,
  DOMESTIC_REFERENCE_TITLE,
  type OverseasPriceSummary,
} from "./overseas-reference";
import {
  MI_SAME_AREA_NOTE,
  MI_SAME_AREA_SCOPE,
  MI_SAME_AREA_TITLE,
  MI_SAME_DOMESTIC_HEADING,
  MI_SAME_EMPTY,
  MI_SAME_EXCLUSION_TEXT,
  MI_SAME_OVERSEAS_HEADING,
  selectMiSameCandidates,
  type MiSameSelection,
} from "./mi-same-candidates";
import { priceText, stockText, type GeminiTransientRow } from "./GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-132 ①②③ — **화면에 «하나뿐인» 동일상품 가격 비교 영역**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 영역이 생긴 이유는 「영역을 하나 더 만들기」가 아니다.**
 *
 * WU-132 전수검토가 찾은 구조적 사실:
 * ```
 * 「📊 시장 가격 비교」의 두 패널(DomesticShopSearch · ComparisonShopSearch)은
 * **클라이언트가 자기 검색을 돌려** `mayShowCandidate` 로 거른다 ⟹ `/check` 가 낸
 * **MI verdict 를 한 번도 보지 않는다.** 그래서 「MI 가 SAME 이라 판정한 후보」가
 * 가격 비교에 **구조적으로 닿지 못했다** — 그것이 이번에 고친 것이다.
 * ```
 * 🟢 그래서 이 컴포넌트는 그 접힘 **안쪽 맨 위** 에 서서 MI 산출을 공급하고,
 *    아래 두 패널은 그대로 **원자료 드릴다운** 으로 남는다(그 둘의 제목이 이미
 *    「… 의 원자료」라고 말한다 — 가격비교 영역이 둘이 되는 것이 아니다).
 *
 * ── 🔴 WU-130 ④ 영역을 «대체» 한다 (복제가 아니다) ─────────────────────────
 * ```
 * MI 패널 안의 `unified-price-comparison` 은 **제거됐고**, 그 안에 있던 두 참고가격
 * 블록(🇰🇷 국내 참고가격 · 🧾 해외 동일상품 참고가격)이 **이 영역으로 옮겨 왔다.**
 * 🔴 집계 계산은 한 글자도 바뀌지 않았다 — 같은 `OverseasReferencePrice` 에 같은
 *    `OverseasPriceSummary` 를 넘긴다(환산 0 · 통화별 · 합계 칸 없음).
 * ```
 *
 * ── 🔴 이 컴포넌트가 «하지 않는» 것 ────────────────────────────────────────
 * ```
 * ❌ 판정 — verdict/tier/threshold 를 만들지 않는다(`selectMiSameCandidates` 가 읽기만)
 * ❌ 집계 — 금액을 더하거나 최저가를 고르지 않는다(MI 가 낸 summary 를 그린다)
 * ❌ 환산 — 통화 그대로. 기호로 바꾸지도 않는다
 * ❌ 저장 — DB 를 모른다. 사람 판단 버튼도 여기 없다(④ 는 검토 구역의 몫)
 * ```
 */

export interface MarketPriceComparisonProps {
  /**
   * 🔴 `/check` 가 낸 **네 출처의 후보를 합친 배열.** 🟢 합치는 곳이 한 곳이어야
   *    같은 후보가 두 번 세어지지 않는다(출처 배지는 행이 계속 말한다).
   * 🔴 `null` = 조회가 아직 돌지 않았다. `[]` = 돌았는데 후보가 0 — **다른 사실** 이다.
   */
  rows?: readonly GeminiTransientRow[] | null;
  /** 🔴 MI 가 이미 낸 국내 참고가격 집계. 여기서 계산하지 않는다. */
  domesticReference?: OverseasPriceSummary | null;
  /** 🔴 MI 가 이미 낸 해외 참고가격 집계. 여기서 계산하지 않는다. */
  overseasReference?: OverseasPriceSummary | null;
}

export function MarketPriceComparison({
  rows,
  domesticReference,
  overseasReference,
}: MarketPriceComparisonProps): JSX.Element | null {
  const domestic = selectMiSameCandidates(rows, "KR");
  const overseas = selectMiSameCandidates(rows, "OVERSEAS");

  /**
   * 🔴🔴 **「조회가 돌았는가」가 렌더 조건이다**(WU-130 ② 가 세운 그 계약).
   *    「후보가 있는가」로 두면 후보 0 일 때 영역이 통째로 사라지고, 셀러는
   *    **「조회조차 안 했다」** 로 읽는다 — 그 둘은 다른 사실이다.
   */
  const checkRan = rows != null || !!domesticReference || !!overseasReference;
  if (!checkRan) return null;

  return (
    <section
      data-testid="market-price-comparison"
      className="rounded-md border border-border bg-surface/30 p-3"
    >
      <p className="text-[11px] font-medium text-text-secondary">{MI_SAME_AREA_TITLE}</p>
      <p className="mt-0.5 text-[11px] text-text-tertiary">{MI_SAME_AREA_NOTE}</p>
      {/* 🔴 「유사상품은 여기 오지 않는다」를 영역이 **직접** 말한다(②의 절반). */}
      <p className="text-[11px] text-text-tertiary">{MI_SAME_AREA_SCOPE}</p>

      {/* 🔴 국내를 해외 «앞» 에 둔다 — 셀러의 질문 순서가 그렇다(WU-056 과 같은 이유). */}
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <MarketColumn
          testId="mi-same-domestic"
          heading={MI_SAME_DOMESTIC_HEADING}
          selection={domestic}
          reference={domesticReference}
          referenceProps={{
            title: DOMESTIC_REFERENCE_TITLE,
            note: DOMESTIC_REFERENCE_NOTE,
            scope: DOMESTIC_REFERENCE_SCOPE,
            icon: "🇰🇷",
            testId: "domestic-reference",
            amountTestId: "domestic-lowest",
          }}
        />
        <MarketColumn
          testId="mi-same-overseas"
          heading={MI_SAME_OVERSEAS_HEADING}
          selection={overseas}
          reference={overseasReference}
          /** 🔴 해외 블록의 제목·문구·🧾 아이콘은 **기본값 그대로** 다(`wu-056r1` 계약). */
          referenceProps={{}}
        />
      </div>
    </section>
  );
}

/**
 * 한 시장(국내 ↔ 해외)의 칸.
 *
 * 🔴 두 시장이 **같은 컴포넌트** 를 쓴다 — 두 벌이 되면 한쪽만 고치는 날이 온다
 *    (`match-display.ts` 가 라벨을 하나로 모은 그 이유).
 */
function MarketColumn({
  testId,
  heading,
  selection,
  reference,
  referenceProps,
}: {
  testId: string;
  heading: string;
  selection: MiSameSelection;
  reference?: OverseasPriceSummary | null;
  referenceProps: {
    title?: string;
    note?: string;
    scope?: string;
    icon?: string;
    testId?: string;
    amountTestId?: string;
  };
}): JSX.Element {
  return (
    <div data-testid={testId} className="space-y-2">
      <p className="text-[11px] font-medium text-text-primary">{heading}</p>
      {/* 🟢 MI 가 이미 낸 집계. 🔴 환산 0 · 통화별로만(그 성질은 그 컴포넌트의 계약이다). */}
      <OverseasReferencePrice summary={reference} {...referenceProps} />
      {selection.priced.length === 0 ? (
        /** 🔴 「동일상품이 없다」로 적지 않는다 — 부재와 미발견은 다르다. */
        <p data-testid="mi-same-empty" className="text-[11px] text-text-tertiary">
          {MI_SAME_EMPTY}
        </p>
      ) : (
        <ul className="space-y-1">
          {selection.priced.map((row) => (
            <li
              key={row.discoveredUrl}
              data-testid="mi-same-row"
              className="rounded border border-border/60 p-2"
            >
              {row.title && <p className="truncate text-[11px] text-text-primary">{row.title}</p>}
              <div className="flex items-baseline justify-between gap-2">
                <a
                  href={row.discoveredUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="truncate text-[11px] text-text-tertiary underline"
                >
                  {row.domain}
                </a>
                {/* 🔴 통화 그대로 · 환산 없음(그 함수가 owner 다). */}
                <span data-testid="mi-same-price" className="shrink-0 text-[11px] font-medium text-text-secondary">
                  {priceText(row)}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary">{stockText(row.soldOut)}</p>
            </li>
          ))}
        </ul>
      )}
      {/**
       * 🔴🔴 **「동일상품인데 빠진 것」을 조용히 버리지 않는다.**
       *    「동일상품이 없다」와 「동일상품인데 지금 가격을 확인하지 못했다」는 셀러가
       *    해야 할 행동이 **다르다**(앞은 기다리는 것, 뒤는 그 링크를 직접 보는 것).
       */}
      {selection.sameButExcluded.length > 0 && (
        <ul data-testid="mi-same-excluded" className="space-y-0.5">
          {selection.sameButExcluded.map(({ row, reason }) => (
            <li key={row.discoveredUrl} className="text-[11px] text-text-tertiary">
              {row.domain} — {MI_SAME_EXCLUSION_TEXT[reason]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
