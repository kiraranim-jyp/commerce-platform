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

/**
 * MI-P0-COST-02(CEO 확정, 2026-09-21) — **예상 수수료 계산의 단일 출처.**
 *
 * 이 한 줄은 원래 computeLandedCost 안에만 있었다. price-recommendation 이
 * 손익 경계를 Net 으로 바꾸려면 같은 식이 필요한데, 거기에 다시 쓰면 같은
 * 계산이 두 곳에 살게 된다 — 그러면 언젠가 한쪽만 바뀐다. 그래서 «옮기지 않고»
 * 꺼내서 공유한다. computeLandedCost 의 동작은 한 글자도 달라지지 않는다.
 *
 * 🔴 `platformFeePercent` 는 «예상 수수료» 다. 특정 채널의 실제 요율이 아니다
 *    (profitability.ts 의 정의 그대로 — 셀러가 화면에서 고치는 가정값).
 *    "네이버 수수료" · "쿠팡 수수료" 라고 부르지 않는다.
 */
export function platformFeeKrwAt(sellingPriceKrw: number, platformFeePercent: number): number {
  return Math.round((sellingPriceKrw * platformFeePercent) / 100);
}

export function computeLandedCost(input: LandedCostInput, liveRates?: Record<string, number>): LandedCostResult {
  const converted = convertToKrw(input.originalAmount, input.originalCurrency, liveRates);
  const productCostKrw = converted.amountKrw;
  const platformFeeKrw = platformFeeKrwAt(input.currentSellingPriceKrw, input.platformFeePercent);
  const paymentFeeKrw = platformFeeKrwAt(input.currentSellingPriceKrw, input.paymentFeePercent);
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
