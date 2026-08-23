import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import {
  buildNaverProductPayload,
  resolveModelNameFromDescription,
  generateSmartStoreProductName,
  resolveSeasonFromText,
} from "../build-payload";
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
    priceValidity: "VALID",
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
    importer: field(""),
    childCertification: field(null),
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    certificationType: field(""),
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
// N-3.4 — 실제 GET /v1/product-origin-areas 응답에서 확인한 "00"(국산) 코드.
// 대부분의 테스트는 국산(수입사명 불필요, content 불필요)으로 고정해 둔다.
const PLACEHOLDER_ORIGIN_AREA_CODE = "00";

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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
    });
    expect(payload.originProduct.deliveryInfo?.deliveryCompany).toBeUndefined();
  });

  it("N-3.6(개정): deliveryCompany가 입력되면(Settings 수동 입력) 그대로 채운다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
      deliveryCompany: "CJ대한통운",
    });
    expect(payload.originProduct.deliveryInfo?.deliveryCompany).toBe("CJ대한통운");
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
        originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
        deliveryCompany: "CJ대한통운",
      },
      true,
    );
    expect(result.fields.find((f) => f.field === "deliveryInfo.deliveryCompany")?.status).toBe("READY");
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
    });
    expect(
      payloadNonKids.originProduct.detailAttribute?.productInfoProvidedNotice?.productInfoProvidedNoticeType,
    ).toBe("WEAR");
  });

  it("N-3.4: originAreaCode를 채우고, requiresContent가 false면 content는 비운다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
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
    expect(payload.originProduct.detailAttribute?.originAreaInfo?.originAreaCode).toBe(PLACEHOLDER_ORIGIN_AREA_CODE);
    expect(payload.originProduct.detailAttribute?.originAreaInfo?.content).toBeUndefined();
  });

  it("N-3.4: 04(직접입력)로 폴백된 경우(requiresContent=true)에만 content를 채운다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
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
      originAreaCode: "04",
      originAreaRequiresContent: true,
    });
    expect(payload.originProduct.detailAttribute?.originAreaInfo?.originAreaCode).toBe("04");
    expect(payload.originProduct.detailAttribute?.originAreaInfo?.content).toBe(product.countryOfOrigin.value);
  });

  it("N-3.4: 옵션이 있는 상품은 variant마다 optionCombinations 항목을 만들고, id는 절대 채우지 않는다", () => {
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
    });
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(2);
    expect(combos?.[0]).toMatchObject({ sellerManagerCode: "SKU-90", optionName1: "90", stockQuantity: 5, price: 0 });
    // listing.priceKrw는 10000이므로 두 번째 옵션(12000)은 +2000 추가금액으로 계산된다(가정 — validate는 항상 BLOCKED).
    expect(combos?.[1]).toMatchObject({
      sellerManagerCode: "SKU-100",
      optionName1: "100",
      stockQuantity: 3,
      price: 2000,
    });
    // N-3.4 — id는 "기존 옵션 수정용"이라 신규 등록에는 절대 채우지 않는다(N-2.8의 버그 수정).
    expect(combos?.[0].id).toBeUndefined();
    expect(combos?.[1].id).toBeUndefined();
  });

  it("N-3.49(실제 등록 시도로 발견한 버그 회귀 방지) — optionCombinationGroupNames는 배열이 아니라 optionGroupName1..3 객체다", () => {
    // 2026-08-17 Voyage Dress 실등록 시도에서 배열(string[])을 보냈다가 Naver
    // 실제 API가 HTTP 400으로 거부했다: "Cannot deserialize value of type
    // `KrExternalApiOptionCombinationNamesVo` from Array value". 이 테스트는
    // 그 버그가 다시 생기지 않도록 실제 확인된 객체 구조를 고정한다.
    const product = makeMinimalProduct();
    product.optionGroups = [
      { name: "색상", values: ["Navy"] },
      { name: "사이즈", values: ["S"] },
    ];
    product.variants = [{ id: "v1", optionValues: { 색상: "Navy", 사이즈: "S" }, sku: "SKU-1", stockQuantity: 5 }];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
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
    const groupNames = payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames;
    expect(Array.isArray(groupNames)).toBe(false);
    expect(groupNames).toEqual({ optionGroupName1: "색상", optionGroupName2: "사이즈" });
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
        originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
      },
      true,
    );
    expect(result.ok).toBe(false);
    const blocked = result.issues.filter((i) => i.severity === "BLOCKED");
    expect(blocked.some((i) => i.field === "productCertificationInfos[].certificationNumber")).toBe(true);
    // N-3.6(개정) — 출고 택배사 조회 API는 여전히 없지만 판매자가 Settings에서
    // 직접 입력할 수 있는 필드가 생겨서 BLOCKED가 아니라 MISSING이다(값을 안
    // 넘겼으니 MISSING으로 남아야 한다).
    const missing = result.issues.filter((i) => i.severity === "MISSING");
    expect(missing.some((i) => i.field === "deliveryInfo.deliveryCompany")).toBe(true);
    expect(blocked.some((i) => i.field === "deliveryInfo.deliveryCompany")).toBe(false);
    // N-3.3 — 주소 매핑은 공식 스펙으로 확인됐으므로 더 이상 BLOCKED가 아니다.
    expect(blocked.some((i) => i.field === "deliveryInfo (address mapping)")).toBe(false);
    // N-3.4 — 국산(00)으로 매칭됐고 수입사명도 필요 없으니 원산지 이슈는 없어야 한다.
    expect(result.issues.some((i) => i.field.startsWith("detailAttribute.originAreaInfo"))).toBe(false);
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
        originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
        originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
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
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
        originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
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
      sellerDeliveryFee: null,
      returnDeliveryFee: null,
      exchangeDeliveryFee: null,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
        originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
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

  it("N-3.47(옵션가 delta 의미 공식 확인) — 옵션이 있고 최종 판매가가 0원 미만이 되지 않으면 optionInfo는 READY다", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "사이즈", values: ["90", "100"] }];
    product.variants = [
      { id: "v1", optionValues: { 사이즈: "90" }, sku: "SKU-90", stockQuantity: 5, price: { amount: 10000, currency: "KRW" } },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
      refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
      sellerDeliveryFee: null,
      returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
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
        originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
      },
      true,
    );
    expect(result.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(true);
    // 이 케이스는 모든 옵션값이 채워져 있으니 완전성 이슈는 없어야 한다.
    expect(
      result.issues.some((i) => i.field === "detailAttribute.optionInfo.optionCombinations[].optionName"),
    ).toBe(false);
  });

  it("N-3.4: 옵션명은 있는데 특정 조합의 옵션값이 비어 있으면 MISSING을 추가로 표시한다", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "사이즈", values: ["90"] }];
    // 옵션 그룹은 있지만 variant에 해당 옵션값이 비어 있음(원본 파싱 일부 실패 시뮬레이션).
    product.variants = [{ id: "v1", optionValues: {}, sku: "SKU-90", stockQuantity: 5 }];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
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
        originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
      },
      false,
    );
    expect(
      result.issues.some(
        (i) =>
          i.field === "detailAttribute.optionInfo.optionCombinations[].optionName" && i.severity === "MISSING",
      ),
    ).toBe(true);
  });

  it("N-3.4: 원산지 텍스트를 확인하지 못했으면 originAreaCode가 MISSING", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
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
      originAreaCode: null,
      originAreaRequiresContent: false,
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
        originAreaCode: null,
        originAreaRequiresImporter: false,
      },
      false,
    );
    expect(
      result.issues.some(
        (i) => i.field === "detailAttribute.originAreaInfo.originAreaCode" && i.severity === "MISSING",
      ),
    ).toBe(true);
  });

  it("N-3.4: 원산지가 수입산으로 매칭되면 수입사명(importer)이 MISSING", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    // 실제 GET /v1/product-origin-areas 응답에서 확인한 "수입산:유럽>스페인" 코드.
    const spainCode = "0201025";
    const payload = buildNaverProductPayload({
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
      originAreaCode: spainCode,
      originAreaRequiresContent: false,
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
        originAreaCode: spainCode,
        originAreaRequiresImporter: true,
      },
      false,
    );
    expect(
      result.issues.some(
        (i) => i.field === "detailAttribute.originAreaInfo.importer" && i.severity === "MISSING",
      ),
    ).toBe(true);
    // originAreaCode 자체는 이미 매칭됐으니 그 필드에 대한 이슈는 없어야 한다.
    expect(
      result.issues.some(
        (i) => i.field === "detailAttribute.originAreaInfo.originAreaCode",
      ),
    ).toBe(false);
  });
});

/** N-3.5 — buildNaverProductPayload 호출 시 매번 반복되는 필수 파라미터를
 * 한 곳에 모은다(공통 값은 기존 PLACEHOLDER 상수 그대로 재사용, 개별 테스트는
 * 필요한 값만 override). */
function baseInput(product: CanonicalProduct, listing: ListingModel) {
  return {
    product,
    listing,
    leafCategoryId: LEAF_CATEGORY_ID,
    releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
    refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
    primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
    sellerDeliveryFee: null,
    returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
    exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
    originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
    originAreaRequiresContent: false,
  };
}

function baseValidateInput(product: CanonicalProduct) {
  return {
    product,
    releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
    refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
    primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
    returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
    exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
    returnCompaniesFetchFailed: false,
    originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
    originAreaRequiresImporter: false,
  };
}

describe("N-3.5: smartstoreChannelProduct 스키마 재검증", () => {
  it("channelProductDisplayStatusType은 WAIT가 아니라 유효한 값(SUSPENSION)을 쓴다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    // 공식 OpenAPI: "ON, SUSPENSION만 입력 가능합니다" — WAIT는 입력 불가능한 값이었다(N-3.5에서 발견한 버그 수정).
    expect(payload.smartstoreChannelProduct.channelProductDisplayStatusType).toBe("SUSPENSION");
    expect(payload.smartstoreChannelProduct.channelProductDisplayStatusType).not.toBe("WAIT");
  });

  // N-3.13 Part I(CPO 결정, 2026-08-12) — 이 필드는 등록 자체를 막는 요건이
  // 아니라 CartPilot 밖의 계정 상태(네이버쇼핑 광고주 여부)라 Gate 판단에서
  // 제외하기로 확정했다. 값을 채우지 않는다는 사실(추측 금지)은 그대로지만,
  // 더 이상 result.issues(등록 차단 목록)에는 안 들어가고 advisoryNotes로만
  // 나온다 — "등록을 막는다" ≠ "판매자가 알아야 한다"를 분리한 것.
  it("naverShoppingRegistration은 true로 명시 전송하고 advisory로만 표시한다 — Gate 판단(issues)에는 안 들어간다(N-3.84, 서버가 광고주 아니면 어차피 false로 강제 저장)", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.smartstoreChannelProduct.naverShoppingRegistration).toBe(true);
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(
      result.issues.some((i) => i.field === "smartstoreChannelProduct.naverShoppingRegistration"),
    ).toBe(false);
    expect(
      result.advisoryNotes.some(
        (f) => f.field === "smartstoreChannelProduct.naverShoppingRegistration" && f.status === "READY",
      ),
    ).toBe(true);
  });

  it("detailContent(상세설명)가 없으면 MISSING을 표시한다(N-3.5에서 새로 추가된 검사)", () => {
    const product = makeMinimalProduct();
    product.description = field("");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(
      result.issues.some((i) => i.field === "originProduct.detailContent" && i.severity === "MISSING"),
    ).toBe(true);
  });
});

describe("N-3.5: Final Validator — readyCount/missingCount/blockedCount", () => {
  it("Case A: 옵션 없는 일반 상품 — 배송/원산지/인증까지 전부 채워지면 옵션 관련 필드는 검사되지 않는다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(result.fields.some((f) => f.field.startsWith("detailAttribute.optionInfo"))).toBe(false);
    // N-3.13 Part I — advisory 필드(naverShoppingRegistration)는 fields에는
    // 남아있지만 readyCount/missingCount/blockedCount 집계에서는 빠진다.
    expect(result.readyCount + result.missingCount + result.blockedCount).toBe(
      result.fields.length - result.advisoryNotes.length,
    );
    // N-3.6(개정) — deliveryCompany는 이제 BLOCKED가 아니라 MISSING(Settings에서
    // 입력하면 해결됨)이다. 옵션/인증 관련 BLOCKED가 없는 이 케이스에서는
    // blockedCount가 0이어도 정상이다.
    expect(result.blockedCount).toBe(0);
    expect(result.missingCount).toBeGreaterThan(0);
    expect(result.ok).toBe(false);
  });

  it("Case B: Color × Size 2중 옵션 상품 — 4개 조합 모두 optionCombinations로 변환되고 옵션가(0원, delta 없음)로 READY 처리된다", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [
      { name: "색상", values: ["Navy", "White"] },
      { name: "사이즈", values: ["S", "M"] },
    ];
    product.variants = [
      { id: "v1", optionValues: { 색상: "Navy", 사이즈: "S" }, sku: "SKU-NAVY-S", stockQuantity: 2 },
      { id: "v2", optionValues: { 색상: "Navy", 사이즈: "M" }, sku: "SKU-NAVY-M", stockQuantity: 3 },
      { id: "v3", optionValues: { 색상: "White", 사이즈: "S" }, sku: "SKU-WHITE-S", stockQuantity: 1 },
      { id: "v4", optionValues: { 색상: "White", 사이즈: "M" }, sku: "SKU-WHITE-M", stockQuantity: 4 },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(4);
    expect(combos?.[0]).toMatchObject({ optionName1: "Navy", optionName2: "S", sellerManagerCode: "SKU-NAVY-S" });
    expect(combos?.[3]).toMatchObject({ optionName1: "White", optionName2: "M", sellerManagerCode: "SKU-WHITE-M" });
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(result.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(true);
  });

  it("Case D: 아동 인증 대상 상품 — 고시정보는 항상 존재하고, 인증서 항목만 BLOCKED로 분리된다(고시/인증 독립성 회귀)", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    // 인증 카탈로그 id가 없는 케이스(childCertificationInfoId: null) — "인증 필요 + 인증서 없음"
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: true,
    });
    // 고시정보(productInfoProvidedNotice)는 인증서 보유 여부와 무관하게 항상 채워져야 한다.
    expect(payload.originProduct.detailAttribute?.productInfoProvidedNotice).toBeDefined();
    expect(
      payload.originProduct.detailAttribute?.productInfoProvidedNotice?.productInfoProvidedNoticeType,
    ).toBe("KIDS");
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      true,
    );
    // 인증서 관련 필드만 BLOCKED — 고시정보 자체는 issues에 나타나지 않는다(항상 채워지므로).
    expect(result.issues.some((i) => i.field === "productCertificationInfos" && i.severity === "BLOCKED")).toBe(
      true,
    );
    expect(result.issues.some((i) => i.field.startsWith("originProduct.detailAttribute.productInfoProvidedNotice"))).toBe(
      false,
    );
  });

  it("인증 불필요 카테고리(WEAR)는 고시정보가 READY 상태로 존재하고 인증서 관련 이슈가 없다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(
      payload.originProduct.detailAttribute?.productInfoProvidedNotice?.productInfoProvidedNoticeType,
    ).toBe("WEAR");
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(result.fields.some((f) => f.field.startsWith("productCertificationInfos"))).toBe(false);
  });

  it("Case E: 여러 필드가 누락된 상품 — readyCount/missingCount/blockedCount가 정확히 필드 개수 합과 일치한다", () => {
    const product = makeMinimalProduct();
    product.description = field("");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: "",
      releaseAddressBookNo: null,
      refundAddressBookNo: null,
      primaryReturnDeliveryCompanyPriorityType: null,
      sellerDeliveryFee: null,
      returnDeliveryFee: null,
      exchangeDeliveryFee: null,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      originAreaCode: null,
      originAreaRequiresContent: false,
    });
    const result = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: null,
        refundAddressBookNo: null,
        primaryReturnDeliveryCompanyPriorityType: null,
        returnDeliveryFee: null,
        exchangeDeliveryFee: null,
        returnCompaniesFetchFailed: false,
        childCertificationInfoId: null,
        originAreaCode: null,
        originAreaRequiresImporter: false,
      },
      false,
    );
    // N-3.13 Part I — advisory 필드는 집계에서 빠진다(위 Case A와 동일 이유).
    expect(result.readyCount + result.missingCount + result.blockedCount).toBe(
      result.fields.length - result.advisoryNotes.length,
    );
    expect(result.missingCount).toBeGreaterThanOrEqual(8); // leafCategoryId/name(비었진 않음)/detailContent/salePrice(있음)/stock/... 등 다수
    expect(result.ok).toBe(false);
  });

  // N-3.71 — 이전에는 SIZE 옵션이 없는 상품(가방/액세서리 등)에서 size가
  // MISSING+optional:true로 표시돼도 ok:true였다. size는 이제 build-payload.ts가
  // SIZE 옵션이 없을 때 자동으로 "상세페이지 참조"를 채우므로(위 size 필드
  // 주석 참고) MISSING 자체가 발생하지 않는다 — material/color/manufacturer/
  // caution도 makeMinimalProduct에 이미 실제값이 있고, warrantyPolicy/
  // afterServiceDirector/afterServiceTelephoneNumber를 채우면 이 상품은
  // 고시정보 필드가 전부 READY라 missingCount는 0이어야 한다.
  it("Case F — deliveryCompany/warrantyPolicy/afterServiceDirector를 채우면 size(치수)도 자동 대체돼 고시정보 필드가 전부 READY, ok:true다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      deliveryCompany: "CJGLS",
      warrantyPolicy: "구매일로부터 1년",
      afterServiceDirector: "1544-0000",
      afterServiceTelephoneNumber: "1544-0000",
    });
    const result = validateNaverPayload(
      payload,
      {
        ...baseValidateInput(product),
        childCertificationInfoId: null,
        deliveryCompany: "CJGLS",
        warrantyPolicy: "구매일로부터 1년",
        afterServiceDirector: "1544-0000",
        afterServiceTelephoneNumber: "1544-0000",
      },
      false,
    );
    expect(result.blockedCount).toBe(0);
    expect(
      result.issues.some((i) => i.field === "productInfoProvidedNotice(WEAR).size" && i.severity === "MISSING"),
    ).toBe(false);
    const sizeField = result.fields.find((f) => f.field === "productInfoProvidedNotice(WEAR).size");
    expect(sizeField?.status).toBe("READY");
    expect(payload.originProduct.detailAttribute?.productInfoProvidedNotice).toMatchObject({
      wear: { size: "상품 상세페이지 참조" },
    });
    // 핵심 회귀 대상 — 필수/부가정보를 전부 채운 상품은 missingCount=0,
    // blockedCount=0, ok:true여야 한다.
    expect(result.missingCount).toBe(0);
    expect(result.ok).toBe(true);
    // advisory는 여전히 fields에는 남아있다(섹션 요약에서 보여야 하니까) — 다만
    // 카운트/ok에는 영향을 주지 않는다는 걸 같이 확인한다.
    expect(
      result.advisoryNotes.some((f) => f.field === "smartstoreChannelProduct.naverShoppingRegistration"),
    ).toBe(true);
  });

  // N-3.71(CPO 지시, 2026-08-21) — 이 테스트는 원래 2026-08-19 CEO 지시("치수
  // 뿐 아니라 필수가 아닌 값은 전부 optional로")를 코드로 고정해뒀었다. 그
  // 확장이 실제 프로덕션 등록에서 정확히 이 필드들(치수 제외 9개) 때문에
  // Naver HTTP 400을 유발한 원인이었다 — "상세페이지 참조 대체가 허용된다"는
  // 전제는 맞지만 필드를 아예 안 건드린 기본 상태(REQUIRED)까지 자동으로
  // 통과시켜서는 안 됐다. 이제 이 시나리오(소재/색상/제조자/세탁방법/
  // 품질보증/AS연락처/사용연령/품명/모델명/중량을 전부 비운 상태)는 반대로
  // ok:false여야 한다 — size만 예외로 자동 대체돼 READY가 된다(build-payload.ts
  // 폴백).
  it("Case G — 소재/색상/제조자/세탁방법/품질보증/AS연락처 등 고시 부가정보를 실제로 비우면(REQUIRED 상태, 상세페이지 참조 미선택) 등록을 막는다(ok:false) — size만 자동 대체로 예외", () => {
    const product = makeMinimalProduct();
    // 부가정보(고시 텍스트)를 전부 비운다 — 소재/색상/제조자/세탁방법.
    product.material = field("");
    product.color = field("");
    product.manufacturer = field("");
    product.careInstructions = field("");
    // KIDS 노티스 전용 부가정보도 비운다 — 사용연령/품명/모델명/중량
    // (certificationType은 KC라 이 테스트에서 categoryRequiresChildCertification:false로
    // 아예 검사 대상에서 빠진다).
    product.recommendedAge = field("");
    product.itemName = field("");
    product.modelName = field("");
    product.weight = field("");
    // 옵션 자체가 없다 — size는 build-payload.ts가 자동으로 "상세페이지
    // 참조"를 채우므로 이 필드만 예외적으로 READY가 된다.
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      deliveryCompany: "CJGLS",
      // warrantyPolicy/afterServiceDirector/afterServiceTelephoneNumber도
      // 비운다 — Settings 미설정 상태를 재현한다.
      warrantyPolicy: "",
      afterServiceDirector: "",
      afterServiceTelephoneNumber: "",
    });
    const result = validateNaverPayload(
      payload,
      {
        ...baseValidateInput(product),
        childCertificationInfoId: null,
        deliveryCompany: "CJGLS",
        warrantyPolicy: "",
        afterServiceDirector: "",
        afterServiceTelephoneNumber: "",
      },
      false,
    );
    expect(result.blockedCount).toBe(0);
    // material/color/manufacturer/caution/warrantyPolicy/afterServiceDirector/
    // afterServiceTelephoneNumber = 7개가 MISSING이어야 한다(size는 자동 대체돼
    // 빠진다).
    expect(result.missingCount).toBeGreaterThanOrEqual(7);
    // 핵심 회귀 대상 — N-3.71부터 optional:true인 MISSING 필드는 size뿐이다.
    // 나머지는 실제로 등록을 막아야 한다.
    const optionalMissingFields = result.fields.filter((f) => f.status === "MISSING" && f.optional);
    expect(optionalMissingFields.length).toBe(0);
    const sizeField = result.fields.find((f) => f.field === "productInfoProvidedNotice(WEAR).size");
    expect(sizeField?.status).toBe("READY");
    expect(result.ok).toBe(false);
  });
});

describe("N-3.32: 단일 SKU 옵션 판정 정합성(hasRealProductOptions)", () => {
  it("Test A — Shopify 단일 SKU(Default Title placeholder) → optionInfo BLOCKED 없음", () => {
    const product = makeMinimalProduct();
    // shopify-product-json.ts가 실제로 만드는 모양 그대로: 단일 그룹/단일 값,
    // variants는 이미 비어 있음(hasRealOptions=false 판정 후 extractor가 비움).
    product.optionGroups = [{ name: "Title", values: ["Default Title"] }];
    product.variants = [];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.optionInfo).toBeUndefined();
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(result.fields.some((f) => f.field.startsWith("detailAttribute.optionInfo"))).toBe(false);
    expect(result.blockedCount).toBe(0);
  });

  it("Test B — 실제 Color × Size 옵션(variant 2개 이상) → optionInfo READY(N-3.47 옵션가 delta 의미 확정 후)", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [
      { name: "색상", values: ["Navy", "White"] },
      { name: "사이즈", values: ["S", "M"] },
    ];
    product.variants = [
      { id: "v1", optionValues: { 색상: "Navy", 사이즈: "S" }, sku: "SKU-NAVY-S", stockQuantity: 2 },
      { id: "v2", optionValues: { 색상: "White", 사이즈: "M" }, sku: "SKU-WHITE-M", stockQuantity: 4 },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.optionInfo).toBeDefined();
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(result.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(
      true,
    );
  });

  it("Test C — N-3.28 회귀: 옵션 상품은 optionInfo도 size도 함께 READY로 유지된다(N-3.47 이후)", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "사이즈", values: ["100", "110"] }];
    product.variants = [
      { id: "v1", optionValues: { 사이즈: "100" }, sku: "SKU-100", stockQuantity: 5 },
      { id: "v2", optionValues: { 사이즈: "110" }, sku: "SKU-110", stockQuantity: 3 },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const noticeC = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(noticeC && "wear" in noticeC ? noticeC.wear.size : undefined).toBe("100, 110");
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(result.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(
      true,
    );
    expect(
      result.issues.some((i) => i.field === "productInfoProvidedNotice(WEAR).size" && i.severity === "MISSING"),
    ).toBe(false);
  });

  it("Test D — 옵션 없음(WEAR/KIDS) → optionInfo N/A, size는 자동으로 '상세페이지 참조'가 채워져 READY(N-3.71)", () => {
    const product = makeMinimalProduct();
    // makeMinimalProduct 기본값 그대로: optionGroups=[], variants=[].
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.optionInfo).toBeUndefined();
    const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice && "wear" in notice ? notice.wear.size : undefined).toBe("상품 상세페이지 참조");
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(result.fields.some((f) => f.field.startsWith("detailAttribute.optionInfo"))).toBe(false);
    expect(
      result.issues.some((i) => i.field === "productInfoProvidedNotice(WEAR).size" && i.severity === "MISSING"),
    ).toBe(false);
  });

  it("Case C(이상 데이터) — Default Title 모양이어도 실제 variant 레코드가 있으면 옵션 있음으로 판정하고 optionInfo를 검사 대상에 포함한다(N-3.47 이후 READY)", () => {
    const product = makeMinimalProduct();
    // 겉모양은 placeholder(그룹 1개, 값 1개)와 같지만 variants에 실제 레코드가
    // 있는 비정상 조합 — CPO 지시(Case C): 추측해서 옵션 없음으로 지우지 않는다.
    product.optionGroups = [{ name: "Title", values: ["Default Title"] }];
    product.variants = [{ id: "v1", optionValues: {}, sku: "SKU-1", stockQuantity: 5 }];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.optionInfo).toBeDefined();
    const result = validateNaverPayload(
      payload,
      { ...baseValidateInput(product), childCertificationInfoId: null },
      false,
    );
    expect(result.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(
      true,
    );
  });
});

/**
 * N-3.78 STEP2(CPO 지시, 2026-08-22, 골든 E2E 기준상품 13730591182) — Color+Size
 * 복합 옵션 검증. Case A(Size 단일)는 이미 "N-3.4"(위, 328행)와 "Test C"(1206행)가
 * 커버하므로 여기서 다시 만들지 않는다(CPO 지시: 테스트 개수를 억지로 맞추지
 * 않는다). 여기서는 아직 존재하지 않던 케이스만 추가한다: Color 단일축(B),
 * Color+Size 2축 가격/재고/SKU 완전 독립성(C, CPO 지정 스펙), 3축(D)과 4축
 * 상한(D-확장), 그리고 세 가지 예외 케이스(E/F/G, "판단만 하고 임의로 고치지
 * 않는다"는 지시에 따라 현재 동작을 고정하는 회귀 테스트로만 작성)와 중복
 * 조합(H).
 */
describe("N-3.78 STEP2 — Color + Size 복합 옵션 검증", () => {
  it("Case B — Color 단일 옵션(3값)은 optionName1에만 채워지고 optionName2/3는 비어 있다", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "Color", values: ["Red", "Blue", "Green"] }];
    product.variants = [
      { id: "v1", optionValues: { Color: "Red" }, sku: "SKU-RED", stockQuantity: 7 },
      { id: "v2", optionValues: { Color: "Blue" }, sku: "SKU-BLUE", stockQuantity: 3 },
      { id: "v3", optionValues: { Color: "Green" }, sku: "SKU-GREEN", stockQuantity: 5 },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const groupNames = payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames;
    expect(groupNames).toEqual({ optionGroupName1: "Color" });
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(3);
    expect(combos?.[0]).toMatchObject({ optionName1: "Red", sellerManagerCode: "SKU-RED", stockQuantity: 7 });
    expect(combos?.[0].optionName2).toBeUndefined();
    expect(combos?.[2]).toMatchObject({ optionName1: "Green", sellerManagerCode: "SKU-GREEN", stockQuantity: 5 });
  });

  it("Case C — Color × Size 2축(4개 조합)의 가격/재고/SKU가 조합별로 완전히 독립적으로 보존된다(CPO 지정 스펙)", () => {
    const product = makeMinimalProduct();
    product.price = field({ amount: 10000, currency: "KRW" });
    product.optionGroups = [
      { name: "Color", values: ["Red", "Blue"] },
      { name: "Size", values: ["S", "M"] },
    ];
    product.variants = [
      {
        id: "v1",
        optionValues: { Color: "Red", Size: "S" },
        sku: "RED-S",
        stockQuantity: 10,
        price: { amount: 10000, currency: "KRW" },
      },
      {
        id: "v2",
        optionValues: { Color: "Red", Size: "M" },
        sku: "RED-M",
        stockQuantity: 20,
        price: { amount: 11000, currency: "KRW" },
      },
      {
        id: "v3",
        optionValues: { Color: "Blue", Size: "S" },
        sku: "BLUE-S",
        stockQuantity: 15,
        price: { amount: 10000, currency: "KRW" },
      },
      {
        id: "v4",
        optionValues: { Color: "Blue", Size: "M" },
        sku: "BLUE-M",
        stockQuantity: 5,
        price: { amount: 11000, currency: "KRW" },
      },
    ];
    // listing.priceKrw(makeMinimalListing 기본값 10000)를 product.price(10000)와
    // 일치시켜 delta 계산의 기준(base)을 명확히 한다 — M 사이즈(11000)는
    // +1000, S 사이즈(10000)는 +0이 되어야 한다.
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const groupNames = payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames;
    expect(groupNames).toEqual({ optionGroupName1: "Color", optionGroupName2: "Size" });
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(4);
    expect(combos?.[0]).toMatchObject({
      optionName1: "Red",
      optionName2: "S",
      sellerManagerCode: "RED-S",
      stockQuantity: 10,
      price: 0,
    });
    expect(combos?.[1]).toMatchObject({
      optionName1: "Red",
      optionName2: "M",
      sellerManagerCode: "RED-M",
      stockQuantity: 20,
      price: 1000,
    });
    expect(combos?.[2]).toMatchObject({
      optionName1: "Blue",
      optionName2: "S",
      sellerManagerCode: "BLUE-S",
      stockQuantity: 15,
      price: 0,
    });
    expect(combos?.[3]).toMatchObject({
      optionName1: "Blue",
      optionName2: "M",
      sellerManagerCode: "BLUE-M",
      stockQuantity: 5,
      price: 1000,
    });
  });

  it("Case D — Color × Size × Material 3축(8개 조합) → optionName1/2/3 모두 정확히 매핑된다", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [
      { name: "Color", values: ["Red", "Blue"] },
      { name: "Size", values: ["S", "M"] },
      { name: "Material", values: ["Cotton", "Wool"] },
    ];
    product.variants = [
      { id: "v1", optionValues: { Color: "Red", Size: "S", Material: "Cotton" }, sku: "R-S-C", stockQuantity: 1 },
      { id: "v2", optionValues: { Color: "Red", Size: "S", Material: "Wool" }, sku: "R-S-W", stockQuantity: 2 },
      { id: "v3", optionValues: { Color: "Red", Size: "M", Material: "Cotton" }, sku: "R-M-C", stockQuantity: 3 },
      { id: "v4", optionValues: { Color: "Red", Size: "M", Material: "Wool" }, sku: "R-M-W", stockQuantity: 4 },
      { id: "v5", optionValues: { Color: "Blue", Size: "S", Material: "Cotton" }, sku: "B-S-C", stockQuantity: 5 },
      { id: "v6", optionValues: { Color: "Blue", Size: "S", Material: "Wool" }, sku: "B-S-W", stockQuantity: 6 },
      { id: "v7", optionValues: { Color: "Blue", Size: "M", Material: "Cotton" }, sku: "B-M-C", stockQuantity: 7 },
      { id: "v8", optionValues: { Color: "Blue", Size: "M", Material: "Wool" }, sku: "B-M-W", stockQuantity: 8 },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const groupNames = payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames;
    expect(groupNames).toEqual({ optionGroupName1: "Color", optionGroupName2: "Size", optionGroupName3: "Material" });
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(8);
    expect(combos?.[0]).toMatchObject({
      optionName1: "Red",
      optionName2: "S",
      optionName3: "Cotton",
      sellerManagerCode: "R-S-C",
      stockQuantity: 1,
    });
    expect(combos?.[7]).toMatchObject({
      optionName1: "Blue",
      optionName2: "M",
      optionName3: "Wool",
      sellerManagerCode: "B-M-W",
      stockQuantity: 8,
    });
  });

  it("Case D-확장(4축 시도) — 4번째 optionGroup은 에러 없이 조용히 무시된다(Naver 3축 상한, N-3.50 회귀 확인)", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [
      { name: "Color", values: ["Red"] },
      { name: "Size", values: ["S"] },
      { name: "Material", values: ["Cotton"] },
      { name: "Season", values: ["Winter"] },
    ];
    product.variants = [
      {
        id: "v1",
        optionValues: { Color: "Red", Size: "S", Material: "Cotton", Season: "Winter" },
        sku: "SKU-1",
        stockQuantity: 1,
      },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    const groupNames = payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames;
    expect(groupNames).toEqual({ optionGroupName1: "Color", optionGroupName2: "Size", optionGroupName3: "Material" });
    expect(Object.keys(groupNames ?? {})).toHaveLength(3);
    const combo = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations?.[0];
    expect(combo).toMatchObject({ optionName1: "Red", optionName2: "S", optionName3: "Cotton" });
    expect((combo as unknown as Record<string, unknown>).optionName4).toBeUndefined();
  });

  it("Case E(예외, N-3.82에서 수정) — optionGroups는 있는데 variants가 비어 있으면 optionInfo 자체를 생략한다", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "Size", values: ["S", "M", "L"] }];
    product.variants = [];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    // N-3.82(CPO 지시) — N-3.78 STEP2에서 발견한 버그 수정: variants가 비어
    // 있으면 optionGroups 내용과 무관하게 "옵션 없음"으로 판정한다. 예전엔
    // optionCombinationGroupNames만 채워지고 optionCombinations는 빈 배열인
    // 깨진 모양이 나갔는데, 이제는 optionInfo 블록 자체를 생략한다(빈 옵션을
    // 보내느니 옵션 섹션을 아예 안 보내는 게 안전).
    expect(payload.originProduct.detailAttribute?.optionInfo).toBeUndefined();
  });

  it("Case F(예외) — optionGroups가 비어 있고 variants만 있으면 optionInfo는 생성되지만 optionName1/2/3이 전부 없는 조합이 나온다", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [];
    product.variants = [
      { id: "v1", optionValues: {}, sku: "SKU-1", stockQuantity: 5 },
      { id: "v2", optionValues: {}, sku: "SKU-2", stockQuantity: 3 },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.optionInfo).toBeDefined();
    expect(payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames).toEqual({});
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(2);
    expect(combos?.[0].optionName1).toBeUndefined();
    expect(combos?.[0].optionName2).toBeUndefined();
    expect(combos?.[0].optionName3).toBeUndefined();
    expect(combos?.[0]).toMatchObject({ sellerManagerCode: "SKU-1", stockQuantity: 5 });
  });

  it("Case G(예외) — optionGroups 이름과 variant.optionValues 키가 서로 다르면 에러 없이 빈 값으로 채워진다(오조합 침묵 처리)", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "색상", values: ["Navy", "White"] }];
    // variant.optionValues 키가 "색상"이 아니라 영문 "Color"로 저장된 이상
    // 케이스(원본 파싱 단계에서 그룹명과 variant 키가 어긋난 경우를 재현).
    product.variants = [
      { id: "v1", optionValues: { Color: "Navy" }, sku: "SKU-1", stockQuantity: 5 },
      { id: "v2", optionValues: { Color: "White" }, sku: "SKU-2", stockQuantity: 3 },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    // groupNames.map(name => variant.optionValues[name] ?? "")는 키가 없으면
    // 조용히 빈 문자열로 대체한다 — BLOCKED나 에러가 아니라 optionName1이
    // 그냥 없는 채로(빈 문자열은 falsy라 if(values[0])에서 걸러짐) 조합만
    // 남는다.
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(2);
    expect(combos?.[0].optionName1).toBeUndefined();
    expect(combos?.[0]).toMatchObject({ sellerManagerCode: "SKU-1", stockQuantity: 5 });
    // groupNames 자체는 optionGroups 기준이라 정상적으로 "색상"이 채워진다 —
    // payload는 "색상"이라는 축 이름은 선언하지만 실제 조합에는 그 축의 값이
    // 하나도 없는 불일치 상태가 된다(Case E와 유사한 패턴).
    expect(payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames).toEqual({
      optionGroupName1: "색상",
    });
  });

  it("Case H(예외) — 동일한 옵션조합을 가진 variant가 2개면 중복 제거 없이 그대로 2개 조합이 생성된다(dedup 로직 없음 확인)", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "Size", values: ["S"] }];
    product.variants = [
      { id: "v1", optionValues: { Size: "S" }, sku: "SKU-DUP-1", stockQuantity: 5 },
      { id: "v2", optionValues: { Size: "S" }, sku: "SKU-DUP-2", stockQuantity: 3 },
    ];
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    // buildOptionCombinations는 variants.map()으로 1:1 변환만 하고 중복 병합
    // 로직이 없다 — 같은 "S" 조합이 판매자관리코드만 다른 채 2개 그대로
    // 나간다.
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    expect(combos).toHaveLength(2);
    expect(combos?.[0]).toMatchObject({ optionName1: "S", sellerManagerCode: "SKU-DUP-1" });
    expect(combos?.[1]).toMatchObject({ optionName1: "S", sellerManagerCode: "SKU-DUP-2" });
  });
});

/**
 * N-3.13 Part J(J-6 — CPO 지시: "텍스트/이미지/공통이미지 3개 왕복 테스트 —
 * 이 3개가 모두 실제 JSON에서 확인되어야 한다") — detailBlocks가 있을 때
 * detailContent가 Coupang과 같은 assembleContentsFromBlocks 조립 결과를
 * 그대로 반영하는지 검증한다. 브라우저로 직접 확인한 production 실측
 * (/api/naver/resolve의 detailPage가 실제 DescriptionTemplate/SellerProfile
 * 공통이미지를 반환하는 것)과 이 단위 테스트를 합쳐서 "텍스트 블록 →
 * <p>", "PRODUCT_IMAGES 블록 → <img>", "공통이미지 ON → <img> 포함/OFF →
 * 미포함"까지 왕복 확인한다.
 */
describe("buildNaverProductPayload — detailBlocks → detailContent 조립(Part J)", () => {
  const COMMON_IMAGE_ON = {
    topCommonImageUrl: "https://example.com/top-common.jpg",
    topCommonImageEnabled: true,
    bottomCommonImageUrl: "https://example.com/bottom-common.jpg",
    bottomCommonImageEnabled: true,
  };

  function buildWithBlocks(detailBlocks: Parameters<typeof buildNaverProductPayload>[0]["detailBlocks"], overrides: Partial<Parameters<typeof buildNaverProductPayload>[0]> = {}) {
    const product = makeMinimalProduct();
    product.images.push({
      id: "img-2",
      originalUrl: "https://example.com/images/tshirt-detail.jpg",
      selectedVariant: "ORIGINAL",
      isRepresentative: false,
      useInProductGallery: false,
      useInDescription: true,
      classification: "PRODUCT",
    });
    const listing = makeMinimalListing(product);
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
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
      originAreaCode: PLACEHOLDER_ORIGIN_AREA_CODE,
      originAreaRequiresContent: false,
      detailBlocks,
      ...overrides,
    });
  }

  it("Test A(텍스트) — AI_DESCRIPTION 블록이 <p> 문단으로 조립된다", () => {
    const payload = buildWithBlocks([{ id: "b1", kind: "AI_DESCRIPTION", enabled: true }]);
    expect(payload.originProduct.detailContent).toBe("<p>아동용 반팔 티셔츠입니다.</p>");
  });

  it("Test B(이미지) — PRODUCT_IMAGES 블록이 각각 <img> 태그로 조립된다", () => {
    const payload = buildWithBlocks([{ id: "b1", kind: "PRODUCT_IMAGES", enabled: true }]);
    expect(payload.originProduct.detailContent).toBe(
      '<img src="https://example.com/images/tshirt-detail.jpg" style="max-width:100%;">',
    );
  });

  it("Test C(공통이미지 ON) — COMMON_IMAGE 블록이 ON이면 <img>가 포함된다", () => {
    const payload = buildWithBlocks(
      [{ id: "b1", kind: "COMMON_IMAGE", position: "top", enabled: true }],
      { commonImages: COMMON_IMAGE_ON },
    );
    expect(payload.originProduct.detailContent).toContain('<img src="https://example.com/top-common.jpg"');
  });

  it("Test C(공통이미지 OFF) — Settings에서 OFF면 같은 블록이 있어도 detailContent에서 빠진다", () => {
    const payload = buildWithBlocks(
      [{ id: "b1", kind: "COMMON_IMAGE", position: "top", enabled: true }],
      { commonImages: { ...COMMON_IMAGE_ON, topCommonImageEnabled: false } },
    );
    expect(payload.originProduct.detailContent).toBe("");
  });

  it("3개 블록이 한 번에 있으면 순서대로 모두 조립된다(텍스트 → 이미지 → 공통이미지)", () => {
    const payload = buildWithBlocks(
      [
        { id: "b1", kind: "AI_DESCRIPTION", enabled: true },
        { id: "b2", kind: "PRODUCT_IMAGES", enabled: true },
        { id: "b3", kind: "COMMON_IMAGE", position: "bottom", enabled: true },
      ],
      { commonImages: COMMON_IMAGE_ON },
    );
    expect(payload.originProduct.detailContent).toBe(
      '<p>아동용 반팔 티셔츠입니다.</p>\n<img src="https://example.com/images/tshirt-detail.jpg" style="max-width:100%;">\n<img src="https://example.com/bottom-common.jpg" style="max-width:100%;">',
    );
  });

  it("detailBlocks가 없으면(에디터를 안 연 세션) 기존처럼 listing.description을 그대로 쓴다(회귀 없음)", () => {
    const payload = buildWithBlocks(undefined);
    expect(payload.originProduct.detailContent).toBe("아동용 반팔 티셔츠입니다.");
  });
});

/**
 * N-3.65(2026-08-20, CPO 지시: "modelName은 지금 바로 수정") — 실제 등록에서
 * naverShoppingSearchInfo.modelName이 NotEmpty로 거부됐다("어린이인증 대상
 * 카테고리 상품은 카탈로그 입력이 필수입니다"). 원문 설명에 실제로 "Product
 * code XXXX" 문구가 있을 때만(임의 값 금지) 그 코드를 추출해 이 필드에
 * 채운다 — Bobo Choses 실측(2026-08-20)에서 확인한 실제 문구 형태를 그대로
 * 픽스처로 쓴다.
 */
describe("resolveModelNameFromDescription", () => {
  it("실제 원문에 'Product code XXXX'가 있으면 그 코드만 추출한다(실측 문구 그대로)", () => {
    expect(
      resolveModelNameFromDescription(
        "Bobo Choses Color Block Zipped Sweatshirt. 72% Organic Cotton, 28% Recycled Polyester. Product code B126AC050 SS26 Made in Spain.",
      ),
    ).toBe("B126AC050 SS26");
  });

  it("'Product code' 뒤에 코드 하나만 있고 바로 마침표로 끝나도 정상 추출한다", () => {
    expect(resolveModelNameFromDescription("Some description. Product code AB123.")).toBe("AB123");
  });

  it("원문에 'Product code' 문구 자체가 없으면 undefined를 돌려준다(임의 값 생성 금지)", () => {
    expect(resolveModelNameFromDescription("그냥 평범한 상품 설명입니다.")).toBeUndefined();
  });

  it("설명 자체가 없으면(undefined) undefined를 돌려준다", () => {
    expect(resolveModelNameFromDescription(undefined)).toBeUndefined();
  });
});

describe("buildNaverProductPayload — naverShoppingSearchInfo.modelName 연결(N-3.65)", () => {
  it("실제 원문에 Product code가 있으면 naverShoppingSearchInfo.modelName에 그대로 들어간다", () => {
    const product = makeMinimalProduct();
    product.description = field(
      "Bobo Choses Color Block Zipped Sweatshirt. Product code B126AC050 SS26 Made in Spain.",
    );
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    // N-3.76(2차) — manufacturerName/brandName도 이제 이 필드로 함께 연결된다
    // (makeMinimalProduct의 기본 브랜드/제조사 값 그대로).
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo).toEqual({
      modelName: "B126AC050 SS26",
      manufacturerName: "Test Manufacturer",
      brandName: "TestBrand",
    });
  });

  it("원문에 Product code가 없어도 브랜드/제조사가 있으면 naverShoppingSearchInfo가 그 값으로 채워진다(N-3.76 2차)", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo).toEqual({
      modelName: undefined,
      manufacturerName: "Test Manufacturer",
      brandName: "TestBrand",
    });
  });

  it("브랜드/제조사/Product code 전부 없으면 naverShoppingSearchInfo 자체를 만들지 않는다(임의 값 금지)", () => {
    const product = makeMinimalProduct();
    product.brand = field("");
    product.manufacturer = field("");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo).toBeUndefined();
  });
});

/**
 * N-3.83(CPO 지시, "SmartStore 기본정보 완성" 감사에서 발견) — Coupang은
 * build-payload.ts:1102에서 이미 product.manufacturer.value || brandProfile?.
 * manufacturer || sellerConfig.manufacturer 3단계 폴백을 쓰고 있었는데, Naver
 * 쪽은 이 파일이 resolvedManufacturer를 몰라 product.manufacturer만 봤다 —
 * 크롤러가 제조사를 못 찾은 상품(흔한 경우)은 항상 빈칸이었다. resolve-context.ts
 * 가 brandProfile/sellerProfile에서 미리 계산해 이 필드로 넘겨주는 값을
 * 폴백으로 쓰도록 고쳤다(호출부가 이미 계산한 값을 그대로 받는다는 기존
 * 원칙 유지 — 이 파일은 DB를 조회하지 않는다).
 */
describe("buildNaverProductPayload — manufacturer 3단계 폴백(N-3.83)", () => {
  it("product.manufacturer.value(원문 추출값)가 있으면 resolvedManufacturer가 있어도 원문값이 항상 우선한다", () => {
    const product = makeMinimalProduct();
    // makeMinimalProduct 기본값 "Test Manufacturer" 그대로(원문 추출값).
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      resolvedManufacturer: "브랜드기본값 제조사",
    });
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo?.manufacturerName).toBe(
      "Test Manufacturer",
    );
    const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice && "wear" in notice ? notice.wear.manufacturer : undefined).toBe("Test Manufacturer");
  });

  it("product.manufacturer.value가 비어 있으면 resolvedManufacturer(브랜드/Seller 기본값)로 보충한다", () => {
    const product = makeMinimalProduct();
    product.manufacturer = field("");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      resolvedManufacturer: "브랜드기본값 제조사",
    });
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo?.manufacturerName).toBe(
      "브랜드기본값 제조사",
    );
    const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice && "wear" in notice ? notice.wear.manufacturer : undefined).toBe("브랜드기본값 제조사");
  });

  it("product.manufacturer.value도 resolvedManufacturer도 둘 다 없으면 임의 값을 만들지 않는다", () => {
    const product = makeMinimalProduct();
    product.manufacturer = field("");
    product.brand = field("");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      resolvedManufacturer: null,
    });
    // brand도 비었으므로 modelName/manufacturerName/brandName 전부 없어
    // naverShoppingSearchInfo 자체가 undefined다(기존 "임의 값 금지" 규칙 유지).
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo).toBeUndefined();
    const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice && "wear" in notice ? notice.wear.manufacturer : undefined).toBeUndefined();
  });

  it("resolvedManufacturer를 아예 안 넘겨도(undefined) 기존처럼 product.manufacturer.value만으로 동작한다(회귀 없음)", () => {
    const product = makeMinimalProduct();
    // makeMinimalProduct 기본값 "Test Manufacturer" 그대로.
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.detailAttribute?.naverShoppingSearchInfo?.manufacturerName).toBe(
      "Test Manufacturer",
    );
  });
});

describe("buildNaverProductPayload — sellerManagementCode 연결(N-3.84)", () => {
  it("product.sku.value(원본 페이지에서 실제 추출된 값)가 있으면 그대로 들어간다", () => {
    const product = makeMinimalProduct();
    // makeMinimalProduct 기본값 sku="KIDS-TSHIRT-1".
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.sellerManagementCode).toBe("KIDS-TSHIRT-1");
  });

  it("product.sku.value가 비어 있으면 임의 코드를 만들지 않고 생략한다", () => {
    const product = makeMinimalProduct();
    product.sku = field("");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.sellerManagementCode).toBeUndefined();
  });
});

describe("buildNaverProductPayload — 묶음배송 고정 정책(N-3.85 STEP5)", () => {
  it("모든 상품에 deliveryBundleGroupUsable=true, deliveryBundleGroupId=null을 고정 전송한다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.deliveryInfo?.deliveryBundleGroupUsable).toBe(true);
    expect(payload.originProduct.deliveryInfo?.deliveryBundleGroupId).toBeNull();
  });
});

describe("buildNaverProductPayload — resolvedAttributes 연결(N-4.00 A-2)", () => {
  it("resolvedAttributes가 있으면 detailAttribute.productAttributes에 그대로 들어간다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      resolvedAttributes: [{ attributeSeq: 10012917, attributeValueSeq: 10500182 }],
    });
    expect(payload.originProduct.detailAttribute?.productAttributes).toEqual([
      { attributeSeq: 10012917, attributeValueSeq: 10500182 },
    ]);
  });

  it("resolvedAttributes가 빈 배열이거나 없으면 productAttributes 자체를 생략한다(임의 빈 배열 전송 금지)", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payloadWithoutField = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payloadWithoutField.originProduct.detailAttribute?.productAttributes).toBeUndefined();

    const payloadWithEmpty = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      resolvedAttributes: [],
    });
    expect(payloadWithEmpty.originProduct.detailAttribute?.productAttributes).toBeUndefined();
  });
});

describe("buildNaverProductPayload — productCertificationInfos.name 연결(N-3.67)", () => {
  it("childCertification.value.name이 있으면 productCertificationInfos[0].name에 그대로 들어간다", () => {
    const product = makeMinimalProduct();
    product.childCertification = field({
      name: "한국의류시험연구원",
      certificationNumber: "CB123456",
      companyName: "테스트컴퍼니",
      certificationDate: "2024-01-01",
    });
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
    });
    expect(payload.originProduct.detailAttribute?.productCertificationInfos).toEqual([
      {
        certificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
        certificationKindType: "CHILD_CERTIFICATION",
        name: "한국의류시험연구원",
        certificationNumber: "CB123456",
        companyName: "테스트컴퍼니",
        certificationDate: "2024-01-01",
      },
    ]);
  });

  it("childCertification.value.name이 없으면(빈 값) name 필드 자체를 만들지 않는다(임의 값 금지)", () => {
    const product = makeMinimalProduct();
    product.childCertification = field({
      name: "",
      certificationNumber: "CB123456",
      companyName: "테스트컴퍼니",
      certificationDate: "2024-01-01",
    });
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      categoryRequiresChildCertification: true,
    });
    expect(payload.originProduct.detailAttribute?.productCertificationInfos?.[0].name).toBeUndefined();
  });
});

/**
 * N-3.69(CPO 지시, "Seller 공통 설정 통합" work order STEP1/STEP9) — Coupang은
 * 이미 sellerConfig.deliveryCharge를 읽는데 Naver는 deliveryFee를 항상 FREE/0로
 * 고정해뒀던 갭을 막는 회귀 테스트. SellerProfile 공통 배송비가 실제로 SmartStore
 * payload에 반영되는지, 그리고 미설정 시 기존(Golden Fixture) FREE 동작이
 * 그대로 유지되는지를 확인한다.
 */
describe("buildNaverProductPayload — deliveryFee (SellerProfile.deliveryCharge 연동, N-3.69)", () => {
  it("product.shippingFee가 아직 DEFAULT이고 sellerDeliveryFee가 있으면 PAID/baseFee로 반영한다", () => {
    const product = makeMinimalProduct();
    product.shippingFee = field(0, "DEFAULT");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      sellerDeliveryFee: 3500,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.deliveryInfo?.deliveryFee).toEqual({
      deliveryFeeType: "PAID",
      baseFee: 3500,
      deliveryFeePayType: "PREPAID",
    });
  });

  it("sellerDeliveryFee가 null이면(SellerProfile 미설정) 기존과 동일하게 FREE/0을 유지한다(Golden Fixture 보호)", () => {
    const product = makeMinimalProduct();
    product.shippingFee = field(0, "DEFAULT");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      sellerDeliveryFee: null,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.deliveryInfo?.deliveryFee).toEqual({
      deliveryFeeType: "FREE",
      baseFee: 0,
    });
  });

  it("product.shippingFee가 사용자 편집값(DEFAULT 아님)이면 sellerDeliveryFee보다 우선한다", () => {
    const product = makeMinimalProduct();
    product.shippingFee = field(5000, "USER_EDITED");
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      sellerDeliveryFee: 3500,
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.originProduct.deliveryInfo?.deliveryFee).toEqual({
      deliveryFeeType: "PAID",
      baseFee: 5000,
      deliveryFeePayType: "PREPAID",
    });
  });
});

/**
 * N-3.77 STEP2/3(CPO 작업지시서 N-3.77) — SmartStore SEO 상품명 생성기 검증.
 * STEP3의 "최소 5개 상품 Dry Run" 요구를 실제 네트워크 호출 없이(vitest,
 * buildNaverProductPayload/validateNaverPayload는 순수 함수라 API를 호출하지
 * 않는다) 5개 시나리오로 재현한다 — KIDS 의류/KIDS 모자(시즌 포함)/옵션
 * 여러 개/색상+사이즈/옵션 없음. "기존 성공 상품과 비교"(golden-success-02-kids.json,
 * 실제 originProductNo=13667626779/13667627489)의 원문 조건(Bobo Choses,
 * jupeiris.com, KIDS 카테고리)을 최대한 그대로 재현해 새 Resolver가 만든
 * 이름을 확인한다 — 그 fixture는 최종 payload만 저장돼 있어 원문 input을
 * 1:1로 복원할 수는 없지만, 같은 브랜드/카테고리/연령대 신호로 구성했다.
 */
describe("generateSmartStoreProductName — N-3.77 STEP2", () => {
  it("resolveSeasonFromText: 'SS26'처럼 원문에 실제로 있는 시즌 코드만 추출한다(연도+계절 순서로 정규화)", () => {
    expect(resolveSeasonFromText("Product code B126AC050 SS26 Made in Spain.")).toBe("26SS");
    expect(resolveSeasonFromText("26FW 신상 컬렉션")).toBe("26FW");
    expect(resolveSeasonFromText("FW26 collection")).toBe("26FW");
  });

  it("resolveSeasonFromText: 시즌 코드가 원문에 없으면 undefined(추정 금지)", () => {
    expect(resolveSeasonFromText("그냥 평범한 설명입니다.")).toBeUndefined();
    expect(resolveSeasonFromText(undefined)).toBeUndefined();
  });

  it("KIDS 의류(연령대 신호=recommendedAge) — 브랜드+키즈+핵심명으로 구성되고 원문에 없는 시즌은 넣지 않는다", () => {
    const product = makeMinimalProduct();
    product.brand = field("Bobo Choses");
    product.title = field("Stamp Bloom All Over Denim Pants");
    product.description = field("Stamp Bloom All Over Denim Pants. 72% Organic Cotton, 28% Recycled Polyester.");
    product.recommendedAge = field("3-4 Years");
    const name = generateSmartStoreProductName(product);
    expect(name).toContain("Bobo Choses");
    expect(name).toContain("키즈");
    expect(name).toContain("Stamp Bloom All Over Denim Pants");
    expect(name).not.toMatch(/\d{2}(SS|FW|AW)/); // 원문에 시즌 코드가 없으므로 만들어내지 않는다
  });

  it("KIDS 모자(시즌 코드가 원문에 실제로 있는 경우) — golden-success-02-kids.json과 같은 브랜드/카테고리 조건", () => {
    const product = makeMinimalProduct();
    product.brand = field("Bobo Choses");
    product.title = field("Wool Blend Cap B Logo Baseball Cap");
    product.description = field(
      "Wool Blend Cap B Logo Baseball Cap. Product code B126AC050 26FW Made in Spain.",
    );
    product.recommendedAge = field("4-5 Years, 6-7 Years, 8-9 Years");
    const name = generateSmartStoreProductName(product);
    expect(name).toContain("Bobo Choses");
    expect(name).toContain("26FW");
    expect(name).toContain("키즈");
    expect(name).toContain("Wool Blend Cap B Logo Baseball Cap");
    // 기존(수정 전) 상품명은 listing.title 그대로였다 — 브랜드/시즌/타겟이 없었다.
    const listing = makeMinimalListing(product);
    expect(name).not.toBe(listing.title);
  });

  it("옵션이 여러 개인 상품 — 옵션 구성과 무관하게 상품명 생성기는 정상 동작한다(중복 단어 없음, 100자 이내)", () => {
    const product = makeMinimalProduct();
    product.brand = field("TestBrand");
    product.title = field("TestBrand Color Block Zip Hoodie");
    product.optionGroups = [
      { name: "Size", values: ["4-5Y", "6-7Y", "8-9Y"] },
      { name: "Color", values: ["Navy", "Beige"] },
    ];
    const name = generateSmartStoreProductName(product);
    const words = name.split(" ");
    expect(new Set(words.map((w) => w.toLowerCase())).size).toBe(words.length); // 단어 중복 없음
    expect(name.length).toBeLessThanOrEqual(100);
  });

  it("색상+사이즈 옵션 상품 — 성인 여성 신호(gender=women)면 '여성'을 타겟으로 붙인다", () => {
    const product = makeMinimalProduct();
    // makeMinimalProduct()의 기본 sourceUrl("/products/kids-tshirt")은 URL
    // 세그먼트 자체가 나이 신호라 이 케이스(성인)에는 맞지 않는다 — 덮어쓴다.
    product.sourceUrl = "https://example.com/products/womens-wool-coat-adult";
    product.brand = field("TestBrand");
    product.title = field("Women's Wool Coat");
    product.recommendedAge = field(""); // 성인 — 연령대 신호 없음
    product.description = field("A women's wool coat for the winter season.");
    const name = generateSmartStoreProductName(product);
    expect(name).toContain("TestBrand");
    expect(name).toContain("여성");
  });

  it("옵션이 없는 상품(성인, 성별/연령 신호 모두 unknown) — 타겟 단어 없이 브랜드+핵심명만 조합한다", () => {
    const product = makeMinimalProduct();
    product.sourceUrl = "https://example.com/products/ceramic-mug-adult";
    product.brand = field("TestBrand");
    product.title = field("Ceramic Coffee Mug");
    product.recommendedAge = field("");
    product.description = field("A simple ceramic coffee mug.");
    product.optionGroups = [];
    const name = generateSmartStoreProductName(product);
    expect(name).toBe("TestBrand Ceramic Coffee Mug");
  });

  it("100자 제한 — 넘으면 단어 단위로 뒤에서부터 잘라낸다(글자 중간 절단 금지)", () => {
    const product = makeMinimalProduct();
    product.sourceUrl = "https://example.com/products/long-title-adult";
    product.recommendedAge = field("");
    product.brand = field("VeryLongBrandNameForTestingPurposesOnly");
    product.title = field(
      "An Extremely Long Product Title That Should Definitely Exceed The Naver Product Name Character Limit Of One Hundred",
    );
    const name = generateSmartStoreProductName(product);
    expect(name.length).toBeLessThanOrEqual(100);
    expect(name.endsWith(" ")).toBe(false);
    for (const word of name.split(" ")) {
      expect(product.title.value + " " + product.brand.value).toContain(word);
    }
  });

  it("buildNaverProductPayload 5개 시나리오 — MISSING/BLOCKED 카운트가 상품명 교체로 늘어나지 않는다(회귀 확인)", () => {
    const scenarios: CanonicalProduct[] = [
      (() => {
        const p = makeMinimalProduct();
        p.brand = field("Bobo Choses");
        p.title = field("Stamp Bloom All Over Denim Pants");
        return p;
      })(),
      (() => {
        const p = makeMinimalProduct();
        p.brand = field("Bobo Choses");
        p.title = field("Wool Blend Cap B Logo Baseball Cap");
        p.description = field("Product code B126AC050 26FW Made in Spain.");
        return p;
      })(),
      (() => {
        const p = makeMinimalProduct();
        p.optionGroups = [
          { name: "Size", values: ["S", "M", "L"] },
          { name: "Color", values: ["Black", "White"] },
        ];
        return p;
      })(),
      (() => {
        const p = makeMinimalProduct();
        p.optionGroups = [{ name: "Color", values: ["Red"] }];
        return p;
      })(),
      makeMinimalProduct(),
    ];

    for (const product of scenarios) {
      const listing = makeMinimalListing(product);
      const payload = buildNaverProductPayload({
        ...baseInput(product, listing),
        childCertificationInfoId: null,
        categoryRequiresChildCertification: false,
      });
      const validation = validateNaverPayload(
        payload,
        { ...baseValidateInput(product), childCertificationInfoId: null },
        false,
        {
          categoryVerified: true,
          sellerComplianceConfirmation: null,
        },
      );
      // 상품명 교체가 KC/고시정보/가격 등 다른 필드의 BLOCKED 사유를 새로
      // 만들어내지 않았는지만 확인한다(이 fixture 조합에서 원래도 BLOCKED였던
      // 항목은 그대로 BLOCKED — 상품명 Resolver의 책임 범위 밖이다).
      const nameRelatedIssues = validation.issues.filter((i) => i.field === "originProduct.name");
      expect(nameRelatedIssues).toEqual([]);
      expect(payload.originProduct.name.length).toBeGreaterThan(0);
      expect(payload.originProduct.name.length).toBeLessThanOrEqual(100);
    }
  });

  // N-4.01 Part A-1(대표님 지시 fixture 10종 중 기존 커버 안 된 6종 보강) —
  // 브랜드+시즌+여성/남성, 브랜드 없음, 브랜드가 title 중간/후반 위치, 브랜드
  // 중복 등장, 원문 상품명이 이미 한글인 케이스.
  it("브랜드+시즌+여성 — 성인 여성 신호와 원문 시즌 코드가 함께 있으면 둘 다 반영한다", () => {
    const product = makeMinimalProduct();
    product.sourceUrl = "https://example.com/products/womens-wool-coat-adult";
    product.brand = field("TestBrand");
    product.title = field("Women's Wool Coat");
    product.recommendedAge = field("");
    product.description = field("A women's wool coat. 26FW collection for the winter season.");
    const name = generateSmartStoreProductName(product);
    expect(name).toContain("TestBrand");
    expect(name).toContain("26FW");
    expect(name).toContain("여성");
  });

  it("브랜드+시즌+남성 — 성인 남성 신호와 원문 시즌 코드가 함께 있으면 둘 다 반영한다", () => {
    const product = makeMinimalProduct();
    product.sourceUrl = "https://example.com/products/mens-wool-coat-adult";
    product.brand = field("TestBrand");
    product.title = field("Men's Wool Coat");
    product.recommendedAge = field("");
    product.description = field("A men's wool coat. Product code M100 SS26 collection.");
    const name = generateSmartStoreProductName(product);
    expect(name).toContain("TestBrand");
    expect(name).toContain("26SS");
    expect(name).toContain("남성");
  });

  it("브랜드 없음 — 브랜드 필드가 비어 있으면 접두부 없이 핵심명만 사용한다(빈 문자열을 임의로 채우지 않는다)", () => {
    const product = makeMinimalProduct();
    product.sourceUrl = "https://example.com/products/ceramic-mug-adult";
    product.brand = field("");
    product.title = field("Ceramic Coffee Mug");
    product.recommendedAge = field("");
    product.description = field("A simple ceramic coffee mug.");
    product.optionGroups = [];
    const name = generateSmartStoreProductName(product);
    expect(name).toBe("Ceramic Coffee Mug");
    expect(name).not.toMatch(/^\s/);
  });

  it("브랜드가 title 중간/후반에 있는 경우 — 접두부로 한 번만 앞에 붙이고 핵심명에서는 중복 문구를 제거한다", () => {
    const product = makeMinimalProduct();
    product.brand = field("Bobo Choses");
    product.title = field("Kids Denim Overall Pants by Bobo Choses");
    product.recommendedAge = field("3-4 Years");
    const name = generateSmartStoreProductName(product);
    expect(name).toContain("Bobo Choses");
    expect(name).toContain("키즈");
    expect(name).toContain("Kids Denim Overall Pants");
    // "by Bobo Choses" 접미부는 브랜드 중복이라 핵심명에서 제거되고, 브랜드는
    // 맨 앞 접두부로만 한 번 등장해야 한다.
    expect(name.match(/Bobo Choses/g)?.length).toBe(1);
  });

  it("브랜드가 title에 여러 번 등장하는 경우 — 접두부 1회만 남기고 핵심명 쪽 중복은 모두 제거한다", () => {
    const product = makeMinimalProduct();
    product.brand = field("Bobo Choses");
    product.title = field("Bobo Choses Denim Pants Bobo Choses Kids Collection");
    product.recommendedAge = field("3-4 Years");
    const name = generateSmartStoreProductName(product);
    expect(name.match(/Bobo Choses/g)?.length).toBe(1);
    expect(name).toContain("Denim Pants");
  });

  it("원문 상품명이 이미 한글인 경우 — 번역하지 않고 그대로 핵심명으로 사용한다", () => {
    const product = makeMinimalProduct();
    product.brand = field("TestBrand");
    product.title = field("아동용 반팔 티셔츠");
    product.recommendedAge = field("3세");
    const name = generateSmartStoreProductName(product);
    expect(name).toContain("TestBrand");
    expect(name).toContain("아동용 반팔 티셔츠");
    expect(name).toContain("키즈");
  });
});
