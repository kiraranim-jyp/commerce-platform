-- N-3.52/N-3.53(CPO 지시) — "API가 받아주면 등록"을 성공 기준으로 두지
-- 않는다. 판매자가 상품 등록 직전에 KC/판매 가능 여부를 실제로 확인했다는
-- 기록을 남긴다(감사 로그 목적 — 나중에 상품 상태가 바뀌었을 때 "언제 어떤
-- 기준으로 판매자가 확인했는지" 추적 가능해야 한다, CPO STEP8). N-3.53에서
-- kc_status를 4단계(NOT_APPLICABLE/CERTIFIED_REFERENCE/SELLER_REVIEW_REQUIRED/
-- BLOCKED)로 고정했다 — 이 마이그레이션은 아직 실행 전이라 이전 6단계 값을
-- 옮길 데이터가 없다.
create table if not exists seller_compliance_confirmations (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references product_snapshots(id) on delete set null,
  platform text not null default 'smartstore',
  category_code text not null,
  kc_status text not null
    check (kc_status in (
      'NOT_APPLICABLE',
      'CERTIFIED_REFERENCE',
      'SELLER_REVIEW_REQUIRED',
      'BLOCKED'
    )),
  confirmed boolean not null default false,
  policy_version text not null,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists seller_compliance_confirmations_snapshot_id_idx
  on seller_compliance_confirmations (snapshot_id);
create index if not exists seller_compliance_confirmations_created_at_idx
  on seller_compliance_confirmations (snapshot_id, created_at desc);
alter table seller_compliance_confirmations enable row level security;
