-- LOTTEON COMMERCE SPRINT 2 Phase 1 (CPO 승인, 2026-09-14)
--
-- ⚠️ 이 파일은 **작성만 되어 있고 실행되지 않았다.** 에이전트/CTO는 실행하지
--    않는다 — CEO가 Supabase SQL Editor에서 직접 실행한다.
--
-- 실행 방법:
--   Supabase 대시보드 > SQL Editor > 아래 내용을 붙여넣고 Run.
--   실행 전후로 데이터가 지워지거나 바뀌는 일은 없다(제약 조건만 넓힌다).
--
-- 왜 필요한가:
--   commerce_accounts.platform은 023_commerce_accounts.sql에서
--   `check (platform in ('naver', 'coupang'))`로 만들어졌다. 이 상태로는
--   platform='lotteon' 행을 **INSERT 자체가 불가능**하다(조사 §4-2 실측).
--   롯데ON 인증키를 설정 화면에서 저장하려면 이 제약을 먼저 넓혀야 한다.
--
-- 왜 새 컬럼을 만들지 않는가:
--   롯데ON 인증은 정적 Bearer 키 **하나**뿐이다(OAuth도 서명도 없다 — 조사
--   §5-1). 기존 secret_key 컬럼에 그대로 담는다. 컬럼을 새로 만들면 저장/표시/
--   삭제 경로를 채널마다 한 벌씩 더 갖게 된다.
--
-- 암호화:
--   이번 범위가 아니다(별건 등록됨). naver/coupang과 **동일하게** 평문으로
--   저장된다 — 여기만 다르게 하면 나중에 일괄 암호화할 때 두 벌을 고쳐야 한다.

alter table commerce_accounts drop constraint if exists commerce_accounts_platform_check;

alter table commerce_accounts
  add constraint commerce_accounts_platform_check
  check (platform in ('naver', 'coupang', 'lotteon'));

-- 실행 후 확인용(SELECT만 — 아무것도 바꾸지 않는다):
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'commerce_accounts'::regclass
--      and contype = 'c';
--   기대 결과: CHECK (platform = ANY (ARRAY['naver'::text, 'coupang'::text, 'lotteon'::text]))
