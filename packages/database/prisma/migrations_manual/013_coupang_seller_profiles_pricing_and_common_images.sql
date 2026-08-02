-- Sprint A-11(작업1/2/3/4 — CPO 지시: "판매가 = 환율변환가격 × (1+기본마진)",
-- "가격 반올림 단위", "상단/하단 공통 이미지", "원산지 기본값") — 004/012와 같은
-- 이유로 상품마다 다시 입력하지 않는 판매자 운영 데이터를 SellerProfile에 둔다.
-- 001/004/012와 같은 이유로 Supabase 대시보드의 SQL Editor에서 한 번 실행해주면 된다.
alter table coupang_seller_profiles
  add column if not exists default_margin_percent numeric,
  add column if not exists include_shipping_in_price boolean not null default false,
  add column if not exists price_rounding_unit integer not null default 10,
  add column if not exists default_country_of_origin text,
  add column if not exists top_common_image_url text,
  add column if not exists top_common_image_enabled boolean not null default false,
  add column if not exists bottom_common_image_url text,
  add column if not exists bottom_common_image_enabled boolean not null default false;
