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

/** Sprint A-11(작업1 — CPO 지시: "판매가 = 환율변환가격 × (1+기본마진)") — 위
 * computePriceBreakdown()의 배송비/수수료까지 역산하는 계산은 "가격 계산
 * Breakdown"(펼쳐서 보는 상세 계산기)에서 계속 쓴다. 이 함수는 그 대신 화면
 * 최상단에 항상 보이는 "원가 → 환율 → 마진 → 최종 판매가" 5줄의 기본
 * 자동계산이다 — 배송비/수수료 없이 마진만 적용한 단순 계산이라야 CPO가 준
 * 예시(₩161,538 × 1.22 ≈ ₩197,080)와 맞는다. */
export const DEFAULT_MARGIN_PERCENT = 22;
export const DEFAULT_PRICE_ROUNDING_UNIT = 10;

/** 25,303 → 25,300 / 25,305 → 25,310 (CPO 예시 그대로) — 반올림 단위 기본
 * 10원, Settings에서 100/1000원으로 바꿀 수 있다(A-11 작업2). */
export function roundToUnit(amountKrw: number, unit: number): number {
  if (unit <= 0) return Math.round(amountKrw);
  return Math.round(amountKrw / unit) * unit;
}

/** 환율변환가격(costKrw)에 마진율을 곱해 최종 판매가를 낸다 — 쿠팡 10원 단위
 * 규칙을 항상 만족하도록 roundingUnit으로 반올림까지 한 번에 처리한다. */
export function computeMarginPrice(convertedKrw: number, marginPercent: number, roundingUnit: number): number {
  const raw = convertedKrw * (1 + marginPercent / 100);
  return roundToUnit(raw, roundingUnit);
}
