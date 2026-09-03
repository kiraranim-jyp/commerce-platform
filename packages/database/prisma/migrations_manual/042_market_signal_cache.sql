-- P-29 Sprint 7(CPO 지시, 2026-09-03) — "국내 시장 신호" 중 검색 관심(Naver
-- DataLab 검색어트렌드)은 유일하게 외부 유료/쿼터 제한 API 호출이 필요한
-- 신호다(월 50,000회 무료 한도, 대표님 확보). Vercel 서버리스 함수는
-- 요청마다 새 프로세스라 인메모리 캐시가 불가능하므로, 브랜드 단위로 최소
-- TTL(7일, market-signals.ts의 SEARCH_INTEREST_CACHE_TTL_MS)만큼 캐싱해
-- 같은 브랜드 상품을 반복 조회해도 API를 매번 새로 부르지 않는다 — 브랜드당
-- 주 1회 정도면 "검색 관심이 높다/보통이다" 수준의 신호로는 충분하고, 상품
-- 단위가 아니라 브랜드 단위 캐시라 여러 상품이 같은 캐시를 공유해 호출
-- 수가 크게 줄어든다.
create table if not exists market_signal_cache (
  id uuid primary key default gen_random_uuid(),
  -- 지금은 SEARCH_INTEREST 하나뿐이지만, 추후 다른 외부-호출 신호가 생길
  -- 경우를 대비해 종류를 구분해 둔다(새 판정 로직 아님, 저장 키 구분용).
  signal_type text not null check (signal_type in ('SEARCH_INTEREST')),
  -- 정규화된 브랜드명(소문자, trim) — market-signals.ts의 normalizeBrandKey()와
  -- 반드시 동일한 정규화 규칙을 써야 캐시가 맞물린다.
  cache_key text not null,
  value_json jsonb not null,
  fetched_at timestamptz not null default now()
);

create unique index if not exists market_signal_cache_unique_idx
  on market_signal_cache (signal_type, cache_key);
create index if not exists market_signal_cache_fetched_at_idx
  on market_signal_cache (fetched_at);

alter table market_signal_cache enable row level security;
