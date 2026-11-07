# CTO 인수인계 — 다음 세션이 **이 파일 하나만** 읽는다

> 🔴 프로젝트 전체를 다시 조사하지 않는다. 좌표는 `docs/START-HERE.md` **§NEXT SESSION** 과 이 파일뿐이다.
> 기준 HEAD `31a965d9`(+ 이 세션 커밋) · 작업트리 clean · 운영 코드 변경 **0** · DB **0** · GT **0**.

---

## 0. 🔴🔴🔴 다음 한 수는 **코드가 아니다** — CPO 판정 셋이 막고 있다

전문 `docs/MI-BRAND-STEP3AGT-GT-TARGETS.md`(9절). 🔴 **재조사 금지.**

```
① 조건 ⑦ 해석        GT 확대 대상 **21 조합이 전부 기존 행** 이다(human_verdict 만 null)
                     해석 A = 기존 **GT 값** 만 보호  ⟹ 21 조합 판정 가능(079 설계 경로)
                     해석 B = 기존 **행** UPDATE 금지 ⟹ **대상 0건** · 새 저장 자리 필요(migration · 미승인)
② 조건 ③ 충족 방법    🔴 기존 화면이 시스템 판정을 **판정 버튼과 같은 카드에** 렌더한다
                     ⒜ 자립 검토 화면 신설(운영 UI 변경 0) ↔ ⒝ 운영 UI 가림(미승인 · 계약 FAIL)
③ GT 분모            「같은 판매처 다른 리스팅」 **7/21** 을 넣는가 · 층화(cap1 8 · cap2 12) 적용 여부
```

🔴 **CTO 가 셋 중 하나도 고르지 않았다.** ①②가 정해지면 CTO 몫은 **대상 제시 + 저장 확인** 이고
판정 자체는 **CEO** 가 한다.

---

## 1. 확정 숫자 — 다시 재지 않는다

```
판정 «단위»            **21 조합**   🔴 58 «행» 이 아니다
  행 58 → 고유 후보 URL **19** → 고유 (원상품URL, 후보URL) 조합 **22** → 기존 GT 1 제외 = **21**
  🔴 원인 — 같은 원상품 반복 스냅샷(원상품 제목 17개 · 「Hug Hairy Monster T-shirt」가 **38행**)
신규 GT 완료 **0** · 미완료 **21** · 기존 GT 변경/UPDATE **0**
기준선                 `candidate_reviews` 행 **190** · GT 행 **38** · GT 조합 **19**
분포(21)               Bobo Choses 12 · Wynken 4 · Bonjour 3 · Main Story 2 /
                       junioredition 17 · nickis 2 · miniboutique 1 · tiptoeboutique 1
설명문 보유             **21/21** 🟢 (사람이 읽을 원문이 전건 있다)
판매처명 브랜드 자리     넓은 기준 **4**(전부 「원문 맨 앞」 · tinyapple 3 · 미니부띠끄 1) ·
                       🔴 게이트 **발화 0** ⟹ 안전성 **미입증 유지**(분모 190 으로 넓혀도 0)
🔴 소요시간은 적지 않는다 — 단위가 58→21 로 바뀌어 「30~60분」은 무효다
```

🟢 산출 — `%TEMP%/mi-url-evidence/step3agt-targets.json`·`.csv` ·
`step3agt-sellername.json`. 스크립트 `mi-brand-step3agt-targets.mjs` ·
`mi-brand-step3agt-sellername.mjs`(**둘 다 읽기 전용**).
🔴 그 JSON 의 `_hidden_*` 칸은 **판정자에게 가릴 값** 이다(조건 ③).

---

## 2. 끝난 STEP — **재실행 금지**

```
STEP 1    Contract P2 보호 계약 **21건** (`contract-p2-evidence-isolation.test.ts`) ·
          변이 3종 FAIL → 복구 · 🔴 선언부에 `(` 를 붙여야 rename 변이를 잡는다(M2 가 찾았다)
STEP 2    beaumonde 원문 확인 — 「보보쇼즈」는 **TITLE** 에 있고 설명문엔 없다
STEP 2.5  62건 A~F 재분류 — 실제 BRAND 추출 누락 **62/62** 확정(CPO 가 자기 가설을 철회했다)
STEP 3    설계안 7항 제출(`docs/MI-BRAND-EVIDENCE-DESIGN-STEP3.md`) · 구현 **0**
STEP 3A   shadow 전수 62 · 역방향 대조 · Contract P2 유지 확인
STEP 3A-R 게이트 둘 수정 — 라벨 보호 · 한국어 조사 경계 **10/10** · 판매처명 게이트 `allowLead:false`
STEP 3A-M 수동 판독 **12건** — ATTRIBUTED **9/9** 타당 · 과소추출 **1** · miniboutique 포함
STEP 3A-GT 대상·분포·경로 검증(이 세션) — 🔴 조건 ②③⑦ 충돌 보고
```

🔴 **STEP 3B 는 보류 유지** — 독일어 지시사 귀속 2건 · 상점 큐레이션 ↔ 상품 귀속 구분 ·
판매처명 게이트 필요성/안전성 · `ATTRIBUTED` 를 실제 추출기에 넣을지. **전부 CPO 미승인.**

---

## 3. 🔴 절대 바꾸지 않는 원칙 6 (CPO 확정 · 유지)

```
⒜ 브랜드 증거와 동일상품 판정은 **별개** 다
⒝ **`UNKNOWN` 은 `MISMATCH` 가 아니다**
⒞ **판매처명은 제조사 브랜드 증거가 아니다**
⒟ 다국어 alias 를 **승인 없이 판정에 연결하지 않는다**(현 등록부 한국어 alias **4개** 그대로)
⒠ 신규 evidence 가 기존 SAME/SIMILAR 결과를 **바꾸지 않는다**
⒡ 기존 **GT·운영 판정 수정 0**
```

🔴 **미승인** — 운영 추출기 · `product-evidence.ts` · `facts.brand` 연결 · matcher · Identity ·
BRAND 정책/임계값 · alias 확대 · GT/DB/schema/UI 변경 · 외부 URL 재방문 · 독일어 문법 규칙.

---

## 4. 측정불가 — 0 으로 적지 않는다

```
🔴 21 조합의 **GT 정확도 효과 측정불가**(판정 0건)
🔴 판매처명 게이트 **발화 0** ⟹ 안전성 미입증(분모 190)
🔴 브랜드 편향 **57%**(Bobo Choses 12/21)
🔴 7/21 이 **같은 판매처 다른 리스팅** ⟹ 한 분모로 쓸 수 없다
🔴 코퍼스가 관측 중 늘어난다 — 행 **183 → 190**(분모를 고정 인용하지 않는다)
🔴 국내 축 분모 없음 — `market='KR'` 행 **1**(국내 P0 정확도 여전히 측정불가)
```

---

## 5. 이 세션에서 내가 틀린 것 둘 (다음 사람이 반복하지 않도록)

```
🔴 ⒜ `originCode` 를 **URL 로만 조인** 해 58행이 서로 다른 원상품처럼 찍혔다
   🟢 `step25-brand-reclassify.json`(originCode 보유)과 **행 정렬 검증** 후 쓰고,
      최종 단위는 **DB 의 (원상품 source_url, 후보 URL)** 로 직접 조인했다
   🔴 그대로 보고했으면 **3배 과대 분모**(58)가 올라갔다
🔴 ⒝ `candidate_reviews.system_tier` 라는 **없는 칸** 을 읽었다(42703)
   🟢 `information_schema` 로 읽어 `price_tier`·`match_truth` 로 고쳤다 — 이 트랙 **15번째** 같은 실수
```
