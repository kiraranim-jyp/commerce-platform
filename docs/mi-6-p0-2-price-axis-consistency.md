# MI-6 / P0-2 — 판단축 정합성

> CTO 보고(2026-09-26). **평균가→최저가 치환 없음 · CASE/Sellability 공식 무변경 ·
> 문턱 무변경 · `resolved` fallback 삭제 없음 · representativeVerdict 무변경.**
> 구현한 것은 **「무엇을 근거로 한 판단인지 말하는 방식」** 하나다.

## 1. 네 축이 각각 어떤 가격을 어떤 의미로 쓰는가

| 축 | 사용하는 가격 | 의미 | 동일상품 조건 | 판단 영향 |
|---|---|---|---|---|
**CASE** | `domesticLowestPriceKrw` **최저가** vs `landedCostKrw` + 예상수수료 | **실제 판매 가능 가격** (P-26) | 🔴 `basis==="EXACT"` 아니면 **CASE D = 판단 보류** | A/B/C/D → `applyMarketCaseGuard` 가 최종 판정을 **강등**할 수 있다(C→HOLD, B→REVIEW_PRICE) |
**Sellability** | `averagePriceKrw` **평균가** vs `costPriceKrw`(원가, 🔴 **해외물류비·수수료 없음**) | 🔴 **아래 §2 — 코드와 문서가 다르다** | 🔴 상세 = `resolved`(COMPARISON 폴백 **있음**) · 대시보드 = `exact` — **불일치(7-4)** | GREEN/RED. 평균가 ≥ 최저가 이므로 **항상 CASE 보다 낙관적** |
**Detail** | 표시 = `resolved`의 lowest·average·highest 전부 · 판정 = CASE(최저가) + Sellability(평균가) | 표시는 참고, 판정은 둘 다 | 표시 조건 없음 · CASE 는 EXACT · Sellability 는 `resolved` | 최종 판정은 CASE guard 를 통과한 것 |
**Dashboard** | Sellability 평균가 + `priceLevel`(`computePriceDecision` — 🔴 평균가가 CONSIDER_LOWER **게이트**) | 목록의 한 줄 | `exact` | 🔴 **CASE guard 없음** → 목록이 상세보다 낙관적일 수 있다(7-5) |
**Representative Verdict** | 🔴 **자기 가격이 없다** — `sellability.level` · `marketCase` · `recommendation` 값을 받는다 | 압축이 아니라 **우선순위 + 재검사** | `domesticBasis` 를 받아 EXACT 아니면 READY→REVIEW_MATCH | **최종 판정.** CASE C→HOLD · B→REVIEW_PRICE |

보조 사실: `computePriceRecommendation`(CASE)은 `domesticAveragePriceKrw` 를 **본문에서
한 번도 읽지 않는다**(죽은 입력). `computeSellerAction` 도 같다. 즉 **CASE 는 평균가를
쓰지 않는다** — 주석의 주장이 아니라 코드의 사실이다.

## 2. 🔴 §1-B 의 질문에 답한다 — 그리고 여기서 멈춘다

> Sellability 의 평균가는 **판정 가격**인가 **시장 참고가격**인가?

**코드와 문서가 서로 다른 답을 하고 있다.**

```
문서(sellability.ts:1-12, 2026-08-26)   「국내 동일상품 평균가를 잠정 판매가로 «참고만» 한다」
코드(sellability.ts:64-83)             그 값이 마진의 «분모» 이고 GREEN/RED 를 «정한다»
```

「참고만」이라고 적혀 있는 값이 실제로는 레벨을 결정한다. 그리고 그 레벨은
`representativeVerdict` 의 **Priority 2 기저 판정**이 된다(프로덕션에서는
`currentSellingPriceKrw` 가 거의 없어 Priority 1 이 비어 있으므로 **사실상 유일한**
기저다).

🔴 **이 둘 중 하나로 정하는 것은 제품 결정이라 CTO 가 하지 않는다.** 두 갈래의
결과가 다르다:

| | 뜻 | 따라오는 변경 |
|---|---|---|
**참고가격으로 확정** | 평균가는 레벨을 정하지 «않는다» | Sellability 가 레벨을 내는 근거를 다른 것(CASE)에서 받아야 한다 → 사실상 축 하나가 사라진다 |
**판정가격으로 확정** | 평균가가 정당한 판정 근거다 | 🔴 그러면 원가 축도 CASE 와 맞춰야 한다(해외물류비·수수료). 지금은 가격·원가 **두 축이 다** 비대칭이다 |

## 3. A. 정책 충돌 — `UX-1D` ↔ `P-26`

```
P-26 (2026-09-03, price-recommendation.ts:14)
  「domesticLowestPriceKrw(marketPrice): 실제 판매 가능 가격의 근거」
  실측 PèPè — 최저가 ₩258,000인데 ₩269,333을 추천하던 것을 고쳤다.

UX-1D (mi-headline.ts:75-78 · price-hierarchy.ts:989)
  「① 평균가 — 최저가는 «이상치 한 건에 끌려갈 수» 있어 대표값으로 쓰지 않는다」
```

🔴 **둘은 같은 자리를 다투지 않는다** — 이번 조사에서 확인한 것이 그것이다:

| | 쓰는 곳 | 목적 |
|---|---|---|
P-26 최저가 | **판정**(CASE A/B/C/D · 추천가 · 손익) | 「얼마에 팔 수 있나」 |
UX-1D 평균가 | **표시**(헤드라인 대표 숫자 · marketContext 대표값) | 「시장이 대체로 얼마인가」 |

그리고 헤드라인은 라벨에 **「한국 시장 평균가 · 동일상품 기준」** 이라고 **적는다**
(mi-headline.ts:84) — 즉 표시 축은 이미 정직하다.

**→ 두 정책은 충돌하지 않는다.** 🔴 **충돌하는 것은 Sellability 하나뿐이다** — 그것만이
「표시용 대표값(평균가)」을 **판정**에 쓰고 있다. §2 가 그 지점이다.

🔴 선후 관계는 여전히 코드로 가릴 수 없다(UX-1D 에 날짜 표기가 없다). 다만 **가릴
필요가 없어졌다** — 두 정책의 적용 범위가 겹치지 않기 때문이다.

## 4. B. EXACT / COMPARISON 경계 (7-4) — 🔴 조사만 하고 멈춘다

```
compute-readiness.ts:188   matched: split.exact.sellerCount > 0   ·  split.exact.averagePriceKrw
market-intelligence.ts:433 matched: resolved.sellerCount > 0      ·  resolved.averagePriceKrw
```

`resolved` 는 EXACT 가 없으면 **COMPARISON 으로 폴백**한다. 영향을 받는 상품군은
하나로 특정된다: **EXACT 0건 + COMPARISON 1건 이상 + 원가 확인됨.**

| | 대시보드(`exact`) | 상세(`resolved`) |
|---|---|---|
sellability | `matched=false` → **YELLOW** | 비교상품 평균가로 **GREEN 또는 RED** |
최종 판정 | 「확인 필요 🟡」 | GREEN → REVIEW_MATCH 🟡 / 🔴 **RED+음수마진 → HOLD 🔴** |

🔴 **셀러에게 실제로 도달하는 모순은 마지막 줄이다** — 목록은 「확인 필요 🟡」인데
상세는 「판매 비추천 🔴」.

### 🔴 그런데 어느 쪽이 맞는지가 정책 문제다

* **`exact` 로 맞추면**(P0-D.3 의 문장 「「찾았다」는 EXACT 에서만 참」을 일관 적용):
  그 🔴 경고가 **사라진다**(YELLOW → MARKET_OPPORTUNITY → 🟡).
* **`resolved` 를 유지하면**: 🔴 경고는 남지만, 그것은 P-26·P0-D.2 가 금지한
  「검증되지 않은 유사상품 가격으로 판매 비추천 확정」이다.

즉 **어느 선택이든 기존 CEO 결정 하나를 거스른다.** 🔴 그래서 고치지 않았다 —
`resolved` fallback 을 지우지도, 표시 경로를 건드리지도 않았다(CPO 명시).

🔴 참고: `resolved` 가 **표시**에 필요하다는 것은 확인했다(CEO: COMPARISON 가격을
화면에서 지우지 않는다). 즉 **fallback 자체를 없애는 것은 답이 아니고**, 다투는 것은
「**sellability 입력**으로 쓰는가」 한 곳뿐이다.

## 5. C. Dashboard CASE guard (7-5) — 🔴 모순 경로 «있다». 그래서 고쳤다

### 경로가 실재한다

```
compute-readiness.ts  computeSellability(...)  →  SnapshotPriceSummary.sellability
                      🔴 computePriceRecommendation 을 부르지 않는다
                      🔴 deriveRepresentativeSellerVerdict 를 부르지 않는다
/today page.tsx       sellability.level 을 «날것» 으로 배지에 그린다
```

그래서 **CASE C(최저가로 팔면 손실) 인데 목록은 🟢 「판매 추천」** 이 가능하다.
조건: 최저가 기준 손실이지만 **평균가** 기준 마진이 10% 이상인 구간. 평균가 ≥ 최저가
이므로 그 구간은 **비어 있지 않다.**

### 최소 수정 — 기준을 바꾸지 않고 «근거를 밝힌다»

CASE 를 대시보드에서 새로 계산하지 **않았다**. 상품 30개마다 환율·원가를 돌리지 않기로
한 기존 비용 판단이 있고(compute-readiness.ts 상단 주석), 그것을 뒤집으면 같은 판정이
두 곳에서 각자 도는 「두 벌 계산」이 된다.

```
전   판매판단 🟢 판매 추천
     tooltip: 「실제 구매원가 ₩X, 국내 판매가 ₩Y — 예상 마진 Z%로 가격 경쟁력이 있습니다」

후   판매판단 🟢 판매 추천 · 시장 평균가 기준
     tooltip: 「실제 구매원가 ₩X, 국내 시장 평균가 ₩Y 기준 예상 마진 Z% —
               해외물류비·수수료를 제외한 값입니다」
```

바꾼 것:

| 파일 | 변경 |
|---|---|
`packages/pricing/src/sellability.ts` | 🔴 「국내 판매가」→「**국내 시장 평균가**」(3곳) · 「해외물류비·수수료 제외」 명시 · 🔴 「가격 경쟁력이 있습니다」 **단정 제거** |
`apps/admin/src/app/today/page.tsx` | 배지에 「· 시장 평균가 기준」 추가. 🔴 `UNKNOWN`(원가 미확인)에는 **붙이지 않는다** — 쓰지 않은 근거다 |

🔴 **GREEN 이 뜨는 조건 · 문턱(10%) · 레벨 경계 · 마진식 전부 그대로다.** 신규 테스트
13건 중 5건이 그 사실을 고정한다(10% 경계 양쪽, 마진값, title, null 처리).

🔴 가드가 일하는지 실행으로 확인했다 — 문구를 「국내 판매가」로 되돌리니 2건이
빨개졌다. 되돌렸다.

## 6. D. 실제 데이터 영향 — 🔴 **계산할 수 없다**

```
apps/admin/.env.local   QA_PROXY_TO_PROD · OCI_PROXY_URL    ← DB 자격증명 «없음»
.env.local              VERCEL_OIDC_TOKEN                   ← 같음
vercel env pull         Sensitive 값은 전부 ""(읽을 수 없음, 기존 확인)
```

즉 **CTO 가 접근 가능한 범위에 Production DB 가 없다.** 지시대로 CEO 에게 SQL/API
실행을 요청하지 않는다. 🔴 「0건」이라고 적지 않는다 — **세지 못했다**가 사실이다.

### 대신 «구조적 영향 범위» 는 코드로 확정된다

이번 변경(문구·근거 표시)의 판정 변화:

```
GREEN → RED   0        RED → GREEN   0
HOLD → REVIEW 0        REVIEW → HOLD 0
```

🔴 **판정을 바꾸는 코드가 한 줄도 없다**(테스트 5건이 경계를 고정). 바뀐 것은 문장과
배지 부가 표시뿐이다.

앞으로 §2·§4 를 결정할 때 **일어날 수 있는** 전이는 이렇게 좁혀져 있다:

| 결정 | 가능한 전이 | 불가능한 전이 |
|---|---|---|
Sellability 를 최저가로 | **GREEN → RED 한 방향만** (평균·최저는 항상 함께 null 이라 YELLOW/UNKNOWN 모집단 불변) | GREEN→YELLOW · RED→GREEN |
7-4 를 `exact` 로 | COMPARISON-only 상품: GREEN/RED → **YELLOW** · 최종 🔴 → 🟡 | EXACT 있는 상품은 **전부 불변**(resolved===exact) |

## 7. 이번 Sprint 가 «하지 않은» 것 (§5 금지 항목 전수)

| | |
|---|---|
평균가 → 최저가 일괄 치환 | ❌ 하지 않음 |
CASE 알고리즘 재설계 | ❌ |
Sellability 공식 재설계 | ❌ (마진식·문턱 그대로, 테스트로 고정) |
threshold 변경 | ❌ |
매칭 Recall 확대 | ❌ (매칭 코드 무변경) |
`resolved` fallback 삭제 | ❌ |
Dashboard GREEN 기준 변경 | ❌ (뜨는 조건 불변 — 근거만 표시) |
MI-1~5 재조사 | ❌ |
`representativeVerdict` 변경 | ❌ |

## 8. 회귀

```
pricing  532 / 40 파일  PASS
admin  4,338 / 315 파일 PASS (신규 13건)   typecheck 0   build PASS
```

사전 존재(변경 전후 동일 — stash 확인): `today/page.tsx` eslint **1 error + 1 warning**
(`setState within effect` @144 · `<img>` @364 — 내 변경 줄이 아니다) ·
`@commerce/listing` typecheck 5건 · crawler 스위트 로드 실패 1건.

## 9. 🔴 CPO 결정으로 올리는 것 — 세 가지

| # | 결정할 것 | 왜 CTO 가 못 정하는가 |
|---|---|---|
**1** | **Sellability 평균가의 지위** — 판정가격인가 참고가격인가(§2) | 문서는 「참고만」, 코드는 「판정」. 어느 쪽으로 정하든 축 하나가 사라지거나 원가 축까지 맞춰야 한다 |
**2** | **7-4 `resolved` vs `exact`**(§4) | 어느 선택이든 기존 CEO 결정 하나를 거스른다(P0-D.3 vs P-26·P0-D.2). 🔴 `exact` 로 맞추면 실제 🔴 경고가 사라진다 |
**3** | **Production 영향 건수를 잴 것인가**(§6) | CTO 는 DB 에 접근할 수 없다. 재려면 CEO/CPO 가 조회해야 하고, 그것은 이번 지시가 금지한 「CEO 에게 실행 요청」이다 |

🔴 1·2 를 정하기 전에는 **평균가를 최저가로 바꾸지 않는다.** MI-5 에서 확인한 대로
가격 한 축만 맞추면 원가 축(해외물류비·수수료)이 남아 두 판정은 여전히 어긋난다.
