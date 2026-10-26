# ▶ MASTER HANDOFF — 스마트스토어 상품자동등록

> 🔴🔴🔴 **이 문서가 유일한 진입점이다.** 세 페이지(CPO · CTO · CEO) **전부** 이것을 먼저 읽는다.
> 🔴 **페이지가 바뀌어도 프로젝트 상태는 초기화되지 않는다.** 과거 조사·결정을 다시 읽지 않는다.
> 🔴 **두 번째 진입 문서를 만들지 않는다** — 둘이 되면 서로 다른 말을 한다(이 트랙에서 실제로 났다).
> 🟢 종료된 WU 상세는 `docs/ARCHIVE-CLOSED-WU.md` 와 `docs/HANDOFF-WU-*.md` 에 있고
> **막혔을 때만 해당 절 하나** 를 연다.

---

## 0. 한 줄 상태 — 이것만 보고도 다음 행동이 정해진다

```
CURRENT WU   CORE-UX-SELLER-01  🟢 **CPO 승인 · CLOSED**(구현·계약·변이·회귀·배포 완료)
NEXT WU      **CORE-PRICE-SAME-01 STEP 1**(측정 전용 · §9-NEXT)
             🔴🔴 **CPO 지시서 발행 전까지 CTO 는 착수하지 않는다**
STEP 5       CLOSED             (CPO 2026-10-26 · 재개 조건 1건 · §10)
CEO ACTION   **화면 확인 1회** — UX01 9항 + STEP 4 를 **한 번에**(§18)
```

🔴 **CTO 가 할 코드 작업이 없다.** 다음 범위는 **CPO 가 발행** 하고, 그 보고는
**UX 결과와 섞지 않고 따로** 올린다(CPO 명시).

---

## 1. PROJECT RESUME — 페이지를 옮길 때 이것만 붙인다

```
[PROJECT RESUME]
프로젝트     스마트스토어 상품자동등록
진입점       docs/START-HERE.md (MASTER HANDOFF) — 이것만 읽는다
CURRENT WU   CORE-UX-SELLER-01
NEXT         조사 없이 구현
STEP 5       CLOSED
이 페이지 역할  CPO / CTO / CEO 검증  (하나를 고른다)
재조사 금지   owner 6건 · A/B 가격 정책 · STEP 5 결론 · MI 아키텍처 · 8축 · threshold
금지         SAME-only · EXACT-only · description 연결 · COLOR/FIT 완화 · 국내가격 pipeline
Master Handoff 를 기준으로 이어서 진행한다.
```

🔴 **전체 역사를 복사하지 않는다.** 위 블록 하나로 충분하게 이 문서를 유지하는 것이 CTO 의 의무다.

---

## 2. 역할

| | 하는 일 | 🔴 하지 않는 일 |
|---|---|---|
| **CEO** | 실제 서비스 화면 사용 · 최종 UI/UX 판단 · 등록 결과 확인 | 코드 · Git · 아키텍처 · 중간 디버깅 |
| **CPO** (GPT) | 전략 · 우선순위 · 정책 · 작업지시 · 결과 판정 · STOP/HOLD/CLOSED · **세션 간 결론 연결** | 코드 설계 강요 |
| **CTO** (Claude) | 조사 → 구현 → 계약 → 변이 → 회귀 → typecheck → build → Git → deploy → 증거 보고 | 정책 결정 · 범위 임의 확장 |

🔴 **CTO 는 기술적으로 결정 가능한 것을 CPO 에게 반복 선택시키지 않는다.**
🔴 단 **제품 정책·전략 판단은 CPO 에게** 올린다. 🔴 **CEO 에게 「다음에 뭘 할까요」를 묻지 않는다.**

---

## 3. 🔴🔴 재조사 금지 프로토콜 — 새 페이지가 가장 먼저 읽는다

새 페이지는 **이 순서로만** 시작한다:

```
① MASTER HANDOFF 읽기 → ② §0 한 줄 상태 → ③ §11 CLOSED/HOLD/금지 → ④ §9 구현
```

**금지 행동 6**:

```
❌ 과거 작업 다시 조사            ❌ CLOSED 된 WU 재검토
❌ 이미 검증된 owner 재조사        ❌ 기존 정책을 새로 추론
❌ 과거와 결과가 다르다는 이유만으로 재실험
❌ 이전 페이지의 측정을 처음부터 반복
```

🟢 **reopen 은 CPO 가 「이 결론을 다시 검증한다」고 명시할 때만** 한다.

### 🔴 실제로 발생하면 안 되는 네 문장 (CEO 지목)

```
❌ 「국내가격이 왜 COMPARISON 인가요? 다시 조사해볼게요」      → 이미 조사됐다(§11)
❌ 「description 을 연결하면 정보가 많아지니 구현해볼까요?」    → CASE C 로 닫혔다(§10)
❌ 「B 가 88,000 이니 권장 판매가격도 88,000 으로 하죠」        → A/B 정책 확정(§6)
❌ 「판매판단은 한 곳만 두는 게 깔끔하니 오른쪽을 지웁니다」    → 「결론은 하나, 표현 위치는 둘」(§9)
```

---

## 4. NORTH STAR

이 제품은 **후보 검색 결과를 많이 보여주는 시스템이 아니다.**

```
상품 1개 입력 → 동일상품 후보 탐색 → MI 가 SAME 판정
→ SAME 상품의 판매상태/가격 확보 → 셀러에게 판매 여부와 판매가격 판단 근거 제공
```

| ❌ 중요하지 않다 | ✅ 중요하다 |
|---|---|
| 후보가 몇 개인가 | **동일상품 2~3개의 가격** |
| 유사상품·AI 결과 개수 | 🇰🇷 국내 **참고가격** · 🌎 해외 **최저 소싱가** |
| 셀러가 후보를 하나씩 판단 | **MI 판매판단 + 권장 판매가격 + 실제 판매가격 설정** |

🔴 **SIMILAR · DIFFERENT · UNDECIDED 는 seller surface 에 노출하지 않는다.**
🔴 셀러가 직접 SAME/SIMILAR 를 판단하지 않는다 — **MI 가 한다.**

**셀러가 5초 안에 답을 얻어야 한다**: 「팔아도 되는가 → 얼마에 팔면 되는가 → 왜 이 가격인가」

### 🔵 최종 방향 — 🔴 **아직 «열리지 않았다»**(CPO 확정 2026-10-24)

```
국내 시장가격 → 해외 최저 소싱가 → 비용/배송/세금/수수료 → 목표마진
             → 추천 판매가격 → 판매 여부
```

🔴🔴 **이 문장을 착수 승인으로 읽지 않는다.** `CLAUDE.md §00-B` 의 가격 보류가 그대로
유효하고 **추천 판매가 · 마진 · 예상수익 «계산» 은 §7 ABSOLUTE FREEZE 에 남아 있다.**
그 범위는 **CPO 가 따로 지정** 한다. 🟢 지금 열려 있는 입력은 **원가 한 칸** 이고, 화면은
그것이 비었다는 사실만 말한다(「🧾 현재 판단」).

### 🔴🔴 이 두 문장을 같은 말로 쓰지 않는다

```
동일상품 «확정»  = MI 가 엄격하게 SAME 으로 확정한 수   ← 🟢 **0 이어도 정상이다**
참고가격        = 동일상품으로 «보이는» 후보에서 확보한 실제 판매가격
⟹ 「MI 가 아직 확정하지 못했지만 **시장가격 정보는 확보했다**」는 상태를 숨기지 않는다
```

---

## 5. MARKET RULE

🔴 국내/해외는 **검색/MI 파이프라인을 분리하지 않는다.** 공통이다:

```
원상품 → 후보 수집 → MI SAME 판정 → 판매상태 → 가격 추출
```

**차이는 «최종 가격 해석» 만이다.**

```
🇰🇷 국내   SAME 0 → 가격대 없음 · SAME 1 → **가격대 확정 불가** · SAME 2~3 → **시장 가격대**
          🔴 평균 · 추천가격 계산 금지
🌎 해외   같은 통화 → **최저 확인가** · 여러 통화 → **통화별로 각각**
          🔴 환산 금지 · 🔴 통화가 다른 숫자를 서로 비교하지 않는다
```

---

## 6. 🔴🔴 가격 정책 A / B — 절대 혼동 금지

```
A = 권장 판매가격   «내가 얼마에 팔 것인가»   — 원가 기반 · 사용자에게 보여주는 값
    landed cost → fee → target margin → **suggestedPriceKrw**   (기존 계산 그대로)
    owner: CommerceWorkspace.tsx:1996 `recommendedPriceKrw`

B = 국내 시장가격   «시장에서 얼마에 팔리고 있는가»   — **근거** 다
    화면 명칭 「🇰🇷 국내 참고가격」 · owner: marketComparison.domesticReference
```

🔴 **금지 3** — B 를 권장 판매가격으로 사용 · A/B 를 합친 새 추천가격 생성 ·
「국내 최저가 = 권장 판매가격」으로 변경.

🟢 실측 기준선(재계산 금지) — 착지원가 ₩230,721 · **A ₩295,796** · **B ₩258,000**
(marketCase B · Net 0.6%) · 셀러 확정가 ₩295,800 ⟹ **셀러가 A 를 그대로 적용했다.**

---

## 7. ABSOLUTE FREEZE

```
MI 판정축 · SAME threshold · 8축 · crossSellerReserved · discovery algorithm ·
Registry · adapter · price_alerts · DB schema · Gemini/API 비용 구조 ·
추천 판매가격 계산 · 마진 계산 · 통화 환산 · 새 후보 검색 알고리즘 ·
새 seller candidate UI · 국내 SAME 판정축 개선
```

🔴🔴 **국내 SAME = 0 을 이번 WU 에서 해결하려 하지 않는다** — 별도 WU 다.
🟢 근거는 측정돼 있다: 첫 divergence 는 **공급**(국내 6·4 : 해외 30·25)이고 어댑터 게이트는
국내 0/2 · 해외 3/22 로 양쪽을 거의 같게 막는다. **재조사 금지.**

---

## 8. ALREADY DONE — 재구현하면 하나인 것을 둘로 쪼갠다

```
Seller Decision      최종 owner **하나**(`seller-decision`)
Price owner          시장가격 숫자를 여러 영역에서 중복 표시하지 않는다
Price interpretation 🇰🇷 가격대 · 🌎 최저 확인가 · 통화별 · 환산 0 · 추천 0
MI blocker           1차 **건수만** · 사유는 `▸ MI 상세 분석`(2차) — 삭제가 아니라 이동
후보 접힘             모든 후보 구역이 `candidate-fold`(기본 접힘 · `open` 금지)
STEP 4               권장 판매가격 A 1차 노출 + **ⓘ 가격 계산 기준 앵커 복구**(배포 `6fe1b0bf`)
```

### SAME_PRICE_CAP = 3 — 🔴 가격 «계산» 에만 적용

```
🔴 SAME **건수를 3개로 잘라 숨기지 않는다** — 「동일상품 확인 5곳」은 그대로 표시한다
🟢 가격 계산에 쓰는 데이터만 **통화별 최대 3개**(GBP 3 · USD 3 · EUR 3 …)
🔴🔴 전역 3개로 자르면 통화가 섞여 **「최저 확인가」가 거짓** 이 된다
```

🟢 계약·변이는 이미 검증됐다(`wu-148-market-price-signal` D) — **재사용하고 재구현하지 않는다.**

---

## 9. 🟢🟢 **CORE-UX-SELLER-01 — 구현·배포 완료**(CEO 확인 1회만 남았다)

> 🔴 **CTO 가 할 코드 작업이 없다.** 다음은 **§9-NEXT** 이고 **CPO 가 발행** 한다.

### 🟢 실행 완료 기록 (2026-10-26)

```
① 판매판단   왼쪽 📊 1차에 `market-sell-verdict` — 🔴 오른쪽 Action Center **유지**
             owner 하나: resolveSellVerdict(CW:727) → FINAL_VERDICT_COPY(Panel:873)
             🟢 좌우가 **글자 그대로 같은 식** 이다(계약 UX-02-b 가 둘 다 문다)
② 권장가 ₩A  `market-recommended-price` + **CTA `market-apply-recommended-price`**
             🔴 CTA = `() => updateSalePriceKrw(recommendedPriceKrw)` — PriceEditor:158 과
                **같은 함수**(새 handler 0 · 새 state 0 · 재계산 0)
③ 근거       🇰🇷/🌎 `market-blocks` — **순서만** 이동(블록 안쪽 불변)
④ ⓘ          `market-price-calculation-link` 를 ③ **뒤** 로 이동(기존 핸들러·앵커 그대로)
🟢 새 prop **정확히 둘** — `sellVerdictCopy` · `onApplyRecommendedPrice`
🟢 새 어휘 둘은 기존 copy owner 에 — `APPLY_RECOMMENDED_PRICE_LABEL` · `SELL_VERDICT_HEADING`
🔴 MI · SAME · 국내가격 수집/자격 · priceTierFromLink · aggregation · 환율 ·
   profitability · A/B 계산 · API · DB · schema **전부 변경 0**
```

🔴🔴 **그 과정에서 알게 된 것 — 「💡 판매 판단」과 「판매 판단」은 다른 것이다**:
```
MARKET_RESULT_HEADING  「💡 판매 판단」 = 결론 «문장» 블록(seller-decision) 제목 · **상세에 있다**
                        🔴 계약 둘이 「1차로 되돌아오면 FAIL」을 문다(core-2v:232 · wu-146:222)
SELL_VERDICT_HEADING   「판매 판단」   = 한 줄 verdict 의 머리말 · **1차에 있다**(이번 WU)
⟹ 🔴 둘을 합치면 그 계약 둘이 FAIL 한다. **그것이 가드가 맞는 것이다.**
```

### 🔴 검증 결과

```
계약 신규 **24**(`core-ux-seller-01-decision-order` · UX-01~06) — 마운트 DOM + 소스 배선
변이 **M1~M6 전부 FAIL → 바이트 복구**(md5 일치 · 흔적 0)
  M1 판매판단 제거 **4F** · M2 A 제거 **8F** · M3 CTA 배선 제거 **1F** ·
  M4 B→A 자리 **1F**(기존 D-6 이 잡았다) · M5 ⓘ→B **2F** · M6 오른쪽 제거 **1F**
회귀 **677 files / 9,205 passed / 0 failed / 140 skipped** · typecheck 0 · build 0
🔴 기존 계약 1건(`core-2r5` A-2·A-4-b)이 FAIL 했고 **의도된 순서 변경** 이라 앵커를
   갱신·**강화** 했다 — 슬라이스 기준을 «순서» 에서 «층»(상세 접힘 앞)으로 바꾸고
   **새 순서를 직접 단언** 하도록 더했다(약화 0)
```

---

## 9-NEXT. 🔵 **다음 WU — `CORE-PRICE-SAME-01` STEP 1**(🔴 CPO 지시서 발행 대기)

> 🔴🔴 **CTO 가 임의 착수하지 않는다**(CPO 명시 2026-10-26). 아래는 **발행될 범위** 다.
> 🔴 **STEP 1 은 측정 전용** 이다 — 구현이 아니다.

```
목적   「국내 참고가격이 **실제 SAME 상품의 가격** 으로 구성되는지」를 증거로 확인한다
우리가 원하는 흐름   원상품 → SAME 판정 → SAME 신뢰 후보 → 국내 가격
                   → 국내 참고가격 → 판매판단 → 권장 판매가격
의심되는 흐름       국내 후보 → EXACT / COMPARISON → 국내 참고가격
```

### 🔴🔴 **그 「의심」은 이미 코드로 확인됐다 — 다시 조사하지 않는다**

```
market-intelligence.ts:**318**  if (e.priceTier === "EXACT" || e.priceTier === "COMPARISON")
market-intelligence.ts:**192**  국내 축 = market === "KR" && priceKrw != null && tier EXACT|COMPARISON
⟹ 🔴 **적재 자격의 술어는 `priceTier` 이고 SAME verdict 가 아니다.**
   즉 CPO 가 적은 「의심되는 흐름」이 **현재 운영 코드의 모양** 이다(추측이 아니다).
🔴 그리고 이것은 **기록된 사실** 이다 — 「국내 참고가격은 `PRESUMED_SAME` 을 받아들인다 ·
   자격은 tier 이고 SAME 축과 **다른 술어** 다」. 🔴 **SAME 만 허용하면 AC009 국내 가격이
   사라진다**(1 → 0 · 실측 · §10 반사실).
🟢 **그래서 STEP 1 의 질문은 「갈라지는가」가 아니라 «각 후보가 왜 그 tier 를 받았는가» 다.**
```

### 🔵 STEP 1 이 표로 답해야 하는 것 (CPO 질문 그대로)

```
국내가격 aggregation 의 실제 입력 후보는 무엇인가 · 각 후보의 MI verdict · truth · tier ·
SAME 판정은 어디서 만들어지는가 · 국내가격 eligibility 는 어디서 만들어지는가 ·
두 경로가 **정확히 어느 좌표에서** 분리되는가 ·
현재 국내 참고가격에 들어온 **각 후보가 SAME 인지 아닌지** 를 하나의 표로 재현할 수 있는가
```

🔵 **AC009 실제 케이스 — 네 판매처를 «한 줄 lineage» 로**:

```
biskuit · luxboy · donokids · beaumonde
  candidate → MI verdict → truth → transientDisplayTier → priceTier
            → domestic eligibility → domesticReference
```

### 🔴 STEP 1 에서 **절대 수정하지 않는다**

```
❌ SAME 알고리즘  ❌ 8축  ❌ threshold  ❌ COLOR/FIT  ❌ description  ❌ image  ❌ C3
❌ priceTierFromLink  ❌ 국내가격 검색/수집  ❌ aggregation 로직
```

🔴 **측정 결과가 나온 뒤에만 CPO 가 최소 수정 여부를 결정** 한다.

### 🔴🔴 성공 기준 — **「몇 개 잡혔느냐」가 아니다**

> **「잡힌 국내가격 각각이 «왜 SAME 가격이라고 판단됐는지» 설명할 수 있느냐」**(CPO 문장)

🟡 **전략 문장(§10 과 같다)** — 「국내가격을 **많이** 가져오는 시스템」이 아니라
「**같은 상품** 의 국내가격을 근거로 판매결정을 내리는 시스템」이다. 순서를 뒤집지 않는다.
🔴 **그리고 CPO 는 이 결과를 UX 결과와 섞어 판단하지 않는다** — 보고를 따로 올린다.

---

## 9-ARCHIVE. 🔵 [기준선] CORE-UX-SELLER-01 좌표 — 재조사 금지

> 🔴 **presentation layer 전용** — 계산 · MI · API · DB **전부 금지**.
> 🟢 owner 6건과 CPO 판정이 **확정**됐다. **재조사하지 않는다.**

### 🟢 owner 6건 (코드 좌표 · 전부 확인됨)

```
① 판매판단        `sellVerdict` = resolveSellVerdict(reportedSellVerdict, snapshotId)
                  CommerceWorkspace.tsx:**727** · 공급 onSellerVerdictChange(:3792)
                  현재 렌더 자리 = **오른쪽 Action Center**(:4418 `FINAL_VERDICT_COPY[sellVerdict]`)
② A 권장 판매가격  `recommendedPriceKrw`(CW:**1996**) · 소비 둘 — PriceEditor(:3990) ·
                  MarketPriceComparison(:3680)
③ B 국내 참고가격  `marketComparison.domesticReference` → 🇰🇷 블록(`domestic-reference`)
④ ⓘ 가격 계산 기준 `PRICE_CALCULATION_LINK_TEXT` + `handleOpenPriceCalculation`(CW:**862**)
                  도착지 = 앵커 블록(CW:**3727** · `priceDetailRequest > 0`)
⑤ 가격 적용        `updateSalePriceKrw`(CW:**1452**) · 기존 CTA = PriceEditor.tsx:**158**
⑥ 상세 영역        `price-detail-fold`(MarketPriceComparison) + `priceCalculationDetail`(CW:2025)
```

### 🟢🟢 CPO 판정 (2026-10-26) — **「결론은 하나, 표현 위치는 둘」**

```
✅ ① 왼쪽(📊 가격 분석)에 **추가** + ② 오른쪽 Action Center **유지**
   왼쪽 = 셀러의 **1차 판단** 화면   ·   오른쪽 = 현재 커머스 작업의 **실행** 영역
   🔴 오른쪽을 지우면 다른 탭/작업 흐름에서 판매판단이 사라진다
🔴🔴 **「결론 owner 둘」이 아니다** — owner 는 resolveSellVerdict() → sellVerdict(CW:727)
   → 기존 **`FINAL_VERDICT_COPY`** 하나이고 **두 UI 가 그것을 «소비»** 한다.
   🔴 두 곳에서 결론을 **각각 만드는 것은 금지** 다.
   ⟹ 계약으로 잠근다: 새 verdict 계산 0 · 새 copy owner 0 · 양쪽이 **같은 상수** 를 읽는다
```

### 🔵 최소 변경 설계 (새 계산 0 · 새 state 0 · 새 API 0)

```
MarketPriceComparison 에 **prop 둘** 을 더한다(값은 전부 이미 있다):
  sellVerdictCopy?: {icon,title,note} | null   ← CW 의 sellVerdict + FINAL_VERDICT_COPY
  onApplyRecommendedPrice?: () => void         ← () => updateSalePriceKrw(recommendedPriceKrw)

그리고 1차 블록 **순서만** 바꾼다(문장 삭제 0):
  ① 판매판단(조건부 판매 + 한 줄)  ← 🔴 새 문구를 만들지 않는다(기존 copy owner 재사용)
  ② 권장 판매가격 ₩A + **[이 가격으로 설정]**
  ③ 가격 판단 근거 — 🇰🇷 국내 참고가격 · 🌎 해외 최저 소싱가(**기존 두 블록 그대로**)
  ④ ⓘ 가격 계산 기준 보기 → 기존 앵커(STEP 4 에서 되살려 뒀다)

🔴 `[이 가격으로 설정]` 은 **반드시** `updateSalePriceKrw(recommendedPriceKrw)` 를 부른다
   ⟹ PriceEditor 의 「최종 판매가격에 적용」(:158)과 **동일 동작**(사본 0 · 새 handler 0)
```

### 🔵🔵 실행 표 — **단계 × 완료 조건이 한 줄에 있다**(CEO 확정 양식 2026-10-26)

> 🔴 이 표 하나로 실행한다. 행을 건너뛰지 않고, 완료 조건의 **증거** 를 보고서에 그대로 적는다.
> 🔴 **STOP 열에 걸리면 범위를 넓히지 않고 그 자리에서 STOP 보고** 한다.

| # | 단계 · 무엇을 바꾸는가 (좌표) | 완료 조건 (증거) | 🔴 FAIL / STOP |
|---|---|---|---|
| 0 | **착수** — owner 6건·A/B 정책·STEP 5 **재조사 0** | 조사 도구 호출 0 · 바로 코드 | 탐색성 조사를 시작하면 STOP |
| 1 | `MarketPriceComparison` 에 **prop 둘** — `sellVerdictCopy` · `onApplyRecommendedPrice` | 새 prop **정확히 2** · 새 state **0** · 새 API **0** | 3번째 prop·새 state 가 필요해지면 STOP |
| 2 | **① 판매판단** 을 왼쪽 📊 1차에 삽입 (`FINAL_VERDICT_COPY[sellVerdict]` 소비) | 왼쪽·오른쪽 **문자열 동일** · 오른쪽 Action Center **존재** | verdict 를 **계산** 하거나 새 copy 를 만들면 STOP |
| 3 | **② 권장 판매가격 ₩A** (`recommendedPriceKrw` 그대로) | 화면 ₩ 금액 == A · 계산 코드 변경 0 | A 계산을 건드리면 STOP |
| 4 | **② CTA [이 가격으로 설정]** → `updateSalePriceKrw(recommendedPriceKrw)` | 클릭 시 그 함수 1회 호출(스파이) · 새 handler 0 | 별도 적용 handler/재계산이면 STOP |
| 5 | **③ 근거** 🇰🇷 국내 참고가격 · 🌎 해외 최저 소싱가 — **순서만** 이동 | 두 블록 **그대로** · 환산 0 · 통화 합산 0 | B 가 A 위치로 오면 STOP |
| 6 | **④ ⓘ 가격 계산 기준** — 기존 `handleOpenPriceCalculation` + 앵커(CW:3727) 유지 | 클릭 → `priceDetailRequest` 증가 → 상세 노출 | ⓘ 가 **B** 를 설명하면 STOP |
| 7 | **계약 UX-01~06** — 순서 · owner 동일 · CTA · A/B · ⓘ · 1차 비중 | 신규 계약 PASS (분모 명시) | 기존 계약을 **약화** 해야 PASS 면 STOP |
| 8 | **변이 M1~M6** — 판매판단/A/CTA 제거 · B 를 A 자리 · ⓘ→B · 오른쪽 삭제 | **6/6 전부 FAIL** → 바이트 복구 | 하나라도 통과하면 계약이 약하다(단언 강화) |
| 9 | **전체 회귀** `apps/admin` | **676 files / 9,181 passed / 0 failed / 140 skipped** 이상 | 「UI 변경이라 생략」 금지 · 낮아지면 원인 규명 |
| 10 | **typecheck** `tsc --noEmit` | `error TS` **0** | — |
| 11 | **build** `npm run build` | exit **0** | — |
| 12 | **산출물 점검 + Git** — 🔴 `docs/core-2m-visual-review.html` 등 라이브 재생성물 확인 | `git status` 로 **파일 전수 확인 후** 커밋 · 무관 파일 **0** | 생성물을 자동 커밋하면 FAIL(이번 세션에 실제로 났다) |
| 13 | **deploy → Production** | `/` · `/pipeline` HTTP · UX01 화면 mount 확인 | 「Deployment successful」만 적으면 FAIL |
| 14 | **CEO 확인 9항** (판매판단 위치 · 양쪽 불일치 0 · A 가시성 · CTA 직관 · B 는 근거 · ⓘ 는 A) | CEO PASS 1회로만 **Production UI PASS** | 세 질문(팔아도 돼/얼마에/왜)에 못 답하면 **UX01 FAIL** |
| 15 | **보고 17절 + 좌표 갱신** | 분모 포함 보고 1회 · **START-HERE §0·§9 갱신** | 갱신 없으면 다음 페이지가 과거로 되돌아간다 |

🔴 **완료 기준은 「구현했다」가 아니다** — 표 **0~15 전 행** 이 채워져야 CORE-UX-SELLER-01 이 닫힌다.

### 🔴 이 WU 에서 변경 금지

```
❌ sellVerdict 새 계산   ❌ 새 verdict copy    ❌ 오른쪽 Action Center 삭제
❌ A/B 통합             ❌ B 를 권장가로 승격  ❌ ⓘ 가 B 를 설명
❌ 가격 계산 변경        ❌ 국내가격/SAME pipeline 변경
❌ 새 state             ❌ 새 판단 로직
❌ SAME 판정 · MI 계산 · priceTierFromLink · aggregation · 환율 · profitability
❌ API · DB · snapshot · SAME-only · EXACT-only · description 연결
❌ COLOR/FIT blocker 완화 · C3 재개 · 이미지 MI 축 개방
```

🟢 **1차 방어선** — `core-next-step4-recommended-price`(25) + `core-2ao-r1-screen-dump`
(기존 계약: A/B 분리 · B 승격 금지 · ⓘ 는 A 설명 · `market-next-step-line` ≤1 · ₩ 1개 ·
1차 정보 비중 <25%). 🔴 FAIL 조건·CEO 확인 7항은 **CPO 지시문 §15·§17 그대로** 쓴다.

---

## 10. 🟢🔴 STEP 5 = CLOSED (CPO 2026-10-26) — 재개 조건 **하나**

| 트랙 | 판정 |
|---|---|
| ① 품번/모델코드 | 🟢 **유지**(작동 중 · exact 3/4) |
| ② 상세설명 직접 연결 | 🔴🔴 **금지** — 정답 SAME 악화가 **서로 다른 분모에서 2회 재현** |
| ③ 상세 브랜드 단서 | 🔴 근거 부족(`descBrandEvidence` 1/8) |
| ③-b 품번→브랜드(C3) | 🟡 **HOLD**(AC009 이득 0 · 위험 0) |
| ④ 이미지 | 🟡 **HOLD**(후보 `imageUrl` 하드코딩 null · 공급 owner 없음) |
| ⑤ 국내가격 SAME 자격 | 🔴🔴 **HOLD** |

### 🔵 재개 조건 — 구현 WU 가 아니라 **「GT 기반 정밀도 재측정 WU」** 다

```
WU-063~080 의 GT 를 기준으로 **COLOR/FIT 축을 완화했을 때**
  ⒜ SAME precision 이 실제로 개선되는가   ⒝ HUMAN DIFFERENT 가 **함께 열리지 않는가**
🔴 안전한 축이 확인되기 전까지 **현재 운영 MI 를 보존** 한다.
🟢 재사용 하니스 — `core-step5-evidence-c3-gt`(27쌍) · `core-step5-e2-description-evidence`(8쌍) ·
   `core-step5-domestic-lineage`(AC009 live). 🔴 셋 다 **발화 단언** 을 들고 있다
   (반사실이 안 돌면 FAIL · 「변화 0 = 안전」 금지).
```

### 🔴🔴 이 트랙의 전략 결론 — **순서를 뒤집지 않는다**

> **국내가격을 더 많이 가져오는 것이 목표가 아니다.** 먼저 「같은 상품」이라는 증거가
> 신뢰할 수 있어야 하고, **그 다음에** 그 상품의 국내가격만 가격 판단에 쓴다.

🔴 뒤집으면 WU-063~080 이 쌓은 SAME 개선을 무너뜨린다(여덟 축 전수 측정).

---

## 11. CLOSED / HOLD / 금지 — 원장

```
🟢 CLOSED   가격 축(자격만 주면 기존 집계기가 작동 · 국내 59,000~88,000 ·
            해외 EUR 35~40 / GBP 33 / USD 56 · leakage 0) — **더 파지 않는다**(CPO)
            STEP 5 · CORE-2S/2T/2U-A/2V/2W/2X/2Y/2Z/2AA/2AC/2AO · WU-130~152 ·
            여덟 보호축(COLOR·TITLE·MODEL_CODE·LINE·MARKET·PRICE·LANGUAGE·BRAND)

🟡 HOLD     SI-3(품번 없는 후보에서만 발화 · 운영 미적용) · C3 · 이미지 축 ·
            국내가격 SAME 자격 · 소재 어휘 정규화 ·
            CPO 판정 2건 — ⒜ 후보측 brand null 시 BRAND_UNCONFIRMED
                          ⒝ 고도몰 `set_goods_price` 판매가 필드

🔴 금지     SAME-only / EXACT-only 가격 필터 · 국내가격 수집 로직 변경 ·
            priceTierFromLink 변경 · COLOR/FIT blocker 완화 · description 재연결 ·
            AUDIENCE_LINE 완화 · GARMENT_FORM 조건 추가 · SAME_MIN_AXES ·
            corePoints 산식 · TITLE partial 점수 · crossSellerReserved · threshold
```

🔴 **SAME 축에서 확정된 사실** — CEO 가 SAME 으로 확정한 **8개** 를 자동 MI 가 회복하지
못하는 원인은 **전부 blocker/conflict** 다(점수 부족은 1건뿐). CORE-2X 가 증거 레버 C0~C6
전수에서 **0/8** 을 측정했다(STOP-C). ⟹ 다음 범위는 **CPO 가 지정** 한다.

🔴 **SI-3 의 사정거리가 구조적으로 좁다** — 공식몰 AB/AC **108/108 이 MODEL_CODE conflict**
로 조기 반환(axes: [])되어 TITLE 축이 **계산조차 되지 않는다** ⟹ SI-3 은 발화할 수 없다.

🔴 **「국내 SAME 0」은 MI 문제가 «아니다»**(WU-150 · 재조사 금지) — B226AC009 국내 URL 7개 중
**5개는 페이지를 읽을 수 없고**(403 ×2 · SPA ×1 · 목록 ×2), 읽히는 1개(보몽드)는 **품번까지
맞춰 놓고 「brand 칸 하나」로 보류** 된다. 🟢 SKU 는 사라지지 않았다 —
`brandModelCode="B226AC009"` 가 MI 까지 정상 전달된다.

### 🟢 CI 상주 회귀 (네트워크 0 · 믿고 쓸 것)

```
core-2aa 17  국내 가격 회귀(KRW 59,000~88,000 · 3곳 · sellerKey dedupe)
core-2af  4  WU-143 false SAME 5쌍 — SI-1/2/3 재발 0/5
core-2ab  3  PLAIN_HTML 빈 칸 다섯 + Shopify 비대칭
core-2ac  8  parity 세 칸 범위(🔴 소재는 «채우지 않는다» 가 계약이다)
core-2ad  5  corePoints 산식 바이트 고정     core-2ae 5  AUDIENCE_LINE 발화 경로
core-2ag  4  표본 출처 / SI-3 정의          core-2ah 3  GT 합집합   core-2ai 4  반례 모양
🔴 라이브 축은 환경변수로만 — CORE2Z/2AB/2AC/2AD/2AE/2AF/2AG/2AH/2AI_LIVE=1
```

---

## 12. CONTRACT / SAFETY — 이 숫자를 다시 조사하지 않는다

```
handleRequestPriceReview     9 refs
marketEvidence               7 refs
PRICE_COMPARISON_ANCHOR_ID   4 refs   🔴 WU-141-R3 **보존 계약** — 지우지 않는다
PRICE_CALCULATION_ANCHOR_ID          🔴 STEP 4 가 되살린 앵커 — 지우지 않는다
```

🔴 계약은 그 구역의 **«존재» 를 글자로 단언** 한다 ⟹ 제거하면 「없다」로 **방향을 뒤집어**
다시 쓴다. 🔴 약화가 아니다 — 「seller 화면에 없다」 **그리고** 「backend/API 는 **살아 있다**」를
**같이** 단언한다. 🔴🔴 **계약을 지워서 테스트를 통과시키지 않는다.**

### 🔴 제거 계약엔 보존 단언을 «같이» 둔다

「없다」만 쓰면 다음 사람이 엔진까지 지운다. 금지 어휘는 전면 리터럴이 아니라 **범위/개수** 로
단언한다(필수 부정문이 리터럴 금지에 걸린 적이 **세 번** 있다 — 「평균은 부정문으로만」).

---

## 13. IMPLEMENTATION ORDER — 코드 변경 후 중단하지 않는다

```
1 좌표 확인(§9)  2 §7 freeze 재확인  3 구현  4 영향 계약 갱신(삭제로 우회 금지)
5 **targeted tests**   ← 🔴 전체 회귀보다 먼저
6 **mutation**         (전부 FAIL 해야 한다 · 실행 후 **바이트 복구**)
7 **2-product E2E**    (B226AC009 · B226AC010)
8 full regression   9 typecheck   10 build   11 deploy   12 production check   13 보고 1회
```

🔴 순서를 뒤집지 않는다 — 전체 회귀를 먼저 돌리면 **내 계약이 틀렸는지, 기존 계약이
깨졌는지** 를 가를 수 없다.

---

## 14. TEST RULE — 분모를 반드시 적는다

```
677 files / **9,205 passed** / 0 failed / 140 skipped   ← 기준선(apps/admin · CORE-UX-SELLER-01 후)
typecheck PASS (0)      build PASS (exit 0)
🔴 라이브 네트워크 하니스 **2건이 병렬에서 간헐 FAIL · 단독 PASS** —
   `p54c1-grounding-redirect`(CPO 가 합산 제외한 baseline) ·
   `core-2m-visual-review-build`(외부 사이트 의존 · `packages/` 변경 0)
🟢 **그 둘이 같이 통과한 실행이 이 기준선이다**(그래서 직전 기록 675/9,180 보다 +1/+1)
🔴 숨기지 않는다 — 다음 실행에서 9,180 이 나오면 **회귀가 아니라 그 2건의 간헐 실패** 다
```

🔴 **기존 테스트를 통과시키려고 수정하지 않는다** — 기능 정책이 바뀐 경우에만 계약을
**의도적으로** 갱신한다. 🔴 소스 문자열 검사는 **주석을 벗기고** 한다.
🔴 화면은 **마운트한 DOM** 으로만 완료 선언한다(Render PASS ≠ 소스 PASS).

---

## 15. 🔴🔴 REPORT RULE — 중간 보고 없음 · 최종 1회 · **마지막 절은 필수**

```
1 목적        2 변경        3 실제 결과     4 회귀
5 변경 금지 영역 준수       6 Git          7 Deploy
8 STOP / Risk              9 CEO Action

+ 변경 파일 · 테스트 분모 · typecheck · build · Production 상태

🔴🔴 **마지막은 반드시 이것이다 (CEO 지시 · 생략 금지)**
   ▸ 현재 프로젝트가 **어디까지 왔는가**
   ▸ 다음에 **정확히 무엇을 해야 하는가**
```

🔴 「이번 세션에서 무엇을 했는가」보다 **「지금 좌표 + 다음 한 수」** 가 중요하다.
🔴 그리고 보고가 끝나면 **이 문서의 §0 과 §9 를 같이 갱신** 한다 — 갱신하지 않으면
다음 페이지가 다시 과거로 되돌아간다.

---

## 16. DEPLOY → PRODUCTION CHECK

```
git fetch origin --quiet ; git status ; git rev-list --left-right --count origin/main...HEAD
🔴 종료 보고에 clean 여부 **와** ahead/behind 숫자를 같이 적는다
배포 후 확인  /  ·  인증 redirect  ·  Seller Decision route  ·  상품 상세/판단 화면
🔴 「Deployment successful」만 적지 않는다 · 🔴 401/307 을 route 증거로 쓰지 않는다
🔴 `main` push 가 Production 배포를 부른다 · `vercel --prod` CLI 는 쓰지 않는다
```

---

## 17. STOP RULE

**아래일 때만** 안전 종료한다:

```
코드 변경 «전» 예상치 못한 구조적 위험 발견 · production destructive action 필요 ·
business/security policy 승인 필요 · 기존 freeze 를 깨야만 해결 가능
```

🔴 그 외에는 **코드 변경 → 검증 → 배포까지 계속 진행한다.**
🔴🔴 「코드 변경 후 세션이 부족할 것 같다」로 **중간 중단하지 않는다** —
**착수 «전» 에 범위를 잡고 끝까지 닫는다**(§4-C 용량 판단은 WU 단위다).

---

## 18. CEO RULE + 현재 CEO Action

CEO 는 코드·계약·commit 을 검토하지 않는다. **배포 전에는 아무것도 요청하지 않는다.**
배포 뒤 **최종 테스트 1회** 만 요청하고, 형식은 **넷** 이다:

```
테스트 URL:      테스트 상품:      테스트 순서:      예상 결과:
```

### 🟡 지금 열려 있는 CEO Action — **화면 1회**(UX01 + STEP 4 를 한 번에)

🔵 **UX01 확인 9항** — `/pipeline` 에서 아무 상품 1개(「새 상품 분석」 또는 「🔄 다시 분석」):

```
[ ] 왼쪽 📊 영역에 **판매판단** 이 보인다
[ ] 오른쪽 Action Center 가 **그대로** 있다
[ ] 왼쪽/오른쪽 판매판단이 **동일하다**
[ ] 권장 판매가격 **₩A** 가 눈에 띈다
[ ] **[이 가격으로 설정]** 이 직관적이다
[ ] 🇰🇷 국내 참고가격이 **시장 근거** 로 이해된다
[ ] 🌎 해외 최저 소싱가가 명확하다
[ ] **ⓘ** 를 누르면 **A 의 가격 계산 기준** 이 열린다
[ ] 국내가격 B 를 권장 판매가격 A 로 **오해하지 않는다**
```

🔴 **세 질문에 즉시 답할 수 있어야 한다** — 「팔아도 돼?」 → 판매판단 · 「얼마에 팔아?」 →
권장 판매가격 · 「왜 그 가격이야?」 → 근거 + 계산 기준. **답이 안 나오면 UX01 FAIL** 이다.

### 🟡 같이 보는 것 — **STEP 4 화면**

```
테스트 URL   https://ttaejyo.vercel.app/pipeline   (로그인 필요)
테스트 상품   아무 상품 1개 — 「새 상품 분석」 또는 「🔄 다시 분석」
테스트 순서   ① 맨 위 「📊 가격 분석」 ② 「💡 판매가격 가이드」의 **권장 판매가격 ₩…**
             ③ **「ⓘ 가격 계산 기준 보기」를 누른다**
             ④ 바로 아래 계산 상세(원본가 → 환율 → 착지원가 → 수수료 → 마진)가 펼쳐지는가
             ⑤ 「＋ 상세정보 보기」의 「국내 시장가격에 맞추면 예상 마진 …」 한 줄
예상 결과     🟢 ①~⑤ 가 **한 화면에서** 끝난다 · 🟢 권장 판매가격 금액이 **한 번만** 뜬다
FAIL 기준     ③ 을 눌렀는데 아무 일도 없으면 FAIL · 권장 판매가격이 **두 번** 뜨면 FAIL
```

🔴 **정상인데 FAIL 로 보이기 쉬운 것 셋**:
⒜ 🇰🇷 가 「확인 1곳」이고 「가격대」가 아닌 것 — **1건을 가격대라 부르지 않는 것이 정책**(§5)
⒝ 「수익성 판단 보류 — 매입 원가를 입력하면 …」 — 원가는 셀러 입력이고 **UNKNOWN ≠ 실패**
⒞ 🌎 가 `GBP 37` 처럼 ISO 코드인 것 — **환산 금지 계약** 이고 ₩ 는 권장 판매가격에만 쓴다

🔴🔴 **작업 중 아래를 묻지 않는다 — 전부 이미 결정된 범위다**:

```
「legacy UI 를 제거할까요?」  「flag 로 숨길까요?」      「A/B 중 어떤 방식이?」
「국내 SAME 도 같이 고칠까요?」「Registry 를 늘릴까요?」  「adapter 를 추가할까요?」
「Gemini 를 다시 켤까요?」    「계약을 어떻게 바꿀까요?」「CEO 가 중간 테스트해볼까요?」
```

---

## 19. 세 페이지 운영 방식

| 페이지 | 역할 | 🔴 하지 않는 것 |
|---|---|---|
| **① CPO — MASTER / 전략** | 전략 · 정책 · WU 지정 · 보고 판정 · STOP/HOLD/CLOSED | 코드 직접 수정 |
| **② CTO — EXECUTION** | 조사 · 구현 · 계약 · 변이 · 회귀 · Git · deploy · 보고 | 정책 결정 · 범위 확장 |
| **③ CEO — QA / SCREEN** | Production 결과 · 실제 화면 · 캡처 · 최종 PASS/FAIL | 코드 임의 수정 |

🟢 **CEO 화면 피드백은 ① 로 가져가** 다음 WU 결정에 쓴다.
🔴 **세 페이지 모두 세션 시작에 이 문서를 읽고, 끝에 §0/§9 를 갱신한다.**

---

## 20. 실행 명령 (복붙)

```bash
# 회귀 — 🔴 출력을 파일로 받는다(실패 이름을 놓치지 않기 위해)
cd apps/admin && npx vitest run > /tmp/reg.txt 2>&1; grep -nE "FAIL |AssertionError" /tmp/reg.txt

# typecheck · build — 🔴 grep 종료코드를 tsc 의 것으로 읽지 않는다(파일로 받는다)
cd .. && npx tsc -p apps/admin/tsconfig.json --noEmit
cd apps/admin && npm run build

# 배포 확인
npx vercel ls --yes | grep -A1 "Age "
```

🔴 **변이는 `python3` 없이 `Edit` 로만** 한다(이 환경에 python3 이 없어 「적용 실패」가
「통과」로 읽힌 적이 있다 · 적용 여부를 `grep -c` 로 확인한다).
🔴 **미커밋 구현을 `git checkout` 으로 되돌리지 않는다** — 백업 후 **바이트 대조** 로 확인한다.

---

## 21. 아카이브 — 막혔을 때만 연다

```
docs/ARCHIVE-CLOSED-WU.md   종료된 WU 상세 45절   🔴 진입점이 아니다
docs/HANDOFF-WU-*.md         개별 WU 전문          🔴 해당 절 하나만 읽는다
CLAUDE.md §12                과거 결론 모음        🔴 작업 좌표가 아니다
```

🔴 **그 문서들의 「지금 여기」·「착수점」·「CEO 확인 대기」는 그때의 상태다.**
현재 좌표는 **이 문서 §0** 하나다.

---

## FINAL PRINCIPLE

> 이 프로젝트에서 가장 중요한 것은 **더 많은 기능을 만드는 것이 아니라,
> 이미 검증된 기능을 다시 깨지 않고 연결하는 것** 이다.

```
CLOSED = 닫힌 것      HOLD = 보류된 것
금지   = 건드리지 않는 것   CURRENT WU = 지금 할 것
```

🔴 **과거 작업을 다시 시작하지 않는다.** CPO 가 reopen 하지 않는 한 이전 단계는 **그대로
사실로 취급** 한다.

🔴 **후보를 많이 보여주는 것이 목적이 아니다.** 동일상품을 정확히 찾아 **2~3개의 가격
근거** 로 셀러가 「팔아도 되는가 → 얼마에 팔 것인가 → 왜 그런가」를 한 화면에서 판단하게
하는 것이 목적이다.
