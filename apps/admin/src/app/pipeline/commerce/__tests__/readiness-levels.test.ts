import { describe, expect, it } from "vitest";
import { deriveReadinessLevels, overallReadinessLevel, type ReadinessSummary, type ReadinessItem } from "../readiness";

/**
 * N-4.02 Part E(대표님 지시) — GREEN/YELLOW/RED 공통 모델. 새 판정 로직이
 * 아니라 기존 ReadinessSummary.items(passed/required)를 그대로 재분류하는지만
 * 확인한다 — computeNaverPayloadReadiness/computeChecklistReadiness 자체의
 * 판정 정확성은 각자의 기존 테스트가 이미 커버한다.
 */
function makeSummary(items: ReadinessItem[]): ReadinessSummary {
  const required = items.filter((i) => i.required);
  return {
    items,
    required,
    recommended: items.filter((i) => !i.required),
    allRequiredPassed: required.every((i) => i.passed),
    percent: 0,
  };
}

describe("deriveReadinessLevels / overallReadinessLevel", () => {
  it("passed=true → GREEN", () => {
    const levels = deriveReadinessLevels(makeSummary([{ label: "상품명", passed: true, required: true }]));
    expect(levels).toEqual([{ field: "상품명", level: "GREEN", reason: undefined, group: undefined }]);
  });

  it("passed=false + required=true → RED(등록불가)", () => {
    const levels = deriveReadinessLevels(
      makeSummary([{ label: "KC 인증정보", passed: false, required: true, hint: "인증번호 필요" }]),
    );
    expect(levels[0].level).toBe("RED");
    expect(levels[0].reason).toBe("인증번호 필요");
  });

  it("passed=false + required=false → YELLOW(확인 필요, 등록은 막지 않음)", () => {
    const levels = deriveReadinessLevels(
      makeSummary([{ label: "제조사", passed: false, required: false, hint: "확인 권장" }]),
    );
    expect(levels[0].level).toBe("YELLOW");
  });

  it("overallReadinessLevel — RED가 하나라도 있으면 전체 RED(우선순위 최상위)", () => {
    const levels = deriveReadinessLevels(
      makeSummary([
        { label: "상품명", passed: true, required: true },
        { label: "제조사", passed: false, required: false },
        { label: "KC", passed: false, required: true },
      ]),
    );
    expect(overallReadinessLevel(levels)).toBe("RED");
  });

  it("overallReadinessLevel — RED 없고 YELLOW만 있으면 전체 YELLOW", () => {
    const levels = deriveReadinessLevels(
      makeSummary([
        { label: "상품명", passed: true, required: true },
        { label: "제조사", passed: false, required: false },
      ]),
    );
    expect(overallReadinessLevel(levels)).toBe("YELLOW");
  });

  it("overallReadinessLevel — 전부 통과면 전체 GREEN", () => {
    const levels = deriveReadinessLevels(
      makeSummary([
        { label: "상품명", passed: true, required: true },
        { label: "가격", passed: true, required: true },
      ]),
    );
    expect(overallReadinessLevel(levels)).toBe("GREEN");
  });

  it("overall RED ⇔ summary.allRequiredPassed=false(계약 일치 — 같은 조건을 두 곳에서 다르게 판단하지 않는다)", () => {
    const summary = makeSummary([
      { label: "상품명", passed: true, required: true },
      { label: "가격", passed: false, required: true },
    ]);
    const overall = overallReadinessLevel(deriveReadinessLevels(summary));
    expect(overall === "RED").toBe(!summary.allRequiredPassed);
  });
});
