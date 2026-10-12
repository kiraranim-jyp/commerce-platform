/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Re-observation WU — STEP 1/2/4/5: Before/After Counterfactual
 * 「재관측이 Seller Intelligence 에 «새 정보» 를 주는가」
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP(`MI_P0_02_LIVE=1`). **Production 0 · HTTP 0 · DB 는 SELECT 만.**
 * 🔴 cron/스케줄/threshold/schema 를 건드리지 않는다(§9).
 *
 * ── 설계: 과거 데이터만으로 반사실을 만든다 ──────────────────────────────
 *   Before = 그 상품의 **첫 관측일** 행만 있었다고 가정
 *   After  = 실제로 쌓인 **전체** 관측
 *   → 두 입력을 «같은 운영 owner» 에 넣어 산출을 비교한다.
 *   🟢 즉 「재관측을 한 번 더 했을 때 무엇이 새로 보이는가」를 실제 데이터로 잰다.
 *   🔴 새 HTTP 를 쓰지 않는다. 이것은 과거 관측의 **재분할** 이다.
 *
 * ── 🔴 priceLevel 을 고정하는 이유 (정직하게 적는다) ─────────────────────
 *   `computeSellerAction` 의 `priceLevel` 은 `status/icon/title` 만 정하고
 *   **`signals[]` 를 만들지 않는다**(seller-action.ts:95-96). 이번에 재는 것은
 *   「재관측이 신호를 추가하는가」이므로 `priceLevel` 을 양쪽 동일하게 고정한다.
 *   🔴 그래서 이 측정은 **status 변화를 재지 않는다** — signals/opportunity 만 본다.
 *
 * ── 🟢 STEP 0 §5-B Preflight (새로 확인한 것만) ──────────────────────────
 *   재관측 실행   `runPriceCheck` run-price-check.ts:236
 *   🔴 멱등성     `hasObservationToday(snapshotId, source)` :242 —
 *                 **하루 1회** 로 묶는다. 하루에 여러 번 눌러도 1행이다.
 *                 → 🔴 시계열 해상도의 **상한이 「일」** 이다. 더 잦게는 못 쌓인다.
 *   🔴 시장 멱등성 `getObservedMarketKeysToday` :347 (snapshot+source+market+날짜)
 *   일괄 실행     `bulkRecheck` today/page.tsx:156 — 동시성 **3** ·
 *                 🔴 `status !== "REGISTERED"` 로 **등록 상품을 제외** 한다
 *   자동 스케줄   🔴 **없다** — `apps/admin/vercel.json` 에 `crons` 없음(재확인)
 *   🔴 REGISTERED 제외의 실제 영향은 **현재 없다**(실측: 평균 관측일 1.36 vs
 *      1.35 · REGISTERED 33건). 내 가설이었고 **데이터로 반증됐다.**
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computePriceChange,
  computePriceTrend,
  computeSellerAction,
  type PriceObservationRecord,
} from "@commerce/pricing";
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

/** STEP 5 분류 어휘 — CPO 지시서 그대로. 지어내지 않는다. */
type Verdict =
  | "NO_NEW_INFORMATION" | "PRICE_CHANGE" | "AVAILABILITY_CHANGE"
  | "NEW_MARKET_SIGNAL" | "FALSE_SIGNAL" | "ACTIONABLE_SIGNAL";

describe.skipIf(!LIVE)("🔴 MI-REOBS-01 — 재관측 Before/After 반사실", () => {
  it(
    "첫 관측일만 vs 전체 관측을 같은 owner 에 넣어 incremental 을 가른다",
    async () => {
      const p = path.join(OUT_DIR, "reframe-obs.json");
      if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
      const all = JSON.parse(readFileSync(p, "utf8")) as Row[];

      const bySnap = new Map<string, Row[]>();
      for (const r of all) (bySnap.get(r.snapshot_id) ?? bySnap.set(r.snapshot_id, []).get(r.snapshot_id)!).push(r);

      /** 🟢 Row 자체를 들고 다닌다 — `checked_at` 으로 되돌리면 같은 순간 행
       *     207그룹(최대 8행) 때문에 다른 행을 집는다(지난 WU 에서 당했다). */
      const asRecord = (r: Row) => ({
        ...r,
        source: r.source, sourceLabel: r.source_label, priceKrw: num(r.price_krw),
        salePriceKrw: null, originalPriceKrw: null, soldOut: r.sold_out, checkedAt: r.checked_at,
      } as unknown as PriceObservationRecord & { sourceLabel: string | null } & Row);

      /** 운영과 같은 조립 — market-intelligence.ts:159-194 · 479 */
      const assemble = (rows: Row[]) => {
        const origin = rows.filter((r) => r.source === "SELLER_ORIGIN").map(asRecord);
        const domestic = rows.filter((r) => r.source === "DOMESTIC_SHOP").map(asRecord);
        const cost = selectCostBasisOriginObservations(origin);
        const originChange = computePriceChange(cost);
        const domesticTrend7d = computePriceTrend(domestic, 7);
        const soldOutCount = domestic.filter((r) => r.soldOut === true).length;
        /** 🔴 priceLevel 은 양쪽 «동일» 하게 고정한다(위 주석 참조). */
        const action = computeSellerAction({
          priceLevel: "YELLOW",
          currentSellingPriceKrw: null,
          domestic: {
            lowestPriceKrw: null, averagePriceKrw: null, sellerCount: domestic.length,
            priceGapVsLowestPercent: null, priceGapVsAveragePercent: null,
            trend: domesticTrend7d, soldOutCount,
          },
          origin: { change: originChange },
        });
        // 🔴🔴 `computeMarketAlert` 를 여기서 «부르지 않는다». 그 함수는 판정을
        //    `sellerAction.status` «하나로만» 한다(market-alert.ts L-6 주석). 그런데
        //    이 측정은 `priceLevel` 을 YELLOW 로 고정하므로 status 가 항상
        //    PRICE_REVIEW 가 되고 → **전건 REVIEW 알림** 이 나온다. 그 숫자는
        //    재관측이 만든 것이 아니라 **내 상수가 만든 것** 이다.
        //    🔴 처음에 `as never` 캐스트로 호출했다가(MarketAlertInput 에 soldOutCount
        //       칸이 없다) 이 사실을 발견했다. 캐스트가 측정을 망칠 뻔했다.
        //    🟢 그래서 alert 축은 버리고 `signals`/`opportunity` 만 본다 — 그 둘은
        //       change/trend/soldOut 이 «실제로» 만드는 산출이다.
        return {
          originChange, domesticTrend: domesticTrend7d?.trend ?? null, soldOutCount,
          costRows: cost.length,
          /** 🔴 같은 축인지 — 혼재 시계열이면 변화가 거짓일 수 있다(§10) */
          costCurrencies: [...new Set(cost.map((r) => r.currency))],
          costLabels: [...new Set(cost.map((r) => r.source_label ?? "(null)"))],
          signalTitles: action.signals.map((s) => s.title),
          opportunity: action.opportunity?.title ?? null,
        };
      };

      const per = [...bySnap.entries()].map(([sid, rows]) => {
        const days = [...new Set(rows.map((r) => dayOf(r.checked_at)))].sort();
        const firstDay = days[0];
        const before = rows.filter((r) => dayOf(r.checked_at) === firstDay);
        const B = assemble(before);
        const A = assemble(rows);

        const newSignals = A.signalTitles.filter((t) => !B.signalTitles.includes(t));
        const lostSignals = B.signalTitles.filter((t) => !A.signalTitles.includes(t));
        /** 🔴 변화가 환율 기인인가 — 같은 통화·같은 원통화 금액이면 환율이다.
         *     🔴 **변화율 0 에는 적용하지 않는다.** 처음에 `A.originChange` 존재만
         *     보고 계산해 「환율 기인 58」 > 「변화 있는 상품 42」라는 **불가능한
         *     숫자** 를 냈다(변화가 «없는» 것을 환율 기인으로 센 것이다).
         *     보고 전 자가감사에서 두 숫자가 모순돼 잡혔다. */
        const fxOnly = (() => {
          if (!A.originChange || A.originChange.changeRatePercent === 0) return null;
          const cost = selectCostBasisOriginObservations(rows.filter((r) => r.source === "SELLER_ORIGIN").map(asRecord));
          const sorted = [...cost].sort((x, y) => (x.checkedAt < y.checkedAt ? 1 : -1));
          const [l, q2] = sorted;
          if (!l || !q2) return null;
          return l.currency === q2.currency && num(l.price_amount) !== null && num(l.price_amount) === num(q2.price_amount);
        })();
        /** 🔴 혼재 시계열 = 축이 다른 두 값을 비교한 것 → 거짓 신호 (§10) */
        const mixedAxis = A.costCurrencies.length > 1;

        let verdict: Verdict;
        if (mixedAxis && A.originChange && A.originChange.changeRatePercent !== 0) verdict = "FALSE_SIGNAL";
        else if (fxOnly === true) verdict = "FALSE_SIGNAL";
        else if (newSignals.length === 0 && !(A.opportunity && !B.opportunity)) verdict = "NO_NEW_INFORMATION";
        // 🟢 `opportunity` 가 새로 생긴 것이 실제 ACTION_REQUIRED 트리거다
        //    (market-alert.ts 우선순위 ①: status PRICE_ADJUST «또는» opportunity 존재)
        else if (A.opportunity && !B.opportunity) verdict = "ACTIONABLE_SIGNAL";
        else if (newSignals.some((t) => t.includes("품절"))) verdict = "AVAILABILITY_CHANGE";
        else if (newSignals.some((t) => t.includes("원가") || t.includes("가격"))) verdict = "PRICE_CHANGE";
        else if (newSignals.length > 0) verdict = "NEW_MARKET_SIGNAL";
        else verdict = "NO_NEW_INFORMATION";

        return {
          snapshotId: sid, title: rows[0]?.title?.slice(0, 42) ?? null,
          observedDays: days.length, firstDay, lastDay: days[days.length - 1],
          /** 🔴 재관측 자체가 불가능했던 상품은 「변화 없음」이 아니라 측정불가다 */
          reobservable: days.length >= 2,
          before: { signals: B.signalTitles, opportunity: B.opportunity, change: B.originChange?.changeRatePercent ?? null },
          after: { signals: A.signalTitles, opportunity: A.opportunity, change: A.originChange?.changeRatePercent ?? null },
          newSignals, lostSignals,
          "🔴 환율 기인": fxOnly,
          "🔴 혼재 시계열(축이 다름)": mixedAxis,
          costCurrencies: A.costCurrencies, costLabels: A.costLabels,
          soldOutCount: A.soldOutCount,
          verdict,
        };
      });

      const reob = per.filter((x) => x.reobservable);
      const tally = <T extends string>(xs: T[]) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[x] = (t[x] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const report = {
        "🟢 DISCLAIMER": "FULL POPULATION. 과거 관측의 «재분할» 이고 새 HTTP 0. 운영 owner " +
          "(selectCostBasisOriginObservations/computePriceChange/Trend/SellerAction/MarketAlert) 를 썼다. " +
          "🔴 priceLevel 은 양쪽 동일 고정 — status 변화는 재지 않았다. Production 변경 0.",
        scope: {
          "🔴 FULL POPULATION": `스냅샷 ${per.length} · 관측 ${all.length}행`,
          "🔴 재관측이 실제로 있었던 상품(2일+)": `${reob.length}/${per.length}`,
          "🔴 1일뿐 → 반사실을 만들 수 없다(측정불가, 0% 가 아니다)": per.length - reob.length,
          "🔴 시계열 해상도 상한": "「일」 — hasObservationToday 가 하루 1회로 묶는다",
        },
        /** STEP 5 — Before/After */
        incremental: {
          "분모(재관측 있었던 상품)": reob.length,
          verdicts: tally(reob.map((x) => x.verdict)),
          "🟢 새 신호가 생긴 상품": reob.filter((x) => x.newSignals.length > 0).length,
          "🔴 신호가 사라진 상품": reob.filter((x) => x.lostSignals.length > 0).length,
          "🟢 Before 에 없던 opportunity 가 After 에 생긴 상품": reob.filter((x) => !x.before.opportunity && x.after.opportunity).length,
          newSignalKinds: tally(reob.flatMap((x) => x.newSignals)),
        },
        /** STEP 2 — 변화 품질 */
        changeQuality: {
          "After 에 변화가 있는 상품": reob.filter((x) => x.after.change !== null && x.after.change !== 0).length,
          "🔴 그중 환율 기인": reob.filter((x) => x["🔴 환율 기인"] === true).length,
          "🔴 그중 혼재 시계열(축 다름)": reob.filter((x) => x["🔴 혼재 시계열(축이 다름)"]).length,
          "🟢 단일 축 · 실제 가격 변동": reob.filter((x) =>
            x.after.change !== null && x.after.change !== 0 && x["🔴 환율 기인"] === false && !x["🔴 혼재 시계열(축이 다름)"]).length,
        },
        /** STEP 3 — Availability */
        availability: {
          "국내 품절 관측이 있는 상품": per.filter((x) => x.soldOutCount > 0).length,
          "🔴 품절 전이(true↔false)": 0,
          "🔴🔴 seller-action 의 「경쟁상품 품절」 신호가 구조적으로 발화 불가":
            "soldOutCount 는 DOMESTIC_SHOP 행만 센다(seller-action.ts:117). " +
            "그런데 DOMESTIC_SHOP 279행 중 sold_out=true 가 **0행** 이다(false 166 · null 113). " +
            "🔴 「품절이 없다」가 아니라 국내 어댑터가 품절을 true 로 적은 적이 없다는 뜻이다 → 측정불가.",
          note: "🔴 전이 0 을 「재입고가 없다」로 읽지 않는다 — 관측 간격이 짧아 전이를 «볼 기회» 가 없었다(측정불가).",
        },
        /** STEP 4 — Seller Action 연결 */
        sellerActionWiring: {
          "After 에 signal 이 하나라도 있는 상품": per.filter((x) => x.after.signals.length > 0).length,
          signalKinds: tally(per.flatMap((x) => x.after.signals)),
          opportunityKinds: tally(per.map((x) => String(x.after.opportunity))),
          "🔴 computeMarketAlert 는 재지 않았다":
            "그 함수는 sellerAction.status 하나로만 판정하고, 이 측정은 priceLevel 을 고정했다. " +
            "부르면 전건 REVIEW 가 나오고 그것은 재관측이 아니라 내 상수가 만든 숫자다.",
        },
        perSnapshot: per,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "reobs-counterfactual.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, perSnapshot: `(${per.length}건 — 파일 참조)` }, null, 2));
      expect(per.length).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
