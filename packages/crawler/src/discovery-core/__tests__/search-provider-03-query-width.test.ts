import { describe, expect, it } from "vitest";
import { buildDiscoveryQuerySet } from "../query-planner";
import { classifyUrlShape } from "../../comparison-search/url-shape";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-03 — **Query 폭 × Apify Search Recall**(측정 only)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 Query Planner 를 바꾸지 않는다.** `buildDiscoveryQuerySet` 의 산출을
 *    **그대로 받아** Q1 로 쓰고, Q2/Q3 는 **이 하니스 안에서만** 만든다.
 *    채택 여부는 **CPO 가** 결정한다(§13).
 *
 * ── 🔴 Q2 · Q3 를 «새 의미 추론» 으로 만들지 않는다 ─────────────────────────
 * ```
 * Q1  운영 1순위 그대로            `"BRAND" "CODE"`      (따옴표 있음 · 정밀)
 * Q2  Q1 에서 **따옴표만 제거**     `BRAND CODE`          (완화 · 새 토큰 0)
 * Q3  Q2 + **디자인명**            `BRAND CODE DESIGN`
 *     🔴 DESIGN 은 Planner 의 **`BRAND_DESIGN` 축 산출에서** 가져온다
 *        (= 기존 denylist 가 색상·사이즈·시즌·마케팅을 이미 걷어낸 토큰) ⟹ **새 규칙 0**
 * ```
 *
 * 🔴🔴 **Search Recall 과 Crawl/Evidence 를 섞지 않는다**(CPO §10):
 * ```
 * Apify 가 상품 URL 을 찾았는데 우리 Crawl 이 JSON-LD 를 못 읽었다
 *   ⟹ 🔴 「Search 실패」가 **아니다**. 「Search PASS · Crawl/Evidence 제한」이다.
 * ```
 */

const LIVE = process.env.CORE_APIFY_POC_LIVE === "1";
const ACTOR = "apify~google-search-scraper";
/** 🔴 과금 단가(FREE 티어 · Apify API 에서 직접 조회한 값). 실제 청구는 Billing 이 ground truth. */
const USD_PER_SEARCH_PAGE = 0.0045;

/** 🟢 기존 GT 원상품 — 새 상품을 만들지 않았다(`wu-059-gt-facts.json` 의 canonicalProduct). */
const PRODUCTS = [
  { id: "S1", brand: "Bobo Choses", code: "B226AC010", name: "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses" },
  { id: "S2", brand: "Bobo Choses", code: "B226AC009", name: "Hug Hairy Monster T-Shirt by Bobo Choses" },
  { id: "S4", brand: "Main Story", code: "AW26MS185", name: "Bubble Sweatshirt in Grey Melange by Main Story" },
  { id: "S3", brand: "Bobo Choses", code: "B126AI018", name: "Curious Turnip All Over Swim Cap by Bobo Choses" },
] as const;

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "?";
  }
};

interface SearchItem {
  organicResults?: { url?: string }[];
}

interface Row {
  productId: string;
  label: "Q1" | "Q2" | "Q3";
  query: string;
  ms: number;
  organic: number;
  unique: number;
  productUrls: string[];
  sellers: Set<string>;
  /** 🔴 같은 판매처의 **같은 상품 다른 로케일** 은 따로 센다(CPO §11). */
  localeDup: number;
  http: number;
}

/**
 * 🔴 Q1/Q2/Q3 를 **같은 재료** 로 만든다. Q1 은 운영 Planner 산출을 **그대로** 쓴다.
 */
function buildQueries(p: (typeof PRODUCTS)[number]): { label: "Q1" | "Q2" | "Q3"; text: string }[] {
  const identity = {
    brand: p.brand,
    productName: p.name,
    productType: null,
    genderAge: null,
    color: null,
    size: null,
    season: null,
    productCode: p.code,
    sourceUrl: "https://example.test/x",
    sourceSite: null,
    sourceCountry: null,
    market: null,
  };
  const set = buildDiscoveryQuerySet(identity, { max: 8 });
  const q1 = set.find((q) => q.axis === "BRAND_CODE")?.text ?? `"${p.brand}" "${p.code}"`;
  /** 🔴 **따옴표만** 뗀다 — 토큰을 더하거나 바꾸지 않는다. */
  const q2 = q1.replace(/"/g, "").replace(/\s+/g, " ").trim();
  /** 🟢 디자인명은 Planner 의 BRAND_DESIGN 축 산출에서 가져온다(새 추출 0). */
  const designAxis = set.find((q) => q.axis === "BRAND_DESIGN")?.text ?? "";
  const design = designAxis
    .replace(/"/g, "")
    .replace(new RegExp(p.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), "")
    .replace(/\s+/g, " ")
    .trim();
  const q3 = design ? `${q2} ${design}` : q2;
  return [
    { label: "Q1", text: q1 },
    { label: "Q2", text: q2 },
    { label: "Q3", text: q3 },
  ];
}

describe.skipIf(!LIVE)("DISCOVERY-SEARCH-PROVIDER-03 — Query 폭 실험(라이브)", () => {
  it(
    "Q1 · Q2 · Q3 를 상품별로 1회씩 — 판매처/상품URL Recall 을 비교한다",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();

      const rows: Row[] = [];
      let searches = 0;

      for (const p of PRODUCTS) {
        for (const q of buildQueries(p)) {
          const t0 = Date.now();
          let organic: string[] = [];
          let http = 0;
          try {
            const res = await fetch(
              `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  queries: q.text,
                  maxPagesPerQuery: 1,
                  resultsPerPage: 20,
                  saveHtml: false,
                  saveHtmlToKeyValueStore: false,
                }),
              },
            );
            http = res.status;
            searches += 1;
            if (res.ok) {
              const items = (await res.json()) as SearchItem[];
              organic = items
                .flatMap((i) => i.organicResults ?? [])
                .map((o) => o.url)
                .filter((u): u is string => typeof u === "string");
            }
          } catch {
            http = -1;
          }
          const unique = [...new Set(organic)];
          const productUrls = unique.filter((u) => String(classifyUrlShape(u)) === "PRODUCT_PAGE");
          const sellers = new Set(productUrls.map(hostOf));
          /** 🔴 로케일 중복 = 같은 판매처가 상품 URL 을 **여러 개** 낸 만큼. */
          const localeDup = productUrls.length - sellers.size;
          rows.push({
            productId: p.id,
            label: q.label,
            query: q.text,
            ms: Date.now() - t0,
            organic: organic.length,
            unique: unique.length,
            productUrls,
            sellers,
            localeDup,
            http,
          });
        }
      }

      /* ── 표 ── */
      console.log(`\n${"═".repeat(118)}`);
      console.log("  [1] 상품 × Query — 🔴 Search Recall 만 본다(Crawl 은 아래 따로)");
      console.log(`${"═".repeat(118)}`);
      console.log(
        `  ${pad("상품", 6)}${pad("Q", 4)}${pad("HTTP", 6)}${pad("ms", 7)}${pad("organic", 9)}${pad("unique", 8)}${pad("상품URL", 9)}${pad("판매처", 8)}로케일중복`,
      );
      for (const r of rows) {
        console.log(
          `  ${pad(r.productId, 6)}${pad(r.label, 4)}${pad(String(r.http), 6)}${padL(String(r.ms), 6)} ${padL(String(r.organic), 8)}${padL(String(r.unique), 8)}${padL(String(r.productUrls.length), 9)}${padL(String(r.sellers.size), 8)}${padL(String(r.localeDup), 10)}`,
        );
      }

      /* ── Query 별 합계 ── */
      console.log(`\n${"═".repeat(118)}`);
      console.log("  [2] Query 별 합계 — 🔴 숫자 하나로 고르지 않는다");
      console.log(`${"═".repeat(118)}`);
      for (const label of ["Q1", "Q2", "Q3"] as const) {
        const rs = rows.filter((r) => r.label === label);
        const sellers = new Set(rs.flatMap((r) => [...r.sellers]));
        const urls = new Set(rs.flatMap((r) => r.productUrls));
        console.log(
          `  ${label}  organic ${padL(String(rs.reduce((a, r) => a + r.organic, 0)), 4)}` +
            ` · 상품URL ${padL(String(urls.size), 3)}` +
            ` · **판매처 ${padL(String(sellers.size), 3)}**` +
            ` · 로케일중복 ${padL(String(rs.reduce((a, r) => a + r.localeDup, 0)), 3)}` +
            `   예: ${[...sellers].slice(0, 5).join(" · ")}`,
        );
        console.log(`      질의 예 — ${rs[0]?.query ?? ""}`);
      }

      /* ── 합산(dedupe) ── */
      const allUrls = new Set(rows.flatMap((r) => r.productUrls));
      const allSellers = new Set(rows.flatMap((r) => [...r.sellers]));
      console.log(`\n  🟢 **중복 제거 후** — 상품URL ${allUrls.size} · 판매처 ${allSellers.size}`);

      /* ── Crawl / Evidence (🔴 Search 와 갈라서) ── */
      console.log(`\n${"═".repeat(118)}`);
      console.log("  [3] Crawl / Evidence — 🔴 여기 실패는 «Search 실패가 아니다»");
      console.log(`${"═".repeat(118)}`);
      let crawlOk = 0;
      let evidenceOk = 0;
      for (const u of allUrls) {
        const r = (await factsFromProductUrl(u)) as unknown as Record<string, unknown>;
        const status = String(r.status ?? "?");
        const facts = (r.candidate as Record<string, unknown> | undefined)?.facts as
          | { brand?: unknown; brandModelCode?: unknown; description?: unknown }
          | undefined;
        if (status === "OK") crawlOk += 1;
        const hasEvidence = Boolean(facts && (facts.brand || facts.brandModelCode || facts.description));
        if (hasEvidence) evidenceOk += 1;
        console.log(`  ${pad(status, 18)}${hasEvidence ? "evidence 🟢" : "evidence ·"}   ${hostOf(u)}  ${u.slice(0, 64)}`);
      }
      console.log(`\n  Crawl OK **${crawlOk}/${allUrls.size}** · Evidence **${evidenceOk}/${allUrls.size}**`);

      /* ── 비용 ── */
      console.log(`\n${"═".repeat(118)}`);
      console.log(
        `  💵 검색 **${searches}회** · 추정 $${(searches * USD_PER_SEARCH_PAGE).toFixed(4)} ` +
          `(= ${searches} × $${USD_PER_SEARCH_PAGE}) · 상품당 $${((searches * USD_PER_SEARCH_PAGE) / PRODUCTS.length).toFixed(4)}`,
      );
      console.log("  🔴 추정치다 — 실제 청구는 Apify Billing 이 ground truth 다");

      expect(searches).toBeGreaterThan(0);
      expect(rows.every((r) => r.http === 201 || r.http === 200)).toBe(true);
    },
    30 * 60 * 1000,
  );
});
