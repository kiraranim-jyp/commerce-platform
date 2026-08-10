/**
 * Sprint N-2.6 — Naver Commerce API v2 상품등록(`POST /v2/products`) request
 * body 타입. N-2.4/N-2.5에서 production read-only API로 실제 확인한 필드만
 * 넣는다. 확인 안 된 필드는 옵셔널로 두고 주석에 "미확인"이라고 명시한다 —
 * 임의로 필드를 지어내지 않는다(CPO 반복 지시).
 *
 * 확인 방법:
 * - "확인됨(공식 GitHub 기술지원 답변/릴리즈노트)": commerce-api-naver/commerce-api
 *   discussions #241, #337, #1730에서 메인테이너가 직접 인용한 필드.
 * - "확인됨(production GET)": Sprint N-2.4/N-2.5에서 실제 프로덕션 인증으로 호출해서
 *   받은 실제 응답(카테고리/속성/고시/주소록).
 * - "미확인": 어느 쪽으로도 확인 못함 — 구현에서 값을 넣지 않고 validation이
 *   BLOCKED로 표시한다.
 */

/** 확인됨(GitHub #241) — images는 단순 URL 문자열이 아니라 object로 감싼다. */
export interface NaverImageRef {
  url: string;
}

export interface NaverImages {
  representativeImage: NaverImageRef;
  optionalImages?: NaverImageRef[];
}

/** 확인됨(production GET, N-2.4) — KIDS 고시유형(어린이제품)의 실제 필드.
 * 아동복 대상 카테고리(exceptionalCategories에 CHILD_CERTIFICATION 포함)는
 * WEAR(의류) 대신 KIDS를 쓰는 게 맞다고 판단했다 — 다만 이건 CartPilot의 판단이지
 * 네이버가 "이 카테고리는 반드시 KIDS를 써야 한다"고 명시한 건 아니라서
 * mapper에서 이 가정을 주석으로 남긴다. */
export interface NaverProductInfoProvidedNoticeKids {
  productInfoProvidedNoticeType: "KIDS";
  itemName?: string;
  modelName?: string;
  certificationType?: string;
  size?: string;
  weight?: string;
  color?: string;
  material?: string;
  recommendedAge?: string;
  releaseDate?: string;
  releaseDateText?: string;
  manufacturer?: string;
  caution?: string;
  warrantyPolicy?: string;
  afterServiceDirector?: string;
  numberLimit?: string;
}

/** 확인됨(production GET, N-2.4) — 일반 의류용. */
export interface NaverProductInfoProvidedNoticeWear {
  productInfoProvidedNoticeType: "WEAR";
  material?: string;
  color?: string;
  size?: string;
  manufacturer?: string;
  caution?: string;
  packDate?: string;
  packDateText?: string;
  warrantyPolicy?: string;
  afterServiceDirector?: string;
}

export type NaverProductInfoProvidedNotice =
  | NaverProductInfoProvidedNoticeKids
  | NaverProductInfoProvidedNoticeWear;

/** 확인됨(production GET, N-2.4) — 카테고리 detail 응답의 certificationInfos에서
 * kindTypes에 CHILD_CERTIFICATION이 포함된 항목의 id를 여기 넣는다.
 * 실제 인증서 정보(certificationNumber/companyName/certificationDate)는
 * CartPilot이 만들어낼 수 없는 값이라(실제 인증 취득 여부는 판매자 책임) 값이
 * 없으면 validation이 BLOCKED로 표시하고 payload에 임의 값을 채우지 않는다. */
export interface NaverProductCertificationInfo {
  certificationInfoId: number;
  certificationKindType?: string;
  name?: string;
  certificationNumber?: string;
  certificationMark?: string;
  companyName?: string;
  certificationDate?: string;
}

/** 확인됨(GitHub #241) — deliveryFee 필드 목록만 확인, 각 필드의 정확한 enum
 * 값/제약조건은 미확인. FREE 케이스(무료배송)만 최소 구현한다. */
export interface NaverDeliveryFee {
  deliveryFeeType: "FREE" | "CONDITIONAL_FREE" | "PAID" | "PAID_ONLY_CHEJU" | string;
  baseFee?: number;
  /** 미확인 필드들 — 조건부 무료배송/지역별 차등 등에 필요하나 이번 Sprint는
   * FREE 케이스만 다룬다. */
  freeConditionalAmount?: number;
  deliveryFeePayType?: string;
}

/** 확인됨(GitHub #241, 필드명만) — 반품/교환 주소 참조. N-2.5에서 확인한
 * addressBookNo가 여기 shippingAddressId/returnAddressId로 들어간다는 게
 * CPO 판단이나, 이 매핑 자체(addressBookNo → shippingAddressId 대입이 실제로
 * 유효한지)는 production 등록 성공 전까지 "가정"으로 표시한다. */
export interface NaverClaimDeliveryInfo {
  /** N-2.5 addressBookNo(REFUND_OR_EXCHANGE) 매핑 가정 — 실제 검증 안 됨. */
  returnAddressId?: number;
  /** N-2.5 addressBookNo(RELEASE 또는 별도 배송지) 매핑 가정 — 실제 검증 안 됨. */
  shippingAddressId?: number;
  /** 택배사 코드 — N-2.5에서 전용 조회 API를 못 찾음. 커뮤니티 답변에 등장하는
   * "CJGLS"는 실사용 예시이긴 하나 CartPilot이 직접 호출해서 확인한 값이
   * 아니라서(2차 출처) validation은 이 필드가 없어도 강제로 막지 않고
   * "미확인 필드"로만 표시한다. */
  returnDeliveryCompanyPriorityType?: string;
  returnDeliveryFee?: number;
  exchangeDeliveryFee?: number;
  freeReturnInsuranceYn?: boolean;
}

/** 확인됨(GitHub #241, 필드명만) — deliveryCompany/outboundLocationId 등 필드
 * 목록은 확인됐으나 각 enum의 정확한 값은 미확인(택배사 코드 제외 전부 미확인). */
export interface NaverDeliveryInfo {
  deliveryType?: string;
  deliveryAttributeType?: string;
  /** 미확인 — enum 값을 CartPilot이 임의로 넣지 않는다. */
  deliveryCompany?: string;
  /** N-2.5 addressBookNo(RELEASE) 매핑 가정 — 실제 검증 안 됨. 확인됨(GitHub
   * #1730 릴리즈노트)은 필드명 존재 자체만 — CartPilot의 addressBookNo가
   * 정확히 이 필드에 들어가는 게 맞는지는 실제 등록 성공 전까지 가정이다. */
  outboundLocationId?: number;
  deliveryFee?: NaverDeliveryFee;
  claimDeliveryInfo?: NaverClaimDeliveryInfo;
}

/** 확인됨(production GET, N-2.4) — attributeSeq/attributeValueSeq 기반. 문자열을
 * 직접 보내지 않고 카테고리 속성 조회 API로 확인한 ID 쌍만 사용한다. */
export interface NaverProductAttributeValue {
  attributeSeq: number;
  attributeValueSeq: number;
}

/** 미확인 — N-2.4에서 표준옵션 조회(GET /v1/options/standard-options)까지는
 * 확인했지만, optionCombinations 내부의 정확한 필드명(가격/재고/SKU 등)은
 * 확인 못했다(GitHub #605 메인테이너 답변에 그룹명/조합 개념만 있고 필드
 * 스키마는 없음). 옵션이 있는 상품은 이번 Sprint에서 BLOCKED 처리한다. */
export interface NaverOptionInfo {
  useStockManagement?: boolean;
  optionCombinationGroupNames?: string[];
  /** 미확인 스키마 — 값을 채우지 않는다(옵션 없는 최소 fixture만 이번 Sprint 대상). */
  optionCombinations?: unknown[];
}

export interface NaverDetailAttribute {
  productInfoProvidedNotice?: NaverProductInfoProvidedNotice;
  /** 미확인 — N-2.4에서 필드 존재만 확인, 하위 구조(originAreaCode/content/
   * importer/plural)는 확인 못함. */
  originAreaInfo?: unknown;
  optionInfo?: NaverOptionInfo;
  naverShoppingSearchInfo?: unknown;
  afterServiceInfo?: unknown;
}

export interface NaverOriginProduct {
  statusType: "SALE" | "WAIT" | string;
  saleType?: "NEW" | string;
  leafCategoryId: string;
  name: string;
  images: NaverImages;
  detailContent: string;
  salePrice: number;
  stockQuantity: number;
  deliveryInfo?: NaverDeliveryInfo;
  detailAttribute?: NaverDetailAttribute;
  productCertificationInfos?: NaverProductCertificationInfo[];
}

/** 확인됨(GitHub #241, 필드명만) — 필수 여부와 각 필드의 정확한 타입/제약은
 * 미확인. channelProductDisplayStatusType 등 enum 값도 미확인. */
export interface NaverSmartstoreChannelProduct {
  channelProductName?: string;
  storeKeepExclusiveProduct?: boolean;
  naverShoppingRegistration?: boolean;
  channelProductDisplayStatusType?: string;
}

/** 확인됨(GitHub #337) — POST /v2/products의 최상위 구조. */
export interface NaverProductRegistrationPayload {
  originProduct: NaverOriginProduct;
  smartstoreChannelProduct: NaverSmartstoreChannelProduct;
}
