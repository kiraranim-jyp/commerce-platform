import type { CanonicalProduct } from "@commerce/shared";
import type { NaverPayloadInput } from "./build-payload";
import type { NaverProductRegistrationPayload } from "./types";

/**
 * Sprint N-2.6 — 실제 POST 없이 payload가 등록 가능한 수준인지 검증한다.
 * "필드가 확인 안 됐다"와 "필드가 비어있다"를 구분한다 — 전자는 BLOCKED(임의
 * 값을 넣을 수 없어서 아예 진행 불가), 후자는 일반 필수값 누락으로 취급한다.
 *
 * Sprint N-3.5(Final Validator) — 이전까지는 "문제 있는 필드만" issues 배열에
 * 담고, Preview 쪽에서 countTotalCheckedFields()라는 별도 근사 함수로
 * READY 개수를 "전체 - 문제개수"로 역산했다(하드코딩된 BASE 상수 유지보수
 * 필요, 실제 검사 로직과 분리돼 있어 어긋날 위험). 이제 이 함수 자체가 검사한
 * "모든" 필드(문제없는 것 포함)를 fields 배열로 반환하고, READY/MISSING/
 * BLOCKED 개수도 함께 계산해서 돌려준다 — Preview는 이 값을 그대로 쓰고
 * 별도로 재계산하지 않는다(CPO 지시, "Preview에서 별도 판단 로직을 만들지
 * 않는다").
 */
export interface NaverPayloadValidationIssue {
  field: string;
  reason: string;
  /** BLOCKED: 스키마가 확인 안 됐거나 CartPilot이 만들어낼 수 없는 값(실제 인증
   * 정보 등)이라 이 상태로는 등록 시도조차 하면 안 된다.
   * MISSING: 값을 확인/입력하면 채울 수 있는 일반 필수값 누락. */
  severity: "BLOCKED" | "MISSING";
}

export interface NaverPayloadFieldCheck {
  field: string;
  status: "READY" | "MISSING" | "BLOCKED";
  /** READY가 아닐 때만 채운다. */
  reason?: string;
}

export interface NaverPayloadValidationResult {
  ok: boolean;
  readyCount: number;
  missingCount: number;
  blockedCount: number;
  /** 이 상품/카테고리에서 실제로 검사한 모든 필드(문제없는 것 포함) — 옵션/
   * 인증/수입사명처럼 상품마다 있고 없고가 달라지는 항목은 해당될 때만 담긴다. */
  fields: NaverPayloadFieldCheck[];
  /** fields 중 READY가 아닌 것만 골라 기존 UI(클릭 시 섹션 이동 등)와 호환되는
   * 모양으로 다시 담은 배열 — 하위호환을 위해 유지한다. */
  issues: NaverPayloadValidationIssue[];
}

function check(
  fields: NaverPayloadFieldCheck[],
  field: string,
  ok: boolean,
  severity: "MISSING" | "BLOCKED",
  reason: string,
): void {
  fields.push(ok ? { field, status: "READY" } : { field, status: severity, reason });
}

function blocked(fields: NaverPayloadFieldCheck[], field: string, reason: string): void {
  fields.push({ field, status: "BLOCKED", reason });
}

/**
 * categoryRequiresChildCertification — N-2.4에서 확인한 카테고리 detail의
 * exceptionalCategories에 CHILD_CERTIFICATION이 있는지(호출부가 판단해서 넘긴다,
 * 이 함수는 카테고리 API를 다시 호출하지 않는다).
 */
export function validateNaverPayload(
  payload: NaverProductRegistrationPayload,
  input: Pick<
    NaverPayloadInput,
    | "product"
    | "releaseAddressBookNo"
    | "refundAddressBookNo"
    | "primaryReturnDeliveryCompanyPriorityType"
    | "returnDeliveryFee"
    | "exchangeDeliveryFee"
    | "childCertificationInfoId"
    | "originAreaCode"
    | "deliveryCompany"
    | "warrantyPolicy"
    | "afterServiceDirector"
  > & {
    /** N-3.3 — 반품 택배사 목록 조회 자체가 실패했는지(계정/네트워크 문제 등).
     * 실패와 "택배사 미등록"은 서로 다른 사유라 구분한다. */
    returnCompaniesFetchFailed: boolean;
    /** N-3.4 — originAreaCode가 수입산(02) 계열로 매칭됐는지. true면
     * originAreaInfo.importer가 스펙상 필수인데 CartPilot에는 이 값의
     * 소스가 없어(제조사와 별개 개념) 항상 MISSING으로 표시한다. */
    originAreaRequiresImporter: boolean;
  },
  categoryRequiresChildCertification: boolean,
): NaverPayloadValidationResult {
  const fields: NaverPayloadFieldCheck[] = [];
  const { originProduct } = payload;

  check(fields, "originProduct.leafCategoryId", Boolean(originProduct.leafCategoryId), "MISSING", "리프 카테고리 ID가 없습니다.");
  check(fields, "originProduct.name", Boolean(originProduct.name), "MISSING", "상품명이 없습니다.");
  check(
    fields,
    "originProduct.images.representativeImage",
    Boolean(originProduct.images.representativeImage.url),
    "MISSING",
    "대표 이미지가 없습니다.",
  );
  // N-3.5 — detailContent는 공식 OpenAPI에서 "상품 수정 시에만 생략 가능"이라고
  // 명시된 필수 필드(ExternalApiOriginProductVo.product required 목록)인데
  // 지금까지 이 파일에서 별도로 검사한 적이 없었다(재검증 중 발견).
  check(fields, "originProduct.detailContent", Boolean(originProduct.detailContent), "MISSING", "상품 상세 설명이 없습니다.");
  check(
    fields,
    "originProduct.salePrice",
    Boolean(originProduct.salePrice) && originProduct.salePrice > 0,
    "MISSING",
    "판매가가 없거나 0 이하입니다.",
  );
  check(
    fields,
    "originProduct.stockQuantity",
    Boolean(originProduct.stockQuantity) && originProduct.stockQuantity > 0,
    "MISSING",
    "재고 수량이 없거나 0 이하입니다.",
  );

  // N-3.3 — claimDeliveryInfo.shippingAddressId/returnAddressId가 addressBookNo를
  // 그대로 가리킨다는 게 공식 OpenAPI 스펙(제목 "출고지 주소록 번호"/"반품/교환지
  // 주소록 번호")으로 확인됐다 — N-2.6~N-3.2까지의 BLOCKED("매핑이 실제 등록으로
  // 검증되지 않음")는 더 이상 정확하지 않다. 이제는 값이 있으면 READY, 없으면
  // 일반 MISSING(판매자 주소록 등록 필요)으로만 취급한다.
  check(
    fields,
    "claimDeliveryInfo.shippingAddressId",
    input.releaseAddressBookNo !== null,
    "MISSING",
    "출고지 주소(addressType=RELEASE)를 찾지 못했습니다 — 판매자 주소록에 등록 필요.",
  );
  check(
    fields,
    "claimDeliveryInfo.returnAddressId",
    input.refundAddressBookNo !== null,
    "MISSING",
    "반품지 주소(addressType=REFUND_OR_EXCHANGE)를 찾지 못했습니다 — 판매자 주소록에 등록 필요.",
  );

  // N-3.6(개정 Part A) — 출고 택배사 조회 API는 여전히 없다(N-2.5/N-3.3/N-3.5/
  // N-3.6 재확인, 배송 관련 스키마 전수 확인 포함). 하지만 Coupang의
  // deliveryCompanyCode와 같은 패턴으로 판매자가 Settings에서 직접 입력할 수
  // 있게 됐으므로, "해결 불가"인 BLOCKED가 아니라 "입력하면 해결됨"인
  // MISSING이 정확하다 — 값이 있으면 READY.
  check(
    fields,
    "deliveryInfo.deliveryCompany",
    Boolean(input.deliveryCompany),
    "MISSING",
    "출고 택배사가 입력되어 있지 않습니다 — Settings의 배송 프로필에서 네이버 택배사를 입력하면 해결됩니다(공식 조회 API는 없어 직접 입력이 필요합니다).",
  );

  // N-3.3 — 반품 택배사는 실제 조회 API(GET /v2/product-delivery-info/
  // return-delivery-companies)가 확인됐다. 조회 자체가 실패하면 BLOCKED(계정/
  // 네트워크 문제로 확인 불가), 조회는 됐는데 판매자가 하나도 등록 안 했으면
  // MISSING(Wing에서 등록 필요), 있으면 READY(스펙상 미입력해도 PRIMARY가
  // 기본값이라 별도 이슈를 남기지 않는다).
  if (input.returnCompaniesFetchFailed) {
    blocked(fields, "claimDeliveryInfo.returnDeliveryCompanyPriorityType", "반품 택배사 목록 조회에 실패했습니다(네이버 API 오류).");
  } else {
    check(
      fields,
      "claimDeliveryInfo.returnDeliveryCompanyPriorityType",
      input.primaryReturnDeliveryCompanyPriorityType !== null,
      "MISSING",
      "판매자 계정에 등록된 반품 택배사가 없습니다 — Wing에서 반품 택배사 등록 필요.",
    );
  }

  check(
    fields,
    "claimDeliveryInfo.returnDeliveryFee",
    input.returnDeliveryFee !== null,
    "MISSING",
    "반품 배송비 정책이 설정되어 있지 않습니다 — Settings에서 판매자 배송 정책 입력 필요.",
  );
  check(
    fields,
    "claimDeliveryInfo.exchangeDeliveryFee",
    input.exchangeDeliveryFee !== null,
    "MISSING",
    "교환 배송비 정책이 설정되어 있지 않습니다 — Settings에서 판매자 배송 정책 입력 필요.",
  );

  if (categoryRequiresChildCertification) {
    if (input.childCertificationInfoId === null) {
      blocked(fields, "productCertificationInfos", "이 카테고리는 어린이제품 인증(CHILD_CERTIFICATION)이 필요하지만 실제 인증정보가 없습니다.");
    } else {
      // certificationInfoId는 있지만, 실제 인증서 번호/업체명/취득일자는 CartPilot이
      // 만들어낼 수 없는 값이라 payload에 아예 넣지 않았다 — 이것도 항상 BLOCKED.
      blocked(
        fields,
        "productCertificationInfos[].certificationNumber",
        "실제 인증서 번호/업체명/취득일자는 판매자가 직접 입력해야 합니다(임의 생성 금지).",
      );
    }
  }

  // N-3.13 Part E-12(CPO 지시: "고시정보를 절대 임의로 🟢 처리하지 않는다") —
  // build-payload.ts는 productInfoProvidedNotice(WEAR/KIDS)를 항상 만들지만,
  // 이 파일은 지금까지 그 안의 개별 필드가 실제로 채워졌는지 전혀 검사하지
  // 않았다(재검증 중 발견 — 항상 거짓 READY였던 gap). 공식 OpenAPI 스펙
  // (ExternalApiWearInfoProvidedNoticeVo.product / ExternalApiKidsInfoProvidedNoticeVo.product)
  // 의 required 배열을 직접 확인해 두 그룹으로 나눴다:
  //
  // 1) returnCostReason/noRefundReason/qualityAssuranceStandard/
  //    compensationProcedure/troubleShootingContents — 스펙 설명에 "미입력 시
  //    상품상세 참조로 입력됩니다"라고 명시돼 있다(Naver 서버가 값이 없으면
  //    자동으로 상품상세 참조 문구를 채운다). CartPilot이 이 값을 만들지
  //    않아도 등록이 막히지 않는다는 뜻이라 임의 판단이 아니라 스펙 근거로
  //    READY 처리한다.
  // 2) material/color/manufacturer/caution/size/warrantyPolicy/
  //    afterServiceDirector(+KIDS 전용 certificationType/itemName/modelName/
  //    recommendedAge/weight) — 이런 자동 기본값 설명이 없는 진짜 필수
  //    콘텐츠다. material/color/manufacturer/caution/recommendedAge는
  //    product 필드에서, warrantyPolicy/afterServiceDirector는
  //    SellerProfile.qualityGuarantee/asContactNumber에서 채워지면 READY —
  //    size/certificationType/itemName/modelName/weight는 CartPilot에 소스
  //    자체가 없어(사이즈 옵션값을 고시 필드에 억지로 매핑하지 않는다) 항상
  //    MISSING이다(임의 값 금지, 향후 실제 입력 필드가 생기면 그때 READY로
  //    바뀐다).
  const notice = categoryRequiresChildCertification ? "kids" : "wear";
  const noticePrefix = notice === "kids" ? "productInfoProvidedNotice(KIDS)" : "productInfoProvidedNotice(WEAR)";
  for (const field of [
    "returnCostReason",
    "noRefundReason",
    "qualityAssuranceStandard",
    "compensationProcedure",
    "troubleShootingContents",
  ]) {
    fields.push({ field: `${noticePrefix}.${field}`, status: "READY" });
  }
  check(
    fields,
    `${noticePrefix}.material`,
    Boolean(input.product.material.value),
    "MISSING",
    "제품 소재가 없습니다 — 상품 원본/상세설명에서 확인되지 않았습니다.",
  );
  check(
    fields,
    `${noticePrefix}.color`,
    Boolean(input.product.color.value),
    "MISSING",
    "색상이 없습니다 — 상품 원본/상세설명에서 확인되지 않았습니다.",
  );
  check(
    fields,
    `${noticePrefix}.manufacturer`,
    Boolean(input.product.manufacturer.value),
    "MISSING",
    "제조자(사)가 없습니다 — 판매자 정보 기본값(Settings)에도 없습니다.",
  );
  check(
    fields,
    `${noticePrefix}.caution`,
    Boolean(input.product.careInstructions.value),
    "MISSING",
    "세탁 방법 및 취급 시 주의사항이 없습니다.",
  );
  check(
    fields,
    `${noticePrefix}.warrantyPolicy`,
    Boolean(input.warrantyPolicy),
    "MISSING",
    "품질 보증 기준이 없습니다 — Settings의 판매자 정보 탭에서 \"품질보증기준\"을 입력하면 해결됩니다.",
  );
  check(
    fields,
    `${noticePrefix}.afterServiceDirector`,
    Boolean(input.afterServiceDirector),
    "MISSING",
    "A/S 책임자와 전화번호가 없습니다 — Settings의 판매자 정보 탭에서 \"A/S 연락처\"를 입력하면 해결됩니다.",
  );
  check(fields, `${noticePrefix}.size`, false, "MISSING", "치수(사이즈) 정보가 없습니다 — CartPilot에 아직 입력 경로가 없습니다.");
  if (notice === "kids") {
    check(
      fields,
      "productInfoProvidedNotice(KIDS).recommendedAge",
      Boolean(input.product.recommendedAge.value),
      "MISSING",
      "사용연령이 없습니다 — 상품 원본/상세설명에서 확인되지 않았습니다.",
    );
    for (const field of ["certificationType", "itemName", "modelName", "weight"]) {
      check(
        fields,
        `productInfoProvidedNotice(KIDS).${field}`,
        false,
        "MISSING",
        "CartPilot에 아직 이 값을 채울 입력 경로가 없습니다(임의 값 금지).",
      );
    }
  }

  // N-2.8/N-3.4 — optionCombinations 필드명/각 필드 설명은 공식 OpenAPI로
  // 확인됐다(id는 "기존 옵션 수정용"이라 신규 등록엔 항상 비움, N-3.4에서
  // 수정된 실제 버그). 다만 price가 절대가/추가금액인지는 여전히 실제 등록
  // 성공 전까지 확인 안 됐다 — 이 값을 신뢰해서 그대로 등록에 쓰면 안 된다는
  // 걸 항상 상기시킨다.
  const product = input.product as CanonicalProduct;
  const hasOptions = product.optionGroups.length > 0;
  if (hasOptions) {
    blocked(
      fields,
      "detailAttribute.optionInfo",
      "optionCombinations 필드명/구조는 확인됨(공식 OpenAPI)이나 price 필드가 절대가인지 추가금액인지는 미확인 — 실제 등록 성공 검증 전까지 이 값을 신뢰할 수 없습니다.",
    );
    // N-3.4 — 옵션명은 있는데 특정 조합의 옵션값이 비어 있으면(원본 페이지
    // 파싱이 일부만 성공한 경우) price 의미와 무관하게 별도로 알려준다.
    const groupNames = product.optionGroups.map((g) => g.name);
    const hasIncompleteVariant = product.variants.some((v) => groupNames.some((name) => !v.optionValues[name]));
    check(
      fields,
      "detailAttribute.optionInfo.optionCombinations[].optionName",
      !hasIncompleteVariant,
      "MISSING",
      "일부 옵션 조합에 값이 비어 있는 옵션 그룹이 있습니다 — 원본 상품의 옵션 값을 확인해야 합니다.",
    );
  }

  // N-3.4 — originAreaCode는 GET /v1/product-origin-areas(535개 실제 코드)로
  // 확인됐다(더 이상 BLOCKED 아님). 원산지 텍스트 자체가 없으면 MISSING,
  // 수입산(02) 계열로 매칭됐으면 importer(수입사명)가 스펙상 필수인데
  // CartPilot에 소스가 없어 별도 MISSING으로 알린다.
  check(
    fields,
    "detailAttribute.originAreaInfo.originAreaCode",
    input.originAreaCode !== null,
    "MISSING",
    "원산지 텍스트를 확인하지 못했습니다 — 상품 원본/브랜드 설정/판매자 기본값 중 어느 것도 없습니다.",
  );
  if (input.originAreaCode !== null && input.originAreaRequiresImporter) {
    check(fields, "detailAttribute.originAreaInfo.importer", false, "MISSING", "원산지가 수입산으로 확인되어 수입사명이 필수이지만 CartPilot에 이 값의 소스가 없습니다.");
  }

  // N-3.5 — smartstoreChannelProduct.naverShoppingRegistration은 공식
  // OpenAPI 스펙(ExternalApiSmartstoreChannelProductVo.product)의 required
  // 목록에 있는 필수 필드인데, 지금까지 이 파일도 build-payload.ts도 이
  // 필드를 다루지 않고 있었다(N-3.5 재검증 중 새로 발견). "네이버 쇼핑
  // 광고주 여부"에 따라 서버가 강제로 false 처리하는 경우도 있다고 스펙에
  // 적혀 있어(광고주가 아니면 무엇을 보내든 false로 저장됨) CartPilot이
  // 임의로 true/false를 정할 근거가 없다 — 항상 MISSING으로 표시한다.
  check(
    fields,
    "smartstoreChannelProduct.naverShoppingRegistration",
    false,
    "MISSING",
    "네이버쇼핑 등록 여부(광고주 전용 설정)를 CartPilot이 알 수 없습니다 — 값을 임의로 정하지 않습니다.",
  );

  const issues: NaverPayloadValidationIssue[] = fields
    .filter((f): f is NaverPayloadFieldCheck & { status: "MISSING" | "BLOCKED"; reason: string } => f.status !== "READY")
    .map((f) => ({ field: f.field, reason: f.reason, severity: f.status }));

  const readyCount = fields.filter((f) => f.status === "READY").length;
  const missingCount = fields.filter((f) => f.status === "MISSING").length;
  const blockedCount = fields.filter((f) => f.status === "BLOCKED").length;

  return { ok: blockedCount === 0 && missingCount === 0, readyCount, missingCount, blockedCount, fields, issues };
}
