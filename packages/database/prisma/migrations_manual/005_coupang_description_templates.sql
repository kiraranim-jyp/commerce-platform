-- 상세설명 템플릿(Description Template) — 배송안내/교환/반품/구매대행 안내/A·S
-- 같이 상품마다 바뀌지 않는 고정 문구를 한 번만 등록해두고 재사용한다. AI(또는
-- 크롤러)는 상품소개/상품특징처럼 실제로 상품마다 다른 부분만 만들면 되고,
-- 최종 상세설명은 "AI 생성분 + 템플릿 고정 문구"를 합쳐서 만든다.
-- 001/002/004와 같은 이유로 Supabase 대시보드의 SQL Editor에서 한 번 실행해주면 된다.
create table if not exists coupang_description_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  shipping_info text,
  exchange_info text,
  return_info text,
  agent_buy_info text,
  as_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coupang_description_templates_is_default_idx on coupang_description_templates (is_default);

alter table coupang_description_templates enable row level security;
