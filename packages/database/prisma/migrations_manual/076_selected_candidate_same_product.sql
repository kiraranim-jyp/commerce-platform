-- ════════════════════════════════════════════════════════════════════════════
-- 076 — Selected Source 는 «그 Product 의» 후보여야 한다 (PIVOT-03-B ①)
-- ════════════════════════════════════════════════════════════════════════════
--
-- CPO 지시 9번: 아래 상태를 API 가 허용하면 안 된다.
--
--     Product A ─ Candidate A
--     Product B ─ Candidate B
--     🔴 Product A.selected = Candidate B      ← 막아야 한다
--
-- 075 의 FK 는 「그 id 가 sourcing_candidates 에 존재한다」만 보장하고
-- 「그 후보가 **이** Product 의 것이다」는 보장하지 않는다. 그래서 복합 FK 로 바꾼다.
--
-- ── 🔴 왜 API 검증만으로 두지 않는가 ────────────────────────────────────────
-- 이 저장소는 「호출부 하나가 빼먹는다」로 같은 사고를 세 번 겪었다
-- (P0-KC-11/12 · P2-1 A 원산지 — 전부 실측 400 으로 드러났다). 쓰기 경로가
-- 하나일 때는 API 검증이 충분해 보이지만, 경로가 둘이 되는 순간 뚫린다.
-- **구조적 보증을 DB 에 두고, API 는 사람에게 «설명» 하는 역할을 한다** —
-- 둘은 역할이 다르므로 둘 다 둔다(API 쪽은 03-B 코드에서).
--
-- ── NULL 이 문제가 되지 않는다 ──────────────────────────────────────────────
-- 복합 FK 의 기본 `MATCH SIMPLE` 은 **참조 컬럼 중 하나라도 NULL 이면 검사를
-- 건너뛴다.** 아직 고르지 않은 Product(대다수)는 그대로 통과한다.
--
-- ── 🔴 ON DELETE SET NULL 에 컬럼을 «지정» 한다 ─────────────────────────────
-- 지정하지 않으면 참조 컬럼 «전부» 를 NULL 로 만들려 하고, `products.id` 는
-- PK(NOT NULL) 이므로 **후보 삭제가 에러로 실패한다.** 컬럼 지정 문법은
-- PostgreSQL 15+ 이고, 실측으로 확인했다:
--     select version() → PostgreSQL 17.6 (2026-10-05, CEO 실행)
-- 🔴 추측하지 않고 버전을 받아 확인한 뒤 이 문법을 골랐다.
--
-- ── 🔴 Prisma 는 이 제약을 «모른다» ────────────────────────────────────────
-- Prisma 스키마의 `selectedSourcingCandidate` 관계는 단일 필드 관계로 남는다 —
-- 복합 FK 를 그 모델로 표현할 방법이 없다. 즉 **Prisma 의 계약이 DB 보다 느슨하다.**
-- 쿼리가 틀리게 생성되지는 않는다(느슨한 쪽이 부분집합이다). 다만 「Prisma 가
-- 허용하는데 DB 가 거절하는」 경우가 있을 수 있으므로, API 가 그 거절을 사람이
-- 읽을 수 있는 말로 바꿔야 한다 — 그것이 03-B 의 일이다.
--
-- ── 이 파일이 하지 «않는» 것 ────────────────────────────────────────────────
-- · 데이터를 고치지 않는다(UPDATE/DELETE 0건). 075 적용 직후라 선택된 행이 없다.
-- · 다른 표를 건드리지 않는다.
-- · 자동 선택/자동 해제를 만들지 않는다 — 품절은 availability 로 표시하고
--   선택은 유지한다(PIVOT-02 Case 4 결정).
--
-- 선행: 075(sourcing_candidates + products.selected_sourcing_candidate_id)
-- ════════════════════════════════════════════════════════════════════════════

-- ① 복합 FK 의 피참조 측 UNIQUE.
--    `id` 가 이미 PK 라 (product_id, id) 의 중복은 구조적으로 불가능하다 —
--    즉 이 인덱스는 «제약을 더하지 않고» 복합 FK 가 참조할 대상만 만든다.
CREATE UNIQUE INDEX IF NOT EXISTS sourcing_candidates_product_id_id_key
  ON sourcing_candidates(product_id, id);

-- ② 075 가 만든 단일 FK 를 찾아 떼어낸다.
--    🔴 이름을 추측해서 DROP 하지 않는다 — Postgres 가 자동 생성한 이름에
--    의존하면 환경에 따라 0건 삭제가 되고, 그러면 ③ 이 중복 FK 를 만든다.
--    products 에서 sourcing_candidates 를 참조하는 FK 를 «찾아» 떼어낸다.
DO $$
DECLARE
  constraint_name_var TEXT;
BEGIN
  FOR constraint_name_var IN
    SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel  ON rel.oid = con.conrelid
      JOIN pg_class fref ON fref.oid = con.confrelid
     WHERE con.contype = 'f'
       AND rel.relname = 'products'
       AND fref.relname = 'sourcing_candidates'
  LOOP
    EXECUTE format('ALTER TABLE products DROP CONSTRAINT %I', constraint_name_var);
  END LOOP;
END $$;

-- ③ 복합 FK — 「products.id 와 candidate.product_id 가 같다」가 제약 자체가 된다.
--    🔴 ON DELETE SET NULL (컬럼지정): 후보가 지워지면 선택만 풀리고
--       products.id 는 건드리지 않는다. PG 15+ 문법(실측 17.6).
ALTER TABLE products
  ADD CONSTRAINT products_selected_candidate_same_product_fkey
  FOREIGN KEY (id, selected_sourcing_candidate_id)
  REFERENCES sourcing_candidates(product_id, id)
  ON DELETE SET NULL (selected_sourcing_candidate_id);

-- ════════════════════════════════════════════════════════════════════════════
-- 적용 후 기대 — 🔴 숫자를 미리 단정하지 않는다
-- ════════════════════════════════════════════════════════════════════════════
--
-- 선택 안 한 Product            selected = NULL  → MATCH SIMPLE 로 통과
-- 자기 후보를 선택한 Product     통과
-- 🔴 남의 후보를 선택 시도       FK 위반으로 «거절»  ← 이 파일의 목적
-- 후보 삭제                     그 후보를 가리키던 선택만 NULL (삭제는 성공)
--
-- 확인 질의(적용 후):
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'products'::regclass and contype = 'f';
--   → products_selected_candidate_same_product_fkey 가 «하나만» 있어야 한다
--     (075 의 단일 FK 가 남아 있으면 ② 가 못 찾은 것이다)
--
-- 🔴 되돌리기
--   ALTER TABLE products DROP CONSTRAINT IF EXISTS products_selected_candidate_same_product_fkey;
--   ALTER TABLE products
--     ADD CONSTRAINT products_selected_sourcing_candidate_id_fkey
--     FOREIGN KEY (selected_sourcing_candidate_id)
--     REFERENCES sourcing_candidates(id) ON DELETE SET NULL;
--   DROP INDEX IF EXISTS sourcing_candidates_product_id_id_key;
-- ════════════════════════════════════════════════════════════════════════════
