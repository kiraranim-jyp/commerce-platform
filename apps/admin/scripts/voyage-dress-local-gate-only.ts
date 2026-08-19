/**
 * N-3.49 — optionCombinationGroupNames 스키마 수정 후, 실제 POST 전에 로컬
 * payload 구조만 재확인한다(POST 없음). 이전에 두 번의 실POST가 스키마
 * 버그(string[] 대신 object 필요)로 거부되었고, 코드 수정 후 다시 POST하기
 * 전 이 스크립트로 optionCombinationGroupNames가 배열이 아니라 객체
 * 형태({optionGroupName1: "Size"})로 만들어지는지만 확인한다.
 */
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { buildNaverProductPayload } from "@commerce/listing";

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}
const REF = "DETAIL_PAGE_REFERENCE" as FieldSource;

const product: CanonicalProduct = {
  sourceUrl:
    "https://www.junioredition.com/en-kr/collections/misha-and-puff-sale/products/voyage-dress-in-bright-sky-blossom-plaid-by-misha-puff",
  title: field("Voyage Dress in Bright Sky Blossom Plaid by Misha & Puff", "shopify-json" as FieldSource),
  brand: field("Misha & Puff", "shopify-json" as FieldSource),
  price: field({ amount: 88, currency: "GBP" }, "shopify-json" as FieldSource),
  priceValidity: "VALID",
  sku: field(""),
  description: field(
    "Voyage Dress by Misha & Puff. A dress in lightweight organic cotton plaid, with a woven textured design, rounded collar, elbow-length sleeves, gathered waist, ruffle trim with edge detail, and a double-breasted corozo button closure. Lined in cotton voile and finished with French seams.",
    "shopify-json" as FieldSource,
  ),
  material: field("100% Organic Cotton", "shopify-json" as FieldSource),
  color: field("Bright Sky Blossom Plaid", "shopify-json" as FieldSource),
  recommendedAge: field("", REF),
  manufacturer: field("", REF),
  careInstructions: field("", REF),
  options: field(["Size"], "shopify-json" as FieldSource),
  optionGroups: [{ name: "Size", values: ["3 Years", "4 Years", "5 Years", "6 Years", "8 Years", "10 Years"] }],
  variants: [
    { id: "v1", optionValues: { Size: "3 Years" }, price: { amount: 88, currency: "GBP" } },
    { id: "v2", optionValues: { Size: "4 Years" }, price: { amount: 88, currency: "GBP" } },
    { id: "v3", optionValues: { Size: "5 Years" }, price: { amount: 88, currency: "GBP" } },
    { id: "v4", optionValues: { Size: "6 Years" }, price: { amount: 88, currency: "GBP" } },
    { id: "v5", optionValues: { Size: "8 Years" }, price: { amount: 88, currency: "GBP" } },
    { id: "v6", optionValues: { Size: "10 Years" }, price: { amount: 88, currency: "GBP" } },
  ] as unknown as CanonicalProduct["variants"],
  images: [
    {
      id: "img-1",
      originalUrl:
        "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/936eb926-ed3d-4b9e-bf25-a741d9a90507-0001.jpg",
      selectedVariant: "ORIGINAL",
      isRepresentative: true,
      useInProductGallery: true,
      useInDescription: false,
      classification: "PRODUCT",
    },
    {
      id: "img-2",
      originalUrl:
        "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/92e9f266-1bbd-4902-b9b4-6b96fcc582c3-0002.jpg",
      selectedVariant: "ORIGINAL",
      isRepresentative: false,
      useInProductGallery: true,
      useInDescription: false,
      classification: "LIFESTYLE",
    },
  ],
  titleKo: field(""),
  descriptionKo: field(""),
  keywords: field([]),
  seoTitle: field(""),
  seoDescription: field(""),
  countryOfOrigin: field("Peru", "shopify-json" as FieldSource),
  returnPolicy: field(""),
  shippingFee: field(0),
  stockQuantity: field(5, "USER_EDITED" as FieldSource),
  certification: field(""),
  importer: field("", REF),
  childCertification: field(null),
  itemName: field("", REF),
  modelName: field("", REF),
  weight: field(""),
  certificationType: field(""),
};

const payload = buildNaverProductPayload({
  product,
  listing: {
    platform: "smartstore",
    platformLabel: "네이버 스마트스토어",
    representativeImage: product.images[0].originalUrl,
    additionalImages: product.images.slice(1).map((i) => i.originalUrl),
    title: product.title.value,
    brand: product.brand.value,
    priceKrw: 153120, // 88 GBP * 1740 (FIXED_RATES_TO_KRW와 동일 기준, delta=0 유도)
    priceIsEstimate: false,
    options: ["Size"],
    shippingInfo: "",
    description: product.description.value,
    category: {
      state: "CONFIRMED",
      provenance: "USER_SELECTED",
      candidate: {
        id: "50021299",
        name: "실측 category-search 1위 후보(score 95)",
        path: [],
        platform: "smartstore",
        confidence: 0.95,
        reason: ["N-3.49 STEP2 실측"],
        source: "ai",
        isVerifiedPlatformCode: true,
      },
    },
    validations: [],
    registrableScore: 100,
  },
  leafCategoryId: "50021299",
  releaseAddressBookNo: 105633179,
  refundAddressBookNo: 104809732,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  returnDeliveryFee: 25000,
  exchangeDeliveryFee: 50000,
  childCertificationInfoId: 1042,
  categoryRequiresChildCertification: false,
  originAreaCode: "0205036",
  originAreaRequiresContent: false,
  deliveryCompany: "EPOST",
  warrantyPolicy: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
  afterServiceDirector: "해외 구매대행으로 A/S 불가",
});

console.log("=== optionCombinationGroupNames ===");
console.log(JSON.stringify(payload.originProduct.detailAttribute?.optionInfo?.optionCombinationGroupNames, null, 2));
console.log("\n=== deliveryInfo.deliveryType / deliveryAttributeType (3차 POST에서 새로 발견된 필드) ===");
console.log("deliveryType:", payload.originProduct.deliveryInfo?.deliveryType);
console.log("deliveryAttributeType:", payload.originProduct.deliveryInfo?.deliveryAttributeType);
console.log("\n=== detailAttribute.minorPurchasable / afterServiceInfo (3차 POST에서 새로 발견된 필드) ===");
console.log("minorPurchasable:", payload.originProduct.detailAttribute?.minorPurchasable);
console.log("afterServiceInfo:", JSON.stringify(payload.originProduct.detailAttribute?.afterServiceInfo, null, 2));
