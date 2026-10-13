import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-COST-MINIMUM-ARCHITECTURE-016 — Gemini 를 «최후의 보조층» 으로 내린다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **Gemini API 호출 0.** 소스 계약만 본다(₩3,300 보존).
 *    🔴 소스 문자열 검사는 **주석을 벗기고** 한다(헌장 §5 · 여덟 번 걸린 함정).
 *
 * 확정된 개발 원칙(CPO 2026-10-13):
 * ```
 * 기존 MI / 국내 검색 → 결정적으로 찾을 수 있는 후보 우선
 *   → **그래도 못 찾은 경우만** Gemini → 1회 · Primary 1개 · 후보 최대 3
 *   → 기존 MI 판정 → 가격 확인 가능한 경우만 등록 판단에 반영
 * ```
 *
 * 🟢 **새 threshold 를 만들지 않았다** — 게이트는 이 리포가 이미 쓰는
 *    `matchLevel === "very_high"`(=`foundVeryHighInP0`)와 **같은 조건** 이다.
 */

const LIB = path.join(__dirname, "..");
const strip = (f: string) =>
  readFileSync(path.join(LIB, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
const RUNNER = strip("run-domestic-price-check.ts");
const POOL = strip("gemini-candidate-pool.ts");

/* ══════════════ ① 호출 자체를 최소화 — deterministic 우선 ══════════════ */

describe("① 🔴🔴 결정적 후보가 있으면 Gemini 를 부르지 않는다", () => {
  it("게이트가 Gemini 블록 «앞» 에 있다 — 순서가 뒤면 이미 부른 뒤다", () => {
    const gate = RUNNER.indexOf("const deterministicHit = searchResults.some(");
    const call = RUNNER.indexOf("await collectGeminiCandidatePool(");
    expect(gate).toBeGreaterThan(-1);
    expect(call).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(call);
  });

  it("🟢 기존 `very_high` 조건을 **재사용** 한다 — 새 threshold 가 아니다", () => {
    expect(RUNNER).toContain('c.matchLevel === "very_high"');
    /** 🔴 같은 조건이 두 곳에 있어야 한다 — 기존 foundVeryHighInP0 와 새 게이트. */
    const hits = RUNNER.match(/c\.matchLevel === "very_high"/g) ?? [];
    expect(hits.length).toBe(2);
    /** 🔴 Gemini 전용 숫자 threshold 를 새로 만들지 않았다. */
    expect(RUNNER).not.toMatch(/GEMINI_[A-Z_]*THRESHOLD|geminiThreshold/i);
  });

  it("🔴 건너뛴 이유를 「0 회」와 구분해 돌려준다", () => {
    expect(RUNNER).toContain('geminiSkipReason = "DETERMINISTIC_HIT"');
    expect(RUNNER).toContain("geminiSkipReason,");
  });

  it("🔴 스킵 상태에서는 pool 을 부르지 않는다 — 조건이 함께 걸려 있다", () => {
    expect(RUNNER).toContain("isGeminiDiscoveryEnabled() && geminiSkipReason === null");
  });
});

/* ══════════════ ⑤ 같은 상품 반복 호출 방지 ══════════════ */

describe("⑤ 🔴 같은 상품을 같은 날 다시 부르지 않는다", () => {
  it("기존 멱등 장치를 «읽기만» 쓴다 — 새 저장 0", () => {
    expect(RUNNER).toContain('hasObservationToday(input.snapshotId, "DOMESTIC_SHOP")');
    expect(RUNNER).toContain('geminiSkipReason = "ALREADY_CHECKED_TODAY"');
  });

  /**
   * 🔴🔴 **전체 경로가 아니라 Gemini 블록만 막는다.** `skipIfCheckedToday` 를 켜면
   *    국내 재확인 자체가 막히고 그것은 **기존 제품 동작 변경** 이다 —
   *    「지금 확인」 route(`check/route.ts`)는 그 플래그를 쓰지 «않는다».
   */
  it("🔴 check route 의 기존 동작을 바꾸지 않았다(skipIfCheckedToday 를 켜지 않는다)", () => {
    const route = readFileSync(path.join(LIB, "..", "check", "route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(route).not.toContain("skipIfCheckedToday");
  });

  it("🟢 deterministic 히트면 당일 확인 조회조차 하지 않는다(DB 읽기도 아낀다)", () => {
    expect(RUNNER).toContain("deterministicHit ? false : await hasObservationToday");
  });
});

/* ══════════════ ③ 후보 최대 3 ══════════════ */

describe("③ 🔴 후보 상한 3 은 호출부가 준다 — 모듈에 박지 않는다", () => {
  it("상한이 운영 호출부에 명시돼 있다", () => {
    expect(RUNNER).toContain("maxCandidates: 3");
    expect(RUNNER).toContain("targetUsable: 3");
  });

  it("pool 이 그 상한을 실제로 지킨다", () => {
    expect(POOL).toContain("candidates.length >= input.maxCandidates");
    expect(POOL).toContain("candidates.length >= input.targetUsable");
  });

  it("🔴 모듈에 하드코딩된 상한이 없다", () => {
    expect(POOL).not.toMatch(/maxCandidates\s*=\s*\d/);
  });
});

/* ══════════════ ② Primary 1개 · grounding 최소화 ══════════════ */

describe("② 🔴 Primary Query 는 언제나 1개다", () => {
  it("buildPrimaryQuery 하나만 쓴다 — 8축 열거기를 쓰지 않는다", () => {
    expect(POOL).toContain("buildPrimaryQuery(identity)");
    expect(POOL).not.toContain("generateQueries(");
  });

  it("🟢 Primary 를 만들 수 없으면 **호출하지 않는다**", () => {
    expect(POOL).toContain("NO_PRIMARY_QUERY");
    const i = POOL.indexOf("NO_PRIMARY_QUERY");
    /** 🔴 그 분기가 `return` 으로 끝나야 한다 — 로그만 찍고 계속 가면 비용이 난다. */
    expect(POOL.slice(i, i + 200)).toContain("return { searchResults: [], metrics }");
  });

  it("🔴 grounding 을 실측한다 — 개수와 «문자열» 둘 다", () => {
    expect(POOL).toContain("groundingQueries");
    expect(POOL).toContain("groundingQueryTexts");
  });
});

/* ══════════════ ④⑦ 가치 없는 후보 조기 폐기 ══════════════ */

describe("④⑦ 🔴 가격 evidence 가 될 수 없는 후보는 집계에 들어가지 않는다", () => {
  it("가격 없는 후보에 추가 Gemini 호출을 하지 않는다 — 후보당 호출이 없다", () => {
    /** 🟢 Gemini 호출은 **상품당** 이다. 후보 루프 안에 호출이 없어야 한다. */
    const loopStart = POOL.indexOf("for (const found of discovery.urls)");
    const loopEnd = POOL.indexOf("if (candidates.length === 0)");
    const body = POOL.slice(loopStart, loopEnd);
    expect(body).not.toContain("createProductionGoogleDiscovery");
  });

  it("🟢 self-reference 를 가격 보강 «앞» 에서 뺀다 — HTTP 낭비 금지", () => {
    const self = RUNNER.indexOf("const notSelf = r.candidates.filter");
    const enrich = RUNNER.indexOf("enrichCandidatePrices(scored");
    expect(self).toBeGreaterThan(-1);
    expect(enrich).toBeGreaterThan(self);
  });

  it("🔴 priceKrw 가 없으면 국내 가격 버킷에 들어가지 않는다", () => {
    const intel = strip("market-intelligence.ts");
    expect(intel).toContain("if (e.priceKrw == null)");
  });
});

/* ══════════════ ⑥ Vision 을 Discovery 와 분리 ══════════════ */

describe("⑥ 🔴 Vision 은 Discovery 와 **별도 비용** 이다 — 합산하지 않는다", () => {
  it("Vision 호출 수를 별도 칸으로 돌려준다", () => {
    expect(RUNNER).toContain("visionCalls: visionCallCount.n");
  });

  it("🔴 Discovery 칸과 섞이지 않는다 — 세 칸이 각각 있다", () => {
    for (const field of ["geminiMetrics", "geminiPriceEnrichCalls", "visionCalls"]) {
      expect(RUNNER).toContain(field);
    }
    /** 🔴 Vision 수를 geminiCalls 에 더하는 코드가 없어야 한다. */
    expect(RUNNER).not.toMatch(/geminiCalls\s*\+=\s*visionCallCount/);
  });
});

/* ══════════════ 불변 — 금지 사항 ══════════════ */

describe("🔴 금지 사항을 어기지 않았다 (§23)", () => {
  it("DB 저장·schema·가격추적·UI 를 건드리지 않았다", () => {
    const loop = POOL + RUNNER.slice(RUNNER.indexOf("if (isGeminiDiscoveryEnabled()"));
    for (const forbidden of ["migration", "ALTER TABLE", "CREATE TABLE"]) {
      expect(loop).not.toContain(forbidden);
    }
  });

  it("flag 는 여전히 기본 OFF 다", () => {
    expect(POOL).toContain('process.env[GEMINI_DISCOVERY_FLAG] === "true"');
  });

  it("🔴 threshold 를 완화하지 않았다 — SAME_MIN 류 어휘가 없다", () => {
    expect(POOL).not.toMatch(/SAME_MIN|MIN_AXES|THRESHOLD/i);
  });
});
