-- ════════════════════════════════════════════════════════════════════════════
-- TTAEJYO-PIVOT-03 / Migration 001 — 판매자 공통 설정을 «제 자리»로
-- (CEO 승인, 2026-09-22)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ── 무엇이 문제였나 (PIVOT-01 실측) ────────────────────────────────────────
-- 판매자 정보(제조사·A/S·품질보증·KC문구·원산지 기본)가 `coupang_seller_profiles`
-- 에 들어 있다. 그 표는 이름 그대로 «배송 프로필» 이고 `name` + `is_default` 로
-- 여러 개를 갖는다. 그래서 이런 일이 일어난다.
--
--     셀러가 배송 프로필을 하나 더 만든다
--        → 제조사·A/S·품질보증·KC문구가 «빈 채로» 새로 생긴다
--        → 그 프로필을 기본으로 바꾸면 판매자 정보가 «사라진다»
--
-- 가설이 아니다. 지금 DB 에 그 상태의 빈 행이 이미 2개 있다.
--
--     is_default=true   A/S·품질보증·KC문구·원산지기본 있음 · manufacturer 는 null
--     is_default=false  전부 null
--     is_default=false  전부 null
--
-- 「여러 개여야 하는 것(배송)」과 「하나여야 하는 것(판매자 정보)」이 같은 행에
-- 갇혀 있었다. 이 마이그레이션은 뒤엣것만 꺼낸다.
--
-- ── 🔴 workspace_id 가 NULL 인 이유 ────────────────────────────────────────
-- **NULL 은 «전역» 이 아니라 «귀속을 확인할 수 없는 레거시» 다.**
--
-- 실측: workspaces 15개 중 상품을 가진 것은 3개(333/21/1건)인데,
--       coupang_seller_profiles 에는 workspace/owner/user 를 가리키는 컬럼이
--       하나도 없다. 세 행 모두 이름이 「기본」이다.
--       → 어느 workspace 것인지 «알 방법이 없다».
--
-- CEO 지시: 「근거가 없으면 임의 workspace 를 추정하여 backfill 하면 안 된다」
-- 그래서 추정하지 않고, 모른다는 사실을 그대로 적는다.
--
-- 🔴 이 NULL 행을 읽는 것은 **migration compatibility** 이지 정상 동작이 아니다.
--    Beta Security 트랙이 workspace 격리를 할 때 workspace 별 행이 들어오고,
--    그때 이 레거시 행은 제거 대상이 된다.
--
-- ── 🔴 scope_key 가 있는 이유 ──────────────────────────────────────────────
-- 「workspace 당 1행」이 현재 근거 기준의 답이지만, 그것을 PK 로 «못박지 않는다».
-- 나중에 사업자/스토어/판매방식 같은 축이 실제로 생기면 PK 를 바꿔야 하기
-- 때문이다. scope_key 를 두면 축이 늘어도 **행만 늘고 스키마는 그대로**다.
-- 지금은 'default' 하나만 쓴다 — 없는 요구로 값을 만들지 않는다.
--
-- 실행: CEO 가 Supabase SQL Editor 에서 실행한다(에이전트는 실행하지 않는다).

CREATE TABLE IF NOT EXISTS seller_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 🔴 NULL = 「귀속 미확정(레거시)」. 「전역」이라는 뜻이 아니다.
  workspace_id uuid,

  -- 지금은 'default' 하나뿐. 축이 늘어날 자리만 남겨 둔다.
  scope_key text NOT NULL DEFAULT 'default',

  -- ── 판매자 공통 정보(채널 무관) ──────────────────────────────────────
  -- 🔴 전부 NULL 허용이다. 원본에 값이 없으면 «없는 채로» 옮긴다 —
  --    기본값을 지어내면 셀러가 확인한 적 없는 값이 등록에 나간다.
  manufacturer text,               -- 판매자 본인의 제조자(수입자). 브랜드가 아니다.
  as_contact_number text,          -- A/S 연락처. 비면 반품지 연락처를 대신 쓴다(기존 동작).
  quality_guarantee text,          -- 품질보증기준
  kc_exemption_text text,          -- KC/인증 기본 문구
  default_country_of_origin text,  -- 원산지 기본값(상품에서 못 찾았을 때만)

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- workspace 가 붙은 뒤의 정상 경로: 한 workspace 의 한 scope 는 한 행.
CREATE UNIQUE INDEX IF NOT EXISTS seller_settings_workspace_scope
  ON seller_settings (workspace_id, scope_key);

-- 🔴 CEO 지적 — PostgreSQL 의 UNIQUE 는 NULL 을 서로 «다른 값» 으로 본다.
--    그래서 위 인덱스만으로는 workspace_id 가 NULL 인 행이 여러 개 생길 수 있다.
--    「레거시 행은 정확히 하나」라는 의도를 별도 부분 인덱스로 «이름과 함께» 못박는다.
--    (PG15+ 의 NULLS NOT DISTINCT 로도 되지만, 이 방식이 의도를 이름으로 드러내고
--     엔진 버전에 덜 묶인다. 저장소에 기존 선례가 없어 더 명시적인 쪽을 골랐다.)
CREATE UNIQUE INDEX IF NOT EXISTS seller_settings_legacy_singleton
  ON seller_settings (scope_key)
  WHERE workspace_id IS NULL;

COMMENT ON TABLE seller_settings IS
  'TTAEJYO-PIVOT-03 — 판매자 공통 설정. 배송 프로필과 «분리» 한다(프로필을 늘려도 이 값은 복제되지 않는다).';
COMMENT ON COLUMN seller_settings.workspace_id IS
  '🔴 NULL 은 «전역» 이 아니라 «귀속을 확인할 수 없는 레거시» 다. Beta Security 가 workspace 격리를 하면 그때 채워지고 레거시 행은 제거 대상이 된다.';
COMMENT ON COLUMN seller_settings.scope_key IS
  '지금은 default 하나뿐. 사업자/스토어 같은 축이 «실제로» 생길 때 값이 늘어난다.';

-- ── backfill ───────────────────────────────────────────────────────────────
-- 🔴 is_default=true 행에서 «값이 있는 것만» 옮긴다. NULL 을 기본값으로 만들지
--    않는다(CEO 명시). 실측상 manufacturer 는 null 이라 옮길 것이 없고, 그 사실이
--    그대로 남아야 한다 — 「제조사 미입력」은 쿠팡 등록의 1위 블로커였고, 여기서
--    아무 값이나 채우면 그 경고가 조용히 사라진다.
--
-- 🔴 coupang_seller_profiles 는 «읽기만» 한다. 삭제도 수정도 하지 않는다.
INSERT INTO seller_settings (
  workspace_id, scope_key,
  manufacturer, as_contact_number, quality_guarantee, kc_exemption_text, default_country_of_origin
)
SELECT
  NULL,        -- 귀속 미확정
  'default',
  p.manufacturer,
  p.as_contact_number,
  p.quality_guarantee,
  p.kc_exemption_text,
  p.default_country_of_origin
FROM coupang_seller_profiles p
WHERE p.is_default = true
  -- 값이 하나라도 있는 경우에만 행을 만든다. 전부 비었으면 만들지 않는다 —
  -- 빈 행을 만들면 「설정이 있는데 비어 있다」와 「설정한 적이 없다」가 같아진다.
  AND (
    p.manufacturer IS NOT NULL
    OR p.as_contact_number IS NOT NULL
    OR p.quality_guarantee IS NOT NULL
    OR p.kc_exemption_text IS NOT NULL
    OR p.default_country_of_origin IS NOT NULL
  )
ON CONFLICT DO NOTHING;   -- 다시 실행해도 안전하다(레거시 행은 하나뿐이다).
