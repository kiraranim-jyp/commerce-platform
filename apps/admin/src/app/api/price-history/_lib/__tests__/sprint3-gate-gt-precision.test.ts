import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **SPRINT 3 선행 게이트 — GT 정밀도 재측정**(CPO 지시 2026-11-16 · HTTP 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **착수 전 확인(§4-D)이 이 WU 의 답을 바꿨다 — 이 측정은 «이미» 수행돼 있다.**
 * ```
 * docs/MI-REEVAL-STEP5-SHADOW.json  2분모 혼동행렬 + 방향별 변화 + A/B/C 합산 금지
 * docs/MI-REEVAL-STEP5-SHADOW.md    V1 ↔ V2 분석 + **CPO 판단 요청 넷**(답 미수신)
 * docs/MI-REEVAL-STEP6-HOLD-AND-COLOR.md  COLOR 경계·보류 승격 + CPO 판단 요청 넷
 * docs/MI-DESC-COMPARE-REPORT.md    비교가능 82 · 신규 증거 3 · GT 12쌍 오포함 0
 * fixtures/mi-reeval-01-desc-pairs.json  B군 109쌍(축 상태 · baseline verdict · humanGt)
 * ```
 * ⟹ 🔴 **새 측정을 만들지 않았다.** 이 파일은 그 측정을 **재현해 잠그고**, 재현되지
 *    않는 부분을 **FAIL 조건으로 명시** 한다(다음 사람이 그 숫자를 그대로 쓰지 않도록).
 *
 * 🔴 CPO 제한 전수 준수 — HTTP **0** · DB **0** · threshold **0** · 8축 **0** ·
 *    운영 판정 경로 연결 **0** · 신규 alias **0** · 기존 GT 원본 수정 **0**.
 */

const DOCS = join(__dirname, "../../../../../../../../docs");
const FIXTURES = join(__dirname, "fixtures");

type AxisStatus = "MATCH" | "MISMATCH" | "UNKNOWN";
interface ShadowPair {
  pairId: string;
  priorGt: string | null;
  ceoLatest: string | null;
  baselineReproduced: string | null;
  shadowV1?: { verdict: string };
  shadowV2?: { verdict: string };
  axes?: { axis: string; status: AxisStatus }[];
}
interface Shadow {
  groups: { A: number; B: number; C: number; note: string };
  aGroupConstraint: { candidateDescription: number; originDescription: number; of: number };
  guardrail: Record<string, unknown> & { mainStoryPairs: string[] };
  change: { recoveredMissedSame: string[]; lostCorrectSame: string[]; newFalseSame: string[] };
  pairsA: ShadowPair[];
}
interface DescPair {
  originCode: string;
  candidateDomain: string;
  humanGt: string | null;
  baselineSystemVerdict: string;
  hasOriginDescription: boolean;
  hasCandidateDescription: boolean;
  axisStatus?: Partial<Record<string, AxisStatus>>;
}

const shadow = JSON.parse(readFileSync(join(DOCS, "MI-REEVAL-STEP5-SHADOW.json"), "utf8")) as Shadow;
const descPairs = (
  JSON.parse(readFileSync(join(FIXTURES, "mi-reeval-01-desc-pairs.json"), "utf8")) as { pairs: DescPair[] }
).pairs;

const gtOf = (p: ShadowPair) => p.ceoLatest ?? p.priorGt;
const isSame = (v: string | null | undefined) => v === "SAME";
const MAIN_STORY = new Set(shadow.guardrail.mainStoryPairs);

/* ═══════════ A. 🔴 분모를 «합산하지 않는다» (CPO 제한 1) ═══════════ */

describe("A. 표본은 넷이고 서로 다른 분모다 — 합산 금지", () => {
  it("A-1 🔴 A/B/C 군이 선언으로 분리돼 있고 그 사실이 파일에 적혀 있다", () => {
    expect(shadow.groups.A).toBe(33);
    expect(shadow.groups.B).toBe(109);
    expect(shadow.groups.C).toBe(11);
    expect(shadow.groups.note).toContain("합산하지 않는다");
  });

  it("A-2 🔴 B군의 GT 분모는 109 가 «아니다» — 라벨이 있는 것만 센다", () => {
    const withGt = descPairs.filter((p) => p.humanGt);
    expect(descPairs.length).toBe(109);
    expect(withGt.length).toBe(36);
    /** 🔴 73쌍은 **라벨이 없다** — 「DIFFERENT」로도 「측정됨」으로도 세지 않는다. */
    expect(descPairs.length - withGt.length).toBe(73);
  });

  it("A-3 🔴 B군 라벨 분포(실제로 센 값)", () => {
    const n = (v: string) => descPairs.filter((p) => p.humanGt === v).length;
    expect(n("SAME")).toBe(20);
    expect(n("DIFFERENT")).toBe(15);
    expect(n("SIMILAR")).toBe(1);
  });

  it("A-4 🔴 CEO 원장(9건)과 이 표본들을 **같은 분모로 쓰지 않는다**", () => {
    const ledger = readFileSync(join(DOCS, "CEO-GT-LEDGER-2026-11-08.md"), "utf8");
    /** 🟢 원장은 **문서로 존재** 하고 여기서 숫자로 합치지 않는다(존재만 단언). */
    expect(ledger.length).toBeGreaterThan(0);
    /** 🔴 A군 33 · B군 GT 36 · CEO 원장은 **각각** 이다 — 합이 의미를 갖지 않는다. */
    expect(shadow.groups.A).not.toBe(descPairs.filter((p) => p.humanGt).length);
  });
});

/* ═══ B. 🟢 기준선 재현 (§5-B replicationGate) — 그리고 🔴 재현 «실패» 구간 ═══ */

function errors(verdictOf: (p: ShadowPair) => string | null | undefined, excludeMainStory: boolean) {
  const falseSame: string[] = [];
  const missedSame: string[] = [];
  for (const p of shadow.pairsA) {
    if (excludeMainStory && MAIN_STORY.has(p.pairId)) continue;
    const g = gtOf(p);
    const v = verdictOf(p);
    if (!g || !v) continue;
    if (!isSame(g) && isSame(v)) falseSame.push(p.pairId);
    if (isSame(g) && !isSame(v)) missedSame.push(p.pairId);
  }
  return { falseSame, missedSame };
}

describe("B. 저장된 측정을 «독립 재집계» 로 검증한다", () => {
  it("B-1 🟢 baseline 은 **정확히 재현된다**(분모 27 · 오포함 1 · 누락 12)", () => {
    const e = errors((p) => p.baselineReproduced, true);
    expect(shadow.pairsA.length - MAIN_STORY.size).toBe(27);
    expect(e.falseSame).toEqual(["S1-6"]);
    expect(e.missedSame.length).toBe(12);
    /** 🟢 저장된 guardrail 과 같은 값이다 — `withMainStory.baseline` = fp 1 · fn 12. */
    const g = shadow.guardrail.withMainStory as { baseline: { denom: number; fp: number; fn: number } };
    expect([g.baseline.denom, g.baseline.fp, g.baseline.fn]).toEqual([27, 1, 12]);
  });

  it("B-2 🔴🔴 **shadow 의 오포함 수는 재현되지 않는다** — 그 숫자를 그대로 인용하지 않는다", () => {
    const v1 = errors((p) => p.shadowV1?.verdict, true);
    const v2 = errors((p) => p.shadowV2?.verdict, true);
    /** 🟢 내 재집계(분모 27): V1 오포함 **1**(S1-6) · V2 오포함 **0**. */
    expect(v1.falseSame).toEqual(["S1-6"]);
    expect(v2.falseSame).toEqual([]);
    /** 🔴 저장된 값은 **V1 fp 3 · V2 fp 2** 다 — 같은 분모 선언인데 다르다. */
    const g = shadow.guardrail.withMainStory as { shadow: { V1: { fp: number }; V2: { fp: number } } };
    expect(g.shadow.V1.fp).toBe(3);
    expect(g.shadow.V2.fp).toBe(2);
    /**
     * 🔴🔴 **이 불일치가 이 파일의 가장 중요한 산출이다.**
     *    `pairsA` 만으로는 저장된 shadow 오포함 수를 복원할 수 없다 ⟹ 저장 측정이
     *    **내가 볼 수 없는 GT/필터** 를 썼다. §5-B 가 「CONTROL 이 실패하면 그 숫자를
     *    전략 판단에 쓰지 않는다」고 못박았으므로, **shadow fp 를 GO 근거로 쓰지 않는다.**
     * 🟢 누락(fn)은 양쪽이 **일치** 한다(V1 5 · V2 8) ⟹ 회수 효과는 인용 가능하다.
     */
    expect(v1.missedSame.length).toBe(5);
    expect(v2.missedSame.length).toBe(8);
  });

  it("B-3 🟢 방향별 변화가 저장돼 있고 **한쪽으로만** 기울지 않았다", () => {
    expect(shadow.change.recoveredMissedSame.length).toBe(7);
    expect(shadow.change.lostCorrectSame).toEqual([]);
    /** 🔴 새 오포함 2건이 **기록돼 있다** — 「0」이 아니다. */
    expect(shadow.change.newFalseSame).toEqual(["C20", "C25"]);
  });
});

/* ══ C. 🔵 CPO 지목 8건 — 기존 판정을 «보존» 한 채 추적한다 (제한 2·4) ══ */

describe("C. CPO 지목 8건의 기존 판정과 shadow 결과", () => {
  const WANTED = ["S1-1", "S2-1", "C27", "S1-4", "S2-3", "S2-4", "S1-7", "S3-1"] as const;

  it("C-1 여덟 건이 **전부** 표본에 있다", () => {
    const ids = new Set(shadow.pairsA.map((p) => p.pairId));
    for (const w of WANTED) expect(ids.has(w), w).toBe(true);
  });

  it("C-2 🔴 기존 GT 라벨을 **바꾸지 않았다** — 여덟 건 전부 priorGt = SAME", () => {
    for (const w of WANTED) {
      const p = shadow.pairsA.find((x) => x.pairId === w)!;
      expect(p.priorGt, w).toBe("SAME");
    }
  });

  it("C-3 🔵 상세설명을 더해 **회수되는 것은 셋** 이다(C27 · S1-4 · S1-1[V1 한정])", () => {
    const v = (id: string, k: "shadowV1" | "shadowV2") =>
      shadow.pairsA.find((x) => x.pairId === id)![k]?.verdict;
    expect(v("C27", "shadowV1")).toBe("SAME");
    expect(v("C27", "shadowV2")).toBe("SAME");
    expect(v("S1-4", "shadowV1")).toBe("SAME");
    expect(v("S1-4", "shadowV2")).toBe("SAME");
    /** 🔴 S1-1 은 **V1 에서만** SAME 이다 — V1/V2 선택이 이 1건을 가른다. */
    expect(v("S1-1", "shadowV1")).toBe("SAME");
    expect(v("S1-1", "shadowV2")).toBe("SIMILAR");
  });

  it("C-4 🔴 나머지 다섯은 상세설명으로도 **회수되지 않는다**(S2-1·S2-3·S2-4·S1-7·S3-1)", () => {
    for (const id of ["S2-1", "S2-3", "S2-4", "S1-7", "S3-1"]) {
      const p = shadow.pairsA.find((x) => x.pairId === id)!;
      expect(p.shadowV1?.verdict, id).not.toBe("SAME");
      expect(p.shadowV2?.verdict, id).not.toBe("SAME");
    }
  });

  it("C-5 🔴 S1-7 은 baseline 이 **CONFLICT** 다 — 품번 충돌로 조기 반환되는 자리", () => {
    expect(shadow.pairsA.find((x) => x.pairId === "S1-7")!.baselineReproduced).toBe("CONFLICT");
  });
});

/* ═══ D. 🔵🔵 CPO 제한 5 — COLOR / FIT 의 false DIFFERENT 위험 측정 ═══ */

describe("D. 축 MISMATCH 가 «정답(GT=SAME)» 을 막은 사례", () => {
  it("D-1 🟢 A군(33) — COLOR·FORM_DESIGN·MATERIAL 전부 **0 건**", () => {
    for (const axis of ["COLOR", "FORM_DESIGN", "MATERIAL"]) {
      const risky = shadow.pairsA.filter(
        (p) => isSame(gtOf(p)) && (p.axes ?? []).some((a) => a.axis === axis && a.status === "MISMATCH"),
      );
      expect(risky.map((p) => p.pairId), axis).toEqual([]);
    }
  });

  it("D-2 🟢 B군(GT 36) — 같은 세 축에서 **0 건**", () => {
    const withGt = descPairs.filter((p) => p.humanGt);
    for (const axis of ["COLOR", "FORM_DESIGN", "MATERIAL"]) {
      const risky = withGt.filter((p) => p.humanGt === "SAME" && p.axisStatus?.[axis] === "MISMATCH");
      expect(risky.map((p) => p.candidateDomain), axis).toEqual([]);
    }
  });

  it("D-3 🟢 그 MISMATCH 들이 **정당하게** 쓰인 사례는 있다(차단 자체가 죽지 않았다)", () => {
    const withGt = descPairs.filter((p) => p.humanGt);
    const justified = withGt.filter((p) => p.humanGt !== "SAME" && p.axisStatus?.COLOR === "MISMATCH");
    expect(justified.length).toBeGreaterThan(0);
  });

  it("D-4 🔴🔴 **그러나 이것은 운영 blocker 가 아니다** — 같은 객체로 읽지 않는다", () => {
    /**
     * 위 D-1·D-2 가 본 것은 **shadow 축 상태**(`axisStatus`)다. 동결 사유가 지목한
     * `COLOR_VARIANT` · `FIT` 는 운영 **blocker** 이고(색조 일치 + 색상명 불일치 → 보류 ·
     * WU-044) **서로 다른 계산** 이다. 🔴 그래서 「동결 사유가 반증됐다」로 적을 수 없다.
     * 🟢 그 blocker 의 분포는 다른 문서가 센다 — `COLOR_VARIANT` 10 · `FIT` 4(B군 기준).
     */
    const report = readFileSync(join(DOCS, "MI-DESC-COMPARE-REPORT.md"), "utf8");
    expect(report).toContain("COLOR_VARIANT");
    expect(report).toContain("FIT");
    /** 🔴 그 둘을 **GT 와 교차** 한 표는 그 문서에 **없다** ⟹ 이것이 남은 측정 공백이다. */
    expect(report).not.toContain("COLOR_VARIANT × GT");
  });
});

/* ═══ E. 🔴 제한 7 — 표본 편향과 측정불가를 «문서가 스스로» 적고 있다 ═══ */

describe("E. 편향·측정불가 명시", () => {
  it("E-1 🔴 A군은 **후보 설명문이 0/33** 이다 — 상세설명 효과를 후보측에서 재지 못했다", () => {
    expect(shadow.aGroupConstraint.candidateDescription).toBe(0);
    expect(shadow.aGroupConstraint.originDescription).toBe(33);
    expect(shadow.aGroupConstraint.of).toBe(33);
  });

  it("E-2 🔴 B군은 **양쪽 설명문 보유 82/109** 뿐이다", () => {
    const both = descPairs.filter((p) => p.hasOriginDescription && p.hasCandidateDescription);
    expect(both.length).toBe(82);
  });

  it("E-3 🔴 baseline 이 재현되지 않은 쌍이 **17건** 있다 — 「판정 변화」로 세지 않는다", () => {
    expect(descPairs.filter((p) => p.baselineSystemVerdict === "BASELINE_NOT_REPRODUCED").length).toBe(17);
  });

  it("E-4 🔴 `main-story` 6쌍은 **별도 집계** 다(브랜드 편향 격리)", () => {
    expect(shadow.guardrail.mainStoryPairs).toEqual(["C22", "C19", "C20", "C42", "C25", "S4-1"]);
    expect(shadow.guardrail.mainStoryPairs.length).toBe(6);
  });

  it("E-5 🔴 저장 측정이 스스로 「운영 반영 0」을 적고 있다(동결 유지 증거)", () => {
    expect((shadow as unknown as { note: string }).note).toContain("운영 반영 0");
  });
});

/* ═══ F. 🔴 동결은 «그대로» 다 — 이 WU 가 운영에 연결하지 않았다 ═══ */

describe("F. 운영 판정 경로 연결 0 (CPO 제한)", () => {
  const CRAWLER = join(__dirname, "../../../../../../../../packages/crawler/src/comparison-search");
  const owners = ["product-url-facts.ts", "cross-seller.ts", "seller-facts.ts"];

  it("F-1 🔴 운영 owner 가 상세설명 증거 모듈을 **여전히** import 하지 않는다", () => {
    for (const o of owners) {
      const src = readFileSync(join(CRAWLER, o), "utf8");
      expect(src, o).not.toContain("brand-description-evidence");
      expect(src, o).not.toContain("product-name-description-evidence");
      expect(src, o).not.toContain("analyzeBrandDescriptionEvidence");
      expect(src, o).not.toContain("analyzeProductNameDescriptionEvidence");
    }
  });

  it("F-2 🔴 이 측정 파일도 운영 판정 함수를 부르지 않는다(관찰 전용)", () => {
    /**
     * 🔴 **주석을 벗긴다** — 이 파일은 그 함수 이름을 «설명하기 위해» 주석에 적는다.
     *    벗기지 않으면 자기 주석에 걸려 FAIL 한다(메모 `source-scan-must-strip-comments` ·
     *    이 트랙에서 열한 번째다). 보는 것은 **import 와 호출** 이다.
     */
    /**
     * 🔴🔴 **이름으로 찾으면 «내 단언 줄» 이 걸린다** — 1차 시도가 그렇게 FAIL 했다
     *    (needle 을 찾는 코드가 needle 을 담고 있다 = 동어반복 · 메모
     *     `source-guard-must-lock-the-predicate` 의 그 함정).
     * 🟢 그래서 **성질로** 단언한다 — 이 파일은 **운영 모듈을 아예 import 하지 않는다.**
     *    판정 함수는 전부 그 패키지들 안에 있으므로, import 가 0 이면 호출도 0 이다.
     */
    const imports = readFileSync(__filename, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "")
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l))
      .join("\n");
    expect(imports).toContain("vitest");
    expect(imports).toContain("node:fs");
    expect(imports).not.toContain("@commerce/");
    expect(imports).not.toMatch(/from\s+"\.\.?\//);
  });
});
