# [MI-P0-02] Gemini Discovery Whitelist + Price Coverage — 착수점

> 🔴 **새 세션은 이 문서의 CURRENT POINTER → NEXT EXACT ACTION 을 읽고 즉시 실행한다.**
> 「어디부터 할까요」·「이대로 진행할까요」·「다음 단계로 갈까요」를 묻지 않는다.
> CPO 가 범위를 이미 결정했다. 중간 보고도 하지 않는다(§완료 보고 형식 하나만).

---

## CURRENT POINTER

```
SPRINT              MI-P0-02
HEAD                (이 문서 커밋 기준 — git log -1 로 확인)
WORK                Gemini Discovery 에 «가격 owner 가 있는 판매처» whitelist 주입
DONE                COMMERCE CLOSE (bd81b064)
                    price adapter registry 10개 확정 (d1beb8d4)
                    Discovery 정책 (가)/(나) CPO 판정 수령
                    2단계 측정 규칙 고정 (0f448c2f)
NOT DONE            STEP A~I 전부 (whitelist 주입 · fresh Discovery · adapter 가격 ·
                    Identity · Verified Price · 국내 가격 매칭 KPI)
NEXT EXACT ACTION   STEP A — PRICE_SOURCE_ADAPTERS 배열을 «소스에서» 다시 읽어
                    10개·도메인·domestic/overseas·중복·동적등록을 확인하고,
                    그 10개를 Discovery query whitelist 로 주입한다(STEP B).
DO NOT REUSE        🔴 scratchpad/mi-p0-candidates.json — whitelist «적용 전» 결과다.
                    Recall/가격 KPI 에 쓰지 않는다(historical evidence only).
                    새 결과는 scratchpad/mi-p0-whitelist-candidates.json 로 저장.
OWNER VERIFIED      아래 §Owner Mapping (이번까지 실측 확정분)
TEST STATUS         회귀 497 files / 7461 passed · typecheck listing 5 = baseline ·
                    admin 0 · crawler 2 · build PASS
DEPLOY              da4bc32 (코드 변경 3건 전부 반영) · 이후 커밋은 문서
CEO ACTION          없음
STOP CONDITION      외부 서비스 장애 · 인증/권한으로 실행 불가 ·
                    destructive production action · CEO 사업/정책 결정 필요
                    🔴 단순 코드 문제·테스트 실패·schema 불일치는 STOP «아니다» —
                       owner 확인 → 수정 → 테스트 → 회귀까지 같은 Sprint 에서 계속한다
ACTUAL REGISTRATION 🔴 STOP (CPO GO 전까지)
```

---

## 0. 목적

병목은 Commerce 가 아니라 **MI 정확도** 다. 현재 확인된 문제는 **「국내 가격 수집
불능」이 아니다** — 정확히는:

> **Discovery Recall ↔ Price Adapter Coverage 불일치.**
> Gemini 가 «가격 owner 가 있는 판매처» 를 충분히 발견하지 못한다.

목표:

```
Original → Gemini(whitelist) → supported seller 후보 → resolveCandidate
→ Light Fetch → Price Adapter → 실제 가격 → Identity → SAME → Verified Price
```

🔴 이번 Sprint 의 1차 목표는 **adapter 를 새로 만드는 것이 아니다.** 이미 owner 가
있는 10곳을 Gemini 가 실제로 발견하게 만드는 것이다.

---

## 1. Price Adapter Registry — 확정 (STEP A 에서 재확인)

`packages/crawler/src/comparison-search/price-source-adapter.ts`
`PRICE_SOURCE_ADAPTERS` (:356-460)

```
해외 3   childrensalon.com · rakuten.co.jp · bobochoses.com(브랜드 공식몰)
국내 7   looxloo.com · rulii.co.kr · skysport.co.kr · deuxbebe.com ·
         littleluna.co.kr · chocoel.co.kr · foretforet.com
합계 10  (.co.kr 은 그중 4곳)
🟢 배열 안 shopifySuggestAdapter() 호출 0건 — 동적 추가 없음
```

### 🔴 절대 금지 — 이 방식으로 다시 세지 않는다

```bash
grep -c "domain:"      # ❌ 타입 선언(:154)·함수 인자(:338·:464)가 섞여 13 이 나온다
```

실제로 그렇게 세서 「11개」로 보고했다가 CPO 가 잡았다. **owner 는 문자열이 아니라
등록 «배열» 이다.** 배열을 읽는다.

---

## 2. 고정된 Discovery 정책

```
Gemini = Recall          우리 MI = Precision / Truth
Gemini 결과 = SEARCH_CANDIDATE    🔴 SAME 으로 취급하지 않는다
```

### 가격 단계

```
Discovery Candidate → URL Resolve → Light Fetch → Price Adapter
→ VERIFIED_SOURCE_PRICE → Identity SAME → MI_PRICE
```

🔴 `DISCOVERY_PRICE` 계층은 **제거됐다**(CPO 판정 (가)). 실측에서 Gemini 는
`snippet`·`priceHint` 를 **전건 null** 로 주고 `title` 은 상품명이 아니라 «도메인»
이다. **별도 Gemini 가격 호출을 추가하지 않는다.**

### Marketplace 정책 — (나)

```
KREAM · MUSTIT · SSG · GSSHOP · TRENBE 등
→ 가격 수집 대상으로 «확장하지 않는다» (약관 · no-portal-scraping.test.ts 로 잠김)
→ title · brand · identifier · image 만 Identity evidence 로 쓴다(가격 없음)
🔴 약관/정책 변경도 하지 않는다
```

---

## 3. 🔴🔴 2단계 측정 규칙 (이 프로젝트 최상위 운영 규칙)

```
① 측정값 정의 → ② 운영 Path 확인 → ③ 🔴 그 값의 owner 함수/adapter/resolver 확인
→ ④ 실제 signature/schema 확인 → ⑤ owner 에서 측정
→ ⑥ null/missing/default 의 «의미» 확인 → ⑦ defect 판단 → ⑧ KPI 반영
```

### 금지

```
❌ grep 숫자 → 추정 → KPI
❌ 필드 이름 추측 → 「값 없음」 → defect 판정
❌ 같은 함수에서 expected 생성 → 같은 함수 결과와 비교 → PASS (순환)
```

🔴 이 규칙을 세운 «직후» 에도 내가 registry 개수를 grep 으로 세서 틀렸다.
**규칙을 아는 것과 지키는 것은 다르다.** 숫자를 적기 전에 owner 를 먼저 연다.

### Owner Mapping (실측 확정분)

```
Gemini Discovery     discover(identity, query)        ← 인자 «둘»
grounding 후보        resolveCandidate() 통과 «후» 판단 (vertexaisearch 리다이렉트다)
candidate brand/model candidate.facts.brandModelCode
site article code     candidate.sku
가격                  price-source-adapter registry    ← factsFromProductUrl «아님»
LotteON 재고          itmLst[].stkQty
```

🔴 `factsFromProductUrl` 의 `price: null` 은 **결함이 아니다** — 그 파일 주석이
「통화를 모르므로 가격을 만들지 않는다」·「사이트별 상세 파서는 어댑터의 일이다」
라고 적어 뒀다. 담당하지 않는 함수의 null 을 결함으로 판정하지 않는다.

### 로컬 실행 함정 (전부 실측으로 걸린 것)

```
🔴 @commerce/crawler 배럴에 discovery-benchmark 가 «없다» → 깊은 import
🔴 GEMINI_API_KEY 는 scripts/.env — vitest 가 «자동 로드하지 않는다»(하니스가 직접 읽는다)
🔴 pnpm --filter @commerce/crawler test → test 스크립트가 없어 exit 0 · 출력 0줄
   → 반드시 cd apps/admin && npx vitest run <path> (그 config 가 전 패키지를 포함한다)
🔴 tsx + page.evaluate → __name is not defined (esbuild keepNames) → vitest 로 돌린다
🔴 변이(mutation) needle 에 줄끝을 넣지 않는다 — CRLF 라 매치가 안 되고 SKIP 된다.
   SKIP 을 「가드가 살아 있다」로 읽으면 음성 대조가 위증이 된다
```

---

## 4. STEP A~I (한 묶음 — 중간 보고 없음)

```
A  registry 재확인 — 10개·도메인·domestic/overseas·중복·동적등록
B  Discovery query builder 에 whitelist 주입
   🔴 단순 문자열 append 가 아니라 현재 Discovery architecture 에 맞는 방식으로.
      기존 grounding semantics 를 깨지 않는지 실제 구현을 확인한다
C  실제 Gemini 재검색 (캐시 사용 금지) — Golden: Bobo · Junior Edition · Smallable
   + false-positive / false-negative 후보 포함
   기록: query · candidate count · domain · URL · rank · resolve status
D  resolveCandidate — PRODUCT_PAGE / LISTING_PAGE / UNKNOWN_PAGE 를 그대로 기록
   🔴 UNKNOWN_PAGE 를 억지로 PRODUCT_PAGE 로 승격하지 않는다
E  Light Fetch — title·brand·identifier/model·image·material·color·category·
   price owner 가용성. 🔴 각 필드는 실제 schema/owner 확인 후 측정
F  🔴 핵심 — Price Adapter 실제 가격 측정. 다섯을 «갈라» 적는다:
     adapter 없음 / adapter 있음+parser 실패 / adapter 있음+가격 없음 /
     가격 있음+currency 없음 / 가격 정상
   → 하나의 price=0 으로 뭉개지 않는다
G  Identity — 식별자 > 이미지·속성 > 제목 유사도
     같은 브랜드 + 제목 95% 유사 + 다른 model code = NO_MATCH
     같은 실제 model/reference + 제목 표기 차이 = SAME 가능
   🔴 SIMILAR ≠ SAME · INSUFFICIENT_EVIDENCE ≠ NO_MATCH
H  Verified Price — candidate + 실제 URL + Light Fetch + adapter + valid price
   + Identity SAME 이 «전부» 충족될 때만. 그 뒤 MI_PRICE
I  KPI — Discovery / Price Coverage / Identity + 핵심 KPI:
     Domestic Same-Product Price Match Rate
       = (SAME 후보 중 VERIFIED_SOURCE_PRICE 확보 건수) / (SAME 후보 건수)
     🔴 분모·분자의 실제 데이터 정의를 명시한다
```

### MI 최종 상태

```
AUTO_GO · REVIEW · NO_GO · INSUFFICIENT
🔴 가격을 못 찾았다고 자동 NO_GO 하지 않는다 —
   「국내 동일상품 evidence 없음」은 INSUFFICIENT 또는 REVIEW 다.
   No price → 낮은 가격 추정 → NO_GO 는 «금지».
```

### 테스트

```
targeted → 🔴 negative/mutation(가드를 일부러 깨고 FAIL 확인 → 복구) →
regression → typecheck(baseline 과 «비교») → build
🔴 Identity 에서는 「SIMILAR → SAME」 오판 방지 테스트를 «우선» 한다
```

---

## 5. 완료 보고 형식 (이것 하나만 올린다)

```
[MI-P0-02 COMPLETE]
1 Registry            2 Discovery(whitelist·candidate·supported·resolve rate)
3 Price(adapter match·price success·currency success)
4 Identity(SAME/SIMILAR/NO_MATCH/INSUFFICIENT)
5 Domestic Same-Product Price Match (분자/분모/%)
6 False Positive      7 False Negative
8 Tests(targeted·negative·regression·typecheck·build)
9 Deploy(commit·smoke)  10 CPO 판단(PASS/PARTIAL/BLOCKED)
11 NEXT EXACT ACTION (한 가지)      CEO ACTION 없음
```

---

## 6. 성공 기준

```
Discovery Recall ↑  +  Price Adapter Coverage ↑  +  Identity Precision 유지
+  Verified Price 확보  +  Human Review Rate ↓
```

🔴 **Recall 을 높이려고 Identity threshold 를 낮추지 않는다.**
🔴 **SIMILAR 를 SAME 으로 희생해 KPI 를 올리지 않는다.**

---

## 7. 세션 안정성 (프로젝트 운영 규칙)

```
Long Sprint = 재개 가능한 «독립» 작업 단위. 세션이 끊겨도 손실되지 않는다.
Sprint START → implementation → CHECKPOINT COMMIT → long test → fix →
FINAL COMMIT → handoff(이 문서의 CURRENT POINTER 갱신)
🔴 불필요한 commit 남발은 하지 않는다. 의미 있는 코드 상태에서만 체크포인트.
🔴 Sprint 종료마다 이 문서 맨 위 CURRENT POINTER 를 갱신한다 — 그것이 재개점이다.
```

관련 메모리: `measure-with-the-production-function`(2단계 규칙) ·
`guard-predates-the-new-path` · `local-toolchain-silent-noops` ·
`gemini-discovery-is-unblocked-and-returns-url-only` ·
`portal-scraping-blocked-by-terms` · `domestic-discovery-dies-at-low-not-at-search` ·
`brand-code-extraction-already-works`
