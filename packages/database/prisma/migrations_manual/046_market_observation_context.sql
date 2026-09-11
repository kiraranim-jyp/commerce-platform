-- GLOBAL-SELLER/MARKET 1단계(CPO 확정, 2026-09-11) — 관측 당시의 market 근거를
-- 잃어버리지 않게 한다.
--
-- 왜 필요한가: extractor와 PriceObservation은 이미 marketCode/country를 들고
-- 있는데(price-intelligence.ts), 저장하는 순간 currency만 남아서 사라진다.
-- 실측(bobochoses.com, B226AC043)에서 같은 통화의 서로 다른 market 가격이
-- 확인됐다 — /en-de €75.00 과 /en-int €84.00. 둘 다 저장하면 currency=EUR로만
-- 남아 구분할 방법이 없다. "통화가 같으니 같은 시장"이 성립하지 않는다는 뜻이다.
--
-- 두 컬럼을 나누는 이유(CPO 지시): 관측 근거와 우리의 해석을 섞지 않는다.
--   market_code    = 실제로 요청/확인된 시장 코드 그대로("", en-kr, en-int …)
--   market_country = source가 스스로 선언한 기준 국가(/meta.json의 country 등)
-- marketCode=""를 "그 나라 시장"으로 바꿔 적지 않는다. 나중에 en-es나
-- ?country=ES 같은 경로가 생겼을 때 무엇이 관측이고 무엇이 해석인지 구분이
-- 남아 있어야 한다.
--
-- 기존 행은 backfill하지 않는다(CPO 지시). 그 시점의 근거를 우리가 모르는데
-- 지금 값으로 채우면 없는 사실을 지어내는 것이고, 끝난 분석을 바꾸지 않는다는
-- 원칙과도 어긋난다. 모르는 것은 null로 남는다.

alter table price_observations add column if not exists market_code text;
alter table price_observations add column if not exists market_country text;

-- 판매처 유형. 지금까지는 "국내/해외" 2분법이라 Bobo Choses처럼 한 도메인이
-- 여러 나라 시장을 동시에 가진 판매처를 표현할 자리가 없었다 — 국내와 해외에
-- 중복 등록하는 것 말고는 방법이 없었고, 그건 같은 판매처를 둘로 쪼개는 것이라
-- 쓰지 않기로 했다. 유형을 분리해 두면 하나의 Source를 유지할 수 있다.
--
-- 기존 행은 전부 DOMESTIC으로 둔다. 도메인만 보고 GLOBAL이라고 추측하지 않는다.
alter table domestic_price_sources
  add column if not exists seller_type text not null default 'DOMESTIC';

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'domestic_price_sources' and constraint_name = 'domestic_price_sources_seller_type_check'
  ) then
    alter table domestic_price_sources
      add constraint domestic_price_sources_seller_type_check
      check (seller_type in ('DOMESTIC', 'OVERSEAS', 'GLOBAL', 'MARKETPLACE'));
  end if;
end $$;

-- 이번 구조의 검증 대상 한 곳만 명시적으로 GLOBAL로 지정한다(CPO 지시).
-- 실측 근거: 같은 상품(B226AC043)이 root €75 / en-kr ₩162,000 / en-int €84 /
-- ?country=GB £83.50 / ?country=US $108로 시장마다 다른 가격을 낸다.
update domestic_price_sources set seller_type = 'GLOBAL' where domain = 'bobochoses.com';
