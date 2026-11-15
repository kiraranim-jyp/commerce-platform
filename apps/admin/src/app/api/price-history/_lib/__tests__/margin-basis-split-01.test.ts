import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MARGIN-BASIS-SPLIT-01 — **참고가격은 살리고, 마진 근거만 좁힌다**(CPO ⒞ 승인)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **정책 반전을 먼저 적는다.** 과거 CPO ④⑤ 는 「참고가격과 마진은 같은 집합」이었고
 *    오늘 ⒞ 가 그것을 **폐기** 했다(CPO 명시 승인):
 * ```
 * 국내 참고가격   PRESUMED_SAME / COMPARISON 가격도 **보여준다**(근사치 허용)
 * 예상 마진       PRESUMED_SAME 에서 온 가격은 **근거에서 제외** 한다
 * 마진 근거 없음  🔴 **숫자를 지어내지 않는다** — 미표시 / 근거 부족
 * ```
 *
 * 🔴🔴 **운영 DB 실측(그대로 적는다 · 추정 아님)**:
 * ```
 * price_tier=COMPARISON 233행 → system_verdict=PRESUMED_SAME **233 (100%)**
 * price_tier=EXACT       76행 → system_verdict=SAME            75 · null 1
 * PRESUMED_SAME ∩ COMPARISON ∩ human DIFFERENT                **11건**
 * 가격 근거 보유 스냅샷  110 → 62 (48개가 **마진 근거만** 잃는다 · 참고가격은 유지)
 * ```
 * 🔴🔴 **그래서 「다른 경로의 COMPARISON 보존」은 운영 데이터로 «증명되지 않았다»** —
 *    그 모양이 **0건** 이다. 아래 C 는 **합성 표본** 으로만 잠근다.
 *    🔴 이것을 「운영에서 확인됐다」로 보고하지 않는다.
 */
const MI_SRC = join(
  process.cwd(),
  "src/app/api/price-history/_lib/market-intelligence.ts",
);
const MI = readFileSync(MI_SRC, "utf8");
/** 🔴 주석을 벗긴다 — 이 저장소가 여덟 번 걸린 함정(주석의 글자가 통과시킨다). */
const BODY = MI.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("MARGIN-BASIS-SPLIT-01", () => {
  /* ─────────────────── A. 참고가격 축은 «불변» 이다 ─────────────────── */

  it("A-1 🟢 참고가격 출력이 옛 집계 그대로다 — 「🇰🇷 국내 참고」 숫자 불변", () => {
    expect(BODY).toContain("candidateDomesticPrice: domesticCandidatePriceSummary,");
    expect(BODY).toContain("summarizeCandidateOverseasPrices(domesticTransientRecords)");
  });

  it("A-2 🔴 참고가격 적재 게이트에 verdict 조건이 «없다»(근사치 허용)", () => {
    /**
     * 🔴 참고가격 배열에 PRESUMED 제외를 걸면 CPO ⒞ 의 「참고가격 유지」가 깨진다.
     *    실측상 그러면 COMPARISON 233행 전수가 사라진다.
     */
    const pushIdx = BODY.indexOf("domesticTransientRecords.push");
    expect(pushIdx).toBeGreaterThan(-1);
    const gate = BODY.slice(Math.max(0, pushIdx - 220), pushIdx);
    expect(gate).toContain('e.priceTier === "EXACT" || e.priceTier === "COMPARISON"');
    expect(gate).not.toContain("crossSellerVerdict");
  });

  /* ─────────────────── B. 마진 축은 PRESUMED 를 «뺀다» ─────────────────── */

  it("B-1 🔴 마진 근거 배열이 PRESUMED_SAME 을 제외한다", () => {
    expect(BODY).toContain("isPresumedSameVerdict(e.crossSellerVerdict)");
    expect(BODY).toContain("marginBasisRecords.push");
  });

  it("B-2 🔴 마진 네 칸이 «마진 근거 집계» 에서 온다 — 분모 하나", () => {
    expect(BODY).toContain("referencePriceKrw: marginBasisSummary.byCurrency.KRW?.lowestAmount");
    expect(BODY).toContain("sellerCount: marginBasisSummary.byCurrency.KRW?.count ?? 0");
    expect(BODY).toContain("excludedUnverified: marginBasisSummary.unverifiedCount");
    expect(BODY).toContain("excludedObservedDifference: marginBasisSummary.observedDifferenceCount");
    /** 🔴 옛 배선이 하나라도 남으면 분모가 둘이 된다. */
    expect(BODY).not.toContain("referencePriceKrw: domesticCandidatePriceSummary");
    expect(BODY).not.toContain("sellerCount: domesticCandidatePriceSummary");
  });

  it("B-3 🟢 두 집계가 «같은 집계기» 를 쓴다(사본 0) · 각 한 번만 부른다", () => {
    expect(BODY.split("summarizeCandidateOverseasPrices(domesticTransientRecords)").length - 1).toBe(1);
    expect(BODY.split("summarizeCandidateOverseasPrices(marginBasisRecords)").length - 1).toBe(1);
  });

  /* ────────── C. 다른 경로의 COMPARISON 은 «보존» 된다 (합성) ────────── */

  it("C-1 🔴 `priceTier` 로 거르지 않는다 — 합성 표본으로만 잠근다", () => {
    /**
     * 🔴🔴 **현재 운영 데이터에 「PRESUMED 아닌 COMPARISON」은 0건이다.**
     *    그래서 이 조건은 **미래 방어** 다 — 그 경로가 생기는 날 tier 로 걸러 버리면
     *    근거가 조용히 사라진다.
     * 🟢 구조로 단언한다 — 제외 조건이 **verdict 하나** 이고 tier 를 보지 않는다.
     */
    const idx = BODY.indexOf("marginBasisRecords.push");
    expect(idx).toBeGreaterThan(-1);
    const cond = BODY.slice(Math.max(0, idx - 180), idx);
    expect(cond).toContain("crossSellerVerdict");
    expect(cond).not.toContain("priceTier");
  });

  /* ─────────── D. null / undefined 는 PRESUMED 가 «아니다» ─────────── */

  it("D-1 🔴 제외 조건이 `!==` 이다 — null/undefined 를 통과시킨다", () => {
    /**
     * 🔴 「모른다」를 「PRESUMED 다」로 취급하면 근거가 조용히 사라진다
     *    (이 저장소의 「미측정 ≠ 0」 원칙).
     * 🟡 실측(candidate_reviews) — verdict null 17행 중 **16행은 price_tier 가 null**
     *    이라 가격 집계에 애초에 못 들어가고, 진입 가능한 것은 1건(tier EXACT ·
     *    human SAME · snapshot_id 도 null)이다. 🔴 단 그것은 «사람 검토 저장소» 분모이고
     *    **라이브 transient 경로의 null 비율은 미측정** 이다.
     */
    expect(BODY).toContain("isPresumedSameVerdict(e.crossSellerVerdict)");
    /** 🔴 포함식(`=== "SAME"`)으로 바뀌면 null 이 함께 죽는다. */
    expect(BODY).not.toMatch(/marginBasisRecords[\s\S]{0,200}crossSellerVerdict === "SAME"/);
  });

  /* ─────────── E. 근거가 없으면 숫자를 «만들지 않는다» ─────────── */

  it("E-1 🔴 마진 근거가 없을 때 기본값·상수를 끼워넣지 않는다", () => {
    /**
     * 🔴 `?? 0` 이 **기준가** 에 붙으면 「원가 대비 마진 -100%」 같은 거짓이 나온다.
     *    `sellerCount` 의 `?? 0` 은 **개수** 라 올바르다 — 둘을 구분해 단언한다.
     */
    expect(BODY).toContain("referencePriceKrw: marginBasisSummary.byCurrency.KRW?.lowestAmount ?? null");
    expect(BODY).not.toContain("referencePriceKrw: marginBasisSummary.byCurrency.KRW?.lowestAmount ?? 0");
  });

  it("E-2 🟢 판정 축을 건드리지 않았다 — SAME 임계값·축·blocker 변경 0", () => {
    /** 🔴 이 파일에서 판정을 다시 만들면 owner 가 둘이 된다(CPO 금지). */
    expect(BODY).not.toContain("SAME_MIN_AXES");
    expect(BODY).not.toContain("compareCrossSellerProducts");
  });

  it("E-3 🔴 사람 판정이 가격 집계로 들어오지 않는다 — WU-081/131 계약 유지", () => {
    /** 🔴 CPO 가 보류한 축이다. `candidate_reviews` 가 이 계산에 닿으면 안 된다. */
    expect(BODY).not.toContain("candidate_reviews");
    expect(BODY).not.toContain("human_verdict");
    expect(BODY).not.toContain("humanVerdict");
  });
});
