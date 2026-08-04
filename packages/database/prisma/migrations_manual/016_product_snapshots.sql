create table if not exists product_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  title text,
  thumbnail_url text,
  status text not null default 'IN_PROGRESS'
    check (status in ('IN_PROGRESS', 'REGISTERED')),
  workspace jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now()
);

create index if not exists product_snapshots_last_opened_at_idx
  on product_snapshots (last_opened_at desc);
create index if not exists product_snapshots_source_url_idx
  on product_snapshots (source_url);
alter table product_snapshots enable row level security;

alter table registration_attempts
  add column if not exists snapshot_id uuid references product_snapshots(id) on delete set null;
create index if not exists registration_attempts_snapshot_id_idx
  on registration_attempts (snapshot_id);
