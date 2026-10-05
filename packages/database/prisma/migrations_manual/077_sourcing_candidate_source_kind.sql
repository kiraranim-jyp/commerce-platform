-- ════════════════════════════════════════════════════════════════════════════
-- 077 — source_kind: 후보의 «출처 사실» (PIVOT-03-B ③, CPO 확정 2026-10-05)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 075 가 남긴 결함을 닫는다. `originating_snapshot_id` 하나로 「셀러가 직접
-- 넣었는가」를 판단하려 했는데, 그것이 **invariant 가 아니다**:
--
--     075:56  originating_snapshot_id … REFERENCES product_snapshots(id)
--                                       ON DELETE SET NULL      ← 두 번째 NULL 경로
--
-- 그래서 NULL 이 «두 가지» 를 뜻한다:
--     ① 처음부터 snapshot 없이 셀러가 직접 입력
--     ② 수집에서 발견됐는데 그 snapshot 이 «삭제돼» provenance 를 잃음
-- ②는 이론이 아니라 실재하는 경로다 — `DELETE /api/snapshots/[id]` 가 있다.
--
-- 🔴 그 상태로 「NULL = 셀러 직접 입력」이라고 화면에 적으면, snapshot 을 지운
-- 셀러에게 **「당신이 직접 넣은 후보」라고 거짓말** 한다. 이 저장소가 반복해 지켜
-- 온 원칙이 바로 그것이다 — 「알 수 없음」과 「없음」을 섞지 않는다.
--
-- ── 두 칸이 «다른 일» 을 한다 ───────────────────────────────────────────────
--     originating_snapshot_id   provenance «링크»  — 사라질 수 있다
--     source_kind               출처 «사실»       — 사라지지 않는다
-- 그래서 snapshot 을 지운 뒤에도 `DISCOVERED` 라는 사실은 보존된다.
--
-- ── 🔴 기존 행을 backfill 하지 «않는다» (CPO 확정) ──────────────────────────
-- 기존 행의 실제 생성 경로를 코드로 증명할 수 없다. 추측해서 SELLER_ENTERED 로
-- 채우면 그것이 「사실」로 굳는다. NULL 로 남기고 **UNKNOWN / UNRESOLVED** 로
-- 취급한다 — 신규 정상 상태가 아니라 «migration 이전 미확정» 상태다.
-- (075 적용 직후라 실제 행은 0건일 것이다. 그래도 backfill 문을 두지 않는다.)
--
-- ── 어휘 패턴은 기존 그대로 ─────────────────────────────────────────────────
-- 이 저장소는 Postgres enum 을 쓰지 않는다 — `text` + CHECK 다(030 의 match_truth,
-- 075 의 availability). 새 방식을 들이지 않는다.
--
-- 선행: 075(sourcing_candidates) · 076(복합 FK)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE sourcing_candidates
  ADD COLUMN IF NOT EXISTS source_kind TEXT NULL
  CHECK (source_kind IS NULL OR source_kind IN ('DISCOVERED', 'SELLER_ENTERED'));

-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 DB 가 지킬 수 있는 invariant «하나» 만 제약으로 넣는다
-- ════════════════════════════════════════════════════════════════════════════
--
-- 지킬 수 있는 것:
--     SELLER_ENTERED  →  originating_snapshot_id 는 NULL 이어야 한다
--     셀러가 직접 넣은 후보에 수집 provenance 가 붙어 있으면 그 자체로 모순이다.
--     이것은 «언제나» 참이므로 CHECK 로 넣는다.
--
-- 🔴 지킬 수 «없는» 것 — 그래서 CHECK 로 넣지 않는다:
--     DISCOVERED  →  생성 «시점» 에는 snapshot 이 있어야 한다
--     생성 시점의 조건이고, snapshot 삭제 후에는 `DISCOVERED + NULL` 이 **정상**
--     이다. CHECK 는 「언제나」를 요구하므로 이 규칙을 표현할 수 없다 —
--     그래서 **API 가 생성 시점에만** 검증한다(CRUD 구현에서).
--     🔴 이 비대칭을 적어 두지 않으면 다음 사람이 「왜 한쪽만 CHECK 인가」를
--        모르고 나머지를 추가하려 한다. 추가하면 snapshot 삭제가 깨진다.
ALTER TABLE sourcing_candidates
  DROP CONSTRAINT IF EXISTS sourcing_candidates_seller_entered_has_no_snapshot;
ALTER TABLE sourcing_candidates
  ADD CONSTRAINT sourcing_candidates_seller_entered_has_no_snapshot
  CHECK (source_kind <> 'SELLER_ENTERED' OR originating_snapshot_id IS NULL);

CREATE INDEX IF NOT EXISTS sourcing_candidates_source_kind_idx
  ON sourcing_candidates(source_kind);

-- ════════════════════════════════════════════════════════════════════════════
-- 적용 후 기대
-- ════════════════════════════════════════════════════════════════════════════
--
--   source_kind      originating_snapshot_id   뜻
--   ---------------  ------------------------  ------------------------------------
--   DISCOVERED       있음                      수집에서 발견 — provenance 살아 있음
--   DISCOVERED       NULL                      수집에서 발견 — snapshot 이 삭제됨 ✅정상
--   SELLER_ENTERED   NULL                      셀러 직접 입력
--   🔴 SELLER_ENTERED  있음                     **CHECK 위반 — 거절된다**
--   NULL             (무엇이든)                 legacy 미확정(UNKNOWN/UNRESOLVED)
--
-- 🔴 ON DELETE SET NULL 은 «그대로» 둔다 — DB 안전망과 API UX 정책은 별개다
--    (CPO 확정). snapshot 삭제가 후보를 죽이지 않는다.
--
-- 확인 질의(적용 후):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'sourcing_candidates'::regclass and contype = 'c';
--   → source_kind 허용값 CHECK · seller_entered_has_no_snapshot 둘이 보여야 한다
--   select source_kind, count(*) from sourcing_candidates group by 1;
--   → 075 직후라면 0행. 행이 있다면 전부 NULL 이어야 한다(backfill 안 했으므로).
--
-- 🔴 되돌리기
--   DROP INDEX IF EXISTS sourcing_candidates_source_kind_idx;
--   ALTER TABLE sourcing_candidates
--     DROP CONSTRAINT IF EXISTS sourcing_candidates_seller_entered_has_no_snapshot;
--   ALTER TABLE sourcing_candidates DROP COLUMN IF EXISTS source_kind;
-- ════════════════════════════════════════════════════════════════════════════
