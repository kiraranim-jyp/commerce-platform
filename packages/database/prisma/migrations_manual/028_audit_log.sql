-- N-4.05 Track V(대표님 지시: "베타에서는 반드시 필요") — 셀러가 무엇을
-- 변경했는지 기록하는 append-only 감사 로그. price_observations(027)와 같은
-- 이유로 하드 FK 없이 조건부로만 건다(스키마 캐시/프로젝트 불일치로 마이그레이션
-- 자체가 막히는 걸 피한다). event_type을 enum으로 고정하지 않는다 — 이벤트
-- 종류가 늘 때마다 마이그레이션을 또 만들지 않기 위해 애플리케이션 코드
-- (apps/admin의 audit-log 모듈)에서 허용값을 관리한다.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  -- 'PRODUCT_UPDATED' | 'PRICE_UPDATED' | 'ATTRIBUTE_UPDATED' |
  -- 'MARKETPLACE_REGISTERED' | 'MARKETPLACE_FAILED' | 'SETTING_UPDATED' 등.
  event_type text not null,
  -- 누가: 지금은 단일 관리자 계정(admin 로그인)뿐이라 항상 'admin'이지만,
  -- 나중에 멀티유저가 생겨도 스키마 변경 없이 그대로 쓸 수 있게 text로 둔다.
  actor text not null default 'admin',
  snapshot_id uuid,
  -- 'smartstore' | 'coupang' | 'elevenst' | 'esm' — 상품/설정 변경처럼 특정
  -- 마켓플레이스와 무관한 이벤트는 null.
  marketplace text,
  field text,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_snapshot_idx on audit_log (snapshot_id, created_at desc);
create index if not exists audit_log_event_type_idx on audit_log (event_type, created_at desc);
alter table audit_log enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_snapshots'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'audit_log_snapshot_id_fkey'
    ) then
      alter table audit_log
        add constraint audit_log_snapshot_id_fkey
        foreign key (snapshot_id) references product_snapshots(id) on delete set null;
    end if;
  end if;
end $$;
