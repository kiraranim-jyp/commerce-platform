import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import { scoreCategoryCandidate } from "../candidate-scoring";
import { KNOWN_KIDS_BRANDS } from "../demographic-signal";
import {
  CATEGORY_PROFILES,
  NAVER_SUPPORTED_NOTICE_TYPES,
  detectCategoryProfile,
  detectionMarketSourceScopes,
  fitCategoryPath,
  isNaverNoticeTypeSupported,
  sourceFitsScopes,
} from "../profiles";
import { ruleBasedCategoryProvider } from "../providers/rule-based.provider";

/**
 * TTAEJYO 2.0(CEO 지시 2026-09-12 · CPO 검증팩) — 카테고리 프로필.
 *
 * 이 파일이 지키는 약속은 두 줄이다:
 *   ① 아동(KIDS_FASHION)의 결과는 프로필이 생기기 전과 **똑같다**.
 *   ② 여성·잡화·라이프스타일에서 달라지는 것이 정확히 무엇인지 눈에 보인다.
 *
 * ②가 없으면 "일반화했다"는 말이 증명되지 않고, ①이 없으면 그 일반화가
 * 기존 사업을 깨뜨렸는지 알 수 없다. 검증팩 4종을 같은 파일에 나란히 두는
 * 이유도 그것이다 — 한 상품군만 통과하는 변경은 여기서 바로 드러난다.
 */
function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/x",
    title: field(""),
    brand: field(""),
    price: field({ amount: 100, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field(""),
    description: field(""),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
    careInstructions: field(""),
    options: field([]),
    optionGroups: [],
    variants: [],
    images: [],
    ...overrides,
  } as CanonicalProduct;
}

/* ───────────────────── ① 아동 — 기존과 동일해야 한다 ───────────────────── */

describe("KIDS_FASHION — 프로필 도입 전과 동작이 같다", () => {
  it("아동 프로필의 경로 어휘가 옛 KIDS_PATH_KEYWORDS와 같은 값이다", () => {
    // 이 값이 달라지는 순간 아동 상품의 카테고리 점수가 조용히 움직인다.
    expect(CATEGORY_PROFILES.KIDS_FASHION.platformPathKeywords).toEqual([
      "영유아동",
      "유아동",
      "아동",
      "주니어",
      "베이비",
      "키즈",
    ]);
    // 옛 ADULT_GENDERED_PATH_KEYWORDS.
    expect(CATEGORY_PROFILES.KIDS_FASHION.conflictPathKeywords).toEqual(["여성", "남성"]);
  });

  it("KNOWN_KIDS_BRANDS는 프로필로 옮긴 뒤에도 같은 목록이다", () => {
    expect(KNOWN_KIDS_BRANDS).toContain("bobo choses");
    expect(KNOWN_KIDS_BRANDS).toContain("misha & puff");
    expect(KNOWN_KIDS_BRANDS).toHaveLength(17);
    expect(KNOWN_KIDS_BRANDS).toBe(CATEGORY_PROFILES.KIDS_FASHION.brandHints);
  });

  it("아동 신호 + 아동 경로 = +5 가점(기존 그대로)", () => {
    const base = scoreCategoryCandidate("모자", [], { productType: "모자", ageGroup: "unknown", gender: "unknown" });
    const kids = scoreCategoryCandidate("모자", ["패션의류잡화", "영유아동 신발/잡화/기타의류(0~17세)", "남녀공용잡화"], {
      productType: "모자",
      ageGroup: "kids",
      gender: "unknown",
    });
    expect(base.score).toBe(95);
    expect(kids.score).toBe(100);
  });

  it("아동 신호 + 성인 경로 = -30 감점(기존 그대로)", () => {
    const adultPath = scoreCategoryCandidate("여성모자", ["패션잡화", "여성모자"], {
      productType: "모자",
      ageGroup: "kids",
      gender: "unknown",
    });
    expect(adultPath.score).toBe(65);
  });

  it("아동 상품의 1순위 추천은 여전히 유아동 경로다", () => {
    const product = makeProduct({
      title: field("Bobo Choses Kids Dress"),
      brand: field("Bobo Choses"),
      sourceUrl: "https://bobochoses.com/en/products/kids-dress",
    });
    const [top] = ruleBasedCategoryProvider.recommendCategory(product, "smartstore");
    expect(top.path).toEqual(["유아동패션", "유아동의류", "원피스"]);
  });
});

/* ───────────────────────── ② 여성 패션 — 신규 ───────────────────────── */

describe("WOMEN_FASHION — 여성 상품이 더 이상 유아동으로 가지 않는다", () => {
  const womenDress = makeProduct({
    title: field("Women Linen Dress"),
    brand: field("Voyage"),
    sourceUrl: "https://example.com/en/women/dresses/linen-dress",
  });

  it("연령·성별 신호로 여성 패션이 추정된다", () => {
    const detection = detectCategoryProfile({ ageGroup: "adult", gender: "women", productType: "원피스" });
    expect(detection?.profile.id).toBe("WOMEN_FASHION");
  });

  it("1순위 추천이 여성의류 경로가 된다(표는 그대로, 순서만 바뀐다)", () => {
    const candidates = ruleBasedCategoryProvider.recommendCategory(womenDress, "smartstore");
    expect(candidates[0].path).toEqual(["패션의류", "여성의류", "원피스"]);
    // 유아동 후보를 지우지 않는다 — 셀러가 "사실 아동용"이라고 판단할 여지를 남긴다.
    expect(candidates.map((c) => c.path)).toContainEqual(["유아동패션", "유아동의류", "원피스"]);
  });

  it("여성 신호일 때 유아동 카테고리가 감점된다(이번 스프린트가 고친 비대칭)", () => {
    const signals = { productType: "원피스", ageGroup: "adult", gender: "women" } as const;
    const kidsPath = scoreCategoryCandidate("원피스", ["유아동패션", "유아동의류"], signals);
    const womenPath = scoreCategoryCandidate("원피스", ["패션의류", "여성의류"], signals);
    expect(womenPath.score).toBeGreaterThan(kidsPath.score);
    expect(kidsPath.score).toBe(65);
  });

  it("임산부/수유는 하위 갈래로 잡히고 소스 범위만 넓어진다", () => {
    const detection = detectCategoryProfile(
      { ageGroup: "adult", gender: "women", productType: "원피스" },
      "maternity nursing dress",
    );
    expect(detection?.profile.id).toBe("WOMEN_FASHION");
    expect(detection?.subProfile?.id).toBe("MATERNITY");
    expect(detectionMarketSourceScopes(detection!)).toEqual(["WOMEN_FASHION", "MATERNITY"]);
  });
});

/* ──────────────────────── ③ 패션 잡화 — 신규 ──────────────────────── */

describe("FASHION_ACCESSORIES — 성인 잡화", () => {
  it("상품유형이 연령보다 먼저 프로필을 정한다", () => {
    const detection = detectCategoryProfile({ ageGroup: "unknown", gender: "unknown", productType: "가방" });
    expect(detection?.profile.id).toBe("FASHION_ACCESSORIES");
  });

  it("아동 신호가 있으면 잡화가 가로채지 않는다(유아동잡화가 실제 자리다)", () => {
    const detection = detectCategoryProfile({ ageGroup: "kids", gender: "girl", productType: "모자" });
    expect(detection?.profile.id).toBe("KIDS_FASHION");
  });

  it("성인 모자의 1순위가 패션잡화 경로가 된다", () => {
    const hat = makeProduct({
      title: field("Wool Bucket Hat"),
      sourceUrl: "https://example.com/accessories/hats/wool-bucket-hat",
    });
    const [top] = ruleBasedCategoryProvider.recommendCategory(hat, "smartstore");
    expect(top.path).toEqual(["패션잡화", "모자", "캡/버킷햇"]);
  });
});

/* ─────────────────── ④ 라이프스타일 — 진짜 시험대 ─────────────────── */

describe("HOME_LIFESTYLE — 이 엔진이 패션 전용이 아님을 증명한다", () => {
  it("리빙 상품유형으로 프로필이 잡힌다", () => {
    const detection = detectCategoryProfile({ ageGroup: "unknown", gender: "unknown", productType: "홈/리빙" });
    expect(detection?.profile.id).toBe("HOME_LIFESTYLE");
  });

  it("리빙 신호일 때 유아동 카테고리가 감점된다", () => {
    const signals = { productType: "홈/리빙", ageGroup: "unknown", gender: "unknown" } as const;
    expect(scoreCategoryCandidate("쿠션", ["유아동패션", "유아동잡화"], signals).score).toBeLessThan(
      scoreCategoryCandidate("쿠션", ["생활/건강", "침구"], signals).score,
    );
  });

  it("머그컵은 아직 상품유형이 잡히지 않아 프로필이 null이다 — 추측하지 않는다", () => {
    // PRODUCT_TYPE_KEYWORDS에 컵/머그 계열 어휘가 없다(cookware만 있다). 이건
    // 구조 문제가 아니라 어휘 공백이라, 없는 네이버 leaf 이름을 지어내서 채우지
    // 않는다. null이면 모든 보정과 필터가 꺼져 오늘 동작 그대로다.
    expect(detectCategoryProfile({ ageGroup: "unknown", gender: "unknown", productType: null })).toBeNull();
  });

  it("라이프스타일은 스마트스토어 고시유형이 아직 지원되지 않는다는 사실을 코드가 말한다", () => {
    // 머그컵의 고시유형은 KITCHEN_UTENSILS(용량·재질·구성품)인데 payload는
    // KIDS/WEAR만 만들 수 있다. 조용히 WEAR(소재·색상·치수)를 붙여 등록하면
    // 법적으로 틀린 고시정보가 나간다 — 그래서 "지원 안 함"을 사실로 남긴다.
    expect(isNaverNoticeTypeSupported(CATEGORY_PROFILES.HOME_LIFESTYLE)).toBe(false);
    expect(isNaverNoticeTypeSupported(CATEGORY_PROFILES.FASHION_ACCESSORIES)).toBe(false);
    expect(isNaverNoticeTypeSupported(CATEGORY_PROFILES.KIDS_FASHION)).toBe(true);
    expect(isNaverNoticeTypeSupported(CATEGORY_PROFILES.WOMEN_FASHION)).toBe(true);
    expect(NAVER_SUPPORTED_NOTICE_TYPES).toEqual(["KIDS", "WEAR"]);
  });
});

/* ───────────────────── 공통 규칙(프로필 자체의 계약) ───────────────────── */

describe("프로필 공통 계약", () => {
  it("근거가 없으면 프로필을 고르지 않는다", () => {
    expect(detectCategoryProfile({ ageGroup: "unknown", gender: "unknown", productType: null })).toBeNull();
  });

  it("경로에 근거가 없으면 UNKNOWN이다 — 틀렸다고 하지 않는다", () => {
    expect(fitCategoryPath(CATEGORY_PROFILES.WOMEN_FASHION, "스포츠/레저 요가 레깅스").fit).toBe("UNKNOWN");
  });

  it("category_scope를 주장하지 않은 소스는 모든 카테고리에서 검색된다", () => {
    // 관리자가 직접 추가한 소스는 기본값이 빈 배열이다. 빈 값을 "아무 데도 안
    // 맞음"으로 읽으면 그 소스가 조용히 사라진다.
    expect(sourceFitsScopes([], ["WOMEN_FASHION"])).toBe(true);
  });

  it("카테고리를 못 정하면 모든 소스를 그대로 검색한다(오늘 동작)", () => {
    expect(sourceFitsScopes(["KIDS_FASHION"], null)).toBe(true);
  });

  it("맞지 않는 카테고리의 소스는 제외된다", () => {
    expect(sourceFitsScopes(["KIDS_FASHION"], ["WOMEN_FASHION"])).toBe(false);
    expect(sourceFitsScopes(["KIDS_FASHION", "KIDS_GOODS"], ["MATERNITY", "KIDS_GOODS"])).toBe(true);
  });

  it("id에 구매자 층(Audience)을 넣지 않는다", () => {
    // 카테고리와 Target Audience는 다른 축이다. 한 번 섞이면 되돌릴 수 없다.
    for (const id of Object.keys(CATEGORY_PROFILES)) {
      expect(id).not.toMatch(/MOM|WOMEN_\d|_\d{4}|FAMILY/);
    }
  });
});
