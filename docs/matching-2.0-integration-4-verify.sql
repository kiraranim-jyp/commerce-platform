-- ============================================================================
-- MATCHING-2.0-INTEGRATION-4 — CEO 직접 검증용 read-only SQL 묶음
-- 대상: Smallable 430701  →  Bobo Choses B226AC114
-- 작성일: 2026-09-13 / 브랜치 main
--
-- ── 이 파일의 규칙 ───────────────────────────────────────────────────────────
--  * 전부 SELECT다. INSERT / UPDATE / DELETE / ALTER / DROP 한 줄도 없다.
--    Supabase SQL Editor에 통째로 붙여 넣고 위에서 아래로 하나씩 실행하면 된다.
--  * 값을 손으로 채워 넣을 곳은 딱 한 군데다(Q6의 기준 시각). 나머지는 전부
--    Q0이 찾은 스냅샷을 CTE로 이어받으므로 id를 복사·붙여넣기 하지 않는다.
--  * 컬럼명은 전부 저장소의 실제 마이그레이션에서 확인한 것이다:
--      product_snapshots                016, 043
--      domestic_price_sources           029, 030, 032, 046, 049
--      workspace_domestic_shop_settings 047
--      domestic_product_links           029, 030
--      price_observations               027, 029, 038, 040, 046
--    확인하지 못한 컬럼은 쓰지 않았다.
--
-- ── 먼저 알아야 할 사실 세 가지 ──────────────────────────────────────────────
--  (1) "다시 분석"은 기존 스냅샷을 고치지 않는다. 새 행을 insert한다
--      (apps/admin/src/app/api/snapshots/route.ts:59,72-83 — body.id가 없으면
--      새 분석). 따라서 430701로 검색하면 스냅샷이 **여러 행** 나올 수 있고,
--      링크/관측은 각각 자기 snapshot_id에만 붙는다. 아래 쿼리는 전부
--      snapshot_id를 함께 보여주므로 어느 회차의 결과인지 구분할 수 있다.
--  (2) domestic_product_links는 unique (snapshot_id, source_id)다(029:74).
--      즉 한 스냅샷 × 한 판매처에는 **링크가 단 하나**다. "B226AC114 행"과
--      "B226AC049 행"이 동시에 남을 수 없다 — 둘 중 대표로 뽑힌 하나만 남는다.
--      Q5는 그래서 "다른 행이 있나"가 아니라 "그 하나의 external_url이 무엇을
--      가리키나"를 본다.
--  (3) DOMESTIC_SHOP 관측은 market_code를 채우지 않는다(코드가 그 값을 안 넘긴다,
--      run-domestic-price-check.ts:533-549). 국내 관측의 market_code가 null인
--      것은 정상이며 FAIL이 아니다.
-- ============================================================================


-- ============================================================================
-- Q0 — 430701 스냅샷이 존재하는가
--
-- 확인하는 것: 이 상품의 스냅샷이 DB에 있는가, 몇 개인가, 어느 워크스페이스
--              소유인가, 마지막으로 언제 갱신됐는가.
--
-- PASS : 1행 이상 나온다. workspace_name이 채워져 있다.
--        (여러 행이면 "다시 분석"을 여러 번 누른 것이다 — 정상이다.
--         가장 위 행(updated_at 최신)이 지금 화면에서 보고 있는 회차다.)
-- FAIL : 0행 → 스냅샷 자체가 저장된 적이 없다. 이 아래 Q1~Q6은 전부 0행이
--        나올 수밖에 없으므로, 여기서 멈추고 "분석이 저장됐는가"부터 봐야 한다.
-- ============================================================================
select
  s.id             as snapshot_id,
  s.workspace_id,
  w.name           as workspace_name,
  s.title,
  s.source_url,
  s.status,
  s.created_at,
  s.updated_at,
  s.last_opened_at
from product_snapshots s
left join workspaces w on w.id = s.workspace_id
where s.source_url ilike '%430701%'
order by s.updated_at desc;


-- ============================================================================
-- Q1 — 이 워크스페이스에서 국내 판매처가 실제로 검색 대상인가
--
-- 확인하는 것: 코드가 검색 대상을 고르는 조건 세 가지를 DB 값 그대로 재현한다
--   (run-domestic-price-check.ts:330-332)
--     ① enabled       = 카탈로그 enabled AND 워크스페이스 설정 enabled
--                       (설정 행이 없으면 ON — 마이그레이션 047 주석)
--     ② status        = 'ACTIVE'
--     ③ category_scope가 이 상품의 범위를 배제하지 않는가
--        (sourceFitsScopes: 소스 scope가 비었거나, 상품 scope가 비었거나,
--         하나라도 겹치면 통과 — packages/category/src/profiles.ts:390-394)
--   추가로, 검색 파서가 아예 없는 소스는 요청조차 보내지 않는다:
--     collection_strategy가 'AUTO_API'/'AUTO_SCRAPE'가 아니면 'unsupported'
--     (packages/crawler/src/comparison-search/index.ts:307-309)
--
-- PASS : bobochoses.com 행에서
--          effective_enabled = true
--          status            = 'ACTIVE'
--          collection_strategy = 'AUTO_API' 또는 'AUTO_SCRAPE'
--          category_scope가 이 상품(아동복)과 겹친다
-- FAIL : effective_enabled = false        → 판매자가 껐거나 운영자가 내렸다
--        status <> 'ACTIVE'               → 검색 대상에서 빠진다
--        collection_strategy = 'MANUAL'/'NOT_AVAILABLE'
--                                         → 실제 HTTP 요청 자체를 안 보낸다
--        category_scope에 이 상품 카테고리가 하나도 없다 → 검색 전에 제외된다
--
-- last_error_code = 'NO_RESULT'는 "요청은 갔는데 후보가 0건"이라는 뜻이다
-- (domestic-price-source.ts:341-343). 'SEARCH_ERROR'면 검색이 터진 것이다.
--
-- ⚠️ priority 컬럼을 반드시 함께 본다. bobochoses.com은 seed 기준 'P1'이다
--    (마이그레이션 030:45). 코드는 P0 소스를 먼저 검색하고, P0에서
--    matchLevel='very_high' 후보가 하나라도 나오면 P1/P2 소스는 **검색조차
--    하지 않는다**(run-domestic-price-check.ts:373-376). 즉 LOOXLOO/RULII 같은
--    P0 소스가 아주 높은 점수의 후보를 내면 Bobo 공식몰은 이번 회차에 아예
--    조회되지 않는다 — 그 경우 Q2에 bobochoses 행이 없는 것이 "매칭 실패"가
--    아니라 "검색 자체를 건너뜀"이다. 그때는 P0 소스들의 last_checked_at이
--    갱신돼 있고 bobochoses의 last_checked_at만 과거에 머문다.
-- ============================================================================
with target as (
  select s.id, s.workspace_id
  from product_snapshots s
  where s.source_url ilike '%430701%'
),
ws as (
  select distinct workspace_id from target
)
select
  ws.workspace_id,
  src.name,
  src.domain,
  src.priority,
  src.collection_strategy,
  src.status,
  src.category_scope,
  src.currency,
  src.enabled                                   as catalog_enabled,
  coalesce(wss.enabled, true)                   as workspace_enabled,
  (src.enabled and coalesce(wss.enabled, true)) as effective_enabled,
  src.last_checked_at,
  src.last_success_at,
  src.last_error_code,
  src.last_error_message
from ws
cross join domestic_price_sources src
left join workspace_domestic_shop_settings wss
       on wss.workspace_id = ws.workspace_id
      and wss.source_id    = src.id
order by
  (src.domain = 'bobochoses.com') desc,   -- 검증 대상 판매처를 맨 위로
  src.priority,
  src.name;


-- ============================================================================
-- Q2 — 이 스냅샷에 걸린 domestic_product_links 전부
--
-- 확인하는 것: 후보 발견 → 매칭 → 링크 저장이 실제로 일어났는가, 그리고
--              그 판정(match_truth)이 무엇으로 저장됐는가.
--
-- match_truth에 들어갈 수 있는 값(마이그레이션 030의 CHECK 제약):
--   EXACT_IDENTIFIER · STRONG_IDENTIFIER · TEXT_CONFIRMED ·
--   SIMILAR · INSUFFICIENT_EVIDENCE · CONFLICT · (null = 030 이전 레거시)
--
-- PASS : domain='bobochoses.com' 행이 있고
--          external_url이 B226AC114를 가리키며
--          match_truth in ('EXACT_IDENTIFIER','STRONG_IDENTIFIER')
--        (교차판매처 판정 SAME은 STRONG_IDENTIFIER로 저장된다 —
--         match-truth.ts:96-105. modelCode까지 맞으면 EXACT_IDENTIFIER.)
-- FAIL : bobochoses.com 행 자체가 없다         → 후보를 못 찾았거나 저장이 막혔다
--        match_truth = 'SIMILAR' / 'INSUFFICIENT_EVIDENCE'
--                                                → 교차판매처 판정이 실리지 않았다
--        match_truth = 'CONFLICT'                → 반증으로 판정됐다
--        match_truth is null                     → 030 이전에 만들어진 뒤
--                                                   한 번도 재검색되지 않았다
--
-- price_tier는 priceTierFromLink()(domestic-product-link.ts:51-56)를 SQL로 그대로
-- 옮긴 것이다 — MI가 이 링크를 어느 버킷에 넣을지를 미리 보여준다.
-- ============================================================================
with target as (
  select s.id, s.workspace_id
  from product_snapshots s
  where s.source_url ilike '%430701%'
)
select
  l.snapshot_id,
  src.name   as source_name,
  src.domain as source_domain,
  l.external_url,
  l.matched_title,
  l.matched_brand,
  l.match_type,
  l.match_truth,
  l.match_confidence,
  l.verified,
  l.verified_at,
  l.status,
  case
    when l.match_truth in ('EXACT_IDENTIFIER', 'STRONG_IDENTIFIER')      then 'EXACT'
    when l.match_truth in ('TEXT_CONFIRMED', 'SIMILAR')                  then 'COMPARISON'
    when l.match_truth in ('CONFLICT', 'INSUFFICIENT_EVIDENCE')          then 'EXCLUDED'
    when l.verified                                                       then 'EXACT'
    else 'COMPARISON'
  end as price_tier,
  array_to_string(l.match_reasons, ' || ') as match_reasons,
  l.created_at,
  l.updated_at
from domestic_product_links l
join domestic_price_sources src on src.id = l.source_id
where l.snapshot_id in (select id from target)
order by
  l.snapshot_id,
  (src.domain = 'bobochoses.com') desc,
  l.match_confidence desc;


-- ============================================================================
-- Q3 — 이 스냅샷의 price_observations 전부
--
-- 확인하는 것: 링크가 생긴 뒤 실제로 가격이 재조회되어 관측 행으로 남았는가.
--
-- 컬럼의 뜻(코드 근거: price-observations.ts:100-118,
--           run-domestic-price-check.ts:533-549):
--   source          'SELLER_ORIGIN'(해외 원가) | 'DOMESTIC_SHOP'(국내 판매처)
--                   | 'NAVER_SHOPPING'
--   source_label    DOMESTIC_SHOP이면 domestic_price_sources.name 그대로
--                   SELLER_ORIGIN이면 'KR_MARKET'/'ORIGIN_FX'/'MARKET_PROBE'
--   source_ref_id   DOMESTIC_SHOP이면 domestic_price_sources.id (FK)
--   price_amount    관측 원본 금액 (품절이라 가격이 없으면 null)
--   price_krw       원화 금액 (국내 소스는 price_amount와 같은 값이 들어간다)
--   market_code     국내 관측은 항상 null이다(코드가 안 넘긴다) — FAIL 아님
--   market_country  같은 이유로 국내 관측은 null
--
-- PASS : source='DOMESTIC_SHOP', source_label에 Bobo가 적힌 행이 있고
--          price_krw ≈ 168000
--        그리고 Smallable ₩113,629는 source='SELLER_ORIGIN' 쪽에서 보인다
--          (Smallable은 국내 판매처가 아니라 **원본 판매처**이므로
--           domestic_price_sources가 아니라 SELLER_ORIGIN으로 쌓인다 —
--           DOMESTIC_SHOP 목록에 Smallable이 없는 것은 정상이다)
-- FAIL : DOMESTIC_SHOP 행이 0건               → 링크는 있는데 가격 재조회가
--                                                실패했거나 EXCLUDED로 걸렀다
--        price_krw is null + sold_out = true  → 품절이라 가격이 없다(정상 기록)
--        price_krw is null + sold_out is null → 저장할 실체가 없던 행(비정상)
-- ============================================================================
with target as (
  select s.id, s.workspace_id
  from product_snapshots s
  where s.source_url ilike '%430701%'
)
select
  o.snapshot_id,
  o.source,
  o.source_label,
  o.source_ref_id,
  src.domain as source_ref_domain,
  o.source_product_url,
  o.market_code,
  o.market_country,
  o.currency,
  o.price_amount,
  o.price_krw,
  o.sale_price_krw,
  o.original_price_krw,
  o.sold_out,
  o.exchange_rate,
  o.checked_at,
  o.created_at
from price_observations o
left join domestic_price_sources src on src.id = o.source_ref_id
where o.snapshot_id in (select id from target)
order by o.snapshot_id, o.checked_at desc, o.source;


-- ============================================================================
-- Q4 — MI 화면의 '동일상품 판매처'에 무엇이 뜰지를 DB만 보고 예측한다
--
-- 확인하는 것: market-intelligence.ts:66-90이 하는 일을 SQL로 그대로 재현한다.
--   ① DOMESTIC_SHOP 관측을 source_ref_id로 링크에 조인한다
--   ② 그 링크의 price_tier가 'EXACT'인 관측만 EXACT 버킷에 들어간다
--   ③ 그 버킷이 summarizeDomesticMarketSplit의 exact가 되고,
--      exact.sampleListings(가격 오름차순 상위 5건)가 그대로
--      '동일상품 판매처' 카드의 줄이 된다
--      (DomesticPriceIntelligencePanel.tsx:2331-2333 →
--       same-product-sellers.ts:132-143)
--   화면의 판매처 이름 = source_label, 금액 = price_krw, 링크 = source_product_url.
--
-- PASS : Bobo Choses 행이 1건 이상 나온다(price_krw ≈ 168000).
--        → 화면 '동일상품 판매처' 카드에 그 판매처 줄이 선다.
-- FAIL : 0행 → 카드가 "같은 상품을 파는 다른 판매처가 아직 확인되지 않았습니다"로
--        비어 보인다. 원인은 Q2(판정이 EXACT가 아님) 또는 Q3(관측이 없음) 중
--        하나이며, 아래 excluded_reason 컬럼이 어느 쪽인지 말해 준다.
--
-- 주의: 아래는 "버킷에 들어갈 수 있는 행"을 전부 보여준다. 실제 카드에는
--       가격이 있는 행만, 가격 오름차순 상위 5건만 선다(price-history.ts:521).
--       sold_out=true이고 price_krw가 null인 행은 품절 목록으로 따로 빠진다.
-- ============================================================================
with target as (
  select s.id, s.workspace_id
  from product_snapshots s
  where s.source_url ilike '%430701%'
),
tiered as (
  select
    l.snapshot_id,
    l.source_id,
    l.match_truth,
    l.verified,
    l.external_url,
    case
      when l.match_truth in ('EXACT_IDENTIFIER', 'STRONG_IDENTIFIER')  then 'EXACT'
      when l.match_truth in ('TEXT_CONFIRMED', 'SIMILAR')              then 'COMPARISON'
      when l.match_truth in ('CONFLICT', 'INSUFFICIENT_EVIDENCE')      then 'EXCLUDED'
      when l.verified                                                   then 'EXACT'
      else 'COMPARISON'
    end as price_tier
  from domestic_product_links l
  where l.snapshot_id in (select id from target)
    and l.status = 'ACTIVE'
)
select
  o.snapshot_id,
  o.source_label       as "화면에_뜰_판매처이름",
  o.price_krw          as "화면에_뜰_금액",
  o.source_product_url as "화면에_걸릴_링크",
  t.match_truth,
  t.price_tier,
  o.sold_out,
  o.checked_at
from price_observations o
join tiered t
  on t.snapshot_id = o.snapshot_id
 and t.source_id   = o.source_ref_id
where o.snapshot_id in (select id from target)
  and o.source = 'DOMESTIC_SHOP'
  and t.price_tier = 'EXACT'
order by o.snapshot_id, o.price_krw nulls last;


-- ============================================================================
-- Q4-b — Q4가 0행일 때 왜 비었는지 가려내는 쿼리(진단용)
--
-- ACTIVE 링크 전부를 왼쪽에 두고 관측을 붙인다. 어느 단계에서 끊겼는지 보인다.
--   obs_count = 0                  → 링크는 있는데 가격 관측이 없다(STEP 2 실패)
--   price_tier <> 'EXACT'          → 관측은 있는데 판정 등급이 모자라 버킷 밖이다
--   price_tier = 'EXCLUDED'        → 가격 재조회 대상에서 아예 제외됐다
--                                    (run-domestic-price-check.ts:512-514)
-- ============================================================================
with target as (
  select s.id, s.workspace_id
  from product_snapshots s
  where s.source_url ilike '%430701%'
)
select
  l.snapshot_id,
  src.domain,
  l.external_url,
  l.match_truth,
  l.verified,
  l.status as link_status,
  case
    when l.match_truth in ('EXACT_IDENTIFIER', 'STRONG_IDENTIFIER')  then 'EXACT'
    when l.match_truth in ('TEXT_CONFIRMED', 'SIMILAR')              then 'COMPARISON'
    when l.match_truth in ('CONFLICT', 'INSUFFICIENT_EVIDENCE')      then 'EXCLUDED'
    when l.verified                                                   then 'EXACT'
    else 'COMPARISON'
  end as price_tier,
  (
    select count(*)
    from price_observations o
    where o.snapshot_id = l.snapshot_id
      and o.source_ref_id = l.source_id
      and o.source = 'DOMESTIC_SHOP'
  ) as obs_count,
  (
    select max(o.checked_at)
    from price_observations o
    where o.snapshot_id = l.snapshot_id
      and o.source_ref_id = l.source_id
      and o.source = 'DOMESTIC_SHOP'
  ) as last_obs_at,
  l.updated_at as link_updated_at
from domestic_product_links l
join domestic_price_sources src on src.id = l.source_id
where l.snapshot_id in (select id from target)
order by l.snapshot_id, src.domain;


-- ============================================================================
-- Q5 — 반례 확인: 같은 라인의 다른 색상(B226AC049 등)이 대표로 뽑히지 않았는가
--
-- 왜 이 모양인가: domestic_product_links는 unique (snapshot_id, source_id)다
-- (029:74). 한 스냅샷의 bobochoses.com 링크는 **하나뿐**이므로, "B226AC049
-- 행이 따로 있나"를 물을 수 없다. 대신 그 하나뿐인 링크가 어떤 품번을
-- 가리키는지를 본다.
--
-- PASS : points_to_B226AC114 = true
--        (= 대표 후보가 정답 품번이다. 이때 match_truth는 Q2의 기준대로
--         EXACT_IDENTIFIER / STRONG_IDENTIFIER 여야 한다)
-- FAIL : points_to_other_article = true 인데 match_truth가
--          'EXACT_IDENTIFIER' 또는 'STRONG_IDENTIFIER'
--        → 다른 색상/다른 상품을 동일상품으로 확정해 저장했다. 이건 명백한
--          FAIL이고, 그 가격이 MI의 '동일상품 판매처'에 그대로 실린다.
--        다른 품번인데 match_truth가 'CONFLICT' / 'INSUFFICIENT_EVIDENCE' /
--        'SIMILAR' / 'TEXT_CONFIRMED' 이하면 그건 정상 동작이다
--        (반증됐거나, 동일상품으로 확정하지 않았다는 뜻).
--
-- article_code는 external_url에서 "b" + 3자리숫자 + 영문2자 + 3자리숫자
-- 패턴을 그대로 뽑아낸 것이다 — 없는 값을 만들지 않는다(못 뽑으면 null).
-- ============================================================================
with target as (
  select s.id, s.workspace_id
  from product_snapshots s
  where s.source_url ilike '%430701%'
)
select
  l.snapshot_id,
  src.domain,
  l.external_url,
  upper(substring(l.external_url from '(?i)(b[0-9]{3}[a-z]{2}[0-9]{3})')) as article_code,
  (l.external_url ilike '%b226ac114%')                                    as "points_to_B226AC114",
  (
        upper(substring(l.external_url from '(?i)(b[0-9]{3}[a-z]{2}[0-9]{3})')) is not null
    and l.external_url not ilike '%b226ac114%'
  )                                                                       as "points_to_other_article",
  l.match_type,
  l.match_truth,
  l.match_confidence,
  l.verified,
  array_to_string(l.match_reasons, ' || ') as match_reasons,
  l.updated_at
from domestic_product_links l
join domestic_price_sources src on src.id = l.source_id
where l.snapshot_id in (select id from target)
  and src.domain = 'bobochoses.com'
order by l.snapshot_id, l.updated_at desc;


-- ============================================================================
-- Q6 — "다시 분석"이 실제로 다시 돌았는가 (갱신 시각 확인)
--
-- ▼▼▼ 이 파일에서 유일하게 손으로 고칠 값 ▼▼▼
--   아래 interval '2 hours'를 "버튼을 누른 뒤 지난 시간"으로 바꾼다.
--   (방금 눌렀으면 '10 minutes', 아침에 눌렀으면 '8 hours' 같은 식)
-- ▲▲▲                                     ▲▲▲
--
-- 확인하는 것: 링크의 updated_at, 관측의 checked_at이 그 기준 시각보다
--              **나중**인가. 나중이면 이번 클릭이 실제로 DB를 건드린 것이다.
--
-- PASS : is_after_button_press = true 인 행이 링크·관측 양쪽에 있다.
-- FAIL : 전부 false → 이번 클릭으로는 아무것도 저장되지 않았다.
--        이때 의심할 곳(전부 코드에 실재하는 차단 경로다):
--          · 같은 날 이미 DOMESTIC_SHOP 관측이 있어 통째로 스킵
--            (skipIfCheckedToday — run-domestic-price-check.ts:287-291.
--             "분석 직후 1회" 트리거만 이 값을 켠다. 화면의 "가격 다시 확인"
--             버튼은 이 가드를 쓰지 않는다)
--          · 그 판매처가 이 워크스페이스에서 꺼져 있음 / status<>'ACTIVE'
--          · category_scope 불일치로 검색 대상에서 제외
--          · collection_strategy가 MANUAL/NOT_AVAILABLE이라 요청 자체를 안 보냄
--          · 검색 결과 0건 (last_error_code='NO_RESULT' — Q1에서 확인)
--          · 판정이 NOT_MATCHED로 끝나 링크를 만들지 않음
--          · 링크는 갱신됐는데 가격 재조회가 실패 (Q4-b의 obs_count=0)
--        Q0의 updated_at도 함께 본다 — 스냅샷이 새로 insert됐다면
--        새 snapshot_id에 붙었을 수 있다(위 "먼저 알아야 할 사실 (1)").
-- ============================================================================
with target as (
  select s.id, s.workspace_id
  from product_snapshots s
  where s.source_url ilike '%430701%'
),
cutoff as (
  select now() - interval '2 hours' as t   -- ← 여기만 고친다
)
select * from (
  select
    'LINK'                  as kind,
    l.snapshot_id,
    src.domain              as who,
    l.external_url          as what,
    l.match_truth           as detail,
    l.updated_at            as at,
    (l.updated_at > (select t from cutoff)) as is_after_button_press
  from domestic_product_links l
  join domestic_price_sources src on src.id = l.source_id
  where l.snapshot_id in (select id from target)

  union all

  select
    'OBSERVATION'           as kind,
    o.snapshot_id,
    coalesce(o.source_label, o.source) as who,
    o.source_product_url    as what,
    o.price_krw::text       as detail,
    o.checked_at            as at,
    (o.checked_at > (select t from cutoff)) as is_after_button_press
  from price_observations o
  where o.snapshot_id in (select id from target)

  union all

  select
    'SOURCE_CHECK'          as kind,
    null::uuid              as snapshot_id,
    src.domain              as who,
    coalesce(src.last_error_code, 'OK') as what,
    src.last_error_message  as detail,
    src.last_checked_at     as at,
    (src.last_checked_at > (select t from cutoff)) as is_after_button_press
  from domestic_price_sources src
  where src.domain = 'bobochoses.com'
) x
order by at desc nulls last;
