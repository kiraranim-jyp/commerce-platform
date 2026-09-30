import { describe, expect, it } from "vitest";
import {
  getRegistrationImageUrl,
  getSelectedImageUrl,
  isRegistrationSafeImageUrl,
  type CanonicalProduct,
  type CanonicalProductImage,
  type FieldSource,
  type ProvenanceField,
} from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "../index";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DATA-URI-FIX-01 (CEO 승인 A+B, 2026-09-30)
 * **업로드 실패 시 data: URI 가 등록 payload 로 나가던 경로를 닫는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 fixture 는 «실측값» 이다 ─────────────────────────────────────────────
 * Production 조회(SELECT)로 확인된 3건이 전부 같은 모양이었다:
 *
 *     selectedVariant   "ORIGINAL"
 *     processedUrl      없음
 *     useInProductGallery true
 *     🔴 isRepresentative false     ← 그래서 «대표만» 보던 게이트가 못 잡았다
 *
 * 그 모양을 그대로 쓴다. 대표 이미지에 data: 를 넣어 재는 것은 «쉬운 쪽» 이고,
 * 실제로 터진 자리를 재지 못한다.
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

/** 실측 3건과 같은 모양 — 대표는 정상, 비대표만 data: URI. */
const DATA_URI = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD";
const PUBLIC_URL = "https://example.supabase.co/storage/v1/object/public/product-images/a.jpg";

/* 🔴 형제 파일 listing-price-contract.test.ts 의 makeMockProduct 와 «같은 모양» 이다.
   그 파일을 export 하도록 고치지 «않았다» — 남의 테스트를 이 작업 때문에 바꾸지 않는다. */
function productWith(images: CanonicalProductImage[]): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/test-item",
    title: field("Test Item"),
    brand: field("TestBrand"),
    price: field({ amount: 88, currency: "GBP" }),
    priceValidity: "VALID",
    sku: field("TEST-SKU-1"),
    description: field("A test product."),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images,
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
  } as unknown as CanonicalProduct;
}

function listingOf(product: CanonicalProduct) {
  return PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");
}

describe("① 판정 함수 — http(s) 허용목록", () => {
  it("공개 URL 은 통과한다", () => {
    expect(isRegistrationSafeImageUrl(PUBLIC_URL)).toBe(true);
    expect(isRegistrationSafeImageUrl("http://cdn.example.com/a.png")).toBe(true);
  });

  it("🔴 data: URI 를 막는다", () => {
    expect(isRegistrationSafeImageUrl(DATA_URI)).toBe(false);
  });

  it("🔴 빈 URL·공백·null·undefined 를 막는다", () => {
    for (const bad of ["", "   ", null, undefined]) {
      expect(isRegistrationSafeImageUrl(bad)).toBe(false);
    }
  });

  it("🔴 다른 스킴도 막는다 — denylist 가 아니라 allowlist 이기 때문", () => {
    for (const bad of ["blob:https://x/y", "file:///tmp/a.jpg", "ftp://x/a.jpg", "//cdn/a.jpg", "javascript:alert(1)"]) {
      expect(isRegistrationSafeImageUrl(bad), bad).toBe(false);
    }
  });
});

describe("② 미리보기 동작은 «그대로» 다", () => {
  it("🔴 getSelectedImageUrl 은 data: URI 를 여전히 돌려준다 — 미리보기가 이것을 쓴다", () => {
    const img = image({ id: "0004", originalUrl: DATA_URI });
    expect(getSelectedImageUrl(img)).toBe(DATA_URI);
  });

  it("등록용 접근자만 null 을 돌려준다", () => {
    const img = image({ id: "0004", originalUrl: DATA_URI });
    expect(getRegistrationImageUrl(img)).toBeNull();
  });

  it("PROCESSED 선택 규칙은 두 접근자가 «같다»", () => {
    const img = image({
      id: "0001",
      originalUrl: "https://a/original.jpg",
      processedUrl: "https://a/processed.jpg",
      selectedVariant: "PROCESSED",
    });
    expect(getSelectedImageUrl(img)).toBe("https://a/processed.jpg");
    expect(getRegistrationImageUrl(img)).toBe("https://a/processed.jpg");
  });
});

describe("③ 🔴 실측 케이스 — 대표는 정상, 비대표에만 data: URI", () => {
  const product = productWith([
    image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
    image({ id: "0004", originalUrl: DATA_URI, classification: "DETAIL" }),
    image({ id: "0006", originalUrl: DATA_URI, classification: "DETAIL" }),
  ]);

  it("대표 이미지는 그대로 실린다", () => {
    expect(listingOf(product).representativeImage).toBe(PUBLIC_URL);
  });

  it("🔴 비대표 data: URI 가 additionalImages 에서 «빠진다»", () => {
    const listing = listingOf(product);
    expect(listing.additionalImages).toEqual([]);
    expect(JSON.stringify(listing)).not.toContain("data:image");
  });

  it("🔴 payload 전수 검색 — base64 가 한 글자도 남지 않는다", () => {
    expect(JSON.stringify(listingOf(product))).not.toContain("base64");
  });
});

describe("④ 정상 이미지만 있으면 기존 동작 그대로 (회귀)", () => {
  const product = productWith([
    image({ id: "rep", originalUrl: "https://a/rep.jpg", isRepresentative: true }),
    image({ id: "a1", originalUrl: "https://a/1.jpg" }),
    image({ id: "a2", originalUrl: "https://a/2.jpg" }),
  ]);

  it("대표 + 추가 2장이 모두 실린다", () => {
    const listing = listingOf(product);
    expect(listing.representativeImage).toBe("https://a/rep.jpg");
    expect(listing.additionalImages).toEqual(["https://a/1.jpg", "https://a/2.jpg"]);
  });

  it("쿠팡 어댑터도 같다 — 어댑터별로 다르게 동작하지 않는다", () => {
    const coupang = PLATFORM_ADAPTERS.coupang.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "coupang");
    expect(coupang.representativeImage).toBe("https://a/rep.jpg");
    expect(coupang.additionalImages).toEqual(["https://a/1.jpg", "https://a/2.jpg"]);
  });
});

describe("⑤ 🔴 대표 이미지 자체가 data: 면 «대표가 없어진다»", () => {
  const product = productWith([
    image({ id: "rep", originalUrl: DATA_URI, isRepresentative: true }),
    image({ id: "a1", originalUrl: "https://a/1.jpg" }),
  ]);

  it("representativeImage 가 undefined 가 되어 기존 필수값 게이트에 걸린다", () => {
    /* 🔴 「이미지를 지어내지 않는다」 — 추가 이미지를 대표로 «승격시키지 않는다».
       승격시키면 셀러가 고르지 않은 사진이 대표가 된다. */
    const listing = listingOf(product);
    expect(listing.representativeImage).toBeUndefined();
    expect(listing.additionalImages).toEqual(["https://a/1.jpg"]);
  });
});

describe("⑥ 갤러리 제외 이미지는 애초에 대상이 아니다", () => {
  it("useInProductGallery=false 인 data: URI 는 additionalImages 에 없다", () => {
    const product = productWith([
      image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
      image({ id: "x", originalUrl: DATA_URI, useInProductGallery: false }),
    ]);
    expect(listingOf(product).additionalImages).toEqual([]);
  });
});

/* ══ MI-COUPANG-IMAGE-WARNING-03 (CPO 방향 승인, 2026-09-30) ══════════════════
   🔴 등록 «전» 에 제외 사실을 말한다. 재는 것은 넷이다 —
   정상 / 추가 일부 제외 / 추가 전부 제외 / 대표 오류. */

const warnOf = (listing: ReturnType<typeof listingOf>) =>
  listing.validations.find((v) => v.field === "excludedAdditionalImages");
const blocking = (listing: ReturnType<typeof listingOf>) =>
  listing.validations.filter((v) => v.status === "ERROR").map((v) => v.field);

function coupangOf(product: CanonicalProduct) {
  return PLATFORM_ADAPTERS.coupang.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "coupang");
}

describe("⑩ 쿠팡 등록 전 경고 — 제외 장수를 말한다", () => {
  it("정상: 대표 + 추가 2장 모두 안전하면 PASS 고 메시지가 없다", () => {
    const listing = coupangOf(
      productWith([
        image({ id: "rep", originalUrl: "https://a/rep.jpg", isRepresentative: true }),
        image({ id: "a1", originalUrl: "https://a/1.jpg" }),
        image({ id: "a2", originalUrl: "https://a/2.jpg" }),
      ]),
    );
    expect(warnOf(listing)?.status).toBe("PASS");
    expect(warnOf(listing)?.message).toBeUndefined();
  });

  it("🔴 추가 일부 제외: WARNING 이고 «장수» 를 말한다", () => {
    const listing = coupangOf(
      productWith([
        image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
        image({ id: "0004", originalUrl: DATA_URI }),
        image({ id: "a1", originalUrl: "https://a/1.jpg" }),
      ]),
    );
    expect(warnOf(listing)?.status).toBe("WARNING");
    expect(warnOf(listing)?.message).toContain("1건");
  });

  it("🔴 추가 전부 제외: 그래도 ERROR 가 아니다 — CEO 결정 2", () => {
    const listing = coupangOf(
      productWith([
        image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
        image({ id: "0004", originalUrl: DATA_URI }),
        image({ id: "0006", originalUrl: DATA_URI }),
      ]),
    );
    expect(warnOf(listing)?.status).toBe("WARNING");
    expect(warnOf(listing)?.message).toContain("2건");
    /* 🔴 등록 버튼 게이트는 ERROR 만 본다(CommerceWorkspace.tsx:2934).
       이 경고가 거기 섞이면 CEO 결정 2 가 다시 깨진다. */
    expect(blocking(listing)).not.toContain("excludedAdditionalImages");
  });

  it("🔴 대표 오류: 기존 차단이 그대로 유지된다", () => {
    const listing = coupangOf(
      productWith([
        image({ id: "rep", originalUrl: DATA_URI, isRepresentative: true }),
        image({ id: "a1", originalUrl: "https://a/1.jpg" }),
      ]),
    );
    expect(blocking(listing)).toContain("representativeImage");
    /* 대표만 문제고 추가는 멀쩡하니 «추가» 경고는 뜨지 않는다 — 사유를 섞지 않는다. */
    expect(warnOf(listing)?.status).toBe("PASS");
  });

  it("갤러리에서 «셀러가» 뺀 이미지는 제외 장수에 들어가지 않는다", () => {
    const listing = coupangOf(
      productWith([
        image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
        image({ id: "x", originalUrl: DATA_URI, useInProductGallery: false }),
      ]),
    );
    expect(warnOf(listing)?.status).toBe("PASS");
  });

  it("🔴 11번가·스마트스토어에는 이 경고가 «없다» — 동반 노출 금지", () => {
    const product = productWith([
      image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true }),
      image({ id: "0004", originalUrl: DATA_URI }),
    ]);
    for (const platform of ["elevenst", "smartstore"] as const) {
      const listing = PLATFORM_ADAPTERS[platform].toListingModel(product, UNRESOLVED_CATEGORY, undefined, platform);
      expect(
        listing.validations.some((v) => v.field === "excludedAdditionalImages"),
        `${platform} 에 쿠팡 전용 경고가 번졌다`,
      ).toBe(false);
    }
  });
});
