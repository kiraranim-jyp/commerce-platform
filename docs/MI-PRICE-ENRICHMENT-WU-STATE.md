# MI Price Enrichment → Seller Decision Value WU — 실행 상태

> 🟢 **종료.** 최종 판정은 §7 이다. 종료조건 전부 답했다.
> 🔴🔴 Discovery 축은 `COUNTERFACTUAL / NON-PRODUCTION` · 가격·결정 축은 운영 owner 그대로.
> 🟢 선행 WU 둘은 CLOSED — 국내 Coverage(`CHANGE DIRECTION`) · MI Discovery(`HOLD`).
> 🔴 이 WU 도 Discovery 는 비운영이므로 **Discovery 축 숫자는 COUNTERFACTUAL** 이다.

---

## 1. Strategic Question

> `KNOWN_SAME` 후보의 가격을 `enrichCandidatePrices` / `verifySourcePriceDirect` 로
> 보강했을 때 **실제 Seller Decision 이 얼마나 개선되는가.**

🔴 선행 WU 가 남긴 유일한 미측정 축이고, `HOLD → GO` 를 가르는 측정이다.

---

## 2. 🟢 §5-B Preflight — owner 와 «실제 어휘» 확정

### 2-1. owner (전부 실측 확인)

```
enrichCandidatePrices        packages/crawler/src/comparison-search/price-source-adapter.ts:243
verifySourcePriceDirect      packages/crawler/src/comparison-search/index.ts:427
summarizeDomesticMarketSplit packages/pricing/src/price-history.ts:630
computePriceDecision         packages/pricing/src/price-decision.ts:72
buildSellerDecision          packages/pricing/src/seller-decision.ts:209
computeSellability           packages/pricing/src/sellability.ts:44
```

### 2-2. 🔴🔴 지시서의 결정 어휘가 리포와 «다르다»

지시서는 `AUTO_GO / REVIEW / NO_GO` 변화를 재라고 했다. 🔴 **그 어휘는 리포에 없다.**
`packages/pricing` 전수 확인 결과 `AUTO_GO`·`NO_GO` 는 **0건** 이고
`AlertSeverity = "ACTION_REQUIRED" | "REVIEW" | "INFO"`(market-alert.ts:35)만 있다.

🟢 **실제 결정 어휘는 셋이다** — 타입에서 읽었다(추측 아님):

```
SellerFacingVerdictCode   "RECOMMENDED" | "CONDITIONAL" | "NOT_RECOMMENDED"
                          (representative-seller-decision.ts:270)
PriceDecisionVerdict      "MAINTAIN" | "CONSIDER_LOWER" | "MARGIN_RISK"
                          (price-decision.ts:8)
MarketOutlook             "GOOD" | "WATCH" | "WEAK" | "UNKNOWN"
                          (seller-decision.ts:25)
DomesticPriceBasis        "EXACT" | "COMPARISON" | "NONE"   (price-decision.ts:14)
```

🔴 **그래서 「AUTO_GO/REVIEW/NO_GO 변화」 대신 위 네 축의 변화를 잰다.**
   없는 어휘로 보고하면 그 숫자는 어디에도 대조할 수 없다.

### 2-3. 결정 입력 계약

```
PriceDecisionInput  costPriceKrw · currentSellingPriceKrw ·
                    domesticAveragePriceKrw | null · domesticLowestPriceKrw | null ·
                    domesticBasis? · marginFloorPercent? · competitiveGapPercent?
PriceDecisionResult verdict · marginPercent · priceGapVsAveragePercent |null ·
                    priceGapVsLowestPercent |null · reason
SellerDecisionResult finalVerdict · priceVerdict · downgradedByMarket · outlook ·
                    outlookSummary · knownSignalCount · factors · reasons
```

🟢 즉 **Seller Decision 변화를 재려면 `domesticLowestPriceKrw`/`AveragePriceKrw`/
   `domesticBasis` 세 칸만 바뀌고 나머지는 고정하면 된다** — Before/After 가 깨끗하다.

---

## 3. 선행 WU 에서 가져오는 확정 사실 (재측정 금지)

```
🔴 External Discovery 운영 호출부 0 · NAVER_SHOPPING DB 0행
🔴 Light Fetch 는 «의도적으로» price: null 이다(product-url-facts.ts:30-40)
   「Shopify variants[].price 에 통화 코드가 없다 → /meta.json 추가 호출 = 비용 2배」
   가격 owner 는 enrichCandidatePrices / verifySourcePriceDirect 이고
   price-truth.ts 게이트가 가격 없는 후보를 «정직하게 제외» 한다
🟢 MI Identity (counterfactual): Precision 91% · Recall 83% · EXACT FP 0
🟢 KNOWN_SAME 12쌍 / 4-of-7 상품 · usable SAME **0**
🔴 price-history.ts:644  exact.sellerCount>0 → resolved=exact → COMPARISON 전체 무시
🔴 측정불가 ≠ 0% · 「후보 0」≠ 부재 · CONTROL = 운영값 재현(「돌았다」 아님)
```

---

## 4. 다음 실행이 «즉시» 할 것

```
STEP 1  enrichCandidatePrices / verifySourcePriceDirect 의 **실제 시그니처와
        비용 구조** 를 읽는다(통화 조회가 몇 요청인가).
STEP 2  §5-B CONTROL — 운영이 이미 가격을 가진 후보(DOMESTIC_SHOP 279관측)로
        enrichment 가 «운영과 같은 값» 을 내는지 재현한다.
        🔴 「가격이 나왔다」는 통과가 아니다 — 운영 금액과 같아야 한다.
STEP 3  KNOWN_SAME 12쌍에 enrichment 를 돌려 가격 확보율을 잰다.
STEP 4  Before/After — domesticLowestPriceKrw · Average · basis 만 바꿔
        computePriceDecision → buildSellerDecision 을 두 번 돌린다.
        산출: PriceDecisionVerdict 변화 · SellerFacingVerdictCode 변화 ·
             MarketOutlook 변화 · basis 변화(NONE→COMPARISON→EXACT)
STEP 5  비용 — 추가 요청 수 · latency · 통화 조회 비용 ·
             cost / decision-improving product
STEP 6  Gate → GO / HOLD / CHANGE DIRECTION
```

---

## 5. 🔴 금지사항 (CPO 확정, 선행 WU 에서 이어짐)

```
X Discovery API Production 연결 · Gemini prompt/query 확장
X Identity threshold 완화 · Vision Production 연결
X UniversalExtract fallback · Registry UI 변경 · 국내 판매처 대량 추가
X 🔴 price:null 을 임의 숫자로 채우기
X 🔴 선행 WU 의 83%/91% 를 Production KPI 로 기록
X 🔴 없는 어휘(AUTO_GO/NO_GO)로 보고
X 보고 후 추가 전수 대조로 새 문서 구멍 만들기
```

---

## 6. 🟢 STEP 2~5 측정 결과

```
sample N=7 원상품 · (상품×호스트) 40 · 🔴 비용상한으로 버린 호스트쌍 24
```

### 🟢 CONTROL PASS — 결정 함수가 «세 칸에만» 반응한다

```
pureRepeat   같은 입력 → 같은 verdict/margin           🟢 순수
noneVsExact  basis NONE  → MAINTAIN
             basis EXACT → **CONSIDER_LOWER**  → 🟢 **바뀐다**
```
🔴 즉 「가격이 나왔다」가 아니라 **결정이 가격에 반응한다**는 것을 먼저 고정했다.
   그래서 아래 「변화 0」은 결정 함수가 둔감해서가 아니다.

### ① 🟢 가격 enrichment 는 «작동한다»

```
hostPairs 40
priced  before 0 → after **18**   ·  verifiedCurrent 18
🟢 「시도했지만 가격 못 붙임」 = **0**  (시도한 건 전부 성공)
eligibleTotal 22 · hostsWithZeroEligible 28/40
   🔴 28쌍은 selectCandidatesForDetailConfirmation 이 «아무도 고르지 않았다»
      (matchLevel 이 medium 미달 + SAME_MODEL_VARIANT 도 아님)
```

### ② 🟢 KNOWN_SAME 한정 확보율

```
KNOWN_SAME 호스트쌍 10 · eligible 16 · afterPriced **16**
```

### ③④ 🔴🔴 그런데 Seller Decision 변화 = **0**

```
productsGainingAnyKrwPrice  **0**
basisChanged 0 · verdictChanged 0 · 전환 MAINTAIN→MAINTAIN 7/7
```

**원인은 가격 부재가 «아니다» — 통화와 시장 축이다:**

```
가격을 얻은 통화   GBP 7 · EUR 7 · USD 4  →  🔴 **KRW 0건**
가격을 얻은 호스트 bobochoses.com · dreamsofcuteness.com · gilukids.com ·
                  junioredition.com · lefanfare.nl · little-wares.com ·
                  main-story.com · scoutandcokids.com
                  → 🔴 **여덟 곳 전부 해외 판매처다**
```

🔴🔴 **`domesticLowestPriceKrw` 는 «국내» 시장가 축이다.** 해외 판매처의 EUR/GBP/USD
가격을 환산해 그 칸에 넣으면 「국내 최저가」가 아니라 **의미가 깨진 숫자**가 된다.
🟢 해외가는 `SELLER_ORIGIN`(원가/매입) 축이 담당한다 —
   `PRICE_OBSERVATION_SOURCES = SELLER_ORIGIN | NAVER_SHOPPING | DOMESTIC_SHOP`.

→ 🟢 **즉 Gemini Discovery 후보는 구조적으로 «해외» 이고, 국내 가격 결정 축에
   애초에 들어갈 수 없다.** 가격이 없어서가 아니라 **축이 다르다.**

### ⑤ 비용

```
lightFetch 202 · enrich 호출 40(호스트쌍당 1) · 17초
🔴 enrich 내부 상세조회는 샵당 최대 2건(MAX_DETAIL_CONFIRMATIONS_PER_SHOP)
🔴 cost / decision-improving product = **측정불가(분모 0)**
```

---

## 7. 최종 판정 — **HOLD 유지, 단 이유가 «완전히 달라졌다»**

```
선행 WU 의 이유   「SAME 후보에 가격이 없다」
🔴 이번 WU 의 이유  「가격은 붙는다(18건 · 시도 성공률 100%).
                    그런데 그 가격은 **해외 통화·해외 판매처** 이고
                    `domesticLowestPriceKrw` 축에 들어갈 수 없다」
```

### Business Value Gate

```
[🟢] 가격 enrichment 성공률        시도 대비 **100%** (18/18)
[🟢] KNOWN_SAME 가격 확보          16/16 eligible
[🔴] basis 변화                    0 — KRW 가격이 0건이다
[🔴] Seller Decision 변화          0 — MAINTAIN→MAINTAIN 7/7
[🟢] 결정 함수 민감도              CONTROL 에서 NONE→EXACT 시 verdict 변함 확인
[🔴] cost / decision-improving     측정불가(분모 0)
→ NO PRODUCTION CHANGE
```

### 🔴 그리고 이것이 Discovery 전략에 주는 함의

```
Gemini Discovery 가 찾아오는 것은 «해외 판매처» 다(8/8 호스트).
→ 그것은 **국내 시장가(domesticLowestPriceKrw)** 를 만들 수 없다.
→ 가치가 있다면 그 축은 **해외 매입가/원가(SELLER_ORIGIN)** 쪽이고,
  그건 「국내 최저가 비교」와 **다른 질문** 이다.
🔴 그 질문은 이 WU 의 범위가 아니다. 지시서는 「domesticLowestPriceKrw →
   computePriceDecision → buildSellerDecision」을 재라고 했고, 그 축에서는 0 이다.
```

---

## 8. Known Unknowns

```
🔴 비용상한으로 호스트쌍 24 를 버렸다(40/64). 전수가 아니다
🔴 28/40 호스트쌍은 selectCandidatesForDetailConfirmation 이 0건을 골랐다 —
   「matchLevel 이 낮아서」와 「후보가 애초에 부적격」을 가르지 않았다
🔴 환율 환산을 «의도적으로 하지 않았다». 환산했을 때 결정이 바뀌는지는 미측정이고,
   🔴 그 이전에 **「해외가를 국내 최저가 칸에 넣는 것이 옳은가」가 정책 질문** 이다
🔴 `verifySourcePriceDirect` 는 이번에 쓰지 않았다(enrichCandidatePrices 만 썼다)
🔴 KRW 를 주는 후보가 하나라도 있으면 결과가 달라질 수 있다 — 이번 표본에는 0건
🔴 sample N=7 · KNOWN_SAME 호스트쌍 10. 일반화 금지
```
