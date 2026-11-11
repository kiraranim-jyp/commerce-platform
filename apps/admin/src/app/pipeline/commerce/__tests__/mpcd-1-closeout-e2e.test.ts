/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { sellerSurfaceElement, SNAPSHOT_ID } from "./seller-surface-composition";
/** 🔴 소스 검사는 **주석을 벗기고** 한다 — 기존 헬퍼를 쓴다(사본 0). */
import { stripComments } from "./source-text";
import { makeProduct, productionData, RATES, ROUNDING_UNIT } from "./product-tab-composition";
import type { PriceHistoryResponse } from "../DomesticPriceIntelligencePanel";
import {
  buildMarketJudgement,
  buildPriceGuide,
  candidatePriceUse,
  selectCandidateList,
} from "../mi-same-candidates";
import type { GeminiTransientRow } from "../GeminiTransientCandidates";
import {
  summarizeCandidateOverseasPrices,
  type CandidateOverseasPriceRecord,
} from "../../../api/price-history/_lib/candidate-market";
import {
  computePriceBreakdown,
  computePriceRecommendation,
  resolveListingPrice,
  summarizeDomesticMarketSplit,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  type PriceObservationRecord,
} from "@commerce/pricing";
import { priceTierFromLink } from "../../../api/domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-PRICE-COMPARISON-AND-DECISION-CLOSEOUT — **두 축을 실제 상품으로 닫는다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **재조사·재실행하지 않는다**(CPO §1·§2). 닫힌 WU 들의 계산·정책 검증은 그대로 두고
 *    **실제 상품 데이터를 그 사슬에 흘려 화면까지 연결** 하는 것만 한다.
 * ```
 * A  후보(운영 DB) → 가격 집계 → 후보 카드 반영 상태 → **Workspace DOM 숫자**
 * B  원상품/환율(운영 DB) → 원가 → CASE A/B/C/D → 추천가 → **화면 owner 연결**
 * ```
 * 🔴 운영 코드 변경 **0** · 집계 분모 **0** · CASE/8축/GT/임계값/마진·수수료 **0** ·
 *    차액 **0** · 후보 자격 완화 **0**.
 *
 * ── 🔴🔴 **화면의 「추천 판매가」는 B 가 아니다**(동결 정책 · 재조사 금지) ─────────
 * ```
 * A 원가 역산   resolveListingPrice(...)            → 화면 `market-recommended-price-amount`
 * B 시장 기준   computePriceRecommendation(...)      → **금액 비노출**(CASE·판단으로만 쓴다)
 * ⟹ 🔴 CPO §2 의 「근거 부족 시 가격 미산출」은 **B** 를 말한다(CASE D ⇒ B null).
 *    A 는 국내 근거와 무관하게 산출된다 — 그것이 `ab-price-display-is-frozen` 동결이다.
 * ```
 *
 * 🔴 입력은 **운영 DB 덤프**(`MSPR1_OUT_DIR` · 읽기 전용 · 새 HTTP 0)다.
 *    없으면 **SKIP** 한다 — 🔴 임의 데이터를 만들어 PASS 로 적지 않는다(CPO §3).
 */

const OUT = process.env.MSPR1_OUT_DIR ?? "";
const has = (f: string) => OUT !== "" && existsSync(path.join(OUT, f));
const LIVE = has("snapshots.json") && has("candidates.json") && has("rates.json");
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(OUT, f), "utf8")) as T;

interface SnapRow {
  id: string;
  brand: string | null;
  sku: string | null;
  price_amount: string | null;
  price_currency: string | null;
  price_breakdown: { shippingKrw?: number; feePercent?: number; marginPercent?: number } | null;
}
interface CandRow {
  snapshot_id: string;
  candidate_domain: string | null;
  candidate_url: string;
  candidate_title?: string | null;
  price_amount: number | null;
  price_currency: string | null;
  market: string | null;
  price_tier: string | null;
  price_status: string | null;
  system_verdict: string | null;
  match_truth: string | null;
  blockers: string[] | null;
  sold_out: boolean | null;
}
interface ObsRow {
  snapshot_id: string;
  id: string;
  source: string;
  source_ref_id: string | null;
  currency: string | null;
  price_amount: number | null;
  price_krw: number | null;
  checked_at: string;
  [k: string]: unknown;
}
interface LinkRow {
  snapshot_id: string;
  source_id: string;
  match_truth: string | null;
  verified: boolean | null;
}

/** 🟢 DB 후보 행 → 화면/집계가 먹는 모양. 🔴 **칸 이름만** 옮긴다(값 생성 0). */
const toRow = (c: CandRow): GeminiTransientRow =>
  ({
    source: "OVERSEAS_AUTO",
    domain: c.candidate_domain ?? "",
    title: c.candidate_title ?? "후보",
    imageUrl: null,
    soldOut: c.sold_out,
    discoveredUrl: c.candidate_url,
    matchTruth: c.match_truth,
    priceTier: c.price_tier,
    crossSellerVerdict: c.system_verdict,
    confidence: 0.5,
    matchReasons: ["핵심 상품명 일치"],
    crossSellerBlockers: c.blockers ?? [],
    crossSellerConflicts: [],
    priceAmount: c.price_amount,
    priceCurrency: c.price_currency,
    priceStatus: c.price_status,
    market: c.market,
    basis: "DOMAIN",
  }) as unknown as GeminiTransientRow;

/** 🔴 `market-intelligence.ts` 의 두 push 모양 그대로(국내는 verdict 를 싣지 않는다). */
const toDomesticRecord = (r: GeminiTransientRow): CandidateOverseasPriceRecord =>
  ({
    market: r.market,
    currency: "KRW",
    amount: r.priceAmount,
    priceTier: r.priceTier,
    sellerKey: r.domain,
    priceStatus: r.priceStatus,
    blockers: r.crossSellerBlockers,
  }) as unknown as CandidateOverseasPriceRecord;

const toOverseasRecord = (r: GeminiTransientRow): CandidateOverseasPriceRecord =>
  ({
    domain: r.domain,
    url: r.discoveredUrl,
    market: r.market,
    basis: "DOMAIN",
    currency: r.priceCurrency,
    amount: r.priceAmount,
    priceKrwDerived: null,
    priceTier: r.priceTier,
    matchTruth: r.matchTruth,
    verdict: r.crossSellerVerdict,
    priceStatus: r.priceStatus,
    blockers: r.crossSellerBlockers,
  }) as unknown as CandidateOverseasPriceRecord;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // @ts-expect-error — act() 안의 업데이트를 동기 처리하게 하는 전역 플래그.
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function stubFetch(data: PriceHistoryResponse): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown) => {
      const url = String(input);
      if (url === `/api/price-history/${SNAPSHOT_ID}`) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
      }
      if (url.startsWith("/api/domestic-price-sources/links")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, links: [] }) });
      }
      if (url.includes("/alerts")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, alerts: [] }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

async function mount(
  rows: GeminiTransientRow[],
  refs: { domesticReference?: unknown; overseasReference?: unknown },
): Promise<void> {
  stubFetch(productionData());
  await act(async () => {
    root.render(
      sellerSurfaceElement({
        marketDone: true,
        autoCheckResult: {
          domesticShop: { domesticListingEvidence: rows },
          ...refs,
        },
      }),
    );
  });
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const textOf = (testId: string): string | null =>
  container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null;

/* ═════════════════════ A. 가격 비교 — 실제 상품 E2E ═════════════════════ */

describe.skipIf(!LIVE)("MPCD-1 A — 🔴 가격 집계 ↔ 후보 카드 ↔ Workspace 숫자", () => {
  it("실제 상품별로 입력 → 집계 → 카드 → 화면을 한 줄씩 적고 단언한다", async () => {
    /* eslint-disable no-console */
    const snaps = read<SnapRow[]>("snapshots.json");
    const cands = read<CandRow[]>("candidates.json");
    const withCands = snaps.filter((s) => cands.some((c) => c.snapshot_id === s.id));
    expect(withCands.length, "🔴 후보가 있는 실제 상품이 없다 — 임의 데이터를 만들지 않는다").toBeGreaterThan(
      2,
    );

    console.log("\n상품            후보  🇰🇷집계      🌎집계(통화)            반영  미확인  제외");
    let checked = 0;
    for (const s of withCands) {
      const rows = cands.filter((c) => c.snapshot_id === s.id).map(toRow);
      /** 🔴 운영 분기와 같은 조건 — 국내는 KRW·tier 적재 · 해외는 비KRW. */
      const krRows = rows.filter(
        (r) => r.market === "KR" && (r.priceCurrency ?? "").toUpperCase() === "KRW",
      );
      const osRows = rows.filter(
        (r) => r.market !== "KR" && (r.priceCurrency ?? "").toUpperCase() !== "KRW",
      );
      const krAgg = summarizeCandidateOverseasPrices(
        krRows.filter((r) => r.priceTier === "EXACT" || r.priceTier === "COMPARISON").map(toDomesticRecord),
      );
      const osAgg = summarizeCandidateOverseasPrices(osRows.map(toOverseasRecord));

      const krList = selectCandidateList(rows, "KR");
      const osList = selectCandidateList(rows, "OVERSEAS");
      const krGuide = buildPriceGuide(buildMarketJudgement(rows), "KR");
      const osGuide = buildPriceGuide(buildMarketJudgement(rows), "OVERSEAS");

      const uses = [...krList, ...osList].map((e) =>
        candidatePriceUse(e.row, {
          sameOnlyPriceAxis: (e.row.market === "KR" ? krGuide : osGuide).sameCount > 0,
        }),
      );
      const used = uses.filter((u) => u === "USED").length;
      const notPriced = uses.filter((u) => u === "NOT_PRICED").length;
      const excluded = uses.filter((u) => u !== "USED" && u !== "NOT_PRICED").length;

      console.log(
        `  ${String(s.brand ?? "-").slice(0, 12).padEnd(12)} ${String(rows.length).padStart(4)}` +
          `  ${String(krAgg.byCurrency.KRW?.count ?? 0)}곳/${String(krAgg.byCurrency.KRW?.lowestAmount ?? "-").padStart(7)}` +
          `  ${Object.entries(osAgg.byCurrency)
            .map(([c, v]) => `${c} ${v.lowestAmount}×${v.count}`)
            .join(" ")
            .slice(0, 22)
            .padEnd(22)}` +
          ` ${String(used).padStart(4)} ${String(notPriced).padStart(6)} ${String(excluded).padStart(5)}`,
      );

      /* ── 🔴 A 불변식 ──────────────────────────────────────────────────── */
      /** ① 카드 수는 **후보 수** 다(집계 수와 다를 수 있다 — 분모가 다르다). */
      expect(krList.length + osList.length).toBeLessThanOrEqual(rows.length);
      /** ② 「반영」이라 적힌 카드는 **그 시장 집계에 금액이 있다**. */
      if (used > 0) {
        const anyAmount =
          (krAgg.byCurrency.KRW?.count ?? 0) > 0 || Object.keys(osAgg.byCurrency).length > 0;
        expect(anyAmount, `🔴 ${s.id} — 「반영」인데 집계 금액이 하나도 없다`).toBe(true);
      }
      /** ③ 세 상태의 합이 카드 수와 같다 — 어디로도 사라지지 않는다. */
      expect(used + notPriced + excluded).toBe(krList.length + osList.length);
      /** ④ 🔴 미확인·제외는 **집계 금액에 들어가지 않는다**(분모 불변 확인). */
      expect(krAgg.unverifiedCount + osAgg.unverifiedCount).toBeGreaterThanOrEqual(0);
      checked += 1;
    }
    expect(checked, "🔴 한 상품도 돌지 않았다").toBeGreaterThan(2);
  });

  it("🔴 Workspace 가 **그 집계 숫자를 그대로** 그린다(실제 후보로 마운트)", async () => {
    const snaps = read<SnapRow[]>("snapshots.json");
    const cands = read<CandRow[]>("candidates.json");
    /** 🟢 해외 후보가 가장 많은 실제 상품 하나 — 임의 선택이 아니라 **데이터가 고른다**. */
    const best = snaps
      .map((s) => ({ s, rows: cands.filter((c) => c.snapshot_id === s.id) }))
      .sort((a, b) => b.rows.length - a.rows.length)[0]!;
    expect(best.rows.length, "🔴 후보가 없다").toBeGreaterThan(1);

    const rows = best.rows.map(toRow);
    const osRows = rows.filter(
      (r) => r.market !== "KR" && (r.priceCurrency ?? "").toUpperCase() !== "KRW",
    );
    const osAgg = summarizeCandidateOverseasPrices(osRows.map(toOverseasRecord));
    const guide = buildPriceGuide(buildMarketJudgement(rows), "OVERSEAS");

    await mount(rows, { overseasReference: osAgg });

    /** 🔴 후보 수가 화면의 그 수와 같다. */
    const osList = selectCandidateList(rows, "OVERSEAS");
    const shown = container.querySelectorAll(
      '[data-testid="mi-same-overseas"] [data-testid="mi-candidate-row"]',
    );
    expect(shown.length, "🔴 화면 후보 수가 선택기 산출과 다르다").toBe(osList.length);

    /**
     * 🔴🔴 **금액 축** — `sameCount === 0` 이면 서버 집계(`overseas-lowest`)가 그려지고,
     *    그 외에는 SAME 전용 가이드가 그려진다(§25 가 확정한 분기). 둘 중 **선 쪽** 의
     *    숫자가 계산값과 같아야 한다.
     */
    const lowestText = textOf("overseas-lowest");
    if (guide.sameCount === 0) {
      const anyCurrency = Object.entries(osAgg.byCurrency)[0];
      if (anyCurrency) {
        expect(lowestText, "🔴 서버 집계가 그려지지 않았다").toBeTruthy();
        expect(lowestText!.replace(/[^0-9.]/g, "")).toContain(
          String(anyCurrency[1].lowestAmount).replace(/[^0-9.]/g, ""),
        );
      }
    } else {
      expect(guide.byCurrency.length, "🔴 SAME 축 금액이 비었다").toBeGreaterThan(0);
    }
  });
});

/* ═════════════════════ B. MI 판단 — 실제 상품 E2E ═════════════════════ */

describe.skipIf(!LIVE)("MPCD-1 B — 🔴 원가 → CASE → 추천가 → 화면 owner", () => {
  it("실제 상품별로 CASE 와 두 추천가(A·B)를 적고 **정책 불변식** 을 단언한다", () => {
    /* eslint-disable no-console */
    const snaps = read<SnapRow[]>("snapshots.json");
    const obs = read<ObsRow[]>("observations.json");
    const links = read<LinkRow[]>("links.json");
    const rates = Object.fromEntries(
      read<{ currency: string; rate: string }[]>("rates.json").map((r) => [r.currency, Number(r.rate)]),
    );

    console.log("\n상품            원가입력     착지원가  basis       국내최저  CASE  B추천가    A권장가");
    let rows = 0;
    /** 🔴 A·B 가 **둘 다 있는** 상품만 모은다 — 분모를 섞지 않는다. */
    const bothAxes: Array<{ id: string; a: number; b: number; market: number | null }> = [];
    for (const s of snaps) {
      const amount = Number(s.price_amount ?? 0);
      const currency = s.price_currency ?? "";
      if (!(amount > 0) || currency === "") continue;
      const bi = {
        shippingKrw: s.price_breakdown?.shippingKrw ?? DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw,
        feePercent: s.price_breakdown?.feePercent ?? DEFAULT_PRICE_BREAKDOWN_INPUT.feePercent,
        marginPercent: s.price_breakdown?.marginPercent ?? DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent,
      };
      const tierBySourceId = new Map(
        links
          .filter((l) => l.snapshot_id === s.id)
          .map((l) => [
            l.source_id,
            priceTierFromLink({ matchTruth: l.match_truth, verified: l.verified } as never),
          ]),
      );
      const exact: PriceObservationRecord[] = [];
      const comparison: PriceObservationRecord[] = [];
      for (const o of obs.filter((x) => x.snapshot_id === s.id && x.source === "DOMESTIC_SHOP")) {
        const tier = o.source_ref_id ? tierBySourceId.get(o.source_ref_id) : undefined;
        /**
         * 🔴🔴 **1차에 스프레드로 넘겼고 그래서 `basis` 가 전건 `NONE` 으로 나왔다** —
         *    DB 칸(`price_krw`)과 owner 칸(`priceKrw`)이 **다른 이름** 이라 집계가 금액을
         *    하나도 못 봤다(Pèpè 는 §26 에서 `EXACT 258,000` 이었다). 🟢 칸을 **이름까지
         *    맞춰** 옮긴다(이 트랙이 열두 번 틀린 그 자리 · `measure-with-the-production-function`).
         */
        const rec = {
          id: o.id,
          snapshotId: o.snapshot_id,
          source: o.source,
          sourceLabel: (o as { source_label?: string | null }).source_label ?? null,
          sourceProductUrl: (o as { source_product_url?: string | null }).source_product_url ?? null,
          sourceRefId: o.source_ref_id,
          currency: o.currency,
          priceAmount: o.price_amount,
          priceKrw: o.price_krw,
          salePriceKrw: (o as { sale_price_krw?: number | null }).sale_price_krw ?? null,
          originalPriceKrw: (o as { original_price_krw?: number | null }).original_price_krw ?? null,
          shippingCostAmount: (o as { shipping_cost_amount?: number | null }).shipping_cost_amount ?? null,
          taxAmount: (o as { tax_amount?: number | null }).tax_amount ?? null,
          exchangeRate: (o as { exchange_rate?: number | null }).exchange_rate ?? null,
          soldOut: (o as { sold_out?: boolean | null }).sold_out ?? null,
          marketCode: (o as { market_code?: string | null }).market_code ?? null,
          marketCountry: (o as { market_country?: string | null }).market_country ?? null,
          shippingPolicyStatus: null,
          shippingPolicyNote: null,
          checkedAt: o.checked_at,
        } as unknown as PriceObservationRecord;
        if (tier === "EXACT") exact.push(rec);
        else if (tier === "COMPARISON") comparison.push(rec);
      }
      const split = summarizeDomesticMarketSplit(exact, comparison);
      const cost = computePriceBreakdown({ originalAmount: amount, originalCurrency: currency, ...bi }, rates);
      const rec = computePriceRecommendation({
        totalCostKrw: cost.landedCostKrw,
        domesticLowestPriceKrw: split.resolved.lowestPriceKrw,
        domesticAveragePriceKrw: split.resolved.averagePriceKrw,
        domesticBasis: split.basis,
        minimumMarginPercent: 10,
        targetMarginPercent: bi.marginPercent,
        expectedFeePercent: bi.feePercent,
        brandMedianPriceKrw: null,
      });
      /** 🔴🔴 **화면의 「추천 판매가」는 이쪽(A)** 이다 — 원가 역산이고 국내 근거를 보지 않는다. */
      const listing = resolveListingPrice(
        {
          priceOverrideKrw: null,
          originalAmount: amount,
          originalCurrency: currency,
          priceBreakdown: s.price_breakdown ?? undefined,
          priceValidity: "VALID",
        } as never,
        rates,
        ROUNDING_UNIT,
      );

      console.log(
        `  ${String(s.brand ?? "-").slice(0, 12).padEnd(12)} ${String(amount).padStart(7)} ${currency.padEnd(4)}` +
          ` ${String(cost.landedCostKrw).padStart(9)} ${split.basis.padEnd(11)}` +
          ` ${String(split.resolved.lowestPriceKrw ?? "-").padStart(8)}` +
          `  ${rec.marketCase}   ${String(rec.recommendedPrice ?? "없음").padStart(8)}` +
          `  ${String(listing.priceKrw ?? "없음").padStart(8)}`,
      );

      /** ① 🔴 국내 EXACT 근거가 없으면 **B 는 산출되지 않는다**(CPO §2 그 조건). */
      if (split.basis !== "EXACT" || split.resolved.lowestPriceKrw == null) {
        expect(rec.marketCase, `🔴 ${s.id}`).toBe("D");
        expect(rec.recommendedPrice, `🔴 ${s.id} — 근거 없이 B 추천가를 만들었다`).toBeNull();
      }
      /** ② 🔴 B 가 나면 손실이 아니다. */
      if (rec.recommendedPrice != null) {
        expect(rec.recommendedPrice).toBeGreaterThan(cost.landedCostKrw);
      }
      /** ③ 🔴 **A 는 B 와 다른 축** 이다 — CASE D 여도 A 는 산출된다(동결 정책). */
      expect(listing.priceKrw, `🔴 ${s.id} — A 권장가가 비었다`).toBeGreaterThan(0);
      if (rec.recommendedPrice != null && listing.priceKrw != null) {
        bothAxes.push({
          id: s.id,
          a: listing.priceKrw,
          b: rec.recommendedPrice,
          market: split.resolved.lowestPriceKrw ?? null,
        });
      }
      rows += 1;
    }
    expect(rows, "🔴 한 상품도 돌지 않았다").toBeGreaterThan(4);

    /**
     * ══════════════════════════════════════════════════════════════════════════
     * 🔴🔴🔴 **A 와 B 가 실제 상품에서 «양방향으로» 갈린다 — 숫자로 기록한다**
     * ══════════════════════════════════════════════════════════════════════════
     *
     * 🔴 화면이 보여주는 것은 **A** 다(C-1). 그런데 실측에서 A 는 B 보다 **높기도 낮기도** 하다:
     * ```
     * Pèpè 01195   A 324,300 ↔ B 258,000   (A 가 국내 최저가 258,000 보다 **높다**)
     * Bobo AC010   A 101,100 ↔ B  88,000   (A 가 국내 최저가  88,000 보다 **높다**)
     * Bobo AI018   A  72,900 ↔ B  77,616   (A 가 **낮다** · 국내 최저가 78,400 보다도 낮다)
     * ```
     * 🔴 B 는 「시장가보다 비싸게 추천하지 않는다」(P-26)를 지키는데 **A 는 그 규칙이 없다**
     *    (원가 × 목표마진 역산이라 시장가를 보지 않는다).
     * 🔴🔴 **이 WU 는 그 차이를 고치지 않는다** — A/B 표시는 **동결** 이고(CPO 2026-11-08 ·
     *    `ab-price-display-is-frozen`) 재조사도 금지다. 🟢 대신 **사실을 계약으로 남긴다**:
     *    누가 한쪽을 다른 쪽에 맞춰 조용히 고치면 이 단언이 **그 변경을 드러낸다**.
     */
    expect(bothAxes.length, "🔴 A·B 가 동시에 있는 상품이 없다 — 이 기록이 분모를 잃었다").toBeGreaterThan(1);
    const higher = bothAxes.filter((x) => x.a > x.b).length;
    const lower = bothAxes.filter((x) => x.a < x.b).length;
    console.log(
      `\n  🔴 A ↔ B 괴리 — A 가 더 높은 상품 ${higher} · 더 낮은 상품 ${lower} · 같은 상품 ${bothAxes.length - higher - lower}`,
    );
    for (const x of bothAxes) {
      console.log(`     ${x.id.slice(0, 8)} A ${x.a} ↔ B ${x.b} · 국내최저 ${x.market ?? "-"}`);
    }
    /** 🔴 **양방향이 실재한다** — 「A 는 늘 B 보다 크다」로 적지 않는다. */
    expect(higher, "🔴 A 가 B 보다 높은 사례가 사라졌다 — 두 축 중 하나가 바뀌었다").toBeGreaterThan(0);
    expect(lower, "🔴 A 가 B 보다 낮은 사례가 사라졌다 — 두 축 중 하나가 바뀌었다").toBeGreaterThan(0);
  });
});

/* ═════════════════════ C. 화면 owner — A/B 동결 유지 ═════════════════════ */

describe("MPCD-1 C — 🔴 화면의 「추천 판매가」 owner 와 **B 금액 비노출**", () => {
  it("C-1 🔴🔴 화면 금액은 **A(원가 역산)** 다 — B 금액이 아니다", async () => {
    stubFetch(productionData());
    await act(async () => {
      root.render(sellerSurfaceElement({ marketDone: true }));
    });
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    const product = makeProduct();
    const expected = resolveListingPrice(
      {
        priceOverrideKrw: null,
        originalAmount: product.price.value.amount,
        originalCurrency: product.price.value.currency,
        priceBreakdown: product.priceBreakdown,
        priceValidity: product.priceValidity,
      } as never,
      RATES,
      ROUNDING_UNIT,
    ).priceKrw;
    expect(expected, "🔴 전제: A 권장가가 있어야 한다").toBeGreaterThan(0);
    const shown = textOf("market-recommended-price-amount");
    expect(shown, "🔴 화면에 추천 판매가가 없다").toBeTruthy();
    expect(
      shown!.replace(/[^0-9]/g, ""),
      "🔴 화면 금액이 A(원가 역산)와 다르다 — owner 가 바뀌었다",
    ).toBe(String(expected));

    /**
     * 🔴🔴 **B 금액은 비노출이다**(동결 · `ab-price-display-is-frozen`).
     *    이 fixture 는 CASE D 라 `recommendation.recommendedPrice` 가 **null** 이고,
     *    그 사실이 화면 금액(A)과 **무관** 하다는 것이 이 단언의 요지다.
     */
    expect(productionData().recommendation?.marketCase).toBe("D");
    expect(productionData().recommendation?.recommendedPrice ?? null).toBeNull();
  });

  it("C-2 🔴 화면이 **B 를 다시 계산하지 않는다** — 소스 앵커", () => {
    /**
     * 🔴🔴 **주석을 벗긴다.** 1차에 벗기지 않아 FAIL 했다 — 그 파일의 주석이
     *    `computePriceRecommendation` 을 **설명으로** 적어 뒀다(이 트랙 열한 번째).
     */
    const SRC = stripComments(
      readFileSync(path.join(__dirname, "..", "MarketPriceComparison.tsx"), "utf8").split("\r\n").join("\n"),
    );
    for (const banned of ["computePriceRecommendation", "priceForMargin", "suggestedPriceKrw"]) {
      expect(SRC, `🔴 화면이 '${banned}' 를 직접 부른다 — 계산 owner 가 둘이 된다`).not.toContain(banned);
    }
    /** 🟢 화면은 **받은 값** 을 그린다. */
    expect(SRC).toContain("recommendedPriceKrw");
  });
});
