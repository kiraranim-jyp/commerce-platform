import { describe, expect, it } from "vitest";
import { computeLandedCost } from "../landed-cost";

describe("computeLandedCost", () => {
  it("모든 원가 구성요소를 합산해 총원가를 계산한다", () => {
    const result = computeLandedCost({
      originalAmount: 100,
      originalCurrency: "USD",
      internationalShippingKrw: 15000,
      domesticShippingKrw: 3000,
      currentSellingPriceKrw: 200000,
      platformFeePercent: 10,
      paymentFeePercent: 3,
      miscCostKrw: 2000,
    }, { USD: 1380 });

    expect(result.productCostKrw).toBe(138000);
    expect(result.platformFeeKrw).toBe(20000); // 200000 * 10%
    expect(result.paymentFeeKrw).toBe(6000); // 200000 * 3%
    expect(result.totalCostKrw).toBe(138000 + 15000 + 3000 + 20000 + 6000 + 2000);
    expect(result.expectedProfitKrw).toBe(200000 - result.totalCostKrw);
  });

  it("실시간 환율이 없으면 고정 환율표로 폴백하고 isRateEstimate=true", () => {
    const result = computeLandedCost({
      originalAmount: 50,
      originalCurrency: "EUR",
      internationalShippingKrw: 10000,
      domesticShippingKrw: 0,
      currentSellingPriceKrw: 100000,
      platformFeePercent: 0,
      paymentFeePercent: 0,
      miscCostKrw: 0,
    });
    expect(result.isRateEstimate).toBe(true);
    expect(result.productCostKrw).toBeGreaterThan(0);
  });

  it("총원가가 판매가를 초과하면 예상이익이 음수(손해)로 정직하게 나온다", () => {
    const result = computeLandedCost({
      originalAmount: 200,
      originalCurrency: "USD",
      internationalShippingKrw: 30000,
      domesticShippingKrw: 5000,
      currentSellingPriceKrw: 100000,
      platformFeePercent: 10,
      paymentFeePercent: 3,
      miscCostKrw: 0,
    }, { USD: 1380 });
    expect(result.expectedProfitKrw).toBeLessThan(0);
  });
});
