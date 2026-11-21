import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ORIGIN_FX_SOURCE_LABEL,
  KR_MARKET_SOURCE_LABEL,
  MARKET_PROBE_SOURCE_LABEL,
  isCostBasisOriginObservation,
  selectCostBasisOriginObservations,
} from "../price-observations";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-ORIGIN-FX-ACCURACY-01 — **원본가격(ORIGIN_FX) 정확도 측정**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 지시의 분모(397)는 이 세션에서 도달하지 못했다. 먼저 적는다.**
 * ```
 * 「397」의 출처   docs/MI-SOURCING-VALUE-WU-STATE.md:135-136
 *                 「SELLER_ORIGIN 관측 1476행 / 스냅샷 397개 전부 … withCost 397/397」
 * 🔴 그 데이터는 **운영 DB(`price_observations`)** 이고 이 세션에는 `DATABASE_URL` 도
 *    service-role 키도 **없다**(실측: scripts/.env = GEMINI_API_KEY 하나 ·
 *    .env.local = VERCEL_OIDC_TOKEN · apps/admin/.env.local = 프록시 둘).
 * 🔴 저장소·산출물 전수를 훑어 **ORIGIN_FX 관측을 담은 입력은 하나뿐** 이었다
 *    (`wu008-provenance.json` — 스냅샷 13 · 관측 58).
 * ⟹ 🔴 **이 파일의 분모는 397 이 아니다.** 아래 A-0 가 그 분모를 숫자로 고정한다.
 * ```
 *
 * 🔴🔴 **그리고 이 분모는 「상품 13개」가 아니다** — 고유 상품은 **2개** 다
 *    (bobochoses.co.jp JPY 26,400 × 2 스냅샷 · bobochoses.com EUR 120 × 11 스냅샷).
 *    ⟹ 🔴 **비율을 「ORIGIN_FX 정확도 N%」로 일반화하지 않는다.** 분모를 같이 적는다.
 *
 * ── 무엇을 «독립 정답 근거» 로 쓰는가 ──────────────────────────────────────
 * 🟢 생산자가 **둘** 이라서 교차 대조가 성립한다(둘이 같은 코드가 아니다):
 * ```
 * ① 관측 행    run-price-check.ts:287-295  buildCostBasisObservation
 *              금액/통화 = 사이트 선언 base market probe **또는** 크롤 시점 폴백
 * ② 스냅샷     canonical_product.price     = **크롤 시점 추출**(source "ORIGINAL")
 * ⟹ 🟢 ②는 ①의 입력 폴백과 같은 계열이지만 **다른 시점·다른 저장소** 이고,
 *    ①이 probe 를 썼으면 **완전히 독립** 이다 ⟹ 불일치는 그 자체로 결함 신호다
 * ```
 * 🔴 **국가→통화 표를 만들지 않는다** — `market_country` 를 통화의 정답으로 쓰면
 *    PHASE-2 가 계약으로 금지한 그 축(`phase2-market-currency-is-not-site-fx` A-3)이다.
 *    그래서 통화 정확도는 **②와의 일치** 로만 재고, `market_country` 는 **관측으로만** 적는다.
 *
 * 🔴 운영 코드·정책·DB 변경 **0** — 이 파일은 `selectCostBasisOriginObservations` 를
 *    **그대로 호출** 한다(복제식 금지 · 헌장 §5-B).
 */

const FIX = path.join(__dirname, "fixtures", "origin-fx-accuracy-real.json");

interface Obs {
  id: string;
  snapshot_id: string;
  source: string;
  source_label: string | null;
  source_product_url: string | null;
  currency: string;
  price_amount: string | number | null;
  exchange_rate: string | number | null;
  price_krw: string | number | null;
  market_code: string | null;
  market_country: string | null;
  checked_at: string;
}
interface Snap {
  id: string;
  source_url: string;
  title: string | null;
  canonicalPrice: { value?: { amount?: number; currency?: string }; source?: string } | null;
  canonicalBrand: unknown;
}

const load = (): { observations: Obs[]; snapshots: Snap[] } =>
  JSON.parse(readFileSync(FIX, "utf8")) as { observations: Obs[]; snapshots: Snap[] };

/** 🔴 DB 는 numeric 을 문자열로 준다 — 숫자 비교 전에 반드시 통과시킨다. */
const num = (v: string | number | null): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 🟢 owner 가 요구하는 모양(`{ sourceLabel }`)으로만 바꾼다 — 값은 그대로 들고 간다. */
const toRecord = (o: Obs) => ({ ...o, sourceLabel: o.source_label });

const host = (u: string): string => {
  try {
    return new URL(u).host;
  } catch {
    return "(unparsable)";
  }
};

describe("MI-ORIGIN-FX-ACCURACY-01 — 원본가격 정확도(운영 덤프 전수)", () => {
  /* ── A. 분모를 먼저 못 박는다 ───────────────────────────────────────────── */

  it("A-0 🔴🔴 분모 — 397 이 아니다 · 스냅샷 13 · 관측 58 · **고유 상품 2**", () => {
    expect(existsSync(FIX), "🔴 저장소 fixture 가 없다 — SKIP 되면 안 된다").toBe(true);
    const { observations, snapshots } = load();
    expect(observations, "🔴 관측 58행").toHaveLength(58);
    expect(snapshots, "🔴 스냅샷 13").toHaveLength(13);

    /** 🔴 전건 SELLER_ORIGIN 이어야 한다 — 다른 source 가 섞이면 분모가 다른 것이다. */
    expect(new Set(observations.map((o) => o.source))).toEqual(new Set(["SELLER_ORIGIN"]));

    /** 🔴🔴 「상품 13개」가 아니라는 사실을 숫자로 고정한다. */
    const products = new Set(
      snapshots.map((s) => `${host(s.source_url)}|${s.canonicalPrice?.value?.amount}|${s.canonicalPrice?.value?.currency}`),
    );
    expect(products.size, "🔴 고유 상품은 2개다 — 비율을 일반화하지 않는다").toBe(2);
    expect(new Set(snapshots.map((s) => host(s.source_url)))).toEqual(
      new Set(["bobochoses.co.jp", "bobochoses.com"]),
    );

    const byLabel: Record<string, number> = {};
    for (const o of observations) byLabel[String(o.source_label)] = (byLabel[String(o.source_label)] ?? 0) + 1;
    expect(byLabel).toEqual({ MARKET_PROBE: 35, ORIGIN_FX: 12, KR_MARKET: 11 });

    console.log(`\n═══ A-0 분모 ═══`);
    console.log(`    스냅샷 13 · 관측 58 · **고유 상품 2** · 호스트 2 · 브랜드 1`);
    console.log(`    source_label ${JSON.stringify(byLabel)}`);
    console.log(`    🔴 CPO 지시의 분모 397 은 운영 DB 이고 이 세션에서 도달 불가(DATABASE_URL 부재)`);
  });

  /* ── B. 선택 정확도 — 운영 owner 를 «그대로» 부른다 ────────────────────── */

  it("B-1 🟢 MARKET_PROBE 가 원가로 선택되는 일이 «없다» (전수)", () => {
    const { observations, snapshots } = load();
    let probeSelected = 0;
    for (const s of snapshots) {
      const rows = observations.filter((o) => o.snapshot_id === s.id).map(toRecord);
      const picked = selectCostBasisOriginObservations(rows);
      probeSelected += picked.filter((r) => r.sourceLabel === MARKET_PROBE_SOURCE_LABEL).length;
    }
    expect(probeSelected, "🔴 MARKET_PROBE 는 시장 관측이고 원가가 아니다").toBe(0);
    /** 🔴 술어도 같이 잠근다 — 위가 0 인 것이 «우연» 이 아니게 한다. */
    expect(isCostBasisOriginObservation({ sourceLabel: MARKET_PROBE_SOURCE_LABEL })).toBe(false);
    expect(isCostBasisOriginObservation({ sourceLabel: ORIGIN_FX_SOURCE_LABEL })).toBe(true);
    expect(isCostBasisOriginObservation({ sourceLabel: null }), "🔴 과거 행(null)은 제외하지 않는다").toBe(true);
  });

  it("B-2 🟢 ORIGIN_FX 가 있으면 KR_MARKET 이 원가에서 «빠진다» (전수)", () => {
    const { observations, snapshots } = load();
    let withOrigin = 0;
    let krLeakedWhenOriginExists = 0;
    for (const s of snapshots) {
      const rows = observations.filter((o) => o.snapshot_id === s.id).map(toRecord);
      const picked = selectCostBasisOriginObservations(rows);
      if (rows.some((r) => r.sourceLabel === ORIGIN_FX_SOURCE_LABEL)) {
        withOrigin += 1;
        krLeakedWhenOriginExists += picked.filter((r) => r.sourceLabel === KR_MARKET_SOURCE_LABEL).length;
      }
    }
    expect(withOrigin, "🔴 ORIGIN_FX 를 가진 스냅샷 12").toBe(12);
    expect(krLeakedWhenOriginExists, "🔴 한국 표시가가 원가로 남으면 안 된다").toBe(0);
  });

  /* ── C. 🔴🔴 실제 결함 — ORIGIN_FX 가 «없는» 스냅샷의 원가는 한국 표시가다 ─ */

  it("C-1 🔴🔴 ORIGIN_FX 0건인 스냅샷 1건 — 원가가 **KRW 258,000(한국 표시가)** 이 된다", () => {
    const { observations, snapshots } = load();
    const noOrigin: { snap: string; url: string; picked: string[] }[] = [];
    for (const s of snapshots) {
      const rows = observations.filter((o) => o.snapshot_id === s.id).map(toRecord);
      if (rows.some((r) => r.sourceLabel === ORIGIN_FX_SOURCE_LABEL)) continue;
      const picked = selectCostBasisOriginObservations(rows);
      noOrigin.push({
        snap: s.id,
        url: s.source_url,
        picked: picked.map((r) => `${r.sourceLabel} ${r.price_amount} ${r.currency}`),
      });
    }
    /**
     * 🔴 이것은 **owner 의 설계된 동작** 이다 — 그 함수 주석이 「ORIGIN_FX 가 한 건도
     *    없는 스냅샷은 반환값이 예전 필터 결과와 **완전히 동일**하다」고 적어 뒀다.
     * 🔴🔴 그런데 **사업적으로는 그 상품의 원가가 판매처의 한국 표시가** 다
     *    (사이트 자체 환산·스프레드 포함 · `run-price-check.ts:254-268` 이 고친 그 결함의 잔존분).
     * 🔴 **고치지 않았다** — 고치는 길이 둘뿐이고 둘 다 금지축이다:
     *    ⒜ ORIGIN_FX 행 backfill ⟹ **DB 쓰기**(접근 없음 · 승인 사항)
     *    ⒝ 읽는 쪽에서 KR_MARKET 도 배제 ⟹ **원가 정책 변경**(그 상품은 원가가 사라진다)
     */
    expect(noOrigin, "🔴 이 분모에서 1건이다").toHaveLength(1);
    expect(noOrigin[0].picked, "🔴 원가로 한국 표시가가 남는다").toEqual(["KR_MARKET 258000 KRW"]);

    console.log(`\n═══ C-1 실제 결함(잔존 데이터) ═══`);
    for (const n of noOrigin) console.log(`    ${n.snap.slice(0, 8)} ${n.url}\n      원가 → ${n.picked.join(" , ")}`);
    console.log(`    🔴 원인 분류 = **데이터 연결**(과거 행) · 🔴 추출·환산 결함이 아니다`);
  });

  /* ── D. 2-생산자 대조 — 원본가격·통화 일치율 ────────────────────────────── */

  it("D-1 🟢 ORIGIN_FX ↔ 스냅샷 추출 — 금액 12/12 · 통화 12/12 일치", () => {
    const { observations, snapshots } = load();
    let amountMatch = 0;
    let currencyMatch = 0;
    let comparable = 0;
    let noGroundTruth = 0;
    const rowsOut: string[] = [];

    for (const s of snapshots) {
      const origin = observations.filter((o) => o.snapshot_id === s.id && o.source_label === ORIGIN_FX_SOURCE_LABEL);
      if (origin.length === 0) continue;
      const gt = s.canonicalPrice?.value;
      for (const o of origin) {
        /** 🔴 정답 근거가 없으면 분모에서 빼고 «따로» 센다(CPO 지시). */
        if (!gt || typeof gt.amount !== "number" || !gt.currency) {
          noGroundTruth += 1;
          continue;
        }
        comparable += 1;
        const a = num(o.price_amount);
        if (a !== null && a === gt.amount) amountMatch += 1;
        if (o.currency === gt.currency) currencyMatch += 1;
        rowsOut.push(
          `${host(s.source_url).padEnd(18)} 관측 ${a} ${o.currency}  ↔  추출 ${gt.amount} ${gt.currency}  ` +
            `${a === gt.amount && o.currency === gt.currency ? "🟢 일치" : "🔴 불일치"}` +
            `  [market_code "${o.market_code}" / country ${o.market_country}]`,
        );
      }
    }

    expect(comparable, "🔴 정답 근거가 있는 ORIGIN_FX 행 12").toBe(12);
    expect(noGroundTruth, "🔴 정답 근거 없음은 0").toBe(0);
    expect(amountMatch, "🔴 금액 일치").toBe(12);
    expect(currencyMatch, "🔴 통화 일치").toBe(12);

    console.log(`\n═══ D-1 2-생산자 대조(분모 ${comparable}) ═══`);
    for (const r of rowsOut) console.log(`    ${r}`);
    console.log(`    금액 일치 ${amountMatch}/${comparable} · 통화 일치 ${currencyMatch}/${comparable}`);
    console.log(`    🔴 고유 상품 2개의 반복 관측이다 — 「정확도 100%」로 일반화하지 않는다`);
  });

  /* ── E. 환산 정합성 — krw = amount × rate 인가 ──────────────────────────── */

  it("E-1 🟢 환산 정합 — price_krw ≈ price_amount × exchange_rate (전수)", () => {
    const { observations } = load();
    let checked = 0;
    let ok = 0;
    const bad: string[] = [];
    for (const o of observations) {
      const a = num(o.price_amount);
      const r = num(o.exchange_rate);
      const k = num(o.price_krw);
      if (a === null || r === null || k === null) continue;
      checked += 1;
      /** 🔴 반올림 차이만 허용한다 — 1원 이내. 환율을 다시 계산하지 않는다. */
      if (Math.abs(Math.round(a * r) - k) <= 1) ok += 1;
      else bad.push(`${o.source_label} ${a} ${o.currency} × ${r} = ${Math.round(a * r)} ≠ ${k}`);
    }
    expect(checked, "🔴 환산 검사 분모").toBeGreaterThan(0);
    expect(bad, `🔴 환산 불일치: ${bad.join(" | ")}`).toEqual([]);
    console.log(`\n═══ E-1 환산 정합 ═══\n    ${ok}/${checked} 일치(반올림 1원 이내) · 불일치 0`);
  });

  it("E-2 🟢 KRW 관측은 환율을 «지어내지 않는다** — null 이고 금액 == 원화액", () => {
    /**
     * 🔴🔴 **내 1차 단언이 틀렸고 코드가 맞았다. 그 사실을 남긴다.**
     * 처음에 「KRW 는 환율 1 이어야 한다」로 단언했고 **FAIL** 했다. 조사해 보니
     * `convertToKrw`(packages/pricing/src/currency.ts:42)가 **KRW 를 환산으로
     * 취급하지 않는다** — 「KRW → KRW 는 «환산이 아니다». 1:1 이라 추정할 것이
     * 없는데 고정표 경로를 타면서 `isEstimate: true` 가 붙어 화면이 환산하지 않은
     * 값을 「추정 환율」이라고 말하고 있었다」(CPO 결정 B · 2026-10-06).
     * ⟹ 🟢 `exchange_rate = null` 은 **정답** 이다. 「1」을 박으면 환산한 척이 된다.
     * 🔴 그래서 단언을 **그 정책을 지키는 방향으로** 바꿨다 — 1 이 들어오면 FAIL 한다.
     */
    const { observations } = load();
    const krw = observations.filter((o) => o.currency === "KRW");
    expect(krw.length, "🔴 KRW 행 11").toBe(11);
    for (const o of krw) {
      expect(o.exchange_rate, `🔴 ${o.id} — KRW 에 환율을 지어냈다`).toBeNull();
      expect(num(o.price_amount), `🔴 ${o.id} 금액 != 원화액`).toBe(num(o.price_krw));
    }
    /** 🔴 비-KRW 는 반대로 환율이 «있어야» 한다 — 두 방향을 같이 잠근다. */
    const foreign = observations.filter((o) => o.currency !== "KRW");
    expect(foreign.length, "🔴 외화 행 47").toBe(47);
    expect(
      foreign.filter((o) => num(o.exchange_rate) === null).map((o) => o.id),
      "🔴 외화인데 환율이 없으면 원화액을 만들 수 없다",
    ).toEqual([]);
    console.log(`\n═══ E-2 환율 칸의 «부재» 는 결함이 아니다 ═══`);
    console.log(`    KRW ${krw.length}행 → exchange_rate **null**(정책) · 금액 == 원화액`);
    console.log(`    외화 ${foreign.length}행 → 전건 환율 보유`);
  });

  /* ── F. 호스트 통화 일관성 — 🔴 국가→통화 표를 «쓰지 않는» 축 ───────────── */

  it("F-1 🟢 같은 호스트의 ORIGIN_FX 통화가 하나다(호스트별)", () => {
    const { observations, snapshots } = load();
    const byHost = new Map<string, Set<string>>();
    for (const s of snapshots) {
      for (const o of observations.filter(
        (x) => x.snapshot_id === s.id && x.source_label === ORIGIN_FX_SOURCE_LABEL,
      )) {
        const h = host(s.source_url);
        if (!byHost.has(h)) byHost.set(h, new Set());
        byHost.get(h)!.add(o.currency);
      }
    }
    const multi = [...byHost.entries()].filter(([, v]) => v.size > 1);
    expect(multi.map(([h, v]) => `${h}: ${[...v].join("/")}`), "🔴 한 호스트가 두 원본 통화를 내면 결함 신호다").toEqual(
      [],
    );
    console.log(`\n═══ F-1 호스트별 원본 통화 ═══`);
    for (const [h, v] of byHost) console.log(`    ${h.padEnd(20)} ${[...v].join(", ")}`);
    console.log(`    🔴 국가→통화 대응표는 «만들지 않았다**(PHASE-2 A-3 금지축)`);
  });

  /* ── G. 관측 기록 — 🔴 판정하지 않는다 ──────────────────────────────────── */

  it("G-1 🟡 market_code / market_country 분포 — 관측으로만 적는다", () => {
    const { observations } = load();
    const codes: Record<string, number> = {};
    const countries: Record<string, number> = {};
    for (const o of observations) {
      codes[o.market_code === "" ? '""' : String(o.market_code)] = (codes[o.market_code === "" ? '""' : String(o.market_code)] ?? 0) + 1;
      countries[String(o.market_country)] = (countries[String(o.market_country)] ?? 0) + 1;
    }
    /**
     * 🔴 `market_country` 가 ORIGIN_FX 행에서 bobochoses.com → **ES**, .co.jp → **JP** 다.
     *    🟡 그것이 「사이트가 선언한 base market」이라는 것이 생산자의 주장이고,
     *    🔴 **그 선언이 옳은지는 이 분모로 판정할 수 없다**(사이트 `/meta.json` 재조회가 필요).
     * 🔴 그래서 여기서는 **분포만** 적고 정확도로 세지 않는다.
     */
    expect(Object.keys(countries).sort()).toEqual(["ES", "JP"]);
    console.log(`\n═══ G-1 시장 칸 분포(관측 전용) ═══`);
    console.log(`    market_code    ${JSON.stringify(codes)}`);
    console.log(`    market_country ${JSON.stringify(countries)}`);
    console.log(`    🔴 base market 선언의 «정답 여부» 는 이 분모로 측정 불가(재조회 필요 · 미측정)`);
  });
});
