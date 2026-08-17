/**
 * N-3.49 STEP1-2 — KIDS 5종 후보의 실제 카테고리/KC대상여부를 프로덕션 실제
 * API로 조회한다(추정 금지). 상품 데이터는 이미 CartPilot이 실제로 수집해
 * Supabase에 저장해 둔 snapshot 5건에서 그대로 가져온다(재수집 안 함) —
 * snapshot id는 /api/snapshots 실측으로 확인:
 *   28cf88cf-2b47-4716-8a08-9f47106829ee Voyage Dress (Misha & Puff)
 *   d76cb7b6-12d1-4940-9c56-a73ff1bb2e7b Short Fiorenza (Arsène et Les Pipelettes)
 *   f9aeece9-4d36-4172-b020-531d763d1ca4 Jody Teddy Onesie (Konges Sløjd)
 *   148e1620-3c0d-4792-9821-0d80df728a9e Lemon Teether (Konges Sløjd)
 *   e560fdd1-950d-46b1-9870-92c6f86d8447 Lucy Cut Out Sandals (PèPè)
 *
 * 이 스크립트는 각 상품에 대해:
 *   1) POST /api/naver/category-search (실제 Naver 전체 카테고리 트리 + 실제
 *      매칭 로직)로 leaf 카테고리 후보를 받는다.
 *   2) 1위 후보의 categoryId로 GET /api/naver/resolve를 호출해
 *      requiresChildCertification/원산지 매칭/배송정보를 실측한다.
 * 둘 다 프로덕션에 배포된 실제 라우트(실제 Naver OAuth 토큰 사용)를 그대로
 * 호출한다 — 로컬에서 추정하지 않는다.
 */
const BASE_URL = "https://commerce-platform-mocha.vercel.app";

interface Candidate {
  title: string;
  brand: string;
  description: string;
  material: string;
  color: string;
  countryOfOrigin: string;
  recommendedAge?: string;
  shopifyTags?: string;
  shopifyProductType?: string;
  price: { amount: number; currency: string };
  optionGroups: { name: string; values: string[] }[];
  variantPrices?: { amount: number; currency: string }[];
  kcKeywordFound: boolean;
}

const CANDIDATES: Candidate[] = [
  {
    title: "Voyage Dress in Bright Sky Blossom Plaid by Misha & Puff",
    brand: "Misha & Puff",
    description:
      "Voyage Dress by Misha & Puff. A dress in lightweight organic cotton plaid, with a woven textured design, rounded collar, elbow-length sleeves, gathered waist, ruffle trim with edge detail, and a double-breasted corozo button closure.",
    material: "100% Organic Cotton",
    color: "Bright Sky Blossom Plaid",
    countryOfOrigin: "Peru",
    shopifyTags: "dresses, dresses-and-skirts, misha-and-puff-sale, misha-puff",
    shopifyProductType: "Dress",
    price: { amount: 88, currency: "GBP" },
    optionGroups: [{ name: "Size", values: ["3 Years", "4 Years", "5 Years", "6 Years", "8 Years", "10 Years"] }],
    variantPrices: Array(6).fill({ amount: 88, currency: "GBP" }),
    kcKeywordFound: false,
  },
  // N-3.49(재선정) — Short Fiorenza(smallable.com, shopifyTags/ProductType 없음)는
  // 실제 category-search API를 호출했더니 candidates:[]가 나왔다(카테고리 자동
  // 매칭 자체가 실패하는 진짜 케이스, 별도로 기록). 5개 실등록 후보로는 부적합해
  // Bobo Choses Sweatshirt(junioredition.com, Shopify라 shopifyTags/ProductType
  // 있음)로 교체한다 — Short Fiorenza는 "카테고리 자동 매칭 실패" 사례로 별도 보존.
  {
    title: "Bobo Choses Color Block Zipped Sweatshirt by Bobo Choses",
    brand: "Bobo Choses",
    description:
      "Bobo Choses Color Block Zipped Sweatshirt by Bobo Choses. Multicolour sweatshirt featuring a front zip fastening, elasticated bottom, elasticated cuffs, a loose fit and a high neck. Colour - Multi. 72% Organic Cotton, 28% Recycled Polyester. Product code B126AC050 SS26 Made in Spain.",
    material: "72% Organic Cotton, 28% Recycled Polyester",
    color: "Multi",
    countryOfOrigin: "Spain",
    shopifyTags: "bobo-choses, sweatshirts, tops",
    shopifyProductType: "Sweatshirt",
    price: { amount: 63, currency: "GBP" },
    optionGroups: [{ name: "Size", values: ["4-5 Years", "6-7 Years", "8-9 Years", "10-11 Years", "12-13 Years"] }],
    variantPrices: Array(5).fill({ amount: 63, currency: "GBP" }),
    kcKeywordFound: false,
  },
  {
    title: "Jody Teddy Onesie in Erba Stripe by Konges Sløjd",
    brand: "Konges Slojd Clothing",
    description:
      "Jody Teddy Onesie by Konges Sløjd. Hooded one piece in soft and comfortable pile fleece material. Designed with a full front zipper closure and warm inside fleece lining.",
    material: "100% Recycled Polyester, 100% Cotton Lining",
    color: "Erba Stripe",
    countryOfOrigin: "China",
    shopifyTags: "0-3-months, konges-slojd, new baby, outerwear, pc-made-in-china",
    shopifyProductType: "Baby One-Piece",
    price: { amount: 139500, currency: "KRW" },
    optionGroups: [{ name: "Size", values: ["3 Months", "6 Months", "9 Months", "12 Months", "18 Months"] }],
    variantPrices: Array(5).fill({ amount: 139500, currency: "KRW" }),
    kcKeywordFound: false,
  },
  {
    title: "Lemon Teether by Konges Sløjd",
    brand: "Konges Sløjd",
    description:
      "Lemon Teether by Konges Sløjd. Cute little teether toy made in the signature lemon design that is easy to grab and hold. The teether is crafted from 100% natural rubber and designed with smooth edges without any holes, making it a safe and sanitary choice for your baby.",
    material: "100% Natural Rubber",
    color: "Lemon",
    countryOfOrigin: "China",
    recommendedAge: "0 months+",
    shopifyTags: "all-baby, baby, baby-toys, konges-slojd, pc-made-in-china, Teether, toys-0-6-months",
    shopifyProductType: "Teether",
    price: { amount: 36000, currency: "KRW" },
    optionGroups: [],
    kcKeywordFound: false,
  },
  {
    title: "Lucy Cut Out Sandals in Kava Brown by PèPè",
    brand: "Pèpè Shoes",
    description:
      "Lucy cut out sandals by PèPè shoes. Velcro fastening buckle T bar shoes in vegetally tanned brown leather with cut out details. Handmade using traditional artisanal skills in Italy.",
    material: "100% leather",
    color: "Kava Brown",
    countryOfOrigin: "Italy",
    shopifyTags: "all-baby, baby, baby-shoes, footwear, pepe-shoes, shoes",
    shopifyProductType: "Shoes",
    price: { amount: 210, currency: "GBP" },
    optionGroups: [
      { name: "Size", values: ["21 EUR (UK 4)", "22 EUR (UK 5)", "24 EUR (UK 7)", "26 EUR (UK 8)", "28 EUR (UK 10)", "29 EUR (UK 11)", "30 EUR (UK 11.5)", "32 EUR (UK 13)"] },
    ],
    variantPrices: [
      { amount: 210, currency: "GBP" },
      { amount: 210, currency: "GBP" },
      { amount: 215, currency: "GBP" },
      { amount: 215, currency: "GBP" },
      { amount: 215, currency: "GBP" },
      { amount: 215, currency: "GBP" },
      { amount: 225, currency: "GBP" },
      { amount: 225, currency: "GBP" },
    ],
    kcKeywordFound: false,
  },
];

function field(value: unknown, source = "ORIGINAL") {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function toMinimalCanonicalProduct(c: Candidate) {
  return {
    sourceUrl: "https://example.com/products/" + encodeURIComponent(c.title),
    title: field(c.title),
    brand: field(c.brand),
    price: field(c.price),
    sku: field(""),
    description: field(c.description),
    material: field(c.material),
    color: field(c.color),
    recommendedAge: field(c.recommendedAge ?? ""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field(c.optionGroups.map((g) => g.name)),
    optionGroups: c.optionGroups,
    variants: [],
    images: [],
    titleKo: field(""),
    descriptionKo: field(""),
    keywords: field([]),
    seoTitle: field(""),
    seoDescription: field(""),
    countryOfOrigin: field(c.countryOfOrigin),
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
    shopifyTags: c.shopifyTags,
    shopifyProductType: c.shopifyProductType,
  };
}

async function main() {
  for (const c of CANDIDATES) {
    console.log("\n================================================================");
    console.log("PRODUCT:", c.title);
    console.log("brand:", c.brand, "| origin:", c.countryOfOrigin, "| material:", c.material);
    console.log("options:", JSON.stringify(c.optionGroups));

    const product = toMinimalCanonicalProduct(c);
    const searchRes = await fetch(`${BASE_URL}/api/naver/category-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    const searchJson = (await searchRes.json()) as {
      status: string;
      candidates?: { categoryId: string; name: string; score: number; path?: string[] }[];
      message?: string;
    };
    if (searchJson.status !== "OK" || !searchJson.candidates?.length) {
      console.log("CATEGORY SEARCH FAILED:", searchJson.status, searchJson.message);
      continue;
    }
    const top = searchJson.candidates[0];
    console.log("TOP CATEGORY CANDIDATE:", top.categoryId, top.name, "score:", top.score, "path:", top.path?.join(" > "));
    console.log("(2nd/3rd for reference):", searchJson.candidates.slice(1, 3).map((x) => `${x.categoryId}:${x.name}(${x.score})`).join(", "));

    const resolveUrl = new URL(`${BASE_URL}/api/naver/resolve`);
    resolveUrl.searchParams.set("categoryId", top.categoryId);
    resolveUrl.searchParams.set("countryOfOrigin", c.countryOfOrigin);
    resolveUrl.searchParams.set("brand", c.brand);
    const resolveRes = await fetch(resolveUrl.toString());
    const resolveJson = (await resolveRes.json()) as {
      status: string;
      category?: { requiresChildCertification: boolean; childCertificationInfoId: number | null; hierarchy?: unknown };
      address?: { releaseAddressBookNo: number | null; refundAddressBookNo: number | null };
      delivery?: { primaryReturnCompany?: { priorityType: string } | null; returnDeliveryFee: number | null; exchangeDeliveryFee: number | null };
      origin?: { resolvedCountryText: string | null; match: { status: string; code: string | null; requiresImporter: boolean } };
      notice?: { warrantyPolicy: string | null; afterServiceDirector: string | null };
      courier?: { available: boolean; value: string | null };
    };
    if (resolveJson.status !== "OK") {
      console.log("RESOLVE FAILED:", resolveJson.status);
      continue;
    }
    console.log("categoryRequiresChildCertification:", resolveJson.category?.requiresChildCertification);
    console.log("childCertificationInfoId:", resolveJson.category?.childCertificationInfoId);
    console.log("originAreaCode:", resolveJson.origin?.match.code, "requiresImporter:", resolveJson.origin?.match.requiresImporter);
    console.log("address:", JSON.stringify(resolveJson.address));
    console.log("courier:", JSON.stringify(resolveJson.courier));
    console.log("delivery:", JSON.stringify(resolveJson.delivery));
    console.log("KC keyword found on real product page:", c.kcKeywordFound, "(WebFetch 2026-08-17 재확인)");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
