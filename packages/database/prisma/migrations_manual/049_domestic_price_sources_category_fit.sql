-- TTAEJYO 2.0(CEO 지시, 2026-09-12) — 판매처를 "카테고리 적합도"로 고를 수 있게 한다.
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- category_scope(text[]) 컬럼은 029부터 있었고 값도 채워져 있었지만(KIDS_FASHION /
-- KIDS_GOODS) 코드가 한 번도 읽지 않았다. 이번 스프린트에서 검색 경로가 그 값을
-- 실제로 읽기 시작하면서(run-domestic-price-check.ts / domestic-price-sources/search)
-- 두 가지가 필요해졌다:
--   ① 여러 카테고리를 함께 파는 소스가 그 사실을 말할 수 있어야 한다.
--   ② "이 판매처가 어떤 종류의 판매처인가"를 우리가 코드가 아니라 카탈로그에서
--      읽을 수 있어야 한다(사이트 이름을 코드에 적지 않는다는 원칙).
--
-- ── 이 마이그레이션이 하지 않는 것 ──────────────────────────────────────────
-- 기존 값을 지우거나 뜻을 바꾸지 않는다. category_scope에서 KIDS_FASHION을 빼는
-- 행이 하나도 없다 — 전부 **추가**뿐이다. 과거 관측·과거 등록·과거 판단은 이
-- 마이그레이션 이후에도 정확히 같은 근거 위에 서 있다.
--
-- ── 코드는 이 마이그레이션 전에도 동작한다 ──────────────────────────────────
-- source_type은 nullable이고, domestic-price-source.ts의 Row 타입에서 optional로
-- 받는다(price-observations.ts의 isMissingColumnError / 032의 last_checked_at과
-- 같은 패턴). 실행 전에는 모든 소스의 source_type이 null이고, 그 값을 읽는 쪽은
-- 오늘 하나도 없다 — 표시용 메타데이터로만 쓴다.
-- category_scope 확장도 마찬가지다: 실행 전에는 아동 소스만 아동 카테고리에
-- 맞는 것으로 읽히고, 여성/잡화/라이프스타일 상품은 "⚪ 검색 데이터 없음"이 된다.
-- 그건 실패가 아니라 사실이다(맞는 판매처가 아직 카탈로그에 없다).

-- ① source_type — CEO 지시문의 네 축(SOURCE / CATEGORY FIT / MARKET / SOURCE TYPE)
--    중 유일하게 표현할 자리가 없던 축. MARKET은 이 테이블 자체가 한국(KRW 전용,
--    029 주석)이라 이미 정해져 있고, comparison_shops는 country 컬럼이 그 역할을
--    한다. collection_strategy(수집 가능 여부)와 섞지 않는다 — "어떤 판매처인가"와
--    "긁을 수 있는가"는 다른 사실이다.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'domestic_price_sources' and column_name = 'source_type'
  ) then
    alter table domestic_price_sources
      add column source_type text
        check (source_type is null or source_type in ('MARKETPLACE', 'RETAILER', 'VERTICAL', 'GLOBAL'));
  end if;
end $$;

-- ② 이미 조사된 사실을 그대로 적는다(추정하지 않는다). 아래 분류는 030/032/034/035
--    마이그레이션 주석에 이미 적혀 있던 조사 결과를 옮긴 것이다:
--      MARKETPLACE  여러 판매자가 입점하는 오픈마켓/종합몰(쿠팡·무신사·29CM·W컨셉·SSF)
--      RETAILER     자기 상품을 파는 소매몰(편집샵 대부분)
--      VERTICAL     특정 카테고리 전문(키디키디 = 유아동 전문)
--      GLOBAL       브랜드 공식 글로벌 스토어의 한국 채널(보보쇼즈 공식)
update domestic_price_sources set source_type = 'MARKETPLACE'
  where source_type is null and domain in ('coupang.com', 'ssfshop.com', 'musinsa.com', '29cm.co.kr', 'wconcept.co.kr');
update domestic_price_sources set source_type = 'VERTICAL'
  where source_type is null and domain in ('kidikidi.elandmall.co.kr');
update domestic_price_sources set source_type = 'GLOBAL'
  where source_type is null and domain in ('bobochoses.com');
update domestic_price_sources set source_type = 'RETAILER' where source_type is null;

-- ③ CATEGORY FIT 확장 — 한 소스가 여러 카테고리에 맞을 수 있다.
--
--    아래 다섯 곳은 아동 전문 편집샵이 아니라 종합몰/멀티 카테고리 플랫폼이다
--    (032 주석: 무신사 "키즈"는 musinsa.com/main/kids 한 갈래일 뿐이고, W컨셉은
--    애초에 여성 패션이 본류다 — 아동 소스로만 등록돼 있던 것 자체가 이 저장소가
--    아동 하나로 출발했다는 흔적이다). KIDS_FASHION을 빼지 않고 더하기만 한다.
update domestic_price_sources
   set category_scope = array(select distinct unnest(category_scope || array['WOMEN_FASHION', 'FASHION_ACCESSORIES']))
 where domain in ('ssfshop.com', 'musinsa.com', '29cm.co.kr', 'wconcept.co.kr');

--    쿠팡은 위 넷에 더해 라이프스타일까지 판다(034에서 "국내 최대 오픈마켓"으로
--    등록된 그대로다).
update domestic_price_sources
   set category_scope = array(select distinct unnest(category_scope || array['WOMEN_FASHION', 'FASHION_ACCESSORIES', 'HOME_LIFESTYLE']))
 where domain in ('coupang.com');

-- ④ 새 카테고리 전용 편집샵은 이 마이그레이션에서 넣지 않는다.
--    실제로 열어보고 robots.txt와 검색 경로를 확인한 사이트만 카탈로그에 넣는
--    것이 029~035가 지켜 온 규칙이고(조사 없이 넣으면 MANUAL 소스만 늘어나
--    "검색은 했는데 결과가 없다"는 잘못된 사실을 만든다), 이번 스프린트는 그
--    조사를 하지 않았다. 여성/잡화/라이프스타일 전문 편집샵은 관리자가
--    Settings에서 추가하거나 다음 조사 마이그레이션에서 seed한다 —
--    그때까지 화면은 "⚪ 검색 데이터 없음"이라고 정직하게 말한다.
