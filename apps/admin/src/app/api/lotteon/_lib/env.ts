import { loadLotteOnAccountRow } from "./account";

/**
 * LOTTEON COMMERCE SPRINT 2 Phase 1 — 롯데ON 자격증명 조회.
 *
 * Naver getNaverCredentials()와 같은 "DB 우선 → env 폴백" 패턴이다. 값 자체는
 * 절대 로그/응답에 넣지 않는다(CEO 지시). 하드코딩 금지 — 이 파일에 키 리터럴이
 * 들어가는 순간 저장소에 커밋된다.
 *
 * 조사 §4-2 실측 — 이 시스템 어디에도(env/Vercel/DB) 롯데ON 인증키가 없다.
 * 그래서 이 함수는 현재 항상 null을 돌려주고, 호출부는 전부 NOT_CONFIGURED로
 * 정직하게 끝난다. CEO가 설정 화면에서 직접 입력해야 그 다음이 시작된다.
 */
export interface LotteOnCredentials {
  apiKey: string;
}

export async function getLotteOnCredentials(): Promise<LotteOnCredentials | null> {
  const row = await loadLotteOnAccountRow();
  const apiKey = row?.secret_key || process.env.LOTTEON_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}
