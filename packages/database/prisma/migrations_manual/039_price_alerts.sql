-- N-4.18-K STEP K-5(대표님 지시, 2026-08-26: "DB에 별도 복잡한 상태를 만들기
-- 전에 기존 구조를 조사") — price_observations/domestic_product_links를
-- 그대로 조사했지만 "지금 열려있는 알림"을 표현하는 테이블은 없었다. 최소
-- 상태만 추가한다: OPEN(신규 발생) / ACKNOWLEDGED(셀러 확인함) /
-- RESOLVED(상황 종료). 새 가격판정 엔진이 아니라 packages/pricing의
-- computeMarketAlert()(기존 sellerAction 재사용)가 낸 결과를 그대로 저장만
-- 한다.
--
-- STEP K-4(중복 방지) — 같은 snapshot+category 조합으로 이미 OPEN/
-- ACKNOWLEDGED 상태인 행이 있으면 새로 만들지 않는다(partial unique index로
-- DB 레벨에서 강제). 상황이 RESOLVED로 종료된 뒤 다시 발생하면 새 행을
-- 만든다 — "같은 상태가 유지되는 동안은 최초 1회만" 원칙을 인덱스로 보장한다.
create table if not exists price_alerts (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  -- 'PRICE_GAP' | 'OPPORTUNITY' | 'ORIGIN_TREND' — computeMarketAlert()가
  -- 이미 계산해서 내는 category를 그대로 저장한다.
  category text not null check (category in ('PRICE_GAP', 'OPPORTUNITY', 'ORIGIN_TREND')),
  severity text not null check (severity in ('ACTION_REQUIRED', 'REVIEW', 'INFO')),
  title text not null,
  detail text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists price_alerts_snapshot_idx on price_alerts (snapshot_id);
create index if not exists price_alerts_status_idx on price_alerts (status);

-- STEP K-4 — 활성(OPEN/ACKNOWLEDGED) 알림은 snapshot+category당 최대 1건만
-- 존재할 수 있다(partial unique index — RESOLVED 행은 인덱스에서 제외돼
-- 재발생 시 새 행 생성을 막지 않는다).
create unique index if not exists price_alerts_active_unique_idx
  on price_alerts (snapshot_id, category)
  where status in ('OPEN', 'ACKNOWLEDGED');

alter table price_alerts enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_snapshots'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'price_alerts_snapshot_id_fkey'
    ) then
      alter table price_alerts
        add constraint price_alerts_snapshot_id_fkey
        foreign key (snapshot_id) references product_snapshots(id) on delete cascade;
    end if;
  end if;
end $$;
