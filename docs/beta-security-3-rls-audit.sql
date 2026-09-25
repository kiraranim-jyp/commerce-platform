-- BETA-SECURITY-3 PHASE 1 — DB 현재 상태 조사 (읽기 전용)
--
-- Supabase 콘솔 > SQL Editor 에 붙여넣고 실행하세요.
-- 전부 SELECT입니다. 테이블/정책/권한을 하나도 바꾸지 않습니다.
--
-- 목적: 저장소의 마이그레이션 파일만으로는 알 수 없는 "실제 DB 상태"를 확인한다.
--   - 043 이후 콘솔에서 사람이 직접 만든 테이블/정책이 있을 수 있다
--   - Supabase 기본 GRANT 때문에 RLS가 꺼진 테이블은 anon 키로 열려 있을 수 있다
--
-- ① ~ ⑦ 결과를 그대로(값 마스킹 없이 구조만) 회신해 주시면
-- 테이블별 RLS 정책을 확정하고 PHASE 2 migration 작업지시서를 만듭니다.


-- ────────────────────────────────────────────────────────────────
-- ① public 스키마 전체 테이블 + RLS ON/OFF
--    가장 중요. rls_enabled = false 인 줄이 곧 노출 후보다.
-- ────────────────────────────────────────────────────────────────
select
  c.relname                                        as 테이블,
  c.relrowsecurity                                 as rls_켜짐,
  c.relforcerowsecurity                            as rls_강제,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as 정책수,
  pg_size_pretty(pg_total_relation_size(c.oid))    as 크기,
  (select n_live_tup from pg_stat_user_tables s
    where s.relname = c.relname)                   as 대략_행수
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity, c.relname;


-- ────────────────────────────────────────────────────────────────
-- ② 현재 존재하는 RLS 정책 전부
--    (저장소 마이그레이션에는 CREATE POLICY가 한 줄도 없다 —
--     여기서 뭔가 나온다면 콘솔에서 직접 만든 것이다)
-- ────────────────────────────────────────────────────────────────
select
  tablename   as 테이블,
  policyname  as 정책명,
  permissive  as 허용형,
  roles       as 적용역할,
  cmd         as 명령,
  qual        as using절,
  with_check  as with_check절
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ────────────────────────────────────────────────────────────────
-- ③ anon / authenticated 에게 부여된 테이블 권한
--    Supabase는 public 스키마 기본 권한으로 anon/authenticated에
--    GRANT ALL을 주는 경우가 많다. RLS가 꺼진 테이블에 anon SELECT가
--    붙어 있으면 브라우저에 노출된 anon 키만으로 그 테이블 전체를 읽을 수 있다.
-- ────────────────────────────────────────────────────────────────
select
  table_name    as 테이블,
  grantee       as 역할,
  string_agg(distinct privilege_type, ', ' order by privilege_type) as 권한
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
group by table_name, grantee
order by table_name, grantee;


-- ────────────────────────────────────────────────────────────────
-- ④ 위 ①③을 합친 "실제 위험 목록"
--    RLS가 꺼져 있으면서 anon에게 권한이 있는 테이블 = 즉시 조치 대상
-- ────────────────────────────────────────────────────────────────
select
  c.relname as 테이블,
  string_agg(distinct g.privilege_type, ', ' order by g.privilege_type) as anon_권한
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join information_schema.role_table_grants g
  on g.table_schema = 'public' and g.table_name = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
  and g.grantee = 'anon'
group by c.relname
order by c.relname;
-- 기대: 0행. 행이 나오면 그 테이블은 anon 키로 접근 가능한 상태다.


-- ────────────────────────────────────────────────────────────────
-- ⑤ 소유권 컬럼 현황
--    workspace_id / user_id 를 가진 테이블이 어디까지인가.
--    RLS 정책을 쓰려면 소유권 컬럼이 있어야 한다.
-- ────────────────────────────────────────────────────────────────
select
  table_name  as 테이블,
  column_name as 소유권컬럼,
  is_nullable as null허용
from information_schema.columns
where table_schema = 'public'
  and column_name in ('workspace_id', 'user_id', 'created_by', 'owner_id', 'seller_id')
order by table_name, column_name;


-- ────────────────────────────────────────────────────────────────
-- ⑥ workspace 구성 현황 (043 이후 사용자가 늘었는가)
-- ────────────────────────────────────────────────────────────────
select
  (select count(*) from auth.users)          as auth_사용자수,
  (select count(*) from workspaces)          as workspace수,
  (select count(*) from workspace_members)   as 멤버수,
  (select count(*) from product_snapshots)   as 스냅샷수,
  (select count(*) from product_snapshots
     where workspace_id is null)             as 소유자없는_스냅샷;
-- 소유자없는_스냅샷은 반드시 0이어야 한다(043이 NOT NULL을 걸었다).


-- ────────────────────────────────────────────────────────────────
-- ⑦ 노출된 뷰 / 함수 — RLS를 우회할 수 있는 경로
--    security definer 함수와 뷰는 RLS를 건너뛴다.
-- ────────────────────────────────────────────────────────────────
select
  p.proname                as 함수명,
  p.prosecdef              as security_definer,
  pg_get_userbyid(p.proowner) as 소유자
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.prosecdef desc, p.proname;

select table_name as 뷰명, view_definition is not null as 정의있음
from information_schema.views
where table_schema = 'public'
order by table_name;
