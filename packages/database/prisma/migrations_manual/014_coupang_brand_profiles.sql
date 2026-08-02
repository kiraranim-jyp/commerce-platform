-- Sprint A-12(작업4 — CPO 지시: "브랜드 프로필 — 원산지/제조자/브랜드소개/
-- 대표이미지/공통설명을 브랜드당 한 번만 입력하면 그 브랜드 상품에 자동
-- 적용") — coupang_seller_profiles(001/004/011/012/013)와 같은 이유로 판매자
-- 운영 데이터를 상품과 분리해서 관리한다. 다른 점은 매칭 키가 "기본 프로필
-- 1개"가 아니라 "브랜드명(name)"이라는 것 — product.brand.value와 대소문자
-- 무시 일치로 매칭한다(build-payload.ts).
-- Supabase 대시보드의 SQL Editor에서 한 번 실행해주면 된다.
create table if not exists coupang_brand_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  country_of_origin text,
  manufacturer text,
  brand_intro text,
  representative_image_url text,
  common_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coupang_brand_profiles_name_idx on coupang_brand_profiles (lower(name));
