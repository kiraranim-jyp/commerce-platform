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
