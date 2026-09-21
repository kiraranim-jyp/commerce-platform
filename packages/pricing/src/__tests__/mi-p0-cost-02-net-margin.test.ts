import { describe, expect, it } from "vitest";
import { computePriceRecommendation } from "../price-recommendation";
import { resolveOverseasShipping } from "../shipping-basis";
import { platformFeeKrwAt } from "../landed-cost";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-COST-02(CEO 확정, 2026-09-21)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 정책 한 문장(사장님 확정):
 *   「Legacy fallback 은 유효한 계산 근거이지만, 실제 배송비 측정값과 동일하게
 *    취급하지 않는다. 금액과 shippingBasis 를 함께 전달하며, UNKNOWN 만 숫자
 *    계산에서 제외한다. 판매 손익은 예상 수수료를 차감한 Net 기준으로 판단하고,
 *    Gross Margin 은 별도 정보로 보존한다.」
 *
 * 🔴 아래 숫자는 지어낸 것이 아니다. Production snapshot 6e2fa9a2 (Vernice Nero)
 *    의 실측값이다 — ORIGIN_FX GBP 119 → ₩220,424 · 국내 EXACT 최저가 ₩258,000.
 */

const VERNICE = {
  originKrw: 220_424,
  legacyShipping: 12_000,
  landedCost: 232_424, // 220,424 + 12,000
  domesticLowest: 258_000,
  feePercent: 10,
};

describe("① 배송비 사다리 — 금액과 «근거» 는 한 세트로 움직인다", () => {
  it.each([
    ["SELLER_OVERRIDE", { sellerEnteredKrw: 19_800 }, 19_800, "SELLER_OVERRIDE"],
    ["0 입력도 SELLER_OVERRIDE", { sellerEnteredKrw: 0 }, 0, "SELLER_OVERRIDE"],
    ["CATEGORY_DEFAULT", { categoryDefaultKrw: 19_800, legacyFallbackKrw: 12_000 }, 19_800, "CATEGORY_DEFAULT"],
    ["LEGACY_FALLBACK", { legacyFallbackKrw: 12_000 }, 12_000, "LEGACY_FALLBACK"],
  ])("%s", (_label, input, amount, basis) => {
    const r = resolveOverseasShipping(input as never);
    expect(r.amountKrw).toBe(amount);
    expect(r.basis).toBe(basis);
  });

  it("🔴 «비운» 것(null)은 UNKNOWN 이고 금액을 만들지 않는다 — legacy 가 있어도 내려가지 않는다", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: null, legacyFallbackKrw: 12_000 } as never);
    expect(r.basis).toBe("UNKNOWN");
    expect(r.amountKrw).toBeNull();
  });

  it("🔴 아무 근거도 없으면 UNKNOWN — 12,000 이 «다시 들어오면» 회귀다", () => {
    const r = resolveOverseasShipping({} as never);
    expect(r.basis).toBe("UNKNOWN");
    expect(r.amountKrw).toBeNull();
    expect(r.amountKrw).not.toBe(12_000);
  });
});

describe("② 🔴 Vernice — Gross 는 양수인데 Net 은 «손실» 이다", () => {
  const withFee = computePriceRecommendation({
    totalCostKrw: VERNICE.landedCost,
    domesticLowestPriceKrw: VERNICE.domesticLowest,
    domesticAveragePriceKrw: VERNICE.domesticLowest,
    domesticBasis: "EXACT",
    minimumMarginPercent: 10,
    targetMarginPercent: 20,
    expectedFeePercent: VERNICE.feePercent,
  });

  it("예상 수수료는 ₩25,800 이다", () => {
    expect(platformFeeKrwAt(VERNICE.domesticLowest, VERNICE.feePercent)).toBe(25_800);
  });

  it("🔴 Net 손익이 −₩224 라서 CASE C(손실)로 간다 — 예전에는 CASE B 였다", () => {
    expect(258_000 - 232_424 - 25_800).toBe(-224);
    expect(withFee.marketCase).toBe("C");
  });

  it("🔴 CASE C 이므로 추천가를 «만들지 않는다» — 「손실 없이 판매 가능」이 나올 수 없다", () => {
    expect(withFee.recommendedPrice).toBeNull();
    expect(withFee.estimatedMarginPercent).toBeNull();
  });

  it("🔴 무회귀 — 수수료를 주지 않으면(0) 예전 그대로 CASE B · Gross 9.9%", () => {
    const noFee = computePriceRecommendation({
      totalCostKrw: VERNICE.landedCost,
      domesticLowestPriceKrw: VERNICE.domesticLowest,
      domesticAveragePriceKrw: VERNICE.domesticLowest,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(noFee.marketCase).toBe("B");
    expect(noFee.estimatedMarginPercent).toBe(9.9);
    // 수수료 0 이면 Net == Gross 다.
    expect(noFee.netProfitKrw).toBe(25_576);
    expect(noFee.netMarginPercent).toBe(9.9);
  });
});

describe("③ Gross 는 «보존» 된다 — net 으로 덮어쓰지 않았다", () => {
  /** 원가를 낮춰 수수료를 빼고도 남는 상황을 만든다(= CASE B 유지). */
  const r = computePriceRecommendation({
    totalCostKrw: 180_000,
    domesticLowestPriceKrw: 258_000,
    domesticAveragePriceKrw: 258_000,
    domesticBasis: "EXACT",
    minimumMarginPercent: 10,
    targetMarginPercent: 40, // 목표가를 높여 CASE A 로 가지 않게 둔다
    expectedFeePercent: 10,
  });

  it("Gross 와 Net 이 «서로 다른 값» 으로 동시에 존재한다", () => {
    expect(r.marketCase).toBe("B");
    expect(r.estimatedMarginPercent).toBe(30.2); // (258,000−180,000)/258,000
    expect(r.netProfitKrw).toBe(258_000 - 180_000 - 25_800); // 52,200
    expect(r.netMarginPercent).toBe(20.2);
    expect(r.netMarginPercent).not.toBe(r.estimatedMarginPercent);
  });

  it("🔴 Net 이 양수여도 목표마진(40%) 미달이면 CASE B 다 — 「손실 없음」 ≠ 「판매 추천」", () => {
    expect(r.netProfitKrw!).toBeGreaterThan(0);
    expect(r.netMarginPercent!).toBeLessThan(40);
    expect(r.marketCase).toBe("B");
  });
});

describe("④ CASE D — EXACT 가 아니면 Net 도 만들지 않는다", () => {
  it.each([["COMPARISON"], ["NONE"]])("domesticBasis=%s → 전부 null", (basis) => {
    const r = computePriceRecommendation({
      totalCostKrw: 232_424,
      domesticLowestPriceKrw: 258_000,
      domesticAveragePriceKrw: 258_000,
      domesticBasis: basis as never,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
      expectedFeePercent: 10,
    });
    expect(r.marketCase).toBe("D");
    expect(r.netProfitKrw).toBeNull();
    expect(r.netMarginPercent).toBeNull();
    expect(r.estimatedMarginPercent).toBeNull();
  });
});

describe("⑤ 수수료 경계", () => {
  const at = (feePercent: number) =>
    computePriceRecommendation({
      totalCostKrw: 100_000,
      domesticLowestPriceKrw: 200_000,
      domesticAveragePriceKrw: 200_000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 80, // CASE A 회피
      expectedFeePercent: feePercent,
    });

  it("fee 0 → Net == Gross", () => {
    const r = at(0);
    expect(r.netProfitKrw).toBe(100_000);
    expect(r.netMarginPercent).toBe(r.estimatedMarginPercent);
  });

  it("fee 10 → Net 이 Gross 보다 정확히 10%p 낮다", () => {
    const r = at(10);
    expect(r.netProfitKrw).toBe(80_000);
    expect(r.estimatedMarginPercent! - r.netMarginPercent!).toBeCloseTo(10, 1);
  });

  it("🔴 fee 50 → 수수료가 이익을 삼키면 CASE C(손실)로 떨어진다", () => {
    const r = at(50);
    expect(r.marketCase).toBe("C");
    expect(r.recommendedPrice).toBeNull();
  });
});
