/**
 * N-4.01 Part G(대표님 지시) — 네이버 쇼핑 검색(오픈API) 전용 자격증명.
 * SmartStore 등록에 쓰는 SMARTSTORE_CLIENT_ID/SECRET(@/api/naver/_lib/env.ts)과
 * 는 별개의 네이버 개발자센터 애플리케이션이 필요하다 — 절대 재사용하지
 * 않는다(서로 다른 API 상품, naver-shopping-search.ts 주석 참고). 지금은
 * DB 저장 없이 env var만 읽는다(이번 스프린트에서 새로 붙이는 통합이라
 * Settings UI까지는 범위 밖 — PART Q "API Key만 넣으면 연결되는 구조"는
 * 이 함수 하나로 이미 충족된다, 코드에 하드코딩된 값 없음).
 */
import type { NaverSearchCredentials } from "@commerce/pricing";

export function getNaverSearchCredentials(): NaverSearchCredentials | null {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
