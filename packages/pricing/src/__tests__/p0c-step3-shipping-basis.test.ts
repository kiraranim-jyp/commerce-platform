import { describe, expect, it } from "vitest";
import {
  CATEGORY_COST_POLICIES,
  computeUnifiedPriceDecision,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  resolveOverseasShipping,
  shippingBasisIsConfirmed,
  type ShippingBasis,
  type UnifiedPriceInput,
} from "../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-C STEP 3(CEO 승인, 2026-09-20) — **모르면 판단하지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 이 스프린트에서 **금액은 하나도 정하지 않았다.** 정한 것은 「그 숫자가 왜
 * 그 값인가」를 시스템이 들고 다니게 하는 구조뿐이다.
 */

/* ═══════ ① 근거는 «추측» 이 아니라 «전달» 된다 ═══════ */

describe("① ShippingBasis — 숫자를 보고 되묻지 않는다", () => {
  it("판매자가 넣은 값이면 SELLER_OVERRIDE 다 — 그 값이 ₩12,000 이어도", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: 12000, legacyFallbackKrw: 12000 });
    expect(r.basis).toBe("SELLER_OVERRIDE");
    expect(r.amountKrw).toBe(12000);
    // 🔴 예전 구조가 틀리던 바로 그 자리다. 숫자가 기본값과 같다는 이유로
    //    「확인된 값이 아니다」라고 말하던 것을 멈춘다.
    expect(shippingBasisIsConfirmed(r.basis)).toBe(true);
  });

  it("🔴 판매자가 «비웠으면» UNKNOWN 이다 — 0 이 아니다", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: null, legacyFallbackKrw: 12000 });
    expect(r.basis).toBe("UNKNOWN");
    expect(r.amountKrw).toBeNull();
    expect(r.amountKrw).not.toBe(0);
  });

  it("🔴 비운 것을 기본값으로 «덮지» 않는다 — 판매자가 지운 값이 되살아나지 않는다", () => {
    const r = resolveOverseasShipping({ sellerEnteredKrw: null, categoryDefaultKrw: 30000, legacyFallbackKrw: 12000 });
    expect(r.amountKrw).toBeNull();
  });

  it("손대지 않았으면(undefined) 아래 층으로 내려간다 — 비운 것과 다른 사실이다", () => {
    expect(resolveOverseasShipping({ legacyFallbackKrw: 12000 }).basis).toBe("LEGACY_FALLBACK");
    expect(resolveOverseasShipping({ categoryDefaultKrw: 30000, legacyFallbackKrw: 12000 }).basis).toBe(
      "CATEGORY_DEFAULT",
    );
  });

  it("아무것도 없으면 UNKNOWN — 0 을 만들어 내지 않는다", () => {
    const r = resolveOverseasShipping({});
    expect(r.basis).toBe("UNKNOWN");
    expect(r.amountKrw).toBeNull();
  });

  it("🔴 «확인됐다» 고 주장하는 근거는 하나뿐이다", () => {
    const ALL: ShippingBasis[] = ["SELLER_OVERRIDE", "CATEGORY_DEFAULT", "LEGACY_FALLBACK", "UNKNOWN"];
    expect(ALL.filter(shippingBasisIsConfirmed)).toEqual(["SELLER_OVERRIDE"]);
  });

  it("기본값·카테고리 라벨은 «실제 배송비» 라고 말하지 않는다", () => {
    for (const basis of ["CATEGORY_DEFAULT", "LEGACY_FALLBACK"] as const) {
      expect(resolveOverseasShipping(
        basis === "CATEGORY_DEFAULT" ? { categoryDefaultKrw: 1 } : { legacyFallbackKrw: 1 },
      ).label).toContain("실제 배송비로 확인된 값이 아닙니다");
    }
  });
});

/* ═══════ ② 금액은 «아직» 없다 ═══════ */

describe("② CATEGORY_DEFAULT — 구조만 있고 금액은 HOLD 다", () => {
  it("🔴 오늘은 «모든» 카테고리가 금액 null 이다 — 아동의류 포함", () => {
    for (const policy of Object.values(CATEGORY_COST_POLICIES)) {
      expect(policy.overseasShippingDefaultKrw, `${policy.id} 에 금액이 들어갔다`).toBeNull();
    }
  });

  it("🔴 ₩19,800 은 어떤 카테고리에도 들어가 있지 않다 — 그 숫자는 구매자 청구 배송비다", () => {
    const amounts = Object.values(CATEGORY_COST_POLICIES).map((p) => p.overseasShippingDefaultKrw);
    expect(amounts).not.toContain(19800);
  });

  it("기존 기본값 ₩12,000 은 그대로다 — 이번에 의미를 재정의하지 않았다", () => {
    expect(DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw).toBe(12000);
  });
});

/* ═══════ ③ 🔴 모르면 «숫자를 만들지 않는다» ═══════ */

const component = (value: number | null, status: "actual" | "estimated" | "unknown") => ({ value, status });

function decide(shipping: { value: number | null; status: "actual" | "estimated" | "unknown" }) {
  return computeUnifiedPriceDecision({
    sourceProductPriceKrw: component(111000, "actual"),
    exchangeRate: component(1480, "actual"),
    internationalShippingKrw: shipping,
    platformFeeRate: component(10, "actual"),
    currentSellingPriceKrw: component(200000, "actual"),
  } as unknown as UnifiedPriceInput);
}

describe("③ 배송비를 모르면 원가·마진·판정이 «전부» 비어 있다", () => {
  const unknown = decide(component(null, "unknown"));

  it("🔴 실구매원가를 «부분합» 으로 말하지 않는다", () => {
    expect(unknown.landedCostKrw.value).toBeNull();
    expect(unknown.landedCostKrw.status).toBe("incomplete");
    // 🔴 111,000 이 그대로 나오면 예전 동작이다 — 그 숫자는 «배송비 0원» 과 같다.
    expect(unknown.landedCostKrw.value).not.toBe(111000);
  });

  it("🔴 마진을 만들지 않는다 — 예전에는 낙관적인 값이 나왔다", () => {
    expect(unknown.marginPercent.value).toBeNull();
    expect(unknown.estimatedProfitKrw.value).toBeNull();
  });

  it("🔴 판정을 내리지 않는다 — 근거 없는 GREEN 을 보고 등록하게 두지 않는다", () => {
    expect(unknown.verdict).toBeNull();
    expect(unknown.level).toBe("UNKNOWN");
  });

  it("무엇을 몰라서 못 셌는지는 그대로 말한다 — 모른다는 것과 침묵은 다르다", () => {
    expect(unknown.dataCompleteness).toBe("INCOMPLETE");
    expect(unknown.missingComponents).toContain("국제배송비");
  });
});

/* ═══════ ④ 아는 경우는 예전 그대로 ═══════ */

describe("④ 🔴 무회귀 — 배송비를 아는 상품의 숫자는 한 개도 바뀌지 않았다", () => {
  const known = decide(component(12000, "estimated"));

  it("원가는 예전처럼 합산된다", () => {
    expect(known.landedCostKrw.value).toBe(123000);
    expect(known.landedCostKrw.status).toBe("estimated");
  });

  it("마진과 판정이 그대로 나온다", () => {
    expect(known.marginPercent.value).not.toBeNull();
    expect(known.verdict).not.toBeNull();
    expect(known.dataCompleteness).not.toBe("INCOMPLETE");
    expect(known.missingComponents).toHaveLength(0);
  });

  it("🔴 배송비 ₩0 은 여전히 «아는 값» 으로 취급된다 — 기존 14건을 소급 변경하지 않았다", () => {
    // CEO 지시: 그 0 이 무료배송인지 입력을 비운 결과인지 DB 만 보고는 알 수 없다.
    // 그래서 레거시로 보존한다. 새 입력부터 의미가 갈린다.
    const zero = decide(component(0, "estimated"));
    expect(zero.landedCostKrw.value).toBe(111000);
    expect(zero.verdict).not.toBeNull();
  });
});
