# WU-021 `MI-FINAL-DECISION-TRACE` — 최종 MI / 등록판정 연결 검증

> 🔴🔴 **검증 WU 다. 운영 코드 변경 0 · Gemini 0 · 외부 HTTP 0 · DB 쓰기 0 · credit ₩0.**
> ₩3,300 보존 · flag OFF · Production HOLD · main merge 0 · UI 0 · schema 0 · CEO 액션 없음.
> 🟢 추가한 것은 **읽기 전용 덤프 스크립트 1개 + 하니스 1개** 다.
> 🟢🟢 **결론: 공통 사슬은 두 카테고리에서 «끝까지» 돈다 — 26/26 상품이 최종 판정을 받는다.**

---

## 1. 결과 — 운영 호출 순서 그대로 돌렸다

| | KIDS_FASHION (N=17) | TENNIS (N=9) |
|---|---|---|
| ① 원가(SELLER_ORIGIN) 확보 | 13/17 | **9/9** |
| ③ tier EXACT 레코드 보유 | **2** | **0** |
| ④ `sellerCount > 0` | **3** | **0** |
| ⑤ sellability | GREEN **2** · YELLOW 11 · UNKNOWN 4 | YELLOW **9** |
| ⑦ representative | READY **2** · MARKET_OPPORTUNITY 11 · NEEDS_INFO 4 | MARKET_OPPORTUNITY **9** |
| ⑧ **sellerFacing(최종)** | 🟢 RECOMMENDED **2** · 🟡 CONDITIONAL **15** | 🟡 CONDITIONAL **9** |
| 🔴 NOT_RECOMMENDED | **0** | **0** |

🟢 **26/26 전건이 최종 판정까지 도달한다.** 「사슬이 중간에 끊긴다」는 **해당 없음** 이다.
🟢 두 카테고리가 **같은 함수를 같은 순서로** 통과한다 — 카테고리 분기가 없다.

### 운영 호출부와 1:1 (복제식 아님)

```
selectCostBasisOriginObservations   운영 market-intelligence.ts:128  (admin _lib owner)
costPriceKrw = originHistory[0]     :303
priceTierFromLink  → EXACT/COMPARISON 버킷   :136-146
summarizeDomesticMarketSplit        (pricing owner)
computeSellability                  :663
deriveRepresentativeSellerVerdict   :675
toSellerFacingVerdict               :698
```

🔴 `selectCostBasisOriginObservations` 의 owner 는 **`@commerce/pricing` 이 아니라
admin `_lib/price-observations.ts:303`** 이다(처음에 pricing 에서 import 해 실패했다 —
추측하지 않고 grep 으로 확정했다).

---

## 2. 🟢🟢 핵심 검증 — **데이터가 없을 때 「추천」이 뜨지 않는다**

```
TENNIS 9/9 : 국내 동일상품 **0** · 국내 가격 **0** → 최종 🟡 **CONDITIONAL(조건부 판매)**
🟢 🟢 RECOMMENDED 는 **0건** 이다.
```

🟢 **제품 문구도 「없다」로 단정하지 않는다** — 코드에서 확인한 실제 문장:
```
sellability YELLOW   title  「국내 동일상품 확인 필요」
                     reason 「국내 동일상품을 **자동으로 찾지 못했습니다** —
                             가격 기준을 확정할 수 없어 등록 전 직접 확인이 필요합니다」
representative       reasons[0] 「**국내 자동 검색 기준** 동일상품 판매 사례를
                                  확인하지 못했습니다」
🟢 그리고 설계 주석이 그 이유를 적어 뒀다(representative-seller-decision.ts:26-28) —
   「『국내에 없어서 기회』와 『수요가 없어서 없는 것』을 시스템이 구분할 수 없다는 점은
     문구에서 **단정하지 않는다**」.
```

🔴 즉 CEO 테스트의 FAIL 기준(「데이터 없는데 추천/GO 가 뜨는 것」)에 해당하는 사례가
이 표본에서 **0건** 이다. 🟢 이것이 이 WU 가 확인하려던 정직성이다.

### 🔴 다만 주석 하나가 낡았다 — 코드를 고치지 않고 보고만 한다

```
representative-seller-decision.ts:260 주석
  「READY/MARKET_OPPORTUNITY → 🟢 판매 추천, REVIEW_PRICE/NEEDS_INFO → 🟡」
🔴 **실제 map 은 다르다** — `MARKET_OPPORTUNITY: "CONDITIONAL"`(같은 파일 하단 map).
   그 자리 주석이 변경 이유까지 적어 뒀다(「『국내 데이터 없음=판단불가』 철학을 버리고
   MARKET_OPPORTUNITY 를 READY 와 동일하게 🟢 … 안 된다」).
🟢 실측이 map 과 일치한다(MARKET_OPPORTUNITY 11+9 → 전부 CONDITIONAL).
🔴 :147 주석은 맞다(「MARKET_OPPORTUNITY(NONE, 이미 CONDITIONAL 로 매핑됨)」).
→ 🔴 **:260 머리 주석만 낡았다.** 주석을 근거로 판정을 설명하면 **틀린 답** 이 나온다.
   🔴 운영 코드를 고치지 않았다(문구·판정 변경은 제품 정책 경계).
```

---

## 3. 🔴🔴 CONTROL — **세울 수 없다. 그래서 「운영 재현」으로 적지 않는다**

```
운영의 최종 verdict 는 **DB 에 저장되지 않는다**:
  product_snapshots 칸 **12개** — id · source_url · title · thumbnail_url · status ·
    workspace · created_at · updated_at · last_opened_at · job_key · workspace_id ·
    product_id   → 🔴 **판정 칸이 없다**
  price_alerts — 이 표본 26개에 대해 **0행**
→ 🔴 §5-B 의 「운영이 낸 그 값이 재현된다」를 **만들 수 없다.**
🟢 이 측정이 증명하는 것: **「사슬이 끝까지 도는가 + 무엇을 내는가」**
🔴 증명하지 않는 것: **「운영이 지금 그 값을 낸다」**  — 둘을 같은 칸에 적지 않는다.
🟢 단 **입력은 운영 실데이터** 다 — price_observations **75행**(SELLER_ORIGIN 59 ·
   DOMESTIC_SHOP 16) · domestic_product_links **5행**. 가공하지 않았다.
```

### 🔴 그리고 사슬 한 구간을 **의도적으로 비웠다** (지어내지 않았다)

```
운영은 computePriceRecommendation(:461)에 `totalCostKrw: cost.landedCostKrw` 를 넘기고
그 cost 는 computePriceBreakdown(..., exchangeRates.rates)(:437) 산출이며, 그 환율은
**fetchLiveExchangeRates()(:436)가 DB/외부에서 받는다.**
🔴 이 WU 는 HTTP 0 이므로 환율을 받지 않았다 → `landedCostKrw: null` · `marketCase: null`
   로 넘겼다. 🔴 그래서 ⑦⑧은 **「marketCase 없이」 조건의 값** 이다.
🟢 영향 범위는 한정적이다 — marketCase 는 READY/HOLD 경로의 «재검사»(:141)에만 쓰이고
   YELLOW→MARKET_OPPORTUNITY 분기는 sellability 로 결정된다. 🔴 그래도 「운영과 같다」로
   적지 않는다.
```

---

## 4. 등록 판정(P-32) — ⚪ **이 하니스로 측정하지 않는다**

```
computeRegistrationReadiness(inputs: PlatformReadinessInput[])  (:109)
  입력이 **채널 등록 상태** 이고 가격/판정 덤프에 없다 → 측정 안 함.
🟢 그런데 «연결 여부» 는 코드로 이미 확정됐다(WU-019R):
   - P-32 불변식 선언 — registration-readiness-outcome.ts:15-20
     「판매 판정과 등록 준비는 서로에게 영향을 주지 않는다 … 이 파일의 어떤 함수도
       sellVerdict 를 읽고 등록 결과를 바꾸지 않는다」
   - 그 함수는 **sellVerdict 를 인자로 받지 않는다**(:109)
→ 🟢 그래서 ⑧이 무엇이든 등록 준비는 바뀌지 않는다. **설계대로 분리** 돼 있다.
🔴 「등록 판정이 안 된다」가 아니다 — 「판매 판정과 독립이다」가 맞는 표현이다.
```

---

## 5. 🔴 병목은 그대로다 — 숫자가 기존 KPI 와 정합한다

```
KIDS 17 중   tier EXACT 레코드 보유 **2** · sellerCount>0 **3**
TENNIS 9 중  **0** (scope 샵 1곳 · 교집합 0 — 선행 WU 확정)
🟢 헌장 §12 의 핵심 KPI(「동일상품 확정 + 가격 비교」 55/498 = **11.0%**)와 같은 방향이다.
🔴 즉 **사슬이 아니라 «입구» 가 병목** 이라는 결론이 또 재현됐다.
🔴 이 표본으로 11.0% 를 다시 계산하지 않았다(분모가 다르다).
```

---

## 6. 검증

```
🟢 admin 전수 회귀 · typecheck · build · coupling guard — §7 참조
🟢 Gemini 0 · 외부 HTTP 0 · credit ₩0 · DB **읽기만**(INSERT/UPDATE/DELETE 0)
🟢 운영 코드 변경 **0**(git status 로 증명) · schema 0 · UI 0 · threshold 0 · P-32 0
🟢 flag OFF · deploy 0 · main merge 0
```

🔴 **DB 칸 이름을 또 추측했다가 걸렸다** — `domestic_product_links` 에 `domain`·
`shop_name`·`price_krw`·`sold_out` 이 **없다**(선행 덤프의 그 칸들은 source 조인 산출이었다).
🟢 `information_schema` 로 읽어 고쳤다. 🔴 이 트랙에서 같은 실수 **아홉 번째** 다.

---

## 7. 종료 판정

```
🟢 **공통 E2E 최종 MI 연결 — 닫혔다.** 26/26 상품이 최종 sellerFacing 판정까지 도달하고,
   두 카테고리가 **같은 코드 경로** 를 쓴다(카테고리 분기 0).
🟢 **정직성 — PASS.** 국내 데이터 0 인 TENNIS 9/9 가 🟡 CONDITIONAL 이고
   🟢 RECOMMENDED 는 0 이다. 문구도 「자동으로 찾지 못했다」로 말한다.
🟢 **등록 판정 — 설계대로 분리**(P-32, 코드 확인).
🔴 **「운영 재현」은 아니다** — verdict 미저장으로 CONTROL 불가 · marketCase/landedCost 는
   환율이 필요해 비웠다.
🔴 **카테고리 확장 판단은 CPO 몫** 이다. CTO 가 다음 카테고리로 넘어가지 않았다.
```
