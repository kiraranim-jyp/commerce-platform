import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WU-080 생산자 계약 — **후보 브랜드 extractor 를 직접 부른다** (네트워크 0)
 *
 * 🔴 CPO §14: 「캐시 기반 하니스 금지 · 반드시 실제 producer owner 를 직접 호출」.
 * 🟢 owner 는 `product-url-facts.ts` 의 `brandFromHtml` →
 *    `og:brand` ?? `product:brand` ?? JSON-LD `"brand"."name"` ?? microdata brand.
 */

let router: (url: string) => { status: number; finalUrl: string; body: string };

vi.mock("../../rate-limit/domain-rate-limiter", () => ({
  fetchWithDomainRateLimit: async (url: string) => {
    const r = router(url);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      url: r.finalUrl,
      text: async () => r.body,
      json: async () => JSON.parse(r.body),
    } as unknown as Response;
  },
}));

const { factsFromProductUrl } = await import("../product-url-facts");

const U = "https://shop.example.co.kr/goods/goods_view.php?goodsNo=1";
const page = (head: string, body = "") =>
  `<html><head><title>보보쇼즈 티셔츠 B226AC010</title>${head}</head><body>${body}</body></html>`;

beforeEach(() => {
  router = () => ({ status: 200, finalUrl: U, body: page("") });
});

describe("WU-080 — 후보 브랜드 생산자 계약", () => {
  it("🟢 JSON-LD brand.name 을 읽는다", async () => {
    router = () => ({
      status: 200,
      finalUrl: U,
      body: page(`<script type="application/ld+json">{"@type":"Product","name":"t","brand":{"name":"Bobo Choses"}}</script>`),
    });
    expect((await factsFromProductUrl(U)).candidate?.facts?.brand).toBe("Bobo Choses");
  });

  it("🟢 `og:brand` 가 JSON-LD 보다 **먼저** 다(precedence)", async () => {
    router = () => ({
      status: 200,
      finalUrl: U,
      body: page(
        `<meta property="og:brand" content="OG Brand">
<script type="application/ld+json">{"@type":"Product","name":"t","brand":{"name":"LD Brand"}}</script>`,
      ),
    });
    expect((await factsFromProductUrl(U)).candidate?.facts?.brand).toBe("OG Brand");
  });

  /**
   * 🔴 **1차 하니스에 B3 를 잡을 케이스가 없었다** — microdata brand 가 있는 HTML 을
   *    안 썼더니 `brandFromHtml ?? micro?.brand` 순서를 뒤집어도 **통과** 했다.
   *    🟢 CPO §14 대로 **하니스를 고쳤다**(이 케이스를 추가).
   */
  it("🔴 B3 precedence — JSON-LD 가 **microdata 를 이긴다**", async () => {
    router = () => ({
      status: 200,
      finalUrl: U,
      body: page(
        `<script type="application/ld+json">{"@type":"Product","name":"t","brand":{"name":"LD Brand"},"offers":{"price":1000,"priceCurrency":"KRW"}}</script>`,
        `<div itemscope itemtype="https://schema.org/Product"><span itemprop="name">t</span>
<span itemprop="brand">MICRO Brand</span><span itemprop="price" content="1000"></span>
<meta itemprop="priceCurrency" content="KRW"></div>`,
      ),
    });
    expect((await factsFromProductUrl(U)).candidate?.facts?.brand).toBe("LD Brand");
  });

  it("🔴 B5 **도메인만으로 브랜드를 만들지 않는다** — 증거가 없으면 null 이다", async () => {
    /** 🔴 호스트가 `bobochoses` 를 포함해도 브랜드가 생기면 안 된다. */
    const u2 = "https://bobochoses.co.kr/goods/goods_view.php?goodsNo=1";
    router = () => ({ status: 200, finalUrl: u2, body: page("") });
    const f = await factsFromProductUrl(u2);
    expect(f.candidate?.facts?.brand ?? null).toBeNull();
  });

  it("🔴 **본문에 브랜드 글자가 있어도** 브랜드로 쓰지 않는다(명시 source 만)", async () => {
    router = () => ({ status: 200, finalUrl: U, body: page("", "<p>브랜드 : Bobo Choses</p>") });
    expect((await factsFromProductUrl(U)).candidate?.facts?.brand ?? null).toBeNull();
  });

  it("🔴 B4 가짜 브랜드를 **명시 source 에** 넣으면 그대로 읽힌다(= 실제로 그 자리를 읽고 있다)", async () => {
    router = () => ({ status: 200, finalUrl: U, body: page(`<meta property="og:brand" content="FAKE-BRAND-9x8y">`) });
    expect((await factsFromProductUrl(U)).candidate?.facts?.brand).toBe("FAKE-BRAND-9x8y");
  });

  it("🔴 B2 시즌 코드는 **브랜드가 아니다** — 정규화 owner 가 버린다", async () => {
    const { resolveBrandIdentity } = await import("@commerce/shared/src/brand-identity");
    /** 🔴 추출기는 읽지만(raw 유지) **정규화가 값을 null 로 만든다** — 두 층을 가른다. */
    router = () => ({ status: 200, finalUrl: U, body: page(`<meta property="og:brand" content="AW26">`) });
    expect((await factsFromProductUrl(U)).candidate?.facts?.brand).toBe("AW26");
    expect(resolveBrandIdentity("AW26").value).toBeNull();
  });
});
