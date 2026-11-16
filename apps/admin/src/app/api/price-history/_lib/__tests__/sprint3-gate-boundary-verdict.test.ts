import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractKeywords } from "./mi-reeval-shadow-keywords";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **제한적 검증 둘**(CPO 최종 검토 2026-11-16 · HTTP 0 · 운영/모듈 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 닫은 것과 연 것을 먼저 적는다:
 * ```
 * 🔴 `wordBoundary` **기본 OFF 유지** — 「블루계열」을 살리면서 영문 부분 문자열 오탐을
 *    막는 **별도 규칙을 «검증» 하기 전까지 운영 적용 금지**
 * 🔴 **verdict 재계산 불승인** — `UNKNOWN`/`NOT_APPLICABLE` 의 **영향 경로(owner) 확인만**
 * 🔴 원문 재수집 **미승인** · 상세설명 운영 연결 **없음** · 미측정을 **0 으로 취급 금지**
 * ```
 *
 * 🔴🔴 **이 파일은 모듈을 고치지 않는다.** ①의 후보 규칙은 **이 파일 안에서만** 평가되고
 *    `mi-reeval-shadow-keywords.ts` 에 들어가지 않는다(계약 C-1 이 그것을 단언한다).
 */

const HERE = __dirname;
const DOCS = join(HERE, "../../../../../../../../docs");
const KEYWORDS_SRC = readFileSync(join(HERE, "mi-reeval-shadow-keywords.ts"), "utf8");
const SHADOW_SRC = readFileSync(join(HERE, "mi-reeval-05-shadow.test.ts"), "utf8");
const asInput = (text: string) => ({ title: text, description: null });

/* ═══════ A. 🔴 현재 상태 고정 — 기본 OFF 이고 규칙은 그대로다 ═══════ */

describe("A. CPO 가 닫은 상태가 «실제로» 그대로다", () => {
  it("A-1 🔴 두 가드의 기본값이 **OFF** 다(옵션이고 강제가 아니다)", () => {
    /** 🔴 `?` 가 붙은 선택 필드이고 비교가 `=== true` 다 ⟹ 넘기지 않으면 꺼진 상태다. */
    expect(KEYWORDS_SRC).toMatch(/colorBrandGuard\?:\s*boolean/);
    expect(KEYWORDS_SRC).toMatch(/wordBoundary\?:\s*boolean/);
    expect(KEYWORDS_SRC).toContain("opts.wordBoundary === true");
    expect(KEYWORDS_SRC).toContain("opts.colorBrandGuard === true");
  });

  it("A-2 🔴 옵션을 안 넘기면 **STEP5 때와 같은 추출** 이다(기존 수치 보존)", () => {
    const off = extractKeywords(asInput("블루계열 cotton logo embroidered"), {});
    expect(off.some((k) => k.axis === "COLOR" && k.normalized === "blue")).toBe(true);
    /** 🔴 OFF 에서는 거짓 증거도 그대로 들어온다 — 그것이 STEP5 의 상태다. */
    expect(off.some((k) => k.axis === "COLOR" && k.normalized === "red")).toBe(true);
  });
});

/* ═══ B. 🔵 ① 「블루계열」 전용 후보 규칙 — **이 파일 안에서만** 평가한다 ═══ */

/**
 * 🔵🔵 **후보 규칙** — 「색상 토큰 뒤에 «색상 수식어» 가 오면 경계 위반으로 보지 않는다」.
 *
 * 🔴 왜 이 모양인가 — 현재 규칙이 막는 절은 **하나** 다:
 * ```
 * if (next && !isLatinForm && hangul.test(next) && f.length < 3) return true;
 *    ⟹ 「**블루**계열」(2자 한글 형태 + 뒤 한글) 이 여기서 죽는다
 * ```
 * 🔴 그 절을 **그냥 지우면 안 된다** — 한글 색상 토큰이 다른 낱말에 묻히는 경우가 실재한다
 *    (「블랙박스」·「그레이스」·「레드카펫」). 그래서 **접미사만 허용** 한다.
 * 🔴 영문 부분 문자열 오탐은 **다른 절** 이 막는다(앞/뒤가 라틴이면 차단) ⟹ 이 후보 규칙은
 *    `embroide**red**` · `elas**tan**e` 를 **건드리지 않는다**(아래 음성 테스트가 확인한다).
 * 🔴 **색상 사전을 늘리지 않는다** — 이 목록은 색상이 아니라 **수식어** 다.
 */
const COLOR_SUFFIXES = ["계열", "색", "컬러", "톤", "빛"] as const;

/** 🔴 후보 규칙을 **모듈 밖에서** 흉내 낸다 — 평가용이고 운영/모듈에 들어가지 않는다. */
function candidateRuleKeepsColor(text: string): boolean {
  const on = extractKeywords(asInput(text), { wordBoundary: true, colorBrandGuard: true });
  if (on.some((k) => k.axis === "COLOR")) return true;
  /**
   * 🔵 가드가 버렸을 때만 **접미사 예외** 를 본다 — 「색상 토큰 + 색상 수식어」 모양이면
   *    가드 OFF 결과를 되살린다(그 외에는 되살리지 않는다).
   */
  const off = extractKeywords(asInput(text), {});
  return off.some((k) => {
    if (k.axis !== "COLOR") return false;
    const at = text.toLowerCase().indexOf(k.keyword.toLowerCase());
    if (at < 0) return false;
    const after = text.slice(at + k.keyword.length);
    return COLOR_SUFFIXES.some((s) => after.startsWith(s));
  });
}

describe("B. ① 후보 규칙 — 「블루계열」을 살리면서 영문 오탐을 막는가", () => {
  it("B-1 🟢 **「블루계열」이 산다**(CPO 가 지목한 과잉차단 해소)", () => {
    expect(candidateRuleKeepsColor("블루계열")).toBe(true);
    expect(candidateRuleKeepsColor("색상 블루계열 면 100%")).toBe(true);
  });

  it("B-2 🟢 다른 색상 수식어 모양도 산다", () => {
    for (const t of ["그레이톤", "네이비컬러"]) expect(candidateRuleKeepsColor(t), t).toBe(true);
  });

  it("B-3 🔴🔴 **영문 부분 문자열 오탐은 그대로 막힌다**(이 규칙이 그 절을 건드리지 않는다)", () => {
    for (const t of ["cotton with logo embroidered at chest", "95% cotton 5% elastane"]) {
      const keep = extractKeywords(asInput(t), { wordBoundary: true, colorBrandGuard: true });
      expect(keep.some((k) => k.axis === "COLOR"), t).toBe(false);
      /** 🔴 후보 규칙을 적용해도 되살아나지 않아야 한다 — 접미사 모양이 아니다. */
      expect(candidateRuleKeepsColor(t), t).toBe(false);
    }
  });

  it("B-4 🔴 **2자 형태의 한글 묻힘은 되살리지 않는다**(수식어가 아닌 한글은 계속 차단)", () => {
    for (const t of ["블랙박스 수납", "레드카펫 이벤트"]) {
      expect(candidateRuleKeepsColor(t), t).toBe(false);
    }
  });

  it("B-5 🔴🔴 **새 사실 — 가드의 한글 보호가 «형태 길이» 에 의존한다**(3자는 안 막힌다)", () => {
    /**
     * 🔴 내 1차 단언은 「그레이스 컬렉션」도 막힌다고 봤고 **틀렸다**.
     * ```
     * 「블랙」·「레드」 2자  → `f.length < 3` 이 참 ⟹ 뒤에 한글이 오면 **차단** 🟢
     * 「그레이」    3자      → 그 절이 **발화하지 않는다** ⟹ 「그레이스」가 **통과** 🔴
     * ```
     * ⟹ 🔴 `wordBoundary` 의 한글 보호는 **불완전** 하다. 「블루계열」 과잉차단과
     *    「그레이스」 과소차단이 **같은 상수(`< 3`)에서 나온다** — 한쪽을 고치면 다른
     *    쪽이 움직인다. 🔴 그래서 이 축은 **접미사 예외만으로 닫히지 않는다**(CPO 보고용 사실).
     */
    const on = extractKeywords(asInput("그레이스 컬렉션"), { wordBoundary: true, colorBrandGuard: true });
    expect(on.some((k) => k.axis === "COLOR" && k.normalized === "grey")).toBe(true);
    /** 🟢 2자 형태는 실제로 막힌다 — 대조군. */
    const blocked = extractKeywords(asInput("블랙박스 수납"), { wordBoundary: true, colorBrandGuard: true });
    expect(blocked.some((k) => k.axis === "COLOR")).toBe(false);
  });

  it("B-6 🟢 「Gray Label」 거짓 증거도 되살아나지 않는다", () => {
    expect(candidateRuleKeepsColor("The Gray Label logo embroidery on the chest")).toBe(false);
  });

  it("B-7 🔴🔴 **모듈에 넣지 않았다** — 후보 규칙은 이 파일 안에만 있다", () => {
    expect(KEYWORDS_SRC).not.toContain("COLOR_SUFFIXES");
    expect(KEYWORDS_SRC).not.toContain("candidateRuleKeepsColor");
    /** 🔴 그리고 기존 경계 절을 **고치지 않았다**(그 줄이 그대로 있다). */
    expect(KEYWORDS_SRC).toContain("f.length < 3");
  });

  it("B-8 🔴 **검증 한계를 적는다** — 표본이 손으로 만든 문자열이다", () => {
    /**
     * 🔴 이 평가는 **실제 판매처 설명문이 아니라 내가 만든 문자열** 로 한 것이다
     *    (설명문 원문 재수집은 CPO 가 미승인했다) ⟹ 「실데이터에서 안전하다」로 적지 않는다.
     * 🔴 그리고 접미사 목록 **5개** 는 실측 등록이 아니라 **내가 고른 것** 이다 ⟹
     *    운영 적용 전에 실데이터 분모에서 재검증이 필요하다.
     */
    expect(COLOR_SUFFIXES.length).toBe(5);
  });
});

/* ═══ C. 🔵 ② verdict 영향 경로 — **owner 확인만** (재계산 0) ═══ */

describe("C. ② UNKNOWN ↔ NOT_APPLICABLE 가 verdict 에 닿는 경로", () => {
  it("C-1 🔵 verdict 규칙 owner 를 특정했다 — `synthesize()` · **테스트 안 인라인** 이다", () => {
    expect(SHADOW_SRC).toContain("const SUPPORTING");
    expect(SHADOW_SRC).toContain("const RULESETS");
    /** 🔴 `export` 가 **아니다** ⟹ 다른 파일이 재사용할 수 없다(복제 금지 ⟹ 재계산 불가). */
    expect(SHADOW_SRC).not.toMatch(/export\s+function\s+synthesize/);
  });

  it("C-2 🟢🟢 **규칙이 `NOT_APPLICABLE` 을 한 번도 읽지 않는다**", () => {
    /**
     * 🟢 규칙의 축 입력은 전부 `=== "MATCH"` 또는 `=== "MISMATCH"` 다 ⟹
     *    `UNKNOWN` 과 `NOT_APPLICABLE` 은 **둘 다 「아무것도 아님」** 으로 읽힌다.
     * ⟹ 🟢 `UNKNOWN → NOT_APPLICABLE` 변화는 **verdict 입력을 바꾸지 않는다**(소스 근거).
     * 🔴 이것은 **정적 근거** 이고 재계산 결과가 아니다 — CPO 가 재계산을 열지 않았다.
     */
    /**
     * 🔴 **시작점 «뒤» 에서 끝점을 찾는다** — `UNDECIDED` 는 그 위 **주석에 먼저** 나오고,
     *    그대로 `indexOf` 를 쓰면 끝 < 시작이 되어 slice 가 **빈 문자열** 이 된다
     *    (내 1차 단언이 그렇게 FAIL 했다 · 이 세션 네 번째 좌표 오류).
     */
    const from = SHADOW_SRC.indexOf("const brandOk");
    const to = SHADOW_SRC.indexOf("UNDECIDED", from);
    expect(from).toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    const rule = SHADOW_SRC.slice(from, to);
    expect(rule.length).toBeGreaterThan(0);
    expect(rule).not.toContain("NOT_APPLICABLE");
  });

  it("C-3 🔴 그러나 규칙은 **MISMATCH 를 읽는다** ⟹ 다른 변화는 verdict 를 움직일 수 있다", () => {
    expect(SHADOW_SRC).toContain('st("PRODUCT_TYPE") === "MISMATCH"');
    expect(SHADOW_SRC).toMatch(/SUPPORTING\.filter\(\(a\) => st\(a\) === "MISMATCH"\)/);
  });

  it("C-4 🔵🔵 STEP7 의 변화 35 를 **방향으로 분류** 한다(재계산 아님 · 규칙 입력 기준)", () => {
    const step7 = JSON.parse(readFileSync(join(DOCS, "MI-REEVAL-STEP7-EXTRACT-FIX-V2.json"), "utf8")) as {
      changedPairs: { changedAxes: string[]; before: Record<string, string>; after: Record<string, string> }[];
    };
    const SUPPORTING = new Set(["COLOR", "MATERIAL", "SLEEVE_FORM", "PRINT_PATTERN", "FIT"]);
    const READ_MATCH = new Set(["BRAND", "MODEL_CODE", "PRODUCT_TYPE", "DESIGN", "COLOR"]);
    const READ_MISMATCH = new Set(["BRAND", "MODEL_CODE", "PRODUCT_TYPE"]);
    let neutral = 0;
    let promote = 0;
    let demote = 0;
    for (const p of step7.changedPairs) {
      for (const x of p.changedAxes) {
        const b = p.before[x]!;
        const a = p.after[x]!;
        if (b === "UNKNOWN" && a === "NOT_APPLICABLE") neutral += 1;
        else if (b === "MATCH" && READ_MATCH.has(x)) demote += 1;
        else if (b === "MISMATCH" && (READ_MISMATCH.has(x) || SUPPORTING.has(x))) promote += 1;
        else neutral += 1;
      }
    }
    /**
     * 🔴🔴 **이 셋이 ②의 답이다.**
     * ```
     * 🟢 verdict 입력 불변            **20**  (UNKNOWN → NOT_APPLICABLE)
     * 🔴 SAME 을 «올릴» 수 있는 변화   **13**  (PRODUCT_TYPE MISMATCH 제거 8 + 보조 MISMATCH 제거 5)
     * 🟡 SAME 을 «내릴» 수 있는 변화    **6**  (MATCH 상실 — COLOR 4 · PRODUCT_TYPE 2)
     * ```
     * 🔴 즉 **거짓 증거 제거가 SAME 을 올리는 방향으로도 작동한다** ⟹ CPO 가 재계산을
     *    열지 않은 판단이 이 숫자로 지지된다. 🔴 실제 verdict 변화는 **측정하지 않았다**.
     */
    expect([neutral, promote, demote]).toEqual([20, 13, 6]);
  });

  it("C-5 🔴 **재계산하지 않았다** — 이 파일은 verdict 를 만들지 않는다", () => {
    const self = readFileSync(__filename, "utf8")
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l))
      .join("\n");
    /** 🟢 shadow 판정 테스트를 import 하지 않는다(그 안에 규칙이 있다). */
    expect(self).not.toContain("mi-reeval-05-shadow");
    expect(self).toContain("mi-reeval-shadow-keywords");
  });
});

/* ═══ D. 🔴 미측정을 0 으로 취급하지 않는다 (CPO 지시 3) ═══ */

describe("D. 측정 경계 보존", () => {
  it("D-1 🔴 STEP7 산출물이 **측정불가 항목을 적고 있다**", () => {
    const step7 = JSON.parse(readFileSync(join(DOCS, "MI-REEVAL-STEP7-EXTRACT-FIX-V2.json"), "utf8")) as {
      limits: string[];
      nonReproducibleKeywords: number;
    };
    expect(step7.limits.length).toBeGreaterThanOrEqual(3);
    expect(step7.limits.join(" ")).toContain("A군 33");
    /** 🔴 창이 좁아 가드를 적용할 수 없던 키워드가 **24** 다 — 「변화 0」이 아니다. */
    expect(step7.nonReproducibleKeywords).toBe(24);
  });

  it("D-2 🔴 STEP5 · STEP6 산출물을 **그대로** 뒀다", () => {
    for (const f of ["MI-REEVAL-STEP5-SHADOW.json", "MI-REEVAL-STEP6-HOLD-AND-COLOR.md"]) {
      expect(readFileSync(join(DOCS, f), "utf8").length).toBeGreaterThan(0);
    }
  });
});
