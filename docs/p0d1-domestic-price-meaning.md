# P0-D.1 조사 — 국내 «동일상품» 가격과 «비교상품» 가격의 분리 (코드 변경 없음)

- 일자: 2026-09-20
- 범위: **조사·시뮬레이션만.** 코드·스키마·Production 변경 0건. 판정 공식 **손대지 않음**.
- 기준: Production `c29c7e8`

---

## 0. 한 줄

**이미 두 곳은 구분하고 있다. 구분하지 않는 곳은 `verdict` 하나다.**
그리고 그 하나 때문에 실제 상품 **4건의 판정 방향이 뒤집힌다.**

---

## ① 현재 판정 공식

`computePriceDecision`([price-decision.ts:39](packages/pricing/src/price-decision.ts:39))이 읽는 것은 **넷뿐**이다.

```ts
costPriceKrw · currentSellingPriceKrw · domesticAveragePriceKrw · domesticLowestPriceKrw
```

```
marginPercent      = (판매가 − 원가) / 판매가
priceGapVsAverage  = (판매가 − 국내평균) / 국내평균
priceGapVsLowest   = (판매가 − 국내최저) / 국내최저
  → marginPercent < marginFloor(10%)  →  MARGIN_RISK / RED   (경쟁력과 «무관하게»)
  → 그 밖                              →  MAINTAIN / CONSIDER_LOWER
```

🔴 **이 함수는 `basis` 를 받지 않는다.** 국내가격이 동일상품에서 왔는지
비교상품에서 왔는지 알 방법이 구조적으로 없다.

---

## ② 국내가격 생성 lineage

```
domestic_product_links.match_truth
        ↓  priceTierFromLink
   EXACT_IDENTIFIER · STRONG_IDENTIFIER  → EXACT
   TEXT_CONFIRMED  · SIMILAR             → COMPARISON
   CONFLICT · INSUFFICIENT_EVIDENCE      → EXCLUDED  (어느 버킷에도 안 들어감)
        ↓  market-intelligence.ts:79-85  — 관측을 두 버킷으로 나눈다
   exactShopRecords / comparisonShopRecords
        ↓  summarizeDomesticMarketSplit
   { exact, comparison, resolved, basis }
        ↓  🔴 market-intelligence.ts:105
   const domesticSummary = domesticMarketSplit.resolved;
```

`resolved` 의 정의([price-history.ts:610](packages/pricing/src/price-history.ts:610)):

```ts
if (exact.sellerCount > 0)      return { …, resolved: exact,      basis: "EXACT" };
if (comparison.sellerCount > 0) return { …, resolved: comparison, basis: "COMPARISON" };
return { …, resolved: EMPTY_SUMMARY, basis: "NONE" };
```

**버킷 분리 자체는 깨끗하다.** 문제는 그 뒤에 «하나로 합쳐 내보내는» 한 줄이다.

### 🔴 소비처 넷 — 둘은 이미 구분한다

| 소비처 | `basis` 를 받는가 | 구분 |
|---|---|---|
| `computePriceDecision` (**verdict**) | ❌ 숫자만 | 🔴 **구분 안 함** |
| `computeUnifiedPriceDecision` → 내부에서 위 함수 호출 | ❌ | 🔴 **구분 안 함** |
| `computePriceRecommendation` | ✅ `domesticBasis` | 🟢 P-26 에서 CASE D(EXACT 아님 → 판단 보류) 분리 |
| `market-signals`(공급 판정) | ✅ `basis === "EXACT"` 게이트 | 🟢 *「못 찾은 경우는 항상 UNKNOWN 이며 절대 SCARCE 가 되지 않는다」* |

**즉 이 저장소는 이 구분을 이미 «알고» 있다.** 두 곳에서 지키고, `verdict` 에서만 놓쳤다.

---

## ③ EXACT 가격의 의미

「**이 상품과 같은 상품**이 국내에서 이 가격에 팔리고 있다」
— `EXACT_IDENTIFIER`/`STRONG_IDENTIFIER` 는 모델코드 같은 식별자가 일치한 것이다(P0-A).
판매자의 질문 「내가 이걸 얼마에 팔 수 있나」에 **직접** 답한다.

## ④ COMPARISON 가격의 의미

「**비슷해 보이는 다른 상품**이 국내에서 이 가격에 팔리고 있다」
— `TEXT_CONFIRMED`/`SIMILAR` 는 제목·속성이 겹쳤을 뿐 **같은 상품이라고 확인되지 않았다.**
시장 분위기는 말해도 **이 상품의 가격은 말하지 못한다.**

---

## ⑤ 🔴 둘이 섞일 때 — 실제 상품 사례

P0-D 의 `C2` 행이 그것이다.

```
해외 실구매원가   UNKNOWN
국내 동일상품     없음
국내 비교상품     ₩70,000        ← 다른 상품의 가격
        ↓
domesticCompetitivePrice.lowest = 70,000
        ↓
판정이 이 숫자를 「국내 시세」로 읽는다
```

**「국내 동일상품이 70,000원이다」와 「비교상품이 70,000원이다」는 전혀 다른 말인데,
판정 공식에 들어갈 때 같은 칸에 들어간다.**

---

## ⑥⑦ 정책 시뮬레이션 — 실제 Production 51건

국내가격을 가진 스냅샷 **51건**을 티어로 갈라 다시 계산했다.

```
EXACT 가격 보유          45건
COMPARISON 만 보유        6건   ← 정책이 실제로 건드리는 대상
티어 없는 것만 보유        0건
```

### 정책 A (EXACT 만 판정에 사용) 적용 시

| 스냅샷 | EXACT | COMPARISON | 현재 입력 | 분리 후 | 현재 판정 | 분리 후 | 바뀌나 |
|---|---:|---:|---:|---:|---|---|---|
| 43c96068 | 202,000 | 없음 | 202,000 | 202,000 | CONSIDER_LOWER | CONSIDER_LOWER | 아니오 |
| 6ab226c9 | 258,000 | 234,900 | 258,000 | 258,000 | CONSIDER_LOWER | CONSIDER_LOWER | 아니오 |
| **dbe089ae** | 없음 | 162,000 | 162,000 | **UNKNOWN** | CONSIDER_LOWER | **MAINTAIN** | 🔴 예 |
| **0c1a1b23** | 없음 | 75,000 | 75,000 | **UNKNOWN** | CONSIDER_LOWER | **MAINTAIN** | 🔴 예 |
| **e57b4678** | 없음 | 162,000 | 162,000 | **UNKNOWN** | CONSIDER_LOWER | **MAINTAIN** | 🔴 예 |
| **e727a4ee** | 없음 | 162,000 | 162,000 | **UNKNOWN** | CONSIDER_LOWER | **MAINTAIN** | 🔴 예 |

```
전체 51건 · 판정이 바뀌는 행 4건(7.8%) · 그대로 47건
```

🔴 **바뀌는 방향이 중요하다.** 넷 모두 `CONSIDER_LOWER → MAINTAIN` 이다.
즉 **지금 시스템은 「같은 상품이 아닌 물건」의 가격을 근거로 판매자에게
「가격을 낮추라」고 권하고 있다.** 판매자가 그 말을 따르면 **근거 없이 싸게 판다.**

(COMPARISON 만 있는 6건 중 2건은 마진이 지배적이라 판정이 같았다.)

### 세 정책의 차이

| | EXACT 있을 때 | EXACT 없고 COMPARISON 있을 때 | 영향 |
|---|---|---|---|
| **A** EXACT 만 사용 | 그대로 | 국내가격 **UNKNOWN** · COMPARISON 은 참고정보 | 판정 4건 변경 |
| **B** COMPARISON 을 «시장참고가» 로 사용 | 그대로 | 값은 쓰되 **동일상품 가격이 아님을 판정 데이터·UI 가 명시** | 판정 0건 변경 · 의미만 분리 |
| **C** 두 지표를 **따로** 유지 | 「동일상품 대비」 | 「비교시장 대비」 — 하나로 합치지 않음 | 판정 축이 둘로 늘어남 |

---

## ⑧ 코드 변경이 필요한 파일 (구현하지 않았다)

| 파일 | 무엇 |
|---|---|
| `packages/pricing/src/price-decision.ts` | `domesticBasis` 입력 추가(정책 A·B) 또는 지표 분리(정책 C) |
| `packages/pricing/src/unified-price-decision.ts` | basis 를 verdict 까지 전달 |
| `apps/admin/.../market-intelligence.ts:105` | `resolved` 하나로 합치는 지점 |
| `apps/admin/.../DomesticPriceIntelligencePanel.tsx` | 화면 문구(정책 B·C) |

🟢 이미 `computePriceRecommendation` 이 `domesticBasis` 를 받는 **선례가 있다** —
새 어휘를 만들 필요가 없다.

## ⑨ 데이터 변경 필요 여부 — **없다**

`match_truth` · `priceTierFromLink` · 버킷 분리가 **이미 정확하다.**
필요한 정보는 전부 있고, 판정 공식이 그것을 **안 읽을 뿐**이다. backfill 불필요.

## ⑩ 🔴 CEO 결정이 필요한 것

**「국내 동일상품이 없을 때, 비교상품 가격을 판매판정의 국내 시세로 쓸 것인가?」**

- 쓰지 않는다 → **정책 A** (판정 4건이 CONSIDER_LOWER → MAINTAIN)
- 쓰되 구분해 표시한다 → **정책 B** (판정 불변, 의미만 분리)
- 두 축으로 나눈다 → **정책 C** (판정 축 신설)

🔴 **CTO 가 결정하지 않았다.** 어느 쪽이든 판매자가 실제로 받는 «가격을 낮추라»는
권고의 근거가 달라지는 사업 결정이다.
