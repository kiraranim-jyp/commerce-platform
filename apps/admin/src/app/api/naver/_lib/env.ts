/**
 * Sprint N-1.0 — 이번 스프린트는 인증/연결 검증 기반만 구축한다(CPO 지시로 DB
 * schema 변경 금지). Coupang(coupang_seller_settings)과 달리 Supabase 저장소
 * 없이 환경변수만 읽었다.
 *
 * N-3.42 STEP5(CPO 지시, B안 채택) — 위 계획대로 이제 Coupang env.ts 패턴
 * (Supabase 우선 + env 폴백)을 가져온다. 단, 새 테이블을 만들지 않고 N-3.13
 * R2에서 이미 만들어졌지만 실제 자격증명 조회에 연결된 적 없던
 * commerce_accounts(platform='naver')를 account.ts에서 싱글톤으로 조회해 쓴다.
 *
 * SMARTSTORE_SELLER_ID는 공식 문서 조사 결과(3개 독립 출처 교차검증) 토큰 발급
 * 요청에 필요한 파라미터가 아니다 — type=SELF는 API Center에서 연결한 단일
 * 스토어 자체를 가리키므로 seller_id를 별도로 넘기지 않는다. 이 값은 읽어서
 * 보고만 하고, 실제 API 요청에는 사용하지 않는다(CPO 지시: "확인되지 않은 상태에서
 * seller ID를 API request에 임의로 넣지 않는다").
 */
import { loadNaverAccountRow } from "./account";

export interface NaverCredentials {
  clientId: string;
  clientSecret: string;
}

export async function getNaverCredentials(): Promise<NaverCredentials | null> {
  const row = await loadNaverAccountRow();
  const clientId = row?.client_id || process.env.SMARTSTORE_CLIENT_ID;
  const clientSecret = row?.client_secret || process.env.SMARTSTORE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** 참고용으로만 노출 — 위 설명대로 API 요청 파라미터에는 쓰지 않는다.
 * Sprint C-8(CPO 지시) — DB(commerce_accounts.seller_id, Settings에서 입력)를
 * 우선 읽고, 없으면 기존 env var로 폴백한다("표시용"이라는 기존 계약은 그대로
 * 유지 — getNaverCredentials처럼 DB 우선 + env 폴백 패턴만 가져온다). */
export async function getNaverSellerIdForDisplay(): Promise<string | null> {
  const row = await loadNaverAccountRow();
  return row?.seller_id || process.env.SMARTSTORE_SELLER_ID || null;
}
