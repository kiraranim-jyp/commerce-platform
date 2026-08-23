/**
 * N-4.03 Part 4(대표님 지시: "다른 상품의 최저가격을 우리 상품 경쟁가격으로
 * 사용하지 않는다") — 네이버 쇼핑 검색 결과 하나하나가 실제로 이 상품인지
 * 판정한다. 단순 최저가 선택은 동명이인 상품(같은 브랜드의 다른 옷, 완전히
 * 다른 브랜드가 우연히 키워드만 겹치는 경우)을 경쟁가격으로 착각할 위험이
 * 있다 — 그 오분류를 막는 게 이 모듈의 유일한 목적이다.
 */
export type ListingMatchLevel = "MATCH" | "LIKELY_MATCH" | "WEAK_MATCH" | "REJECT";

export interface MatchProductInput {
  brand: string;
  modelName: string;
  title: string;
}

export interface MatchListingInput {
  title: string | null;
}

export interface ListingMatchResult {
  level: ListingMatchLevel;
  score: number;
  reasons: string[];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/)
      .filter((t) => t.length >= 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 0~1 score. 임계값은 보수적으로 잡는다 — 애매하면 REJECT/WEAK_MATCH 쪽으로
 * 기울인다(잘못된 경쟁가격을 마진 판단에 섞는 것보다 놓치는 게 안전). */
export function classifyListingMatch(product: MatchProductInput, listing: MatchListingInput): ListingMatchResult {
  if (!listing.title) {
    return { level: "REJECT", score: 0, reasons: ["리스팅 제목 없음 — 비교 불가"] };
  }
  const listingTitleLower = listing.title.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const brand = product.brand.trim().toLowerCase();
  if (brand && listingTitleLower.includes(brand)) {
    score += 0.4;
    reasons.push("브랜드 일치");
  }

  const modelName = product.modelName.trim().toLowerCase();
  if (modelName && listingTitleLower.includes(modelName)) {
    score += 0.4;
    reasons.push("모델명 일치");
  }

  const overlap = jaccard(tokenize(product.title), tokenize(listing.title));
  score += overlap * 0.2;
  if (overlap > 0.3) reasons.push(`제목 유사도 ${Math.round(overlap * 100)}%`);

  score = Math.min(1, Number(score.toFixed(3)));

  let level: ListingMatchLevel;
  if (score >= 0.7) level = "MATCH";
  else if (score >= 0.4) level = "LIKELY_MATCH";
  else if (score >= 0.15) level = "WEAK_MATCH";
  else level = "REJECT";

  if (reasons.length === 0) reasons.push("브랜드/모델명/제목 유사도 모두 낮음");

  return { level, score, reasons };
}

/** run-price-check.ts 등 호출부가 "경쟁가격 계산에 이 리스팅을 쓸지"만
 * 판단할 때 쓰는 얇은 헬퍼 — REJECT만 제외하고 나머지는 신뢰도 낮은 것도
 * 일단 포함한다(대표님 지시대로 "모호한 매칭도 후보로 남긴다"는 기존
 * 원칙, N-3.10 comparison-search와 동일). */
export function isUsableForCompetitionPrice(level: ListingMatchLevel): boolean {
  return level !== "REJECT";
}
