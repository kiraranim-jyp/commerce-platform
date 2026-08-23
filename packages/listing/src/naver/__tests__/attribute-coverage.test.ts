import { describe, expect, it } from "vitest";
import { computeAttributeCoverage } from "../attribute-coverage";
import type { NaverAttributeResolutionResult } from "../attribute-resolver";

function result(status: NaverAttributeResolutionResult["status"]): NaverAttributeResolutionResult {
  return { attributeSeq: 1, attributeName: "테스트", source: null, sourceValue: null, matched: [], status };
}

describe("computeAttributeCoverage", () => {
  it("matched/unresolved/notAvailable를 정확히 센다", () => {
    const coverage = computeAttributeCoverage([
      result("MATCHED"),
      result("MATCHED"),
      result("UNRESOLVED"),
      result("NOT_AVAILABLE"),
    ]);
    expect(coverage).toEqual({ total: 4, matched: 2, unresolved: 1, notAvailable: 1, matchRatePercent: 67 });
  });

  it("빈 배열이면 total 0, matchRatePercent는 100(분모가 없어 억울한 0% 방지)", () => {
    expect(computeAttributeCoverage([])).toEqual({
      total: 0,
      matched: 0,
      unresolved: 0,
      notAvailable: 0,
      matchRatePercent: 100,
    });
  });

  it("NOT_AVAILABLE만 있으면(이 카테고리에 해당 속성 자체가 없음) matchRatePercent는 100", () => {
    const coverage = computeAttributeCoverage([result("NOT_AVAILABLE"), result("NOT_AVAILABLE")]);
    expect(coverage.matchRatePercent).toBe(100);
  });

  it("전부 UNRESOLVED면 matchRatePercent는 0", () => {
    const coverage = computeAttributeCoverage([result("UNRESOLVED"), result("UNRESOLVED")]);
    expect(coverage.matchRatePercent).toBe(0);
  });
});
