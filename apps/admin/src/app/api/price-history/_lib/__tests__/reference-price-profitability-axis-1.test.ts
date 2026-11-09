import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeReferenceProfitability,
  computePriceRecommendation,
  marginPercentAt,
} from "@commerce/pricing";
import {
  summarizeCandidateOverseasPrices,
  /** 🟢 금액 자격을 잃는 사유 집합의 **owner** — 문자열 사본을 만들지 않는다. */
  PRICE_DISQUALIFYING_BLOCKER_LIST,
  type CandidateOverseasPriceRecord,
} from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — **참고가격 기준 예상 수익성**(별도 축)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 승인(2026-11-09) 둘 — ① COMPARISON 가격으로 **수익성 비율(%)만** 별도 표시
 * ② `marginPercentAt` **export**(공식·결과·호출부·CASE A~D 변경 0 · 가시성만).
 *
 * ── 🔴🔴 이 축이 생긴 이유(셀러가 본 상태) ──────────────────────────────────
 * ```
 * 화면   「🇰🇷 국내 동일상품 확인 가격 KRW 88,000」      ← 가격은 있다
 * 화면   「국내 시장가격이 확인되지 않아 … 판단할 수 없습니다」 ← 수익성은 모른다
 * 원인   tier COMPARISON ⟹ domesticBasis !== "EXACT" ⟹ **marketCase D**
 *        (price-recommendation.ts:123 · 그 줄은 **동결** 이고 손대지 않았다)
 * ```
 * 🟢 CPO — 「동일상품 검증은 가격정보를 **없애는 스위치가 아니라** 가격 근거의
 *    **신뢰도를 설명하는 기준**」. ⟹ 기존 축을 고치지 않고 **축을 하나 더** 뒀다.
 *
 * ── 🔴 이 계약이 무는 네 경계(CPO 설계 경계 ①~④) ─────────────────────────────
 * ```
 * ① 새 축은 **verdict 를 만들지 않는다**(타입에 그 칸이 **없다** · A-3)
 * ② 기존 경로의 **입력이 아니다**(CASE A~D · 추천가 불변 · C-1·C-2)
 * ③ 화면에서 **다른 영역** 에 서고 **전제를 같이 적는다**(E-*)
 * ④ tier 승격 0 · 금액 재집계 0 · 환산 0(D-*)
 * ```
 */

/** 🟢 「새 공식 금지」를 지키는 유일한 길 — 기존 owner 를 **그대로** 부른다. */
const PRICING_SRC = join(
  __dirname,
  "../../../../../../../../packages/pricing/src/reference-profitability.ts",
);
const RECOMMEND_SRC = join(
  __dirname,
  "../../../../../../../../packages/pricing/src/price-recommendation.ts",
);
const MI_SRC = join(__dirname, "../market-intelligence.ts");

/** 🔴 주석을 벗긴다 — 이 리포가 **여덟 번** 걸린 함정이다(헌장 §5). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("A. 공식 — 🔴 새 공식을 만들지 않았다", () => {
  it("A-1 🟢 `marginPercentAt` 가 export 돼 있고 그것이 **유일한** 마진 공식이다", () => {
    expect(typeof marginPercentAt).toBe("function");
    /**
     * 🔴🔴 **사본 금지 계약.** 새 파일이 `(p - c) / p` 를 **자기가** 계산하면 FAIL 한다 —
     *    그러면 두 숫자가 갈릴 수 있는 구조가 생긴다(CPO 「새 공식 금지」).
     */
    const body = stripComments(readFileSync(PRICING_SRC, "utf8"));
    expect(body, "🔴 참고 축 파일에 산술식이 생기면 사본이다").not.toMatch(/\/\s*100|\*\s*100/);
    expect(body).toContain("marginPercentAt");
  });

  it("A-2 🟢 export 는 **가시성 한 글자** 다 — 공식 본문이 그대로다", () => {
    const body = stripComments(readFileSync(RECOMMEND_SRC, "utf8"));
    /** 🔴 공식을 **글자로** 단언한다 — 상수에서 import 하면 동어반복이다(메모 그 함정). */
    expect(body).toContain("export function marginPercentAt(priceKrw: number, costKrw: number): number");
    expect(body).toContain("Number((((priceKrw - costKrw) / priceKrw) * 100).toFixed(1))");
  });

  it("A-3 🔴🔴 산출에 **판정 칸이 없다** — 타입이 CPO 경계 ①을 강제한다", () => {
    const r = computeReferenceProfitability({
      referencePriceKrw: 88_000,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: 1,
      excludedUnverified: 0,
      excludedObservedDifference: 0,
    });
    for (const banned of ["verdict", "recommendation", "action", "recommendedPriceKrw", "priceTier"]) {
      expect(Object.keys(r), `🔴 '${banned}' 칸이 생기면 이 축이 판정을 하기 시작한 것이다`).not.toContain(
        banned,
      );
    }
  });

  it("A-4 🟢 같은 (가격·원가)에서 **기존 함수와 같은 수** 를 낸다", () => {
    /**
     * 🔴 비교 대상을 **운영 함수** 로 둔다 — 내가 쓴 상수와 비교하면 아무것도 증명하지 못한다.
     * 🟢 `computePriceRecommendation` 은 CASE A 에서 **자기 추천가의** 마진을 낸다.
     *    그 추천가·그 원가를 새 함수에 넣으면 **두 산출이 같아야** 한다(같은 공식이므로).
     */
    const rec = computePriceRecommendation({
      totalCostKrw: 67_290,
      domesticLowestPriceKrw: 120_000,
      domesticAveragePriceKrw: 120_000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 30,
    });
    expect(rec.recommendedPrice, "🟡 CASE A 가 추천가를 내지 않으면 이 대조가 성립하지 않는다").not.toBeNull();
    const mine = computeReferenceProfitability({
      referencePriceKrw: rec.recommendedPrice,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: 1,
      excludedUnverified: 0,
      excludedObservedDifference: 0,
    });
    expect(mine.marginPercent).toBe(rec.estimatedMarginPercent);
  });
});

describe("B. 🔴🔴 EXACT 가 «없어도» 계산된다 — 이 WU 의 목적", () => {
  /** 🟢 실제 운영 행 그대로다(DB 실측 · snapshot `7b16eecc` · 2026-11-09). */
  const REAL_ROWS: CandidateOverseasPriceRecord[] = [
    { domain: "donokids.com", market: "KR", currency: "KRW", amount: 88_000, priceTier: "COMPARISON", priceStatus: "VERIFIED_CURRENT" },
  ] as unknown as CandidateOverseasPriceRecord[];

  it("B-1 🔴 기존 축은 **CASE D** 로 남는다(동결 확인)", () => {
    const rec = computePriceRecommendation({
      totalCostKrw: 67_290,
      domesticLowestPriceKrw: 88_000,
      domesticAveragePriceKrw: 88_000,
      /** 🔴 COMPARISON — tier 를 **승격하지 않았다**(CPO 경계 ④). */
      domesticBasis: "COMPARISON",
      minimumMarginPercent: 10,
      targetMarginPercent: 30,
    });
    expect(rec.marketCase, "🔴 D 가 아니면 동결 축을 건드린 것이다").toBe("D");
  });

  it("B-2 🟢🟢 그런데 **참고 축은 비율을 낸다** — 「가격은 보이는데 남는지는 모른다」가 풀린다", () => {
    const summary = summarizeCandidateOverseasPrices(REAL_ROWS);
    const r = computeReferenceProfitability({
      referencePriceKrw: summary.byCurrency.KRW?.lowestAmount ?? null,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: summary.byCurrency.KRW?.count ?? 0,
      excludedUnverified: summary.unverifiedCount,
      excludedObservedDifference: summary.observedDifferenceCount,
    });
    expect(r.marginPercent, "🔴 null 이면 이 WU 가 목적을 달성하지 못한 것이다").not.toBeNull();
    /** 🟢 (88,000 − 67,290) / 88,000 × 100 = **23.5%** — 기존 공식 그대로. */
    expect(r.marginPercent).toBe(23.5);
    expect(r.basis).toBe("REFERENCE_PRICE");
    expect(r.referencePriceKrw).toBe(88_000);
  });

  it("B-3 🔴 입력이 모자라면 **측정불가**(`null`)다 — 「0%」로 적지 않는다", () => {
    const noCost = computeReferenceProfitability({
      referencePriceKrw: 88_000,
      landedCostKrw: null,
      targetMarginPercent: 30,
      sellerCount: 1,
      excludedUnverified: 0,
      excludedObservedDifference: 0,
    });
    expect(noCost.marginPercent).toBeNull();
    expect(noCost.meetsTargetMargin).toBeNull();
    /** 🔴 가격도 되돌리지 않는다 — 계산하지 못한 값의 근거를 화면에 남기지 않는다. */
    expect(noCost.referencePriceKrw).toBeNull();

    const noPrice = computeReferenceProfitability({
      referencePriceKrw: null,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: 0,
      excludedUnverified: 2,
      excludedObservedDifference: 0,
    });
    expect(noPrice.marginPercent).toBeNull();
    /** 🟢 제외 수는 **그래도 센다** — 「왜 없는가」가 그 숫자다. */
    expect(noPrice.excludedCount).toBe(2);
  });

  it("B-4 🟢 목표마진 비교는 **사실 한 줄** 이다(권고가 아니다)", () => {
    const below = computeReferenceProfitability({
      referencePriceKrw: 88_000,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: 1,
      excludedUnverified: 0,
      excludedObservedDifference: 0,
    });
    expect(below.meetsTargetMargin).toBe(false);
    const above = computeReferenceProfitability({
      referencePriceKrw: 200_000,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: 1,
      excludedUnverified: 0,
      excludedObservedDifference: 0,
    });
    expect(above.meetsTargetMargin).toBe(true);
    /** 🔴 목표마진이 없으면 **비교하지 않는다**(지어낸 기준으로 판단하지 않는다). */
    const noTarget = computeReferenceProfitability({
      referencePriceKrw: 200_000,
      landedCostKrw: 67_290,
      targetMarginPercent: null,
      sellerCount: 1,
      excludedUnverified: 0,
      excludedObservedDifference: 0,
    });
    expect(noTarget.meetsTargetMargin).toBeNull();
    expect(noTarget.marginPercent).not.toBeNull();
  });
});

describe("C. 🔴🔴 불변 — 기존 판정·추천가가 한 글자도 바뀌지 않는다", () => {
  it("C-1 🔴 새 축은 기존 함수의 **인자에 들어가지 않는다**(배선 단언)", () => {
    const body = stripComments(readFileSync(MI_SRC, "utf8"));
    /**
     * 🔴 `computeReferenceProfitability(...)` 의 산출을 변수로 받아 다른 곳에 넘기면
     *    이 단언이 FAIL 한다 — 호출이 **return 객체 안에서 끝나야** 한다.
     */
    const call = body.indexOf("computeReferenceProfitability({");
    expect(call, "🔴 호출이 없으면 배선이 끊긴 것이다").toBeGreaterThan(0);
    const returnStart = body.indexOf("return {", body.lastIndexOf("const domesticCandidatePriceSummary"));
    expect(returnStart).toBeGreaterThan(0);
    expect(call, "🔴🔴 호출이 return 밖이면 중간 변수로 다른 경로에 흘러갈 수 있다").toBeGreaterThan(
      returnStart,
    );
    /**
     * 🔴🔴 **1차 단언이 약했고 변이가 통과했다 — 그 자리를 적는다.**
     *
     * 처음엔 `= computeReferenceProfitability` 를 금지했는데, 산출을 감싸서 넘기는
     * 모양(`((rp) => rp)(...)`)이 **그대로 통과** 했다. 🟢 그래서 「대입 모양」이 아니라
     * **「그 이름이 다른 인자로 쓰이는가」** 를 본다 — 이름(소문자 `r`)이 **정확히
     * 한 번**(= return 키 하나) 등장해야 한다. 🔴 동결 함수의 인자로 들어가면
     * 그 이름이 **두 번째로** 나타나므로 이 단언이 FAIL 한다.
     * 🟢 `computeReferenceProfitability` 는 대문자 `R` 이라 이 셈에 들어가지 않는다.
     */
    const uses = body.split("referenceProfitability").length - 1;
    expect(uses, "🔴 그 이름이 두 번 이상 나오면 다른 경로로 흘러갈 수 있는 구조다").toBe(1);
    /** 🔴 그리고 동결 네 함수의 **호출 문자열** 에 그 이름이 붙지 않는다(이중 잠금). */
    for (const frozen of [
      "computePriceRecommendation(",
      "computePriceDecision(",
      "buildSellerDecision(",
      "deriveRepresentativeSellerVerdict(",
    ]) {
      const at = body.indexOf(frozen);
      if (at < 0) continue;
      expect(
        body.slice(at, at + 1200),
        `🔴 ${frozen} 인자에 참고 축이 들어가면 CASE A~D·verdict 가 바뀐다`,
      ).not.toContain("referenceProfitability");
    }
  });

  it("C-2 🔴 CASE D 를 만드는 **그 줄** 이 그대로다(동결 확인)", () => {
    const body = stripComments(readFileSync(RECOMMEND_SRC, "utf8"));
    expect(
      body,
      "🔴 이 조건을 느슨하게 하면 COMPARISON 가격이 **판정** 에 들어간다(CEO 명시 금지)",
    ).toContain('input.domesticBasis !== "EXACT"');
  });

  it("C-3 🟢 CASE A~D 네 갈래가 **전부 그대로** 산출된다", () => {
    const base = {
      totalCostKrw: 67_290,
      minimumMarginPercent: 10,
      targetMarginPercent: 30,
    } as const;
    /** 🔴 네 케이스를 **한 번에** 본다 — 하나만 보면 다른 갈래가 조용히 바뀐다. */
    const cases = [
      { domesticBasis: "NONE" as const, domesticLowestPriceKrw: null, domesticAveragePriceKrw: null },
      { domesticBasis: "COMPARISON" as const, domesticLowestPriceKrw: 88_000, domesticAveragePriceKrw: 88_000 },
      { domesticBasis: "EXACT" as const, domesticLowestPriceKrw: 50_000, domesticAveragePriceKrw: 50_000 },
      { domesticBasis: "EXACT" as const, domesticLowestPriceKrw: 300_000, domesticAveragePriceKrw: 300_000 },
    ];
    const got = cases.map((c) => computePriceRecommendation({ ...base, ...c }).marketCase);
    /** 🟢 네 값이 **서로 다른 갈래** 를 실제로 탄다는 것까지 본다(전부 D 면 의미가 없다). */
    expect(got[0]).toBe("D");
    expect(got[1]).toBe("D");
    expect(new Set(got).size, "🔴 네 입력이 한 갈래로 뭉치면 이 회귀는 아무것도 못 본다").toBeGreaterThan(1);
  });
});

describe("C-W. 🔴🔴 **운영 배선** — 하니스가 못 보는 자리를 소스로 문다", () => {
  /**
   * 🔴🔴 **이 절이 생긴 이유를 적는다 — 변이 M1 이 «통과» 했다.**
   *
   * `CommerceWorkspace` 의 prop 전달을 지워도 렌더 계약 10건이 **전부 통과** 했다.
   * 원인은 셀러 화면 하니스(`seller-surface-composition.ts`)가 그 조립을 **복제** 하기
   * 때문이다 — 하니스가 자기 배선으로 그리므로 **운영 파일의 배선 제거를 못 본다**.
   * 🟢 그래서 ⒜ 운영 배선을 **소스로** 단언하고 ⒝ 하니스가 그 모양에서 **드리프트하지
   *    않는지** 까지 단언한다(WU-110 이 남긴 「판정 함수를 직접 부르는 테스트는 배선을
   *    못 본다」의 UI 판본이다).
   */
  const WORKSPACE_SRC = join(__dirname, "../../../../pipeline/CommerceWorkspace.tsx");
  const PANEL_SRC = join(__dirname, "../../../../pipeline/commerce/DomesticPriceIntelligencePanel.tsx");
  const HARNESS_SRC = join(
    __dirname,
    "../../../../pipeline/commerce/__tests__/seller-surface-composition.ts",
  );

  it("C-4 🔴 `CommerceWorkspace` 가 그 값을 **영역에 넘긴다**", () => {
    const body = stripComments(readFileSync(WORKSPACE_SRC, "utf8"));
    expect(
      body,
      "🔴 이 줄이 사라지면 운영 화면에서 영역이 **조용히** 없어진다(하니스는 통과한다)",
    ).toContain("referenceProfitability={marketComparison?.referenceProfitability ?? null}");
  });

  it("C-5 🔴 패널이 그 값을 **생산하고 deps 에도 있다**(다섯 자리 함정)", () => {
    /**
     * 🔵🔵 **RPP-POST-WIRING-1 에서 출처가 바뀌었다 — 이 단언을 갱신·강화했다.**
     *
     * 🔴 전에는 `referenceProfitability: data?.referenceProfitability ?? null` 을 봤다.
     *    그런데 **GET 은 그 칸이 항상 null** 이다(`geminiEvidence` 를 null 로 부른다 ·
     *    B3-04 격리) ⟹ 그 단언은 **운영에서 절대 발화하지 않는 배선** 을 지키고 있었다.
     *    🔴 그래서 계약이 전부 초록인데 **CEO 화면엔 영역이 없었다**(Production UI FAIL).
     * 🟢 지금은 **POST `/check` 응답** 이 owner 다(`domesticReference` 와 같은 수명).
     *    ⟹ 단언도 **그 통로** 를 본다 — 약화가 아니라 **발화하는 자리로 옮긴 것** 이다.
     */
    const body = stripComments(readFileSync(PANEL_SRC, "utf8"));
    /** ⒜ POST 응답에서 받는다(자동 1회차). */
    expect(body).toContain("setReferenceProfitability(j.referenceProfitability ?? null)");
    /** ⒝ memo 가 그 state 를 싣는다. */
    expect(body).toContain("      referenceProfitability,\n    };");
    /**
     * ⒞ deps 에도 있다 — 빠지면 **첫 응답 뒤 갱신되지 않는다**(다섯 번 밟은 자리).
     * 🔴 그리고 **GET 사본을 다시 읽지 않는다**(소유권 혼합 금지 · CPO 지시 ③).
     */
    const memoEnd = body.indexOf("      referenceProfitability,\n    };\n  }, [");
    const depsEnd = body.indexOf("]);", memoEnd);
    expect(body.slice(memoEnd, depsEnd)).toContain("    referenceProfitability,\n");
    expect(body).not.toContain("data?.referenceProfitability ?? null");
  });

  it("C-6 🔴 셀러 화면 하니스가 **운영과 같은 모양** 으로 넘긴다(드리프트 금지)", () => {
    const body = stripComments(readFileSync(HARNESS_SRC, "utf8"));
    expect(
      body,
      "🔴 하니스가 값을 지어내면 「영역이 선다」가 배선의 증거가 되지 못한다",
    ).toContain("referenceProfitability: marketComparison?.referenceProfitability ?? null,");
  });
});

describe("D. 🔴 집계를 다시 하지 않는다 — owner 하나", () => {
  it("D-1 🟢 집계기를 **한 번만** 부른다(국내 축)", () => {
    const body = stripComments(readFileSync(MI_SRC, "utf8"));
    const occurrences = body.split("summarizeCandidateOverseasPrices(domesticTransientRecords)").length - 1;
    expect(
      occurrences,
      "🔴 두 번 부르면 참고가격과 화면 금액이 **갈릴 수 있는 구조** 가 된다",
    ).toBe(1);
    expect(body).toContain("const domesticCandidatePriceSummary = summarizeCandidateOverseasPrices(");
    expect(body).toContain("candidateDomesticPrice: domesticCandidatePriceSummary,");
  });

  it("D-2 🔴 참고가격은 **KRW 칸에서만** 온다 — 환산 0", () => {
    const body = stripComments(readFileSync(MI_SRC, "utf8"));
    expect(body).toContain("domesticCandidatePriceSummary.byCurrency.KRW?.lowestAmount");
    /** 🔴 다른 통화를 끌어오거나 합치면 WU-020 외화 보호가 깨진다. */
    expect(body).not.toMatch(/referenceProfitability:[\s\S]{0,400}convertToKrw/);
  });

  it("D-3 🟢 근거 수·제외 수가 **집계기 산출** 에서 온다(지어낸 상수 0)", () => {
    const body = stripComments(readFileSync(MI_SRC, "utf8"));
    expect(body).toContain("sellerCount: domesticCandidatePriceSummary.byCurrency.KRW?.count ?? 0");
    expect(body).toContain("excludedUnverified: domesticCandidatePriceSummary.unverifiedCount");
    expect(body).toContain(
      "excludedObservedDifference: domesticCandidatePriceSummary.observedDifferenceCount",
    );
  });

  it("D-4 🟢🟢 **실제 운영 행** 으로 집계기 → 새 함수가 이어진다(real-data)", () => {
    /**
     * 🟢 DB 실측(snapshot `7b16eecc` · 2026-11-09)의 **국내 축 행 전수** 다 —
     *    `market='KR'` 인 행은 **하나** 이고 그것이 화면의 ₩88,000 이다.
     * 🔴 숫자를 손으로 적지 않고 **운영 집계기가 세게** 한다 ⟹ 「근거 1곳」은
     *    내 주장이 아니라 **집계 산출** 이다.
     * 🔴 `BRAND_UNCONFIRMED` 를 그대로 싣는다 — 그 사유는 금액 자격을 **빼앗지 않는다**
     *    (실측 4건이 사람 SAME · `PRICE_DISQUALIFYING_BLOCKERS` 에 **없다**).
     */
    const rows = [
      {
        domain: "donokids.com",
        market: "KR",
        currency: "KRW",
        amount: 88_000,
        priceTier: "COMPARISON",
        priceStatus: "VERIFIED_CURRENT",
        blockers: ["BRAND_UNCONFIRMED"],
      },
    ] as unknown as CandidateOverseasPriceRecord[];
    const summary = summarizeCandidateOverseasPrices(rows);
    const r = computeReferenceProfitability({
      referencePriceKrw: summary.byCurrency.KRW?.lowestAmount ?? null,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: summary.byCurrency.KRW?.count ?? 0,
      excludedUnverified: summary.unverifiedCount,
      excludedObservedDifference: summary.observedDifferenceCount,
    });
    expect(r.sellerCount, "🔴 집계기가 센 판매처 수여야 한다").toBe(1);
    expect(r.referencePriceKrw, "🟢 화면의 ₩88,000 과 같은 수다").toBe(88_000);
    expect(r.marginPercent).toBe(23.5);
    /** 🔴 이 상품의 실제 제외 수는 **0** 이다 — 억지로 0 이 아니게 만들지 않는다. */
    expect(r.excludedCount).toBe(0);
  });

  it("D-5 🔴 제외 두 칸이 **실제로 올라간다** — 그 의미를 정확히 적는다", () => {
    /**
     * 🔴🔴 **내 1차 fixture 가 틀렸고 이 테스트가 그 의미를 고정한다.**
     *    `unverifiedCount` 는 「가격이 **없다**」가 아니라 **「금액은 있는데 확인만
     *    안 됐다」** 다 — 집계기에서 `r.amount == null` 은 **그 카운터 앞에서** 빠진다
     *    (candidate-market.ts 의 「순서가 의미다」 주석 그대로).
     *    ⟹ 금액이 없는 행을 넣어 「제외 1곳」을 기대하면 **화면이 거짓을 말한다**.
     */
    const unverified = summarizeCandidateOverseasPrices([
      { domain: "a.kr", market: "KR", currency: "KRW", amount: 90_000, priceTier: "COMPARISON", priceStatus: "UNVERIFIED_SEARCH" },
    ] as unknown as CandidateOverseasPriceRecord[]);
    expect(unverified.unverifiedCount).toBe(1);
    expect(unverified.byCurrency.KRW, "🔴 미확인 금액은 금액 집계에 들어가지 않는다").toBeUndefined();

    /** 🟢 금액이 **아예 없는** 행은 어느 제외 칸에도 들어가지 않는다(= 「제외」가 아니다). */
    const noAmount = summarizeCandidateOverseasPrices([
      { domain: "b.kr", market: "KR", currency: null, amount: null, priceTier: "COMPARISON", priceStatus: "PRICE_UNAVAILABLE" },
    ] as unknown as CandidateOverseasPriceRecord[]);
    expect(noAmount.unverifiedCount).toBe(0);
    expect(noAmount.observedDifferenceCount).toBe(0);

    /** 🔴 집합을 **owner 에서 읽는다** — 입력이므로 동어반복이 아니다(상수 드리프트 방지). */
    const observed = summarizeCandidateOverseasPrices([
      {
        domain: "c.kr",
        market: "KR",
        currency: "KRW",
        amount: 70_000,
        priceTier: "COMPARISON",
        priceStatus: "VERIFIED_CURRENT",
        blockers: [PRICE_DISQUALIFYING_BLOCKER_LIST[0]],
      },
    ] as unknown as CandidateOverseasPriceRecord[]);
    expect(observed.observedDifferenceCount).toBe(1);

    const r = computeReferenceProfitability({
      referencePriceKrw: null,
      landedCostKrw: 67_290,
      targetMarginPercent: 30,
      sellerCount: 0,
      excludedUnverified: unverified.unverifiedCount,
      excludedObservedDifference: observed.observedDifferenceCount,
    });
    /** 🟢 두 사유가 **합쳐져** 화면의 「제외 N곳」이 된다. */
    expect(r.excludedCount).toBe(2);
    /** 🔴 그래도 비율은 **만들지 않는다** — 근거 금액이 0 이다. */
    expect(r.marginPercent).toBeNull();
  });
});
