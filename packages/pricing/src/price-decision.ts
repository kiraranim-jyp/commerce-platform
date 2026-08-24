/**
 * N-4.01 Part J(대표님 지시) — 가격 판단 엔진. 단순 가격 "표시"에서 끝내지
 * 않고, 원가/현재 판매가/국내 시장가를 종합해 🟢유지 · 🟡조정검토 · 🔴마진위험
 * 세 상태 중 하나로 판정한다. 순수 함수(외부 호출 없음) — 국내 시장가가 아직
 * 없으면(domesticAveragePriceKrw=null) 경쟁력 비교 없이 마진만으로 판단한다
 * (있지도 않은 국내 시세를 지어내지 않는다, PART G 미연결 상태에서도 안전).
 */
export type PriceDecisionVerdict = "MAINTAIN" | "CONSIDER_LOWER" | "MARGIN_RISK";

export interface PriceDecisionInput {
  costPriceKrw: number;
  currentSellingPriceKrw: number;
  domesticAveragePriceKrw: number | null;
  domesticLowestPriceKrw: number | null;
  /** 마진율이 이 값(%) 미만이면 무조건 MARGIN_RISK(경쟁력과 무관) — 기본 10%. */
  marginFloorPercent?: number;
  /** 국내 평균가보다 이 비율(%) 이상 비싸면 CONSIDER_LOWER 후보 — 기본 10%. */
  competitiveGapPercent?: number;
}

export interface PriceDecisionResult {
  verdict: PriceDecisionVerdict;
  marginPercent: number;
  /** 국내 평균가 대비 현재 판매가 차이(%). 양수=더 비쌈. 국내 시세 없으면 null. */
  priceGapVsAveragePercent: number | null;
  reason: string;
}

const DEFAULT_MARGIN_FLOOR_PERCENT = 10;
// PART J 예시(현재 239,000 vs 국내 평균 219,000, gap ≈9.1%)가 🟡로 분류되므로
// 기본 threshold를 그 값보다 낮게 잡는다 — 10%로 두면 그 예시조차 MAINTAIN이
// 되어 대표님이 준 기준과 어긋난다.
const DEFAULT_COMPETITIVE_GAP_PERCENT = 5;

export function computePriceDecision(input: PriceDecisionInput): PriceDecisionResult {
  const {
    costPriceKrw,
    currentSellingPriceKrw,
    domesticAveragePriceKrw,
    domesticLowestPriceKrw,
    marginFloorPercent = DEFAULT_MARGIN_FLOOR_PERCENT,
    competitiveGapPercent = DEFAULT_COMPETITIVE_GAP_PERCENT,
  } = input;

  const marginPercent =
    currentSellingPriceKrw > 0
      ? Number((((currentSellingPriceKrw - costPriceKrw) / currentSellingPriceKrw) * 100).toFixed(1))
      : 0;

  const priceGapVsAveragePercent =
    domesticAveragePriceKrw && domesticAveragePriceKrw > 0
      ? Number((((currentSellingPriceKrw - domesticAveragePriceKrw) / domesticAveragePriceKrw) * 100).toFixed(1))
      : null;

  // 마진 자체가 바닥 미만이면 경쟁력과 무관하게 무조건 위험 — 국내 시세가
  // 아무리 낮아도 손해를 보면서 유지/인하를 권할 수 없다.
  if (marginPercent < marginFloorPercent) {
    return {
      verdict: "MARGIN_RISK",
      marginPercent,
      priceGapVsAveragePercent,
      reason:
        marginPercent < 0
          ? `현재 판매가(₩${currentSellingPriceKrw.toLocaleString()})가 원가(₩${costPriceKrw.toLocaleString()})보다 낮습니다 — 판매할수록 손해입니다.`
          : `예상 마진 ${marginPercent}%가 최소 기준(${marginFloorPercent}%) 미만입니다 — 가격 인하 금지, 판매가 유지 또는 판매 중지를 검토하세요.`,
    };
  }

  // 국내 시세를 아직 모르면(PART G 미연결/조회 실패) 마진만으로 유지 판정한다
  // — 없는 경쟁가격을 만들어내지 않는다.
  if (priceGapVsAveragePercent === null) {
    return {
      verdict: "MAINTAIN",
      marginPercent,
      priceGapVsAveragePercent: null,
      reason: `예상 마진 ${marginPercent}%로 기준을 충족합니다(국내 가격 비교 데이터 없음 — 마진 기준으로만 판단).`,
    };
  }

  if (priceGapVsAveragePercent > competitiveGapPercent) {
    return {
      verdict: "CONSIDER_LOWER",
      marginPercent,
      priceGapVsAveragePercent,
      reason: `현재 판매가가 국내 평균(₩${domesticAveragePriceKrw!.toLocaleString()})보다 ${priceGapVsAveragePercent}% 높습니다(마진 ${marginPercent}%는 충분) — 가격 인하를 검토해보세요.${
        domesticLowestPriceKrw != null ? ` 국내 최저가는 ₩${domesticLowestPriceKrw.toLocaleString()}입니다.` : ""
      }`,
    };
  }

  return {
    verdict: "MAINTAIN",
    marginPercent,
    priceGapVsAveragePercent,
    reason: `현재 판매가: ₩${currentSellingPriceKrw.toLocaleString()}, 국내 평균: ₩${domesticAveragePriceKrw!.toLocaleString()}, 예상 마진: ${marginPercent}% — 가격 경쟁력이 있어 유지를 권장합니다.`,
  };
}

/** N-4.07 Sprint(대표님 지시: "전체 등록상태/대시보드에 가격경쟁력을 🟢🟡🔴로,
 * 단 데이터가 없으면 🔴가 아니라 ⚪ 판단불가로") — verdict 3-state에 "아직 계산
 * 못함"을 더한 4번째 값. 서버(대시보드 API)와 클라이언트(패널 UI) 양쪽에서
 * 같은 매핑을 쓰기 위해 packages/pricing에 둔다 — 두 곳에 각자 새로 만들지
 * 않는다. */
export type PriceLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export function priceLevelFromVerdict(verdict: PriceDecisionVerdict | null): PriceLevel {
  if (!verdict) return "UNKNOWN";
  if (verdict === "MAINTAIN") return "GREEN";
  if (verdict === "CONSIDER_LOWER") return "YELLOW";
  return "RED";
}
