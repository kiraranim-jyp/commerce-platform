# MATCHING-2.0-REGRESSION · 430632 SAME 오탐

**등록일** 2026-09-13 · **등록자** CTO · **지시** CEO, 2026-09-13
**상태** 🟡 **판정기는 고쳤다 · 증거 배선이 남았다** (2026-09-14, MATCHING-3.2-B)
§10의 재개방 사유(후보 사이즈가 운영에 도달하지 않는다)는 여전히 참이다. 그 빈
자리를 사이즈가 아니라 **연령 라인**으로 메웠고, 후보 사이즈가 하나도 없는 운영
후보 모양에서 오탐 5건이 전부 SAME 아래로 내려간다(§11). 다만 **질의쪽 대상연령
증거가 운영에서 전달되지 않아** AUDIENCE 축 자체가 아직 발화하지 않는다 — 배선은
별건으로 남긴다(§11-4, STOP).
**차단 조건** 이 결함이 남아 있는 한 매칭 2.0을 최종 완료로 보고하지 않는다.

---

## 1. 왜 별건으로 등록하는가

`923ae6f`(MATCHING-2.0-INTEGRATION-3)가 `430701 ↔ B226AC049` 오탐을 막았다.
그 수정 과정의 실측에서 **같은 기전의 다른 사례**가 발견됐고, 그것이 이 문서다.

CEO 지시 원문:

> 430632 문제는 "별건"으로 묻어두지 말고 즉시 회귀 결함으로 등록·고정합니다.
> `B226AD013`까지 SAME으로 올라오는 문제가 남아 있다면 절대로 완료 처리하지 않습니다.

**"검색어 문제"로 종료하는 것을 금지한다.** 새 질의가 그 후보를 안 가져오게 되는 것은
해결이 아니다 — 검색이 우연히 가린 것과 판정기가 고쳐진 것은 다른 문제다.
(이 구분은 `430701 ↔ B226AC049`에서 이미 한 번 겪었다.)

## 2. 사례

```
Smallable 430632   "All About Monsters Washed T-shirt"
   ↓
B226AC018          ← 정답 (동일상품)
B226AD013          ← 등록 당시 오답으로 지목됨.  ⚠️ 실측으로 반증됨 — 아래 참고
```

### ⚠️ 2026-09-13 실측 정정 — `B226AD013`은 이 결함이 아니다

`14a7f7c` 회귀 측정에서 네 쌍을 라이브로 다시 쟀다. 결과:

```
430632 ↔ B226AC018   SAME       corePoints 8, conflicts/blockers 없음
430632 ↔ B226AD013   CONFLICT   AUDIENCE(ADULT↔KIDS) + COLOR(PINK↔BLUE)
```

**`B226AD013`은 이미 CONFLICT로 정상 배제되고 있다.** 등록 시점에 CEO가 지목한 핸들이
실제 오탐 대상과 달랐던 것으로 보인다. 이 줄을 고치지 않고 두면 다음 작업이
결함이 아닌 쌍을 쫓게 된다.

**실제 의심 대상은 이 둘이다**(2026-09-13 에이전트 실측, `923ae6f` 이후에도 SAME):

```
mush-monster-duo-all-over-t-shirt
softpaw-monster-all-over-t-shirt
```

이 두 쌍은 아직 **독립적으로 재측정되지 않았다** — 위 4쌍 회귀 밖이라 확인하지
못했다. 작업 시작 시 **가장 먼저 이 두 쌍의 verdict를 라이브로 재현**하고,
재현되지 않으면 이 결함 자체를 재정의하라. 재현 없이 고치지 않는다.

`923ae6f` 이후에도 430632의 SAME은 3건이며, 그중
`mush-monster-duo-all-over-t-shirt` / `softpaw-monster-all-over-t-shirt` 는
다른 상품으로 보인다(에이전트 실측, 2026-09-13).

## 3. 기전 — 430701과 **다르다**

| | 430701 ↔ B226AC049 | 430632 ↔ B226AD013 |
|---|---|---|
| 구별 신호 | 제목에 `sweatshirt` ↔ `hoodie` 가 **있었다** | 핵심명 자체의 판별력이 **약하다** |
| 해결 | `GARMENT_FORM` 축으로 해결됨 | ❌ 같은 방법으로 해결 안 됨 |
| 점수를 사 준 것 | 겹치는 말 `zipped` 하나 | 필러 토큰 `all` 하나 |

**`GARMENT_FORM`을 억지로 확장해서 적용하지 말 것.** 두 사례는 원인이 다르다.
CEO 지시: *"동일한 해결책을 억지로 적용하면 안 됩니다."*

공통 뿌리는 남아 있다:

> 상품을 구별하지 못하는 라인 공통 축(CATEGORY / MATERIAL / FIT / AUDIENCE / SIZE)만으로
> `SAME_MIN_AXES`(5)가 채워지고, 유일한 구별 축인 TITLE은 필러 토큰 하나만 겹쳐도
> 1점을 얻는다.

실측 근거(`923ae6f` 커밋 메시지 및 `cross-seller.ts` 주석):
bobochoses.com 카탈로그 3,000건 중 **여섯 상품이 글자 하나까지 같은 설명문을 공유**한다.
색상·소재·핏은 독립된 세 근거가 아니라 **한 문장을 세 번 센 것**이다.

## 4. 조사 방향 (확정 아님 — 실측으로 검증할 것)

1. **필러 토큰.** `all` / `over` / `washed` 같은 말이 TITLE 축에서 1점을 사 준다.
   `distinctive()`가 상품유형어만 걸러내고 있다 — 판별력 없는 말 전반을 다루지 못한다.
   카탈로그 전체에서 문서빈도를 실제로 세서 판단할 것(어휘 목록을 손으로 심지 말 것).
2. **TITLE 1점의 의미.** jaccard 0.14도 1점, 0.49도 1점이다. 이 단차가 옳은지.
3. **미사용 신호.** 가격(430701에서 A `€75=€75` / B `€75≠€85`로 실제로 갈렸다).
   단 세일·통화·국가 때문에 위험 — 신호로 쓸지 자체가 판단 대상이다.
4. **이미지 축은 현재 못 쓴다.** 실측 거리: 정답쌍 74 / 오답쌍 92 / **서로 다른 두 상품 54**
   — 순서가 뒤집혀 있다. 게다가 `match.ts:487`이 인자 없이 호출해 운영에서 발화한 적이 없다.

## 5. 하지 말 것

```
❌ "검색어를 고쳐서 후보가 안 나온다" 로 종료
❌ SAME_MIN_AXES 숫자 조정 (실측으로 무효 — 6으로 올려도 해당 상품들은 7점이라 전부 통과)
❌ 430632 / B226AD013 개별 하드코딩
❌ GARMENT_FORM 어휘 목록 확대  ← CEO가 이번 단계에서 명시적으로 금지
❌ 정답 쌍(430632 ↔ B226AC018)을 죽이는 수정
```

## 6. 완료 조건

1. `430632 ↔ B226AD013` 이 SAME이 **아니다** — 라이브 데이터로 확인.
2. `430632 ↔ B226AC018` 은 여전히 SAME이다 — 라이브 데이터로 확인.
3. `430701 ↔ B226AC114`(A) 회귀 없음.
4. 세 쌍 모두 실제 응답 픽스처로 회귀 테스트 고정.
5. 손으로 쓴 fixture는 증거로 불인정(이 저장소에서 세 번 사고가 났다).

## 7. 함께 재검토할 항목

- **`GARMENT_FORM`을 장기 확정하지 않는다** (CEO 판단, 2026-09-13).
  현재 형태 유지 조건:
  ```
  GARMENT_FORM 불일치 → SAME 금지 (보류)   ✅ 유지
  GARMENT_FORM 일치   → 점수 가산 ❌        ✅ 유지 (현재 구조 그대로)
  어휘 목록 확대                            ❌ 이번 단계 금지
  ```
  위험: 두 판매처가 같은 후드 스웨트셔츠를 각각 `hoodie` / `sweatshirt`로 부르면
  진짜 동일상품이 보류된다.
- **`430651 ↔ B226AC043`** 은 `923ae6f` 전후 모두 SAME인데 **진위를 확인하지 않았다.**

## 8. 정책 (CEO 확정, 2026-09-13)

> 텍스트·카테고리·소재·핏·오디언스가 **전부 동일할 수 있다**.
> 그러므로 "SAME을 어떻게 더 잘 계산할까"보다
> **"어떤 경우에 SAME을 선언하지 않아야 하는가"** 가 중요하다.
>
> 증거가 부족하면 → SAME이 아니라 PRESUMED / COMPARISON 이 기본값이다.

가격 사용 등급은 그대로 유지한다:

```
EXACT / STRONG            → 가격 판단 사용
PRESUMED / TEXT_CONFIRMED → 참고만
SIMILAR                   → 참고만
CONFLICT                  → 제외
```

---

## 9. 규명과 해결 (2026-09-14, 라이브 실측)

### 9-1. 오답 쌍은 몇 점을 어디서 받았나 — **어느 1점을 빼도 SAME이었다**

`430632 ↔ junioredition "Mush Monster Duo All Over Baby T-Shirt"` (라이브 재현):

```
TITLE+1(공유 토큰 "all" 하나) CATEGORY+1 COLOR+1 MATERIAL+1 FIT+1 AUDIENCE+1 = core 6
blockers 없음 · conflicts 없음 · identifierConfirmed false · titleOverlap 0.125
```

`SAME_MIN_AXES`가 5이므로 **6점에서 1점을 빼도 5점이라 여전히 통과한다.** 숫자로는
고칠 수 없는 자리였다(이 문서 §5의 "숫자 조정 금지"가 실측으로 다시 확인됐다).

### 9-2. 라인 공통 축의 정보량 — 카탈로그 전수로 셌다

bobochoses.com 4,015건 · junioredition.com 18,236건을 통째로 받아 축별 값 분포를 셌다.
아래 "일치 확률"은 무작위 두 상품이 그 축에서 같은 값을 가질 확률(Σp²)이다.

| 축 | bobochoses.com | junioredition.com |
|---|---|---|
| AUDIENCE | KIDS 86.4% → 일치확률 **76.4%** (0.39 bit) | 일치확률 53.6% (0.90 bit) |
| FIT | loose fit 55.1% → 37.6% (1.41 bit) | 28.3% (1.82 bit) |
| CATEGORY taxon | TOP 45.9% → 30.5% (1.71 bit) | 28.2% (1.83 bit) |
| SIZE 체계 | 51.5% (0.96 bit) | 판독분 **100% AGE 하나 → 0.00 bit** |
| MATERIAL | organic cotton:100 28.8% → 10.1% (3.30 bit) | 11.5% (3.13 bit) |
| COLOR | 14.9% (2.75 bit) | 10.0% (3.32 bit) |

TITLE 1점을 사 준 토큰 `all`은 **bobochoses.com 제목에서 가장 흔한 말**이다
(4,015건 중 433건 = 10.78%, 2위 `over` 10.49%). 반면 정답 쌍이 공유한 말은
`about` 0.25% · `monsters` 0.30%이고, 430701/430651 정답 쌍의 `zipped`는 0.47%다.

**결론: 그렇다. 상품을 구별하지 못하는 축이 6점 중 5점을 만들고 있었다.**

### 9-3. 그런데 구별하는 축이 데이터에 **실제로 있었다** — 사이즈

`430632`를 두 카탈로그 **22,251건 전수**와 붙이면 SAME이 6건 나왔다.

| 상대 | core | 사이즈 |
|---|---|---|
| B226AC018 (정답) | 8 | `2-3Y … 12-13Y` |
| B226AB043 Mush Monster Duo all over T-shirt | 6 | `3M,6M,9M,12M,18M,24M` |
| B226AB048 Softpaw Monster all over T-shirt | 6 | `3M,6M,9M,12M,18M,24M` |
| JE Mush Monster Duo All Over Baby T-Shirt | 6 | `6/12/18/24 Months` |
| JE Juicy Tomatoes All Over Baby T-Shirt | 6 | `6/18 Months` |
| JE Bobo Choses Color All Over Baby T-Shirt | 5 | `6/12/18 Months` |

**거짓 SAME 다섯 건이 전부 아기옷이다.** 여섯 살 아이 티셔츠와 6개월 아기
티셔츠가 동일상품 가격에 들어가고 있었다. 판정기가 그것을 못 본 이유는 하나다 —
`normalizeSizeLabel`이 **개월 표기를 통째로 버리고 있었다.** 단일 개월(`6M`,
`6 Months`)은 어느 규칙에도 안 걸려 `null`이 되고, 범위형(`12-18 Months`)은
걸리더라도 연령형과 같은 `AGE` 체계로 들어갔다. 실측으로 읽지 못한 사이즈 라벨이
bobochoses.com 10,739개 중 3,196개(29.8%), junioredition.com 19,076개 중
10,431개(54.7%)였고 상위 항목이 전부 개월 표기였다.

### 9-4. 무엇을 고쳤나 (`packages/shared/src/product-facts.ts` 한 곳)

```
SizeSystem 에 "MONTH" 추가
normalizeSizeLabel:  "12-18 Months" → MONTH (기존 AGE)
                     "6M" / "6 Months" / "6 mois" → MONTH (기존 판독 실패)
```

`cross-seller.ts`는 **한 줄도 고치지 않았다.** 기존 `SIZE_SYSTEM` **보류**(충돌이
아니다)가 그대로 발화한다. 임계값(`SAME_MIN_AXES` / `PRESUMED_SAME_MIN_AXES` /
`STRONG_TITLE_OVERLAP` / 이미지 임계값)도 어휘 목록도 손대지 않았다.

### 9-5. 전이표 — 원본 18건 × 카탈로그 22,251건 = **400,518쌍**

|  | →SAME | →PRESUMED_SAME | →SIMILAR | →UNKNOWN | →CONFLICT |
|---|---|---|---|---|---|
| SAME (25) | **20** | **5** | 0 | 0 | 0 |
| PRESUMED_SAME (953) | 0 | 953 | 0 | 0 | 0 |
| SIMILAR (2,568) | 0 | 0 | 2,568 | 0 | 0 |
| UNKNOWN (540) | 0 | 0 | 0 | 540 | 0 |
| CONFLICT (396,432) | 0 | 0 | 0 | 0 | 396,432 |

내려간 5건은 위 §9-3의 아기옷 다섯 건이고 **그 외에는 하나도 없다.**
`그 외 → SAME`은 **0건**이다(새 오탐이 생기지 않았다).

### 9-6. 수정 후 라이브 재확인

```
430632 ↔ 카탈로그 22,251건   SAME 1건 (B226AC018, core 8) — 나머지 5건 전부 PRESUMED_SAME
430632 ↔ Mush Monster Duo    PRESUMED_SAME  보류: 사이즈 체계 MONTH ↔ AGE
430632 ↔ B226AC018           SAME   core 8 (SIZE 축이 오히려 근거로 남는다)
430632 ↔ B226AD013           CONFLICT (AUDIENCE + COLOR)
430701 ↔ B226AC114           SAME   core 7
430651 ↔ B226AC043           SAME   core 7
```

### 9-7. 남은 것 (이번에 고치지 않았다 · 기록)

- **`AUDIENCE` 축이 아기와 아동을 같은 `KIDS`로 뭉친다.** 오답 쌍이 받은
  `AUDIENCE +1`은 지금도 그대로다 — 사이즈가 막았을 뿐이다. 사이즈를 안 적는
  판매처에서는 이 구멍이 다시 열린다.
- **`TITLE` 축이 문서빈도를 모른다.** `all`(10.78%)도 `monsters`(0.30%)도 똑같이
  1점이다. 카탈로그 문서빈도를 판정 시점에 알 방법이 현재 구조에 없다
  (`compareCrossSellerProducts`는 두 `ProductFacts`만 보는 순수 함수다).
- **`Booty Ghosts Long Sleeve T-Shirt` ↔ Bobo 샘플 라인 3건**이 SAME으로 올라온다
  (전수 조사에서 발견, 이번 결함과 기전이 다르다 — 별건).

---

## 10. ⚠️ 재개방 (2026-09-14, MATCHING-3.2 조사 중 발견)

**§9의 해결은 시뮬레이션 경로에서만 참이다. 운영 경로에서는 오탐 5건이 그대로 살아 있다.**

### 10-1. 무엇이 틀렸나 — `SIZE_SYSTEM` 은 운영에서 한 번도 발화할 수 없다

§9의 전이표는 `/products/{handle}.js` / `products.json` 으로 받은 **카탈로그 원문**을
후보로 썼다. 그 응답에는 `options`(사이즈)가 들어 있다. 그런데 **운영이 후보를 만드는
경로는 그것이 아니다.**

```
searchShopifySuggest  →  https://{domain}/search/suggest.json
   실측 응답 키(2026-09-14 라이브, junioredition.com):
   available, body, compare_at_price_max, compare_at_price_min, handle, id,
   image, price, price_max, price_min, tags, title, type, url, variants, vendor, featured_image
   →  `options` 칸이 **없다**
```

`shopifySizeLabels()` 는 `input.options` 에서만 사이즈를 읽으므로, 이 경로로 만들어진
**모든 후보의 `sizeLabels` 는 언제나 `[]`** 다. 나머지 판매처도 마찬가지다:

```
Shopify suggest 11곳(junioredition 포함)  options 없음        → sizeLabels []
childrensalon.com                        productFactsFromListing → sizeLabels []
국내 6곳(looxloo/rulii/deuxbebe/chocoel/foretforet) productFactsFromListing → sizeLabels []
bobochoses.com(국내 소스)                 facts 자체를 만들지 않는다
enrichCandidatePrices                     price 만 바꾼다. facts 를 건드리지 않는다
```

`compareSize()` 는 **양쪽 다** 사이즈를 읽어야 판정한다
(`left.systems.size === 0 || right.systems.size === 0 → unknown`).
질의(등록상품)에는 사이즈가 있어도(`CanonicalProduct.optionGroups`) 후보에는 없으므로,
**`SIZE_SYSTEM` 보류도 `SIZE` 가점도 운영에서 구조적으로 발화 불가능하다.**

### 10-2. 라이브 재현 — 오탐이 그대로 돌아온다

운영 함수 `searchShopifySuggest("junioredition.com", …)` 로 후보를 받아
`430632`(2/3~12/13 years)와 붙인 결과(2026-09-14 라이브):

```
SAME  core 6  Mush Monster Duo All Over Baby T-Shirt by Bobo Choses
              type="Baby T Shirt"  tags=["3-6-months","6-12-months","all-baby","baby","baby-tops",…]
              axes = TITLE+1 CATEGORY+1 COLOR+1 MATERIAL+1 FIT+1 AUDIENCE+1
              blockers = 없음
```

§9-3에서 막혔다고 보고한 바로 그 상품이다. 후보 쪽 사이즈를 지운 상태로 전수
시뮬레이션(원본 16건 × 22,251건)을 다시 돌리면 **§9-3의 다섯 건이 전부 SAME으로
되돌아온다**(3M~24M 두 건 + 6~24 Months 세 건).

### 10-3. 그런데 원문은 연령대를 **명시적으로** 말하고 있다

그 후보의 `type` 은 문자 그대로 `"Baby T Shirt"` 이고, 태그에는 `baby` / `all-baby` /
`baby-tops` / `3-6-months` / `6-12-months` 가 있다. 이 값들은 **이미
`ProductFacts.audienceSignals` 에 담겨 판정기까지 도착해 있다.** 그런데
`resolveAudienceGroup()` 이 `AudienceGroup = "KIDS" | "ADULT"` 두 값으로만 환원하므로,
"Baby" 라고 쓰여 있는 신호가 아동복과 같은 `KIDS` 가 되고 **오탐에 `AUDIENCE +1` 을
보태고 있다.**

### 10-4. 다음 작업이 볼 것

```
경로 A  후보에 사이즈를 실어 보낸다(/products/{handle}.js 조회)
        → 872defc 가 의도한 대로 동작하게 된다. 다만 판매처마다 상세 요청이 1회 늘어난다.
경로 B  AUDIENCE 를 BABY/CHILD 로 가른다
        → 새 데이터가 필요 없다. 이미 audienceSignals 에 도착해 있는 말만 읽으면 된다.
        → 시뮬레이션(원본 16건×22,251 및 bobo 4,015×JE 276 양방향)에서
          오탐 5건/131건/267건이 막히고 **정상 SAME 오차단은 0건**이었다.
```

두 경로는 배타적이지 않다. **이번 단계에서는 아무것도 고치지 않았다(조사 지시).**

---

## 11. 경로 B 구현 (2026-09-14, MATCHING-3.2-B · 라이브 실측)

### 11-0. ⚠️ §10-2 정정 — 그 재현은 질의쪽이 운영이 아니었다

§10-2 는 후보를 운영 함수(`searchShopifySuggest`)로 받았지만, 붙인 질의쪽 `430632`
facts 는 `productFactsFromSmallableHtml` 로 만든 것이다(그래서 "2/3~12/13 years" 가
있었다). **그 파서는 운영 경로 어디에도 배선돼 있지 않다** — 호출하는 곳이 테스트
파일뿐이다(실측, 2026-09-14).

운영 해외 화면이 실제로 만드는 질의 facts 는 이것이다:

```
CommerceWorkspace → ComparisonShopSearch(collectOverseasPrices)
   보내는 필드  title · brand · sourceUrl · sku · description   (color/material 도 안 보낸다)
POST /api/comparison/search → identityDnaFromFields(...) → productFactsFromIdentityDna
   audienceSignals  []        ← 하드코딩
   sizeRange        []        ← 하드코딩
   ageRange         null      ← 하드코딩
   category         null      ← 하드코딩
```

그래서 같은 쌍을 **운영 경로 그대로** 다시 재면 이렇다(2026-09-14 라이브):

```
430632 ↔ JE "Mush Monster Duo All Over Baby T-Shirt"
   PRESUMED_SAME  core 4   TITLE+1 CATEGORY+1 MATERIAL+1 FIT+1
   AUDIENCE +1 은 붙지 않는다 — 질의쪽 대상연령이 아예 비어 있어 축이 "모름"이다
```

§10-2 의 "운영 경로에서 오탐이 그대로 돌아온다" 는 **후보쪽만 운영이었다.** 오탐이
SAME 으로 서 있는 것은 질의쪽 증거가 도착한 순간이고, 그때 무엇이 그것을 막느냐가
이 절의 내용이다.

### 11-1. 무엇을 고쳤나 (두 파일, 임계값 0칸)

```
packages/shared/src/product-facts.ts
   AudienceLine = "BABY" | "CHILD" | "JUNIOR"   신설
   resolveAudienceLine(signals)                 신설
   AudienceGroup("KIDS" | "ADULT") 과 resolveAudienceGroup 은 **한 글자도 바꾸지 않았다**

packages/crawler/src/comparison-search/cross-seller.ts
   CrossSellerBlocker 에 "AUDIENCE_LINE" 추가
   compareAudienceLine() 신설 — 불일치면 **보류**, 일치해도 **점수 없음**
```

`AudienceGroup` 을 세 값으로 늘리지 않은 이유는 하나다. `compareAudience` 의 불일치는
`conflicts` 로 가고 conflicts 는 점수를 보지도 않고 CONFLICT 로 끝낸다 — 그 자리에
`BABY ↔ CHILD` 를 넣으면 아기옷과 아동복이 **서로 반증하는 사이**가 되고, 그건 이
저장소가 성인↔아동에만 허용한 강도다(CEO 금지 조항).

일치에 점수를 주지 않은 것도 의도다. 기존 `AUDIENCE +1`(KIDS↔KIDS)은 그대로 두므로
`BABY↔BABY` 는 지금까지 받던 1점을 **똑같이** 받고, 새 축이 기존 쌍의 점수를 한 점도
움직이지 않는다는 것이 산술로 보장된다(`compareGarmentForm` 이 쓰는 비대칭 그대로).

어휘는 늘리지 않았다 — 세 라인의 낱말은 전부 `KIDS_TOKENS` 에 이미 있던 것이다.
우선순위(BABY > JUNIOR > CHILD)의 근거는 카탈로그 22,251건 전수 실측이다:

| 토큰 | bobochoses.com 개월형/연령형 | junioredition.com 개월형/연령형 | 판정 |
|---|---|---|---|
| `baby` | 140 / **0** | 543 / 12 | BABY (100.0% · 97.8%) |
| `newborn` | 33 / **0** | 10 / **0** | BABY (100.0%) |
| `kid` | 1 / 264 | 0 / 181 | CHILD (99.6% · 100%) |
| `kids` | — | 0 / 5 | CHILD |
| `children` | 140 / 264 | 사이즈 붙은 상품 없음 | **우산말 — 혼자서는 아동이 아니다** |
| `toddler` | 0건 | 96건 전부 사이즈 없음 | **어느 라인에도 넣지 않았다** |

`children` 이 아기 상품에도 붙는다는 것이 이 표의 핵심이다. 그런데 그 140건은
**동시에 `baby` 도 달고 있어서** BABY 를 먼저 보는 것만으로 갈린다. 반대로 Smallable
은 매장이 부서로 갈려 있어(`Fashion Baby` / `Fashion Children` / `Fashion Teen`,
breadcrumb 실측) `Children` 이 그대로 아동을 뜻한다. 한 목록으로 두 판매처를 다
맞추는 방법이 우선순위다.

### 11-2. 오탐 5건 — **후보 사이즈를 지운 채로** 재검증

§9 의 회귀 테스트는 후보에 사이즈가 있는 픽스처를 쓴다. 운영 후보에는 그 칸이 없으므로
(§10-1), 같은 픽스처의 `sizeLabels` 를 **지우고** 다시 쟀다. 그러면 872defc 의
`SIZE_SYSTEM` 보류는 발화할 자리가 없고, 남는 것은 원문이 직접 말한 "Baby" 뿐이다.

| 쌍 (후보 사이즈 없음) | core | 보류 | 판정 |
|---|---|---|---|
| 430632 ↔ B226AB043 Mush Monster Duo | 6 | **AUDIENCE_LINE** BABY↔CHILD | PRESUMED_SAME |
| 430632 ↔ B226AB048 Softpaw Monster | 6 | **AUDIENCE_LINE** | PRESUMED_SAME |
| 430632 ↔ JE Mush Monster Duo Baby T-Shirt | 6 | **AUDIENCE_LINE** | PRESUMED_SAME |
| 430632 ↔ JE Juicy Tomatoes Baby T-Shirt | 6 | **AUDIENCE_LINE** | PRESUMED_SAME |
| 430632 ↔ JE Bobo Choses Color Baby T-Shirt | 5 | **AUDIENCE_LINE** | PRESUMED_SAME |
| **430632 ↔ B226AC018 (정답)** | 7 | 없음 | **SAME** |
| 430632 ↔ B226AD013 (성인) | 0 | — | **CONFLICT** (AUDIENCE+COLOR) |

이 일곱 줄이 그대로 고정 테스트로 들어갔다
(`cross-seller-matching.test.ts` · "MATCHING-3.2-B 회귀").

### 11-3. 라이브 확인 — 증거가 도착하면 무엇이 일어나는가

운영 후보(`searchShopifySuggest("junioredition.com", …)`, 2026-09-14 라이브)에
질의쪽 대상연령 증거(등록상품이 **이미 DB 에 갖고 있는** breadcrumb
`["Home","Fashion  Children","Boy","Blouses, T-shirts"]`)를 실어 붙인 결과:

```
Mush Monster Duo All Over Baby T-Shirt   core 5   보류 AUDIENCE_LINE(BABY↔CHILD)  → PRESUMED_SAME
Juicy Tomatoes All Over Baby T-Shirt     core 5   보류 AUDIENCE_LINE              → PRESUMED_SAME
Bobo Choses Color All Over Baby T-Shirt  core 5   보류 AUDIENCE_LINE              → PRESUMED_SAME
Everyday Ghosts All Over Baby T-Shirt    core 5   보류 AUDIENCE_LINE              → PRESUMED_SAME
All About Monsters T Shirt (Womenswear)  core 0   충돌 AUDIENCE                   → CONFLICT
```

**이번 수정 전이었다면 위 네 건은 전부 `SAME`(core 5, 보류 없음)이다.** 성인 상품은
여전히 CONFLICT 로 끝난다 — 성인↔아동 정책은 한 칸도 약해지지 않았다.

### 11-4. 🔴 STOP — 질의쪽 증거 배선은 이번에 하지 않았다

위 §11-3 이 보여주듯 이 수정이 운영 판정을 실제로 바꾸려면 등록상품의 대상연령
증거가 질의 facts 에 실려야 한다(`identityDnaFromFields` 의 `audienceSignals: []`).
그 배선만 따로 전수로 재 봤다 — **새 SAME 이 6건 생긴다.**

```
원본 68건(운영 DB 등록상품) × 카탈로그 22,251건 = 1,513,068쌍

배선 전 → 배선 후(+라인 분리)
   SAME(32)            → SAME 32                     정상 SAME 손실 0
   PRESUMED_SAME(1610) → SAME 6  /  CONFLICT 40
   SIMILAR(9652)       → PRESUMED_SAME 744 / CONFLICT 768
   UNKNOWN(18162)      → SIMILAR 3854 / CONFLICT 510
```

새로 생기는 SAME 6건은 전부 `AUDIENCE +1` 이 새로 붙어서 core 4→5 가 된 쌍이다.
그중 하나는 정답(`430632 ↔ B226AC018`)이지만 나머지는 다른 색/다른 상품으로 보인다
(`430651 ↔ B226AC042`, `430704 ↔ B226AC117`, `430663 ↔ B226AC163`/`B226AC058`).

지시서의 STOP 조건("기타 → SAME 이 1건이라도 새로 생기면 즉시 STOP")에 걸리므로
**배선은 하지 않았다.** 이 배선은 별건으로 판단받아야 한다 — 사이즈 전달(경로 A)과
같은 성격의 "증거 전달" 작업이고, 그 자체로 점수를 움직인다.

### 11-5. 전이표 — 라인 분리 **그 자체**는 무엇을 움직이는가

```
(1) 질의쪽이 운영 그대로(audienceSignals 없음) — 1,513,068쌍
      모든 칸이 대각선. 이동 0건.   ← 배선 없이는 아무것도 바뀌지 않는다(그 자체가 §11-4 의 근거)

(2) 질의쪽에 증거가 실린 상태에서 라인 분리만 — 1,513,068쌍
                  →SAME  →PRESUMED  →SIMILAR  →UNKNOWN  →CONFLICT
      SAME(45)        38          7         0         0          0
      PRESUMED(2301)   0       2301         0         0          0
      SIMILAR(11994)   0          0     11994         0          0
      UNKNOWN(13798)   0          0         0     13798          0
      CONFLICT(…)      0          0         0         0        그대로
```

**기타 → SAME 은 0건이다** — 이 축은 보류만 만들고 점수를 주지 않으므로 구조적으로
SAME 을 새로 만들 수 없다. 내려간 7건은 **전부 430632 의 아기옷 오탐**이고(§9-3 의
다섯 건 + `B226AB049 Softpaw Monster all over shirt` + `JE Everyday Ghosts All Over
Baby T-Shirt`), 정상 SAME 의 강등은 0건이다.

### 11-6. 남은 것

- **질의쪽 대상연령 배선**(§11-4) — STOP. 별건 판단 필요.
- **경로 A(후보 사이즈 전달)** — 여전히 미착수(MATCHING-3.3).
- **`Booty Ghosts` ↔ Bobo 샘플 라인 3건** — 이번 수정으로 **바뀌지 않았다**(확인함).
  원본쪽 라인이 읽히지 않아(태그가 연령 낱말이 아니라 사이즈 목록이다) 이 보류가
  발화할 자리가 없다. 별건 문서 `docs/matching-regression-booty-ghosts.md` 그대로.
- **`TITLE` 축이 문서빈도를 모른다** — 그대로.
