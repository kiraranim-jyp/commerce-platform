# MI-1 — Market Intelligence 현재 상태 전수 점검

> CTO 조사 보고(2026-09-26). **구현하지 않았다.** 코드·마이그레이션·공식 설정에서
> 확인한 것만 적는다. 확인하지 못한 것은 「확인 못 함」으로 남긴다.

## 0. 한 줄 결론

MI 의 **데이터·판단·화면은 거의 다 실제로 구현돼 있고 mock 이 없다.** 문제는 다른
곳에 있다 — 🔴 **그 데이터가 «시간에 따라 쌓이지 않는다».** 스케줄러가 존재하지 않는다.

## 1. [MI 현재 상태]

| 항목 | 상태 | 근거 |
|---|---|---|
| MarketObservation | **구현** | `packages/pricing/src/price-history.ts:136` (타입) · `price_observations.market_code/market_country`(마이그레이션 046) |
| 가격 데이터 | **구현 · 실데이터** | `price_observations`(027·031·038·040·046) · `run-price-check.ts` 가 실제 HTTP 호출 |
| 검색 데이터 | **구현 · 실데이터** | `packages/crawler/src/market-signals/naver-datalab.ts:86` — NAVER API HUB 실호출 |
| 경쟁/동일상품 | **구현 · 실데이터** | `domestic_product_links`(029·030) · `comparison-search/match.ts` |
| 시장 데이터 | **구현** | `market-intelligence.ts` — 국내/해외 분리(EXACT vs COMPARISON 버킷) |
| 위험 데이터 | **부분** | KC·인증은 Commerce 축에 있고, MI 축의 「위험」은 별도 개념이 없다 → 확인 못 함 |
| Sellability 연결 | **구현** | `packages/pricing/src/sellability.ts:44` → `compute-readiness.ts:119-162` → `/api/snapshots` |
| UI 연결 | **구현** | `DomesticPriceIntelligencePanel`(CommerceWorkspace 마운트) · `PriceCalculationDetail` · `MiRadar` |
| 실데이터 | **예** | 외부 호출 전부 실제. 실측 기록이 주석에 남아 있다(Bobo Choses B226AC043: /en-kr ₩162,000 · /en-de €75 · /en-int €84) |
| Mock | **0건** | 본코드에서 mock/stub/fixture 0. 실패는 상태값(`SearchTrendStatus` 등)으로 구분하고 **값을 지어내지 않는다** |

### 🔴 1-1. 그런데 「쌓이지 않는다」

코드가 **네 곳에서** `/api/cron/daily-price-check` 를 전제한다:

* `price-history/check/route.ts:13-14` — 「daily cron 과 같은 runPriceCheck() 를 그대로 호출한다」
* `price-observations.ts:130` · `:354` — 「수동 확인 또는 daily cron」 · 「daily cron 이 같은 날 재실행돼도」
* `domestic-product-link.ts:387` — 「**cron 이 매일 순회할 대상**」

그런데 실제로는:

```
apps/admin/src/app/api/cron/        없음
vercel.json 의 "crons"              없음   (파일에 $schema 한 줄뿐)
.github/workflows                   없음
그 밖의 스케줄러                     없음
```

🔴 즉 **daily cron 은 «한 번도 존재한 적이 없다».** 가격 관측이 쌓이는 경로는 둘뿐이다:

1. `api/snapshots/route.ts` → `triggerDomesticPriceCheck()` — **분석 직후 1회**(국내만)
2. `pipeline/page.tsx:416` → `POST /api/price-history/check` — **화면을 열 때 1회**(+수동 「지금 확인」)

**결과**: 「가격 이력」은 사실상 「**최근 관측**」이다. 셀러가 그 상품 화면을 열지
않으면 시계열이 늘지 않는다. 그리고 `price_alerts`(가격 변동 알림)와
`domestic_product_links` 의 「매일 순회」는 **전제가 충족된 적이 없다.**

## 2. [판단 파이프라인]

```
상품 → Master Product → MI ─┬─ 가격      ✅ 실데이터(단, 축적이 방문 의존)
                            ├─ 경쟁/동일  ✅ 실데이터
                            ├─ 검색수요    ✅ 실데이터(브랜드 단위 · 7일 캐시)
                            ├─ 시장상태    ✅ 국내/해외 분리
                            ├─ 상품성      ⚠️ 「상품성」이라는 독립 축은 없다
                            └─ 위험        ⚠️ MI 축에 없다(Commerce 쪽 KC/인증만)
                                 ↓
                          Sellability      ✅ computeSellability()
                                 ↓
                         판매 여부 결정      ✅ readiness → 대시보드/등록화면
                                 ↓
                            Commerce        ✅ 연결됨
```

### 🔴 현재 끊어진 지점

```
① 시간축이 끊어져 있다 ← 가장 큰 것
   cron 부재 → 시계열 축적이 «사용자 방문» 에 의존
   → price_alerts(변동 알림) · 링크 「매일 순회」가 전제를 잃는다

② 「상품성」·「위험」 축이 MI 안에 없다
   CEO 파이프라인 그림의 6축 중 둘이 코드에 대응물이 없다.
   → 없는 것을 있다고 그리지 않으려면 그림을 고치거나 축을 만들어야 한다

③ 검색수요가 «브랜드 단위» 다
   naver-datalab 캐시 키가 정규화된 브랜드명이다.
   → 같은 브랜드의 모든 상품이 «같은 검색수요» 를 본다. 상품 단위 수요가 아니다

④ REVIEW_REQUIRED(70~84%) 는 화면에 «보이지만» 가격 비교에 쓰이지 않는다
   데이터 존재 ✅ · UI 표시 ✅ · 판단 사용 ❌ — 이 간극이 의도된 것인지 확인 못 함
```

### 2-1. 「모름」이 판단에 흘러가는 방식은 «잘» 돼 있다

| 상태 | 뜻 | 등록을 막는가 |
|---|---|:---:|
`UNKNOWN`(원가 없음) | 원가 확인 필요 | 막지 않음 · `NEEDS_INFO` 배지 |
`YELLOW`(동일상품 미매칭) | 직접 확인 필요 | 막지 않음 · `REVIEW_MATCH` |
CASE D | 판단 보류 | 막지 않음 · 기회로 제시 |
`profitability = null` | 배송비 null | 숫자 자리에 「확인 불가」 |

🔴 이 설계는 이 프로젝트의 원칙과 «일치» 한다 — 모르는 것을 0 이나 「없음」으로
지어내지 않는다. **고칠 것이 아니라 지킬 것이다.**

## 3. [P0]

1. 🔴 **시간축 복구** — `/api/cron/daily-price-check` 를 만들고 스케줄을 건다.
   코드가 이미 그 이름으로 «준비» 돼 있다(같은 `runPriceCheck()` 재사용, 같은 날
   재실행 중복 방지까지 구현됨). 새 로직이 아니라 **없는 통로 하나**다.
   · 없으면 「가격 이력」·「변동 알림」·「링크 매일 순회」가 이름만 남는다.
   · 🔴 CEO 우선순위 #1(동일상품 매칭 정확도)도 이 축적 위에 선다.

2. 🔴 **CEO 파이프라인 그림과 코드 맞추기** — 「상품성」·「위험」 두 축이 코드에
   없다. 없는 것을 그림에만 두면 다음 사람이 있다고 읽는다. 축을 만들 것인지,
   그림에서 뺄 것인지 «결정» 이 필요하다(둘 다 정당한 답이다).

## 4. [P1]

3. **검색수요를 상품 단위로 올릴지 판단** — 지금은 브랜드 단위다. 브랜드 수요가
   상품 수요의 대리값으로 충분한지는 제품 판단이고, 올린다면 DataLab 호출량이
   상품 수만큼 늘어난다(월 50,000회 한도와 직결).

4. **REVIEW_REQUIRED 를 판단에 넣을지 결정** — 화면에는 보이고 판단에는 안 쓰인다.
   의도라면 그 사실을 화면이 말해야 하고(지금은 말하지 않는다), 의도가 아니라면
   가격 비교에 넣어야 한다.

5. **`price_alerts` 의 실제 사용처 확인** — 표와 요약 API(`/api/price-alerts/summary`)
   는 있는데, 시계열이 없으니 무엇을 근거로 알림이 나는지 확인 못 함.

## 5. [보류]

* **MI 재설계 · 테이블 추가 · 기존 API 재작성** — 지시(MI-2)대로 하지 않는다.
  현재 구현은 이해했고, 문제는 «구조» 가 아니라 «축적» 과 «그림과의 불일치» 다.
* **환율(ORIGIN_FX) 갱신 주기** — `exchange_rates` 를 누가 언제 갱신하는지 확인 못 함.
  cron 부재와 같은 축일 가능성이 있다(P0-1 과 함께 봐야 한다).
* **vision_observations** — MI 와의 관계 확인 못 함(이번 범위에서 다루지 않았다).

## 6. 확인 못 한 것(추측하지 않는다)

* 등록 준비 체크리스트가 Sellability 를 «막는 조건» 으로 쓰는지 여부
* `price_alerts` 가 실제로 무엇을 비교해 알림을 만드는지
* `exchange_rates` 갱신 주체
* MI 축의 「위험」이 애초에 설계된 개념인지, 그림에만 있는 말인지
