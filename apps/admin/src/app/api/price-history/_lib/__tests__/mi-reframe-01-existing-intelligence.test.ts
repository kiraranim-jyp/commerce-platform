/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Discovery Value Reframing WU — STEP 0/1/2 + §5-B CONTROL
 * 「기존 Production 데이터가 «이미» 무엇을 아는가」를 운영 owner 로 전수 측정한다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. **Production 변경 0 · HTTP 0.**
 * 🟢 이번 WU 의 축은 counterfactual 이 «아니다» — 네 owner 전부 운영 호출부가 있다.
 *
 * ── 🟢 STEP 0 §5-B Preflight — owner 를 코드에서 확인했다 ────────────────
 *   Price Change    `computePriceChange`      pricing/price-history.ts:662
 *                   🔴 `priced.length < 2` 면 **null** (가격 있는 관측 2건 필요)
 *   Price Trend     `computePriceTrend`       pricing/price-history.ts:705
 *                   운영 호출 6곳 — origin/domestic/domesticShop × 7d/30d
 *                   (market-intelligence.ts:160-165)
 *   Price Alert     `computePriceAlertSignal` pricing/price-alert-signal.ts:21
 *                   운영 호출 market-intelligence.ts:190 · 임계 ±10% / 마진 ±5%p
 *   Availability    `sold_out` 칸 — 운영이 **원가 선택을 바꾼다**
 *                   (market-intelligence.ts:216 `latestOrigin.soldOut !== true`)
 *   Seller 출력      `computeSellerAction`     pricing/seller-action.ts:94
 *                   운영 호출 market-intelligence.ts:479 → UI
 *                   DomesticPriceIntelligencePanel.tsx:478
 *   🔴 **RESTOCK owner 없음** · 🔴 **NEW_SELLER / 판매처 소멸 owner 없음**
 *      (grep 전수 0건 — 「재입고」는 폼 안내문에만 있고 계산된 신호가 아니다)
 *   🔴 Newness owner 없음 — `snapshots/route.ts:59` 의 `isNewAnalysis` 는
 *      「새 분석 요청인가」이고 **상품 신규성이 아니다.**
 *
 * ── 🟢 이미 셀러 문구로 나가는 신호 (seller-action.ts 실측) ──────────────
 *   국내 경쟁가격 하락/상승 · 경쟁상품 품절 · 해외 원가 상승/하락 ·
 *   국내+해외 결합 3조합 · opportunity 2케이스
 *   → 🔴 즉 Price Trend / Availability 는 「Discovery 가 새로 줄 것」이 아니라
 *      **이미 배선된 축** 이다. 이번 WU 는 그 위의 incremental 을 재야 한다.
 *
 * ── 🔴 DB 실측이 던진 의심 (이 하니스가 가르는 것) ──────────────────────
 *   같은 `(snapshot, source, checked_at)` 에 행이 2개 이상인 그룹 207개
 *   (SELLER_ORIGIN, 최대 8행) 이고 **그 전부가 가격이 서로 다르다.**
 *   `computePriceChange` 는 `checkedAt` 으로 정렬해 [latest, previous] 를 집으므로
 *   🔴 **같은 순간의 두 행을 「가격 변화」로 계산할 수 있다.**
 *   → owner 를 직접 돌려 「시간 변화」와 「같은 순간의 축 차이」를 가른다.
 *   🔴 단정하지 않는다 — `selectCostBasisOriginObservations` 가 그 행들을
 *      걸러낼 수도 있다(MARKET_PROBE 제거 · ORIGIN_FX 있으면 KR_MARKET 제거).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computePriceAlertSignal,
  computePriceChange,
  computePriceTrend,
  type PriceObservationRecord,
} from "@commerce/pricing";
import { selectCostBasisOriginObservations } from "../price-observations";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface Row {
  id: string; snapshot_id: string; title: string; source_url: string;
  source: string; source_label: string | null; currency: string;
  price_amount: string | number | null; price_krw: string | number | null;
  sale_price_krw: string | number | null; original_price_krw: string | number | null;
  sold_out: boolean | null; market_code: string | null;
  source_product_url: string | null; checked_at: string;
}
interface Link {
  snapshot_id: string; source_id: string; external_url: string; status: string | null;
  match_truth: string | null; created_at: string; updated_at: string; verified: boolean | null;
}
const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

describe.skipIf(!LIVE)("🔴 MI-REFRAME-01 — 기존 Intelligence 가 이미 아는 것", () => {
  it(
    "운영 owner 로 가격변화·추세·알림·재고를 전수 재계산한다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const rows = read<Row[]>("reframe-obs.json");
      const links = read<Link[]>("reframe-links.json");

      /** 🔴 owner 가 먹는 모양으로 변환한다. 필드명을 지어내지 않는다. */
      const toRecord = (r: Row): PriceObservationRecord & { sourceLabel: string | null; marketCode: string | null; id: string } => ({
        id: r.id,
        source: r.source as PriceObservationRecord["source"],
        sourceLabel: r.source_label,
        marketCode: r.market_code,
        priceKrw: num(r.price_krw),
        salePriceKrw: num(r.sale_price_krw),
        originalPriceKrw: num(r.original_price_krw),
        soldOut: r.sold_out,
        checkedAt: r.checked_at,
        currency: r.currency,
        priceAmount: num(r.price_amount),
        sourceProductUrl: r.source_product_url,
      } as never);

      const bySnap = new Map<string, Row[]>();
      for (const r of rows) (bySnap.get(r.snapshot_id) ?? bySnap.set(r.snapshot_id, []).get(r.snapshot_id)!).push(r);

      const dayOf = (iso: string) => iso.slice(0, 10);
      const per = [...bySnap.entries()].map(([sid, all]) => {
        const title = all[0]?.title?.slice(0, 44) ?? null;
        const origin = all.filter((r) => r.source === "SELLER_ORIGIN");
        const domestic = all.filter((r) => r.source === "DOMESTIC_SHOP");

        /** 🟢 운영과 «같은» 전처리: 원가 행만 고른다 */
        const originHistory = selectCostBasisOriginObservations(origin.map(toRecord));
        const originChange = computePriceChange(originHistory as PriceObservationRecord[]);
        const originTrend7d = computePriceTrend(originHistory as PriceObservationRecord[], 7);
        const domesticHistory = domestic.map(toRecord);
        const domesticChange = computePriceChange(domesticHistory as PriceObservationRecord[]);
        const domesticTrend7d = computePriceTrend(domesticHistory as PriceObservationRecord[], 7);

        /** 운영과 같은 입력으로 알림 신호 */
        const alertSignal = originChange
          ? computePriceAlertSignal({ priceChangeRatePercent: originChange.changeRatePercent, marginChangePercentPoints: null })
          : null;

        /** 🔴 핵심 — 「변화」가 시간을 건넌 것인가, 같은 순간의 축 차이인가 */
        const sameInstantChange = originChange ? originChange.oldCheckedAt === originChange.newCheckedAt : null;
        const sameDayChange = originChange ? dayOf(originChange.oldCheckedAt) === dayOf(originChange.newCheckedAt) : null;
        const originDays = new Set(originHistory.map((r) => dayOf((r as { checkedAt: string }).checkedAt))).size;
        /** 🔴 같은 순간 행이 원가 집합 «안에» 남아 있는가 */
        const instants = new Map<string, number>();
        for (const r of originHistory as { checkedAt: string }[]) instants.set(r.checkedAt, (instants.get(r.checkedAt) ?? 0) + 1);
        const maxRowsPerInstant = Math.max(0, ...instants.values());

        /** Availability */
        const soldOutVals = new Set(origin.map((r) => String(r.sold_out)));
        const latestOrigin = originHistory[0] as { soldOut?: boolean | null } | undefined;

        /** NEW_SELLER / 소멸 — 유일한 후보는 링크 테이블이다 */
        const myLinks = links.filter((l) => l.snapshot_id === sid);
        return {
          snapshotId: sid, title,
          originRows: origin.length, originCostRows: originHistory.length, domesticRows: domestic.length,
          /** ② Price Change */
          hasOriginChange: !!originChange,
          originChangeRatePercent: originChange?.changeRatePercent ?? null,
          "🔴 변화가 같은 순간의 두 행인가": sameInstantChange,
          "🔴 변화가 같은 날인가": sameDayChange,
          originDistinctDays: originDays,
          "🔴 원가집합에 같은 순간 행이 몇 개": maxRowsPerInstant,
          hasDomesticChange: !!domesticChange,
          domesticChangeRatePercent: domesticChange?.changeRatePercent ?? null,
          /** ③ Trend */
          originTrend7d: originTrend7d?.trend ?? null,
          domesticTrend7d: domesticTrend7d?.trend ?? null,
          /** ④ Alert */
          alertSignal,
          /** ⑤ Availability */
          soldOutValues: [...soldOutVals].sort(),
          "🔴 품절 전이 있음": soldOutVals.has("true") && soldOutVals.has("false"),
          latestOriginSoldOut: latestOrigin?.soldOut ?? null,
          /** ⑥ Seller */
          linkCount: myLinks.length,
          linkStatuses: [...new Set(myLinks.map((l) => l.status ?? "(null)"))],
          "🔴 링크가 생성 후 갱신됐나": myLinks.some((l) => l.created_at !== l.updated_at),
        };
      });

      const n = per.length;
      const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`;
      const changed = per.filter((p) => p.hasOriginChange);
      const report = {
        "🟢 DISCLAIMER": "전부 FULL POPULATION. 운영 owner(computePriceChange/Trend/AlertSignal + " +
          "selectCostBasisOriginObservations)로 재계산했다. Production 변경 0 · HTTP 0 · DB 는 SELECT 만.",
        scope: { snapshots: n, observationRows: rows.length, domesticLinks: links.length },

        /** ══ STEP 1 — 기존 데이터가 이미 아는 것 ══ */
        existingIntelligence: {
          "② 가격 변화 — 운영 owner 가 값을 내는 스냅샷": `${changed.length}/${n} (${pct(changed.length)})`,
          "   그중 🔴 같은 «순간» 두 행을 비교한 것": (() => {
            const c = changed.filter((p) => p["🔴 변화가 같은 순간의 두 행인가"] === true).length;
            return `${c}/${changed.length}`;
          })(),
          "   그중 🔴 같은 «날» 안에서 비교한 것": (() => {
            const c = changed.filter((p) => p["🔴 변화가 같은 날인가"] === true).length;
            return `${c}/${changed.length}`;
          })(),
          "   🟢 실제로 날짜를 건넌 변화": (() => {
            const c = changed.filter((p) => p["🔴 변화가 같은 날인가"] === false).length;
            return `${c}/${changed.length}`;
          })(),
          "③ 추세(7d) 분포": (() => {
            const t: Record<string, number> = {};
            for (const p of per) t[String(p.originTrend7d)] = (t[String(p.originTrend7d)] ?? 0) + 1;
            return t;
          })(),
          "④ 알림 신호 분포": (() => {
            const t: Record<string, number> = {};
            for (const p of per) t[String(p.alertSignal)] = (t[String(p.alertSignal)] ?? 0) + 1;
            return t;
          })(),
          "⑤ 관측 날짜 수 분포": (() => {
            const t: Record<string, number> = {};
            for (const p of per) { const k = p.originDistinctDays >= 3 ? "3+" : String(p.originDistinctDays); t[k] = (t[k] ?? 0) + 1; }
            return t;
          })(),
          "⑥ 품절 전이(RESTOCK/품절) 있는 스냅샷": per.filter((p) => p["🔴 품절 전이 있음"]).length,
          "   최신 원가행이 품절": per.filter((p) => p.latestOriginSoldOut === true).length,
          "⑦ 국내 링크 보유 스냅샷": per.filter((p) => p.linkCount > 0).length,
          "   링크가 생성 후 갱신된 스냅샷": per.filter((p) => p["🔴 링크가 생성 후 갱신됐나"]).length,
        },

        /** ══ STEP 2 — Discovery 가 «추가» 할 수 있는 축 ══ */
        signalOwnership: {
          "🟢 운영 owner 가 이미 있다": {
            PRICE_UP_DOWN: "computePriceChange + computePriceTrend + computePriceAlertSignal → computeSellerAction",
            OUT_OF_STOCK: "price_observations.sold_out → soldOutCount → 셀러 문구 + 원가 선택(:216)",
          },
          "🔴 운영 owner 가 «없다»(grep 전수 0)": {
            RESTOCK: "재입고 전이를 계산하는 코드가 없다",
            NEW_SELLER: "판매처 증가를 신호로 만드는 코드가 없다",
            SELLER_DISAPPEARED: "판매처 소멸을 신호로 만드는 코드가 없다",
            NEW: "상품 신규성 owner 가 없다 — snapshots/route.ts:59 isNewAnalysis 는 «분석 요청» 이다",
          },
        },
        perSnapshot: per,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "reframe-existing.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, perSnapshot: `(${n}건 — 파일 참조)` }, null, 2));
      expect(n).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
