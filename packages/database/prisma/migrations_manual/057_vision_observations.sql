-- P0-A.30.2 ㉠(CEO 결정, 2026-09-20) — **Vision 관측을 가격 경로에서 떼어낸다.**
--
-- ── 왜 새 표인가 ────────────────────────────────────────────────────────────
-- P0-A.30.1 에서 막혔던 자리가 정확히 이것이다. Vision 관측은 지금까지
-- domestic_product_links 의 칸(056) 위에 얹혀 있었는데, E1 후보(교차판매처가
-- SIMILAR 이고 텍스트 등급이 low)는 그 링크가 «만들어지지 않는다»:
--
--     toDomesticMatchType("low") → NOT_MATCHED
--         → run-domestic-price-check.ts:481  continue
--         → 링크 없음 → vision_* 를 쓸 자리가 없음
--
-- 그렇다고 관측을 위해 링크를 만들면 그 순간 priceTier=COMPARISON 이 생겨
-- «관측만 했는데 가격 비교에 들어간다». 그래서 표를 나눈다.
--
--     domestic_product_links   가격 비교 · 등록 경로   (건드리지 않는다)
--     vision_observations      Vision 실험 · 관측 전용  (가격에 닿지 않는다)
--
-- ── 056 의 vision_* 컬럼은 «지우지 않는다» ──────────────────────────────────
-- CEO 지시 §7. 두 곳의 뜻이 다르다: 056 은 「링크가 된 후보의 관측」이고 여기는
-- 「링크가 되지 못한 후보까지 포함한 관측」이다. 나중에 합칠 일이 생기면
-- snapshot_id + external_url 로 이어붙일 수 있게 키를 맞춰 둔다.
--
-- ── 이 표를 읽는 «판정» 은 없다 ─────────────────────────────────────────────
-- 🔴 어떤 매칭/가격 코드도 이 표를 읽지 않는다. priceTierFromLink 는 여전히
--    match_truth·verified 만 읽고, deriveMatchTruth 는 이 표의 존재를 모른다.
--    임계값(HIGH/REVIEW/LOW)은 데이터가 쌓인 뒤 별도 시뮬레이션에서 긋는다.
--
-- ── 실패도 기록한다 ─────────────────────────────────────────────────────────
-- 🔴 지금까지 Vision 실패는 조용한 null 이었다. 「키가 없어서」와 「이미지를
--    못 받아서」와 「모델이 거절해서」가 구분되지 않으면, 점수가 안 쌓일 때
--    원인을 사후에 물을 수 없다. status 로 남긴다 — score 가 NULL 인 행이
--    «실패» 인지 «아직 안 봄» 인지 구분되어야 한다.
--
-- 되돌리기: DROP TABLE vision_observations;  (다른 표를 참조하지 않는다)

CREATE TABLE IF NOT EXISTS vision_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 무엇을 비교했나
  snapshot_id uuid NOT NULL REFERENCES product_snapshots(id) ON DELETE CASCADE,
  source_id uuid REFERENCES domestic_price_sources(id) ON DELETE SET NULL,
  shop_domain text NOT NULL,
  candidate_url text NOT NULL,
  origin_image_url text NOT NULL,
  candidate_image_url text NOT NULL,

  -- 어떤 조건에서 나온 점수인가(이게 없으면 나중에 임계값을 다시 못 긋는다)
  vision_model text NOT NULL,
  prompt_version text NOT NULL,
  media_resolution text NOT NULL,

  -- 관측 결과. 🔴 score 는 «성공했을 때만» 채운다. NULL 을 0 으로 읽지 않는다.
  score int CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  reason text,

  -- 🔴 조용한 실패 금지. score 가 NULL 인 이유가 여기 남는다.
  status text NOT NULL CHECK (status IN ('OK', 'NO_API_KEY', 'IMAGE_FETCH_FAILED', 'API_REJECTED', 'EMPTY_RESPONSE', 'PARSE_FAILED')),
  failure_detail text,

  -- 이 관측이 어떤 게이트로 들어왔나(E1 실험을 나중에 구분하기 위해)
  gate text NOT NULL DEFAULT 'E1_TEST',
  -- 교차판매처 판정 — 관측 당시의 값. 이 표는 판정하지 않고 «받아 적는다».
  cross_seller_verdict text,

  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 🔴 같은 후보를 같은 조건으로 다시 부르지 않는다. 모델·프롬프트·이미지 중
--    하나라도 바뀌면 다른 관측이므로 새 행이 생긴다(그게 재현의 조건이다).
CREATE UNIQUE INDEX IF NOT EXISTS vision_observations_dedupe
  ON vision_observations (snapshot_id, candidate_url, vision_model, prompt_version, media_resolution, origin_image_url, candidate_image_url);

CREATE INDEX IF NOT EXISTS vision_observations_snapshot ON vision_observations (snapshot_id);
CREATE INDEX IF NOT EXISTS vision_observations_shop ON vision_observations (shop_domain);
