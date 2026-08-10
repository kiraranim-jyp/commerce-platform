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
  input: Pick<NaverPayloadInput, "product" | "releaseAddressBookNo" | "refundAddressBookNo" | "childCertificationInfoId">,
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

  if (input.releaseAddressBookNo === null) {
    issues.push({
      field: "deliveryInfo.outboundLocationId",
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

  // 이 매핑 자체(addressBookNo → outboundLocationId/shippingAddressId/
  // returnAddressId)는 N-2.6 시점까지 실제 등록 성공으로 검증된 적이 없다 —
  // 필드 존재는 확인됐지만 이 값을 그대로 대입해도 되는지는 미확인이므로 항상
  // BLOCKED를 남겨서 "실제 POST 전에 반드시 재확인"을 상기시킨다.
  issues.push({
    field: "deliveryInfo (address mapping)",
    reason: "addressBookNo → outboundLocationId/shippingAddressId/returnAddressId 매핑이 실제 등록으로 검증되지 않았습니다.",
    severity: "BLOCKED",
  });

  if (!originProduct.deliveryInfo?.deliveryCompany) {
    issues.push({
      field: "deliveryInfo.deliveryCompany",
      reason: "택배사 코드 조회 API를 찾지 못해 값을 채우지 않았습니다(N-2.5 미확인 사항).",
      severity: "BLOCKED",
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

  const hasOptions = (input.product as CanonicalProduct).optionGroups.length > 0;
  if (hasOptions) {
    issues.push({
      field: "detailAttribute.optionInfo",
      reason: "옵션 조합(optionCombinations) 필드 스키마가 확인되지 않아 옵션이 있는 상품은 이번 Sprint 대상이 아닙니다.",
      severity: "BLOCKED",
    });
  }

  return { ok: issues.length === 0, issues };
}
