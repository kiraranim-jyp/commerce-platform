import { describe, expect, it, vi } from "vitest";
import { fetchShopifyProductJson } from "../shopify-product-json";

/**
 * P0-A.29-E ㉮ Golden 역증명(CEO 지시, 2026-09-20).
 *
 * 아래 variants 는 **2026-09-20 junioredition.com 실응답을 그대로 옮긴 것**이다
 * (`/products/lulu-t-bar-shoes-in-tobacco-by-pepe.json`). 값을 손보지 않았다 —
 * 손보는 순간 이 테스트는 현실이 아니라 내 가정을 지키게 된다.
 *
 *   21 EUR (UK 4)     £115   재고 1   ← 지금까지 화면에 뜨던 값
 *   22 EUR (UK 5)     £115   재고 1
 *   24 EUR (UK 7)     £119   재고 0
 *   25 EUR (UK 7.5)   £119   재고 1
 *   26 EUR (UK 8)     £119   재고 1
 *   28 EUR (UK 10)    £119   재고 0
 *   29 EUR (UK 11)    £119   재고 1   ← 사장님이 URL 로 «고른» 것
 *   30 EUR (UK 11.5)  £123   재고 0
 *   31 EUR (UK 12)    £123   재고 1
 */
const REAL_VARIANTS = [
  { id: 40096041599039, option1: "21 EUR (UK 4)", price: "115.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
  { id: 40096041631807, option1: "22 EUR (UK 5)", price: "115.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
  { id: 40096041697343, option1: "24 EUR (UK 7)", price: "119.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 0 },
  { id: 40096037404735, option1: "25 EUR (UK 7.5)", price: "119.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
  { id: 40096037437503, option1: "26 EUR (UK 8)", price: "119.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
  { id: 40096037503039, option1: "28 EUR (UK 10)", price: "119.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 0 },
  { id: 40096037535807, option1: "29 EUR (UK 11)", price: "119.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
  { id: 40096037568575, option1: "30 EUR (UK 11.5)", price: "123.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 0 },
  { id: 40096037601343, option1: "31 EUR (UK 12)", price: "123.00", inventory_management: "shopify", inventory_policy: "deny", inventory_quantity: 1 },
];

const PRODUCT = {
  product: {
    title: "Lulu T Bar Shoes in Tobacco by PèPè",
    vendor: "Pèpè Shoes",
    options: [{ name: "Size", values: REAL_VARIANTS.map((v) => v.option1) }],
    variants: REAL_VARIANTS,
  },
};

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body } as unknown as Response;
}

vi.mock("../rate-limit/domain-rate-limiter", () => ({
  acquireDomainSlot: async () => () => {},
  recordRateLimitResponse: () => {},
  fetchWithDomainRateLimit: async (url: string) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/meta.json") return jsonResponse({ currency: "GBP", country: "GB", name: "Junior Edition" });
    if (parsed.pathname.endsWith(".json")) return jsonResponse(PRODUCT);
    throw new Error(`픽스처에 없는 경로다: ${parsed.pathname}`);
  },
}));

const BASE = "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe";
const fetchAt = (query: string) => fetchShopifyProductJson(`${BASE}${query}`, { forceCanonicalMarket: true });

describe("① 옵션 지정 + 구매 가능 → 그 옵션의 가격", () => {
  it("🔴 사장님이 고른 UK 11 은 £119 다 — £115 가 아니다", async () => {
    const r = await fetchAt("?_pos=2&_psid=5b9ca5c42&variant=40096037535807");
    expect(r?.productData.price).toEqual({ amount: 119, currency: "GBP" });
  });

  it("어느 옵션의 가격인지 말할 수 있다", async () => {
    const r = await fetchAt("?variant=40096037535807");
    expect(r?.productData.selectedVariant).toEqual({
      requestedId: "40096037535807",
      status: "RESOLVED",
      optionValues: { Size: "29 EUR (UK 11)" },
    });
    expect(r?.productData.available).toBe(true);
  });

  it("🔴 £115 는 어디에도 선택 옵션 가격으로 들어가지 않는다", async () => {
    const r = await fetchAt("?variant=40096037535807");
    expect(r?.productData.price?.amount).not.toBe(115);
  });
});

describe("② 옵션 지정 + 품절 → 🔴 다른 사이즈 가격으로 갈아타지 않는다", () => {
  /** 28 EUR (UK 10) — £119, 재고 0. */
  it("품절이어도 «그 옵션의» 가격을 그대로 쓴다", async () => {
    const r = await fetchAt("?variant=40096037503039");
    expect(r?.productData.price).toEqual({ amount: 119, currency: "GBP" });
  });

  it("품절이라는 사실을 숨기지 않는다 — 가격과 구매 가능 여부는 별개 축이다", async () => {
    const r = await fetchAt("?variant=40096037503039");
    expect(r?.productData.selectedVariant?.status).toBe("SOLD_OUT");
    expect(r?.productData.available).toBe(false);
  });

  it("🔴 구매 가능한 첫 옵션(£115)으로 조용히 바뀌지 않는다", async () => {
    const r = await fetchAt("?variant=40096037503039");
    expect(r?.productData.price?.amount).not.toBe(115);
  });
});

describe("③ 옵션 지정 + 찾지 못함 → 🔴 임의 선택 금지", () => {
  it("가격을 내놓지 않는다 — 임의 선택이 곧 오답이다", async () => {
    const r = await fetchAt("?variant=99999999999999");
    expect(r?.productData.price).toBeUndefined();
    expect(r?.productData.selectedVariant?.status).toBe("NOT_FOUND");
  });

  it("구매 가능 여부도 지어내지 않는다", async () => {
    const r = await fetchAt("?variant=99999999999999");
    expect(r?.productData.available).toBeUndefined();
  });
});

describe("④ 옵션 지정 없음 → 기존 동작 그대로", () => {
  it("🔴 예전과 같은 값이 나온다 — 기존 상품의 가격 결정이 흔들리지 않는다", async () => {
    const r = await fetchAt("");
    expect(r?.productData.price).toEqual({ amount: 115, currency: "GBP" });
    expect(r?.productData.available).toBe(true);
    expect(r?.productData.selectedVariant).toBeUndefined();
  });

  it("variant 값이 숫자가 아니면 «지정 없음» 으로 본다", async () => {
    const r = await fetchAt("?variant=abc");
    expect(r?.productData.price?.amount).toBe(115);
    expect(r?.productData.selectedVariant).toBeUndefined();
  });
});

describe("옵션별 가격이 여러 종류라는 사실 자체는 보존된다", () => {
  it("9개 variant 와 £115/£119/£123 이 그대로 남는다", async () => {
    const r = await fetchAt("?variant=40096037535807");
    const amounts = new Set((r?.productData.variants ?? []).map((v) => v.price?.amount));
    expect(r?.productData.variants).toHaveLength(9);
    expect([...amounts].sort((a, b) => Number(a) - Number(b))).toEqual([115, 119, 123]);
  });
});
