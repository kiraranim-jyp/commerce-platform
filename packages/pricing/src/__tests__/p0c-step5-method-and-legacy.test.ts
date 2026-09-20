import { describe, expect, it } from "vitest";
import {
  CATEGORY_COST_POLICIES,
  computeUnifiedPriceDecision,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  resolveOverseasShipping,
  SHIPPING_METHOD_LABEL,
  type ShippingMethod,
  type UnifiedPriceInput,
} from "../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-C STEP 4·5(CEO 지시, 2026-09-20) — **근거가 원가까지 따라간다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이번 스프린트에서도 **금액은 하나도 정하지 않았다.**
 *
 * ── STEP 4 실태(2026-09-20 Production 실측) ────────────────────────────────
 *     product_snapshots 328건 중 shippingMethod 저장 = 0
 *                              originCountry 저장   = 0
 *     배대지 관련 필드          = 없음
 * 그래서 DIRECT/FORWARDING 을 «판정할 근거가 하나도 없다». CEO 지시대로
 * 추측하지 않고 전부 UNKNOWN 이다.
 */

describe("① ShippingMethod — 추정하지 않는다", () => {
  it("🔴 넘기지 않으면 UNKNOWN 이다 — 국가·통화·판매처로 추측하지 않는다", () => {
    expect(resolveOverseasShipping({ sellerEnteredKrw: 12000 }).method).toBe("UNKNOWN");
  });

  it("확인된 경우에만 그 값이 실린다", () => {
    expect(resolveOverseasShipping({ sellerEnteredKrw: 12000, method: "DIRECT" }).method).toBe("DIRECT");
    expect(resolveOverseasShipping({ sellerEnteredKrw: null, method: "FORWARDING" }).method).toBe("FORWARDING");
  });

  it("🔴 배송방법은 «금액» 에 관여하지 않는다 — 같은 입력이면 같은 숫자다", () => {
    const methods: ShippingMethod[] = ["DIRECT", "FORWARDING", "UNKNOWN"];
    const amounts = methods.map((m) => resolveOverseasShipping({ sellerEnteredKrw: 20000, method: m }).amountKrw);
    expect(new Set(amounts)).toEqual(new Set([20000]));
  });

  it("세 값 모두 사람이 읽는 문장을 갖는다", () => {
    for (const m of ["DIRECT", "FORWARDING", "UNKNOWN"] as ShippingMethod[]) {
      expect(SHIPPING_METHOD_LABEL[m].length).toBeGreaterThan(0);
    }
  });
});

/* ═══════ ② LEGACY_FALLBACK — ₩12,000 에 «이름» 을 붙인다 ═══════ */

describe("② ₩12,000 이 적용될 때 근거가 남는다 (CEO §8)", () => {
  it("🔴 저장된 priceBreakdown 이 «없으면» LEGACY_FALLBACK 이다 — 판매자 값이 아니다", () => {
    const r = resolveOverseasShipping({
      sellerEnteredKrw: undefined, // 저장된 값 없음
      legacyFallbackKrw: DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw,
    });
    expect(r.basis).toBe("LEGACY_FALLBACK");
    expect(r.amountKrw).toBe(12000);
    expect(r.label).toContain("실제 배송비로 확인된 값이 아닙니다");
  });

  it("🔴 숫자는 바꾸지 않았다 — 이름만 붙였다", () => {
    expect(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw).toBe(12000);
  });

  it("판매자가 «같은 숫자» 를 넣었으면 그건 SELLER_OVERRIDE 다", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: 12000, legacyFallbackKrw: 12000 });
    expect(r.basis).toBe("SELLER_OVERRIDE");
  });

  it("🔴 비운 것은 fallback 으로 되살아나지 않는다", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: null, legacyFallbackKrw: 12000 });
    expect(r.basis).toBe("UNKNOWN");
    expect(r.amountKrw).toBeNull();
  });

  it("카테고리 기본값이 있으면 fallback 보다 먼저다 — 오늘은 그 값이 없다", () => {
    expect(resolveOverseasShipping({ categoryDefaultKrw: 30000, legacyFallbackKrw: 12000 }).basis).toBe(
      "CATEGORY_DEFAULT",
    );
    for (const p of Object.values(CATEGORY_COST_POLICIES)) expect(p.overseasShippingDefaultKrw).toBeNull();
  });
});

/* ═══════ ③ 원가가 «근거를 달고» 나온다 (CEO §5) ═══════ */

const c = (value: number | null, status: "actual" | "estimated" | "unknown") => ({ value, status });

function decide(over: Partial<UnifiedPriceInput>) {
  return computeUnifiedPriceDecision({
    sourceProductPriceKrw: c(111000, "actual"),
    exchangeRate: c(1480, "actual"),
    internationalShippingKrw: c(12000, "estimated"),
    platformFeeRate: c(10, "actual"),
    currentSellingPriceKrw: c(200000, "actual"),
    customerChargedShippingKrw: c(null, "unknown"),
    ...over,
  } as unknown as UnifiedPriceInput);
}

describe("③ landedCost 는 숫자 하나가 아니라 «근거를 가진 결과» 다", () => {
  it("근거가 값과 함께 나온다", () => {
    const d = decide({ shippingBasis: "SELLER_OVERRIDE", shippingMethod: "DIRECT" } as Partial<UnifiedPriceInput>);
    expect(d.landedCostKrw).toMatchObject({
      value: 123000,
      status: "estimated",
      shippingBasis: "SELLER_OVERRIDE",
      shippingMethod: "DIRECT",
    });
  });

  it("🔴 넘기지 않으면 UNKNOWN 이다 — 엔진이 근거를 «지어내지» 않는다", () => {
    const d = decide({});
    expect(d.landedCostKrw.shippingBasis).toBe("UNKNOWN");
    expect(d.landedCostKrw.shippingMethod).toBe("UNKNOWN");
  });

  it("🔴 배송비를 모르면 값은 null 이어도 «근거는 남는다»", () => {
    const d = decide({
      internationalShippingKrw: c(null, "unknown"),
      shippingBasis: "UNKNOWN",
    } as Partial<UnifiedPriceInput>);
    expect(d.landedCostKrw.value).toBeNull();
    expect(d.landedCostKrw.shippingBasis).toBe("UNKNOWN");
    expect(d.missingComponents).toContain("국제배송비");
    expect(d.marginPercent.value).toBeNull();
    expect(d.verdict).toBeNull();
  });

  it("🔴 근거는 «숫자를 바꾸지 않는다» — 같은 금액이면 원가도 같다", () => {
    const a = decide({ shippingBasis: "SELLER_OVERRIDE" } as Partial<UnifiedPriceInput>);
    const b = decide({ shippingBasis: "LEGACY_FALLBACK" } as Partial<UnifiedPriceInput>);
    expect(a.landedCostKrw.value).toBe(b.landedCostKrw.value);
    expect(a.marginPercent.value).toBe(b.marginPercent.value);
  });
});
