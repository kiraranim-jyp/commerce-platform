# CANDIDATE-PRICE-TO-MARKET-INTELLIGENCE-1 — 후보 가격은 어디까지 쓰이고 있는가

> 🔴 **조사 전용.** 운영 코드 **0** · DB **0** · 동결축 전수 유지 · 미커밋 39건 보존.
> (CPO: 「운영 코드 변경은 **정책 충돌을 해결하기 전까지** 금지」)

---

## 0. 결론 — **①②③ 은 «이미» 되어 있다. 막힌 것은 «수익성 판단» 하나다**

```
🟢🟢 **CPO 전제를 데이터로 정정한다** — 「동일상품 EXACT 가 아니라고 가격을 버린다」는
     **대체로 사실이 아니다.** 가격이 있는 후보 **224건** 중 금액 축에서 빠지는 것은 **3건** 이고
     그 3건은 전부 **CONFLICT**(= 다른 상품으로 «관측된» 것)다.
     tier 분포  COMPARISON **165** · EXACT **56** · EXCLUDED **3**
     ⟹ `PRESUMED_SAME`(→ `COMPARISON`) 가격 **165건은 이미 참고가격 축에 들어간다**
🟢 화면의 「🇰🇷 국내 참고가격 KRW 88,000」이 **바로 그 후보 가격** 이다(EXACT 아님).
🔴 **진짜로 막힌 것은 하나** — `domesticBasis !== "EXACT"` → `marketCase D` → 수익성 **판단 불가**.
```

---

## 1. ① 수집된 후보 가격 — 전수 (DB `candidate_reviews`)

| tier | match_truth | 건수 | 금액 축 진입 |
|---|---|---:|---|
| `COMPARISON` | TEXT_CONFIRMED | **165** | 🟢 **들어간다** |
| `EXACT` | STRONG_IDENTIFIER | 49 | 🟢 들어간다 |
| `EXACT` | EXACT_IDENTIFIER | 6 | 🟢 들어간다 |
| `EXACT` | (null · 낡은 저장분) | 1 | 🟢 들어간다 |
| `EXCLUDED` | **CONFLICT** | **3** | 🔴 **빠진다** |
| `REFERENCE` | SIMILAR | **0** | (표본에 없다) |

🔴 **가격이 있는데 참고가격 밖 = 3 / 224**. 🟢 그 셋은 **CONFLICT** 이고 WU-062 가 의도적으로
금액에서만 뺀 축이다(`byPriceTier`·`count` 관측에는 **남는다** — 사라지지 않는다).

---

## 2. ② 판정 ↔ 가격은 **이미 독립 보존** 된다

```
DB `candidate_reviews` 가 **서로 다른 칸** 으로 들고 있다:
  판정 축   `system_verdict` · `match_truth` · `price_tier` · `blockers` · `human_verdict`
  가격 축   `price_amount` · `price_currency` · `price_status`
⟹ 🟢 「동일상품 판정이 아니라서 가격 관측이 사라진다」는 **구조적으로 일어나지 않는다**.
🟢 운영 집계기도 같은 원칙을 **주석으로 적어 뒀다**(`candidate-market.ts:441`):
   「**금액 자격만** 좁힌다 — tier·verdict·**노출은 불변** 이다(CPO: 숨기지 말라)」
```

---

## 3. ③ 셀러 화면 연결 — **이미 되어 있다**

```
🇰🇷 국내 참고가격  KRW 88,000 · 확인 1곳      ← `candidateDomesticPrice`(후보 가격 집계)
🌎 해외 최저 소싱가 GBP 37 · SGD 70 · USD 40.6 ← 같은 집계기의 해외 축
🇰🇷 국내 소싱 후보 3곳 · 후보 보기            ← 후보 목록(판정 라벨 포함)
동일상품 확인 0곳                              ← **별도 축**(displayTier SAME 수)
```
🟢 즉 **「가격 관측」과 「동일상품 신뢰도」가 이미 다른 줄로 서 있다** — CPO 가 요구한 구조다.

### 🔴🔴 그런데 「확인 **1곳**」의 정체를 이번에 규명했다

국내 후보는 **둘 다 KRW 88,000** 인데 화면은 **1곳** 이라 한다. 원인:
```
candidate-market.ts:309  PRICE_DISQUALIFYING_BLOCKERS = {
   BRAND_MISMATCH · NO_TITLE_OVERLAP · SAME_SELLER_DISTINCT_LISTING }
  vividvia.com  BRAND_MISMATCH      → 🔴 `observedDifferenceCount += 1` · **금액에서 제외**
  donokids.com  BRAND_UNCONFIRMED   → 🟢 그 목록에 **없다** · **금액에 포함**
⟹ 「확인 1곳」 = donokids 하나. **설명 완료.**
```
🟢 그 설계가 이미 CPO 의 새 방향과 같다 — 주석(:439)이 **`BRAND_UNCONFIRMED` 를 일부러
빼지 않았다** 고 적는다(「그 사유의 4건이 **사람 SAME** 이다」).

---

## 4. ④ 후보 가격으로 **어디까지 가능한가** (기존 구조 그대로)

| 기능 | 현재 | 근거 |
|---|---|---|
| 후보 가격 **표시** | 🟢 **된다** | `candidateDomesticPrice` · tier EXACT\|COMPARISON |
| 통화별 **최저/범위** | 🟢 된다 | `byCurrency` |
| **판매처 수** | 🟢 된다 | 판매처 단위 중복 제거(`lowestBySeller`) |
| 후보 목록 + 판정 라벨 | 🟢 된다 | 후보 카드 |
| **시장 가격대 요약** | 🟢 된다 | `buildPriceGuide`(SAME 축) / 참고가격(COMPARISON 포함) |
| 🔴 **수익성 판단**(마진·추천가 B) | 🔴 **막힌다** | `domesticBasis !== "EXACT"` → CASE D |
| 🔴 **판매 추천 verdict** | 🔴 막힌다 | `READY` 가 `domesticBasis === "EXACT"` 요구 |

---

## 5. ⑤ 🔴🔴 **정책 충돌 — 한 줄로 특정된다**

```
packages/pricing/src/price-recommendation.ts:123
  if (input.domesticBasis !== "EXACT" || input.domesticLowestPriceKrw == null) → marketCase "D"
      ⟹ recommendedPrice **null** · estimatedMarginPercent **null**
호출부 market-intelligence.ts:600  `domesticBasis: domesticMarketSplit.basis`
```

**충돌의 정확한 모양**
```
기존 정책  「검증되지 않은 유사상품 가격으로 **시장 경쟁력 있음/판매 비추천을 확정하지
           않는다**」(그 함수 주석 원문) — 즉 **EXACT 만 수익성 입력**
새 요구    「수집된 가격 분포와 원가로 **판매가격 및 예상 수익성을 분석** 한다」
⟹ 🔴 두 문장은 **같이 성립하지 않는다.** CPO 가 지적한 그대로다.
```

🟡 **CPO 가 고를 선택지(🔴 CTO 가 고르지 않았다 · 전부 정책)**
```
① 현상 유지        수익성은 EXACT 에서만. 후보 가격은 **참고가격으로만** 보여준다(현재)
② 신뢰도 등급제     COMPARISON 가격으로도 수익성을 **내되 등급을 같이 표시** 한다
                   (예: 「참고 기준 · 동일상품 미검증」) 🔴 `marketCase` 계약 변경 = CPO 승인
③ 별도 축 신설      기존 CASE A~D 를 **건드리지 않고** 「참고 기준 수익성」을 **다른 칸** 으로
                   낸다 🟢 기존 계약 보존에 가장 안전 · 🔴 새 칸이므로 설계 승인 필요
🔴 어느 것도 `PRESUMED_SAME → EXACT` 승격이 **아니다** — tier 는 그대로 둔다
```

---

## 6. ⑥ 「사용한 후보 / 제외한 후보」 — **계산은 이미 한다. 화면이 안 말한다**

```
🟢 집계기가 **이미 세고 있다**  `unverifiedCount`(가격 미확인) ·
   `observedDifferenceCount`(관측된 차이) · `byPriceTier` · `byMarket` · `count`
🔴 그런데 화면은 **「확인 1곳」만** 말한다 — 「1곳은 **관측된 차이**(BRAND_MISMATCH)로
   금액에서 뺐다」가 **보이지 않는다**.
⟹ 🟡 **이것이 이 WU 에서 가장 싸고 안전한 개선 후보** 다 — 집계 변경 **0** ·
   이미 계산된 수를 **읽어서 한 줄** 로 적는 것이다(WU-133 의 `pendingNote` 와 같은 모양).
🔴 단 **1차 노출 계약**(`UX-06-a` 설명문 1줄 · `UX-06-b` 25%)과 만나므로 자리 선택은
   CPO 결정이다(상세 접힘이 안전하다).
```

---

## 7. 측정 경계

```
🔴 `candidate_reviews` 는 **저장된 부분집합** 이다(화면 수치와 1:1 이 아니다)
🔴 tier 분포 224건은 **전 스냅샷 합계** 다 — 한 상품의 분모가 아니다
🔴 `REFERENCE`(SIMILAR) 가 **0건** 인 것은 「그 tier 가 없다」가 아니라 **이 표본에 없다**
🔴 `marketCase`·`sellability` 는 저장되지 않는 계산값 ⟹ §4·§5 는 **코드 추적** 이다
🔴 해외 축 수치(GBP 37 · SGD 70 · USD 40.6)는 화면 관측이고 DB 저장분과 분모가 다르다
```
