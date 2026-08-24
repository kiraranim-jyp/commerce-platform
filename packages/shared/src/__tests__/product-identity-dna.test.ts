import { describe, expect, it } from "vitest";
import { buildProductIdentityDna } from "../product-identity-dna";
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
