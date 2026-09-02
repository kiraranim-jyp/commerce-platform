import { describe, expect, it } from "vitest";
import { sortDomesticCandidatesByTrust } from "@commerce/crawler";
import { candidateLabel } from "../DomesticPriceIntelligencePanel";

/**
 * P-10 STEP 8(대표님/CPO 지시, 2026-08-30) — MT-01~MT-07. MT-08(실제 DB
 * 저장 확인)은 단위테스트로는 증명할 수 없는 실제 프로덕션 재확인 흐름이라
 * CTO 실측(STEP 9)에서 별도로 검증한다.
 */
function candidate(overrides: Partial<Parameters<typeof candidateLabel>[0]>) {
  return {
    id: "c1",
    matchType: "REVIEW_REQUIRED" as const,
    matchConfidence: 0.5,
    matchedTitle: null,
    matchedBrand: null,
    matchReasons: [] as string[],
    matchTruth: null,
    verified: false,
    externalUrl: "https://example.com",
    ...overrides,
  };
}

describe("MT-01 — Pepe/ForetForet: confidence 낮음 + identifier partial → STRONG_IDENTIFIER", () => {
  it("🟢 동일상품 확인됨(식별자 기반 검증)으로 표시된다", () => {
    const label = candidateLabel(candidate({ matchTruth: "STRONG_IDENTIFIER", matchConfidence: 0.42, verified: true }));
    expect(label.icon).toBe("🟢");
    expect(label.text).toBe("동일상품 확인됨(식별자 기반 검증)");
    expect(label.note).toBe("→ 동일상품 가격으로 반영됨");
  });
});

describe("MT-02 — Pepe/Deuxbebe: confidence 72% + identifier unavailable → SIMILAR", () => {
  it("🟡 비교상품 · 텍스트 유사도 72%로 표시되고 비교상품 시장가격(참고용)으로 반영된다", () => {
    const label = candidateLabel(candidate({ matchTruth: "SIMILAR", matchConfidence: 0.72, verified: false }));
    expect(label.icon).toBe("🟡");
    expect(label.text).toContain("비교상품");
    expect(label.note).toBe("텍스트 유사도 72% · 비교상품 시장가격(참고용)으로 반영됨");
  });
});

describe("MT-03 — 고 confidence + identifier conflict → CONFLICT", () => {
  it("🔴 다른 상품 가능성 높음으로 표시된다 — confidence가 높아도 동일상품으로 표시되지 않는다", () => {
    const label = candidateLabel(candidate({ matchTruth: "CONFLICT", matchConfidence: 0.95, verified: false }));
    expect(label.icon).toBe("🔴");
    expect(label.text).toContain("다른 상품 가능성 높음");
  });
});

describe("MT-04 — Bobo Choses 실제 사례: confidence 매우 높음 + identifier unavailable → TEXT_CONFIRMED", () => {
  it("🟡 비교상품으로 표시되고 비교상품 시장가격(참고용)으로 반영된다 — 텍스트 유사도만으로는 동일상품(🟢)이 될 수 없다", () => {
    const label = candidateLabel(candidate({ matchTruth: "TEXT_CONFIRMED", matchConfidence: 1, verified: false }));
    expect(label.icon).toBe("🟡");
    expect(label.text).toContain("비교상품");
    expect(label.note).toBe("텍스트 유사도 100% · 비교상품 시장가격(참고용)으로 반영됨");
  });
});

describe("MT-05 — 낮은 confidence + identifier 없음 → INSUFFICIENT_EVIDENCE", () => {
  it("⚪ 판단 근거 부족으로 표시된다", () => {
    const label = candidateLabel(candidate({ matchTruth: "INSUFFICIENT_EVIDENCE", matchConfidence: 0.3, verified: false }));
    expect(label.icon).toBe("⚪");
    expect(label.text).toContain("판단 근거 부족");
  });
});

describe("MT-06 — 레거시 데이터(matchTruth=null)도 오류 없이 표시된다", () => {
  it("verified=true 레거시 행은 기존 방식대로 동일상품 확인됨으로 표시된다", () => {
    const label = candidateLabel(
      candidate({ matchTruth: null, verified: true, matchReasons: ["modelCode 부분 일치(식별자 근거)"] }),
    );
    expect(label.icon).toBe("🟢");
    expect(label.text).toBe("동일상품 확인됨(식별자 기반 검증)");
  });

  it("verified=false 레거시 행은 matchType 기반으로 표시된다", () => {
    const label = candidateLabel(candidate({ matchTruth: null, verified: false, matchType: "REVIEW_REQUIRED" }));
    expect(label.icon).toBe("⚪");
    expect(label.text).toBe("유사상품");
  });
});

describe("MT-07 — Pepe 실제 순서: ForetForet(STRONG_IDENTIFIER)가 Deuxbebe(SIMILAR)보다 항상 위", () => {
  it("matchTruth 기반 정렬로 42% STRONG_IDENTIFIER가 72% SIMILAR보다 먼저 온다", () => {
    const foretforet = candidate({
      id: "foretforet",
      matchTruth: "STRONG_IDENTIFIER",
      matchConfidence: 0.42,
      verified: true,
    });
    const deuxbebe = candidate({ id: "deuxbebe", matchTruth: "SIMILAR", matchConfidence: 0.72, verified: false });
    const sorted = sortDomesticCandidatesByTrust([deuxbebe, foretforet]);
    expect(sorted[0].id).toBe("foretforet");
    expect(sorted[1].id).toBe("deuxbebe");
  });
});
