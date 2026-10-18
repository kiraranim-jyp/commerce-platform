import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-082 — **자동 1회차 응답 배선** · **시장조사 카테고리 사용처**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 원인(실측): `pipeline/page.tsx` 의 자동 1회차 `POST /api/price-history/check` 가
 *    `.catch`/`.finally` 만 달고 **body 를 읽지 않았다**. 그 응답에만 있는 참고 축
 *    (국내/해외 transient)이 **통째로 버려졌고**, GET 경로는 transient 를 넘기지
 *    않는다(WU-049/056). ⟹ 「🔄 다시 분석」을 누르기 전에는 국내 가격비교가 **없다**.
 *
 * 🔴 UI 상호작용은 `wu-082-auto-check-render.test.ts`(마운트 DOM)가 본다 — 두 축을 가른다.
 *    이 파일은 **배선이 끊기면 FAIL** 하는 소스 계약이다(주석을 벗기고 본다).
 */

/** 🔴 **경로를 추측하지 않는다** — 처음에 `src/app/pipeline/api/...` 로 써서 ENOENT 가 났다. */
const PIPELINE = path.join(__dirname, "..", "..");
const APP = path.join(PIPELINE, "..");
const read = (p: string) => readFileSync(path.join(PIPELINE, p), "utf8");
const readApp = (p: string) => readFileSync(path.join(APP, p), "utf8");
/** 🔴 헌장 §5 — 소스 검사는 **주석을 벗기고** 한다(여덟 번 걸린 함정). */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const page = strip(read("page.tsx"));
const workspace = strip(read("CommerceWorkspace.tsx"));
const panel = strip(read("commerce/DomesticPriceIntelligencePanel.tsx"));

describe("WU-082 — 자동 1회차 응답이 화면까지 간다", () => {
  it("🔴 page.tsx 가 응답을 **읽는다**(이 줄이 사라지면 국내 가격비교가 다시 사라진다)", () => {
    expect(page).toContain("setAutoCheckResult(json)");
    expect(page).toMatch(/await res\.json\(\)/);
    /** 🔴 stale-guard 를 쓴다 — 다른 상품의 응답을 현재 화면에 붙이지 않는다. */
    expect(page).toContain("productRef.current?.sourceUrl === requestedForSourceUrl");
  });

  it("🔴 page → CommerceWorkspace → Panel 로 **끊김 없이** 전달된다", () => {
    expect(page).toContain("autoCheckResult={autoCheckResult}");
    expect(workspace).toContain("autoCheckResult,");
    expect(workspace).toContain("autoCheckResult={autoCheckResult}");
    expect(panel).toContain("autoCheckResult,");
  });

  it("🔴 **누적하지 않는다** — WU-030 계약(상품 A→B 에 후보가 남지 않는다)", () => {
    /**
     * 🔴🔴 1차 구현이 `prev ?? …` 였고 **WU-030 가 그것을 FAIL 로 잡았다.**
     *    🟢 그리고 `prev` 는 **필요도 없었다** — 이 effect 는 `autoCheckResult` 가
     *       바뀔 때만 돌고 「🔄 다시 분석」은 그 값을 바꾸지 않는다.
     */
    expect(panel).toContain("setDomesticReference(j.domesticReference ?? null)");
    expect(panel).toContain("setOverseasReference(j.overseasReference ?? null)");
    expect(panel).toContain("setUrlCandidateEvidence(j.domesticShop?.urlCandidateEvidence ?? null)");
    /** 🔴 정규식 이스케이프가 편집 층을 지나며 **다섯 번** 깨졌다 — 문자열 포함으로 간다. */
    expect(panel).not.toContain("setGeminiEvidence((prev)");
    expect(panel).not.toContain("setUrlCandidateEvidence((prev)");
  });

  it("🔴 effect 의 **가드와 의존성** 이 살아 있다(W4 를 무는 자리)", () => {
    /** 🔴 이 줄을 `return;` 으로 바꾸면 자동 1회차 값이 다시 버려진다. */
    expect(panel).toContain(`if (!autoCheckResult || typeof autoCheckResult !== "object") return;`);
    expect(panel).toContain("}, [autoCheckResult]);");
    /** 🔴 네 축을 **모두** 채운다 — 하나라도 빠지면 그 구역이 화면에서 사라진다. */
    for (const setter of ["setOverseasReference", "setDomesticReference", "setGeminiEvidence", "setUrlCandidateEvidence"]) {
      expect(panel).toContain(setter + "(j.");
    }
  });

  it("🔴 **새 호출을 만들지 않았다** — page.tsx 의 check POST 는 여전히 1개다", () => {
    const calls = page.match(/fetch\("\/api\/price-history\/check"/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it("🔴 자동 1회차 응답이 **판정/집계 어휘와 같은 줄에 서지 않는다**", () => {
    const FORBIDDEN = ["sellerDecision", "domesticCompetition", "representativeVerdict", "priceLevel", "recommendation"];
    const lines = panel.split(String.fromCharCode(10)).filter((l) => l.includes("autoCheckResult"));
    expect(lines.filter((l) => FORBIDDEN.some((f) => l.toLowerCase().includes(f.toLowerCase())))).toEqual([]);
  });

  it("🔴 GET 경로가 참고 축을 **덮지 않는다**(WU-059 계약 유지)", () => {
    /** 🟢 참고 축 setter 는 POST 응답과 이번 effect 에서만 호출된다. */
    const setters = panel.match(/setDomesticReference\(/g) ?? [];
    expect(setters.length).toBeLessThanOrEqual(2);
    expect(panel).not.toMatch(/loadPriceHistory[\s\S]{0,400}setDomesticReference/);
  });
});

/**
 * ── 🟢 시장조사 카테고리 — **실제로 쓰인다**(제거 GO 조건 A 불충족) ─────────
 * ```
 * ① 어느 국내 샵을 뒤질지   resolveMarketCategoryScopes(product, marketCategoryProfileId)
 *      check/route.ts:100 · trigger-domestic-price-check.ts:76 → `categoryScopes`
 * ② 해외 비교 scope         comparison/search/route.ts:84 selectedMarketSourceScopes(...)
 * ③ **원가 정책**           market-intelligence.ts:568 resolveCategoryCostPolicy(...)
 * ```
 * 🔴 ③ 이 결정적이다 — 카테고리가 **가격 계산에 들어간다**. 「표시만 하는 값」이 아니다.
 * 🟢 반면 **셀러가 URL 을 직접 주는 경로**(`collectUrlCandidatePool`)는 카테고리를
 *    **쓰지 않는다**(전수 grep 0). 그러나 그 경로만 따로 떼어 낼 수 없다 —
 *    같은 분석 1회가 ①②③ 을 함께 돌린다.
 */
describe("WU-082 — 시장조사 카테고리 사용처(제거 금지 근거)", () => {
  const checkRoute = strip(readApp("api/price-history/check/route.ts"));
  const trigger = strip(readApp("api/price-history/_lib/trigger-domestic-price-check.ts"));
  const mi = strip(readApp("api/price-history/_lib/market-intelligence.ts"));
  const urlPool = strip(readApp("api/price-history/_lib/url-candidate-pool.ts"));

  it("🔴 ① 국내 샵 **검색 범위** 를 정한다", () => {
    expect(checkRoute).toContain("resolveMarketCategoryScopes(product, snapshot.workspace.marketCategoryProfileId)");
    expect(trigger).toContain("resolveMarketCategoryScopes(product, input.marketCategoryProfileId)");
  });

  it("🔴 ③ **원가 정책** 에 들어간다 — 가격 계산에 영향이 있다", () => {
    expect(mi).toContain("resolveCategoryCostPolicy(marketCategoryProfileId)");
  });

  it("🟢 그러나 **셀러 URL 직접 입력 경로** 는 카테고리를 쓰지 않는다", () => {
    expect(urlPool).not.toMatch(/marketCategory|categoryProfile|categoryScopes/);
  });
});
