# MI-GEMINI-INTEGRATION-005 — Gemini 후보를 운영 MI 에 «합류» 시킨다

> 🟢 ①~⑧ **구현 완료.** flag 기본 OFF · DB 쓰기 0 · threshold 0 · schema 0.
> 🔴🔴 **Production 측정은 «중도 차단» 됐다** — Gemini 선불 크레딧 소진(`402`).
> 🔴 판정: **IMPLEMENTED / PARTIALLY MEASURED** — 배포 여부는 CPO/CEO 결정.

---

## 0. 🔴 먼저 — 이 문서의 숫자가 나온 «세 회차» 를 가른다

실측이 **세 번** 돌았고 셋의 조건이 다르다. 🔴 섞어 읽으면 전부 틀린다.

| 회차 | scope | Gemini | 🔴 유효성 |
|---|---|---|---|
| 1차 | 🔴 **무효** (`KIDS_CLOTHING` — 없는 어휘 → 통과 샵 **0**) | OK 6/6 | OFF 축 무효 · Gemini 축만 유효 |
| 2차 | 🟢 **유효** (`KIDS_FASHION` → 6샵 · TENNIS → 1샵) | 🟡 OK **2** / API_FAILURE **6** | 🟢 **유일한 유효 OFF/ON 대조** |
| 3차 | 🟢 유효 | 🔴 API_FAILURE **10/10** (`402`) | 🟢 **실전 장애 회귀 증거** |

🔴 **1차가 왜 무효인가.** `categoryScopes` 를 `"KIDS_CLOTHING"` 으로 **추측**했고
그 어휘는 DB 에 없다. `isBatchSurveyTarget` 가 전부 탈락시켜 **국내 샵 0개**로
검색했고, 그래서 `OFF 후보 0` 이 나왔다. 그 0 과 「ON 추가 SAME 9」를 비교하면
**거짓 비교**다. 🟢 실제 어휘는 DB 전수로 확인했다:

```
KIDS_FASHION 11 · (빈 배열) 14 · FASHION_ACCESSORIES+KIDS_FASHION+WOMEN_FASHION 4
KIDS_FASHION+KIDS_GOODS 3 · TENNIS 1 · GOLF 1      🔴 KIDS_CLOTHING 은 **없다**
```

🔴 이 트랙에서 **값/칸 이름을 추측해 틀린 것이 여섯 번째**다.

🔴 그리고 **1·2차의 후보별 상세는 영구히 사라졌다** — 하니스가 출력 파일명을
고정해 써서 재실행이 덮어썼다. 🟢 회차별 파일명으로 고쳤으나 **402 때문에
재현이 불가능**해졌다. 남은 것은 터미널에 찍힌 집계뿐이다.

---

## 1. 구현 — ①~⑤ (Production 변경 **2파일**)

```
신규  apps/admin/src/app/api/price-history/_lib/gemini-candidate-pool.ts  (252줄)
수정  apps/admin/src/app/api/price-history/_lib/run-domestic-price-check.ts (+71/-3)
```

### ① flag — 기본 OFF

```ts
MI_GEMINI_DISCOVERY_ENABLED === "true"   // 🔴 "1"·"yes"·"TRUE"·"on" 전부 OFF
```

🔴 OFF 면 합류 블록이 **한 줄도 돌지 않는다** → 기존 동작 100% 유지.
🔴 이 리포에 feature-flag 규약이 **없었다**(grep 0건). 이것이 첫 사례다.

### ② 합류점 — `searchResults` 머지 «직후» 한 블록

🟢 기존 국내 결과와 **같은 배열**에 append 한다 → 그 뒤 판정 경로
(`withConfidence` → `judgeDomesticCandidate`)를 **그대로** 탄다.
🔴 새 판정기·새 threshold **0**.

### ③ scope — 우회하지 않는다

`preferredDomains = allSources.map(s => s.domain)` 이고 `allSources` 는 바로 위에서
`isBatchSurveyTarget(s, input.categoryScopes)` 를 통과한 샵들이다.
🟢 **기존 정책을 재사용**한다(새 Registry 0 · 사이트 추가 0).

### ④ dedupe + 상한 — 🔴 상한은 **호출부가** 준다

```
normalizeCandidateUrl  www·트레일링 슬래시·쿼리·해시 제거 · 호스트 소문자
maxCandidates 3 · targetUsable 3 · maxQueries 2
근거: MI-GEMINI-INTEG-002 실측(raw URL 0~21 · 상한 3 에서 SAME 1 + PRESUMED_SAME 3)
🔴 「상품당 Gemini N회 고정」이 아니다 — targetUsable 이 차면 조기 종료
```

### ⑤🔴🔴 저장 차단 — 「일시 Candidate Pool」의 핵심 조건

가상 샵 `__gemini_discovery__` 는 등록부에 **없다**. `record...CheckAttempt` 는
`domestic_price_sources.id` 를 키로 쓰고 `upsertDomesticProductLink.source_id` 는
그 표를 가리키는 **FK** 다 → 가상 id 를 넘기면 쓰기가 터지거나 쓰레기 행이 남는다.

```
recordCheckAttempt() 래퍼 하나로 3개 호출부를 전부 가렸다
upsert 직전  if (result.shopId === GEMINI_VIRTUAL_SHOP_ID) continue;
```

🔴 그래서 flag ON 이어도 Gemini 후보는 `linksCreatedOrUpdated` 를 **올리지 않는다.**
🟢 DB schema 0 · migration 0 · 외부 URL 영구 보관 0.

---

## 2. 🟢 2차 실측 — 유일한 유효 OFF/ON 대조 (`sample 상품 N=5`)

> 🔴 `sample N=5` (아동복 3 · 테니스 2) · 🔴 **Gemini 성공 호출은 2회뿐**이다
> (8회 중 6회가 크레딧 소진으로 실패). 아래 Gemini 축 숫자는 **그 2회의 산출**이다.

```
scope 통과 샵     아동복 **6** · 테니스 **1**        🟢 운영 함수로 갈랐다
퍼널              Gemini 발견 URL 43 → 상품페이지 6 → MI 후보 **6**
후보 합           OFF **35** → ON **41**
🟡 핵심            OFF SAME/PRESUMED **0** → ON 추가 SAME/PRESUMED **4**
                  효과가 난 상품 **2/5**
🔴🔴 **단 이 4건은 `crossSellerVerdict` 개수다 — 운영 링크 결과가 아니다.**
      하니스가 `judgeDomesticCandidate` 를 부르지 않았다(§6 Known Unknowns)
비용              Gemini 호출 8 · 입력 1,364 · 출력 2,715 · thoughts 2,781 ·
                  총 6,860 토큰 · 우리 resolve 9 · 우리 fetch 15
                  상품당 — Gemini 1.6회 · 1,372토큰 · fetch 3.0회
🔴 grounding 쿼리  **측정 불가** — `usageMetadata` 에 들어오지 않는다(0 이 아니다)
모델              `gemini-flash-latest`
```

### 🔴 scope 가 실제로 먹었는가 — 돌려받은 도메인을 센다

```
Bobo Choses  (KIDS_FASHION · 6샵) → 🟢 looxloo.com(**등록부 일치**) · babybubble.co.kr ·
                                      en.petitlouie.co.kr
Louise Misha (KIDS_FASHION · 6샵) → 후보 0 (크레딧 소진)
Bobo Choses  (KIDS_FASHION · 6샵) → 후보 0 (크레딧 소진)
Sergio Tacch.(TENNIS · 1샵)      → tennis-warehouse.com · eu.sergiotacchini.com ·
                                     tennis-point.com   🔴 등록부 일치 0
Sergio Tacch.(TENNIS · 1샵)      → 후보 0 (크레딧 소진)
```

🟢 **1차와의 자연 대조가 하나 생겼다** — 1차는 `preferredDomains` 가 **비어
있었고**(통과 샵 0) 그때 돌아온 도메인은 `bobochoses.com`·`unepf.com`·
`louisemisha.com`·`shop.simon.com`·`pickleballwarehouse.com` 처럼 **해외/공식몰**
위주였다. 2차는 도메인을 주입했고 **국내 샵(`looxloo.com`)이 처음 섞였다.**
🔴 단 `sample` 이 각각 1건·3건이라 **「도메인 주입이 효과가 있다」로 단정하지 않는다.**

---

## 3. 🔴🔴 3차 실측 — 측정이 «차단» 됐다. 그리고 그것이 ⑦의 가장 좋은 증거다

```
Gemini 호출 10/10 → API_FAILURE
실패 사유 (metrics 가 실제로 적었다):
  "GoogleDiscoveryApiError: Google Discovery 호출 실패(402): Payment Required"
  본문: "Your prepayment credits are depleted."
```

### 🟢🟢 그런데 **운영 결과가 한 글자도 바뀌지 않았다**

```
OFF 후보 합  35
ON  후보 합  **35**      ← 완전히 동일
ON 추가 SAME/PRESUMED  0 · 효과 상품 0
우리 서버 resolve 0 · fetch 0   (후보가 없으니 우리 비용도 0)
```

🔴🔴 **이것이 §13 계약의 실전 증거다.** Gemini 가 **완전히 죽은** 상태에서
국내 가격확인 경로가 **그대로 동작했다.** mock 이 아니라 실제 외부 장애다.

### 🔴 원인을 가른다 — 「키 사망」이 아니다

```
① grounding 없음 · gemini-flash-latest       → 402
② grounding 있음 · gemini-flash-latest       → 402
③ grounding 없음 · gemini-flash-lite-latest  → 🟢 **200 OK**
④ grounding 있음 · gemini-flash-lite-latest  → 🔴 **402**
```

🟢 **키는 살아 있다**(53자 · ③이 200). 🔴 막힌 것은 **Grounded Search(google_search
tool)** 이고 그것이 **선불 크레딧을 요구**한다. 소진됐다.

🔴 **그래서 이 WU 의 Production 측정은 여기서 닫힌다.** 크레딧 충전은 **비용
승인**이고 CEO/CPO 영역이다(CTO 가 결제하지 않는다). 🔴 모델을 임의로 바꿔
측정을 「성공」시키지 않았다 — ④가 lite 에서도 402 이므로 어차피 불가능하고,
운영 기본 모델을 측정 편의로 바꾸는 것은 제품 결정이다.

---

## 4. ⑦ Negative Test — 4종 + 음성 대조

`apps/admin/.../__tests__/mi-gemini-005-negative.test.ts` · **12 tests** · 🟢 LIVE 불필요
(`fetch` stub — 전체 회귀에서 매번 돈다).

```
① CONFIG_MISSING  키 없음 → geminiCalls **0** · model null · 🔴 groundingQueries **null**
② API_FAILURE     500 → throw 안 함 · fetch 는 실제로 불렸다(①과 구분) · resolveCalls 0
③ timeout         TimeoutError → 🔴 CONFIG_MISSING «아니라» API_FAILURE
④ 후보 0건        🔴🔴 outcome 이 **OK** 다. 🟢 그런데 geminiCalls>0 · totalTokens>0
                  → 「0건이 무료가 아니다」를 숫자로 남긴다
⑧ 조기종료        후보 없어도 maxQueries 상한까지만 — fetch ≤ 2
① flag            "1"·"yes"·"TRUE"·"on"·"" 전부 OFF · "true" 만 ON
③ dedupe          국내가 이미 낸 URL → discoveredUrls>0 인데 resolveCalls **0**
⑤ 저장차단        upsert «앞» 에 가드가 있는지 **인덱스 순서로** 확인(뒤면 이미 저장됨)
                  모듈에 supabase/prisma/insert/upsert **0건**
```

🟢 **음성 대조** — 보호장치를 지우면 실패한다:

```
정상                              12/12 PASS
mutation 3개 주입                  **3 FAIL** / 9 PASS   (하나씩 정확히 대응)
  ⑤ upsert 가드 1줄 제거            → 저장차단 FAIL
  flag === "true" → Boolean()      → 기본 OFF FAIL
  dedupe seen.has(key) 제거         → 중복제외 FAIL
원상복구                           12/12 PASS
```

🔴 소스 문자열 검사는 **주석을 벗기고** 했다(헌장 §5).

---

## 5. ⑧ 회귀 · typecheck · 가드

```
🟢 apps/admin 전체    Test Files **506 passed** / 44 skipped (550)
                      Tests **7,534 passed** / 52 skipped (7,586) · exit 0 · failed **0**
🔴 packages/crawler   Test Files 1 failed / 60 passed / 19 skipped (80)
                      Tests 833 passed / 23 skipped — **실패한 «테스트» 는 0**
🟢 전 패키지 typecheck  **10** = baseline 10 (listing 5 · pricing 3 · crawler 2 · admin 0)
🟢 no-production-coupling  6/6 PASS (단언 1개 **추가** 했다)
```

### 🔴 crawler 1건은 **선재 결함** 이다 — 내 변경과 무관함을 증명했다

```
FAIL  src/comparison-search/__tests__/match-truth-priority.test.ts
Error: Cannot find package '@/lib/supabase-admin' imported from
       apps/admin/.../domestic-price-sources/_lib/domestic-product-link.ts
```

그 테스트가 `../../../../../apps/admin/.../domestic-product-link` 를 **깊은 상대
경로로** import 하고, 그 파일이 `@/lib` alias 를 쓴다 — crawler 의 vitest 는 그
alias 를 모른다. 🟢 import 사슬 전건이 `origin/main` 과 **0 변경**이다:

```
match-truth.ts 0 · cross-seller.ts 0 · match.ts 0 · evidence.ts 0 ·
domestic-product-link.ts 0 · vitest.config/tsconfig **미변경**
해당 테스트 파일은 6568fb2a(선행 스프린트)에서 생겼다
```

🔴 **그리고 crawler 전체 회귀의 baseline 이 이 트랙에 «없었다»** — 헌장 §12 의
`505/7520` 은 **apps/admin 전용** 숫자다. 🔴 그래서 「새로 깨졌다」고도
「원래 깨져 있었다」고도 **숫자로는 말할 수 없고**, 사슬 대조로만 무관함을 확인했다.

### 🟢 가드를 **확장**했다 (완화 아님)

🔴 `no-production-coupling.test.ts` 는 `packages/crawler/src` 만 봤다. 그런데 이 WU 가
**`apps/admin` 에서 discovery-* 를 import 하는 첫 운영 파일**을 만들었다 → 그 자리에서
`discovery-benchmark` 로 바꿔 써도 가드가 **아무 말도 하지 않았다.**

```
🟢 추가한 단언  apps/admin/src 전수에 "discovery-benchmark" specifier 0건
   🔴 패키지 specifier(@commerce/crawler/src/...)로 들어오므로 **문자열로** 본다
      (상대경로만 보면 이 경로를 전부 놓친다)
   🔴 0건 통과 방지 — adminFiles.length > 100 을 먼저 단언
🟢 음성 대조    import 를 benchmark 로 바꾸니 **정확히 그 1건** 이 잡혔다 → 복구 6/6
🔴 금지 단언의 «문장» 은 한 글자도 바꾸지 않았다 — **보는 파일을 늘렸을 뿐이다**
```

---

## 6. 🔴 Known Unknowns — 「0」이나 「없음」으로 적지 않는다

```
🔴 Gemini 축 전체가 **sample 성공 호출 N=2** 에 걸려 있다. 일반화 금지
🔴 1·2차 **후보별 상세가 소실** 됐다(하니스가 파일을 덮어썼다) — 402 로 재현 불가
🔴 테니스 등록부 일치 **0/3** — 「국내 취급처가 없다」인지 「도메인 주입이 약하다」인지
   **구분 불가**(TENNIS scope 샵이 1곳뿐이고 선행 WU 가 그 샵 브랜드 교집합을 0 으로 실측)
🔴 아동복 2건·테니스 1건은 **후보 0 인데 그 이유가 크레딧 소진** 이다 —
   「Gemini 가 못 찾았다」가 **아니다**(outcome 이 API_FAILURE 다)
🔴 `groundingQueries` 구조적 측정 불가 · 요금(원화) 측정 불가(CTO 가 단가를 못 읽는다)
🔴 497개 기준 비용 환산 **하지 않았다**(CPO 폐기 지시)
🔴 Gemini 후보 가격은 전건 null(product-url-facts 의 의도된 동작) — 가격 비교까지
   가려면 `enrichCandidatePrices` 가 더 필요하고 이 WU 범위가 아니다
🔴🔴 **하니스가 `judgeDomesticCandidate` 를 부르지 않았다 — 보고 전 자기검증에서
   내가 찾았다.** `withConfidence` 까지만 불렀다. 즉 「ON 추가 SAME/PRESUMED 4」는
   **`crossSellerVerdict` 개수** 이고 **운영의 링크/tier 결과가 아니다.**
   🔴 배선 자체는 올바르다 — Gemini 후보가 `searchResults` 에 들어가므로 운영에서는
      그 뒤 게이트(`judgeDomesticCandidate` + `fetchDomesticModelCode`)를 **그대로 탄다**.
      측정만 한 단계 짧다. 🔴 §5-B 가 **이 트랙에서 이미 한 번 잡은 바로 그 함정** 이다
      (「searchDomesticShops + withConfidence 까지만 불렀는데 운영은 그 뒤가 더 있었다」).
   🔴 그래서 그 4건이 운영에서 실제로 링크가 될지는 **측정되지 않았다.** 0 도 4 도 아니다.
   🔴 402 때문에 **지금 다시 잴 수 없다** — 크레딧 충전 후 재측정 대상이다
🔴 flag ON 상태의 **Production** 동작은 **미검증** — 배포하지 않았다
🔴 crawler 전체 회귀 baseline 부재(위 §5)
```

---

## 7. 판정

```
Code PASS            🟢
Test PASS            🟢 (admin 506/7,534 · negative 12/12 · 음성대조 3/3)
Type PASS            🟢 (10 = baseline)
Build PASS           🔴 미실행 — 배포 대상이 아니므로 돌리지 않았다
Deploy PASS          🔴 **하지 않았다** (push·deploy 는 CEO 판단 영역)
Production UI PASS   🔴 해당 없음
Production API PASS  🟡 **부분** — 실제 Gemini 를 불렀다(2차 OK 2회).
                        🔴 그 뒤 402 로 차단됐다
Production PASS      🔴 **아니다** — Implemented / Partially Measured
```

🔴🔴 **남은 결정 둘은 CPO/CEO 영역이다**:

```
① Gemini 선불 크레딧 충전 여부 — **비용 승인**. 충전 없이는 이 기능이
   Production 에서 «항상 API_FAILURE» 다(그래도 안전하다 — §3 가 증거다)
② flag 를 Production 에서 켤 것인가 — 켜는 순간 상품당 외부 호출이 늘어난다
   (2차 실측: 상품당 Gemini 1.6회 · 1,372토큰 · 우리 fetch 3.0회)
🟢 ①②를 하지 않아도 **배포 자체는 안전하다** — 기본 OFF 이고 OFF 면 코드가 안 돈다
```

---

# ◆ VALIDATION-CLOSE (CPO 지시, 2026-10-13) — 추가 결과

> 🟢 ①②⑥⑦ **닫혔다.** 🔴 ③④⑤의 **ON 축은 크레딧 소진으로 측정 불가** 유지.
> 🔴 CPO 가 폐기한 「추가 SAME/PRESUMED 4」는 이 문서에서도 **KPI 로 쓰지 않는다.**

## ①-a 🔴🔴 보정하다가 «추가 결함 셋» 을 더 찾았다

`judgeDomesticCandidate` 를 붙이려고 운영 루프를 다시 읽었더니 내 배선에
**세 개의 결함** 이 더 있었다. 전부 고쳤다.

| | 무엇이 틀렸나 | 왜 치명적인가 |
|---|---|---|
| **A** | Gemini 후보를 **점수 없이** 넘겼다 | 국내 경로는 `searchDomesticShops` «안에서» `withConfidence` 를 부른다(comparison-search/index.ts:197). 점수가 없으면 `isEvidenceEvaluationWorthwhile` 가 `candidates[0].matchLevel !== "low"` 를 보는데 `undefined !== "low"` 는 **참** → **게이트가 공짜로 열린다** |
| **B** | 후보 전체를 **가상 domain 하나** 로 묶었다 | `judgeDomesticCandidate(domain)` 이 그 값으로 분기한다 — `fetchDomesticModelCode` 가 **영구 null**, 그리고 `selectDomesticCandidate` 가 **샵당 1건** 만 남기므로 서로 다른 판매처 후보들이 한 샵처럼 경쟁해 **최대 1건만** 살아남는다 |
| **C** | 저장 차단 가드를 **Vision «뒤»** 에 뒀다 | 그 사이의 `findCachedVisionEvidence(snapshotId, shopId, …)` 가 가상 shopId 로 DB 를 뒤지고, 캐시가 없으면 `runVisionEvidence` 가 **실제 외부 모델을 호출** 한다. 저장도 안 할 후보에 비용을 쓰고 캐시 키까지 오염시킨다 |

```
수정  A → withConfidence(query, r.candidates) 를 합류 지점에서 적용
      B → host 별로 ComparisonSearchResult 를 쪼갠다(domain=실제 host,
           shopId=가상 — 저장 차단은 shopId 로 가리므로 그대로 유효)
      C → 가드를 JUDGED 구조분해 «직후»(Vision 앞) 로 이동
```

## ①-b 🟢🟢 §5-B CONTROL — **2/3 PASS** (재현 가능한 샵 기준)

> 🔴 통과 조건은 「후보가 나왔다」가 아니라 **`matchTruth === 운영값` && `verified === 운영값`** 이다.

| 상품 | 샵 | 운영 | 내 하니스 | tier | |
|---|---|---|---|---|---|
| Louise Misha Tender coat | `deuxbebe.com` | TEXT_CONFIRMED / false | **동일** | COMPARISON = COMPARISON | 🟢 PASS |
| Pèpè Lulu T Bar | `foretforet.com` | STRONG_IDENTIFIER / true | **동일** | EXACT = EXACT | 🟢 PASS |
| Pèpè Lulu T Bar | `deuxbebe.com` | SIMILAR / false | `DROPPED` | REFERENCE ↔ 없음 | 🔴 FAIL |
| Bobo ×2 | `bobochoses.com` | — | 그 샵이 결과를 내지 않았다 | — | 🔴 구조적 재현 불가(disabled) |

### 🔴 FAIL 1건의 원인 — **하니스 결함이 아니다.** 순서대로 갈랐다

```
① 호출 경로  🟢 정상 — 같은 상품의 foretforet 건이 **정확히 재현** 됐고,
             다른 상품의 deuxbebe 건도 재현됐다
② 설정 상태  🟢 정상 — deuxbebe 는 enabled·AUTO 이고 같은 실행에서 JUDGED 를 냈다
③ 입력       🟢 **동일** — 내가 고른 후보가 운영과 «같은 URL» 이다
             (`…/detail.html?product_no=8021&cate_no=62&display_group=1`)
             제목도 같다(「페페 VERNICE NERO」)
④ Production 결과  🔴🔴 **운영 행이 현재 게이트보다 오래됐다**
```

🟢 **결정적 증명** — 현재 `isEvidenceEvaluationWorthwhile` 의 네 조건이 이 삼중쌍에
**전부 불성립**이라 현재 코드는 이 행을 만들 수 **없다**:

```
① some(verdict === SAME | PRESUMED_SAME)        → verdict 는 SIMILAR        ✗
② candidates[0].matchLevel !== "low"            → low 다                    ✗
③ confirmBrandCodeInTitle("01195-VERNICE-NERO",
     "페페 VERNICE NERO") !== null               → 품번이 제목에 토큰으로 없다  ✗
④ domain === "foretforet.com"                   → deuxbebe 다               ✗
```

```
게이트 최근 변경   675821d2  **2026-10-07** 18:32
                   「이미 «확정된» 품번을 국내 제목에서 확인하고,
                     🔴 **색상을 모르면 확정하지 않는다**」
                   🔴 이 상품의 foreignColor 는 **null** 이다
그 URL 의 링크 행   18행 전부 updated_at **≤ 2026-09-09**
→ 🟢 행이 게이트보다 **약 4주 오래됐다.** 「지금 코드가 틀렸다」가 아니다
```

🔴 **그래서 이 FAIL 을 제품 결함으로도 하니스 결함으로도 적지 않는다.** 남는
사실은 **DB 에 현재 게이트가 만들지 않을 과거 행이 있다** 는 것이고, 그 tier 는
`REFERENCE` 라 돈이 움직이는 `EXACT` 버킷에 들어가지 않는다(price-history.ts:644).
🔴 과거 행 재계산은 정책 사안이라 손대지 않았다(§12 의 Historical Alert Integrity 와 같은 경계).

## ④ 실측 — OFF 축은 **전부 측정됐다** (`sample 상품 N=8`)

> CONTROL 4 · 아동복 2 · 테니스 2. 🔴 전부 **실제 HTTP** · DB 쓰기 **0** · upsert 호출 **0**.

```
scope 통과 샵   아동복 **6** · 테니스 **1**
OFF 판정 kind   JUDGED 2 · DROPPED 12 · NO_CANDIDATES 25
OFF tier        EXACT **1**(Pèpè/foretforet) · COMPARISON 1(L.Misha/deuxbebe) · 나머지 없음
국내 상세 fetch  3회 (판정 중 품번 확인 — foretforet 추출기)
```

🔴 **테니스 2건은 후보 0** 이고 그 이유는 선행 WU 가 이미 확정했다 — TENNIS scope
샵이 **1곳(스카이스포츠)** 뿐이고 그 샵의 Sergio Tacchini 교집합이 **0** 이다.
**국내 취급처 부재** 이고 코드 결함이 아니다.

## ③⑤ 비용 — 🔴 ON 축은 **측정 불가** 가 유지됐다

```
Gemini outcome   **API_FAILURE 16/16**
실패 사유        "GoogleDiscoveryApiError: … (402): Payment Required"
                 "Your prepayment credits are depleted."
Gemini API 호출  **16**   ← 🟢 실패한 호출도 집계에 **남았다**
토큰             전부 **0**  ← 402 는 usageMetadata 를 주지 않는다
우리 resolve/fetch  0 · 0   ← 후보가 없으니 우리 비용도 0
```

🟢 **「실패한 호출이 집계에서 사라지지 않는다」가 실증됐다** — `provider` 를
`try` «밖» 에서 만든 설계(production-discovery.ts:87)가 그 목적이었고, 16회가
실제로 기록됐다. 🔴 토큰 0 은 「공짜」가 아니라 **402 가 사용량을 안 준다** 는 뜻이다.

🔴 측정 가능한 범위(CPO ⑤ 요구): `calls` 🟢 · `input/output 토큰` 🟡(성공 시에만) ·
`model` 🟢(`gemini-flash-latest`) · `groundingQueries` 🔴 **계속 측정 불가**.
🔴 **497 환산 하지 않았다.**

🟢 그리고 **ON == OFF 가 N=8 에서 재확인됐다** — Gemini 가 16/16 실패했는데
OFF/ON 판정 결과가 완전히 같았다(`ON 추가 EXACT` **0** · Gemini MI 후보 **0**).
🔴 그 0 을 「Gemini 가 효과 없다」로 읽지 않는다 — **호출이 아예 안 됐다.**

## ⑥ Build — 🟢 **PASS**

```
npx next build  exit **0** · ✓ Compiled successfully in 27.8s
                ✓ Generating static pages (104/104)
```

## ⑦ 회귀 · typecheck · 가드

```
🟢 apps/admin 전체   506 files / **7,534 tests passed** / 52 skipped · failed **0**
🟢 전 패키지 typecheck **10 = baseline 10**
🟢 no-production-coupling **6/6**
🟢 negative test **12/12** (API 가 배열로 바뀌어 단언도 같이 고쳤다)
```

## 🔴 VALIDATION-CLOSE 이후 남은 Known Unknowns

```
🔴🔴 ON 축 전체가 **미측정** — Gemini 선불 크레딧 소진(402). 모델을 바꿔도 안 풀린다
     (grounding 은 flash-lite 에서도 402). 충전은 비용 승인 사안이다
🔴 CONTROL 분모가 **3** 이다(재현 가능한 샵 기준). 일반화 금지
🔴 bobochoses.com 링크 2건은 **구조적 재현 불가** — 실패로도 성공으로도 세지 않았다
🔴 DB 에 현재 게이트가 만들지 않을 **과거 행** 이 있다(최소 1건 확인). 전수는 미측정
🔴 테니스는 scope 샵이 1곳뿐이라 OFF 축이 **구조적으로 0** 이다
🔴 Gemini 후보가 host 별로 쪼개진 뒤의 **실제 판정 분포는 미측정**(후보 0이었다)
```

## 판정 (VALIDATION-CLOSE 기준)

```
Code PASS            🟢      Build PASS            🟢 **exit 0**
Test PASS            🟢      Deploy PASS           🔴 안 함
Type PASS            🟢      Production UI PASS    🔴 해당 없음
🟢 CONTROL           **2/3** Production API PASS   🔴 402 로 ON 축 측정 불가
Production PASS      🔴 아니다 — **IMPLEMENTED / ON-AXIS UNMEASURED**
```

---

# ◆ WU-3 `ON-AXIS-REMEASURE-006` — 🔴 **미착수** (§2 전제 불충족)

> 🔴 지시서 §2 는 「다음 조건이 **모두** 충족된 경우에만 시작한다」다. 하나가 비었다.
> 🔴 **코드 변경 0 · 하니스 변경 0 · 덤프 스크립트 변경 0.** 측정도 돌리지 않았다.

## §2 게이트 실측 (2026-10-13)

| 조건 | 상태 |
|---|---|
| Gemini 선불 크레딧 | 🔴 **402 Payment Required** — "prepayment credits are depleted" |
| `mi-gemini-005` 브랜치 | 🟢 `20eb77af` = 로컬 HEAD 동일 |
| 작업트리 clean | 🟢 0 줄 |
| flag 기본 OFF | 🟢 `=== "true"` 한 곳뿐 |
| Production 미배포 | 🟢 `origin/main` `1f030313` · 증분 67 미반영 |

🔴 **1/5 불충족 → 시작하지 않았다.** 크레딧이 유일한 트리거다.

## 🟢 크레딧 없이 «확정해 둔» 것 셋 (읽기 전용 · 코드 0)

지시서가 요구하지만 Gemini 호출과 무관한 항목이라 미리 닫았다. 크레딧이 오면
보고 25항 중 이 셋은 **이미 채워져 있다.**

### ① §12 비용 산식의 **분모** — 임의 N 을 만들지 않고 실측했다

```
월별 신규 등록 상품   2026-08 **188** · 2026-09 **240** · 2026-10 **72**(진행 중)
전수 500건 / 관측 70일 → 일평균 7.2 · **월환산 215**
→ 산식:  월 비용 = (실측 상품당 Gemini 비용) × **215**
🔴 215 는 «과거 실적» 이다. 사업 계획상 목표 등록량이 다르면 그 수를 쓴다(CPO 확정).
🔴 497 기준은 폐기 상태 유지.
```

### ② §10 샘플 6유형 — **5/6 구조적 충족**, 1개는 사전 보장 불가

```
① 국내 동일상품 후보 존재   🟢 2건 (JUDGED>0)
② 국내 후보 없음            🟢 2건 (전 샵 NO_CANDIDATES — 테니스 2)
③ 운영 링크 보유(CONTROL)   🟢 4건
⑤ Children                  🟢 **6건**      ⑥ Tennis 🟢 **2건**
④ Gemini zero-candidate     🟡 **사전에 고를 수 없다** — 그것은 «측정 결과» 이고
   입력 속성이 아니다. ON 축을 돌린 뒤 사후 분류한다.
   🟢 근거: 선행 WU 에서 Bobo Choses·Bonpoint 가 Gemini 0건이었고 둘 다 현 표본의
      Children 군에 같은 브랜드로 들어 있다 → 발생 가능성은 있다. 🔴 보장은 아니다.
🟢 「성공 사례만 골라 측정하지 않는다」(§10)는 충족 — 현 표본의 OFF tier 는
   EXACT 1 · COMPARISON 1 이고 나머지 6건은 후보가 없거나 떨어졌다.
```

### ③ §14 회귀 baseline — 🔴 **지시서의 숫자를 정정한다**

```
apps/admin   🟢 **506 files passed / 44 skipped (550)** ·
                **7,534 tests passed / 52 skipped (7,586)** · failed 0
packages/crawler  Test **Files** 1 failed / 60 passed / **19 skipped** (80)
                  **Tests 833 passed / 23 skipped (856)** · 실패한 «테스트» 0
🔴 지시서 §14 의 「832+ tests, 19 skipped」는 **19 가 skipped 파일 수** 다
   (skipped 테스트는 **23**). 숫자 축을 섞으면 다음 회차에서 거짓 regression 이 난다.
🔴 crawler 의 파일 1 FAIL 은 **선재 결함** 이다 — 사슬 전건 origin/main 대비 0 변경
   (match-truth-priority.test.ts → apps/admin 깊은 import → `@/lib` alias 미해석).
typecheck  🟢 전 패키지 **10** (listing 5 · pricing 3 · **crawler 2** · admin 0)
guard      🟢 no-production-coupling **6/6**
build      🟢 next build exit 0 · static 104/104
```

## 🔴 재개 명령 (크레딧 확보 직후 · 코드 변경 0)

```bash
cd packages/database && node --env-file=.env scripts/mi-gemini-005-dump.mjs
cd apps/admin && MI_P0_02_LIVE=1 node --env-file=../../scripts/.env   node_modules/vitest/vitest.mjs run   src/app/api/price-history/_lib/__tests__/mi-gemini-005-e2e.test.ts
```

🟢 결과는 `%TEMP%/mi-p0-02/vclose-N.json` 에 **회차별로** 쌓인다(덮어쓰지 않는다).
🔴 모델은 `gemini-flash-latest` 고정 · threshold 변경 금지 · `main` merge/deploy 금지.

---

# ◆ WU-4 `ON-AXIS-REMEASURE-007` — 🟢 완주 · 🔴🔴 **Precision 결함 발견**

> 🟢 Gemini 실제 호출 성공(OK 10/11) · 후보 24개 · MI 판정 전건 도달.
> 🔴🔴 **그런데 「추가 EXACT 4」는 전부 쓸 수 없는 후보다** — 2건 자기참조 · 2건
> 해외 브랜드 공식몰. **합법적 국내 EXACT = 0.**
> 🔴🔴 그리고 **Registration Increment 는 구조적으로 0** 이다(저장이 막혀 있다).
> 🔴 코드·하니스·모델·threshold 변경 **0** · merge/deploy **0**.

## 🔴🔴 ① 자기참조 누출 — 공유 Production 함수의 «선재» 결함

```
원상품  https://www.junioredition.com/collections/bobo-choses/products/booty-ghosts-…
후보    https://www.junioredition.com/products/booty-ghosts-…          ← 같은 샵·같은 상품
원상품  https://www.junioredition.com/en-kr/collections/pepe-shoes/products/lulu-t-bar-…
후보    https://www.junioredition.com/products/lulu-t-bar-…            ← 같은 샵·같은 상품
```

`canonicalListingKey`(self-reference.ts:70)가 **host·대소문자·끝슬래시·식별 쿼리만**
정규화하고 **Shopify `/collections/<c>/` 접두사와 `/en-kr/` 로케일 접두사를 떼지
않는다.** → `origin.host === candidate.host` 는 참인데 `key` 가 달라
`isSelfReferenceCandidate` 가 **false** 를 낸다.

🔴 **이 결함은 내 배선이 만든 것이 아니라 드러낸 것이다.** 국내 경로에서는 원상품
host(smallable/junioredition)와 국내 Cafe24 샵 host 가 겹칠 일이 없어 **잠복** 했다.
Gemini 는 웹 전체를 보므로 **원상품 host 자체를 후보로 물어온다** → 누출이 발화한다.

🔴 실측 누출 **4/24 (17%)** — 전부 「원상품 host == 후보 host」:
```
Booty Ghosts  junioredition → junioredition        tier **EXACT**
Lulu T Bar    junioredition → junioredition        tier **EXACT**
Damarindo     tennis-warehouse → tennis-warehouse  tier COMPARISON
Cericho       tennis-warehouse → tennis-warehouse  tier COMPARISON
```

## 🔴🔴 ② 「추가 EXACT 4」의 정체 — **합법적 국내 EXACT 는 0**

| 원상품 | 후보 host | tier | 판정 |
|---|---|---|---|
| Booty Ghosts | `junioredition.com` | EXACT | 🔴 **자기참조** |
| Lulu T Bar | `junioredition.com` | EXACT | 🔴 **자기참조** |
| Booty Ghosts | `bobochoses.com` | EXACT | 🔴 브랜드 공식몰(해외 · 등록부 **disabled**) |
| All About Monsters | `bobochoses.com` | EXACT | 🔴 브랜드 공식몰(해외 · 등록부 **disabled**) |

🔴 `domestic_product_links` 는 **국내 판매처** 표다. 위 넷 중 국내 판매처는 **없다.**
🔴 그러므로 **「추가 EXACT +4」를 Recall 개선으로 보고하지 않는다.**

## 🟢 ③ 그런데 «국내» 후보를 실제로 찾아냈다 — 그쪽이 진짜 증거다

```
🟢 looxloo.com(등록부 O) · rulii.co.kr(O) · littleluna.co.kr(O) ·
   en.petitlouie.co.kr · littlebae.shop
🔴 musinsa.com — 포털/오픈마켓이라 **약관상 대상 아님**
```
🔴 그런데 그 국내 후보들의 tier 는 **EXACT 가 아니다** — `COMPARISON`/`(없음)`/`EXCLUDED` 다.
🟢 즉 **Discovery 는 늘었고 MI 도 돌았지만, 돈이 움직이는 EXACT 버킷에는 국내 후보가
   한 건도 못 들어왔다**(price-history.ts:644 — `exact.sellerCount>0` 이면 COMPARISON 무시).

## 🔴🔴 ④ Registration Increment = **0 (구조적)**

```
Gemini 후보 → withConfidence → judgeDomesticCandidate → 🔴 **여기서 continue**
  (가상 shopId 는 upsert 전에 걸러진다 — §5/§19 「영구 저장 금지」가 요구한 동작)
→ linksCreatedOrUpdated 에 **안 들어간다** · price_observations 에 **안 쓴다**
→ UI/가격비교/등록판단에 **닿는 경로가 없다**
```
🔴 그래서 **flag 를 켜도 등록 판단은 바뀌지 않는다.** 버그가 아니라 지시서가 요구한
   「temporary candidate pool」의 **논리적 귀결** 이다.
🔴 §9 ③ 의 답: Registration Increment **0**. 「측정했더니 0」이 아니라 **설계상 0** 이다.

## 비용 — 2차 완주분만 (🔴 1차와 합산하지 않았다)

```
실행 창(UTC)  2차 02:23:27 → 02:36:08 (12분 41초)
모델          gemini-flash-latest
API 호출      **11** (OK **10** · API_FAILURE **1** = TimeoutError)
토큰          prompt **13,600** · candidates **11,253** · thoughts **18,362** · total **43,215**
우리 HTTP     resolve **61** · fetch **90** · 국내 상세 fetch **8**  ← 🔴 Gemini 비용과 분리
완주 상품     **8**
상품당        호출 **1.38** · total **5,402** · prompt 1,700 · candidates 1,407 · thoughts 2,295
🔴 cachedContentTokenCount  집계 **제외**(타입이 그 칸을 선언하지 않는다 · probe 1,400 관측)
🔴 grounding 쿼리  **실행별 metrics 로 보존되지 않는다** — 참고 추정 10 × 6 ≈ **60**
                   (🔴 6 은 probe sample **N=1**)
```

### 🔴 CPO 정정(§10) — 두 주장을 섞어 쓰지 않는다

```
❌ 「Gemini 응답에 webSearchQueries 가 없어서 버려진다」
✅ `webSearchQueries` 는 **probe 응답에서 실제로 관측됐다**(6개).
   다만 현재 Production 타입/집계 경로(`GeminiGroundingResponse` ·
   `GoogleDiscoveryUsage`)가 그 칸을 담지 않아 **실행별 metrics 로 보존되지 않는다.**
   → 그래서 이 WU 에서는 **AI Studio billing 을 ground truth 로 쓴다.**
🔴 「응답에 없다」와 「우리가 보존하지 않는다」는 **서로 다른 주장** 이다.
```

### 1차(SIGTERM) — 🔴 비용 KPI 에서 제외
```
결과 파일 없음 · 정확한 호출/토큰 **복원 불가**(metrics 를 종료 시점에만 쓴다)
상한   API 호출 4~10회 · grounding 24~60개 · 데이터 산출 **0**
```

## 효과 집계 (2차 · `sample 상품 N=8`)

```
Gemini MI 후보 **24** (상품당 3 = maxCandidates 상한에 전건 도달)
crossSellerVerdict  SAME **4** · PRESUMED_SAME **9** · SIMILAR 5 · CONFLICT 3 · UNKNOWN 1
tier(judgeDomesticCandidate)  EXACT 4 · COMPARISON 9 · EXCLUDED 2 · 나머지 (없음)
OFF tier       EXACT **1**(Pèpè/foretforet) · COMPARISON 1(L.Misha/deuxbebe)
zero-candidate **0/8** — 🔴 사전 선정하지 않았고 발생하지 않았다(정상)
API failure    1 (TimeoutError · Children 1건)
```

## Decision Increment 3분리

```
① Discovery   🟢 **있다** — OFF 가 못 낸 국내 샵 상품페이지를 Gemini 가 냈다
② MI          🟢 **있다** — 24건 전건 판정 도달 · SAME 4 · PRESUMED_SAME 9
③ Registration 🔴 **0 (구조적)** — 저장이 막혀 하류에 닿지 않는다
🔴 그리고 ①②의 품질에 결함이 있다: 누출 4/24 · EXACT 4건 전부 사용 불가
```

## §16 검증 — 전부 baseline

```
🟢 admin regression  506 files / **7,534 passed** / 52 skipped · exit 0 · failed 0
🟢 typecheck         **10 = baseline 10**
🟢 guard             no-production-coupling **6/6**
🟢 build             exit 0 · Compiled successfully 39.8s · static 104
🟢 git               clean · HEAD `d1d46ec9` · `origin/main` `1f030313`(미변경)
🟢 DB                schema 0 · 영구 URL 저장 0 · upsert 호출 **0** · 가격추적 0
🟢 flag              기본 OFF 유지
```

## 🔴 CTO 기술 의견 (CPO 판정 입력 — 판정은 CPO 몫)

```
① §10 네 단계 중 **STOP 은 아니다**(비용 이상징후 없음: 상품당 1.38 호출 · 5,402 토큰).
   🔴 그러나 **PASS 도 아니다** — Registration Increment 0 · EXACT 4건 전부 사용 불가.
   🟢 현 데이터에는 **HOLD** 가 가장 맞는다고 본다.
② 🔴 자기참조 누출은 **Gemini 를 켜기 전에 닫아야 한다.** 고칠 자리는 한 곳이다 —
   `canonicalListingKey` 에 Shopify `/collections/<c>/`·로케일 접두사 정규화 추가.
   🔴 공유 함수라 영향 범위 조사 + 음성 대조 필요 → **별 WU**.
③ 🔴 「국내 후보를 찾았는데 EXACT 에 못 들어온다」가 다음 진짜 질문이다.
   🔴 단 threshold 완화로 풀지 않는다(금지 사항).
④ 🔴 Registration Increment 를 0 이 아니게 하려면 **저장 정책을 바꿔야** 하고,
   그것은 §5/§19 금지와 정면 충돌이므로 **CPO 정책 결정** 이다.
```

---

# ◆ WU-010 `REGISTRATION-CONSUMER-010` — 🔴🔴 **BLOCKED (구현하지 않았다)**

> 🔴 consumer 를 찾았다. 🔴🔴 **그런데 지금 연결하면 제품이 셀러에게 거짓을 말한다.**
> 🔴 그래서 코드를 **한 줄도 바꾸지 않았다**(지시서 §16 「코드로 우회하지 말고 보고」).
> 🟢 막는 것은 하나이고, 그것을 푸는 owner 도 이미 리포에 있다.

## ① consumer 는 찾았다 — 사슬 전체

```
computeMarketIntelligence (market-intelligence.ts:82)
  :501  computeSellerAction(...)            ← 가격 집계만 받는다(후보 배열 아님)
  :540  computeSellability({ costPriceKrw, domestic:{ matched, averagePriceKrw } })
  :552  deriveRepresentativeSellerVerdict(...)   ← 🔴🔴 **여기가 실제 등록 판단이다**
        (packages/pricing/src/representative-seller-decision.ts:175)
  :574  toSellerFacingVerdict(...) → sellerFacingVerdict (최종 3단계)
```

🟢 「동일상품이 국내에 있는가」가 들어가는 슬롯도 찾았다 —
`RepresentativeVerdictInput`(representative-seller-decision.ts:54)의
`domesticMatched` · `domesticSellerCount` · `domesticBasis` · `domesticLowestPriceKrw`.

## ②🔴🔴 그 슬롯은 **전부 「가격 보유」 의미** 다 — 그래서 넣을 수 없다

owner 가 그 의미를 **문구로 못박아** 뒀다(`domesticReason`, :117-123):

```
!domesticMatched            → 「국내 동일상품을 자동으로 찾지 못함」
domesticBasis === "EXACT"   → 「국내 동일상품 {N}곳에서 **가격 확인됨**」
그 외                        → 「… 비교상품(참고용) {N}곳 **시장가격 기준**」
```

그리고 `VERDICT_COPY.READY` 도 「국내 시장에서 **동일상품 가격을 확인했습니다**」다.

🔴🔴 **Gemini 후보에는 가격이 없다.** 전수 확인:
```
gemini-candidate-pool.ts 에 price 어휘 **0건**(grep)
GeminiTransientEvidence 에도 가격 칸이 **없다**
WU-4 기록과 일치 — 「후보 가격은 이 경로에서 전건 null(product-url-facts 의 의도된 동작)」
```

→ 가격 없는 증거를 `domesticMatched = true` 로 넣으면 화면이
**「국내 동일상품 N곳에서 가격 확인됨」** 이라고 말한다. **확인된 가격이 없는데.**
🔴 헌장 §4 가 금지하는 바로 그것이다 — 「부분 구현으로 화면이 거짓말하게 만들지 않는다」.
🔴 `computeSellability` 는 더 직접적이다 — `matched:true` + `averagePriceKrw:null` 이
   들어간다(마진을 계산할 수 없는 상태에서 「매칭됨」).

## ③ 그래서 이 WU 의 성공 조건은 **현재 계약에서 달성 불가** 다

```
지시서 요구   「기존 MI evidence + Gemini transient evidence → 기존 판단 규칙」
🔴 현재 계약  그 입력 슬롯이 **가격 보유 증거만** 받는다
→ 「기존 규칙 그대로」를 지키면서 Gemini 를 넣을 자리가 **없다**
→ 넣으려면 ⒜ 규칙/문구를 바꾸거나(=기존 정책 변경 · 금지)
           ⒝ 별도 슬롯을 신설하거나(=새 판정 입력 · 사실상 새 규칙)
           ⒞ **Gemini 후보에 가격을 붙인다**
```

## ④🟢 ⒞ 의 owner 가 이미 있다 — 다음 WU 는 한 걸음이다

```
enrichCandidatePrices   packages/crawler/src/comparison-search/price-source-adapter.ts:243
🔴 운영 호출부 **0** (apps/admin 전수 grep · 테스트 제외) — 배선만 없다
🟢 WU-4 Known Unknowns 가 이미 이것을 가리켰다:
   「가격 비교까지 가려면 `enrichCandidatePrices` 가 더 필요하다」
```

가격이 붙으면 Gemini 증거가 **기존 계약과 호환**된다 → 그때 `domesticMatched`/
`sellerCount`/`lowestPriceKrw` 슬롯에 **기존 규칙 그대로** 들어갈 수 있고,
화면 문구도 거짓이 아니게 된다.

🔴 **단 그것은 외부 HTTP 비용이 늘어나는 변경이고 CPO 승인 사안이다.**
🔴 그리고 WU-4 가 남긴 더 앞선 문제가 그대로 있다 — **유효 국내 EXACT = 0**
   (Gemini 가 낸 국내 host 들의 tier 는 COMPARISON/EXCLUDED 였다). 즉 가격을
   붙여도 **EXACT 버킷에는 여전히 안 들어갈 가능성이 높다**(미측정).

## ⑤ 이 WU 에서 한 일 / 하지 않은 일

```
🟢 한 일    consumer 사슬 전수 확인 · 입력 계약 전수 확인 · 가격 부재 전수 확인 ·
            차단 사유를 owner 의 «문구» 로 확증 · 해결 owner 위치 확인
🔴 안 한 일 **코드 변경 0** · 테스트 추가 0 · 배선 0 · merge 0 · deploy 0
            🔴 `domesticMatched` 에 Gemini 를 넣는 구현을 **의도적으로 하지 않았다**
```

## 판정

```
consumer 식별       🟢 PASS
연결 구현           🔴 **BLOCKED** — 지금 연결하면 화면이 거짓을 말한다
Production          변경 0 · 미배포
🔴 CPO 결정 필요    ⒞ Gemini 후보 가격 보강(enrichCandidatePrices 배선)을 할 것인가.
                    🔴 외부 HTTP 비용 증가 · 그리고 유효 국내 EXACT 0 문제는 별개로 남는다
```
