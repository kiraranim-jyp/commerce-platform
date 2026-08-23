import { describe, expect, it } from "vitest";
import { computePriceDecision } from "../price-decision";

describe("computePriceDecision", () => {
  it("🟢 MAINTAIN — 마진 충분 + 국내 평균가와 비슷하거나 더 저렴", () => {
    const result = computePriceDecision({
      costPriceKrw: 142000,
      currentSellingPriceKrw: 199000,
      domesticAveragePriceKrw: 214000,
      domesticLowestPriceKrw: 189000,
    });
    expect(result.verdict).toBe("MAINTAIN");
    expect(result.marginPercent).toBeCloseTo(28.6, 0);
  });

  it("🟡 CONSIDER_LOWER — 마진은 충분하지만 국내 평균보다 threshold% 이상 비쌈", () => {
    const result = computePriceDecision({
      costPriceKrw: 150000,
      currentSellingPriceKrw: 239000,
      domesticAveragePriceKrw: 219000,
      domesticLowestPriceKrw: 200000,
    });
    expect(result.verdict).toBe("CONSIDER_LOWER");
    expect(result.priceGapVsAveragePercent).toBeGreaterThan(5);
  });

  it("🔴 MARGIN_RISK — 마진이 최소 기준 미만이면 국내가와 무관하게 위험", () => {
    const result = computePriceDecision({
      costPriceKrw: 205000,
      currentSellingPriceKrw: 219000,
      domesticAveragePriceKrw: 190000, // 국내 평균보다 비싼데도 마진이 우선
      domesticLowestPriceKrw: 180000,
    });
    expect(result.verdict).toBe("MARGIN_RISK");
    expect(result.marginPercent).toBeLessThan(10);
  });

  it("🔴 MARGIN_RISK — 판매가가 원가보다 낮으면(음수 마진) 손해 메시지를 명시한다", () => {
    const result = computePriceDecision({
      costPriceKrw: 100000,
      currentSellingPriceKrw: 90000,
      domesticAveragePriceKrw: null,
      domesticLowestPriceKrw: null,
    });
    expect(result.verdict).toBe("MARGIN_RISK");
    expect(result.marginPercent).toBeLessThan(0);
    expect(result.reason).toContain("손해");
  });

  it("국내 시세 데이터가 없으면(PART G 미연결) 마진만으로 판단하고 gap은 null — 없는 값을 지어내지 않는다", () => {
    const result = computePriceDecision({
      costPriceKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticAveragePriceKrw: null,
      domesticLowestPriceKrw: null,
    });
    expect(result.verdict).toBe("MAINTAIN");
    expect(result.priceGapVsAveragePercent).toBeNull();
  });

  it("커스텀 marginFloorPercent/competitiveGapPercent를 존중한다", () => {
    const result = computePriceDecision({
      costPriceKrw: 100000,
      currentSellingPriceKrw: 115000,
      domesticAveragePriceKrw: 110000,
      domesticLowestPriceKrw: 105000,
      marginFloorPercent: 20, // 실제 마진 ~13% < 20% → 위험
    });
    expect(result.verdict).toBe("MARGIN_RISK");
  });
});
