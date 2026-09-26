# MI-7 / P0-2 — 표시 가격과 판정 가격의 경계

> CTO 보고(2026-09-26). CPO 결정(EXACT-only 가격판정)을 코드에 반영했다.
> **평균가→최저가 치환 없음 · CASE 재설계 없음 · 수수료/물류비 공식 무변경 ·
> threshold 무변경 · `resolved` UI fallback 제거 없음 · representativeVerdict 무변경 ·
> Dashboard CASE 재계산 없음 · Production DB 요청 없음.**

## A. `averagePriceKrw` 소비자 — 다섯 갈래로 갈랐다

| 갈래 | 누가 | 쓰는 값 | EXACT 게이트 | MI-7 변경 |
|---|---|---|---|---|
**판정 — Sellability** | `computeSellability` | 평균가 vs 원가 | 🔴 **없었다** | ✅ **`exact` 로 바꿨다** |
**판정 — 가격유지/인하** | `computePriceDecision` | 평균가(CONSIDER_LOWER 게이트) · 최저가(문구) | ✅ 있다 — `basis!=="EXACT"` 면 두 값을 **null 로** (P0-D.2) | 변경 없음 |
**판정 — CASE** | `computePriceRecommendation` | **최저가만**(평균가는 죽은 입력) | ✅ 있다 — `basis!=="EXACT"` → CASE D (P-26) | 변경 없음 |
**표시 — Dashboard** | `/today` 배지 + tooltip | 평균가 | 입력이 `exact`(P0-D.3) | MI-6 에서 근거 표기 |
**표시 — Detail** | `domesticCompetition`(resolved) · headline · marketContext · sellerAction · radar | 평균가·최저가·최고가 전부 | 표시이므로 게이트 없음 | 변경 없음 |

🔴 **`resolved` 를 없애지 않았다.** 바뀐 것은 **판정 입력과 표시 입력을 가른 것** 하나다:

```
표시  resolved   EXACT 없으면 COMPARISON 으로 폴백 — 참고자료로 «남는다»
판정  exact      없으면 「확인 필요」 — 가격으로 «단정하지 않는다»
```

### 🔴 A-1. 이 한 곳만 정책 밖에 있었다

바로 옆 두 소비자는 이미 `domesticBasis` 를 받아 내부에서 EXACT 만 쓴다. Sellability 만
숫자를 받고 basis 를 받지 않아 구조적으로 가릴 방법이 없었다. 그리고 P0-D.3(2026-09-20)이
**대시보드에만** 같은 수정을 넣고 이 파일은 그대로였다 — MI-5 가 「나중 정책이 한쪽에만
적용됐다」로 기록한 그 지점이다.

### A-2. 🔴 radar 는 «우연히» 안전하다 — 기록해 둔다

`priceCompetitivenessAxis`(radar.ts:145)의 게이트는 `domesticBasis === "NONE"` 이라
**COMPARISON 은 통과한다.** 그런데 그 다음 줄이 `recommendedPriceKrw == null` 을 막고,
COMPARISON 은 CASE D → `recommendedPrice: null` 이므로 **결과적으로** UNAVAILABLE 이 된다.

🔴 즉 COMPARISON 가격이 등급을 만들지 못하는 이유가 basis 가 아니라 **CASE D 의 부수효과**다.
radar 는 신뢰도 축을 일부러 섞지 않기로 한 설계(CPO 지시, 같은 주석)이므로 **고치지 않았다.**
다만 CASE 가 COMPARISON 에 추천가를 주게 되는 날 이 축이 조용히 열린다 — 그 사실을 남긴다.

## B. EXACT-only 가격판정 — 구현

```diff
  const sellability = computeSellability({
    costPriceKrw,
    domestic: {
-     matched: domesticSummary.sellerCount > 0,        // = resolved (COMPARISON 폴백)
-     averagePriceKrw: domesticSummary.averagePriceKrw,
+     matched: domesticMarketSplit.exact.sellerCount > 0,
+     averagePriceKrw: domesticMarketSplit.exact.averagePriceKrw,
    },
  });
```

`apps/admin/src/app/api/price-history/_lib/market-intelligence.ts` — **이 네 줄이 전부다.**

### 🔴 B-1. `domesticMatched` 는 바꾸지 않았다

`deriveRepresentativeSellerVerdict` 에 넘기는 `domesticMatched` / `domesticSellerCount` 는
`domesticReason()` **문장** 에만 쓰인다 — 코드 분기에 쓰이지 않는다
(representative-seller-decision.ts 전수 확인: 분기는 `sellability.level` · `domesticBasis` ·
`unifiedDecision` 만 본다). 즉 **표시 축**이므로 `resolved` 를 유지했다. `exact` 로 바꾸면
「비교상품(참고용) N곳 시장가격 기준」이라는 사실이 문장에서 사라진다.

### B-2. 무엇이 실제로 달라지는가

영향 상품군은 하나다 — **EXACT 0건 + COMPARISON 1건 이상 + 원가 확인됨.**

| | 전 | 후 |
|---|---|---|
sellability | 비교상품 평균가로 **GREEN 또는 RED** | **YELLOW**(「국내 동일상품 확인 필요」) |
마진 숫자 | 비교상품 기준으로 **만들어졌다** | **null** — 만들지 않는다 |
최종 판정 | GREEN→REVIEW_MATCH 🟡 / 🔴 **RED+음수 → HOLD 🔴** | **MARKET_OPPORTUNITY → 🟡 조건부** |
EXACT 있는 상품 | — | 🔴 **한 글자도 변화 없음**(`resolved === exact`) |

🔴 **🔴 「판매 비추천」이 사라지는 구간이 있다.** 그것이 CPO 결정의 내용이다 — 검증되지
않은 다른 상품의 가격으로 「팔지 마라」고 단정하지 않는다. 그 대가로 경고 하나를 잃는다.
숨기지 않고 적는다.

### B-3. 🔴 남는 정보 손실 하나 (representativeVerdict 를 건드리지 않아서)

YELLOW 는 `MARKET_OPPORTUNITY` 분기로 가고 그 분기의 `reasons` 는 **하드코딩**이라
`domesticReason()` 을 부르지 않는다. 그래서 그 상품의 **「비교상품 N곳」이 최종 판정의
근거 문장에서 빠진다**(상세 화면의 비교상품 블록에는 그대로 있다).
🔴 이번 Sprint 의 금지 항목(representativeVerdict 재설계)이라 고치지 않았다.

## C. Dashboard — MI-6 그대로, 추가 변경 없음

```
목록   시장 참고 신호   판매판단 🟢/🟡/🔴 · 「시장 평균가 기준」 + tooltip 에 제외 항목
상세   최종 판단        CASE(최저가 · 착지원가 + 수수료) 로 다시 검사한 판정
```

🔴 대시보드에 CASE 를 새로 계산하지 않았다. `compute-readiness.ts` 는 여전히
`computePriceRecommendation` · `deriveRepresentativeSellerVerdict` 를 부르지 않는다
(MI-6 테스트가 그 사실을 고정한다).

🔴 **그리고 MI-7 로 대시보드와 상세의 sellability 입력이 «같아졌다»** — 둘 다 `exact` 다.
7-4 불일치가 이것으로 닫혔다.

## D. `representativeVerdict` — 구조 유지 · COMPARISON 경로 전수 확인

```
unifiedDecision → sellability → marketCaseGuard → 최종 verdict
```

구조를 바꾸지 않았다. 「Sellability 가 COMPARISON 가격으로 최종 GREEN/RED 를 만드는
경로가 남아 있는가」를 전수 확인했다:

| 경로 | COMPARISON 가격이 판정에 닿는가 |
|---|---|
`sellability.level` (Priority 2 기저) | 🔴 **닫혔다**(MI-7) — 입력이 `exact` |
`unifiedDecision` (Priority 1) | `computePriceDecision` 이 basis 로 이미 가린다 |
`applyMarketCaseGuard` | `marketCase` 는 CASE D 라 guard 가 그대로 통과 — 등급을 만들지 않는다 |
`recommendation.estimatedMarginPercent`(reasons 의 숫자) | CASE D 면 `null` — 숫자를 내지 않는다 |
`buildSellerDecision` (시장신호 강등) | 입력이 `sellerFacingVerdict` 와 marketCase — 가격 아님 |
radar 가격경쟁력 축 | §A-2 — 결과적으로 UNAVAILABLE |

**→ 남은 경로 없음.**

## E. Regression — CPO 지정 8상황 + load-bearing

`apps/admin/src/app/api/price-history/_lib/__tests__/mi7-exact-only-price-judgment.test.ts`
(15건)

| 상황 | 단정 |
|---|---|
**COMPARISON only** | 🔴 YELLOW · 마진 **null** · 최종이 RECOMMENDED 도 NOT_RECOMMENDED 도 **아니다** · 🔴 비교상품가가 원가보다 낮아도 **HOLD 아님** |
EXACT + 평균가 | GREEN · 마진 50% |
EXACT + 최저가(CASE) | CASE C → **HOLD** · CASE B → **REVIEW_PRICE** (guard 살아 있다) |
EXACT 없음(비교상품도 없음) | YELLOW → MARKET_OPPORTUNITY → 🟡 |
원가 없음 | UNKNOWN → NEEDS_INFO |
시장가격 없음(판매처는 있는데 가격 못 읽음) | YELLOW |
문턱 | RED 경계 4.8% / GREEN 50% — threshold 무변경 |
소스 경계 | 판정=`exact` · 표시=`resolved` · 다른 두 소비자는 여전히 `basis` 를 받는다 |

### 🔴 load-bearing 확인 — 그리고 그 한계도 적는다

`domesticSummary` 로 되돌려 보니 **④ 소스 검사 1건이 빨개졌다.** 되돌렸다.

🔴 **주의: 되돌렸을 때 빨개지는 것은 «소스 검사» 하나다.** ①~③은
`computeSellability` 를 직접 호출하는 단위 테스트라, 라우트가 어떤 값을 넘기는지는
보지 못한다. 즉 **판정 입력이 `exact` 라는 사실을 지키는 것은 ④ 하나**다.
end-to-end 로 묶으려면 supabase·환율·카테고리를 전부 모킹해야 하고
(`matching-2.0-integration.test.ts` 가 그 규모다) 이번 범위가 아니라 **하지 않았다.**

## F. 회귀

```
admin  4,353 / 316 파일  PASS   typecheck 0   build PASS   eslint 0(변경 파일)
pricing  532 /  40 파일  PASS
```

사전 존재(변경 전후 동일): `@commerce/listing` typecheck 5건 · `today/page.tsx` eslint
1 error + 1 warning · crawler 스위트 로드 실패 1건 · `coupang/notice-regression` 비결정.

## G. 남은 것

| # | 내용 | 상태 |
|---|---|---|
1 | **Sellability 를 「보조 판단」으로 재배치** — 평균가가 레벨을 «정하는» 구조 자체는 그대로다 | CPO 가 「다음 Sprint」로 지정. MI-7 은 **입력만** 갈랐다 |
2 | Production 영향 건수 | **백로그**(CPO 확정) — 접근 경로 확보 시 CTO 가 직접 측정 |
3 | `MARKET_OPPORTUNITY` reasons 에 비교상품 수가 빠진다(§B-3) | representativeVerdict 금지 범위라 미처리 |
4 | radar 가격경쟁력 축이 basis 가 아니라 CASE D 부수효과로 닫혀 있다(§A-2) | 설계상 의도 — 기록만 |
