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

/** roundingUnit(기본 1 = 반올림 없음) — 쿠팡처럼 10원 단위 입력만 허용하는
 * 플랫폼에서 권장 판매가격을 그 단위로 맞출 때 쓴다(roundToUnit 재사용). */
export function computePriceBreakdown(
  input: PriceBreakdownInput,
  liveRates?: Record<string, number>,
  roundingUnit = 1,
): PriceBreakdown {
  const { originalAmount, originalCurrency, shippingKrw, feePercent, marginPercent } = input;
  const converted = convertToKrw(originalAmount, originalCurrency, liveRates);
  const rate = originalAmount === 0 ? 0 : converted.amountKrw / originalAmount;
  const costKrw = converted.amountKrw;
  const landedCostKrw = costKrw + shippingKrw;
  const retainedRatio = 1 - (feePercent + marginPercent) / 100;
  const suggestedPriceKrw =
    retainedRatio > 0 ? roundToUnit(landedCostKrw / retainedRatio, roundingUnit) : roundToUnit(landedCostKrw, roundingUnit);

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

/** Sprint N-3.8(가격 계산 모델 통일 — CPO 지시) — 예전에는 화면 상단 요약이
 * "환율변환가 × (1+마진%)"(마크업) 공식을, 아래 Breakdown이 "판매가 = 랜디드
 * 원가 / (1-수수료%-마진%)"(마진율) 공식을 각각 따로 써서 같은 "마진 20%"라는
 * 라벨로 서로 다른 숫자가 나오는 버그가 있었다(computeMarginPrice가 그 마크업
 * 공식이었다 — 이제 삭제). 이제는 computePriceBreakdown() 하나만 화면 전체
 * (요약 + Breakdown)에서 공유하고, "마진"은 항상 "판매가 기준으로 남기고 싶은
 * 비율"(마크업이 아니라 진짜 margin)로만 계산한다. DEFAULT_MARGIN_PERCENT도
 * DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent와 같은 값으로 맞췄다(전에는
 * 22%/20%로 서로 달라서 그 자체가 또 다른 불일치 원인이었다). */
export const DEFAULT_MARGIN_PERCENT = DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent;
export const DEFAULT_PRICE_ROUNDING_UNIT = 10;

/** 25,303 → 25,300 / 25,305 → 25,310 (CPO 예시 그대로) — 반올림 단위 기본
 * 10원, Settings에서 100/1000원으로 바꿀 수 있다(A-11 작업2). */
export function roundToUnit(amountKrw: number, unit: number): number {
  if (unit <= 0) return Math.round(amountKrw);
  return Math.round(amountKrw / unit) * unit;
}
