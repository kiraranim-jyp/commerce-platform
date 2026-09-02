import { describe, expect, it } from "vitest";
import { tierForCandidate, type Candidate } from "../DomesticShopSearch";

/**
 * P-24 Sprint 2/9(CPO 지시, 2026-09-02) — 실측(PèPè)에서 확인된 버그: 진짜
 * 동일상품(포레포레, matchTruth=STRONG_IDENTIFIER, SKU 일치)의 confidence는
 * 0.42(matchLevel="low")인데 비교상품(듀베베, matchTruth=SIMILAR, 식별자
 * 없음)은 confidence 0.72(matchLevel="medium")였다 — `matchLevel !== "low"`
 * 필터가 진짜 동일상품을 "매칭 불확실"로 숨기고 비교상품을 대표로 올렸다.
 * tierForCandidate()는 matchTruth를 우선 기준으로 삼아 이 역전을 막는다.
 */
function candidate(overrides: Partial<Candidate>): Candidate {
  return {
    title: "test",
    url: "https://example.com",
    price: null,
    imageUrl: null,
    confidence: 0,
    ...overrides,
  };
}

describe("tierForCandidate — matchTruth 우선, matchLevel(confidence)은 폴백만", () => {
  it("T1: 실측 재현 — STRONG_IDENTIFIER(confidence 0.42, low) → EXACT, SIMILAR(confidence 0.72, medium) → COMPARISON", () => {
    const foretforet = candidate({ matchTruth: "STRONG_IDENTIFIER", confidence: 0.42, matchLevel: "low" });
    const deuxbebe = candidate({ matchTruth: "SIMILAR", confidence: 0.72, matchLevel: "medium" });
    expect(tierForCandidate(foretforet)).toBe("EXACT");
    expect(tierForCandidate(deuxbebe)).toBe("COMPARISON");
  });

  it("EXACT_IDENTIFIER도 EXACT로 분류된다", () => {
    expect(tierForCandidate(candidate({ matchTruth: "EXACT_IDENTIFIER", confidence: 0.9, matchLevel: "very_high" }))).toBe("EXACT");
  });

  it("TEXT_CONFIRMED는 confidence가 높아도 COMPARISON이다(식별자 근거 없음)", () => {
    expect(tierForCandidate(candidate({ matchTruth: "TEXT_CONFIRMED", confidence: 0.95, matchLevel: "very_high" }))).toBe("COMPARISON");
  });

  it("CONFLICT/INSUFFICIENT_EVIDENCE는 confidence와 무관하게 EXCLUDED다", () => {
    expect(tierForCandidate(candidate({ matchTruth: "CONFLICT", confidence: 0.8, matchLevel: "high" }))).toBe("EXCLUDED");
    expect(tierForCandidate(candidate({ matchTruth: "INSUFFICIENT_EVIDENCE", confidence: 0.1, matchLevel: "low" }))).toBe("EXCLUDED");
  });

  it("matchTruth가 없는 레거시 응답은 기존 matchLevel 규칙으로 폴백한다", () => {
    expect(tierForCandidate(candidate({ matchLevel: "very_high" }))).toBe("EXACT");
    expect(tierForCandidate(candidate({ matchLevel: "high" }))).toBe("EXACT");
    expect(tierForCandidate(candidate({ matchLevel: "medium" }))).toBe("COMPARISON");
    expect(tierForCandidate(candidate({ matchLevel: "low" }))).toBe("EXCLUDED");
    expect(tierForCandidate(candidate({}))).toBe("EXCLUDED");
  });
});
