/**
 * N-3.43 STEP7-10 — 캔들을 보류하고 고시정보 타입이 이미 확정된(공식 스펙 확인,
 * N-3.13 Part E-12) KIDS 상품으로 SmartStore 등록 파이프라인을 끝까지 검증한다.
 * 실제 상품: junioredition.com "Hamster Kid Cap in Brown by The Animals
 * Observatory"(snapshot 50a42e49-e9e7-4e3b-9b8b-66bea6a50f89, 이미 Coupang에
 * REGISTERED 상태로 실등록된 진짜 상품). 아래 product/카테고리/배송/판매자 값은
 * 전부 2026-08-15 프로덕션 API 실측값을 그대로 옮긴 것이다(추측 없음):
 *  - product: /api/snapshots/50a42e49-... 의 canonicalProduct
 *  - category: /api/naver/category-search로 실제 검색 → 50000349(모자) score 100
 *  - courier/notice/origin/delivery: /api/naver/resolve?categoryId=50000349 실측
 *  - manufacturer: The Animals Observatory 공식 이용약관(Terms of Service,
 *    Section 1 IDENTIFICATION)에서 확인한 실제 법인명 — BrandProfile에 저장됨
 *  - childCertificationInfoId=1042(실제), 인증번호/업체명/취득일자는 CPO 지시대로
 *    입력하지 않는다(추측 금지) — 이 스크립트는 그 상태에서 Validator가 정확히
 *    BLOCKED로 판정하는지 확인하는 것이 목적이다.
 *
 * N-3.45(CPO 지시: "상품정보제공고시 공통 관리") 재검증 — 실제 구조화 값을
 * 여전히 모르는 일반 고시 필드(recommendedAge/careInstructions/itemName/
 * modelName/importer)는 "상세페이지 참조"(DETAIL_PAGE_REFERENCE)를 선택한
 * 것으로 표시해 READY 전환을 확인한다. KC 필드(certificationType/
 * childCertification)는 절대 참조로 대체하지 않는다 — 여전히 빈 값 그대로 둬서
 * MISSING/BLOCKED로 남는지 확인하는 것이 이 재검증의 핵심이다.
 */
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, validateNaverPayload, hasRealProductOptions } from "@commerce/listing";
import { computeNaverPayloadReadiness } from "../src/app/pipeline/commerce/readiness";

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

const product: CanonicalProduct = {
  sourceUrl: "https://www.junioredition.com/en-kr/collections/the-animals-observatory/products/hamster-kid-cap-in-brown-by-the-animals-observatory",
  title: field("Hamster Kid Cap in Brown by The Animals Observatory", "shopify-json" as FieldSource),
  brand: field("The Animals Observatory", "shopify-json" as FieldSource),
  price: field({ amount: 74, currency: "GBP" }, "shopify-json" as FieldSource),
  sku: field(""),
  description: field(
    "Hamster kid cap in brown by The Animals Observatory. Made of 100% cotton.",
    "shopify-json" as FieldSource,
  ),
  material: field("100% cotton", "shopify-json" as FieldSource),
  color: field("Brown", "shopify-json" as FieldSource),
  // N-3.45 — 실제 사용연령 구조화 값은 여전히 모른다(원문에 "4-6 Years"/
  // "6-12 Years"는 사이즈 옵션명일 뿐 단일 대표값이 아니다) — 지어내지 않고
  // "상세페이지 참조"를 선택한 것으로 표시한다.
  recommendedAge: field("", "DETAIL_PAGE_REFERENCE" as FieldSource),
  // N-3.43 확인 — 브랜드 공식 Terms of Service(Section 1 IDENTIFICATION)에서
  // 확인한 실제 법인명. 브랜드명("The Animals Observatory")을 그대로 복사한 게
  // 아니다 — 실제 등기 법인명은 "The Animals Observatory Company SL."이다.
  manufacturer: field("The Animals Observatory Company SL.", "BRAND_PROFILE" as FieldSource),
  // N-3.45 — 실제 세탁방법 텍스트를 모른다 — "상세페이지 참조"로 대체.
  careInstructions: field("", "DETAIL_PAGE_REFERENCE" as FieldSource),
  options: field(["Size"], "shopify-json" as FieldSource),
  optionGroups: [
    { name: "Size", values: ["Kid's Hat 4-6 Years (Medium / 54cm)", "Kid's Hat 6-12 Years (Large / 56cm)"] },
  ],
  variants: [
    { id: "v1", optionValues: { Size: "Kid's Hat 4-6 Years (Medium / 54cm)" }, sku: "TAO-CAP-M", priceKrw: null, stockQuantity: null },
    { id: "v2", optionValues: { Size: "Kid's Hat 6-12 Years (Large / 56cm)" }, sku: "TAO-CAP-L", priceKrw: null, stockQuantity: null },
  ] as unknown as CanonicalProduct["variants"],
  shopifyTags: "10-years, 11-years, 12-years, 13-years, 2-years, 3-years, 4-years, 5-years, 6-years, 7-years, 8-years, 9-years, cap, caps, hat, hats, hats-scarves, pc-made-in-china, the-animals-observatory",
  shopifyProductType: "Cap",
  images: [
    {
      id: "img-1",
      originalUrl: "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/e0c83116-bc64-4b88-82bb-623f88d5c9de-0001.jpg",
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
  countryOfOrigin: field("China", "shopify-json" as FieldSource),
  returnPolicy: field(""),
  shippingFee: field(0),
  stockQuantity: field(1),
  certification: field(""),
  // N-3.45 STEP8(CPO 지시) — "구매대행이라고 해서 판매자가 법적으로 수입자인
  // 것은 아니다"(CPO가 이전 오판을 직접 정정). 판매자의 수입자 지위가 실제로
  // 확인되지 않아 자동 추정하지 않고, "상세페이지 참조"를 선택한 것으로 둔다.
  importer: field("", "DETAIL_PAGE_REFERENCE" as FieldSource),
  // CPO 지시(N-3.43) — 실제 인증번호/업체명/취득일자를 모르므로 null로 둔다.
  // 이 값을 채우지 않으면 Validator가 BLOCKED를 내야 정상이다. N-3.45
  // STEP10(영구 가드) — KC 필드는 절대 "상세페이지 참조"로 대체하지 않는다.
  childCertification: field(null),
  // N-3.45 — 품명/모델명은 실제 값을 여전히 모르므로 "상세페이지 참조"로
  // 대체한다. 중량(weight)은 SIZE 옵션이 있어 resolveSizeFromOptions가 이미
  // 대체값을 제공하므로 별도 참조 처리가 필요 없다(스펙 근거, N-3.13 R2).
  // certificationType(KC 인증 대상 여부)은 N-3.45 STEP10 가드로 절대 참조
  // 대체하지 않는다 — 빈 값 그대로 둬서 MISSING으로 남는지 확인한다.
  itemName: field("", "DETAIL_PAGE_REFERENCE" as FieldSource),
  modelName: field("", "DETAIL_PAGE_REFERENCE" as FieldSource),
  weight: field(""),
  certificationType: field(""),
};

const listing: ListingModel = {
  platform: "smartstore",
  platformLabel: "네이버 스마트스토어",
  representativeImage: product.images[0].originalUrl,
  additionalImages: [],
  title: product.title.value,
  brand: product.brand.value,
  priceKrw: 130000,
  priceIsEstimate: false,
  options: [],
  shippingInfo: "",
  description: product.description.value,
  category: UNRESOLVED_CATEGORY,
  validations: [],
  registrableScore: 0,
};

// 실측 확정(추측 아님): /api/naver/category-search 실제 호출 결과, score 100.
const CONFIRMED_LEAF_CATEGORY_ID = "50000349"; // 출산/육아 > 유아동잡화 > 모자

console.log("Product:", product.title.value);
console.log("Options: hasRealProductOptions =", hasRealProductOptions(product), "(기대값: true — Size 옵션 2종 실존)");
console.log("Category: leafCategoryId =", CONFIRMED_LEAF_CATEGORY_ID, "(모자, category-search 실측 score 100)");
console.log("categoryRequiresChildCertification: true (실측, exceptionalCategories에 CHILD_CERTIFICATION 포함)");

const payload = buildNaverProductPayload({
  product,
  listing,
  leafCategoryId: CONFIRMED_LEAF_CATEGORY_ID,
  releaseAddressBookNo: 105633179,
  refundAddressBookNo: 104809732,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  returnDeliveryFee: 25000,
  exchangeDeliveryFee: 50000,
  childCertificationInfoId: 1042,
  categoryRequiresChildCertification: true,
  originAreaCode: "0200037", // 수입산:아시아>중국 — /api/naver/resolve 실측
  originAreaRequiresContent: true,
  deliveryCompany: "EPOST",
  warrantyPolicy: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
  afterServiceDirector: "해외 구매대행으로 A/S 불가",
});

console.log("\nPayload: build 성공");
console.log("optionInfo 존재:", Boolean(payload.originProduct.detailAttribute?.optionInfo));
console.log(
  "productInfoProvidedNotice.type:",
  payload.originProduct.detailAttribute?.productInfoProvidedNotice?.productInfoProvidedNoticeType,
  "(기대값: KIDS)",
);

// N-3.45 버그 수정(재검증 중 발견) — 이 검증 호출이 buildNaverProductPayload에는
// 전달한 deliveryCompany/warrantyPolicy/afterServiceDirector를 빠뜨리고 있었다.
// validateNaverPayload도 이 3개를 검사하는데(스펙: Pick<NaverPayloadInput, ...
// "deliveryCompany" | "warrantyPolicy" | "afterServiceDirector">), 빠뜨리면
// 실제로는 READY인 필드가 스크립트 결과에서만 거짓 MISSING으로 보인다 — payload
// 자체는 이미 정확히 채워져 있었다(위 build 호출과 동일한 값을 여기도 전달).
const validation = validateNaverPayload(
  payload,
  {
    product,
    childCertificationInfoId: 1042,
    releaseAddressBookNo: 105633179,
    refundAddressBookNo: 104809732,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    returnDeliveryFee: 25000,
    exchangeDeliveryFee: 50000,
    returnCompaniesFetchFailed: false,
    originAreaCode: "0200037",
    originAreaRequiresImporter: true,
    deliveryCompany: "EPOST",
    warrantyPolicy: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
    afterServiceDirector: "해외 구매대행으로 A/S 불가",
  },
  true,
);

console.log("\nValidation:");
console.log("  READY:", validation.readyCount);
console.log("  MISSING:", validation.missingCount);
console.log("  BLOCKED:", validation.blockedCount);
console.log("  ok:", validation.ok);
console.log("\n  MISSING/BLOCKED 필드 목록:");
for (const f of validation.fields) {
  if (f.status === "MISSING" || f.status === "BLOCKED") {
    console.log(`    [${f.status}] ${f.field} — ${f.reason ?? ""}`);
  }
}

const readiness = computeNaverPayloadReadiness(validation);
console.log("\nReadiness:");
console.log("  percent:", readiness.percent);
console.log("  allRequiredPassed:", readiness.allRequiredPassed);

// N-3.46 STEP2(CPO 지시) — 2026-08-17 실제 원문 재확인(WebFetch,
// junioredition.com 상품 페이지 직접 조회): "KC"/"KC mark"/"certification"/
// "인증"/"안전확인"/"공급자적합성" 등 모든 키워드 검색 결과 "없음" — 상품
// 설명/스펙/배송정보 어디에도 KC 인증 관련 텍스트가 없다. 추정/생성 절대
// 금지(work order 원칙 1-3) — childCertification/certificationType은
// 그대로 빈 값 유지, BLOCKED/MISSING 상태 변경 없음.
//
// N-3.47(CPO 지시) — N-3.46에서 BLOCKED였던 옵션가격 스키마가 이제 공식
// 확인됐다. Naver Commerce API 공식 계정(commerce-api-naver)이 GitHub
// Discussion #2312(2025-02-17)에서 "'옵션가'는 상품 판매 가격에 따라 설정할
// 수 있는 범위가 다르며 음수로 설정할 수도 있습니다. 따라서 옵션 선택 시,
// 실제 상품 판매 가격이 0원 미만으로 설정되는 것을 방지하기 위하여 '옵션가'
// 필드가 요청 데이터 내에 포함된 경우, '상품 판매 가격' 필드도 필수로
// 입력받고 있습니다"라고 직접 답변 — salePrice 대비 추가금액(delta)임이
// 확정됐다. build-payload.ts의 계산은 이미 이 의미와 일치했고,
// validate-payload.ts는 이제 관행 기반 BLOCKED 대신 실제 제약(최종 판매가
// 0원 미만 금지)만 검사한다 — 이 상품은 옵션 간 가격차가 없어(원문
// "Regular price ₩70,100" 단일가) 두 옵션 모두 delta=0으로 READY.
const kcField = validation.fields.find((f) => f.field === "productCertificationInfos[].certificationNumber");
const optionPriceField = validation.fields.find((f) => f.field === "detailAttribute.optionInfo");

console.log("\n=== N-3.47 STEP15: SMARTSTORE REGISTRATION GATE ===");
console.log("product:", product.title.value);
console.log("validation.ok:", validation.ok);
console.log("READY:", validation.readyCount);
console.log("MISSING:", validation.missingCount);
console.log("BLOCKED:", validation.blockedCount);
console.log("\nKC certification:");
console.log("  actual value found on real product page:", "NO (2026-08-17 WebFetch 재확인)");
console.log("  status:", kcField?.status ?? "N/A");
console.log("\noption pricing:");
console.log("  resolved:", "YES (N-3.47: Naver 공식 계정 답변, GitHub Discussion #2312, delta 의미 확정)");
console.log("  status:", optionPriceField?.status ?? "N/A");

if (!validation.ok) {
  console.log("\nGATE RESULT: BLOCKED — POST /v2/products 호출 금지");
  console.log("case: B (옵션가격 해결됨, KC 실제 정보만 없음) — KC만 남았으므로 등록 중단, 가짜 READY 생성 없음. 다음 작업: KC 확보 UX(N-3.48)");
} else {
  console.log("\nGATE RESULT: PASS — 실제 등록 진행 가능");
}
