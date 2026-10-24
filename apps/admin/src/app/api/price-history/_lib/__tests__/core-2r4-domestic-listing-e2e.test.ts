import { describe, expect, it } from "vitest";
import {
  canonicalizeProductUrl,
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  lookupBrandAlias,
  withConfidence,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { buildProductIdentityDna, productFactsFromIdentityDna, buildCrossSellerSearchQueries } from "@commerce/shared";
import { computeSellability, summarizeDomesticMarketSplit, type PriceObservationRecord } from "@commerce/pricing";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { collectDomesticListingUrls } from "../domestic-listing-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { DOMESTIC_LISTING_SHOP_ID, DOMESTIC_LISTING_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import {
  buildMarketJudgement,
  buildPriceGuide,
  domesticBandText,
  domesticPriceBand,
} from "../../../../pipeline/commerce/mi-same-candidates";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2R-4 — **운영 함수로 «A 단계 → 화면 축 / MI 축» 까지 끝까지 잰다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **하니스 PASS 를 `E2E PASS` 로 적지 않는다**(CPO 명시 · 직전 WU 에서 틀린 자리).
 *    CTO 는 로그인 뒤 셀러 화면을 볼 수 없다 ⟹ 여기서 재는 것은 **운영 함수의 산출** 이고
 *    `Production UI PASS` 는 **CEO 확인 1회로만** 닫힌다.
 * 🔴 운영 호출 **순서를 그대로 베낀다**(§5-B) — 하나라도 빠뜨리면 숫자가 거짓이 된다:
 *    pool → collectUrlCandidatePool → isSelfReference → withConfidence →
 *    enrichCandidatePrices → judgeDomesticCandidate → classifyCandidateMarket →
 *    priceTierFromLink → (화면) buildMarketJudgement / (MI) summarizeDomesticMarketSplit
 * 🔴 게이트 `CORE2R4_LIVE=1` 없으면 SKIP.
 */
const LIVE = process.env.CORE2R4_LIVE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/**
 * 🔴 **운영 등록부를 로컬에서 읽을 수 없다**(`listDomesticPriceSources` 가
 *    service-role 키를 요구한다 · 메모 `production-secrets-are-write-only`).
 *    🟢 그래서 **DB 실측값과 같은 두 행** 을 손으로 재현한다 — 값은 030 시드와
 *       080 migration 에 적힌 그대로이고 **지어내지 않았다**.
 */
const SITES = [
  { domain: "donokids.com", entryUrl: "https://www.donokids.com" },
  { domain: "miniboutique.co.kr", entryUrl: "https://miniboutique.co.kr" },
];
/** 🔴 `registeredDomains` 재현 — 080 으로 `donokids.com` 이 **실제로** 들어가 있다. */
const REGISTERED = new Set([
  "looxloo.com",
  "bobochoses.com",
  "rulii.co.kr",
  "skysport.co.kr",
  "deuxbebe.com",
  "littleluna.co.kr",
  "chocoel.co.kr",
  "foretforet.com",
  "donokids.com",
]);

describe("CORE-2R-4 — 국내 목록 탐색 → MI → 가격 축(실측)", () => {
  it.runIf(LIVE)("등록부 진입점만으로 국내 상세 URL → 가격 → 두 축", async () => {
    /* eslint-disable no-console */
    console.log("\n════════ 🔴 CORE-2R-4 운영 경로 실측 ════════");

    /** ── ① 원상품(운영 추출 경로). 🔴 brand 복구는 간헐 실패가 있어 재시도한다. */
    let ex = await shopifySiteStrategy.extract(ORIGIN);
    const siteBrandOf = (r: typeof ex) =>
      String((r?.productData as Record<string, unknown> | undefined)?.siteBrandName ?? "");
    let tries = 1;
    while (!siteBrandOf(ex) && tries < 3) {
      await new Promise((r) => setTimeout(r, 20_000));
      ex = await shopifySiteStrategy.extract(ORIGIN);
      tries += 1;
    }
    expect(ex).not.toBeNull();
    let product = buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []);
    let dna = buildProductIdentityDna(product);
    if (!dna.brand.value) {
      const html = await fetchPlainHtml(ORIGIN.replace("/ko-kr/", "/"));
      const site = html ? extractSiteBrandName(html) : null;
      if (site) {
        product = buildCanonicalProduct(
          ORIGIN,
          { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
          {} as Record<string, ProductDataSource>,
          [],
        );
        dna = buildProductIdentityDna(product);
      }
    }
    console.log(`① 원상품 brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode}`);
    /** 🔴 brand 가 비면 brandTerms 가 비고 목록 탐색이 **구조적으로 0** 이다 — 측정 거부. */
    expect(dna.brand.value, "🔴 brand 복구 실패 — 열화된 숫자를 보고하지 않는다").toBeTruthy();

    /** ── ② STEP 2 — 등록부 진입점 → 목록 → 상세 URL. */
    const brandTerms = [dna.brand.value, lookupBrandAlias(dna.brand.value)].filter(
      (t): t is string => typeof t === "string" && t.trim().length > 0,
    );
    const pool = await collectDomesticListingUrls({ sites: SITES, code: dna.brandModelCode, brandTerms });
    console.log(`\n② 목록 탐색 — brandTerms=${JSON.stringify(brandTerms)} · HTTP ${pool.metrics.httpCalls} · provider ${pool.metrics.providerCalls}`);
    for (const o of pool.metrics.outcomes) {
      console.log(`   ${o.domain.padEnd(20)} robots=${o.robotsAllowed} source=${String(o.source).padEnd(14)} urls=${o.detailUrls.length} ${o.note ?? ""}`);
    }
    console.log(`   → 상세 URL **${pool.urls.length}건**`);
    for (const u of pool.urls) console.log(`      ${u.slice(0, 120)}`);

    /** ── ③ 후보 생성 — 운영이 쓰는 **그 함수** 에 일시 shopId 만 달아 넘긴다. */
    const candidates = await collectUrlCandidatePool({
      urls: pool.urls,
      originUrl: dna.sourceUrl,
      maxUrls: 10,
      existingCanonicalUrls: new Set<string>(),
      shopId: DOMESTIC_LISTING_SHOP_ID,
      shopNamePrefix: DOMESTIC_LISTING_SHOP_NAME,
    });
    console.log(
      `\n③ 후보 — accepted ${candidates.metrics.acceptedUrls} · usable ${candidates.metrics.usableProductUrls} · ` +
        `miEligible ${candidates.metrics.miEligibleCandidates} · fetch ${candidates.metrics.fetchCalls}`,
    );
    for (const d of candidates.metrics.dropped) console.log(`   🔴 탈락 ${d.reason} ${d.url.slice(0, 90)}`);

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

    /** ── ④⑤ 운영 순서 그대로 판정 → 시장 → tier. */
    const rows: GeminiTransientRow[] = [];
    const exactRecords: PriceObservationRecord[] = [];
    const comparisonRecords: PriceObservationRecord[] = [];
    console.log("\n④ MI 판정 · 시장 · tier");
    for (const res of candidates.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
      if (notSelf.length === 0) continue;
      const scored = withConfidence(query, notSelf);
      let priced = scored;
      try {
        priced = await enrichCandidatePrices(scored, res.domain, query);
      } catch {
        /* 운영과 같다(fail-soft) */
      }
      const j = await judgeDomesticCandidate({
        domain: res.domain,
        candidates: priced,
        sourceUrl: query.sourceUrl,
        foreignModelCode: dna.brandModelCode,
        foreignColor: dna.color,
        fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u),
      });
      if (j.kind !== "JUDGED") {
        console.log(`   ${res.domain.padEnd(20)} ${j.kind}`);
        continue;
      }
      const best = j.best;
      const tierLabel = domesticMatchDisplay(j.matchTruth as never).tier;
      /** 🟢 **운영 owner 를 그대로 부른다** — 복제 계산 금지. */
      const priceTier = priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified });
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: best.price?.currency ?? null,
        isRegisteredDomesticShop: REGISTERED.has(res.domain),
        marketEvidence: best.marketEvidence ?? null,
      });
      /** 🔴🔴 **반사실 — 등록부 행을 빼면 어떻게 되는가**(「등록부가 이유가 되면 안 된다」). */
      const mkNoRegistry = classifyCandidateMarket({
        domain: res.domain,
        currency: best.price?.currency ?? null,
        isRegisteredDomesticShop: false,
        marketEvidence: best.marketEvidence ?? null,
      });
      console.log(
        `   ${res.domain.padEnd(20)} tier=${String(tierLabel).padEnd(14)} priceTier=${String(priceTier).padEnd(11)} ` +
          `${best.price?.amount ?? "-"} ${best.price?.currency ?? ""} ${best.priceStatus ?? "-"}`,
      );
      console.log(`      market=${mk.market}(${mk.basis}) · 등록부 제거 시 ⟹ ${mkNoRegistry.market}(${mkNoRegistry.basis})`);
      console.log(`      marketEvidence=${JSON.stringify(best.marketEvidence ?? null)}`);
      if (tierLabel !== "SAME") {
        console.log(`      🔴 blockers=${JSON.stringify(best.crossSellerBlockers ?? [])} conflicts=${JSON.stringify(best.crossSellerConflicts ?? [])}`);
      }
      rows.push({
        domain: res.domain,
        discoveredUrl: best.url,
        title: best.title ?? null,
        priceAmount: best.price?.amount ?? null,
        priceCurrency: best.price?.currency ?? null,
        priceStatus: best.priceStatus ?? null,
        market: mk.market,
        soldOut: best.soldOut ?? null,
        matchTruth: String(j.matchTruth),
        crossSellerVerdict: best.crossSellerVerdict ?? null,
      });
      /** 🔴 **운영 적재 조건 그대로** — KR + VERIFIED_CURRENT KRW + tier EXACT|COMPARISON. */
      const priceKrw =
        best.priceStatus === "VERIFIED_CURRENT" && best.price?.currency === "KRW" ? best.price.amount : null;
      if (mk.market === "KR" && priceKrw != null) {
        const rec: PriceObservationRecord = {
          id: `listing-transient:${res.domain}`,
          snapshotId: "live",
          source: "DOMESTIC_SHOP",
          sourceLabel: res.domain,
          sourceProductUrl: best.url,
          sourceRefId: null,
          currency: "KRW",
          priceAmount: best.price?.amount ?? null,
          shippingCostAmount: null,
          taxAmount: null,
          exchangeRate: null,
          priceKrw,
          salePriceKrw: null,
          originalPriceKrw: null,
          soldOut: null,
          marketCode: null,
          marketCountry: null,
          shippingPolicyStatus: null,
          shippingPolicyNote: null,
          checkedAt: new Date().toISOString(),
        };
        if (priceTier === "EXACT") exactRecords.push(rec);
        else if (priceTier === "COMPARISON") comparisonRecords.push(rec);
      }
    }

    /** ── ⑥ 화면 축(셀러가 보는 🇰🇷) — 🔴 `SAME` 만 받는다. */
    const kr = buildPriceGuide(buildMarketJudgement(rows), "KR");
    const band = domesticPriceBand(kr);
    console.log("\n⑥ 🇰🇷 화면 축(buildPriceGuide · SAME 만)");
    console.log(`   동일상품 ${kr.sameCount} · 판매중 ${kr.onSaleCount} · 가격확인 ${kr.pricedCount} · 미확인 ${kr.unpricedCount}`);
    console.log(`   byCurrency ${JSON.stringify(kr.byCurrency)} · band=${band.kind} → ${JSON.stringify(domesticBandText(band))}`);

    /** ── ⑦ MI 축(`computeSellability` 입력) — 🔴 `exact` 만 받는다. */
    const split = summarizeDomesticMarketSplit(exactRecords, comparisonRecords);
    const sellability = computeSellability({
      costPriceKrw: null,
      domestic: { matched: split.exact.sellerCount > 0, averagePriceKrw: split.exact.averagePriceKrw },
    });
    console.log("\n⑦ MI 축(summarizeDomesticMarketSplit → computeSellability)");
    console.log(`   exact ${split.exact.sellerCount}곳 avg=${split.exact.averagePriceKrw} · comparison ${split.comparison.sellerCount}곳 avg=${split.comparison.averagePriceKrw} · basis=${split.basis}`);
    console.log(`   resolved ${split.resolved.sellerCount}곳 avg=${split.resolved.averagePriceKrw} · sellability=${sellability.level}`);
    console.log(`   🔴 costPriceKrw=null 이라 UNKNOWN 이 **정상** 이다(원가/마진 시스템을 만드는 일이 아니다)`);

    /** ── ⑧ 중복 — 같은 상품 URL 이 두 번 들어가지 않았는가. */
    const keys = rows.map((r) => canonicalizeProductUrl(r.discoveredUrl).toLowerCase());
    console.log(`\n⑧ 후보 ${rows.length}건 · 고유 URL ${new Set(keys).size}건`);
    expect(new Set(keys).size).toBe(rows.length);
  }, 1_800_000);
});
