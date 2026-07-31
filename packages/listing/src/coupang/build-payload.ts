import type { ListingModel } from "@commerce/marketplace";
import type { CategorySelection } from "@commerce/category";
import type { CanonicalProduct, CanonicalProductOptionGroup, CanonicalProductVariant } from "@commerce/shared";
import { getSelectedImageUrl } from "@commerce/shared";
import { convertToKrw } from "@commerce/pricing";

/**
 * 쿠팡 Open API "상품 생성"(POST .../v1/marketplace/seller-products) 요청 바디를
 * developers.coupang.com 공식 문서(Product Creation, 2026-07 확인)로 검증한 필드
 * 구조 그대로 따른다. 이전 버전(v1/v2)은 문서 확인 전 CartPilot 데이터만 보고
 * 만든 best-effort였다 — 최상위 필드가 items[] 밖에 있던 것, deliveryChargeType에
 * CHARGE_RECEIVED/CONDITIONAL_FREE가 빠졌던 것, 반품지/발송지/배송사 같은 판매자
 * 계정 설정 필드가 아예 없었던 것 등이 이번에 고쳐졌다.
 *
 * CartPilot이 값을 만들어낼 수 없는 필드(반품지 코드, 발송지 코드, 배송사 코드,
 * 담당자 연락처 등 — 전부 쿠팡 Wing에 판매자가 미리 등록해둔 값이다)는 여기서
 * 추측하지 않는다. sellerConfig로 주입받고, 없으면 빈 값으로 채워서 실제 등록
 * 직전 검증 단계(register 라우트)가 VALIDATION_ERROR로 명확히 막게 한다.
 */
export interface CoupangSellerConfig {
  vendorId: string;
  /** 쿠팡 Wing 로그인 아이디(계정ID) — access/secret key와는 다른 값이다. */
  vendorUserId: string;
  /** 택배사 코드 — 쿠팡이 정의한 courier code(예: CJGLS). */
  deliveryCompanyCode: string;
  /** Wing에 등록된 반품지 코드. 없으면 "NO_RETURN_CENTERCODE". */
  returnCenterCode: string;
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  /** Wing에 등록된 출고지(발송지) 코드. */
  outboundShippingPlaceCode: number | null;
}

export const BLANK_COUPANG_SELLER_CONFIG: CoupangSellerConfig = {
  vendorId: "",
  vendorUserId: "",
  deliveryCompanyCode: "",
  returnCenterCode: "",
  returnChargeName: "",
  companyContactNumber: "",
  returnZipCode: "",
  returnAddress: "",
  returnAddressDetail: "",
  outboundShippingPlaceCode: null,
};

export interface CoupangItemImage {
  imageOrder: number;
  imageType: "REPRESENTATION" | "DETAIL";
  vendorPath: string;
}

export interface CoupangContentDetail {
  content: string;
  detailType: "TEXT" | "IMAGE";
}

export interface CoupangItemContent {
  contentsType:
    | "TEXT"
    | "IMAGE"
    | "IMAGE_NO_SPACE"
    | "IMAGE_TEXT"
    | "TEXT_IMAGE"
    | "IMAGE_IMAGE"
    | "TEXT_TEXT"
    | "TITLE"
    | "HTML";
  contentDetails: CoupangContentDetail[];
}

export interface CoupangItemNotice {
  noticeCategoryName?: string;
  noticeCategoryDetailName?: string;
  content?: string;
}

export interface CoupangItemAttribute {
  attributeTypeName: string;
  attributeValueName: string;
}

export interface CoupangItem {
  itemName: string;
  originalPrice: number;
  salePrice: number;
  /** 원본 사이트의 옵션별 SKU(variant.sku) — 옵션이 없는 상품은 없음. */
  externalVendorSku?: string;
  maximumBuyCount: number;
  maximumBuyForPerson: number;
  maximumBuyForPersonPeriod: number;
  outboundShippingTimeDay: number;
  unitCount: number;
  adultOnly: "ADULT_ONLY" | "EVERYONE";
  taxType: "TAX" | "FREE";
  parallelImported: "PARALLEL_IMPORTED" | "NOT_PARALLEL_IMPORTED";
  overseasPurchased: "OVERSEAS_PURCHASED" | "NOT_OVERSEAS_PURCHASED";
  pccNeeded: boolean;
  images: CoupangItemImage[];
  /** 카테고리별 필수 구매옵션(색상/사이즈 등) — 쿠팡 카테고리 메타정보 조회 API를
   * 아직 연동하지 않아 항상 빈 배열이다. 카테고리가 필수 attributes를 요구하면
   * 실제 쿠팡 API가 COUPANG_API_ERROR로 등록을 거부한다 — 추측값을 채워 넣는
   * 것보다 정직하게 실패시키고 사용자에게 원인을 그대로 보여주는 쪽을 택했다. */
  attributes: CoupangItemAttribute[];
  /** 카테고리별 고시정보(원산지, 품질보증기준 등) — attributes와 같은 이유로 빈
   * 배열이다. */
  notices: CoupangItemNotice[];
  contents: CoupangItemContent[];
  searchTags: string[];
}

export interface CoupangPayload {
  displayCategoryCode: number | null;
  /** 공식 스키마 필드가 아니다 — Payload Inspector가 카테고리 경로를 사람이 읽을
   * 수 있게 보여주기 위한 CartPilot 전용 참고 필드. */
  displayCategoryPath: string[] | null;
  sellerProductName: string;
  vendorId: string;
  saleStartedAt: string;
  saleEndedAt: string;
  brand?: string;
  /** 브랜드명 문자열만 보내면 실제 쿠팡 API가 거부한다("브랜드 ID가 필요합니다",
   * 실등록 시도로 확인) — Wing 브랜드 관리에 등록된 brandId가 있어야 한다.
   * register 라우트가 Brand Search API로 조회해서 채운다. */
  brandId?: string;
  generalProductName?: string;
  /** SEQUENCIAL(일반배송)/COLD_FRESH(신선냉동)/MAKE_ORDER(주문제작)/AGENT_BUY(구매대행)/
   * VENDOR_DIRECT(설치배송/판매자직배송) 중 하나 — CartPilot은 전량 해외구매대행이라
   * 항상 AGENT_BUY다(developers.coupang.com "How can I list products as an overseas
   * buying agent?" 문서로 확인). AGENT_BUY를 쓰면 출고지가 반드시 해외 주소여야
   * 하고(우리 계정 출고지는 전부 해외라 이미 맞음), pccNeeded도 true여야 한다. */
  deliveryMethod: "AGENT_BUY";
  deliveryCompanyCode: string;
  deliveryChargeType: "FREE" | "NOT_FREE" | "CHARGE_RECEIVED" | "CONDITIONAL_FREE";
  deliveryCharge: number;
  freeShipOverAmount: number;
  deliveryChargeOnReturn: number;
  remoteAreaDeliverable: "Y" | "N";
  unionDeliveryType: "UNION_DELIVERY" | "NOT_UNION_DELIVERY";
  returnCenterCode: string;
  returnChargeName: string;
  companyContactNumber: string;
  returnZipCode: string;
  returnAddress: string;
  returnAddressDetail: string;
  returnCharge: number;
  outboundShippingPlaceCode: number | null;
  vendorUserId: string;
  /** true면 등록과 동시에 쿠팡 승인을 자동 요청한다. CartPilot은 항상 false로
   * 보낸다 — "실제 상품 1개만, 사람이 Wing에서 최종 확인 후 승인 요청"이라는
   * 이번 Mission의 안전 원칙과 맞춘다. */
  requested: boolean;
  items: CoupangItem[];
  /** 공식 필드가 아니다 — 환율 추정가인지 CartPilot UI가 표시하기 위한 참고 필드. */
  priceIsEstimate: boolean;
  /** 공식 필드가 아니다 — Sprint B Compliance Report(0~100점, "사용자 입력 필요"
   * 목록)를 만드는 재료. items[]가 여러 개(옵션별)면 전부 합쳐서 담는다. */
  complianceFieldResults: ComplianceFieldResult[];
}

function formatCoupangDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 상품마다 바뀌지 않는 고정 문구(배송/교환/반품/구매대행/A·S 안내)를 한 번만
 * 등록해두고 재사용하기 위한 템플릿 — apps/admin의 description-template.ts가
 * Supabase CRUD를 담당하고, 실제 병합 로직은 여기(순수 함수)에 둔다. 필드가
 * 비어 있으면 그 섹션은 건너뛴다 — 템플릿은 등록을 막는 필수 관문이 아니라
 * 품질을 높이는 보강재다. */
export interface CoupangDescriptionTemplate {
  shippingInfo?: string;
  exchangeInfo?: string;
  returnInfo?: string;
  agentBuyInfo?: string;
  asInfo?: string;
}

export function mergeCoupangDescription(
  aiDescription: string,
  template: CoupangDescriptionTemplate | null | undefined,
): string {
  if (!template) return aiDescription;

  const sections = [
    { label: "배송안내", content: template.shippingInfo ?? "" },
    { label: "교환안내", content: template.exchangeInfo ?? "" },
    { label: "반품안내", content: template.returnInfo ?? "" },
    { label: "구매대행 안내", content: template.agentBuyInfo ?? "" },
    { label: "A/S 안내", content: template.asInfo ?? "" },
  ].filter((section) => section.content.trim().length > 0);

  if (sections.length === 0) return aiDescription;

  const templateText = sections.map((s) => `[${s.label}]\n${s.content.trim()}`).join("\n\n");
  return aiDescription.trim().length > 0 ? `${aiDescription.trim()}\n\n${templateText}` : templateText;
}

/** listing.category.candidate.id는 대부분 CartPilot 내부 카테고리 id다 — 실제
 * 쿠팡 숫자 코드로 쓸 수 있는 건 /api/coupang/category-recommend가 만든
 * candidate(isVerifiedPlatformCode: true)를 사용자가 SELECTED/CONFIRMED로
 * 확정했을 때뿐이다. 그 외에는 추측하지 않고 null로 둔다. register 라우트가
 * 카테고리 메타정보(attributes/notices)를 조회할 때도 이 함수로 같은 코드를
 * 얻어야 한다 — buildCoupangPayload 내부와 결과가 어긋나면 안 된다. */
export function resolveVerifiedCategoryCode(category: CategorySelection): number | null {
  const isCategoryConfirmed = category.state === "SELECTED" || category.state === "CONFIRMED";
  const verifiedCandidate =
    isCategoryConfirmed && category.candidate?.isVerifiedPlatformCode ? category.candidate : null;
  return verifiedCandidate ? Number(verifiedCandidate.id) : null;
}

export interface CoupangCategoryAttributeMeta {
  attributeTypeName: string;
  dataType: string;
  inputType: string;
  inputValues: string[];
  /** NUMBER 타입일 때 값에 붙여야 하는 단위(예: "개") — "없음"이면 단위가 없다는
   * 뜻이라 값에 붙이지 않는다(실제 등록 시도로 확인: 단위를 안 붙이면 "유효하지
   * 않은 구매 옵션 값 혹은 단위가 존재합니다"로 거부됨). */
  basicUnit: string;
  required: "MANDATORY" | "OPTIONAL";
}

export interface CoupangCategoryNoticeMeta {
  noticeCategoryName: string;
  noticeCategoryDetailNames: { noticeCategoryDetailName: string; required: "MANDATORY" | "OPTIONAL" }[];
}

export interface CoupangCategoryMeta {
  attributes: CoupangCategoryAttributeMeta[];
  noticeCategories: CoupangCategoryNoticeMeta[];
}

const NOTICE_DEFAULT_CONTENT = "상세페이지 참조";

/** 쿠팡 구매옵션/고시정보 이름(예: "패션의류/잡화 사이즈", "색상", "재질")과 원본
 * 데이터(옵션 그룹명 또는 CanonicalProduct 필드)를 동의어로 느슨하게 매칭한다 —
 * 플랫폼마다 이름이 전부 달라서(P0-2 조사) 정확히 일치하는 경우가 드물다. */
const SIZE_SYNONYMS = ["사이즈", "size"];
const COLOR_SYNONYMS = ["색상", "컬러", "color", "colour"];
const MATERIAL_SYNONYMS = ["재질", "소재", "material"];
const COUNTRY_SYNONYMS = ["제조국", "원산지", "country"];
/** Sprint A-2(Auto Fill 매핑 엔진) — CPO가 1차 자동 매핑 대상으로 명시한
 * "브랜드"가 원래 빠져 있었다(구매옵션/고시정보 이름에 "브랜드"가 나오는
 * 카테고리가 있다 — 예: 잡화류). */
const BRAND_SYNONYMS = ["브랜드", "brand"];
/** P0 Epic 1/4(Resolver 확장) — color/recommendedAge/manufacturer/careInstructions도
 * material/countryOfOrigin과 같은 패턴으로 matchProductField에 추가한다. COLOR_SYNONYMS는
 * matchOptionValue(옵션 그룹 매칭)에서도 이미 쓰고 있으므로 재사용 — 옵션에 색상 그룹이
 * 있으면 그쪽이 항상 우선(matchOptionValue가 먼저 시도됨)이고, 이건 옵션이 없을 때의
 * 폴백이다. */
const AGE_SYNONYMS = ["사용연령", "연령", "age"];
const MANUFACTURER_SYNONYMS = ["제조자", "수입자", "manufacturer"];
const CARE_SYNONYMS = ["세탁방법", "취급방법", "취급시 주의사항", "care"];
/** KC 인증정보처럼 법적/컴플라이언스 성격이 강한 필드 — 플레이스홀더로 채워지면
 * Compliance Report가 다른 필드보다 무겁게(FAIL 수준으로) 취급해야 한다. */
const COMPLIANCE_CRITICAL_SYNONYMS = ["kc", "인증"];

function isComplianceCritical(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return COMPLIANCE_CRITICAL_SYNONYMS.some((s) => lower.includes(s));
}

/** Sprint C(Category Resolver) — "필수 항목이 가장 적은 카테고리"를 무조건
 * 고르면 점수는 잘 나오지만, 유아동 상품인데 KC 인증정보가 필요 없는 "기타
 * 재화"로 등록되는 컴플라이언스 리스크가 생긴다(실제 등록 역검증에서 확인된
 * 문제). 상품명에 이 키워드가 있으면 점수가 당장 낮아지더라도(필수 항목이
 * 5개→14개로 늘어난다) "어린이제품" 고시정보 카테고리를 우선한다 — 점수보다
 * 정확도가 우선이라는 원칙. */
const CHILDREN_PRODUCT_KEYWORDS = ["baby", "babies", "kids", "child", "children", "toddler", "infant", "아동", "유아", "키즈"];

function isLikelyChildrenProduct(productName: string): boolean {
  const lower = productName.toLowerCase();
  return CHILDREN_PRODUCT_KEYWORDS.some((k) => lower.includes(k));
}

/** 쿠팡 필드 이름(예: "패션의류/잡화 사이즈")이 사이즈/색상 계열 동의어와
 * 매칭되면, 그 이름에 대응하는 CanonicalProduct.optionGroups 그룹(실제 옵션
 * 값 목록)을 찾는다. matchOptionValue(값 하나를 확정하는 용도)와
 * CategoryRequirementsEditor(값을 아직 못 정했을 때 select로 고를 목록을
 * 보여주는 용도) 양쪽이 이 하나의 매칭 규칙만 쓴다 — 매칭 로직이 두 곳에
 *따로 있으면 서버 판단과 화면 판단이 어긋나는 CP001과 같은 문제가 재발한다. */
function findMatchingOptionGroup(
  fieldName: string,
  optionGroups: CanonicalProductOptionGroup[],
): CanonicalProductOptionGroup | undefined {
  const lower = fieldName.toLowerCase();
  const synonyms = SIZE_SYNONYMS.some((s) => lower.includes(s))
    ? SIZE_SYNONYMS
    : COLOR_SYNONYMS.some((s) => lower.includes(s))
      ? COLOR_SYNONYMS
      : null;
  if (!synonyms) return undefined;
  return optionGroups.find((g) => synonyms.some((s) => g.name.toLowerCase().includes(s)));
}

/** Sprint A-2(Auto Fill 완성도) — CategoryRequirementsEditor가 아직 값을 못
 * 정한 사이즈/색상류 필드에 자유 입력 대신 실제 옵션 값 목록으로 select를
 * 보여줄 때 쓴다(타이핑 대신 클릭 한 번). */
export function findMatchingOptionGroupValues(
  fieldName: string,
  optionGroups: CanonicalProductOptionGroup[],
): string[] | undefined {
  return findMatchingOptionGroup(fieldName, optionGroups)?.values;
}

function matchOptionValue(
  fieldName: string,
  optionGroups: CanonicalProductOptionGroup[],
  variant: CanonicalProductVariant | undefined,
): string | undefined {
  const matchedGroup = findMatchingOptionGroup(fieldName, optionGroups);
  if (!matchedGroup) return undefined;
  if (variant) return variant.optionValues[matchedGroup.name];
  // variant가 없는 경우(옵션 조합을 못 뽑아서 단일 item으로 등록되는 상품)라도,
  // 그 옵션 그룹의 실제 값이 하나뿐이면 "지어내는" 게 아니라 "유일하게 가능한
  // 값을 그대로 쓰는" 것이라 안전하다. 값이 여러 개면(어떤 옵션인지 확정할 수
  // 없음) 여기서 고르지 않는다 — findMatchingOptionGroupValues로 실제 후보
  // 목록을 보여주고 사용자가 직접 고르게 한다.
  return matchedGroup.values.length === 1 ? matchedGroup.values[0] : undefined;
}

/** CanonicalProduct.material/countryOfOrigin이 실제로 채워져 있을 때만(크롤러가
 * 못 뽑아오면 거의 항상 빈 문자열이다 — 대부분 여전히 플레이스홀더로 남는다는
 * 뜻) "재질"/"제조국" 계열 필드에 실제 값을 준다. */
function matchProductField(
  fieldName: string,
  productFields: {
    brand?: string;
    material?: string;
    countryOfOrigin?: string;
    color?: string;
    recommendedAge?: string;
    manufacturer?: string;
    careInstructions?: string;
  },
): string | undefined {
  const lower = fieldName.toLowerCase();
  if (BRAND_SYNONYMS.some((s) => lower.includes(s)) && productFields.brand) {
    return productFields.brand;
  }
  if (MATERIAL_SYNONYMS.some((s) => lower.includes(s)) && productFields.material) {
    return productFields.material;
  }
  if (COUNTRY_SYNONYMS.some((s) => lower.includes(s)) && productFields.countryOfOrigin) {
    return productFields.countryOfOrigin;
  }
  if (COLOR_SYNONYMS.some((s) => lower.includes(s)) && productFields.color) {
    return productFields.color;
  }
  if (AGE_SYNONYMS.some((s) => lower.includes(s)) && productFields.recommendedAge) {
    return productFields.recommendedAge;
  }
  if (MANUFACTURER_SYNONYMS.some((s) => lower.includes(s)) && productFields.manufacturer) {
    return productFields.manufacturer;
  }
  if (CARE_SYNONYMS.some((s) => lower.includes(s)) && productFields.careInstructions) {
    return productFields.careInstructions;
  }
  return undefined;
}

/** 값 하나가 어디서 왔는지 — Compliance Report(Sprint B)가 이 출처로 점수를 매긴다.
 * OPTION_MATCH/PRODUCT_FIELD/KNOWN_VALUE/DETERMINISTIC은 전부 "실제 근거가 있는
 * 값"이고, PLACEHOLDER만 "지어내지 않기 위해 넣은 자리표시자"다. */
export type ComplianceFieldSource =
  | "USER_INPUT"
  | "OPTION_MATCH"
  | "PRODUCT_FIELD"
  | "KNOWN_VALUE"
  | "DETERMINISTIC"
  | "PLACEHOLDER";

export interface ComplianceFieldResult {
  fieldName: string;
  value: string;
  source: ComplianceFieldSource;
  /** KC/인증 관련이라 플레이스홀더면 특히 중요하게(FAIL 수준으로) 취급해야 하는지. */
  critical: boolean;
  /** buildComplianceReport가 requiredAttributeRate/requiredNoticeRate를 나눠
   * 계산할 수 있도록 구매옵션(attribute)인지 고시정보(notice)인지 표시한다. */
  kind: "ATTRIBUTE" | "NOTICE";
  /** Sprint C(Epic 5) — 0~1. 값의 출처별로 고정 배정한다(추측해서 세밀하게
   * 매기지 않는다 — 근거 없는 정밀도는 오히려 신뢰를 떨어뜨린다):
   * KNOWN_VALUE=1(CartPilot이 실제로 아는 값), OPTION_MATCH=0.95(선택된 옵션
   * 값 그대로), DETERMINISTIC=0.9(항상 맞는 고정값), PRODUCT_FIELD=0.8(정규식
   * 등으로 원문에서 뽑은 값 — 패턴이 못 잡는 표기법도 있어 완벽하진 않음),
   * PLACEHOLDER=0.1(자리표시자, 사실상 "모른다"). */
  confidence: number;
}

const FIELD_SOURCE_CONFIDENCE: Record<ComplianceFieldSource, number> = {
  USER_INPUT: 1,
  KNOWN_VALUE: 1,
  OPTION_MATCH: 0.95,
  DETERMINISTIC: 0.9,
  PRODUCT_FIELD: 0.8,
  PLACEHOLDER: 0.1,
};

/** 카테고리별 필수 고시정보(notices)/구매옵션(attributes)을 채운다. 실제 값을 알 수
 * 없는 필드(제조국/인증사항 등)는 추측해서 지어내지 않고 쿠팡이 넓게 허용하는
 * "상세페이지 참조"를 쓴다 — 연락처처럼 CartPilot이 실제로 갖고 있는 값은 그대로
 * 채운다. noticeCategories가 여러 개면 필수 항목이 가장 적은(=충족하기 가장
 * 단순한) 카테고리를 고른다 — 특정 카테고리를 강제로 골라야 할 근거가 없다.
 * 채운 값마다 출처(attributeResults/noticeResults)도 함께 반환한다 — Compliance
 * Report가 "이 값이 진짜인지 자리표시자인지"를 판단하는 데 쓴다.
 *
 * Sprint A-2(Auto Fill 매핑 엔진) — 필드마다 각자 규칙을 만들지 않고, 모든
 * attribute/notice가 아래 하나의 우선순위를 그대로 통과한다(CPO 요구사항:
 * "필드별 규칙이 제각각 생기면 유지보수가 어렵다"). 이 함수 안의
 * .map() 블록 두 개(attribute용/notice용)가 실제 구현이고, 이 순서를
 * 벗어나는 매칭은 없다:
 *
 *   1. USER_INPUT      — context.userOverrides (CPO가 부른 "Category Override"와
 *                         같은 것 — 화면에서 사람이 직접 채운 값이라는 뜻으로,
 *                         이 함수 안에서는 한 이름(USER_INPUT)만 쓴다.)
 *   2. VARIANT          — matchOptionValue: 선택된 옵션 조합(variant)의 실제 값.
 *                         소스 이름은 OPTION_MATCH.
 *   3. CANONICAL_PRODUCT — matchProductField: CanonicalProduct 필드(브랜드/재질/
 *                         제조국/색상/사용연령/제조자/세탁방법). 이 필드들 자체는
 *                         크롤러(Extractor)가 원문에서 뽑았거나 Resolver(P0 Epic 1/4)가
 *                         정규식/휴리스틱으로 뽑은 값이다 — 소스 이름은 PRODUCT_FIELD.
 *   4. KNOWN_VALUE       — 품명/연락처처럼 CartPilot이 문자 그대로 이미 들고 있는 값.
 *   5. DETERMINISTIC     — NUMBER 타입 기본값("1개") · 허용값 목록의 첫 값처럼
 *                         "항상 맞는 규칙"으로 정하는 값(실제로 아는 값은 아니다).
 *   6. AI                — 아직 없다. 크롤링/정규식으로 못 찾은 값을 LLM이 추론해서
 *                         채우는 단계인데, 근거 없이 지어낸 값을 컴플라이언스 필드에
 *                         넣는 건 이 코드베이스의 "지어내지 않는다" 원칙과 정면으로
 *                         충돌한다(NOTICE_DEFAULT_CONTENT 주석 참고) — 이번 스프린트
 *                         범위에서 의도적으로 제외했다. 필요해지면 낮은 confidence로
 *                         별도 소스("AI_INFERRED")를 추가하고 반드시 사용자 확인을
 *                         거치게 해야 한다.
 *   7. EMPTY(PLACEHOLDER) — 아무것도 못 찾은 경우. 화면에서 빨간 "*"로 표시되고
 *                         사용자 입력을 요청한다.
 *
 * KC 인증번호/수입자/A/S 연락처/인증기관은 이 매핑에서 의도적으로 제외한다 —
 * CartPilot이 원본 사이트에서 알 수 없는, 반드시 사람이 확인해야 하는 정보다. */
export function buildCoupangCompliance(
  categoryMeta: CoupangCategoryMeta | null | undefined,
  context: {
    productName: string;
    contactNumber: string;
    brand?: string;
    material?: string;
    countryOfOrigin?: string;
    color?: string;
    recommendedAge?: string;
    manufacturer?: string;
    careInstructions?: string;
    /** P0(Category Meta -> 동적 입력폼) — 사용자가 등록 전 화면에서 직접 채운
     * 구매옵션/고시정보 값. attributeTypeName 또는 noticeCategoryDetailName을
     * 키로 쓴다(둘이 이름이 겹칠 일은 실무상 없다 — 겹치면 attribute가 먼저
     * 매칭된다). 사람이 직접 입력한 값이라 다른 어떤 자동 매칭보다 우선한다. */
    userOverrides?: Record<string, string>;
  },
  variantContext: { optionGroups: CanonicalProductOptionGroup[]; variant?: CanonicalProductVariant } = {
    optionGroups: [],
  },
): {
  attributes: CoupangItemAttribute[];
  notices: CoupangItemNotice[];
  attributeResults: ComplianceFieldResult[];
  noticeResults: ComplianceFieldResult[];
} {
  if (!categoryMeta) return { attributes: [], notices: [], attributeResults: [], noticeResults: [] };

  const attributeResults: ComplianceFieldResult[] = categoryMeta.attributes
    .filter((attr) => attr.required === "MANDATORY")
    .map((attr) => {
      const userOverride = context.userOverrides?.[attr.attributeTypeName];
      if (userOverride) {
        return {
          fieldName: attr.attributeTypeName,
          value: userOverride,
          source: "USER_INPUT" as const,
          critical: false,
          kind: "ATTRIBUTE" as const,
        };
      }
      const optionValue = matchOptionValue(attr.attributeTypeName, variantContext.optionGroups, variantContext.variant);
      if (optionValue) {
        return {
          fieldName: attr.attributeTypeName,
          value: optionValue,
          source: "OPTION_MATCH" as const,
          critical: false,
          kind: "ATTRIBUTE" as const,
        };
      }
      const productFieldValue = matchProductField(attr.attributeTypeName, context);
      if (productFieldValue) {
        return {
          fieldName: attr.attributeTypeName,
          value: productFieldValue,
          source: "PRODUCT_FIELD" as const,
          critical: false,
          kind: "ATTRIBUTE" as const,
        };
      }
      if (attr.dataType === "NUMBER") {
        const unit = attr.basicUnit && attr.basicUnit !== "없음" ? attr.basicUnit : "";
        return {
          fieldName: attr.attributeTypeName,
          value: `1${unit}`,
          source: "DETERMINISTIC" as const,
          critical: false,
          kind: "ATTRIBUTE" as const,
        };
      }
      return {
        fieldName: attr.attributeTypeName,
        value: attr.inputValues[0] ?? NOTICE_DEFAULT_CONTENT,
        source: attr.inputValues[0] ? ("DETERMINISTIC" as const) : ("PLACEHOLDER" as const),
        critical: isComplianceCritical(attr.attributeTypeName),
        kind: "ATTRIBUTE" as const,
      };
    })
    .map((r) => ({ ...r, confidence: FIELD_SOURCE_CONFIDENCE[r.source] }));
  const attributes: CoupangItemAttribute[] = attributeResults.map((r) => ({
    attributeTypeName: r.fieldName,
    attributeValueName: r.value,
  }));

  const simplestNoticeCategory = [...categoryMeta.noticeCategories].sort(
    (a, b) => a.noticeCategoryDetailNames.length - b.noticeCategoryDetailNames.length,
  )[0];
  const childrenNoticeCategory = categoryMeta.noticeCategories.find((c) => c.noticeCategoryName.includes("어린이"));
  const chosenNoticeCategory =
    isLikelyChildrenProduct(context.productName) && childrenNoticeCategory
      ? childrenNoticeCategory
      : simplestNoticeCategory;

  const KNOWN_NOTICE_VALUES: Record<string, string> = {
    "품명 및 모델명": context.productName,
    "품명": context.productName,
    "소비자상담 관련 전화번호": context.contactNumber,
    "A/S 책임자와 전화번호": context.contactNumber,
  };

  const noticeResults: ComplianceFieldResult[] = chosenNoticeCategory
    ? chosenNoticeCategory.noticeCategoryDetailNames
        .filter((detail) => detail.required === "MANDATORY")
        .map((detail) => {
          const userOverride = context.userOverrides?.[detail.noticeCategoryDetailName];
          if (userOverride) {
            return {
              fieldName: detail.noticeCategoryDetailName,
              value: userOverride,
              source: "USER_INPUT" as const,
              critical: false,
              kind: "NOTICE" as const,
            };
          }
          const known = KNOWN_NOTICE_VALUES[detail.noticeCategoryDetailName];
          if (known) {
            return {
              fieldName: detail.noticeCategoryDetailName,
              value: known,
              source: "KNOWN_VALUE" as const,
              critical: false,
              kind: "NOTICE" as const,
            };
          }
          const productFieldValue = matchProductField(detail.noticeCategoryDetailName, context);
          if (productFieldValue) {
            return {
              fieldName: detail.noticeCategoryDetailName,
              value: productFieldValue,
              source: "PRODUCT_FIELD" as const,
              critical: false,
              kind: "NOTICE" as const,
            };
          }
          return {
            fieldName: detail.noticeCategoryDetailName,
            value: NOTICE_DEFAULT_CONTENT,
            source: "PLACEHOLDER" as const,
            critical: isComplianceCritical(detail.noticeCategoryDetailName),
            kind: "NOTICE" as const,
          };
        })
        .map((r) => ({ ...r, confidence: FIELD_SOURCE_CONFIDENCE[r.source] }))
    : [];
  const notices: CoupangItemNotice[] = chosenNoticeCategory
    ? noticeResults.map((r) => ({
        noticeCategoryName: chosenNoticeCategory.noticeCategoryName,
        noticeCategoryDetailName: r.fieldName,
        content: r.value,
      }))
    : [];

  return { attributes, notices, attributeResults, noticeResults };
}

/** item 하나(옵션 조합 하나)를 만든다 — variant가 있으면 그 옵션 조합 전용
 * itemName/가격/SKU/재고/구매옵션값을 쓰고, 없으면(옵션 없는 상품, 또는 아직
 * variant를 못 뽑는 소스) 상품 전체 값을 그대로 쓴다(기존 동작과 100% 동일). */
function buildCoupangItem(args: {
  product: CanonicalProduct;
  listing: ListingModel;
  sellerConfig: CoupangSellerConfig;
  categoryMeta?: CoupangCategoryMeta | null;
  images: CoupangItemImage[];
  contents: CoupangItemContent[];
  optionGroups: CanonicalProductOptionGroup[];
  variant?: CanonicalProductVariant;
}): { item: CoupangItem; complianceResults: ComplianceFieldResult[] } {
  const { product, listing, sellerConfig, categoryMeta, images, contents, optionGroups, variant } = args;

  const compliance = buildCoupangCompliance(
    categoryMeta,
    {
      productName: listing.title,
      contactNumber: sellerConfig.companyContactNumber,
      brand: product.brand.value || undefined,
      material: product.material.value || undefined,
      countryOfOrigin: product.countryOfOrigin.value || undefined,
      color: product.color.value || undefined,
      recommendedAge: product.recommendedAge.value || undefined,
      manufacturer: product.manufacturer.value || undefined,
      careInstructions: product.careInstructions.value || undefined,
      userOverrides: product.categoryFieldOverrides,
    },
    { optionGroups, variant },
  );

  const optionSuffix = variant ? Object.values(variant.optionValues).join(", ") : "";
  const itemName = optionSuffix ? `${listing.title} - ${optionSuffix}` : listing.title;

  // variant.price가 있으면(옵션마다 가격이 다른 매장) 그 옵션의 실제 가격을
  // 원화로 환산해서 쓴다 — 없으면 listing.priceKrw(상품 전체 대표가)로 폴백한다.
  const priceKrw = variant?.price
    ? convertToKrw(variant.price.amount, variant.price.currency).amountKrw
    : listing.priceKrw;

  const item: CoupangItem = {
    itemName,
    originalPrice: priceKrw,
    salePrice: priceKrw,
    externalVendorSku: variant?.sku,
    // variant.stockQuantity가 없으면(재고 추적 안 하는 매장, 또는 옵션 없는
    // 상품) 상품 전체 기본 재고로 폴백한다.
    maximumBuyCount: variant?.stockQuantity ?? product.stockQuantity.value,
    maximumBuyForPerson: 0,
    // 0을 보내면 실제 쿠팡 API가 "최소 1이상 입력해야 합니다"로 거부한다(실제
    // 등록 시도로 확인) — maximumBuyForPerson(1인당 최대구매수량)이 0(무제한)
    // 이어도 기간 필드 자체는 항상 1 이상이어야 한다.
    maximumBuyForPersonPeriod: 1,
    // 해외 URL을 소싱해서 등록하는 CartPilot 특성상 국내 사입 대비 배송이 오래
    // 걸린다고 보수적으로 가정한다 — 실제 배송 정책이 정해지면 조정한다.
    outboundShippingTimeDay: 7,
    unitCount: 1,
    adultOnly: "EVERYONE",
    taxType: "TAX",
    parallelImported: "NOT_PARALLEL_IMPORTED",
    // CartPilot이 등록하는 상품은 정의상 전부 해외 URL에서 소싱한 것이다 —
    // 이전에는 이 값이 반대(NOT_OVERSEAS_PURCHASED)로 고정되어 있었다
    // (docs/coupang-registration-requirements-audit.md 참고).
    overseasPurchased: "OVERSEAS_PURCHASED",
    // deliveryMethod가 AGENT_BUY(해외구매대행)면 쿠팡 공식 문서가 명시적으로
    // "product PCC must be entered as true"라고 요구한다 — 구매자가 개인
    // 통관고유부호를 입력해야 하는 상품이라는 뜻이다.
    pccNeeded: true,
    images,
    attributes: compliance.attributes,
    notices: compliance.notices,
    contents,
    searchTags: listing.options,
  };

  return {
    item,
    complianceResults: [...compliance.attributeResults, ...compliance.noticeResults],
  };
}

export function buildCoupangPayload(
  product: CanonicalProduct,
  listing: ListingModel,
  options: {
    sellerConfig?: CoupangSellerConfig;
    descriptionTemplate?: CoupangDescriptionTemplate;
    categoryMeta?: CoupangCategoryMeta | null;
    /** Brand Search API로 찾은 Wing 등록 브랜드 — 있으면 listing.brand(원본 추출
     * 브랜드 문자열) 대신 이 이름과 brandId를 함께 보낸다. */
    resolvedBrand?: { brandId: string; brandName: string } | null;
  } = {},
): CoupangPayload {
  const sellerConfig = options.sellerConfig ?? BLANK_COUPANG_SELLER_CONFIG;
  const description = mergeCoupangDescription(listing.description, options.descriptionTemplate);

  const displayCategoryCode = resolveVerifiedCategoryCode(listing.category);

  const descriptionImageUrls = product.images
    .filter((img) => img.useInDescription)
    .map((img) => getSelectedImageUrl(img));

  const images: CoupangItemImage[] = [];
  if (listing.representativeImage) {
    images.push({ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: listing.representativeImage });
  }
  listing.additionalImages.forEach((url, index) => {
    images.push({ imageOrder: index + 1, imageType: "DETAIL", vendorPath: url });
  });

  const contents: CoupangItemContent[] = [
    ...(description
      ? [
          {
            contentsType: "TEXT" as const,
            contentDetails: [{ content: description, detailType: "TEXT" as const }],
          },
        ]
      : []),
    ...descriptionImageUrls.map((url) => ({
      contentsType: "IMAGE" as const,
      contentDetails: [{ content: url, detailType: "IMAGE" as const }],
    })),
  ];

  const now = new Date();
  const twoYearsLater = new Date(now);
  twoYearsLater.setFullYear(now.getFullYear() + 2);

  const deliveryCharge = product.shippingFee.value;
  const deliveryChargeType: CoupangPayload["deliveryChargeType"] = deliveryCharge > 0 ? "NOT_FREE" : "FREE";

  // 옵션이 있으면(variants가 채워졌으면) variant별로 item을 하나씩 만든다 —
  // 없으면(대부분의 크롤러 소스는 아직 variant를 못 뽑는다, 또는 옵션 없는
  // 상품) 기존처럼 단일 item 하나만 만든다.
  const variantSlots: (CanonicalProductVariant | undefined)[] =
    product.variants.length > 0 ? product.variants : [undefined];
  const built = variantSlots.map((variant) =>
    buildCoupangItem({
      product,
      listing,
      sellerConfig,
      categoryMeta: options.categoryMeta,
      images,
      contents,
      optionGroups: product.optionGroups,
      variant,
    }),
  );
  const items: CoupangItem[] = built.map((b) => b.item);
  // Sprint B: register 라우트가 Compliance Report(0~100점 + "사용자 입력 필요"
  // 목록)를 만드는 데 쓴다 — 공식 쿠팡 스키마 필드가 아니라 CartPilot 전용
  // 참고 필드다(displayCategoryPath와 같은 성격).
  const complianceFieldResults: ComplianceFieldResult[] = built.flatMap((b) => b.complianceResults);

  return {
    displayCategoryCode,
    displayCategoryPath: listing.category.candidate?.path ?? null,
    sellerProductName: listing.title,
    vendorId: sellerConfig.vendorId,
    saleStartedAt: formatCoupangDateTime(now),
    saleEndedAt: formatCoupangDateTime(twoYearsLater),
    brand: options.resolvedBrand?.brandName ?? listing.brand,
    brandId: options.resolvedBrand?.brandId,
    generalProductName: listing.title,
    deliveryMethod: "AGENT_BUY",
    deliveryCompanyCode: sellerConfig.deliveryCompanyCode,
    deliveryChargeType,
    deliveryCharge,
    freeShipOverAmount: 0,
    deliveryChargeOnReturn: deliveryCharge,
    remoteAreaDeliverable: "N",
    unionDeliveryType: "NOT_UNION_DELIVERY",
    returnCenterCode: sellerConfig.returnCenterCode,
    returnChargeName: sellerConfig.returnChargeName,
    companyContactNumber: sellerConfig.companyContactNumber,
    returnZipCode: sellerConfig.returnZipCode,
    returnAddress: sellerConfig.returnAddress,
    returnAddressDetail: sellerConfig.returnAddressDetail,
    returnCharge: deliveryCharge,
    outboundShippingPlaceCode: sellerConfig.outboundShippingPlaceCode,
    vendorUserId: sellerConfig.vendorUserId,
    requested: false,
    priceIsEstimate: listing.priceIsEstimate,
    items,
    complianceFieldResults,
  };
}
