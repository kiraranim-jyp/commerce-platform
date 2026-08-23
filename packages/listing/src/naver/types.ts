/**
 * Sprint N-2.6 — Naver Commerce API v2 상품등록(`POST /v2/products`) request
 * body 타입. N-2.4/N-2.5에서 production read-only API로 실제 확인한 필드만
 * 넣는다. 확인 안 된 필드는 옵셔널로 두고 주석에 "미확인"이라고 명시한다 —
 * 임의로 필드를 지어내지 않는다(CPO 반복 지시).
 *
 * 확인 방법:
 * - "확인됨(공식 OpenAPI 스펙)": commerce-api-naver/commerce-api의
 *   docs/2.0.0-RC.js(공식 OpenAPI 3.0.3 스펙)에서 직접 확인한 필드/타입/제약.
 * - "확인됨(production GET)": Sprint N-2.4/N-2.5에서 실제 프로덕션 인증으로 호출해서
 *   받은 실제 응답(카테고리/속성/고시/주소록).
 * - "미확인": 어느 쪽으로도 확인 못함 — 구현에서 값을 넣지 않고 validation이
 *   BLOCKED로 표시한다.
 *
 * N-3.6 정정 — 과거 "GitHub #241 원문 코드 예제로 확인됨"이라고 적었던 항목들은
 * discussion #241을 다시 읽어보니 실제로는 한 사용자가 GET 파라미터로 잘못 보낸
 * 요청을 메인테이너가 "형식이 잘못됐다"고 지적한 스레드였다 — 즉 필드값이
 * 공식적으로 확인된 적이 없었다(사용자의 추측을 마치 공식 예제처럼 잘못
 * 인용한 것). 다행히 필드명/구조 자체는 N-3.3/N-3.4에서 공식 OpenAPI 스펙으로
 * 별도 재확인됐기 때문에 실제 값에는 문제가 없었다 — 아래 주석들을 인용
 * 출처만 정정한다(추측 근거를 정식 근거로 교체).
 */

/** 확인됨(공식 OpenAPI 스펙) — images는 단순 URL 문자열이 아니라 object로 감싼다. */
export interface NaverImageRef {
  url: string;
}

export interface NaverImages {
  representativeImage: NaverImageRef;
  optionalImages?: NaverImageRef[];
}

/** N-3.51 STEP1(CPO 지시, 실제 등록 5차 시도 실패 원인 재조사) — 지금까지
 * productInfoProvidedNoticeType과 같은 레벨에 material/color/size 등을
 * 평평하게(flat) 담고 있었는데, 실제 Naver API는 이 값들을 productInfoProvidedNoticeType과
 * 같은 값을 소문자로 쓴 하위 키(wear/kids)로 한 번 더 감싼 객체를 요구한다
 * (실제 등록 시도에서 "productInfoProvidedNotice.wear" NotEmpty로 거부 확인,
 * 이후 WebSearch로 commerce-api-naver 공식 GitHub Discussion #241/#516에서
 * "productInfoProvidedNoticeType을 WEAR로 설정하면 productInfoProvidedNotice
 * 필드는 wear를 자식 노드로만 가져야 한다"는 설명과 실제 payload 예시를
 * 2개 독립 출처로 재확인했다). 필드 목록 자체는 이전과 같다(docs/
 * naver-provided-notice-types-raw.json 실측 GET 응답 기준) — 감싸는 껍데기만
 * 바뀐다.
 */
export interface NaverWearNoticeFields {
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

/** 확인됨(production GET, N-2.4) — KIDS 고시유형(어린이제품)의 실제 필드.
 * 아동복 대상 카테고리(exceptionalCategories에 CHILD_CERTIFICATION 포함)는
 * WEAR(의류) 대신 KIDS를 쓰는 게 맞다고 판단했다 — 다만 이건 CartPilot의 판단이지
 * 네이버가 "이 카테고리는 반드시 KIDS를 써야 한다"고 명시한 건 아니라서
 * mapper에서 이 가정을 주석으로 남긴다. */
export interface NaverKidsNoticeFields {
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

export interface NaverProductInfoProvidedNoticeKids {
  productInfoProvidedNoticeType: "KIDS";
  kids: NaverKidsNoticeFields;
}

export interface NaverProductInfoProvidedNoticeWear {
  productInfoProvidedNoticeType: "WEAR";
  wear: NaverWearNoticeFields;
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
  /** 확인됨(공식 OpenAPI, N-3.85 STEP6) — "반복 수량. 배송비 유형이 '수량별
   * 부과 - 반복 구간'일 경우 입력합니다." deliveryFeeType이
   * UNIT_QUANTITY_PAID일 때 baseFee를 이 수량 단위로 반복 부과한다(구간별
   * 추가금액이 아니라 "N개마다 기본 배송비를 다시 부과"하는 구조 — 2단계
   * 요금 모델과 다르다). */
  repeatQuantity?: number;
  /** 확인됨(공식 OpenAPI, N-3.85 STEP6) — deliveryFeeType이
   * RANGE_QUANTITY_PAID(구간별 직접 설정)일 때 사용하는 2/3구간 최소 수량 및
   * 초과 시 추가 배송비. "첫 N개는 기본가, 그 이후 M개당 얼마씩 추가"라는
   * 흔한 요금 구조는 UNIT_QUANTITY_PAID가 아니라 이 필드들로 표현한다. */
  secondBaseQuantity?: number;
  secondExtraFee?: number;
  thirdBaseQuantity?: number;
  thirdExtraFee?: number;
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
  /** 확인됨(공식 OpenAPI, ExternalApiDeliveryInfoVo.product, N-3.85 STEP5 —
   * commerce-api-naver/commerce-api docs/2.0.0-RC.js 원문 스펙으로 직접 확인) —
   * "묶음배송 가능 여부. 묶음배송 그룹 코드가 존재하는 경우 자동으로 true로
   * 설정됩니다." 대표님 지시(N-3.85: "묶음배송 = 항상 사용")로 고정값 true를
   * 보낸다. */
  deliveryBundleGroupUsable?: boolean;
  /** 확인됨(공식 OpenAPI) — "묶음배송 가능이 true이고 묶음배송 그룹 코드가
   * null이면 기본 그룹으로 저장됩니다." 판매자가 Wing에서 커스텀 묶음배송
   * 그룹(예: MIN/MAX 배송비 계산 방식이 다른 여러 그룹)을 만들지 않는 한
   * null로 두면 Naver 기본 그룹을 그대로 쓴다 — CartPilot이 묶음배송 그룹을
   * 새로 만들거나 추측으로 특정 그룹 ID를 넣지 않는다. */
  deliveryBundleGroupId?: number | null;
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
 * - price(int32, "옵션가", "미입력 시 0원"): N-3.47(CPO 지시)에서 공식 확인됨 —
 *   Naver Commerce API 공식 계정(commerce-api-naver)이 GitHub Discussion #2312
 *   (2025-02-17)에서 "'옵션가'는 상품 판매 가격에 따라 설정할 수 있는 범위가
 *   다르며 음수로 설정할 수도 있습니다. 따라서 옵션 선택 시, 실제 상품 판매
 *   가격이 0원 미만으로 설정되는 것을 방지하기 위하여 '옵션가' 필드가 요청
 *   데이터 내에 포함된 경우, '상품 판매 가격' 필드도 필수로 입력받고 있습니다"
 *   라고 직접 답변했다 — salePrice 대비 추가금액(delta)이 아니면 "옵션 선택 시
 *   실제 판매가가 0원 미만이 될 수 있다"는 설명 자체가 성립하지 않는다(절대가라면
 *   price 자체만 음수 여부를 확인하면 되고 salePrice와 비교할 이유가 없다).
 *   build-payload.ts의 priceDelta 계산(variant.price 있으면 salePrice와의
 *   차액, 없으면 0)은 이 의미와 정확히 일치 — validate-payload.ts는 더 이상
 *   이 필드를 관행 기반 BLOCKED로 취급하지 않고, 실제로 계산 가능한 제약
 *   (옵션 선택 시 최종 판매가가 0원 미만이 되지 않는지)만 검사한다.
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

/** N-3.49(실제 등록 시도로 확인, 2026-08-17) — optionCombinationGroupNames를
 * 배열(`string[]`)로 보냈더니 실제 Naver API가 HTTP 400으로 거부했다:
 * "Cannot deserialize value of type `KrExternalApiOptionCombinationNamesVo`
 * from Array value" — 이 클래스명 자체가 배열이 아니라 명명된 필드를 가진
 * 객체(Value Object)라는 뜻이다. 웹 검색으로 공식 커뮤니티 설명 재확인:
 * "optionCombinationGroupNames는 optionGroupName1, optionGroupName2,
 * optionGroupName3, optionGroupName4로 구성되며" — NaverOptionCombination의
 * optionName1-4와 정확히 대칭되는 구조다. 배열 버전은 한 번도 실제 등록에
 * 성공한 적이 없었다(옵션이 있는 상품은 전부 KC/기타 사유로 이 단계 전에
 * 막혀 있었다 — 이번이 옵션 있는 상품이 처음으로 실제 POST까지 도달한
 * 케이스). */
export interface NaverOptionCombinationGroupNames {
  optionGroupName1?: string;
  optionGroupName2?: string;
  optionGroupName3?: string;
  optionGroupName4?: string;
}

/** 확인됨(공식 OpenAPI 스펙) — 조합형 옵션 컨테이너. */
export interface NaverOptionInfo {
  useStockManagement?: boolean;
  optionCombinationGroupNames?: NaverOptionCombinationGroupNames;
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

/** N-3.49(2026-08-17, 실제 등록 3차 시도로 발견) — Voyage Dress가 옵션
 * 스키마 수정 후 처음으로 Naver의 실제 비즈니스 검증 단계까지 도달했고,
 * 거기서 이 필드가 NotNull로 거부됐다("데이터를 입력해 주세요"). WebSearch로
 * 확인한 공식 커뮤니티 예시 payload 기준 — productInfoProvidedNotice.
 * afterServiceDirector(고시용 자유 텍스트, 예: "해외 구매대행으로 A/S
 * 불가")와는 별개의 필드다. */
export interface NaverAfterServiceInfo {
  afterServiceTelephoneNumber?: string;
  afterServiceGuideContent?: string;
}

/** N-3.65(2026-08-20, 실제 등록으로 발견) — 어린이인증 대상 카테고리는
 * naverShoppingSearchInfo.modelName이 NotEmpty로 요구된다("카탈로그 입력이
 * 필수입니다"). 공식 스펙 확인 결과 modelId(네이버 카탈로그 상품 ID, 선택)와
 * modelName(자유 텍스트 모델명, 문자열)은 별개 필드 — modelName은 카탈로그
 * 매칭을 강제하지 않는다. modelId는 CartPilot이 알 수 없으므로 채우지 않는다
 * (임의 값 금지). */
/** N-3.76(2차, CPO 지시: "제조사명/브랜드명이 스마트스토어센터에 - 로 표시된다")
 * — manufacturerName/brandName은 공식 스펙상 이 객체(originProduct.detailAttribute.
 * naverShoppingSearchInfo)에 속한 필드인데, modelName만 구현하고 이 둘은 아예
 * 빠져 있었다(버그가 아니라 미구현). CanonicalProduct.brand/manufacturer는 이미
 * 있는 값이라 build-payload.ts에서 그대로 연결한다. */
export interface NaverShoppingSearchInfo {
  modelName?: string;
  manufacturerName?: string;
  brandName?: string;
}

export interface NaverDetailAttribute {
  productInfoProvidedNotice?: NaverProductInfoProvidedNotice;
  originAreaInfo?: NaverOriginAreaInfo;
  optionInfo?: NaverOptionInfo;
  naverShoppingSearchInfo?: NaverShoppingSearchInfo;
  afterServiceInfo?: NaverAfterServiceInfo;
  /** 확인됨(공식 OpenAPI, ExternalApiBaseProductDetailAttributeVo.product,
   * N-4.00 A-2에서 실제 스펙 파일로 재확인) — 필수 아님(required 배열에 없음).
   * NaverProductAttributeValue({attributeSeq, attributeValueSeq})가 정확한
   * 형태다. resolveNaverProductAttributes()가 계산한 결과만 여기 채운다. */
  productAttributes?: NaverProductAttributeValue[];
  /** N-3.67(2026-08-20, 5연속 동일 거부 후 공식 OpenAPI 스키마 재확인) —
   * ExternalApiBaseProductDetailAttributeVo.product의 실제 property 목록을
   * 직접 열어서 확인한 결과, productCertificationInfos/
   * certificationTargetExcludeContent는 originProduct의 형제(sibling)가
   * 아니라 detailAttribute의 자식이다. 지금까지 5차 실측 전부 이 필드를
   * originProduct 최상위(NaverOriginProduct)에 넣고 있었다 — 그 결과 실제
   * 요청에서 detailAttribute 안쪽은 "정말로 비어 있는 상태"였고, Naver가
   * 매번 정확히 같은 "Empty...kindType"으로 거부한 이유였다(값/id/kindType을
   * 5번 바꿔도 위치 자체가 틀려서 Naver 파서가 아예 보지 못했다). 실제
   * 실패 응답의 invalidInputs[0].name도 항상
   * "originProduct.detailAttribute.productCertificationInfos"였다 — 이 경로를
   * 문자 그대로 신뢰하지 않고 무시했던 게 5차 반복 실패의 진짜 원인이다. */
  productCertificationInfos?: NaverProductCertificationInfo[];
  certificationTargetExcludeContent?: NaverCertificationTargetExcludeContent;
  /** N-3.49(2026-08-17, 실제 등록 3차 시도로 발견) — "미성년자 구매 가능
   * 여부"(NotNull). 성인용/연령제한 카테고리가 아닌 한 true. */
  minorPurchasable?: boolean;
  /** N-3.51 STEP6(2026-08-17, 실제 등록 7차 시도로 발견) — 출고지가 해외
   * 주소인 경우 필수("customsTaxType.required.overseas"). 공식 GitHub
   * Discussion #3569(commerce-api-naver 계정, 그룹상품 관부가세 필드
   * 변경 공지)에서 실제 enum 값 확인:
   * "NOT_APPLICABLE"(관부가세 부과 대상 아님) / "INCLUDED"(관부가세 포함,
   * 상품 가격에 이미 포함) / "EXCLUDED"(관부가세 미포함, 구매자가 결제
   * 시점 이후 별도 부담). CartPilot의 판매가(salePrice)는 이미 원가+마진+
   * 수수료를 반영한 단일 최종가로 계산되고(packages/pricing) 체크아웃에서
   * 관부가세를 별도 항목으로 청구하는 흐름이 없으므로 "INCLUDED"가 실제
   * 가격 구조와 일치하는 값이다 — 임의 추측이 아니라 기존 가격 모델과의
   * 일관성에 근거한 선택. */
  customsTaxType?: "NOT_APPLICABLE" | "INCLUDED" | "EXCLUDED";
}

/** N-3.66(2026-08-20, CEO 승인 사업 정책 실험) — 공식 스펙(ExternalApiCertificationTargetExcludeContentVo.product)
 * 확인 결과, "어린이제품 인증 대상" 카테고리 상품이 실제 인증서가 없을 때
 * 무조건 등록 불가가 아니라, 해외구매대행/병행수입/안전기준준수 같은 정당한
 * 사유가 있으면 이 구조로 면제를 신고할 수 있다. TTAEJYO는 실제로 100%
 * 해외구매대행 사업(이미 payload 전역에서 이 사실을 전제로 함 —
 * afterServiceGuideContent/customsTaxType 등)이라 kcExemptionType:"OVERSEAS"는
 * 상품마다 새로 판단하는 값이 아니라 사업 모델 자체를 있는 그대로 신고하는
 * 것이다(임의 KC 인증정보 생성이 아님). CEO 승인(2026-08-20) 하 최소 1회
 * 실제 Naver 응답으로 이 필드 조합이 맞는지 검증 중 — 틀리면 raw
 * invalidInputs 원문 기준으로만 수정한다(추측 금지). */
export interface NaverCertificationTargetExcludeContent {
  childCertifiedProductExclusionYn?: boolean;
  kcCertifiedProductExclusionYn?: "TRUE" | "FALSE" | "KC_EXEMPTION_OBJECT";
  kcExemptionType?: "OVERSEAS" | "SAFE_CRITERION" | "PARALLEL_IMPORT";
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
  /** 확인됨(공식 OpenAPI, ExternalApiOriginProductVo.product) — "판매자 상품코드"
   * (Seller Center 상품목록의 "판매자상품코드" 컬럼). 옵션별 sellerManagerCode와
   * 달리 상품 전체를 가리키는 단일 값이다. CartPilot이 임의로 만들지 않고
   * 원본 페이지에서 실제 추출된 product.sku가 있을 때만 채운다(없으면 생략 —
   * 값 지어내기 금지 원칙 유지). */
  sellerManagementCode?: string;
}

/** 확인됨(공식 OpenAPI 스펙, ExternalApiSmartstoreChannelProductVo.product,
 * N-3.5/N-3.6 재검증) — required: channelProductDisplayStatusType,
 * naverShoppingRegistration(둘 다 필수인데 N-3.5 이전까지는 놓치고 있었다).
 * channelProductDisplayStatusType은 "ON, SUSPENSION만 입력 가능"이라고 스펙에
 * 명시돼 있다 — WAIT은 응답에만 나오는 상태이지 입력 가능한 값이 아니다
 * (N-2.6부터 여기 WAIT을 쓰고 있던 게 실제 버그였음, N-3.5에서 수정).
 * naverShoppingRegistration은 "네이버 쇼핑 광고주가 아닌 경우 false로 강제
 * 저장"된다고 스펙에 적혀 있고, 광고주 여부를 조회하는 API를 공식 스펙 어디서도
 * 찾지 못했다(N-3.6 재확인) — CartPilot이 임의로 true/false를 정할 근거가
 * 없어 항상 비워두고 validate-payload.ts가 MISSING으로 표시한다. */
export interface NaverSmartstoreChannelProduct {
  channelProductName?: string;
  /** 선택. 미입력 시 false(알림받기 동의 회원 전용 상품 아님)로 저장된다. */
  storeKeepExclusiveProduct?: boolean;
  /** 필수. "네이버 쇼핑 광고주가 아닌 경우에는 false로 저장됩니다" — 조회 API
   * 미확인이라 CartPilot은 값을 채우지 않는다(항상 MISSING). */
  naverShoppingRegistration?: boolean;
  /** 선택("콘텐츠 게시글 일련번호" — 공지사항 게시글 연결용). CartPilot이
   * 관리하는 게시판이 없어 채우지 않는다(등록 자체에 필수는 아니라 이슈로
   * 표시하지 않는다). */
  bbsSeq?: number;
  /** 필수. ON | SUSPENSION만 입력 가능(WAIT은 응답 전용 상태). */
  channelProductDisplayStatusType?: "ON" | "SUSPENSION";
}

/** 확인됨(GitHub #337) — POST /v2/products의 최상위 구조. */
export interface NaverProductRegistrationPayload {
  originProduct: NaverOriginProduct;
  smartstoreChannelProduct: NaverSmartstoreChannelProduct;
}
