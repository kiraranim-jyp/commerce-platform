/**
 * P-31(CPO 지시, 2026-09-03) — "그래서 이 상품을 팔아? 말아?"를 한 화면에서
 * 판단할 수 있게 하는 레이어. 아키텍처 순서를 코드로 강제한다:
 *
 *   PRICE REALITY → CASE A/B/C/D → MARKET SIGNAL → SELLER GUIDANCE
 *
 * 이 파일은 price-recommendation.ts를 import하지 않는다 — marketCase를
 * "입력"으로만 받고, 어떤 반환값도 marketCase/recommendedPrice/마진을 다시
 * 계산하거나 바꾸지 않는다(CPO 절대 금지 3을 구조로 강제).
 *
 * ── 설계상 가장 중요한 결정 ──────────────────────────────────────────
 * 화면에는 이미 sellerFacingVerdict(🟢 판매 추천 / 🟡 조건부 판매 /
 * 🔴 판매 비추천)라는 최종 판정이 있다(representative-seller-decision.ts).
 * 여기서 시장 신호로 "두 번째 종합 판정"을 새로 만들면 같은 화면에 서로
 * 다른 결론이 두 개 뜬다 — P-29에서 고친 마진 이원화와 같은 결함이다.
 * 그래서 새 판정을 만들지 않고, 기존 판정을 단일 소스로 두되 시장 신호는
 * **강등만 가능하고 절대 승격시킬 수 없는** 보정 레이어로만 작용시킨다.
 * 시장 신호가 아무리 좋아도 가격이 나쁘면 판매 추천이 될 수 없다.
 */
import type { MarketSignal, MarketSignalLevel } from "./market-signals";
import type { MarketCaseCode } from "./price-recommendation";
import type { SellerFacingVerdictCode } from "./representative-seller-decision";

/** 종합 시장 상태 — 가격 경쟁력(CASE A/B/C/D)과 완전히 별개 레이어다. */
export type MarketOutlook = "GOOD" | "WATCH" | "WEAK" | "UNKNOWN";

export interface MarketOutlookResult {
  outlook: MarketOutlook;
  /** 판단에 실제로 쓰인(확인 불가가 아닌) 신호 개수 — UI가 "데이터 부족"을
   * 정직하게 설명할 수 있게 함께 돌려준다. */
  knownSignalCount: number;
  summary: string;
}

const OUTLOOK_SUMMARY: Record<MarketOutlook, string> = {
  GOOD: "시장 진입 신호가 양호합니다",
  WATCH: "일부 조건은 확인이 필요합니다",
  WEAK: "시장 진입에 불리한 신호가 있습니다",
  UNKNOWN: "시장 상태를 판단할 데이터가 부족합니다",
};

/**
 * 종합 시장 상태를 계산한다.
 *
 * CPO 지시("데이터 부족 ≠ 시장이 나쁨")를 계산식으로 강제한다 — unknown
 * 신호는 점수에서 아예 제외되며, 어떤 경우에도 WEAK를 만들지 못한다.
 * 확인된 신호가 1개 이하로 너무 적으면 억지로 GOOD/WEAK를 만들지 않고
 * UNKNOWN으로 둔다.
 */
export function deriveMarketOutlook(signals: MarketSignal[]): MarketOutlookResult {
  const known = signals.filter((s) => s.level !== "unknown");
  const highCount = known.filter((s) => s.level === "high").length;
  const lowCount = known.filter((s) => s.level === "low").length;

  let outlook: MarketOutlook;
  if (known.length <= 1) {
    outlook = "UNKNOWN";
  } else if (lowCount > highCount) {
    outlook = "WEAK";
  } else if (highCount >= 1 && lowCount === 0) {
    outlook = "GOOD";
  } else {
    outlook = "WATCH";
  }

  return { outlook, knownSignalCount: known.length, summary: OUTLOOK_SUMMARY[outlook] };
}

/**
 * 시장 신호가 최종 판정에 미칠 수 있는 영향의 전부.
 *
 * - 승격은 절대 없다(시장이 좋아도 가격 판정을 올리지 않는다).
 * - WEAK만 강등시킨다. WATCH/UNKNOWN은 판정을 바꾸지 않는다 — UNKNOWN으로
 *   강등하면 "데이터가 없다"가 "시장이 나쁘다"로 둔갑하기 때문이다.
 * - 이미 NOT_RECOMMENDED면 더 내릴 곳이 없다.
 */
export function applyMarketOutlookToVerdict(
  priceVerdict: SellerFacingVerdictCode,
  outlook: MarketOutlook,
): { code: SellerFacingVerdictCode; downgraded: boolean } {
  if (outlook === "WEAK" && priceVerdict === "RECOMMENDED") {
    return { code: "CONDITIONAL", downgraded: true };
  }
  return { code: priceVerdict, downgraded: false };
}

/** "왜 이런 판단인가"에 쓰는 근거 항목. CPO가 지정한 우선순위 순서대로
 * 반환된다(1 가격 수익성 → 2 동일상품 국내 가격 → 3 시장 관심 → 4 경쟁
 * 판매처 → 5 시즌성). */
export type DecisionFactorKey =
  | "priceProfitability"
  | "domesticPrice"
  | "marketInterest"
  | "sellerCompetition"
  | "seasonFit";

export interface DecisionFactor {
  key: DecisionFactorKey;
  label: string;
  level: MarketSignalLevel;
  detail: string;
}

export interface BuildDecisionFactorsInput {
  marketCase: MarketCaseCode | null;
  /** recommendation.estimatedMarginPercent를 그대로 받는다 — 여기서 마진을
   * 다시 계산하지 않는다(P-29 단일 소스 원칙). */
  estimatedMarginPercent: number | null;
  signals: MarketSignal[];
}

/** CASE는 가격 수익성 판단의 유일한 근거다 — 여기서 마진 숫자를 보고 CASE를
 * 다시 판정하지 않는다. */
function priceProfitabilityFactor(
  marketCase: MarketCaseCode | null,
  marginPercent: number | null,
): { level: MarketSignalLevel; detail: string } {
  if (marketCase === "A") {
    return {
      level: "high",
      detail: marginPercent != null ? `목표 마진 확보 가능 (예상 ${marginPercent}%)` : "목표 마진 확보 가능",
    };
  }
  if (marketCase === "B") {
    return {
      level: "medium",
      detail:
        marginPercent != null
          ? `손실은 아니지만 목표 마진 미달 (예상 ${marginPercent}%)`
          : "손실은 아니지만 목표 마진 미달",
    };
  }
  if (marketCase === "C") {
    return { level: "low", detail: "국내 시장가로는 착지원가도 회수하지 못합니다" };
  }
  return { level: "unknown", detail: "국내 동일상품 가격 근거가 없어 수익성을 판단할 수 없습니다" };
}

function domesticPriceFactor(marketCase: MarketCaseCode | null): { level: MarketSignalLevel; detail: string } {
  if (marketCase === "D" || marketCase == null) {
    return { level: "unknown", detail: "국내 동일상품(EXACT) 가격이 확인되지 않았습니다" };
  }
  return { level: "high", detail: "국내 동일상품(EXACT) 가격을 근거로 판단했습니다" };
}

const FACTOR_LABEL: Record<DecisionFactorKey, string> = {
  priceProfitability: "가격 수익성",
  domesticPrice: "동일상품 국내 가격",
  marketInterest: "시장 관심도",
  sellerCompetition: "경쟁 판매처",
  seasonFit: "시즌 적합성",
};

export function buildDecisionFactors(input: BuildDecisionFactorsInput): DecisionFactor[] {
  const signalOf = (key: MarketSignal["key"]) => input.signals.find((s) => s.key === key);
  const price = priceProfitabilityFactor(input.marketCase, input.estimatedMarginPercent);
  const domestic = domesticPriceFactor(input.marketCase);
  const interest = signalOf("searchInterest");
  const competition = signalOf("domesticPresence");
  const season = signalOf("seasonFit");

  const factors: DecisionFactor[] = [
    { key: "priceProfitability", label: FACTOR_LABEL.priceProfitability, ...price },
    { key: "domesticPrice", label: FACTOR_LABEL.domesticPrice, ...domestic },
    {
      key: "marketInterest",
      label: FACTOR_LABEL.marketInterest,
      level: interest?.level ?? "unknown",
      detail: interest?.evidence ?? "검색 관심 데이터를 확인하지 못했습니다",
    },
    {
      key: "sellerCompetition",
      label: FACTOR_LABEL.sellerCompetition,
      level: competition?.level ?? "unknown",
      detail: competition?.evidence ?? "국내 판매처를 확인하지 못했습니다",
    },
    {
      key: "seasonFit",
      label: FACTOR_LABEL.seasonFit,
      level: season?.level ?? "unknown",
      detail: season?.evidence ?? "시즌 적합성을 판단하지 못했습니다",
    },
  ];
  return factors;
}

export interface SellerDecisionInput extends BuildDecisionFactorsInput {
  /** representative-seller-decision.ts가 이미 낸 가격/매칭 레이어 판정.
   * 이 값이 최종 판정의 단일 소스이며, 여기서 새로 만들지 않는다. */
  priceVerdict: SellerFacingVerdictCode;
}

export interface SellerDecisionResult {
  /** 화면에 보여줄 최종 판정 코드 — priceVerdict에서 시장 신호로 강등된
   * 결과일 수 있다(승격은 없다). */
  finalVerdict: SellerFacingVerdictCode;
  /** 강등 전 가격 레이어 원본 — UI가 "왜 낮아졌는지" 설명할 수 있게 남긴다. */
  priceVerdict: SellerFacingVerdictCode;
  downgradedByMarket: boolean;
  outlook: MarketOutlook;
  outlookSummary: string;
  knownSignalCount: number;
  /** CPO 지정 우선순위 순서로 고정된 판단 근거. */
  factors: DecisionFactor[];
  /** "왜 이런 판단인가" 본문 — factors와 같은 우선순위를 따른다. */
  reasons: string[];
}

export function buildSellerDecision(input: SellerDecisionInput): SellerDecisionResult {
  const { outlook, knownSignalCount, summary } = deriveMarketOutlook(input.signals);
  const applied = applyMarketOutlookToVerdict(input.priceVerdict, outlook);
  const factors = buildDecisionFactors(input);

  // 근거 본문 — 우선순위 상위 factor부터, 판단에 실제로 기여한 것만 뽑는다.
  // unknown은 "나쁨"이 아니라 "확인 불가"로 표현한다(CPO UNKNOWN 정책).
  const reasons: string[] = [];
  for (const f of factors) {
    if (f.level === "unknown") reasons.push(`${f.label}: 확인 불가 — ${f.detail}`);
    else if (f.level === "low") reasons.push(`${f.label}: 불리 — ${f.detail}`);
    else if (f.level === "high") reasons.push(`${f.label}: 양호 — ${f.detail}`);
    else reasons.push(`${f.label}: 보통 — ${f.detail}`);
  }
  if (applied.downgraded) {
    reasons.push("가격 경쟁력은 확보되지만 종합 시장 신호가 불리해 조건부로 낮췄습니다");
  }

  return {
    finalVerdict: applied.code,
    priceVerdict: input.priceVerdict,
    downgradedByMarket: applied.downgraded,
    outlook,
    outlookSummary: summary,
    knownSignalCount,
    factors,
    reasons,
  };
}
