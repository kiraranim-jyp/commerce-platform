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
