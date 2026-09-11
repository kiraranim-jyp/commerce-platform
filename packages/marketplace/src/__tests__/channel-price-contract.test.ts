import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { backfillCanonicalProduct } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { applyChannelPriceOverride, clearChannelPriceOverride } from "../channel-price";
import { PLATFORM_ADAPTERS } from "../registry";

/**
 * PHASE 3.2(CPO 확정, 2026-09-11) — 채널별 최종 등록가격의 계약.
 *
 * 지키려는 사실은 하나다: **채널 가격을 고쳐도 상품의 기준가는 움직이지 않는다.**
 * 상품정보로 돌아갔을 때 셀러가 정한 적 없는 숫자가 보이는 순간 두 개념(상품의
 * 최종 판매가격 / 채널의 최종 등록가격)이 하나로 뭉개진 것이고, 그러면 채널
 * 하나를 손볼 때마다 나머지 전 채널의 등록가가 따라 바뀐다.
 *
 * payload/쿠팡 가격검증 쪽 계약(6·7번)은 packages/listing의
 * channel-price-payload-contract.test.ts에 있다 — 그쪽이 buildCoupangPayload를
 * 실제로 부르는 패키지라서 거기 둔다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 상품정보에서 셀러가 최종 판매가격 ₩143,500을 확정한 상태 — 작업지시서의 예시 그대로. */
const PRODUCT_FINAL_KRW = 143500;

function makeMockProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 88, currency: "GBP" }),
    priceValidity: "VALID",
    sku: field("TEST-SKU-1"),
    description: field("A test product for channel price contract tests."),
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

/** 실제 등록 경로와 같은 호출 — 어댑터 → resolveChannelListingPrice → priceKrw. */
function priceOf(product: CanonicalProduct, platform: "smartstore" | "coupang") {
  return PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform);
}

describe("PHASE 3.2 ①: 채널 최종가가 없으면 모든 채널이 상품정보 최종 판매가격을 쓴다", () => {
  it("①: override 없음 → 스마트스토어·쿠팡 모두 ₩143,500(상품정보 가격), 출처는 PRODUCT_OVERRIDE", () => {
    const product = makeMockProduct();
    for (const platform of ["smartstore", "coupang"] as const) {
      const listing = priceOf(product, platform);
      expect(listing.priceKrw).toBe(PRODUCT_FINAL_KRW);
      expect(listing.priceOrigin).toBe("PRODUCT_OVERRIDE");
    }
  });

  it("①-부가: 상품정보 최종가도 없으면 권장 판매가격으로 내려간다(PRODUCT_SUGGESTED) — 두 채널 모두 동일", () => {
    const product = makeMockProduct({ priceOverrideKrw: undefined });
    const smartstore = priceOf(product, "smartstore");
    const coupang = priceOf(product, "coupang");
    expect(smartstore.priceOrigin).toBe("PRODUCT_SUGGESTED");
    expect(coupang.priceOrigin).toBe("PRODUCT_SUGGESTED");
    expect(smartstore.priceKrw).toBe(coupang.priceKrw);
    // 권장가는 마진 역산 결과 — 상품정보 최종가와 같은 값이 아니다(같았다면
    // 이 테스트가 "그냥 143,500이 어디서든 나온다"를 확인하는 셈이 된다).
    expect(smartstore.priceKrw).not.toBe(PRODUCT_FINAL_KRW);
  });
});

describe("PHASE 3.2 ②③④: 채널 최종가는 그 채널 하나에만 적용된다", () => {
  it("②: 스마트스토어에만 ₩139,000 → 스마트스토어만 바뀌고 쿠팡은 상품정보 가격 그대로", () => {
    const product = applyChannelPriceOverride(makeMockProduct(), "smartstore", 139000);
    const smartstore = priceOf(product, "smartstore");
    const coupang = priceOf(product, "coupang");

    expect(smartstore.priceKrw).toBe(139000);
    expect(smartstore.priceOrigin).toBe("CHANNEL_OVERRIDE");
    expect(coupang.priceKrw).toBe(PRODUCT_FINAL_KRW);
    expect(coupang.priceOrigin).toBe("PRODUCT_OVERRIDE");
  });

  it("③: 쿠팡에만 ₩145,000 → 쿠팡만 바뀌고 스마트스토어는 상품정보 가격 그대로", () => {
    const product = applyChannelPriceOverride(makeMockProduct(), "coupang", 145000);
    expect(priceOf(product, "coupang").priceKrw).toBe(145000);
    expect(priceOf(product, "coupang").priceOrigin).toBe("CHANNEL_OVERRIDE");
    expect(priceOf(product, "smartstore").priceKrw).toBe(PRODUCT_FINAL_KRW);
    expect(priceOf(product, "smartstore").priceOrigin).toBe("PRODUCT_OVERRIDE");
  });

  it("④: 양쪽 모두 지정 → 서로 간섭하지 않는다(₩139,000 / ₩145,000)", () => {
    const product = applyChannelPriceOverride(
      applyChannelPriceOverride(makeMockProduct(), "smartstore", 139000),
      "coupang",
      145000,
    );
    expect(priceOf(product, "smartstore").priceKrw).toBe(139000);
    expect(priceOf(product, "coupang").priceKrw).toBe(145000);
  });

  it("UX 불변식: 채널 가격을 고쳐도 상품정보의 최종 판매가격(priceOverrideKrw)은 한 글자도 바뀌지 않는다", () => {
    const base = makeMockProduct();
    const edited = applyChannelPriceOverride(
      applyChannelPriceOverride(base, "smartstore", 139000),
      "coupang",
      145000,
    );
    expect(edited.priceOverrideKrw).toEqual(base.priceOverrideKrw);
    expect(edited.priceOverrideKrw?.value).toBe(PRODUCT_FINAL_KRW);
    // 가격 계산 입력(원본가/배송비·수수료·마진/유효성)도 그대로다 —
    // 이것들이 바뀌면 상품정보 화면의 "권장 판매가격"까지 따라 움직인다.
    expect(edited.price).toEqual(base.price);
    expect(edited.priceBreakdown).toEqual(base.priceBreakdown);
    expect(edited.priceValidity).toBe(base.priceValidity);
  });
});

describe("PHASE 3.2 ⑤: 채널 최종가를 지우면 상품정보 가격으로 복귀한다", () => {
  it("⑤: 스마트스토어 ₩139,000 지정 후 삭제 → 다시 ₩143,500 · PRODUCT_OVERRIDE", () => {
    const overridden = applyChannelPriceOverride(makeMockProduct(), "smartstore", 139000);
    expect(priceOf(overridden, "smartstore").priceKrw).toBe(139000);

    const cleared = clearChannelPriceOverride(overridden, "smartstore");
    const listing = priceOf(cleared, "smartstore");
    expect(listing.priceKrw).toBe(PRODUCT_FINAL_KRW);
    expect(listing.priceOrigin).toBe("PRODUCT_OVERRIDE");
    // 0원으로 남기지 않는다 — 키 자체가 사라져야 "지정 안 함"이다.
    expect(cleared.channelPriceOverrides?.smartstore).toBeUndefined();
  });

  it("⑤-부가: 한 채널을 지워도 다른 채널의 최종가는 남는다", () => {
    const both = applyChannelPriceOverride(
      applyChannelPriceOverride(makeMockProduct(), "smartstore", 139000),
      "coupang",
      145000,
    );
    const cleared = clearChannelPriceOverride(both, "smartstore");
    expect(priceOf(cleared, "smartstore").priceKrw).toBe(PRODUCT_FINAL_KRW);
    expect(priceOf(cleared, "coupang").priceKrw).toBe(145000);
  });
});

describe("PHASE 3.2 ⑨: 이 필드를 모르는 기존 상품도 그대로 동작한다", () => {
  it("⑨: channelPriceOverrides 키가 아예 없는 과거 스냅샷 → override 없음으로 해석되고 상품정보 가격이 나온다", () => {
    // 과거 스냅샷 재현: 키 자체를 지운다(undefined로 두는 것과 구분해서,
    // JSON에서 되살아난 객체처럼 delete로 없앤다).
    const legacy = makeMockProduct();
    delete (legacy as { channelPriceOverrides?: unknown }).channelPriceOverrides;
    expect("channelPriceOverrides" in legacy).toBe(false);

    for (const platform of ["smartstore", "coupang"] as const) {
      const listing = priceOf(legacy, platform);
      expect(listing.priceKrw).toBe(PRODUCT_FINAL_KRW);
      expect(listing.priceOrigin).toBe("PRODUCT_OVERRIDE");
    }
  });

  it("⑨-부가: backfillCanonicalProduct()가 과거 스냅샷에 빈 객체를 채워 넣는다(값을 지어내지 않는다)", () => {
    const legacy = makeMockProduct();
    delete (legacy as { channelPriceOverrides?: unknown }).channelPriceOverrides;
    const restored = backfillCanonicalProduct(legacy);
    expect(restored.channelPriceOverrides).toEqual({});
    expect(priceOf(restored, "coupang").priceKrw).toBe(PRODUCT_FINAL_KRW);
    // 복원 과정에서 상품정보 최종가가 훼손되지 않는다.
    expect(restored.priceOverrideKrw?.value).toBe(PRODUCT_FINAL_KRW);
  });
});
