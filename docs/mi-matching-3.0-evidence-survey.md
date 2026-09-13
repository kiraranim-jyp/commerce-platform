# MI-MATCHING-3.0 — 후보 확장 / 증거 조사 (READ ONLY)

- 지시: CEO, 2026-09-13 (+ 보고 구성 추가 지시)
- 실측 수행: 2026-09-14, 브랜치 `main`, HEAD `6caa7df`
- 대상 상품: Smallable 430701 <https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701>
- 정답 동일상품: Bobo Choses **B226AC114** "Bolder half zipped sweatshirt" (€75)
- **코드는 한 줄도 고치지 않았다.** 모든 값은 기존 함수(`buildCrossSellerSearchQueries`,
  `withConfidence`/`scoreCandidateMatch`, `compareCrossSellerProducts`,
  `resolveColorHueGroups`/`parseMaterialComposition`/`resolveGarmentForms`/
  `resolveAudienceGroup`/`buildSizeProfile`/`compareModelCode`, `computeDifferenceHash`)를
  **그대로 실행해서** 얻었다. 조사용 임시 스크립트는 저장소 밖(스크래치)으로 옮기고 지웠다.
- 측정하지 못한 칸은 `—`가 아니라 **`미측정`** 또는 **`질의 불가`**로 구분해 적었다.

---

## 1. [최우선] 12개 검색 방식별 **정답 발견 여부**

정답이 실제로 **존재하는 판매처는 bobochoses.com 한 곳뿐**이다(아래 §1-2에서 근거).
그래서 이 표는 두 칸으로 나눠야 뜻이 통한다.

| 방식 | 질의 문자열(실제로 보낸 말) | **파이프라인이 검색하는 15개 판매처에서 정답 발견** | bobochoses.com(정답 보유처)에서의 정답 순위 |
|---|---|---|---|
| Q1 브랜드+전체 상품명 | `Bobo Choses Zipped Sweat Organic Cotton \| Heather grey` | ❌ | **1위** |
| Q2 브랜드+핵심 상품명 | `Bobo Choses zipped sweat` | ❌ | **1위** |
| Q3 브랜드+상품 형태 | `Bobo Choses Sweatshirts` | ❌ | 4위 |
| Q4 브랜드+색상 | `Bobo Choses Heather grey` | ❌ | **1위** |
| Q5 브랜드+소재 | `Bobo Choses Organic Cotton` | ❌ | 없음 |
| Q6 브랜드+형태+색상 | `Bobo Choses Sweatshirts Heather grey` | ❌ | **1위** |
| Q7 브랜드+핵심명+색상 | `Bobo Choses zipped sweat Heather grey` | ❌ | **1위** |
| Q8 품번 | — | **질의 불가** (아래 참고) | (가정 질의 `B226AC114` → 1위, 1건만 반환) |
| Q9 URL slug | `430701` / `bobo choses zipped sweat organic cotton heather grey` | ❌ | 숫자조각 없음 / 단어조각 **1위** |
| Q10 현행 캐스케이드 4건 | `…zipped sweat Sweatshirts Heather grey` 외 3건 | ❌ | 4건 **전부 1위** |
| Q11 기존 fallback (`buildDomesticShopQuery`) | `AAA1804922` (판매처 재고번호) | ❌ | 없음(0건) |
| Q12 편집샵별 고유 방식 | `보보쇼즈` / `half zipped sweatshirt` / `Bolder` | ❌ | 한글 없음 / `half zipped sweatshirt` **1위** / `Bolder` 없음 |

### Q8이 "미측정"이 아니라 "질의 불가"인 이유

`dna.brandModelCode = null`이다. Smallable 페이지 전문 723,550 B 어디에도 `B226AC114`가 없다(실측 재확인).
있는 것은 Smallable 자신의 번호 `AAA1804922`와 URL 슬러그의 `430701`뿐이고, 둘 다
브랜드 품번이 아니다. 즉 **우리가 가진 데이터로는 Q8이라는 질의를 만들 수 없다.**
"보냈는데 0건"이 아니라 "보낼 말이 없다"이다.

### 1-2. 그래서 CEO의 분기 중 어느 쪽인가

```
파이프라인이 실제로 검색하는 15개 판매처 기준  →  전 방식 미발견 (Q1~Q12 전부 ❌)
정답을 보유한 유일한 판매처(bobochoses.com)  →  12개 방식 중 9개가 1위로 물어옴
```

**이 두 사실이 같이 있어야 결론이 정직해진다.** "검색어를 못 만든 문제"가 아니다 —
검색어는 이미 충분히 좋다(같은 말을 정답 보유처에 던지면 1위로 나온다). 문제는
**정답을 파는 곳을 우리가 검색 대상에서 빼놓고 있다**는 것이다.

| 사실 | 관측값 (DB 실측, 2026-09-14) |
|---|---|
| `comparison_shops`에 `bobochoses.com` | `is_active = true` |
| 그러나 `SHOPIFY_SUGGEST_DOMAINS`(파서 레지스트리, `index.ts:174`)에 | **없음 → `status: "unsupported"`** |
| `domestic_price_sources`의 `bobochoses.com` | `enabled = false`, `collection_strategy = AUTO_API` |
| 국내 경로 파서(`searchBoboChosesKorea`) | **존재함**. 다만 소스가 꺼져 있어 호출되지 않음 |

즉 코드는 이미 이 판매처를 검색할 수 있고, 검색어도 이미 정답을 1위로 물어온다.
**둘 사이를 잇는 한 칸(파서 등록 / 소스 활성화)이 비어 있다.**
(이번 지시는 READ ONLY이므로 아무것도 켜지 않았다 — 관측 사실만 적는다.)

### 1-3. 지원 판매처에는 정답이 "애초에 없다"

정답 상품은 Bobo **AW26** 신상이다(태그 `aw26`, `NewArrivals` — 실측).

| 판매처 | 파서 | Bobo Choses 상품 보유 | 정답(half zipped sweatshirt) |
|---|---|---|---|
| Junior Edition | ✅ Shopify suggest | ✅ 다수(Pickles/Bigtooth Lemon/Modern 등) | ❌ 없음 (`half zip sweatshirt` 검색 → Gray Label·Mini Rodini만) |
| NICKIS | ✅ | ✅ 일부(Overall/T-Shirt/Top 등) | ❌ 없음 |
| Folk Berlin | ✅ | Bobo Bear 인형 1건(다른 브랜드) | ❌ 없음 |
| Isola Bella Kids / Petite Maison Kids / Piccoli & Co / Designer Kids Wear / Kid Biz / Village Kids | ✅ | ❌ **Bobo 취급 자체 없음** | ❌ 없음 |
| Childrensalon | ✅ HTML 파싱 | ❌ `Bobo Choses` 검색 → **"No Search Results"** 페이지 | ❌ 없음 |
| LOOXLOO / 포레포레 / RULII / DEUXBEBE | ✅ | ✅ 다수 | ❌ 없음 (전부 SS26 시즌 재고) |
| CHOCO.EL | ✅ | ❌ 전 질의 0건 | ❌ 없음 |

→ **지원 판매처 15곳 중 이 상품을 파는 곳은 0곳이다.** 검색어를 아무리 늘려도
없는 물건은 나오지 않는다.

---

## 2. 방식별 후보 수 요약표 (실측, 숫자는 반환된 후보 건수)

각 파서의 상한은 5건(국내/Childrensalon/Shopify suggest 공통). bobochoses.com 열만
조사용으로 상한 10건으로 조회해 **정답 순위**를 적었다.

| Q | CHOCO.EL | 포레포레 | DEUXBEBE | RULII | Childrensalon | LOOXLOO | Junior Ed. | NICKIS | Isola Bella | Petite Maison | Piccoli | Designer KW | Kid Biz | Village Kids | Folk Berlin | **bobochoses(정답순위)** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Q0 브랜드 단독 | 0 | 5 | 1 | 3 | 0 | 5 | 5 | 5 | 0 | 0 | 1 | 3 | 1 | 3 | 0 | 없음 |
| Q1 | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 0 | 0 | 0 | 1 | 0 | 0 | 5 | 5 | **1위** |
| Q2 | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 5 | 2 | 0 | 1 | 2 | 5 | 5 | 2 | **1위** |
| Q3 | 0 | 5 | 0 | 0 | 0 | 5 | 5 | 5 | 3 | 0 | 1 | 2 | 5 | 5 | 1 | 4위 |
| Q4 | 0 | 5 | 0 | 0 | 0 | 5 | 5 | 5 | 2 | 0 | 3 | 0 | 4 | 2 | 0 | **1위** |
| Q5 | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 5 | 0 | 3 | 5 | 3 | 0 | 5 | 5 | 없음 |
| Q6 | 0 | 4 | 0 | 0 | 0 | 5 | 5 | 5 | 5 | 0 | 1 | 2 | 1 | 5 | 0 | **1위** |
| Q7 | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 5 | 3 | 0 | 2 | 3 | 0 | 5 | 0 | **1위** |
| Q8 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | 질의 불가 | (가정 질의 1위) |
| Q9a `430701` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 없음 |
| Q9b slug 단어 | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 5 | 1 | 0 | 1 | 0 | 0 | 5 | 5 | **1위** |
| Q10a | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 5 | 2 | 0 | 1 | 0 | 0 | 5 | 0 | **1위** |
| Q10b | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 5 | 2 | 0 | 1 | 5 | 5 | 5 | 0 | **1위** |
| Q10c | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | **1위** |
| Q10d | 0 | 0 | 0 | 0 | 0 | 5 | 5 | 5 | 0 | 0 | 1 | 0 | 0 | 5 | 5 | **1위** |
| Q11 재고번호 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 없음 |
| Q12kr `보보쇼즈` | 0 | 5 | 1 | 3 | 0 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 2 | 없음 |
| Q12 `half zipped sweatshirt` | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 5 | 5 | 5 | 0 | 1 | 5 | 5 | 5 | 1 | **1위** |
| Q12 `Bolder` | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 5 | 5 | 4 | 3 | 5 | 0 | 5 | 4 | 5 | 없음 |

`미측정` 칸: Q10c는 Q2와 문자열이 같아 국내/해외 1차 실행에서 중복 제거했고(같은 결과),
Q12의 영문 두 개는 해외 전용으로 설계해 국내 5곳에는 보내지 않았다.

### 이 표에서 읽히는 것

- **검색어가 좁을수록 국내 편집샵은 0건이 된다.** 포레포레는 Q3/Q4/Q6(브랜드+형태 또는
  +색상)에서만 후보를 냈고, `zipped sweat`가 들어간 순간 전부 0건이다 — 한국 상품명에
  그 영어 단어가 없기 때문이다.
- **LOOXLOO는 거의 모든 질의에 5건을 낸다.** 검색이 사실상 AND가 아니라 느슨한 OR라
  "질의와 무관하게 항상 뭔가 나오는" 판매처다(Q5 `Bobo Choses Organic Cotton`에
  "드로잉플라워7부내의"가 나온다). 0건이 아니라는 사실이 후보 품질을 전혀 보증하지 않는다.
- **Q12kr(`보보쇼즈`)가 국내에서 가장 안정적으로 브랜드 재고를 긁어온다.** 그런데 이
  말은 현재 `brand-alias.ts`에 **없다**(등록된 3개 브랜드는 PèPè/Emile et Ida/Konges Slojd).
  즉 Bobo Choses는 국내 alias 폴백 경로 자체가 발화하지 않는다.
- **Village Kids / Folk Berlin / Kid Biz 등은 어떤 말을 던져도 5건을 돌려준다.** Shopify
  suggest가 관련 없는 상품까지 채워 보내는 것이고, 실제로 이들이 낸 후보 187건은
  **전부 다른 브랜드**였다(§7-2).

---

## 3. 후보 상품의 실제 데이터가 충분한가 — 증거 11축

CEO가 지정한 11축을 "확보 가능한가 / 어디서 오는가 / 실제 값이 무엇인가" 세 칸으로 적는다.
값은 전부 기존 resolver를 실행해 얻은 것이다.

| 축 | 확보 | 어디서 오는가 | 원본 430701 실제 값 | 정답 B226AC114 실제 값 | 국내 편집샵 후보 실제 값 |
|---|---|---|---|---|---|
| brandScore | ✅ | 해외: Shopify `vendor`(+ `OFFICIAL_STORE_BRANDS`). 국내: 상세 JSON-LD `brand.name` | `Bobo Choses` (JSON-LD) | `Bobo Choses`(vendor는 시즌코드 `AW26`이라 도메인 매핑으로 보정) | `BOBO CHOSES` (JSON-LD에 있음) — **단 후보 객체의 `facts`에는 실리지 않음** |
| titleScore | ✅ | `coreTitleTokens` | `["zipped","sweat"]` | `["bolder","half","zipped","sweatshirt"]` → 공유 `zipped` 1개 → `TITLE +1`(부분 일치) | 한글 제목이라 교집합 0 → `NO_TITLE_OVERLAP` |
| productFormScore | ⚠ 영어만 | `resolveGarmentForms(title)` | `SWEATSHIRT` | `SWEATSHIRT` | **읽지 못함.** `"스웻셔츠"`가 어휘목록의 `"스웨트셔츠"`와 **토큰 불일치**(실측). `"롱삭스"↔"양말"`, `"양말팩"↔"양말"`도 같음 |
| colorScore | ⚠ 영어만 | `resolveColorHueGroups(colorText)` | `Heather grey` → `GREY` | `light heather grey` → `GREY` | **읽지 못함.** `"헤더그레이"`는 한 토큰이라 `"그레이"`와 완전일치하지 않음(실측) |
| materialScore | ⚠ | `parseMaterialComposition` | `organic cotton:100` | `organic cotton:100` | **원문에 없음.** 포레포레 상세는 `제품소재 → "상세설명 참조"`뿐이고 실제 혼용률은 상세 **이미지 안 텍스트** |
| audienceScore | ⚠ | breadcrumb / Shopify tags / 사이즈 체계 | `KIDS` (breadcrumb `Fashion Children / Boy`) | `KIDS` (tags `children`,`Kid`) | **읽지 못함.** 국내 후보에 breadcrumb·태그가 파싱되지 않음 |
| sizeScore | ⚠ 확보 가능·미연결 | `buildSizeProfile(sizeLabels)` | `AGE` / `4-5y 6-7y 8-9y 10-11y 12-13y` | `AGE` / `2-3Y … 12-13Y` | **확보 가능하나 파서가 안 읽음.** 포레포레 option `041,4_5Y`, LOOXLOO JSON-LD offers `…VIOLET-100/110/120` → **LOOXLOO는 NUMERIC(cm) 체계**라 AGE와 만나면 `SIZE_SYSTEM` 보류가 걸림 |
| modelCodeScore | ❌ 원리상 | 설명문 `Product/Article code` 라벨 또는 URL 앞머리 | **`null`** — Smallable 어디에도 브랜드 품번 없음 | `B226AC114` (handle 앞머리) | 포레포레 `mpn = BB26KSSSTC045041` — **국내 유통사 코드지 브랜드 품번이 아님**. `compareModelCode`에 넣으면 접두사부터 다름 |
| urlScore | ❌ | slug 완전일치 / `query.sku`가 후보 slug에 포함 | slug `bobo-choses-zipped-sweat-…-430701` | slug `b226ac114-…` | 어느 쌍도 일치 불가. `query.sku`는 판매처 재고번호(`AAA1804922`)라 slug 포함 검사도 무의미 |
| imageScore | ⚠ 계산 가능·발화 안 함 | `computeMinImageDistance` + `CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE=95` | **`facts.imageUrls`에 1장뿐** (실제 페이지엔 4장) | 7장 | 국내 후보 `facts` 자체가 없어 0장. §5 참고 |
| availabilityScore | ❌ 축이 없음 | — | — | — | `CrossSellerAxis`에 재고/판매상태 축이 **존재하지 않는다**. `priceStatus`·`soldOut`은 별도 필드이고 동일상품 판정에 들어가지 않는다 |

### 3-1. 국내 후보는 증거 축이 "전부" 비어 있다 — 이유는 한 곳

국내 파서 5개(`looxloo.ts`/`rulii.ts`/`deuxbebe.ts`/`chocoel.ts`/`foretforet.ts`)는
`ComparisonCandidate`를 만들 때 **`facts` 필드를 채우지 않는다**. `match.ts:487`이
`query.facts && c.facts`일 때만 `compareCrossSellerProducts`를 부르므로,
국내 후보 33건 전부 `crossSellerVerdict = undefined`다(실측 재확인).

그런데 **데이터가 없어서가 아니다.** 상세 페이지를 직접 열어 보면 있다:

| 판매처 | 상세 페이지에 실제로 있는 것 (실측) |
|---|---|
| 포레포레 | JSON-LD `Product`: `brand.name="BOBO CHOSES"`, `mpn="BB26KSSSTC045041"`, `sku`, `offers.price/availability`, `image` 1장 / `<option>` `041,4_5Y` / 상세 이미지 4장 |
| LOOXLOO | JSON-LD `Product`: `brand.name="BOBO CHOSES"`, `image` **8장**, `offers[]` 5개(각 `name`에 색상+사이즈 `VIOLET-100`), 상품정보제공고시 표(소재/색상/치수/제조국) |

즉 국내는 **"증거가 없는 것"이 아니라 "증거를 안 가져오는 것"**이다.
(다만 소재는 포레포레에서 실제로 기계판독 불가였다 — 이건 진짜 없다.)

### 3-2. 한글 어휘가 죽어 있는 자리 (실측)

| 관측된 국내 표기 | 어휘 목록에 있는 말 | 토큰 일치? | 결과 |
|---|---|---|---|
| `스웻셔츠` | `스웨트셔츠` (`GARMENT_FORM_WORDS.SWEATSHIRT`) | ❌ | 형태 판독 실패 |
| `헤더그레이` | `그레이` (`COLOR_HUE_WORDS.GREY`) | ❌ | 색상 판독 실패 |
| `롱삭스` / `양말팩` | `양말` (`GARMENT_FORM_WORDS.SOCKS`) | ❌ | 형태 판독 실패 |
| `후디` | `후디` | ✅ | 정상 |
| `팬츠` | `팬츠` | ✅ | 정상 |

원인은 두 함수가 서로 **다른 매칭 방식**을 쓰기 때문이다.
`extractCategoryTaxon`(match.ts)은 정규화 문자열의 **부분 포함**을 보므로
`"스웻셔츠"`에서 `"셔츠"`를 찾아 `TOP`을 맞힌다. 반면 `resolveGarmentForms`/
`resolveColorHueGroups`(product-facts.ts)는 **토큰 완전일치**만 본다 — 영어에서는
`sweat`가 `sweatshirt`에 섞이는 오탐을 막는 올바른 선택이지만, 한국어는 조사·수식어가
띄어쓰기 없이 붙어 한 토큰이 되므로 그 선택이 그대로 "한글 전멸"이 된다.

**이건 어휘를 몇 개 더 넣어 해결될 문제가 아니다**(`스웻셔츠`를 넣어도 `맨투맨스웻`,
`크롭스웻셔츠`가 또 빠진다). 한국어 쪽 매칭 방식 자체에 대한 판단이 필요하다.

---

## 4. 텍스트·상품속성 유사도 — 실제 관측값

### 4-1. 정답을 후보로 세워 보면 어떻게 되는가 (대조군)

검색이 정답을 물어왔다고 **가정**하고, 그 상품의 `ProductFacts`를 기존 어댑터로 만들어
기존 판정기에 그대로 넣었다.

| | 값 |
|---|---|
| `compareCrossSellerProducts` 판정 | **`SAME`** |
| 근거 축 | `TITLE+1 CATEGORY+1 COLOR+1 MATERIAL+1 FIT+1 AUDIENCE+1 SIZE+1` = **corePoints 7** (기준 `SAME_MIN_AXES=5`) |
| 충돌 | 없음 |
| 보류 | 없음 |
| `identifierConfirmed` | `false` (원본 품번이 `null`이므로) |
| **구판 `scoreCandidateMatch` confidence** | **0.38 → `low`** |
| 구판 근거 | `모델명 유사도 11%`, `브랜드 일치(제목 내 확인)` |

**이 한 줄이 이번 조사에서 가장 중요한 관측이다.**
2.0 판정 계층(`compareCrossSellerProducts`)은 정답을 정확히 `SAME`으로 맞힌다.
같은 쌍을 구판 점수(`scoreCandidateMatch`)는 **0.38**로 매기고, 그 값은
`classifyMatchLevel`의 `low`(0.7 미만)이라 `toDomesticMatchType`에서 `NOT_MATCHED`로 버려진다.

구판이 낮게 준 이유도 관측된다: 제목 Jaccard가 `zipped` 하나만 겹쳐 11%이고,
색상·소재·핏·대상·사이즈를 **아예 보지 않는다**(그 축들은 2.0 계층에만 있다).

바로 옆 대조군(같은 설명문을 공유하는 다른 상품 B226AC049, 회색 후드집업)은
`PRESUMED_SAME` + `보류: 옷의 형태 HOODIE ↔ SWEATSHIRT`로 **정확히 한 등급 아래**에 선다.
`GarmentForm` 축이 실제로 두 상품을 갈라내고 있다.

### 4-2. 실제로 검색된 후보에서 판정이 어떻게 갈렸나 (265건)

| 판정 | 건수 | 비고 |
|---|---|---|
| `CONFLICT` | 214 | 대부분 `브랜드 X ↔ Bobo Choses` |
| `SIMILAR` | 12 | 전부 `NO_TITLE_OVERLAP` 보류 동반 |
| `PRESUMED_SAME` | 6 | Junior Edition의 Bobo 스웨트셔츠들 — 제목 겹침 0인데 색상·소재·대상이 맞아서 올라옴 |
| **판정 미실행(`facts` 없음)** | **33** | **국내 5개 판매처 후보 전부** |
| `SAME` | 1 | 대조군(정답)뿐 |
| `matchLevel` | **265건 전부 `low`** | 구판 최고값이 0.44(Junior Edition 성인 티셔츠) |

주목할 점: 구판 점수 1·2위(0.44)는 **Bobo Choses Womenswear 성인 티셔츠**다.
2.0 계층은 이것을 `충돌: 대상 ADULT ↔ KIDS`로 즉시 떨어뜨린다 — 점수로는 가장 위,
증거로는 탈락. 두 계층이 정반대 답을 내는 실례다.

---

## 5. 이미지 — **별도 실험** (CEO 지시: 이번에 Matching에 연결하지 않는다)

### 5-1. 현재 이미지 유사도가 무엇을 비교하는가

| 항목 | 값 |
|---|---|
| 알고리즘 | `computeDifferenceHash` (dedup.service.ts) — grayscale → `resize(17,16,{fit:"fill"})` → 가로 인접 픽셀 밝기 증감 → **256 bit dHash** |
| 비교 | `hammingDistance` (0~256) |
| 중복제거용 임계값 | `DEFAULT_THRESHOLD = 10` — "같은 사진인가"를 묻는 값 |
| 매칭용 임계값 | `CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE = 95` |
| 쌍 선택 | `computeMinImageDistance` — 양쪽 **최대 5장씩 전체 조합의 최솟값** |
| 운영 발화 여부 | **없음.** `match.ts:487`이 `compareCrossSellerProducts(query.facts, c.facts)`를 **이미지 인자 없이** 호출한다 |

`fit:"fill"`은 원본 비율을 무시하고 강제로 늘린다 — 1322×1812와 1500×2000을 같은
17×16으로 뭉갤 때 서로 다른 왜곡이 걸린다.

### 5-2. 원본·후보 이미지가 실제로 존재하는가

| 상품 | `ProductFacts.imageUrls`가 들고 있는 장수 | 실제 페이지에 있는 장수 | URL 유효성 |
|---|---|---|---|
| Smallable 430701 | **1장** (JSON-LD `image` 하나만 읽음) | **4장** (`gs_11749038 / 11750734 / 11750572 / 11749039`, 2000×2739) | 4장 전부 200 |
| Bobo B226AC114 | 7장 | 7장 | 전부 200 (1500×2000) |
| Bobo B226AC049 | 6장 | 6장 | 전부 200 |
| 국내 후보 | **0장** (`facts` 자체가 없음) | LOOXLOO 상세 JSON-LD 8장 / 포레포레 4장 | 검색결과 `imageUrl`은 전부 200 |
| 검색 후보 265건의 `imageUrl` | — | — | **264건 정상 200 image/*, 1건 이미지 URL 없음**(Village Kids `Bold Test` — 판매처의 테스트 상품) |

**핵심: 원본 쪽이 1장만 실린다.** 그래서 `computeMinImageDistance`의 "여러 장 교차비교"가
원본 측에서는 한 번도 작동한 적이 없다.

### 5-3. 실제 비교 결과값 (이번 실측, 로컬 계산만)

모든 값은 **전체 쌍의 최솟값**과 **첫 장끼리만**을 나란히 적었다.
통제: 같은 이미지 자기 자신 → dHash 0, pHash 0, 히스토그램 0.000 (파이프라인 정상)

| 쌍 | 성격 | dHash(fill, 현행) 전체쌍 최소 | dHash 첫장만 | dHash(contain) | aHash(64bit) | **pHash(63bit)** | 색상 히스토그램 L1 |
|---|---|---|---|---|---|---|---|
| 430701 ↔ **B226AC114** | **동일상품** | **34** | 74 | 12 | 0 | **2** | 0.021 |
| 430701 ↔ B226AC049 | 같은 설명문, 회색 후드집업 | 82 | 92 | 59 | 5 | 22 | 0.099 |
| 430701 ↔ 포레포레 스프링레터 스웻셔츠 헤더그레이 | 다른 상품, 같은 색 | 112 | 139 | 112 | 12 | 28 | 0.283 |
| 430701 ↔ 포레포레 피클프렌즈 스웻셔츠 헤더그레이 | 다른 상품, 같은 색 | 108 | 131 | 109 | 12 | 24 | 0.263 |
| 430701 ↔ LOOXLOO 컬러링북 | 명백히 다른 | 110 | 110 | 96 | 17 | 26 | 0.175 |
| 430701 ↔ LOOXLOO 양말팩 | 명백히 다른 | 102 | 108 | 95 | 15 | 32 | 0.522 |
| B226AC114 ↔ B226AC049 | Bobo 내부, 회색끼리 | 54 | 54 | 44 | 1 | 14 | 0.073 |
| B226AC114 ↔ 포레포레 스프링레터 | 다른 상품 | 107 | 125 | 114 | 10 | 28 | 0.227 |

### 5-4. 왜 순서가 뒤집혀 보였는가 — **원인은 "첫 장만 비교했기 때문"이다**

직전 조사에 기록된 값은 `정답쌍 74 / 오답쌍 92 / 서로 다른 두 Bobo 54`였다.
이번 실측의 **"첫 장만"** 열이 정확히 74 / 92 / 54다. 즉 그 세 값은
**각 상품의 1번 사진끼리만** 비교한 값이었고, 뒤집힘은 알고리즘의 실패가 아니라
**입력이 한 장뿐이었던 데서 왔다**.

같은 이미지들을 전체 쌍으로 비교하면 순서가 바로 선다:

```
동일상품 34  <  Bobo 내부 다른상품 54  <  유사·다른 82  <  양말 102 · 컬러링북 110 · 국내 다른상품 108~112
```

그리고 원본 측이 1장만 실리는 이유도 코드에서 확인된다 —
`productFactsFromSmallableHtml`이 JSON-LD의 `image` **문자열 하나**만 읽는다
(`seller-facts.ts`). 페이지에는 4장이 있다.

**두 번째 원인은 `fit:"fill"`이다.** 비율을 보존해 패딩(`contain`)만 바꿔도
동일상품 거리가 34 → **12**로 떨어진다(오답쌍은 82 → 59로만 떨어져 격차가 벌어진다).

### 5-5. 무료·기존 인프라로 개선 가능한가 — 실험 결과

전부 `sharp`(이미 `@commerce/image` 의존성) + 로컬 계산만 썼다. **새 API 없음.**

| 지표 | 동일상품 | 가장 가까운 비동일상품 | 분리 여유 | 판단 |
|---|---|---|---|---|
| dHash fill (현행, 첫장만) | 74 | 54 (Bobo 내부) | **역전** | 쓸 수 없음 |
| dHash fill (전체쌍 최소) | 34 | 54 | 20 | 순서는 맞음 |
| dHash contain (전체쌍 최소) | 12 | 44 | 32 | 더 나음 |
| aHash 64bit | 0 | 1 | 1 | 눈금이 너무 거칠다 |
| **pHash 63bit (32×32 DCT)** | **2** | **14** | **12 (7배)** | **가장 잘 갈린다** |
| 색상 히스토그램 L1 (RGB 4×4×4) | 0.021 | 0.073 | 0.052 | 보조로는 쓸 만함 |

**중요한 단서 — 이 좋은 숫자를 그대로 믿으면 안 된다.**
정답쌍의 pHash 거리 2 / aHash 거리 0은 "매우 비슷한 사진"이 아니라 **사실상 같은 원본
사진**이라는 뜻이다. Smallable이 브랜드 공식 이미지를 그대로 받아 쓰고 있다.
즉 이번 수치는 "**브랜드 공식 이미지를 공유하는 판매처 쌍**"에서만 검증된 것이고,
**자체 촬영을 하는 국내 편집샵에 대해서는 한 쌍도 검증되지 않았다**(국내에 정답
동일상품이 없어 측정 자체가 불가능했다 — **미측정**).

→ CEO 지시대로 **이번에 Matching에 연결하지 않는다.** 다만 "이미지로 구분 가능한가"에
대한 이번 답은: **같은 원본 사진을 공유하는 쌍에서는 pHash로 매우 뚜렷하게 구분된다.
다른 사진을 찍는 쌍에서는 여전히 미검증이다.**

---

## 6. 검색 실패 vs Matching 탈락 — 후보별 분리

| 후보 | A. 검색에 안 나옴 | B. 검색엔 나왔는데 판정 탈락 | 고칠 자리 |
|---|---|---|---|
| **정답 B226AC114 (bobochoses.com)** | **A** — 이 판매처가 `unsupported`(파서 레지스트리에 없음) + 국내 소스 `enabled=false`라 **질의를 보낸 적이 없다**. 질의 자체는 정답을 1위로 물어온다 | (가정 투입 시) 2.0 판정 `SAME` ✅ / 구판 confidence 0.38 `low` ❌ | **검색 대상 등록** + (연결한다면) 구판 점수와 2.0 판정 중 무엇을 쓸지 |
| 지원 15개 판매처의 정답 | **A** — 애초에 **재고가 없다**(전 판매처 실측 확인) | — | 판매처 커버리지 |
| 국내 후보 33건 (LOOXLOO/포레포레/RULII/DEUXBEBE) | 검색엔 나옴 | **B** — 그러나 **판정 자체가 실행되지 않음**(`facts` 미충전 → `crossSellerVerdict=undefined`). 구판 점수만 0~0.3 | **국내 파서의 `facts` 충전** |
| Junior Edition Bobo 후보 31건 | 검색엔 나옴 | **B** — `PRESUMED_SAME` 6 / `SIMILAR` 6 / 나머지 `CONFLICT`. 전부 다른 상품이므로 **정상 배제** | 문제 없음 |
| NICKIS Bobo 후보 11건 | 검색엔 나옴 | **B** — `SIMILAR`, `NO_TITLE_OVERLAP`(독일어 제목). 전부 다른 상품이므로 **정상 배제** | 문제 없음 |
| 해외 비-Bobo 후보 187건 | 검색엔 나옴 | **B** — **187건 전부 `CONFLICT: 브랜드`**. 브랜드 게이트가 제 일을 하고 있다 | 문제 없음 |

**요약: 이번 실패는 B(판정)가 아니라 A(검색 도달)다.**
판정기는 정답을 주면 `SAME`으로 맞히고, 오답 187건을 전부 브랜드로 떨어뜨린다.
문제는 정답이 판정대 위에 **한 번도 올라온 적이 없다**는 것이다.

---

## 7. Ground Truth — CEO가 눈으로 판정할 목록

### 7-1. 브랜드가 실제로 Bobo Choses인 후보 전체 (78건)

각 행의 `판정(사장님)` 칸에 직접 표시해 주십시오. 이미지 URL은 전부 실제로 열리는지
확인했습니다(HTTP 200 + `image/*` content-type).

| # | 판정(사장님) | 판매처 | 상품명 | 가격 | 상품 URL | 대표 이미지 URL | 이미지 열림 | 발견 질의 | confidence | 판정(2.0) | 근거/보류/충돌 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ☐동일 ☐다름 | [대조군] bobochoses.com (정답과 설명문이 같은 다른 상품) | Pixel Abduction all over zipped hoodie | EUR 85 | https://bobochoses.com/products/b226ac049-pixel-abduction-all-over-zipped-hoodie | https://cdn.shopify.com/s/files/1/0705/1899/7292/files/B226AC049_1_1.webp?v=1783422258 | 열림(image/jpeg, 348091B) | Q1/Q2/Q4/Q6/Q7/Q8/Q9b/Q10a-d/Q12half 가 1위로 물어옴(단, 파이프라인은 이 판매처를 unsupported 로 건너뜀) | 0.09 | PRESUMED_SAME | 근거 TITLE+1 CATEGORY+1 COLOR+1 MATERIAL+1 FIT+1 AUDIENCE+1 SIZE+1 / 보류 옷의 형태 HOODIE ↔ SWEATSHIRT / 구판 모델명 유사도 9% |
| 2 | ☐동일 ☐다름 | [대조군] bobochoses.com (정답 동일상품) | Bobo Choses Bolder half zipped sweatshirt | EUR 75 | https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt | https://cdn.shopify.com/s/files/1/0705/1899/7292/files/B226AC114_1_1.webp?v=1783420607 | 열림(image/jpeg, 215345B) | Q1/Q2/Q4/Q6/Q7/Q8/Q9b/Q10a-d/Q12half 가 1위로 물어옴(단, 파이프라인은 이 판매처를 unsupported 로 건너뜀) | 0.38 | SAME | 근거 TITLE+1 CATEGORY+1 COLOR+1 MATERIAL+1 FIT+1 AUDIENCE+1 SIZE+1 / 구판 모델명 유사도 11%·브랜드 일치(제목 내 확인) |
| 3 | ☐동일 ☐다름 | Junior Edition | Monster Mug T Shirt in Heather Grey by Bobo Choses Womenswear | GBP 65 | https://junioredition.com/products/monster-mug-t-shirt-in-heather-grey-by-bobo-choses-womenswear?_pos=1&_psq=Bobo+Choses+Heather+grey&_psid=8b5560a65&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-Womenswear-AW26-Monster-Mug-T-Shirt-Heather-Grey-2.jpg?v=1783511429 | 열림(image/jpeg, 179220B) | Q4,Q6 | 0.44 | CONFLICT | 충돌 대상 ADULT ↔ KIDS / 구판 모델명 유사도 20%·브랜드 일치 |
| 4 | ☐동일 ☐다름 | Junior Edition | Striped Cotton Cardigan in Blue by Bobo Choses Womenswear | GBP 160 | https://junioredition.com/products/striped-cotton-cardigan-in-blue-by-bobo-choses-womenswear?_pos=2&_psq=Bobo+Choses+Organic+Cotton&_psid=199b9f52e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-Womenswear-AW26-Striped-Cotton-Cardigan-1.jpg?v=1783511933 | 열림(image/jpeg, 212067B) | Q5 | 0.39 | CONFLICT | 충돌 대상 ADULT ↔ KIDS / 색상 BLUE ↔ GREY / 구판 모델명 유사도 13%·브랜드 일치 |
| 5 | ☐동일 ☐다름 | Junior Edition | Pearl Knitted Cotton Cardigan in Blue by Bobo Choses Womenswear | GBP 155 | https://junioredition.com/products/pearl-knitted-cotton-cardigan-in-blue-by-bobo-choses-womenswear?_pos=1&_psq=Bobo+Choses+Organic+Cotton&_psid=199b9f52e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-Womenswear-AW26-Pearl-Knitted-Cotton-Cardigan-Blue-1.jpg?v=1783511522 | 열림(image/jpeg, 476793B) | Q5 | 0.38 | CONFLICT | 충돌 대상 ADULT ↔ KIDS / 색상 BLUE ↔ GREY / 구판 모델명 유사도 11%·브랜드 일치 |
| 6 | ☐동일 ☐다름 | Junior Edition | Cookery Festival Cotton Pants by Bobo Choses Womenswear | GBP 50 | https://junioredition.com/products/cookery-festival-pattern-cotton-pants-by-bobo-choses-womenswear?_pos=5&_psq=Bobo+Choses+Organic+Cotton&_psid=199b9f52e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-Womenswear-SS26-Cookery-Festival-Pattern-Cotton-Pant.jpg?v=1768489824 | 열림(image/jpeg, 243196B) | Q5 | 0.38 | CONFLICT | 충돌 대상 ADULT ↔ KIDS / 상품군 PANTS↔TOP / 색상 RED ↔ GREY / 구판 모델명 유사도 11%·브랜드 일치 |
| 7 | ☐동일 ☐다름 | 포레포레 | SS26LW[보보쇼즈]Reading Crocodile 롱삭스 블루-BB26KSSOCI008BLU | KRW 35,000 | https://www.foretforet.com/shop/shopdetail.html?branduid=10255170 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000641703.jpg?1775014897 | 열림(image/jpeg, 54172B) | Q0,Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 8 | ☐동일 ☐다름 | 포레포레 | SS26LW[보보쇼즈]Lazy Dog 롱삭스 레드-BB26KSSOCI007RED | KRW 35,000 | https://www.foretforet.com/shop/shopdetail.html?branduid=10255169 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000641693.jpg?1775014897 | 열림(image/jpeg, 54359B) | Q0,Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 9 | ☐동일 ☐다름 | 포레포레 | SS26LW[보보쇼즈]Happy Worm 롱삭스 커리-BB26KSSOCI006CRY | KRW 35,000 | https://www.foretforet.com/shop/shopdetail.html?branduid=10255168 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000641683.jpg?1775014897 | 열림(image/jpeg, 53888B) | Q0,Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 10 | ☐동일 ☐다름 | 포레포레 | SS26LW[보보쇼즈]보보 박서팬티 블루-BB26KSUNDC051BLU | KRW 25,000 | https://www.foretforet.com/shop/shopdetail.html?branduid=10255167 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000641673.jpg?1775014897 | 열림(image/jpeg, 52539B) | Q0,Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 11 | ☐동일 ☐다름 | 포레포레 | SS26LW[보보쇼즈]보보 브리프팬티 핑크-BB26KSUNDC045PNK | KRW 25,000 | https://www.foretforet.com/shop/shopdetail.html?branduid=10255165 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000641653.jpg?1775014897 | 열림(image/jpeg, 19559B) | Q0,Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 12 | ☐동일 ☐다름 | DEUXBEBE | [보보쇼즈]빅플라워스웨터 | KRW 39,600 | https://www.deuxbebe.com/product/detail.html?product_no=15528&cate_no=62&display_group=1 | https://www.deuxbebe.com/web/product/medium/202311/bd036910f490a05b95ca41afed7ef25a.webp | 열림(image/webp, 754582B) | Q0,Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·브랜드 일치 |
| 13 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈BS고BOBO트랙수트팬츠 (75A7D-415-16) | KRW 99,000 | https://www.looxloo.com/product/보보쇼즈bs고bobo트랙수트팬츠-75a7d-415-16/11064/category/48/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260807/89f0224f364ecc69c398f16678714ae9.jpg | 열림(image/jpeg, 110058B) | Q0,Q1,Q10a,Q10b,Q10d,Q2,Q3,Q4,Q5,Q6,Q7,Q9b | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 14 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 베이비 고BOBO데님윈터캡 (75A7D-P08-02) | KRW 57,000 | https://www.looxloo.com/product/보보쇼즈-베이비-고bobo데님윈터캡-75a7d-p08-02/11148/category/48/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260807/10c7cfb82ca5eaae6873bec33895a950.jpg | 열림(image/jpeg, 199674B) | Q0,Q1,Q10a,Q10b,Q10d,Q2,Q3,Q4,Q5,Q6,Q7,Q9b | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 15 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 베이비 롱퍼프숏양말 (76A7D-P10-03) | KRW 28,000 | https://www.looxloo.com/product/보보쇼즈-베이비-롱퍼프숏양말-76a7d-p10-03/13638/category/28/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260905/324d83bc788a66f1140b5dd3b41244e6.jpg | 열림(image/jpeg, 169337B) | Q0,Q10a,Q10b,Q2,Q3,Q4,Q6,Q7 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 16 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 뉴본 머시몬스터양말팩GN (76A7D-P10-12) | KRW 55,000 | https://www.looxloo.com/product/보보쇼즈-뉴본-머시몬스터양말팩gn-76a7d-p10-12/13629/category/28/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260905/ade1175ad18b839f654963a8ef7cc66f.jpg | 열림(image/jpeg, 190187B) | Q0,Q10a,Q10b,Q2,Q3,Q4,Q6,Q7 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 17 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 컬러링북AW26 (76A7D-CIC-02) | KRW 28,000 | https://www.looxloo.com/product/보보쇼즈-컬러링북aw26-76a7d-cic-02/11406/category/28/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260721/395a885b94b09062a0ef925ffef8ef1a.jpg | 열림(image/jpeg, 63848B) | Q0,Q10a,Q10b,Q2,Q3,Q4,Q6,Q7 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 18 | ☐동일 ☐다름 | 포레포레 | SS26 3차[보보쇼즈]모던 로고 스웻셔츠 그린-BB26KSSSTC142311 | KRW 92,400 | https://www.foretforet.com/shop/shopdetail.html?branduid=10253146 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000625833.jpg?1772071007 | 열림(image/jpeg, 59383B) | Q3 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 19 | ☐동일 ☐다름 | 포레포레 | SS26 3차[보보쇼즈]핸드프린팅 로고 레글런 스웻셔츠-BB26KSSSTC143199 | KRW 92,400 | https://www.foretforet.com/shop/shopdetail.html?branduid=10253137 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000625743.jpg?1772613236 | 열림(image/jpeg, 50990B) | Q3 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 20 | ☐동일 ☐다름 | 포레포레 | SS26 2차[보보쇼즈]베지터블 스웻셔츠 라이트블루-BB26KSSSTC040451 | KRW 92,400 | https://www.foretforet.com/shop/shopdetail.html?branduid=10252674 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000621123.jpg?1771487592 | 열림(image/jpeg, 61959B) | Q3 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 21 | ☐동일 ☐다름 | 포레포레 | SS26 2차[보보쇼즈]피클스 민소매 스웻셔츠 헤더그레이-BB26KSVESC054041 | KRW 87,500 | https://www.foretforet.com/shop/shopdetail.html?branduid=10252637 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000620753.jpg?1771487598 | 열림(image/jpeg, 72966B) | Q3,Q4,Q6 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 22 | ☐동일 ☐다름 | 포레포레 | SS26[보보쇼즈]피클스 스웻셔츠 블루-BB26KSSSTC156041 | KRW 92,400 | https://www.foretforet.com/shop/shopdetail.html?branduid=10250872 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000603213.jpg?1768804727 | 열림(image/jpeg, 95940B) | Q3 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 23 | ☐동일 ☐다름 | 포레포레 | SS26 2차[보보쇼즈]BC 버뮤다 숏츠 헤더그레이-BB26KSSHTC060041 | KRW 55,860 | https://www.foretforet.com/shop/shopdetail.html?branduid=10252658 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000620963.jpg?1771487594 | 열림(image/jpeg, 61308B) | Q4 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 24 | ☐동일 ☐다름 | 포레포레 | SS26[보보쇼즈]스프링레터 크롭 스웻셔츠 헤더그레이-BB26KSSSTC045041 | KRW 87,500 | https://www.foretforet.com/shop/shopdetail.html?branduid=10250835 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000602843.jpg?1768790928 | 열림(image/jpeg, 75209B) | Q4,Q6 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 25 | ☐동일 ☐다름 | 포레포레 | SS26[보보쇼즈]스파이시 피클 후디 헤더그레이-BB26KSHOOC051041 | KRW 103,600 | https://www.foretforet.com/shop/shopdetail.html?branduid=10250813 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000602623.jpg?1768790925 | 열림(image/jpeg, 74273B) | Q4 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 26 | ☐동일 ☐다름 | 포레포레 | SS26[보보쇼즈]베지터블 반팔티 헤더그레이-BB26KSSSVC010041 | KRW 52,500 | https://www.foretforet.com/shop/shopdetail.html?branduid=10250781 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000602303.jpg?1768790542 | 열림(image/jpeg, 79978B) | Q4 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 27 | ☐동일 ☐다름 | 포레포레 | SS26[보보쇼즈][베이비] 피클프렌즈 스웻셔츠 헤더그레이-BB26BSBBYB030041 | 가격 없음 | https://www.foretforet.com/shop/shopdetail.html?branduid=10250845 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000602943.jpg?1768790929 | 열림(image/jpeg, 88283B) | Q6 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 28 | ☐동일 ☐다름 | 포레포레 | SS26[보보쇼즈]피클프렌즈 스웻셔츠 헤더그레이-BB26KSSSTC038041 | 가격 없음 | https://www.foretforet.com/shop/shopdetail.html?branduid=10250833 | https://cdn3-aka.makeshop.co.kr/shopimages/webddle01/0400000602823.jpg?1768790927 | 열림(image/jpeg, 83601B) | Q6 | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 29 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 보보쇼즈팝조깅팬츠 (76A7D-415-02) | KRW 138,000 | https://www.looxloo.com/product/보보쇼즈-보보쇼즈팝조깅팬츠-76a7d-415-02/11509/category/28/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260721/8e47feaa7594b5dd4668d9bc0ce15d99.jpg | 열림(image/jpeg, 121582B) | Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 30 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 보보쇼즈팝레깅스 (76A7D-416-02) | KRW 78,000 | https://www.looxloo.com/product/보보쇼즈-보보쇼즈팝레깅스-76a7d-416-02/11490/category/28/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260721/99592d970206defd185c160cf25eb9eb.jpg | 열림(image/jpeg, 103623B) | Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 31 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 보보쇼즈팝롱양말 (76A7D-812-05) | KRW 42,000 | https://www.looxloo.com/product/보보쇼즈-보보쇼즈팝롱양말-76a7d-812-05/11410/category/28/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260721/f2173c653e9ed980e32ccacf7ee388e2.jpg | 열림(image/jpeg, 131213B) | Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 32 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 보보쇼즈데님캡 (76A7D-800-02) | KRW 98,000 | https://www.looxloo.com/product/보보쇼즈-보보쇼즈데님캡-76a7d-800-02/13681/category/28/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260905/a47fc664e2b026246d0e3bed3b8fc7dd.jpg | 열림(image/jpeg, 111444B) | Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 33 | ☐동일 ☐다름 | LOOXLOO | 보보쇼즈 뉴본 보보쇼즈빕 (76A7D-004-02) | KRW 48,000 | https://www.looxloo.com/product/보보쇼즈-뉴본-보보쇼즈빕-76a7d-004-02/13683/category/28/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260905/2d30d8e89c0dfb774570653e30be0a02.jpg | 열림(image/jpeg, 118360B) | Q12kr | 0.3 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 일치 |
| 34 | ☐동일 ☐다름 | Junior Edition | Bobo Choses Modern Sweatshirt by Bobo Choses - Last Ones In Stock - 4-9 Years | GBP 25.6 | https://junioredition.com/products/bobo-choses-modern-sweatshirt-by-bobo-choses?_pos=1&_psq=Bobo+Choses&_psid=88d5aee1e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Bobo-Choses-Modern-Sweatshirt.jpg?v=1768481924 | 열림(image/jpeg, 159960B) | Q0,Q1,Q10a,Q10b,Q3,Q9b | 0.3 | CONFLICT | 충돌 색상 GREEN ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 35 | ☐동일 ☐다름 | Junior Edition | BC Striped Knitted Baby Playsuit by Bobo Choses | GBP 29.6 | https://junioredition.com/products/bc-striped-knitted-baby-playsuit-by-bobo-choses?_pos=2&_psq=Bobo+Choses&_psid=88d5aee1e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-BC-Striped-Knitted-Baby-Playsuit.jpg?v=1768478666 | 열림(image/jpeg, 252533B) | Q0 | 0.3 | CONFLICT | 충돌 색상 YELLOW ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 36 | ☐동일 ☐다름 | Junior Edition | Bobo Choses By Hand Baby Sweatshirt by Bobo Choses - Last Ones In Stock - 6-12 Months | GBP 21.6 | https://junioredition.com/products/bobo-choses-by-hand-baby-sweatshirt-by-bobo-choses?_pos=3&_psq=Bobo+Choses&_psid=88d5aee1e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Bobo-Choses-By-Hand-Baby-Sweatshirt.jpg?v=1768478736 | 열림(image/jpeg, 99074B) | Q0 | 0.3 | CONFLICT | 충돌 색상 WHITE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 37 | ☐동일 ☐다름 | Junior Edition | Pixel Daisy Baby Cardigan by Bobo Choses | GBP 33.6 | https://junioredition.com/products/pixel-daisy-baby-cardigan-by-bobo-choses?_pos=4&_psq=Bobo+Choses&_psid=88d5aee1e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Pixel-Daisy-Baby-Cardigan.jpg?v=1768478636 | 열림(image/jpeg, 252929B) | Q0,Q5 | 0.3 | CONFLICT | 충돌 색상 RED ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 38 | ☐동일 ☐다름 | Junior Edition | Booo Bo Choses Tag Woven Pants by Bobo Choses | GBP 85 | https://junioredition.com/products/booo-bo-choses-tag-woven-pants-by-bobo-choses?_pos=5&_psq=Bobo+Choses&_psid=88d5aee1e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Booo-Bo-Choses-Tag-Woven-Pants.jpg?v=1784286138 | 열림(image/jpeg, 123933B) | Q0 | 0.3 | CONFLICT | 충돌 상품군 PANTS↔TOP / 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 39 | ☐동일 ☐다름 | Junior Edition | Pickles The Dog Sweatshirt by Bobo Choses | GBP 24.4 | https://junioredition.com/products/pickles-the-dog-sweatshirt-by-bobo-choses?_pos=1&_psq=Bobo+Choses+Zipped+Sweat+Organic+Cotton+%7C+Heather+grey&_psid=c6c5f282c&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Pickles-The-Dog-Sweatshirt.jpg?v=1768480830 | 열림(image/jpeg, 195649B) | Q1,Q10a,Q10b,Q10d,Q2,Q3,Q7 | 0.3 | CONFLICT | 충돌 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 40 | ☐동일 ☐다름 | Junior Edition | Mr Pickles Sweatshirt by Bobo Choses | GBP 25.6 | https://junioredition.com/products/mr-pickles-sweatshirt-by-bobo-choses?_pos=3&_psq=Bobo+Choses+Zipped+Sweat+Organic+Cotton+%7C+Heather+grey&_psid=c6c5f282c&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Mr-Pickles-Sweatshirt.jpg?v=1768480917 | 열림(image/jpeg, 91977B) | Q1,Q10d,Q2,Q3 | 0.3 | CONFLICT | 충돌 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 41 | ☐동일 ☐다름 | Junior Edition | Tangerine All Over Baby Sweatshirt by Bobo Choses - Last Ones In Stock - 12-24 Months | GBP 21.6 | https://junioredition.com/products/tangerine-all-over-baby-sweatshirt-by-bobo-choses?_pos=4&_psq=Bobo+Choses+Zipped+Sweat+Organic+Cotton+%7C+Heather+grey&_psid=c6c5f282c&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Tangerine-All-Over-Baby-Sweatshirt.jpg?v=1768477764 | 열림(image/jpeg, 198353B) | Q1,Q2 | 0.3 | CONFLICT | 충돌 색상 PINK ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 42 | ☐동일 ☐다름 | Junior Edition | Hidden Monster Sweatshirt by Bobo Choses | GBP 61 | https://junioredition.com/products/hidden-monster-sweatshirt-by-bobo-choses?_pos=5&_psq=Bobo+Choses+Zipped+Sweat+Organic+Cotton+%7C+Heather+grey&_psid=c6c5f282c&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Hidden-Monster-Sweatshirt.jpg?v=1784286527 | 열림(image/jpeg, 206861B) | Q1,Q9b | 0.3 | CONFLICT | 충돌 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 43 | ☐동일 ☐다름 | Junior Edition | Tangerine All Over Cropped Sweatshirt by Bobo Choses - Last Ones In Stock - 6-9 Years | GBP 23.6 | https://junioredition.com/products/tangerine-all-over-cropped-sweatshirt-by-bobo-choses?_pos=2&_psq=Bobo+Choses+zipped+sweat&_psid=64cecef63&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Tangerine-All-Over-Cropped-Sweatshirt.jpg?v=1768480730 | 열림(image/jpeg, 116150B) | Q10b,Q2 | 0.3 | CONFLICT | 충돌 색상 PURPLE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 44 | ☐동일 ☐다름 | Junior Edition | Ease Sweatshirt in Bright Blue by Bobo Choses Womenswear | GBP 90 | https://junioredition.com/products/ease-sweatshirt-in-bright-blue-by-bobo-choses-womenswear?_pos=3&_psq=Bobo+Choses+zipped+sweat&_psid=64cecef63&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-Womenswear-AW26-Ease-Sweatshirt-Blue-1.jpg?v=1783511019 | 열림(image/jpeg, 238119B) | Q10b,Q2,Q7 | 0.3 | CONFLICT | 충돌 대상 ADULT ↔ KIDS / 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 45 | ☐동일 ☐다름 | Junior Edition | Bunch Of Vegetables Sweatshirt by Bobo Choses | GBP 24.4 | https://junioredition.com/products/bunch-of-vegetables-sweatshirt-by-bobo-choses?_pos=3&_psq=Bobo+Choses+Sweatshirts&_psid=769a2f2c6&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Bunch-Of-Vegetables-Sweatshirt.jpg?v=1768480613 | 열림(image/jpeg, 154550B) | Q10d,Q3 | 0.3 | CONFLICT | 충돌 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 46 | ☐동일 ☐다름 | Junior Edition | Spring Letters Sweatshirt by Bobo Choses | GBP 24.4 | https://junioredition.com/products/spring-letters-sweatshirt-by-bobo-choses?_pos=5&_psq=Bobo+Choses+Sweatshirts&_psid=769a2f2c6&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Spring-Letters-Sweatshirt.jpg?v=1768480582 | 열림(image/jpeg, 132082B) | Q3 | 0.3 | CONFLICT | 충돌 색상 RED ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 47 | ☐동일 ☐다름 | Junior Edition | Hug Hairy Monster Short Socks by Bobo Choses | GBP 14 | https://junioredition.com/products/hug-hairy-monster-short-socks-by-bobo-choses?_pos=2&_psq=Bobo+Choses+Heather+grey&_psid=8b5560a65&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Hug-Hairy-Monster-Short-Socks.jpg?v=1784286428 | 열림(image/jpeg, 97075B) | Q4 | 0.3 | CONFLICT | 충돌 상품군 ACCESSORY↔TOP / 구판 모델명 유사도 0%·브랜드 일치 |
| 48 | ☐동일 ☐다름 | Junior Edition | Bigtooth Lemon Baby Sweatshirt by Bobo Choses | GBP 52 | https://junioredition.com/products/bigtooth-lemon-baby-sweatshirt-by-bobo-choses?_pos=3&_psq=Bobo+Choses+Heather+grey&_psid=8b5560a65&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Bigtooth-Lemon-Baby-Sweatshirt.jpg?v=1784290075 | 열림(image/jpeg, 146656B) | Q10a,Q4,Q6,Q7,Q9b | 0.3 | PRESUMED_SAME | 근거 CATEGORY+1 MATERIAL+1 FIT+1 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 구판 모델명 유사도 0%·브랜드 일치 |
| 49 | ☐동일 ☐다름 | Junior Edition | Almost Moiré All Over Sheepskin Jacket by Bobo Choses | GBP 142 | https://junioredition.com/products/almost-moire-all-over-sheepskin-jacket-by-bobo-choses?_pos=4&_psq=Bobo+Choses+Heather+grey&_psid=8b5560a65&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Almost-Moire-All-Over-Sheepskin-Jacket.jpg?v=1784289916 | 열림(image/jpeg, 202849B) | Q12kr,Q4,Q7 | 0.3 | CONFLICT | 충돌 상품군 OUTER↔TOP / 구판 모델명 유사도 0%·브랜드 일치 |
| 50 | ☐동일 ☐다름 | Junior Edition | Bigtooth Lemon Sweatshirt by Bobo Choses | GBP 58 | https://junioredition.com/products/bigtooth-lemon-sweatshirt-by-bobo-choses?_pos=5&_psq=Bobo+Choses+Heather+grey&_psid=8b5560a65&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Bigtooth-Lemon-Sweatshirt.jpg?v=1784290097 | 열림(image/jpeg, 192887B) | Q10a,Q4,Q6,Q7,Q9b | 0.3 | SIMILAR | 근거 CATEGORY+1 MATERIAL+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 핏 relaxed fit ↔ loose fit / 구판 모델명 유사도 0%·브랜드 일치 |
| 51 | ☐동일 ☐다름 | Junior Edition | Color Herbalist All Over Woven Dungaree by Bobo Choses | GBP 43.6 | https://junioredition.com/products/color-herbalist-all-over-woven-dungaree-by-bobo-choses?_pos=3&_psq=Bobo+Choses+Organic+Cotton&_psid=199b9f52e&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Color-Herbalist-All-Over-Woven-Dungaree.jpg?v=1768481606 | 열림(image/jpeg, 219949B) | Q5 | 0.3 | CONFLICT | 충돌 색상 WHITE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 52 | ☐동일 ☐다름 | Junior Edition | Bobo Choses Stripes Baby Sweatshirt by Bobo Choses | GBP 49 | https://junioredition.com/products/bobo-choses-stripes-baby-sweatshirt-by-bobo-choses?_pos=2&_psq=Bobo+Choses+Sweatshirts+Heather+grey&_psid=ea20bc70c&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Bobo-Choses-Stripes-Baby-Sweatshirt.jpg?v=1784285954 | 열림(image/jpeg, 145675B) | Q6 | 0.3 | PRESUMED_SAME | 근거 CATEGORY+1 FIT+1 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 소재 cotton:17,organic cotton:17,organic cotton:66,recycled cotton:17 ↔ organic cotton:100 / 구판 모델명 유사도 0%·브랜드 일치 |
| 53 | ☐동일 ☐다름 | Junior Edition | Pixel Abduction All Over Baby Sweatshirt by Bobo Choses | GBP 52 | https://junioredition.com/products/pixel-abduction-all-over-baby-sweatshirt-by-bobo-choses?_pos=5&_psq=Bobo+Choses+Sweatshirts+Heather+grey&_psid=ea20bc70c&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Pixel-Abduction-All-Over-Baby-Sweatshirt.jpg?v=1784287015 | 열림(image/jpeg, 151354B) | Q6 | 0.3 | PRESUMED_SAME | 근거 CATEGORY+1 MATERIAL+1 FIT+1 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 구판 모델명 유사도 0%·브랜드 일치 |
| 54 | ☐동일 ☐다름 | Junior Edition | Bunch Of Vegetables Sweatshirt by Bobo Choses Womenswear | GBP 34 | https://junioredition.com/products/bunch-of-vegetables-sweatshirt-by-bobo-choses-womenswear?_pos=1&_psq=bobo+choses+zipped+sweat+organic+cotton+heather+grey&_psid=45a545c02&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-Womenswear-SS26-Bunch-Of-Vegetables-Straight-Sweatshirt-1.jpg?v=1768490301 | 열림(image/jpeg, 122027B) | Q10b,Q10d,Q9b | 0.3 | CONFLICT | 충돌 대상 ADULT ↔ KIDS / 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 55 | ☐동일 ☐다름 | Junior Edition | Pickles The Dog All Over Sweatshirt by Bobo Choses | GBP 24.4 | https://junioredition.com/products/pickles-the-dog-all-over-sweatshirt-by-bobo-choses?_pos=2&_psq=Bobo+Choses+zipped+sweat+Sweatshirts+Heather+grey&_psid=060ff5f06&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Pickles-The-Dog-All-Over-Sweatshirt.jpg?v=1768484937 | 열림(image/jpeg, 174513B) | Q10a | 0.3 | CONFLICT | 충돌 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 56 | ☐동일 ☐다름 | Junior Edition | Bobo Choses Terry Cloth Jogging Pants by Bobo Choses | GBP 25.6 | https://junioredition.com/products/bobo-choses-terry-cloth-jogging-pants-by-bobo-choses?_pos=1&_psq=Bobo+Choses+zipped+sweat+organic+cotton&_psid=4c3ae56bb&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Bobo-Choses-Terry-Cloth-Jogging-Pants.jpg?v=1768481369 | 열림(image/jpeg, 130954B) | Q10d | 0.3 | CONFLICT | 충돌 상품군 PANTS↔TOP / 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 57 | ☐동일 ☐다름 | Junior Edition | Booty Ghosts T-Shirt by Bobo Choses | GBP 35 | https://junioredition.com/products/booty-ghosts-t-shirt-by-bobo-choses?_pos=1&_psq=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88&_psid=323bde077&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Booty-Ghosts-T-Shirt.jpg?v=1784286236 | 열림(image/jpeg, 82977B) | Q12kr | 0.3 | CONFLICT | 충돌 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 58 | ☐동일 ☐다름 | Junior Edition | Rapid Radish Oversized T-Shirt by Bobo Choses | GBP 18 | https://junioredition.com/products/rapid-radish-oversized-t-shirt-by-bobo-choses?_pos=3&_psq=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88&_psid=323bde077&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Rapid-Radish-Oversized-T-Shirt-1.jpg?v=1768480171 | 열림(image/jpeg, 74304B) | Q12kr | 0.3 | CONFLICT | 충돌 색상 WHITE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 59 | ☐동일 ☐다름 | Junior Edition | Color Herbalist Oversized T-Shirt by Bobo Choses | GBP 18 | https://junioredition.com/products/color-herbalist-oversized-t-shirt-by-bobo-choses?_pos=4&_psq=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88&_psid=323bde077&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-SS26-Color-Herbalist-Oversized-T-Shirt.jpg?v=1768480226 | 열림(image/jpeg, 157963B) | Q12kr | 0.3 | CONFLICT | 충돌 색상 BLUE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 60 | ☐동일 ☐다름 | Junior Edition | Mr. Footish T-Shirt by Bobo Choses | GBP 42 | https://junioredition.com/products/mr-footish-t-shirt-by-bobo-choses?_pos=5&_psq=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88&_psid=323bde077&_ss=e | https://cdn.shopify.com/s/files/1/0874/8574/files/Bobo-Choses-AW26-Mr-Footish-T-Shirt.jpg?v=1784286923 | 열림(image/jpeg, 156122B) | Q12kr | 0.3 | SIMILAR | 근거 CATEGORY+1 FIT+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 소재 cotton:100 ↔ organic cotton:100 / 옷의 형태 SHIRT ↔ SWEATSHIRT / 구판 모델명 유사도 0%·브랜드 일치 |
| 61 | ☐동일 ☐다름 | NICKIS | Top Rosa | EUR 20 | https://nickis.com/products/bobo-choses-top-rosa-3008774207?_pos=1&_psq=Bobo+Choses&_psid=f6625aad5&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/1773127588-3008774207-1.jpg?v=1773127593 | 열림(image/jpeg, 162133B) | Q0,Q10b,Q2,Q3,Q4 | 0.3 | SIMILAR | 근거 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 구판 모델명 유사도 0%·브랜드 일치 |
| 62 | ☐동일 ☐다름 | NICKIS | Overall Grau | EUR 38 | https://nickis.com/products/bobo-choses-overall-grau-3008130793?_pos=2&_psq=Bobo+Choses&_psid=f6625aad5&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/3008130793-1.jpg?v=1773061190 | 열림(image/jpeg, 118975B) | Q0,Q10a,Q10b,Q10d,Q12kr,Q2,Q3,Q4,Q5,Q7,Q9b | 0.3 | SIMILAR | 근거 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 옷의 형태 OVERALL ↔ SWEATSHIRT / 구판 모델명 유사도 0%·브랜드 일치 |
| 63 | ☐동일 ☐다름 | NICKIS | Overall Orange | EUR 36 | https://nickis.com/products/bobo-choses-overall-orange-3008765042?_pos=3&_psq=Bobo+Choses&_psid=f6625aad5&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/3008765042-1.jpg?v=1782819393 | 열림(image/jpeg, 199547B) | Q0,Q10b,Q10d,Q12kr,Q2,Q3,Q5 | 0.3 | CONFLICT | 충돌 색상 ORANGE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 64 | ☐동일 ☐다름 | NICKIS | T-Shirt Squid Grau | EUR 14 | https://nickis.com/products/bobo-choses-t-shirt-squid-grau-6709161961?_pos=4&_psq=Bobo+Choses&_psid=f6625aad5&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/6709161961-1.jpg?v=1776083932 | 열림(image/jpeg, 93082B) | Q0,Q10a,Q10d,Q2,Q3,Q4,Q6,Q7 | 0.3 | SIMILAR | 근거 CATEGORY+1 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 옷의 형태 SHIRT ↔ SWEATSHIRT / 구판 모델명 유사도 0%·브랜드 일치 |
| 65 | ☐동일 ☐다름 | NICKIS | T-Shirt Pelican Blau | EUR 14 | https://nickis.com/products/bobo-choses-t-shirt-pelican-blau-6706079351?_pos=5&_psq=Bobo+Choses&_psid=f6625aad5&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/1677251123-6706079351-1.jpg?v=1776247755 | 열림(image/jpeg, 68779B) | Q0,Q10d,Q5 | 0.3 | SIMILAR | 근거 CATEGORY+1 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 옷의 형태 SHIRT ↔ SWEATSHIRT / 구판 모델명 유사도 0%·브랜드 일치 |
| 66 | ☐동일 ☐다름 | NICKIS | Jacke Weiß | EUR 80 | https://nickis.com/products/bobo-choses-jacke-weiss-3002015916?_pos=4&_psq=Bobo+Choses+zipped+sweat&_psid=0195fd96e&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/1762185148-3002015916-1.jpg?v=1762185155 | 열림(image/jpeg, 203857B) | Q10b,Q2,Q3 | 0.3 | CONFLICT | 충돌 색상 WHITE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 67 | ☐동일 ☐다름 | NICKIS | Minikleid Mehrfarbig | EUR 26 | https://nickis.com/products/bobo-choses-minikleid-mehrfarbig-3000194948?_pos=4&_psq=Bobo+Choses+Heather+grey&_psid=cc3afd161&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/1773128928-3000194948-1.jpg?v=1773128933 | 열림(image/jpeg, 162372B) | Q12kr,Q4 | 0.3 | SIMILAR | 근거 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 구판 모델명 유사도 0%·브랜드 일치 |
| 68 | ☐동일 ☐다름 | NICKIS | Socken Blau | EUR 10.4 | https://nickis.com/products/bobo-choses-socken-blau-3000503521?_pos=5&_psq=Bobo+Choses+Heather+grey&_psid=cc3afd161&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/3000503521-1.jpg?v=1765811355 | 열림(image/jpeg, 239028B) | Q4 | 0.3 | SIMILAR | 근거 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 구판 모델명 유사도 0%·브랜드 일치 |
| 69 | ☐동일 ☐다름 | NICKIS | Top Grün | EUR 14 | https://nickis.com/products/bobo-choses-top-gruen-3004391138?_pos=3&_psq=Bobo+Choses+Organic+Cotton&_psid=30898ebd9&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/1773126560-3004391138-1.jpg?v=1773126566 | 열림(image/jpeg, 192844B) | Q5 | 0.3 | SIMILAR | 근거 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 구판 모델명 유사도 0%·브랜드 일치 |
| 70 | ☐동일 ☐다름 | NICKIS | Jogginghose Mehrfarbig | EUR 37.5 | https://nickis.com/products/bobo-choses-jogginghose-mehrfarbig-3000171547?_pos=4&_psq=Bobo+Choses+Organic+Cotton&_psid=30898ebd9&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/1773062703-3000171547-1.jpg?v=1773062841 | 열림(image/jpeg, 338678B) | Q10d,Q12kr,Q5 | 0.3 | SIMILAR | 근거 AUDIENCE+1 / 보류 핵심 상품명에 겹치는 말이 없다 / 구판 모델명 유사도 0%·브랜드 일치 |
| 71 | ☐동일 ☐다름 | NICKIS | Handschuhe Color Stripes Mehrfarbig | EUR 16 | https://nickis.com/products/bobo-choses-handschuhe-color-stripes-mehrfarbig-7009630858?_pos=2&_psq=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88&_psid=9cd3a0d53&_ss=e | https://cdn.shopify.com/s/files/1/0632/7677/7627/files/7009630858-1.jpg?v=1737512141 | 열림(image/jpeg, 359195B) | Q12kr | 0.3 | CONFLICT | 충돌 색상 ORANGE ↔ GREY / 구판 모델명 유사도 0%·브랜드 일치 |
| 72 | ☐동일 ☐다름 | RULII | [Bobochoses X MiniKyomo] 미니쿄모 X 보보쇼즈  Red apple | KRW 30 | https://www.rulii.co.kr/product/detail.html?product_no=1688&cate_no=23&display_group=1 | https://www.rulii.co.kr/web/product/medium/202307/98eaab39b2301674868f41f80964ae29.png | 열림(image/png, 77783B) | Q0,Q12kr | 0 | 미실행(facts 없음) | 구판 모델명 유사도 0%·브랜드 불일치 |
| 73 | ☐동일 ☐다름 | RULII | [Bobochoses X MiniKyomo] 미니쿄모 X 보보쇼즈  Green hat | KRW 30 | https://www.rulii.co.kr/product/detail.html?product_no=1687&cate_no=23&display_group=1 | https://www.rulii.co.kr/web/product/medium/202307/4a7b3437215670de99bb2e3212b472f2.png | 열림(image/png, 71953B) | Q0,Q12kr | 0 | 미실행(facts 없음) | 구판 모델명 유사도 0%·브랜드 불일치 |
| 74 | ☐동일 ☐다름 | RULII | [Bobochoses X MiniKyomo] 미니쿄모 X 보보쇼즈 Rainbow color | KRW 30 | https://www.rulii.co.kr/product/detail.html?product_no=1686&cate_no=23&display_group=1 | https://www.rulii.co.kr/web/product/medium/202307/21a492812e2e150588e03215daccbb03.png | 열림(image/png, 80488B) | Q0,Q12kr | 0 | 미실행(facts 없음) | 구판 모델명 유사도 0%·브랜드 불일치 |
| 75 | ☐동일 ☐다름 | LOOXLOO | 드로잉플라워7부내의 (45170-054-27) | KRW 39,000 | https://www.looxloo.com/product/드로잉플라워7부내의-45170-054-27/8160/category/27/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260223/bc03e244046efbf6a19ae422ddaed486.jpg | 열림(image/jpeg, 119365B) | Q1,Q10d,Q5,Q9b | 0 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 불일치 |
| 76 | ☐동일 ☐다름 | LOOXLOO | 후르츠뱀부7부우주복 (45170-041-16) | KRW 37,900 | https://www.looxloo.com/product/후르츠뱀부7부우주복-45170-041-16/12685/category/48/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260811/49ad02d47f84f0f7198e60551ef041ba.jpg | 열림(image/jpeg, 73245B) | Q1,Q10d,Q5,Q9b | 0 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 불일치 |
| 77 | ☐동일 ☐다름 | LOOXLOO | 리리7부내의 (45170-054-24) | KRW 39,000 | https://www.looxloo.com/product/리리7부내의-45170-054-24/8159/category/27/display/1/ | https://ecimg.cafe24img.com/pg2014b63687684000/looxloo27/web/product/medium/20260223/13e6f74631880bc6821a340f18d4dff7.jpg | 열림(image/jpeg, 70760B) | Q1,Q10d,Q5,Q9b | 0 | 미실행(facts 없음) | 구판 모델명 유사도 0%·SKU 불일치·브랜드 불일치 |
| 78 | ☐동일 ☐다름 | Folk Berlin | Bobo Bear Brown Bag Charm ECO | EUR 14.95 | https://folkberlin.com/products/bobo-bear-brown-bag-charm-eco?_pos=1&_psq=%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88&_psid=b2011ff3a&_ss=e | https://cdn.shopify.com/s/files/1/0543/4900/4997/files/Bontontoys_bobobear_bagcharm.jpg?v=1776430751 | 열림(image/jpeg, 52758B) | Q12kr | 0 | CONFLICT | 충돌 브랜드 Bon Ton Toys ↔ Bobo Choses / 색상 BROWN ↔ GREY / 구판 모델명 유사도 0%·브랜드 불일치 |

### 7-2. 브랜드가 다른 해외 후보 187건 — 전부 `CONFLICT: 브랜드`

Shopify suggest가 질의와 무관하게 5건을 채워 보내는 탓에 생긴 후보다.
판정기가 **전부 브랜드 충돌로 배제**했으므로 개별 판정이 필요 없다고 보지만,
판매처별 요약을 남긴다.

| 판매처 | 후보 수 | 전부 CONFLICT? | 실제 브랜드(관측) |
|---|---|---|---|
| Designer Kids Wear | 23 | 예 | STONE ISLAND JUNIOR, MOSCHINO, FENDI, MARC JACOBS, STELLA McCARTNEY KIDS, MACKAGE, BALMAIN, Moncler Enfant |
| Folk Berlin | 19 | 예 | Liewood, Gray Label, Mini Rodini, Konges Slojd, Tiny Cottons, Jellycat, Claude & Co |
| Isola Bella Kids | 25 | 예 | AO76, Maison Mangostan, Bonton, SHOOPOM, Morley |
| Petite Maison Kids | 11 | 예 | Petite Maison Kids, Creaciones Calamaro |
| Village Kids | 37 | 예 | Gant, Lyle & Scott, Parajumpers, Lacoste, Boss Kids, Guess, Palm Angels, Monnalisa |
| Kid Biz | 29 | 예 | Hugo, Mayoral, Hugo Boss, Patachou, Stone Island, Billieblush, Kenzo, Fendi |
| Piccoli & Co | 17 | 예 | Piccoli & Co™, Piccoli & Co ® |
| Junior Edition | 10 | 예 | Gray Label 70% Off Sale, Mini Rodini AW26, Main Story AW26, Colorful Standard, Bellerose AW26, Des Petits Hauts AW26, Eleanor Bowmer |
| NICKIS | 16 | 예 | Molo, American Vintage, bellybutton, AO76, Levi's, Abercrombie, Tumble 'N Dry, LES DEUX |

### 7-3. 후보별 증거 축 판독 (같은 78건)

| 판매처 | 상품명 | facts | 브랜드 | 품번 | 상품군 | 색상 | 소재 | 핏 | 형태 | 대상 | 사이즈체계 | 이미지수 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [대조군] bobochoses.com (정답과 설명문이 같은 다른 상품) | Pixel Abduction all over zipped hoodie | 있음 | Bobo Choses | B226AC049 | Sweatshirts/TOP | light heather grey→GREY | organic cotton:100 | loose fit | HOODIE | KIDS | AGE | 6 |
| [대조군] bobochoses.com (정답 동일상품) | Bobo Choses Bolder half zipped sweatshirt | 있음 | Bobo Choses | B226AC114 | Sweatshirts/TOP | light heather grey→GREY | organic cotton:100 | loose fit | SWEATSHIRT | KIDS | AGE | 7 |
| Junior Edition | Monster Mug T Shirt in Heather Grey by Bobo Choses Womenswear | 있음 | Bobo Choses Womenswear AW26 | B226AD010 | T Shirt/TOP | Heather Grey→GREY | cotton:100 | 읽지 못함 | SHIRT | ADULT | 읽지 못함 | 1 |
| Junior Edition | Striped Cotton Cardigan in Blue by Bobo Choses Womenswear | 있음 | Bobo Choses Womenswear AW26 | B226AD043 | Cardigan/- | Blue→BLUE | cotton:100,organic cotton:100 | 읽지 못함 | JACKET | ADULT | 읽지 못함 | 1 |
| Junior Edition | Pearl Knitted Cotton Cardigan in Blue by Bobo Choses Womenswear | 있음 | Bobo Choses Womenswear AW26 | B226AD046 | Cardigan/- | Blue→BLUE | organic cotton:100 | 읽지 못함 | JACKET | ADULT | 읽지 못함 | 1 |
| Junior Edition | Cookery Festival Cotton Pants by Bobo Choses Womenswear | 있음 | Bobo Choses Womenswear 60% Off Sale | B126AD046 | Trousers/PANTS | Red→RED | organic cotton:100 | 읽지 못함 | PANTS | ADULT | 읽지 못함 | 1 |
| 포레포레 | SS26LW[보보쇼즈]Reading Crocodile 롱삭스 블루-BB26KSSOCI008BLU | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→BLUE | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26LW[보보쇼즈]Lazy Dog 롱삭스 레드-BB26KSSOCI007RED | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→RED | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26LW[보보쇼즈]Happy Worm 롱삭스 커리-BB26KSSOCI006CRY | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26LW[보보쇼즈]보보 박서팬티 블루-BB26KSUNDC051BLU | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→BLUE | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26LW[보보쇼즈]보보 브리프팬티 핑크-BB26KSUNDC045PNK | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→PINK | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| DEUXBEBE | [보보쇼즈]빅플라워스웨터 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈BS고BOBO트랙수트팬츠 (75A7D-415-16) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/PANTS | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 베이비 고BOBO데님윈터캡 (75A7D-P08-02) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 베이비 롱퍼프숏양말 (76A7D-P10-03) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/ACCESSORY | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 뉴본 머시몬스터양말팩GN (76A7D-P10-12) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/ACCESSORY | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 컬러링북AW26 (76A7D-CIC-02) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26 3차[보보쇼즈]모던 로고 스웻셔츠 그린-BB26KSSSTC142311 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/TOP | -→GREEN | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26 3차[보보쇼즈]핸드프린팅 로고 레글런 스웻셔츠-BB26KSSSTC143199 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/TOP | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26 2차[보보쇼즈]베지터블 스웻셔츠 라이트블루-BB26KSSSTC040451 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/TOP | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26 2차[보보쇼즈]피클스 민소매 스웻셔츠 헤더그레이-BB26KSVESC054041 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/TOP | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26[보보쇼즈]피클스 스웻셔츠 블루-BB26KSSSTC156041 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/TOP | -→BLUE | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26 2차[보보쇼즈]BC 버뮤다 숏츠 헤더그레이-BB26KSSHTC060041 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26[보보쇼즈]스프링레터 크롭 스웻셔츠 헤더그레이-BB26KSSSTC045041 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/TOP | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26[보보쇼즈]스파이시 피클 후디 헤더그레이-BB26KSHOOC051041 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | HOODIE | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26[보보쇼즈]베지터블 반팔티 헤더그레이-BB26KSSSVC010041 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| 포레포레 | SS26[보보쇼즈][베이비] 피클프렌즈 스웻셔츠 헤더그레이-BB26BSBBYB030041 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/TOP | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 0 |
| 포레포레 | SS26[보보쇼즈]피클프렌즈 스웻셔츠 헤더그레이-BB26KSSSTC038041 | 없음 | BOBO CHOSES | 없음 | 읽지 못함/TOP | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 보보쇼즈팝조깅팬츠 (76A7D-415-02) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/PANTS | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 보보쇼즈팝레깅스 (76A7D-416-02) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 보보쇼즈팝롱양말 (76A7D-812-05) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/ACCESSORY | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 보보쇼즈데님캡 (76A7D-800-02) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 보보쇼즈 뉴본 보보쇼즈빕 (76A7D-004-02) | 없음 | BOBO CHOSES | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| Junior Edition | Bobo Choses Modern Sweatshirt by Bobo Choses - Last Ones In Stock - 4-9 Years | 있음 | Bobo Choses 60% Off Sale | B126AC142 | Sweatshirt/TOP | Green→GREEN | cotton:17,organic cotton:66,recycled cotton:17 | 읽지 못함 | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | BC Striped Knitted Baby Playsuit by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AB102 | Baby Romper/- | Yellow→YELLOW | organic cotton:100 | relaxed fit | 읽지 못함 | KIDS | 읽지 못함 | 1 |
| Junior Edition | Bobo Choses By Hand Baby Sweatshirt by Bobo Choses - Last Ones In Stock - 6-12 Months | 있음 | Bobo Choses 60% Off Sale | B126AB113 | Baby Sweatshirt/TOP | Off White→WHITE | organic cotton:100 | loose fit | SWEATSHIRT | KIDS | 읽지 못함 | 1 |
| Junior Edition | Pixel Daisy Baby Cardigan by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AB097 | Baby Cardigan/- | Red→RED | organic cotton:100 | loose fit | JACKET | KIDS | 읽지 못함 | 1 |
| Junior Edition | Booo Bo Choses Tag Woven Pants by Bobo Choses | 있음 | Bobo Choses AW26 | B226AC067 | Trousers/PANTS | Blue→BLUE | elastomultiester:3,organic cotton:3,organic cotton:97 | loose fit | PANTS | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Pickles The Dog Sweatshirt by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC046 | Sweatshirt/TOP | Midnight Blue→BLUE | organic cotton:66 | relaxed fit | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Mr Pickles Sweatshirt by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC049 | Sweatshirt/TOP | Light Blue→BLUE | organic cotton:100 | 읽지 못함 | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Tangerine All Over Baby Sweatshirt by Bobo Choses - Last Ones In Stock - 12-24 Months | 있음 | Bobo Choses 60% Off Sale | B126AB043 | Baby Sweatshirt/TOP | Fuchsia→PINK | organic cotton:66 | loose fit | SWEATSHIRT | KIDS | 읽지 못함 | 1 |
| Junior Edition | Hidden Monster Sweatshirt by Bobo Choses | 있음 | Bobo Choses AW26 | B226AC038 | Sweatshirt/TOP | Blue→BLUE | cotton:17,organic cotton:17,organic cotton:66,recycled cotton:17 | relaxed fit | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Tangerine All Over Cropped Sweatshirt by Bobo Choses - Last Ones In Stock - 6-9 Years | 있음 | Bobo Choses 60% Off Sale | B126AC044 | Sweatshirt/TOP | Purple→PURPLE | cotton:17,organic cotton:66,recycled cotton:17 | loose fit | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Ease Sweatshirt in Bright Blue by Bobo Choses Womenswear | 있음 | Bobo Choses Womenswear AW26 | B999CD001 | Sweatshirt/TOP | Bright Blue→BLUE | cotton:100 | 읽지 못함 | SWEATSHIRT | ADULT | 읽지 못함 | 1 |
| Junior Edition | Bunch Of Vegetables Sweatshirt by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC040 | Sweatshirt/TOP | Light Blue→BLUE | cotton:17,organic cotton:66,recycled cotton:17 | relaxed fit | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Spring Letters Sweatshirt by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC039 | Sweatshirt/TOP | Red→RED | organic cotton:100 | relaxed fit | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Hug Hairy Monster Short Socks by Bobo Choses | 있음 | Bobo Choses AW26 | B226AI001 | Socks/ACCESSORY | Light Heather→읽지 못함 | elastane:2,organic cotton:24,organic cotton:74,polyamide:2,polyamide:24 | 읽지 못함 | SOCKS | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Bigtooth Lemon Baby Sweatshirt by Bobo Choses | 있음 | Bobo Choses AW26 Baby | B226AB055 | Baby Sweatshirt/TOP | Light Heather→읽지 못함 | organic cotton:100 | loose fit | SWEATSHIRT | KIDS | 읽지 못함 | 1 |
| Junior Edition | Almost Moiré All Over Sheepskin Jacket by Bobo Choses | 있음 | Bobo Choses AW26 | B226AC094 | Jacket/OUTER | Dark Grey→GREY | cotton:100,recycled polyester:100 | 읽지 못함 | JACKET | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Bigtooth Lemon Sweatshirt by Bobo Choses | 있음 | Bobo Choses AW26 | B226AC027 | Sweatshirt/TOP | Light Heather→읽지 못함 | organic cotton:100 | relaxed fit | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Color Herbalist All Over Woven Dungaree by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC110 | Dungarees/- | Off White→WHITE | organic cotton:100 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Bobo Choses Stripes Baby Sweatshirt by Bobo Choses | 있음 | Bobo Choses AW26 Baby | B226AB012 | Baby Sweatshirt/TOP | Light Heather→읽지 못함 | cotton:17,organic cotton:17,organic cotton:66,recycled cotton:17 | loose fit | SWEATSHIRT | KIDS | 읽지 못함 | 1 |
| Junior Edition | Pixel Abduction All Over Baby Sweatshirt by Bobo Choses | 있음 | Bobo Choses AW26 Baby | B226AB058 | Baby Sweatshirt/TOP | Light Heather→읽지 못함 | organic cotton:100 | loose fit | SWEATSHIRT | KIDS | 읽지 못함 | 1 |
| Junior Edition | Bunch Of Vegetables Sweatshirt by Bobo Choses Womenswear | 있음 | Bobo Choses Womenswear 60% Off Sale | B126AD031 | Sweatshirt/TOP | Light Blue→BLUE | organic cotton:100 | 읽지 못함 | SWEATSHIRT | ADULT | 읽지 못함 | 1 |
| Junior Edition | Pickles The Dog All Over Sweatshirt by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC156 | Sweatshirt/TOP | Prussian Blue→BLUE | cotton:17,organic cotton:66,recycled cotton:17 | relaxed fit | SWEATSHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Bobo Choses Terry Cloth Jogging Pants by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC089 | Joggers/PANTS | Midnight Blue→BLUE | organic cotton:72,recycled polyester:28 | loose fit | PANTS | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Booty Ghosts T-Shirt by Bobo Choses | 있음 | Bobo Choses AW26 | B226AC141 | T Shirt/TOP | Light Blue→BLUE | organic cotton:100 | relaxed fit | SHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Rapid Radish Oversized T-Shirt by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC019 | T Shirt/TOP | Off White→WHITE | organic cotton:100 | 읽지 못함 | SHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Color Herbalist Oversized T-Shirt by Bobo Choses | 있음 | Bobo Choses 60% Off Sale | B126AC020 | T Shirt/TOP | Midnight Blue→BLUE | organic cotton:100 | 읽지 못함 | SHIRT | 읽지 못함 | 읽지 못함 | 1 |
| Junior Edition | Mr. Footish T-Shirt by Bobo Choses | 있음 | Bobo Choses AW26 | B226AC020 | T Shirt/TOP | Dark Heather→읽지 못함 | cotton:100 | loose fit | SHIRT | 읽지 못함 | 읽지 못함 | 1 |
| NICKIS | Top Rosa | 있음 | Bobo Choses | 없음 | Top/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 1 |
| NICKIS | Overall Grau | 있음 | Bobo Choses | 없음 | Overall/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | OVERALL | KIDS | 읽지 못함 | 1 |
| NICKIS | Overall Orange | 있음 | Bobo Choses | 없음 | Overall/- | design in orange→ORANGE | 읽지 못함 | 읽지 못함 | OVERALL | KIDS | 읽지 못함 | 1 |
| NICKIS | T-Shirt Squid Grau | 있음 | Bobo Choses | 없음 | T-Shirt/TOP | -→읽지 못함 | 읽지 못함 | 읽지 못함 | SHIRT | KIDS | 읽지 못함 | 1 |
| NICKIS | T-Shirt Pelican Blau | 있음 | Bobo Choses | 없음 | T-Shirt/TOP | -→읽지 못함 | 읽지 못함 | 읽지 못함 | SHIRT | KIDS | 읽지 못함 | 1 |
| NICKIS | Jacke Weiß | 있음 | Bobo Choses | 없음 | Jacke/- | stylischem off white→WHITE | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 1 |
| NICKIS | Minikleid Mehrfarbig | 있음 | Bobo Choses | 없음 | Minikleid/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 1 |
| NICKIS | Socken Blau | 있음 | Bobo Choses | 없음 | Socken/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 1 |
| NICKIS | Top Grün | 있음 | Bobo Choses | 없음 | Top/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 1 |
| NICKIS | Jogginghose Mehrfarbig | 있음 | Bobo Choses | 없음 | Jogginghose/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 1 |
| NICKIS | Handschuhe Color Stripes Mehrfarbig | 있음 | Bobo Choses | 없음 | Handschuhe/- | blau und orange→ORANGE | 읽지 못함 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 1 |
| RULII | [Bobochoses X MiniKyomo] 미니쿄모 X 보보쇼즈  Red apple | 없음 | Mini Kyomo | 없음 | 읽지 못함/- | -→RED | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| RULII | [Bobochoses X MiniKyomo] 미니쿄모 X 보보쇼즈  Green hat | 없음 | Mini Kyomo | 없음 | 읽지 못함/- | -→GREEN | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| RULII | [Bobochoses X MiniKyomo] 미니쿄모 X 보보쇼즈 Rainbow color | 없음 | Mini Kyomo | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 드로잉플라워7부내의 (45170-054-27) | 없음 | BLUEDOG baby | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 후르츠뱀부7부우주복 (45170-041-16) | 없음 | BLUEDOG baby | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| LOOXLOO | 리리7부내의 (45170-054-24) | 없음 | BLUEDOG baby | 없음 | 읽지 못함/- | -→읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 읽지 못함 | 0 |
| Folk Berlin | Bobo Bear Brown Bag Charm ECO | 있음 | Bon Ton Toys | 없음 | Keychain/- | bobo bear brown→BROWN | recycled polyester:100 | 읽지 못함 | 읽지 못함 | KIDS | 읽지 못함 | 1 |

---

## 8. 못 한 것 / 한계

| 항목 | 내용 |
|---|---|
| **Shopify suggest 429 — 원인이 "횟수"가 아니었다** | 1차(병렬, 1.5초 간격)에서 9개 Shopify 판매처가 **동시에** 429. 순차·6초 간격으로 다시 돌려도 첫 요청부터 429. 그런데 **같은 순간 같은 IP에서 `curl`은 200**을 받는다(3회 재현, `Accept` 헤더/HTTP 버전 무관). 즉 이 429는 요청량 한도가 아니라 **node `fetch`(undici) 클라이언트 지문 단계의 차단**으로 보인다. 운영 코드가 바로 이 `fetch`를 쓴다 — "해외 후보 0건"이 재고 문제가 아니라 차단일 수 있다는 뜻이고, **별도 확인이 필요하다**. 이번 조사는 파싱/어댑터는 운영 코드 그대로 두고 **응답을 받는 통로만 curl로 바꿔** 완주했다. |
| Q8(품번) 질의 | **질의 불가.** 우리 데이터에 브랜드 품번이 없다. bobochoses.com에 대해서만 가정 질의(`B226AC114`)를 던져 1위·1건을 확인했다. |
| Q10c | Q2와 문자열이 동일해 국내/해외에서는 중복 제거(`미측정`). bobochoses.com에만 따로 던졌다. |
| Q12 영문 두 개(`half zipped sweatshirt`, `Bolder`) | 국내 5개 판매처에는 보내지 않았다(`미측정`). 한국 상품명에 영어가 없어 의미가 없다고 판단. |
| 국내 정답쌍 이미지 거리 | **미측정.** 국내 어느 판매처에도 이 상품이 없어 "국내 자체 촬영 사진 ↔ 해외 사진"의 동일상품 쌍을 만들 수 없었다. pHash가 그 경우에도 통하는지는 **알 수 없다**. |
| 파서 없는 판매처 | 해외 활성 25곳 중 15곳이 `unsupported`(alexandalexa, babyshop, **bobochoses**, bucketsandspades, cissyweras, kids-world, kidsdepartment.nl, kidsroom.de, luksusbaby, melijoe, mytheresa, pandaandcub, scoutandcokids, smallable, studioplay). 국내는 MANUAL 6곳이 `unsupported`. 이들은 질의를 보내지 않았다. |
| 레지스트리 불일치 | `SHOPIFY_SUGGEST_DOMAINS`에 있는 `kidswearcollective.com` / `kidsatelier.com`은 `comparison_shops` 테이블에 **행 자체가 없다** → 영원히 검색되지 않는다. |
| 이미지 실험 표본 | 쌍 8개. 그중 동일상품 쌍은 **1개**뿐이고 그것도 "같은 원본 사진을 공유하는" 쌍이다. 일반화 금지. |

---

## 부록 A. 원본 430701에서 실제로 읽어낸 사실 (`ProductFacts`, 실측)

```
sourceUrl        https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701
urlSlug          bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701
brand            Bobo Choses
brandModelCode   null            ← 브랜드 품번이 페이지에 없다
sellerSku        AAA1804922      ← Smallable 자신의 번호
title            Bobo Choses Zipped Sweat Organic Cotton | Heather grey
coreTitleTokens  ["zipped","sweat"]
categoryText     Sweatshirts
colorText        Heather grey                 → GREY
materialText     SIZE AND FIT Loose fit COMPOSITION 100% Organic Cotton …  → organic cotton:100
fitText          loose fit
sizeLabels       4/5 years, 6/7 years, 8/9 years, 10/11 years, 12/13 years → AGE
audienceSignals  Home, "Fashion  Children", Boy, Sweatshirts → KIDS
imageUrls        1장  (페이지에는 4장)
```

## 부록 B. 조사 대상 판매처 (DB 실측, 2026-09-14)

**국내 `domestic_price_sources`** — 자동 수집 + 활성 + 파서 있음 (질의를 보낸 곳):
`looxloo.com`, `rulii.co.kr`, `deuxbebe.com`, `chocoel.co.kr`, `foretforet.com`
`bobochoses.com`은 `AUTO_API` + 파서 있음이지만 **`enabled = false`**.
MANUAL 6곳(`chouchouenfant.kr`, `coconjennie.com`, `karymarket.com`,
`kidikidi.elandmall.co.kr`, `nokimore.com`, `ocokorea.com`)은 `unsupported`.
비활성 4곳(`29cm.co.kr`, `musinsa.com`, `ssfshop.com`, `wconcept.co.kr`).

**해외 `comparison_shops`** — 활성 25곳 중 파서 있음 10곳 (질의를 보낸 곳):
`junioredition.com`, `nickis.com`, `isolabellakids.com`, `petitemaisonkids.com`,
`shoppiccoliandco.com`, `designerkidswear.com`, `kidbizkid.com`, `villagekids.co.uk`,
`folkberlin.com`, `childrensalon.com`

## 부록 C. 파이프라인이 실제로 쓰는 질의 (재확인)

- **국내 경로**: `buildCrossSellerSearchQueries`의 사다리를 순서대로 던지고 **결과가
  나오는 즉시 멈춘다**(`index.ts:318`). 430701에서는 `[Q10a, Q10b, Q10c, Q10d]`.
  ① 품번 칸은 `brandModelCode=null`이라 비어 있어 사다리에서 빠진다.
- **해외 경로**: 사다리를 쓰지 않는다. `searchOneShop`이 **`query.title` 원문 하나**만
  던진다(= Q1). 정제되지 않은 10단어 영문 제목이 그대로 나간다.
- **브랜드 alias 폴백**: `lookupBrandAlias("Bobo Choses")` → `undefined`.
  `brand-alias.ts`에 등록된 브랜드는 PèPè / Emile et Ida / Konges Slojd 3개뿐이라
  **Bobo Choses는 이 경로가 발화하지 않는다**. 그런데 실측상 `보보쇼즈`가 국내
  판매처에서 가장 안정적으로 브랜드 재고를 물어온다(§2).
