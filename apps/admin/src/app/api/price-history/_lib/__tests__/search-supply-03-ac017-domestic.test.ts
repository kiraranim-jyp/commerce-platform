import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-SUPPLY-03 — **국내 후보가 «후단에서» 탈락하는가**(CPO ③④)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 B226AC017 의 **실제 국내 판매처 3곳** 을 웹에서 확인해 줬다.
 * 🔴 그러면 남은 질문은 둘 중 하나다:
 * ```
 * B  검색이 그 URL 을 **안 준다**            → Search relevance
 * C  검색엔 있었는데 **후단에서 탈락한다**    → Crawl / Identity / market 분류
 * ```
 * 🟢 **C 는 검색 없이 판정할 수 있다** — 그 URL 을 운영 후단에 **그대로** 넣으면 된다
 *    (검색 과금 **0**). 🔴 그래서 이 하니스는 **C 만** 답한다. B 는 라이브 1회가 필요하다.
 *
 * 🔴 운영 호출 순서를 그대로 베낀다(§5-B) — pool → self 제외 → withConfidence
 *    → 가격보강 → judgeDomesticCandidate → classifyCandidateMarket.
 * 🔴 게이트 `AC017_DOMESTIC=1` 없으면 SKIP(회귀에서 외부 HTTP 금지).
 */
const LIVE = process.env.AC017_DOMESTIC === "1";
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac017-booo-bo-choses-t-shirt";

/** 🔴 **CPO 가 준 실제 URL 이다** — 내가 지어내지 않았다. */
const DOMESTIC_URLS = [
  "https://m.web.mustit.co.kr/v2/m/product/product_detail/126649154",
  "https://jente.firstmall.kr/goods/view?index=11&no=2772441&object_id=personalization",
  "https://stores.auction.co.kr/youdamin/List?Category=32040000&CategoryType=General&Page=1",
];

const pad = (s: unknown, n: number) => String(s) + " ".repeat(Math.max(0, n - String(s).length));

describe("SEARCH-SUPPLY-03 — B226AC017 국내 URL 후단 통과 여부", () => {
  it.runIf(LIVE)("🔎 국내 3곳을 운영 후단에 그대로 넣어 어디서 죽는지 본다", async () => {
    const { shopifySiteStrategy } = await import("@commerce/crawler/src/site-strategies/shopify.site-strategy");
    const {
      enrichCandidatePrices,
      fetchDomesticModelCode,
      isSelfReferenceCandidate,
      withConfidence,
    } = await import("@commerce/crawler");
    const { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } = await import(
      "@commerce/shared"
    );
    const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
    const { priceTierFromLink } = await import("../../../domestic-price-sources/_lib/domestic-product-link");
    const { classifyCandidateMarket } = await import("../candidate-market");
    const { judgeDomesticCandidate } = await import("../run-domestic-price-check");
    const { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } = await import("../transient-candidates");
    const { collectUrlCandidatePool } = await import("../url-candidate-pool");

    const extracted = await shopifySiteStrategy.extract(ORIGIN);
    const product = buildCanonicalProduct(ORIGIN, extracted!.productData as never, {} as never, []);
    const dna = buildProductIdentityDna(product);
    const terms = buildCrossSellerSearchQueries(dna);
    const query = {
      title: dna.title,
      brand: dna.brand.value || undefined,
      sourceUrl: dna.sourceUrl,
      sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
      searchTerm: terms[0] ?? dna.title,
      searchTerms: terms,
      facts: productFactsFromIdentityDna(dna),
    };
    /* eslint-disable no-console */
    console.log(`\n[origin] brand="${dna.brand.value}" code=${dna.brandModelCode} color=${dna.color}`);

    /* ① 입력 경계 + Crawl — 운영 pool 그대로 */
    const pool = await collectUrlCandidatePool({
      urls: DOMESTIC_URLS,
      originUrl: ORIGIN,
      maxUrls: DOMESTIC_URLS.length,
      existingCanonicalUrls: new Set<string>(),
      shopId: REVIEWED_SAME_SHOP_ID,
      shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
    } as never);
    console.log(`[② pool] ${JSON.stringify(pool.metrics)}`);

    /* ② Identity → market — 운영 순서 그대로 */
    console.log("\n──── 국내 URL 한 행씩 ────");
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) {
        console.log(`[row] ${pad(res.domain, 28)} status=${res.status} candidates=${res.candidates?.length ?? 0}`);
        continue;
      }
      const notSelf = res.candidates.filter((c) => !isSelfReferenceCandidate(ORIGIN, c.url));
      const scored = withConfidence(query as never, notSelf);
      let priced = scored;
      try {
        priced = await enrichCandidatePrices(scored, res.domain, query as never);
      } catch {
        /* 운영과 같다 */
      }
      const j = await judgeDomesticCandidate({
        domain: res.domain,
        candidates: priced,
        sourceUrl: ORIGIN,
        foreignModelCode: dna.brandModelCode,
        foreignColor: dna.color,
        fetchModelCode: (u: string) => fetchDomesticModelCode(res.domain, u),
      } as never);
      for (const c of priced) {
        const isBest = j.kind === "JUDGED" && j.best.url === c.url;
        const tier = isBest ? priceTierFromLink({ matchTruth: j.matchTruth, verified: j.verified }) : null;
        const market = isBest
          ? classifyCandidateMarket({
              domain: res.domain,
              currency: j.best.price?.currency ?? null,
              isRegisteredDomesticShop: false,
            })
          : null;
        console.log(
          `[row] ${pad(res.domain, 28)} v=${pad(c.crossSellerVerdict ?? "-", 14)}` +
            ` ${pad(j.kind, 9)}${j.kind === "DROPPED" ? `(${j.gate})` : ""}` +
            ` best=${isBest ? "Y" : "n"} truth=${pad(isBest ? j.matchTruth : "-", 20)}` +
            ` tier=${pad(tier ?? "-", 11)} ${String(c.price?.amount ?? "-")} ${c.price?.currency ?? ""}` +
            ` mk=${market?.market ?? "-"}/${market?.basis ?? "-"}`,
        );
        console.log(`      "${String(c.title ?? "").slice(0, 80)}"  blk=${JSON.stringify(c.crossSellerBlockers ?? [])}`);
      }
    }

    /** 🔴 전건 0 이면 「국내가 없다」가 아니라 **측정불가** 다. */
    expect(pool.metrics.suppliedUrls).toBe(DOMESTIC_URLS.length);
  }, 600_000);
});
