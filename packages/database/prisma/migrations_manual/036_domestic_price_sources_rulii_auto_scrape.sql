-- N-4.18-C STEP4(대표님 지시: "국내 편집샵 검색 — 실제 파서 확장") — RULII(루리샵)에
-- 실제 검색/가격 파서(packages/crawler/src/comparison-search/rulii.ts)를 구현하고
-- 실측(curl+tsx)으로 검증했다(에밀에이다 데님 자수 청바지 검색 → 실제 후보 2건,
-- 상세 페이지 가격 재조회까지 확인). 이제 collection_strategy를 MANUAL에서
-- AUTO_SCRAPE로 바꿔 searchOneDomesticShop이 이 소스를 실제로 검색하게 한다.
update domestic_price_sources
  set collection_strategy = 'AUTO_SCRAPE'
  where domain = 'rulii.co.kr';
