/**
 * N-3.33 STEP 10 — 코드 변경(카테고리 리졸버 "캔들" 타입 추가) 이후, N-3.31/32에서
 * 확보한 pfcandleco.com "Blonde Hinoki HI-FI Candle" 실측 데이터에 STEP2에서
 * 실제로 확정한 SmartStore leaf category(50003353, "가구/인테리어 > 인테리어소품
 * > 아로마/캔들용품 > 초/향초" — fetchNaverAllCategories 4999개 전수조사로
 * 확인, 추측 아님)를 넣어 buildNaverProductPayload → validateNaverPayload →
 * computeNaverPayloadReadiness 전체 체인을 돌린다.
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
  sourceUrl: "https://pfcandleco.com/products/blonde-hinoki-hi-fi-candle",
  title: field("Blonde Hinoki – HI-FI Candle", "shopify-json" as FieldSource),
  brand: field("P.F. Candle Co.", "shopify-json" as FieldSource),
  price: field({ amount: 44, currency: "USD" }, "shopify-json" as FieldSource),
  sku: field(""),
  description: field(
    "Clean and warm, inspired by the light woods used to house records in a hi-fi listening bar. Golden cypress, green petitgrain, elemi resin.",
    "shopify-json" as FieldSource,
  ),
  material: field(""),
  color: field(""),
  recommendedAge: field(""),
  manufacturer: field(""),
  careInstructions: field(""),
  options: field(["Title"], "shopify-json" as FieldSource),
  optionGroups: [{ name: "Title", values: ["Default Title"] }],
  variants: [],
  shopifyTags: "hifi, high fi, insence, Shop P.F.",
  shopifyProductType: "HI-FI Candle",
  images: [
    {
      id: "img-1",
      originalUrl: "https://cdn.shopify.com/s/files/1/1024/9739/files/HFC1-1.jpg",
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
  countryOfOrigin: field(""),
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

const listing: ListingModel = {
  platform: "smartstore",
  platformLabel: "네이버 스마트스토어",
  representativeImage: product.images[0].originalUrl,
  additionalImages: [],
  title: product.title.value,
  brand: product.brand.value,
  priceKrw: 60000,
  priceIsEstimate: false,
  options: [],
  shippingInfo: "",
  description: product.description.value,
  category: UNRESOLVED_CATEGORY,
  validations: [],
  registrableScore: 0,
};

// STEP2에서 실제로 확정한 leaf category (추측 아님, fetchNaverAllCategories 실측).
const CONFIRMED_LEAF_CATEGORY_ID = "50003353"; // 가구/인테리어 > 인테리어소품 > 아로마/캔들용품 > 초/향초

console.log("Product:", product.title.value);
console.log("Options: hasRealProductOptions =", hasRealProductOptions(product), "(기대값: false)");
console.log("Category: resolved — leafCategoryId =", CONFIRMED_LEAF_CATEGORY_ID, "(초/향초, 실측 확정)");

const payload = buildNaverProductPayload({
  product,
  listing,
  leafCategoryId: CONFIRMED_LEAF_CATEGORY_ID,
  releaseAddressBookNo: 900000001,
  refundAddressBookNo: 900000002,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 5000,
  childCertificationInfoId: null,
  categoryRequiresChildCertification: false, // 인테리어소품 카테고리 — CHILD_CERTIFICATION 대상 아님(N-3.31에서 유아동 카테고리만 제외 확인된 원칙 유지, 실제 exceptionalCategories 재확인은 이번 스크립트 범위 밖)
  originAreaCode: "03", // 미국(원산지) — 실제 원산지코드 매핑은 별도 확인 필요, payload 구조 확인용
  originAreaRequiresContent: false,
});

console.log("\nPayload: build 성공");
console.log("optionInfo:", payload.originProduct.detailAttribute?.optionInfo, "(기대값: undefined)");
console.log(
  "productInfoProvidedNotice.type:",
  payload.originProduct.detailAttribute?.productInfoProvidedNotice?.productInfoProvidedNoticeType,
  "(WEAR로 나온다면 이건 의류용 스키마 — 캔들에 맞는지는 N-3.33 STEP5-8 별도 판단 대상)",
);

const validation = validateNaverPayload(
  payload,
  {
    product,
    childCertificationInfoId: null,
    releaseAddressBookNo: 900000001,
    refundAddressBookNo: 900000002,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    returnDeliveryFee: 3000,
    exchangeDeliveryFee: 5000,
    returnCompaniesFetchFailed: false,
    originAreaCode: "03",
    originAreaRequiresImporter: true,
  },
  false,
);

console.log("\nValidation:");
console.log("  READY:", validation.readyCount);
console.log("  MISSING:", validation.missingCount);
console.log("  BLOCKED:", validation.blockedCount);
console.log("  ok:", validation.ok);
console.log("\n  MISSING/BLOCKED 필드 목록:");
for (const f of validation.fields) {
  if (f.status === "MISSING" || f.status === "BLOCKED") {
    console.log(`    [${f.status}] ${f.field}`);
  }
}

const readiness = computeNaverPayloadReadiness(validation);
console.log("\nReadiness:");
console.log("  percent:", readiness.percent);
console.log("  allRequiredPassed:", readiness.allRequiredPassed);
