import { FIXED_RATES_TO_KRW } from "@commerce/pricing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Sprint N-3.2 — /api/exchange-rates 라우트에 있던 로직을 함수로 분리한다.
 * 가격 Intelligence(가격 비교 API)도 같은 환율표가 필요한데, Next.js 라우트
 * 핸들러를 서버에서 다시 HTTP로 호출하는 건 불필요한 지연/실패 지점을
 * 추가하는 것이라 로직 자체를 공유 함수로 뽑아 두 라우트가 그대로 재사용한다.
 *
 * PRICE-ACCURACY-REGRESSION-1.1(CPO 결정, 2026-09-11) — 두 가지를 고쳤다.
 *
 * ① 폴백 순서. 예전에는 Frankfurter가 한 번 실패하면 곧바로 코드에 박힌 고정
 *    환율표로 떨어졌는데, 그 표는 오늘 기준 실제와 최대 6.7% 어긋나 있었다
 *    (SEK 130 vs 139.4, EUR 1480 vs 1561). 이제 DB에 마지막 정상 환율을
 *    남겨두고 그걸 먼저 쓴다 — 고정표는 "한 번도 성공한 적 없는" 극단적인
 *    경우에만 닿는 비상용으로 밀려난다.
 *
 * ② 정밀도. 예전에는 `base=KRW`로 받아 역수를 취했는데, 응답이 소수점 5자리에서
 *    잘려 고액 통화의 유효숫자가 무너졌다(실측: CHF가 `0.0006` — 유효숫자 1자리라
 *    역수를 취하면 1,666원, 실제와 1% 넘게 차이난다). 이제 `base=EUR`로 받아
 *    EUR 대비 비율로 환산한다 — 모든 값이 1 근처라 잘림 손실이 사실상 없다.
 */
const TRACKED_CURRENCIES = [
  // 현재 실제로 들어오는 통화.
  "USD",
  "EUR",
  "JPY",
  "GBP",
  "SEK",
  "CNY",
  "HKD",
  // CPO 결정(2026-09-11) — 유입 예상 통화를 미리 넓힌다. 지원 여부는 실측으로
  // 확인했다(Frankfurter /v1/currencies에 5종 모두 존재). 통화를 늘리는 비용은
  // 0이다(같은 요청의 symbols에 붙을 뿐) — 반대로 빠져 있으면 그 통화 상품은
  // 원화 환산이 통째로 "확인 불가"가 된다.
  "DKK",
  "NOK",
  "CHF",
  "AUD",
  "CAD",
];

export interface ExchangeRates {
  rates: Record<string, number>;
  fetchedAt: string;
  source: "frankfurter" | "last_known" | "fallback";
}

/** 마지막 정상 환율을 통화당 한 행으로 덮어쓴다. 이력을 쌓지 않는 이유는
 * 045 마이그레이션 주석 참고 — 끝난 분석을 나중 환율로 재계산하면 안 된다. */
async function saveLastKnownRates(rates: Record<string, number>, fetchedAt: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const rows = Object.entries(rates)
    .filter(([code, rate]) => code !== "KRW" && Number.isFinite(rate) && rate > 0)
    .map(([currency, rate]) => ({ currency, rate, source: "frankfurter", fetched_at: fetchedAt, updated_at: new Date().toISOString() }));
  if (rows.length === 0) return;
  const { error } = await admin.from("exchange_rates").upsert(rows, { onConflict: "currency" });
  // 저장 실패가 환율 조회 자체를 실패시키면 안 된다 — 이번 요청은 방금 받은
  // 정상 환율을 그대로 쓰고, 다음 갱신 때 다시 시도한다.
  if (error) console.warn("[exchange-rates] 마지막 정상 환율 저장 실패:", error.message);
}

async function readLastKnownRates(): Promise<ExchangeRates | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.from("exchange_rates").select("currency, rate, fetched_at");
  if (error || !data || data.length === 0) return null;
  const rates: Record<string, number> = { KRW: 1 };
  let newest = "";
  for (const row of data as Array<{ currency: string; rate: number | string; fetched_at: string }>) {
    const rate = typeof row.rate === "string" ? Number(row.rate) : row.rate;
    if (Number.isFinite(rate) && rate > 0) rates[row.currency] = rate;
    if (row.fetched_at > newest) newest = row.fetched_at;
  }
  if (Object.keys(rates).length <= 1) return null;
  return { rates, fetchedAt: newest, source: "last_known" };
}

/** Frankfurter(ECB 데이터, 무료, 키 불필요)에서 "1 통화 = ? KRW" 표를 만든다.
 *
 * ECB는 하루 1회(평일 16:00 CET)만 고시한다 — 실측으로 확인했다(09-11에 요청해도
 * 응답의 date는 09-10). 그래서 이 함수는 "실시간 환율"이 아니라 "마지막으로
 * 고시된 환율"을 돌려주며, 호출부는 fetchedAt을 반드시 함께 보여줘야 한다. */
export async function fetchLiveExchangeRates(): Promise<ExchangeRates> {
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=EUR&symbols=KRW,${TRACKED_CURRENCIES.filter((c) => c !== "EUR").join(",")}`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
    const data = (await res.json()) as { date: string; rates: Record<string, number> };
    const krwPerEur = data.rates.KRW;
    if (!krwPerEur || krwPerEur <= 0) throw new Error("KRW 환율 없음");

    // 1 X = (KRW/EUR) / (X/EUR) 원. 모든 피제수·제수가 1 근처라 응답 잘림에
    // 따른 손실이 사실상 없다(base=KRW로 받아 역수를 취하던 예전 방식과의 차이).
    const rates: Record<string, number> = { KRW: 1, EUR: krwPerEur };
    for (const [code, perEur] of Object.entries(data.rates)) {
      if (code === "KRW") continue;
      if (perEur > 0) rates[code] = krwPerEur / perEur;
    }
    const fetchedAt = `${data.date}T00:00:00Z`;
    await saveLastKnownRates(rates, fetchedAt);
    return { rates, fetchedAt, source: "frankfurter" };
  } catch (error) {
    console.warn("[exchange-rates] Frankfurter 조회 실패:", error);
    // CPO 결정 — 오래된 고정 환율을 기본 폴백으로 쓰지 않는다. 마지막 정상
    // 환율이 있으면 그걸 쓰고, 화면에는 source/fetchedAt으로 그 사실을 밝힌다.
    const lastKnown = await readLastKnownRates();
    if (lastKnown) return lastKnown;
    // 여기까지 왔다는 건 한 번도 성공한 적이 없다는 뜻이다(신규 배포 + API 장애).
    // 고정표는 이 경우에만 닿는 비상용이며, source="fallback"으로 구분된다.
    console.warn("[exchange-rates] 마지막 정상 환율도 없음 — 비상 고정표 사용");
    return { rates: FIXED_RATES_TO_KRW, fetchedAt: new Date().toISOString(), source: "fallback" };
  }
}
