import type { ProductSignals } from "./product-resolver";

/**
 * Sprint A-5(Category Resolver 3.0) — CPO 지시: "쿠팡 Predict API를 그대로
 * 믿지 않는다." 실측으로 확인된 사고(파라슈트홈 베갯잇(홈 텍스타일)이 predict
 * API에서 "원두커피믹스"로 예측됨)는 predict API 결과를 검증 없이 그대로
 * 받아들여서 생긴 문제다. 이 모듈은 predict API가 돌려준 카테고리 "이름"이
 * CartPilot이 이미 판단한 상품유형(ProductSignals.productType)과 말이 되는지
 * 대조해서 0~100 유사도 점수를 매기는 순수 함수다 — 임베딩/AI 호출 없이, 이미
 * product-resolver.ts가 갖고 있는 productType 키워드 체계를 그대로 재사용한다
 * (판단 기준을 두 곳에 따로 두지 않는다).
 */

interface DomainProfile {
  /** 카테고리 이름/경로에 이 중 하나라도 있으면 상품유형과 일치한다는 강한 신호. */
  expect: string[];
  /** 카테고리 이름/경로에 이 중 하나라도 있으면 명백히 다른 도메인 — 즉시 감점(Reject 후보). */
  conflict: string[];
}

/** 어느 상품유형이든 절대 섞이면 안 되는 식품/음료 계열 — 이번 사고(베갯잇→
 * 원두커피믹스)의 정확한 재현 방지 대상. 의류/신발/가방/모자/완구/홈/뷰티 중
 * 어디에도 식품 카테고리가 정답일 수 없다. */
const FOOD_KEYWORDS = ["식품", "커피", "차류", "음료", "과자", "라면", "주류", "건강식품", "시리얼", "분유", "간식"];

const APPAREL_EXPECT = ["의류", "티셔츠", "니트", "원피스", "아우터", "바지", "스커트", "수영복", "맨투맨", "자켓"];
const APPAREL_CONFLICT = [...FOOD_KEYWORDS, "가전", "침구", "완구", "신발", "가방"];

/** product-resolver.ts의 PRODUCT_TYPE_KEYWORDS가 만들어내는 productType
 * 문자열(예: "신발", "홈/리빙")을 이 표의 키로 그대로 쓴다 — 두 표가 어긋나면
 * "상품유형은 신발인데 도메인 프로필이 없다" 같은 조용한 실패가 생기므로, 값이
 * 완전히 같은 문자열이어야 한다. */
const DOMAIN_PROFILES: Record<string, DomainProfile> = {
  신발: { expect: ["신발", "스니커즈", "운동화", "부츠", "샌들", "로퍼"], conflict: [...FOOD_KEYWORDS, "가전", "침구", "완구"] },
  가방: { expect: ["가방", "백팩", "숄더백", "크로스백", "파우치", "지갑"], conflict: [...FOOD_KEYWORDS, "가전", "침구", "완구", "신발"] },
  모자: { expect: ["모자", "캡", "비니"], conflict: [...FOOD_KEYWORDS, "가전", "침구", "완구"] },
  원피스: { expect: APPAREL_EXPECT, conflict: APPAREL_CONFLICT },
  티셔츠: { expect: APPAREL_EXPECT, conflict: APPAREL_CONFLICT },
  아우터: { expect: APPAREL_EXPECT, conflict: APPAREL_CONFLICT },
  니트: { expect: APPAREL_EXPECT, conflict: APPAREL_CONFLICT },
  바지: { expect: APPAREL_EXPECT, conflict: APPAREL_CONFLICT },
  스커트: { expect: APPAREL_EXPECT, conflict: APPAREL_CONFLICT },
  수영복: { expect: APPAREL_EXPECT, conflict: APPAREL_CONFLICT },
  완구: { expect: ["완구", "장난감", "인형", "블록", "퍼즐"], conflict: [...FOOD_KEYWORDS, "의류", "가전"] },
  "홈/리빙": {
    expect: ["침구", "홈웨어", "생활", "리빙", "수건", "커튼", "쿠션", "이불", "베개", "매트"],
    conflict: FOOD_KEYWORDS,
  },
  뷰티: { expect: ["화장품", "뷰티", "스킨케어", "메이크업", "향수"], conflict: [...FOOD_KEYWORDS, "가전", "침구"] },
};

export interface CategoryScoreResult {
  /** 0~100. */
  score: number;
  /** 왜 이 점수인지 사람이 읽는 문장 — Trace Log/UI에 그대로 노출한다. */
  reason: string;
  /** true면 상품유형과 명백히 다른 도메인 — 자동 선택 대상에서 제외해야 한다. */
  conflict: boolean;
}

/**
 * categoryName/categoryPath(쿠팡이 돌려준 카테고리 이름과 경로)가
 * signals.productType(CartPilot이 이미 판단해둔 상품유형)과 말이 되는지
 * 대조한다. productType을 못 정한 경우(신호 부족)는 "틀렸다"고 단정할 근거가
 * 없으므로 중립값을 준다 — 정보 부족을 오답으로 취급하지 않는다.
 */
export function scoreCategoryCandidate(
  categoryName: string,
  categoryPath: string[],
  signals: Pick<ProductSignals, "productType">,
): CategoryScoreResult {
  if (!signals.productType) {
    return { score: 50, reason: "상품유형을 특정하지 못해 카테고리 이름 대조를 생략했습니다.", conflict: false };
  }
  const profile = DOMAIN_PROFILES[signals.productType];
  if (!profile) {
    return { score: 50, reason: `상품유형("${signals.productType}")에 대한 대조 기준이 아직 없습니다.`, conflict: false };
  }
  const nameText = [categoryName, ...categoryPath].join(" ");
  const conflictHit = profile.conflict.find((kw) => nameText.includes(kw));
  if (conflictHit) {
    return {
      score: 5,
      reason: `카테고리 이름에 "${conflictHit}"가 있어 상품유형("${signals.productType}")과 명백히 다른 도메인입니다.`,
      conflict: true,
    };
  }
  const expectHit = profile.expect.find((kw) => nameText.includes(kw));
  if (expectHit) {
    return {
      score: 95,
      reason: `카테고리 이름에 "${expectHit}"가 있어 상품유형("${signals.productType}")과 일치합니다.`,
      conflict: false,
    };
  }
  return {
    score: 60,
    reason: `카테고리 이름에서 상품유형("${signals.productType}")과 직접 일치하는 단어는 못 찾았지만, 충돌하는 단어도 없습니다.`,
    conflict: false,
  };
}
