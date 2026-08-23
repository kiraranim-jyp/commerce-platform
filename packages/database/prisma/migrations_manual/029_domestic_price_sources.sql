-- N-4.06(대표님 지시) — 국내 가격비교의 Primary Source를 "네이버 쇼핑 검색"에서
-- "사전 등록된 국내 편집샵의 동일상품 가격 추적"으로 전환한다.
--
-- comparison_shops(019)와 의도적으로 분리한다 — comparison_shops는 "해외
-- 원본 상품이 실제로 어디서 얼마에 팔리는가"(원가/landed cost 기준선 확인용,
-- 통화가 KRW가 아닐 수 있음)를 위한 테이블이고, 이 테이블은 "국내에서 이
-- 상품을 누가 이미 재판매하고 있는가"(셀러의 국내 경쟁가 판단용, 통화는
-- 항상 KRW)를 위한 테이블이다 — 목적과 통화 처리가 달라 한 테이블에
-- 섞으면 나중에 "이 행이 원가 기준인지 경쟁가 기준인지" 매번 다시 구분해야
-- 하는 문제가 생긴다.

create table if not exists domestic_price_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  url text not null,
  currency text not null default 'KRW',
  -- 이 편집샵이 주로 다루는 카테고리(예: KIDS_FASHION, KIDS_GOODS) — 상품
  -- 매칭 후보를 좁히는 용도. 배열이라 여러 카테고리를 가질 수 있다.
  category_scope text[] not null default '{}',
  priority text not null default 'P1' check (priority in ('P0', 'P1', 'P2')),
  -- 'AUTO_API'(공식 API 확인됨) | 'AUTO_SCRAPE'(robots.txt/약관상 허용되는 자동
  -- 수집) | 'MANUAL'(자동화 불가, 사람이 직접 확인) | 'NOT_AVAILABLE'(접근/약관
  -- 문제로 이번 단계에서 배제) — comparison-search 어댑터와 동일 원칙: 파서가
  -- 실제로 있는 sourceId만 코드에서 AUTO로 취급하고, 나머지는 이 값과 무관하게
  -- 'unsupported'로 자연스럽게 빠진다(하드코딩 허용목록이 아니라 파서 존재 여부).
  collection_strategy text not null default 'MANUAL'
    check (collection_strategy in ('AUTO_API', 'AUTO_SCRAPE', 'MANUAL', 'NOT_AVAILABLE')),
  -- 'ACTIVE' | 'PAUSED' | 'NOT_AVAILABLE' | 'ERROR' — 마지막 수집 결과로 갱신되는
  -- 운영 상태. enabled(boolean)만으로는 "관리자가 껐다"와 "계속 에러나서 막혔다"를
  -- 구분할 수 없어 별도로 둔다.
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'NOT_AVAILABLE', 'ERROR')),
  last_error_code text,
  last_error_message text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists domestic_price_sources_enabled_idx on domestic_price_sources (enabled, priority);
alter table domestic_price_sources enable row level security;

-- 대표님이 P0/P1 후보 목록을 확정하면 그때 seed한다 — 이번 마이그레이션은
-- 빈 테이블로 시작한다(실제 사이트 검증 전에 이름을 지어내지 않는다, PART 12 원칙).

-- N-4.06 Part 3 — 해외 원본 상품 ↔ 국내 편집샵 상품의 "동일상품 연결". 한
-- snapshot에 여러 편집샵 상품이 연결될 수 있어 snapshot_id당 여러 행이 생긴다
-- (unique 제약은 snapshot+source 조합에만 건다 — 같은 편집샵에서 같은 상품을
-- 중복 연결하지 않기 위함).
create table if not exists domestic_product_links (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  source_id uuid not null references domestic_price_sources(id) on delete cascade,
  external_product_id text,
  external_url text not null,
  matched_brand text,
  matched_title text,
  matched_model_name text,
  matched_color text,
  -- 'EXACT' | 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'NOT_MATCHED' — B-1의
  -- match.ts(scoreCandidateMatch, SKU 우선/브랜드 게이트 로직)를 그대로
  -- 재사용해서 계산한다 — 새 매칭 로직을 또 만들지 않는다.
  match_type text not null check (match_type in ('EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'NOT_MATCHED')),
  match_confidence numeric not null,
  match_reasons text[] not null default '{}',
  -- 관리자가 REVIEW_REQUIRED 후보를 직접 확인하고 승인한 경우 true. false인
  -- REVIEW_REQUIRED 연결은 가격 수집/경쟁가 계산에 사용하지 않는다(Part 2
  -- "절대 금지" 원칙 — 검증 안 된 매칭을 가격 판단에 쓰지 않는다).
  verified boolean not null default false,
  verified_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED', 'BROKEN_LINK')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_id, source_id)
);

create index if not exists domestic_product_links_snapshot_idx on domestic_product_links (snapshot_id);
alter table domestic_product_links enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_snapshots'
  ) then
    if not exists (
      select 1 from information_schema.table_constraints
      where constraint_name = 'domestic_product_links_snapshot_id_fkey'
    ) then
      alter table domestic_product_links
        add constraint domestic_product_links_snapshot_id_fkey
        foreign key (snapshot_id) references product_snapshots(id) on delete cascade;
    end if;
  end if;
end $$;

-- N-4.06 Part 4 — price_observations(027)를 그대로 재사용하되, 특정 편집샵을
-- 구조적으로 참조할 수 있도록 source_ref_id를 추가한다. source_label(기존 컬럼,
-- 자유 텍스트)만으로도 표시는 가능하지만, "이 관측치가 정확히 어느
-- domestic_price_sources 행에서 왔는지"를 안정적으로 조인하려면 텍스트 일치가
-- 아니라 FK가 필요하다(오타/개명에 안전). price_observations 테이블 자체가
-- 이 세션에서 보일 때만 추가한다 — 027와 같은 이유로 마이그레이션이 막히지
-- 않게 조건부로 처리한다.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'price_observations'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'price_observations' and column_name = 'source_ref_id'
    ) then
      alter table price_observations add column source_ref_id uuid;
    end if;
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
