import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload } from "../build-payload";
import { validateNaverPayload } from "../validate-payload";

/**
 * N-3.47(CPO 지시) — SmartStore 옵션가격 스키마 계약 테스트.
 *
 * Naver Commerce API 공식 계정(commerce-api-naver)이 GitHub Discussion #2312
 * (2025-02-17)에서 직접 확인해준 의미를 그대로 고정한다:
 *   "'옵션가'는 상품 판매 가격에 따라 설정할 수 있는 범위가 다르며 음수로
 *   설정할 수도 있습니다. 따라서 옵션 선택 시, 실제 상품 판매 가격이 0원
 *   미만으로 설정되는 것을 방지하기 위하여 '옵션가' 필드가 요청 데이터 내에
 *   포함된 경우, '상품 판매 가격' 필드도 필수로 입력받고 있습니다."
 *
 * 즉 optionCombinations[].price는 salePrice에 더해지는 추가금액(delta)이고,
 * 0/음수 모두 허용되지만 (salePrice + price) < 0은 안 된다. 아래 3개 Case는
 * CPO 작업지시서에 명시된 시나리오를 그대로 코드로 고정한다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/option-price-contract",
    title: field("Option Price Contract Test Product"),
    brand: field("TestBrand"),
    price: field({ amount: 70100, currency: "KRW" }),
    sku: field("OPT-PRICE-1"),
    description: field("옵션가 계약 테스트용 상품."),
    material: field("면 100%"),
    color: field("Navy"),
    recommendedAge: field(""),
    manufacturer: field("Test Manufacturer"),
    careInstructions: field("찬물 세탁"),
    options: field(["사이즈"]),
    optionGroups: [{ name: "사이즈", values: ["A", "B"] }],
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
    ...overrides,
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
    priceKrw: 70100,
    priceIsEstimate: false,
    options: [],
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  };
}

const COMMON_INPUT = {
  releaseAddressBookNo: 900000001,
  refundAddressBookNo: 900000002,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 5000,
  childCertificationInfoId: null,
  originAreaCode: "00",
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "홍길동 02-1234-5678",
};

function buildAndValidate(product: CanonicalProduct) {
  const listing = makeListing(product);
  const payload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: "50000535",
    ...COMMON_INPUT,
    categoryRequiresChildCertification: false,
    originAreaRequiresContent: false,
  });
  const validation = validateNaverPayload(
    payload,
    { product, ...COMMON_INPUT, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false },
    false,
  );
  return { payload, validation };
}

describe("N-3.47: SmartStore 옵션가격 계약 테스트(salePrice 70100 기준)", () => {
  it("Case 1 — 옵션별 동일 가격(A=0, B=0) → 두 옵션 모두 최종가격 70100, optionInfo READY", () => {
    const product = makeProduct({
      variants: [
        { id: "v1", optionValues: { 사이즈: "A" }, sku: "SKU-A", stockQuantity: 5 },
        { id: "v2", optionValues: { 사이즈: "B" }, sku: "SKU-B", stockQuantity: 5 },
      ],
    });
    const { payload, validation } = buildAndValidate(product);
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos.map((c) => c.price)).toEqual([0, 0]);
    const salePrice = payload.originProduct.salePrice;
    expect(combos.map((c) => salePrice + c.price)).toEqual([70100, 70100]);
    expect(validation.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(
      true,
    );
  });

  it("Case 2 — 옵션 추가금(A=0, B=+5000) → A 70100 / B 75100, optionInfo READY", () => {
    const product = makeProduct({
      variants: [
        { id: "v1", optionValues: { 사이즈: "A" }, sku: "SKU-A", stockQuantity: 5, price: { amount: 70100, currency: "KRW" } },
        { id: "v2", optionValues: { 사이즈: "B" }, sku: "SKU-B", stockQuantity: 5, price: { amount: 75100, currency: "KRW" } },
      ],
    });
    const { payload, validation } = buildAndValidate(product);
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos.map((c) => c.price)).toEqual([0, 5000]);
    const salePrice = payload.originProduct.salePrice;
    expect(combos.map((c) => salePrice + c.price)).toEqual([70100, 75100]);
    expect(validation.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(
      true,
    );
  });

  it("Case 3 — 옵션 할인(A=0, B=-5000, 음수 옵션가) → A 70100 / B 65100, optionInfo READY(음수 옵션가 자체는 Naver 공식 허용)", () => {
    const product = makeProduct({
      variants: [
        { id: "v1", optionValues: { 사이즈: "A" }, sku: "SKU-A", stockQuantity: 5, price: { amount: 70100, currency: "KRW" } },
        { id: "v2", optionValues: { 사이즈: "B" }, sku: "SKU-B", stockQuantity: 5, price: { amount: 65100, currency: "KRW" } },
      ],
    });
    const { payload, validation } = buildAndValidate(product);
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    expect(combos.map((c) => c.price)).toEqual([0, -5000]);
    const salePrice = payload.originProduct.salePrice;
    expect(combos.map((c) => salePrice + c.price)).toEqual([70100, 65100]);
    expect(validation.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(
      true,
    );
  });

  it("Case 4 — 옵션가가 손상되어(예: 사용자 직접 입력 오류) 최종가격이 0원 미만이 되면 BLOCKED(Naver 공식 제약 실제 검사)", () => {
    // build-payload.ts의 delta 계산은 "절대가 - salePrice"라서(delta + salePrice
    // = 원래 절대가), 실제 절대가가 0 이상인 정상 크롤링 데이터로는 최종가가
    // 음수가 되는 조합을 자연스럽게 만들 수 없다 — 이 가드는 검증기 자체의
    // 방어 로직을 확인하는 것이 목적이라 payload를 직접 조작해 비정상 값을
    // 흉내낸다(예: OptionVariantEditor에서 사용자가 옵션가를 직접 잘못 입력).
    const product = makeProduct({
      variants: [
        { id: "v1", optionValues: { 사이즈: "A" }, sku: "SKU-A", stockQuantity: 5 },
        { id: "v2", optionValues: { 사이즈: "B" }, sku: "SKU-B", stockQuantity: 5 },
      ],
    });
    const listing = makeListing(product);
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: "50000535",
      ...COMMON_INPUT,
      categoryRequiresChildCertification: false,
      originAreaRequiresContent: false,
    });
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    if (combos && combos[1]) combos[1].price = -(payload.originProduct.salePrice + 1);
    const validation = validateNaverPayload(
      payload,
      { product, ...COMMON_INPUT, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false },
      false,
    );
    const salePrice = payload.originProduct.salePrice;
    expect(salePrice + (combos?.[1]?.price ?? 0)).toBeLessThan(0);
    expect(
      validation.fields.some(
        (f) => f.field === "detailAttribute.optionInfo.optionCombinations[].price" && f.status === "BLOCKED",
      ),
    ).toBe(true);
    expect(validation.ok).toBe(false);
  });

  it("절대가격만 제공되는 원본 사이트 → ABSOLUTE(수집값) → DELTA(payload) 변환이 정확하다(Case 2와 동일 값, 관점만 다름)", () => {
    // STEP5(CPO 지시) — 원본 사이트가 옵션별 절대가격만 준다면(예: junioredition.com처럼
    // "A: ₩70,100", "B: ₩75,100") CanonicalProductVariant.price는 그 절대가격을
    // 그대로 담는다(크롤러가 이미 하는 일 — 변환하지 않는다, N-3.18). delta 변환은
    // build-payload.ts의 buildOptionCombinations 한 곳에서만 일어난다 — Canonical
        // 단계에서 미리 delta로 바꾸지 않는다(원본 데이터를 보존한다는 CanonicalProduct
    // 설계 원칙, product-types.ts 주석 참고).
    const absoluteA = 70100;
    const absoluteB = 75100;
    const product = makeProduct({
      variants: [
        { id: "v1", optionValues: { 사이즈: "A" }, sku: "SKU-A", stockQuantity: 5, price: { amount: absoluteA, currency: "KRW" } },
        { id: "v2", optionValues: { 사이즈: "B" }, sku: "SKU-B", stockQuantity: 5, price: { amount: absoluteB, currency: "KRW" } },
      ],
    });
    const { payload } = buildAndValidate(product);
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations ?? [];
    // 변환 계층 검증: absolute(70100) -> delta(0), absolute(75100) -> delta(5000).
    expect(combos[0].price).toBe(absoluteA - payload.originProduct.salePrice);
    expect(combos[1].price).toBe(absoluteB - payload.originProduct.salePrice);
  });
});
