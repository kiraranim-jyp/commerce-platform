-- 모든 LIVE 등록 시도(성공/실패 둘 다) 자동 기록 — 사용자가 "문의하기"를 누르지
-- 않아도 관리자 대시보드가 "오늘 등록 18건, 성공 15건, 실패 3건"을 정확히 셀 수
-- 있게 한다. support_inquiries는 사용자가 직접 제출한 것만 있어서 전체 시도
-- 횟수를 대표하지 못한다 — 이 테이블이 그 갭을 메운다.
create table if not exists registration_attempts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  status text not null check (status in ('SUBMITTED', 'FAILED')),
  error_code text,
  trace_id text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists registration_attempts_created_at_idx on registration_attempts (created_at desc);
create index if not exists registration_attempts_error_code_idx on registration_attempts (error_code);

alter table registration_attempts enable row level security;
