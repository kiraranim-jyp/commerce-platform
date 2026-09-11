import type { AgeGroup, Gender, ProductSignals } from "./product-resolver";

/**
 * TTAEJYO 2.0(CEO 지시 2026-09-12, CPO 검증팩 보강) — "새 카테고리는 코드 복사가
 * 아니라 프로필 추가로 붙는다."
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * 이 저장소는 아동의류 하나로 출발했고, 그 사실이 세 곳에 **데이터가 아니라
 * 코드로** 박혀 있었다:
 *
 *   ① platform-categories/*.ts — ProductType 12개의 primary 경로가 대부분
 *      "유아동패션 > 유아동의류 > …"다. 성인/여성/잡화 경로는 alternate에 이미
 *      들어 있는데도 ruleBasedCategoryProvider가 언제나 primary를 1순위로
 *      내보냈다. 여성 원피스를 넣어도 1순위 추천이 "유아동 원피스"였다.
 *   ② candidate-scoring.ts — 연령 보정이 `isKidsSignal` 한 방향으로만 있었다.
 *      아동 신호일 때 성인 경로를 -30 하지만, **성인 신호일 때 아동 경로는
 *      한 푼도 깎지 않는다**. 그래서 여성 원피스가 "유아동 원피스" 후보에서
 *      95점을 그대로 받았다.
 *   ③ domestic_price_sources.category_scope — 컬럼도 값(KIDS_FASHION)도 이미
 *      있는데 검색이 한 번도 읽지 않았다. 어떤 상품을 넣든 아동복 편집샵
 *      전부를 뒤졌다.
 *
 * ── 이 파일이 하는 일 ────────────────────────────────────────────────────
 * 위 세 자리가 **공통으로 묻는 한 가지 질문**("이 상품은 어느 카테고리
 * 상품인가")에 답하는 표 하나를 둔다. 상품 모델을 카테고리마다 복제하지 않고,
 * 가격·환율·원가·MI 판정·등록 워크플로는 손대지 않는다 — 그 엔진들은 실제로
 * 카테고리에 의존하지 않는다는 것이 이번 조사의 결론이다(KC조차 네이버 API가
 * 주는 categoryRequiresChildCertification 하나로 이미 정확히 갈리고 있다).
 *
 * ── 왜 필드가 이것뿐인가 ─────────────────────────────────────────────────
 * attributes/optionRules/namingRules 같은 칸을 미리 파 두고 싶은 유혹이 있었다.
 * 실제로 코드를 읽어보니 그 셋은 이미 카테고리와 무관하게 동작한다:
 *   - 옵션 그룹은 product.optionGroups를 그대로 쓴다(90/100/110이든 S/M/L이든
 *     350ml든). 사이즈/색상을 필수로 요구하는 코드가 없다.
 *   - 상품명은 targetLabelFromSignals()가 이미 베이비/키즈/틴즈/여성/남성을 낸다.
 *   - 속성 메타는 네이버 카테고리 id로 조회하고, 없으면 null로 조용히 건너뛴다.
 * 쓰이지 않는 칸을 만들면 다음 사람이 그 칸을 채우려고 없는 규칙을 지어낸다.
 * 그래서 **오늘 코드가 실제로 갈라지는 곳**만 필드로 둔다.
 *
 * ── 카테고리 ≠ Target Audience ───────────────────────────────────────────
 * 여기 id에는 사람(MOM_3040 같은 구매자 층)을 절대 넣지 않는다. "여성 패션"은
 * 상품이 무엇인가이고 "30~40대 엄마"는 누가 사는가라서, 한 축에 섞으면 둘 중
 * 하나를 영원히 표현할 수 없게 된다. 업무상 실제로 원하는 조합
 * (WOMEN_FASHION × MOM_3040)을 나중에 만들려면 오늘 두 축을 갈라 두는 것
 * 말고 할 일이 없다.
 */
export type CategoryProfileId = "KIDS_FASHION" | "WOMEN_FASHION" | "FASHION_ACCESSORIES" | "HOME_LIFESTYLE";

/**
 * 이 카테고리가 스마트스토어에서 법적으로 써야 하는 상품정보제공고시 유형.
 *
 * 값은 네이버가 실제로 제공하는 36종(docs/naver-provided-notice-types-raw.json,
 * 실측 응답 원문) 중 하나를 그대로 쓴다 — 우리가 지어낸 어휘가 아니다.
 * packages/listing이 오늘 payload로 만들 수 있는 것은 그중 KIDS/WEAR 둘뿐이라
 * (types.ts의 NaverProductInfoProvidedNotice union), 나머지를 요구하는
 * 카테고리는 "등록 불가"가 아니라 **"아직 지원하지 않음"**으로 정직하게
 * 드러나야 한다. 그 판단을 아래 isNaverNoticeTypeSupported()가 한 곳에서 한다.
 */
export type NaverNoticeTypeName =
  | "KIDS"
  | "WEAR"
  | "BAG"
  | "SHOES"
  | "FASHION_ITEMS"
  | "KITCHEN_UTENSILS"
  | "FURNITURE";

/**
 * packages/listing/src/naver/types.ts의 NaverProductInfoProvidedNotice union이
 * 실제로 만들 수 있는 고시유형. 여기 없는 유형이 필요한 카테고리는 payload
 * 스키마를 늘려야 하고, 그건 이번 스프린트의 금지 영역이라 보고 대상이다.
 * (이 배열과 그 union이 어긋나면 apps/admin의 category-profile 테스트가 깨진다.)
 */
export const NAVER_SUPPORTED_NOTICE_TYPES: NaverNoticeTypeName[] = ["KIDS", "WEAR"];

/**
 * 하위 프로필. **코드가 실제로 갈라지는 것만** 둔다 — 오늘 갈라지는 것은
 * "어느 국내 판매처를 뒤질 것인가" 하나뿐이라 필드도 그것뿐이다.
 * 등원룩/데일리 원피스/3040 데일리 같은 구매의도 갈래는 아직 코드가 분기하지
 * 않으므로 만들지 않는다(만들면 검증되지 않은 채 "지원한다"는 말이 된다).
 */
export interface CategorySubProfile {
  id: string;
  label: string;
  /** 제목/설명에 이 말이 보이면 이 하위 갈래다. */
  productKeywords: string[];
  /** 상위 프로필의 값에 **더해지는** 소스 범위(대체하지 않는다). */
  extraMarketSourceScopes: string[];
}

export interface CategoryProfile {
  id: CategoryProfileId;
  /** 화면에 그대로 쓰는 이름. 내부 id를 셀러에게 보여주지 않는다. */
  label: string;
  /**
   * 플랫폼 카테고리 경로 텍스트에 이 말이 있으면 이 프로필의 상품 자리다.
   * 값은 전부 **실제 카테고리 트리에 있는 문자열**이다(smartstore/coupang/
   * elevenst.categories.ts와 네이버 leaf 전수조사에서 확인된 말) — 번역사전을
   * 새로 만들지 않는다는 candidate-scoring.ts의 원칙 그대로다.
   */
  platformPathKeywords: string[];
  /**
   * 반대로 이 말이 있으면 다른 프로필의 자리다. 아동 프로필의 conflict가
   * ["여성","남성"]인 것은 지금까지 candidate-scoring.ts에 하드코딩돼 있던
   * ADULT_GENDERED_PATH_KEYWORDS와 **같은 값**이다 — 아동 동작을 한 글자도
   * 바꾸지 않으면서 반대 방향만 새로 생기게 하기 위해서다.
   */
  conflictPathKeywords: string[];
  /** 이 연령대 신호면 이 프로필이다. */
  ageGroups: AgeGroup[];
  /** 위 연령대 안에서 성별까지 봐야 갈리는 경우에만 쓴다(빈 배열이면 성별 무관). */
  genders: Gender[];
  /** 이 상품유형이면 연령/성별보다 먼저 이 프로필로 본다(잡화·리빙이 그렇다). */
  productTypes: string[];
  /**
   * 이 브랜드는 이 카테고리만 판다는 사실 자체가 신호다. 아동 목록은
   * demographic-signal.ts에 있던 KNOWN_KIDS_BRANDS를 **한 줄도 바꾸지 않고**
   * 옮긴 것이다. 옮긴 이유는 "아동 전문 브랜드"가 전역 상수일 이유가 없기
   * 때문이다 — 여성 브랜드 목록이 생기는 순간 두 상수가 나란히 서게 되고,
   * 그때 어느 쪽을 봐야 하는지 코드가 답하지 못한다.
   */
  brandHints: string[];
  /**
   * 제목/설명에서 이 말이 보이면 이 프로필이다. 연령·성별 신호로는 갈리지
   * 않는 카테고리를 위한 최소 어휘다 — 연령·성별로 이미 갈리는 프로필은
   * 비워 둔다(두 기준을 함께 두면 언젠가 어긋난다).
   */
  productKeywords: string[];
  /**
   * domestic_price_sources.category_scope 값. **새로 만든 어휘가 아니라**
   * 이미 마이그레이션 029~035가 쓰고 있는 값이다(KIDS_FASHION/KIDS_GOODS).
   * 소스 하나가 여러 카테고리에 맞을 수 있으므로 이 배열도 소스 쪽 배열도
   * 다대다다 — 교집합이 있으면 그 소스는 이 카테고리에 맞는 판매처다.
   */
  marketSourceScopes: string[];
  /** 이 카테고리가 스마트스토어에서 써야 하는 고시유형(위 타입 주석 참고). */
  naverNoticeType: NaverNoticeTypeName;
  subProfiles?: CategorySubProfile[];
}

/**
 * 지금 실제로 검증하는 카테고리만 등록한다(CPO 검증팩 4종). 트리를 미리 펼쳐
 * 두지 않는 이유는 단순하다 — 쓰이지 않는 프로필은 검증되지 않고, 검증되지
 * 않은 프로필은 다음 사람에게 "이미 지원한다"는 거짓말이 된다.
 *
 * 나중에 BEAUTY나 FASHION_ACCESSORIES{BAG,SHOES,HAT} 같은 갈래가 필요해지면
 * 이 표에 항목을 더하는 것 말고 할 일이 없다. 국내 수요 데이터(네이버 데이터랩
 * 쇼핑인사이트의 실제 대분류: 패션의류 · 패션잡화 · 화장품/미용 · 디지털/가전 ·
 * 가구/인테리어 · 출산/육아 · 식품 · 스포츠/레저 · 생활/건강)에 맞춰 이름을
 * 다시 고를 때도 마찬가지다 — 우리가 지어낸 분류를 고집하지 않는다.
 */
export const CATEGORY_PROFILES: Record<CategoryProfileId, CategoryProfile> = {
  KIDS_FASHION: {
    id: "KIDS_FASHION",
    label: "아동 패션",
    // candidate-scoring.ts의 KIDS_PATH_KEYWORDS를 그대로 옮긴 값이다.
    platformPathKeywords: ["영유아동", "유아동", "아동", "주니어", "베이비", "키즈"],
    // 같은 파일의 ADULT_GENDERED_PATH_KEYWORDS 그대로.
    conflictPathKeywords: ["여성", "남성"],
    ageGroups: ["baby", "kids", "teen"],
    genders: [],
    productTypes: [],
    brandHints: [
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
      // P-13C-1(2026-08-31, 실측: STEP2/3에서 24개 null-category 상품 중 두
      // 브랜드 모두 아동 전문 브랜드로 확인됨 — Misha & Puff는 성별/연령 신호
      // 부재로 "여성 골프 원피스"까지 잘못 갔던 실제 사고 사례).
      "misha & puff",
      "the animals observatory",
    ],
    productKeywords: [],
    marketSourceScopes: ["KIDS_FASHION", "KIDS_GOODS"],
    naverNoticeType: "KIDS",
  },
  WOMEN_FASHION: {
    id: "WOMEN_FASHION",
    label: "여성 패션",
    platformPathKeywords: ["여성"],
    conflictPathKeywords: ["영유아동", "유아동", "아동", "주니어", "베이비", "키즈"],
    ageGroups: ["adult"],
    genders: ["women"],
    productTypes: [],
    brandHints: [],
    productKeywords: [],
    marketSourceScopes: ["WOMEN_FASHION"],
    naverNoticeType: "WEAR",
    subProfiles: [
      {
        // 임산부/수유복은 성인 여성복과 **똑같은** 연령·성별 신호를 낸다 —
        // 상위 프로필을 따로 만들면 두 프로필이 영원히 서로를 가로챈다.
        // 갈라야 하는 것은 "어느 편집샵을 뒤질 것인가" 하나뿐이라 하위 갈래로
        // 둔다(등록 고시유형도 WEAR로 같다).
        id: "MATERNITY",
        label: "임산부/수유",
        productKeywords: ["maternity", "nursing", "임부", "임산부", "수유", "산모"],
        extraMarketSourceScopes: ["MATERNITY"],
      },
    ],
  },
  FASHION_ACCESSORIES: {
    id: "FASHION_ACCESSORIES",
    label: "패션 잡화",
    // "패션잡화"는 smartstore.categories.ts의 alternate 경로에 실제로 있는
    // 최상위 노드다(모자/신발/액세서리). 하위 갈래(BAG/SHOES/HAT)는 아직
    // 나누지 않는다 — 오늘 그것으로 갈라야 할 판단이 하나도 없다.
    platformPathKeywords: ["패션잡화"],
    conflictPathKeywords: ["영유아동", "유아동", "아동", "주니어", "베이비", "키즈"],
    ageGroups: [],
    genders: [],
    // product-resolver.ts의 PRODUCT_TYPE_KEYWORDS가 내는 문자열 그대로 쓴다 —
    // 두 표가 다른 말을 쓰면 "상품유형은 신발인데 프로필이 없다"가 된다.
    productTypes: ["신발", "가방", "모자"],
    brandHints: [],
    productKeywords: [],
    marketSourceScopes: ["FASHION_ACCESSORIES"],
    // 가방/신발/기타잡화는 네이버 고시유형이 각각 BAG/SHOES/FASHION_ITEMS로
    // 따로 있다. 오늘 payload가 만들 수 있는 것은 KIDS/WEAR뿐이라 어느 값을
    // 적어도 "미지원"이 된다 — 가장 넓은 FASHION_ITEMS를 적어 두고, 실제
    // 하위 분리는 payload 스키마를 늘릴 때 함께 한다(CPO 판단 사항).
    naverNoticeType: "FASHION_ITEMS",
  },
  HOME_LIFESTYLE: {
    id: "HOME_LIFESTYLE",
    label: "라이프스타일",
    // 네이버 실제 leaf 전수조사(candidate-scoring.ts의 캔들/가구 항목 주석)에서
    // 확인된 말만 쓴다.
    platformPathKeywords: ["생활", "리빙", "인테리어", "가구", "주방"],
    conflictPathKeywords: ["영유아동", "유아동", "아동", "주니어", "베이비", "키즈"],
    ageGroups: [],
    genders: [],
    productTypes: ["홈/리빙", "가구", "캔들", "문구/사무용품"],
    brandHints: [],
    productKeywords: [],
    marketSourceScopes: ["HOME_LIFESTYLE"],
    // 머그컵/식기의 고시유형은 KITCHEN_UTENSILS다(용량·재질·구성품을 묻는
    // 유형 — 소재·색상·치수를 묻는 WEAR와 요구 항목 자체가 다르다).
    naverNoticeType: "KITCHEN_UTENSILS",
  },
};

export const CATEGORY_PROFILE_LIST: CategoryProfile[] = Object.values(CATEGORY_PROFILES);

/**
 * 이 카테고리를 스마트스토어에 **오늘** 등록할 수 있는가.
 *
 * false라고 해서 등록을 막지 않는다 — 막는 것은 workflow/readiness의 몫이고,
 * 이 함수는 사실만 말한다. 다만 이 사실을 어딘가에서 말하지 않으면 라이프스타일
 * 상품이 "의류 고시정보(소재·색상·치수·취급주의)"를 달고 조용히 등록된다.
 * 값이 틀린 것보다 나쁜 것은 틀린 줄 모르는 것이다.
 */
export function isNaverNoticeTypeSupported(profile: CategoryProfile): boolean {
  return NAVER_SUPPORTED_NOTICE_TYPES.includes(profile.naverNoticeType);
}

/** 자동 추정 결과. 근거를 함께 돌려주는 이유는 화면에 "왜 이 카테고리로 봤는지"를
 * 그대로 적기 위해서다 — 셀러가 [카테고리 변경]을 누를지 말지는 근거를 봐야 정한다. */
export interface CategoryProfileDetection {
  profile: CategoryProfile;
  subProfile: CategorySubProfile | null;
  /** 사람이 읽는 근거 한 줄. */
  reason: string;
}

/** 이 판정이 실제로 뒤질 국내 판매처 범위(상위 + 하위 갈래). */
export function detectionMarketSourceScopes(detection: CategoryProfileDetection): string[] {
  return [...detection.profile.marketSourceScopes, ...(detection.subProfile?.extraMarketSourceScopes ?? [])];
}

function matchSubProfile(profile: CategoryProfile, haystack: string): CategorySubProfile | null {
  for (const sub of profile.subProfiles ?? []) {
    if (sub.productKeywords.some((kw) => haystack.includes(kw.toLowerCase()))) return sub;
  }
  return null;
}

/**
 * 수집된 신호만으로 카테고리를 추정한다. **설정 화면에서 고르게 하지 않는다** —
 * 셀러가 URL을 붙여넣는 순간 우리는 이미 breadcrumb·URL·브랜드·제목을 다 갖고
 * 있고, 그걸 두고 다시 묻는 것은 우리가 게으른 것이다(CEO 지시: URL → 수집 →
 * 카테고리 자동 추정 → [카테고리 변경]).
 *
 * ── 모르면 null을 돌려준다 ───────────────────────────────────────────────
 * 이 함수에서 가장 중요한 규칙이다. 근거가 없을 때 아무 프로필이나 고르면
 * 그 추측이 카테고리 점수 보정(-30점)과 시장조사 소스 필터에 그대로 먹혀서,
 * "모르는 것"이 "확실히 아닌 것"으로 둔갑한다. null이면 호출부는 지금까지와
 * 완전히 같게 동작한다(보정 없음 · 필터 없음) — 회귀가 구조적으로 불가능하다.
 *
 * 우선순위: 상품유형 → 브랜드 → 연령·성별.
 * 앞의 것이 뒤의 것보다 좁고 구체적이라서 그렇다 — 머그컵에 "여성"이라는 말이
 * 섞여 있어도 답은 라이프스타일이다.
 */
export function detectCategoryProfile(
  signals: Pick<ProductSignals, "ageGroup" | "gender" | "productType">,
  /** 제목·설명·breadcrumb을 이어 붙인 원문. 없으면 어휘 판정을 건너뛴다. */
  text = "",
  brand = "",
): CategoryProfileDetection | null {
  const haystack = text.toLowerCase();
  const brandLower = brand.trim().toLowerCase();
  const decide = (profile: CategoryProfile, reason: string): CategoryProfileDetection => ({
    profile,
    subProfile: matchSubProfile(profile, haystack),
    reason,
  });

  // ① 상품유형 — 잡화·리빙은 연령보다 유형이 먼저다. 다만 아동 신호가 이미 서
  //    있으면 "유아동잡화"가 실제 카테고리 자리라서(smartstore.categories.ts의
  //    Hat/Shoes primary가 그 경로다) 잡화로 가로채지 않는다.
  const isKidsSignal = signals.ageGroup === "baby" || signals.ageGroup === "kids";
  if (signals.productType && !isKidsSignal) {
    for (const profile of CATEGORY_PROFILE_LIST) {
      if (profile.productTypes.includes(signals.productType)) {
        return decide(profile, `상품유형 "${signals.productType}"`);
      }
    }
  }

  // ② 브랜드 — 제목에 연령 신호가 아예 없는 사이트에서 유일하게 남는 근거다
  //    (demographic-signal.ts 주석의 Smallable 실측 사례).
  if (brandLower) {
    for (const profile of CATEGORY_PROFILE_LIST) {
      const hit = profile.brandHints.find((b) => brandLower === b || brandLower.includes(b));
      if (hit) return decide(profile, `"${brand}"는 ${profile.label} 전문 브랜드`);
    }
  }

  // ③ 연령·성별 — 사이트가 스스로 분류해 둔 값에서 온 신호다(breadcrumb/URL).
  for (const profile of CATEGORY_PROFILE_LIST) {
    if (!profile.ageGroups.includes(signals.ageGroup)) continue;
    if (profile.genders.length > 0 && !profile.genders.includes(signals.gender)) continue;
    const genderNote = profile.genders.length > 0 ? ` · 성별 ${signals.gender}` : "";
    return decide(profile, `연령대 ${signals.ageGroup}${genderNote}`);
  }

  // ④ 어휘 — 여기까지 와서야 본다. 임산부/수유는 상위 프로필(여성)이 ③에서
  //    이미 잡히므로, 이 분기는 연령·성별 신호가 전혀 없는 원본에서만 쓰인다.
  for (const profile of CATEGORY_PROFILE_LIST) {
    const sub = matchSubProfile(profile, haystack);
    if (sub) return { profile, subProfile: sub, reason: `상품 정보에서 "${sub.label}" 확인` };
  }

  return null;
}

/**
 * 카테고리 경로 텍스트가 이 프로필과 맞는가. candidate-scoring.ts의 점수 보정과
 * rule-based.provider.ts의 후보 순서가 **같은 판정**을 쓰게 하는 유일한 지점이다
 * — 두 곳이 각자 판단하면 "1순위로 추천한 카테고리가 점수는 낮은" 화면이 언젠가
 * 생긴다(이 저장소에서 반복된 종류의 버그다).
 *
 *   MATCH     이 프로필의 자리가 맞다.
 *   CONFLICT  다른 프로필의 자리다.
 *   UNKNOWN   경로에 근거가 없다 — 틀렸다는 뜻이 아니다.
 */
export type CategoryPathFit = "MATCH" | "CONFLICT" | "UNKNOWN";

export function fitCategoryPath(
  profile: CategoryProfile,
  pathText: string,
): { fit: CategoryPathFit; keyword: string | null } {
  const matched = profile.platformPathKeywords.find((kw) => pathText.includes(kw));
  if (matched) return { fit: "MATCH", keyword: matched };
  const conflicted = profile.conflictPathKeywords.find((kw) => pathText.includes(kw));
  if (conflicted) return { fit: "CONFLICT", keyword: conflicted };
  return { fit: "UNKNOWN", keyword: null };
}

/**
 * 이 판매처(시장조사 소스)가 이 카테고리에 맞는가.
 *
 * 빈 category_scope는 "모든 카테고리"로 본다. 반대로 했다면(빈 값 = 아무
 * 카테고리에도 안 맞음) 관리자가 직접 추가한 소스(POST 기본값이 빈 배열이다)와
 * 아직 분류하지 않은 기존 행이 전부 조용히 사라진다 — 셀러 화면에서 편집샵이
 * 통째로 없어지는 쪽으로 실패하는 설계다. 주장하지 않은 것을 부정으로 읽지 않는다.
 */
export function sourceFitsScopes(sourceCategoryScope: string[], profileScopes: string[] | null): boolean {
  if (!profileScopes || profileScopes.length === 0) return true;
  if (sourceCategoryScope.length === 0) return true;
  return sourceCategoryScope.some((scope) => profileScopes.includes(scope));
}
