-- N-4.18-C STEP4(대표님 지시 연속: "국내 편집샵 검색 — 실제 파서 확장") —
-- DEUXBEBE(듀베베)에 실제 검색/가격 파서(packages/crawler/src/comparison-search/
-- deuxbebe.ts)를 구현하고 실측(curl+tsx)으로 검증했다(멀티브랜드 편집샵 — "데님"
-- 검색 → 실제 후보 5건, 브랜드별 정상 매칭(Sissel/MSGM/TINY COTTONS), 할인가/
-- 정가 구분 파싱 버그를 tsx 실측 검증 중 발견해 즉시 수정, 상세 페이지 가격
-- 재조회까지 확인). collection_strategy를 MANUAL에서 AUTO_SCRAPE로 바꿔
-- searchOneDomesticShop이 이 소스를 실제로 검색하게 한다.
update domestic_price_sources
  set collection_strategy = 'AUTO_SCRAPE'
  where domain = 'deuxbebe.com';
