import { NextResponse } from "next/server";
import { fetchLiveExchangeRates, type ExchangeRates } from "../../../lib/exchange-rates";

export type ExchangeRatesResponse = ExchangeRates;

/** P0(환율 시스템) — 실제 fetch 로직은 lib/exchange-rates.ts로 옮겼다(N-3.2 —
 * 가격 Intelligence 라우트도 같은 로직이 필요해서 공유 함수로 뽑음). 이 라우트는
 * 얇은 HTTP 래퍼로만 남는다. */
export async function GET() {
  const body = await fetchLiveExchangeRates();
  return NextResponse.json(body);
}
