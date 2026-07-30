-- P1-1 Epic 4(Brand Dictionary) — 다음 스프린트에서 실제로 캐시로 쓸 스키마를
-- 미리 준비만 해둔다(이번 스프린트에서는 아직 코드에서 조회/기록하지 않는다).
-- 목적: 같은 브랜드 원본 문자열을 매번 쿠팡 Brand Search API로 다시 조회하지
-- 않고, 한 번 확인된 매칭 결과를 재사용해서 API 호출 횟수와 지연을 줄인다.
--
-- CPO 지정 컬럼 구조: raw_brand → clean_brand → brand_id → verified_at → source.
-- raw_brand를 키로 둔다(정제 전 원본 문자열 그대로, 1행 = 1개의 실제로 관측된
-- 원본 문자열) — "Bobo Choses SS26 Sale"과 "Bobo Choses AW25 Sale"은 clean_brand는
-- 둘 다 "Bobo Choses"로 같아도 raw_brand는 다른 행으로 남는다. 이러면 나중에
-- "이 원본 문자열은 이미 본 적 있다 → 정제 규칙 다시 안 돌려도 된다"는 캐시로도
-- 쓸 수 있고, clean_brand 기준으로 group by 하면 brand_id 매칭 결과도 재사용
-- 가능하다.
create table if not exists brand_dictionary (
  id uuid primary key default gen_random_uuid(),
  -- 정제 전 원본 브랜드 문자열(예: "Bobo Choses SS26 Baby 50% Off Sale").
  raw_brand text not null,
  -- Brand Resolver가 정제한 결과(예: "Bobo Choses"). 규칙에 안 걸렸으면
  -- raw_brand와 동일한 값을 그대로 넣는다(정제 여부 자체는 raw_brand=clean_brand
  -- 비교로 알 수 있어 별도 컬럼을 두지 않는다).
  clean_brand text not null,
  -- 쿠팡 Brand Search API가 반환한 brandId. 아직 매칭 못 했으면 null —
  -- "매칭 시도했지만 실패"와 "아직 시도 안 함"을 구분하려면 last_verified_at이
  -- null인지로 판단한다(시도했으면 항상 채워진다).
  brand_id text,
  brand_name_kr text,
  -- 이 매칭이 어디서 나왔는지: 'brand_search_api'(쿠팡 API 실시간 조회로 얻음) |
  -- 'manual'(운영자가 직접 확인/수정) | 'unresolved'(API가 매칭 실패해서 아직
  -- brand_id가 없음).
  source text not null default 'unresolved',
  verified_at timestamptz,
  hit_count integer not null default 1,
  created_at timestamptz not null default now()
);

create unique index if not exists brand_dictionary_raw_brand_idx
  on brand_dictionary (lower(trim(raw_brand)));

-- clean_brand 기준으로 이미 확인된 brand_id가 있는지 빠르게 찾기 위한 인덱스
-- (raw_brand가 처음 보는 문자열이어도 정제 결과가 같으면 재사용 가능하므로).
create index if not exists brand_dictionary_clean_brand_idx
  on brand_dictionary (lower(trim(clean_brand)));
