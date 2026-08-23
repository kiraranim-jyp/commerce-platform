import { describe, expect, it } from "vitest";
import { buildDomesticSearchQueries } from "../query-builder";

describe("buildDomesticSearchQueries", () => {
  it("브랜드+모델명 → 브랜드+상품명 → 모델명 순으로 우선순위를 만든다(대표님 예시)", () => {
    const queries = buildDomesticSearchQueries({
      brand: "Bobo Choses",
      title: "Color Block Zipped Sweatshirt",
      modelName: "B126AC050",
    });
    expect(queries).toEqual([
      "Bobo Choses B126AC050",
      "Bobo Choses Color Block Zipped Sweatshirt",
      "B126AC050",
    ]);
  });

  it("모델명이 없으면 브랜드+상품명만 후보로 남는다", () => {
    const queries = buildDomesticSearchQueries({
      brand: "TestBrand",
      title: "Basic T-Shirt",
      modelName: "",
    });
    expect(queries).toEqual(["TestBrand Basic T-Shirt"]);
  });

  it("브랜드/모델명이 둘 다 없으면 최후 수단으로 원문 title 단독을 쓴다", () => {
    const queries = buildDomesticSearchQueries({
      brand: "",
      title: "Ceramic Mug",
      modelName: "",
    });
    expect(queries).toEqual(["Ceramic Mug"]);
  });

  it("아무 필드도 없으면 빈 배열(검색어를 지어내지 않는다)", () => {
    const queries = buildDomesticSearchQueries({ brand: "", title: "", modelName: "" });
    expect(queries).toEqual([]);
  });
});
