import type { CanonicalProduct, ProvenanceField } from "@commerce/shared";

/**
 * MockProductContentProvider(규칙 기반, 지금 유일한 구현체)를 실제 LLM 기반
 * Provider로 나중에 바꿀 때 이 인터페이스만 구현하면 된다 — CommerceWorkspace나
 * AI Content Panel UI는 바뀔 필요가 없다. CategoryProvider와 같은 패턴이다.
 */
export interface ProductContentProvider {
  generateTitle(product: CanonicalProduct): ProvenanceField<string>;
  generateDescription(product: CanonicalProduct): ProvenanceField<string>;
  generateKeywords(product: CanonicalProduct): ProvenanceField<string[]>;
  generateSeo(product: CanonicalProduct): {
    title: ProvenanceField<string>;
    description: ProvenanceField<string>;
  };
}
