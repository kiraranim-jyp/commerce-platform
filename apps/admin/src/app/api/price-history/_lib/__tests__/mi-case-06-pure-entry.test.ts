/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-CASE-ACCURACY-06 — **운영과 테스트가 «같은 함수» 를 지난다**(CPO 선택지 A)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 생긴 이유 — fixture 가 거짓 기준이었다.**
 * ```
 * `product-tab-composition.ts` 의 `recommendation` 은 **손으로 쓴 정적 스텁** 이다
 * (MI-CASE-04 가 확정). 그 스텁은 운영 로직과 «실제로» 달랐다 —
 *    fixture referencePriceKrw **84,459**(= brandMedian 원값)
 *    운영   referencePriceKrw **80,236**(= round(brandMedian × 0.95))
 * 🔴 그런데 `computeMarketIntelligence` 는 머리에서 **DB 를 세 번** 부르므로
 *    테스트가 가격 계산 지점에 **도달조차 못 했다**(MI-CASE-05) ⟹ 그 차이를 잡을 계약이 없었다.
 * ```
 * 🟢 그래서 입력 구성부를 `buildRecommendationFromInput`(순수)으로 꺼냈고, **운영 호출부가
 *    그 함수를 쓴다.** 이 파일은 **같은 함수** 에 fixture 입력을 넣어 실제 산출을 고정한다.
 * 🔴 테스트 전용 계산식을 만들지 않았다 — 그러면 또 「거짓 기준」이 하나 늘어난다.
 *
 * 🔴 **DB 0 · HTTP 0 · 환율 0** — 순수 함수라 그렇다(그것이 이 분리의 목적이다).
 */
import { describe, expect, it } from "vitest";
import {
  buildRecommendationFromInput,
  MI_MINIMUM_MARGIN_PERCENT,
  type RecommendationInput,
} from "../recommendation-input";

/**
 * 🟢 **운영 fixture 에서 그대로 가져온 입력** — `product-tab-composition.ts` 의
 *    `cost.landedCostKrw` · `priceBreakdown` · `brandMarketProfile` 값이다.
 * 🔴 지어낸 값이 **없다**. 🔴 `domesticBasis` 도 그 fixture 의 `"NONE"` 그대로다.
 */
const GT_FIXTURE_INPUT: RecommendationInput = {
  landedCostKrw: 89828,
  currentSellingPriceKrw: null,
  domesticLowestPriceKrw: null,
  domesticAveragePriceKrw: null,
  domesticBasis: "NONE",
  targetMarginPercent: 12,
  expectedFeePercent: 10,
  brandMedianPriceKrw: 84459,
};

describe("MI-CASE-06 — 추천 입력의 순수 진입점", () => {
  it("A-1 🟢 fixture 입력으로 **실제 계산 결과** 를 낸다(DB 0 · HTTP 0)", () => {
    const r = buildRecommendationFromInput(GT_FIXTURE_INPUT);
    /** 🔴 `priceForMargin = round(cost / (1 − m/100))` — 그 산술을 그대로 고정한다. */
    expect(r.minimumPrice).toBe(99809); // 89,828 / 0.90
    expect(r.targetPrice).toBe(102077); // 89,828 / 0.88
    expect(r.marketCase).toBe("D"); // domesticBasis !== "EXACT"
    /** 🔴 CASE D 는 **억지 추천가를 만들지 않는다**. */
    expect(r.recommendedPrice).toBeNull();
  });

  /**
   * 🔴🔴🔴 **이 단언이 이 파일의 핵심이다 — fixture 스텁이 틀렸다는 것을 «계약» 으로 잠근다.**
   *
   * fixture 는 `referencePriceKrw: 84459`(brandMedian **원값**)로 적혀 있었다.
   * 운영 로직은 `min(targetPrice, round(brandMedian × 0.95))` 다 ⟹ **80,236**.
   * 🟢 그 차이가 **4,223원** 이고, 그만큼 fixture 는 셀러에게 **더 비싼 참고가** 를 말했다.
   * 🔴 ×0.95 를 지우면 이 단언이 FAIL 한다(= 그 상한이 살아 있다는 증거).
   */
  it("A-2 🔴🔴 `referencePriceKrw` 는 **brandMedian × 0.95 상한** 을 받는다(fixture 스텁과 다르다)", () => {
    const r = buildRecommendationFromInput(GT_FIXTURE_INPUT);
    expect(r.referencePriceKrw).toBe(80236); // round(84,459 × 0.95)
    expect(r.referencePriceKrw).not.toBe(84459); // 🔴 fixture 의 그 값이 아니다
    expect(r.competitiveBasis).toBe("BRAND_MEDIAN");
  });

  it("A-3 🔴 최소 마진은 **운영에 있던 10%** 그대로다(옮기면서 바꾸지 않았다)", () => {
    expect(MI_MINIMUM_MARGIN_PERCENT).toBe(10);
    const r = buildRecommendationFromInput(GT_FIXTURE_INPUT);
    /** 🟢 10% 가 아니면 99,809 가 나오지 않는다 — 값으로 되묶는다(동어반복 금지). */
    expect(r.minimumPrice).toBe(Math.round(GT_FIXTURE_INPUT.landedCostKrw / 0.9));
  });

  /**
   * 🔵🔵 **운영 경로가 이 함수를 «실제로» 쓰는지** 를 소스로 잠근다.
   *
   * 🔴 순수 함수만 단언하면 **배선이 끊겨도 통과한다** — 이 트랙이 WU-110 에서 그 함정을
   *    밟았다(「판정 함수를 직접 부르는 테스트는 배선을 못 본다」). 🟢 그래서 소스 앵커를 같이 둔다.
   */
  it("A-4 🔴🔴 **운영 호출부가 이 순수 함수를 쓴다**(배선이 끊기면 FAIL)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(
      path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "market-intelligence.ts"),
      "utf8",
    );
    expect(src).toContain('from "./recommendation-input"');
    expect(src).toContain("recommendation = buildRecommendationFromInput({");
    /** 🔴 옛 직접 호출이 되살아나면 FAIL — 그러면 운영과 테스트가 다시 갈린다. */
    expect(src).not.toContain("recommendation = computePriceRecommendation({");
    /** 🔴 환율 게이트는 **호출부에 남아 있어야** 한다(정책이고 입력 구성이 아니다). */
    expect(src).toContain("if (!cost.isRateEstimate)");
  });

  it("A-5 🟢 같은 입력 → 같은 결과(순수성)", () => {
    const a = buildRecommendationFromInput(GT_FIXTURE_INPUT);
    const b = buildRecommendationFromInput({ ...GT_FIXTURE_INPUT });
    expect(a).toEqual(b);
  });
});
