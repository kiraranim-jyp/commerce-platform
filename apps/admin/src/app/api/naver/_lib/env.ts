/**
 * Sprint N-1.0 — 이번 스프린트는 인증/연결 검증 기반만 구축한다(CPO 지시로 DB
 * schema 변경 금지). Coupang(coupang_seller_settings)과 달리 Supabase 저장소
 * 없이 환경변수만 읽는다 — 나중에 Settings UI에서 값을 관리해야 하면 그때
 * Coupang의 env.ts 패턴(Supabase 우선 + env 폴백)을 그대로 가져오면 된다.
 *
 * SMARTSTORE_SELLER_ID는 공식 문서 조사 결과(3개 독립 출처 교차검증) 토큰 발급
 * 요청에 필요한 파라미터가 아니다 — type=SELF는 API Center에서 연결한 단일
 * 스토어 자체를 가리키므로 seller_id를 별도로 넘기지 않는다. 이 값은 읽어서
 * 보고만 하고, 실제 API 요청에는 사용하지 않는다(CPO 지시: "확인되지 않은 상태에서
 * seller ID를 API request에 임의로 넣지 않는다").
 */
export interface NaverCredentials {
  clientId: string;
  clientSecret: string;
}

export function getNaverCredentials(): NaverCredentials | null {
  const clientId = process.env.SMARTSTORE_CLIENT_ID;
  const clientSecret = process.env.SMARTSTORE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** 참고용으로만 노출 — 위 설명대로 API 요청 파라미터에는 쓰지 않는다. */
export function getNaverSellerIdForDisplay(): string | null {
  return process.env.SMARTSTORE_SELLER_ID || null;
}
