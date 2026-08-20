import type { CanonicalProduct } from "@commerce/shared";

/**
 * Sprint A-2.5(Category Resolver 2.0) — CPO 지시: "Predict API 중심 → CartPilot
 * Resolver 중심"으로 뒤집는다. 지금까지는 상품명 텍스트 하나만 쿠팡
 * categorization/predict API에 던지고 그 결과를 그대로 믿었다 — 실측으로 확인된
 * 사고 사례(Veja 스니커즈 → 여성스니커즈, Eastpak 백팩 → 여성백팩, 아동 모자 →
 * Reading & Phonics)는 전부 "상품명만으로는 판단할 신호가 없거나(성별/연령),
 * predict API 자체가 잡화류에서 부정확한" 경우였다.
 *
 * 이 모듈은 CartPilot이 이미 갖고 있는 여러 신호(Breadcrumb/JSON-LD
 * category/URL 경로/브랜드/제목·설명 키워드)를 종합해서 "이 상품은 무엇인가"를
 * 먼저 판단하고, 그 판단으로 predict API에 보내는 질의문을 보정한다 — predict
 * API를 참고 신호 중 하나로 격하시키되, 실제 쿠팡 카테고리 코드를 만들어내는 건
 * 여전히 predict API 몫이다(코드를 지어내지 않는다는 원칙은 유지).
 */

export type AgeGroup = "baby" | "kids" | "teen" | "adult" | "unknown";
export type Gender = "girl" | "boy" | "women" | "men" | "unisex" | "unknown";

export interface ResolverEvidence {
  source: "breadcrumb" | "url" | "jsonld_category" | "brand" | "keyword";
  /** 사람이 읽는 근거 문구 — Trace Log/UI 판단근거 목록에 그대로 쓴다. */
  label: string;
}

export interface ProductSignals {
  ageGroup: AgeGroup;
  gender: Gender;
  productType: string | null;
  evidence: ResolverEvidence[];
}

/** 나이 신호 — "가장 어린 신호"를 우선한다. baby > kids > teen > adult 순으로,
 * 여러 신호가 섞여 있으면(예: breadcrumb은 "Teen"인데 키워드에 "baby"가 있는
 * 경우는 실무상 거의 없다) 더 구체적/어린 쪽을 신뢰한다 — predict API가
 * 기본값으로 성인/여성 쪽에 치우치는 경향을 상쇄하는 방향이라 안전하다. */
const AGE_KEYWORDS: { group: AgeGroup; terms: string[] }[] = [
  { group: "baby", terms: ["baby", "babies", "newborn", "infant", "베이비", "유아"] },
  { group: "kids", terms: ["kids", "kid", "child", "children", "toddler", "아동", "키즈"] },
  { group: "teen", terms: ["teen", "teenager", "junior", "youth", "틴"] },
  { group: "adult", terms: ["adult", "women", "woman", "men", "man", "성인"] },
];

const GENDER_KEYWORDS: { gender: Gender; terms: string[] }[] = [
  { gender: "girl", terms: ["girl", "girls", "여아"] },
  { gender: "boy", terms: ["boy", "boys", "남아"] },
  { gender: "women", terms: ["women", "woman", "女", "여성"] },
  { gender: "men", terms: ["men", "man", "남성"] },
  { gender: "unisex", terms: ["unisex"] },
];

/** 원본 사이트 URL 경로(예: "/en/shoes/children/girl/trainers")도 사이트가
 * 스스로 분류해둔 값이라 breadcrumb과 같은 급의 신호다 — breadcrumb이 없는
 * 사이트(JSON-LD를 아예 안 쓰는 곳)에서도 URL은 거의 항상 있다. */
function extractUrlSegments(sourceUrl: string): string[] {
  try {
    const path = new URL(sourceUrl).pathname;
    return path
      .split("/")
      .map((s) => decodeURIComponent(s).replace(/[-_]/g, " ").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 제목/브랜드에 흔한 상품 유형 키워드 — 쿠팡 카테고리 트리와 1:1로 안 맞아도
 * "이게 신발/가방/모자류다"라는 방향성만 있으면 predict API 질의 보정에
 * 충분하다. 값은 한국어로 둬서 트레이스 로그/UI에 그대로 노출해도 자연스럽게
 * 한다. */
const PRODUCT_TYPE_KEYWORDS: { type: string; terms: string[] }[] = [
  {
    type: "신발",
    terms: [
      "sneaker",
      "sneakers",
      "trainer",
      "trainers",
      "shoe",
      "shoes",
      "boot",
      "boots",
      "sandal",
      "sandals",
      "loafer",
      "loafers",
      "slip-on",
      "slip-ons",
      "runner",
      "runners",
    ],
  },
  {
    type: "가방",
    terms: [
      "backpack",
      "backpacks",
      "bag",
      "bags",
      "tote",
      "satchel",
      "pouch",
      "duffle",
      "duffel",
      "crossbody",
      "sling",
      "purse",
      "handbag",
      "carryall",
    ],
  },
  { type: "모자", terms: ["hat", "hats", "beanie", "cap", "caps", "trucker"] },
  { type: "원피스", terms: ["dress", "dresses"] },
  { type: "티셔츠", terms: ["t-shirt", "tshirt", "tee"] },
  { type: "아우터", terms: ["jacket", "coat", "parka", "outerwear"] },
  { type: "니트", terms: ["sweater", "jumper", "knit", "cardigan", "sweatshirt"] },
  { type: "바지", terms: ["pants", "trousers", "jeans", "leggings", "denim"] },
  // N-E7(CEO 실측 버그) — 영어 "skirt"만 있어서 프랑스 브랜드 원본 데이터의
  // "jupe"(불어 스커트)를 놓쳤다. keyword-rules.ts의 Skirt 타입과 같은 이유로
  // 함께 추가한다.
  { type: "스커트", terms: ["skirt", "skirts", "jupe", "jupes"] },
  { type: "수영복", terms: ["swimwear", "swimsuit", "bikini"] },
  // Sprint A-2.6(Resolver Accuracy Validation) — CPO의 Golden Dataset에 Toy/Home/
  // Beauty가 포함되면서 실측으로 발견: 이 세 카테고리는 키워드 테이블에 항목이
  // 전혀 없어 productType이 항상 null로 나왔다(측정 전에는 드러나지 않던
  // 공백). 신발/가방/모자와 같은 방식으로 실제 상품 태그에서 관찰된 단어를
  // 채워넣는다.
  // Sprint A-2.6 실측 발견: "plush"는 봉제완구뿐 아니라 로브/블랭킷 같은 원단
  // 질감("extra plush feel")을 설명할 때도 흔히 쓰여 false positive를 냈다
  // (brooklinen.com robe 오분류 실측 확인) — "plush toy"/"stuffed animal"처럼
  // 두 단어 조합으로 좁혀서 원단 묘사와 구분한다.
  { type: "완구", terms: ["toy", "toys", "game", "puzzle", "plush toy", "stuffed animal", "playset"] },
  {
    type: "홈/리빙",
    terms: [
      "bedding",
      "sheet",
      "sheets",
      "duvet",
      "quilt",
      "blanket",
      "pillow",
      "pillowcase",
      "sham",
      "towel",
      "robe",
      "curtain",
      "rug",
      "cookware",
    ],
  },
  // N-3.33 — pfcandleco.com 실측(Blonde Hinoki HI-FI Candle, shopifyProductType:
  // "HI-FI Candle")으로 발견: "candle"이 기존엔 "홈/리빙"에 섞여 있어서
  // DOMAIN_PROFILES["홈/리빙"]의 침구/수건 계열 expect 키워드(홈웨어/쿠션/수건
  // 등)와 뒤섞여 실제로는 무관한 카테고리(여성언더웨어/잠옷, 신발용품 보호쿠션,
  // 손수건)가 후보로 나왔다(실측 재현 확인). 네이버 실제 카테고리 트리를
  // 전수조사(fetchNaverAllCategories, 4999개)한 결과 캔들은 침구류와 전혀 다른
  // 별도 브랜치("가구/인테리어 > 인테리어소품 > 아로마/캔들용품")에 있어서,
  // 침구류와 같은 productType으로 묶으면 안 된다 — 별도 타입으로 분리한다.
  { type: "캔들", terms: ["candle", "candles", "scented candle", "diffuser"] },
  // SmartStore 플로우 개선 STEP1(CPO 지시 — "카테고리 추천 실패 원인 분석")
  // 실측 확인: PRODUCT_TYPE_KEYWORDS에 없는 상품유형(가구/전자기기/반려동물
  // 용품/문구)은 productType이 항상 null로 떨어지고, generateNaverCategoryCandidates
  // (packages/listing/category-match.ts)가 그 즉시 빈 배열을 반환해 SmartStore
  // 후보가 0개가 된다 — Coupang은 predict API가 낮은 신뢰도로라도 뭔가는 주는
  // 반면 SmartStore는 이 닫힌 키워드 목록 밖이면 트리 탐색 자체를 시도하지
  // 않는다는 게 실제 원인이었다(verify-category-null-productType.ts로 검증).
  // 자주 나올 만한 4개 유형을 우선 추가한다 — candidate-scoring.ts의
  // DOMAIN_PROFILES에도 같은 이름으로 대응 항목을 추가해야 한다(두 표가
  // 어긋나면 조용히 실패한다, 위 주석 원칙과 동일).
  {
    type: "가구",
    terms: [
      "furniture",
      "chair",
      "table",
      "desk",
      "sofa",
      "couch",
      "bookshelf",
      "shelf",
      "cabinet",
      "drawer",
      "bed frame",
      "ottoman",
      "stool",
      "bench",
      "wardrobe",
      "nightstand",
    ],
  },
  {
    type: "가전/디지털",
    terms: [
      "mouse",
      "keyboard",
      "laptop",
      "headphone",
      "headphones",
      "earphone",
      "earphones",
      "earbuds",
      "speaker",
      "charger",
      "monitor",
      "webcam",
      "microwave",
      "blender",
      "vacuum cleaner",
      "air purifier",
      "humidifier",
    ],
  },
  {
    type: "반려동물용품",
    terms: [
      "dog leash",
      "dog collar",
      "pet bed",
      "pet food",
      "cat litter",
      "aquarium",
      "pet carrier",
      "dog bowl",
      "cat toy",
      "dog toy",
    ],
  },
  {
    type: "문구/사무용품",
    terms: [
      "notepad",
      "spiral notebook",
      "stationery",
      "sticky note",
      "planner",
      "desk organizer",
      "pencil case",
      "highlighter",
      "fountain pen",
      "ballpoint pen",
    ],
  },
  {
    type: "뷰티",
    terms: [
      "makeup",
      "skincare",
      "cosmetic",
      "cosmetics",
      "balm",
      "serum",
      "cleanser",
      "moisturizer",
      "lipstick",
      "mascara",
      "foundation",
      "blush",
      "lotion",
      "shampoo",
      "conditioner",
      "deodorant",
      "brow",
      "concealer",
      // Sprint A-2.6 실측 발견(kosas.com "Cloud Set Loose", product_type:
      // "Setting Powder"): 단독 "powder"는 베이비파우더/세탁세제/단백질보충제
      // 등과 겹쳐 위험해서 "setting powder"로 좁힌다.
      "setting powder",
    ],
  },
];

function findMatch<T extends string>(
  haystack: string,
  table: { terms: string[]; value: T }[],
): { value: T; term: string } | null {
  for (const { terms, value } of table) {
    for (const term of terms) {
      if (new RegExp(`\\b${term}\\b`, "i").test(haystack)) return { value, term };
    }
  }
  return null;
}

/**
 * 여러 소스(breadcrumb/URL/키워드)에서 나온 개별 매치들을 하나의 최종 값으로
 * 합친다 — 소스마다 신뢰도가 다르므로(breadcrumb·URL은 사이트 자체 분류라 가장
 * 믿을만하고, 제목/설명 키워드는 그보다 약함) 우선순위 순서대로 첫 매치를
 * 채택한다. 매치가 있었던 소스는 evidence로 전부 남긴다(설명 가능성).
 */
function resolveAgeAndGender(
  sources: { source: ResolverEvidence["source"]; text: string }[],
): { ageGroup: AgeGroup; gender: Gender; evidence: ResolverEvidence[] } {
  const evidence: ResolverEvidence[] = [];
  let ageGroup: AgeGroup = "unknown";
  let gender: Gender = "unknown";

  for (const { source, text } of sources) {
    if (!text) continue;
    if (ageGroup === "unknown") {
      const ageTable = AGE_KEYWORDS.map((a) => ({ terms: a.terms, value: a.group }));
      const match = findMatch(text, ageTable);
      if (match) {
        ageGroup = match.value;
        evidence.push({ source, label: `${sourceLabel(source)}에서 연령대 "${match.term}" 발견 → ${match.value}` });
      }
    }
    if (gender === "unknown") {
      const genderTable = GENDER_KEYWORDS.map((g) => ({ terms: g.terms, value: g.gender }));
      const match = findMatch(text, genderTable);
      if (match) {
        gender = match.value;
        evidence.push({ source, label: `${sourceLabel(source)}에서 성별 "${match.term}" 발견 → ${match.value}` });
      }
    }
  }

  return { ageGroup, gender, evidence };
}

function sourceLabel(source: ResolverEvidence["source"]): string {
  switch (source) {
    case "breadcrumb":
      return "Breadcrumb";
    case "url":
      return "URL 경로";
    case "jsonld_category":
      return "JSON-LD 카테고리";
    case "brand":
      return "브랜드";
    case "keyword":
      return "제목/설명 키워드";
  }
}

/** KNOWN_KIDS_BRANDS는 demographic-signal.ts와 같은 목록을 쓴다 — 두 곳에 따로
 * 두면 한쪽만 갱신됐을 때 어긋난다(CP001과 같은 종류의 문제). */
import { KNOWN_KIDS_BRANDS } from "./demographic-signal";

/** Sprint A-2.6 실측 발견: plantoys.com(완구 전문 브랜드)의 "Farmers Market Mix
 * Basket" 같은 상품명은 "basket"/"market"/"harvest"류 단어만 쓰고 toy/game/
 * puzzle 같은 키워드가 전혀 없다 — product_type 필드도 비어 있어(Shopify에
 * 값을 안 채워둠) 키워드만으로는 상품유형을 알 수 없다. KNOWN_KIDS_BRANDS와
 * 같은 패턴으로, "이 브랜드는 완구만 판다"는 사실 자체를 신호로 쓴다(다른
 * 상품유형 키워드가 이미 매치됐으면 이 폴백은 쓰지 않는다 — 브랜드가 완구
 * 전문이어도 굿즈/의류를 같이 팔 수 있어서 키워드 매치가 항상 우선한다). */
const KNOWN_TOY_BRANDS = ["plantoys", "plan toys", "melissa & doug", "melissa and doug"];

/**
 * Category Resolver 2.0의 진입점 — CanonicalProduct가 이미 갖고 있는 모든
 * 신호(breadcrumbPath/jsonLdCategory/sourceUrl/brand/title/description)를
 * 모아 하나의 판단(연령대/성별/상품유형)으로 종합하고, 근거를 전부 남긴다.
 * predict API는 이 함수를 호출하는 쪽(category-recommend 호출부)에서 이
 * 판단으로 보정된 질의문을 받아 별도로 호출한다 — 이 함수 자체는 쿠팡을
 * 호출하지 않는다(순수 함수, 테스트하기 쉽게).
 */
export function resolveProductSignals(
  product: Pick<
    CanonicalProduct,
    | "title"
    | "description"
    | "brand"
    | "recommendedAge"
    | "breadcrumbPath"
    | "jsonLdCategory"
    | "sourceUrl"
    | "shopifyTags"
    | "shopifyProductType"
  >,
): ProductSignals {
  const breadcrumbText = (product.breadcrumbPath ?? []).join(" ");
  const urlSegments = extractUrlSegments(product.sourceUrl);
  const urlText = urlSegments.join(" ");
  const jsonLdCategoryText = product.jsonLdCategory ?? "";
  // Shopify tags/product_type — vendor 필드가 시즌코드 등으로 오염돼 브랜드
  // 신호를 못 쓰는 매장(bobochoses.com 실측)에서도 남아있는 나이·상품유형
  // 신호라 title/description과 같은 급(keyword)으로 취급한다.
  const keywordText =
    `${product.title.value} ${product.description.value} ` +
    `${product.shopifyTags ?? ""} ${product.shopifyProductType ?? ""}`;

  const { ageGroup, gender, evidence } = resolveAgeAndGender([
    { source: "breadcrumb", text: breadcrumbText },
    { source: "url", text: urlText },
    { source: "jsonld_category", text: jsonLdCategoryText },
    { source: "keyword", text: keywordText },
  ]);

  // recommendedAge(Notice Resolver가 원문에서 실제로 뽑은 "6-12 months" 같은
  // 표기)가 있으면 baby/kids 판정에 가장 강한 근거다 — 위 키워드 매칭보다
  // 우선해서 덮어쓴다.
  let finalAgeGroup = ageGroup;
  if (product.recommendedAge.value.trim()) {
    finalAgeGroup = /\bmonth/i.test(product.recommendedAge.value) ? "baby" : "kids";
    evidence.unshift({
      source: "keyword",
      label: `권장 사용연령 "${product.recommendedAge.value}" 확인됨 → ${finalAgeGroup}`,
    });
  }

  const brandLower = product.brand.value.trim().toLowerCase();
  const isKidsBrand = KNOWN_KIDS_BRANDS.some((b) => brandLower === b || brandLower.includes(b));
  if (isKidsBrand) {
    evidence.push({ source: "brand", label: `"${product.brand.value}"는 아동 전문 브랜드(Kids Brand)로 알려져 있음` });
    if (finalAgeGroup === "unknown" || finalAgeGroup === "adult") finalAgeGroup = "kids";
  }

  const productTypeTable = PRODUCT_TYPE_KEYWORDS.map((p) => ({ terms: p.terms, value: p.type }));
  const typeSources = [breadcrumbText, urlText, jsonLdCategoryText, keywordText].join(" ");
  const typeMatch = findMatch(typeSources, productTypeTable);
  if (typeMatch) {
    evidence.push({ source: "keyword", label: `상품 유형 키워드 "${typeMatch.term}" 발견 → ${typeMatch.value}` });
  }

  let productType = typeMatch?.value ?? null;
  if (!productType && KNOWN_TOY_BRANDS.some((b) => brandLower === b || brandLower.includes(b))) {
    productType = "완구";
    evidence.push({ source: "brand", label: `"${product.brand.value}"는 완구 전문 브랜드로 알려져 있음` });
  }

  return {
    ageGroup: finalAgeGroup,
    gender,
    productType,
    evidence,
  };
}

/** 판단(ProductSignals)으로 predict API에 보낼 질의문을 보정한다. 원래
 * 상품명은 그대로 두고 앞에 연령대+성별 단어만 덧붙인다 — 값을 지어내는 게
 * 아니라 "이미 알고 있는 것을 더 명시적으로 말해주는" 것뿐이라 안전하다.
 * 사용자가 직접 검색어를 입력했으면(originalQueryIsUserProvided) 이미 사람이
 * 확정한 의도라 보정하지 않는다. */
export function buildResolverBiasedQuery(
  signals: ProductSignals,
  baseQuery: string,
  originalQueryIsUserProvided: boolean,
): string {
  if (originalQueryIsUserProvided) return baseQuery;
  const prefixParts: string[] = [];
  const genderWord: Record<Gender, string | null> = {
    girl: "Girl",
    boy: "Boy",
    women: null, // "여성"은 predict API 기본값과 같은 방향이라 굳이 덧붙일 필요 없다.
    men: "Men",
    unisex: null,
    unknown: null,
  };
  const ageWord: Record<AgeGroup, string | null> = {
    baby: "Baby",
    kids: "Kids",
    teen: "Teen",
    adult: null,
    unknown: null,
  };
  if (ageWord[signals.ageGroup]) prefixParts.push(ageWord[signals.ageGroup] as string);
  if (genderWord[signals.gender]) prefixParts.push(genderWord[signals.gender] as string);
  if (prefixParts.length === 0) return baseQuery;
  return `${prefixParts.join(" ")} ${baseQuery}`;
}
