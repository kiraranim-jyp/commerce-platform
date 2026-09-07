-- BETA-SECURITY-2 배포 전 상태 확인 (읽기 전용)
--
-- Supabase 콘솔 > SQL Editor 에 붙여넣고 실행하세요.
-- 전부 SELECT입니다 — 데이터를 바꾸지 않습니다.
--
-- 작업지시서 §20의 "043 DB 상태 정상 / 기존 대표 계정 ↔ 기존 Workspace 정상"을
-- 확인하기 위한 것입니다. 결과를 그대로 공유해 주시면 다음 단계로 넘어갑니다.
-- (개인정보가 포함되므로 이메일 외 값은 공유하지 않으셔도 됩니다.)


-- ① 043이 적용됐는가 — workspaces / workspace_members 테이블 존재 여부
select
  to_regclass('public.workspaces')        is not null as workspaces_있음,
  to_regclass('public.workspace_members') is not null as workspace_members_있음;


-- ② product_snapshots.workspace_id 컬럼이 생겼는가, NOT NULL인가
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name  = 'product_snapshots'
  and column_name = 'workspace_id';
-- 기대: 1행, is_nullable = 'NO'
-- 0행이면 043 미실행입니다.


-- ③ Auth 사용자 목록 — user1(detourdada@gmail.com)이 있는가, 이메일이 확인됐는가
--    email_confirmed_at이 NULL이면 Google 로그인 시 별도 계정이 만들어질 수
--    있습니다(그러면 기존 데이터가 안 보입니다). 계정 생성 시 "Auto Confirm
--    User"를 켜야 하는 이유입니다.
select
  email,
  (email_confirmed_at is not null) as 이메일확인됨,
  created_at,
  last_sign_in_at
from auth.users
order by created_at;


-- ④ 로그인 방식(identity) 확인 — Google을 연결하면 provider에 'google'이 추가됩니다.
select u.email, i.provider, i.created_at
from auth.identities i
join auth.users u on u.id = i.user_id
order by u.email, i.provider;


-- ⑤ workspace 구성 — 누가 어느 workspace의 OWNER인가
select
  w.id   as workspace_id,
  w.name as workspace명,
  u.email,
  m.role
from workspaces w
join workspace_members m on m.workspace_id = w.id
join auth.users u        on u.id = m.user_id
order by w.created_at;
-- 기대(043 직후): 1행 — detourdada@gmail.com / OWNER


-- ⑥ 가장 중요 — 기존 스냅샷이 전부 user1의 workspace에 귀속됐는가
select
  u.email                as 소유자,
  count(*)               as 스냅샷수,
  min(s.created_at)      as 가장오래된것,
  max(s.created_at)      as 가장최근것
from product_snapshots s
left join workspaces w        on w.id = s.workspace_id
left join workspace_members m on m.workspace_id = w.id
left join auth.users u        on u.id = m.user_id
group by u.email
order by 스냅샷수 desc;
-- 기대: detourdada@gmail.com 한 줄에 전체 건수가 몰려 있어야 합니다.
-- 소유자가 NULL인 줄이 있으면 귀속되지 않은 데이터가 남아 있다는 뜻입니다.


-- ⑦ 고아 스냅샷 — 반드시 0이어야 합니다
select count(*) as 소유자없는_스냅샷
from product_snapshots
where workspace_id is null;
