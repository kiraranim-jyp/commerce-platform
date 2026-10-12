/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Price Enrichment WU — STEP 2~5: 가격 보강이 Seller Decision 을 바꾸는가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. Production 을 바꾸지 않는다.
 * 🔴🔴 Discovery 축은 **COUNTERFACTUAL / NON-PRODUCTION** 이다(External Discovery
 *      운영 호출부 0). 🟢 단 **가격·결정 축은 운영 owner 그대로** 다.
 *
 * ── 🟢 §5-B Preflight 결과 (실측 확인) ────────────────────────────────────
 *   `enrichCandidatePrices(candidates, shopDomain, query?)`  price-source-adapter.ts:243
 *     → `selectCandidatesForDetailConfirmation` 가 고른 것만 상세 조회
 *       🔴 실제 규칙은 `very_high | high | **medium**` 이거나
 *          `deriveProductMatchTruth === "SAME_MODEL_VARIANT"` 다
 *          (주석은 very_high/high 라고 적혀 있지만 코드가 medium 까지 받는다)
 *       🔴 상한 `MAX_DETAIL_CONFIRMATIONS_PER_SHOP = **2**` (샵당 2건)
 *     → `extractShopifyHandle(url)` 🔴 **Shopify 가 아니면 가격을 못 붙인다**
 *     → `fetchShopifyProductJson(origin/products/handle)`
 *     → 성공: price·regularPrice·priceSource="detail"·priceStatus="VERIFIED_CURRENT"
 *       실패: 🟢 price 를 «건드리지 않는다»(verificationAttempted=true 만 남는다)
 *
 * ── 🔴 지시서 어휘 정정 ───────────────────────────────────────────────────
 *   `AUTO_GO / NO_GO` 는 리포에 **없다**. 실제 어휘로 잰다 —
 *     `PriceDecisionVerdict`  MAINTAIN | CONSIDER_LOWER | MARGIN_RISK
 *     `DomesticPriceBasis`    EXACT | COMPARISON | NONE
 *   🟢 Before/After 가 깨끗하다 — `PriceDecisionInput` 에서
 *      `domesticLowestPriceKrw`·`domesticAveragePriceKrw`·`domesticBasis` **세 칸만**
 *      바뀌고 `costPriceKrw`·`currentSellingPriceKrw` 는 고정이다.
 *
 * ── 🔴 CONTROL (§5-B) ─────────────────────────────────────────────────────
 *   「가격이 나왔다」는 통과가 «아니다». `computePriceDecision` 이 **같은 입력에
 *    같은 verdict** 를 내는지 먼저 고정하고(순수 함수), 그 뒤에만 Before/After 를
 *    해석한다. 🔴 그리고 enrichment 실패를 「가격 없음」과 갈라 적는다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { enrichCandidatePrices, factsFromProductUrl, isSelfReferenceCandidate, selectCandidatesForDetailConfirmation, withConfidence } from "@commerce/crawler";
import { computePriceDecision, type DomesticPriceBasis } from "@commerce/pricing";
import type { ComparisonCandidate, ComparisonQuery } from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
/** 🔴 비용 상한 — 넘겨 버린 건수를 리포트에 적는다. */
const MAX_HOSTS = Number(process.env.MI_PRICE_MAX_HOSTS ?? 40);

const hostOf = (u: string): string => {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "?"; }
};

interface Golden { host: string; url: string; brand: string; title: string }
interface Rec { url: string; discovered: { url: string }[] }
interface Det { url: string; crawlerUrl: string | null; readable: boolean }
/** 선행 WU 가 남긴 counterfactual 행 — KNOWN_SAME 라벨을 재사용한다(§GT 재사용 승인). */
interface DiscRow {
  originTitle: string; candidateHost: string; label: string; tier: string | null;
  miUsedAsSame: boolean; bestTitle: string | null; visionScore: number | null;
}

describe.skipIf(!LIVE)("🔴 MI-PRICE-01 — 가격 보강의 Seller Decision 가치", () => {
  it(
    "enrichment 전후로 basis/verdict 가 바뀌는지 운영 함수로 잰다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const { golden, recs } = read<{ golden: Golden[]; recs: Rec[] }>("mi-p0-03-levels.json");
      const det = new Map(read<{ details: Det[] }>("mi-p0-03-candidate-quality.json").details.map((d) => [d.url, d]));
      const disc = read<{ rows: DiscRow[] }>("mi-disc-counterfactual.json").rows;
      /** 🟢 선행 WU 의 KNOWN_SAME 라벨 — (상품, 호스트) 키로 재사용한다. */
      const labelOf = new Map(disc.map((r) => [`${r.originTitle}|${r.candidateHost}`, r]));

      /* ══ CONTROL — computePriceDecision 이 순수하고 세 칸에만 반응하는가 ══ */
      const base = { costPriceKrw: 100_000, currentSellingPriceKrw: 150_000 };
      const ctrl = {
        note: "🔴 「가격이 나왔다」가 아니라 «결정 함수가 세 칸에만 반응한다» 를 고정한다.",
        pureRepeat: (() => {
          const a = computePriceDecision({ ...base, domesticAveragePriceKrw: 140_000, domesticLowestPriceKrw: 130_000, domesticBasis: "EXACT" });
          const b = computePriceDecision({ ...base, domesticAveragePriceKrw: 140_000, domesticLowestPriceKrw: 130_000, domesticBasis: "EXACT" });
          return { same: a.verdict === b.verdict && a.marginPercent === b.marginPercent, verdict: a.verdict };
        })(),
        noneVsExact: (() => {
          const none = computePriceDecision({ ...base, domesticAveragePriceKrw: null, domesticLowestPriceKrw: null, domesticBasis: "NONE" });
          const exact = computePriceDecision({ ...base, domesticAveragePriceKrw: 140_000, domesticLowestPriceKrw: 130_000, domesticBasis: "EXACT" });
          return { noneVerdict: none.verdict, exactVerdict: exact.verdict, changed: none.verdict !== exact.verdict };
        })(),
      };

      /* ══ 원상품 facts ══ */
      const origins = new Map<string, ProductFacts>();
      let lightFetch = 0;
      for (const g of golden) {
        const r = await factsFromProductUrl(g.url); lightFetch++;
        if (r.candidate?.facts) origins.set(g.url, r.candidate.facts);
      }
      /* ══ 후보 ══ */
      const candById = new Map<string, ComparisonCandidate | null>();
      for (const u of [...new Set(recs.flatMap((r) => (r.discovered ?? []).map((d) => d.url)))]) {
        const d = det.get(u);
        if (!d?.readable || !d.crawlerUrl) { candById.set(u, null); continue; }
        const r = await factsFromProductUrl(d.crawlerUrl); lightFetch++;
        candById.set(u, r.candidate?.facts ? r.candidate : null);
      }

      interface Row { [k: string]: unknown }
      const rows: Row[] = [];
      let enrichCalls = 0, hostsDone = 0, hostsSkippedByCap = 0;
      const t0 = Date.now();

      for (const g of golden) {
        const of_ = origins.get(g.url);
        if (!of_) continue;
        const query: ComparisonQuery = { title: of_.title, brand: of_.brand ?? undefined, sourceUrl: g.url, facts: of_ };
        const seen = new Set<string>();
        const byHost = new Map<string, ComparisonCandidate[]>();
        for (const r of recs.filter((x) => x.url === g.url)) {
          for (const d of r.discovered ?? []) {
            if (seen.has(d.url)) continue;
            seen.add(d.url);
            if (isSelfReferenceCandidate(g.url, d.url)) continue;
            const c = candById.get(d.url);
            if (!c) continue;
            const h = hostOf(c.url);
            (byHost.get(h) ?? byHost.set(h, []).get(h)!).push(c);
          }
        }

        for (const [host, cands] of byHost) {
          if (hostsDone >= MAX_HOSTS) { hostsSkippedByCap++; continue; }
          hostsDone++;
          const scored = withConfidence(query, cands);
          /** 🔴 enrichment 가 «누구를» 고르는지 먼저 본다(상한 2). */
          const eligible = selectCandidatesForDetailConfirmation(scored, query);
          const beforePriced = scored.filter((c) => c.price).length;
          /** 🟢 운영 함수 그대로. 실패하면 price 를 건드리지 않는다. */
          const enriched = await enrichCandidatePrices(scored, host, query);
          enrichCalls++;
          const afterPriced = enriched.filter((c) => c.price).length;
          const verified = enriched.filter((c) => c.priceStatus === "VERIFIED_CURRENT").length;
          const attempted = enriched.filter((c) => c.verificationAttempted).length;

          const lbl = labelOf.get(`${g.title.slice(0, 54)}|${host}`);
          rows.push({
            originBrand: g.brand, originTitle: g.title.slice(0, 54), host,
            candidates: cands.length,
            /** 🔴 선별 규칙이 실제로 몇 건을 골랐는가(상한 2) */
            eligibleForDetail: eligible.length,
            matchLevels: scored.map((c) => c.matchLevel ?? "none").join(","),
            beforePriced, afterPriced, gained: afterPriced - beforePriced,
            verifiedCurrent: verified, verificationAttempted: attempted,
            /** 🔴 Shopify handle 이 없으면 구조적으로 가격을 못 붙인다 */
            shopifyHandleAbsent: enriched.filter((c) => c.verificationAttempted && !c.price).length,
            priorLabel: lbl?.label ?? "(선행 라벨 없음)",
            priorTier: lbl?.tier ?? null, priorMiUsedAsSame: lbl?.miUsedAsSame ?? null,
            pricesAfter: enriched.filter((c) => c.price).slice(0, 3)
              .map((c) => ({ title: String(c.title).slice(0, 40), price: c.price, status: c.priceStatus })),
          });
          // eslint-disable-next-line no-console
          console.log(`${g.brand.slice(0, 12).padEnd(13)} ${host.slice(0, 22).padEnd(23)} n=${String(cands.length).padStart(2)} ` +
            `eligible=${eligible.length} priced ${beforePriced}→${afterPriced} verified=${verified} label=${lbl?.label ?? "-"}`);
        }
      }

      /* ══ Before/After 결정 변화 ══ */
      const count = (xs: Row[], k: (x: Row) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[k(x)] = (t[k(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      /**
       * 🔴 상품 단위로 「가격을 얻은 SAME 후보가 있는가」를 본다. 있으면 그 최저가로
       *    basis 를 올려 `computePriceDecision` 을 다시 돌린다.
       * 🔴 costPrice / sellingPrice 는 «같은 값» 으로 고정한다 — 세 칸만 바꾼다.
       */
      const perProduct = golden.map((g) => {
        const mine = rows.filter((r) => r.originTitle === g.title.slice(0, 54));
        const sameHosts = mine.filter((r) => r.priorLabel === "KNOWN_SAME");
        const pricesFromSame = sameHosts.flatMap((r) => (r.pricesAfter as { price: { amount: number; currency: string } | null }[])
          .map((p) => p.price).filter((p): p is { amount: number; currency: string } => !!p));
        /** 🔴 통화를 섞지 않는다 — KRW 만 쓴다. 다른 통화는 «환산하지 않고» 센다. */
        const krw = pricesFromSame.filter((p) => p.currency === "KRW").map((p) => p.amount);
        const nonKrw = pricesFromSame.filter((p) => p.currency !== "KRW");
        const lowest = krw.length ? Math.min(...krw) : null;
        const avg = krw.length ? Math.round(krw.reduce((a, b) => a + b, 0) / krw.length) : null;
        const before = computePriceDecision({ ...base, domesticAveragePriceKrw: null, domesticLowestPriceKrw: null, domesticBasis: "NONE" });
        const afterBasis: DomesticPriceBasis = lowest === null ? "NONE" : "EXACT";
        const after = computePriceDecision({ ...base, domesticAveragePriceKrw: avg, domesticLowestPriceKrw: lowest, domesticBasis: afterBasis });
        return {
          brand: g.brand, title: g.title.slice(0, 48),
          knownSameHosts: sameHosts.length,
          pricesFromSameHosts: pricesFromSame.length, krwPrices: krw.length,
          nonKrwPrices: nonKrw.map((p) => p.currency),
          lowestKrw: lowest, avgKrw: avg,
          basisBefore: "NONE", basisAfter: afterBasis,
          verdictBefore: before.verdict, verdictAfter: after.verdict,
          verdictChanged: before.verdict !== after.verdict,
          marginBefore: before.marginPercent, marginAfter: after.marginPercent,
        };
      });

      const report = {
        "🔴 DISCLAIMER": "Discovery 축은 COUNTERFACTUAL / NON-PRODUCTION. 가격·결정 축은 운영 owner 그대로.",
        scope: {
          note: `🔴 sample N=${golden.length} 원상품 · (상품×호스트) ${rows.length}. 전수가 아니다.`,
          enrichmentRule: "selectCandidatesForDetailConfirmation — very_high|high|medium 또는 SAME_MODEL_VARIANT · 샵당 상한 2",
          "🔴 어휘 정정": "AUTO_GO/NO_GO 는 리포에 없다. PriceDecisionVerdict(MAINTAIN|CONSIDER_LOWER|MARGIN_RISK) 로 잰다.",
          fixedInputs: base,
          hostsSkippedByCap, maxHosts: MAX_HOSTS,
        },
        controlGate: ctrl,
        /** ① 가격 확보율 */
        enrichmentYield: {
          hostPairs: rows.length,
          totalBeforePriced: rows.reduce((s, r) => s + Number(r.beforePriced), 0),
          totalAfterPriced: rows.reduce((s, r) => s + Number(r.afterPriced), 0),
          totalGained: rows.reduce((s, r) => s + Number(r.gained), 0),
          verifiedCurrent: rows.reduce((s, r) => s + Number(r.verifiedCurrent), 0),
          verificationAttempted: rows.reduce((s, r) => s + Number(r.verificationAttempted), 0),
          "🔴 시도했지만 가격 못 붙임(Shopify handle 부재 등)": rows.reduce((s, r) => s + Number(r.shopifyHandleAbsent), 0),
          eligibleTotal: rows.reduce((s, r) => s + Number(r.eligibleForDetail), 0),
          hostsWithZeroEligible: rows.filter((r) => Number(r.eligibleForDetail) === 0).length,
        },
        /** ② KNOWN_SAME 에 한정한 확보율 */
        knownSameEnrichment: (() => {
          const ks = rows.filter((r) => r.priorLabel === "KNOWN_SAME");
          return { knownSameHostPairs: ks.length,
                   gained: ks.reduce((s, r) => s + Number(r.gained), 0),
                   afterPriced: ks.reduce((s, r) => s + Number(r.afterPriced), 0),
                   eligible: ks.reduce((s, r) => s + Number(r.eligibleForDetail), 0) };
        })(),
        /** ③④ Before/After 결정 변화 */
        decisionChange: {
          products: perProduct.length,
          productsGainingAnyKrwPrice: perProduct.filter((p) => p.lowestKrw !== null).length,
          basisChanged: perProduct.filter((p) => p.basisAfter !== p.basisBefore).length,
          verdictChanged: perProduct.filter((p) => p.verdictChanged).length,
          byVerdictTransition: count(perProduct as unknown as Row[], (p) => `${p.verdictBefore} → ${p.verdictAfter}`),
          perProduct,
        },
        byMatchLevel: count(rows, (r) => `eligible=${r.eligibleForDetail} · levels=${String(r.matchLevels).slice(0, 28)}`),
        /** ⑤ 비용 */
        cost: {
          lightFetchCalls: lightFetch, enrichCallsPerHostPair: enrichCalls,
          elapsedMs: Date.now() - t0,
          note: "🔴 enrichCandidatePrices 내부 상세조회는 샵당 최대 2건이다(MAX_DETAIL_CONFIRMATIONS_PER_SHOP).",
          costPerDecisionImprovingProduct: perProduct.filter((p) => p.verdictChanged).length === 0
            ? "🔴 측정불가(분모 0)"
            : `${(lightFetch / perProduct.filter((p) => p.verdictChanged).length).toFixed(1)} lightFetch/건`,
        },
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-price-enrichment.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, rows: `(${rows.length}건 — 파일 참조)` }, null, 2));
      expect(rows.length).toBeGreaterThan(0);
    },
    240 * 60 * 1000,
  );
});
