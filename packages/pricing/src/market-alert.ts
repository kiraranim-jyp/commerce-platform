import type { SellerActionResult } from "./seller-action";

/**
 * N-4.18-K STEP K-1(대표님 지시, 2026-08-26: "코드 작성 전에 실제 Production
 * 데이터 분포를 조사하세요") — production price_observations(122건, 2026-08-26
 * 시점)을 직접 조회해 실측했다. 결과: 같은 snapshot_id+source+URL 조합에서
 * 연속 관측치 간 가격이 달라진 사례가 0건이었다(Daily Watch가 이제 막
 * 시작돼 반복 관측 표본 자체가 아직 없음 — SELLER_ORIGIN 112건/62 snapshot,
 * DOMESTIC_SHOP 10건/3 snapshot). 품절 상태 전환도 0건.
 *
 * 즉 "데이터 분포에서 threshold를 통계적으로 도출"하는 것 자체가 지금은
 * 불가능하다(표본이 없음). 대표님이 예시로 주신 값(3% 또는 ₩5,000)을
 * 잠정치로 채택한다 — 이 값을 데이터로 확정된 것처럼 취급하지 않는다.
 * Daily Watch가 수 주 더 쌓여 실제 반복 관측치가 생기면 그때 재조사해서
 * 조정해야 한다(이 상수를 그 시점에 다시 보는 것이 이 파일의 할 일로
 * 남는다).
 */
export const PROVISIONAL_CHANGE_RATE_THRESHOLD_PERCENT = 3;
export const PROVISIONAL_CHANGE_AMOUNT_THRESHOLD_KRW = 5000;

export interface ChangeMagnitude {
  amountKrw: number | null;
  ratePercent: number | null;
}

/** 변화율 3% 이상 또는 변화금액 ₩5,000 이상이면 "유효한 변화"로 본다(둘 중
 * 하나만 만족해도 됨 — 대표님 지시 "둘 중 하나를 만족할 때만"). */
export function isValidChange(change: ChangeMagnitude | null): boolean {
  if (!change) return false;
  const amountValid = change.amountKrw != null && Math.abs(change.amountKrw) >= PROVISIONAL_CHANGE_AMOUNT_THRESHOLD_KRW;
  const rateValid = change.ratePercent != null && Math.abs(change.ratePercent) >= PROVISIONAL_CHANGE_RATE_THRESHOLD_PERCENT;
  return amountValid || rateValid;
}

export type AlertSeverity = "ACTION_REQUIRED" | "REVIEW" | "INFO";
export type AlertCategory = "PRICE_GAP" | "OPPORTUNITY" | "ORIGIN_TREND";

export interface MarketAlert {
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  detail: string;
}

export interface MarketAlertInput {
  sellerAction: SellerActionResult;
  /** 국내 가격(최저가 기준) 변화 — domesticShopTrend7d.current/previous로 계산. */
  domesticChange: ChangeMagnitude | null;
  /** 해외 원가 변화 — computePriceChange(SELLER_ORIGIN) 결과. */
  originChange: ChangeMagnitude | null;
}

/**
 * N-4.18-K STEP K-2/K-3, N-4.18-L STEP L-6(대표님 지시: "Seller Action과
 * Alert가 서로 모순되면 안 된다") — H-2/J에서 이미 계산한 sellerAction
 * (status/opportunity/reasons)을 그대로 재사용해서 재분류한다. 여기서 새
 * 가격 판정을 하지 않는다.
 *
 * L-6 실측(2026-08-26)에서 발견한 버그: 원래 구현은 PRICE_REVIEW일 때만
 * domesticChange(7일 추세, 관측 2건 필요)의 K-1 threshold 통과를 요구했다
 * — 그런데 K-1 실측에서 이미 확인했듯 이 시점엔 7일 추세 자체가 존재하는
 * 경우가 거의 없어(관측이 아직 한 번씩만 있음) REVIEW 알림이 사실상 전혀
 * 생성되지 않았다(실제 상품 5개로 재현 확인). 반면 PRICE_ADJUST는 조건
 * 없이 바로 발생해 같은 sellerAction 매트릭스 안에서 일관성이 깨져 있었다.
 * 대표님이 주신 L-6 매트릭스(PRICE_KEEP→INFO 또는 없음 / PRICE_REVIEW→
 * REVIEW / PRICE_ADJUST→ACTION_REQUIRED / INSUFFICIENT_DATA→없음) 그대로
 * status 하나로만 판정하도록 단순화한다 — "같은 상태 반복 시 알림 안 만듦"은
 * severity 판정이 아니라 price_alerts의 partial unique index(K-4)가 이미
 * DB 레벨에서 보장하므로, 여기서 또 막을 필요가 없다(오히려 막으면 이번에
 * 발견한 버그처럼 정당한 알림까지 사라진다).
 *
 * 우선순위:
 * 1) 🔴 ACTION_REQUIRED — status PRICE_ADJUST, 또는 opportunity(J의 "기회"
 *    신호) 존재.
 * 2) 🟡 REVIEW — status PRICE_REVIEW.
 * 3) 🔵 INFO — status가 PRICE_KEEP/INSUFFICIENT_DATA이지만 해외 원가만
 *    유효하게(K-1 threshold) 변했을 때(참고 정보 — 급하지 않음).
 * 4) 그 외(PRICE_KEEP/INSUFFICIENT_DATA + 변화 없음)는 null — "변화 없음 →
 *    Alert 생성 안 됨"(K-8/L-2 필수 검증 항목).
 */
export function computeMarketAlert(input: MarketAlertInput): MarketAlert | null {
  const { sellerAction } = input;

  if (sellerAction.status === "PRICE_ADJUST") {
    return {
      severity: "ACTION_REQUIRED",
      category: "PRICE_GAP",
      title: sellerAction.title,
      detail: sellerAction.reasons.join(" · ") || sellerAction.signals[0]?.detail || sellerAction.title,
    };
  }

  if (sellerAction.opportunity) {
    return {
      severity: "ACTION_REQUIRED",
      category: "OPPORTUNITY",
      title: sellerAction.opportunity.title,
      detail: sellerAction.opportunity.detail,
    };
  }

  if (sellerAction.status === "PRICE_REVIEW") {
    return {
      severity: "REVIEW",
      category: "PRICE_GAP",
      title: sellerAction.title,
      detail: sellerAction.reasons.join(" · ") || sellerAction.signals[0]?.detail || sellerAction.title,
    };
  }

  if (isValidChange(input.originChange)) {
    const rate = input.originChange!.ratePercent;
    const dir = rate != null && rate > 0 ? "상승" : "하락";
    return {
      severity: "INFO",
      category: "ORIGIN_TREND",
      title: "해외 원가 변화",
      detail: rate != null ? `해외 원가가 ${Math.abs(rate)}% ${dir}했습니다.` : "해외 원가가 변경되었습니다.",
    };
  }

  return null;
}
