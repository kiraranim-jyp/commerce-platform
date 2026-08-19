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
    priceValidity: "VALID",
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
  afterServiceDirector: "02-1234-5678",
  afterServiceTelephoneNumber: "+821012345678",
};

function buildAndValidate(
  product: CanonicalProduct,
  childCertificationInfoId: number | null,
  complianceContext?: Parameters<typeof validateNaverPayload>[3],
) {
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
    complianceContext,
  );
  return { payload, validation };
}

describe("N-3.48/N-3.53 STEP9: KC 인증정보 영구 차단 가드", () => {
  it("1) KC 값 없음, 판매자 확인 기록도 없음 → BLOCKED(code: SELLER_SAFETY_CONFIRMATION_REQUIRED, N-3.53)", () => {
    // N-3.52/N-3.53(CPO 지시) — 아직 판매자가 "판매 전 최종 확인"을 한 번도
    // 하지 않은 초기 상태(kcStatus=SELLER_REVIEW_REQUIRED)는 "카테고리를
    // 몰라서 판단 자체가 불가능한 상태"(BLOCKED)와 다르다 — TTAEJYO가
    // "KC가 필요한지 아닌지"까지는 알지만 판매자가 아직 확인하지 않았을
    // 뿐이라 SELLER_SAFETY_CONFIRMATION_REQUIRED로 구분한다.
    const product = makeProduct();
    const { validation } = buildAndValidate(product, 1042);
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("BLOCKED");
    expect(certField?.code).toBe("SELLER_SAFETY_CONFIRMATION_REQUIRED");
    expect(validation.kcStatus).toBe("SELLER_REVIEW_REQUIRED");
    const typeField = validation.fields.find((f) => f.field === "productInfoProvidedNotice(KIDS).certificationType");
    expect(typeField?.status).toBe("MISSING");
    expect(typeField?.code).toBe("KC_CERTIFICATION_REQUIRED");
    expect(validation.ok).toBe(false);
  });

  it("1b) 판매자가 '판매 가능 여부를 확인했다'고 남긴 기록이 있고 정책 버전이 일치 → READY(N-3.53)", () => {
    // TTAEJYO가 자동으로 KC를 면제하는 게 아니다 — 판매자가 직접 남긴
    // SellerComplianceConfirmation이 현재 policyVersion/카테고리와 일치할
    // 때만 이 경로로 통과한다(compliance.ts COMPLIANCE_POLICY_VERSION).
    const product = makeProduct();
    const { validation } = buildAndValidate(product, 1042, {
      categoryVerified: true,
      sellerComplianceConfirmation: {
        confirmed: true,
        kcStatus: "SELLER_REVIEW_REQUIRED",
        policyVersion: "2026-08-19",
        categoryCode: "50000535",
      },
    });
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("READY");
    expect(validation.kcStatus).toBe("SELLER_REVIEW_REQUIRED");
  });

  it("1d) 판매자 확인 기록이 있지만 정책 버전이 오래됨 → 신뢰하지 않고 다시 SELLER_SAFETY_CONFIRMATION_REQUIRED(N-3.53 STEP9)", () => {
    const product = makeProduct();
    const { validation } = buildAndValidate(product, 1042, {
      categoryVerified: true,
      sellerComplianceConfirmation: {
        confirmed: true,
        kcStatus: "SELLER_REVIEW_REQUIRED",
        policyVersion: "2025-01-01",
        categoryCode: "50000535",
      },
    });
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("BLOCKED");
    expect(certField?.code).toBe("SELLER_SAFETY_CONFIRMATION_REQUIRED");
    expect(validation.kcStatus).toBe("SELLER_REVIEW_REQUIRED");
  });

  it("1e) 카테고리가 아직 확정되지 않음 → kcStatus BLOCKED, 판매자 확인으로도 우회 불가(N-3.53)", () => {
    const product = makeProduct();
    const { validation } = buildAndValidate(product, 1042, { categoryVerified: false });
    expect(validation.kcStatus).toBe("BLOCKED");
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("BLOCKED");
    expect(certField?.code).toBe("KC_CERTIFICATION_REQUIRED");
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
    expect(notice && "kids" in notice ? notice.kids.certificationType : undefined).toBeUndefined();
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
