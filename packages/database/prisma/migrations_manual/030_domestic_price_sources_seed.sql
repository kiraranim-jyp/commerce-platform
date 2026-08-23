-- N-4.07(대표님 지시) — domestic_price_sources(029)에 SYSTEM/USER 구분을
-- 추가하고(comparison_shops와 같은 패턴 — SYSTEM은 비활성화만 가능, USER가
-- 추가한 건 삭제도 가능), 실제 조사를 마친 후보 4곳을 seed한다.
--
-- 아래 4개는 전부 실제 WebFetch로 사이트를 열어 확인한 결과다(추정 아님):
--   - LOOXLOO: Cafe24 플랫폼, 상품 목록/검색 페이지에서 브랜드명·상품코드·
--     정상가/할인가가 실제로 노출됨(예: BR B.C.로고트랙수트자켓/76A7D-110-09).
--     robots.txt가 검색/상품 경로를 막지 않고 ClaudeBot도 명시적으로 허용 —
--     AUTO_SCRAPE로 시작.
--   - SSF SHOP: 삼성물산 자체 플랫폼(프로프라이어터리 URL 구조). 이번 조사의
--     검색 시도에서는 Bobo Choses/LITTLE GROUND 상품이 실제로 확인되지
--     않았다(LITTLE GROUND 브랜드 링크는 있으나 상품 노출 없음) — 실제
--     검색 파라미터를 더 조사해야 한다. MANUAL로 시작(추정으로 AUTO 표시
--     안 함).
--   - KIDIKIDI(이랜드몰): 홈페이지 노출 브랜드가 국내 캐주얼/라이선스 위주로
--     확인됐고, 이번 조사에서 Bobo Choses 취급 여부를 확인하지 못했다
--     (검색 URL 추정 실패, 404). MANUAL로 시작 — 실제 취급 여부가 불확실한
--     채로 AUTO 처리하지 않는다.
--   - BOBO CHOSES KOREA(공식 스토어): Shopify 플랫폼 확인(cdn.shop/ 경로,
--     /ko-kr/products/ URL 패턴). packages/crawler의 기존 Shopify Product
--     JSON 인프라(fetchShopifyProductJson, junioredition.com 등에 이미 사용
--     중)를 그대로 재사용할 수 있어 AUTO_API로 시작 — 신규 파서를 만들
--     필요가 없다.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'domestic_price_sources' and column_name = 'source'
  ) then
    alter table domestic_price_sources
      add column source text not null default 'USER' check (source in ('SYSTEM', 'USER'));
  end if;
end $$;

-- status는 전부 ACTIVE로 시작한다("이 후보를 계속 조사/운영 대상으로 본다"는
-- 뜻) — collection_strategy가 실제 자동수집 가능 여부를 별도로 표현하므로
-- status를 그 의미까지 겸용하지 않는다(필드 하나가 두 가지를 뜻하면 나중에
-- 혼란이 생긴다). status는 실제 수집을 시도한 뒤 결과(연속 실패 등)로만
-- ERROR/NOT_AVAILABLE로 바뀐다.
insert into domestic_price_sources (name, domain, url, currency, category_scope, priority, collection_strategy, status, source, enabled)
values
  ('LOOXLOO', 'looxloo.com', 'https://www.looxloo.com', 'KRW', array['KIDS_FASHION'], 'P0', 'AUTO_SCRAPE', 'ACTIVE', 'SYSTEM', true),
  ('SSF SHOP', 'ssfshop.com', 'https://www.ssfshop.com', 'KRW', array['KIDS_FASHION'], 'P0', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('키디키디', 'kidikidi.elandmall.co.kr', 'https://kidikidi.elandmall.co.kr', 'KRW', array['KIDS_FASHION', 'KIDS_GOODS'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('Bobo Choses Korea(공식)', 'bobochoses.com', 'https://bobochoses.com/ko-kr', 'KRW', array['KIDS_FASHION'], 'P1', 'AUTO_API', 'ACTIVE', 'SYSTEM', true)
on conflict (domain) do nothing;
