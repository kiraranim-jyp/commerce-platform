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
  /** N-4.18 P1-PRICE-SEARCH STEP4(대표님 지시: "색상이 다르면 동일상품으로
   * 단정하면 안 된다") — 값이 없으면(빈 문자열) 색상 신호를 아예 쓰지 않는다
   * (모르는 걸 다르다고 단정하지 않는다는 기존 원칙과 동일). */
  color?: string;
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

/** N-4.18 P1-PRICE-SEARCH STEP4 — 국내 리스팅 제목은 "{모델} in {색상} by
 * {브랜드}" 같은 고정 패턴이 없어(packages/crawler/comparison-search/match.ts의
 * splitModelColor는 영문 사이트 전용) 색상 단어 사전으로 명시적 등장 여부만
 * 확인한다. 동의어 그룹 밖에서는 아무 판단도 하지 않는다(추측 금지). */
const COLOR_SYNONYM_GROUPS: string[][] = [
  ["black", "블랙", "검정", "검정색"],
  ["white", "화이트", "흰색"],
  ["ivory", "아이보리"],
  ["navy", "네이비", "남색"],
  ["blue", "블루", "파랑", "파란색"],
  ["red", "레드", "빨강", "빨간색"],
  ["pink", "핑크", "분홍", "분홍색"],
  ["green", "그린", "초록", "초록색"],
  ["khaki", "카키"],
  ["yellow", "옐로우", "노랑", "노란색"],
  ["brown", "브라운", "갈색"],
  ["grey", "gray", "그레이", "회색"],
  ["beige", "베이지"],
  ["purple", "퍼플", "보라", "보라색"],
  ["orange", "오렌지", "주황", "주황색"],
];

function findColorGroup(text: string): number | null {
  const lower = text.toLowerCase();
  for (let i = 0; i < COLOR_SYNONYM_GROUPS.length; i++) {
    if (COLOR_SYNONYM_GROUPS[i].some((word) => lower.includes(word))) return i;
  }
  return null;
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

  // 색상 — 상품/리스팅 둘 다에서 색상 단어가 명시적으로 확인될 때만 적용한다.
  if (product.color) {
    const productColorGroup = findColorGroup(product.color);
    const listingColorGroup = productColorGroup === null ? null : findColorGroup(listingTitleLower);
    if (productColorGroup !== null && listingColorGroup !== null) {
      if (productColorGroup === listingColorGroup) {
        reasons.push("색상 일치");
      } else {
        score = score * 0.5;
        reasons.push("색상 불일치 — 다른 옵션일 수 있음");
      }
    }
  }

  let level: ListingMatchLevel;
  if (score >= 0.7) level = "MATCH";
  else if (score >= 0.4) level = "LIKELY_MATCH";
  else if (score >= 0.15) level = "WEAK_MATCH";
  else level = "REJECT";

  if (reasons.length === 0) reasons.push("브랜드/모델명/제목 유사도 모두 낮음");

  return { level, score, reasons };
}

/** N-4.18 P1-PRICE-SEARCH STEP9(대표님 지시: "Precision을 희생해서 Recall만
 * 올리는 방식은 금지한다" / "검색과 가격판정은 분리한다") — 예전엔 REJECT만
 * 제외하고 WEAK_MATCH까지 경쟁가격 계산에 넣었다(모호한 매칭도 후보로 남긴다는
 * 기존 원칙). 이번 지시로 정책이 바뀐다: 검색 결과 자체는 여전히 다 보여주되
 * (recordDomesticSourceCheckAttempt 등은 그대로), 실제 "국내 최저가/평균가"
 * 숫자 계산에는 MATCH/LIKELY_MATCH만 쓴다 — WEAK_MATCH(0.15~0.4, 브랜드/모델명
 * 없이 제목 겹침만으로도 나올 수 있는 점수)는 서로 다른 상품을 경쟁가로 착각할
 * 위험이 REJECT 바로 다음으로 크다. */
export function isUsableForCompetitionPrice(level: ListingMatchLevel): boolean {
  return level === "MATCH" || level === "LIKELY_MATCH";
}
