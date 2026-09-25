# 시장조사 카테고리 체계 — 조사 보고 (구현 없음)

작성 2026-09-15 · 조사 전용 · 코드/마이그레이션/DB write 없음 (SELECT만)
HEAD `c52e334` (HOLD, 푸시 안 함) · 이 문서는 워킹트리 전용, 커밋하지 않는다.

---

## 0. 한 줄 결론

CEO가 그린 4개 테이블 중 **새로 만들어야 하는 것은 하나도 없다.**
다만 **셀러별 "추가"는 오늘 존재하지 않고**(on/off만 있다), **해외(comparison_shops)에는 카테고리라는 개념 자체가 없다.**
그리고 진짜 병목은 테이블이 아니라 **카탈로그다 — 살아있는 DB의 16개 국내 소스가 전부 KIDS_FASHION이고, 골프는 0개, 라이프스타일도 0개다.**

---

## 1. 🔴 핵심 답 — CEO의 4개 테이블 대조

| CEO 구상 | 저장소의 실체 | 판정 |
|---|---|---|
| **Category** (시장조사 카테고리 마스터) | `CATEGORY_PROFILES` — **코드 상수**, `packages/category/src/profiles.ts:152-253`. 4개(KIDS_FASHION / WOMEN_FASHION / FASHION_ACCESSORIES / HOME_LIFESTYLE). 여기서 나오는 **스코프 어휘**는 6개(위 4개 + `KIDS_GOODS` + `MATERNITY`) | **이름만 다름.** 개념은 있다. 단 DB 테이블이 아니라 TS 상수라 **런타임 추가 불가** |
| **MarketSource** (조사 대상 사이트) | **두 벌이 이미 있다.** `domestic_price_sources`(국내·KRW·16행) / `comparison_shops`(해외·19개 USER + 6개 SYSTEM) | **기존으로 커버.** 합치면 안 된다 — 029 주석이 명시적으로 분리를 결정했고, `price_observations.source_ref_id` · `domestic_product_links.source_id` 가 FK로 물려 있다 |
| **CategoryMarketSource** (카테고리별 기본 사이트) | 국내: `domestic_price_sources.category_scope text[]` — 조인 테이블 없이 비정규화된 M:N. 실제로 동작 중 | 국내는 **기존으로 커버**. 해외는 **정말 없음** (comparison_shops에 카테고리 컬럼 자체가 없다) |
| **SellerMarketSource** (셀러별 추가) | `workspace_domestic_shop_settings` — **on/off 전용.** "추가"는 `createDomesticPriceSource()`가 **공용 카탈로그에 workspace_id 없이** 넣는다 | **정말 없음.** 오늘 셀러가 사이트를 추가하면 **모든 셀러에게 보인다** |

**정말 새로 필요한 것 (2개, 둘 다 테이블이 아니라 컬럼으로 해결 가능):**
1. 해외 소스의 카테고리 적합도 — `comparison_shops.category_scope`
2. 셀러별 "추가"의 소유자 — `domestic_price_sources.workspace_id` (null = 공용 카탈로그)

---

## 2. A — 현재 "카테고리 → 조사 대상 사이트" 결정 경로 (전수 추적)

### 2.1 국내 (동작함 — 카테고리를 실제로 읽는다)

```
① URL 입력      apps/admin/src/app/pipeline/page.tsx:877-893  (카테고리 선택 없음)
   submit       apps/admin/src/app/pipeline/page.tsx:431 runPipeline()
   payload      apps/admin/src/app/pipeline/page.tsx:451  body: JSON.stringify({ url })
        ↓
② 카테고리 자동 추론 (사용자 선택 아님)
   apps/admin/src/app/api/domestic-price-sources/_lib/category-scope.ts:46-64
     resolveCategoryScopes({ title, description, brand, sourceUrl, breadcrumbPath, recommendedAge })
       → resolveProductSignals(...)              packages/category/src/product-resolver.ts
       → detectCategoryProfile(signals, text, brand)   packages/category/src/profiles.ts:306-357
       → detectionMarketSourceScopes(detection)        packages/category/src/profiles.ts:279-281
     반환: string[] | null   (판정 실패 시 null = 필터 없음)
        ↓
③ 소스 목록 = 카탈로그 × 셀러 on/off
   apps/admin/src/app/api/domestic-price-sources/_lib/domestic-price-source.ts:123-139
     listDomesticPriceSources(workspaceId)
       - :126-130  select * from domestic_price_sources        (공용 카탈로그, 전 행)
       - :136      loadWorkspaceShopSettings(workspaceId)      (설정 행 없으면 ON)
       - :98       enabled = row.enabled && workspaceEnabled   ← 두 플래그 합치는 유일 지점
        ↓
④ 최종 필터 (두 곳, 같은 식)
   저장 경로  apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts:330-332
   라이브 검색 apps/admin/src/app/api/domestic-price-sources/search/route.ts:178-180
     (s) => s.enabled && s.status === "ACTIVE" && sourceFitsScopes(s.categoryScope, categoryScopes)
        ↓
⑤ P0 우선 · 조기 중단   run-domestic-price-check.ts:333-334, 370-373
```

호출부(② → ④ 연결):
- `apps/admin/src/app/api/price-history/_lib/trigger-domestic-price-check.ts:69` — `categoryScopes: resolveCategoryScopesFromProduct(product)`
- `apps/admin/src/app/api/price-history/check/route.ts:57` — 같은 호출

### 2.2 해외 (카테고리를 아예 보지 않는다)

```
apps/admin/src/app/api/comparison/search/route.ts:54
  const shops = (await listComparisonShops()).filter((s) => s.isActive);
```
- `resolveCategoryScopes` / `sourceFitsScopes` **import조차 없다.**
- `listComparisonShops()` (`apps/admin/src/app/api/comparison-shops/_lib/comparison-shop.ts:47-60`) 는 **workspaceId 인자가 없다** — 전 워크스페이스 공용, 셀러별 설정 테이블 없음.
- `sourceUrl`은 ① 원본가 직접 확인(`verifySourcePriceDirect`, route.ts:24-29) ② 매칭 질의 재료(route.ts:49-52) 로만 쓰인다. **검색 대상 집합을 URL 도메인으로 좁히지 않는다.**

> 🔴 CEO의 "URL의 사이트 ≠ 조사 대상 사이트" 원칙은 **이미 지켜지고 있다.** 국내·해외 어느 쪽도 입력 URL의 도메인으로 대상을 고르지 않는다.

### 2.3 `sourceFitsScopes` 의 정확한 규칙

`packages/category/src/profiles.ts:390-394`
```ts
export function sourceFitsScopes(sourceCategoryScope: string[], profileScopes: string[] | null): boolean {
  if (!profileScopes || profileScopes.length === 0) return true;   // 상품 카테고리 미정 → 전부 통과
  if (sourceCategoryScope.length === 0) return true;               // 소스가 주장 안 함 → 전부 통과
  return sourceCategoryScope.some((scope) => profileScopes.includes(scope));  // 양쪽 다 값 → 교집합 필요
}
```
- **빈 배열은 "아무 카테고리에도 안 맞음"이 아니라 "모든 카테고리"다.** 주석(:382-389)이 이유를 적어 뒀다 — 관리자가 추가한 소스(POST 기본값이 빈 배열)가 조용히 사라지지 않게 하기 위함.
- **부작용:** 셀러가 추가한 소스는 `category_scope=[]`라 **항상 통과한다.** 결과적으로 "카테고리 기본 + 셀러 추가"가 성립하지만, **설계가 아니라 우연이다** (아래 §4).
- 테스트가 이 규칙을 고정하고 있다: `packages/category/src/__tests__/category-profile.test.ts:219-228`

### 2.4 `resolveCategoryScopes` 의 근거 — 자동 추론이다

`detectCategoryProfile` (`profiles.ts:306-357`) 우선순위:
1. **상품유형** (`PRODUCT_TYPE_KEYWORDS` 파생, 아동 신호가 있으면 가로채지 않음) :324-330
2. **브랜드** (`brandHints`, 아동 전문 브랜드 17개) :334-339
3. **연령·성별** (breadcrumb/URL 유래 신호) :342-347
4. **어휘** (하위 프로필 키워드) :351-354
5. 아무것도 못 맞추면 **`null`** :356

`profiles.ts:290-294` 주석이 설계 의도를 명시한다:

> "수집된 신호만으로 카테고리를 추정한다. **설정 화면에서 고르게 하지 않는다** — 셀러가 URL을 붙여넣는 순간 우리는 이미 breadcrumb·URL·브랜드·제목을 다 갖고 있고, 그걸 두고 다시 묻는 것은 우리가 게으른 것이다(CEO 지시: URL → 수집 → 카테고리 자동 추정 → [카테고리 변경])."

> 🔴 **이번 지시(상품검색 화면에서 대상 카테고리를 고른다)는 이 기록된 CEO 지시와 정면으로 다르다.** 어느 쪽이 최신 의사인지는 CEO만 정할 수 있다. 다만 기존 설계가 예고한 **[카테고리 변경] 오버라이드 버튼은 코드에 존재하지 않는다** — `detectCategoryProfile` 결과가 화면에 노출되는 자리가 한 곳도 없다(`grep detectCategoryProfile` 결과: 서버 lib 1곳뿐).

---

## 3. B — 카테고리 마스터: enum 인가 DB 인가

**둘 다 아니다. TypeScript 상수다.**

- 타입: `packages/category/src/profiles.ts:47`
  ```ts
  export type CategoryProfileId = "KIDS_FASHION" | "WOMEN_FASHION" | "FASHION_ACCESSORIES" | "HOME_LIFESTYLE";
  ```
- 표: `CATEGORY_PROFILES` `profiles.ts:152-253` — Prisma enum도, Postgres enum도, 마스터 테이블도 아니다.
- DB 쪽은 `domestic_price_sources.category_scope text[]` 하나뿐 (`029_domestic_price_sources.sql:20`). **CHECK 제약도 FK도 없다** (실측: `pg_constraint`에 `category_scope` 관련 제약 0건). 즉 **DB는 아무 문자열이나 받는다.**

**두 어휘가 나란히 있다 (섞으면 안 된다):**

| | 값 | 어디 |
|---|---|---|
| 카테고리 프로필 id | 4개 | `CategoryProfileId` |
| 시장조사 스코프 | 6개 — 위 4개 + `KIDS_GOODS` + `MATERNITY` | `profile.marketSourceScopes` / `subProfile.extraMarketSourceScopes` / DB `category_scope` |

`KIDS_GOODS`와 `MATERNITY`는 **프로필 id가 아니다** — 스코프 어휘일 뿐이다(`profiles.ts:186`, `:210`).

**런타임 추가 가능한가 — 반만.**
- ✅ 소스에 스코프 **문자열을 붙이는 것**은 API가 받는다: `POST /api/domestic-price-sources` (`route.ts:23` `categoryScope?: string[]`), `PATCH .../[id]` (`[id]/route.ts` `categoryScope`).
- ❌ **설정 화면 UI는 categoryScope를 한 번도 보내지 않는다.** 실측: `settings/page.tsx:3306`(추가) / `:3330`(on/off) / `:3341`(priority) / `:3353`(strategy) — 전부 categoryScope 없음. 화면은 `:3416`에서 **읽기 전용으로 표시만** 한다.
- ❌ **새 카테고리 자체를 추가하는 자리는 없다.** `CATEGORY_PROFILES`에 항목을 더하는 코드 변경이 유일한 방법이다. 이건 의도된 설계다 — `profiles.ts:141-151` 주석: "쓰이지 않는 프로필은 검증되지 않고, 검증되지 않은 프로필은 다음 사람에게 '이미 지원한다'는 거짓말이 된다."

**아동의류 / 골프용품:**
- 아동의류 → `KIDS_FASHION` (+ `KIDS_GOODS`) — **있다.**
- 골프용품 → **없다.** 프로필도, 스코프도, 어휘도, 소스도 0.

**커머스 카테고리와의 경계 — 오늘은 지켜지고 있다.**
| 체계 | 정의 위치 | 타입 |
|---|---|---|
| 시장조사 카테고리 | `packages/category/src/profiles.ts:47,152` | `CategoryProfileId` / `marketSourceScopes: string[]` |
| 채널 카테고리(스마트스토어/쿠팡/LotteON) | `packages/category/src/platform-categories/*.categories.ts`, 레지스트리 `platform-categories/index.ts:10-14` | `PlatformCategoryTable` (ProductType → 경로) |
- 두 타입이 서로를 참조하지 않는다. 화면의 `CategoryRecommendationPanel`은 **채널 카테고리**를 고르는 UI이고, 시장조사 스코프와 무관하다.
- 접점은 단 하나 — `fitCategoryPath()`(`profiles.ts:371-380`)가 프로필의 `platformPathKeywords`로 채널 경로 **후보 점수를 보정**한다. 값을 합치지는 않는다.

---

## 4. C — 셀러별 설정: on/off 인가 추가도 되는가

### 4.1 on/off — 제대로 되어 있다
`047_workspace_domestic_shop_settings.sql:40-53`
```sql
create table if not exists workspace_domestic_shop_settings (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_id    uuid not null references domestic_price_sources(id) on delete cascade,
  enabled      boolean not null default true,
  ...
  primary key (workspace_id, source_id)
);
```
- 실효 노출 = `카탈로그 enabled AND (설정 행 없음 OR 설정 enabled)` — 합치는 자리는 `domestic-price-source.ts:98` **한 곳뿐**.
- 설정 행 없음 = ON (`:138` `settings.get(row.id) ?? true`). 마이그레이션 주석(:21-23)이 이유를 적어 뒀다.
- 실측: 테이블 존재, 30행 / 6 workspace.
- 쓰기는 `setWorkspaceDomesticShopEnabled()` (`:169-189`) upsert 하나뿐. `domestic_price_sources.enabled`는 타입에서 구조적으로 막아 놨다(`:262-273` 주석).

### 4.2 "추가" — 🔴 셀러별이 아니다
`createDomesticPriceSource()` `domestic-price-source.ts:219-260`
```ts
.insert({
  name, domain: parsed.domain, url: parsed.url, currency: "KRW",
  category_scope: input.categoryScope ?? [],   // ← UI는 항상 [] 를 보낸다
  priority: input.priority ?? "P2",
  collection_strategy: input.collectionStrategy ?? "MANUAL",
  status: "ACTIVE", source: "USER", enabled: true,
})
```
- **`workspace_id`가 없다.** `domestic_price_sources`에 그런 컬럼 자체가 없다(실측 19컬럼 전수 확인).
- 따라서 **A 셀러가 추가한 사이트는 B·C 셀러의 목록에도 즉시 나타난다.** `listDomesticPriceSources()`가 카탈로그를 무조건 전 행 읽기 때문이다(`:126-130`).
- 권한도 `requireUser()`뿐 — 관리자 전용이 아니다(`api/domestic-price-sources/route.ts:16`).
- `domain`에 unique 제약이 있어(029:15) **두 셀러가 같은 사이트를 각자 추가할 수 없다** — 두 번째 셀러는 "이미 등록된 도메인입니다"를 받는다(`:236`).
- 삭제는 `source='USER'`만 가능(`:291-311`). SYSTEM은 비활성화만.

> 이 구조에서 047이 말하는 "셀러별"은 **선택(on/off)에만 적용되고 목록의 구성(추가)에는 적용되지 않는다.** CEO 구조의 "셀러별 추가"는 **오늘 존재하지 않는다.**

### 4.3 해외 comparison_shops — 셀러별 설정이 전혀 없다
실측 컬럼 9개: `id, name, domain, url, country, currency, source, is_active, created_at, updated_at`
- `category_scope` **없음** · `workspace_id` **없음** · `priority`/`collection_strategy` **없음**
- `listComparisonShops()`에 workspaceId 인자 없음 (`comparison-shop.ts:47`)
- 추가 UI도 `{ url, name }`만 보낸다 (`settings/page.tsx:3139-3142`)
- 실측 25행 중 **19행이 이미 `source='USER'`** — 즉 지금도 사람이 추가한 해외샵이 전부 전역 공유 중이다.

---

## 5. D — 상품검색 화면

| | |
|---|---|
| URL 입력 | `apps/admin/src/app/pipeline/page.tsx:877-893` (`<input type="url">`, aria-label "상품 URL") |
| 제출 | `page.tsx:431` `runPipeline()` → `POST /api/pipeline` (SSE) |
| payload | `page.tsx:451` `body: JSON.stringify({ url })` ← **여기에 필드 하나만 늘리면 된다** |
| 시장조사 카테고리 선택 UI | **없다** |
| 채널 카테고리 선택 UI | 있다 — `pipeline/commerce/CategoryRecommendationPanel.tsx`, 등록 화면(채널 탭)에서. **시장조사 카테고리와 무관하다** |
| 지금 카테고리를 정하는 시점 | URL 수집 **후** 서버에서 자동 추론. 사용자에게 묻지 않고, 추론 결과를 화면에 보여주지도 않는다 |
| 검색 화면 ↔ 등록 화면 | 분리돼 있다. `page.tsx`가 검색, 분석 완료 후 `CommerceWorkspace`가 등록 |

**카테고리 선택을 붙이는 게 자연스러운 자리**
- 화면: `page.tsx:877-893` URL 입력 줄 옆 — `url` 과 같은 `useState` 한 줄이면 된다(폼 라이브러리 없음, 순수 useState).
- 전달: `page.tsx:451` payload에 `categoryScope` 추가 → `/api/pipeline` → 이후 `trigger-domestic-price-check.ts:69` / `check/route.ts:57` 의 `resolveCategoryScopesFromProduct(product)` 자리에 **오버라이드로** 끼운다.
- 🔴 **주의:** `resolveCategoryScopes`는 오늘 스냅샷만 받는 순수 함수다. 셀러 선택값을 실어 나르려면 **선택값이 스냅샷과 함께 저장되어야** 재확인·일일확인 때도 같은 카테고리로 돈다. 오늘 그 저장 자리가 없다(`product_snapshots`에 카테고리 컬럼 없음). 이게 "UI 한 줄"보다 큰 부분이다.

---

## 6. E — 골프용품: 지금 무엇이 없는가

전수 검색(`골프|golf`, 대소문자 무시, packages/ + apps/): **히트 1건 — `packages/category/src/profiles.ts:181` 주석 한 줄뿐이다.**

```
// P-13C-1(2026-08-31, 실측: … Misha & Puff는 성별/연령 신호
// 부재로 "여성 골프 원피스"까지 잘못 갔던 실제 사고 사례).
```
= 골프는 **과거 오분류 사고의 피해자**로만 등장한다. 지원 흔적이 아니다.

**없는 것 (4겹, 전부 다르다):**

| 층 | 상태 | 고치는 곳 |
|---|---|---|
| ① 어휘 (골프/드라이버/퍼터/아이언/캐디백/골프화…) | 없음 | `packages/category/src/product-resolver.ts:79` `PRODUCT_TYPE_KEYWORDS` |
| ② 카테고리 프로필 (GOLF / SPORTS_LEISURE) | 없음 | `packages/category/src/profiles.ts:47, 152` |
| ③ 시장조사 스코프 값 | 없음 | 위 프로필의 `marketSourceScopes` (DB 제약 없어 마이그레이션 불필요) |
| ④ **골프 소스 자체** | **실측 0개** | `domestic_price_sources` 행 — 조사 후 seed 필요 |

**기존에 기록된 결함과 같은 종류인가 — ①은 같고, ④는 더 나쁘다.**

기록된 결함(`packages/category/src/__tests__/category-profile.test.ts:186-190`):
> "PRODUCT_TYPE_KEYWORDS에 컵/머그 계열 어휘가 없다(cookware만 있다). 이건 구조 문제가 아니라 **어휘 공백**이라, 없는 네이버 leaf 이름을 지어내서 채우지 않는다. null이면 모든 보정과 필터가 꺼져 오늘 동작 그대로다."

- ①②③은 **정확히 같은 종류의 어휘/프로필 공백**이다. 그리고 `detectCategoryProfile`이 `null`을 돌려주므로 오늘은 **조용히 필터 없음 = 아동복 편집샵 16곳 전부 뒤짐**으로 끝난다.
- ④는 **다르고 더 위험하다.** 프로필만 추가하면 `sourceFitsScopes(["KIDS_FASHION"], ["GOLF"])` = `false`가 되어 **16곳 전부 탈락 → 조사 대상 0곳**이 된다. 049 주석(:73-79)이 이 실패 모드를 이미 예고해 뒀다("맞는 판매처가 아직 카탈로그에 없다 … 화면은 '⚪ 검색 데이터 없음'이라고 정직하게 말한다").

### 🔴 실측: 살아있는 DB의 카탈로그 (SELECT, 값 미출력 · 집계만)

```
domestic_price_sources  16행 (카탈로그 enabled 11)
  category_scope 분포 : KIDS_FASHION 16 · WOMEN_FASHION 4 · FASHION_ACCESSORIES 4 · KIDS_GOODS 2
  category_scope 빈 행: 0
  source              : SYSTEM 16 · USER 0
  collection_strategy : MANUAL 10 · AUTO_SCRAPE 5 · AUTO_API 1
comparison_shops        25행 (전부 is_active) — source: USER 19 · SYSTEM 6
workspace_domestic_shop_settings  30행 / 6 workspace
```

여기서 나오는 **세 가지 사실**:
1. **`HOME_LIFESTYLE` 스코프를 가진 소스가 0개다.** 049가 쿠팡에 붙이려던 값인데, **쿠팡 행이 테이블에 아예 없다**(도메인 `%coupang%` 0건 — 034 마이그레이션이 실행되지 않았거나 행이 지워졌다). 즉 **라이프스타일 상품은 오늘도 조사 대상 0곳이다.** 골프가 겪을 일을 이미 한 카테고리가 겪고 있다.
2. **16행 전부가 `KIDS_FASHION`을 갖고 있다.** 이 저장소는 여전히 아동 카탈로그다.
3. **`source='USER'` 국내 소스가 0개다** — 셀러 추가 경로가 실전에서 한 번도 안 쓰였다. §4.2의 전역 오염 버그가 아직 드러나지 않은 이유다.

---

## 7. 최소 변경 제안 (구현 금지 · 마이그레이션 필요/불필요 구분)

우선순위대로. 각 단계는 독립적으로 배포 가능하고, 앞 단계 없이 뒤 단계를 하면 화면이 비어 보인다.

### 🥇 0단계 — 마이그레이션 **불필요**, 코드도 **불필요**. 카탈로그 조사.
**골프·라이프스타일 소스를 실제로 열어 보고 카탈로그에 넣는다.**
이게 없으면 아래 전부가 "필터는 잘 도는데 결과가 0곳"으로 끝난다. 029~035가 지켜 온 규칙(조사 없이 넣지 않는다)을 바꾸자는 게 아니라, **그 조사를 이번에 하자는 것이다.**
- 부수적으로: 034(쿠팡)가 왜 미적용인지 확인 — HOME_LIFESTYLE 0개의 직접 원인.

### 🥈 1단계 — 마이그레이션 **불필요** (코드만). 골프 카테고리.
- `PRODUCT_TYPE_KEYWORDS`에 골프 어휘 추가 (`product-resolver.ts:79`)
- `CATEGORY_PROFILES`에 프로필 1개 추가 (`profiles.ts:152`) — `marketSourceScopes: ["GOLF"]` 등
- **DB 변경 0.** `category_scope text[]`에 CHECK가 없으므로 새 문자열은 그냥 들어간다.
- 새 소스의 `category_scope`에 값을 넣는 것은 0단계의 seed SQL에서 함께.
- ⚠️ `naverNoticeType` 도 정해야 한다 — 골프용품은 KIDS/WEAR 어느 쪽도 아닐 가능성이 크고, 그러면 `isNaverNoticeTypeSupported()`가 false가 되어 **스마트스토어 등록이 "아직 지원 안 함"으로 정직하게 막힌다.** 이건 버그가 아니라 사실이다(FASHION_ACCESSORIES·HOME_LIFESTYLE도 오늘 false).

### 🥉 2단계 — 마이그레이션 **1개**. 해외에 카테고리 적합도.
```
comparison_shops 에 category_scope text[] not null default '{}' 추가
```
- 기존 25행은 기본값 `{}` → `sourceFitsScopes`가 전부 통과시킨다 = **오늘 동작 그대로.** 회귀 불가능.
- 코드는 `apps/admin/src/app/api/comparison/search/route.ts:54` **한 줄**에 `sourceFitsScopes` 필터를 더하는 것뿐. 국내와 **같은 함수**를 쓴다(판정을 두 번 구현하지 않는다).
- **새 테이블 만들지 않는다.** 029가 국내/해외 분리를 결정한 이유(통화·목적)는 그대로 유효하고, 국내 쪽이 이미 `text[]` 비정규화로 잘 돌고 있으므로 조인 테이블(`CategoryMarketSource`)을 새로 팔 근거가 없다.

### 3단계 — 마이그레이션 **1개**. 셀러별 "추가".
```
domestic_price_sources 에 workspace_id uuid null references workspaces(id) 추가
  null     = 공용 카탈로그 (오늘의 16행 전부)
  non-null = 그 셀러만 보는 추가분
domain unique → (coalesce(workspace_id,'0…0'), domain) 부분/복합 unique 로 교체
```
- `listDomesticPriceSources(workspaceId)`에 `.or(workspace_id.is.null,workspace_id.eq.${workspaceId})` 한 줄. **합치는 자리가 이미 한 곳(:126-138)이라 여기만 고치면 된다.**
- `createDomesticPriceSource()`에 `workspace_id` 전달 (`:241-252`).
- `price_observations.source_ref_id` · `domestic_product_links.source_id` FK **안 건드린다** — 047이 새 카탈로그 테이블을 거부한 바로 그 이유를 그대로 지킨다.
- **`SellerMarketSource` 새 테이블은 만들지 않는다.** on/off는 이미 `workspace_domestic_shop_settings`가 하고, 추가는 소유자 컬럼 하나로 끝난다.
- 해외도 같은 게 필요하면 `comparison_shops.workspace_id`로 대칭 처리(별도 판단).

### 4단계 — 마이그레이션 **판단 필요**. 상품검색 화면의 카테고리 선택.
- UI + payload는 작다: `page.tsx:877-893` + `:451`.
- 🔴 **그러나 저장 자리가 없다.** 셀러가 고른 카테고리를 `product_snapshots`에 남기지 않으면 일일 확인·재확인이 **다시 자동 추론으로 돌아가** 첫 조사와 다른 사이트를 뒤진다. 컬럼 1개(`market_category_scope text[]` 또는 `category_profile_id text`)가 필요할 가능성이 높다.
- 🔴 **그리고 기록된 CEO 지시와 충돌한다** (`profiles.ts:290-294`, §2.4). 선택 UI를 **① 자동 추론 결과 표시 + [카테고리 변경] 오버라이드** 로 만들면 두 지시를 모두 만족한다 — 원래 설계가 예고했으나 만들지 않은 바로 그 버튼이다. 이 형태를 권한다.

### "카테고리 기본 + 셀러 추가, 중복 제거"를 계산하는 자리 — 이미 있다
- `listDomesticPriceSources()` `domestic-price-source.ts:123-139` — 카탈로그 × 셀러 설정 병합
- `run-domestic-price-check.ts:330-332` / `search/route.ts:178-180` — 카테고리 적합도 필터
- 중복 제거는 **테이블 레벨**에서 끝난다 (`domain` unique, `(workspace_id, source_id)` PK). 오늘은 "기본"과 "추가"가 같은 카탈로그에 살아서 합집합 연산 자체가 없다. 3단계를 하면 `.or()` 한 줄이 그 합집합이 된다.

### "이 상품을 어디까지 비교했는가" — 절반만 있다
| 있는 것 | 위치 |
|---|---|
| 소스별 마지막 시도/성공/오류 (상품 무관, **소스 단위**) | `domestic_price_sources.last_checked_at / last_success_at / last_error_code` · `recordDomesticSourceCheckAttempt()` `domestic-price-source.ts:329-350` |
| 이번 검색에서 각 소스가 왜 결과가 없었나 (**응답 1회용, 비영속**) | `apps/admin/src/lib/search-source-status.ts:52-62` `deriveSearchSourceStatus()` — AUTO_SUPPORTED / MANUAL_REQUIRED / SEARCH_FAILED / NO_RESULT / UNKNOWN |
| 관측 결과 (찾은 것만) | `price_observations` (+ `source_ref_id` 029, `market_code`/`market_country` 046) |
| 동일상품 링크 (연결된 것만) | `domestic_product_links` |

**없는 것:** "이 스냅샷에 대해 **어느 소스 집합을 대상으로 삼았는가**"의 영속 기록. 결과가 0건인 소스는 아무 흔적도 남기지 않는다(`run-domestic-price-check.ts:397` `NO_RESULT`는 상품이 아니라 **소스 행**에 덮어쓴다). 그래서 나중에 "그때 골프샵을 뒤졌는데 없었나, 아예 안 뒤졌나"를 구분할 수 없다.
→ 2·3단계로 대상 집합이 상품마다 달라지기 시작하면 **이 구분이 반드시 필요해진다.** `search-source-status.ts`의 5값 분류를 그대로 영속화하는 것이 새 어휘를 만들지 않는 길이다. (설계는 이번 범위 밖.)

---

## 8. 확인하지 못한 것

1. **034(쿠팡) 마이그레이션이 왜 미적용인지.** 파일은 있고 DB에 행이 없다. 의도적 제거인지 미실행인지 모른다. `HOME_LIFESTYLE` 0개의 직접 원인이라 확인이 필요하다.
2. **골프 사이트 실조사 결과가 이 저장소에 하나도 없다.** robots.txt·검색경로를 확인한 기록이 없으므로 "어느 사이트를 넣어야 하는가"에 답할 수 없다.
3. **`apps/admin`이 셀러용인지 운영자용인지.** 앱이 하나뿐이고 `requireUser()`만 쓴다 — 운영자 전용 경로와 셀러 경로가 코드상 구분되지 않는다. §4.2의 "셀러가 전역 카탈로그에 쓴다"가 의도인지 사고인지 판단할 근거가 부족하다.
4. **LotteON 채널 카테고리 표의 실체.** 서브에이전트가 `platform-categories/elevenst.categories.ts`가 LotteON에 쓰인다고 보고했으나 직접 확인하지 않았다. 시장조사 카테고리와는 무관해서 이번 결론에 영향 없다.
5. **`/api/pipeline` 라우트 내부.** URL 제출 후 첫 처리를 직접 읽지 않았다. 4단계에서 `categoryScope`를 실어 나를 때 반드시 먼저 읽어야 한다.
6. **다른 5개 workspace의 실제 사용 여부.** `workspace_domestic_shop_settings`가 6 workspace/30행인데, 이 중 몇이 실사용자인지 확인하지 않았다(값 출력 금지 범위). 047 주석이 전제한 "실사용자 1명"이 아직 유효한지는 §4.2 버그의 긴급도를 좌우한다.
