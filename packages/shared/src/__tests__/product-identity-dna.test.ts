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

  /**
   * 🔴🔴 **위 단언 혼자서는 「SKU 우선」을 증명하지 못했다**(음성 대조 M3 가 잡았다) —
   *    `baseProduct` 의 slug 품번이 **`B126AC050` 으로 같아서** SKU 분기를 지워도
   *    `brandModelCode` 가 같은 답을 냈다(**동어반복**). 🟢 그래서 둘을 **다르게** 둔다.
   *
   * 🟡 **CPO 판정 사안 1건(CTO 가 바꾸지 않았다)** — 여기서 이기는 `sku` 는
   *    `AAA1804922`(Smallable **판매처 재고번호** · 실측 예)이고 `brandModelCode` 는
   *    `B126AC050`(**브랜드 품번**)이다. 🔴 국내 샵 검색에서 재고번호는 거의 무의미한데
   *    기존 정책이 **SKU 를 1순위** 로 고정하고 있다(이 함수 주석 · `resolveIdentifier`).
   *    🔴 `resolveBrandModelCode` 의 주석은 스스로 「브랜드 품번은 sku 필드에서
   *    가져오지 않는다 — Smallable 재고번호와 모양이 같아 못 가른다」고 적어 뒀다.
   *    ⟹ 🔴 **순서를 바꾸는 것은 기존 정책 변경이라 CTO 가 하지 않았다.**
   */
  it("🔴 SKU 와 품번이 «다를» 때도 SKU 가 이긴다(기존 정책 유지 · 잠금)", () => {
    const dna = buildProductIdentityDna(baseProduct({ sku: field("AAA1804922") }));
    expect(dna.brandModelCode).toBe("B126AC050");
    expect(buildDomesticShopQuery(dna)).toBe("AAA1804922");
  });

  /**
   * ════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 **IPES-D §3 — 이 블록의 세 단언이 «의도적으로» 갱신됐다**(2026-11-06)
   * ════════════════════════════════════════════════════════════════════════
   *
   * 🔴 세 단언이 전부 FAIL 했고 **원인은 하나** 였다 — `baseProduct` 의
   *    `sourceUrl = "https://bobochoses.com/products/**b126ac050**"` 라
   *    `brandModelCode` 가 **slug 에서 항상 나온다**. 즉 세 fixture 는 전부
   *    「품번이 있는 상품」이었는데 단언은 **품번보다 영문 제목을 앞세우고** 있었다.
   *
   * 🔴🔴 **그 순서는 `buildDomesticShopQuery` 자기 주석과 충돌한다** —
   *    주석: 「SKU/**Style Code** 단독 → 브랜드+모델명 → 브랜드+핵심 상품명」.
   *    ⟹ 구현이 주석의 **Style Code 단계를 빠뜨리고** 있었고 단언이 그 누락을 고정했다.
   *
   * 🔴 **왜 품번이 영문 제목보다 앞인가**(국내 축 한정 근거):
   *    국내 샵 상품명은 한국어라 영문 제목과 **토큰이 겹치지 않는다**.
   *    품번은 언어 중립이라 그 벽을 넘는다(`littleluna.co.kr` 제목에
   *    `AW26MS185` 가 그대로 있다 · ROOTCAUSE-FIX-01 실측).
   *
   * 🟢 **그래서 「지어내지 않는다」 속성은 아래에서 «더 강하게» 지킨다** —
   *    품번이 **어디에도 없을 때** 는 폴백이 그대로임을 단언한다(URL 까지 비운다).
   */
  it("🟢 SKU 가 없고 품번(Style Code)이 있으면 **품번 단독** 으로 검색한다", () => {
    const dna = buildProductIdentityDna(baseProduct({ modelName: field("B126AC050") }));
    /** 🔴 전엔 `"Bobo Choses B126AC050"` 였다 — 브랜드 접두를 **붙이지 않는다**. */
    expect(buildDomesticShopQuery(dna)).toBe("B126AC050");
  });

  it("🟢 식별자가 없어도 품번이 있으면 핵심 상품명보다 **품번이 이긴다**", () => {
    const dna = buildProductIdentityDna(
      baseProduct({ title: field("Bobo Choses Denim Pants Blue 8Y SS26"), color: field("Blue") }),
    );
    /** 🔴 전엔 `"Bobo Choses denim pants"` 였다(영문 제목 축). */
    expect(buildDomesticShopQuery(dna)).toBe("B126AC050");
  });

  it("🔴 품번이 «어디에도» 없으면 폴백은 그대로다 — 지어내지 않는다", () => {
    const dna = buildProductIdentityDna(
      /** 🔴 slug 까지 비운다 — 안 비우면 그 품번이 들어와 폴백 축을 못 본다. */
      baseProduct({ brand: field(""), title: field(""), sourceUrl: "https://bobochoses.com/products/denim" }),
    );
    expect(dna.brandModelCode).toBeNull();
    expect(buildDomesticShopQuery(dna)).toBe("");
  });

  it("🟢 품번이 없을 때의 기존 세 폴백 단계가 **그대로 살아 있다**", () => {
    const noCode = (o: Partial<CanonicalProduct> = {}) =>
      buildProductIdentityDna(baseProduct({ sourceUrl: "https://bobochoses.com/products/denim", ...o }));
    /** ⒜ 브랜드 + 핵심 상품명 */
    expect(
      buildDomesticShopQuery(noCode({ title: field("Bobo Choses Denim Pants Blue 8Y SS26"), color: field("Blue") })),
    ).toBe("Bobo Choses denim pants");
    /** ⒝ 브랜드 + 모델명(모델명이 «이름» 일 때는 전과 같다) */
    expect(buildDomesticShopQuery(noCode({ modelName: field("Bolder Sweatshirt") }))).toBe(
      "Bobo Choses Bolder Sweatshirt",
    );
    /** ⒞ 브랜드 단독 */
    expect(buildDomesticShopQuery(noCode({ title: field("") }))).toBe("Bobo Choses");
  });

  /**
   * 🔴🔴 **음성 대조 — 「설명문에서 읽은 품번」이 국내 쿼리에 실제로 닿는지** 를
   *    이 단언 하나가 잡는다. `description` 의 라벨만 있고 제목·slug·sku·modelName
   *    에는 품번이 **없는** 상품이다 ⟹ 설명문 축을 끊으면 이 단언이 FAIL 한다.
   */
  it("🟢🟢 **상세설명 라벨에서만** 읽은 품번도 국내 쿼리가 된다", () => {
    const dna = buildProductIdentityDna(
      baseProduct({
        sourceUrl: "https://www.junioredition.com/products/hug-hairy-monster-tee",
        title: field("Hug Hairy Monster T-shirt"),
        description: field("Light blue t-shirt. Product code B226AC009 AW26 Made in Portugal."),
      }),
    );
    expect(dna.brandModelCode).toBe("B226AC009");
    expect(buildDomesticShopQuery(dna)).toBe("B226AC009");
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════
 * 🔵🔵 **IPES-D §2 — 칸이 «없는» 스냅샷에서 DNA 가 터지던 자리**(2026-11-06)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 스냅샷 619건 중 `modelName` 키가 **아예 없는 것 44건** 이었고
 *    `product.modelName.value` 가 TypeError 로 던져 **후보 발견이 0** 이었다.
 * 🟢 실측 — 수정 뒤 DNA 생성 성공 **575 → 619**(실패 44 → **0**).
 */
describe("IPES-D §2 — 선택 칸이 없어도 DNA 가 만들어진다", () => {
  it("🟢 `modelName` 칸이 없어도 던지지 않는다", () => {
    const { modelName: _omitted, ...withoutModelName } = baseProduct();
    const dna = buildProductIdentityDna(withoutModelName as CanonicalProduct);
    /** 🔴 없는 값을 지어내지 않는다 — 그 tier 를 **건너뛸** 뿐이다. */
    expect(dna.identifier).toBeNull();
    expect(dna.brandModelCode).toBe("B126AC050");
  });

  it("🟢 `sku` 칸이 없어도 던지지 않는다", () => {
    const { sku: _omitted, ...withoutSku } = baseProduct({ modelName: field("Bolder Sweatshirt") });
    const dna = buildProductIdentityDna(withoutSku as CanonicalProduct);
    expect(dna.identifier).toEqual({ value: "Bolder Sweatshirt", tier: "MODEL_NAME" });
  });

  it("🔴 값이 «있을 때» 의 tier 순서는 한 글자도 바뀌지 않았다", () => {
    const dna = buildProductIdentityDna(baseProduct({ sku: field("AAA123"), modelName: field("Bolder") }));
    expect(dna.identifier).toEqual({ value: "AAA123", tier: "SKU" });
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
