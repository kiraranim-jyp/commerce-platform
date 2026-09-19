import { describe, expect, it } from "vitest";
import { extractShopifySelectedVariantId } from "../shopify-product-json";

/**
 * P0-A.29-E ㉮ Golden(CEO 지시, 2026-09-20) — **사용자가 특정 옵션을 선택한 URL 을
 * 줬다면, 그 옵션의 가격이 상품 가격이다.**
 *
 * 사장님이 실제로 준 URL:
 *
 *   https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe
 *       ?_pos=2&_psq=…&_psid=5b9ca5c42&_ss=e&variant=40096037535807
 *
 * 실측(2026-09-20, /products/{handle}.json):
 *
 *   variant 40096037535807  =  Size "29 EUR (UK 11)"  £119  구매 가능
 *   구매 가능한 «첫» variant =  Size "21 EUR (UK 4)"   £115   ← 지금까지 쓰던 값
 *
 * 같은 상품이 사이즈마다 £115 / £119 / £123 이고, junioredition 신발 카테고리의
 * 45%(133개 중 60개)가 사이즈별로 값이 다르다. 즉 이건 예외가 아니다.
 */

const GOLDEN =
  "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe" +
  "?_pos=2&_psq=Lulu+T+Bar+Shoes&_psid=5b9ca5c42&_ss=e&variant=40096037535807";

describe("🔴 URL 이 가리킨 옵션을 읽어낸다", () => {
  it("사장님 Golden URL 에서 40096037535807 을 뽑는다", () => {
    expect(extractShopifySelectedVariantId(GOLDEN)).toBe("40096037535807");
  });

  it("로케일 프리픽스(/en-kr/)가 있어도 읽는다", () => {
    expect(
      extractShopifySelectedVariantId("https://x.com/en-kr/products/a?variant=123"),
    ).toBe("123");
  });

  it("다른 쿼리(_pos/_psq/_psid/_ss)에 섞여 있어도 읽는다 — 순서에 기대지 않는다", () => {
    expect(extractShopifySelectedVariantId("https://x.com/products/a?variant=9&_pos=2")).toBe("9");
    expect(extractShopifySelectedVariantId("https://x.com/products/a?_pos=2&variant=9")).toBe("9");
  });
});

describe("🔴 «지정 없음» 과 «지정했는데 이상함» 을 섞지 않는다", () => {
  it("variant 파라미터가 없으면 null — 예전 동작을 그대로 쓰라는 뜻이다", () => {
    expect(extractShopifySelectedVariantId("https://x.com/products/a")).toBeNull();
    expect(extractShopifySelectedVariantId("https://x.com/products/a?_pos=2")).toBeNull();
  });

  it("숫자가 아니면 받지 않는다 — Shopify variant id 는 언제나 숫자다", () => {
    for (const bad of ["abc", "", "12a", "1.5", "-3"]) {
      expect(extractShopifySelectedVariantId(`https://x.com/products/a?variant=${bad}`)).toBeNull();
    }
  });

  it("URL 이 깨져 있어도 던지지 않는다", () => {
    expect(extractShopifySelectedVariantId("not a url")).toBeNull();
  });
});
