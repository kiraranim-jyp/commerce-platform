-- ════════════════════════════════════════════════════════════════════════════
-- 080 — candidate_reviews.source 에 국내 생산자 둘을 «더한다»
--        (CPO 승인 2026-11-06 · 안 ⓒ)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴🔴 왜 필요한가(실측 2026-11-06):
--   국내 검색 생산자는 **돌고 있었다** — 전수 9건에서
--     WEB_SEARCH **10** · DOMESTIC_LISTING **3**
--   그런데 그 후보 «행» 을 담을 자리가 없었다:
--     · 079 의 source CHECK 가 그 둘을 **담지 못한다**(아래 기존 목록)
--     · workspace.searchRun 은 **집계만** 담고, 그 칸에 URL·제목을 싣는 것은
--       O-1 보안 계약(「저장 payload 는 숫자만 담는다」)이 **금지** 한다
--   ⟹ 국내 후보 행이 **버려졌다**. 🔴 「국내 후보가 없다」도 「국내 검색이 안 돈다」도
--      사실이 아니었다 — 생산은 됐고 **보존이 안 됐다**.
--
-- 🟢 그래서 **URL·상품명 보관이 원래 목적인 이 표** 에 담는다(해외 180행이 이미 그렇게 있다).
-- 🔴 O-1 보안 계약은 **그대로 유지** 된다 — searchRun 은 숫자만 담는다.
--
-- ── 이 migration 이 «하지 않는» 것 ──────────────────────────────────────────
-- 🔴 기존 행을 고치지 않는다(UPDATE 0 · DELETE 0).
-- 🔴 기존 source 값 다섯을 빼지 않는다 — **두 값을 더할 뿐이다**.
-- 🔴 다른 CHECK(human_verdict · origin_present)를 건드리지 않는다.
-- 🔴 인덱스·유니크(079 의 부분 유니크 둘)를 건드리지 않는다.
--
-- ── 적용 전 기준선(실측) ────────────────────────────────────────────────────
--   행 180 · 고유 URL 90 · CEO GT 38
--   source — OVERSEAS_AUTO 156 · GT_IMPORT 17 · SELLER_URL 7
--   🔴 적용 후 이 숫자가 **한 자리도 달라지면 안 된다**(아래 검증 질의).
--
-- 🟢 멱등이다 — 두 번 돌려도 안전하다(DROP IF EXISTS → ADD).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- 🔴 기존 제약을 먼저 떼고 다시 붙인다. Postgres 는 CHECK 를 «수정» 할 수 없다.
ALTER TABLE candidate_reviews
  DROP CONSTRAINT IF EXISTS candidate_reviews_source_check;

ALTER TABLE candidate_reviews
  ADD CONSTRAINT candidate_reviews_source_check
  CHECK (
    source = ANY (
      ARRAY[
        -- ── 기존 다섯(079) — 🔴 한 값도 빼지 않았다 ──
        'OVERSEAS_AUTO'::text,
        'DOMESTIC_REGISTRY'::text,
        'SELLER_URL'::text,
        'GEMINI'::text,
        'GT_IMPORT'::text,
        -- ── 080 신규 둘 — 🟢 운영에서 «이미 돌고 있는» 국내 생산자 이름 그대로 ──
        --    🔴 이름을 지어내지 않았다: run-domestic-price-check 의
        --       webSearchEvidence / domesticListingEvidence 가 쓰는 라벨이고
        --       workspace.searchRun.producers 의 키와도 **같은 문자열** 이다.
        'WEB_SEARCH'::text,
        'DOMESTIC_LISTING'::text
      ]
    )
  );

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- 적용 후 검증(손으로 돌린다 · 🔴 숫자가 기준선과 같아야 한다)
-- ════════════════════════════════════════════════════════════════════════════
-- ① 행 수·URL·GT 가 불변인가 — 기대 180 / 90 / 38
--   select count(*) rows, count(distinct candidate_url) urls,
--          count(*) filter (where human_verdict is not null) gt from candidate_reviews;
--
-- ② 기존 source 분포가 불변인가 — 기대 OVERSEAS_AUTO 156 · GT_IMPORT 17 · SELLER_URL 7
--   select source, count(*) from candidate_reviews group by 1 order by 2 desc;
--
-- ③ 🔴 기존 값이 **여전히 통과** 하는가(제약이 좁아지지 않았는가)
--   select count(*) from candidate_reviews
--    where source not in ('OVERSEAS_AUTO','DOMESTIC_REGISTRY','SELLER_URL',
--                         'GEMINI','GT_IMPORT','WEB_SEARCH','DOMESTIC_LISTING');
--   -- 기대 0
--
-- ④ 🟢 새 값이 **실제로 들어가는가** / 🔴 엉뚱한 값은 **여전히 막히는가**
--   -- 들어가야 한다:  source = 'WEB_SEARCH' · 'DOMESTIC_LISTING'
--   -- 막혀야 한다:    source = 'NOT_A_PRODUCER'  → 23514 check_violation
--
-- ⑤ 🔴 079 의 부분 유니크 둘이 살아 있는가
--   select indexname from pg_indexes where tablename='candidate_reviews';
-- ════════════════════════════════════════════════════════════════════════════
