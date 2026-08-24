-- N-4.18-B(대표님 지시: "국내 최저가 검색이 아니라 수입 키즈 전문 편집샵
-- 가격비교로 재정의") — Primary Source를 종합 오픈마켓/대형 패션 플랫폼에서
-- 수입 키즈 전문 편집샵 중심으로 바꾼다.
--
-- 추가 7곳은 전부 실제 WebSearch + robots.txt 실측으로 확인했다(추정 아님):
--   RULII(rulii.co.kr), CHOCO.EL(chocoel.co.kr), KARYMARKET(karymarket.com —
--   대표님이 "카리마켓/KARI MARKET"이라 쓰셨지만 실제 상호/도메인은
--   "캐리마켓(KARYMARKET)"이다), NOKIMORE(nokimore.com — 다만 실제 취급
--   품목은 의류가 아니라 북유럽 육아용품/장난감 위주로 확인돼 category_scope에
--   KIDS_GOODS를 KIDS_FASHION과 함께 넣는다), DEUXBEBE(deuxbebe.com),
--   COCO & JENNIE(coconjennie.com), CHOUCHOU ENFANT(chouchouenfant.kr —
--   Bobo Choses를 실제로 취급한다고 확인됨). 전부 robots.txt가 User-agent: *
--   에 상품/검색 경로를 막지 않아(Cafe24 계열 표준 패턴, LOOXLOO와 동일)
--   자동수집 시도 자체는 가능해 보이지만, 실제 검색 URL 구조는 아직 조사
--   전이라 추정으로 AUTO_SCRAPE 표시하지 않는다 — MANUAL로 시작한다
--   (029/030 seed 때와 같은 원칙, "실제 취급 여부/검색 구조가 불확실한 채로
--   AUTO 처리하지 않는다").
--
-- "LITTLE DEBBIE"는 이번 조사에서 실제 도메인을 특정하지 못했다 — 동명의
-- 미국 스낵 브랜드(littledebbie.com)만 확인되고, 국내 키즈 편집샵 중 정확히
-- 이 이름과 일치하는 곳을 찾지 못했다(가장 비슷한 "리틀뎁"/"LITTLE LUNA"는
-- 다른 상호라 임의로 대체하지 않는다). 이번 마이그레이션에 포함하지 않는다 —
-- 대표님 확인 후 정확한 도메인이 나오면 별도로 추가한다.
insert into domestic_price_sources (name, domain, url, currency, category_scope, priority, collection_strategy, status, source, enabled)
values
  ('RULII(루리샵)', 'rulii.co.kr', 'https://rulii.co.kr', 'KRW', array['KIDS_FASHION'], 'P0', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('CHOCO.EL(초코엘)', 'chocoel.co.kr', 'https://www.chocoel.co.kr', 'KRW', array['KIDS_FASHION'], 'P0', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('KARYMARKET(캐리마켓)', 'karymarket.com', 'https://karymarket.com', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('NOKIMORE(노키모어)', 'nokimore.com', 'https://nokimore.com', 'KRW', array['KIDS_FASHION', 'KIDS_GOODS'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('DEUXBEBE(듀베베)', 'deuxbebe.com', 'https://deuxbebe.com', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('COCO & JENNIE(코코앤제니)', 'coconjennie.com', 'https://coconjennie.com', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('CHOUCHOU ENFANT(슈슈앙팡)', 'chouchouenfant.kr', 'https://chouchouenfant.kr', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true)
on conflict (domain) do nothing;

-- 포레포레는 032에서 이미 P1/MANUAL로 seed돼 있다 — 이번 지시로 P0(핵심
-- 비교군)로 승격한다(신규 insert 아님, 기존 행 업데이트).
update domestic_price_sources set priority = 'P0' where domain = 'foretforet.com';

-- 대형 커머스/종합 오픈마켓 계열은 SYSTEM 행이라 삭제하지 않고 비활성화만
-- 한다(comparison_shops/기존 domestic_price_sources와 동일 원칙). 034가 아직
-- 실행 안 됐을 수도 있어 coupang.com도 같이 걸어둔다(행이 없으면 0건 영향,
-- 나중에 034가 실행돼도 곧바로 꺼진 채로 시작한다).
update domestic_price_sources
  set enabled = false
  where domain in ('ssfshop.com', '29cm.co.kr', 'musinsa.com', 'wconcept.co.kr', 'coupang.com');
