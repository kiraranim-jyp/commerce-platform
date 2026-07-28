-- 쿠팡 판매자 계정 설정(1회 저장, 등록마다 재입력하지 않음) — 이 프로젝트는 아직
-- DATABASE_URL(직접 Postgres 연결)이 구성되어 있지 않아 Prisma migrate/Claude가
-- 자동으로 실행할 수 없다. Supabase 대시보드의 SQL Editor에서 이 파일 내용을
-- 그대로 한 번 실행해주면 된다(이후 코드가 이 테이블을 읽고 쓴다).
create table if not exists coupang_seller_settings (
  id text primary key default 'default',
  access_key text,
  secret_key text,
  vendor_id text,
  vendor_user_id text,
  delivery_company_code text,
  return_center_code text,
  return_charge_name text,
  company_contact_number text,
  return_zip_code text,
  return_address text,
  return_address_detail text,
  outbound_shipping_place_code bigint,
  updated_at timestamptz not null default now()
);

-- service_role 키로만 접근한다(서버 라우트 전용) — anon 키로는 아무것도 못 읽고
-- 못 쓰게 RLS를 켜고 정책을 아예 만들지 않는다.
alter table coupang_seller_settings enable row level security;
