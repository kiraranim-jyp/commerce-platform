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
