/**
 * N-4.03 Part 8(대표님 지시: "가격을 자동 변경하지 않는다. 추천만 한다") —
 * 4가지 기준가격을 계산한다. 이 함수는 값을 계산만 하고, 실제 판매가를
 * 바꾸는 어떤 부수효과도 없다(호출부가 UI에 "추천"으로만 보여주고, 실제
 * 적용은 PART 19 원칙대로 사람이 승인해야 한다).
 */
export interface PriceRecommendationInput {
  totalCostKrw: number;
  currentSellingPriceKrw: number;
  domesticLowestPriceKrw: number | null;
  domesticAveragePriceKrw: number | null;
  /** 최소 허용 마진율(%) — 이 아래로는 절대 추천하지 않는다. */
  minimumMarginPercent: number;
  /** 목표로 삼는 마진율(%) — 경쟁가격이 없을 때 추천가의 기준. */
  targetMarginPercent: number;
}

export interface PriceRecommendationResult {
  /** 최소 마진율을 만족하는 최저 판매가 — 이보다 낮으면 안 된다. */
  minimumPrice: number;
  /** 목표 마진율 기준 판매가(경쟁가격과 무관). */
  targetPrice: number;
  /** 국내 경쟁가격 기반 판매가(최저가보다 살짝 낮게 — 없으면 null). */
  competitivePrice: number | null;
  /** 최종 추천가 — minimumPrice를 절대 하회하지 않는 선에서
   * competitivePrice(있으면)와 targetPrice 중 판매자에게 유리한 쪽. */
  recommendedPrice: number;
}

function priceForMargin(costKrw: number, marginPercent: number): number {
  const retainedRatio = 1 - marginPercent / 100;
  return retainedRatio > 0 ? Math.round(costKrw / retainedRatio) : costKrw;
}

export function computePriceRecommendation(input: PriceRecommendationInput): PriceRecommendationResult {
  const minimumPrice = priceForMargin(input.totalCostKrw, input.minimumMarginPercent);
  const targetPrice = priceForMargin(input.totalCostKrw, input.targetMarginPercent);

  // 국내 최저가보다 살짝(1%) 낮게 잡아 경쟁력을 준다 — 단, minimumPrice 밑으로는 내려가지 않는다.
  const competitivePrice =
    input.domesticLowestPriceKrw != null
      ? Math.max(minimumPrice, Math.round(input.domesticLowestPriceKrw * 0.99))
      : null;

  const recommendedPrice = Math.max(minimumPrice, competitivePrice ?? targetPrice);

  return { minimumPrice, targetPrice, competitivePrice, recommendedPrice };
}
