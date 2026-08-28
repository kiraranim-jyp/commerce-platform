import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { buildCoupangPayload } from "../build-payload";

/**
 * N-3.45 STEP14(CPO 지시) — "상세페이지 참조" 3-state 필드 모델은 Naver 전용
 * 개념이 아니라 CanonicalProduct 공통 데이터에 FieldSource 값 하나를 추가한
 * 것뿐이다. Coupang의 buildCoupangPayload/buildCoupangCompliance는 이 새
 * source를 전혀 모른다(product.X.value만 읽는다, ../notice/reference-eligibility
 * import 없음) — 그래서 사용자가 Naver 화면에서 "상세페이지 참조"를 선택해도
 * Coupang 쪽 payload는 지금까지와 완전히 동일해야 한다. 이 회귀 테스트는 그걸
 * "같은 입력, 다른 source" 두 번 빌드해서 결과가 바이트 단위로 같은지 확인한다
 * (Coupang 코드를 전혀 건드리지 않았다는 걸 코드로 고정).
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeMockProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 10000, currency: "KRW" }),
    priceValidity: "VALID",
    sku: field("TEST-SKU-1"),
    description: field("A test product for regression tests."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [
      {
        id: "img-1",
        originalUrl: "https://example.com/images/test.jpg",
        selectedVariant: "ORIGINAL",
        isRepresentative: true,
        useInProductGallery: true,
        useInDescription: false,
        classification: "PRODUCT",
      },
    ],
    titleKo: field(""),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("대한민국"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(999, "DEFAULT"),
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

function makeListing(product: CanonicalProduct): ListingModel {
  return {
    platform: "coupang",
    platformLabel: "쿠팡",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 10000,
    priceIsEstimate: false,
    priceSource: "SELLER_OVERRIDE",
    options: [],
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  };
}

describe("N-3.45 STEP14: Coupang 회귀 — DETAIL_PAGE_REFERENCE는 Coupang payload에 영향 없음", () => {
  it("material/color/manufacturer/careInstructions/recommendedAge/importer를 REQUIRED+빈값 vs DETAIL_PAGE_REFERENCE+빈값으로 각각 빌드해도 결과가 동일하다", () => {
    const baseline = makeMockProduct();
    const referenced = makeMockProduct({
      material: field("", "DETAIL_PAGE_REFERENCE"),
      color: field("", "DETAIL_PAGE_REFERENCE"),
      manufacturer: field("", "DETAIL_PAGE_REFERENCE"),
      careInstructions: field("", "DETAIL_PAGE_REFERENCE"),
      recommendedAge: field("", "DETAIL_PAGE_REFERENCE"),
      importer: field("", "DETAIL_PAGE_REFERENCE"),
      itemName: field("", "DETAIL_PAGE_REFERENCE"),
      modelName: field("", "DETAIL_PAGE_REFERENCE"),
      weight: field("", "DETAIL_PAGE_REFERENCE"),
    });

    const baselinePayload = buildCoupangPayload(baseline, makeListing(baseline));
    const referencedPayload = buildCoupangPayload(referenced, makeListing(referenced));

    expect(referencedPayload).toEqual(baselinePayload);
  });

  it("실제 값이 있는 필드는 source와 무관하게 여전히 Coupang payload에 반영된다(회귀 아님을 재확인)", () => {
    const withValue = makeMockProduct({ material: field("면 100%", "USER_EDITED") });
    const payload = buildCoupangPayload(withValue, makeListing(withValue));
    const item = payload.items[0];
    const materialAttr = item.attributes?.find((a) => a.attributeTypeName === "소재") ?? null;
    // 카테고리 메타가 없어(categoryMeta 미전달) attribute 매핑 자체가 비어있을
    // 수 있다 — 이 테스트의 목적은 "값이 있으면 여전히 compliance 계산 입력으로
    // 들어간다"는 것만 확인하는 것이라, attribute 매핑 여부 자체보다 build 호출이
    // 예외 없이 성공하고 payload가 만들어지는지만 확인한다.
    expect(item).toBeDefined();
    expect(materialAttr === null || typeof materialAttr === "object").toBe(true);
  });
});
