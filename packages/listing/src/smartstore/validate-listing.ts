import type { ListingModel, ValidationResult } from "@commerce/marketplace";
import type { ReadinessField, ReadinessFieldStatus, ReadinessReport } from "../types";
import { isCategoryConfirmed } from "../validation";

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
 * smartstoreExecutor.execute()의 등록 직전 가드(유일한 남은 소비처 — 예전엔
 * ReadinessScorePanel도 이 값을 보여줬지만 Sprint P1에서 제거됐다). N-3.68(CPO
 * 지시, "판매자 공통 설정 통합" 작업지시서 STEP①) — 이전에는 여기서
 * countryOfOrigin/returnPolicy/shippingFee/stockQuantity/certification 5개를
 * product(CanonicalProduct)에서 직접 읽어 추가로 검사했다. 이 필드들은
 * SellerProfile(판매자 공통 설정)과 전혀 연결돼 있지 않다 — 특히
 * returnPolicy는 canonical-product.ts에서 생성 시점에 항상
 * `{value:"",source:"REQUIRED"}`로 고정되고, 사용자가 PlatformPreview의
 * "반품/교환 안내" 입력창에 직접 타이핑하지 않는 한 절대 바뀌지 않는다 —
 * 즉 Settings(SellerProfile)에 실제 반품배송비/반품지/택배사가 이미 있어도
 * 이 게이트는 항상 ERROR로 판정해 "교환/반품 정보가 없습니다"로 등록 자체를
 * 막았다(실제 버그, 실측 확인 — /api/smartstore/register가 호출되기도 전에
 * 여기서 차단됨). 실제 원산지/반품/배송/재고/인증 판정은 이미
 * validateNaverPayload(서버, SellerProfile+resolver 기반, N-3.67 KIDS 실등록
 * 성공으로 정확성 증명됨)가 정확하게 수행한다 — 여기서 중복으로, 게다가 틀리게
 * 재검사할 필요가 없다. 이제 이 함수는 어댑터가 이미 계산한 마켓플레이스
 * 공통 필드(상품명/대표이미지/판매가격/옵션/상세설명/카테고리)만 그대로
 * 전달한다.
 */
export function validateSmartStoreListing(listing: ListingModel): ReadinessReport {
  const fields: ReadinessField[] = listing.validations.map((v) => ({
    field: v.field,
    label: v.label,
    status: statusFromMarketplace(v.status),
    message: v.message,
    resolution:
      v.field === "category" && !isCategoryConfirmed(listing) ? "카테고리 선택" : undefined,
  }));

  return {
    fields,
    score: scoreFields(fields),
    requiredTotal: fields.length,
    requiredPassed: fields.filter((f) => f.status === "VALID").length,
    warningCount: fields.filter((f) => f.status === "WARNING").length,
    errorCount: fields.filter((f) => f.status === "ERROR").length,
  };
}
