import { describe, expect, it } from "vitest";
import { buildDomesticShopQueryFromFields } from "../product-identity-dna";

/**
 * MI-DOMESTIC-FIX-1 §1(CPO 지시, 2026-09-09).
 *
 * 지키는 불변조건: **실시간 국내 검색이 원제목을 그대로 보내지 않는다.**
 * 배치 경로는 buildDomesticShopQuery로 검색어를 좁혔는데 화면이 쓰는 실시간
 * 경로만 그걸 우회해서, 10단어 영문 원제목이 국내 편집샵 검색창에 들어갔다.
 * 검색어 정책 자체는 여기서 새로 만들지 않는다 — 기존 함수에 위임만 한다.
 */
const CASE = {
  title: "Stella McCartney Kids Girls Black Cotton Halloween Logo Sweatshirt",
  brand: "Stella McCartney Kids",
  sku: "633403",
  sourceUrl: "https://www.childrensalon.com/stella-mccartney-kids-...-633403.html",
};

describe("실시간 검색어 — 배치와 같은 우선순위를 쓴다", () => {
  it("핵심 회귀: SKU가 있으면 SKU 단독으로 검색한다", () => {
    expect(buildDomesticShopQueryFromFields(CASE)).toBe("633403");
  });

  it("핵심 회귀: 원제목 전체가 검색어가 되지 않는다", () => {
    expect(buildDomesticShopQueryFromFields(CASE)).not.toBe(CASE.title);
  });

  it("SKU가 없으면 브랜드+핵심 상품명으로 간다 — 핵심 토큰은 6개로 잘린다", () => {
    // 검색어가 길면 국내 편집샵에서 0건이 되는 것이 실측으로 확인돼 있어서
    // 기존 정책이 핵심 토큰을 6개로 제한한다. 그 상한이 실시간 경로에도
    // 그대로 적용되는지가 이 테스트의 요점이다.
    const long = "Acme Girls Black Cotton Halloween Logo Sweatshirt With Ruffled Collar And Cuffs";
    const q = buildDomesticShopQueryFromFields({ title: long, brand: "Acme" });
    expect(q).toContain("Acme");
    expect(q.split(/\s+/).length).toBeLessThanOrEqual(1 + 6);
    expect(q.split(/\s+/).length).toBeLessThan(long.split(/\s+/).length);
  });

  it("브랜드 단어는 핵심 토큰에서 빠진다 — 브랜드가 두 번 들어가지 않는다", () => {
    const q = buildDomesticShopQueryFromFields({ title: "Acme Halloween Logo Sweatshirt", brand: "Acme" });
    expect(q.toLowerCase().split("acme").length - 1).toBe(1);
  });

  it("SKU 앞뒤 공백은 검색어에 새어나가지 않는다", () => {
    expect(buildDomesticShopQueryFromFields({ title: CASE.title, sku: "  633403 " })).toBe("633403");
  });

  it("brand/sku가 전혀 없어도 빈 검색어를 만들지 않는다", () => {
    expect(buildDomesticShopQueryFromFields({ title: CASE.title }).trim()).not.toBe("");
  });
});
