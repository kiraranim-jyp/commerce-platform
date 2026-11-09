# REFERENCE-PRICE-PROFITABILITY-AXIS-1 — 설계 · 데이터 연결 · 🔴 충돌 1건

> 🔴 **설계 단계.** 운영 코드 **0** · DB **0** · 미커밋 39건 보존.
> CPO 지시: 「**우선 설계와 데이터 연결을 확정하고, 구현 범위가 기존 동결 정책과
> 충돌하지 않는지 확인한 뒤** 진행합니다」 · 「기존 마진 공식으로 계산할 수 없는 부분이
> 발견되면 **임의로 새 공식을 만들지 말고 중단 후 보고**」. ⟹ **그 둘 다에 걸렸다.**

---

## 0. 결론 — 설계는 **확정됐다**. 🔴 그러나 **CEO 명시 정책과 정면으로 만난다**

```
🟢 데이터 연결  확정(§1) — 필요한 값이 **전부 이미 있다**
🟢 공식 재사용  가능(§2) — 🔴 단 **export 하나** 가 필요하다(공식·결과 변경 0)
🔴🔴 충돌      **1건**(§3) — `price-decision.ts` 가 **CEO 명시** 로
               「COMPARISON 은 판정에 쓰지 않는다」를 **실측 피해와 함께** 못박고 있다
⟹ 🔴 **구현을 시작하지 않았다.** §4 의 경계를 CPO 가 확인해 주면 그대로 간다.
```

---

## 1. 데이터 연결 — **전부 이미 있다**(새 수집 0)

| 필요한 값 | 출처(기존) | 상태 |
|---|---|---|
| 참고가격(국내 최저) | `candidateDomesticPrice.byCurrency.KRW.lowestAmount` | 🟢 있다 (= 화면 「₩88,000」) |
| 근거 후보 수 | 같은 객체 `byCurrency.KRW.count`(판매처 단위) | 🟢 있다 |
| 제외 사유 수 | `unverifiedCount` · `observedDifferenceCount` | 🟢 **이미 계산된다** |
| tier 분포 | `byPriceTier` | 🟢 있다 |
| 착지원가 | `cost.landedCostKrw` | 🟢 있다 |
| 목표마진 | `product.priceBreakdown.marginPercent` | 🟢 있다 |

🔴 **새 집계기·새 수집·새 DB 칸이 필요 없다.** 연결만 하면 된다.

---

## 2. 공식 재사용 — 🟢 가능. 🔴 **export 하나** 가 필요하다

```
필요한 것   참고가격 P 와 착지원가 C 로 **마진%** = (P − C) / P × 100
기존 공식   `marginPercentAt(priceKrw, costKrw)`  (price-recommendation.ts:104)
            주석: 「packages/pricing 전역에서 쓰는 공식과 동일 · price-decision.ts 와 동일 분모」
🔴 그런데 그 함수는 **module-private** 다. `packages/pricing` 전체에 **export 된 마진
   함수가 0** 이다(전수 grep 확인).
```

**검토한 대안 둘 — 둘 다 안 된다**
```
⒜ `computePriceDecision` 재사용  🔴 **불가** — `currentSellingPriceKrw` 가 **필수** 인데
   이 상품군은 판매가 미확정(`priceOverrideKrw: undefined`)이다. 게다가 그 함수는
   **verdict(CONSIDER_LOWER 등)를 낸다** — CPO ⑦(기존 verdict 를 덮지 않는다)에 걸린다
⒝ `computePriceRecommendation` 에 참고가격을 `domesticLowestPriceKrw` 로 넣고
   `domesticBasis: "EXACT"` 로 부른다  🔴 **금지** — **basis 를 거짓으로 만드는 것** 이고
   CASE A~D 를 바꾸는 것과 같다(CPO ②·⑦ 위반)
```

🟢 **채택안 — `marginPercentAt` 를 export 한다**
```
공식 **변경 0** · 계산 결과 **변경 0** · 기존 호출부 **변경 0** · CASE A~D **변경 0**
🔴 동결 파일을 **여는 것은 맞다** — 그러나 바꾸는 것은 **가시성 한 글자** 다(`export`).
🔴 CPO 가 「새 공식 금지」라 했으므로 **사본을 만들지 않는다** — 이 길이 그 지시를 지키는 유일한 방법이다.
```

---

## 3. 🔴🔴 충돌 — **CEO 명시 정책 + 실측 피해**

`packages/pricing/src/price-decision.ts:16-40` 의 `domesticBasis` 주석(원문):

```
EXACT       같은 상품이 국내에서 이 값에 팔린다  → 판정에 쓴다
COMPARISON  비슷해 보이는 «다른» 상품의 값       → 🔴 판정에 쓰지 않는다
NONE        국내 관측 없음                       → 쓸 값이 없다
🔴 COMPARISON 을 «0 으로» 취급하지 않는다. 판정 «입력에서 제외» 할 뿐이고,
   그 값은 참고정보로 화면에 그대로 남는다(**CEO 명시**).
```

🔴🔴 **그리고 그 정책에는 실측 피해가 붙어 있다**(같은 주석):
> 실측(2026-09-20 · 국내가격 보유 51건): EXACT 없이 **COMPARISON 만 있는 6건 중 4건이
> `CONSIDER_LOWER`** 였다. 즉 **같은 상품이 아닌 물건의 가격을 근거로 판매자에게
> 「가격을 낮추라」고 권하고 있었다.** 그 말을 따르면 **근거 없이 싸게 판다.**

### 🟢 그런데 **CPO 의 새 축은 그 피해 모양이 아니다** — 경계가 갈린다

| 축 | 산출 | 피해 모양 |
|---|---|---|
| 기존 `computePriceDecision` | **verdict**「가격을 낮춰라」 | 🔴 **행동 권고** → 근거 없이 싸게 판다 |
| 🟢 신규 참고가격 축(CPO ③) | **「이 참고가격으로 팔면 예상 마진 X%」** | 🟡 관측 보고(권고 아님) |

🟢 **CPO 의 ⑤⑦ 이 이미 그 선을 긋고 있다** — 「확정 판정처럼 표현하지 않는다」·
「기존 verdict 를 덮어쓰지 않는다」. ⟹ 설계가 그 둘을 **구조로** 지키면 충돌하지 않는다.

🔴 **그러나 CTO 가 단독으로 「충돌 없음」이라 선언하지 않는다** — ⒜ 그 정책은 **CEO 명시** 이고
⒝ 「수익성 %」와 「가격 인하 권고」의 거리가 **화면에서는 짧다**(셀러가 마진을 보고 가격을
맞출 수 있다). ⟹ **CPO/CEO 확인 사안** 으로 올린다.

---

## 4. 충돌을 피하는 **설계 경계 넷**(구현 시 계약으로 잠근다)

```
① 🔴 새 축은 **verdict 를 만들지 않는다** — 숫자와 라벨만 낸다
   (「추천/비추천」·「낮추세요」·「경쟁력」 어휘 **0** · 계약으로 금지)
② 🔴 기존 경로에 **입력으로 들어가지 않는다** — `computePriceRecommendation` ·
   `computePriceDecision` · `buildSellerDecision` · `representativeVerdict` 에 **0**
   ⟹ `marketCase`·`finalVerdict`·`recommendedPriceKrw` **한 글자도 안 바뀐다**
③ 🔴 화면에서 **기존 판매 판단과 다른 영역** 에 선다 + **근거를 같이 적는다**
   (「참고가격 기준 · 동일상품 **미검증** · 근거 후보 N곳 · 제외 M곳」)
④ 🔴 `PRESUMED_SAME → EXACT` 승격 **0** · tier **불변** · B 금액 비노출 **유지**
```

---

## 5. 구현 범위(승인 시) — 파일 **4**

```
packages/pricing/src/price-recommendation.ts   `marginPercentAt` **export 추가**(공식 0)
packages/pricing/src/reference-profitability.ts (신규 · 순수 함수 하나)
   computeReferenceProfitability({ referencePriceKrw, landedCostKrw, targetMarginPercent,
     sellerCount, excludedUnverified, excludedObservedDifference })
     → { marginPercent, meetsTarget, basis: "REFERENCE_PRICE", sellerCount, excluded… }
   🔴 **verdict 칸이 없다**(①을 타입으로 강제)
apps/admin/.../market-intelligence.ts          연결 1곳(기존 값 읽어서 호출 · 집계 0)
apps/admin/.../(셀러 화면 1 파일)               별도 영역 렌더
```

**완료 기준 대조(CPO)**
```
EXACT 없어도 계산 가능      🟢 설계상 가능(참고가격은 CASE D 에서도 있다)
COMPARISON 가격 활용        🟢 그 축이 곧 참고가격이다
Identity tier · verdict 불변 🟢 경계 ②가 구조로 보장
기존 CASE A~D 회귀 PASS     🟢 입력을 안 건드리므로 변화 0 예상(측정으로 확인)
실제 셀러 화면 렌더 검증     🟢 `seller-surface-render-harness-1` 로 전후 비교
```

---

## 6. 🟡 CPO 판정 요청 — **둘**

```
⒜ **§3 의 CEO 명시 정책과의 경계** 를 승인해 주십시오 —
   「COMPARISON 은 **verdict** 에 쓰지 않는다(유지)」 ↔ 「COMPARISON 으로 **수익성 %만**
    계산해 **별도 영역에 표시** 한다(신규)」가 **양립한다** 는 확인.
   🔴 CEO 명시 정책이라 CPO 단독 판단인지도 함께 알려 주십시오.
⒝ **`marginPercentAt` export** 를 승인해 주십시오 — 동결 파일을 열지만 바꾸는 것은
   **가시성뿐** 이고, 이것이 「새 공식 금지」를 지키는 **유일한** 길입니다.
   🔴 승인하지 않으시면 이 WU 는 **공식 없이 진행할 수 없다** ⟹ 중단이 맞습니다.
```

🔴 **그 둘이 오기 전까지 운영 코드를 만지지 않는다.**

---

## 7. 측정 한계

```
🔴 「CASE A~D 변화 0」은 **설계상 예상** 이다 — 구현 뒤 회귀로 **측정** 해야 확정된다
🔴 `price-decision.ts` 의 실측(6건 중 4건)은 **2026-09-20 값** 이고 재측정하지 않았다
🔴 참고가격이 **통화 혼합** 일 때의 규칙은 설계에 넣지 않았다(기존 통화별 분리 유지 ·
   🔴 환산 금지가 그대로라 「국내=KRW」 축에서만 성립한다)
```
