-- registration_attempts(003)에 실제 등록 성공/실패 시 payload/response를 함께
-- 저장한다 — 등록 이력 화면에서 "그때 뭘 보냈고 쿠팡이 뭐라고 답했는지"를 바로
-- 확인하기 위함이다(회귀 테스트용 참고 데이터로도 쓴다). CoupangPayload에는
-- Access/Secret Key 같은 민감정보가 애초에 안 들어있다(HMAC 서명은 요청 헤더에서만
-- 만들어지고 payload 자체에는 없음) — 그대로 저장해도 안전하다.
alter table registration_attempts add column if not exists product_name text;
alter table registration_attempts add column if not exists external_product_id text;
alter table registration_attempts add column if not exists payload jsonb;
alter table registration_attempts add column if not exists response jsonb;
