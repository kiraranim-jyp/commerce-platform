import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { extractDetailModelCodes } from "@commerce/crawler/src/comparison-search/model-code-from-detail";
import { lookupBrandByAliasInTitle } from "@commerce/crawler/src/comparison-search/brand-alias";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS, type Same05Pair } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-10 — **Description Evidence Chain**(측정 · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 변경 0.** `identifierConfirmed → SAME` 복구 ❌ · `SAME_MIN_AXES` 하향 ❌ ·
 *    `NO_TITLE_OVERLAP` ❌ · MODEL_CODE conflict ❌ · seller name → brand ❌ ·
 *    COLOR/MATERIAL 축 승격 ❌ · IMAGE scoring ❌. 🔴 **MATCHING-3.1 유지**(SPRINT-09 판정).
 *
 * ── 🔴🔴 **왜 라이브 재수집인가 — 저장 GT 로는 «구조적으로» 측정 불가** ──────────
 * ```
 * 저장 facts 의 `description` = **0/33**(SPRINT-03 이전 스냅샷 · SPRINT-04 실측)
 * ⟹ 그 분모에서 「description 효과」를 재면 **언제나 0** 이고 그것은 제품 사실이 아니다
 * 🟢 그래서 운영 `factsFromProductUrl` 로 **지금 다시 수집** 한다(= 운영 경로 그대로)
 * ```
 *
 * ── 🔴 CPO 지시 — 이미 production 에 있는 recovery 는 «추정하지 말고 다시 확인» ──
 * ```
 * `recoverModelCodeFromDetail` 은 **이미 배선돼 있다**(Shopify SPRINT-02 · HTML SPRINT-06)
 * ⟹ 라이브 산출의 `brandModelCode` 에는 **그 효과가 이미 들어 있다**
 * ⟹ BEFORE 를 만들려면 **그 복원을 되돌려야** 한다(SPRINT-04 에서 한 번 틀린 자리)
 * ```
 */

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;
const frac = (n: number, d: number) => (d === 0 ? "—" : `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`);
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};

function verdictOf(origin: ProductFacts, cand: ProductFacts) {
  const cross = compareCrossSellerProducts(origin, cand);
  return {
    verdict: String(cross.verdict),
    blockers: (cross.blockers ?? []).map((b) => String(b.blocker)),
    code: String(compareModelCode(origin.brandModelCode, cand.brandModelCode ?? null)),
  };
}
const isSame = (v: string) => v === "SAME";

/**
 * 🔴 **BRAND recovery 는 production 에 «없다»** — description 에서 브랜드를 찾는 경로가
 *    코드에 0 이다(SPRINT-08 에서 source hierarchy 를 전수 확인했다).
 * 🟢 그래서 counterfactual 로만 잰다 — **등록부 alias 를 description 에 적용**(새 사전 **0**).
 * 🔴 seller/store name 승격 **0** · fuzzy/substring **0**.
 */
const brandFromDescription = (f: ProductFacts): string | null =>
  /** 🔴 그 함수는 `string | undefined` 를 낸다 — `?? null` 로 모양을 맞춘다(typecheck 가 잡았다). */
  f.description ? lookupBrandByAliasInTitle(f.description) ?? null : null;

const LIVE = process.env.CORE_SPRINT10_LIVE === "1";

describe.skipIf(!LIVE)("CORE-SAME-SPRINT-10 — Description Evidence Chain(라이브 · 운영 변경 0)", () => {
  it(
    "description 에서 BRAND/MODEL_CODE 를 보강하면 Identity 가 얼마나 바뀌는가",
    async () => {
      const urls = [...new Set(SAME05_PAIRS.map((p) => p.url))];
      const live = new Map<string, { path: string; status: string; facts: ProductFacts | null }>();
      for (const url of urls) {
        try {
          const r = (await factsFromProductUrl(url)) as unknown as Record<string, unknown>;
          const cand = r.candidate as Record<string, unknown> | undefined;
          live.set(url, {
            path: String(r.fetchPath ?? "UNRESOLVED"),
            status: String(r.status ?? "?"),
            facts: (cand?.facts as ProductFacts | undefined) ?? null,
          });
        } catch (e) {
          live.set(url, { path: "UNRESOLVED", status: `THREW(${(e as Error).message.slice(0, 20)})`, facts: null });
        }
      }

      /** 🔴 facts 를 못 얻은 쌍은 **분모에서 뺀다**(「효과 0」으로 세지 않는다). */
      const usable = SAME05_PAIRS.filter((p) => live.get(p.url)?.facts);
      const skipped = SAME05_PAIRS.length - usable.length;

      /**
       * 🔴🔴 **BEFORE 복원** — 라이브 산출은 recovery 가 **이미 적용된 뒤** 다.
       *    「설명문의 단일 품번 == 산출 품번」이면 **그 값은 recovery 가 넣은 것** 이다.
       */
      const beforeFacts = (p: Same05Pair): ProductFacts => {
        const f = live.get(p.url)!.facts as ProductFacts;
        const fromDesc = extractDetailModelCodes(f.description);
        const added = fromDesc.length === 1 && f.brandModelCode === fromDesc[0];
        return { ...f, description: null, brandModelCode: added ? null : f.brandModelCode };
      };
      /** AFTER-code = 운영 그대로(이미 배선됨). AFTER-brand = + description brand(counterfactual). */
      const afterCode = (p: Same05Pair): ProductFacts => live.get(p.url)!.facts as ProductFacts;
      const afterBoth = (p: Same05Pair): ProductFacts => {
        const f = afterCode(p);
        return f.brand ? f : { ...f, brand: brandFromDescription(f) ?? null };
      };

      /** ── 공급 분해(CPO 표) ──────────────────────────────────────────── */
      const withDesc = usable.filter((p) => afterCode(p).description);
      const descHasCode = withDesc.filter((p) => extractDetailModelCodes(afterCode(p).description).length === 1);
      const descHasBrand = withDesc.filter((p) => brandFromDescription(afterCode(p)));
      const descHasBoth = withDesc.filter(
        (p) => extractDetailModelCodes(afterCode(p).description).length === 1 && brandFromDescription(afterCode(p)),
      );
      console.log(`\n${"═".repeat(112)}`);
      console.log("  [공급] description 안의 Evidence   🔴 분모를 같이 적는다");
      console.log(`${"═".repeat(112)}`);
      console.log(`  GT 쌍 ${SAME05_PAIRS.length} · 라이브 facts 확보 **${usable.length}** · 🔴 제외 ${skipped}(분모 밖)`);
      console.log(`  description 존재            ${frac(withDesc.length, usable.length)}`);
      console.log(`  그중 MODEL_CODE 단일 존재    ${frac(descHasCode.length, withDesc.length)}`);
      console.log(`  그중 BRAND 존재(등록부 alias) ${frac(descHasBrand.length, withDesc.length)}`);
      console.log(`  둘 다 존재                  ${frac(descHasBoth.length, withDesc.length)}`);

      /** ── 실제 recovery 건수 ─────────────────────────────────────────── */
      const codeRecovered = usable.filter((p) => !beforeFacts(p).brandModelCode && afterCode(p).brandModelCode);
      const brandRecovered = usable.filter((p) => !afterCode(p).brand && afterBoth(p).brand);
      console.log(`\n  🟢 **실제 recovery**(운영 경로)  MODEL_CODE **${codeRecovered.length}**/${usable.length}`);
      for (const p of codeRecovered) {
        console.log(`     ${pad(p.id, 8)}${pad(host(p.url), 24)}${afterCode(p).brandModelCode}  [human ${p.human}]`);
      }
      console.log(`  🟡 **counterfactual** BRAND(production 에 없다)  **${brandRecovered.length}**/${usable.length}`);
      for (const p of brandRecovered) {
        console.log(`     ${pad(p.id, 8)}${pad(host(p.url), 24)}${afterBoth(p).brand}  [human ${p.human}]`);
      }

      /** ── Identity 효과 ──────────────────────────────────────────────── */
      interface T {
        tp: number;
        fn: number;
        fp: number;
        tn: number;
        und: number;
        undSame: number;
        conflict: number;
      }
      const tally = (pick: (p: Same05Pair) => ProductFacts): T => {
        const t: T = { tp: 0, fn: 0, fp: 0, tn: 0, und: 0, undSame: 0, conflict: 0 };
        for (const p of usable) {
          const v = verdictOf(p.origin, pick(p));
          if (v.code === "conflict") t.conflict += 1;
          const same = isSame(v.verdict);
          if (p.human === "SAME") same ? (t.tp += 1) : (t.fn += 1);
          else if (p.human === "DIFFERENT") same ? (t.fp += 1) : (t.tn += 1);
          else {
            t.und += 1;
            if (same) t.undSame += 1;
          }
        }
        return t;
      };
      const B = tally(beforeFacts);
      const C = tally(afterCode);
      const BR = tally(afterBoth);

      console.log(`\n${"═".repeat(112)}`);
      console.log("  [Identity 효과]   🔴 `DIFFERENT → SAME` 은 **반드시** 본다");
      console.log(`${"═".repeat(112)}`);
      console.log(
        `  ${pad("단계", 36)}${pad("SAME 회복", 12)}${pad("🔴 DIFF→SAME", 14)}${pad("SAME 손실", 11)}${pad("UND(sysSAME)", 14)}conflict`,
      );
      const row = (label: string, t: T) =>
        console.log(
          `  ${pad(label, 36)}${pad(`${t.tp}/${t.tp + t.fn}(${t.tp - B.tp >= 0 ? "+" : ""}${t.tp - B.tp})`, 12)}` +
            `${pad(`${t.fp - B.fp >= 0 ? "+" : ""}${t.fp - B.fp}`, 14)}${pad(String(Math.max(0, B.tp - t.tp)), 11)}` +
            `${pad(`${t.und}(${t.undSame})`, 14)}${t.conflict}`,
        );
      row("BEFORE (description 없음)", B);
      row("AFTER-① code recovery (운영)", C);
      row("AFTER-② + brand recovery (CF)", BR);

      /** ── 🔴 safety gate ─────────────────────────────────────────────── */
      console.log(`\n  🔴 **safety** — DIFFERENT → SAME`);
      console.log(`     ① code recovery(운영)    ${C.fp - B.fp}`);
      console.log(`     ② + brand recovery(CF)   ${BR.fp - C.fp}  (①대비)`);
      console.log(
        `  🔴 **conflict 변화** ${B.conflict} → ${C.conflict} → ${BR.conflict}` +
          `  — 늘어나는 것은 **보호가 강해지는 방향** 이다(SPRINT-02/06 과 같은 모양)`,
      );
      if (codeRecovered.length === 0 && brandRecovered.length === 0) {
        console.log(`\n  🔴🔴 **측정불가** — recovery 가 하나도 발화하지 않았다. 「효과 0」으로 적지 않는다.`);
      }

      /** 🔴 발화 단언 — 분모가 비면 위 숫자가 전부 무의미하다. */
      expect(usable.length, "🔴 라이브 facts 가 0 이면 측정불가(열화)").toBeGreaterThan(0);
      expect(withDesc.length, "🔴 description 이 0 이면 이 Sprint 가 성립하지 않는다").toBeGreaterThan(0);
      /** 🔴🔴 **CPO safety gate** — 운영 경로에서 DIFFERENT 가 열리면 즉시 문제다. */
      expect(C.fp - B.fp, "🔴🔴 운영 code recovery 가 DIFFERENT 를 열었다").toBeLessThanOrEqual(0);
      console.log(`\n  🟢 HTTP ${urls.length} 회 · 운영 변경 0 · MATCHING-3.1 불변`);
    },
    15 * 60 * 1000,
  );
});
