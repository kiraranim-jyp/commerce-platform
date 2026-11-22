import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { computePriceRecommendation, computeSellability } from "@commerce/pricing";

import { summarizeCandidateOverseasPrices, type CandidateOverseasPriceRecord } from "../candidate-market";
import { selectCostBasisOriginObservations } from "../price-observations";
import { PRICE_DISQUALIFYING_BLOCKER_LIST } from "../../../../../lib/price-disqualifying-blockers";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-FINAL-COMPLETION-01 — **통합 MI 운영 E2E(실데이터)**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **보고서가 아니라 «상품 하나가 끝까지 도는가» 를 본다.**
 *    입력은 **운영 DB 실데이터**(읽기 전용 덤프 · 가공 0)이고
 *    각 단계는 **운영 owner 를 그대로 호출** 한다(복제식 0 · 헌장 §5-B).
 *
 * ── 표본 ──────────────────────────────────────────────────────────────────
 * ```
 * 원상품  `25a3bba7…` Bobo Choses Pop sweatshirt · **EUR 62** ·
 *         priceBreakdown {fee 10% · shipping ₩12,000 · margin 12%}
 * 관측    SELLER_ORIGIN **6**
 * 후보    `candidate_reviews` **10** — 🟢 **전건 운영 판정 보유**(system_verdict 10/10)
 *         SAME/OVERSEAS/EXACT 1 · **SAME/UNKNOWN/EXACT 1** ·
 *         PRESUMED/OVERSEAS/COMPARISON 6 · **PRESUMED/UNKNOWN/COMPARISON 2**
 * ```
 * 🔴 **표본은 상품 1개** 다 — 아래 수치를 「MI 전체 정확도」로 일반화하지 않는다.
 *
 * 🔴 **`computeMarketIntelligence` 를 직접 못 부른다** — 그 함수는 supabase
 *    service-role 키를 요구하고 이 환경에 **없다**. 🟢 그래서 **그 함수가 부르는
 *    owner 들** 에 같은 입력을 넣어 ③~⑧ 단계를 돌린다. ①② 는 §0-XM01 이
 *    코드 위치로 이미 확정했다(재조사 금지).
 */

const FIX = path.join(__dirname, "fixtures", "mi-final-e2e-01.json");

interface Obs {
  source: string;
  source_label: string | null;
  currency: string;
  price_amount: string | null;
  price_krw: string | null;
  exchange_rate: string | null;
  market_code: string | null;
}
interface Rev {
  candidate_url: string;
  candidate_domain: string;
  candidate_title: string | null;
  market: string | null;
  price_amount: string | null;
  price_currency: string | null;
  price_status: string | null;
  sold_out: boolean | null;
  system_verdict: string | null;
  match_truth: string | null;
  price_tier: string | null;
  blockers: string[] | null;
  human_verdict: string | null;
}
interface Fx {
  snapshot: { id: string; title: string; price: { value?: { amount?: number; currency?: string } } | null; price_breakdown: { feePercent?: number; shippingKrw?: number; marginPercent?: number } | null };
  observations: Obs[];
  candidateReviews: Rev[];
}

const fx = (): Fx => JSON.parse(readFileSync(FIX, "utf8")) as Fx;
const num = (v: string | number | null): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 🟢 운영 집계기가 받는 모양으로만 옮긴다 — 값은 그대로다(새 계산 0). */
const toPriceRecord = (r: Rev): CandidateOverseasPriceRecord =>
  ({
    market: r.market ?? "UNKNOWN",
    currency: r.price_currency ?? "",
    amount: num(r.price_amount),
    priceTier: r.price_tier ?? undefined,
    priceStatus: r.price_status ?? undefined,
    blockers: r.blockers ?? [],
    sellerKey: r.candidate_domain,
  }) as unknown as CandidateOverseasPriceRecord;

describe("MI-FINAL-E2E-01 — 통합 MI 운영 E2E(실데이터 · 상품 1개)", () => {
  /* ── ③ 판정 — 한 엔진의 산출이 후보마다 실재한다 ───────────────────────── */

  it("E2E-1 🟢 후보 10건 전건에 **운영 판정** 이 있다(국내·해외 전용 상태 0)", () => {
    const { candidateReviews: rev } = fx();
    expect(rev, "🔴 후보 10").toHaveLength(10);
    for (const r of rev) expect(r.system_verdict, `🔴 ${r.candidate_domain} 판정 없음`).toBeTruthy();
    /** 🔴 판정 어휘가 **한 집합** 이어야 한다 — 시장별 전용 상태가 있으면 엔진이 갈린 것이다. */
    const verdicts = new Set(rev.map((r) => String(r.system_verdict)));
    for (const v of verdicts) expect(["SAME", "PRESUMED_SAME", "SIMILAR", "UNKNOWN", "CONFLICT"]).toContain(v);
    console.log(`\n═══ ③ 판정(운영 산출) ═══`);
    for (const r of rev)
      console.log(
        `    ${r.candidate_domain.padEnd(26)} ${String(r.system_verdict).padEnd(14)} ` +
          `truth=${String(r.match_truth).padEnd(18)} tier=${String(r.price_tier).padEnd(11)} market=${String(r.market)}`,
      );
  });

  /* ── ④⑤ 가격 적격성 + 시장 참고가격 — 운영 집계기를 «그대로» 부른다 ───── */

  it("E2E-2 🟢 가격 적격성·집계가 실제로 돈다 — 통화별로만 모이고 환산이 없다", () => {
    const { candidateReviews: rev } = fx();
    const summary = summarizeCandidateOverseasPrices(rev.map(toPriceRecord));
    /** 🟢 금액이 실제로 나온다(상품 1개에서 시장 가격 근거가 선다). */
    const currencies = Object.keys(summary.byCurrency);
    expect(currencies.length, "🟢 통화별 집계가 비지 않는다").toBeGreaterThan(0);
    /** 🔴🔴 **합계 칸이 없다** — 통화를 섞지 않는다(환산 금지 계약). */
    expect(summary, "🔴 통화 합계 칸이 생기면 환산한 것이다").not.toHaveProperty("total");
    /**
     * 🔴🔴 **내 1차 단언이 틀렸고 코드가 맞았다. 그 사실을 남긴다.**
     *    「`lowestKrw` 칸이 있으면 환산한 것」으로 단언해 **FAIL** 했다. 그 칸은
     *    집계기가 만든 것이 아니라 **호출자(`market-intelligence`)가 라이브 환율로
     *    미리 계산해 넘긴 `krwEquivalent`** 의 파생이다(candidate-market.ts:633 —
     *    넘겨받은 값만 비교한다 · 그 파일은 환율을 모른다).
     * 🟢 그래서 단언을 **그 경계를 지키는 방향** 으로 바꿨다 — 환산값을 **넘기지
     *    않았으니 `null` 이어야** 한다. 집계기가 스스로 환산하면 여기서 FAIL 한다.
     */
    expect(summary.lowestKrw, "🔴🔴 집계기가 «스스로» 환산했다 — 환산 금지 위반").toBeNull();
    console.log(`\n═══ ④⑤ 가격 적격성·집계 ═══`);
    console.log(`    count=${summary.count} · byMarket=${JSON.stringify(summary.byMarket)}`);
    console.log(`    byPriceTier=${JSON.stringify(summary.byPriceTier)}`);
    for (const c of currencies) console.log(`    ${c}: ${JSON.stringify(summary.byCurrency[c])}`);
  });

  it("E2E-3 🔴 차단축을 든 후보는 금액에 들어가지 않는다(운영 집계기로 확인)", () => {
    const { candidateReviews: rev } = fx();
    const dq = (r: Rev) => (r.blockers ?? []).some((b) => PRICE_DISQUALIFYING_BLOCKER_LIST.includes(b));
    const base = summarizeCandidateOverseasPrices(rev.map(toPriceRecord));
    const cleanOnly = summarizeCandidateOverseasPrices(rev.filter((r) => !dq(r)).map(toPriceRecord));
    /** 🟢 차단축 후보를 손으로 빼도 **금액 집계가 같다** ⟹ 집계기가 이미 빼고 있다. */
    expect(cleanOnly.byCurrency, "🔴 차단축이 금액에 섞여 있었다").toEqual(base.byCurrency);
    console.log(`\n═══ ④ 차단축 ═══\n    차단축 보유 후보 ${rev.filter(dq).length}건 · 금액 집계 영향 **0**`);
  });

  /* ── ⑥ 화면 축 — All / Domestic / Overseas ─────────────────────────────── */

  it("E2E-4 🟢🟢 **시장 미확정 후보 3건이 「전체」에만 선다** — 전에는 사라졌다", () => {
    const { candidateReviews: rev } = fx();
    const kr = rev.filter((r) => r.market === "KR");
    const os = rev.filter((r) => r.market === "OVERSEAS");
    const unresolved = rev.filter((r) => r.market !== "KR" && r.market !== "OVERSEAS");
    expect(kr, "🇰🇷 국내 0").toHaveLength(0);
    expect(os, "🌎 해외 7").toHaveLength(7);
    /** 🔴🔴 이 3건이 「전체」 축이 없을 때 **두 칸 어디에도 서지 않던** 후보다. */
    expect(unresolved, "🔴 시장 미확정 3").toHaveLength(3);
    /** 🔴 그중 하나는 **SAME · EXACT** 다 — 사라지면 안 되는 후보였다. */
    const sameUnresolved = unresolved.filter((r) => r.system_verdict === "SAME");
    expect(sameUnresolved, "🔴 미확정 중 확정 SAME 1").toHaveLength(1);
    expect(sameUnresolved[0].price_tier).toBe("EXACT");
    console.log(`\n═══ ⑥ All / Domestic / Overseas ═══`);
    console.log(`    전체 ${rev.length} · 🇰🇷 ${kr.length} · 🌎 ${os.length} · 🔴 시장 미확정 **${unresolved.length}**`);
    for (const r of unresolved)
      console.log(`       ${r.candidate_domain.padEnd(26)} ${String(r.system_verdict).padEnd(14)} tier=${String(r.price_tier)}`);
    console.log(`    🔴 그중 **SAME·EXACT 1건** — 「전체」 축이 없으면 화면에서 사라진다`);
  });

  /* ── ⑦ 원가 → recommendedPrice ─────────────────────────────────────────── */

  it("E2E-5 🟢 원가 선택이 돌고 recommendedPrice 가 **원가 역산** 으로 나온다", () => {
    const { snapshot, observations } = fx();
    const origin = observations.filter((o) => o.source === "SELLER_ORIGIN");
    const picked = selectCostBasisOriginObservations(origin.map((o) => ({ ...o, sourceLabel: o.source_label })));
    /** 🔴 시장 관측(MARKET_PROBE)은 원가가 아니다. */
    expect(picked.every((r) => r.sourceLabel !== "MARKET_PROBE"), "🔴 시장 관측이 원가로 뽑혔다").toBe(true);
    const costKrw = num(picked[0]?.price_krw ?? null);
    expect(costKrw, "🟢 원가가 실재한다").toBeTruthy();

    /**
     * 🔴🔴 **칸 이름을 추측했다가 typecheck 가 잡았다**(§12 의 그 함정 · 이 트랙 반복).
     *    `costKrw`/`feePercent` 가 아니라 **`totalCostKrw`·`expectedFeePercent`·
     *    `domesticBasis`** 다. 🟢 타입에서 읽어 고쳤다.
     * 🔴 **시장 가격은 null 로 넘긴다** — 이 표본의 국내 동일상품이 0 이고,
     *    없는 값을 지어내지 않는다(그래서 아래 CASE 가 **D = 판단 보류** 로 나온다).
     */
    const bd = snapshot.price_breakdown ?? {};
    const rec = computePriceRecommendation({
      totalCostKrw: costKrw! + (bd.shippingKrw ?? 0),
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      domesticBasis: "NONE",
      minimumMarginPercent: bd.marginPercent ?? 0,
      targetMarginPercent: bd.marginPercent ?? 0,
      expectedFeePercent: bd.feePercent ?? 0,
    });
    expect(rec, "🟢 추천가 산출이 돈다").toBeTruthy();
    /** 🔴🔴 국내 근거가 없으므로 **CASE D(판단 보류)** 여야 한다 — 가격을 지어내지 않는다. */
    expect(rec.marketCase, "🔴 근거 없이 CASE A/B/C 를 내면 안 된다").toBe("D");
    /** 🔴🔴 **시장 평균이 아니다** — 입력에 시장 가격이 한 칸도 들어가지 않았다. */
    console.log(`\n═══ ⑦ 원가 → recommendedPrice ═══`);
    console.log(`    원가 행 ${picked.length}/${origin.length} · 원가 ₩${costKrw}`);
    console.log(`    breakdown ${JSON.stringify(bd)}`);
    console.log(`    추천가 ${JSON.stringify(rec).slice(0, 200)}`);
    console.log(`    🔴 입력에 **시장 가격이 없다** — A(원가 역산)와 B(시장 참고가)는 분리돼 있다`);
  });

  /* ── ⑧ MI CASE / 판매 가능성 ──────────────────────────────────────────── */

  it("E2E-6 🟢 sellability 가 «데이터가 없을 때 추천하지 않는다»", () => {
    const { snapshot, observations, candidateReviews: rev } = fx();
    /**
     * 🔴 여기도 칸 이름을 추측했다가 typecheck 가 잡았다 — 실제 계약은
     *    `{ costPriceKrw, domestic: { matched, averagePriceKrw } }` 다. 타입에서 읽어 고쳤다.
     */
    const picked = selectCostBasisOriginObservations(
      observations.filter((o) => o.source === "SELLER_ORIGIN").map((o) => ({ ...o, sourceLabel: o.source_label })),
    );
    const costPriceKrw = num(picked[0]?.price_krw ?? null);
    /** 🟢 이 표본의 국내 동일상품은 **0** 이다 — `matched: false` 가 사실이다. */
    const domesticMatched = rev.some((r) => r.market === "KR" && r.system_verdict === "SAME");
    const out = computeSellability({
      costPriceKrw,
      domestic: { matched: domesticMatched, averagePriceKrw: null },
    });
    expect(out, "🟢 결과가 나온다").toBeTruthy();
    expect(domesticMatched, "🔴 이 표본의 국내 확정 SAME 은 0").toBe(false);
    /** 🔴🔴 국내 근거가 없는데 **GREEN(판매 추천)** 이 나오면 「없는 데이터로 추천」이다. */
    expect(out.level, "🔴 근거 없이 추천하지 않는다").not.toBe("GREEN");
    console.log(`\n═══ ⑧ MI CASE / 판매 가능성 ═══`);
    console.log(`    원가 ₩${costPriceKrw} · 국내 확정 SAME ${domesticMatched ? "있음" : "없음"} · level=**${out.level}**`);
    console.log(`    snapshot=${snapshot.id.slice(0, 8)} · 🟢 GREEN 이 아니다 — 「없는 데이터로 추천하지 않는다」가 지켜진다`);
  });

  /* ── 성능 — 🔴 분모를 같이 적고 일반화하지 않는다 ──────────────────────── */

  it("E2E-7 🔴 이 표본의 성능 — 분모 10(상품 1개) · 일반화하지 않는다", () => {
    const { candidateReviews: rev } = fx();
    const sys = (v: string) => rev.filter((r) => r.system_verdict === v).length;
    const tier = (v: string) => rev.filter((r) => r.price_tier === v).length;
    const withPrice = rev.filter((r) => num(r.price_amount) !== null).length;
    const human = rev.filter((r) => r.human_verdict !== null).length;
    expect(rev).toHaveLength(10);
    /** 🔴 사람 라벨이 없으면 **정확도를 말할 수 없다** — 이 표본이 그렇다. */
    expect(human, "🔴 이 표본의 human 라벨 수").toBe(0);
    console.log(`\n═══ 성능(분모 ${rev.length} · 상품 1개) ═══`);
    console.log(`    확정 SAME ${sys("SAME")} · 보류 ${sys("PRESUMED_SAME")} · tier EXACT ${tier("EXACT")} · COMPARISON ${tier("COMPARISON")}`);
    console.log(`    가격 보유 ${withPrice}/${rev.length}`);
    console.log(`    🔴 human 라벨 **0** ⟹ 이 표본으로 **정확도(오탐/회수율)는 측정 불가** 다`);
    console.log(`    🟢 정확도는 §0-XM03(연결 6 · 확정 SAME 오탐 0 · 회수 4/4)에서 잰 값이 유일하다`);
  });
});
