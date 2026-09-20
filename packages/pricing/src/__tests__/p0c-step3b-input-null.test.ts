import { describe, expect, it } from "vitest";
import { computeUnifiedPriceDecision, resolveListingPrice, resolveOverseasShipping } from "../index";
import type { UnifiedPriceInput } from "../unified-price-decision";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-C STEP 3b(CEO 지시, 2026-09-20) — **비운 것과 0 을 친 것은 다른 사실이다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 가 「반드시 추가할 회귀」로 지정한 네 가지를 그대로 고정한다.
 *
 *     입력 19,800   →  19,800 / SELLER_OVERRIDE
 *     입력 0        →       0 / SELLER_OVERRIDE      ← 0 은 유효한 «확인» 이다
 *     입력값 삭제   →    null / UNKNOWN
 *                    →  landedCost null · margin null · verdict null
 */

/* ═══════ ① 입력값과 근거 ═══════ */

describe("① 판매자가 넣은 값은 그대로 SELLER_OVERRIDE 다", () => {
  it("입력 19,800 → 19,800 / SELLER_OVERRIDE", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: 19800 });
    expect(r.amountKrw).toBe(19800);
    expect(r.basis).toBe("SELLER_OVERRIDE");
  });

  it("🔴 입력 0 → 0 / SELLER_OVERRIDE — 0 은 「무료라고 확인했다」는 유효한 관측이다", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: 0 });
    expect(r.amountKrw).toBe(0);
    expect(r.basis).toBe("SELLER_OVERRIDE");
    // 🔴 0 을 «금지» 하지 않는다. 막는 것은 «비운 것을 0 으로 바꾸는 일» 이다.
    expect(r.basis).not.toBe("UNKNOWN");
  });

  it("🔴 입력값 삭제 → null / UNKNOWN", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: null });
    expect(r.amountKrw).toBeNull();
    expect(r.basis).toBe("UNKNOWN");
  });

  it("🔴 0 과 삭제가 같은 결과가 되지 않는다 — 이 한 줄이 이번 작업의 전부다", () => {
    const zero = resolveOverseasShipping({ sellerEnteredKrw: 0 });
    const cleared = resolveOverseasShipping({ sellerEnteredKrw: null });
    expect(zero.basis).not.toBe(cleared.basis);
    expect(zero.amountKrw).not.toBe(cleared.amountKrw);
  });
});

/* ═══════ ② 삭제가 판정까지 흘러간다 ═══════ */

const component = (value: number | null, status: "actual" | "estimated" | "unknown") => ({ value, status });

function decide(shippingKrw: number | null) {
  const resolved = resolveOverseasShipping({ sellerEnteredKrw: shippingKrw });
  return computeUnifiedPriceDecision({
    sourceProductPriceKrw: component(111000, "actual"),
    exchangeRate: component(1480, "actual"),
    internationalShippingKrw:
      resolved.amountKrw == null ? component(null, "unknown") : component(resolved.amountKrw, "estimated"),
    platformFeeRate: component(10, "actual"),
    currentSellingPriceKrw: component(200000, "actual"),
  } as unknown as UnifiedPriceInput);
}

describe("② 입력값 삭제 → 원가·마진·판정이 전부 비어 있다", () => {
  const cleared = decide(null);

  it("🔴 landedCost null", () => expect(cleared.landedCostKrw.value).toBeNull());
  it("🔴 margin null", () => expect(cleared.marginPercent.value).toBeNull());
  it("🔴 verdict null", () => {
    expect(cleared.verdict).toBeNull();
    expect(cleared.level).toBe("UNKNOWN");
  });
  it("무엇이 빠졌는지는 말한다", () => {
    expect(cleared.dataCompleteness).toBe("INCOMPLETE");
    expect(cleared.missingComponents).toContain("국제배송비");
  });

  it("🔴 «0 입력» 은 반대다 — 숫자가 그대로 나온다", () => {
    const zero = decide(0);
    expect(zero.landedCostKrw.value).toBe(111000);
    expect(zero.marginPercent.value).not.toBeNull();
    expect(zero.verdict).not.toBeNull();
  });

  it("19,800 입력도 그대로 계산된다", () => {
    const entered = decide(19800);
    expect(entered.landedCostKrw.value).toBe(130800);
    expect(entered.verdict).not.toBeNull();
  });
});

/* ═══════ ③ 🔴 아무도 안 보는 자리에서 기본값이 «되살아나지» 않는다 ═══════ */

describe("③ 등록가 — 배송비를 모르면 제안하지 않는다", () => {
  const base = {
    originalAmount: 75,
    originalCurrency: "EUR",
    priceValidity: "VALID" as const,
    priceOverrideKrw: null,
  };

  it("🔴 배송비를 비운 채 등록하면 UNRESOLVED 다 — ₩12,000 이 조용히 끼어들지 않는다", () => {
    const r = resolveListingPrice({
      ...base,
      priceBreakdown: { shippingKrw: null, feePercent: 10, marginPercent: 20 },
    });
    expect(r.source).toBe("UNRESOLVED");
    expect(r.priceKrw).toBeNull();
    expect(r.reason).toContain("해외물류비");
  });

  it("0 을 «입력» 했으면 등록가가 나온다 — 막는 것은 «모름» 뿐이다", () => {
    const r = resolveListingPrice({
      ...base,
      priceBreakdown: { shippingKrw: 0, feePercent: 10, marginPercent: 20 },
    });
    expect(r.source).toBe("SYSTEM_SUGGESTED");
    expect(r.priceKrw).not.toBeNull();
  });

  it("🔴 무회귀 — priceBreakdown 을 아예 넘기지 않는 기존 호출부는 예전 그대로다", () => {
    const r = resolveListingPrice(base);
    expect(r.source).toBe("SYSTEM_SUGGESTED");
    expect(r.priceKrw).not.toBeNull();
  });

  it("판매자가 확정가를 넣었으면 그 값이 먼저다 — 배송비를 몰라도", () => {
    const r = resolveListingPrice({
      ...base,
      priceOverrideKrw: 150000,
      priceBreakdown: { shippingKrw: null, feePercent: 10, marginPercent: 20 },
    });
    expect(r.source).toBe("SELLER_OVERRIDE");
    expect(r.priceKrw).toBe(150000);
  });
});
