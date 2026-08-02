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
  /** Sprint A-8(작업1/5) — 상품마다 다시 입력하지 않는 배송 정책 기본값.
   * product.shippingFee(사용자가 실제로 편집한 값)가 있으면 그게 우선이고
   * (상품 Override > SellerProfile 우선순위), 없을 때만 이 기본값을 쓴다. */
  deliveryCharge: number | null;
  returnDeliveryCharge: number | null;
  outboundLeadTimeDays: number | null;
  /** Sprint A-8(추가 권장사항) — Sprint A-7 실측에서 30건 중 30건을 막은 1위
   * 블로커. 원본 사이트가 아니라 판매자(대표님) 본인의 사업자 정보라 상품마다
   * 크롤링/정규식으로 찾을 게 아니라 SellerProfile에서 가져온다. */
  manufacturer: string;
  asContactNumber: string;
  qualityGuarantee: string;
  /** Sprint A-11(작업4 — CPO 지시: "판매자 기본정보 자동 적용 확장(원산지)")
   * — manufacturer와 같은 이유(상품마다 다시 찾지 않는 판매자 운영 데이터)로
   * SellerProfile에서 가져온다. 상품 설명에서 원산지를 못 찾았을 때만(빈 값일
   * 때만) 대신 쓴다 — product.countryOfOrigin이 있으면 그게 항상 우선이다. */
  defaultCountryOfOrigin: string;
  /** Sprint A-11(작업3 — CPO 지시: "상세페이지 공통 이미지(상단/하단)") —
   * 상세설명 맨 앞/맨 뒤에 항상 붙는 배송안내/구매대행 안내 등의 고정
   * 이미지다. ON일 때만 상세설명 이미지 블록의 맨 앞/맨 뒤에 추가한다 —
   * 상품별 실제 상세 이미지(descriptionImageUrls)는 그대로 두고 감싸기만
   * 한다. */
  topCommonImageUrl: string | null;
  topCommonImageEnabled: boolean;
  bottomCommonImageUrl: string | null;
  bottomCommonImageEnabled: boolean;
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
  deliveryCharge: null,
  returnDeliveryCharge: null,
  outboundLeadTimeDays: null,
  manufacturer: "",
  asContactNumber: "",
  qualityGuarantee: "",
  defaultCountryOfOrigin: "",
  topCommonImageUrl: null,
  topCommonImageEnabled: false,
  bottomCommonImageUrl: null,
  bottomCommonImageEnabled: false,
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
/** Sprint A-4(작업1) — CPO 실측 보고: "제조사는 Bobo Choses가 있는데 고시정보
 * 제조자에는 안 들어갑니다." 쿠팡 카테고리별로 필드 이름이 "제조자"가 아니라
 * "제조사"인 경우가 있어("제조사".includes("제조자") === false) 동의어 누락으로
 * 매칭이 조용히 실패하고 있었다. */
const MANUFACTURER_SYNONYMS = ["제조자", "제조사", "수입자", "manufacturer"];
const CARE_SYNONYMS = ["세탁방법", "취급방법", "취급시 주의사항", "care"];
/** Sprint A-8(추가 권장사항) — Sprint A-7 실측에서 "품질보증기준"이 상위
 * 블로커 중 하나였다(30건 중 6건). 상품마다 다른 값이 아니라 판매자가 매장
 * 전체에 적용하는 정책 문구인 경우가 대부분이라 SellerProfile 기본값으로
 * 채운다(product.* 필드에는 대응하는 크롤링 값이 애초에 없다). */
const QUALITY_GUARANTEE_SYNONYMS = ["품질보증기준", "품질보증"];
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

/** Sprint A-6(KC-free 고시정보 카테고리 선택) — 고시정보 카테고리 "이름"과
 * 상품명에 흔히 나오는 단어를 대조하는 최소한의 표. 확신 없는 매칭으로
 * 엉뚱한 고시정보 템플릿(예: 화장품에 "악기" 템플릿)을 붙이지 않도록, 여기
 * 없는 카테고리 이름은 절대 KC-free 후보로 승격시키지 않는다(안전한
 * 카테고리만 좁게 등록). */
const NOTICE_CATEGORY_NAME_KEYWORDS: Record<string, string[]> = {
  "구두/신발": ["shoe", "sneaker", "boot", "sandal", "loafer", "slip-on", "runner", "trainer"],
  "가방": ["bag", "backpack", "tote", "pouch", "duffle", "duffel", "crossbody", "purse", "handbag"],
  "모자": ["hat", "cap", "beanie", "trucker"],
  "화장품": ["makeup", "cosmetic", "skincare", "lipstick", "serum", "cleanser", "moisturizer", "mascara", "foundation", "powder", "blush"],
};

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

/** Sprint A-4(작업1) — CPO 실측 보고: "색상에는 Pink가 있는데 쿠팡 Attribute
 * 색상으로 자동 연결이 안 됩니다." matchProductField는 원문 값을 그대로
 * 돌려줬을 뿐 그 값이 쿠팡이 실제로 허용하는 값 목록(attr.inputValues, 대부분
 * 한국어)에 있는지 확인하지 않았다 — "Pink"는 원문에 실제로 있는 값이라
 * PRODUCT_FIELD로 채워졌지만, 쿠팡 색상 속성은 "핑크" 같은 한국어 값만
 * 허용하므로 실제 등록 시점엔 거부될 값이었다. 흔한 색상 영단어만 최소한으로
 * 번역해서 매칭 성공률을 높이고, 사전에 없는 값은 지어내지 않는다. */
const COLOR_TRANSLATIONS: Record<string, string> = {
  pink: "핑크", white: "화이트", black: "블랙", red: "레드", blue: "블루",
  green: "그린", yellow: "옐로우", grey: "그레이", gray: "그레이", brown: "브라운",
  beige: "베이지", navy: "네이비", purple: "퍼플", orange: "오렌지", ivory: "아이보리",
  khaki: "카키", mint: "민트", silver: "실버", gold: "골드", multicolor: "혼합색상",
};

/** candidate(원문에서 뽑은 값)가 attr.inputValues(쿠팡이 실제로 허용하는 값
 * 목록)의 어느 값에 해당하는지 확인한다. inputValues가 비어 있으면(자유 입력
 * 필드) 제약이 없으므로 그대로 통과시킨다. 못 찾으면 undefined — 이 경우
 * 호출자는 "값은 있지만 후보를 못 정했다"는 별도 사유로 처리해야 한다(지어낸
 * 값을 쓰면 안 됨). */
function resolveEnumValue(candidate: string, inputValues: string[]): string | undefined {
  if (inputValues.length === 0) return candidate;
  const normalized = candidate.trim().toLowerCase();
  const exact = inputValues.find((v) => v.toLowerCase() === normalized);
  if (exact) return exact;
  const translated = COLOR_TRANSLATIONS[normalized];
  if (translated) {
    const translatedMatch = inputValues.find((v) => v.includes(translated));
    if (translatedMatch) return translatedMatch;
  }
  const partial = inputValues.find((v) => v.toLowerCase().includes(normalized) || normalized.includes(v.toLowerCase()));
  return partial;
}

/** Sprint A-4(작업2 — 미매핑 필드 리포트) — "자동 입력 실패"를 하나로 뭉치지
 * 않고 CPO가 요청한 3가지 이유로 구분한다: 이 함수 이름 자체가 매칭 단계
 * 이름과 대응한다.
 *   NO_RULE  — 쿠팡 필드 이름과 매칭되는 동의어 규칙 자체가 없다(예: 아직
 *              모르는 필드 이름).
 *   NO_VALUE — 동의어는 매칭됐지만(어떤 CartPilot 필드인지는 안다)
 *              CanonicalProduct에 그 필드 값이 비어 있다.
 *   MATCHED  — 동의어도 매칭되고 값도 있다(enum 검증은 호출자가 별도로 한다 —
 *              이 함수는 "원문에 값이 있는가"만 판단한다). */
type ProductFieldMatch =
  | { status: "MATCHED"; value: string }
  | { status: "NO_VALUE" }
  | { status: "NO_RULE" };

function matchProductFieldDetailed(
  fieldName: string,
  productFields: {
    brand?: string;
    material?: string;
    countryOfOrigin?: string;
    color?: string;
    recommendedAge?: string;
    manufacturer?: string;
    careInstructions?: string;
    qualityGuarantee?: string;
  },
): ProductFieldMatch {
  const lower = fieldName.toLowerCase();
  const rules: [string[], string | undefined][] = [
    [BRAND_SYNONYMS, productFields.brand],
    [MATERIAL_SYNONYMS, productFields.material],
    [COUNTRY_SYNONYMS, productFields.countryOfOrigin],
    [COLOR_SYNONYMS, productFields.color],
    [AGE_SYNONYMS, productFields.recommendedAge],
    [MANUFACTURER_SYNONYMS, productFields.manufacturer],
    [CARE_SYNONYMS, productFields.careInstructions],
    [QUALITY_GUARANTEE_SYNONYMS, productFields.qualityGuarantee],
  ];
  for (const [synonyms, value] of rules) {
    if (synonyms.some((s) => lower.includes(s))) {
      return value ? { status: "MATCHED", value } : { status: "NO_VALUE" };
    }
  }
  return { status: "NO_RULE" };
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
  /** Sprint A-4(작업2 — 미매핑 필드 리포트) — source가 PLACEHOLDER일 때만 의미
   * 있다. compliance-report.ts가 이 값으로 "값 없음/규칙 없음/후보 다수" 3가지
   * 사유를 구분해서 보여준다. undefined면 이 필드 자체가 애초에 자동 매핑
   * 대상이 아니었다는 뜻(예: KC 인증정보처럼 사람만 알 수 있는 항목). */
  unmappedReason?: "NO_VALUE" | "NO_RULE" | "ENUM_MISMATCH";
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
 * KC 인증번호/인증기관은 이 매핑에서 의도적으로 제외한다 — CartPilot이 원본
 * 사이트에서도, 판매자 기본값으로도 대신할 수 없는(상품/인증기관마다 실제로
 * 다른) 정보다. 수입자/A-S 연락처/품질보증기준은 Sprint A-8부터 예외다 —
 * 원본 사이트에서는 알 수 없는 게 맞지만, 상품마다 다른 게 아니라 판매자
 * 본인이 어차피 반복 입력할 상수라서 SellerProfile 기본값(context.manufacturer/
 * qualityGuarantee, context.contactNumber는 기존부터 있었음)으로 대신 채운다. */
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
    qualityGuarantee?: string;
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
      const fieldMatch = matchProductFieldDetailed(attr.attributeTypeName, context);
      if (fieldMatch.status === "MATCHED") {
        const resolvedValue = resolveEnumValue(fieldMatch.value, attr.inputValues);
        if (resolvedValue) {
          return {
            fieldName: attr.attributeTypeName,
            value: resolvedValue,
            source: "PRODUCT_FIELD" as const,
            critical: false,
            kind: "ATTRIBUTE" as const,
          };
        }
        // 원문에 값은 실제로 있지만("Pink") 쿠팡이 요구하는 값 목록(한국어
        // enum) 어디에도 대응시키지 못했다 — 지어내서 넣지 않고, "후보 다수"
        // 사유로 사람이 직접 고르게 한다.
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
      // Sprint A-4(작업5 — Readiness 재보정) — inputValues가 2개 이상이면
      // "첫 값을 자동으로 고르는" 건 실제로는 모르면서 찍는 것과 같다(예:
      // 색상 후보가 10개인데 그중 임의로 하나를 골라 "자동 채움"이라고
      // 표시하면 점수가 실제보다 부풀려진다). 후보가 정확히 1개뿐이라 고를
      // 여지가 없을 때만 안전하게 DETERMINISTIC으로 채운다.
      if (attr.inputValues.length === 1) {
        return {
          fieldName: attr.attributeTypeName,
          value: attr.inputValues[0],
          source: "DETERMINISTIC" as const,
          critical: false,
          kind: "ATTRIBUTE" as const,
        };
      }
      const unmappedReason: ComplianceFieldResult["unmappedReason"] =
        fieldMatch.status === "MATCHED" ? "ENUM_MISMATCH" : fieldMatch.status === "NO_VALUE" ? "NO_VALUE" : "NO_RULE";
      return {
        fieldName: attr.attributeTypeName,
        value: attr.inputValues[0] ?? NOTICE_DEFAULT_CONTENT,
        source: "PLACEHOLDER" as const,
        critical: isComplianceCritical(attr.attributeTypeName),
        kind: "ATTRIBUTE" as const,
        unmappedReason,
      };
    })
    .map((r) => ({ ...r, confidence: FIELD_SOURCE_CONFIDENCE[r.source] }));
  const attributes: CoupangItemAttribute[] = attributeResults.map((r) => ({
    attributeTypeName: r.fieldName,
    attributeValueName: r.value,
  }));

  // Sprint A-6(CPO 피드백) — "KC가 필요 없는 카테고리부터 실제 등록 성공을
  // 확보하라." 기존엔 필드 개수만 보고 가장 단순한 고시정보 카테고리를 골랐다
  // — 실측 확인: 뷰티 상품에서 "기타 재화"(5개, KC 포함)가 "화장품"(11개, KC
  // 없음)보다 필드가 적다는 이유만으로 선택되면, 필드 수는 줄어도 자동화가
  // 원천적으로 불가능한 KC 항목이 남아버려 오히려 손해다. KC가 아예 없는
  // 대안이 있고 그 이름이 실제 상품명과 관련 있어 보일 때만 그쪽을 우선한다 —
  // 아무 KC-free 카테고리나 골라서(예: "악기") 엉뚱한 고시정보 템플릿을
  // 뷰티 상품에 붙이는 오분류는 만들지 않는다(신뢰할 수 없는 매칭이면 그냥
  // 기존 방식대로 필드 수 기준으로 되돌아간다).
  const noticeCategoryHasMandatoryKc = (c: CoupangCategoryNoticeMeta) =>
    c.noticeCategoryDetailNames.some(
      (d) => d.required === "MANDATORY" && (d.noticeCategoryDetailName.includes("인증") || d.noticeCategoryDetailName.includes("허가")),
    );
  const kcFreeMatch = categoryMeta.noticeCategories
    .filter((c) => !noticeCategoryHasMandatoryKc(c))
    .find((c) => {
      const keywords = NOTICE_CATEGORY_NAME_KEYWORDS[c.noticeCategoryName];
      return keywords?.some((k) => context.productName.toLowerCase().includes(k));
    });
  const simplestNoticeCategory =
    kcFreeMatch ??
    [...categoryMeta.noticeCategories].sort(
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
          const fieldMatch = matchProductFieldDetailed(detail.noticeCategoryDetailName, context);
          if (fieldMatch.status === "MATCHED") {
            return {
              fieldName: detail.noticeCategoryDetailName,
              value: fieldMatch.value,
              source: "PRODUCT_FIELD" as const,
              critical: false,
              kind: "NOTICE" as const,
            };
          }
          const noticeUnmappedReason: ComplianceFieldResult["unmappedReason"] =
            fieldMatch.status === "NO_VALUE" ? "NO_VALUE" : "NO_RULE";
          return {
            fieldName: detail.noticeCategoryDetailName,
            value: NOTICE_DEFAULT_CONTENT,
            source: "PLACEHOLDER" as const,
            critical: isComplianceCritical(detail.noticeCategoryDetailName),
            kind: "NOTICE" as const,
            unmappedReason: noticeUnmappedReason,
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
  /** Sprint A-12(작업4 — CPO 지시: "제조자/원산지 우선순위: 상품추출 >
   * 브랜드기본값 > Seller기본값 > 사용자입력") — sellerConfig보다 먼저
   * 확인하는 중간 단계. product.brand.value로 미리 조회해서 넘겨받는다
   * (build-payload.ts는 DB에 접근하지 않는다 — register/route.ts 등 호출부의
   * 책임). */
  brandProfile?: { countryOfOrigin: string; manufacturer: string } | null;
}): { item: CoupangItem; complianceResults: ComplianceFieldResult[] } {
  const { product, listing, sellerConfig, categoryMeta, images, contents, optionGroups, variant, brandProfile } = args;

  const compliance = buildCoupangCompliance(
    categoryMeta,
    {
      productName: listing.title,
      contactNumber: sellerConfig.asContactNumber || sellerConfig.companyContactNumber,
      brand: product.brand.value || undefined,
      material: product.material.value || undefined,
      // Sprint A-12(작업3) — 우선순위: 상품 추출값 > 브랜드 프로필 > Seller
      // 기본값. 브랜드 프로필이 없거나 값이 비어 있으면 자동으로 다음 단계로
      // 넘어간다(빈 문자열은 falsy라 || 체인이 그대로 스킵한다).
      countryOfOrigin:
        product.countryOfOrigin.value || brandProfile?.countryOfOrigin || sellerConfig.defaultCountryOfOrigin || undefined,
      color: product.color.value || undefined,
      recommendedAge: product.recommendedAge.value || undefined,
      // Sprint A-8(추가 권장사항) — 원본 사이트에서 크롤링한 값이 있으면
      // 그게 우선(상품 Override > 브랜드 프로필 > SellerProfile). Sprint A-7
      // 실측에서 이 필드가 30건 중 30건을 막았는데, 대부분 상품마다 다른
      // 정보가 아니라 브랜드 또는 판매자 본인의 사업자 정보였다.
      manufacturer: product.manufacturer.value || brandProfile?.manufacturer || sellerConfig.manufacturer || undefined,
      careInstructions: product.careInstructions.value || undefined,
      qualityGuarantee: sellerConfig.qualityGuarantee || undefined,
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
    // Sprint A-8(작업1/5) — 판매자가 SellerProfile에 실제 출고 소요일을
    // 설정했으면 그 값을 쓴다. 없으면 기존처럼 "해외 URL 소싱이라 국내 사입
    // 대비 오래 걸린다"는 보수적 기본값(7일)으로 폴백한다.
    outboundShippingTimeDay: sellerConfig.outboundLeadTimeDays ?? 7,
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
    /** Sprint A-12(작업4) — product.brand.value로 미리 조회해둔 브랜드 프로필. */
    brandProfile?: { countryOfOrigin: string; manufacturer: string } | null;
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

  // Sprint A-11(작업3) — 상품별 실제 상세 이미지는 그대로 두고, ON인 공통
  // 이미지만 맨 앞/맨 뒤에 감싼다. URL이 비어있으면(설정 안 함) enabled여도
  // 아무것도 추가하지 않는다 — 빈 content 블록을 보내면 API가 거부한다.
  const topCommonImage =
    sellerConfig.topCommonImageEnabled && sellerConfig.topCommonImageUrl ? [sellerConfig.topCommonImageUrl] : [];
  const bottomCommonImage =
    sellerConfig.bottomCommonImageEnabled && sellerConfig.bottomCommonImageUrl
      ? [sellerConfig.bottomCommonImageUrl]
      : [];

  const contents: CoupangItemContent[] = [
    ...(description
      ? [
          {
            contentsType: "TEXT" as const,
            contentDetails: [{ content: description, detailType: "TEXT" as const }],
          },
        ]
      : []),
    ...[...topCommonImage, ...descriptionImageUrls, ...bottomCommonImage].map((url) => ({
      contentsType: "IMAGE" as const,
      contentDetails: [{ content: url, detailType: "IMAGE" as const }],
    })),
  ];

  const now = new Date();
  const twoYearsLater = new Date(now);
  twoYearsLater.setFullYear(now.getFullYear() + 2);

  // Sprint A-8(작업5 — "상품 Override > SellerProfile" 우선순위) —
  // shippingFee.source가 "DEFAULT"면 아무도 이 상품에서 실제로 배송비를
  // 정한 적이 없다는 뜻(canonical-product.ts가 항상 DEFAULT로 시작한다)이라
  // 판매자 기본값을 대신 쓴다. 사용자가 Editor에서 직접 고쳤거나 원본
  // 사이트에서 실제로 읽어온 값이면(ORIGINAL/USER_EDITED 등) 그 상품별 값이
  // 항상 우선한다.
  const deliveryCharge =
    product.shippingFee.source === "DEFAULT" && sellerConfig.deliveryCharge != null
      ? sellerConfig.deliveryCharge
      : product.shippingFee.value;
  const deliveryChargeType: CoupangPayload["deliveryChargeType"] = deliveryCharge > 0 ? "NOT_FREE" : "FREE";
  const returnCharge = sellerConfig.returnDeliveryCharge ?? deliveryCharge;

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
      brandProfile: options.brandProfile,
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
    deliveryChargeOnReturn: returnCharge,
    remoteAreaDeliverable: "N",
    unionDeliveryType: "NOT_UNION_DELIVERY",
    returnCenterCode: sellerConfig.returnCenterCode,
    returnChargeName: sellerConfig.returnChargeName,
    companyContactNumber: sellerConfig.companyContactNumber,
    returnZipCode: sellerConfig.returnZipCode,
    returnAddress: sellerConfig.returnAddress,
    returnAddressDetail: sellerConfig.returnAddressDetail,
    returnCharge,
    outboundShippingPlaceCode: sellerConfig.outboundShippingPlaceCode,
    vendorUserId: sellerConfig.vendorUserId,
    requested: false,
    priceIsEstimate: listing.priceIsEstimate,
    items,
    complianceFieldResults,
  };
}

/** Sprint A-11(작업9 — CPO 지시: "등록 전 자동 검증: 가격 반올림 + 반품배송비
 * 상한") — 이번 스프린트 LIVE 시도 3회에서 실제로 확인된 쿠팡 제약이다:
 * (1) 판매가는 10원 단위여야 한다("판매가는 최소 10원 단위로 입력가능합니다"),
 * (2) 반품배송비는 min(20000, 판매가)를 넘을 수 없다(가격대별로 순차 확인된
 * 두 에러 메시지를 합친 추정 공식 — 카테고리 메타 응답에는 이 상한이 없어
 * client-side로 검증할 방법이 이 추정 규칙뿐이다. 모든 카테고리에서
 * 100% 보장되는 공식은 아니므로, 여기서 걸러지지 않아도 실제 API가 최종
 * 방어선이다). register/route.ts가 실제 API 호출 직전에 이 함수로 한 번 더
 * 막는다 — 화면의 Sticky Summary가 막아주는 게 정상 경로지만, 오래된 상태를
 * 들고 있는 클라이언트에 대비해 서버에서도 막는 CP007과 같은 방어선이다. */
export interface CoupangPricingIssue {
  field: "salePrice" | "returnCharge";
  message: string;
}

export function validateCoupangPricing(payload: CoupangPayload): CoupangPricingIssue[] {
  const issues: CoupangPricingIssue[] = [];
  const nonRoundItems = payload.items.filter((item) => item.salePrice % 10 !== 0);
  if (nonRoundItems.length > 0) {
    issues.push({
      field: "salePrice",
      message: `판매가는 10원 단위여야 합니다(현재: ${nonRoundItems.map((i) => i.salePrice.toLocaleString()).join(", ")}원).`,
    });
  }
  if (payload.items.length > 0) {
    const minSalePrice = Math.min(...payload.items.map((i) => i.salePrice));
    const maxReturnCharge = Math.min(20000, minSalePrice);
    if (payload.returnCharge > maxReturnCharge) {
      issues.push({
        field: "returnCharge",
        message: `반품배송비(${payload.returnCharge.toLocaleString()}원)가 상한(${maxReturnCharge.toLocaleString()}원 = min(20,000원, 판매가))을 초과합니다.`,
      });
    }
  }
  return issues;
}
