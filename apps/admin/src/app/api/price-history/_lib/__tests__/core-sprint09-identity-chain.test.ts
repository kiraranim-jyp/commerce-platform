import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS, type Same05Pair } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-09 — **Universal Identity Evidence Chain**(측정 only)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **운영 변경 0 · 네트워크 0.** threshold · `SAME_MIN_AXES` · `NO_TITLE_OVERLAP` ·
 *    MODEL_CODE conflict · BRAND policy · 새 axis — **전부 변경 0**.
 *
 * ── 🔴 CPO 가 고정한 Evidence hierarchy ─────────────────────────────────────────
 * ```
 * ① TITLE → ② BRAND → ③ MODEL_CODE → ④ DESCRIPTION → ⑤ COLOR/MATERIAL → ⑥ IMAGE
 * 가장 강한 규칙 —  **BRAND + MODEL_CODE exact ⟹ SAME**
 * ```
 *
 * ── 🔴🔴🔴 **그 규칙은 «과거에 있었고 CEO 가 폐기했다»** ─────────────────────────
 * ```
 * `cross-seller.ts:36-48` 원문:
 *   「MATCHING-3.1(CEO 지시, 2026-09-14). 여기에는 원래 `if (identifierConfirmed)
 *     return "SAME"` 한 줄이 있었다 … 그 전제가 실측 데이터에서 깨진다.
 *     junioredition.com 은 서로 다른 두 상품에 **글자 하나까지 같은 Product Code** 를 적는다」
 *     Minnie Newborn Body / Onesie                      둘 다 KS106168-P05261
 *     Bubble Sweatshirt Grey Melange / Graystone / Conker  둘 다 **AW26MS185**
 *     Giulia Flower Sandals 3색                          전부 01325
 * ⟹ 🔴 그리고 그 반례는 **같은 브랜드 안** 에서 일어난다 ⟹ **BRAND 를 더해도 막히지 않는다**
 *    (폐기된 것은 `identifierConfirmed` «단독» 이지만, 반례의 세 세트는 모두 동일 브랜드다)
 * ```
 * 🟢 그래서 이 하니스는 **그 반례가 현재 GT 안에 실재하는지** 를 센다 — 그것이
 *    CPO 규칙의 **실제 위험 건수** 다. 🔴 CTO 는 규칙을 구현하지도 거부하지도 않는다.
 */

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

function evaluate(p: Same05Pair) {
  const cross = compareCrossSellerProducts(p.origin, p.facts);
  const code = String(compareModelCode(p.origin.brandModelCode, p.facts.brandModelCode ?? null));
  return {
    verdict: String(cross.verdict),
    blockers: (cross.blockers ?? []).map((b) => String(b.blocker)),
    conflicts: (cross.conflicts ?? []).map((c) => String(c.conflict)),
    axes: (cross.axes ?? []).map((a) => `${String(a.axis)}:${a.points}`),
    code,
  };
}

/** 🔴 CPO 규칙의 전제 — **양쪽 brand 가 있고 호환되며 품번이 exact** 일 때. */
function cpoStrongEvidence(p: Same05Pair): boolean {
  const ob = norm(p.origin.brand);
  const cb = norm(p.facts.brand);
  if (!ob || !cb) return false;
  if (ob !== cb && !ob.includes(cb) && !cb.includes(ob)) return false;
  return evaluate(p).code === "exact";
}

describe("CORE-SAME-SPRINT-09 — Identity Evidence Chain(측정 only · 네트워크 0)", () => {
  it("[STEP 1] 현재 판정 구조가 «계층» 인가 «점수 누적» 인가 — 코드에서 읽은 사실", () => {
    /**
     * 🔴🔴 `cross-seller.ts:1200-1205` 실제 구조:
     * ```
     * const blocked = blockers.length > 0;
     * if (!blocked && brandOk && corePoints >= SAME_MIN_AXES) return "SAME";
     * if (totalPoints >= PRESUMED_SAME_MIN_AXES && !sameSellerWithoutIdentity) return "PRESUMED_SAME";
     * if (totalPoints >= 1) return "SIMILAR";
     * return "UNKNOWN";
     * ```
     * 🔴 그 위에 `conflicts.length > 0` 이면 **점수를 보기 전에** CONFLICT 로 끝난다.
     */
    console.log(`\n${"═".repeat(112)}`);
    console.log("  [STEP 1] 현재 Identity Decision Architecture — 🔴 **계층이 아니라 점수 누적** 이다");
    console.log(`${"═".repeat(112)}`);
    console.log(`  ① conflicts > 0            → **CONFLICT**(점수를 보기 전 early return · axes 계산 0)`);
    console.log(`  ② blockers 0 ∧ brandOk ∧ corePoints ≥ SAME_MIN_AXES → **SAME**`);
    console.log(`  ③ totalPoints ≥ PRESUMED_SAME_MIN_AXES              → **PRESUMED_SAME**`);
    console.log(`  ④ totalPoints ≥ 1                                   → SIMILAR     ⑤ 그 외 UNKNOWN`);
    console.log(
      `\n  🔴🔴 그래서 CPO 의 「BRAND + MODEL_CODE exact ⟹ SAME」은 **현재 구조에 없다**.` +
        `\n     품번은 **가장 큰 점수를 받는 축**(IDENTIFIER_AXIS_POINTS)일 뿐 **면제권이 아니다**` +
        "\n     — cross-seller.ts:1197 주석: 「품번이 일치해도 여기를 지나간다. **예외가 없다**」",
    );
    console.log(
      `\n  🔴🔴🔴 **그 예외는 과거에 «있었고 CEO 가 폐기했다»**(MATCHING-3.1 · 2026-09-14)` +
        `\n     폐기 근거 = junioredition.com 이 **서로 다른 상품에 글자까지 같은 품번** 을 적는다` +
        `\n       Minnie Newborn Body / Onesie            둘 다 KS106168-P05261` +
        `\n       Bubble Sweatshirt Grey/Graystone/Conker 둘 다 **AW26MS185**` +
        `\n       Giulia Flower Sandals 3색                전부 01325` +
        `\n     🔴 세 세트 모두 **같은 브랜드 안** 이다 ⟹ **BRAND 를 더해도 그 반례는 막히지 않는다**`,
    );
  });

  it("[STEP 2] CPO 규칙의 «실제 위험 건수» — GT 에 그 반례가 있는가", () => {
    const strong = SAME05_PAIRS.filter(cpoStrongEvidence);
    const wouldBeSame = strong.filter((p) => !["SAME"].includes(evaluate(p).verdict));
    const humanDiff = strong.filter((p) => p.human === "DIFFERENT");
    const humanUnc = strong.filter((p) => p.human === "UNCERTAIN");

    console.log(`\n${"═".repeat(112)}`);
    console.log(`  [STEP 2] **BRAND 호환 ∧ MODEL_CODE exact** 인 쌍 = ${strong.length}/${SAME05_PAIRS.length}`);
    console.log(`${"═".repeat(112)}`);
    console.log(`  ${pad("건", 8)}${pad("host", 22)}${pad("human", 11)}${pad("현재 verdict", 16)}blockers / conflicts`);
    for (const p of strong) {
      const e = evaluate(p);
      console.log(
        `  ${pad(p.id, 8)}${pad(host(p.facts.sourceUrl), 22)}${pad(p.human, 11)}${pad(e.verdict, 16)}` +
          `[${e.blockers.join(" · ")}] / [${e.conflicts.join(" · ")}]`,
      );
      console.log(`      brand  ${JSON.stringify(p.origin.brand)} ↔ ${JSON.stringify(p.facts.brand)}`);
      console.log(`      code   ${JSON.stringify(p.origin.brandModelCode)} ↔ ${JSON.stringify(p.facts.brandModelCode)}`);
      console.log(`      axes   [${e.axes.join(" · ")}]`);
    }

    console.log(`\n  🔵 **CPO 규칙을 적용하면 바뀌는 것**`);
    console.log(`     현재 SAME 이 아닌데 SAME 이 될 쌍   **${wouldBeSame.length}**/${strong.length}`);
    console.log(`     🔴 그중 human **DIFFERENT**          **${humanDiff.length}**  ← False SAME 이 된다`);
    console.log(`     🟡 그중 human UNCERTAIN              ${humanUnc.length}`);
    for (const p of humanDiff) {
      const e = evaluate(p);
      console.log(
        `       🔴 ${pad(p.id, 8)}${pad(host(p.facts.sourceUrl), 22)}현재 ${pad(e.verdict, 16)}` +
          `code ${JSON.stringify(p.facts.brandModelCode)}`,
      );
    }
    if (strong.length === 0) {
      console.log(
        `\n  🔴🔴 **측정불가** — 이 GT 에 「BRAND 호환 ∧ 품번 exact」 쌍이 **0건** 이다.` +
          `\n     ⟹ CPO 규칙의 위험도를 **이 분모로는 판정할 수 없다**. 「안전하다」로 적지 않는다.`,
      );
    }

    /** 🔴 발화 단언 — 분모가 0 이면 위 숫자를 safety 근거로 쓰지 않는다. */
    console.log(
      `\n  🔴 분모 주의 — 이 GT 는 **품번이 9/33 밖에 없다**(SPRINT-07) ⟹ 「강한 증거」 쌍 자체가 적다.` +
        ` 🔴 그래서 이 숫자를 **전수 위험도로 일반화하지 않는다**.`,
    );
  });

  it("[STEP 3] CPO 7개 케이스를 현재 코드로 분류한다 — 어디서 멈추는가", () => {
    type Bucket =
      | "①② BRAND+CODE exact"
      | "③ BRAND만(code 없음)"
      | "④ CODE만(brand 없음)"
      | "⑤ 둘 다 없음"
      | "⑥ CODE conflict"
      | "⑦ 그 외";
    const classify = (p: Same05Pair): Bucket => {
      const e = evaluate(p);
      const hasB = Boolean(norm(p.origin.brand) && norm(p.facts.brand));
      if (e.code === "conflict") return "⑥ CODE conflict";
      if (hasB && e.code === "exact") return "①② BRAND+CODE exact";
      if (hasB && e.code !== "exact") return "③ BRAND만(code 없음)";
      if (!hasB && e.code === "exact") return "④ CODE만(brand 없음)";
      if (!hasB && e.code === "unavailable") return "⑤ 둘 다 없음";
      return "⑦ 그 외";
    };
    const table = new Map<Bucket, { n: number; same: number; human: Record<string, number> }>();
    for (const p of SAME05_PAIRS) {
      const b = classify(p);
      const cur = table.get(b) ?? { n: 0, same: 0, human: {} };
      cur.n += 1;
      if (evaluate(p).verdict === "SAME") cur.same += 1;
      cur.human[p.human] = (cur.human[p.human] ?? 0) + 1;
      table.set(b, cur);
    }
    console.log(`\n${"═".repeat(112)}`);
    console.log("  [STEP 3] Evidence Chain 단계별 — 🔴 **현재 코드가 어디서 멈추는가**");
    console.log(`${"═".repeat(112)}`);
    console.log(`  ${pad("단계", 26)}${pad("쌍", 5)}${pad("현재 SAME", 11)}human 분포`);
    for (const [k, v] of [...table.entries()].sort((a, b) => b[1].n - a[1].n)) {
      const h = Object.entries(v.human)
        .map(([kk, vv]) => `${kk} ${vv}`)
        .join(" · ");
      console.log(`  ${pad(k, 26)}${pad(String(v.n), 5)}${pad(String(v.same), 11)}${h}`);
    }

    /** 🔴 알려진 사례를 **이름으로** 넣는다(CPO STEP 3). */
    console.log(`\n  🔴 알려진 사례 추적`);
    for (const key of ["biskuit", "luxboy", "donokids", "beaumonde", "main-story", "junioredition"]) {
      const rows = SAME05_PAIRS.filter((p) => host(p.facts.sourceUrl).includes(key));
      if (rows.length === 0) {
        console.log(`     ${pad(key, 16)}🔴 이 GT 에 **없다**(측정불가)`);
        continue;
      }
      for (const p of rows) {
        const e = evaluate(p);
        console.log(
          `     ${pad(key, 16)}${pad(p.id, 8)}[human ${pad(p.human, 10)}] ${pad(e.verdict, 16)}` +
            `code ${pad(e.code, 13)}blockers [${e.blockers.join(" · ")}]`,
        );
      }
    }
    expect(SAME05_PAIRS.length).toBeGreaterThan(0);
  });
});
