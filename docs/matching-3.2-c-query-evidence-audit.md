# MATCHING-3.2-C · QUERY EVIDENCE PROMOTION REGRESSION (READ ONLY)

- 지시: CEO, 2026-09-14 · 실측 2026-09-14, 브랜치 `main`, 시작/종료 HEAD `8aecc02`
- **코드 0줄 수정. 커밋 0건. DB write 0건(SELECT만).** 임시 스크립트는 저장소 밖에서
  돌리고 지웠다. `docs/beta-security-3-*` 는 미추적 그대로 두었다.
- 결론: **STOP 유지.** 신규 SAME 6건 중 **3건이 실제로 다른 상품**이다(이미지 실측).

---

## 0. 운영 호출 그래프 — 실제 함수까지

### 0-1. 해외 화면(이 결함의 무대)

```
apps/admin/src/app/pipeline/CommerceWorkspace.tsx:2366
   <ComparisonShopSearch title brand sourceUrl sku description />     ← color/material 안 넘김
 → apps/admin/src/app/pipeline/commerce/ComparisonShopSearch.tsx:311
   collectOverseasPrices({ title, brand, sourceUrl, sku, description })
 → 같은 파일:197  POST /api/comparison/search   (body = 위 다섯 칸이 전부)
 → apps/admin/src/app/api/comparison/search/route.ts:35-45
   productFactsFromIdentityDna(identityDnaFromFields({ title, brand, sku, sourceUrl,
                                                      color: body.color, material: body.material,
                                                      description }))
       ⚠ body.color / body.material 은 **언제나 undefined** — 화면이 그 두 칸을
         보내지 않는다(collectOverseasPrices 의 input 타입에 칸 자체가 없다).
 → packages/shared/src/product-identity-dna.ts:300 identityDnaFromFields
       category        null      ← 하드코딩
       ageRange        null      ← 하드코딩
       sizeRange       []        ← 하드코딩
       audienceSignals []        ← 하드코딩   ◀ 이번 작업의 대상
       imageUrls       []        ← 하드코딩
       color           null      ← 화면이 안 보내므로 사실상 상수
 → packages/crawler/src/comparison-search/index.ts:226 searchComparisonShops
 → 같은 파일:190 searchOneShop
       SHOPIFY_SUGGEST_DOMAINS(11곳) → searchShopifySuggest
       childrensalon.com             → searchChildrensalon
       그 외                          → status "unsupported", candidates []
 → packages/crawler/src/comparison-search/shopify-suggest.ts:48
   /search/suggest.json?...&resources[limit]=5
 → 같은 파일:69 productFactsFromShopifyProduct({title,handle,url,body,vendor,type,tags,image})
       ⚠ options 를 넘기지 않는다 → 후보 sizeLabels 는 **항상 []**
       ⚠ images 배열을 넘기지 않는다 → imageUrls 는 대표 1장
 → packages/crawler/src/comparison-search/match.ts:487
   query.facts && c.facts ? compareCrossSellerProducts(query.facts, c.facts) : null
       ⚠ 이미지 인자 없이 호출한다 → IMAGE 축은 운영에서 한 번도 발화하지 않는다
 → packages/crawler/src/comparison-search/cross-seller.ts:477 compareCrossSellerProducts
```

### 0-2. 🔴 운영에서 호출되지 않는 것 (이번 실측으로 재확인)

| 함수 / 경로 | 상태 |
|---|---|
| `productFactsFromSmallableHtml` (`seller-facts.ts`) | **운영 배선 없음.** 호출처가 테스트뿐(`cross-seller-matching.test.ts`). §11-0 의 정정이 그대로 유효하다. |
| `buildProductIdentityDna` (`product-identity-dna.ts:184`) | 해외 화면 경로에는 **없다.** 쓰는 곳은 `api/price-history/check`, `_lib/trigger-domestic-price-check`, `run-domestic-price-check` — 전부 **국내** 가격 경로다. |
| `compareCrossSellerProducts` 의 3번째 인자(이미지) | `match.ts:487` 이 넘기지 않는다 → IMAGE 축 미발화 |
| `shopifySizeLabels()` | 운영 입력(`suggest.json`)에 `options` 가 없어 **언제나 []** |
| **`bobochoses.com` 후보 생성** | **운영 경로 없음** — 아래 0-3 |

### 0-3. 🔴 이번 6건의 후보는 **오늘 운영에서 만들어지지 않는다**

4개 원본(430632/430651/430663/430704)을 **운영 코드 그대로**
(`searchComparisonShops` + DB `comparison_shops` 활성 25행) 라이브로 돌린 결과
(2026-09-14):

```
bobochoses.com : unsupported   (4개 상품 전부, 후보 0건)
```

`comparison_shops` 에 `bobochoses.com` 은 **활성(is_active=true)** 으로 들어 있지만,
`searchOneShop`(`index.ts:190`)의 `SHOPIFY_SUGGEST_DOMAINS` 목록에 없고
`childrensalon.com` 도 아니라 **파서가 없어 `unsupported` 로 끝난다.**
국내 경로 쪽(`domestic_price_sources`)의 `bobochoses.com` 행은 `enabled=false` 이고,
그 파서(`bobochoses-kr.ts`)는 애초에 `facts` 를 만들지 않는다.

신규 SAME 6건의 후보는 **6건 모두 `bobochoses.com`** 이다(§1). 즉:

```
오늘 운영 해외 화면에서 이 6건은 발생할 수 없다.
단, 그 이유는 "판정기가 막아서"가 아니라 "후보를 가져오지 않아서"다.
```

그리고 그 한 줄은 이미 닫혀 있다 — `bobochoses.com/search/suggest.json` 은 표준
구조를 그대로 돌려준다(라이브 실측, 2026-09-14):

```
q="Bobo Choses all about monsters T-shirts"  → 5건
   b226ac018(정답) · b226ac004 · b226ad013(성인) · b226ad006(성인) · b226ab045
q="Bobo Choses zipped sweat Sweatshirts"      → 5건
   b226ac114 · b226ac042(라벤더) · b226ac051 · b226ab062 · b226ac043(네이비·정답)
```

`SHOPIFY_SUGGEST_DOMAINS` 에 한 줄을 더하면(이 저장소가 다른 10개 도메인에 대해
이미 한 일) 이 6건은 즉시 운영 후보가 된다. **그래서 이 조사는 가정이 아니다.**

### 0-4. 측정 방법(재현 가능)

```
질의쪽   product_snapshots.workspace.canonicalProduct (운영 DB, SELECT만)
         source_url 중복 제거 → 67건  (§11-4 의 "68건"은 같은 모집단, 그 사이 1건 차이)
         입력 다섯 칸을 route.ts 와 글자 그대로 동일하게 구성
후보쪽   bobochoses.com 4,015건 + junioredition.com 18,236건 = 22,251건 (라이브 전수)
         (a) 카탈로그 원문 모양  (b) 운영 suggest.json 모양(options/images 제거)
쌍       67 × 22,251 = 1,490,817
```

`(a)`와 `(b)` 의 **신규 SAME 6건은 완전히 같은 집합**이다(후보 사이즈 유무가 이 6건에
영향을 주지 않는다 — 질의쪽 `sizeLabels` 도 `[]` 라 `compareSize` 가 어차피 "모름").

전이표(배선 전 → 배선 후, 카탈로그 모양 1,490,817쌍) — **§11-4 와 숫자가 정확히 일치**:

| | →SAME | →PRESUMED | →SIMILAR | →CONFLICT | 대각선 |
|---|---|---|---|---|---|
| SAME (31) | — | 0 | 0 | 0 | 31 |
| PRESUMED_SAME (1,605) | **6** | — | 0 | 40 | 1,559 |
| SIMILAR (9,650) | 0 | 744 | — | 768 | 8,138 |
| UNKNOWN (18,162) | 0 | 0 | 3,854 | 510 | 13,798 |
| CONFLICT | 0 | 0 | 0 | — | 1,461,369 |

---

## 1. 6건 해부

**6번째의 정체 = `430651 ↔ B226AC043`** 이다(실측으로 확정). 직전 보고가 적지 못한
칸이고, 하필 `B226AC042`와 `B226AC043` 은 `compareModelCode` 가 서로 **conflict** 로
판정하는(고정 테스트가 있는) 두 상품이다 — 둘 중 **최대 하나만** 참일 수 있다.

### 1-1. 나란히 보기

| | 430632 | 430651 | 430663 | 430704 |
|---|---|---|---|---|
| 질의 판매처 | smallable.com | smallable.com | smallable.com | smallable.com |
| 질의 URL | `/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632` | `/en/product/b.c.-organic-cotton-zipped-sweatshirt-navy-blue-bobo-choses-430651` | `/en/product/bobo-choses-organic-cotton-ample-joggers-lavender-bobo-choses-430663` | `/en/product/bc-recycled-fiber-tracksuit-jacket-blue-bobo-choses-430704` |
| brand | Bobo Choses | Bobo Choses | Bobo Choses | Bobo Choses |
| brandModelCode | **null** | **null** | **null** | **null** |
| sellerSku | AAA1804532 | AAA1804641 | (없음) | AAA1804939 |
| title | All About Monsters Washed T-shirt Organic cotton \| Blue | B.C. Organic Cotton Zipped Sweatshirt \| Navy blue | Bobo Choses 26FW Straight Jogging Pants | BC Recycled Fiber Tracksuit Jacket \| Blue |
| categoryText(질의) | **null** (taxon은 제목에서 TOP) | **null** (TOP) | **null** (PANTS) | **null** (OUTER) |
| colorText(질의) | **null** ← 화면이 안 보냄 | **null** | **null** | **null** |
| DB에 있는 색 | `color.value="Blue"` | `color.value="Navy"`, 옵션 `Navy blue` | `color.value="BLUE"` ⚠ 옵션은 `Lavender` | `color.value="Blue"` |
| material | organic cotton:100 | cotton:17/organic:66/recycled:17 | cotton:17/organic:66/recycled:17 | polyester:100, recycled polyamide:100 |
| fit | loose fit | loose fit | loose fit | relaxed fit |
| size(질의) | `[]` | `[]` | `[]` | `[]` |
| audienceSignals(현재) | `[]` | `[]` | `[]` | `[]` |
| audienceSignals(배선 후) | `["Home","Fashion  Children","Boy","Blouses, T-shirts",…]` | `[…,"Sweatshirts",…]` | `[…,"Trousers, Jeans, Leggings, Jogging Bottoms",…]` | `[…,"Coat, Down Jacket, Snowsuit",…]` |
| 가격 | €45 | €75 | $62 | €130 |

후보(전부 `bobochoses.com`, `products.json`/`suggest.json` 동일 값):

| 후보 | title | type | color | material | fit | size | tags | 가격 |
|---|---|---|---|---|---|---|---|---|
| `b226ac018` | All About Monsters T-shirt | T-shirts | midnight blue | organic cotton:100 | loose | 2-3Y…12-13Y | aw26/children/clothing/Current/drop-2/Kid/t-shirts | €45 |
| `b226ac042` | Mystery BC half zipped sweatshirt | Sweatshirts | **lavender** | 17/66/17 | loose | 2-3Y…12-13Y | …/drop-1/Kid/sweatshirts | €75 |
| `b226ac043` | Mystery BC half zipped sweatshirt | Sweatshirts | **navy** | 17/66/17 | loose | 2-3Y…12-13Y | …/drop-1/Kid/sweatshirts | €75 |
| `b226ac163` | Bobo Choses Pop jogging pants | Trousers | **yellow** | 17/66/17 | loose | 2-3Y…12-13Y | …/drop-2/Kid/trousers | €65 |
| `b226ac058` | Bobo Choses Pop jogging pants | Trousers | **blue** | 17/66/17 | loose | 2-3Y…12-13Y | …/drop-1/Kid/trousers | €65 |
| `b226ac117` | B.C. Embossed tracksuit jacket | Outerwear | blue | polyester:100, recycled polyamide:100 | relaxed | 2-3Y…12-13Y | …/branded/Kid/outerwear | €120 |

### 1-2. 판정 내부 — 6건이 **글자 하나까지 같은 모양**이다

```
배선 전  core 4  PRESUMED_SAME   blockers [] · conflicts [] · identifierConfirmed false
배선 후  core 5  SAME            blockers [] · conflicts [] · identifierConfirmed false
```

| # | 쌍 | TITLE | CATEGORY | MATERIAL | FIT | **AUDIENCE(신규)** | titleOverlap |
|---|---|---|---|---|---|---|---|
| 1 | 430632 ↔ `b226ac018` | +1 `about/all/monsters` | +1 `TOP↔TOP` | +1 `organic cotton:100` | +1 `loose fit` | **+1 `KIDS`** | **0.4286** |
| 2 | 430651 ↔ `b226ac043` | +1 `zipped` | +1 `TOP↔TOP` | +1 `17/66/17` | +1 `loose fit` | **+1 `KIDS`** | **0.1250** |
| 3 | 430651 ↔ `b226ac042` | +1 `zipped` | +1 `TOP↔TOP` | +1 `17/66/17` | +1 `loose fit` | **+1 `KIDS`** | **0.1250** |
| 4 | 430663 ↔ `b226ac163` | +1 `jogging` | +1 `PANTS↔PANTS` | +1 `17/66/17` | +1 `loose fit` | **+1 `KIDS`** | **0.2500** |
| 5 | 430663 ↔ `b226ac058` | +1 `jogging` | +1 `PANTS↔PANTS` | +1 `17/66/17` | +1 `loose fit` | **+1 `KIDS`** | **0.2500** |
| 6 | 430704 ↔ `b226ac117` | +1 `tracksuit` | +1 `OUTER↔OUTER` | +1 `polyester:100,recycled polyamide:100` | +1 `relaxed fit` | **+1 `KIDS`** | 미측정 문자 겹침 `tracksuit` 1개 |

`MODEL_CODE` 축은 6건 전부 **0점**이다 — Smallable 원본의 `brandModelCode` 가 null
이라 `compareModelCode` 가 `unavailable` 이고, `slugCarriesCode` 도 걸리지 않는다.
즉 **정답과 오답을 가르는 유일한 강한 축이 여섯 쌍 모두에서 꺼져 있다.**

### 1-3. 이미지 (전부 실제로 열린다 — 2026-09-14 다운로드 확인)

| 쌍 | 질의 이미지(등록상품) | 후보 이미지 | 육안 판정 |
|---|---|---|---|
| 430632 | `…supabase.co/…/e92e7982-…-0001.jpg` | `…/files/B226AC018_1_1.webp` | **동일** — 네이비 워시드 장슬리브, 흰색 `All about Monsters` 로고, 같은 위치 |
| 430651 | `…/25067ad6-…-0001.jpg` | `…/files/B226AC043_1.webp` | **동일** — 네이비 하프집업, **초록** `LET THE MYSTERY FIND YOU / B.C.` 타원 |
| 430651 | (같은 이미지) | `…/files/B226AC042_1.webp` | **다름** — **라벤더** 바탕 + **주황** 로고 |
| 430663 | `…/354ad9bc-…-0001.jpg` | `…/files/B226AC163_01_…webp` | **다름** — 질의는 **라벤더 와이드 스트레이트**, 후보는 **노랑 + 발목 조임(조거)** |
| 430663 | (같은 이미지) | `…/files/B226AC058_1_1.webp` | **다름** — **워시드 블루 + 발목 조임**, 흰색 `BOBO CHOSES` |
| 430704 | `…/43814079-…-0001.jpg` | `…/files/B226AC117_1_1.webp` | **동일** — 버건디 소매 + 청색 몸판 + 초록 카라, 크림색 `B C` |

참고(후보가 아니지만 결정적): `b226ac060 Bobo Choses straight jogging pants`
(**라벤더**, 주황 세로 `BOBO CHOSES`)가 430663 의 실제 정답이다. 이미지가 질의와
동일하고, **배선 전에도 이미 SAME(core 5)** 이다.

---

## 2. 분류

```
A 실제 SAME      3건
B 실제 다른 상품  3건
C 판단 불가      0건
```

| 판정 | 쌍 | 근거(확인 가능한 사실) |
|---|---|---|
| **A** | 430632 ↔ `b226ac018` | 이미지 동일 · 색(midnight blue/Blue) · 소재 organic cotton 100% · 가격 €45 = €45 · 제조국 Spain |
| **A** | 430651 ↔ `b226ac043` | 이미지 동일(초록 로고 네이비) · 색 navy = Navy blue · 17/66/17 · €75 = €75 · Spain |
| **A** | 430704 ↔ `b226ac117` | 이미지 동일(3색 절개 트랙탑) · polyester 100 + recycled polyamide 100(희귀한 이중 100 표기가 양쪽 동일) · relaxed fit · 제조국 China · €130 ↔ €120 |
| **B** | 430651 ↔ `b226ac042` | **라벤더 + 주황 로고**. 질의는 네이비 + 초록 로고. 저장소의 고정 테스트가 이미 이 쌍을 `CONFLICT(COLOR)` 로 못 박고 있다(`cross-seller-matching.test.ts:172-177`, "색상이 충돌하면 나머지 근거가 아무리 많아도 동일상품이 되지 않는다"). 또한 `compareModelCode("B226AC042","B226AC043") = conflict` 가 고정돼 있으므로 043 이 참이면 042 는 거짓이다. |
| **B** | 430663 ↔ `b226ac163` | **노랑**, 발목 조임 조거. 질의는 라벤더 와이드 스트레이트. 이름도 `Pop` ↔ `straight`. |
| **B** | 430663 ↔ `b226ac058` | **워시드 블루**, 발목 조임 조거. 같은 이유. 게다가 430663 의 진짜 짝 `b226ac060`(라벤더 straight)은 **이미 SAME 으로 서 있다** — 배선은 정답 하나에 오답 둘을 덧붙인 셈이다. |

C(판단 불가)는 **0건**이다 — 여섯 쌍 모두 판매처가 게시한 이미지·색상·품번으로
확정할 수 있었다. 억지로 A/B 로 민 건은 없다.

---

## 3. 질의 evidence 가 만든 점수 — 무엇을 증명했나

### 3-1. 추가된 점수는 **딱 하나, 모든 쌍에서 같은 것**

```
facts 없음(현재 운영)  →  core 4   TITLE+1 CATEGORY+1 MATERIAL+1 FIT+1
facts 있음(배선 후)     →  core 5   위 + AUDIENCE +1 「대상 KIDS」
```

6건 전부 **AUDIENCE +1 하나**로 `SAME_MIN_AXES`(5)에 닿는다. 다른 축은 한 점도
움직이지 않았다. 즉 이번 승격은 "증거가 좋아져서"가 아니라 **문턱 바로 아래에
서 있던 것들을 한 축이 통째로 밀어 올린 것**이다.

전수에서 본 그 축의 질량(1,490,817쌍):

```
AUDIENCE +1 이 새로 붙은 쌍        6,859  (충돌로 끝나지 않은 쌍 중)
  배선 전 core 0 → 3,854 · 1 → 2,038 · 2 → 744 · 3 → 197
  배선 전 core 4 →    19   ◀ SAME 문턱 바로 아래
      그 19건 중  SAME 으로 올라간 것            6
                 AUDIENCE_LINE 보류가 막은 것    9   (430632 의 아기옷 — 3.2-B가 일한다)
                 GARMENT_FORM 보류가 막은 것     3
                 SAME_SELLER_DISTINCT_LISTING    2
새로 CONFLICT 가 된 쌍             1,318   (성인↔아동 — 이쪽은 정상 동작)
```

### 3-2. 그 축이 가진 정보량 — 이번 실측(운영 후보 모양)

```
질의 67건 중 배선 후 AudienceGroup 이 읽히는 것   39건   → 전부 KIDS, ADULT 0건
후보 22,251건                                    KIDS 5,844 · ADULT 3,928 · 모름 12,479
```

| 카탈로그 | 판독분 중 KIDS | 질의(=항상 KIDS)일 때 AUDIENCE 일치확률 | 정보량 |
|---|---|---|---|
| bobochoses.com | 1,000 / 1,158 | **86.4%** | **0.21 bit** |
| junioredition.com | 2,169 / 5,939 | 36.5% | 1.45 bit |

이번 6건의 후보는 **전부 bobochoses.com** 이다. 그 카탈로그에서 `AUDIENCE +1` 은
**0.21 bit** — 사실상 "이 가게는 아동복 가게다"라는 상수다. `SAME_MIN_AXES` 의
다섯 칸 중 한 칸을 그 상수가 채웠다.

### 3-3. 동일성을 증명한 증거 vs 카탈로그 공통 속성

| 축 | 이번 6건에서 준 점수 | 이것이 증명하는 것 | 판정 |
|---|---|---|---|
| **AUDIENCE** | +1 (6/6) | "둘 다 아동용" | **카탈로그 공통 속성** (bobochoses 0.21 bit) |
| **FIT** | +1 (6/6) | "둘 다 loose/relaxed" | **카탈로그 공통 속성** (§9-2: 1.41 bit, 설명문 한 문장에서 나옴) |
| **MATERIAL** | +1 (6/6) | 성분표 일치 | **카탈로그 공통 속성**. `17/66/17`은 Bobo 스웨트 라인 전체의 상수이고, 색·소재·핏이 **같은 한 문장**에서 나온다(§3의 "한 문장을 세 번 센다"). 430651/430663 은 이 세 축이 전부 같은 문장에서 왔다 |
| **CATEGORY** | +1 (6/6) | 상품군 동일 | **카탈로그 공통 속성** (§9-2: 1.71 bit). 질의쪽 `categoryText` 는 null 이라 **제목에서 추정한 taxon** 이다 |
| **TITLE** | +1 (6/6) | 겹친 말 | **경우에 따라 다르다.** 430632 의 `about/all/monsters`(jaccard 0.43)는 상품을 가리킨다. 430651 의 `zipped` 한 개(0.125), 430663 의 `jogging` 한 개(0.25), 430704 의 `tracksuit` 한 개는 **유형어에 가까운 필러**다 |
| **COLOR** | **0점 (발화 불가)** | — | 질의쪽 `colorText` 가 **항상 null**(화면이 `color` 를 안 보낸다). 실제로 구별하는 축(2.75 bit)이 운영에서 통째로 꺼져 있다 |
| **MODEL_CODE** | **0점** | — | Smallable 원본 `brandModelCode` null |
| **SIZE / IMAGE** | **0점** | — | 양쪽 사이즈 없음 · `match.ts:487` 이 이미지 인자를 안 넘김 |

> **한 줄 요약:** 이번에 공급된 evidence 는 **동일성을 증명하지 않았다.**
> 그것은 판매처 카탈로그의 상수(`아동복 가게`)였고, 그 상수가 이미 상수 넷
> (CATEGORY/MATERIAL/FIT + 필러 TITLE)으로 4점을 쌓아 둔 자리에 다섯 번째 칸으로
> 들어갔다. **상품을 구별하는 축(COLOR·MODEL_CODE·SIZE·IMAGE)은 6건 전부에서
> 0점이다.**

### 3-4. 대조 실험 — 색상까지 실어 보내면? (측정만 했다. 구현하지 않았다)

route 는 `body.color` 를 **이미 받을 수 있다**(`route.ts:16`). 화면만 안 보낸다.
DB `canonicalProduct.color.value` 를 그 칸에 실어 같은 전수를 다시 쟀다:

| 시나리오 | 총 SAME | A_now 대비 신규 | A_now 대비 손실 |
|---|---|---|---|
| A 현재 운영 | 31 | — | — |
| B **+audienceSignals** (STOP 대상) | 37 | **6** (A 3 / B 3) | 0 |
| C +audienceSignals +color | 37 | 7 | **1** |
| D +color 만 | 40 | 10 | **1** |

- C 는 오답 2건(`b226ac042`, `b226ac163`)을 지우고 정답 `430701 ↔ b226ac114`
  (기존 골든 쌍)를 되살린다. 그러나 **정답 `430663 ↔ b226ac060` 을 죽이고**
  대신 오답 `b226ac058` 을 살린다 — 원인은 판정기가 아니라 **데이터**다:
  430663 의 `canonicalProduct.color.value` 가 `"BLUE"` 인데 실제 상품은 라벤더다
  (같은 스냅샷의 `optionGroups` 에는 `Lavender` 가 들어 있다).
- D 는 `430632` 의 아기옷 오탐 5건을 되살린다 — `AUDIENCE_LINE` 보류가 질의쪽
  라인을 못 읽어 발화하지 못하기 때문이다(§11-5 의 구조 그대로).

**어떤 단일 축을 실어도 오탐 0 이 되지 않는다.**

---

## 4. 430632 정답과 축별 비교

`430632 ↔ B226AC018`(A, 정답)을 나머지와 같은 표에 둔다. 전부 **운영 질의 모양**
(색상·사이즈·카테고리·품번 없음)이다.

| 축 | ✅430632↔AC018 | ✅430651↔AC043 | ✅430704↔AC117 | ❌430651↔AC042 | ❌430663↔AC163 | ❌430663↔AC058 |
|---|---|---|---|---|---|---|
| **AUDIENCE** | **+1 KIDS** | **+1 KIDS** | **+1 KIDS** | **+1 KIDS** | **+1 KIDS** | **+1 KIDS** |
| **CATEGORY** | **+1 TOP** | **+1 TOP** | **+1 OUTER** | **+1 TOP** | **+1 PANTS** | **+1 PANTS** |
| **MATERIAL** | **+1** | **+1** | **+1** | **+1** | **+1** | **+1** |
| **FIT** | **+1 loose** | **+1 loose** | **+1 relaxed** | **+1 loose** | **+1 loose** | **+1 loose** |
| **TITLE** | +1 (0.43, `about/all/monsters`) | +1 (0.125, `zipped`) | +1 (`tracksuit`) | +1 (0.125, `zipped`) | +1 (0.25, `jogging`) | +1 (0.25, `jogging`) |
| COLOR | — 질의 null | — 질의 null | — 질의 null | — 질의 null | — 질의 null | — 질의 null |
| SIZE | — 양쪽 없음 | — | — | — | — | — |
| MODEL_CODE | — 질의 null | — | — | — | — | — |
| IMAGE | — 미배선 | — | — | — | — | — |
| **core** | **5** | **5** | **5** | **5** | **5** | **5** |
| blockers / conflicts | 없음 | 없음 | 없음 | **없음** | **없음** | **없음** |

> **정답과 오답에서 똑같이 발화하는 축: AUDIENCE · CATEGORY · MATERIAL · FIT ·
> TITLE — 즉 점수를 만든 다섯 축 전부.** 여섯 줄이 축 구성·점수·보류·충돌까지
> 완전히 동일하다. **현재 데이터가 판정기에 도달하는 방식으로는 정답과 오답을
> 가를 수 있는 자리가 한 칸도 없다.**

유일하게 정답 쪽이 더 나은 곳은 TITLE 의 **수치**(0.43 vs 0.125/0.25)인데,
판정기는 그 수치를 `STRONG_TITLE_OVERLAP`(0.5) 한 칸으로만 읽으므로 **셋 다 +1** 이다.
0.43 은 0.5 에 닿지 못하고, 0.125 와 같은 점수를 받는다.

참고 — 배선과 무관하게 이미 SAME 인 정답들(대조군):

| 쌍 | core | 무엇이 달랐나 |
|---|---|---|
| 430663 ↔ `b226ac060`(정답) | 5→6 | **TITLE +2** (`straight/jogging`, jaccard 0.67 ≥ 0.5) |
| 430701 ↔ `b226ac114`(골든) | — | 운영 질의 모양에서는 **SAME 아님**(§3-4 C에서만 살아난다) |

---

## 5. STOP 유지 여부

### 🔴 STOP 유지

지시서 기준: *"6건 중 실제 다른 상품이 1건이라도 있고, 현재 데이터만으로 안전하게
막을 규칙이 명확하지 않으면 → STOP 유지."*

```
실제 다른 상품          3건 (430651↔AC042 · 430663↔AC163 · 430663↔AC058)
안전하게 막을 규칙       없다 (§4 — 여섯 줄의 축 구성이 완전히 동일하다)
```

더해서 이 배선이 **단순한 증거 보강이 아님**을 뒷받침하는 사실 셋:

1. **정답과 오답의 판정 근거가 글자 하나까지 같다.** 어느 임계값을 올려도 셋이
   같이 죽고, 어느 축을 빼도 여섯이 같이 죽는다.
2. **한 원본에 서로 배타적인 SAME 이 동시에 선다.** `430651` 은 `B226AC042` 와
   `B226AC043` 을 동시에 SAME 으로 갖는데, 저장소는 그 둘을 `compareModelCode`
   **conflict** 로 고정해 두었다(둘이 서로 다른 상품이라는 것을 이미 안다).
   `430663` 은 정답 `b226ac060` 을 포함해 **네 개**의 SAME 을 갖는다.
   동일상품 가격 비교(`isSameProductForPricing`)는 SAME 만 쓰므로, 이대로면
   **다른 색/다른 상품의 가격이 같은 상품 가격으로 들어간다.**
3. **저장소의 고정 테스트와 정면으로 어긋난다.** `cross-seller-matching.test.ts`
   는 `430651 ↔ B226AC042` 를 `CONFLICT` 로 못 박고 있다. 그 테스트가 통과하는
   이유는 픽스처가 `productFactsFromSmallableHtml`(운영 미배선)로 만들어져
   **질의쪽 색상이 있기 때문**이다. 운영 질의에는 그 색상이 없다 —
   **테스트가 초록인 채로 운영이 빨간 자리**이고, 이 저장소가 네 번 겪은 바로
   그 모양이다.

한편 §0-3 대로 **오늘 당장의 사고는 아니다** — `bobochoses.com` 후보가 운영에서
만들어지지 않기 때문이다. 그러나 그 방어는 판정이 아니라 누락이고, 그 누락은
정답 4건(`b226ac018`/`b226ac043`/`b226ac117`/`b226ac060`)도 함께 가리고 있다.
**"후보를 안 가져와서 안전하다"로 이 STOP 을 풀어서는 안 된다** — 이 문서 §1의
금지 조항("검색이 우연히 가린 것과 판정기가 고쳐진 것은 다르다")이 그대로 적용된다.

---

## 6. 설계 제안 (구현하지 않았다 · 판단 요청)

어느 것도 코드로 만들지 않았다. 근거는 위 실측뿐이다.

### 제안 1 — 배선은 "증거 한 축"이 아니라 **한 묶음**으로만 판단한다

이번 실측이 보여준 것은 축 하나씩 켜면 매번 다른 오탐이 생긴다는 것이다
(§3-4: B 는 오탐 3, D 는 오탐 6+, C 는 정답 1건 손실). 그러므로
`identityDnaFromFields` 의 `audienceSignals` 만 채우는 형태의 배선은
**단독으로 승인받을 수 없는 변경**으로 취급하자는 제안.

### 제안 2 — `TITLE` 의 단차를 축이 아니라 **등급**으로 읽는 방안 (미검증)

§4 의 유일한 차이가 titleOverlap 수치(0.43 vs 0.125)인데 판정기가 그것을
1점으로 뭉갠다. 다만 0.43 은 `STRONG_TITLE_OVERLAP`(0.5) 아래이므로
"0.5 를 낮춘다"로는 430651/430663(0.125/0.25)과 갈라지지 않고,
그 사이 어딘가(예 0.3~0.4)에 선을 새로 긋는 것은 **이번 6건에 맞춘 값**이라
같은 사고를 반복한다. **문서빈도 없이는 이 축을 고칠 수 없다**는 §9-7 의 기록이
이번 실측으로 다시 확인됐다(`zipped`/`jogging`/`tracksuit` 한 개가 `monsters`
세 개와 같은 점수를 받는다).

### 제안 3 — 질의쪽 색상의 **출처를 바꾸는** 문제 (데이터 결함 보고)

`430663` 의 `canonicalProduct.color.value = "BLUE"` 는 틀렸다(실제 라벤더,
같은 스냅샷 `optionGroups` 에 `Lavender` 가 있다). 색상 배선을 검토하기 전에
**어느 칸을 진실로 볼 것인가**가 먼저 정해져야 한다. 이 한 건 때문에 §3-4 의
C 시나리오가 정답을 죽였다.

### 제안 4 — `bobochoses.com` 의 "활성인데 파서 없음" 상태 (사실 보고)

`comparison_shops.is_active = true` 인데 `searchOneShop` 이 `unsupported` 를
돌려주는 도메인이 **25곳 중 15곳**이다(실측: alexandalexa · babyshop ·
**bobochoses** · bucketsandspades · cissyweras · kids-world · kidsdepartment ·
kidsroom · luksusbaby · melijoe · mytheresa · pandaandcub · scoutandcokids ·
**smallable** · studioplay). 화면에는 "찾지 못함"과 구분되지
않는 형태로 도착한다. 이번 결함과 직접 관계는 없으나, §0-3 의 "방어가 아니라
누락"이라는 판단의 근거이므로 기록해 둔다.

---

## 7. 확인하지 못한 것

1. **6건 외 나머지 판매처.** 전수 대상은 `bobochoses.com` + `junioredition.com`
   두 카탈로그(22,251건)뿐이다. `SHOPIFY_SUGGEST_DOMAINS` 의 나머지 10곳과
   `childrensalon.com` 은 카탈로그 전수를 받을 방법이 없어(검색 API만 있다)
   같은 방식으로 재지 못했다. 다만 §0-3 의 라이브 4건 측정에서 그 10곳은 전부
   `BRAND` 충돌로 끝났다.
2. **이미지 거리 수치.** 육안으로 동일/상이를 판정했고 pHash 거리는 재지 않았다
   (`match.ts:487` 이 이미지 인자를 넘기지 않아 운영 의미가 없고, §4 의 실측
   기록대로 현재 임계값은 순서가 뒤집혀 있다).
3. **`430704 ↔ b226ac117` 의 가격 차(€130 ↔ €120)**. 이미지·소재·핏·제조국이
   전부 같아 A 로 판정했으나, 판매처 마진인지 다른 연도 상품인지는 확인하지
   못했다. 품번 증거가 없다(Smallable 쪽 `brandModelCode` null).
4. **`68건 ↔ 67건`.** §11-4 는 원본 68건, 이번 측정은 `source_url` 중복 제거 후
   67건이다. 전이표 수치가 완전히 일치하므로 같은 모집단으로 보지만, 1건의
   차이가 어디서 왔는지는 확인하지 않았다.
5. **`AUDIENCE_LINE` 은 이 6건에서 원리상 일할 수 없다.** 배선 후 네 원본의
   `resolveAudienceLine` 은 전부 `CHILD` 이고(실측), 여섯 후보도 전부 `CHILD` 라
   보류가 아니라 **일치**다 — 그리고 일치에는 점수를 주지 않는 축이므로 아무 일도
   일어나지 않는다(설계대로다). 즉 MATCHING-3.2-B 가 막은 것은 **아기옷 오탐**이고,
   이번 3건은 **같은 연령 라인 안의 다른 색/다른 상품**이라 다른 결함이다.
   그 구멍이 다른 원본에서 얼마나 넓은지는 세지 않았다.
