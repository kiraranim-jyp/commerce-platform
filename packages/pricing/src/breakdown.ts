import { convertToKrw } from "./currency";

/**
 * P0-1(가격 계산 투명화) — "원가 → 최종 판매가"만 보여주던 걸 원본가격/환율/
 * 상품원가/배송비/수수료/마진 단계별로 전부 노출한다. 배송비/수수료/마진은
 * 실제 물류·정산 데이터가 없어 추정치다(환율의 isEstimate 플래그와 같은 이유로
 * "추정"임을 숨기지 않는다) — 사용자가 직접 값을 바꿀 수 있게 해서 각자 알고
 * 있는 실제 배송비/수수료율을 반영할 수 있게 한다.
 */
export interface PriceBreakdownInput {
  originalAmount: number;
  originalCurrency: string;
  /** 국제배송비(KRW) — 실제 물류 데이터가 없어 사용자가 직접 입력/수정하는 추정치. */
  shippingKrw: number;
  /** 플랫폼 수수료율(%, 0~100). */
  feePercent: number;
  /** 목표 마진율(%, 0~100) — 최종 판매가에서 수수료를 제하고도 이 비율만큼
   * 원가 대비 남도록 역산한다. */
  marginPercent: number;
}

export interface PriceBreakdown extends PriceBreakdownInput {
  exchangeRate: number;
  isRateEstimate: boolean;
  /** 원본가격 * 환율. */
  costKrw: number;
  /** costKrw + shippingKrw — 마진/수수료를 계산하는 기준 원가. */
  landedCostKrw: number;
  /** landedCostKrw / (1 - fee% - margin%) — 수수료를 떼고도 목표 마진이
   * 남도록 역산한 제안 판매가. fee%+margin%가 100%를 넘으면(비현실적 입력)
   * landedCostKrw를 그대로 반환한다(음수/무한대 방지). */
  suggestedPriceKrw: number;
}

export function computePriceBreakdown(input: PriceBreakdownInput, liveRates?: Record<string, number>): PriceBreakdown {
  const { originalAmount, originalCurrency, shippingKrw, feePercent, marginPercent } = input;
  const converted = convertToKrw(originalAmount, originalCurrency, liveRates);
  const rate = originalAmount === 0 ? 0 : converted.amountKrw / originalAmount;
  const costKrw = converted.amountKrw;
  const landedCostKrw = costKrw + shippingKrw;
  const retainedRatio = 1 - (feePercent + marginPercent) / 100;
  const suggestedPriceKrw =
    retainedRatio > 0 ? Math.round(landedCostKrw / retainedRatio) : Math.round(landedCostKrw);

  return {
    originalAmount,
    originalCurrency,
    shippingKrw,
    feePercent,
    marginPercent,
    exchangeRate: rate,
    isRateEstimate: converted.isEstimate,
    costKrw,
    landedCostKrw,
    suggestedPriceKrw,
  };
}

export const DEFAULT_PRICE_BREAKDOWN_INPUT: Pick<PriceBreakdownInput, "shippingKrw" | "feePercent" | "marginPercent"> = {
  shippingKrw: 12000,
  feePercent: 10,
  marginPercent: 20,
};
