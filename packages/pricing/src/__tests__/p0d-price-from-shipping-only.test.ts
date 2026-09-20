import { describe, expect, it } from "vitest";
import { DEFAULT_PRICE_BREAKDOWN_INPUT, resolveListingPrice } from "../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-D(2026-09-20) — **배송비 하나로 «권장 판매가» 를 만들지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 지어낸 입력이 아니다. 실제 Production 상품에서 나왔다:
 *
 *     snapshot f43c931f
 *       priceValidity = "VALID"                 ← 「가격을 읽었다」고 주장한다
 *       price         = { amount: 0, currency: "" }   ← 그런데 값이 없다
 *       priceBreakdown.shippingKrw = 12000
 *
 * 예전 `resolveListingPrice` 는 priceValidity 만 보고 통과시켰고, 상품가 0 에
 * 해외물류비 12,000 이 더해져 착지원가 12,000 · 권장가 ₩15,385 가 나왔다.
 * 마지막 방어선(`suggestedPriceKrw > 0`)도 «배송비 덕분에» 0 보다 커서 못 막았다.
 *
 * 그 숫자에는 **상품 가격이 한 푼도 들어 있지 않다.** 그런데 이름은 「권장
 * 판매가」이고, 등록 경로로 그대로 나간다.
 */

const base = {
  priceValidity: "VALID" as const,
  priceOverrideKrw: null,
  priceBreakdown: DEFAULT_PRICE_BREAKDOWN_INPUT,
};

describe("① 원본 가격이 없으면 등록가를 만들지 않는다", () => {
  it("🔴 실측 그대로 — amount 0 · currency 빈 문자열", () => {
    const r = resolveListingPrice({ ...base, originalAmount: 0, originalCurrency: "" });
    expect(r.source).toBe("UNRESOLVED");
    expect(r.priceKrw).toBeNull();
  });

  it("🔴 배송비가 커도 그 값으로 가격을 만들지 않는다 — 방어선이 배송비에 뚫리던 자리", () => {
    const r = resolveListingPrice({
      ...base,
      originalAmount: 0,
      originalCurrency: "",
      priceBreakdown: { shippingKrw: 99000, feePercent: 10, marginPercent: 12 },
    });
    expect(r.source).toBe("UNRESOLVED");
    expect(r.priceKrw).toBeNull();
  });

  it("금액은 있는데 통화를 모르면 만들지 않는다 — 모르는 통화는 환율 1 로 환산된다", () => {
    const r = resolveListingPrice({ ...base, originalAmount: 84, originalCurrency: "" });
    expect(r.source).toBe("UNRESOLVED");
  });

  it("음수도 막는다", () => {
    expect(resolveListingPrice({ ...base, originalAmount: -1, originalCurrency: "EUR" }).source).toBe("UNRESOLVED");
  });
});

describe("② 🔴 무회귀 — 정상 상품의 숫자는 하나도 바뀌지 않았다", () => {
  it("€75 는 예전 그대로 등록가가 나온다", () => {
    const r = resolveListingPrice({ ...base, originalAmount: 75, originalCurrency: "EUR" }, { EUR: 1480 });
    expect(r.source).toBe("SYSTEM_SUGGESTED");
    expect(r.priceKrw).not.toBeNull();
  });

  it("판매자 확정가는 원본 가격과 무관하게 먼저다 — 그 값은 판매자가 직접 정한 숫자다", () => {
    const r = resolveListingPrice({
      ...base,
      originalAmount: 0,
      originalCurrency: "",
      priceOverrideKrw: 150000,
    });
    expect(r.source).toBe("SELLER_OVERRIDE");
    expect(r.priceKrw).toBe(150000);
  });

  it("가격 미확정(priceValidity)은 예전 문이 그대로 막는다", () => {
    const r = resolveListingPrice({
      ...base,
      priceValidity: "UNREADABLE" as never,
      originalAmount: 75,
      originalCurrency: "EUR",
    });
    expect(r.source).toBe("UNRESOLVED");
  });
});
