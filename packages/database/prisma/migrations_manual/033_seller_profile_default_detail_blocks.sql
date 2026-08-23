-- N-4.08-DetailPage(대표님 지시: "상세페이지 관리 구조 개선") — 지금까지 코드
-- 상수 defaultDetailBlocks()에 하드코딩돼 있던 "신규 상품 기본 블록 구성"을
-- 셀러가 설정 화면에서 직접 관리할 수 있도록 SellerProfile에 승격한다.
-- DetailPageBlock[] 배열을 그대로 jsonb로 저장한다 — 새 타입/스키마를
-- 만들지 않고 기존 타입을 재사용한다(작업지시서 "구조 유지" 원칙).
-- null이면(한 번도 설정 안 함) 기존처럼 코드 상수 defaultDetailBlocks()가
-- 폴백으로 쓰인다 — 이 컬럼이 비어 있다고 등록이 막히면 안 된다.
alter table coupang_seller_profiles
  add column if not exists default_detail_blocks jsonb;
