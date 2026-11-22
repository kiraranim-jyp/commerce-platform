# MI-IDENTITY-EVIDENCE-REASSESSMENT-01 — 원본 기준값으로 후보 8건 재검증

> 🔴 **이것은 CPO 검토 자료다. CTO 는 판정하지 않았다.**
> 🔵 CPO §1 고정 기준값으로 **후보 상세설명에서 원본 식별정보를 찾았고**, 발견한 것은
> **원문 발췌와 함께** 적었다(「포함」만 적지 않았다 · CPO §3).
> 🔴 운영 코드 **0** · 판정 로직 **0** · DB 쓰기 **0** · 화면 **0** · 새 크롤러 **0**.

수집 **2026-11-22T07:09:14Z** · HTTP **10회** · 접근 성공 **8/8** · 상세설명 확보 **8/8**

---

## §0. 기준값과 수집 방법

```
기준값(CPO §1)   브랜드 Bobo Choses · 품번 B226AC033 ·
                 상품명 Bobo Choses Pop sweatshirt · 가격 EUR 62
🔴 원본 `sku` 가 DB 에서 빈 문자열인 사실과 **실제 품번 B226AC033 을 혼동하지 않았다**.
🔴 원본 상세설명에 품번이 없다는 사실을 **후보 비교의 차단 근거로 쓰지 않았다**(CPO §1).

수집기   운영 owner `factsFromProductUrl` **그대로**(새 크롤러 0)
검색     브랜드 · 품번 · 상품명 · 상품종류 · 소재 · 색상 · 원산지 · 시즌 **8축**
         🔴 **제목과 상세설명을 «각각»** 훑었다(판매처가 품번을 제목에만 적는 경우가 있다)
산출물   fixtures/mier01-reassessment.json (원문 전체 + 축별 원문 발췌)
재현     cd apps/admin && MIER01_LIVE=1 npx vitest run \
           src/app/api/price-history/_lib/__tests__/mier01-identity-reassessment.test.ts
```

### 원본 상품 — 전체 URL 과 원문

| 항목 | 값 |
|---|---|
| **전체 URL** | `https://bobochoses.com/en-kr/products/b226ac033-bobo-choses-pop-sweatshirt` |
| 접근 결과 | **OK** · `SHOPIFY_JSON` |
| 브랜드 원값 | `Bobo Choses` |
| 품번 원값(추출) | `B226AC033` 🟢 |
| 상품명 원문 | `Bobo Choses Pop sweatshirt` |
| 상세설명 원문 | `Midnight blue sweatshirt. Organic Cotton 66%, Recycled Cotton 22%, Cotton 12%. Loose fit. Responsibly made in Spain.` |
| 이미지 | `…/files/B226AC033_6.jpg?v=1794389793` |
| 가격 | **EUR 62** |

---

## §1. 전체 요약표 — 🔴 **결과가 셋으로 갈린다**

`D` = 상세설명에서 발견 · `T` = 제목에서 발견 · `-` = 없음

| # | 후보 | 브랜드 원값 | 품번 원값 | **Bobo Choses** | **B226AC033** | Pop sweatshirt | 색상 | 원산지 | 시즌 | 기존 blockers | 재검증 결과 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | coupleshot.com | 🔴 **null** | 🟢 B226AC033 | **D** | **D** | **D** | - | - | **D** | `NO_TITLE_OVERLAP`·`BRAND_UNCONFIRMED` | 🟢 **동일상품 가능**(구조화 추출 실패) |
| 2 | designerkidswear.com | **FENDI** | null | - | - | - | - | - | - | 4개 | 🔴 **다른 상품** |
| 3 | folkberlin.com | **Gray Label** | null | - | - | - | - | - | - | 4개 | 🔴 **다른 상품** |
| 4 | junioredition.com | 🟢 Bobo Choses | 🟢 B226AC033 | **D+T** | **D** | **T** | **D** | **D** | **D** | `MATERIAL` 1개 | 🟢 **동일상품 가능**(8축 전부) |
| 5 | kidbizkid.com | **Lacoste** | null | - | - | - | - | - | - | 4개 | 🔴 **다른 상품** |
| 6 | kids-world.com | 🟢 Bobo Choses | 🟢 B226AC033 | **D+T** | **D** | - (한글) | **D+T** | - | - | `NO_TITLE_OVERLAP` 1개 | 🟢 **동일상품 가능**(언어 차이) |
| 7 | petitemaisonkids.com | **Petite Maison Kids** | null | - | - | - | - | - | - | 5개 | 🔴 **다른 상품** |
| 8 | shoppiccoliandco.com | **Piccoli & Co™** | null | - | - | - | - | 🟡 **D** | - | 4개 | 🔴 **다른 상품**(원산지 우연 일치) |

🔴 **기준값 적중 분포** — `Bobo Choses` **3/8** · `B226AC033` **3/8** · 둘 다 **3/8**(#1 #4 #6).
🟢 그 3건이 **CEO 가 SAME/추가확인으로 본 바로 그 3건** 이다(§5 대조).
🔴 나머지 5건은 **기준값 적중이 0 이거나 우연 1개** 다.

---

## §2. 후보별 상세 비교표 8장

### 후보 1 — `coupleshot.com` 🟢🟢 **이 건이 이번 재검증의 핵심이다**

**기본 상품정보**

| 비교 항목 | 원본 상품 | 후보 상품 | 차이 및 확인 결과 |
|---|---|---|---|
| 브랜드 | Bobo Choses | 🔴 **null**(구조화 추출 실패) | **추출 오류** — 상세설명에는 있다(아래) |
| 품번 | B226AC033 | 🟢 **B226AC033** | 🟢 **일치** |
| 상품명 영문 | Bobo Choses Pop sweatshirt | 🔴 제목이 **인코딩 손상**(`̴Ŀü`) | **판독 불가** — 단 상세설명에 원문이 있다 |
| 상품명 한글 | `titleKo` 미번역(영문 그대로) | 판독 불가 | 확인 불가 |
| 상품 이미지 | `B226AC033_6.jpg` | **null**(추출 실패) | 🔴 비교 불가 |
| 가격 | EUR 62 | **KRW 135,000** (저장·라이브 동일 · `VERIFIED_CURRENT`) | 통화 다름 |
| 상품 URL | §0 | `http://www.coupleshot.com/m/product.html?branduid=574657&special=1` | — |

**후보 상세설명 식별정보 확인** — 상세설명 전체 **136자**

> 원문(인코딩 손상 그대로 · CTO 가 복원·번역하지 않았다):
> `[��������,BOBO CHOSES Bobo Choses Pop sweatshirt ����Ʈ����(���o) 26aw-B226AC033] ������� ��ǰ�Դϴ�. (30�����̻� ���Ž� ���ڹ� ����/�����ñ���)`

| 확인 항목 | 결과 | 원문 근거 | 판단 |
|---|---|---|---|
| Bobo Choses 포함 | 🟢 **포함** | `[…,**BOBO CHOSES Bobo Choses** Pop sweatshirt …]` | 🟢 **브랜드 필드가 null 인데 상세설명에는 두 번 있다** |
| B226AC033 포함 | 🟢 **포함** | `… Pop sweatshirt …(…) **26aw-B226AC033**]` | 🟢 일치 |
| Pop sweatshirt 포함 | 🟢 **포함** | `BOBO CHOSES Bobo Choses **Pop sweatshirt** …` | 🟢 **원본 상품명 전체가 그대로 있다** |
| 상품 종류 일치 | 🟢 포함(`sweatshirt`) | 위와 같은 문장 | 🟢 일치 |
| 소재 일치 | ❔ 없음 | — | 미확정 |
| 색상·디자인 일치 | ❔ 없음 | — | 미확정 |
| 원산지·시즌 | 🟡 시즌 **포함** | `**26aw**-B226AC033` | 🟢 원본 keywords 의 `aw26` 과 같은 시즌 |

🟢🟢 **인코딩이 깨졌는데도 ASCII 부분은 온전하다** — 브랜드·상품명·품번·시즌이 **한 줄에 전부** 있다.

**MI 판정 비교**

| 항목 | 결과 |
|---|---|
| 기존 MI 판정 | `PRESUMED_SAME` / `TEXT_CONFIRMED` / `COMPARISON` |
| 기존 blockers | `NO_TITLE_OVERLAP` · `BRAND_UNCONFIRMED` |
| 구조화 정보의 오류·누락 | 🔴 **브랜드 `null`**(상세설명엔 있다) · 🔴 **제목 인코딩 손상** · 🔴 이미지 `null` |
| 후보 상세설명에서 발견한 식별 근거 | 🟢 **브랜드 + 품번 + 상품명 전체 + 시즌 — 네 개 전부** |
| 기존 판정이 보류된 실제 원인 | 🔴 **제목이 깨져 토큰이 생기지 않았고**(⟹ `NO_TITLE_OVERLAP`) **브랜드 추출이 실패했다**(⟹ `BRAND_UNCONFIRMED`). 🔴 **상품이 달라서가 아니다.** |
| 재검증 결과 | 🟢 **동일상품 가능** — 🔴 단 이미지·소재·색상 미확인(CPO 판단 사안) |

---

### 후보 2 — `designerkidswear.com` 🔴 다른 상품

| 비교 항목 | 원본 | 후보 | 확인 결과 |
|---|---|---|---|
| 브랜드 | Bobo Choses | **FENDI** | 🔴 **실제 다른 브랜드** |
| 품번 | B226AC033 | null (URL·이미지엔 `BUH088-8RA-F19J4`) | 🔴 **Fendi 품번** |
| 상품명 영문 | Bobo Choses Pop sweatshirt | Baby Boys Blue Cotton Bear Sweatshirt | 🔴 불일치 |
| 상품명 한글 | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | `BUH088-8RA-F19J4-1.jpg` | 차이 |
| 가격 | EUR 62 | CAD 530 (저장·라이브 동일) | — |
| URL | §0 | `https://designerkidswear.com/products/fendi-baby-boys-sweatshirt-blue-buh088-8ra-f19j4` | — |

상세설명(329자) 원문 발췌:
> `Expertly crafted from soft, high-quality cotton, this **Fendi kids** baby boy's sweatshirt … signature **teddy bear Zucca print** … 93% Cotton 7% Elastane Made in Portugal`

| 확인 항목 | 결과 | 원문 근거 |
|---|---|---|
| Bobo Choses | 🔴 **미포함** | — |
| B226AC033 | 🔴 **미포함** | — |
| Pop sweatshirt | 🔴 **미포함** | — |
| 상품 종류 | 🟡 `sweatshirt` 일치 | `…this Fendi kids baby boy's **sweatshirt**…` |
| 소재 | 🔴 불일치 | `93% Cotton 7% Elastane` ↔ 원본 `66/22/12` |
| 원산지 | 🔴 불일치 | `Made in **Portugal**` ↔ 원본 `Spain` |

MI: blockers `BRAND_MISMATCH`·`NO_TITLE_OVERLAP`·`MATERIAL`·`AUDIENCE_LINE`
구조화 오류: **없음**(FENDI 는 정확한 추출) · 보류 원인: **실제 다른 상품**
🔴 재검증 결과 **다른 상품** — 🔴 그런데 MI 는 `PRESUMED_SAME` 으로 남겼다(§4 ③ 참조)

---

### 후보 3 — `folkberlin.com` 🔴 다른 상품

| 비교 항목 | 원본 | 후보 | 확인 결과 |
|---|---|---|---|
| 브랜드 | Bobo Choses | **Gray Label** | 🔴 실제 다른 브랜드 |
| 품번 | B226AC033 | null | 확인 불가 |
| 상품명 영문 | Bobo Choses Pop sweatshirt | 🔴 **독일어** `Baby-Sweateranzug „Blue Moon" Bio-Baumwolle` | 불일치 |
| 상품명 한글 | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | `Graylabel-baby-BlueMoon-9774.jpg` | 차이 |
| 가격 | EUR 62 | EUR 39 | 같은 통화 · 금액 다름 |
| URL | §0 | `https://folkberlin.com/products/baby-sweatsuit-blue-moon-organic-cotton` | — |

상세설명(**1,017자** · 독일어) 발췌:
> `Baby-Sweateranzug „Blue Moon" aus Bio-Baumwolle Dieser vielseitige und wärmende **Anzug** hat einen Rundhalsausschnitt und **Druckknöpfe** … **Kängurutasche** …`

| 확인 항목 | 결과 |
|---|---|
| Bobo Choses · B226AC033 · Pop sweatshirt | 🔴 **기준값 적중 0** |
| 상품 종류 | 🔴 `Anzug`(수트/세트) — `sweatshirt` 가 **아니다** |

MI: blockers 4개 · 구조화 오류 **없음** · 보류 원인 **실제 다른 상품**(세트 상품)
🔴 재검증 결과 **다른 상품** · 🟡 저장 제목은 영어였고 라이브는 독일어 — **로케일 차이**

---

### 후보 4 — `junioredition.com` 🟢🟢 **8축 전부 일치**

| 비교 항목 | 원본 | 후보 | 확인 결과 |
|---|---|---|---|
| 브랜드 | Bobo Choses | 🟢 **Bobo Choses** | 🟢 일치 |
| 품번 | B226AC033 | 🟢 **B226AC033** | 🟢 일치 |
| 상품명 영문 | Bobo Choses Pop sweatshirt | **Bobo Choses Pop Sweatshirt by Bobo Choses** | 🟢 **일치**(판매처가 브랜드명을 뒤에 덧붙임) |
| 상품명 한글 | 미번역 | 없음 | 확인 불가 |
| 이미지 | `B226AC033_6.jpg` | `Bobo-Choses-AW26-Bobo-Choses-Pop-Sweatshirt.jpg` | 🟡 URL 다름 · 파일명이 같은 상품을 가리킨다(육안 미확인) |
| 가격 | EUR 62 | 🔴 저장 **GBP 58** → 라이브 **GBP 40.6** | 시점 차이(세일 추정 · 단정 안 함) |
| URL | §0 | `https://junioredition.com/products/bobo-choses-pop-sweatshirt-by-bobo-choses` | — |

상세설명(360자) **전체 원문**:
> `Bigfoot By BC Sweatshirt by **Bobo Choses**. **Midnight blue** sweatshirt in a **relaxed fit** featuring ribbed cuffs, bottom and neck and a Bobo Choses print in white across the chest. Perfect for keeping cosy and stylish during the seasonal transition. Colour - **Midnight Blue**. **66% Organic Cotton 22% Recycled Cotton 12% Cotton**. **Product code B226AC033 AW26 Made in Spain.**`

| 확인 항목 | 결과 | 원문 근거 | 판단 |
|---|---|---|---|
| Bobo Choses 포함 | 🟢 **포함**(제목+상세설명) | `Bigfoot By BC Sweatshirt by **Bobo Choses**.` | 🟢 일치 |
| B226AC033 포함 | 🟢 **포함** | `**Product code B226AC033 AW26** Made in Spain.` | 🟢 **명시적 품번 선언** |
| Pop sweatshirt 포함 | 🟢 **제목에 포함** | `Bobo Choses **Pop Sweatshirt** by Bobo Choses` | 🟢 일치 |
| 상품 종류 | 🟢 일치 | `… Sweatshirt …` | 🟢 |
| 소재 일치 | 🟢 **같은 조성** | `66% Organic Cotton 22% Recycled Cotton 12% Cotton` ↔ 원본 `Organic 66, Recycled 22, Cotton 12` | 🟢 **완전 일치** |
| 색상·디자인 | 🟢 일치 | `Colour - **Midnight Blue**` | 🟢 |
| 원산지·시즌 | 🟢 **둘 다 일치** | `**AW26 Made in Spain**` ↔ 원본 `made in Spain` · keywords `aw26` | 🟢 |

**MI 판정 비교**

| 항목 | 결과 |
|---|---|
| 기존 MI 판정 | `PRESUMED_SAME` / `TEXT_CONFIRMED` / `COMPARISON` |
| 기존 blockers | **`MATERIAL` 하나** |
| 구조화 정보의 오류·누락 | 🟡 브랜드·품번·제목 모두 **정상 추출** 됐다 — 오류 없음 |
| 발견한 식별 근거 | 🟢 **8축 전부**(브랜드·품번·상품명·종류·소재·색상·원산지·시즌) |
| 기존 판정이 보류된 실제 원인 | 🔴 ⒜ 저장 사유: `보류: 소재 cotton:12,organic cotton:66,recycled cotton:22 ↔ cotton:12,organic cotton:22,organic cotton:66,recycled cotton:12,recycled cotton:22` — **후보 쪽에 같은 소재가 두 비율로 중복 파싱** 돼 있다(원문은 한 번만 적는다) ⟹ 🟢 **소재가 다른 것이 아니라 파싱 산출물이 다르다** ⒝ 그리고 `품번증거=unavailable (해외 B226AC033 ↔ 국내 없음)` — **원본 쪽 품번 증거 칸이 비어** 식별자 경로가 닫혔다 |
| 재검증 결과 | 🟢 **동일상품 가능**(근거 가장 강함) |

---

### 후보 5 — `kidbizkid.com` 🔴 다른 상품

| 비교 항목 | 원본 | 후보 | 확인 결과 |
|---|---|---|---|
| 브랜드 | Bobo Choses | **Lacoste** | 🔴 실제 다른 브랜드 |
| 품번 | B226AC033 | null | 확인 불가 |
| 상품명 영문 | Bobo Choses Pop sweatshirt | Lacoste Navy Sweatshirt | 🔴 불일치 |
| 이미지 | `B226AC033_6.jpg` | 🔴 `Gemini_Generated_Image_t1qy12t1qy12t1qy.jpg` — **AI 생성 이미지 파일명** | 차이 |
| 가격 | EUR 62 | 🔴 저장 **CAD 10,300** → 라이브 **KRW 87,000** | 저장값 이상(§6) |
| URL | §0 | `https://kidbizkid.com/products/lacoste-navy-sweatshirt` | — |

상세설명(279자) 발췌:
> `Timeless **Lacoste** comfort in sleek navy. This classic **zip-up** sweatshirt features the iconic **crocodile logo** embroidered on the chest…`

기준값 적중: `sweatshirt` **하나뿐**(상품 종류) · Bobo Choses · B226AC033 · Pop sweatshirt **전부 미포함**
🔴 그리고 **지퍼 형태(zip-up)** 이고 원본은 풀오버 맨투맨이다.
MI: blockers 4개 · 구조화 오류 **없음** · 🔴 재검증 결과 **다른 상품**

---

### 후보 6 — `kids-world.com` 🟢🟢 **브랜드·품번 일치 · 제목만 한글**

| 비교 항목 | 원본 | 후보 | 확인 결과 |
|---|---|---|---|
| 브랜드 | Bobo Choses | 🟢 **Bobo Choses** | 🟢 일치 |
| 품번 | B226AC033 | 🟢 **B226AC033** (상세설명 원문은 `B226AC033-401`) | 🟢 일치 · 🟡 `-401` 은 **색상 코드** 로 보인다(단정 안 함) |
| 상품명 영문 | Bobo Choses Pop sweatshirt | 영문 제목 **없음**(한글 페이지) | 확인 불가 |
| 상품명 한글 | 🔴 `titleKo` 미번역 | **Bobo Choses 맨투맨 - 미드나잇 블루 포함 프린트** | 🟡 **의미 일치**(「맨투맨」=sweatshirt · 「미드나잇 블루」=Midnight blue) |
| 이미지 | `B226AC033_6.jpg` | **null**(추출 실패 · 페이지엔 `IY026.jpg` 존재) | 비교 불가 |
| 가격 | EUR 62 | **KRW 106,000**(저장·라이브 동일 · `VERIFIED_CURRENT`) | 통화 다름 |
| URL | §0 | `https://www.kids-world.com/ko-kr/bobo-choses-sweatshirt-midnight-blue-print-p-450718.html` | — |

상세설명(368자) **전체 원문**:
> `**Bobo Choses 맨투맨**. Bobo Choses 맨투맨 - **미드나잇 블루** 포함 프린트. **Bobo Choses (보보쇼즈)** 의 맨투맨진한 파란색 바탕에 은은한 워싱 처리가 된 맨투맨 입니다. 가슴 부분에는 **흰색 레터링으로 브랜드 이름이 새겨져** 있습니다. 맨투맨 넥에 긴 소매는 **넓은 골지 마감** 으로 처리되었으며, 밑단에도 넓은 골지 디테일이 더해져 클래식한 핏을 연출합니다. 보보 초 Bobo Choses (보보쇼즈) 로고가 앞면에 선명하게 배치되어 대비 효과를 줍니다. 심플하면서도 스타일리시한 디자인으로 일상복으로 활용하기 좋습니다. 맨투맨 은 **부드러운 기모 코튼** 소재입니다.. Bobo Choses 맨투맨. **Bobo Choses B226AC033-401**`

| 확인 항목 | 결과 | 원문 근거 | 판단 |
|---|---|---|---|
| Bobo Choses 포함 | 🟢 **포함**(제목+상세설명 · 「보보쇼즈」 병기) | `**Bobo Choses (보보쇼즈)** 의 맨투맨…` | 🟢 일치 |
| B226AC033 포함 | 🟢 **포함** | `Bobo Choses **B226AC033-401**` | 🟢 일치(접미 `-401`) |
| Pop sweatshirt 포함 | 🔴 **미포함** | — | 🟡 한글 페이지라 영문 상품명이 없다 |
| 상품 종류 | 🟢 일치 | `**맨투맨**`(= sweatshirt) · URL `…-sweatshirt-…` | 🟢 |
| 소재 일치 | 🟡 **부분** | `부드러운 **기모 코튼** 소재` ↔ 원본 `Organic/Recycled Cotton` | 🟡 코튼은 맞으나 비율·유기농 표기 없음 |
| 색상·디자인 | 🟢 일치 | `**미드나잇 블루**` · `가슴에 흰색 레터링` ↔ 원본 `Midnight blue` · `Bobo Choses print in white across the chest`(#4 원문) | 🟢 **디자인 설명까지 일치** |
| 원산지·시즌 | ❔ 없음 | — | 미확정 |

**MI 판정 비교**

| 항목 | 결과 |
|---|---|
| 기존 MI 판정 | `PRESUMED_SAME` / `TEXT_CONFIRMED` / `COMPARISON` |
| 기존 blockers | **`NO_TITLE_OVERLAP` 하나** |
| 구조화 정보의 오류·누락 | 🟡 브랜드·품번은 **정상 추출** · 🔴 이미지 추출 **실패** |
| 발견한 식별 근거 | 🟢 **브랜드 + 품번 + 색상 + 상품종류 + 디자인 설명** |
| 기존 판정이 보류된 실제 원인 | 🔴 **한글 제목 ↔ 영문 제목이라 토큰 겹침이 0** 이다(「모델명 유사도 0%」). 🔴 **상품이 달라서가 아니다 — 언어 문제다.** |
| 재검증 결과 | 🟢 **동일상품 가능** |

🟡 **번역 관측** — 제목의 「**포함** 프린트」는 영문 `print` 를 옮기는 과정의 **오역으로 보인다**
(「~가 들어간 프린트」 의도 추정). 🔴 **CTO 가 번역을 정정하지 않았고** 원문 그대로 적었다.

---

### 후보 7 — `petitemaisonkids.com` 🔴 다른 상품

| 비교 항목 | 원본 | 후보 | 확인 결과 |
|---|---|---|---|
| 브랜드 | Bobo Choses | **Petite Maison Kids** | 🔴 실제 다른 브랜드(판매처 자체 브랜드) |
| 품번 | B226AC033 | null | 확인 불가 |
| 상품명 영문 | Bobo Choses Pop sweatshirt | Maya Girls' Blue Cotton Sweater Top with Handmade Flowers | 🔴 불일치 |
| 이미지 | `B226AC033_6.jpg` | `BC46F29A-…CC62.jpg` | 차이 |
| 가격 | EUR 62 | 🔴 저장 **USD 12,800** → 라이브 **KRW 115,000** | 저장값 이상(§6) |
| URL | §0 | `https://petitemaisonkids.com/products/maya-blue-cotton-sweater-top` | — |

상세설명(664자) 발췌:
> `Indulge her in a little luxury with our **Maya Blue Cotton Sweater Top** … **handmade flowers** add a sweet, special finish … **Maya Collection** … Soft **95% Cotton, 5% Elastane** … **Made in Turkey**`

기준값 적중 **0** · 🔴 상품 종류 `Top`(원본은 `Sweatshirt`) · 소재 `95/5` · 원산지 `Turkey` · **여아용**
MI: blockers **5개**(`GARMENT_FORM` 포함) · 구조화 오류 **없음** · 🔴 재검증 결과 **다른 상품**

---

### 후보 8 — `shoppiccoliandco.com` 🔴 다른 상품 (🟡 원산지만 우연 일치)

| 비교 항목 | 원본 | 후보 | 확인 결과 |
|---|---|---|---|
| 브랜드 | Bobo Choses | **Piccoli & Co™** | 🔴 실제 다른 브랜드 |
| 품번 | B226AC033 | null | 확인 불가 |
| 상품명 영문 | Bobo Choses Pop sweatshirt | Jude Navy Baby Boy Anchor Sweater | 🔴 불일치 |
| 이미지 | `B226AC033_6.jpg` | `769911C5-…CCD8.jpg` | 차이 |
| 가격 | EUR 62 | 🔴 저장 **USD 9,700** → 라이브 **KRW 82,000** | 저장값 이상(§6) |
| URL | §0 | `https://shoppiccoliandco.com/products/jude-navy-baby-boy-anchor-sweater` | — |

상세설명(**2,010자**) 발췌:
> `Meet the **Jude Navy Baby Boy Anchor Sweater** — a tiny piece of nautical charm … **striped knitted sweater** … playful **anchor motif** … **Made in Spain** — crafted with care…`

| 확인 항목 | 결과 | 원문 근거 |
|---|---|---|
| Bobo Choses · B226AC033 · Pop sweatshirt | 🔴 **전부 미포함** | — |
| 원산지 | 🟡 **`Made in Spain` 일치** | `… **Made in Spain** —crafted with care …` |

🔴🔴 **원산지 한 축만 일치하는 것을 동일 근거로 쓰지 않는다** — 브랜드·품번·상품명·종류
(`knitted sweater` ↔ `sweatshirt`)·디자인(anchor motif)이 전부 다르다.
MI: blockers 4개 · 구조화 오류 **없음** · 🔴 재검증 결과 **다른 상품**

---

## §3. CPO 가 물은 다섯 질문 — 데이터로 답한다

### ① 후보 상세설명에 `Bobo Choses` 가 있는데 브랜드 불일치로 보류됐는가?

🟢 **아니다 — 그런 사례는 1건이고 사유가 `BRAND_MISMATCH` 가 아니라 `BRAND_UNCONFIRMED` 다.**

| 후보 | 상세설명에 Bobo Choses | 브랜드 필드 | 기존 사유 |
|---|---|---|---|
| #1 coupleshot | 🟢 **있다**(두 번) | 🔴 **null** | `BRAND_UNCONFIRMED`(= **확인 못 했다**) |
| #4 junioredition | 🟢 있다 | 🟢 Bobo Choses | 「브랜드 **일치**」 — 보류 아님 |
| #6 kids-world | 🟢 있다 | 🟢 Bobo Choses | 「브랜드 **일치**」 — 보류 아님 |
| #2 #3 #5 #7 #8 | 🔴 **없다** | 각기 다른 실제 브랜드 | `BRAND_MISMATCH` — **정확하다** |

🔴 **그러므로 「브랜드가 상세설명에 있는데 불일치로 막혔다」는 사례는 0 이다.**
🟢 다만 **#1 은 브랜드 추출이 실패해 「미확인」으로 막혔고, 그 정보가 상세설명에 있다.**

### ② `B226AC033` 이 상세설명에 있는데 품번 누락으로 보류됐는가?

🟢 **그렇다 — 3건 전부 그렇다. 그리고 사유는 «후보» 가 아니라 «원본» 쪽이다.**

8건 전건의 저장 판정근거에 같은 문장이 있다:
`판정근거: … 품번증거=unavailable (해외 B226AC033 ↔ 국내 없음) …`

| 후보 | 상세설명 품번 | 구조화 품번 | 운영이 품번을 썼는가 |
|---|---|---|---|
| #1 coupleshot | 🟢 `26aw-B226AC033` | 🟢 B226AC033 | 🟢 「근거: **브랜드 품번 일치**」로 반영 |
| #4 junioredition | 🟢 `Product code B226AC033 AW26` | 🟢 B226AC033 | 🟢 반영 · 「모델명 유사도 **100%**」 |
| #6 kids-world | 🟢 `Bobo Choses B226AC033-401` | 🟢 B226AC033 | 🟢 반영 |

🔴 **즉 운영은 품번 일치를 «근거» 로는 인정했는데 tier 를 `EXACT` 로 올리지 못했다.**
그 이유를 운영이 직접 적었다 — `품번증거=unavailable` · `교차판매처=PRESUMED_SAME → TEXT_CONFIRMED(순위 3)`.

### ③ 상품명 차이가 실제 상품 차이인가, 번역·언어·표기 문제인가?

🔴 **갈린다. 그리고 `NO_TITLE_OVERLAP` 은 8/8 이라 그 자체로는 아무것도 구분하지 못한다.**

| 원인 | 건수 | 후보 |
|---|---|---|
| 🔴 **실제 상품 차이** | 5 | #2 #3 #5 #7 #8 (브랜드·소재·형태·원산지가 다르다) |
| 🟡 **인코딩 손상** | 1 | #1 coupleshot (제목이 깨져 토큰이 생기지 않는다) |
| 🟡 **언어 차이** | 1 | #6 kids-world (한글 ↔ 영문 · 토큰 겹침 0) |
| 🟢 **표기 차이뿐** | 1 | #4 junioredition (`by Bobo Choses` 덧붙임 · 유사도 100%) |

### ④ 실제 다른 브랜드인데 MI 가 `PRESUMED_SAME` 으로 남겨두었는가?

🔴🔴 **그렇다 — 5건이다.** #2 FENDI · #3 Gray Label · #5 Lacoste · #7 Petite Maison Kids ·
#8 Piccoli & Co™ 는 **브랜드가 정확히 추출됐고 불일치가 명시**(`BRAND_MISMATCH`)됐는데도
verdict 가 `PRESUMED_SAME` 으로 남았다.
🟢 **다만 가격 집계에는 들어가지 않는다** — tier 가 `COMPARISON` 이고 `EXACT` 가 아니다.
🔴 **CTO 는 이 verdict 정책을 바꾸지 않았다**(CPO 판단 사안).

### ⑤ 동일상품인데 구조화 정보의 추출 실패로 놓쳤는가?

🟢 **1건이 그 모양이다 — #1 coupleshot.**
```
브랜드  필드 null  ↔ 상세설명에 BOBO CHOSES 두 번
제목    인코딩 손상 ↔ 상세설명에 Pop sweatshirt 원문 그대로
이미지  추출 null
⟹ 🔴 구조화 추출이 셋 다 실패했고, 그 때문에 blockers 두 개가 생겼다.
```
🟡 **#6 kids-world 는 추출 실패가 아니다** — 브랜드·품번은 정상이고 **제목이 한글** 이라
토큰이 겹치지 않았다(언어 문제).

---

## §4. CTO 사실 기반 분석 — 🔴 판정이 아니다

```
① 🟢 **기준값 3/8 이 선명하게 갈린다.** 브랜드와 품번이 «둘 다» 발견된 후보는 #1 #4 #6
   **셋뿐** 이고, 그 셋의 blockers 는 1~2개다(나머지 5건은 4~5개).
   🔴 나머지 5건은 기준값 적중이 0 이거나 **원산지 한 축 우연 일치**(#8) 뿐이다.
② 🔴🔴 **보류의 원인이 셋으로 갈린다 — 「동일상품이 아니다」는 그중 하나일 뿐이다.**
   ⒜ 실제 다른 상품      5건 (#2 #3 #5 #7 #8) ⟹ 🟢 MI 차단이 정확하다
   ⒝ 구조화 추출 실패    1건 (#1) ⟹ 🔴 브랜드 null · 제목 인코딩 손상
   ⒞ 언어·표기          2건 (#6 한글 · #4 소재 중복 파싱)
③ 🔴 **원본 쪽 품번 증거 칸이 비어 8건 전부에서 식별자 경로가 닫혔다.**
   운영이 그 사실을 판정근거에 직접 적는다 — `품번증거=unavailable (해외 B226AC033 ↔ 국내 없음)`.
   🔴 「그 칸만 채우면 SAME 이 된다」고 단정하지 않는다 — 과거 측정에서 원상품 공백을
      메우면 **보류→충돌로 악화** 한 선례가 있다(WU-080). 🔵 그 판단은 CPO 몫이다.
④ 🟡 **#4 의 `MATERIAL` blocker 는 소재 차이로 읽히지 않는다.** 양쪽 원문이 같은
   66/22/12 를 적는데 후보 파싱 결과에만 같은 소재가 두 비율로 중복돼 있다.
   🔴 파서 문제인지 본문 문제인지는 **미규명** 이다.
⑤ 🟢 **A군 5건에서 MI 가 「다른 상품」을 놓치지 않았다** — 브랜드 불일치·조성·옷 형태·
   원산지가 전부 **본문 근거로** 잡혔다.
⑥ 🔴 **`NO_TITLE_OVERLAP` 은 8/8 이라 단독으로는 식별력이 없다.** 같은 blocker 가
   「진짜 다른 상품」과 「한글 제목」과 「깨진 인코딩」을 **같은 말로** 만든다.
```

---

## §5. CEO 확인 판단과의 대조 — 🔴 되돌리지 않는다(CPO §5)

| # | 후보 | CEO 확인 | CTO 수집 자료가 가리키는 방향 | 일치 |
|---|---|---|---|---|
| 1 | coupleshot.com | **추가 확인 필요** | 기준값 4축 발견 · 단 이미지·소재·색상 **미확인** | 🟢 일치(추가 확인 상태가 맞다) |
| 2 | designerkidswear.com | DIFFERENT | FENDI · 기준값 0 · 소재/원산지 불일치 | 🟢 |
| 3 | folkberlin.com | DIFFERENT | Gray Label · 기준값 0 · `Anzug`(세트) | 🟢 |
| 4 | junioredition.com | **SAME** | 🟢 **8축 전부 일치** · 명시적 `Product code B226AC033` | 🟢 |
| 5 | kidbizkid.com | DIFFERENT | Lacoste · zip-up · 기준값 0 | 🟢 |
| 6 | kids-world.com | **SAME** | 🟢 브랜드·품번·색상·디자인 일치 · 제목만 한글 | 🟢 |
| 7 | petitemaisonkids.com | DIFFERENT | 자체 브랜드 · Top · 95/5 · Turkey | 🟢 |
| 8 | shoppiccoliandco.com | DIFFERENT | 자체 브랜드 · knitted sweater · 기준값 0(원산지만) | 🟢 |

🟢 **CEO 판단 8/8 과 CTO 가 모은 사실이 어긋나는 곳이 없다.**
🔴 **CTO 가 판정을 내린 것이 아니다** — 수집한 원문이 가리키는 방향을 적었을 뿐이다.

### 🔵 향후 같은 사례에 적용할 기준 후보 — 🔴 **CTO 가 정책으로 확정하지 않았다**

```
A. 「후보 브랜드 필드 null + 상세설명에 기준 브랜드 있음」 ⟹ **추출 실패를 먼저 의심** 한다
   (#1 이 그 모양이다 · 현재는 `BRAND_UNCONFIRMED` 로 보류된다)
B. 「제목 토큰 겹침 0 + 브랜드·품번 둘 다 일치」 ⟹ **언어/표기 문제를 먼저 의심** 한다
   (#6 이 그 모양이다)
C. 「브랜드가 정확히 추출됐고 서로 다른 실제 브랜드」 ⟹ 🟢 지금 판정이 정확하다(5건)
D. 「원산지·소재·색상 중 한 축만 일치」 ⟹ 🔴 동일 근거로 쓰지 않는다(#8 `Made in Spain`)
E. 「상세설명에 `Product code <기준품번>` 처럼 **명시적 품번 선언**」 ⟹ 가장 강한 단일 근거
   (#4 · #1 · #6 셋에 있다)
🔴 A~E 를 **운영 판정에 연결하지 않았다** — 상세설명 운영 판정 연결은 금지 유지다.
```

---

## §6. 판단에 필요한 추가 정보 — 🔴 CTO 가 확보하지 못한 것

```
⒜ 🔴 **이미지 육안 비교** — URL 은 전부 확보했으나 CTO 는 **그림을 보지 않았다**.
   #1 coupleshot · #6 kids-world 는 이미지 추출이 **null** 이라 URL 조차 없다.
   🔵 #1 의 「추가 확인 필요」를 닫으려면 **이미지 확인이 가장 직접적인 축** 으로 보인다.
⒝ 🔴 **#1 의 인코딩 복원** — 한글 부분이 EUC-KR 오디코딩이다. 🔴 CTO 가 복원하지 않았다
   (복원은 추정이 섞인다). 🟢 ASCII 부분만으로 기준값 4축이 확인됐다.
⒞ 🔴 **#6 의 `-401` 접미** — `B226AC033-401` 의 `-401` 이 색상 코드인지 확정하지 못했다
   (원본 URL slug 에는 그 접미가 없다). 🟡 같은 스냅샷의 확정 SAME 후보
   `bonbonverona.it` 제목에 `b226ac033-401` 이 있다는 **문자열 관측** 만 있다.
⒟ 🔴 **저장 가격 3건 이상값** — `CAD 10,300`(#5) · `USD 12,800`(#7) · `USD 9,700`(#8).
   라이브는 각각 KRW 87,000 / 115,000 / 82,000 이다. 🔴 원인 미규명 · 데이터 고치지 않았다.
   🔴 라이브 KRW 는 **접속 지역에 따라 Shopify 가 통화를 바꾸는** 성질이므로 그 판매처의
      고정 가격으로도 읽지 않는다.
⒠ 🔴 **#4 가격 변동** — 저장 GBP 58 → 라이브 GBP 40.6. 세일 추정이고 **단정하지 않았다**.
⒡ 🔴 **`market` 분류** — #1 #6 이 `UNKNOWN` 이다. #6 은 URL 이 `/ko-kr/` 이고 KRW 를 쓴다
   (사실만 적는다 · 🔴 통화 단독으로 KR 로 올리지 않는다는 기존 규칙 때문에 미확정).
⒢ 🔴 **원본 상세설명에는 브랜드·품번이 없다** — 이번 검증은 CPO 지시대로 그것을 차단
   근거로 쓰지 않았다. 🟡 그러나 **운영 판정은 그 칸을 본다**(③).
⒣ 🔴 표본 **원상품 1개 · 후보 8** 이다 — 비율로 일반화하지 않는다.
```

---

## §7. CPO 검토 자료 체크리스트 (CPO §6 순서 그대로)

| # | 요구 자료 | 위치 |
|---|---|---|
| 1 | 원본 상품 전체 URL | §0 표 |
| 2 | 후보 8건 전체 URL | §2 각 표의 「상품 URL」 |
| 3 | 후보별 상세설명 원문 | §2 (#1 #4 #6 은 **전문** · 나머지는 발췌 + fixture 에 전문) |
| 4 | 후보별 브랜드·품번·상품명 원값 | §1 요약표 · §2 각 표 |
| 5 | 후보 상세설명에서 발견한 원본 식별정보 | §2 「식별정보 확인」 표(원문 근거 포함) · §3 ② |
| 6 | 영문·한글 표기 및 번역 차이 | §3 ③ · #6 「포함 프린트」 관측 |
| 7 | 기존 MI 판정과 blockers | §1 · §2 「MI 판정 비교」 |
| 8 | 실제 판정과 구조화 정보가 다른 이유 | §3 ⑤ · §4 ② |
| 9 | 판단에 필요한 추가 정보 | §6 |

🔴 **CTO 가 하지 않은 것** — 자동 판정 정책 변경 · 새 SAME 기준 신설 ·
상세설명의 운영 판정 연결 · CEO 판단 뒤집기 · 번역 생성 · 값 추정.

---

## §8. 변경 0 확인

```
운영 코드 0 · 판정 로직 0 · SAME 기준 0 · DB 쓰기/schema/backfill 0 · 화면 0 ·
새 크롤러 0 · 원본 데이터 수정 0
추가된 파일   mier01-identity-reassessment.test.ts(수집기 · 기본 SKIP) ·
             fixtures/mier01-reassessment.json(원문 + 축별 발췌)
🔴 하니스 오류 1건을 적는다 — 가드 단언에 금지 문자열을 그대로 적어 **자기 자신을 잡았다**
   (이 세션 **두 번째** 자기참조 함정). 🟢 분해해 고쳤다.
```
