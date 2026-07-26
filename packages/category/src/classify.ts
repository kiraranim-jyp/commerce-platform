import type { CanonicalProduct } from "@commerce/shared";
import { countKeywordMatches, PRODUCT_TYPES, type ProductType } from "./keyword-rules";

export interface ClassifiedType {
  type: ProductType;
  confidence: number;
  reasons: string[];
}

/**
 * title 매칭이 description 매칭보다 상품 유형을 훨씬 강하게 시사한다(설명에는
 * "cotton shirt with matching leggings"처럼 다른 상품 얘기가 섞여 들어가기 쉽다) —
 * 그래서 title 매칭에 더 높은 가중치를 준다. 매칭이 하나도 없으면 그 타입은 후보에서
 * 아예 제외한다(0%로 보여주는 건 "추천"이 아니라 "추측"이라 의미가 없다).
 */
const TITLE_WEIGHT = 0.4;
const DESCRIPTION_WEIGHT = 0.15;
const BASE_CONFIDENCE = 0.45;
const MAX_CONFIDENCE = 0.97;

export function classifyProductType(product: CanonicalProduct): ClassifiedType[] {
  const title = product.title.value ?? "";
  const description = product.description.value ?? "";

  const results: ClassifiedType[] = [];

  for (const type of PRODUCT_TYPES) {
    const titleMatch = countKeywordMatches(type, title);
    const descriptionMatch = countKeywordMatches(type, description);
    if (titleMatch.count === 0 && descriptionMatch.count === 0) continue;

    const confidence = Math.min(
      MAX_CONFIDENCE,
      BASE_CONFIDENCE + titleMatch.count * TITLE_WEIGHT + descriptionMatch.count * DESCRIPTION_WEIGHT,
    );

    const reasons: string[] = [];
    for (const keyword of titleMatch.matched) {
      reasons.push(`상품명에 "${keyword}" 포함`);
    }
    for (const keyword of descriptionMatch.matched) {
      reasons.push(`상품 설명에 "${keyword}" 포함`);
    }

    results.push({ type, confidence, reasons });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}
