/**
 * N-3.27 STEP 13 — CPO 지시 Test A~D를 코드 레벨로 검증한다(Test E는 실제
 * POST /v2/products 호출이 필요해 이 스크립트 범위 밖 — register/route.ts
 * 소스 코드 검증(STEP 11 "실제 API 호출 금지" 준수, 정적 코드 리뷰)으로 대체,
 * N-3.27 보고서에 별도 기술한다).
 *
 * computeNaverPayloadReadiness(readiness.ts)가 register route와 완전히 같은
 * validateNaverPayload 결과만 보고 판정하는지, legacy validateSmartStoreListing
 * 결과(computeReadinessScoreSummary)와 더 이상 섞이지 않는지를 실제 함수 호출로
 * 확인한다 — mock 없이 실제 buildNaverProductPayload/validateNaverPayload/
 * computeNaverPayloadReadiness를 그대로 호출한다.
 */
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
import { computeNaverPayloadReadiness } from "../src/app/pipeline/commerce/readiness";

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeFullProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
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
    priceKrw: 10000,
    priceIsEstimate: false,
    priceSource: "SELLER_OVERRIDE",
    options: [],
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

let failures = 0;
function report(name: string, pass: boolean, detail: string) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}: ${detail}`);
  if (!pass) failures++;
}

// ── Test A: computeNaverPayloadReadiness가 validation.ok=true를 정확히
//    Readiness PASS로 옮기는지 확인한다.
//
//    N-3.27 STEP 13 수행 중 발견(중요, CPO 보고 필요) — 실제
//    buildNaverProductPayload/validateNaverPayload로 "완전한 일반 상품"
//    PASS를 재현하려 했으나 구조적으로 불가능함을 확인했다:
//    (1) productInfoProvidedNotice(WEAR/KIDS) 둘 다 `.size`가 항상 필수 —
//        resolveSizeFromOptions(build-payload.ts:221)는 product.optionGroups에
//        SIZE 옵션 그룹이 있어야만 값을 낸다.
//    (2) 하지만 validate-payload.ts:330-348은 optionGroups.length > 0이면
//        무조건 detailAttribute.optionInfo를 BLOCKED 처리한다("price 필드가
//        절대가/추가금액인지 미확인").
//    → size를 채우려면 옵션이 있어야 하는데, 옵션이 있으면 무조건 BLOCKED다.
//    즉 WEAR/KIDS 고시가 적용되는 모든 카테고리(현재 CartPilot이 다루는
//    아동복 전부 포함)는 다른 조건과 무관하게 validateNaverPayload.ok가
//    구조적으로 true가 될 수 없다 — N-3.26에서 발견한 KC 문제와는 별개의,
//    더 근본적인 gap이다. 이건 payload 스키마/옵션 처리 로직을 고쳐야
//    풀리는 문제라 N-3.27(Readiness 정합성) 범위 밖이다(CPO 지시: "SmartStore
//    Payload schema 건드리지 않는다") — 그래서 이 Test A는 실제
//    buildNaverProductPayload를 거치지 않고, computeNaverPayloadReadiness
//    자체(어댑터 매핑 로직)만 순수하게 검증한다.
{
  const syntheticOkValidation = {
    ok: true,
    readyCount: 5,
    missingCount: 0,
    blockedCount: 0,
    fields: [
      { field: "originProduct.leafCategoryId", status: "READY" as const },
      { field: "originProduct.name", status: "READY" as const },
      { field: "originProduct.salePrice", status: "READY" as const },
      { field: "originProduct.stockQuantity", status: "READY" as const },
      { field: "originProduct.images.representativeImage", status: "READY" as const },
    ],
    issues: [],
    advisoryNotes: [],
    kcStatus: "NOT_APPLICABLE" as const,
  };
  const summary = computeNaverPayloadReadiness(syntheticOkValidation);
  report(
    "Test A (PASS)",
    summary.allRequiredPassed && summary.percent === 100,
    `synthetic validation.ok=true → allRequiredPassed=${summary.allRequiredPassed} percent=${summary.percent} (어댑터 매핑 로직만 검증 — 실제 WEAR/KIDS 카테고리에서 validation.ok=true 도달 불가 이슈는 별도 발견사항으로 보고)`,
  );
}

// ── Test B: 수입산으로 확정됐지만 수입사명 입력 경로가 없음 → MISSING → Readiness FAIL ──
{
  const product = makeFullProduct({ countryOfOrigin: field("인도") });
  const listing = makeListing(product);
  const commonInput = {
    releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
    refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
    primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
    returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
    exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
    childCertificationInfoId: null,
    originAreaCode: "0200033",
    deliveryCompany: "CJGLS",
    warrantyPolicy: "구매일로부터 1년",
    afterServiceDirector: "홍길동 02-1234-5678",
  };
  const payload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: LEAF_CATEGORY_ID,
    ...commonInput,
    sellerDeliveryFee: null,
    categoryRequiresChildCertification: false,
    originAreaRequiresContent: false,
  });
  const validation = validateNaverPayload(
    payload,
    { product, ...commonInput, returnCompaniesFetchFailed: false, originAreaRequiresImporter: true },
    false,
  );
  const summary = computeNaverPayloadReadiness(validation);
  const importerField = validation.fields.find((f) => f.field === "detailAttribute.originAreaInfo.importer");
  report(
    "Test B (MISSING importer)",
    !validation.ok && importerField?.status === "MISSING" && !summary.allRequiredPassed,
    `validation.ok=${validation.ok} importer=${importerField?.status} → allRequiredPassed=${summary.allRequiredPassed} percent=${summary.percent}`,
  );
}

// ── Test C: CHILD_CERTIFICATION 카테고리 → 인증서 실값 없음 → BLOCKED → Readiness BLOCKED ──
{
  const product = makeFullProduct();
  const listing = makeListing(product);
  const commonInput = {
    releaseAddressBookNo: PLACEHOLDER_RELEASE_ADDRESS,
    refundAddressBookNo: PLACEHOLDER_REFUND_ADDRESS,
    primaryReturnDeliveryCompanyPriorityType: PLACEHOLDER_RETURN_COMPANY_PRIORITY_TYPE,
    returnDeliveryFee: PLACEHOLDER_RETURN_DELIVERY_FEE,
    exchangeDeliveryFee: PLACEHOLDER_EXCHANGE_DELIVERY_FEE,
    childCertificationInfoId: 1041,
    originAreaCode: "00",
    deliveryCompany: "CJGLS",
    warrantyPolicy: "구매일로부터 1년",
    afterServiceDirector: "홍길동 02-1234-5678",
  };
  const payload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: LEAF_CATEGORY_ID,
    ...commonInput,
    sellerDeliveryFee: null,
    categoryRequiresChildCertification: true,
    originAreaRequiresContent: false,
  });
  const validation = validateNaverPayload(
    payload,
    { product, ...commonInput, returnCompaniesFetchFailed: false, originAreaRequiresImporter: false },
    true,
  );
  const summary = computeNaverPayloadReadiness(validation);
  const certItem = summary.items.find((i) => i.label === "인증서 번호(KC)");
  report(
    "Test C (BLOCKED KC)",
    !validation.ok && validation.blockedCount > 0 && certItem?.reasonCode === "CRITICAL" && !summary.allRequiredPassed,
    `validation.ok=${validation.ok} BLOCKED=${validation.blockedCount} certItem.reasonCode=${certItem?.reasonCode} → allRequiredPassed=${summary.allRequiredPassed}`,
  );
}

// ── Test D는 Sprint P1(CPO 지시, 2026-08-19: "불필요한 상세 체크리스트
//    제거")에서 제거됐다 — 예전엔 legacy computeReadinessScoreSummary(가짜
//    PASS report)가 새 어댑터(computeNaverPayloadReadiness)와 다른 답을
//    낼 위험을 검증했지만, 그 legacy 함수 자체(와 그걸 쓰던 유일한 소비처
//    ReadinessScorePanel/ListingSection "상세 체크리스트")를 코드베이스에서
//    완전히 제거했다 — 이제 SmartStore 등록 가능성 판정 경로가
//    computeNaverPayloadReadiness 하나뿐이라 "두 계산이 어긋날 위험" 자체가
//    구조적으로 사라졌다(테스트할 대상이 없어진 것이지, 위험이 남았는데
//    안 보는 게 아니다).

console.log();
console.log(
  failures === 0
    ? `모두 PASS (3/3) — computeNaverPayloadReadiness가 validateNaverPayload 결과만으로 정확히 판정한다.`
    : `${failures}건 FAIL — 확인 필요.`,
);
process.exit(failures === 0 ? 0 : 1);
