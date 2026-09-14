# MATCHING-3.2-E · COLOR EVIDENCE SAFETY (READ ONLY)

- 지시: CEO, 2026-09-14(+보고서 구성 추가지시) · 실측 2026-09-14, 브랜치 `main`, 시작/종료 HEAD `8aecc02`
- **코드 0줄 수정. 커밋 0건. DB write 0건(SELECT만).** 임시 스크립트는 저장소 밖
  (`node_modules/.mi-scratch`)에서 돌리고 지웠다. `docs/beta-security-3-*`,
  `docs/matching-3.2-c/d-*` 는 미추적 그대로 두었다.
- 직전 조사 `docs/matching-3.2-c-query-evidence-audit.md` §0 호출 그래프와
  `docs/matching-3.2-d-color-authority.md` 를 재사용했고 재조사하지 않았다.

---

# GATE 1 — USER_EDITED 를 제거했을 때 현재 정상 SAME 을 보존하는가

## 🟢 **보존한다. 손실 0건. 새 오답 SAME 0건.**

`A`(오늘의 `color.value`) → `C`(USER_EDITED 색상 제거) 로 바뀌는 쌍은 **전 모집단
329쌍 중 정확히 3쌍**이고, **3쌍 전부 430663 한 상품**이다. 나머지 326쌍은 판정이
한 글자도 움직이지 않는다. 이유는 산술적으로 자명하다 — **전 DB에서 값이 들어 있는
`USER_EDITED` 색상은 430663 한 건뿐**이기 때문이다(§2).

```
A → C 전이 (329쌍, 해외 질의 형태, bobochoses.com suggest 후보)

  CONFLICT → SAME            1건   430663 ↔ b226ac060   ◀ 정답이 되살아난다
  CONFLICT → PRESUMED_SAME   2건   430663 ↔ b226ac059(다크그린) · b226ac162(베이지)
                                    ◀ 오답이지만 SAME 이 아니다. 가격에 안 들어간다
  그 외 326쌍                변화 없음
  SAME → (무엇이든)          0건   ◀ 손실 없음
  (무엇이든) → SAME (오답)   0건   ◀ 새 오답 SAME 없음
```

### GATE 1-a. 430663 ↔ AC060 (정답) 은 C 에서 어떻게 되는가

```
C 입력:  SAME  (core 5 = TITLE+2 · CATEGORY+1 · MATERIAL+1 · FIT+1)
         conflicts 없음 · blockers 없음
A 입력:  CONFLICT (색상 PURPLE ↔ BLUE)   ← 사람이 넣은 "BLUE" 가 정답을 죽인다
```

### GATE 1-b. 오답 AC058 / AC163 은 C 에서 어떻게 되는가

```
AC058 (팝 조거, 블루)   C 입력: PRESUMED_SAME (core 4)   ← SAME 아님
AC163 (팝 조거, 옐로)   C 입력: PRESUMED_SAME (core 4)   ← SAME 아님
```

둘 다 `SAME_MIN_AXES = 5` 에 **1점 모자라** 멈춘다. 색상 축을 비워도 이 두 오답은
가격 비교에 들어가지 않는다(`isSameProductForPricing` 은 SAME 만 통과시킨다).

> ⚠️ **정직하게 적는다:** `A` 입력에서 AC058 은 **SAME 이었다**(사람이 넣은 "BLUE" 가
> 후보의 blue 와 맞아 COLOR+1 을 벌어 core 5 를 채웠다). 즉 `C` 는 이 오답을
> **막는 쪽**이다. 반대로 `C` 가 새로 만든 SAME 은 정답 AC060 하나뿐이다.

### GATE 1-c. 다른 정상 SAME 쌍들도 색상 축 없이 살아남는가

```
430632 ↔ b226ac018   A=SAME   C=SAME   ✅ 변화 없음
430651 ↔ b226ac043   A=SAME   C=SAME   ✅ 변화 없음
430704 ↔ b226ac117   A=SAME   C=SAME   ✅ 변화 없음
```

이 세 상품의 `color.source` 는 전부 `ORIGINAL` 이라 `C` 필터가 아예 닿지 않는다.
**색상 축이 사라지는 것이 아니라, 사람이 덮어쓴 한 칸만 사라진다.**

### GATE 1-d. 전 모집단 전이표 (68질의 × bobochoses suggest 5건 = 329쌍)

| 입력 | CONFLICT | SIMILAR | PRESUMED_SAME | **SAME** | UNKNOWN |
|---|---|---|---|---|---|
| `none`(오늘 해외 운영) | 276 | 25 | 21 | **3** | 4 |
| `A` color.value | 287 | 21 | 14 | **7** | 0 |
| `B` optionGroups | 280 | 24 | 18 | **3** | 4 |
| `C` USER_EDITED 제거 | 284 | 21 | 16 | **8** | 0 |

```
A → C   달라진 쌍 3건 (전부 430663) · SAME 손실 0 · 오답 SAME 신규 0
```

> 표본 수 정정: 3.2-D 의 "659쌍"은 **후보 모양 2종(카탈로그/suggest) × ~330쌍**의
> 합이다. 이번 조사는 운영 모양(suggest) 한 종만 세서 329쌍이다. 같은 모집단이다
> (68질의 중 2건은 suggest 결과 0건, 1건은 4건).

### GATE 1-e. 🟡 한 가지 반드시 구분할 것 — `C` 는 "오늘"이 아니다

```
해외 경로   오늘 운영 = none (화면이 color 를 안 보낸다, 3.2-C §0-1)
            none → C 는 5건이 PRESUMED_SAME → SAME 으로 승격한다
              430632↔ac018 (정답) · 430651↔ac043 (정답) · 430704↔ac117 (정답)
              430632↔ab048 (오답, 다른 프린트) · 430632↔ab043 (오답, 다른 프린트)
```

이 **오답 2건은 `A` 에서도 똑같이 발생한다**(none→A 도 같은 5건이다). 즉
**USER_EDITED 필터가 만든 것이 아니라, 색상 축을 켜는 것 자체가 만드는 것**이다.
GATE 1 이 묻는 "USER_EDITED 제거로 인한 손실/신규 오답"은 `A ↔ C` 비교이고, 그
답은 위 §GATE 1-d 대로 **0건**이다. 색상 축 배선 자체의 손익은 3.2-D §4-5 의
별개 판단이며 이번 작업의 범위가 아니다.

### GATE 1-f. 🟡 국내 경로에서는 세 쌍 모두 애초에 SAME 에 못 간다

`buildProductIdentityDna`(USER_EDITED 색상이 **실제로 살아 있는** 유일한 경로)로
같은 세 쌍을 다시 돌리면:

| 쌍 | A | B | C |
|---|---|---|---|
| ↔ AC060 (정답) | CONFLICT(COLOR) | PRESUMED_SAME | **PRESUMED_SAME** |
| ↔ AC058 (오답) | PRESUMED_SAME | CONFLICT(COLOR) | **PRESUMED_SAME** |
| ↔ AC163 (오답) | CONFLICT(COLOR) | CONFLICT(COLOR) | **PRESUMED_SAME** |

국내 형태에서는 `MATERIAL` 보류가 항상 발화한다(질의는 소재 전문 3성분, 후보는
`cotton:17` 하나 — 후보 body 가 잘려 있다). `blockers.length > 0` 이면 SAME 이
불가능하므로, **국내 경로에서 이 세 쌍은 어떤 색상 입력에서도 SAME 이 되지 않는다.**
`C` 가 국내 경로에서 무엇을 살리거나 죽이는지는 **이 표본으로는 측정되지 않았다**
(§7-2 참조).

---

# GATE 2 — optionGroups 의 다중값 의미를 실제 상품 페이지에서 검증했는가

## 🔴 **검증하지 못했다. 같은 상품을 한 페이지에서 여러 색으로 파는 사례를 찾지 못했다.**

**"못 찾았다 = 미검증"이다. 없는 것으로 쓰지 않는다.**

### GATE 2-a. 어디를 얼마나 찾았는가

| 대상 | 규모 | 색상 옵션 값 2개 이상 |
|---|---|---|
| 운영 DB 전수 (dedup) | 68 상품 | **0건** (색상 축 5건 전부 값 1개) |
| bobochoses.com `products.json` | 1,500 상품 | **0건** (옵션 이름: Size/Clothing size/Accessories size/Shoes size — 색상 축 자체가 없다) |
| theanimalsobservatory.com | 1,500 상품 | **0건** (Size/Design/Denominations) |
| designerkidswear.com | 1,500 상품 | **0건** (Size/Shoe Size/Title) |
| houseofkids.com | 500 상품 | **0건** (Size) |
| tentree.com | 250 상품 | **0건** — Color 옵션이 250개 전부 **값 1개** |
| www.marinelayer.com | 250 상품 | **0건** — Color 옵션이 250개 전부 **값 1개** |
| www.taylorstitch.com / www.girlfriend.com | 415 상품 | **0건** (색상 옵션 없음) |
| **합** | **약 5,983 상품 / 8 판매처 / 2 카테고리(아동복·성인 어패럴)** | **0건** |

접근 실패: babyshop.com(403), 다수 Shopify 스토어(429/403).

### GATE 2-b. 대신 **왜 0건인지**는 원문에서 확인했다

색상 옵션이 있는 스토어도 **색깔마다 별도 상품(별도 URL)으로 쪼갠다.** 실측:

```
www.marinelayer.com
  /products/donegal-fair-isle-sweater     Color=["Oatmeal & Cabernet"]  Size=[XS..XL]
  /products/donegal-fair-isle-sweater-1   Color=["Oatmeal"]             Size=[XS..XL]
      ↑ 같은 상품, 다른 색, 다른 리스팅. Color 값은 각각 1개다.

www.smallable.com  (라이브 JSON-LD, HTTP 200, 2026-09-14)
  430663 Lavender    variesBy="https://schema.org/color"  hasVariant=2
      [0] keys=@type,name,image,description,brand,model,sku,color,logo,offers  color="Lavender"
      [1] keys=url                                                    ← 형제 색(430664) 링크만
  430664 Navy blue   variesBy="https://schema.org/color"  hasVariant=2
      [0] color="Navy blue"   [1] keys=url  ← 430663 링크만
```

### GATE 2-c. 🔴 그래서 "값이 1개"의 의미가 **확정되지 않았다**

CEO 질문("`optionGroups=1` 이 정말 단일 색상인지, 아니면 하나의 옵션 그룹 안에 여러
색상 variant 가 있는지")에 코드와 실데이터 양쪽으로 답하면:

```
① "그룹 개수"와 "값 개수"는 다른 것이다. 운영 DB 68건 기준
     optionGroups 배열 길이(=축 개수) 분포:  0개 18건 · 1개 50건 · 2개 이상 0건
     색상 축의 values 길이 분포:             1개 5건 · 2개 이상 0건
   즉 이 데이터에서는 축도 하나, 값도 하나다. 두 수가 우연히 같아서
   "1이니까 단일 색상"이라는 말이 성립해 보이는 것뿐이다.

② 추출기가 배열에 넣는 것은 "축 이름별로 등장한 값의 합집합"이다
     product-data-extractor.ts:250-264
       axisValues[axisName] ← hasVariant 전체를 돌며 중복 없이 push
   따라서 **값 1개는 "hasVariant 중 색을 말한 것이 하나뿐"이라는 뜻이지
   "이 상품이 한 색"이라는 뜻이 아니다.**

③ 실제로 430663 의 ProductGroup 은 hasVariant 가 2개이고 variesBy=color 다.
   두 번째 variant 는 `url` 키 하나뿐이라 product-data-extractor.ts:225
   (`축을 하나도 못 찾으면 건너뛴다`)에서 **버려진다.**
   → 값이 1개가 된 것은 **원본이 한 색이어서가 아니라 추출기가 나머지를
     버려서**다. 결과가 맞았을 뿐, 근거가 맞은 것이 아니다.
```

### GATE 2-d. 다중값이 들어오면 `intersects()` 가 어떻게 되는가 — 코드 실측

실제 페이지를 못 찾았으므로 **가상 입력**으로 저장소 함수를 그대로 돌렸다.
(가상 입력임을 명시한다. 이것은 관측이 아니라 코드 동작 확인이다.)

```
resolveColorHueGroups("Lavender")                              = {PURPLE}
resolveColorHueGroups("Lavender Navy blue")                    = {BLUE, PURPLE}
resolveColorHueGroups("Lavender Navy blue Dark green Beige")   = {BEIGE, GREEN, BLUE, PURPLE}
```

`compareColor` 는 `intersects(left, right)` — **하나라도 겹치면 match** 다
(cross-seller.ts:366-374). 430663 질의의 색상 값 개수만 늘려서 그대로 판정하면:

| optionGroups 색상 값 | AC060 (정답) | AC058 (오답·블루) | AC163 (오답·옐로) |
|---|---|---|---|
| 1값 `Lavender` (오늘의 실데이터) | SAME (core 6) | **CONFLICT** ✅ | **CONFLICT** ✅ |
| 가상 2값 `Lavender + Navy blue` | SAME (core 6) | **SAME** ❌ | CONFLICT ✅ |
| 가상 4값 | SAME (core 6) | **SAME** ❌ | CONFLICT |

> **값이 2개가 되는 순간 오답 AC058 이 CONFLICT 에서 SAME 으로 뒤집힌다.**
> 색상 축이 반증을 멈추는 데서 그치지 않고, `COLOR+1` 을 벌어 **SAME 정원을
> 채워주는 쪽으로 돌아선다.** 3.2-D §5-⑤ 가 가정으로 적었던 위험이
> **코드 수준에서는 실재**한다. 다만 **그 입력을 만들어내는 실제 페이지는 여전히
> 찾지 못했다** — 위험의 존재는 확인했고, 발생 빈도는 미확인이다.

### GATE 2-e. 🔴 `optionGroups` 는 생성 경로가 4개이고 **의미가 서로 다르다**

`resolveOptionGroups`(product-data-extractor.ts:559-561)는 아래 순서로 폴백한다.
어느 경로로 만들어졌는지는 `CanonicalProduct` 에 **남지 않는다**(`ProvenanceField`
가 아니다 — 3.2-D §1-2).

| 경로 | 축 이름 | 값의 의미 | 값 1개 가능? |
|---|---|---|---|
| `extractProductGroupOptions` (JSON-LD ProductGroup) | 원문 그대로 `Color`/`Size`/additionalProperty 이름 | hasVariant 중 **축을 말한 것들의 합집합** | **가능** |
| `extractOptionsFromDom` (`<select>`) | **한국어로 정규화** `사이즈`/`색상` | 드롭다운 선택지 | 불가(`values.length < 2` 면 버린다, :480) |
| `extractOptionsFromDescriptionText` | `사이즈` 또는 **본문 라벨 그대로**(`Dress length` 등) | 나이 범위 나열 / **치수 스펙(cm)** ← 구매 옵션이 아니다 | 불가(2개 이상만) |
| `prestashop.site-strategy:296-340` | `<select>` 라벨 그대로, 없으면 `option{N}`/숫자키 | `combinations` 합집합(품절 포함) | 가능 |

운영 DB에 실제로 들어 있는 **값 1개짜리 비색상 사례 2건**이 이 문제를 보여준다:

```
www.junioredition.com          Title=["Default Title"]   variants=0
   ← Shopify 가 "옵션이 없는 상품"에 붙이는 자리표시자다. 옵션이 아니다.
www.theanimalsobservatory.com  Size=["OS"]               variants=0
```

즉 **"값이 1개"라는 신호 자체가 이미 이 DB 안에서 두 가지 다른 뜻으로 쓰이고 있다**
— "진짜 값이 하나"와 "옵션이 없다는 뜻의 자리표시자". 색상 축에서 같은 일이
일어나지 않는다는 보장은 어디에도 없다.

---

## 0. 두 GATE 요약

```
GATE 1  🟢 통과.  A→C 에서 달라지는 쌍은 430663 한 상품의 3쌍뿐.
                  정상 SAME 손실 0 · 새 오답 SAME 0 · 정답 1건 복구.
                  (단, 국내 경로 효과는 MATERIAL 보류에 가려 측정되지 않았다)

GATE 2  🔴 미검증.  약 5,983 상품 / 8 판매처를 뒤졌으나 한 페이지 다색 판매 0건.
                   "값 1개 = 단일 대표 색상"은 **근거가 확보되지 않았다.**
                   오히려 값 1개가 추출기의 skip 결과라는 것은 원문으로 확인했고,
                   값 2개가 되면 오답이 SAME 으로 뒤집힌다는 것도 코드로 확인했다.
```

**따라서 `optionGroups` 배선(②)은 STOP 유지.** `USER_EDITED` 제외(①)는 GATE 1 을
통과했다 — 상세는 §6.

---

## 1. provenance call graph — `USER_EDITED` 는 판정기까지 살아 있는가

### 1-1. 🔴 **살아 있지 않다.** 사라지는 지점은 정확히 두 곳이다

```
[국내 경로 — USER_EDITED 색상이 실제로 흐르는 유일한 경로]

apps/admin/src/app/api/pipeline/canonical-product.ts:161
    color: { value, source: "ORIGINAL",  confidence: 0.7 }   ← 파서가 찾음
         | { value: "",   source: "REQUIRED",  confidence: 0 }   ← 못 찾음
    (화면 ProductEditor 에서 셀러가 고치면 source:"USER_EDITED", confidence:1)
  ↓  DB product_snapshots.workspace.canonicalProduct.color : ProvenanceField<string>
     ── 여기까지 source / confidence 가 살아 있다 ──────────────────────────

apps/admin/src/app/api/price-history/check/route.ts:52
apps/admin/src/app/api/price-history/_lib/trigger-domestic-price-check.ts:64
    dna: buildProductIdentityDna(product)
  ↓
packages/shared/src/product-identity-dna.ts:184  buildProductIdentityDna
    :186   const colorValue = product.color.value.trim() || null;
    :197   color: colorValue,
       🔴🔴🔴  **여기서 provenance 가 사라진다.**
               `.value` 만 읽고 `.source` / `.confidence` 를 읽지 않는다.
               받는 칸이 `ProductIdentityDna.color: string | null` (:65)
               — source 를 담을 자리 자체가 없다.
  ↓
packages/shared/src/product-identity-dna.ts:219 productFactsFromIdentityDna
    :229   colorText: dna.color          ← 이미 맨 문자열. 옮겨 담기만 한다
  ↓  ProductFacts.colorText : string | null   (product-facts.ts:590)
apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts:363
    facts: productFactsFromIdentityDna(input.dna)
  ↓
packages/crawler/src/comparison-search/cross-seller.ts:366  compareColor
    resolveColorHueGroups(x.colorText)    ← 판정기는 "BLUE"라는 글자만 본다.
                                            사람이 넣었는지 파서가 넣었는지 모른다.
```

```
[해외 경로 — 색상이 애초에 도달하지 않는다]

apps/admin/src/app/pipeline/CommerceWorkspace.tsx:2366
    <ComparisonShopSearch title brand sourceUrl sku description />   ← color 칸이 없다
  ↓  ComparisonShopSearch.tsx:311 → POST /api/comparison/search
apps/admin/src/app/api/comparison/search/route.ts:35-45
    identityDnaFromFields({ ..., color: body.color, ... })
       🔴 body.color 는 **언제나 undefined** (3.2-C §0-1)
  ↓
packages/shared/src/product-identity-dna.ts:300 identityDnaFromFields
    :313   const color = input.color?.trim() || null;
       🔴 입력이 이미 맨 문자열이다 — provenance 는 **HTTP 경계에서**
          (화면이 값을 안 보내기 전에) 이미 없다.
```

### 1-2. 이것이 ① 구현 가능성에 뜻하는 것

```
판정기(compareColor)에서 USER_EDITED 를 거르는 것은 **불가능하다** —
그 함수는 출처를 모른다. 타입에 칸이 없다.

거를 수 있는 유일한 지점은 provenance 가 **아직 살아 있는 마지막 함수**,
즉 product-identity-dna.ts:186 의 buildProductIdentityDna 한 곳이다.
(해외 경로는 화면이 color 를 보내기 시작할 때 route.ts 가 같은 판단을 해야 한다 —
 오늘은 안 보내므로 해당 없음.)

즉 ① 은 "판정기 수정"이 아니라 "DNA 를 만들 때 한 줄"이다. 그래서 문턱/점수/충돌
구조를 건드리지 않는다. **단, 이번에 구현하지 않는다(지시).**
```

---

## 2. USER_EDITED 영향 범위 — color / sku / title

운영 DB `product_snapshots.workspace.canonicalProduct` · SELECT 전용 · 값 미출력.

### 2-1. 건수

| 필드 | 전체 283행 | dedup 68행 | 그중 값이 비어있지 않은 것 |
|---|---|---|---|
| `color` | **1** | **1** | 1 (= 430663) |
| `sku` | **1** | **1** | **0** (= 430663, 셀러가 지워서 빈 값) |
| `title` | **19** | **6** | 19 / 6 |
| (참고) `modelName` | 1 | 0 | 1 |
| (참고) `material` / `brand` | 0 | 0 | — |

```
color 의 전체 provenance 분포(283행)   ORIGINAL 159 · REQUIRED 85
                                       DETAIL_PAGE_REFERENCE 38 · USER_EDITED 1
```

### 2-2. 매칭에 쓰이는가

| 필드 | 판정기(`compareCrossSellerProducts`) | 후보 점수(`match.ts scoreCandidate`) | 검색어 |
|---|---|---|---|
| **color** | 🔴 **쓰인다** — `ProductFacts.colorText` → `compareColor` (COLOR 충돌/+1점) | 안 쓰임 | `coreTitleTokensOf` 가 제목에서 색 단어를 깎는 데 쓰임 |
| **sku** | 🟢 **안 쓰인다** — `productFactsFromIdentityDna:225` 가 `sellerSku` 칸에만 넣는데 `cross-seller.ts` 는 `sellerSku` 를 **0회** 참조한다. `brandModelCode` 는 sku 가 아니라 설명문 라벨 + URL slug 에서 만든다(`resolveBrandModelCode`) | 🔴 **쓰인다** — `match.ts:386` SKU 불일치 시 `score × 0.3`, `match.ts:415` 품번이 후보 slug 에 포함되면 `score ≥ 0.95` | 🔴 `buildDomesticShopQuery` 1순위 키워드 |
| **title** | 🔴 **쓰인다** — `coreTitleTokens`(TITLE 축 최대 2점) · `compareGarmentForm(x.title)` · `sameSellerDistinctListing` | 🔴 쓰인다 | 🔴 쓰인다 |

**이번 작업에서 color 외의 편집값을 차단하는 설계는 만들지 않았다(지시).** 위는
건수와 사용 여부만이다. 다만 사실 하나는 남겨 둔다 — **`title` 은 19행이 사람 손이
닿았고 매칭의 가장 무거운 축(최대 2점)이다.** color(1행)보다 표면적이 19배 넓다.

---

## 3. optionGroups 구조

### 3-1. 분포 (운영 DB dedup 68건)

```
optionGroups 배열 길이 (= 축 개수)
    0개  18건      옵션 정보 없음
    1개  50건
    2개 이상  0건   ← 색상 축과 사이즈 축을 동시에 가진 상품이 **한 건도 없다**

축 이름별 보유 상품 수
    Size 32 · Clothing size 12 · Color 5 · Title 1

색상 축(/colou?r/i)의 values 길이
    1개  5건 · 2개 이상  0건
```

### 3-2. 색상 축 5건 전부

| 판매처 | `Color` 값 | `color.value` (source) | variants |
|---|---|---|---|
| smallable 430651 | `Navy blue` | `Navy` (ORIGINAL) | 1 |
| **smallable 430663** | **`Lavender`** | **`BLUE` (USER_EDITED)** | 1 |
| smallable 409775 | `Pink` | `Pink` (ORIGINAL) | 1 |
| smallable 426478 | `Bleu jean` | (빈 값, DETAIL_PAGE_REFERENCE) | 1 |
| smallable 424671 | `Rouge cerise` | (빈 값, DETAIL_PAGE_REFERENCE) | 1 |

**5건 전부 `variants` 도 1개다.** 즉 이 값들은 "여러 변형 중 하나를 고른 것"이
아니라 "한 개짜리 목록"이다 — GATE 2-c ③ 참조.

### 3-3. 색상 외 옵션과 어떻게 구분되는가

```
구분하는 유일한 규칙은 **축 이름 문자열 정규식**이다. 값을 보지 않는다.

사이즈:  product-identity-dna.ts:153  resolveSizeRange
           product.optionGroups?.find(g => /size|사이즈|치수/i.test(g.name))
           ← 구현되어 있고 오늘 운영에서 발화한다

색상:    **구현이 없다.** ProductIdentityDna 에 색상 옵션을 담을 칸이 없다
         (`color: string | null` 한 칸뿐). optionGroups 의 색상은 매칭에
         한 번도 도달한 적이 없다(3.2-D §1-3).
```

축 이름은 경로마다 다르다(GATE 2-e 표). JSON-LD 경로는 원문 그대로(`Color`,
`Clothing size`), DOM 경로는 한국어로 정규화(`색상`, `사이즈`), 본문 텍스트 경로는
라벨 그대로(`Dress length` 같은 **치수 스펙**도 옵션 그룹으로 들어온다),
PrestaShop 경로는 `<select>` 라벨 또는 `option1` 같은 자동 이름.
**같은 배열이 네 가지 다른 것을 담는다.**

### 3-4. 여러 색 판매 사례 확보 여부 — 🔴 **못 찾았다**

GATE 2-a/b 그대로. 약 5,983 상품 / 8 판매처 / 2 카테고리에서 0건.
**이것이 STOP 사유다.**

---

## 4. 430663 × 세 후보 × 세 입력 = 9칸

```
질의   운영 DB 스냅샷 430663 (색상 외 다섯 칸은 route.ts:35-45 와 동일)
         title "Bobo Choses 26FW Straight Jogging Pants " (USER_EDITED)
         sku   ""  (USER_EDITED — 원본 AAA1804712 를 지웠다)
         color {"value":"BLUE","source":"USER_EDITED","confidence":1}
         optionGroups [{"name":"Color","values":["Lavender"]}]
입력   A = color.value("BLUE")   B = optionGroups("Lavender")   C = 색상 축 unknown
후보   bobochoses.com /products/{handle}.json 카탈로그 전문
         (AC060 은 suggest.json 모양으로도 돌렸고 **세 입력 모두 판정이 동일**했다)
판정   compareCrossSellerProducts — 저장소 함수 그대로, 수정 없음
```

### 4-1. 해외 질의 형태 (`identityDnaFromFields`) — 9칸

| 후보 | 입력 | verdict | corePoints | conflicts | blockers |
|---|---|---|---|---|---|
| **AC060** `straight jogging pants` **정답** | **A** | **CONFLICT** | 0 | `COLOR` 색상 PURPLE ↔ BLUE | 없음 |
| | **B** | **SAME** | **6** | 없음 | 없음 |
| | **C** | **SAME** | **5** | 없음 | 없음 |
| **AC058** `pop jogging pants` (블루) **오답** | **A** | **SAME** ❌ | **5** | 없음 | 없음 |
| | **B** | **CONFLICT** | 0 | `COLOR` 색상 BLUE ↔ PURPLE | 없음 |
| | **C** | **PRESUMED_SAME** | 4 | 없음 | 없음 |
| **AC163** `pop jogging pants` (옐로) **오답** | **A** | **CONFLICT** | 0 | `COLOR` 색상 YELLOW ↔ BLUE | 없음 |
| | **B** | **CONFLICT** | 0 | `COLOR` 색상 YELLOW ↔ PURPLE | 없음 |
| | **C** | **PRESUMED_SAME** | 4 | 없음 | 없음 |

축 내역(참고):

```
AC060  A  axes 없음 (충돌이면 점수를 계산하지 않는다 — cross-seller.ts:528)
       B  TITLE+2(jogging/straight) CATEGORY+1(PANTS) COLOR+1(PURPLE) MATERIAL+1 FIT+1  = 6
       C  TITLE+2                   CATEGORY+1                        MATERIAL+1 FIT+1  = 5
AC058  A  TITLE+1(일부 jogging)     CATEGORY+1       COLOR+1(BLUE)    MATERIAL+1 FIT+1  = 5  ◀ 색상이 정원을 채웠다
       C  TITLE+1                   CATEGORY+1                        MATERIAL+1 FIT+1  = 4
AC163  C  TITLE+1                   CATEGORY+1                        MATERIAL+1 FIT+1  = 4
```

### 4-2. 읽히는 것 — "어떤 입력이 잘못된 CONFLICT/오답 SAME 을 만드는가"

```
A (사람이 넣은 값)
   잘못된 CONFLICT  1건  ← AC060. 정답을 색상 충돌로 죽인다
   오답 SAME        1건  ← AC058. 후보의 blue 와 맞아 COLOR+1 로 정원을 채운다
   ▶ **두 방향 모두 틀린다.** 반증을 지어내고, 동시에 근거도 지어낸다.

B (optionGroups, 오늘의 1값 실데이터)
   잘못된 CONFLICT  0건 ·  오답 SAME  0건
   ▶ 이 세 쌍에서는 완벽하다. **다만 값이 2개가 되는 순간 AC058 이 SAME 이 된다
     (GATE 2-d). 그 입력을 만드는 페이지를 못 찾았으므로 안전성은 미검증이다.**

C (색상 축 unknown)
   잘못된 CONFLICT  0건 ·  오답 SAME  0건
   ▶ 정답만 SAME(5), 오답 둘은 PRESUMED_SAME(4)에서 멈춘다. 한 점 차이다.
     "색상이 없어서 오답이 통과한다"는 일은 이 세 쌍에서 일어나지 않았다.
```

### 4-3. 430663 운영 후보 5건 전체 (suggest.json, 오늘의 실제 검색 결과)

| 후보 | 후보 색 | `none`(오늘) | A | B | C |
|---|---|---|---|---|---|
| `b226ac060` straight jogging pants | lavender | SAME ✅ | CONFLICT ❌ | SAME ✅ | **SAME ✅** |
| `b226ac059` straight jogging pants | dark green | PRESUMED_SAME | CONFLICT | CONFLICT | **PRESUMED_SAME** |
| `b226ac061` straight jogging pants | electric blue | **SAME ❌** | **SAME ❌** | CONFLICT ✅ | **SAME ❌** |
| `b226ac162` jogging pants | beige | PRESUMED_SAME | CONFLICT | CONFLICT | **PRESUMED_SAME** |
| `b324ed011` straight leg jogger | the grey | CONFLICT | CONFLICT | CONFLICT | CONFLICT |

> 🟡 `b226ac061`(일렉트릭 블루)은 **오늘(`none`)도 이미 SAME 이다.** `C` 가 만든
> 오답이 아니라 **오늘 이미 있는 오답**이다. `A` 도 못 막는다(질의색 BLUE ↔ 후보색
> blue 라 오히려 통과시킨다). 이 한 건을 막는 것은 `B` 뿐인데, 그 `B` 는 GATE 2 가
> 미검증이다. **① 이 이 오답을 고치지 않는다는 사실을 그대로 적는다.**

---

## 5. STOP 조건 다섯 항목

| # | 조건 | 해당 | 근거 |
|---|---|---|---|
| 1 | provenance 가 Matching 까지 보존되지 않음 | 🟡 **해당하나 무해** | `product-identity-dna.ts:186` 에서 사라진다(§1-1). **그러나 필터는 그 함수 안에서 걸면 되고**, 판정기를 건드릴 필요가 없다. ① 의 구현 가능성을 막지 않는다 |
| 2 | `optionGroups` 의 의미가 상품마다 달라짐 | 🔴 **해당** | 생성 경로 4개, 축 이름 규칙 서로 다름, 값의 뜻도 다름(구매 옵션 / 치수 스펙 / Shopify 자리표시자). 어느 경로로 만들어졌는지 저장되지 않는다(§3-3, GATE 2-e). 운영 DB에 이미 `Title=["Default Title"]`, `Size=["OS"]` 같은 비옵션 1값이 있다 |
| 3 | 단일값을 대표 색상이라고 확정할 근거 부족 | 🔴 **해당** | 값 1개는 원본이 한 색이어서가 아니라 **추출기가 축 없는 variant 를 버려서** 생긴 결과다(430663 원문 실측, GATE 2-c ③). 표본도 판매처 1곳·5건뿐이다 |
| 4 | 여러 색상 상품에서 `intersects()` 가 의도와 다르게 작동 | 🔴 **해당(코드)** / ⚪ **미관측(실데이터)** | 가상 2값에서 오답 AC058 이 CONFLICT → **SAME** 으로 뒤집히고 COLOR+1 까지 얻는다(GATE 2-d). 실제로 그런 페이지는 5,983 상품에서 0건 — **위험은 확인, 빈도는 미확인** |
| 5 | USER_EDITED 제거만으로 다른 정상 Matching 에 손실 발생 | 🟢 **해당 없음** | A→C 329쌍 중 달라진 것 3쌍, 전부 430663. SAME 손실 0건, 새 오답 SAME 0건(GATE 1) |

```
② optionGroups 배선 →  STOP 조건 2·3·4 해당.  **STOP 유지. 손대지 않았다.**
① USER_EDITED 제외   →  STOP 조건 5 해당 없음. 1 은 우회 가능.  §6 참조.
```

---

## 6. ① 안전성 입증됐는가

### 🟡 **조건부 YES — "기존 정상 판정에 손실을 주지 않는다"는 입증됐다. "매칭이 좋아진다"는 입증되지 않았다.**

지시서가 요구한 문장은 정확히

> `USER_EDITED` 를 Matching 에서 제외해도 **기존 정상 판정에 영향을 주지 않는다**

이고, 이 문장에 대한 답은 **YES** 다. 근거:

```
① 영향 표면이 산술적으로 닫혀 있다
   값이 있는 USER_EDITED 색상은 전 DB에 1건(430663). 나머지 67 상품의
   color.source 는 ORIGINAL / REQUIRED / DETAIL_PAGE_REFERENCE 뿐이고
   필터가 아예 닿지 않는다. "다른 상품에 무슨 일이 생길까"는 가정이 아니라
   **집합이 비어 있다**는 사실이다.

② 전수 재판정으로 확인했다
   329쌍 A→C:  달라진 쌍 3건(전부 430663) · SAME 손실 0 · 새 오답 SAME 0.

③ 지정 정상 SAME 3쌍이 그대로다
   430632↔ac018 · 430651↔ac043 · 430704↔ac117 — A=SAME, C=SAME.

④ 430663 안에서도 방향이 옳다
   정답 AC060  CONFLICT → SAME         (복구)
   오답 AC058  SAME     → PRESUMED_SAME (차단)
   오답 AC163  CONFLICT → PRESUMED_SAME (여전히 SAME 아님)
   오답 AC059/AC162  CONFLICT → PRESUMED_SAME (여전히 SAME 아님)

⑤ 구조를 건드리지 않는다
   문턱(SAME_MIN_AXES=5 / PRESUMED=3)·점수·충돌 목록·synonym 을 하나도
   바꾸지 않는다. 한 축이 "모름"이 될 뿐이고, 이 판정기는 "모름"과 "다름"을
   이미 구분하도록 설계돼 있다(compareColor:372 `left.size===0 → unknown`).
```

### 그럼에도 **NO** 라고 적어야 하는 것들

```
🔴 표본이 1건이다. "USER_EDITED 색상을 빼도 안전하다"는 명제를 일반화한 근거는
   1건의 관측이 아니라 **"현재 DB에 1건밖에 없다"는 사실**이다. 앞으로 셀러가
   색상을 더 고치면 그때마다 같은 질문이 새로 생긴다. 이 조사는 "지금 배선해도
   오늘의 판정이 안 깨진다"를 말할 뿐, "사람 입력은 틀린다"를 말하지 않는다.
   실제로 셀러가 파서보다 정확한 경우가 있을 수 있고, 그 반례는 이 DB에 없다.

🔴 국내 경로(= USER_EDITED 색상이 유일하게 살아 있는 경로)에서의 효과는
   **측정되지 않았다.** buildProductIdentityDna 형태로 돌리면 세 쌍 모두
   MATERIAL 보류에 걸려 A/B/C 어느 입력에서도 SAME 이 안 된다(GATE 1-f).
   즉 이번 시뮬레이션이 입증한 것은 "해외 형태에서 안전하다"이고, 국내 형태에서는
   "안전하다"가 아니라 "이 표본으로는 아무 차이가 안 난다"이다.

🔴 ① 은 430663 의 오탐을 **다 고치지 못한다.** `b226ac061`(일렉트릭 블루)은
   오늘도, A 에서도, C 에서도 SAME 이다(§4-3). ① 은 이것을 건드리지 않는다.

🔴 ① 은 "BLUE" 라는 틀린 데이터를 고치지 않는다. 그 행은 그대로 남고, 고시정보
   등록 payload 에는 계속 "BLUE" 로 나간다. 이 조사는 READ ONLY 라 손대지 않았다.
```

### 결론

```
"USER_EDITED 를 Matching 에서 제외해도 기존 정상 판정에 영향을 주지 않는다"
  →  **입증됐다(YES).**

"그러므로 지금 구현해야 한다"
  →  **이 조사는 그 말을 하지 않는다.** 지시대로 구현하지 않았고, 구현 여부는
      별도 작업으로 분리한다. 배선 지점은 product-identity-dna.ts:186 한 곳이다.
```

---

## 7. 확인하지 못한 것

1. **한 페이지에서 여러 색을 파는 상품.** 8 판매처 · 약 5,983 상품 · 2 카테고리에서
   0건. 접근이 막힌 곳(babyshop 403, 다수 Shopify 429/403)은 보지 못했다.
   GATE 2-d 의 다중값 실험은 **가상 입력**이고, 그 입력을 만드는 실제 페이지는
   관측하지 못했다. **②의 가드는 여전히 가정 위에 있다.**
2. **국내 경로에서 ① 의 실효.** 세 쌍 모두 `MATERIAL` 보류(질의 3성분 ↔ 후보
   `cotton:17`)에 걸려 A/B/C 가 전부 PRESUMED_SAME 으로 수렴한다. 후보 본문이
   잘려 오는 것이 원인인지 국내 후보 파서 문제인지 가리지 않았다.
   `domestic_product_links` 의 `430663 → b226ac060`(`match_truth="SIMILAR"`,
   `match_type="REVIEW_REQUIRED"`) 한 줄이 색상 충돌의 결과인지는 3.2-D §7-5
   그대로 **여전히 미해결**이다.
3. **bobochoses / junioredition 의 `optionGroups` 가 어느 경로로 만들어졌는지.**
   DB에는 `Clothing size(6값) variants=6` 처럼 `extractProductGroupOptions`
   출력 모양으로 들어 있는데, **오늘 정적 HTML 에는 `ProductGroup` JSON-LD 가
   없다**(실측: 4개 URL 전부 `"@type":"ProductGroup"` 문자열 부재). 운영은
   Playwright 렌더 후 HTML 을 쓰므로 렌더 시점에 주입되는 것으로 보이지만,
   **브라우저를 띄워 재현하지 않았다.** GATE 2-e 의 "경로가 4개"는 코드 근거이고
   이 두 호스트의 실제 경로는 미확정이다.
4. **`430663` 편집의 동기와 시각.** 3.2-D §7-2 그대로 — `audit_log` 에 필드 편집
   이벤트 타입 자체가 없다.
5. **`title` 19건(USER_EDITED)의 매칭 영향.** 쓰인다는 것만 확인했고(§2-2),
   쌍별 영향은 측정하지 않았다(지시 범위 밖).
6. **프랑스어 색상.** `Bleu jean` / `Rouge cerise` 는 `COLOR_HUE_WORDS`(영/한만)에
   없어 어느 입력에서도 "모름"이다. 3.2-D §5-⑥ 그대로 남아 있다.
7. **표본 규모 차이.** 3.2-D 는 659쌍, 이번은 329쌍이다. 후보 모양을 1종(운영
   suggest)만 썼기 때문이고, 지정된 3쌍은 카탈로그 모양으로 교차검증해 판정이
   일치함을 확인했다. 하지만 **전 모집단을 두 모양으로 다 돌리지는 않았다.**

---

# CPO 판정 (2026-09-14)

```
MATCHING-3.2-E

GATE 1   USER_EDITED color 제외
         → 안전성 긍정적
         → SAME 손실 0
         → 오답 SAME 신규 0
         → 그러나 표본 1건
         → ⏸ 구현 보류

GATE 2   optionGroups
         → 다중값 의미 미검증
         → 🛑 STOP

NEXT     MATCHING-3.2-F
         → variant extraction loss 조사
```

## 보류 이유 (CEO 원문)

> `USER_EDITED` 1건만 제거해도 `AC061` 오탐 문제는 해결되지 않고,
> 더 중요한 구조 문제인 **variant 정보 손실**을 먼저 해결해야 한다.

## ⚠️ 내리면 안 되는 결론

> **"optionGroups가 더 정확하다"는 결론을 내리면 안 된다.**
>
> 현재 실측이 말하는 것은 여기까지다 —
> *현재 추출된 `optionGroups`가 `color.value`보다 **430663 사례에서** 안전했다.*
>
> 그런데 `optionGroups` 자체가 원본 variant를 완전히 표현하지 못한다는 새 사실이
> 나왔다(`430663`의 두 번째 variant가 `url`만 있어 추출기에서 버려진다).
> 지금 `optionGroups`를 권위로 올리는 것은 **또 다른 데이터 손실을 권위화하는 위험**이다.

## 순서

```
③ variant extraction loss 규명  →  검증  →  그 다음에 ①/② 최종 결정
```
