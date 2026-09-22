-- ════════════════════════════════════════════════════════════════════════════
-- TTAEJYO-PIVOT-03 ⑤ — 판매자 5칸 dual-write 를 «한 트랜잭션» 으로
-- (CEO 승인, 2026-09-22)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ── 왜 함수인가 ────────────────────────────────────────────────────────────
-- 059 로 판매자 공통 설정을 seller_settings 로 옮겼고 reader 는 그쪽만 본다.
-- 그런데 설정 화면의 writer 는 아직 coupang_seller_profiles 에 쓴다.
--   → 셀러가 저장하면 성공했다고 보이는데 등록에는 «안 나간다»(silent divergence).
--
-- 두 곳에 함께 써서 그 틈을 닫는데, @supabase/supabase-js 에는 두 upsert 를
-- 묶는 transaction API 가 없다. CEO 가 「부분 성공을 허용하는 dual-write 는
-- 승인하지 않는다」고 못박았으므로 함수 하나로 만든다 — 함수 본문 전체가 한
-- 트랜잭션이라 한쪽이 실패하면 둘 다 롤백된다.
--
-- 이 저장소에 이미 같은 패턴이 있다(job-key.ts 의 supabase.rpc("next_job_key_counter")).
-- 🔴 다만 그 함수는 migrations_manual 에 «없다» — DB 에만 존재해 추적되지 않는다.
--    이 파일은 그 전철을 밟지 않으려고 정의를 그대로 보관한다.
--
-- ── 🔴 범위: 판매자 5칸 «뿐» ───────────────────────────────────────────────
-- 배송·가격·상세페이지는 건드리지 않는다. 특히 상세페이지 블록은 TS 쪽에
-- `syncCommonImageFlags` 라는 «읽고 계산해서 다시 쓰는» 로직이 있는데, 그걸
-- PL/pgSQL 로 옮기면 같은 규칙이 두 곳에 살게 된다(그리고 언젠가 한쪽만 바뀐다).
-- CEO 확정: 그 로직은 SQL 로 복제하지 않는다.
--
-- ── 🔴 undefined / "" / 값 의 의미를 그대로 재현한다 ───────────────────────
-- toRowFields(seller-profile.ts:231~242) 가 다섯 칸을 전부 같은 규칙으로 다룬다.
--
--     if (input.X !== undefined)  row.x = input.X || null;
--
--     undefined  → 건드리지 않는다(partial update)
--     ""         → null
--     값          → 값
--
-- 그래서 인자를 컬럼별로 받지 않고 **jsonb 하나로** 받는다.
-- `p_fields ? 'manufacturer'` 가 `!== undefined` 를 정확히 대신하고,
-- `NULLIF(p_fields->>'manufacturer', '')` 가 `|| null` 을 대신한다.
-- 컬럼별 인자로 받으면 「안 보냈다」와 「빈 값을 보냈다」를 구분할 수 없다.
--
-- ── 🔴 SECURITY: INVOKER 다 ────────────────────────────────────────────────
-- SECURITY DEFINER 를 «붙이지 않는다»(CEO 명시). 호출자는 이미 service role 로
-- 접속하는 서버 라우트이고, DEFINER 를 붙이는 순간 이 함수가 RLS 를 우회하는
-- 별도 권한 경로가 된다 — 그건 보안 설계 사안이라 여기서 편의로 정할 일이 아니다.
--
-- temporary dual-write
-- canonical reader = seller_settings
-- legacy seller profile write retained for compatibility
-- legacy write removal = Phase ⑨
-- workspace-scoped write migration = Beta Security
--
-- 실행: CEO 가 Supabase SQL Editor 에서 실행한다(에이전트는 실행하지 않는다).

CREATE OR REPLACE FUNCTION save_seller_settings_dual(
  p_profile_id uuid,
  p_fields jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER          -- 🔴 DEFINER 아님(위 주석 참고)
AS $$
DECLARE
  -- 「이 키가 왔는가」 — jsonb ? 'key' 가 TS 의 !== undefined 를 대신한다.
  has_manufacturer   boolean := p_fields ? 'manufacturer';
  has_as_contact     boolean := p_fields ? 'asContactNumber';
  has_quality        boolean := p_fields ? 'qualityGuarantee';
  has_kc             boolean := p_fields ? 'kcExemptionText';
  has_origin         boolean := p_fields ? 'defaultCountryOfOrigin';

  -- 「그 값은 무엇인가」 — NULLIF(…, '') 가 TS 의 || null 을 대신한다.
  v_manufacturer text := NULLIF(p_fields->>'manufacturer', '');
  v_as_contact   text := NULLIF(p_fields->>'asContactNumber', '');
  v_quality      text := NULLIF(p_fields->>'qualityGuarantee', '');
  v_kc           text := NULLIF(p_fields->>'kcExemptionText', '');
  v_origin       text := NULLIF(p_fields->>'defaultCountryOfOrigin', '');
BEGIN
  -- 다섯 칸 중 아무것도 안 왔으면 할 일이 없다. 빈 UPDATE 로 updated_at 만
  -- 흔들지 않는다.
  IF NOT (has_manufacturer OR has_as_contact OR has_quality OR has_kc OR has_origin) THEN
    RETURN;
  END IF;

  -- ① 기존 표 — 온 칸만 바꾼다. 안 온 칸은 «그대로 둔다»(COALESCE 가 아니라
  --    「왔는가」로 갈라야 한다. COALESCE 를 쓰면 빈 값으로 지우는 동작이 막힌다).
  UPDATE coupang_seller_profiles
  SET
    manufacturer              = CASE WHEN has_manufacturer THEN v_manufacturer ELSE manufacturer END,
    as_contact_number         = CASE WHEN has_as_contact   THEN v_as_contact   ELSE as_contact_number END,
    quality_guarantee         = CASE WHEN has_quality      THEN v_quality      ELSE quality_guarantee END,
    kc_exemption_text         = CASE WHEN has_kc           THEN v_kc           ELSE kc_exemption_text END,
    default_country_of_origin = CASE WHEN has_origin       THEN v_origin       ELSE default_country_of_origin END,
    updated_at                = now()
  WHERE id = p_profile_id;

  IF NOT FOUND THEN
    -- 🔴 조용히 넘어가지 않는다. 프로필이 없는데 seller_settings 만 바뀌면
    --    두 표가 갈라진다 — 이 함수가 막으려는 바로 그 일이다.
    RAISE EXCEPTION '판매자 프로필을 찾지 못했습니다: %', p_profile_id;
  END IF;

  -- ② 새 표 — canonical reader 가 보는 곳.
  --    🔴 workspace_id = NULL 은 «전역» 이 아니라 «귀속을 확인할 수 없는 레거시» 다.
  --       059 주석과 같은 뜻이고, Beta Security 가 workspace 행을 넣으면 그때
  --       reader 1순위가 바뀐다.
  INSERT INTO seller_settings (
    workspace_id, scope_key,
    manufacturer, as_contact_number, quality_guarantee, kc_exemption_text, default_country_of_origin
  )
  VALUES (
    NULL, 'default',
    CASE WHEN has_manufacturer THEN v_manufacturer ELSE NULL END,
    CASE WHEN has_as_contact   THEN v_as_contact   ELSE NULL END,
    CASE WHEN has_quality      THEN v_quality      ELSE NULL END,
    CASE WHEN has_kc           THEN v_kc           ELSE NULL END,
    CASE WHEN has_origin       THEN v_origin       ELSE NULL END
  )
  ON CONFLICT (scope_key) WHERE workspace_id IS NULL
  DO UPDATE SET
    -- 여기서도 「온 칸만」이다. 안 온 칸을 NULL 로 덮으면 다른 탭에서 저장할
    -- 때마다 판매자 정보가 지워진다(세 탭이 같은 PATCH 를 쓰기 때문에 실제로
    -- 일어난다).
    manufacturer              = CASE WHEN has_manufacturer THEN EXCLUDED.manufacturer              ELSE seller_settings.manufacturer END,
    as_contact_number         = CASE WHEN has_as_contact   THEN EXCLUDED.as_contact_number         ELSE seller_settings.as_contact_number END,
    quality_guarantee         = CASE WHEN has_quality      THEN EXCLUDED.quality_guarantee         ELSE seller_settings.quality_guarantee END,
    kc_exemption_text         = CASE WHEN has_kc           THEN EXCLUDED.kc_exemption_text         ELSE seller_settings.kc_exemption_text END,
    default_country_of_origin = CASE WHEN has_origin       THEN EXCLUDED.default_country_of_origin ELSE seller_settings.default_country_of_origin END,
    updated_at                = now();
END;
$$;

COMMENT ON FUNCTION save_seller_settings_dual(uuid, jsonb) IS
  'TTAEJYO-PIVOT-03 ⑤ — temporary dual-write. canonical reader = seller_settings. legacy seller profile write retained for compatibility; legacy write removal = Phase ⑨. workspace-scoped write migration = Beta Security. 판매자 5칸만 다룬다 — 배송/가격/상세페이지는 TS 경로 그대로.';
