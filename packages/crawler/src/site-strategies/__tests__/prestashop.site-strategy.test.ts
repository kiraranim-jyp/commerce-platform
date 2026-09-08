import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isPrestaShopHtml,
  looksLikePrestaShopUrl,
  parsePrestaShopHtml,
} from "../prestashop.site-strategy";

/**
 * SITE-EXTENSION-IMPLEMENTATION-1(CPO 지시, 2026-09-08).
 *
 * fixture는 2026-09-08에 실제 사이트에서 받은 HTML을 잘라낸 것이다(마크업을
 * 손으로 지어내지 않았다). 두 사이트 모두 JSON-LD가 없고 schema.org Microdata를
 * 쓴다는 것이 실측으로 확인됐고, 그래서 이 전략이 필요하다.
 *
 * 이 테스트가 지키는 것은 두 가지다:
 *  1) 두 PrestaShop 사이트에서 상품 데이터를 실제로 뽑는다.
 *  2) PrestaShop이 아닌 페이지를 PrestaShop이라고 우기지 않는다(§9 false positive).
 */
const FIXTURES = path.join(__dirname, "fixtures");
const read = (name: string) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

describe("PrestaShop URL 힌트(detect 1단계)", () => {
  it("PrestaShop 상품 URL 형식을 힌트로 인식한다", () => {
    expect(looksLikePrestaShopUrl("https://www.lojadada.com/en/leggings/10855-dices-aop-leggings.html")).toBe(true);
    expect(
      looksLikePrestaShopUrl("https://www.lillamode.com/sv/troejor-koftor/15142-nununu-side-eye-sweatshirt.html"),
    ).toBe(true);
  });

  it("Shopify 상품 URL은 힌트에 걸리지 않는다 — 기존 Shopify 경로를 뺏으면 안 된다", () => {
    expect(
      looksLikePrestaShopUrl(
        "https://www.junioredition.com/en-kr/collections/bobo-choses/products/tangerine-all-over-baby-swim-cap-by-bobo-choses",
      ),
    ).toBe(false);
  });

  it("숫자 id가 없는 일반 URL은 힌트에 걸리지 않는다", () => {
    expect(looksLikePrestaShopUrl("https://example.com/about.html")).toBe(false);
    expect(looksLikePrestaShopUrl("https://example.com/en/collections/all")).toBe(false);
    expect(looksLikePrestaShopUrl("not-a-url")).toBe(false);
  });

  it("URL 힌트만으로는 확정하지 않는다 — 안전장치는 시그니처 검사다", () => {
    // `/blog/2024-review.html`은 구조적으로 PrestaShop 상품 URL과 구분되지
    // 않는다. 연도처럼 보이는 숫자를 배제하면 id가 1900~2099인 실제 상품이
    // 깨지므로, detect()는 느슨하게 두고 extract()의 시그니처 검사로 막는다.
    // 잘못 걸려도 비용은 HTTP GET 한 번이고, 그 뒤 null이 되어 기존
    // 파이프라인으로 그대로 넘어간다.
    const blogUrl = "https://example.com/blog/2024-review.html";
    expect(looksLikePrestaShopUrl(blogUrl)).toBe(true);
    expect(parsePrestaShopHtml("<html><body><h1>2024 리뷰</h1></body></html>", blogUrl)).toBeNull();
  });
});

describe("PrestaShop 시그니처 확인(detect 2단계) — §9 false positive 방지", () => {
  it("generator meta가 있으면 PrestaShop으로 확정한다(1.7+, lillamode)", () => {
    expect(isPrestaShopHtml(read("lillamode-product.html"))).toBe(true);
  });

  it("generator meta가 없어도 전역 JS 신호로 확정한다(1.6, lojadada)", () => {
    const html = read("lojadada-product.html");
    expect(/generator["'][^>]+PrestaShop/i.test(html)).toBe(false);
    expect(isPrestaShopHtml(html)).toBe(true);
  });

  it("핵심 회귀 — 신호가 하나뿐이면 PrestaShop이라고 단정하지 않는다", () => {
    // 다른 플랫폼도 id_product 같은 변수명을 쓸 수 있다. 하나만으로 확정하면
    // 멀쩡한 사이트의 수집 경로를 가로챈다.
    expect(isPrestaShopHtml("<html><script>var id_product = 12;</script></html>")).toBe(false);
  });

  it("PrestaShop이 아닌 페이지는 파싱 결과가 null이다", () => {
    const notPresta = '<html><head><meta name="generator" content="WordPress"></head><body>hi</body></html>';
    expect(parsePrestaShopHtml(notPresta, "https://example.com/1-x.html")).toBeNull();
  });
});

describe("Loja Dada 상품 추출(PrestaShop 1.6, EUR)", () => {
  const result = parsePrestaShopHtml(
    read("lojadada-product.html"),
    "https://www.lojadada.com/en/leggings/10855-dices-aop-leggings.html",
  );

  it("상품 데이터를 추출한다", () => {
    expect(result).not.toBeNull();
  });

  it("상품명", () => {
    expect(result?.productData.title).toBe("Dices AOP Leggings");
  });

  it("가격과 통화 — 실측값 37 EUR", () => {
    expect(result?.productData.price).toEqual({ amount: 37, currency: "EUR" });
    expect(result?.productData.priceValidity).toBe("VALID");
  });

  it("재고 상태", () => {
    expect(result?.productData.available).toBe(true);
  });

  it("이미지를 찾는다", () => {
    expect((result?.images.length ?? 0)).toBeGreaterThan(0);
    expect(result?.images.every((i) => i.source === "prestashop")).toBe(true);
  });

  it("썸네일(small_default)은 이미지 후보에서 제외한다", () => {
    expect(result?.images.some((i) => /small_default/.test(i.url))).toBe(false);
  });

  it("핵심 회귀 — itemprop=\"sku\"에 브랜드명이 들어 있으면 SKU로 쓰지 않는다", () => {
    // lojadada 실측: sku 자리에 "BOBO CHOSES"(브랜드)가 있다. 그대로 믿으면
    // 매칭 로직이 가짜 식별자를 근거로 동일상품 판정을 내린다.
    expect(result?.productData.sku).toBeUndefined();
  });
});

describe("Lilla Mode 상품 추출(PrestaShop 1.7+, SEK)", () => {
  const result = parsePrestaShopHtml(
    read("lillamode-product.html"),
    "https://www.lillamode.com/sv/troejor-koftor/15142-nununu-side-eye-sweatshirt.html",
  );

  it("상품 데이터를 추출한다", () => {
    expect(result).not.toBeNull();
  });

  it("상품명", () => {
    expect(result?.productData.title).toBe("Side Eye Sweatshirt");
  });

  it("가격과 통화 — 실측값 344.5 SEK(소수점 유지)", () => {
    expect(result?.productData.price).toEqual({ amount: 344.5, currency: "SEK" });
  });

  it("브랜드와 SKU가 서로 다르면 둘 다 살린다", () => {
    expect(result?.productData.brand).toBe("NUNUNU");
    expect(result?.productData.sku).toBeTruthy();
    expect(result?.productData.sku).not.toBe(result?.productData.brand);
  });

  it("재고 상태", () => {
    expect(result?.productData.available).toBe(true);
  });
});

describe("가격 정책(§6) — 지어내지 않는다", () => {
  const base = '<meta name="generator" content="PrestaShop" />';

  it("가격을 못 찾으면 MISSING이고 0을 넣지 않는다", () => {
    const html = `${base}<h1 itemprop="name">이름만 있는 상품</h1>`;
    const r = parsePrestaShopHtml(html, "https://x.test/1-a.html");
    expect(r?.productData.priceValidity).toBe("MISSING");
    expect(r?.productData.price).toBeUndefined();
  });

  it("가격 텍스트를 못 읽으면 INVALID로 두고 원문을 남긴다", () => {
    const html = `${base}<h1 itemprop="name">상품</h1><div itemprop="offers"><span itemprop="price" content="문의">문의</span></div>`;
    const r = parsePrestaShopHtml(html, "https://x.test/1-a.html");
    expect(r?.productData.priceValidity).toBe("INVALID");
    expect(r?.productData.priceRawText).toBe("문의");
    expect(r?.productData.price).toBeUndefined();
  });
});
