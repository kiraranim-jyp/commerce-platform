import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-053 §1/§5 — **Microdata Product 증거를 안전하게 쓸 수 있는가** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **WU-020 보류 사유를 먼저 확정했다** — 기존
 *    `extractFromMicrodata(page: Page)`(product-data-extractor.ts:476)는
 *    `page.evaluate()` 를 쓴다 ⟹ **Playwright 의존**. transient 후보 경로는
 *    `fetchPlainHtml` 로 받은 **HTML 문자열** 뿐이라 그 함수를 부를 수 없다.
 *    🟢 그래서 보류는 「microdata 가 쓸모없다」가 아니라 **「호출 수단이 없다」** 였다.
 *
 * 🔴🔴 그리고 이 WU 의 **진짜 안전 질문은 다른 것** 이다:
 * ```
 * 목록 페이지는 각 상품을 microdata 로 마킹한다(ItemList 안의 Product).
 * ⟹ 첫 `[itemprop="name"]` 을 읽으면 **목록의 첫 상품** 이 상품 증거가 된다.
 * ⟹ 「microdata 를 읽는다」가 그대로 **FALSE PRODUCT 증거 생성** 이 될 수 있다.
 * ```
 * 🔴 그래서 **구현 전에 목록 페이지의 microdata 유무를 먼저 센다.**
 *
 * 실행: `WU_053_LIVE=1`  (기본 skip · 실제 HTTP · 읽기 전용 GET)
 */

const LIVE = process.env.WU_053_LIVE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/** 🔴 CONTROL 여섯 유형(CPO §2)을 전부 덮는다. tennis-warehouse 는 필수다. */
const CASES: { url: string; gt: "PRODUCT" | "LISTING"; kind: string }[] = [
  { url: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt", gt: "PRODUCT", kind: "JSON-LD 상품" },
  { url: "https://bobochoses.com/products/b226ac043-mystery-bc-half-zipped-sweatshirt", gt: "PRODUCT", kind: "JSON-LD 상품" },
  { url: "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue", gt: "PRODUCT", kind: "JSON-LD 상품(국내)" },
  { url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", gt: "PRODUCT", kind: "JSON-LD 상품(Cafe24)" },
  {
    url: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Trattino_Polo/descpageMASGT-STMFTP.html",
    gt: "PRODUCT",
    kind: "🔴🔴 **microdata-only 상품** (필수 CONTROL)",
  },
  {
    url: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Magro_Long_Sleeve/descpageMASGT-STMMLS.html",
    gt: "PRODUCT",
    kind: "🔴 microdata-only 상품 — WU-020/P2-2 가 실측한 그 URL",
  },
  { url: "https://www.beaumonde.co.kr/goods/goods_list.php?cateCd=003", gt: "LISTING", kind: "🔴 카테고리 목록(PRODUCT_PAGE 로 들어온다)" },
  { url: "https://www.coupleshot.com/shop/shopbrand.html?type=X&xcode=011", gt: "LISTING", kind: "🔴 브랜드 목록(PRODUCT_PAGE 로 들어온다)" },
];

/**
 * 🔴 **파서를 만들지 않는다 — «센다».** 구현 가능성 판단에 필요한 것은
 *    「무엇이 몇 개 있는가」이고, 값을 뽑는 것은 구현 단계의 일이다.
 */
function microdataCensus(html: string) {
  const itemtypes = [...html.matchAll(/itemtype\s*=\s*["']([^"']+)["']/gi)].map((m) =>
    (m[1] ?? "").replace(/^https?:\/\/schema\.org\//i, ""),
  );
  const count = (prop: string) =>
    [...html.matchAll(new RegExp(`itemprop\\s*=\\s*["']${prop}["']`, "gi"))].length;
  return {
    itemtypes: [...new Set(itemtypes)],
    /** 🔴 Product scope 가 **몇 개** 인가 — 2개 이상이면 목록 성격이다. */
    productScopes: itemtypes.filter((t) => /^Product$/i.test(t)).length,
    listingScopes: itemtypes.filter((t) => /^(ItemList|CollectionPage|SearchResultsPage|BreadcrumbList)$/i.test(t))
      .length,
    name: count("name"),
    sku: count("sku"),
    price: count("price"),
    priceCurrency: count("priceCurrency"),
    brand: count("brand"),
    description: count("description"),
    offers: count("offers"),
  };
}

const maybe = LIVE ? it : it.skip;

describe("WU-053 §1 — microdata 증거 전수 관측", () => {
  maybe(
    "상품/목록 양쪽의 microdata 를 세어 안전한 규칙이 있는지 본다",
    async () => {
      const rows: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const shape = classifyUrlShape(c.url);
        const html = shape === "PRODUCT_PAGE" ? await fetchPlainHtml(c.url) : null;
        const hasJsonLdProduct = html ? /"@type"\s*:\s*"Product"/i.test(html) : false;
        rows.push({
          gt: c.gt,
          host: new URL(c.url).hostname.replace(/^(www|m)\./, ""),
          shape,
          fetched: html !== null,
          hasJsonLdProduct,
          micro: html ? microdataCensus(html) : null,
          kind: c.kind,
        });
      }

      writeFileSync(path.join(OUT, "wu-053-microdata.json"), JSON.stringify(rows, null, 2));

      // eslint-disable-next-line no-console
      console.log("\n[WU-053] gt | host | ldProduct | Product scope | 목록 scope | name/sku/price/cur/brand/offers");
      for (const r of rows) {
        const m = r.micro as ReturnType<typeof microdataCensus> | null;
        // eslint-disable-next-line no-console
        console.log(
          `  ${String(r.gt).padEnd(8)} ${String(r.host).padEnd(22)} ld=${r.hasJsonLdProduct ? "Y" : "N"} ` +
            (m
              ? `Pscope=${m.productScopes} Lscope=${m.listingScopes} ` +
                `n/s/p/c/b/o=${m.name}/${m.sku}/${m.price}/${m.priceCurrency}/${m.brand}/${m.offers} types=[${m.itemtypes.slice(0, 6).join(",")}]`
              : "(fetch 없음)"),
        );
      }

      /* ── 🔴 후보 규칙의 반사실 — 「Product scope 가 «정확히 1개» 일 때만 읽는다」 ── */
      const rule = (r: Record<string, unknown>) => {
        const m = r.micro as ReturnType<typeof microdataCensus> | null;
        return !!m && m.productScopes === 1 && m.price > 0;
      };
      const wouldRead = rows.filter(rule);
      const falseProductEvidence = wouldRead.filter((r) => r.gt === "LISTING");
      const rescued = wouldRead.filter((r) => r.gt === "PRODUCT" && !r.hasJsonLdProduct);
      // eslint-disable-next-line no-console
      console.log(
        `\n[WU-053 반사실] 「Product scope == 1 && price 있음」 으로 읽으면 —\n` +
          `   읽는 페이지 ${wouldRead.length}건 · 🔴 목록 오인 ${falseProductEvidence.length}건 · ` +
          `🟢 JSON-LD 없는 상품 구제 ${rescued.length}건 (${rescued.map((r) => r.host).join(",") || "없음"})`,
      );

      expect(rows).toHaveLength(8);
      expect(rows.filter((r) => r.gt === "PRODUCT")).toHaveLength(6);
    },
    10 * 60_000,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * §1-b 🔴 WU-020 보류 사유를 «소스로» 고정한다 (HTTP 0)
 * ══════════════════════════════════════════════════════════════════════════ */

describe("§1-b 기존 microdata 추출기의 호출 조건", () => {
  const repoRoot = (() => {
    let dir = __dirname;
    for (let i = 0; i < 12; i++) {
      if (existsSync(path.join(dir, "packages", "crawler", "package.json"))) return dir;
      dir = path.dirname(dir);
    }
    throw new Error("repo 루트를 찾지 못했다");
  })();

  /**
   * 🔴 WU-020 이 microdata 를 보류한 사유를 **소스로** 고정한다 —
   *    「가치가 없다」가 아니라 **「HTML 문자열 경로에서 부를 수 없다」** 였다.
   */
  it("🔴 Playwright `Page` 를 요구한다 — HTML 문자열 경로에서 부를 수 없다", () => {
    const src = readFileSync(path.join(repoRoot, "packages/crawler/src/product-data-extractor.ts"), "utf8");
    const signature = "async function extractFromMicrodata(page: Page)";
    expect(src).toContain(signature);
    /** 🔴 그 안에서 DOM 을 쓴다 — 그래서 문자열로는 재사용이 불가능하다. */
    expect(src.slice(src.indexOf(signature), src.indexOf(signature) + 400)).toContain("page.evaluate(");
  });
});
