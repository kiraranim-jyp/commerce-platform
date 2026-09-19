-- P0-A.8 MATCHING MEASUREMENT ONLY(CEO 승인, 2026-09-18) — 판정을 바꾸지 않는다.
-- 다음 판정을 «잴 수 있게» 만드는 것까지만 간다.
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- A/B/C 세 후보안은 전부 crossSellerVerdict 를 입력으로 쓴다. 그런데 실측(2026-09-18):
--
--   domestic_product_links 70행 중 crossSellerVerdict 가 복원되는 행  «0 / 70»
--
-- 그래서 「A안을 적용하면 국내 비교가격이 몇 개 사라지는가」에 «구간»으로만
-- 답할 수 있었다. 같은 날 더 좁혀 본 결과는 이렇다:
--
--   EXACT 티어 고유 URL                14
--   그중 «품번 근거»로 EXACT 인 것       14 / 14   ← 전부
--   그중 «실제로 가격을 공급 중»         14 / 14   ← 전부
--   품번 근거가 «아닌» EXACT              0
--
-- 즉 오늘 국내 비교가격을 공급하는 EXACT 는 전부 품번 한 축으로 서 있고,
-- 「modelCode 단독 EXACT 금지」류의 수정은 그 14개 «전부»를 재판정 대상으로 만든다.
-- 그 14개가 실제로 SAME 이었는지 PRESUMED_SAME 이었는지 UNKNOWN 이었는지를
-- 모르는 채로는 어느 안도 고를 수 없다 — 이 컬럼이 그 답을 모으기 시작한다.
--
-- ── 이 마이그레이션이 하지 않는 것 ──────────────────────────────────────────
-- 🔴 backfill 하지 않는다. DEFAULT 도 두지 않는다.
--    없는 관측을 지어내지 않는다 — 054 가 shipping_policy_status 를 채우지 않은 것과
--    같은 이유다. 기존 70행은 null 로 남고, 그 행이 실제로 재판정될 때 채워진다.
-- 🔴 UNKNOWN 을 «기본값»으로 쓰지 않는다. UNKNOWN 은 판정기가 실제로 낸 결론이고
--    (= 축은 봤는데 근거가 모자랐다), null 은 «이 행을 그 판정기로 본 적이 없다» 이다.
--    둘을 같은 값으로 만들면 이 컬럼을 만든 이유가 그 자리에서 사라진다.
-- 🔴 가격 경로를 건드리지 않는다. priceTierFromLink 는 match_truth·verified 만 읽고,
--    이 컬럼은 어느 판정에도 입력으로 들어가지 않는다.
--
-- ── 값 ──────────────────────────────────────────────────────────────────────
-- packages/crawler/src/comparison-search/cross-seller.ts:75 의 CrossSellerVerdict
-- 다섯 값을 그대로 쓴다. 저장소에 이미 있는 어휘를 새로 정의하지 않는다.

alter table domestic_product_links
  add column if not exists cross_seller_verdict text;

-- 다섯 값 + null 만 허용한다. 오타나 새 어휘가 조용히 섞이면 이 컬럼으로 집계한
-- 다음 판단이 틀어진다.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'domestic_product_links_cross_seller_verdict_check'
  ) then
    alter table domestic_product_links
      add constraint domestic_product_links_cross_seller_verdict_check
      check (cross_seller_verdict is null or cross_seller_verdict in
        ('SAME', 'PRESUMED_SAME', 'SIMILAR', 'UNKNOWN', 'CONFLICT'));
  end if;
end $$;

comment on column domestic_product_links.cross_seller_verdict is
  'compareCrossSellerProducts()의 판정. P0-A.8(2026-09-18) 측정 전용 — 어떤 판정/가격 계산에도 입력으로 쓰이지 않는다. null = 이 행을 교차판매처 판정기로 본 적이 없다(UNKNOWN과 다르다). backfill 없음.';
