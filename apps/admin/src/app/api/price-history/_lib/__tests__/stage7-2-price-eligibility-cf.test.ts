import { describe, expect, it } from "vitest";
import { hasObservedDifference } from "@commerce/crawler/src/comparison-search/cross-seller";
import { SAME05_PAIRS, same05Judge } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 7-2 **반사실 측정** — 「노출 등급 ↔ 가격 자격 분리」의 효과를 «먼저 잰다»
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 실행 우선순위 2 의 과제: 「`PRESUMED_SAME → TEXT_CONFIRMED → COMPARISON`
 *    경로가 **DIFFERENT 사례 4건을 금액 집계로 유입** 시키는 문제를 해결하라.
 *    🔴 후보를 **숨겨서** 해결하지 말고, **노출은 유지하고 가격의 의미와 집계 자격을 분리** 하라.」
 *
 * 🔴🔴 **구현 전에 분모를 잡는다**(헌장 §5-B). 재는 것은 **둘** 이다:
 * ```
 * ① 사람 DIFFERENT 가 금액 자격을 얻는가 (정밀도)
 * ② 사람 SAME 을 잃는가               (재현 손실)   🔴 둘을 «같이» 본다
 * ```
 *
 * 🟢 **새 축을 만들지 않는다.** 후보 술어는 **이미 있는 `hasObservedNifference`** 다 —
 *    「양쪽에서 **서로 다른 값을 읽었다**」와 「**읽지 못했다**」를 가르는 owner 이고,
 *    `BRAND_UNCONFIRMED` 를 **의도적으로 제외** 한다(「모르는 것을 반증으로 쓰지 않는다」).
 * 🔴 그 분류표(`OBSERVED_DIFFERENCE_BLOCKERS`)를 **고치지 않는다** — Identity 정책이다.
 *
 * 🔴 이 파일은 **측정 전용** 이다(운영 변경 0 · 네트워크 0 · 저장 GT 33쌍).
 */

/** 🔴 운영 집계가 쓰는 그 집합(candidate-market.ts 와 **같은 값** · 사본임을 적어 둔다). */
const PRICE_ELIGIBLE_VERDICTS = new Set(["SAME", "PRESUMED_SAME"]);
/** 🟢 금액 자격 tier — 국내 `EXACT|COMPARISON` · 해외는 `EXCLUDED` 만 뺀다. */
const MONEY_TIERS = new Set(["EXACT", "COMPARISON"]);

describe("STAGE 7-2 — 반사실: 「관측된 차이가 있으면 금액 자격을 주지 않는다」", () => {
  it("저장 GT 33쌍에서 정밀도와 재현 손실을 «같이» 센다", () => {
    const rows = SAME05_PAIRS.filter((p) => p.human === "SAME" || p.human === "DIFFERENT").map((p) => {
      const j = same05Judge(p.origin, p.facts);
      const blockers = (j.cross.blockers ?? []) as { blocker: string }[];
      return {
        id: p.id,
        domain: p.domain,
        human: p.human,
        verdict: String(j.cross.verdict),
        tier: String(j.tier),
        blockers: blockers.map((b) => b.blocker),
        observed: hasObservedDifference(blockers as never),
      };
    });

    const base = (r: (typeof rows)[number]) =>
      MONEY_TIERS.has(r.tier) && PRICE_ELIGIBLE_VERDICTS.has(r.verdict);
    /** 🔵 반사실 A — 기존 술어 **전체** 를 금액 자격에만 더한다(tier·verdict 는 불변). */
    const cf = (r: (typeof rows)[number]) => base(r) && !r.observed;
    /**
     * 🔵🔵 반사실 B — **「상대가 스스로 다르다고 말한」 축만** 쓴다.
     *
     * 🔴 왜 A 를 그대로 쓰지 않는가 — 운영 실측에서 A 가 **같은 브랜드·같은 제목** 후보를
     *    떨어뜨렸다:
     * ```
     * B226AC033 junioredition 「Bobo Choses Pop Sweatshirt by Bobo Choses」 GBP 58
     *           VERIFIED_CURRENT · 보류 **[MATERIAL]** 하나 ⟹ A 에서 탈락
     * B226AC110 junioredition 「Bobo Choses Embossed T-Shirt by Bobo Choses」 GBP 37
     *           VERIFIED_CURRENT · 보류 **[MODEL_CODE_AGE_LINE]** ⟹ A 에서 탈락
     *           🔴 그 축(AC↔AB)은 **CEO 가 SAME 이라 라벨한** 축이다
     * ```
     * 🟢 B 의 세 축은 **상대가 스스로 적은 사실** 이다 — 브랜드가 달랐다 · 제목이 하나도
     *    겹치지 않았다 · **같은 판매처가 다른 상품으로 진열했다**.
     * 🔴 소재/핏/사이즈/형태/연령라인은 **표기·정규화·정책 축** 이라 뺀다(CPO ③④⑤⑥).
     */
    const SELF_DECLARED = new Set(["BRAND_MISMATCH", "NO_TITLE_OVERLAP", "SAME_SELLER_DISTINCT_LISTING"]);
    const cfB = (r: (typeof rows)[number]) => base(r) && !r.blockers.some((b) => SELF_DECLARED.has(b));

    const tally = (f: (r: (typeof rows)[number]) => boolean) => ({
      same: rows.filter((r) => r.human === "SAME" && f(r)).length,
      diff: rows.filter((r) => r.human === "DIFFERENT" && f(r)).length,
    });
    const b = tally(base);
    const a = tally(cf);
    const nSame = rows.filter((r) => r.human === "SAME").length;
    const nDiff = rows.filter((r) => r.human === "DIFFERENT").length;

    console.log(`\n${"═".repeat(96)}`);
    console.log("  STAGE 7-2 반사실 — 금액 자격(EXACT|COMPARISON × verdict 적격)");
    console.log(`${"═".repeat(96)}`);
    console.log(`  분모  사람 SAME ${nSame} · 사람 DIFFERENT ${nDiff}  🔴 (저장 GT 33쌍 · 시스템 전체 아님)`);
    console.log(`  현행  SAME ${b.same}/${nSame} 진입 · 🔴 DIFFERENT ${b.diff}/${nDiff} 진입`);
    console.log(`  반사실 SAME ${a.same}/${nSame} 진입 · 🔴 DIFFERENT ${a.diff}/${nDiff} 진입`);
    const c = tally(cfB);
    console.log(`  반사실B SAME ${c.same}/${nSame} 진입 · 🔴 DIFFERENT ${c.diff}/${nDiff} 진입`);
    console.log(
      `  정밀도 현행 ${b.same}/${b.same + b.diff} → A **${a.same}/${a.same + a.diff}** → B **${c.same}/${c.same + c.diff}**`,
    );
    console.log(`  재현   현행 ${b.same}/${nSame} → A **${a.same}/${nSame}** → B **${c.same}/${nSame}**`);
    console.log(`\n  🔵 B 에서만 바뀌는 행`);
    for (const r of rows) {
      if (base(r) === cfB(r)) continue;
      console.log(
        `    ${r.id.padEnd(6)} ${r.domain.padEnd(24)} human=${r.human.padEnd(10)} 보류[${r.blockers.join("·")}]`,
      );
    }
    console.log(`\n  🔵 A 가 막는데 B 는 막지 «않는» 행(= B 가 지키는 것)`);
    for (const r of rows) {
      if (cf(r) || !cfB(r)) continue;
      console.log(
        `    ${r.id.padEnd(6)} ${r.domain.padEnd(24)} human=${r.human.padEnd(10)} 보류[${r.blockers.join("·")}]`,
      );
    }

    console.log(`\n  🔴 바뀌는 행(전부 적는다)`);
    for (const r of rows) {
      if (base(r) === cf(r)) continue;
      console.log(
        `    ${r.id.padEnd(6)} ${r.domain.padEnd(24)} human=${r.human.padEnd(10)} ` +
          `${r.verdict.padEnd(14)} tier=${r.tier.padEnd(11)} 보류[${r.blockers.join("·")}]`,
      );
    }

    console.log(`\n  🔵 바뀌지 «않는» 사람 DIFFERENT — 남는 오포함`);
    for (const r of rows) {
      if (r.human !== "DIFFERENT" || !cf(r)) continue;
      console.log(`    ${r.id.padEnd(6)} ${r.domain.padEnd(24)} 보류[${r.blockers.join("·") || "-"}]`);
    }

    /** 🔴 PASS 조건은 **측정이 돌았다** 는 것뿐이다 — 숫자를 여기서 고정하지 않는다. */
    expect(nSame + nDiff).toBeGreaterThan(0);
  });
});
