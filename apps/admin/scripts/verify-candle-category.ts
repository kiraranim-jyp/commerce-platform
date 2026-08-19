/**
 * N-3.33 STEP 2/10 — pfcandleco.com "Blonde Hinoki HI-FI Candle"(N-3.31/32에서
 * 실측 추출한 데이터 그대로) 를 로컬에서 갱신된 카테고리 리졸버 코드로
 * 다시 돌려서, 실제 배포본(vercel)을 거치지 않고도 코드 변경 효과를 확인한다.
 * leafCategories는 /api/naver/category-tree(read-only, 실제 Naver 인증 데이터)로
 * 이미 조회해둔 4999개 전체 트리를 flat 목록으로 재구성한 캐시 파일을 쓴다 —
 * 새 API 호출 없음.
 */
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { resolveProductSignals } from "@commerce/category";
import { generateNaverCategoryCandidates, type NaverLeafCategory } from "@commerce/listing";
import * as fs from "node:fs";
import * as path from "node:path";

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

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

console.log("=== N-3.33 STEP2: resolveProductSignals ===");
const signals = resolveProductSignals(product);
console.log(JSON.stringify(signals, null, 2));

const cachePath = path.join(
  "C:\\Users\\김성길\\AppData\\Local\\Temp\\claude\\C--Users-----Documents-GitHub-truck-grease-reservation\\6315609f-42c7-4a2a-abad-4091734ced96\\scratchpad",
  "n333-flat-leaves.json",
);
const leafCategories: NaverLeafCategory[] = JSON.parse(fs.readFileSync(cachePath, "utf8"));
console.log(`\n=== leaf categories loaded: ${leafCategories.length} ===`);

const candidates = generateNaverCategoryCandidates(product, leafCategories, 5);
console.log("\n=== N-3.33 STEP2: category candidates ===");
console.log(`candidate count: ${candidates.length}`);
for (const c of candidates) {
  console.log(`[${c.confidence} ${c.score}] ${c.categoryId} — ${c.categoryPath.join(" > ")}`);
  console.log(`  reason: ${c.reason}`);
}
