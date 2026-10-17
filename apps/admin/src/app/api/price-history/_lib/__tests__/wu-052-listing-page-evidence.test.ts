import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractFromJsonLd } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-052 §1/§2 — **목록·검색 URL 을 기존 증거로 가를 수 있는가** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **새 URL 정규화기를 만들지 않는다**(CPO §2). 이 파일은 **아무것도 고치지 않고**
 *    「이미 페이지에서 읽히는 증거」가 상품/목록을 가를 수 있는지 **재기만** 한다.
 *
 * 🔴 fetch 를 자작하지 않는다 — 운영 `fetchPlainHtml` 을 쓴다.
 *    (메모 `smallable-market-is-shipping-destination` — 자작 fetch 는 헤더 초과로
 *     못 받는다. 그러면 「목록이라 못 읽었다」와 「내 fetch 가 틀렸다」가 섞인다.)
 *
 * 🔴 측정하는 것은 **둘** 이고 섞지 않는다(CPO §4):
 * ```
 * FALSE PRODUCT-PAGE   목록인데 상품으로 들어왔다   ← 줄이고 싶은 것
 * FALSE LISTING-PAGE   상품인데 목록으로 막혔다     ← **절대 늘리면 안 되는 것**
 * ```
 *
 * 실행: `WU_052_LIVE=1`  (기본 skip · 실제 HTTP · 읽기 전용 GET)
 */

const LIVE = process.env.WU_052_LIVE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/**
 * 🔴 **GT 는 사람이 정한다.** URL 패턴이 아니라 「그 주소가 한 상품의 상세 페이지인가」다.
 *
 * `LISTING` 4건은 WU-051 의 CPO 전달 URL 그대로(원본 보존 · `%%` 포함).
 * `PRODUCT` 4건은 이 트랙에서 **실측으로 상품 페이지임이 확인된** URL 이다
 * (WU-038 CONTROL · 가격까지 읽혔다).
 */
const CASES: { url: string; gt: "PRODUCT" | "LISTING"; note: string }[] = [
  // ── 목록/검색 (WU-051 6건 중 4건 · 나머지 2건은 같은 beaumonde 패턴) ──
  {
    url: "https://www.beaumonde.co.kr/goods/goods_list.php?cateCd=003&utm_source=chatgpt.com",
    gt: "LISTING",
    note: "카테고리 목록 — 🔴 WU-051 에서 PRODUCT_PAGE 로 들어왔다",
  },
  {
    url: "https://www.coupleshot.com/shop/shopbrand.html?type=X&xcode=011&utm_source=chatgpt.com",
    gt: "LISTING",
    note: "브랜드 목록 — 🔴 PRODUCT_SUFFIX(.html)에 걸려 들어왔다",
  },
  {
    url: "https://www.lfmall.co.kr/app/search/result/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88%2B%EC%A7%91%EC%97%85?utm_source=chatgpt.com",
    gt: "LISTING",
    note: "검색 결과 — 🟢 이미 LISTING_PAGE 로 막힌다",
  },
  {
    url: "https://www.lotteon.com/csearch/search/search?mallId=1&platform=pc&q=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%8826&render=search&utm_source=chatgpt.com",
    gt: "LISTING",
    note: "검색 결과 — 🟢 이미 LISTING_PAGE 로 막힌다",
  },
  // ── 🔴 실제 상품 CONTROL — 실수로 막으면 여기서 드러난다 ──
  {
    url: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
    gt: "PRODUCT",
    note: "Shopify 상품 — WU-038 에서 EUR 40 읽힘",
  },
  {
    url: "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue",
    gt: "PRODUCT",
    note: "국내 샵 상품 — WU-038 에서 USD 58 읽힘",
  },
  {
    url: "https://bobochoses.com/products/b226ac043-mystery-bc-half-zipped-sweatshirt",
    gt: "PRODUCT",
    note: "Shopify 상품 — WU-038 에서 EUR 75 읽힘",
  },
  {
    url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592",
    gt: "PRODUCT",
    note: "🔴 Cafe24 상품 — 식별자가 «쿼리» 에 있다(url-shape.ts:132 실측 근거)",
  },
  /**
   * 🔴🔴 **결정적 CONTROL.** WU-020 이 이 사이트를 실측해
   *    「`application/ld+json` **0개** · 가격은 **microdata** 에 있다」고 기록했다.
   *    ⟹ **JSON-LD 가 없는 «진짜» 상품 페이지** 다. 「JSON-LD Product 가 없으면 목록」
   *    이라는 규칙을 쓰면 **이 페이지가 FALSE LISTING-PAGE 로 막힌다.**
   *    🔴 이 한 건이 그 규칙의 채택 여부를 가른다.
   */
  {
    url: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Trattino_Polo/descpageMASGT-STMFTP.html",
    gt: "PRODUCT",
    note: "🔴🔴 microdata-only 상품 — JSON-LD 가 «없다»(WU-020 실측)",
  },
  /**
   * 🟢 과거에 같은 계열 결함이 있었고 고쳐진 URL — 회귀 확인용.
   *    url-shape.ts:69 가 「Cafe24 목록이 `/product/list.html?cate_no=110` 이라
   *    PRODUCT_PATH 에 걸렸다」고 적어 뒀고 `NON_PRODUCT_FILE` 이 그것을 막았다.
   */
  {
    url: "https://www.foretforet.com/product/list.html?cate_no=110",
    gt: "LISTING",
    note: "🟢 Cafe24 목록 — NON_PRODUCT_FILE 이 이미 막는다(회귀 확인)",
  },
];

/** 🔴 JSON-LD 의 `@type` «값» 을 센다 — 파싱이 아니라 관측이다(새 추출기 0). */
function jsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const t of (m[1] ?? "").matchAll(/"@type"\s*:\s*"([^"]+)"/g)) {
      if (t[1]) types.add(t[1]);
    }
  }
  return [...types];
}

function ogType(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

const maybe = LIVE ? it : it.skip;

describe("WU-052 §1/§2 — 상품/목록 판별 증거", () => {
  maybe(
    "기존 증거만으로 가를 수 있는지 전수 관측한다",
    async () => {
      const rows: Record<string, unknown>[] = [];

      for (const c of CASES) {
        const shape = classifyUrlShape(c.url);
        /** 🟢 shape 이 이미 막으면 HTTP 를 쓰지 않는다 — 운영과 같은 순서다. */
        let html: string | null = null;
        if (shape === "PRODUCT_PAGE") html = await fetchPlainHtml(c.url);

        const types = html ? jsonLdTypes(html) : [];
        const jsonLdProduct = html ? extractFromJsonLd(html) : null;
        rows.push({
          gt: c.gt,
          host: new URL(c.url).hostname.replace(/^(www|m)\./, ""),
          shape,
          httpUsed: html !== null,
          jsonLdTypes: types,
          /** 🔴 목록의 «양성» 증거 — 있으면 목록이다. 없다고 상품인 것은 아니다. */
          hasListingType: types.some((t) =>
            ["ItemList", "CollectionPage", "SearchResultsPage", "SearchAction"].includes(t),
          ),
          hasProductType: types.includes("Product"),
          ogType: html ? ogType(html) : null,
          /** 🔴 JSON-LD Product 추출 성공 여부 — 「가격」이 아니라 **Product 구조** 다. */
          /** 🔴 칸 이름을 **타입에서 읽었다** — `name` 이 아니라 `title` 이다
           *     (ExtractedProductData:28). 처음에 `name` 으로 읽어 8/8 을 N 으로
           *     잘못 관측했다 — 이 트랙 열 번째 같은 실수다. */
          jsonLdProductTitle: jsonLdProduct?.title ?? null,
          note: c.note,
        });
      }

      writeFileSync(path.join(OUT, "wu-052-evidence.json"), JSON.stringify(rows, null, 2));

      // eslint-disable-next-line no-console
      console.log("\n[WU-052] 증거 관측 (gt | host | shape | HTTP | ld@type | og:type | ldProduct)");
      for (const r of rows) {
        // eslint-disable-next-line no-console
        console.log(
          `  ${String(r.gt).padEnd(8)} ${String(r.host).padEnd(20)} ${String(r.shape).padEnd(13)} http=${r.httpUsed ? "Y" : "N"} ld=[${(r.jsonLdTypes as string[]).join(",") || "-"}] og=${r.ogType ?? "-"} ldProduct=${r.jsonLdProductTitle ? "Y" : "N"}`,
        );
      }

      /* ── 🔴 현재 분류기의 오류를 «수치로» 적는다 ───────────────────────── */
      const falseProductPage = rows.filter((r) => r.gt === "LISTING" && r.shape === "PRODUCT_PAGE");
      const falseListingPage = rows.filter((r) => r.gt === "PRODUCT" && r.shape !== "PRODUCT_PAGE");
      // eslint-disable-next-line no-console
      console.log(
        `\n[WU-052 현재 분류기] FALSE PRODUCT-PAGE ${falseProductPage.length}/5 · FALSE LISTING-PAGE ${falseListingPage.length}/5`,
      );

      /* ── 🔴 후보 규칙의 «반사실» — 양성 목록 증거를 썼다면? ──────────────── */
      const wouldBlock = rows.filter((r) => r.hasListingType && !r.hasProductType);
      // eslint-disable-next-line no-console
      console.log(
        `[WU-052 반사실] 「ld@type 에 목록형 있고 Product 없음」으로 막으면 — 차단 ${wouldBlock.length}건: ${wouldBlock.map((r) => `${r.gt}/${r.host}`).join(", ") || "없음"}`,
      );

      /** 🔴 단언은 **관측이 성립했는지** 까지만 — 기대값을 박으면 측정이 아니다. */
      expect(rows).toHaveLength(10);
      expect(rows.filter((r) => r.gt === "PRODUCT")).toHaveLength(5);
    },
    10 * 60_000,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * §1-b 🔴 기존 가드의 «적용 범위» — HTTP 0 · 순수 관측
 * ══════════════════════════════════════════════════════════════════════════ */

describe("§1-b 현재 분류기가 어디까지 막는가 (HTTP 0)", () => {
  /**
   * 🟢 `url-shape.ts:67-77` 은 「Cafe24 목록 `/product/list.html?cate_no=110` 이
   *    `PRODUCT_PATH` 에 걸려 HTTP 를 썼다」를 고친 기록이고, 해법으로
   *    `NON_PRODUCT_FILE` 을 **먼저** 보게 했다.
   *
   * 🔴 그런데 그 정규식은 `\.html?$` 로 끝난다 — **확장자가 `.html`/`.htm` 일 때만**
   *    적용된다. 그래서 **같은 모양의 `.php` 목록은 그 가드를 지나간다.**
   *    (이번 표본의 `beaumonde.co.kr/goods/goods_list.php` 가 그 경우다.)
   *
   * 🔴 **고치지 않았다** — 이름을 더 넣는 것은 CPO §「URL 문자열 패턴 차단 금지」에
   *    해당한다. 이 단언은 **현재 적용 범위를 사실로 고정** 할 뿐이다.
   */
  it.each([
    ["https://x.com/product/list.html?cate_no=110", "UNKNOWN_PAGE", "🟢 .html 목록은 막힌다"],
    ["https://x.com/product/list.php?cate_no=110", "PRODUCT_PAGE", "🔴 .php 는 같은 가드를 지나간다"],
    ["https://x.com/goods/goods_list.php?cateCd=003", "PRODUCT_PAGE", "🔴 이번 표본의 그 모양"],
    ["https://x.com/shop/shopbrand.html?xcode=011", "PRODUCT_PAGE", "🔴 .html 접미만으로 상품이 된다"],
    ["https://x.com/shop/shopdetail.html?branduid=1", "PRODUCT_PAGE", "🟢 진짜 상품도 같은 규칙으로 통과한다"],
  ])("%s → %s (%s)", (url, expected) => {
    expect(classifyUrlShape(url)).toBe(expected);
  });

  /**
   * 🔴🔴 **그래서 「이름을 더 넣자」가 위험한 이유가 한 줄로 보인다** —
   *    `shopbrand.html`(목록)과 `shopdetail.html`(상품)은 **같은 규칙으로 통과** 하고,
   *    둘을 가르는 것은 **파일명 어휘 지식** 이다. 그 지식은 샵마다 다르고 우리에게 없다.
   */
  it("🔴 목록과 상품이 «같은 분기» 로 통과한다 — 파일명 지식 없이는 못 가른다", () => {
    expect(classifyUrlShape("https://x.com/shop/shopbrand.html?xcode=011")).toBe(
      classifyUrlShape("https://x.com/shop/shopdetail.html?branduid=1"),
    );
  });
});
