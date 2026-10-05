-- ════════════════════════════════════════════════════════════════════════════
-- 075 — SourcingCandidate + Selected Source (PIVOT-03-A, CPO 확정 2026-10-05)
-- ════════════════════════════════════════════════════════════════════════════
--
-- PIVOT-01/02 조사로 확정된 책임 경계를 DB 에 고정한다. 🔴 새 제품 구조를 처음부터
-- 만드는 것이 «아니다» — 이미 있는 Product / Snapshot / Commerce 사이에 빠진 두
-- 개념을 끼우는 것뿐이다.
--
--   Product            persistent identity          (이미 있다, 063/065/066)
--   Snapshot           collection / analysis run    (이미 있다, 016)
--   SourcingCandidate  sourcing evidence            ← 🔴 이 파일
--   Selected Source    seller's explicit decision   ← 🔴 이 파일
--   Master Ready       derived application state    (DB 에 저장 «안 한다»)
--   Commerce Product   channel registration result  (이미 있다, 063)
--
-- ── 🔴 Candidate 의 소유자는 Product 다 (PIVOT-02 ①) ────────────────────────
-- snapshot 에 매달면 재분석 때 사라진다 — snapshot 은 「수집·분석 1회」이고, 그
-- 소실이 바로 schema.prisma 머리 주석이 기록한 사고 구조다(한 상품이 SmartStore
-- 외부번호 6개로 갈라진 일). 그래서 Product 소유이고, 「어느 수집에서 봤는가」는
-- `originating_snapshot_id` 로 **따로** 남긴다(provenance).
--
-- ── 🔴 MI 결과를 넣지 «않는다» (PIVOT-02 ③) ─────────────────────────────────
-- CASE A/B/C/D · 마진 · radar · 최종판정 칸이 이 표에 없다. 의도다.
-- 그 값들은 가격·환율·배송비·수수료·판매가가 바뀌면 달라지는 **현재 시점의 계산**
-- 이고, 박아 두면 「22.4%」가 지금 판단인지 과거 스냅샷인지 모호해진다.
-- 이 표가 책임지는 것은 **「무엇을 어디서 얼마에 사오는가」** 하나다.
-- 🔴 감사용 결정 이력이 필요해지면 `Decision History` 라는 «별도» 개념으로
--    확장한다 — 이 표에 그 책임을 억지로 넣지 않는다(CPO 확정).
--
-- ── 🔴 어휘를 새로 만들지 않았다 ─────────────────────────────────────────────
-- `availability`  = packages/shared/src/source-stock.ts 의 SourceStockState 그대로
-- `match_truth`   = 030 이 domestic_product_links 에 쓴 CHECK 목록 그대로
-- 두 곳이 다른 말을 쓰면 같은 사실이 화면마다 달라진다.
--
-- ── 이 파일이 하지 «않는» 것 ─────────────────────────────────────────────────
-- · 기존 표를 고치지 않는다 — products 에 컬럼 하나만 «더한다»(ADD COLUMN).
-- · sourceUrl 기반 자동 merge 를 만들지 않는다(자동 merge 금지, CPO 확정).
--   같은 상품을 다른 URL 로 수집하면 Product 가 둘이고 후보도 갈린다 — 현재 정책상
--   정상이며, 사람이 확인하는 병합은 «별도 capability» 다.
-- · MI · Commerce · SmartStore · Coupang 경로를 건드리지 않는다.
-- · 상태 lifecycle 컬럼을 만들지 않는다 — Master Ready 는 애플리케이션 계산이다.
--
-- 선행: 016(product_snapshots) · 063(Product/ChannelProduct) · 065(표 이름 products)
--       · 066(products.workspace_id)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sourcing_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 🔴 소유자. CASCADE: Product 를 지우면 그 후보도 의미가 없다.
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- 🔴 provenance — 「어느 수집에서 이 후보를 봤는가」.
  -- SET NULL: snapshot 이 지워져도 후보는 산다(소유자는 Product 다).
  -- NULL 허용: 수집 밖에서 셀러가 직접 넣은 후보가 있을 수 있다.
  originating_snapshot_id UUID NULL REFERENCES product_snapshots(id) ON DELETE SET NULL,

  -- 066 과 같은 격리. workspace 를 지우면 함께 지운다.
  workspace_id UUID NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- ── 소싱처 정체성 ──────────────────────────────────────────────────────────
  source_url  TEXT NOT NULL,
  source_site TEXT NOT NULL,
  -- 🔴 국가/통화를 추론하지 않는다. 모르면 NULL 이다(「알 수 없음」과 「없음」을
  --    섞지 않는다 — 이 저장소가 반복해 지켜 온 원칙).
  source_country TEXT NULL,

  -- ── 원가 근거 (관측값) ─────────────────────────────────────────────────────
  -- 🔴 판매가가 «아니다». 국내 판매가는 price_observations 쪽 축이고, 그 둘을 한
  --    칸에 합치면 원가와 판매가가 섞인다(CPO 금지 항목).
  price_amount NUMERIC NULL,
  currency     TEXT NULL,

  -- 🔴 SourceStockState 그대로 — source-stock.ts 와 같은 말을 쓴다.
  availability TEXT NULL
    CHECK (availability IS NULL OR availability IN (
      'IN_STOCK', 'OUT_OF_STOCK', 'INVALID', 'UNKNOWN'
    )),

  -- 배송 근거 — 숫자를 지어내지 않는다. 원문/메모를 그대로 남긴다.
  shipping_note TEXT NULL,

  -- ── 동일상품 근거 ─────────────────────────────────────────────────────────
  -- 🔴 030 이 domestic_product_links 에 쓴 목록 그대로다(새 어휘 금지).
  identity_match_truth TEXT NULL
    CHECK (identity_match_truth IS NULL OR identity_match_truth IN (
      'EXACT_IDENTIFIER', 'STRONG_IDENTIFIER', 'TEXT_CONFIRMED',
      'SIMILAR', 'INSUFFICIENT_EVIDENCE', 'CONFLICT'
    )),

  -- 🔴 관측 시각 — 「언제 본 가격인가」. 이것이 없으면 후보가 낡았는지 말할 수 없다.
  observed_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sourcing_candidates_product_idx
  ON sourcing_candidates(product_id);
CREATE INDEX IF NOT EXISTS sourcing_candidates_workspace_idx
  ON sourcing_candidates(workspace_id);
CREATE INDEX IF NOT EXISTS sourcing_candidates_snapshot_idx
  ON sourcing_candidates(originating_snapshot_id);

-- 🔴 같은 Product 안에서 같은 소싱처 URL 이 두 번 서지 않는다. 가격이 바뀌면
--    «행을 더하지 않고» 그 행을 갱신한다(Case 3: 가격 변경은 Candidate 의 정체성을
--    바꾸지 않는다). 가격 «이력» 이 필요하면 price_observations 가 이미 그 일을
--    한다 — 여기서 이력 표를 새로 만들지 않는다.
CREATE UNIQUE INDEX IF NOT EXISTS sourcing_candidates_product_source_url_key
  ON sourcing_candidates(product_id, source_url);

-- ════════════════════════════════════════════════════════════════════════════
-- Selected Source — 셀러의 «명시적» 소싱 결정 (PIVOT-02 ②)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 Product 에 둔다. snapshot workspace jsonb 에 넣으면 재분석 때 사라진다.
-- 🔴 파생시키지 «않는다» — 이것은 계산 결과가 아니라 사람의 의사표시다.
--    (반면 Master Ready 는 파생이다: Product ∧ selected ∧ readiness.)
-- 🔴 SET NULL: 후보 행이 지워지면 선택이 풀린다. 다만 **품절로는 지우지 않는다** —
--    Case 4 결정대로 availability 를 OUT_OF_STOCK 으로 두고 선택은 유지한다.
--    선택을 자동으로 풀면 셀러가 «왜 풀렸는지» 알 수 없다.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS selected_sourcing_candidate_id UUID NULL
  REFERENCES sourcing_candidates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_selected_sourcing_candidate_idx
  ON products(selected_sourcing_candidate_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 적용 후 기대 — 🔴 기존 동작이 한 점도 바뀌지 않는다
-- ════════════════════════════════════════════════════════════════════════════
--
-- · 새 표 하나 + products 에 nullable 컬럼 하나. 기존 행은 전부 NULL 이다.
-- · 읽는 코드가 아직 «없다» — 이 마이그레이션만으로는 화면도 API 도 바뀌지 않는다.
--   (PIVOT-03-B 가 API, 03-C 가 UI 다. 한꺼번에 만들지 않는 것이 CPO 결정이다.)
-- · 기존 등록 경로는 그대로다: ChannelProduct 는 여전히 Product 에 매달리고,
--   snapshot.product_id 도 그대로다.
--
-- 🔴 되돌리기
--   DROP INDEX IF EXISTS products_selected_sourcing_candidate_idx;
--   ALTER TABLE products DROP COLUMN IF EXISTS selected_sourcing_candidate_id;
--   DROP TABLE IF EXISTS sourcing_candidates;
--   (순서가 중요하다 — products 의 FK 를 먼저 떼야 표를 지울 수 있다.)
-- ════════════════════════════════════════════════════════════════════════════
