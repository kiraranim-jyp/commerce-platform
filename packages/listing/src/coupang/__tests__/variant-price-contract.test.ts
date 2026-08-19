import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import type { ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { buildCoupangPayload } from "../build-payload";

/**
 * Sprint A-4(CPO 지시) — buildCoupangItem()의 variant 가격 계산에는 이전에
 * 커버 테스트가 하나도 없었다(기존 notice-regression.test.ts는 옵션 없는
 * 단일 상품만 다룬다). 발견된 버그(수정됨): priceOverrideKrw가 있으면 모든
 * 옵션이 같은 salePrice로 뭉개지고(가격 차별화 소실), 없으면 반대로
 * variant 원본가를 마진 없이 그대로 환산해 썼다(사용자가 나중에 확정할
 * 마진/수수료가 반영 안 됨) — 둘 다 computeVariantFinalPriceKrw로
 * 대체됐다. 이 테스트는 그 대체가 실제로 items[]에 반영되는지 확인한다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeMockProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 44, currency: "USD" }),
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

function makeListing(product: CanonicalProduct, priceKrw: number): ListingModel {
  return {
    platform: "coupang",
    platformLabel: "쿠팡",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw,
    priceIsEstimate: false,
    options: [],
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  };
}

describe("Sprint A-4: Coupang buildCoupangItem 옵션별 최종가 — computeVariantFinalPriceKrw 적용 확인", () => {
  it("마진이 걸린 최종가(salePrice) 기준으로 옵션마다 서로 다른 최종가가 나온다(가격 차별화 유지)", () => {
    const product = makeMockProduct({
      optionGroups: [{ name: "사이즈", values: ["A", "B"] }],
      variants: [
        { id: "v1", optionValues: { 사이즈: "A" }, sku: "SKU-A", stockQuantity: 5, price: { amount: 44, currency: "USD" } },
        { id: "v2", optionValues: { 사이즈: "B" }, sku: "SKU-B", stockQuantity: 5, price: { amount: 49, currency: "USD" } },
      ],
    });
    // CPO 참조 케이스(breakdown.test.ts와 동일) — $44 → ₩105,674(마진 20%+수수료10% 반영된 최종가).
    const listing = makeListing(product, 105674);
    const payload = buildCoupangPayload(product, listing);

    expect(payload.items).toHaveLength(2);
    // 옛 버그(priceOverrideKrw 없을 때)라면 마진 없는 convertToKrw(44)로 두
    // 옵션 다 같은 값이 나왔을 것 — 지금은 옵션별로 달라야 한다.
    expect(payload.items[0].salePrice).toBe(105674);
    expect(payload.items[1].salePrice).not.toBe(payload.items[0].salePrice);
    expect(payload.items[1].salePrice).toBeGreaterThan(payload.items[0].salePrice); // B가 $5 더 비쌈 → 더 비싸야 한다(부호 검증).
  });

  it("사용자가 priceOverrideKrw로 최종가를 확정해도(listing.priceKrw만 바뀜) 옵션별 가격 차별화가 사라지지 않는다", () => {
    // 옛 버그(priceOverrideKrw 있을 때)는 모든 옵션에 같은 salePrice를 그대로
    // 복사해서 옵션 가격차가 통째로 사라졌다.
    const product = makeMockProduct({
      optionGroups: [{ name: "사이즈", values: ["A", "B"] }],
      variants: [
        { id: "v1", optionValues: { 사이즈: "A" }, sku: "SKU-A", stockQuantity: 5, price: { amount: 44, currency: "USD" } },
        { id: "v2", optionValues: { 사이즈: "B" }, sku: "SKU-B", stockQuantity: 5, price: { amount: 39, currency: "USD" } },
      ],
    });
    const manuallyConfirmedPriceKrw = 120000; // 판매자가 직접 확정한 최종가.
    const listing = makeListing(product, manuallyConfirmedPriceKrw);
    const payload = buildCoupangPayload(product, listing);

    expect(payload.items[0].salePrice).toBe(120000);
    expect(payload.items[1].salePrice).toBeLessThan(120000); // B가 $5 더 쌈.
  });

  it("옵션이 없는 상품(variants=[])은 기존과 동일하게 listing.priceKrw를 그대로 쓴다(회귀 없음)", () => {
    const product = makeMockProduct();
    const listing = makeListing(product, 105674);
    const payload = buildCoupangPayload(product, listing);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].salePrice).toBe(105674);
  });
});
