import { describe, expect, it } from "vitest";
import { buildDiscoveryQuerySet } from "../query-planner";
import { classifyUrlShape } from "../../comparison-search/url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-01 — **Apify Search Provider PoC**(CPO 2026-10-27)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 코드에 연결하지 않는다.** 이 파일은 **PoC 하니스** 이고, 검증하는 것은
 *    Discovery 9축 중 **B(Search Execution) 하나** 다.
 *
 * ```
 * 검증 단위   상품 1개 + Query **1개** + Search **1회** = Candidate URL
 * 🔴 금지     Query 자동 확장 · 여러 Query 합산 · LLM 답변 · AI 재요약 · 운영 배선
 * ```
 *
 * 🔴 **Apify 는 판단 엔진이 아니다.** 여기서 받는 것은 **Discovery Signal(URL)** 뿐이고
 *    Evidence 는 기존 `factsFromProductUrl` → Evidence 단계가 만든다.
 *
 * 🔴 **새 URL 정제 규칙을 만들지 않는다** — 분류는 기존 owner `classifyUrlShape` 로만 한다.
 *
 * ── 과금(실측 · Apify API) ──────────────────────────────────────────────────
 * ```
 * actor `apify/google-search-scraper` · PAY_PER_EVENT
 *   primary event `search-page-scraped` = **$0.0045 / 검색결과 페이지**(FREE 티어)
 * 🟢 Gemini 와 달리 **1 쿼리 = 1 페이지** 로 과금 단위가 «우리가 통제하는 값» 이다
 *    (Gemini 는 1 호출이 내부에서 검색 쿼리를 여러 개 만들었다 — 실측 평균 5.5)
 * ```
 */

const LIVE = process.env.CORE_APIFY_POC_LIVE === "1";
const ACTOR = "apify~google-search-scraper";

/** 🔴 PoC 상한 — 1 쿼리 · 1 페이지. 늘리는 쪽은 **명시해야** 한다. */
const POC_CAPS = { maxPagesPerQuery: 1, resultsPerPage: 20 } as const;

/** 🟢 기존 GT 상품(B226AC010) — 새 상품을 만들지 않는다. */
const GT_PRODUCT = {
  brand: "Bobo Choses",
  productName: "Booty Ghosts T-shirt",
  productType: null,
  genderAge: null,
  color: null,
  size: null,
  season: null,
  productCode: "B226AC010",
  sourceUrl: "https://www.bobochoses.com/en-kr/products/b226ac010-booty-ghosts-t-shirt",
  sourceSite: "bobochoses.com",
  sourceCountry: null,
  market: null,
};

interface SearchItem {
  organicResults?: { url?: string; title?: string }[];
  searchQuery?: { term?: string };
}

describe.skipIf(!LIVE)("DISCOVERY-SEARCH-PROVIDER-01 — Apify Search PoC(라이브 · 1 호출)", () => {
  it(
    "Query Planner 질의 1개 → Apify Search 1회 → Candidate URL",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();

      /** 🔴 **새 Query 규칙을 만들지 않는다** — 기존 Query Planner 의 1순위를 그대로 쓴다. */
      const planned = buildDiscoveryQuerySet(GT_PRODUCT, { max: 1 });
      expect(planned).toHaveLength(1);
      const query = planned[0]!.text;
      console.log(`\n  🔵 실제 Query [${planned[0]!.axis}] ${query}`);

      const t0 = Date.now();
      const res = await fetch(
        `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queries: query,
            maxPagesPerQuery: POC_CAPS.maxPagesPerQuery,
            resultsPerPage: POC_CAPS.resultsPerPage,
            /** 🔴 AI Overview 는 **추가 과금** 이다 — 끈다(우리는 URL 만 필요하다). */
            saveHtml: false,
            saveHtmlToKeyValueStore: false,
          }),
        },
      );
      const elapsedMs = Date.now() - t0;
      const text = await res.text();
      console.log(`  HTTP ${res.status} · ${elapsedMs} ms`);
      if (!res.ok) {
        console.log(`  🔴 본문 ${text.slice(0, 400)}`);
      }
      expect(res.ok, `Apify HTTP ${res.status}`).toBe(true);

      const items = JSON.parse(text) as SearchItem[];
      const organic = items.flatMap((i) => i.organicResults ?? []);
      const rawUrls = organic.map((o) => o.url).filter((u): u is string => typeof u === "string");
      const unique = [...new Set(rawUrls)];
      const duplicates = rawUrls.length - unique.length;

      /** 🔴 분류는 **기존 owner** 로만 한다(새 규칙 0). */
      const byShape = new Map<string, string[]>();
      for (const u of unique) {
        const shape = String(classifyUrlShape(u));
        byShape.set(shape, [...(byShape.get(shape) ?? []), u]);
      }
      const productPages = byShape.get("PRODUCT_PAGE") ?? [];

      console.log(`\n${"═".repeat(96)}`);
      console.log("  [PoC] Apify Search 1회 결과 — 🔴 실제값만 적는다");
      console.log(`${"═".repeat(96)}`);
      console.log(`  dataset item ${items.length} · organic ${organic.length}`);
      console.log(`  URL ${rawUrls.length} · 고유 ${unique.length} · 중복 ${duplicates}`);
      console.log(`  🟢 상품 상세(PRODUCT_PAGE) **${productPages.length}**`);
      for (const [shape, list] of [...byShape.entries()].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`    ${shape.padEnd(18)} ${list.length}`);
      }
      console.log("\n  [상품 상세 URL 샘플]");
      for (const u of productPages.slice(0, 10)) console.log(`    ${u}`);
      console.log("\n  [그 외 URL 샘플]");
      for (const u of unique.filter((u) => !productPages.includes(u)).slice(0, 6)) console.log(`    ${u}`);
      console.log(`\n  💵 과금 — search-page-scraped × ${POC_CAPS.maxPagesPerQuery} = $${(0.0045 * POC_CAPS.maxPagesPerQuery).toFixed(4)} (FREE 티어 단가)`);

      /**
       * 🔴 PASS 조건은 **「검색이 실행됐고 URL 이 왔다」** 까지다.
       *    「동일상품을 찾았다」는 **이 단계의 주장이 아니다** — 그것은 Identity 의 일이다.
       */
      expect(organic.length).toBeGreaterThan(0);
      expect(unique.length).toBeGreaterThan(0);
    },
    10 * 60 * 1000,
  );
});
