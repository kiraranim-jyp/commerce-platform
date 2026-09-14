import { describe, expect, it } from "vitest";
import { checkColorOptionSanity } from "../color-option-sanity";
import { buildProductIdentityDna } from "../product-identity-dna";
import type { CanonicalProduct, CanonicalProductVariant, ProvenanceField } from "../product-types";

function field<T>(value: T): ProvenanceField<T> {
  return { value, source: "ORIGINAL", confidence: 0.9 };
}

function variant(id: string, optionValues: Record<string, string>): CanonicalProductVariant {
  return { id, optionValues };
}

/** product-identity-dna.test.ts의 픽스처와 같은 최소 CanonicalProduct —
 * SIZE 경로가 이 필터에 전혀 영향받지 않는다는 것을 같은 입력으로 증명해야
 * 해서 여기서도 온전한 CanonicalProduct가 필요하다. */
function baseProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://www.smallable.com/en/product-430663",
    title: field("Bobo Choses Straight Jogging Pants"),
    brand: field("Bobo Choses"),
    price: field({ amount: 79, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field(""),
    description: field(""),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    titleKo: field(""),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field(""),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(0),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
    ...overrides,
  };
}

describe("COLOR OPTION SANITY FILTER — D1 색상 축이 정확히 1개", () => {
  it("색상 축이 없으면 거른다 — 운영 DB의 Size 31행 + Clothing size 12행이 여기다", () => {
    const result = checkColorOptionSanity({
      optionGroups: [{ name: "Clothing size", values: ["2-3Y", "4-5Y"] }],
      variants: [
        variant("1", { "Clothing size": "2-3Y" }),
        variant("2", { "Clothing size": "4-5Y" }),
      ],
    });
    expect(result).toEqual({ values: [], axisName: null, rejectedBy: "NO_COLOR_AXIS" });
  });

  it("색상으로 걸리는 축이 2개면 어느 것이 색인지 모르므로 거른다", () => {
    const result = checkColorOptionSanity({
      optionGroups: [
        { name: "Color", values: ["Black"] },
        { name: "Colour", values: ["Black"] },
      ],
      variants: [variant("1", { Color: "Black", Colour: "Black" })],
    });
    expect(result.rejectedBy).toBe("AMBIGUOUS_COLOR_AXIS");
    expect(result.values).toEqual([]);
  });

  it("Colour / 색상 같은 표기 차이는 같은 색상 축으로 본다", () => {
    expect(
      checkColorOptionSanity({
        optionGroups: [{ name: "Colour", values: ["Navy"] }],
        variants: [variant("1", { Colour: "Navy" })],
      }).axisName,
    ).toBe("Colour");
    expect(
      checkColorOptionSanity({
        optionGroups: [{ name: "색상", values: ["네이비"] }],
        variants: [variant("1", { 색상: "네이비" })],
      }).axisName,
    ).toBe("색상");
  });
});

describe("COLOR OPTION SANITY FILTER — D2 variants 가 비어있지 않다", () => {
  it("variants 가 비어 있으면 거른다 — Shopify 자리표시자·본문 치수 스펙 경로", () => {
    const result = checkColorOptionSanity({
      optionGroups: [{ name: "Color", values: ["Default Title"] }],
      variants: [],
    });
    expect(result).toEqual({ values: [], axisName: null, rejectedBy: "NO_VARIANTS" });
  });

  it("variants 필드 자체가 없어도(과거 데이터) 같은 판단이다", () => {
    expect(
      checkColorOptionSanity({ optionGroups: [{ name: "Color", values: ["Black"] }] }).rejectedBy,
    ).toBe("NO_VARIANTS");
  });
});

describe("COLOR OPTION SANITY FILTER — D3 선언 집합 == 실제 판매 집합", () => {
  it("선언 12색 · 실제 1색이면 가족 목록이므로 거른다 (rothys 실측 모양)", () => {
    const declared = [
      "ReVelvet™ Mulberry",
      "Black",
      "Bone",
      "Chai",
      "Deep Olive",
      "Espresso",
      "Fog",
      "Merlot",
      "Navy",
      "Oat",
      "Sage",
      "Slate",
    ];
    const result = checkColorOptionSanity({
      optionGroups: [
        { name: "Color", values: declared },
        { name: "Size", values: ["5", "6", "7"] },
      ],
      variants: [
        variant("1", { Color: "ReVelvet™ Mulberry", Size: "5" }),
        variant("2", { Color: "ReVelvet™ Mulberry", Size: "6" }),
        variant("3", { Color: "ReVelvet™ Mulberry", Size: "7" }),
      ],
    });
    expect(result.rejectedBy).toBe("DECLARED_EXCEEDS_SOLD");
    expect(result.values).toEqual([]);
  });

  it("실제가 선언보다 많아도 거른다 — 선언이 불완전하다는 뜻이다", () => {
    const result = checkColorOptionSanity({
      optionGroups: [{ name: "Color", values: ["Black"] }],
      variants: [variant("1", { Color: "Black" }), variant("2", { Color: "Ivory" })],
    });
    expect(result.rejectedBy).toBe("DECLARED_EXCEEDS_SOLD");
  });

  it("일부 variant 가 색 칸을 비워두면 집합이 작아져 거른다", () => {
    const result = checkColorOptionSanity({
      optionGroups: [{ name: "Color", values: ["Black", "Ivory"] }],
      variants: [variant("1", { Color: "Black" }), variant("2", {})],
    });
    expect(result.rejectedBy).toBe("DECLARED_EXCEEDS_SOLD");
  });

  it("선언과 실제가 같으면 통과한다 — 실제 다색 리스팅(외부 139건 모양)", () => {
    const result = checkColorOptionSanity({
      optionGroups: [
        { name: "Color", values: ["Black", "Ivory", "Sage"] },
        { name: "Size", values: ["Twin", "Queen"] },
      ],
      variants: [
        variant("1", { Color: "Black", Size: "Twin" }),
        variant("2", { Color: "Ivory", Size: "Twin" }),
        variant("3", { Color: "Sage", Size: "Twin" }),
        variant("4", { Color: "Black", Size: "Queen" }),
        variant("5", { Color: "Ivory", Size: "Queen" }),
        variant("6", { Color: "Sage", Size: "Queen" }),
      ],
    });
    expect(result).toEqual({
      values: ["Black", "Ivory", "Sage"],
      axisName: "Color",
      rejectedBy: null,
    });
  });

  it("1값 · 1변형(운영 DB smallable 색상 5행 모양)은 통과한다", () => {
    const result = checkColorOptionSanity({
      optionGroups: [{ name: "Color", values: ["Lavender"] }],
      variants: [variant("variant-0", { Color: "Lavender" })],
    });
    expect(result).toEqual({ values: ["Lavender"], axisName: "Color", rejectedBy: null });
  });
});

/**
 * 🔴 이 블록이 이 작업의 가장 중요한 회귀다. `optionGroups`는 COLOR 축에는
 * 도달하지 않지만 SIZE 축에는 도달한다(resolveSizeRange → dna.sizeRange →
 * ProductFacts.sizeLabels → compareSize). 색상 거름망이 사이즈 값을 하나라도
 * 지우면 사이즈 비교가 조용히 죽는다.
 */
describe("색상 축 한정 — SIZE 경로는 한 글자도 건드리지 않는다", () => {
  it("Size=[OS] · variants=0 은 D2 에 걸릴 모양이지만 sizeRange 는 그대로 남는다", () => {
    // 운영 DB theanimalsobservatory 1행의 실제 모양이다. 색상 축이 아니므로
    // 이 필터에 애초에 들어오지 않고, sizeRange 는 예전과 동일하게 ["OS"] 다.
    const product = baseProduct({ optionGroups: [{ name: "Size", values: ["OS"] }], variants: [] });
    expect(buildProductIdentityDna(product).sizeRange).toEqual(["OS"]);
    expect(checkColorOptionSanity(product).rejectedBy).toBe("NO_COLOR_AXIS");
  });

  it("색상 축이 D3 에서 떨어져도 같은 상품의 sizeRange 는 전부 살아있다", () => {
    const product = baseProduct({
      optionGroups: [
        { name: "Color", values: ["Mulberry", "Black", "Bone"] },
        { name: "Size", values: ["5", "6", "7"] },
      ],
      variants: [
        variant("1", { Color: "Mulberry", Size: "5" }),
        variant("2", { Color: "Mulberry", Size: "6" }),
        variant("3", { Color: "Mulberry", Size: "7" }),
      ],
    });
    expect(checkColorOptionSanity(product).rejectedBy).toBe("DECLARED_EXCEEDS_SOLD");
    expect(buildProductIdentityDna(product).sizeRange).toEqual(["5", "6", "7"]);
  });

  it("Title=[Default Title] · variants=0 도 sizeRange 에 영향이 없다", () => {
    const product = baseProduct({
      optionGroups: [{ name: "Title", values: ["Default Title"] }],
      variants: [],
    });
    expect(buildProductIdentityDna(product).sizeRange).toEqual([]);
    expect(checkColorOptionSanity(product).rejectedBy).toBe("NO_COLOR_AXIS");
  });

  it("운영 DB에 존재하는 축 이름 4종에서 색상 규칙과 사이즈 규칙은 겹치지 않는다", () => {
    const sizePattern = /size|사이즈|치수/i;
    for (const name of ["Size", "Clothing size", "Color", "Title", "Colour", "색상", "Shoe Size"]) {
      const isColor = checkColorOptionSanity({
        optionGroups: [{ name, values: ["x"] }],
        variants: [variant("1", { [name]: "x" })],
      }).axisName;
      expect(isColor !== null && sizePattern.test(name)).toBe(false);
    }
  });
});
