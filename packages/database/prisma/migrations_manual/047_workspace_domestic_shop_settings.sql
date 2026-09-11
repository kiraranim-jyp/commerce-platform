-- GLOBAL-MARKET ③-2(CPO 확정, 2026-09-11) — 국내 편집샵 목록을 "공용 카탈로그"와
-- "판매자별 ON/OFF"로 분리한다.
--
-- 고치는 버그: domestic_price_sources.enabled는 전역 플래그 하나뿐이다. 한
-- 판매자가 편집샵 하나를 끄면 그 순간 모든 판매자의 목록에서 사라진다. 지금은
-- 실사용자가 대표님 한 명뿐이라 겉으로 드러난 적이 없지만, 구조상 이미 틀렸다 —
-- 두 번째 판매자가 생기는 날 바로 사고가 된다.
--
-- 왜 새 카탈로그 테이블을 만들지 않는가(CPO 지시): domestic_price_sources.id는
-- 이미 price_observations.source_ref_id(029)와 domestic_product_links.source_id(029)가
-- FK로 참조한다. 행을 새 테이블로 옮기면 지금까지 쌓인 관측치와 동일상품 링크의
-- 근거가 통째로 끊긴다. 그래서 이 테이블은 "공용 카탈로그"로 그대로 두고,
-- 판매자별 선택만 아래 새 테이블로 뺀다.
--
-- 이후 두 enabled의 뜻(섞으면 안 된다):
--   domestic_price_sources.enabled            = 운영자가 이 편집샵을 서비스에서
--                                               내렸다(전역 kill switch)
--   workspace_domestic_shop_settings.enabled  = 이 판매자가 자기 목록에서 쓴다/안 쓴다
--
-- 실효 노출 = 카탈로그 enabled AND (설정 행 없음 OR 설정 enabled).
-- "설정 행 없음 = ON"인 이유(CPO 결정): 카탈로그에 편집샵이 하나 추가되면 기존
-- 판매자에게도 기본으로 보여야 한다. 반대로 하면(행 없음 = OFF) 새 편집샵을
-- 등록해도 아무에게도 안 보이고, 왜 안 보이는지 아무도 모른다.
--
-- ────────────────────────────────────────────────────────────────────────
-- 실행 전 반드시 읽을 것
-- ────────────────────────────────────────────────────────────────────────
-- 이 저장소에는 마이그레이션 러너가 없다 — Supabase 콘솔 SQL Editor에서 사람이
-- 직접 실행한다(043 주석과 동일).
--
-- 전체가 하나의 트랜잭션이다. 재실행해도 안전하다(테이블은 if not exists,
-- seeding은 on conflict do nothing).
--
-- 선행 조건: 043(workspaces / workspace_members)이 이미 실행돼 있어야 한다.
-- ────────────────────────────────────────────────────────────────────────

begin;

-- 1) 판매자별 ON/OFF ────────────────────────────────────────────────────
create table if not exists workspace_domestic_shop_settings (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- 카탈로그에서 편집샵이 사라지면 그 편집샵에 대한 판매자 설정도 의미가 없다.
  source_id uuid not null references domestic_price_sources(id) on delete cascade,
  -- 행이 존재한다는 것 자체가 "판매자가 명시적으로 정했다"는 뜻이다. 기본값이
  -- true인 이유: UI가 껐다 켰다를 반복해도 행이 남아 있는 게 정상이고, 그때
  -- "켬"은 행 삭제가 아니라 enabled=true 갱신이어야 upsert 한 줄로 끝난다.
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 한 워크스페이스가 같은 편집샵에 대해 설정을 두 개 가질 수 없다. 코드의
  -- upsert(on conflict)가 기대는 제약이 바로 이것이다.
  primary key (workspace_id, source_id)
);

-- 카탈로그 행을 지울 때(USER 편집샵 삭제) cascade가 이 테이블을 source_id로
-- 훑는다 — PK는 workspace_id가 선두라 그 조회에 쓰이지 않는다.
create index if not exists workspace_domestic_shop_settings_source_id_idx
  on workspace_domestic_shop_settings (source_id);

-- RLS는 켜되 정책은 만들지 않는다 = service role 전용. domestic_price_sources
-- (029), domestic_product_links(029), workspaces(043)와 동일한 기존 패턴이다 —
-- 이 테이블은 서버 라우트가 requireUser()로 판정한 workspaceId로만 접근한다.
alter table workspace_domestic_shop_settings enable row level security;

-- 2) 지금의 대표님 상태를 그대로 옮겨 심는다 ─────────────────────────────
-- 오늘 꺼져 있는 편집샵은 "운영자가 서비스에서 내린 것"이 아니라 "대표님이
-- 자기 목록에서 뺀 것"이다. 코드가 판매자별 설정을 보기 시작하는 순간,
-- 이 사실이 어디에도 남아 있지 않으면 꺼 뒀던 편집샵이 다시 켜진 것처럼
-- 보인다. 그래서 현재 enabled=false인 카탈로그 행을 모든 workspace의 설정에
-- enabled=false로 복사한다 — 마이그레이션을 돌린 날 화면이 달라지지 않는다.
--
-- 지금 해야 안전한 이유: 실사용자가 대표님 한 명이라 "모든 workspace"가 곧
-- "그 한 명"이다. 사용자가 늘어난 뒤에 이 작업을 하면, A가 꺼 둔 편집샵을
-- B·C의 설정에까지 꺼짐으로 밀어넣게 된다 — 그때는 누가 껐는지 알 방법이
-- 없으므로 복구 불가능한 오염이다. 반드시 두 번째 판매자가 생기기 전에 돈다.
--
-- 이미 설정 행이 있으면 건드리지 않는다(do nothing) — 재실행 시 판매자가
-- 그 사이에 직접 켠 것을 되돌리지 않기 위함이다.
insert into workspace_domestic_shop_settings (workspace_id, source_id, enabled)
select w.id, s.id, false
from workspaces w
cross join domestic_price_sources s
where s.enabled = false
on conflict (workspace_id, source_id) do nothing;

do $$
declare
  v_workspaces integer;
  v_disabled integer;
  v_seeded integer;
begin
  select count(*) into v_workspaces from workspaces;
  select count(*) into v_disabled from domestic_price_sources where enabled = false;
  select count(*) into v_seeded from workspace_domestic_shop_settings where enabled = false;
  raise notice 'GLOBAL-MARKET ③-2: workspace %개 · 현재 꺼진 카탈로그 %개 · 판매자 꺼짐 설정 %행',
    v_workspaces, v_disabled, v_seeded;
end $$;

commit;

-- ────────────────────────────────────────────────────────────────────────
-- (선택) 대표님이 껐던 편집샵을 다시 켤 수 있게 하려면
-- ────────────────────────────────────────────────────────────────────────
-- 위 seeding까지만 실행하면, 오늘 꺼져 있는 편집샵은 카탈로그에서도 꺼진 채로
-- 남는다(= 운영자가 서비스에서 내린 상태). 설정 화면의 체크박스는 이제
-- 판매자별 설정만 건드리므로, 그 편집샵은 화면에서 다시 켤 수 없다.
--
-- 그 편집샵들을 "운영자는 제공하지만 대표님이 안 쓰는 상태"로 정리하고 싶다면
-- 아래를 함께 실행한다. 실효 노출은 그대로다(카탈로그 ON + 판매자 OFF = 숨김) —
-- 화면상 보이는 결과는 달라지지 않고, 대표님이 다시 켤 수 있게만 된다.
-- 기존 카탈로그 행을 바꾸는 작업이라 이번 작업 범위에서 자동 실행하지 않는다.
--
--   update domestic_price_sources set enabled = true, updated_at = now()
--   where enabled = false;
