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

  it("isUsableForCompetitionPrice — REJECT만 false, 나머지는 true", () => {
    expect(isUsableForCompetitionPrice("MATCH")).toBe(true);
    expect(isUsableForCompetitionPrice("LIKELY_MATCH")).toBe(true);
    expect(isUsableForCompetitionPrice("WEAK_MATCH")).toBe(true);
    expect(isUsableForCompetitionPrice("REJECT")).toBe(false);
  });
});
