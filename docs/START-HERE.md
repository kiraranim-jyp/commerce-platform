# ▶ MASTER HANDOFF — 스마트스토어 상품자동등록

> 🔴🔴🔴 **이 문서가 유일한 진입점이다.** 세 페이지(CPO · CTO · CEO) **전부** 이것을 먼저 읽는다.
> 🔴 **페이지가 바뀌어도 프로젝트 상태는 초기화되지 않는다.** 과거 조사·결정을 다시 읽지 않는다.
> 🔴 **두 번째 진입 문서를 만들지 않는다** — 둘이 되면 서로 다른 말을 한다(이 트랙에서 실제로 났다).
> 🟢 종료된 WU 상세는 `docs/ARCHIVE-CLOSED-WU.md` 와 `docs/HANDOFF-WU-*.md` 에 있고
> **막혔을 때만 해당 절 하나** 를 연다.

---

## 0. 한 줄 상태 — 이것만 보고도 다음 행동이 정해진다

```
트랙 A (증거)  CORE-PRICE-SAME-01   STEP 1 · 2 · 2-R 🟢 **MEASURED / CLOSED**
                                    STEP 3(IMAGE) 🟡 **NOT MEASURED** — ⏸ 착수 대기
트랙 B (화면)  CORE-UX-SELLER-01 🟢 CLOSED → **CORE-UX-SELLER-02 착수점**(§9-UX02)
               🟢 조사 끝 · 설계 확정 · **다음 세션은 조사 없이 구현**(1차에 한 줄 추가)
BLOCKING       🟡🟡 **CEO 육안 판정 11건**(§9-EV2 · docs/core-2m-visual-review.html) ← 지금 이것이다
CEO ACTION     ① **A/B/C/D 한 글자**   ② 화면 확인 1회(UX01 9항 + STEP 4)
STEP 5         CLOSED (CPO 2026-10-26 · 재개 조건 1건 · §10)
```

🔴 **CTO 는 ⏸ 대기다.** 두 트랙 **모두** CPO 발행/CEO 답변을 기다린다.
🔴 **용어·단계 판정은 §9-NEXT 「정합표」로 고정** 했다 — 「완료/확정/보류」를 섞어 적지 않는다.

---

## 1. PROJECT RESUME — 페이지를 옮길 때 이것만 붙인다

```
[PROJECT RESUME]
프로젝트     스마트스토어 상품자동등록
진입점       docs/START-HERE.md (MASTER HANDOFF) — 이것만 읽는다
트랙 A       CORE-PRICE-SAME-01 — STEP 1·2·2-R CLOSED · STEP 3(IMAGE) 착수 대기
트랙 B       CORE-UX-SELLER-01 CLOSED → CORE-UX-SELLER-02 발행 대기
BLOCKING     CEO 육안 판정 11건(docs/core-2m-visual-review.html · §9-EV2)
이 페이지 역할  CPO / CTO / CEO 검증  (하나를 고른다)
재조사 금지   STEP 1·2·2-R 결론 · owner 6건 · A/B 가격 정책 · STEP 5 · MI 8축 · threshold
금지         SAME-only · EXACT-only · description 무조건 연결 · COLOR/FIT 완화 ·
             음역축 · 국내가격 pipeline · 「시장 참고가격」 리터럴(wu-145 금지 목록)
용어         판정은 MEASURED/CLOSED/HOLD/REJECT/측정불가/STOP 여섯 중 하나로만 적는다(§9-NEXT 정합표)
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

## 9-UX02. 🔵🔵🔵 **`CORE-UX-SELLER-02` — 착수점. 조사 끝 · 구현부터**

> 🔴 **presentation layer 전용** — SAME · priceTier · domesticReference · matchTruth ·
> A/B 가격 · MI threshold **전부 0**. 🟢 **새 어휘 0**(기존 owner 재사용).
> 🔴 이번 세션은 **조사만** 했다(코드 0 · 작업트리 clean) — 다음 세션은 **조사 없이** 구현한다.

### 🟢🟢 조사 결론 — **모순의 실체는 「한쪽만 보인다」 다**(마운트 DOM 실측)

```
현재 1차(실측 덤프)   「🇰🇷 국내 참고가격 KRW 88,000 · **확인 1곳**」
                     「🌎 해외 최저 소싱가 최저 확인가 GBP 37 · USD 58」
🟢 CPO 가 원한 「₩88,000 · 확인 1곳」 형식은 **이미 있다**
🟢 CPO §6 의 제거 요구도 **이미 충족** — 1차에 PRESUMED_SAME · TEXT_CONFIRMED ·
   COMPARISON · blocker · confidence · 긴 MI 설명이 **0** 이다(`core-2ao-r2` 가 잠근다)
🔴 **없는 것은 「동일상품 확인 0곳」 하나** — 셀러는 그 0 을 **볼 수 없다**
⟹ 🔴 모순은 「말이 틀려서」가 아니라 **두 축 중 하나만 1차에 서서** 생긴다
```

### 🔴🔴 그것을 1차에서 빼는 게이트가 **둘** 이고, **CPO 의 이전 결정** 이다

```
MarketPriceComparison.tsx:**1086**  {!isSummary && (   ← 「🔎 동일상품 확인 0곳 — …」
OverseasReferencePrice.tsx:**121**  {!compact && (     ← statusLine
                                    (DOMESTIC_SAME_NOT_CONFIRMED · overseas-reference.ts:126)
이유(:1081-84 · :61 · :118-119)   **CORE-2AO-R2** — 「note·scope·statusLine 은 전부
                                  **근거 문장** 이다(CPO 제거 목록)」 ⟹ 1차에서 뺐다
```

### 🟢🟢 **충돌이 아니다 — 둘을 다 지키는 축이 있다**(이것이 설계다)

```
🔴 CORE-2AO-R2 가 뺀 것은 **문장** 이다:
   「동일상품으로 확정된 국내 판매처는 없습니다.」(19자) · marketEmptyNote 의 **사유** 문장
🟢 CPO UX-02 가 원하는 것은 **숫자 한 줄** 이다: 「동일상품 확인 **0곳**」
⟹ 🟢 **숫자는 1차 · 문장은 상세** 로 가르면 **두 결정이 동시에 성립** 한다
🔴 그러므로 `{!isSummary}` · `{!compact}` 게이트를 **풀지 않는다**(문장은 상세에 그대로 둔다)
```

### 🔵 최소 변경 설계 (새 어휘 0 · 새 계산 0 · 새 state 0)

```
위치   MarketBlock 의 `g.sameCount === 0` 분기 **안**(SUMMARY) — 금액 줄 **바로 아래**
       🔴 그 분기 안이라 「동일상품 확정 없음」이 **구조적으로 항상 참** 이다(:1060-62 가 적어 둔 성질)
어휘   `SAME_CONFIRMED_COUNT_LABEL`(mi-same-candidates.ts:**372** = 「동일상품 확인」) + `g.sameCount`곳
       🔴 `SAME_CHECK_HEADING`(「🔎 동일상품 확인」)을 쓰지 않는다 — 그쪽은 **상세 머리말** 이고
          1차에 올리면 2AO-R2 가 뺀 그 블록이 되돌아온다
       🔴 🔴 **「시장 참고가격」 금지 리터럴을 쓰지 않는다**(wu-145 목록 · §9-NEXT 정합표 ⑥)
결과   🇰🇷 국내 참고가격 KRW 88,000 · 확인 1곳
       동일상품 확인 0곳                      ← **이 한 줄이 이번 WU 의 전부다**
```

### 🔴 착수 전 반드시 확인할 위험 둘

```
⒜ 1차 글자 비중 계약 — `core-next-step4` B-8(<25%) · `core-2ao-r2` R2-3(상세보다 훨씬 적다)
   🔴 1차에 글자를 **더하는** 변경이다 ⟹ 두 계약을 **먼저** 돌려 여유를 확인한다
⒝ `core-2ao-r2` R2-2(「1차는 **세 블록** 이다」) — 🟢 블록을 늘리지 않는다(기존 블록 **안** 에 한 줄)
```

### 🔵 계약 UX-01~07 · 변이 M1~M7 (CPO 지시 그대로)

```
UX-01 1차에 판매판단      UX-02 권장가가 그 바로 다음   UX-03 국내 참고가격 ↔ 동일상품 확인 수 **같은 1차**
UX-04 「시장 참고가격」 금지 리터럴 0                   UX-05 `MI_SAME_AREA_SCOPE` 의미 유지(상세)
UX-06 CTA 동작 동일       UX-07 오른쪽 Action Center 존재
M1 판매판단 제거 · M2 권장가 제거 · M3 국내 참고가격 제거 · M4 동일상품 확인 수 제거 ·
M5 MI_SAME_AREA_SCOPE 연결 제거 · M6 CTA wiring 제거 · M7 금지 리터럴 삽입  → **전부 FAIL**
🔴 변이 뒤 **바이트 복구**(md5) 확인 · 🔴 python3 없음 ⟹ `Edit` 로만
```

🔴 **보고는 「CEO Production UX 확인 대기」로 끝낸다**(CPO §12) ·
🔴 `Production HTTP PASS ≠ Production UI PASS`(로그인 뒤 화면은 CTO 가 못 본다).

---

## 9-EV2. 🟡🟡 **`CORE-PRICE-SAME-02` — CEO 판정 화면 «준비 완료»**(운영 0 · CEO 육안 대기)

```
산출물   docs/core-2m-visual-review.html   **7.91MB · 자립형**(원격 이미지 0 · data: URI)
검토 대상 **11건** · 🟢 CPO 가 지목한 10곳 **전부 포함** + 충돌 후보 tinyapple
이미지   biskuit 1/1 · tinyapple 2/2 · stockmann 1/1 · bobochoses 3/3 · junioredition 3/3 ·
         cissywears 3/3 · kids21 3/3 · parkette 2/2 · luxboy 1/1 · bornyesterdaykids 3/3 · donokids 1/1
제외     global.trenbe · thefrontshop(시스템 확정 SAME · 충돌 아님) ·
         🔴 miniboutique.co.kr **UNREACHABLE**(측정불가 — 화면에 넣지 않았다)
```

🟢 **기존 빌더를 재사용했다**(새 화면 0) — `core-2m-visual-review-build`. 바꾼 것 넷:
```
① 「유사」 → **「다른제품」**   CPO 확정. 🔴 전 라운드의 「유사」는 CPO 가 내부 calibration 에서
                              DIFFERENT 로 **변환** 했고 그 변환이 CEO 뜻과 같은지 확인된 적이 없다
② **사유 입력**(textarea) 신설 · 복사 버튼 산출에 `why` 포함
③ 시스템 판정을 **실제 값으로** 분기해 적는다 — 🔴 전까지 모든 카드가 「확정하지 못했습니다」
   한 문장이었고, 시스템이 SAME 이라 한 후보에서는 그것이 **거짓** 이었다
④ **충돌 배지** — 과거 판정이 갈린 후보에 「꼭 다시 봐 주십시오」 표시
   🔴 그리고 **충돌 후보는 «확정 SAME 이어도» 화면에 넣는다**(안 그러면 tinyapple 이 사라진다 · 실측)
```

🔴 **내가 두 번 틀렸고 둘 다 가드가 잡았다** — ⒜ 템플릿 리터럴 안에 **JSX 주석 `{/* */}`** 을 써서
화면에 글자로 찍힐 상태였다(제거) ⒝ `verdict` 를 **날것으로** 적어 **내부 토큰 노출 금지 계약이
FAIL** 했다(`PRESUMED_SAME`) ⟹ 🟢 `humanWord()` 로 **셀러의 말** 로 바꿨다.

🔴 **CTO 는 판정하지 않았다** — 미리 선택된 칸 **0**(계약이 단언) · 사유 칸 비어 있음.
🟡 **CEO 는 11건에 「동일 / 다른제품 / 판단불가 + 사유」를 주시면 된다.** 🔴 판단불가는 실패가
아니다 — 증거가 부족하면 그대로 남기는 것이 **정답** 이다(CTO 가 변환하지 않는다).

---

## 9-EV. 🔴🔴🔴 **`CORE-PRICE-SAME-01` 재개 — CEO Evidence Lineage**(운영 0 · CPO 판정 대기)

> 🔴🔴 **STEP 2 의 전제가 뒤집혔다. 이것부터 읽는다.**

### 🔴🔴🔴 ① `m.luxboy.com` 의 CEO 라벨이 **둘** 이고, 최신은 **SAME** 이다

```
wu-112(이전)    DIFFERENT · 사유 「컬러 다름」
core-2m(최신)   **SAME**  · 사유 「**브랜드 + 품번 동일로 판단 가능.** 추가로 상품명·상세설명으로도」
fixture 주석    「🔴 이 한 건이 CORE-2I/2J/2K/2L 의 **핵심 반례** 였다」
                「CPO 확정: CEO 육안 판정이 truth ⟹ **최신 판정을 truth 로** 쓰고 상충을 기록한다」
🔴 GT 합집합(`core-2ah`)은 그 충돌 때문에 **이 건을 제외** 한다(36건에 없다)
```

⟹ 🔴🔴 **STEP 2 의 질문(「biskuit SAME 과 luxboy DIFFERENT 를 가르는 증거」)이 성립하지 않는다.**
최신 GT 로는 **둘 다 SAME** 이다 ⟹ 가를 필요가 없고, 둘을 **같이 여는 것이 recall 회복** 이다.
🔴 그리고 CPO 전제(「DIFFERENT 가격이 국내 참고가격에 들어온다」)는 **이 표본에서 성립하지 않는다**.

### 🟢🟢 ② CEO 가 쓴 근거가 **후보별로 적혀 있다**(`core-2m-ceo-visual-gt.json` · SAME 8 · DIFF 1 · UNC 1)

```
SAME  biskuit.kr        상품명에 「보보쇼즈 + B226AC009」 — 🔴 brand 칸은 **판매처 이름(비스킷)**
SAME  m.luxboy.com      **브랜드 + 품번** 동일 · 상품명·상세설명으로도
SAME  donokids.com      **브랜드 + 상품명** · 상품명에 브랜드와 품번(#226AC009) · 상세설명으로도
SAME  junioredition.com **브랜드 + 상품명** · 🔴 품번은 **040**(원상품 009)인데 동일상품이 맞다
SAME  bobochoses.com    브랜드 같음 · 🔴 **품번 다름(B226AB040)** · 상품명 동일
                        → 「품번은 같은 상품을 여러 개 등록한 **실수** 로 보인다」
SAME  cissywears.com    **브랜드 + 상품명** · 품번 없음 · 상세에서 파악
SAME  kids21.com        **브랜드 + 상품명** · 품번 없음 · **상세 없음**
SAME  stockmann.ee      브랜드 같음 · 품번 없음 · 상품명 다름(에스토니아어)
                        → 🔴 **상세설명까지 내려가야** 판단된다
DIFF  parkette.ca       **상품 유형** 이 다르다 — T-shirt ↔ Sweatshirt
UNC   bornyesterdaykids 상/하의 **세트** — 상의는 동일인데 **가격 비교에 부적합**
```

🔴🔴 **CEO 의 규칙을 그 말대로 정리하면 다섯이다**:
```
① 「브랜드 + 상품명」 일치 → SAME            **4/10**(품번 없어도)
② 「브랜드 + 품번」 일치   → SAME            **2/10**
③ 🔴🔴 **품번이 «달라도»** 브랜드+상품명 같으면 SAME  **2/10**(「등록 실수」)
④ **상품 유형**(T-shirt ↔ Sweatshirt)이 다르면 DIFFERENT  1/10
⑤ **세트 구성**이면 UNCERTAIN(동일성과 «가격 비교 가능성» 을 **분리**)  1/10
```
🔴🔴 **③ 이 현재 운영과 정면으로 충돌한다** — `compareModelCode` 는 품번 분기를 **conflict**
로 보고 `priceTierFromLink` 가 그것을 **EXCLUDED** 로 만든다(공식몰 AB/AC **108/108** 선차단).
🟢 ④ 는 시스템에 **이미 있다**(`GARMENT_FORM`) · 🟡 ⑤ 는 축이 **없다**(세트 판별).

### 🔴 ③ Evidence Supply Lineage (EXISTS / EXTRACTED / PASSED / USED)

```
evidence      EXISTS EXTRACTED PASSED USED   근거(좌표)
브랜드          O      O        O     O     공급됨 · 🔴 샵이 자기 이름을 적으면 거짓 신호(biskuit)
상품명          O      O        O     O     공급됨 · 🔴 한국어면 NO_TITLE_OVERLAP 이 **막는다**
품번            O      O        O     O     공급됨(title/url 경유) · 🔴 분기하면 conflict → EXCLUDED
상세설명        O      O        **X**  X     product-url-facts.ts:**441** 이 `category` 하나만 넘긴다
색상/소재/핏    O      O        **X**  X     같은 줄에서 끊긴다(7칸 하드코딩 null · :420)
이미지          O      **X**    X     X     imageUrl **하드코딩 null**(:472) · 3번째 인자 미전달(match.ts:661)
옵션/SKU        ?      ?        ?     ?     🔴 **미조사**(CORE-2AB 의 S7/S8 자리 · 기록 0)
```

### 🔴🔴 ④ False Negative **3** · False Positive **0**(최신 GT 기준)

```
biskuit.kr   CEO SAME → sys PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON   blockers BRAND_MISMATCH·NO_TITLE_OVERLAP
m.luxboy.com CEO SAME → sys PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON   blockers NO_TITLE_OVERLAP
donokids.com CEO SAME → sys PRESUMED_SAME / TEXT_CONFIRMED / COMPARISON   blockers BRAND_UNCONFIRMED
⟹ 🔴 **국내 후보 3곳이 전부 false negative** 다 · 🟢 false positive **0**
🟢 beaumonde(AC010) CEO SAME → sys SAME / STRONG_IDENTIFIER / EXACT  ← 유일하게 재현된다
```

### 🔴🔴🔴 ⑤ **CASE 1 이 아니라 CASE 2 다**(이것이 이번 조사의 답)

```
🔴 「evidence 전달만 복구하면 되는가」 → **아니다.**
   biskuit·luxboy·donokids 가 막히는 지점은 **공급이 아니다** — 브랜드·상품명·품번이
   **이미 matcher 에 들어와 있고**, 막는 것은 `NO_TITLE_OVERLAP` + `crossSellerReserved` 다.
🟢 즉 **CEO 의 주 근거(「브랜드 + 상품명」 4/10)가 입력에는 있는데 비교 규칙이 쓰지 못한다**
   — 한국어 상품명 ↔ 영문 원상품에서 토큰 겹침이 0 이 되기 때문이다.
⟹ 🔴 **CASE 2**(evidence 는 들어오는데 기존 로직이 사용하지 않는다). 🔴 CTO 는 그 로직을
   건드리지 않았다 — 완화는 WU-063~080 에서 **여덟 축 전수 측정으로 닫힌 축** 이다.
```

🔴 **측정불가로 남긴 것** — ⒜ `stockmann.ee` · `bobochoses.com` · `cissywears.com` · `kids21.com` ·
`parkette.ca` · `bornyesterdaykids.com` 은 DB 에 **system 값이 없다**(라이브 재측정 필요 · 이번에 안 했다)
⒝ 옵션/SKU 축은 **기록 자체가 0** ⒞ GT 충돌이 **둘 더** 있다(`villagekids.co.uk` · `tinyapple.net`
각각 SAME/DIFFERENT 양쪽 라벨이 DB 에 있다) ⒟ 합집합 36 의 SAME/DIFF 분포는 이번에 세지 않았다.

---

## 9-NEXT. 🟢🟢 **`CORE-PRICE-SAME-01` STEP 1 — 측정 완료**(🔴 CPO 판정 대기 · 운영 코드 0)

> 🔴 **CTO 가 할 코드 작업이 없다.** 처방은 **CPO 가 A/B/C/D 중 하나를 고른다.**

### 🟢 lineage 7칸 (라이브 실측 · `CORE_STEP5_PROBE=1 core-step5-domestic-lineage`)

```
host              human  verdict        truth              display        tier        market   가격        SAME축 참고가격
biskuit.kr        SAME   PRESUMED_SAME  TEXT_CONFIRMED     PRESUMED_SAME  COMPARISON  KR       KRW 88,000  ✗     **O**
m.luxboy.com      DIFF   PRESUMED_SAME  TEXT_CONFIRMED     PRESUMED_SAME  COMPARISON  UNKNOWN  KRW 59,000  ✗     ✗
www.donokids.com  없음   PRESUMED_SAME  TEXT_CONFIRMED     PRESUMED_SAME  COMPARISON  UNKNOWN  KRW 88,000  ✗     ✗
www.beaumonde.co.kr SAME SAME           STRONG_IDENTIFIER  SAME           EXACT       KR       KRW 83,600  **O** **O**
🔴 **beaumonde 는 B226AC010 이다**(AC009 가 아니다 · 지시서 전제 정정) · AC009 는 3곳이다
```

### 🔴🔴 사슬 좌표 — **`priceTier` 는 SAME verdict 를 «읽지 않는다»**

```
verdict ──→ truth ──────────────────→ priceTier ──→ eligibility ──→ domesticReference
(cross-seller) (deriveMatchTruth)     (priceTierFromLink)  (market-intelligence)

match-truth.ts:**233**  crossSellerReserved = (verdict === "PRESUMED_SAME")
match-truth.ts:**237**  !observedDifference && !crossSellerReserved && !colorUnverified 일 때만
                        품번 경로(exact → EXACT_IDENTIFIER/STRONG_IDENTIFIER)
match-truth.ts:**283**  SAME → STRONG_IDENTIFIER · **PRESUMED_SAME → TEXT_CONFIRMED** · UNKNOWN → INSUFFICIENT
domestic-product-link.ts:**86**  priceTier = f(matchTruth, verified) — 🔴 verdict 를 **안 본다**
                        EXACT_IDENTIFIER|STRONG → EXACT · **TEXT_CONFIRMED → COMPARISON** ·
                        SIMILAR → REFERENCE · CONFLICT|INSUFFICIENT → EXCLUDED ·
                        matchTruth 없음 → `verified ? EXACT : COMPARISON`
market-intelligence.ts:**232·318**  market==="KR" && priceKrw != null && tier ∈ {EXACT, COMPARISON}
                        🔴 **SAME 을 직접 검사하지 않는다**
run-domestic-price-check.ts:**230**  priceTierWithVerifiedSame — 사람 확정 SAME 이면 **EXACT 로 덮는다**(2번째 경로)
```

🟢 **그래서 biskuit 의 COMPARISON 이 증명된다** — 품번이 **exact 인데도** `PRESUMED_SAME` 이
`crossSellerReserved` 로 품번 경로를 막아 `TEXT_CONFIRMED` 로 내려가고, 그것이 `COMPARISON` 이 된다.
(blockers `BRAND_MISMATCH`·`NO_TITLE_OVERLAP` 이 verdict 를 SAME 으로 못 가게 한 것이 머리다.)

### 🔴🔴🔴 CPO Q8 의 답 — **아니오**

```
biskuit.kr  →  🇰🇷 국내 참고가격 **O**  ·  SAME 축 **✗**
⟹ 셀러가 보는 AC009 의 KRW 88,000 은 **SAME 으로 확정된 상품의 가격이 아니다**(PRESUMED_SAME).
   🟡 사람(GT)은 SAME 이라 했지만 **시스템은 그렇게 말하지 않았다** — 설명 근거가 lineage 에 없다.
🟢 AC010 beaumonde 는 반대다 — verdict SAME · truth STRONG_IDENTIFIER · tier EXACT ⟹ **설명 가능**.
```

### 🔴🔴 그리고 더 중요한 것 — **DIFFERENT 를 막은 것은 SAME 축이 아니다**

```
m.luxboy.com  human **DIFFERENT** · tier **COMPARISON**(자격 있음) · KRW 59,000
  🔴 제외된 이유는 **market = UNKNOWN**(`.com` + KRW → KR 증거 없음 · classifyCandidateMarket)
  ⟹ 🔴🔴 **그 후보가 `.kr` 도메인이었다면 human DIFFERENT 상품의 가격이 국내 참고가격에
     들어간다.** 지금 그것을 막고 있는 것은 **동일성 축이 아니라 TLD** 다.
donokids 도 같다(market UNKNOWN · 그래서 빠졌다 · tier 는 COMPARISON 이었다)
```

### 🔴 반사실 — **SAME-only 는 AC009 에서 순손실**(재확인)

```
AC009  현행 {count 1 · KRW 88,000 · COMPARISON}  →  SAME-only **{count 0}**   (1 → 0)
AC010  현행 {count 1 · KRW 83,600 · EXACT}       →  SAME-only {count 1}       (1 → 1 · 불변)
```

🔴 **측정불가로 남긴 것** — `luksusbaby.kr`(facts 없음) · `kream.co.kr`(⑧ `EVIDENCE_NOT_WORTHWHILE`) ·
`candidate_reviews` 의 AC009 75행 중 `market=KR` 기록은 **miniboutique.co.kr 1행**(KRW 88,000)이고
지목 4곳의 system 값은 그 테이블에 **없다**(biskuit·luxboy 는 `GT_IMPORT` 행 · donokids·beaumonde 는 0행)
⟹ 🔴 그 테이블은 **사람 검토 저장소** 이고 집계 입력이 아니다. 위 표는 **라이브 운영 경로** 산출이다.

---

### 🔴🔴🔴 STEP 2 측정 완료 — **안전한 증거 조합이 «없다»**(운영 코드 0 · CPO 판정 대기)

🔴 **분모를 섞지 않는다 — 둘이다**:
```
⒜ C3 GT(순수 · `core-step5-evidence-c3-gt`)  저장 33 · facts+원상품 33 · 라벨 **27**(SAME 17 · DIFF 10)
   🔴🔴 **그 27쌍에 biskuit 도 luxboy 도 «없다»**(실측 0건) ⟹ 성공기준 ③(전체 GT precision)은
      이 분모에서 재고, **대상 쌍의 분리력은 ⒝ 에서만** 잴 수 있다
⒝ AC009 라이브(`core-step5-domestic-lineage`)  biskuit · luxboy · donokids (라벨 존재)
```

🟢 **⒜ 분모의 현재 숫자**(기준선 · 재측정 금지):
```
baseline  SAME 판정 7 = 정답 5 · **false SAME 2** · precision 71.4% · recall 29.4%
C3        SAME 판정 9 = 정답 7 · **false SAME 2** · precision 77.8% · recall 41.2%
          🟢 뒤집힌 2건은 **둘 다 `bobochoses.co.jp`**(C11·C37 · human SAME) · 누출 0
```

### 🔴 증거 분리력 표 — **모든 축이 0 이거나 «역방향» 이다**

```
증거            biskuit(human SAME)          luxboy(human DIFFERENT)      분리력
model code      exact                        **exact**                    ❌ 0 (동일)
brand           "비스킷" → **BRAND_MISMATCH** "BOBO CHOSES" → 통과         🔴 **역방향**
title overlap   NO_TITLE_OVERLAP             NO_TITLE_OVERLAP             ❌ 0 (동일)
color / fit / material / category   null / null                           ⚪ 측정불가(양쪽 없음)
description*    258자 → **COLOR_VARIANT 추가** 52자 → 변화 0               🔴 **역방향**
image*          null(공급 owner 없음)         null                         ⚪ 측정불가
confidence      **0.02**                     0.37                         🔴 **역방향**
blocker 수      **2**                        1                            🔴 **역방향**
```

🔴🔴 **즉 정답(biskuit)이 오답(luxboy)보다 «모든 축에서 더 나쁜 신호» 를 들고 있다.**
샵이 `brand` 칸에 자기 이름(「비스킷」)을 적어 BRAND_MISMATCH 를 얻었고(WU-080 그 모양),
luxboy 는 brand 를 정확히 적어 그 축을 통과한다 ⟹ **브랜드 축 완화는 오답을 더 많이 연다.**

### 🔴 반사실 — 둘 다 **이미 측정돼 있다**(재측정 안 했다)

```
C3(품번 exact → 브랜드 확인)   biskuit blockers 2 → 1 · 🔴 **verdict 불변**(NO_TITLE_OVERLAP 남음)
                               ⟹ SAME gain **0** · leakage **0**  (STEP 1 실측)
NO_TITLE_OVERLAP 비차단        🔴 **m.luxboy.com 이 누출된다** — DIFFERENT 방어 4/4 → **3/4** ·
                               KRW 59,000 유입 · 국내 최종 0 → 0 ⟹ **순손실**(WU-138 실측)
```

### 🔴 유일하게 남은 신호 — 그리고 그것은 **닫힌 축** 이다

```
origin  titleTokens [hug, hairy, monster, shirt]
biskuit [보보쇼즈, **허그, 헤어리, 몬스터**, 티셔츠, b226ac009]   ← 디자인명 음역 **3개**
luxboy  [보보쇼즈, 키즈, 긴팔티셔츠, b226ac009, since, 2002, …]   ← 음역 **0개**(일반명사뿐)
⟹ 🟡 분리력이 «있어 보이는» 유일한 축 = **음역(transliteration)**
🔴🔴 그러나 CPO 가 **WU-078 에서 종료** 했다 — 「음역/언어 축을 생산 로직에 넣지 않는다 ·
   회수 효과 **0** · 분모 4 · 문턱 근거 부족 · **DIFFERENT 를 열 수 있는 위험 축**」
🔴 그리고 **현재 production 이 공급하는 evidence 가 아니다**(새 매칭 축이 필요하다) ⟹ Q7 **불충족**
```

### 🔴 CPO 질문 답

```
Q1 biskuit SAME 최소 증거 조합   🔴 **없다**(현재 공급 evidence 안에서)
Q2 luxboy DIFFERENT 유지         ⚪ Q1 불성립이라 측정 대상이 없다
Q3/Q4 전체 GT precision/recall   🟢 baseline 71.4%/29.4% · C3 77.8%/41.2% (분모 27 · 🔴 대상 쌍 밖)
Q5 false SAME                    🟢 baseline **2** · C3 **2**(증가 0)
Q6 C3 보다 개선                  🔴 **아니다** — AC009 에서 C3 의 이득이 **0** 이다
Q7 production 공급 가능           🔴 **아니다**(음역 축은 신규 규칙 · 그리고 닫힌 축)
```

🔴 **성공 기준 ①②③ 중 ① 이 불성립** ⟹ **구현 후보 없음.** STOP 하고 CPO 판단을 기다린다.
🔴 **처방을 적지 않았다** — SAME/8축/threshold/COLOR/FIT/description/image/가격 게이트 **전부 변경 0**.

---

### 🔴🔴🔴 STEP 2-R. **기존 CEO evidence 재검토 — CASE B 는 «실재» 하고, 축마다 다르다**

> 🔴 **새 측정 0 · 운영 코드 0.** 기존 기록(CORE-2AB/2AC · STEP 5-E2/E2R/E2R-LIVE)만 정리했다.
> 🔴🔴 **STEP 2 의 「현재 공급 증거로 분리 불가」를 축별로 쪼개야 한다**(아래 ⓕ).

🟢 **CASE B 는 «코드 사실» 이다 — 추측이 아니다**:
```
PLAIN_HTML 후보 facts owner = productFactsFromListing({title, url, brand})
   product-url-facts.ts:**420** · seller-facts.ts:**262**
🔴 **일곱 칸을 하드코딩 null/[]** — brandModelCode · categoryText · materialText ·
   fitText · ageRangeText · sizeLabels · audienceSignals
🔴 그리고 **본문(description)을 인자로 받지 않는다** — HTML 은 fetch 됐는데 버려진다
🟢 SHOPIFY_JSON 경로는 productFactsFromShopifyProduct(body) 가 color/material 을 **채운다**
⟹ 🔴 같은 MI 가 **경로마다 다른 수의 축** 을 본다 · 🔴 **국내 후보는 전부 PLAIN_HTML**
```

🟢🟢 **공급선은 «이미 있고 의도적으로 꺼져 있다»**:
```
🟢 수집   product-url-facts.ts:**440** extractFromJsonLd(html).description (추가 HTTP 0)
🟢 소비자 seller-facts.ts 가 description 을 받으면 **다섯 칸** 을 채운다 —
          :199 colorText · :200 materialText · :215 fitText · category/audienceSignals ·
          :208 **brandModelCode ← extractLabeledProductCode(description)** 🔴 품번도 상세에서 나온다
🔴 끊은 자리 product-url-facts.ts:**441** 이 **category 하나만** 넘긴다
🔴 끊은 이유 :**446** 에 측정으로 적혀 있다 — materialText 가 **새 축 0 · 거짓 MATERIAL
          blocker 1**(organic cotton ↔ cotton) ⟹ CORE-2AC 가 **의도적으로** 끊었다
```

### 🔴 축별 CASE 판정 (CPO §5 표 · 추정으로 채우지 않았다)

```
증거        CEO확인 상세정보 extraction matcher소비  판정
상품코드     ✓     🟢있다   🟡title경유 🟢exact      공급됨(biskuit·luxboy 둘 다 exact)
브랜드       ✓     🟢있다   🟢        🟢           공급됨(🔴 biskuit="비스킷"=샵이름)
상품명       ✓     🟢있다   🟢        🟢           공급됨
상세설명     ✓     🟢**있다**(biskuit 258자·luxboy 52·donokids 44) 🟢수집됨 🔴**미공급**  **CASE B**
색상/소재/핏  ?     🟡상세 안 🟢수집됨  🔴미공급      **CASE B**
이미지       ?     🟢페이지에 🔴**하드코딩 null** 🔴미공급  **CASE B** 🔴🔴 **효과 미측정**
기타 식별    ?     ?        ?         ?            미측정
```

### 🔴🔴 ⓕ **그래서 STEP 2 결론을 축별로 정정한다**

```
description 축  🔴 **CASE B 확정 · 그러나 연결 효과가 «두 번» 측정됐다**
  1차(STEP 5-E2)   🔴 **무효** — `ListingProductLike` 에 `description` 칸이 **없다**
                   (소비자는 `productFactsFromShopifyProduct` 하나) ⟹ 인자가 조용히 무시됐다
  2차(E2R/E2R-LIVE) 🔴 **발화했고 정답을 악화** — biskuit(human SAME)에 **+COLOR_VARIANT** ·
                   luxboy(human DIFFERENT) 변화 **0** ⟹ CASE C · CPO **연결 금지**
  🔴 그리고 분모 — GT 27쌍 중 의미 있는 쌍 **8**(나머지 19 는 Shopify 라 이미 소비) ·
     그 8쌍 baseline SAME 판정 **0** · 🔴 상세설명 **원문이 없는 쌍 4/8**
     ⟹ 「상세설명을 연결하면 국내가 살아난다」는 **절반에서 입력 자체가 없다**
  ⟹ 🟢 이 축에서는 STEP 2 결론이 **유지** 된다(분리 불가 · 측정 근거 있음)

image 축        🔴🔴 **CASE B 이고 «한 번도 측정되지 않았다»** ← 여기가 열려 있다
  🔴 후보 imageUrl = **하드코딩 null**(product-url-facts.ts:**472**) — 공급 owner **없다**
     (비용 문제가 아니라 **배선 부재** 다)
  🟢 비교 함수는 **이미 준비돼 있다** — compareCrossSellerProducts(a, b, **image?**) ·
     🔴 운영 호출부가 **3번째 인자를 넘기지 않는다**(match.ts:**661**)
  🔴 IMAGE 축은 `corePoints` 에서도 **제외** 돼 있다(:**1149**) ⟹ 공급만으로 점수가 되지 않는다
  🔴🔴 **원상품 이미지 공급 여부는 «측정불가» 다** — 내 하니스가 `items` 를 빈 배열로 넘겼다
     (운영은 `items` + `sourceRepresentativeId` 를 넘긴다 · api/pipeline/route.ts:**284**)
     ⟹ 🔴 「원상품 이미지 0」으로 **적지 않는다**
  ⟹ 🟡 **CEO 가 육안으로 쓴 가장 강한 증거가 이 축일 가능성이 있고, 그것이 matcher 에
        한 번도 전달된 적이 없다.** 🔴 단 효과는 **미측정** 이다 — 단정하지 않는다
```

🔴 **brand 축 주의(Track C)** — `siteBrandName`(og:site_name·Organization) **≠ 상품 브랜드**
(biskuit = 「비스킷」 = **샵 이름**). 🟢 상세설명 brand 는 **세 번째 축으로 별도** 여야 한다 —
`siteBrandName === productBrand` 가정은 코드에 없고 넣어서도 안 된다.

🔴 **그대로 유지되는 금지**(이미 측정됨) — 브랜드 완화 · `NO_TITLE_OVERLAP` 완화 ·
description 무조건 연결 · 음역축 재개방 · SAME-only / EXACT-only 국내가격.

---

### 🔵🔵🔵 **용어·단계 판정 정합표**(CTO 정리 2026-10-26 · 🔴 충돌 4건을 가렸다)

> 🔴 지시서와 기록 사이에 **같은 글자가 다른 뜻** 으로 쓰인 자리가 넷이다. 아래로 고정한다.

#### ① 단계 사다리 — **WU 는 `-01` 하나다**(`-03` 을 만들지 않는다)

```
CORE-PRICE-SAME-01
  STEP 1    국내가격 lineage                 🟢 **MEASURED / CLOSED**
  STEP 2    SAME 분리력(biskuit ↔ luxboy)    🟢 **MEASURED / CLOSED**
  STEP 2-R  기존 CEO evidence 공급 재검토      🟢 **MEASURED / CLOSED**
  STEP 3    IMAGE evidence 공급 효과          🟡 **NOT MEASURED**(CEO 답 A/C 일 때만 착수)
    3-1 하니스 공급 수리(items + sourceRepresentativeId) · 3-2 공급 lineage · 3-3 공급≠채점 분리
🔴 CPO 문서의 `CORE-PRICE-SAME-03` 은 **이 STEP 3 과 같은 것** 이다 — `-02` 가 없으므로
   번호를 새로 만들지 않고 **`-01 STEP 3`** 으로 쓴다(한 WU 안의 다음 단계다).
```

#### ② 판정 어휘 — **헌장 §6 어휘로만 적는다**

```
MEASURED   측정이 끝났다(숫자·좌표 있음)        CLOSED   재조사하지 않는다
HOLD       **측정은 했고** 판단을 미뤘다        REJECT   측정 결과로 **채택하지 않는다**
측정불가    **분모가 없어 숫자를 못 만들었다**   STOP     그 자리에서 멈추고 보고
🔴 「완료」·「확정」·「보류」를 섞어 쓰지 않는다 — 위 여섯 중 하나로 적는다
```

#### ③ 🔴🔴 **`CASE` 알파벳이 두 축에서 충돌한다 — 이름을 가른다**

```
기존(먼저 쓰였다 · 커밋 다수)  CASE A/B/C = **description 연결 «효과» 축**
                              (STEP 5-E2R · WU-156 「Case C / NO-GO」)
🔴 STEP 2-R 이 같은 글자를 **evidence 공급 축** 에 썼다 ⟹ 충돌
🟢 그래서 공급 축을 **`SUPPLY-A` / `SUPPLY-B`** 로 바꾼다:
   SUPPLY-A  상세정보에도 없다            = 진짜 evidence 부재
   SUPPLY-B  상세정보엔 있는데 미공급      = 배선 문제
🔴 앞으로 「CASE B」는 **description 효과 축만** 가리킨다
```

#### ④ 🔴 `description` — **「보류」가 아니다. 둘로 갈린다**

```
무조건 연결        🔴 **REJECT** — 효과 측정 2회(1차 무효 · 2차 **정답 악화** CASE C)
조건부 재검토      🟡 **HOLD** — 새 증거(GT 기반 정밀도 재측정)가 생길 때만
🔴 CPO 표의 「description → 보류」는 위 둘을 합친 말이다 ⟹ 분리해서 적는다
```

#### ⑤ 🔴 `image` — **「보류」가 아니라 «측정불가» 다**

```
공급 단절      🟢 **코드 사실**(SUPPLY-B) — imageUrl 하드코딩 null(:472) · 3번째 인자 미전달(match.ts:661)
효과           🔴 **측정불가** — 분모를 만든 적이 없다(HOLD 로 적으면 「재 봤다」로 읽힌다)
🔴 그리고 `corePoints` 에서 IMAGE 가 **제외**(:1149) ⟹ **공급 ≠ 채점**(CPO §3-3 과 같다)
```

#### ⑥ 🔴🔴 **UX 어휘 충돌 — CPO §7 의 「시장 참고가격」은 금지 리터럴이다**

```
🔴 `wu-145-seller-decision-screen.test.ts:60` 의 **금지 목록에 「시장 참고가격」이 있다**
🔴 이유가 코드에 적혀 있다(mi-same-candidates.ts:407-412) — 「참고가격」을
   `MI_SAME_AREA_SCOPE`/`wu-056r1` 이 **유사상품 포함 참고 축** 의 뜻으로 **이미 쓴다**
   ⟹ 1차 결론에 쓰면 **같은 말이 두 뜻** 이 된다
🟢 **새 어휘를 만들지 않는다 — owner 가 이미 셋 있다**:
   DOMESTIC_REFERENCE_TITLE   「국내 참고가격」        overseas-reference.ts:114 (wu-056r1 잠금)
   SAME_CONFIRMED_COUNT_LABEL 「동일상품 확인」        mi-same-candidates.ts:372
   SAME_PRICE_LABEL           「동일상품 확인 가격」    mi-same-candidates.ts:420
🟢🟢 그리고 CPO 가 §7 에서 **말하려던 문장이 이미 상수다** — `MI_SAME_AREA_SCOPE`(:205):
   「이 목록은 동일상품으로 «확정» 된 후보만 담습니다 — 그래서 위의 「참고가격」과 건수가
     다를 수 있습니다. 확정되지 않은 후보는 아래 검토 구역에 그대로 남아 있습니다.」
⟹ 🟢 CPO 가 지목한 모순(₩88,000 ↔ 동일상품 없음)은 **어휘 신설 0** 으로 해소된다 —
   기존 상수 **병치 + 그 문장의 위치** 문제다(새 말을 만드는 문제가 아니다)
```

#### ⑦ UX 트랙 이름 — **`CORE-UX-SELLER-02`**

```
🟢 UX01 은 CLOSED 다 ⟹ 다음 UX 는 **-02** 다(이름 없는 「UX 수정 WU」로 두지 않는다)
🔴 그 WU 는 SAME 알고리즘과 **분리** 된다(CPO §7 명시) · 🔴 금지 리터럴 ⑥ 을 먼저 읽는다
```

🔴 **CTO 는 ⏸ 대기** — CEO 의 **A/B/C/D 한 글자**가 STEP 3 착수 여부를 결정한다.
🔴 image 구현 · image scoring · corePoints 에 IMAGE 추가 · description 재연결 · threshold 변경 **전부 0**.

---

### 🔵 [원래 범위] STEP 1 지시 — 재조사 금지

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

### 🟡🟡 **CEO Action ① — 한 글자 답변**(이것이 STEP 3 착수 여부를 가른다)

> 🔴 **새 상품을 다시 테스트하지 않는다.** 과거 실제 상품 검증 때 biskuit / luxboy 같은
> 후보를 SAME / DIFFERENT 로 판단하면서 **실제로 무엇을 눈으로 보고 판단했는지** 만 묻는다.

```
A. 상품 사진/이미지
B. 상세페이지의 색상·소재·핏 등의 정보
C. 둘 다
D. 둘 다 아니고 상품명/품번/브랜드만
```

🔵 **답에 따라 CTO 가 할 일이 정해진다**(CPO 확정):
```
A 또는 C  →  **STEP 3 IMAGE evidence 측정** 착수(측정 전용 · 구현 0)
B         →  image STEP 3 **보류** · description 은 **REJECT 유지** · 다른 공급선 검토
D         →  image·description 둘 다 보류 · **새 evidence 공급 조사**를 별도 WU 로
```

### 🟡 CEO Action ② — **화면 1회**(UX01 + STEP 4 를 한 번에)

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
