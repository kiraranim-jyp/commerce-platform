/**
 * N-4.03 Part 6(대표님 지시) — 알림 UI는 아직 안 만들지만 API는 신호를
 * 미리 계산해서 돌려준다. 순수 함수 — 국내 가격/마진 변화율을 입력받아
 * 다섯 가지 신호 중 하나로 분류한다. 여러 조건이 동시에 해당하면 마진
 * 관련 신호를 가격 신호보다 우선한다(마진 위험이 실제로 더 급한 문제).
 */
export type PriceAlertSignal = "PRICE_DROP" | "PRICE_RISE" | "MARGIN_DROP" | "MARGIN_RECOVERED" | "NO_CHANGE";

export interface PriceAlertInput {
  /** 국내 경쟁가격(또는 우리 판매가) 변화율(%). 양수=상승, 음수=하락. */
  priceChangeRatePercent: number | null;
  /** 마진율 변화(퍼센트 포인트, %p). 양수=마진 개선, 음수=마진 악화. */
  marginChangePercentPoints: number | null;
  priceThresholdPercent?: number;
  marginThresholdPercentPoints?: number;
}

const DEFAULT_PRICE_THRESHOLD = 10;
const DEFAULT_MARGIN_THRESHOLD = 5;

export function computePriceAlertSignal(input: PriceAlertInput): PriceAlertSignal {
  const {
    priceChangeRatePercent,
    marginChangePercentPoints,
    priceThresholdPercent = DEFAULT_PRICE_THRESHOLD,
    marginThresholdPercentPoints = DEFAULT_MARGIN_THRESHOLD,
  } = input;

  if (marginChangePercentPoints != null && marginChangePercentPoints <= -marginThresholdPercentPoints) {
    return "MARGIN_DROP";
  }
  if (marginChangePercentPoints != null && marginChangePercentPoints >= marginThresholdPercentPoints) {
    return "MARGIN_RECOVERED";
  }
  if (priceChangeRatePercent != null && priceChangeRatePercent <= -priceThresholdPercent) {
    return "PRICE_DROP";
  }
  if (priceChangeRatePercent != null && priceChangeRatePercent >= priceThresholdPercent) {
    return "PRICE_RISE";
  }
  return "NO_CHANGE";
}
