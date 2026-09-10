import { describe, expect, it } from "vitest";
import { parsePrestaShopHtml } from "../site-strategies/prestashop.site-strategy";

/**
 * PRESTASHOP-RESIDUAL-2(CPO 지시, 2026-09-10).
 *
 * PrestaShop fast path가 microdata만 읽어서 정가·옵션·variant를 통째로 잃고 있었다.
 * 실측(lojadada 1.6, lillamode 1.7)에서 확인한 구조를 같은 HTML에서 함께 읽는다.
 *
 * fixture는 실측 마크업의 최소 형태다 — 전체 HTML(75~85KB)을 넣지 않는다.
 */
const base = (extra: string) => `
<html><head><meta name="generator" content="PrestaShop"></head><body>
  <h1 itemprop="name">Snakes Baby Sweatshirt</h1>
  <span itemprop="brand" content="THE CAMPAMENTO"></span>
  <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
    <meta itemprop="price" content="49">
    <meta itemprop="priceCurrency" content="EUR">
    <link itemprop="availability" href="https://schema.org/InStock">
  </div>
  <img src="https://x/img1.jpg">
  ${extra}
</body></html>`;

const SELECT = `
  <span class="attribute_label">Baby Size&nbsp;</span>
  <select name="group_4" id="group_4" class="attribute_select">
    <option value="1" title="12-18m">12-18m</option>
    <option value="2" title="18-24m">18-24m - Sold Out</option>
  </select>`;

const COMBINATIONS = `<script>var combinations = {
  "46643":{"attributes_values":{"4":"12-18m"},"attributes":[1],"price":0,"quantity":1,"reference":""},
  "46644":{"attributes_values":{"4":"18-24m"},"attributes":[2],"price":0,"quantity":0,"reference":""}
};</script>`;

describe("regularPrice — 할인 여부를 지어내지 않는다", () => {
  it("핵심 회귀: 할인이 없으면(빈 old_price) regularPrice를 만들지 않는다", () => {
    const d = parsePrestaShopHtml(
      base(`<p id="old_price" class=" hidden pull-left"><span id="old_price_display"></span></p>${SELECT}${COMBINATIONS}`),
      "https://www.lojadada.com/en/baby/1-x.html",
    )?.productData;
    expect(d?.price).toEqual({ amount: 49, currency: "EUR" });
    expect(d?.regularPrice).toBeUndefined();
    // 현재가를 정가로 복사하면 없는 할인이 생긴다.
    expect(d?.regularPrice).not.toEqual(d?.price);
  });

  it("할인 중이면 old_price_display에서 정가를 읽는다", () => {
    const html = base(
      `<p id="old_price"><span id="old_price_display"><span class="price">689,00 SEK</span></span></p>${COMBINATIONS}`,
    ).replace('content="49"', 'content="344.5"').replace('content="EUR"', 'content="SEK"');
    const d = parsePrestaShopHtml(html, "https://www.lillamode.com/sv/x/1-y.html")?.productData;
    expect(d?.price).toEqual({ amount: 344.5, currency: "SEK" });
    // "689,00 SEK"를 그대로 넘기면 68900이 된다 — 통화 접미사를 떼고 파싱해야 한다.
    expect(d?.regularPrice).toEqual({ amount: 689, currency: "SEK" });
  });

  it("정가가 현재가보다 크지 않으면 쓰지 않는다 — 할인이 아니다", () => {
    const d = parsePrestaShopHtml(
      base(`<p id="old_price"><span id="old_price_display"><span class="price">40,00 EUR</span></span></p>`),
      "https://www.lojadada.com/en/x/1-y.html",
    )?.productData;
    expect(d?.regularPrice).toBeUndefined();
  });
});

describe("optionGroups / variants", () => {
  const d = () =>
    parsePrestaShopHtml(base(`${SELECT}${COMBINATIONS}`), "https://www.lojadada.com/en/baby/1-x.html")?.productData;

  it("옵션 그룹 이름은 select 라벨에서 가져온다", () => {
    expect(d()?.optionGroups).toEqual([{ name: "Baby Size", values: ["12-18m", "18-24m"] }]);
  });

  it("핵심 회귀: variant가 참조하는 값이 optionGroups에 전부 있다(타입 계약)", () => {
    // 실측(lillamode): <select>는 재고 있는 사이즈만 노출하는데 combinations에는
    // 품절까지 다 있다. select만 쓰면 variant가 그룹에 없는 값을 가리킨다.
    const p = d();
    for (const v of p?.variants ?? []) {
      for (const [name, value] of Object.entries(v.optionValues)) {
        const group = p?.optionGroups?.find((g) => g.name === name);
        expect(group, `그룹 ${name}이 없다`).toBeDefined();
        expect(group!.values).toContain(value);
      }
    }
  });

  it("variant id는 combinations 키를 보존한다", () => {
    expect(d()?.variants?.map((v) => v.id)).toEqual(["46643", "46644"]);
  });

  it("핵심 회귀: quantity 0을 falsy라고 지우지 않는다 — 품절도 정보다", () => {
    expect(d()?.variants?.map((v) => v.stockQuantity)).toEqual([1, 0]);
  });

  it("핵심 회귀: reference가 빈 문자열이면 SKU로 저장하지 않는다", () => {
    // 빈 식별자를 저장하면 매칭이 가짜 SKU를 믿게 된다.
    expect(d()?.variants?.every((v) => v.sku === undefined)).toBe(true);
  });

  it("variant reference가 있어도 상품 레벨 SKU를 덮어쓰지 않는다", () => {
    const withRef = COMBINATIONS.replace(/"reference":""/g, '"reference":"VAR-1"');
    const p = parsePrestaShopHtml(
      base(`<span itemprop="sku" content="PRODUCT-SKU"></span>${SELECT}${withRef}`),
      "https://www.lojadada.com/en/baby/1-x.html",
    )?.productData;
    expect(p?.sku).toBe("PRODUCT-SKU");
    expect(p?.variants?.[0]?.sku).toBe("VAR-1");
  });
});

describe("기존 필드가 변하지 않는다", () => {
  it("옵션/정가 추가가 title·brand·price·images를 건드리지 않는다", () => {
    const without = parsePrestaShopHtml(base(""), "https://www.lojadada.com/en/x/1-y.html");
    const with_ = parsePrestaShopHtml(base(`${SELECT}${COMBINATIONS}`), "https://www.lojadada.com/en/x/1-y.html");
    expect(with_?.productData.title).toBe(without?.productData.title);
    expect(with_?.productData.brand).toBe(without?.productData.brand);
    expect(with_?.productData.price).toEqual(without?.productData.price);
    expect(with_?.images.length).toBe(without?.images.length);
  });
});
