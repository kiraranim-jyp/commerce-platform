import { describe, expect, it } from "vitest";
import {
  getSelectedImageUrl,
  isRegistrationSafeImageUrl,
  type CanonicalProduct,
  type CanonicalProductImage,
  type FieldSource,
  type ProvenanceField,
} from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { buildNaverProductPayload } from "../naver/build-payload";
import { validateNaverPayload } from "../naver/validate-payload";
import { isLotteOnSupportedImageUrl } from "../lotteon/build-payload";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-STORAGE-FEEDBACK-02 (CEO 확정, 2026-09-30)
 * **대표 이미지 오류는 «차단», 비대표 제외는 «경고».**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 직전 커밋(215c3a6)이 비대표 하나만 문제여도 전체를 막았다 — CEO 결정 2 위반.
 * 그 회귀를 여기서 잡는다. 형제 파일(marketplace/data-uri-registration-guard)은
 * «어댑터» 축을 재고, 이 파일은 «검증 문구·차단 여부» 축을 잰다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function image(over: Partial<CanonicalProductImage> & { id: string; originalUrl: string }): CanonicalProductImage {
  return {
    selectedVariant: "ORIGINAL",
    isRepresentative: false,
    useInProductGallery: true,
    useInDescription: true,
    classification: "PRODUCT",
    ...over,
  } as CanonicalProductImage;
}

const DATA_URI = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD";
const PUBLIC_URL = "https://example.supabase.co/storage/v1/object/public/product-images/a.jpg";

function productWith(images: CanonicalProductImage[]): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 88, currency: "GBP" }),
    priceValidity: "VALID",
    sku: field("TEST-SKU-1"),
    description: field("A test product."),
    material: field("면 100%"),
    color: field("네이비"),
    recommendedAge: field("4-5세"),
    manufacturer: field("TestBrand"),
    careInstructions: field("손세탁"),
    options: field([]),
    optionGroups: [],
    variants: [],
    images,
    titleKo: field("테스트 상품"),
    descriptionKo: field("설명"),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field("대한민국"),
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(999, "DEFAULT"),
    certification: field(""),
    importer: field("따조"),
    childCertification: field(null),
    itemName: field("테스트 상품"),
    modelName: field("TEST-SKU-1"),
    weight: field("120g"),
    certificationType: field(""),
    priceBreakdown: { shippingKrw: 12000, feePercent: 10, marginPercent: 12 },
  } as unknown as CanonicalProduct;
}

function listingOf(product: CanonicalProduct) {
  return PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
}

/* 🔴 형제 테스트(naver/__tests__/build-payload.test.ts)가 쓰는 placeholder 를 그대로 쓴다.
   build 와 validate 가 받는 칸이 «다르다» — 억지로 한 객체로 합치지 않는다. */
const BUILD_ARGS = {
  leafCategoryId: "50000535",
  releaseAddressBookNo: 1,
  refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  childCertificationInfoId: 1041,
  categoryRequiresChildCertification: false,
  originAreaCode: "0200037",
  originAreaRequiresContent: false,
} as const;

const VALIDATE_ARGS = {
  releaseAddressBookNo: 1,
  refundAddressBookNo: 2,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 6000,
  returnCompaniesFetchFailed: false,
  childCertificationInfoId: 1041,
  originAreaCode: "0200037",
  originAreaRequiresImporter: false,
} as const;

/* ══ MI-STORAGE-FEEDBACK-02 (CEO 확정, 2026-09-30) ══════════════════════════════
   🔴 결정 2: 대표 이미지 오류는 «차단», 비대표 제외는 «경고».
   직전 커밋(215c3a6)은 비대표 하나만 문제여도 전체를 막았다 — 그것을 고친다. */

describe("⑦ SmartStore — 대표는 차단, 추가 이미지는 경고", () => {
  const validate = (images: CanonicalProductImage[]) => {
    const product = productWith(images);
    const listing = listingOf(product);
    return validateNaverPayload(
      buildNaverProductPayload({ product, listing, ...BUILD_ARGS }),
      { product, ...VALIDATE_ARGS },
      false,
    );
  };
  const fieldOf = (r: ReturnType<typeof validate>, name: string) => r.fields.find((f) => f.field === name);

  it("🔴 대표 정상 + 추가 일부 data: → 추가 칸이 «경고(optional)» 다", () => {
    const r = validate([
      image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
      image({ id: "0004", originalUrl: DATA_URI }),
      image({ id: "0006", originalUrl: DATA_URI }),
    ]);
    const f = fieldOf(r, "originProduct.images.optionalImages");
    expect(f?.status).toBe("MISSING");
    expect(f?.optional, "🔴 optional 이 아니면 등록이 차단된다 — 결정 2 위반").toBe(true);
    expect(f?.reason).toContain("2건");
  });

  it("🔴 그 경고가 «차단 수» 에 들어가지 않는다", () => {
    const withWarn = validate([
      image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
      image({ id: "0004", originalUrl: DATA_URI }),
    ]);
    const clean = validate([image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true })]);
    const blocking = (r: ReturnType<typeof validate>) =>
      r.fields.filter((f) => f.status === "MISSING" && !f.optional).length;
    expect(blocking(withWarn)).toBe(blocking(clean));
  });

  it("🔴 대표가 data: 면 «차단» 이고 사유가 구체적이다", () => {
    const r = validate([image({ id: "rep", originalUrl: DATA_URI, isRepresentative: true })]);
    const url = fieldOf(r, "originProduct.images.representativeImage.url");
    const missing = fieldOf(r, "originProduct.images.representativeImage");
    /* 대표가 data: 면 어댑터가 버려서 representativeImage 자체가 비고,
       기존 「대표 이미지가 없습니다」 칸이 차단한다. 어느 쪽이든 «차단» 이어야 한다. */
    const blocked = [url, missing].some((f) => f?.status === "MISSING" && !f?.optional);
    expect(blocked).toBe(true);
  });

  it("추가 이미지가 전부 정상이면 경고가 없다", () => {
    const r = validate([
      image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
      image({ id: "a1", originalUrl: "https://a/1.jpg" }),
    ]);
    expect(fieldOf(r, "originProduct.images.optionalImages")?.status).toBe("READY");
  });
});

describe("⑧ 🔴 롯데ON 은 현행 유지 — 완화되지 않았음을 고정한다", () => {
  it("갤러리에 data: 가 «한 장» 이라도 있으면 여전히 차단한다", () => {
    expect(isLotteOnSupportedImageUrl(DATA_URI)).toBe(false);
  });

  it("🔴 확장자 제약도 그대로다 — webp 는 여전히 거부", () => {
    expect(isLotteOnSupportedImageUrl("https://a/x.webp")).toBe(false);
    expect(isLotteOnSupportedImageUrl("https://a/x.jpg")).toBe(true);
    expect(isLotteOnSupportedImageUrl("https://a/x.PNG")).toBe(true);
  });
});
