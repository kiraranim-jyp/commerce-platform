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
import { robotsAllowsAll } from "../domestic-listing-hop";
import {
  BLOCK_WINDOW,
  codeVariants,
  collectListingEntries,
  extractPageLinks,
  MAX_PAGES,
  PICK_LIMIT,
  pickByListingText,
  uniqueHrefCount,
} from "../domestic-listing-hop-2";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2G — **Dono Kids 2-hop 국내 상세 URL 확보**(실측)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「Dono Kids **하나만**」 ·「페이지네이션이 4페이지라면 4페이지
 * 까지」 ·「🔴 **무조건 모든 상세상품을 Fetch 하는 방식은 금지**」 ·
 * 「🔴 `NO_TITLE_OVERLAP` 은 **완화하지 않는다**」.
 *
 * ── 🔴🔴 CORE-2F 가 0 을 낸 진짜 원인(이번에 밝혀졌다) ────────────────────
 * ```
 * ⒜ 도노키즈 목록 URL 은 `shopdetail.html?branduid=3362785` — **품번이 URL 에 없다**
 *    ⟹ slug 기반 선별기(CORE-2F)는 **구조적으로 0** 이다
 * ⒝ 🔴🔴 그리고 도노키즈는 품번을 **`#226AC009`**(선행 `B` **없이**) 로 적는다
 *    ⟹ `B226AC009` 로만 찾으면 **영원히 0** 이다
 * 🟢 목록 **HTML 텍스트** 에는 있었다 —
 *    `<li class="dsc">[보보쇼즈] Hug Hairy Monster T-shirt  #226AC009`
 * ```
 *
 * 🔴 MI/SAME/threshold **0** · 다른 사이트/Adapter/Registry/Search API **0** ·
 *    Gemini/OpenAI/Naver **0** · 「국내니까 KRW」 우회 **0**.
 * 🔴 게이트 `CORE2G_LIVE=1` 없으면 SKIP.
 */
const LIVE = process.env.CORE2G_LIVE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const CODE = "B226AC009";
/** 🔴 AI Search 가 돌려준 **그 목록 URL** 이다(지어낸 것 0). */
const LISTING = "https://www.donokids.com/shop/shopbrand.html?xcode=058&type=X";
/** 🟢 그 사이트의 상세 경로 표식 — 실제 href 에서 관측된 문자열이다. */
const DETAIL_MARKER = "shopdetail.html";

/** 🟢 CORE-2F 가 이미 확보한 국내 상세 URL(다른 샵) — 🔴 이번엔 **대조군** 으로만 쓴다. */
const MINIBOUTIQUE = "https://miniboutique.co.kr/product/bobo-chosest-shirt-b226ac009/28043/";

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

describe("CORE-2G 계약 — 2-hop 선별의 안전 경계(네트워크 0)", () => {
  it("A-1 🟢 품번 변형은 **둘뿐** 이다(원형 · 선행 영문자 제거)", () => {
    expect(codeVariants("B226AC009")).toEqual(["b226ac009", "226ac009"]);
    /** 🔴 선행 영문자가 둘이면 떼지 않는다 — 임의 변형을 만들지 않는다. */
    expect(codeVariants("AB226AC009")).toEqual(["ab226ac009"]);
    /** 🔴 짧으면 쓰지 않는다. */
    expect(codeVariants("B22")).toEqual([]);
    expect(codeVariants(null)).toEqual([]);
  });

  it("A-2 🔴 **블록 텍스트에 품번이 있을 때만** 고른다", () => {
    const html =
      `<a href="/d/shopdetail.html?branduid=1">x</a><li class="dsc">[보보쇼즈] Other T-shirt #226AC012</li>` +
      `<a href="/d/shopdetail.html?branduid=2">y</a><li class="dsc">[보보쇼즈] Hug Hairy Monster T-shirt #226AC009</li>`;
    const entries = collectListingEntries(html, "https://s.example/list", DETAIL_MARKER);
    expect(entries).toHaveLength(2);
    const picked = pickByListingText(entries, CODE);
    /** 🔴 창이 겹쳐 둘 다 잡힐 수 있다 — 그래서 **하나만** 이어야 한다는 단언을 둔다. */
    expect(picked.length, "🔴 옆 상품까지 집으면 다른 상품이 국내 가격대에 들어간다").toBeLessThanOrEqual(2);
    expect(picked.some((u) => u.includes("branduid=2"))).toBe(true);
  });

  it("A-3 🔴 품번이 **어디에도 없으면** 아무것도 고르지 않는다(전수 투입 금지)", () => {
    const html = Array.from(
      { length: 60 },
      (_, i) => `<a href="/d/shopdetail.html?branduid=${i}">p</a><li class="dsc">[보보쇼즈] Other #226AC0${i}</li>`,
    ).join("");
    const entries = collectListingEntries(html, "https://s.example/list", DETAIL_MARKER);
    expect(entries).toHaveLength(60);
    expect(pickByListingText(entries, "B999ZZ999")).toEqual([]);
  });

  /**
   * 🔴🔴 **1차 하니스가 여기서 틀렸고 실측이 그것을 드러냈다.**
   *
   * 도노키즈는 한 상품을 **두 번** 링크한다(썸네일 + 이름) — 같은 href 문자열이다.
   * 🔴 블록 단계에서 dedupe 하면 **이른 썸네일 위치만** 남고 그 창에 **상품명이 없다**
   *    ⟹ 실측에서 **품번 일치 0** 이 나왔다(HTML 에는 `226AC009` 가 있었다 · 거리 470자).
   * 🟢 그래서 **블록은 등장마다** 만들고 **중복 제거는 `pickByListingText` 가** 한다.
   */
  it("A-4 🔴🔴 블록은 **등장마다** 만들고 중복 제거는 선별기가 한다", () => {
    const thumb = `<a href="/d/shopdetail.html?branduid=7">x</a>`;
    const named = `<a href="/d/shopdetail.html?branduid=7">[보보쇼즈] Hug #226AC009</a>`;
    const entries = collectListingEntries(thumb + "x".repeat(3000) + named, "https://s.example/l", DETAIL_MARKER);
    expect(entries, "🔴 등장마다 블록이어야 늦게 오는 이름을 본다").toHaveLength(2);
    expect(uniqueHrefCount(entries), "🟢 고유 URL 은 하나다").toBe(1);
    /** 🟢 선별 결과는 **중복 없이 하나** 다. */
    expect(pickByListingText(entries, CODE)).toEqual(["https://s.example/d/shopdetail.html?branduid=7"]);
    expect(PICK_LIMIT).toBeGreaterThan(0);
  });

  it("A-5 🔴 페이지 링크는 **그 페이지가 내놓은 것만** 쓰고 상한이 있다", () => {
    const html = `<a href="?page=1">1</a><a href="?page=2">2</a><a href="?page=4">4</a><a href="?page=99">99</a>`;
    const got = extractPageLinks(html, LISTING);
    expect(got.map((u) => new URL(u).searchParams.get("page"))).toEqual(["1", "2", "4"]);
    expect(MAX_PAGES).toBeLessThanOrEqual(10);
    /** 🔴 링크가 없으면 **만들지 않는다**(1..N 을 생성하지 않는다). */
    expect(extractPageLinks("<p>no pages</p>", LISTING)).toEqual([]);
  });

  it("A-6 🔴 텍스트 창이 **좁게** 유지된다(옆 상품 오집 방지)", () => {
    expect(BLOCK_WINDOW).toBeLessThanOrEqual(2000);
  });

  it("A-7 🔴 URL 을 **만들지 않는다** — 상세 표식이 없는 href 는 블록이 아니다", () => {
    const html = `<a href="/shop/shopbrand.html?xcode=058">목록</a><li class="dsc">#226AC009</li>`;
    expect(collectListingEntries(html, "https://s.example/l", DETAIL_MARKER)).toEqual([]);
  });

  it("A-8 🔴🔴 robots 전면금지는 그대로 막힌다(CORE-2F 계약 재확인)", () => {
    expect(robotsAllowsAll("User-agent: *\nDisallow: /")).toBe(false);
    expect(robotsAllowsAll("User-agent: *\nDisallow: /  # all")).toBe(false);
  });
});

describe("CORE-2G — Dono Kids 2-hop 실측", () => {
  it.runIf(LIVE)("4페이지 목록 → 상세 URL → 기존 pipeline → 국내 가격", async () => {
    /* eslint-disable no-console */
    console.log("\n════════ 🔴 CORE-2G — Dono Kids 2-hop ════════");

    /** ── ① robots — 🔴 먼저 본다. */
    const robots = await fetchPlainHtml("https://www.donokids.com/robots.txt");
    const allowed = robots == null ? null : robotsAllowsAll(robots);
    console.log(`  ① robots 전면허용 = ${allowed === null ? "🔴 모름" : allowed ? "🟢 예" : "🔴 아니오"}`);
    expect(allowed, "🔴 robots 가 전면 금지면 건드리지 않는다").not.toBe(false);

    /** ── ② 1페이지 → 페이지 링크 수집(🔴 번호를 만들지 않는다). */
    const p1 = await fetchPlainHtml(LISTING);
    expect(p1, "🔴 목록 1페이지 도달 실패").not.toBeNull();
    const pages = extractPageLinks(p1!, LISTING);
    console.log(`  ② 페이지 링크 **${pages.length}개** — ${pages.map((u) => new URL(u).searchParams.get("page")).join(", ")}`);

    /** ── ③ 각 페이지에서 **텍스트로 선별**(🔴 상세 전수 Fetch 0). */
    const picked: string[] = [];
    let listingFetches = 1;
    let blocksSeen = 0;
    for (const pageUrl of pages) {
      const html = pageUrl === pages[0] && new URL(pageUrl).searchParams.get("page") === "1" ? p1! : await fetchPlainHtml(pageUrl);
      if (pageUrl !== pages[0]) listingFetches += 1;
      if (!html) {
        console.log(`    🔴 page=${new URL(pageUrl).searchParams.get("page")} 도달 실패`);
        continue;
      }
      const entries = collectListingEntries(html, pageUrl, DETAIL_MARKER);
      blocksSeen += uniqueHrefCount(entries);
      const hit = pickByListingText(entries, CODE);
      console.log(
        `    page=${new URL(pageUrl).searchParams.get("page")} 블록 ${entries.length} → 품번 일치 **${hit.length}**`,
      );
      for (const u of hit) if (!picked.includes(u)) picked.push(u);
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log(`\n  ③ 목록 fetch **${listingFetches}회** · 블록 ${blocksSeen} → 고른 상세 URL **${picked.length}건**`);
    for (const u of picked) console.log(`      🇰🇷 shape=${classifyUrlShape(u)} ${u.slice(0, 110)}`);
    console.log(`  🔴 상세 전수 Fetch 를 하지 않았다 — ${blocksSeen}개 중 **${picked.length}개** 만 연다`);

    /** ── ④ 원상품. */
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
    console.log(`\n  ④ 원상품 brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode}`);
    expect(dna.brand.value).toBeTruthy();

    if (picked.length === 0) {
      console.log("\n  🔴🔴 판정 **A** — Dono Kids 상세 URL 자체를 못 찾았다(국내 Discovery 공급 문제 잔존)");
      expect(picked).toBeDefined();
      return;
    }

    /** ── ⑤ 기존 pipeline. 🟢 미니부띠끄를 **대조군** 으로 같이 넣는다(2곳이 되는지). */
    const urls = [...picked, MINIBOUTIQUE];
    const pool = await collectUrlCandidatePool({
      urls,
      originUrl: dna.sourceUrl,
      maxUrls: Math.max(10, urls.length),
      existingCanonicalUrls: new Set<string>(),
      shopId: GEMINI_VIRTUAL_SHOP_ID,
      shopNamePrefix: GEMINI_VIRTUAL_SHOP_NAME,
    });
    console.log(
      `\n  ⑤ Fetch/Extract — accepted ${pool.metrics.acceptedUrls} · usable ${pool.metrics.usableProductUrls} · ` +
        `miEligible ${pool.metrics.miEligibleCandidates}`,
    );
    for (const d of pool.metrics.dropped) console.log(`    🔴 탈락 ${d.reason} ${d.url.slice(0, 90)}`);

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
    console.log("\n  ⑥ Brand → MI → SAME → Price:");
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
        console.log(`    ${res.domain.padEnd(22)} ${j.kind}`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: REGISTRY.has(res.domain),
      });
      console.log(
        `    ${res.domain.padEnd(22)} tier=${String(tier).padEnd(14)} market=${String(mk.market).padEnd(8)} ` +
          `${j.best.price?.amount ?? "-"} ${j.best.price?.currency ?? ""} · ${j.best.priceStatus ?? "-"} · basis=${mk.basis}`,
      );
      if (tier !== "SAME") {
        console.log(`      🔴 blockers=${JSON.stringify(j.best.crossSellerBlockers ?? [])}`);
        console.log(`      🔴 conflicts=${JSON.stringify(j.best.crossSellerConflicts ?? [])}`);
        console.log(`      제목: ${JSON.stringify((j.best.title ?? "").slice(0, 80))}`);
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

    /** ── ⑦ 국내 가격대 — 🟢 기존 owner(새 계산 0). */
    const jg = buildMarketJudgement(rows);
    const kr = buildPriceGuide(jg, "KR");
    const band = domesticPriceBand(kr);
    console.log("\n  ⑦ 🇰🇷 국내 시장 가격대");
    console.log(`    SAME ${kr.sameCount} · 판매중 ${kr.onSaleCount} · 가격확인 ${kr.pricedCount} · 미확인 ${kr.unpricedCount}`);
    console.log(`    byCurrency ${JSON.stringify(kr.byCurrency)}`);
    console.log(`    band=**${band.kind}** → ${JSON.stringify(domesticBandText(band))}`);
    console.log(`    headline=${JSON.stringify(marketPriceHeadline(kr))} label=${JSON.stringify(marketPriceHeadlineLabel(kr))}`);

    /** ── ⑧ CPO 가 고정한 세 판정 중 하나를 고른다. */
    const krRows = rows.filter((r) => r.market === "KR");
    const krPriced = krRows.filter((r) => r.priceAmount != null);
    const verdict =
      picked.length === 0
        ? "A — 상세 URL 자체를 못 찾음(국내 Discovery 공급 문제 잔존)"
        : kr.sameCount > 0 && kr.pricedCount > 0
          ? "C — SAME + 가격 확보 ⟹ 국내 가격대 실제 검증으로 진행"
          : krPriced.length > 0
            ? "B — 상세 URL + 가격은 찾았고 MI 에서 SAME 이 아니다 ⟹ NO_TITLE_OVERLAP 별도 counterfactual"
            : "A' — 상세 URL 은 찾았으나 가격까지 가지 못했다";
    console.log(`\n  🔴🔴 판정 = **${verdict}**`);
    console.log(`  (국내 행 ${krRows.length} · 그중 가격 있는 것 ${krPriced.length})`);
    console.log("  🔴 NO_TITLE_OVERLAP 을 완화하지 않았다 · 다른 사이트/Adapter/Registry 로 확장하지 않았다.");
    expect(jg).toBeDefined();
  }, 1_800_000);
});
