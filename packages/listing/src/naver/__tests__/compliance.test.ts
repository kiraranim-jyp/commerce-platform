import { describe, expect, it } from "vitest";
import { resolveCategoryComplianceProfile, isKcStatusRegistrable, COMPLIANCE_POLICY_VERSION } from "../compliance";

/**
 * N-3.52/N-3.53(CPO 지시) — resolveKcStatus 자체는 kc-certification-guard.test.ts의
 * 실제 payload 조합(1/1b/1c/1d/1e)으로 이미 통합 검증된다. 여기서는 그
 * 결과에 의존하는 순수 유틸(isKcStatusRegistrable)과 카테고리 위험도
 * 분류(resolveCategoryComplianceProfile)만 직접 검증한다.
 */
const CTX = { policyVersion: COMPLIANCE_POLICY_VERSION, categoryCode: "50021299" };
const VALID_CONFIRMATION = { confirmed: true, kcStatus: "SELLER_REVIEW_REQUIRED" as const, ...CTX };

describe("N-3.53: isKcStatusRegistrable", () => {
  it("NOT_APPLICABLE/CERTIFIED_REFERENCE는 확인 기록 없이도 통과", () => {
    expect(isKcStatusRegistrable("NOT_APPLICABLE", null, CTX)).toBe(true);
    expect(isKcStatusRegistrable("CERTIFIED_REFERENCE", null, CTX)).toBe(true);
  });

  it("BLOCKED는 확인 기록이 있어도 절대 통과하지 못한다(우회 불가)", () => {
    expect(isKcStatusRegistrable("BLOCKED", null, CTX)).toBe(false);
    expect(isKcStatusRegistrable("BLOCKED", VALID_CONFIRMATION, CTX)).toBe(false);
  });

  it("SELLER_REVIEW_REQUIRED는 확인 기록이 없으면 통과하지 못한다", () => {
    expect(isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", null, CTX)).toBe(false);
  });

  it("SELLER_REVIEW_REQUIRED는 정책버전/카테고리가 일치하는 확인 기록이 있으면 통과", () => {
    expect(isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", VALID_CONFIRMATION, CTX)).toBe(true);
  });

  it("확인 기록이 있어도 정책버전/카테고리가 다르면 통과하지 못한다(재확인 강제)", () => {
    expect(isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", { ...VALID_CONFIRMATION, policyVersion: "OLD" }, CTX)).toBe(
      false,
    );
    expect(
      isKcStatusRegistrable("SELLER_REVIEW_REQUIRED", { ...VALID_CONFIRMATION, categoryCode: "OTHER" }, CTX),
    ).toBe(false);
  });
});

describe("N-3.52: resolveCategoryComplianceProfile", () => {
  it("카테고리 미확정 → REVIEW_REQUIRED", () => {
    const profile = resolveCategoryComplianceProfile({
      categoryVerified: false,
      categoryRequiresChildCertification: false,
    });
    expect(profile.riskLevel).toBe("REVIEW_REQUIRED");
    expect(profile.requiresSellerReview).toBe(true);
  });

  it("어린이제품 카테고리 확정 → KIDS_REVIEW", () => {
    const profile = resolveCategoryComplianceProfile({
      categoryVerified: true,
      categoryRequiresChildCertification: true,
    });
    expect(profile.riskLevel).toBe("KIDS_REVIEW");
    expect(profile.requiresSellerReview).toBe(true);
  });

  it("일반 카테고리 확정 → LOW(추가 확인 필요 없음)", () => {
    const profile = resolveCategoryComplianceProfile({
      categoryVerified: true,
      categoryRequiresChildCertification: false,
    });
    expect(profile.riskLevel).toBe("LOW");
    expect(profile.requiresSellerReview).toBe(false);
    expect(profile.reasons).toHaveLength(0);
  });
});

describe("N-3.52: COMPLIANCE_POLICY_VERSION", () => {
  it("정책 버전이 실제로 정의돼 있다(빈 문자열 아님)", () => {
    expect(COMPLIANCE_POLICY_VERSION.length).toBeGreaterThan(0);
  });
});
