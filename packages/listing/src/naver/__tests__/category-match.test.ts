import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { generateNaverCategoryCandidates, type NaverLeafCategory } from "../category-match";

/** N-2.9 — 실제 production 응답에서 확인한 형태(GET /v1/categories?last=true)를
 * 그대로 사용한 최소 fixture. 전체 4999건 대신 이 테스트에 필요한 카테고리만
 * 추린다(id는 실제 확인한 값, 관계없는 카테고리 2개는 오탐 방지 확인용). */
const LEAF_CATEGORIES: NaverLeafCategory[] = [
  { id: "50000349", wholeCategoryName: "출산/육아>유아동잡화>모자" },
  { id: "50024239", wholeCategoryName: "패션잡화>모자>야구모자" },
  { id: "50000535", wholeCategoryName: "출산/육아>유아동의류>티셔츠" },
  { id: "50000001", wholeCategoryName: "식품>커피>원두커피믹스" },
  { id: "50000002", wholeCategoryName: "가전디지털>이어폰>블루투스이어폰" },
];

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/hamster-kid-cap",
    title: field("Hamster Kid Cap in Navy"),
    brand: field("The Animals Observatory"),
    price: field({ amount: 30000, currency: "KRW" }),
    sku: field(""),
    description: field("A cozy kids hat"),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
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
    breadcrumbPath: ["Kids", "Accessories", "Hats"],
    shopifyTags: "kids,hat,toddler",
    shopifyProductType: "Hats",
    ...overrides,
  } as CanonicalProduct;
}

describe("generateNaverCategoryCandidates", () => {
  it("실제 아동 모자 상품 — 아동 카테고리가 1순위 HIGH, 무관한 카테고리(식품/가전)는 후보에 없음", () => {
    const product = makeProduct();
    const candidates = generateNaverCategoryCandidates(product, LEAF_CATEGORIES, 5);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].categoryId).toBe("50000349");
    expect(candidates[0].confidence).toBe("HIGH");
    expect(candidates.some((c) => c.categoryId === "50000001")).toBe(false);
    expect(candidates.some((c) => c.categoryId === "50000002")).toBe(false);
  });

  it("아동 신호가 있는 상품이 성인 대상 카테고리보다 항상 높은 점수를 받는다", () => {
    const product = makeProduct();
    const candidates = generateNaverCategoryCandidates(product, LEAF_CATEGORIES, 5);
    const kidsCandidate = candidates.find((c) => c.categoryId === "50000349");
    const adultCandidate = candidates.find((c) => c.categoryId === "50024239");
    expect(kidsCandidate).toBeDefined();
    expect(adultCandidate).toBeDefined();
    expect(kidsCandidate!.score).toBeGreaterThan(adultCandidate!.score);
  });

  it("전자제품(무선 이어버즈)은 SmartStore 플로우 개선 STEP1 이후 가전/디지털 카테고리로 정확히 매칭된다", () => {
    // SmartStore 플로우 개선(CPO 지시 — "카테고리 추천 실패 원인 분석") 실측
    // 발견: "전자제품"류는 product-resolver.ts PRODUCT_TYPE_KEYWORDS에 항목이
    // 아예 없어 productType이 항상 null로 떨어졌고, generateNaverCategoryCandidates가
    // 그 즉시 빈 배열을 반환했다 — 이 테스트는 원래 그 gap을 문서화하던
    // 테스트였다. "가전/디지털" productType을 추가한 뒤에는 이 상품이 실제
    // Naver 리프 카테고리(가전디지털>이어폰>블루투스이어폰)로 정확히 매칭되는
    // 게 올바른 동작이다 — 빈 배열을 기대하는 건 더 이상 맞지 않다.
    const product = makeProduct({
      sourceUrl: "https://example.com/products/premium-wireless-earbuds-pro",
      title: field("Premium Wireless Earbuds Pro"),
      brand: field("SoundCo"),
      description: field("High quality bluetooth earbuds"),
      breadcrumbPath: ["Electronics", "Audio"],
      shopifyTags: "",
      shopifyProductType: "",
    });
    const candidates = generateNaverCategoryCandidates(product, LEAF_CATEGORIES, 5);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].categoryId).toBe("50000002");
    expect(candidates[0].confidence).toBe("HIGH");
    expect(candidates.some((c) => c.categoryId === "50000001")).toBe(false);
  });

  it("DOMAIN_PROFILES에 정말로 없는 상품유형(도자기 꽃병)은 여전히 임의 후보 대신 빈 배열을 반환한다", () => {
    const product = makeProduct({
      sourceUrl: "https://example.com/products/ceramic-vase",
      title: field("Handmade Ceramic Vase in Sand"),
      brand: field("Clayware Studio"),
      description: field("A beautiful handmade ceramic vase for your living room."),
      breadcrumbPath: [],
      shopifyTags: "",
      shopifyProductType: "",
    });
    const candidates = generateNaverCategoryCandidates(product, LEAF_CATEGORIES, 5);
    expect(candidates).toEqual([]);
  });

  it("limit 파라미터로 후보 개수를 제한한다", () => {
    const product = makeProduct();
    const candidates = generateNaverCategoryCandidates(product, LEAF_CATEGORIES, 1);
    expect(candidates.length).toBeLessThanOrEqual(1);
  });
});
