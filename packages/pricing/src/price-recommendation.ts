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
  /** P-13A(대표님/CPO 지시, 2026-08-31) — 국내 동일상품 경쟁가격이 없을 때만
   * 쓰는 2차 기준. domesticLowestPriceKrw가 있으면 이 값은 완전히 무시한다
   * (동일상품 데이터가 항상 브랜드 시장 데이터보다 우선). */
  brandMedianPriceKrw?: number | null;
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
  /** P-13A — competitivePrice가 실제로 어느 데이터로 계산됐는지(UI 근거 표시용).
   * domesticLowestPriceKrw가 있으면 "동일상품", brandMedianPriceKrw만 있으면
   * "브랜드 시장", 둘 다 없으면 null(=targetPrice만으로 계산됨). */
  competitiveBasis: "DOMESTIC_LOWEST" | "BRAND_MEDIAN" | null;
}

function priceForMargin(costKrw: number, marginPercent: number): number {
  const retainedRatio = 1 - marginPercent / 100;
  return retainedRatio > 0 ? Math.round(costKrw / retainedRatio) : costKrw;
}

export function computePriceRecommendation(input: PriceRecommendationInput): PriceRecommendationResult {
  const minimumPrice = priceForMargin(input.totalCostKrw, input.minimumMarginPercent);
  const targetPrice = priceForMargin(input.totalCostKrw, input.targetMarginPercent);

  // 국내 최저가보다 살짝(1%) 낮게 잡아 경쟁력을 준다 — 단, minimumPrice 밑으로는 내려가지 않는다.
  // P-13A — 동일상품 데이터가 없을 때만(domesticLowestPriceKrw===null) 브랜드
  // 시장 중앙가격을 2차 기준으로 쓴다. "시장 중앙가격 이하로 추천"(CPO 명시)를
  // 위해 95%를 상한으로 잡되, targetPrice보다 높게는 올리지 않는다(마진 목표를
  // 브랜드 중앙값이 초과해서 끌어올리지 않는다 — 상한 역할만).
  let competitivePrice: number | null = null;
  let competitiveBasis: PriceRecommendationResult["competitiveBasis"] = null;
  if (input.domesticLowestPriceKrw != null) {
    competitivePrice = Math.max(minimumPrice, Math.round(input.domesticLowestPriceKrw * 0.99));
    competitiveBasis = "DOMESTIC_LOWEST";
  } else if (input.brandMedianPriceKrw != null) {
    const brandCeiling = Math.round(input.brandMedianPriceKrw * 0.95);
    competitivePrice = Math.max(minimumPrice, Math.min(targetPrice, brandCeiling));
    competitiveBasis = "BRAND_MEDIAN";
  }

  const recommendedPrice = Math.max(minimumPrice, competitivePrice ?? targetPrice);

  return { minimumPrice, targetPrice, competitivePrice, recommendedPrice, competitiveBasis };
}
