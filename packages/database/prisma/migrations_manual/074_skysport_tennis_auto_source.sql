-- ════════════════════════════════════════════════════════════════════════════
-- 074 — 스카이스포츠를 TENNIS «자동» 가격수집원으로 등록한다 (CPO 확정 2026-10-04)
-- ════════════════════════════════════════════════════════════════════════════
--
-- TENNIS 시장조사의 **첫 AUTO_SCRAPE 소스** 다. 그전까지 테니스 국내 소스는
-- 다나와·카카오 쇼핑하우 둘뿐이었고 둘 다 MANUAL 이라, 화면이 「조사 대상 2곳」
-- 이라고 말하면서 자동 가격 결과는 0건이었다 — 그 상태를 닫는다.
--
-- ── 🔴 채택 근거 (실측 2026-10-04) ────────────────────────────────────────
-- 후보 11곳을 같은 기준으로 재서 2곳이 통과했고, 그중 상세 9항목까지 확인한 곳이다.
-- 기준은 **「우리가 실제로 쓰는 UA 가 robots 에서 허용되는가」** 다:
--
--   robots.txt   User-agent: * 가 /admin · /api · /exec/front/ · /member/ ·
--                /myshop/ · /protected/ · skin 계열 · 게시판 경로만 Disallow.
--                🔴 상품/검색 경로는 «허용» — Cafe24 표준이고 looxloo(030)·rulii 와
--                같은 모양이다. (무신사·SSF SHOP 은 `*` 가 Disallow: / 라서 STOP.
--                W컨셉·테니스바이는 robots.txt 자체가 403 이라 STOP.)
--   약관         제22조 저작권 귀속(표준 전자상거래 약관)만 있고 **자동수집·
--                크롤링·스크래핑을 명시적으로 금지하는 조항이 없다.**
--                🔴 표준 약관 하나로 STOP 하지 않는다 — 그 기준이면 기존 어댑터
--                여덟이 전부 STOP 대상이 된다(price-source-adapter.ts 주석).
--   응답         검색 83건·4페이지·HTTP 200. 가격이 «서버 HTML» 에 있다.
--                (29CM 는 robots 를 통과했지만 SPA 라 서버 HTML 에 가격이 0건이어서
--                부적합이었다 — 그 차이가 여기서 갈렸다.)
--   상품         성인 테니스 의류 실측: 남성 반팔티·공용 반바지·바람막이 등.
--                (테니스스퀘어는 robots·가격 모두 통과했으나 «의류 미취급» 으로 부적합.)
--
-- ── 🔴 AUTO_SCRAPE 로 넣는 이유 ───────────────────────────────────────────
-- **파서가 실제로 있다.** `packages/crawler/src/comparison-search/skysport.ts` 와
-- 등록부(`price-source-adapter.ts`)에 연결돼 있고, 실제 응답에서 뜬 fixture 로
-- 23건의 테스트가 상품명·판매가·소비자가·이미지·URL·상품번호 추출을 고정한다.
--
-- 🔴 070/072 와 다른 점이 바로 이것이다. 그 둘은 「파서가 없어서」 is_active=false ·
-- MANUAL 로 넣었다. 여기는 파서가 있으므로 AUTO_SCRAPE · enabled=true 다 —
-- 「등록만 해 두고 수집은 안 되는」 상태를 만들지 않는다.
--
-- ── category_scope = TENNIS ───────────────────────────────────────────────
-- 테니스 전문점이고 취급 품목이 테니스/스포츠웨어와 맞는다. 🔴 공통(`'{}'`)으로
-- 넣지 «않는다» — 아동의류·골프 조사에 테니스 전문점이 섞이면 그것이 바로
-- 「카테고리별 전문 소스」 구조를 무너뜨린다(sourceFitsScopes 계약).
-- `TENNIS` 는 CATEGORY_PROFILES 에 «이미 있는» id 다(profiles.ts) — 새로 만들지 않았다.
--
-- ── access_status = 'OK' ──────────────────────────────────────────────────
-- 🔴 이번에는 'OK' 를 적는다. 072 에서 에누리·카카오를 null(미확인)로 둔 것과
-- 다르다 — 여기는 **실제로 열어 보고 가격을 읽었다**(검색 83건 + 상세
-- product_no=4877 에서 9항목 추출). 'OK' 는 실측했을 때만 적는다는 규칙을
-- 그대로 지킨 것이다(052 가 다나와에 그렇게 했다).
--
-- ── 이 파일이 하지 않는 것 ────────────────────────────────────────────────
-- · 기존 행을 UPDATE 하지 않는다(update 문이 없다). delete 문도 없다.
-- · 공통 가격비교 소스(다나와·에누리·카카오)를 건드리지 않는다 — MANUAL 그대로다.
-- · KIDS_FASHION 소스 16행을 건드리지 않는다.
-- · 해외 표(comparison_shops)를 건드리지 않는다 — 070 의 다섯 행 그대로.
-- · 세영스포츠를 «아직» 넣지 않는다. 동등 조건으로 통과했지만 CPO 가 스카이스포츠
--   Production 수집 안정성 확인 후 2순위로 판단하기로 했다.
-- · `domain` 이 unique(029:15)이고 `on conflict do nothing` 이므로 이미 있으면
--   조용히 넘어가고 기존 행의 어떤 칸도 덮어쓰지 않는다.
--
-- ── 선행 조건 ───────────────────────────────────────────────────────────────
-- 029(표) · 049(source_type) · 051(category_scope · access_status) · 053(source_role).
-- ════════════════════════════════════════════════════════════════════════════

insert into domestic_price_sources
  (name, domain, url, currency, category_scope, priority, collection_strategy, status,
   source, source_type, seller_type, enabled, access_status, access_note, source_role)
values
  -- 스카이스포츠 — 국내 테니스 전문점(라켓·의류·신발). 여러 브랜드를 직접 판매한다.
  -- source_type: 자사가 파는 소매점이라 RETAILER. 가격비교 매체가 아니다.
  -- source_role: PRICE_COLLECTION — 가격을 «관측할 판매처» 다(다나와 같은
  --              PRICE_COMPARISON 매체와 구분한다, 053 어휘 그대로).
  ('스카이스포츠', 'skysport.co.kr', 'https://skysport.co.kr', 'KRW',
   array['TENNIS'], 'P0', 'AUTO_SCRAPE', 'ACTIVE',
   'SYSTEM', 'RETAILER', 'DOMESTIC', true,
   'OK', '2026-10-04 실측: 검색(/product/search.html?keyword=) 83건·HTTP 200, 상품 상세(product_no=4877)에서 상품명·판매가·소비자가·사이즈·색상·브랜드·이미지를 서버 HTML 에서 확인했다. robots.txt 의 User-agent:* 가 상품/검색 경로를 허용하고, 약관에 자동수집을 명시적으로 금지하는 조항이 없다. 파서: packages/crawler/src/comparison-search/skysport.ts',
   'PRICE_COLLECTION')
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 적용 후 기대 — 🔴 숫자를 미리 단정하지 않는다
-- ════════════════════════════════════════════════════════════════════════════
--
-- 설정 화면    「테니스 — 국내 N곳」 = catalogSourceCount
--                 ACTIVE ∧ isCollectableAccess ∧ sourceFitsScopes ∧ catalogEnabled
--              → 다나와 · 카카오 쇼핑하우 · **스카이스포츠** 가 통과 대상이다.
--
-- 시장조사     「조사 대상 N곳」 = 위 + workspaceEnabled(셀러가 켰는지, 기본 ON)
--
-- 🔴 그리고 이번부터 그 숫자 중 **하나는 실제로 자동 수집된다**:
--      다나와 · 카카오 쇼핑하우   MANUAL        → 셀러가 직접 보는 참고 소스
--      스카이스포츠               AUTO_SCRAPE   → 실제 가격이 돌아온다
--    comparison-search/index.ts:243 이 AUTO_API/AUTO_SCRAPE 만 통과시키므로,
--    MANUAL 둘은 여전히 긁지 않는다(그 분리는 그대로다).
--
-- 🔴 에누리는 072 가 `on conflict` 로 버려졌고 기존 행이 NOT_AVAILABLE 이다 —
--    이 파일도 그 행을 건드리지 않는다.
-- ════════════════════════════════════════════════════════════════════════════
