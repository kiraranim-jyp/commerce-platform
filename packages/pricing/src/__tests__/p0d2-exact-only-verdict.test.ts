import { describe, expect, it } from "vitest";
import { computePriceDecision, computeUnifiedPriceDecision } from "../index";
import type { UnifiedPriceInput } from "../unified-price-decision";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-D.2 정책 A(CEO 결정, 2026-09-20) — **EXACT 만 판매판정에 쓴다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 ────────────────────────────────────────────────────────────────────
 * 실측(국내가격 보유 51건): EXACT 없이 COMPARISON 만 있는 6건 중 4건이
 * `CONSIDER_LOWER` 였다. **같은 상품이 아닌 물건의 가격을 근거로 판매자에게
 * 「가격을 낮추라」고 권하고 있었다.** 그 말을 따르면 근거 없이 싸게 판다.
 *
 * 🔴 COMPARISON 을 «0 으로» 취급하지 않는다. 판정 입력에서 제외할 뿐이고,
 *    참고정보로는 그대로 산다(CEO 명시).
 */

const base = { costPriceKrw: 150000, currentSellingPriceKrw: 250000 };

/* ═══════ CEO 지정 안전 테스트 A~D ═══════ */

describe("Test A — EXACT 가 있으면 그 값을 쓴다", () => {
  it("EXACT 200,000 · COMPARISON 70,000 → 판정은 200,000 기준이다", () => {
    const r = computePriceDecision({
      ...base,
      domesticAveragePriceKrw: 200000,
      domesticLowestPriceKrw: 200000,
      domesticBasis: "EXACT",
    });
    // 판매가 250,000 이 국내 동일상품 200,000 보다 25% 비싸다 → 인하 검토.
    expect(r.verdict).toBe("CONSIDER_LOWER");
    expect(r.priceGapVsAveragePercent).toBe(25);
  });
});

describe("🔴 Test B — EXACT 가 없으면 COMPARISON 으로 인하를 권하지 않는다", () => {
  const r = computePriceDecision({
    ...base,
    domesticAveragePriceKrw: 70000,
    domesticLowestPriceKrw: 70000,
    domesticBasis: "COMPARISON",
  });

  it("CONSIDER_LOWER 가 나오면 FAIL 이다 — 이것이 이 파일의 전부다", () => {
    expect(r.verdict).not.toBe("CONSIDER_LOWER");
  });

  it("국내 비교 지표가 판정 결과에 실리지 않는다", () => {
    expect(r.priceGapVsAveragePercent).toBeNull();
    expect(r.priceGapVsLowestPercent).toBeNull();
  });

  it("문구에 「국내 최저가보다 비싸다」류가 없다 — 그 근거가 없기 때문이다", () => {
    for (const phrase of ["최저가", "평균", "인하"]) expect(r.reason).not.toContain(phrase);
    expect(r.reason).toContain("국내 가격 비교 데이터 없음");
  });

  it("🔴 COMPARISON 을 0 으로 «취급» 하지 않는다 — 0 이었다면 판정이 정반대가 된다", () => {
    // 국내가 0 이면 판매가가 무한히 비싼 셈이라 CONSIDER_LOWER 가 됐을 것이다.
    expect(r.verdict).toBe("MAINTAIN");
  });
});

describe("Test C — 둘 다 없으면 국내가격 UNKNOWN", () => {
  it("NONE 이면 마진만으로 판단한다", () => {
    const r = computePriceDecision({
      ...base,
      domesticAveragePriceKrw: null,
      domesticLowestPriceKrw: null,
      domesticBasis: "NONE",
    });
    expect(r.verdict).toBe("MAINTAIN");
    expect(r.priceGapVsAveragePercent).toBeNull();
  });
});

describe("Test D — 「COMPARISON 이 판정을 못 움직인다」와 「국내가 없으면 무조건 UNKNOWN」은 다른 말이다", () => {
  it("COMPARISON 만 있어도 마진 조건으로 MAINTAIN 은 나온다", () => {
    const r = computePriceDecision({
      ...base,
      domesticAveragePriceKrw: 70000,
      domesticLowestPriceKrw: 70000,
      domesticBasis: "COMPARISON",
    });
    expect(r.verdict).toBe("MAINTAIN");
  });

  it("🔴 마진이 바닥 미만이면 국내가격과 무관하게 여전히 MARGIN_RISK 다", () => {
    const r = computePriceDecision({
      costPriceKrw: 240000,
      currentSellingPriceKrw: 250000,
      domesticAveragePriceKrw: 70000,
      domesticLowestPriceKrw: 70000,
      domesticBasis: "COMPARISON",
    });
    expect(r.verdict).toBe("MARGIN_RISK");
  });
});

/* ═══════ 무회귀 ═══════ */

describe("🔴 무회귀 — basis 를 넘기지 않는 호출부는 예전 그대로다", () => {
  it("undefined 면 국내가격을 예전처럼 쓴다(compute-readiness 가 그 경우다)", () => {
    const r = computePriceDecision({ ...base, domesticAveragePriceKrw: 200000, domesticLowestPriceKrw: 200000 });
    expect(r.verdict).toBe("CONSIDER_LOWER");
    expect(r.priceGapVsAveragePercent).toBe(25);
  });

  it("EXACT 는 undefined 와 같은 결과를 낸다 — 정책이 바꾸는 것은 COMPARISON 뿐이다", () => {
    const withBasis = computePriceDecision({
      ...base, domesticAveragePriceKrw: 200000, domesticLowestPriceKrw: 200000, domesticBasis: "EXACT",
    });
    const without = computePriceDecision({ ...base, domesticAveragePriceKrw: 200000, domesticLowestPriceKrw: 200000 });
    expect(withBasis).toEqual(without);
  });
});

/* ═══════ 통합 엔진까지 이어지는가 ═══════ */

const c = (value: number | null, status: "actual" | "estimated" | "unknown") => ({ value, status });

function unified(basis: "EXACT" | "COMPARISON" | undefined, domesticKrw: number) {
  return computeUnifiedPriceDecision({
    sourceProductPriceKrw: c(111000, "actual"),
    exchangeRate: c(1480, "actual"),
    internationalShippingKrw: c(12000, "estimated"),
    platformFeeRate: c(10, "actual"),
    currentSellingPriceKrw: c(250000, "actual"),
    customerChargedShippingKrw: c(null, "unknown"),
    domesticCompetitivePrice: { lowest: domesticKrw, average: domesticKrw, basis },
  } as unknown as UnifiedPriceInput);
}

describe("통합 엔진도 같은 규칙을 따른다", () => {
  it("🔴 COMPARISON 이면 통합 판정도 인하를 권하지 않는다", () => {
    expect(unified("COMPARISON", 70000).verdict).not.toBe("CONSIDER_LOWER");
  });

  it("EXACT 면 예전처럼 인하를 권한다", () => {
    expect(unified("EXACT", 70000).verdict).toBe("CONSIDER_LOWER");
  });

  it("basis 를 안 넘기면 예전 그대로다", () => {
    expect(unified(undefined, 70000).verdict).toBe("CONSIDER_LOWER");
  });
});
