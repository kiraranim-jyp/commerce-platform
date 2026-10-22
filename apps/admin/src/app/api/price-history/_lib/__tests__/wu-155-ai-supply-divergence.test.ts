import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { enrichCandidatePrices, fetchDomesticModelCode, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { buildMarketJudgement, isPriceConfirmed } from "../../../../pipeline/commerce/mi-same-candidates";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-155 — **AI Search 공급: 국내 ↔ 해외 단계별 숫자 비교**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 질문(2026-10-22) — 「AI Search 에게 국내 동일상품 링크를 최대한 많이 찾아달라고
 * 하면 결과가 나오는데, 그 URL 들이 **왜 우리 후보 분석 파이프라인으로 들어오지
 * 않는가**」. 🔴 **최초로 숫자가 갈라지는 한 행** 을 찾는 것이 이 측정의 전부다.
 *
 * ── 🔴 입력은 «실제 AI Search 결과» 다(지어내지 않았다) ──────────────────────
 * ```
 * 공급원  `cto-websearch`(WU-073/116 과 **같은 라벨** · 비용 0 · 운영 변경 0)
 * 질의    국내 「보보쇼즈 허그 헤어리 몬스터 티셔츠 B226AC009 구매 국내 쇼핑몰」
 *         해외 「B226AC009 보보쇼즈 … 상품」
 * 🔴 **AI 단계에서 후보를 줄이지 않았다**(CPO 조건) — 돌려준 링크를 **전부** 넣는다.
 *    위키백과·무관 도메인도 그대로 넣는다. 거르는 것은 **우리 파이프라인의 일** 이다.
 * ```
 * 🔴 운영 코드 변경 **0** · MI **0** · threshold **0** · Registry/어댑터 **0**.
 * 🔴 게이트 `WU_155_PROBE=1` 없으면 SKIP.
 */
const LIVE = process.env.WU_155_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/** 🔴 2026-10-22 실제 검색 결과 링크 **전수**(순서까지 그대로). */
const DOMESTIC_RAW = [
  "https://shop.coupang.com/beaumondekr?ocid=17295735&checkBatchDelivery=true&pid=7907482626&viid=88739618284&platform=p&brandId=0&locale=ko_KR",
  "https://www.feelway.com/gv_Moncler_7537147736.html",
  "https://m.bunjang.co.kr/keywords/hUG",
  "https://www.beaumonde.co.kr/",
  "https://en.wikipedia.org/wiki/David_Horvath",
  "https://en.wikipedia.org/wiki/YooHoo_%26_Friends",
  "https://en.wikipedia.org/wiki/Paboo_%26_Mojies",
  "https://en.wikipedia.org/wiki/B%C5%8Dkun_Habanero",
  "https://en.wikipedia.org/wiki/Teddy_Fresh",
] as const;

const OVERSEAS_RAW = [
  "https://m.bunjang.co.kr/keywords/hUG",
  "https://www.giglio.com/en-us/bobo-choses/",
  "https://en.wikipedia.org/wiki/David_Horvath",
  "https://bobochoses.com/en-de/products/b226ac009-hug-hairy-monster-t-shirt",
  "https://bobochoses.com/en-us/",
  "https://en.wikipedia.org/wiki/YooHoo_%26_Friends",
  "https://bobochoses.com/en-uk/products/b226ac028-hug-hairy-monster-sweatshirt",
  "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
  "https://en.wikipedia.org/wiki/Paboo_%26_Mojies",
  "https://en.wikipedia.org/wiki/Big_Huggin%27",
] as const;

const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");

interface Stage {
  label: string;
  rawUrls: number;
  productShape: number;
  accepted: number;
  usable: number;
  miInput: number;
  same: number;
  priced: number;
  domesticSame: number;
}

describe("WU-155 — AI Search 공급 단계별 숫자(국내 ↔ 해외)", () => {
  it.runIf(LIVE)("최초로 갈라지는 행을 찾는다", async () => {
    /* eslint-disable no-console */
    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
    const query = {
      title: dna.title,
      brand: dna.brand.value || undefined,
      sourceUrl: dna.sourceUrl,
      sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
      searchTerm: terms[0] ?? dna.title,
      searchTerms: terms,
      facts: productFactsFromIdentityDna(dna),
    };

    async function run(label: string, raw: readonly string[]): Promise<Stage> {
      const productShape = raw.filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE").length;
      const pool = await collectUrlCandidatePool({
        urls: [...raw],
        originUrl: dna.sourceUrl,
        maxUrls: raw.length,
        existingCanonicalUrls: new Set<string>(),
        shopId: REVIEWED_SAME_SHOP_ID,
        shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
      });
      const rows: GeminiTransientRow[] = [];
      let miInput = 0;
      for (const res of pool.searchResults) {
        if (res.status !== "ok" || res.candidates.length === 0) continue;
        const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
        const scored = withConfidence(query, notSelf);
        miInput += scored.length;
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
        if (j.kind !== "JUDGED") continue;
        const m = classifyCandidateMarket({
          domain: res.domain,
          currency: j.best.price?.currency ?? null,
          isRegisteredDomesticShop: false,
        });
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
          market: m.market,
          basis: m.basis,
        } as GeminiTransientRow);
      }
      const judgement = buildMarketJudgement(rows);
      const sameRows = rows.filter((r) => domesticMatchDisplay(r.matchTruth as never).tier === "SAME");
      console.log(`\n── ${label} 후보 상세 ──`);
      for (const r of rows) {
        console.log(
          `   ${r.domain.padEnd(26)} tier=${String(domesticMatchDisplay(r.matchTruth as never).tier).padEnd(14)}` +
            ` market=${String(r.market).padEnd(9)} price=${r.priceAmount != null ? `${r.priceCurrency} ${r.priceAmount}` : "-"}`,
        );
      }
      void judgement;
      return {
        label,
        rawUrls: raw.length,
        productShape,
        accepted: pool.metrics.acceptedUrls,
        usable: pool.metrics.usableProductUrls,
        miInput,
        same: sameRows.length,
        priced: sameRows.filter((r) => isPriceConfirmed(r)).length,
        domesticSame: sameRows.filter((r) => r.market === "KR").length,
      };
    }

    const kr = await run("🇰🇷 국내", DOMESTIC_RAW);
    const os = await run("🌎 해외", OVERSEAS_RAW);

    const ROWS: [string, (s: Stage) => number][] = [
      ["AI Search raw URL", (s) => s.rawUrls],
      ["① URL 모양 PRODUCT_PAGE", (s) => s.productShape],
      ["② accepted(풀 진입)", (s) => s.accepted],
      ["③ usable(fetch 성공)", (s) => s.usable],
      ["④ MI 입력", (s) => s.miInput],
      ["⑤ SAME", (s) => s.same],
      ["⑥ 가격 확인된 SAME", (s) => s.priced],
      ["⑦ 그중 🇰🇷 국내", (s) => s.domesticSame],
    ];
    console.log("\n══════ 🔴 WU-155 단계별 숫자 ══════");
    console.log(`  ${"단계".padEnd(26)} ${"국내".padStart(6)} ${"해외".padStart(6)}`);
    let firstDiverge: string | null = null;
    for (const [label, f] of ROWS) {
      const a = f(kr);
      const b = f(os);
      const mark = a === b ? " " : "🔴";
      if (firstDiverge === null && a !== b) firstDiverge = label;
      console.log(`  ${mark} ${label.padEnd(24)} ${String(a).padStart(6)} ${String(b).padStart(6)}`);
    }
    console.log(`\n  🔴🔴 **최초 divergence** = ${firstDiverge ?? "(없음 — 전 행이 같다)"}`);
    console.log(
      "\n  🔴 AI 단계에서 후보를 줄이지 않았다 — 돌려준 링크를 **전부** 넣었다(위키백과 포함).",
    );

    /** 🔴 이 테스트는 **측정** 이다 — 숫자를 단언해 고정하지 않는다(값이 바뀌면 다시 잰다). */
    expect(kr.rawUrls).toBeGreaterThan(0);
    expect(os.rawUrls).toBeGreaterThan(0);
  }, 900_000);
});
