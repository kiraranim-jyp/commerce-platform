/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02l (CPO 지시, 2026-10-11) — Brand Evidence Owner
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 아래 값은 **전부 fixture 전수 실측** 이다(`packages/crawler/src/__tests__/
 *    fixtures/` 27건 중 Shopify `vendor` 보유분). 지어낸 값이 하나도 없다.
 *
 * 확정된 사실:
 *   `vendor` 는 브랜드 칸이 «아니다». 상점마다 다른 용도로 쓴다 —
 *   편집샵은 컬렉션/프로모션 라벨, 자사몰은 시즌 또는 브랜드.
 *
 *   junioredition(편집샵)  by절 16/16 = 100%   vendor 는 오염돼 있다
 *   bobochoses(자사몰)      by절  0/9           vendor = 시즌
 *   main-story(자사몰)      by절  0/2           vendor = 브랜드
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brandFromTitleByClause, productFactsFromShopifyProduct } from "../seller-facts";

const FIXTURES = path.join(__dirname, "..", "..", "__tests__", "fixtures");
const load = (f: string) => JSON.parse(readFileSync(path.join(FIXTURES, f), "utf8")) as Record<string, unknown>;

/* ═══════════ ① 규칙 — 두 출처가 동의할 때만 값을 만든다 ═══════════ */

describe("🟢 MI-P0-02l — brandFromTitleByClause (실측 16/16)", () => {
  /** 🔴 vendor 오염 5유형 전부. 왼쪽이 실측 vendor, 가운데가 실측 by절이다. */
  const MEASURED: [vendor: string, byClause: string, expected: string, 유형: string][] = [
    ["Main Story AW26", "Main Story", "Main Story", "② 시즌 섞임"],
    ["Bobo Choses 60% Off Sale", "Bobo Choses", "Bobo Choses", "③ 프로모션"],
    ["Misha & Puff Fall 26", "Misha & Puff", "Misha & Puff", "④ 시즌 영문표기"],
    ["Konges Sløjd Clothing AW26", "Konges Sløjd", "Konges Sløjd", "②+⑤"],
    ["Bobo Choses AW26 Baby", "Bobo Choses", "Bobo Choses", "②+⑤"],
    ["Pèpè Shoes 50% Off", "PèPè", "PèPè", "③+⑤"],
    ["Pèpè Shoes", "PèPè", "PèPè", "⑤ 라인어"],
    // 🔴 실측 FP 2건 — by절 끝에 재고/사이즈 라벨이 붙는다. vendor 가 교정한다.
    ["Bobo Choses 60% Off Sale", "Bobo Choses - Last One In Stock - 6 Months", "Bobo Choses", "🔴 by절 오염"],
    ["Pèpè Shoes", "PèPè - Last Ones In Stock - 28-29 EUR", "PèPè", "🔴 by절 오염"],
  ];

  it.each(MEASURED)("%s + by「%s」 → %s  (%s)", (vendor, by, expected) => {
    expect(brandFromTitleByClause(`Some Product in Colour by ${by}`, vendor)).toBe(expected);
  });

  /**
   * 🔴 **FP 대조군.** 규칙이 「틀린 것을 만들」 수 있는지 본다. 넷 다 null 이어야
   *    한다 — null 이면 기존 경로(② vendor · ③ 도메인 매핑)로 내려가므로 안전하다.
   */
  it("🔴 by절이 없으면 null — 기존 경로로 내려간다", () => {
    expect(brandFromTitleByClause("Bubble Sweatshirt - Grey Melange", "Main Story")).toBeNull();
    expect(brandFromTitleByClause("Mush Monster Duo all over T-shirt", "AW26")).toBeNull();
  });

  it("🔴 by절이 vendor 와 «동의하지 않으면» null — 지어내지 않는다", () => {
    expect(brandFromTitleByClause("Dress by the sea", "Bobo Choses 60% Off Sale")).toBeNull();
    expect(brandFromTitleByClause("Thing by Completely Different Brand", "Pèpè Shoes")).toBeNull();
  });

  it("🟢 하이픈이 든 브랜드가 깎이지 않는다 — 토큰 단위로 본다", () => {
    expect(brandFromTitleByClause("Coat by Mini-La-Mode", "Mini-La-Mode")).toBe("Mini-La-Mode");
  });

  it("vendor 가 없으면 null — 한쪽만으로 만들지 않는다", () => {
    expect(brandFromTitleByClause("Coat by Main Story", undefined)).toBeNull();
    expect(brandFromTitleByClause("Coat by Main Story", "")).toBeNull();
  });

  /** 🔴 표기 차이는 여기서 통일하지 «않는다» — downstream(normalizeBrand)이 흡수한다. */
  it("🔴 by절 표기를 채택한다 — vendor 표기로 바꾸지 않는다", () => {
    expect(brandFromTitleByClause("Shoes by PèPè", "Pèpè Shoes")).toBe("PèPè");
  });
});

/* ═══════════ ② 실제 fixture 를 통과시켜 brand 가 고쳐지는가 ═══════════ */

describe("🟢 MI-P0-02l — 실제 fixture 에서 brand 오염이 사라진다", () => {
  const facts = (file: string, domain: string) => {
    const raw = load(file);
    return productFactsFromShopifyProduct(
      {
        title: raw.title as string,
        handle: raw.handle as string,
        url: `/products/${raw.handle as string}`,
        description: raw.description as string,
        vendor: raw.vendor as string,
        type: raw.type as string,
        tags: raw.tags as string[],
        options: raw.options as { name?: string; values?: string[] }[],
        images: raw.images as string[],
      },
      domain,
    );
  };

  it("🟢 junioredition Main Story — vendor 'Main Story AW26' → brand 'Main Story'", () => {
    const f = facts("junioredition-bubble-sweatshirt-in-grey-melange-by-main-story.json", "junioredition.com");
    expect(f.brand).toBe("Main Story");
    // 🔴 시즌코드가 brand 에 남아 있으면 이 단언이 깨진다.
    expect(f.brand).not.toContain("AW26");
  });

  it("🟢 junioredition Bobo — vendor 'Bobo Choses … Sale' → brand 'Bobo Choses'", () => {
    const f = facts("junioredition-bobo-choses-color-all-over-baby-t-shirt-by-bobo-choses.json", "junioredition.com");
    expect(f.brand).toBe("Bobo Choses");
    expect(f.brand).not.toMatch(/off|sale/i);
  });

  /**
   * 🔴 **회귀 대조군.** 자사몰은 by절이 0% 이므로 ①이 발화하지 않고 기존 경로가
   *    그대로 쓰인다. 이 단언이 깨지면 추가 전용이 아니게 된 것이다.
   */
  it("🟢 bobochoses 자사몰 — vendor 가 시즌이라 도메인 매핑이 그대로 담당한다", () => {
    const f = facts("bobochoses-b226ac114.json", "bobochoses.com");
    expect(f.brand).toBe("Bobo Choses");
  });

  it("🟢 등록되지 않은 도메인 + 시즌 vendor → null (지어내지 않는다)", () => {
    const raw = load("bobochoses-b226ac114.json");
    const f = productFactsFromShopifyProduct(
      { title: raw.title as string, handle: raw.handle as string, vendor: raw.vendor as string },
      "unknown-shop.example",
    );
    expect(f.brand).toBeNull();
  });
});
