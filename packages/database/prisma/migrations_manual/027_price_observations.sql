-- N-4.01 Part E/G/I(대표님 지시) — "해외직구 → 국내 판매 가격을 자동으로
-- 비교·감시"의 저장소. 상품 하나에 여러 소스(해외 원가 1건, 국내 시장
-- 리스팅 N건)의 가격 관측치가 매번 쌓인다 — append-only 이력 테이블로
-- 두고, 최저/평균/최고가 같은 파생값은 저장하지 않고 조회 시점에 계산한다
-- (product_snapshots/016 마이그레이션 주석과 같은 원칙 — 파생 데이터를
-- 중복 저장하지 않는다, N-3.56 compute-readiness.ts에서도 같은 이유로
-- API 조회 결과를 저장하지 않는다).
--
-- source는 enum으로 고정하지 않는다 — PART G가 향후 소스를 늘릴 수 있고
-- (예: 다나와/에누리가 실제 접근 가능하다고 확인되면), 소스 하나 늘 때마다
-- 마이그레이션을 또 만드는 걸 피한다. 대신 애플리케이션 코드
-- (packages/pricing/src/price-observation-source.ts)에서 허용값을 관리한다.
--
-- 재생성(2026-08-23) — 처음 버전은 snapshot_id에 하드 FK(references
-- product_snapshots(id))를 걸었는데, 실행 환경에서 "relation
-- product_snapshots does not exist"로 막혔다(프로덕션 앱은 실제로 그 테이블을
-- 정상적으로 읽고 있는 게 확인됨 — 이 SQL을 실행한 세션이 다른 프로젝트/스키마를
-- 보고 있었을 가능성이 높다). 원인을 굳이 다시 진단하지 않아도 마이그레이션이
-- 막히지 않도록, FK는 product_snapshots가 실제로 보이는 세션에서만 조건부로
-- 건다 — 테이블 자체는 항상 만들어진다.
create table if not exists price_observations (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  -- 'SELLER_ORIGIN'(해외 판매처 원가) | 'NAVER_SHOPPING'(국내 시장 리스팅) 등.
  source text not null,
  -- 국내 리스팅이면 쇼핑몰/판매자명, 해외 원가면 판매처명(있으면).
  source_label text,
  source_product_url text,
  currency text not null,
  price_amount numeric not null,
  shipping_cost_amount numeric,
  tax_amount numeric,
  -- 이 관측 시점에 실제로 사용한 환율(원 단위 KRW 기준) — 나중에 환율이
  -- 바뀌어도 "그때 어떤 환율로 계산했는지" 감사 가능해야 한다(PART U 감사
  -- 원칙과 동일한 이유).
  exchange_rate numeric,
  price_krw numeric not null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists price_observations_snapshot_source_idx
  on price_observations (snapshot_id, source, checked_at desc);
alter table price_observations enable row level security;

-- product_snapshots가 이 세션에서 실제로 보이면(=올바른 프로젝트/스키마라면)
-- 참조 무결성을 건다. 안 보이면 조용히 건너뛴다 — 나중에 product_snapshots가
-- 확인되면 이 마이그레이션을 다시 실행해도 안전하다(constraint가 이미 있으면
-- 건너뜀, "not exists" 체크로 중복 생성 에러 없음).
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
