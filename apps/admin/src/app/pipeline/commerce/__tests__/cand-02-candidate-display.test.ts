/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MarketPriceComparison } from "../MarketPriceComparison";
/**
 * 🔴 `selectCandidateList` 를 **쓰지 않는다** — 기대값을 그 함수로 세우면 그것을
 *    좁히는 변이가 기대값도 같이 좁혀 통과한다(M2 가 실제로 그렇게 통과했다).
 *    🟢 리스트 기대값은 **실측에 얼어 있는 `display` 칸** 이다.
 */
import {
  CANDIDATE_LIST_HEADING,
  selectMiSameCandidates,
  /**
   * 🔵 CANDIDATE-UX-REFINE-01 — U1/U5/U7 의 **확정 글자**.
   * 🔴 상수를 기대값으로 쓰는 것이 **전부 동어반복은 아니다** — 「그 자리에 그 상수가
   *    쓰였다」를 볼 때는 상수가 맞다. 🔴 단 **확정된 글자** 는 아래에서 **직접 적어**
   *    단언한다(상수를 바꿔도 통과하는 길을 막는다 · WU-145 ⒜ 의 그 함정).
   */
  CANDIDATE_LIST_EMPTY,
  CANDIDATE_PRICE_UNKNOWN,
  CANDIDATE_PRICE_UNVERIFIED,
  isPriceConfirmed,
  priceState,
  /** 🔵 `-02` — 카드는 **확인할 것만** 말한다(matchReasons 비노출). */
  candidateWarningLines,
  CANDIDATE_WARNING_PREFIX,
} from "../mi-same-candidates";
import { PRICE_UNKNOWN_TEXT } from "../GeminiTransientCandidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-E2E-CANDIDATE-02 — **화면 축: 다상품 마운트 DOM**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 이 파일이 답하는 질문은 **하나** 다 —
 * > 「이미 찾아낸 후보가 **화면에** 후보군으로 서고, **가격이 있는 후보가 그 안에**
 * >  함께 서는가」 — 다섯 상품에서.
 *
 * ── 🔴 왜 선택기 단언만으로는 부족한가 ─────────────────────────────────────
 * WU-110 이 적어 둔 그 함정이다 — **판정 함수를 직접 부르는 테스트는 배선을 못 본다.**
 * `selectCandidateList` 가 올바른 배열을 돌려줘도 컴포넌트가 그 배열을 **그리지
 * 않으면** 셀러에게는 후보가 없다(그것이 CEO 가 본 FAIL 의 실제 모양이었다).
 * 🟢 그래서 축이 **둘** 이다 — 선택기 축(`_lib/__tests__/cand-02-multi-product`) ·
 *    **화면 축(이 파일)**.
 *
 * ── 🔴 입력은 «실측» 이다 ────────────────────────────────────────────────────
 * `fixtures/cand-02-rows.json` 은 운영 `runDomesticPriceCheck` 가 **실제 HTTP 로**
 * 낸 행이다(재투입 생산자 · 새 Search 0). 🔴 손으로 만든 행이 아니다.
 * 🔴 그 파일이 **없으면 FAIL** 이다 — 측정 증거가 사라진 채로 초록이 되면
 *    「화면이 후보를 보여준다」가 **분모 0 에서 참** 이 된다(§5-B 가 금지한 그 모양).
 */

const FIX = join(
  __dirname,
  "..",
  "..",
  "..",
  "api",
  "price-history",
  "_lib",
  "__tests__",
  "fixtures",
  "cand-02-rows.json",
);

interface MeasuredRow {
  url: string;
  domain: string;
  /** 🔴 **typecheck 가 이 칸의 누락을 잡았다** — `toRow` 가 읽는데 선언이 없었다. */
  title: string | null;
  human: string | null;
  market: string | null;
  tier: string | null;
  verdict: string | null;
  price: number | null;
  currency: string | null;
  priceStatus: string | null;
  soldOut: boolean | null;
  display: "LIKELY" | "PRESUMED" | "POSSIBLE" | null;
  priced: boolean;
}
interface MeasuredProduct {
  sid: string;
  code: string;
  title: string;
  originUrl: string;
  suppliedUrls: string[];
  notFetched: string[];
  rows: MeasuredRow[];
  lost: { url: string; human: string | null }[];
}

const products = (): MeasuredProduct[] =>
  (JSON.parse(readFileSync(FIX, "utf8")) as { products: MeasuredProduct[] }).products;

/**
 * 🔴 측정 행 → `GeminiTransientRow`. **칸을 지어내지 않는다** — 측정에 없는 값은
 *    넣지 않고, 있는 값은 이름 그대로 옮긴다(가공 0).
 */
const toRow = (m: MeasuredRow): GeminiTransientRow =>
  ({
    domain: m.domain,
    discoveredUrl: m.url,
    title: m.title ?? undefined,
    market: m.market,
    matchTruth: m.tier,
    crossSellerVerdict: m.verdict,
    priceAmount: m.price,
    priceCurrency: m.currency,
    priceStatus: m.priceStatus,
    soldOut: m.soldOut,
    source: "REVIEWED_SAME",
  }) as unknown as GeminiTransientRow;

/** 🔴 href 는 절대 URL 이라 비교 키를 맞춘다(trailing slash·대소문자). */
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

function mount(rows: GeminiTransientRow[]): { html: string; doc: Document; cleanup: () => void } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      createElement(MarketPriceComparison, {
        rows,
        /** 🔴 선택 저장의 식별자 — 없으면 선택 UI 가 「저장했다」고 말하지 않는다(CLOSE-04). */
        snapshotId: "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2",
      }),
    );
  });
  return {
    html: host.innerHTML,
    doc: document,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

/** 🟢 화면에 실제로 선 후보의 URL 집합(href 로 읽는다 — 배열이 아니라 DOM 이다). */
function shownUrls(doc: Document, testId: string): Set<string> {
  const out = new Set<string>();
  for (const li of Array.from(doc.querySelectorAll(`[data-testid="${testId}"]`))) {
    const a = li.querySelector("a[href]");
    if (a) out.add(loose(a.getAttribute("href") ?? ""));
  }
  return out;
}

describe("CAND-02 화면 축 — 다상품 마운트 DOM", () => {
  /** 🔴 CAND-02-E — 측정 증거가 **있어야** 이 파일의 단언이 의미를 갖는다. */
  it("CAND-02-E 실측 fixture 가 존재하고 5개 상품을 담고 있다", () => {
    const ps = products();
    expect(ps).toHaveLength(5);
    expect(ps.map((p) => p.code)).not.toContain("B226AC009");
    for (const p of ps) expect(p.originUrl).toMatch(/^https?:\/\//);
  });

  /**
   * 🔴🔴🔵 **CAND-02-F — 이 파일의 핵심. `PRICE ⊆ DISPLAY` 를 «DOM 에서» 단언한다.**
   *
   * 🔴 CEO 모순이 바로 이 모양이었다 — 「가격은 뜨는데 후보 리스트가 없다」.
   *    그래서 **가격 축에 선 행이 후보 리스트에도 서 있는지** 를 둘 다 DOM 으로 읽는다.
   * 🔴 분모가 0 인 상품은 **PASS 로 세지 않는다**(측정불가 · §5-B).
   */
  it("CAND-02-F 가격이 있는 후보는 후보 리스트에도 «화면에» 선다", () => {
    let measuredProducts = 0;
    let measuredRows = 0;
    const unmeasured: string[] = [];

    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) {
        unmeasured.push(`${p.sid}(행 0)`);
        continue;
      }
      const { doc, cleanup } = mount(rows);
      try {
        const inList = shownUrls(doc, "mi-candidate-row");
        /**
         * 🔵🔵 CANDIDATE-UX-REFINE-04 A — **비교 대상이던 두 번째 surface 가 사라졌다.**
         *
         * 🔴 이 테스트의 원래 질문은 CEO 모순이었다 — 「가격은 뜨는데 후보 리스트가 없다」.
         *    그래서 `mi-same-row`(가격 surface) ⊆ `mi-candidate-row`(리스트)를 봤다.
         * 🟢 이제 surface 가 **하나** 라 그 모순이 **구조적으로 불가능** 하다 ⟹ 질문을
         *    한 단계 **강화** 한다 — 「**운영 가격 선택기가 고른 후보**가 화면에 선다」.
         *    (화면끼리 비교하는 것보다 **운영 산출 ↔ 화면** 비교가 더 센 단언이다.)
         */
        const inPrice = inList;
        /** 🟢 가격 축 분모는 **운영 선택기** 가 정한다 — 측정 파일의 플래그를 믿지 않는다. */
        const priced = [
          ...selectMiSameCandidates(rows, "KR").priced,
          ...selectMiSameCandidates(rows, "OVERSEAS").priced,
        ];
        if (priced.length === 0) {
          unmeasured.push(`${p.sid}(가격 후보 0)`);
          continue;
        }
        measuredProducts += 1;
        for (const row of priced) {
          measuredRows += 1;
          const key = loose(row.discoveredUrl);
          expect(
            inPrice.has(key),
            `🔴 ${p.sid} ${row.domain} 가격 축에 있는데 가격 영역이 그리지 않았다\n   ${row.discoveredUrl}`,
          ).toBe(true);
          expect(
            inList.has(key),
            `🔴 PRICE ⊄ DISPLAY — ${p.sid} ${row.domain} 가격은 뜨는데 후보 리스트에 없다(CEO 모순)\n   ${row.discoveredUrl}`,
          ).toBe(true);
        }
      } finally {
        cleanup();
      }
    }

    /* eslint-disable no-console */
    console.log(
      `[CAND02-dom] 불변식 유효 — 상품 ${measuredProducts}/5 · 가격 후보 ${measuredRows}건` +
        (unmeasured.length > 0 ? ` · 🔴 측정불가 ${JSON.stringify(unmeasured)}` : ""),
    );
    /** 🔴 **분모가 비면 이 테스트는 아무것도 증명하지 못한다** — 그래서 분모를 단언한다. */
    expect(measuredProducts, "가격 후보가 있는 상품이 0 — 이 단언은 공집합에서 통과했다").toBeGreaterThan(0);
    expect(measuredRows).toBeGreaterThan(0);
  });

  /**
   * 🔴 CAND-02-G — 리스트에 선 모든 행은 **가격 칸을 갖는다**(값 또는 「가격 미확인」).
   *    🟢 가격이 없는 후보를 **버리지 않는다** 가 CPO §4-A 이고, 그 약속이 화면에
   *       지켜지는지는 **빈 칸이 아닌지** 로만 확인할 수 있다.
   */
  it("CAND-02-G 리스트의 모든 행이 가격 칸을 갖는다(없으면 「가격 미확인」)", () => {
    let checked = 0;
    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) continue;
      const { doc, cleanup } = mount(rows);
      try {
        const lis = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
        /**
         * 🔴🔴 **1차 단언이 동어반복이었고 내 변이가 그것을 잡았다**(M2).
         *    `expected` 를 `selectCandidateList(...)` 로 세면 **그 함수를 좁히는 변이가
         *    기대값도 같이 좁혀서** 6/6 이 통과한다(WU-145 ⒜ 와 같은 함정).
         * 🟢 그래서 기대값은 **실측에 얼어 있는 숫자** 다 — 라이브 실행이 «변이 없는»
         *    운영 선택기로 기록한 `display` 칸이다.
         */
        const frozen = p.rows.filter((m) => m.display != null).length;
        expect(lis.length, `${p.sid} 리스트 행 수가 실측 기록과 다르다`).toBe(frozen);
        for (const li of lis) {
          const price = li.querySelector('[data-testid="mi-candidate-price"]');
          expect(price, `${p.sid} 가격 칸이 없다`).toBeTruthy();
          expect((price!.textContent ?? "").trim().length, `${p.sid} 가격 칸이 비었다`).toBeGreaterThan(0);
          /** 🔴 선택 UI 가 같이 서야 셀러가 «고를» 수 있다(CLOSE-04 와 같은 축). */
          /** 🔵 UNIFIED-UX-1 ⑦ — 선택 UI 는 제거됐다. 그 자리를 「우리 판단」이 대신한다. */
          expect(li.querySelector('[data-testid="mi-candidate-judgement"]'), `${p.sid} 우리 판단 부재`).toBeTruthy();
          expect(li.querySelector('[data-testid="mi-candidate-select"]')).toBeNull();
          checked += 1;
        }
      } finally {
        cleanup();
      }
    }
    expect(checked, "검사한 행이 0 — 공집합 통과다").toBeGreaterThan(0);
  });

  /**
   * 🔴 CAND-02-H — **충돌 판정 후보는 리스트에 서지 않는다**(제외 축의 Negative).
   *    🟢 이것이 없으면 「전부 보여준다」로 넓혀도 이 파일이 초록이다.
   */
  it("CAND-02-H CONFLICT 후보는 리스트에 서지 않는다", () => {
    let conflicts = 0;
    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) continue;
      const { doc, cleanup } = mount(rows);
      try {
        const inList = shownUrls(doc, "mi-candidate-row");
        for (const m of p.rows) {
          if (m.tier !== "CONFLICT" && m.verdict !== "CONFLICT") continue;
          conflicts += 1;
          expect(
            inList.has(loose(m.url)),
            `🔴 ${p.sid} ${m.domain} 충돌 판정인데 후보 리스트에 섰다\n   ${m.url}`,
          ).toBe(false);
        }
      } finally {
        cleanup();
      }
    }
    /** 🔴 실측에 충돌 후보가 **있었다** — 분모가 0 이면 이 단언은 의미가 없다. */
    expect(conflicts, "충돌 후보가 0 — 제외 축을 측정하지 못했다").toBeGreaterThan(0);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔵 **CAND-02-K — 「가격이 없어도 버리지 않는다」(CPO §4-A)를 잠근다.**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 **내 변이(M2)가 이 공백을 찾았다.** 표시 축에 `isPriceConfirmed` 조건을 더해도
   *    `PRICE ⊆ DISPLAY` 는 **여전히 참** 이다(가격 후보는 정의상 가격이 확인된
   *    행이니까) ⟹ CAND-02-F 로는 **그 회귀를 잡을 수 없다.** 그런데 그것이 바로
   *    CEO 가 본 모순의 **다른 절반** 이다 — 「동일상품 가능성이 있는데 가격을
   *    확인하지 못한 후보」가 화면에서 사라지는 것.
   * 🟢 그래서 **가격이 확인되지 않은 후보가 리스트에 서 있는지** 를 따로 단언한다.
   */
  it("CAND-02-K 가격이 확인되지 않은 후보도 리스트에서 사라지지 않는다", () => {
    let unpriced = 0;
    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) continue;
      const { doc, cleanup } = mount(rows);
      try {
        const inList = shownUrls(doc, "mi-candidate-row");
        for (const m of p.rows) {
          /** 🟢 실측이 「표시 대상」으로 기록했고 **가격은 확인되지 않은** 행. */
          if (m.display == null) continue;
          if (m.priceStatus === "VERIFIED_CURRENT") continue;
          unpriced += 1;
          expect(
            inList.has(loose(m.url)),
            `🔴 ${p.sid} ${m.domain} 가격 미확인 후보가 리스트에서 사라졌다(CPO §4-A 위반)\n   ${m.url}`,
          ).toBe(true);
        }
      } finally {
        cleanup();
      }
    }
    /** 🔴 분모가 0 이면 이 단언은 공집합에서 통과한다 — 실측에 그 행이 **있었다**. */
    expect(unpriced, "가격 미확인 후보가 0 — 이 축은 이 표본에서 측정불가").toBeGreaterThan(0);
  });

  /**
   * 🟡 CAND-02-I — **관측** 이고 FAIL 조건이 아니다.
   *    리스트는 「동일상품 **가능성**」이라 사람이 DIFFERENT 라 한 후보도 설 수 있다.
   * 🔴 그러나 **몇 건인지 모르면 CPO 가 판정할 수 없다** ⟹ 숫자를 적는다.
   * 🔴 CTO 가 이것을 근거로 리스트 정책을 바꾸지 않았다(CPO 판정 사안).
   */
  it("CAND-02-I 사람이 DIFFERENT 라 한 후보가 리스트에 몇 건 서는지 적는다", () => {
    const leaked: string[] = [];
    let labeled = 0;
    for (const p of products()) {
      const rows = p.rows.map(toRow);
      if (rows.length === 0) continue;
      const { doc, cleanup } = mount(rows);
      try {
        const inList = shownUrls(doc, "mi-candidate-row");
        for (const m of p.rows) {
          if (m.human !== "SAME" && m.human !== "DIFFERENT") continue;
          labeled += 1;
          if (m.human === "DIFFERENT" && inList.has(loose(m.url))) {
            leaked.push(`${p.sid} ${m.domain}(${m.verdict ?? m.tier ?? "?"})`);
          }
        }
      } finally {
        cleanup();
      }
    }
    console.log(`[CAND02-dom] 라벨 ${labeled}건 · 🟡 human DIFFERENT 가 리스트에 ${leaked.length}건 ${JSON.stringify(leaked)}`);
    expect(labeled).toBeGreaterThan(0);
  });

  /** 🔴 CAND-02-J — 후보가 0 인 상품은 **「없다」고 말한다**(미조회와 섞지 않는다). */
  it("CAND-02-J 행이 0 인 상품은 빈 상태 문구를 말한다", () => {
    const empty = products().filter((p) => p.rows.length === 0);
    /** 🔴 실측에 그 상품이 **있었다**(S5) — 없으면 이 축을 측정하지 못한 것이다. */
    expect(empty.length, "행 0 인 상품이 없다 — 빈 상태 축은 이 표본에서 측정불가").toBeGreaterThan(0);
    const { doc, cleanup } = mount([]);
    try {
      expect(doc.querySelector('[data-testid="mi-candidate-row"]')).toBeNull();
      /**
       * 🔴🔴 CANDIDATE-UX-REFINE-01 — **이 단언이 두 번 틀렸고 둘 다 적는다.**
       *
       * ⒜ 전의 `not.toContain(CANDIDATE_LIST_HEADING)` 은 상수가 시장별 `Record` 가
       *    되면서 **객체를 넘겨 항상 통과** 했다(동어반복).
       *    🔴 `not.toContain` 이 `any` 를 받으므로 **typecheck 도 안 막는다** —
       *       실제로 tsc 0 · 이 테스트 PASS 였다(「타입이 잡아 준다」는 예상이 틀렸다).
       * ⒝ 그래서 `.KR`/`.OVERSEAS` 글자로 바꿨더니 **FAIL** 했다 —
       *    U7 의 「국내 소싱 후보**가 없습니다**」가 제목을 **부분문자열로 포함** 한다.
       *    🟢 그 겹침은 **의도된 것** 이다(같은 어휘를 쓰는 것이 셀러에게 일관된다).
       *
       * 🔴🔴 ⟹ 원래 이 단언이 보려던 것은 글자가 아니라 **「빈 칸에는 후보 리스트
       *    «구역» 이 서지 않는다」** 였다. 문자열은 그 프록시였고 이제 모호하다.
       * 🟢 그래서 **구조로 올린다** — 프록시보다 직접적이고 문구 변경에 흔들리지 않는다.
       */
      expect(
        doc.querySelector('[data-testid="mi-candidate-list"]'),
        "후보 0 인데 후보 리스트 구역이 서 있다",
      ).toBeNull();
      expect(doc.querySelector('[data-testid="mi-candidate-group-block"]')).toBeNull();
      /** 🟢 그리고 **빈 상태가 실제로 선다**(구역이 사라진 것과 구별한다 · WU-130 ②). */
      expect(doc.querySelector('[data-testid="mi-candidate-empty"]')).not.toBeNull();
    } finally {
      cleanup();
    }
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-UX-REFINE-01 — **U1 · U5 · U7 화면 계약**(CPO ⒜ · §14)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 입력은 **같은 실측 fixture** 다 — 새 fixture 를 만들지 않았다(손으로 만든 행 0).
 * 🔴 이 블록이 지키는 한 문장 —
 * > 「가격을 최대한 보여주되, **그 가격이 얼마나 믿을 만한지** 를 셀러가
 * >  카드 하나만 보고 바로 알 수 있게 한다.」
 */
describe("UX-REFINE 화면 계약 — 시장명 · 가격 3상태", () => {
  /** 🟢 실측 fixture 전 행(시장 무관). 가격 3상태의 분모를 여기서 만든다. */
  const allRows = (): GeminiTransientRow[] => products().flatMap((p) => p.rows.map(toRow));

  /**
   * 🔴🔴 **U1/U7 — 국내 칸이 「해외」라고 적으면 FAIL-01 이다.**
   *    `MarketColumn` 이 KR·OVERSEAS 를 **공유** 하므로 글자를 한 줄로 두면
   *    국내 칸에도 「해외 소싱 후보」가 뜬다. 🔴 그래서 **글자를 직접 적어** 단언한다.
   */
  it("UX-01 시장별 제목이 각 칸에 «정확히» 선다 — 국내 칸에 「해외」가 없다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const kr = doc.querySelector('[data-testid="mi-same-domestic"]');
      const os = doc.querySelector('[data-testid="mi-same-overseas"]');
      expect(kr, "국내 칸이 없다 — 이 축을 측정할 수 없다").not.toBeNull();
      expect(os, "해외 칸이 없다 — 이 축을 측정할 수 없다").not.toBeNull();
      const krText = kr!.textContent ?? "";
      const osText = os!.textContent ?? "";
      /** 🔴 확정 글자를 **직접** 적는다 — 상수를 바꿔도 통과하는 길을 막는다. */
      expect(krText).not.toContain("해외 소싱 후보");
      expect(osText).not.toContain("국내 소싱 후보");
      /** 🟢 그리고 각 칸은 자기 시장의 말을 **실제로** 한다(후보 유무와 무관하게 둘 중 하나). */
      expect(krText.includes("국내 소싱 후보")).toBe(true);
      expect(osText.includes("해외 소싱 후보")).toBe(true);
    } finally {
      cleanup();
    }
  });

  /** 🔴 U1 — 「N곳」은 **실제 행 수** 다(상수/하드코딩이면 조용히 갈라진다 · FAIL-02). */
  it("UX-02 후보 수가 실제 mi-candidate-row 개수와 일치한다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      for (const col of ["mi-same-domestic", "mi-same-overseas"]) {
        const host = doc.querySelector(`[data-testid="${col}"]`);
        if (!host) continue;
        const rows = host.querySelectorAll('[data-testid="mi-candidate-row"]').length;
        const summary = host.querySelector('[data-testid="mi-candidate-list"] > summary');
        if (rows === 0) {
          expect(summary, `${col}: 행 0 인데 리스트 구역이 있다`).toBeNull();
          continue;
        }
        expect(summary!.textContent ?? "").toContain(`${rows}곳`);
        /** 🟢 그룹별 개수 합 == 전체 행 수(어느 행도 그룹 밖으로 사라지지 않는다). */
        let sum = 0;
        for (const b of Array.from(host.querySelectorAll('[data-testid="mi-candidate-group-block"]'))) {
          const n = b.querySelectorAll('[data-testid="mi-candidate-row"]').length;
          expect(n, "빈 그룹 블록이 렌더됐다").toBeGreaterThan(0);
          expect(b.querySelector('[data-testid="mi-candidate-group-heading"]')?.textContent ?? "").toContain(`${n}곳`);
          sum += n;
        }
        expect(sum).toBe(rows);
      }
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴🔴🔵 **UX-03 — §14 Contract 1·2. 가격 상태가 행을 «잃지 않는다».**
   *    P1+P2+P3 == 전체 행. 🔴 가격 때문에 후보가 사라지면 이 단언이 깨진다.
   */
  it("UX-03 P1+P2+P3 == 전체 후보 행 수 · 상태 값이 전부 유효하다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows.length, "행이 0 이면 가격 3상태를 측정할 수 없다").toBeGreaterThan(0);
      const tally = { CONFIRMED: 0, UNVERIFIED: 0, NONE: 0 } as Record<string, number>;
      for (const r of rows) {
        const s = r.getAttribute("data-price-state") ?? "";
        expect(["CONFIRMED", "UNVERIFIED", "NONE"]).toContain(s);
        tally[s] = (tally[s] ?? 0) + 1;
      }
      expect(tally.CONFIRMED + tally.UNVERIFIED + tally.NONE).toBe(rows.length);
      console.log(`[UX-REFINE] 가격 3상태 — P1 ${tally.CONFIRMED} · P2 ${tally.UNVERIFIED} · P3 ${tally.NONE} (행 ${rows.length})`);
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴🔴🔵 **UX-04 — §14 Contract 3·4·5. 이것이 FAIL-04 를 막는 단언이다.**
   *    P2 가 P1 과 **똑같이 보이면** 셀러가 미검증 금액으로 판매가를 정한다.
   */
  it("UX-04 P2 만 상태 줄을 달고 · P1 은 달지 않고 · P3 은 「가격 확인 필요」다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      let seenP2 = 0;
      for (const r of rows) {
        const state = r.getAttribute("data-price-state");
        const unverified = r.querySelector('[data-testid="mi-candidate-price-unverified"]');
        const price = (r.querySelector('[data-testid="mi-candidate-price"]')?.textContent ?? "").trim();
        if (state === "CONFIRMED") {
          expect(unverified, "P1 에 검증 전 표시가 붙었다").toBeNull();
          expect(price).not.toBe("가격 확인 필요");
        }
        if (state === "UNVERIFIED") {
          /** 🔴 글자를 **직접** 적는다 — 상수를 비워도 통과하는 길을 막는다. */
          expect(unverified, "P2 가 P1 과 구별되지 않는다(FAIL-04)").not.toBeNull();
          expect(unverified!.textContent ?? "").toContain("판매처 표시가 · 상세 검증 전");
          seenP2 += 1;
        }
        if (state === "NONE") {
          expect(price).toBe("가격 확인 필요");
          expect(unverified, "P3 에 검증 전 표시가 붙었다").toBeNull();
        }
      }
      console.log(`[UX-REFINE] P2 상태 줄이 붙은 행 ${seenP2}건`);
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴 §14 Contract 6·7 — 환산 금지 · 다른 화면의 글자 금지.
   * 🔴 `priceText` 를 고치지 않았다는 **행동 증거** 이기도 하다.
   */
  it("UX-05 후보 카드에 환산 기호와 「가격 미확인」이 없다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        const t = r.textContent ?? "";
        /**
         * 🔵 CLOSE-3 §0 — **CPO 지시 방향 전환.** 「후보 카드 «안» 의 환산」이
         *    허용됐으므로 `₩` 와 `약 ` 는 **더 이상 금지가 아니다**.
         * 🔴 `≈` 는 **그대로 금지** 다 — 그 기호는 「대략 같다」는 **비교** 를 말하고
         *    통화를 섞어 비교하는 그 금지축(`overseas-reference` 계약)의 글자다.
         */
        for (const token of ["≈"]) {
          expect(t, `후보 카드에 환산 표기 ${token} 가 있다`).not.toContain(token);
        }
        /**
         * 🔴🔴 그 대신 **SOURCE 가 그대로인지** 를 여기서 문다(§2 「원본을 덮어쓰지
         *    않는다」). 환산은 **별도의 줄** 이어야 하고, 원본 가격 줄에 `약 ₩` 가
         *    섞이면 셀러가 보는 「판매처 현재가격」이 원화로 **대체** 된 것이다.
         */
        const priceLine = r.querySelector('[data-testid="mi-candidate-price"]');
        expect(priceLine, "원본 가격 줄이 사라졌다").not.toBeNull();
        expect(
          priceLine!.textContent ?? "",
          "🔴 원본 가격 줄이 원화 환산으로 덮였다(환산은 별도 줄이어야 한다)",
        ).not.toContain("약 ₩");
        /** 🔴 그 글자는 **다른 화면의 것** 이다(`mi-022`·`wu-028` 이 잠갔다). */
        expect(t).not.toContain(PRICE_UNKNOWN_TEXT);
        expect(t).not.toContain("가격 미확인");
      }
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴 FAIL-03 — 선택 기능이 사라지면 셀러의 판단이 **저장되지 않는다**(CLOSE-04 저장 흐름).
   *    U4 가 카드 순서를 재배치하면서 가장 쉽게 잃을 수 있는 칸이라 따로 잠근다.
   */
  it("UX-06 모든 후보 카드에 선택 UI 와 U4 칸들이 남아 있다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        /** 🔵 UNIFIED-UX-1 ⑦ — 「선택 UI 유지」를 「우리 판단 유지 + 선택 UI 0」으로 옮겼다. */
        expect(r.querySelector('[data-testid="mi-candidate-judgement"]'), "「우리 판단」이 사라졌다").not.toBeNull();
        expect(r.querySelector('[data-testid="mi-candidate-select"]')).toBeNull();
        /** 🔴 행마다 **판정 라벨** — WU-091 의 네 조건 중 하나(그룹 헤더가 대체하지 못한다). */
        expect(r.querySelector('[data-testid="mi-candidate-group"]')).not.toBeNull();
        /** 🔴 이미지 칸은 **없으면 「이미지 없음」을 적는다**(대체 사진 금지). */
        expect(r.querySelector('[data-testid="mi-candidate-image"]')).not.toBeNull();
        expect(r.querySelector("a[href]"), "판매 페이지 링크가 없다").not.toBeNull();
      }
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴 U7 — 「없다」와 「조회하지 않았다」를 가른다(WU-130 ②).
   * 🟢 그리고 **시장명이 맞는지** 를 같이 본다.
   */
  it("UX-07 후보 0 이면 시장별 빈 상태 + 사유 한 줄이 선다", () => {
    const { doc, cleanup } = mount([]);
    try {
      const empties = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-empty"]'));
      expect(empties.length).toBeGreaterThan(0);
      const texts = empties.map((e) => (e.textContent ?? "").trim());
      expect(texts).toContain("국내 소싱 후보가 없습니다");
      expect(texts).toContain("해외 소싱 후보가 없습니다");
      /** 🟢 상수도 그 글자여야 한다(화면과 상수가 갈라지지 않는다). */
      expect(Object.values(CANDIDATE_LIST_EMPTY)).toEqual([
        "국내 소싱 후보가 없습니다",
        "해외 소싱 후보가 없습니다",
      ]);
      const note = doc.querySelector('[data-testid="mi-candidate-empty-note"]');
      expect(note, "왜 없는지를 말하지 않으면 「조회하지 않았다」로 읽힌다").not.toBeNull();
      /** 🔴 「동일상품이 없습니다」로 **단정하지 않는다**. */
      expect(doc.body.textContent ?? "").not.toContain("동일상품이 없습니다");
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴🔴 **UX-09 — P3 을 «구성된 행» 으로 잠근다.**
   *
   * 🔴 실측 fixture 의 P3 가 **0 건** 이다(P1 10 · P2 3 · P3 0). 그래서 UX-04 의
   *    P3 분기는 **한 번도 실행되지 않았다** — 그 상태로 「Contract 3 PASS」라고
   *    적으면 **분모 0 에서의 초록** 이다(§5-B 가 금지한 그 모양).
   * 🟢 그래서 이 축만 **손으로 만든 행** 으로 돌린다. 🔴 그 사실을 숨기지 않는다 —
   *    이 테스트의 입력은 실측이 아니고, 나머지 UX-01~08 은 실측이다.
   * 🔴 그리고 **가격이 없어도 후보가 사라지지 않는다** 를 같이 단언한다(§10).
   */
  it("UX-09 [구성된 행] 가격 없는 후보도 서고 「가격 확인 필요」를 말한다", () => {
    const noPrice = {
      domain: "example.com",
      discoveredUrl: "https://example.com/p/1",
      title: "Booty Ghosts T-Shirt",
      market: "OVERSEAS",
      crossSellerVerdict: "SAME",
      matchTruth: "EXACT_IDENTIFIER",
      matchReasons: ["핵심 상품명 일치"],
      priceAmount: null,
      priceCurrency: null,
      priceStatus: "PRICE_UNAVAILABLE",
      soldOut: null,
    } as unknown as GeminiTransientRow;
    const { doc, cleanup } = mount([noPrice]);
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      /** 🔴 가격이 없다는 이유로 **제거되지 않는다**. */
      expect(rows, "가격 없는 후보가 리스트에서 사라졌다").toHaveLength(1);
      expect(rows[0]!.getAttribute("data-price-state")).toBe("NONE");
      expect(
        (rows[0]!.querySelector('[data-testid="mi-candidate-price"]')?.textContent ?? "").trim(),
      ).toBe("가격 확인 필요");
      expect(rows[0]!.querySelector('[data-testid="mi-candidate-price-unverified"]')).toBeNull();
      /** 🔴 그 행에도 선택 UI 와 판정 라벨이 있다. */
      expect(rows[0]!.querySelector('[data-testid="mi-candidate-group"]')).not.toBeNull();
      expect(rows[0]!.textContent ?? "").not.toContain("가격 미확인");
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴🔴 **UX-08 — `priceState` 가 «어댑터» 라는 것을 행동으로 잠근다.**
   *    owner 는 `isPriceConfirmed` 하나다. 둘이 갈라지면 화면과 가격 축이 다른 말을 한다.
   */
  it("UX-08 priceState 가 isPriceConfirmed 와 어긋나지 않는다", () => {
    const rows = allRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      const s = priceState(r);
      if (r.priceAmount == null || !r.priceCurrency) {
        expect(s).toBe("NONE");
        continue;
      }
      expect(s).toBe(isPriceConfirmed(r) ? "CONFIRMED" : "UNVERIFIED");
    }
    /** 🔴 구버전 행(priceStatus 없음)은 **UNVERIFIED** 다 — CONFIRMED 로 승격하지 않는다. */
    expect(priceState({ domain: "d", discoveredUrl: "u", priceAmount: 40, priceCurrency: "EUR" })).toBe("UNVERIFIED");
    expect(CANDIDATE_PRICE_UNKNOWN).toBe("가격 확인 필요");
    expect(CANDIDATE_PRICE_UNVERIFIED).toBe("판매처 표시가 · 상세 검증 전");
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CANDIDATE-UX-REFINE-02 — **Seller Decision Card**(CPO ⒞ 2026-11-01)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **분모를 같이 적는다.** `-01` 에서 `matchReasons` 고유값이 **0** 이라 판단근거
 *    축이 계약 9건 **어디에도 안 걸렸는데** 「PASS」로 보고했다. 그 실수를 막으려고
 *    이 블록은 축마다 **분모를 로그로 내고**, 분모가 0 이면 **FAIL 로 멈춘다**(CPO §17).
 *
 * 🔴 실측 fixture(`cand-02-rows.json`)에 blockers·conflicts 칸이 **없다** ⟹ 그 축은
 *    **실측 POSSIBLE 행**(`ab046-evidence.json` · 운영 판정이 실제로 낸 `MODEL_CODE`
 *    충돌)으로 잰다. 🔴 **가짜 production 의미를 만들지 않았다.**
 */
const AB046 = join(
  __dirname, "..", "..", "..", "api", "price-history", "_lib", "__tests__",
  "fixtures", "ab046-evidence.json",
);

/** 🟢 실측 산출 → 운영 행. 🔴 칸을 지어내지 않는다(`pp-01` 과 같은 변환). */
function ab046Row(): GeminiTransientRow {
  const j = JSON.parse(readFileSync(AB046, "utf8")) as {
    candidate: {
      url: string;
      judged: {
        title: string;
        price: { amount: number; currency: string } | null;
        matchReasons: string[];
        crossSellerVerdict: string;
        crossSellerConflicts: ({ conflict: string } | string)[];
        priceStatus: string;
      };
    };
  };
  const c = j.candidate.judged;
  return {
    domain: "bobochoses.com",
    discoveredUrl: j.candidate.url,
    title: c.title,
    market: "OVERSEAS",
    soldOut: null,
    crossSellerVerdict: c.crossSellerVerdict,
    matchTruth: null,
    matchReasons: c.matchReasons,
    crossSellerBlockers: [],
    crossSellerConflicts: (c.crossSellerConflicts ?? []).map((x) =>
      typeof x === "string" ? x : x.conflict,
    ),
    priceAmount: c.price?.amount ?? null,
    priceCurrency: c.price?.currency ?? null,
    priceStatus: c.priceStatus,
    source: "WEB_SEARCH",
  } as GeminiTransientRow;
}

describe("UX-REFINE-02 — Seller Decision Card", () => {
  /**
   * 🔴🔴 **ab046 을 «앞» 에 둔다 — 그렇지 않으면 렌더되지 않는다.**
   *
   * 같은 URL 이 `cand-02-rows.json` 에도 있는데 그 행은 **`display: null`**(= 리스트에
   * 서지 못함)이다. 그런데 `selectCandidateList` 는 **tier 검사 «전» 에 `seen.add`** 를
   * 한다 ⟹ 렌더되지 않는 행이 **URL 자리를 선점** 하고 뒤에 온 행을 중복으로 버린다.
   * 🔴 1차에 그걸 몰라 DOM 행이 **13** 인데 분모를 **16** 으로 적었고 R2-03/R2-08 이 FAIL 했다.
   *
   * 🟢 그래서 **같은 후보의 «더 완전한 실측 기록»** 을 앞에 두고 빈약한 쪽을 뺀다.
   *    둘 다 운영 산출이고, `ab046-evidence.json` 쪽만 `conflicts`·`matchReasons` 칸을
   *    들고 있다(`cand-02-rows.json` 은 그 칸을 애초에 저장하지 않았다).
   * 🔴 **가짜를 만든 것이 아니다** — 같은 URL 의 두 실측 기록 중 칸이 있는 쪽을 쓴다.
   */
  const allRows = (): GeminiTransientRow[] => {
    const ab = ab046Row();
    const rest = products()
      .flatMap((p) => p.rows.map(toRow))
      .filter((r) => r.discoveredUrl !== ab.discoveredUrl);
    return [ab, ...rest];
  };

  /** 🔴🔴 R2-00 — 분모부터. 이 숫자가 없으면 아래 PASS 들의 «뜻» 을 알 수 없다. */
  it("R2-00 [분모] 각 축의 denominator 를 기록한다", () => {
    const rows = allRows();
    const d = {
      전체: rows.length,
      blocker있음: rows.filter((r) => candidateWarningLines(r).length > 0).length,
      blocker없음: rows.filter((r) => candidateWarningLines(r).length === 0).length,
      POSSIBLE: rows.filter((r) => (r.crossSellerConflicts ?? []).length > 0).length,
      P1: rows.filter((r) => priceState(r) === "CONFIRMED").length,
      P2: rows.filter((r) => priceState(r) === "UNVERIFIED").length,
      P3: rows.filter((r) => priceState(r) === "NONE").length,
      matchReasons보유: rows.filter((r) => (r.matchReasons?.length ?? 0) > 0).length,
    };
    console.log(`[R2-분모] ${JSON.stringify(d)}`);
    expect(d.blocker있음, "blocker 분모 0 — R2-03 은 측정불가").toBeGreaterThan(0);
    expect(d.blocker없음, "blocker 없는 행 0 — R2-04 는 측정불가").toBeGreaterThan(0);
    expect(d.matchReasons보유, "matchReasons 분모 0 — R2-05 가 동어반복이 된다").toBeGreaterThan(0);
  });

  /** 🔴 R2-01 — 행마다 등급(WU-091 불변식 · `-01` 에서 가드가 잡은 자리). */
  it("R2-01 모든 후보 행에 등급 라벨이 있다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        const g = (r.querySelector('[data-testid="mi-candidate-group"]')?.textContent ?? "").trim();
        /** 🔵 UNIFIED-UX-1 ② — 등급 앞에 `우리 판단:` 접두사가 붙었다(어휘 자체는 불변). */
        expect([
          "우리 판단: 🟢 동일상품 가능성 높음",
          "우리 판단: 🟡 동일상품 추정",
          "우리 판단: 🟡 품번 충돌 · 참고",
        ]).toContain(g);
      }
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴🔴 R2-03 — blocker/conflict 가 있는 행은 「확인 필요」를 **말한다**.
   *
   * 🔵🔵 **JUDGEMENT-DEDUP-1 — 좌표가 옮겨졌다(뜻은 그대로다).**
   * 🔴 그 줄의 owner 가 **접힘 안**(`mi-candidate-warning`) → **접힘 밖 「우리 판단」**
   *    (`mi-candidate-judgement-basis`)으로 바뀌었다.
   * 🔴 **약화 0 — 강화했다.** 「말한다」에 **「밖에 하나 · 안에 0」** 을 더한다
   *    (그것이 이 WU 가 고친 중복의 반대 조건이다).
   */
  it("R2-03 blocker/conflict 가 있는 행이 확인 필요사항을 표시한다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      const withWarn = rows.filter((r) =>
        r.querySelector('[data-testid="mi-candidate-judgement-basis"]'),
      );
      expect(withWarn.length, "경고가 붙은 행 0 — 측정불가").toBeGreaterThan(0);
      for (const r of withWarn) {
        const basis = r.querySelector('[data-testid="mi-candidate-judgement-basis"]')!;
        const t = basis.textContent ?? "";
        expect(t).toContain("⚠ 확인 필요:");
        /** 🔴 영문 내부 토큰이 그대로 나가지 않는다(`blocker-text.ts` 가 owner). */
        expect(t).not.toContain("MODEL_CODE");
        expect(t).not.toContain("BRAND_");
        /**
         * 🔴 **밖에 하나** — 「근거 확인」 접힘 «안» 이 아니다(1차에서 보여야 한다).
         * 🔴🔴 `closest("details")` 로 보면 안 된다 — 카드 목록이 **조상 details** 라
         *    항상 걸린다. 묻는 것은 **「근거 확인 접힘 안인가」** 하나다.
         */
        expect(
          basis.closest('[data-testid="mi-candidate-evidence"]'),
          "🔴 확인 필요 줄이 접힘 안으로 들어갔다 — 1차에서 안 보인다",
        ).toBeNull();
        expect(r.querySelectorAll('[data-testid="mi-candidate-judgement-basis"]')).toHaveLength(1);
        /** 🔴 **안에 0** — 접힘 안에 같은 줄을 또 적으면 중복이 되살아난다. */
        expect(
          r.querySelectorAll('[data-testid="mi-candidate-warning"]'),
          "🔴 접힘 안에 경고가 서면 밖의 줄과 중복된다",
        ).toHaveLength(0);
      }
      console.log(`[R2-03] 경고 표시 ${withWarn.length}건 / 전체 ${rows.length}건`);
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴 R2-04 — 없는 blocker 를 **만들어 적지 않는다**.
   * 🔴 「확인 필요」 자체를 금지어로 쓰지 않는다 — P3 의 **「가격 확인 필요」가 정당하게**
   *    그 글자를 쓴다(그걸 금지하면 내 단언이 거짓 FAIL 을 낸다).
   *
   * 🔵🔵 **JUDGEMENT-DEDUP-1 — 좌표가 옮겨졌다.** 🔴🔴 그리고 이 자리가
   *    **조용히 거짓이 될 자리였다** — `mi-candidate-warning` 이 사라지자 그 필터가
   *    **모든 행** 을 「경고 없는 행」으로 분류했고, 그래서 **경고가 정당하게 있는 행의
   *    `⚠`** 를 금지어로 잡아 FAIL 했다(= 제품 결함이 아니라 분모 오류).
   * 🟢 owner 인 **접힘 밖 판단 근거** 로 분모를 다시 세운다. 금지어 목록은 **불변**.
   */
  it("R2-04 blocker 가 없는 행에는 경고 줄이 서지 않는다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      const clean = rows.filter(
        (r) => !r.querySelector('[data-testid="mi-candidate-judgement-basis"]'),
      );
      expect(clean.length, "경고 없는 행 0 — 측정불가").toBeGreaterThan(0);
      /** 🔴 분모가 **전체** 가 되면 이 단언은 아무것도 못 본다(위 사고의 재발 방지). */
      expect(clean.length, "🔴 모든 행이 「경고 없음」이면 필터가 죽은 것이다").toBeLessThan(
        rows.length,
      );
      for (const r of clean) {
        const t = r.textContent ?? "";
        for (const banned of ["모든 정보 일치", "검증 완료", "완벽한 동일상품", "⚠"]) {
          expect(t, `없는 사실을 만들어 적었다: ${banned}`).not.toContain(banned);
        }
      }
      console.log(`[R2-04] 경고 없는 행 ${clean.length}건 / 전체 ${rows.length}건`);
    } finally {
      cleanup();
    }
  });

  /** 🔴🔴🔵 R2-05 — **이 WU 의 핵심.** `matchReasons` 가 카드에 나오지 않는다. */
  it("R2-05 matchReasons 진단 문장이 카드에 출력되지 않는다 (데이터에는 남는다)", () => {
    const rows = allRows();
    const reasonRows = rows.filter((r) => (r.matchReasons?.length ?? 0) > 0);
    expect(reasonRows.length, "matchReasons 분모 0 — 이 단언은 동어반복이다").toBeGreaterThan(0);
    const { doc, cleanup } = mount(rows);
    try {
      const body = doc.body.textContent ?? "";
      for (const r of reasonRows)
        for (const line of r.matchReasons ?? [])
          expect(body, `카드에 진단 문장이 그대로 나왔다: ${line}`).not.toContain(line);
      /** 🔴 `-01` 이 쓰던 구조 자체가 **사라졌다**. */
      expect(doc.querySelector('[data-testid="mi-candidate-reasons"]')).toBeNull();
      console.log(`[R2-05] matchReasons 보유 ${reasonRows.length}건 — 화면 노출 0`);
    } finally {
      cleanup();
    }
  });

  /**
   * 🔴 R2-09 — 내부 진단·정책 문구 금지.
   * 🔴 「불일치」를 금지어로 쓰지 않는다 — `blocker-text.ts` 의 **「브랜드 불일치」가
   *    정당한 셀러 문구** 다(금지하면 내 단언이 올바른 코드를 때린다).
   */
  it("R2-09 내부 진단·정책 문구가 카드에 없다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        const t = r.textContent ?? "";
        expect(t, "유사도 퍼센트가 카드에 있다").not.toMatch(/유사도/);
        for (const banned of ["보조 근거", "단독으로 승격", "참고만"]) {
          expect(t, `내부 정책 설명이 카드에 있다: ${banned}`).not.toContain(banned);
        }
      }
    } finally {
      cleanup();
    }
  });

  /** 🔴 R2-06 — POSSIBLE 은 「🟡 품번 충돌 · 참고」로 **별도 의미** 를 유지한다. */
  it("R2-06 POSSIBLE(품번 충돌) 카드가 별도 등급으로 서고 확인사항을 말한다", () => {
    const row = ab046Row();
    expect(row.crossSellerConflicts).toEqual(["MODEL_CODE"]);
    const { doc, cleanup } = mount([row]);
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows, "POSSIBLE 분모 0 — 측정불가").toHaveLength(1);
      expect(rows[0]!.getAttribute("data-group")).toBe("POSSIBLE");
      /** 🔵 UNIFIED-UX-1 ② — 등급 앞에 `우리 판단:` 접두사가 붙었다(어휘 자체는 불변). */
      expect(
        (rows[0]!.querySelector('[data-testid="mi-candidate-group"]')?.textContent ?? "").trim(),
      ).toBe("우리 판단: 🟡 품번 충돌 · 참고");
      /**
       * 🔵 **JUDGEMENT-DEDUP-1 — 좌표 이동.** 확인사항의 owner 는 **접힘 밖
       *    「우리 판단」** 이다. 🔴 「말한다」는 요구는 **그대로** 이고, 그 줄이
       *    1차 노출에 있다는 것까지 **더** 본다(약화 0).
       */
      const warn = rows[0]!.querySelector('[data-testid="mi-candidate-judgement-basis"]');
      expect(warn, "품번 충돌 카드가 확인 필요사항을 말하지 않는다").not.toBeNull();
      expect(warn!.textContent ?? "").toContain("품번 충돌");
      expect(
        warn!.closest('[data-testid="mi-candidate-evidence"]'),
        "🔴 품번 충돌 확인사항이 접힘 안으로 들어갔다",
      ).toBeNull();
    } finally {
      cleanup();
    }
  });

  /**
   * 🔵🔵🔵 **UNIFIED-UX-1 ⑦ 에서 대상이 바뀌었다 — 뜻은 그대로다.**
   *
   * 🔴 전 계약: 「모든 카드에 **선택 UI** 와 판매처 이동이 있다」. 지키던 것은
   *    **「카드 재구성에서 칸을 잃지 않는다」** 였다.
   * 🔴🔴 CPO 결정(⒝) — 선택 UI 제거 ⟹ 그 자리를 **「우리 판단」 영역** 이 대신한다.
   * 🟢 **판매처 이동 링크 단언은 한 글자도 안 바꿨다**(기본 5칸 중 하나).
   * 🔴 그리고 선택 UI 가 **되살아나면 FAIL** 하는 단언을 **새로** 더했다(약화 0).
   */
  it("R2-07 모든 카드에서 「우리 판단」과 판매처 이동이 유지된다(선택 UI 0)", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(
          r.querySelector('[data-testid="mi-candidate-judgement"]'),
          "「우리 판단」 영역이 사라졌다",
        ).not.toBeNull();
        expect(r.querySelector("a[href]"), "판매처 이동 링크가 사라졌다").not.toBeNull();
        expect(r.querySelector('[data-testid="mi-candidate-select"]')).toBeNull();
      }
    } finally {
      cleanup();
    }
  });

  /** 🔴🔴 R2-08 — **seller-first 순서.** 존재만 보면 뒤집혀도 통과하므로 **출현 순서** 로 본다. */
  it("R2-08 등급 → 가격 → 판매처 → 확인필요 → 선택 순으로 선다", () => {
    const { doc, cleanup } = mount(allRows());
    try {
      const rows = Array.from(doc.querySelectorAll('[data-testid="mi-candidate-row"]'));
      expect(rows.length).toBeGreaterThan(0);
      let withWarn = 0;
      for (const r of rows) {
        /**
         * 🔴 1차에 `testid ?? "BUTTON"` 로 매핑했다가 FAIL 했다 — `CandidateSelect` 의
         *    버튼에 **testid 가 붙어 있어** 그 자리가 "BUTTON" 으로 안 잡혔다(-1).
         * 🟢 그래서 **태그로** 찾는다. 단언이 틀렸던 것이고 코드가 맞았다.
         */
        const nodes = Array.from(r.querySelectorAll("[data-testid], button"));
        const at = (id: string) => nodes.findIndex((n) => n.getAttribute("data-testid") === id);
        /**
         * 🔵🔵🔵 **UNIFIED-UX-1 ② 에서 순서가 바뀌었다 — 뜻은 그대로다.**
         *
         * 🔴 전 순서: 등급 → 가격 → 판매처 → 확인필요 → **선택**.
         *    지키던 것은 **「seller-first — 존재만 보면 뒤집혀도 통과하므로 «순서» 로 본다」** 다.
         * 🔴🔴 CPO 확정 — 기본 카드는 **가격·판매처** 까지이고 **등급은 「우리 판단」 영역**
         *    으로 내려간다. 선택은 **제거** 됐다(⒝).
         * 🟢 그래서 끝점을 **선택 버튼 → 「우리 판단」 영역** 으로 바꾼다. 순서 축은 그대로다.
         * 🔴 **약화 0** — 등급이 그 영역 «안» 인지까지 새로 본다.
         */
        const judge = at("mi-candidate-judgement");
        expect(judge, "「우리 판단」 영역을 찾지 못했다").toBeGreaterThanOrEqual(0);
        expect(at("mi-candidate-price")).toBeLessThan(at("mi-candidate-seller"));
        expect(at("mi-candidate-seller")).toBeLessThan(judge);
        /** 🔴 등급은 **그 영역 뒤** 다(= 영역 안) — 기본 5칸으로 되돌아가면 FAIL. */
        expect(at("mi-candidate-group")).toBeGreaterThan(judge);
        /**
         * 🔵 **JUDGEMENT-DEDUP-1 — 좌표 이동.** 확인 필요 줄이 **접힘 밖 「우리 판단」**
         *    으로 올라왔다 ⟹ 순서 축의 끝점이 `mi-candidate-judgement-basis` 다.
         * 🔴 **약화 0** — 「판매처 뒤」를 그대로 요구하고, 그 줄이 **등급 뒤**
         *    (= 「우리 판단」 영역 «안») 인지까지 새로 본다.
         */
        const basis = at("mi-candidate-judgement-basis");
        if (basis >= 0) {
          expect(at("mi-candidate-seller")).toBeLessThan(basis);
          expect(at("mi-candidate-group"), "🔴 근거가 등급보다 앞서면 영역 밖이다").toBeLessThan(
            basis,
          );
          withWarn += 1;
        }
      }
      console.log(`[R2-08] 경고 순서까지 확인한 행 ${withWarn}건`);
      expect(withWarn, "경고 있는 행 0 — 순서 축 일부 측정불가").toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  /** 🟢 R2-10 순수 축 — 경고 생성기가 blockers/conflicts «만» 본다. */
  it("R2-10 candidateWarningLines 는 matchReasons 를 쓰지 않는다", () => {
    const base = { domain: "d", discoveredUrl: "u" } as GeminiTransientRow;
    expect(
      candidateWarningLines({ ...base, matchReasons: ["브랜드 불일치", "모델명 유사도 0%"] }),
    ).toEqual([]);
    expect(candidateWarningLines({ ...base, crossSellerConflicts: ["MODEL_CODE"] })[0]).toBe(
      `${CANDIDATE_WARNING_PREFIX} 품번 충돌`,
    );
    /** 🔴 중복 토큰은 접는다. */
    expect(
      candidateWarningLines({
        ...base,
        crossSellerBlockers: ["BRAND_UNCONFIRMED"],
        crossSellerConflicts: ["BRAND_UNCONFIRMED"],
      }),
    ).toEqual([`${CANDIDATE_WARNING_PREFIX} 브랜드 미확인`]);
  });
});
