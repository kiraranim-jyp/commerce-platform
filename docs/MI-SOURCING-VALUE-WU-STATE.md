# MI Discovery → 해외 매입가 → Sourcing Value 검증 WU — 실행 상태

> 🔴 **진행 중.** 다음 실행은 새 WU 를 만들지 않고 §4 부터 이어간다. 중간 보고 금지.
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
