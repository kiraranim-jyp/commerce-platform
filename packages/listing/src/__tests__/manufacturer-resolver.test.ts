import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MANUFACTURER_SOURCE_LABEL,
  isProductLevelManufacturer,
  manufacturerInputFromProduct,
  resolveManufacturer,
  type ManufacturerResolverInput,
} from "../common/manufacturer";

/**
 * REWORK-10 A(CEO 지시, 2026-09-15) — **제조사 · 전 채널 공통 resolver.**
 * REWORK-13A(CEO 지시, 2026-09-15) — **그 resolver 가 다섯 단계를 센다.**
 *
 *   ① 원본 URL 의 명시적 제조사
 *   ② 원본 상품정보 · 구조화 데이터에서 명시적으로 확인된 제조사
 *   ③ 설정 > 브랜드 관리의 제조사
 *   ④ 판매자 기본 제조사
 *   ⑤ 직접 입력
 *
 * 🔴 이 파일이 지키는 세 가지:
 *   1. 다섯 단계가 **실제로 차례로 내려간다**(위 단계를 하나씩 빼면서 확인한다).
 *   2. 값을 지어내지 않는다 — 브랜드명이 제조사로 새어 들어가지 않는다.
 *   3. **쿠팡 payload의 기존 사슬과 결과가 같은가.** 쿠팡 등록 경로는 diff 0으로
 *      유지하기로 했으므로(CEO 금지 항목) 그 파일이 이 함수를 import하지 않는다.
 *      대신 여기서 같은 결과를 내는지 확인하고, 그 쪽 소스 줄이 여전히 같은
 *      사슬인지도 글자로 고정한다 — 한쪽이 조용히 바뀌면 이 테스트가 깨진다.
 */

/** 쿠팡 build-payload.ts:1171의 사슬을 **글자 그대로** 옮겨 적은 것. */
function coupangChain(
  product: string,
  brandProfile: string | undefined,
  sellerConfig: string,
): string | undefined {
  return product || brandProfile || sellerConfig || undefined;
}

/** 다섯 단계가 **전부** 값을 들고 있는 상태. 여기서 하나씩 빼 내려간다. */
const ALL_FIVE: ManufacturerResolverInput = {
  manualManufacturer: "셀러가직접입력",
  sourceUrlManufacturer: "원본명시제조사",
  productInfoManufacturer: "상품정보제조사",
  brandProfileManufacturer: "브랜드관리제조사",
  sellerProfileManufacturer: "판매자기본제조사",
};

describe("REWORK-13A — 다섯 단계가 차례로 내려간다(위에서부터 하나씩 뺀다)", () => {
  it("⑤ 셀러가 직접 입력한 값은 어떤 자동 추정도 이긴다", () => {
    expect(resolveManufacturer(ALL_FIVE)).toEqual({
      value: "셀러가직접입력",
      source: "MANUAL",
      resolved: true,
    });
  });

  it("① 직접 입력을 빼면 원본 URL 의 명시적 제조사", () => {
    expect(resolveManufacturer({ ...ALL_FIVE, manualManufacturer: null })).toEqual({
      value: "원본명시제조사",
      source: "SOURCE_URL",
      resolved: true,
    });
  });

  it("② 원본 명시까지 빼면 원본 상품정보에서 확인된 제조사", () => {
    expect(
      resolveManufacturer({ ...ALL_FIVE, manualManufacturer: null, sourceUrlManufacturer: null }),
    ).toEqual({ value: "상품정보제조사", source: "PRODUCT_INFO", resolved: true });
  });

  it("③ 상품이 아무것도 안 들고 있으면 설정 > 브랜드 관리", () => {
    expect(
      resolveManufacturer({
        brandProfileManufacturer: "브랜드관리제조사",
        sellerProfileManufacturer: "판매자기본제조사",
      }),
    ).toEqual({ value: "브랜드관리제조사", source: "BRAND_DEFAULT", resolved: true });
  });

  it("④ 브랜드 관리에도 없으면 판매자 기본 제조사", () => {
    expect(resolveManufacturer({ sellerProfileManufacturer: "판매자기본제조사" })).toEqual({
      value: "판매자기본제조사",
      source: "SELLER_DEFAULT",
      resolved: true,
    });
  });

  it("🔴 다섯 단계가 전부 비면 값을 지어내지 않는다 — 판정으로 남긴다", () => {
    expect(resolveManufacturer({})).toEqual({ value: "", source: "NONE", resolved: false });
  });

  it("공백만 있는 값은 값이 아니다 — 다음 단계로 넘어간다", () => {
    expect(
      resolveManufacturer({
        manualManufacturer: "   ",
        sourceUrlManufacturer: "\t",
        productInfoManufacturer: "\n ",
        brandProfileManufacturer: "  ",
        sellerProfileManufacturer: " 따져코리아 ",
      }),
    ).toEqual({ value: "따져코리아", source: "SELLER_DEFAULT", resolved: true });
  });

  /**
   * 🔴 CEO 금지 항목의 기계적 증거: 브랜드명은 resolver 의 **입력이 아니다.**
   * 어떤 입력 조합으로도 브랜드명이 제조사가 되는 경로가 없다는 것을,
   * "브랜드만 아는 상태"에서 NONE 이 나오는 것으로 고정한다.
   */
  it("🔴 브랜드명은 제조사가 되지 않는다 — 브랜드밖에 모르면 NONE 이다", () => {
    const input = { brand: "Bobo Choses" } as unknown as ManufacturerResolverInput;
    expect(resolveManufacturer(input)).toEqual({ value: "", source: "NONE", resolved: false });
  });
});

describe("REWORK-13A — resolved:false 는 «등록 불가»가 아니다", () => {
  it("판정만 돌려줄 뿐 아무것도 던지지 않는다", () => {
    expect(() => resolveManufacturer({})).not.toThrow();
    expect(resolveManufacturer({}).value).toBe("");
  });
});

describe("REWORK-13A — 상품이 들고 있는 값을 ①·②·⑤로 가르는 규칙은 한 곳이다", () => {
  it("USER_EDITED 면 ⑤(직접 입력)", () => {
    expect(
      manufacturerInputFromProduct({
        manufacturer: { value: "직접입력값", source: "USER_EDITED" },
      }),
    ).toEqual({ manualManufacturer: "직접입력값" });
  });

  it("manufacturerOrigin 이 SOURCE_URL 이면 ①", () => {
    expect(
      manufacturerInputFromProduct({
        manufacturer: { value: "원본명시값", source: "ORIGINAL" },
        manufacturerOrigin: "SOURCE_URL",
      }),
    ).toEqual({ sourceUrlManufacturer: "원본명시값" });
  });

  it("출처 기록이 없으면 ②로 센다 — ①이라고 단정하지 않는다", () => {
    expect(
      manufacturerInputFromProduct({ manufacturer: { value: "어딘가에서온값", source: "ORIGINAL" } }),
    ).toEqual({ productInfoManufacturer: "어딘가에서온값" });
  });

  it("값이 비어 있으면 어느 칸도 채우지 않는다", () => {
    expect(
      manufacturerInputFromProduct({ manufacturer: { value: "  ", source: "REQUIRED" } }),
    ).toEqual({});
  });

  it("①·②·⑤만 «상품이 들고 있는 값»이다", () => {
    expect(isProductLevelManufacturer("MANUAL")).toBe(true);
    expect(isProductLevelManufacturer("SOURCE_URL")).toBe(true);
    expect(isProductLevelManufacturer("PRODUCT_INFO")).toBe(true);
    expect(isProductLevelManufacturer("BRAND_DEFAULT")).toBe(false);
    expect(isProductLevelManufacturer("SELLER_DEFAULT")).toBe(false);
    expect(isProductLevelManufacturer("NONE")).toBe(false);
  });
});

describe("REWORK-13A — 단계 이름은 셀러가 읽는 말로 한 곳에서 정해진다", () => {
  it("다섯 단계가 전부 이름을 갖는다 — ③·④ 문구는 기존 화면 그대로다(회귀 금지)", () => {
    expect(MANUFACTURER_SOURCE_LABEL.MANUAL).toBe("직접 입력");
    expect(MANUFACTURER_SOURCE_LABEL.SOURCE_URL).toBe("원본 페이지");
    expect(MANUFACTURER_SOURCE_LABEL.PRODUCT_INFO).toBe("상품 원문");
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
