import type { ListingModel, ValidationResult } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource } from "@commerce/shared";
import type { ReadinessField, ReadinessFieldStatus, ReadinessReport } from "../types";
import { isCategoryConfirmed } from "../validation";

function statusFromSource(source: FieldSource): ReadinessFieldStatus {
  if (source === "REQUIRED") return "ERROR";
  if (source === "DEFAULT") return "WARNING";
  return "VALID";
}

function statusFromMarketplace(status: ValidationResult["status"]): ReadinessFieldStatus {
  return status === "PASS" ? "VALID" : status;
}

function scoreFields(fields: ReadinessField[]): number {
  if (fields.length === 0) return 100;
  const weights: Record<ReadinessFieldStatus, number> = { VALID: 1, WARNING: 0.5, ERROR: 0 };
  const total = fields.reduce((sum, f) => sum + weights[f.status], 0);
  return Math.round((total / fields.length) * 100);
}

/**
 * PM의 3단 이름 중 두 번째 단계. listing.validations(어댑터가 이미 계산한
 * 상품명/대표이미지/판매가격/옵션/상세설명/카테고리)에 이번 Mission에서 새로
 * 추가한 등록 직전 필드(원산지/반품정보/배송비/재고/인증정보)를 더해서 하나의
 * "등록 준비도" 리포트로 합친다. product를 따로 받는 이유는 이 필드들이
 * ListingModel(플랫폼 Preview 모양)에는 없고 CanonicalProduct에만 있기 때문이다.
 */
export function validateSmartStoreListing(
  product: CanonicalProduct,
  listing: ListingModel,
): ReadinessReport {
  const fields: ReadinessField[] = listing.validations.map((v) => ({
    field: v.field,
    label: v.label,
    status: statusFromMarketplace(v.status),
    message: v.message,
    resolution:
      v.field === "category" && !isCategoryConfirmed(listing) ? "카테고리 선택" : undefined,
  }));

  fields.push({
    field: "countryOfOrigin",
    label: "원산지",
    status: statusFromSource(product.countryOfOrigin.source),
    message: product.countryOfOrigin.source === "REQUIRED" ? "원산지 정보가 없습니다." : undefined,
    resolution: product.countryOfOrigin.source === "REQUIRED" ? "원산지 입력" : undefined,
  });

  fields.push({
    field: "returnPolicy",
    label: "교환/반품 정보",
    status: statusFromSource(product.returnPolicy.source),
    message:
      product.returnPolicy.source === "REQUIRED" ? "교환/반품 정보가 없습니다." : undefined,
    resolution: product.returnPolicy.source === "REQUIRED" ? "반품 정책 입력" : undefined,
  });

  fields.push({
    field: "shippingFee",
    label: "배송비",
    status: statusFromSource(product.shippingFee.source),
    message:
      product.shippingFee.source === "DEFAULT"
        ? "기본값(무료배송)으로 설정되어 있습니다 — 확인해주세요."
        : undefined,
    resolution: product.shippingFee.source === "DEFAULT" ? "배송 정책 설정" : undefined,
  });

  fields.push({
    field: "stockQuantity",
    label: "재고",
    status: statusFromSource(product.stockQuantity.source),
    message:
      product.stockQuantity.source === "DEFAULT"
        ? "기본값(999개)으로 설정되어 있습니다 — 확인해주세요."
        : undefined,
    resolution: product.stockQuantity.source === "DEFAULT" ? "재고 수량 확인" : undefined,
  });

  // 대부분의 카테고리는 인증정보가 필요 없다 — 값이 없어도 등록을 막지 않는다.
  fields.push({
    field: "certification",
    label: "인증정보",
    status: "VALID",
    message: product.certification.value
      ? undefined
      : "해당 없음 — 대부분 카테고리는 인증정보가 필요하지 않습니다.",
  });

  return {
    fields,
    score: scoreFields(fields),
    requiredTotal: fields.length,
    requiredPassed: fields.filter((f) => f.status === "VALID").length,
    warningCount: fields.filter((f) => f.status === "WARNING").length,
    errorCount: fields.filter((f) => f.status === "ERROR").length,
  };
}
