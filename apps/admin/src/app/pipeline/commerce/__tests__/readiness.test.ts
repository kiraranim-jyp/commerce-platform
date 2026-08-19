import { describe, expect, it } from "vitest";
import type { NaverPayloadFieldCheck, NaverPayloadValidationResult } from "@commerce/listing";
import { computeNaverPayloadReadiness } from "../readiness";

/**
 * N-3.66(CPO 지시: "필드 → 섹션 네비게이션 계약은 기존 validation 테스트만으로
 * 안 잡힌다") — 이번에 실측으로 발견한 버그(certificationType이 실제로는
 * required인데 naverFieldSectionId가 몰라서 "다음 입력하기"가 아무 데도
 * 이동하지 않음, 원산지도 같은 유형으로 이미 한 번 겪었다)를 회귀 테스트로
 * 고정한다. validateNaverPayload가 어떤 field를 MISSING/BLOCKED로 판정하든,
 * computeNaverPayloadReadiness가 만든 ReadinessItem이 required(=!optional)면
 * 반드시 sectionId 또는 externalHref 중 하나는 있어야 한다 — 없으면 사용자가
 * "다음 입력하기"를 눌러도 어디로도 이동하지 못하는 죽은 항목이 된다.
 */
function fieldCheck(overrides: Partial<NaverPayloadFieldCheck> & { field: string }): NaverPayloadFieldCheck {
  return { status: "MISSING", reason: "테스트 사유", ...overrides };
}

function makeValidation(fields: NaverPayloadFieldCheck[]): NaverPayloadValidationResult {
  const gateFields = fields.filter((f) => !f.advisory);
  return {
    ok: false,
    readyCount: gateFields.filter((f) => f.status === "READY").length,
    missingCount: gateFields.filter((f) => f.status === "MISSING").length,
    blockedCount: gateFields.filter((f) => f.status === "BLOCKED").length,
    fields,
    issues: gateFields
      .filter((f) => f.status !== "READY")
      .map((f) => ({ field: f.field, reason: f.reason ?? "", severity: f.status as "MISSING" | "BLOCKED", code: f.code })),
    advisoryNotes: fields.filter((f) => f.advisory),
    kcStatus: "SELLER_REVIEW_REQUIRED",
  };
}

describe("computeNaverPayloadReadiness — 필드→섹션 네비게이션 계약", () => {
  it("productInfoProvidedNotice(KIDS).certificationType(required, MISSING) → sectionId='section-kc'(회귀 방지)", () => {
    const validation = makeValidation([
      fieldCheck({ field: "productInfoProvidedNotice(KIDS).certificationType", code: "KC_CERTIFICATION_REQUIRED" }),
    ]);
    const summary = computeNaverPayloadReadiness(validation);
    const item = summary.items.find((i) => i.label === "인증구분");
    expect(item).toBeDefined();
    expect(item!.required).toBe(true);
    expect(item!.sectionId).toBe("section-kc");
  });

  it("detailAttribute.originAreaInfo.originAreaCode(required, MISSING) → sectionId='section-basic'(N-3.65 회귀 방지)", () => {
    const validation = makeValidation([fieldCheck({ field: "detailAttribute.originAreaInfo.originAreaCode" })]);
    const summary = computeNaverPayloadReadiness(validation);
    const item = summary.items.find((i) => i.label === "원산지");
    expect(item).toBeDefined();
    expect(item!.required).toBe(true);
    expect(item!.sectionId).toBe("section-basic");
  });

  it("일반 계약: required(optional 아님)이고 READY가 아닌 모든 항목은 sectionId 또는 externalHref 중 하나는 반드시 있다", () => {
    // 실제 validateNaverPayload가 만들어내는 필드들을 대표로 모았다 — 새 필드가
    // 추가될 때 이 목록에 없으면 이 테스트가 잡아내지 못하니, 새 required
    // 필드를 추가하는 PR은 여기도 함께 갱신해야 한다.
    const representativeFields = [
      "originProduct.leafCategoryId",
      "originProduct.name",
      "originProduct.salePrice",
      "deliveryInfo.deliveryCompany",
      "claimDeliveryInfo.returnDeliveryFee",
      "claimDeliveryInfo.exchangeDeliveryFee",
      "detailAttribute.originAreaInfo.originAreaCode",
      "detailAttribute.originAreaInfo.importer",
      "productCertificationInfos[].certificationNumber",
      "productInfoProvidedNotice(KIDS).certificationType",
      "productInfoProvidedNotice(WEAR).certificationType",
    ];
    const validation = makeValidation(representativeFields.map((field) => fieldCheck({ field })));
    const summary = computeNaverPayloadReadiness(validation);
    const deadEnds = summary.required.filter((i) => !i.passed && !i.sectionId && !i.externalHref);
    expect(deadEnds.map((i) => i.label)).toEqual([]);
  });
});
