/**
 * 고정 환율 표 — 실시간 환율을 못 불러올 때(API 실패, 아직 안 불러온 상태)만
 * 쓰는 폴백이다. 실거래 정확도가 필요한 화면(PriceEditor)은 apps/admin의
 * /api/exchange-rates(외부 API 하루 1회 캐시)에서 받아온 실시간 환율을
 * convertToKrw의 liveRates 인자로 넘긴다 — 이 파일은 그 값이 없을 때만
 * 대비용으로 쓰인다.
 */
export const FIXED_RATES_TO_KRW: Record<string, number> = {
  KRW: 1,
  EUR: 1480,
  USD: 1380,
  GBP: 1740,
  SEK: 130,
  JPY: 9.2,
};

export interface KrwPrice {
  amountKrw: number;
  /** liveRates에 이 통화가 없어서(또는 아예 안 넘겨서) 고정 표를 썼다는 걸
   * 화면에서 명시하기 위한 플래그. */
  isEstimate: boolean;
}

/** 알 수 없는 통화는 변환하지 않고 원래 금액을 그대로 KRW로 취급한다(추정치로 표시) —
 * 없는 데이터를 0으로 지워버리는 것보다, 부정확하더라도 값을 보여주고 "추정"이라고
 * 밝히는 쪽이 검수하는 사람에게 더 유용하다.
 *
 * liveRates(선택): /api/exchange-rates가 돌려준 실시간 환율표(1 통화 = ? KRW).
 * 있고 해당 통화 키가 있으면 그 값을 쓰고 isEstimate=false — 없으면(API
 * 실패 등) FIXED_RATES_TO_KRW로 폴백하고 isEstimate=true. */
export function convertToKrw(amount: number, currency: string, liveRates?: Record<string, number>): KrwPrice {
  const code = currency.toUpperCase();
  const liveRate = liveRates?.[code];
  if (liveRate != null) {
    return { amountKrw: Math.round(amount * liveRate), isEstimate: false };
  }
  const rate = FIXED_RATES_TO_KRW[code];
  if (rate == null) {
    return { amountKrw: Math.round(amount), isEstimate: true };
  }
  return { amountKrw: Math.round(amount * rate), isEstimate: true };
}

export function formatKrw(amountKrw: number): string {
  return `₩${amountKrw.toLocaleString("ko-KR")}`;
}

/** 원본 통화 그대로 사람이 읽기 좋게 포맷("£21.00" 등) — Intl이 모르는 통화 코드가
 * 오면(크롤러가 이상한 값을 넣었을 경우) 통화 기호 없이 숫자만 보여준다. */
export function formatOriginalPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}
