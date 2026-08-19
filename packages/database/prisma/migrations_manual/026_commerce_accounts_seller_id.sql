-- Sprint C-8(CPO 지시) — SmartStore Seller ID 추가. N-3.42 STEP5 조사 결과
-- (apps/admin/src/app/api/naver/_lib/env.ts 주석, 3개 독립 출처 교차검증)
-- Seller ID는 OAuth 토큰 발급 요청 파라미터가 아니다 — API 인증에는 전혀
-- 쓰이지 않는다. 그래서 등록 게이트(missing 체크)에 넣지 않고, 판매자가
-- 참고용으로 저장해두는 "표시/추적용 정보"로만 취급한다.
alter table commerce_accounts add column if not exists seller_id text;
