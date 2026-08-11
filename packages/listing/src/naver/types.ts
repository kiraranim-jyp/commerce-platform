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

/** 확인됨(공식 OpenAPI, commerce-api-naver/commerce-api docs/2.0.0-RC.js,
 * ExternalApiDeliveryFeeByAreaVo.product) — 제주/도서산간 추가 배송비.
 * 묶음배송 가능 여부가 true면 이 값은 무시된다(스펙 원문). */
export interface NaverDeliveryFeeByArea {
  deliveryAreaType: "AREA_2" | "AREA_3";
  /** 2권역: "제주 및 도서산간" 추가비. 3권역: "제주" 추가비. 최대 100,000. */
  area2extraFee?: number;
  /** "제주 외 도서산간" 추가비. deliveryAreaType이 AREA_3이면 필수. 최대 100,000. */
  area3extraFee?: number;
}

/** 확인됨(공식 OpenAPI, ExternalApiDeliveryFeeVo.product) — N-3.3에서 GitHub
 * 요약이 아니라 commerce-api-naver/commerce-api의 실제 OpenAPI 스펙 파일로
 * 재확인했다. 입력하지 않으면 FREE로 설정된다(스펙 원문). */
export interface NaverDeliveryFee {
  deliveryFeeType?: "FREE" | "CONDITIONAL_FREE" | "PAID" | "UNIT_QUANTITY_PAID" | "RANGE_QUANTITY_PAID";
  /** 기본 배송비. 최대 100,000. */
  baseFee?: number;
  /** 배송비 유형이 CONDITIONAL_FREE일 때만 입력. 최대 999,999,990. */
  freeConditionalAmount?: number;
  /** COLLECT(착불) | PREPAID(선결제) | COLLECT_OR_PREPAID(착불 또는 선결제). */
  deliveryFeePayType?: "COLLECT" | "PREPAID" | "COLLECT_OR_PREPAID";
  deliveryFeeByArea?: NaverDeliveryFeeByArea;
}

/** 확인됨(공식 OpenAPI, ExternalApiClaimDeliveryInfoVo.product) — N-3.3에서
 * 필드명뿐 아니라 각 필드의 정확한 의미/제약까지 원문 스펙으로 확인했다.
 * shippingAddressId(출고지 주소록 번호)/returnAddressId(반품/교환지 주소록
 * 번호)는 이름 자체가 addressBookNo(GET /v1/seller/addressbooks-for-page)를
 * 그대로 가리킨다 — N-2.6~N-3.2까지 "가정"으로 표시했던 매핑이 이제 확인됨으로
 * 승격된다. returnDeliveryCompanyPriorityType은 판매자가 실제 등록해 둔 반품
 * 택배사 중 우선순위를 고르는 값이다(GET /v2/product-delivery-info/
 * return-delivery-companies로 실제 등록된 택배사 목록을 조회해야 의미가
 * 있다 — "CJGLS" 같은 문자열 코드가 아니라 PRIMARY/SECONDARY_1..9 enum). */
export interface NaverClaimDeliveryInfo {
  /** 확인됨(공식 OpenAPI) — 반품/교환지 주소록 번호. addressType=REFUND_OR_EXCHANGE
   * 의 addressBookNo. */
  returnAddressId?: number;
  /** 확인됨(공식 OpenAPI) — 출고지 주소록 번호. addressType=RELEASE의
   * addressBookNo. deliveryInfo에는 이 필드가 없다(N-2.6의 outboundLocationId
   * 가정은 틀렸다 — 실제로 존재하지 않는 필드였다, N-3.3에서 제거). */
  shippingAddressId?: number;
  /** 확인됨(공식 OpenAPI) — "미입력 시 기본 반품 택배사(PRIMARY)로 설정됩니다."
   * 판매자가 등록해 둔 반품 택배사가 최소 1곳 있어야 의미가 있다(없으면 이
   * 값을 채워도 실제로 무엇을 가리키는지 CartPilot이 확인할 수 없다). */
  returnDeliveryCompanyPriorityType?:
    | "PRIMARY"
    | "SECONDARY_1"
    | "SECONDARY_2"
    | "SECONDARY_3"
    | "SECONDARY_4"
    | "SECONDARY_5"
    | "SECONDARY_6"
    | "SECONDARY_7"
    | "SECONDARY_8"
    | "SECONDARY_9";
  /** 확인됨(공식 OpenAPI) — 반품 배송비, 필수, 최대 1,000,000원. */
  returnDeliveryFee?: number;
  /** 확인됨(공식 OpenAPI) — 교환 배송비, 필수, 최대 1,000,000원. */
  exchangeDeliveryFee?: number;
  freeReturnInsuranceYn?: boolean;
}

/** 확인됨(공식 OpenAPI, ExternalApiDeliveryInfoVo.product) — N-3.3에서
 * outboundLocationId 필드가 실제로는 존재하지 않는다는 걸 확인했다(제거함,
 * 출고지는 claimDeliveryInfo.shippingAddressId 하나로 통일). */
export interface NaverDeliveryInfo {
  /** DELIVERY(택배/소포/등기) | DIRECT(직접배송/화물배달). */
  deliveryType?: "DELIVERY" | "DIRECT";
  /** NORMAL(일반배송) | TODAY(오늘출발) | OPTION_TODAY(옵션별 오늘출발) |
   * HOPE(희망일배송) | TODAY_ARRIVAL | DAWN_ARRIVAL. */
  deliveryAttributeType?: "NORMAL" | "TODAY" | "OPTION_TODAY" | "HOPE" | "TODAY_ARRIVAL" | "DAWN_ARRIVAL";
  /** 확인됨(공식 OpenAPI) — "DELIVERY일 때 필수 입력"이라고만 명시돼 있고 실제
   * 유효 코드 목록/조회 API는 스펙에 없다(N-2.5/N-3.3 모두 확인 — 반품 택배사
   * 조회 API(return-delivery-companies)는 있지만 출고 택배사 전용 API는
   * 없다). 값을 임의로 채우지 않는다 — BLOCKED로 유지. */
  deliveryCompany?: string;
  deliveryFee?: NaverDeliveryFee;
  claimDeliveryInfo?: NaverClaimDeliveryInfo;
}

/** 확인됨(production GET, N-2.4) — attributeSeq/attributeValueSeq 기반. 문자열을
 * 직접 보내지 않고 카테고리 속성 조회 API로 확인한 ID 쌍만 사용한다. */
export interface NaverProductAttributeValue {
  attributeSeq: number;
  attributeValueSeq: number;
}

/** 확인됨(공식 OpenAPI, ExternalApiOptionCombinationVo.product, N-3.4) —
 * 필드명뿐 아니라 각 필드 설명까지 원문 스펙으로 재확인했다.
 * - id(int64, "옵션 ID 입력 시 기존 옵션 수정"): 신규 상품 등록에는 절대
 *   채우지 않는다 — CartPilot의 SKU를 여기 넣으면 "이 SKU가 곧 기존 네이버
 *   옵션 ID"라는 잘못된 값이 되어 수정 요청으로 오인될 위험이 있다(N-2.8 때
 *   실제로 이 버그가 있었다 — id에 variant.sku를 넣고 있었음, N-3.4에서 수정).
 * - price(int32, "옵션가", "미입력 시 0원"): 절대 판매가인지 salePrice 대비
 *   추가금액인지는 스펙 문구만으로 100% 단정할 수 없다(기본값 0원이 "추가금액
 *   없음"과는 자연스럽게 맞지만 "절대가 0원"일 수도 있어 실제 등록 성공 전까지
 *   확정하지 않는다) — validate-payload.ts가 여전히 BLOCKED 처리.
 * - sellerManagerCode(string, "판매자 관리 코드"): CartPilot의 SKU는 여기
 *   넣는다(id와 달리 "기존 옵션 수정"이라는 부작용이 없는 순수 식별용 필드).
 * - usable(boolean, 기본값 true). */
export interface NaverOptionCombination {
  /** 신규 등록 시 항상 undefined로 둔다("기존 옵션 수정" 트리거 필드라서). */
  id?: number;
  optionName1?: string;
  optionName2?: string;
  optionName3?: string;
  optionName4?: string;
  stockQuantity: number;
  price: number;
  sellerManagerCode?: string;
  usable?: boolean;
}

/** 확인됨(GitHub #241 원문 코드 예제, N-2.8) — 조합형 옵션 컨테이너. */
export interface NaverOptionInfo {
  useStockManagement?: boolean;
  optionCombinationGroupNames?: string[];
  optionCombinations?: NaverOptionCombination[];
}

/** 확인됨(공식 OpenAPI + GET /v1/product-origin-areas 실측, N-3.4) —
 * originAreaCode enum이 이제 100% 확인됨. `GET /v1/product-origin-areas`
 * (commerce-api-naver discussion #3632, 공식 계정 공지 "행정체계 개편에 따른
 * 상품 원산지 수정 필요"로 발견)를 production 계정으로 호출해서 535개 실제
 * 코드/이름 쌍을 확인했다 — 최상위 6개: 00(국산)/01(원양산)/02(수입산)/
 * 03(상세설명에 표시)/04(직접입력)/05(원산지 표기 의무대상 아님), 02 하위에
 * 234개 국가 리프 노드(예: "0201025"="수입산:유럽>스페인"). 03/04 값이
 * 실제로 쓰인다는 건 discussion #3531(공식 계정 답변)에서도 교차 확인됨. */
export interface NaverOriginAreaInfo {
  /** GET /v1/product-origin-areas로 조회한 실제 코드(추측 금지 — packages/
   * listing/src/naver/origin-match.ts의 resolveNaverOriginArea가 매칭). */
  originAreaCode?: string;
  /** "수입사명, 수입산인 경우 필수" — CartPilot에는 이 값의 소스가 없어(제조사와
   * 별개 개념) originAreaCode가 02(수입산) 계열로 매칭되면 항상 MISSING으로
   * 표시한다(validate-payload.ts). */
  importer?: string;
  /** "originAreaCode가 '기타: 직접 입력'(04)인 경우 필수" — 그 외에는 채우지 않는다. */
  content?: string;
  plural?: string;
}

export interface NaverDetailAttribute {
  productInfoProvidedNotice?: NaverProductInfoProvidedNotice;
  originAreaInfo?: NaverOriginAreaInfo;
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
