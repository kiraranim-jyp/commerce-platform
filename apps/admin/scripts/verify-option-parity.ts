/**
 * N-3.32 STEP 6 — build-payload.ts/validate-payload.ts가 hasRealProductOptions
 * 기준으로 통일된 뒤, N-3.31에서 실제로 추출했던 pfcandleco.com "Blonde Hinoki
 * HI-FI Candle"(진짜 단일 SKU, Shopify Default Title placeholder) 데이터를
 * 그대로 다시 넣어서 optionInfo BLOCKED가 사라지는지 실제 함수 호출로 확인한다
 * (mock 없음). 이 상품은 아직 실제 Naver 카테고리를 재조사하지 않았으므로
 * leafCategoryId/originAreaCode는 payload 구조 확인용 placeholder다 — 카테고리
 * 확정은 N-3.33(Category Resolver Coverage) 범위.
 */
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, validateNaverPayload, hasRealProductOptions } from "@commerce/listing";

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

// N-3.31 실측 추출 결과(pfcandleco.com/products/blonde-hinoki-hi-fi-candle) 그대로.
const product: CanonicalProduct = {
  sourceUrl: "https://pfcandleco.com/products/blonde-hinoki-hi-fi-candle",
  title: field("Blonde Hinoki – HI-FI Candle", "shopify-json" as FieldSource),
  brand: field("P.F. Candle Co.", "shopify-json" as FieldSource),
  price: field({ amount: 44, currency: "USD" }, "shopify-json" as FieldSource),
  priceValidity: "VALID",
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

console.log("=== N-3.32 STEP6: hasRealProductOptions(pfcandleco 단일 SKU) ===");
console.log(hasRealProductOptions(product), "(기대값: false)");

const payload = buildNaverProductPayload({
  product,
  listing,
  leafCategoryId: "50000000",
  releaseAddressBookNo: 900000001,
  refundAddressBookNo: 900000002,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 5000,
  childCertificationInfoId: null,
  categoryRequiresChildCertification: false,
  originAreaCode: "03",
  originAreaRequiresContent: false,
});

console.log("\n=== optionInfo (payload) ===");
console.log(payload.originProduct.detailAttribute?.optionInfo, "(기대값: undefined)");

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

console.log("\n=== validation summary ===");
console.log({
  ok: validation.ok,
  readyCount: validation.readyCount,
  missingCount: validation.missingCount,
  blockedCount: validation.blockedCount,
});

console.log("\n=== MISSING/BLOCKED fields (STEP7 — 옵션 문제 제거 후 실제로 남는 항목) ===");
for (const f of validation.fields) {
  if (f.status === "MISSING" || f.status === "BLOCKED") {
    console.log(`[${f.status}] ${f.field}`);
  }
}
