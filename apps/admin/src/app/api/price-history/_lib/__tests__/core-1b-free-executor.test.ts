import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  enrichCandidatePrices,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { GEMINI_VIRTUAL_SHOP_ID, GEMINI_VIRTUAL_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 CORE-1B 보강 — **무료 executor(`cto-websearch`)로 planner 8축을 쟀다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 이것을 쟀는가.** CPO 가 지정한 두 executor 가 **둘 다 자격증명에서 막혔다** —
 *    Gemini **402**(실측) · OpenAI 키 **로컬·Production 모두 부재**(전수 확인).
 *    🔴 그 상태로 「측정 불가」만 보고하면 CPO 는 **「돈을 쓸 가치가 있는가」** 에
 *       답할 근거가 없다. 🟢 그래서 **과금 0** 인 검색으로 planner 질의를 돌려
 *       **URL 품질의 상한** 을 쟀다.
 *
 * 🔴 **이것을 「executor PASS」로 읽지 않는다** — `cto-websearch` 는 운영 코드에
 *    배선돼 있지 않다(CTO 도구다). 재는 것은 **질의 품질** 하나다.
 *
 * ── 🔴 measured(2026-10-23 · **planner 8축 전수**) ────────────────────────
 * ```
 * 축                국내 상세 URL   비고
 * BRAND_CODE(영문)   **1**          global.trenbe.com/products/…b226ac009…
 * BRAND_CODE_KO      0              쿠팡 shop · 보몽드 **홈** · 번개장터 keywords
 * CODE_ONLY          1(중복)        같은 trenbe · 나머지는 위키백과·eBay 소음
 * BRAND_DESIGN       1(중복)        같은 trenbe · 나머지는 해외 Shopify
 * BRAND_DESIGN_KO    0              donokids **홈** · 해외 Shopify 다수
 * PURCHASE_KO        **1**          ocokorea `brand_view` (🔴 모양은 PRODUCT_PAGE 인데
 *                                   **UNREACHABLE** — 실제 상세가 아니다)
 * PRICE_KO           **1**          번개장터 `products/99927762` (**중고**)
 * SHOP_EN            1(중복)        같은 trenbe
 * ⟹ 🔴 **한글 축 3개 중 상세 1건** 이고 그것도 **중고** 다.
 *    planner 의 새 기여(브랜드 한글 alias)는 **신품 국내 상세 URL 을 못 냈다**
 * ⟹ 🟢 검색 «답변 텍스트» 는 가격을 안다(쿠팡 89,540 · 보몽드 88,000) —
 *       🔴 그러나 그것은 snippet 이고 CPO 가 **성공으로 세지 말라고 한 것** 이다
 * ```
 *
 * ── 🔴🔴 그래서 이 측정이 말하는 것 ───────────────────────────────────────
 * ```
 * 국내 호스트 **12** → 운영 모양 게이트 통과 **4** → fetch 성공 **3** → MI 판정 **3**
 *   global.trenbe.com  SAME   · 🔴 market **OVERSEAS**(`.com` + USD 80) — 올바르다
 *   tinyapple.net      SAME   · OVERSEAS(USD 58)
 *   m.bunjang.co.kr    🟢 **DROPPED** — 중고 리스팅을 MI 가 **거부했다**(누출 0)
 * ⟹ 🔴 **국내 SAME = 0 이고 그 이유가 MI 도, executor 도 아니다.**
 *    신품 국내 판매처(보몽드·쿠팡·롯데ON·크로켓·럭서스베이비·OCO·신세계)의
 *    **상품 상세 URL 이 검색 색인에 없다** — 홈/브랜드/검색 페이지만 걸린다.
 * ```
 *
 * 🔴 운영 변경 0 · Adapter/Registry 0 · MI/SAME/MODEL_CODE 0 · 가격/UI 0 · seed 0.
 * 🔴 URL 을 **지어내지 않았다** — 전부 검색이 돌려준 문자열 그대로다.
 */
const LIVE = process.env.CORE1B_FREE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/** 🔴 검색이 돌려준 **원문 그대로**. 추측으로 만든 URL 0. */
const SEARCH_URLS: { axis: string; url: string }[] = [
  { axis: "BRAND_CODE", url: "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p" },
  { axis: "BRAND_CODE", url: "https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue" },
  { axis: "BRAND_CODE_KO", url: "https://shop.coupang.com/beaumondekr?ocid=17295735&checkBatchDelivery=true&pid=7907482626&viid=88739618284&platform=p&brandId=0&locale=ko_KR" },
  { axis: "BRAND_CODE_KO", url: "https://www.beaumonde.co.kr/" },
  { axis: "BRAND_CODE_KO", url: "https://m.bunjang.co.kr/keywords/hUG" },
  { axis: "PURCHASE_KO", url: "https://www.croket.co.kr/brand/68be424e645fa95a685d14e0" },
  { axis: "PURCHASE_KO", url: "https://www.lotteon.com/csearch/search/search?render=search&platform=pc&q=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88&mallId=3" },
  { axis: "PURCHASE_KO", url: "https://luksusbaby.kr/collections/bobo-choses" },
  { axis: "PURCHASE_KO", url: "https://m.shinsegaev.com/dispctg/initBrandGoodsCtg.siv?disp_ctg_no=2212074192&lnb_disp_ctg_no=2212074192&outlet_page=&page_gubun=normal" },
  { axis: "PURCHASE_KO", url: "https://www.ocokorea.com/shop/goods/brand_view.do?pgid=29628&view=brand" },
  { axis: "BRAND_DESIGN_KO", url: "http://donokids.com/index.html" },
  /** 🔴 `PRICE_KO` 축에서만 나온 **중고 거래** 상세 URL 둘 — MI 가 거부하는지 같이 잰다. */
  { axis: "PRICE_KO", url: "https://m.bunjang.co.kr/products/99927762" },
  { axis: "PRICE_KO", url: "https://www.daangn.com/kr/buy-sell/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%EC%83%81%ED%95%98%EC%84%B8%ED%8A%B8-%EC%83%81%EC%9D%988-9y-%ED%95%98%EC%9D%986-7y-bq48cyo38eck/" },
  { axis: "PRICE_KO", url: "https://m.gsshop.com/section/brandSect/263304?lCate=1660576" },
];

/**
 * 🔴 ④ 를 세기 위한 **호스트 선별** 일 뿐이다 — 「국내 시장」 판정은
 *    운영 `classifyCandidateMarket` 이 한다(그 결과가 아래 표에 그대로 찍힌다).
 * 🔴🔴 이 줄을 **쉘(sed)로 편집하지 않는다** — 백슬래시가 날아가 `\.kr` 이 `.kr` 이
 *    된 적이 있다(이 트랙 **세 번째** · 메모 `정규식을 쉘/파이썬으로 편집하지 않는다`).
 */
const KR_HOST =
  /(\.kr$)|coupang|bunjang|daangn|trenbe|mustit|gmarket|ssg\.com|lotte|musinsa|wconcept|29cm|shinsegaev|ocokorea|croket|gsshop/i;
const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
};

describe("CORE-1B 보강 — 무료 executor 로 planner 질의의 URL 품질을 잰다", () => {
  it.runIf(LIVE)("검색이 돌려준 URL 을 운영 pipeline 끝까지 넣는다", async () => {
    /* eslint-disable no-console */
    console.log("\n════════ 🔴 CORE-1B 보강 — URL 품질 상한(과금 0) ════════");

    /** ① URL 모양 — 운영 분류기로 가른다. 🔴 「국내 호스트」와 「상세」를 **따로** 센다. */
    const rows = SEARCH_URLS.map((e) => ({
      ...e,
      host: hostOf(e.url),
      kr: KR_HOST.test(hostOf(e.url)),
      shape: classifyUrlShape(e.url),
    }));
    console.log(`  검색 반환 URL **${rows.length}** (planner 8축 전수)`);
    for (const r of rows) {
      console.log(`    ${r.kr ? "🇰🇷" : "🌎"} ${String(r.shape).padEnd(16)} ${r.axis.padEnd(16)} ${r.host}`);
    }
    const krDetail = rows.filter((r) => r.kr && r.shape === "PRODUCT_PAGE");
    console.log(`\n  🔴 국내 호스트 ${rows.filter((r) => r.kr).length} · 그중 **상품 상세 ${krDetail.length}**`);
    const byAxis = new Map<string, number>();
    for (const r of krDetail) byAxis.set(r.axis, (byAxis.get(r.axis) ?? 0) + 1);
    console.log(`  축별 국내 상세 — ${JSON.stringify(Object.fromEntries(byAxis))}`);

    /** ② 원상품 — 🔴 brand 복구는 간헐 실패하므로 재시도한다(운영 함수 그대로). */
    let ex = await shopifySiteStrategy.extract(ORIGIN);
    let attempts = 1;
    const brandOf = (r: typeof ex): string =>
      String((r?.productData as Record<string, unknown> | undefined)?.siteBrandName ?? "");
    while (!brandOf(ex) && attempts < 4) {
      await new Promise((r) => setTimeout(r, 20_000));
      ex = await shopifySiteStrategy.extract(ORIGIN);
      attempts += 1;
    }
    expect(ex).not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    console.log(`\n  원상품 brand=${JSON.stringify(dna.brand.value)} code=${dna.brandModelCode} (복구 ${attempts}회)`);

    /** ③ 🟢 **운영 후보 풀** 에 그대로 넣는다 — 모양 게이트·fetch·facts 를 그 함수가 한다. */
    const pool = await collectUrlCandidatePool({
      urls: rows.map((r) => r.url),
      originUrl: dna.sourceUrl,
      maxUrls: 12,
      existingCanonicalUrls: new Set<string>(),
      shopId: GEMINI_VIRTUAL_SHOP_ID,
      shopNamePrefix: GEMINI_VIRTUAL_SHOP_NAME,
    });
    const m = pool.metrics;
    console.log("\n  ── 운영 후보 풀 ──");
    console.log(`    suppliedUrls      ${m.suppliedUrls}`);
    console.log(`    acceptedUrls      ${m.acceptedUrls}`);
    console.log(`    usableProductUrls ${m.usableProductUrls}`);
    console.log(`    miEligible        ${m.miEligibleCandidates}`);
    console.log(`    fetchCalls        ${m.fetchCalls}`);
    if (m.dropped.length > 0) {
      console.log("    🔴 탈락:");
      for (const d of m.dropped) console.log(`      ${JSON.stringify(d)}`);
    }

    /** ④ 🟢 MI → 시장 → 가격. 운영 순서를 그대로 베낀다(§5-B). */
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
    let sameKr = 0;
    let pricedKr = 0;
    let extractOk = 0;
    console.log("\n  ── MI 판정 ──");
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
      if (notSelf.length === 0) continue;
      const scored = withConfidence(query, notSelf);
      let pr = scored;
      try {
        pr = await enrichCandidatePrices(scored, res.domain, query);
      } catch {
        /* 운영과 같다 */
      }
      for (const c of pr) if (c.price?.amount != null) extractOk += 1;
      const j = await judgeDomesticCandidate({
        domain: res.domain,
        candidates: pr,
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
        isRegisteredDomesticShop: false,
      });
      console.log(
        `    ${res.domain.padEnd(22)} tier=${String(tier).padEnd(14)} market=${String(mk.market).padEnd(8)} ` +
          `${j.best.price?.amount ?? "-"} ${j.best.price?.currency ?? ""} basis=${mk.basis}`,
      );
      if (mk.market === "KR" && tier === "SAME") {
        sameKr += 1;
        if (j.best.price?.amount != null) pricedKr += 1;
      }
    }
    console.log(`\n  🔴 Extract(가격) ${extractOk} · 🔴 국내 SAME ${sameKr} · 국내 SAME 가격 ${pricedKr}`);
    console.log("  🔴 snippet 가격(쿠팡 89,540 · 보몽드 88,000)은 **세지 않았다** — CPO 기준.");
    expect(m).toBeDefined();
  }, 900_000);
});
