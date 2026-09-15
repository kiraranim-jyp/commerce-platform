-- GOLF-01.5 축 A(CEO 지시, 2026-09-16) — 소스마다 «역할»을 적고, 네이버 쇼핑을
-- 가격 수집 소스에서 빼고, 같은 사업자의 채널을 «합치지 않은 채로» 묶는다.
--
-- ── 이 마이그레이션이 하지 않는 것 ──────────────────────────────────────────
-- 행을 하나도 지우지 않는다(delete 문이 없다). 새 사이트를 하나도 등록하지
-- 않는다(insert 문이 없다). GDO·Victoria 를 지우지 않는다 — 접근 차단 상태
-- 그대로 둔다(CEO: "나중에 열리면 다시 유효한 소스이고, 같은 상품의 전문몰
-- 가격 관측값이라는 의미가 있다").
--
-- 🔴 kakaku.com(가격.com)과 Yahoo! ショッピング은 이 파일에 **없다**.
--    둘 다 약관 확인에서 STOP 됐다. 파서 없이 카탈로그에만 넣으면 GDO 와 똑같이
--    "등록만 되고 값은 0곳"이 되므로 등록 자체를 하지 않는다(CTO 명시).
--      kakaku.com  利用規約 第13条(禁止行為) 첫 항: "本サービスによって提供される
--                  情報を、当社の事前の同意なく、複写、再生、複製、…、またはこれらの
--                  目的で利用又は使用するために保管する行為" — 사전 동의 없는
--                  «보관»이 금지다(가격 관측값 저장이 정확히 그 행위다).
--                  robots.txt 도 검색 경로를 막는다(Disallow: /ksearch/ ·
--                  Disallow: /prdsearch/pricehistory_data/).
--                  https://kakaku.com/terms/kiyaku.html · https://kakaku.com/robots.txt
--      Yahoo!      공식 Web API 가 있으나 "Yahoo!デベロッパーネットワークが提供する
--                  Webサービスは、利用者自身の便宜をはかる非商用目的のみに使用する
--                  ことが認められています" — 상용 이용은 법인 창구 상담·승인 절차가
--                  필요하고 우리는 그 승인이 없다. 저장소에 Client ID(appid) 도 없어
--                  실제 호출로 가격을 확인하는 것 자체가 불가능했다.
--                  https://support.yahoo-net.jp/PccDeveloper/s/article/H000011080
--
-- ── 적용 전 실측(2026-09-16, 살아있는 DB SELECT) ────────────────────────────
--   domestic_price_sources  18행 (KIDS_FASHION 16 · GOLF 2 · 카탈로그 enabled 13)
--   comparison_shops        28행 (KIDS_FASHION 25 · GOLF 3 · 전부 is_active)
--   access_status 분포  국내: null 16 · OK 1(다나와) · LOGIN_REQUIRED 1(네이버 쇼핑)
--                       해외: null 25 · OK 1(Rakuten) · BLOCKED 2(GDO · Victoria)
--   🔴 LOGIN_REQUIRED 행은 이 DB 전체에서 네이버 쇼핑 **1행뿐**이다. 그래서 아래
--      UPDATE 한 줄이 끝나면 "로그인 필요" 문구를 낼 행이 0행이 된다.
-- 적용 후에도 18행 · 28행은 그대로여야 한다.
--
-- ── 선행 조건 ───────────────────────────────────────────────────────────────
--   051(access_status · category_scope · workspace_id) · 052(골프 5행).

-- ════════════════════════════════════════════════════════════════════════════
-- ① access_status 에 'API_DISCONTINUED' 를 더한다
-- ════════════════════════════════════════════════════════════════════════════
--
-- 051 은 세 값만 알았다: OK / BLOCKED / LOGIN_REQUIRED. 네이버 쇼핑은 그중
-- LOGIN_REQUIRED 로 적혀 있고, 화면은 그 값을 보고 「🔴 로그인 필요」라고 말한다.
--
-- 🔴 그 문구는 셀러에게 «네가 로그인하면 된다»고 말한다. 사실이 아니다:
--    네이버 쇼핑 검색 API 는 2026-07-31 에 종료됐다(NAVER API HUB 로 이전하지
--    않고 종료). https://developers.naver.com/notice/article/32564
--    셀러가 로그인해도 가격 수집은 열리지 않는다. 해결할 수 없는 일을 셀러에게
--    시키는 UX 를 없애라는 것이 이번 CEO 지시다.
--
-- LOGIN_REQUIRED 라는 값 자체는 남긴다 — 앞으로 «로그인하면 실제로 열리는»
-- 사이트가 나오면 그때는 맞는 말이 된다. 지금 그 값을 쓰는 행이 0행이 될 뿐이다.
alter table domestic_price_sources drop constraint if exists domestic_price_sources_access_status_check;
alter table domestic_price_sources
  add constraint domestic_price_sources_access_status_check
  check (access_status is null or access_status in ('OK', 'BLOCKED', 'LOGIN_REQUIRED', 'API_DISCONTINUED'));

alter table comparison_shops drop constraint if exists comparison_shops_access_status_check;
alter table comparison_shops
  add constraint comparison_shops_access_status_check
  check (access_status is null or access_status in ('OK', 'BLOCKED', 'LOGIN_REQUIRED', 'API_DISCONTINUED'));

-- ════════════════════════════════════════════════════════════════════════════
-- ② source_role — "이 소스는 무엇을 해 주는가"
-- ════════════════════════════════════════════════════════════════════════════
--
-- 오늘 화면은 소스를 **세기만** 한다("국내 2곳 · 해외 3곳"). 그래서 가격을 주는
-- 소스와 안 주는 소스가 같은 숫자 안에 들어간다. CEO 가 요구한 화면은 숫자가
-- 아니라 역할이다.
--
--   'PRICE_COMPARISON'  여러 판매자의 값을 한자리에 모아 주는 가격비교 매체
--   'PRICE_COLLECTION'  그 자리에서 파는 가격 자체를 얻는 판매처/마켓플레이스
--   'DEMAND_DATA'       가격이 아니라 수요·검색 트렌드를 주는 소스
--   null                아직 분류하지 않았다  ← 아동복 16행·25행 전부
--
-- 🔴 기존 41행(아동복)은 건드리지 않고 null 로 둔다. "편집샵이니까 당연히
--    가격 수집이겠지"는 추정이고, 이 저장소는 추정으로 값을 넓히지 않는다
--    (051 이 mytheresa 에 대해 같은 판단을 했다). 화면은 null 이면 아무 말도
--    하지 않는다 — 분류하지 않은 것을 분류한 척하지 않는다.
--
-- 🔴 access_status(열리는가) · collection_strategy(우리가 읽을 수 있는가)와
--    **세 번째로 다른 축**이다. 다나와는 역할이 가격비교이면서 collection_strategy
--    는 MANUAL 이다(열리지만 우리 파서가 없다). 셋을 한 칸에 합치면 그 순간
--    화면이 다시 뭉뚱그린 말을 하기 시작한다.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'domestic_price_sources' and column_name = 'source_role'
  ) then
    alter table domestic_price_sources
      add column source_role text
        check (source_role is null or source_role in ('PRICE_COMPARISON', 'PRICE_COLLECTION', 'DEMAND_DATA'));
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comparison_shops' and column_name = 'source_role'
  ) then
    alter table comparison_shops
      add column source_role text
        check (source_role is null or source_role in ('PRICE_COMPARISON', 'PRICE_COLLECTION', 'DEMAND_DATA'));
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ③ operator_key — 같은 사업자의 채널을 «합치지 않은 채로» 묶는다
-- ════════════════════════════════════════════════════════════════════════════
--
-- CEO 판단(2026-09-16): GDO 본점과 Rakuten 의 GDO 공식점은 같은 사업자여도
-- 가격이 별개다 — 채널별 할인·쿠폰·포인트·재고·배송비·캠페인·취급상품·아웃렛·
-- 회원혜택이 다르기 때문이다.
--
--     GDO 본점       ¥110,000
--     GDO Rakuten     ¥99,000
--     Yahoo GDO      ¥105,000
--   → "하나만 본다"가 아니라 "동일 판매자가 채널마다 얼마에 파는가"를 보여준다.
--
-- 조사 결과: 이 관계를 적을 자리가 오늘 구조에 **없다**. comparison_shops 에는
-- 부모/사업자 개념이 없고, price_observations 는 source_ref_id(= 사이트 한 행)로
-- 만 매달린다. 그래서 컬럼 하나만 만든다.
--
-- 🔴 이 컬럼은 «표시 전용»이다. 집계 키로 쓰지 않는다. 같은 operator_key 를 가진
--    두 행의 가격을 평균/대표값으로 합치는 코드가 생기면 CEO 가 금지한 바로 그
--    동작이 된다(검증: golf015-operator-channel.test.ts 가 두 채널의 값이 따로
--    남는지를 실행으로 본다).
--
-- 🔴 오늘 채널 상대편 행이 없다. Rakuten 안의 GDO 공식점(rakuten.co.jp/gdoshop)은
--    별도 행이 아니라 'Rakuten 市場' 마켓플레이스 한 행에 들어 있다(052 주석이
--    남긴 사실 그대로). 파서가 없는 사이트를 새로 등록하지 않는다는 이번 규칙
--    때문에 여기서 그 행을 만들지 않는다 — 자리만 만들고, 사실은 access_note 에
--    이미 적혀 있다. 즉 «합칠 대상 자체가 없으므로 합쳐질 수도 없다».
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comparison_shops' and column_name = 'operator_key'
  ) then
    alter table comparison_shops add column operator_key text;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ④ 값 채우기 — 실측으로 확인된 5행만 건드린다
-- ════════════════════════════════════════════════════════════════════════════

-- 다나와: 여러 판매자의 값을 한자리에 모아 주는 국내 최대 가격비교 포털이다.
-- access_status='OK'(열린다) · collection_strategy='MANUAL'(파서 없음)은 그대로다.
update domestic_price_sources
   set source_role = 'PRICE_COMPARISON'
 where domain = 'danawa.com' and source_role is null;

-- 🔴 네이버 쇼핑 — 이번 지시의 핵심 한 줄.
--   · 가격 자동수집 소스에서 «제외»한다 → access_status='API_DISCONTINUED'
--     (isCollectableAccess 가 이 값을 막으므로 조사 대상에서 구조적으로 빠진다.
--      status='NOT_AVAILABLE' 은 이미 052 가 넣어 뒀고 그대로 둔다 — 두 겹으로
--      막힌다.)
--   · 역할을 «수요/검색 트렌드»로 바꾼다 → source_role='DEMAND_DATA'
--   · 행을 지우지 않는다. "우리가 확보하지 못한 사이트"와 "공식 경로가 없어진
--     사이트"는 셀러에게 전혀 다른 사실이다.
-- 🔴 쇼핑인사이트(DataLab) 실연동은 이번 범위 밖이다 — access_note 에 그 사실을
--    그대로 적는다. 연동되지 않은 것을 연동된 것처럼 적지 않는다.
update domestic_price_sources
   set source_role  = 'DEMAND_DATA',
       access_status = 'API_DISCONTINUED',
       access_note  = '2026-09-16: 네이버 쇼핑 검색 API가 2026-07-31 종료됐다(NAVER API HUB로 이전하지 않고 종료, https://developers.naver.com/notice/article/32564). 셀러가 로그인해도 가격 수집이 열리지 않으므로 가격 자동수집 소스에서 제외한다. 역할은 수요/검색 트렌드로 바꿨다 — 네이버 데이터랩 쇼핑인사이트 API는 살아 있으나 실연동은 아직 하지 않았다(범위 밖).'
 where domain = 'shopping.naver.com';

-- 해외 골프 3행 — 전부 "그 자리에서 파는 가격"을 얻는 소스다.
-- GDO·Victoria 는 지금 BLOCKED 지만 역할은 그대로 적는다(CEO: 나중에 열리면
-- 다시 유효한 소스다). 역할과 접근 가능 여부는 다른 칸이다.
update comparison_shops
   set source_role = 'PRICE_COLLECTION'
 where domain in ('shop.golfdigest.co.jp', 'victoriagolf.co.jp', 'rakuten.co.jp')
   and source_role is null;

-- 사업자 묶음. Rakuten 市場 은 마켓플레이스 자체(사업자가 아니다)라 비워 둔다.
update comparison_shops set operator_key = 'GDO'
 where domain = 'shop.golfdigest.co.jp' and operator_key is null;
update comparison_shops set operator_key = 'Victoria Golf(Xebio)'
 where domain = 'victoriagolf.co.jp' and operator_key is null;

-- ════════════════════════════════════════════════════════════════════════════
-- 적용 후 검증 SELECT (행 수가 그대로인지 · 값이 들어갔는지)
-- ════════════════════════════════════════════════════════════════════════════
--   select count(*) from domestic_price_sources;                        -- 18 이어야 한다
--   select count(*) from comparison_shops;                              -- 28 이어야 한다
--   select count(*) from domestic_price_sources
--    where enabled and 'KIDS_FASHION' = any(category_scope);            -- 11 이어야 한다
--   select count(*) from comparison_shops
--    where is_active and 'KIDS_FASHION' = any(category_scope);          -- 25 이어야 한다
--   select count(*) from domestic_price_sources
--    where access_status = 'LOGIN_REQUIRED';                            -- 0 이어야 한다
--   select count(*) from comparison_shops where access_status = 'LOGIN_REQUIRED'; -- 0
--   select domain, source_role, access_status from domestic_price_sources
--    where 'GOLF' = any(category_scope) order by domain;
--   select domain, source_role, operator_key, access_status from comparison_shops
--    where 'GOLF' = any(category_scope) order by domain;

-- ════════════════════════════════════════════════════════════════════════════
-- 롤백 (파괴적이지 않다 — 행은 어느 방향으로도 사라지지 않는다)
-- ════════════════════════════════════════════════════════════════════════════
--   update domestic_price_sources
--      set access_status = 'LOGIN_REQUIRED',
--          access_note = '2026-09-15 실측: 로그인을 요구해 비로그인 상태로는 가격을 볼 수 없다. 자동·수동 모두 셀러 계정이 필요하다.'
--    where domain = 'shopping.naver.com';
--   update domestic_price_sources set source_role = null where domain in ('danawa.com','shopping.naver.com');
--   update comparison_shops set source_role = null, operator_key = null
--    where domain in ('shop.golfdigest.co.jp','victoriagolf.co.jp','rakuten.co.jp');
--   alter table comparison_shops drop column if exists operator_key;
--   alter table comparison_shops drop column if exists source_role;
--   alter table domestic_price_sources drop column if exists source_role;
--   alter table domestic_price_sources drop constraint if exists domestic_price_sources_access_status_check;
--   alter table domestic_price_sources add constraint domestic_price_sources_access_status_check
--     check (access_status is null or access_status in ('OK','BLOCKED','LOGIN_REQUIRED'));
--   alter table comparison_shops drop constraint if exists comparison_shops_access_status_check;
--   alter table comparison_shops add constraint comparison_shops_access_status_check
--     check (access_status is null or access_status in ('OK','BLOCKED','LOGIN_REQUIRED'));
--   🔴 access_status 를 먼저 되돌리지 않고 제약부터 좁히면 API_DISCONTINUED 행
--      때문에 실패한다 — 위 순서를 지킨다.
--   (코드는 source_role/operator_key 를 전부 optional 로 읽으므로 — 051 의
--    세 컬럼과 같은 패턴 — 롤백해도 select("*") 가 깨지지 않는다.)
