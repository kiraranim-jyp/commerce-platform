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

export type VariantPriceMode = "ABSOLUTE" | "DELTA" | "UNKNOWN";

export interface VariantFinalPriceResult {
  /** 이 옵션 조합에 실제로 적용해야 할 최종 판매가(KRW). */
  finalKrw: number;
  /** false면 옵션 원본가를 반영하지 못해(통화 불일치/UNKNOWN/값 없음)
   * 기본 상품의 최종가를 그대로 썼다는 뜻 — 화면이 "옵션가 미확인"으로
   * 구분해서 보여줄 수 있게 한다. */
  applied: boolean;
}

/**
 * Sprint A-4(CPO 지시: "옵션마다 환율/마진을 다시 독립적으로 계산하지 않는다,
 * 기본 상품의 최종 판매가 기준으로 옵션 가격 차이만 반영한다") —
 *
 * 발견된 버그(수정 대상): 기존 로직(packages/listing의 buildOptionCombinations)은
 * `convertToKrw(variant.price) - salePrice`를 그대로 옵션 가격차로 썼다.
 * salePrice는 이미 마진/수수료가 적용된 최종 판매가인데 variant.price는
 * 마진 없는 원본 환산값이라, 마진이 0이 아닌 한(기본값 20%+수수료 10%)
 * 항상 실제와 다른(대개 음수로 뒤집힌) 델타가 나왔다 — 예: 기본 $77→최종
 * ₩165,640(마진 포함)인데 옵션 Red $82(기본보다 비쌈)가
 * convertToKrw(82)-165,640 ≈ -55,000으로 계산돼 "옵션이 더 싸다"는 반대
 * 결과가 나왔다. 이 함수가 그 자리를 대체한다: 원본 통화 단계에서 먼저
 * 차액을 구하고, 그 차액만 환율로 환산해서(마진 재적용 없이) 기본
 * 최종가에 더한다.
 */
export function computeVariantFinalPriceKrw(
  base: { amount: number; currency: string; finalKrw: number },
  variant: { amount: number; currency: string; mode?: VariantPriceMode } | undefined,
  liveRates?: Record<string, number>,
): VariantFinalPriceResult {
  if (!variant) return { finalKrw: base.finalKrw, applied: false };
  const mode: VariantPriceMode = variant.mode ?? "ABSOLUTE";
  if (mode === "UNKNOWN") return { finalKrw: base.finalKrw, applied: false };
  if (variant.currency.toUpperCase() !== base.currency.toUpperCase()) {
    // 케이스 7(CPO 지시: "옵션별 통화가 서로 다른 경우 → UNRESOLVED") — 서로
    // 다른 통화의 절대값을 빼면 의미 없는 숫자가 나온다. 값을 지어내지 않고
    // 기본 상품가로 폴백한다.
    return { finalKrw: base.finalKrw, applied: false };
  }
  const deltaSourceAmount = mode === "DELTA" ? variant.amount : variant.amount - base.amount;
  if (deltaSourceAmount === 0) return { finalKrw: base.finalKrw, applied: true };
  const deltaKrw = convertToKrw(deltaSourceAmount, variant.currency, liveRates).amountKrw;
  return { finalKrw: base.finalKrw + deltaKrw, applied: true };
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
