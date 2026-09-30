-- ════════════════════════════════════════════════════════════════════════════
-- 070 — 해외 비교 사이트 5곳을 «공통 카탈로그» 에 등록한다 (CPO 지시, 2026-09-30)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Google Shopping · Amazon · eBay · Walmart · AliExpress.
--
-- ── 🔴 등록과 «자동 수집» 을 가른다 ────────────────────────────────────────
-- 지시: "실제 수집 기능이 확인되지 않은 사이트는 자동 수집 가능으로 표시하지
-- 않습니다." 그래서 다섯 행 모두 `is_active = false` 로 넣는다.
--
-- 왜 그것으로 충분한가 — 해외 소스를 고르는 «모든» 자리가 is_active 를 먼저 본다:
--     comparison/search/route.ts:92    s.isActive && isCollectableAccess(...) && ...
--     market-categories/route.ts:81    s.isActive && isCollectableAccess(...) && ...
-- 052 가 네이버 쇼핑에 쓴 수법과 «같은 것» 이다(그쪽은 국내 표라 status
-- ='NOT_AVAILABLE' 이었다): 「등록은 해 둔다. 다만 필터에서 빠진다. 코드는 한 줄도
-- 바꾸지 않는다.」 커넥터가 검증되면 관리자가 setComparisonShopActive() 로 켠다.
--
-- 🔴 `access_status` 를 «비워 둔다»(null). null 은 「확인 안 함」이고,
-- isCollectableAccess(null) 은 true 를 돌려준다 — 즉 null «단독» 으로는 수집을
-- 막지 못한다(comparison-shop.ts:52 가 그 이유를 적어 두었다: 기존 16·25행이 전부
-- null 이라 null 을 막으면 모든 조사가 멈춘다). 막는 것은 is_active=false 다.
-- 그러므로 여기 null 은 «사실 진술» 이다 — 우리는 이 다섯을 열어 본 적이 없다.
--
-- 🔴 `'OK'` 를 넣지 않는다. 미확인을 OK 로 적으면 그 순간 거짓이 된다.
-- 🔴 `'BLOCKED'` 도 넣지 않는다. 막혀 있다는 것 역시 «실측» 이고 우리는 재지 않았다.
--
-- ── 🔴 채우지 않은 칸과 그 이유 ───────────────────────────────────────────
-- currency  : 전부 null. 가격을 관측한 적이 없어 표시 통화를 «모른다». 국가·로케일
--             마다 달라지는 사이트가 섞여 있어 한 값으로 적을 수도 없다.
-- country   : 다국가 운영이 명백한 Google Shopping 만 null. 나머지는 .com 본국.
-- category_scope : 기본값 '{}' 그대로 둔다(이번 작업에서 카테고리는 건드리지 않는다).
--             🔴 049 기준으로 빈 배열은 「모든 카테고리 통과」로 읽힌다. 그런데
--             is_active=false 가 앞에서 막으므로 지금은 아무 효과가 없다 — 켜는
--             날 «그 전에» 범위를 정해야 한다. 이 주석이 그 경고다.
-- source_role : 넣지 않는다(null). 052 도 comparison_shops 에는 넣지 않았다.
--
-- ── 중복 ──────────────────────────────────────────────────────────────────
-- `domain` 이 unique 다(019). `on conflict (domain) do nothing` 이므로 이미 있으면
-- 조용히 넘어가고 기존 행의 어떤 칸도 덮어쓰지 않는다.
-- 🔴 다나와·네이버 쇼핑은 «국내 표» 이고 이 문장은 그 표를 건드리지 않는다.
-- ════════════════════════════════════════════════════════════════════════════

insert into comparison_shops
  (name, domain, url, country, currency, source, is_active, access_status, access_note)
values
  -- 가격비교 엔진. 판매처가 아니라 «여러 판매처의 값을 모아 보여주는» 곳이다.
  ('Google Shopping', 'shopping.google.com', 'https://shopping.google.com', null, null,
   'SYSTEM', false, null,
   '2026-09-30 등록만 했다. 접근 가능 여부·수집 파서 모두 미확인이라 is_active=false 로 둔다. 국가별 결과와 상품 피드 지원 범위를 확인한 뒤 켠다.'),

  ('Amazon', 'amazon.com', 'https://www.amazon.com', 'United States', null,
   'SYSTEM', false, null,
   '2026-09-30 등록만 했다. 마켓플레이스라 실제 소싱 후보는 입점 판매자다 — 판매자 단위 등록 구조는 아직 없다(053 operator_key 참고). 접근·수집 미확인.'),

  ('eBay', 'ebay.com', 'https://www.ebay.com', 'United States', null,
   'SYSTEM', false, null,
   '2026-09-30 등록만 했다. 판매 상태(경매/즉시구매)·상품 상태(신품/중고)·배송비가 값의 의미를 바꾸는데 그 구분을 아직 다루지 않는다. 접근·수집 미확인.'),

  ('Walmart', 'walmart.com', 'https://www.walmart.com', 'United States', null,
   'SYSTEM', false, null,
   '2026-09-30 등록만 했다. 지역별 재고·배송 가능 지역이 가격 노출을 바꾼다. 접근·수집 미확인.'),

  ('AliExpress', 'aliexpress.com', 'https://www.aliexpress.com', 'China', null,
   'SYSTEM', false, null,
   '2026-09-30 등록만 했다. 옵션별 가격·배송비·국가별 가격이 갈린다. 마켓플레이스라 소싱 후보는 입점 판매자다. 접근·수집 미확인.')
on conflict (domain) do nothing;

-- ── 롤백 ──────────────────────────────────────────────────────────────────
--   delete from comparison_shops
--    where source = 'SYSTEM' and is_active = false
--      and domain in ('shopping.google.com','amazon.com','ebay.com','walmart.com','aliexpress.com');
--   🔴 is_active = false 조건을 «같이» 둔다 — 누군가 켠 뒤라면 그것은 검증을 거친
--   행이므로 이 롤백이 지워서는 안 된다.
