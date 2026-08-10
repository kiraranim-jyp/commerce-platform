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
  > & {
    /** N-3.3 — 반품 택배사 목록 조회 자체가 실패했는지(계정/네트워크 문제 등).
     * 실패와 "택배사 미등록"은 서로 다른 사유라 구분한다. */
    returnCompaniesFetchFailed: boolean;
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

  // N-2.8 — optionCombinations 필드명은 확인됐지만(GitHub #241), price가
  // 절대가/추가금액인지·id를 미리 채워도 되는지는 실제 등록 성공 전까지
  // 확인 안 됐다. 필드 구조는 채웠지만(build-payload.ts) 이 값을 신뢰해서
  // 그대로 등록에 쓰면 안 된다는 걸 항상 상기시킨다.
  const hasOptions = (input.product as CanonicalProduct).optionGroups.length > 0;
  if (hasOptions) {
    issues.push({
      field: "detailAttribute.optionInfo",
      reason:
        "optionCombinations 필드명은 확인됨(GitHub #241)이나 price/id 필드의 정확한 의미는 미확인 — 실제 등록 성공 검증 전까지 이 값을 신뢰할 수 없습니다.",
      severity: "BLOCKED",
    });
  }

  // N-2.8 — originAreaCode(네이버 자체 원산지 코드 enum)는 어느 경로로도
  // 확인되지 않았다. content(원산지 텍스트)는 채웠지만 실제 등록에는
  // originAreaCode가 필요할 가능성이 높아 항상 BLOCKED로 남긴다.
  issues.push({
    field: "detailAttribute.originAreaInfo.originAreaCode",
    reason: "네이버 원산지 코드(originAreaCode) enum 값이 확인되지 않아 채우지 않았습니다.",
    severity: "BLOCKED",
  });

  return { ok: issues.length === 0, issues };
}
