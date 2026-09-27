-- ════════════════════════════════════════════════════════════════════════════
-- 장기 스프린트 S-8/9 — 롯데ON 배송 기본값을 «판매자 설정» 으로
-- (CEO 정책 결정, 2026-09-26)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ── 이 마이그레이션이 «지금» 가능한 이유 ──────────────────────────────────
-- Commerce-6 C-2 에서 CTO 가 여기서 멈췄다. 이유는 셋이었다.
--
--     ① 쓰는 화면이 없다   ㉢(2026-09-22)가 「배송 프로필과 중복」으로 지웠다
--     ② 택배사 칸이 없다
--     ③ workspace 축이 없다 — 넣으면 C-1b/C-1c 가 없앤 «공유» 가 되살아난다
--
-- ③이 진짜 게이트였고 그건 «정책» 문제였다. CEO 가 그것을 결정했다:
--
--     「해외직구 상품이므로 상품마다 별도 배송비 정책을 선택할 필요 없음.
--      판매자 설정에서 하나의 기본 해외직구 배송비 정책을 관리하고
--      상품 등록 시 자동 적용한다.」
--
-- 즉 ①은 「중복이 아니라 판매자 설정이 맞다」로 뒤집혔고, ②③은 이 파일이 푼다.
--
-- ── 🔴 하지 않는 것 (C-1/C-2 에서 확정, 그대로 유지) ──────────────────────
--     ❌ 레거시 singleton 행 삭제
--     ❌ 임의 workspace 로 backfill — 귀속 근거가 없다(059 와 같은 이유)
--     ❌ 코드 «값» 을 넣는 기본값 — 4279402 · 0001 같은 값을 여기에 적지 않는다
--     ❌ 89/150/166 응답 없이 코드 추정
--
-- 🔴 코드는 «셀러가 목록에서 고른 것» 만 들어온다. 이 파일은 그 값이 «앉을
--    자리» 만 만든다. 우리가 고르지 않는다.

-- ── ① workspace 축 (043/059 와 같은 패턴) ────────────────────────────────
--
-- 🔴 NULL 은 «전역» 이 아니라 «귀속을 확인할 수 없는 레거시» 다. 058 은
-- id='default' 싱글턴이라 기존 행이 어느 workspace 것인지 알 방법이 없다 —
-- 그래서 추정하지 않고 NULL 로 남긴다. reader 는 C-1b 규칙 그대로
-- (내 workspace 1순위 → 레거시 폴백, 🔴 조회 «오류» 는 폴백하지 않는다).
ALTER TABLE lotteon_seller_settings
  ADD COLUMN IF NOT EXISTS workspace_id uuid,
  ADD COLUMN IF NOT EXISTS scope_key text NOT NULL DEFAULT 'default';

-- workspace 당 1행. scope_key 를 PK 로 «못박지 않는» 이유는 059 와 같다 —
-- 나중에 「워크스페이스 안에서 여러 벌」이 필요해질 때 표를 다시 만들지 않으려고.
CREATE UNIQUE INDEX IF NOT EXISTS lotteon_seller_settings_workspace_scope_key
  ON lotteon_seller_settings (workspace_id, scope_key)
  WHERE workspace_id IS NOT NULL;

-- 레거시 행(workspace_id IS NULL)은 scope_key 당 하나만 남긴다.
CREATE UNIQUE INDEX IF NOT EXISTS lotteon_seller_settings_legacy_scope_key
  ON lotteon_seller_settings (scope_key)
  WHERE workspace_id IS NULL;

-- ── ② 택배사 · 반품 택배사 ───────────────────────────────────────────────
--
-- 🔴 C-2A 가 확인한 사실: 「택배사」는 Common 이 «이름» 을 갖고 채널이 코드를
-- 해석하는 개념이다(PROMOTE). 그런데 롯데ON 은 목록 API(89 DV_CO_CD)를 주므로
-- 저장하는 것은 «셀러가 그 목록에서 고른 결과» 다.
--
-- code 와 label 을 «함께» 둔다. label 이 있어야 셀러에게 코드를 보여주지 않고
-- (F-7 원칙) 「우체국택배」라고 말할 수 있다. code 만 저장하면 화면이 코드를
-- 보여주거나 매번 89 를 다시 불러야 한다.
ALTER TABLE lotteon_seller_settings
  ADD COLUMN IF NOT EXISTS courier_code text,          -- hdcCd      택배사
  ADD COLUMN IF NOT EXISTS courier_label text,
  ADD COLUMN IF NOT EXISTS return_courier_code text,   -- rtngHdcCd  반품 택배사
  ADD COLUMN IF NOT EXISTS return_courier_label text;

COMMENT ON COLUMN lotteon_seller_settings.courier_code IS
  '롯데ON 공통코드 목록(89)에서 셀러가 고른 값 그대로. 🔴 추정하거나 이름으로 맞추지 않는다.';
COMMENT ON COLUMN lotteon_seller_settings.courier_label IS
  '같은 목록이 준 표시 이름(예: 우체국택배). 셀러 화면에는 이 값만 보여준다.';

-- ── ③ 수입사명 — 🔴 상품 필드가 아니라 «판매자 정보» 다 ─────────────────
--
-- S-4/5/6 에서 확인했다. CEO 가 SmartStore 고시에서 「수입사명 누락」을 봤는데,
-- 그 값은 지금 `product.importer`(상품 필드, source=REQUIRED)에 있다. 그래서
-- **상품마다 다시 입력**하게 된다.
--
-- 해외구매대행에서 수입자는 상품이 아니라 «판매자» 다. seller_settings 에
-- 제조자·A/S·품질보증·KC문구·원산지기본 다섯이 이미 있는데 importer 만 없었다.
--
-- 🔴 product.importer 를 «지우지 않는다». 상품별로 다른 수입자를 쓰는 경우가
--    생길 수 있고, 사다리는 제조사와 같은 순서다(상품 → 판매자 설정).
ALTER TABLE seller_settings
  ADD COLUMN IF NOT EXISTS importer text;

COMMENT ON COLUMN seller_settings.importer IS
  '판매자 본인의 수입사명. 🔴 제조자(manufacturer)와 다른 개념이다 — 제조사≠수입사≠판매자.';
