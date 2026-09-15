import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MANUFACTURER_SOURCE_LABEL, resolveManufacturer } from "../common/manufacturer";

/**
 * REWORK-10 A(CEO 지시, 2026-09-15) — **제조사 · 전 채널 공통 resolver.**
 *
 *   ① 상품 원문 제조사 → ② 브랜드 프로필 → ③ 판매자 기본정보 → ④ 등록 불가 안내
 *
 * 🔴 이 파일이 지키는 두 가지:
 *   1. 네 단계의 우선순위와 "값을 지어내지 않는다"가 실제로 참인가.
 *   2. **쿠팡 payload의 기존 사슬과 결과가 같은가.** 쿠팡 등록 경로는 이번
 *      작업에서 diff 0으로 유지하기로 했으므로(CEO 금지 항목) 그 파일이
 *      이 함수를 import하지 않는다. 대신 여기서 같은 결과를 내는지 확인하고,
 *      그 쪽 소스 줄이 여전히 같은 사슬인지도 글자로 고정한다 — 한쪽이 조용히
 *      바뀌면 이 테스트가 깨진다.
 */

/** 쿠팡 build-payload.ts:1171의 사슬을 **글자 그대로** 옮겨 적은 것. */
function coupangChain(
  product: string,
  brandProfile: string | undefined,
  sellerConfig: string,
): string | undefined {
  return product || brandProfile || sellerConfig || undefined;
}

describe("REWORK-10 A — 제조사 폴백 네 단계", () => {
  it("① 상품 원문이 있으면 언제나 그것이 이긴다", () => {
    expect(
      resolveManufacturer({
        productManufacturer: "원문제조사",
        brandProfileManufacturer: "브랜드제조사",
        sellerProfileManufacturer: "판매자제조사",
      }),
    ).toEqual({ value: "원문제조사", source: "PRODUCT", resolved: true });
  });

  it("② 원문이 없으면 브랜드 프로필", () => {
    expect(
      resolveManufacturer({
        productManufacturer: "",
        brandProfileManufacturer: "Bobo Choses S.L.",
        sellerProfileManufacturer: "따져코리아",
      }),
    ).toEqual({ value: "Bobo Choses S.L.", source: "BRAND_DEFAULT", resolved: true });
  });

  it("③ 둘 다 없으면 판매자 기본정보", () => {
    expect(
      resolveManufacturer({ productManufacturer: "", sellerProfileManufacturer: "따져코리아" }),
    ).toEqual({ value: "따져코리아", source: "SELLER_DEFAULT", resolved: true });
  });

  it("④ 셋 다 없으면 값을 지어내지 않는다 — 판정으로 남긴다", () => {
    expect(resolveManufacturer({})).toEqual({ value: "", source: "NONE", resolved: false });
  });

  it("공백만 있는 값은 값이 아니다 — 다음 단계로 넘어간다", () => {
    expect(
      resolveManufacturer({
        productManufacturer: "   ",
        brandProfileManufacturer: "\t\n",
        sellerProfileManufacturer: " 따져코리아 ",
      }),
    ).toEqual({ value: "따져코리아", source: "SELLER_DEFAULT", resolved: true });
  });

  it("단계 이름은 셀러가 읽는 말로 한 곳에서 정해진다", () => {
    expect(MANUFACTURER_SOURCE_LABEL.BRAND_DEFAULT).toBe("브랜드 프로필");
    expect(MANUFACTURER_SOURCE_LABEL.SELLER_DEFAULT).toBe("판매자 기본정보");
  });
});

describe("REWORK-10 A — 🔴 쿠팡 기존 사슬과 결과가 같다(쿠팡 payload diff 0)", () => {
  const CASES: [string, string, string][] = [
    ["원문", "브랜드", "판매자"],
    ["", "브랜드", "판매자"],
    ["", "", "판매자"],
    ["", "", ""],
    ["원문", "", ""],
    ["", "브랜드", ""],
  ];

  it.each(CASES)("product=%s brand=%s seller=%s", (product, brand, seller) => {
    const chain = coupangChain(product, brand || undefined, seller) ?? "";
    expect(
      resolveManufacturer({
        productManufacturer: product,
        brandProfileManufacturer: brand,
        sellerProfileManufacturer: seller,
      }).value,
    ).toBe(chain);
  });

  /**
   * 🔴 쿠팡 쪽 사슬이 조용히 바뀌면 위 동치 검사가 무의미해진다. 그 줄을
   * 글자로 고정한다 — 쿠팡 payload를 바꾸지 않겠다는 약속의 기계적 증거이기도 하다.
   */
  it("쿠팡 build-payload의 제조사 줄이 그대로다", () => {
    const source = readFileSync(new URL("../coupang/build-payload.ts", import.meta.url), "utf8");
    expect(source).toContain(
      "manufacturer: product.manufacturer.value || brandProfile?.manufacturer || sellerConfig.manufacturer || undefined,",
    );
  });
});
