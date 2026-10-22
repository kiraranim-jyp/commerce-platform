import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { enrichCandidatePrices, fetchDomesticModelCode, isSelfReferenceCandidate, withConfidence } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { googleDiscoveryReadiness } from "@commerce/crawler/src/discovery-core/google-discovery";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { collectGeminiCandidatePool, identityFromDna, isGeminiDiscoveryEnabled } from "../gemini-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-157 — **Gemini grounding 이 국내 «상세» URL 을 주는가** (검증 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「Gemini 를 켜자는 결정이 아니다. **Gemini 가 우리가 원하는
 * 국내 상세 URL 공급을 실제로 해결하는지, 그리고 비용이 얼마인지를 딱 한 번 검증**」.
 *
 * 🔴 운영 코드 변경 **0** · 운영 flag ON **0** · 배포 **0** (CPO §9).
 * 🔴 이 하니스는 **운영 함수 `collectGeminiCandidatePool` 을 그대로** 부른다 —
 *    프롬프트도 상한도 운영 그대로다(내가 좋게 바꾸지 않는다).
 * 🔴 게이트 `WU_157_PROBE=1` 없으면 SKIP. 🔴 **실제 과금이 발생한다**(grounded call).
 *
 * ── 🔴🔴 측정 «전» 에 코드로 확정된 구조적 상한 셋 ───────────────────────────
 * ```
 * ① maxCandidates: 3 · targetUsable: 3   (run-domestic-price-check.ts 호출부)
 * ② prompt 「실제 상품 상세 판매 페이지를 **최대 3개까지** 찾아라」
 * ③ prompt 에 **「국내/한국」이라는 말이 한 글자도 없다**
 * ⟹ 🔴 「국내 상세 URL 을 최대한 수집」은 **현재 구조가 할 수 없는 일** 이다.
 *    상한 3 은 국내·해외를 **합친** 수이고, 국내 편향 지시가 없다.
 * ```
 */
const LIVE = process.env.WU_157_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/**
 * 🔴 운영은 `allSources.map((s) => s.domain)`(등록부 34행)을 넘긴다. 이 하니스는
 *    service-role 키가 없어 그 표를 읽을 수 없다 ⟹ **헌장 §12 가 기록한 국내
 *    등록부 도메인** 을 그대로 쓴다. 🔴 지어내지 않았고, 「운영과 같다」로도 적지 않는다.
 */
const DOMESTIC_SCOPED_DOMAINS = [
  "beaumonde.co.kr",
  "biskuit.kr",
  "donokids.com",
  "looxloo.com",
  "littleluna.co.kr",
  "miniboutique.co.kr",
  "luksusbaby.com",
  "chocoel.com",
  "deuxbebe.co.kr",
  "rulii.co.kr",
  "foretforet.com",
  "coconjennie.com",
  "chouchouenfant.kr",
  "musinsa.com",
  "wconcept.co.kr",
  "29cm.co.kr",
  "ssfshop.com",
  "gmarket.co.kr",
  "coupang.com",
  "ssg.com",
  "lotteon.com",
] as const;

const krLike = (u: string) => {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.endsWith(".kr") || /coupang|bunjang|trenbe|gmarket|feelway|ssg|lotte|musinsa|wconcept|29cm|mustit/.test(h);
  } catch {
    return false;
  }
};

describe("WU-157 — Gemini grounding 국내 상세 URL 공급 검증", () => {
  it.runIf(LIVE)("운영 함수를 그대로 1회 실행해 KPI 를 센다", async () => {
    /* eslint-disable no-console */
    console.log("\n══════ 🔴 §3 Gemini producer 상태(코드/환경 실측) ══════");
    const readiness = googleDiscoveryReadiness();
    console.log(`  GEMINI_API_KEY        = ${readiness.state}${readiness.missing.length ? ` (missing: ${readiness.missing.join(",")})` : ""}`);
    console.log(`  MI_GEMINI_DISCOVERY_ENABLED = ${isGeminiDiscoveryEnabled() ? "true" : "**OFF**"}  🔴 운영 flag 는 건드리지 않았다`);

    const ex = await shopifySiteStrategy.extract(ORIGIN);
    expect(ex, "원상품 추출 실패").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    const identity = identityFromDna(dna);
    console.log("\n  identity 전달 방식(운영 `identityFromDna` 호출 결과):");
    console.log(`    brand=${identity.brand} · productCode=${identity.productCode} · color=${identity.color}`);
    console.log(`    productName=${JSON.stringify(identity.productName)}`);

    /** 🔴 운영 상한 그대로(호출부 리터럴과 같은 값). 좋게 바꾸지 않는다. */
    const pool = await collectGeminiCandidatePool({
      dna,
      scopedDomains: DOMESTIC_SCOPED_DOMAINS,
      categoryScopes: ["KIDS_FASHION"],
      maxCandidates: 3,
      targetUsable: 3,
      maxQueries: 1,
      existingNormalizedUrls: new Set<string>(),
    });

    const m = pool.metrics;
    console.log("\n══════ 🔴 §4 실행 결과(운영 metrics 원값) ══════");
    console.log(`  outcomes           = ${JSON.stringify(m.outcomes)}`);
    console.log(`  failureDetails     = ${JSON.stringify(m.failureDetails)}`);
    console.log(`  model              = ${m.model}`);
    console.log(`  geminiCalls        = ${m.geminiCalls}  queriesUsed=${m.queriesUsed}  earlyStopped=${m.earlyStopped}`);
    console.log(`  primaryQuery       = ${JSON.stringify(m.primaryQuery)} (level ${m.primaryQueryLevel})`);
    console.log(`  🔴 groundingQueries = ${m.groundingQueries}  ← **Grounded Search 과금 단위**`);
    console.log(`     groundingQueryTexts = ${JSON.stringify(m.groundingQueryTexts)}`);
    console.log(`  tokens in=${m.inputTokens} out=${m.outputTokens} thoughts=${m.thoughtsTokens} total=${m.totalTokens}`);
    console.log(`  discoveredUrls=${m.discoveredUrls} usableProductUrls=${m.usableProductUrls} miEligible=${m.miEligibleCandidates}`);
    console.log(`  resolveCalls=${m.resolveCalls} fetchCalls=${m.fetchCalls}`);

    /** 🔴 후보를 운영 MI 로 끝까지 보낸다(SAME / 가격까지). */
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

    let krDetail = 0;
    let miInput = 0;
    let same = 0;
    let krSame = 0;
    let krPriced = 0;
    console.log("\n── 후보별 추적 ──");
    if (pool.searchResults.length === 0) console.log("   (후보 0)");
    for (const res of pool.searchResults) {
      if (res.status !== "ok" || res.candidates.length === 0) continue;
      for (const c of res.candidates) {
        const shape = classifyUrlShape(c.url);
        const kr = krLike(c.url);
        if (kr && shape === "PRODUCT_PAGE") krDetail += 1;
        console.log(`   ${res.domain.padEnd(24)} ${kr ? "🇰🇷" : "🌎"} shape=${String(shape).padEnd(13)} ${c.url.slice(0, 80)}`);
      }
      const notSelf = res.candidates.filter((x) => !isSelfReferenceCandidate(query.sourceUrl, x.url));
      const scored = withConfidence(query, notSelf);
      miInput += scored.length;
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
        console.log(`      → ${res.domain}: ${j.kind}`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: false,
      });
      console.log(
        `      → tier=${tier} market=${mk.market} price=${j.best.price?.amount != null ? `${j.best.price.currency} ${j.best.price.amount}` : "-"}`,
      );
      if (tier === "SAME") {
        same += 1;
        if (mk.market === "KR") {
          krSame += 1;
          if (j.best.price?.amount != null) krPriced += 1;
        }
      }
    }

    console.log("\n══════ 🔴 §8 WU-156 대비 비교표 ══════");
    console.log(`  ${"항목".padEnd(28)} ${"cto-websearch".padStart(14)} ${"Gemini".padStart(10)}`);
    const CMP: [string, number | string, number | string][] = [
      ["raw URL", 9, m.discoveredUrls],
      ["국내 URL(도메인 휴리스틱)", 4, "아래 추적 참조"],
      ["🔴 실제 국내 상세 URL = KPI", 0, krDetail],
      ["fetch 성공(usable)", 3, m.usableProductUrls],
      ["MI 입력", 3, miInput],
      ["SAME", 3, same],
      ["🇰🇷 SAME", 0, krSame],
      ["🇰🇷 가격 확인 SAME", 0, krPriced],
    ];
    for (const [k, a, b] of CMP) {
      console.log(`  ${k.padEnd(28)} ${String(a).padStart(14)} ${String(b).padStart(10)}`);
    }
    /**
     * 🔴🔴🔴 **열화된 실행에 판정을 붙이지 않는다**(이 저장소가 WU-133 에서 박은 게이트).
     *
     * 1차 실행이 **402 Payment Required** 로 떨어졌는데 이 블록이 없을 때
     * `krDetail = 0` 이라는 이유로 **「NO-GO」를 찍었다.** 🔴 그것을 그대로 보고하면
     * 「Gemini 도 국내 상세 URL 을 못 준다」는 **거짓 결론** 이 된다 — 실제로는
     * **호출 자체가 성립하지 않았다.** 「측정불가 ≠ 0」(헌장 §5-B).
     */
    const okCalls = m.outcomes.OK ?? 0;
    if (okCalls === 0) {
      console.log("\n  🔴🔴🔴 **측정불가 — 판정을 내리지 않는다**");
      console.log(`     Gemini 호출이 성립하지 않았다: ${JSON.stringify(m.outcomes)}`);
      console.log(`     ${m.failureDetails.join(" | ")}`);
      console.log("     🔴 위 표의 Gemini 열은 **「0」이 아니라 「측정불가」** 다.");
      console.log("     🔴 「Gemini 도 해결하지 못한다」로 적지 않는다(CPO §9 경로로 보고한다).");
    } else {
      const verdict = krDetail >= 3 ? "GO" : krDetail >= 1 ? "HOLD" : "NO-GO";
      console.log(`\n  🔴🔴 **판정 = ${verdict}** (국내 실제 상세 URL ${krDetail})`);
    }

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(m).toBeDefined();
  }, 900_000);
});
