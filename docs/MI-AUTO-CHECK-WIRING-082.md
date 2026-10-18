# WU-082 — 국내 가격비교 미노출 원인 + 시장조사 카테고리 의존성

> 🔴 CPO 지시 2026-10-18. 「① 국내 가격비교 미노출 **원인부터 확정** → 최소 수정 →
> 실제 E2E · ② 시장조사 카테고리 **사용 여부 확정** → 불필요하면 제거」
> 🔴 보호계약(COLOR/TITLE/MODEL_CODE/LINE/MARKET/PRICE/LANGUAGE/BRAND) 전부 유지.

---

# WU-082 FINAL

## 1. 국내 가격비교 미노출 원인 — 🔴🔴 **확정**

CPO §1 의 분기 질문 — 「후보가 없어서인가, 응답엔 있는데 UI 에서 안 보이는가」:

```
🔴 **응답엔 있는데 «화면까지 오지 않았다».** 후보 부족이 아니다.

원인 위치: apps/admin/src/app/pipeline/page.tsx:465
  void fetch("/api/price-history/check", { … })
    .catch(() => { … })      ← 🔴 **body 를 읽지 않는다**
    .finally(() => { … })

⟹ 분석 직후 자동 1회차의 응답에만 들어 있는 **참고 축(transient)** —
   `domesticReference` · `overseasReference` · `domesticShop.urlCandidateEvidence` —
   이 **통째로 버려졌다.**
⟹ 패널은 그 뒤 GET `/api/price-history/[id]` 로만 그리는데
   **GET 경로는 transient 를 넘기지 않는다**(WU-049/056 이 적어 둔 구조).
⟹ 셀러가 「🔄 다시 분석」을 **누르기 전까지 국내 가격비교가 화면에 존재하지 않는다.**
```

🟢 **WU-022 설계 문서가 이 구멍을 예고했다** — 「⒝ 자동 1회차(page.tsx) 포함 여부」를
**CPO 결정 사항**으로 남기고 당시 제외했다. 이번이 그 자리다.

🔴 **WU-081 의 E2E 와 production 이 갈린 이유도 이것이다** — WU-081 은 패널에 값이
**도달한 상태** 를 마운트해 검증했고, production 은 그 값이 **도달하지 못했다**.
🟢 WU-081 자체는 틀리지 않았다(그 조건에서의 렌더는 정확했다). **분모가 달랐다.**

## 2~4. 해외 ↔ 국내 1:1 대조 (코드 owner 기준)

| 항목 | 해외 | 국내 |
|---|---|---|
| candidate 전달 | `candidateOverseasEvidence`(MI) | 같은 배열, `market` 으로 갈림 |
| market 조건 | `OVERSEAS`/`UNKNOWN` | **`KR` 만** |
| priceTier | 금액 집계에서 `EXCLUDED` 제외(WU-062) | 적재 시 `EXACT\|COMPARISON` 만 |
| priceStatus | `VERIFIED_CURRENT` 필요 | 동일 |
| aggregation | `summarizeCandidateOverseasPrices` | `candidateDomesticPrice` |
| **응답 칸** | `overseasReference` | `domesticReference` |
| **전달 경로** | 🔴 **둘 다 POST `/check` 응답에만** 있다 | 동일 |
| UI 조건 | `OverseasReferencePrice summary != null` | 동일 + 🇰🇷 구역(WU-081) |
| empty state | 없음(구역 자체가 안 뜸) | 🟢 WU-081 이 추가 |

🔴 **즉 국내만의 문제가 아니었다** — **해외 참고가격도 같은 이유로 자동 1회차에서
보이지 않았다.** 이번 수정이 둘 다 고친다.

## 5~7. 시장조사 카테고리 — 🔴 **실제로 쓰인다. 제거하지 않았다**

전수 추적(소스 grep · 추정 0):

```
① 어느 국내 샵을 뒤질지  resolveMarketCategoryScopes(product, marketCategoryProfileId)
     check/route.ts:100 · trigger-domestic-price-check.ts:76 → `categoryScopes`
② 해외 비교 scope        comparison/search/route.ts:84 selectedMarketSourceScopes(…)
③ 🔴 **원가 정책**       market-intelligence.ts:568 resolveCategoryCostPolicy(…)
④ 저장                   snapshots/route.ts:85 → workspace.marketCategoryProfileId
⑤ 게이트                 pipeline/page.tsx:530 「시장조사 카테고리를 먼저 선택해 주세요」
```

🔴 **③ 이 결정적이다 — 카테고리가 «가격 계산» 에 들어간다.** 표시용 값이 아니다.
🔴 그리고 `types.ts:66` 이 그 이유를 적어 뒀다: 「이 값이 **어느 사이트를 조사할
것인가** 를 정한다 … /check 가 이 값을 못 읽으면 **첫 조사와 재확인이 다른 사이트를
뒤진다**」.

🟢 **다만 CPO 의 체감은 정확하다** — **셀러가 URL 을 직접 주는 경로**
(`collectUrlCandidatePool` · WU-024)는 카테고리를 **쓰지 않는다**(전수 grep **0**).
🔴 그러나 그 경로만 떼어 낼 수 없다 — **같은 분석 1회가 ①②③ 을 함께 돌린다.**

### 판정 — §4 제거 GO 조건 **A 불충족** ⟹ **유지**

```
A 후보 생성에 사용되지 않음   🔴 **거짓**(① 국내 샵 scope)
A 가격에 사용되지 않음        🔴 **거짓**(③ 원가 정책)
⟹ 제거하면 「아무 데도 안 뒤진」 또는 「전부 뒤진」 결과가 나오고 원가 정책이 바뀐다.
🟢 §9 의 「실제 사용됨 → 유지 + 사용 owner 보고」에 해당한다.
```

## 8. 변경 파일 — 운영 **3 파일 · 약 +35줄**

```
pipeline/page.tsx                      자동 1회차 응답을 **읽는다**(.then) + state + prop
                                       🟢 **새 호출 0** — 이미 보내던 요청이다
pipeline/CommerceWorkspace.tsx         prop 통과 (기존 `priceCheckPriming` 과 같은 길)
commerce/DomesticPriceIntelligencePanel.tsx  prop + effect 로 참고 축 4개 set
🔴 API 0 · schema 0 · DB 0 · MI 0 · 가격 0 · 시장 0 · 집계 0 · AI 0
```

🔴 **stale-guard 를 그대로 쓴다** — `productRef.current?.sourceUrl === requestedForSourceUrl`
(기존 `.finally` 와 같은 기준). 다른 상품의 응답이 현재 화면에 붙지 않는다.

## 9. Mutation / producer-level contract

baseline **29 passed**(wiring 10 + render 4 + WU-030 15)

| | 변형 | 결과 |
|---|---|---|
| W1 | 응답을 **다시 버린다** | 🔴 **1 failed** |
| W2 | Workspace 로 전달 끊기 | 🔴 **1 failed** |
| W3 | 누적(`prev ??`) 의미로 되돌리기 | 🔴 **3 failed** |
| W4 | effect 가드 무력화 | 🔴 **1 failed** |
| W5 | 후보 축만 누락 | 🔴 **2 failed** |
| — | 원상복구 | 🟢 29 passed |

### 🔴🔴 이 WU 에서 하니스를 **두 번** 고쳤다

```
⒜ 1차 render 테스트가 **틀린 컴포넌트**(MiPanelView)를 마운트했다 — effect 는
   **바깥 패널** 에 있다. 🔴 바깥 패널은 GET 데이터 없이는 본문을 안 그려서
   (P-18 「확인 중」) 마운트로 못 본다. 🟢 그래서 effect 는 **소스 계약** 이 잠그고,
   보고서에 「마운트로 봤다」고 **적지 않는다**.
⒝ 🔴🔴 **변이 5개가 전부 「통과」로 나왔다 — 하니스가 로드조차 안 됐다.**
   정규식 이스케이프가 편집 층을 지나며 깨져 transform 이 실패했다(이 트랙 **다섯 번째**).
   🟢 문자열 포함으로 바꿔 고쳤고, 그 뒤 **W1~W5 가 전부 FAIL** 한다.
   🔴 「전부 통과」를 그대로 보고했으면 **거짓 보고** 였다.
```

## 10~11. E2E — 🔴 **설계가 CEO 의 보고와 일치한다**

```
BEFORE(마운트 DOM 으로 재현) — 참고 축 prop 이 없으면
  `domestic-reference` **없음** · `domestic-review-transient` **없음** · empty state **없음**
  ⟹ 🔴 **CEO 가 본 화면이 정확히 이것이다.**
AFTER — 참고 축이 오면
  🟢 🇰🇷 국내 참고가격(₩88,000) · 🇰🇷 국내 후보 검토(비스킷) · 후보 0 이면 empty state
```

🔴 **production 실화면은 CEO 확인이 필요하다** — 자동 1회차가 실제로 국내 후보를
만들어 내는지는 그 상품/카테고리에 달려 있고 CTO 는 로그인 뒤 화면을 볼 수 없다.

## 12~14. regression / typecheck / build

```
apps/admin  **593 files / 8,327 passed** / failed **0** (skipped 101)
typecheck **0** · build **exit 0**
🟢 WU-081 baseline(591/8,313)에서 **+2 file / +14 test**
```

### 🔴 회귀가 **진짜 결함을 잡았다** (§10 포착)

```
wu-030-abc-continuous-analysis › 「transient state 는 확인할 때마다 덮어쓴다 — 누적되지 않는다」
🔴🔴 **내 1차 구현이 실제로 그 계약을 깼다** — `setGeminiEvidence((prev) => prev ?? …)`
   를 썼고, 그러면 **상품 A 의 후보가 상품 B 화면에 남는다.**
🟢 고쳤다 — 덮어쓰기로 바꿨다. 그리고 `prev` 는 **애초에 필요 없었다**:
   이 effect 는 `autoCheckResult` 가 **바뀔 때만** 돌고 「🔄 다시 분석」은 그 값을
   바꾸지 않는다(그 POST 는 패널 자신의 핸들러가 직접 set 한다).
🔴 WU-030 계약이 **내 설계 실수를 잡았다** — 그 계약을 고치지 않고 **내 코드를** 고쳤다.
```

## 15. Git / Production

push 완료 · `clean` · `behind/ahead 0 0` · Production **200**.

## 16. 🟢 **GO**

```
① 국내 가격비교 미노출  🟢 **원인 확정 + 최소 수정**(새 호출 0 · API 0 · schema 0)
② 시장조사 카테고리     🔴 **유지** — 실제 사용(국내 scope · 해외 scope · **원가 정책**)
Code PASS 🟢  Test 🟢  Type 🟢  Build 🟢  Deploy 🟢
Production UI PASS 🔴 **CEO 확인 대기**
```

🔴 **Known Unknowns**
```
① 🔴 자동 1회차가 **실제로 국내 후보를 만드는지** 는 상품/카테고리에 달렸다 — 미확인
② 🔴 effect 는 소스 계약으로만 잠겼다(바깥 패널을 마운트할 수 없었다)
③ 🔴 카테고리 UI 의 **중복 입력 체감** 은 유효하다 — 그러나 제거 조건이 불충족이다.
   「URL 직접 입력 경로에서만 분리」는 **같은 분석 1회가 셋을 함께 돌려서** 불가능하다
④ 🔴 해외 참고가격도 같은 이유로 안 보였을 것이다 — 이번 수정이 같이 고치지만
   **그 전 상태를 production 에서 관측하지는 않았다**
```

## 17. CEO Action — **Production UI 1회 확인**

```
URL   https://ttaejyo.vercel.app/pipeline   (로그인 필요)

A. 「🔄 다시 분석」을 «누르지 않고» 확인
 ① 새 상품 URL 로 분석을 시작한다(시장조사 카테고리는 평소대로 선택)
 ② 분석이 끝나면 MI 패널을 본다
 기대 🟢 **🇰🇷 국내 참고가격** 또는 **🇰🇷 국내 후보 검토** 구역이
     「다시 분석」을 누르지 «않아도» 보인다
     🟢 국내 후보가 없으면 **「국내 비교 후보가 없습니다」** 가 보인다
 🔴 BEFORE 에는 이 구역들이 **아예 없었다** — 그 차이가 이번 수정의 전부다

B. 이어서 WU-081 검토 UI (같은 화면)
 ③ 「🔄 다시 분석」 입력칸(2단 접힘 뒤)에 국내 상품 URL 을 넣고 다시 분석
 기대 🟢 🇰🇷 구역에 후보 행 + 「CEO 검토 [동일상품][다른 상품]」
     🟢 [동일상품] 클릭 → 「검토 결과: ✅ 동일상품」
     🔴 그때 우리 판단·가격·국내 최저가·판매판정이 **하나도 바뀌지 않아야 한다**

FAIL 로 볼 것
 🔴 A 에서 여전히 국내 구역이 **아예 없다**
 🔴 상품을 바꿨는데 **이전 상품의 후보가 남아 있다**
 🔴 검토 클릭이 판정/가격을 바꾼다

🔴 검토 결과와 참고가격은 **저장되지 않습니다**(새로고침 시 사라짐 · 의도된 동작).
```
