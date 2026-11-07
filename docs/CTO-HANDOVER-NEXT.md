# CTO 인수인계 — 다음 세션이 **이 파일 하나만** 읽는다

> 🔴 프로젝트 전체를 다시 조사하지 않는다. 좌표는 `docs/START-HERE.md` **§NEXT SESSION** 과 이 파일뿐이다.
> 기준 HEAD `24847b93`(+ 이 세션 커밋) · 작업트리 clean · 운영 코드 **0** · DB **0** · GT **0**.

---

## 0. 🔴🔴🔴 상세설명 비교 트랙은 **끝났다** — 다음 한 수는 **코드가 아니다**

전문 [`docs/MI-DESC-COMPARE-REPORT.md`](MI-DESC-COMPARE-REPORT.md)(10절) ·
쌍별 표 [`docs/MI-DESC-COMPARE-PAIRS.md`](MI-DESC-COMPARE-PAIRS.md)(109쌍 전수). 🔴 **재조사 금지.**

```
🔴🔴 **레버는 「상세설명 수집」이 아니다** —
   원문이 «운영이 모르던» 정보를 준 것은 **3건 / 82쌍**(BRAND 2 · MODEL_CODE 1)이고
   그중 설명문 출처는 **2건** 이며 **둘 다 독일어 · 둘 다 「귀속 문구 없는 약한 근거」** 다.
   세 번째는 **URL** 이지 설명문이 아니다.

🟢🟢 **진짜 병목은 「기존 증거의 사용 방식」이다**(실측 6/6) —
   「최초 PRESUMED_SAME → 품번 일치로 강한 동일」 6건 **전부** `운영 품번 보유 = true` 인데
   보조 축 blocker 로 막혔다:
     B226AC009 junioredition  FIT + BRAND_UNCONFIRMED
     B226AC009 miniboutique   NO_TITLE_OVERLAP
     B226AC033 junioredition  MATERIAL
     B226AC038 junioredition  MATERIAL
     B226AC073 junioredition  COLOR_VARIANT
     WK21A165  junioredition  MATERIAL
   ⟹ 🔴 CPO 규칙 「**핵심 식별정보는 보조 차이로 덮지 않는다**」가 **코드에서 안 지켜지는 자리** 다.
   🟢 메모 `blockers-fired-with-evidence-in-hand` 의 재현이다.
```

### 🔴 CPO 판정 셋 (CTO 가 하나도 고르지 않았다)

```
① **우선순위 1번을 열 것인가** — 핵심 식별(품번) 일치 시 보조 축 blocker 가중치
   🔴 **matcher 변경** 이라 이번 범위에서 금지였다. 근거는 위 6/6 실측이다.
② **품번 충돌 안내 등급** — 안 A(다른 상품) ↔ 안 B(브랜드·형태 같으면 **유사상품**)
   GT 1건(B226AC110 ↔ B226AC111 · human **SIMILAR**)이 안 B 를 지지 · 전체 차이 **3쌍** · 🔴 N=1
   안 A: 일치 3 · 역방향 1 · 보류 8    안 B: 일치 4 · 역방향 **0** · 보류 8   (분모 12 · 오포함 0 · 누락 0)
③ **표본 확대** — GT 분모가 **12** 다. 「정확도 개선」을 수치로 말하려면 GT 가 더 필요하다
   🔴 단 GT 신규 판정은 직전 지시로 **보류** 상태다
```

---

## 1. 확정 숫자 — 🔴 **분모를 섞지 않는다**

```
행 **190** · 고유 후보 URL **95** · 고유 원상품 URL **27** · 고유 (원상품,후보) 쌍 **109**
  ├ 원상품 설명문 미확보 17 · 후보 설명문 미확보 11
  └ 🟢 **비교가능 82**
GT 보유 쌍 36(전체) / 16(비교가능) / 🔴 **12**(최초 판정 재현 — GT 평가 분모)
최초 판정(82)  PRESUMED_SAME 69 · SAME 7 · CONFLICT 2 · BASELINE_NOT_REPRODUCED 4
변화(82)       개선 가능 **12** · 판단 유지 **14** · 판단 불가 **56** · 🟢 최초 오판 **0**
축 MATCH/MISMATCH/UNKNOWN —
  BRAND 24/**0**/58 · MODEL_CODE 15/4/63 · NAME 25/34/23 · FORM 57/2/23 · COLOR 50/7/25 ·
  MATERIAL 17/3/62 · AUDIENCE 0/0/**82** · SIZE 15/0/67 · SET 0/3/(N/A 79) · IMAGE 0/0/**82**(PROBE)
신규 발견      BRAND **2** · MODEL_CODE **1**   /  운영이 이미 보유 MODEL_CODE 25 · BRAND 3
               🔴 신규 여부 **미확인** FORM 57 · NAME 25 · MATERIAL 17(운영 보유 신호가 없는 축)
안전           GT 12 에서 **오포함 0 · 누락 0** · 최초 SAME 7 중 상세설명 반증 **0**
```

🟢 산출 — `%TEMP%/mi-url-evidence/desc-compare.json` · `.csv`(축별 사유·출처·원문 발췌 전건).
스크립트 `mi-desc-compare.mjs` · `mi-desc-compare-table.mjs`(**둘 다 읽기 전용**).

---

## 2. 🔴 다음 사람이 반복하면 안 되는 함정 — 이번에 내가 밟은 것

```
⒜ 🔴🔴 `candidate_reviews` / 조사 산출의 `codeBefore`·`codeAfter`·`brandBefore`·`nameBefore` 는
   **값이 아니라 «상태»** 다(`MATCH`/`MISMATCH`/`UNKNOWN`/`NOT_AVAILABLE`).
   품번 자리에 넣으면 「서로 다른 품번(B226AC009 ↔ **UNKNOWN**)」이라는 **거짓 불일치 50건** 이 난다.
   🟢 실제 품번 충돌은 **4건** 이다.
⒝ 🔴🔴 `BRAND UNKNOWN` 을 차단 조건으로 쓰면 **원칙 ⒝ 위반** 이다(「UNKNOWN 은 MISMATCH 가 아니다」).
   원상품 브랜드가 공백인데 품번이 정확히 일치하는 쌍을 `UNDECIDABLE` 로 떨어뜨렸고
   **그 안에 human GT SAME 이 있었다**.
⒞ 🔴 설명문이 한쪽이라도 없으면 **결론을 적지 않는다** — 축은 `∅` 인데 라벨이 붙어 표가 모순됐다.
⒟ 🔴 **운영이 그 축을 갖고 있었는지 아는 축은 둘뿐** 이다(`evidenceBrandSources`·`evidenceCodeSources`).
   나머지 축을 「신규」로 세면 안 된다(그래서 MATERIAL 17 을 신규에서 뺐다).
⒠ 🔴 `canonicalProduct` 의 **모든 칸이 `{value,source,confidence}`** 다 — `->>'description'` 은
   빈 value 도 길이>0 이다. 안쪽 `->'description'->>'value'` 로 읽는다.
⒡ 🔴 품번 비교는 **«가족 서명»** 으로 좁힌다(`L1D3L2D3` ↔ `L2D2L6D6`) — 안 그러면 판매처 자체
   코드가 제조사 품번 불일치로 센다. 그리고 **접두 1자 생략형**(`#226AC036`)을 같이 봐야 한다.
```

---

## 3. 끝난 트랙 — **재실행 금지**

```
STEP 1     Contract P2 보호 계약 **21건**(`contract-p2-evidence-isolation.test.ts`)
STEP 2     beaumonde 원문 확인 · 2.5 재분류 **62건**(BRAND 추출 누락 62/62 확정)
STEP 3A/R/M shadow 전수 · 게이트 둘 수정(조사 10/10) · 수동 판독 **12건**
STEP 3A-GT GT 확대 대상 **21 조합** 확정 · 조건 ②③⑦ 충돌 보고(`docs/MI-BRAND-STEP3AGT-GT-TARGETS.md`)
DESC-COMPARE 상세설명 비교 **109쌍 / 비교가능 82** · 최초 판단 대비 변화 측정 · 보고서 제출
```

🔴 **보류 유지** — STEP 3B(독일어 귀속 · 상점 큐레이션 ↔ 상품 귀속 · 판매처명 게이트) ·
GT 신규 판정 · 추출기 구현.

---

## 4. 🔴 절대 바꾸지 않는 보호 조건 (전수 준수 확인됨)

```
Contract P2 유지 · `facts.brand` 자동 승격 금지 · matcher/Identity 변경 금지 ·
SAME/SIMILAR/UNKNOWN/CONFLICT 기준 불변 · 가격을 동일성 증거로 쓰지 않음 ·
alias 확대 금지 · 기존 GT 수정 금지 · 추출기/운영 코드 변경 금지 · DB schema/UI 변경 금지
🟢 그래서 이 트랙의 산출 어휘는 전부 `SHADOW_` 접두다 — 운영 verdict 와 섞이지 않는다
```

---

## 5. 측정불가 — 0 으로 적지 않는다

```
🔴 GT 없는 **70쌍** 은 TP/FP 로 계산하지 않았다
🔴 `IMAGE` 축 **82/82 PROBE** — 내용 비교는 사람만 가능하다
🔴 `AUDIENCE` 축은 상세설명으로 보강되지 않는다 — 운영은 **다른 입력**으로 31건을 막았다
🔴 `BASELINE_NOT_REPRODUCED` **4쌍** 은 GT 가 있어도 대조가 성립하지 않는다
🔴 원상품 `sku` **5/27** · 브랜드 편향(Bobo Choses 계열 다수) · 국내 후보 소수
🔴 `BRAND_MISMATCH` **53건** 과 이 비교의 BRAND `MISMATCH` **0** 이 어긋난다 —
   같은 말이 다른 것을 가리킨다(🔴 조사 선행 과제 · 보고서 §5-6 의 3번)
```
