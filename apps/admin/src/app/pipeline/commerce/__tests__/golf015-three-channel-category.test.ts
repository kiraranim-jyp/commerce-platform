import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import {
  detectCategoryProfile,
  getProductTypeExpectKeywords,
  resolveProductSignals,
  scoreCategoryCandidate,
} from "@commerce/category";
import { generateNaverCategoryCandidates } from "@commerce/listing";
import { recommendLotteOnStandardCategories, type LotteOnStandardCategory } from "../lotteon-category";
import { readSourceAt, stripComments } from "./source-text";

/**
 * GOLF-01.5 축 B(CEO 지시, 2026-09-16) — **시장조사 카테고리와 커머스 등록
 * 카테고리를 갈라라**는 지적을 실측한 결과, 두 카테고리는 이미 갈라져 있었고
 * (셀러가 고른 marketCategoryProfileId는 세 채널 추천 경로 어디에도 전달되지
 * 않는다) 진짜 고장은 다른 곳이었다:
 *
 *   추천 엔진의 상품유형 어휘(product-resolver.ts PRODUCT_TYPE_KEYWORDS)에
 *   골프가 한 줄도 없어 productType이 **null**로 떨어지고, 그 null 하나가 세
 *   채널의 카테고리 추천을 «동시에» 무너뜨린다.
 *
 * 수정 전 실측(실상품 lazrusgolf.com "Lazrus Golf LAZ2-D Adjustable Driver"):
 *   SmartStore  후보 0개(트리를 훑지도 않는다)
 *   Coupang     모든 후보 50점 동점 · 트리 탐색 보강 비활성
 *   LotteON     모든 후보 50점 동점 → 1순위가 "유아동의류 > 티셔츠"
 *
 * 이 파일은 그 세 줄이 다시 돌아오지 못하게 고정한다. 판정 기계장치를 새로
 * 만들지 않고, 각 채널이 **실제로 쓰는 함수 그대로** 부른다.
 */

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

function makeProduct(overrides: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    sourceUrl: "https://example.com/products/x",
    title: field(""),
    brand: field(""),
    price: field({ amount: 100, currency: "USD" }),
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

/** 실상품 — lazrusgolf.com/products/lazrus-golf-laz2-d-10-5-adjustable-driver.json
 *  (2026-09-16 실제 200 응답의 title/vendor/body_html/product_type/tags 그대로). */
function golfDriver(title = "Lazrus Golf LAZ2-D Adjustable Driver"): CanonicalProduct {
  return makeProduct({
    sourceUrl: "https://lazrusgolf.com/products/lazrus-golf-laz2-d-10-5-adjustable-driver",
    title: field(title),
    brand: field("LAZRUS Golf"),
    description: field(
      "Lazrus Golf LAZ2-D Adjustable Driver (Head Cover Included) Available in 9° and 10.5°. " +
        "The loft is adjustable 2 degrees each way. Experience unparalleled performance with the new " +
        "LAZ2-D Adjustable Driver, engineered to give you the ultimate edge on the course.",
    ),
    shopifyProductType: "Driver",
    shopifyTags: "Best Seller, Distance, LAZ2",
  } as Partial<CanonicalProduct>);
}

/** 실상품 — bobochoses.com/products/b226ac035-beast-sweatshirt.json
 *  (golden-dataset.ts의 첫 항목. 아동 무회귀 대조군). */
function kidsSweatshirt(): CanonicalProduct {
  return makeProduct({
    sourceUrl: "https://bobochoses.com/products/b226ac035-beast-sweatshirt",
    title: field("Beast sweatshirt"),
    brand: field("Bobo Choses"),
    description: field("Beige sweatshirt. Cotton 66%, Organic Cotton 34%. Loose fit. Responsibly made in Spain."),
    shopifyProductType: "Sweatshirts",
    shopifyTags: "aw26, children, clothing, Current, drop-1, Kid, sweatshirts",
  } as Partial<CanonicalProduct>);
}

/**
 * 한 트리에 골프 자리와 아동/여성 자리를 **함께** 둔다. 정답이 트리에 있는데도
 * 골프만 후보가 0이면 원인은 트리가 아니라 상품 어휘라는 것이 증명되고,
 * 같은 트리로 아동 상품을 돌리면 무회귀까지 한 번에 보인다.
 * 경로 문자열은 CEO 지시문이 직접 적은 채널별 경로를 그대로 쓴다.
 */
const NAVER_LEAVES = [
  { id: "50000167", wholeCategoryName: "출산/육아>유아동의류>티셔츠" },
  { id: "50000168", wholeCategoryName: "출산/육아>유아동의류>맨투맨/후드티" },
  { id: "50000803", wholeCategoryName: "패션의류>여성의류>맨투맨/스웨트셔츠" },
  { id: "50004780", wholeCategoryName: "스포츠/레저>골프>골프클럽>드라이버" },
  { id: "50004781", wholeCategoryName: "스포츠/레저>골프>골프클럽>아이언" },
  { id: "50004782", wholeCategoryName: "스포츠/레저>골프>골프클럽>퍼터" },
  { id: "50004790", wholeCategoryName: "스포츠/레저>골프>골프공" },
  { id: "50004801", wholeCategoryName: "스포츠/레저>골프>골프웨어>여성골프웨어" },
];

function lotteLeaf(id: string, name: string, parentName: string): LotteOnStandardCategory {
  return {
    id,
    name,
    parentId: `P-${parentName}`,
    depth: 3,
    leaf: true,
    usable: true,
    displayCategories: [],
    noticeItemCodes: [],
    taxTypeCode: null,
    ageLimitCode: null,
    safetyTypeCodes: [],
  };
}
function lotteParent(name: string): LotteOnStandardCategory {
  return { ...lotteLeaf(`P-${name}`, name, ""), parentId: null, depth: 2, leaf: false };
}
/** 아동 자리를 **앞**에 둔다 — 동점이면 순위가 트리 순서가 된다는 옛 증상이
 *  되살아나는 순간 아래 기대값이 깨지도록 일부러 불리하게 배치한 것이다. */
const LOTTEON_CATEGORIES: LotteOnStandardCategory[] = [
  lotteParent("유아동의류"),
  lotteParent("여성의류"),
  lotteParent("골프클럽"),
  lotteLeaf("L001", "티셔츠", "유아동의류"),
  lotteLeaf("L002", "맨투맨/후드티", "유아동의류"),
  lotteLeaf("L004", "맨투맨", "여성의류"),
  lotteLeaf("L010", "드라이버", "골프클럽"),
  lotteLeaf("L011", "아이언", "골프클럽"),
];

/** 쿠팡 경로 — CEO 지시문 원문("스포츠/레저 > 골프 > 골프채 > 드라이버").
 *  3단계 이름이 네이버("골프클럽")와 다르다는 것이 이 줄의 요점이다. */
const COUPANG_DRIVER_PATH = ["스포츠/레저", "골프", "골프채", "드라이버"];
const COUPANG_KIDS_PATH = ["패션의류/잡화", "유아동패션", "유아동의류", "상의", "맨투맨"];

describe("GOLF-01.5 축 B ① 골프 드라이버 — 세 채널이 각자 «자기» 카테고리를 낸다", () => {
  it("🔴 상품유형이 null이 아니라 골프드라이버로 판정된다(세 채널이 전부 이 값에 매달려 있다)", () => {
    const signals = resolveProductSignals(golfDriver());
    expect(signals.productType, "productType이 null이면 세 채널이 동시에 무너진다").toBe("골프드라이버");
    expect(getProductTypeExpectKeywords("골프드라이버")).toContain("드라이버");
    // 채널마다 3단계 이름이 다르다 — 둘 다 없으면 한쪽 채널에서만 후보가 0개가 된다.
    expect(getProductTypeExpectKeywords("골프드라이버")).toContain("골프클럽");
    expect(getProductTypeExpectKeywords("골프드라이버")).toContain("골프채");
  });

  it("🔴 SmartStore — 1순위가 '스포츠/레저 > 골프 > 골프클럽 > 드라이버'다", () => {
    const candidates = generateNaverCategoryCandidates(golfDriver(), NAVER_LEAVES, 5);
    expect(candidates.length, "후보 0개 — 수정 전 증상 그대로다").toBeGreaterThan(0);
    expect(candidates[0]!.categoryPath).toEqual(["스포츠/레저", "골프", "골프클럽", "드라이버"]);
    expect(candidates[0]!.score).toBeGreaterThanOrEqual(95);
    expect(candidates[0]!.confidence).toBe("HIGH");
    // 아동/여성 자리는 후보에 아예 오지 않는다.
    for (const c of candidates) expect(c.categoryPath.join(">")).not.toContain("유아동");
  });

  it("🔴 Coupang — 쿠팡 자신의 경로(골프«채»)에서 95점이고, 아동 경로는 충돌로 떨어진다", () => {
    const signals = resolveProductSignals(golfDriver());
    const driver = scoreCategoryCandidate("드라이버", COUPANG_DRIVER_PATH, signals);
    expect(driver.conflict).toBe(false);
    // 쿠팡 resolver의 AUTO_SELECT 임계값이 95다.
    expect(driver.score).toBeGreaterThanOrEqual(95);

    const kids = scoreCategoryCandidate("맨투맨", COUPANG_KIDS_PATH, signals);
    expect(kids.conflict, "골프 드라이버에 유아동의류가 아직 정상 후보로 남아 있다").toBe(true);
  });

  it("🔴 LotteON — AUTO_SELECT이고 1순위가 '골프클럽 > 드라이버'다(트리에서 아동이 앞에 있어도)", () => {
    const result = recommendLotteOnStandardCategories(golfDriver(), LOTTEON_CATEGORIES, { limit: 5 });
    expect(result.candidates[0]!.path).toEqual(["골프클럽", "드라이버"]);
    expect(result.decision).toBe("AUTO_SELECT");
    // 옛 증상: 상위 후보 점수가 전부 같아 순위가 "점수"가 아니라 "트리 순서"였다.
    const scores = new Set(result.candidates.map((c) => c.score));
    expect(scores.size, "상위 후보 점수가 전부 같다 — 순위가 트리 순서일 뿐이다").toBeGreaterThan(1);
  });
});

describe("GOLF-01.5 축 B ② Q4 — 아동/여성 어휘가 골프 상품을 가로채지 않는다", () => {
  /** 수정 전 실측: "Women's ... Driver"는 WOMEN_FASHION으로 판정돼 «여성 맨투맨»이
   *  58점으로 골프 드라이버(50점)를 이겼다. "Junior Kids ... Driver"는 «유아동
   *  티셔츠»가 55점으로 이겼다. 제목 한 단어가 카테고리를 바꾸면 안 된다. */
  const variants: [string, string][] = [
    ["여성용 표기", "Lazrus Golf LAZ2-D Women's Adjustable Driver"],
    ["주니어 표기", "Lazrus Golf Junior Kids Adjustable Driver"],
  ];

  for (const [label, title] of variants) {
    it(`🔴 ${label}가 붙어도 세 채널 1순위가 드라이버 자리다`, () => {
      const product = golfDriver(title);
      const signals = resolveProductSignals(product);
      expect(signals.productType).toBe("골프드라이버");

      const naver = generateNaverCategoryCandidates(product, NAVER_LEAVES, 5);
      expect(naver[0]!.categoryPath).toEqual(["스포츠/레저", "골프", "골프클럽", "드라이버"]);

      const lotte = recommendLotteOnStandardCategories(product, LOTTEON_CATEGORIES, { limit: 5 });
      expect(lotte.candidates[0]!.path).toEqual(["골프클럽", "드라이버"]);

      expect(scoreCategoryCandidate("드라이버", COUPANG_DRIVER_PATH, signals).score).toBeGreaterThanOrEqual(95);
    });
  }

  it("🔴 시장조사 프로필 자동추정은 그대로 둔다 — GOLF 프로필은 여전히 구조적으로 선택 불가다", () => {
    // MARKET-CATEGORY-1(CEO 확정): 시장조사 카테고리는 셀러가 고른다, 추정하지 않는다.
    // 상품유형 어휘를 늘려도 profiles.ts의 GOLF는 productTypes가 비어 있어 골라질 수 없다.
    const product = golfDriver();
    const signals = resolveProductSignals(product);
    const detection = detectCategoryProfile(
      signals,
      `${product.title.value} ${product.description.value}`,
      product.brand.value,
    );
    expect(detection?.profile.id).not.toBe("GOLF");
  });
});

describe("GOLF-01.5 축 B ③ 두 카테고리는 섞이지 않는다 — 역방향 고정", () => {
  /**
   * CEO 판정("시장조사 카테고리와 커머스 등록 카테고리를 완전히 분리해야 한다")을
   * 실측한 결과 **이미 분리돼 있었다**. 셀러가 고른 시장조사 카테고리
   * (marketCategoryProfileId)는 세 채널의 카테고리 추천 호출 어디에도 실리지
   * 않는다 — 그 사실이 조용히 무너지지 않게 여기서 고정한다.
   */
  const naverRoute = stripComments(readSourceAt(new URL("../../../api/naver/category-search/route.ts", import.meta.url)));
  const coupangRoute = stripComments(
    readSourceAt(new URL("../../../api/coupang/category-recommend/route.ts", import.meta.url)),
  );
  const lotteRoute = stripComments(
    readSourceAt(new URL("../../../api/lotteon/category-recommend/route.ts", import.meta.url)),
  );

  it("🔴 세 채널 추천 라우트 어디에도 시장조사 카테고리가 들어오지 않는다", () => {
    for (const [name, source] of [
      ["naver/category-search", naverRoute],
      ["coupang/category-recommend", coupangRoute],
      ["lotteon/category-recommend", lotteRoute],
    ] as const) {
      expect(source, `${name}이 시장조사 카테고리를 읽는다 — 두 카테고리가 섞였다`).not.toContain(
        "marketCategoryProfileId",
      );
      expect(source, `${name}이 시장조사 프로필 표를 직접 고른다`).not.toContain("selectedMarketSourceScopes");
    }
  });

  it("🔴 추천 순수함수들의 입력에 프로필 id가 들어갈 자리가 아예 없다(타입 수준)", () => {
    // 세 함수 모두 (상품, 카테고리 목록/신호) 만 받는다 — 인자 개수가 늘어나면
    // 여기서 깨지고, 그때 "무엇을 더 받게 됐는지"를 사람이 다시 본다.
    expect(scoreCategoryCandidate.length).toBe(3); // (categoryName, categoryPath, signals)
    expect(generateNaverCategoryCandidates.length).toBe(2); // (product, leafCategories, limit=5)
    expect(recommendLotteOnStandardCategories.length).toBe(3); // (product, categories, options?)
  });
});

/* 화면(jsdom 마운트 + 실제 클릭) 증거는 형제 파일
 * golf015-category-panel-mount.test.ts 에 있다 — 이 파일은 import.meta.url이
 * file:이어야 하는 node 환경이라(위 readSourceAt) 한 파일에 둘 수 없다. */

describe("GOLF-01.5 축 B ④ 아동의류 무회귀 — 실상품으로 대조", () => {
  it("🔴 상품유형·판정 근거가 그대로다", () => {
    const signals = resolveProductSignals(kidsSweatshirt());
    expect(signals.productType).toBe("니트");
    expect(signals.ageGroup).toBe("kids");
    expect(getProductTypeExpectKeywords("니트")).toEqual(["니트", "가디건", "맨투맨", "스웨트", "후드"]);
  });

  it("🔴 SmartStore 후보와 점수가 그대로다(1순위 유아동 맨투맨/후드티 100점)", () => {
    const candidates = generateNaverCategoryCandidates(kidsSweatshirt(), NAVER_LEAVES, 5);
    expect(candidates[0]!.categoryPath).toEqual(["출산/육아", "유아동의류", "맨투맨/후드티"]);
    expect(candidates[0]!.score).toBe(100);
    expect(candidates[1]!.categoryPath).toEqual(["패션의류", "여성의류", "맨투맨/스웨트셔츠"]);
    expect(candidates[1]!.score).toBe(65);
  });

  it("🔴 LotteON 판정과 1순위가 그대로다", () => {
    const result = recommendLotteOnStandardCategories(kidsSweatshirt(), LOTTEON_CATEGORIES, { limit: 5 });
    expect(result.decision).toBe("AUTO_SELECT");
    expect(result.candidates[0]!.path).toEqual(["유아동의류", "맨투맨/후드티"]);
    expect(result.candidates[0]!.score).toBe(100);
  });

  it("🔴 골프 어휘는 «맨 뒤»에 붙어 있다 — 기존 유형을 하나라도 맞히는 상품은 골프에 도달하지 못한다", () => {
    // findMatch()는 표 순서대로 첫 매치를 채택한다. "driver"가 들어간 아동 상품을
    // 일부러 만들어도 상품유형은 여전히 기존 판정(니트)이어야 한다.
    const signals = resolveProductSignals(
      makeProduct({
        title: field("Kids sweatshirt with driver print"),
        brand: field("Bobo Choses"),
        description: field("Cotton sweatshirt."),
      } as Partial<CanonicalProduct>),
    );
    expect(signals.productType).toBe("니트");
  });
});
