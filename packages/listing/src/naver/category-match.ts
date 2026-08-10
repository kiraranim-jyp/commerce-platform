import { getProductTypeExpectKeywords, resolveProductSignals, scoreCategoryCandidate } from "@commerce/category";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * Sprint N-2.9 — Naver leaf category 자동 매칭.
 *
 * 처음 구현(영문 상품명/브랜드 토큰을 Naver 카테고리 텍스트와 직접 대조)은
 * 실제 데이터로 테스트하자마자 실패했다 — CartPilot 상품 데이터는 해외
 * 사이트에서 온 영문이고("Hamster Kid Cap"), Naver 카테고리 이름은 전부
 * 한글("모자")이라 겹치는 토큰이 원천적으로 없다(실측: 4999개 카테고리 전체
 * 대상으로 후보 0개). 그래서 영문 토큰 겹침 대신, @commerce/category가 이미
 * 갖고 있는 영문→한글 productType 번역 테이블(product-resolver.ts
 * PRODUCT_TYPE_KEYWORDS, 예: "hat"/"cap" → "모자")과 그 productType의 한글
 * 기대 키워드(getProductTypeExpectKeywords, 예: "모자"→["모자","캡","비니"])를
 * 1차 필터로 쓴다 — 이러면 한글 카테고리 텍스트와 실제로 겹칠 수 있다.
 *
 * 최종 점수는 scoreCategoryCandidate(Coupang Category Resolver 3.0에서 이미
 * 검증된 순수 함수) 결과를 그대로 쓴다 — 새 스코어링 로직을 또 만들지 않는다.
 */

export interface NaverLeafCategory {
  id: string;
  /** "출산/육아>유아동의류>티셔츠" 형태 — N-2.4에서 확인한 실제 응답 필드. */
  wholeCategoryName: string;
}

export type NaverCategoryConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface NaverCategoryCandidate {
  categoryId: string;
  categoryPath: string[];
  score: number;
  reason: string;
  confidence: NaverCategoryConfidence;
}

/** N-2.9 완료조건 — "정확한 threshold는 구현 전에 실제 데이터로 결정한다."
 * 실제 leaf category 4999건 대상 실측(Hamster Kid Cap → 모자 계열 카테고리들)
 * 결과를 반영했다. scoreCategoryCandidate 자체가 이미 0~100 스케일이고
 * conflict 후보는 호출부에서 제외하므로, 여기 threshold는 "타입은 맞는데
 * 연령/성별까지 맞는지"를 가르는 기준이다. */
const CONFIDENCE_THRESHOLDS = { HIGH: 70, MEDIUM: 50 } as const;

function tier(score: number): NaverCategoryConfidence {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return "HIGH";
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return "MEDIUM";
  return "LOW";
}

export function generateNaverCategoryCandidates(
  product: CanonicalProduct,
  leafCategories: NaverLeafCategory[],
  limit = 5,
): NaverCategoryCandidate[] {
  const signals = resolveProductSignals(product);

  // productType을 못 정했으면(예: DOMAIN_PROFILES에 없는 상품유형) 한글
  // 검색어를 만들 수 없다 — 임의로 아무 카테고리나 후보에 넣지 않고 빈
  // 배열을 반환한다("확인 안 됨"을 정직하게 표시, N-2.6부터 이어지는 원칙).
  const expectKeywords = signals.productType ? getProductTypeExpectKeywords(signals.productType) : undefined;
  if (!expectKeywords || expectKeywords.length === 0) {
    return [];
  }

  const scored: NaverCategoryCandidate[] = [];
  for (const cat of leafCategories) {
    const hasExpectKeyword = expectKeywords.some((kw) => cat.wholeCategoryName.includes(kw));
    if (!hasExpectKeyword) continue; // 1차 필터 — 상품유형 키워드가 전혀 없는 카테고리는 스킵
    const path = cat.wholeCategoryName.split(">").map((s) => s.trim());
    const categoryName = path[path.length - 1] ?? cat.wholeCategoryName;
    const domainResult = scoreCategoryCandidate(categoryName, path, signals);
    if (domainResult.conflict) continue; // 도메인 명백히 다르면 후보 제외
    scored.push({
      categoryId: cat.id,
      categoryPath: path,
      score: domainResult.score,
      reason: domainResult.reason,
      confidence: tier(domainResult.score),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
