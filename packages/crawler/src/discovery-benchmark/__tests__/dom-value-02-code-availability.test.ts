/**
 * ════════════════════════════════════════════════════════════════════════════
 * 국내 SAME Coverage 사업가치 WU — Phase 2: 해외 품번 가용성 (§5 · §7 · §8)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다.
 * 🔴 **robots 가 막지 않은 샵만** 본다(Phase 1 결과). 우회하지 않는다.
 * 🔴 어댑터를 «만들지 않는다» — 조사일 뿐이다(§17 금지: MANUAL→AUTO 일괄 전환).
 *
 * ── 이 파일이 답하는 질문 (§5) ─────────────────────────────────────────────
 *   「국내 판매처가 실제 **해외 브랜드 품번** 을 표시하는가?」
 *   단순 문자열 존재가 아니라 **어디에** 적는지 자리별로 가른다 —
 *     상품명 · URL · 설명 · 옵션 · structured data · metadata
 *
 * ── 🔴 반드시 구분한다 (§5) ────────────────────────────────────────────────
 *     해외 브랜드 모델코드  ≠  국내 판매처 자체 SKU  ≠  내부 상품번호  ≠  옵션번호
 *   그래서 **해외에서 이미 확정된 코드 문자열** 을 넣고 그것이 나오는지만 본다
 *   (`confirmBrandCodeInTitle` 과 같은 원칙 — 국내에서 코드를 «추측하지» 않는다).
 *   🔴 자체 코드가 있다는 사실은 «따로» 센다. 그걸 「코드가 있다」로 집계하지 않는다.
 *
 * ── Phase 1 이 좁힌 조사 대상 ──────────────────────────────────────────────
 *   등록부 34 — robots NOT_DISALLOWED 19 · DISALLOWED 12 · UNKNOWN 3
 *   🟢 비-AUTO + source_type=RETAILER + robots 통과 = **4개**
 *        chouchouenfant.kr · coconjennie.com · karymarket.com · nokimore.com
 *   🔴 나머지는 판매처가 아니다 — MARKETPLACE 5 · VERTICAL 1 · GLOBAL 1
 *   🟢 AUTO_SCRAPE 7 은 전부 DOMESTIC/RETAILER (§6 재평가 대상)
 *
 * ── 🔴 자동화 비용의 직접 지표 (§7-C) ──────────────────────────────────────
 *   `comparison-search/` 에 **공유 플랫폼 헬퍼가 없다** — 샵마다 전용 파일 하나다
 *   (chocoel.ts · looxloo.ts · rulii.ts · deuxbebe.ts · littleluna.ts ·
 *    foretforet.ts · skysport.ts). 즉 **샵 1개 추가 = 어댑터 1개 작성** 이다.
 *   🟢 단 플랫폼이 같으면 그 비용이 줄 수 있으므로 플랫폼을 같이 감지한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchHtmlDirect } from "../../utils/direct-html-fetch";
import { checkRobots } from "../../utils/robots-gate";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

/** 🔴 Phase 1 에서 robots 통과 + RETAILER 로 확인된 비-AUTO 샵만. 임의로 늘리지 않는다. */
const INVESTIGATE = [
  { domain: "chouchouenfant.kr", base: "https://chouchouenfant.kr" },
  { domain: "coconjennie.com", base: "https://coconjennie.com" },
  { domain: "karymarket.com", base: "https://karymarket.com" },
  { domain: "nokimore.com", base: "https://nokimore.com" },
];

/**
 * 🔴 우리 497 상품에서 실제로 쓰이는 브랜드 + 그 브랜드의 «해외에서 확정된» 품번.
 *    선행 WU 실측에서 나온 값만 쓴다 — 코드를 지어내지 않는다.
 */
const PROBES = [
  { brand: "Bobo Choses", korean: "보보쇼즈", code: "B226AC035" },
  { brand: "PèPè", korean: "페페", code: "PP24KASHE1195NER" },
  { brand: "Main Story", korean: "메인스토리", code: "AW26MS185" },
];

/** 플랫폼별 «표준» 검색 경로. 🔴 샵마다 경로를 지어내지 않고 플랫폼 규약만 쓴다. */
const SEARCH_PATHS: Record<string, (q: string) => string> = {
  CAFE24: (q) => `/product/search.html?keyword=${encodeURIComponent(q)}`,
  SHOPIFY: (q) => `/search?q=${encodeURIComponent(q)}`,
  IMWEB: (q) => `/search?q=${encodeURIComponent(q)}`,
  GODO: (q) => `/goods/goods_search.php?keyword=${encodeURIComponent(q)}`,
};

/** 🔴 홈페이지 HTML 에서 플랫폼을 «관찰» 한다. 추측이면 UNKNOWN 으로 둔다. */
function detectPlatform(html: string): string {
  const h = html.toLowerCase();
  if (h.includes("cafe24") || h.includes("ec-base") || h.includes("/product/search.html")) return "CAFE24";
  if (h.includes("cdn.shopify.com") || h.includes("shopify-features")) return "SHOPIFY";
  if (h.includes("imweb") || h.includes("sizlcdn")) return "IMWEB";
  if (h.includes("godomall") || h.includes("goods_search.php")) return "GODO";
  if (h.includes("nhn-commerce") || h.includes("makeshop")) return "MAKESHOP";
  return "UNKNOWN";
}

/** 🔴 §5 가 요구한 «자리별» 스캔. 한 덩어리로 긁어서 「있다」고 하지 않는다. */
function scanCodePlaces(html: string, url: string, code: string) {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const needle = norm(code);
  const pick = (re: RegExp) => {
    const out: string[] = [];
    for (const m of html.matchAll(re)) out.push(m[1] ?? m[0]);
    return out.join(" ");
  };
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/gi) + " " + pick(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  const meta = pick(/<meta[^>]+content="([^"]{0,400})"/gi);
  const ld = pick(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  const opts = pick(/<option[^>]*>([\s\S]*?)<\/option>/gi) + " " + pick(/<select[\s\S]{0,2000}?<\/select>/gi);
  // 🔴 「설명」은 본문 전체에서 위 네 자리를 뺀 나머지로 본다(중복 집계 방지).
  const stripped = html
    .replace(/<title[\s\S]*?<\/title>/gi, " ").replace(/<h1[\s\S]*?<\/h1>/gi, " ")
    .replace(/<meta[^>]*>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<option[\s\S]*?<\/option>/gi, " ");
  const has = (s: string) => norm(s).includes(needle);
  return {
    inTitleOrH1: has(title), inUrl: has(url), inMetadata: has(meta),
    inStructuredData: has(ld), inOptions: has(opts), inDescription: has(stripped),
    anywhere: has(html),
  };
}

/** 🔴 자체 코드 패턴 — 「코드가 있다」와 섞지 않기 위해 따로 센다. */
const OWN_SKU_RE = /\(([0-9A-Z]{2,6}[A-Z0-9]{0,4}-[0-9A-Z]{2,6}-[0-9A-Z]{2,6})\)/g;

/**
 * 🔴🔴 1차 측정의 한계를 고친다 (CTO 자체 정정).
 *   특정 품번 3개로 재면 «그 샵이 그 상품을 안 팔면» 당연히 0 이 나온다. 그래서
 *   「이 샵이 **해외 품번을 적는 습관이 있는가**」를 **형식 패턴** 으로 따로 센다.
 *   패턴은 실측된 해외 품번 모양에서만 가져왔다(지어내지 않았다):
 *     B226AC035        영1+숫3+영2+숫3     (Bobo Choses · bobochoses handle 규약)
 *     AW26MS185        시즌2+숫2+영2+숫3   (Main Story)
 *     PP24KASHE1195NER 영2+숫2+영5+숫4+영3 (PèPè, foretforet 표기)
 *   🔴 이것은 「해외 품번일 수 있는 모양」이고 «확정» 이 아니다 — 자체 SKU 가 우연히
 *      같은 모양일 수 있다. 그래서 이름을 `codeShapedTokens` 로 둔다.
 */
const OVERSEAS_CODE_SHAPES: { name: string; re: RegExp }[] = [
  { name: "L1D3L2D3(B226AC035형)", re: /\b[A-Z]\d{3}[A-Z]{2}\d{3}\b/g },
  { name: "SEASON+L2D3(AW26MS185형)", re: /\b(?:SS|AW|FW|PE)\d{2}[A-Z]{2}\d{3}\b/g },
  { name: "L2D2L5D4L3(PP24KASHE1195NER형)", re: /\b[A-Z]{2}\d{2}[A-Z]{3,6}\d{3,5}[A-Z]{2,4}\b/g },
];

/** 🔴 HTML 에서 «보이는 글자» 만 본다 — script/style 안의 내부 식별자를 품번으로 세지 않는다. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .toUpperCase();
}

function scanCodeShapes(html: string) {
  const text = visibleText(html);
  const out: Record<string, string[]> = {};
  for (const sh of OVERSEAS_CODE_SHAPES) {
    const hits = [...new Set([...text.matchAll(sh.re)].map((m) => m[0]))];
    if (hits.length > 0) out[sh.name] = hits.slice(0, 8);
  }
  return out;
}

describe.skipIf(!LIVE)("🔴 DOM-VALUE-02 — 국내 판매처가 해외 품번을 적는가", () => {
  it(
    "robots 통과한 RETAILER 4개에서 브랜드 취급 여부와 품번 자리를 가른다",
    async () => {
      interface Row { [k: string]: unknown }
      const rows: Row[] = [];
      let requests = 0;
      const t0 = Date.now();

      for (const shop of INVESTIGATE) {
        /* ① 홈페이지 — 플랫폼 감지 */
        const home = await fetchHtmlDirect(shop.base);
        requests++;
        if (!home?.html) {
          rows.push({ domain: shop.domain, step: "HOME", ok: false, detail: "홈페이지를 받지 못했다" });
          // eslint-disable-next-line no-console
          console.log(`${shop.domain.padEnd(22)} HOME 실패`);
          continue;
        }
        const platform = detectPlatform(home.html);
        const searchPath = SEARCH_PATHS[platform];
        /**
         * 🔴 「플랫폼 미감지」로 닫지 않는다 — 왜 못 알아봤는지 지문을 남긴다.
         *    1차 측정에서 coconjennie 가 UNKNOWN 으로 빠졌고 원인을 적지 않았다.
         */
        const homeFingerprint = platform !== "UNKNOWN" ? null : {
          bytes: home.html.length,
          title: (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(home.html)?.[1] ?? "").trim().slice(0, 70),
          generator: (/<meta[^>]+name="generator"[^>]+content="([^"]*)"/i.exec(home.html)?.[1] ?? null),
          scriptHosts: [...new Set([...home.html.matchAll(/src="https?:\/\/([^/"]+)/gi)].map((m) => m[1]))].slice(0, 8),
        };

        /* ② 브랜드 검색 — 🔴 플랫폼 규약이 없으면 «하지 않는다»(경로를 지어내지 않는다) */
        for (const probe of PROBES) {
          if (!searchPath) {
            rows.push({ domain: shop.domain, platform, brand: probe.brand, homeFingerprint,
                        step: "SEARCH", ok: false, detail: "🔴 플랫폼 미감지 — 검색 경로를 지어내지 않았다" });
            continue;
          }
          // 🔴 검색 경로도 robots 를 다시 본다 — 홈만 통과했을 수 있다.
          const searchUrl = `${shop.base}${searchPath(probe.korean)}`;
          const rb = await checkRobots(searchUrl);
          requests++;
          if (rb.state !== "NOT_DISALLOWED") {
            rows.push({ domain: shop.domain, platform, brand: probe.brand, step: "SEARCH",
                        ok: false, detail: `🔴 robots ${rb.state} — 받지 않았다` });
            continue;
          }
          const sr = await fetchHtmlDirect(searchUrl);
          requests++;
          const html = sr?.html ?? "";
          /** 🔴 「검색 결과 0건」과 「브랜드 미취급」을 구분할 수 없다 — 그대로 적는다. */
          const brandMentioned = html.includes(probe.korean) || html.toUpperCase().includes(probe.brand.toUpperCase());
          // 상품 링크 후보 — 플랫폼 표준 경로만 본다
          /**
           * 🔴 1차 측정은 `/product/search.html` 을 «상품 링크» 로 잡았다 — 그래서
           *    상품 페이지를 한 번도 받지 못했고, 그 0건을 「품번 없음」으로 읽을 뻔했다.
           *    Cafe24 상품 URL 은 `/product/{이름}/{번호}/...` 꼴이다. 번호를 요구하고
           *    `search`/`list` 같은 기능 페이지를 명시적으로 뺀다.
           */
          const links = [...new Set([...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]))]
            .filter((h) => /\/product\/[^/"?]+\/\d+\//.test(h) || /\/products\/[a-z0-9-]{4,}/i.test(h) || /goods_view/.test(h))
            .filter((h) => !/search\.html|list\.html|\/product\/list|#/.test(h))
            .slice(0, 3);
          const codeHere = scanCodePlaces(html, searchUrl, probe.code);
          const ownSkus = [...new Set([...html.matchAll(OWN_SKU_RE)].map((m) => m[1]))].slice(0, 5);

          /* ③ 상품 페이지 1건 — 품번 자리 스캔 */
          let productScan: unknown = null;
          let productUrl: string | null = null;
          /** 🔴 「해외 품번을 적는 습관이 있는가」 — 특정 코드가 아니라 모양으로 센다 */
          let productShapes: Record<string, string[]> = {};
          let productTitle = "";
          const productPages: { url: string; title: string; shapes: Record<string, string[]>; hasShape: boolean }[] = [];
          /** 🔴 표본 1건으로 표기 규약을 단정하지 않는다 — 최대 3건을 본다. */
          for (const href of links) {
            const u = href.startsWith("http") ? href : `${shop.base}${href.startsWith("/") ? "" : "/"}${href}`;
            const pr = await fetchHtmlDirect(u);
            requests++;
            if (!pr?.html) continue;
            const sh = scanCodeShapes(pr.html);
            const t = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(pr.html)?.[1] ?? "").trim().slice(0, 90);
            productPages.push({ url: u, title: t, shapes: sh, hasShape: Object.keys(sh).length > 0 });
            if (!productUrl) { productUrl = u; productScan = scanCodePlaces(pr.html, u, probe.code); productShapes = sh; productTitle = t; }
          }

          rows.push({
            domain: shop.domain, platform, brand: probe.brand, probeCode: probe.code,
            step: "SEARCH", ok: !!sr?.html, searchUrl,
            searchHtmlBytes: html.length, brandMentionedOnSearchPage: brandMentioned,
            /** 🔴 세 브랜드가 같은 바이트면 검색이 «안 먹은» 것이다(karymarket 실측). */
            searchHtmlFingerprint: `${html.length}:${html.slice(0, 200).replace(/\s+/g, "").slice(0, 40)}`,
            productLinksFound: links.length, productUrl,
            /** 🔴 해외 품번이 «검색 페이지» 에 있는가 */
            codeOnSearchPage: codeHere,
            /** 🔴 해외 품번이 «상품 페이지» 의 어느 자리에 있는가 */
            codeOnProductPage: productScan,
            /** 🔴 자체 SKU 는 «따로» 센다 — 「코드가 있다」로 집계하지 않는다 */
            ownSkuSamples: ownSkus,
            /** 🔴 상품 페이지에 «해외 품번 모양» 토큰이 있는가(확정 아님) */
            productTitle, codeShapedTokens: productShapes,
            codeShapedAny: productPages.some((x) => x.hasShape),
            /** 🔴 상품 페이지 여러 건 — 규약이 «일관» 되는지 본다 */
            productPagesFetched: productPages.length,
            productPagesWithShape: productPages.filter((x) => x.hasShape).length,
            productPageDetail: productPages.map((x) => ({ title: x.title, shapes: x.shapes })),
            /** 🔴 검색페이지의 브랜드 문자열은 «검색어 에코» 일 수 있다 — 거짓양성 주의 */
            brandMentionCaveat: "Cafe24 검색 페이지는 검색어를 에코한다. 취급 증거가 아니다.",
          });
          // eslint-disable-next-line no-console
          console.log(`${shop.domain.padEnd(22)} ${platform.padEnd(9)} ${probe.brand.padEnd(12)} brandMentioned=${brandMentioned} links=${links.length} codeAnywhere=${codeHere.anywhere}`);
        }
      }

      const elapsed = Date.now() - t0;
      const count = (xs: Row[], k: (x: Row) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[k(x)] = (t[k(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const searched = rows.filter((r) => r.step === "SEARCH" && r.ok);
      const report = {
        scope: {
          note: `🔴 sample N=${INVESTIGATE.length} 샵 × ${PROBES.length} 브랜드. 전수가 아니다.`,
          targetSelection: "Phase 1 의 robots NOT_DISALLOWED ∩ source_type=RETAILER ∩ 비-AUTO",
          "🔴 하지 않은 것": "어댑터 작성 · robots 우회 · 경로 추측 · MANUAL→AUTO 전환",
          "🔴 구분 못 하는 것": "「검색 0건」과 「브랜드 미취급」은 이 측정으로 갈리지 않는다",
          automationCostSignal: "comparison-search/ 에 공유 플랫폼 헬퍼가 없다 — 샵 1개 = 어댑터 1개",
        },
        cost: { requests, elapsedMs: elapsed, msPerRequest: requests ? Math.round(elapsed / requests) : null },
        byPlatform: count(rows, (r) => String(r.platform ?? "(실패)")),
        brandMentionRate: {
          searchedPairs: searched.length,
          brandMentioned: searched.filter((r) => r.brandMentionedOnSearchPage).length,
        },
        /** 🔴🔴 핵심 — 해외 품번이 어디에도 없으면 그 샵을 추가해도 SAME yield 가 0 이다 */
        overseasCodeFound: {
          onSearchPage: searched.filter((r) => (r.codeOnSearchPage as { anywhere: boolean }).anywhere).length,
          onProductPage: searched.filter((r) => (r.codeOnProductPage as { anywhere?: boolean } | null)?.anywhere).length,
          byPlace: ["inTitleOrH1", "inUrl", "inMetadata", "inStructuredData", "inOptions", "inDescription"].map((k) => ({
            place: k,
            search: searched.filter((r) => (r.codeOnSearchPage as Record<string, boolean>)[k]).length,
            product: searched.filter((r) => ((r.codeOnProductPage ?? {}) as Record<string, boolean>)[k]).length,
          })),
        },
        ownSkuObserved: searched.filter((r) => (r.ownSkuSamples as string[]).length > 0).length,
        /** 🔴🔴 §5 의 실제 답 — 그 샵이 «해외 품번 모양» 을 상품 페이지에 적는가 */
        codeShapedOnProductPage: {
          note: "🔴 「해외 품번일 수 있는 모양」이고 확정이 아니다. 자체 SKU 가 같은 모양일 수 있다.",
          pairsWithAnyShape: searched.filter((r) => r.codeShapedAny).length,
          byDomain: count(searched.filter((r) => r.codeShapedAny), (r) => String(r.domain)),
          samples: searched.filter((r) => r.codeShapedAny)
            .map((r) => ({ domain: r.domain, productTitle: r.productTitle, tokens: r.codeShapedTokens })).slice(0, 10),
        },
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "domval-code-availability.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBeGreaterThan(0);
      // 🔴 선행 덤프가 있어야 Phase 1 과 대상이 일치한다는 것을 고정한다.
      expect(existsSync(path.join(OUT_DIR, "domval-robots.json"))).toBe(true);
    },
    90 * 60 * 1000,
  );
});
