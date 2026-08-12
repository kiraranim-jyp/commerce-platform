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

  it("옵션이 있는 상품은 옵션 스키마 미확인(price 의미)으로 BLOCKED", () => {
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
    expect(result.issues.some((i) => i.field === "detailAttribute.optionInfo" && i.severity === "BLOCKED")).toBe(true);
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
  it("naverShoppingRegistration은 채우지 않고(근거 없음) advisory로만 표시한다 — Gate 판단(issues)에는 안 들어간다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
    });
    expect(payload.smartstoreChannelProduct.naverShoppingRegistration).toBeUndefined();
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
        (f) => f.field === "smartstoreChannelProduct.naverShoppingRegistration" && f.status === "MISSING",
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

  it("Case B: Color × Size 2중 옵션 상품 — 4개 조합 모두 optionCombinations로 변환되고 옵션 관련 필드가 검사에 포함된다", () => {
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
    expect(result.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "BLOCKED")).toBe(true);
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

  // N-3.13 Part I(I-10 Test A 재확인, CPO 결정 2026-08-12 반영) —
  // naverShoppingRegistration을 advisory로 뺐지만, 완전 READY는 여전히
  // 불가능하다는 걸 이번에 다시 확인했다: `${noticePrefix}.size`(치수)가
  // WEAR/KIDS 공통으로 항상 `check(fields, ..., false, ...)`(무조건 MISSING)
  // 처리돼 있다 — CartPilot에 사이즈 값을 채울 입력 경로가 아직 없기
  // 때문이다(naverShoppingRegistration과는 다른 이유: 이건 "CartPilot이
  // 몰라서"가 아니라 "입력 UI가 아직 없어서"다). 이 필드는 이번 CPO 결정
  // 범위(naverShoppingRegistration)에 포함되지 않았으므로 advisory로 임의
  // 편입하지 않는다 — 대신 실제 남은 이유를 그대로 고정해 둔다.
  it("Case F(신규) — deliveryCompany/warrantyPolicy/afterServiceDirector를 채워도 size(치수) 입력 경로가 없어 여전히 MISSING 1건 남는다", () => {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const payload = buildNaverProductPayload({
      ...baseInput(product, listing),
      childCertificationInfoId: null,
      categoryRequiresChildCertification: false,
      deliveryCompany: "CJGLS",
      warrantyPolicy: "구매일로부터 1년",
      afterServiceDirector: "고객센터 1544-0000",
    });
    const result = validateNaverPayload(
      payload,
      {
        ...baseValidateInput(product),
        childCertificationInfoId: null,
        deliveryCompany: "CJGLS",
        warrantyPolicy: "구매일로부터 1년",
        afterServiceDirector: "고객센터 1544-0000",
      },
      false,
    );
    expect(result.blockedCount).toBe(0);
    expect(result.missingCount).toBe(1);
    expect(
      result.issues.some((i) => i.field === "productInfoProvidedNotice(WEAR).size" && i.severity === "MISSING"),
    ).toBe(true);
    expect(result.ok).toBe(false);
    // advisory는 여전히 fields에는 남아있다(섹션 요약에서 보여야 하니까) — 다만
    // 카운트/ok에는 영향을 주지 않는다는 걸 같이 확인한다.
    expect(
      result.advisoryNotes.some((f) => f.field === "smartstoreChannelProduct.naverShoppingRegistration"),
    ).toBe(true);
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
