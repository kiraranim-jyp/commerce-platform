import { describe, expect, it } from "vitest";
import {
  SAME05_PAIRS,
  fmtTally,
  isSystemSame,
  same05Judge,
  same05Tally,
  SAME05_BASELINE,
} from "./core-same05-gt";

/**
 * 🔵🔵🔵 CORE-PRICE-SAME-05 **STEP 1** — GT baseline 고정(네트워크 0 · 운영 변경 0)
 *
 * 🔴 적재·판정·집계는 `core-same05-gt.ts`(모듈)에 있다 — 반사실 파일이 **같은 분모** 를
 *    쓰게 하려고 갈랐다. 🔴 vitest 는 `*.test.ts` 만 수집하므로 그 모듈은 테스트로 돌지 않는다.
 */

describe("CORE-PRICE-SAME-05 STEP 1 — GT baseline (네트워크 0 · 운영 변경 0)", () => {
  it("분모가 실재하고 DIFFERENT 가 0 이 아니다 — 안전성을 «잴 수 있다»", () => {
    const t = same05Tally((p) => same05Judge(p.origin, p.facts).cross.verdict);
    console.log(`\n═══ STEP 1 baseline ═══`);
    console.log(`    쌍 전체 ${SAME05_PAIRS.length} (wu-059 ${SAME05_PAIRS.filter((p) => p.src === "wu-059").length} · wu-068 ${SAME05_PAIRS.filter((p) => p.src === "wu-068").length})`);
    console.log(`    ${fmtTally("baseline", t)}`);
    /**
     * 🔴🔴 **이것이 §8 의 안전장치다** — SAME-03 표본은 DIFFERENT 가 0 이라
     *    완화의 위험을 잴 수 없었다. 이 GT 는 **DIFFERENT 가 실재** 한다.
     */
    expect(t.gtDifferent, "🔴 DIFFERENT 분모가 0 이면 완화의 안전성을 측정할 수 없다").toBeGreaterThan(0);
    expect(t.gtSame).toBeGreaterThan(0);
    expect(t.gtSame + t.gtDifferent + t.gtUncertain).toBe(SAME05_PAIRS.length);
  });

  it("[기준선 고정] baseline 숫자를 계약으로 박는다 — 이후 STEP 이 이 분모를 쓴다", () => {
    const t = same05Tally((p) => same05Judge(p.origin, p.facts).cross.verdict);
    /** 🔴 이 숫자가 바뀌면 **운영 matcher 가 바뀐 것** 이다 — 그때 STEP 비교가 무효가 된다. */
    expect(t.gtSame).toBe(SAME05_BASELINE.same);
    expect(t.gtDifferent).toBe(SAME05_BASELINE.different);
    expect(t.gtUncertain).toBe(6);
    expect(SAME05_PAIRS).toHaveLength(33);
    /**
     * 🔴🔴🔴 **baseline FP 는 0 이 «아니다» — 2 다.** 내 1차 단언이 0 이었고 **틀렸다.**
     *
     * 두 건은 **이미 알려진 False EXACT** 이고 이 저장소가 기록해 둔 그 둘이다:
     * ```
     * C06  global.trenbe.com   WU-060 이 「현행 False EXACT 1건 · precision 11/12」로 적어 둔 그것
     * S1-6 www.tinyapple.net   WU-068 이 「새 False EXACT 1건 · C06 과 같은 클래스·같은 샵」
     * ```
     * 🔴 그래서 §12 의 PASS 기준은 「FP 0」이 아니라 **「FP 가 2 에서 늘지 않는다」** 다.
     *    🔴 **그 차이를 흐리면 완화가 통과해 버린다** — 기준선을 숫자로 박는다.
     */
    expect(t.falsePositive, "🔴 baseline FP 가 기준선에서 변했다 — 운영 matcher 가 바뀐 것이다").toBe(SAME05_BASELINE.fp);
    expect(t.truePositive).toBe(6);
    expect(t.falseNegative).toBe(12);
    expect(t.trueNegative).toBe(8);
  });

  /**
   * 🔴🔴🔴 **STEP 2 를 착수할 수 있는지가 이 분포로 결정된다.**
   *
   * CPO 는 `NO_TITLE_OVERLAP` 를 P0 로 지정했다. 🔴 그런데 그 축이 **이 GT 의 FN 을
   * 막고 있지 않다면**, TITLE normalization 의 **recall 효과를 이 GT 로 측정할 수 없다**
   * (그리고 안전성은 **이 GT 에만** DIFFERENT 가 있다).
   * 🔴 그 경우 「효과 0」이 아니라 **측정불가** 이고, 그것을 먼저 보고해야 한다.
   */
  it("[FN 원인 분포] 무엇이 FN 을 막는지 센다 — P0 축이 이 GT 에 있는가", () => {
    const fn = SAME05_PAIRS.filter((p) => p.human === "SAME" && !isSystemSame(same05Judge(p.origin, p.facts).cross.verdict));
    const blockerCount = new Map<string, number>();
    const conflictCount = new Map<string, number>();
    for (const p of fn) {
      const j = same05Judge(p.origin, p.facts);
      for (const b of j.cross.blockers) blockerCount.set(String(b.blocker), (blockerCount.get(String(b.blocker)) ?? 0) + 1);
      for (const c of j.cross.conflicts) conflictCount.set(String(c.conflict), (conflictCount.get(String(c.conflict)) ?? 0) + 1);
    }
    console.log(`\n═══ FN ${fn.length}건의 원인 분포 ═══`);
    for (const [k, v] of [...blockerCount].sort((a, b) => b[1] - a[1])) console.log(`    보류 ${k.padEnd(30)} ${v}`);
    for (const [k, v] of [...conflictCount].sort((a, b) => b[1] - a[1])) console.log(`    반증 ${k.padEnd(30)} ${v}`);
    const titleBlocked = blockerCount.get("NO_TITLE_OVERLAP") ?? 0;
    console.log(`\n    🔴 P0 축(NO_TITLE_OVERLAP)이 막는 FN = **${titleBlocked}** / ${fn.length}`);
    if (titleBlocked === 0) {
      console.log(`    🔴🔴 **이 GT 로는 TITLE normalization 의 recall 효과를 «측정할 수 없다»**`);
      console.log(`         (그리고 DIFFERENT 분모는 **이 GT 에만** 있다 ⟹ 안전성과 효과를 같은 분모에서 못 본다)`);
    }
    /** 🔴 분포를 **계약으로 고정** 한다 — 바뀌면 STEP 비교의 전제가 바뀐 것이다. */
    expect(fn.length).toBe(12);
    expect(blockerCount.get("BRAND_UNCONFIRMED") ?? 0).toBeGreaterThan(0);
  });

  it("[건별 기록] FN 과 DIFFERENT 방어를 같은 자리에서 적는다", () => {
    console.log(`\n═══ 건별 ═══`);
    for (const p of SAME05_PAIRS) {
      const j = same05Judge(p.origin, p.facts);
      const sys = j.cross.verdict;
      const mark =
        p.human === "SAME" ? (isSystemSame(sys) ? "🟢TP" : "🔴FN") : p.human === "DIFFERENT" ? (isSystemSame(sys) ? "🔴FP" : "🟢TN") : "⚪UNC";
      console.log(
        `    ${mark} ${p.id.padEnd(7)} ${p.domain.padEnd(26)} human=${p.human.padEnd(10)} ` +
          `sys=${sys.padEnd(14)} code=${j.code.padEnd(12)} truth=${j.truth.padEnd(22)} tier=${j.tier.padEnd(11)} ` +
          `보류=${j.cross.blockers.map((b) => b.blocker).join(",") || "-"} 반증=${j.cross.conflicts.map((c) => c.conflict).join(",") || "-"}`,
      );
    }
  });

  /**
   * 🔴🔴🔴 **§10 이 통과를 요구한 필수 안전 케이스를 «실측으로» 특정한다.**
   *
   * 지시서: 「`model-code exact + human DIFFERENT` 케이스는 반드시 포함한다.
   *          이 케이스를 통과하지 못하면 구현을 진행하지 않는다.」
   * 🔴 그 케이스가 **이 GT 에 실재하는지** 를 가정하지 않고 센다 — 없으면 **측정불가** 다.
   */
  it("[필수 안전 케이스] model-code exact + human DIFFERENT 를 센다", () => {
    const guarded = SAME05_PAIRS.filter((p) => p.human === "DIFFERENT" && same05Judge(p.origin, p.facts).code === "exact");
    console.log(`\n═══ 필수 안전 케이스(model-code exact + human DIFFERENT) ═══  ${guarded.length}건`);
    for (const p of guarded) {
      const j = same05Judge(p.origin, p.facts);
      console.log(
        `    ${p.id.padEnd(7)} ${p.domain.padEnd(26)} sys=${j.cross.verdict.padEnd(14)} ` +
          `막는 것 = 보류[${j.cross.blockers.map((b) => b.blocker).join(",") || "-"}] 반증[${j.cross.conflicts.map((c) => c.conflict).join(",") || "-"}]`,
      );
      /** 🔴 baseline 에서 이 케이스는 **SAME 이 아니어야** 한다(그것이 보호의 현재 상태다). */
      expect(isSystemSame(j.cross.verdict), `🔴 ${p.id} 가 baseline 에서 이미 FP 다`).toBe(false);
    }
    /** 🔴 0 이면 「안전하다」가 아니라 **그 케이스를 이 GT 로 못 지킨다** 는 뜻이다. */
    if (guarded.length === 0) {
      console.log(`    🔴🔴 **측정불가** — 이 GT 에 그 모양이 없다. 다른 GT 를 찾거나 CPO 에게 올린다.`);
    }
  });
});
