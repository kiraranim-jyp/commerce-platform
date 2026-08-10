-- Sprint B-0(CPO 지시, 2026-08-09) — 향후 가격 비교 기능(B-1+)의 기반. 이번
-- 스프린트는 "어떤 해외 편집샵을 비교 대상으로 쓸지 관리"만 한다 — 크롤링/파싱은
-- 다음 스프린트. 기존 테이블은 전혀 건드리지 않고 새 테이블 하나만 추가한다.
create table if not exists comparison_shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,
  url text not null,
  country text,
  currency text,
  source text not null default 'USER' check (source in ('SYSTEM', 'USER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comparison_shops_is_active_idx on comparison_shops (is_active);
alter table comparison_shops enable row level security;

-- 최소 seed — 정확도를 우선해 확실히 아는 해외 아동복 멀티브랜드 편집샵만 넣는다.
-- 전체 목록(15~30개)은 CEO 확인 후 채운다(이번 스프린트 완료 기준과 무관).
insert into comparison_shops (name, domain, url, country, currency, source, is_active)
values
  ('Melijoe', 'melijoe.com', 'https://www.melijoe.com', 'France', 'EUR', 'SYSTEM', true),
  ('Smallable', 'smallable.com', 'https://www.smallable.com', 'France', 'EUR', 'SYSTEM', true),
  ('Alex and Alexa', 'alexandalexa.com', 'https://www.alexandalexa.com', 'United Kingdom', 'GBP', 'SYSTEM', true),
  ('Childrensalon', 'childrensalon.com', 'https://www.childrensalon.com', 'United Kingdom', 'GBP', 'SYSTEM', true),
  ('Junior Edition', 'junioredition.com', 'https://www.junioredition.com', 'Hong Kong', 'HKD', 'SYSTEM', true),
  ('Kidsroom', 'kidsroom.de', 'https://www.kidsroom.de', 'Germany', 'EUR', 'SYSTEM', true)
on conflict (domain) do nothing;
