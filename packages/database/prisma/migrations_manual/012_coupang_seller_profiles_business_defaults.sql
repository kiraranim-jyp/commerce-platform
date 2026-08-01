-- Sprint A-8(Seller Profile 배송/반품/제조자 정보 관리) — CPO 지시: 상품마다
-- 배송비/반품배송비/교환배송비/출고소요일을 다시 입력하지 않고 판매자 기본값을
-- 자동으로 불러와 쓰도록 한다. 또한 Sprint A-7 실측에서 Attribute Coverage의
-- 1위 블로킹 필드였던 "제조자(수입자)"도 상품마다 원본 사이트에서 긁어올 정보가
-- 아니라 판매자(대표님) 본인의 사업자 정보인 경우가 많아 같은 방식으로 옮긴다.
-- 004와 같은 이유로 Supabase 대시보드의 SQL Editor에서 한 번 실행해주면 된다.
alter table coupang_seller_profiles
  add column if not exists delivery_charge integer,
  add column if not exists return_delivery_charge integer,
  add column if not exists exchange_delivery_charge integer,
  add column if not exists outbound_lead_time_days integer,
  add column if not exists delivery_method text,
  add column if not exists manufacturer text,
  add column if not exists as_contact_number text,
  add column if not exists quality_guarantee text;
