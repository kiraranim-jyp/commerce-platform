# TTAEJYO — 다음 세션 인수인계 (CTO)

## 🔵🔵🔵 0-HANDOFF. **[2026-11-20 갱신] 이 블록만 읽고 시작한다**

### ① 지금 좌표 — 🔴 **CTO 가 할 작업이 «없다». 새 WU 를 스스로 만들지 않는다**

```
직전 트랙   KIDS MI 핵심 식별 증거 검증 — **전부 종결**(CPO 최종 검토 완료)
최종 커밋   `317a8346` · 브랜치 `uird-deploy-01` · origin 동기 **(0 0)**
            🔴 `origin/main` **behind** — 머지 미실행(**승인 사항**) ⟹ Production 배포 **0**
작업트리    **120건**(사용자 수정 15 + untracked) — 🔴 **이것이 기준선이다. 종료 시 같은 수로 돌린다**
운영 코드    이 트랙에서 **0줄** 변경 · DB **0** · 배포 **0**
다음 범위    🔴 **CPO 가 지정한다** — 기준은 「**현재 확인 가능한 증거로 개선 효과를 입증할 수
            있는 과제**」(미규명 문제를 다시 열지 않는다)
```

### ② 🔴🔴 다시 열지 않는 것 (CPO 확정 · 재조사 금지)

```
B-38 후보 품번 복구(`productFactsFromListing` brandModelCode)   **NO-GO**(§0 전문)
AC↔AB · `AGE-LINE-POLICY-01`                                  기존 계약 **9건** 으로 종결
상품유형 토큰 운영 반영                                          **불승인** — 🔵 운영 판정 효과 **0** 측정됨
`sources.size >= 2`(PRODUCT_NAME 2출처) 완화                   **불승인**
점수 · threshold · blocker 정책 · 가격 자격                      **변경 불승인**
저장 `PRESUMED_SAME` 13건의 3점 구성                           **원인 미규명 종결**(후보 facts 미보존)
브랜드 별칭 사전 확대                                            **보류**(후보 어휘 8종은 목록만 보존)
카테고리 확장(WOMEN/ACCESSORIES/HOME)                          🔴 **보류** — KIDS 먼저
```

### ③ 작업 방식 (헌장 §4 요약 — 이것을 그대로 지킨다)

```
🔴 **착수 전 「기존 구현 확인」** — 이 트랙에서 「이미 있었다」가 **5번** 나왔다(§A-MI 전부)
🔴 **WU 는 한 덩어리** — 조사→원인확정→전수검토→구현→E2E→회귀→배포→**보고 1회**
   단계마다 승인 요청 금지 · 중간 진행 보고 금지
🔴 **용량은 WU 단위로 판단** — 못 끝낼 크기면 **안전 종료 지점**까지 가고 **clean handoff**
🔴 **운영 owner 를 그대로 호출** — 재구현 금지 · **운영 순서대로** 부른다
   (`compareModelCode` 만 보고 `compareCrossSellerProducts` 를 안 봐서 **틀렸다**)
🔴 **칸 이름을 추측하지 않는다** — 타입/소스에서 **읽는다**(이 트랙에서 `snake_case` 로 1회 틀렸다)
🔴 **0 을 결과로 읽지 않는다** — 스캔이 0 이면 **하니스부터 의심**(실제로 1회 났다)
🔴 **CONTROL** — 저장된 운영 결과를 재현하지 못하면 그 숫자를 **전략 판단에 쓰지 않는다**
🔴 **측정불가 ≠ 0** · 분모를 **합산하지 않는다**(109 · 92 · 19 · 16 · 26 은 서로 다른 집합)
🔴 **내 지표 ↔ 운영 축을 갈라 적는다** — 이 구분이 **거짓 개선 보고를 막았다**(63.6%→9.1% 사건)
🔴 산출물은 **`preserved/`** 에만 쓴다 — `fixtures/` 에 쓰면 **사용자 계약이 FAIL** 한다
```

### ④ Git · 보존 (절대 규칙)

```
🔴 `git add .` · `reset --hard` · `clean` · `stash` · 강제 checkout **전부 금지**
🔴 **내 파일만 명시적으로** `git add <path>` · 사용자 수정/untracked **전부 보존**
🔴 보호 문서 수정 금지 — `docs/START-HERE.md` · `docs/STANDARD-V1.md` · `CLAUDE.md`
🔴 동결 브랜치 `mi-locale-link-01` = **`7b093ef4`**(수정·머지·배포 금지)
🔴 `origin/main` 머지 · Production 배포 — **승인 없이 하지 않는다**
🟢 순서 — 테스트 → typecheck → **회귀** → commit → push (회귀 전 커밋 금지)
```

### ⑤ 회귀 실행 명령 (🔴 사용자 untracked 테스트 2개 제외)

```bash
cd apps/admin && npx vitest run \
  --exclude "src/app/pipeline/__tests__/golf01-wire-page-chain.test.ts" \
  --exclude "../../packages/crawler/src/comparison-search/__tests__/kids-locale-link-integration-design.test.ts"
# 🟢 기준선 — 936 files / 11,462 passed / 0 failed · typecheck 0 errors
# 🔴 그 두 파일은 **사용자 untracked** 이고 기준선에서 이미 실패한다(내 변경과 무관 · 손대지 않는다)
```

### ⑥ 보고 방식

```
🔴 **중간 보고 없이 완료 보고 1회.** 「진행 중」 보고를 하지 않는다
🔴 필수 — 숫자 + **측정 방법** + **재현 가능성**(파일·칸 이름·조인 키)
🔴 **PASS 등급을 구분** — Code / Test / Type / Build / Deploy / Production UI / Production API
   🔴 「테스트 PASS」를 「Production PASS」로 쓰지 않는다
🔴 **UNMEASURED 를 PASS 로 적지 않는다** · 추정으로 칸을 채우지 않는다
🔴 내가 틀린 것은 **그대로 적는다**(이 트랙에서 **5번** 정정했고 그것이 신뢰의 근거다)
🔴 보고 끝에 **「현재 좌표 + 다음 한 수」** 를 적고 **이 문서 §0-HANDOFF 를 갱신** 한다
🔴 CEO 에게는 **실제 화면 확인이 필요한 순간에만** 올린다(§3 게이트) · 단계별 승인 요청 금지
```

### ⑦ 이 트랙이 남긴 자산 (🟢 재사용 · 재조사 금지)

```
전략 상시 규칙   `docs/CTO-SESSION-START.DRAFT.md` **§A-MI-1 ~ §A-MI-11**
계약 개정안      `docs/MI-DESCRIPTION-CODE-CONTRACT-PROPOSAL.md`(§0 = NO-GO 결정)
측정 하니스 7종   `__tests__/` — `mi-composite-identity-eval` · `mi-code-typology-eval` ·
                `mi-operational-code-counterfactual` · `kids-core-evidence-audit` ·
                `kids-conflict-gate-counterfactual` · `kids-evidence-store-design` ·
                `kids-origin-name-nonpromotion`(4 tests)
산출물 10종      `__tests__/preserved/*.json`
🔵 핵심 수치     BRAND ABSENT **83%** · MODEL_CODE ABSENT **79%** ·
                GT DIFFERENT **13/13** 이 저장 `PRESUMED_SAME`(그중 **10건 tier COMPARISON**) ·
                blocker 는 **SAME 게이트에만** 걸린다(`PRESUMED_SAME` 을 막지 않는다)
```

### ⑧ 새 세션 첫 메시지

```
docs/START-HERE.md §0-NOW → docs/NEXT-SESSION-B38.md §0-HANDOFF 를 읽고 시작해.
CTO 작업은 없는 상태다 — 다음 범위를 지정해 주면 그 범위만 한 묶음으로 수행해.
```

---

# [이전 기록] §B-38 실행 (🔴 **종결됨** — 아래는 근거 보존이다)

> 🟢 **진입 문서는 여전히 하나다** — 공식 진입점 `docs/START-HERE.md` 의 **§0-NOW(311줄)가 이 문서를 가리킨다**(2026-11-20).
> 🔴 **이 문서 하나로 시작한다.** 전략 재조사·재논의·확인 질문 없이 **STEP 1 부터** 실행한다.
> 🔴 이미 확정된 전략·동결 정책·대상을 다시 묻지 않는다.
> 🟢 상세 이력은 `docs/CTO-SESSION-START.DRAFT.md` §B-18~§B-38 에 있다 — **막혔을 때만** 연다.

---

## 0-NEXT. 🔵🔵🔵 **[2026-11-20] 다음 WU = 복합 식별 근거 평가 · PHASE 1 «완료» · 분모 확정**

🔴 전략 상시 규칙은 `docs/CTO-SESSION-START.DRAFT.md` **§A-MI** 다. 🔴 **PHASE 1 을 다시 하지 않는다.**

```
🟢🟢 **직전 보고의 「후보측 원문 미확보」를 정정한다** — 그것은 **DB/운영 저장** 축의 사실이고
   **평가용 원문은 이미 있다**(수집 0 · 429 무관):
   `fixtures/mi-reeval-03-keyword-input.json` **109쌍** (`pairs[]` · humanGt 내장)
   칸  origin.{title,description,descriptionKo,brand,color,material} · candidate.{title,description}
   확보 원상품 **92/109** · 후보 **98/109** · **양쪽 82/109**

🔴🔴 **그러나 GT 라벨과 교차하면 평가 분모는 «16» 이다**(= B16 집합과 동일):
   GT SAME      20 → 양쪽전문 **6**     🔴 회수 분모가 **6** 이다
   GT DIFFERENT 15 → 양쪽전문 **9**     🟢 오염 시험대는 9
   GT SIMILAR    1 → 양쪽전문 **1**
   미라벨       73 → 양쪽전문 66        🔴 **0 이 아니라 측정불가**
   호스트  junioredition(SAME 2·SIMILAR 1) · null(SAME 4 · 🔴 도메인 공백) ·
          **designerkidswear(DIFFERENT 2 ← CPO 지정 대조군)** · kidbizkid 2 ·
          shoppiccoliandco 2 · folkberlin 1 · petitemaisonkids 1 · nickis 1
🔴 분모 합산 금지 — 109 · 16 · A군 7 · IDENTITY_AXIS 26 은 **서로 다른 집합** 이다
```

🔴🔴 **그래서 PHASE 4 의 한계를 먼저 적는다** — 어떤 조합이든 **SAME 회수 분모가 6** 이다.
🟢 반대로 **DIFFERENT 오염 검출력은 9** 라 **기각 판정은 신뢰할 수 있다**(CPO 기준이 「오염 0」이므로).
⟹ 🔴 「복합 근거가 recall 을 올린다」는 **이 분모로 입증할 수 없다**. 입증 가능한 것은
   **「오염을 일으키지 않는다」** 와 **「6쌍에서 몇 건을 회수한다」** 까지다.

### 🔵 다음 세션의 첫 명령 (PHASE 2 · 조사 0)

```
대상    위 16쌍 · 대조군 designerkidswear.com 2건
방법    🔴 운영 owner 를 그대로 부른다(재구현 금지 · §5-B)
        품번  `confirmBrandCodeInEvidence`(domestic-identifiers.ts:199) ← 건초더미에 **설명 추가**
        브랜드 `brandsCompatible` + `brand-alias.ts`
        상품명 `coreTitleTokens`(cross-seller.ts)
산출    조합 8개 × {분모 · 평가가능 · SAME회수 · DIFFERENT오염 · SIMILAR오인 · 미측정 · 호스트별}
보존    🟢 `preserved/` 에 쓴다 — 🔴 `fixtures/` 에 두면 사용자 계약이 FAIL 한다
금지    429 우회 · UA 변경 · 어댑터 신설 · DB schema · 운영 연결 · 설명 품번 단독 SAME 승격
```

---

## 0-RESULT. 🔴🔴 **[2026-11-20 집행 완료] STEP 1 끝남 · 수정안 «기각» — 다시 하지 않는다**

```
원인 확정 🟢 `junioredition.com × B226AC033` 은 품번이 **설명에만** 있다(`DESCRIPTION_ONLY`)
          운영 확인 owner `confirmBrandCodeInEvidence`(match.ts:635)의 건초더미가
          **title · url · sku 셋**(domestic-identifiers.ts:185)이라 **설명을 보지 않는다**
          ⟹ 품번 축 인정 0 ⟹ 정원 5 미달 ⟹ `PRESUMED_SAME`
대조군    🟢 같은 원상품의 `tiptoeboutique.com` 은 품번이 **URL** 에 있어 그대로 `SAME`
기각 사유 🔴 그 레버(설명 품번 단독 확인)는 **이미 측정·REJECT** 됐다 —
          20쌍 · 4호스트 · **실제 이득 1 ↔ GT DIFFERENT 오염 2**(cemarose.ca · tinyapple.net)
          ⟹ 이 문서 §1 절대 기준(「대조군 DIFFERENT 유지」)에 **2건 실패** ⟹ 전체 기각
잠금      🟢 `a-identity-axis.test.ts`(6 tests PASS)가 그 결론을 기계로 잠근다
남은 길   🔴 네 레버 전부 닫혔다(제목토큰 · 설명품번 · 선행문자없는품번 · 원상품측복구)
          🟡 열려 있는 것은 **복합 근거**(브랜드+품번+상품명을 설명에서 «함께» 문맥 검증)이고
             선행 조건은 **후보측 원문 확보** 다 — 🔴 지금 **HTTP 429 호스트 12곳** 이 막는다
```

🔵 **MI 식별 전략 상시 규칙은 `docs/CTO-SESSION-START.DRAFT.md` §A-MI 다**(CPO 확정 2026-11-20).
🔴🔴🔴 **[CPO 최종 결정 2026-11-20] 운영 연결 NO-GO — B-38 트랙 종결.**
   `productFactsFromListing` 품번 복구는 **연결하지 않는다** · AC↔AB 는 `AGE-LINE-POLICY-01` +
   기존 계약 **9건** 으로 **잠긴 것으로 종결** · 🔴 **같은 경로 재조사 금지 · 새 조사 WU 금지** ·
   재개 조건은 **일반 품번 불일치 GT DIFFERENT 표본 확보** 하나다(전문 §0).
🔵 **상세설명 품번의 계약 충돌·개정안은 `docs/MI-DESCRIPTION-CODE-CONTRACT-PROPOSAL.md` 다**
   — 🔴 변경 지점이 **`productFactsFromListing`(seller-facts.ts:380) `brandModelCode: null`** 한 줄로
   특정됐다(Shopify 팩토리 `:247` 은 **이미** 설명에서 라벨 품번을 복구한다 · 팩토리 비대칭).
   🔴 운영 연결은 **CPO 보류** · 선행 조건 둘은 그 문서 §5 에 있다.
🔴 아래 STEP 1~5 는 **집행 기록으로 보존** 한다 — 재실행 지시가 아니다.

---

## 0. 이번 세션의 목표 — 한 건

**`junioredition.com × B226AC033` 의 해외 MI 판정을 바로잡거나, 근거에 따라 수정안을 기각한다.**

```
수정 → KIDS 전체 회귀 → 셀러 화면 E2E → Production 검증   ← 하나의 통합 작업
```
🔴 분석 보고서를 더 만드는 세션이 **아니다**. 🔴 새 WU 를 만들지 않는다.

---

## 1. 🔴🔴 합격·기각 조건 (절대 기준)

```
① Human SAME       → 시스템 **SAME**            대상 `junioredition.com × B226AC033`
② Human DIFFERENT  → 시스템 **DIFFERENT 유지**   대조군 `designerkidswear.com`(Stone Island)
🔴 둘 중 하나라도 실패하면 **수정안 전체를 기각** 한다.
🔴 SAME 숫자 증가 · 후보 수 증가 · 평균 점수 향상은 **합격 기준이 아니다.**
🔴 잘못된 SAME 을 **하나라도** 만들면 실패다.
```

---

## 2. 이미 확정된 진단 (재조사 금지)

| 영역 | B226AC033 실측 | 판정 |
|---|---|---|
| 🇰🇷 국내 후보 | URL 은 있었고 **수집에서 죽었다**(HTTP_429 → TimeoutError) | **수집 문제** · 🔴 **금지 축**(약관·429·어댑터) |
| 🌎 해외 후보 | 후보 **6** · **SAME 0 · PRESUMED_SAME 6** · 가격 **6 보유** | 🔴🔴 **MI 판단 문제 ← 이번 수정 지점** |
| 💰 가격 | `PRESUMED_SAME` 은 가격 자격 집합에 **포함** · 화면에 GBP/CAD/USD 표시됨 | 🟢 **정상 · 손대지 않는다** |
| 🖥 셀러 연결 | 실제 가격 표시 확인됨 | 🟢 **정상 · 손대지 않는다** |

🟢 대상 후보의 기존 상태 — `brandAxis` **MATCH** · `state` **CORRECT** · Human GT **SAME** · 시스템 **PRESUMED_SAME**.

---

## 3. STEP 1 — 축·blockers 추출 (첫 명령)

### 운영 판정 owner (추측 금지 · 이름 확정됨)

```
packages/crawler/src/comparison-search/cross-seller.ts   `compareCrossSellerProducts(`
packages/crawler/src/comparison-search/match.ts:581      `withConfidence(query, candidates)`
packages/crawler/src/comparison-search/match-truth.ts:74 `deriveMatchTruth(`
```
🔴 **운영 순서대로** 부른다 — `withConfidence` 가 확인 배선(`confirmBrandCodeInEvidence`)을
돌리므로 `compareCrossSellerProducts` 를 **직접만** 부르면 **운영 값이 아니다**(CORE-2I 선례).

### 근거 자료 4개 (실재 확인됨 · 경로 그대로 사용)

```
apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/wu-059-gt-facts.json   원상품 facts(origins S1~S6)
docs/MI-KIDS-CODE-NAME-CAUSES.json                                                  원인 코드(code.cause · name.cause · axis*)
apps/admin/src/app/api/price-history/_lib/__tests__/preserved/a-identity-axis.json  축 상태(26쌍)
docs/MI-BRAND-TITLE-FILL-FINAL.json                                                 Human SAME 라벨 근거(B226AC033 2행)
```
🔴 조인 키는 **(originCode, candidateUrl)** 다 — 도메인·URL 단독 조인은 **어긋난다**(실측).

### 뽑아야 할 것

```
blockers 전수 · 축별 MATCH / MISMATCH / UNKNOWN · **SAME 정원 집계**
🔴 정원 규칙 — `SAME_MIN_AXES` **5** · `PRESUMED_SAME_MIN_AXES` **3** ·
   `IMAGE` 제외 · **1점 `TITLE`** 제외(기전: 축 배열 필터 `axis.axis !== "IMAGE" && !(TITLE && points===1)`)
🔴 「모른다 ↔ 달랐다」를 가른다 — 관찰된차이 9종만 `OBSERVED_DIFFERENCE_BLOCKERS` 이고
   `BRAND_UNCONFIRMED` · `COLOR_VARIANT` 는 **보류** 다 · `SIZE_SYSTEM` 은 어휘에만 있고 **push 0**
⟹ **SAME 을 막는 축(또는 복합 원인) 하나를 특정** 한다
```

---

## 4. STEP 2~5 (변경 금지)

```
STEP 2 공통 MI 수정   원인이 확인된 경우에만 · 기존 축·기존 증거만 · 사이트 예외 0 · 새 증거 생성 0
STEP 3 KIDS 전체 회귀  대상 SAME 확인 · 대조군 DIFFERENT 유지 확인 · 다른 상품 회귀 0
STEP 4 셀러 화면 E2E  **마운트 DOM** 기준 · 판정 ↔ 표시 일치 · 결함 없으면 UI 수정 0
STEP 5 Production     배포 · 대상/대조군 실제 판정 확인 · 🔴 미확인은 **NOT VERIFIED** 로 적는다
```

---

## 5. 🔴 돌아가지 않는 영역

```
검색 쿼리 연구·A/B · 국내 후보 탐색 반복 조사 · 국내 수집(약관·429·어댑터·우회) ·
가격 계산·가격 적격성 · 정상 확인된 셀러 연결·UI · 닫힌 과거 평가 재실행 · 새 WU 생성
🔴 국내 수집 문제와 해외 MI 판정 문제를 **분리** 한다. 이번은 **해외 MI 판정 한 건** 이다.
```

---

## 6. 동결·보호 (CEO 승인 없이 변경 금지)

```
`SAME_MIN_AXES = 5` · `PRESUMED_SAME_MIN_AXES = 3` · `IMAGE` 정원 제외 · **1점 TITLE** 정원 제외
설명문만으로 SAME 승격 금지 · 이미지 단독 SAME 금지 · 품번 충돌 무시 금지 ·
제목 토큰 → `brandModelCode` 승격 금지(REJECT 선례 `32a0f374` · 계약 11건) ·
사이트 전용 예외 금지 · 가격 정책·G6 변경 금지 · `isCollectionBlocked` 변경 금지 ·
DB 스키마·migration 금지 · `git add .` 금지 · 사용자 수정 파일 보존
보호 문서  `docs/START-HERE.md` · `docs/CEO-GT-LEDGER-2026-11-08.md` · `CLAUDE.md` · `docs/STANDARD-V1.md`
frozen     `mi-locale-link-01` = **7b093ef4**(수정·병합·배포 금지)
```

---

## 7. 시작 기준선 (다르면 **차이를 보고**한다 · 임의 정리 금지)

```
작업트리 **121건**(사용자 수정+untracked) · CTO 미커밋 **0**
origin/main **f7ad9d26** · ahead/behind **0 0** · 운영 코드 변경 **0** · Production **200**
frozen **7b093ef4** · G6 동결 · SAME 기준 동결 · 가격 로직 동결 · 약관 게이트 동결
```

### 실행 명령 참고

```
단위 테스트  cd apps/admin && npx vitest run <파일>
타입         cd apps/admin && npx tsc --noEmit -p tsconfig.json         (기준 0)
전체 회귀     cd apps/admin && npx vitest run \
  --exclude "src/app/pipeline/__tests__/golf01-wire-page-chain.test.ts" \
  --exclude "../../packages/crawler/src/comparison-search/__tests__/kids-locale-link-integration-design.test.ts"
🔴 그 두 파일은 **사용자 untracked 테스트** 이고 기준선에서 이미 실패한다(내 변경과 무관 · 손대지 않는다)
🟢 기준선 숫자 — 928 files / 11,451 passed / 0 failed
```

---

## 8. 최종 보고 형식 (한 번에)

```
A 원인   실제 blocker · 축별 상태 · SAME 을 막은 **코드 경로** · 원본↔후보 근거 비교
B 수정   변경 파일 · 변경한 공통 로직 · 변경 전후 판정 차이 · 사이트 예외 여부
C 검증   대상 SAME 결과 · **대조군 DIFFERENT 결과** · KIDS 회귀 · 셀러 E2E · Production
D 안전성  threshold/동결/가격/약관 변경 여부 · 보호 문서·사용자 파일 보존 · frozen 영향
E Git    커밋 SHA · 변경 파일 · 테스트 명령과 결과 · 배포 여부 · Production 근거
F 판정   **PASS** / **REJECT**(①② 중 하나라도 실패) / **BLOCKED**(명확한 장애)
🔴 부분 완료를 전체 완료로 적지 않는다. 코드 변경·테스트·배포·실제 동작 확인을 **구분** 한다.
```

---

## 9. 🔴 이 트랙에서 반복된 함정 (다음 세션이 먼저 읽는다)

```
① **칸 이름을 추측하지 않는다** — 타입·운영 코드에서 **읽고** 쓴다(이 트랙에서 12번 틀렸다)
② **운영 호출 순서를 그대로 베낀다** — 함수를 직접만 부르면 배선이 빠진다(§5-B)
③ **주석을 근거로 단언하지 않는다** — 주석 제거 후 사라지는 이름이 실재한다(`coreAxisCount`)
④ 🔴 주석 제거 정규식 `//[^\n]*` 은 **`https://` 의 `//` 를 먹는다** ⟹ URL 단언은 **원문** 으로
⑤ **금지 토큰은 런타임에 조립** 한다 — 리터럴로 적으면 **내 목록이 내 파일을 잡는다**(7번 났다)
⑥ **조인 키를 버리지 않는다** — 산출물에 `originCode` 를 남긴다(없으면 되짚을 수 없다)
⑦ **「측정불가」를 0 으로 적지 않는다** · 분모와 측정 범위를 같이 적는다
⑧ 가드가 내 변경을 막으면 **가드를 풀지 말고 이름을 옮긴다**
```

---

**이번 세션 종료 상태:** 수정 지점 특정 및 실행 준비 완료 — **제품 작업 완료가 아니다.**
**다음 세션 목표:** 대상 페어의 MI 판정 수정 + 전체 검증 완료, **또는** 근거에 따른 기각.
