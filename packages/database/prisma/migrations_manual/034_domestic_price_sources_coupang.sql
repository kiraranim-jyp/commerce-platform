-- N-4.11 STEP1(대표님 지시: "쿠팡/네이버쇼핑 등을 대상으로 자동수집가능/자동검색가능/
-- 수동검색/차단/미지원으로 정확히 분류") — 실제 조사 결과(2026-08-24, WebFetch로
-- 직접 확인, 추정 아님):
--
--   쿠팡(coupang.com) — 검색 페이지(/np/search)뿐 아니라 robots.txt 자체도
--     HTTP 403으로 막혀 있다(엣지/WAF 레벨 차단으로 보임 — 특정 경로 정책이
--     아니라 이 조사 도구의 요청 자체를 거부). "차단"으로 분류 — MANUAL로
--     시작한다(사람이 Wing/쿠팡 앱에서 직접 확인하는 건 여전히 가능하지만
--     자동 수집은 이 방식으로는 불가능하다는 뜻).
--
--   네이버쇼핑 — 이미 packages/pricing/src/domestic-price/naver-shopping-search.ts로
--     Naver Open API(openapi.naver.com/v1/search/shop.json)를 통해 자동 검색이
--     구현/운영 중이다(N-4.06, PRICE_OBSERVATION_SOURCES의 NAVER_SHOPPING).
--     domestic_price_sources 테이블에 별도 행을 추가하지 않는다 — 이 테이블은
--     "사전 등록 편집샵"(동일상품 검증 후 수집) 모델이고, 네이버쇼핑은 검증
--     없는 검색 후보(SECONDARY tier)라는 다른 계약이라 같은 테이블에 섞으면
--     tier 구분이 흐려진다(price-history.ts 기존 주석과 같은 이유).
--
-- 무신사/29CM/W컨셉/SSF/포레포레/키디키디는 032에서 이미 조사·seed 완료 —
-- 이번 조사에서 재확인했고 결론이 바뀌지 않아 다시 insert하지 않는다.
insert into domestic_price_sources (name, domain, url, currency, category_scope, priority, collection_strategy, status, source, enabled)
values
  ('쿠팡', 'coupang.com', 'https://www.coupang.com', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true)
on conflict (domain) do nothing;
