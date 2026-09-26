# MI-4 / P0-2 — CASE 최저가 vs Sellability 평균가

> CTO 조사 보고(2026-09-26). **코드를 한 줄도 바꾸지 않았다.**

## 1. 두 값의 생성 경로

### 공통 — 통계는 «한 함수» 가 함께 낸다

`summarizeFrom()`(price-history.ts:467)이 `lowestPriceKrw` · `averagePriceKrw` ·
`highestPriceKrw` 를 **같은 `activeRecords` 에서 한 객체로** 만든다.

```
activeRecords = records.filter(r => r.soldOut !== true && r.priceKrw != null)
```

🔴 즉 「최저가 pool」과 「평균가 pool」이 따로 있는 것이 아니다. **같은 표본에서
어느 칸을 읽느냐의 차이다** — 품절 행과 가격 없는 행은 둘 다에서 똑같이 빠진다.

### CASE

```
domesticShopHistory ──(priceTierFromLink)──┬─ EXACT      → exactShopRecords
                                           └─ COMPARISON → comparisonShopRecords
naverShoppingHistory ─────────────────────────────────────→ comparison 버킷
        ↓ summarizeDomesticMarketSplit(exact, comparison, { analysisMarketCountry: "KR" })
domesticSummary = split.resolved            ← EXACT 없으면 COMPARISON 으로 내려간다
        ↓ domesticLowestPriceKrw + domesticBasis
computePriceRecommendation → CASE A/B/C/D
```

🔴 그런데 `computePriceRecommendation` 첫 줄이 이렇다(price-recommendation.ts:119):

```ts
if (input.domesticBasis !== "EXACT" || input.domesticLowestPriceKrw == null) → CASE D
```

즉 `resolved` 가 COMPARISON 으로 내려간 경우 **가격 판단을 하지 않는다**(브랜드
중앙값 «참고치» 만). 그래서 실효적으로 CASE 도 EXACT 버킷만 쓴다.

### Sellability

```
같은 분류로 exactShopRecords / comparisonShopRecords
        ↓ summarizeDomesticMarketSplit(exact, comparison)      ← 🔴 옵션 «없음»
computeSellability({
  costPriceKrw,
  domestic: { matched: split.exact.sellerCount > 0,
              averagePriceKrw: split.exact.averagePriceKrw }   ← 🔴 exact «직접»
})
```

## 2. 두 pool 은 같은가

| | Sellability | CASE |
|---|---|---|
버킷 | `split.exact` **직접** | `split.resolved` + `basis === "EXACT"` 가드 |
EXACT 가 있을 때 | `exact` | `resolved === exact` → **같다** |
EXACT 가 없을 때 | `matched=false` → YELLOW | `basis≠EXACT` → CASE D |
분류 기준 | `priceTierFromLink`(match_truth) | 같음 |
품절·가격없음 제외 | 같음(`summarizeFrom`) | 같음 |

**→ 판단이 실제로 일어나는 상황(EXACT 존재)에서 두 pool 은 «같은 요약 객체» 다.**
없을 때도 둘 다 «판단하지 않는다» 로 일치한다.

### 🔴 2-1. 다만 «구조적으로» 갈라지는 칸이 하나 있다

```
market-intelligence.ts   summarizeDomesticMarketSplit(…, { analysisMarketCountry: "KR" })
compute-readiness.ts     summarizeDomesticMarketSplit(…)            ← 옵션 없음
```

이 옵션은 `summarizeFrom` 이 **어느 시장의 가격으로 최저/평균을 낼지** 를 정한다.
넘기지 않으면 시장 제한이 없다.

**오늘은 결과가 같다** — 국내 가격 확인 경로(`run-domestic-price-check.ts`)가
`marketCode` 를 «남기지 않아서» 국내 행의 시장 그룹이 하나뿐이기 때문이다
(price-history.ts 주석의 `basis="SINGLE"` 경우).

🔴 **그러나 국내 관측에 시장 코드가 생기는 날 두 값은 조용히 갈라진다.** 한쪽은
한국 시장만, 다른 쪽은 전체를 본다. 지금 고장이 아니라 **잠긴 불일치**다.

## 3. 각 선택의 «기록된» 근거

### CASE = 최저가 — 근거 있음, 날짜 2026-09-03

`price-recommendation.ts:5-18`(P-26, CPO 지시). 정책이 «바뀐» 기록이다:

> 기존에는 minimumPrice 가 recommendedPrice 의 강제 하한선이었다 … 실측(PèPè)에서
> 이게 **「국내 최저가 ₩258,000인데 ₩269,333을 추천」** 하는 비현실적 컨설팅을
> 만들었다. 이제 세 기준가격의 역할을 분리한다 —
> **`domesticLowestPriceKrw`(marketPrice): 실제 판매 가능 가격의 근거**

### Sellability = 평균가 — 근거 있음, 날짜 2026-08-26

`sellability.ts:1-12`(대표님 지시). 묻는 질문 자체가 다르다:

> "가격 비교"가 아니라 **"이 상품을 «등록해도» 되는가?"** … 이 함수는 아직 판매가가
> 없는 상품도 다룬다(**국내 동일상품 평균가를 «잠정 판매가» 로 참고만 한다**).

### 🔴 3-1. 그래서 판정은 「A 냐 B 냐」가 아니다

둘 다 «쓰여 있는 근거» 가 있고, **묻는 질문이 실제로 다르다**:

| | 질문 | 통계 | 뜻 |
|---|---|---|---|
CASE | 얼마에 «팔 수 있나» | 최저가 | 시장에서 실제로 성립하는 가격 |
Sellability | 이 상품을 «등록해도» 되나 | 평균가 | 판매가가 없을 때의 잠정 대입값 |

그런데 **날짜가 갈린다** — Sellability(08-26)가 먼저고, 「최저가가 실제 판매 가능
가격」이라는 P-26 정책(09-03)은 **그 뒤**다. 🔴 그 정책이 Sellability 에는
적용되지 않았고, **적용하지 않기로 «결정한» 기록도 없다.**

즉 **「의도된 분리」와 「한쪽에만 적용된 정책」이 구분되지 않는 상태**다. 어느
쪽인지는 코드로 알 수 없다 — 설계 결정이 필요하다.

### 3-2. 갈라졌을 때 어느 방향으로 틀리는가

평균가 ≥ 최저가 이므로 Sellability 의 마진 추정은 **항상 CASE 보다 낙관적**이다.
같은 상품에서 **CASE B/C(손실 경계) 인데 Sellability GREEN** 이 나올 수 있고,
그 반대는 나오지 않는다. 🔴 **틀리는 방향이 한쪽으로 몰려 있다** — 「팔아도 된다」
쪽이다.

## 4. UI — 두 기준이 구분되는가

🔴 **이미 같은 부류의 모순이 한 번 터졌고 «덮개» 로 막혀 있다**
(DomesticPriceIntelligencePanel.tsx:2675-2683, P-8, 2026-08-30):

> 이전에는 이 카드가 unifiedDecision 이 없으면 「판단 불가」 헤드라인 아래에
> 곧바로 `sellability.reason` 의 GREEN 문구(「가격 경쟁력이 있습니다」)를 붙여
> 보여줬다 — **헤드라인과 본문이 반대 뉘앙스인 모순**이었다(실측: Pepe Shoes,
> Bruno Cut Out Sandals).

지금은 `representativeVerdict` 가 **둘 중 더 신뢰할 수 있는 쪽을 골라** 헤드라인
하나로 압축한다. 즉 **화면은 모순을 «감춘다»** — 두 숫자가 다른 기준 위에 서 있다는
사실은 셀러에게 «보이지 않는다».

* 국내 «최저가» 는 화면에 나온다.
* Sellability 가 쓴 «평균가» 는 마진율(`estimatedMarginPercent`)로만 반영되고,
  그 마진이 어느 가격 기준인지는 화면이 말하지 않는다.

## 5. price_alerts — 계산을 공유하지 않는다(STEP 6)

`summarizeDomesticMarketSplit` · `computeSellability` · `computePriceRecommendation`
중 무엇도 `price-alerts` 경로에서 불리지 않는다. **별개 축이고 섞이지 않았다.**
(무엇을 비교해 알림을 내는지는 여전히 「확인 못 함」 — MI-2 와 동일.)

## 6. 판정

```
A(의도된 분리, 수정 없이 UI 설명만)   …  절반만 맞다
B(같은 기준으로 통일)                 …  절반만 맞다
C(pool 자체가 다름)                    …  🔴 «오늘은 아니고, 잠겨 있다»
```

**→ 코드 근거만으로는 A 와 B 중 하나로 결정할 수 없다.** 둘 다 쓰여 있는 근거가
있고, 질문이 실제로 다르며, 그러나 더 나중의 정책(P-26)이 한쪽에만 적용됐다.

🔴 **이것은 설계 결정이 필요한 사안이다**(추측으로 고르지 않는다).

## 7. 수정 필요 여부 — 셋으로 나눈다

| # | 내용 | 성격 | 권고 |
|---|---|---|---|
**7-1** | 옵션 인자 불일치(`analysisMarketCountry`) | 🔴 **잠긴 결함** — 오늘 무해, 시장 코드가 생기면 갈라짐 | **고칠 것**. 한 줄이고 판정을 바꾸지 않는다(오늘 결과 동일) |
**7-2** | 평균가 vs 최저가 | **설계 결정** | CEO/CPO 판단. 근거: 틀리는 방향이 「팔아도 된다」 한쪽 |
**7-3** | 화면이 기준을 말하지 않음 | **설명 부채** | 7-2 결정 후 함께 |

🔴 7-1 조차 이번 조사 범위 밖이라 **건드리지 않았다.** 지시받으면 그때 한다.

## 8. 확인 못 한 것

* Sellability 가 평균가를 쓰기로 «결정한» 문서(코드 주석 외 근거)
* P-26 정책을 Sellability 에 적용하지 않기로 한 «판단 기록» — 있는지 없는지
* `representativeVerdict` 가 둘 중 하나를 고르는 «규칙» (이번 범위 밖)
* `price_alerts` 가 무엇을 비교하는지(MI-2 에서 이어짐)
