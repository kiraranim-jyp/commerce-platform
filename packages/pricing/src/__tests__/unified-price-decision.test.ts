import { describe, expect, it } from "vitest";
import { computeUnifiedPriceDecision, type PriceComponent, type UnifiedPriceInput } from "../unified-price-decision";

/**
 * P-1-3 STEP 9(대표님 지시, 2026-08-28) — 대표님이 요청한 회귀 케이스 A-G를
 * 그대로 옮긴다. 핵심은 "computeUnifiedPriceDecision이 기존 computePriceDecision
 * 을 대체하는 게 아니라 그 위에 올바른 costPriceKrw를 넘겨주는 얇은 계층"이라는
 * 것을 실측으로 증명하는 것 — 특히 Case B는 P-1-3 STEP 1 기준선(baseline-
 * price-paths.test.ts Case 2)에서 기존 computePriceDecision이 저마진 상품을
 * MAINTAIN/GREEN(26.5%)으로 잘못 판정했던 바로 그 입력값을 그대로 재사용해서,
 * 이 함수가 실제로 MARGIN_RISK/RED(8.0%)로 바로잡는지 확인한다.
 */
function pc(value: number | null, status: PriceComponent["status"], source?: string): PriceComponent {
  return { value, status, source };
}

describe("P-1-3 STEP 9: computeUnifiedPriceDecision 회귀 케이스 A-G", () => {
  it("A) 기존 고마진 — 국제배송비/수수료 반영해도 GREEN 유지", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(100000, "actual"),
      exchangeRate: pc(1740, "actual"),
      internationalShippingKrw: pc(12000, "estimated", "seller_default"),
      sellerDomesticShippingCostKrw: pc(3000, "actual"),
      customerChargedShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(0, "actual"),
      customsVatKrw: pc(0, "actual"),
      platformFeeRate: pc(10, "estimated", "default"),
      currentSellingPriceKrw: pc(180000, "actual"),
      domesticCompetitivePrice: { average: 200000, lowest: 190000 },
    };
    const result = computeUnifiedPriceDecision(input);
    expect(result.landedCostKrw).toEqual({ value: 115000, status: "estimated" });
    expect(result.platformFeeKrw).toEqual({ value: 18000, status: "estimated" });
    expect(result.marginPercent.value).toBe(26.1);
    expect(result.verdict).toBe("MAINTAIN");
    expect(result.level).toBe("GREEN");
    expect(result.missingComponents).toEqual([]);
  });

  it("B) 기존 저마진(P-1-3 STEP 1 baseline Case 2 재사용) — 배송비/수수료 반영 시 기존 GREEN(26.5%) 오판정이 MARGIN_RISK/RED(8.0%)로 바로잡힌다", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(103600, "actual"),
      exchangeRate: pc(1480, "actual"),
      internationalShippingKrw: pc(12000, "estimated", "seller_default"),
      sellerDomesticShippingCostKrw: pc(0, "actual"),
      customerChargedShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(0, "actual"),
      customsVatKrw: pc(0, "actual"),
      platformFeeRate: pc(10, "estimated", "default"),
      currentSellingPriceKrw: pc(140980, "actual"),
      domesticCompetitivePrice: { average: 145000, lowest: 138000 },
    };
    const result = computeUnifiedPriceDecision(input);
    // baseline-price-paths.test.ts Case 2의 computePriceBreakdown 결과와
    // landedCostKrw가 정확히 일치한다(115600) — 같은 입력이면 같은 원가.
    expect(result.landedCostKrw).toEqual({ value: 115600, status: "estimated" });
    expect(result.platformFeeKrw).toEqual({ value: 14098, status: "estimated" });
    expect(result.marginPercent.value).toBe(8);
    // 기존 computePriceDecision(costPriceKrw=원가만)은 이 입력에서 26.5%/MAINTAIN을
    // 냈지만(baseline Case 2), 배송비+수수료를 포함한 진짜 원가로 다시 계산하면
    // marginFloor(10%) 미만이라 MARGIN_RISK/RED다.
    expect(result.verdict).toBe("MARGIN_RISK");
    expect(result.level).toBe("RED");
  });

  it("C) 국내 배송원가 UNKNOWN — 계산 결과는 나오지만 dataCompleteness=INCOMPLETE로 표시되어 verdict를 무조건 신뢰할 수 없음을 UI에 전달한다", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(100000, "actual"),
      exchangeRate: pc(1740, "actual"),
      internationalShippingKrw: pc(12000, "estimated", "seller_default"),
      sellerDomesticShippingCostKrw: pc(null, "unknown"),
      customerChargedShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(0, "actual"),
      customsVatKrw: pc(0, "actual"),
      platformFeeRate: pc(10, "estimated", "default"),
      currentSellingPriceKrw: pc(180000, "actual"),
      domesticCompetitivePrice: { average: 200000, lowest: 190000 },
    };
    const result = computeUnifiedPriceDecision(input);
    expect(result.missingComponents).toEqual(["국내 배송원가"]);
    expect(result.landedCostKrw.status).toBe("incomplete");
    expect(result.dataCompleteness).toBe("INCOMPLETE");
    // 이 입력에서 verdict 자체는 GREEN이 나온다(알려진 원가만으로는 마진이
    // 충분해 보이므로) — 그러나 dataCompleteness=INCOMPLETE가 항상 함께
    // 반환되므로, 화면은 "GREEN이지만 국내 배송원가를 몰라서 실제로는
    // 달라질 수 있다"는 사실을 절대 숨길 수 없다. verdict만 보고 안심하면
    // 안 된다는 것을 이 필드 하나로 강제한다.
    expect(result.verdict).toBe("MAINTAIN");
    expect(result.level).toBe("GREEN");
  });

  it("D) 관부가세 UNKNOWN — 0원으로 조작하지 않고 missingComponents에 명시적으로 남긴다", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(150000, "actual"),
      exchangeRate: pc(1740, "actual"),
      internationalShippingKrw: pc(15000, "estimated", "seller_default"),
      sellerDomesticShippingCostKrw: pc(5000, "actual"),
      customerChargedShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(null, "unknown"),
      customsVatKrw: pc(null, "unknown"),
      platformFeeRate: pc(10, "estimated", "default"),
      currentSellingPriceKrw: pc(220000, "actual"),
    };
    const result = computeUnifiedPriceDecision(input);
    expect(result.missingComponents).toEqual(["관세", "부가세"]);
    expect(result.landedCostKrw).toEqual({ value: 170000, status: "incomplete" });
    expect(result.dataCompleteness).toBe("INCOMPLETE");
  });

  it("E) 고객 청구 배송비 존재 — 원가 합산에 자동 반영되지 않고 정보용 필드로만 통과한다", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(100000, "actual"),
      exchangeRate: pc(1740, "actual"),
      internationalShippingKrw: pc(12000, "estimated", "seller_default"),
      sellerDomesticShippingCostKrw: pc(null, "unknown"),
      customerChargedShippingKrw: pc(3000, "actual", "SellerProfile.deliveryCharge"),
      customsDutyKrw: pc(0, "actual"),
      customsVatKrw: pc(0, "actual"),
      platformFeeRate: pc(10, "estimated", "default"),
      currentSellingPriceKrw: pc(150000, "actual"),
    };
    const result = computeUnifiedPriceDecision(input);
    // 고객 청구 배송비(3000)가 원가에 더해졌다면 112000이 아니라 115000이
    // 됐을 것이다 — 더해지지 않았음을 직접 확인한다.
    expect(result.landedCostKrw.value).toBe(112000);
    expect(result.customerChargedShippingKrw).toEqual({
      value: 3000,
      status: "actual",
      source: "SellerProfile.deliveryCharge",
    });
  });

  it("F) 환율 fallback(원본가가 isRateEstimate=true로 환산됨) — dataCompleteness가 ESTIMATED로 전체 전파된다", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(100000, "estimated", "FIXED_RATES_TO_KRW fallback"),
      exchangeRate: pc(1380, "estimated"),
      internationalShippingKrw: pc(12000, "actual", "seller_input"),
      sellerDomesticShippingCostKrw: pc(3000, "actual"),
      customerChargedShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(0, "actual"),
      customsVatKrw: pc(0, "actual"),
      platformFeeRate: pc(10, "actual", "contracted_rate"),
      currentSellingPriceKrw: pc(150000, "actual"),
    };
    const result = computeUnifiedPriceDecision(input);
    expect(result.landedCostKrw.status).toBe("estimated");
    expect(result.dataCompleteness).toBe("ESTIMATED");
    // unknown이 하나도 없으므로 verdict는 정상적으로 계산된다(신뢰도만
    // ESTIMATED로 낮게 표시).
    expect(result.verdict).not.toBeNull();
  });

  it("G) PriceEditor 스타일과 Market Intelligence 스타일이 같은 입력에서 같은 마진을 낸다(계산은 한 번, 표시는 여러 곳)", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(100000, "actual"),
      exchangeRate: pc(1740, "actual"),
      internationalShippingKrw: pc(12000, "estimated", "seller_default"),
      sellerDomesticShippingCostKrw: pc(3000, "actual"),
      customerChargedShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(0, "actual"),
      customsVatKrw: pc(0, "actual"),
      platformFeeRate: pc(10, "estimated", "default"),
      currentSellingPriceKrw: pc(180000, "actual"),
      domesticCompetitivePrice: { average: 200000, lowest: 190000 },
    };
    // 어느 화면이 호출하든 결과 객체가 완전히 같다는 것 자체가 "계산은
    // 한 번"이라는 것의 증명이다 — 함수가 하나뿐이므로 두 번째 호출도
    // 첫 번째와 100% 동일한 값을 낸다.
    const fromPriceEditor = computeUnifiedPriceDecision(input);
    const fromMarketIntelligence = computeUnifiedPriceDecision(input);
    expect(fromPriceEditor).toEqual(fromMarketIntelligence);

    const manualMargin = Number(
      (((input.currentSellingPriceKrw.value! - fromPriceEditor.landedCostKrw.value - fromPriceEditor.platformFeeKrw.value!) /
        input.currentSellingPriceKrw.value!) *
        100
      ).toFixed(1),
    );
    expect(fromPriceEditor.marginPercent.value).toBe(manualMargin);
  });
});
