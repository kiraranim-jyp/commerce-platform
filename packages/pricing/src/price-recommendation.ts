/**
 * N-4.03 Part 8(대표님 지시: "가격을 자동 변경하지 않는다. 추천만 한다") —
 * 4가지 기준가격을 계산한다. 이 함수는 값을 계산만 하고, 실제 판매가를
 * 바꾸는 어떤 부수효과도 없다(호출부가 UI에 "추천"으로만 보여주고, 실제
 * 적용은 PART 19 원칙대로 사람이 승인해야 한다).
 *
 * P-26(CPO 지시, 2026-09-03) — "10% 최소마진은 더 이상 절대 판매가 하한선이
 * 아니다"로 정책이 바뀌었다(CEO 승인 옵션 1). 기존에는 minimumPrice가
 * recommendedPrice의 강제 하한선이었다 — 시장가가 아무리 낮아도
 * `max(minimumPrice, ...)`로 항상 최소마진 이상을 추천했다. 실측(PèPè)에서
 * 이게 "국내 최저가 ₩258,000인데 ₩269,333을 추천"하는 비현실적 컨설팅을
 * 만들었다. 이제 세 기준가격의 역할을 분리한다:
 *  - targetPrice: 이상적인 목표(참고용, 하한선 아님)
 *  - domesticLowestPriceKrw(marketPrice): 실제 판매 가능 가격의 근거
 *  - totalCostKrw(landedCostKrw): 절대 손실 판단 기준(0% 마진 = 손익분기)
 * CASE A/B/C/D로 EXACT 동일상품 시장가와 착지원가를 비교해 실제로 "얼마에
 * 팔 수 있는지"를 판단한다 — COMPARISON/NONE(EXACT 아님)일 때는 시장경쟁
 * 추천 자체를 하지 않는다(CASE D, "시장 경쟁력 있음" 같은 확정적 표현 금지).
 */
export type MarketCaseCode = "A" | "B" | "C" | "D";

export interface PriceRecommendationInput {
  totalCostKrw: number;
  /** P-24(CPO 지시, 2026-09-02) — 이 함수 본문 어디에서도 실제로 쓰이지 않는
   * 필드였다. optional로 유지(기존 호출부 호환). */
  currentSellingPriceKrw?: number;
  domesticLowestPriceKrw: number | null;
  domesticAveragePriceKrw: number | null;
  /** P-26 — "동일상품 판별 근거"가 EXACT일 때만 domesticLowestPriceKrw를
   * 시장경쟁 판단(CASE A/B/C)에 쓴다. COMPARISON/NONE이면 CASE D(판단 보류) —
   * 검증되지 않은 유사상품 가격으로 "판매 가능/비추천"을 확정하지 않는다. */
  domesticBasis: "EXACT" | "COMPARISON" | "NONE";
  /** 참고용 목표 마진율(%) — 더 이상 추천가의 하한선이 아니다(P-26). */
  minimumMarginPercent: number;
  /** 목표로 삼는 마진율(%) — CASE A/D 계산과 참고 목표가에 쓰인다. */
  targetMarginPercent: number;
  /** P-13A(대표님/CPO 지시, 2026-08-31) — EXACT 시장가가 없을 때(CASE D)만
   * 참고치로 쓰는 2차 기준. "시장 경쟁 추천"이라고 부르지 않는다(CASE D). */
  brandMedianPriceKrw?: number | null;
}

export interface PriceRecommendationResult {
  /** 참고용 — 최소 마진율 기준가(더 이상 recommendedPrice의 하한선이 아니다). */
  minimumPrice: number;
  /** 목표 마진율 기준 판매가(참고용 — 시장가와 무관하게 계산된 이상적 목표). */
  targetPrice: number;
  /** P-26 — CASE A/B/C/D 중 어느 경우인지. EXACT 시장가 vs 착지원가/목표가
   * 비교 결과. UI/판매판단 양쪽이 이 값 하나만 보고 일관되게 분기한다. */
  marketCase: MarketCaseCode;
  /** 최종 추천가 — CASE C(시장가 손실)/CASE D(EXACT 데이터 없음)에서는 억지
   * 추천가를 만들지 않고 null이다. CASE A는 목표마진 확보하며 시장가보다
   * 살짝 낮은 가격, CASE B는 시장가 그대로(목표마진 미달이어도 손실은 아님). */
  recommendedPrice: number | null;
  /** recommendedPrice 기준 실제 마진율(%) — CASE B처럼 목표(targetMarginPercent)에
   * 못 미쳐도 하드코딩하지 않고 항상 실제 계산값이다. CASE C/D는 null. */
  estimatedMarginPercent: number | null;
  /** recommendedPrice가 실제로 어느 근거로 계산됐는지. */
  competitiveBasis: "DOMESTIC_LOWEST" | "BRAND_MEDIAN" | null;
  /** CASE D 전용 — brandMedianPriceKrw가 있을 때만 채워지는 참고치(확정
   * 추천가 아님, "시장 경쟁력 기반 추천"이라고 부르지 않는다). recommendedPrice와
   * 구분되는 별도 필드라 CASE A/B/C에서는 항상 null이다. */
  referencePriceKrw: number | null;
}

function priceForMargin(costKrw: number, marginPercent: number): number {
  const retainedRatio = 1 - marginPercent / 100;
  return retainedRatio > 0 ? Math.round(costKrw / retainedRatio) : costKrw;
}

/** 판매가 기준 마진율 — packages/pricing 전역에서 쓰는 공식과 동일
 * ((판매가-원가)/판매가*100, price-decision.ts와 동일 분모). */
function marginPercentAt(priceKrw: number, costKrw: number): number {
  return Number((((priceKrw - costKrw) / priceKrw) * 100).toFixed(1));
}

export function computePriceRecommendation(input: PriceRecommendationInput): PriceRecommendationResult {
  const minimumPrice = priceForMargin(input.totalCostKrw, input.minimumMarginPercent);
  const targetPrice = priceForMargin(input.totalCostKrw, input.targetMarginPercent);
  const landedCost = input.totalCostKrw;

  // CASE D — EXACT 동일상품 시장가가 없다(COMPARISON만 있거나 아예 없음).
  // 검증되지 않은 유사상품 가격으로 "시장 경쟁력 있음/판매 비추천"을 확정하지
  // 않는다 — brandMedianPriceKrw가 있으면 참고치만 낸다(competitiveBasis로
  // "BRAND_MEDIAN"임을 명시해 시장가 기반 추천과 구분).
  if (input.domesticBasis !== "EXACT" || input.domesticLowestPriceKrw == null) {
    if (input.brandMedianPriceKrw != null) {
      const brandCeiling = Math.round(input.brandMedianPriceKrw * 0.95);
      return {
        minimumPrice,
        targetPrice,
        marketCase: "D",
        recommendedPrice: null,
        estimatedMarginPercent: null,
        competitiveBasis: "BRAND_MEDIAN",
        referencePriceKrw: Math.min(targetPrice, brandCeiling),
      };
    }
    return {
      minimumPrice,
      targetPrice,
      marketCase: "D",
      recommendedPrice: null,
      estimatedMarginPercent: null,
      competitiveBasis: null,
      referencePriceKrw: null,
    };
  }

  const marketPrice = input.domesticLowestPriceKrw;

  // CASE C — 시장가가 착지원가(0% 마진) 이하 → 시장가로 팔면 손실이다.
  // 억지 추천가를 만들지 않는다(recommendedPrice: null).
  if (marketPrice <= landedCost) {
    return {
      minimumPrice,
      targetPrice,
      marketCase: "C",
      recommendedPrice: null,
      estimatedMarginPercent: null,
      competitiveBasis: "DOMESTIC_LOWEST",
      referencePriceKrw: null,
    };
  }

  // CASE A — 시장가에서도 목표마진을 확보할 수 있다. 목표가를 하한으로,
  // 시장가보다 살짝(1%) 낮은 값을 상한 기준으로 잡는다(불필요한 덤핑 금지 —
  // 시장가 근접까지만 내려간다).
  if (marketPrice >= targetPrice) {
    const recommendedPrice = Math.max(targetPrice, Math.round(marketPrice * 0.99));
    return {
      minimumPrice,
      targetPrice,
      marketCase: "A",
      recommendedPrice,
      estimatedMarginPercent: marginPercentAt(recommendedPrice, landedCost),
      competitiveBasis: "DOMESTIC_LOWEST",
      referencePriceKrw: null,
    };
  }

  // CASE B — 착지원가 < 시장가 < 목표가. 시장가로 팔면 목표마진에는 못
  // 미치지만 손실은 아니다. 10% 최소마진 하한선 때문에 시장가보다 비싼
  // 가격을 추천하지 않는다(P-26 핵심 정책 변경) — 시장가를 그대로 권장한다.
  const recommendedPrice = marketPrice;
  return {
    minimumPrice,
    targetPrice,
    marketCase: "B",
    recommendedPrice,
    estimatedMarginPercent: marginPercentAt(recommendedPrice, landedCost),
    competitiveBasis: "DOMESTIC_LOWEST",
    referencePriceKrw: null,
  };
}
