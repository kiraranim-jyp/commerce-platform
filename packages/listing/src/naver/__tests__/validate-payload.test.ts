import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload } from "../build-payload";
import { validateNaverPayload } from "../validate-payload";

/**
 * N-3.29(CPO 지시) — Importer(수입사명)/KC(어린이제품 인증) 입력 경로 STEP7
 * 테스트 표를 그대로 코드로 고정한다. build-payload.test.ts의 makeMinimalProduct
 * 패턴을 그대로 재사용한다(같은 최소 픽스처, importer/childCertification만
 * 케이스마다 바꾼다).
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

const LEAF_CATEGORY_ID = "50000535";
const CHILD_CERTIFICATION_CATALOG_ID = 1041;
const RELEASE_ADDRESS = 900000001;
const REFUND_ADDRESS = 900000002;
const RETURN_COMPANY_PRIORITY_TYPE = "PRIMARY";
const RETURN_DELIVERY_FEE = 3000;
const EXCHANGE_DELIVERY_FEE = 5000;
const DOMESTIC_ORIGIN_AREA_CODE = "00";
const IMPORTED_ORIGIN_AREA_CODE = "0200033"; // 수입산:아시아>인도(N-3.26 실측 확인)

function buildAndValidate(
  product: CanonicalProduct,
  opts: {
    categoryRequiresChildCertification: boolean;
    originAreaCode: string | null;
    originAreaRequiresImporter: boolean;
    childCertificationInfoId: number | null;
  },
) {
  const listing = makeMinimalListing(product);
  const commonInput = {
    releaseAddressBookNo: RELEASE_ADDRESS,
    refundAddressBookNo: REFUND_ADDRESS,
    primaryReturnDeliveryCompanyPriorityType: RETURN_COMPANY_PRIORITY_TYPE,
    returnDeliveryFee: RETURN_DELIVERY_FEE,
    exchangeDeliveryFee: EXCHANGE_DELIVERY_FEE,
    childCertificationInfoId: opts.childCertificationInfoId,
    originAreaCode: opts.originAreaCode,
    deliveryCompany: "CJGLS",
    warrantyPolicy: "구매일로부터 1년",
    afterServiceDirector: "02-1234-5678",
    // N-3.51 STEP2 — afterServiceInfo.afterServiceTelephoneNumber는 이제
    // afterServiceDirector와 별개 소스다(실제 SellerProfile.companyContactNumber
    // 형식 재현).
    afterServiceTelephoneNumber: "+821012345678",
  };
  const payload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: LEAF_CATEGORY_ID,
    ...commonInput,
    categoryRequiresChildCertification: opts.categoryRequiresChildCertification,
    originAreaRequiresContent: false,
  });
  const validation = validateNaverPayload(
    payload,
    {
      product,
      ...commonInput,
      returnCompaniesFetchFailed: false,
      originAreaRequiresImporter: opts.originAreaRequiresImporter,
    },
    opts.categoryRequiresChildCertification,
  );
  return { payload, validation };
}

describe("N-3.29 STEP7: Importer/KC 입력 경로", () => {
  it("국내산 + KC 불필요 → importer/인증/옵션 관련 이슈가 전혀 없다(N-3.47: 옵션가 delta 의미 확정 후 optionInfo도 READY)", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "사이즈", values: ["100"] }];
    product.variants = [{ id: "v1", optionValues: { 사이즈: "100" }, sku: "SKU-100", stockQuantity: 5 }];
    const { validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: false,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: null,
    });
    expect(validation.issues.some((i) => i.field.includes("importer"))).toBe(false);
    expect(validation.issues.some((i) => i.field.includes("Certification"))).toBe(false);
    expect(validation.missingCount).toBe(0);
    expect(validation.blockedCount).toBe(0);
    expect(validation.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(
      true,
    );
  });

  it("수입산 + Importer 없음 → MISSING", () => {
    const product = makeMinimalProduct(); // importer 기본값("")
    const { validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: false,
      originAreaCode: IMPORTED_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: true,
      childCertificationInfoId: null,
    });
    const importerField = validation.fields.find((f) => f.field === "detailAttribute.originAreaInfo.importer");
    expect(importerField?.status).toBe("MISSING");
    expect(validation.ok).toBe(false);
  });

  it("수입산 + Importer 있음 → READY(payload에도 그대로 전달됨)", () => {
    const product = makeMinimalProduct();
    product.importer = field("테스트수입무역", "USER_EDITED");
    const { payload, validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: false,
      originAreaCode: IMPORTED_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: true,
      childCertificationInfoId: null,
    });
    expect(payload.originProduct.detailAttribute?.originAreaInfo?.importer).toBe("테스트수입무역");
    const importerField = validation.fields.find((f) => f.field === "detailAttribute.originAreaInfo.importer");
    expect(importerField?.status).toBe("READY");
    // notice.size(치수)는 이 픽스처에 옵션이 없어 별개로 MISSING이다(N-3.28
    // 발견, 이번 스프린트 범위 밖) — importer 축만 READY인지 확인한다.
    expect(validation.issues.some((i) => i.field.includes("importer"))).toBe(false);
  });

  it("CHILD_CERTIFICATION + 인증정보 없음 → BLOCKED", () => {
    const product = makeMinimalProduct(); // childCertification 기본값 null
    const { validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: true,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
    });
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("BLOCKED");
    expect(validation.blockedCount).toBeGreaterThan(0);
    expect(validation.ok).toBe(false);
  });

  it("CHILD_CERTIFICATION + 인증정보 있음 → READY로 전환되고(다음 검증 단계로 통과) payload에 그대로 전달된다", () => {
    const product = makeMinimalProduct();
    product.childCertification = field(
      {
        certificationNumber: "KC-2026-000123",
        companyName: "테스트인증원",
        certificationDate: "2026-01-15",
      },
      "USER_EDITED",
    );
    const { payload, validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: true,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
    });
    const certField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
    expect(certField?.status).toBe("READY");
    expect(payload.originProduct.productCertificationInfos?.[0]).toMatchObject({
      certificationInfoId: CHILD_CERTIFICATION_CATALOG_ID,
      certificationNumber: "KC-2026-000123",
      companyName: "테스트인증원",
      certificationDate: "2026-01-15",
    });
    // KIDS 고시정보의 certificationType/itemName/modelName/weight는 CartPilot에
    // 여전히 입력 경로가 없어(N-3.29 STEP3 — "필요 시" 항목, 이번 스프린트
    // 범위 밖) 항상 MISSING이다 — 그래서 인증서 값이 채워져도 전체 ok는
    // true가 되지 않는다. 이 테스트는 "인증서 필드 자체가 BLOCKED에서
    // READY로 전환됐는지"만 검증한다(다음 검증 단계로 통과 — CPO 지시 문구
    // 그대로).
    expect(validation.blockedCount).toBe(0);
  });

  it("옵션 없음 — optionInfo 검사 자체가 N/A(fields에 없음), BLOCKED로 뭉뚱그려지지 않는다", () => {
    const product = makeMinimalProduct(); // optionGroups: []
    const { validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: false,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: null,
    });
    expect(validation.fields.some((f) => f.field === "detailAttribute.optionInfo")).toBe(false);
  });

  it("옵션 있음 + 옵션가(추가금액) 미설정(delta 0) → optionInfo READY(N-3.47: 옵션가 delta 의미 확정 후)", () => {
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "사이즈", values: ["S", "M"] }];
    product.variants = [
      { id: "v1", optionValues: { 사이즈: "S" }, sku: "SKU-S", stockQuantity: 5 },
      { id: "v2", optionValues: { 사이즈: "M" }, sku: "SKU-M", stockQuantity: 3 },
    ];
    const { validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: false,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: null,
    });
    expect(validation.fields.some((f) => f.field === "detailAttribute.optionInfo" && f.status === "READY")).toBe(
      true,
    );
    expect(validation.blockedCount).toBe(0);
  });

  it("옵션가(추가금액)가 salePrice보다 커서 최종가가 음수가 되는 조합 → optionInfo BLOCKED(Naver 공식 제약 실제 검사)", () => {
    // build-payload.ts의 priceDelta는 항상 "절대가 - salePrice"로 계산되므로
    // (delta + salePrice = 원래 절대가), 실제 크롤링된 절대가가 0 이상인 한
    // build 경로만으로는 최종가가 음수가 되는 조합을 자연스럽게 만들 수 없다
    // (절대가 자체가 이미 0 이상이면 delta를 더해도 원래 절대가로 돌아갈 뿐이다).
    // 이 테스트는 validate-payload.ts의 음수 최종가 가드 자체를 검증하는 것이
    // 목적이라, payload를 직접 손으로 조작해(사용자가 옵션가를 잘못 직접
    // 입력하는 등 비정상 케이스를 흉내) 검증기가 실제로 이 제약을 검사하는지
    // 확인한다.
    const product = makeMinimalProduct();
    product.optionGroups = [{ name: "사이즈", values: ["S", "M"] }];
    product.variants = [
      { id: "v1", optionValues: { 사이즈: "S" }, sku: "SKU-S", stockQuantity: 5 },
      { id: "v2", optionValues: { 사이즈: "M" }, sku: "SKU-M", stockQuantity: 3 },
    ];
    const { payload } = buildAndValidate(product, {
      categoryRequiresChildCertification: false,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: null,
    });
    const combos = payload.originProduct.detailAttribute?.optionInfo?.optionCombinations;
    if (combos && combos[1]) combos[1].price = -(payload.originProduct.salePrice + 1);
    const validation = validateNaverPayload(
      payload,
      {
        product,
        releaseAddressBookNo: RELEASE_ADDRESS,
        refundAddressBookNo: REFUND_ADDRESS,
        primaryReturnDeliveryCompanyPriorityType: RETURN_COMPANY_PRIORITY_TYPE,
        returnDeliveryFee: RETURN_DELIVERY_FEE,
        exchangeDeliveryFee: EXCHANGE_DELIVERY_FEE,
        returnCompaniesFetchFailed: false,
        childCertificationInfoId: null,
        originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
        originAreaRequiresImporter: false,
      },
      false,
    );
    expect(
      validation.fields.some(
        (f) => f.field === "detailAttribute.optionInfo.optionCombinations[].price" && f.status === "BLOCKED",
      ),
    ).toBe(true);
    expect(validation.ok).toBe(false);
  });
});

describe("N-3.45: 상품정보제공고시 공통 관리 — '상세페이지 참조' 3-state 필드", () => {
  it("수입산 + importer를 '상세페이지 참조'로 선택 → READY, payload에는 참조 문구가 채워진다", () => {
    const product = makeMinimalProduct();
    product.importer = field("", "DETAIL_PAGE_REFERENCE");
    const { payload, validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: false,
      originAreaCode: IMPORTED_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: true,
      childCertificationInfoId: null,
    });
    const importerField = validation.fields.find((f) => f.field === "detailAttribute.originAreaInfo.importer");
    expect(importerField?.status).toBe("READY");
    expect(payload.originProduct.detailAttribute?.originAreaInfo?.importer).toBe("상품 상세페이지 참조");
  });

  it("KIDS 고시정보: itemName/modelName/weight를 '상세페이지 참조'로 선택 → READY, payload에 참조 문구가 채워진다", () => {
    const product = makeMinimalProduct();
    product.itemName = field("", "DETAIL_PAGE_REFERENCE");
    product.modelName = field("", "DETAIL_PAGE_REFERENCE");
    product.weight = field("", "DETAIL_PAGE_REFERENCE");
    const { payload, validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: true,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: null,
    });
    for (const f of ["itemName", "modelName", "weight"]) {
      const check = validation.fields.find((x) => x.field === `productInfoProvidedNotice(KIDS).${f}`);
      expect(check?.status, `${f} should be READY via 상세페이지 참조`).toBe("READY");
    }
    const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice && "kids" in notice ? notice.kids.itemName : undefined).toBe("상품 상세페이지 참조");
    expect(notice && "kids" in notice ? notice.kids.modelName : undefined).toBe("상품 상세페이지 참조");
    expect(notice && "kids" in notice ? notice.kids.weight : undefined).toBe("상품 상세페이지 참조");
  });

  it("KC 인증정보(certificationType)는 '상세페이지 참조'를 선택해도 절대 READY로 바뀌지 않는다(영구 제외 가드)", () => {
    const product = makeMinimalProduct();
    // certificationType은 reference-eligibility 화이트리스트에 없어, source를
    // DETAIL_PAGE_REFERENCE로 바꿔도(오작동을 흉내내도) 값이 비어있으면 여전히
    // MISSING이어야 한다 — CPO STEP10 지시.
    product.certificationType = field("", "DETAIL_PAGE_REFERENCE");
    const { payload, validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: true,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: null,
    });
    const check = validation.fields.find((f) => f.field === "productInfoProvidedNotice(KIDS).certificationType");
    expect(check?.status).toBe("MISSING");
    const notice = payload.originProduct.detailAttribute?.productInfoProvidedNotice;
    expect(notice && "kids" in notice ? notice.kids.certificationType : undefined).toBeUndefined();
  });

  it("일반 필드(material/color/manufacturer/careInstructions/recommendedAge)도 '상세페이지 참조'로 READY 전환된다", () => {
    const product = makeMinimalProduct();
    product.material = field("", "DETAIL_PAGE_REFERENCE");
    product.color = field("", "DETAIL_PAGE_REFERENCE");
    product.manufacturer = field("", "DETAIL_PAGE_REFERENCE");
    product.careInstructions = field("", "DETAIL_PAGE_REFERENCE");
    product.recommendedAge = field("", "DETAIL_PAGE_REFERENCE");
    const { validation } = buildAndValidate(product, {
      categoryRequiresChildCertification: true,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      originAreaRequiresImporter: false,
      childCertificationInfoId: null,
    });
    for (const f of ["material", "color", "manufacturer", "caution", "recommendedAge"]) {
      const check = validation.fields.find((x) => x.field === `productInfoProvidedNotice(KIDS).${f}`);
      expect(check?.status, `${f} should be READY via 상세페이지 참조`).toBe("READY");
    }
  });
});

describe("N-3.50/N-3.51 STEP3: deliveryType/deliveryAttributeType/minorPurchasable/afterServiceInfo", () => {
  // N-3.51 STEP2 — afterServiceTelephoneNumber는 afterServiceDirector와 다른
  // 실제 소스(SellerProfile.companyContactNumber)라 별도 파라미터로 바꾼다.
  // afterServiceDirector는 고시용 자유 텍스트라 항상 정상값으로 고정한다.
  function buildAndValidateWithAfterServiceTelephoneNumber(afterServiceTelephoneNumber: string | null) {
    const product = makeMinimalProduct();
    const listing = makeMinimalListing(product);
    const commonInput = {
      releaseAddressBookNo: RELEASE_ADDRESS,
      refundAddressBookNo: REFUND_ADDRESS,
      primaryReturnDeliveryCompanyPriorityType: RETURN_COMPANY_PRIORITY_TYPE,
      returnDeliveryFee: RETURN_DELIVERY_FEE,
      exchangeDeliveryFee: EXCHANGE_DELIVERY_FEE,
      childCertificationInfoId: null,
      originAreaCode: DOMESTIC_ORIGIN_AREA_CODE,
      deliveryCompany: "CJGLS",
      warrantyPolicy: "구매일로부터 1년",
      afterServiceDirector: "해외 구매대행으로 A/S 불가",
      afterServiceTelephoneNumber,
    };
    const payload = buildNaverProductPayload({
      product,
      listing,
      leafCategoryId: LEAF_CATEGORY_ID,
      ...commonInput,
      categoryRequiresChildCertification: false,
      originAreaRequiresContent: false,
    });
    const validation = validateNaverPayload(
      payload,
      { product, ...commonInput, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false },
      false,
    );
    return { payload, validation };
  }

  it("deliveryType/deliveryAttributeType/minorPurchasable/customsTaxType — 상품과 무관하게 항상 READY(사업모델 전체에 적용되는 고정값)", () => {
    const { payload, validation } = buildAndValidateWithAfterServiceTelephoneNumber("+821012345678");
    for (const f of [
      "deliveryInfo.deliveryType",
      "deliveryInfo.deliveryAttributeType",
      "detailAttribute.minorPurchasable",
      "detailAttribute.customsTaxType",
    ]) {
      const check = validation.fields.find((x) => x.field === f);
      expect(check?.status, `${f} should always be READY`).toBe("READY");
    }
    // N-3.51 STEP6(7차 실등록 시도로 발견) — CartPilot은 항상 해외구매대행이라
    // customsTaxType은 항상 "INCLUDED"(관부가세가 이미 판매가에 포함)로
    // 고정된다 — packages/pricing이 원가+마진+수수료를 반영한 단일 최종가를
    // 계산하고, 체크아웃에서 관부가세를 별도 청구하는 흐름이 없다.
    expect(payload.originProduct.detailAttribute?.customsTaxType).toBe("INCLUDED");
  });

  it("afterServiceInfo.afterServiceTelephoneNumber — SellerProfile 값이 없으면 MISSING(임의값 생성 금지)", () => {
    const { validation } = buildAndValidateWithAfterServiceTelephoneNumber(null);
    const check = validation.fields.find(
      (x) => x.field === "detailAttribute.afterServiceInfo.afterServiceTelephoneNumber",
    );
    expect(check?.status).toBe("MISSING");
  });

  it("afterServiceInfo.afterServiceTelephoneNumber — 값은 있지만 전화번호 형식이 아니면 BLOCKED(N-3.49 5차 실등록에서 실제 확인된 제약: 숫자/-/+만 허용)", () => {
    const { validation } = buildAndValidateWithAfterServiceTelephoneNumber("해외 구매대행으로 A/S 불가");
    const check = validation.fields.find(
      (x) => x.field === "detailAttribute.afterServiceInfo.afterServiceTelephoneNumber",
    );
    expect(check?.status).toBe("BLOCKED");
  });

  it("afterServiceInfo.afterServiceTelephoneNumber — 숫자/-/+로만 구성되면 READY", () => {
    const { validation } = buildAndValidateWithAfterServiceTelephoneNumber("+82-2-1234-5678");
    const check = validation.fields.find(
      (x) => x.field === "detailAttribute.afterServiceInfo.afterServiceTelephoneNumber",
    );
    expect(check?.status).toBe("READY");
  });
});
