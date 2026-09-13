import { describe, expect, it } from "vitest";
import {
  buildCrossSellerSearchQueries,
  buildDomesticShopQuery,
  buildProductIdentityDna,
  productTypeTokenOf,
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

  it("1차 질의는 브랜드+핵심명+유형+색상이고, 소재는 그 자리에 없다", () => {
    /**
     * MI-MATCHING-INTEGRATION-2(CEO/CPO 지시, 2026-09-13):
     *
     *   1차 질의   브랜드 + 상품 핵심명 + 상품 유형 + 색상
     *   보조 신호  소재 · 모델 단서
     *
     * 예전 판의 마지막 그물은 "Bobo Choses organic cotton zipped"였다 —
     * "organic cotton"은 상품명이 아니라 **소재**인데 핵심명 자리에 들어가
     * 있었다. 같은 말을 두 축에서 두 번 세면, 그 말이 판매처마다 다르게 적혀
     * 있을 때 두 칸이 한꺼번에 무너진다.
     */
    const queries = buildCrossSellerSearchQueries(smallableLike());
    // 이 픽스처에는 카테고리 신호가 없어 유형 칸이 비어 있다(지어내지 않는다).
    expect(queries[0]).toBe("Bobo Choses zipped sweat Heather grey");
    expect(queries[1]).toBe("Bobo Choses zipped sweat");
    // 소재는 지워진 것이 아니라 **내려갔다** — 1차 계열이 전부 0건일 때의 그물.
    expect(queries[queries.length - 1]).toBe("Bobo Choses zipped sweat organic cotton");
    expect(queries[0]).not.toContain("cotton");
    expect(new Set(queries).size).toBe(queries.length);
  });

  /**
   * 실측(2026-09-13, bobochoses.com /search/suggest.json 직접 호출):
   *
   *   Bobo Choses zipped sweat organic cotton Heather grey   B226AC114 #3
   *   Bobo Choses zipped sweat Sweatshirts Heather grey      B226AC114 #1
   *
   * 상품 유형 한 단어가 목표 상품을 3위에서 1위로 올린다. 순위가 중요한 이유는
   * 예뻐서가 아니라 **상위 몇 건만 상세 조회되기 때문**이다(bobochoses-kr.ts의
   * MAX_DETAIL_LOOKUPS=3) — 3위는 그 경계 바로 위였다.
   */
  it("상품 유형을 쓴다 — 관측된 분류의 마지막 조각을 읽을 뿐이다", () => {
    const dna = buildProductIdentityDna(
      baseProduct({
        sourceUrl:
          "https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701",
        title: field("Bobo Choses Zipped Sweat Organic Cotton | Heather grey"),
        brand: field("Bobo Choses"),
        sku: field("AAA1804922"),
        color: field("Heather grey"),
        material: field("100% Organic Cotton"),
        breadcrumbPath: ["Home", "Fashion Children", "Boy", "Sweatshirts"],
      }),
    );
    const queries = buildCrossSellerSearchQueries(dna);
    expect(queries[0]).toBe("Bobo Choses zipped sweat Sweatshirts Heather grey");
    // 경로 전체("Home > Fashion Children > …")가 검색어로 나가지 않는다 —
    // 그러면 상품과 무관한 말이 질의의 대부분이 된다.
    expect(queries.every((q) => !q.includes("Fashion Children"))).toBe(true);
    // 색상을 뗀 칸이 남는다 — 좁은 말이 0건이면 내려갈 자리가 있어야 한다.
    expect(queries).toContain("Bobo Choses zipped sweat Sweatshirts");
  });

  /**
   * CPO 지시(2026-09-13) — **실측을 규칙으로 굳히지 않는다.**
   *
   * "organic cotton을 빼고 sweatshirts를 붙인다"는 이 상품 하나의 답이다. 다른
   * 상품에는 dress · sneakers · bag이 와야 하고, 그 말들의 목록을 코드에 심는
   * 순간 목록에 없는 상품은 전부 유형을 잃는다. 유형은 브랜드·색상과 똑같이
   * **관측된 값에서 구조로** 나온다.
   */
  it("유형 어휘를 코드가 알고 있지 않다 — 다른 상품군도 같은 규칙으로 나온다", () => {
    const dress = buildProductIdentityDna(
      baseProduct({
        sourceUrl: "https://www.smallable.com/en/product/x-999001",
        title: field("Konges Slojd Ruffle Dress"),
        brand: field("Konges Slojd"),
        color: field("Lemon"),
        breadcrumbPath: ["Home", "Fashion Children", "Girl", "Dresses & Skirts"],
      }),
    );
    // 유형은 마지막 조각에서 나오고, 한 칸에 둘이 적혀 있으면 앞의 것을 읽는다.
    expect(productTypeTokenOf(dress)).toBe("Dresses");
    expect(buildCrossSellerSearchQueries(dress)[0]).toBe("Konges Slojd ruffle dress Dresses Lemon");

    const sneakers = buildProductIdentityDna(
      baseProduct({
        sourceUrl: "https://www.smallable.com/en/product/y-999002",
        title: field("Veja Esplar Sneakers"),
        brand: field("Veja"),
        breadcrumbPath: ["Home", "Shoes", "Sneakers"],
      }),
    );
    expect(productTypeTokenOf(sneakers)).toBe("Sneakers");

    // 분류 신호가 없으면 유형을 지어내지 않는다 — 빈 값이고, 질의는 그만큼 넓어진다.
    expect(productTypeTokenOf(smallableLike())).toBe("");
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
