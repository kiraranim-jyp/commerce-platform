import { FIXED_RATES_TO_KRW } from "@commerce/pricing";

/**
 * Sprint N-3.2 — /api/exchange-rates 라우트에 있던 로직을 함수로 분리한다.
 * 가격 Intelligence(가격 비교 API)도 같은 환율표가 필요한데, Next.js 라우트
 * 핸들러를 서버에서 다시 HTTP로 호출하는 건 불필요한 지연/실패 지점을
 * 추가하는 것이라 로직 자체를 공유 함수로 뽑아 두 라우트가 그대로 재사용한다.
 */
const TRACKED_CURRENCIES = ["USD", "EUR", "JPY", "GBP", "SEK", "CNY", "HKD"];

export interface ExchangeRates {
  rates: Record<string, number>;
  fetchedAt: string;
  source: "frankfurter" | "fallback";
}

/** P0(환율 시스템) — Frankfurter(ECB 데이터, 무료, 키 불필요)에서 "1 KRW = ? 통화"
 * 형태로 받아서 역수를 취해 "1 통화 = ? KRW"로 바꾼다. API가 실패하면(네트워크
 * 문제, ECB 휴무일 등) packages/pricing의 고정 환율표로 조용히 폴백한다. */
export async function fetchLiveExchangeRates(): Promise<ExchangeRates> {
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=KRW&symbols=${TRACKED_CURRENCIES.join(",")}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
    const data = (await res.json()) as { date: string; rates: Record<string, number> };
    const rates: Record<string, number> = { KRW: 1 };
    for (const [code, krwToCurrency] of Object.entries(data.rates)) {
      if (krwToCurrency > 0) rates[code] = 1 / krwToCurrency;
    }
    return { rates, fetchedAt: `${data.date}T00:00:00Z`, source: "frankfurter" };
  } catch (error) {
    console.warn("[exchange-rates] Frankfurter 조회 실패, 고정 환율표로 폴백:", error);
    return { rates: FIXED_RATES_TO_KRW, fetchedAt: new Date().toISOString(), source: "fallback" };
  }
}
