/**
 * 필드 하나의 출처를 추적한다. Commerce Listing Preview Engine의 핵심 개념 —
 * "이 값이 원본 사이트에서 그대로 온 건지, AI가 만든 건지, 사람이 고친 건지"를
 * 화면에서 구분해서 보여주기 위한 것이다.
 *
 * ORIGINAL: 원본 사이트에서 추출한 값 그대로.
 * GENERATED: AI가 만들어낸 값(이번 범위에는 없지만, 다음 Mission인 Product Data
 *   Extraction/자동 번역·설명 생성이 붙으면 이 값을 쓰게 된다 — 미리 자리를 만들어둔다).
 * EDITED: 사람이 Preview 화면에서 직접 고친 값.
 */
export type FieldSource = "ORIGINAL" | "GENERATED" | "EDITED";

export interface ProvenanceField<T> {
  value: T;
  source: FieldSource;
  /** 0~1. 원본 추출값은 어떤 소스에서 왔는지(JSON-LD/OpenGraph/DOM)에 따라 다르게
   * 매겨진다 — packages/crawler의 product-data-extractor.ts 참고. 사람이 직접
   * 수정한 값(EDITED)은 항상 1이다. */
  confidence: number;
}

/**
 * 플랫폼과 무관한 "기준" 상품 데이터. 스마트스토어/쿠팡/11번가 Preview는 전부
 * 이 하나의 구조에서 PlatformAdapter를 통해 파생된다 — 플랫폼마다 별도로 상품
 * 데이터를 복제하지 않는다(packages/marketplace의 어댑터 설계 원칙).
 */
export interface CanonicalProduct {
  sourceUrl: string;
  title: ProvenanceField<string>;
  brand: ProvenanceField<string>;
  price: ProvenanceField<{ amount: number; currency: string }>;
  sku: ProvenanceField<string>;
  description: ProvenanceField<string>;
  material: ProvenanceField<string>;
  /** 옵션 "종류"만 다룬다(예: ["Color", "Size"]) — 값 목록까지 추출하는 건 사이트마다
   * 구조가 너무 달라 다음 Mission(카테고리 매핑/필수 필드) 범위로 미룬다. */
  options: ProvenanceField<string[]>;
  images: { url: string; isRepresentative: boolean }[];
}
