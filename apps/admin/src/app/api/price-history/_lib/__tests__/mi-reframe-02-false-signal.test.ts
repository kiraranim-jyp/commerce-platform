/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Reframing WU — STEP 5 (False Signal) + §5-B CONTROL
 * 「운영이 실제로 낸 ORIGIN_TREND 알림 3건」을 재현하고 그 실체를 가른다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP(`MI_P0_02_LIVE=1`). Production 변경 0 · HTTP 0 · DB 는 SELECT 만.
 *
 * ── 🔴 왜 이 파일이 따로 있는가 ──────────────────────────────────────────
 *   운영 `price_alerts` 에 `ORIGIN_TREND` 3건이 **실제로 있다**:
 *     「해외 원가가 39.11% 하락했습니다」· 「36.27% 하락」· 「3.76% 상승」
 *   그런데 현재 데이터로 owner 를 다시 돌리면 **셋 다 변화율 0** 이다.
 *   🔴 이것을 「불일치」로 적으면 틀린다 — 그 뒤에 관측이 더 쌓여서
 *      `computePriceChange` 의 [latest, previous] 가 다른 두 행이 됐기 때문이다.
 *   🟢 그래서 **알림 시점의 두 행** 으로 재현한다. 그러면 세 값이 정확히 나온다.
 *
 * ── 🔴🔴 그 알림의 «실체» (이 하니스가 증명하는 것) ──────────────────────
 *   Lucy Cut Out Sandals
 *     2026-08-26  label=null  GBP 210 → KRW 396,226   ← 원본 시장가
 *     2026-08-27  KR_MARKET   KRW 252,500            ← 판매처의 «한국 표시가»
 *     (252,500 − 396,226) / 396,226 = **−36.27%**  = 운영 알림과 같다
 *   🔴 즉 「해외 원가 36% 하락」은 가격 하락이 **아니다.** 축이 다른 두 값을
 *      시계열로 읽은 것이다. 세 건 전부 **같은 날 RESOLVED** 됐다(거짓 신호의 모양).
 *
 * ── 🟢 현재 설계는 이것을 막는다 (음성 대조로 확인) ──────────────────────
 *   `selectCostBasisOriginObservations`(price-observations.ts:303) 주석 :290 이
 *   이미 「…을 가격 변동으로 읽어 **없던 급락 알림까지 만든다**」고 적어 뒀다.
 *   🟢 ORIGIN_FX«와» KR_MARKET 이 함께 있던 스냅샷 **136/136 전부** 에서
 *      KR_MARKET 이 제거된다.
 *   🔴 단 주석 :299 가 명시한 대로 **ORIGIN_FX 가 한 건도 없는 과거 스냅샷**은
 *      예전과 동일하게 혼재가 남는다 — 그것이 아래 `riskPopulation` 이다.
 *      🔴 §13 대로 **고치지 않고** `Observed Production Defect` 로 기록한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { computePriceChange, type PriceObservationRecord } from "@commerce/pricing";
import { selectCostBasisOriginObservations } from "../price-observations";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface Row {
  snapshot_id: string; title: string; source: string; source_label: string | null;
  currency: string; price_amount: string | number | null; price_krw: string | number | null;
  sold_out: boolean | null; checked_at: string;
}
const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/** 🔴 운영이 그 알림을 냈을 때의 값. 사후에 지어낸 것이 아니라 DB `price_alerts.detail`
 *     원문에서 읽었다 — 재현 대상이므로 상수로 박는다(§5-B expectedValue). */
const PRODUCTION_ORIGIN_TREND_ALERTS = [
  { titleContains: "Voyage Dress", expectedRatePercent: -39.11 },
  { titleContains: "Lucy Cut Out", expectedRatePercent: -36.27 },
  { titleContains: "Ginevra", expectedRatePercent: 3.76 },
] as const;

describe.skipIf(!LIVE)("🔴 MI-REFRAME-02 — 운영 알림의 실체와 잔존 위험", () => {
  it(
    "ORIGIN_TREND 3건을 알림 시점 행으로 재현하고 혼재 위험 모집단을 센다",
    async () => {
      const p = path.join(OUT_DIR, "reframe-obs.json");
      if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
      const rows = (JSON.parse(readFileSync(p, "utf8")) as Row[]).filter((r) => r.source === "SELLER_ORIGIN");

      const bySnap = new Map<string, Row[]>();
      for (const r of rows) (bySnap.get(r.snapshot_id) ?? bySnap.set(r.snapshot_id, []).get(r.snapshot_id)!).push(r);
      /** 🔴 선택 결과를 `checked_at` 으로 원본 Row 에 되돌리면 «틀린다» — 같은
       *     `(snapshot, source, checked_at)` 에 행이 2개 이상인 그룹이 207개
       *     (최대 8행) 있어서 다른 행을 집는다. 실제로 그렇게 짰다가 음성 대조가
       *     131/136 으로 깨졌다(제품이 아니라 **하니스** 결함이었다).
       *     🟢 `selectCostBasisOriginObservations` 는 제네릭 `<T extends
       *     {sourceLabel}>` 이므로 **Row 자체를 들고 다니면** 매핑이 필요 없다. */
      const asRecord = (r: Row) => ({
        ...r,
        source: "SELLER_ORIGIN", sourceLabel: r.source_label, priceKrw: num(r.price_krw),
        salePriceKrw: null, originalPriceKrw: null, soldOut: r.sold_out, checkedAt: r.checked_at,
      } as unknown as PriceObservationRecord & { sourceLabel: string | null } & Row);

      /* ══ §5-B CONTROL — 알림 시점 두 행으로 재현 ══ */
      const control = PRODUCTION_ORIGIN_TREND_ALERTS.map((a) => {
        const entry = [...bySnap.entries()].find(([, rs]) => (rs[0]?.title ?? "").includes(a.titleContains));
        // 🔴 not-found 분기에 `CONTROL_PASS` 를 빼면 union 에서 그 칸이 사라져 아래
        //    `expect(c.CONTROL_PASS)` 가 TS2339 로 죽는다(메모 explicit-return-types).
        //    🔴 그리고 못 찾은 것을 «통과» 로 적으면 CONTROL 이 무력화된다 → false 다.
        if (!entry) return { ...a, found: false, status: "🔴 스냅샷을 못 찾음", CONTROL_PASS: false };
        const [sid, rs] = entry;
        const cost = selectCostBasisOriginObservations(rs.map(asRecord));
        /** 🔴 현재 데이터 전체로 돌린 값 — 그 뒤 관측이 쌓여 달라진다 */
        const nowChange = computePriceChange(cost);
        /** 🟢 알림 시점 재현 — 외화 행(원본 시장가) 중 최신 «과» 그 뒤 첫 KRW 행 */
        const sorted = [...cost].sort((x, y) => (x.checkedAt < y.checkedAt ? -1 : 1));
        const fxRow = [...sorted].reverse().find((r) => r.currency !== "KRW");
        const krRow = fxRow ? sorted.find((r) => r.currency === "KRW" && r.checkedAt > fxRow.checkedAt) : undefined;
        const replicated = fxRow?.priceKrw != null && krRow?.priceKrw != null
          ? Number((((krRow.priceKrw - fxRow.priceKrw) / fxRow.priceKrw) * 100).toFixed(2)) : null;

        return {
          ...a, found: true, snapshotId: sid, costRows: cost.length,
          "🔴 현재 데이터 기준 변화율": nowChange?.changeRatePercent ?? null,
          "🟢 알림 시점 재현 변화율": replicated,
          /** 🔴 §5-B 통과 조건 — 「돌았다」가 아니라 «같은 값» 이다 */
          CONTROL_PASS: replicated !== null && Math.abs(replicated - a.expectedRatePercent) <= 0.02,
          축: {
            원본시장가: fxRow ? `${fxRow.currency} ${fxRow.price_amount} → KRW ${fxRow.priceKrw}` : null,
            한국표시가: krRow ? `${krRow.currency} ${krRow.priceKrw}` : null,
            "🔴 두 축이 다른가": !!(fxRow && krRow && fxRow.currency !== krRow.currency),
          },
        };
      });

      /* ══ STEP 5 — 잔존 위험 모집단 + 음성 대조 ══ */
      let mixedCurrency = 0, singleCurrency = 0, tooFewRows = 0;
      const mixed: unknown[] = [];
      let hadBoth = 0, krMarketDropped = 0;
      for (const [sid, rs] of bySnap) {
        const costRaw = selectCostBasisOriginObservations(rs.map(asRecord));
        const cost = costRaw;
        const currencies = [...new Set(costRaw.map((r) => r.currency))];
        if (cost.length < 2) tooFewRows++;
        else if (currencies.length > 1) {
          mixedCurrency++;
          mixed.push({
            snapshotId: sid, title: rs[0]?.title?.slice(0, 40) ?? null, currencies,
            labels: [...new Set(costRaw.map((r) => r.source_label ?? "(null)"))],
            rows: cost.length,
            "🔴 ORIGIN_FX 라벨이 없다(과거 스냅샷)": !costRaw.some((r) => r.source_label === "ORIGIN_FX"),
          });
        } else singleCurrency++;
        /** 🟢 음성 대조 — 둘 다 있던 스냅샷에서 KR_MARKET 이 실제로 빠지는가 */
        const noProbe = rs.filter((r) => r.source_label !== "MARKET_PROBE");
        if (noProbe.some((r) => r.source_label === "ORIGIN_FX") && noProbe.some((r) => r.source_label === "KR_MARKET")) {
          hadBoth++;
          if (!costRaw.some((r) => r.source_label === "KR_MARKET")) krMarketDropped++;
        }
      }

      const report = {
        "🟢 DISCLAIMER": "FULL POPULATION. 운영 owner 로 계산했다. Production 변경 0 · DB 는 SELECT 만. " +
          "🔴 발견한 잔존 위험을 이번 WU 에서 «고치지 않았다»(§13).",
        scope: { snapshots: bySnap.size, originRows: rows.length },
        "§5-B CONTROL — 운영 ORIGIN_TREND 알림 재현": control,
        "🔴 STEP 5 잔존 위험 모집단": {
          "원가 집합에 통화가 둘 이상 섞인 스냅샷": mixedCurrency,
          "단일 통화(안전)": singleCurrency,
          "관측 1건뿐(변화 계산 불가 — 🔴 측정불가, 0% 가 아니다)": tooFewRows,
          detail: mixed,
        },
        "🟢 음성 대조 — 설계가 실제로 막는가": {
          "ORIGIN_FX«와» KR_MARKET 이 함께 있던 스냅샷": hadBoth,
          "그중 KR_MARKET 이 제거된 수": krMarketDropped,
          PASS: hadBoth > 0 && hadBoth === krMarketDropped,
        },
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "reframe-false-signal.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2));

      /** 🔴 CONTROL 이 통과해야 아래 숫자를 전략 판단에 쓸 수 있다(§5-B). */
      for (const c of control) expect(c.CONTROL_PASS, `CONTROL 실패: ${c.titleContains}`).toBe(true);
      /** 🟢 음성 대조 — 가드를 믿지 말고 실제로 빠지는지 본다. */
      expect(krMarketDropped).toBe(hadBoth);
    },
    60 * 60 * 1000,
  );
});
