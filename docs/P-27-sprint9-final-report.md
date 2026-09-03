# P-27 Sprint 9 최종보고서 — 가격 컨설팅 CASE A/B/C/D 정책 전환

- 작성: CTO(개발+QA)
- 수신: CPO → CEO
- 작성일: 2026-09-03
- 대상 커밋: `5ab478b`(P-26 정책 전환) → `11dfe00` → `df5e404`(P-28) → `8552d8d` → `504cb1e` → `895f108`(P-29)

> 본 문서는 CPO가 P-27에서 지정한 5개 섹션 포맷으로 한 번에 정리한 최종보고서다.
> 그동안 여러 스프린트 보고에 흩어져 있던 내용을 재구성한 것이며, 새로 추가된
> 코드 변경은 없다(외부 API 호출 0회).

---

## 섹션 1. 수정 로직

### 1-1. 무엇이 문제였나 (P-24/P-25 이전 정책)

`computePriceRecommendation()`의 추천가는 `max(minimumPrice, ...)` 구조였다.
즉 **10% 최소마진 기준가가 추천 판매가의 절대 하한선**이었다.

그 결과 실측(PèPè)에서 다음과 같은 비현실적 컨설팅이 나왔다:

```
착지원가        ₩242,400
국내 EXACT 최저가 ₩258,000   ← 실제로 시장에서 팔리는 가격
최소마진(10%)가  ₩269,333
→ 시스템 추천가  ₩269,333   ← 국내 최저가보다 ₩11,333 비싼 가격을 추천
```

시장 최저가보다 비싼 가격을 "추천"하는 것은 판매 컨설팅으로서 의미가 없다.

### 1-2. 정책 변경 (CEO 승인 옵션 1)

**"10% 최소마진은 더 이상 절대 판매가 하한선이 아니다."**

세 기준가격의 역할을 명시적으로 분리했다:

| 값 | 새 역할 |
|---|---|
| `minimumPrice` (최소마진가) | **참고 지표**. 하한선 아님 |
| `targetPrice` (목표마진가) | 이상적 목표. 하한선 아님 |
| `domesticLowestPriceKrw` (시장가) | 실제 판매 가능 가격의 **근거** |
| `totalCostKrw` (착지원가) | **손실 판단의 유일한 기준**(0% 마진 = 손익분기) |

### 1-3. 분기 순서 (구현 순서 그대로)

[packages/pricing/src/price-recommendation.ts](packages/pricing/src/price-recommendation.ts)

1. **CASE D 우선 게이트** — `domesticBasis !== "EXACT"` 이거나 시장가가 없으면
   즉시 CASE D. 검증되지 않은 COMPARISON 가격으로는 "판매 가능/비추천"을
   확정하지 않는다. `brandMedianPriceKrw`가 있으면 `referencePriceKrw`
   (= `min(targetPrice, 브랜드중앙값×0.95)`)만 채우고 `recommendedPrice`는 계속 `null`.
2. **CASE C** — `시장가 <= 착지원가` → 손실. `recommendedPrice = null`.
3. **CASE A** — `시장가 >= 목표가` → `max(목표가, round(시장가×0.99))`.
   시장가의 99%까지만 내려가 **불필요한 덤핑을 막는다**.
4. **CASE B** — 나머지(`착지원가 < 시장가 < 목표가`) → **시장가를 그대로 추천**.
   여기가 이번 정책 변경의 핵심이다.

### 1-4. 마진율 단일 소스 (P-29 Sprint, 커밋 `8552d8d`)

이전에는 같은 화면에 서로 다른 마진율 두 개(30.6% / 46.6%)가 동시에 표시됐다.
요약카드가 `decision.marginPercent`(현재 판매가 기준)를, 상세 블록이
`recommendation.estimatedMarginPercent`(추천가 기준)를 각각 그렸기 때문이다.

수정 후: **`recommendation.estimatedMarginPercent`가 단일 소스**이며,
없을 때만 `decision.marginPercent`로 폴백한다.
[DomesticPriceIntelligencePanel.tsx:808](apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx:808)

`estimatedMarginPercent`는 CASE B에서도 **하드코딩하지 않고 항상 실제 계산값**이다
(`(추천가 − 착지원가) / 추천가 × 100`, `price-decision.ts`와 동일 분모).

### 1-5. UI 위임 원칙

화면은 `marketCase` 값 하나만 보고 분기하며, **패널에서 가격을 다시 비교하지 않는다.**
판정 로직이 엔진과 UI 두 곳에 중복되어 어긋나는 것을 구조적으로 막기 위함이다.
[DomesticPriceIntelligencePanel.tsx:910-916](apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx:910)

---

## 섹션 2. CASE A~D 정의표

| CASE | 조건 | `recommendedPrice` | `estimatedMarginPercent` | `competitiveBasis` | 화면 표시 |
|---|---|---|---|---|---|
| **A** | `basis=EXACT` **AND** `시장가 >= 목표가` | `max(목표가, 시장가×0.99)` | 실제 계산값 | `DOMESTIC_LOWEST` | 🟢 추천가 + "예상 마진 약 N%" |
| **B** | `basis=EXACT` **AND** `착지원가 < 시장가 < 목표가` | **시장가 그대로** | 실제 계산값 | `DOMESTIC_LOWEST` | 🟡 추천가 + "예상 마진 약 N% **(목표마진 미달, 손실 아님)**" |
| **C** | `basis=EXACT` **AND** `시장가 <= 착지원가` | `null` | `null` | `DOMESTIC_LOWEST` | 🔴 "추천가 없음" + "국내 시장가로 팔면 착지원가도 회수하지 못합니다" |
| **D** | `basis != EXACT` **OR** 시장가 없음 | `null` | `null` | `BRAND_MEDIAN` 또는 `null` | ⚪ "추천가 없음" + "국내 동일상품(EXACT) 시장가가 확인되지 않아 시장 경쟁력 기반 추천을 낼 수 없습니다" |

### 경계값 처리 (명시적으로 결정된 사항)

| 경계 | 판정 | 근거 |
|---|---|---|
| `시장가 == 목표가` | **A** (B 아님) | 목표마진을 정확히 충족하므로 "확보 가능" 쪽에 포함 |
| `시장가 == 착지원가` | **C** (B 아님) | 마진 0% — 손익분기는 판매 가치가 없다고 판단 |
| `basis=COMPARISON` + 시장가 존재 | **D** (A/B/C 아님) | 미검증 유사상품 가격으로 확정 판단 금지 |
| CASE D + 브랜드 중앙값 존재 | **D 유지** | `referencePriceKrw`만 채움. "시장 경쟁력 기반 추천"이라고 부르지 않음 |

### CASE D에서 `recommendedPrice`와 `referencePriceKrw`를 분리한 이유

같은 필드에 담으면 호출부가 "시장가 기반 확정 추천"과 "브랜드 중앙값 참고치"를
구분할 수 없다. 별도 필드이므로 CASE A/B/C에서 `referencePriceKrw`는 **항상 `null`**이다.

---

## 섹션 3. 실상품 검증

| CASE | 검증 상품 | 결과 |
|---|---|---|
| **A** | **Curious Turnip** (Bobo Choses), SKU `B126AI018` | ✅ 검증 완료 — EXACT 매칭 성립, 목표마진 확보 가능 구간, 추천가 정상 산출 |
| **B** | **PèPè** 상품 | ✅ 검증 완료 — 착지원가 ₩242,400 / 국내 EXACT 최저가 ₩258,000 / 목표마진가 ₩275,455. 추천가가 구 정책의 ₩269,333이 **아니라** 시장가 ₩258,000으로 나오는 것 확인 |
| **C** | — | ❌ **미검증 — 실제 후보 상품 미발견** |
| **D** | EXACT 매칭 실패 상품 | ✅ 확인 완료 — 추천가 없음 + 사유 문구 정상 노출 |

### CASE C 미검증 사유 (CPO 확인 필요 항목)

CASE C는 `국내 시장가 ≤ 착지원가`, 즉 **국내에서 원가 이하로 팔리고 있는 실제 상품**이
필요하다. 현재 취급 브랜드 풀에서는 해당 조건을 만족하는 실제 상품을 아직 찾지 못했다.

- CPO 지시: **데이터 조작 금지, 실제 후보 탐색 계속.** 이 지시를 따랐으며 임의 데이터로
  화면을 만들지 않았다.
- 로직 자체는 단위 테스트로 양방향 검증되어 있다(섹션 5, CASE C 2건 + 경계값 1건).
- **잔여 업무 1번**으로 다음 세션에 계속 탐색한다.

### 검증 범위에 대한 정직한 고지

- CASE A/B/D의 위 결과는 **실제 API 응답 + 실브라우저 UI 확인**까지 마친 것이다.
- CASE A(Curious Turnip)의 원가/시장가 개별 숫자는 이 문서에 재수록하지 않았다 —
  당시 세션 기록에만 있고 이 세션에서 재조회하려면 실API 호출이 필요하기 때문이다
  (CEO 호출량 관리 정책). 필요하시면 지시 주시면 1회 호출로 확보하겠다.

---

## 섹션 4. UI 캡처

### 4-1. 화면에 실제로 렌더링되는 문구 (코드 확정본)

| 상황 | 라벨 | 값 / 보조문구 |
|---|---|---|
| 공통 | `최소마진 확보가(참고)` | `₩{minimumPrice}` |
| 공통 | `목표마진 판매가(참고)` | `₩{targetPrice}` |
| CASE A | `🏷 최종 추천 판매가` | `₩{recommendedPrice}` / `예상 마진 약 N%` |
| CASE B | `🏷 최종 추천 판매가` | `₩{recommendedPrice}` / `예상 마진 약 N% (목표마진 미달, 손실 아님)` |
| CASE C | `🏷 최종 추천 판매가` | `추천가 없음` / `국내 시장가로 팔면 착지원가도 회수하지 못합니다` |
| CASE D | `🏷 최종 추천 판매가` | `추천가 없음` / `국내 동일상품(EXACT) 시장가가 확인되지 않아 시장 경쟁력 기반 추천을 낼 수 없습니다` |
| CASE D + 브랜드중앙값 | (추가 문구) | `💡 국내 동일상품 없음 — 브랜드 시장 중앙값 기준 참고치` |

출처: [DomesticPriceIntelligencePanel.tsx:917-962](apps/admin/src/app/pipeline/commerce/DomesticPriceIntelligencePanel.tsx:917)

`{minimumPrice}`/`{targetPrice}` 두 참고 지표는 **CASE C/D에서도 계속 표시**된다.
추천가가 없다고 해서 원가 구조 정보까지 감추지 않는다.

### 4-2. 캡처 이미지에 대한 고지 ⚠️

**이 문서에 첨부할 캡처 이미지 파일은 현재 보유하고 있지 않다.**

- CASE A/B/D의 실브라우저 UI 확인은 이전 세션에서 **실제로 수행**했고 그 결과를
  근거로 보고했다. 다만 당시 스크린샷을 파일로 보존하지 않아 이 세션에서
  재첨부할 수 없다.
- 재캡처하려면 admin 앱 기동 + 실제 상품 조회(= 실API 호출)가 필요하다.
  CEO의 외부 API 호출량 관리 정책상 **임의 실행하지 않고 대기**한다.
- CPO가 이미지 증빙을 필수로 요구하시면, 승인 주시는 대로 CASE A/B/D 3장을
  1회 실행으로 캡처해 별도 제출하겠다.

없는 증빙을 있는 것처럼 쓰지 않기 위해 명시한다.

---

## 섹션 5. 테스트 결과

### 5-1. CASE 전용 단위 테스트

`packages/pricing/src/__tests__/price-recommendation.test.ts` — **11/11 PASS**

| # | CASE | 검증 내용 |
|---|---|---|
| 1 | A | CPO 예시 재현: 시장가 ₩300,000 / 목표가 ₩275,000 → 추천가 ₩297,000, 마진 25.9% |
| 2 | A | 경계값 — `시장가 == 목표가`면 A로 분류 |
| 3 | B | **실측(PèPè) 회귀 방지** — 추천가가 ₩258,000이고 ₩269,333이 **아님**을 명시 단언. 추천가 < `minimumPrice` 성립 확인. 마진 6.0%가 하드코딩 아닌 계산값임을 확인 |
| 4 | B→C | 경계값 — `착지원가 == 시장가`(0% 마진)면 C로 분류 |
| 5 | C | 시장가 < 착지원가 → `recommendedPrice`/`estimatedMarginPercent` 모두 `null` |
| 6 | D | `basis=COMPARISON`이면 시장가가 있어도 D, `competitiveBasis`도 `null` |
| 7 | D | `basis=NONE`이면 D |
| 8 | D | 브랜드중앙값 있으면 `referencePriceKrw`만 채워지고 `recommendedPrice`는 `null` 유지 |
| 9 | D | 브랜드중앙값도 없으면 `competitiveBasis`/`referencePriceKrw` 모두 `null` |
| 10 | 공통 | `minimumPrice < targetPrice` 관계는 CASE D에서도 유지 |
| 11 | 공통 | `currentSellingPriceKrw`는 계산에 전혀 관여하지 않음(생략해도 결과 동일) |

**3번 테스트가 이번 정책 전환의 회귀 방지 핵심이다** — 구 정책으로 되돌아가면 즉시 FAIL한다.

### 5-2. Regression — pricing 패키지 전체

```
Test Files  19 passed (19)
     Tests  198 passed (198)
  Duration  5.09s
```

정책 전환에 인접한 스위트 전부 PASS:
`representative-seller-decision`(39) · `market-alert`(15) · `seller-action`(15) ·
`price-recommendation`(11) · `price-validity`(10) · `variant-final-price`(10) ·
`price-decision`(8) · `seller-decision-state`(8) · `unified-price-decision`(7) ·
`price-alert-signal`(7) · `sellability`(6) · `brand-market-profile`(5) ·
`baseline-price-paths`(5) · `listing-price`(4) · `landed-cost`(3) 외

### 5-3. 실행 환경

- vitest 2.1.9, `packages/pricing`
- 실행 시각: 2026-09-03 11:29 (KST)
- **외부 API 호출 0회** — 이 보고서 작성 과정에서 Naver DataLab 등 외부 호출 없음

---

## 부록. 이 보고서가 다루지 않는 잔여 업무

| # | 항목 | 상태 |
|---|---|---|
| 1 | CASE C 실제 후보 상품 탐색 | **미해결** — 다음 작업으로 진행 예정 |
| 2 | Naver DataLab `ratio: null` 원인 | **CEO 액션 대기** — Naver Developers 콘솔에서 해당 앱의 "검색어트렌드" API 권한 활성화 여부 확인 필요. 또는 7일 캐시 만료 후 자연 재호출 대기. 진단 로그는 `895f108`로 배포 완료, 추가 실호출은 보류 중 |
| 3 | "해외 편집샵 노출" 시장신호 | P-29 Sprint 6에서 **의도적 범위 제외**(캐싱 설계 선행 필요). 차기 스프린트 이월 |
| 4 | CASE A/B/D UI 캡처 이미지 | 섹션 4-2 참조 — CPO 승인 시 1회 실행으로 제출 |
