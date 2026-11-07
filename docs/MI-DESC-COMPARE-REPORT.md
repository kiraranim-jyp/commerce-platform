# 상세설명 비교 완료 및 최초 판단 대비 개선 효과 — 전체 조사 보고서

> 🔴 **운영 코드 · 추출기 · matcher · Identity · alias · GT · DB · schema · UI 변경 0.**
> 🔴 **DB 쓰기 0 · 운영 함수 호출 0 · 외부 URL 재방문 0** — 기존에 확보한 원문만 재사용했다.
> 🔴 모든 `shadow` 값은 **조사용 산출이고 운영 판정이 아니다**(어휘를 `SHADOW_` 로 분리했다).
> 기준 HEAD `24847b93` → 이 세션 커밋 · 추가 파일은 **읽기 전용 스크립트 셋 + 문서 둘**.

---

## 0. 결론 세 줄 — 먼저 읽는다

```
① 🔴🔴 **상세설명을 더 모으는 것이 레버가 아니다.** 비교가능 82쌍에서 원문이
   «운영이 모르던» 정보를 새로 준 것은 **3건**(BRAND 2 · MODEL_CODE 1)이고,
   그중 **상세설명(DESCRIPTION) 출처는 2건** 이며 **둘 다 독일어 · 둘 다 「약한 근거」** 다.
② 🟢🟢 **개선 가능 12건의 근거는 이미 운영 안에 있었다.** 「최초 PRESUMED_SAME →
   품번 일치로 강한 동일」 **6건 전부** `운영이 품번 축 보유 = true` 인데
   **보조 축 blocker**(MATERIAL ×3 · COLOR_VARIANT · FIT+BRAND_UNCONFIRMED · NO_TITLE_OVERLAP)로 막혔다.
   ⟹ 🔴 이것은 **CPO 사업 규칙 「핵심 식별정보는 보조 차이로 덮지 않는다」와 정면으로 어긋나는 모양** 이다.
③ 🟢 **안전은 지켜졌다** — GT 12쌍에서 **오포함(false SAME) 0 · 누락(missed SAME) 0**.
   🔴 그러나 분모가 **12** 다. 「정확도가 올랐다」로 쓰지 않는다.
```

🔴 **그래서 다음 레버는 「증거 수집」이 아니라 「기존 증거의 사용 방식」** 이고, 그것은 matcher
변경이므로 **이번 범위에서 금지** 다 ⟹ **§6 에 CPO 판정 사안으로 올린다.**

---

## 5-1. 조사 개요

| 항목 | 값 |
|---|---|
| 목적 | 원상품 ↔ 후보 **상세설명 직접 비교** · 최초 판단 대비 변화 측정 |
| 데이터 출처 | 후보 = STEP 2 URL 방문 산출(`step2-evidence.json`) · **원상품 = `product_snapshots.workspace->canonicalProduct`** |
| 🟢 재방문 | **0** — 원상품 설명문이 **DB 에 이미 있었다**(`description` · `descriptionKo`) |
| 비교 방법 | 축 10개 · 상태 넷(`MATCH`/`MISMATCH`/`UNKNOWN`/`NOT_APPLICABLE`) · 축마다 출처·원문 발췌·사유 보존 |

### 🔴 분모 — **섞지 않는다**(CPO 명시)

```
행(row)                              190
고유 후보 URL                         95
고유 원상품 URL                        27
🟢 고유 (원상품, 후보 URL) «쌍»        109   ← 조사 단위
   ├ 원상품 설명문 미확보(스냅샷 없음)  17
   ├ 후보 설명문 미확보                11
   └ 🟢🟢 **설명문 둘 다 확보 = 비교가능  82**
방문 상태                             OK 100 · UNREACHABLE 9
human GT 보유 쌍                      36(전체) · 16(비교가능) · 🔴 **12**(최초 판정 재현된 것)
```

🔴 **이 분모들을 과거 숫자와 합산하지 않는다** — `152행`·`190행`·`BRAND 누락 62건`·
`GT 확대 대상 21조합` 은 **전부 다른 분모** 다.

🔴 **원문 미확보를 「확인 완료」로 처리하지 않았다** — 비교 불가 27쌍은 `shadow`·`변화` 를
**`NOT_COMPARABLE` 로 비워 뒀다**(1차 산출은 거기에도 결론을 적어 표가 모순됐다 · §8-⒞).

### 🔴 원상품 쪽 구조화 칸 보유(분모 = 스냅샷이 있는 원상품 **27 URL**)

```
title 27/27 · description 27/27 · descriptionKo 26/27 · color 23/27 · material 12/27
🔴 **sku 5/27** ⟹ 원상품 품번은 `canonicalProduct.sku` 로 거의 오지 않는다
   (이 조사는 `originCode`·`originCodes`·제목·URL 을 같이 썼다)
```

---

## 5-2. 최초 시스템 판단 결과 (분모 **82**)

```
PRESUMED_SAME 69 · SAME 7 · CONFLICT 2 · 🔴 BASELINE_NOT_REPRODUCED 4
```

### 최초 판단이 **무엇으로 막았는가** — `baselineBlockers` 전수

| blocker | 건수 | 대응 축 |
|---|---:|---|
| `BRAND_MISMATCH` | **53** | BRAND |
| `NO_TITLE_OVERLAP` | **41** | PRODUCT_NAME |
| `MATERIAL` | **33** | MATERIAL |
| `AUDIENCE_LINE` | **31** | AUDIENCE_AGE |
| `COLOR_VARIANT` | 10 | COLOR |
| `SAME_SELLER_DISTINCT_LISTING` | 5 | (판매처 축) |
| `MODEL_CODE` | 4 | MODEL_CODE |
| `FIT` | 4 | SIZE_FIT |
| `GARMENT_FORM` | 3 | FORM_DESIGN |
| `MODEL_CODE_AGE_LINE` | 2 | MODEL_CODE |
| `BRAND_UNCONFIRMED` | 1 | BRAND |
| `COLOR` | 1 | COLOR |

🟢 **그 어휘가 내 축 10개에 1:1 로 대응된다** — 그래서 「최초가 막아 둔 축을 원문이 뒤집는가」를
**추측 없이** 셀 수 있었다(§5-4).

---

## 5-3. 상세설명 비교 결과 — 축별 (분모 **82**)

| 축 | MATCH | MISMATCH | UNKNOWN | N/A |
|---|---:|---:|---:|---:|
| BRAND | 24 | **0** | 58 | 0 |
| MODEL_CODE | 15 | 4 | 63 | 0 |
| PRODUCT_NAME | 25 | 34 | 23 | 0 |
| FORM_DESIGN | 57 | 2 | 23 | 0 |
| COLOR | 50 | 7 | 25 | 0 |
| MATERIAL | 17 | 3 | 62 | 0 |
| AUDIENCE_AGE | **0** | **0** | **82** | 0 |
| SIZE_FIT | 15 | 0 | 67 | 0 |
| SET_OPTION | 0 | 3 | 0 | 79 |
| IMAGE | 0 | 0 | 82 | 0 |

### 🔴 「많다/적다」를 그대로 읽지 않는다 — UNKNOWN 의 **사유를 세었다**

```
BRAND UNKNOWN 58    = 후보 원문에 원상품 브랜드 문자열이 **없다** 55 + 원상품 브랜드가 **공백** 3
   🟢 그 55 는 **참이다**(샘플 확인) — 후보가 실제로 다른 상품이다:
      「Hugo Boss Baby Boys Double B Graphic T-Shirt」 · 「Daunenjacke Reversible Quilted」(Colmar) ·
      「Charlie White Mandarin Collar Shirt」 · 「Girls Pink Knit Sweater」
   🔴 그래서 **`MISMATCH` 가 0 인 것이 정상** 이다 — 「없다」를 「다르다」로 적지 않았다(원칙 ⒝).
MODEL_CODE UNKNOWN 63 = 후보에 품번 모양 없음 41 + **원상품 품번 없음 19** + 다른 코드 체계 3
AUDIENCE_AGE UNKNOWN 82 = 🔴 **대상 어휘가 원문에 없다**(Bobo/Wynken 설명문이 kids/아동을 안 쓴다)
   🔴🔴 그런데 운영은 `AUDIENCE_LINE` 으로 **31건을 막았다** ⟹ 운영은 **다른 입력**(구조화 필드)으로
      그 축을 본다. ⟹ 「상세설명으로 대상 축을 보강한다」는 **이 데이터로 성립하지 않는다**
IMAGE UNKNOWN 82    = 🔴 **PROBE 다.** 이미지 보유 수만 셌고 **내용 비교를 하지 않았다**(사람 판독 필요)
```

### 🟢 표기 차이를 불일치로 적지 않은 자리 — 실측

```
🟢 소재 수식어        「organic/recycled cotton ↔ cotton」은 섬유 구성이 같으면 **MATCH**
                     (`notationOnly` 로 표시 · 메모 `description-evidence-turns-same-into-blockers` 그 함정)
🟢 색상 옵션          후보 원문이 색상을 **3개 이상** 싣거나 원상품 색을 포함하면 **UNKNOWN**
                     (「옵션 다수」 · 불일치로 적지 않는다)
🟢 번역 차이          문자체계가 다르면 상품명 **UNKNOWN**(1건) — 「겹치지 않는다」를 불일치로 쓰지 않는다
🟢 사이즈 체계 차이    **UNKNOWN** + WU-045 계약 명시(단독으로 동일성을 막지 않는다)
🟢 판매처 자체 코드    품번 **«가족 서명»** 이 다르면(`L1D3L2D3` ↔ `L2D2L6D6`) **UNKNOWN**(3건) —
                     🔴 제조사 품번 불일치로 적지 않는다(메모 `candidate-code-path-ignores-the-title`)
🟢 접두 생략형        후보 제목 「… sweatshirt **#226AC036**」(앞 `B` 생략)을 **MATCH** 로 잡는다
```

---

## 5-4. 최초 판단 대비 개선 결과 (분모 **82**)

| 변화 | 건수 | 최초 판정 내역 |
|---|---:|---|
| **판단 유지**(MAINTAINED) | **14** | SAME 7 · PRESUMED_SAME 7 |
| **개선 가능**(IMPROVABLE) | **12** | PRESUMED_SAME 10 · CONFLICT 2 |
| **판단 불가**(UNDECIDABLE) | **56** | PRESUMED_SAME 52 · BASELINE_NOT_REPRODUCED 4 |
| 🟢 **최초 판단 오류**(FIRST_JUDGMENT_ERROR) | **0** | — |

### 🟢 최초 SAME 7건 — **상세설명에서 강한 불일치가 나온 건은 0** 이다

```
전건 `MISMATCH` 축 **없음** · shadow STRONG_SAME 5 · LIKELY_SAME 2
⟹ 🟢 「최초 SAME 인데 상세설명이 반증한다」(CPO §3-D 별도 보고 대상)는 **해당 0건**
```

### 🔴🔴 개선 가능 12건의 «근거 출처» — **이것이 이 조사의 핵심이다**

```
품번 출처  STRUCTURED_DATA 7 · TITLE 4 · (없음) 1
🔴 **신규 발견 축 = 「없음」이 12/12** ⟹ 개선 여지가 **상세설명에서 온 것이 아니다**
```

**「최초 PRESUMED_SAME → 품번 일치로 강한 동일」 6건 전수** (🔴 다시 재지 않는다):

| 원상품 품번 | 후보 | 품번 근거 출처 | 운영이 품번 축 보유 | 최초 blocker |
|---|---|---|:-:|---|
| B226AC009 | junioredition.com | STRUCTURED_DATA | 🔴 **true** | `FIT` `BRAND_UNCONFIRMED` |
| B226AC009 | miniboutique.co.kr | TITLE | 🔴 **true** | `NO_TITLE_OVERLAP` |
| B226AC033 | junioredition.com | STRUCTURED_DATA | 🔴 **true** | `MATERIAL` |
| B226AC038 | junioredition.com | STRUCTURED_DATA | 🔴 **true** | `MATERIAL` |
| B226AC073 | junioredition.com | STRUCTURED_DATA | 🔴 **true** | `COLOR_VARIANT` |
| WK21A165 | junioredition.com | STRUCTURED_DATA | 🔴 **true** | `MATERIAL` |

🔴🔴 **6/6 이 「증거를 갖고도 막혔다」** — `evidenceCodeSources` 가 비어 있지 않다.
⟹ **상세설명을 더 모아도 이 6건은 열리지 않는다.** 막는 것은 **보조 축 blocker** 다.
🟢 이것은 메모 `blockers-fired-with-evidence-in-hand`(13/18)의 **재현** 이고, CPO 사업 규칙
「핵심 식별정보는 보조 차이로 덮지 않는다」가 **현재 코드에서 지켜지지 않는 자리** 다.

### 🔴 「기존에 놓친 동일 상품」 / 「잘못 동일로 볼 위험」

```
🟡 놓친 동일상품 후보     최초 PRESUMED_SAME → shadow STRONG_SAME **6** · LIKELY_SAME 3
                        🔴 그중 human GT 가 있는 것은 **1건**(human SAME · 일치) ⟹ 나머지 8 은 **측정불가**
🟢 잘못 동일로 볼 위험     최초 SAME 7 중 상세설명 반증 **0** · GT 대조에서 오포함 **0/12**
🔴 CONFLICT 2 → shadow LIKELY_DIFFERENT 2 (품번 충돌 재확인 · 최초가 맞았다)
```

---

## 5-5. 정확도 개선 효과와 한계

### 🔴 신규 발견 vs 이미 알고 있던 정보 — **중복 계산하지 않았다**(CPO 검토 ①)

```
🟢 원문에서 **신규** 확인(운영 추출기가 그 축을 안 갖고 있었다)
      BRAND **2** · MODEL_CODE **1**            ← 분모 82
🔴 운영 추출기가 **이미** 갖고 있었다
      MODEL_CODE **25** · BRAND **3**
🔴 **신규 여부 미확인**(운영 보유 신호가 없는 축 — 「신규」로도 「기존」으로도 세지 않는다)
      FORM_DESIGN 57 · PRODUCT_NAME 25 · MATERIAL 17
🔴 판정 기준 — `evidenceBrandSources` / `evidenceCodeSources` **둘만** 운영 보유 신호가 있다.
   나머지 축은 운영이 갖고 있었는지 **알 수 없다** ⟹ 「신규 N」으로 적지 않았다.
```

**신규 3건 전수**(🔴 분모 82 · 일반화 금지):

| 원상품 | 후보 | 신규 축 | 출처 | 원문 | shadow |
|---|---|---|---|---|---|
| B226AC017 | nickis.com | BRAND | DESCRIPTION | 「…Dieses **Bobo Choses** Tank Top aus der Iconic Collection…」 | NEEDS_REVIEW |
| WK21W97 | nickis.com | BRAND | DESCRIPTION | 「…während die **Wynken**-Stickerei in Form einer Malpalette…」 | LIKELY_SAME |
| B226AC033 | tiptoeboutique.com | MODEL_CODE | **URL** | `…/products/b226ac033-midnight-blue…` | STRONG_SAME |

🔴🔴 **그래서 「상세설명이 준 신규 정보」는 «2건» 이고 둘 다 독일어이며 둘 다 「귀속 문구 없는
약한 근거」** 다. 세 번째는 **URL** 이지 설명문이 아니다. 🔴 그 둘은 **STEP 3B 보류 사안**
(독일어 지시사 귀속)과 **같은 자리** 다 — 이번에 규칙을 만들지 않았다.

### 🟢 최초가 막아 둔 축을 원문이 뒤집는 건 — **4건**

```
COLOR 2 · MATERIAL 2
   B226AC017 nickis.com           COLOR    blockers=[COLOR_VARIANT, NO_TITLE_OVERLAP]  → NEEDS_REVIEW
   (원상품 품번 없음) designerkidswear.com ×2  MATERIAL  → 🔴 shadow UNDECIDABLE(브랜드·품번 공백)
   (원상품 품번 없음) petitemaisonkids.com     COLOR     → 🔴 shadow UNDECIDABLE
🔴 ⟹ 4건 중 **3건은 실효 개선이 아니다** — 보조 축을 뒤집어도 핵심 식별이 비어 있다
```

### GT 기준 평가 — 🔴 **분모 12** (측정불가를 가린다)

| 기준 | 분모 | 일치 | 역방향 오류 | 보류 | 🔴 오포함(false SAME) | 🔴 누락(missed SAME) |
|---|---:|---:|---:|---:|---:|---:|
| 안 A (품번 충돌 → 다른 상품) | 12 | 3 | **1** | 8 | **0** | **0** |
| 안 B (품번 충돌 + 브랜드·형태 일치 → 유사상품) | 12 | 4 | **0** | 8 | **0** | **0** |

```
human SAME      2 → SHADOW_STRONG_SAME 2        🟢 전건 일치
human SIMILAR   1 → 안 A: LIKELY_DIFFERENT(불일치) / 안 B: LIKELY_SIMILAR(일치)
human DIFFERENT 9 → UNDECIDABLE 8 · LIKELY_DIFFERENT 1
   🔴 **보류 8 을 「일치」로도 「오류」로도 세지 않았다** — 셋으로 갈랐다
   🟢 그러나 **동일 쪽으로 올린 건이 0** 이므로 **오포함 0** 이다(안전 축은 지켜졌다)
```

🔴 **GT 없는 70쌍은 TP/FP 로 계산하지 않았다**(측정불가).
🔴 **증거 발견 건수를 정확도 개선 건수로 쓰지 않았다** — 위 두 표는 **분모가 다르다**(82 ↔ 12).
🔴 `BASELINE_NOT_REPRODUCED` 4쌍은 GT 가 있어도 **대조 자체가 성립하지 않아** 제외했다.

### 사람 판정과 시스템 판정의 차이

```
🟢 human SAME 2건은 최초가 **PRESUMED_SAME / SAME** 이었고 shadow 가 STRONG_SAME 으로 올린다
🔴 human SIMILAR 1건(B226AC110 ↔ B226AC111)이 **규칙 선택을 가른다** —
   품번이 「같은 체계, 접두 4자 뒤 분기」로 충돌하는데 사람은 **유사상품** 이라 했다
   🔴 CPO 지시서에 품번 «충돌» 의 안내 등급이 **명시돼 있지 않다** ⟹ **CTO 가 고르지 않았다**
   🔴 `N=1` 이다 — 이 한 건으로 규칙을 확정하지 않는다
```

### 운영 반영 전 추가 검증 사항

```
🔴 분모 — GT 12 · 비교가능 82 · 브랜드 편향(Bobo Choses 계열이 다수) ⟹ 표본 확대 필요
🔴 IMAGE 축은 **미측정**(PROBE) — 사람 판독만 가능
🔴 AUDIENCE 축은 상세설명으로 **보강되지 않는다**(운영은 다른 입력을 쓴다)
🔴 품번 충돌 안내 등급(안 A/B) **미확정**
🔴 독일어 귀속 2건은 **문법 규칙 미승인** 상태의 「약한 근거」다
```

---

## 5-6. 추가 발견 사항 — 🔴 **정확도 영향 순으로 분리했다**(한 번에 구현하지 않는다)

| 우선 | 과제 | 근거(이번 조사 실측) | 성격 |
|:-:|---|---|---|
| **1** | **핵심 식별(품번) 일치 시 보조 축 blocker 의 가중치** | 개선 가능 6/6 이 `운영 품번 보유=true` 인데 `MATERIAL`·`COLOR_VARIANT`·`FIT`·`NO_TITLE_OVERLAP` 로 막혔다 | 🔴 **matcher 변경 · CPO 판정** |
| **2** | 원상품 품번 공급 | `canonicalProduct.sku` **5/27** · MODEL_CODE UNKNOWN 중 **19건이 원상품 품번 부재** | 추출/데이터 |
| **3** | `BRAND_MISMATCH` **53건** 의 성질 | BRAND 축 `MISMATCH` 는 이 비교에서 **0** 인데 운영은 53건을 그렇게 막았다 ⟹ **같은 말이 다른 것을 가리킨다** | 🔴 조사 선행 |
| 4 | 품번 충돌 안내 등급(안 A/B) | GT 1건이 안 B 를 지지 · 전체 차이 3쌍 | 정책 |
| 5 | BRAND alias 의존성 · 영문 정식 브랜드명 | 신규 BRAND 2건이 **독일어** 이고 둘 다 「약한 근거」 | STEP 3B 보류 |
| 6 | 판매처명 ↔ 제조사 브랜드 혼동 | 게이트 발화 **0**(분모 190) · 상점 접두사 4건 | STEP 3B 보류 |
| 7 | 상품명 번역·표기 차이 | PRODUCT_NAME `MISMATCH` 34 · 문자체계 차이 1 · `NO_TITLE_OVERLAP` 41 | 조사 |
| 8 | 이미지 증거 | IMAGE 82/82 **PROBE** | 사람 판독 |
| 9 | 반복 스냅샷·데이터 중복 | 행 190 → 쌍 **109** · 「Hug Hairy Monster」 하나가 38행 | 데이터 위생 |
| 10 | 국내 후보 부족 | 비교가능 82 중 국내 판매처는 `miniboutique.co.kr` 등 **소수** | 공급 |

🔴 **1번이 2~10 을 압도한다** — 다른 어떤 축을 보강해도 그 자리에서 막히면 결과가 바뀌지 않는다.

---

## 6. 보호 조건 대조 — 전수

```
✅ Contract P2 유지                 증거를 판정 함수에 **연결하지 않았다**(계약 21건 그대로 통과)
✅ `facts.brand` 자동 승격 금지       승격 코드 **0**
✅ matcher · Identity 변경 금지      변경 **0**
✅ SAME/SIMILAR/UNKNOWN/CONFLICT 기준 불변  운영 어휘를 쓰지 않고 `SHADOW_` 로 분리
✅ 가격을 동일성 증거로 쓰지 않음      가격 축 **없다**
✅ 신규 alias 확대 금지              **0**
✅ 기존 GT 수정 금지                 읽기만(쓰기 0)
✅ GT 신규 판정 미착수               **0건**
✅ 기존 추출기·운영 코드 변경 금지     변경 **0**
✅ DB schema · UI 변경 금지          **0**
```

---

## 7. 제출물

| # | 제출물 | 위치 |
|:-:|---|---|
| 1 | 쌍별 비교 JSON(축별 사유·출처·원문 발췌·운영 보유 여부 전건) | `%TEMP%/mi-url-evidence/desc-compare.json` |
| 2 | 쌍별 비교 CSV | `%TEMP%/mi-url-evidence/desc-compare.csv` |
| 3 | 최초 판단 ↔ shadow 비교표(109쌍 전수) | [`docs/MI-DESC-COMPARE-PAIRS.md`](MI-DESC-COMPARE-PAIRS.md) |
| 4 | 증거 축별 집계 | 본 문서 §5-3 · JSON `axisDistribution` |
| 5 | 개선/오판 사례 모음 | 본 문서 §5-4 · §5-5 |
| 6 | GT 대조 및 한계 | 본 문서 §5-5 · JSON `gtCrossTab` |
| 7 | 추가 개선 과제 우선순위 | 본 문서 §5-6 |
| 8 | 전체 조사 보고서 | 본 문서 |
| 9 | 커밋 및 Git 상태 | §9 |

🟢 생성 스크립트(읽기 전용) — `packages/database/scripts/mi-desc-compare.mjs` ·
`mi-desc-compare-table.mjs`.

---

## 8. 🔴 이번 조사에서 내가 틀린 것 — **넷 다 적는다**

```
⒜ 🔴🔴 **후보 품번 자리에 «상태 문자열» 을 넣었다.** `codeBefore`/`codeAfter` 는 값이 아니라
   `MATCH`/`MISMATCH`/`UNKNOWN`/`NOT_AVAILABLE` 이다 ⟹ 「서로 다른 품번(B226AC009 ↔ **UNKNOWN**)」
   이라는 **거짓 불일치 50건** 이 나왔다. 🟢 값인 칸만 쓰도록 고쳐 **품번 충돌은 4건** 이다.
   🔴 그대로 보고했으면 「상세설명 비교로 품번 충돌 50건 발견」이라는 **완전히 틀린 결론** 이었다.
⒝ 🔴🔴 **shadow 규칙이 원칙 ⒝ 를 위반했다.** `BRAND UNKNOWN`(원상품 브랜드 공백)을 **차단
   조건으로 써서** 품번이 정확히 일치하는 쌍을 `UNDECIDABLE` 로 떨어뜨렸고, **그 안에 human GT
   SAME 이 있었다**. 🟢 차단을 `BRAND === MISMATCH` 로 좁혀 human SAME **2/2 일치** 가 됐다.
⒞ 🔴 **비교 불가 쌍에도 결론을 적었다** — 축은 `∅` 인데 `STRONG_SAME` 이 붙어 표가 모순됐다.
   🟢 `NOT_COMPARABLE` 로 비웠다(원문 미확보를 확인 완료로 쓰지 않는다 · 지시서 §4).
⒟ 🔴 **「신규 발견 MATERIAL 17」을 만들었다.** 운영이 소재를 갖고 있었는지 **신호가 없는데**
   신규로 셌다. 🟢 운영 보유 신호가 있는 축(BRAND·MODEL_CODE)만 신규로 세고 나머지는
   **「신규 여부 미확인」** 으로 분리했다 ⟹ 신규는 **3건** 이다.
🔴 그리고 분모 측정을 한 번 **틀린 방법으로** 했다 — `->>'description'` 이 `{value:""}` 객체도
   길이>0 으로 세었다. 🟢 숫자는 우연히 같았지만(27/27 비어 있지 않다) **방법이 틀렸다**.
```

---

## 9. Git

```
커밋   이 세션 커밋(아래 로그) · 작업트리 **clean** · `origin/main` 대비 **0 / 0**
변경   운영/테스트 TS **0** ⟹ 회귀·typecheck **기준선 불변**(돌리지 않았고 그 사실을 적는다)
추가   읽기 전용 스크립트 2 · 문서 2
```

```
Code PASS: N/A(운영 코드 0)     Deploy PASS: N/A(기능 변화 0)
Test PASS: N/A                 Production UI PASS: N/A
Type PASS: 기준선 불변          Production API PASS: N/A
Build PASS: 기준선 불변         Production PASS: N/A
```

---

## 10. CPO 판정이 필요한 것 — **셋** (🔴 CTO 가 하나도 고르지 않았다)

```
① 🔴🔴 **우선순위 1번을 열 것인가** — 「핵심 식별(품번) 일치 시 보조 축 blocker 가중치」.
   근거는 6/6 실측이고 **matcher 변경** 이라 이번 범위에서 금지였다.
② 품번 충돌 안내 등급 — 안 A(다른 상품) ↔ 안 B(브랜드·형태 같으면 유사상품).
   GT 1건이 안 B 를 지지하고 전체 차이는 **3쌍** 이다. 🔴 N=1.
③ 표본 확대 범위 — GT 분모가 **12** 다. 「정확도 개선」을 수치로 말하려면 GT 가 더 필요하다
   (🔴 GT 신규 판정은 이번 지시로 **보류** 상태다).
```
