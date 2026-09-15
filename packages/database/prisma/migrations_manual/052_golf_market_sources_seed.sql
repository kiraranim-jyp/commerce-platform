-- GOLF-01 축 A(CEO 지시, 2026-09-15) — 골프용품 시장조사 사이트 5곳 등록.
--
-- 🔴 이 파일의 가장 중요한 줄은 access_status 다. "등록됨"과 "수집 성공"은
--    다른 사실이고, 이 저장소는 그 둘을 뭉갠 적이 있다. CEO 실측(2026-09-15):
--
--      Danawa          ✅ 실제 값 확인
--      Rakuten         ✅ 실제 값 확인
--      GDO             ❌ Akamai 403     (curl · WebFetch · 헤드리스 크롬 전부 차단)
--      Victoria 자사몰   ❌ Cloudflare 403  (Rakuten 공식점 경유로만 가능)
--      Naver Shopping  ❌ 로그인 요구
--
--    5곳 전부 등록한다. 그러나 막힌 3곳은 access_status 로 그 사실을 적고,
--    코드가 그 값을 보고 **조사 대상에서 구조적으로 제외한다**(반복 호출 금지).
--    화면도 같은 값을 읽어 "접근 차단" · "로그인 필요"라고 그대로 말한다.
--
-- ── 통화로 테이블을 가른다(029 주석의 규칙 그대로) ──────────────────────────
--    domestic_price_sources 는 KRW 전용이다. JPY 사이트를 여기에 억지로 넣지
--    않는다 — 국내/해외를 합치지 않는 이유가 바로 통화와 목적이다.
--      국내(KRW)  Danawa · Naver Shopping        → domestic_price_sources
--      해외(JPY)  GDO · Victoria Golf · Rakuten  → comparison_shops
--
-- ── 파서를 지어내지 않는다 ──────────────────────────────────────────────────
--    5곳 중 packages/crawler 에 파서가 있는 도메인은 **0곳**이다. 그래서 국내
--    쪽은 collection_strategy 를 MANUAL/NOT_AVAILABLE 로 둔다(029~035가 지켜 온
--    규칙: 실제 사이트 구조를 조사하기 전까지 AUTO 로 확정하지 않는다). 해외
--    쪽은 searchOneShop 이 파서 존재 여부로만 판단하므로 자동으로
--    status="unsupported"가 된다 — 실제 요청이 나가지 않는다.
--    즉 오늘 골프 조사는 "수동 확인"이다. 그게 사실이고, 화면이 그렇게 말한다.
--
-- ── 선행 조건 ───────────────────────────────────────────────────────────────
--    051(category_scope · access_status · access_note · workspace_id)이 먼저다.
--
-- ── 롤백 ────────────────────────────────────────────────────────────────────
--    delete from domestic_price_sources where domain in ('danawa.com','shopping.naver.com');
--    delete from comparison_shops where domain in ('shop.golfdigest.co.jp','victoriagolf.co.jp','rakuten.co.jp');
--    (이 5행은 이 마이그레이션이 만든 행이고 과거 관측이 붙어 있지 않다.
--     기존 16행 · 25행은 이 파일이 한 글자도 건드리지 않는다.)

-- ════════════════════════════════════════════════════════════════════════════
-- ① 국내 (KRW) — domestic_price_sources
-- ════════════════════════════════════════════════════════════════════════════
--
-- source='SYSTEM' · workspace_id=null : 중앙 기본 카탈로그다(모든 셀러가 본다).
-- 셀러가 자기만 쓸 골프 사이트를 더하는 길은 설정 화면의 「사이트 추가」이고,
-- 그쪽은 workspace_id 가 채워져서 그 셀러에게만 보인다(051 ③).
insert into domestic_price_sources
  (name, domain, url, currency, category_scope, priority, collection_strategy, status,
   source, source_type, seller_type, enabled, access_status, access_note)
values
  -- 다나와 — 국내 최대 가격비교 포털. 여러 판매자의 값을 한자리에 모아 보여준다.
  -- source_type: 049의 네 값 중 "여러 판매자가 입점하는" MARKETPLACE 가 가장
  -- 가깝다(가격비교 포털 전용 값을 새로 만들지 않는다).
  -- collection_strategy=MANUAL : 접근은 되지만 우리 파서가 없다. 이 둘은 다른
  -- 사실이라 다른 칸에 적는다 — access_status='OK' 가 "열린다", MANUAL 이
  -- "우리가 아직 자동으로 못 읽는다".
  ('다나와', 'danawa.com', 'https://www.danawa.com', 'KRW',
   array['GOLF'], 'P0', 'MANUAL', 'ACTIVE',
   'SYSTEM', 'MARKETPLACE', 'DOMESTIC', true,
   'OK', '2026-09-15 실측: 검색·상품 페이지가 열리고 실제 가격 값을 확인했다. 자동 수집 파서는 아직 없어 수동 확인이다.'),

  -- 네이버 쇼핑 — 로그인 없이는 가격을 볼 수 없다(실측). status 를 ACTIVE 로
  -- 두면 검색 경로가 매번 이 소스를 대상에 넣고 매번 빈손으로 돌아온다. 기존
  -- 어휘 그대로 status='NOT_AVAILABLE' 을 쓴다 — 모든 필터가 이미
  -- status==='ACTIVE' 를 보고 있어서 코드 변경 없이 대상에서 빠진다.
  -- 등록은 해 둔다: "우리가 아직 확보하지 못한 사이트"와 "확보했지만 로그인이
  -- 막는 사이트"는 셀러에게 전혀 다른 사실이다.
  ('네이버 쇼핑', 'shopping.naver.com', 'https://shopping.naver.com', 'KRW',
   array['GOLF'], 'P1', 'NOT_AVAILABLE', 'NOT_AVAILABLE',
   'SYSTEM', 'MARKETPLACE', 'DOMESTIC', true,
   'LOGIN_REQUIRED', '2026-09-15 실측: 로그인을 요구해 비로그인 상태로는 가격을 볼 수 없다. 자동·수동 모두 셀러 계정이 필요하다.')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- ② 해외 (JPY) — comparison_shops
-- ════════════════════════════════════════════════════════════════════════════
--
-- category_scope=['GOLF'] : 051 ①이 기존 25행에 KIDS_FASHION 을 명시적으로
-- 넣었으므로, 이 3행만 골프 조사에 걸리고 아동복 25곳은 걸리지 않는다.
-- 반대로 아동 상품을 조사할 때 이 3곳이 섞이지도 않는다.
insert into comparison_shops
  (name, domain, url, country, currency, category_scope, source, is_active, access_status, access_note)
values
  -- GDO(ゴルフダイジェスト・オンライン) 자사몰. 일본 최대 골프 포털의 쇼핑몰.
  ('GDO 골프샵', 'shop.golfdigest.co.jp', 'https://shop.golfdigest.co.jp', 'Japan', 'JPY',
   array['GOLF'], 'SYSTEM', true,
   'BLOCKED', '2026-09-15 실측: Akamai 가 403 으로 막는다(curl · WebFetch · 헤드리스 크롬 전부 동일). 우회하지 않고 조사 대상에서 제외한다. 참고: 같은 사업자가 Rakuten 공식점(rakuten.co.jp/gdoshop)을 운영한다.'),

  -- Victoria Golf(ヴィクトリアゴルフ, Xebio) 자사몰.
  ('Victoria Golf', 'victoriagolf.co.jp', 'https://www.victoriagolf.co.jp', 'Japan', 'JPY',
   array['GOLF'], 'SYSTEM', true,
   'BLOCKED', '2026-09-15 실측: Cloudflare 가 403 으로 막는다. 참고: 같은 사업자가 Rakuten 공식점(rakuten.co.jp/victoriagolf)을 운영하며 그 경로로만 값을 볼 수 있다.'),

  -- Rakuten 市場 — 마켓플레이스다. 🔴 CEO 정의: "그 안의 판매자가 실제 소싱
  -- 후보다." 판매자 단위를 테이블로 표현하려면 comparison_shops 아래에 계층을
  -- 하나 새로 파야 하는데, 그건 이번 범위 밖이다(CEO: "구조를 새로 만들 정도면
  -- 남겨라"). 그래서 오늘은 마켓플레이스 한 행으로 등록하고, 이번에 실제로
  -- 확인된 공식점 두 곳을 access_note 에 사실로 적어 다음 사람이 처음부터
  -- 다시 찾지 않게 한다.
  ('Rakuten 市場', 'rakuten.co.jp', 'https://www.rakuten.co.jp', 'Japan', 'JPY',
   array['GOLF'], 'SYSTEM', true,
   'OK', '2026-09-15 실측: 열리고 실제 가격 값을 확인했다. 마켓플레이스라 실제 소싱 후보는 입점 판매자다 — 이번에 확인된 골프 공식점: rakuten.co.jp/gdoshop(GDO), rakuten.co.jp/victoriagolf(Victoria Golf). 판매자 단위 등록 구조는 아직 없다.')
on conflict do nothing;
