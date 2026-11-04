import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeCandidateOverseasPrices } from "../candidate-market";
import { buildOverseasReference } from "../../../../pipeline/commerce/overseas-reference";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 FINAL MARKET COMPARISON — **CPO 데이터 검토표**(운영 산출물 기준)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드 변경 **0** · 네트워크 **0** · 과금 **0** · DB 쓰기 **0**.
 *
 * 🔴🔴 **왜 운영 산출물을 읽는가(측정 한계를 먼저 적는다)** —
 *    로컬에서는 운영 discovery 를 **재현할 수 없다**:
 * ```
 * comparison-shop.ts:141   getSupabaseAdmin() 없으면 `return []`  ⟹ 해외 등록부 **0**
 * [SP07-websearch]         skipped "NOT_CONFIGURED"               ⟹ AI Search **0**
 * ```
 *    🔴 그래서 `core-e2e-close-06` 라이브는 **스스로 측정을 거부한다**(열화 게이트).
 *    🟢 대신 **운영이 이미 낸 후보/가격/판정** 을 읽고, **화면이 쓰는 그 함수** 로
 *       노출 문자열을 만든다 — 그것이 셀러가 보는 값이다.
 *
 * 🟢 집계는 **운영 owner 를 직접 부른다**(복제 금지) —
 *    `summarizeCandidateOverseasPrices` · `buildOverseasReference`.
 */

const DUMP = path.join(process.env.TEMP ?? ".", "mi-p0-02", "final-market-review.json");
const READY = existsSync(DUMP);
const pad = (s: unknown, n: number) =>
  String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));

interface Row {
  candidate_domain: string | null;
  candidate_title: string | null;
  candidate_url: string | null;
  market: string | null;
  system_verdict: string | null;
  match_truth: string | null;
  price_tier: string | null;
  price_amount: number | null;
  price_currency: string | null;
  price_status: string | null;
  sold_out: boolean | null;
  human_verdict: string | null;
  blockers: unknown;
  source: string | null;
}

describe("FINAL MARKET COMPARISON — CPO 데이터 검토표", () => {
  (READY ? it : it.skip)("운영 후보 전수 → 시장별 노출 데이터 · 정확성 점검", () => {
    /* eslint-disable no-console */
    const dump = JSON.parse(readFileSync(DUMP, "utf8")) as { target: string; rows: Row[] };
    const rows = dump.rows;
    expect(rows.length, "🔴 덤프가 비었다 — 측정불가").toBeGreaterThan(0);

    console.log(`\n═══ 원상품 ${dump.target} · 운영 후보 ${rows.length}건 ═══`);

    /* ── ① 시장 분류 ────────────────────────────────────────────────── */
    const byMarket = new Map<string, number>();
    for (const r of rows) byMarket.set(String(r.market ?? "(null)"), (byMarket.get(String(r.market ?? "(null)")) ?? 0) + 1);
    console.log("\n① 시장 분류 " + JSON.stringify(Object.fromEntries(byMarket)));

    /** 🔴 `.kr` 인데 OVERSEAS · 비-kr 인데 KR 인 모순을 센다(WU-020 계약 축). */
    const isKrDomain = (d: string | null) => Boolean(d && /\.kr$|\.co\.kr$/.test(d));
    const marketConflict = rows.filter(
      (r) => (isKrDomain(r.candidate_domain) && r.market === "OVERSEAS") || (!isKrDomain(r.candidate_domain) && r.market === "KR"),
    );
    console.log(`   🔴 도메인 ↔ 시장 모순 ${marketConflict.length}건`);
    for (const r of marketConflict.slice(0, 6)) {
      console.log(`      ${pad(r.candidate_domain, 28)} market=${r.market}`);
    }

    /* ── ② 중복 ────────────────────────────────────────────────────── */
    const byUrl = new Map<string, Row[]>();
    for (const r of rows) {
      const k = String(r.candidate_url ?? "");
      if (k) byUrl.set(k, [...(byUrl.get(k) ?? []), r]);
    }
    const dupUrl = [...byUrl.entries()].filter(([, v]) => v.length > 1);
    console.log(`\n② 고유 URL ${byUrl.size} · 🔴 중복 URL ${dupUrl.length}건`);
    for (const [u, v] of dupUrl.slice(0, 5)) console.log(`      ×${v.length} ${u.slice(0, 80)}`);

    /* ── ③ 가격 없는 후보에 금액이 붙는가 ───────────────────────────── */
    const noPrice = rows.filter((r) => r.price_amount == null);
    const noPriceButAmount = noPrice.filter((r) => r.price_currency != null && r.price_amount != null);
    console.log(`\n③ 가격 없는 후보 ${noPrice.length}/${rows.length} · 🔴 금액이 잘못 붙은 건 ${noPriceButAmount.length}`);

    /* ── ④ 등급 ↔ 판정 일치 ────────────────────────────────────────── */
    const TIER_BY_TRUTH: Record<string, string> = {
      EXACT_IDENTIFIER: "EXACT",
      STRONG_IDENTIFIER: "EXACT",
      TEXT_CONFIRMED: "COMPARISON",
      SIMILAR: "REFERENCE",
      CONFLICT: "EXCLUDED",
      INSUFFICIENT_EVIDENCE: "EXCLUDED",
    };
    const tierMismatch = rows.filter(
      (r) => r.match_truth && r.price_tier && TIER_BY_TRUTH[r.match_truth] && TIER_BY_TRUTH[r.match_truth] !== r.price_tier,
    );
    console.log(`\n④ matchTruth → priceTier 불일치 ${tierMismatch.length}건`);
    for (const r of tierMismatch.slice(0, 6)) {
      console.log(`      ${pad(r.candidate_domain, 26)} truth=${pad(r.match_truth, 22)} tier=${r.price_tier} (기대 ${TIER_BY_TRUTH[r.match_truth!]})`);
    }

    /* ── ⑤ 🔴 가격 신뢰도 ↔ 집계 포함(WU-111 모순 실측) ─────────────── */
    /**
     * 🔴🔴 **1차 측정이 `null` 을 빼먹었다.** `price_status && !== "VERIFIED_CURRENT"` 로 세서
     *    **`null`(= 「모른다」)을 미검증에 넣지 않았다** ⟹ 「미검증 0」이라는 거짓 숫자가 났다.
     * 🔴 `null` 은 「검증했다」가 아니다. 이 저장소가 반복해서 막아 온 그 치환이다
     *    (「거부 / null / 0 을 «올바른 부재» 로 가정했는가」 — 헌장 §5 보고 전 3문).
     * 🟢 그래서 **셋으로 갈라 센다** — 검증됨 / 미검증 / **모름(null)**.
     */
    const priced = rows.filter((r) => r.price_amount != null);
    const verified = priced.filter((r) => r.price_status === "VERIFIED_CURRENT");
    const unverified = priced.filter((r) => r.price_status != null && r.price_status !== "VERIFIED_CURRENT");
    const unknownStatus = priced.filter((r) => r.price_status == null);
    const inAggregate = priced.filter((r) => r.price_tier !== "EXCLUDED");
    const notVerifiedInAggregate = inAggregate.filter((r) => r.price_status !== "VERIFIED_CURRENT");
    console.log(
      `\n⑤ 가격 보유 ${priced.length} — 검증됨 ${verified.length} · 미검증 ${unverified.length} · 🔴 신뢰도 **모름(null)** ${unknownStatus.length}` +
        `\n   집계 진입(tier≠EXCLUDED) ${inAggregate.length} · 🔴 그중 **VERIFIED_CURRENT 가 아닌 건 ${notVerifiedInAggregate.length}**` +
        `\n   🔴 집계는 priceStatus 를 보지 않고 UI 숫자 표시는 VERIFIED_CURRENT 만 본다(WU-111) ⟹` +
        `\n      이 숫자가 0 이 아니면 「최저가는 뜨는데 그 근거 줄은 「가격 확인 필요」」가 가능하다 · 🔴 가격 정책 LOCK`,
    );
    for (const r of notVerifiedInAggregate) {
      console.log(`      ${pad(r.candidate_domain, 24)} ${pad(r.price_currency, 4)} ${pad(r.price_amount, 10)} status=${r.price_status ?? "null(모름)"}`);
    }

    /* ── ⑥ 품절 ────────────────────────────────────────────────────── */
    const soldOut = rows.filter((r) => r.sold_out === true);
    const soldOutPricedInAgg = soldOut.filter((r) => r.price_amount != null && r.price_tier !== "EXCLUDED");
    console.log(`\n⑥ 품절 확인 ${soldOut.length} · 🔴 그중 집계에 가격이 남은 건 ${soldOutPricedInAgg.length}`);

    /* ── ⑦ 운영 집계기를 «직접» 불러 화면 문자열을 만든다 ──────────── */
    /**
     * 🔵🔵 STAGE 7-1 — **`withStatus` 가 「후」 다.** 반사실을 같은 입력에서 두 번 돌려
     *    CPO 완료 기준 ①③(「UNVERIFIED 가 VERIFIED 집계에 섞이지 않는지」)을 **숫자로** 낸다.
     * 🔴 운영 레코드가 실제로 넘기는 칸 그대로다(`market-intelligence.ts` 의 두 push).
     */
    const toRecords = (rs: Row[], withStatus: boolean) =>
      rs
        .filter((r) => r.price_amount != null && r.price_currency)
        .map((r) => ({
          market: String(r.market ?? "UNKNOWN"),
          currency: String(r.price_currency),
          amount: Number(r.price_amount),
          priceTier: String(r.price_tier ?? "COMPARISON"),
          sellerKey: r.candidate_domain ?? undefined,
          ...(withStatus ? { priceStatus: r.price_status ?? null } : {}),
        }));

    for (const [label, rs] of [
      ["🇰🇷 국내", rows.filter((r) => r.market === "KR")],
      ["🌎 해외", rows.filter((r) => r.market !== "KR")],
    ] as const) {
      /* 🔵 STAGE 7-1 「전 → 후」 — 같은 입력 · 같은 운영 함수 · 바뀐 것은 칸 하나다. */
      const before = summarizeCandidateOverseasPrices(toRecords(rs, false) as never);
      const after = summarizeCandidateOverseasPrices(toRecords(rs, true) as never);
      const vBefore = buildOverseasReference(before as never, { showTierNote: true });
      const vAfter = buildOverseasReference(after as never, { showTierNote: true });
      console.log(`\n🔵 STAGE 7-1 ${label} — 전 → 후`);
      console.log(
        `   전: ${vBefore ? vBefore.lines.map((l) => `${l.lowest}(${l.scope})`).join(" · ") : "(렌더 안 됨)"}`,
      );
      console.log(
        `   후: ${vAfter ? vAfter.lines.map((l) => `${l.lowest}(${l.scope})`).join(" · ") : "(렌더 안 됨)"}` +
          `   미확인=${after.unverifiedCount}`,
      );
      console.log(`   후 미확인 줄: ${vAfter?.unverifiedPriceNote ?? "(없음)"}`);
      /** 🔴 관측은 지우지 않는다 — 등급 분포와 후보 수가 **전후 동일** 해야 한다(WU-062 선례). */
      expect(after.count, "🔴 후보 수가 줄었다 — 후보를 숨긴 것이다").toBe(before.count);
      expect(after.byPriceTier, "🔴 등급 관측이 바뀌었다").toEqual(before.byPriceTier);

      const summary = before;
      const view = buildOverseasReference(summary as never, { showTierNote: true });
      console.log(`\n⑦ ${label} — 집계 ${JSON.stringify({ count: summary.count, byPriceTier: summary.byPriceTier })}`);
      if (!view) {
        console.log("   화면: (렌더되지 않는다 — 가격 있는 후보 0)");
        continue;
      }
      console.log(`   화면 등급분포: ${view.tierNote ?? "(꺼짐)"}`);
      /**
       * 🔴 칸 이름은 `OverseasReferenceLine` 에서 **읽어서** 쓴다 — `lowest` · `scope` 다.
       *    1차에 `amount`/`sellerCount` 로 추측해 전건 `undefined` 를 찍었다(이 저장소가
       *    반복해서 적어 둔 그 함정). 그대로 보고했으면 「금액이 안 뜬다」는 **거짓 결함** 이었다.
       */
      for (const l of view.lines) console.log(`   화면 금액: ${l.lowest}  ·  ${l.scope}`);
      /** 🔴 이 영역은 **환산하지 않는다** — 통화별로만 적는다(계약 `wu-056r1`). */
      const joined = [view.tierNote ?? "", ...view.lines.map((l) => `${l.lowest} ${l.scope}`)].join(" ");
      expect(joined, "🔴 이 영역에 원화 환산이 들어왔다 — 계약 위반이다").not.toMatch(/₩|원화|약 /);
    }

    /* ── ⑧ CPO 검토표 전수 ─────────────────────────────────────────── */
    console.log(`\n═══ ⑧ CPO 검토표 — 후보 전수 ${rows.length}건 ═══`);
    console.log(
      `${pad("시장", 9)} ${pad("판매처", 26)} ${pad("verdict", 15)} ${pad("tier", 11)} ${pad("가격", 14)} ${pad("신뢰도", 18)} ${pad("사람", 10)} 상품명`,
    );
    for (const r of rows) {
      const price = r.price_amount == null ? "-" : `${r.price_currency ?? "?"} ${Number(r.price_amount).toLocaleString("ko-KR")}`;
      console.log(
        `${pad(r.market, 9)} ${pad(r.candidate_domain, 26)} ${pad(r.system_verdict, 15)} ${pad(r.price_tier, 11)} ` +
          `${pad(price, 14)} ${pad(r.price_status, 18)} ${pad(r.human_verdict, 10)} ${String(r.candidate_title ?? "-").slice(0, 46)}`,
      );
    }

    /** 🟢 분모 성립만 단언한다 — 숫자를 계약으로 박지 않는다(측정이다). */
    expect(byUrl.size, "🔴 URL 이 하나도 없다").toBeGreaterThan(0);
  });
});
