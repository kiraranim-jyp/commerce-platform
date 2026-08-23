/**
 * N-4.02 Part Q(대표님 지시) — 11번가/ESM(G마켓·옥션) credential은 env var로만
 * 읽는다(코드에 실제 값 하드코딩 금지). 지금은 어떤 값도 설정돼 있지 않고,
 * 이 함수들도 아직 어디에서도 호출되지 않는다(SOON 어댑터의 register()는
 * credential 유무와 무관하게 항상 NOT_IMPLEMENTED다) — 대표님이 나중에
 * 실제 값과 공식 API 문서를 확보하면, 이 자리부터 실제 클라이언트를 만든다.
 */
export interface SoonMarketplaceCredentials {
  apiKey: string;
  apiSecret: string;
}

export function getElevenstCredentials(): SoonMarketplaceCredentials | null {
  const apiKey = process.env.ELEVENST_API_KEY;
  const apiSecret = process.env.ELEVENST_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

export function getEsmCredentials(): SoonMarketplaceCredentials | null {
  const apiKey = process.env.ESM_API_KEY;
  const apiSecret = process.env.ESM_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}
