import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import type { CanonicalProduct } from "@commerce/shared";
import { describe, expect, it } from "vitest";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket } from "../candidate-market";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { WEB_SEARCH_SHOP_ID, WEB_SEARCH_SHOP_NAME } from "../transient-candidates";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { collectWebSearchUrls } from "../web-search-pool";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DISCOVERY E2E — **AI Search → 기존 동일상품 판단** (대표 상품 1개)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-27) — 묻는 것은 **하나** 다:
 * > 「AI Search 가 가져온 URL 목록을 **기존 동일상품 판단 엔진** 이 제대로 판단하는가?」
 *
 * ── 🔴 이 하니스가 «하지 않는» 것 ──────────────────────────────────────────
 * ```
 * ❌ Query 실험/최적화  ❌ Search retry  ❌ fallback  ❌ 추가 Query  ❌ Provider 변경
 * ❌ Identity 수정      ❌ threshold 수정 ❌ Evidence 로직 변경 ❌ MI 로직 변경
 * ❌ brand+code → SAME shortcut            ❌ AI 가 직접 SAME 을 판단하는 구조
 * ❌ 1-hop            ❌ Registry        ❌ Farfetch 우회
 * 🟢 판단은 **전부 기존 엔진** 이 한다 — 이 파일은 그 산출을 **그대로 옮겨 적는다**.
 * ```
 *
 * 🔴 **Search 는 운영 생산자 그대로** 다(`collectWebSearchUrls` · 상품당 **1회**).
 * 🔴 게이트 `CORE_E2E_SAME=1` 없으면 SKIP.
 */

const LIVE = process.env.CORE_E2E_SAME === "1";
const FIX = join(__dirname, "fixtures");
const fx = <T>(f: string): T => JSON.parse(readFileSync(join(FIX, f), "utf8")) as T;

/** 🟢 대표 상품 — 기존 GT 라벨이 가장 많은 상품이다(사람 판단과 대조할 수 있다). */
const PRODUCT_ID = "S2";
const ORIGIN_CODE = "B226AC009";

const pad = (s: unknown, n: number) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].length));
const padL = (s: unknown, n: number) => " ".repeat(Math.max(0, n - [...String(s)].length)) + String(s);
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

/** 🔴 사람 라벨은 **기존 fixture** 에서만 읽는다 — CTO 가 동일상품을 판정하지 않는다. */
function humanLabels(): Map<string, string> {
  const out = new Map<string, string>();
  const add = (u?: string, v?: string) => {
    if (u && v && !out.has(loose(u))) out.set(loose(u), v);
  };
  for (const c of fx<{ candidates: { originCode: string; url: string; verdict: string }[] }>("wu-112-human-gt.json")
    .candidates)
    if (c.originCode === ORIGIN_CODE) add(c.url, c.verdict);
  for (const c of fx<{ candidates: { originCode: string; url: string; humanVerdict: string }[] }>(
    "wu-111-human-gt.json",
  ).candidates)
    if (c.originCode === ORIGIN_CODE) add(c.url, c.humanVerdict);
  for (const c of fx<{ candidates: { origin: string; url: string; human: string }[] }>("wu-125-human-gt.json")
    .candidates)
    if (c.origin === ORIGIN_CODE) add(c.url, c.human);
  return out;
}

describe("DISCOVERY E2E §경계 — 기존 엔진을 바꾸지 않았다(순수)", () => {
  it("🔴 이 하니스에 **판정 로직이 없다** — 전부 운영 함수를 부른다", () => {
    const code = readFileSync(join(__dirname, "discovery-e2e-same-product.test.ts"), "utf8").replace(
      /\/\*\*[\s\S]*?\*\//g,
      "",
    );
    /** 🔴 threshold·shortcut 어휘가 하나도 없어야 한다(쪼개 적는다 — 자기 FAIL 방지). */
    for (const parts of [
      ["SAME_MIN", "_AXES"],
      ["thres", "hold"],
      ["crossSeller", "Verdict ="],
    ]) {
      expect(code, parts.join("")).not.toContain(parts.join(""));
    }
    /** 🟢 판단 owner 를 이름으로 고정한다. */
    for (const fn of ["withConfidence", "judgeDomesticCandidate", "priceTierFromLink", "classifyCandidateMarket"]) {
      expect(code, fn).toContain(fn);
    }
  });

  it("🔴 Search 는 **운영 생산자** 이고 상품당 1회다", () => {
    const pool = readFileSync(join(__dirname, "../web-search-pool.ts"), "utf8");
    expect(pool).toContain("MAX_SEARCHES_PER_PRODUCT = 1");
    const code = readFileSync(join(__dirname, "discovery-e2e-same-product.test.ts"), "utf8");
    expect(code).toContain("collectWebSearchUrls");
  });
});

describe.skipIf(!LIVE)("DISCOVERY E2E — AI Search → 기존 동일상품 판단(라이브 · Search 1회)", () => {
  it(
    "대표 상품 1개로 끝까지 돌리고 기존 엔진의 판단을 그대로 적는다",
    async () => {
      const origins = fx<{ origins: Record<string, { canonicalProduct: CanonicalProduct }> }>(
        "wu-059-gt-facts.json",
      ).origins;
      const product = origins[PRODUCT_ID]!.canonicalProduct;
      const dna = buildProductIdentityDna(product);
      /* eslint-disable no-console */
      console.log(
        `\n══ 원상품 ${PRODUCT_ID} — ${dna.brand.value} / ${dna.brandModelCode} / ${dna.title} ══`,
      );
      expect(dna.brandModelCode).toBe(ORIGIN_CODE);

      /* ── 1. Search — 운영 생산자 · 상품당 1회 ── */
      const search = await collectWebSearchUrls({
        identity: {
          brand: dna.brand.value || null,
          productName: null,
          productType: null,
          genderAge: null,
          color: null,
          size: null,
          season: null,
          productCode: dna.brandModelCode,
          sourceUrl: dna.sourceUrl,
          sourceSite: null,
          sourceCountry: null,
          market: null,
        },
      });
      console.log(
        `\n1. Search — query ${search.metrics.query} · 실행 ${search.metrics.searches}회 · 결과 ${search.metrics.organicResults}건 · skipped ${search.metrics.skipped} · failed ${search.metrics.failed}`,
      );
      /** 🔴 「못 물어봤다」와 「결과 0」을 가른다 — 열화된 실행으로 결론 내지 않는다. */
      expect(search.metrics.skipped, "토큰/품번 문제로 검색하지 못했다").toBeNull();
      expect(search.metrics.failed, "검색이 실패했다 — 열화된 실행").toBe(false);
      expect(search.metrics.searches).toBe(1);
      expect(search.urls.length).toBeGreaterThan(0);

      /* ── 2. Crawl — 운영 pool 그대로 ── */
      const productPages = search.urls.filter((u) => String(classifyUrlShape(u)) === "PRODUCT_PAGE");
      const pool = await collectUrlCandidatePool({
        urls: search.urls,
        originUrl: dna.sourceUrl,
        maxUrls: search.urls.length,
        existingCanonicalUrls: new Set<string>(),
        shopId: WEB_SEARCH_SHOP_ID,
        shopNamePrefix: WEB_SEARCH_SHOP_NAME,
      });
      console.log(
        `\n2. Crawl — 상품상세 ${productPages.length} · 후보 성립 ${pool.metrics.miEligibleCandidates} · fetch ${pool.metrics.fetchCalls}`,
      );

      /* ── 3~4. Evidence + 기존 동일상품 판단 — 운영 호출 순서 그대로 ── */
      const query = {
        title: dna.title,
        brand: dna.brand.value || undefined,
        sourceUrl: dna.sourceUrl,
        sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
        searchTerm: buildCrossSellerSearchQueries(dna).filter(Boolean)[0] ?? dna.title,
        searchTerms: buildCrossSellerSearchQueries(dna).filter(Boolean),
        facts: productFactsFromIdentityDna(dna),
      };
      const rows: {
        url: string;
        domain: string;
        brand: boolean;
        name: boolean;
        code: boolean;
        verdict: string;
        matchTruth: string | null;
        tier: string | null;
        market: string | null;
        isBest: boolean;
      }[] = [];

      for (const res of pool.searchResults) {
        if (res.status !== "ok" || res.candidates.length === 0) continue;
        const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
        const scored = withConfidence(query, notSelf);
        let priced = scored;
        try {
          priced = await enrichCandidatePrices(scored, res.domain, query);
        } catch {
          /* 운영과 같다 */
        }
        const j = await judgeDomesticCandidate({
          domain: res.domain,
          candidates: priced,
          sourceUrl: query.sourceUrl,
          foreignModelCode: dna.brandModelCode,
          foreignColor: dna.color,
          fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
        });
        for (const c of priced) {
          const best = j.kind === "JUDGED" && loose(j.best.url) === loose(c.url);
          rows.push({
            url: c.url,
            domain: res.domain,
            brand: Boolean(c.facts?.brand || c.brand),
            name: Boolean(c.title?.trim()),
            code: Boolean(c.facts?.brandModelCode || c.sku),
            /** 🔴 **기존 엔진의 값 그대로** 다 — 재분류하지 않는다. */
            verdict: c.crossSellerVerdict ?? "UNKNOWN",
            matchTruth: best ? j.matchTruth : null,
            tier: best ? priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified }) : null,
            market: best
              ? classifyCandidateMarket({
                  domain: res.domain,
                  currency: j.best.price?.currency ?? null,
                  isRegisteredDomesticShop: false,
                }).market
              : null,
            isBest: best,
          });
        }
      }

      console.log(
        `\n3. Evidence — 후보 ${rows.length} · BRAND ${rows.filter((r) => r.brand).length}` +
          ` · PRODUCT_NAME ${rows.filter((r) => r.name).length} · MODEL_CODE ${rows.filter((r) => r.code).length}`,
      );

      const byVerdict = new Map<string, number>();
      for (const r of rows) byVerdict.set(r.verdict, (byVerdict.get(r.verdict) ?? 0) + 1);
      console.log(`\n4. 기존 동일상품 판단(그대로)`);
      for (const v of ["SAME", "PRESUMED_SAME", "SIMILAR", "DIFFERENT", "CONFLICT", "UNKNOWN"]) {
        console.log(`   ${pad(v, 16)}${padL(byVerdict.get(v) ?? 0, 4)}`);
      }
      for (const [v, n] of byVerdict) {
        if (!["SAME", "PRESUMED_SAME", "SIMILAR", "DIFFERENT", "CONFLICT", "UNKNOWN"].includes(v)) {
          console.log(`   ${pad(v, 16)}${padL(n, 4)}  🔴 위 목록에 없는 값`);
        }
      }

      /* ── 5. 실제 URL × 사람 라벨 대조 ── */
      const human = humanLabels();
      console.log(`\n5. 실제 URL 검증 — 사람 라벨은 **기존 GT fixture** 에서만 읽었다(CTO 판정 0)`);
      console.log(`   ${pad("판매처", 26)}${pad("기존 엔진", 16)}${pad("사람(GT)", 10)}URL`);
      for (const r of rows) {
        const h = human.get(loose(r.url)) ?? "-";
        console.log(`   ${pad(r.domain, 26)}${pad(r.verdict, 16)}${pad(h, 10)}${r.url.slice(0, 70)}`);
      }
      const labelled = rows.filter((r) => human.has(loose(r.url)));
      console.log(`   🔴 사람 라벨이 있는 것 ${labelled.length}/${rows.length} — 나머지는 **측정불가**(0 이 아니다)`);

      /* ── 6. 화면이 읽는 칸 ── */
      const shown = rows.filter((r) => r.isBest);
      console.log(`\n6. 화면 — 샵 대표 ${shown.length}건`);
      for (const r of shown) {
        console.log(`   ${pad(r.domain, 26)}tier ${pad(r.tier ?? "-", 12)}market ${pad(r.market ?? "-", 10)}truth ${r.matchTruth ?? "-"}`);
      }
      console.log(
        `   🇰🇷 ${shown.filter((r) => r.market === "KR").length} · 🌎 ${shown.filter((r) => r.market === "OVERSEAS").length} · ❔ ${shown.filter((r) => r.market !== "KR" && r.market !== "OVERSEAS").length}`,
      );

      /** 🔴 열화 게이트 — 전건 실패면 funnel 을 결론으로 쓰지 않는다. */
      expect(rows.length, "후보가 하나도 생기지 않았다 — 열화된 실행").toBeGreaterThan(0);
      /** 🟢 화면이 읽는 칸이 **전부 기존 엔진 산출** 이다(지어낸 값 0). */
      for (const r of shown) expect(r.tier, r.url).toBeTruthy();
    },
    60 * 60_000,
  );
});
