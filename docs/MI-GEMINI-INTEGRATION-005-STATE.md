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
