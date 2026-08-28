import { describe, expect, it } from "vitest";
import { computePriceBreakdown, DEFAULT_PRICE_BREAKDOWN_INPUT, resolveListingPrice } from "../index";

/**
 * P-4-H1-2-2(대표님 지시, 2026-08-28) — 실제 확인된 버그(override가 없으면
 * 쿠팡/스마트스토어 어댑터가 원본가를 마진 0%로 그냥 환산해서 등록한 것,
 * Voyage Dress 실제 사례 ₩153,120)를 이 resolveListingPrice() 하나가 대체한다.
 * R1-R4는 이 함수의 우선순위/공식 재사용/UNRESOLVED 계약을 고정한다.
 */
describe("P-4-H1-2-2 R1-R4: resolveListingPrice() 계약", () => {
  it("R1: priceOverrideKrw가 있으면 항상 SELLER_OVERRIDE — priceValidity가 VALID가 아니어도 override가 이긴다", () => {
    const result = resolveListingPrice({
      priceOverrideKrw: 99000,
      originalAmount: 0,
      originalCurrency: "USD",
      priceBreakdown: null,
      priceValidity: "MISSING",
    });
    expect(result).toEqual({ priceKrw: 99000, source: "SELLER_OVERRIDE", isEstimate: false });
  });

  it("R2: override가 없으면 computePriceBreakdown().suggestedPriceKrw를 그대로 재사용한다(새 공식 없음) — SYSTEM_SUGGESTED", () => {
    const input = {
      priceOverrideKrw: undefined,
      originalAmount: 100,
      originalCurrency: "USD",
      priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
      priceValidity: "VALID" as const,
    };
    const result = resolveListingPrice(input, undefined, 10);
    const directBreakdown = computePriceBreakdown(
      { originalAmount: 100, originalCurrency: "USD", ...input.priceBreakdown },
      undefined,
      10,
    );
    expect(result.source).toBe("SYSTEM_SUGGESTED");
    expect(result.priceKrw).toBe(directBreakdown.suggestedPriceKrw);
  });

  it("R3: override 없을 때도 원본가를 마진 0%로 그냥 환산한 값(옛 버그)을 절대 쓰지 않는다", () => {
    // 옛 버그 재현값: convertToKrw(88, "GBP") = 88 * 1740 = 153120(마진/수수료 미반영).
    const rawConvertedValue = 153120;
    const result = resolveListingPrice({
      priceOverrideKrw: undefined,
      originalAmount: 88,
      originalCurrency: "GBP",
      priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
      priceValidity: "VALID",
    });
    expect(result.source).toBe("SYSTEM_SUGGESTED");
    expect(result.priceKrw).not.toBe(rawConvertedValue);
    // 기본 마진(DEFAULT_PRICE_BREAKDOWN_INPUT)조차 넘기지 않았을 때도 마찬가지로
    // 원본가 그대로가 아니라 마진이 반영된 값이어야 한다.
    const noBreakdownResult = resolveListingPrice({
      priceOverrideKrw: undefined,
      originalAmount: 88,
      originalCurrency: "GBP",
      priceBreakdown: null,
      priceValidity: "VALID",
    });
    expect(noBreakdownResult.priceKrw).not.toBe(rawConvertedValue);
    expect(DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent).toBeGreaterThan(0);
  });

  it("R4: priceValidity가 VALID가 아니고 override도 없으면 UNRESOLVED — null을 반환하고 지어내지 않는다", () => {
    const result = resolveListingPrice({
      priceOverrideKrw: undefined,
      originalAmount: 0,
      originalCurrency: "USD",
      priceBreakdown: null,
      priceValidity: "INVALID",
    });
    expect(result.source).toBe("UNRESOLVED");
    expect(result.priceKrw).toBeNull();
    expect(result.reason).toBeTruthy();
  });
});
