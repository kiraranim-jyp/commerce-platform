-- 배송 프로필(Seller Profile) — 001의 coupang_seller_settings는 이제 계정 인증
-- (access_key/secret_key/vendor_id/vendor_user_id)만 담당하고, 출고지/반품지/
-- 택배사처럼 "상품마다 또는 지역마다 달라질 수 있는" 배송 설정은 이 테이블로
-- 옮긴다 — 여러 개를 만들어두고(예: 기본/유럽/일본) 등록할 때 고르는 구조다.
-- 001/002와 같은 이유로 Supabase 대시보드의 SQL Editor에서 한 번 실행해주면 된다.
create table if not exists coupang_seller_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  delivery_company_code text,
  return_center_code text,
  return_charge_name text,
  company_contact_number text,
  return_zip_code text,
  return_address text,
  return_address_detail text,
  outbound_shipping_place_code bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coupang_seller_profiles_is_default_idx on coupang_seller_profiles (is_default);

alter table coupang_seller_profiles enable row level security;
