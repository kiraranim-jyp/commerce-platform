-- 등록 실패 문의(진단 번들) 저장소 — 001과 같은 이유로 Supabase 대시보드의 SQL
-- Editor에서 이 파일 내용을 그대로 한 번 실행해주면 된다.
--
-- 이 테이블은 "고객 지원"용이 아니라 운영 개선용 데이터 수집이 목적이다 —
-- ErrorCode별 발생 빈도를 관리자 화면에서 집계해서 다음에 무엇을 고쳐야 할지
-- 판단하는 데 쓴다.
create table if not exists support_inquiries (
  id uuid primary key default gen_random_uuid(),
  error_code text,
  error_message text not null,
  trace_id text,
  url text,
  platform text,
  site text,
  app_version text,
  occurred_at timestamptz not null,
  user_note text,
  step_log jsonb,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
  created_at timestamptz not null default now()
);

-- ErrorCode별 집계(관리자 대시보드의 "오늘 IMG001 15건" 뷰)가 자주 이 컬럼으로
-- 필터/그룹핑하므로 인덱스를 걸어둔다.
create index if not exists support_inquiries_error_code_idx on support_inquiries (error_code);
create index if not exists support_inquiries_created_at_idx on support_inquiries (created_at desc);

-- service_role 키로만 접근한다(서버 라우트 전용) — anon 키로는 아무것도 못 읽고
-- 못 쓰게 RLS를 켜고 정책을 아예 만들지 않는다.
alter table support_inquiries enable row level security;
