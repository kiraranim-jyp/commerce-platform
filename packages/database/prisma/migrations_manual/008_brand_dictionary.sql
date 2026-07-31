-- P1-1 Epic 4(Brand Dictionary) — 다음 스프린트에서 실제로 캐시로 쓸 스키마를
-- 미리 준비만 해둔다(이번 스프린트에서는 아직 코드에서 조회/기록하지 않는다).
-- 목적: 같은 브랜드 원본 문자열을 매번 쿠팡 Brand Search API로 다시 조회하지
-- 않고, 한 번 확인된 매칭 결과를 재사용해서 API 호출 횟수와 지연을 줄인다.
--
-- CPO 지정 컬럼 구조(재설계본, 이전 초안을 대체): raw_brand / cleaned_brand /
-- brand_id / platform / country / confidence / rule_applied / verified /
-- created_at / updated_at. 이전 초안(brand_name_kr/source/hit_count 컬럼)은
-- 이 스펙으로 대체됐다 — 브랜드 한글명은 브랜드 검색 시점에 다시 조회하면
-- 되는 파생값이라 캐시 키에 넣지 않는다.
create table if not exists brand_dictionary (
  id uuid primary key default gen_random_uuid(),
  -- 정제 전 원본 브랜드 문자열(예: "Bobo Choses SS26 Baby 50% Off Sale").
  raw_brand text not null,
  -- brand-resolver.ts가 정제한 결과(예: "Bobo Choses"). 규칙에 안 걸렸으면
  -- raw_brand와 동일한 값을 그대로 넣는다(정제 여부 자체는 raw_brand=cleaned_brand
  -- 비교로 알 수 있어 별도 boolean 컬럼을 두지 않는다).
  cleaned_brand text not null,
  -- 쿠팡 Brand Search API가 반환한 brandId. 아직 매칭 못 했으면 null —
  -- "매칭 시도했지만 실패"와 "아직 시도 안 함"은 verified로 구분한다.
  brand_id text,
  -- 같은 raw_brand라도 플랫폼마다 브랜드 코드 체계가 다르다(쿠팡/스마트스토어/
  -- 11번가) — 캐시 키의 일부다. 지금은 'coupang'만 채워진다.
  platform text not null,
  -- 소싱 국가(ISO 2자리 등) — 같은 브랜드라도 국가별로 정식 유통사/브랜드
  -- 코드가 갈릴 수 있어 참고 컬럼으로 둔다. 크롤링 시점에 항상 알 수 있는
  -- 값이 아니라 nullable이다.
  country text,
  -- brand-resolver.ts의 BrandResolverConfidence("HIGH"|"LOW")를 그대로 저장한다.
  confidence text,
  -- brand-resolver.ts의 ruleApplied(예: {SEASON_CODE, MARKETING_SUFFIX})를
  -- 그대로 저장 — 이 캐시 행의 정제가 어떤 규칙으로 나왔는지 재구성할 수 있다.
  rule_applied text[] not null default '{}',
  -- CPO 명시 요구사항: "verified 컬럼은 꼭 필요합니다" — brand_id가 채워져
  -- 있어도 그게 실제 Brand Search API 실시간 조회로 막 확인된 건지, 오래된
  -- 캐시값을 그냥 재사용한 건지 구분하는 명시적 플래그. 사람이 수동으로
  -- 확인했을 때도 true로 둔다.
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 같은 원본 문자열이 같은 플랫폼에서 이미 캐시됐는지 조회하는 게 이 테이블의
-- 핵심 쿼리 패턴이다.
create unique index if not exists brand_dictionary_raw_brand_platform_idx
  on brand_dictionary (lower(trim(raw_brand)), platform);

-- cleaned_brand 기준으로 이미 확인된 brand_id가 있는지 빠르게 찾기 위한 인덱스
-- (raw_brand가 처음 보는 문자열이어도 정제 결과가 같으면 재사용 가능하므로).
create index if not exists brand_dictionary_cleaned_brand_idx
  on brand_dictionary (lower(trim(cleaned_brand)), platform);
