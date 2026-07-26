/**
 * 필드 하나의 출처를 추적한다. Commerce Listing Preview Engine의 핵심 개념 —
 * "이 값이 원본 사이트에서 그대로 온 건지, AI가 만든 건지, 사람이 고친 건지"를
 * 화면에서 구분해서 보여주기 위한 것이다.
 *
 * ORIGINAL: 원본 사이트에서 추출한 값 그대로.
 * AI_GENERATED: AI가 만들어낸 값(한국어 상품명/설명/키워드/SEO 생성 등).
 * USER_EDITED: 사람이 Preview 화면에서 직접 고친 값.
 * DEFAULT: 시스템이 채워넣은 기본값 — 값은 있지만 사용자가 확인한 적은 없다
 *   (예: 재고 999개, 배송비 무료). ERROR로 막을 정도는 아니지만 그대로 등록하면
 *   위험할 수 있어서 WARNING으로 표시한다 — REQUIRED와 다르다(REQUIRED는 값 자체가
 *   없다).
 * REQUIRED: 값이 아직 없고, 등록 전에 반드시 채워야 한다(예: 원산지). ERROR로 막는다.
 */
export type FieldSource = "ORIGINAL" | "AI_GENERATED" | "USER_EDITED" | "DEFAULT" | "REQUIRED";

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
 *
 * titleKo/descriptionKo/keywords/seoTitle/seoDescription은 title/description과
 * 다른 필드다 — title/description은 "원본 사이트에서 추출한 값"이고, 이 5개는
 * "AI가 만든 한국어 등록용 콘텐츠"다. 둘을 하나로 합쳐 덮어쓰지 않는 이유는
 * Source Data 화면이 계속 원본 그대로를 보여줘야 하기 때문이다(그래야 AI가
 * 뭘 보고 콘텐츠를 만들었는지 사용자가 비교할 수 있다). 크롤러는 이 5개를 절대
 * 채우지 않으므로 항상 빈 값 + ORIGINAL로 시작하고, AI 생성 시 GENERATED로,
 * 사용자가 고치면 EDITED로 바뀐다 — title/description과 같은 규칙이다.
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
   * 구조가 너무 달라 이번 범위에서는 다루지 않는다. */
  options: ProvenanceField<string[]>;
  images: { url: string; isRepresentative: boolean }[];
  titleKo: ProvenanceField<string>;
  descriptionKo: ProvenanceField<string>;
  keywords: ProvenanceField<string[]>;
  seoTitle: ProvenanceField<string>;
  seoDescription: ProvenanceField<string>;
  /** 등록 실행 직전에야 문제가 드러나는 필드들 — 원산지/반품정보는 원본 사이트에
   * 거의 없고(REQUIRED로 시작), 배송비/재고는 합리적인 기본값으로 시작하되
   * 사용자가 확인 전까진 DEFAULT로 표시한다. */
  countryOfOrigin: ProvenanceField<string>;
  returnPolicy: ProvenanceField<string>;
  shippingFee: ProvenanceField<number>;
  stockQuantity: ProvenanceField<number>;
  /** 대부분의 카테고리는 필요 없다 — 있으면 참고 정보로만 쓰고 등록을 막지 않는다. */
  certification: ProvenanceField<string>;
}

/**
 * @commerce/marketplace와 @commerce/category 둘 다 이 id로 플랫폼을 구분한다.
 * marketplace가 category를 참조하고(ListingModel이 CategorySelection을 들고 있음)
 * category는 marketplace를 참조하지 않는 단방향 의존이라, 순환 참조를 피하려면
 * PlatformId는 둘 다의 하위 의존인 shared에 있어야 한다.
 */
export type PlatformId = "smartstore" | "coupang" | "elevenst";
