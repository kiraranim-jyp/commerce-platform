/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { sellerSurfaceElement, SNAPSHOT_ID } from "./seller-surface-composition";
import { productionData } from "./product-tab-composition";
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
  convertToKrwStrict,
  resolveListingPrice,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
} from "@commerce/pricing";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-PRICE-COMPARISON-AND-DECISION-FINAL-E2E — **남은 세 증거만** 확보한다
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 범위는 CPO 가 적은 셋뿐이다(다른 것은 열지 않는다):
 * ```
 * ① 국내 후보 ∧ 해외 후보가 **함께 있는 실제 상품 1개** 로 한 흐름 추적
 * ② `VERIFIED_CURRENT` **실제 가격 후보** 의 카드 상태 ↔ 집계 금액 일치
 * ③ `canComputeCost=false` 에서 권장가격이 **산출되지 않는다**(🔴 **함수 계약** 으로 명시)
 * ```
 * 🔴 A/B 정책 **변경 0**(CPO 판정 — A 화면 유지 · B 금액 비노출) · CASE · 국내 basis ·
 *    8축 · GT · 집계 분모 · 가격 자격 · 마진·수수료 **전부 불변** · 차액 **0**.
 *
 * ── 🔴🔴 **①의 표본을 찾을 때 내가 축을 틀렸다 — 그대로 적는다** ─────────────
 * ```
 * 1차: 「`domestic_product_links` ∧ 해외 후보」 → 운영 전체 **0건**
 * 🔴 그런데 화면의 국내 참고가격 owner 는 그 축이 **아니다** — `candidateDomesticPrice`
 *    (= transient 후보 집계)다. 등록부 링크는 **다른 생산자** 이고 두 경로가 서로 다른
 *    시기·상품에서 돌아 교집합이 0 이었다.
 * 🟢 후보 축으로 다시 찾으니 **8 상품** 이 나왔다 ⟹ 표본을 **만들지 않았다**.
 * ```
 */

const OUT = process.env.MPCD2_OUT_DIR ?? "";
const has = (f: string) => OUT !== "" && existsSync(path.join(OUT, f));
const LIVE = has("both.json") && has("candidates.json") && has("rates.json");
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(OUT, f), "utf8")) as T;

interface SnapRow {
  id: string;
  brand: string | null;
  sku: string | null;
  price_amount: string | null;
  price_currency: string | null;
  price_validity: string | null;
  price_breakdown: { shippingKrw?: number; feePercent?: number; marginPercent?: number } | null;
}
interface CandRow {
  snapshot_id: string;
  candidate_domain: string | null;
  candidate_url: string;
  candidate_title: string | null;
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

/** 🟢 DB 후보 → 화면/집계 모양. 🔴 칸 이름만 옮긴다(값 생성 0). */
const toRow = (c: CandRow, krw: number | null): GeminiTransientRow =>
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
    /** 🔴 서버가 붙이는 파생 칸(`market-intelligence` :§3-2) — **환산 owner 는 그 함수 하나**. */
    priceKrwDerived: krw,
  }) as unknown as GeminiTransientRow;

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
    priceKrwDerived: (r as unknown as { priceKrwDerived: number | null }).priceKrwDerived,
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

async function mount(rows: GeminiTransientRow[], refs: Record<string, unknown>): Promise<void> {
  stubFetch(productionData());
  await act(async () => {
    root.render(
      sellerSurfaceElement({
        marketDone: true,
        autoCheckResult: { domesticShop: { domesticListingEvidence: rows }, ...refs },
      }),
    );
  });
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const digits = (s: string | null | undefined) => (s ?? "").replace(/[^0-9]/g, "");
const textOf = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;

/* ════════════ ① 국내 ∧ 해외 가격 동시 E2E (실제 상품 1개) ════════════ */

describe.skipIf(!LIVE)("MPCD-2 ① — 🟢 한 상품에서 🇰🇷/🌎 를 끝까지 추적한다", () => {
  it("입력 → 집계 → 카드 → MI 판단 → Workspace 출력", async () => {
    /* eslint-disable no-console */
    const both = read<SnapRow[]>("both.json");
    const cands = read<CandRow[]>("candidates.json");
    const rates = Object.fromEntries(
      read<{ currency: string; rate: string }[]>("rates.json").map((r) => [r.currency, Number(r.rate)]),
    );
    /** 🔴 **데이터가 고른다** — 국내·해외 후보가 가장 많은 실제 상품 하나. */
    const pick = both
      .map((s) => ({ s, rows: cands.filter((c) => c.snapshot_id === s.id) }))
      .sort((a, b) => b.rows.length - a.rows.length)[0]!;
    expect(pick.rows.length, "🔴 표본을 만들지 않는다 — 실제 후보가 없으면 FAIL").toBeGreaterThan(2);

    const rows = pick.rows.map((c) => {
      const derived =
        c.price_amount != null && c.price_currency
          ? (convertToKrwStrict(c.price_amount, c.price_currency, rates)?.amountKrw ?? null)
          : null;
      return toRow(c, derived);
    });

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

    console.log(`\n① 상품 ${pick.s.brand} ${pick.s.sku} (${pick.s.id.slice(0, 8)}) · 후보 ${rows.length}`);
    for (const r of rows) {
      const guide = buildPriceGuide(buildMarketJudgement(rows), r.market === "KR" ? "KR" : "OVERSEAS");
      console.log(
        `   ${(r.market ?? "-").padEnd(8)} ${r.domain.slice(0, 22).padEnd(22)}` +
          ` ${String(r.priceAmount ?? "-").padStart(8)} ${(r.priceCurrency ?? "-").padEnd(4)}` +
          ` KRW≈${String((r as unknown as { priceKrwDerived: number | null }).priceKrwDerived ?? "-").padStart(8)}` +
          ` ${(r.priceTier ?? "-").padEnd(11)} ${(r.priceStatus ?? "-").padEnd(17)}` +
          ` → ${candidatePriceUse(r, { sameOnlyPriceAxis: guide.sameCount > 0 })}`,
      );
    }
    console.log(
      `   🇰🇷 집계 ${krAgg.byCurrency.KRW?.count ?? 0}곳 · 최저 ${krAgg.byCurrency.KRW?.lowestAmount ?? "-"}` +
        ` · 🌎 집계 ${Object.entries(osAgg.byCurrency).map(([c, v]) => `${c} ${v.lowestAmount}×${v.count}`).join(" ")}`,
    );

    /** 🔴 ① 전제 — **두 시장이 같은 상품에 실제로 있다**(합성이 아니다). */
    expect(krRows.length, "🔴 국내 후보가 없다").toBeGreaterThan(0);
    expect(osRows.length, "🔴 해외 후보가 없다").toBeGreaterThan(0);

    /** 🔴 환산은 **owner 하나** 다 — 모르는 통화는 null(지어낸 숫자 0). */
    for (const r of osRows) {
      const krw = (r as unknown as { priceKrwDerived: number | null }).priceKrwDerived;
      if (krw != null) expect(krw).toBeGreaterThan(0);
    }

    /* ── B 축: 원가 → CASE → 추천가(A·B) ─────────────────────────────────── */
    const bi = {
      shippingKrw: pick.s.price_breakdown?.shippingKrw ?? DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw,
      feePercent: pick.s.price_breakdown?.feePercent ?? DEFAULT_PRICE_BREAKDOWN_INPUT.feePercent,
      marginPercent: pick.s.price_breakdown?.marginPercent ?? DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent,
    };
    const amount = Number(pick.s.price_amount ?? 0);
    const currency = pick.s.price_currency ?? "";
    const cost = computePriceBreakdown({ originalAmount: amount, originalCurrency: currency, ...bi }, rates);
    /**
     * 🔴 **국내 basis 는 이 상품에서 `NONE`** 이다 — 등록부 링크가 0 이라 `domesticBasis`
     *    입력이 비었다(후보 축 참고가격은 **그 입력이 아니다** · §24-1 의 분모 분리).
     *    ⟹ 🟢 그래서 **CASE D 가 정상** 이고 B 추천가는 **없어야** 한다.
     */
    const rec = computePriceRecommendation({
      totalCostKrw: cost.landedCostKrw,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      domesticBasis: "NONE",
      minimumMarginPercent: 10,
      targetMarginPercent: bi.marginPercent,
      expectedFeePercent: bi.feePercent,
      brandMedianPriceKrw: null,
    });
    const listing = resolveListingPrice(
      {
        priceOverrideKrw: null,
        originalAmount: amount,
        originalCurrency: currency,
        priceBreakdown: pick.s.price_breakdown ?? undefined,
        priceValidity: pick.s.price_validity ?? "VALID",
      } as never,
      rates,
      10,
    );
    console.log(
      `   원가 ${amount} ${currency} → 착지 ${cost.landedCostKrw} · CASE ${rec.marketCase}` +
        ` · B ${rec.recommendedPrice ?? "없음"} · A ${listing.priceKrw ?? "없음"}`,
    );
    expect(rec.marketCase).toBe("D");
    expect(rec.recommendedPrice, "🔴 근거 없이 B 추천가를 만들었다").toBeNull();
    expect(listing.priceKrw, "🔴 A 권장가가 비었다").toBeGreaterThan(0);

    /* ── Workspace 출력 ────────────────────────────────────────────────────── */
    await mount(rows, { domesticReference: krAgg, overseasReference: osAgg });
    /** 🔴 두 블록이 **같은 화면에** 선다. */
    expect(container.querySelector('[data-testid="mi-same-domestic"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mi-same-overseas"]')).toBeTruthy();
    /** 🔴 국내 금액이 집계값 그대로 그려진다. */
    if (krAgg.byCurrency.KRW) {
      expect(digits(textOf("domestic-lowest")), "🔴 국내 금액이 집계와 다르다").toContain(
        String(krAgg.byCurrency.KRW.lowestAmount),
      );
    }
    /** 🔴 후보 수가 선택기 산출과 같다(두 시장 각각). */
    for (const [market, testId] of [
      ["KR", "mi-same-domestic"],
      ["OVERSEAS", "mi-same-overseas"],
    ] as const) {
      const shown = container.querySelectorAll(
        `[data-testid="${testId}"] [data-testid="mi-candidate-row"]`,
      );
      expect(shown.length, `🔴 ${market} 화면 후보 수가 선택기와 다르다`).toBe(
        selectCandidateList(rows, market).length,
      );
    }
  });
});

/* ════════════ ② VERIFIED_CURRENT 후보의 카드 ↔ 집계 일치 ════════════ */

describe.skipIf(!LIVE)("MPCD-2 ② — 🟢 실제 확인된 가격 후보의 카드 상태", () => {
  it("「참고가격에 반영」 카드의 금액이 **집계 금액에 들어 있다**", async () => {
    /* eslint-disable no-console */
    const verified = read<SnapRow[]>("verified.json");
    const cands = read<CandRow[]>("candidates.json");
    const rates = Object.fromEntries(
      read<{ currency: string; rate: string }[]>("rates.json").map((r) => [r.currency, Number(r.rate)]),
    );
    const pick = verified
      .map((s) => ({
        s,
        rows: cands.filter(
          (c) => c.snapshot_id === s.id && (c.price_status ?? "") === "VERIFIED_CURRENT",
        ),
      }))
      .sort((a, b) => b.rows.length - a.rows.length)[0]!;
    expect(pick.rows.length, "🔴 `VERIFIED_CURRENT` 후보가 없다 — 표본을 만들지 않는다").toBeGreaterThan(1);

    const all = cands
      .filter((c) => c.snapshot_id === pick.s.id)
      .map((c) =>
        toRow(
          c,
          c.price_amount != null && c.price_currency
            ? (convertToKrwStrict(c.price_amount, c.price_currency, rates)?.amountKrw ?? null)
            : null,
        ),
      );
    const osRows = all.filter(
      (r) => r.market !== "KR" && (r.priceCurrency ?? "").toUpperCase() !== "KRW",
    );
    const osAgg = summarizeCandidateOverseasPrices(osRows.map(toOverseasRecord));
    const guide = buildPriceGuide(buildMarketJudgement(all), "OVERSEAS");

    console.log(`\n② 상품 ${pick.s.brand} ${pick.s.sku} · VERIFIED 후보 ${pick.rows.length}`);
    let usedCount = 0;
    /**
     * 🔴🔴 **1차에 분모를 좁혀 FAIL 했다** — 해외 리스트만 세고 DOM 은 **두 시장 전부** 를
     *    세어 `1 ↔ 2` 가 됐다(국내 donokids 도 「반영」이다). 🟢 카드 축을 **두 시장** 으로 맞춘다.
     */
    const krUsed = selectCandidateList(all, "KR").filter(
      (x) =>
        candidatePriceUse(x.row, {
          sameOnlyPriceAxis: buildPriceGuide(buildMarketJudgement(all), "KR").sameCount > 0,
        }) === "USED",
    ).length;
    for (const r of selectCandidateList(all, "OVERSEAS")) {
      const use = candidatePriceUse(r.row, { sameOnlyPriceAxis: guide.sameCount > 0 });
      if (use === "USED") {
        usedCount += 1;
        const cur = (r.row.priceCurrency ?? "").toUpperCase();
        const bucket = osAgg.byCurrency[cur];
        /** 🔴🔴 **「반영」이면 그 통화 칸이 존재하고 금액이 범위 안에 있어야** 한다. */
        expect(bucket, `🔴 ${r.row.domain} — 「반영」인데 ${cur} 집계 칸이 없다`).toBeTruthy();
        expect(r.row.priceAmount!).toBeGreaterThanOrEqual(bucket!.lowestAmount);
        expect(r.row.priceAmount!).toBeLessThanOrEqual(bucket!.highestAmount ?? bucket!.lowestAmount);
      }
      console.log(
        `   ${r.row.domain.slice(0, 22).padEnd(22)} ${String(r.row.priceAmount ?? "-").padStart(8)}` +
          ` ${(r.row.priceCurrency ?? "-").padEnd(4)} ${(r.row.priceTier ?? "-").padEnd(11)} → ${use}`,
      );
    }
    console.log(`   🌎 집계 ${Object.entries(osAgg.byCurrency).map(([c, v]) => `${c} ${v.lowestAmount}~${v.highestAmount}×${v.count}`).join(" ")}`);
    /** 🔴 분모 0 을 PASS 로 쓰지 않는다 — 「반영」이 한 장도 없으면 이 증거가 성립하지 않는다. */
    expect(usedCount + krUsed, "🔴 「참고가격에 반영」 카드가 0 장이다 — ②가 증명되지 않았다").toBeGreaterThan(0);

    await mount(all, { overseasReference: osAgg });
    const useNodes = Array.from(
      container.querySelectorAll('[data-testid="mi-candidate-price-use"][data-use="USED"]'),
    );
    expect(useNodes.length, "🔴 화면의 「반영」 카드 수가 계산과 다르다").toBe(usedCount + krUsed);
    expect(useNodes[0]!.textContent).toContain("참고가격에 반영");
  });
});

/* ════════════ ③ 원가 부족 경로 — 🔴 함수 계약(운영 표본이 아니다) ════════════ */

describe("MPCD-2 ③ — 🔴 **함수 계약**: 원가 입력이 부족하면 권장가격이 없다", () => {
  /** 🔴 운영 환율표가 아니라 **계약용 최소 표** 다 — 「실측」으로 적지 않는다. */
  const RATES = { GBP: 1800, EUR: 1550 };

  it("③-1 🔴 금액이 0 이면 **A 권장가가 산출되지 않는다**(운영 `canComputeCost` 와 같은 조건)", () => {
    const r = resolveListingPrice(
      {
        priceOverrideKrw: null,
        originalAmount: 0,
        originalCurrency: "GBP",
        priceBreakdown: { shippingKrw: 12_000, feePercent: 10, marginPercent: 12 },
        priceValidity: "VALID",
      } as never,
      RATES,
      10,
    );
    expect(r.priceKrw, "🔴 원가가 없는데 권장가를 만들었다").toBeNull();
    expect(r.source).toBe("UNRESOLVED");
  });

  it("③-2 🔴 **배송비를 모르면**(null) 권장가가 없다 — 기본값으로 메우지 않는다", () => {
    const r = resolveListingPrice(
      {
        priceOverrideKrw: null,
        originalAmount: 37,
        originalCurrency: "GBP",
        priceBreakdown: { shippingKrw: null, feePercent: 10, marginPercent: 12 },
        priceValidity: "VALID",
      } as never,
      RATES,
      10,
    );
    expect(r.priceKrw, "🔴 비운 배송비가 되살아나 권장가가 났다").toBeNull();
    expect(r.reason ?? "").toContain("해외물류비");
  });

  it("③-3 🔴 **환율을 모르는 통화** 면 권장가가 없다(임의 환율 0)", () => {
    const r = resolveListingPrice(
      {
        priceOverrideKrw: null,
        originalAmount: 37,
        originalCurrency: "XYZ",
        priceBreakdown: { shippingKrw: 12_000, feePercent: 10, marginPercent: 12 },
        priceValidity: "VALID",
      } as never,
      RATES,
      10,
    );
    expect(r.priceKrw, "🔴 모르는 통화를 환산해 권장가를 만들었다").toBeNull();
    expect(r.reason ?? "", "🔴 사유가 「환율」을 말하지 않는다").toContain("환율");
  });

  it("③-4 🔴 **B 추천가도 나지 않는다** — 원가가 0 이면 CASE 가 근거를 못 만든다", () => {
    /** 🔴 운영은 이 함수를 `canComputeCost` 가드 **안에서만** 부른다(§26 S8 이 그 가드를 잠갔다). */
    const rec = computePriceRecommendation({
      totalCostKrw: 0,
      domesticLowestPriceKrw: null,
      /** 🔴 타입이 **요구하는 칸** 이다 — 빼면 tsc 가 잡는다(실제로 잡았다). */
      domesticAveragePriceKrw: null,
      domesticBasis: "NONE",
      minimumMarginPercent: 10,
      targetMarginPercent: 12,
      expectedFeePercent: 10,
      brandMedianPriceKrw: null,
    });
    expect(rec.marketCase).toBe("D");
    expect(rec.recommendedPrice).toBeNull();
  });

  it("③-5 🟢 **대조군** — 입력이 갖춰지면 둘 다 산출된다(가드가 과하지 않다)", () => {
    const a = resolveListingPrice(
      {
        priceOverrideKrw: null,
        originalAmount: 37,
        originalCurrency: "GBP",
        priceBreakdown: { shippingKrw: 12_000, feePercent: 10, marginPercent: 12 },
        priceValidity: "VALID",
      } as never,
      RATES,
      10,
    );
    expect(a.priceKrw, "🔴 정상 입력에서도 권장가가 없다 — 가드가 과하다").toBeGreaterThan(0);
    const b = computePriceRecommendation({
      totalCostKrw: 78_600,
      domesticLowestPriceKrw: 120_000,
      domesticAveragePriceKrw: 120_000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 12,
      expectedFeePercent: 10,
      brandMedianPriceKrw: null,
    });
    expect(b.recommendedPrice, "🔴 정상 입력에서 B 추천가가 없다").not.toBeNull();
  });
});
