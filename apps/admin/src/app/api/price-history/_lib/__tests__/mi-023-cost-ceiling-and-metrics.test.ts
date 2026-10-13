/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-023 §1/§2 — **비용 상한을 파라미터가 지키는가 + 계측이 관찰 가능한가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 WU 의 첫 Production 호출은 **되돌릴 수 없는 지출** 이다. 그래서 「1 call 이
 *    되겠지」를 **구조로** 잠근다 — 사전점검에서 확인한 것이 바로 그 위험이었다:
 *    상한을 **배열 길이** 가 지키고 파라미터(`maxQueries: 2`)는 지키지 않았다.
 * 🔴 Gemini 호출 0 · HTTP 0 · DB 0.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIB = path.join(__dirname, "..");
const strip = (f: string) =>
  readFileSync(path.join(LIB, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
const RUNNER = strip("run-domestic-price-check.ts");
const POOL = strip("gemini-candidate-pool.ts");

/* ═══════════════ ① §2 — 상품당 Gemini 1 call 을 «파라미터가» 지킨다 ═══════════════ */

describe("① 🔴🔴 상품당 Gemini 호출 상한 = 1", () => {
  it("호출부가 `maxQueries: 1` 을 넘긴다 — 2 로 되돌리면 FAIL", () => {
    expect(RUNNER).toContain("maxQueries: 1,");
    /** 🔴 과거 값이 남아 있으면 상한이 느슨해진다. */
    expect(RUNNER).not.toContain("maxQueries: 2,");
  });

  it("pool 이 그 상한을 실제로 **자른다**", () => {
    /** 🟢 술어까지 잠근다 — 상수로 치환하면 FAIL 해야 한다. */
    expect(POOL).toContain("].slice(0, Math.max(1, input.maxQueries));");
  });

  it("🔴 Primary 가 하나뿐이라는 전제에 **의존하지 않는다** — slice 가 유일한 상한이다", () => {
    /**
     * 🔴 사전점검의 핵심: 지금은 배열이 1개라 1 call 이지만, 그것은 **우연** 이다.
     *    `maxQueries: 1` + slice 조합이면 배열이 몇 개가 되든 1 call 이다.
     */
    const call = POOL.indexOf("createProductionGoogleDiscovery(");
    const loop = POOL.lastIndexOf("for (const query of queries)", call);
    expect(loop).toBeGreaterThan(0);
    expect(loop).toBeLessThan(call);
    /** 🔴 루프가 `queries` 를 도므로, `queries.length` 가 곧 호출 수 상한이다. */
    expect(POOL).toContain("for (const query of queries)");
  });

  it("후보 상한 3 · targetUsable 3 이 그대로다(§5)", () => {
    expect(RUNNER).toContain("maxCandidates: 3,");
    expect(RUNNER).toContain("targetUsable: 3,");
  });
});

/* ═══════════════ ② §1/§11 — 계측값이 로그로 «나간다» ═══════════════ */

describe("② 🔴🔴 §11 계측표를 로그에서 읽을 수 있다", () => {
  /**
   * 🔴🔴 **구간을 글자 수로 자르지 않는다.** 처음에 `+1400` 으로 잘랐더니 로그 밖의
   *    `enrichCandidatePrices`/`priced` 까지 먹어서 「price 어휘 없음」 단언이 거짓
   *    FAIL 했다. 🔴 이번 세션에서 **세 번째** 같은 실수다(엉뚱한 구간 단언).
   * 🟢 그래서 **로그 문장의 시작과 끝** 으로 끊는다 — 마지막 칸이 `failureDetails` 다.
   */
  const LOG_START = "[MI-023-metrics]";
  const LOG_END = "failureDetails: geminiMetrics.failureDetails,";
  const logBlock = (() => {
    const a = RUNNER.indexOf(LOG_START);
    const b = RUNNER.indexOf(LOG_END, a);
    if (a < 0 || b < 0) return "";
    return RUNNER.slice(a, b + LOG_END.length);
  })();

  it("`[MI-023-metrics]` 한 줄이 flag 분기 «안» 에 있다 — OFF 면 안 찍힌다", () => {
    expect(RUNNER).toContain("[MI-023-metrics]");
    const flagGate = RUNNER.indexOf("isGeminiDiscoveryEnabled() && geminiSkipReason === null");
    const log = RUNNER.indexOf("[MI-023-metrics]");
    expect(flagGate).toBeGreaterThan(0);
    expect(log).toBeGreaterThan(flagGate);
  });

  it("🔴 §11 이 요구한 칸이 **전부** 찍힌다", () => {
    const REQUIRED = [
      "geminiCalls",
      "inputTokens",
      "outputTokens",
      "totalTokens",
      "groundingQueries",
      "discoveredUrls",
      "usableProductUrls",
      "miEligibleCandidates",
      "queriesUsed",
      "model",
      "outcomes",
    ];
    expect(logBlock).not.toBe("");
    for (const key of REQUIRED) expect(logBlock).toContain(`${key}: geminiMetrics.${key}`);
  });

  it("🔴 로그가 값을 **계산하지 않는다** — pool 산출을 그대로 옮긴다(비용 추정 금지)", () => {
    expect(logBlock).not.toBe("");
    /** 🔴 사칙연산이나 환율·단가 어휘가 끼면 그것은 «추정» 이다. */
    expect(logBlock).not.toMatch(/[*/]\s*\d/);
    expect(logBlock).not.toMatch(/krw|cost|price|won/i);
  });
});

/* ═══════════════ ③ 금지사항이 지켜졌는가 (§2) ═══════════════ */

describe("③ 🔴 WU-023 §2 — 판정/정책을 건드리지 않았다", () => {
  it("threshold·판정 규칙 어휘를 새로 만들지 않았다", () => {
    expect(RUNNER).not.toMatch(/GEMINI_[A-Z_]*THRESHOLD|geminiThreshold/i);
    /** 🟢 기존 very_high 조건이 그대로 두 곳이다(WU-016 계약). */
    expect((RUNNER.match(/c\.matchLevel === "very_high"/g) ?? []).length).toBe(2);
  });

  it("저장 차단·당일 가드가 그대로다", () => {
    expect(RUNNER).toContain("if (result.shopId === GEMINI_VIRTUAL_SHOP_ID) {");
    expect(RUNNER).toContain('if (deterministicHit) geminiSkipReason = "DETERMINISTIC_HIT";');
    expect(RUNNER).toContain('else if (checkedToday) geminiSkipReason = "ALREADY_CHECKED_TODAY";');
  });
});
