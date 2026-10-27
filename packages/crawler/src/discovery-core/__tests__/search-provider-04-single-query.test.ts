import { describe, expect, it } from "vitest";
import { classifyUrlShape } from "../../comparison-search/url-shape";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY-SEARCH-PROVIDER-04 — **Q2 vs Q3 · 단일 Query 최적화**(측정 only)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 배선을 하지 않는다.** Query Planner 운영 코드도 **건드리지 않는다**
 *    (`qs[0] === BRAND_CODE` 계약 포함). 질의는 **이 하니스 안에서만** 만든다.
 *
 * ── 🔴 이번에 답하는 질문은 «하나» 다 ──────────────────────────────────────
 * ```
 * Q2 와 Q3 중 **어느 하나를 단독** 으로 썼을 때
 * 상품당 Search **1회** 로 더 좋은 Candidate 를 얻는가?
 * 🔴 비용은 같다(각 1회) ⟹ 비교 기준은 **1회당 «품질»** 이다
 * ```
 *
 * 🔴 **SPRINT-03 과의 차이** — 그때는 Crawl/Evidence 를 **합산 집합에서만** 쟀다.
 *    이번에는 **Query 버킷별로** 끝까지 따라간다(그래야 단독 비교가 성립한다).
 *
 * 🔴 **organic 숫자를 Recall 로 쓰지 않는다**(CPO §8).
 */

const LIVE = process.env.CORE_APIFY_POC_LIVE === "1";
const ACTOR = "apify~google-search-scraper";
const USD_PER_SEARCH_PAGE = 0.0045;
/** 🔴 CPO §6 — **8회 상한**. 넘으면 STOP 하고 CPO 확인을 받는다. */
const MAX_SEARCHES = 8;

/** 🟢 SPRINT-03 과 **같은 상품** 이다(새 상품 0 · 비교 가능성 유지). */
const PRODUCTS = [
  { id: "S1", brand: "Bobo Choses", code: "B226AC010", design: "Booty Ghosts Long Sleeve" },
  { id: "S2", brand: "Bobo Choses", code: "B226AC009", design: "Hug Hairy Monster" },
  { id: "S4", brand: "Main Story", code: "AW26MS185", design: "Bubble Sweatshirt" },
  { id: "S3", brand: "Bobo Choses", code: "B126AI018", design: "Curious Turnip Swim Cap" },
] as const;

/**
 * 🔴 **Q3 에서 MODEL_CODE 를 빼지 않는다**(CPO §3) — 기존 `BRAND_DESIGN` 축은
 *    품번이 **빠져** 있어서 그대로 쓰면 안 된다. 여기서는 **Q2 + 디자인명** 이다.
 * 🔴 따옴표 없음 · 새 의미 추론 0(브랜드·품번·디자인명 전부 기존 값).
 */
const Q2 = (p: (typeof PRODUCTS)[number]) => `${p.brand} ${p.code}`;
const Q3 = (p: (typeof PRODUCTS)[number]) => `${p.brand} ${p.code} ${p.design}`;

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

interface Bucket {
  productId: string;
  label: "Q2" | "Q3";
  query: string;
  http: number;
  ms: number;
  organic: number;
  unique: string[];
  productUrls: string[];
  sellers: Set<string>;
  localeDup: number;
  /** 🔴 목록/검색/카테고리 등 **비상품** 으로 분류된 수(노이즈 축 1). */
  nonProduct: number;
}

interface CrawlResult {
  status: string;
  hasEvidence: boolean;
  /** 🔴 **「품번이 일치한다」는 관측** 이지 **동일상품 판정이 아니다**(Identity 는 MI 의 일이다). */
  codeMatches: boolean | null;
}

describe.skipIf(!LIVE)("DISCOVERY-SEARCH-PROVIDER-04 — Q2 vs Q3 단일 Query(라이브 · 8회)", () => {
  it(
    "같은 조건에서 Query 문자열만 바꿔 1회 Search 품질을 비교한다",
    async () => {
      const token = process.env.APIFY_API_TOKEN?.trim();
      expect(token, "APIFY_API_TOKEN 이 없다").toBeTruthy();

      const buckets: Bucket[] = [];
      let searches = 0;

      for (const p of PRODUCTS) {
        for (const [label, text] of [
          ["Q2", Q2(p)],
          ["Q3", Q3(p)],
        ] as const) {
          /** 🔴 상한을 **넘기지 않는다** — 넘으면 호출하지 않고 멈춘다. */
          if (searches >= MAX_SEARCHES) {
            console.log(`  🔴 STOP — Search 상한 ${MAX_SEARCHES} 도달`);
            break;
          }
          const t0 = Date.now();
          let organic: string[] = [];
          let http = 0;
          try {
            const res = await fetch(
              `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token!)}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                /** 🔴 **설정은 Q2/Q3 가 동일하다** — 차이는 `queries` 문자열뿐(CPO §7). */
                body: JSON.stringify({
                  queries: text,
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
          buckets.push({
            productId: p.id,
            label,
            query: text,
            http,
            ms: Date.now() - t0,
            organic: organic.length,
            unique,
            productUrls,
            sellers,
            localeDup: productUrls.length - sellers.size,
            nonProduct: unique.length - productUrls.length,
          });
        }
      }

      /* ── Crawl/Evidence: 🟢 합집합을 **한 번만** 받아 캐시하고 버킷에 귀속 ── */
      const allUrls = [...new Set(buckets.flatMap((b) => b.productUrls))];
      const crawl = new Map<string, CrawlResult>();
      for (const u of allUrls) {
        let r: CrawlResult = { status: "THREW", hasEvidence: false, codeMatches: null };
        try {
          const out = (await factsFromProductUrl(u)) as unknown as Record<string, unknown>;
          const facts = (out.candidate as Record<string, unknown> | undefined)?.facts as
            | { brand?: string | null; brandModelCode?: string | null; description?: string | null; title?: string }
            | undefined;
          const codes = PRODUCTS.map((p) => p.code.toUpperCase());
          const hay = `${facts?.brandModelCode ?? ""} ${facts?.title ?? ""} ${u}`.toUpperCase();
          r = {
            status: String(out.status ?? "?"),
            hasEvidence: Boolean(facts && (facts.brand || facts.brandModelCode || facts.description)),
            /** 🔴 **관측** 이다 — 품번 문자열이 보이는가. 동일상품이라고 말하지 않는다. */
            codeMatches: facts ? codes.some((c) => hay.includes(c)) : null,
          };
        } catch {
          /* keep THREW */
        }
        crawl.set(u, r);
      }

      /* ── [1] 상품 × Query ── */
      console.log(`\n${"═".repeat(116)}`);
      console.log("  [1] 상품 × Query — 🔴 organic 을 Recall 로 쓰지 않는다");
      console.log(`${"═".repeat(116)}`);
      console.log(
        `  ${pad("상품", 6)}${pad("Q", 4)}${pad("HTTP", 6)}${pad("organic", 9)}${pad("unique", 8)}${pad("상품URL", 9)}${pad("판매처", 8)}${pad("Crawl", 7)}${pad("Evid", 6)}품번관측`,
      );
      for (const b of buckets) {
        const cr = b.productUrls.map((u) => crawl.get(u)!);
        console.log(
          `  ${pad(b.productId, 6)}${pad(b.label, 4)}${pad(String(b.http), 6)}` +
            `${padL(String(b.organic), 7)}  ${padL(String(b.unique.length), 6)}  ${padL(String(b.productUrls.length), 7)}  ` +
            `${padL(String(b.sellers.size), 6)}  ${padL(String(cr.filter((c) => c.status === "OK").length), 5)}  ` +
            `${padL(String(cr.filter((c) => c.hasEvidence).length), 4)}  ${padL(String(cr.filter((c) => c.codeMatches).length), 6)}`,
        );
      }

      /* ── [2] Query 총계 ── */
      console.log(`\n${"═".repeat(116)}`);
      console.log("  [2] Query 총계 — 🔴 실질 후보 → Crawl → Evidence 순으로 본다");
      console.log(`${"═".repeat(116)}`);
      for (const label of ["Q2", "Q3"] as const) {
        const bs = buckets.filter((b) => b.label === label);
        const urls = [...new Set(bs.flatMap((b) => b.productUrls))];
        const sellers = new Set(bs.flatMap((b) => [...b.sellers]));
        const cr = urls.map((u) => crawl.get(u)!);
        console.log(
          `  ${label}  상품URL ${padL(String(urls.length), 3)} · **판매처 ${padL(String(sellers.size), 3)}** · ` +
            `Crawl ${padL(String(cr.filter((c) => c.status === "OK").length), 3)} · ` +
            `Evidence ${padL(String(cr.filter((c) => c.hasEvidence).length), 3)} · ` +
            `품번관측 ${padL(String(cr.filter((c) => c.codeMatches).length), 3)} · ` +
            `로케일중복 ${padL(String(bs.reduce((a, b) => a + b.localeDup, 0)), 3)} · ` +
            `비상품 ${padL(String(bs.reduce((a, b) => a + b.nonProduct, 0)), 3)}`,
        );
        /**
         * 🔴🔴 **CPO §9 의 1순위 지표** — 「Evidence 를 실제로 내는 **서로 다른 판매처**」.
         *    이것이 없으면 로케일 중복이 많은 Query 가 Crawl/Evidence «개수» 로 이긴다
         *    (실측: S2/Q2 는 상품URL 9 가 **판매처 1곳**(bobochoses 로케일)이었다).
         */
        const evidenceSellers = new Set(
          urls.filter((u) => crawl.get(u)?.hasEvidence).map(hostOf),
        );
        console.log(`      🟢 **Evidence 를 내는 판매처 ${evidenceSellers.size}곳** — ${[...evidenceSellers].join(" · ")}`);
        console.log(`      전체 판매처: ${[...sellers].join(" · ")}`);
        /** 🔴 상품별 **0 건** 이 있는지 — 단독 사용의 치명적 약점이다. */
        const zero = bs.filter((b) => b.productUrls.length === 0).map((b) => b.productId);
        console.log(`      🔴 상품URL 0 인 상품: ${zero.length ? zero.join(" · ") : "없음"}`);
      }

      console.log(`\n${"═".repeat(116)}`);
      console.log(
        `  💵 Search **${searches}회** · 추정 $${(searches * USD_PER_SEARCH_PAGE).toFixed(4)} · 🔴 실제 청구는 Billing 이 ground truth`,
      );
      console.log("  🔴 Google 결과는 **비결정적** 이다(SPRINT-03 에서 같은 질의가 두 번 다른 값을 냈다)");
      console.log("     ⟹ 이 표는 **1회 관측** 이고 단일 측정으로 Recall 을 확정하지 않는다");

      expect(searches).toBeLessThanOrEqual(MAX_SEARCHES);
      expect(buckets.every((b) => b.http === 201 || b.http === 200)).toBe(true);
    },
    40 * 60 * 1000,
  );
});
