import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import { classifyCandidateMarket } from "../candidate-market";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS, type Same05Pair } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-MI-COMP-01 — **Identity → Comparability 분리 실측**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 변경 0.** threshold ❌ · `BRAND+MODEL_CODE` shortcut ❌ ·
 *    MODEL_CODE conflict ❌ · `NO_TITLE_OVERLAP` ❌ · alias 확대 ❌ ·
 *    COLOR/MATERIAL 새 축 ❌ · IMAGE scoring ❌ · 국내 가격 계산식 ❌ · A/B 통합 ❌.
 *    🔴 **MATCHING-3.1 유지**.
 *
 * ── 🔴🔴🔴 **먼저 — `PRICE_COMPARABLE` 은 운영 코드에 «없다»** ─────────────────
 * ```
 * 전수 grep — `PRICE_COMPARABLE`/`NOT_COMPARABLE` 은 운영 경로에 **0** 이다
 *   (나오는 두 곳은 naver `registered-change.ts` 와 내 SPRINT-01 «하니스» 다)
 * ⟹ 🟢 Comparability 의 **운영 owner 는 `DomesticPriceTier`** 이고
 *    `domestic-product-link.ts:59-62` 주석이 그 의미를 **직접** 말한다:
 *      EXACT       → 「가격비교 허용」          ⟹ **COMPARABLE**
 *      COMPARISON  → 「제한적 가격 참고」        ⟹ **COMPARABLE(제한적)**
 *      REFERENCE   → 「경쟁상품 참고」          ⟹ **UNDETERMINED**
 *                     (가격비교엔 안 들어가지만 **재조회 대상에는 남는다** · :74)
 *      EXCLUDED    → 「가격비교 제외」          ⟹ **NOT_COMPARABLE**
 * 🔴 그래서 새 enum 을 «만들지 않는다» — 운영이 이미 가진 축을 읽는다.
 * ```
 *
 * ── 🟢 운영 lineage(재구현하지 않고 «그 순서대로» 부른다) ───────────────────────
 * ```
 * compareCrossSellerProducts → compareModelCode → deriveMatchTruth
 *   → priceTierFromLink → classifyCandidateMarket → (국내) domesticReference 자격
 * 🔴 `domesticReference` 게이트는 `market-intelligence.ts:318` 이고
 *    **`priceTier ∈ {EXACT, COMPARISON}` ∧ `market === "KR"` ∧ KRW** 다.
 * ```
 */

type Identity = "SAME" | "DIFFERENT" | "UNDETERMINED";
type Comparability = "COMPARABLE" | "NOT_COMPARABLE" | "UNDETERMINED";

/** 🔴 system Identity 는 **운영 verdict** 로만 읽는다(내가 새로 정의하지 않는다). */
function identityOf(verdict: string): Identity {
  if (verdict === "SAME") return "SAME";
  if (verdict === "CONFLICT") return "DIFFERENT";
  return "UNDETERMINED";
}

/** 🔴 Comparability 는 **운영 tier 주석의 의미** 를 그대로 옮긴다. */
function comparabilityOf(tier: string): Comparability {
  if (tier === "EXACT" || tier === "COMPARISON") return "COMPARABLE";
  if (tier === "EXCLUDED") return "NOT_COMPARABLE";
  return "UNDETERMINED"; // REFERENCE
}

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};

const LIVE = process.env.CORE_MI_COMP_01_LIVE === "1";

describe.skipIf(!LIVE)("CORE-MI-COMP-01 — Identity × Comparability(라이브 · 운영 변경 0)", () => {
  it(
    "운영 lineage 를 그대로 타고 8칸 표를 만든다",
    async () => {
      const urls = [...new Set(SAME05_PAIRS.map((p) => p.url))];
      const live = new Map<string, { facts: ProductFacts | null; cand: Record<string, unknown> | null; status: string }>();
      for (const url of urls) {
        try {
          const r = (await factsFromProductUrl(url)) as unknown as Record<string, unknown>;
          const cand = (r.candidate as Record<string, unknown> | undefined) ?? null;
          live.set(url, {
            facts: (cand?.facts as ProductFacts | undefined) ?? null,
            cand,
            status: String(r.status ?? "?"),
          });
        } catch (e) {
          live.set(url, { facts: null, cand: null, status: `THREW(${(e as Error).message.slice(0, 20)})` });
        }
      }
      const usable = SAME05_PAIRS.filter((p) => live.get(p.url)?.facts);
      console.log(`\n  분모 — GT ${SAME05_PAIRS.length} · 라이브 facts **${usable.length}** · 🔴 제외 ${SAME05_PAIRS.length - usable.length}`);

      interface Row {
        p: Same05Pair;
        identity: Identity;
        comp: Comparability;
        tier: string;
        market: string;
        currency: string | null;
        price: number | null;
        domesticEligible: boolean;
      }
      const rows: Row[] = [];
      for (const p of usable) {
        const l = live.get(p.url)!;
        const f = l.facts as ProductFacts;
        const cross = compareCrossSellerProducts(p.origin, f);
        const code = compareModelCode(p.origin.brandModelCode, f.brandModelCode ?? null);
        const truth = deriveMatchTruth("low", code, cross.verdict, cross.blockers, cross.conflicts, !f.colorText);
        const tier = String(priceTierFromLink({ matchTruth: truth, verified: false }));
        /** 🔴 운영이 쓰는 입력을 그대로 넘긴다 — `marketEvidence` 를 빼면 KR 이 사라진다(MI-PRICE-01 교훈). */
        const c = l.cand ?? {};
        const priceObj = (c.price as { amount: number; currency: string } | null) ?? null;
        /**
         * 🔴🔴 **칸 모양을 타입에서 읽었다**(`CandidateMarketInput:63`) — 1차에 `price` 를
         *    넘기려 했고 **실제는 `currency` · `isRegisteredDomesticShop` · `marketEvidence`** 다.
         * 🔴 `isRegisteredDomesticShop` 은 **KR 근거가 아니라 충돌 감지용** 이므로(:68)
         *    등록부를 읽을 수 없는 이 하니스에서는 **false** 로 둔다 — 🔴 그것이 KR 을
         *    «만들지» 않는다(만들면 측정이 거짓이 된다).
         */
        const market = String(
          classifyCandidateMarket({
            domain: host(p.url),
            currency: priceObj?.currency ?? null,
            isRegisteredDomesticShop: false,
            marketEvidence: (c.marketEvidence as never) ?? undefined,
          }).market,
        );
        const comp = comparabilityOf(tier);
        const domesticEligible =
          (tier === "EXACT" || tier === "COMPARISON") && market === "KR" && priceObj?.currency === "KRW";
        rows.push({
          p,
          identity: identityOf(String(cross.verdict)),
          comp,
          tier,
          market,
          currency: priceObj?.currency ?? null,
          price: priceObj?.amount ?? null,
          domesticEligible,
        });
      }

      /** ── 8칸 표 ─────────────────────────────────────────────────────── */
      const IDs: Identity[] = ["SAME", "DIFFERENT", "UNDETERMINED"];
      const CPs: Comparability[] = ["COMPARABLE", "NOT_COMPARABLE", "UNDETERMINED"];
      console.log(`\n${"═".repeat(116)}`);
      console.log("  [A/B 표] Identity × Comparability   🔴 Comparability owner = **운영 `DomesticPriceTier`**");
      console.log(`${"═".repeat(116)}`);
      console.log(
        `  ${pad("Identity", 14)}${pad("Comparability", 18)}${pad("후보", 6)}${pad("국내자격", 10)}${pad("국내 KRW", 11)}human 분포`,
      );
      for (const id of IDs) {
        for (const cp of CPs) {
          const set = rows.filter((r) => r.identity === id && r.comp === cp);
          if (set.length === 0) continue;
          const dom = set.filter((r) => r.domesticEligible);
          const krw = dom.map((r) => r.price).filter((x): x is number => typeof x === "number");
          const human = Object.entries(
            set.reduce<Record<string, number>>((acc, r) => {
              acc[r.p.human] = (acc[r.p.human] ?? 0) + 1;
              return acc;
            }, {}),
          )
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ");
          console.log(
            `  ${pad(id, 14)}${pad(cp, 18)}${padL(String(set.length), 4)}  ${padL(String(dom.length), 8)}  ` +
              `${pad(krw.length ? krw.map((x) => x.toLocaleString()).join(", ") : "—", 11)}${human}`,
          );
        }
      }

      /** ── 🔴 Q2 — DIFFERENT 가 가격 축에 들어가는가 ───────────────────── */
      const diffComparable = rows.filter((r) => r.identity === "DIFFERENT" && r.comp === "COMPARABLE");
      const humanDiffDomestic = rows.filter((r) => r.p.human === "DIFFERENT" && r.domesticEligible);
      console.log(`\n  🔴 **Q2** system DIFFERENT ∧ COMPARABLE = **${diffComparable.length}**`);
      console.log(`     🔴 human DIFFERENT ∧ 국내 가격 자격 = **${humanDiffDomestic.length}**`);
      for (const r of humanDiffDomestic) {
        console.log(`       🔴 ${pad(r.p.id, 8)}${pad(host(r.p.url), 22)}tier ${pad(r.tier, 12)}${r.currency} ${r.price}`);
      }

      /** ── 🔴 Q3 — UNDETERMINED 취급 ──────────────────────────────────── */
      const und = rows.filter((r) => r.identity === "UNDETERMINED");
      const undComparable = und.filter((r) => r.comp === "COMPARABLE");
      const undDomestic = und.filter((r) => r.domesticEligible);
      console.log(`\n  🔴 **Q3** system UNDETERMINED = ${und.length}`);
      console.log(`     그중 COMPARABLE        **${undComparable.length}**  ← 🔴 가격 축에 들어갈 수 있다`);
      console.log(`     그중 국내 가격 자격      **${undDomestic.length}**`);
      console.log(
        `  🔴🔴 **UNDETERMINED 를 SAME 으로 승격하지 않았다** — 위 숫자는 **현재 운영이 그렇게 한다** 는 관측이다` +
          `\n     (PRESUMED_SAME → matchTruth TEXT_CONFIRMED → tier **COMPARISON** 경로 · WU-123/125 가 지적한 그 모양)`,
      );

      /** ── 🟢 Q1 — SAME 이면 비교 가능한가 ────────────────────────────── */
      const same = rows.filter((r) => r.identity === "SAME");
      console.log(`\n  🟢 **Q1** system SAME = ${same.length}`);
      for (const cp of CPs) {
        const n = same.filter((r) => r.comp === cp).length;
        if (n) console.log(`     ${pad(cp, 18)}${n}`);
      }
      console.log(
        `  🔴 **세트/구성 차이 축은 이 분모에서 측정불가** — bornyesterdaykids 행이 **0건** 이고` +
          ` 운영에 「세트↔단품」을 가르는 술어가 **없다**(8축에 없다) ⟹ 지어내지 않았다`,
      );

      /** 🔴 발화 단언 */
      expect(usable.length, "🔴 라이브 facts 0 이면 측정불가(열화)").toBeGreaterThan(0);
      expect(rows.length).toBe(usable.length);
      console.log(`\n  🟢 HTTP ${urls.length} 회 · 운영 변경 0 · 새 enum 0 · 가격 계산식 0`);
    },
    15 * 60 * 1000,
  );
});
