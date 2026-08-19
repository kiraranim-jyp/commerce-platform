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
  // N-3.33 — 실제 Naver 카테고리 트리 전수조사(fetchNaverAllCategories, 4999개
  // leaf)로 확인한 문자열만 쓴다("아로마"/"방향"은 "아로마테라피"(바디케어)/
  // "차량용방향제"/"방향지시등" 등과 겹쳐 오탐 위험이 커서 제외했다 — 실측
  // 확인: 캔들: ["캔들","향초","디퓨저"]로 좁히면 가구/인테리어 > 인테리어소품 >
  // 아로마/캔들용품 하위 8개 leaf만 정확히 매칭되고 오탐 0건).
  캔들: { expect: ["캔들", "향초", "디퓨저"], conflict: [...FOOD_KEYWORDS, "가전", "의류", "신발", "가방"] },
  // SmartStore 플로우 개선 STEP1 — product-resolver.ts에 새로 추가한 4개
  // productType의 대응 항목. expect 문자열은 실제 Naver leaf category 4999개
  // 전수조사(fetchNaverAllCategories)로 확인된 것만 썼다(캔들 항목과 같은
  // 원칙) — 예: "가구" 356개, "디지털" 693개, "반려동물" 121개, "문구" 151개
  // leaf에서 실제로 등장함을 확인.
  가구: { expect: ["가구"], conflict: [...FOOD_KEYWORDS, "의류", "신발", "가방", "완구"] },
  "가전/디지털": { expect: ["디지털", "가전"], conflict: [...FOOD_KEYWORDS, "의류", "신발", "가방", "완구", "가구"] },
  반려동물용품: { expect: ["반려동물"], conflict: [...FOOD_KEYWORDS.filter((k) => k !== "간식"), "의류", "신발", "가방"] },
  "문구/사무용품": { expect: ["문구"], conflict: [...FOOD_KEYWORDS, "의류", "신발", "가방", "완구"] },
};

/** CPO 지시(2026-08-07, kids hat 실측 사례) — category-resolver-v3.ts가
 * predict API 후보만으로는 정답을 놓칠 때(아래 함수 주석 참고) 카테고리
 * 트리를 직접 훑어 후보를 보강한다 — 이때 "어떤 키워드로 트리를 훑을지"는
 * 여기 DOMAIN_PROFILES가 유일한 기준이어야 한다(판단 기준이 두 곳에 있으면
 * 어긋난다). productType이 이 표에 없으면 undefined — 호출자는 트리 탐색을
 * 생략해야 한다(추측 금지). */
export function getProductTypeExpectKeywords(productType: string): string[] | undefined {
  return DOMAIN_PROFILES[productType]?.expect;
}

export interface CategoryScoreResult {
  /** 0~100. */
  score: number;
  /** 왜 이 점수인지 사람이 읽는 문장 — Trace Log/UI에 그대로 노출한다. */
  reason: string;
  /** true면 상품유형과 명백히 다른 도메인 — 자동 선택 대상에서 제외해야 한다. */
  conflict: boolean;
}

/** CEO 피드백(2026-08-07, 실측 사례 — "kids hat") — "야구모자"(코드 81536)와
 * "남성모자"(코드 69741) 둘 다 predict API가 줬는데, 정답인 "패션의류잡화 >
 * 영유아동 신발/잡화/기타의류(0~17세) > 남녀공용잡화 > 모자 > 공용"보다 높은
 * 점수를 받았다. 1차 수정(카테고리 "이름"만 아동 키워드 대조)으로는 안 됐다
 * — categoryPath가 항상 빈 배열로 호출되고 있었기 때문(호출부 category-
 * resolver-v3.ts가 predict API 응답에는 없는 path를 아예 안 채워서 대조
 * 대상이 리프 이름 하나뿐이었다). 카테고리 트리 전체를 이미 갖고 있으므로
 * (category-tree.ts, CategoryTreeBrowser에 이미 사용 중) 이제 categoryPath에
 * 실제 조상 경로 전체("패션의류잡화","영유아동 신발/잡화/기타의류(0~17세)",
 * "남녀공용잡화","모자","공용")를 채워서 넘긴다 — 이 함수는 그 전체 경로
 * 텍스트를 대조 대상으로 쓴다. 성별(gender)도 같은 방식으로 추가한다 —
 * "공용"/"남녀공용" 같은 유니섹스 표기까지 신호로 반영해야 이 실측 사례처럼
 * 여러 후보가 동점에 가까울 때 정답이 명확히 위로 올라온다. */
const KIDS_PATH_KEYWORDS = ["영유아동", "유아동", "아동", "주니어", "베이비", "키즈"];
const ADULT_GENDERED_PATH_KEYWORDS = ["여성", "남성"];
const UNISEX_PATH_KEYWORDS = ["남녀공용", "공용", "유니섹스"];
const GIRL_PATH_KEYWORDS = ["여아", "걸즈"];
const BOY_PATH_KEYWORDS = ["남아", "보이즈"];

/**
 * categoryName/categoryPath(쿠팡이 돌려준 카테고리 이름과, 그 카테고리의
 * 전체 조상 경로)가 signals(CartPilot이 이미 판단해둔 상품유형/연령대/성별)와
 * 말이 되는지 대조한다. 신호를 못 정한 항목(productType null, ageGroup/gender
 * unknown)은 "틀렸다"고 단정할 근거가 없으므로 그 항목은 건드리지 않는다 —
 * 정보 부족을 오답으로 취급하지 않는다.
 */
export function scoreCategoryCandidate(
  categoryName: string,
  categoryPath: string[],
  signals: Pick<ProductSignals, "productType" | "ageGroup" | "gender">,
): CategoryScoreResult {
  const nameText = [categoryName, ...categoryPath].join(" ");
  const isKidsSignal = signals.ageGroup === "baby" || signals.ageGroup === "kids";
  const genderKeywords: Record<string, string[]> = {
    unisex: UNISEX_PATH_KEYWORDS,
    girl: GIRL_PATH_KEYWORDS,
    boy: BOY_PATH_KEYWORDS,
    women: ["여성"],
    men: ["남성"],
  };
  const hasGenderSignal = !!signals.gender && signals.gender !== "unknown";

  const applyDemographicAdjustment = (result: CategoryScoreResult): CategoryScoreResult => {
    if (result.conflict) return result;
    let { score, reason } = result;

    if (isKidsSignal) {
      const hasKidsKeyword = KIDS_PATH_KEYWORDS.some((kw) => nameText.includes(kw));
      if (hasKidsKeyword) {
        score = Math.min(100, score + 5);
        reason += ` 카테고리 경로에 아동 연령대 표기가 있어 연령 신호(${signals.ageGroup})와도 일치합니다.`;
      } else {
        const adultHit = ADULT_GENDERED_PATH_KEYWORDS.find((kw) => nameText.includes(kw));
        if (adultHit) {
          score = Math.max(0, score - 30);
          reason += ` 다만 카테고리 경로가 성인 대상("${adultHit}")으로 보여 연령 신호(${signals.ageGroup})와 어긋날 수 있습니다.`;
        }
      }
    }

    if (hasGenderSignal) {
      const expectedGenderKeywords = genderKeywords[signals.gender] ?? [];
      const genderHit = expectedGenderKeywords.find((kw) => nameText.includes(kw));
      if (genderHit) {
        score = Math.min(100, score + 3);
        reason += ` 카테고리 경로에 성별 표기("${genderHit}")가 있어 성별 신호(${signals.gender})와도 일치합니다.`;
      } else if (signals.gender !== "unisex") {
        // unisex 신호일 때는 성별 특정 카테고리(여성/남성)를 아래서 감점하지
        // 않는다 — 쿠팡이 유니섹스 하위분류를 안 나누는 카테고리가 흔해서,
        // "공용" 표기가 없다고 바로 틀렸다고 보면 정상 후보까지 걸러진다.
        const mismatchedGenderHit = Object.entries(genderKeywords)
          .filter(([g]) => g !== signals.gender)
          .flatMap(([, kws]) => kws)
          .find((kw) => nameText.includes(kw));
        if (mismatchedGenderHit) {
          score = Math.max(0, score - 10);
          reason += ` 다만 카테고리 경로가 다른 성별("${mismatchedGenderHit}") 대상으로 보여 성별 신호(${signals.gender})와 어긋날 수 있습니다.`;
        }
      }
    }

    return { ...result, score, reason };
  };

  if (!signals.productType) {
    return applyDemographicAdjustment({
      score: 50,
      reason: "상품유형을 특정하지 못해 카테고리 이름 대조를 생략했습니다.",
      conflict: false,
    });
  }
  const profile = DOMAIN_PROFILES[signals.productType];
  if (!profile) {
    return applyDemographicAdjustment({
      score: 50,
      reason: `상품유형("${signals.productType}")에 대한 대조 기준이 아직 없습니다.`,
      conflict: false,
    });
  }
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
    return applyDemographicAdjustment({
      score: 95,
      reason: `카테고리 이름에 "${expectHit}"가 있어 상품유형("${signals.productType}")과 일치합니다.`,
      conflict: false,
    });
  }
  return applyDemographicAdjustment({
    score: 60,
    reason: `카테고리 이름에서 상품유형("${signals.productType}")과 직접 일치하는 단어는 못 찾았지만, 충돌하는 단어도 없습니다.`,
    conflict: false,
  });
}
