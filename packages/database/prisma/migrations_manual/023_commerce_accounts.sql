-- N-3.13 R2 Part 12(CPO 지시, 2026-08-12 확정 — "더 이상 논의만 하지 않고
-- 구현 대상으로 확정한다") — Settings > 계정관리에서 네이버/쿠팡 각각 여러
-- 계정을 아코디언으로 추가/수정/삭제/연결테스트할 수 있어야 한다.
--
-- 안전조건(CPO 지시): 기존 단일 coupang_seller_settings/환경변수 구조를
-- 무리하게 깨지 않는다 — 이 테이블은 완전히 새로운 병행 저장소다. 실제
-- 등록 파이프라인이 어떤 계정을 쓸지 연결하는 배선은 이번 라운드 범위 밖
-- (DB schema → API → UI 까지가 이번 범위, "기존 register pipeline 연결"은
-- 다음 단계).
--
-- platform별로 쓰는 자격증명 필드가 다르다(Coupang: access/secret/vendor,
-- Naver: client_id/client_secret) — 하나의 테이블에 모두 넣고 안 쓰는 쪽은
-- null로 둔다(플랫폼마다 별도 테이블을 만들면 CRUD API/UI를 두 번 만들어야
-- 해서 중복이다).
create table if not exists commerce_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('naver', 'coupang')),
  label text not null,
  is_default boolean not null default false,
  -- Coupang 전용
  access_key text,
  secret_key text,
  vendor_id text,
  vendor_user_id text,
  -- Naver 전용
  client_id text,
  client_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commerce_accounts_platform_idx on commerce_accounts (platform);
