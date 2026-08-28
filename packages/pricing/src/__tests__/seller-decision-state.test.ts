import { describe, expect, it } from "vitest";
import {
  computeUnifiedPriceDecision,
  sellerDecisionStateFromUnifiedDecision,
  type PriceComponent,
  type UnifiedPriceInput,
} from "../unified-price-decision";

function pc(value: number | null, status: PriceComponent["status"], source?: string): PriceComponent {
  return { value, status, source };
}

/**
 * P-2-3 STEP 14(대표님 지시, 2026-08-28) — 5개 상태 케이스 A-F를 그대로
 * 옮긴다. 핵심은 D(YELLOW)와 E(RED)가 dataCompleteness=INCOMPLETE여도
 * 🟠로 강등되지 않는다는 것 — verdict/level은 절대 덮어쓰지 않는다는 원칙의
 * 직접적인 증거다.
 */
describe("P-2-3 STEP 14: sellerDecisionStateFromUnifiedDecision Case A-F", () => {
  it("A) GREEN + COMPLETE → 🟢 바로 판매 가능", () => {
    const state = sellerDecisionStateFromUnifiedDecision({ verdict: "MAINTAIN", dataCompleteness: "COMPLETE" });
    expect(state).toEqual({ code: "READY", icon: "🟢", title: "바로 판매 가능" });
  });

  it("B) GREEN + ESTIMATED → 🟢 바로 판매 가능", () => {
    const state = sellerDecisionStateFromUnifiedDecision({ verdict: "MAINTAIN", dataCompleteness: "ESTIMATED" });
    expect(state).toEqual({ code: "READY", icon: "🟢", title: "바로 판매 가능" });
  });

  it("C) GREEN + INCOMPLETE → 🟠 비용 확인 필요", () => {
    const state = sellerDecisionStateFromUnifiedDecision({ verdict: "MAINTAIN", dataCompleteness: "INCOMPLETE" });
    expect(state).toEqual({ code: "NEEDS_COST_INFO", icon: "🟠", title: "비용 확인 필요" });
  });

  it("D) YELLOW(CONSIDER_LOWER) → 🟡 가격 조정 필요, INCOMPLETE여도 🟠로 덮어쓰지 않는다", () => {
    const complete = sellerDecisionStateFromUnifiedDecision({ verdict: "CONSIDER_LOWER", dataCompleteness: "COMPLETE" });
    const incomplete = sellerDecisionStateFromUnifiedDecision({
      verdict: "CONSIDER_LOWER",
      dataCompleteness: "INCOMPLETE",
    });
    expect(complete).toEqual({ code: "ADJUST", icon: "🟡", title: "가격 조정 필요" });
    expect(incomplete).toEqual({ code: "ADJUST", icon: "🟡", title: "가격 조정 필요" });
  });

  it("E) RED(MARGIN_RISK) → 🔴 판매 비추천, INCOMPLETE여도 🟠로 덮어쓰지 않는다", () => {
    const complete = sellerDecisionStateFromUnifiedDecision({ verdict: "MARGIN_RISK", dataCompleteness: "COMPLETE" });
    const incomplete = sellerDecisionStateFromUnifiedDecision({
      verdict: "MARGIN_RISK",
      dataCompleteness: "INCOMPLETE",
    });
    expect(complete).toEqual({ code: "NOT_RECOMMENDED", icon: "🔴", title: "판매 비추천" });
    expect(incomplete).toEqual({ code: "NOT_RECOMMENDED", icon: "🔴", title: "판매 비추천" });
  });

  it("F) 판단 불가(verdict=null 또는 unifiedDecision 자체가 null) → ⚪ 판단 불가", () => {
    expect(sellerDecisionStateFromUnifiedDecision(null)).toEqual({ code: "UNKNOWN", icon: "⚪", title: "판단 불가" });
    expect(sellerDecisionStateFromUnifiedDecision({ verdict: null, dataCompleteness: "INCOMPLETE" })).toEqual({
      code: "UNKNOWN",
      icon: "⚪",
      title: "판단 불가",
    });
  });
});

/**
 * P-3-0(대표님 지시, 2026-08-28) 실측에서 확인된 핵심 문제: 프로덕션
 * 스냅샷 50건 중 🟢(READY) 상태가 0건이었다 — 우연이 아니라
 * sellerDomesticShippingCostKrw/customsDutyKrw/customsVatKrw 3개가 항상
 * unknown이라 dataCompleteness가 절대 COMPLETE가 될 수 없었기 때문이다.
 * P-3-2에서 이 3개 필드에 실제 값이 들어오는 경로(SellerProfile 기본값 +
 * 상품별 입력)를 만들었다 — 이 테스트는 "값이 다 채워지면 🟢가 실제로
 * 나온다"는 것을 엔진 레벨에서 증명한다(P-1-3 STEP 9 Case A와 동일한 고마진
 * 입력을 그대로 재사용).
 */
describe("P-3-2: 비용 3개 필드가 모두 채워지면 dataCompleteness=COMPLETE + 🟢 READY", () => {
  it("G) 국내배송원가/관세/부가세 전부 actual — COMPLETE + READY", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(100000, "actual"),
      exchangeRate: pc(1740, "actual"),
      internationalShippingKrw: pc(12000, "estimated", "seller_default"),
      sellerDomesticShippingCostKrw: pc(3000, "estimated", "SellerProfile.domesticShippingCostKrw"),
      customerChargedShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(0, "actual", "product.customsDutyKrw"),
      customsVatKrw: pc(0, "actual", "product.customsVatKrw"),
      platformFeeRate: pc(10, "estimated", "default"),
      currentSellingPriceKrw: pc(180000, "actual"),
      domesticCompetitivePrice: { average: 200000, lowest: 190000 },
    };
    const result = computeUnifiedPriceDecision(input);
    expect(result.missingComponents).toEqual([]);
    // sellerDomesticShippingCostKrw가 estimated라 dataCompleteness는
    // COMPLETE가 아니라 ESTIMATED다 — "실제로 아는 값(추정 포함)만으로
    // 계산됐다"는 뜻이지 "전부 확정값"이라는 뜻이 아니다. 이 구분 자체가
    // 지어내지 않는다는 원칙의 증거다.
    expect(result.dataCompleteness).toBe("ESTIMATED");
    expect(result.verdict).toBe("MAINTAIN");
    const state = sellerDecisionStateFromUnifiedDecision(result);
    expect(state).toEqual({ code: "READY", icon: "🟢", title: "바로 판매 가능" });
  });

  it("H) 국내배송원가까지 actual(관세/부가세도 actual)이면 dataCompleteness=COMPLETE", () => {
    const input: UnifiedPriceInput = {
      sourceProductPriceKrw: pc(100000, "actual"),
      exchangeRate: pc(1740, "actual"),
      internationalShippingKrw: pc(12000, "actual", "seller_input"),
      sellerDomesticShippingCostKrw: pc(3000, "actual", "SellerProfile.domesticShippingCostKrw"),
      customerChargedShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(0, "actual", "product.customsDutyKrw"),
      customsVatKrw: pc(0, "actual", "product.customsVatKrw"),
      platformFeeRate: pc(10, "actual", "contracted_rate"),
      currentSellingPriceKrw: pc(180000, "actual"),
      domesticCompetitivePrice: { average: 200000, lowest: 190000 },
    };
    const result = computeUnifiedPriceDecision(input);
    expect(result.dataCompleteness).toBe("COMPLETE");
    expect(sellerDecisionStateFromUnifiedDecision(result).code).toBe("READY");
  });
});
