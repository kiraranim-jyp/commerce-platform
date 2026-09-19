import { describe, expect, it, vi } from "vitest";
import { enrichCandidatePrices } from "../price-source-adapter";
import type { ComparisonCandidate, ComparisonQuery } from "../types";

/**
 * P0-A.29-E ㉮⑤ Golden(CEO 지시, 2026-09-20) — **원상품이 고른 옵션과 같은 옵션의
 * 가격을 비교한다.**
 *
 * 2026-09-20 junioredition 실측:
 *
 *   원상품  Lulu T Bar Shoes in Tobacco       UK 11  £119  구매 가능
 *   후보    Lulu T Bar Shoes in Vernice Nero  UK 11  £119  🔴 품절
 *                                             UK 10  £119  구매 가능
 *
 * 즉 **같은 옵션 기준으로는 두 상품이 같은 값**이다. 화면에 보이던 £115 차이는
 * 색상 차이가 아니라 «다른 사이즈를 비교한 결과» 였다.
 */

const VERNICE_NERO = {
  product: {
    title: "Lulu T Bar Shoes in Vernice Nero by PèPè",
    vendor: "Pèpè Shoes",
    options: [{ name: "Size", values: ["28 EUR (UK 10)", "29 EUR (UK 11)"] }],
    variants: [
      { id: 1, option1: "28 EUR (UK 10)", price: "119.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
      { id: 2, option1: "29 EUR (UK 11)", price: "119.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 0 },
    ],
  },
};

/** 사이즈마다 값이 «다른» 상품 — junioredition Tobacco 의 실제 가격 구조. */
const MULTI_PRICE = {
  product: {
    title: "Lulu T Bar Shoes in Tobacco by PèPè",
    vendor: "Pèpè Shoes",
    options: [{ name: "Size", values: ["21 EUR (UK 4)", "29 EUR (UK 11)", "31 EUR (UK 12)"] }],
    variants: [
      { id: 10, option1: "21 EUR (UK 4)", price: "115.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
      { id: 11, option1: "29 EUR (UK 11)", price: "119.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
      { id: 12, option1: "31 EUR (UK 12)", price: "123.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
    ],
  },
};

let FIXTURE: unknown = VERNICE_NERO;

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body } as unknown as Response;
}

vi.mock("../../rate-limit/domain-rate-limiter", () => ({
  acquireDomainSlot: async () => () => {},
  recordRateLimitResponse: () => {},
  fetchWithDomainRateLimit: async (url: string) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/meta.json") return jsonResponse({ currency: "GBP", country: "GB" });
    return jsonResponse(FIXTURE);
  },
}));

const candidate = (title: string): ComparisonCandidate => ({
  title,
  url: "https://www.junioredition.com/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe",
  price: { amount: 0, currency: "GBP" },
  imageUrl: null,
  confidence: 0.9,
  matchLevel: "high",
});

const queryWith = (selectedOptionValues?: Record<string, string>): ComparisonQuery => ({
  title: "Lulu T Bar Shoes in Tobacco by PèPè",
  brand: "Pèpè",
  selectedOptionValues,
});

describe("원상품이 고른 옵션이 후보에도 있으면 — 그 옵션의 가격", () => {
  it("🔴 UK 11 기준으로 £119 다. 후보의 «구매 가능한 첫 옵션» 가격이 아니다", async () => {
    FIXTURE = VERNICE_NERO;
    const [c] = await enrichCandidatePrices(
      [candidate("Lulu T Bar Shoes in Vernice Nero by PèPè")],
      "junioredition.com",
      queryWith({ Size: "29 EUR (UK 11)" }),
    );
    expect(c.priceOptionMatch).toBe("SINGLE_PRICE");
    expect(c.price).toEqual({ amount: 119, currency: "GBP" });
  });

  it("사이즈마다 값이 다른 상품에서 같은 옵션을 찾아낸다", async () => {
    FIXTURE = MULTI_PRICE;
    const [c] = await enrichCandidatePrices([candidate("Lulu T Bar Shoes in Tobacco by PèPè")], "junioredition.com", queryWith({ Size: "29 EUR (UK 11)" }));
    expect(c.priceOptionMatch).toBe("SAME_OPTION");
    expect(c.price).toEqual({ amount: 119, currency: "GBP" });
    expect(c.priceOptionValues).toEqual({ Size: "29 EUR (UK 11)" });
  });

  it("🔴 £115(가장 싼 사이즈)가 비교 가격으로 들어가지 않는다", async () => {
    FIXTURE = MULTI_PRICE;
    const [c] = await enrichCandidatePrices([candidate("x")], "junioredition.com", queryWith({ Size: "29 EUR (UK 11)" }));
    expect(c.price?.amount).not.toBe(115);
  });
});

describe("🔴 같은 옵션을 찾지 못하면 — 다른 옵션 가격을 들이밀지 않는다", () => {
  it("옵션마다 값이 다른데 못 찾으면 OPTION_MISMATCH", async () => {
    FIXTURE = MULTI_PRICE;
    const [c] = await enrichCandidatePrices([candidate("x")], "junioredition.com", queryWith({ Size: "40 EUR (UK 99)" }));
    expect(c.priceOptionMatch).toBe("OPTION_MISMATCH");
  });

  it("원상품이 옵션을 고르지 않았어도 OPTION_MISMATCH — 기준이 없으면 비교할 수 없다", async () => {
    FIXTURE = MULTI_PRICE;
    const [c] = await enrichCandidatePrices([candidate("x")], "junioredition.com", queryWith(undefined));
    expect(c.priceOptionMatch).toBe("OPTION_MISMATCH");
  });
});

describe("옵션이 달라도 값이 하나면 — 멀쩡한 가격을 죽이지 않는다", () => {
  it("SINGLE_PRICE 는 비교해도 안전하다(실측: 절반 이상이 이 경우다)", async () => {
    FIXTURE = VERNICE_NERO;
    const [c] = await enrichCandidatePrices([candidate("x")], "junioredition.com", queryWith({ Size: "없는 사이즈" }));
    expect(c.priceOptionMatch).toBe("SINGLE_PRICE");
    expect(c.price).toEqual({ amount: 119, currency: "GBP" });
  });
});

describe("query 자체가 없으면 예전 동작 그대로 — 국내 경로는 불변", () => {
  it("priceOptionMatch 로 기존 가격을 막지 않는다", async () => {
    FIXTURE = MULTI_PRICE;
    const [c] = await enrichCandidatePrices([candidate("x")], "junioredition.com");
    expect(c.price).toEqual({ amount: 115, currency: "GBP" });
  });
});
