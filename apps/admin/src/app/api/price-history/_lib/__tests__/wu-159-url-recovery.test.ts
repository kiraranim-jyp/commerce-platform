import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { enrichCandidatePrices, fetchDomesticModelCode, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-159 — **Search Result → URL Recovery** (조사 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「1차 검색이 **링크 대신 판매처명/상품명/가격** 을 줬을 때,
 * 그 정보만으로 **2차 표적 검색** 을 한 번 더 해서 실제 상세 URL 을 회수할 수 있는가」.
 * GO = **국내 실제 SAME 상세 URL ≥ 2곳**.
 *
 * 🔴 코드 변경 **0** · Gemini **0** · adapter **0** · registry **0** · robots 우회 **0** ·
 *    셀러 입력 **0** · `maxUrls` 변경 **0**.
 * 🔴 게이트 `WU_159_PROBE=1` 없으면 SKIP.
 *
 * ── 2차 표적 검색 실측(2026-10-22 · `cto-websearch`) ────────────────────────
 * ```
 * 1차가 준 판매처 — 보몽드 88,000 · 쿠팡 89,540 · 디몬트 67,000 · 번장 66,000 · 도노키즈
 * 2차 `site:beaumonde.co.kr` × 5 모양   🔴 목표 **0** / 다른 상품 상세 **12**
 * 2차 `site:coupang.com` + 한국어 상품명 🟢 상세 **1**(`vp/products/8039018268`)
 *      🔴 제목이 「- 티셔츠」라 **CTO 가 동일상품으로 단정하지 않았다** — MI 가 판정한다
 * 2차 `site:donokids.com` + 한국어 상품명 🟢 상세 **3** / 🔴 목표 **0**
 * ```
 */
const LIVE = process.env.WU_159_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/** 🟢 2차 표적 검색이 **실제로 돌려준** 국내 상세 URL(가공 0 · 사전 선별 0). */
const RECOVERED = [
  /** 🟡 쿠팡 — 스니펫이 「B226AC009 · 89,540원 · 보몽드 판매」라 말했다. 🔴 확정은 MI 가 한다. */
  "https://www.coupang.com/vp/products/8039018268?itemId=22500188394&vendorItemId=90224398222",
  /** 🔴 도노키즈 3건 — 전부 **다른 상품** 으로 보인다(제목 기준). MI 가 거르는지 본다. */
  "http://www.donokids.com/m/product.html?branduid=668374&mcode=001&special=3&xcode=058",
  "https://donokids.com/m/product.html?branduid=3362015",
  "http://donokids.com/m/product.html?branduid=3362784&xcode=058&mcode=003&special=3",
] as const;

/** 🔴🔴 §5-B CONTROL — WU-150/158 이 `SAME · KRW 83,600 · KR` 로 확정한 URL. */
const CONTROL_URL = "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014022";
const CONTROL_KEY = "1000014022";

describe("WU-159 — 2차 표적 검색으로 상세 URL 을 회수할 수 있는가", () => {
  it.runIf(LIVE)("회수된 URL 을 운영 파이프라인이 판정한다", async () => {
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

    const ALL = [...RECOVERED, CONTROL_URL];
    console.log("\n══════ 🔴 WU-159 입력 ══════");
    for (const u of ALL) {
      console.log(`  ${String(classifyUrlShape(u)).padEnd(13)} ${u.slice(0, 86)}`);
    }

    /** 🔴 `maxUrls` 를 **운영 상수와 같은 10** 으로 둔다(CPO: 변경 금지 · 5건이라 안 걸린다). */
    const pool = await collectUrlCandidatePool({
      urls: [...ALL],
      originUrl: dna.sourceUrl,
      maxUrls: 10,
      existingCanonicalUrls: new Set<string>(),
      shopId: REVIEWED_SAME_SHOP_ID,
      shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
    });
    console.log(
      `\n  pool — supplied ${pool.metrics.suppliedUrls} → accepted ${pool.metrics.acceptedUrls}` +
        ` → usable ${pool.metrics.usableProductUrls} → miEligible ${pool.metrics.miEligibleCandidates}`,
    );
    if (pool.metrics.dropped.length > 0) {
      console.log("  탈락 사유:");
      for (const d of pool.metrics.dropped) console.log(`    ${String(d.reason).padEnd(20)} ${d.url.slice(0, 70)}`);
    }

    let krSame = 0;
    let krPriced = 0;
    let controlSame = false;
    const sameShops: string[] = [];
    console.log("\n── 샵별 판정(운영 모양 · 배열 통째로) ──");
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
      const scored = withConfidence(query, notSelf);
      for (const c of scored) {
        console.log(
          `   ${res.domain.padEnd(22)} lvl=${String(c.matchLevel ?? "-").padEnd(10)} ${String(c.title).slice(0, 48)}`,
        );
      }
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
        console.log(`      → ${res.domain}: **${j.kind}**`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: false,
      });
      const amount = j.best.price?.amount != null ? `${j.best.price.currency} ${j.best.price.amount}` : "-";
      console.log(`      → tier=${String(tier).padEnd(14)} market=${String(mk.market).padEnd(9)} ${amount}`);
      if (tier === "SAME") {
        if (j.best.url.includes(CONTROL_KEY)) controlSame = true;
        if (mk.market === "KR") {
          krSame += 1;
          sameShops.push(res.domain);
          if (j.best.price?.amount != null) krPriced += 1;
        }
      }
    }

    const recoveredSame = sameShops.filter((d) => !d.includes("beaumonde"));
    console.log("\n══════ 🔴🔴 KPI ══════");
    console.log(`  2차 검색이 회수한 국내 상세 URL        ${RECOVERED.length}`);
    console.log(`  🇰🇷 SAME(CONTROL 포함)                  ${krSame}  [${sameShops.join(", ") || "-"}]`);
    console.log(`  🔴 **2차 회수로 «새로» 얻은 국내 SAME**  ${recoveredSame.length}  ← GO 기준 ≥2`);
    console.log(`  🇰🇷 가격 확인 SAME                       ${krPriced}`);
    console.log(`\n  판정 = ${recoveredSame.length >= 2 ? "🟢 GO" : "🔴 **NO-GO / 미달**"}`);
    console.log("  🔴 CONTROL 은 **사람이 WU-150 에서 확보한 URL** 이다 — 2차 회수 산출이 아니다.");

    /** 🔴🔴 CONTROL 이 재현되지 않으면 이 측정을 전략 판단에 쓰지 않는다(§5-B). */
    expect(controlSame, "🔴 CONTROL 재현 실패 — 이 측정을 전략 판단에 쓰지 않는다").toBe(true);
  }, 900_000);
});
