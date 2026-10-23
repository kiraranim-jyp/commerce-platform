import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { GEMINI_VIRTUAL_SHOP_ID, GEMINI_VIRTUAL_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import {
  buildMarketJudgement,
  buildPriceGuide,
  domesticBandText,
  domesticPriceBand,
  marketPriceHeadline,
  marketPriceHeadlineLabel,
} from "../../../../pipeline/commerce/mi-same-candidates";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";
import { expandDomesticListing, LISTING_LINK_LIMIT, pickDetailUrlsForCode, robotsAllowsAll } from "../domestic-listing-hop";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2F — **국내 상세 상품 URL 1-hop 공급**(실측)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「AI Search 가 **국내 가격 증거가 존재하는 판매처** 를 발견했을 때,
 * 브랜드 목록/검색 결과 페이지에서 **실제 상품 상세 URL 까지 확보** 하여 기존 Pipeline 에
 * 넣을 수 있게 한다」 · 「새 검색 API 를 만들지 않는다」 ·
 * 「🔴 **「국내 사이트니까 KRW 로 간주」 같은 우회는 절대 금지**」.
 *
 * ── 🟢🟢 robots 를 **먼저** 확인했다(WU-154 의 보몽드 선례) ────────────────
 * ```
 * `donokids.com`        → **`Allow: /`**(`/makeshop/` 만 금지)        🟢 허용
 * `miniboutique.co.kr`  → 관리·주문·`search.html` 만 금지 · 상품/목록 🟢 허용
 * 🔴 그래서 **`search.html` 경로는 쓰지 않는다** — 1순위(목록/sitemap → 상세)로 간다
 * 🔴 보몽드(`Disallow: /`)는 **건드리지 않는다**(WU-154 가 폐기한 그 축)
 * ```
 *
 * ── 🔴 URL 을 «지어내지» 않는다 ───────────────────────────────────────────
 * ```
 * 🟢 상세 URL 의 출처는 **그 사이트가 스스로 내놓은 링크** 둘뿐이다:
 *      ⒜ 공식 `sitemap.xml`(sitemaps.org 표준)
 *      ⒝ 목록 페이지 HTML 의 실제 `href`
 * 🔴 경로를 **추측해 만들지 않는다** · 🔴 샵 내부 검색을 **구현하지 않는다**
 * ```
 *
 * 🔴 MI/SAME/threshold/가격 로직 **0** · Gemini/OpenAI/Naver/유료API **0** ·
 *    Adapter/Registry **0** · Seller URL 입력 **0** · bookmarklet 요구 **0**.
 * 🔴 게이트 `CORE2F_LIVE=1` 없으면 SKIP(실제 HTTP).
 */
const LIVE = process.env.CORE2F_LIVE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const CODE = "B226AC009";

/**
 * 🔴 **AI Search 가 실제로 돌려준 국내 판매처 진입점** — 목록/브랜드 URL 이다.
 *    (CORE-2/2E 검색 결과 원문 · 🔴 지어낸 것 0)
 */
const ENTRY_POINTS = [
  "https://www.donokids.com/shop/shopbrand.html?xcode=058&type=X",
  "https://miniboutique.co.kr/",
];

const REGISTRY = new Set([
  "looxloo.com",
  "bobochoses.com",
  "rulii.co.kr",
  "skysport.co.kr",
  "deuxbebe.com",
  "littleluna.co.kr",
  "chocoel.co.kr",
  "foretforet.com",
]);

describe("CORE-2F — 국내 1-hop 상세 URL 공급", () => {
  it.runIf(LIVE)("목록/sitemap → 상세 URL → 기존 pipeline → 국내 가격", async () => {
    /* eslint-disable no-console */
    console.log("\n════════ 🔴 CORE-2F — 국내 상세 URL 1-hop ════════");

    /** ── ① 1-hop 확장 — 🔴 각 진입점에서 **그 사이트가 내놓은 링크만** 모은다. */
    const found: { entry: string; host: string; detail: string[]; source: string; httpCalls: number }[] = [];
    for (const entry of ENTRY_POINTS) {
      const r = await expandDomesticListing(entry, CODE);
      found.push({ entry, host: r.host, detail: r.detailUrls, source: r.source, httpCalls: r.httpCalls });
      console.log(`\n  ── ${r.host} (${r.source} · HTTP ${r.httpCalls}회) ──`);
      console.log(`    robots 허용 ${r.robotsAllowed ? "🟢" : "🔴"} · 링크 ${r.linkCount} → 품번 일치 **${r.detailUrls.length}**`);
      for (const u of r.detailUrls.slice(0, 5)) console.log(`      🇰🇷 ${u}`);
      if (r.note) console.log(`    🔴 ${r.note}`);
    }

    const detailUrls = [...new Set(found.flatMap((f) => f.detail))];
    console.log(`\n  ① 1-hop 산출 — 고유 국내 상세 URL **${detailUrls.length}건**`);
    for (const u of detailUrls) console.log(`    shape=${classifyUrlShape(u)} ${u}`);

    /** ── ② 원상품(brand 확보) — 🔴 비면 MI 가 전건 BRAND_UNCONFIRMED 다. */
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
    let product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
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
    console.log(`\n  ② 원상품 brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode}`);
    expect(dna.brand.value, "🔴 brand 확보 실패 — 열화된 상태로 재지 않는다").toBeTruthy();

    if (detailUrls.length === 0) {
      console.log("\n  🔴🔴 1-hop 이 상세 URL 을 **0건** 냈다 ⟹ 막힌 단계는 **①** 이다(아래 note 참조)");
      expect(detailUrls).toBeDefined();
      return;
    }

    /** ── ③ 기존 pipeline — 🔴 새 경로를 만들지 않는다. */
    const pool = await collectUrlCandidatePool({
      urls: detailUrls,
      originUrl: dna.sourceUrl,
      maxUrls: Math.max(10, detailUrls.length),
      existingCanonicalUrls: new Set<string>(),
      shopId: GEMINI_VIRTUAL_SHOP_ID,
      shopNamePrefix: GEMINI_VIRTUAL_SHOP_NAME,
    });
    console.log(
      `\n  ③ Fetch/Extract — accepted ${pool.metrics.acceptedUrls} · usable ${pool.metrics.usableProductUrls} · ` +
        `miEligible ${pool.metrics.miEligibleCandidates}`,
    );
    for (const d of pool.metrics.dropped) console.log(`    🔴 탈락 ${d.reason} ${d.url.slice(0, 80)}`);

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

    const rows: GeminiTransientRow[] = [];
    console.log("\n  ④ Brand → MI → SAME → Price:");
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
      if (notSelf.length === 0) continue;
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
      if (j.kind !== "JUDGED") {
        console.log(`    ${res.domain.padEnd(24)} ${j.kind}`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      /** 🔴🔴 **「국내 사이트니까 KRW」 우회를 하지 않는다** — 운영 분류기를 그대로 부른다. */
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: REGISTRY.has(res.domain),
      });
      console.log(
        `    ${res.domain.padEnd(24)} tier=${String(tier).padEnd(14)} market=${String(mk.market).padEnd(8)} ` +
          `${j.best.price?.amount ?? "-"} ${j.best.price?.currency ?? ""} · basis=${mk.basis} · ${j.best.priceStatus ?? "-"}`,
      );
      /**
       * 🔴🔴 **SAME 이 아니면 «어느 축이 막는지» 를 적는다** — 「SAME 0」만 보고하면
       *    다음 사람이 공급을 다시 재게 된다(이 트랙에서 그 일이 세 번 났다).
       */
      if (tier !== "SAME") {
        console.log(`      🔴 verdict=${j.best.crossSellerVerdict ?? "-"} matchTruth=${j.matchTruth}`);
        console.log(`      🔴 blockers=${JSON.stringify(j.best.crossSellerBlockers ?? [])}`);
        console.log(`      🔴 conflicts=${JSON.stringify(j.best.crossSellerConflicts ?? [])}`);
        console.log(`      제목: ${JSON.stringify((j.best.title ?? "").slice(0, 70))}`);
      }
      rows.push({
        domain: res.domain,
        discoveredUrl: j.best.url,
        title: j.best.title ?? null,
        priceAmount: j.best.price?.amount ?? null,
        priceCurrency: j.best.price?.currency ?? null,
        priceStatus: j.best.priceStatus ?? null,
        market: mk.market,
        soldOut: j.best.soldOut ?? null,
        matchTruth: String(j.matchTruth),
        crossSellerVerdict: j.best.crossSellerVerdict ?? null,
      });
    }

    /** ── ⑤ 국내 가격대 — 🟢 기존 owner 가 만든다(새 계산 0). */
    const jg = buildMarketJudgement(rows);
    const kr = buildPriceGuide(jg, "KR");
    const band = domesticPriceBand(kr);
    console.log("\n  ⑤ 🇰🇷 국내 시장 가격대");
    console.log(`    SAME ${kr.sameCount} · 판매중 ${kr.onSaleCount} · 가격확인 ${kr.pricedCount} · 미확인 ${kr.unpricedCount}`);
    console.log(`    byCurrency ${JSON.stringify(kr.byCurrency)}`);
    console.log(`    band=**${band.kind}** → ${JSON.stringify(domesticBandText(band))}`);
    console.log(`    headline=${JSON.stringify(marketPriceHeadline(kr))} label=${JSON.stringify(marketPriceHeadlineLabel(kr))}`);

    const os = buildPriceGuide(jg, "OVERSEAS");
    console.log(`\n  (대조) 🌎 해외 — SAME ${os.sameCount} · 가격확인 ${os.pricedCount}`);
    console.log("\n  🔴 「국내 사이트니까 KRW 로 간주」 우회를 하지 않았다 — 분류는 운영 함수 산출이다.");
    expect(jg).toBeDefined();
  }, 1_500_000);
});

describe("CORE-2F 계약 — 1-hop 의 안전 경계(네트워크 0)", () => {
  it("A-1 🔴 품번이 **slug 에 있는** 링크만 고른다(추측 0)", () => {
    const links = [
      "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac009/28043/",
      "https://miniboutique.co.kr/product/bobo-chosesnadia-midi-skirt-green/8595/",
      "https://miniboutique.co.kr/category/bobo-choses/107/",
    ];
    expect(pickDetailUrlsForCode(links, "B226AC009")).toEqual([
      "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac009/28043/",
    ]);
  });

  it("A-2 🔴 대소문자를 가리지 않는다(사이트가 소문자로 적는다)", () => {
    expect(pickDetailUrlsForCode(["https://x/product/a-b226ac009/1/"], "b226ac009")).toHaveLength(1);
  });

  it("A-3 🔴 **품번이 없으면 아무것도 고르지 않는다** — 목록을 전부 넣지 않는다", () => {
    const links = Array.from({ length: 60 }, (_, i) => `https://x/product/p${i}/${i}/`);
    expect(pickDetailUrlsForCode(links, "B226AC009")).toEqual([]);
  });

  it("A-4 🔴 짧은 품번으로는 고르지 않는다(오탐 방지)", () => {
    expect(pickDetailUrlsForCode(["https://x/product/a-b22/1/"], "b22")).toEqual([]);
  });

  it("A-5 🔴 중복을 제거하고 상한을 지킨다", () => {
    const u = "https://x/product/a-b226ac009/1/";
    expect(pickDetailUrlsForCode([u, u, u], "B226AC009")).toEqual([u]);
    expect(LISTING_LINK_LIMIT).toBeGreaterThan(0);
  });

  /**
   * 🔴🔴🔴 **변이 M3(robots 전면금지 무시)가 «통과했다» — 그래서 이 계약을 추가했다.**
   *
   * 🔴 「통과」를 「잠겼다」로 읽지 않는다. 그 축은 이 WU 의 **가장 중요한 안전 경계** 다 —
   *    보몽드(`Disallow: /`)를 건드리지 않는 근거이고 WU-154 가 어댑터를 폐기한 이유다.
   */
  it("A-7 🔴🔴 `Disallow: /` 면 **전면 금지** 로 읽는다(보몽드를 건드리지 않는 근거)", () => {
    expect(robotsAllowsAll("User-agent: *\nDisallow: /")).toBe(false);
    expect(robotsAllowsAll("User-agent: *\nDisallow: /\nAllow: /public/")).toBe(false);
    /** 🟢 경로별 금지는 전면 금지가 **아니다**(미니부띠끄가 그 경우다). */
    expect(robotsAllowsAll("User-agent: *\nDisallow: /admin/\nDisallow: /search.html?*")).toBe(true);
    expect(robotsAllowsAll("User-agent: *\nAllow: /\nDisallow: /makeshop/")).toBe(true);
    /** 🔴 **다른 UA 블록의 전면 금지는 우리 것이 아니다** — `*` 블록만 본다. */
    expect(robotsAllowsAll("User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nAllow: /")).toBe(true);
    /** 🔴 주석·빈 줄에 속지 않는다. */
    expect(robotsAllowsAll("# note\nUser-agent: *\n\nDisallow: /  # all\n")).toBe(false);
  });

  it("A-6 🔴 비-HTTP·다른 호스트 섞임을 버리지 않는다(판정은 호출부가 한다)", () => {
    /** 🟢 이 함수는 **문자열 선별기** 다 — 호스트 정책은 호출부(`expandDomesticListing`)가 본다. */
    expect(pickDetailUrlsForCode(["javascript:void(0)", "https://y/product/b226ac009/2/"], "B226AC009")).toEqual([
      "https://y/product/b226ac009/2/",
    ]);
  });
});
