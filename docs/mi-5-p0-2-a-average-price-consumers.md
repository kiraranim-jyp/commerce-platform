# MI-5 / P0-2-A — 평균가 consumer 전수 + 최저가 통일 시 변경 범위

> CTO 조사 보고(2026-09-26). **P0-2-A 는 코드를 바꾸지 않았다.**
> (같은 커밋의 P0-2-B = `analysisMarketCountry` 정합성 수정은 별개 작업이다.)

## A. `averagePriceKrw` 를 읽는 곳 — 전수

생산은 한 곳이다: `summarizeFrom`(price-history.ts:535) — `lowestPriceKrw` ·
`averagePriceKrw` · `highestPriceKrw` 를 같은 표본에서 한 객체로 낸다. 🔴 **둘은
항상 함께 null 이거나 함께 값이 있다**(판단 시장을 못 고르면 셋 다 null) — 이
사실이 아래 「통일 시 YELLOW 는 안 움직인다」의 근거다.

| # | 읽는 곳 | 평균가의 역할 | 판정을 바꾸는가 |
|---|---|---|---|
1 | `computeSellability`(sellability.ts:54·64) | 마진 분모 = **잠정 판매가** | 🔴 **예** — GREEN/RED 경계 |
2 | `computePriceDecision`(price-decision.ts:104·143) | `priceGapVsAveragePercent` | 🔴 **예** — CONSIDER_LOWER 게이트 |
3 | `computeRadar`(radar.ts:155) | 가격경쟁력 **구간 상단 경계** | 🔴 **예** — HIGH/MEDIUM/LOW |
4 | `buildHeadlineNumbers`(mi-headline.ts:83) | 헤드라인 **대표 가격** | 표시(값이 바뀜) |
5 | `buildMarketContext`(price-hierarchy.ts:988) | 대표값(①평균 ②최저) | 표시(값이 바뀜) |
6 | `computeUnifiedPriceDecision` → `domesticCompetitivePrice.average` | 근거 표기 | 아니다 |
7 | API 응답 `domesticCompetition` · `domesticMarketSplit.{exact,comparison,resolved}` | 원자료 | 아니다 |
8 | `computePriceRecommendation`(price-recommendation.ts:47) | 🔴 **본문에서 한 번도 읽지 않는다** | 아니다 |
9 | `computeSellerAction`(seller-action.ts:63·66) | 🔴 **본문에서 한 번도 읽지 않는다** | 아니다 |

🔴 **8·9 는 「죽은 입력」이다.** 특히 8 이 중요하다 — **CASE 는 평균가를 읽지
않는다.** 「CASE = 최저가」는 주석의 주장이 아니라 코드의 사실이다.

### 🔴 A-1. 평균가가 «판단 기준» 인 세 곳은 서로 다른 질문에 답한다

```
① sellability     평균가 = 잠정 판매가      「등록해도 되나」   판매가 없어도 작동
② priceDecision   평균가 = 비교 상대        「내 가격이 비싼가」 판매가 «필수»
③ radar           평균가 = 구간 경계        「경쟁력 몇 등급」   최저가와 «함께» 쓴다
```

②는 프로덕션에서 사실상 돌지 않는다(`currentSellingPriceKrw` 가 채워진 스냅샷이
거의 없다 — representative-seller-decision.ts:11-17 의 실측 근거와 같다).
③은 평균가를 **최저가와 둘 다** 써서 3단계를 만든다 — 최저가로 통일하면 등급
하나가 사라진다(§C-4).

## B. 연쇄 — 어디까지 흐르고, 등록을 막는가

```
averagePriceKrw
   ├─① computeSellability ─ level ─┬─ /today 배지 「판매판단 🟢/🟡/🔴」  ← 🔴 날것
   │                               └─ representativeVerdict(base)
   │                                     ↓ applyMarketCaseGuard(marketCase)   ← 최저가 축
   │                                  sellerFacingVerdict → buildSellerDecision
   │                                     ↓ 상품 상세 헤드라인
   ├─② computePriceDecision ─ priceLevel ─ 대시보드 「가격 🟢/🟡/🔴」
   ├─③ computeRadar ─ 가격경쟁력 축
   └─④⑤ 헤드라인/대표값 숫자

등록 게이트  resolveRegistrationReadinessState(readiness-state.ts:37-47)
             = priceValid(크롤 가격 유효성) + kcStatus + 필수항목 통과
```

### 🟢 B-1. 등록을 막는 조건에 닿지 않는다 — 확인 완료

`resolveRegistrationReadinessState` 는 **세 값만** 본다: `priceValid`(=
`product.priceValidity === "VALID"`, 원문 가격을 읽었는가 — 시장가 판정이 아니다) ·
`kcStatus` · `summary.allRequiredPassed`. `buildPriorityItems` 도 같다.
**sellability · CASE · 평균가 · 최저가 중 어느 것도 등록 버튼·게이트·disabled 에
닿지 않는다**(전수 확인). 🔴 그래서 P0-2 는 **「등록을 막느냐」가 아니라 「무엇을
보여주느냐」의 문제**다 — 판단이 틀려도 등록은 그대로 되고, 셀러는 그 말을 믿고
스스로 등록한다.

### 🔴 B-2. CASE 가 평균가의 낙관을 «덮는» 곳과 «덮지 않는» 곳

`applyMarketCaseGuard`(representative-seller-decision.ts:140-173)는 READY /
MARKET_OPPORTUNITY 로 확정되려는 판정을 **최저가 기반 CASE** 로 다시 검사한다 —
CASE C → HOLD, CASE B → REVIEW_PRICE. **즉 상품 상세의 헤드라인에서는 최저가가
이미 평균가를 덮고 있다.**

🔴 덮지 못하는 세 구간:

| 구간 | 왜 안 덮이나 | 결과 |
|---|---|---|
**대시보드(/today)** | `compute-readiness.ts` 는 `computePriceRecommendation` 도 `deriveRepresentativeSellerVerdict` 도 **부르지 않는다** | 평균가 판정이 「판매판단 🟢 판매 추천」으로 **날것으로** 나간다 |
`marketCase == null` | 착지원가를 못 만든 상품(recommendation=null) | guard 가 통과 → 🟢 로 확정 |
`REVIEW_MATCH` 경로 | guard 는 READY/MARKET_OPPORTUNITY 만 본다 | 이 경로는 CASE D 라 오늘은 무해(구조적으로는 구멍) |

🔴 **그러니 「평균가 낙관」이 실제로 셀러에게 도달하는 주 경로는 대시보드다.**
같은 상품이 목록에서는 🟢, 상세로 들어가면 🟡/🔴 가 될 수 있다.

## C. 최저가로 통일하면 «실제로» 무엇이 바뀌는가

sellability 의 분모만 평균가 → 최저가로 바꿨다고 가정한다(평균가 ≥ 최저가).

1. **level 전이는 GREEN → RED 한 방향뿐이다.** YELLOW/UNKNOWN 모집단은 한 건도
   움직이지 않는다 — 최저가와 평균가는 항상 함께 null 이므로(§A).
2. **`/today` 배지: 바뀐다.** 🟢 판매 추천 → 🔴 판매 비추천. 유일하게 날것으로
   보이는 자리라 체감 변화가 가장 크다.
3. **상품 상세 헤드라인: 대부분 안 바뀐다** — 이미 CASE 가 덮고 있다.
   * CASE A: 목표마진(기본 **20%**)을 최저가에서 확보한다는 뜻 → 최저가 마진도
     10% 문턱 위 → sellability 는 여전히 GREEN. **변화 없음.**
   * CASE B: 지금도 guard 가 REVIEW_PRICE 로 낮춘다. **변화 없음.**
   * 🔴 **CASE C: 후퇴할 수 있다.** 지금은 guard 가 HOLD(🔴)로 만든다. 통일 후엔
     최저가 마진이 0% 이상이면 `REVIEW_PRICE`(🟡)가 된다 — 최저가가 원가보다는
     높고 **착지원가보다는 낮은** 구간이다. 즉 **단순 치환은 판정을 약화시킨다.**
   * `marketCase == null`: 여기서는 **강화된다**(🟢 → 🟡/🔴). 실질 개선 구간.
   * 🔴 `basis ≠ EXACT`(상세는 비교상품 평균가를 쓴다, §D-1): 통일하면 **비교상품
     최저가만으로 HOLD(판매 비추천)** 가 나올 수 있다 — P-26 이 명시적으로
     금지한 「검증되지 않은 유사상품 가격으로 판매 비추천 확정」이다.
4. **radar 가격경쟁력 축: 등급이 줄어든다.** 평균가는 MEDIUM 의 상단 경계다
   (radar.ts:155) — 최저가로 통일하면 HIGH/LOW 두 단계만 남는다. 설계 변경이다.
5. **헤드라인·대표값 숫자: 바뀐다.** 🔴 그런데 **반대 방향의 기록이 있다** —
   `pickTargetMarketPrice`(mi-headline.ts:75-78, UX-1D):
   > ① 평균가 — **최저가는 이상치 한 건에 끌려갈 수 있어 대표값으로 쓰지 않는다**
   `buildMarketContext`(price-hierarchy.ts:989)도 같은 우선순위다. 「최저가로
   통일」 제안과 **정면으로 충돌하는 기존 근거**이므로 그냥 덮지 않는다.
6. **`computePriceDecision`(②)은 같이 바꾸면 안 된다.** 그 함수의 평균가는
   「내 판매가가 시장 평균보다 비싼가」이고 문턱이 **5%** 다(price-decision.ts:70).
   최저가로 바꾸면 최저가보다 5% 넘게 비싼 거의 모든 상품이 CONSIDER_LOWER 가
   된다 — P-26 도 이 함수는 건드리지 않았다.
7. **등록 가능 여부: 바뀌지 않는다**(§B-1).

### 🔴 C-1. 가격만 통일해도 두 판정은 여전히 일치하지 않는다

```
sellability   마진 = (평균가 − costPriceKrw)      / 평균가     ← 원가, 배송비 «없음»
CASE          손익 = 최저가 − landedCostKrw − 예상수수료        ← 착지원가 + 수수료
```

🔴 **비대칭이 두 축이다 — 가격(평균 vs 최저)과 원가(원가 vs 착지원가).** 가격
한 축만 맞추면 sellability 는 여전히 CASE 보다 낙관적이다(국제배송비만큼).
P-29 주석이 이미 같은 사실을 적어 두었다("국내 평균가 기준, **국제배송비
미포함**", representative-seller-decision.ts:212). **7-2 를 「최저가로 통일」로만
좁히면 이 축이 남는다.**

## D. 이번 조사에서 «새로» 발견한 것

### 🔴 D-1. sellability 입력 버킷이 두 곳에서 다르다 — P0-2 와 «같은 병»

```
compute-readiness.ts:188   matched: split.exact.sellerCount > 0   ·  split.exact.averagePriceKrw
market-intelligence.ts:433 matched: resolved.sellerCount > 0      ·  resolved.averagePriceKrw
```

`resolved` 는 EXACT 가 없으면 **COMPARISON 으로 폴백**한다. P0-D.3(CEO 지시,
2026-09-20)이 남긴 근거는 이렇다:

> 「국내 동일상품을 찾았다」는 **EXACT 버킷에서만 참이다.** 비교상품만 있는
> 상품에 「찾았다」고 말하면 그 문장이 거짓이 된다.

🔴 **그 수정은 대시보드에만 적용됐고 상품 상세는 그대로다.** 그리고 상세의 주석
(market-intelligence.ts:426-429)은 아직 「sellerCount>0 이면 실제로 동일상품을
찾아 가격까지 확인한 것이다」라고 말한다 — `resolved` 폴백이 생긴 뒤로 **그
문장은 참이 아니다.**

**이것은 P0-2 와 정확히 같은 모양이다**: 나중 정책이 한쪽에만 적용되고, 적용하지
않기로 한 기록은 없다. 🔴 판정 값을 바꾸므로 **이번에 고치지 않았다** — 7-2 와
함께 결정할 항목이다(§E, 7-4).

### D-2. 오래된 주석 하나

`price-decision.ts:43-45` — 「티어를 구분하지 않는 호출부는 compute-readiness.ts
하나이고 … 그대로 두었다」. P0-D.3 이 그 파일에 `domesticBasis` 를 연결했으므로
(compute-readiness.ts:209) **더 이상 사실이 아니다.** 판정에는 영향이 없다.

## E. 수정 항목 갱신

| # | 내용 | 이번 커밋 |
|---|---|---|
7-1 | `analysisMarketCountry` 인자 불일치 | ✅ **수정함**(P0-2-B) |
7-2 | 평균가 vs 최저가 — 판단 기준 통일 | ⏸ 설계 결정 대기. §C 를 근거로 **가격 축만으로는 부족**(C-1) |
7-3 | 화면이 기준을 말하는가 | ⏸ 🔴 **MI-4 보고를 정정한다** — 헤드라인은 「한국 시장 평균가 · 동일상품 기준」이라고 **말한다**(mi-headline.ts:84). 말하지 않는 곳은 **대시보드 배지**다(§F) |
7-4 | 🔴 **신규** — sellability 입력 버킷 불일치(`resolved` vs `exact`) | ⏸ 판정이 바뀌므로 7-2 와 함께 결정 |
7-5 | 🔴 **신규** — 대시보드에 CASE guard 가 없다 | ⏸ 7-2 결정에 따라 함께 |
7-6 | 죽은 입력 2개 · 오래된 주석 1개 | ⏸ 무해. 별건 정리 |

## F. 🔴 화면이 실제로 말하는 것 / 말하지 않는 것

| 자리 | 숫자 | 라벨 | 정직한가 |
|---|---|---|---|
상세 헤드라인 | 평균가 | 「한국 시장 평균가 · 동일상품 기준」 | 🟢 **말한다** |
상세 CASE/추천가 | 최저가 | 「국내 최저가 ₩N 기준」 | 🟢 말한다 |
대시보드 배지 | — | 「판매판단 🟢 판매 추천」 | 🔴 기준이 없다 |
대시보드 tooltip | **평균가** | 「**국내 판매가** ₩N — 예상 마진 N%」 | 🔴 **평균가를 「국내 판매가」라고 부른다**(sellability.ts:82) |

🔴 그리고 그 마진(sellability 의 값)은 **국제배송비를 빼지 않은 숫자**다 —
같은 상품의 상세 화면이 보여주는 마진과 다른 기준이다(P-29 가 화면 노출을 막아
둔 이유이고, 대시보드는 그 차단 밖에 있다).

## G. 확인 못 한 것

* Sellability 가 평균가를 쓰기로 결정한 문서(코드 주석 외 근거) — MI-4 와 동일
* P-26 정책을 Sellability 에 적용하지 않기로 한 판단 기록 — 있는지 없는지
* UX-1D(「최저가는 이상치에 끌려간다」)와 P-26(「최저가 = 실제 판매 가능 가격」)이
  같은 자리에서 충돌한 적이 있는지 — 두 기록의 **선후 관계를 코드로 못 가렸다**
* `price_alerts` 가 무엇을 비교하는지(MI-2 → MI-4 에서 이어짐)
* 프로덕션에서 GREEN→RED 로 뒤집힐 상품이 **몇 건인지** — 🔴 세려면 Production
  데이터 조회가 필요하고, 이번 범위(코드 조사)로는 알 수 없다
