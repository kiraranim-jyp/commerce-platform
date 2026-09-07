/** P-4-DATA-7(CPO 지시, 2026-08-29) — 가격 비교(comparison-search) UI가 "이 숫자를
 * 보여줘도 되는가"/"이 환율을 어떻게 계산했는가"를 판단하는 로직을 컴포넌트(JSX)
 * 안에 묻어두지 않고 여기로 뽑았다. 이유: P-4-DATA-4~6에서 반복된 사고(검증 안 된
 * 가격이 화면에 노출됨, Shopify locale 가격이 우리 환율과 섞임)는 전부 "판단 로직이
 * 컴포넌트 렌더링 코드 속에 흩어져 있어 회귀 테스트로 못 잡음"이 근본 원인이었다.
 * 이 파일의 함수들을 ComparisonShopSearch.tsx가 그대로 가져다 쓰므로, 여기 테스트가
 * 통과하면 실제 화면 동작도 같은 규칙을 따른다는 게 보장된다(로직 중복 없음). */

export type PriceStatus = "VERIFIED_CURRENT" | "UNVERIFIED_SEARCH" | "PRICE_UNAVAILABLE";

/** P-4-DATA-7 불변조건 1 — VERIFIED_CURRENT 가격만 숫자 표시 가능. priceStatus가
 * undefined인 구버전 데이터(마이그레이션 이전 스냅샷 등)는 안전 측(숨김)으로 처리한다. */
export function isPriceDisplayable(priceStatus: PriceStatus | undefined, price: unknown): boolean {
  return priceStatus === "VERIFIED_CURRENT" && price != null;
}

/** P-4-DATA-7 불변조건 3/4 — KRW 참고환산은 이 함수 하나만 거친다(단일 FX 소스).
 * krwRates에 해당 통화 환율이 없으면(조회 실패) null — 추측 환율을 만들지 않는다. */
export function computeKrwAmount(amount: number, currency: string, krwRates: Record<string, number> | null): number | null {
  const rate = krwRates?.[currency];
  return rate ? Math.round(amount * rate) : null;
}

/** P-4-DATA-6 P0-3 — "약 ₩64,820"이라는 숫자만 보여주면 어떤 환율을 썼는지 셀러가
 * 알 수 없다(F5의 근본 원인). 항상 "기준 환율 1 GBP = ₩1,852" 형태로 병기한다.
 * 환율이 없으면(조회 실패) null — computeKrwAmount와 동일하게 숨긴다. */
export function computeFxLine(
  currency: string,
  krwRates: Record<string, number> | null,
  fxSource: "frankfurter" | "fallback" | null,
): string | null {
  const rate = krwRates?.[currency];
  if (!rate) return null;
  const fallbackNote = fxSource === "fallback" ? " (실시간 조회 실패 — 고정 참고환율)" : "";
  return `기준 환율 1 ${currency} = ₩${Math.round(rate).toLocaleString("ko-KR")}${fallbackNote}`;
}

/** N-4.18-Q2 P0-4 원칙 재사용 — 정가(regularPrice)는 실제로 판매가보다 클 때만
 * "할인 중"으로 판단한다. 정가가 없거나(null) 판매가 이하면 할인 아님. */
export function isOnSale(price: { amount: number } | null | undefined, regularPrice: { amount: number } | null | undefined): boolean {
  return !!(regularPrice && price && regularPrice.amount > price.amount);
}

/** MI-UX-9(CPO 지시, 2026-09-07 §3/§4) — 화면에 `177900.00 KRW`가 그대로 나오던
 * 문제를 한 곳에서 막는다.
 *
 * 원인은 표시 코드가 `amount.toFixed(2) + " " + currency`를 직접 쓴 것이었다.
 * 이 식은 통화별 소수 자릿수를 구분하지 않아 최소 단위가 1원인 KRW에도 `.00`을
 * 붙이고, 천단위 구분이 없어 자릿수를 눈으로 셀 수 없었다. GBP/EUR에서는 소수
 * 두 자리가 맞으므로 `toFixed(2)` 자체가 틀린 게 아니라 "통화를 보지 않는 것"이
 * 틀렸다 — 그래서 통화별 분기를 이 함수 하나로 모은다.
 *
 * 계산에 쓰는 raw number는 건드리지 않는다. 이 함수는 표시 문자열만 만든다.
 *
 * 심볼을 모르는 통화는 심볼을 지어내지 않고 `1,234.00 SEK`처럼 코드를 뒤에
 * 붙인다 — 모르는 것을 아는 척하지 않는다는 이 파일의 기존 원칙과 같다. */
const CURRENCY_SYMBOL: Record<string, string> = {
  KRW: "₩",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

/** 최소 단위가 1인 통화 — 소수점을 붙이면 안 된다(`₩177,900.00` 같은 표기 금지). */
const ZERO_DECIMAL_CURRENCIES = new Set(["KRW", "JPY"]);

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  // 값이 없거나 숫자가 아니면 0으로 떨어뜨리지 않는다 — "0원"과 "미확인"은 다르다.
  if (amount == null || !Number.isFinite(amount)) return "—";
  const code = (currency ?? "").toUpperCase();
  const digits = ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
  const body = amount.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const symbol = CURRENCY_SYMBOL[code];
  if (symbol) return `${symbol}${body}`;
  // 통화 코드조차 없으면 숫자만 — `1,234 UNDEFINED`를 만들지 않는다.
  return code ? `${body} ${code}` : body;
}
