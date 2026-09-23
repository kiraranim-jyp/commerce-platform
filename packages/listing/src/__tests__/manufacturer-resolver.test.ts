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
    expect(resolveManufacturer(ALL_FIVE)).toMatchObject({ value: "셀러가직접입력", source: "MANUAL", resolved: true });
  });

  it("① 직접 입력을 빼면 원본 URL 의 명시적 제조사", () => {
    expect(resolveManufacturer({ ...ALL_FIVE, manualManufacturer: null })).toMatchObject({ value: "원본명시제조사", source: "SOURCE_URL", resolved: true });
  });

  it("② 원본 명시까지 빼면 원본 상품정보에서 확인된 제조사", () => {
    expect(
      resolveManufacturer({ ...ALL_FIVE, manualManufacturer: null, sourceUrlManufacturer: null }),
    ).toMatchObject({ value: "상품정보제조사", source: "PRODUCT_INFO", resolved: true });
  });

  it("③ 상품이 아무것도 안 들고 있으면 설정 > 브랜드 관리", () => {
    expect(
      resolveManufacturer({
        brandProfileManufacturer: "브랜드관리제조사",
      }),
    ).toMatchObject({ value: "브랜드관리제조사", source: "BRAND_DEFAULT", resolved: true });
  });

  it("④ 브랜드 관리에도 없으면 «브랜드명» 을 등록값으로 쓴다 (PIVOT NEXT-04c-2)", () => {
    /* 🔴 원래는 「판매자 기본 제조사」였다. 판매 사업자(규하맘샵)를 제조사로
       쓰라고 말하는 채널이 하나도 없다 — 쿠팡 공식 API 는 「정확한 제조사를
       기입할 수 없는 경우 brand 와 동일하게 입력 가능」이라고 명시한다.
       3커머스 공통 규칙: 실제 제조사 → 브랜드명 → 확인 필요. */
    const r = resolveManufacturer({ brandName: "Bobo Choses" });
    expect(r).toMatchObject({ value: "Bobo Choses", source: "PRODUCT_BRAND", resolved: true });
    expect(r.resolutionType).toBe("LISTING_FALLBACK");
    expect(r.requiresReview).toBe(true);
  });

  it("🔴 다섯 단계가 전부 비면 값을 지어내지 않는다 — 판정으로 남긴다", () => {
    expect(resolveManufacturer({})).toMatchObject({ value: "", source: "NONE", resolved: false });
  });

  it("공백만 있는 값은 값이 아니다 — 다음 단계로 넘어간다", () => {
    expect(
      resolveManufacturer({
        manualManufacturer: "   ",
        sourceUrlManufacturer: "\t",
        productInfoManufacturer: "\n ",
        brandProfileManufacturer: "  ",
        brandName: " Bobo Choses ",
      }),
    ).toMatchObject({ value: "Bobo Choses", source: "PRODUCT_BRAND", resolved: true });
  });

  /**
   * 🔴 이 자리에는 「브랜드명은 제조사가 되지 않는다」가 있었다(REWORK-13A).
   * CPO 결정(2026-09-23)으로 뒤집혔다 — 쿠팡 공식 API 가 「정확한 제조사를
   * 기입할 수 없는 경우 brand 와 동일하게 입력 가능」이라고 명시하기 때문이다.
   * 옛 금지가 세워질 때는 그 근거를 몰랐다.
   *
   * 🔴 그래도 원래 금지의 «핵심» 은 살아 있다: 브랜드명에서 제조사명을
   * «지어내지» 않는다. 브랜드명 그대로를 등록값으로 쓸 뿐이고, 그 사실을
   * resolutionType 과 requiresReview 가 들고 다닌다.
   */
  it("🔴 브랜드명을 써도 «상품 사실» 로 승격하지 않는다", () => {
    const r = resolveManufacturer({ brandName: "Bobo Choses" });
    expect(r.value).toBe("Bobo Choses");
    // 값을 «지어내지» 않았다 — "Bobo Choses S.L." 같은 추론은 여전히 금지다.
    expect(r.resolutionType).not.toBe("PRODUCT_FACT");
    expect(r.requiresReview).toBe(true);
  });

  it("브랜드조차 없으면 값을 지어내지 않는다 — 확인 필요로 남긴다", () => {
    expect(resolveManufacturer({})).toMatchObject({ value: "", source: "NONE", resolved: false });
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
    /* 🔴 PIVOT NEXT-04c-2 — 「판매자 기본정보」가 사라지고 「브랜드명」이 그
       자리에 왔다. 셀러에게 「판매자 기본정보의 제조사」라고 말하던 화면이
       이제 「브랜드명」이라고 말한다. */
    expect(MANUFACTURER_SOURCE_LABEL.PRODUCT_BRAND).toBe("브랜드명");
  });
});

describe("🔴 PIVOT NEXT-04c-2 — 쿠팡 사슬과 공통 resolver 가 «같은 규칙» 을 쓴다", () => {
  /* 원래 이 묶음은 「쿠팡 기존 사슬(product||brandProfile||seller)과 diff 0」을
     지켰다. 그 사슬의 마지막 단계가 «판매 사업자» 였고, 04c-1 조사에서 그것이
     잘못된 semantic 임이 확인됐다. 이제 셋 다 같은 규칙을 쓴다:

         실제 제조사 → 브랜드 프로필 → 브랜드명 → 확인 필요 */
  const CASES: [string, string, string][] = [
    ["원문", "브랜드프로필", "브랜드명"],
    ["", "브랜드프로필", "브랜드명"],
    ["", "", "브랜드명"],
    ["", "", ""],
    ["원문", "", ""],
    ["", "브랜드프로필", ""],
  ];

  it.each(CASES)("product=%s brandProfile=%s brand=%s", (product, brandProfile, brandName) => {
    const expected = product || brandProfile || brandName || "";
    expect(
      resolveManufacturer({ productManufacturer: product, brandProfileManufacturer: brandProfile, brandName }).value,
    ).toBe(expected);
  });

  /** 🔴 쿠팡 사슬이 조용히 되돌아가면 이 검사가 잡는다 — 판매 사업자가 다시 들어오는 것을 막는다. */
  it("쿠팡 build-payload 가 제조사를 «한 곳에서» 정하고 판매 사업자를 보지 않는다", () => {
    const source = readFileSync(new URL("../coupang/build-payload.ts", import.meta.url), "utf8");
    // 판정은 공통 resolver 한 번, 그 결과를 아이템 빌더에 내려보낸다.
    expect(source).toContain("const manufactureResolution = resolveManufacturer({");
    expect(source).toContain("manufacture: productManufacture,");
    expect(source).toContain("manufacturer: manufacture,");
    expect(source).not.toContain("sellerConfig.manufacturer ||");
  });

  /** 🔴 최상위 manufacture 는 고시와 «다른 칸» 이다 — 둘 다 «같은 결정값» 을 쓰되 자리가 다르다. */
  it("쿠팡 payload 에 최상위 manufacture 가 실리고, 고시정보와 같은 값을 쓴다", () => {
    const source = readFileSync(new URL("../coupang/build-payload.ts", import.meta.url), "utf8");
    const decisions = source.match(/resolveManufacturer\(\{/g) ?? [];
    expect(decisions.length, "제조사를 두 번 판정하면 두 칸이 갈릴 수 있다").toBe(1);
  });
});
