-- ════════════════════════════════════════════════════════════════════════════
-- 081 — CANDIDATE-UX-REFINE-04 B: `candidate_reviews` 를 «분석 결과 저장소» 로 승격
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴🔴 왜 필요한가 (CEO 가 본 문제)
--   최초 분석 → 화면 표시 → 페이지 이탈 → `/pipeline?resume=…` 재진입
--   ⟹ GET 은 `computeMarketIntelligence(snapshotId, workspaceId)` 를 **인자 2개** 로
--      부르므로 transient 후보가 **하나도 실리지 않는다** ⟹ 가격비교가 빈다
--   ⟹ 셀러가 **「다시 분석」을 눌러 검색·크롤을 다시 돌려야** 했다.
--      「분석했는데 왜 또 분석하지?」 — 제품 흐름의 실패다(CPO).
--
-- 🟢 그런데 후보 자체는 **이미 저장되고 있다** — `recordSeenCandidates`(079).
--    빠진 것은 **카드를 그대로 복원하는 데 필요한 세 칸** 뿐이다.
--
-- ── 🔴 왜 이 세 칸이어야 하는가 ────────────────────────────────────────────
--   price_status   없으면 `isPriceConfirmed` 가 false ⟹ 재진입에서 **모든 가격이 P2**
--                  로 떨어진다 ⟹ 최초 화면과 **다른 말** 을 한다(P1 이 사라진다)
--   sold_out       판매여부 세 상태(ON_SALE/SOLD_OUT/UNKNOWN)를 복원하지 못한다
--   match_reasons  🔴🔴 `isModelCodeOnlyReference` 가 **그 길이** 를 게이트로 쓴다
--                  ⟹ 없으면 재진입에서 **「🟡 품번 충돌 · 참고」 군이 통째로 사라진다**
--                  (CPO ⒜ 확정 — ⒝「복원 전용 판정 분기」와 ⒞「정보 손실」을 버렸다)
--
-- ── 🔴 하지 않는 것 ────────────────────────────────────────────────────────
--   ❌ backfill — 기존 행은 **null 그대로** 둔다. `VERIFIED_CURRENT` 로 추정하지 않는다.
--      ⟹ 기존 행은 안전측 **P2(UNVERIFIED)** 로 표시된다(없는 정보를 만들지 않는다).
--   ❌ NOT NULL / default — 기존 데이터와 호환되어야 한다(전부 nullable).
--   ❌ 새 인덱스 · 새 제약 · UNIQUE 변경 — 079 의 **부분 유니크 둘** 을 그대로 둔다
--      (WU-141-R1 이 42P10 으로 한 번 깨진 자리다 — 건드리지 않는다).
--   ❌ Identity / 판정 / 가격 집계 정책 — 이 migration 은 **보관 칸만** 더한다.
--
-- 🔴 `migrations_manual` 은 **사람이 손으로 적용** 한다. 적용 전에 writer 를 배포하면
--    저장이 실패한다 ⟹ **이 파일을 먼저 적용하고** 코드를 배포한다.
-- ════════════════════════════════════════════════════════════════════════════

alter table candidate_reviews add column if not exists price_status text;
alter table candidate_reviews add column if not exists sold_out boolean;
alter table candidate_reviews add column if not exists match_reasons jsonb;

comment on column candidate_reviews.price_status is
  'CANDIDATE-UX-REFINE-04 — 최초 분석 시점의 derivePriceStatus 값 그대로. null 이면 안전측 P2(UNVERIFIED)로 표시한다. backfill 금지.';
comment on column candidate_reviews.sold_out is
  'CANDIDATE-UX-REFINE-04 — 최초 분석 시점의 판매여부. null 은 「판매중」이 아니라 「확인 불가」다.';
comment on column candidate_reviews.match_reasons is
  'CANDIDATE-UX-REFINE-04 — 운영 matchReasons 원문. 🔴 셀러 카드에 표시하지 않는다(-02/-03). isModelCodeOnlyReference 게이트 입력으로만 쓴다.';
