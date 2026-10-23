import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  searchDomesticShops,
  withConfidence,
} from "@commerce/crawler";
import type { DomesticSourceRef, ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket } from "../candidate-market";
import { buildMarketJudgement, buildPriceGuide, isPriceConfirmed } from "../../../../pipeline/commerce/mi-same-candidates";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-FINAL-3 — **자동 경로** 국내 가격비교 E2E (수동 주입 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「**수동 `candidateUrls` 주입으로 PASS 시키면 안 됩니다**」.
 *
 * 🔴 그래서 이 하니스는 `candidateUrls` 를 **한 건도 넣지 않는다.**
 *    대신 운영의 **자동 생산자** 를 그대로 부른다 — `searchDomesticShops`.
 * 🔴 threshold/MI/동의어/Registry/Adapter/Gemini **0** · 운영 코드 **0** · 배포 **0**.
 * 🔴 게이트 `WU_F3_PROBE=1` 없으면 SKIP.
 *
 * ── 🔴🔴 자동 국내 공급 생산자는 «셋» 이고 둘은 구조적으로 비어 있다(코드 사실) ──
 * ```
 * ① `__url_candidates__` ← `candidateUrls`
 *    🔴 자동 1회차가 **보내지 않는다** — `pipeline/page.tsx:481` 이
 *       `body: JSON.stringify({ snapshotId: data.snapshot.id })` **하나만** 보낸다
 * ② 등록부 검색 `searchDomesticShops`(run-domestic-price-check.ts:1011·1014)
 *    🟢 **자동으로 돈다** ⟹ **이 하니스가 그것을 측정한다**
 * ③ `__reviewed_same__` ← `listReviewedSameUrls`(check/route.ts:103)
 *    🟢 조건 없이 돈다 — 🔴 그런데 **사람이 이미 SAME 이라고 표시한 URL만** 돌려준다
 *       ⟹ **새 상품에는 비어 있다**(닭-달걀) · 🔴 그리고 service-role 키가 필요해
 *          하니스에서 부를 수 없다 ⟹ **측정불가** 로 적는다(0 으로 세지 않는다)
 * ```
 *
 * ── 🔴 등록부 입력에 대한 정직한 한계 ──────────────────────────────────────
 * ```
 * 운영은 `listDomesticPriceSources(workspaceId)`(service-role)로 샵을 읽는다.
 * 🔴 하니스는 그 키가 없다 ⟹ **실제 국내 어댑터 등록부**(price-source-adapter.ts 의
 *    `catalog: "DOMESTIC"` 8개)를 **그대로** 쓴다. 🔴 「운영과 같다」로 적지 않는다.
 * 🟢 그 8개가 **자동 검색이 닿을 수 있는 전부** 다 — 어댑터가 없는 도메인은
 *    `findPriceSourceAdapter` 가 null 을 내고 `unsupported` 로 끝난다(WU-115 확정).
 * ```
 */
const LIVE = process.env.WU_F3_PROBE === "1";

/** 🟢 `price-source-adapter.ts` 의 `catalog: "DOMESTIC"` 전수(8) — 지어낸 것 0. */
const DOMESTIC_ADAPTERS = [
  "looxloo.com",
  "bobochoses.com",
  "rulii.co.kr",
  "skysport.co.kr",
  "deuxbebe.com",
  "littleluna.co.kr",
  "chocoel.co.kr",
  "foretforet.com",
] as const;

const refs: DomesticSourceRef[] = DOMESTIC_ADAPTERS.map((d, i) => ({
  id: `auto-${i}`,
  name: d,
  domain: d,
  currency: "KRW",
  collectionStrategy: "AUTO_SCRAPE",
}));

const PRODUCTS = [
  { code: "B226AC009", origin: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt" },
  { code: "B226AC010", origin: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt" },
  { code: "B226AC117", origin: "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket" },
];

describe("WU-FINAL-3 — 자동 경로 국내 가격비교 E2E", () => {
  it.runIf(LIVE)("자동 생산자만으로 상품 3종을 끝까지 돌린다", async () => {
    /* eslint-disable no-console */
    interface Out {
      code: string;
      brand: string;
      status: Record<string, number>;
      autoCands: number;
      detail: number;
      fetchOk: number;
      extractOk: number;
      miInput: number;
      same: number;
      priced: number;
      final: string;
    }
    const table: Out[] = [];

    for (const p of PRODUCTS) {
      console.log(`\n══════════ ${p.code} ══════════`);
      const ex = await shopifySiteStrategy.extract(p.origin);
      if (!ex) {
        console.log("  🔴 원상품 추출 실패 — 측정불가");
        continue;
      }
      const product = buildCanonicalProduct(
        p.origin,
        ex.productData as ExtractedProductData,
        {} as Record<string, ProductDataSource>,
        [],
      );
      const dna = buildProductIdentityDna(product);
      const of = productFactsFromIdentityDna(dna);
      console.log(`  ⑤ brand = ${JSON.stringify(of.brand)} · code = ${of.brandModelCode}`);

      const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
      const query = {
        title: dna.title,
        brand: dna.brand.value || undefined,
        sourceUrl: dna.sourceUrl,
        sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
        searchTerm: terms[0] ?? dna.title,
        searchTerms: terms,
        facts: of,
      };

      /** 🔴🔴 **① 자동 후보 공급** — 운영 함수를 그대로. `candidateUrls` 주입 **0**. */
      const results = await searchDomesticShops(query, refs);
      const status: Record<string, number> = {};
      for (const r of results) status[r.status] = (status[r.status] ?? 0) + 1;
      const autoCands = results.reduce((n, r) => n + (r.status === "ok" ? r.candidates.length : 0), 0);
      const detail = results.reduce(
        (n, r) => n + (r.status === "ok" ? r.candidates.filter((c) => classifyUrlShape(c.url) === "PRODUCT_PAGE").length : 0),
        0,
      );
      console.log(`  ① 자동 후보 ${autoCands} · 샵 응답 ${JSON.stringify(status)}`);
      console.log(`  ② detail 모양 ${detail}`);

      const rows: GeminiTransientRow[] = [];
      let fetchOk = 0;
      let extractOk = 0;
      let miInput = 0;
      for (const res of results) {
        if (res.status !== "ok" || res.candidates.length === 0) continue;
        fetchOk += res.candidates.length;
        const scored = withConfidence(query, res.candidates);
        miInput += scored.length;
        let priced = scored;
        try {
          priced = await enrichCandidatePrices(scored, res.domain, query);
        } catch {
          /* 운영과 같다 */
        }
        for (const c of priced) if (c.price?.amount != null) extractOk += 1;
        const j = await judgeDomesticCandidate({
          domain: res.domain,
          candidates: priced,
          sourceUrl: query.sourceUrl,
          foreignModelCode: dna.brandModelCode,
          foreignColor: dna.color,
          fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
        });
        if (j.kind !== "JUDGED") {
          console.log(`    ${res.domain.padEnd(20)} **${j.kind}**  (후보 ${res.candidates.length})`);
          continue;
        }
        const tier = domesticMatchDisplay(j.matchTruth as never).tier;
        const mk = classifyCandidateMarket({
          domain: res.domain,
          currency: j.best.price?.currency ?? null,
          isRegisteredDomesticShop: true,
        });
        console.log(
          `    ${res.domain.padEnd(20)} tier=${String(tier).padEnd(14)} market=${String(mk.market).padEnd(9)}` +
            ` ${j.best.price?.amount != null ? `${j.best.price.currency} ${j.best.price.amount}` : "가격없음"}` +
            `  ${String(j.best.title).slice(0, 36)}`,
        );
        rows.push({
          source: "REVIEWED_SAME",
          domain: res.domain,
          title: j.best.title,
          imageUrl: j.best.imageUrl ?? null,
          soldOut: j.best.soldOut ?? null,
          discoveredUrl: j.best.url,
          matchTruth: j.matchTruth,
          priceTier: priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified }),
          crossSellerVerdict: j.best.crossSellerVerdict ?? null,
          confidence: j.best.confidence ?? null,
          matchReasons: j.best.matchReasons ?? [],
          crossSellerBlockers: (j.best.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
          crossSellerConflicts: (j.best.crossSellerConflicts ?? []).map((x) => (typeof x === "string" ? x : x.conflict)),
          priceAmount: j.best.price?.amount ?? null,
          priceCurrency: j.best.price?.currency ?? null,
          priceStatus: j.best.priceStatus ?? null,
          market: mk.market,
          basis: mk.basis,
        } as GeminiTransientRow);
      }

      const judgement = buildMarketJudgement(rows);
      const guide = buildPriceGuide(judgement, "KR");
      const krSame = rows.filter((r) => domesticMatchDisplay(r.matchTruth as never).tier === "SAME" && r.market === "KR");
      const pricedN = krSame.filter((r) => isPriceConfirmed(r)).length;
      const final = pricedN === 0 ? "A 국내 가격 참고 불가" : pricedN === 1 ? "B 가격 참고 1건" : "C 국내 시장 가격대";
      console.log(
        `  ⑥⑦ SAME ${krSame.length} · 가격확인 ${pricedN} · verdict ${judgement.verdict}` +
          ` · basis ${String((guide as { basis?: string } | null)?.basis ?? "-")}`,
      );
      console.log(`  ⑧ ⟹ **${final}**`);

      table.push({
        code: p.code,
        brand: of.brand ?? "",
        status,
        autoCands,
        detail,
        fetchOk,
        extractOk,
        miInput,
        same: krSame.length,
        priced: pricedN,
        final,
      });
    }

    console.log("\n══════════ 🔴🔴 WU-FINAL-3 표 ══════════");
    console.log(
      `  ${"상품".padEnd(11)} ${"brand".padEnd(13)} ${"자동후보".padStart(6)} ${"detail".padStart(6)}` +
        ` ${"fetch".padStart(5)} ${"extract".padStart(7)} ${"MI".padStart(3)} ${"SAME".padStart(4)} ${"가격".padStart(4)}  최종`,
    );
    for (const t of table) {
      console.log(
        `  ${t.code.padEnd(11)} ${(t.brand || "(빔)").padEnd(13)} ${String(t.autoCands).padStart(6)} ${String(t.detail).padStart(6)}` +
          ` ${String(t.fetchOk).padStart(5)} ${String(t.extractOk).padStart(7)} ${String(t.miInput).padStart(3)}` +
          ` ${String(t.same).padStart(4)} ${String(t.priced).padStart(4)}  ${t.final}`,
      );
    }
    console.log("\n  🔴 `candidateUrls` 주입 **0** — 자동 생산자(`searchDomesticShops`)만 돌렸다");
    console.log("  🔴 생산자 ①(candidateUrls)은 자동 1회차가 **보내지 않는다**(page.tsx:481)");
    console.log("  🔴 생산자 ③(reviewed_same)은 **사람이 이미 SAME 이라 표시한 URL만** 돌려주고");
    console.log("     service-role 키가 필요해 하니스에서 부를 수 없다 ⟹ **측정불가**");
    console.log("  🔴 등록부 입력은 **어댑터 8개** 다(service-role 없음) — 「운영과 같다」로 적지 않는다");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(table.length).toBeGreaterThan(0);
  }, 1_800_000);
});
