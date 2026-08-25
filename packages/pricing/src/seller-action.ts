import type { PriceLevel } from "./price-decision";
import type { PriceChange, PriceTrendResult } from "./price-history";

/**
 * N-4.18-H-2(대표님 지시, 2026-08-25) — "가격 비교"에서 끝내지 않고 "그래서
 * 지금 무엇을 해야 하는가"를 상품 단위로 제안한다. 새 가격판정 엔진을
 * 만들지 않는다 — 기존 priceLevel(GREEN/YELLOW/RED/UNKNOWN, N-4.07 STEP4에서
 * 이미 확정된 배색)을 그대로 1:1로 재사용한다("임의의 % threshold를 새로
 * 만들지 말고 현재 priceLevel 판정 기준을 재사용한다").
 */
export type SellerActionStatus = "PRICE_KEEP" | "PRICE_REVIEW" | "PRICE_ADJUST" | "INSUFFICIENT_DATA";

const STATUS_FROM_LEVEL: Record<PriceLevel, SellerActionStatus> = {
  GREEN: "PRICE_KEEP",
  YELLOW: "PRICE_REVIEW",
  RED: "PRICE_ADJUST",
  UNKNOWN: "INSUFFICIENT_DATA",
};

const STATUS_ICON: Record<SellerActionStatus, string> = {
  PRICE_KEEP: "🟢",
  PRICE_REVIEW: "🟡",
  PRICE_ADJUST: "🔴",
  INSUFFICIENT_DATA: "⚪",
};

/** "비교 데이터 부족 = 가격 경쟁력 없음"으로 절대 해석하지 않는다(대표님 명시) —
 * INSUFFICIENT_DATA 문구는 그 자체로 중립적이어야 한다. */
const STATUS_TITLE: Record<SellerActionStatus, string> = {
  PRICE_KEEP: "현재 가격 유지 권장",
  PRICE_REVIEW: "가격 조정 검토",
  PRICE_ADJUST: "가격 조정이 필요할 수 있습니다",
  INSUFFICIENT_DATA: "비교 데이터가 부족합니다",
};

export interface SellerActionSignal {
  icon: string;
  title: string;
  detail: string;
}

export interface SellerActionResult {
  status: SellerActionStatus;
  icon: string;
  title: string;
  /** STEP H-2-2/3/4 — 국내 가격변화/품절/해외원가변화/국내+해외 결합 신호.
   * 실제 데이터가 있을 때만 채워진다(변화 없음/데이터 없음이면 빈 배열). */
  signals: SellerActionSignal[];
  /** STEP H-2-6 — "왜 이 추천이 나왔는지"(matchReasons와 동일한 패턴,
   * 실제 값이 있는 항목만 나열). */
  reasons: string[];
}

export interface SellerActionDomesticInput {
  lowestPriceKrw: number | null;
  averagePriceKrw: number | null;
  sellerCount: number;
  priceGapVsLowestPercent: number | null;
  priceGapVsAveragePercent: number | null;
  /** 국내 관측치 전체(모든 소스 합산)의 최근 가격 추세 — 이미 UI에 표시 중인
   * domesticShopTrend7d를 그대로 재사용한다(새 추세 계산을 만들지 않는다). */
  trend: PriceTrendResult | null;
  soldOutCount: number;
}

export interface SellerActionOriginInput {
  /** SELLER_ORIGIN 관측치의 최근 2건 비교(기존 computePriceChange 재사용). */
  change: PriceChange | null;
}

export interface SellerActionInput {
  priceLevel: PriceLevel;
  currentSellingPriceKrw: number | null;
  domestic: SellerActionDomesticInput;
  origin: SellerActionOriginInput;
}

type TrendDirection = "UP" | "DOWN" | "SAME";

function originDirection(change: PriceChange | null): TrendDirection | null {
  if (!change) return null;
  if (change.changeRatePercent > 0) return "UP";
  if (change.changeRatePercent < 0) return "DOWN";
  return "SAME";
}

export function computeSellerAction(input: SellerActionInput): SellerActionResult {
  const status = STATUS_FROM_LEVEL[input.priceLevel];
  const signals: SellerActionSignal[] = [];

  // STEP H-2-2 — 국내 가격 변화(실제 변화가 저장돼 있을 때만 표시).
  const domesticTrend = input.domestic.trend;
  if (domesticTrend && domesticTrend.current != null && domesticTrend.previous != null) {
    if (domesticTrend.trend === "DOWN") {
      signals.push({
        icon: "🔴",
        title: "국내 경쟁가격 하락",
        detail: `동일상품 가격이 ₩${domesticTrend.previous.toLocaleString()} → ₩${domesticTrend.current.toLocaleString()}으로 하락했습니다. → 판매가 조정을 검토하세요.`,
      });
    } else if (domesticTrend.trend === "UP") {
      signals.push({
        icon: "🟢",
        title: "시장 가격 상승",
        detail: `동일상품 비교가격이 ₩${domesticTrend.previous.toLocaleString()} → ₩${domesticTrend.current.toLocaleString()}으로 상승했습니다. → 현재 판매가격 유지가 유리할 수 있습니다.`,
      });
    }
  }

  // STEP H-2-2 — 경쟁상품 품절(품절 상품 자체는 계속 가격 계산에서 제외).
  if (input.domestic.soldOutCount > 0) {
    signals.push({
      icon: "🟢",
      title: "경쟁상품 품절",
      detail: `비교 중인 동일상품 판매처 ${input.domestic.soldOutCount}곳이 품절되었습니다. → 현재 가격 경쟁력이 개선될 수 있습니다.`,
    });
  }

  // STEP H-2-3 — 해외 원가 변화(환율 재계산 없음, 원가 변화만 표시).
  const origin = originDirection(input.origin.change);
  if (input.origin.change && origin === "UP") {
    signals.push({
      icon: "⚠️",
      title: "해외 원가 상승",
      detail: `해외 비교가격이 ${Math.abs(input.origin.change.changeRatePercent)}% 상승했습니다. 현재 판매가격 유지 시 예상 마진을 다시 확인하세요.`,
    });
  } else if (input.origin.change && origin === "DOWN") {
    signals.push({
      icon: "🟢",
      title: "해외 원가 하락",
      detail: `해외 비교가격이 ${Math.abs(input.origin.change.changeRatePercent)}% 하락했습니다. 현재 원가 기준 마진을 다시 확인해보세요.`,
    });
  }

  // STEP H-2-4 — 국내+해외 결합 판단(둘 다 실제 변화 데이터가 있을 때만,
  // 대표님이 예시로 준 3개 조합만 판정한다 — 그 외 조합은 지어내지 않는다).
  const domesticDir: TrendDirection | null =
    domesticTrend && domesticTrend.trend !== "NEW"
      ? domesticTrend.trend === "UNCHANGED"
        ? "SAME"
        : domesticTrend.trend
      : null;
  if (origin && domesticDir) {
    if (origin === "DOWN" && domesticDir !== "DOWN" && input.priceLevel === "GREEN") {
      signals.push({
        icon: "🟢",
        title: "가격 유지 권장",
        detail: "해외 원가는 하락했고 국내 가격은 안정적입니다. 현재 판매가 경쟁력이 양호합니다.",
      });
    } else if (origin === "UP" && domesticDir === "DOWN") {
      signals.push({
        icon: "🔴",
        title: "가격 전략 재검토",
        detail: "해외 원가와 국내 경쟁가격이 모두 불리하게 움직이고 있습니다. 현재 판매가와 예상 마진을 함께 확인하세요.",
      });
    } else if (origin === "UP" && domesticDir === "UP") {
      signals.push({
        icon: "⚠️",
        title: "시장 가격 변동",
        detail: "원가와 국내 시장가격이 함께 상승했습니다. 판매가/마진을 확인해보세요.",
      });
    }
  }

  // STEP H-2-6 — 추천 이유(실제 값이 있는 항목만).
  const reasons: string[] = [];
  if (input.domestic.sellerCount > 0) reasons.push(`국내 동일상품 ${input.domestic.sellerCount}곳 확인`);
  if (input.domestic.lowestPriceKrw != null) reasons.push(`국내 최저가 ₩${input.domestic.lowestPriceKrw.toLocaleString()}`);
  if (input.currentSellingPriceKrw != null) reasons.push(`내 판매가 ₩${input.currentSellingPriceKrw.toLocaleString()}`);
  if (input.domestic.priceGapVsLowestPercent != null) {
    const gap = input.domestic.priceGapVsLowestPercent;
    reasons.push(`최저가 대비 ${gap > 0 ? "+" : ""}${gap}%`);
  }
  if (domesticTrend?.trend === "DOWN") reasons.push("최근 가격 하락 확인");
  if (domesticTrend?.trend === "UP") reasons.push("최근 가격 상승 확인");

  return {
    status,
    icon: STATUS_ICON[status],
    title: STATUS_TITLE[status],
    signals,
    reasons,
  };
}
