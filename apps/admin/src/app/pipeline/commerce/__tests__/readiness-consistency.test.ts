import { describe, expect, it } from "vitest";
import type { NaverPayloadFieldCheck, NaverPayloadValidationResult } from "@commerce/listing";
import { computeChecklistReadiness, computeNaverPayloadReadiness } from "../readiness";
import { readinessStateToLevel, resolveRegistrationReadinessState } from "../readiness-state";
import type { CategorySelection } from "@commerce/category";
import type { ValidationResult } from "@commerce/marketplace";

/**
 * N-4.08 STEP6-6(CPO 지시: "Preview = Readiness = Register가 서로 다른 판정을
 * 내리는 일이 절대 없어야 한다") — Preview/Readiness/Register 세 화면이 실제로
 * 같은 코드를 호출한다는 사실 자체는 STEP6-1 조사에서 이미 구조적으로 확인했다
 * (register route가 쓰는 validateNaverPayload/buildCoupangCompliance를
 * computeNaverPayloadReadiness/computeChecklistReadiness가 그대로 받아쓰고,
 * PlatformPreview의 RegistrationStatusBanner도 그 결과 하나만 본다 — 서로 다른
 * 계산이 존재하지 않는다). 이 테스트는 그 파이프라인의 마지막 단계
 * (ReadinessSummary → RegistrationReadinessState → GREEN/YELLOW/RED)가 CPO가
 * 지정한 4가지 케이스에서 정확히 기대한 상태로 이어지는지 고정한다.
 */

function fieldCheck(overrides: Partial<NaverPayloadFieldCheck> & { field: string }): NaverPayloadFieldCheck {
  return { status: "MISSING", reason: "테스트 사유", ...overrides };
}

function makeValidation(
  fields: NaverPayloadFieldCheck[],
  kcStatus: NaverPayloadValidationResult["kcStatus"] = "NOT_APPLICABLE",
): NaverPayloadValidationResult {
  const gateFields = fields.filter((f) => !f.advisory);
  return {
    ok: gateFields.every((f) => f.status === "READY"),
    readyCount: gateFields.filter((f) => f.status === "READY").length,
    missingCount: gateFields.filter((f) => f.status === "MISSING").length,
    blockedCount: gateFields.filter((f) => f.status === "BLOCKED").length,
    fields,
    issues: gateFields
      .filter((f) => f.status !== "READY")
      .map((f) => ({ field: f.field, reason: f.reason ?? "", severity: f.status as "MISSING" | "BLOCKED", code: f.code })),
    advisoryNotes: fields.filter((f) => f.advisory),
    kcStatus,
  };
}

describe("STEP6-6 Case 1 — 필수정보 전부 있음 → Preview/Readiness 🟢, Register 가능", () => {
  it("모든 필드 READY + priceValid → READY → GREEN", () => {
    const validation = makeValidation([fieldCheck({ field: "originProduct.name", status: "READY" })]);
    const summary = computeNaverPayloadReadiness(validation);
    expect(summary.allRequiredPassed).toBe(true);
    const state = resolveRegistrationReadinessState(summary, true, validation.kcStatus);
    expect(state).toBe("READY");
    expect(readinessStateToLevel(state)).toBe("GREEN");
  });
});

describe("STEP6-6 Case 2 — KC 필수정보 없음 → Preview/Readiness 🔴, Register 차단", () => {
  it("KC 필드 BLOCKED + kcStatus=BLOCKED → BLOCKED → RED", () => {
    const validation = makeValidation(
      [fieldCheck({ field: "productCertificationInfos", status: "BLOCKED", code: "KC_CERTIFICATION_REQUIRED" })],
      "BLOCKED",
    );
    const summary = computeNaverPayloadReadiness(validation);
    expect(summary.allRequiredPassed).toBe(false);
    const state = resolveRegistrationReadinessState(summary, true, validation.kcStatus);
    expect(state).toBe("BLOCKED");
    expect(readinessStateToLevel(state)).toBe("RED");
  });

  it("kcStatus=SELLER_REVIEW_REQUIRED(판매자 미확인) → SELLER_REVIEW → YELLOW(RED와 구분되지만 등록은 실제로 막힘 — validate-payload.ts가 BLOCKED status를 준다)", () => {
    const validation = makeValidation(
      [fieldCheck({ field: "productCertificationInfos", status: "BLOCKED", code: "KC_CERTIFICATION_REQUIRED" })],
      "SELLER_REVIEW_REQUIRED",
    );
    const summary = computeNaverPayloadReadiness(validation);
    expect(summary.allRequiredPassed).toBe(false);
    const state = resolveRegistrationReadinessState(summary, true, validation.kcStatus);
    expect(state).toBe("SELLER_REVIEW");
    expect(readinessStateToLevel(state)).toBe("YELLOW");
  });
});

describe("STEP6-6 Case 3 — 선택정보만 부족 → 필수 게이트는 통과(현재 아키텍처: 선택 항목은 상태를 낮추지 않는다, N-3.55 원칙)", () => {
  it("advisory 필드만 MISSING이어도 required 게이트에는 안 잡힌다 → READY 유지", () => {
    const validation = makeValidation([
      fieldCheck({ field: "smartstoreChannelProduct.naverShoppingRegistration", status: "MISSING", advisory: true }),
    ]);
    const summary = computeNaverPayloadReadiness(validation);
    expect(summary.allRequiredPassed).toBe(true);
    const state = resolveRegistrationReadinessState(summary, true, validation.kcStatus);
    expect(state).toBe("READY");
    expect(readinessStateToLevel(state)).toBe("GREEN");
  });

  it("쿠팡: settingsRecommended(선택 권장)만 비어있으면 required가 아니라 percent/allRequiredPassed에 영향 없음", () => {
    const category: CategorySelection = {
      state: "CONFIRMED",
      candidate: {
        id: "100",
        name: "테스트",
        path: ["테스트"],
        platform: "coupang",
        confidence: 1,
        reason: [],
        source: "ai",
        isVerifiedPlatformCode: true,
      },
      provenance: "USER_SELECTED",
    };
    const validations: ValidationResult[] = [
      { field: "title", label: "상품명", status: "PASS", message: undefined },
    ];
    const summary = computeChecklistReadiness(validations, category, [], undefined, ["제조자(수입자)"]);
    expect(summary.allRequiredPassed).toBe(true);
    const state = resolveRegistrationReadinessState(summary, true, undefined);
    expect(state).toBe("READY");
    expect(readinessStateToLevel(state)).toBe("GREEN");
  });
});

describe("STEP6-6 Case 4 — 가격 미확정 → Preview/Readiness 🔴, Register 차단", () => {
  it("priceValid=false → 다른 필드가 전부 READY여도 BLOCKED → RED", () => {
    const validation = makeValidation([fieldCheck({ field: "originProduct.name", status: "READY" })]);
    const summary = computeNaverPayloadReadiness(validation);
    expect(summary.allRequiredPassed).toBe(true); // 가격은 readiness.ts가 아니라 priceValid 파라미터로 별도 게이트된다
    const state = resolveRegistrationReadinessState(summary, false, validation.kcStatus);
    expect(state).toBe("BLOCKED");
    expect(readinessStateToLevel(state)).toBe("RED");
  });
});

describe("STEP6-6 추가 — MISSING(비-KC, required) → NEEDS_REVIEW → YELLOW", () => {
  it("일반 필수 필드 MISSING(KC 아님) → NEEDS_REVIEW → YELLOW", () => {
    const validation = makeValidation([fieldCheck({ field: "originProduct.salePrice", status: "MISSING" })]);
    const summary = computeNaverPayloadReadiness(validation);
    expect(summary.allRequiredPassed).toBe(false);
    const state = resolveRegistrationReadinessState(summary, true, validation.kcStatus);
    expect(state).toBe("NEEDS_REVIEW");
    expect(readinessStateToLevel(state)).toBe("YELLOW");
  });
});

describe("STEP6-6 우선순위 — priceValid=false가 kcStatus보다 항상 먼저 확인된다(가격 없으면 KC 판정과 무관하게 BLOCKED)", () => {
  it("priceValid=false + kcStatus=SELLER_REVIEW_REQUIRED여도 BLOCKED(SELLER_REVIEW 아님)", () => {
    const validation = makeValidation([], "SELLER_REVIEW_REQUIRED");
    const summary = computeNaverPayloadReadiness(validation);
    const state = resolveRegistrationReadinessState(summary, false, validation.kcStatus);
    expect(state).toBe("BLOCKED");
  });
});
