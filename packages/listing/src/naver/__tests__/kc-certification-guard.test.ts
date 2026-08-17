import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload } from "../build-payload";
import { validateNaverPayload } from "../validate-payload";

/**
 * N-3.48(CPO 지시: "KC reference 영구 차단 테스트") — KC 인증정보
 * (certificationType/childCertification)는 어떤 경우에도 "상세페이지 참조"로
 * 우회할 수 없다는 걸 코드로 고정한다. work order STEP9의 5개 케이스를 그대로
 * 테스트로 옮긴다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/kc-guard-test",
    title: field("KC Guard Test Product"),
    brand: field("TestBrand"),
    price: field({ amount: 30000, currency: "KRW" }),
    sku: field("KC-GUARD-1"),
    description: field("KC 가드 테스트용 상품."),
    material: field("면 100%"),
    color: field("Navy"),
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
    returnPolicy: field("반품 가능"),
    shippingFee: field(0, "DEFAULT"),
    stockQuantity: field(999, "DEFAULT"),
    certification: field(""),
    importer: field(""),
    childCertification: field(null),
    itemName: field("모자"),
    modelName: field("MODEL-1"),
    weight: field("100g"),
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
    priceKrw: 30000,
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
  originAreaCode: "00",
  deliveryCompany: "CJGLS",
  warrantyPolicy: "구매일로부터 1년",
  afterServiceDirector: "홍길동 02-1234-5678",
};

function buildAndValidate(product: CanonicalProduct, childCertificationInfoId: number | null) {
  const listing = makeListing(product);
  const payload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: "50000535",
    ...COMMON_INPUT,
    childCertificationInfoId,
    categoryRequiresChildCertification: true,
    originAreaRequiresContent: false,
  });
  const validation = validateNaverPayload(
    payload,
    {
      product,
      ...COMMON_INPUT,
      childCertificationInfoId,
      returnCompaniesFetchFailed: false,
      originAreaRequiresImporter: false,
    },
    true,
  );
  return { payload, validation };
}

describe("N-3.48 STEP9: KC 인증정보 영구 차단 가드", () => {
  it("1) KC 값 없음 → BLOCKED(code: KC_CERTIFICATION_REQUIRED)", () => {
    const product = makeProduct();
    const { validation } = buildAndValidate(product, 1042);
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("BLOCKED");
    expect(certField?.code).toBe("KC_CERTIFICATION_REQUIRED");
    const typeField = validation.fields.find((f) => f.field === "productInfoProvidedNotice(KIDS).certificationType");
    expect(typeField?.status).toBe("MISSING");
    expect(typeField?.code).toBe("KC_CERTIFICATION_REQUIRED");
    expect(validation.ok).toBe(false);
  });

  it("2) KC 값 없음 + DETAIL_PAGE_REFERENCE로 우회 시도 → 여전히 BLOCKED(영구 가드)", () => {
    const product = makeProduct({
      certificationType: field("", "DETAIL_PAGE_REFERENCE"),
      childCertification: field(null, "DETAIL_PAGE_REFERENCE" as FieldSource),
    });
    const { payload, validation } = buildAndValidate(product, 1042);
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("BLOCKED");
    const typeField = validation.fields.find((f) => f.field === "productInfoProvidedNotice(KIDS).certificationType");
    expect(typeField?.status).toBe("MISSING");
    expect(validation.ok).toBe(false);
    // payload에도 참조 문구("상품 상세페이지 참조")가 절대 들어가지 않는다 — KC는
    // resolveNoticeFieldValue를 거치지 않고 항상 실제 값(product.X.value)만 읽는다.
    const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice && "certificationType" in notice ? notice.certificationType : undefined).toBeUndefined();
    expect(payload.originProduct.productCertificationInfos?.[0]?.certificationNumber).toBeUndefined();
  });

  it("3) KC 실제 값 존재 → KC 관련 validation 통과(READY)", () => {
    const product = makeProduct({
      certificationType: field("공급자적합성확인대상 어린이제품", "USER_EDITED"),
      childCertification: field(
        { certificationNumber: "KC-2026-000123", companyName: "테스트인증원", certificationDate: "2026-01-15" },
        "USER_EDITED",
      ),
    });
    const { validation } = buildAndValidate(product, 1042);
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("READY");
    const typeField = validation.fields.find((f) => f.field === "productInfoProvidedNotice(KIDS).certificationType");
    expect(typeField?.status).toBe("READY");
  });

  it("4) 일반 notice 필드(예: 세탁방법)는 DETAIL_PAGE_REFERENCE로 여전히 READY(KC와 다르게 취급됨을 대조 확인)", () => {
    const product = makeProduct({
      careInstructions: field("", "DETAIL_PAGE_REFERENCE"),
      certificationType: field("공급자적합성확인대상 어린이제품", "USER_EDITED"),
      childCertification: field(
        { certificationNumber: "KC-2026-000123", companyName: "테스트인증원", certificationDate: "2026-01-15" },
        "USER_EDITED",
      ),
    });
    const { validation } = buildAndValidate(product, 1042);
    const careField = validation.fields.find((f) => f.field === "productInfoProvidedNotice(KIDS).caution");
    expect(careField?.status).toBe("READY");
    expect(validation.blockedCount).toBe(0);
  });
});
