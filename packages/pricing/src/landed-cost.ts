import { convertToKrw } from "./currency";

/**
 * N-4.03 Part 7(대표님 지시) — "해외 상품가격 + 해외 배송비 + 환율 + 국내
 * 배송비 + 플랫폼 수수료 + 결제 수수료 + 기타 비용 = 총 원가"를 명시적인
 * 항목별 구조로 계산한다. 기존 packages/pricing/src/breakdown.ts의
 * computePriceBreakdown()(PriceEditor UI가 실제로 쓰고 있음)은 건드리지
 * 않는다 — 완전히 새로운 함수로 추가한다(대표님 지시: "기존 가격/환율
 * 계산 로직 절대 변경 금지"). 수수료(platformFee/paymentFee)는 실제
 * 정산에서 판매가 기준 %로 떼이는 게 일반적이라 currentSellingPriceKrw를
 * 기준으로 계산한다 — 원가 기준으로 계산하면 실제 정산액과 어긋난다.
 */
export interface LandedCostInput {
  originalAmount: number;
  originalCurrency: string;
  internationalShippingKrw: number;
  domesticShippingKrw: number;
  /** 수수료 계산 기준이 되는 현재(또는 검토 중인) 판매가. */
  currentSellingPriceKrw: number;
  platformFeePercent: number;
  paymentFeePercent: number;
  miscCostKrw: number;
}

export interface LandedCostResult {
  exchangeRate: number;
  isRateEstimate: boolean;
  productCostKrw: number;
  internationalShippingKrw: number;
  domesticShippingKrw: number;
  platformFeeKrw: number;
  paymentFeeKrw: number;
  miscCostKrw: number;
  totalCostKrw: number;
  expectedProfitKrw: number;
}

export function computeLandedCost(input: LandedCostInput, liveRates?: Record<string, number>): LandedCostResult {
  const converted = convertToKrw(input.originalAmount, input.originalCurrency, liveRates);
  const productCostKrw = converted.amountKrw;
  const platformFeeKrw = Math.round((input.currentSellingPriceKrw * input.platformFeePercent) / 100);
  const paymentFeeKrw = Math.round((input.currentSellingPriceKrw * input.paymentFeePercent) / 100);
  const totalCostKrw =
    productCostKrw +
    input.internationalShippingKrw +
    input.domesticShippingKrw +
    platformFeeKrw +
    paymentFeeKrw +
    input.miscCostKrw;
  const expectedProfitKrw = input.currentSellingPriceKrw - totalCostKrw;

  return {
    exchangeRate: input.originalAmount === 0 ? 0 : productCostKrw / input.originalAmount,
    isRateEstimate: converted.isEstimate,
    productCostKrw,
    internationalShippingKrw: input.internationalShippingKrw,
    domesticShippingKrw: input.domesticShippingKrw,
    platformFeeKrw,
    paymentFeeKrw,
    miscCostKrw: input.miscCostKrw,
    totalCostKrw,
    expectedProfitKrw,
  };
}
