-- ════════════════════════════════════════════════════════════════════════════
-- 063 — Product Identity + ChannelProduct  (P0-CHANNEL-03 PHASE E)
-- CPO 확정 ㉮ · 2026-09-25
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 실행 전 반드시 읽을 것
--
-- 왜 필요한가: 지금까지 상품 정체성이 없었고 `snapshot_id` 하나로 외부 상품에
-- 연결했다. snapshot 은 「수집·분석 1회」라서 URL 을 다시 분석하면 새로 생기고,
-- 그때 이전 등록과의 연결이 끊어진다. 그 결과가 실제 Production 에 이미 있다 —
-- 한 상품이 snapshot 5개로 갈라져 SmartStore 외부번호가 6개 생겼다:
--   13668016862 · 13669115052 · 13670383541 · 13672230124 · 13672322468 · 13713032117
-- (쿠팡도 16336681622 · 16338809221 · 16340176952)
--
-- 🔴 이 migration 은 그 중복을 «고치지 않는다». 기존 데이터는 한 행도 바꾸지
-- 않는다(CPO 금지선). 앞으로 같은 일이 생기지 않게 «자리를 만드는» 것뿐이다.
--
-- 🔴 전부 additive · nullable 이다. 기존 코드는 새 컬럼을 읽지 않으므로
-- 적용 직후 동작이 달라지는 곳이 없다.
--
-- 적용 전 확인(063_verify_before.sql 참고):
--   "Product" 0건 · product_snapshots 381건 · registration_attempts 97건
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1) Product 를 «정체성» 으로 재정의 ──────────────────────────────────────
-- 🔴 sourceUrl 의 @unique 를 «제거» 한다. URL 은 식별자가 아니다:
--   · 같은 상품이 URL 을 바꿀 수 있다        → 새 상품이 되어선 안 된다
--   · 같은 URL 에서 상품이 바뀔 수 있다       → 같은 상품이 되어선 안 된다
--   · locale/campaign 변형이 있다            → 별개 상품이 되어선 안 된다
-- URL 은 「동일성 판단 후보 정보」로만 남는다. 🔴 URL 로 자동 merge 하지 않는다.
--
-- 🔴 되돌릴 수 없는 지점: Product 에 행이 생긴 뒤에는 @unique 를 되살릴 수
-- 없다(중복 URL 이 이미 들어가 있을 수 있으므로). 지금은 0건이라 안전하다.
DROP INDEX IF EXISTS "Product_sourceUrl_key";
ALTER TABLE "Product" ALTER COLUMN "sourceUrl" DROP NOT NULL;

-- ── 2) Snapshot → Product (nullable) ───────────────────────────────────────
-- 🔴 nullable 이 «필수» 다. 기존 381건은 product_id = NULL 로 그대로 둔다.
-- sourceUrl 로 자동 backfill 하면 위 중복 6건이 잘못 합쳐진다 — 자동 매칭으로
-- 판단할 수 있는 데이터가 0건이라는 것이 PHASE D-2 의 결론이다.
-- ON DELETE SET NULL: Product 를 지워도 snapshot(과 그에 매달린 7개 표)은 산다.
ALTER TABLE product_snapshots
  ADD COLUMN IF NOT EXISTS product_id TEXT NULL
  REFERENCES "Product"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS product_snapshots_product_id_idx
  ON product_snapshots(product_id);

-- ── 3) ChannelProduct — «현재» 외부 상품과의 연결 ───────────────────────────
-- 🔴 registration_attempts 와 역할이 다르다:
--     ChannelProduct        지금 이 상품이 어느 외부 상품과 연결돼 있는가 (상태)
--     RegistrationAttempt   무엇을 시도했는가                          (이력)
-- 「마지막 attempt = 현재 상태」라는 가정이 위의 중복을 만들었다. 섞지 않는다.
CREATE TABLE IF NOT EXISTS channel_products (
  id                  TEXT PRIMARY KEY,
  product_id          TEXT NOT NULL REFERENCES "Product"(id) ON DELETE CASCADE,
  -- 'smartstore' | 'coupang' | 'lotteon'.
  -- 🔴 text 로 둔다 — registration_attempts.platform 이 text 라 lotteon 이
  -- 들어갈 수 있었던 것과 같은 이유다(PlatformId enum 에는 lotteon 이 없다).
  channel             TEXT NOT NULL,
  external_product_id TEXT NOT NULL,
  -- 'LIVE' | 'SUSPENDED' | 'UNKNOWN'. 🔴 기본값 UNKNOWN — 외부 상태를 조회하는
  -- 코드가 아직 없다. 모르는 것을 LIVE 라고 적지 않는다.
  status              TEXT NOT NULL DEFAULT 'UNKNOWN',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_products_product_channel_idx
  ON channel_products(product_id, channel);
CREATE INDEX IF NOT EXISTS channel_products_external_idx
  ON channel_products(channel, external_product_id);

-- 🔴 UNIQUE(product_id, channel) 를 «여기서 걸지 않는다».
-- 기존 중복(SmartStore 6 · Coupang 3)이 Product 에 연결되는 순간 제약 위반이
-- 된다. 순서는 PHASE F 로 고정돼 있다:
--   ① 제약 없이 도입(지금) → ② 중복 정리(CEO 사업 판단) → ③ 그 뒤에 제약
-- ALTER TABLE channel_products ADD CONSTRAINT channel_products_product_channel_key
--   UNIQUE (product_id, channel);   -- ← PHASE F 에서

-- ── 4) RegistrationAttempt → ChannelProduct + operation ─────────────────────
-- 🔴 둘 다 nullable. 기존 97건은 값이 NULL 인 채로 «기존 의미 그대로» 남는다.
-- operation NULL = 「이 컬럼이 생기기 전의 등록」이라는 사실 그대로다.
-- 없는 것을 'CREATE' 로 채우지 않는다 — 확인하지 않은 것을 확인했다고 적는
-- 셈이 되고, 실제로 그중 일부는 같은 상품의 중복 등록이었다.
ALTER TABLE registration_attempts
  ADD COLUMN IF NOT EXISTS channel_product_id TEXT NULL
    REFERENCES channel_products(id) ON DELETE SET NULL,
  -- 'CREATE' | 'UPDATE' | 'RECREATE'
  ADD COLUMN IF NOT EXISTS operation TEXT NULL;

CREATE INDEX IF NOT EXISTS registration_attempts_channel_product_idx
  ON registration_attempts(channel_product_id);

-- 🔴 RECREATE 이력은 «별도 컬럼 없이» 이 표로 보존한다:
--     operation = 'RECREATE' · external_product_id = 새 외부 ID
--     + payload/response 원문
-- previous_external_product_id 를 1칸 두면 3회 이상 재등록 시 가장 오래된
-- 번호를 잃는다. 이 표는 이미 전부 남기므로 컬럼을 늘리지 않는다(CPO 확정).

COMMIT;

-- ── ROLLBACK (역순) ─────────────────────────────────────────────────────────
-- 🔴 Product 에 행이 생긴 뒤라면 sourceUrl 의 @unique 는 복원하지 않는다.
-- BEGIN;
--   ALTER TABLE registration_attempts
--     DROP COLUMN IF EXISTS channel_product_id,
--     DROP COLUMN IF EXISTS operation;
--   DROP TABLE IF EXISTS channel_products;
--   ALTER TABLE product_snapshots DROP COLUMN IF EXISTS product_id;
--   -- Product 가 여전히 0건일 때만:
--   -- ALTER TABLE "Product" ALTER COLUMN "sourceUrl" SET NOT NULL;
--   -- CREATE UNIQUE INDEX "Product_sourceUrl_key" ON "Product"("sourceUrl");
-- COMMIT;
