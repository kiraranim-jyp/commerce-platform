-- BETA-SECURITY-2(CPO 지시, 2026-09-07) — Beta SaaS의 최소 데이터 경계.
--
-- 배경: 지금까지 TTAEJYO에는 사용자 개념 자체가 없었다. product_snapshots를
-- 비롯한 모든 데이터에 소유자 컬럼이 없어서, 인증을 붙여도 로그인한 A가 B의
-- 스냅샷을 그대로 읽을 수 있는 상태였다(BETA-SECURITY-1 조사 결과).
--
-- 이 마이그레이션이 만드는 것:
--   1) workspaces / workspace_members — 향후 팀 기능으로 확장 가능한 골격
--   2) product_snapshots.workspace_id — 실제 소유권 경계
--   3) 기존 운영 데이터의 backfill
--
-- Beta 정책은 "1 User = 1 Default Workspace"다. workspace_members를 지금
-- 만들어 두는 이유는, 나중에 팀을 붙일 때 가장 큰 테이블(product_snapshots)을
-- 다시 마이그레이션하지 않기 위해서다 — 지금은 행이 사용자당 하나뿐이다.
--
-- ────────────────────────────────────────────────────────────────────────
-- 실행 전 반드시 읽을 것
-- ────────────────────────────────────────────────────────────────────────
-- 이 스크립트는 Supabase 콘솔의 SQL Editor에서 사람이 직접 실행한다
-- (이 저장소에는 마이그레이션 러너가 없다).
--
-- 실행 전 선행 조건:
--   Supabase 콘솔 > Authentication > Users 에서
--   detourdada@gmail.com 계정을 먼저 생성해야 한다.
--
-- 그 계정이 없으면 이 스크립트는 아무것도 바꾸지 않고 예외를 던지고 멈춘다.
-- 소유자를 추측해서 임의의 UUID에 데이터를 귀속시키지 않는다(CPO 지시 §10).
--
-- 전체가 하나의 트랜잭션이다 — 중간에 실패하면 전부 롤백된다.
--
-- 실행 이력(2026-09-08): Production에 detourdada@gmail.com 기준으로 실행 완료.
--   작성 당시 대상은 kiraranim@gmail.com이었으나, 실제 운영 계정이
--   detourdada@gmail.com으로 확정되어(CEO-3/CEO-7) 그 기준으로 실행했다.
--   이 파일은 실제로 실행된 내용과 일치시키기 위해 사후 정정한 것이다 —
--   저장소와 DB가 어긋난 채로 남으면 나중에 누가 재실행했을 때 엉뚱한
--   계정을 찾거나 workspace가 하나 더 생긴다.
--
--   재실행해도 안전하다: 테이블/컬럼은 if not exists이고, workspace는
--   있으면 재사용하며, backfill은 workspace_id가 null인 행만 건드린다.
-- ────────────────────────────────────────────────────────────────────────

begin;

-- 1) Workspace 골격 ─────────────────────────────────────────────────────
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- 생성자. auth.users가 지워지면 workspace를 고아로 남기지 않는다.
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Beta에서는 role이 OWNER 하나뿐이다. 팀/초대/권한 세분화는 이번 범위가
-- 아니지만(§23), 나중에 값만 늘리면 되도록 처음부터 컬럼으로 둔다.
create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'OWNER' check (role in ('OWNER')),
  created_at timestamptz not null default now(),
  -- 같은 사용자가 같은 workspace에 두 번 들어가지 않는다. 로그인 시
  -- workspace 자동 생성이 idempotent해야 하는 근거가 되는 제약이다(§7).
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on workspace_members (user_id);

alter table workspaces enable row level security;
alter table workspace_members enable row level security;

-- 2) product_snapshots에 소유권 부여 ────────────────────────────────────
-- nullable로 먼저 추가한다(§9/§10) — 기존 행이 즉시 제약 위반이 되면
-- 마이그레이션 자체가 실패하고 운영 데이터가 위험해진다.
alter table product_snapshots
  add column if not exists workspace_id uuid references workspaces(id) on delete cascade;

-- 3) 기존 운영 데이터 backfill ──────────────────────────────────────────
do $$
declare
  v_user_id uuid;
  v_workspace_id uuid;
  v_orphaned integer;
begin
  select id into v_user_id
  from auth.users
  where email = 'detourdada@gmail.com'
  limit 1;

  if v_user_id is null then
    raise exception
      'BETA-SECURITY-2 중단: detourdada@gmail.com 계정이 없습니다. Supabase 콘솔 > Authentication > Users 에서 먼저 생성한 뒤 다시 실행하세요. (데이터는 변경되지 않았습니다)';
  end if;

  -- 이미 이 사용자의 workspace가 있으면 재사용한다 — 이 스크립트를 두 번
  -- 돌려도 workspace가 늘어나지 않아야 한다.
  select w.id into v_workspace_id
  from workspaces w
  join workspace_members m on m.workspace_id = w.id
  where m.user_id = v_user_id
  order by w.created_at
  limit 1;

  if v_workspace_id is null then
    insert into workspaces (name, created_by)
    values ('기본 워크스페이스', v_user_id)
    returning id into v_workspace_id;

    insert into workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, v_user_id, 'OWNER')
    on conflict (workspace_id, user_id) do nothing;
  end if;

  -- 소유자가 없던 기존 스냅샷 전부를 이 workspace로 귀속시킨다.
  -- 이미 workspace_id가 있는 행은 건드리지 않는다(재실행 안전).
  update product_snapshots
  set workspace_id = v_workspace_id
  where workspace_id is null;

  select count(*) into v_orphaned
  from product_snapshots
  where workspace_id is null;

  if v_orphaned > 0 then
    raise exception
      'BETA-SECURITY-2 중단: 소유자를 못 정한 스냅샷이 %건 남았습니다. 롤백합니다.', v_orphaned;
  end if;

  raise notice 'BETA-SECURITY-2: workspace % 로 backfill 완료', v_workspace_id;
end $$;

-- 4) 이제 NOT NULL을 걸 수 있다 ─────────────────────────────────────────
-- 위 backfill이 성공했을 때만 여기 도달한다. 앞으로 소유자 없는 스냅샷이
-- 만들어지는 것을 DB 레벨에서 막는다 — 애플리케이션 버그로 workspace_id를
-- 빠뜨리면 조용히 "아무에게도 안 보이는 행"이 되는 게 아니라 즉시 실패한다.
alter table product_snapshots
  alter column workspace_id set not null;

create index if not exists product_snapshots_workspace_id_idx
  on product_snapshots (workspace_id);

commit;
