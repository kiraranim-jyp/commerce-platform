import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasRealOptionAxes } from "../utils/real-option-axes";
import { extractProductGroupOptions } from "../product-data-extractor";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.5-B B-3(CPO 승인 ㉯, 2026-10-08) — **1×1 은 옵션이 아니다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측(Production DB 전수): Smallable 116건 중 21건이 「옵션 있음」이었는데
 * 전부 같은 모양이었다 —
 *
 *     optionGroups = [{ name: "Color", values: ["Pink"] }]
 *     variants     = [{ id: "variant-0", optionValues: { Color: "Pink" } }]
 *
 * 🔴 고를 것이 없다. 사이즈 축은 116건 중 **0건**이다. 즉 「21 vs 95」는
 *    「성공 vs 실패」가 아니라 「퇴화된 색상 축이 생겼는가」였고, 그 21건이
 *    화면에 «선택 가능한 옵션» 으로 보여 롯데ON 고시정보까지 내려갈 수 있었다.
 *
 * 🔴 **기준을 완화하지도 강화하지도 않았다.** Shopify 경로가 쓰던 그 한 줄을
 *    공용으로 옮겨 JSON-LD 경로가 «같이» 쓰게 했을 뿐이다.
 */

/** 🔴 실측 그 모양. 더미로 바꾸지 않는다. */
const SMALLABLE_1x1 = [{ name: "Color", values: ["Pink"] }];

describe("🔴 ① 1×1 은 옵션이 아니다", () => {
  it("실측 Smallable 모양(Color 1개)은 «옵션 없음» 이다", () => {
    expect(hasRealOptionAxes(SMALLABLE_1x1)).toBe(false);
  });

  it("축 자체가 없으면 옵션 없음", () => {
    expect(hasRealOptionAxes([])).toBe(false);
  });

  it("Shopify 자리표시자(Title=Default Title)도 옵션 없음 — 기존 동작 유지", () => {
    expect(hasRealOptionAxes([{ name: "Title", values: ["Default Title"] }])).toBe(false);
  });
});

describe("🔴🔴 ② 실제 옵션은 하나도 제거되지 않는다", () => {
  it("1×N Size → 옵션", () => {
    expect(hasRealOptionAxes([{ name: "Size", values: ["2Y", "4Y", "6Y", "8Y"] }])).toBe(true);
  });

  it("N×1 — 색상 다수 + 사이즈 1개 → 옵션", () => {
    expect(
      hasRealOptionAxes([
        { name: "Color", values: ["Pink", "Cream"] },
        { name: "Size", values: ["OS"] },
      ]),
    ).toBe(true);
  });

  it("🔴 Color 1개 + Size 다수 → 옵션 (CPO 지정 ④)", () => {
    expect(
      hasRealOptionAxes([
        { name: "Color", values: ["Cream"] },
        { name: "Size", values: ["2Y", "4Y"] },
      ]),
    ).toBe(true);
  });

  it("N×M Color×Size → 옵션", () => {
    expect(
      hasRealOptionAxes([
        { name: "Color", values: ["Pink", "Cream"] },
        { name: "Size", values: ["2Y", "4Y"] },
      ]),
    ).toBe(true);
  });

  it("🔴 축이 둘이면 둘 다 값 1개여도 옵션이다 — 기준을 넓히지 않았다", () => {
    /* 기존 Shopify 판정이 그렇다(optionGroups.length === 1 일 때만 버린다).
       여기서 「조합 수」로 바꾸면 그게 «새 규칙» 이다 — 하지 않는다. */
    expect(
      hasRealOptionAxes([
        { name: "Color", values: ["Pink"] },
        { name: "Size", values: ["OS"] },
      ]),
    ).toBe(true);
  });
});

describe("🔴🔴 ③ 판정이 «한 벌» 이다 — 두 경로가 같은 함수를 쓴다", () => {
  const src = (rel: string) =>
    readFileSync(path.join(__dirname, "..", rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("Shopify 경로가 공용 함수를 부른다", () => {
    expect(src("shopify-product-json.ts")).toContain("hasRealOptionAxes(optionGroups)");
  });

  it("JSON-LD 경로가 «같은» 함수를 부른다", () => {
    expect(src("product-data-extractor.ts")).toContain("hasRealOptionAxes(optionGroups)");
  });

  it("🔴 판정식을 어느 쪽도 «다시 쓰지 않는다» — 복제하면 갈라진다", () => {
    for (const f of ["shopify-product-json.ts", "product-data-extractor.ts"]) {
      expect(src(f), `${f} 가 판정을 복제했다`).not.toMatch(/optionGroups\[0\]\.values\.length === 1/);
    }
  });
});

describe("🔴🔴 ④ JSON-LD 경로 실측 — 1×1 이 내려간다", () => {
  /** 🔴 Smallable 21건을 만든 바로 그 모양(ProductGroup + hasVariant 1개). */
  const ldOneByOne = JSON.stringify({
    "@type": "ProductGroup",
    name: "Tender coat",
    hasVariant: [{ "@type": "Product", color: "Cream", sku: "AAA1725660", offers: { price: 72, priceCurrency: "USD" } }],
  });
  const ldMulti = JSON.stringify({
    "@type": "ProductGroup",
    name: "Bubble Sweatshirt",
    hasVariant: [
      { "@type": "Product", size: "2Y", sku: "A1", offers: { price: 10, priceCurrency: "USD" } },
      { "@type": "Product", size: "4Y", sku: "A2", offers: { price: 10, priceCurrency: "USD" } },
    ],
  });
  const wrap = (json: string) => `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>`;

  it("🔴 1×1 은 null 로 내려간다 — 「옵션 있음」으로 저장되지 않는다", () => {
    expect(extractProductGroupOptions(wrap(ldOneByOne))).toBeNull();
  });

  it("🟢 사이즈 다수는 그대로 추출된다 — 멀쩡한 상품을 버리지 않는다", () => {
    const got = extractProductGroupOptions(wrap(ldMulti));
    expect(got).not.toBeNull();
    expect(got!.optionGroups).toHaveLength(1);
    expect(got!.optionGroups[0].values).toEqual(["2Y", "4Y"]);
    expect(got!.variants).toHaveLength(2);
  });
});
