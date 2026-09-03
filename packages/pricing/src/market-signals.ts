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

function domesticPresenceLevel(sellerCount: number): MarketSignalLevel {
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

export interface DeriveMarketSignalsInput {
  /** market-intelligence.ts가 이미 계산한 domesticMarketSplit.resolved.sellerCount
   * 를 그대로 받는다 — 새 검색을 하지 않는다. */
  domesticSellerCount: number;
  /** Naver DataLab 검색어트렌드 상대지수(0~100) — null이면 미설정/조회실패,
   * "낮음"이 아니라 "확인 불가"로 정직하게 표시한다. */
  searchInterestRatio: number | null;
  titleText: string;
  nowMonth: number;
}

export function deriveMarketSignals(input: DeriveMarketSignalsInput): MarketSignalsResult {
  const seasonFit = computeSeasonFit(input.titleText, input.nowMonth);
  const domesticLevel = domesticPresenceLevel(input.domesticSellerCount);
  const searchLevel = searchInterestLevel(input.searchInterestRatio);

  const signals: MarketSignal[] = [
    {
      key: "domesticPresence",
      label: "국내 판매처",
      level: domesticLevel,
      evidence:
        input.domesticSellerCount > 0
          ? `국내 편집샵 ${input.domesticSellerCount}곳에서 확인됨`
          : "등록된 국내 편집샵에서 확인되지 않음",
    },
    {
      key: "searchInterest",
      label: "검색 관심",
      level: searchLevel,
      evidence:
        input.searchInterestRatio == null
          ? "네이버 검색 데이터를 확인하지 못했습니다"
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
export function buildSellingGuidance(marketCase: "A" | "B" | "C" | "D" | null, signals: MarketSignal[]): string[] {
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
