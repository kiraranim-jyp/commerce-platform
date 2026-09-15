-- GOLF-01 축 A(CEO 지시, 2026-09-15) — 시장조사 사이트를 "카테고리로 고르고,
-- 셀러별로 격리하고, 수집 가능 여부를 거짓 없이 말할 수 있게" 하는 최소 스키마.
--
-- ── 이 마이그레이션이 하지 않는 것 ──────────────────────────────────────────
-- 행을 하나도 지우지 않는다. 기존 값을 덮어쓰지 않는다(새 컬럼만 채운다).
-- 새 테이블을 만들지 않는다. domestic_price_sources 와 comparison_shops 를
-- 합치지 않는다(029 주석이 분리를 결정했고 price_observations.source_ref_id ·
-- domestic_product_links.source_id 가 FK로 물려 있다).
-- 카테고리 어휘를 새로 만들지 않는다 — KIDS_FASHION / GOLF 는 둘 다
-- packages/category/src/profiles.ts 의 CATEGORY_PROFILES 에 이미 있는 값이다.
--
-- ── 적용 전 실측(2026-09-15, 살아있는 DB SELECT) ────────────────────────────
--   domestic_price_sources  16행 (카탈로그 enabled 11 · 전부 SYSTEM · 전부 KRW)
--   comparison_shops        25행 (전부 is_active · SYSTEM 6 / USER 19)
-- 적용 후에도 이 두 숫자는 그대로여야 한다(이 파일에 delete 문이 없다).

-- ════════════════════════════════════════════════════════════════════════════
-- ① comparison_shops.category_scope — 해외에는 "카테고리"라는 개념 자체가 없었다
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 기본값을 '{}' 로 두고 끝내면 안 된다. sourceFitsScopes(profiles.ts:390-394)는
--    **빈 배열을 "모든 카테고리"로 읽는다** — 관리자가 추가한 소스가 조용히
--    사라지지 않게 하려고 일부러 그렇게 만든 규칙이다. 그래서 컬럼만 더하고
--    비워 두면 아동복 편집샵 25곳이 골프용품 조사에 **전부** 따라붙는다.
--    CEO가 "아동의류 소스가 골프에 섞이면 FAIL"이라고 한 바로 그 실패다.
--    그래서 기존 25행에 KIDS_FASHION 을 **명시적으로** 적는다.
--
--    이 25행이 정말 전부 아동복인가 — 실측으로 확인했다(2026-09-15 SELECT):
--    melijoe / smallable / childrensalon / alexandalexa / junioredition /
--    kidsroom / babyshop / bobochoses / kids-world / kidsdepartment /
--    luksusbaby / nickis / petitemaisonkids / designerkidswear / kidbizkid /
--    villagekids / folkberlin / isolabellakids / scoutandcokids / studioplay /
--    pandaandcub / cissyweras / bucketsandspades / shoppiccoliandco /
--    mytheresa — 19행이 019~ 이후 사람이 직접 추가한 아동복 편집샵이고,
--    6행은 019 seed 의 아동복 편집샵이다. mytheresa 만 종합 럭셔리이지만
--    이 저장소에 등록된 경위가 아동 소싱이라 같은 값을 준다(추정으로 값을
--    넓히지 않는다 — 넓혀야 하면 설정 화면에서 사람이 넓힌다).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comparison_shops' and column_name = 'category_scope'
  ) then
    alter table comparison_shops add column category_scope text[] not null default '{}';
  end if;
end $$;

-- 비어 있는 행만 채운다(재실행해도 사람이 바꾼 값을 되돌리지 않는다).
update comparison_shops
   set category_scope = array['KIDS_FASHION']
 where category_scope is null or cardinality(category_scope) = 0;

-- ════════════════════════════════════════════════════════════════════════════
-- ② access_status / access_note — "등록됨"과 "수집 성공"은 다른 사실이다
-- ════════════════════════════════════════════════════════════════════════════
--
-- CEO 실측(2026-09-15): Danawa ✅ 값 확인 · Rakuten ✅ 값 확인 ·
-- GDO ❌ Akamai 403(curl · WebFetch · 헤드리스 크롬 전부 차단) ·
-- Victoria 자사몰 ❌ Cloudflare 403 · Naver Shopping ❌ 로그인 요구.
--
-- 이 사실을 적을 자리가 오늘 한 곳도 없다:
--   status               ACTIVE/PAUSED/NOT_AVAILABLE/ERROR — "지금 쓰는가"
--   collection_strategy  AUTO_API/AUTO_SCRAPE/MANUAL/NOT_AVAILABLE — "우리 파서가 있는가"
--   last_error_code      마지막 자동 확인의 결과 — 매 실행마다 덮어쓰인다
-- 셋 다 "사람이 직접 열어 봤더니 403이었다"를 담지 못한다. 그래서 그 사실
-- 전용 칸을 둔다. 값은 셋뿐이고 전부 실측에서 나온 것만 쓴다:
--   'OK'              직접 열어서 실제 가격 값을 확인했다
--   'BLOCKED'         WAF/봇차단으로 접근 자체가 막혔다
--   'LOGIN_REQUIRED'  로그인 없이는 값을 볼 수 없다
--   null              이번에 확인하지 않았다  ← 기존 16행 · 25행 전부
-- 🔴 null 을 "수집 가능"으로 읽지 않는다. "모르는 것"을 "되는 것"으로 둔갑시키면
--    화면이 또 거짓말을 한다(sourceFitsScopes 가 null 을 다루는 것과 같은 원칙).
--
-- access_note 는 사람이 읽는 근거 한 줄이다. 차단 사유와 — 있으면 — 우회
-- 경로(예: 자사몰은 막혔지만 공식 마켓플레이스 점포는 열려 있다)를 적는다.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'domestic_price_sources' and column_name = 'access_status'
  ) then
    alter table domestic_price_sources
      add column access_status text
        check (access_status is null or access_status in ('OK', 'BLOCKED', 'LOGIN_REQUIRED')),
      add column access_note text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comparison_shops' and column_name = 'access_status'
  ) then
    alter table comparison_shops
      add column access_status text
        check (access_status is null or access_status in ('OK', 'BLOCKED', 'LOGIN_REQUIRED')),
      add column access_note text;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- ③ domestic_price_sources.workspace_id — 셀러가 추가한 사이트는 그 셀러 것이다
-- ════════════════════════════════════════════════════════════════════════════
--
-- 오늘: createDomesticPriceSource() 가 workspace_id 없이 공용 카탈로그에 INSERT
-- 한다. A 셀러가 추가한 사이트가 B·C 셀러의 목록에도 즉시 나타난다. 047이
-- 만든 "셀러별"은 on/off 에만 적용되고 목록의 구성에는 적용되지 않았다.
-- (실측: source='USER' 국내 소스가 0행이라 아직 드러나지 않았을 뿐이다.)
--
--   null     = 중앙 기본 카탈로그 (오늘의 16행 전부 — 값을 건드리지 않는다)
--   non-null = 그 셀러만 보는 추가분
--
-- 🔴 새 테이블(SellerMarketSource)을 만들지 않는다. on/off 는 이미
--    workspace_domestic_shop_settings 가 하고, 소유자는 컬럼 하나로 끝난다.
--    price_observations.source_ref_id · domestic_product_links.source_id 의
--    FK 를 건드리지 않는 것이 047이 새 카탈로그 테이블을 거부한 이유 그대로다.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'domestic_price_sources' and column_name = 'workspace_id'
  ) then
    alter table domestic_price_sources
      add column workspace_id uuid references workspaces(id) on delete cascade;
  end if;
end $$;

create index if not exists domestic_price_sources_workspace_idx
  on domestic_price_sources (workspace_id);

-- domain unique(029:15) 는 "한 도메인은 이 서비스 전체에서 한 번만"이라는 뜻이었다.
-- 소유자가 생긴 이상 그 뜻은 "한 소유자 안에서 한 번만"이 되어야 한다 — 아니면
-- B 셀러가 A 셀러가 추가한(그리고 B에게는 보이지도 않는) 도메인을 추가하려다
-- "이미 등록된 도메인입니다"를 받고 영문을 모른다.
--
-- 🔴 행을 지우지 않는다. 제약의 모양만 바꾼다. nil uuid 를 공용(null) 자리
--    표시자로 쓰므로 **기존 16행에 대한 보장은 글자 그대로 유지된다**
--    (공용 카탈로그 안에서 domain 은 여전히 유일하다).
alter table domestic_price_sources drop constraint if exists domestic_price_sources_domain_key;
create unique index if not exists domestic_price_sources_owner_domain_key
  on domestic_price_sources (coalesce(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), domain);

-- ════════════════════════════════════════════════════════════════════════════
-- 롤백 (파괴적이지 않다 — 행은 어느 방향으로도 사라지지 않는다)
-- ════════════════════════════════════════════════════════════════════════════
--   drop index if exists domestic_price_sources_owner_domain_key;
--   alter table domestic_price_sources add constraint domestic_price_sources_domain_key unique (domain);
--       ↑ 셀러별 추가로 같은 domain 이 둘 이상 생긴 뒤라면 이 줄이 실패한다.
--         그때는 셀러 추가분을 먼저 옮기거나 지워야 하므로 사람이 판단한다.
--   drop index if exists domestic_price_sources_workspace_idx;
--   alter table domestic_price_sources drop column if exists workspace_id;
--   alter table domestic_price_sources drop column if exists access_status, drop column if exists access_note;
--   alter table comparison_shops drop column if exists access_status, drop column if exists access_note;
--   alter table comparison_shops drop column if exists category_scope;
--   (코드는 세 컬럼을 전부 optional 로 읽으므로 — 032의 last_checked_at · 049의
--    source_type 과 같은 패턴 — 롤백해도 select("*") 가 깨지지 않는다.)
