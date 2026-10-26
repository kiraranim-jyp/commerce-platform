import { describe, expect, it } from "vitest";
import { SAME05_PAIRS, type Same05Pair, same05Judge } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-02 **STEP 1~3** — 「Brand + 제품명」 12건 분리가능성 측정
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 측정이 스프린트의 성립 여부를 결정한다.** CPO 목표는
 *    「**SAME 을 유지하면서 DIFFERENT 를 차단할 공통 증거 조합**」이다.
 *    🔴 분모는 **SAME 10 · DIFFERENT 2**(CORE-DESC-REVIEW 재라벨 뒤 · 원래 9/3 이었다).
 *    ⟹ 🔴 그런 조합이 **존재하는지** 가 먼저다. 없으면 개선안은 성립하지 않는다.
 * 🟢 선례 — WU-093 이 「축 문자열이 글자 그대로 같아 **구별 불가**」를 측정하고
 *    「완화 = False SAME +1」로 닫았다. 그 모양인지 **먼저** 확인한다.
 * 🔴 운영 변경 0 · matcher 0 · threshold 0 · 새 GT 0 · 네트워크 0.
 */

type Row = { p: Same05Pair; j: ReturnType<typeof same05Judge> };
const ROWS: Row[] = SAME05_PAIRS.map((p) => ({ p, j: same05Judge(p.origin, p.facts) }));

const bk = (r: Row, n: string) => r.j.cross.blockers.some((b) => String(b.blocker) === n);
const ax = (r: Row, n: string) => r.j.cross.axes.find((a) => String(a.axis) === n);

/** 🔴 CPO 가 지목한 그 집합 — `code unavailable` + TITLE 축 있음 + BRAND 보류 없음. */
const COHORT = ROWS.filter(
  (r) => r.j.code === "unavailable" && ax(r, "TITLE") && !bk(r, "BRAND_UNCONFIRMED") && !bk(r, "BRAND_MISMATCH"),
);

/** 🔴 **값을 지어내지 않는다** — 없으면 `null` 로 적는다. */
const v = (x: unknown): string => {
  if (Array.isArray(x)) return x.length ? x.join("/") : "∅";
  const s = x == null ? "" : String(x).trim();
  return s ? s : "∅";
};

describe("CORE-SAME-SPRINT-02 — 「Brand + 제품명」 집합의 분리가능성(네트워크 0)", () => {
  it("[분모 확인] CPO 가 지목한 12건이 재현된다", () => {
    const S = COHORT.filter((r) => r.p.human === "SAME").length;
    const D = COHORT.filter((r) => r.p.human === "DIFFERENT").length;
    console.log(`\n═══ 집합 재현 — ${COHORT.length}건 (human SAME ${S} · DIFFERENT ${D}) ═══`);
    expect(COHORT).toHaveLength(12);
    /**
     * 🔴🔴 **CPO 가 적은 전제가 바뀌었다**(CORE-DESC-REVIEW · 2026-10-27) —
     *    이 집합은 「SAME **9** · DIFFERENT **3**」이었으나 C06 이 DIFFERENT → SAME 으로
     *    재라벨되어 **SAME 10 · DIFFERENT 2** 다. 🔴 그 전제를 쓰는 설계는 갱신해야 한다.
     */
    expect(S, "🔴 집합이 바뀌면 아래 분리가능성 결론의 분모가 바뀐다").toBe(10);
    expect(D).toBe(2);
  });

  it("[전수 증거] 12건의 모든 축 값을 펼친다", () => {
    const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
    console.log(`\n${"═".repeat(120)}`);
    console.log(`  12건 전수 — 🟢=human SAME · 🔴=human DIFFERENT`);
    console.log(`${"═".repeat(120)}`);
    for (const r of [...COHORT].sort((a, b) => a.p.human.localeCompare(b.p.human))) {
      const f = r.p.facts;
      const o = r.p.origin;
      const mark = r.p.human === "SAME" ? "🟢" : r.p.human === "DIFFERENT" ? "🔴" : "⚪";
      console.log(
        `  ${mark} ${pad(r.p.id, 6)} ${pad(r.p.domain, 22)} sys=${pad(String(r.j.cross.verdict), 14)}` +
          `TITLE+${ax(r, "TITLE")?.points ?? 0} ${pad(`[${v(ax(r, "TITLE")?.detail)}]`, 44)}`,
      );
      console.log(
        `       색상 ${pad(v(o.colorText) + " ↔ " + v(f.colorText), 34)}` +
          `소재 ${pad(v(o.materialText) + " ↔ " + v(f.materialText), 26)}핏 ${v(o.fitText)} ↔ ${v(f.fitText)}`,
      );
      console.log(
        `       카테고리 ${pad(v(o.categoryText) + " ↔ " + v(f.categoryText), 40)}` +
          `보류=${r.j.cross.blockers.map((b) => b.blocker).join(",") || "-"} 반증=${r.j.cross.conflicts.map((c) => c.conflict).join(",") || "-"}`,
      );
    }
  });

  /**
   * 🔴🔴🔴 **핵심 질문** — SAME 10 과 DIFFERENT 2 를 가르는 축이 있는가.
   *
   * 🟢 방법 — 축마다 「SAME 쪽 값 집합」과 「DIFFERENT 쪽 값 집합」을 만들어
   *    **DIFFERENT 에만 나타나는 신호** 가 있는지 센다. 🔴 추측이 아니라 집합 연산이다.
   */
  it("[분리가능성] DIFFERENT 에만 있는 신호가 존재하는가", () => {
    const same = COHORT.filter((r) => r.p.human === "SAME");
    const diff = COHORT.filter((r) => r.p.human === "DIFFERENT");

    /** 축/보류/반증 어휘를 신호로 쓴다(값이 아니라 **발화 여부**). */
    const signals = (r: Row): string[] => [
      ...r.j.cross.axes.map((a) => `축:${a.axis}${a.axis === "TITLE" ? `+${a.points}` : ""}`),
      ...r.j.cross.blockers.map((b) => `보류:${b.blocker}`),
      ...r.j.cross.conflicts.map((c) => `반증:${c.conflict}`),
      /** 🟢 값 «존재» 도 신호다 — 「그 칸을 읽었는가」가 갈릴 수 있다. */
      ...(r.p.facts.colorText ? ["값:color"] : []),
      ...(r.p.facts.materialText ? ["값:material"] : []),
      ...(r.p.facts.fitText ? ["값:fit"] : []),
      ...(r.p.facts.categoryText ? ["값:category"] : []),
    ];

    const sameSet = new Set(same.flatMap(signals));
    const diffSet = new Set(diff.flatMap(signals));
    const onlyDiff = [...diffSet].filter((s) => !sameSet.has(s));
    const onlySame = [...sameSet].filter((s) => !diffSet.has(s));
    /** 🔴 **모든** DIFFERENT 가 공유하면서 **어떤** SAME 도 갖지 않는 신호 = 이상적 분리축. */
    const perfect = onlyDiff.filter((s) => diff.every((r) => signals(r).includes(s)));

    console.log(`\n═══ 분리가능성 ═══`);
    console.log(`  DIFFERENT 에만 있는 신호 ${onlyDiff.length} → ${onlyDiff.join(" · ") || "**없음**"}`);
    console.log(`  SAME 에만 있는 신호     ${onlySame.length} → ${onlySame.join(" · ") || "없음"}`);
    console.log(`  🔵 **완전 분리축**(DIFFERENT 전건 보유 ∧ SAME 전건 미보유) ${perfect.length} → ${perfect.join(" · ") || "**없음**"}`);

    if (perfect.length === 0) {
      console.log(
        `\n  🔴🔴 **현재 증거 어휘로는 이 12건을 가를 축이 없다.**\n` +
          `     ⟹ 「SAME 유지 + DIFFERENT 차단」은 **지금 있는 신호의 조합으로는 불가능** 하다.\n` +
          `     🟢 그래서 CPO 가 ④(description Evidence Layer)를 연 것이 **정확한 방향** 이다 —\n` +
          `        **새 증거가 들어오지 않으면** 이 집합은 분리되지 않는다.\n` +
          `     🔴 threshold/NO_TITLE_OVERLAP 완화로는 **DIFFERENT 쪽이 같이 열린다**(WU-093 선례).`,
      );
    } else {
      console.log(`\n  🟡 분리 후보가 있다 ⟹ 다음 세션이 그 축으로 counterfactual 을 돌린다.`);
    }

    /** 🔴 결과를 단정하지 않는다 — 측정값을 그대로 남긴다. */
    expect(COHORT).toHaveLength(12);
    expect(perfect.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🟢🟢🟢 **전수 출력이 드러낸 것 — 상세설명이 «이미» 공급되고 있다**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 SAME-04 는 「`ProductFacts` 에 description 칸이 없다」로 닫았다. **그 말은 맞다** —
   *    그런데 **설명문 전문이 `materialText` 로 흘러들어오고 있다**(위 전수 출력 실측).
   * 🔴🔴 그리고 그 안에 **품번이 적혀 있다**:
   * ```
   * C05  후보 소재 「Tinyapple | FW26 Bobo Choses | Hug Hairy Monster … **B226AC009**」
   *      ⟹ 원상품 `B226AC009` 와 **일치**            human **SAME** 🟢
   * S1-6 후보 소재 「Tinyapple | FW26 Bobo Choses | Booty Ghosts … **REF: B226AC141**」
   *      ⟹ 원상품 `B226AC010` 과 **불일치**          human **DIFFERENT** 🔴
   * ```
   * ⟹ 🟢🟢 **같은 샵(tinyapple)·같은 sys verdict(SAME) 두 건이 그 품번으로 갈린다.**
   *    그것이 CPO ④(description → model code 복원 · Evidence Layer)와 **정확히 일치** 하고,
   *    🔴 **새 SAME 축이 아니다** — 기존 `MODEL_CODE` 축에 **증거를 공급** 하는 것이다.
   * 🔴 **운영에 넣지 않았다.** 아래는 반사실 측정이고 `facts` 를 바꾸지 않는다.
   */
  it("[🟢 핵심] 상세설명(materialText)에서 품번을 복원하면 누출이 갈리는가", () => {
    /** 🔴 원상품 품번과 **같은 모양** 만 찾는다 — 느슨한 숫자 매칭을 하지 않는다. */
    const CODE_RE = /\bB\d{3}[A-Z]{2}\d{3}\b/gi;
    const codesIn = (s: string | null): string[] =>
      s ? [...new Set((s.match(CODE_RE) ?? []).map((x) => x.toUpperCase()))] : [];

    const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
    console.log(`\n═══ 상세설명 품번 복원 반사실(12건) ═══`);
    let blocked = 0;
    let keptSame = 0;
    let noEvidence = 0;
    for (const r of COHORT) {
      const origin = r.p.origin.brandModelCode?.toUpperCase() ?? null;
      /** 🔴 **후보측** 설명만 본다 — 원상품 설명을 후보 증거로 쓰면 그것이 오염이다. */
      const found = codesIn(r.p.facts.materialText);
      const verdictNow = String(r.j.cross.verdict);
      let effect: string;
      if (found.length === 0) {
        effect = "증거 없음 — 변화 0";
        noEvidence += 1;
      } else if (origin && found.includes(origin)) {
        effect = `🟢 품번 **일치**(${found.join(",")}) ⟹ SAME 근거 보강`;
        if (r.p.human === "SAME") keptSame += 1;
      } else {
        effect = `🔴 품번 **불일치**(${found.join(",")} ↔ ${origin}) ⟹ **차단 근거**`;
        if (r.p.human === "DIFFERENT") blocked += 1;
      }
      console.log(`  ${r.p.human === "SAME" ? "🟢" : "🔴"} ${pad(r.p.id, 6)} ${pad(r.p.domain, 22)} sys=${pad(verdictNow, 14)}${effect}`);
    }
    console.log(
      `\n  🟢 DIFFERENT 를 **차단할 근거가 생긴 건** ${blocked}\n` +
        `  🟢 SAME 에 **근거가 보강된 건**        ${keptSame}\n` +
        `  🔴 후보 설명에 품번이 **없어 변화 0**   ${noEvidence}`,
    );

    /** 🔴🔴 **S1-6 이 갈린다** — 이것이 이 스프린트의 핵심 증거다. */
    const s16 = COHORT.find((r) => r.p.id === "S1-6")!;
    const s16codes = codesIn(s16.p.facts.materialText);
    expect(s16codes, "🔴 S1-6 후보 설명에 품번이 없으면 이 발견이 성립하지 않는다").toContain("B226AC141");
    expect(s16codes).not.toContain(s16.p.origin.brandModelCode?.toUpperCase());

    /** 🟢 그리고 **같은 샵의 정답(C05)은 일치** 한다 — 같은 규칙이 양방향으로 작동한다. */
    const c05 = COHORT.find((r) => r.p.id === "C05")!;
    expect(codesIn(c05.p.facts.materialText)).toContain(c05.p.origin.brandModelCode?.toUpperCase());

    /** 🔴 전건을 가르지는 **못한다** — C06 은 후보 설명이 비어 있다(측정불가). */
    const c06 = COHORT.find((r) => r.p.id === "C06")!;
    expect(codesIn(c06.p.facts.materialText), "🔴 C06 은 이 증거로 못 막는다 — 그 사실을 적는다").toEqual([]);
  });

  /**
   * 🔴 CPO 가 지목한 **알려진 누출 2건**(C06 · S1-6)이 이 집합 안에 있는지 확인한다.
   */
  it("[누출 2건] C06 · S1-6 이 이 집합에 속하는가", () => {
    const ids = COHORT.map((r) => r.p.id);
    const leaked = COHORT.filter((r) => r.p.human === "DIFFERENT" && r.j.cross.verdict === "SAME");
    console.log(`\n═══ 누출 ═══`);
    console.log(`  집합 내 id — ${ids.join(" · ")}`);
    for (const r of leaked) {
      console.log(
        `  🔴 ${r.p.id} ${r.p.domain} — sys SAME 인데 human DIFFERENT · truth=${r.j.truth} · tier=${r.j.tier}`,
      );
    }
    console.log(`  ⟹ 이 집합의 누출 **${leaked.length}** / DIFFERENT ${COHORT.filter((r) => r.p.human === "DIFFERENT").length}`);
    /**
     * 🔴🔴 **근거가 바뀌었다.** 「baseline 전체 FP **2** 가 이 집합 안에 있다」가 CPO 판단의
     *    근거였는데, C06 이 **human SAME 으로 재라벨**(CORE-DESC-REVIEW · 2026-10-27)되어
     *    더는 누출이 아니다 ⟹ 🟢 남은 누출은 **S1-6 하나** 다(baseline FP **1** 과 일치).
     * 🔴 「C06 이 FP 다」를 쓰는 서술은 **전부 낡았다**.
     */
    expect(leaked.length, "🔴 이 집합의 누출이 baseline FP(1)와 어긋났다").toBe(1);
    expect(leaked.map((r) => r.p.id).sort()).toEqual(["S1-6"]);
  });
});
