/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Re-observation Cadence & Economics WU
 * 「1일 / 2일 / 3일 / 7일 중 사업적으로 최적인 관측 주기는 무엇인가」
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP(`MI_P0_02_LIVE=1`). **Production 0 · HTTP 0 · cron 미구현.**
 * 🔴 현재 위치는 `GO CANDIDATE` 이고 「Cron 개발 GO」가 아니다(CPO 확정).
 *
 * ── 🔴🔴 측정 가능성을 먼저 가른다 (이것을 안 가리면 숫자가 외삽이 된다) ──
 *   🟢 잴 수 «있는» 것 — **다운샘플링**. 실제 관측 시계열을 K일 간격으로만
 *      봤다고 가정해 **무엇을 놓치는가** 를 센다. 데이터 안에서만 움직인다.
 *   🔴 잴 수 «없는» 것 — 「지금보다 더 촘촘히 봤다면 무엇을 더 찾았을까」.
 *      그건 데이터에 없는 관측을 가정하는 **상향 외삽** 이다 → **측정불가**.
 *      ❗ 그래서 「1일 주기의 추가 정보량」은 이 WU 가 답할 수 없다.
 *      답할 수 있는 것은 **「1일 → 2/3/7일로 늦추면 무엇을 잃는가」** 다.
 *
 * ── 🟢 분모 (실측 · 운영 멱등과 같은 규칙으로 «날짜 대표» 1건으로 접었다) ──
 *   연속 관측 쌍 **271쌍**
 *     간격 1일 **224쌍**(82.7%) · 2일 16 · 3일 12 · 6일 14 · 7일 1 · 9일 1 · 12일 3
 *   🟢 간격 1일 쌍이 224개나 되어 다운샘플링 분모가 충분하다.
 *
 * ── 🔴 해석 함정 (실제로 빠질 뻔했다) ──────────────────────────────────
 *   「간격 1일 쌍의 42.4%에서 가격이 변했다」를 「매일 보면 42% 더 안다」로
 *   읽으면 **틀린다.** 가격이 변했으면 2일 뒤에 봐도 여전히 다르다 —
 *   늦게 봐도 **같은 변화를 놓치지 않는다.**
 *   🟢 주기가 실제로 결정하는 것은 둘이다:
 *     ① **지연** — 변화를 며칠 늦게 아는가
 *     ② **일시적 변화(transient)** — 올랐다 되돌아간 것을 아예 못 보는가
 *   이 하니스는 그 둘을 센다. ②가 cadence 의 «유일한 비가역 손실» 이다.
 *
 * ── STEP 0 §5-B (이전 WU 에서 확정 · 재조사 안 함) ──────────────────────
 *   `computePriceChange` :662 · `hasObservationToday` :242(**하루 1회 상한**) ·
 *   `bulkRecheck` today/page.tsx:156(동시성 3) · `crons` 없음 ·
 *   `selectCostBasisOriginObservations` :303(ORIGIN_FX 있으면 KR_MARKET 제거)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PriceObservationRecord } from "@commerce/pricing";
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
const dayOf = (iso: string) => iso.slice(0, 10);
const dayNum = (ymd: string) => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400000);

/** 🔴 CPO 가 지정한 네 주기. 숫자를 늘리거나 바꾸지 않는다. */
const CADENCES = [1, 2, 3, 7] as const;

describe.skipIf(!LIVE)("🔴 MI-CADENCE-01 — 관측 주기별 경제성", () => {
  it(
    "다운샘플링으로 주기별 손실(지연 · 일시적 변화)과 비용을 센다",
    async () => {
      const p = path.join(OUT_DIR, "reframe-obs.json");
      if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
      const rows = (JSON.parse(readFileSync(p, "utf8")) as Row[]).filter((r) => r.source === "SELLER_ORIGIN");

      const bySnap = new Map<string, Row[]>();
      for (const r of rows) (bySnap.get(r.snapshot_id) ?? bySnap.set(r.snapshot_id, []).get(r.snapshot_id)!).push(r);

      /** 🟢 Row 자체를 들고 다닌다(`checked_at` 되돌리기 금지 — 같은 순간 행 207그룹). */
      const asRecord = (r: Row) => ({
        ...r, source: "SELLER_ORIGIN", sourceLabel: r.source_label, priceKrw: num(r.price_krw),
        salePriceKrw: null, originalPriceKrw: null, soldOut: r.sold_out, checkedAt: r.checked_at,
      } as unknown as PriceObservationRecord & { sourceLabel: string | null } & Row);

      /** 상품별 «날짜 대표» 시계열 — 운영 멱등(하루 1회)과 같은 해상도로 접는다. */
      const series = [...bySnap.entries()].map(([sid, all]) => {
        const cost = selectCostBasisOriginObservations(all.map(asRecord)).filter((r) => r.priceKrw != null);
        const byDay = new Map<string, (typeof cost)[number]>();
        for (const r of [...cost].sort((a, b) => (a.checkedAt < b.checkedAt ? -1 : 1))) byDay.set(dayOf(r.checkedAt), r);
        const days = [...byDay.keys()].sort();
        return { sid, title: all[0]?.title?.slice(0, 40) ?? null, days, byDay };
      }).filter((s) => s.days.length >= 2);

      /** 🔴 편중 확인 — 소수 상품이 쌍의 대부분을 만들면 일반화가 깨진다 */
      const pairCounts = series.map((s) => ({ title: s.title, pairs: s.days.length - 1, days: s.days.length }))
        .sort((a, b) => b.pairs - a.pairs);
      const totalPairs = pairCounts.reduce((x, y) => x + y.pairs, 0);
      const top5 = pairCounts.slice(0, 5).reduce((x, y) => x + y.pairs, 0);

      /** 한 시계열을 K일 간격으로 «솎는다» — 첫날부터 K일 이상 지난 날만 채택 */
      const downsample = (days: string[], k: number) => {
        const out = [days[0]];
        let last = dayNum(days[0]);
        for (const d of days.slice(1)) {
          const n = dayNum(d);
          if (n - last >= k) { out.push(d); last = n; }
        }
        return out;
      };

      const perCadence = CADENCES.map((k) => {
        let observations = 0, distinctStates = 0, detectedChanges = 0;
        let transientLost = 0, delaySum = 0, delayN = 0, productsWithChange = 0;
        const lostDetail: unknown[] = [];

        for (const s of series) {
          const kept = downsample(s.days, k);
          observations += kept.length;
          const priceOn = (d: string) => Number(s.byDay.get(d)!.priceKrw);
          const curOn = (d: string) => s.byDay.get(d)!.currency;

          /** 🔴 같은 축(통화)만 비교한다 — 혼재 시계열은 거짓 변화를 만든다 */
          const states: number[] = [];
          for (const d of kept) states.push(priceOn(d));
          distinctStates += new Set(states).size;

          let changedHere = false;
          for (let i = 1; i < kept.length; i++) {
            if (curOn(kept[i]) !== curOn(kept[i - 1])) continue;
            if (priceOn(kept[i]) !== priceOn(kept[i - 1])) { detectedChanges++; changedHere = true; }
          }
          if (changedHere) productsWithChange++;

          /** ① 지연 — 전체(K=1) 시계열에서 변화가 처음 보인 날 vs 솎은 뒤 처음 보인 날 */
          const fullChangeDay = (() => {
            for (let i = 1; i < s.days.length; i++) {
              if (curOn(s.days[i]) !== curOn(s.days[i - 1])) continue;
              if (priceOn(s.days[i]) !== priceOn(s.days[i - 1])) return s.days[i];
            }
            return null;
          })();
          const keptChangeDay = (() => {
            for (let i = 1; i < kept.length; i++) {
              if (curOn(kept[i]) !== curOn(kept[i - 1])) continue;
              if (priceOn(kept[i]) !== priceOn(kept[i - 1])) return kept[i];
            }
            return null;
          })();
          if (fullChangeDay && keptChangeDay) {
            delaySum += dayNum(keptChangeDay) - dayNum(fullChangeDay); delayN++;
          }

          /** ② 🔴 일시적 변화 손실 — 전 시계열에 있던 «구별되는 가격» 이
           *     솎은 뒤 사라지면, 그 가격 상태는 **영구히 못 본다**(비가역 손실). */
          const fullStates = new Set(s.days.map(priceOn));
          const keptStates = new Set(states);
          const missed = [...fullStates].filter((v) => !keptStates.has(v));
          if (missed.length > 0) {
            transientLost += missed.length;
            if (lostDetail.length < 6) lostDetail.push({ title: s.title, k, missedPrices: missed, fullDays: s.days.length, keptDays: kept.length });
          }
        }
        return {
          cadenceDays: k,
          /** 비용 축 — 실제 솎은 뒤의 관측 횟수 */
          observations,
          "관측 횟수 (K=1 대비)": null as string | null,
          detectedChanges, productsWithChange,
          "🔴 평균 지연(일)": delayN > 0 ? Number((delaySum / delayN).toFixed(2)) : null,
          "🔴 지연 측정 분모": delayN,
          "🔴 일시적 가격상태 손실(비가역)": transientLost,
          distinctStates,
          lostDetail,
        };
      });
      const base = perCadence[0].observations;
      for (const c of perCadence) c["관측 횟수 (K=1 대비)"] = `${((c.observations / base) * 100).toFixed(1)}%`;

      /** STEP 7 — 전수 497 상품에 적용한 월 실행 수 */
      const SNAPSHOT_TOTAL = 497;
      const cost = CADENCES.map((k) => ({
        cadenceDays: k,
        "일 실행수": Number((SNAPSHOT_TOTAL / k).toFixed(0)),
        "월 실행수(30일)": Number(((SNAPSHOT_TOTAL / k) * 30).toFixed(0)),
        "🔴 외부 요청(상품당 최소 3)": Number(((SNAPSHOT_TOTAL / k) * 30 * 3).toFixed(0)),
      }));

      const report = {
        "🟢 DISCLAIMER": "FULL POPULATION 의 다운샘플링이다. 새 HTTP 0 · Production 0 · cron 미구현. " +
          "🔴 「더 촘촘히 봤다면」은 상향 외삽이라 측정하지 않았다 — 이 WU 는 «늦추면 무엇을 잃는가» 를 잰다.",
        scope: {
          "🔴 FULL POPULATION": `SELLER_ORIGIN 관측 ${rows.length}행 / 스냅샷 ${bySnap.size}개`,
          "🔴 분모(관측 2일+ 상품)": series.length,
          "🔴 연속 관측 쌍": totalPairs,
          "🔴 편중 — 상위 5개 상품이 만든 쌍": `${top5}/${totalPairs} (${((top5 / totalPairs) * 100).toFixed(1)}%)`,
          topProducts: pairCounts.slice(0, 5),
          "🔴 해상도 상한": "「일」 — hasObservationToday 가 하루 1회로 묶는다. 1일보다 짧은 주기는 무의미",
        },
        "🔴 간격별 변화율 (참고 — 주기 선택 근거로 «단독 사용 금지»)": {
          note: "간격이 길수록 변화율이 오르는 것은 당연하다(더 기다리면 변할 확률이 높다). " +
            "이 숫자는 「늦게 봐도 같은 변화를 놓치지 않는다」는 사실을 가리지 못한다.",
          실측: "1일 224쌍/42.4% · 2일 16/81.2% · 3일 12/100% · 6일 14/57.1% · 7일 1/100% · 12일 3/66.7%",
        },
        cadence: perCadence,
        cost,
        "🔴 측정불가로 남긴 것": {
          "1일 주기의 «추가» 정보량": "데이터에 없는 관측을 가정해야 한다 → 상향 외삽 · 측정불가",
          latency: "일괄 확인의 실제 latency 는 기록이 없다 → 측정불가(요청 수만 산출)",
          "금액 비용": "외부 API 요금 체계를 CTO 가 읽을 수 없다 → 측정불가",
          Availability: "국내 sold_out=true 가 0행 → 품절/재입고 축은 cadence 로도 측정불가",
        },
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "cadence-economics.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2));

      /** 🔴 정합성 — 주기가 길어지면 관측 수는 «줄어야» 한다(늘면 다운샘플링 결함) */
      for (let i = 1; i < perCadence.length; i++) {
        expect(perCadence[i].observations, `K=${CADENCES[i]} 관측수가 K=${CADENCES[i - 1]} 보다 많다`)
          .toBeLessThanOrEqual(perCadence[i - 1].observations);
      }
      expect(series.length).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
