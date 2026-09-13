import { describe, expect, it } from "vitest";
import {
  buildCrossSellerSearchQueries,
  buildDomesticShopQuery,
  buildProductIdentityDna,
} from "../product-identity-dna";
import type { CanonicalProduct, ProvenanceField } from "../product-types";

function field<T>(value: T): ProvenanceField<T> {
  return { value, source: "ORIGINAL", confidence: 0.9 };
}

/** N-4.18 후속 — 실제 상품 코드를 흉내낸 최소 CanonicalProduct 픽스처.
 * DNA 빌더가 실제로 읽는 필드만 의미 있는 값을 채우고, 나머지는 타입을
 * 만족시키기 위한 빈 값이다. */
function baseProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://bobochoses.com/products/b126ac050",
    title: field("Bobo Choses Denim Pants Blue 8Y"),
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

describe("buildProductIdentityDna", () => {
  it("SKU가 있으면 최우선 식별자로 쓴다", () => {
    const dna = buildProductIdentityDna(baseProduct({ sku: field("B126AC050") }));
    expect(dna.identifier).toEqual({ value: "B126AC050", tier: "SKU" });
  });

  it("SKU가 없고 modelName만 있으면 MODEL_NAME 식별자를 쓴다", () => {
    const dna = buildProductIdentityDna(baseProduct({ modelName: field("B126AC050") }));
    expect(dna.identifier).toEqual({ value: "B126AC050", tier: "MODEL_NAME" });
  });

  it("SKU/modelName 둘 다 없으면 identifier가 null이다(지어내지 않는다)", () => {
    const dna = buildProductIdentityDna(baseProduct());
    expect(dna.identifier).toBeNull();
  });

  it("color 값이 없으면 null — 빈 문자열을 색상으로 취급하지 않는다", () => {
    const dna = buildProductIdentityDna(baseProduct());
    expect(dna.color).toBeNull();
  });

  it("coreTitleTokens는 브랜드/색상 단어와 시즌·사이즈 패턴을 제거한다", () => {
    const dna = buildProductIdentityDna(
      baseProduct({ title: field("Bobo Choses Denim Pants Blue 8Y SS26"), color: field("Blue") }),
    );
    expect(dna.coreTitleTokens).not.toContain("bobo");
    expect(dna.coreTitleTokens).not.toContain("choses");
    expect(dna.coreTitleTokens).not.toContain("blue");
    expect(dna.coreTitleTokens).not.toContain("8y");
    expect(dna.coreTitleTokens).not.toContain("ss26");
    expect(dna.coreTitleTokens).toContain("denim");
    expect(dna.coreTitleTokens).toContain("pants");
  });

  it("category는 breadcrumbPath > jsonLdCategory > shopifyProductType 순으로 첫 번째만 쓴다", () => {
    const withBreadcrumb = buildProductIdentityDna(
      baseProduct({ breadcrumbPath: ["Home", "Kids", "Bottoms"], jsonLdCategory: "Pants" }),
    );
    expect(withBreadcrumb.category).toEqual({ value: "Home > Kids > Bottoms", source: "BREADCRUMB" });

    const withJsonLdOnly = buildProductIdentityDna(baseProduct({ jsonLdCategory: "Pants" }));
    expect(withJsonLdOnly.category).toEqual({ value: "Pants", source: "JSON_LD" });

    const withNone = buildProductIdentityDna(baseProduct());
    expect(withNone.category).toBeNull();
  });

  it("brand.confident는 brandResolution.confidence가 HIGH일 때만 true다", () => {
    const confident = buildProductIdentityDna(
      baseProduct({ brandResolution: { raw: "Bobo Choses SS26", ruleApplied: ["SEASON_CODE"], confidence: "HIGH" } }),
    );
    expect(confident.brand.confident).toBe(true);

    const notResolved = buildProductIdentityDna(baseProduct());
    expect(notResolved.brand.confident).toBe(false);
  });

  it("대표 이미지가 있으면 getSelectedImageUrl 규칙(배경제거 우선)을 그대로 따른다", () => {
    const dna = buildProductIdentityDna(
      baseProduct({
        images: [
          {
            id: "img-1",
            originalUrl: "https://example.com/original.jpg",
            processedUrl: "https://example.com/processed.jpg",
            selectedVariant: "PROCESSED",
            isRepresentative: true,
            useInProductGallery: true,
            useInDescription: false,
            classification: "PRODUCT",
          },
        ],
      }),
    );
    expect(dna.representativeImageUrl).toBe("https://example.com/processed.jpg");
  });

  it("대표 이미지가 없으면 null이다", () => {
    const dna = buildProductIdentityDna(baseProduct());
    expect(dna.representativeImageUrl).toBeNull();
  });
});

describe("buildDomesticShopQuery", () => {
  it("SKU가 있으면 브랜드 없이 SKU만 단독으로 검색어로 쓴다", () => {
    const dna = buildProductIdentityDna(baseProduct({ sku: field("B126AC050") }));
    expect(buildDomesticShopQuery(dna)).toBe("B126AC050");
  });

  it("SKU 없이 modelName만 있으면 브랜드+모델명을 검색어로 쓴다", () => {
    const dna = buildProductIdentityDna(baseProduct({ modelName: field("B126AC050") }));
    expect(buildDomesticShopQuery(dna)).toBe("Bobo Choses B126AC050");
  });

  it("식별자가 전혀 없으면 브랜드+핵심 상품명 토큰으로 검색어를 만든다", () => {
    const dna = buildProductIdentityDna(
      baseProduct({ title: field("Bobo Choses Denim Pants Blue 8Y SS26"), color: field("Blue") }),
    );
    expect(buildDomesticShopQuery(dna)).toBe("Bobo Choses denim pants");
  });

  it("브랜드도 identifier도 없으면 원본 title로 폴백한다(지어내지 않는다)", () => {
    const dna = buildProductIdentityDna(baseProduct({ brand: field(""), title: field("") }));
    expect(buildDomesticShopQuery(dna)).toBe("");
  });
});

/**
 * MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 검색어를 하나만 만들면 "그 말로 못
 * 찾았다"가 "국내에 없다"로 읽힌다. 값은 전부 실제 상품(Smallable 430701 /
 * bobochoses.com B226AC114)에서 온 것이다.
 */
describe("buildCrossSellerSearchQueries", () => {
  const smallableLike = () =>
    buildProductIdentityDna(
      baseProduct({
        sourceUrl:
          "https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701",
        title: field("Bobo Choses Zipped Sweat Organic Cotton | Heather grey"),
        brand: field("Bobo Choses"),
        sku: field("AAA1804922"),
        color: field("Heather grey"),
        material: field("100% Organic Cotton"),
      }),
    );

  it("판매처 자신의 재고번호를 단독 검색어로 쓰지 않는다", () => {
    const queries = buildCrossSellerSearchQueries(smallableLike());
    expect(queries).not.toContain("AAA1804922");
    expect(queries.some((q) => q.includes("AAA1804922"))).toBe(false);
  });

  it("좁은 말(브랜드+상품명+색상)부터 넓은 말 순서로 만든다", () => {
    const queries = smallableLike() && buildCrossSellerSearchQueries(smallableLike());
    expect(queries[0]).toBe("Bobo Choses zipped sweat Heather grey");
    expect(queries[1]).toBe("Bobo Choses zipped sweat");
    // 마지막 그물도 "브랜드 + 명사 하나"보다는 좁다 — 소재가 함께 들어간다.
    expect(queries[queries.length - 1]).toBe("Bobo Choses organic cotton zipped");
    expect(new Set(queries).size).toBe(queries.length);
  });

  it("브랜드 품번이 원문에 있으면 그것을 1순위 단독 검색어로 쓴다", () => {
    const dna = buildProductIdentityDna(
      baseProduct({
        sourceUrl: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
        title: field("Bobo Choses Bolder half zipped sweatshirt"),
        description: field("Light heather grey sweatshirt. Product code B226AC114 AW26 Made in Portugal."),
      }),
    );
    expect(dna.brandModelCode).toBe("B226AC114");
    expect(buildCrossSellerSearchQueries(dna)[0]).toBe("B226AC114");
  });
});
