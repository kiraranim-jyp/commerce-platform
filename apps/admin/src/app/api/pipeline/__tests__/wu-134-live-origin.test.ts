import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { buildCanonicalProduct } from "../canonical-product";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";

/**
 * WU-134 — **실제 원상품에서 복구가 «발화하는가»** (게이트 없으면 SKIP)
 *
 * 🔴 게이트 `WU_134_PROBE=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 * 🔴🔴 **이 파일이 필요한 이유** — 순수 계약은 「조건이 맞으면 복구한다」까지만
 *    증명한다. Shopify 경로는 **HTML 을 아예 읽지 않으므로**(WU-079) 배선이
 *    없으면 `siteBrandName` 이 영원히 undefined 이고 복구는 **한 번도 돌지 않는다**.
 *    🔴 WU-110 에서 「판정 함수를 직접 부르는 테스트는 배선을 못 본다」로 당한 자리다.
 */
const LIVE = process.env.WU_134_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

describe("WU-134 — 실제 원상품 배선", () => {
  it.runIf(LIVE)("Shopify 전략이 거부된 brand 를 사이트 이름으로 복구한다", async () => {
    const r = await shopifySiteStrategy.extract(ORIGIN);
    expect(r).not.toBeNull();
    const pd = r!.productData as ExtractedProductData;
    /* eslint-disable no-console */
    console.log("LIVE brand(vendor) =", JSON.stringify(pd.brand), "| siteBrandName =", JSON.stringify(pd.siteBrandName));
    /** 🔴 전제 확인 — vendor 가 여전히 시즌코드다(사이트가 바뀌면 이 전제부터 깨진다). */
    expect(pd.brand).toBe("AW26");
    /** 🟢🟢 배선 증명 — 그 경로가 HTML 을 **조건부로** 받아 사이트 이름을 읽었다. */
    expect(pd.siteBrandName).toBe("Bobo Choses");

    const product = buildCanonicalProduct(ORIGIN, pd, {} as Record<string, ProductDataSource>, []);
    console.log("LIVE canonical brand =", JSON.stringify(product.brand));
    expect(product.brand.value).toBe("Bobo Choses");
    /** 🟢 거부 기록은 남는다 — 무슨 일이 있었는지 지우지 않는다. */
    expect(product.brandResolution?.raw).toBe("AW26");
  }, 180000);
});

/* ═══════ 실제 경로 E2E — 수정된 추출 → MI → 가격비교 (Positive + Negative) ═══════ */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { collectUrlCandidatePool } from "../../price-history/_lib/url-candidate-pool";
import { judgeDomesticCandidate } from "../../price-history/_lib/run-domestic-price-check";
import { priceTierFromLink } from "../../domestic-price-sources/_lib/domestic-product-link";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../../price-history/_lib/transient-candidates";
import { classifyCandidateMarket } from "../../price-history/_lib/candidate-market";
import { selectMiSameCandidates } from "../../../pipeline/commerce/mi-same-candidates";
import { domesticMatchDisplay } from "../../../pipeline/commerce/match-display";
import type { GeminiTransientRow } from "../../../pipeline/commerce/GeminiTransientCandidates";

const FIX = path.join(__dirname, "..", "..", "price-history", "_lib", "__tests__", "fixtures");
const OUTDIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const loose = (u: string) => String(u).trim().toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
const fx = <T>(f: string): T => JSON.parse(readFileSync(path.join(FIX, f), "utf8")) as T;

describe("WU-134 — 실제 경로 E2E (Positive + Negative)", () => {
  it.runIf(LIVE)("수정된 추출로 실제 human SAME 이 가격비교까지 간다", async () => {
    /* ① 원상품을 **실제 경로로 다시 추출** 한다(수정이 여기서 발화한다). */
    const r = await shopifySiteStrategy.extract(ORIGIN);
    const product = buildCanonicalProduct(ORIGIN, r!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []);
    const dna = buildProductIdentityDna(product);
    /* eslint-disable no-console */
    console.log(`E2E 원상품 brand=${JSON.stringify(dna.brand)} code=${dna.brandModelCode}`);
    expect(dna.brand.value).toBe("Bobo Choses");

    /* ② human 라벨 전수(SAME «그리고» DIFFERENT) */
    const CODE = "B226AC009";
    const seen = new Set<string>();
    const gt: { url: string; verdict: string }[] = [];
    const add = (u?: string, v?: string) => { if (!u || !v || seen.has(loose(u))) return; seen.add(loose(u)); gt.push({ url: u, verdict: v }); };
    for (const c of fx<{ candidates: { originCode: string; url: string; verdict: string }[] }>("wu-112-human-gt.json").candidates) if (c.originCode === CODE) add(c.url, c.verdict);
    for (const c of fx<{ candidates: { originCode: string; url: string; humanVerdict: string }[] }>("wu-111-human-gt.json").candidates) if (c.originCode === CODE) add(c.url, c.humanVerdict);
    for (const c of fx<{ candidates: { origin: string; url: string; human: string }[] }>("wu-125-human-gt.json").candidates) if (c.origin === CODE) add(c.url, c.human);
    const human = new Map(gt.map((g) => [loose(g.url), g.verdict]));
    console.log(`E2E GT ${gt.length}건 — SAME ${gt.filter((g) => g.verdict === "SAME").length} · DIFFERENT ${gt.filter((g) => g.verdict === "DIFFERENT").length}`);

    /* ③ 운영 순서 그대로 */
    const terms = buildCrossSellerSearchQueries(dna).filter(Boolean);
    const query = { title: dna.title, brand: dna.brand.value || undefined, sourceUrl: dna.sourceUrl,
      sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
      searchTerm: terms[0] ?? dna.title, searchTerms: terms, facts: productFactsFromIdentityDna(dna) };
    const pool = await collectUrlCandidatePool({ urls: gt.map((g) => g.url), originUrl: dna.sourceUrl,
      maxUrls: gt.length, existingCanonicalUrls: new Set<string>(), shopId: REVIEWED_SAME_SHOP_ID, shopNamePrefix: REVIEWED_SAME_SHOP_NAME });
    console.log(`E2E pool — usable ${pool.metrics.usableProductUrls}/${gt.length}`);
    expect(pool.metrics.usableProductUrls, "열화된 실행 — 재실행 필요").toBeGreaterThan(gt.length / 2);

    const rows: GeminiTransientRow[] = [];
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(query.sourceUrl, c.url));
      const scored = withConfidence(query, notSelf);
      let priced = scored;
      try { priced = await enrichCandidatePrices(scored, res.domain, query); } catch { /* 운영과 같다 */ }
      const j = await judgeDomesticCandidate({ domain: res.domain, candidates: priced, sourceUrl: query.sourceUrl,
        foreignModelCode: dna.brandModelCode, foreignColor: dna.color, fetchModelCode: (u) => fetchDomesticModelCode(res.domain, u) });
      if (j.kind !== "JUDGED") continue;
      const m = classifyCandidateMarket({ domain: res.domain, currency: j.best.price?.currency ?? null, isRegisteredDomesticShop: false });
      rows.push({ source: "REVIEWED_SAME", domain: res.domain, title: j.best.title, imageUrl: j.best.imageUrl ?? null,
        soldOut: j.best.soldOut ?? null, discoveredUrl: j.best.url, matchTruth: j.matchTruth,
        priceTier: priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified }),
        crossSellerVerdict: j.best.crossSellerVerdict ?? null, confidence: j.best.confidence ?? null,
        matchReasons: j.best.matchReasons ?? [], crossSellerBlockers: (j.best.crossSellerBlockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)),
        crossSellerConflicts: (j.best.crossSellerConflicts ?? []).map((c) => (typeof c === "string" ? c : c.conflict)),
        priceAmount: j.best.price?.amount ?? null, priceCurrency: j.best.price?.currency ?? null,
        priceStatus: j.best.priceStatus ?? null, market: m.market, basis: m.basis });
    }

    /* ④ 가격비교까지 */
    const kr = selectMiSameCandidates(rows, "KR");
    const os = selectMiSameCandidates(rows, "OVERSEAS");
    const priced = [...kr.priced, ...os.priced];
    const tierOf = (x: GeminiTransientRow) => (x.matchTruth ? domesticMatchDisplay(x.matchTruth as never).tier : null);
    const sameRows = rows.filter((x) => tierOf(x) === "SAME");
    const trueSAME = sameRows.filter((x) => human.get(loose(x.discoveredUrl)) === "SAME").length;
    const falseSAME = sameRows.filter((x) => human.get(loose(x.discoveredUrl)) === "DIFFERENT").length;
    const diffRows = rows.filter((x) => human.get(loose(x.discoveredUrl)) === "DIFFERENT");

    console.log(`\nE2E 판정 ${rows.length}건 · displaySAME ${sameRows.length} · trueSAME ${trueSAME} · falseSAME ${falseSAME}`);
    console.log(`E2E 실제 DIFFERENT 방어 ${diffRows.filter((x) => tierOf(x) !== "SAME").length}/${diffRows.length}`);
    console.log(`E2E 📊 가격비교 — 국내 ${kr.priced.length} · 해외 ${os.priced.length}`);
    for (const p of priced) console.log(`   🟢 ${p.domain} ${p.priceCurrency} ${p.priceAmount} human=${human.get(loose(p.discoveredUrl)) ?? "(라벨없음)"}`);
    writeFileSync(path.join(OUTDIR, "wu-134-e2e.json"), JSON.stringify({ rows, priced, trueSAME, falseSAME }, null, 2), "utf8");

    /** 🟢🟢 **CPO 완료 기준** — 실제 human SAME 이 system SAME 으로 재현되고 가격비교까지 간다. */
    expect(trueSAME).toBeGreaterThan(0);
    expect(priced.length).toBeGreaterThan(0);
    /** 🔴🔴 **그리고 Negative 가 유지된다** — 이쪽이 더 중요하다(CPO §7). */
    expect(falseSAME).toBe(0);
    expect(diffRows.every((x) => tierOf(x) !== "SAME")).toBe(true);
  }, 1_800_000);
});
