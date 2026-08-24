import { describe, expect, it } from "vitest";
import { classifyListingMatch, isUsableForCompetitionPrice } from "../match-confidence";

const product = { brand: "Bobo Choses", modelName: "B126AC050", title: "Color Block Zipped Sweatshirt" };

describe("classifyListingMatch", () => {
  it("브랜드+모델명이 모두 포함된 제목 → MATCH", () => {
    const result = classifyListingMatch(product, { title: "보보쇼즈 Bobo Choses B126AC050 스웨트셔츠" });
    expect(result.level).toBe("MATCH");
    expect(result.reasons).toContain("브랜드 일치");
    expect(result.reasons).toContain("모델명 일치");
  });

  it("브랜드만 포함, 모델명 없음 + 제목 유사도 있음 → LIKELY_MATCH", () => {
    const result = classifyListingMatch(product, { title: "Bobo Choses Color Block Zipped Sweatshirt" });
    expect(result.level).toBe("LIKELY_MATCH");
  });

  it("전혀 다른 상품(브랜드/모델명/제목 모두 불일치) → REJECT", () => {
    const result = classifyListingMatch(product, { title: "삼성 갤럭시 스마트폰 케이스" });
    expect(result.level).toBe("REJECT");
  });

  it("리스팅 제목이 없으면(null) 비교 불가 — REJECT", () => {
    const result = classifyListingMatch(product, { title: null });
    expect(result.level).toBe("REJECT");
    expect(result.score).toBe(0);
  });

  it("같은 브랜드의 다른 상품(브랜드만 겹치고 제목/모델명은 다름) → REJECT 또는 WEAK_MATCH — 절대 MATCH 아님", () => {
    const result = classifyListingMatch(product, { title: "Bobo Choses 반팔 티셔츠 키즈" });
    expect(result.level).not.toBe("MATCH");
  });

  it("isUsableForCompetitionPrice — MATCH/LIKELY_MATCH만 true(N-4.18: WEAK_MATCH는 경쟁가격 계산에서 제외)", () => {
    expect(isUsableForCompetitionPrice("MATCH")).toBe(true);
    expect(isUsableForCompetitionPrice("LIKELY_MATCH")).toBe(true);
    expect(isUsableForCompetitionPrice("WEAK_MATCH")).toBe(false);
    expect(isUsableForCompetitionPrice("REJECT")).toBe(false);
  });

  it("색상이 둘 다 명시되고 다르면 감점된다(같은 모델이라도 다른 옵션)", () => {
    const withColor = { ...product, color: "네이비" };
    const sameColor = classifyListingMatch(withColor, { title: "보보쇼즈 Bobo Choses B126AC050 네이비 스웨트셔츠" });
    const diffColor = classifyListingMatch(withColor, { title: "보보쇼즈 Bobo Choses B126AC050 블랙 스웨트셔츠" });
    expect(diffColor.score).toBeLessThan(sameColor.score);
    expect(diffColor.reasons).toContain("색상 불일치 — 다른 옵션일 수 있음");
    expect(sameColor.reasons).toContain("색상 일치");
  });

  it("리스팅 제목에 색상 단어가 없으면 색상 신호를 쓰지 않는다(추측 금지)", () => {
    const withColor = { ...product, color: "네이비" };
    const noColorInListing = classifyListingMatch(withColor, { title: "보보쇼즈 Bobo Choses B126AC050 스웨트셔츠" });
    const withoutColorField = classifyListingMatch(product, { title: "보보쇼즈 Bobo Choses B126AC050 스웨트셔츠" });
    expect(noColorInListing.score).toBe(withoutColorField.score);
  });
});
