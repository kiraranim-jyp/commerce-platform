import type { ImageType } from "./image-types";
import type { CommerceCategoryPathResult } from "./category-path";

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
 * DETAIL_PAGE_REFERENCE: N-3.45(CPO 지시) — 사용자가 "이 필드는 상품 상세페이지에
 *   이미 나와 있으니 별도 구조화 입력 없이 참조 처리해도 된다"고 명시적으로 선택한
 *   상태. value는 빈 문자열로 둔다(값을 지어내지 않는다) — 플랫폼 어댑터가 등록
 *   payload를 만들 때만 "상품 상세페이지 참조" 같은 문구로 치환한다(원본 데이터는
 *   그대로 "참조"라는 사실만 기록). 어떤 필드가 이 상태를 실제로 허용하는지는
 *   packages/listing/src/notice/reference-eligibility.ts가 화이트리스트로 관리한다 —
 *   KC 인증정보(childCertification/certificationType)는 CPO가 영구 제외를 지시해서
 *   그 화이트리스트에 절대 들어가지 않는다(실제 구조화된 값만 허용).
 */
export type FieldSource = "ORIGINAL" | "AI_GENERATED" | "USER_EDITED" | "DEFAULT" | "REQUIRED" | "DETAIL_PAGE_REFERENCE";

export interface ProvenanceField<T> {
  value: T;
  source: FieldSource;
  /** 0~1. 원본 추출값은 어떤 소스에서 왔는지(JSON-LD/OpenGraph/DOM)에 따라 다르게
   * 매겨진다 — packages/crawler의 product-data-extractor.ts 참고. 사람이 직접
   * 수정한 값(EDITED)은 항상 1이다. */
  confidence: number;
}

/**
 * 이미지 파이프라인이 PRODUCT 이미지마다 만드는 두 변형 중 어느 쪽을 등록에 쓸지.
 * MODEL/LIFESTYLE/DETAIL/SIZE_CHART는 배경제거 대상이 아니라 항상 ORIGINAL이고
 * processedUrl 자체가 없다.
 */
export type ImageVariant = "ORIGINAL" | "PROCESSED";

/**
 * 이미지 카드 UI에서 사용자가 원본/배경제거 후보 중 고른 결과가 여기(selectedVariant)에
 * 반영돼야 SmartStore/Coupang 등록 payload까지 그대로 이어진다 — UI가 URL 문자열을
 * 직접 바꾸는 대신 항상 이 필드를 통해서만 어떤 이미지가 쓰일지 결정한다
 * (getSelectedImageUrl 참고).
 */
export interface CanonicalProductImage {
  id: string;
  originalUrl: string;
  /** 배경제거가 성공하고 JPEG 검증도 통과했을 때만 있다(PRODUCT 전용). */
  processedUrl?: string;
  selectedVariant: ImageVariant;
  isRepresentative: boolean;
  /** 마켓플레이스 등록 시 대표 이미지 외 "추가 이미지" 갤러리에도 쓸지. 대부분
   * true가 기본값이다 — 사용자가 직접 빼고 싶은 사진(예: 로고만 있는 사이즈표성
   * 이미지)만 끄는 용도다. */
  useInProductGallery: boolean;
  /** 상세페이지 설명 콘텐츠에도 이 이미지를 넣을지. isRepresentative가 아닌
   * 이미지는 기본 true(설명에도 자연스럽게 들어가는 경우가 많음), 대표 이미지는
   * 기본 false(설명에서 또 반복해서 보여줄 필요가 적음)로 시작한다. */
  useInDescription: boolean;
  classification: ImageType;
}

/** 등록 payload/미리보기가 실제로 쓸 이미지 URL을 결정하는 유일한 통로 —
 * selectedVariant가 PROCESSED인데 processedUrl이 없으면(배경제거 실패) 항상
 * originalUrl로 안전하게 폴백한다. */
/**
 * 원본 사이트의 옵션 축 하나(예: Size, Colour, 색상 — 플랫폼/매장마다 이름이
 * 전부 다르다). 이름을 정규화하지 않고 원본 그대로 둔다 — 정규화는 플랫폼
 * 어댑터가 등록 시점에 판단할 문제이지, 크롤링 시점에 CartPilot이 임의로
 * "Colour"를 "Color"로 바꾸는 식으로 정보를 잃으면 안 된다.
 */
export interface CanonicalProductOptionGroup {
  name: string;
  values: string[];
}

/**
 * Sprint A-4(CPO 지시: "옵션 가격이 절대가인지 차액인지 명시하지 않으면
 * 추정하지 않는다") — 원본 사이트가 옵션마다 절대가격을 주는지(schema.org
 * offers.price가 흔히 이 형태), 기본가 대비 차액만 주는지 구분한다.
 * ABSOLUTE/DELTA 둘 다 CartPilot이 실제로 원본에서 읽은 값이고, UNKNOWN은
 * "값은 있지만 어떤 의미인지 원본이 명시하지 않아 CartPilot이 판단하지
 * 않은" 상태다(추정 금지 원칙 — packages/pricing의 computeVariantFinalPriceKrw가
 * UNKNOWN이면 옵션가를 아예 반영하지 않고 기본 상품가로 폴백한다).
 */
export type VariantPriceMode = "ABSOLUTE" | "DELTA" | "UNKNOWN";

/**
 * 옵션 값 조합 하나(예: {Size: "48cm", Colour: "Red"})에 대응하는 실제 판매
 * 단위 — 마켓플레이스에 등록되는 최소 단위(vendorItem/variant)와 1:1로 대응한다.
 * price/stockQuantity가 없으면(옵션마다 가격/재고가 다르지 않은 매장) 어댑터가
 * CanonicalProduct.price/stockQuantity로 폴백한다 — "값이 없다"를 "0이다"로
 * 취급하지 않는다.
 */
export interface CanonicalProductVariant {
  id: string;
  /** CanonicalProduct.optionGroups[].name과 일치해야 한다. */
  optionValues: Record<string, string>;
  sku?: string;
  /** Layer 1(Source Price) — 원본 통화 그대로. 환율/마진을 여기서 절대
   * 적용하지 않는다(Layer 2는 packages/pricing이 별도로 계산한다). */
  price?: { amount: number; currency: string };
  /** price가 있을 때만 의미가 있다. price는 있는데 priceMode가 없으면(과거
   * 데이터) ABSOLUTE로 취급한다 — 지금까지 이 필드를 채워온 모든 경로
   * (Shopify variants[], ProductGroup/hasVariant)가 실제로 절대가만 줬었다. */
  priceMode?: VariantPriceMode;
  stockQuantity?: number;
  /** 이 조합 전용 이미지(색상별 대표컷 등) — CanonicalProductImage.id를 가리킨다.
   * 원본 사이트가 실제로 옵션-이미지를 연결해뒀을 때만 있다. */
  imageId?: string;
  /** N-3.18(CPO 지시: "옵션별 가격/재고/SKU의 출처(Provenance)를 확인") —
   * sku/price/stockQuantity는 원래 출처 표시가 없었다(값만 있고 어디서 왔는지
   * 구분 불가). 이 필드들은 실제로 AI가 채우는 경로가 없으므로(오직 원본
   * 사이트 추출 또는 사용자가 OptionVariantEditor에서 직접 입력, 둘 중 하나)
   * FieldSource 전체 중 "ORIGINAL"/"USER_EDITED" 둘만 쓴다 — 없는 AI_GENERATED
   * 경로를 있는 것처럼 꾸미지 않는다. undefined면(마이그레이션 이전 데이터)
   * 출처를 모른다는 뜻이라 UI가 배지를 아예 안 그린다(추측 금지). */
  skuSource?: FieldSource;
  priceSource?: FieldSource;
  stockQuantitySource?: FieldSource;
}

export function getSelectedImageUrl(image: CanonicalProductImage): string {
  if (image.selectedVariant === "PROCESSED" && image.processedUrl) {
    return image.processedUrl;
  }
  return image.originalUrl;
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
  /** P1-1(Brand Resolver) — brand.value가 이미 마케팅 문구를 제거한 정제값일 때,
   * 원본 문자열과 어떤 규칙이 적용됐는지, 정제 신뢰도를 같이 보관한다(Explainable
   * Resolver — CPO 요구사항). 등록 시점(register/route.ts)에 "Raw → Rule Applied →
   * Cleaned → Brand Search API → Confidence"를 전부 로그로 남기려면 이 시점엔 이미
   * 정제 전 원본이 사라져 있어서(brand.value에는 정제값만 남음) 필요하다. 정제로
   * 값이 바뀌지 않았으면 없다(원본=정제값이라 보여줄 이유가 없다). optional로 둬서
   * 이 필드를 모르는 기존 CanonicalProduct 생성 코드(테스트 스크립트 등)를 깨지
   * 않는다. */
  brandResolution?: { raw: string; ruleApplied: string[]; confidence: "HIGH" | "LOW" };
  price: ProvenanceField<{ amount: number; currency: string }>;
  /** N-4.18-Q2 P0-1(대표님 지시, 2026-08-26: "정상가와 할인가를 분리한다") —
   * price(현재 실제 구매 가능한 가격)와 별개로, 원본 사이트가 할인 전 정가를
   * 명시적으로 제공할 때만 채운다(현재는 Shopify compare_at_price만 실측
   * 확인됨 — 다른 소스는 항상 undefined). price보다 크지 않으면(진짜 할인이
   * 아니면) 채우지 않는다 — "정상가와 현재 판매가가 같으면 중복 표시 안
   * 함" 원칙. 가격비교/등록 계산은 여전히 price(현재가)만 기준으로 한다 —
   * 이 필드를 비교 로직에 끌어쓰지 않는다. */
  regularPrice?: { amount: number; currency: string } | null;
  /** N-3.54(CPO 지시: "원본 가격을 못 읽었으면 가격을 계산하지 말고, 계산했으면
   * 그 가격의 근거가 무엇인지 보여줘야 한다") — price.value가 {amount:0,
   * currency:""}처럼 보여도 그게 "정말 0원짜리 상품"인지 "원본 가격을 못
   * 읽었다"인지 이 필드 없이는 구분할 방법이 없었다(canonical-product.ts가
   * 그냥 조용히 0/빈문자열로 기본값을 채워왔다 — 이게 근본 버그였다).
   * MISSING(원본에서 가격 필드 자체를 못 찾음) / INVALID(원문은 찾았지만
   * 숫자로 해석 불가하거나 0 이하) / VALID(정상) / UNRESOLVED(파싱은 됐지만
   * 환율을 못 구해 KRW 환산 불가 — 크롤링 시점엔 절대 세팅되지 않고
   * PriceEditor가 환율 조회 후에만 계산한다) 4단계. 등록 게이트가 VALID가
   * 아니면 등록을 막는다 — "판매가가 0보다 크다"는 기존 체크만으로는 원본을
   * 못 읽어 로직상 우연히 0보다 큰 값이 계산된 경우(배송비만으로 계산된
   * 권장가 등)를 잡지 못했다. */
  priceValidity: "VALID" | "MISSING" | "INVALID" | "UNRESOLVED";
  /** priceValidity가 INVALID일 때만(원본 텍스트는 찾았지만 파싱 실패) 채운다 —
   * 값을 지어내지 않고 원문 그대로 보여주기 위함. */
  priceRawText?: string;
  /** 사용자가 직접 입력한 "실제 판매가"(KRW) — price(원본 통화 원가)를 덮어쓰지
   * 않는다. 있으면 어댑터가 환율 변환값 대신 이 값을 쓴다. 없으면(아직 입력 전)
   * 환율 추정값을 그대로 쓴다 — packages/pricing의 convertToKrw() 참고. */
  priceOverrideKrw?: ProvenanceField<number>;
  /** P0-1(가격 계산 투명화) — 판매가격이 어떻게 나왔는지(배송비/수수료율/
   * 마진율 입력값) 보관한다. priceOverrideKrw만으로는 "왜 이 금액인지"가 안
   * 남아서 등록 이력에서 재구성할 수 없었다 — 이 필드가 그 계산 근거다.
   * priceOverrideKrw 없이(자동 환율값 그대로 등록) 이 필드만 있을 수도 있다. */
  priceBreakdown?: { shippingKrw: number; feePercent: number; marginPercent: number };
  /** P-3-2(대표님 지시, 2026-08-28) — 관세/부가세는 판매자 공통 기본값이
   * 아니라 카테고리/HS코드마다 달라 상품별로 직접 입력한다(국내 배송원가와
   * 반대로 SellerProfile이 아니라 여기 CanonicalProduct에 둔다 — P-3-1
   * 조사에서 확정한 설계). 사용자가 입력하기 전까지는 없다(0으로 지어내지
   * 않는다) — computeUnifiedPriceDecision()이 이 필드가 없으면 그대로
   * unknown으로 받는다. */
  customsDutyKrw?: ProvenanceField<number>;
  customsVatKrw?: ProvenanceField<number>;
  /** P0(Category Meta -> 동적 입력폼) — 카테고리 확정 후 사용자가 화면에서
   * 직접 채운 쿠팡 구매옵션(attribute)/고시정보(notice) 값. 키는
   * attributeTypeName 또는 noticeCategoryDetailName 원문 그대로(쿠팡 카테고리
   * 메타 API가 주는 이름과 정확히 일치해야 build-payload.ts의 매칭이 된다). */
  categoryFieldOverrides?: Record<string, string>;
  /** Sprint A-2(Category Resolver 보강) — 원본 사이트의 JSON-LD BreadcrumbList
   * (예: ["Home", "Kids", "Shoes", "Sneakers"]). title/description에 나이·성별
   * 신호가 전혀 없는 상품(같은 브랜드가 성인/키즈 라인을 이름만으로 구분 못
   * 하는 경우 — 예: Veja 스니커즈)도 사이트 자신의 분류는 갖고 있을 때가 많아,
   * detectKidsSignal()의 추가 신호로 쓴다. 크롤러가 못 찾으면 없다(지어내지
   * 않는다). */
  breadcrumbPath?: string[];
  /** Sprint A-2.5(Category Resolver 2.0) — schema.org Product.category(있으면).
   * breadcrumbPath와 같은 급의 "사이트 자체 분류" 신호. */
  jsonLdCategory?: string;
  /** Sprint A-2.5(Category Resolver 2.0) — Shopify 상품 전용(fast-path라
   * breadcrumbPath/jsonLdCategory를 못 채우는 경우가 많다). 실측(bobochoses.com):
   * vendor 필드에 시즌코드("SS26")가 들어와 브랜드 신호를 못 쓸 때도 tags에
   * "children","Kid" 같은 나이 신호가 남아 있었다 — Shopify가 아니면 undefined. */
  shopifyTags?: string;
  shopifyProductType?: string;
  /** Sprint A-2.5(Category Resolver 2.0) — CPO 요구사항: "등록마다 Resolver
   * Accuracy KPI를 저장한다." 사용자가 카테고리를 선택하는 시점에(CommerceWorkspace의
   * selectCategory) predict API 결과/선택한 후보/수동 override 여부를 기록해두고,
   * 실제 등록 시점(register/route.ts)에 finalRegistered를 채워 registration_attempts에
   * 함께 저장한다. */
  categoryResolverKpi?: {
    predictResult?: { code: number; name: string } | null;
    /** P-13C-2 STEP1(2026-08-31) — hierarchy는 selectCategory() 시점에 candidate에
     * 이미 있는 값을 그대로 옮겨 담는 것뿐이다(재계산/재조회 없음). 플랫폼
     * 종속 원본 경로 보존 목적이라 Canonical Category가 아니다 — 다른
     * 플랫폼과의 crosswalk에 쓰면 안 된다. */
    selectedResult?: { code: number; name: string; hierarchy?: CommerceCategoryPathResult } | null;
    manualOverride: boolean;
    evidence: string[];
    /** Sprint A-5(Category Resolver 3.0) — predict 결과가 AUTO_SELECT(유사도
     * 95%+)/RECOMMEND(정상이지만 자동선택 기준 미달)/REJECT(명백히 다른
     * 도메인이라 후보로 채택 안 함) 중 무엇이었는지. 대시보드 KPI(Reject
     * Rate/Resolver Accuracy)가 이 값을 집계한다. */
    resolverDecision?: "AUTO_SELECT" | "RECOMMEND" | "REJECT" | null;
    /** predictResult가 채택됐을 때 scoreCategoryCandidate가 매긴 0~100 유사도. */
    similarityScore?: number | null;
  };
  sku: ProvenanceField<string>;
  description: ProvenanceField<string>;
  material: ProvenanceField<string>;
  /** P0 Epic 1(Resolver 확장) — 옵션(Color 그룹)과 별개로, 상품 설명에 "Colour -
   * Green" 처럼 단일 대표 색상이 문장으로 적혀 있을 때만 채운다. 옵션에 색상
   * 그룹이 있으면 그쪽이 우선(더 정확함) — 이 필드는 옵션이 없는 단일 색상
   * 상품, 또는 고시정보처럼 "대표 색상 하나만" 필요한 곳에 쓴다. */
  color: ProvenanceField<string>;
  /** "2-3 years", "6-12 months" 같은 권장 사용연령 — 원문에 실제로 적혀 있을
   * 때만 채운다(REQUIRED 기본값 그대로 두는 게 기본, 지어내지 않는다). */
  recommendedAge: ProvenanceField<string>;
  /** "Imported by X"/"Manufactured by X" — 브랜드와 다른 개념(브랜드는 판매
   * 브랜드명, 제조자는 실제 제조/수입 주체)이라 별도 필드로 둔다. */
  manufacturer: ProvenanceField<string>;
  /** "Machine wash cold", "Dry clean only" 같은 표준 케어 라벨 — 쿠팡
   * 고시정보의 "세탁방법"/"취급방법 및 취급시 주의사항"에 그대로 쓴다. */
  careInstructions: ProvenanceField<string>;
  /** @deprecated optionGroups[].name으로 대체됐다 — 이름만 필요한 기존 코드
   * (예: 검색태그)는 계속 이 필드를 쓸 수 있게 남겨뒀지만, 새 코드는
   * optionGroups/variants를 써야 한다. crawler가 optionGroups를 채우면 이 값은
   * optionGroups.map(g => g.name)과 항상 같다. */
  options: ProvenanceField<string[]>;
  /** 옵션 축 정의(Size/Colour 등 이름 + 선택 가능한 값 목록) — 플랫폼 어댑터가
   * 등록 화면의 "구매옵션"을 구성하는 데 쓴다. 옵션이 없는 상품은 빈 배열. */
  optionGroups: CanonicalProductOptionGroup[];
  /** optionGroups의 실제 조합별 판매 단위(SKU/가격/재고/이미지). 옵션이 없는
   * 상품은 빈 배열 — "옵션 없음"과 "옵션은 있는데 조합 정보를 못 가져옴"을
   * 구분하기 위해 optionGroups가 비어있지 않은데 variants가 비어있는 상태도
   * 유효하다(어댑터가 이 경우 "옵션 미확정"으로 표시해야 한다). */
  variants: CanonicalProductVariant[];
  images: CanonicalProductImage[];
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
  /** N-3.29(CPO 지시) — "수입사명". 원산지가 수입산으로 확정됐을 때만 스펙상
   * 필수(originAreaInfo.importer). manufacturer(제조자)/브랜드/원산지 어떤
   * 필드와도 개념이 다르고 원본 사이트에 나오는 정보가 아니라, 항상 사용자가
   * Editor에서 직접 입력해야 한다 — 다른 필드에서 자동 추론하지 않는다(CPO
   * 지시: "임의 필드 재활용 금지"). */
  importer: ProvenanceField<string>;
  /** N-3.29(CPO 지시) — 어린이제품(CHILD_CERTIFICATION) 인증 카테고리에서만
   * 의미가 있다. CartPilot은 실제 인증 취득 여부를 알 수 없어 항상 사용자가
   * 직접 입력해야 하고(임의 값/면제 추정 금지), 값이 없으면 null이다. */
  childCertification: ProvenanceField<CanonicalProductCertification | null>;
  /** N-3.44 — Naver KIDS 고시정보(공식 스펙, docs/naver-provided-notice-types-raw.json
   * 확인) 필수 필드 중 N-3.43까지 CartPilot에 입력 경로가 없던 4개. 상품
   * 원문에 실제로 있으면 추출하고, 없으면 등록 화면에서 사용자가 직접 입력한다
   * (임의 값 금지 — 다른 필드에서 추론하지 않는다). Coupang 등 KIDS 고시정보가
   * 없는 커머스에서는 그냥 빈 값으로 둔다(등록을 막지 않음). */
  /** 품명(Naver: itemName) — brand/title과 다른 개념. 상품 자체의 품목명. */
  itemName: ProvenanceField<string>;
  /** 모델명(Naver: modelName). */
  modelName: ProvenanceField<string>;
  /** 중량(Naver: weight) — 섬유제품은 치수 정보로 대체 가능(스펙 명시)이라
   * size로 채워져 있으면 이 필드가 비어 있어도 등록 자체는 막지 않는다. */
  weight: ProvenanceField<string>;
  /** KC 인증정보 설명 텍스트(Naver: certificationType, 예: "공급자적합성확인
   * 대상"). childCertification(실제 인증서 번호/업체명/취득일자)과는 다른
   * 필드다 — 스펙상 별도로 존재한다. */
  certificationType: ProvenanceField<string>;
}

function emptyField<T>(value: T): ProvenanceField<T> {
  return { value, source: "REQUIRED", confidence: 0 };
}

/**
 * N-3.52 QA에서 발견 — 신규 필드가 추가되기 전에 저장된 스냅샷(product_snapshots의
 * workspace.canonicalProduct JSON)을 복원하면 그 필드가 실제로 undefined라
 * PlatformPreview의 ReferenceEligibleFieldRow 등이 field.source를 읽다가
 * 그대로 크래시했다(예: itemName/modelName/weight는 N-3.44, importer는
 * N-3.29, certificationType은 N-3.48에 추가돼 그 이전 스냅샷엔 아예 키가 없다).
 * 스냅샷을 화면에 다시 로드하는 지점(apps/admin/src/app/pipeline/page.tsx)에서
 * 이 함수를 거치면, 스키마가 앞으로 또 늘어도 과거 스냅샷이 안전하게 열린다 —
 * 값을 지어내지 않고 REQUIRED(또는 빈 배열)로만 채운다.
 */
/** N-3.54 — priceValidity가 없던 과거 스냅샷(이 필드 도입 이전 저장분)은 이미
 * 저장된 price.value(amount/currency)로부터 같은 규칙(resolveSourcePrice와
 * 동일 판정: 통화 없으면 MISSING, 금액 0 이하면 INVALID, 그 외 VALID)을
 * 역산해 채운다 — 새 값을 지어내는 게 아니라 이미 있던 값을 그대로 재해석할
 * 뿐이다. */
function inferLegacyPriceValidity(price: { amount: number; currency: string }): "VALID" | "MISSING" | "INVALID" {
  if (!price.currency) return "MISSING";
  if (!Number.isFinite(price.amount) || price.amount <= 0) return "INVALID";
  return "VALID";
}

export function backfillCanonicalProduct(raw: CanonicalProduct): CanonicalProduct {
  return {
    ...raw,
    priceValidity: raw.priceValidity ?? inferLegacyPriceValidity(raw.price.value),
    careInstructions: raw.careInstructions ?? emptyField(""),
    options: raw.options ?? emptyField([]),
    optionGroups: raw.optionGroups ?? [],
    variants: raw.variants ?? [],
    images: raw.images ?? [],
    titleKo: raw.titleKo ?? emptyField(""),
    descriptionKo: raw.descriptionKo ?? emptyField(""),
    keywords: raw.keywords ?? emptyField([]),
    seoTitle: raw.seoTitle ?? emptyField(""),
    seoDescription: raw.seoDescription ?? emptyField(""),
    countryOfOrigin: raw.countryOfOrigin ?? emptyField(""),
    returnPolicy: raw.returnPolicy ?? emptyField(""),
    shippingFee: raw.shippingFee ?? emptyField(0),
    stockQuantity: raw.stockQuantity ?? emptyField(0),
    certification: raw.certification ?? emptyField(""),
    importer: raw.importer ?? emptyField(""),
    childCertification: raw.childCertification ?? emptyField(null),
    itemName: raw.itemName ?? emptyField(""),
    modelName: raw.modelName ?? emptyField(""),
    weight: raw.weight ?? emptyField(""),
    certificationType: raw.certificationType ?? emptyField(""),
  };
}

/** N-3.29 — Naver productCertificationInfos(공식 OpenAPI 확인됨,
 * packages/listing/src/naver/types.ts의 NaverProductCertificationInfo 참고)
 * 중 CartPilot이 실제로 입력받을 수 있는 최소 하위 집합. certificationInfoId
 * (카테고리별 인증 유형 카탈로그 id)는 카테고리 API가 결정하는 값이라 여기 넣지
 * 않는다 — 이건 상품이 아니라 카테고리에 속한 값이다. */
export interface CanonicalProductCertification {
  certificationNumber: string;
  companyName: string;
  certificationDate: string;
  /** N-3.67(2026-08-20, 정적 스키마 재추적으로 확인) — Naver 공식 스펙의
   * ExternalApiProductCertificationInfoVo.product는 required 배열에
   * `name`("인증 기관명" — 인증서를 발급한 기관/업체명, `companyName`
   * "인증 상호명"과는 다른 개념)을 포함하고, 이 요구사항은 어린이제품
   * "공급자적합성" 유형(certificationInfoId=1042)에서만 비필수로 예외
   * 처리된다. 이전까지 이 필드를 아예 채운 적이 없었다 — 지금까지 실측
   * 시도에서 kindType이 안전확인/안전인증(1041/1040, 예외 대상 아님)일 때
   * 이 필드가 빠진 게 원인일 가능성이 있어 추가한다. */
  name?: string;
}

/**
 * @commerce/marketplace와 @commerce/category 둘 다 이 id로 플랫폼을 구분한다.
 * marketplace가 category를 참조하고(ListingModel이 CategorySelection을 들고 있음)
 * category는 marketplace를 참조하지 않는 단방향 의존이라, 순환 참조를 피하려면
 * PlatformId는 둘 다의 하위 의존인 shared에 있어야 한다.
 */
export type PlatformId = "smartstore" | "coupang" | "elevenst";
