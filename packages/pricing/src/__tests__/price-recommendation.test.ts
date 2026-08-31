import { describe, expect, it } from "vitest";
import { computePriceRecommendation } from "../price-recommendation";

describe("computePriceRecommendation", () => {
  it("대표님 예시: 국내 최저가가 있으면 최저가 근접 competitivePrice를 추천한다", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 101000,
      currentSellingPriceKrw: 149000,
      domesticLowestPriceKrw: 129000,
      domesticAveragePriceKrw: 139000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.minimumPrice).toBeLessThanOrEqual(result.recommendedPrice);
    expect(result.competitivePrice).not.toBeNull();
    expect(result.competitivePrice!).toBeLessThan(129000);
    expect(result.recommendedPrice).toBe(result.competitivePrice);
  });

  it("국내 경쟁가격이 없으면 competitivePrice는 null, 추천가는 targetPrice", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.competitivePrice).toBeNull();
    expect(result.recommendedPrice).toBe(result.targetPrice);
  });

  it("경쟁가격이 최소마진 가격보다 낮으면 절대 minimumPrice 밑으로 추천하지 않는다", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 200000,
      currentSellingPriceKrw: 210000,
      domesticLowestPriceKrw: 150000, // 원가+최소마진보다 훨씬 낮음
      domesticAveragePriceKrw: 160000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.recommendedPrice).toBeGreaterThanOrEqual(result.minimumPrice);
    expect(result.recommendedPrice).toBe(result.minimumPrice);
  });

  it("minimumPrice < targetPrice(마진율이 클수록 기준가가 높다)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.minimumPrice).toBeLessThan(result.targetPrice);
  });
});

describe("computePriceRecommendation — P-13A CPO 2차 검증 항목 3/5: 브랜드 시장 데이터와 국내 최저가/원가의 우선순위·분리", () => {
  it("항목 5: 국내 최저가가 있으면 brandMedianPriceKrw가 있어도 무시된다(domesticLowest가 항상 우선)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: 129000,
      domesticAveragePriceKrw: 139000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
      brandMedianPriceKrw: 300000, // 국내 최저가와 크게 다른 값이어도 영향 없어야 한다
    });
    expect(result.competitiveBasis).toBe("DOMESTIC_LOWEST");
  });

  it("항목 3: brandMedianPriceKrw가 없으면(INSUFFICIENT라 서버가 null로 걸렀을 때와 동일 조건) competitiveBasis가 null이고 추천가는 targetPrice와 같다 — 브랜드 데이터 없을 때와 완전히 동일하게 동작", () => {
    const withoutBrand = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
      brandMedianPriceKrw: null,
    });
    const noBrandFieldAtAll = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(withoutBrand.competitiveBasis).toBeNull();
    expect(withoutBrand.recommendedPrice).toBe(withoutBrand.targetPrice);
    expect(withoutBrand).toEqual(noBrandFieldAtAll);
  });

  it("국내 최저가 없고 brandMedianPriceKrw만 있으면 competitiveBasis는 BRAND_MEDIAN, 추천가는 중앙값의 95%를 넘지 않는다", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 50000,
      currentSellingPriceKrw: 100000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 50, // targetPrice를 일부러 높게 잡아 브랜드 중앙값이 실제로 상한 역할을 하는지 확인
      brandMedianPriceKrw: 120000,
    });
    expect(result.competitiveBasis).toBe("BRAND_MEDIAN");
    expect(result.recommendedPrice).toBeLessThanOrEqual(Math.round(120000 * 0.95));
  });

  it("brandMedianPriceKrw가 targetPrice보다 훨씬 높아도 추천가가 targetPrice 위로 올라가지 않는다(브랜드 데이터가 가격을 밀어올리지 않는다)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
      brandMedianPriceKrw: 1000000,
    });
    expect(result.recommendedPrice).toBeLessThanOrEqual(result.targetPrice);
  });
});
