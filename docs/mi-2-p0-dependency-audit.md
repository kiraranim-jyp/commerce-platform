# MI-2 — MI P0 의존관계 재조사

> CTO 조사 보고(2026-09-26). **구현하지 않았다.** MI-1 의 결론 하나를 «정정» 한다.

## 0. 먼저 — MI-1 보고의 정정

MI-1 에서 「cron 부재 = P0」라고 적었다. **그 표현이 부정확했다.**

원가는 시계열이 아니라 **최신 관측 1건**만 쓴다
(`market-intelligence.ts:169-183` · `compute-readiness.ts:141-142` — `originHistory[0]`).
그래서 **cron 이 없어도 MI 판단은 돈다** — 화면을 열 때 갱신되기 때문이다.

🔴 정확한 표현: **cron 부재는 「판단 가능 여부」가 아니라 「판단의 신선도 · 알림 ·
주기적 재검증」의 문제다.** 아래 2번에서 셋으로 나눈다.

## 1. ① P0 의존관계 — 실제 코드 흐름

```
원본 사이트
  ↓ 통화 «등록제» (추측 없음)            source-currency-policy.ts
  ↓ convertToKrwStrict — 환율 모르면 null   currency.ts:57-70
price_observations
  ├─ sourceLabel = ORIGIN_FX   원문×환율
  └─ sourceLabel = KR_MARKET   실제 한국 표시가
       ↓ selectCostBasisOriginObservations — ORIGIN_FX «우선»   price-observations.ts:303
  costPriceKrw = originHistory[0].priceKrw        ← 🔴 «최신 1건»
       ↓  (LATEST_SALE > LATEST_PRICE > STATIC_SNAPSHOT, 품절은 승격 금지)
  ┌────────────────────────────┬──────────────────────────────┐
  │ computePriceRecommendation │ computeSellability           │
  │   domesticBasis === EXACT  │   domestic.matched           │
  │   domesticLowestPriceKrw   │   domestic.averagePriceKrw   │
  │        ↓ CASE A/B/C/D      │        ↓ GREEN/YELLOW/RED/UNKNOWN │
  └────────────────────────────┴──────────────────────────────┘
                     ↓                        ↓
              화면 판정 배지            readiness → 대시보드 · 등록화면
```

### 🔴 1-1. 발견: 두 판정이 «다른 통계» 를 쓴다

| 판정 | 쓰는 값 | 근거 |
|---|---|---|
`computePriceRecommendation`(CASE) | 국내 **최저가** `domesticLowestPriceKrw` | price-recommendation.ts:46 · :147 |
`computeSellability` | 국내 **평균가** `averagePriceKrw` | sellability.ts:20 · :64 |

같은 상품·같은 후보 pool 에서 **최저가와 평균가**를 각각 본다. 후보가 여러 개이고
가격이 벌어져 있으면 두 배지가 다른 방향을 가리킬 수 있다(CASE C=비추천 인데
Sellability GREEN, 또는 반대).

🔴 **이것이 의도인지 확인 못 함.** 「CASE 는 실제 판매 가능 가격(최저가)이 근거」라는
주석은 있는데(price-recommendation.ts:14), Sellability 가 평균가를 쓰는 이유는
적혀 있지 않다. **판단이 둘로 갈리는 지점이라 P0 후보다.**

### 1-2. 잘 돼 있는 것 — 기준을 통일한 기록

`compute-readiness.ts:140-162` 에 P0-D.3(2026-09-20) 이 이미 같은 부류의 구멍을
닫아 둔 기록이 있다: 대시보드가 EXACT/COMPARISON 을 합산해서 「동일상품을 찾았다」로
말하던 것. **같은 종류의 사고가 한 번 더 있다는 뜻**이고, 1-1 이 그 다음 후보다.

## 2. ② Cron 의 역할 — 셋으로 나눈다

| 용도 | 필요한 관측 수 | cron 없으면 | 등급 |
|---|:---:|---|---|
**판단**(Sellability · CASE · 수익성) | **1건**(최신) | 화면 열 때 갱신 → **돈다** | — |
**신선도** | 1건이지만 «최근» 이어야 | 🔴 열지 않은 상품은 마지막 방문 시점 값으로 판단 | **P0** |
**추이·알림**(`price_alerts`) | **2건 이상** | 🔴 축적이 방문 의존 → 이름만 남음 | **P1** |
**링크 주기 재검증**(`verified` 링크) | 반복 | 🔴 낡은 verified 를 감지 못함 | **P1** |

🔴 **신선도가 P0 인 이유**: 대시보드는 «저장된» readiness 를 읽는다. 여러 상품을
한 화면에서 볼 때 각 상품의 원가는 「마지막으로 그 상품 화면을 연 시점」의 것이다.
셀러는 그것이 오늘 값인지 두 달 전 값인지 화면에서 알 수 없다.

**즉 cron 은 P0 이지만 「없으면 판단 불가」가 아니라 「판단이 조용히 낡는다」다.**
그리고 고칠 방법은 cron 말고도 있다 — 관측 시각을 화면에 «보이게» 하는 것(더 싸다).

## 3. ③ 국내 동일상품 매칭 — Precision 우선이 «실제로» 구현돼 있다

### 두 축이 있고, 역할이 다르다

| 축 | 정하는 곳 | 쓰임 |
|---|---|---|
`match_type`(EXACT/HIGH/REVIEW/NOT) | `match.ts:241` `classifyMatchLevel` — 텍스트 점수만 | **화면 배지** |
`match_truth`(6단계) | `match-truth.ts:59` `deriveMatchTruth` — 식별자 증거 + 교차판매처 | **가격 계산 대상** |

**가격에 들어가는 조건**(`domestic-product-link.ts:51-56`):

```
EXACT_IDENTIFIER · STRONG_IDENTIFIER   → EXACT      (동일상품 버킷)
TEXT_CONFIRMED · SIMILAR               → COMPARISON (참고 버킷)
CONFLICT · INSUFFICIENT_EVIDENCE       → EXCLUDED   (가격 어디에도 안 씀)
matchTruth 없음(레거시)                 → verified ? EXACT : COMPARISON
```

🔴 즉 **화면에 보이는 등급과 가격에 쓰이는 등급이 다르다** — 의도된 분리이고,
「데이터 존재 ≠ 판단 사용」이 코드로 서 있다.

### threshold 는 전부 «코드 상수» 다

`0.95 / 0.85 / 0.7`(match.ts:242-244). 설정 파일이 아니다. 이전 경계(95/80/60)에서
대표님이 확정한 값으로 교체된 기록이 주석에 있다.

### Precision 장치 넷

* 브랜드 게이트 — 불일치면 점수 ×**0.2** (match.ts:429-442)
* 식별자 우선 — 일치면 최소 0.97 강제, 불일치면 ×**0.3** (match.ts:385-394)
* CONFLICT 조기 반환 — 연령/성별/카테고리/색상/품번 불일치는 **점수 합산 전에** 종료
* CONFLICT 가 품번을 «이긴다» (match-truth.ts:67)

### 🔴 3-1. 미해결로 «기록된» 것 — P0 최우선 후보

`match-truth-priority.test.ts:64` 와 `identifier-safety.test.ts:188-200` 이 현 상태를
그대로 적어 두었다:

> 품번이 exact 이면 high 이상에서 `EXACT_IDENTIFIER` 가 되고, 이것은 같은 판매처
> 중복 진열 차단(`SAME_SELLER_DISTINCT_LISTING`)으로도 **막히지 않는다.**
> junioredition.com 7쌍이 «정확히 이 모양으로» EXACT 에 들어간다.

실제 사고 기록(같은 품번 다른 상품):

| 쌍 | 품번 | 실제 차이 |
|---|---|---|
Minnie Body ↔ Onesie | KS106168-P05261 | 바디수트 vs 우주복 |
Bubble Grey ↔ Graystone | AW26MS185 | 색 |
Giulia Sandals 4색 | 01325 | 색 |
Misha&Puff 카디건 ↔ 롬퍼 | partial | 옷의 «형태» |

🔴 **이것이 「국내 동일상품 매칭 정확도」 P0 의 구체적 내용이다.** 추상적인 「정확도
개선」이 아니라 **「판매처가 품번을 여러 상품에 재사용할 때 EXACT 가 뚫린다」** 는
한 문장짜리 결함이고, 테스트가 이미 그 사실을 고정해 두었다.

## 4. ④ 해외가격 · 통화 · ORIGIN_FX

### 🔴 4-1. 「Smallable JP → EUR 오인」은 «지금 코드에 없다»

지시서가 P0 로 지목한 그 버그를 찾지 못했다. 찾은 것은 그 반대다:

* `source-currency-policy.ts:46-73`(SMALLABLE-PRICE-1, 2026-09-12) — smallable 이
  배송국가별로 **다른 가격을 EUR 로** 낸다는 실측: FR €75 / KR €73 / US €79 / JP €81.
  **JP 요청에 EUR 가 오는 것이 «정상 동작» 이고 통화 오인이 아니다.**
* `smallable-market-probe.test.ts:24-33`(2026-09-13 fixture) — `country=JP` → EUR 81.
* 그리고 «요청한 배송국가가 응답에 남아 있는지» 검증하는 관문이 있다
  (`smallable-market-probe.ts:186-214`) — 응답이 요청과 다르면 **관측을 저장하지 않는다.**

🔴 **결론: 이 축은 2026-09-12~13 작업으로 이미 구조적으로 막혀 있다.** 없는 버그를
고치지 않는다. 다만 **당시 CEO 가 본 화면이 무엇이었는지는 확인 못 함** — 그때
관측된 행이 DB 에 남아 있다면 그것은 옛 데이터이고, 지금 규칙으로 다시 수집되지
않는다(옛 분석을 소급 변경하지 않는 원칙과 맞물린다).

### 4-2. 통화를 «지어내지 않는다» — 확인됨

* 통화는 **등록제**(Shopify `/meta.json` · smallable `?currency=` 강제 + 재검증).
  추론 폴백 없음.
* `convertToKrwStrict()` — 환율 모르면 **null**(currency.ts:57-70). 저장 단계는 전부
  strict 를 쓴다 → 🔴 **통화/환율을 모르면 관측 행 자체를 만들지 않는다.**
* `convertToKrw()`(비-strict, 폴백 허용)는 «화면 표시/편집» 에만 쓰인다.

### 4-3. 환율 — 자동이지만 «계기» 가 호출 시점이다

`fetchLiveExchangeRates()`(Frankfurter/ECB) → 실패 시 DB `exchange_rates` 캐시 →
그것도 없으면 코드 고정표(「한 번도 성공한 적 없음」). `fetched_at` 을 남기고
**끝난 분석을 나중 환율로 다시 계산하지 않는다**(마이그레이션 045 명시).

🔴 갱신 계기가 **가격 확인이 돌 때**다 → 2번의 신선도 문제와 **같은 축**이다.

## 5. ⑤ Sellability / CASE 요약

| | 입력 | 값 | 「모름」 처리 |
|---|---|---|---|
CASE | 원가 + 국내 **최저가**(EXACT 만) | A/B/C/D | **D**: EXACT 없음 → 브랜드 중앙값 «참고치» 만(`competitiveBasis: BRAND_MEDIAN`) |
Sellability | 원가 + 국내 **평균가** + matched | GREEN/YELLOW/RED/UNKNOWN | **UNKNOWN**: 원가 없음 / **YELLOW**: 미매칭 |
수익성 | 원본가 + 배송비 + 수수료 + 마진 | 숫자 | **null**: 배송비 `null` → 「확인 불가」 |

🔴 셋 다 등록을 **막지 않는다**. 「확인 필요」로 말한다 — 이 설계는 **지킬 것**이다.

## 6. P0 재정렬 제안 (CPO 확정 대기)

```
P0-1  🔴 품번 재사용 EXACT 관통          match-truth 우선순위 — 테스트가 이미 기록
      → 「동일상품 매칭 정확도」의 구체적 내용. 가격 판단을 직접 오염시킨다.

P0-2  🔴 CASE(최저가) vs Sellability(평균가) 근거 불일치
      → 같은 상품에 두 배지가 다른 말을 할 수 있다. 의도 확인 → 통일 또는 명시.

P0-3  ⚠️ 판단의 «신선도» 가 보이지 않는다
      → cron 이 한 방법이지만, 관측 시각을 화면에 보이게 하는 것이 더 싸다.
        둘 중 무엇을 먼저 할지는 제품 판단.
```

```
P1-1  추이·알림(price_alerts) 축적 — cron 필요
P1-2  verified 링크 주기 재검증 — cron 필요
P1-3  검색수요가 브랜드 단위(상품 단위로 올리면 DataLab 월 5만회 한도 직결)
P1-4  REVIEW_REQUIRED 를 화면이 「가격에 안 쓴다」고 «말하지 않는다»
```

```
보류   ④ Smallable JP 통화 오인 — 지금 코드에 없다. 고치지 않는다.
       MI 재설계·테이블 추가 — 하지 않는다(MI-2 지시).
       vision_observations 와 MI 의 관계 — 확인 못 함.
```

## 7. 확인 못 한 것

* Sellability 가 평균가를 쓰는 «이유»(주석 없음)
* `price_alerts` 가 실제로 무엇을 비교해 알림을 만드는지
* 등록 체크리스트가 Sellability 를 «막는 조건» 으로 쓰는지
* 2026-09-12 이전에 저장된 smallable 관측 행이 지금 판단에 섞이는지
