import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload } from "../build-payload";

/**
 * N-3.50 STEP2 — Canonical option → SmartStore optionName/optionCombinationGroupNames
 * 변환 규칙을 상품 종류(단일옵션/2옵션/3옵션/4옵션 이상/옵션없음)별로 고정한다.
 * N-3.49에서 Voyage Dress(2옵션, 색상+사이즈) 케이스만 실제 확인했었는데, 이
 * 파일은 그 확인을 모든 옵션 개수 조합으로 일반화한다 — 특정 상품 이름/값에
 * 의존하는 코드는 build-payload.ts에 없다(N-3.50 STEP1에서 재확인).
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeBaseProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/option-contract-test",
    title: field("옵션 계약 테스트 상품"),
    brand: field("TestBrand"),
    price: field({ amount: 10000, currency: "KRW" }),
    priceValidity: "VALID",
    sku: field("OPT-TEST-1"),
    description: field("옵션 계약 테스트용 상품입니다."),
    material: field("면 100%"),
    color: field("화이트"),
    recommendedAge: field("3세"),
    manufacturer: field("Test Manufacturer"),
    careInstructions: field("찬물 세탁"),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [
      {
        id: "img-1",
        originalUrl: "https://example.com/images/product.jpg",
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
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(1),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
  };
}

function makeListing(product: CanonicalProduct): ListingModel {
  return {
    platform: "smartstore",
    platformLabel: "네이버 스마트스토어",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 10000,
    priceIsEstimate: false,
    options: product.optionGroups.map((g) => g.name),
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  };
}

const LEAF_CATEGORY_ID = "50000535";
const PLACEHOLDER_RELEASE_ADDRESS = 900000001;
const PLACEHOLDER_REFUND_ADDRESS = 900000002;
const PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE = "PRIMARY";
const PLACEHOLDER_RETURN_DELIVERY_FEE = 3000;
const PLACEHOLDER_EXCHANGE_DELIVERY_FEE = 5000;
const PLACEHOLDER_ORIGIN_AREA_CODE = "00";

function buildPayloadFor(product: CanonicalProduct) {
  const listing = makeListing(product);
  return buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: LEAF_CATEGORY_ID,
    releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
    refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
    primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      sellerDeliveryFee: null,
    returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
    exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
    childCertificationInfoId: null,
    categoryRequiresChildCertification: false,
    originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
    originAreaRequiresContent: false,
  });
}

describe("Naver option name contract (N-3.50 STEP2)", () => {
  it("옵션 없는 상품 — optionInfo 자체가 없다", () => {
    const product = makeBaseProduct();
    // optionGroups/variants 모두 비어있음(기본값) — 실제 옵션이 없는 흔한 케이스.
    const payload = buildPayloadFor(product);
    expect(payload.originProduct.detailAttribute?.optionInfo).toBeUndefined();
  });

  it("단일 옵션(사이즈만) — optionGroupName1만 채워지고 optionName1만 쓴다", () => {
    const product = makeBaseProduct();
    product.optionGroups = [{ name: "사이즈", values: ["S", "M", "L"] }];
    product.variants = [
      { id: "v1", optionValues: { 사이즈: "S" }, sku: "SKU-S", stockQuantity: 5 },
      { id: "v2", optionValues: { 사이즈: "M" }, sku: "SKU-M", stockQuantity: 5 },
      { id: "v3", optionValues: { 사이즈: "L" }, sku: "SKU-L", stockQuantity: 5 },
    ] as unknown as CanonicalProduct["variants"];
    const payload = buildPayloadFor(product);
    const optionInfo = payload.originProduct.detailAttribute?.optionInfo;
    expect(optionInfo?.optionCombinationGroupNames).toEqual({ optionGroupName1: "사이즈" });
    expect(optionInfo?.optionCombinations).toHaveLength(3);
    for (const combo of optionInfo?.optionCombinations ?? []) {
      expect(combo.optionName2).toBeUndefined();
      expect(combo.optionName3).toBeUndefined();
    }
    expect(optionInfo?.optionCombinations?.map((c) => c.optionName1)).toEqual(["S", "M", "L"]);
  });

  it("2옵션(색상+사이즈) — optionGroupName1/2, optionName1/2가 정확히 매핑된다", () => {
    const product = makeBaseProduct();
    product.optionGroups = [
      { name: "색상", values: ["Navy", "Red"] },
      { name: "사이즈", values: ["S", "M"] },
    ];
    product.variants = [
      { id: "v1", optionValues: { 색상: "Navy", 사이즈: "S" }, sku: "SKU-1", stockQuantity: 5 },
      { id: "v2", optionValues: { 색상: "Red", 사이즈: "M" }, sku: "SKU-2", stockQuantity: 5 },
    ] as unknown as CanonicalProduct["variants"];
    const payload = buildPayloadFor(product);
    const optionInfo = payload.originProduct.detailAttribute?.optionInfo;
    expect(optionInfo?.optionCombinationGroupNames).toEqual({
      optionGroupName1: "색상",
      optionGroupName2: "사이즈",
    });
    expect(optionInfo?.optionCombinations?.[0]).toMatchObject({ optionName1: "Navy", optionName2: "S" });
    expect(optionInfo?.optionCombinations?.[1]).toMatchObject({ optionName1: "Red", optionName2: "M" });
  });

  it("3옵션(색상+사이즈+소재) — optionGroupName1/2/3, optionName1/2/3가 정확히 매핑된다", () => {
    const product = makeBaseProduct();
    product.optionGroups = [
      { name: "색상", values: ["Navy"] },
      { name: "사이즈", values: ["S"] },
      { name: "소재", values: ["Cotton"] },
    ];
    product.variants = [
      {
        id: "v1",
        optionValues: { 색상: "Navy", 사이즈: "S", 소재: "Cotton" },
        sku: "SKU-1",
        stockQuantity: 5,
      },
    ] as unknown as CanonicalProduct["variants"];
    const payload = buildPayloadFor(product);
    const optionInfo = payload.originProduct.detailAttribute?.optionInfo;
    expect(optionInfo?.optionCombinationGroupNames).toEqual({
      optionGroupName1: "색상",
      optionGroupName2: "사이즈",
      optionGroupName3: "소재",
    });
    expect(optionInfo?.optionCombinations?.[0]).toMatchObject({
      optionName1: "Navy",
      optionName2: "S",
      optionName3: "Cotton",
    });
  });

  it("4옵션 이상 — SmartStore 정책상 최대 3개까지만 채운다(optionGroupName4/optionName4는 항상 없음)", () => {
    // N-3.50 STEP1/2에서 발견한 실제 불일치 버그의 회귀 테스트 — 이전에는
    // optionCombinations[].optionName4는 채우면서 optionCombinationGroupNames에는
    // 짝이 되는 optionGroupName4가 없는 상태였다(어느 쪽도 완전하지 않은 데이터).
    // 지금은 두 함수 모두 3개 상한으로 통일한다.
    const product = makeBaseProduct();
    product.optionGroups = [
      { name: "색상", values: ["Navy"] },
      { name: "사이즈", values: ["S"] },
      { name: "소재", values: ["Cotton"] },
      { name: "패턴", values: ["Stripe"] },
    ];
    product.variants = [
      {
        id: "v1",
        optionValues: { 색상: "Navy", 사이즈: "S", 소재: "Cotton", 패턴: "Stripe" },
        sku: "SKU-1",
        stockQuantity: 5,
      },
    ] as unknown as CanonicalProduct["variants"];
    const payload = buildPayloadFor(product);
    const optionInfo = payload.originProduct.detailAttribute?.optionInfo;
    expect(optionInfo?.optionCombinationGroupNames).toEqual({
      optionGroupName1: "색상",
      optionGroupName2: "사이즈",
      optionGroupName3: "소재",
    });
    expect(optionInfo?.optionCombinationGroupNames).not.toHaveProperty("optionGroupName4");
    expect(optionInfo?.optionCombinations?.[0]).toMatchObject({
      optionName1: "Navy",
      optionName2: "S",
      optionName3: "Cotton",
    });
    expect(optionInfo?.optionCombinations?.[0]).not.toHaveProperty("optionName4");
  });
});
