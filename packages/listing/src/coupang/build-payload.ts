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
/** KC 인증정보처럼 법적/컴플라이언스 성격이 강한 필드 — 플레이스홀더로 채워지면
 * Compliance Report가 다른 필드보다 무겁게(FAIL 수준으로) 취급해야 한다. */
const COMPLIANCE_CRITICAL_SYNONYMS = ["kc", "인증"];

function isComplianceCritical(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();
  return COMPLIANCE_CRITICAL_SYNONYMS.some((s) => lower.includes(s));
}

function matchOptionValue(
  fieldName: string,
  optionGroups: CanonicalProductOptionGroup[],
  variant: CanonicalProductVariant | undefined,
): string | undefined {
  if (!variant) return undefined;
  const lower = fieldName.toLowerCase();
  const synonyms = SIZE_SYNONYMS.some((s) => lower.includes(s))
    ? SIZE_SYNONYMS
    : COLOR_SYNONYMS.some((s) => lower.includes(s))
      ? COLOR_SYNONYMS
      : null;
  if (!synonyms) return undefined;
  const matchedGroup = optionGroups.find((g) => synonyms.some((s) => g.name.toLowerCase().includes(s)));
  return matchedGroup ? variant.optionValues[matchedGroup.name] : undefined;
}

/** CanonicalProduct.material/countryOfOrigin이 실제로 채워져 있을 때만(크롤러가
 * 못 뽑아오면 거의 항상 빈 문자열이다 — 대부분 여전히 플레이스홀더로 남는다는
 * 뜻) "재질"/"제조국" 계열 필드에 실제 값을 준다. */
function matchProductField(
  fieldName: string,
  productFields: { material?: string; countryOfOrigin?: string },
): string | undefined {
  const lower = fieldName.toLowerCase();
  if (MATERIAL_SYNONYMS.some((s) => lower.includes(s)) && productFields.material) {
    return productFields.material;
  }
  if (COUNTRY_SYNONYMS.some((s) => lower.includes(s)) && productFields.countryOfOrigin) {
    return productFields.countryOfOrigin;
  }
  return undefined;
}

/** 값 하나가 어디서 왔는지 — Compliance Report(Sprint B)가 이 출처로 점수를 매긴다.
 * OPTION_MATCH/PRODUCT_FIELD/KNOWN_VALUE/DETERMINISTIC은 전부 "실제 근거가 있는
 * 값"이고, PLACEHOLDER만 "지어내지 않기 위해 넣은 자리표시자"다. */
export type ComplianceFieldSource = "OPTION_MATCH" | "PRODUCT_FIELD" | "KNOWN_VALUE" | "DETERMINISTIC" | "PLACEHOLDER";

export interface ComplianceFieldResult {
  fieldName: string;
  value: string;
  source: ComplianceFieldSource;
  /** KC/인증 관련이라 플레이스홀더면 특히 중요하게(FAIL 수준으로) 취급해야 하는지. */
  critical: boolean;
  /** buildComplianceReport가 requiredAttributeRate/requiredNoticeRate를 나눠
   * 계산할 수 있도록 구매옵션(attribute)인지 고시정보(notice)인지 표시한다. */
  kind: "ATTRIBUTE" | "NOTICE";
}

/** 카테고리별 필수 고시정보(notices)/구매옵션(attributes)을 채운다. 실제 값을 알 수
 * 없는 필드(제조국/인증사항 등)는 추측해서 지어내지 않고 쿠팡이 넓게 허용하는
 * "상세페이지 참조"를 쓴다 — 연락처처럼 CartPilot이 실제로 갖고 있는 값은 그대로
 * 채운다. noticeCategories가 여러 개면 필수 항목이 가장 적은(=충족하기 가장
 * 단순한) 카테고리를 고른다 — 특정 카테고리를 강제로 골라야 할 근거가 없다.
 * 채운 값마다 출처(attributeResults/noticeResults)도 함께 반환한다 — Compliance
 * Report가 "이 값이 진짜인지 자리표시자인지"를 판단하는 데 쓴다. */
export function buildCoupangCompliance(
  categoryMeta: CoupangCategoryMeta | null | undefined,
  context: { productName: string; contactNumber: string; material?: string; countryOfOrigin?: string },
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
    });
  const attributes: CoupangItemAttribute[] = attributeResults.map((r) => ({
    attributeTypeName: r.fieldName,
    attributeValueName: r.value,
  }));

  const simplestNoticeCategory = [...categoryMeta.noticeCategories].sort(
    (a, b) => a.noticeCategoryDetailNames.length - b.noticeCategoryDetailNames.length,
  )[0];

  const KNOWN_NOTICE_VALUES: Record<string, string> = {
    "품명 및 모델명": context.productName,
    "품명": context.productName,
    "소비자상담 관련 전화번호": context.contactNumber,
    "A/S 책임자와 전화번호": context.contactNumber,
  };

  const noticeResults: ComplianceFieldResult[] = simplestNoticeCategory
    ? simplestNoticeCategory.noticeCategoryDetailNames
        .filter((detail) => detail.required === "MANDATORY")
        .map((detail) => {
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
    : [];
  const notices: CoupangItemNotice[] = simplestNoticeCategory
    ? noticeResults.map((r) => ({
        noticeCategoryName: simplestNoticeCategory.noticeCategoryName,
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
      material: product.material.value || undefined,
      countryOfOrigin: product.countryOfOrigin.value || undefined,
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
