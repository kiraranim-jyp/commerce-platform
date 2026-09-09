import type { MarketCaseCode } from "./price-recommendation";

/**
 * MI 2.0 PHASE 1(CPO 지시, 2026-09-09) — 판매 판단의 근거를 4축으로 분해한다.
 *
 * ── 이 모듈이 하지 않는 것 ─────────────────────────────────────────────
 * 새로운 판정을 만들지 않는다. CASE A~D가 내린 결론은 그대로이고, 여기서는
 * "왜 그런 결론인지"를 네 방향으로 나눠 보여줄 뿐이다. 그래서 종합점수
 * (78/100 같은 값)를 만들지 않는다 — 종합은 이미 판매 판단이 하고 있고,
 * 숫자를 하나 더 만들면 어느 쪽이 결론인지 흐려진다.
 *
 * ── 왜 "점수"가 아니라 "등급"인가 ──────────────────────────────────────
 * 축마다 원천 데이터의 성격이 다르다(CASE는 범주, 가격은 비율, matchTruth는
 * 서열). 이걸 억지로 0~100 연속값으로 만들면 실제로는 없는 정밀도를 지어내게
 * 된다. 그래서 공통적으로 표현 가능한 최소 단위인 3등급만 쓴다.
 *
 * ── 결측을 0으로 만들지 않는다 ────────────────────────────────────────
 * 이 파일에서 가장 중요한 규칙이다. "값이 낮다"와 "모른다"는 완전히 다른
 * 사실인데, 결측을 0점으로 그리면 레이더에서 둘이 똑같아 보인다. 그래서
 * score를 아예 갖지 않는 상태(UNAVAILABLE/NO_DATA)를 따로 둔다 — 호출부가
 * 실수로 0을 꺼내 쓸 수 없는 형태다.
 */
export type RadarAxisKey = "profitability" | "priceCompetitiveness" | "marketDemand" | "matchConfidence";

/** 3등급. score는 폴리곤 좌표 계산에만 쓴다(사용자에게 숫자로 보여주지 않는다). */
export type RadarLevel = "HIGH" | "MEDIUM" | "LOW";

export const RADAR_LEVEL_SCORE: Record<RadarLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export type RadarAxisState =
  /** 데이터가 있고 등급이 정해졌다. */
  | { status: "SCORED"; level: RadarLevel }
  /** 데이터가 없어서 모른다 — 낮은 것이 아니다. */
  | { status: "UNAVAILABLE"; reason: string }
  /** 정상 조회했는데 결과가 없었다 — "모른다"와 구분한다(DataLab NO_DATA). */
  | { status: "NO_DATA"; reason: string };

export interface RadarAxis {
  key: RadarAxisKey;
  label: string;
  icon: string;
  state: RadarAxisState;
}

export interface RadarResult {
  axes: RadarAxis[];
  /** 등급이 매겨진 축 수. 0이면 레이더를 그릴 근거가 없다. */
  scoredCount: number;
  /**
   * 판매 판단과 레이더가 어긋나 보이는 상황의 설명. 숨기지 않는다 —
   * "국내에선 싸게 팔 수 있지만 내 원가로는 손해"는 셀러가 반드시 알아야
   * 하는 사실이다(CPO 지시: 모순은 설명한다).
   */
  contradiction: string | null;
}

/** 검색 관심 신호 등급. marketSignals.searchInterest.level을 그대로 받고,
 * 거기에 "정상 조회했으나 결과 없음"(none)을 하나 더 둔다. */
export type RadarSearchInterest = "high" | "medium" | "low" | "none" | "unknown";

/** matchTruth 계열 값(국내/해외 공통). 모르는 값이 와도 최하 등급으로 떨어진다. */
export type RadarMatchTruth =
  | "EXACT_IDENTIFIER"
  | "STRONG_IDENTIFIER"
  | "EXACT_PRODUCT"
  | "CONFIRMED_PRODUCT"
  | "TEXT_CONFIRMED"
  | "VERY_SIMILAR"
  | "SAME_MODEL_VARIANT"
  | "SIMILAR"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICT";

export interface RadarInput {
  /** CASE A~D. null이면 판정 자체가 없다. */
  marketCase: MarketCaseCode | null;
  /** 착지원가. null이면 원본 가격을 못 읽은 것이다. */
  landedCostKrw: number | null;
  /** CASE A/B에서만 값이 있다(C/D는 구조적으로 null). */
  recommendedPriceKrw: number | null;
  /** 국내 비교 기준가(최저가). basis가 NONE이면 null. */
  domesticLowestPriceKrw: number | null;
  /** 국내 비교 평균가. 가격 구간의 상단 경계로 쓴다 — 새 상수를 만들지 않기
   * 위해 시장이 만들어 준 값을 그대로 경계로 삼는다. 없으면 2단계로 떨어진다. */
  domesticAveragePriceKrw: number | null;
  /** 국내 가격 근거의 출처. NONE이면 비교할 대상이 없다. */
  domesticBasis: "EXACT" | "COMPARISON" | "NONE";
  /** 서버가 이미 낸 검색 관심 등급. "none"은 정상 조회 후 결과 없음,
   * "unknown"은 확인 실패다 — 둘을 화면에서 다르게 말하기 위해 구분한다. */
  searchInterest: RadarSearchInterest;
  /** 가장 강한 후보의 판정. 후보가 하나도 없으면 null. */
  bestMatchTruth: RadarMatchTruth | null;
}

/**
 * 💰 수익성 — CASE A~D를 그대로 쓴다.
 *
 * 마진율 숫자로 구간을 나누지 않는 이유: CASE C(손실)와 D(근거 부족)는
 * estimatedMarginPercent가 구조적으로 null이다(price-recommendation.ts 확인).
 * 즉 마진율 기반 점수는 정작 나쁜 케이스에서 계산 자체가 안 된다.
 */
function profitabilityAxis(input: RadarInput): RadarAxisState {
  if (input.landedCostKrw == null) {
    return { status: "UNAVAILABLE", reason: "원본 상품 가격을 확인하지 못했습니다" };
  }
  switch (input.marketCase) {
    case "A":
      return { status: "SCORED", level: "HIGH" };
    case "B":
      return { status: "SCORED", level: "MEDIUM" };
    case "C":
      return { status: "SCORED", level: "LOW" };
    // CASE D는 "수익성이 나쁘다"가 아니라 "국내 동일상품 가격을 몰라서 계산할
    // 수 없다"는 뜻이다. 낮은 등급으로 떨어뜨리면 사실과 다르다.
    default:
      return { status: "UNAVAILABLE", reason: "국내 동일상품 가격을 확인하지 못했습니다" };
  }
}

/**
 * 🏷️ 국내 가격 경쟁력 — 내 예상 판매가가 국내 가격대 안에서 어디인가.
 *
 * ── 임의의 임계값을 쓰지 않는다 ───────────────────────────────────────
 * 처음에는 `가격/최저가` 비율에 1.0 / 1.1 경계를 뒀는데, 그 1.1은 근거가
 * 없는 숫자였다(CPO 반려). 새 상수를 만들면 "왜 10%인가"에 답할 수 없고,
 * 그런 숫자가 판단 근거로 굳어지는 것이 이 제품에서 가장 피해야 할 일이다.
 *
 * 그래서 경계를 **이미 시장이 만들어 준 값**으로 바꿨다. 국내 비교 결과에는
 * 최저가와 평균가가 이미 계산돼 있으므로(DomesticCompetition), 그 두 값을
 * 그대로 구간의 경계로 쓴다:
 *
 *   내 가격 ≤ 국내 최저가   → 가장 싼 축에 든다        HIGH
 *   내 가격 ≤ 국내 평균가   → 가격대 안에 있다          MEDIUM
 *   내 가격 >  국내 평균가   → 가격대보다 비싸다         LOW
 *
 * 새 상수가 하나도 없고, 상품마다 그 상품의 실제 시장 분포를 기준으로
 * 판단한다. 평균가가 없으면(표본이 얇아 계산 못 함) 최저가 기준의 2단계로만
 * 떨어진다 — 없는 경계를 지어내지 않는다.
 *
 * 여기에 exact/comparison 신뢰도를 섞지 않는다 — 그건 🎯 축이 따로 말한다.
 * 섞으면 같은 사실을 두 축에서 두 번 세게 된다(CPO 지시).
 */
function priceCompetitivenessAxis(input: RadarInput): RadarAxisState {
  if (input.domesticBasis === "NONE" || input.domesticLowestPriceKrw == null) {
    return { status: "UNAVAILABLE", reason: "국내 비교 가능한 상품을 찾지 못했습니다" };
  }
  if (input.recommendedPriceKrw == null) {
    // CASE C/D — 권장가를 만들지 않는 것이 기존 정책이다. 없는 가격으로
    // 위치를 계산하지 않는다.
    return { status: "UNAVAILABLE", reason: "등록 가격을 정하지 못했습니다" };
  }
  if (input.recommendedPriceKrw <= input.domesticLowestPriceKrw) {
    return { status: "SCORED", level: "HIGH" };
  }
  if (input.domesticAveragePriceKrw != null && input.recommendedPriceKrw <= input.domesticAveragePriceKrw) {
    return { status: "SCORED", level: "MEDIUM" };
  }
  return { status: "SCORED", level: "LOW" };
}

/**
 * 🔎 시장 수요 — 검색 관심 신호.
 *
 * ── ratio를 여기서 등급으로 자르지 않는다 ─────────────────────────────
 * 처음에는 DataLab ratio(0~100)에 60/20 경계를 뒀는데, 그것도 근거 없는
 * 숫자였다(가격 축의 1.0/1.1과 같은 문제). ratio는 "조회 구간 내 최고점=100"인
 * 상대지수라 절대 수요가 아니고, 어디부터 "높다"인지 말할 근거가 없다.
 *
 * 그래서 서버가 이미 계산해 둔 시장 신호 등급(marketSignals.searchInterest)을
 * 그대로 받는다. 같은 신호를 두 곳에서 다르게 계산하지 않게 되는 이점도 있다.
 *
 * unknown은 "확인 못 함"이다 — 인증 실패든 미설정이든 사용자에게는 구분해
 * 보여줄 이유가 없고, 기술적 원인은 서버 로그의 몫이다.
 */
function marketDemandAxis(input: RadarInput): RadarAxisState {
  switch (input.searchInterest) {
    case "high":
      return { status: "SCORED", level: "HIGH" };
    case "medium":
      return { status: "SCORED", level: "MEDIUM" };
    case "low":
      return { status: "SCORED", level: "LOW" };
    case "none":
      // 정상 조회했는데 검색 자체가 없었다 — "우리가 못 봤다"와 다른 사실이다.
      return { status: "NO_DATA", reason: "검색 데이터가 없습니다" };
    default:
      return { status: "UNAVAILABLE", reason: "검색 관심도를 확인하지 못했습니다" };
  }
}

/**
 * 🎯 상품 판단 신뢰도 — matchTruth 서열을 그대로 등급으로 옮긴다.
 *
 * 이 축에는 결측이 없다. 후보가 하나도 없어도 그건 "모른다"가 아니라
 * "근거가 없다"는 확인된 사실이고, 낮은 신뢰도로 표현하는 것이 정확하다.
 * 새 매칭 알고리즘을 만들지 않는다 — 기존 판정값을 읽기만 한다.
 */
function matchConfidenceAxis(input: RadarInput): RadarAxisState {
  switch (input.bestMatchTruth) {
    case "EXACT_IDENTIFIER":
    case "STRONG_IDENTIFIER":
    case "EXACT_PRODUCT":
    case "CONFIRMED_PRODUCT":
      return { status: "SCORED", level: "HIGH" };
    case "TEXT_CONFIRMED":
    case "VERY_SIMILAR":
    case "SAME_MODEL_VARIANT":
      return { status: "SCORED", level: "MEDIUM" };
    default:
      // SIMILAR / INSUFFICIENT_EVIDENCE / CONFLICT / 후보 없음(null)
      return { status: "SCORED", level: "LOW" };
  }
}

/**
 * 판매 판단과 레이더가 어긋나 보이는 조합을 문장으로 설명한다.
 *
 * 대표적인 것이 CASE C다 — 국내 최저가보다 싸게 팔 수 있어서 가격 경쟁력은
 * 높아 보이는데, 그 가격이 내 원가보다 낮아 손실이다. 이걸 설명하지 않으면
 * 셀러는 "경쟁력 있다면서 왜 팔지 말라는 거지?"에서 멈춘다.
 */
function deriveContradiction(input: RadarInput, axes: RadarAxis[]): string | null {
  const price = axes.find((a) => a.key === "priceCompetitiveness")?.state;
  const profit = axes.find((a) => a.key === "profitability")?.state;
  if (
    input.marketCase === "C" &&
    price?.status === "SCORED" &&
    price.level === "HIGH"
  ) {
    return "국내 가격대에서는 경쟁 가능하지만, 현재 원가 기준으로는 손실입니다.";
  }
  if (
    profit?.status === "SCORED" &&
    profit.level === "HIGH" &&
    price?.status === "SCORED" &&
    price.level === "LOW"
  ) {
    return "목표 마진은 확보되지만, 국내 비교가격보다 높아 판매가 어려울 수 있습니다.";
  }
  return null;
}

export function computeRadar(input: RadarInput): RadarResult {
  const axes: RadarAxis[] = [
    { key: "profitability", label: "수익성", icon: "💰", state: profitabilityAxis(input) },
    { key: "priceCompetitiveness", label: "국내 가격 경쟁력", icon: "🏷️", state: priceCompetitivenessAxis(input) },
    { key: "marketDemand", label: "시장 수요", icon: "🔎", state: marketDemandAxis(input) },
    { key: "matchConfidence", label: "상품 판단 신뢰도", icon: "🎯", state: matchConfidenceAxis(input) },
  ];
  return {
    axes,
    scoredCount: axes.filter((a) => a.state.status === "SCORED").length,
    contradiction: deriveContradiction(input, axes),
  };
}
