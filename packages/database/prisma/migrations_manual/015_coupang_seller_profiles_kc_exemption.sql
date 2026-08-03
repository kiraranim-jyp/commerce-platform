-- A-12.3-P0-2(CPO 지시: "인증/허가 사항 — 대부분 구매대행은 KC마크 없이
-- 구매대행 가능한 품목입니다. Seller Profile 기본값으로 자동 입력") — 001/004/
-- 012/013과 같은 이유로 Supabase 대시보드의 SQL Editor에서 한 번 실행해주면
-- 된다. 빈 문자열/NULL이면 기능이 꺼진 것과 같다(기존처럼 사용자가 직접
-- 확인해야 하는 PLACEHOLDER로 남는다) — 기본값을 강제로 채우지 않는다. 실제로
-- KC 인증이 법적으로 필요한 상품에도 이 문구가 자동으로 채워지면 컴플라이언스
-- 리스크가 되므로, 판매자가 Settings에서 이 문구를 직접 확인하고 켜야 한다.
alter table coupang_seller_profiles
  add column if not exists kc_exemption_text text;
