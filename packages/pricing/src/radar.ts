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

/** DataLab 호출 결과 상태 — crawler의 SearchTrendStatus와 같은 값을 받는다. */
export type RadarSearchTrendStatus =
  | "OK"
  | "NO_DATA"
  | "AUTH_ERROR"
  | "NOT_CONFIGURED"
  | "REQUEST_ERROR"
  | "TRANSIENT_ERROR";

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
  /** 국내 가격 근거의 출처. NONE이면 비교할 대상이 없다. */
  domesticBasis: "EXACT" | "COMPARISON" | "NONE";
  searchTrend: { status: RadarSearchTrendStatus; ratio: number | null };
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
 * 🏷️ 국내 가격 경쟁력 — 내 예상 판매가가 국내 기준가 대비 어디인가.
 *
 * 경계값 근거: CASE A가 이미 `marketPrice * 0.99`를 권장가로 쓰고, CASE B는
 * 시장가를 그대로 쓴다. 즉 기존 정책상 "시장가 이하"가 경쟁 가능한 구간이다.
 * 그래서 1.00을 HIGH의 경계로 삼았다. MEDIUM 상한 1.10은 "시장가보다 10%
 * 이상 비싸면 가격으로는 경쟁이 어렵다"는 보수적 선이다.
 *
 * 여기에 exact/comparison 신뢰도를 섞지 않는다 — 그건 🎯 축이 따로 말한다.
 * 섞으면 같은 사실을 두 축에서 두 번 세게 된다(CPO 지시).
 */
const PRICE_COMPETITIVE_RATIO = 1.0;
const PRICE_ACCEPTABLE_RATIO = 1.1;

function priceCompetitivenessAxis(input: RadarInput): RadarAxisState {
  if (input.domesticBasis === "NONE" || input.domesticLowestPriceKrw == null) {
    return { status: "UNAVAILABLE", reason: "국내 비교 가능한 상품을 찾지 못했습니다" };
  }
  if (input.recommendedPriceKrw == null) {
    // CASE C/D — 권장가를 만들지 않는 것이 기존 정책이다. 없는 가격으로
    // 위치를 계산하지 않는다.
    return { status: "UNAVAILABLE", reason: "등록 가격을 정하지 못했습니다" };
  }
  const ratio = input.recommendedPriceKrw / input.domesticLowestPriceKrw;
  if (ratio <= PRICE_COMPETITIVE_RATIO) return { status: "SCORED", level: "HIGH" };
  if (ratio <= PRICE_ACCEPTABLE_RATIO) return { status: "SCORED", level: "MEDIUM" };
  return { status: "SCORED", level: "LOW" };
}

/**
 * 🔎 시장 수요 — DataLab 검색 관심 신호.
 *
 * ratio는 "조회 구간 내 최고점=100"인 **상대지수**다. 절대 검색량도 판매량도
 * 아니다(crawler 주석의 CPO 절대 금지사항). 그래서 0~100을 그대로 비례
 * 변환하지 않고 3등급으로만 쓴다 — 정밀도를 지어내지 않기 위해서다.
 *
 * NO_DATA는 UNAVAILABLE과 구분한다. 인증은 성공했고 그 브랜드의 검색이
 * 실제로 없었다는 뜻이라, "우리가 못 봤다"와는 다른 사실이다.
 */
const DEMAND_HIGH_RATIO = 60;
const DEMAND_MEDIUM_RATIO = 20;

function marketDemandAxis(input: RadarInput): RadarAxisState {
  const { status, ratio } = input.searchTrend;
  if (status === "NO_DATA") {
    return { status: "NO_DATA", reason: "검색 데이터가 없습니다" };
  }
  if (status !== "OK" || ratio == null) {
    // 인증 실패/미설정/일시 오류를 사용자에게 구분해 보여주지 않는다 —
    // 기술적 원인은 서버 로그의 몫이고, 셀러에게는 "확인 못 함"이면 충분하다.
    return { status: "UNAVAILABLE", reason: "검색 관심도를 확인하지 못했습니다" };
  }
  if (ratio >= DEMAND_HIGH_RATIO) return { status: "SCORED", level: "HIGH" };
  if (ratio >= DEMAND_MEDIUM_RATIO) return { status: "SCORED", level: "MEDIUM" };
  return { status: "SCORED", level: "LOW" };
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
