import { NextResponse } from "next/server";
import { FIXED_RATES_TO_KRW } from "@commerce/pricing";

/** 캐싱할 통화 — 지금 크롤러가 실제로 만나는 통화 + CPO가 요청한 CNY/HKD.
 * KRW는 API에 안 물어봐도 항상 1이라 별도로 채운다. */
const TRACKED_CURRENCIES = ["USD", "EUR", "JPY", "GBP", "SEK", "CNY", "HKD"];

export interface ExchangeRatesResponse {
  rates: Record<string, number>;
  fetchedAt: string;
  source: "frankfurter" | "fallback";
}

/** P0(환율 시스템) — Frankfurter(ECB 데이터, 무료, 키 불필요)에서 "1 KRW = ? 통화"
 * 형태로 받아서 역수를 취해 "1 통화 = ? KRW"로 바꾼다. Vercel의 fetch 캐시를
 * 하루(86400초) 단위로 걸어서 "매일 1회 업데이트"를 별도 크론 없이 구현한다 —
 * 실시간일 필요가 없다고 CPO가 명시했다. API가 실패하면(네트워크 문제, ECB
 * 휴무일 등) packages/pricing의 고정 환율표로 조용히 폴백한다 — 환율 화면이
 * 하나 죽었다고 가격 계산 전체가 멈추면 안 된다. */
export async function GET() {
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
    const body: ExchangeRatesResponse = { rates, fetchedAt: `${data.date}T00:00:00Z`, source: "frankfurter" };
    return NextResponse.json(body);
  } catch (error) {
    console.warn("[exchange-rates] Frankfurter 조회 실패, 고정 환율표로 폴백:", error);
    const body: ExchangeRatesResponse = {
      rates: FIXED_RATES_TO_KRW,
      fetchedAt: new Date().toISOString(),
      source: "fallback",
    };
    return NextResponse.json(body);
  }
}
