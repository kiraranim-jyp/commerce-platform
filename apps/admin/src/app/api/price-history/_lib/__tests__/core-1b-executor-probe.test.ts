import { describe, expect, it } from "vitest";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import {
  createLivePageProbe,
  createProductionGoogleDiscovery,
  resolveCandidate,
  type DiscoveryQuery,
  type QueryId,
} from "@commerce/crawler/src/discovery-core";
import { buildDiscoveryQuerySet } from "@commerce/crawler/src/discovery-core/query-planner";
import {
  enrichCandidatePrices,
  factsFromProductUrl,
  fetchDomesticModelCode,
  isSelfReferenceCandidate,
  withConfidence,
  type ComparisonCandidate,
} from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { buildCrossSellerSearchQueries, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import {
  collectGeminiCandidatePool,
  identityFromDna,
  isGeminiDiscoveryEnabled,
  GEMINI_DISCOVERY_FLAG,
} from "../gemini-candidate-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { groupCandidatesByHost, normalizeCandidateUrl, GEMINI_VIRTUAL_SHOP_ID, GEMINI_VIRTUAL_SHOP_NAME } from "../transient-candidates";
import { classifyCandidateMarket } from "../candidate-market";
import { domesticMatchDisplay } from "../../../../pipeline/commerce/match-display";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-1B — **AI Search Executor Probe**(Gemini 먼저)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「**1상품 × 1회만 실행**」 ·「snippet 가격을 성공으로
 * 세지 않는다 — **AI Search → URL → 실제 fetch → 상품 상세 → 기존 Extract**」.
 *
 * ── 🟢🟢 복제식을 쓰지 «않는다» (§5-B) ──────────────────────────────────────
 * ```
 * 1단계 CONTROL = **운영 owner `collectGeminiCandidatePool` 를 그대로 부른다.**
 *   🔴 그 함수가 ⒜ Primary Query ⒝ **grounding 리다이렉트 해제**(`resolveCandidate`)
 *      ⒞ PRODUCT_PAGE 분류 ⒟ `factsFromProductUrl` 까지 전부 들고 있다.
 *   🔴 내가 그 루프를 베껴 쓰면 **운영이 아닌 것을 재게 된다**(이 트랙에서 네 번 났다).
 * 2단계 = 1단계가 **OK 일 때만** planner 의 나머지 축을 같은 하위 함수로 돌려
 *        **multi-query 증분** 을 잰다.
 * ```
 *
 * ── 🔴 비용 규율 ───────────────────────────────────────────────────────────
 * ```
 * 1단계가 OK 가 아니면 **거기서 멈춘다**(추가 과금 0).
 * 🔴 「1상품 1회」와 「multi-query」가 지시서에 같이 있어 **싼 쪽을 먼저** 택했다.
 * ```
 *
 * ── 🟢 운영 flag 를 «켜지 않았다» ──────────────────────────────────────────
 * ```
 * `isGeminiDiscoveryEnabled()` 는 **호출부**(`runDomesticPriceCheck`)가 보는 값이고
 * 이 owner 는 그것을 보지 않는다 ⟹ 🟢 **flag 를 ON 한 적이 없다.**
 * 🔴 그래서 「Probe 뒤 OFF」보다 안전하다 — 전역 스위치가 **한 번도 열리지 않았다**
 *    (메모 `gemini-flag-is-a-global-switch-not-a-per-product-control`).
 * ```
 *
 * 🔴 Planner 신규 **운영** 호출부 0 · synonym 0 · Query 추가 실험 0 ·
 *    Adapter/Registry 0 · MI/SAME/MODEL_CODE 0 · 가격/UI 0 · Seller 입력 0 · seed 0.
 * 🔴 게이트 `CORE1B_PROBE=1` 없으면 SKIP(실제 과금이 발생한다).
 */
const LIVE = process.env.CORE1B_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
/** 🟢 국내 어댑터 등록부(8) — 「Registry 밖」을 세기 위한 기준(DB 실측값). */
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
/** 🔴 「국내」 판정은 **운영 `classifyCandidateMarket`** 이 한다. 이 정규식은
 *     ④ 를 세기 위한 **호스트 선별** 일 뿐이고 판정이 아니다. */
const KR_HOST = /(\.kr$)|coupang|bunjang|trenbe|mustit|gmarket|ssg\.com|lotte|musinsa|wconcept|29cm|feelway|naver/i;
const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
};

describe("CORE-1B — AI Search Executor Probe", () => {
  it.runIf(LIVE)("Gemini — 운영 owner 로 1회 부르고 끝까지 추적한다", async () => {
    /* eslint-disable no-console */
    const t0 = Date.now();

    /** 🔴 내가 flag 를 켰는지 **먼저 적는다** — 나중에 「OFF 했다」로 끝내지 않는다. */
    const flagAtStart = isGeminiDiscoveryEnabled();

    /**
     * 🔴🔴 **브랜드 복구는 간헐적으로 실패한다 — 측정 전에 확보한다**(§5-B).
     *
     * 실측(이 Probe 직전 · 무료 진단): `bobochoses.com` 의 HTML 응답이 **간헐적으로**
     * null 이고, 그때 `fillRejectedBrand` 가 `siteBrandName` 을 채우지 못해
     * `brand` 가 **빈 문자열** 이 된다. 🔴 그 상태로 planner 를 돌리면 브랜드 축이
     * **전부 사라져** 질의가 `CODE_ONLY` **1개** 가 된다 ⟹ 「multi-query 를 쟀다」가
     * 거짓이 된다(1차 실행에서 실제로 그랬다).
     *
     * 🟢 그래서 **운영 함수 `shopifySiteStrategy.extract` 를 그대로 재시도** 한다 —
     *    값을 지어내지 않는다. 한 번 성공하면 FINAL-1 memo 가 그 host 를 기억한다.
     * 🔴 **몇 번째에 성공했는지 보고에 적는다** — 운영 1회성 노출을 숨기지 않는다.
     */
    let ex = await shopifySiteStrategy.extract(ORIGIN);
    let brandAttempts = 1;
    const brandOf = (r: typeof ex): string =>
      String((r?.productData as Record<string, unknown> | undefined)?.siteBrandName ?? "");
    while (!brandOf(ex) && brandAttempts < 4) {
      await new Promise((r) => setTimeout(r, 20_000));
      ex = await shopifySiteStrategy.extract(ORIGIN);
      brandAttempts += 1;
    }
    expect(ex, "원상품 추출 실패 — 이 Probe 가 성립하지 않는다").not.toBeNull();
    const product = buildCanonicalProduct(
      ORIGIN,
      ex!.productData as ExtractedProductData,
      {} as Record<string, ProductDataSource>,
      [],
    );
    const dna = buildProductIdentityDna(product);
    const identity = identityFromDna(dna);
    const planned = buildDiscoveryQuerySet(identity);

    console.log("\n════════ 🔴 CORE-1B — Gemini Probe (B226AC009) ════════");
    console.log(`  운영 flag ${GEMINI_DISCOVERY_FLAG} = ${flagAtStart ? "🔴 true" : "🟢 false(건드리지 않았다)"}`);
    console.log(
      `  원상품 brand=${JSON.stringify(identity.brand)} code=${identity.productCode}` +
        ` · 🔴 brand 복구 시도 **${brandAttempts}회**${brandAttempts > 1 ? "(운영 1회성은 실패했다)" : ""}`,
    );
    /** 🔴 brand 가 끝까지 비면 **planner 가 1축으로 쪼그라든다** — 그 사실을 적고 간다. */
    if (!identity.brand) {
      console.log("  🔴🔴 brand 복구 실패 ⟹ planner 질의가 CODE_ONLY 1개로 줄어든다(측정 열화)");
    }
    console.log(`  Planner 질의 ${planned.length}개:`);
    for (const q of planned) console.log(`    ${q.axis.padEnd(17)} ${q.text}`);

    /* ── 1단계 CONTROL — 운영 owner ─────────────────────────────────────── */
    console.log("\n──── 1단계 CONTROL — 운영 owner `collectGeminiCandidatePool`(1 call) ────");
    const pool = await collectGeminiCandidatePool({
      dna,
      scopedDomains: [],
      categoryScopes: null,
      maxCandidates: 20,
      targetUsable: 20,
      maxQueries: 1,
      existingNormalizedUrls: new Set<string>(),
    });
    const m = pool.metrics;
    console.log(`  outcomes            ${JSON.stringify(m.outcomes)}`);
    console.log(`  primaryQuery        ${JSON.stringify(m.primaryQuery)} (${m.primaryQueryLevel})`);
    console.log(`  geminiCalls         ${m.geminiCalls}`);
    console.log(`  groundingQueries    ${m.groundingQueries}`);
    console.log(`  groundingQueryTexts ${JSON.stringify(m.groundingQueryTexts)}`);
    console.log(`  discoveredUrls      ${m.discoveredUrls}`);
    console.log(`  usableProductUrls   ${m.usableProductUrls}`);
    console.log(`  miEligible          ${m.miEligibleCandidates}`);
    console.log(`  tokens              ${m.totalTokens} (model ${m.model})`);
    if (m.failureDetails.length > 0) console.log(`  🔴 failureDetails   ${JSON.stringify(m.failureDetails)}`);

    const okCalls = m.outcomes.OK ?? 0;
    const got402 = m.failureDetails.some((d) => /402|Payment Required|RESOURCE_EXHAUSTED|quota/i.test(d));
    const configMissing = (m.outcomes.CONFIG_MISSING ?? 0) > 0;

    /* ── 2단계 — OK 일 때만 planner 나머지 축 ────────────────────────────── */
    const extra: ComparisonCandidate[] = [];
    let extraCalls = 0;
    let extraGrounding = 0;
    let extraDiscovered = 0;
    if (okCalls > 0) {
      console.log("\n──── 2단계 — 1단계가 OK ⟹ planner 나머지 축으로 multi-query 증분 측정 ────");
      const seen = new Set<string>(
        pool.searchResults.flatMap((r) => r.candidates.map((c) => normalizeCandidateUrl(c.url))),
      );
      const probe = createLivePageProbe({ onResult: () => {} });
      /** 🔴 1단계가 이미 쓴 축(Primary = BRAND_CODE 상당)은 건너뛴다 — 같은 질의를 두 번 과금하지 않는다. */
      const rest = planned.filter((q) => q.text !== m.primaryQuery).slice(0, 4);
      for (let i = 0; i < rest.length; i += 1) {
        const q = rest[i];
        const dq: DiscoveryQuery = {
          id: (`Q${Math.min(8, i + 2)}` as QueryId),
          axis: `planner:${q.axis}`,
          text: q.text,
          usedFields: [],
        };
        const d = await createProductionGoogleDiscovery(identity, dq);
        extraCalls += d.usage?.requests ?? 0;
        extraGrounding += d.usage?.groundingQueries ?? 0;
        extraDiscovered += d.urls.length;
        console.log(`  → ${q.axis.padEnd(17)} ${d.outcome} urls=${d.urls.length} grounding=${d.usage?.groundingQueries ?? 0}`);
        if (d.outcome !== "OK") continue;
        for (const found of d.urls) {
          const key = normalizeCandidateUrl(found.url);
          if (seen.has(key)) continue;
          seen.add(key);
          try {
            const resolved = await resolveCandidate(found.url, [found], probe);
            if (resolved.classification !== "PRODUCT_PAGE") continue;
            const target = resolved.crawlerUrl ?? resolved.finalUrl;
            if (!target) continue;
            const fk = normalizeCandidateUrl(target);
            if (fk !== key && seen.has(fk)) continue;
            seen.add(fk);
            const facts = await factsFromProductUrl(target);
            if (facts.status !== "OK" || !facts.candidate) continue;
            extra.push(facts.candidate);
          } catch {
            /* 후보 하나의 실패가 나머지를 죽이지 않는다 — 운영과 같은 원칙 */
          }
        }
      }
      console.log(`  2단계 증분 후보 ${extra.length}건 · 추가 call ${extraCalls} · 추가 grounding ${extraGrounding}`);
    } else {
      console.log("\n  🔴 1단계가 OK 가 아니다 ⟹ **2단계를 실행하지 않았다**(추가 과금 0)");
    }

    /* ── 전체 후보 → 기존 Fetch/Extract/MI 경로 ─────────────────────────── */
    const results = [
      ...pool.searchResults,
      ...groupCandidatesByHost(extra, { shopId: GEMINI_VIRTUAL_SHOP_ID, shopNamePrefix: GEMINI_VIRTUAL_SHOP_NAME }),
    ];
    const allUrls = results.flatMap((r) => r.candidates.map((c) => c.url));
    const krDetail = allUrls.filter((u) => KR_HOST.test(hostOf(u)));
    const outside = krDetail.filter((u) => !REGISTRY.has(hostOf(u)));

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

    let extractOk = 0;
    let sameKr = 0;
    let pricedKr = 0;
    const rows: string[] = [];
    for (const res of results) {
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
        rows.push(`    ${res.domain.padEnd(26)} ${j.kind}`);
        continue;
      }
      const tier = domesticMatchDisplay(j.matchTruth as never).tier;
      const mk = classifyCandidateMarket({
        domain: res.domain,
        currency: j.best.price?.currency ?? null,
        isRegisteredDomesticShop: REGISTRY.has(res.domain),
      });
      rows.push(
        `    ${res.domain.padEnd(26)} tier=${String(tier).padEnd(14)} market=${String(mk.market).padEnd(8)} ` +
          `${j.best.price?.amount ?? "-"} ${j.best.price?.currency ?? ""}`,
      );
      if (mk.market === "KR" && tier === "SAME") {
        sameKr += 1;
        if (j.best.price?.amount != null) pricedKr += 1;
      }
    }

    const ms = Date.now() - t0;
    console.log("\n════════ 🔴 KPI 12 ════════");
    console.log(`  ① Gemini 실제 호출 수        ${m.geminiCalls + extraCalls}`);
    console.log(`  ② grounding 결과 수          ${m.groundingQueries + extraGrounding}`);
    console.log(`  ③ 발견 URL 수                ${m.discoveredUrls + extraDiscovered}`);
    console.log(`  ④ 🔴 국내 상품 상세 URL(unique) **${new Set(krDetail).size}**`);
    console.log(`  ⑤ Registry 밖 국내 URL        ${new Set(outside).size}`);
    console.log(`  ⑥ Fetch 성공(상세 도달)       ${m.usableProductUrls + extra.length}`);
    console.log(`  ⑦ Extract 성공(가격 확보)      ${extractOk}`);
    console.log(`  ⑧ MI SAME(국내)              ${sameKr}`);
    console.log(`  ⑨ 가격 확인(국내 SAME)         ${pricedKr}`);
    console.log(`  ⑩ 실제 과금액                🔴 **UNKNOWN** — CTO 는 Billing 을 읽을 수 없다`);
    console.log(`  ⑪ 402/쿼터 여부              ${got402 ? "🔴 **예**" : configMissing ? "🔴 CONFIG_MISSING" : "아니오"}`);
    console.log(`  ⑫ latency                    ${Math.round(ms / 1000)}s`);
    if (rows.length > 0) {
      console.log("\n  판정 상세:");
      for (const r of rows) console.log(r);
    }

    const verdict =
      configMissing
        ? "🔴 **FAIL — CONFIG_MISSING**(키/설정 부재 ⟹ executor 로 쓸 수 없다)"
        : okCalls === 0
          ? `🔴 **FAIL — Gemini 호출이 성립하지 않는다**${got402 ? "(402/쿼터)" : ""}`
          : new Set(krDetail).size >= 1
            ? "🟢 **PASS 후보 — 국내 상품 상세 URL 이 실제로 나왔다**"
            : "🔴 **FAIL — 호출은 되는데 «국내 상품 상세 URL» 이 0**";
    console.log(`\n  🔴🔴 Gemini 판정 = ${verdict}`);
    console.log("  🔴 ④ 는 **운영이 PRODUCT_PAGE 로 분류하고 facts 까지 뽑아낸 후보** 의 URL 이다 —");
    console.log("     grounding snippet 이나 분류 전 URL 을 세지 않았다.");

    /** 🔴 운영 flag 가 이 Probe 로 바뀌지 않았음을 **끝에서 확인** 한다. */
    expect(isGeminiDiscoveryEnabled(), "🔴 운영 flag 가 바뀌었다").toBe(flagAtStart);
    expect(flagAtStart, "🔴 운영 flag 가 ON 이면 이 Probe 는 전역 스위치를 쓴 것이다").toBe(false);
    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(m).toBeDefined();
  }, 900_000);
});
