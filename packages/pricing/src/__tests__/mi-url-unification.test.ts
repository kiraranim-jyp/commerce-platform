import { describe, expect, it } from "vitest";
import { convertToKrw } from "../currency";
import { resolveOverseasShipping, SHIPPING_BASIS_LABEL } from "../shipping-basis";
import { computeUnifiedPriceDecision, type UnifiedPriceInput } from "../unified-price-decision";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-URL-INPUT-UNIFICATION(CPO 결정 A·B, 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 국내 URL 을 넣어도 «같은» MI 가 돌아야 한다. 그러려면 해외 수입을 전제한 비용
 * 축만 걷어내면 되는데, 걷어내는 방법이 둘 다 틀릴 수 있다:
 *
 *   ₩0 을 넣는다        → 「배송비를 확인했더니 0원」이라는 «없는 사실» 을 만든다
 *   null 을 넣는다       → 합산이 「누락」으로 읽어 착지원가가 incomplete 가 된다
 *
 * 그래서 **「해당 없음」이라는 세 번째 상태** 를 만들고, 합산이 그것을 「모름」과
 * 다르게 다루게 했다. 이 파일이 그 둘을 각각 못박는다.
 *
 * 🔴 그리고 가장 중요한 단정: **해외 경로의 숫자가 한 원도 바뀌지 않는다.**
 */

const BASE: UnifiedPriceInput = {
  sourceProductPriceKrw: { value: 100_000, status: "estimated", source: "test" },
  /* 환율 자체는 합산에 쓰이지 않는다(상품가가 이미 환산된 값이다) — 타입이
     요구하므로 채우되, 이 파일의 단정에는 영향이 없다. */
  exchangeRate: { value: 1380, status: "estimated", source: "test" },
  internationalShippingKrw: { value: 12_000, status: "estimated", source: "seller_default" },
  currentSellingPriceKrw: { value: 200_000, status: "actual", source: "test" },
  customerChargedShippingKrw: { value: null, status: "unknown" },
  platformFeeRate: { value: 10, status: "estimated", source: "default" },
};

describe("결정 B — KRW → KRW 는 «환산이 아니다»", () => {
  it("isEstimate 가 false 다 — 1:1 에는 추정할 것이 없다", () => {
    const converted = convertToKrw(72_000, "KRW");
    expect(converted.amountKrw).toBe(72_000);
    expect(converted.isEstimate).toBe(false);
  });

  it("소문자 krw 도 같다", () => {
    expect(convertToKrw(72_000, "krw").isEstimate).toBe(false);
  });

  it("🔴 다른 통화의 정책은 바뀌지 않았다 — liveRates 있으면 false, 없으면 true", () => {
    const live = convertToKrw(100, "USD", { USD: 1380 });
    expect(live).toEqual({ amountKrw: 138_000, isEstimate: false });
    /* 고정표 폴백은 여전히 «추정» 이다. */
    const fallback = convertToKrw(100, "USD");
    expect(fallback.isEstimate).toBe(true);
    expect(fallback.amountKrw).toBe(138_000);
  });

  it("🔴 모르는 통화는 여전히 추정이다 — KRW 예외가 그쪽으로 새지 않았다", () => {
    expect(convertToKrw(100, "ZZZ").isEstimate).toBe(true);
  });
});

describe("결정 A — 국내 소싱은 해외물류비가 «해당 없음» 이다", () => {
  it("overseasInbound=false → NOT_APPLICABLE · 금액은 null", () => {
    const resolved = resolveOverseasShipping({ overseasInbound: false, legacyFallbackKrw: 12_000 });
    expect(resolved.basis).toBe("NOT_APPLICABLE");
    /* 🔴 0 이 아니다. 0 은 「확인했더니 0원」이라는 다른 사실이다. */
    expect(resolved.amountKrw).toBeNull();
  });

  it("🔴 판매자 입력값이나 카테고리 기본값이 있어도 «항목 자체가 없으면» 이긴다", () => {
    const resolved = resolveOverseasShipping({
      overseasInbound: false,
      sellerEnteredKrw: 20_000,
      categoryDefaultKrw: 15_000,
      legacyFallbackKrw: 12_000,
    });
    expect(resolved.basis).toBe("NOT_APPLICABLE");
    expect(resolved.amountKrw).toBeNull();
  });

  it("🔴 문구가 「0원」이라고 말하지 않는다", () => {
    const label = SHIPPING_BASIS_LABEL.NOT_APPLICABLE;
    expect(label).toContain("해외물류비가 들지 않습니다");
    expect(label).not.toContain("0");
    expect(label).not.toContain("무료");
  });

  it("🔴 UNKNOWN 과 «다른» 상태다 — 둘을 합치지 않았다", () => {
    const notApplicable = resolveOverseasShipping({ overseasInbound: false });
    const unknown = resolveOverseasShipping({ sellerEnteredKrw: null });
    expect(notApplicable.basis).not.toBe(unknown.basis);
    /* 금액은 둘 다 null 이지만 «근거» 가 다르다 — 화면이 다른 말을 해야 한다. */
    expect(notApplicable.amountKrw).toBeNull();
    expect(unknown.amountKrw).toBeNull();
    expect(notApplicable.label).not.toBe(unknown.label);
  });

  it("🔴 해외 경로는 한 줄도 바뀌지 않았다 — 사다리 순서 그대로", () => {
    /* overseasInbound 를 넘기지 «않으면» 기존과 완전히 동일하다. */
    expect(resolveOverseasShipping({ sellerEnteredKrw: 20_000 }).basis).toBe("SELLER_OVERRIDE");
    expect(resolveOverseasShipping({ categoryDefaultKrw: 15_000 }).basis).toBe("CATEGORY_DEFAULT");
    expect(resolveOverseasShipping({ legacyFallbackKrw: 12_000 }).basis).toBe("LEGACY_FALLBACK");
    expect(resolveOverseasShipping({}).basis).toBe("UNKNOWN");
    /* 명시적으로 true 를 넘겨도 같다. */
    expect(resolveOverseasShipping({ overseasInbound: true, legacyFallbackKrw: 12_000 }).basis).toBe(
      "LEGACY_FALLBACK",
    );
    expect(resolveOverseasShipping({ overseasInbound: true, legacyFallbackKrw: 12_000 }).amountKrw).toBe(12_000);
  });
});

describe("착지원가 합산 — 「해당 없음」은 「누락」이 아니다", () => {
  it("🔴 NOT_APPLICABLE 이면 금액이 null 이어도 incomplete 가 «되지 않는다»", () => {
    const decision = computeUnifiedPriceDecision({
      ...BASE,
      internationalShippingKrw: { value: null, status: "unknown", source: "국내 소싱 — 국제배송 구간 없음" },
      shippingBasis: "NOT_APPLICABLE",
    });
    expect(decision.landedCostKrw.status).not.toBe("incomplete");
    /* 국내 소싱가 하나가 착지원가다 — 더할 항이 없을 뿐이다. */
    expect(decision.landedCostKrw.value).toBe(100_000);
  });

  it("🔴 마진·이익이 «비지 않는다» — 그것이 이 수정의 목적이다", () => {
    const decision = computeUnifiedPriceDecision({
      ...BASE,
      internationalShippingKrw: { value: null, status: "unknown" },
      shippingBasis: "NOT_APPLICABLE",
    });
    expect(decision.estimatedProfitKrw.value).not.toBeNull();
    expect(decision.marginPercent.value).not.toBeNull();
    expect(decision.estimatedProfitKrw.status).not.toBe("incomplete");
  });

  it("🔴 같은 null 이 «UNKNOWN» 이면 여전히 incomplete 다 — 둘을 섞지 않았다", () => {
    const decision = computeUnifiedPriceDecision({
      ...BASE,
      internationalShippingKrw: { value: null, status: "unknown" },
      shippingBasis: "UNKNOWN",
    });
    expect(decision.landedCostKrw.status).toBe("incomplete");
    expect(decision.landedCostKrw.value).toBeNull();
  });

  it("🔴 해외 경로의 숫자가 한 원도 바뀌지 않았다", () => {
    /* shippingBasis 를 넘기지 않은 기존 호출부 모양 그대로. */
    const before = computeUnifiedPriceDecision(BASE);
    expect(before.landedCostKrw.value).toBe(112_000);
    expect(before.landedCostKrw.status).toBe("estimated");

    /* 근거를 실어도(기존 호출부가 이미 넘긴다) 숫자는 같다. */
    const withBasis = computeUnifiedPriceDecision({ ...BASE, shippingBasis: "LEGACY_FALLBACK" });
    expect(withBasis.landedCostKrw.value).toBe(before.landedCostKrw.value);
    expect(withBasis.estimatedProfitKrw.value).toBe(before.estimatedProfitKrw.value);
    expect(withBasis.marginPercent.value).toBe(before.marginPercent.value);

    /* SELLER_OVERRIDE 도 마찬가지다 — NOT_APPLICABLE 만 분기한다. */
    const sellerInput = computeUnifiedPriceDecision({ ...BASE, shippingBasis: "SELLER_OVERRIDE" });
    expect(sellerInput.landedCostKrw.value).toBe(112_000);
  });

  it("🔴 국내 소싱과 해외 소싱의 착지원가가 «국제배송비만큼» 다르다", () => {
    const overseas = computeUnifiedPriceDecision({ ...BASE, shippingBasis: "LEGACY_FALLBACK" });
    const domestic = computeUnifiedPriceDecision({
      ...BASE,
      internationalShippingKrw: { value: null, status: "unknown" },
      shippingBasis: "NOT_APPLICABLE",
    });
    expect(overseas.landedCostKrw.value! - domestic.landedCostKrw.value!).toBe(12_000);
    /* 🔴 그리고 둘의 «출력 모양» 은 같다 — 국내가 빈 결과로 떨어지지 않는다. */
    expect(Object.keys(domestic).sort()).toEqual(Object.keys(overseas).sort());
  });
});
