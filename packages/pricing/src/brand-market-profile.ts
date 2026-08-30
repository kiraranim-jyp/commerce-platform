/**
 * P-13A(대표님/CPO 지시, 2026-08-31) — 국내 동일상품이 없을 때, "이 브랜드가
 * 국내에서 얼마에 팔리는가"를 최신 SELLER_ORIGIN 관측값 분포로 요약한다.
 * 표본이 적으면(1~2개) "시장"이라고 부를 근거가 없으므로 confidence를
 * INSUFFICIENT로 낮춰 호출부가 가격 추천에 쓰지 않도록 막는다(대표님 명시:
 * "표본이 적으면 분석하지 않는다"). 실측 데이터 분포(2026-08-31 조사, 80개
 * 상품 중 최다 브랜드 28개/10개, 나머지 대부분 1~2개)에 맞춘 threshold다.
 */
export type BrandMarketConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface BrandMarketProfile {
  /** market 축은 지금은 항상 "KR" — 향후 JP/US 확장 시 이 필드로만 분기한다
   * (CPO 지시: "데이터 모델은 처음부터 글로벌 구조로"). */
  market: "KR";
  sampleCount: number;
  minPriceKrw: number;
  p25PriceKrw: number;
  medianPriceKrw: number;
  p75PriceKrw: number;
  maxPriceKrw: number;
  confidence: BrandMarketConfidence;
}

function confidenceFromSampleCount(sampleCount: number): BrandMarketConfidence {
  if (sampleCount >= 10) return "HIGH";
  if (sampleCount >= 5) return "MEDIUM";
  if (sampleCount >= 3) return "LOW";
  return "INSUFFICIENT";
}

/** 선형보간 없는 nearest-rank 백분위수 — 표본이 적을 때(3~9개) 존재하지 않는
 * 값을 보간으로 지어내지 않는다(원칙: "모름을 만들어내지 않는다"). */
function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

/** pricesKrw는 브랜드에 속한 상품들의 "최신 SELLER_ORIGIN 관측값 중 판매
 * 가능한(soldOut!==true) 가격" 1개씩 — 호출부(DB 조회 계층)가 이미 이 조건으로
 * 걸러서 넘긴다는 전제다(이 함수는 순수 계산만, DB 접근 없음). */
export function computeBrandMarketProfile(pricesKrw: number[]): BrandMarketProfile | null {
  if (pricesKrw.length === 0) return null;
  const sorted = [...pricesKrw].sort((a, b) => a - b);
  return {
    market: "KR",
    sampleCount: sorted.length,
    minPriceKrw: sorted[0],
    p25PriceKrw: percentile(sorted, 25),
    medianPriceKrw: percentile(sorted, 50),
    p75PriceKrw: percentile(sorted, 75),
    maxPriceKrw: sorted[sorted.length - 1],
    confidence: confidenceFromSampleCount(sorted.length),
  };
}
