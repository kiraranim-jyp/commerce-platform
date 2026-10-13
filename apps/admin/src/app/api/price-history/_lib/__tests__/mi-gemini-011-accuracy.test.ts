/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-ACCURACY-LONG-SPRINT-011 — ON-axis 재측정 (실제 Gemini + 실제 HTTP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **운영 경로를 그대로 흉내낸다**(WU-010R 이후 모양):
 *      Gemini pool
 *        → isSelfReferenceCandidate 제거      (008A 정책 · §10)
 *        → withConfidence                      (기존)
 *        → enrichCandidatePrices               (기존 owner · §5)
 *        → judgeDomesticCandidate              (기존)
 *        → priceTierFromLink                   (기존 owner · 복제 금지)
 *        → priceKrw != null 만 transient 레코드
 *        → summarizeDomesticMarketSplit        (기존 집계 · before/after 비교)
 *
 * 🔴🔴 **5단계를 섞지 않는다**(§4):
 *      Discovery ≠ Match ≠ Domestic ≠ Price ≠ Registration Decision
 *
 * 🔴 Ground Truth 는 **근거가 있을 때만** 적는다(§3). 없으면 `UNKNOWN` 이다 —
 *    억지로 PASS/FAIL 을 만들지 않는다.
 *
 * 🔴 DB 쓰기 0 · threshold 0 · 모델 0. 기본값 SKIP(`MI_P0_02_LIVE=1`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeDomesticMarketSplit, type PriceObservationRecord } from "@commerce/pricing";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
/**
 * 🔴🔴 **예산이 표본을 결정했다 — 숨기지 않고 적는다.**
 *    CPO 한도 ₩7,607. 오늘 차감 ₩17,393 ÷ 실제 grounded 호출 약 20~26회
 *    → 호출당 약 ₩670~870 → 한도는 **약 9~11 호출** 분이다.
 *    그래서 §12 권장(아동 12~15 · 테니스 5~10, 상품당 2쿼리 = 최대 36호출)을
 *    **쓸 수 없다.** 상품 수를 유지하는 대신 **상품당 쿼리를 1 로 줄였다**
 *    (MI-GEMINI-INTEG-002 가 쓴 것과 같은 조건 — queries[0] 하나).
 * 🔴 그러므로 WU-4(쿼리 2) 와 **discovery 조건이 다르다.** Before/After 를
 *    비교할 때 그 차이를 반드시 같이 적는다(§2 「조건이 다른 KPI 는 억지로
 *    비교하지 않는다」).
 */
const KIDS_N = Number(process.env.MI_011_KIDS ?? 6);
const TENNIS_N = Number(process.env.MI_011_TENNIS ?? 2);
const MAX_QUERIES = Number(process.env.MI_011_MAX_QUERIES ?? 1);

interface UrlRow { id: string; source_url: string; title: string; brand: string }
interface SnapRow { id: string; canonicalProduct: unknown; description: string | null }
interface ObsRow {
  snapshot_id: string; id: string; source: string; source_label: string | null;
  source_product_url: string | null; source_ref_id: string | null; currency: string;
  price_amount: string | number | null; price_krw: string | number | null;
  sold_out: boolean | null; market_code: string | null; checked_at: string;
}
interface LinkRow { snapshot_id: string; domain: string; match_truth: string | null; verified: boolean }
interface SourceRow {
  id: string; name: string; domain: string; currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
  status: string; accessStatus: string | null; categoryScope: string[] | null; enabled: boolean;
}
interface RawResult { shopId: string; shopName: string; domain: string; status: string; candidates: Record<string, unknown>[] }

const tally = (xs: string[]): Record<string, number> => {
  const t: Record<string, number> = {};
  for (const x of xs) t[x] = (t[x] ?? 0) + 1;
  return t;
};
const num = (v: string | number | null): number | null =>
  v == null ? null : typeof v === "number" ? v : Number(v);

describe.skipIf(!LIVE)("🔴 MI-011 — ON-axis 정확도 재측정", () => {
  it(
    "Discovery → self-ref → price → market → MI 를 실제 데이터로 끝까지 잰다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const groups = read<Record<string, UrlRow[]>>("e2e-urls.json");
      const snaps = read<SnapRow[]>("e2e-snapshots.json");
      const sources = read<SourceRow[]>("e2e-sources.json");
      const observations = read<ObsRow[]>("e2e-observations.json");
      const links = read<LinkRow[]>("e2e-links.json");

      const crawler = (await import("@commerce/crawler")) as unknown as {
        searchDomesticShops: (q: unknown, s: unknown[]) => Promise<RawResult[]>;
        withConfidence: (q: unknown, c: unknown[]) => Record<string, unknown>[];
        enrichCandidatePrices: (c: unknown[], domain: string, q?: unknown) => Promise<Record<string, unknown>[]>;
        isSelfReferenceCandidate: (a: string | undefined, b: string) => boolean;
        extractForeignModelCode: (d: string | undefined) => string | null;
        fetchDomesticModelCode: (domain: string, url: string) => Promise<string | null>;
      };
      const shared = (await import("@commerce/shared")) as unknown as {
        buildProductIdentityDna: (p: unknown) => Record<string, unknown>;
        backfillCanonicalProduct: (p: unknown) => unknown;
        buildCrossSellerSearchQueries: (dna: unknown) => string[];
        productFactsFromIdentityDna: (dna: unknown) => Record<string, unknown>;
      };
      const { isBatchSurveyTarget, judgeDomesticCandidate } = await import("../run-domestic-price-check");
      const { priceTierFromLink } = await import("../../../domestic-price-sources/_lib/domestic-product-link");
      const { collectGeminiCandidatePool, normalizeCandidateUrl } = await import("../gemini-candidate-pool");

      const targetsFor = (scopes: string[] | null) =>
        sources
          .filter((s) => isBatchSurveyTarget(s as never, scopes))
          .filter((s) => s.collectionStrategy === "AUTO_API" || s.collectionStrategy === "AUTO_SCRAPE");

      const kidsAll = [...(groups.control ?? []), ...groups.kids, ...groups.kids2];
      const seenId = new Set<string>();
      const kids = kidsAll.filter((r) => (seenId.has(r.id) ? false : (seenId.add(r.id), true))).slice(0, KIDS_N);
      const plan = [
        ...kids.map((row) => ({ row, scopes: ["KIDS_FASHION"] })),
        ...groups.tennis.slice(0, TENNIS_N).map((row) => ({ row, scopes: ["TENNIS"] })),
      ];

      /** 🔴 §8 — 기존 국내 관측을 **운영과 같은 모양** 으로 되살린다(DB 그대로). */
      const existingFor = (snapshotId: string): PriceObservationRecord[] =>
        observations
          .filter((o) => o.snapshot_id === snapshotId)
          .map((o) => ({
            id: o.id, snapshotId: o.snapshot_id, source: "DOMESTIC_SHOP" as const,
            sourceLabel: o.source_label, sourceProductUrl: o.source_product_url,
            sourceRefId: o.source_ref_id, currency: o.currency,
            priceAmount: num(o.price_amount), shippingCostAmount: null, taxAmount: null,
            exchangeRate: null, priceKrw: num(o.price_krw), salePriceKrw: null,
            originalPriceKrw: null, soldOut: o.sold_out, marketCode: o.market_code,
            marketCountry: null, shippingPolicyStatus: null, shippingPolicyNote: null,
            checkedAt: new Date(o.checked_at).toISOString(),
          }));

      const products: Record<string, unknown>[] = [];
      const cost = { geminiCalls: 0, groundingQueries: 0, totalTokens: 0, resolve: 0, fetch: 0, enrichCalls: 0, domesticDetail: 0 };
      const outcomes: string[] = [];
      const failures: string[] = [];
      const funnel = {
        discovered: 0, usable: 0, miCandidates: 0, selfRefRemoved: 0,
        shopifyUrl: 0, nonShopifyUrl: 0, priceOk: 0, priceFail: 0, krwEvidence: 0,
      };
      const byDomain = new Map<string, { candidates: number; priceOk: number; priceFail: number; currencies: string[]; tiers: string[]; shopify: number }>();
      const bump = (d: string) => {
        if (!byDomain.has(d)) byDomain.set(d, { candidates: 0, priceOk: 0, priceFail: 0, currencies: [], tiers: [], shopify: 0 });
        return byDomain.get(d)!;
      };
      let modelUsed: string | null = null;

      for (const { row, scopes } of plan) {
        const snap = snaps.find((x) => x.id === row.id);
        if (!snap) { products.push({ title: row.title, "🔴": "스냅샷 없음" }); continue; }

        const dna = shared.buildProductIdentityDna(shared.backfillCanonicalProduct(snap.canonicalProduct));
        const qFacts = shared.productFactsFromIdentityDna(dna);
        const terms = shared.buildCrossSellerSearchQueries(dna).filter(Boolean);
        const query = {
          title: String(qFacts.title), brand: qFacts.brand ?? undefined, sourceUrl: qFacts.sourceUrl,
          searchTerm: terms[0] ?? row.title, searchTerms: terms, facts: qFacts,
        };
        const foreignModelCode =
          crawler.extractForeignModelCode(snap.description ?? undefined) ?? (dna.brandModelCode as string | null);
        const foreignColor = (dna.color as string | null) ?? null;
        const targets = targetsFor(scopes);
        const counters = { fetch: 0 };

        /** ── OFF — 기존 국내 탐색(§13 의 「기존 Discovery only」) ─────────── */
        const domestic = await crawler.searchDomesticShops(
          query,
          targets.map((s) => ({ id: s.id, name: s.name, domain: s.domain, currency: s.currency, collectionStrategy: s.collectionStrategy })),
        );
        const domesticUrls = new Set(domestic.flatMap((r) => r.candidates.map((c) => normalizeCandidateUrl(String(c.url)))));

        /** ── Gemini pool ───────────────────────────────────────────────── */
        const pool = await collectGeminiCandidatePool({
          dna: dna as never, scopedDomains: targets.map((s) => s.domain), categoryScopes: scopes,
          maxCandidates: 3, targetUsable: 3, maxQueries: MAX_QUERIES, existingNormalizedUrls: domesticUrls,
        });
        cost.geminiCalls += pool.metrics.geminiCalls;
        cost.groundingQueries += pool.metrics.groundingQueries;
        cost.totalTokens += pool.metrics.totalTokens;
        cost.resolve += pool.metrics.resolveCalls;
        cost.fetch += pool.metrics.fetchCalls;
        if (pool.metrics.model) modelUsed = pool.metrics.model;
        for (const [k, v] of Object.entries(pool.metrics.outcomes)) for (let i = 0; i < v; i += 1) outcomes.push(k);
        failures.push(...pool.metrics.failureDetails);
        funnel.discovered += pool.metrics.discoveredUrls;
        funnel.usable += pool.metrics.usableProductUrls;
        funnel.miCandidates += pool.metrics.miEligibleCandidates;

        /** ── 운영 배선과 동일: 자기참조 → 점수 → 가격 보강 ─────────────── */
        const geminiJudged: Record<string, unknown>[] = [];
        const evidence: { domain: string; url: string; matchTruth: string | null; verified: boolean; tier: string; priceKrw: number | null; priceCurrency: string | null; priceStatus: string | null; verdict: string | null }[] = [];
        for (const r of pool.searchResults) {
          const before = r.candidates.length;
          const notSelf = r.candidates.filter((c) => !crawler.isSelfReferenceCandidate(query.sourceUrl as string | undefined, String(c.url)));
          funnel.selfRefRemoved += before - notSelf.length;
          if (notSelf.length === 0) continue;
          const scored = crawler.withConfidence(query, notSelf);
          const d = bump(r.domain);
          d.candidates += notSelf.length;
          for (const c of notSelf) {
            /* 🔴 **내 1차 분류가 틀렸다.** `/products/<slug>` 정규식만 보니
             *    `musinsa.com` 2건을 Shopify 로 셌다. Shopify 여부는 URL 모양이
             *    아니라 **`enrichCandidatePrices` 가 실제로 쓸 수 있는가** 다 —
             *    그 함수는 `extractShopifyHandle` 로 handle 을 뽑고
             *    `${origin}/products/${handle}` 에 `.json` 을 요청한다.
             * 🟢 그래서 「handle 추출 가능」만 「enrich 시도 대상」으로 세고,
             *    실제 Shopify 여부는 **가격 확보 성공 여부** 로만 말한다. */
            const isShopify = /\/products\/[a-z0-9-]+/i.test(String(c.url));
            if (isShopify) { funnel.shopifyUrl += 1; d.shopify += 1; } else funnel.nonShopifyUrl += 1;
          }
          let priced = scored;
          try {
            priced = (await crawler.enrichCandidatePrices(scored, r.domain, query)) as Record<string, unknown>[];
            cost.enrichCalls += 1;
          } catch { /* fail-soft */ }
          for (const c of priced) {
            const ok = c.priceStatus === "VERIFIED_CURRENT";
            if (ok) { funnel.priceOk += 1; d.priceOk += 1; } else { funnel.priceFail += 1; d.priceFail += 1; }
            const cur = (c.price as { currency?: string } | null)?.currency;
            if (cur) d.currencies.push(cur);
          }
          const judgement = await judgeDomesticCandidate({
            domain: r.domain, candidates: priced as never, sourceUrl: query.sourceUrl as string | undefined,
            foreignModelCode, foreignColor,
            fetchModelCode: (url: string) => { counters.fetch += 1; return crawler.fetchDomesticModelCode(r.domain, url); },
          });
          if (judgement.kind !== "JUDGED") {
            geminiJudged.push({ domain: r.domain, kind: judgement.kind, gate: (judgement as { gate?: string }).gate ?? null });
            continue;
          }
          const best = judgement.best as unknown as Record<string, unknown>;
          const tier = priceTierFromLink({ matchTruth: judgement.matchTruth, verified: judgement.verified } as never);
          const price = best.price as { amount: number; currency: string } | null;
          const priceKrw = best.priceStatus === "VERIFIED_CURRENT" && price?.currency === "KRW" ? price.amount : null;
          if (priceKrw != null) funnel.krwEvidence += 1;
          d.tiers.push(tier);
          geminiJudged.push({ domain: r.domain, kind: "JUDGED", matchTruth: judgement.matchTruth, verified: judgement.verified, tier, verdict: best.crossSellerVerdict ?? null, title: best.title ?? null, url: best.url ?? null, priceStatus: best.priceStatus ?? null, priceCurrency: price?.currency ?? null, priceAmount: price?.amount ?? null });
          evidence.push({ domain: r.domain, url: String(best.url), matchTruth: judgement.matchTruth, verified: judgement.verified, tier, priceKrw, priceCurrency: price?.currency ?? null, priceStatus: (best.priceStatus as string | undefined) ?? null, verdict: (best.crossSellerVerdict as string | undefined) ?? null });
        }
        cost.domesticDetail += counters.fetch;

        /** ── §9/§13 집계 before/after — 기존 규칙으로만 ─────────────────── */
        const existing = existingFor(row.id);
        const linkTier = new Map(links.filter((l) => l.snapshot_id === row.id).map((l) => [l.domain, priceTierFromLink({ matchTruth: l.match_truth, verified: l.verified } as never)]));
        const exBefore = existing.filter((o) => linkTier.get(String(o.sourceLabel)) === "EXACT");
        const cmpBefore = existing.filter((o) => linkTier.get(String(o.sourceLabel)) === "COMPARISON");
        const transientFor = (t: string) =>
          evidence.filter((e) => e.priceKrw != null && e.tier === t).map((e, i): PriceObservationRecord => ({
            id: `gemini-transient:${i}`, snapshotId: row.id, source: "DOMESTIC_SHOP",
            sourceLabel: e.domain, sourceProductUrl: e.url, sourceRefId: null, currency: "KRW",
            priceAmount: e.priceKrw, shippingCostAmount: null, taxAmount: null, exchangeRate: null,
            priceKrw: e.priceKrw, salePriceKrw: null, originalPriceKrw: null, soldOut: null,
            marketCode: null, marketCountry: null, shippingPolicyStatus: null, shippingPolicyNote: null,
            checkedAt: "2026-10-13T00:00:00.000Z",
          }));
        const before = summarizeDomesticMarketSplit(exBefore, cmpBefore);
        const after = summarizeDomesticMarketSplit([...exBefore, ...transientFor("EXACT")], [...cmpBefore, ...transientFor("COMPARISON")]);

        products.push({
          brand: row.brand, title: row.title.slice(0, 48), scope: scopes[0],
          "scope 통과 샵": targets.length,
          "OFF 국내후보": domestic.reduce((a, r) => a + r.candidates.length, 0),
          "Gemini outcome": pool.metrics.outcomes,
          "Gemini 발견": pool.metrics.discoveredUrls,
          "Gemini MI후보": pool.metrics.miEligibleCandidates,
          "Gemini host": pool.searchResults.map((r) => r.domain),
          "판정": geminiJudged,
          "🟢 가격 KRW evidence": evidence.filter((e) => e.priceKrw != null).length,
          "집계 before": { basis: before.basis, exactSellers: before.exact.sellerCount, lowest: before.resolved.lowestPriceKrw },
          "집계 after": { basis: after.basis, exactSellers: after.exact.sellerCount, lowest: after.resolved.lowestPriceKrw },
          "🔴 집계가 바뀌었는가": before.basis !== after.basis || before.exact.sellerCount !== after.exact.sellerCount || before.resolved.lowestPriceKrw !== after.resolved.lowestPriceKrw,
          "🔴🔴 기존 증거가 줄었는가": after.exact.sellerCount < before.exact.sellerCount || (before.resolved.lowestPriceKrw != null && after.resolved.lowestPriceKrw == null),
        });
      }

      const real = products.filter((p) => !p["🔴"]);
      const allJudged = real.flatMap((p) => p["판정"] as Record<string, unknown>[]);
      const judged = allJudged.filter((j) => j.kind === "JUDGED");
      const sum = (k: string) => real.reduce((a, p) => a + Number(p[k] ?? 0), 0);

      const report = {
        "🔴🔴 DISCLAIMER":
          `sample 상품 N=${real.length} (아동 ${kids.length} · 테니스 ${plan.length - kids.length}) · ` +
          `🔴 상품당 쿼리 ${MAX_QUERIES} (WU-4 는 2 — **예산 한도 ₩7,607 때문에 줄였다**). ` +
          "🔴 DB 쓰기 0 · upsert 0 · threshold 0 · 모델 변경 0. " +
          "🔴 5단계를 섞지 않는다 — Discovery ≠ Match ≠ Domestic ≠ Price ≠ Decision.",
        "① 모델": modelUsed,
        "② Discovery": {
          "Gemini 발견 URL": funnel.discovered,
          "상품페이지 해석": funnel.usable,
          "MI 후보 생성": funnel.miCandidates,
          outcome: tally(outcomes),
          "실패 사유": tally(failures),
        },
        "③ Self-reference (008A)": { "제거된 후보": funnel.selfRefRemoved },
        "④ Price Enrichment": {
          "handle 추출 가능 URL(= enrich 시도 대상)": funnel.shopifyUrl,
          "🔴 handle 없음(= enrich 불가)": funnel.nonShopifyUrl,
          "가격 확보(VERIFIED_CURRENT)": funnel.priceOk,
          "가격 미확보": funnel.priceFail,
          "🟢 KRW 국내가격 evidence": funnel.krwEvidence,
          "enrich 호출": cost.enrichCalls,
        },
        "⑤ MI 판정 (judgeDomesticCandidate)": {
          kind: tally(allJudged.map((j) => String(j.kind))),
          gate: tally(allJudged.filter((j) => j.gate).map((j) => String(j.gate))),
          matchTruth: tally(judged.map((j) => String(j.matchTruth ?? "(null)"))),
          verdict: tally(judged.map((j) => String(j.verdict ?? "(null)"))),
          "🔴🔴 tier": tally(judged.map((j) => String(j.tier))),
        },
        "⑥🔴🔴 유효 국내 EXACT": {
          "tier EXACT 판정": judged.filter((j) => j.tier === "EXACT").length,
          "그중 KRW 가격까지 있는 것": judged.filter((j) => j.tier === "EXACT" && j.priceCurrency === "KRW" && j.priceStatus === "VERIFIED_CURRENT").length,
          "🔴 주의": "tier EXACT 는 identity 축이다. 국내 가격 evidence 가 되려면 KRW 가격이 더 필요하다.",
        },
        "⑦ 집계 효과 (§9)": {
          "집계가 바뀐 상품": real.filter((p) => p["🔴 집계가 바뀐 상품"] === true || p["🔴 집계가 바뀌었는가"] === true).length,
          "🔴🔴 기존 증거가 줄어든 상품": real.filter((p) => p["🔴🔴 기존 증거가 줄었는가"] === true).length,
          "KRW evidence 합": sum("🟢 가격 KRW evidence"),
        },
        "⑧ 비용/HTTP (§6)": {
          "Gemini 호출": cost.geminiCalls,
          "🔴🔴 grounding 쿼리(과금 단위)": cost.groundingQueries,
          "호출당 grounding 쿼리": cost.geminiCalls ? +(cost.groundingQueries / cost.geminiCalls).toFixed(2) : null,
          "총 토큰": cost.totalTokens,
          "우리 resolve": cost.resolve, "우리 fetch(후보 확보)": cost.fetch,
          "🔴 가격 enrich 호출": cost.enrichCalls,
          "🔴 국내 상세 fetch(품번)": cost.domesticDetail,
          "🔴 실제 KRW 소모액": "CTO 가 읽을 수 없다 — AI Studio 잔액 판독이 ground truth(§10-4)",
          "🔴 상품당 소모액": "위와 같은 이유로 측정 불가. 호출/쿼리/토큰만 제공한다",
        },
        "⑨ Domain Coverage": [...byDomain.entries()].map(([domain, v]) => ({
          domain, candidates: v.candidates, "handle 추출 가능": v.shopify,
          priceOk: v.priceOk, priceFail: v.priceFail,
          currencies: tally(v.currencies), tiers: tally(v.tiers),
        })),
        products,
      };

      mkdirSync(OUT_DIR, { recursive: true });
      let seq = 1;
      while (existsSync(path.join(OUT_DIR, `acc011-${seq}.json`))) seq += 1;
      writeFileSync(path.join(OUT_DIR, `acc011-${seq}.json`), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, products: `(${products.length}건 — acc011-${seq}.json)` }, null, 1));

      expect(real.length).toBeGreaterThan(0);
      /** 🔴🔴 §9 — 기존 증거가 줄어들면 **실패** 다(Gemini 가 덮어쓰면 안 된다). */
      expect(real.filter((p) => p["🔴🔴 기존 증거가 줄었는가"] === true)).toEqual([]);
    },
    180 * 60 * 1000,
  );
});
