import type { CanonicalProduct } from "@commerce/shared";
import type { NaverPayloadInput } from "./build-payload";
import type { NaverProductRegistrationPayload } from "./types";

/**
 * Sprint N-2.6 — 실제 POST 없이 payload가 등록 가능한 수준인지 검증한다.
 * "필드가 확인 안 됐다"와 "필드가 비어있다"를 구분한다 — 전자는 BLOCKED(임의
 * 값을 넣을 수 없어서 아예 진행 불가), 후자는 일반 필수값 누락으로 취급한다.
 */
export interface NaverPayloadValidationIssue {
  field: string;
  reason: string;
  /** BLOCKED: 스키마가 확인 안 됐거나 CartPilot이 만들어낼 수 없는 값(실제 인증
   * 정보 등)이라 이 상태로는 등록 시도조차 하면 안 된다.
   * MISSING: 값을 확인/입력하면 채울 수 있는 일반 필수값 누락. */
  severity: "BLOCKED" | "MISSING";
}

export interface NaverPayloadValidationResult {
  ok: boolean;
  issues: NaverPayloadValidationIssue[];
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
  const issues: NaverPayloadValidationIssue[] = [];
  const { originProduct } = payload;

  if (!originProduct.leafCategoryId) {
    issues.push({ field: "originProduct.leafCategoryId", reason: "리프 카테고리 ID가 없습니다.", severity: "MISSING" });
  }
  if (!originProduct.name) {
    issues.push({ field: "originProduct.name", reason: "상품명이 없습니다.", severity: "MISSING" });
  }
  if (!originProduct.images.representativeImage.url) {
    issues.push({ field: "originProduct.images.representativeImage", reason: "대표 이미지가 없습니다.", severity: "MISSING" });
  }
  if (!originProduct.salePrice || originProduct.salePrice <= 0) {
    issues.push({ field: "originProduct.salePrice", reason: "판매가가 없거나 0 이하입니다.", severity: "MISSING" });
  }
  if (!originProduct.stockQuantity || originProduct.stockQuantity <= 0) {
    issues.push({ field: "originProduct.stockQuantity", reason: "재고 수량이 없거나 0 이하입니다.", severity: "MISSING" });
  }

  // N-3.3 — claimDeliveryInfo.shippingAddressId/returnAddressId가 addressBookNo를
  // 그대로 가리킨다는 게 공식 OpenAPI 스펙(제목 "출고지 주소록 번호"/"반품/교환지
  // 주소록 번호")으로 확인됐다 — N-2.6~N-3.2까지의 BLOCKED("매핑이 실제 등록으로
  // 검증되지 않음")는 더 이상 정확하지 않다. 이제는 값이 있으면 READY, 없으면
  // 일반 MISSING(판매자 주소록 등록 필요)으로만 취급한다.
  if (input.releaseAddressBookNo === null) {
    issues.push({
      field: "claimDeliveryInfo.shippingAddressId",
      reason: "출고지 주소(addressType=RELEASE)를 찾지 못했습니다 — 판매자 주소록에 등록 필요.",
      severity: "MISSING",
    });
  }
  if (input.refundAddressBookNo === null) {
    issues.push({
      field: "claimDeliveryInfo.returnAddressId",
      reason: "반품지 주소(addressType=REFUND_OR_EXCHANGE)를 찾지 못했습니다 — 판매자 주소록에 등록 필요.",
      severity: "MISSING",
    });
  }

  if (!originProduct.deliveryInfo?.deliveryCompany) {
    issues.push({
      field: "deliveryInfo.deliveryCompany",
      reason: "출고 택배사 조회 API가 공식 스펙에 없어 값을 채우지 않았습니다(N-2.5/N-3.3 확인 — 반품 택배사 조회 API와는 별개).",
      severity: "BLOCKED",
    });
  }

  // N-3.3 — 반품 택배사는 실제 조회 API(GET /v2/product-delivery-info/
  // return-delivery-companies)가 확인됐다. 조회 자체가 실패하면 BLOCKED(계정/
  // 네트워크 문제로 확인 불가), 조회는 됐는데 판매자가 하나도 등록 안 했으면
  // MISSING(Wing에서 등록 필요), 있으면 READY(스펙상 미입력해도 PRIMARY가
  // 기본값이라 별도 이슈를 남기지 않는다).
  if (input.returnCompaniesFetchFailed) {
    issues.push({
      field: "claimDeliveryInfo.returnDeliveryCompanyPriorityType",
      reason: "반품 택배사 목록 조회에 실패했습니다(네이버 API 오류).",
      severity: "BLOCKED",
    });
  } else if (input.primaryReturnDeliveryCompanyPriorityType === null) {
    issues.push({
      field: "claimDeliveryInfo.returnDeliveryCompanyPriorityType",
      reason: "판매자 계정에 등록된 반품 택배사가 없습니다 — Wing에서 반품 택배사 등록 필요.",
      severity: "MISSING",
    });
  }

  if (input.returnDeliveryFee === null) {
    issues.push({
      field: "claimDeliveryInfo.returnDeliveryFee",
      reason: "반품 배송비 정책이 설정되어 있지 않습니다 — Settings에서 판매자 배송 정책 입력 필요.",
      severity: "MISSING",
    });
  }
  if (input.exchangeDeliveryFee === null) {
    issues.push({
      field: "claimDeliveryInfo.exchangeDeliveryFee",
      reason: "교환 배송비 정책이 설정되어 있지 않습니다 — Settings에서 판매자 배송 정책 입력 필요.",
      severity: "MISSING",
    });
  }

  if (categoryRequiresChildCertification && input.childCertificationInfoId === null) {
    issues.push({
      field: "productCertificationInfos",
      reason: "이 카테고리는 어린이제품 인증(CHILD_CERTIFICATION)이 필요하지만 실제 인증정보가 없습니다.",
      severity: "BLOCKED",
    });
  }
  if (categoryRequiresChildCertification && input.childCertificationInfoId !== null) {
    // certificationInfoId는 있지만, 실제 인증서 번호/업체명/취득일자는 CartPilot이
    // 만들어낼 수 없는 값이라 payload에 아예 넣지 않았다 — 이것도 항상 BLOCKED.
    issues.push({
      field: "productCertificationInfos[].certificationNumber",
      reason: "실제 인증서 번호/업체명/취득일자는 판매자가 직접 입력해야 합니다(임의 생성 금지).",
      severity: "BLOCKED",
    });
  }

  // N-2.8/N-3.4 — optionCombinations 필드명/각 필드 설명은 공식 OpenAPI로
  // 확인됐다(id는 "기존 옵션 수정용"이라 신규 등록엔 항상 비움, N-3.4에서
  // 수정된 실제 버그). 다만 price가 절대가/추가금액인지는 여전히 실제 등록
  // 성공 전까지 확인 안 됐다 — 이 값을 신뢰해서 그대로 등록에 쓰면 안 된다는
  // 걸 항상 상기시킨다.
  const product = input.product as CanonicalProduct;
  const hasOptions = product.optionGroups.length > 0;
  if (hasOptions) {
    issues.push({
      field: "detailAttribute.optionInfo",
      reason:
        "optionCombinations 필드명/구조는 확인됨(공식 OpenAPI)이나 price 필드가 절대가인지 추가금액인지는 미확인 — 실제 등록 성공 검증 전까지 이 값을 신뢰할 수 없습니다.",
      severity: "BLOCKED",
    });
    // N-3.4 — 옵션명은 있는데 특정 조합의 옵션값이 비어 있으면(원본 페이지
    // 파싱이 일부만 성공한 경우) price 의미와 무관하게 별도로 알려준다.
    const groupNames = product.optionGroups.map((g) => g.name);
    const hasIncompleteVariant = product.variants.some((v) => groupNames.some((name) => !v.optionValues[name]));
    if (hasIncompleteVariant) {
      issues.push({
        field: "detailAttribute.optionInfo.optionCombinations[].optionName",
        reason: "일부 옵션 조합에 값이 비어 있는 옵션 그룹이 있습니다 — 원본 상품의 옵션 값을 확인해야 합니다.",
        severity: "MISSING",
      });
    }
  }

  // N-3.4 — originAreaCode는 GET /v1/product-origin-areas(535개 실제 코드)로
  // 확인됐다(더 이상 BLOCKED 아님). 원산지 텍스트 자체가 없으면 MISSING,
  // 수입산(02) 계열로 매칭됐으면 importer(수입사명)가 스펙상 필수인데
  // CartPilot에 소스가 없어 별도 MISSING으로 알린다.
  if (input.originAreaCode === null) {
    issues.push({
      field: "detailAttribute.originAreaInfo.originAreaCode",
      reason: "원산지 텍스트를 확인하지 못했습니다 — 상품 원본/브랜드 설정/판매자 기본값 중 어느 것도 없습니다.",
      severity: "MISSING",
    });
  } else if (input.originAreaRequiresImporter) {
    issues.push({
      field: "detailAttribute.originAreaInfo.importer",
      reason: "원산지가 수입산으로 확인되어 수입사명이 필수이지만 CartPilot에 이 값의 소스가 없습니다.",
      severity: "MISSING",
    });
  }

  return { ok: issues.length === 0, issues };
}
