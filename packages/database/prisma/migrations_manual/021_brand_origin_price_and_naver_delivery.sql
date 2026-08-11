-- N-3.6 (개정) — Brand-Origin Price Intelligence + Naver/Coupang 공통 Resolver
--
-- 1. coupang_brand_profiles.official_website: 브랜드 본국 공식 사이트 URL(수동 입력,
--    countryOfOrigin/manufacturer와 같은 패턴 — 브랜드당 1회 입력, 그 브랜드 모든
--    상품에 재사용). Brand Origin Price Resolver가 이 값이 있을 때만 동작한다 —
--    없으면 brandOriginPrice = null(추측하지 않음).
--
-- 2. coupang_seller_profiles.naver_delivery_company_code: Naver 출고 택배사 코드.
--    Coupang의 delivery_company_code와 동일한 패턴(공식 조회 API가 없어 판매자가
--    Settings에서 직접 입력) — Naver 쪽은 지금까지 이 입력 필드 자체가 없어서
--    BLOCKED였다. Coupang과 같은 "수동 입력 가능" 패턴으로 공통화하면 BLOCKED가
--    아니라 MISSING(입력하면 해결됨)이 정확한 상태다.

alter table coupang_brand_profiles
  add column if not exists official_website text;

alter table coupang_seller_profiles
  add column if not exists naver_delivery_company_code text;
