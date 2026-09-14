# MATCHING-3.2-D · COLOR SOURCE AUTHORITY (READ ONLY)

- 지시: CEO, 2026-09-14 · 실측 2026-09-14, 브랜치 `main`, 시작/종료 HEAD `8aecc02`
- **코드 0줄 수정. 커밋 0건. DB write 0건(SELECT만).** 임시 스크립트는 저장소 밖
  (`node_modules/.mi-scratch`, gitignore 대상)에서 돌리고 지웠다. `docs/beta-security-3-*`
  는 미추적 그대로 두었다.
- 직전 조사 `docs/matching-3.2-c-query-evidence-audit.md` 의 호출 그래프(§0)를 재사용했고
  재조사하지 않았다.

---

## 0. 한 줄 결론

```
두 필드는 서로 다른 것을 뜻하지 않는다. 둘 다 "이 리스팅 한 장의 색"을 말한다.
다른 것은 출처다 —  optionGroups = 원본 JSON-LD 의 schema.org color (원문 그대로)
                    color.value   = 제목/설명문을 정규식으로 훑은 추출값 + 사람이 덮어쓸 수 있는 칸

430663 의 "BLUE" 는 파서 오류가 아니다. `source:"USER_EDITED", confidence:1` —
사람이 손으로 넣은 값이고, 원본 페이지 어디에도 "blue" 라는 글자가 없다.
```

저장소 자신의 타입 주석이 이미 우선순위를 못 박아 두었다
(`packages/shared/src/product-types.ts:305-308`, `color` 필드 위):

> *"옵션(Color 그룹)과 별개로 … **옵션에 색상 그룹이 있으면 그쪽이 우선(더 정확함)** —
> 이 필드는 옵션이 없는 단일 색상 상품, 또는 고시정보처럼 '대표 색상 하나만'
> 필요한 곳에 쓴다."*

즉 "어느 쪽이 참인가"는 **이미 답이 적혀 있었다**. 문제는 그 우선순위가
`buildProductIdentityDna`/`identityDnaFromFields` 어디에도 **구현돼 있지 않다**는 것이다.
그리고 **운영 커버리지가 정반대다** — `color.value` 44/67, `optionGroups` 5/67.

---

## 1. 두 필드의 생성·저장·소비 경로 (파일:함수)

### 1-1. `canonicalProduct.color.value` — "추출값 + 사람이 고칠 수 있는 칸"

```
원본 HTML
 → packages/crawler/src/product-data-extractor.ts:540 extractProductData
      productData.description  ← jsonLd.description (Smallable: ProductGroup.description)
      productData.title        ← jsonLd.name        (Smallable: hasVariant[0].name)
   ⚠ 이 단계는 color 를 **아예 읽지 않는다.** ExtractedProductData 에 color 칸이 없다.
 → apps/admin/src/app/api/pipeline/canonical-product.ts:105
      const resolvedColor = extractColor(productData.description)
                         ?? extractColorFromTitle(productData.title);
 → packages/crawler/src/description-facts.ts:112 extractColor
      ① COLOR_PATTERNS  /colou?r\s*[-:]\s*(...)/i     "Colour - Green"
      ② COLOR_LEADING_WORD_PATTERN                    설명문 맨 앞 "Beige sweatshirt."
        (수식어 1개까지, KNOWN_COLOR_WORDS 화이트리스트)
 → packages/crawler/src/description-facts.ts:127 extractColorFromTitle
      ③ COLOR_TITLE_PATTERN  제목 어디서든 화이트리스트 단어 하나
 → canonical-product.ts:161
      color = { value, source: "ORIGINAL", confidence: 0.7 }   ← 찾았을 때
            | { value: "", source: "REQUIRED", confidence: 0 } ← 못 찾았을 때
 → 화면(ProductEditor)에서 셀러가 고치면 source: "USER_EDITED", confidence: 1
```

**부가 필드:** `ProvenanceField<string>` — `source`(ORIGINAL/USER_EDITED/REQUIRED/
DETAIL_PAGE_REFERENCE/DEFAULT)와 `confidence`(0 / 0.7 / 1)를 갖는다.
이 조사의 결정적 단서가 바로 이 두 칸이다.

실측(운영 DB 44건, `color.value` 가 비어있지 않은 것):

| 재현된 규칙 | 건수 |
|---|---|
| ① 또는 ② — 설명문에서 나옴 | 28 |
| ③ — 제목 화이트리스트에서 나옴 | 14 |
| 저장값을 현재 데이터로 재현 불가 | **2** |

재현 불가 2건:

```
430663  stored "BLUE" (USER_EDITED)  desc→없음  title→없음   ◀ 이번 조사의 대상
430649  stored "Blue" (ORIGINAL)     desc→없음  title→없음
        원인: 셀러가 title 을 "보보쇼즈 26FW 비스트 태그 폴로 스웻셔츠 블루"(한국어)로
        바꿨다. 저장된 "Blue" 는 그 이전 영문 제목에서 뽑힌 값이고 지금은 고아다.
```

> **부수 발견:** `color.value` 는 title 파생인데 title 은 셀러가 자유롭게 고친다.
> 제목을 고쳐도 색상은 따라 바뀌지 않는다 — 두 칸 사이에 어떤 재계산도 없다.

### 1-2. `optionGroups` — "원본이 선언한 변형 축의 값"

```
원본 HTML(JSON-LD)
 → packages/crawler/src/product-data-extractor.ts:192 extractProductGroupOptions
      findProductGroupNode:  @type "ProductGroup" + hasVariant[] 을 찾는다
      각 hasVariant 에서     v.color → axes["Color"]     ← schema.org color, 원문 그대로
                            v.size  → axes["Size"]
                            additionalProperty(PropertyValue[])
      축을 하나도 못 읽은 variant 는 **건너뛴다**(지어내지 않는다)
      축 이름별로 등장한 값의 합집합 → optionGroups[{name, values}]
 → 같은 파일:561  resolvedOptionGroups
      ProductGroup 이 있으면 최우선, 없으면 DOM <select>(extractOptionsFromDom),
      그것도 없으면 본문 텍스트 스캔(extractOptionsFromDescriptionText)
 → 같은 파일:621  productData.optionGroups
 → apps/admin/src/app/api/pipeline/canonical-product.ts:185
      optionGroups: productData.optionGroups ?? []      ← 가공 없음. ProvenanceField 아님.
```

PrestaShop 사이트는 별도 경로
(`packages/crawler/src/site-strategies/prestashop.site-strategy.ts:296-314` —
`<select>` 이름 + `combinations` 값의 합집합).

**부가 필드 없음.** `optionGroups` 는 `ProvenanceField` 가 아니라 맨 배열이다 —
`source`/`confidence` 가 없고, **셀러가 편집기로 고칠 수 있는 칸도 아니다**
(`CanonicalProductVariant` 쪽에만 `skuSource`/`priceSource` 가 있다).
그래서 사람 손이 닿을 수 없고, 그래서 원본과 항상 일치한다.

### 1-3. 매칭에 실제로 도달하는 것 — **`color.value` 하나뿐이다**

| 경로 | 함수 | colorText 에 들어가는 것 |
|---|---|---|
| **국내 가격 확인(배치·실시간)** | `packages/shared/src/product-identity-dna.ts:184` `buildProductIdentityDna` | `product.color.value.trim() \|\| null` — **오늘 운영에서 살아 있다** |
| **해외 비교 검색** | 같은 파일:300 `identityDnaFromFields` | `input.color` — 화면이 안 보내므로 **항상 null**(3.2-C §0-1) |
| 후보(Shopify) | `packages/crawler/src/comparison-search/seller-facts.ts:118` | `extractLeadingColorPhrase(body) ?? extractColor ?? extractColorFromTitle` |

**`optionGroups` 는 매칭에 한 번도 도달하지 않는다.** `buildProductIdentityDna` 가
`optionGroups` 를 읽는 곳은 딱 한 군데, **사이즈 축뿐**이다:

```ts
// product-identity-dna.ts:153
function resolveSizeRange(product: CanonicalProduct): string[] {
  const group = product.optionGroups?.find((g) => /size|사이즈|치수/i.test(g.name));
  return group ? [...group.values] : [];
}
```

`ProductIdentityDna` 에는 `color: string | null` 한 칸만 있고 색상 옵션을 담을 자리가 없다.

### 1-4. 국내/해외 경로의 색상 취급 차이

```
국내 (buildProductIdentityDna)     colorText = canonicalProduct.color.value      ← 발화 중
해외 (identityDnaFromFields)       colorText = 화면이 보낸 body.color = 항상 null ← 사문
둘 다                              optionGroups 의 색상은 읽지 않는다
```

국내 경로는 `apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts:363`
에서 `facts: productFactsFromIdentityDna(input.dna)` 로 판정기까지 그대로 들어간다.
즉 **`430663` 의 "BLUE" 는 이론상의 위험이 아니라 국내 경로에서 이미 살아 있는 값이다.**

---

## 2. 충돌 실태 전수 (운영 DB · SELECT만 · 값 출력은 색상값에 한정)

대상: `product_snapshots.workspace.canonicalProduct` (283행).
색상 옵션 그룹 판정 = 그룹 이름이 `/colou?r/i` 에 걸리는 것.

### 2-1. `source_url` 중복 제거 기준 (67건 — 3.2-C §0-4 와 같은 모집단)

| 상태 | 건수 | 비율 |
|---|---|---|
| 둘 다 있음 · **같은 색 묶음** | 2 | 3.0% |
| 둘 다 있음 · **다른 색 묶음** | **1** | **1.5%** |
| `color.value` 만 있음 | 41 | 61.2% |
| `optionGroups` 색상만 있음 | 2 | 3.0% |
| 둘 다 없음 | 21 | 31.3% |
| **합** | 67 | |

```
색상을 하나라도 말할 수 있는 질의     color.value 기준 44/67 (66%)
                                    optionGroups 기준  5/67 ( 7%)
                                    둘 중 아무거나      46/67 (69%)
```

### 2-2. 원본 283행 기준(같은 상품의 여러 스냅샷 포함)

| 상태 | 건수 |
|---|---|
| 둘 다 있음 · 같음 | 4 |
| 둘 다 있음 · 다름 | 1 |
| `color.value` 만 | 155 |
| `optionGroups` 색상만 | 16 |
| 둘 다 없음 | 107 |

`color` 필드의 provenance 분포(283행):

```
ORIGINAL      159  (값 있음)
REQUIRED       85  (빈 값)
DETAIL_PAGE_REFERENCE  38  (빈 값)
USER_EDITED     1  (값 있음)   ◀ 전 DB에 단 하나. 그것이 430663 이다.
```

### 2-3. "둘 다 있음" 5건(dedup 3건) 전부

| 상품 | `color.value` (source) | `optionGroups` Color | 색 묶음 | 판정 |
|---|---|---|---|---|
| smallable 430651 B.C. Zipped Sweatshirt | `Navy` (ORIGINAL) | `Navy blue` | BLUE ↔ BLUE | 같음 |
| smallable 409775 Liewood Swimsuit | `Pink` (ORIGINAL) | `Pink` | PINK ↔ PINK | 같음 |
| **smallable 430663 Ample Joggers** | **`BLUE` (USER_EDITED, conf 1)** | **`Lavender`** | **BLUE ↔ PURPLE** | **다름** |

`optionGroups` 색상만 있는 2건(dedup):

```
smallable 424671  Short ample Tom rayé   Color=["Rouge cerise"]   color.value 빈 값
smallable 426478  Bermuda Denim Conrad   Color=["Bleu jean"]      color.value 빈 값
   → 둘 다 프랑스어 표기. KNOWN_COLOR_WORDS(영어 화이트리스트)에 없어 파서가 못 잡았다.
     resolveColorHueGroups 도 못 읽는다(hue 목록 역시 영어/한국어뿐) — optionGroups 를
     써도 이 둘은 매칭에서 여전히 "모름"이다.
```

### 2-4. 색상 옵션 그룹은 **판매처가 한 곳뿐**이다

옵션 그룹 이름을 호스트별로 전수(dedup 67):

```
www.smallable.com              Color 5
bobochoses.com                 Clothing size 12
www.junioredition.com          Size 28 · Title 1
designerkidswear.com           Size 1
houseofkids.com                Size 1
www.theanimalsobservatory.com  Size 1
www.babyshop.com / www.childrensalon.com   (옵션 없음)
```

**색상 축을 가진 호스트는 smallable.com 뿐이다.** 그리고 그 5건 모두 **값이 정확히 1개**다
(값 개수 분포: `1 → 5건`, 2개 이상은 0건).

> 이것이 CEO가 경계한 지점에 대한 답이다. **이 데이터에서 `optionGroups` 는 "구매 가능한
> 변형 목록"이 아니다 — "이 리스팅 한 장의 색" 이다.** 근거는 §3 에 있다.
> 다만 **타입은 여러 값을 담을 수 있고**(추출기가 `hasVariant` 전체의 합집합을 만든다),
> 한 페이지에서 여러 색을 파는 판매처가 들어오면 그 순간 의미가 달라진다. §5 참조.

---

## 3. 원본 페이지 검증 — 430663 의 "BLUE" 는 어디서 왔는가

### 3-1. 원본이 실제로 말하는 것 (라이브, 2026-09-14, HTTP 200)

`https://www.smallable.com/en/product/bobo-choses-organic-cotton-ample-joggers-lavender-bobo-choses-430663`
의 JSON-LD 전문(발췌 없이 구조 그대로):

```json
{"@type":"ProductGroup",
 "name":"Bobo Choses Organic Cotton Ample Joggers",
 "variesBy":"https://schema.org/color",          ◀ 변형 축은 '색'이라고 원본이 선언한다
 "description":"  SIZE AND FIT  Loose fit  COMPOSITION  17% Cotton, 66% Organic Cotton,
                 17% Recycled Cotton  …  Made in Spain  ",
 "hasVariant":[
   {"@type":"Product",
    "name":"Bobo Choses Organic Cotton Ample Joggers | Lavender",
    "model":"430663", "sku":"AAA1804712", "color":"Lavender",
    "offers":{"price":"98784","priceCurrency":"KRW","availability":"InStock"}},
   {"url":"…/bobo-choses-organic-cotton-ample-joggers-navy-blue-bobo-choses-430664"}
 ]}
```

읽히는 사실:

```
① 이 페이지가 파는 것은 Lavender 한 가지다. sku AAA1804712, model 430663.
② 다른 색(430664)은 **별도 URL**이고, 이 페이지의 JSON-LD 에는 링크만 있다
   (color 도 sku 도 없다 → extractProductGroupOptions 가 축 없음으로 건너뛴다).
③ 그래서 optionGroups = [{name:"Color", values:["Lavender"]}] 이고,
   variants = [{id:"variant-0", sku:"AAA1804712", optionValues:{Color:"Lavender"}}] 이다.
   ⇒ 이 값은 "대표 색상"과 "변형 목록"이 **한 값으로 일치하는** 자리다.
④ 페이지 전체(728KB)에 상품 색을 뜻하는 "blue" 는 없다.
   `<title>`/`og:title` 도 "Bobo Choses - Bobo Choses Organic Cotton Ample Joggers -
   Lavender | Smallable".
   BreadcrumbList 마지막도 "… | Lavender".
```

형제 색상 430664 도 확인했다(라이브, HTTP 200): `color: "Navy blue"`, sku `AAA1804718`.

### 3-2. 그렇다면 "BLUE" 는 어디서 왔나 — **사람이다**

`430663` 스냅샷(`0c1a1b23-…-f8a03ea277c2`)의 필드별 provenance 전수:

```
USER_EDITED   color         = "BLUE"                               (confidence 1)
USER_EDITED   title         = "Bobo Choses 26FW Straight Jogging Pants "
USER_EDITED   sku           = ""                     ◀ 원본 AAA1804712 를 지웠다
USER_EDITED   manufacturer  = "Bobo Choses"
ORIGINAL      brand/description/material/price/countryOfOrigin …
(optionGroups 는 ProvenanceField 가 아니라 목록에 뜨지 않는다 — 사람이 고칠 수 없는 칸)
```

즉 셀러가 등록 화면에서 **제목을 새로 쓰고, 판매처 SKU를 지우고, 색상을 직접 입력**했다.
파서는 이 자리에 손댄 적이 없다:

```
extractColor(description)   → undefined   (설명문에 색 단어 없음, §3-1 참고)
extractColorFromTitle(현재 제목)  → undefined   ("Straight Jogging Pants" 에 색 단어 없음)
extractColorFromTitle(원본 제목)  → "Lavender"  ("… | Lavender", lavender 는 화이트리스트에 있다)
```

> **파서가 정상 동작했다면 `color.value` 는 "Lavender" 였을 것이다.** 제목을 바꾼 그
> 편집이 그 경로를 끊었고, 그 자리에 사람이 "BLUE" 를 넣었다.

**"BLUE" 가 오류인지 다른 의미인지:**

```
오류다. 다른 의미가 아니다.
근거 ①  원본·형제색·이미지 어디에도 이 상품을 blue 라 부른 표기가 없다
        (3.2-C §1-3 이미지 실측: 질의 이미지는 라벤더 와이드 스트레이트).
근거 ②  이 저장소에 "색 계열 분류" 라는 개념을 담는 칸은 없다.
        색 계열(hue group)은 비교 시점에 resolveColorHueGroups 가 계산할 뿐,
        저장되지 않는다 — 사람이 계열을 적어 넣을 칸이 아니다.
근거 ③  대문자 "BLUE" 는 파서 출력 모양이 아니다. 파서는 원문 대소문자를 그대로
        옮긴다("Navy", "Pink", "Blue", "grey"). 전 DB에서 전대문자는 이 한 건뿐이다.
```

**동기는 확인하지 못했다.** `audit_log` 에 필드 편집 이벤트 타입 자체가 없다
(102행 전부 AUTH_* / IMPERSONATION_* / MARKETPLACE_REGISTERED). 형제 색상 430664 가
"Navy blue" 라는 사실은 혼동 가설과 모순되지 않지만, **증거가 아니다.**

---

## 4. 쌍별 정확도 비교 — `color.value` 기준 vs `optionGroups` 기준

### 4-1. 측정 방법

```
질의   운영 DB 스냅샷의 다섯 칸(title/brand/sourceUrl/sku/description)을
       route.ts:35-45 와 글자 그대로 동일하게 구성.
       거기에 body.color 만 세 가지로 바꿔 넣는다:
         none        = 오늘의 운영 (화면이 안 보냄)
         colorValue  = canonicalProduct.color.value
         og          = optionGroups 의 Color 값
후보   bobochoses.com /search/suggest.json?q={title}&resources[limit]=5
       = searchOneShop(index.ts:190) 이 도메인만 등록되면 만들 그 후보 그대로.
판정   compareCrossSellerProducts(질의facts, 후보facts)   ← 저장소 함수 그대로, 수정 없음
```

교차검증: 같은 9쌍을 `/products/{handle}.json`(카탈로그 전문) 모양으로도 돌렸고
**세 기준 모두 판정이 완전히 일치**했다.

### 4-2. 지시서가 지정한 쌍

| 정답성 | 쌍 | `none`(오늘) | `colorValue` | `optionGroups` |
|---|---|---|---|---|
| ✅정답 | 430632 ↔ `b226ac018` | PRESUMED_SAME | **SAME** ✅ | PRESUMED_SAME ⚪(데이터 없음) |
| ✅정답 | 430651 ↔ `b226ac043` | PRESUMED_SAME | **SAME** ✅ | **SAME** ✅ |
| ✅정답 | 430704 ↔ `b226ac117` | PRESUMED_SAME | **SAME** ✅ | PRESUMED_SAME ⚪(데이터 없음) |
| ✅정답 | 430663 ↔ `b226ac060` | SAME | **CONFLICT(COLOR)** ❌ | **SAME** ✅ |
| ✅정답(골든) | 430701 ↔ `b226ac114` | PRESUMED_SAME | PRESUMED_SAME ⚪ | PRESUMED_SAME ⚪(데이터 없음) |
| ❌오답 | 430651 ↔ `b226ac042` | PRESUMED_SAME | **CONFLICT(COLOR)** ✅ | **CONFLICT(COLOR)** ✅ |
| ❌오답 | 430663 ↔ `b226ac163` | PRESUMED_SAME | **CONFLICT(COLOR)** ✅ | **CONFLICT(COLOR)** ✅ |
| ❌오답 | 430663 ↔ `b226ac058` | PRESUMED_SAME | **SAME** ❌ | **CONFLICT(COLOR)** ✅ |
| ❌다른상품 | 430632 ↔ `B226AD013` | PRESUMED_SAME | **CONFLICT(COLOR)** ✅ | PRESUMED_SAME ⚪(데이터 없음) |
| ❌다른상품 | `B226AC042` ↔ `B226AC043` | — | CONFLICT(COLOR + MODEL_CODE) — 후보끼리라 두 기준 모두 해당 없음 | |

```
정답을 맞힌 수 / 오답을 막은 수 (⚪ = 그 기준이 색을 모름 → 오늘과 같음)

colorValue     맞힘 3  ·  막음 3  ·  **틀림 2**  ·  모름 1
optionGroups   맞힘 2  ·  막음 3  ·  **틀림 0**  ·  모름 4
```

**`colorValue` 의 틀린 2건은 둘 다 `430663` 한 행에서 나온다** — 정답
`b226ac060`(라벤더)을 죽이고 오답 `b226ac058`(블루)을 살렸다. 그 한 행을 빼면
`colorValue` 는 8쌍 중 틀린 것이 없고, `optionGroups` 가 아무 말도 못 하는
4쌍에서 정답 2건·차단 1건을 더 얻는다.

### 4-3. 가장 날카로운 자리 — 같은 상품의 세 가지 색

`430663`(라벤더 스트레이트 조거)의 **운영 검색 결과 5건 전부**, 기준별 판정:

| 후보 | 후보 색 | `none` | `colorValue`(BLUE) | `optionGroups`(Lavender) |
|---|---|---|---|---|
| `b226ac060` straight jogging pants | lavender | SAME | **CONFLICT** ❌ | **SAME** ✅ |
| `b226ac059` straight jogging pants | dark green | PRESUMED_SAME | CONFLICT ✅ | CONFLICT ✅ |
| `b226ac061` straight jogging pants | electric blue | **SAME** ❌ | **SAME** ❌ | **CONFLICT** ✅ |
| `b226ac162` jogging pants | beige | PRESUMED_SAME | CONFLICT ✅ | CONFLICT ✅ |
| `b324ed011` straight leg jogger | the grey | CONFLICT(BRAND) | CONFLICT | CONFLICT |

```
오늘(none)          SAME 2건 — 라벤더(정답) + 일렉트릭블루(오답)  → 다른 색 가격이 섞인다
colorValue(BLUE)    SAME 1건 — 일렉트릭블루(오답)만 남는다        → 정확히 뒤집혔다
optionGroups        SAME 1건 — 라벤더(정답)만 남는다              → 세 색을 정확히 갈랐다
```

같은 이름·같은 소재·같은 핏의 **세 가지 색이 나란히 있는 자리**에서, 색상은 유일하게
구별이 가능한 축이다. `optionGroups` 는 세 줄을 정확히 갈랐다. `color.value` 는 **사람이
넣은 한 글자 때문에 정확히 반대로** 갈랐다.

### 4-4. 반대 방향 — `optionGroups` 가 아무것도 못 하는 자리

`430632`(All About Monsters 워시드 티셔츠, Blue) 의 운영 검색 결과 5건:

| 후보 | 후보 색 | `none` | `colorValue`(Blue) | `optionGroups`(없음) |
|---|---|---|---|---|
| `b226ac018` All About Monsters T-shirt | midnight blue | PRESUMED_SAME | **SAME** ✅ | PRESUMED_SAME |
| `b226ac004` All About Monsters T-shirt | light green | PRESUMED_SAME | CONFLICT ✅ | PRESUMED_SAME |
| `b226ad013` All About Monsters oversize T-shirt | light pink | PRESUMED_SAME | CONFLICT ✅ | PRESUMED_SAME |
| `b226ab048` Softpaw Monster **all over** T-shirt | light blue | PRESUMED_SAME | **SAME** ❌ | PRESUMED_SAME |
| `b226ab043` Mush Monster Duo **all over** T-shirt | blue | PRESUMED_SAME | **SAME** ❌ | PRESUMED_SAME |

`430632` 에는 `optionGroups` 색상이 없다(Smallable 이 이 상품은 ProductGroup 으로
내보내지 않는다) — 그래서 그 기준은 오늘과 똑같이 아무 일도 하지 않는다.
`colorValue` 는 정답 1건을 살리고 오답 2건(다른 프린트의 `ab` 라인 티셔츠)도 같이 살린다.
**색상은 프린트가 다른 같은 색 상품을 가르지 못한다** — 3.2-C §3-4 의 D 시나리오가
되살린 그 오탐이 정확히 이것이다.

### 4-5. 운영 모양 전수(67 질의 × suggest.json 5건 = 659쌍)

| 기준 | CONFLICT | SIMILAR | PRESUMED_SAME | **SAME** | UNKNOWN |
|---|---|---|---|---|---|
| none (오늘) | 507 | 49 | 66 | **27** | 10 |
| colorValue | 546 | 38 | 41 | **32** | 2 |
| optionGroups | 515 | 47 | 60 | **27** | 10 |
| 병합(og 우선, 없으면 colorValue) | 547 | 38 | 40 | **32** | 2 |

```
colorValue    SAME 신규 6 / 손실 1
              신규 중 확인된 정답 3 (430632↔ac018, 430651↔ac043, 430704↔ac117)
                     확인된 오답 2 (430632↔ab048, 430632↔ab043 — 다른 프린트)
                     자기 자신 1 (junioredition 질의 ↔ junioredition 후보, 동일 상품)
              손실 1 = 430663 ↔ b226ac060  ◀ 정답
optionGroups  SAME 신규 1 / 손실 1
              신규 = 430651 ↔ b226ac043 (정답)
              손실 = 430663 ↔ b226ac061 (오답, 일렉트릭블루)  ◀ 손실이 오히려 옳다
              → 잘못 판정한 쌍 0건
```

---

## 5. 권위 판정

### 🟡 **둘 다 옳다 — 단, 같은 것을 말하고 정확도가 다르다. 단일 권위는 결정하지 않는다.**

지시서가 제시한 세 갈래 중 "둘 다 옳음(용도가 다름)"에 가장 가깝지만, **용도가 다르지는
않다**. 실측으로 확정된 것과 확정되지 않은 것을 나눠 적는다.

**확정된 것**

```
① 두 필드는 이 데이터에서 같은 것을 뜻한다 — "이 리스팅 한 장이 파는 색".
   근거: Smallable 은 색마다 별도 URL 을 쓰고(430663 Lavender / 430664 Navy blue),
        JSON-LD variesBy=color 이며, DB의 색상 옵션 그룹 5건 전부 값이 정확히 1개다.
        즉 "대표 색상"과 "변형 목록"이 이 데이터에서는 같은 한 값으로 겹친다.
② 정확도는 optionGroups 가 위다. 원문 그대로이고, 사람이 고칠 수 없고,
   이 저장소의 타입 주석(product-types.ts:305)이 이미 그 우선순위를 선언해 뒀다.
③ 커버리지는 color.value 가 압도적으로 위다 — 44/67 대 5/67.
   optionGroups 색상은 판매처 한 곳(smallable.com)에서만, 그것도 5건만 나온다.
④ 두 값이 다른 경우는 전 DB에 1건이고, 그 1건은 사람이 넣은 값이다.
   즉 "파서 두 개가 서로 다른 답을 내는 구조적 충돌"은 존재하지 않는다.
```

**확정되지 않은 것 — 그래서 단일 권위를 못 박지 않는다**

```
⑤ optionGroups 가 "언제나 1개 값"이라는 것은 판매처 한 곳의 5건에서 관찰한 것뿐이다.
   타입도 추출기도 여러 값을 담을 수 있고(hasVariant 합집합), 한 페이지에서 여러 색을
   파는 판매처가 들어오면 그 순간 이 필드는 "변형 목록"이 되고 "이 상품의 색"이
   아니게 된다. 그때 resolveColorHueGroups 는 여러 묶음을 돌려주고,
   compareColor 의 intersects()는 "하나라도 겹치면 일치"라서 **충돌을 거의 말하지
   못하게 된다**(색상 축이 조용히 무력해진다). 이 시나리오를 실측할 데이터가 없다.
⑥ 두 기준 모두 프랑스어 색상을 못 읽는다(424671 "Rouge cerise", 426478 "Bleu jean").
   화이트리스트도 hue 목록도 영어/한국어뿐이다.
⑦ 정답/오답의 실측 근거(§4-2 의 정답성 열)는 3.2-C §2 의 이미지 육안 판정을
   그대로 이어받은 것이다. 새로 세지 않았다.
```

**질문의 형태 정정**

> 이 조사가 확인한 바로는 질문은 "어느 쪽이 참인가"가 아니다. 두 값은 같은 것을
> 말하고 있고, 어긋난 유일한 한 건은 데이터 사고다. 진짜 질문은 두 개다 —
> **(A) 사람이 손으로 덮어쓴 색상을 매칭이 권위로 써도 되는가**,
> **(B) 커버리지 5/67 짜리 원문값과 44/67 짜리 추출값을 어떻게 겹칠 것인가.**

---

## 6. 제안 (하나도 구현하지 않았다 · 판단 요청)

### 제안 1 — `color.value` 를 그대로 매칭에 쓰지 말고 **provenance 로 거른다**

`color` 는 `ProvenanceField` 다. 매칭은 그 칸을 보지 않고 값만 읽는다.
그런데 이 필드에는 **고시정보용으로 사람이 채워야 하는 칸**이라는 별도의 용도가 있고
(`canonical-product.ts:161` 의 `REQUIRED` 시작), 그 편집은 등록 payload 를 위한 것이지
매칭을 위한 것이 아니다. 전 DB에서 `USER_EDITED` 는 1건인데 **그 1건이 정답을 죽였다**.

> `source === "USER_EDITED"` 인 색상은 매칭 근거에서 뺀다(값이 아니라 출처로 거른다).
> 이것은 문턱/점수/충돌 구조를 하나도 건드리지 않는다 — 그 축이 "모름"이 될 뿐이다.
> 실측상 이 규칙 하나로 §4-2 의 틀린 2건이 모두 사라진다(430663 이 `none` 과 같아진다).

**반론도 같이 적는다:** 셀러가 파서보다 정확할 수 있다(오히려 그것이 편집의 목적이다).
이 제안은 "사람 입력은 틀린다"가 아니라 "**매칭은 사람이 고친 값에 기대면 안 된다**"는
주장이고, 1건짜리 표본으로 일반화한 것이다. 표본이 작다는 사실을 그대로 둔다.

### 제안 2 — 권위 순서를 **타입 주석대로** 구현한다 (`optionGroups` → `color.value`)

`product-types.ts:305` 가 이미 선언한 순서다. 구현되어 있지 않을 뿐이다.

```
buildProductIdentityDna.color = resolveColorOption(product) ?? product.color.value
   resolveColorOption = optionGroups.find(/colou?r/i) 의 값이 정확히 1개일 때만 그 값
                        (2개 이상이면 "변형 목록"이므로 색상 축을 아예 비운다 — §5-⑤ 방어)
```

실측 효과(659쌍 운영 모양): §4-5 의 "병합" 행. `colorValue` 단독 대비 **정답 손실 1건이
사라지고**(430663↔`b226ac060` 이 SAME 으로 돌아온다) 오답 `b226ac061` 도 함께 막힌다.
남는 오탐은 `430632` 의 `ab` 라인 2건인데, 그것은 색상으로 가를 수 없는 결함이다
(3.2-C §3-4 D 와 같은 것).

**다만 이 제안은 §5-⑤ 의 미검증 가정 위에 서 있다.** "값이 1개일 때만"이라는 가드가
그 가정을 데이터가 아니라 코드로 방어하는 형태이고, 그 가드가 옳은지는 여러 색을 한
페이지에서 파는 판매처가 실제로 들어와야 알 수 있다.

### 제안 3 — `430663` 한 행의 데이터 정정은 **매칭 배선과 분리한다** (사실 보고)

`430663` 의 `color.value` 는 원본과 다르다. 이 조사는 READ ONLY 라 고치지 않았다.
다만 **이 한 행을 고치는 것으로 §4 의 결론이 바뀌지는 않는다** — 고쳐도
`color.value` 의 커버리지(44/67)와 `optionGroups` 의 커버리지(5/67)는 그대로이고,
"사람이 덮어쓸 수 있는 칸을 매칭 권위로 쓰는가"라는 구조적 질문도 그대로 남는다.
**한 행을 고쳐서 실험 결과를 바꾸는 것은 이 저장소가 이미 여러 번 한 실수다.**

### 제안 4 — 색상 어휘가 영어에 묶여 있다 (사실 보고, 이번 결함과 별건)

`KNOWN_COLOR_WORDS`(description-facts.ts:78)와 `COLOR_HUE_WORDS`(product-facts.ts:103)
둘 다 영어/한국어뿐이다. 운영 DB의 프랑스어 Smallable 리스팅 2건은 어느 기준을 써도
색상이 "모름"이다. 어느 권위를 고르든 이 구멍은 남는다.

---

## 7. 확인하지 못한 것

1. **여러 색을 한 페이지에서 파는 판매처.** §5-⑤ 그대로. 운영 DB의 색상 옵션 그룹
   5건은 전부 값이 1개다. 2개 이상인 사례가 없어 `optionGroups` 가 "변형 목록"으로
   동작하는 모습을 한 번도 관측하지 못했다. 제안 2 의 가드는 그래서 **가정**이다.
2. **`430663` 편집의 동기.** `audit_log` 에 필드 편집 이벤트 타입 자체가 없어
   누가 언제 왜 "BLUE" 를 넣었는지 추적할 방법이 없었다. 형제 색상 430664 가
   "Navy blue" 라는 사실은 혼동 가설과 모순되지 않을 뿐, 증거가 아니다.
3. **`bobochoses.com` 카탈로그 전수 재측정.** 3.2-C §0-4 가 한 4,015건 전수를
   이번에는 하지 못했다 — `products.json?limit=250` 목록 응답은 `body_html` 과
   `product_type` 을 **주지 않아**(실측) 후보 facts 가 색상·소재·핏·카테고리 없이
   만들어진다. 개별 `/products/{handle}.json` 4,015회 호출은 돌리지 않았다.
   대신 **운영 모양(suggest.json)** 으로 67질의 × 5건 = 659쌍을 전수했고(§4-5),
   지시서가 지정한 9쌍은 카탈로그 전문 모양으로 교차검증해 판정이 일치함을 확인했다.
4. **`430651 ↔ b226ac042` 의 두 기준 일치.** 두 기준 모두 CONFLICT 로 막지만,
   그 이유는 질의 색이 BLUE(둘 다)이고 후보가 lavender 라서다. 이 쌍에서는 두
   기준이 갈리지 않아 **권위 비교에 기여하지 않는다**. 표에는 사실대로 남겼다.
5. **국내 경로에서 "BLUE" 가 이미 만든 피해.** `domestic_product_links` 에
   `430663 → b226ac060`(정답) 한 줄이 있고 `match_truth = "SIMILAR"`,
   `match_type = "REVIEW_REQUIRED"`(생성 2026-09-07, 갱신 2026-09-10)다.
   이 줄이 색상 충돌을 겪은 결과인지, 아니면 3.2-C §0-3 대로 국내 파서
   (`bobochoses-kr.ts`)가 `facts` 를 만들지 않아 판정이 아예 돌지 않은 결과인지
   **구분하지 못했다.** 색상 편집 시각도 알 수 없어(위 2) 선후 관계를 세우지 못했다.
6. **`optionGroups` 색상의 `variants` 쪽 이중 표현.** `430663` 의 `variants[0]` 에는
   판매처 SKU `AAA1804712` 가 살아 있는데(셀러가 `canonicalProduct.sku` 만 지웠다),
   매칭은 `variants` 를 읽지 않는다. 이 칸이 식별자 증거로 쓸 만한지는 보지 않았다.
