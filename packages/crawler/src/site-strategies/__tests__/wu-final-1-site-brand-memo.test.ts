import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-FINAL-1 — **상점 brand 를 한 번만 받는다**(호스트 단위 기억)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「**429 완벽 해결 ❌ · retry 대수술 ❌ · cache 설계 ❌** ·
 * 추가 fetch 실패가 **전체 pipeline 을 죽이지 않게 최소화** · 확실한
 * structured/alias brand 는 그대로 활용 · **brand 불확정이면 보수적으로 보류**」.
 *
 * ── 왜 이 모양인가(WU-173 실측) ────────────────────────────────────────────
 * ```
 * brand 복구 **3/15 (20%)** · 실패 원인은 **분기 ④ 하나**(추가 HTML fetch 가 429)
 * 🔴 `fetchWithDomainRateLimit` 는 **이미** 429 재시도 1회 + `node:https` 폴백을 한다
 *    ⟹ 그 셋을 거쳐도 429 ⟹ **사이트가 거부한다**(우리 fetch 결함이 아니다)
 * 🟢 같은 실행에서 `products.json` 은 **항상** 성공하고 **HTML 만** 막힌다
 * 🟢 `og:site_name` == JSON-LD `Organization.name` 은 **상점 단위 상수** 다
 *    ⟹ 그 상점에서 **한 번만** 성공하면 된다
 * ```
 *
 * ── 🔴 이 파일이 지키는 불변식 여섯 ────────────────────────────────────────
 * ```
 * A 같은 호스트의 둘째 상품은 **추가 fetch 없이** brand 를 받는다
 * B 🔴 **음성 캐시 금지** — 실패를 기억해 영구 포기하지 않는다
 * C 🔴 **게이트 불변** — vendor 가 거부되지 않으면 추가 fetch **0**(기억도 안 만든다)
 * D 🔴 **brand 를 만들지 않는다** — HTML 도 없고 기억도 없으면 **빈 채로 둔다**(보수적 보류)
 * E 🔴 **호스트 격리** — 다른 상점의 값을 쓰지 않는다
 * F 🔴 **저장하지 않는다** — DB·디스크 쓰기 0 · 프로세스 수명만
 * ```
 */

const fetchPlainHtml = vi.fn<(url: string) => Promise<string | null>>();
const fetchShopifyProductJson = vi.fn();
const fetchShopifyProductJs = vi.fn();

vi.mock("../../shopify-product-json", () => ({
  extractShopifyHandle: (u: string) => (u.includes("/products/") ? "handle" : null),
  stripShopifyLocalePrefix: (u: string) => u,
  fetchPlainHtml: (u: string) => fetchPlainHtml(u),
  fetchShopifyProductJson: (...a: unknown[]) => fetchShopifyProductJson(...a),
  fetchShopifyProductJs: (...a: unknown[]) => fetchShopifyProductJs(...a),
}));

const { shopifySiteStrategy, __resetSiteBrandMemoForTests } = await import("../shopify.site-strategy");

/** 🟢 `og:site_name` 과 JSON-LD `Organization.name` 이 **같은** 실제 모양. */
const HTML_OK = `<html><head>
  <meta property="og:site_name" content="Bobo Choses">
  <script type="application/ld+json">{"@type":"Organization","name":"Bobo Choses"}</script>
</head><body></body></html>`;

/**
 * 🔴 `vendor` 가 **시즌코드** 라 브랜드 규칙이 거부하는 실제 모양(WU-134 실측).
 *
 * 🔴🔴 **`price.currency` 를 반드시 채운다.** 1차에 `{ price: 40, currency: "EUR" }`
 *    로 썼더니 `fillMissingCurrency`(:42 `!price || price.currency`)가 **같은
 *    `fetchPlainHtml` 을 먼저 불러서** 호출 수가 3이 됐고, 내 단언이 「기억이 안
 *    된다」로 읽혔다. 🟢 실제로는 **브랜드 fetch 는 1회였다** — 분모를 섞은 것이다.
 */
const resultWith = (vendor: string) => ({
  productData: { brand: vendor, name: "T-shirt", price: { amount: 40, currency: "EUR" } },
  sources: {},
});

beforeEach(() => {
  __resetSiteBrandMemoForTests();
  fetchPlainHtml.mockReset();
  fetchShopifyProductJson.mockReset();
  fetchShopifyProductJs.mockReset();
});

describe("WU-FINAL-1 A — 같은 상점은 한 번만 받는다", () => {
  it("A-1 🟢 둘째 상품은 추가 fetch 없이 brand 를 받는다", async () => {
    fetchShopifyProductJson.mockResolvedValue(resultWith("AW26"));
    fetchPlainHtml.mockResolvedValue(HTML_OK);

    const a = await shopifySiteStrategy.extract("https://bobochoses.com/products/b226ac009-x");
    const b = await shopifySiteStrategy.extract("https://bobochoses.com/products/b226ac010-y");

    expect(a?.productData.siteBrandName).toBe("Bobo Choses");
    expect(b?.productData.siteBrandName).toBe("Bobo Choses");
    expect(fetchPlainHtml, "🔴 상점 단위로 **한 번만** 받아야 한다").toHaveBeenCalledTimes(1);
  });

  it("A-2 🟢 `www.` 와 로케일 경로가 달라도 같은 상점으로 본다", async () => {
    fetchShopifyProductJson.mockResolvedValue(resultWith("AW26"));
    fetchPlainHtml.mockResolvedValue(HTML_OK);

    await shopifySiteStrategy.extract("https://www.bobochoses.com/products/a");
    const b = await shopifySiteStrategy.extract("https://bobochoses.com/ko-kr/products/b");

    expect(b?.productData.siteBrandName).toBe("Bobo Choses");
    expect(fetchPlainHtml).toHaveBeenCalledTimes(1);
  });
});

describe("WU-FINAL-1 B — 🔴 음성 캐시를 만들지 않는다", () => {
  /**
   * 🔴🔴 실패(429)를 기억하면 그 상점은 **프로세스가 사는 동안 영구히** 포기한다.
   *    WU-173 이 측정한 실패율이 80% 이므로 그 버그는 거의 항상 발화한다.
   */
  it("B-1 🔴 429(=null) 뒤에도 **다시 시도한다**", async () => {
    fetchShopifyProductJson.mockResolvedValue(resultWith("AW26"));
    fetchPlainHtml.mockResolvedValueOnce(null).mockResolvedValueOnce(HTML_OK);

    const a = await shopifySiteStrategy.extract("https://bobochoses.com/products/a");
    const b = await shopifySiteStrategy.extract("https://bobochoses.com/products/b");

    expect(a?.productData.siteBrandName, "🔴 실패한 회차는 비어 있어야 한다").toBeUndefined();
    expect(b?.productData.siteBrandName, "🟢 다음 회차는 복구된다").toBe("Bobo Choses");
    expect(fetchPlainHtml, "🔴 두 번 시도해야 한다(음성 캐시 금지)").toHaveBeenCalledTimes(2);
  });

  it("B-2 🔴 HTML 은 왔지만 두 자리가 **다르면** 기억하지 않는다", async () => {
    fetchShopifyProductJson.mockResolvedValue(resultWith("AW26"));
    const MISMATCH = `<html><head>
      <meta property="og:site_name" content="Some Shop">
      <script type="application/ld+json">{"@type":"Organization","name":"Other Name"}</script>
    </head></html>`;
    fetchPlainHtml.mockResolvedValue(MISMATCH);

    const a = await shopifySiteStrategy.extract("https://shop.example.com/products/a");
    await shopifySiteStrategy.extract("https://shop.example.com/products/b");

    expect(a?.productData.siteBrandName).toBeUndefined();
    expect(fetchPlainHtml).toHaveBeenCalledTimes(2);
  });
});

describe("WU-FINAL-1 C·D — 게이트와 보수적 보류는 불변", () => {
  it("C-1 🔴 vendor 가 **정상 브랜드** 면 추가 fetch 0 · 기억도 만들지 않는다", async () => {
    fetchShopifyProductJson.mockResolvedValue(resultWith("Bobo Choses"));
    fetchPlainHtml.mockResolvedValue(HTML_OK);

    const a = await shopifySiteStrategy.extract("https://bobochoses.com/products/a");
    expect(a?.productData.siteBrandName, "🔴 정상 브랜드면 손대지 않는다").toBeUndefined();
    expect(fetchPlainHtml, "🔴 추가 HTTP 0").toHaveBeenCalledTimes(0);
  });

  it("C-2 🔴 vendor 가 **비어 있으면** 보러 가지 않는다(「모르면 채우지 않는다」)", async () => {
    fetchShopifyProductJson.mockResolvedValue(resultWith(""));
    fetchPlainHtml.mockResolvedValue(HTML_OK);

    const a = await shopifySiteStrategy.extract("https://bobochoses.com/products/a");
    expect(a?.productData.siteBrandName).toBeUndefined();
    expect(fetchPlainHtml).toHaveBeenCalledTimes(0);
  });

  it("D-1 🔴 HTML 도 없고 기억도 없으면 **brand 를 만들지 않는다**(보수적 보류)", async () => {
    fetchShopifyProductJson.mockResolvedValue(resultWith("AW26"));
    fetchPlainHtml.mockResolvedValue(null);

    const a = await shopifySiteStrategy.extract("https://bobochoses.com/products/a");
    expect(a?.productData.siteBrandName, "🔴 도메인으로 브랜드를 만들지 않는다(WU-080)").toBeUndefined();
    expect(a?.productData.brand, "🟢 거부된 vendor 는 그대로 올라간다 — 판단은 canonical-product 가 한다").toBe("AW26");
  });
});

describe("WU-FINAL-1 E·F — 호스트 격리 · 저장 금지", () => {
  it("E-1 🔴 다른 상점의 값을 쓰지 않는다", async () => {
    fetchShopifyProductJson.mockResolvedValue(resultWith("AW26"));
    fetchPlainHtml.mockResolvedValueOnce(HTML_OK).mockResolvedValueOnce(null);

    const a = await shopifySiteStrategy.extract("https://bobochoses.com/products/a");
    const b = await shopifySiteStrategy.extract("https://other-shop.com/products/b");

    expect(a?.productData.siteBrandName).toBe("Bobo Choses");
    expect(b?.productData.siteBrandName, "🔴 다른 호스트로 새지 않는다").toBeUndefined();
  });

  it("F-1 🔴 저장 경로가 없다(소스 앵커)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const SRC = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shopify.site-strategy.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const banned of ["writeFile", "localStorage", "sessionStorage", "supabase", "prisma", "INSERT", "upsert"]) {
      expect(SRC, `🔴 "${banned}" 가 생겼다 — 이 기억은 프로세스 수명만이다`).not.toContain(banned);
    }
    /** 🔴 음성 캐시 금지 — 실패 경로에서 `set` 하면 FAIL 한다. */
    expect(SRC).toMatch(/if \(host\) SITE_BRAND_BY_HOST\.set\(host, site\.value\)/);
  });
});
