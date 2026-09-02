import { describe, expect, it } from "vitest";
import { computePriceRecommendation } from "../price-recommendation";

/**
 * P-26(CPO 지시, 2026-09-03) — CEO 승인 옵션 1: "10% 최소마진은 더 이상 절대
 * 판매가 하한선이 아니다." 기존(P-24/P-25)에는 recommendedPrice가
 * max(minimumPrice, ...)로 항상 최소마진 이상이었다 — 이 파일 전체를 CASE
 * A/B/C/D 정책으로 다시 작성한다(기존 competitivePrice 필드는 제거됨).
 */
describe("computePriceRecommendation — CASE A: 시장가에서도 목표마진 확보 가능 → 🟢", () => {
  it("CPO 예시 재현: 시장최저가 ₩300,000, 목표마진가 ₩275,000 → 추천가 ₩297,000(시장가의 99%)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 220000, // targetMarginPercent 20%에서 targetPrice=275,000이 되도록
      domesticLowestPriceKrw: 300000,
      domesticAveragePriceKrw: 300000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.targetPrice).toBe(275000);
    expect(result.marketCase).toBe("A");
    expect(result.recommendedPrice).toBe(297000);
    expect(result.recommendedPrice).not.toBeNull();
    expect(result.recommendedPrice!).toBeLessThan(300000); // 불필요한 덤핑 없이 시장가 근접까지만
    expect(result.competitiveBasis).toBe("DOMESTIC_LOWEST");
    expect(result.estimatedMarginPercent).toBeCloseTo(25.9, 1);
  });

  it("경계값 — 시장가가 목표가와 정확히 같으면 CASE A(마진 확보 가능 쪽에 포함)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 220000,
      domesticLowestPriceKrw: 275000, // targetPrice와 동일
      domesticAveragePriceKrw: 275000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.targetPrice).toBe(275000);
    expect(result.marketCase).toBe("A");
    expect(result.recommendedPrice).not.toBeNull();
  });
});

describe("computePriceRecommendation — CASE B: 손실은 아니지만 목표마진 미달 → 🟡, 시장가를 그대로 권장", () => {
  it("실측 재현(PèPè) — 착지원가 ₩242,400 < 국내 EXACT 최저가 ₩258,000 < 목표마진가 ₩275,455 → 권장가는 ₩269,333(구 최소마진 하한선)이 아니라 시장가 ₩258,000", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 242400,
      domesticLowestPriceKrw: 258000,
      domesticAveragePriceKrw: 258000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 12, // 실제 프로덕션 설정값
    });
    expect(result.minimumPrice).toBe(269333); // 참고치로는 계산되지만 더 이상 하한선이 아니다
    expect(result.targetPrice).toBe(275455);
    expect(result.marketCase).toBe("B");
    // 핵심 회귀 방지 — 구 정책처럼 시장가보다 비싼 값을 추천하면 FAIL.
    expect(result.recommendedPrice).toBe(258000);
    expect(result.recommendedPrice).not.toBe(269333);
    expect(result.recommendedPrice!).toBeLessThan(result.minimumPrice);
    // 마진율은 하드코딩이 아니라 실제 계산값이어야 한다: (258000-242400)/258000*100
    expect(result.estimatedMarginPercent).toBeCloseTo(6.0, 1);
    expect(result.competitiveBasis).toBe("DOMESTIC_LOWEST");
  });

  it("착지원가와 시장가가 정확히 같으면(0% 마진) CASE C(손실 아님의 경계) — B가 아니라 C로 분류된다", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 250000,
      domesticLowestPriceKrw: 250000,
      domesticAveragePriceKrw: 250000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.marketCase).toBe("C");
    expect(result.recommendedPrice).toBeNull();
  });
});

describe("computePriceRecommendation — CASE C: 시장가가 착지원가 이하 → 🔴, 억지 추천가 없음", () => {
  it("시장가가 착지원가보다 낮으면 recommendedPrice/estimatedMarginPercent 모두 null", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 260000,
      domesticLowestPriceKrw: 258000,
      domesticAveragePriceKrw: 258000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.marketCase).toBe("C");
    expect(result.recommendedPrice).toBeNull();
    expect(result.estimatedMarginPercent).toBeNull();
    expect(result.competitiveBasis).toBe("DOMESTIC_LOWEST");
  });
});

describe("computePriceRecommendation — CASE D: EXACT 시장가 없음(COMPARISON만 있거나 NONE) → 확정적 추천 금지", () => {
  it("domesticBasis=COMPARISON이면 domesticLowestPriceKrw 값이 있어도 CASE D — recommendedPrice는 null(참고용으로도 시장가 기반 추천을 만들지 않는다)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 200000,
      domesticLowestPriceKrw: 300000, // COMPARISON 가격 — 검증되지 않음
      domesticAveragePriceKrw: 300000,
      domesticBasis: "COMPARISON",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.marketCase).toBe("D");
    expect(result.recommendedPrice).toBeNull();
    expect(result.competitiveBasis).toBeNull();
  });

  it("domesticBasis=NONE이면 CASE D", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 200000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      domesticBasis: "NONE",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.marketCase).toBe("D");
    expect(result.recommendedPrice).toBeNull();
  });

  it("CASE D에서 brandMedianPriceKrw가 있으면 referencePriceKrw만 채워진다(recommendedPrice는 여전히 null — '시장 경쟁력 있음'이라고 확정하지 않는다)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 50000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      domesticBasis: "NONE",
      minimumMarginPercent: 10,
      targetMarginPercent: 50,
      brandMedianPriceKrw: 120000,
    });
    expect(result.marketCase).toBe("D");
    expect(result.competitiveBasis).toBe("BRAND_MEDIAN");
    expect(result.recommendedPrice).toBeNull();
    expect(result.referencePriceKrw).not.toBeNull();
    expect(result.referencePriceKrw!).toBeLessThanOrEqual(Math.round(120000 * 0.95));
  });

  it("brandMedianPriceKrw도 없으면 competitiveBasis/referencePriceKrw 모두 null", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 50000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      domesticBasis: "NONE",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.marketCase).toBe("D");
    expect(result.competitiveBasis).toBeNull();
    expect(result.referencePriceKrw).toBeNull();
  });
});

describe("computePriceRecommendation — 참고치(minimumPrice/targetPrice)는 항상 계산되지만 recommendedPrice의 하한선으로 쓰이지 않는다", () => {
  it("minimumPrice < targetPrice(마진율이 클수록 기준가가 높다) — CASE D에서도 계산은 그대로 된다", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      domesticBasis: "NONE",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.minimumPrice).toBeLessThan(result.targetPrice);
  });

  it("currentSellingPriceKrw는 여전히 계산에 전혀 쓰이지 않는다(생략해도 결과 동일)", () => {
    const withValue = computePriceRecommendation({
      totalCostKrw: 242400,
      currentSellingPriceKrw: 999999,
      domesticLowestPriceKrw: 258000,
      domesticAveragePriceKrw: 258000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 12,
    });
    const withoutValue = computePriceRecommendation({
      totalCostKrw: 242400,
      domesticLowestPriceKrw: 258000,
      domesticAveragePriceKrw: 258000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 12,
    });
    expect(withoutValue).toEqual(withValue);
  });
});
