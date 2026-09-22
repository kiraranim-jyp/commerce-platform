-- ════════════════════════════════════════════════════════════════════════════
-- LOTTEON-REAL-REGISTRATION-02 STOP ①(CEO 승인, 2026-09-22)
-- 롯데ON 판매자 «고정값» 저장소
-- ════════════════════════════════════════════════════════════════════════════
--
-- 왜 필요한가. 롯데ON 등록 검증(validateLotteOnPayload)이 막는 필드 중 일곱
-- 개가 «판매자가 한 번 정하면 계속 쓰는 값» 인데, 지금은 저장할 곳이 없어서
-- 상품별 폼에만 산다. 그래서 매 상품마다 다시 고르게 된다.
--
--   commerce_accounts 컬럼 전수 — 전부 자격증명이다(access_key/secret_key/
--   vendor_id/…). 설정을 담을 자리가 없다.
--
-- 구조는 coupang_seller_settings 를 그대로 따른다(단일 행 · 평면 컬럼).
-- 새 패턴을 만들지 않는다.
--
-- 🔴 범위는 CEO 가 승인한 일곱 개뿐이다. 다른 롯데ON 값을 여기 끌어오지 않는다.
--
-- 실행: CEO 가 Supabase SQL Editor 에서 실행한다(에이전트는 실행하지 않는다 —
--       account.ts 의 050 마이그레이션과 같은 규약).

CREATE TABLE IF NOT EXISTS lotteon_seller_settings (
  -- coupang_seller_settings 와 같은 단일행 규약. 항상 'default'.
  id text PRIMARY KEY DEFAULT 'default',

  -- ── ⑤⑥ 배송 · 판매자 인프라 번호 ─────────────────────────────────────
  -- 🔴 전부 롯데ON 판매자센터/거래처 API 에 «먼저 등록돼 있어야» 하는 값이다.
  --    우리가 만들 수 없다(validate-payload.ts SELLER_PLACE_REQUIRED).
  --    그래서 설정 화면은 숫자를 입력받지 않고 **API Master 목록에서 고르게**
  --    한다(150 getDvpListSr · 166 getDvCstListSr · 89 getDetailCodeList).
  --    사람은 「서울 ○○센터」를 고르고, 저장되는 것은 그 번호다.
  outbound_place_no text,          -- owhpNo        출고지번호
  return_place_no text,            -- rtrpNo        회수지(반품지)번호
  delivery_cost_policy_no text,    -- dvCstPolNo    배송비정책번호
  delivery_region_group_code text, -- dvRgsprGrpCd  배송가능지역코드

  -- 고른 «순간의» 표시 이름. 번호만 저장하면 설정 화면이 「12345」만 보여주게
  -- 되고, 셀러는 그게 어느 센터인지 알 수 없다. 🔴 이 이름은 표시 전용이고
  -- 등록 payload 에는 절대 들어가지 않는다 — payload 로 가는 것은 번호뿐이다.
  outbound_place_label text,
  return_place_label text,
  delivery_cost_policy_label text,
  delivery_region_group_label text,

  -- ── ⑩ 발송 마감시간 ──────────────────────────────────────────────────
  -- HH24MI (예: '1400'). 판매자 운영시간이라 상품마다 달라지지 않는다.
  weekday_close_time text CHECK (weekday_close_time IS NULL OR weekday_close_time ~ '^\d{4}$'),
  saturday_close_time text CHECK (saturday_close_time IS NULL OR saturday_close_time ~ '^\d{4}$'),

  -- ── ⑧ 수입대행코드 — 🔴 «기본값» 이지 고정값이 아니다 ────────────────
  -- CEO 지시로 실제 의미를 먼저 확인했다: validate-payload.ts L191 원문
  -- 「구매대행/병행수입/해당없음」 — 즉 판매자 인프라 번호가 아니라 **이 상품을
  -- 어떤 형태로 수입하는가** 다. TTAEJYO 는 해외구매대행이라 대부분 PUR_PRX
  -- 이지만, 같은 판매자도 병행수입 상품을 가질 수 있다.
  --
  -- 그래서 여기 있는 값은 «기본값» 이고 상품이 그것을 덮을 수 있다
  -- (제조사 사다리와 같은 구조: 상품 명시값 → 판매자 기본값 → 없음).
  -- 🔴 이 컬럼을 「판매자 고정값」으로 읽고 상품별 선택을 없애면 안 된다.
  default_import_proxy_code text CHECK (
    default_import_proxy_code IS NULL
    OR default_import_proxy_code IN ('PUR_PRX', 'PRL_IMP', 'NONE')
  ),

  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 단일 행 강제 — coupang_seller_settings 와 같은 운영 규약을 구조로 못박는다.
  CONSTRAINT lotteon_seller_settings_singleton CHECK (id = 'default')
);

COMMENT ON TABLE lotteon_seller_settings IS
  'LOTTEON-REAL-REGISTRATION-02 — 롯데ON 판매자 고정값. 상품마다 달라지는 값은 여기 두지 않는다.';
COMMENT ON COLUMN lotteon_seller_settings.default_import_proxy_code IS
  '기본값이지 고정값이 아니다. 상품이 덮을 수 있다(PUR_PRX 구매대행 / PRL_IMP 병행수입 / NONE 해당없음).';
