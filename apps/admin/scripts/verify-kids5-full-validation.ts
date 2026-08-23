/**
 * N-3.49 STEP4 — KIDS 5종 실제 검증. 각 상품은:
 *  - 실제 저장된 snapshot(product_snapshots, /api/snapshots 실측)에서 가져온
 *    실제 추출값(material/color/countryOfOrigin/options/가격)을 그대로 쓴다.
 *  - leafCategoryId/categoryRequiresChildCertification/originAreaCode/주소록/
 *    배송/반품 정보는 verify-kids5-category-resolve.ts로 2026-08-17에 실측한
 *    값을 그대로 옮긴다(프로덕션 실제 Naver API 호출 결과, 재추정 없음).
 *  - KC(certificationType/childCertification)는 5개 상품 원문 어디에도 없음을
 *    WebFetch로 확인했다(2026-08-17) — 절대 채우지 않는다. categoryRequiresChild
 *    Certification=true인 4개는 이 때문에 정확히 BLOCKED가 나와야 정상이다.
 *  - 일반 고시필드(manufacturer/careInstructions/importer/itemName 등) 중
 *    원문에 실제 값이 없는 것은 DETAIL_PAGE_REFERENCE로 처리한다(N-3.45).
 */
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import type { ListingModel } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildNaverProductPayload, validateNaverPayload, hasRealProductOptions } from "@commerce/listing";

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}
const REF = "DETAIL_PAGE_REFERENCE" as FieldSource;

// 판매자 실제 설정값(Settings, 기존 세션에서 확인된 실제 저장값 — Hamster Cap
// 스크립트와 동일한 값을 재사용한다, 판매자 정보는 상품마다 다르지 않다).
const SELLER_COMMON = {
  releaseAddressBookNo: 105633179,
  refundAddressBookNo: 104809732,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  returnDeliveryFee: 25000,
  exchangeDeliveryFee: 50000,
  deliveryCompany: "EPOST",
  warrantyPolicy: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
  afterServiceDirector: "해외 구매대행으로 A/S 불가",
};

interface ProductSpec {
  name: string;
  sourceUrl: string;
  title: string;
  brand: string;
  price: { amount: number; currency: string };
  material: string;
  color: string;
  countryOfOrigin: string;
  recommendedAge?: string;
  modelName?: string;
  optionGroups: { name: string; values: string[] }[];
  variantPrices?: { amount: number; currency: string }[];
  representativeImageUrl: string;
  leafCategoryId: string;
  categoryRequiresChildCertification: boolean;
  childCertificationInfoId: number | null;
  originAreaCode: string;
  originAreaRequiresImporter: boolean;
}

const PRODUCTS: ProductSpec[] = [
  {
    name: "Voyage Dress (Misha & Puff)",
    sourceUrl:
      "https://www.junioredition.com/en-kr/collections/misha-and-puff-sale/products/voyage-dress-in-bright-sky-blossom-plaid-by-misha-puff",
    title: "Voyage Dress in Bright Sky Blossom Plaid by Misha & Puff",
    brand: "Misha & Puff",
    price: { amount: 88, currency: "GBP" },
    material: "100% Organic Cotton",
    color: "Bright Sky Blossom Plaid",
    countryOfOrigin: "Peru",
    optionGroups: [{ name: "Size", values: ["3 Years", "4 Years", "5 Years", "6 Years", "8 Years", "10 Years"] }],
    variantPrices: Array(6).fill({ amount: 88, currency: "GBP" }),
    representativeImageUrl:
      "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/936eb926-ed3d-4b9e-bf25-a741d9a90507-0001.jpg",
    leafCategoryId: "50021299",
    categoryRequiresChildCertification: false,
    childCertificationInfoId: 1042,
    originAreaCode: "0205036",
    originAreaRequiresImporter: true,
  },
  {
    name: "Bobo Choses Sweatshirt",
    sourceUrl: "https://www.junioredition.com/products/bobo-choses-color-block-zipped-sweatshirt-by-bobo-choses",
    title: "Bobo Choses Color Block Zipped Sweatshirt by Bobo Choses",
    brand: "Bobo Choses",
    price: { amount: 63, currency: "GBP" },
    material: "72% Organic Cotton, 28% Recycled Polyester",
    color: "Multi",
    countryOfOrigin: "Spain",
    modelName: "B126AC050 SS26",
    optionGroups: [{ name: "Size", values: ["4-5 Years", "6-7 Years", "8-9 Years", "10-11 Years", "12-13 Years"] }],
    variantPrices: Array(5).fill({ amount: 63, currency: "GBP" }),
    representativeImageUrl:
      "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/f4b591a8-e4c1-48ee-b856-4be0600c8f92-0001.jpg",
    leafCategoryId: "50000535",
    categoryRequiresChildCertification: true,
    childCertificationInfoId: 1042,
    originAreaCode: "0201025",
    originAreaRequiresImporter: true,
  },
  {
    name: "Jody Teddy Onesie (Konges Sløjd)",
    sourceUrl:
      "https://www.junioredition.com/en-kr/collections/konges-slojd-baby-clothing/products/jody-teddy-onesie-in-erba-stripe-by-konges-slojd",
    title: "Jody Teddy Onesie in Erba Stripe by Konges Sløjd",
    brand: "Konges Slojd Clothing",
    price: { amount: 139500, currency: "KRW" },
    material: "100% Recycled Polyester, 100% Cotton Lining",
    color: "Erba Stripe",
    countryOfOrigin: "China",
    optionGroups: [{ name: "Size", values: ["3 Months", "6 Months", "9 Months", "12 Months", "18 Months"] }],
    variantPrices: Array(5).fill({ amount: 139500, currency: "KRW" }),
    representativeImageUrl:
      "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/eba7f134-f249-4a68-bdd5-fd414bbc1f64-0002.jpg",
    leafCategoryId: "50000535",
    categoryRequiresChildCertification: true,
    childCertificationInfoId: 1042,
    originAreaCode: "0200037",
    originAreaRequiresImporter: true,
  },
  {
    name: "Lemon Teether (Konges Sløjd)",
    sourceUrl: "https://www.junioredition.com/en-kr/collections/teething-pacifiers/products/lemon-teether-by-konges-slojd",
    title: "Lemon Teether by Konges Sløjd",
    brand: "Konges Sløjd",
    price: { amount: 36000, currency: "KRW" },
    material: "100% Natural Rubber",
    color: "Lemon",
    countryOfOrigin: "China",
    recommendedAge: "0 months+",
    optionGroups: [],
    representativeImageUrl:
      "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/61dfa1f7-0979-42c3-bcd9-33a2b5f378cc-0001.jpg",
    leafCategoryId: "50004425",
    categoryRequiresChildCertification: true,
    childCertificationInfoId: 1042,
    originAreaCode: "0200037",
    originAreaRequiresImporter: true,
  },
  {
    name: "Lucy Cut Out Sandals (PèPè)",
    sourceUrl: "https://www.junioredition.com/en-kr/collections/pepe-shoes/products/lucy-cut-out-sandals-in-kava-brown-by-pepe",
    title: "Lucy Cut Out Sandals in Kava Brown by PèPè",
    brand: "Pèpè Shoes",
    price: { amount: 210, currency: "GBP" },
    material: "100% leather",
    color: "Kava Brown",
    countryOfOrigin: "Italy",
    optionGroups: [
      { name: "Size", values: ["21 EUR (UK 4)", "22 EUR (UK 5)", "24 EUR (UK 7)", "26 EUR (UK 8)", "28 EUR (UK 10)", "29 EUR (UK 11)", "30 EUR (UK 11.5)", "32 EUR (UK 13)"] },
    ],
    variantPrices: [
      { amount: 210, currency: "GBP" }, { amount: 210, currency: "GBP" },
      { amount: 215, currency: "GBP" }, { amount: 215, currency: "GBP" },
      { amount: 215, currency: "GBP" }, { amount: 215, currency: "GBP" },
      { amount: 225, currency: "GBP" }, { amount: 225, currency: "GBP" },
    ],
    representativeImageUrl:
      "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/fa3780d4-567d-4af4-97c2-eefe026f9336-0001.jpg",
    leafCategoryId: "50004039",
    categoryRequiresChildCertification: true,
    childCertificationInfoId: 1042,
    originAreaCode: "0201038",
    originAreaRequiresImporter: true,
  },
];

function buildCanonicalProduct(spec: ProductSpec): CanonicalProduct {
  const groupNames = spec.optionGroups.map((g) => g.name);
  const variants = spec.optionGroups.length
    ? spec.optionGroups[0].values.map((v, i) => ({
        id: `v${i + 1}`,
        optionValues: { [groupNames[0]]: v },
        price: spec.variantPrices?.[i],
      }))
    : [];
  return {
    sourceUrl: spec.sourceUrl,
    title: field(spec.title, "shopify-json" as FieldSource),
    brand: field(spec.brand, "shopify-json" as FieldSource),
    price: field(spec.price, "shopify-json" as FieldSource),
    priceValidity: "VALID",
    sku: field(""),
    description: field(spec.title + " — 실제 원문 설명(요약)", "shopify-json" as FieldSource),
    material: field(spec.material, "shopify-json" as FieldSource),
    color: field(spec.color, "shopify-json" as FieldSource),
    recommendedAge: spec.recommendedAge ? field(spec.recommendedAge, "shopify-json" as FieldSource) : field("", REF),
    manufacturer: field("", REF),
    careInstructions: field("", REF),
    options: field(groupNames, "shopify-json" as FieldSource),
    optionGroups: spec.optionGroups,
    variants: variants as unknown as CanonicalProduct["variants"],
    images: [
      {
        id: "img-1",
        originalUrl: spec.representativeImageUrl,
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
    countryOfOrigin: field(spec.countryOfOrigin, "shopify-json" as FieldSource),
    returnPolicy: field(""),
    shippingFee: field(0),
    stockQuantity: field(1),
    certification: field(""),
    importer: field("", REF),
    // KC — 실제 원문에 없음(WebFetch 2026-08-17 재확인), 어떤 경우에도 채우지 않는다.
    childCertification: field(null),
    itemName: field("", REF),
    modelName: spec.modelName ? field(spec.modelName, "shopify-json" as FieldSource) : field("", REF),
    // Size 옵션이 있으면 resolveSizeFromOptions(스펙 근거)가 대체하므로 REQUIRED로
    // 둬도 무방하지만, Size 옵션이 아예 없는 상품(예: Lemon Teether)은 weight가
    // reference-eligible 화이트리스트에 있으므로(N-3.45) 상세페이지 참조로 대체한다
    // — 실제 원문에 중량 값 자체가 없기 때문(임의 값 금지, 참조는 정책상 허용됨).
    weight: spec.optionGroups.some((g) => /size|사이즈/i.test(g.name)) ? field("") : field("", REF),
    certificationType: field(""), // KC 대상 여부 — 실제 값 없음, 절대 REF 아님
  };
}

async function runOne(spec: ProductSpec) {
  console.log("\n================================================================");
  console.log("PRODUCT:", spec.name);
  const product = buildCanonicalProduct(spec);
  console.log("hasRealProductOptions:", hasRealProductOptions(product));

  const listing: ListingModel = {
    platform: "smartstore",
    platformLabel: "네이버 스마트스토어",
    representativeImage: spec.representativeImageUrl,
    additionalImages: [],
    title: spec.title,
    brand: spec.brand,
    // KRW 환산은 실제 register route가 실시간 환율로 하지만, 이 검증 스크립트는
    // 게이트 판정(READY/MISSING/BLOCKED)이 목적이라 원본 통화 금액을 그대로
    // 자리수만 맞춰 사용한다(0 이하만 아니면 salePrice>0 체크에는 영향 없음).
    priceKrw: spec.price.currency === "KRW" ? spec.price.amount : Math.round(spec.price.amount * 1900),
    priceIsEstimate: spec.price.currency !== "KRW",
    options: [],
    shippingInfo: "",
    description: product.description.value,
    category: UNRESOLVED_CATEGORY,
    validations: [],
    registrableScore: 0,
  };

  const commonInput = {
    ...SELLER_COMMON,
    childCertificationInfoId: spec.childCertificationInfoId,
    originAreaCode: spec.originAreaCode,
  };

  const payload = buildNaverProductPayload({
    product,
    listing,
    leafCategoryId: spec.leafCategoryId,
    ...commonInput,
    sellerDeliveryFee: null,
    categoryRequiresChildCertification: spec.categoryRequiresChildCertification,
    originAreaRequiresContent: false,
  });

  const validation = validateNaverPayload(
    payload,
    {
      product,
      ...commonInput,
      returnCompaniesFetchFailed: false,
      originAreaRequiresImporter: spec.originAreaRequiresImporter,
    },
    spec.categoryRequiresChildCertification,
  );

  console.log("leafCategoryId:", spec.leafCategoryId, "| categoryRequiresChildCertification:", spec.categoryRequiresChildCertification);
  console.log("READY:", validation.readyCount, "MISSING:", validation.missingCount, "BLOCKED:", validation.blockedCount, "| ok:", validation.ok);
  for (const f of validation.fields) {
    if (f.status !== "READY") console.log(`  [${f.status}]${f.code ? ` (${f.code})` : ""} ${f.field} — ${f.reason ?? ""}`);
  }
  return { spec, product, listing, payload, validation };
}

async function main() {
  const results = [];
  for (const spec of PRODUCTS) {
    results.push(await runOne(spec));
  }
  console.log("\n\n=== N-3.49 STEP4 SUMMARY ===");
  for (const r of results) {
    console.log(
      `${r.spec.name.padEnd(30)} | ok=${String(r.validation.ok).padEnd(5)} | READY=${r.validation.readyCount} MISSING=${r.validation.missingCount} BLOCKED=${r.validation.blockedCount}`,
    );
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
