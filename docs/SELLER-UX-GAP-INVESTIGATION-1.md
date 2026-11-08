# SELLER-UX-GAP-INVESTIGATION-1 — 현재 셀러 화면은 왜 복잡하고 왜 「조건부 판매」인가

> 🔴 **조사 전용.** 운영 코드 변경 **0** · 개선 **0** · 계약 수정 **0** · UI PASS 선언 **0**.
> 기준 Production `40bb52c7`. 측정 도구 = `seller-ux-gap-inventory.test.ts`(승인된
> `seller-surface-composition` 하니스 재사용 · 새 하니스 0).

---

## 0. 한 줄 결론 — 둘 다 «표시» 문제가 아니다

```
① 복잡함    화면이 복잡한 것은 데이터가 «많아서» 가 아니라
            **「데이터가 없다」를 1차에서 여섯 번 말하기 때문** 이다.
            실측: 후보 0건 → 1차 **393자** / 후보 3건 → 1차 **235자**(더 짧다)
② 조건부    「조건부 판매」는 문구 문제가 아니라 **판정 구조** 다.
            representative 6코드 중 **3코드가 같은 「조건부 판매」로 압축** 되고,
            「판매 추천」은 `domesticBasis === "EXACT"` 하나에만 달려 있다.
            🔴 국내 EXACT 동일상품은 현재 **0** 이다(WU-138 · 동결축) ⟹ 구조적으로 불가능.
```

---

## 1. 화면 구성요소 전수 + 노출 owner (CASE D = 운영 최빈 상태)

| 영역 | owner 파일 | 1차 글자 | 전체 | 접힘 비중 | 1차 testid |
|---|---|---:|---:|---:|---:|
| 상단 요약 | `commerce/ProductJudgementSummary.tsx` | **79** | 79 | 0% | 4 |
| 결론(📊 가격 분석) | `commerce/MarketPriceComparison.tsx` | **393** | 860 | 54% | **24** |
| ActionCenter | `commerce/ActionCenter.tsx` | **126** | 126 | 0% | 0 |
| **화면 전체** | — | **598** | 1,065 | 44% | 28 |

🔴 **1차의 66%(393/598)가 결론 영역 하나** 다. testid 24개 중 **22개가 그 한 파일** 소유다.
🟢 상단 요약은 이미 79자로 짧다 — **요약이 길어서 복잡한 것이 아니다.**

### 후보가 «있을 때» (같은 영역 · 후보 3건)

```
1차 **235자** / 전체 1,524자 (접힘 **85%**) · testid 20개
1차 글자: 📊 가격 분석 · 국내 시장 참고가격 기준 · (판단 한 줄) ·
         🇰🇷 국내 동일상품 확인 가격 KRW 88000 · 가격대 확정 불가 ·
         🌎 해외 최저 소싱가 최저 확인가 GBP 37 · USD 58 ·
         💡 판매가격 가이드 · 권장 판매가격 ₩115,200 · 이 가격으로 설정 · 가격 수정 → · ⓘ
```

🔴🔴 **데이터가 있으면 1차가 «짧아진다»**(393 → 235자). ⟹ 복잡함의 원인은 **빈 상태의 설명문** 이다.

---

## 2. 중복 / 셀러 판단에 불필요한 항목

### ⒜ 🔴🔴 「데이터가 없다」를 1차에서 **여섯 번** 말한다 (CASE D)

| # | testid | 문장 | 성격 |
|---|---|---|---|
| 1 | `market-recheck-note` | 「이 화면에는 후보 조회 결과가 아직 없습니다 — 「🔄 다시 분석」을 누르면 가져옵니다」 | 미조회 |
| 2 | `market-price-basis-verdict` | 「국내 시장가격이 확인되지 않아 목표마진 달성 여부를 판단할 수 없습니다」 | 가격 미확인 |
| 3 | `market-same-count-domestic` | 「🇰🇷 국내 동일상품 확인 **0곳**」 | 건수 |
| 4 | `market-same-count-overseas` | 「🌎 해외 동일상품 확인 **0곳**」 | 건수 |
| 5 | `mi-candidate-empty`(국내) + note | 「국내 소싱 후보가 없습니다」 + 「이번 조사에서 수집한 후보 중에는 … 세는 기준이 다릅니다」 | 부재 + 분모 설명 |
| 6 | `mi-candidate-empty`(해외) + note | 「해외 소싱 후보가 없습니다」 + **5번과 글자가 동일한 문장** | 부재 + 분모 설명 |

🔴 5·6 의 긴 문장은 **글자가 완전히 같고 각 45자** ⟹ 둘이 **90자 = 1차의 23%** 를 쓴다.
🔴 그리고 1·3·4·5·6 은 **같은 사실(후보 0)** 을 다섯 번 말한다.

### ⒝ 🔴🔴 **같은 1차 화면이 서로 모순되는 말을 한다**(후보 3건 상태 · 실측)

```
「국내 시장가격이 **확인되지 않아** 목표마진 달성 여부를 판단할 수 없습니다」
「🇰🇷 국내 동일상품 **확인 가격 KRW 88,000**」      ← 바로 아래 줄
```

🔴 **원인은 또 «집계 owner 둘»** 이다 — 앞 문장은 `recommendation.recommendedPrice`(**B** ·
서버가 `domesticCompetition` 으로 계산)를 보고, 뒷 문장은 `buildPriceGuide(rows)`(**POST
transient 후보**)를 본다. 후보가 transient 로만 들어오면 B 는 **null 로 남는다.**

🔴🔴 **이것은 `40bb52c7`(제가 직전에 배포한 작업)이 만든 모순이다.** 그 WU 는 B 가 null 일
때 「판단할 수 없습니다」를 **CASE D 의 빈 자리를 채우려고** 넣었는데, **후보는 있고 B 만
null 인 상태** 를 보지 못했다. 🔴 CPO 정책 확정 전이므로 **고치지 않았다.**

### ⒞ 셀러 판단에 불필요(판단 재료가 아니다)

```
`market-recheck-button`(🔄 다시 분석)   조사는 자동으로 돈다 — 셀러에게 **조사 업무** 를 준다
`market-same-count-*` 0곳 ×2            건수 0 은 ⒜5·6 이 문장으로 이미 말한다
`mi-candidate-empty-note` ×2            **분모 설명** 이다(우리 내부 사정 · 셀러의 결정과 무관)
```

### ⒟ 판정 문구 반복 — **1차 2곳**(요약 · ActionCenter) · 결론 영역은 🟢 제거됨

🟢 `40bb52c7`(⒝ 결정)이 결론 영역에서 빼서 **셋 → 둘** 이 됐다. 🔴 CEO 가 「그대로」라고 본
이유는 **요약·ActionCenter 가 유지 대상이었기 때문** 이다(CPO 승인 범위대로다).

---

## 3. 「조건부 판매」의 데이터 상태 · owner · resolver · consumer

### 사슬 (전수 추적)

```
computeSellability / computePriceRecommendation
   ↓
deriveRepresentativeSellerVerdict()        representative-seller-decision.ts
   → RepresentativeVerdictCode  6종
   ↓  applyMarketCaseGuard()               :139  CASE B/C → HOLD (정책 A)
SELLER_FACING_MAP                          :314  🔴 **6종 → 3종으로 압축**
   ↓
buildSellerDecision()                      seller-decision.ts:209
   → applyMarketOutlookToVerdict()         :77   🔴 **강등만 · 승격 없음**
   → sellerDecision.finalVerdict
   ↓  (API 응답)
resolveSellVerdictCopy(finalVerdict, representativeCode)   Panel:952
   ↓
consumer ①  buildJudgementSummaryInput().verdictLabel  → 상단 요약
consumer ②  CommerceWorkspace:4603 verdict={…}         → ActionCenter
consumer ③  MarketPriceComparison sellVerdictCopy      → 🟢 **표시 소비 제거**(40bb52c7)
                                                          · 🔴 CTA STOP 게이트로만 쓰인다
```

### `SELLER_FACING_MAP` 실측 (resolver 전수 · 하니스 출력)

| representative code | finalVerdict | 화면 문구 |
|---|---|---|
| `READY` | RECOMMENDED | 🟢 판매 추천 |
| `REVIEW_MATCH` | CONDITIONAL | 🟡 동일상품 확인 필요 |
| `REVIEW_PRICE` | CONDITIONAL | 🔴 **🟡 조건부 판매** |
| `MARKET_OPPORTUNITY` | CONDITIONAL | 🔴 **🟡 조건부 판매** |
| `NEEDS_INFO` | CONDITIONAL | 🔴 **🟡 조건부 판매** |
| `HOLD` | NOT_RECOMMENDED | 🔴 판매 비추천 |

🔴🔴 **「조건부 판매」로 보이는 코드가 셋이다.** `MI-REVIEW-MATCH-DISPLAY-1` 은 그중
**`REVIEW_MATCH` 하나만** 다른 문구로 바꿨다 ⟹ **나머지 둘은 그대로 「조건부 판매」** 다.

### 「판매 추천」이 서는 유일한 조건

```
:236  if (code === "READY" && input.domesticBasis !== "EXACT") code = "REVIEW_MATCH";
:252  const code = input.domesticBasis === "EXACT" ? "READY" : "REVIEW_MATCH";
⟹ 🔴 **`domesticBasis === "EXACT"` 없으면 READY 가 «두 경로 모두» 에서 막힌다.**
🔴 그리고 국내 tier EXACT/SAME 은 현재 **0** 이다(WU-138 · 동결축 · 재조사 금지)
⟹ 🔴🔴 **「판매 추천」은 현재 파이프라인에서 구조적으로 불가능하다.**
```

### 🔴 측정불가 — 운영 분포는 **재측정하지 않았다**

`marketCase`·representative 는 **저장되지 않는 계산값** 이라 DB 질의로 셀 수 없다.
가장 최근 실측은 **WU-021(2026-10-13 · N=26)** 이고 그 값은:

```
KIDS(17)    READY 2 · MARKET_OPPORTUNITY 11 · NEEDS_INFO 4
TENNIS(9)   MARKET_OPPORTUNITY 9
⟹ sellerFacing  RECOMMENDED 2 · CONDITIONAL **24** (92%)
   그중 MARKET_OPPORTUNITY 가 **20/24** = 「조건부 판매」의 주 원인
```

🔴 **이 숫자를 현재 값으로 쓰지 않는다**(한 달 전 · 분모 26). 정확한 분포는 CPO 우선순위
**6 「판정 분포 측정 WU」** 의 일이다.

---

## 4. 「조건부 판매」의 실제 의미와 셀러에게 요구하는 행동

| code | 실제 의미 | 셀러가 해야 하는 일 | 🔴 문구가 그걸 말하는가 |
|---|---|---|---|
| `MARKET_OPPORTUNITY` | 국내 동일상품 **판매 사례를 못 찾았다**(원가는 확인됨) | 국내 시세를 **직접** 확인 | 🔴 **아니다** — 「조건부」는 조건을 말하지 않는다 |
| `REVIEW_PRICE` | 마진이 기준 미달이나 **가격 조정으로 회복 가능** | **가격을 조정** | 🔴 아니다 |
| `NEEDS_INFO` | **원가 자체를 모른다** | **원가/비용 입력** | 🔴 아니다 |

🔴🔴 **셋은 요구 행동이 서로 다른데 화면 문구가 하나다.** 그래서 「조건부 판매」는
**다음 행동을 지시하지 못하는 라벨** 이다 — CEO 목표 화면의 「다음에 무엇을 하면 되는가」가
**구조적으로 답되지 않는다.**

🟢 근거는 이미 응답에 **있다** — `sellerDecision.reasons[]` · `representativeVerdict.description`
(예: MARKET_OPPORTUNITY = 「국내 자동 검색 기준 동일상품 판매 사례를 확인하지 못했습니다」).
🔴 요약은 그중 **`reasons[0]` 한 줄만** 쓴다(`decisionReason`).

---

## 5. 기존 계약 ↔ CEO 제품 전략 충돌 지점 (🔴 임의 수정 0)

| # | 계약 / 정책 | CEO 전략 | 충돌 내용 |
|---|---|---|---|
| ⑴ | `SELLER_FACING_MAP` 6→3 압축 (P-19-B·P-23·P-25 · CPO 확정) | 「다음에 무엇을 하면 되는가」 | 셋을 한 라벨로 묶어 **행동 지시가 사라진다** |
| ⑵ | `READY` ⇐ `domesticBasis==="EXACT"` (P-23) | 「이 상품을 판매해도 되는가」 | 국내 EXACT=0 이라 **🟢 가 영구히 안 나온다** |
| ⑶ | 국내 EXACT/SAME = 0 (WU-138 · **8축 동결**) | 같음 | ⑵의 전제가 **열리지 않는다** |
| ⑷ | `UX-06-a` 설명문 1줄 · `UX-06-b` 1차 25% | 「복잡한 분석 결과가 아니다」 | 🟡 **같은 방향** 이나 **빈 상태 설명문은 그 계약 밖** 이다(그래서 393자가 통과한다) |
| ⑸ | `mi-candidate-empty-note`(분모 설명) — 제가 `deec1d41` 에 넣었다 | 같음 | 🔴 분모 설명이 **1차에 ×2** 로 선다 |
| ⑹ | B 금액 비노출 **동결**(`UX-04-c`·`B-6`·`C-4`) | 「얼마에 판매하면 되는가」 | 🟢 충돌 아님 — A 가 그 답이다 |
| ⑺ | 요약·ActionCenter 판정 **유지**(CPO ⒝) | 「왜 그렇게 판단했는가」 | 🟡 중복 2곳은 **의도된 것** 이나 둘 다 **이유를 말하지 않는다** |

🔴 ⑴⑵⑶ 은 **CPO/CEO 정책 결정** 이다. ⑶ 은 이 트랙의 **동결축** 이라 CTO 가 열지 않는다.

---

## 6. 현재 화면 → 목표 화면 (제안 · 🔴 구현 0)

### 현재 (CASE D · 1차 598자)

```
[요약 79자]      조건부 판매 · ₩115,200 · 판매 판단 조건부 판매
[결론 393자]     🔄 다시 분석 + 「결과 없음」 / 가격 기준 + 「판단 불가」 /
                 0곳 ×2 / 「후보 없습니다」+분모설명 ×2 / 권장가 + CTA + ⓘ
[Action 126자]   판매 판단 조건부 판매 / 등록 전 확인 / 커머스 등록
```

### 목표 (CEO 네 질문에 1:1)

| 셀러의 질문 | 어디서 | 지금 상태 | 필요한 변경(제안) |
|---|---|---|---|
| 판매해도 되는가 | 요약 | 🔴 「조건부 판매」(행동 없음) | **code 별 라벨 분리** ⟹ ⑴ 정책 결정 |
| 얼마에 팔면 되는가 | 결론 권장가 A | 🟢 작동 | 유지(동결) |
| 왜 그렇게 판단했는가 | 요약 `reasons[0]` | 🟡 한 줄만 | 🔴 **code 별 「그래서 할 일」 한 줄** 로 교체 |
| 다음에 뭘 하면 되는가 | ActionCenter | 🟡 등록 체크리스트만 | 판정이 요구하는 행동을 **그 자리에** |

### 1차에서 **내릴** 후보 (🔴 삭제가 아니라 상세로 이동 · CPO 승인 필요)

```
`mi-candidate-empty-note` ×2    분모 설명 — 90자 · 1차의 23%  ⟹ 상세로
`market-same-count-*` 0곳 ×2    문장이 이미 말한다            ⟹ 상세로
`market-recheck-*`              조사 업무를 셀러에게 준다      ⟹ 실패 상태에서만
⟹ 추정 1차 393자 → **약 170자**(계산: 90 + 20 + 60 + 중복 문장 정리)
🔴 추정이고 실측이 아니다 — 구현 뒤 **같은 하니스** 로 전후를 재야 확정된다
```

---

## 7. 🔴 이 조사가 찾은 «즉시 판정 필요» 2건

```
⒜ 🔴🔴 **1차 모순** — 「국내 시장가격이 확인되지 않아…」와
   「🇰🇷 국내 동일상품 확인 가격 KRW 88,000」이 **같은 1차에 동시에** 선다(§2-⒝).
   🔴 제가 `40bb52c7` 에서 만든 것이고 **고치지 않았다**(정책 확정 전).
   🟡 최소안 — 그 문장을 **B 가 null 이고 rows 도 비었을 때만** 세운다(집계 변경 0).
⒝ 🔴 **「조건부 판매」가 셋을 덮는다** — `MI-REVIEW-MATCH-DISPLAY-1` 이 `REVIEW_MATCH`
   하나만 갈랐다. 나머지 `MARKET_OPPORTUNITY`·`REVIEW_PRICE`·`NEEDS_INFO` 는
   **요구 행동이 서로 다른데 같은 라벨** 이다 ⟹ 라벨 분리는 **CPO 정책 결정**.
```

---

## 8. 측정 한계

```
🔴 실제 따져 화면은 CTO 가 볼 수 없다 — 이 조사는 **마운트 DOM + 코드 추적** 이다
🔴 운영 representative 분포 **재측정 안 함**(저장되지 않는 계산값 · 우선순위 6의 일)
🔴 후보 3건 케이스는 `savedCandidateRows` **fixture** 다(모양은 운영 타입 · 숫자는 기존 실측값)
🔴 1차 글자 수는 **CASE D fixture 하나** 기준이다 — 상품별로 다르다
```
