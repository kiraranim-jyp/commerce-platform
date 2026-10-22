import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { enrichCandidatePrices, fetchDomesticModelCode, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectUrlCandidatePool } from "../url-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { REVIEWED_SAME_SHOP_ID, REVIEWED_SAME_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-161 — **읽히는 전문몰에서 상세 URL 을 회수할 수 있는가** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「대형몰 추출기 개발이 아니라 **전문몰 URL 공급** 문제를
 * 해결하는 방향」. KPI = **B226AC009 의 «신규» 국내 SAME + 가격 ≥ 1건**
 * (🔴 보몽드 CONTROL 을 다시 세지 않는다 — **신규 판매처** 여야 한다).
 *
 * 🔴 Gemini **0** · 대형몰 추출기 **0** · Playwright **0** · adapter **0** ·
 *    registry **0** · robots 우회 **0** · MI **0** · `maxUrls` **0** · 배포 **0** ·
 *    운영 코드 **0** · 셀러 입력 **0**.
 * 🔴 게이트 `WU_161_PROBE=1` 없으면 SKIP.
 *
 * ── 🔴🔴 회수 방법 **6종** 을 시도했고 전부 같은 모양으로 실패했다 ─────────────
 * ```
 * ① `site:beaumonde.co.kr` × 5 모양(한국어명 · 품번 · 시즌 · 영문명 · 가격 토큰)
 * ② `site:donokids.com` + 한국어 상품명        🟢 다른 상품 상세 3 · 🔴 목표 **0**
 * ③ `site:donokids.com 226AC009`(샵 표기 = B 없음)  🔴 **질의 붕괴**(숫자열로 취급)
 * ④ `site:donokids.com` + 샵의 영문 제목 패턴  🟢 다른 상품 상세 2 · 🔴 목표 **0**
 * ⑤ `site:coupang.com` + 한국어명              🟡 상세 1 · 🔴 **측정불가**(403/shell)
 * ⑥ `site:biskuit.kr` + 한국어 상품명          🟢 다른 상품 상세 **6** · 🔴 목표 **0**
 * ⟹ 🔴 **여섯 번 전부** — 엔진은 상품을 **읽는데**(도노키즈 88,000원 · 사이즈 3종까지,
 *    비스킷 `B226AC014 88,000원`) **그 URL 만** 돌려주지 않는다
 * ```
 *
 * ── 🟢🟢 그런데 **안정적으로 회수되는 것이 하나 있다**(구현하지 않았다) ──────────
 * ```
 * 모든 전문몰에서 **「그 브랜드 목록 URL」** 은 나온다:
 *   도노키즈  `shop/shopbrand.html?xcode=058&type=X`
 *   비스킷    `category/bobo-choses/70/` · `brand/bobochoses.html`
 *   보몽드    `goods/goods_list.php?brandCd=070031`
 * ⟹ 🔴 그 목록에서 **1-hop** 하면 상세 URL 이 나온다. **WU-120/121 이 HOLD 한 축** 이고
 *    CPO 가 열지 않았다 ⟹ **적어만 둔다.**
 * 🟢 단 **분모가 그때보다 훨씬 좁아졌다** — WU-120 은 **홈**(상품링크 498개)에서 쟀고
 *    지금은 **그 브랜드만** 담긴 목록이다. 🔴 효과는 **미측정** 이다.
 * ```
 */
const LIVE = process.env.WU_161_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/**
 * 🟢 회수된 **신규 전문몰** 상세 URL 전수(2026-10-22 · 가공 0 · 사전 선별 0).
 * 🔴 전부 **다른 상품** 이다 — 재는 것은 ⒜ 그 샵이 **읽히는가** ⒝ MI 가 **거르는가** 다.
 */
const BISKUIT = [
  "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%EB%B9%85-%EC%BA%A3-%EC%98%AC-%EC%98%A4%EB%B2%84-%EC%9A%B0%EB%B8%90-%EB%B2%84%EB%AE%A4%EB%8B%A4-%EC%87%BC%EC%B8%A0-124ac079/2029/",
  "https://biskuit.kr/skin-skin2/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%EA%B3%A0-%EB%B3%B4%EB%B3%B4-%ED%8B%B0%EC%85%94%EC%B8%A0-b225ac001/5624/display/1/",
  "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%8C%8C%EC%96%B4%EC%9B%A8%EC%9D%B4-%EC%BA%90%EC%8A%AC-%EC%88%8F-%EC%8A%AC%EB%A6%AC%EB%B8%8C-%ED%8B%B0%EC%85%94%EC%B8%A0-b224ac005/3268/",
] as const;

describe("WU-161 — 신규 전문몰 상세 URL 회수 + 추출/판정", () => {
  it.runIf(LIVE)("회수된 신규 전문몰 URL 을 운영 파이프라인이 읽고 판정한다", async () => {
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

    const pool = await collectUrlCandidatePool({
      urls: [...BISKUIT],
      originUrl: dna.sourceUrl,
      maxUrls: 10,
      existingCanonicalUrls: new Set<string>(),
      shopId: REVIEWED_SAME_SHOP_ID,
      shopNamePrefix: REVIEWED_SAME_SHOP_NAME,
    });
    console.log("\n══════ 🔴 WU-161 — 신규 전문몰(비스킷) 추출 ══════");
    console.log(
      `  pool — supplied ${pool.metrics.suppliedUrls} → accepted ${pool.metrics.acceptedUrls}` +
        ` → usable ${pool.metrics.usableProductUrls} → miEligible ${pool.metrics.miEligibleCandidates}`,
    );
    for (const d of pool.metrics.dropped) console.log(`    탈락 ${String(d.reason).padEnd(18)} ${d.url.slice(0, 60)}`);

    let newKrSame = 0;
    let extractedWithPrice = 0;
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
      const scored = withConfidence(query, notSelf);
      let priced = scored;
      try {
        priced = await enrichCandidatePrices(scored, res.domain, query);
      } catch {
        /* 운영과 같다 */
      }
      console.log("\n── 추출 결과(후보 전수) ──");
      for (const c of priced) {
        const amount = c.price?.amount != null ? `${c.price.currency} ${c.price.amount}` : "-";
        if (c.price?.amount != null) extractedWithPrice += 1;
        console.log(`   ${amount.padEnd(12)} lvl=${String(c.matchLevel ?? "-").padEnd(8)} ${String(c.title).slice(0, 50)}`);
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
        console.log(`   → ${res.domain}: **${j.kind}**`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: false,
      });
      console.log(`   → tier=${tier} · market=${mk.market}`);
      if (tier === "SAME" && mk.market === "KR") newKrSame += 1;
    }

    console.log("\n══════ 🔴🔴 KPI ══════");
    console.log(`  회수 방법 시도                      **6종**`);
    console.log(`  그중 목표 상품 상세 URL 회수         **0**`);
    console.log(`  🟢 신규 전문몰 추출 — 가격까지 읽힌 후보  ${extractedWithPrice}/${BISKUIT.length}`);
    console.log(`  🔴 **신규 국내 SAME + 가격**           ${newKrSame}  ← GO 기준 ≥1`);
    console.log(`\n  판정 = ${newKrSame >= 1 ? "🟢 GO" : "🔴 **NO-GO**"}`);
    console.log("  🔴 보몽드 CONTROL 은 이 분모에 **넣지 않았다**(신규 판매처만 센다 · CPO 조건).");
    /**
     * 🔴🔴 **1차에 「신규 전문몰이 읽힌다」를 «무조건» 찍었고 그것이 거짓이었다.**
     *    비스킷은 **2/3 UNREACHABLE · 가격 0/3** 이다. 🟢 그래서 데이터에 걸었다 —
     *    이 트랙에서 내 하니스가 낙관적 문장을 무조건 출력한 **세 번째** 자리다.
     */
    if (extractedWithPrice > 0) {
      console.log(`  🟢 신규 전문몰 추출이 **가격까지** 됐다(${extractedWithPrice}건) — 그것이 이번의 진전이다.`);
    } else {
      console.log("  🔴 **신규 전문몰 추출도 확인되지 않았다** — 「읽힌다」로 적지 않는다.");
      console.log(`     UNREACHABLE ${pool.metrics.dropped.filter((d) => d.reason === "UNREACHABLE").length}/${BISKUIT.length} ·` +
        ` 읽힌 후보도 **가격 없음** ⟹ 🔴 이 샵은 **측정불가** 로 남긴다`);
      console.log("  🔴 헌장 WU-138 은 biskuit 에 **KRW 88,000 가격 O** 로 적혀 있다 —");
      console.log("     🔴 그 기록과 **다르다**. 원인 미규명(URL 별 차이 ↔ 실행 간 불안정) · 단정하지 않는다.");
    }

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(pool.metrics.suppliedUrls).toBe(BISKUIT.length);
  }, 900_000);
});
