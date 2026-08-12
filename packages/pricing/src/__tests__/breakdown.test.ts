import { describe, expect, it } from "vitest";
import { computePriceBreakdown, roundToUnit } from "../breakdown";

describe("computePriceBreakdown", () => {
  /** N-3.8 Part M — CPO가 준 정합성 검증 케이스. 원본 $44, 환율 1,408.45,
   * 배송비 ₩12,000, 수수료 10%, 목표 마진 20% → 상품원가 ₩61,972 / 랜드드
   * 코스트 ₩73,972 / 권장 판매가격 약 ₩105,674(마크업이 아니라 "판매가 기준
   * 마진율" 역산 — landedCost / (1 - fee% - margin%)). */
  it("matches the CPO reference case exactly", () => {
    const breakdown = computePriceBreakdown(
      {
        originalAmount: 44,
        originalCurrency: "USD",
        shippingKrw: 12000,
        feePercent: 10,
        marginPercent: 20,
      },
      { USD: 1408.45 },
    );

    expect(breakdown.costKrw).toBe(61972);
    expect(breakdown.landedCostKrw).toBe(73972);
    expect(breakdown.suggestedPriceKrw).toBe(105674);
  });

  it("recomputes suggestedPriceKrw when fee or margin changes", () => {
    const base = {
      originalAmount: 44,
      originalCurrency: "USD",
      shippingKrw: 12000,
      feePercent: 10,
      marginPercent: 20,
    };
    const higherFee = computePriceBreakdown({ ...base, feePercent: 15 }, { USD: 1408.45 });
    const higherMargin = computePriceBreakdown({ ...base, marginPercent: 30 }, { USD: 1408.45 });

    expect(higherFee.suggestedPriceKrw).toBeGreaterThan(105674);
    expect(higherMargin.suggestedPriceKrw).toBeGreaterThan(105674);
  });

  it("rounds the suggested price to the given unit (Coupang 10-won rule)", () => {
    const breakdown = computePriceBreakdown(
      { originalAmount: 44, originalCurrency: "USD", shippingKrw: 12000, feePercent: 10, marginPercent: 20 },
      { USD: 1408.45 },
      10,
    );
    expect(breakdown.suggestedPriceKrw % 10).toBe(0);
    expect(breakdown.suggestedPriceKrw).toBe(105670);
  });

  it("falls back to landedCostKrw when fee+margin reach 100% (no divide-by-zero/negative)", () => {
    const breakdown = computePriceBreakdown(
      { originalAmount: 44, originalCurrency: "USD", shippingKrw: 12000, feePercent: 60, marginPercent: 40 },
      { USD: 1408.45 },
    );
    expect(breakdown.suggestedPriceKrw).toBe(breakdown.landedCostKrw);
  });
});

describe("roundToUnit", () => {
  it("rounds to the nearest unit (CPO example)", () => {
    expect(roundToUnit(25303, 10)).toBe(25300);
    expect(roundToUnit(25305, 10)).toBe(25310);
  });
});
