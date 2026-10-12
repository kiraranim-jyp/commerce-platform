# MI Core E2E — 국내/해외 동일상품 가격비교 완성도 검증 WU

> 🟢 **종료.** 판정은 §9 — **PARTIAL GO**.
> 🔴 **Production 0 · DB 0(SELECT 만) · 정책 0.**
> 🔴🔴 §17 답: **PARTIAL** — 끊기는 자리는 **입구(국내 링크 69/498)** 하나다.
> 🟢 계산 사슬은 작동한다 — 링크가 있으면 **79.7%** 가 비교까지 간다.

---

## 1. 최종 질문의 답

> 「상품 하나를 넣으면 국내/해외에서 같은 상품을 찾아 실제 가격을 비교하고,
>  그 결과로 판매자가 의사결정할 수 있는가?」

### **PARTIAL**

```
🟢 비교까지 간 상품   **55/498 = 11.0%**  (EXACT 링크 + 국내가 + 해외가)
🟢 그 55건은 **55/55 전부** 두 숫자를 갖는다 — 계산이 끊기지 않는다
🟢 결과도 의미가 있다 — 국내 최저가가 해외보다 **중위 +17.0% · 평균 +19.8%**
   (국내가 5% 이상 비쌈 36 · ±5% 17 · 국내가 더 쌈 2)
🔴 그러나 그 「해외 축」의 **42/55 가 KRW** 이고 라벨이 `KR_MARKET` 다 — §6 참조
```

---

## 2. STEP 1 — 🔴 E2E 경로 넷 중 **운영에 실재하는 것은 하나**

| 경로 | 운영 owner | 근거 |
|---|---|---|
| **A 국내 URL 직접 입력** | 🔴 **없다** | `links/route.ts` **GET 만** · `links/[id]` **PATCH `{verified}`** 만 · `search` POST 는 **title 필수**(`sourceUrl` 은 «원상품» URL) |
| **B 해외 URL 직접 입력** | 🔴 **없다** | 같은 이유 |
| **C 국내 후보 탐색** | 🟢 **있다** | `searchDomesticShops → withConfidence → judgeDomesticCandidate` |
| **D 해외 AI Discovery** | 🔴 **운영 호출부 0** | 선행 WU 확정(counterfactual) |

🟢 `MANUAL` 은 **판매처(샵)의 수집전략**(`DomesticSourceCollectionStrategy`)이고
**상품 URL 입력이 아니다.** `DomesticPriceSource` 는 샵 단위다(name/domain/url/currency).
🔴 UI 쓰기는 3곳뿐 — alerts PATCH · `price-history/check` POST · `links/[id]` PATCH.

🔴 **「경로 A/B 성능」은 0% 가 아니라 «측정 자체가 불가능» 하다.** 입력부가 없다.

---

## 3. STEP 0 §5-B — owner 어휘를 코드에서 읽었다

```
MatchTruth          match-truth.ts:33
DomesticPriceTier   domestic-product-link.ts:84 = EXACT|COMPARISON|REFERENCE|EXCLUDED
priceTierFromLink   :86  🟢 복제하지 않고 «호출» 했다
  EXACT_IDENTIFIER | STRONG_IDENTIFIER → EXACT
  TEXT_CONFIRMED                       → COMPARISON
  SIMILAR                              → REFERENCE
  CONFLICT | INSUFFICIENT_EVIDENCE     → EXCLUDED
  그 외(null)                           → verified ? EXACT : COMPARISON
돈이 움직이는 칸  price-history.ts:644 — exact.sellerCount>0 이면 COMPARISON 무시
```

🔴 **내가 두 번 추측해서 틀렸다**(둘 다 바로 잡았다):
```
① match_truth='SAME_PRODUCT' 로 쿼리해 **0건** 을 받았다 — 그 어휘는 **없다**.
   owner 타입을 읽지 않고 쿼리했다. 실제는 EXACT_IDENTIFIER/STRONG_IDENTIFIER/…
② product_snapshots.canonical_product 칸이 **없다**(42703). 실제는
   `workspace`(jsonb) → `workspace->'canonicalProduct'->'brand'->>'value'`
```

---

## 4. STEP 10 — E2E 퍼널 (🔴 전수 N=498)

```
① 원상품 스냅샷            **498**
② 국내 링크 보유             69   (13.9%)
③ 🟢 EXACT tier 링크 보유     58
④ 국내 가격 보유             67
⑤ 해외 관측 보유            397
⑥ 🟢 국내«와» 해외 둘 다 가격  64
⑦ 🟢🟢 COMPARABLE           **55**
🔴🔴 핵심 KPI = **55/498 = 11.0%**
```

### 🔴 끊기는 자리 (분모 400 — 링크나 가격이 하나라도 있는 스냅샷)

```
NO_LINK_AT_ALL      **331**   ← 🔴🔴 압도적
COMPARABLE             55
NO_EXACT_LINK          11
NO_OVERSEAS_PRICE       2
NO_DOMESTIC_PRICE       1
🔴 아무 링크도 없는 스냅샷 (전수 대비)  **429/498**
```

🟢 **뒤집어 읽으면 — 링크가 있으면 69 → 55 = 79.7% 가 비교된다.**
즉 **계산 사슬은 작동하고 병목은 «입구» 다.**

---

## 5. STEP 3 — Identity (링크 전수 88건)

```
matchTruth  STRONG_IDENTIFIER 31 · EXACT_IDENTIFIER 23 · SIMILAR 18 ·
            TEXT_CONFIRMED 10 · (null) 6
🟢 tier (owner 호출)  EXACT 58 · REFERENCE 18 · COMPARISON 12
verified    true 58 · false 30      status  ACTIVE 88 (전건)
crossSellerVerdict  (null) 70 · SIMILAR 11 · PRESUMED_SAME 6 · SAME 1
```

🔴 **SAME Precision/Recall 은 이 WU 에서 측정불가** — ground truth 가 운영
`verified` 69건뿐이고 그것이 **판정의 입력이기도 하다**(독립 GT 가 아니다).
🟢 독립 라벨 기준은 선행 WU 를 쓴다 — **EXACT FP 0**(3회 확증) · Recall 4/5(🔴 eligible 5).

🔴 `crossSellerVerdict` 가 **70/88 에서 null** 이다 — 그 축이 모든 링크에 채워지지
않는다. 이유는 **미조사**(추측하지 않는다).

---

## 6. 🔴🔴 STEP 6/7 — 이 WU 의 가장 중요한 발견

COMPARABLE 55건의 **해외 축이 무엇인지** 라벨로 갈랐다:

```
source_label 조합                              건수
['KR_MARKET']                                  **38**
['KR_MARKET','MARKET_PROBE','ORIGIN_FX']         10
['(null)','KR_MARKET']                            4
['(null)']                                        3

통화 조합
['KRW']                     **42**
['AUD','GBP','KRW']           10
['GBP']                        2
['GBP','KRW']                  1
```

🔴🔴 **즉 「해외 가격」이라고 비교한 것의 42/55 가 KRW 이고 `KR_MARKET` 이다.**
`price-observations.ts:294` 가 그 의미를 명시한다 —
> 「₩168,000 은 한국 방문자에게 보여주는 **판매처 자체 환산가** 라 사이트
>  스프레드가 이미 들어 있다」

🔴 그러므로 「국내 최저가 +17%」의 정확한 의미는
```
「국내 편집샵 최저가」 vs 「해외 판매처의 **한국 표시가**」
→ 둘 다 **한국 소비자 가격** 이다
→ 🟢 「어디서 사는 게 싼가」로는 유효하다
→ 🔴 「해외 시장 가격과의 비교」는 **아니다**
```
🟢 원본 시장가(`ORIGIN_FX`)가 함께 있는 것은 **10/55** 뿐이다.

🔴 **그리고 해외 retail price 를 sourcing cost 로 승격하지 않았다**(CPO §8).
`MARKET_PROBE` 가 원가로 뽑힌 사례는 선행 WU 에서 **397/397 중 0** 으로 확인됐다.

---

## 7. STEP 5 — 국내 가격 축 / tier 의미

```
COMPARABLE 안의 tier 합  EXACT 55 · REFERENCE 17 · COMPARISON 1
🟢 EXACT 가 55건 전부에 있다 → price-history.ts:644 에 따라
   **COMPARISON/REFERENCE 는 가격 결정에서 무시된다**
→ 🟢 즉 결정에 쓰이는 숫자는 «EXACT 만» 이고, 그것이 55건 전부 존재한다
```

🟢 **선행 WU 의 「COMPARISON 추가는 Decision 을 바꾸지 않는다」와 정합한다.**

---

## 8. 🔴 병목의 구조 — 브랜드가 상한을 정한다 (전수 498)

```
브랜드 32개 / 상품 498
  🔴 국내 링크가 «한 건도» 없는 브랜드 **26개** → 상품 **204** (41%)
  🟢 링크가 있는 브랜드 6개 → 상품 294 (59%)
     🔴 그 294 중 링크 보유는 **69 = 23.5%**

브랜드별 (상품 5개 이상)
  Pèpè Shoes        50개 중 31  **62.0%**   🟢 작동한다
  Bobo Choses      167개 중 28    16.8%
  AW26              44개 중  4     9.1%   🔴 AW26 은 브랜드가 아니다(backfill 문제)
  Louise Misha      16개 중  4    25.0%
  Main Story        14개 중  1     7.1%
  Sergio Tacchini   27개 중  0     0.0%   🟢 테니스 — 아동의류 샵에 없는 게 맞다
  (빈 문자열)        25개 중  0     0.0%   🔴 브랜드 미확정
  The Animals Observatory 18 · Mini Rodini 17 · Louis Louise 18 … 전부 0%
```

🔴 즉 `NO_LINK 331` 은 두 층이다 — **①브랜드 자체가 국내(우리 등록 샵)에 없다 204**
**②링크 있는 브랜드인데 그 상품을 못 찾았다 ~127.** 🔴 ①을 「검색 실패」로 읽으면 틀린다.

🟢 **이것이 선행 WU 의 CHANGE DIRECTION 과 정합한다** — Coverage 를 늘리는 것이
핵심 레버가 아닌 이유가 여기 있다. 상한이 **브랜드의 국내 유통 여부** 다.

---

## 9. 최종 판정 — **🟡 PARTIAL GO**

```
🟢 핵심 경로는 «작동한다» — 링크가 있으면 79.7% 가 비교까지 가고, 55/55 가
   두 숫자를 갖고, 결과도 사업적으로 해석 가능하다(국내 +17%)
🔴 그러나 ① 입구가 11.0% 로 좁다(상한은 브랜드의 국내 유통 여부)
   ② 경로 A/B 입력부가 아예 없다
🟢 ③ 「해외 축이 한국 표시가라 오해를 만든다」는 내 P0-2 는 **반증됐다**(§9-B)
```

### Gap 분류 (STEP 12)

```
P0 — 핵심 E2E 차단
  P0-1 🔴 경로 A/B 입력부 부재 — 셀러가 국내/해외 상품 URL 을 직접 넣어
       비교후보로 등록할 수 없다. 🔴 이 WU 에서 «구현하지 않았다»(아래 이유)
  P0-2 🟢 **취소.** 「화면이 해외 가격이라 불러 오해를 만든다」고 적었다가
       STEP 11 에서 **반증됐다** — UI 가 이미 구분한다(§11-B).

P1 — 정확도/coverage
  P1-1 국내 링크 69/498. 🔴 상한은 브랜드의 국내 유통 여부(26브랜드 204상품 = 0건)
  P1-2 crossSellerVerdict 가 70/88 에서 null — 이유 미조사
  P1-3 브랜드 미확정 25건 · AW26 44건(브랜드가 아니다)

P2 — Seller UX
  🟢 P2-1 **해소** — UI 가 두 축을 구분한다(§11-B). 이 WU 에서 새로 찾은 UX 결함 0.

P3 — 후속
  재관측 cron(GO CANDIDATE · CEO 판단 대기) · RESTOCK · NEW_SELLER · Discovery 확대
```

### 🔴 P0-1 을 구현하지 않은 이유 (STOP 이 아니라 범위 판단)

CPO §15 가 **최소 변경**을 요구했고 §18 이 범위 밖을 열거했다. 그런데 URL 직접
입력은 **새 입력 경로 + URL normalize + 샵 등록부와의 관계 + 권한 경계**를 함께
요구한다 — 「최소 변경」이 아니다. 그리고 `domestic_product_links.source_id` 가
**등록된 샵을 가리키는 FK** 라, 임의 URL 을 넣으려면 샵 등록부 의미를 바꿔야 한다.
🔴 그것은 Registry 구조 변경(§15 금지)이다. → **별 WU 로 분리한다.**

---

## 9-B. 🟢 STEP 11 — UI 가 두 축을 «이미» 구분한다 (내 P0-2 가 반증됐다)

`KR_MARKET` 이 그냥 「해외 가격」으로 표시되는 줄 알고 **P0 로 올렸다가, 포기하지
않고 소스를 끝까지 따라가서 반증됐다.** 실제 운영 경로:

```
market-intelligence → costBasis ("KR_MARKET" | "ORIGIN_FX" | null)
  → DomesticPriceIntelligencePanel:2362  costBasisIsKrMarket = costBasis === "KR_MARKET"
  → price-hierarchy.ts:453  **라벨과 기준 문장을 통째로 바꾼다**
       key:   "KR_MARKET_PRICE"   (별도 행 — 환산가 행과 다른 키)
       basis: 「이 판매처가 한국 방문자에게 직접 보여주는 가격 ·
               **환율 환산이 아닙니다**」
  → :535  landedCostComposition = "한국 표시가 + 국제배송비"
                               vs "원화 환산 + 국제배송비"
```

🟢 즉 셀러 화면에서 **「환율 환산이 아니다」가 문장으로 명시된다.** 🔴 내 P0-2 를
**취소한다.** 보고 전에 확인하지 않았으면 **없는 결함을 P0 로 올렸을 것이다.**

🔴 남는 사실은 하나다 — 「국내 +17%」의 해외 축이 42/55 에서 한국 표시가라는
**데이터 구성**이다. 그것은 결함이 아니라 **수집이 그렇게 된 것** 이고, 원본
시장가(`ORIGIN_FX`)가 함께 있는 것은 10/55 다. 🔴 왜 그런지는 미조사다.

---

## 10. Production Changes — **0**
코드 0 · DB 0 · 정책 0. 🔴 측정만 했다. 새 하니스 1개(`mi-e2e-01-core-funnel`).

## 11. Known Unknowns

```
🔴 경로 A/B 성능 — 입력부가 없어 **측정 자체가 불가능**. 0% 가 아니다
🔴 경로 D 성능 — 운영 호출부 0 → counterfactual 만 가능
🔴 SAME Precision/Recall — 독립 GT 분모 5. 일반화 금지
🔴 NO_LINK 331 의 ②층(~127건)이 「검색 실패」인지 「그 샵에 그 상품이 없음」인지
   **미분리** (선행 WU 와 같은 한계)
🔴 crossSellerVerdict null 70/88 의 이유 미조사
🔴 STEP 11 — 인증된 **Production 화면**은 열 수 없어 렌더 자체는 미검증
   (선행 메모 production-payload-is-unreachable 과 같은 벽).
   🟢 단 **소스 경로로는 추적했다**(§11-B) — 값이 UI 에서 «사라지지» 않는다
🔴 「국내 +17%」가 Seller Decision 을 실제로 바꾸는 비율은 미측정
   (선행 WU 에서 COMPARISON 추가의 Decision 영향은 0 이었다)
🔴 해외 축 42/55 가 KR_MARKET 인 것이 «의도» 인지 «수집 편향» 인지 미조사
```
