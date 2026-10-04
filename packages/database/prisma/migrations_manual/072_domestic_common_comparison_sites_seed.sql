-- ════════════════════════════════════════════════════════════════════════════
-- 072 — 국내 가격비교 사이트를 «공통 카탈로그» 에 등록한다 (CEO 지시, 2026-10-04)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 에누리 · 카카오 쇼핑하우. `category_scope = '{}'` (= 모든 시장조사 카테고리).
--
-- ── 🔴 왜 필요한가 — 「준비중」의 실제 원인 ────────────────────────────────
-- TENNIS 가 화면에서 「준비중(조사 사이트 없음)」인 이유를 코드로 추적했다.
-- market-categories/route.ts:84 가 `available: catalogSourceCount > 0` 이고,
-- 그 카운트는 국내 표(domestic_price_sources)에서 네 조건을 모두 통과한 행 수다:
--     status='ACTIVE' · isCollectableAccess(access_status) ·
--     sourceFitsScopes(category_scope, ['TENNIS']) · enabled
--
-- 그런데 053 이 기록한 살아있는 DB 실측(2026-09-16)은 이렇다:
--     국내 18행 = KIDS_FASHION 16 · GOLF 2
-- 즉 `category_scope = '{}'` 인 «공통» 국내 소스가 **0행** 이다. 다나와·네이버
-- 쇼핑조차 052 에서 `array['GOLF']` 로 들어갔다. 그래서 TENNIS 는 물론
-- WOMEN_FASHION·FASHION_ACCESSORIES·HOME_LIFESTYLE 도 전부 0행이다.
--
-- 🔴 이 파일은 그 구멍을 «공통 행을 추가해서» 메운다. 기존 행의 scope 를
-- 고치는 방식이 아니다 — 아래 「하지 않는 것」 참고.
--
-- ── 🔴 이 파일이 하지 않는 것 ─────────────────────────────────────────────
-- · 기존 행을 UPDATE 하지 않는다. delete 문이 없다.
--   특히 **다나와·네이버 쇼핑의 `category_scope` 를 건드리지 않는다.** 둘을
--   공통으로 만들려면 `array['GOLF']` → `'{}'` UPDATE 가 필요한데, 그것은
--   「기존 사이트의 데이터를 임의 UPDATE 하지 않는다」(CEO 지시 8)에 걸린다.
--   그 둘의 공통화는 **CEO 결정 사항**으로 올렸다.
-- · 네이버 쇼핑·다나와를 다시 insert 하지 않는다. `domain` 이 unique(029:15)이고
--   `on conflict do nothing` 이므로 이미 있으면 조용히 넘어간다 — 070 과 같은 수법.
-- · 해외 표(comparison_shops)를 건드리지 않는다. 070 의 다섯 행은 그대로다.
-- · 판매채널(쿠팡·스마트스토어·11번가·G마켓·롯데ON·무신사)을 넣지 않는다.
--   그것들은 조사 소스가 아니라 출력 채널이고, 이 표에 들어온 적이 없다.
-- · 새 카테고리를 만들지 않는다. `'{}'` 는 카테고리 ID 가 아니라 「전부」다.
--
-- ── 🔴 등록과 «자동 수집» 을 가른다 ───────────────────────────────────────
-- 두 사이트 모두 우리 파서가 «없다». 그래서 `collection_strategy = 'MANUAL'` 이다.
-- 이것은 다나와가 이미 쓰고 있는 조합을 그대로 따른 것이다(052:56-59):
--
--     access_status = 'OK'     "열린다"            ← 실측해야 적을 수 있다
--     collection_strategy      "우리가 자동으로 못 읽는다"
--     status = 'ACTIVE'        "조사 대상 목록에 든다"
--
-- 세 칸이 다른 사실을 말한다. 그리고 MANUAL 은 실제 수집에서 «구조적으로»
-- 빠진다 — comparison-search/index.ts:243 이
--     collectionStrategy !== 'AUTO_API' && !== 'AUTO_SCRAPE' → unsupported
-- 로 건너뛴다. 포레포레가 이미 그렇게 등록돼 있다(crawler/comparison-search/
-- foretforet.ts:13). 그러므로 `status='ACTIVE'` 가 「자동 수집 가능」을
-- 주장하지 않는다 — 「셀러가 직접 확인할 소스로 목록에 있다」는 뜻이다.
--
-- 🔴 `access_status` 는 «비워 둔다»(null). null 은 「확인 안 함」이고
-- isCollectableAccess(null) 은 true 다(comparison-shop.ts:57). 즉 null 단독으로는
-- 막지 못한다. 그래도 'OK' 를 적지 않는다 — 우리는 이 두 사이트를 열어 본 적이
-- 없고, 미확인을 OK 로 적으면 그 순간 거짓이 된다(070 과 같은 판단).
-- 'BLOCKED' 도 적지 않는다. 막혀 있다는 것 역시 실측이고 우리는 재지 않았다.
--
-- ── 🔴 채우지 않은 칸과 그 이유 ───────────────────────────────────────────
-- source_role : 'PRICE_COMPARISON' 을 적는다. 둘 다 여러 판매처의 값을 «모아
--               보여주는» 가격비교 매체이고, 다나와가 053 에서 받은 값과 같다.
--               판매처(PRICE_COLLECTION)도 수요데이터(DEMAND_DATA)도 아니다.
-- source_type  : 'MARKETPLACE'. 049 의 네 값 중 「여러 판매자가 입점하는」 쪽이
--               가장 가깝다 — 가격비교 포털 전용 값을 새로 만들지 않는다(052 판단).
-- priority     : 'P0' 에누리 / 'P1' 카카오 쇼핑하우 (CEO 지시의 P0/P1 구분 그대로).
--
-- ── 선행 조건 ───────────────────────────────────────────────────────────────
-- 029(표) · 049(source_type) · 051(category_scope · access_status) · 053(source_role).
--
-- ── 🔴 적용 후에도 «바뀌지 않는» 것 ──────────────────────────────────────
-- 아동의류(KIDS_FASHION)·골프(GOLF)의 기존 조사 대상은 그대로 유지되고, 거기에
-- 이 두 공통 행이 «더해진다». 공통 행이 기존 전용 행을 밀어내지 않는다 —
-- sourceFitsScopes 는 OR 이다.
-- ════════════════════════════════════════════════════════════════════════════

insert into domestic_price_sources
  (name, domain, url, currency, category_scope, priority, collection_strategy, status,
   source, source_type, seller_type, enabled, access_status, access_note, source_role)
values
  -- 에누리 — 국내 가격비교 포털. 공산품·패션·스포츠까지 폭넓게 다룬다.
  ('에누리', 'enuri.com', 'https://www.enuri.com', 'KRW',
   '{}', 'P0', 'MANUAL', 'ACTIVE',
   'SYSTEM', 'MARKETPLACE', 'DOMESTIC', true,
   null, '2026-10-04 공통 가격비교 소스로 등록만 했다. 접근 가능 여부·자동 수집 파서 모두 «미확인» 이라 access_status 를 비워 두고 collection_strategy=MANUAL 로 둔다. 셀러가 직접 확인하는 소스다.',
   'PRICE_COMPARISON'),

  -- 카카오 쇼핑하우 — 카카오의 가격비교/쇼핑 집계 서비스.
  ('카카오 쇼핑하우', 'shoppinghow.kakao.com', 'https://shoppinghow.kakao.com', 'KRW',
   '{}', 'P1', 'MANUAL', 'ACTIVE',
   'SYSTEM', 'MARKETPLACE', 'DOMESTIC', true,
   null, '2026-10-04 공통 가격비교 소스로 등록만 했다. 접근 가능 여부·자동 수집 파서 모두 «미확인». 도메인은 공개적으로 알려진 주소를 적었고 실제 응답을 확인한 것은 아니다 — 열어 본 뒤 access_status 를 채운다.',
   'PRICE_COMPARISON')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 이번 파일에 «넣지 않은» 사이트와 그 이유 (CEO 지시 2·3)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 트렌비
--   지시: "기존 CATEGORY_PROFILES 를 확인한 뒤 category_scope 를 결정한다.
--          카테고리 ID 를 임의 생성하지 않는다."
--   확인: 프로필은 일곱이다 — KIDS_FASHION · WOMEN_FASHION · FASHION_ACCESSORIES ·
--          HOME_LIFESTYLE · MATERNITY · GOLF · TENNIS.
--   🔴 그런데 트렌비가 그중 «무엇을» 다루는지 우리가 확인한 기록이 저장소에
--      없다(전수 검색 0건). 실제 상품 구성을 열어 보지 않고 scope 를 적으면 그것이
--      바로 「임의 결정」이다. 공통(`'{}'`)으로 두는 것도 근거가 필요한 판단이다.
--      그래서 **등록하지 않고 CEO 확인 사항으로 올린다.**
--
-- 테니스맨션
--   지시: "TENNIS 전용 · category_scope = ['TENNIS'] · 실제 접근 상태 재확인"
--   🔴 저장소에 이 사이트의 «도메인» 이 없다(전수 검색 0건). 도메인은 unique 키이고
--      (029:15) 틀리면 나중에 고치기 어렵고 셀러에게 잘못된 주소가 보인다.
--      도메인을 지어내지 않는다 — **CEO 확인 후 별도 파일로 등록한다.**
--
-- 네이버 쇼핑 / 다나와
--   이미 052 에 있다. 🔴 다만 둘 다 `array['GOLF']` 라 TENNIS 에서 빠진다.
--   공통으로 바꾸려면 기존 행 UPDATE 가 필요해 이 파일에서 하지 않았다(위 참고).
--   추가로 네이버 쇼핑은 053 이 'API_DISCONTINUED' + 'DEMAND_DATA' 로 바꿨다 —
--   공식 검색 API 가 2026-07-31 종료돼 «가격 수집 소스가 아니다». scope 를 고쳐도
--   isCollectableAccess 가 막으므로 가격비교 소스로 돌아오지 않는다.
-- ════════════════════════════════════════════════════════════════════════════
