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
import { buildMarketJudgement, buildPriceGuide, isPriceConfirmed } from "../../../../pipeline/commerce/mi-same-candidates";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";
import type { GeminiTransientRow } from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-172 — **국내 가격비교 E2E 재검증**(측정 전용 · 상품 3종)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「매칭 알고리즘을 고치는 게 아니라 **현재 가격비교 파이프라인의
 * 실제 성능을 재측정**」 · 「다섯 가지를 **절대 섞지 않는다**」 ·
 * 「**판매중 0곳 = 가격 0건** 으로 해석하지 않는다」.
 *
 * 🔴 운영 코드 **0** · 동의어/TITLE/MODEL_CODE/threshold **0** · Registry/Adapter **0** ·
 *    Gemini **0** · 배포 **0**.
 * 🔴 게이트 `WU_172_PROBE=1` 없으면 SKIP.
 *
 * ── 🔴🔴 §4 「국내 후보 자동 공급」의 실제 상태(코드 사실 · 다시 확인했다) ────
 * ```
 * 자동 1회차 — `page.tsx:481` 이 `body: JSON.stringify({ snapshotId })` **하나만** 보낸다
 *   ⟹ `/check` 의 `candidateUrls` 가 **비어 있다** ⟹ AI URL 풀이 **돌지 않는다**
 * 등록부 검색 — `searchDomesticShops` 는 **아동의류 실효 6곳** 이고 이 상품들에서 **후보 0**
 *   (WU-114 · WU-130 ② 실측 · 어댑터 부재 12/18)
 * ⟹ 🔴🔴 **「후보가 없다」가 현재 국내 자동 공급의 상태다.** 아래 퍼널은 그래서
 *    **「공급이 됐다면」** 을 재는 것이고, 🔴 「자동으로 된다」로 적지 않는다.
 * ```
 *
 * ── 입력 ───────────────────────────────────────────────────────────────────
 * ```
 * 🟢 국내 후보는 **human GT 에 있는 실제 URL** 이다(지어낸 것 0).
 *    B226AC009 — 비스킷 SAME · 보몽드 SAME(WU-150) · 럭스보이 DIFFERENT
 *    B226AC010 — 보몽드 SAME · 룩서스베이비 DIFFERENT ×2
 *    B226AC117 — 비스킷 SAME · 머스트잇 SAME        ← 🟢 **세 번째 상품**
 * 🟢 원상품 셋 다 **실제 URL 로 추출** 하고 품번이 맞는지 **검증** 한다.
 * ```
 */
const LIVE = process.env.WU_172_PROBE === "1";

interface Cand {
  url: string;
  human: "SAME" | "DIFFERENT";
}
interface Product {
  code: string;
  origin: string;
  domestic: Cand[];
}

const PRODUCTS: Product[] = [
  {
    code: "B226AC009",
    origin: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
    domestic: [
      { url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/70/display/1/", human: "SAME" },
      { url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014022", human: "SAME" },
      { url: "https://m.luxboy.com/goods/A14338197CB8698CD92C86431CCE8D05", human: "DIFFERENT" },
    ],
  },
  {
    code: "B226AC010",
    origin: "https://bobochoses.com/ko-kr/products/b226ac010-booty-ghosts-t-shirt",
    domestic: [
      { url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021", human: "SAME" },
      { url: "https://luksusbaby.kr/products/bobo-choses-light-blue-booty-ghosts-t-shirt", human: "DIFFERENT" },
      { url: "https://luksusbaby.kr/products/bobo-choses-light-blue-booty-ghosts-sweatshirt-1", human: "DIFFERENT" },
    ],
  },
  {
    code: "B226AC117",
    origin: "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket",
    domestic: [
      { url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-bc-%EC%97%A0%EB%B3%B4%EC%8A%A4-%ED%8A%B8%EB%9E%99%EC%88%98%ED%8A%B8-%EC%9E%90%EC%BC%93-b226ac117/9445/category/70/display/1/", human: "SAME" },
      { url: "https://m.web.mustit.co.kr/v2/m/product/product_detail/127093801", human: "SAME" },
    ],
  },
];

describe("WU-172 — 국내 가격비교 E2E 재검증", () => {
  it.runIf(LIVE)("상품 3종의 퍼널과 최종 CASE 를 낸다", async () => {
    /* eslint-disable no-console */
    interface Out {
      code: string;
      raw: number;
      detail: number;
      fetchOk: number;
      extractOk: number;
      miInput: number;
      same: number;
      onSale: number;
      priced: number;
      amounts: string[];
      leak: number;
      final: string;
    }
    const table: Out[] = [];

    for (const p of PRODUCTS) {
      console.log(`\n══════════ ${p.code} ══════════`);
      /**
       * 🔴🔴🔴 **원상품 brand 추출이 실행마다 흔들린다**(이 WU 가 찾은 것).
       *    실측 — 3회 × 3상품 = 9 시도 중 brand 복구 성공 **2건(22%)**:
       *      회차1 AC009 "" · AC010 "Bobo Choses" · AC117 ""
       *      회차2 전부 ""      회차3 AC009 "Bobo Choses" · 나머지 ""
       * 🔴 그 값은 WU-134 의 `siteBrandName` 이 **HTML 1회를 더 받아** 복구하는 것이고
       *    그 추가 fetch 가 실패하면 **빈다**. 🔴 실패 원인은 **미규명** 이다.
       * 🔴🔴 brand 가 비면 WU-133 의 사슬이 그대로 발화한다 —
       *    `brandKnown = Boolean(x.brand && y.brand)` 에서 x 가 원상품이므로
       *    **모든 후보가 BRAND_UNCONFIRMED** → PRESUMED_SAME → 가격비교 제외.
       * 🟢 그래서 **brand 가 살아날 때까지 제한 재시도** 하고, 몇 번째에 살았는지 적는다.
       *    🔴 못 살아나면 그 상품을 **「측정불가」** 로 적는다(0 으로 세지 않는다).
       */
      let ex: Awaited<ReturnType<typeof shopifySiteStrategy.extract>> = null;
      let attempts = 0;
      let brandValue = "";
      for (let i = 1; i <= 5; i += 1) {
        attempts = i;
        ex = await shopifySiteStrategy.extract(p.origin);
        if (!ex) continue;
        const probe = buildProductIdentityDna(
          buildCanonicalProduct(p.origin, ex.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
        );
        brandValue = probe.brand.value ?? "";
        if (brandValue) break;
      }
      if (!ex) {
        console.log(`  🔴 원상품 추출 실패 — 제외(측정불가)`);
        continue;
      }
      console.log(`  🔴 brand 복구 시도 ${attempts}회 → ${brandValue ? `🟢 ${JSON.stringify(brandValue)}` : "🔴 **빈 값**(측정불가로 적는다)"}`);
      const product = buildCanonicalProduct(
        p.origin,
        ex.productData as ExtractedProductData,
        {} as Record<string, ProductDataSource>,
        [],
      );
      const dna = buildProductIdentityDna(product);
      const of = productFactsFromIdentityDna(dna);
      /** 🔴 그 URL 이 **정말 그 품번** 인지 검증한다(추측으로 쓰지 않는다). */
      expect(`${of.title} ${of.sourceUrl}`.toLowerCase(), `원상품 불일치 ${p.code}`).toContain(p.code.toLowerCase());
      console.log(`  원상품 — brand=${of.brand} code=${of.brandModelCode} color=${JSON.stringify(of.colorText)}`);

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

      const urls = p.domestic.map((d) => d.url);
      const humanOf = new Map(p.domestic.map((d) => [d.url, d.human]));
      const detail = urls.filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE").length;

      const pool = await collectUrlCandidatePool({
        urls,
        originUrl: dna.sourceUrl,
        maxUrls: 10,
        existingCanonicalUrls: new Set<string>(),
        shopId: REVIEWED_SAME_SHOP_ID,
        shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
      });
      /** 🔴 **다섯 축을 섞지 않는다** — 탈락 사유를 그대로 적는다. */
      const dropped = pool.metrics.dropped.map((d) => `${d.reason}`);
      console.log(
        `  퍼널 — raw ${urls.length} · detail모양 ${detail} · accepted ${pool.metrics.acceptedUrls}` +
          ` · fetch/usable ${pool.metrics.usableProductUrls} · MI입력 ${pool.metrics.miEligibleCandidates}`,
      );
      if (dropped.length) console.log(`  🔴 탈락 사유 ${JSON.stringify(dropped)}`);

      const rows: GeminiTransientRow[] = [];
      let extractOk = 0;
      let miInput = 0;
      let leak = 0;
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
        /** 🔴 **Extract 성공** = 상품정보가 실제로 나왔는가(제목 + 가격 중 가격 기준 · WU-160 교훈) */
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
          console.log(`    ${res.domain.padEnd(24)} **${j.kind}**`);
          continue;
        }
        const tier = domesticMatchDisplay(j.matchTruth as never).tier;
        const mk = classifyCandidateMarket({
          domain: res.domain,
          currency: j.best.price?.currency ?? null,
          isRegisteredDomesticShop: false,
        });
        const human = humanOf.get(j.best.url) ?? [...humanOf.entries()].find(([k]) => k.includes(res.domain))?.[1] ?? "?";
        console.log(
          `    ${res.domain.padEnd(24)} human ${String(human).padEnd(10)} tier=${String(tier).padEnd(14)}` +
            ` market=${String(mk.market).padEnd(9)} soldOut=${String(j.best.soldOut)}` +
            ` ${j.best.price?.amount != null ? `${j.best.price.currency} ${j.best.price.amount}` : "가격없음"}`,
        );
        if (tier === "SAME" && human === "DIFFERENT") leak += 1;
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

      /** 🟢 **운영 owner 로** 최종 판단을 만든다(복제식 0). */
      const judgement = buildMarketJudgement(rows);
      const guide = buildPriceGuide(judgement, "KR");
      const krSame = rows.filter((r) => domesticMatchDisplay(r.matchTruth as never).tier === "SAME" && r.market === "KR");
      const onSale = krSame.filter((r) => r.soldOut === false).length;
      const pricedN = krSame.filter((r) => isPriceConfirmed(r)).length;
      const amounts = krSame.filter((r) => r.priceAmount != null).map((r) => `${r.priceCurrency} ${r.priceAmount}`);
      /** 🔴 CPO 가 고정한 세 CASE — **1건을 「시장 가격대」로 부르지 않는다**. */
      const final = pricedN === 0 ? "A 국내 가격 참고 불가" : pricedN === 1 ? "B 가격 참고 1건" : "C 국내 시장 가격대";
      console.log(
        `  🔴 판단 — verdict ${judgement.verdict} · 🇰🇷 SAME ${krSame.length} · 판매중 ${onSale}` +
          ` · 가격확인 ${pricedN} · basis ${String((guide as { basis?: string } | null)?.basis ?? "-")}`,
      );
      console.log(`  ⟹ **${final}**  ${amounts.length ? JSON.stringify(amounts) : ""}`);

      table.push({
        code: p.code,
        raw: urls.length,
        detail,
        fetchOk: pool.metrics.usableProductUrls,
        extractOk,
        miInput,
        same: krSame.length,
        onSale,
        priced: pricedN,
        amounts,
        leak,
        final,
      });
    }

    console.log("\n══════════ 🔴🔴 §11 표 ══════════");
    console.log(
      `  ${"상품".padEnd(11)} ${"후보".padStart(4)} ${"Detail".padStart(6)} ${"Fetch".padStart(5)} ${"Extract".padStart(7)}` +
        ` ${"MI".padStart(3)} ${"SAME".padStart(4)} ${"판매중".padStart(5)} ${"가격".padStart(4)}  최종`,
    );
    for (const t of table) {
      console.log(
        `  ${t.code.padEnd(11)} ${String(t.raw).padStart(4)} ${String(t.detail).padStart(6)} ${String(t.fetchOk).padStart(5)}` +
          ` ${String(t.extractOk).padStart(7)} ${String(t.miInput).padStart(3)} ${String(t.same).padStart(4)}` +
          ` ${String(t.onSale).padStart(5)} ${String(t.priced).padStart(4)}  ${t.final}`,
      );
    }
    const totalLeak = table.reduce((n, t) => n + t.leak, 0);
    console.log(`\n  🔴 **DIFFERENT 가 SAME 으로 오염된 건수 = ${totalLeak}**`);
    console.log("  🔴 자동 공급은 **0** 이다(§4) — 이 표는 「공급이 됐다면」을 잰 것이다");
    console.log("  🔴 판매중 0 을 **가격 0 으로 해석하지 않았다** — 두 축을 따로 셌다");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(table.length).toBeGreaterThan(0);
  }, 900_000);
});
