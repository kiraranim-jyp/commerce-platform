# STAGE 6 — HUMAN GT BASED EVIDENCE DISCOVERY (2026-11-04)

> 기준 HEAD `da32bb81` · 🔴 **운영 코드 변경 0** · 점수/threshold/blocker **0** ·
> 사람 판정 이력 수정·삭제 **0** · COLOR/SIZE·검색·가격 eligibility **0** · 과금 **0**.
> 🟢 측정은 **라이브 운영 경로** 로 했다(`CORE_DESC_EVIDENCE_LIVE=1` · HTTP 만 · 유료 provider 0).

## 0. 🔵 결론 셋 (먼저 적는다)

```
① 🔴🔴 **상세설명에서만 나오는 Model Code 는 동일상품을 가르지 못한다** —
   5건 중 사람 라벨이 **SAME 1 : DIFFERENT 4** 다(C05 / C19·C20·S1-5·S1-6)
② 🟢🟢 **상세설명은 소재의 «유일한» 공급원이다** — TITLE 0% → DESCRIPTION 60%
   (색상도 16% → 56% · 품번도 12% → 24%)
③ 🟢🟢 **지금 문제는 오판이 아니라 recall 이다** — DIFFERENT 방어 **8/8** · **FP 0** ·
   SAME **6/17**
```
🔴 그러므로 「상세설명을 Evidence 로 더하면 SAME 이 늘어난다」는 **데이터로 지지되지 않는다.**
🟢 그리고 그 결론은 메모리에 이미 적힌 「Evidence 는 점수가 아니다」와 **같은 방향** 이다.

## 1. 분모 — 🔴 못 얻은 것은 「0」이 아니라 분모 밖이다

```
GT 쌍 **33** → 라이브 facts 확보 **25** · 🔴 제외 **8**(측정불가 · 0 으로 세지 않는다)
사람 라벨(확보분) SAME **17** · DIFFERENT **8**
🔴 **상세설명 원문 확보 21/25 (84.0%)** — 4건은 설명이 **없다**(desc·)
evidence 칸 존재 25/25
🔴 저장 GT 기준선(분모 33 · `samePrecision 6/18`)과 **직접 비교 금지** — 분모가 다르다
```

## 2. Evidence 축 coverage — 🔴 **출처를 갈라서** 센다 (CPO §2·§6)

| 축 | 전체 | TITLE | **DESCRIPTION** | DESC(설명보유 21 분모) |
|---|---|---|---|---|
| BRAND | 2/25 (8.0%) | 1/25 | 1/25 | 1/21 (4.8%) |
| MODEL_CODE | 8/25 (32.0%) | 3/25 (12.0%) | **6/25 (24.0%)** | 6/21 (28.6%) |
| PRODUCT_NAME | 25/25 (100%) | 25/25 (100%) | 1/25 (4.0%) | 1/21 |
| FORM(의류 형태) | 20/25 (80.0%) | 19/25 (76.0%) | 16/25 (64.0%) | 16/21 (76.2%) |
| COLOR | 15/25 (60.0%) | 4/25 (16.0%) | **14/25 (56.0%)** | 14/21 (66.7%) |
| MATERIAL | 15/25 (60.0%) | **0/25 (0.0%)** | **15/25 (60.0%)** | 15/21 (71.4%) |
| 🟡 FIT | 8/25 (32.0%) | — | — | 관측 전용 |
| 🟡 COMPOSITION | 15/25 (60.0%) | — | — | 관측 전용 |
| 🟡 SET | **0/25 (0.0%)** | — | — | 🔴 분모 0 ⟹ 식별력 **측정불가** |
| 🟡 OPTION_SKU | 1/25 (4.0%) | — | — | 🔴 표본 1 ⟹ 주장 금지 |
| IMAGE | 23/25 (92.0%) | — | — | 보조 |

🔴 **Style Code · Manufacturer Code · 컬렉션명 · 시즌 · 캐릭터명 · 패턴명 · 디자인명** 은
추출기에 **칸이 없다**(`ProductFacts` 전수) ⟹ 🔴 **측정불가** 로 적는다(0% 가 아니다).

## 3. 🔴🔴🔴 상세설명에서 «만» 나온 축 — CPO §3 핵심 질문의 답

```
MODEL_CODE    5건   C05 · C19 · C20 · S1-5 · S1-6
COLOR        11건   C11 C48 C19 C20 C25 C37 S1-1 S1-4 S1-5 S1-7 S2-3
MATERIAL     15건   C11 C48 C05 C19 C20 C42 C25 C37 S1-4 S1-5 S1-6 S1-7 S2-2 S2-3 S2-4
BRAND         1건   C06
FORM          1건   S2-2
PRODUCT_NAME  **0건**
```

### 3-A. 🔴🔴 「상세설명의 Model Code 가 유효한가」 → **아니다 (1 SAME : 4 DIFFERENT)**

| 사례 | 사람 라벨 | 판매처 |
|---|---|---|
| C05 | 🟢 **SAME** | tinyapple.net |
| C19 | 🔴 DIFFERENT | junioredition.com |
| C20 | 🔴 DIFFERENT | junioredition.com |
| S1-5 | 🔴 DIFFERENT | junioredition.com |
| S1-6 | 🔴 DIFFERENT | tinyapple.net |

⟹ 🔴 **설명문 품번이 있으면 오히려 DIFFERENT 가 더 많다.** 식별 근거로 승격할 수 없다.
🟢 그리고 이것이 C19/C20 의 정체를 설명한다 — **`AW26MS185` 가 설명문에 있는데 사람은
다른 상품이라 했다**(색/무늬가 다른 같은 모델 · STAGE 4-C/4-D 가 기록한 그 구조).

### 3-B. 🟢 「기본 필드엔 없지만 설명문엔 있어 SAME 이 된 사례」 → **소재·색상에서만 있다**
```
MATERIAL  TITLE **0%** ⟹ 설명문이 **유일한 공급원** 이다(15/25)
COLOR     TITLE 16% → 설명문 56%
🔴 그런데 그 둘은 **옵션 축** 이다 — SAME 을 «확정» 하는 근거가 아니다(B NO-GO 와 같은 자리)
```

### 3-C. 🟢 「설명문 없이도 SAME 인가」 → **그렇다**
```
C27  beaumonde.co.kr   desc **없음** · BRAND:T MODEL_CODE:T PRODUCT_NAME:T FORM:T → 사람 **SAME**
S3-1 stadtlandkind.ch  desc **없음** · PRODUCT_NAME:T COLOR:T IMAGE:D          → 사람 **SAME**
⟹ 🔴 상세설명은 **필수 조건이 아니다.** 「없으면 판단 못 한다」로 적지 않는다
```

## 4. SAME / DIFFERENT 사례의 Evidence 패턴 (건별 · `T`=제목 `D`=설명문)

🟢 SAME 17건 · DIFFERENT 8건 전수를 라이브로 찍었다(산출물 §7).
```
🟢 SAME 에서 공통된 것   PRODUCT_NAME:T **17/17**  ← 유일하게 전건 일치하는 축
🔴 SAME 에서 흔히 «없는» 것  BRAND(2/25) · MODEL_CODE(8/25)
🔴 DIFFERENT 에서도 똑같이 흔한 것  PRODUCT_NAME:T **8/8** · FORM:DT · MATERIAL:D
   ⟹ 🔴🔴 **PRODUCT_NAME·FORM·MATERIAL 은 SAME 과 DIFFERENT 를 «가르지 못한다»**
      (둘 다 전건에 있다 — 식별력이 아니라 «보편성» 이다)
```
🔴 그래서 **단순 점수 합계로 결론 내리지 않았다**(CPO §7). 전건에 있는 축은 가중치를
올려도 두 집단을 가르지 못한다.

## 5. 특수 사례 (CPO §8)

```
C19 / C20  junioredition · AW26MS185  설명문에 품번·색·소재가 **다 있는데** 사람 DIFFERENT
C25        main-story   COLOR:D MATERIAL:D 다 나오는데 DIFFERENT (Graystone · STAGE 4-C)
C05        tinyapple    MODEL_CODE:D 로 **유일하게** SAME
C06        trenbe       🔴 축이 거의 다 있다(BRAND:D MODEL_CODE:DT NAME:DT FORM:DT COLOR:DT)
           🔴 이 fixture 의 라벨은 **SAME** 이다 — R2 에서 본 「C06 DIFFERENT」와 **분모·라벨
              버전이 다르다** ⟹ 🔴 두 숫자를 같은 표에 넣지 않는다
C27 / S3-1 설명문 **없이** SAME (§3-C)
S6-4       wconcept  설명문 없음 · PRODUCT_NAME 만 · DIFFERENT
🔴 villagekids 충돌 · trenbe **Long Sleeve** 는 **이 GT fixture 분모에 없다** ⟹ 측정불가
   🟢 villagekids 는 직전 커밋에서 **「판단 불가」로 이미 닫았다**
      (사람 판정 2건의 모든 축이 동일 · human_note 없음 · 이미지 없음 ·
       `docs/FINAL-MARKET-COMPARISON-REVIEW.md` §10)
```

## 6. 🟢🟢 matcher 불변 + 현재 성능 (CPO §10 준수 증거)

```
Evidence 를 늘려도 **verdict/tier 변화 0건** (기대 0) ⟹ 🟢 판정에 **아무것도 흘리지 않았다**
LIVE(분모 25) — SAME **6/17** · 🔴 FN **11** · DIFFERENT 방어 **8/8** · 🔴 **FP 0**
```
🟢🟢 **오판(FP)이 0 이고 방어가 8/8 이다.** ⟹ 🔴 지금 문제는 **정확도가 아니라 recall** 이다.
🔴 그래서 「Evidence 를 더해 SAME 을 늘린다」가 아니라 **「무엇이 11건을 막는가」** 가 다음 질문이다.

## 7. 산출물 / 재현

```
apps/.../__tests__/core-desc-evidence-01-coverage.test.ts   CORE_DESC_EVIDENCE_LIVE=1 (HTTP · 과금 0)
  🟢 선행 트랙 하니스를 **그대로 재사용** 했다(새 하니스 0 · 새 fixture 0)
보조  core-step5-e2-description-evidence · core-sprint10-description-chain ·
      core-desc-review-gt · docs/core-desc-evidence-review.html
```

## 8. 🔴 미완 / 측정불가 (STAGE 6 완료 조건 대비)

```
⒜ 🔴 **Style Code · Manufacturer Code · 컬렉션 · 시즌 · 캐릭터명 · 패턴명 · 디자인명** —
   추출기에 **칸이 없다** ⟹ CPO §2-A/B 의 그 항목들은 **측정 자체가 불가능** 하다.
   🔵 칸을 만드는 것은 추출기 변경이고 **CPO 승인 사안** 이다
⒝ 🔴 GT 33 중 **8건이 라이브 미확보** ⟹ 전수(33)가 아니라 **25** 로 쟀다
⒞ 🔴 `SET` 0/25 · `OPTION_SKU` 1/25 ⟹ 식별력 **측정불가**(표본 부족)
⒟ 🔴 villagekids · trenbe Long Sleeve 는 **이 분모에 없다**
⒠ 🔴 「AI 가 의미를 해석해 추정한 정보」는 **만들지 않았다**(CPO §3 구분 요구) —
   이 측정은 **원문 직접 기재 + 규칙 추출** 두 종류뿐이다
⒡ 🔴 이미지 내 디자인 특징(Vision)은 **이번에 쓰지 않았다**(과금·승인 범위)
```

## 9. 🔵 Identity 에 적용할 수 있는 것 / 아직 아닌 것

```
🟢 적용 근거가 «있는» 것
   · 상세설명은 **소재·색상의 주 공급원** 이다(관측·보강용으로 유효)
   · DIFFERENT 방어 8/8 · FP 0 ⟹ **현재 보호축을 완화할 이유가 없다**
   · PRODUCT_NAME·FORM·MATERIAL 은 **식별 근거로 승격하면 안 된다**(두 집단에 전건 존재)

🔴 적용 근거가 «없는» 것(지금 넣으면 오판이 늘거나 아무 효과가 없다)
   · 설명문 Model Code → **1 SAME : 4 DIFFERENT** ⟹ 승격 금지
   · 설명문 점수화(descriptionScore) → 메모리 기록대로 **금지 유지**
   · 캐릭터/디자인명 축 → **칸이 없어 측정 자체를 못 했다**

🔵 다음 질문은 하나다 — **FN 11건을 막는 것이 무엇인가**(recall 축).
   🔴 그 답이 나오기 전에 Evidence 를 더하지 않는다
```

---

# 🔵🔵🔵 STAGE 6 보완 — CPO 요구 4항 (2026-11-04)

> 🔴 **CPO 가 STAGE 6 을 완료로 승인하지 않았다.** 요구는 넷이었다 —
> ① 원본↔후보 Evidence **실제 값** 비교표 ② 상세설명 21행의 **핵심정보 추출**
> ③ **특별 검증 3건**(villagekids · trenbe Long Sleeve · C19/C20) ④ **FN 11건 각각**.
> 🟢 새 하니스·새 fixture **0** — 기존 라이브 하니스
> `core-desc-evidence-01-coverage.test.ts` 에 출력 절 `[7]~[12]` 를 더해 **같은 분모** 에서 다시 읽었다.
> 🔴 운영 코드 변경 **0** · 점수/threshold/blocker/Identity 정책 **0** · DB 쓰기 **0** · 과금 **0**.

---

## 보완-0. 🔴🔴 먼저 — **내 1차 보고의 네 문장을 정정한다**

CPO 지적이 전부 맞았고, 그중 셋은 **숫자 자체가 틀렸다**.

```
① ❌ 「상세설명 Model Code 는 유효하지 않다 (SAME 1 : DIFFERENT 4)」
   🔴 그것은 **라벨 분포** 이고 «신호의 정답률» 이 아니다. 방향을 갈라 세면 반대가 나온다
   🔴 그리고 분모가 **5 가 아니라 6** 이다(C06 도 DESCRIPTION 유래다 · TITLE 과 중복)
   ✅ 정정 — **반증 방향 2/2 정확 · 긍정 방향 2/4** (보완-4)

② ❌ 「DIFFERENT 방어 8/8 · FP 0」을 성능으로 적었다
   🔴 그것은 **verdict 축** 이다. 돈이 움직이는 축은 **tier** 다
   ✅ 정정 — **사람 DIFFERENT 8건 중 4건이 금액 자격을 얻는다**(보완-5)

③ ❌ 「FN 11」을 한 덩어리로 적었다
   🔴 11 은 **verdict 가 SAME 이 아닌 전부** 이고 그 안에 PRESUMED_SAME **8** 이 있다.
      그 8 은 화면에 「동일상품 추정」으로 **이미 서 있고 금액에도 들어간다**
   ✅ 정정 — 화면에서 **완전히 빠지는 것은 4건** 이다(tier EXCLUDED · 보완-6)

④ ❌ villagekids·trenbe 를 「이 분모 밖」이라며 검증까지 생략했다
   ✅ CPO 말이 맞다 — 통계 분모에서 빼는 것과 **특별 검증을 생략하는 것은 다르다**(보완-7)
```

🔴 그리고 **분모는 그대로 적는다** — 아래 모든 숫자는 **라이브 확보 25쌍**
(GT 33 중 8 제외 = 측정불가)의 값이고 **Identity 시스템 전체 성능이 아니다**.

---

## 보완-1. 원본 ↔ 후보 Evidence **실제 값** 비교표 (사람 SAME 17)

🔴 판정 기준 셋 — **일치 / 불일치 / 누락**. 🔴 **누락을 불일치로 세지 않는다**(CPO §6).
🔴 그리고 아래 「불일치」는 **문자열 수준** 이다 — 운영 축은 색조 매핑·토큰 겹침을 쓰므로
   **문자열 불일치 ≠ 운영 충돌** 이다(실증: C42 는 COLOR 문자열이 달라도 운영은 SAME).

| id | 판매처 | sys verdict | BRAND | CODE | TITLE | CATEG | COLOR | MATER | FIT |
|---|---|---|---|---|---|---|---|---|---|
| C27 | beaumonde.co.kr | PRESUMED_SAME | 일치 | 🔴누락 | 불일치 | 누락 | 누락 | 누락 | 누락 |
| C11 | bobochoses.co.jp | PRESUMED_SAME | 🔴누락 | 일치 | 일치 | 불일치 | 일치 | 불일치 | 누락 |
| C48 | bobochoses.com | PRESUMED_SAME | 🔴누락 | 일치 | 일치 | 일치 | 일치 | 불일치 | 일치 |
| C05 | tinyapple.net | 🟢SAME | 일치 | 일치 | 일치 | 불일치 | 일치 | 불일치 | 누락 |
| C06 | global.trenbe.com | 🟢SAME | 일치 | 일치 | 불일치 | 불일치 | 일치 | 누락 | 누락 |
| C42 | main-story.com | 🟢SAME | 일치 | 🔴누락 | 일치 | 누락 | **불일치** | 일치 | 누락 |
| C14 | kihanan.com | PRESUMED_SAME | 🔴누락 | 🔴누락 | 일치 | 누락 | 누락 | 누락 | 누락 |
| C37 | bobochoses.co.jp | PRESUMED_SAME | 🔴누락 | 일치 | 일치 | 불일치 | 일치 | 불일치 | 누락 |
| S1-1 | rboutique.com | PRESUMED_SAME | 일치 | 🔴누락 | 불일치 | 불일치 | 누락 | 누락 | 누락 |
| S1-3 | cissywears.com | 🟢SAME | 일치 | 🔴누락 | 불일치 | 일치 | 누락 | 누락 | 누락 |
| S1-4 | kolkid.ca | PRESUMED_SAME | 일치 | 🔴누락 | 불일치 | 불일치 | 일치 | 불일치 | 불일치 |
| S1-7 | bobochoses.com | 🔴CONFLICT | 일치 | **불일치** | 불일치 | 일치 | 일치 | 불일치 | 불일치 |
| S2-1 | stockmann.ee | 🔴SIMILAR | 일치 | 🔴누락 | 불일치 | 누락 | 누락 | 누락 | 누락 |
| S2-2 | thefrontshop.com | 🟢SAME | 일치 | 🔴누락 | 일치 | 일치 | 누락 | 불일치 | 누락 |
| S2-3 | bobochoses.com | PRESUMED_SAME | 일치 | **불일치** | 일치 | 일치 | 일치 | 불일치 | 불일치 |
| S2-4 | kids21.com | 🟢SAME | 일치 | 🔴누락 | 일치 | 일치 | 누락 | 불일치 | 누락 |
| S3-1 | stadtlandkind.ch | 🔴SIMILAR | 일치 | 🔴누락 | 불일치 | 누락 | 일치 | 누락 | 누락 |

**실제 값**(불일치·누락만 · 전문은 하니스 `[7]` 출력):

```
C27  CODE   원본「B226AC010」 후보「없음」
     TITLE  원본「booty ghosts long sleeve shirt」 후보「보보쇼즈 26fw 아동 긴팔 티셔츠 booty ghosts」
     🔵 한국어 제목이라 토큰이 겹치지 않는다 — WU-064 가 확정한 그 자리다
C48  BRAND  🔴 **원본이 비어 있다**「없음」 후보「Bobo Choses」      ⟸ 브랜드 공백이 원상품 쪽
C14  BRAND  🔴 **원본이 비어 있다**「없음」 후보「BOBOCHOSES ボボショーズ」
C11  BRAND  원본「Bobo Choses」 후보「없음」                        ⟸ 공백이 후보 쪽
C37  BRAND  원본「Bobo Choses」 후보「없음」
C42  COLOR  원본「Grey Melange」 후보「our grey」 설명문「Our Grey」  ⟸ 🟢 같은 색의 다른 «이름»
S1-4 FIT    원본「relaxed fit」 후보「loose fit」 설명문「loose fit」  ⟸ 🟡 같은 뜻의 다른 «말»
S1-7 CODE   원본「B226AC010」 후보「B226AB046」                      ⟸ AC↔AB **라인 차이**
S2-3 CODE   원본「B226AC009」 후보「B226AB040」                      ⟸ AC↔AB **라인 차이**
```

🔴 **옵션 차이인가 다른 상품인가** — CPO 가 요구한 구분:

```
🟢 **옵션 차이(같은 상품)** — C42(색 이름) · S1-4(핏 어휘) · C11/C37/C48/C14(브랜드 공백)
🟡 **라인 차이** — S1-7 · S2-3 (AC=kids ↔ AB=baby) ⟹ 🔴 **CEO 가 SAME 이라 한 축** 이고
   메모 `line-difference-is-the-first-separable-axis` 의 그 질문이다(**CPO 미결**)
🔴 **다른 상품으로 볼 축은 이 17건에 «하나도 없다»** — 사람이 전부 SAME 이라 했고
   시스템이 찾은 차이는 **전부 표기·공백·라인** 이다
```

### 사람 DIFFERENT 8

| id | 판매처 | sys verdict | 유일하게 «다른» 축 | 옵션 차이인가 |
|---|---|---|---|---|
| C51 | ladida.com | PRESUMED_SAME | TITLE(embossed ↔ color block) | 🔴 **다른 상품**(제품명이 다르다) |
| C22 | donokids.com | SIMILAR | CATEGORY · 나머지 전부 누락 | 🔴 **판단 불가**(증거 1축) |
| C19 | junioredition.com | PRESUMED_SAME | **COLOR 뿐**(Grey Melange ↔ Conker Stripe) | 🟢 **무늬 옵션** |
| C20 | junioredition.com | PRESUMED_SAME | **COLOR 뿐**(Grey Melange ↔ Graystone) | 🟢 **색상 옵션** |
| C25 | main-story.com | PRESUMED_SAME | **COLOR 뿐**(Grey Melange ↔ graystone) | 🟢 **색상 옵션** |
| S1-5 | junioredition.com | CONFLICT | CODE(AC010 ↔ **AC141**) + 소매 | 🔴 **다른 상품** |
| S1-6 | tinyapple.net | CONFLICT | CODE(AC010 ↔ **AC141**) | 🔴 **다른 상품** |
| S6-4 | wconcept.co.kr | UNKNOWN | 전부 누락(제목 「concept」만) | 🔴 **추출 실패** |

🟢🟢 **그래서 사람 DIFFERENT 의 성질이 셋으로 갈린다** —
**색상·무늬 옵션 3** · **진짜 다른 상품 3** · **증거 부족/추출 실패 2**.
🔴 「DIFFERENT」를 한 덩어리로 다루면 이 셋이 섞인다.

---

## 보완-2. 상세설명 **핵심정보 추출** — 실제 값으로 양쪽 대조

🔴 분모 = 설명문 원문 확보 **21/25**. 🔴 **원문에 없는 것은 「정보 없음」** 이다.
🔴 그리고 셋을 섞지 않는다 — **원문 직접 기재 / 규칙 추출 / AI 추정**.
🟢 **AI 추정은 0건** 이다(이 트랙에서 AI 를 부르지 않았다).

| 항목 | 원문에서 확보 | 어떤 모양으로 | 양쪽 대조 결과 |
|---|---|---|---|
| 브랜드 | 🟢 있다 | 원문 직접 기재(`Bobo Choses`·`BOBOCHOSES ボボショーズ`) | 일치 13 · **누락 4**(공백이 한쪽) |
| 정식 상품명 | 🟢 **전건** | 원문 직접 기재 | 🔴 SAME·DIFFERENT **양쪽 전건에 있다** ⟹ 식별력 0 |
| 품목(제품)코드 | 🟡 **6건** | 원문 직접 기재(`B226AC009`·`AW26MS185`·`B226AC141`) | 보완-4 참조 |
| 모델/스타일 코드 | 🔴 **0건** | — | 🔴 **읽는 칸이 없다 ⟹ 측정불가**(0% 아님) |
| 상품 형태 | 🟢 **전건** | 규칙 추출(GARMENT_FORM) | 🔴 양쪽 전건 `SHIRT` ⟹ 식별력 0 |
| 디자인/패턴 | 🔴 **0건** | — | 🔴 **칸 없음 ⟹ 측정불가** · 🟡 단 값은 COLOR 칸에 섞여 들어온다(`Conker Stripe`) |
| 색상 | 🟢 14/25(56%) | 원문 직접 기재(`Our Grey`·`Graystone`·`Conker Stripe`·`Light Blue`) | 보완-3 참조 |
| 소재 | 🟢 15/25(60%) | 원문 직접 기재(`organic cotton`·`elastane`) | 🔴 TITLE 유래 **0%** ⟹ 설명문이 **유일 공급원** |
| 핏 | 🟡 | 원문 직접 기재(`loose fit`·`regular fit`) | 🔴 어휘가 갈린다(보완-6 ③) |

🔴🔴 **「디자인/패턴」을 「측정불가」로만 적지 않고 한 줄 더 적는다** — 그 값이
**실제로 들어오고 있다**. `Conker Stripe`(줄무늬)가 **COLOR 칸으로** 들어왔다.
⟹ 🔵 패턴 축을 신설하는 것이 아니라 **COLOR 칸에 패턴이 섞여 있다는 사실** 이
   CPO 판단 재료다. 🔴 **CTO 가 칸을 만들지 않았다.**

---

## 보완-3. 특별 검증 ① — **C19/C20 `AW26MS185`** (CPO 지목)

> CPO 질문: 「그 차이가 **상품 형태** 차이인가 **색상·무늬 옵션** 차이인가」

🟢🟢 **답 — 색상·무늬 옵션 차이다. 상품 형태 차이가 아니다.**

```
원상품  Main Story  AW26MS185  Sweatshirt  **Grey Melange**
C19     junioredition  AW26MS185(설명문)  COLOR **Conker Stripe**  ⟸ 🟡 **무늬(줄무늬)**
C20     junioredition  AW26MS185(설명문)  COLOR **Graystone**      ⟸ 🟡 **다른 회색**
C25     main-story     품번 누락          COLOR **graystone**      ⟸ 같은 모양
C42     main-story     품번 누락          COLOR **our grey**       ⟸ 🟢 사람 **SAME**

🟢 다른 축은 **전부 일치** 한다 — BRAND · CODE · TITLE · CATEGORY · MATERIAL · FIT
🟢 상품 형태(GARMENT_FORM)는 **양쪽 모두 SHIRT** 이고 소매 단어는 **원문에 없다**
⟹ 🔴 **형태 축으로는 이 셋을 가를 수 없다.** 가른 것은 **색상/무늬** 하나다
```

🟢🟢 **그리고 사람 판정이 그 축에서 «전건 일관» 하다** — 이것이 이번 보완의 가장 큰 발견이다:

```
Grey Melange (= main-story 의 「our grey」)  → 사람 **SAME**      (C42)
Graystone                                   → 사람 **DIFFERENT**  (C20 · C25)
Conker Stripe                               → 사람 **DIFFERENT**  (C19)
⟹ 🟢 **4/4 일관.** 사람은 AW26MS185 를 **색상·무늬로 갈랐고 품번으로 갈지 않았다**
```

🔴🔴 **그래서 STAGE 4-G 변경 B(COLOR 를 Identity 에서 제거)의 NO-GO 가 한 번 더 실증됐다** —
B 를 넣으면 이 네 건이 **전부 구별 불가** 가 된다. 🟢 운영 blocker 실측이 그것을 보여준다:

```
C20  보류[**COLOR_VARIANT**·SAME_SELLER_DISTINCT_LISTING]   ⟸ 🟢 색상 축이 발화했다
C25  보류[**COLOR_VARIANT**]                                 ⟸ 🟢 발화
C42  보류[없음] → sys **SAME**                               ⟸ 🟢 발화하지 «않는» 것이 정답
C19  보류[SAME_SELLER_DISTINCT_LISTING]                      ⟸ 🔴 **색상 축이 놓쳤다**
```

🔴 **C19 의 누락을 정직하게 적는다** — `Conker Stripe` 는 **색 이름이 아니라 무늬 이름** 이라
`COLOR_VARIANT` 가 발화하지 못했다. 그 건이 막힌 것은 **같은 판매처의 다른 진열**
(`SAME_SELLER_DISTINCT_LISTING`)이라는 **다른 이유** 다.
🔴 **고치지 않았다** — 색상사전 확대·패턴 축 신설은 둘 다 금지축이다(CPO 판단 사안).

---

## 보완-3b. 특별 검증 ② — **trenbe Long Sleeve** (CPO 지목)

> FINAL-GATE ③ 의 전제: 「원상품은 반팔인데 후보 제목에 Long Sleeve 가 있다」

🔴🔴 **그 전제가 원문으로 반증됐다.** 그리고 **사람이 이미 SAME 이라 판정했다.**

```
운영 DB(candidate_reviews · READ-ONLY)
  global.trenbe.com/products/bobo-choses-kids-hu…  origin **B226AC009**
  title「Bobo Choses Kids Hug Hairy Monster **Long Sleeve** T-Shirt (Light Blue) B226AC009」
  system SAME · STRONG_IDENTIFIER · tier EXACT · USD 84/80
  🟢🟢 **human_verdict = SAME** (2026-10-20 14시) · 🔴 `human_note` 없음 · 🔴 이미지 없음
🟢 그 건은 이 fixture 의 **C06** 과 같은 판매처·같은 품번이고, CEO 조서(2026-10-27)가
  **DIFFERENT → SAME 으로 재라벨** 한 바로 그 건이다(`core-same05-gt.ts` CEO_RELABEL)
```

🔴🔴 **그런데 같은 품번 B226AC009 를 판매처들이 «서로 다르게» 적는다**(원문 발췌):

```
thefrontshop.com  「· Soft cotton **long-sleeve** tee with a comfortable, breathable fee…」 사람 SAME
global.trenbe.com 「…Hug Hairy Monster **Long Sleeve** T-Shirt (Light Blue) B226AC009…」   사람 SAME
kids21.com        「Description: **Short sleeves**. Round neckline. Graphic print at th…」 🔴 사람 **SAME**
⟹ 🔴 **같은 품번에 대해 소매 길이 기재가 판매처마다 갈린다.** 어느 쪽이 사실인지
   CTO 는 단정하지 않는다 — 원상품 설명문에는 그 말이 **없다**(정보 없음)
```

🔴🔴 **그래서 「의류 형태 / 소매 길이 축」의 효과를 실측했고 결과는 순손실이다**:

```
원상품 B226AC010(Booty Ghosts **Long Sleeve**) — 원문에 소매 단어가 있는 3건
  rboutique   「**Long-sleeved** T-shirt made from organic cotton mela…」 사람 SAME 🟢
  cissywears  「…this **long-sleeved** tee features two delightfully wonky l…」 사람 SAME 🟢
  junioredition「Relaxed fit light blue tee featuring **short sleeves**, a ribbed…」 사람 DIFFERENT 🟢
  ⟹ 🟢 **3/3 정합**
원상품 B226AC009 — 원문에 소매 단어가 있는 3건
  thefrontshop long-sleeve → SAME 🟢 · trenbe Long Sleeve → SAME 🟢
  kids21 **short sleeves** → 🔴 사람 **SAME**  ⟹ **반증 1건**
⟹ 🔴 분모 6 · 정합 5 · **반증 1**
🔴🔴 그리고 **얻는 것이 0 이다** — 유일하게 새로 막을 수 있는 junioredition(S1-5)은
   **이미 MODEL_CODE 충돌로 EXCLUDED** 다. 새로 막히는 것은 **kids21(사람 SAME)** 뿐이다
⟹ 🔴 이 표본에서 소매 축 = **얻는 것 0 · 잃는 것 1** ⟹ **순손실**
🟢 WU-123/125 의 「재현 0/18 · 새 축 금지」와 **같은 방향** 이다 ⟹ CPO 의 «보류» 가 맞다
```

🔴 **CTO 는 그 축을 만들지 않았다.** 그리고 「원상품은 반팔이다」라고도 **적지 않는다**(정보 없음).

---

## 보완-3c. 특별 검증 ③ — **villagekids** (판정 2건 충돌 · 이력 삭제 0)

🔴 **이력을 하나도 지우지 않았다.** 🟢 같은 URL 31행을 다시 읽어 **새 사실 하나** 를 찾았다.

```
villagekids.co.uk/products/pale-blue-3d-logo-t-shirt  (origin **B226AC009**)
  10-21 18시  human **DIFFERENT**  blockers[NO_TITLE_OVERLAP·MATERIAL·AUDIENCE_LINE·BRAND_UNCONFIRMED]
  10-22 01시  human **SAME**       blockers[**동일**]  ⟹ 🔴 두 판정의 모든 축이 같다
  🔴 `human_note` **둘 다 없음** · 🔴 **이미지 없음** ⟹ 사람이 이미지 없이 판단했다
⟹ 🔵 **「판단 불가」가 그대로 답이다**(FINAL-MARKET-COMPARISON-REVIEW §10 과 동일 결론)
```

🟢🟢 **새 사실 — 그 판매처는 애초에 그 브랜드를 팔지 않는 것으로 보인다**(운영 데이터 전수):

```
villagekids.co.uk 후보 제목 전수 — 「Blue Half Zip Sweatshirt」·「Blue Knitted Jacket」·
  「Blue T-Shirt」·「Blue Tie-Dye Polo Bear T-Shirt」·「Denim Blue Jeans」·
  「Navy Logo Rugby Sweatshirt」·「Pale Blue 3D Logo T-Shirt」·
  「White Multi Sequin Logo Crop T-Shirt」·「White Stripe Graphic T-Shirt」
🔴 **Bobo Choses 가 제목에 한 번도 없다** · `BRAND_MISMATCH` 가 **거의 전건에 붙어 있다**
🔴🔴 그런데 **전건이 PRESUMED_SAME → TEXT_CONFIRMED → COMPARISON → 금액 자격** 이다
   보류가 **4~5개** 붙은 후보가 화면에서 「동일상품 추정」 가격으로 선다
🔴 CPO ① 이 지적한 `Denim Blue Jeans`(GBP 39.5 · B226AC073)가 **그 줄이다**
   — 보류 5개[BRAND_MISMATCH·COLOR_VARIANT·NO_TITLE_OVERLAP·MATERIAL·AUDIENCE_LINE]
🟢 그 두 줄(Denim Blue Jeans · White Multi Sequin)은 `price_status = UNVERIFIED_SEARCH`
   ⟹ **이미 승인된 UNVERIFIED 분리 작업이 그것을 금액에서 뺀다**(후보로는 보존)
```

🔴 **그래도 그것으로 다 닫히지 않는다** — `pale-blue-3d-logo-t-shirt` 계열은
`price_status = null`(낡은 저장분)이라 **그 수정으로는 빠지지 않는다**.
🔴 그 null 을 막는 것은 **금지** 다(기존 후보가 조용히 사라진다 · 선행 조사 결론 유지).
⟹ 🔵 남는 것은 **보완-5 의 구조 문제** 다.

---

## 보완-4. 상세설명 유래 **MODEL_CODE** — 신호 «방향» 으로 다시 쟀다

🔴 분모 **6**(5 가 아니다 · C06 누락을 정정). 🔴 n=6 이라 **일반화하지 않는다**.

| id | 판매처 | 원본 품번 | 후보 품번(설명문 유래) | 신호 | 사람 | 신호가 맞았나 |
|---|---|---|---|---|---|---|
| C05 | tinyapple.net | B226AC009 | B226AC009 | 일치 | SAME | 🟢 맞음 |
| C06 | global.trenbe.com | B226AC009 | B226AC009 | 일치 | SAME | 🟢 맞음 |
| C19 | junioredition.com | AW26MS185 | AW26MS185 | 일치 | **DIFFERENT** | 🔴 틀림(색상) |
| C20 | junioredition.com | AW26MS185 | AW26MS185 | 일치 | **DIFFERENT** | 🔴 틀림(색상) |
| S1-5 | junioredition.com | B226AC010 | **B226AC141** | 불일치 | DIFFERENT | 🟢 맞음 |
| S1-6 | tinyapple.net | B226AC010 | **B226AC141** | 불일치 | DIFFERENT | 🟢 맞음 |

```
🟢 **반증 방향(「다르다」) 2/2 정확** — 그리고 **이미 그렇게 쓰이고 있다**
   (둘 다 CONFLICT → EXCLUDED → 금액에서 빠진다)
🔴 **긍정 방향(「같다」) 2/4** — 품번 일치가 SAME 을 보장하지 않는다
🟢🟢 그리고 **틀린 2건의 원인이 규명됐다** — 같은 품번의 **다른 색상/무늬** 다(보완-3)
```

🔴🔴 **그래서 결론 문장이 바뀐다 — 「유효하지 않다」가 아니다**:

> 상세설명 Model Code 는 **반증(차단)에는 유효하고, 긍정(SAME 확정)에는 단독으로
> 불충분하다.** 막는 것은 코드의 품질이 아니라 **코드가 가리키는 단위** 다 —
> 🟢 그것이 STAGE 4-G **변경 C** 가 코드에 적어 둔 그 문장이다:
> 「브랜드 품번은 «모델» 을 식별한다. «판매 단위(SKU)» 를 보증하지 않는다」
> ⟹ 🟢 **변경 C 의 주석이 실데이터로 확증됐다.**

🔴 **승격도 폐기도 하지 않았다**(CPO 「5건만으로 폐기 판단 금지」 수용 · 분모 6).

---

## 보완-5. 🔴🔴🔴 **두 축을 나란히 — 「FP 0」은 「틀린 가격이 안 들어간다」가 아니다**

| 분모 25 | verdict 축 (SAME 확정) | **금액 자격 축** (EXACT\|COMPARISON) |
|---|---|---|
| 사람 SAME 17 | 6/17 | **13/17** |
| 사람 DIFFERENT 8 | **0/8** 🟢 | 🔴 **4/8** |
| | precision 6/6 · recall 6/17 | **precision 13/17 · recall 13/17** |

```
🔴🔴 사람 DIFFERENT 4건이 금액에 들어가고, 그 경로가 **하나** 다 —
   PRESUMED_SAME → `crossSellerReserved` → **TEXT_CONFIRMED** → **COMPARISON** → 금액 자격
   C51(BRAND_UNCONFIRMED) · C19 · C20(COLOR_VARIANT) · C25(COLOR_VARIANT)
🟢 보류 축은 **제 일을 했다** — SAME 을 막았다. 🔴 그런데 **금액은 막지 못한다**
🟢 반대로 EXCLUDED 로 떨어진 4건(C22·S1-5·S1-6·S6-4)은 **정확히 빠진다**
```

🔵🔵 **이것이 STAGE 4-H 가 Ⓑ 로 남긴 「노출 등급 ↔ 가격 자격 분리」의 실측 근거다.**
🔴 그리고 **CPO ① 의 「£21.20 과 £37 을 한 범위로 합치지 말라」와 같은 뿌리** 다 —
   21.2 는 `COMPARISON`(추정) 이고 37 은 `EXACT`(확정) 인데 **한 줄로 합쳐진다**.
🔴 **CTO 가 고치지 않았다** — `priceTierFromLink` 는 LOCK 이다.

---

## 보완-6. **FN 11건 각각** — 무엇이 막았는가 · 공통 원인이 있는가

🔴 FN 정의 = 사람 SAME 인데 **시스템이 SAME 을 확정하지 못한 전부**(그래서 11 이다).
🟢 SAME 게이트는 `!blocked && brandOk && corePoints >= 5` 이고
   `!brandKnown → BRAND_UNCONFIRMED` · `brandKnown && !brandOk → BRAND_MISMATCH` 가
   **둘 다 blocker** 다(cross-seller.ts:844) ⟹ 🟢 **blockers 가 비면 brandOk 는 참** 이다.
⟹ 🔴 막는 것은 **①blocker ②corePoints<5** 둘뿐이고, 그것을 **추측 없이** 적었다.

| id | 판매처 | verdict | **tier** | corePoints | **막은 것** |
|---|---|---|---|---|---|
| C48 | bobochoses.com | PRESUMED_SAME | COMPARISON | **11** | `BRAND_UNCONFIRMED` |
| C11 | bobochoses.co.jp | PRESUMED_SAME | COMPARISON | 7 | `BRAND_UNCONFIRMED` |
| C37 | bobochoses.co.jp | PRESUMED_SAME | COMPARISON | 7 | `BRAND_UNCONFIRMED` |
| C14 | kihanan.com | PRESUMED_SAME | COMPARISON | 6 | `BRAND_UNCONFIRMED` |
| S1-4 | kolkid.ca | PRESUMED_SAME | COMPARISON | 7 | `FIT` |
| C27 | beaumonde.co.kr | PRESUMED_SAME | COMPARISON | 2 | corePoints 2<5 |
| S1-1 | rboutique.com | PRESUMED_SAME | COMPARISON | 2 | corePoints 2<5 |
| S2-3 | bobochoses.com | PRESUMED_SAME | **EXCLUDED** | 6 | `MODEL_CODE_AGE_LINE`·`FIT` + 충돌 `MODEL_CODE` |
| S1-7 | bobochoses.com | CONFLICT | **EXCLUDED** | 0 | 충돌 `MODEL_CODE` |
| S2-1 | stockmann.ee | SIMILAR | **EXCLUDED** | 0 | corePoints 0<5 |
| S3-1 | stadtlandkind.ch | SIMILAR | **EXCLUDED** | 1 | corePoints 1<5 |

🔴🔴 **먼저 — FN 11 은 한 덩어리가 아니다**:

```
PRESUMED_SAME 8  →  tier COMPARISON **7** ⟹ 🟢 화면에 「동일상품 추정」으로 **이미 서 있고
                     금액에도 들어간다** ⟹ 🔴 「놓쳤다」로 적으면 거짓이다
                     tier EXCLUDED **1**(S2-3 · 품번 충돌이 덮는다)
SIMILAR 2 · CONFLICT 1 → tier **EXCLUDED 3** ⟹ 🔴 **여기만 화면·금액에서 빠진다**
⟹ 🔴 **실제 손실은 4/17**(EXCLUDED)이고 11/17 이 아니다
```

🟢🟢 **공통 원인은 «하나» 가 아니고 «넷» 이다. 그리고 셋은 이미 이름이 있다**:

```
① 🔴 **브랜드 공백 4건**(BRAND_UNCONFIRMED) — **가장 크고 가장 아깝다**
   C48 은 corePoints **11** 이다(기준 5의 2배) · C11/C37 7 · C14 6
   ⟹ 🔴 **증거가 충분한데 브랜드 칸 «하나» 가 비어서 SAME 이 안 된다**
   🔴 그리고 **공백이 원상품 쪽인 것이 2건** 이다(C48 · C14 — 둘 다 공식몰/일본몰)
   🟢 이름이 이미 있다 — WU-080 · WU-134(공식몰 vendor 가 시즌코드) · WU-142/143
   🔴 **BRAND 완화는 CPO 가 REJECT 했다**(FP +2 실측) ⟹ 레버는 **완화가 아니라 «공급»** 이다

② 🟡 **증거 자체가 부족 5건**(corePoints 0~2) — C27 · S1-1 · S1-7 · S2-1 · S3-1
   🔴 C27 은 **한국어 제목** 이라 토큰이 겹치지 않는다(WU-064 가 확정한 자리)
   🔴 S2-1(에스토니아)·S3-1(독일)은 **현지어 제목** 이다 ⟹ 같은 성질
   🟢 이름이 이미 있다 — `NO_TITLE_OVERLAP`/언어 축(WU-065·WU-078)
   🔴 **그 축은 완화 금지** 다(WU-078: 회수 0 · C08 이 뚫린다)

③ 🟡 **핏 어휘 2건**(FIT) — `relaxed fit` ↔ `loose fit`(S1-4 · S2-3)
   🔴 사람은 **같은 말로 읽었고** 시스템은 **다른 값으로 읽었다**
   🔴 **동의어 사전은 새 규칙이다** ⟹ CTO 가 만들지 않았다(CPO 판단 사안)

④ 🟡 **AC↔AB 라인 차이 2건**(충돌 MODEL_CODE) — S1-7(AC010↔AB046) · S2-3(AC009↔AB040)
   🟢🟢 **CEO 가 그 라인 차이를 SAME 이라 했다**(메모 `line-difference-is-the-first-separable-axis`)
   🔴 그리고 그 완화는 WU-069/070 이 **「품번 보호 해체」** 로 측정했다 ⟹ **CPO 미결**
```

🔵 **그래서 recall 축의 다음 한 수가 «측정으로» 특정됐다** — ①**브랜드 공급**(완화 아님).
🔴 분모 4/11 이고 그중 2건은 **원상품 쪽 공백** 이라 후보를 고쳐서는 풀리지 않는다.
🔴 **CTO 는 구현하지 않았다**(Identity 정책 변경 금지 · CPO 지시 준수).

---

## 보완-7. 검증·금지 전수 대조

```
🟢 회귀   apps/admin  **778 files / 10,058 passed / 0 failed** (vitest exit 0)
🟢 typecheck  `error TS` **0** (tsc exit 0)
🔴 운영 코드 변경 **0** — 바뀐 것은 라이브 하니스 **출력 절 6개**(`[7]`~`[12]`)와
   READ-ONLY 조회 스크립트 1개(`stage6-special-cases.mjs`)뿐이다
🔴 점수 **0** · threshold **0** · 새 blocker **0** · Identity 판정 **0** ·
   `priceTierFromLink` **0** · `SIMILAR → textOnly` **0** · 가격 안전장치 **0** ·
   Legacy GT 수정 **0** · 사람 판정 이력 삭제/덮어쓰기 **0** · DB 쓰기 **0** ·
   Migration **0** · 새 과금 **0** · 색상사전 확대 **0** · 패턴/소매 축 신설 **0**
🟢 네트워크 = 기존 승인 범위(라이브 HTTP 25 호스트 · 유료 provider **0**)
```

🔴🔴 **내가 또 틀린 것 — 칸 이름 추측 14번째**: `candidate_reviews.system_match_truth`·
`system_price_tier` 로 질의해 **42703** 을 맞았다(실제 `match_truth`·`price_tier`).
🟢 `information_schema` 로 읽어 고쳤고 스크립트 주석에 그 사실을 남겼다.

---

## 보완-8. 🔵 **CPO 결정 대기 — CTO 가 하나도 열지 않았다**

```
① 🔵 **브랜드 공급**(FN 4/11 · corePoints 는 이미 충분) — 완화가 아니라 «칸을 채우는» 축
   🔴 단 공백 2건이 **원상품 쪽** 이다(공식몰 vendor=시즌코드 · WU-134 가 닫은 그 모양)
② 🔵 **노출 등급 ↔ 가격 자격 분리**(STAGE 4-H Ⓑ) — 사람 DIFFERENT **4/8** 이 금액에 들어간다
   🟢 CPO ① 「£21.20 ↔ £37 합산 금지」와 **같은 뿌리** 다
③ 🔵 **AC↔AB 라인 차이**(FN 2/11) — CEO 는 SAME · 완화는 품번 보호 해체
④ 🔵 **FIT 동의어**(`relaxed` ↔ `loose` · FN 2/11) — 새 규칙이라 CTO 가 만들지 않았다
⑤ 🔵 **COLOR 칸에 패턴이 섞여 들어온다**(`Conker Stripe`) — C19 를 색상 축이 놓친 이유
⑥ 🟢 **소매/의류 형태 축 = 보류가 맞다**(이 표본에서 얻는 것 0 · 잃는 것 1 · 순손실)
⑦ 🟢 **UNVERIFIED 가격 분리는 이미 승인된 별도 작업** 이다 — 이 보완과 섞지 않았다
   (스펙 `FINAL-MARKET-COMPARISON-REVIEW.md` §11 · 4단계 · 조사 불필요)
```

🔴🔴 **이 보고의 모든 숫자는 라이브 확보 25쌍의 값이고 Identity 시스템 전체 성능이 아니다.**
