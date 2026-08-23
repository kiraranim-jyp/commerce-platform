-- N-4.07 2차(대표님 지시) — Part 1(편집숍 Master 확대) + Part 2(Source Master에
-- last_checked/last_success 운영 필드 추가).
--
-- 실제 조사 결과(2026-08-23, WebSearch+curl로 직접 확인, 추정 없음):
--
--   OCO(ocokorea.com) — 보보쇼즈 브랜드 페이지 실존 확인(검색 결과에 실제 URL).
--     단, 이번 세션에서 서버 curl로 직접 접속 시 연결 타임아웃(HTTP 000, 10초)이
--     반복됐다 — bot 차단인지 일시적 네트워크 문제인지 이번 조사로는 구분 불가.
--     구조 파악 실패 → MANUAL로 시작(자동화 여부 추정 안 함).
--
--   포레포레(foretforet.com) — 보보쇼즈 브랜드 페이지 실제 로드됨(HTTP 200,
--     130KB). robots.txt는 일반 크롤링을 허용(User-agent: * Allow: /). 다만
--     Makeshop 플랫폼의 실제 상품 목록 마크업 패턴을 이번 세션에서 확인하지
--     못했다(예상한 마크업 셀렉터가 실제 응답에 없었음) → MANUAL로 시작(마크업
--     구조를 별도로 조사해야 AUTO_SCRAPE 전환 가능).
--
--   무신사 키즈(musinsa.com/main/kids) — robots.txt를 실제로 열어본 결과 매우
--     구체적이다: ClaudeBot/GPTBot 등 명시된 AI 크롤러는 Allow, 나머지 전체는
--     "User-agent: * / Disallow: /"로 명시 차단. 이 프로젝트의 기존 스크래퍼
--     (fetchWithDomainRateLimit의 CHROME_UA)는 일반 브라우저로 위장하는 방식이라
--     이 사이트의 화이트리스트 정책과 맞지 않는다(허용된 봇 신원이 아닌 채로
--     Disallow 규칙을 우회하는 셈이 되어 이용정책 위반) → MANUAL로 시작. 나중에
--     실제 ClaudeBot User-Agent로 식별하는 별도 수집 경로를 만들면 재검토 가능.
--
--   29CM 키즈(29cm.co.kr) — robots.txt는 일반 크롤링 허용(Allow: /, 검색엔진
--     한정 차단만 있음). 다만 이번 세션에서 시도한 /search?q= 경로가 404여서
--     실제 검색 API 경로를 찾지 못했다 → MANUAL로 시작(엔드포인트 재조사 필요).
--
--   W컨셉(wconcept.co.kr) — robots.txt가 "Whitelist Only"로 명시돼 있고, 무신사와
--     같은 패턴(ClaudeBot 등 AI 크롤러만 명시 허용, 나머지 전체 차단)이다 →
--     MANUAL로 시작, 무신사와 같은 이유.
--
--   luksusbaby.kr — 검색 결과에 실제 보보쇼즈 상품이 다수 확인됐고 Shopify
--     플랫폼이라 기술적으로는 AUTO_API가 가능해 보였지만, /meta.json으로 실제
--     확인한 결과 country="DK"(덴마크), currency="USD"다 — .kr 도메인이지만
--     원화 표시가 아닌 해외 재판매 사이트였다. 이 테이블의 설계 원칙(주석 참고 —
--     domestic_price_sources는 항상 KRW 표시가, 통화가 다른 해외판매처는
--     comparison_shops의 역할)에 맞지 않아 이번 마이그레이션에는 포함하지
--     않는다(추가하려면 comparison_shops 쪽이 맞는 테이블이다).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'domestic_price_sources' and column_name = 'last_checked_at'
  ) then
    alter table domestic_price_sources add column last_checked_at timestamptz;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'domestic_price_sources' and column_name = 'last_success_at'
  ) then
    alter table domestic_price_sources add column last_success_at timestamptz;
  end if;
end $$;

insert into domestic_price_sources (name, domain, url, currency, category_scope, priority, collection_strategy, status, source, enabled)
values
  ('OCO(오씨오)', 'ocokorea.com', 'https://www.ocokorea.com', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('포레포레', 'foretforet.com', 'https://www.foretforet.com', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('무신사 키즈', 'musinsa.com', 'https://www.musinsa.com/main/kids', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('29CM 키즈', '29cm.co.kr', 'https://www.29cm.co.kr', 'KRW', array['KIDS_FASHION'], 'P1', 'MANUAL', 'ACTIVE', 'SYSTEM', true),
  ('W컨셉', 'wconcept.co.kr', 'https://www.wconcept.co.kr', 'KRW', array['KIDS_FASHION'], 'P2', 'MANUAL', 'ACTIVE', 'SYSTEM', true)
on conflict (domain) do nothing;
