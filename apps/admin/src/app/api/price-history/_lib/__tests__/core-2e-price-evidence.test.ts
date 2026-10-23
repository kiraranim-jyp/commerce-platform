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
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { convertToKrw } from "@commerce/pricing";
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
  overseasHasSingleCurrency,
  overseasLowestText,
} from "../../../../pipeline/commerce/mi-same-candidates";
import { collectFromResultLinks } from "../../../../pipeline/supplied-url-handoff";
/**
 * 🔴 행 타입 owner — **이름을 추측하지 않고 선언에서 읽었다.**
 *    1차에 `MiSameRow` 라고 썼는데 그 타입은 **없다**(이 트랙 14번째 같은 실수 ·
 *    🟢 typecheck 가 잡았다). 실제는 `GeminiTransientRow` 다.
 */
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2E — **국내 시장가격대 / 해외 통화별 최저 소싱가**(실측)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「검색 기능 개선이 아니라 **가격 증거 회수 목적 재정의 +
 * 기존 파이프라인 연결 검증**」 · 「성공 기준은 **검색 결과 개수가 아니다**」 ·
 * 「NO 면 **어느 단계에서 가격 증거가 손실되는지까지 특정** 하고 멈춘다」.
 *
 * ── 🟢🟢 먼저 적는다 — **§3·§4 규칙은 이미 구현돼 있다**(WU-139/148) ────────
 * ```
 * 🇰🇷 국내  `domesticPriceBand` → 2건↑ **그리고** 최저<최고 면 **BAND**(`min ─ max`) ·
 *          1건이거나 같은 금액 둘이면 **SINGLE**(「가격대 확정 불가」) ·
 *          통화가 섞이면 **NONE**(가격대를 만들지 않는다)
 * 🌎 해외  `overseasLowestText` → **통화별 최저** · 통화가 하나일 때만 「최저 확인가」로
 *          **단정** 한다(`overseasHasSingleCurrency`)
 * ⟹ 🔴 그래서 이 WU 는 **규칙을 다시 만들지 않는다** — 실데이터로 **검증** 한다.
 * ```
 *
 * 🔴 MI/SAME/threshold/모델코드/브랜드/8축/Gemini/OpenAI/Naver/유료API/계정 **전부 0**.
 * 🔴 Seller UI 신규 **0** · 추천 판매가/마진/수익성 **0** · 등록 **0**.
 * 🔴 게이트 `CORE2E_LIVE=1` 없으면 SKIP(실제 HTTP 를 쓴다).
 */
const LIVE = process.env.CORE2E_LIVE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/**
 * 🔴 **실제 검색이 돌려준 URL 원문 그대로**(CORE-2B 와 같은 집합 + §5 가 지목한 호스트).
 * 🔴 URL 을 **지어내지 않았다** · 🔴 가격 숫자를 fixture 정답으로 **하드코딩하지 않는다**.
 */
const SEARCH_HREFS = [
  "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
  "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue",
  "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
  "https://www.lfmall.co.kr/app/product/DNSVXX00636",
  "https://www.thefrontshop.com/products/hug-hairy-monster-t-shirt",
  "https://cissywears.com/en-us/products/bobo-choses-babyhug-hairy-monster-t-shirt",
  "https://m.bunjang.co.kr/products/99927762",
  "https://scoutandcokids.com/collections/bobo-choses",
  /** 🔴 §5 가 지목한 `donokids` — 검색이 준 것은 **브랜드 목록** 뿐이다(상세 URL 미확보). */
  "https://www.donokids.com/shop/shopbrand.html?xcode=058&type=X",
];

/** 🟢 국내 어댑터 등록부(8) — `isRegisteredDomesticShop` 입력. */
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

describe("CORE-2E — 가격 증거 회수 실측", () => {
  it.runIf(LIVE)("§7 A~H + §5 시장 분류를 한 번에 잰다", async () => {
    /* eslint-disable no-console */
    console.log("\n════════ 🔴 CORE-2E — B226AC009 가격 증거 ════════");

    /** ── 원상품 — 🔴 brand 가 비면 MI 가 전건 BRAND_UNCONFIRMED 가 된다(측정 열화). */
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
    let brandSource = `운영 extract(${tries}회)`;
    if (!dna.brand.value) {
      /** 🟢 운영 파서로 같은 페이지에서 확보한다 — 값을 **지어내지 않는다**. */
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
        brandSource = `🔴 하니스 보강(운영 파서 ${site.evidence})`;
      }
    }
    console.log(`  원상품 brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode} · ${brandSource}`);
    expect(dna.brand.value, "🔴 brand 확보 실패 — 열화된 상태로 가격을 재지 않는다").toBeTruthy();

    /** ── A. Discovery — 북마크 핸드오프와 **같은 추출기** 를 쓴다. */
    const handed = collectFromResultLinks(SEARCH_HREFS, "https://html.duckduckgo.com");
    const pool = await collectUrlCandidatePool({
      urls: handed,
      originUrl: dna.sourceUrl,
      maxUrls: 12,
      existingCanonicalUrls: new Set<string>(),
      shopId: GEMINI_VIRTUAL_SHOP_ID,
      shopNamePrefix: GEMINI_VIRTUAL_SHOP_NAME,
    });
    console.log(
      `\n  A Discovery — 검색 ${SEARCH_HREFS.length} → 핸드오프 ${handed.length} → ` +
        `accepted ${pool.metrics.acceptedUrls} → usable ${pool.metrics.usableProductUrls} → ` +
        `miEligible ${pool.metrics.miEligibleCandidates}`,
    );
    for (const d of pool.metrics.dropped) console.log(`    🔴 탈락 ${d.reason} ${d.url.slice(0, 70)}`);

    /** ── B/C/D. MI → 가격 → 시장. 운영 순서를 그대로 베낀다(§5-B). */
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
    const trace: string[] = [];
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
      if (notSelf.length === 0) {
        trace.push(`    ${res.domain.padEnd(24)} SELF_REFERENCE(원상품 자신)`);
        continue;
      }
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
        trace.push(`    ${res.domain.padEnd(24)} ${j.kind}`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: REGISTRY.has(res.domain),
      });
      trace.push(
        `    ${res.domain.padEnd(24)} tier=${String(tier).padEnd(14)} market=${String(mk.market).padEnd(8)} ` +
          `${j.best.price?.amount ?? "-"} ${j.best.price?.currency ?? ""} · basis=${mk.basis} · ` +
          `priceStatus=${j.best.priceStatus ?? "-"}`,
      );
      /** 🔴 운영 화면이 쓰는 행 모양 그대로 만든다 — 가격 판정은 `buildMarketJudgement` 가 한다. */
      rows.push({
        domain: res.domain,
        discoveredUrl: j.best.url,
        title: j.best.title ?? null,
        priceAmount: j.best.price?.amount ?? null,
        priceCurrency: j.best.price?.currency ?? null,
        priceStatus: j.best.priceStatus ?? null,
        market: mk.market,
        soldOut: j.best.soldOut ?? null,
        imageUrl: j.best.imageUrl ?? null,
        /**
         * 🔴🔴 **1차 하니스가 여기서 틀렸다 — 그대로 보고하면 거짓 결론이었다.**
         *
         * `priceTier` 만 채웠더니 국내 0 · 해외 0 이 나왔다. 🔴 원인은 제품이 아니라
         * 내 입력이다 — 운영 게이트 `transientDisplayTier` 는 **`matchTruth`** 를
         * (없으면 `crossSellerVerdict` 를) 읽고 **`priceTier` 는 보지 않는다**.
         * 🟢 그래서 **운영이 낸 `matchTruth` 를 그대로** 싣는다(값을 지어내지 않는다).
         */
        matchTruth: String(j.matchTruth),
        crossSellerVerdict: j.best.crossSellerVerdict ?? null,
        priceTier: String(tier),
      });
    }
    console.log("\n  B/C/D MI → 가격 → 시장:");
    for (const t of trace) console.log(t);

    /** ── E/F/G/H. 운영 집계 owner 로 가격대/최저가를 만든다 — **새 계산 0**. */
    const j = buildMarketJudgement(rows);
    const kr = buildPriceGuide(j, "KR");
    const os = buildPriceGuide(j, "OVERSEAS");
    const krBand = domesticPriceBand(kr);

    console.log("\n  ── 🇰🇷 국내(시장 가격대) ──");
    console.log(`    SAME ${kr.sameCount} · 판매중 ${kr.onSaleCount} · 가격확인 ${kr.pricedCount} · 확인필요 ${kr.unpricedCount}`);
    console.log(`    byCurrency ${JSON.stringify(kr.byCurrency)}`);
    console.log(`    band kind=**${krBand.kind}** → ${JSON.stringify(domesticBandText(krBand))}`);
    console.log(`    headline=${JSON.stringify(marketPriceHeadline(kr))} label=${JSON.stringify(marketPriceHeadlineLabel(kr))}`);

    console.log("\n  ── 🌎 해외(통화별 최저 소싱가) ──");
    console.log(`    SAME ${os.sameCount} · 판매중 ${os.onSaleCount} · 가격확인 ${os.pricedCount} · 확인필요 ${os.unpricedCount}`);
    console.log(`    byCurrency ${JSON.stringify(os.byCurrency)}`);
    console.log(`    통화 단일? ${overseasHasSingleCurrency(os)} · 최저 ${JSON.stringify(overseasLowestText(os))}`);
    console.log(`    headline=${JSON.stringify(marketPriceHeadline(os))} label=${JSON.stringify(marketPriceHeadlineLabel(os))}`);
    /** 🔴 §4-4 — KRW 환산은 **표시 보조값** 이다. 최저가 «선택» 에 쓰지 않는다. */
    for (const c of os.byCurrency) {
      const k = convertToKrw(c.lowest, c.currency);
      console.log(
        `    ${c.currency} ${c.lowest} → 환산 ₩${k.amountKrw.toLocaleString("ko-KR")}` +
          `${k.isEstimate ? " 🟡(estimate — 고정표)" : " 🟢(실시간)"}` +
          ` · 🔴 이 값은 표시용이고 최저가 선택에 쓰이지 않았다`,
      );
    }

    console.log("\n  ── H. 가격 미확인 SAME 처리 ──");
    const noPrice = rows.filter((r) => r.priceTier === "SAME" && r.priceAmount == null);
    console.log(`    SAME 인데 가격 없음 ${noPrice.length}건 — 🔴 판매처 목록에는 남고 가격 축에는 **안 들어간다**`);
    console.log(`    검증: 국내 pricedCount(${kr.pricedCount}) + 해외 pricedCount(${os.pricedCount}) = ${kr.pricedCount + os.pricedCount}`);

    console.log("\n  ── §5 시장 분류 근거(도메인 이름으로 정하지 않았다) ──");
    for (const r of rows) {
      console.log(`    ${r.domain.padEnd(24)} market=${String(r.market).padEnd(8)} currency=${r.priceCurrency ?? "-"}`);
    }
    console.log("    🔴 donokids / miniboutique — **상세 URL 미확보** ⟹ 「측정불가」(0 아님)");

    expect(j).toBeDefined();
  }, 1_200_000);
});
