import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { applyChannelPriceOverride, PLATFORM_ADAPTERS } from "@commerce/marketplace";
import type { CanonicalProduct, FieldSource, PlatformId, ProvenanceField } from "@commerce/shared";
import { BLANK_COUPANG_SELLER_CONFIG, buildCoupangPayload, validateCoupangPricing } from "../coupang/build-payload";
import { buildNaverProductPayload } from "../naver/build-payload";

/**
 * PHASE 3.2(CPO 확정, 2026-09-11) ⑥⑦ — "화면에서 정한 채널 최종 등록가격이
 * 실제로 등록 요청에 실려 나가는가", 그리고 "그 값에도 기존 가격 검증이 그대로
 * 적용되는가".
 *
 * 이 테스트가 필요한 이유: 채널 최종가를 어댑터 진입점(resolveChannelListingPrice)
 * 한 곳에만 넣고 payload 빌더는 한 줄도 건드리지 않았다 — 빌더는 예나 지금이나
 * listing.priceKrw를 읽을 뿐이다. 그 "건드리지 않았다"가 실제로 성립하는지는
 * 빌더 출력으로만 증명할 수 있다. 만약 어느 날 빌더가 priceOverrideKrw를 다시
 * 직접 읽기 시작하면 채널 최종가가 조용히 무시되고 이 테스트가 그때 깨진다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

const PRODUCT_FINAL_KRW = 143500;

function makeMockProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 88, currency: "GBP" }),
    priceValidity: "VALID",
    sku: field("TEST-SKU-1"),
    description: field("A test product for channel price payload tests."),
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
    priceOverrideKrw: field(PRODUCT_FINAL_KRW, "USER_EDITED"),
    ...overrides,
  };
}

function listingFor(product: CanonicalProduct, platform: PlatformId) {
  return PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform);
}

// 네이버 payload 빌더가 요구하는 판매자별 값들 — 전부 테스트용 placeholder다
// (이 테스트가 확인하는 건 salePrice 한 필드뿐이라 나머지는 고정값이면 충분하다).
const NAVER_FIXTURE = {
  leafCategoryId: "50000535",
  releaseAddressBookNo: 900000001,
  refundAddressBookNo: 900000002,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 5000,
  childCertificationInfoId: null,
  categoryRequiresChildCertification: false,
  originAreaCode: "00",
  originAreaRequiresContent: false,
} as const;

describe("PHASE 3.2 ⑥: 실제 payload의 salePrice가 최종 resolved price와 정확히 같다", () => {
  it("⑥-쿠팡: 쿠팡에만 ₩145,000을 지정하면 CoupangPayload.items[].salePrice가 ₩145,000이다(상품정보 ₩143,500이 아니다)", () => {
    const product = applyChannelPriceOverride(makeMockProduct(), "coupang", 145000);
    const listing = listingFor(product, "coupang");
    const payload = buildCoupangPayload(product, listing);

    expect(listing.priceKrw).toBe(145000);
    for (const item of payload.items) {
      expect(item.salePrice).toBe(listing.priceKrw);
      expect(item.salePrice).not.toBe(PRODUCT_FINAL_KRW);
    }
  });

  it("⑥-스마트스토어: 스마트스토어에만 ₩139,000을 지정하면 originProduct.salePrice가 ₩139,000이다", () => {
    const product = applyChannelPriceOverride(makeMockProduct(), "smartstore", 139000);
    const listing = listingFor(product, "smartstore");
    const payload = buildNaverProductPayload({ product, listing, ...NAVER_FIXTURE });

    expect(listing.priceKrw).toBe(139000);
    expect(payload.originProduct.salePrice).toBe(listing.priceKrw);
  });

  it("⑥-독립성: 한쪽 채널만 지정하면 다른 채널의 payload는 상품정보 가격 그대로다", () => {
    const product = applyChannelPriceOverride(makeMockProduct(), "coupang", 145000);
    const naverPayload = buildNaverProductPayload({
      product,
      listing: listingFor(product, "smartstore"),
      ...NAVER_FIXTURE,
    });
    expect(naverPayload.originProduct.salePrice).toBe(PRODUCT_FINAL_KRW);
  });

  it("⑥-채널값 없음: 아무 채널도 지정하지 않으면 두 payload 모두 상품정보 최종 판매가격을 싣는다", () => {
    const product = makeMockProduct();
    const coupangPayload = buildCoupangPayload(product, listingFor(product, "coupang"));
    const naverPayload = buildNaverProductPayload({
      product,
      listing: listingFor(product, "smartstore"),
      ...NAVER_FIXTURE,
    });
    expect(coupangPayload.items[0].salePrice).toBe(PRODUCT_FINAL_KRW);
    expect(naverPayload.originProduct.salePrice).toBe(PRODUCT_FINAL_KRW);
  });
});

describe("PHASE 3.2 ⑦: 쿠팡 가격 validation(10원 단위 · 반품배송비)이 채널 최종가에도 그대로 적용된다", () => {
  it("⑦-10원 단위: 채널 최종가가 ₩145,003이면 10원 단위 위반으로 잡힌다(상품정보 가격이 정상이어도 통과시키지 않는다)", () => {
    const product = applyChannelPriceOverride(makeMockProduct(), "coupang", 145003);
    const payload = buildCoupangPayload(product, listingFor(product, "coupang"));
    const issues = validateCoupangPricing(payload, product);

    expect(issues.some((i) => i.field === "salePrice" && i.message.includes("10원 단위"))).toBe(true);
  });

  it("⑦-정상값: 채널 최종가가 10원 단위면 가격 관련 이슈가 없다", () => {
    const product = applyChannelPriceOverride(makeMockProduct(), "coupang", 145000);
    const payload = buildCoupangPayload(product, listingFor(product, "coupang"));
    expect(validateCoupangPricing(payload, product)).toHaveLength(0);
  });

  it("⑦-반품배송비: 채널 최종가를 반품배송비보다 낮게 내리면 반품배송비 초과로 잡힌다", () => {
    // 상품정보 가격(₩143,500)은 반품배송비보다 한참 높다 — 채널 값을 보지
    // 않는 구현이라면 이 케이스가 조용히 통과한다.
    const product = applyChannelPriceOverride(makeMockProduct(), "coupang", 1000);
    const payload = buildCoupangPayload(product, listingFor(product, "coupang"), {
      sellerConfig: { ...BLANK_COUPANG_SELLER_CONFIG, returnDeliveryCharge: 5000 },
    });
    expect(payload.returnCharge).toBeGreaterThan(1000);
    const issues = validateCoupangPricing(payload, product);
    expect(issues.some((i) => i.field === "returnCharge")).toBe(true);
  });

  it("⑦-priceValidity 게이트: 원본가를 못 읽은 상품은 채널 최종가를 넣어도 PRICE_UNRESOLVED로 막힌다", () => {
    // 채널 최종가는 "얼마로 등록할지"만 정한다 — "이 상품의 원본 가격이
    // 실재하는지"라는 별개 판정을 우회하는 뒷문이 되어선 안 된다.
    const product = applyChannelPriceOverride(makeMockProduct({ priceValidity: "INVALID" }), "coupang", 145000);
    const payload = buildCoupangPayload(product, listingFor(product, "coupang"));
    const issues = validateCoupangPricing(payload, product);
    expect(issues.some((i) => i.code === "PRICE_UNRESOLVED")).toBe(true);
  });
});
