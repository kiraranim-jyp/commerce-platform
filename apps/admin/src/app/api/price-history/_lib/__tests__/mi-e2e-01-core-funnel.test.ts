/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI Core E2E WU — 국내/해외 동일상품 가격비교 완성도 전수 측정
 * 「상품 하나를 넣으면 국내/해외에서 같은 상품을 찾아 가격을 비교할 수 있는가」
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP(`MI_P0_02_LIVE=1`). **Production 0 · HTTP 0 · DB 는 SELECT 만.**
 *
 * ── 🔴🔴 STEP 1 결과 — 경로 A/B 는 «제품에 없다» (전수 확인) ────────────
 *   CPO 가 E2E 의 첫 두 축으로 놓은 「국내 URL 직접 입력」·「해외 URL 직접 입력」의
 *   **입력부가 존재하지 않는다.** 추측이 아니라 라우트/UI 전수 확인이다:
 *     `links/route.ts`        → **GET 만** (조회)
 *     `links/[id]/route.ts`   → **PATCH `{verified:boolean}`** 만 (사람이 SAME 확인)
 *     `search/route.ts` POST  → **title 필수**. `sourceUrl` 은 «원상품» URL 이고
 *                               비교후보 URL 이 아니다
 *     UI 쓰기 3곳 = alerts PATCH · price-history/check POST · links/[id] PATCH
 *   🟢 `MANUAL` 은 **판매처(샵)의 수집전략** 이다(`DomesticSourceCollectionStrategy`)
 *      — 상품 URL 입력이 아니다. `DomesticPriceSource` 는 샵 단위(name/domain/url).
 *   🔴 경로 D(해외 AI Discovery)는 **운영 호출부 0**(선행 WU 확정, counterfactual).
 *   🟢 따라서 **운영에 실재하는 E2E 는 경로 C 하나** 다.
 *
 * ── 🟢 STEP 0 §5-B — owner 어휘를 코드에서 읽었다(추측 금지) ────────────
 *   `MatchTruth`         match-truth.ts:33
 *   `DomesticPriceTier`  domestic-product-link.ts:84 = EXACT|COMPARISON|REFERENCE|EXCLUDED
 *   `priceTierFromLink`  :86 — 🔴 매핑을 **그대로** 쓴다(복제 계산 금지):
 *     EXACT_IDENTIFIER | STRONG_IDENTIFIER → EXACT
 *     TEXT_CONFIRMED                       → COMPARISON
 *     SIMILAR                              → REFERENCE
 *     CONFLICT | INSUFFICIENT_EVIDENCE     → EXCLUDED
 *     그 외(null)                           → verified ? EXACT : COMPARISON
 *   돈이 움직이는 칸  `price-history.ts:644` — `exact.sellerCount > 0` 이면
 *     COMPARISON 전체가 무시된다(선행 WU 확정).
 *   🔴 내가 처음에 `match_truth='SAME_PRODUCT'` 로 쿼리해 **0건**을 받았다.
 *      그 어휘는 **존재하지 않는다** — owner 타입을 읽지 않고 쿼리한 내 실수다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { priceTierFromLink, type DomesticProductLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

interface LinkRow {
  snapshot_id: string; ptitle: string; external_url: string;
  matched_brand: string | null; matched_title: string | null;
  matched_model_name: string | null; matched_color: string | null;
  match_type: string | null; match_confidence: string | number | null;
  match_truth: string | null; cross_seller_verdict: string | null;
  verified: boolean | null; status: string | null;
  shop: string | null; domain: string | null; collection_strategy: string | null;
}
interface ObsRow {
  snapshot_id: string; title: string; source: string; source_label: string | null;
  currency: string; price_amount: string | number | null; price_krw: string | number | null;
  sold_out: boolean | null; checked_at: string;
}
const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);
const tally = (xs: string[]) => {
  const t: Record<string, number> = {};
  for (const x of xs) t[x] = (t[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
};

describe.skipIf(!LIVE)("🔴 MI-E2E-01 — 국내/해외 동일상품 가격비교 E2E", () => {
  it(
    "운영 owner 로 Identity → 가격 → 비교 퍼널을 전수 센다",
    async () => {
      const read = <T>(f: string): T => {
        const p = path.join(OUT_DIR, f);
        if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
        return JSON.parse(readFileSync(p, "utf8")) as T;
      };
      const links = read<LinkRow[]>("e2e-links.json");
      const obs = read<ObsRow[]>("reframe-obs.json");

      /** 🟢 tier 는 운영 owner 를 «호출해» 얻는다. 복제 계산하지 않는다. */
      const withTier = links.map((l) => ({
        ...l,
        tier: priceTierFromLink({ matchTruth: l.match_truth, verified: l.verified } as unknown as DomesticProductLink),
      }));

      /** 가격 보유 집합 */
      const domesticPriced = new Set(obs.filter((o) => o.source === "DOMESTIC_SHOP" && num(o.price_krw) !== null).map((o) => o.snapshot_id));
      const originPriced = new Set(obs.filter((o) => o.source === "SELLER_ORIGIN" && num(o.price_krw) !== null).map((o) => o.snapshot_id));
      const snapWithLink = new Set(links.map((l) => l.snapshot_id));
      const snapWithExact = new Set(withTier.filter((l) => l.tier === "EXACT").map((l) => l.snapshot_id));

      /** ══ STEP 5/6 — 가격 의미를 축으로 가른다 ══ */
      const originBySnap = new Map<string, ObsRow[]>();
      for (const o of obs) {
        if (o.source !== "SELLER_ORIGIN") continue;
        (originBySnap.get(o.snapshot_id) ?? originBySnap.set(o.snapshot_id, []).get(o.snapshot_id)!).push(o);
      }
      const domBySnap = new Map<string, ObsRow[]>();
      for (const o of obs) {
        if (o.source !== "DOMESTIC_SHOP") continue;
        (domBySnap.get(o.snapshot_id) ?? domBySnap.set(o.snapshot_id, []).get(o.snapshot_id)!).push(o);
      }

      /** ══ STEP 7 — 국내↔해외 비교 가능성을 «조건별로» 가른다 ══ */
      type CmpVerdict = "COMPARABLE" | "NO_EXACT_LINK" | "NO_DOMESTIC_PRICE" | "NO_OVERSEAS_PRICE" | "NO_LINK_AT_ALL";
      const perSnap = [...new Set([...snapWithLink, ...domesticPriced, ...originPriced])].map((sid) => {
        const myLinks = withTier.filter((l) => l.snapshot_id === sid);
        const hasExact = myLinks.some((l) => l.tier === "EXACT");
        const dom = domBySnap.get(sid) ?? [];
        const org = originBySnap.get(sid) ?? [];
        const domKrw = dom.map((o) => num(o.price_krw)).filter((x): x is number => x !== null);
        const orgKrw = org.map((o) => num(o.price_krw)).filter((x): x is number => x !== null);

        let verdict: CmpVerdict;
        if (myLinks.length === 0) verdict = "NO_LINK_AT_ALL";
        else if (!hasExact) verdict = "NO_EXACT_LINK";
        else if (domKrw.length === 0) verdict = "NO_DOMESTIC_PRICE";
        else if (orgKrw.length === 0) verdict = "NO_OVERSEAS_PRICE";
        else verdict = "COMPARABLE";

        /** 🔴 「같은 가격 의미인가」 — 해외 축은 sourceLabel 로 갈린다 */
        const originLabels = [...new Set(org.map((o) => o.source_label ?? "(null)"))];
        const originCurrencies = [...new Set(org.map((o) => o.currency))];
        return {
          snapshotId: sid, title: (myLinks[0]?.ptitle ?? dom[0]?.title ?? org[0]?.title ?? "").slice(0, 40),
          links: myLinks.length, tiers: tally(myLinks.map((l) => l.tier)),
          matchTruths: tally(myLinks.map((l) => l.match_truth ?? "(null)")),
          verifiedCount: myLinks.filter((l) => l.verified).length,
          domesticPrices: domKrw.length, domesticLowestKrw: domKrw.length ? Math.min(...domKrw) : null,
          overseasPrices: orgKrw.length, overseasLowestKrw: orgKrw.length ? Math.min(...orgKrw) : null,
          originLabels, originCurrencies,
          /** 🔴 해외 축에 MARKET_PROBE 만 있으면 «원가가 아니다» */
          "🔴 해외가 전부 MARKET_PROBE": org.length > 0 && org.every((o) => o.source_label === "MARKET_PROBE"),
          verdict,
        };
      });

      const n = perSnap.length;
      const SNAPSHOT_TOTAL = 498; // 🔴 전수. DB 실측.
      const comparable = perSnap.filter((x) => x.verdict === "COMPARABLE");
      const report = {
        "🟢 DISCLAIMER": "FULL POPULATION. 운영 owner(priceTierFromLink)를 «호출해» tier 를 얻었다. " +
          "Production 변경 0 · HTTP 0 · DB 는 SELECT 만. 🔴 운영에 실재하는 E2E 는 경로 C 하나다.",

        "🔴 STEP 1 — E2E 경로별 운영 owner 존재 여부": {
          "A 국내 URL 직접 입력": "🔴 **없다** — links 는 GET/PATCH 뿐 · search POST 는 title 필수",
          "B 해외 URL 직접 입력": "🔴 **없다** — 같은 이유. MANUAL 은 «샵» 수집전략이고 상품 URL 이 아니다",
          "C 국내 후보 탐색": "🟢 **있다** — searchDomesticShops → withConfidence → judgeDomesticCandidate",
          "D 해외 AI Discovery": "🔴 **운영 호출부 0**(선행 WU 확정 · counterfactual)",
        },

        "🔴 STEP 10 — E2E 퍼널 (전수 N=498)": {
          "① 원상품 스냅샷": SNAPSHOT_TOTAL,
          "② 국내 링크 보유": snapWithLink.size,
          "③ 🟢 EXACT tier 링크 보유": snapWithExact.size,
          "④ 국내 가격 보유": domesticPriced.size,
          "⑤ 해외 관측 보유": originPriced.size,
          "⑥ 🟢 국내«와» 해외 둘 다 가격": [...domesticPriced].filter((s) => originPriced.has(s)).length,
          "⑦ 🟢🟢 COMPARABLE (EXACT 링크 + 국내가 + 해외가)": comparable.length,
          "🔴🔴 핵심 KPI — 상품 1개를 넣었을 때 신뢰할 수 있는 비교를 얻을 확률":
            `${comparable.length}/${SNAPSHOT_TOTAL} = ${((comparable.length / SNAPSHOT_TOTAL) * 100).toFixed(1)}%`,
        },

        "🔴 STEP 3 — Identity 분포 (링크 전수)": {
          "링크 총수": links.length,
          matchTruth: tally(links.map((l) => l.match_truth ?? "(null)")),
          crossSellerVerdict: tally(links.map((l) => l.cross_seller_verdict ?? "(null)")),
          "🟢 tier (운영 owner 호출)": tally(withTier.map((l) => l.tier)),
          verified: tally(links.map((l) => String(l.verified))),
          status: tally(links.map((l) => l.status ?? "(null)")),
          "🔴 측정불가 — SAME Precision/Recall": "ground truth 가 운영 verified 69건뿐이고 그것이 판정 입력이기도 하다 " +
            "→ 독립 GT 가 아니다. 선행 WU 의 독립 라벨(observeVision) 기준 EXACT FP 0 · Recall 4/5(eligible 5) 를 쓴다",
        },

        "🔴 STEP 8 — 비교 실패가 «어디서» 끊기는가": {
          verdicts: tally(perSnap.map((x) => x.verdict)),
          "분모(링크 또는 가격이 하나라도 있는 스냅샷)": n,
          "🔴 아무 링크도 없는 스냅샷(전수 대비)": `${SNAPSHOT_TOTAL - snapWithLink.size}/${SNAPSHOT_TOTAL}`,
        },

        "🔴 STEP 6 — 해외 가격의 «의미»": {
          "해외 관측 보유": originPriced.size,
          "🔴 해외가가 전부 MARKET_PROBE(= 원가 아님)인 스냅샷": perSnap.filter((x) => x["🔴 해외가 전부 MARKET_PROBE"]).length,
          note: "🔴 해외 retail price ≠ 해외 sourcing cost. MARKET_PROBE 는 SELLER_ORIGIN 이지만 원가가 아니다(run-price-check:128).",
        },

        "🔴 측정불가로 남긴 것": {
          "경로 A/B 성능": "입력부가 없어 **측정 자체가 불가능** 하다. 0% 가 아니다",
          "경로 D 성능": "운영 호출부 0 → counterfactual 만 가능(선행 WU)",
          "SAME Precision/Recall": "독립 GT 분모가 5 뿐 → 일반화 금지",
          "국내 가격 coverage 의 원인": "「검색이 약함」 ↔ 「그 샵에 그 상품이 없음」 미분리(선행 WU)",
        },
        perSnapshot: perSnap.sort((a, b) => a.verdict.localeCompare(b.verdict)),
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "e2e-core.json"), JSON.stringify(report, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify({ ...report, perSnapshot: `(${n}건 — 파일 참조)` }, null, 2));

      /** 🔴 정합성 — verdict 합이 분모와 같아야 한다 */
      const sum = Object.values(tally(perSnap.map((x) => x.verdict))).reduce((a, b) => a + b, 0);
      expect(sum).toBe(n);
      expect(links.length).toBeGreaterThan(0);
    },
    120 * 60 * 1000,
  );
});
