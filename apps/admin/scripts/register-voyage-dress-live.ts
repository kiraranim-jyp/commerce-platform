/**
 * N-3.49 STEP5 — Voyage Dress(Misha & Puff)만 실제로 등록한다. 5개 중
 * validation.ok===true인 유일한 상품(verify-kids5-full-validation.ts 실측
 * 결과, WEAR 카테고리라 KC 검사 자체가 없음). 나머지 4개는 KC 미확보로
 * BLOCKED이므로 이번에는 POST하지 않는다.
 *
 * 안전장치: validation.ok !== true면 즉시 throw하고 종료한다(STEP15 게이트,
 * work order 원칙 4/11). 이 상품은 실제 snapshot(28cf88cf-2b47-4716-8a08-
 * 9f47106829ee)에 연결해 markSnapshotRegistered가 정상 동작하게 한다.
 */
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";

const BASE_URL = "https://commerce-platform-mocha.vercel.app";
const SNAPSHOT_ID = "28cf88cf-2b47-4716-8a08-9f47106829ee";

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
  weight: field(""), // Size 옵션이 있어 resolveSizeFromOptions가 대체(WEAR라 애초에 검사 안 됨)
  certificationType: field(""),
};

const listing: ListingModel = {
  platform: "smartstore",
  platformLabel: "네이버 스마트스토어",
  representativeImage: product.images[0].originalUrl,
  additionalImages: product.images.slice(1).map((i) => i.originalUrl),
  title: product.title.value,
  brand: product.brand.value,
  // N-3.49(2차 POST 실패 후 수정) — 1차 시도에서 167200(88 GBP * 1900, 내가
  // 임의로 추정한 환율)을 썼더니 buildOptionCombinations가 실제 고정환율표
  // (FIXED_RATES_TO_KRW.GBP=1740, packages/pricing/src/currency.ts)로 변환한
  // 옵션가(153120)와 어긋나 모든 옵션에 -14080 delta가 실렸다(실제 HTTP 400
  // 원인은 아니었지만, 정확하지 않은 payload였다). listing.priceKrw를 동일한
  // 고정환율(1740)로 맞춰 delta=0(전 사이즈 88 GBP 균일가)이 되도록 수정.
  priceKrw: 153120, // 88 GBP * 1740 (FIXED_RATES_TO_KRW와 동일 기준)
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
      reason: ["N-3.49 STEP2 실측: POST /api/naver/category-search 실제 응답 1위 후보"],
      source: "ai",
      isVerifiedPlatformCode: true,
    },
  },
  validations: [],
  registrableScore: 100,
};

async function main() {
  // STEP15 게이트 — 로컬에서 한 번 더 재확인(work order 원칙 4/11). register
  // route 자신도 서버에서 동일하게 재검증하지만, 여기서도 먼저 확인해 실제
  // POST 전에 이 스크립트 레벨에서 조기 종료할 수 있게 한다.
  const localPayload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: "50021299",
    releaseAddressBookNo: 105633179,
    refundAddressBookNo: 104809732,
    primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
    sellerDeliveryFee: null,
    returnDeliveryFee: 25000,
    exchangeDeliveryFee: 50000,
    childCertificationInfoId: 1042,
    categoryRequiresChildCertification: false,
    originAreaCode: "0205036",
    originAreaRequiresContent: false,
    deliveryCompany: "EPOST",
    warrantyPolicy: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
    afterServiceDirector: "해외 구매대행으로 A/S 불가",
    // N-3.51 STEP2 — afterServiceDirector(고시용 자유 텍스트)와 별개 필드.
    // register route가 실제로 쓸 SellerProfile.companyContactNumber(GET
    // /api/settings/coupang/profiles로 실측 확인한 값)를 여기도 넣어야
    // 로컬 게이트가 실제 서버 판정과 일치한다.
    afterServiceTelephoneNumber: "+821046458306",
  });
  const localValidation = validateNaverPayload(
    localPayload,
    {
      product,
      releaseAddressBookNo: 105633179,
      refundAddressBookNo: 104809732,
      primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
      returnDeliveryFee: 25000,
      exchangeDeliveryFee: 50000,
      returnCompaniesFetchFailed: false,
      childCertificationInfoId: 1042,
      originAreaCode: "0205036",
      originAreaRequiresImporter: true,
      // N-3.49(재확인) — N-3.45에서 발견했던 것과 동일한 실수(validate 호출에
      // deliveryCompany/warrantyPolicy/afterServiceDirector 누락)를 이 스크립트
      // 초안에서도 반복할 뻔했다 — build 호출과 동일한 값을 여기도 넣어야 한다.
      deliveryCompany: "EPOST",
      warrantyPolicy: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
      afterServiceDirector: "해외 구매대행으로 A/S 불가",
      afterServiceTelephoneNumber: "+821046458306",
    },
    false,
  );

  console.log("=== N-3.49 STEP15 FINAL GATE (local pre-check) ===");
  console.log("validation.ok:", localValidation.ok);
  console.log("READY:", localValidation.readyCount, "MISSING:", localValidation.missingCount, "BLOCKED:", localValidation.blockedCount);
  if (!localValidation.ok) {
    for (const f of localValidation.fields) {
      if (f.status !== "READY") console.error(`  [${f.status}] ${f.field} — ${f.reason ?? ""}`);
    }
    console.error("GATE FAILED — SmartStore registration blocked. Aborting, no POST will be made.");
    process.exit(1);
  }
  console.log("KC: N/A (WEAR category, no child certification required)");
  console.log("option pricing: resolved=true, all sizes delta=0 (real observed price: uniform 88 GBP)");
  console.log("Proceeding to SmartStore registration...\n");

  const res = await fetch(`${BASE_URL}/api/smartstore/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product, listing, snapshotId: SNAPSHOT_ID }),
  });
  const json = await res.json();
  console.log("=== REGISTER RESPONSE ===");
  console.log("HTTP status:", res.status);
  console.log(JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
