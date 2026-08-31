import { describe, expect, it } from "vitest";
import { computeSourceUrlKey } from "../category-recommendation-cache";

/**
 * P-13C-2 STEP3-B(CPO 승인, 2026-08-31) — CPO 결정: "동일 상품 재크롤링 시
 * 기존 READY 캐시를 재사용한다." 그 판단의 근거가 되는 computeSourceUrlKey()를
 * 직접 검증한다. brand-market.ts의 productIdentityKey()가 이미 검증해둔 것과
 * 같은 실측 케이스(로케일 prefix/쿼리스트링 변형)를 재사용한다 — 같은
 * normalizeUrl/stripShopifyLocalePrefix 정규화를 그대로 쓰기 때문에 동일하게
 * 동작해야 한다.
 */
describe("computeSourceUrlKey — 동일 상품은 같은 키로 묶인다", () => {
  it("실측: 로케일 prefix 유무(en-kr) URL 2개가 같은 키로 묶인다", () => {
    const withoutLocale =
      "https://www.junioredition.com/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
    const withLocale =
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
    expect(computeSourceUrlKey(withoutLocale)).toBe(computeSourceUrlKey(withLocale));
  });

  it("쿼리스트링만 다른 동일 상품 URL도 같은 키로 묶인다", () => {
    const a = "https://www.smallable.com/en/product/foo-liewood-409775";
    const b = "https://www.smallable.com/en/product/foo-liewood-409775?algsearch=b5431da021abba9c8fe830c20241f5b6";
    expect(computeSourceUrlKey(a)).toBe(computeSourceUrlKey(b));
  });

  it("동일 URL을 여러 번 계산해도 항상 같은 키를 낸다(결정론적)", () => {
    const url = "https://www.junioredition.com/en-kr/collections/bobo-choses/products/stamp-bloom-all-over-denim-pants-by-bobo-choses";
    const keys = Array.from({ length: 5 }, () => computeSourceUrlKey(url));
    expect(new Set(keys).size).toBe(1);
  });
});

describe("computeSourceUrlKey — 서로 다른 상품은 절대 같은 키로 합쳐지지 않는다", () => {
  it("실측: Bobo Choses의 서로 다른 4개 상품 URL이 모두 다른 키를 갖는다", () => {
    const urls = [
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses",
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/stamp-bloom-all-over-denim-pants-by-bobo-choses",
      "https://www.junioredition.com/products/bobo-choses-color-block-zipped-sweatshirt-by-bobo-choses",
    ];
    const keys = urls.map((u) => computeSourceUrlKey(u));
    expect(new Set(keys).size).toBe(urls.length);
  });

  it("빈 sourceUrl은 빈 키를 낸다(findReadyCategoryRecommendationCache가 조회 자체를 건너뛰는 신호)", () => {
    expect(computeSourceUrlKey("")).toBe("");
  });
});
