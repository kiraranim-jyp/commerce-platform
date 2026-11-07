# MI-REEVAL **STEP 4** — 기존 MI 기준선 «재현» (+ STEP 3 보완)

> 🔴 **운영 코드 · matcher · extractor · alias · Identity · GT · DB · schema · 검색/수집
> 변경 0 · 네트워크 0.** 최종 판정(SAME/SIMILAR/DIFFERENT/UNDECIDED)은 **STEP 5** 다 —
> 산출 JSON 에 그 칸이 **없다**(계약으로 금지).
> 산출 — `mi-reeval-04-baseline.test.ts` · `docs/MI-REEVAL-STEP4-BASELINE.json`

---

## 0. 🔴🔴 「기존 MI」는 **세 가지 다른 것** 이다 — 한 칸에 넣지 않았다

| | 이름 | 무엇인가 | 분모 |
|---|---|---|---:|
| ⒜ | `dbStoredVerdict` | `candidate_reviews.system_verdict` — 운영이 **그때 적어 둔** 값 | 38행 중 verdict 보유 소수 |
| ⒝ | `reproducedVerdict` | 저장 facts 로 **운영 사슬을 지금 다시** 부른 값 | **33** |
| ⒞ | `liveRunVerdict` | STEP 2 때 **실제 HTTP** 로 수집한 facts 로 운영이 낸 값 | 109 |

🔴 **⒝ 를 「그때의 운영 판정」으로 적지 않았다**(CPO §5). 산출 JSON 에
`operationalVerdictAtTheTime` · `historicalVerdict` · `pastOperationalVerdict` 가 **0** 이다(계약).

---

## 1. ⒝ 재현 — 분모 **33**

```
verdict  PRESUMED_SAME 13 · SAME 7 · UNKNOWN 7 · SIMILAR 4 · CONFLICT 2
tier     EXCLUDED 15 · COMPARISON 11 · EXACT 7
사슬     cross-seller → compareModelCode → deriveMatchTruth → priceTierFromLink (그 순서 그대로)
```

### 🟢🟢 **재현이 충실한지 — 커밋된 기준선으로 교차검증했다**

```
`SAME05_BASELINE`(커밋 상수)  same 18 · different 9 · uncertain 6 · fp **1** · samePrecision **"6/18"**
이번 재현                     SAME 18 · DIFFERENT 9 · UNCERTAIN 6 · FP **1** · TP **6**
⟹ 🟢🟢 **한 자리도 다르지 않다**
```
🔴 이것을 **계약으로 잠갔다** — 재현이 기준선과 어긋나면 **FAIL** 하고, 그때는 STEP 5 를 진행하지 않는다.
🟢 즉 「내가 다시 돌린 값이 기존 기준선과 같은 것을 센다」가 **기계로** 확인됐다.

---

## 2. 🔴 재현 **불가** — **109 쌍**

```
사유   저장 `ProductFacts` 가 없다 — 상세설명 비교 코퍼스는 facts 를 보존하지 않았다
       (제목·설명문·`live*` 칸만 있고 `ProductFacts` 객체가 없다)
🟢 그 쌍에는 ⒞ **라이브 실행 기록** 이 있다 — 109 / 109
🔴 그중 `BASELINE_NOT_REPRODUCED` **17 쌍** 은 **그 실행에서도 재현되지 않았다**
⟹ 🔴🔴 **「140쌍의 기존 MI 를 재현했다」로 적을 수 없다.** 재현 분모는 **33** 이다.
```

🔴 facts 를 `live*` 칸으로 **되만들지 않았다** — 그것은 facts 를 지어내는 것이다.

---

## 3. 🔴🔴 가장 중요한 발견 — **세 출처가 서로를 «교차검증하지 못한다»**

```
⒜↔⒝ DB 저장 ↔ 재현        대조 가능 **0 / 33**
⒞↔⒝ 라이브 기록 ↔ 재현     대조 가능 **0 / 33**
```

원인은 **데이터가 두 섬으로 갈려 있다**(STEP 1 §2 와 같은 사실):
```
섬 A   `same05`(33) + `ceo-review`(11)      ← 재현 가능 · DB 행 0 · 라이브 기록 0
섬 B   `db`(38행) + `desc-compare`(109)      ← 재현 불가 · 라이브 기록만
교집합 **0**
```

🔴 **그래서 STEP 4 가 할 수 있는 말의 한계가 확정됐다**:
```
🟢 할 수 있다 — 「재현값이 커밋된 기준선과 일치한다」(§1)
🔴 할 수 없다 — 「재현값이 DB 저장 판정과 일치한다」(대조군이 **0** 이다)
🔴 할 수 없다 — 「재현값이 라이브 실행과 일치한다」(교집합 **0**)
```

---

## 4. 기준선 정확도 — 🔴 **GT 가 SAME/DIFFERENT 로 확정된 쌍만**

🔴 `UNCERTAIN` · `SIMILAR` · `UNDECIDED` 는 분모에서 **뺐다**(CPO §4). 🔴 `precision`/`recall`/`f1`
을 **산출에 쓰지 않았다**(계약) — 분모가 작고 STEP 5 와 같은 표에서 함께 적어야 한다.

| 기준 | 분모 | SAME | DIFFERENT | TP | FP | FN | TN |
|---|---:|---:|---:|---:|---:|---:|---:|
| **기존 GT** | **27** | 18 | 9 | **6** | **1** | **12** | 8 |
| **CEO 최신** | **10** | 3 | 7 | **2** | **2** | **1** | 5 |

```
🔴 기존 GT 기준 — **FN 12** 가 지배적이다(실제 SAME 18 중 12 를 SAME 으로 못 올렸다).
   ⟹ 기존 MI 의 성질은 「틀린 SAME」이 아니라 **「놓친 SAME」** 이다(FP 1).
🔴 CEO 최신 기준 — **FP 2**(C42 · S1-6) · FN 1(C27). 🟢 그 숫자는 CEO Evidence Review
   보고의 「FP 2 · FN 1」과 **정확히 같다** ⟹ 두 경로에서 재현됐다.
🔴 두 분모(27 ↔ 10)를 **섞지 않는다** — 쌍 집합이 다르다.
```

---

## 5. STEP 3 보완 — OBSERVED 동의어 **연결 전 / 후**(CPO 승인 조건)

| 축 | MATCH 전 | MATCH 후 | 증가 | MISMATCH 전 | MISMATCH 후 |
|---|---:|---:|---:|---:|---:|
| BRAND | 15 | 17 | **+2** | 1 | 1 |
| MODEL_CODE | 18 | 18 | 0 | 8 | 8 |
| PRODUCT_TYPE | 59 | 63 | **+4** | 2 | **9** |
| DESIGN | 37 | 37 | 0 | 49 | 49 |
| PRINT_PATTERN | 10 | 10 | 0 | 2 | 2 |
| COLOR | 54 | 61 | **+7** | 11 | **14** |
| MATERIAL | 52 | 57 | **+5** | 5 | 6 |
| SLEEVE_FORM | 0 | 1 | **+1** | 0 | **1** |
| FIT / AUDIENCE / SIZE_OPTION | 5 / 0 / 0 | 5 / 0 / 0 | 0 | 0 | 0 |

### 🟢 동의어가 **새로 만든 MATCH** (CPO 요구 집계)
`COLOR 7 · MATERIAL 5 · PRODUCT_TYPE 4 · BRAND 2 · SLEEVE_FORM 1` = **19**(축 중복 포함)

### 🔴 **동의어는 MISMATCH 도 늘렸다** — 숨기지 않는다
```
PRODUCT_TYPE 2 → **9** · COLOR 11 → **14** · MATERIAL 5 → 6 · SLEEVE_FORM 0 → **1**
🟢 이유는 「양쪽 추출」 분모가 늘어서다 — 한쪽만 있던 축이 양쪽에 생기면 비교가 성립하고,
   그 결과가 MATCH 일 수도 MISMATCH 일 수도 있다.
🔴 그러므로 「동의어를 넣으면 일치가 늘어난다」로만 적으면 **절반만 말한 것** 이다.
🟢 그리고 `SLEEVE_FORM` 충돌 1건이 바로 그렇게 **드러났다**(B226AC010 · long ↔ short).
```

### 🔴 **잘못된 통합 점검** — MISMATCH → MATCH 로 뒤집힌 축 **2 건**
```
· COLOR    · folkberlin.com         「grey」 로 일치 · 🟡 같은 축에 다른 값도 있다(옵션 가능)
· MATERIAL · designerkidswear.com   「nylon」 으로 일치 · 🟡 같은 축에 다른 값도 있다
🔴 **사람이 확인해야 한다** — 동의어가 «실제 충돌을 지웠는지» 는 CTO 가 단정하지 않았다.
🟢 두 건 모두 「같은 축에 다른 값도 있다」가 기록돼 있어 **옵션 다수** 일 가능성이 남아 있다.
```

🔴 CPO 조건 전수 준수 — `OBSERVED` 를 `REGISTRY` 와 **합치지 않았다** · 운영 alias 등록부
**변경 0** · 원문·출처·offset·문맥 **보존** · 전/후 결과 **별도 기록**.

---

## 6. 🔴 측정불가 · 한계

```
🔴 재현 분모 **33** — 140 이 아니다(109 는 facts 가 없다)
🔴 DB·라이브와의 교차검증 **불가**(대조군 0) ⟹ 「재현이 운영과 같다」로 적을 수 없다
🔴 CEO 최신 기준 분모 **10** · 기존 GT 기준 **27** — 둘 다 작다. precision/recall 을 적지 않았다
🔴 `BASELINE_NOT_REPRODUCED` **17 쌍** 은 라이브 실행에서도 재현되지 않았다(원인 미규명)
🔴 `SIZE_OPTION` 추출 규칙 **0** · `AUDIENCE` 양쪽 추출 **0**(STEP 3 과 같은 한계)
🔴 브랜드 편향 — Bobo Choses 계열 다수
🔴 동의어 「잘못된 통합」 2건은 **사람 확인 전** 이다
```

---

## 7. CPO 확인 요청 — **셋** (STEP 5 미착수)

```
① 🔴 **재현 분모 33 으로 STEP 5 를 진행할 것인가** — 109 쌍은 facts 가 없어 재현이 불가하고,
   그 쌍에서 「기존 MI ↔ 개선 MI」를 같은 조건으로 비교할 수 없다.
   🟡 선택지 — ⒜ 33 으로만 진행 ⒝ 109 쌍의 facts 를 **다시 수집**(🔴 네트워크 · 승인 필요)
   ⒞ 109 쌍은 「라이브 기록 ↔ 개선 Shadow」로만 비교(🔴 조건이 다르다는 것을 명시)
② 🔴 동의어 **잘못된 통합 후보 2건**(COLOR folkberlin · MATERIAL designerkidswear)을
   사람이 확인할 것인가 — CTO 가 판정하지 않았다
③ 🔴 기존 GT 기준의 **FN 12** — 「놓친 SAME」이 지배적이다. STEP 5 의 목표를
   **FN 축소** 로 둘 것인가(🔴 그러면 FP 가 같이 열릴 위험을 같은 표에서 재야 한다)
```

🔴 **STEP 5 는 착수하지 않았다**(CPO §7 「STEP 4 결과를 먼저 보고한 후 STEP 5 로 진행」).
