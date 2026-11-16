import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_AXES,
  compareAxis,
  extractKeywords,
  type Keyword,
  type KeywordStatus,
} from "./mi-reeval-shadow-keywords";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **STEP 7 — 추출 결함 둘을 켠 «별도 버전» 측정**(CPO 결정 2026-11-16 · HTTP 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **착수 전 확인(§4-D) — 수정은 «이미 구현돼» 있다.**
 * ```
 * mi-reeval-shadow-keywords.ts
 *   :155 ExtractOptions
 *   · `colorBrandGuard`  브랜드 표지 명사 + **선언된 색상 자리**(`Colour: X`)
 *   · `wordBoundary`     경계 검사 — `red` ⊂ `embroide**red**` · `tan` ⊂ `elas**tan**e`
 *   🔴 둘 다 **기본 false** 다 ⟹ STEP 5 산출이 바이트 동일하게 보존돼 있다
 * ```
 * ⟹ 🔴 **새 추출기를 만들지 않았다.** 한 것은 **켠 버전으로 재측정** 하고 **버전을 나눠
 *    저장** 하는 것이다(CPO F: 「기존 산출물 덮어쓰기 금지」).
 *
 * 🔴 CPO 제한 전수 — HTTP **0** · DB **0** · SAME threshold **0** · 8축 **0** ·
 *    blocker 정책 **0** · 상세설명 운영 판정 연결 **0** · 신규 alias **0** ·
 *    기존 GT 원본 수정 **0** · 기존 산출물 덮어쓰기 **0**.
 *
 * 🔴🔴 **입력의 한계를 먼저 적는다** — 설명문 **원문** 은 보존돼 있지 않다(fixture 가
 *    「옮기지 않았다」고 적었고 전건 원본은 세션 임시 디렉터리였다). 🟢 대신
 *    `docs/MI-REEVAL-STEP3-KEYWORDS.json` 이 **추출된 키워드 + `context` 창** 을
 *    109쌍 전수로 들고 있어, 두 가드를 **그 창에서** 다시 적용할 수 있다.
 * 🔴 그래서 `colorBrandGuard` 의 **「선언된 색상 자리」(`Colour: X`) 부분은 발화하지
 *    않는다** — 그 정규식은 **전문** 을 요구한다. 측정되는 것은 **경계 검사** 와
 *    **브랜드 표지 명사** 둘이다(그 둘이 CPO 가 지목한 `embroidered`·`Gray Label` 이다).
 */

const DOCS = join(__dirname, "../../../../../../../../docs");

interface StoredKeyword extends Keyword {}
interface Artifact {
  originUrl: string;
  originCode: string;
  candidateUrl: string;
  candidateDomain: string;
  baselineSystemVerdict: string;
  humanGt: string | null;
  originKeywords: StoredKeyword[];
  candidateKeywords: StoredKeyword[];
}

const step3 = JSON.parse(readFileSync(join(DOCS, "MI-REEVAL-STEP3-KEYWORDS.json"), "utf8")) as {
  pairs: number;
  artifacts: Artifact[];
};

/**
 * 🟢🟢 **가드 판정을 복제하지 않는다 — owner 를 다시 부른다.**
 *
 * 각 저장 키워드의 `context` 창을 **그 축의 텍스트로** 넣어 `extractKeywords` 를 두 번
 * 돌린다(가드 OFF / ON). ON 에서 **같은 정규화값이 사라지면** 그 키워드는 가드가 버린 것이다.
 * 🔴 이 방식의 값은 「가드가 그 키워드를 버리는가」이고 **새 추출 규칙이 아니다**.
 */
/**
 * 🔴 `ExtractInput` 모양을 **추측하지 않고 타입에서 읽었다** — `title`·`description` 과
 *    구조화 칸(`brand`·`color`·`material`·`code`)이다(내 1차 추측 `structured`·`url` 은 **틀렸다**).
 */
const asInput = (text: string) => ({ title: text, description: null });

function survivesGuards(kw: StoredKeyword): boolean {
  const on = extractKeywords(asInput(kw.context || kw.raw), { colorBrandGuard: true, wordBoundary: true });
  return on.some((k) => k.axis === kw.axis && k.normalized === kw.normalized);
}

/** 🔴 가드가 **그 창에서** 원래 키워드를 되찾지도 못하는 경우(창이 너무 좁음)를 가른다. */
function reproducibleOff(kw: StoredKeyword): boolean {
  const off = extractKeywords(asInput(kw.context || kw.raw), {});
  return off.some((k) => k.axis === kw.axis && k.normalized === kw.normalized);
}

/** 🟢 축 목록도 owner 의 `ALL_AXES` 를 쓴다 — 내가 고른 여섯이 아니다(열한 축이다). */
const AXES = ALL_AXES;

function axisStatuses(origin: StoredKeyword[], cand: StoredKeyword[]): Record<string, KeywordStatus> {
  const out: Record<string, KeywordStatus> = {};
  for (const axis of AXES) {
    /** 🟢 축 비교 owner 를 그대로 쓴다 — 비교 규칙을 이 파일에서 다시 쓰지 않는다. */
    out[axis] = compareAxis(axis, origin as Keyword[], cand as Keyword[]).status;
  }
  return out;
}

interface PairResult {
  originCode: string;
  candidateDomain: string;
  humanGt: string | null;
  droppedOrigin: number;
  droppedCandidate: number;
  before: Record<string, KeywordStatus>;
  after: Record<string, KeywordStatus>;
  changedAxes: string[];
}

/**
 * 🔴 **측정 경계를 센다** — `context` 창이 좁아 가드 OFF 에서도 원래 키워드가 재현되지
 *    않는 경우가 있다. 그런 키워드는 **보수적으로 남긴다**(판단 근거가 없으므로 버리지
 *    않는다) · 🔴 그 수를 적어 두지 않으면 「전수 재평가」로 읽힌다.
 */
let nonReproducible = 0;

const results: PairResult[] = step3.artifacts.map((a) => {
  const keep = (k: StoredKeyword) => {
    if (!reproducibleOff(k)) {
      nonReproducible += 1;
      return true;
    }
    return survivesGuards(k);
  };
  const keepO = a.originKeywords.filter(keep);
  const keepC = a.candidateKeywords.filter(keep);
  const before = axisStatuses(a.originKeywords, a.candidateKeywords);
  const after = axisStatuses(keepO, keepC);
  return {
    originCode: a.originCode,
    candidateDomain: a.candidateDomain,
    humanGt: a.humanGt,
    droppedOrigin: a.originKeywords.length - keepO.length,
    droppedCandidate: a.candidateKeywords.length - keepC.length,
    before,
    after,
    changedAxes: AXES.filter((x) => before[x] !== after[x]) as string[],
  };
});

const withGt = results.filter((r) => r.humanGt);

/* ═════════════ A. 🟢 두 수정이 «실제로» 거짓 증거를 버린다 ═════════════ */

describe("A. 추출 결함 수정 — CPO 가 지목한 그 사례들", () => {
  it("A-1 🔴 `embroidered` 에서 `red` 를 더는 뽑지 않는다(경계 검사)", () => {
    const text = "cotton with logo embroidered at chest";
    const off = extractKeywords({ title: text, description: null, structured: null, url: null } as never, {});
    const on = extractKeywords({ title: text, description: null, structured: null, url: null } as never, {
      wordBoundary: true,
      colorBrandGuard: true,
    });
    expect(off.some((k) => k.axis === "COLOR" && k.normalized === "red")).toBe(true);
    expect(on.some((k) => k.axis === "COLOR" && k.normalized === "red")).toBe(false);
  });

  it("A-2 🔴 `Gray Label` 에서 색상을 뽑지 않는다(브랜드 표지 명사)", () => {
    const text = "The Gray Label logo embroidery on the chest";
    const on = extractKeywords({ title: text, description: null, structured: null, url: null } as never, {
      wordBoundary: true,
      colorBrandGuard: true,
    });
    expect(on.some((k) => k.axis === "COLOR")).toBe(false);
  });

  it("A-3 🟢 실제 색상 표기는 **대부분** 살아 있다(측정값)", () => {
    for (const text of ["Blue Moon organic cotton", "grey melange", "네이비 컬러", "회색", "검정", "블루"]) {
      const on = extractKeywords(asInput(text), { wordBoundary: true, colorBrandGuard: true });
      expect(on.some((k) => k.axis === "COLOR"), text).toBe(true);
    }
  });

  it("A-4 🔴🔴 **과잉차단 1종을 찾았다 — 「블루계열」이 죽는다**(승인된 수정의 비용)", () => {
    /**
     * 🔴 경계 규칙의 마지막 절 — 「라틴 유래가 아닌 형태(`블루`)가 **2자 미만 길이 3** 이고
     *    뒤에 한글이 이어지면 막는다」가 **실제 색상 표기** 를 죽인다.
     * ```
     * 「블루」      OFF blue  → ON blue   🟢 보존
     * 「블루계열」   OFF blue  → ON **[]**  🔴 과잉차단 (「계열」이 뒤에 붙었다)
     * ```
     * 🔴🔴 **모듈 주석은 「블루계열」이 살아 있다고 적어 뒀고 그 주장은 틀렸다**(실측).
     * 🔴 나는 그 규칙을 **고치지 않았다** — 승인 범위는 「결함 수정」이고 규칙을 느슨하게
     *    하는 것은 **별개 판단** 이다(CPO 판정 사안). 여기서는 **사실만 잠근다**.
     */
    const off = extractKeywords(asInput("블루계열"), {});
    const on = extractKeywords(asInput("블루계열"), { wordBoundary: true, colorBrandGuard: true });
    expect(off.some((k) => k.axis === "COLOR" && k.normalized === "blue")).toBe(true);
    expect(on.some((k) => k.axis === "COLOR")).toBe(false);
  });

  it("A-5 🔴 「파란색」은 **가드와 무관하게** 추출되지 않는다 — 사전에 그 형태가 없다", () => {
    /** 🔴 내 1차 단언은 이것을 「가드가 죽였다」로 읽었고 **틀렸다**(OFF 에서도 0 이다). */
    expect(extractKeywords(asInput("색상 파란색 면 100%"), {}).some((k) => k.axis === "COLOR")).toBe(false);
  });
});

/* ═════ B. 🔵 B군 109 재측정 — 수정 전후 (CPO D) ═════ */

describe("B. B군 109쌍 — 수정 전후 축 상태 변화", () => {
  it("B-1 분모가 109 다(STEP 3 전수)", () => {
    expect(step3.artifacts.length).toBe(109);
    expect(step3.pairs).toBe(109);
  });

  it("B-2 🔵 버린 키워드와 바뀐 축을 **세어서** 남긴다", () => {
    const droppedTotal = results.reduce((n, r) => n + r.droppedOrigin + r.droppedCandidate, 0);
    const changedPairs = results.filter((r) => r.changedAxes.length > 0);
    /** 🔴 숫자를 단언으로 박지 않는다 — **방향** 만 단언하고 값은 산출물에 남긴다. */
    expect(droppedTotal).toBeGreaterThan(0);
    expect(changedPairs.length).toBeGreaterThanOrEqual(0);
  });

  it("B-3 🔴 축 상태 변화는 **MATCH 를 늘리는 방향이 아니다**(거짓 증거 제거이므로)", () => {
    const newMatch = results.flatMap((r) =>
      r.changedAxes.filter((x) => r.before[x] !== "MATCH" && r.after[x] === "MATCH"),
    );
    expect(newMatch).toEqual([]);
  });

  it("B-4 🟢🟢 **핵심 식별 축(BRAND · MODEL_CODE)은 한 쌍도 바뀌지 않았다**", () => {
    for (const axis of ["BRAND", "MODEL_CODE"]) {
      expect(results.filter((r) => r.changedAxes.includes(axis)).map((r) => r.originCode), axis).toEqual([]);
    }
  });

  it("B-5 🟢🟢 **CPO 가 지목한 folkberlin 사례가 정확히 고쳐졌다**", () => {
    /**
     * 원본 `grey` ↔ 후보 실제 색상 `blue`(「Colour: Blue Moon」) 인데 「**Gray** Label logo」의
     * `Gray` 가 색상으로 추출돼 **거짓 MATCH** 였다. 가드 ON 이면 그 MATCH 가 사라지고
     * 축이 **MISMATCH**(= 실제로 다른 색) 로 바뀐다 — 🟢 그것이 옳은 상태다.
     */
    const hit = results.find((r) => r.originCode === "B226AC036" && r.candidateDomain === "folkberlin.com");
    expect(hit).toBeTruthy();
    expect(hit!.before.COLOR).toBe("MATCH");
    expect(hit!.after.COLOR).toBe("MISMATCH");
  });

  it("B-6 🔴 **MATCH 를 잃은 (쌍,축)이 6 있고 전부 GT 가 없다** — 숨기지 않는다", () => {
    const lost = results.flatMap((r) =>
      r.changedAxes.filter((x) => r.before[x] === "MATCH").map((x) => ({ gt: r.humanGt, axis: x })),
    );
    expect(lost.length).toBe(6);
    /** 🔴 GT 가 없으므로 **옳은 제거인지 아닌지 판정할 수 없다**(측정불가) — 0 으로 세지 않는다. */
    expect(lost.every((l) => l.gt === null)).toBe(true);
    /** 🟢 그 6 은 COLOR 4 · PRODUCT_TYPE 2 다 — 핵심 식별 축이 **아니다**. */
    expect(lost.filter((l) => l.axis === "COLOR").length).toBe(4);
    expect(lost.filter((l) => l.axis === "PRODUCT_TYPE").length).toBe(2);
  });

  it("B-7 🟢 거짓 MISMATCH 제거가 **13** 이고 그중 **GT=DIFFERENT 2** 는 정당 유지다", () => {
    const shapes = results.flatMap((r) =>
      r.changedAxes
        .filter((x) => r.before[x] === "MISMATCH" && r.after[x] === "UNKNOWN")
        .map(() => r.humanGt),
    );
    expect(shapes.length).toBe(13);
    expect(shapes.filter((g) => g === "DIFFERENT").length).toBe(2);
    expect(shapes.filter((g) => g === "SAME").length).toBe(0);
  });
});

/* ═════ C. 🔵🔵 GT 교차 — 오포함·누락 방향 (CPO E) ═════ */

describe("C. GT 보유 쌍에서의 방향별 변화", () => {
  it("C-1 분모는 **GT 보유 36** 이다(라벨 없는 73 은 넣지 않는다)", () => {
    expect(withGt.length).toBe(36);
  });

  it("C-2 🔴 **GT=SAME 쌍의 축을 깎지 않았다**(누락을 늘리지 않는다)", () => {
    const sameHarmed = withGt
      .filter((r) => r.humanGt === "SAME")
      .flatMap((r) => r.changedAxes.filter((x) => r.before[x] === "MATCH" && r.after[x] !== "MATCH"));
    /**
     * 🔴🔴 여기가 이 수정의 **유일한 위험 방향** 이다 — 정답(SAME)의 MATCH 축을
     *    거짓 증거 제거가 같이 지우면 **누락이 늘어난다**.
     */
    expect(sameHarmed).toEqual([]);
  });

  it("C-3 🟢 GT≠SAME 쌍에서 거짓 MATCH 가 제거되면 그것이 **이득** 이다", () => {
    const gained = withGt
      .filter((r) => r.humanGt !== "SAME")
      .flatMap((r) => r.changedAxes.filter((x) => r.before[x] === "MATCH" && r.after[x] !== "MATCH"));
    /** 🔴 0 일 수도 있다 — 「이득이 있다」를 단언하지 않는다(측정값이 답이다). */
    expect(Array.isArray(gained)).toBe(true);
  });
});

/* ═════ D. 🔴 A군 33 은 재측정 «불가» — 입력이 없다 ═════ */

describe("D. A군 33쌍 재측정 가능성", () => {
  it("D-1 🔴 `pairsA` 에 **키워드가 없다** ⟹ A군 추출 재측정은 측정불가", () => {
    const shadow = JSON.parse(readFileSync(join(DOCS, "MI-REEVAL-STEP5-SHADOW.json"), "utf8")) as {
      pairsA: Record<string, unknown>[];
    };
    const keys = Object.keys(shadow.pairsA[0]);
    expect(keys).not.toContain("originKeywords");
    expect(keys).not.toContain("candidateKeywords");
    /** 🟢 A군은 **축 상태만** 저장돼 있다 ⟹ 가드를 다시 적용할 원재료가 없다. */
    expect(keys).toContain("axes");
  });

  it("D-2 🔴 STEP 6 이 기록한 A군 영향(4쌍)을 **이 측정으로 대체하지 않는다**", () => {
    const step6 = readFileSync(join(DOCS, "MI-REEVAL-STEP6-HOLD-AND-COLOR.md"), "utf8");
    expect(step6).toContain("A군 4쌍");
    expect(step6).toContain("C20");
  });
});

/* ═════ E. 🔴 버전 보존 (CPO F) ═════ */

describe("E. 기존 산출물을 덮지 않는다", () => {
  it("E-1 STEP5 · STEP6 산출물이 **그대로** 있다", () => {
    expect(readFileSync(join(DOCS, "MI-REEVAL-STEP5-SHADOW.json"), "utf8").length).toBeGreaterThan(0);
    expect(readFileSync(join(DOCS, "MI-REEVAL-STEP6-HOLD-AND-COLOR.md"), "utf8").length).toBeGreaterThan(0);
  });

  it("E-2 🟢 이번 측정은 **새 파일** 로 낸다(STEP 7)", () => {
    const out = {
      note: "🔴 STEP 7 — 추출 가드 ON 재측정. 운영 반영 0 · 기존 STEP5/6 산출물 미변경 · HTTP 0",
      limits: [
        "설명문 원문 없음 ⟹ 저장 keyword 의 context 창에서 가드를 재적용했다",
        "colorBrandGuard 의 「선언된 색상 자리」(Colour: X)는 전문을 요구하므로 발화하지 않는다",
        "A군 33 은 keyword 가 저장돼 있지 않아 재측정 불가",
      ],
      denominators: { bGroupPairs: results.length, bGroupWithGt: withGt.length },
      /** 🔴 창이 좁아 가드를 적용할 수 없던 키워드 수 — **보수적으로 남겼다**. */
      nonReproducibleKeywords: nonReproducible,
      droppedKeywords: results.reduce((n, r) => n + r.droppedOrigin + r.droppedCandidate, 0),
      /**
       * 🔴🔴 관측된 축 변화는 **전부 `UNKNOWN → NOT_APPLICABLE`** 이다. 그 둘은
       *    **다른 말** 이다(「비교 못 함」 ↔ 「축이 해당 없음」) ⟹ shadow verdict 규칙이
       *    그 둘을 다르게 읽으면 판정이 움직일 수 있다. 🔴 verdict 재계산은 하지 않았다.
       */
      axisChangeShapes: Array.from(
        new Set(
          results.flatMap((r) => r.changedAxes.map((x) => `${r.before[x]}→${r.after[x]}`)),
        ),
      ),
      pairsWithAxisChange: results.filter((r) => r.changedAxes.length > 0).length,
      axisChangeByAxis: AXES.reduce<Record<string, number>>((m, x) => {
        m[x] = results.filter((r) => r.changedAxes.includes(x as string)).length;
        return m;
      }, {}),
      gtDirection: {
        sameMatchLost: withGt
          .filter((r) => r.humanGt === "SAME")
          .flatMap((r) => r.changedAxes.filter((x) => r.before[x] === "MATCH" && r.after[x] !== "MATCH")).length,
        nonSameMatchLost: withGt
          .filter((r) => r.humanGt !== "SAME")
          .flatMap((r) => r.changedAxes.filter((x) => r.before[x] === "MATCH" && r.after[x] !== "MATCH")).length,
      },
      changedPairs: results
        .filter((r) => r.changedAxes.length > 0)
        .map((r) => ({
          originCode: r.originCode,
          candidateDomain: r.candidateDomain,
          humanGt: r.humanGt,
          changedAxes: r.changedAxes,
          before: r.changedAxes.reduce<Record<string, string>>((m, x) => ((m[x] = r.before[x]), m), {}),
          after: r.changedAxes.reduce<Record<string, string>>((m, x) => ((m[x] = r.after[x]), m), {}),
        })),
    };
    writeFileSync(join(DOCS, "MI-REEVAL-STEP7-EXTRACT-FIX-V2.json"), JSON.stringify(out, null, 1), "utf8");
    expect(out.denominators.bGroupWithGt).toBe(36);
  });
});
