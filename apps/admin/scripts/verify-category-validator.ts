/**
 * P0 버그 재현+검증 스크립트 — CPO가 실제 Wing 화면에서 발견한 "미리보기는
 * 등록가능성 100%인데 실제 등록은 CP001로 실패"를 코드 레벨에서 재현한다.
 * 브라우저 자동화가 이번에도 연결되지 않아 실제 UI 클릭 흐름 대신, UI가 쓰는
 * 것과 완전히 같은 순수 함수(coupangAdapter.toListingModel/
 * resolveVerifiedCategoryCode)를 실제 상황과 동일한 입력(내부 AI 추천 후보를
 * "선택"한 상태)으로 직접 호출해서 검증한다.
 */
import { coupangAdapter } from "@commerce/marketplace";
import { resolveVerifiedCategoryCode } from "@commerce/listing";
import type { CategorySelection } from "@commerce/category";
import type { CanonicalProduct } from "@commerce/shared";

const product: CanonicalProduct = {
  sourceUrl: "https://example.com/test",
  title: { value: "Test Baby Dress", source: "ORIGINAL", confidence: 1 },
  brand: { value: "Apolina", source: "ORIGINAL", confidence: 1 },
  price: { value: { amount: 30, currency: "GBP" }, source: "ORIGINAL", confidence: 1 },
  sku: { value: "", source: "ORIGINAL", confidence: 0 },
  description: { value: "A dress", source: "ORIGINAL", confidence: 1 },
  material: { value: "", source: "ORIGINAL", confidence: 0 },
  color: { value: "", source: "REQUIRED", confidence: 0 },
  recommendedAge: { value: "", source: "REQUIRED", confidence: 0 },
  manufacturer: { value: "", source: "REQUIRED", confidence: 0 },
  careInstructions: { value: "", source: "DEFAULT", confidence: 0 },
  options: { value: [], source: "ORIGINAL", confidence: 0 },
  optionGroups: [],
  variants: [],
  images: [
    {
      id: "1",
      originalUrl: "https://example.com/1.jpg",
      selectedVariant: "ORIGINAL",
      isRepresentative: true,
      useInProductGallery: true,
      useInDescription: false,
      classification: "PRODUCT",
    },
  ],
  titleKo: { value: "", source: "ORIGINAL", confidence: 0 },
  descriptionKo: { value: "", source: "ORIGINAL", confidence: 0 },
  keywords: { value: [], source: "ORIGINAL", confidence: 0 },
  seoTitle: { value: "", source: "ORIGINAL", confidence: 0 },
  seoDescription: { value: "", source: "ORIGINAL", confidence: 0 },
  countryOfOrigin: { value: "", source: "REQUIRED", confidence: 0 },
  returnPolicy: { value: "", source: "REQUIRED", confidence: 0 },
  shippingFee: { value: 0, source: "DEFAULT", confidence: 0.5 },
  stockQuantity: { value: 999, source: "DEFAULT", confidence: 0.5 },
  certification: { value: "", source: "DEFAULT", confidence: 1 },
  importer: { value: "", source: "REQUIRED", confidence: 0 },
  childCertification: { value: null, source: "REQUIRED", confidence: 0 },
  itemName: { value: "", source: "REQUIRED", confidence: 0 },
  modelName: { value: "", source: "REQUIRED", confidence: 0 },
  weight: { value: "", source: "REQUIRED", confidence: 0 },
  certificationType: { value: "", source: "REQUIRED", confidence: 0 },
};

// CommerceWorkspace의 CartPilot 내부 AI 추천(ruleBasedCategoryProvider)이 만드는
// 후보와 같은 모양 — isVerifiedPlatformCode가 없다(undefined).
const unverifiedSelection: CategorySelection = {
  state: "SELECTED",
  provenance: "USER_SELECTED",
  candidate: {
    id: "internal-fashion-dress",
    name: "원피스",
    path: ["패션", "여성의류", "원피스"],
    platform: "coupang",
    confidence: 0.8,
    reason: ["상품명에 dress 키워드 포함"],
    source: "rule",
    // isVerifiedPlatformCode 없음 — CartPilot 내부 카테고리 id일 뿐, 실제 쿠팡 코드가 아니다.
  },
};

const listing = coupangAdapter.toListingModel(product, unverifiedSelection);
const categoryValidation = listing.validations.find((v) => v.field === "category");
const realRegisterCategoryCode = resolveVerifiedCategoryCode(unverifiedSelection);

console.log("=== 시나리오: 내부 AI 추천 카테고리를 '선택'한 상태 ===");
console.log("Preview registrableScore:", listing.registrableScore);
console.log("category validation status:", categoryValidation?.status, "-", categoryValidation?.message);
console.log("실제 register가 쓸 displayCategoryCode:", realRegisterCategoryCode);
console.log();

const pass = categoryValidation?.status !== "PASS" && realRegisterCategoryCode === null;
console.log(
  pass
    ? "PASS — Preview도 이제 '카테고리 미확정'으로 정확히 표시함(등록 API와 일치)."
    : "FAIL — Preview와 실제 register API 판정이 여전히 다름(버그 재현됨).",
);

// 대조군: 실제 쿠팡 API가 준 검증된 후보를 선택했을 때는 정상적으로 PASS여야 한다.
const verifiedSelection: CategorySelection = {
  ...unverifiedSelection,
  candidate: { ...unverifiedSelection.candidate!, id: "81484", isVerifiedPlatformCode: true },
};
const verifiedListing = coupangAdapter.toListingModel(product, verifiedSelection);
const verifiedCategoryValidation = verifiedListing.validations.find((v) => v.field === "category");
const verifiedRealCode = resolveVerifiedCategoryCode(verifiedSelection);
console.log();
console.log("=== 대조군: 쿠팡 API 검증된 카테고리를 선택한 상태 ===");
console.log("category validation status:", verifiedCategoryValidation?.status);
console.log("실제 register가 쓸 displayCategoryCode:", verifiedRealCode);
console.log(
  verifiedCategoryValidation?.status === "PASS" && verifiedRealCode === 81484
    ? "PASS — 검증된 카테고리는 여전히 정상적으로 통과함(회귀 없음)."
    : "FAIL — 검증된 카테고리인데도 실패함(회귀 발생).",
);
