-- P-3-2(대표님 지시, 2026-08-28) — Sprint P-3~P-5 "가격 의사결정 완성" 스프린트.
-- P-3-1 조사에서 확인된 대로, 판매자가 실제로 부담하는 국내 배송원가는
-- 지금까지 DB 어디에도 저장할 곳이 없었다(SellerProfile.deliveryCharge는
-- 고객에게 청구하는 배송비이지 이 값이 아니다). 대표님 확정(옵션 1): 국내
-- 배송원가는 상품마다 다시 입력하지 않는 판매자 기본값 — deliveryCharge와
-- 같은 패턴으로 coupang_seller_profiles에 컬럼 하나만 추가한다. null이면
-- (한 번도 설정 안 함) computeUnifiedPriceDecision()에 그대로 unknown으로
-- 전달되어 기존과 동일하게 동작한다 — 이 컬럼이 비어 있다고 아무것도
-- 깨지지 않는다.
alter table coupang_seller_profiles
  add column if not exists domestic_shipping_cost_krw numeric;
