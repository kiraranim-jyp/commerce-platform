-- BETA-SECURITY-2 FINAL §5(CPO 지시, 2026-09-07) — Audit Log의 actor/target 분리.
--
-- 지금까지 audit_log.actor는 사실상 항상 'admin'이었다(단일 관리자 계정).
-- Admin이 사용자 전환(impersonation)으로 다른 사용자 화면에서 작업하게 되면
-- "누가 했는가"와 "누구 데이터에 했는가"가 갈라진다.
--
-- CPO 지시의 핵심:
--   Admin → user3 계정으로 전환 → 상품 삭제
--   actor: admin / target: user3 / action: product_delete
--   "user3이 삭제했다"고만 기록되면 안 된다.
--
-- 그래서 target을 별도 컬럼으로 둔다. actor는 실제 행위자(admin 또는 본인),
-- target은 그 행위가 적용된 사용자다. 일반 사용자가 자기 작업을 한 경우
-- target은 null이다(actor 자신이 곧 대상이라 중복 기록할 이유가 없다).
--
-- 실행 방법: Supabase 콘솔 > SQL Editor. 043과 달리 선행 조건이 없다.
-- 기존 행은 target이 null로 남는다 — 과거 기록을 추측해서 채우지 않는다.

begin;

alter table audit_log
  add column if not exists target_user_id uuid;

-- 조회 화면이 UUID만 보여주면 읽을 수 없으므로 이메일을 같이 남긴다.
-- auth.users를 join하지 않고 스냅샷처럼 값을 박아두는 이유: 사용자가
-- 삭제돼도 "누구에게 한 작업이었는지"가 로그에 남아야 하기 때문이다.
alter table audit_log
  add column if not exists target_label text;

-- Admin 화면이 "이 사용자에게 무슨 일이 있었나"를 시간순으로 본다.
create index if not exists audit_log_target_idx
  on audit_log (target_user_id, created_at desc);

commit;
