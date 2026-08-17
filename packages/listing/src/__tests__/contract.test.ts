import { describe, expect, it } from "vitest";
import { PLATFORM_ADAPTERS, PLATFORM_ORDER } from "@commerce/marketplace";
import { PLATFORM_CATEGORY_TABLES } from "@commerce/category";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { LISTING_EXECUTORS } from "../registry";

/**
 * Sprint A-0(2026-08-09) — 이 리포에 처음 도입되는 자동화 테스트. "새 플랫폼이
 * Platform SDK 계약(PlatformAdapter/ListingExecutor/카테고리 트리 registry)을
 * 지키는가"를 코드로 고정한다. Coupang 실행 로직 자체(HMAC 서명, register
 * route)는 서버 전용/환경변수 의존이라 여기서 재현하지 않는다 — 이 테스트는
 * "계약 형태"만 검증한다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeMockProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 10000, currency: "KRW" }),
    sku: field("TEST-SKU-1"),
    description: field("A test product for contract tests."),
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
  };
}

describe("Platform SDK contract", () => {
  it("PLATFORM_ORDER의 모든 플랫폼이 PLATFORM_ADAPTERS/LISTING_EXECUTORS/PLATFORM_CATEGORY_TABLES 세 registry에 전부 있다", () => {
    for (const platform of PLATFORM_ORDER) {
      expect(PLATFORM_ADAPTERS[platform], `PLATFORM_ADAPTERS.${platform}`).toBeDefined();
      expect(LISTING_EXECUTORS[platform], `LISTING_EXECUTORS.${platform}`).toBeDefined();
      expect(PLATFORM_CATEGORY_TABLES[platform], `PLATFORM_CATEGORY_TABLES.${platform}`).toBeDefined();
    }
  });

  it("각 어댑터/실행기의 platform 필드가 registry의 key와 일치한다", () => {
    for (const platform of PLATFORM_ORDER) {
      expect(PLATFORM_ADAPTERS[platform].platform).toBe(platform);
      expect(LISTING_EXECUTORS[platform].platform).toBe(platform);
    }
  });

  it("모든 어댑터는 CanonicalProduct 하나로 validations를 최소 1개 이상 채운 ListingModel을 만든다", () => {
    const product = makeMockProduct();
    for (const platform of PLATFORM_ORDER) {
      const listing = PLATFORM_ADAPTERS[platform].toListingModel(product);
      expect(listing.platform).toBe(platform);
      expect(listing.validations.length).toBeGreaterThan(0);
    }
  });

  it("모든 실행기는 PREVIEW 모드에서 예외 없이 ListingResult를 반환한다", async () => {
    const product = makeMockProduct();
    for (const platform of PLATFORM_ORDER) {
      const listing = PLATFORM_ADAPTERS[platform].toListingModel(product);
      const result = await LISTING_EXECUTORS[platform].execute(product, listing, "PREVIEW");
      expect(result.platform).toBe(platform);
      expect(result.mode).toBe("PREVIEW");
      expect(["READY", "FAILED"]).toContain(result.status);
    }
  });
});
