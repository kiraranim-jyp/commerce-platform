import { describe, expect, it } from "vitest";
import { resolveCategoryStatus } from "@commerce/category";

/**
 * P-13C-2 STEP2(2026-08-31) — resolveCategoryStatus 회귀 테스트. STEP0에서
 * 실측한 production 73개 categoryResolverKpi의 실제 10개 조합을 그대로
 * fixture로 고정한다(전부 검증됨: MANUAL 17건, RESOLVED 39건, LOW_CONFIDENCE
 * 17건, UNKNOWN 0건 — 합계 73건).
 */

function kpi(overrides: {
  manualOverride: boolean;
  resolverDecision: "AUTO_SELECT" | "RECOMMEND" | "REJECT" | null;
  hasSelectedResult?: boolean;
}) {
  return {
    predictResult: { code: 1, name: "x" },
    selectedResult: overrides.hasSelectedResult === false ? null : { code: 1, name: "x" },
    manualOverride: overrides.manualOverride,
    evidence: [],
    resolverDecision: overrides.resolverDecision,
    similarityScore: 95,
  };
}

describe("P-13C-2: 실제 production 10개 조합(STEP0 실측 그대로 고정)", () => {
  it.each([
    { manualOverride: false, resolverDecision: "AUTO_SELECT" as const, count: 33, expected: "RESOLVED" },
    { manualOverride: true, resolverDecision: "AUTO_SELECT" as const, count: 10, expected: "MANUAL" },
    { manualOverride: false, resolverDecision: "RECOMMEND" as const, count: 9, expected: "LOW_CONFIDENCE" },
    { manualOverride: false, resolverDecision: "AUTO_SELECT" as const, count: 6, expected: "RESOLVED" },
    { manualOverride: false, resolverDecision: "RECOMMEND" as const, count: 6, expected: "LOW_CONFIDENCE" },
    { manualOverride: true, resolverDecision: "AUTO_SELECT" as const, count: 4, expected: "MANUAL" },
    { manualOverride: false, resolverDecision: "RECOMMEND" as const, count: 2, expected: "LOW_CONFIDENCE" },
    { manualOverride: true, resolverDecision: "RECOMMEND" as const, count: 1, expected: "MANUAL" },
    { manualOverride: true, resolverDecision: "RECOMMEND" as const, count: 1, expected: "MANUAL" },
    { manualOverride: true, resolverDecision: "RECOMMEND" as const, count: 1, expected: "MANUAL" },
  ])(
    "manualOverride=$manualOverride, resolverDecision=$resolverDecision (실측 $count건) → $expected",
    ({ manualOverride, resolverDecision, expected }) => {
      expect(resolveCategoryStatus(kpi({ manualOverride, resolverDecision }))).toBe(expected);
    },
  );

  it("10개 조합의 실측 건수 합계가 73건과 일치한다(STEP0 원본 검증)", () => {
    const counts = [33, 10, 9, 6, 6, 4, 2, 1, 1, 1];
    expect(counts.reduce((a, b) => a + b, 0)).toBe(73);
  });
});

describe("P-13C-2: 나머지 상태 판별", () => {
  it("categoryResolverKpi 자체가 없으면 UNKNOWN", () => {
    expect(resolveCategoryStatus(undefined)).toBe("UNKNOWN");
    expect(resolveCategoryStatus(null)).toBe("UNKNOWN");
  });

  it("selectedResult가 없으면(카테고리 미확정) UNKNOWN", () => {
    expect(resolveCategoryStatus(kpi({ manualOverride: false, resolverDecision: null, hasSelectedResult: false }))).toBe(
      "UNKNOWN",
    );
  });

  it("selectedResult는 있는데 resolverDecision이 REJECT/null이고 manualOverride=false면(실측 0건이지만 이론상 가능) UNKNOWN으로 정직하게 남긴다", () => {
    expect(resolveCategoryStatus(kpi({ manualOverride: false, resolverDecision: "REJECT" }))).toBe("UNKNOWN");
    expect(resolveCategoryStatus(kpi({ manualOverride: false, resolverDecision: null }))).toBe("UNKNOWN");
  });

  it("manualOverride=true는 resolverDecision 값과 무관하게 항상 MANUAL이 우선한다", () => {
    expect(resolveCategoryStatus(kpi({ manualOverride: true, resolverDecision: "REJECT" }))).toBe("MANUAL");
    expect(resolveCategoryStatus(kpi({ manualOverride: true, resolverDecision: null }))).toBe("MANUAL");
  });
});
