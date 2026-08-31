import { describe, expect, it } from "vitest";
import { productIdentityKey } from "../brand-market";

/**
 * P-13A CPO 2차 검증 항목 1/2(2026-08-31) — "snapshot 중복이 confidence에
 * 다시 들어갈 수 없는지" / "서로 다른 상품은 정상 집계되는지"를 실제
 * computeBrandMarketProfileFor()가 쓰는 productIdentityKey()로 직접 검증한다.
 * 실측(2026-08-31 CTO 1차 검증에서 발견한 실제 DB 값): junioredition.com의
 * 로케일 prefix 유무 URL 2개가 동일 상품이었다.
 */
describe("productIdentityKey — 항목 1: 같은 상품의 snapshot 중복은 1개 표본으로 묶인다", () => {
  it("실측: 같은 상품을 로케일 prefix 없이/있게(en-kr) 크롤링한 2개 URL이 같은 키로 묶인다", () => {
    const withoutLocale =
      "https://www.junioredition.com/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
    const withLocale =
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses";
    expect(productIdentityKey(withoutLocale, "snap-a")).toBe(productIdentityKey(withLocale, "snap-b"));
  });

  it("동일 URL을 10회 재크롤링(snapshotId만 다름)해도 전부 같은 키로 묶인다", () => {
    const url = "https://www.junioredition.com/en-kr/collections/bobo-choses/products/stamp-bloom-all-over-denim-pants-by-bobo-choses";
    const keys = Array.from({ length: 10 }, (_, i) => productIdentityKey(url, `snap-${i}`));
    const distinctKeys = new Set(keys);
    expect(distinctKeys.size).toBe(1);
  });

  it("쿼리스트링만 다른 동일 상품 URL도 같은 키로 묶인다(합성 케이스 — 실측 아님, normalizeUrl의 search 제거 동작 확인용)", () => {
    const a = "https://www.smallable.com/en/product/foo-liewood-409775";
    const b = "https://www.smallable.com/en/product/foo-liewood-409775?algsearch=b5431da021abba9c8fe830c20241f5b6";
    expect(productIdentityKey(a, "snap-x")).toBe(productIdentityKey(b, "snap-y"));
  });
});

describe("productIdentityKey — 항목 2: 서로 다른 상품은 절대 같은 키로 합쳐지지 않는다(과잉병합 방지)", () => {
  it("실측: Bobo Choses의 서로 다른 4개 상품 URL이 모두 다른 키를 갖는다", () => {
    const urls = [
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses",
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses",
      "https://www.junioredition.com/en-kr/collections/bobo-choses/products/stamp-bloom-all-over-denim-pants-by-bobo-choses",
      "https://www.junioredition.com/products/bobo-choses-color-block-zipped-sweatshirt-by-bobo-choses",
    ];
    const keys = urls.map((u, i) => productIdentityKey(u, `snap-${i}`));
    expect(new Set(keys).size).toBe(urls.length);
  });

  it("sourceUrl이 없는 두 snapshot은 서로 다른 상품으로 취급된다(snapshotId로 폴백, 잘못 합치지 않음)", () => {
    expect(productIdentityKey(null, "snap-a")).not.toBe(productIdentityKey(null, "snap-b"));
  });
});
