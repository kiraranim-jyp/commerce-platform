# WU-019G — Category / Sourcing 전수 추적 · **UNKNOWN 0** (조사만 · 코드 0)

🔴 UI 수정 0 · API 0 · DB 0 · Registry 0 · extractor 0 · 분석로직 0 · MI 0 ·
Search 재실험 0 · **HTTP 0** · Production write 0 · AI 0 · Gemini 0 · 비용 ₩0 · 배포 0.

🟢 범위 — WU-019E 가 남긴 UNKNOWN **전부**(등록 · 가격 · 상단 Flow · 상품정보 ·
분석 시작 · 저장/재분석 · 구매/소싱)를 한 덩어리로 닫는다.

---

## ⓪ 🔴🔴 먼저 — **WU-019E / 019F 의 전제 하나를 정정한다**

```
019E 표    Category | 🟢 사용(자동 파생) | … | **KEEP(값은 «자동 파생»)**
019F       「categoryScopes 는 상품 + workspace 프로필에서 파생된다」를 그대로 승계

🔴 **틀렸다.** `marketCategoryProfileId` 는 **셀러가 분석을 시작할 때마다 고르는
   필수 입력값** 이다. 자동 파생이 아니다.
```

🟢 실측 근거:

```
pipeline/page.tsx:1019-1024   <span>시장조사 카테고리 <span className="text-error">*</span></span>
                             <select value={marketCategoryId} onChange={…} aria-label="시장조사 카테고리">
pipeline/page.tsx:529-532     if (!marketCategoryId) { setError("시장조사 카테고리를 먼저
                             선택해 주세요."); return; }
pipeline/page.tsx:43          useState<CategoryProfileId|"">("")   ← 기본값은 «빈 문자열»
settings/page.tsx             `marketCategoryProfileId` **0건** — workspace 설정 화면에 없다
```

🔴 **왜 019E 가 틀렸는가 — 한 단계 뒤를 봤다.** `resolveMarketCategoryScopes`
(`category-scope.ts:97-102`)는 **`selectedMarketSourceScopes(선택값) ?? 상품에서 자동 추정`**
이다. 019E 는 **`??` 의 오른쪽**(폴백)만 보고 「자동 파생」이라 적었다. 🟢 실제 구조는
**「셀러 선택이 우선(override)이고, 선택이 없을 때만 자동 추정」** 이다.

🔴 **이 정정이 최종 판정을 바꾼다** — 「자동 파생이니 사용자-facing Category 를
지워도 된다」는 **성립하지 않는다**. 지우면 폴백(자동 추정)으로 떨어지는 **동작 변경**이다.

---

## ① 전체 UNKNOWN 목록과 그 해소

| # | 019E UNKNOWN | 019G 판정 | 핵심 근거 |
|---|---|---|---|
| 1 | 등록 — LotteON/SmartStore 게이트 | 🟢 **확정** | 아래 ③ |
| 2 | 가격 — Category/Sourcing 의존 | 🟢 **확정** | 아래 ④ |
| 3 | 상단 Flow — UI 연결 | 🟢 **확정** — 입력 컨트롤 **0개** | 아래 ⑤ |
| 4 | 상품정보 — UI 연결 | 🟢 **확정** — Sourcing 있음 · Category 없음 | 아래 ⑤ |
| 5 | 분석 시작 — URL-only | 🟢 **확정** — 서버 GO · UI BLOCKED | 아래 ⑦ |
| 6 | 저장/재분석 — 선택값 재사용 | 🟢 **확정** | 아래 ⑧ |
| 7 | 구매/소싱 — 네 갈래 중 어디 | 🟢 **확정** — (a) 분석 전용 | 아래 ⑥ |

🟢 **UNKNOWN = 0.** 🔴 단 ⑨에 **「조사로 닫을 수 없는 것」 2건**을 분리해 적는다 —
그 둘은 UNKNOWN 이 아니라 **범위 밖(런타임 실행 금지 · 커밋 이력)** 이다.

---

## ② 네 축은 끝까지 분리해서 본다

```
축1  marketCategoryProfileId → categoryScopes      «어느 샵을 뒤질지» (셀러 선택 · 필수)
축2  products.selected_sourcing_candidate_id       «어디서 사올지»   (셀러 선택 · 선택)
축3  domestic_price_sources / comparison_shops     «내부 Registry»
축4  listing.category / displayCategoryCode        «채널 카테고리»   (등록 필수)
🔴 축1↔축4 는 이름만 겹친다. 축2↔축3 도 이름만 겹친다. 코드가 그것을 명시한다 —
   page.tsx:1012-1015 「두 카테고리는 코드에서 이미 완전히 갈라져 있고, 이 값은 등록
   추천 경로에 한 번도 전달되지 않는다」
🔴 실제로 걸릴 뻔한 자리: coupang/register/route.ts:549 `const selectedCandidate =
   listing.category.candidate` — 이름이 「selectedCandidate」지만 **축4** 다.
```

---

## ③ 등록 — 🟢 축1·축2 **미사용** / 축4 **3채널 전부 required**

### 서버측 게이트 전수 (요약 — 전부 파일:줄 확인)

```
Coupang   11개   route.ts:326(권한) 356(자격증명) 457(seller settings) 479(배송 프로필)
                 **:165 displayCategoryCode == null → missing** · :681(compliance FAIL)
                 :735(가격 제약) :832(RECREATE 동의) :864(NOOP/BLOCKED) :897(중복 CREATE)
LotteON    7개   route.ts:148 157 183 **:205 validateLotteOnPayload** :255(연결 존재)
                 :282(중복) :352(returnOk)
                 ↳ validate-payload.ts **:124-141 scatNo + dcatLst 둘 다 CATEGORY_REQUIRED**
                   (+ 거래처 :114 · 판매가 :159 · 원산지 :166 · 과세 :181 · 고시 :197 ·
                    안전인증 :260 · 이미지 :320 · 상세 :337 · 출고/반품지 :352 · 재고 :400)
SmartStore 15개  route.ts:274 291 310 **:338-357 leafCategoryId == null → FAILED**
                 :400 :412 :462(판매 전 최종 확인) :529(이미지 업로드)
                 **:588 validateNaverPayload** :680 :708 :754(UPDATE 보존) :984 :1026 :1070
```

### 🟢 축1·축2 — **0건이고, 「객체엔 실리는데 안 읽는다」는 중간 상태조차 없다**

```
이름 grep   categoryScope · marketCategoryProfileId · selected_sourcing_candidate_id ·
            selectedCandidateId
  coupang/register · lotteon/register(+_lib) · smartstore/register → **각 0건**
  packages/listing/src · packages/marketplace/src                   → **0건**

🟢 그리고 **데이터 흐름으로도 닫힌다** — 세 라우트는 `product`/`listing` 을 **서버에서
   DB select 하지 않는다**. 클라이언트 POST body 에서 그대로 꺼낸다:
     coupang route.ts:299 · smartstore route.ts:248 · lotteon route.ts:124-136
   → `select("*")` 로 products 를 읽어 축2 가 객체에 딸려 들어올 **경로 자체가 없다.**
```

→ **등록 / 축1 = ⚪ 미사용 · 등록 / 축2 = ⚪ 미사용** (둘 다 확정)

### 🟡 축4 — 3채널 전부 required · owner 는 화면 확정값

| 채널 | required 칸 | owner 경로 |
|---|---|---|
| Coupang | `displayCategoryCode` | `listing.category.candidate`(:549) → `resolveVerifiedCategoryCode`(:541) → `buildCoupangPayload`(:618) |
| LotteON | `scatNo` **+** `dcatLst` (**2중**) | `LotteOnChannelFormInput.standardCategoryNo`/`displayCategoryNos` → `build-context.ts:319-324` → `buildLotteOnPayload` |
| SmartStore | `leafCategoryId` | `listing.category.candidate` → `isVerifiedCategorySelected`(:338-340) → `buildNaverProductPayload`(:582) |

---

## ④ 가격 — 🔴 **「미사용」으로 적으면 틀린다.** 정확한 문장은 셋이다

### 🟢 ④-1 축2(`selected_sourcing_candidate_id`) = **완전 미사용** (확정)

```
packages/pricing/src 전체 · api/price-history 전체 → sourcing 계열 **0건**
원가(costBasis) 선택은 `selectCostBasisOriginObservations`(price-observations.ts:303)이고
  보는 것은 `price_observations.source_label`(ORIGIN_FX / KR_MARKET) 뿐이다
원가 입력은 `backfillCanonicalProduct(snapshot.workspace.canonicalProduct)`
  (check/route.ts:38-44) — 스냅샷의 원상품이지 셀러가 고른 매입처가 아니다
sellability.ts · seller-action.ts · representative-seller-decision.ts → **0건**
🟢 설계 의도가 SQL 에 적혀 있다 — 075_sourcing_candidates.sql:22-28
   「🔴 MI 결과를 넣지 «않는다» … 마진·radar·최종판정 칸이 이 표에 없다. 의도다」
```

### 🔴 ④-2 축1(`categoryScopes`) = **가격 숫자에 안 들어간다. Discovery 선택 전용**

```
run-domestic-price-check.ts:107  DomesticPriceCheckInput.categoryScopes (선택 인자)
  → :528-538 isBatchSurveyTarget() → sourceFitsScopes(source.categoryScope, categoryScopes)
  → :777      allSources = registrySources.filter(...)
  → :897-898  collectGeminiCandidatePool({ scopedDomains, categoryScopes })  «선호 도메인»
🟢 category-scope.ts:88-90 이 스스로 못박는다 —
   「'조사 대상 사이트'를 정하는 값은 categoryScopes 하나뿐이고, 그 값이 실제로 쓰이는
    자리는 sourceFitsScopes 두 줄이다」
```

### 🔴🔴 ④-3 **같은 원천값이 «다른 이름» 으로 가격 계산 인자에 들어간다** — 그러나 숫자 영향 0

```
market-intelligence.ts:510  const marketCategoryProfileId = snapshot.workspace.marketCategoryProfileId
                      :511  resolveCategoryCostPolicy(marketCategoryProfileId)
                      :541  resolveBuyerImportCharge({ categoryProfileId, … })
                      :553  computeUnifiedPriceDecision({ categoryProfileId, … })
unified-price-decision.ts:247 resolveCategoryCostPolicy(input.categoryProfileId)
                      :375-383 costPolicy 는 **표시 블록**(id/label/landedCostTaxBasis/note)
                      :241-244 실제 landedCostValue 는 LANDED_COST_PARTS 고정 2항목
                               (:236-239 「이 배열은 카테고리별로 갈리지 않는다」)

🔴 그래서 「가격은 카테고리를 안 쓴다」는 **거짓** 이다 — 호출은 실재한다.
🟢 그러나 **우리 두 카테고리에서는 숫자가 한 원도 안 갈린다**:
   category-cost-policy.ts:232-256
     DEFAULT · KIDS_FASHION · WOMEN_FASHION · FASHION_ACCESSORIES ·
     HOME_LIFESTYLE · TENNIS …  → **전부 `...UNCLASSIFIED_ITEM` 스프레드(동일값)**
     UNCLASSIFIED_ITEM(:222-225) = customsDutyRate **null** · weightBasedShipping **false** ·
                                   volumetricDivisor **null**
   :273-279  GOLF 만 다르다 — weightBasedShipping **true** · volumetricDivisor · customsDutyRate 있음
🔴🔴 그리고 그 GOLF 분기를 쓰는 `computeGolfLandedCost`(golf-landed-cost.ts:119)는
   **운영 호출부가 0건** 이다(전수 grep: 정의 1 · index 재export 1 · 테스트 N — 운영 0).
```

→ **가격 / 축1 = 🟡 「연결돼 있으나 KIDS·TENNIS 에서 숫자 영향 0」** (미사용이라 적지 않는다)
→ **가격 / 축2 = ⚪ 미사용 (확정)** · **가격 / 축4 = ⚪ 미사용** (price-hierarchy.ts 전체 0건)

### 🟢 ④-4 가격 저장 3테이블에 축1·축2 칼럼 **없음**

```
price_observations(027/031/038/040/046/054) · domestic_product_links(029/030/055/056) ·
price_alerts(039)  → `category_scope` · `selected_sourcing_candidate_id` **0**
  🔴 price_alerts.category 는 알림 종류(PRICE_GAP|OPPORTUNITY|ORIGIN_TREND)다 — 축1 아니다
축1 칼럼은 `domestic_price_sources.category_scope`(029:20) **한 곳**
축2 칼럼은 `products.selected_sourcing_candidate_id`(075:122) **한 곳**
```

---

## ⑤ 상단 Flow · 상품정보 — 🟢 두 영역 동시 확정

### 상단 Flow = `WorkflowPanel` — **입력 컨트롤 0개**

```
마운트  CommerceWorkspace.tsx:3523
정의    WorkflowPanel.tsx:18 머리주석 「화면 맨 위의 **유일한** 진행 표시」
5단계   workflow.ts:73-77  상품 수집 / 시장 판단 / 소싱 선택 / 등록 준비 / 커머스 등록
🟢 `category` 문자열 **0건** · 클릭 가능한 것은 onNavigate(탭 전환)·onOpenStageDetail 뿐
   (CommerceWorkspace.tsx:3534-3539)
→ **상단 Flow / Category = 입력 없음 · Sourcing = 입력 없음**(단계 표시만)
```

### 상품정보 영역 = `WorkSurface.PRODUCT`(stage-focus.ts:32)

```
🟢 Sourcing 입력 **있다** — SourcingPanel 이 여기 마운트된다(CommerceWorkspace.tsx:3724)
🔴 Category 입력 **없다** — 그리고 **의도적 제외** 다:
   stage-focus.ts:106-107 「카테고리는 정반대라서 상품 수준 체크리스트에서 아예 빠졌다」
   테스트가 잠갔다 — three-layer-realign.test.ts:27(상품정보 입력 요소 0개)
   page.tsx:1002-1003 「카테고리 변경 오버라이드 버튼도 의도적으로 안 만든다」
```

### 🔴 발견 — **축1 소비에 비대칭이 있다**(결함 후보 · 고치지 않았다)

```
셀러가 Hero 에서 고른 marketCategoryProfileId 가 가는 곳 / 안 가는 곳
🟢 간다  ComparisonShopSearch(해외)   CommerceWorkspace.tsx:3830 → :356 →
         comparison/search/route.ts:84  selectedMarketSourceScopes(body.…) ?? 자동추정
🟢 간다  일일/지금 확인               price-history/check/route.ts:62 resolveMarketCategoryScopes
🔴 **안 간다**  DomesticShopSearch(국내 실시간)  CommerceWorkspace.tsx:3808 — prop **0건**
         domestic-price-sources/search/route.ts:102-131 body 에 그 필드가 **없고**
         `resolveCategoryScopes`(자동 추정 전용, category-scope.ts:51)만 쓴다
🔴 즉 **같은 화면의 국내/해외 두 구역이 서로 다른 스코프로 돈다.**
🔴 이것을 결함으로 «단정하지 않는다» — 의도된 분리일 수 있다(국내는 상품에서 추정하는 것이
   맞다는 판단). 🔴 그러나 **어느 쪽이 의도인지 코드가 말하지 않는다** → CPO 판정 사안.
```

---

## ⑥ Sourcing 최종 — 🟢 **(a) 분석 전용** · (b)구매 **0** · (c)등록 **0** · (d)해당없음

### 스키마 (075 / 076 / 077 실측)

```
sourcing_candidates : id · product_id(FK CASCADE) · originating_snapshot_id ·
  workspace_id · **source_url · source_site · source_country** ·
  **price_amount · currency**(원가 근거 · 판매가 아님 075:68-70) ·
  **availability**(IN_STOCK|OUT_OF_STOCK|INVALID|UNKNOWN) · shipping_note ·
  identity_match_truth · observed_at · created_at · updated_at ·
  **source_kind**(077:38 DISCOVERED|SELLER_ENTERED)
  UNIQUE(product_id, source_url) 075:109
🟢 MI 판단값(마진·CASE·최종판정)은 **일부러 없다** — 075:22-28
products.selected_sourcing_candidate_id : 076:78-82 에서 **복합 FK** 로 강화
  (id, selected_sourcing_candidate_id) → (product_id, id) — 남의 후보 선택을 DB 가 막는다
```

### 소비자 전수 — 네 갈래 분류

```
(a) 분석/관리  14 파일 — 정책 3(sourcing-candidate-policy · selected-source-policy ·
      master-ready) · store 2 · route 3 · UI 2(SourcingPanel · workflow.ts) · 상위 2
(b) **구매/매입  0** — 🔴 이 리포에 발주·주문·구매실행 기능이 **없다**
      확인법: register 3채널 + packages/listing + packages/marketplace 전수 grep 0 ·
      「발주/구매대행/purchase order」 grep → buyer-import-charge 의 **통관방식 상수**만
      걸리고 sourcing 테이블과 연결 0
(c) **등록      0** — ③에서 확정
(d) 해당 없음 — 저장만 되고 안 읽히는 칸은 없다
🟢 `sourcing_candidates` INSERT 는 리포 전체에서 **route.ts:148 한 곳** 이다
```

### 🔴 후보를 만드는 경로는 **셀러 수동 입력 하나**

```
수동  SourcingPanel.tsx:392-407 「+ 소싱처 직접 추가」 → POST · sourceKind "SELLER_ENTERED" 고정
자동  `DISCOVERED` 는 타입·CHECK·정책에 **정의는 있으나**(077:38 · policy:21,84,128-135)
      그것을 세팅해 INSERT 하는 **운영 코드가 0건** 이다
      (snapshots · price-history · pipeline API 디렉터리에 sourcing_candidates 참조 0)
🔴 즉 「가격조사 결과가 자동으로 소싱 후보가 된다」는 **아직 구현되지 않았다.**
```

→ **Sourcing ① 최종 = (a) 분석에만 쓰인다 → REMOVE 후보** (🔴 단 ⑧의 교환을 먼저 본다)

---

## ⑦ URL-only 분석 — 🟢 **서버는 GO · UI 는 BLOCKED**

```
URL → 상품분석 → Discovery → 후보분석 → MI → 가격 → 저장
```

### 입구와 필수값

```
POST /api/pipeline    route.ts:122-125  `const { url } = …; if (!url) 400`
                      → 🔴 **필수는 url 하나.**
  🔴🔴 그리고 **클라이언트가 카테고리를 보내지도 않는다** —
      page.tsx:557-561  body: JSON.stringify({ url })
      즉 `/api/pipeline` 서버는 카테고리를 **아예 모른다.**
  🟢 막는 것은 UI 다 — page.tsx:529-532(값 없으면 setError 후 return)
POST /api/snapshots   route.ts:50-52  필수 `sourceUrl` + `workspace`
                      `workspace.marketCategoryProfileId` 는 **optional**(types.ts:80)
```

### 축1 없이 통과하는가 — 🟢 **통과한다. 「0개」가 아니라 「전체 통과」다**

```
packages/category/src/profiles.ts:502-506
  export function sourceFitsScopes(sourceCategoryScope, profileScopes) {
    if (!profileScopes || profileScopes.length === 0) return true;   ← 스코프 없으면 전부 통과
    if (sourceCategoryScope.length === 0) return true;
    return sourceCategoryScope.some((scope) => profileScopes.includes(scope));
  }
폴백 사슬  selectedMarketSourceScopes(선택값) → 없으면 null(profiles.ts:389-393)
           → resolveCategoryScopesFromProduct(자동 추정) → 신호 없으면 null(:468)
           → categoryScopes = null → **필터 없음**
🔴 그래도 다른 축은 여전히 건다 — enabled · status ACTIVE · isCollectableAccess
   (run-domestic-price-check.ts:528-538)
```

### 축2 없이 통과하는가 — 🟢 **완전히 통과한다**

```
분석 · 저장 · Discovery · MI · 가격 어디에도 소싱 선택을 읽는 코드가 없다
selected-source/route.ts:34-39 「재분석(snapshot 추가)을 **보지 않는다** — 선택은 Product 의 칸이다」
축2 가 없으면 바뀌는 것은 화면의 `masterReady.stage` 뿐이다(DISCOVERED / SOURCING_READY)
```

### 🔴 `readyForCommerce` 가 실제로 막는 것 = **없다. 문구만 바뀐다**

```
SourcingPanel.tsx:315-321   <p> … readyForCommerce ? "판매 상품으로 준비되었습니다."
                                 : (nextAction ?? "등록에 필요한 항목이 남아 있습니다.")
🔴 어떤 버튼의 `disabled` 에도 연결돼 있지 않다. 소비처는 이 `<p>` **하나** 다.
🔴 그리고 SourcingPanel 안에는 등록을 호출하는 버튼 자체가 없다.
```

→ **URL-only Analysis = 🟢 GO (서버 계약 기준) · 🔴 현재 UI 는 BLOCKED (의도된 가드)**

---

## ⑧ 저장 / 재분석 — 선택값 재사용

| 트리거 | 축1 (`marketCategoryProfileId`) | 축2 (`selected_…_id`) |
|---|---|---|
| 저장 위치 | `product_snapshots.workspace`(jsonb) — 전용 칼럼 **없음**(snapshot.ts:281-287) | `products` **칼럼**(schema.prisma:45) |
| 같이 저장되는가 | 🔴 **아니다** — `/api/snapshots` POST 는 축2 를 쓰지 않는다(snapshot.ts:219-260) | PUT `/selected-source` 로만 쓰인다(:167) |
| 「상품 분석 →」 재클릭 | UI state 는 남지만 **서버로 안 간다**(:557-561) → 재사용이 아니라 무관 | 영향 없음 |
| 「새 상품 분석」 | 🟢 **초기화** `setMarketCategoryId("")`(page.tsx:668-671 — 「이전 상품의 카테고리를 그대로 물려주면 안 된다」) | 🔴 **사실상 리셋** — 아래 |
| 스냅샷 재오픈 | 🟢 저장값 복원(page.tsx:256 · 281) | 유지 |
| 「지금 확인」 | 🟢 저장값 재사용(check/route.ts:62) · null 이면 자동 추정 폴백 | 영향 없음 |

🔴🔴 **비대칭 하나** — `createProductIdentity`(snapshot.ts:324-327)가 「sourceUrl 로 기존
Product 를 찾지 않는다 … 항상 새로 발급한다」이므로, **같은 URL 이라도 「새 상품 분석」을
하면 새 Product 가 생겨 이전 축2 선택과 연결이 끊긴다**(새 Product 는 당연히 null).

---

## ⑨ 🔴 조사로 닫을 수 없는 것 2건 (UNKNOWN 이 아니라 **범위 밖**)

```
① 소싱 미선택 상태에서 register API 가 실제로 통과하는가 — **런타임 미실행**
   🟢 정적으로는 확정됐다(축2 참조 0건 · readyForCommerce 가 버튼을 막지 않는다).
   🔴 「통과한다」를 실행 증거로 쓰려면 Production write 가 필요하고 §9 가 금지했다.
② `DISCOVERED` 자동 생성이 «구현 예정» 인지 «폐기된 계획» 인지 — 커밋/PR 이력 미열람
   🟢 코드 사실은 확정이다 — 운영 INSERT 0건.
```

---

## ⑩ 내부 Registry 영향 — 🟢 **없다**

```
축3(domestic_price_sources · comparison_shops)는 축1·축2 와 독립이다.
  축1 은 `domestic_price_sources.category_scope` 로 **필터만** 한다(029:20 · sourceFitsScopes)
  축2 는 Registry 를 **한 번도 참조하지 않는다**(products 칼럼 · 075)
🔴 사용자-facing Sourcing 을 지워도 Registry 는 그대로다. 반대도 참이다.
🔴 사용자-facing Category 를 지우면 **Registry 는 안 바뀌고 «필터가 사라진다»** —
   전체 샵을 뒤지게 된다(profiles.ts:502-506). 그것은 Registry 변경이 아니라 **동작 변경** 이다.
```

---

## ⑪ 제거 구현 시 영향 파일군 (목록만 — 구현 0)

### 축2(사용자-facing Sourcing) 제거 시 — **16 파일 + 테스트 8**

```
packages/database/prisma/schema.prisma                                (Product/SourcingCandidate)
packages/database/prisma/migrations_manual/{075,076,077}_*.sql        (각 파일에 원복 SQL 이 이미 있다)
apps/admin/src/lib/{master-ready, selected-source-policy, sourcing-candidate-policy}.ts
apps/admin/src/app/api/products/_lib/{selected-source-store, sourcing-candidate-store}.ts
apps/admin/src/app/api/products/[productId]/selected-source/route.ts
apps/admin/src/app/api/products/[productId]/sourcing-candidates/route.ts
apps/admin/src/app/api/products/[productId]/sourcing-candidates/[candidateId]/route.ts
apps/admin/src/app/pipeline/commerce/SourcingPanel.tsx
apps/admin/src/app/pipeline/commerce/workflow.ts   (SourcingSignal · buildSourceSelecting · target:"sourcing")
apps/admin/src/app/pipeline/{CommerceWorkspace.tsx, page.tsx}
테스트 8 — pivot03a/03b×2/03c×2 · p0channel03-sprintA · master-ready · sourcing-candidate-policy
🟢 **영향 없음**: register 3채널 · packages/listing · packages/marketplace (전수 0건)
🔴 workflow.ts 의 **5단계 중 ③「소싱 선택」이 통째로 사라진다** — 상단 Flow 문구 변경이 따라온다
```

### 축1(사용자-facing Category) 제거 시

```
apps/admin/src/app/pipeline/page.tsx  (select · 가드 :529-532 · 초기화 :668-671 · 복원 :256/281)
apps/admin/src/app/pipeline/CommerceWorkspace.tsx:3830 (ComparisonShopSearch prop)
apps/admin/src/app/pipeline/commerce/ComparisonShopSearch.tsx:356
apps/admin/src/app/api/comparison/search/route.ts:84   (선택값 우선 → 자동추정 단독으로)
apps/admin/src/app/api/snapshots/_lib/types.ts:80      (workspace.marketCategoryProfileId)
apps/admin/src/app/api/price-history/check/route.ts:62 · trigger-domestic-price-check.ts:76
apps/admin/src/app/api/price-history/_lib/market-intelligence.ts:510-553 (costPolicy 입력)
🔴 **동작 변경이 따라온다** — 선택이 사라지면 `??` 폴백(자동 추정)이 단독이 되고,
   추정이 null 이면 **필터 없이 전체 샵을 뒤진다**. 비용·정확도 교환이다.
```

---

## ⑫ 🔴🔴 최종 의사결정

```
User-facing Category  = 🟡 **SPLIT**
User-facing Sourcing  = 🟡 **SPLIT**   (REMOVE 아님 — 근거는 아래)

Internal Category Scope  = 🟢 **KEEP** (변경 불필요)
Internal Source Registry = 🟢 **KEEP** (변경 불필요)

URL-only Analysis = 🟢 **GO** (서버 계약) / 🔴 **현재 UI 는 BLOCKED** (의도된 가드)
```

### 왜 Category 가 REMOVE 가 아닌가

```
🔴 019E 의 전제(「자동 파생이다」)가 반증됐다 — 셀러 필수 선택이다(⓪).
🟢 지워도 사슬은 안 끊긴다(sourceFitsScopes 가 전체 통과).
🔴 그러나 **지우면 Discovery 범위가 넓어진다** — 「아무 데도 안 뒤진」이 아니라
   「전부 뒤진다」로 바뀐다. page.tsx:526-539 주석이 그것을 **이미 위험으로 적어 뒀다**
   (「어느 사이트를 뒤졌는지 나중에 설명할 수 없는 결과를 남긴다」).
→ **SPLIT** = 「선택 UI 는 없앨 수 있다. 단 그러려면 자동 추정의 품질과
   추정 실패(null) 시의 기본 동작을 먼저 정해야 한다.」 그것이 제품 정책이다.
```

### 왜 Sourcing 이 REMOVE 가 아닌가

```
🟢 (a) 분석 전용이고 (b)(c) 가 0 이므로 **기술적으로는 REMOVE 가능** 하다.
🔴 그러나 지우면 **상단 Flow 5단계 중 ③이 사라진다** — 「무엇을 어디서 얼마에
   사올 것인가」를 기록하는 **유일한 칸** 이 없어진다(075 가 그 목적으로 만든 표다).
🔴 그리고 `DISCOVERED` 자동 생성이 **설계만 되고 미구현** 이다(⑥) — 즉 이 기능은
   「쓸모없다」가 아니라 **「절반만 지어졌다」** 에 가깝다.
→ **SPLIT** = 「사용자-facing 선택 UI 를 지금 유지/제거할지」와 「구매·매입 축을
   만들 것인지」는 **다른 결정** 이다. 전자는 UI, 후자는 제품 범위다. CPO 결정.
```

### 🔴 WU-019F 「구현」으로 바로 넘어갈 수 있는가 — **아니다**

```
🔴 제거 구현의 선행 결정이 **둘 남았고 둘 다 CTO 범위 밖** 이다:
  ① 자동 추정이 null 일 때 Discovery 기본 동작(전체 탐색 vs 중단) — 비용·정확도 교환
  ② 「어디서 사올 것인가」를 제품이 계속 기록할 것인가 — 범위 결정
🟡 선행 결정 없이 지금 할 수 있는 것은 **하나** 다(그리고 제거가 아니다):
   ⑤의 **국내/해외 스코프 비대칭** — 같은 화면의 두 구역이 다른 스코프로 돈다.
   🔴 이것도 「의도인가 결함인가」를 CPO 가 먼저 갈라야 한다.
```

---

## ⑬ 변경 없음 확인

```
운영 코드 0 · UI 0 · API 0 · DB 0 · schema 0 · Registry 0 · extractor 0 ·
분석 로직 0 · MI 0 · threshold 0 · Search 재실험 0 · HTTP 0 · Production write 0 ·
AI 0 · Gemini 0 · 비용 ₩0 · 배포 0 · 산출물은 이 문서 **1파일**
```
