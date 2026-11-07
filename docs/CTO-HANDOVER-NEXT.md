# CTO 인수인계 — 다음 세션이 **이 파일 하나만** 읽는다

> 🔴 프로젝트 전체를 다시 조사하지 않는다. 좌표는 `docs/START-HERE.md` **§NEXT SESSION** 과 이 파일뿐이다.
> 기준 HEAD `a52f4994`(+ 이 세션 커밋) · 작업트리 clean · 운영 코드 **0** · DB **0** · GT **0**.

---

## 0-Y. 🔵🔵 **전략 기준선이 재정렬됐다 — 다음 한 수는 「국내 가격 매칭 정확도」다**

🔴 **좌표는 `docs/START-HERE.md` §0-STRATEGY 하나다**(CPO 확정 2026-11-07 · 우선순위 9 + 실행 순서 7).

```
🟢 실행 순서 **1 종료** — `a0b3c08` Smallable 현지통화는 **STOP(구현 0)** 으로 닫혔다.
   전문 `docs/PHASE2-SMALLABLE-LOCAL-CURRENCY-VERDICT.md`(10절). 🔴 **재조사 금지.**
   🔵 CPO 질문의 답 — **JP 조회는 JPY 가 아니다**(DB 62행 전건 EUR · 라이브 EUR 54)
   🔴🔴 그리고 **JPY 를 요청해도 그것은 사이트 자체 환산** 이다 —
      JPY/EUR 비율이 JP·KR·US 에서 **편차 0.006%**(단일 환율표가 격자 전부를 설명한다)
      ⟹ 저장하면 그 문서가 금지한 「환율로 현지 통화를 만들어 내기」와 **같은 산술**
   🟢 현지통화는 **다른 판매처에서 이미 작동한다**(louisemisha en-jp JPY 등 6통화)
   🔴 PHASE 1 의 「① market_country 채우기」는 **효과 0 · 의미 충돌** 로 정정(구현 0)
   🟢 계약 **10** + 변이 **M1~M3 전부 FAIL → 바이트 복구** · 운영 diff **0**

🔵 **다음 = 실행 순서 2 「국내 가격 매칭 정확도」**
   SAME / PRESUMED_SAME / SIMILAR / DIFFERENT 구분 + **가격비교 적격성** 검증.
   🔴🔴 **threshold 완화 금지**(CPO 명시). 🟢 기준선은 아래 §0-Z 를 그대로 쓴다.
```

---

## 0-Z. 🟢 **MI 재평가 STEP 6 — 종료 · CPO 판정 넷 대기**(실행 순서 2 의 기준선이다)

전문 [`docs/MI-REEVAL-STEP6-HOLD-AND-COLOR.md`](MI-REEVAL-STEP6-HOLD-AND-COLOR.md) ·
STEP 5 [`docs/MI-REEVAL-STEP5-SHADOW.md`](MI-REEVAL-STEP5-SHADOW.md). 🔴 **재조사 금지 · 운영 반영 0.**

```
🔴🔴 기존 MI 의 약점은 **「놓친 SAME」** 이다 — 거짓 SAME 이 아니다
   33쌍(확정 27) `TP 6 · FP 1 · FN 12 · TN 8` / 22쌍 `TP 5 · FP 1 · FN 12 · TN 4`
   FN 12 = PRESUMED_SAME 8 + SIMILAR 3 + CONFLICT 1
🔴🔴 **무조건 승격 = 과거 저하 조건 재현** (33쌍 FP 1→8 · 22쌍 FP 1→4 · 둘 다 FN 0)
   🟢 그 재현을 **계약으로 고정** 했다 — FP 가 안 늘면 테스트가 FAIL 한다
🟡 조건부(보류 + 품번 일치)는 **22쌍만** 통과(FP 1 · FN 12→9 · 승격 C11·C48·C19·C20·C37)
   🔴 C19·C20 이 Main Story 라 33쌍에서는 FP 3
🔴 V1 회수 7 = **상태 승격 3**(C11·C48·C37 · 근거 증가 0 · 전부 `BRAND_UNCONFIRMED`) +
   **신규 증거 4**(C27·C14·S1-1·S1-4 · 후보측 품번 공백을 원문에서 확인)
🟢 STEP 6-B — folkberlin COLOR 거짓 일치 제거(**선언된 색상 자리** 를 읽는 방식) ·
   A군 **0쌍 변경** · B군 3 (쌍,축) 전부 COLOR · 정당한 grey/blue 보존
🔴 단어 경계 결함(`embroidered`→red · `elastane`→tan)은 **적용하지 않았다**(A군 4쌍 변동)

CPO 판정 넷 — ① 보류 승격 운영 반영(🟡 권고: 신규 증거 4건 축만 따로 검증)
             ② 상태 승격 3건 허용 여부(🔴 WU-080 REJECT 축)
             ③ 단어 경계 결함 수정(🟡 권고: 고치는 쪽) ④ v2 를 기준으로 쓸 것인가
🔴 **CTO 는 넷 중 아무것도 고르지 않았다.** 승인 전 운영 변경 금지.
```

---

## 0. 🟡 [대기 · 위 판정 뒤] **CPO §5 「404 상태 분리·재분류」 조사 (미착수)**

```
🟢 Main Story 한정 제외는 **배포 완료** 다(`21d4a5fa` · Production 200) — 재구현 금지.
🔴 남은 것은 CPO §5 **조사만** 이다. 전역 404 필터 적용은 **승인되지 않았다**.

조사 항목(CPO 가 정한 순서 그대로)
  ① HTTP 404 · 410(명확한 미존재)을 403 · timeout · 연결 실패와 **분리**할 방안
     🔴 지금은 `factsFromProductUrl` 이 `!response.ok` 를 **전부 `UNREACHABLE`** 로 뭉갠다
        (WU-105 실측: `skroutz.ro` 는 **403** 인데 UNREACHABLE 이다)
     🔴 상태코드를 **보존하지 않는다** ⟹ `ProductUrlFactsResult` 계약 변경이 선행이다
  ② 기존 `UNREACHABLE` **15건** 재분류(WU-076 분모 N=90: OK 66 · UNREACHABLE 15 ·
     REDIRECTED_AWAY 8 · NO_FACTS 1) — 🔴 상태코드가 없어 **재프로브가 필요**하다
  ③ 정상 상품 **오제외율** 측정  ④ 검색 경로별 검사 비용·누락 위험
  ⑤ 결과를 **CPO 에 다시 보고** 하고 전역 적용 여부를 받는다

🔴 생산자별 현황(실측 · 다시 조사하지 않는다)
  🟢 404 이미 제외 + 사유 기록 — `url-candidate-pool`(factsFromProductUrl 4회) · `ai-answer-pool`
  🔴 reachability 검사 **없음** — `overseas-auto-pool` · `web-search-pool` ·
     `domestic-listing-pool` · 등록부 검색(`comparison-search/index.ts`)
  🔴 넣으면 **후보당 HTTP +1** 이다(WU-088/089 가 측정한 비용 축)
🟢 「접근 불가를 DIFFERENT 로 처리하지 않는다」는 **현재도 충족** 이다(drop 이고 verdict 가 아니다)
```

---

## 0-A. 🟡 [대기] **CEO 화면 1회**: `docs/ceo-evidence-review.html`

```
11쌍을 SAME / SIMILAR / DIFFERENT / UNDECIDED 로 판단 → **JSON 내보내기** 로 전달.
🟢 필드 전수 목록      docs/CEO-EVIDENCE-REVIEW-FIELDS.md (canonicalProduct 42 · ProductFacts 17 · DB 19)
🟢 생성기             ceo-evidence-review-build.test.ts (`CEO_EVIDENCE_REVIEW=1` · **네트워크 0**)
🟢 DB 덤프(선행)       packages/database/scripts/ceo-evidence-review-dump.mjs (읽기 전용)
🔴 **대상은 11쌍** 이다 — 지시서의 「6쌍」을 정정했다(원본 6 = S1~S6 에 후보 11)
🔴🔴 **`docs/core-desc-evidence-review.html` 을 덮어쓰지 않는다** — 후보 상세설명의
   **유일한 저장 출처** 다. fixture 의 `facts.description`·`facts.evidence` 는 **0/11** 이다
🔴 그래서 **추가 크롤링 0** 으로 설명문을 보여줄 수 있었다(그 산출물에서 읽는다)
실측 — 원본 설명문 11/11 · 후보 10/11 · 원본 이미지 11/11 · 후보 9/11 ·
       candidate_reviews 2/11(verdict 1) · 운영 판정 재현 11/11
```

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
