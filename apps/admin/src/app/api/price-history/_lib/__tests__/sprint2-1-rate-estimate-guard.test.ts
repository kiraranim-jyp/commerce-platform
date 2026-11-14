/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 SPRINT2-① — **환율이 확인되지 않은 원가는 수익성/추천가를 만들지 못한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 생겼나(실측 2026-11-14)**
 *    `convertToKrw`(packages/pricing/src/currency.ts:31)는 환율을 모르면
 *    **원본 금액을 그대로 KRW 로** 돌려주고 `isEstimate: true` 만 붙인다.
 *    운영 DB 에 **CAD 84 → ₩84** 가 4행/2스냅샷 저장돼 있었고 그 스냅샷엔
 *    **대체 원가가 없다**(KR_MARKET·MARKET_PROBE 둘 다 0).
 * 🔴🔴 그 값이 원가로 들어가면 운영 함수가 실제로 이것을 낸다(직접 호출 실측):
 *    ```
 *    원가 ₩84 · 국내 EXACT 88,000 → **CASE A · 추천 ₩87,120 · 마진 99.9%**
 *    ```
 *    ⟹ 셀러가 **팔면 안 되는 상품을 「추천」으로** 본다.
 *
 * 🟢 **고친 곳은 한 곳이다** — `market-intelligence.ts` 의 추천가 호출 앞.
 *    공용 `convertToKrw` · `computeLandedCost` · `computePriceBreakdown` 은
 *    **한 글자도 바꾸지 않았다**(그 셋은 이미 `isRateEstimate` 를 정직하게
 *    돌려주고 있었고 문제는 **아무도 그 플래그를 읽지 않은 것** 이었다).
 *
 * 🔴 이 파일이 잠그는 것 — ⒜ 가드가 **추천가 호출 앞에** 있다 ⒝ 플래그를
 *    **그 이름 그대로** 읽는다 ⒞ **환율이 확인된 경로는 불변** 이다
 *    ⒟ 원본 금액·통화를 지우는 수정이 **아니다**.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computePriceRecommendation } from "@commerce/pricing";

const RAW = readFileSync(join(__dirname, "..", "market-intelligence.ts"), "utf8");
/** 🔴 **주석을 벗기고** 본다 — 이 리포가 여덟 번 밟은 함정이다. */
const SRC = RAW.split(String.fromCharCode(13))
  .join("")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ");

describe("SPRINT2-① 환율 미확인 원가 차단", () => {
  it("A-1 🔴 가드가 **추천가 호출보다 앞에** 있다", () => {
    const call = SRC.indexOf("recommendation = computePriceRecommendation({");
    expect(call, "🔴 추천가 호출 지점이 사라졌다").toBeGreaterThan(0);
    const guard = SRC.lastIndexOf("cost.isRateEstimate", call);
    expect(guard, "🔴 환율 미확인 가드가 없다 — CAD ₩84 가 CASE A 를 만든다").toBeGreaterThan(0);
    expect(guard).toBeLessThan(call);
  });

  it("A-2 🔴 가드는 **부정 조건**으로 건다(추정이면 만들지 않는다)", () => {
    expect(SRC, "🔴 `if (!cost.isRateEstimate)` 모양이 깨졌다").toContain(
      "if (!cost.isRateEstimate)",
    );
  });

  /**
   * 🔴 **1차에 내가 틀렸고 계약이 잡았다** — 이 파일은 원래 «안전한»
   *    `convertToKrwStrict`(환율 없으면 **null**)를 쓰고 있었다. 그것을 금지하면
   *    기존 정상 동작을 막는다. 🟢 금지 대상은 **관대한 `convertToKrw(`** 하나다
   *    (그 함수가 환율을 모를 때 **금액을 그대로** 돌려주는 쪽이다).
   * 🟢 문자열이 정확히 갈린다 — `convertToKrwStrict(` 안에는 `convertToKrw(` 가 없다.
   */
  it("A-3 🔴 **관대한 변환 함수를 이 파일이 직접 쓰지 않는다**(Strict 는 허용)", () => {
    expect(SRC, "🔴 환율 없이 금액을 그대로 쓰는 변환이 들어왔다").not.toContain("convertToKrw(");
    expect(SRC, "🟢 안전한 Strict 경로는 원래 쓰고 있었다 — 사라지면 안 된다").toContain(
      "convertToKrwStrict",
    );
  });

  it("A-4 🔴 **원본 금액·통화를 지우지 않는다** — 지우는 것은 추천/수익성뿐", () => {
    for (const banned of ["priceAmount = null", "priceCurrency = null", "originalAmount = null"]) {
      expect(SRC, `🔴 원본 보존 정책을 깼다: ${banned}`).not.toContain(banned);
    }
  });

  /** ═══════════ 행동 축 — 운영 함수를 «그대로» 부른다(복제식 아님) ═══════════ */
  const input = (totalCostKrw: number) =>
    ({
      totalCostKrw,
      domesticLowestPriceKrw: 88000,
      domesticAveragePriceKrw: 88000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 30,
      expectedFeePercent: 10,
      brandMedianPriceKrw: null,
    }) as never;

  it("B-1 🔴🔴 **오염 원가(₩84)는 CASE A 와 마진 99.9% 를 만든다** — 그래서 막아야 한다", () => {
    const r = computePriceRecommendation(input(84));
    expect(r.marketCase, "🔴 이 사실이 바뀌면 가드의 전제가 달라진다").toBe("A");
    expect(r.estimatedMarginPercent ?? 0).toBeGreaterThan(99);
  });

  it("B-2 🟢 **정상 원가는 그대로 계산된다**(대조군 불변)", () => {
    const r = computePriceRecommendation({
      ...(input(200000) as object),
      domesticLowestPriceKrw: 300000,
      domesticAveragePriceKrw: 300000,
    } as never);
    expect(r.marketCase).toBe("A");
    expect(r.recommendedPrice).toBe(297000);
    expect(r.estimatedMarginPercent).toBe(32.7);
  });
});
