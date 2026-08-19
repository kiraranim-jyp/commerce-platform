-- Sprint B-1(CPO 지시: "최근 작업마다 사람이 읽을 수 있는 작업번호 부여 —
-- JOB-260819-001, URL 분석→스냅샷→카테고리/가격/옵션→등록 시도까지 동일
-- Job Key로 추적") — Job(전체 생명주기)은 product_snapshots에 붙이고,
-- registration_attempts(플랫폼별 개별 등록 시도)에는 검색 편의를 위해 같은
-- 값을 복제만 한다(FK로 다시 만들지 않는다 — snapshot_id가 이미 그 구조적
-- 연결이다, CPO 지시: "Job은 작업의 전체 생명주기이고 registration attempt는
-- 그 안에서 발생한 플랫폼별 실제 등록 시도다, 섞지 않는다").
--
-- 번호(NNN)는 날짜(KST)별로 1부터 증가한다. 동시 요청에서도 중복이 나오면
-- 안 되므로 애플리케이션 레벨 SELECT COUNT+1이 아니라 Postgres
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING으로 원자적으로 채번한다.
create table if not exists job_key_sequences (
  date_key text primary key,
  counter integer not null default 0
);
alter table job_key_sequences enable row level security;

create or replace function next_job_key_counter(p_date_key text)
returns integer
language plpgsql
as $$
declare
  v_counter integer;
begin
  insert into job_key_sequences (date_key, counter)
  values (p_date_key, 1)
  on conflict (date_key) do update set counter = job_key_sequences.counter + 1
  returning counter into v_counter;
  return v_counter;
end;
$$;

alter table product_snapshots add column if not exists job_key text;
create unique index if not exists product_snapshots_job_key_idx on product_snapshots (job_key);

alter table registration_attempts add column if not exists job_key text;
create index if not exists registration_attempts_job_key_idx on registration_attempts (job_key);

alter table support_inquiries add column if not exists job_key text;
create index if not exists support_inquiries_job_key_idx on support_inquiries (job_key);

-- CPO 지시 다이어그램의 "validation" 단계 — KC 셀러 확인 기록도 같은 Job의
-- 생애주기 일부다.
alter table seller_compliance_confirmations add column if not exists job_key text;
create index if not exists seller_compliance_confirmations_job_key_idx on seller_compliance_confirmations (job_key);
