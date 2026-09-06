/**
 * P-29 Sprint 5-7(CPO 지시, 2026-09-03) — "가격이 좋아도 팔릴지"는 CASE A/B/C/D
 * (가격 경쟁력)와 완전히 별개 판단이다. 이 파일은 packages/pricing 안에서도
 * price-recommendation.ts/representative-seller-decision.ts와 서로 import하지
 * 않는 독립 모듈이다 — CPO 절대 금지 사항 3("트렌드 신호가 좋다고 가격 경쟁력
 * 판정을 변경하지 말 것")을 코드 구조로 강제한다: 이 파일의 함수들은
 * marketCase를 입력으로 받지 않고, 반환값도 marketCase/recommendedPrice에
 * 전혀 영향을 주지 않는다. 순수 함수만 둔다(외부 호출 없음) — 실제 데이터
 * 수집(Naver DataLab 등)은 packages/crawler에 별도로 둔다.
 */
export type MarketSignalLevel = "high" | "medium" | "low" | "unknown";

export interface MarketSignal {
  key: "domesticPresence" | "searchInterest" | "seasonFit";
  label: string;
  level: MarketSignalLevel;
  evidence: string;
}

export interface MarketSignalsResult {
  signals: MarketSignal[];
  /** 신호 전체의 데이터 품질 — CPO 지시: "정확한 데이터 근거가 없는 경우
   * 숫자 점수로 위장하지 않는다." 개별 신호가 unknown이 많을수록 낮아진다. */
  confidence: "high" | "medium" | "limited";
}

const SEASON_KEYWORDS: { level: "high"; season: "summer" | "winter" | "rain"; keywords: string[] }[] = [
  { level: "high", season: "summer", keywords: ["swim", "스윔", "수영", "래시가드", "샌들", "sandal", "민소매", "swimwear", "물놀이"] },
  { level: "high", season: "winter", keywords: ["패딩", "코트", "니트", "기모", "padding", "coat", "knit", "fleece", "겨울"] },
  { level: "high", season: "rain", keywords: ["우비", "장화", "레인", "rain boot", "raincoat"] },
];

/** 순수 규칙 기반 — 카테고리 데이터가 아니라 상품명 텍스트만 본다(외부 호출
 * 없음). "현재 월과 상품 성격이 맞는가"만 판단하고 검색량/트렌드로 오인되지
 * 않도록 evidence 문구에 항상 "시즌 적합성"이라고만 표기한다. */
export function computeSeasonFit(titleText: string, nowMonth: number): { level: MarketSignalLevel; evidence: string } {
  const lower = titleText.toLowerCase();
  const isSummerMonth = nowMonth >= 5 && nowMonth <= 8;
  const isWinterMonth = nowMonth === 12 || nowMonth <= 2;
  const isRainMonth = nowMonth >= 6 && nowMonth <= 9;

  for (const group of SEASON_KEYWORDS) {
    if (!group.keywords.some((kw) => lower.includes(kw.toLowerCase()))) continue;
    const inSeason = (group.season === "summer" && isSummerMonth) || (group.season === "winter" && isWinterMonth) || (group.season === "rain" && isRainMonth);
    return inSeason
      ? { level: "high", evidence: "현재 계절과 상품 카테고리가 일치합니다" }
      : { level: "low", evidence: "현재 계절과 상품 카테고리가 맞지 않습니다(비시즌)" };
  }
  return { level: "medium", evidence: "특정 시즌에 한정되지 않는 상품입니다" };
}

/** P-31 — "0곳"은 두 가지 뜻이 될 수 있다: ① 실제로 찾아봤는데 국내 판매처가
 * 없다(= 경쟁 없음, 신호로서 의미 있음) ② 애초에 국내 가격 확인을 못 했다
 * (= 확인 불가). 후자를 "낮음"으로 표시하면 데이터 부족이 시장 평가로
 * 둔갑한다 — CPO 지시("데이터 없음 ≠ 시장 약함")에 따라 구분한다. */
function domesticPresenceLevel(sellerCount: number, known: boolean): MarketSignalLevel {
  if (!known) return "unknown";
  if (sellerCount >= 3) return "high";
  if (sellerCount >= 1) return "medium";
  return "low";
}

function searchInterestLevel(ratio: number | null): MarketSignalLevel {
  if (ratio == null) return "unknown";
  if (ratio >= 50) return "high";
  if (ratio >= 10) return "medium";
  return "low";
}

/** P-30 — 검색 관심이 왜 "확인 불가"인지 구분하기 위한 상태값. 순수 함수를
 * 유지하기 위해 packages/crawler를 import하지 않고 문자열 유니온만 받는다
 * (값은 crawler의 SearchTrendStatus와 동일하게 맞춘다). */
export type SearchInterestStatus =
  | "OK"
  | "NO_DATA"
  | "NOT_CONFIGURED"
  | "AUTH_ERROR"
  | "REQUEST_ERROR"
  | "TRANSIENT_ERROR";

/** 확인 불가 사유별 문구 — 어떤 경우에도 "검색량"이라는 절대 수치 표현을
 * 쓰지 않는다(CPO 절대 금지 1). */
const SEARCH_INTEREST_UNKNOWN_EVIDENCE: Record<Exclude<SearchInterestStatus, "OK">, string> = {
  NO_DATA: "네이버에서 집계된 검색 관심 데이터가 없는 키워드입니다",
  NOT_CONFIGURED: "네이버 검색 데이터 연동이 설정되지 않았습니다",
  AUTH_ERROR: "네이버 검색 API 인증에 실패했습니다(설정 확인 필요)",
  REQUEST_ERROR: "네이버 검색 API 요청이 거부되었습니다(설정 확인 필요)",
  TRANSIENT_ERROR: "네이버 검색 데이터를 일시적으로 확인하지 못했습니다",
};

export interface DeriveMarketSignalsInput {
  /** market-intelligence.ts가 이미 계산한 domesticMarketSplit.resolved.sellerCount
   * 를 그대로 받는다 — 새 검색을 하지 않는다. */
  domesticSellerCount: number;
  /** Naver DataLab 검색어트렌드 상대지수(0~100) — null이면 미설정/조회실패,
   * "낮음"이 아니라 "확인 불가"로 정직하게 표시한다. */
  searchInterestRatio: number | null;
  /** P-30 — ratio가 null일 때 그 사유를 근거 문구로 구분한다. 생략하면 기존과
   * 동일하게 뭉뚱그린 문구를 쓴다(하위 호환). level 분류에는 영향을 주지
   * 않는다 — ratio가 없으면 사유와 무관하게 항상 "확인 불가"다. */
  searchInterestStatus?: SearchInterestStatus;
  /** P-31 — 국내 판매처 수를 실제로 확인했는지. false면 sellerCount 0을
   * "낮음"이 아니라 "확인 불가"로 표시한다. 생략하면 기존과 동일하게
   * 확인된 것으로 본다(하위 호환). */
  domesticSellerCountKnown?: boolean;
  titleText: string;
  nowMonth: number;
}

export function deriveMarketSignals(input: DeriveMarketSignalsInput): MarketSignalsResult {
  const seasonFit = computeSeasonFit(input.titleText, input.nowMonth);
  const domesticKnown = input.domesticSellerCountKnown ?? true;
  const domesticLevel = domesticPresenceLevel(input.domesticSellerCount, domesticKnown);
  const searchLevel = searchInterestLevel(input.searchInterestRatio);

  const signals: MarketSignal[] = [
    {
      key: "domesticPresence",
      label: "국내 판매처",
      level: domesticLevel,
      evidence: !domesticKnown
        ? "국내 판매처를 아직 확인하지 못했습니다"
        : input.domesticSellerCount > 0
          ? `국내 편집샵 ${input.domesticSellerCount}곳에서 확인됨`
          : "등록된 국내 편집샵에서 확인되지 않음",
    },
    {
      key: "searchInterest",
      label: "검색 관심",
      level: searchLevel,
      evidence:
        input.searchInterestRatio == null
          ? input.searchInterestStatus && input.searchInterestStatus !== "OK"
            ? SEARCH_INTEREST_UNKNOWN_EVIDENCE[input.searchInterestStatus]
            : "네이버 검색 데이터를 확인하지 못했습니다"
          : `네이버 검색 상대지수 ${input.searchInterestRatio}(최근 구간 내 상대값)`,
    },
    { key: "seasonFit", label: "시즌 적합성", level: seasonFit.level, evidence: seasonFit.evidence },
  ];

  const unknownCount = signals.filter((s) => s.level === "unknown").length;
  const confidence: MarketSignalsResult["confidence"] = unknownCount === 0 ? "high" : unknownCount === 1 ? "medium" : "limited";

  return { signals, confidence };
}

/**
 * CASE별 판매 가이드 — CPO 절대 금지 사항 3(가격 판정 변경 금지)을 지키기
 * 위해 marketCase는 여기서 오직 "어떤 문구 템플릿을 고를지"에만 쓰인다.
 * recommendedPrice/estimatedMarginPercent/marketCase 자체를 다시 계산하거나
 * 바꾸지 않는다 — 순수 문자열 조합 함수.
 */
/**
 * UX-3(CPO 지시, 2026-09-06) — 전략 가이드에 쓸 "이미 계산된" 숫자들.
 * 이 파일이 새로 계산하는 것은 차액(뺄셈)뿐이고 나머지는 전부
 * computePriceRecommendation()과 국내 시장 요약이 이미 낸 값을 그대로 받는다.
 * 값이 없으면 null — 없는 숫자를 만들거나 추정하지 않는다.
 */
export interface SellingGuidanceFacts {
  /** CASE A/B의 최종 추천 판매가. CASE C/D는 null. */
  recommendedPriceKrw: number | null;
  /** 목표 마진율 기준 판매가(참고치). */
  targetPriceKrw: number | null;
  /** recommendedPrice 기준 실제 마진율(%). */
  estimatedMarginPercent: number | null;
  /** 목표 마진율(%). */
  targetMarginPercent: number | null;
  /** 착지원가(구매가 + 배송/수수료 포함). */
  landedCostKrw: number | null;
  /** 국내 동일상품 최저가 — CASE A/B/C의 "시장 기준가". */
  domesticLowestPriceKrw: number | null;
  /** CASE D에서만 참고치로 쓰는 브랜드 시장 중앙값. */
  brandMedianPriceKrw: number | null;
  /**
   * 국내 판매처 수. 확인 자체를 못 했으면 null이다(0과 다르다) —
   * null/0이면 경쟁 문구를 아예 만들지 않는다.
   */
  sellerCount: number | null;
  /**
   * MI-SUPPLY-ADVANTAGE-1 — 국내 동일상품 판별 근거. 공급 판정의 유일한
   * 게이트다(아래 deriveSupplyStatus 주석 참조). 생략하면 UNKNOWN 취급.
   */
  domesticBasis?: "EXACT" | "COMPARISON" | "NONE";
}

/**
 * MI-SUPPLY-ADVANTAGE-1(CPO 지시, 2026-09-06) — 국내 공급 상황.
 *
 * 셀러 인터뷰 가설: "국내에 동일상품 재고가 부족하면 국내 시장 최저가가
 * 아니라 목표 마진 가격으로도 팔릴 수 있다." 이것을 판단하려면 가격 축
 * (marketCase)과 별개인 공급 축이 필요하다.
 *
 * 이 함수의 가장 중요한 역할은 기회 탐지가 아니라 **오판 방지**다:
 *   "검색 결과 없음"은 "국내 재고 없음"이 아니다.
 * 크롤링 실패, 매칭 실패, 데이터 미수집도 전부 결과가 0으로 보인다. 이를
 * SCARCE로 처리하면 "국내에 없으니 비싸게 팔아라"를 근거 없이 권하게 된다.
 *
 * 그래서 게이트를 basis === "EXACT" 하나로 둔다. summarizeDomesticMarketSplit
 * 정의상 EXACT는 exact.sellerCount > 0일 때만 나온다(price-history.ts) —
 * 즉 **실제로 찾아서 확인된 동일상품이 있을 때만** 공급을 논한다. 못 찾은
 * 경우(COMPARISON/NONE)는 항상 UNKNOWN이며 절대 SCARCE가 되지 않는다.
 */
export type SupplyStatus = "SUFFICIENT" | "LIMITED" | "SCARCE" | "UNKNOWN";

export function deriveSupplyStatus(input: {
  sellerCount: number | null;
  domesticBasis?: "EXACT" | "COMPARISON" | "NONE";
}): SupplyStatus {
  // 확인 자체를 못 했거나(null) 동일상품을 확정하지 못했으면 판단하지 않는다.
  if (input.sellerCount == null) return "UNKNOWN";
  if (input.domesticBasis !== "EXACT") return "UNKNOWN";
  if (input.sellerCount <= 0) return "UNKNOWN";
  if (input.sellerCount <= 2) return "SCARCE";
  if (input.sellerCount <= 5) return "LIMITED";
  return "SUFFICIENT";
}

function won(value: number): string {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

/** 소수 1자리까지만 — "8.0%p" 같은 군더더기를 피한다. */
function pct(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

/**
 * UX-3 — 경쟁 축은 가격 CASE와 완전히 독립이다(CPO 확정). sellerCount가
 * 실제로 확인됐을 때만 문구를 만들고, 없으면 빈 배열을 반환해 블록 자체가
 * 나오지 않게 한다. "경쟁이 심할 것으로 보입니다" 같은 추론은 금지.
 */
function competitionLines(sellerCount: number | null, supply: SupplyStatus): string[] {
  if (sellerCount == null || sellerCount <= 0) return [];
  // MI-SUPPLY-ADVANTAGE-1 — 공급이 제한적인데 "경쟁이 치열하니 차별화하라"고
  // 하면 아래 공급 문구와 정반대 조언이 된다. 경쟁 문구는 공급이 충분할
  // 때만 낸다.
  if (supply !== "SUFFICIENT") return [];
  return [
    `국내 판매처 ${sellerCount}곳 확인 — 같은 상품을 파는 곳이 이미 있습니다.`,
    "→ 최저가 경쟁보다 구성·옵션·배송 조건 차별화를 검토하세요.",
  ];
}

/**
 * MI-SUPPLY-ADVANTAGE-1 — 공급 제한이 실제로 확인됐을 때만 나오는 기회 문구.
 * SUFFICIENT/UNKNOWN이면 빈 배열이다.
 *
 * 표현 원칙(CPO 명시): 공급 부족은 "가격을 올려도 팔린다"는 보장이 아니라
 * 시험해볼 근거다. "반드시 팔린다 / 가격을 올려라" 같은 확정형을 쓰지 않고
 * 가능성·테스트·반응 확인 수준으로만 말한다.
 */
function supplyLines(supply: SupplyStatus, sellerCount: number | null, premiumGapKrw: number | null): string[] {
  if (supply !== "SCARCE" && supply !== "LIMITED") return [];
  if (sellerCount == null) return [];
  const scarce = supply === "SCARCE";
  const lines = [
    `국내 동일상품 판매처 ${sellerCount}곳 — 국내 공급이 ${scarce ? "매우 제한적입니다" : "제한적입니다"}.`,
  ];
  if (premiumGapKrw != null && premiumGapKrw > 0) {
    lines.push(
      `목표 마진 가격은 시장 기준가보다 ${won(premiumGapKrw)} 높지만, 대체 상품이 적어 이 가격대를 시험해볼 여지가 있습니다.`,
    );
  }
  lines.push("→ 처음부터 최저가로 내리기보다 목표 마진 가격으로 등록하고 클릭·판매 반응을 확인하세요.");
  return lines;
}

/**
 * UX-3 — CASE별 "숫자 → 이유 → 행동" 가이드. 쓸 숫자가 하나도 없으면 빈
 * 배열을 반환하고 호출부가 기존 정성 문구로 되돌아간다. marketCase는 여기서도
 * 분기용으로만 쓴다 — 판정을 다시 계산하지 않는다.
 */
function numericGuidance(marketCase: "A" | "B" | "C" | "D" | null, f: SellingGuidanceFacts): string[] {
  const lines: string[] = [];
  // MI-SUPPLY-ADVANTAGE-1 — 가격 축(marketCase)과 독립적으로 계산한다.
  // marketCase를 여기서 다시 판정하거나 바꾸지 않는다.
  const supply = deriveSupplyStatus({ sellerCount: f.sellerCount, domesticBasis: f.domesticBasis });

  if (marketCase === "A") {
    const numbers: string[] = [];
    if (f.recommendedPriceKrw != null) numbers.push(`추천 판매가 ${won(f.recommendedPriceKrw)}`);
    if (f.domesticLowestPriceKrw != null) numbers.push(`국내 최저가 ${won(f.domesticLowestPriceKrw)}`);
    if (f.estimatedMarginPercent != null) numbers.push(`예상 마진 ${pct(f.estimatedMarginPercent)}`);
    if (numbers.length === 0) return [];
    lines.push(numbers.join(" · "));
    lines.push("목표 마진을 확보하면서 국내 시장가보다 낮게 팔 수 있는 구간입니다.");
    lines.push("→ 추천가로 시작하고, 국내 가격 변동을 주기적으로 확인하세요.");
    // CASE A는 이미 목표 마진을 확보하는 구간이라 프리미엄 격차가 없다.
    // 공급 제한은 "경쟁 압력이 낮다"는 맥락으로만 덧붙인다.
    return [...lines, ...supplyLines(supply, f.sellerCount, null), ...competitionLines(f.sellerCount, supply)];
  }

  if (marketCase === "B") {
    const numbers: string[] = [];
    if (f.estimatedMarginPercent != null) numbers.push(`예상 마진 ${pct(f.estimatedMarginPercent)}`);
    if (f.targetMarginPercent != null) numbers.push(`목표 마진 ${pct(f.targetMarginPercent)}`);
    if (f.targetPriceKrw != null) numbers.push(`목표마진 판매가 ${won(f.targetPriceKrw)}`);
    if (f.domesticLowestPriceKrw != null) numbers.push(`시장 기준가 ${won(f.domesticLowestPriceKrw)}`);
    if (numbers.length === 0) return [];
    lines.push(numbers.join(" · "));

    if (f.estimatedMarginPercent != null && f.targetMarginPercent != null) {
      const gap = f.targetMarginPercent - f.estimatedMarginPercent;
      if (gap > 0) lines.push(`현재 시장가로 팔면 목표 마진보다 ${pct(gap)}p 부족합니다(손실은 아닙니다).`);
    }
    if (f.targetPriceKrw != null && f.domesticLowestPriceKrw != null) {
      const diff = f.targetPriceKrw - f.domesticLowestPriceKrw;
      if (diff > 0) lines.push(`목표 마진을 채우려면 시장 기준가보다 ${won(diff)} 더 받아야 합니다.`);
    }
    // MI-SUPPLY-ADVANTAGE-1 — B(목표 마진 미달)에서 공급이 제한적이면
    // "시장가에 맞춰라"가 유일한 답이 아니다. 목표 마진 가격을 시험해볼
    // 여지를 격차 금액과 함께 제시한다(확정 표현 금지).
    const premiumGap =
      f.targetPriceKrw != null && f.domesticLowestPriceKrw != null
        ? f.targetPriceKrw - f.domesticLowestPriceKrw
        : null;
    const supplyB = supplyLines(supply, f.sellerCount, premiumGap);
    if (supplyB.length === 0) {
      lines.push("→ 가격 인상보다 매입가·배송비 절감이나 구성 변경을 먼저 검토하세요.");
    }
    return [...lines, ...supplyB, ...competitionLines(f.sellerCount, supply)];
  }

  if (marketCase === "C") {
    const numbers: string[] = [];
    if (f.landedCostKrw != null) numbers.push(`착지원가 ${won(f.landedCostKrw)}`);
    if (f.domesticLowestPriceKrw != null) numbers.push(`시장 기준가 ${won(f.domesticLowestPriceKrw)}`);
    if (f.landedCostKrw != null && f.domesticLowestPriceKrw != null) {
      const loss = f.landedCostKrw - f.domesticLowestPriceKrw;
      if (loss > 0) numbers.push(`예상 차액 -${won(loss)}`);
    }
    if (numbers.length === 0) return [];
    lines.push(numbers.join(" · "));
    lines.push("국내 시장가로 팔면 착지원가도 회수하지 못합니다.");
    lines.push("→ 단품 판매는 권장하지 않습니다. 매입가 절감이나 다른 공급처를 먼저 확인하세요.");
    // 손실 구간에서는 경쟁 문구를 붙이지 않는다 — "차별화 전략"을 권하면
    // 팔아도 된다는 신호로 읽힌다.
    return lines;
  }

  // CASE D(또는 marketCase 없음) — 국내 동일상품을 확정하지 못한 상태다.
  // 국내 최저가/판매처 수를 근거로 쓰지 않는다(CPO 명시 금지).
  if (f.brandMedianPriceKrw != null) {
    const numbers = [`브랜드 시장 중앙값 ${won(f.brandMedianPriceKrw)}`];
    if (f.targetPriceKrw != null) numbers.push(`목표마진 판매가 ${won(f.targetPriceKrw)}`);
    lines.push(numbers.join(" · "));
    if (f.targetPriceKrw != null) {
      const diff = f.targetPriceKrw - f.brandMedianPriceKrw;
      if (diff !== 0) {
        lines.push(
          diff > 0
            ? `목표마진 판매가가 브랜드 중앙값보다 ${won(diff)} 높습니다.`
            : `목표마진 판매가가 브랜드 중앙값보다 ${won(-diff)} 낮습니다.`,
        );
      }
    }
    lines.push("국내 동일상품 가격을 확정하지 못해 브랜드 시장 데이터로만 비교했습니다.");
    lines.push("→ 등록 전 동일상품의 국내 판매가를 직접 확인하세요.");
    return lines;
  }
  return [];
}

/**
 * MI-UX-4(CPO 지시, 2026-09-06) — 기본 화면용 한 줄 요약.
 *
 * buildSellingGuidance()가 낸 전략 문구는 근거까지 담느라 길다. 셀러가 먼저
 * 답을 원하는 질문은 "팔아? 말아? 얼마에?" 하나이므로, 같은 데이터에서
 * 핵심 숫자 한 줄 + 판단 한 문장만 뽑는다. 상세 문구는 그대로 두고 상세보기
 * 안에 남는다 — 정보를 줄이는 게 아니라 순서를 나누는 작업이다.
 *
 * 여기서도 새 계산은 하지 않고, 공급 판정 게이트(basis === "EXACT")도 동일한
 * deriveSupplyStatus를 재사용한다 — 요약과 상세가 다른 말을 할 수 없다.
 */
/**
 * MI-UX-6(CPO 지시, 2026-09-06) — 이 요약은 "팔아도 되는가"에 답하지 않는다.
 * 그 질문은 화면 상단의 판매 판단 카드가 이미 답하고 있어서, 여기서 같은
 * 어휘를 쓰면 결론이 두 번 나온 것처럼 보인다. 이 영역이 답하는 질문은
 * 하나다: **국내 시장에서 어떤 가격 전략을 쓸 수 있는가.**
 * 문구는 가격 경쟁력 / 가격 여지 / 공급 상황 세 영역 안에서만 쓴다
 * ("판매해볼 만합니다", "조건부로 판매하세요" 같은 판정 어휘 금지 —
 * 테스트로 고정한다).
 */
export interface SellingSummary {
  /** 화면 색/아이콘 결정용. 새 판정이 아니라 marketCase + 공급 축의 표현이다. */
  tone: "GOOD" | "CAUTION" | "STOP" | "UNKNOWN";
  /** 결론 한 줄 — "판매해볼 만합니다" 같은 셀러 언어. */
  headline: string;
  /** 핵심 숫자 최대 2개. 없으면 null. */
  numbers: string | null;
  /** 행동 한 문장. */
  action: string;
  /**
   * MI-ACTION-1(CPO 지시, 2026-09-06) — 행동 문장이 제시하는 "지금 등록할
   * 가격". 셀러의 마지막 질문이 "그래서 얼마로 올려?"이므로 판단을 숫자
   * 하나로 닫는다. 다만 아무 때나 가격을 제시하지 않는다:
   *   A        추천 판매가
   *   B+공급제한  목표마진가 (공급이 적어 시험해볼 근거가 있을 때만)
   *   B+공급충분  null — 시장가가 낮은데 목표가를 권하면 안 팔릴 가격을 권하는 셈
   *   C        null — 손실 구간에서 등록 가격을 권하지 않는다
   *   D        null — 국내 가격을 모르는데 등록가를 권할 수 없다
   * 값이 없으면 문장에서도 금액이 빠진다(없는 숫자를 만들지 않는다).
   */
  actionPriceKrw: number | null;
}

/** MI-UX-5 — 기본 화면 숫자는 최대 2개다. 더 보여주면 "무엇이 중요한지"가
 * 사라진다. 값이 없는 항목은 자리를 차지하지 않고 다음 우선순위가 올라온다. */
function pickTwo(parts: (string | null)[]): string | null {
  const kept = parts.filter((p): p is string => p != null).slice(0, 2);
  return kept.length > 0 ? kept.join(" · ") : null;
}

export function buildSellingSummary(
  marketCase: "A" | "B" | "C" | "D" | null,
  f: SellingGuidanceFacts,
): SellingSummary {
  const supply = deriveSupplyStatus({ sellerCount: f.sellerCount, domesticBasis: f.domesticBasis });
  const supplyLimited = supply === "SCARCE" || supply === "LIMITED";
  // sellerCount는 공급 판정이 성립할 때만 노출한다 — 확인 못 한 수치를
  // 첫 화면에 올리지 않는다(추정 문구 금지).
  const sellerPart = supply !== "UNKNOWN" && f.sellerCount != null ? `국내 판매처 ${f.sellerCount}곳` : null;

  if (marketCase === "A") {
    return {
      tone: "GOOD",
      headline: "시장 가격 경쟁력 있음",
      numbers: pickTwo([
        f.recommendedPriceKrw != null ? `추천가 ${won(f.recommendedPriceKrw)}` : null,
        f.estimatedMarginPercent != null ? `예상 마진 ${pct(f.estimatedMarginPercent)}` : null,
        f.domesticLowestPriceKrw != null ? `시장 기준가 ${won(f.domesticLowestPriceKrw)}` : null,
      ]),
      action:
        f.recommendedPriceKrw != null
          ? `→ 먼저 ${won(f.recommendedPriceKrw)}로 등록해 시장 반응을 확인하세요.`
          : "국내 시장가보다 낮은 가격에서도 목표 마진이 확보됩니다.",
      actionPriceKrw: f.recommendedPriceKrw,
    };
  }

  if (marketCase === "B") {
    const gapToTarget =
      f.targetPriceKrw != null && f.domesticLowestPriceKrw != null
        ? f.targetPriceKrw - f.domesticLowestPriceKrw
        : null;
    // MI-SUPPLY-ADVANTAGE-1 안전장치 유지 — supplyLimited는 basis === "EXACT"
    // 일 때만 참이 될 수 있다. 못 찾은 경우는 아래 일반 경쟁 분기로 간다.
    if (supplyLimited) {
      return {
        tone: "CAUTION",
        headline: "국내 공급이 적어 가격 여지가 있습니다",
        numbers: pickTwo([
          f.targetPriceKrw != null ? `목표마진가 ${won(f.targetPriceKrw)}` : null,
          sellerPart,
        ]),
        action:
          f.targetPriceKrw != null
            ? `→ 먼저 ${won(f.targetPriceKrw)}로 등록해 시장 반응을 확인하세요.`
            : "높은 가격으로 먼저 시장 반응을 확인해보세요.",
        actionPriceKrw: f.targetPriceKrw,
      };
    }
    return {
      tone: "CAUTION",
      headline: "시장 가격 경쟁력이 부족합니다",
      numbers: pickTwo([
        f.domesticLowestPriceKrw != null ? `시장 기준가 ${won(f.domesticLowestPriceKrw)}` : null,
        f.estimatedMarginPercent != null ? `예상 마진 ${pct(f.estimatedMarginPercent)}` : null,
      ]),
      action:
        gapToTarget != null && gapToTarget > 0
          ? `목표마진가와 ${won(gapToTarget)} 차이 — 매입가·배송비나 구성 조정을 먼저 검토하세요.`
          : "국내 경쟁 가격이 낮아 목표 마진을 확보하기 어렵습니다.",
      // 시장가가 목표가보다 낮은 상황에서 목표가를 등록가로 권하면 안 팔릴
      // 가격을 권하는 셈이다 — 여기서는 가격을 제시하지 않는다.
      actionPriceKrw: null,
    };
  }

  if (marketCase === "C") {
    // 손실 구간에서는 공급이 부족해도 "테스트해볼 여지" 문구를 붙이지 않는다
    // (supply를 참조하지 않는다) — 손실 회피가 최우선이다.
    const loss =
      f.landedCostKrw != null && f.domesticLowestPriceKrw != null
        ? f.landedCostKrw - f.domesticLowestPriceKrw
        : null;
    return {
      tone: "STOP",
      headline: "현재 시장 가격에서는 수익성 부족",
      numbers: pickTwo([
        f.landedCostKrw != null ? `착지원가 ${won(f.landedCostKrw)}` : null,
        loss != null && loss > 0
          ? `예상 손실 -${won(loss)}`
          : f.domesticLowestPriceKrw != null
            ? `시장 기준가 ${won(f.domesticLowestPriceKrw)}`
            : null,
      ]),
      action: "등록 전 매입가 절감이나 다른 공급처를 먼저 확인하세요.",
      // 손실 구간에서는 어떤 등록 가격도 제시하지 않는다.
      actionPriceKrw: null,
    };
  }

  // CASE D / 판정 없음 — 없는 판매처 수·최저가·공급 판단을 만들지 않는다.
  return {
    tone: "UNKNOWN",
    headline: "국내 동일상품 시장 데이터 부족",
    numbers: f.brandMedianPriceKrw != null ? `비교 기준가 ${won(f.brandMedianPriceKrw)}` : null,
    action: "국내 동일상품 가격을 확인한 뒤 등록 가격을 정하세요.",
    // 국내 가격을 모르는 상태에서 등록가를 권하지 않는다.
    actionPriceKrw: null,
  };
}

export function buildSellingGuidance(
  marketCase: "A" | "B" | "C" | "D" | null,
  signals: MarketSignal[],
  facts?: SellingGuidanceFacts,
): string[] {
  // UX-3 — 실제 숫자로 만들 수 있으면 그것을 쓴다. 쓸 숫자가 하나도 없을
  // 때만 아래 정성 문구로 되돌아간다(없는 값을 지어내지 않기 위한 폴백이지
  // 기본값이 아니다). facts가 없으면 기존 동작 그대로다.
  if (facts) {
    const numeric = numericGuidance(marketCase, facts);
    if (numeric.length > 0) return numeric;
  }

  const positiveCount = signals.filter((s) => s.level === "high").length;
  const hasSignal = positiveCount > 0;

  if (marketCase === "A") {
    return hasSignal
      ? ["가격 경쟁력과 시장 신호가 모두 긍정적입니다.", "국내 최저가보다 소폭 낮은 가격으로 진입을 검토해보세요.", "초기 판매 반응을 본 뒤 가격을 조정하는 것을 권장합니다."]
      : ["가격 경쟁력은 확보되지만 시장 신호는 아직 뚜렷하지 않습니다.", "등록 후 초기 반응을 지켜보는 것을 권장합니다."];
  }
  if (marketCase === "B") {
    return ["목표 마진에는 못 미치지만 손실 없이 판매할 수 있는 가격입니다.", "국제 배송비 절감이 가능한지 확인해보세요.", "묶음 판매나 객단가를 높이는 전략을 검토해보세요."];
  }
  if (marketCase === "C") {
    return hasSignal
      ? ["상품 자체에 대한 관심은 확인되지만, 현재 소싱 가격으로는 경쟁력이 부족합니다.", "더 낮은 해외 소싱가나 다른 공급처를 확인해보세요.", "세일/할인 시점을 다시 확인해보세요."]
      : ["현재 소싱 가격으로는 국내 시장에서 경쟁력을 확보하기 어렵습니다.", "다른 공급처나 세일 시점을 확인해보세요."];
  }
  // CASE D 또는 marketCase 없음 — 확정 가격 경쟁력 판정이 아직 없으므로
  // "판매 추천/시장 경쟁력 있음" 같은 확정형 표현을 쓰지 않는다.
  return hasSignal
    ? ["국내 동일상품 가격은 아직 확인되지 않았지만, 브랜드/카테고리 관심 신호는 확인됩니다.", "소량 테스트 등록으로 초기 반응을 확인해보는 것을 검토해보세요.", "판매가는 목표 마진 기준으로 별도 설정이 필요합니다."]
    : ["국내 동일상품 가격과 시장 신호 모두 아직 확인되지 않았습니다.", "등록 전 직접 시장 조사를 권장합니다."];
}

/**
 * MI-CONFIDENCE-1(CPO 지시, 2026-09-06) — "신뢰도 ●●○"만 보여주면 셀러는
 * "왜 ●●○인데?"를 묻게 된다. 이 함수는 그 답을 만든다.
 *
 * 중요한 제약이 둘 있다.
 *  1. 새 점수나 임계값을 만들지 않는다. 공급 판정의 1~2/3~5/6+ 같은 근거
 *     없는 숫자를 또 늘리지 않는다. 여기서 하는 일은 "이미 확보된 데이터가
 *     있는가/없는가"를 항목별로 세는 것뿐이다.
 *  2. 신뢰도가 낮다고 결과를 숨기지 않는다. 이 값은 "쓸 수 없음"이 아니라
 *     "지금 판단이 어떤 데이터 위에 서 있는가"를 설명한다.
 */
export interface ConfidenceItem {
  label: string;
  confirmed: boolean;
  /** 확인되지 않은 이유 — 확인된 항목은 null. */
  note: string | null;
}

export interface ConfidenceBasis {
  confirmedCount: number;
  totalCount: number;
  items: ConfidenceItem[];
}

export function buildConfidenceBasis(f: SellingGuidanceFacts, signals: MarketSignal[]): ConfidenceBasis {
  const searchLevel = signals.find((s) => s.key === "searchInterest")?.level ?? "unknown";
  // 판매처 수는 동일상품이 확정됐을 때만 "확인됨"으로 센다 — 공급 판정과
  // 같은 게이트를 쓴다(두 곳이 다른 기준을 쓰면 화면이 서로 모순된다).
  const supply = deriveSupplyStatus({ sellerCount: f.sellerCount, domesticBasis: f.domesticBasis });

  const items: ConfidenceItem[] = [
    {
      label: "국내 동일상품 확인",
      confirmed: f.domesticBasis === "EXACT",
      note:
        f.domesticBasis === "EXACT"
          ? null
          : f.domesticBasis === "COMPARISON"
            ? "유사상품만 확인돼 동일상품으로 확정하지 못했습니다"
            : "국내에서 동일상품을 찾지 못했습니다",
    },
    {
      label: "국내 판매처 수 확인",
      confirmed: supply !== "UNKNOWN" && f.sellerCount != null && f.sellerCount > 0,
      note: supply !== "UNKNOWN" ? null : "동일상품이 확정되지 않아 판매처 수를 근거로 쓰지 않았습니다",
    },
    {
      label: "국내 가격 데이터 확보",
      confirmed: f.domesticLowestPriceKrw != null,
      note: f.domesticLowestPriceKrw != null ? null : "비교할 국내 판매가를 확인하지 못했습니다",
    },
    {
      label: "해외 원가·착지원가 계산",
      confirmed: f.landedCostKrw != null,
      note: f.landedCostKrw != null ? null : "구매가가 확인되지 않아 원가를 계산하지 못했습니다",
    },
    {
      label: "검색 관심 데이터",
      confirmed: searchLevel !== "unknown",
      note: searchLevel !== "unknown" ? null : "네이버 검색 관심 데이터를 확인하지 못했습니다",
    },
  ];

  return { confirmedCount: items.filter((i) => i.confirmed).length, totalCount: items.length, items };
}
