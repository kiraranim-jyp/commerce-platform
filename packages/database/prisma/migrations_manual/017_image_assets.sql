create table if not exists image_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  storage_key text not null,
  file_name text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists image_assets_created_at_idx on image_assets (created_at desc);
create index if not exists image_assets_tags_idx on image_assets using gin (tags);
alter table image_assets enable row level security;

alter table coupang_seller_profiles
  add column if not exists top_common_image_asset_id uuid references image_assets(id) on delete set null,
  add column if not exists bottom_common_image_asset_id uuid references image_assets(id) on delete set null;

alter table coupang_brand_profiles
  add column if not exists representative_image_asset_id uuid references image_assets(id) on delete set null;
