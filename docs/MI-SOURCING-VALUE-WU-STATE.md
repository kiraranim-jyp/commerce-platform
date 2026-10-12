# MI Discovery → 해외 매입가 → Sourcing Value 검증 WU — 실행 상태

> 🟢 **종료.** 최종 판정은 §7 이다 — **CASE B/D 혼합 → HOLD**.
> 🔴🔴 Discovery 축은 `COUNTERFACTUAL / NON-PRODUCTION`(운영 호출부 0).
> 🔴🔴 Discovery 축은 `COUNTERFACTUAL / NON-PRODUCTION`(운영 호출부 0).
> 🟢 선행 WU 셋 CLOSED — 국내 Coverage(CHANGE DIRECTION) · MI Discovery(HOLD) ·
>    Price Enrichment(HOLD, 「해외 통화·해외 판매처라 국내 축에 못 들어간다」).

---

## 1. Strategic Question

> Gemini Discovery 의 해외 SAME 후보 가격이 기존 `SELLER_ORIGIN` 으로 얻지 못하던
> **incremental 해외 sourcing intelligence** 를 만드는가.

🔴 「환율 기능을 만들자」가 아니다. **축 자체의 사업 가치**를 먼저 검증한다.

---

## 2. 🟢 §5-B Preflight — 가격 «의미» owner 확정 (전부 실측)

### 2-1. 🔴🔴 `SELLER_ORIGIN` 행 중에도 «원가가 아닌» 것이 있다

`run-price-check.ts:128-133` 이 명시한다:
```
source: "SELLER_ORIGIN",
// 원가 근거(KR_MARKET/ORIGIN_FX)와 구분되는 라벨 — 원가/마진/CASE 판정이
// 이 행을 원가로 «잘못 읽지 않도록» 하는 유일한 표식이다.
sourceLabel: MARKET_PROBE_SOURCE_LABEL,   // = "MARKET_PROBE" (price-observations.ts:264)
```

🔴 즉 `source` 만 보면 안 되고 **`sourceLabel` 을 같이 봐야 한다.**

### 2-2. 🟢 원가 선택 owner

```
selectCostBasisOriginObservations(originRecords)   ← market-intelligence.ts:104
costPriceKrw = originHistory[0]?.priceKrw          ← :168
costBasis    = originHistory[0]?.sourceLabel as "KR_MARKET" | "ORIGIN_FX" | null  ← :173
```

🔴 그 파일 주석이 **왜** 그 선택이 필요한지 적어 뒀다(GLOBAL-ORIGIN-PRICE-WIRING-1,
CEO 지시 2026-09-13):
> 「한 번의 확인이 원본가(`ORIGIN_FX`)와 한국 표시가(`KR_MARKET`)를 **둘 다** 남긴다.
>  원가는 **원본 시장 가격 기준**이어야 하므로(₩168,000 은 판매처가 한국 방문자에게
>  보여주는 **자체 환산가**다) 선택 규칙을 헬퍼 한 곳에 모았다.」

🟢 **즉 「원가」의 정의가 코드에 이미 있다 — 원본 시장 통화 기준이다.**
🔴 그래서 Gemini 해외 후보 가격(EUR/GBP/USD)은 **원가 축과 같은 통화 계열**이고,
   선행 WU 에서 막힌 국내 축(`domesticLowestPriceKrw`)과 다르다. 이 WU 의 전제가 성립한다.

### 2-3. 🟢 환율 owner — **운영에 있다(§6 경우 A)**

```
convertToKrwStrict(amount, currency, liveRates?)   packages/pricing/src/currency.ts:73
  → hasKnownRateToKrw 가 false 면 **null** (🟢 모르면 숫자를 만들지 않는다)
관련 owner  apps/admin/src/lib/exchange-rates.ts · api/exchange-rates/route.ts ·
            packages/pricing/src/{breakdown,landed-cost,price-intelligence}.ts ·
            DB 테이블 `exchange_rates`
```

🟢 **임의 환율을 만들지 않는다.** `convertToKrwStrict` 를 그대로 쓴다.

### 2-4. 가격 source 의미 구분 (§2 요구)

```
SELLER_ORIGIN   원상품 판매처 관측. 🔴 sourceLabel 로 갈린다 —
                ORIGIN_FX(원본 시장가) · KR_MARKET(판매처의 한국 표시가) ·
                MARKET_PROBE(🔴 원가로 읽으면 안 되는 시장 probe)
DOMESTIC_SHOP   국내 편집샵 관측 → domesticLowestPriceKrw 축
NAVER_SHOPPING  어휘만 존재 · DB 0행 (선행 WU 확정)
해외 candidate price  Gemini 후보의 판매가격. 🔴 «판매가» 이고 «매입가» 가 아니다
```

🔴 **지시서 §5 의 경고가 코드와 일치한다** — 해외 판매가격을 `SELLER_ORIGIN` 으로
   자동 승격하지 않는다. 별도 observation 으로 둔다.

---

## 3. 선행 WU 에서 가져오는 확정 사실 (재측정 금지)

```
🟢 Price Enrichment 성공률 100%(18/18 시도) · verifiedCurrent 18
🟢 가격 통화  GBP 7 · EUR 7 · USD 4 · 🔴 KRW 0
🟢 가격 호스트 8곳 전부 해외 — bobochoses · dreamsofcuteness · gilukids ·
   junioredition · lefanfare.nl · little-wares · main-story · scoutandcokids
🟢 MI Identity(counterfactual) Precision 91% · Recall 83% · EXACT FP 0
🟢 KNOWN_SAME 12쌍 / 4-of-7 상품
🔴 enrichment 선별 규칙 — very_high|high|medium 또는 SAME_MODEL_VARIANT · 샵당 상한 2
🔴 28/40 호스트쌍은 eligible 0 이었다
🔴 측정불가 ≠ 0% · CONTROL = 운영값 재현(「돌았다」 아님)
```

---

## 4. 다음 실행이 «즉시» 할 것

```
STEP C  CONTROL — 운영 SELLER_ORIGIN 관측(DB 1476행)을
        `selectCostBasisOriginObservations` 에 넣어 **운영 costPriceKrw/costBasis 를
        재현** 한다. 🔴 「가격이 나왔다」가 아니라 **같은 값** 이어야 한다.
STEP D  GT 재사용 — KNOWN_SAME 12쌍 + 가격 18건 (A~E strata, §4)
STEP E  통화 정규화 — `convertToKrwStrict` 로 read-only 환산.
        🔴 환율 테이블이 비어 있으면 **null 그대로** 두고 「측정불가」로 적는다.
STEP F  A↔B 비교 — 기존 costPriceKrw ↔ Discovery SAME 최저 해외가(KRW 환산)
        🔴 NOT_SAME 저가가 섞이는지(§8-C) 같이 센다
STEP G  Incremental information — SELLER_ORIGIN 유/무로 갈라서
        「Discovery 만이 주는 새 가격 정보」 건수
STEP H  비용 + §12 CASE A~E 자동 판정 → 최종 보고 1회(19항)
```

---

## 5. 🔴 금지사항 (CPO §11)

```
X Production Discovery 연결 · Gemini prompt 변경 · threshold 변경
X Vision Production 연결 · UniversalExtract fallback · Registry UI
X 국내 판매처 추가 · domesticLowestPriceKrw 의미 변경
X 🔴 해외가격을 국내 필드에 저장 · 해외 판매가를 SELLER_ORIGIN 으로 자동 승격
X 🔴 Production FX 기능 신규 구현 · 임의 환율 하드코딩
X 가격이 싸다는 이유만으로 SAME 승격 · UNKNOWN 임의 처리
X 🔴 측정 중 발견한 Production 결함을 «이번 WU 에서» 수정 (§13)
   → `Observed Production Defect` 로 기록하고 별 작업 단위로 분리한다
```

---

## 6. 🟢 STEP C~H 측정 결과

### STEP C — 🟢 CONTROL PASS (원가 선택 규칙 재현, FULL POPULATION)

```
SELLER_ORIGIN 관측 1476행 / 스냅샷 397개 전부에 대해
  withCost 397/397
  🟢 MARKET_PROBE 가 원가로 뽑힌 스냅샷 **0**     ← 라벨 분리가 실제로 작동한다
  🟢 ORIGIN_FX 보유 257 · 그중 KR_MARKET 이 «실제로 제거된» 136
  costBasis 분포  ORIGIN_FX 257 · KR_MARKET 91 · (null) 49
```
🔴 즉 「함수가 돌았다」가 아니라 **운영 주석이 선언한 규칙과 같은 결과**를 확인했다
(ORIGIN_FX 가 있으면 KR_MARKET 을 버린다 · MARKET_PROBE 는 원가가 아니다).

### ①②③ Funnel — 🔴 sample N=3 상품

```
products 3 · withKnownSameHost 3 · withAnySamePrice 3 · withNormalizedKrw **3**
🟢 환산 불가 가격 **0**  (통화 GBP · EUR · USD 전부 운영 환율표에 있다)
사용 환율  AUD CAD CHF CNY DKK EUR GBP HKD … (frankfurter, fetched_at 2026-10-08)
🔴 표본이 3 이다. **일반화 금지.**
```

### ⑤ 기존 원가 coverage

```
원가 있음 3/3 · 없음 0 · costBasis 전부 **ORIGIN_FX**
→ 🔴 §8-B 「Discovery 만이 주는 새 가격 정보」 = **0**
   (이 표본에는 원가가 없는 상품이 하나도 없다)
```

### ⑥ §8-A 원가 경쟁력 — 🟡 1건만 유의미

```
원가보다 -5% 초과로 낮음   **1**   Bobo Choses  -9.9%
동일/유사 (±5%)            **2**   Main Story -2.1% · AW26 -4.2%
더 높음 (+5% 초과)          0
비교 가능 쌍                3/3

🟢 -9.9% 의 실체 (환산 내역을 그대로 남긴다)
  원가(ORIGIN_FX)      108,420 KRW
  bobochoses.com       EUR 65 → 97,681 KRW   ← 최저
  junioredition.com    GBP 61 → 108,232 KRW  ← 원가와 거의 같다
→ 🔴 즉 「더 싼 매입처를 찾았다」가 아니라 **원상품을 산 곳(junioredition)보다
  브랜드 공식몰(bobochoses.com)이 EUR 기준으로 더 싸다**는 관측이다.
```

### ⑦ §8-C 🔴 오염이 «실제로» 관측됐다

```
🔴 NOT_SAME 저가가 SAME 최저가를 밑도는 상품 **1/3**
  Main Story「Bubble Sweatshirt in Grey Melange」
    SAME 최저     101,135 KRW
    NOT_SAME 최저  99,360 KRW   ← 🔴 더 싸다
    원가          103,323 KRW
→ 「싸다」를 채택 근거로 쓰면 **다른 색상/다른 상품 가격이 매입가로 들어온다.**
```

### ⑧ Downstream decision — 🔴 이 축은 «건드리지 않았다»

`computePriceDecision` 은 `domesticLowestPriceKrw` 축이고 해외가는 그 칸에 넣지
않았다(§11). `costPriceKrw` 를 바꾸는 것은 **Production 정책 결정**이므로 이번 WU
에서 하지 않았다. → **decision change 측정 = 범위 밖(측정하지 않음).**

### ⑨ 비용

```
선행 WU 에서 이어진 비용 — lightFetch 202 · enrich 40 · Vision 16
이번 STEP 추가 비용 0 (전부 캐시/읽기 전용 덤프 + 순수 함수)
🔴 cost / incremental sourcing information = **측정불가**
   (§8-B incremental = 0 이라 분모가 0)
```

---

## 7. 최종 판정 — **HOLD** (§12 CASE **B + D 혼합**)

```
CASE B  정보는 추가되지만 실제 결정 변화 없음
        → 가격은 3/3 환산됐고 1건이 -9.9% 였다. 그런데
          🔴 §8-B incremental(원가 없는 상품에 새 정보) = **0**
          🔴 decision change 는 정책 경계라 측정하지 않았다
CASE D  저가 후보가 NOT_SAME 에 오염
        → 🔴 1/3 상품에서 **실제로 발생** (NOT_SAME 99,360 < SAME 101,135)
```

### 가설 판정 (§10)

```
H1 Discovery 가 SELLER_ORIGIN 보다 더 많은 해외 가격 정보를 준다
   🔴 **반증** — 표본 3/3 에 이미 ORIGIN_FX 원가가 있다. 새 정보 0건
H2 그 가격 정보가 실제 SAME 에 집중된다
   🟡 **부분 지지** — SAME 가격 16건 확보. 단 NOT_SAME 에도 가격이 붙고 더 싸다
H3 해외 가격을 정규화하면 기존 원가 판단과 «의미 있는» 차이가 난다
   🟡 **약하게 지지** — 3건 중 1건 -9.9% · 2건은 ±5% 안(=차이 없음)
H4 그 차이가 실제 Sourcing 판단을 개선한다
   🔴 **미검증** — costPriceKrw 변경은 정책 경계다(§13). 측정하지 않았다
H5 추가 비용 대비 incremental information 이 충분하다
   🔴 **반증** — incremental = 0 이므로 분모가 0. 측정불가
```

### 🔴 Observed Production Defect — 이번 WU 에서 «고치지 않았다»(§13)

```
없음. 측정 중 Production 결함을 발견하지 못했다.
🟢 오히려 두 설계가 «의도대로» 작동함을 확인했다 —
   ① MARKET_PROBE 가 원가로 뽑히지 않는다(397/397)
   ② convertToKrwStrict 는 모르는 통화에 null 을 낸다(환산 불가 0건은
      표본 통화가 전부 환율표에 있었기 때문이고, 규칙이 느슨해서가 아니다)
```

---

## 8. Known Unknowns

```
🔴 sample N=**3** 상품. Discovery 비교가 가능한 상품이 그것뿐이었다 — 일반화 금지
   (선행 WU 의 (상품×호스트) 40쌍 중 KNOWN_SAME 가격이 붙은 상품이 3개)
🔴 §8-B incremental 0 은 「원가 없는 상품이 표본에 없었다」는 뜻이다.
   전체 497 중 원가 없는 상품에 Discovery 를 돌리면 달라질 수 있다 — 미측정
🔴 H4(결정 개선)는 정책 경계로 측정하지 않았다. costPriceKrw 를 바꾸는 것이
   옳은지는 CPO/CEO 판단이다
🔴 NOT_SAME 오염 1/3 은 표본이 작다. 다만 **방향은 분명하다**(더 싸다)
🔴 환율은 fetched_at 2026-10-08 스냅샷 하나로 계산했다. 시점 민감도 미측정
🔴 「판매가 ≠ 매입가」 — 이번에 쓴 해외가는 전부 **소매 판매가** 다.
   실제 매입가(도매/B2B)는 이 경로로 알 수 없다
```

## 9. 다음 전략 질문 (CPO 몫)

```
🔴 이번 WU 가 드러낸 것은 「Discovery 가 원가를 더 싸게 찾는다」가 아니라
   **「우리가 이미 원가를 갖고 있다(397/397)」** 는 사실이다.
→ 그러면 Discovery 의 가치는 «원가 발견» 이 아니라 다른 축일 수 있다 —
   예: 품절/재입고 감시 · 시장 가격 추세 · 신상품 발견.
🔴 단 그것은 이 WU 의 질문이 아니다. 범위를 새로 받아야 한다.
```
