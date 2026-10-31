import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MATCH-TRUTH-PRICE-ELIGIBILITY-AUDIT-01 — **결정축은 `matchTruth` 다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🟢 실측(새 Search 0 · Crawl 0 · 운영 코드 0 · 샵 대표 분모 **23**):
 * ```
 * matchTruth            전체 hSAME hDIFF 금액 자격  자격률 SAME정밀 DIFF누출
 * STRONG_IDENTIFIER      11    11     0   11   11   100%    100%      0%
 * TEXT_CONFIRMED          7     6     1    7    7   100%     86%     14%
 * CONFLICT                5     3     1    5    0     0%     75%     25%
 * ```
 *
 * 🔴🔴🔴 **PE-01A 의 반증이 확증됐다** — 같은 blocker 가 `matchTruth` 로 갈린다:
 * ```
 * TEXT_CONFIRMED + AUDIENCE_LINE   4 → 자격 **4**   (전부 허용)
 * CONFLICT       + AUDIENCE_LINE   2 → 자격 **0**   (전부 차단)
 * ```
 *    ⟹ 「`AUDIENCE_LINE` 8 중 4 만 자격」의 원인은 **blocker 가 아니라 `matchTruth`** 다.
 *
 * 🔴 누출 1건의 전 칸(실측):
 * ```
 * m.luxboy.com · PRESUMED_SAME · TEXT_CONFIRMED · COMPARISON · elig=true ·
 *                [NO_TITLE_OVERLAP] · ₩59,000 · human DIFFERENT
 * ```
 *    🔴 같은 `TEXT_CONFIRMED + NO_TITLE_OVERLAP` 에 `biskuit.kr`(human SAME · ₩88,000)이
 *       있다 ⟹ precision **1/2** — 그 조합을 끊어도 **순이득이 아니다**.
 *
 * 🔴 **정책을 결정하지 않았다**(CPO §11) — `if (matchTruth === …)` 류 코드 **0**.
 *    이 파일은 현재 owner 의 성질과 보호를 고정한다.
 */

const LIB = join(__dirname, "..");
const HARNESS = readFileSync(join(__dirname, "dif-02-identity-funnel.test.ts"), "utf8").replace(/\r\n/g, "\n");
/** 🔴 주석을 벗긴다 — 메모 `source-scan-must-strip-comments`. */
const CODE = HARNESS.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
const RUNNER = readFileSync(join(LIB, "run-domestic-price-check.ts"), "utf8").replace(/\r\n/g, "\n");
const RUNNER_CODE = RUNNER.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

describe("MT-01 P1/P2 — 운영 owner 의 값을 그대로 기록한다", () => {
  /** 🔴 MT-P1 — `matchTruth` 의 owner 는 `judgeDomesticCandidate` 다(재계산 0). */
  it("MT-P1 🔴 `matchTruth` 는 운영 반환값 그대로다", () => {
    expect(RUNNER_CODE, "운영 owner 가 바뀌었다").toContain("matchTruth: evidenceDecision.truth");
    expect(CODE).toContain('matchTruth: j.kind === "JUDGED" && isBest ? j.matchTruth : null');
  });

  /** 🔴 MT-P2 — `priceTier` 의 owner 는 `priceTierFromLink` 이고 runner 가 부른다. */
  it("MT-P2 🔴 `priceTier` 는 운영 반환값 그대로다", () => {
    expect(RUNNER_CODE).toContain("priceTier: priceTierFromLink({ matchTruth: evidenceDecision.truth, verified })");
    expect(CODE).toContain('tier: j.kind === "JUDGED" && isBest ? j.priceTier : null');
    /** 🔴 하니스가 스스로 만들지 않는다. */
    expect(CODE, "🔴 하니스가 tier 를 재계산한다").not.toContain("priceTierFromLink(");
  });
});

describe("MT-01 P3/P4 — 두 축이 독립이고 자격은 tier 가 결정한다", () => {
  /** 🔴 MT-P3 — 금액 존재와 가격 자격은 **서로 다른 계산** 이다. */
  it("MT-P3 🔴 `priceAmountPresent` 와 `priceEligible` 은 독립이다", () => {
    const at = CODE.indexOf("const eligible =");
    expect(at).toBeGreaterThan(-1);
    const line = CODE.slice(at, CODE.indexOf(";", at));
    expect(line).toContain("priceEligible");
    expect(line, "🔴 금액 존재로 자격을 계산한다").not.toContain("price != null");
    /** 🟢 실측이 그 독립을 보여준다 — SAME/PRESUMED 20 · 금액 20 · **자격 18**. */
    expect(CODE).toContain("priceAmountPresent");
  });

  /** 🔴 MT-P4 — `priceEligible` 은 `tier` 에서만 나온다(다른 입력 금지). */
  it("MT-P4 🔴 자격 술어는 `tier` 두 값뿐이다", () => {
    expect(CODE).toContain('j.priceTier === "EXACT" || j.priceTier === "COMPARISON"');
    /** 🟢 운영 owner 가 그 두 값을 실제로 낸다. */
    expect(priceTierFromLink({ matchTruth: "EXACT_IDENTIFIER", verified: true })).toBe("EXACT");
    expect(priceTierFromLink({ matchTruth: "STRONG_IDENTIFIER", verified: true })).toBe("EXACT");
    expect(priceTierFromLink({ matchTruth: "TEXT_CONFIRMED", verified: false })).toBe("COMPARISON");
  });
});

describe("MT-01 P5~P8 — 보호와 범위", () => {
  /**
   * 🔴 MT-P5 — `MODEL_CODE_AGE_LINE` 후보의 현재 결과는 **`EXCLUDED`** 다(실측 2/2 ·
   *    샵 대표 기준). 원인은 `matchTruth = CONFLICT` 이고 그것이 AGE-LINE-POLICY-01 의
   *    설계다(후보는 살리고 가격은 막는다).
   */
  it("MT-P5 🔴 품번 충돌(`CONFLICT`)은 `EXCLUDED` 다 — `verified` 로도 안 뒤집힌다", () => {
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: false })).toBe("EXCLUDED");
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: true })).toBe("EXCLUDED");
  });

  /**
   * 🟢 MT-P6 — `COMPOSITION`(세트)은 verdict `CONFLICT` 로 끝나고 가격 자격이 **0** 이다
   *    (실측 — CONFLICT 10건 중 가격 자격 **0** · 그 안에 COMPOSITION 1건).
   * 🔴 「SAME/PRESUMED 표에 그 행이 없다」를 「측정 안 했다」로 읽지 않는다 —
   *    이 계약이 **CONFLICT 전수** 를 세는 줄을 잠근다.
   */
  it("MT-P6 🟢 CONFLICT 전수의 가격 자격을 **세는 줄이 있다**", () => {
    expect(CODE).toContain('const conflictRows = rows.filter((r) => r.verdict === "CONFLICT")');
    expect(CODE).toContain('r.conflicts.includes("COMPOSITION")');
    expect(priceTierFromLink({ matchTruth: "CONFLICT", verified: false })).toBe("EXCLUDED");
  });

  /**
   * 🔴 MT-P7 — 누출 후보의 전 칸이 **보존돼 보고된다**. 숨기면 다음 정책이 그 근거를 잃는다.
   */
  it("MT-P7 🔴 누출 행을 `truth`·`tier`·`blockers` 와 함께 적는다", () => {
    const at = CODE.indexOf("【E. Human DIFFERENT 누출");
    expect(at, "누출 보고 블록이 사라졌다").toBeGreaterThan(-1);
    const block = CODE.slice(at, at + 700);
    for (const w of ["truth=", "tier=", "elig=", "blockers="]) expect(block, w).toContain(w);
    /** 🔴 그 분모 술어도 잠근다 — human DIFFERENT **그리고** 가격 자격이 있는 행이다. */
    expect(CODE).toContain('x.human === "DIFFERENT" && x.priceEligible');
  });

  /**
   * 🔴🔴 MT-P8 — **정책을 구현하지 않았다**(CPO §11). 운영 코드에 `matchTruth` 나
   *    blocker 이름으로 **가격을 가르는 분기** 를 넣지 않았다.
   */
  it("MT-P8 🔴 가격 자격 owner 가 blocker·matchTruth 분기를 **갖지 않는다**", () => {
    const src = readFileSync(
      join(LIB, "../../domestic-price-sources/_lib/domestic-product-link.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const at = src.indexOf("export function priceTierFromLink");
    expect(at).toBeGreaterThan(-1);
    const body = src.slice(at, src.indexOf("\n}", at)).replace(/\/\*[\s\S]*?\*\//g, " ");
    /** 🔴 blocker 를 보기 시작하면 정책이 바뀐 것이다. */
    expect(body, "🔴 가격 자격이 blocker 를 본다").not.toContain("blocker");
    /** 🔴 이 WU 가 금지한 특정 이름 분기가 **없다**. */
    for (const w of ["AUDIENCE_LINE", "MODEL_CODE_AGE_LINE", "NO_TITLE_OVERLAP"])
      expect(body, `🔴 ${w} 전용 분기가 생겼다`).not.toContain(w);
  });
});
