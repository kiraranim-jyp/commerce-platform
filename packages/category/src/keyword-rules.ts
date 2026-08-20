export type ProductType =
  | "T-Shirt"
  | "Shirt"
  | "Pants"
  | "Leggings"
  | "Dress"
  | "Skirt"
  | "Jacket"
  | "Hoodie"
  | "Hat"
  | "Shoes"
  | "Swimwear"
  | "Accessories";

export const PRODUCT_TYPES: ProductType[] = [
  "T-Shirt",
  "Shirt",
  "Pants",
  "Leggings",
  "Dress",
  "Skirt",
  "Jacket",
  "Hoodie",
  "Hat",
  "Shoes",
  "Swimwear",
  "Accessories",
];

/**
 * "shirt"는 "t-shirt" 안에도 등장하는 부분 문자열이라 그대로 매칭하면 T-Shirt
 * 상품이 전부 Shirt로도 잡힌다. T-Shirt 계열 표기를 먼저 지워낸 텍스트에만
 * Shirt 키워드를 매칭해서 이 겹침을 없앤다 — 완벽한 NLP는 아니지만 이번 규칙
 * 기반 v1 범위에서는 이 정도 휴리스틱으로 충분하다.
 */
const T_SHIRT_MARKERS = /t-shirts?|tshirts?|티셔츠/gi;

export const KEYWORDS: Record<ProductType, string[]> = {
  "T-Shirt": ["t-shirt", "tshirt", "tee", "티셔츠", "반팔"],
  Shirt: ["shirt", "blouse", "셔츠", "남방", "블라우스"],
  Pants: ["pants", "trousers", "jeans", "denim", "바지", "팬츠", "청바지"],
  Leggings: ["leggings", "레깅스"],
  Dress: ["dress", "원피스", "드레스"],
  // N-E7(CEO 실측 버그 — "Emile et Ida / Iris Ecru Skirt"가 티셔츠로 오분류됨)
  // — Skirt가 ProductType enum에 아예 없어서 제목에 "skirt"가 있어도 후보
  // 생성 단계에서 무시됐다. 프랑스 브랜드 원본 데이터 대응을 위해 "jupe"(불어)도
  // 함께 추가한다(다른 타입들도 en/ko 혼용이라 같은 패턴).
  Skirt: ["skirt", "skirts", "jupe", "jupes", "스커트"],
  Jacket: ["jacket", "coat", "outerwear", "재킷", "자켓", "코트", "아우터"],
  Hoodie: ["hoodie", "sweatshirt", "후드", "맨투맨", "후드티"],
  Hat: ["hat", "cap", "beanie", "bucket hat", "모자", "버킷햇", "비니", "캡"],
  Shoes: ["shoes", "sneakers", "boots", "신발", "운동화", "부츠"],
  Swimwear: ["swim", "swimsuit", "swimwear", "bikini", "rash guard", "수영복", "래시가드", "비키니"],
  Accessories: ["scarf", "gloves", "socks", "bag", "beanie", "액세서리", "양말", "가방", "장갑", "스카프"],
};

/**
 * type의 키워드가 text 안에서 몇 번, 어디서(정확히 어떤 키워드로) 매칭됐는지 센다.
 * Shirt 타입만 T-Shirt 표기를 미리 제거한 텍스트로 검사한다(위 주석 참고).
 */
export function countKeywordMatches(
  type: ProductType,
  text: string,
): { count: number; matched: string[] } {
  const haystack = type === "Shirt" ? text.replace(T_SHIRT_MARKERS, " ") : text;
  const lower = haystack.toLowerCase();
  const matched: string[] = [];
  for (const keyword of KEYWORDS[type]) {
    if (lower.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    }
  }
  return { count: matched.length, matched };
}
