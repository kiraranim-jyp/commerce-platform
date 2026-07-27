/**
 * 고정 환율 표 — 실시간 환율 API 연동은 이번 Mission 범위 밖이다(Preview 화면에서
 * "대략 이 정도 가격으로 보일 것"을 보여주는 게 목적이지, 실제 판매가 확정이
 * 아니다). 실거래에 쓸 정확한 환율이 필요해지면 이 함수 하나만 API 호출로
 * 바꾸면 되도록, 호출부는 이 모듈의 함수 시그니처에만 의존하게 설계했다.
 */
const FIXED_RATES_TO_KRW: Record<string, number> = {
  KRW: 1,
  EUR: 1480,
  USD: 1380,
  GBP: 1740,
  SEK: 130,
  JPY: 9.2,
};

export interface KrwPrice {
  amountKrw: number;
  /** 실시간 환율이 아니라 고정 표를 썼다는 걸 화면에서 명시하기 위한 플래그. */
  isEstimate: boolean;
}

/** 알 수 없는 통화는 변환하지 않고 원래 금액을 그대로 KRW로 취급한다(추정치로 표시) —
 * 없는 데이터를 0으로 지워버리는 것보다, 부정확하더라도 값을 보여주고 "추정"이라고
 * 밝히는 쪽이 검수하는 사람에게 더 유용하다. */
export function convertToKrw(amount: number, currency: string): KrwPrice {
  const rate = FIXED_RATES_TO_KRW[currency.toUpperCase()];
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
