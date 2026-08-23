-- N-4.07 2차(대표님 지시: "국내 편집숍 가격 Intelligence 운영 완성") — 실측 확인
-- (2026-08-23): domestic_price_sources/domestic_product_links(029/030)는 생성 직후
-- PostgREST에 바로 노출됐는데, price_observations(027)는 여러 세션이 지난 지금도
-- "Could not find the table 'public.price_observations' in the schema cache" 오류가
-- 계속 난다 — 027 자체가 실제로 이 프로젝트에서 성공적으로 실행된 적이 없거나
-- (027의 주석에 남아있는 "다른 프로젝트/스키마를 보고 있었을 가능성" 메모 참고),
-- 실행은 됐지만 PostgREST가 스키마 캐시를 리로드하지 않은 상태로 남아있을 가능성이다.
--
-- 이 마이그레이션은 027을 그대로 다시 실행(create table if not exists라 이미
-- 있으면 안전하게 스킵)한 뒤, 명시적으로 PostgREST에 스키마 리로드를 요청한다
-- (NOTIFY pgrst — Supabase 공식 문서에 따르면 SQL Editor에서 DDL을 실행해도 자동
-- 리로드되지만, 이번 세션은 그 자동 리로드가 실제로 동작하지 않는 것으로 보여
-- 명시적으로 한 번 더 보낸다).
create table if not exists price_observations (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  source text not null,
  source_label text,
  source_product_url text,
  currency text not null,
  price_amount numeric not null,
  shipping_cost_amount numeric,
  tax_amount numeric,
  exchange_rate numeric,
  price_krw numeric not null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists price_observations_snapshot_source_idx
  on price_observations (snapshot_id, source, checked_at desc);
alter table price_observations enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_snapshots'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'price_observations_snapshot_id_fkey'
    ) then
      alter table price_observations
        add constraint price_observations_snapshot_id_fkey
        foreign key (snapshot_id) references product_snapshots(id) on delete cascade;
    end if;
  end if;
end $$;

-- N-4.06(030)이 추가한 source_ref_id도 이 세션에서 다시 확인한다(테이블이 이제
-- 보이는 세션이라면 이미 있을 것 — 없으면 여기서 추가).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'price_observations' and column_name = 'source_ref_id'
  ) then
    alter table price_observations add column source_ref_id uuid;
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'domestic_price_sources'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'price_observations_source_ref_id_fkey'
    ) then
      alter table price_observations
        add constraint price_observations_source_ref_id_fkey
        foreign key (source_ref_id) references domestic_price_sources(id) on delete set null;
    end if;
  end if;
end $$;

-- 핵심: PostgREST가 이 세션에서 만들어진(또는 이미 있던) 테이블을 API로 노출하도록
-- 스키마 캐시를 강제로 리로드한다.
NOTIFY pgrst, 'reload schema';
