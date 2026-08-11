-- N-3.6 (개정) → N-3.7로 대체 — Naver/Coupang 공통 Resolver
--
-- coupang_seller_profiles.naver_delivery_company_code: Naver 출고 택배사 코드.
-- Coupang의 delivery_company_code와 동일한 패턴(공식 조회 API가 없어 판매자가
-- Settings에서 직접 입력) — Naver 쪽은 지금까지 이 입력 필드 자체가 없어서
-- BLOCKED였다. Coupang과 같은 "수동 입력 가능" 패턴으로 공통화하면 BLOCKED가
-- 아니라 MISSING(입력하면 해결됨)이 정확한 상태다.
--
-- (원래 이 마이그레이션에 있던 coupang_brand_profiles.official_website 컬럼은
-- N-3.6(개정)의 "브랜드 본국 원본가격" 개념 전용이었다. N-3.7에서 원본가격
-- 기준이 "판매처(편집샵) 원본 시장"으로 전면 교체되면서 그 개념 자체가
-- 폐기됐고, 이 컬럼은 아직 프로덕션에 적용되지 않은 상태였으므로 — 죽은
-- 컬럼을 만들지 않기 위해 이 마이그레이션에서 제거했다.)

alter table coupang_seller_profiles
  add column if not exists naver_delivery_company_code text;
