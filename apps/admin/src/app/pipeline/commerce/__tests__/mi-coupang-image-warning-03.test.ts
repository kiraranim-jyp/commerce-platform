import { describe, expect, it } from "vitest";
import type { CanonicalProduct, CanonicalProductImage, FieldSource, ProvenanceField } from "@commerce/shared";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { computeChecklistReadiness } from "../readiness";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-COUPANG-IMAGE-WARNING-03 (CPO 방향 승인, 2026-09-30)
 * **어댑터 경고가 «등록 전 준비도» 까지 실제로 흐르는가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 어댑터만 재면 「WARNING 을 만들었다」까지밖에 증명되지 않는다. 지시서 2항은
 * 그것이 computeChecklistReadiness 를 «타고» 오는지를 요구한다 — 쿠팡 화면이
 * 실제로 부르는 함수가 그것이다(PlatformPreview.tsx:817 의 hasNaverPreview 분기).
 * 그래서 어댑터 출력을 그대로 그 함수에 먹인다. 중간을 손으로 짜면 사슬이
 * 끊긴 것을 못 본다.
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

function readinessOf(images: CanonicalProductImage[]) {
  const listing = PLATFORM_ADAPTERS.coupang.toListingModel(
    productWith(images),
    UNRESOLVED_CATEGORY,
    undefined,
    "coupang",
  );
  return { listing, summary: computeChecklistReadiness(listing.validations, listing.category) };
}

const REP_OK = image({ id: "rep", originalUrl: PUBLIC_URL, isRepresentative: true });

describe("MI-COUPANG-IMAGE-WARNING-03 — 어댑터 경고 → 준비도", () => {
  it("🔴 제외가 있으면 준비도 항목으로 «도착한다»", () => {
    const { summary } = readinessOf([REP_OK, image({ id: "0004", originalUrl: DATA_URI })]);
    const item = summary.items.find((i) => i.label === "추가 이미지");
    expect(item, "어댑터 경고가 준비도까지 오지 않았다 — 사슬이 끊겼다").toBeDefined();
    expect(item!.hint).toContain("1건");
  });

  it("🔴 그 항목은 required 가 «아니다» — 등록을 막지 않는다 (CEO 결정 2)", () => {
    const { summary } = readinessOf([REP_OK, image({ id: "0004", originalUrl: DATA_URI })]);
    const item = summary.items.find((i) => i.label === "추가 이미지")!;
    expect(item.required).toBe(false);
    expect(summary.recommended.map((i) => i.label)).toContain("추가 이미지");
    expect(summary.required.map((i) => i.label)).not.toContain("추가 이미지");
  });

  /* 🔴 여기서 한 번 틀렸다. 처음엔 「경고 상품 percent == 정상 상품 percent」로
     쟀는데 88 vs 89 로 깨졌다. 이유는 readiness.ts:130 의 `required: v.status
     !== "WARNING"` 다 — 규칙이 PASS 하면 그 행은 required:true + passed 라서
     정상 상품은 분자·분모가 «같이» 늘어 퍼센트가 오른다. 두 상품을 맞대는 것은
     애초에 틀린 비교였다.

     재야 하는 것은 「이 경고가 점수를 «낮추는가»」다. 그러면 대조군은 다른
     상품이 아니라 «변경 전의 같은 상품» 이다 — 그것은 validations 에서 이 행만
     빼면 정확히 재현된다. 추정이 아니라 같은 함수에 같은 입력을 먹인다. */
  const withoutNewRule = (listing: ReturnType<typeof readinessOf>["listing"]) =>
    computeChecklistReadiness(
      listing.validations.filter((v) => v.field !== "excludedAdditionalImages"),
      listing.category,
    );

  it("🔴 경고가 「등록 가능성」 퍼센트를 «낮추지» 않는다 — 변경 전과 같은 값이다", () => {
    const warned = readinessOf([REP_OK, image({ id: "0004", originalUrl: DATA_URI })]);
    const before = withoutNewRule(warned.listing);
    expect(warned.summary.percent).toBe(before.percent);
    expect(warned.summary.allRequiredPassed).toBe(before.allRequiredPassed);
  });

  it("🔴 정상 상품도 «낮아지지» 않는다 — 다만 규칙이 하나 늘어 값 자체는 움직인다", () => {
    const clean = readinessOf([REP_OK, image({ id: "a1", originalUrl: "https://a/1.jpg" })]);
    const before = withoutNewRule(clean.listing);
    expect(clean.summary.percent).toBeGreaterThanOrEqual(before.percent);
    expect(clean.summary.allRequiredPassed).toBe(before.allRequiredPassed);
  });

  it("🔴 경고가 등록 버튼 게이트를 건드리지 않는다 — 정상과 같은 판정이다", () => {
    const clean = readinessOf([REP_OK, image({ id: "a1", originalUrl: "https://a/1.jpg" })]);
    const warned = readinessOf([REP_OK, image({ id: "0004", originalUrl: DATA_URI })]);
    expect(warned.summary.allRequiredPassed).toBe(clean.summary.allRequiredPassed);
    /* 화면의 실제 게이트(CommerceWorkspace.tsx:2934)는 ERROR 만 본다.
       🔴 「ERROR 가 0건」으로 재지 «않는다» — 이 fixture 는 UNRESOLVED_CATEGORY 를
       쓰고, SELLER-UX-FINAL 에서 카테고리 미확정이 WARNING→ERROR 로 올라갔다
       (실제로 CP001 로 등록이 막히므로). 그것은 이 테스트가 재려는 「이미지 경고」와
       무관하다. 재야 하는 것은 **경고가 ERROR 를 «늘리지» 않는가** 이므로 정상
       상품과 ERROR 목록이 같은지를 본다 — 「0건」보다 강한 단정이다. */
    const errorFields = (r: typeof warned) =>
      r.listing.validations
        .filter((v) => v.status === "ERROR")
        .map((v) => v.field)
        .sort();
    expect(errorFields(warned)).toEqual(errorFields(clean));
    /* 그리고 그 목록에 이미지 규칙이 들어 있지 않다. */
    expect(errorFields(warned).filter((f) => f.toLowerCase().includes("image"))).toEqual([]);
  });

  it("🔴 대표 오류는 여전히 required 로 막는다", () => {
    const { summary } = readinessOf([
      image({ id: "rep", originalUrl: DATA_URI, isRepresentative: true }),
      image({ id: "a1", originalUrl: "https://a/1.jpg" }),
    ]);
    const rep = summary.required.find((i) => i.label === "대표이미지");
    expect(rep).toBeDefined();
    expect(rep!.passed).toBe(false);
    expect(summary.allRequiredPassed).toBe(false);
  });

  it("정상 이미지만 있으면 경고 항목이 서지 않는다", () => {
    const { summary } = readinessOf([REP_OK, image({ id: "a1", originalUrl: "https://a/1.jpg" })]);
    expect(summary.items.find((i) => i.label === "추가 이미지")!.passed).toBe(true);
  });

  /* 🔴 알면서 남긴 한계다 — 숨기지 않는다. 지시서가 「숫자 표시는 별도 범위」로
     갈라 둔 바로 그 자리다. 이 단정이 깨지는 날은 UI 가 실제로 붙은 날이고,
     그때 이 테스트를 «지우는 것» 이 그 작업의 일부다. */
  it("🔴 한계 고정: 이 경고에는 아직 sectionId 가 없다(이동 앵커 미정)", () => {
    const { summary } = readinessOf([REP_OK, image({ id: "0004", originalUrl: DATA_URI })]);
    const item = summary.items.find((i) => i.label === "추가 이미지")!;
    expect(item.sectionId).toBeUndefined();
    expect(item.externalHref).toBeUndefined();
  });
});
