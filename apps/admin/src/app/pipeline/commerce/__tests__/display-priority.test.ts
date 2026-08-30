import { describe, expect, it } from "vitest";
import { sortDomesticCandidatesByTrust, type DomesticCandidateTrust } from "@commerce/crawler";

/**
 * P-9-A STEP 2(대표님 지시, 2026-08-30) — MP-01~05를 그대로 옮긴다.
 * "72% 유사상품이 42% 검증된 동일상품보다 위에 보인다"를 재현/고정하는 회귀.
 */
function candidate(overrides: Partial<DomesticCandidateTrust>): DomesticCandidateTrust {
  return {
    verified: false,
    matchConfidence: 0.5,
    matchReasons: [],
    ...overrides,
  };
}

describe("P-9-A STEP 2: sortDomesticCandidatesByTrust", () => {
  it("MP-01) confidence 0.42+verified=true가 confidence 0.72+verified=false보다 항상 위", () => {
    const a = candidate({ matchConfidence: 0.42, verified: true, matchReasons: ["modelCode 부분 일치(식별자 근거)"] });
    const b = candidate({ matchConfidence: 0.72, verified: false });
    const sorted = sortDomesticCandidatesByTrust([b, a]);
    expect(sorted[0]).toBe(a);
    expect(sorted[1]).toBe(b);
  });

  it("MP-02) verified=true(0.20)가 verified=false(0.95)보다 위", () => {
    const a = candidate({ matchConfidence: 0.2, verified: true });
    const b = candidate({ matchConfidence: 0.95, verified: false });
    const sorted = sortDomesticCandidatesByTrust([b, a]);
    expect(sorted[0]).toBe(a);
  });

  it("MP-03) 둘 다 verified=true면 식별자 근거 있는 쪽이 먼저, 그다음 confidence", () => {
    const withIdentifier = candidate({
      matchConfidence: 0.3,
      verified: true,
      matchReasons: ["modelCode 완전 일치(식별자 근거)"],
    });
    const textOnly = candidate({ matchConfidence: 0.9, verified: true, matchReasons: ["모델명 유사도 90%"] });
    const sorted = sortDomesticCandidatesByTrust([textOnly, withIdentifier]);
    expect(sorted[0]).toBe(withIdentifier);
    expect(sorted[1]).toBe(textOnly);
  });

  it("MP-04) 둘 다 verified=false면 기존대로 matchConfidence 내림차순", () => {
    const high = candidate({ matchConfidence: 0.8, verified: false });
    const low = candidate({ matchConfidence: 0.3, verified: false });
    const sorted = sortDomesticCandidatesByTrust([low, high]);
    expect(sorted[0]).toBe(high);
    expect(sorted[1]).toBe(low);
  });

  it("MP-05) Pepe Shoes 실제 골든케이스 — 포레포레(42%, 식별자 검증) 상단, 듀베베(72%, 미검증) 하단", () => {
    const foretforet = candidate({
      matchConfidence: 0.42,
      verified: true,
      matchReasons: [
        "상품명 유사도 22%",
        "색상 일치(제목 내 확인)",
        "카테고리 일치",
        "SKU 불일치",
        "브랜드 일치",
        "modelCode 부분 일치(식별자 근거) + 기존 매칭 level=low — 텍스트 점수와 무관하게 식별자 증거로 자동확정",
      ],
    });
    const deuxbebe = candidate({
      matchConfidence: 0.72,
      verified: false,
      matchReasons: ["상품명 유사도 33%", "색상 일치(제목 내 확인)", "브랜드 일치"],
    });
    const sorted = sortDomesticCandidatesByTrust([deuxbebe, foretforet]);
    expect(sorted[0]).toBe(foretforet);
    expect(sorted[1]).toBe(deuxbebe);
  });
});
