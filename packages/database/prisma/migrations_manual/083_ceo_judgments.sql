-- ════════════════════════════════════════════════════════════════════════════
-- 083 — CEO Judgment (CPO 작업지시 2026-11-07 · **작성 승인 / 적용 보류**)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴🔴🔴 **이 파일은 CPO 검토 대기 상태다. 적용하지 않았다.**
--    CPO: 「migration 파일 작성은 승인합니다. **DB 적용은 아직 승인하지 않습니다.**」
--    이 저장소의 `migrations_manual` 은 **사람이 손으로** 적용한다.
--
-- ── 왜 `candidate_reviews` 에 칸을 더하지 않는가 (DB 실측 2026-11-07) ────────
--   ⒜ 🔴 `human_note` 가 **전건 0 행** 이다(SAME 22 · DIFFERENT 15 · SIMILAR 1 전부).
--      ⟹ 대표님 산문 근거는 테스트 fixture 에만 있고 **운영 DB 에는 없다**.
--   ⒝ 🔴 **버전·이력 칸이 0** 이다(`version`/`history`/`revision`/`prev`/`superseded`
--      이름으로 하나도 없음). ⟹ 판단이 바뀌면 **덮여서 뒤집힘이 안 보인다**.
--   ⒞ 🔴 같은 후보 URL 에 행이 **최대 39개** 다(부분 유니크가 둘이라 snapshot 축과
--      origin 축으로 쪼개진다). ⟹ 그 중 어느 `id` 에 CEO 판단을 매달지 고를 근거가
--      **없다** — FK 를 걸면 한 판단이 여러 행으로 흩어진다.
--   ⒟ 🟢 그리고 `candidate_reviews` 를 가리키는 FK 는 현재 **0개** 다(실측) ⟹
--      새 표가 그것을 참조해도 순환은 없지만, ⒞ 때문에 **참조하지 않는다**.
--
--   ⟹ 🟢 **CEO 판단은 별도 표에 두고 `candidate_reviews` 와는 «URL 키로 조회만» 잇는다.**
--      기존 표의 칸·데이터는 **한 글자도 바뀌지 않는다**(CPO 조건).
--
-- ── 🔴🔴 UPDATE 로 덮지 않는다 — 새 버전을 «추가» 한다 ───────────────────────
--   실측 근거: `villagekids.co.uk/products/pale-blue-3d-logo-t-shirt` 에
--   `human_verdict` 가 **DIFFERENT 와 SAME 둘 다** 실재한다. 그리고 C06 은
--   **DIFFERENT → SAME** 으로 뒤집힌 쌍이다. ⟹ 과거 판단을 소거하면 그 이력이 사라지고,
--   「과거 판단으로 자동 차단」이 **되돌릴 수 없는 오류** 가 된다(CPO 가 금지한 그 모양).
--   그래서 UNIQUE 가 `(review_key, pair_id, version)` 이고 `supersedes_id` 로 잇는다.
--
-- ── 🔴 다섯 상태를 «섞지 않는다» (CPO 명시) ────────────────────────────────
--   축 행이 **없음**      → 미입력(대표님이 그 축을 고르지 않았다)
--   state = UNKNOWN      → **검토했으나 확인 불가**
--   state = MATCH        → 그 축 일치
--   state = MISMATCH     → 그 축 불일치
--   state = NOT_APPLICABLE → 그 축 적용 불가
--   ⟹ 🔴 「미입력」을 UNKNOWN 으로 바꿔 적으면 **관측하지 않은 사실이 DB 에 들어간다**.
--      그래서 축은 **별도 행** 이다(0개 축이어도 판단이 저장된다).
--
-- ── 🔴 `decision_context` 는 «상품 속성 축이 아니다» (CPO 결정 ③) ───────────
--   S1-6 에서 대표님이 적은 것 — 「반팔과 긴팔차이라 다른제품이다 **하지만, 이제품은
--   유사상품으로 분류가 되어도 문제되지 않는다**」. 뒤의 문장은 **분류 정책** 이고
--   동일상품 판정 축이 아니다. 🔴 그것을 축으로 만들면 **8개 CLOSED 축이 늘어난다**.
--   ⟹ 🟢 `ceo_judgments.decision_context` 에 따로 둔다. 🔴 그 값으로 verdict 를
--      바꾸지 않는다(S1-6 은 DIFFERENT 그대로다).
--
-- ── 🔴 이 migration 이 «하지 않는» 것 ──────────────────────────────────────
--   · 기존 `candidate_reviews` 의 칸 삭제·변경·데이터 이관 **0**
--   · 기존 GT / `SAME05_BASELINE` 에 영향 **0**
--   · MI 판정 · 가격 자격 · 검색 범위 · 알림에 연결 **0**
--     (🔴 사람 판단으로 자동 차단하지 않는다 — CPO 불승인)
--   · 기존 11쌍 적재 **0**(CPO: 이관 명세 선행 · `GT_IMPORT` 는 별도 승인)
--
-- ── 독립성·문법 검증 (CPO 요구 4항 + 문법 · 적용 «전» 실측 2026-11-07) ──────
--   ① 083 이 참조하는 모든 객체가 DB 에 있는가
--        `product_snapshots` 표 🟢 1 · `gen_random_uuid()` 함수 🟢 존재 ·
--        `ceo_judgments` 자기참조(같은 파일 안에서 만든다) 🟢
--        ⟹ 🟢 **PASS**
--   ② 078·081 산출물을 083 이 참조하는가 → 🟢 **참조 0**(083 의 외부 참조는
--        `product_snapshots` 하나다 · grep 전수)  ⟹ 🟢 **PASS**
--   ③ 078·081 을 나중에 적용해도 충돌하는가
--        🔴🔴 **질문이 성립하지 않는다 — 둘 다 «이미 적용돼 있다»**(실측).
--        🔴 내 1차 보고(「078·081 미적용」)가 **틀렸다.** 원인은 **파일 이름으로 산출물을
--           추측** 한 것이다 — `078` 은 `commerce_egress_events` 가 아니라
--           **`commerce_egress_log`** + `seller_settings.egress_provider` 를 만들고,
--           `081` 은 `analysis_state` 가 아니라 **`price_status`·`sold_out`·`match_reasons`** 를
--           만든다. 실측: 그 다섯 객체가 **전부 DB 에 있다**.  ⟹ 🟢 **PASS**
--   ④ 역순 적용이 필요한가 → 🟢 **필요 없다**(078·081 적용됨) ⟹ 083 은 **순서대로 다음** 이다
--   ⑤ 표·인덱스 이름 충돌 → 🟢 **0행**(`ceo_judgment%` 전수)
--   ⑥ 🟢🟢 **SQL 문법 PASS** — `scripts/083-syntax-dryrun.mjs`(트랜잭션 실행 → **ROLLBACK**)
--        12문장 전부 실행 · 트랜잭션 «안» 표 **2** · 롤백 후 표 **0**(적용 0 의 증거)
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── ① CEO 전체 판단 기록 ───────────────────────────────────────────────────
create table if not exists ceo_judgments (
  id              uuid primary key default gen_random_uuid(),

  -- 어느 조서에서 온 판단인가(예: 'CEO-EVIDENCE-REVIEW'). 🔴 출처를 지우지 않는다.
  review_key      text        not null,
  -- 쌍 식별자(예: 'C42' · 'S1-6'). 🔴 조서 안에서의 이름이고 DB 키가 아니다.
  pair_id         text        not null,

  -- 🔴 **판단 시점의** URL 을 기록한다(나중에 바뀌어도 그때 본 것이 남는다).
  origin_url      text        not null,
  candidate_url   text        not null,
  -- 🟢 `candidate_reviews` 와 잇는 **유일한 축** — 애플리케이션의 `reviewKey()` 와
  --    **같은 정규화기** 로 만든 값을 넣는다. 🔴 DB 가 정규화하지 않는다(규칙 owner 가 둘이 되면
  --    저장 키와 조회 키가 갈라진다 — WU-131 이 적어 둔 그 함정).
  review_url_key  text        not null,

  human_verdict   text        not null,
  reviewer        text        not null,
  reviewed_at     timestamptz not null,

  -- 🔴 **원문 그대로.** 시스템이 만들어 채우지 않는다(CPO: 메모 자동 작성 금지).
  --    메모를 입력하지 않았으면 **빈 문자열** 이고, 그것과 null 을 섞지 않는다.
  raw_note        text,
  -- 🔴 상품 속성 축이 **아니다**(위 설계 주석). 분류·판매 정책 문맥 전용.
  decision_context text,

  -- 🟢 버전 이력. 🔴 기존 행을 UPDATE 하지 않고 version 을 올려 **새 행** 을 넣는다.
  version         int         not null default 1,
  supersedes_id   uuid        references ceo_judgments(id) on delete set null,

  -- 🟢 원상품 스냅샷이 있으면 잇는다(없는 과거 조서도 저장돼야 하므로 null 허용).
  snapshot_id     uuid        references product_snapshots(id) on delete set null,

  created_at      timestamptz not null default now(),

  constraint ceo_judgments_verdict_check
    check (human_verdict in ('SAME', 'DIFFERENT', 'UNDECIDED')),
  -- 🔴 같은 쌍의 **여러 버전이 공존** 한다. 그래서 version 이 키에 들어간다.
  constraint ceo_judgments_review_pair_version_key
    unique (review_key, pair_id, version),
  -- 🔴 자기 자신을 가리키지 않는다(이력 사슬이 무한 루프가 되지 않게).
  constraint ceo_judgments_supersedes_not_self
    check (supersedes_id is null or supersedes_id <> id)
);

-- 🟢 조회 축 — 후보 URL 키(표시 배선) · 쌍(조서 대조) · 스냅샷(상품 화면).
create index if not exists ceo_judgments_url_key_idx on ceo_judgments (review_url_key);
create index if not exists ceo_judgments_pair_idx    on ceo_judgments (pair_id);
create index if not exists ceo_judgments_snapshot_idx on ceo_judgments (snapshot_id);
-- 🟢 「그 URL 의 최신 판단」을 뽑을 때 쓰는 축(🔴 최신을 «고르는» 것은 응용 코드의 일이다 —
--    DB 가 최신만 남기지 않는다. 충돌을 보여줘야 하므로 전부 남는다).
create index if not exists ceo_judgments_url_reviewed_idx on ceo_judgments (review_url_key, reviewed_at desc);

-- ── ② CEO 속성별 판단 기록 ─────────────────────────────────────────────────
create table if not exists ceo_judgment_axes (
  id              uuid primary key default gen_random_uuid(),
  judgment_id     uuid        not null references ceo_judgments(id) on delete cascade,

  -- 축 이름. 🔴 **값 목록을 CHECK 로 고정하지 않는다** — 축을 늘리는 것은 제품 정책이고
  --    migration 으로 잠그면 축을 더할 때마다 migration 이 필요해진다.
  --    🔴 그러나 그 축이 **동일상품 판정에 쓰이는 것은 아니다**(8축 CLOSED 유지).
  axis            text        not null,

  -- 🔴🔴 **네 상태뿐이다.** 「미입력」은 이 표에 **행이 없는 것** 으로 표현된다.
  state           text        not null,

  -- 🟢 그 축에서 본 값(기록). 🔴 추출기가 채우지 않는다 — 사람이 확인한 값이다.
  origin_value    text,
  candidate_value text,
  -- 🔴 **사람이 확인한** 근거만. AI 가 원문 메모에서 추론해 넣지 않는다(CPO 금지).
  rationale       text,
  -- 근거 출처(TITLE · DESCRIPTION · IMAGE · URL · OTHER 등). 🔴 CHECK 로 고정하지 않는다.
  evidence_source text,

  created_at      timestamptz not null default now(),

  constraint ceo_judgment_axes_state_check
    check (state in ('MATCH', 'MISMATCH', 'UNKNOWN', 'NOT_APPLICABLE')),
  -- 🔴 한 판단에서 같은 축이 두 번 나오지 않는다(두 값이 공존하면 어느 것이 판단인지 모른다).
  constraint ceo_judgment_axes_judgment_axis_key
    unique (judgment_id, axis)
);

create index if not exists ceo_judgment_axes_judgment_idx on ceo_judgment_axes (judgment_id);
create index if not exists ceo_judgment_axes_axis_idx     on ceo_judgment_axes (axis);

-- ── ③ 🔴🔴 권한 — `SUPABASE-GRANT-01 ②` 계약이 요구하는 것 ──────────────────
--
-- 🔴🔴 **회귀가 이 절의 부재를 잡았다.** 1차 작성에서 RLS·GRANT 를 빼먹었고
--    `supabase-grant-contract.test.ts` 의 **B-1 · B-2 가 2 FAIL** 했다.
--    🟢 가드를 풀지 않고 **이 절을 더했다**(계약이 요구한 것이 옳다).
--    🔴 `079` 에 이 절이 없는 것은 그 파일이 **LEGACY 면제 목록** 에 있기 때문이고,
--       새 파일은 면제되지 않는다(그 계약의 C-1 이 목록을 30개로 고정한다).
--
-- 🔴 왜 RLS 를 켜는가 — Supabase 는 `public` 스키마를 **Data API 로 노출** 한다.
--    RLS 를 켜지 않으면 그 표가 API 로 **그대로 열린다**. 🔴 CEO 판단은 사업 데이터다.
-- 🟢 **정책(policy)을 만들지 않는다** — RLS 를 켜고 정책이 없으면 **전부 거부** 이고,
--    서버는 `service_role`(RLS 우회)로만 접근한다. 그것이 이 트랙의 접근 모양이다
--    (`getSupabaseAdmin()`). 🔴 정책을 지어내면 **의도하지 않은 노출** 이 생긴다.

alter table ceo_judgments      enable row level security;
alter table ceo_judgment_axes  enable row level security;

-- 🔴🔴🔴 **먼저 회수한다 — 이것을 빼면 `anon` 이 TRUNCATE 할 수 있다.**
--
-- 🔴 실측(드라이런 안에서 `information_schema.role_table_grants` 조회 · 2026-11-07):
--    `grant select … to authenticated` 두 줄만 적었는데 **실제 부여된 권한은 이것이었다**:
-- ```
--    anon           DELETE · INSERT · REFERENCES · SELECT · TRIGGER · TRUNCATE · UPDATE
--    authenticated  (같은 7개)
--    service_role   (같은 7개) · postgres (같은 7개)
-- ```
-- 🔴🔴 원인은 내 SQL 이 아니라 **Supabase `public` 스키마의 DEFAULT PRIVILEGES** 다 —
--    새 표가 생기면 `anon`/`authenticated`/`service_role` 에 **자동으로 전부** 부여된다.
--    ⟹ 🔴 「GRANT 한 줄을 적었다」가 **최소 권한을 뜻하지 않는다.** 이미 다 열려 있었다.
--
-- 🔴🔴 그리고 **RLS 가 TRUNCATE 를 막지 못한다** — RLS 는 «행» 단위 필터이고 TRUNCATE 는
--    테이블 연산이다. ⟹ RLS 만 켜 두면 `anon` 이 **표를 비울 수 있다**(대표님 판단 전손).
--    🟢 INSERT/UPDATE/DELETE/SELECT 는 RLS(정책 0 = 전부 거부)가 막는다 —
--       실측 `anon`·`authenticated` 는 `rolbypassrls=false` 다.
--    🔴 **TRUNCATE 하나 때문에 REVOKE 가 반드시 필요하다.**
--
-- 🔴 계약과의 관계 — `ALTER DEFAULT PRIVILEGES` 는 **쓰지 않는다**(계약 D-3 금지 ·
--    전역 기본값을 건드리면 다른 표에 영향이 간다). 🟢 **이 두 표에만** 테이블 단위로 회수한다.
-- 🔴 `on all tables in schema public` 류 전체식도 쓰지 않는다(계약 D-1).
revoke all on ceo_judgments     from anon;
revoke all on ceo_judgments     from authenticated;
revoke all on ceo_judgment_axes from anon;
revoke all on ceo_judgment_axes from authenticated;

-- 🟢 그 다음에 **필요한 최소만** 돌려준다.
-- 🟢 `authenticated` 에 **읽기만** — 화면이 과거 판단을 **표시** 하는 것이 전부이고
--    쓰기는 서버(`service_role`)가 한다. 🔴 「나중에 필요할지 모르니」로 넓히지 않는다.
-- 🔴 `anon` 에는 **아무것도 주지 않는다**(그 역할의 테이블 접근은 실측 0건이다).
-- 🔴 `service_role` 은 **건드리지 않는다** — 서버 경로가 그 역할이고(`getSupabaseAdmin()`),
--    `rolbypassrls=true` 라 RLS 를 우회한다(실측). 그것이 설계된 접근 경로다.
grant select on ceo_judgments     to authenticated;
grant select on ceo_judgment_axes to authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 적용 후 확인할 것(적용 승인 시)
-- ════════════════════════════════════════════════════════════════════════════
--  ① 표 둘 · 인덱스 여섯 · 제약(verdict CHECK · state CHECK · UNIQUE 둘 · self-ref CHECK)
--  ② `candidate_reviews` 의 칸 24개와 데이터가 **그대로** 인지(변경 0 이어야 한다)
--  ③ 같은 `(review_key, pair_id)` 에 version 2 를 넣으면 **둘 다 남는지**
--  ④ `state` 에 'MATCH' 외 임의 문자열을 넣으면 **거부되는지**
--  ⑤ 축 행 없이 판단만 넣어도 **저장되는지**(미입력 표현)
-- ════════════════════════════════════════════════════════════════════════════
