import type { CanonicalProduct } from "@commerce/shared";

export interface DemographicSignal {
  isKids: boolean;
  reasons: string[];
}

/**
 * 원본 사이트 제목/설명에 나이/성별 신호가 전혀 없는 경우가 실제로 있다(실측
 * 확인: Smallable의 "Bobo organic cotton T-shirt | Pale Pink" 설명은
 * "SIZE AND FIT / Loose fit / COMPOSITION / 100% Organic Cotton" 뿐이라
 * 키워드 스캔으로는 절대 못 잡는다) — 이럴 땐 브랜드 자체가 유일한 신호다.
 * 여기 없는 아동 전문 브랜드는 여전히 놓칠 수 있다(완전한 목록이 아니다) —
 * 게다가 같은 브랜드가 성인/키즈 라인을 이름만으로 구분 못 하는 경우도 있다
 * (실측 확인: Veja "Low Esplar Leather Lace-Up Sneakers | White" — Veja는
 * 성인화도 만들어서 KNOWN_KIDS_BRANDS에 넣을 수 없는데, 제목에도 나이 신호가
 * 없어 쿠팡 predict API가 "여성스니커즈"로 잘못 추측했다). 이런 경우
 * product.breadcrumbPath(사이트 자신의 분류 — 예: ["Home","Shoes","Children"])가
 * 남은 유일한 신호라 KIDS_KEYWORDS와 같은 방식으로 함께 검사한다.
 */
const KNOWN_KIDS_BRANDS = [
  "bobo choses",
  "bonton",
  "bonpoint",
  "caramel",
  "confetti",
  "hundred pieces",
  "jacadi",
  "konges sløjd",
  "liewood",
  "mini rodini",
  "molo",
  "petit bateau",
  "the new society",
  "tinycottons",
  "zara kids",
];

const KIDS_KEYWORDS = [
  "kids",
  "kid",
  "child",
  "children",
  "baby",
  "babies",
  "toddler",
  "infant",
  "junior",
  "newborn",
  "girl",
  "boy",
  "아동",
  "유아",
  "키즈",
  "베이비",
];

/**
 * P0(Category Resolver 품질) — CPO가 실측으로 발견한 문제: 쿠팡의
 * categorization/predict API는 상품명 텍스트만 보고 카테고리를 추측하는데,
 * "Bobo organic cotton T-shirt | Pale Pink"처럼 원본 사이트 제목에 나이/성별
 * 신호가 없으면 기본값(여성)으로 잘못 추측한다 — 실제로 여성 티셔츠(코드
 * 69446)로 등록된 사고가 확인됐다.
 *
 * 이 함수는 predict API를 호출하기 *전에* CartPilot이 이미 갖고 있는 신호로
 * "이거 아동 상품 맞다"를 판단해서, predict API에 보내는 질의문 자체를
 * 보정하는 데 쓴다(category-recommend 호출부 참고) — "추천(CartPilot 신호
 * 분석) → 검증(쿠팡 API, 보정된 질의로)" 순서를 구현한다.
 *
 * recommendedAge는 가장 강한 신호다 — 크롤링된 원본 사이트 설명에 "6-12
 * months"처럼 실제 나이 표기가 있어야만 채워지는 필드라(Notice Resolver가
 * 지어내지 않는다), 이게 있으면 다른 키워드보다 신뢰도가 훨씬 높다.
 */
export function detectKidsSignal(
  product: Pick<CanonicalProduct, "title" | "description" | "brand" | "recommendedAge" | "breadcrumbPath">,
): DemographicSignal {
  const reasons: string[] = [];

  if (product.recommendedAge.value.trim().length > 0) {
    reasons.push(`권장 사용연령 "${product.recommendedAge.value}" 확인됨`);
  }

  const brandLower = product.brand.value.trim().toLowerCase();
  if (KNOWN_KIDS_BRANDS.some((kidsBrand) => brandLower === kidsBrand || brandLower.includes(kidsBrand))) {
    reasons.push(`"${product.brand.value}"는 아동 전문 브랜드로 알려져 있음`);
  }

  const breadcrumbText = (product.breadcrumbPath ?? []).join(" ");
  const haystack =
    `${product.title.value} ${product.description.value} ${product.brand.value} ${breadcrumbText}`.toLowerCase();
  for (const keyword of KIDS_KEYWORDS) {
    // 짧은 키워드("kid","boy" 등)가 다른 단어 안에 우연히 포함되는 걸 막기 위해
    // 단어 경계로 매칭한다(예: "Boyfriend jeans"가 "boy"로 오탐되지 않게).
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(haystack)) {
      const fromBreadcrumb = product.breadcrumbPath?.some((segment) => pattern.test(segment));
      reasons.push(
        fromBreadcrumb
          ? `사이트 분류 경로("${product.breadcrumbPath?.join(" > ")}")에서 "${keyword}" 발견`
          : `"${keyword}" 키워드 발견`,
      );
    }
  }

  return { isKids: reasons.length > 0, reasons };
}
