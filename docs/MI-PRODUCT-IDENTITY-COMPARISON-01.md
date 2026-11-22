# MI-PRODUCT-IDENTITY-COMPARISON-01 — 후보 8건 상품 동일성 비교표

> 🔴 **이 문서는 «자료» 다. 판단은 CPO 가 한다.**
> CTO 는 ①원본 사실 ②기존 MI 판정 ③CTO 데이터 분석 셋을 **분리해서** 적었다.
> 🔴 운영 코드 변경 **0** · DB 쓰기 **0** · 화면 변경 **0** · 판정 로직 변경 **0**.

작성 2026-11-22 · 스냅샷 `25a3bba7-fe75-464b-95b2-0da2ef83ec44`

---

## §0. 데이터 출처와 분모 — 🔴 먼저 적는다

```
① 운영 DB(읽기 전용 SELECT)   product_snapshots.workspace.canonicalProduct · candidate_reviews
   → fixtures/mic01-db-pull.json    후보 전수 10 · 저장 시점 last_seen_at 2026-11-07
② 라이브 원문(운영 추출기 그대로)  factsFromProductUrl — 새 크롤러 0 · HTTP 10회 · 9/9 OK
   → fixtures/mic01-candidate-originals.json
③ 식별 근거                   summarizeIdentityEvidence(운영 owner) 11축 × 8건
```

**분모 대조** — 지시서의 수치와 일치한다.

| 구분 | 지시서 | 실측(DB) | 일치 |
|---|---|---|---|
| 전체 후보 | 10 | 10 | 🟢 |
| 검토 대상(확정 SAME 제외) | 8 | 8 | 🟢 |
| 확정 SAME | 2 | bonbonverona.it · mariodannakids.it | 🟢 |
| 국내(KR) | 0 | 0 | 🟢 |
| 해외(OVERSEAS) | 6 | 6 | 🟢 |
| 시장 미확정(UNKNOWN) | 2 | coupleshot.com · kids-world.com | 🟢 |

🔴 **중복·누락 0** — URL 키로 대조했고 8건은 `price_tier=EXACT && system_verdict=SAME` 을
제외한 **전수** 다(손으로 고르지 않았다).

---

## §1. 기준(원본) 상품 — 운영 저장값 그대로

| 항목 | 값 | 출처/신뢰도 |
|---|---|---|
| URL | `https://bobochoses.com/en-kr/products/b226ac033-bobo-choses-pop-sweatshirt` | canonical `sourceUrl` |
| 브랜드 원값 | **Bobo Choses** | `ORIGINAL` conf 0.95 |
| 품번(`sku`) 원값 | **""(빈 문자열)** → 확인 불가 | `ORIGINAL` conf **0** |
| 🟢 품번(운영 추출기) | **B226AC033** | `facts.brandModelCode`(URL slug 유래) |
| 상품명(영문) | **Bobo Choses Pop sweatshirt** | `ORIGINAL` conf 0.95 |
| 상품명(한글) | `Bobo Choses Pop sweatshirt` — 🔴 **번역되지 않은 영문 그대로** | `titleKo` **AI_GENERATED** conf 0.7 |
| 상세설명(영문 원문) | `Midnight blue sweatshirt. Organic Cotton 66%, Recycled Cotton 22%, Cotton 12%. Loose fit. Responsibly made in Spain.` | `ORIGINAL` conf 0.95 (116자) |
| 상세설명(한글) | `브랜드: Bobo Choses / 상품 종류: **티셔츠** / 색상: Midnight blue / 옵션 Clothing size: 2-3Y…13Y / 원문 설명: "…"` | **AI_GENERATED** conf 0.95 (228자) |
| 색상 | Midnight blue | conf 0.7 |
| 소재(`material`) | **""(빈 문자열)** | conf 0 |
| 가격 | **EUR 62** · `priceValidity=VALID` | `ORIGINAL` conf 0.95 |
| 이미지(저장 `images`) | 3장인데 **`url` 이 전건 `null`** | 🔴 저장 결함 |
| 🟢 이미지(운영 추출기) | `…/files/B226AC033_6.jpg?v=1794389793` | 라이브 추출 |
| keywords | `aw26 · children · clothing · Current · drop-2 · Kid · sweatshirts · Bobo Choses` | conf 0.9 |

### 🔴🔴 원본 쪽 데이터 문제 넷 (CPO 판단 입력)

```
① 품번 저장 칸이 비었다      `sku.value=""` 인데 추출기는 **B226AC033** 을 안다 ⟹ 두 값이 다르다
② 한글 상품명이 번역 안 됐다  `titleKo` = 영문 원문 그대로(AI_GENERATED 인데 번역 결과가 아니다)
③ 한글 상세설명이 **분류를 틀렸다**  「상품 종류: **티셔츠**」 — 실제는 sweatshirt(맨투맨)
④ 소재 칸이 비었다          상세설명에는 Organic/Recycled Cotton 비율이 **있는데** `material=""`
🔴🔴 ⑤ **원본 상세설명에 브랜드도 품번도 «없다»** — 식별 근거 11축에서
   `BRAND origin=[]` · `MODEL_CODE origin=[]` 가 **8건 전부** 다.
   ⟹ 그래서 그 두 축이 **구조적으로 MISSING** 이고, 후보가 품번을 적어도 «양쪽 비교» 가 안 된다.
```

---

## §2. 8건 전체 요약표

🔴 「MI 판정」은 **운영이 저장한 값** 이고 「핵심 비동일 사유」는 **운영 blockers 원문** 이다.
🔴 CTO 판단이 아니다.

| # | 후보(도메인) | 시장 | 브랜드(라이브 추출) | 품번(라이브) | 상품명 비교 | 상세설명 식별정보 | 영문·한글 문제 | MI 판정 | 핵심 비동일 사유(blockers) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | coupleshot.com | UNKNOWN | **null**(없음) | **B226AC033** ✅ | 🔴 제목이 **깨진 문자**(mojibake) | 후보: **품번 O** · 브랜드 X / 원본: 둘 다 X | ② 인코딩 손상 · ⑦ 상품명 판단 불가 | PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON | `NO_TITLE_OVERLAP` · `BRAND_UNCONFIRMED` |
| 2 | designerkidswear.com | OVERSEAS | **FENDI** | null | CONFLICT(Baby Boys Blue Cotton Bear Sweatshirt) | 후보: 둘 다 X | ④ 의미 차이 | PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON | `BRAND_MISMATCH` · `NO_TITLE_OVERLAP` · `MATERIAL` · `AUDIENCE_LINE` |
| 3 | folkberlin.com | OVERSEAS | **Gray Label** | null | CONFLICT(독일어 Baby-Sweateranzug „Blue Moon") | 후보: 둘 다 X | ②+④ 독일어 · 의미 차이 | PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON | `BRAND_MISMATCH` · `NO_TITLE_OVERLAP` · `MATERIAL` · `AUDIENCE_LINE` |
| 4 | **junioredition.com** | OVERSEAS | **Bobo Choses** ✅ | **B226AC033** ✅ | PRESENT(Bobo Choses Pop Sweatshirt by Bobo Choses) | 후보: **품번 O**(「Product code B226AC033 AW26」) / 원본: 둘 다 X | ① 표기 차이(by Bobo Choses) | PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON | `MATERIAL` **하나** |
| 5 | kidbizkid.com | OVERSEAS | **Lacoste** | null | CONFLICT(Lacoste Navy Sweatshirt) | 후보: 둘 다 X | ④ 의미 차이 | PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON | `BRAND_MISMATCH` · `COLOR_VARIANT` · `NO_TITLE_OVERLAP` · `AUDIENCE_LINE` |
| 6 | **kids-world.com** | UNKNOWN | **Bobo Choses** ✅ | **B226AC033** ✅ | CONFLICT(한글 「Bobo Choses 맨투맨 - 미드나잇 블루 포함 프린트」) | 후보: **브랜드 O + 품번 O** / 원본: 둘 다 X | ②+③ 한글 번역(「포함」은 오역 의심) | PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON | `NO_TITLE_OVERLAP` **하나** |
| 7 | petitemaisonkids.com | OVERSEAS | **Petite Maison Kids** | null | CONFLICT(Maya Girls' Blue Cotton Sweater Top) | 후보: 둘 다 X | ④ 의미 차이(옷 형태) | PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON | `BRAND_MISMATCH` · `NO_TITLE_OVERLAP` · `MATERIAL` · `AUDIENCE_LINE` · `GARMENT_FORM` |
| 8 | shoppiccoliandco.com | OVERSEAS | **Piccoli & Co™** | null | CONFLICT(Jude Navy Baby Boy Anchor Sweater) | 후보: 둘 다 X | ④ 의미 차이 | PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON | `BRAND_MISMATCH` · `COLOR_VARIANT` · `NO_TITLE_OVERLAP` · `AUDIENCE_LINE` |

### 🟢 요약표에서 바로 보이는 것 (CTO 사실 분석)

```
품번 B226AC033 을 들고 있는 후보   **3건** — #1 coupleshot · #4 junioredition · #6 kids-world
브랜드 Bobo Choses 를 들고 있는 후보 **2건** — #4 junioredition · #6 kids-world
🔴 그 3건은 전부 blockers 가 **1~2개** 다(다른 5건은 4~5개)
🔴 다른 5건은 브랜드가 **각기 다른 브랜드** 다(FENDI · Gray Label · Lacoste ·
   Petite Maison Kids · Piccoli & Co™) ⟹ 브랜드 불일치가 **실재** 한다
```

---

## §3. 후보별 상세 비교표 8장

### 후보 1 — `coupleshot.com`

**기본 정보**

| 항목 | 원본 상품 | 후보 상품 | 비교 결과 |
|---|---|---|---|
| 시장 | 기준 상품 | **UNKNOWN** | — |
| 브랜드 | Bobo Choses | **null**(추출 안 됨) | **확인 불가** |
| 품번·모델코드 | 저장 `""` / 추출 B226AC033 | **B226AC033** | 🟢 **일치**(추출값 기준) |
| 상품명(영문) | Bobo Choses Pop sweatshirt | 🔴 `̴Ŀü`(mojibake) | **확인 불가** |
| 상품명(한글) | 영문 그대로(미번역) | 🔴 인코딩 손상으로 판독 불가 | **확인 불가** |
| 이미지 | `B226AC033_6.jpg` | `coupleshot/0110330001042.jpg` | **차이**(URL 기준 · 육안 미확인) |
| URL | 위 §1 | `http://www.coupleshot.com/m/product.html?branduid=574657&special=1` | 원본 링크 |
| 가격 | EUR 62 | **KRW 135,000**(저장·라이브 동일 · VERIFIED_CURRENT) | 통화 다름 |

**상세설명 식별정보 비교**

| 확인 항목 | 원본 상세설명 | 후보 상세설명 | 비교 결과 |
|---|---|---|---|
| 브랜드 포함 여부 | **미포함** | **미포함** | 양쪽 없음 |
| 상세설명 속 브랜드 원문 | — | — | — |
| 품번 포함 여부 | **미포함** | **포함** | 🔴 **비대칭** |
| 상세설명 속 품번 원문 | — | `B226AC033`(source=DESCRIPTION) | 원본에 없어 비교 불가 |
| 상품명 포함 여부 | 포함(TITLE) | 포함(TITLE · 손상) | PRESENT(둘 다 있음) |
| 영문 표현 문제 | 없음 | 🔴 **EUC-KR 오디코딩**(제목·본문) | 유형 ② |
| 한글 번역 문제 | 🔴 `titleKo` 미번역 | 판독 불가 | 유형 ⑦ |
| 소재·색상·디자인 차이 | cotton 12 / organic 66 / recycled 22 · Midnight blue · loose fit | **전부 없음** | MISSING(차이 아님) |
| 기타 식별 근거 | — | 카테고리 문자열에 `BOBO CHOSES … 2026aw bobo choses` | 🟢 **판매처 분류에 브랜드가 있다** |

**MI 자동 판정 결과**

| 항목 | 결과 |
|---|---|
| MI verdict | `PRESUMED_SAME` |
| matchTruth | `TEXT_CONFIRMED` |
| priceTier | `COMPARISON` |
| blockers | `NO_TITLE_OVERLAP` · `BRAND_UNCONFIRMED` |
| conflicts | (저장 blockers 와 합쳐져 저장됨 — 별도 충돌 없음) |
| 자동 판정의 핵심 근거 | 「근거: **브랜드 품번 일치**」 · 「모델명 유사도 0%」 · 판정방법 `CROSS_SELLER_AXES` |
| 자동 판정에서 부족한 정보 | 후보 브랜드 원값 **없음** · 제목 **손상** · 색상/소재 **없음** |

---

### 후보 2 — `designerkidswear.com`

**기본 정보**

| 항목 | 원본 상품 | 후보 상품 | 비교 결과 |
|---|---|---|---|
| 시장 | 기준 상품 | OVERSEAS | — |
| 브랜드 | Bobo Choses | **FENDI** | **불일치** |
| 품번·모델코드 | B226AC033(추출) | **null** | **확인 불가** |
| 상품명(영문) | Bobo Choses Pop sweatshirt | Baby Boys Blue Cotton Bear Sweatshirt | **불일치**(CONFLICT) |
| 상품명(한글) | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | `BUH088-8RA-F19J4-1.jpg` | **차이** |
| URL | 위 §1 | `https://designerkidswear.com/products/fendi-baby-boys-sweatshirt-blue-buh088-8ra-f19j4` | 원본 링크 |
| 가격 | EUR 62 | **CAD 530**(저장·라이브 동일 · UNVERIFIED_SEARCH) | 통화 다름 |

**상세설명 식별정보 비교**

| 확인 항목 | 원본 | 후보 | 비교 결과 |
|---|---|---|---|
| 브랜드 포함 여부 | 미포함 | 미포함(단 본문에 「Fendi kids」 문구 있음) | — |
| 품번 포함 여부 | 미포함 | 미포함 | 양쪽 없음 |
| 상품명 포함 여부 | 포함 | 포함 | PRESENT |
| 영문 표현 문제 | 없음 | 없음 | — |
| 한글 번역 문제 | `titleKo` 미번역 | 해당 없음 | — |
| 소재·색상·디자인 차이 | organic/recycled cotton · Midnight blue | **93% Cotton 7% Elastane** · Blue · teddy bear Zucca print · Made in Portugal | 🔴 **COMPOSITION CONFLICT** · **COLOR CONFLICT** |
| 기타 식별 근거 | — | URL·이미지에 `BUH088-8RA-F19J4`(Fendi 품번) | 🔴 **다른 브랜드의 품번이 명시돼 있다** |

**MI 자동 판정 결과** — verdict `PRESUMED_SAME` · truth `TEXT_CONFIRMED` · tier `COMPARISON`
blockers `BRAND_MISMATCH` · `NO_TITLE_OVERLAP` · `MATERIAL` · `AUDIENCE_LINE`
근거 「상품군 TOP↔TOP」·「색상 BLUE」·「대상 KIDS」 / 보류 「브랜드 Bobo Choses ↔ FENDI」·「연령 라인 CHILD ↔ BABY」
부족한 정보: 후보 품번 **없음**(있어도 Fendi 품번이다)

---

### 후보 3 — `folkberlin.com`

**기본 정보**

| 항목 | 원본 상품 | 후보 상품 | 비교 결과 |
|---|---|---|---|
| 시장 | 기준 상품 | OVERSEAS | — |
| 브랜드 | Bobo Choses | **Gray Label** | **불일치** |
| 품번·모델코드 | B226AC033(추출) | **null** | 확인 불가 |
| 상품명(영문) | Bobo Choses Pop sweatshirt | 저장 `Baby Sweater Suit ''Blue Moon'' Organic Cotton` / 라이브 **독일어** `Baby-Sweateranzug „Blue Moon" Bio-Baumwolle` | **불일치**(CONFLICT) |
| 상품명(한글) | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | `Graylabel-baby-BlueMoon-9774.jpg` | **차이** |
| URL | 위 §1 | `https://folkberlin.com/products/baby-sweatsuit-blue-moon-organic-cotton` | 원본 링크 |
| 가격 | EUR 62 | **EUR 39**(저장·라이브 동일 · UNVERIFIED_SEARCH) | 같은 통화 · 금액 다름 |

**상세설명 식별정보 비교** — 양쪽 브랜드·품번 **미포함** · 후보 소재/색상/핏 **추출 0**
🔴 `FORM` 축이 후보 쪽 **MISSING**(sweatsuit = 세트 상의+하의로 보이는데 축이 비었다)
영문·한글 문제: **유형 ②**(저장 제목은 영어 · 라이브는 독일어 — **로케일 차이**) + **유형 ④**(의미 차이)
🔴 저장 `match_reasons` 는 후보 소재를 `organic cotton:100` 으로 적었는데 **라이브 추출은 소재 0** ⟹ 시점 차이

**MI 자동 판정 결과** — `PRESUMED_SAME` / `TEXT_CONFIRMED` / `COMPARISON`
blockers `BRAND_MISMATCH` · `NO_TITLE_OVERLAP` · `MATERIAL` · `AUDIENCE_LINE`

---

### 후보 4 — `junioredition.com` 🟢 **가장 강한 동일 근거**

**기본 정보**

| 항목 | 원본 상품 | 후보 상품 | 비교 결과 |
|---|---|---|---|
| 시장 | 기준 상품 | OVERSEAS | — |
| 브랜드 | Bobo Choses | **Bobo Choses** | 🟢 **일치** |
| 품번·모델코드 | B226AC033(추출) | **B226AC033** | 🟢 **일치** |
| 상품명(영문) | Bobo Choses Pop sweatshirt | **Bobo Choses Pop Sweatshirt by Bobo Choses** | 🟢 **일치**(표기 차이 — 유형 ①) |
| 상품명(한글) | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | `Bobo-Choses-AW26-Bobo-Choses-Pop-Sweatshirt.jpg` | 🟡 **URL 다름 · 파일명이 같은 상품을 가리킨다**(육안 미확인) |
| URL | 위 §1 | `https://junioredition.com/products/bobo-choses-pop-sweatshirt-by-bobo-choses` | 원본 링크 |
| 가격 | EUR 62 | 🔴 저장 **GBP 58** → 라이브 **GBP 40.6** (VERIFIED_CURRENT) | **시점 차이**(세일 추정 · 단정 안 함) |

**상세설명 식별정보 비교**

| 확인 항목 | 원본 | 후보 | 비교 결과 |
|---|---|---|---|
| 브랜드 포함 여부 | **미포함** | 포함(본문 「by Bobo Choses」) | 🔴 비대칭 |
| 품번 포함 여부 | **미포함** | **포함** | 🔴 비대칭 |
| 상세설명 속 품번 원문 | — | **`Product code B226AC033 AW26`** | 🟢 원본 URL slug 와 **같은 값** |
| 상품명 포함 여부 | 포함 | 포함 | **PRESENT** |
| 소재 | cotton 12 / organic 66 / recycled 22 | **66% Organic Cotton 22% Recycled Cotton 12% Cotton** | 🟢 **같은 조성**(순서만 다름) |
| 색상 | Midnight blue | **Midnight Blue** | 🟢 **PRESENT(일치)** |
| 핏 | loose fit | relaxed fit | 🟡 **FIT CONFLICT**(표현 차이) |
| 기타 | Made in Spain | **Made in Spain** | 🟢 일치 |

🔴🔴 **그런데 운영이 `MATERIAL` 을 blocker 로 저장했다.** 저장 사유 원문:
`보류: 소재 cotton:12,organic cotton:66,recycled cotton:22 ↔ cotton:12,organic cotton:22,organic cotton:66,recycled cotton:12,recycled cotton:22`
🟢 CTO 사실 분석 — 후보 쪽 조성 문자열에 **같은 소재가 두 비율로 중복 파싱** 돼 있다
(`organic cotton:22` **와** `organic cotton:66`). 라이브 재현에서도 같은 모양이다.
⟹ 🔴 **소재가 실제로 다른 것이 아니라 «파싱 산출물이 다른» 것으로 보인다.** 단정하지 않는다.

**MI 자동 판정 결과**

| 항목 | 결과 |
|---|---|
| MI verdict | `PRESUMED_SAME` |
| matchTruth | `TEXT_CONFIRMED` |
| priceTier | `COMPARISON` |
| blockers | **`MATERIAL` 하나** |
| 자동 판정의 핵심 근거 | 「모델명 유사도 **100%**」·「브랜드 **일치**」·「**브랜드 품번 일치**」·「핵심 상품명 pop」·「상품군 TOP↔TOP」·「색상 BLUE」·「핏 loose↔relaxed(**표현 차이 · 동일 브랜드 품번 완전일치 교차판매처**)」 · 텍스트등급 **very_high** |
| 자동 판정에서 부족한 정보 | 🔴 `품번증거=unavailable (해외 B226AC033 ↔ 국내 없음)` — **원본 쪽 품번 증거가 없어** 식별자 경로로 못 간다 |

---

### 후보 5 — `kidbizkid.com`

| 항목 | 원본 | 후보 | 비교 |
|---|---|---|---|
| 시장 | 기준 | OVERSEAS | — |
| 브랜드 | Bobo Choses | **Lacoste** | **불일치** |
| 품번 | B226AC033(추출) | null | 확인 불가 |
| 상품명(영문) | Bobo Choses Pop sweatshirt | Lacoste Navy Sweatshirt | **불일치** |
| 상품명(한글) | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | 🔴 `Gemini_Generated_Image_t1qy12t1qy12t1qy.jpg` — **AI 생성 이미지 파일명** | **차이** |
| URL | 위 §1 | `https://kidbizkid.com/products/lacoste-navy-sweatshirt` | 원본 링크 |
| 가격 | EUR 62 | 🔴 저장 **CAD 10,300** → 라이브 **KRW 87,000** | **저장값 이상**(§5 참조) |

상세설명: 양쪽 브랜드·품번 **미포함** · 후보 소재/조성 **추출 0** · 색상 `Navy / in sleek navy`
MI: `PRESUMED_SAME` / `TEXT_CONFIRMED` / `COMPARISON` ·
blockers `BRAND_MISMATCH` · `COLOR_VARIANT` · `NO_TITLE_OVERLAP` · `AUDIENCE_LINE`

---

### 후보 6 — `kids-world.com` 🟢 **두 번째로 강한 동일 근거**

**기본 정보**

| 항목 | 원본 상품 | 후보 상품 | 비교 결과 |
|---|---|---|---|
| 시장 | 기준 상품 | **UNKNOWN** (🔴 `.com` + KRW ⟹ KR 로 단정 안 함) | — |
| 브랜드 | Bobo Choses | **Bobo Choses** | 🟢 **일치** |
| 품번·모델코드 | B226AC033(추출) | **B226AC033** | 🟢 **일치** |
| 상품명(영문) | Bobo Choses Pop sweatshirt | (영문 제목 없음 — 한글 페이지) | 확인 불가 |
| 상품명(한글) | 🔴 미번역(영문 그대로) | **Bobo Choses 맨투맨 - 미드나잇 블루 포함 프린트** | 🟡 **의미 일치**(아래 분석) |
| 이미지 | `B226AC033_6.jpg` | `cdn.kids-world.com/images/products/IY026/681px/IY026.jpg` | **차이**(판매처 자체 코드 `IY026`) |
| URL | 위 §1 | `https://www.kids-world.com/ko-kr/bobo-choses-sweatshirt-midnight-blue-print-p-450718.html` | 원본 링크 |
| 가격 | EUR 62 | **KRW 106,000**(저장·라이브 동일 · VERIFIED_CURRENT) | 통화 다름 |

**상세설명 식별정보 비교**

| 확인 항목 | 원본 | 후보 | 비교 결과 |
|---|---|---|---|
| 브랜드 포함 여부 | **미포함** | **포함** | 🔴 비대칭 |
| 상세설명 속 브랜드 원문 | — | **`Bobo Choses`**(source=DESCRIPTION) | 원본에 없어 비교 불가 |
| 품번 포함 여부 | **미포함** | **포함** | 🔴 비대칭 |
| 상세설명 속 품번 원문 | — | **`B226AC033`** | 🟢 원본 URL slug 와 같은 값 |
| 상품명 포함 여부 | 포함 | 포함 | **CONFLICT**(토큰 겹침 0) |
| 영문 표현 문제 | 없음 | 해당 없음(한글 페이지) | — |
| 한글 번역 문제 | 🔴 `titleKo` 미번역 | 🟡 **「포함 프린트」** — 영문 `print` 를 「포함 프린트」로 적었다(**오역 의심**). 🔴 CTO 가 번역을 정정하지 않았다 | 유형 ③ |
| 소재·색상 | organic/recycled cotton · Midnight blue | **추출 0** (URL·제목에 `midnight blue` 는 있다) | MISSING |
| 기타 | — | URL 에 `bobo-choses-sweatshirt-midnight-blue-print` | 🟢 브랜드·색상·형태가 **URL 에 전부 있다** |

**MI 자동 판정 결과**

| 항목 | 결과 |
|---|---|
| MI verdict | `PRESUMED_SAME` |
| matchTruth | `TEXT_CONFIRMED` |
| priceTier | `COMPARISON` |
| blockers | **`NO_TITLE_OVERLAP` 하나** |
| 자동 판정의 핵심 근거 | 「브랜드 **일치**」·「**브랜드 품번 일치**」 · 「모델명 유사도 0%」 · 텍스트등급 low |
| 자동 판정에서 부족한 정보 | 🔴 **한글 제목 ↔ 영문 제목의 토큰 겹침이 0** 이라 상품명 축이 CONFLICT 로 남는다 · 색상·소재 추출 **0** · 원본 품번 증거 **없음** |

---

### 후보 7 — `petitemaisonkids.com`

| 항목 | 원본 | 후보 | 비교 |
|---|---|---|---|
| 시장 | 기준 | OVERSEAS | — |
| 브랜드 | Bobo Choses | **Petite Maison Kids** | **불일치** |
| 품번 | B226AC033(추출) | null | 확인 불가 |
| 상품명(영문) | Bobo Choses Pop sweatshirt | Maya Girls' Blue Cotton Sweater Top with Handmade Flowers | **불일치** |
| 상품명(한글) | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | `BC46F29A-…-C0CFDA03CC62.jpg` | **차이** |
| URL | 위 §1 | `https://petitemaisonkids.com/products/maya-blue-cotton-sweater-top` | 원본 링크 |
| 가격 | EUR 62 | 🔴 저장 **USD 12,800** → 라이브 **KRW 115,000** | **저장값 이상**(§5) |

상세설명: 브랜드·품번 양쪽 **미포함** · 조성 **95% Cotton 5% Elastane**(원본과 CONFLICT) ·
🔴 `FORM` **CONFLICT**(SWEATSHIRT ↔ TOP) · `SET` 후보만 `set` 토큰 보유 ·
「Handmade Flowers」·「Maya Collection」 — 🟢 **여아용 다른 상품으로 읽히는 근거가 본문에 명시**
MI: `PRESUMED_SAME` / `TEXT_CONFIRMED` / `COMPARISON` · blockers **5개**(`GARMENT_FORM` 포함)

---

### 후보 8 — `shoppiccoliandco.com`

| 항목 | 원본 | 후보 | 비교 |
|---|---|---|---|
| 시장 | 기준 | OVERSEAS | — |
| 브랜드 | Bobo Choses | **Piccoli & Co™** | **불일치** |
| 품번 | B226AC033(추출) | null | 확인 불가 |
| 상품명(영문) | Bobo Choses Pop sweatshirt | Jude Navy Baby Boy Anchor Sweater | **불일치** |
| 상품명(한글) | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | `769911C5-…-6F21F6ECCDD8.jpg` | **차이** |
| URL | 위 §1 | `https://shoppiccoliandco.com/products/jude-navy-baby-boy-anchor-sweater` | 원본 링크 |
| 가격 | EUR 62 | 🔴 저장 **USD 9,700** → 라이브 **KRW 82,000** | **저장값 이상**(§5) |

상세설명: 브랜드·품번 양쪽 **미포함** · 🔴 `FORM` **CONFLICT**(SWEATSHIRT ↔ **BODYSUIT/PANTS/ROMPER**)
⟹ 🟢 본문이 **다른 옷 종류**(바디수트·바지·롬퍼)를 말한다 · 색상 `Navy / the jude navy`
MI: `PRESUMED_SAME` / `TEXT_CONFIRMED` / `COMPARISON` · blockers 4개

---

## §4. SAME 이 아닌 이유 — 운영 blockers 를 원문으로 집계

| blocker | 건수 | 해당 후보 |
|---|---:|---|
| `NO_TITLE_OVERLAP` | **8/8** | 전건 |
| `BRAND_MISMATCH` | 5 | #2 #3 #5 #7 #8 |
| `AUDIENCE_LINE` | 5 | #2 #3 #5 #7 #8 |
| `MATERIAL` | 4 | #2 #3 #4 #7 |
| `COLOR_VARIANT` | 2 | #5 #8 |
| `BRAND_UNCONFIRMED` | 1 | #1 |
| `GARMENT_FORM` | 1 | #7 |

🔴🔴 **모든 후보가 `NO_TITLE_OVERLAP` 을 들고 있다.** 그리고 그 원인이 **둘로 갈린다**:

```
⒜ 진짜 다른 상품이라 제목이 안 겹친다          #2 #3 #5 #7 #8 (5건 · 브랜드도 다르다)
⒝ 🟡 **같은 상품인데 제목 «언어·표기» 가 달라서** 안 겹친다
   #1 coupleshot   제목이 **깨진 문자**(인코딩 손상) ⟹ 토큰이 생기지 않는다
   #6 kids-world   제목이 **한글** 이고 원본은 영문 ⟹ 토큰 겹침 **0**
   #4 junioredition 🟢 **예외** — 제목이 겹쳐 「모델명 유사도 100%」가 났다
```

🔴 `판정방법` 은 8건 **전건** 이 동일하다:
`CROSS_SELLER_AXES — 품번을 비교할 수 없어 교차판매처 축과 텍스트 등급으로 판단`
그리고 `판정근거` 에 **8건 전건** 같은 문장이 있다:
**`품번증거=unavailable (해외 B226AC033 ↔ 국내 없음)`**
⟹ 🔴 **원본 쪽 품번 증거가 비어 있어서 식별자 경로가 8건 전부에서 닫혔다.**

---

## §5. 상세설명에서 «새롭게» 발견한 브랜드·품번·상품명

| 후보 | 상세설명에서 새로 나온 값 | 운영 판정에 반영됐는가 |
|---|---|---|
| #1 coupleshot | **품번 `B226AC033`** | 🟡 `match_reasons` 에 「근거: 브랜드 품번 일치」로 **반영됨**(그런데 blocker 2개가 남았다) |
| #4 junioredition | **품번 `B226AC033`**(「Product code B226AC033 AW26」) · 브랜드 `Bobo Choses` · 소재 3종 · Made in Spain | 🟢 「브랜드 일치」·「브랜드 품번 일치」로 반영 · 🔴 그래도 tier 는 `COMPARISON` |
| #6 kids-world | **브랜드 `Bobo Choses` + 품번 `B226AC033`** | 🟢 둘 다 반영 · 🔴 그래도 `NO_TITLE_OVERLAP` 이 남았다 |
| #2 #3 #5 #7 #8 | 없음(다른 브랜드의 정보만 나왔다) | — |

🔴🔴 **원본 쪽에서는 상세설명에서 브랜드도 품번도 나오지 않았다**(11축 전수 `origin=[]`).
🟢 그래서 「양쪽 상세설명 비교」는 **구조적으로 성립하지 않는다** — 후보만 갖고 있다.
🔴 상세설명 브랜드·상품명을 **운영 SAME 판정에 연결하지 않았다**(금지 유지).

### 🔴 가격 데이터 이상 — 저장값 ↔ 라이브 (사실만 적는다)

| 후보 | 저장(2026-11-07) | 라이브(2026-11-22) | 성질 |
|---|---|---|---|
| #4 junioredition | GBP 58 | **GBP 40.6** | 같은 통화 · 금액 하락(세일 추정 · 단정 안 함) |
| #5 kidbizkid | **CAD 10,300** | KRW 87,000 | 🔴 통화·금액 **둘 다** 다르다 |
| #7 petitemaisonkids | **USD 12,800** | KRW 115,000 | 🔴 동일 |
| #8 shoppiccoliandco | **USD 9,700** | KRW 82,000 | 🔴 동일 |
| #1 #2 #3 #6 | 변화 없음 | 변화 없음 | 🟢 |

🔴 저장된 `CAD 10,300` · `USD 12,800` · `USD 9,700` 은 **아동복 가격으로는 비정상** 이다.
🟡 가설 둘 — ⒜ 통화 라벨 오기(실제 KRW) ⒝ minor-unit 오해.
🔴 **CTO 가 어느 쪽이라 단정하지 않았고 데이터도 고치지 않았다**(§7 금지).
🔴 라이브가 KRW 로 오는 것은 **접속 지역에 따라 Shopify 가 통화를 바꾸는** 성질이다
(기존 기록 `smallable-market-is-shipping-destination` 과 같은 계열) ⟹ 라이브 KRW 도
「그 판매처의 고정 가격」으로 읽지 않는다.

---

## §6. 영문·한글 문제 — 지시서 7유형으로 분류

| 유형 | 해당 | 내용 |
|---|---|---|
| ① 단순 표기 차이 | #4 | `Bobo Choses Pop sweatshirt` ↔ `Bobo Choses Pop Sweatshirt **by Bobo Choses**` — 판매처가 브랜드명을 뒤에 덧붙였다 |
| ② 번역 차이 | #3 #6 | #3 저장 영어 ↔ 라이브 **독일어**(로케일) · #6 **한글 전용 페이지** |
| ③ 번역 누락 | **원본** · #6 | 🔴 원본 `titleKo` 가 **영문 그대로**(번역 안 됨) · #6 「포함 프린트」는 `print` 오역 의심 |
| ④ 의미 차이 | #2 #3 #5 #7 #8 | 브랜드·옷 형태·대상이 실제로 다르다 |
| ⑤ 브랜드 오인 | #1 | 후보 브랜드가 `null` 인데 **카테고리 문자열에 `BOBO CHOSES`** 가 있다 ⟹ 추출 자리를 못 찾았다 |
| ⑥ 품번 누락·충돌 | **원본** · #1 #4 #6 | 🔴 **원본 `sku` 가 빈 문자열** 인데 추출기는 `B226AC033` 을 안다 ⟹ 구조화 데이터 누락 · 후보 3건은 상세설명에 품번을 적는다 |
| ⑦ 상품명 정보 부족 | #1 | 제목이 **인코딩 손상** 으로 판독 불가 |

🔴 **별도 분석용 번역** — 이 문서에서 CTO 가 만든 번역은 **없다**. #6 의 「포함 프린트」도
원문을 그대로 옮기고 「오역 의심」으로만 적었다(임의 번역 결과를 기존 데이터처럼 적지 않았다).

---

## §7. 원본 데이터 부족으로 판단할 수 없는 것

```
⒜ 🔴 **이미지 육안 비교 불가** — URL 은 전부 확보했으나 CTO 는 **그림을 보지 않았다**.
   비교 결과를 「동일/유사」로 적지 않고 **URL 기준 「차이」** 로만 적었다.
   🟡 #4 junioredition 의 파일명(`Bobo-Choses-AW26-Bobo-Choses-Pop-Sweatshirt.jpg`)과
      #6 kids-world 의 판매처 코드(`IY026`)는 **문자열 관측** 이고 육안 확인이 아니다.
⒝ 🔴 **원본 저장 이미지 URL 이 전건 `null`** 이라 「원본이 실제로 어떤 사진인지」는
   라이브 추출값(`B226AC033_6.jpg`) 하나에만 의존한다.
⒞ 🔴 **#1 coupleshot 의 제목·본문이 인코딩 손상** 이라 상품명 비교가 **측정 불가** 다.
   🔴 「0% 일치」로 적지 않았다 — **판독 불가** 다.
⒟ 🔴 **원본 상세설명에 브랜드·품번이 없다** ⟹ 「양쪽 상세설명 품번 일치」는
   8건 전부에서 **측정 불가** 다(후보 쪽만 있다).
⒠ 🔴 저장 가격 3건(CAD 10,300 · USD 12,800 · USD 9,700)의 **원인 미규명**.
⒡ 🔴 `market=UNKNOWN` 2건(#1 #6)이 실제로 국내인지 — **통화 단독으로 KR 로 올리지 않는다**
   는 기존 규칙 때문에 미확정이다. #6 은 URL 이 `/ko-kr/` 이고 KRW 를 쓴다(🔴 사실만 적는다).
⒢ 🔴 표본은 **원상품 1개 · 후보 8** 이다 — 비율로 일반화하지 않는다.
⒣ 🔴 저장 시점(2026-11-07) ↔ 라이브(2026-11-22) **15일 차이** 가 있다. 두 값이 다르면
   **둘 다** 적었고 어느 쪽이 참인지 단정하지 않았다.
```

---

## §8. CTO 사실 기반 분석 의견

🔴 **이것은 판단이 아니라 데이터에서 직접 읽히는 것** 이다. SAME/DIFFERENT 를 확정하지 않았다.

```
① 🔴 **8건이 한 덩어리가 아니다 — 둘로 갈린다.**
   A군(5건 · #2 #3 #5 #7 #8)  브랜드가 **각기 다른 실제 브랜드** 이고 조성·옷 형태·대상이
                              본문에서 다르다 ⟹ blockers 4~5개 · 상세설명에 공통 식별정보 **0**
   B군(3건 · #1 #4 #6)         **품번 `B226AC033` 을 상세설명/구조화 데이터에 갖고 있다**
                              ⟹ blockers 1~2개 · 그중 둘은 브랜드까지 일치
② 🔴🔴 **B군 3건이 SAME 으로 못 간 이유는 «후보 쪽 정보 부족» 이 아니다.**
   8건 전건의 판정근거에 같은 문장이 있다 — `품번증거=unavailable (해외 B226AC033 ↔ 국내 없음)`.
   그리고 원본 `sku.value` 는 **빈 문자열** 이다.
   ⟹ 🟢 **원본 쪽 품번이 구조화 데이터로 저장되지 않은 것** 이 B군 3건의 공통 제약으로 보인다.
   🔴 단 「그것만 채우면 SAME 이 된다」고 단정하지 않는다 — 그 연결은 CPO 판단이고
      기존 측정에서 「원상품 공백을 메우면 보류→충돌로 악화」한 선례가 있다.
③ 🟡 **#4 junioredition 의 `MATERIAL` blocker 는 「소재가 다르다」로 읽히지 않는다.**
   양쪽 본문이 **같은 조성**(66/22/12)을 적는데, 후보 쪽 파싱 결과에 같은 소재가
   **두 비율로 중복** 돼 있다. 🔴 파서 문제인지 본문 문제인지는 **미규명** 이다.
④ 🟡 **#6 kids-world 의 `NO_TITLE_OVERLAP` 은 「다른 상품」 신호가 아니라 «언어» 신호다.**
   한글 제목 ↔ 영문 제목이라 토큰이 0 이다. 🟢 브랜드·품번은 둘 다 일치한다.
⑤ 🔴 **#1 coupleshot 은 지금 상태로 판단할 수 없다.** 제목·본문이 인코딩 손상이고
   브랜드 추출이 `null` 이다. 🟡 단 카테고리 문자열에 `BOBO CHOSES` 가 있고 품번이 일치한다.
⑥ 🟢 **A군 5건에서 MI 가 「다른 상품」을 놓치지 않았다** — 브랜드 불일치·조성 충돌·
   옷 형태 충돌이 **전부 본문 근거로** 잡혔다(#7 은 「Maya Collection·Handmade Flowers」,
   #8 은 「BODYSUIT/PANTS/ROMPER」가 본문에 있다).
⑦ 🔴 **원본 데이터 품질 문제 다섯** 이 이 비교의 상한을 만들고 있다 — §1 의 ①~⑤.
   그중 ②③(한글 미번역 · 「상품 종류: 티셔츠」 오분류)은 **판정과 무관하게 셀러에게 보이는 값** 이다.
```

---

## §9. CPO 판단용 입력 — 🔴 CTO 는 분류하지 않았다

CPO 가 `MI 판정 유지 / 재검토 필요 / 동일상품 가능성 있음 / 추가 근거 필요` 로 분류할 때
필요한 축만 한 줄로 모았다.

| # | 후보 | 브랜드 | 품번 | 제목 겹침 | blockers | 상세설명 공통 식별정보 | 가격 |
|---|---|---|---|---|---|---|---|
| 1 | coupleshot.com | ❔ null | 🟢 일치 | 🔴 판독 불가 | 2 | 품번 | KRW 135,000 |
| 2 | designerkidswear.com | 🔴 FENDI | ❔ 없음 | 🔴 0 | 4 | 없음 | CAD 530 |
| 3 | folkberlin.com | 🔴 Gray Label | ❔ 없음 | 🔴 0 | 4 | 없음 | EUR 39 |
| 4 | junioredition.com | 🟢 일치 | 🟢 일치 | 🟢 **100%** | **1** | 품번·브랜드·소재·원산지 | GBP 40.6(저장 58) |
| 5 | kidbizkid.com | 🔴 Lacoste | ❔ 없음 | 🔴 0 | 4 | 없음 | 🔴 저장 CAD 10,300 |
| 6 | kids-world.com | 🟢 일치 | 🟢 일치 | 🔴 0(한글↔영문) | **1** | 품번·브랜드 | KRW 106,000 |
| 7 | petitemaisonkids.com | 🔴 Petite Maison Kids | ❔ 없음 | 🔴 0 | **5** | 없음 | 🔴 저장 USD 12,800 |
| 8 | shoppiccoliandco.com | 🔴 Piccoli & Co™ | ❔ 없음 | 🔴 0 | 4 | 없음 | 🔴 저장 USD 9,700 |

---

## §10. 산출물과 재현 방법

```
자료 ① fixtures/mic01-db-pull.json              운영 DB 읽기 전용 SELECT 산출(후보 10 전수)
자료 ② fixtures/mic01-candidate-originals.json  라이브 원문 + 식별 근거 11축 × 8
재현   cd apps/admin && MIC01_LIVE=1 npx vitest run \
         src/app/api/price-history/_lib/__tests__/mic01-candidate-originals.test.ts
       🔴 `MIC01_LIVE=1` 없으면 **SKIP** 한다(라이브 HTTP 비용 통제)
수집기 운영 owner `factsFromProductUrl` · `summarizeIdentityEvidence` **그대로**(새 크롤러 0)
```

🔴 **하니스를 두 번 틀렸고 둘 다 적는다**:
```
⒜ `facts` 를 **잘라서** `summarizeIdentityEvidence` 에 넘겼다 ⟹ 11축이 **전건
   `NOT_MEASURED`** 로 나왔다. 그대로 보고했으면 「운영이 축을 재지 않는다」는 **거짓 결론** 이었다.
   🟢 전체 `ProductFacts` 를 넘겨 11축 전부가 측정됐다.
⒝ 가드 단언에 금지 문자열을 **그대로 적어** 자기 자신을 잡았다(자기참조) — 분해해 고쳤다.
```

🔴 **변경 0 확인** — 운영 코드 0 · DB 쓰기 0 · schema 0 · 화면 0 · 판정 로직 0 ·
상세설명의 운영 SAME 판정 연결 0 · 원본 데이터 수정 0.
