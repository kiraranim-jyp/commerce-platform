-- DOMESTIC-SHIPPING-02 1단계(CEO 지시, 2026-09-16) — "배송비를 모른다"를 적을
-- 자리를 만든다. 계산에 넣지 않는다. 판정을 바꾸지 않는다. 화면도 그대로다.
--
-- ── CEO 원문 ────────────────────────────────────────────────────────────────
--   "배송비를 모른다는 것도 데이터다. 하지만 배송비가 무료다와 같은 데이터는
--    아니다. 이번 작업은 그 구분을 시스템에 박아 넣는 데까지만 간다."
--
-- ── 왜 «금액» 칸이 아니라 «상태» 칸인가 ─────────────────────────────────────
-- shipping_cost_amount 는 027부터 이미 있다(numeric, nullable). 그런데 그 한 칸은
-- 다음 다섯 가지를 전부 null 또는 숫자 하나로 뭉갠다:
--   · 아직 읽어보지 않았다              · 읽었지만 못 찾았다
--   · 상품 페이지에 아예 없는 값이다    · 확인된 무료다(0)
--   · 조건부 무료다("5만원 이상 무료")
-- 이 중 «확인된 무료»만 숫자 0으로 표현 가능하고, 나머지는 전부 null 이 된다.
-- 그래서 null 하나가 "모른다"와 "안 봤다"와 "주문할 때 정해진다"를 같은 값으로
-- 만든다 — 45885bf(GOLF-04B)가 잡은 `?? 0` 회귀의 뿌리가 정확히 이 자리다.
-- 던롭 공식몰 「고객직접선택」은 파서가 못 읽은 값이 아니라 주문 단계에서
-- 정해지는 값인데, 오늘의 스키마에는 그 둘을 구분해서 적을 칸이 없다.
--
-- 그래서 금액 칸을 늘리지 않고 «상태 + 근거» 두 칸만 더한다.
--
-- ── 다섯 값의 의미(코드의 단일 출처: packages/pricing/src/shipping-policy.ts) ─
--   null              컬럼이 없던 시절의 행 / 아직 상태 데이터가 없는 경우
--   'UNREAD'          읽어봤지만 배송비 정책을 아직 확인하지 못함 → 고치면 알 수 있다
--   'ORDER_TIME'      상품 페이지에 없고 주문 단계에서 결정      → 고쳐도 안 나온다
--   'FREE'            확인된 무료배송        (shipping_cost_amount = 0)
--   'FLAT'            확인된 고정 배송비      (shipping_cost_amount = N)
--   'CONDITIONAL_FREE' 조건부 무료배송        (shipping_cost_amount = null)
--
-- 🔴 CONDITIONAL_FREE 에 금액을 넣지 않는다. "5만원 이상 무료"는 숫자 한 칸에
--    들어가지 않는다 — 억지로 넣으면 그 숫자가 "이 상품의 배송비"로 읽힌다.
--    조건 원문은 shipping_policy_note 에 판매처 «원문 그대로» 남긴다.
-- 🔴 shipping_policy_note 에 우리가 해석한 값을 적지 않는다(046 의 market_code
--    원칙 그대로 — 관측과 해석을 섞지 않는다).
--
-- ── DEFAULT 도 backfill 도 없다(CEO 명시) ───────────────────────────────────
-- 🔴 DEFAULT 'FREE' 나 DEFAULT 0 을 넣으면 «무료배송» 이라는 없는 사실이 기존
--    1,073 행에 즉시 생긴다. 최악의 기본값이다.
-- 🔴 NOT NULL DEFAULT 'UNREAD' 도 안 된다 — 「컬럼이 없던 시절의 행」과
--    「읽었는데 못 찾은 행」이 같은 값이 되어, 이 마이그레이션이 없애려던
--    바로 그 혼동을 스스로 만든다. UNREAD 는 «읽어봤다»는 주장이고, 기존 행에
--    대해 우리는 그 주장을 할 근거가 없다.
-- 046 선례(market_code/market_country)와 완전히 같은 판단이다: 모르는 것은
-- null 로 남는다. 이 파일에는 update 도 delete 도 없다.
--
-- ── 적용 전/후 행 수 ────────────────────────────────────────────────────────
--   select count(*) from price_observations;   -- 적용 전후가 같아야 한다
-- (이 파일은 행을 만들지도 지우지도 고치지도 않는다. alter table 두 줄뿐이다.)

alter table price_observations add column if not exists shipping_policy_status text;
alter table price_observations add column if not exists shipping_policy_note text;

-- 어휘를 DB 에서 닫는다. 코드(shipping-policy.ts)의 SHIPPING_POLICY_STATUSES 와
-- 글자 그대로 같은 다섯 개다 — 한쪽만 늘어나면 domestic-shipping-02.test.ts 가
-- 이 파일을 직접 읽어서 깨진다.
--
-- 051 의 access_status 와 같은 모양: `is null or in (...)`. null 을 제약이
-- 막지 않는다 — null 은 "상태 데이터 없음"이라는 정당한 값이기 때문이다.
-- 027/031 처럼 중복 실행이 전제이므로 제약 추가도 조건부로 감싼다.
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'price_observations_shipping_policy_status_check'
  ) then
    alter table price_observations
      add constraint price_observations_shipping_policy_status_check
      check (
        shipping_policy_status is null
        or shipping_policy_status in ('FREE', 'FLAT', 'CONDITIONAL_FREE', 'ORDER_TIME', 'UNREAD')
      );
  end if;
end $$;

-- 031 선례 — DDL 후 PostgREST 스키마 캐시가 자동 리로드되지 않은 세션이 실제로
-- 있었다. 새 컬럼이 API 로 보이지 않으면 코드는 폴백 경로(038 패턴)로 내려가
-- 가격 저장 자체는 계속되지만, 새 두 칸만 조용히 비어 있게 된다.
NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════════════════════
-- 적용 방법 (051·052·053 과 동일 — Supabase SQL Editor)
-- ════════════════════════════════════════════════════════════════════════════
--   ① 적용 전 실측:
--        select count(*) from price_observations;                          -- 기준선(1,073 예상)
--        select count(*) from information_schema.columns
--         where table_name = 'price_observations'
--           and column_name in ('shipping_policy_status','shipping_policy_note');  -- 0 이어야 한다
--   ② 이 파일 전체를 실행한다(중복 실행해도 안전 — if not exists · 조건부 제약).
--   ③ 적용 후 실측:
--        select count(*) from price_observations;                          -- ① 과 같아야 한다
--        select count(*) from price_observations where shipping_policy_status is not null;  -- 0 이어야 한다
--        select count(*) from price_observations where shipping_policy_note is not null;    -- 0 이어야 한다
--        select column_name, is_nullable, column_default
--          from information_schema.columns
--         where table_name = 'price_observations'
--           and column_name like 'shipping_policy%';
--        -- 두 행 모두 is_nullable = 'YES' · column_default = null 이어야 한다.
--   ④ CHECK 제약이 실제로 막는지 확인(이 구문은 «실패해야» 정상이다):
--        insert into price_observations
--          (snapshot_id, source, currency, price_amount, price_krw, shipping_policy_status)
--        values (gen_random_uuid(), 'DOMESTIC_SHOP', 'KRW', 1, 1, 'MAYBE_FREE');
--        -- 기대: ERROR ... violates check constraint
--        --       "price_observations_shipping_policy_status_check"
--        -- (snapshot_id FK 때문에 그 전에 막힐 수도 있다 — 그 경우
--        --  select 'MAYBE_FREE' in ('FREE','FLAT','CONDITIONAL_FREE','ORDER_TIME','UNREAD')
--        --  이 false 인 것으로 확인한다.)
--
-- ════════════════════════════════════════════════════════════════════════════
-- 롤백 (파괴적이지 않다 — 행은 어느 방향으로도 사라지지 않는다)
-- ════════════════════════════════════════════════════════════════════════════
--   alter table price_observations
--     drop constraint if exists price_observations_shipping_policy_status_check;
--   alter table price_observations drop column if exists shipping_policy_note;
--   alter table price_observations drop column if exists shipping_policy_status;
--   NOTIFY pgrst, 'reload schema';
--
--   🔴 롤백은 «사실을 지운다». 값이 이미 들어간 뒤라면 drop column 전에
--      select id, shipping_policy_status, shipping_policy_note from price_observations
--       where shipping_policy_status is not null;
--      를 먼저 떠서 남긴다 — 이 컬럼의 존재 이유가 "모른다는 사실의 보존"이라
--      그 값을 말없이 버리면 롤백이 데이터 손실이 된다.
--
--   코드는 두 컬럼을 전부 optional 로 읽고(price-observations.ts 의
--   PriceObservationRow), insert 는 038 과 같은 단계적 폴백을 가진다 — 컬럼이
--   없어도 select("*") 와 insert 가 둘 다 계속 동작한다. 그래서 롤백 후에도
--   가격 수집은 멈추지 않는다.
