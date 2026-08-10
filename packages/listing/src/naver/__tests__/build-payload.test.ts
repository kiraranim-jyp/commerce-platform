import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload } from "../build-payload";
import { validateNaverPayload } from "../validate-payload";

/**
 * Sprint N-2.6 — "Naver Minimal Product Fixture"(아동용 티셔츠). N-2.4에서 실제
 * production GET으로 확인한 리프 카테고리(50000535, 출산/육아>유아동의류>티셔츠)를
 * 그대로 쓴다. 주소록 ID는 실제 판매자 값이 아니라 placeholder — N-2.5에서 확인한
 * 실제 addressBookNo는 판매자 식별정보라 코드에 하드코딩하지 않는다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeMinimalProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/kids-tshirt",
    title: field("아동용 반팔 티셔츠"),
    brand: field("TestBrand"),
    price: field({ amount: 10000, currency: "KRW" }),
    sku: field("KIDS-TSHIRT-1"),
    description: field("아동용 반팔 티셔츠입니다."),
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
        originalUrl: "https://example.com/images/tshirt.jpg",
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
  };
}

function makeMinimalListing(product: CanonicalProduct): ListingModel {
  return {
    platform: "smartstore",
    platformLabel: "네이버 스마트스토어",
    representativeImage: product.images[0].originalUrl,
    additionalImages: [],
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 10000,
    priceIsEstimate: false,
    options: [],
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  };
}

// N-2.4에서 확인한 실제 리프 카테고리(출산/육아>유아동의류>티셔츠).
const LEAF_CATEGORY_ID = "50000535";
// N-2.4에서 확인한 실제 인증 카탈로그 id(kindTypes에 CHILD_CERTIFICATION 포함) —
// 이건 네이버 전체 공통 카탈로그 ID라 판매자 식별정보가 아니다.
const CHILD_CERTIFICATION_CATALOG_ID = 1041;
// 판매자별 실제 주소록 ID — 테스트용 placeholder(실제 값 아님).
const PLACEHOLDER_RELEASE_ADDRESS = 900000001;
const PLACEHOLDER_REFUND_ADDRESS = 900000002;
// N-3.3 — 반품 택배사 우선순위 타입/반품·교환 배송비도 테스트용 placeholder.
const PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE = "PRIMARY";
const PLACEHOLDER_RETURN_DELIVERY_FEE = 3000;
const PLACEHOLDER_EXCHANGE_DELIVERY_FEE = 5000;

describe("buildNaverProductPayload", () => {
  it("최상위 구조가 originProduct/smartstoreChannelProduct 두 객체를 갖는다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
    });
    expect(payload).toHaveProperty("originProduct");
    expect(payload).toHaveProperty("smartstoreChannelProduct");
  });

  it("images는 단순 문자열이 아니라 {url} object로 감싼다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
    });
    expect(payload.originProduct.images.representativeImage).toEqual({
      url: product.images[0].originalUrl,
    });
  });

  it("deliveryCompany를 채우지 않는다(미확인 필드) — 임의 코드 생성 금지", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
    });
    expect(payload.originProduct.deliveryInfo?.deliveryCompany).toBeUndefined();
  });

  it("N-3.3: claimDeliveryInfo에 반품 택배사 우선순위/반품·교환 배송비를 채운다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
    });
    expect(payload.originProduct.deliveryInfo?.claimDeliveryInfo).toMatchObject({
      shippingAddressId: PLACEHOLDER_RELEASE_ADDRESS,
      returnAddressId: PLACEHOLDER_REFUND_ADDRESS,
      returnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
    });
    // N-3.3 — outboundLocationId는 존재하지 않는 필드였음이 확인되어 제거됨.
    expect(payload.originProduct.deliveryInfo).not.toHaveProperty("outboundLocationId");
  });

  it("고시 정보는 인증서 보유 여부와 무관하게 항상 채워진다(N-2.7 수정)", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payloadWithoutCert = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: true,
    });
    expect(payloadWithoutCert.originProduct.detailAttribute?.productInfoProvidedNotice).toBeDefined();
    expect(
      payloadWithoutCert.originProduct.detailAttribute?.productInfoProvidedNotice?.productInfoProvidedNoticeType,
    ).toBe("KIDS");

    const payloadNonKids = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(
      payloadNonKids.originProduct.detailAttribute?.productInfoProvidedNotice?.productInfoProvidedNoticeType,
    ).toBe("WEAR");
  });

  it("N-2.8: originAreaInfo.content는 countryOfOrigin으로 채우지만 originAreaCode는 비운다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.originAreaInfo?.content).toBe("대한민국");
    expect(payload.originProduct.detailAttribute?.originAreaInfo?.originAreaCode).toBeUndefined();
  });

  it("N-2.8: 옵션이 있는 상품은 variant마다 optionCombinations 항목을 만든다", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "사이즈", values: ["90", "100"] }];
    product.variants = [
      { id: "v1", optionValues: { 사이즈: "90" }, sku: "SKU-90", stockQuantity: 5, price: { amount: 10000, currency: "KRW" } },
      { id: "v2", optionValues: { 사이즈: "100" }, sku: "SKU-100", stockQuantity: 3, price: { amount: 12000, currency: "KRW" } },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(2);
    expect(combos?.[0]).toMatchObject({ id: "SKU-90", optionName1: "90", stockQuantity: 5, price: 0 });
    // listing.priceKrw는 10000이므로 두 번째 옵션(12000)은 +2000 추가금액으로 계산된다(가정 — validate는 항상 BLOCKED).
    expect(combos?.[1]).toMatchObject({ id: "SKU-100", optionName1: "100", stockQuantity: 3, price: 2000 });
  });
});

describe("validateNaverPayload", () => {
  it("어린이제품 인증 필요 카테고리는 certificationInfoId가 있어도 항상 BLOCKED(실제 인증서 정보 없음)", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
    });
    const result = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
        refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
        primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
        returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
        exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
        returnCompaniesFetchFailed: false,
        childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      },
      true,
    );
    expect(result.ok).toBe(false);
    const blocked = result.issues.filter((i) => i.severity === "BLOCKED");
    expect(blocked.some((i) => i.field === "productCertificationInfos[].certificationNumber")).toBe(true);
    // 출고 택배사(deliveryCompany) 코드는 조회 API 자체가 없어 여전히 BLOCKED.
    expect(blocked.some((i) => i.field === "deliveryInfo.deliveryCompany")).toBe(true);
    // N-3.3 — 주소 매핑은 공식 스펙으로 확인됐으므로 더 이상 BLOCKED가 아니다.
    expect(blocked.some((i) => i.field === "deliveryInfo (address mapping)")).toBe(false);
  });

  it("출고지/반품지 주소가 없으면 MISSING으로 표시한다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: null,
      refundAddressBookNo: null,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const result = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: null,
        refundAddressBookNo: null,
        primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
        returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
        exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
        returnCompaniesFetchFailed: false,
        childCertificationInfoId: null,
      },
      false,
    );
    expect(result.ok).toBe(false);
    expect(
      result.issues.some((i) => i.field === "claimDeliveryInfo.shippingAddressId" && i.severity === "MISSING"),
    ).toBe(true);
    expect(result.issues.some((i) => i.field === "claimDeliveryInfo.returnAddressId" && i.severity === "MISSING")).toBe(
      true,
    );
  });

  it("N-3.3: 반품 택배사 목록 조회가 실패하면 BLOCKED", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const result = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
        refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
        primaryReturnDeliveryCompanyPriorityType: null,
        returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
        exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
        returnCompaniesFetchFailed: true,
        childCertificationInfoId: null,
      },
      false,
    );
    expect(
      result.issues.some(
        (i) => i.field === "claimDeliveryInfo.returnDeliveryCompanyPriorityType" && i.severity === "BLOCKED",
      ),
    ).toBe(true);
  });

  it("N-3.3: 판매자가 반품 택배사를 하나도 등록하지 않았으면(조회는 성공) MISSING", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const result = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
        refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
        primaryReturnDeliveryCompanyPriorityType: null,
        returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
        exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
        returnCompaniesFetchFailed: false,
        childCertificationInfoId: null,
      },
      false,
    );
    expect(
      result.issues.some(
        (i) => i.field === "claimDeliveryInfo.returnDeliveryCompanyPriorityType" && i.severity === "MISSING",
      ),
    ).toBe(true);
  });

  it("N-3.3: 반품/교환 배송비 정책이 없으면 각각 MISSING", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: null,
      exchangeDeliveryFee: null,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const result = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
        refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
        primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
        returnDeliveryFee: null,
        exchangeDeliveryFee: null,
        returnCompaniesFetchFailed: false,
        childCertificationInfoId: null,
      },
      false,
    );
    expect(
      result.issues.some((i) => i.field === "claimDeliveryInfo.returnDeliveryFee" && i.severity === "MISSING"),
    ).toBe(true);
    expect(
      result.issues.some((i) => i.field === "claimDeliveryInfo.exchangeDeliveryFee" && i.severity === "MISSING"),
    ).toBe(true);
  });

  it("옵션이 있는 상품은 옵션 스키마 미확인으로 BLOCKED", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "사이즈", values: ["90", "100"] }];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
    });
    const result = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
        refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
        primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
        returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
        exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
        returnCompaniesFetchFailed: false,
        childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      },
      true,
    );
    expect(result.issues.some((i) => i.field === "detailAttribute.optionInfo" && i.severity === "BLOCKED")).toBe(true);
  });

  it("N-2.8: originAreaCode는 항상 BLOCKED — content를 채워도 마찬가지", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const result = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
        refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
        primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
        returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
        exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
        returnCompaniesFetchFailed: false,
        childCertificationInfoId: null,
      },
      false,
    );
    expect(
      result.issues.some(
        (i) => i.field === "detailAttribute.originAreaInfo.originAreaCode" && i.severity === "BLOCKED",
      ),
    ).toBe(true);
  });
});
