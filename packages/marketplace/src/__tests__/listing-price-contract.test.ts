import { describe, expect, it } from "vitest";
import { resolveListingPrice } from "@commerce/pricing";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "../registry";

/**
 * P-4-H1-2-2 R5-R8(대표님 지시, 2026-08-28) — "쿠팡/스마트스토어/옵션/미리보기/UI가
 * 전부 같은 가격을 보도록" 어댑터가 실제로 공유 resolveListingPrice()를 쓰는지,
 * 그리고 실제 확인된 버그(Voyage Dress, ₩153,120)가 재발하지 않는지 고정한다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeMockProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 88, currency: "GBP" }),
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
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    ...overrides,
  };
}

describe("P-4-H1-2-2 R5-R6: 쿠팡/스마트스토어 어댑터가 resolveListingPrice()와 동일한 값을 낸다", () => {
  it("R5: 쿠팡 어댑터 — override 없을 때 listing.priceKrw/priceSource가 resolveListingPrice() 직접 호출 결과와 정확히 같다", () => {
    const product = makeMockProduct();
    const listing = PLATFORM_ADAPTERS.coupang.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "coupang");
    const direct = resolveListingPrice({
      priceOverrideKrw: product.priceOverrideKrw?.value,
      originalAmount: product.price.value.amount,
      originalCurrency: product.price.value.currency,
      priceBreakdown: product.priceBreakdown,
      priceValidity: product.priceValidity,
    });
    expect(listing.priceKrw).toBe(direct.priceKrw);
    expect(listing.priceSource).toBe(direct.source);
    expect(listing.priceSource).toBe("SYSTEM_SUGGESTED");
  });

  /**
   * PHASE 3.2(CPO 확정, 2026-09-11) — 옛 단언("스마트스토어 priceKrw == 쿠팡
   * priceKrw")은 이제 계약이 아니다. 채널별 최종 등록가격이 생겼으니 같은 제품에
   * 채널마다 **다른 금액**이 나오는 것은 버그가 아니라 기능이다.
   *
   * 살아남는 불변식은 두 가지다:
   *   (1) 같은 제품 · 같은 채널 입력 → 언제나 같은 결과(결정적 계산)
   *   (2) 두 어댑터가 여전히 **하나의 계산 함수**를 공유한다 —
   *       채널 값이 없을 때 priceSource가 두 어댑터에서 동일하다는 것이 그 증거다.
   * 옛 단언이 실제로 지키려던 것(어댑터가 각자 가격을 계산하지 않는다)은
   * (2)가 그대로 이어받는다.
   */
  it("R6: 채널 최종가가 없으면 두 어댑터가 같은 결과를 내고, 같은 입력은 항상 같은 결과를 낸다(하나의 계산 함수를 공유한다)", () => {
    const product = makeMockProduct();
    const coupangListing = PLATFORM_ADAPTERS.coupang.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "coupang");
    const smartstoreListing = PLATFORM_ADAPTERS.smartstore.toListingModel(
      product,
      UNRESOLVED_CATEGORY,
      undefined,
      "smartstore",
    );
    // (2) priceSource는 두 어댑터가 동일하다 — 같은 판정 함수를 통과했다는 뜻이다.
    expect(smartstoreListing.priceSource).toBe(coupangListing.priceSource);
    expect(smartstoreListing.priceOrigin).toBe(coupangListing.priceOrigin);
    // 채널 최종가가 없는 이 입력에서는 금액도 같다(상품정보 가격 하나를 함께 본다).
    expect(smartstoreListing.priceKrw).toBe(coupangListing.priceKrw);
    // (1) 같은 제품·같은 채널을 다시 넣으면 같은 결과가 나온다.
    const again = PLATFORM_ADAPTERS.coupang.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "coupang");
    expect(again.priceKrw).toBe(coupangListing.priceKrw);
    expect(again.priceSource).toBe(coupangListing.priceSource);
  });

  it("R6-부가: priceOverrideKrw가 있으면 두 어댑터 모두 SELLER_OVERRIDE로 그 값을 그대로 쓴다", () => {
    const product = makeMockProduct({ priceOverrideKrw: field(180000, "USER_EDITED") });
    const coupangListing = PLATFORM_ADAPTERS.coupang.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "coupang");
    const smartstoreListing = PLATFORM_ADAPTERS.smartstore.toListingModel(
      product,
      UNRESOLVED_CATEGORY,
      undefined,
      "smartstore",
    );
    expect(coupangListing.priceKrw).toBe(180000);
    expect(coupangListing.priceSource).toBe("SELLER_OVERRIDE");
    expect(smartstoreListing.priceKrw).toBe(180000);
    expect(smartstoreListing.priceSource).toBe("SELLER_OVERRIDE");
  });
});

describe("P-4-H1-2-2 R7: UNRESOLVED는 등록 게이트를 ERROR로 막는다(override 없음 자체는 막지 않는다)", () => {
  it("R7: priceValidity가 VALID가 아니면(원본가 자체를 못 읽음) price 필드 validation이 ERROR — SYSTEM_SUGGESTED는 통과한다", () => {
    const unresolvedProduct = makeMockProduct({ priceValidity: "INVALID" });
    const unresolvedListing = PLATFORM_ADAPTERS.coupang.toListingModel(
      unresolvedProduct,
      UNRESOLVED_CATEGORY,
      undefined,
      "coupang",
    );
    expect(unresolvedListing.priceSource).toBe("UNRESOLVED");
    const priceValidation = unresolvedListing.validations.find((v) => v.field === "price");
    expect(priceValidation?.status).toBe("ERROR");

    const suggestedProduct = makeMockProduct(); // priceValidity: VALID, override 없음.
    const suggestedListing = PLATFORM_ADAPTERS.coupang.toListingModel(
      suggestedProduct,
      UNRESOLVED_CATEGORY,
      undefined,
      "coupang",
    );
    expect(suggestedListing.priceSource).toBe("SYSTEM_SUGGESTED");
    const suggestedPriceValidation = suggestedListing.validations.find((v) => v.field === "price");
    expect(suggestedPriceValidation?.status).not.toBe("ERROR");
  });
});

describe("P-4-H1-2-2 R8: Voyage Dress 버그 재현 방지 — 실제 확인된 잘못된 등록가(₩153,120)가 다시 나오지 않는다", () => {
  it("R8: 88 GBP, priceBreakdown={shippingKrw:12000,feePercent:10,marginPercent:12}, override 없음 → ₩211,690(마진 반영), ₩153,120(마진 0% 원본환산)이 아니다", () => {
    // 실제 프로덕션에서 확인된 버그 사례 그대로(2026-08-20 실등록, snapshot
    // 28cf88cf-2b47-4716-8a08-9f47106829ee) — 이 값 그대로 재구성.
    const voyageDressProduct = makeMockProduct({
      title: field("Voyage Dress in Bright Sky Blossom Plaid by Misha & Puff"),
      price: field({ amount: 88, currency: "GBP" }),
      priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
    });
    const coupangListing = PLATFORM_ADAPTERS.coupang.toListingModel(
      voyageDressProduct,
      UNRESOLVED_CATEGORY,
      undefined,
      "coupang",
    );
    const smartstoreListing = PLATFORM_ADAPTERS.smartstore.toListingModel(
      voyageDressProduct,
      UNRESOLVED_CATEGORY,
      undefined,
      "smartstore",
    );

    for (const listing of [coupangListing, smartstoreListing]) {
      expect(listing.priceKrw).not.toBe(153120);
      expect(listing.priceKrw).toBe(211690);
      expect(listing.priceSource).toBe("SYSTEM_SUGGESTED");
    }
  });
});
