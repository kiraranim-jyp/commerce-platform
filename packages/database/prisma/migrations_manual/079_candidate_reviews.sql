-- ════════════════════════════════════════════════════════════════════════════
-- 079 — CandidateReview (WU-131, CPO 작업지시 2026-10-20)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴🔴 **운영에 «없던» 계층을 새로 만든다.** 기존 49건 GT 를 버리고 다시 만드는
--    것이 아니라, 지금까지 어디에도 담기지 못한 「후보 검토 이력」을 담는다.
--
-- ── 왜 필요한가 (WU-131 §2 조사 · 원인 넷이 전부 다르다) ────────────────────
--   ⒜ 기존 Human GT 49건이 **테스트 fixture 에만** 있다 — 운영 import 경로 0
--   ⒝ WU-081 셀러 판단이 `useState({})` 뿐이다 → **새로고침하면 사라진다**
--   ⒞ 후보 자체가 transient 라 **저장되지 않는다** → 다음 검색에 안 걸리면 사라진다
--   ⒟ 🔴 **담을 칸이 없다** — `domestic_product_links.verified` 는 「관리자 승인」
--      (가격 수집 자격)이고 SAME/DIFFERENT **GT 가 아니다**(029 주석 참조)
--
-- ── 🔴🔴 system 과 human 은 «서로 덮지 않는다» ───────────────────────────────
--   `system_verdict = PRESUMED_SAME` + `human_verdict = DIFFERENT` 를 **둘 다** 둔다.
--   그 불일치가 바로 **MI 개선용 GT** 다 — 한쪽을 지우면 그 신호가 사라진다.
--   🔴 이번 WU 에서 MI 가 이 값을 학습하거나 판정 규칙을 바꾸지 않는다.
--
-- ── 🔴 가격은 «표시용» 이다 ─────────────────────────────────────────────────
--   price_amount/currency 는 후보 카드에 그대로 적기 위한 값이고, 집계·판정·alert
--   에 들어가지 않는다(WU-131 §13 — 가격 로직 불변).
--
-- ── 🔴🔴 UNIQUE 를 `candidate_url` «단독» 으로 두지 않는다 ───────────────────
--   다른 원상품이 **같은 판매처 URL** 을 가질 수 있다(B226AC009/AC010 이 실제로
--   호스트를 공유한다). 단독 UNIQUE 면 두 원상품의 검토가 서로를 덮어쓴다.
--   그래서 **부분 유니크 둘** 이다:
--     · snapshot 이 있는 행   → (snapshot_id, candidate_url)
--     · snapshot 이 없는 GT 행 → (origin_code, candidate_url)
--   🔴 후자는 원상품 snapshot 이 아직 없는 과거 GT(B226AC010 류)를 담을 자리다.
--
-- 적용: packages/database 에서
--   node --env-file=.env scripts/wu-131-apply-079.mjs
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists candidate_reviews (
  id uuid primary key default gen_random_uuid(),

  -- 🔴 소유 경계. 남의 workspace 검토를 읽지 못하게 라우트가 이 값으로 거른다.
  workspace_id uuid,

  -- 🟢 원상품 축 둘. 🔴 **둘 다 null 이면 안 된다**(아래 check).
  --    snapshot_id = 지금 화면에 떠 있는 그 원상품
  --    origin_code = snapshot 이 없는 과거 GT 를 담는 자리(B226AC010 류)
  snapshot_id uuid references product_snapshots(id) on delete cascade,
  origin_code text,

  -- 🔴 후보 식별자. 정규화는 `canonicalizeProductUrl`(WU-009C)이 한다 — 새 정규화기 금지.
  candidate_url text not null,
  candidate_domain text,
  candidate_title text,
  image_url text,

  -- 🔴 표시용 가격. 집계·판정에 들어가지 않는다.
  price_amount numeric,
  price_currency text,
  market text,

  -- 🟢 MI 가 낸 값 «그대로». 사람 판단이 이 칸을 덮지 않는다.
  system_verdict text,
  match_truth text,
  price_tier text,
  blockers jsonb,

  -- 🔴 사람 판단. 네 상태뿐이다.
  human_verdict text check (human_verdict in ('SAME', 'SIMILAR', 'DIFFERENT', 'UNDECIDED')),
  human_note text,

  -- 🔴 출처를 잃지 않는다(WU-024/130 과 같은 원칙).
  source text not null check (
    source in ('OVERSEAS_AUTO', 'DOMESTIC_REGISTRY', 'SELLER_URL', 'GEMINI', 'GT_IMPORT')
  ),

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_at timestamptz,

  -- 🔴 원상품 축이 **하나는 있어야** 한다 — 없으면 어느 상품의 검토인지 알 수 없다.
  constraint candidate_reviews_origin_present check (snapshot_id is not null or origin_code is not null)
);

-- 🔴🔴 부분 유니크 둘(위 머리 주석의 이유). 🟢 `create unique index` 라서
--    같은 후보가 매 조회마다 쌓이지 않고 upsert 로 갱신된다.
create unique index if not exists candidate_reviews_snapshot_url_key
  on candidate_reviews (snapshot_id, candidate_url)
  where snapshot_id is not null;

create unique index if not exists candidate_reviews_origin_url_key
  on candidate_reviews (origin_code, candidate_url)
  where snapshot_id is null and origin_code is not null;

-- 🟢 조회 축 — 「이 원상품의 검토 이력 전부」가 기본 질의다.
create index if not exists candidate_reviews_snapshot_idx on candidate_reviews (snapshot_id);
create index if not exists candidate_reviews_origin_idx on candidate_reviews (origin_code);
create index if not exists candidate_reviews_workspace_idx on candidate_reviews (workspace_id);
