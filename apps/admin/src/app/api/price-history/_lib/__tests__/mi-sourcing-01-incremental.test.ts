/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Sourcing Value WU — STEP C~H: Discovery 해외가가 incremental 한가
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다. **Production 변경 0.**
 * 🔴🔴 Discovery 축은 `COUNTERFACTUAL / NON-PRODUCTION`(운영 호출부 0).
 *      🟢 원가·환율 축은 **운영 owner 그대로** 다.
 *
 * ── 🟢 §5-B Preflight 결과 ────────────────────────────────────────────────
 *   원가 선택   `selectCostBasisOriginObservations`(price-observations.ts:303)
 *               🟢 순수 함수다 — `sourceLabel` 하나만 본다
 *               `ORIGIN_FX` 가 하나라도 있으면 `KR_MARKET` 을 버린다
 *   원가 값     `costPriceKrw = originHistory[0].priceKrw` (market-intelligence:168)
 *   원가 근거   `costBasis = originHistory[0].sourceLabel`  (:173)
 *   🔴 `MARKET_PROBE` 는 **원가로 읽으면 안 된다**(run-price-check:128-133)
 *   환율       `convertToKrwStrict`(pricing/currency.ts:73) — 모르면 **null**
 *               🟢 DB `exchange_rates` 실측: frankfurter · EUR 1502.79 · GBP 1774.29
 *                  · USD 등 · fetched_at 2026-10-08  → **임의 환율 0**
 *
 * ── 운영 SELLER_ORIGIN 전수 (FULL POPULATION 1476행) ─────────────────────
 *   MARKET_PROBE 599(205 snaps) · KR_MARKET 430(227) · ORIGIN_FX 311(257) · null 136(63)
 *   통화 KRW 477 · EUR 474 · GBP 222 · USD 174 · AUD 107 · JPY 17 · CAD 5
 *
 * ── 🔴 하지 않는 것 (§11) ────────────────────────────────────────────────
 *   해외 판매가를 `SELLER_ORIGIN` 으로 승격 ✗ · 국내 필드에 저장 ✗ ·
 *   임의 환율 ✗ · Production FX 신규 구현 ✗ · threshold 변경 ✗
 *   🔴 측정 중 발견한 Production 결함은 **고치지 않고** `Observed Production Defect`
 *      로만 기록한다(§13).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { convertToKrwStrict } from "@commerce/pricing";
import { selectCostBasisOriginObservations } from "../price-observations";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface Obs {
  snapshot_id: string; title: string; source_url: string;
  source_label: string | null; currency: string; price_amount: string | number | null;
  price_krw: string | number | null; exchange_rate: string | number | null;
  market_code: string | null; at: string;
}
interface Fx { currency: string; rate: string | number; source: string }
/** 선행 WU 가 남긴 enrichment 행 — 후보 가격이 여기 있다. */
interface PriceRow {
  originBrand: string; originTitle: string; host: string; priorLabel: string;
  pricesAfter: { title: string; price: { amount: number; currency: string } | null; status: string }[];
}
const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

describe.skipIf(!LIVE)("🔴 MI-SOURCING-01 — Discovery 해외가의 incremental value", () => {
  it(
    "운영 원가 owner 를 재현하고, Discovery 해외가를 같은 통화축에서 비교한다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const obs = read<Obs[]>("src-origin-obs.json");
      const fxRows = read<Fx[]>("src-fx.json");
      const priceRows = read<{ rows: PriceRow[] }>("mi-price-enrichment.json").rows;

      /** 🟢 운영 환율을 그대로 쓴다. 🔴 없는 통화는 null 로 남긴다. */
      const rates: Record<string, number> = {};
      for (const r of fxRows) { const n = num(r.rate); if (n) rates[r.currency] = n; }

      /* ══ STEP C — CONTROL: 운영 costPriceKrw/costBasis 재현 ══ */
      const bySnap = new Map<string, Obs[]>();
      for (const o of obs) (bySnap.get(o.snapshot_id) ?? bySnap.set(o.snapshot_id, []).get(o.snapshot_id)!).push(o);
      /** 🔴 운영과 «같은 순서» 로 넣는다 — 덤프는 checked_at DESC 다(최신이 [0]). */
      const control = [...bySnap.entries()].map(([sid, rows]) => {
        const picked = selectCostBasisOriginObservations(rows.map((r) => ({ ...r, sourceLabel: r.source_label })));
        const head = picked[0];
        return {
          snapshotId: sid, title: rows[0]?.title?.slice(0, 44) ?? null,
          observations: rows.length,
          labelsPresent: [...new Set(rows.map((r) => r.source_label ?? "(null)"))],
          costPriceKrw: head ? num(head.price_krw) : null,
          costBasis: (head?.source_label ?? null) as string | null,
          costCurrency: head?.currency ?? null,
          /** 🔴 MARKET_PROBE 가 원가로 뽑히면 그것은 결함 신호다 */
          "🔴 MARKET_PROBE 가 원가로 뽑혔나": head?.source_label === "MARKET_PROBE",
          /** 🟢 ORIGIN_FX 가 있으면 KR_MARKET 이 빠졌는지 */
          hadOriginFx: rows.some((r) => r.source_label === "ORIGIN_FX"),
          krMarketDropped: rows.some((r) => r.source_label === "KR_MARKET")
            && !picked.some((r) => r.source_label === "KR_MARKET"),
        };
      });
      const ctrlGate = {
        note: "🔴 「함수가 돌았다」가 아니라 «선택 규칙이 운영 주석과 같은 결과» 를 내는지 본다.",
        snapshots: control.length,
        withCost: control.filter((c) => c.costPriceKrw !== null).length,
        "🔴 MARKET_PROBE 가 원가로 뽑힌 스냅샷": control.filter((c) => c["🔴 MARKET_PROBE 가 원가로 뽑혔나"]).length,
        "🟢 ORIGIN_FX 보유 스냅샷": control.filter((c) => c.hadOriginFx).length,
        "🟢 그중 KR_MARKET 이 실제로 제거된 수": control.filter((c) => c.hadOriginFx && c.krMarketDropped).length,
        byCostBasis: (() => {
          const t: Record<string, number> = {};
          for (const c of control) t[c.costBasis ?? "(null)"] = (t[c.costBasis ?? "(null)"] ?? 0) + 1;
          return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
        })(),
      };

      /* ══ STEP D~F — Discovery 해외가 ↔ 운영 원가 ══ */
      /** 🔴 선행 WU 와 같은 키(원상품 제목 앞 54자)로 묶는다. */
      const costByTitle = new Map<string, { krw: number | null; basis: string | null; currency: string | null }>();
      for (const c of control) {
        if (!c.title) continue;
        const prev = costByTitle.get(c.title);
        // 🔴 같은 제목이 여러 스냅샷에 있으면 «원가가 있는» 쪽을 쓴다(없는 것으로 덮지 않는다).
        if (!prev || (prev.krw === null && c.costPriceKrw !== null)) {
          costByTitle.set(c.title, { krw: c.costPriceKrw, basis: c.costBasis, currency: c.costCurrency });
        }
      }

      interface Cmp { [k: string]: unknown }
      const cmp: Cmp[] = [];
      const byProduct = new Map<string, PriceRow[]>();
      for (const r of priceRows) (byProduct.get(r.originTitle) ?? byProduct.set(r.originTitle, []).get(r.originTitle)!).push(r);

      for (const [title, rs] of byProduct) {
        /** 🔴 원가는 제목 앞 44자로 떠 있으므로 앞부분 일치로 찾는다(지어내지 않는다). */
        let cost: { krw: number | null; basis: string | null; currency: string | null } | null = null;
        for (const [k, v] of costByTitle) if (title.startsWith(k.slice(0, 30)) || k.startsWith(title.slice(0, 30))) { cost = v; break; }

        const sameRows = rs.filter((r) => r.priorLabel === "KNOWN_SAME");
        const notSameRows = rs.filter((r) => r.priorLabel === "KNOWN_NOT_SAME");
        const toKrw = (p: { amount: number; currency: string }) =>
          convertToKrwStrict(p.amount, p.currency, rates)?.amountKrw ?? null;
        const collect = (xs: PriceRow[]) => xs.flatMap((r) => r.pricesAfter
          .map((p) => p.price).filter((p): p is { amount: number; currency: string } => !!p)
          .map((p) => ({ host: r.host, amount: p.amount, currency: p.currency, krw: toKrw(p) })));
        const samePrices = collect(sameRows);
        const notSamePrices = collect(notSameRows);
        const sameKrw = samePrices.map((x) => x.krw).filter((x): x is number => x !== null);
        const lowestSame = sameKrw.length ? Math.min(...sameKrw) : null;
        const notSameKrw = notSamePrices.map((x) => x.krw).filter((x): x is number => x !== null);
        const lowestNotSame = notSameKrw.length ? Math.min(...notSameKrw) : null;

        /** 🔴 「싸다」를 가치로 가정하지 않는다 — 차이를 적고 판정은 집계에서 한다. */
        const deltaPct = cost?.krw && lowestSame !== null
          ? Number((((lowestSame - cost.krw) / cost.krw) * 100).toFixed(1)) : null;
        cmp.push({
          title: title.slice(0, 48), brand: rs[0]?.originBrand ?? null,
          /** A = 기존 SELLER_ORIGIN 원가 */
          existingCostKrw: cost?.krw ?? null, costBasis: cost?.basis ?? null, costCurrency: cost?.currency ?? null,
          hasExistingCost: !!cost?.krw,
          /** B = Discovery SAME 최저 해외가(KRW 환산) */
          knownSameHosts: sameRows.length, samePriceCount: samePrices.length,
          sameNormalized: sameKrw.length, sameNotNormalizable: samePrices.length - sameKrw.length,
          lowestSameKrw: lowestSame,
          currencies: [...new Set(samePrices.map((x) => x.currency))],
          deltaPctVsCost: deltaPct,
          cheaperThanCost: deltaPct !== null ? deltaPct < -5 : null,
          similarToCost: deltaPct !== null ? Math.abs(deltaPct) <= 5 : null,
          dearerThanCost: deltaPct !== null ? deltaPct > 5 : null,
          /** 🔴 §8-C 오염 — NOT_SAME 저가가 SAME 최저가보다 싼가 */
          lowestNotSameKrw: lowestNotSame,
          notSameUndercutsSame: lowestSame !== null && lowestNotSame !== null && lowestNotSame < lowestSame,
          /** 🔴 §8-B incremental — 원가가 «없는데» Discovery 가 가격을 주는가 */
          discoveryOnlyNewPrice: !cost?.krw && lowestSame !== null,
          samplePrices: samePrices.slice(0, 4),
        });
      }

      /* ══ STEP G/H — 집계 ══ */
      const withCost = cmp.filter((c) => c.hasExistingCost);
      const normalized = cmp.filter((c) => c.lowestSameKrw !== null);
      const report = {
        "🔴 DISCLAIMER": "Discovery 축은 COUNTERFACTUAL / NON-PRODUCTION. 원가·환율 축은 운영 owner 그대로. " +
          "해외 판매가를 SELLER_ORIGIN 으로 승격하지 않았고 어떤 필드에도 저장하지 않았다.",
        scope: {
          "🔴 FULL POPULATION": `SELLER_ORIGIN 관측 ${obs.length}행 / 스냅샷 ${bySnap.size}개`,
          "🔴 sample": `Discovery 비교 대상 상품 sample N=${cmp.length} (선행 WU 의 (상품×호스트) 40쌍에서 유래)`,
          fxOwner: "convertToKrwStrict + DB exchange_rates(frankfurter, fetched_at 2026-10-08) — 임의 환율 0",
          ratesUsed: Object.keys(rates).sort(),
        },
        /** STEP C */
        controlGate: ctrlGate,
        /** ① Discovery SAME yield · ② price availability · ③ currency */
        funnel: {
          products: cmp.length,
          withKnownSameHost: cmp.filter((c) => Number(c.knownSameHosts) > 0).length,
          withAnySamePrice: cmp.filter((c) => Number(c.samePriceCount) > 0).length,
          withNormalizedKrw: normalized.length,
          "🔴 환산 불가 가격": cmp.reduce((s, c) => s + Number(c.sameNotNormalizable), 0),
          currencies: [...new Set(cmp.flatMap((c) => c.currencies as string[]))],
        },
        /** ⑤ SELLER_ORIGIN coverage */
        existingCostCoverage: {
          productsWithExistingCost: withCost.length,
          productsWithoutExistingCost: cmp.length - withCost.length,
          byCostBasis: (() => {
            const t: Record<string, number> = {};
            for (const c of cmp) t[String(c.costBasis ?? "(없음)")] = (t[String(c.costBasis ?? "(없음)")] ?? 0) + 1;
            return t;
          })(),
        },
        /** ⑥ §8-A/B incremental */
        incremental: {
          "🔴 §8-A 원가보다 유의미하게 낮은 사례(-5% 초과)": cmp.filter((c) => c.cheaperThanCost === true).length,
          "동일/유사(±5%)": cmp.filter((c) => c.similarToCost === true).length,
          "더 높은 사례(+5% 초과)": cmp.filter((c) => c.dearerThanCost === true).length,
          "🟢 §8-B Discovery 만이 주는 새 가격 정보": cmp.filter((c) => c.discoveryOnlyNewPrice === true).length,
          "비교 가능한 쌍(원가 있고 환산도 됨)": cmp.filter((c) => c.deltaPctVsCost !== null).length,
          deltaPcts: cmp.filter((c) => c.deltaPctVsCost !== null).map((c) => ({ title: c.title, delta: c.deltaPctVsCost, basis: c.costBasis })),
        },
        /** ⑦ §8-C false signal */
        falseSignal: {
          "🔴 NOT_SAME 저가가 SAME 최저가를 밑도는 상품": cmp.filter((c) => c.notSameUndercutsSame === true).length,
          note: "🔴 그런 사례가 있으면 「싸다」를 근거로 채택하면 오염된다.",
        },
        /** ⑧ decision change — 🔴 이 축은 «국내» 가격 결정과 다르다 */
        decisionNote: "🔴 `computePriceDecision` 은 domesticLowestPriceKrw 축이다. 해외가는 그 칸에 넣지 않았다(§11). " +
          "원가(costPriceKrw) 변경은 Production 정책 결정이므로 이번 WU 에서 하지 않는다.",
        comparisons: cmp,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-sourcing-incremental.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, comparisons: `(${cmp.length}건 — 파일 참조)`,
        controlGate: { ...ctrlGate } }, null, 2));
      expect(cmp.length).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
