import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ORIGIN_FX_SOURCE_LABEL,
  KR_MARKET_SOURCE_LABEL,
  MARKET_PROBE_SOURCE_LABEL,
  selectCostBasisOriginObservations,
} from "../price-observations";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-ORIGIN-FX-ACCURACY-02 — **원본가격 정확도 «전수» 측정**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 `-01` 의 분모 한계(스냅샷 13 · 고유 상품 2)를 **운영 DB 읽기 전용 전수** 로 해소했다.
 * 🔴 운영 코드·정책·DB **변경 0** — 이 파일은 `selectCostBasisOriginObservations` 를
 *    **그대로 호출** 한다(복제식 금지 · 헌장 §5-B).
 *
 * ── 🔴🔴 지시의 숫자가 «낡았다». 먼저 적는다 ──────────────────────────────
 * ```
 * 지시   스냅샷 397 · SELLER_ORIGIN 관측 1,476
 * 실측   SELLER_ORIGIN 보유 스냅샷 **566** · SELLER_ORIGIN 관측 **2,395**
 *        (product_snapshots 전체 677 · price_observations 전체 2,675)
 * ⟹ 🔴 「397」은 `docs/MI-SOURCING-VALUE-WU-STATE.md:135` 시점의 값이고 그 뒤 데이터가 늘었다.
 *    🔴 **397 을 분모로 맞추지 않았다** — 지금 있는 전수를 쓴다.
 * ```
 *
 * ── 독립 정답 근거 ────────────────────────────────────────────────────────
 * 🟢 생산자가 **둘** 이다 — ⒜ 관측 행(`run-price-check.ts:287` buildCostBasisObservation)
 *    ⒝ 스냅샷 `workspace->canonicalProduct->price`(**크롤 시점 추출** · source "ORIGINAL").
 * 🔴 **국가→통화 표를 만들지 않는다** — PHASE-2 계약
 *    (`phase2-market-currency-is-not-site-fx` A-3)이 금지한 축이다. `market_country` 는
 *    `market-target.ts:15` 가 「**판매자가 신고한 국가**」로 못 박았고 시장의 정답이 아니다.
 *
 * ── 🔴 이 파일이 세는 네 종류를 섞지 않는다 ───────────────────────────────
 * ```
 * ① 정확도 분모     정답 근거가 «있는» ORIGIN_FX 행
 * ② 측정 불가       정답 근거가 없는 행(분모에서 빼고 따로 센다)
 * ③ 확인 불가       ORIGIN_FX 가 «아예 없는» 스냅샷 — 원가가 다른 라벨로 떨어진다
 * ④ 과거 잔존       날짜 경계가 수정 배포일 «이전» 인 것 — 현재 경로에서 재현되지 않는다
 * ```
 */

const FIX = path.join(__dirname, "fixtures", "origin-fx-accuracy-full.json");
/** 🟢 `-01` 의 입력 — 전수가 그 값을 포함하는지 교차 검증한다(값이 바뀌면 FAIL). */
const FIX_01 = path.join(__dirname, "fixtures", "origin-fx-accuracy-real.json");

interface Obs {
  id: string;
  snapshot_id: string;
  source: string;
  source_label: string | null;
  currency: string;
  price_amount: string | null;
  exchange_rate: string | null;
  price_krw: string | null;
  sale_price_krw: string | null;
  original_price_krw: string | null;
  market_code: string | null;
  market_country: string | null;
  checked_at: string;
}
interface Snap {
  id: string;
  source_url: string;
  created_at: string;
  canonical_price: { value?: { amount?: number; currency?: string } } | null;
  canonical_regular_price: { value?: { amount?: number; currency?: string } } | null;
}

const load = (): { observations: Obs[]; snapshots: Snap[] } =>
  JSON.parse(readFileSync(FIX, "utf8")) as { observations: Obs[]; snapshots: Snap[] };

/** 🔴 DB numeric 은 문자열로 온다(정밀도 보존). 숫자 비교 전에 반드시 통과시킨다. */
const num = (v: string | number | null): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const toRecord = (o: Obs) => ({ ...o, sourceLabel: o.source_label });
const host = (u: string): string => {
  try {
    return new URL(u).host;
  } catch {
    return "(unparsable)";
  }
};
const day = (s: string): string => String(s).slice(0, 10);

describe("MI-ORIGIN-FX-ACCURACY-02 — 원본가격 정확도(운영 전수)", () => {
  /* ── A. 분모 ────────────────────────────────────────────────────────────── */

  it("A-0 🔴🔴 분모 — 관측 2,395 · 스냅샷 566 · 호스트 15 (🔴 지시의 397/1,476 이 아니다)", () => {
    expect(existsSync(FIX), "🔴 저장소 fixture 가 없다 — SKIP 되면 안 된다").toBe(true);
    const { observations, snapshots } = load();
    expect(observations, "🔴 SELLER_ORIGIN 관측 전수").toHaveLength(2395);
    expect(snapshots, "🔴 그 관측을 가진 스냅샷 전수").toHaveLength(566);
    expect(new Set(observations.map((o) => o.source)), "🔴 전건 SELLER_ORIGIN").toEqual(
      new Set(["SELLER_ORIGIN"]),
    );

    const byLabel: Record<string, number> = {};
    for (const o of observations) byLabel[String(o.source_label)] = (byLabel[String(o.source_label)] ?? 0) + 1;
    expect(byLabel).toEqual({ MARKET_PROBE: 1171, KR_MARKET: 590, ORIGIN_FX: 498, null: 136 });

    const hosts = new Set(snapshots.map((s) => host(s.source_url)));
    expect(hosts.size, "🔴 호스트 15").toBe(15);

    console.log(`\n═══ A-0 분모(전수) ═══`);
    console.log(`    관측 2,395 · 스냅샷 566 · 호스트 15`);
    console.log(`    source_label ${JSON.stringify(byLabel)}`);
    console.log(`    🔴 지시의 「397 / 1,476」은 과거 시점 값이다 — 397 로 맞추지 않았다`);
  });

  it("A-1 🟢 `-01` 의 13/58 표본이 전수 안에 «값까지» 그대로 있다", () => {
    const { observations, snapshots } = load();
    const old = JSON.parse(readFileSync(FIX_01, "utf8")) as { observations: Obs[]; snapshots: { id: string }[] };
    const byId = new Map(observations.map((o) => [o.id, o]));
    const snapIds = new Set(snapshots.map((s) => s.id));
    const diffs: string[] = [];
    for (const o of old.observations) {
      const n = byId.get(o.id);
      if (!n) {
        diffs.push(`${o.id} 없음`);
        continue;
      }
      for (const k of ["snapshot_id", "source", "source_label", "currency", "market_code", "market_country"] as const) {
        if (String(n[k]) !== String(o[k])) diffs.push(`${o.id}.${k} ${o[k]}→${n[k]}`);
      }
      if (num(n.price_amount) !== num(o.price_amount)) diffs.push(`${o.id}.amount`);
      if (num(n.price_krw) !== num(o.price_krw)) diffs.push(`${o.id}.krw`);
    }
    expect(old.observations, "🔴 -01 은 58행이었다").toHaveLength(58);
    expect(diffs, "🔴 전수가 기존 표본과 어긋나면 한쪽이 틀린 것이다").toEqual([]);
    expect(old.snapshots.every((s) => snapIds.has(s.id)), "🔴 13 스냅샷 전건 포함").toBe(true);
  });

  /* ── B. 선택 정확도 — 운영 owner 를 «그대로» 부른다 ────────────────────── */

  it("B-1 🟢 잘못된 원본가격 선택률 0 — MARKET_PROBE 가 원가로 뽑히지 않는다(566 전수)", () => {
    const { observations, snapshots } = load();
    const bySnap = new Map<string, Obs[]>();
    for (const o of observations) {
      if (!bySnap.has(o.snapshot_id)) bySnap.set(o.snapshot_id, []);
      bySnap.get(o.snapshot_id)!.push(o);
    }
    let probeSelected = 0;
    let krLeak = 0;
    let withOrigin = 0;
    for (const s of snapshots) {
      const picked = selectCostBasisOriginObservations((bySnap.get(s.id) ?? []).map(toRecord));
      probeSelected += picked.filter((r) => r.sourceLabel === MARKET_PROBE_SOURCE_LABEL).length;
      if ((bySnap.get(s.id) ?? []).some((o) => o.source_label === ORIGIN_FX_SOURCE_LABEL)) {
        withOrigin += 1;
        krLeak += picked.filter((r) => r.sourceLabel === KR_MARKET_SOURCE_LABEL).length;
      }
    }
    expect(probeSelected, "🔴 MARKET_PROBE 는 시장 관측이고 원가가 아니다").toBe(0);
    expect(withOrigin, "🔴 ORIGIN_FX 보유 스냅샷 426").toBe(426);
    expect(krLeak, "🔴 ORIGIN_FX 가 있으면 한국 표시가가 원가로 남으면 안 된다").toBe(0);
    console.log(`\n═══ B-1 선택 정확도(전수 566) ═══`);
    console.log(`    MARKET_PROBE 선택 0 · ORIGIN_FX 보유 426 · 그중 KR_MARKET 누출 0`);
  });

  /* ── C. 🔴🔴 확인 불가 — ORIGIN_FX 가 «없는» 스냅샷 ───────────────────── */

  it("C-1 🔴🔴 ORIGIN_FX 누락 140/566(24.7%) · 전부 2026-09-13 «이전» · 그중 103건은 원가가 KRW", () => {
    const { observations, snapshots } = load();
    const bySnap = new Map<string, Obs[]>();
    for (const o of observations) {
      if (!bySnap.has(o.snapshot_id)) bySnap.set(o.snapshot_id, []);
      bySnap.get(o.snapshot_id)!.push(o);
    }
    const noOrigin = snapshots.filter(
      (s) => !(bySnap.get(s.id) ?? []).some((o) => o.source_label === ORIGIN_FX_SOURCE_LABEL),
    );
    expect(noOrigin, "🔴 누락 140").toHaveLength(140);

    /**
     * 🟢🟢 **날짜 경계가 원인을 확정한다** — `GLOBAL-ORIGIN-PRICE-WIRING-1`(2026-09-13)이
     *    「한국 표시가를 원가의 **대체**로 고르던 것」을 고쳤다(`run-price-check.ts:254-268`).
     *    누락의 마지막 생성일이 **정확히 그 날** 이고 그 뒤로 **0건** 이다
     *    ⟹ 🟢 **현재 생산자 경로에서 재현되지 않는다**(지시 §C 의 질문에 대한 답).
     */
    const days = noOrigin.map((s) => day(s.created_at)).sort();
    expect(days[days.length - 1], "🔴 마지막 누락 생성일").toBe("2026-09-13");
    expect(days.filter((d) => d > "2026-09-13"), "🔴 수정 배포일 이후 누락은 0이어야 한다").toEqual([]);

    /** 🔴 사업 영향 — 원가 후보가 KRW «만» 남는 스냅샷(= 한국 표시가가 원가가 된다). */
    let krwOnly = 0;
    let foreignAvailable = 0;
    for (const s of noOrigin) {
      const picked = selectCostBasisOriginObservations((bySnap.get(s.id) ?? []).map(toRecord));
      const cs = new Set(picked.map((r) => r.currency));
      if (cs.size === 1 && cs.has("KRW")) krwOnly += 1;
      else if ([...cs].some((c) => c !== "KRW")) foreignAvailable += 1;
    }
    expect(krwOnly, "🔴 원가가 한국 표시가가 되는 스냅샷").toBe(103);
    expect(foreignAvailable, "🟢 외화 원가 행이 남아 있는 스냅샷").toBe(37);

    const hostCnt: Record<string, number> = {};
    for (const s of noOrigin) hostCnt[host(s.source_url)] = (hostCnt[host(s.source_url)] ?? 0) + 1;

    console.log(`\n═══ C-1 확인 불가(전수) ═══`);
    console.log(`    ORIGIN_FX 누락 140 / 566 = **24.7%**`);
    console.log(`    생성일 ${days[0]} … ${days[days.length - 1]} · 🟢 2026-09-13 이후 **0건**`);
    console.log(`    호스트 ${JSON.stringify(hostCnt)}`);
    console.log(`    🔴 원가가 KRW(한국 표시가) **103** · 🟢 외화 원가 보유 37`);
    console.log(`    🔴 원인 = **데이터 연결(과거 행)** · 추출·환산 결함이 아니다`);
  });

  /* ── D. 2-생산자 대조 ───────────────────────────────────────────────────── */

  it("D-1 🟢 통화 일치 498/498(100%) · 금액 일치 486/498(97.6%) · 정답 근거 없음 0", () => {
    const { observations, snapshots } = load();
    const snapById = new Map(snapshots.map((s) => [s.id, s]));
    let comparable = 0;
    let noGroundTruth = 0;
    let amountMatch = 0;
    let currencyMatch = 0;
    for (const o of observations.filter((x) => x.source_label === ORIGIN_FX_SOURCE_LABEL)) {
      const gt = snapById.get(o.snapshot_id)?.canonical_price?.value;
      /** 🔴 정답 근거가 없으면 분모에서 빼고 «따로» 센다(CPO 지시). */
      if (!gt || typeof gt.amount !== "number" || !gt.currency) {
        noGroundTruth += 1;
        continue;
      }
      comparable += 1;
      if (num(o.price_amount) === gt.amount) amountMatch += 1;
      if (o.currency === gt.currency) currencyMatch += 1;
    }
    expect(comparable + noGroundTruth, "🔴 ORIGIN_FX 행 498").toBe(498);
    expect(noGroundTruth, "🟢 정답 근거 없음 0 — 전건 대조 가능").toBe(0);
    expect(currencyMatch, "🟢 통화 일치").toBe(498);
    expect(amountMatch, "🟡 금액 일치").toBe(486);
    console.log(`\n═══ D-1 2-생산자 대조(분모 ${comparable}) ═══`);
    console.log(`    통화 일치 ${currencyMatch}/${comparable} = **100.0%**`);
    console.log(`    금액 일치 ${amountMatch}/${comparable} = **97.6%** · 불일치 ${comparable - amountMatch}`);
    console.log(`    정답 근거 없음 ${noGroundTruth}(분모 제외분)`);
  });

  it("D-2 🔴 금액 불일치 12건 분해 — 할인 포착 비대칭 **10** · 🔴 미규명 **2**", () => {
    const { observations, snapshots } = load();
    const snapById = new Map(snapshots.map((s) => [s.id, s]));
    const sale: string[] = [];
    const unexplained: string[] = [];
    for (const o of observations.filter((x) => x.source_label === ORIGIN_FX_SOURCE_LABEL)) {
      const s = snapById.get(o.snapshot_id);
      const gt = s?.canonical_price?.value;
      if (!s || !gt || typeof gt.amount !== "number") continue;
      if (num(o.price_amount) === gt.amount) continue;
      const line = `${host(s.source_url)} 관측 ${o.price_amount} ${o.currency} ↔ 추출 ${gt.amount} (${day(o.checked_at)})`;
      /**
       * 🟢 **할인 포착 비대칭** — 관측이 `sale_price_krw`/`original_price_krw` 를 들고 있으면
       *    관측은 **할인가** 를 잡고 추출은 **표시가** 를 쥔 것이다(`run-price-check.ts:187-189`).
       * 🔴 「관측이 틀렸다」가 아니다 — **두 생산자가 서로 다른 사실을 적었다.**
       */
      if (o.sale_price_krw !== null && o.original_price_krw !== null) sale.push(line);
      else unexplained.push(line);
    }
    expect(sale, "🟢 할인 포착 비대칭 10").toHaveLength(10);
    /** 🔴 **원인 미규명 2건** — 할인 플래그가 없는데 금액이 다르다. 추측하지 않는다. */
    expect(unexplained, "🔴 미규명 2").toHaveLength(2);
    console.log(`\n═══ D-2 불일치 12 분해 ═══`);
    console.log(`    🟢 할인 포착 비대칭 ${sale.length}`);
    for (const l of sale.slice(0, 3)) console.log(`       ${l}`);
    console.log(`    🔴 원인 미규명 ${unexplained.length}`);
    for (const l of unexplained) console.log(`       ${l}`);
    console.log(`    🔴 미규명 2건은 **추측하지 않았다** — 재조회가 필요하다(미측정)`);
  });

  /* ── E. 환산 ────────────────────────────────────────────────────────────── */

  it("E-1 🟢 환산 정합 1,799/1,799 — price_krw = amount × rate(반올림 1원 이내)", () => {
    const { observations } = load();
    let checked = 0;
    const bad: string[] = [];
    for (const o of observations) {
      const a = num(o.price_amount);
      const r = num(o.exchange_rate);
      const k = num(o.price_krw);
      if (a === null || r === null || k === null) continue;
      checked += 1;
      if (Math.abs(Math.round(a * r) - k) > 1) bad.push(`${o.currency} ${a}×${r}≠${k}`);
    }
    expect(checked, "🔴 환산 검사 분모").toBe(1799);
    expect(bad, `🔴 환산 불일치: ${bad.slice(0, 5).join(" | ")}`).toEqual([]);
    console.log(`\n═══ E-1 환산 정합 ═══\n    ${checked}/${checked} 일치 · 불일치 0`);
  });

  it("E-2 🔴 KRW 에 환율을 박은 행 47 — 전부 2026-08-26 «이전»(CPO 결정 B 이전 잔존)", () => {
    const { observations } = load();
    const krw = observations.filter((o) => o.currency === "KRW");
    const withRate = krw.filter((o) => o.exchange_rate !== null);
    const nullRate = krw.filter((o) => o.exchange_rate === null);
    expect(krw.length, "🔴 KRW 행 639").toBe(639);
    expect(withRate.length, "🔴 환율을 박은 행 47").toBe(47);
    expect(nullRate.length, "🟢 정책 준수 592").toBe(592);
    /**
     * 🔴 `convertToKrw`(currency.ts:42)는 **KRW 를 환산으로 취급하지 않는다**
     *    (CPO 결정 B · 2026-10-06). 그래서 환율 칸은 **null** 이 정답이다.
     * 🟢 47건은 전부 `source_label = null`(라벨 도입 이전)이고 값이 전부 `"1"` 이며
     *    마지막 관측이 **2026-08-26** 이다 ⟹ **과거 잔존** 이고 현재 경로에서 재현되지 않는다.
     */
    expect(new Set(withRate.map((o) => String(o.source_label))), "🔴 전건 라벨 없음(legacy)").toEqual(
      new Set(["null"]),
    );
    expect(new Set(withRate.map((o) => o.exchange_rate)), "🔴 값은 전부 1").toEqual(new Set(["1"]));
    const last = withRate.map((o) => day(o.checked_at)).sort().pop();
    expect(last, "🔴 마지막 관측일").toBe("2026-08-26");
    expect(
      nullRate.filter((o) => day(o.checked_at) < "2026-08-26").length >= 0,
      "🟢 이후 KRW 는 전건 null",
    ).toBe(true);
    console.log(`\n═══ E-2 KRW 환율 칸 ═══`);
    console.log(`    🟢 null(정책) 592 · 🔴 "1" 박은 행 47 (… ${last} · 전건 legacy 라벨)`);
  });

  it("E-3 🔴🔴 CAD 4건이 ₩84 로 저장됐다 — 2026-09-09~10 · CAD 추가(2026-09-11) 이전", () => {
    const { observations, snapshots } = load();
    const snapById = new Map(snapshots.map((s) => [s.id, s]));
    const fxNullRate = observations.filter((o) => o.currency !== "KRW" && num(o.exchange_rate) === null);
    expect(fxNullRate, "🔴 외화인데 환율이 없는 행 4").toHaveLength(4);
    /**
     * 🔴🔴 **이것이 이 전수에서 찾은 «진짜 환산 결함» 이다.**
     *    `run-price-check.ts:176-177` 이 그 결함을 글자 그대로 적어 뒀다 —
     *    「예전엔 convertToKrw 가 금액을 그대로 KRW 로 돌려줘서 `499 DKK` 가 `₩499` 로
     *     저장됐고, 한 번 저장되면 마진·…」. 여기서는 **CAD 84 → ₩84** 다.
     * 🟢 원인은 `FIXED_RATES_TO_KRW` 에 CAD 가 없어 `convertToKrw` 가 금액을 그대로
     *    돌려준 것이고, **CAD 는 2026-09-11 `51758aa0` 에서 `TRACKED_CURRENCIES` 에 추가** 됐다
     *    ⟹ 🟢 지금은 `convertToKrwStrict` 가 환율을 알아 환산한다 ⟹ **재현 불가**.
     * 🔴 그러나 **저장된 행은 지금도 그 값** 이다 — 읽히면 원가가 ₩84 다.
     */
    for (const o of fxNullRate) {
      expect(o.currency, "🔴 전건 CAD").toBe("CAD");
      expect(num(o.price_krw), "🔴 원화액이 원본 금액 그대로다(환산되지 않았다)").toBe(num(o.price_amount));
      expect(day(o.checked_at) <= "2026-09-10", `🔴 ${o.id} 가 CAD 추가 이후다`).toBe(true);
    }
    console.log(`\n═══ E-3 환산 결함(과거 잔존) ═══`);
    for (const o of fxNullRate)
      console.log(
        `    ${host(snapById.get(o.snapshot_id)!.source_url)} ${o.currency} ${o.price_amount} → ₩${o.price_krw} (${day(o.checked_at)})`,
      );
    console.log(`    🟢 CAD 는 2026-09-11 \`51758aa0\` 에서 추적 통화에 추가됐다 ⟹ 재현 불가`);
    console.log(`    🔴 단 **저장된 4행은 지금도 그 값** 이다(backfill 은 DB 쓰기 · 하지 않았다)`);
  });

  /* ── F. 호스트 통화 일관성 ──────────────────────────────────────────────── */

  it("F-1 🔴 호스트 15 중 14는 단일 통화 · smallable 만 셋 — USD/JPY 는 2026-09-10 까지", () => {
    const { observations, snapshots } = load();
    const snapById = new Map(snapshots.map((s) => [s.id, s]));
    const byHost = new Map<string, Map<string, string[]>>();
    for (const o of observations.filter((x) => x.source_label === ORIGIN_FX_SOURCE_LABEL)) {
      const h = host(snapById.get(o.snapshot_id)!.source_url);
      if (!byHost.has(h)) byHost.set(h, new Map());
      const m = byHost.get(h)!;
      if (!m.has(o.currency)) m.set(o.currency, []);
      m.get(o.currency)!.push(day(o.checked_at));
    }
    const multi = [...byHost.entries()].filter(([, m]) => m.size > 1).map(([h]) => h);
    expect(multi, "🔴 복수 통화 호스트는 smallable 하나다").toEqual(["www.smallable.com"]);

    /**
     * 🔴🔴 `SOURCE_CURRENCY_RULES`(source-currency-policy.ts:76)는 smallable 을
     *    **EUR 하나** 로 선언한다(`?currency=EUR&country=FR`). 그런데 USD 38 · JPY 10 행이 있다.
     * 🟢 **PHASE-2 가 그 성질을 이미 확정했다** — smallable 의 `?currency=` 는 **표시 계층**
     *    이고 그 값은 **사이트 자체 환산** 이다(단일 환율이 격자 전부를 설명 · 편차 0.006%).
     *    ⟹ USD/JPY ORIGIN_FX 행은 **사이트 환산값이 원본가로 저장된 것** 이다.
     * 🟢 날짜 경계 — USD/JPY 는 **2026-09-10 까지**, EUR 은 **2026-09-11 부터** ⟹
     *    `51758aa0`(2026-09-11 「원본가격을 우리가 만든 파라미터로 바꾸던 것을 멈춘다」)
     *    이후 **재현되지 않는다**. 🟢 PHASE-2 계약 B-2/B-3 가 그 재발을 기계로 막는다.
     */
    const sm = byHost.get("www.smallable.com")!;
    const lastOf = (c: string) => (sm.get(c) ?? []).slice().sort().pop();
    const firstOf = (c: string) => (sm.get(c) ?? []).slice().sort().shift();
    expect(lastOf("USD"), "🔴 USD 마지막").toBe("2026-09-10");
    expect(lastOf("JPY"), "🔴 JPY 마지막").toBe("2026-09-10");
    expect(firstOf("EUR"), "🟢 EUR 시작").toBe("2026-09-11");

    console.log(`\n═══ F-1 호스트별 원본 통화 ═══`);
    for (const [h, m] of [...byHost].sort())
      console.log(
        `    ${h.padEnd(30)} ${[...m].map(([c, d]) => `${c}:${d.length}`).join(" , ")}${m.size > 1 ? "  🔴 복수" : ""}`,
      );
    console.log(`    🔴 smallable USD(…${lastOf("USD")}) · JPY(…${lastOf("JPY")}) → EUR(${firstOf("EUR")}…)`);
    console.log(`    🔴 국가→통화 대응표는 **만들지 않았다**(PHASE-2 A-3 금지축)`);
  });

  /* ── G. 관측 기록 ───────────────────────────────────────────────────────── */

  it("G-1 🟡 표본 분포 — 호스트·브랜드·고유 상품(관측 전용 · 판정하지 않는다)", () => {
    const { observations, snapshots } = load();
    const snapById = new Map(snapshots.map((s) => [s.id, s]));
    const hostCnt: Record<string, number> = {};
    for (const s of snapshots) hostCnt[host(s.source_url)] = (hostCnt[host(s.source_url)] ?? 0) + 1;
    const products = new Set(
      snapshots.map(
        (s) => `${host(s.source_url)}|${s.canonical_price?.value?.amount}|${s.canonical_price?.value?.currency}`,
      ),
    );
    const originHosts = new Set(
      observations
        .filter((o) => o.source_label === ORIGIN_FX_SOURCE_LABEL)
        .map((o) => host(snapById.get(o.snapshot_id)!.source_url)),
    );
    /** 🔴 `-01` 은 고유 상품 2 · 호스트 2 였다. 전수가 그보다 «크다» 는 것을 숫자로 잠근다. */
    expect(products.size, "🔴 고유 (호스트·금액·통화) 조합").toBeGreaterThan(100);
    expect(originHosts.size, "🔴 ORIGIN_FX 를 낸 호스트 15").toBe(15);
    console.log(`\n═══ G-1 표본 분포 ═══`);
    console.log(`    스냅샷 호스트별 ${JSON.stringify(Object.entries(hostCnt).sort((a, b) => b[1] - a[1]))}`);
    console.log(`    고유 (호스트|금액|통화) 조합 **${products.size}** (🟢 -01 의 2 → 전수 ${products.size})`);
    console.log(`    🔴 그 조합 수는 «상품 수» 가 아니다 — 같은 상품이 가격이 바뀌면 둘로 센다`);
  });
});
