# MI Price Enrichment → Seller Decision Value WU — 실행 상태

> 🔴 **진행 중.** 다음 실행은 새 WU 를 만들지 않고 §4 부터 이어간다. 중간 보고 금지.
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
