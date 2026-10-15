# WU-022 — AI Search → Identity **다리** 구현 · 데이터 대기 (하니스만 · 운영 0)

🔴 운영 코드 **0** · MI 0 · threshold 0 · 색상사전 0 · `PRESUMED_SAME` 정책 0 ·
Registry 0 · Shopify Suggest 0 · Category/Sourcing 0 · schema 0 · DB 0 · UI 0 ·
AI API 0 · Gemini 0 · 키 0 · 결제 **₩0** · Playwright 0 · Extension 0 · 배포 0.
🟢 산출물 — **테스트 1 · 문서 2**. `git diff --stat` 로 **수정된 추적 파일 0** 확인.

---

## 1. 🔴🔴 먼저 — **이음새가 «없었다»**(내 직전 보고를 정정한다)

WU-020·021 에서 나는 「①~⑪ 하니스가 이미 전부 있다」고 적었다. 🔴 **그 표현이 과했다.**
전수로 열어 보니 하니스가 **둘로 갈라져 있고 사이가 비어 있었다**:

```
① mi-019a-search-ingest.test.ts
     rawAnswer → 후보 URL → **Discovery 집계까지**
     🔴 후보 페이지를 열지 않는다 · MI 를 부르지 않는다 · GT 가 없다
② mi-019a-ai-vs-mi-benchmark.test.ts (+ mi-019a-ext-multi-ai.test.ts)
     **고정된 14 쌍**(`CASES`)만 fetch → MI → GT → KPI
     🔴 `caseId` 가 미리 있어야 하고 `GT_OF[productType]` 로 GT 가 **미리 적혀** 있어야 한다
     🔴 AI verdict 파일도 **caseId 로** join 된다

→ 🔴🔴 AI 가 «새로» 찾아온 URL 은 caseId 도 productType 도 GT 도 없어서 ②에 **들어갈 수 없다.**
   즉 WU-022 가 요구한 사슬(AI 후보 → 페이지 검증 → MI → GT → KPI)은
   **그대로는 돌지 않았다.**
```

🟢 **그 구간을 이번에 이었다** — `mi-022-ai-search-identity.test.ts`.

---

## 2. 다리의 설계 — 🔴 새로 만든 것을 최소로 했다

```
재사용(그대로)  SEARCH_TARGETS · validateSearchFile · discoveryRowsOf   ← ①의 export
                normalizeMi · normalizeAiVerdict · Gt · ThreeWay        ← ②의 fixtures
                factsFromProductUrl · withConfidence ·
                buildProductIdentityDna · productFactsFromIdentityDna   ← **운영 owner**
🔴 MI 호출 순서를 **추측하지 않고 ②에서 베꼈다**(query 조립 → ok 필터 → withConfidence → byUrl).
신규(이 파일에만)  GT 파일 규격 + 검증기 · gtToken 대조 · axisKpi · quadrantOf
🔴 새 검색엔진 0 · 새 URL 파서 0 · 새 Identity 0 · 새 threshold 0.
```

### 🔴🔴 GT 오염을 «구조로» 막았다

```
GtEntry = { searchId, candidateUrl, gt, gtReason, gtToken? }
🔴 **MI 칸이 없다.** MI 를 GT 로 복사할 자리가 타입에 존재하지 않는다.
🔴 `gtReason` 이 비면 **거부** 한다 — 「근거 없는 GT」를 측정에 넣지 않는다.
🔴 `gtToken.mustInclude/mustExclude` 로 **관측된 제목과 대조** 해, GT 가 실제 페이지와
   어긋나면 **측정 전에** 그 행을 뺀다(019A §3 장치를 그대로 가져왔다).
🔴 그리고 후보 fetch 를 **GT·AI 파일을 읽기 «전»** 에 끝낸다 — 주입이 불가능한 순서다.
```

### 🔴 GT 가 없으면 «작업표» 를 써내고 멈춘다

```
GT 파일이 없으면 → mi-022-gt-worklist.json 생성
   [{ searchId, candidateUrl, observedTitle, factsStatus, gt: "<SAME|DIFFERENT>",
      gtReason: "<독립 증거: 품번/모델명/색상/옵션>" }]
→ 🔴 **측정불가로 끝낸다.** GT 를 지어내지 않는다.
```

---

## 3. 축 정의 — 🔴 두 분모를 섞지 않는다

```
accuracy        분모 = 판정이 «있는» 전체 행        (UNCERTAIN 포함)
precisionSame   분모 = **SAME 으로 올린 행만**       🔴 UNCERTAIN 은 분자·분모 둘 다에서 빠진다
falseSame       SAME 으로 올렸는데 GT DIFFERENT
missedSame      SAME 으로 안 올렸는데 GT SAME        🔴 UNCERTAIN+GT SAME 은 **missed 다**
판정 없음(fetch 실패) → 🔴 **0 이 아니라 분모에서 빠진다**(`n` 이 줄어든다)
MI 는 두 축으로 «같이» 낸다  strict(PRESUMED_SAME→SAME) · threeWay(PRESUMED_SAME→UNCERTAIN)
   🔴 정책 변경이 아니라 **집계 라벨** 이다. 하나만 적으면 결과가 숨는다.
Discovery 는 **known-positive discovery rate** — 🔴 KPI 객체에 `recall` 칸을 만들지 않았고
   그것을 **단언으로 잠갔다**. 분모는 **5**(S3 의 정답 URL 이 404 라 제외).
```

---

## 4. 검증

```
🟢 테스트 **19 passed / 1 skipped**(LIVE 블록은 기본 SKIP — 후보 GET 이 일어나므로 opt-in)
🟢 음성 대조 2종 — 둘 다 **FAIL → 복구**
   M1  axisKpi 가 UNCERTAIN 을 SAME 으로 세게 만든다      → 1 FAIL
   M2  validateGtFile 에서 `gtReason` 공백 검사를 지운다   → 1 FAIL
🔴 내 단언 하나가 처음에 틀렸다 — 「UNCERTAIN+GT DIFFERENT 도 missed-SAME」으로 적었다.
   구현이 아니라 **내 기대값이 틀렸고**, 고치면서 `n`·`accuracy` 단언을 **같이 추가** 했다.
```

🔴 **알려진 비용 하나(숨기지 않는다)** — 이 파일이 ①의 export 를 쓰려고 `.test.ts` 를
import 하므로, ①의 describe 가 **이 파일 안에서도 한 번 더 실행**된다(중복 6건).
🟢 그래도 그렇게 했다 — 배열을 **복제하면 「사본 금지」를 깨고**, 「같은 배열인가」를
단언할 수 없게 된다. 🔴 없애려면 ①을 fixtures 로 쪼개야 하고 그것은 기존 하니스 리팩터다.

---

## 5. 🔴 현재 상태 — **준비 완료 / 데이터 대기**. 완료가 아니다

WU-022 §10 체크리스트 대조:

| 항목 | 상태 |
|---|---|
| AI Search 6회 rawAnswer 확보 | 🔴 **없음** — CEO 수동 수집 대기 |
| 후보 URL 추출 / 중복·self-ref 처리 | 🟢 코드 준비(①②③ 재사용) · ⚪ 실행은 데이터 후 |
| 실제 후보 페이지 검증 | 🟢 코드 준비(LIVE) · ⚪ 실행은 데이터 후 |
| 독립 GT | 🟢 규격·검증기·작업표 생성기 준비 · ⚪ 라벨링은 데이터 후 |
| AI/MI vs GT KPI · 4분면 · agreement | 🟢 코드 준비 + 단위 검증 · ⚪ 산출은 데이터 후 |
| known-positive discovery rate | 🟢 분모 5 고정 · 단언으로 잠금 |
| 미검증 후보 별도 분리 | 🟢 `unverifiedNew` 로 분리 |
| 기존 MI 정책 변경 없음 | 🟢 **0** |
| regression / typecheck / diff | 🟢 §6 |
| commit / push / worktree | 🟢 §6 |

🔴🔴 **그러므로 「AI > MI / MI > AI / AI+MI」 최종 결정을 내리지 않았다.**
AI verdict 와 AI 후보 데이터가 **0건** 이기 때문이다. 🔴 「AI 가 틀렸다」·「0%」로 적지 않는다.

---

## 6. 다음 — 사람 손이 필요한 것은 **하나**

```
🟢 CPO 가 전달할 것: docs/AI-SEARCH-COLLECTION-PACKET-022.md **한 장**
   (고정 프롬프트 · 원상품 6건 · 붙여넣기 경로 · JSON 포맷 · 금지 5항)
🟢 CEO 작업: AI 1개를 열고 대화 6회 + 복사 6회. 🔴 자동화 0.
🟢 그 파일이 들어오면 CTO 가 ⑤fetch → ⑥MI → ⑦GT → ⑧KPI 까지 **추가 수집 요청 없이** 끝낸다.
🟡 AI Identity 축(SAME/DIFFERENT/UNCERTAIN)은 **2차 선택** 이다 — 없으면 AI KPI 를
   「측정불가」로 적는다(0% 로 적지 않는다).
```

🔴 **CTO 가 CEO 에게 직접 요청하지 않는다**(헌장 §3). CPO 가 전달한다.
