import type { CanonicalProduct } from "@commerce/shared";

/**
 * AI가 titleKo/descriptionKo를 생성하면 그 값이 등록 화면에 우선 반영돼야 한다
 * (해외 원문 그대로로는 국내 마켓에 등록할 수 없다) — 아직 생성 전이면 원본
 * title/description으로 자연스럽게 폴백한다. 3개 어댑터가 전부 이 규칙을
 * 써서 "AI 콘텐츠 생성 여부에 따라 플랫폼마다 다르게 보이는" 일이 없게 한다.
 */
export function effectiveTitle(product: CanonicalProduct): string {
  return product.titleKo.value.trim() || product.title.value;
}

export function effectiveDescription(product: CanonicalProduct): string {
  return product.descriptionKo.value.trim() || product.description.value;
}
