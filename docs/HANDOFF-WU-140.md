# 🟢🟢 WU-140 — **셀러 의사결정 화면 전환** (종료 · 배포 `fae68f6e`)

> 🟢 **실행 완료 2026-10-21.** 구현 → 계약 → 음성대조 → 회귀 → 2상품 라이브 E2E →
> typecheck → build → 배포까지 끝났다. 🟡 남은 것은 **CEO 화면 확인 1회**(`docs/START-HERE.md §1-B`).
> 🔴 아래 ①~⑧ 은 **착수 전 설계 기록** 이고, 실제로 무엇이 바뀌었는지는 **§⑨ 실행 완료 기록** 에 있다.
> 🔴 그리고 ④⒝ 의 순서 초안은 **폐기** 다 — ⑦.2 의 CPO 순서가 구현됐다.

---

# [설계 기록] WU-140 — **셀러 의사결정 화면 전환** (STEP 1 확정 · STEP 2~ 구현 대기)

> 🔴 CPO 판정(2026-10-21): **현재 화면 NO-GO.** 「기술이 없어서가 아니라 **셀러가
> 원하는 답을 한눈에 얻을 수 없는 UX**」. 지시 전문은 그 메시지(STEP 1~14).
>
> 🔴🔴 **이 문서는 「중간 보고」가 아니라 §4-C 의 «안전 종료 + 준비 없는 handoff»** 다.
> 🟢 **작업트리 clean · 배포 완료 상태에서 끊었다**(WU-139 `3dc458b` 가 Production).
> 🔴 다음 세션은 **조사/설계를 다시 하지 않는다** — 아래 ①②가 그것을 이미 확정했다.

---

## ① 🟢🟢 STEP 1 **완료** — 화면 root cause (실제 JSX · 추측 아님)

```
apps/admin/src/app/pipeline/CommerceWorkspace.tsx
  3656  <DomesticPriceIntelligencePanel …>    🔴 후보 구역 넷 + 📚 검토 이력이 «여기»
  3826      <MarketPriceComparison …>         🟢 결론 영역이 «그 안쪽, 더 아래»
  3831      <DomesticShopSearch …>            (원자료 드릴다운)
  3847      <ComparisonShopSearch …>          (원자료 드릴다운)
```

🔴🔴 **결론 영역이 후보 패널보다 «뒤» 에 있다.** WU-136 이 후보 구역을 **접었지만
순서는 바꾸지 않았다** ⟹ 셀러는 접힌 후보 블록들을 지나서야 결론에 닿는다.
🟢 그것이 CPO 의 「정보가 없는 것이 아니라 **우선순위가 거꾸로**」의 코드 위치다.

🟢 **그리고 `MarketPriceComparison` 은 이미 `DomesticShopSearch`/`ComparisonShopSearch`
보다 앞에 있다**(3826 < 3831) — 바꿔야 하는 것은 **패널(3656)과의 순서 하나** 다.

### 🟢 데이터는 이미 위로 올라와 있다 (배선 추가 불필요)
```
DomesticPriceIntelligencePanel → onMarketComparisonChange(marketComparisonInput)
  → CommerceWorkspace 의 `const [marketComparison, setMarketComparison] = useState(...)`
⟹ 🟢 `MarketPriceComparison` 은 **그 state 만** 읽는다 ⟹ 패널 «앞» 으로 옮겨도 동작한다
🔴 단 패널이 그 값을 **effect 로** 올리므로 첫 프레임은 `null` 이다 —
   그때 영역이 `checkRan === false` 로 **렌더되지 않는다**(기존 계약 B-1 그대로)
```

---

## ② 🟢🟢 STEP 6·7 **이미 완료** — 다시 조사하지 않는다 (WU-138)

CPO STEP 6/7 이 요구한 URL 단위 표와 blocker 분류는 **이미 산출돼 있다**:

```
🟢 하니스 2개가 커밋돼 있다(게이트 `WU_138_PROBE=1`)
   wu-138-same-funnel.test.ts        GT 17 전수 URL 단위 funnel
   wu-138-domestic-funnel.test.ts    국내 GT 5건(AC009+AC010) 두 축 분리
🟢 전문 docs/HANDOFF-WU-138.md · docs/HANDOFF-WU-138-DOMESTIC-GT.md
```

### 확정된 국내 blocker 분포 (재측정 금지)
| URL | human | tier | blocker | 가격 | 축 |
|---|---|---|---|---|---|
| `biskuit.kr` | SAME | PRESUMED_SAME | **BRAND_MISMATCH · NO_TITLE_OVERLAP** | ₩88,000 **있다** | A MI |
| `beaumonde.co.kr` | SAME | PRESUMED_SAME | **BRAND_UNCONFIRMED** | **없다** | A MI + B 가격 |
| luxboy / luksusbaby / kream | DIFFERENT | — | — | — | ② URL 게이트 |

🔴🔴 **STEP 7 의 답(「안전한 증거 조합이 존재하는가」) = 측정됐고 «없다»**:
```
biskuit 와 luxboy 는 **같은 축**(NO_TITLE_OVERLAP · 한국어 제목)으로 막힌다.
색상·품번·상품군 충돌이 **둘 다 0** 이다 ⟹ 가를 수 있는 것은 **시장**(.kr ↔ .com)뿐이고
그것은 **동일성 축이 아니다**(새 축 = CPO 금지).
🔴 반사실 실측(품번 exact 조건 비차단): 국내 최종 0 → **0** · DIFFERENT 방어 4/4 → **3/4**
   · 가격 축에 **KRW 59,000**(human DIFFERENT) 유입 ⟹ **순손실** ⟹ REJECT 유지
```
⟹ 🔴 **STEP 8 의 「안전한 해결책」은 현재 표본에 존재하지 않는다.** 구현하지 않는다.
🟡 열리는 조건은 **국내 human GT 추가**(현재 SAME 분모 2)이고 **CEO 육안 작업** 이다.

---

## ③ 🟢 STEP 4·5·9 **이미 구현돼 있다** (WU-136 · WU-139)

```
STEP 4 가격 표현   🟢 `buildPriceGuide` / `priceGuideHeadline` — basis **SINGLE ↔ RANGE**
                   🔴 1건을 「평균/시세/가격대」로 **적지 않는다**(계약 B-1·B-2 + 음성대조 M1)
                   🟢 가격 0 → **🔗 가격 확인 링크**(계약 C-1 · 음성대조 M5)
STEP 5 절대 조건   🟢 `buildMarketJudgement` — tier **SAME 만** · `SOLD_OUT` 제외
                   🔴 PRESUMED_SAME/SIMILAR/DIFFERENT **0건**(계약 C-2 · 음성대조 M6)
STEP 9 human 분리  🟢 WU-081/131 계약 — `gt-verdict`(시스템) ↔ `gt-review-result`(사람)
                   가 **다른 state·타입·DOM** 이고 서로 덮지 않는다
STEP 10 후보 접기  🟢 WU-136 — 후보 구역 넷 + `▸ MI 상세 분석` 전부 **기본 접힘**
```

🔴 **그래서 남은 것은 STEP 2·3 하나다 — 「순서」와 「시장별 독립 블록」.**

---

## ④ 🟡 다음 세션이 **바로 구현할 것** (설계 확정 · 조사 불필요)

### ⒜-0 🔴🔴 **이동의 «실제 구조» — 다음 세션이 먼저 볼 것** (2026-10-21 확인)
```
🔴 두 컴포넌트는 **형제가 아니다.**
   3655  {snapshotId ? (
   3656     <DomesticPriceIntelligencePanel …>        ← 조건부 블록 A
   …(약 170줄)…
   3818     {/* 주석 — 「**맨 위** 에 둔다」가 이미 적혀 있다(그런데 패널보다 뒤다) */}
   3826     <MarketPriceComparison …/>                ← 접힘/앵커 블록 안쪽
   3831     <DomesticShopSearch …/>
   3847     <ComparisonShopSearch …/>
🔴 그래서 「한 줄 이동」이 아니다 — **3826 의 JSX 를 잘라 3655 조건부 블록 «앞»
   으로 옮겨야** 하고, 그 사이 구조(접힘 · 앵커 div · 조건)를 먼저 읽어야 한다.
🟢 props 는 그대로다(`marketComparison?.rows` 등 · state 가 이미 CommerceWorkspace 에 있다).
🔴 `PRICE_COMPARISON_ANCHOR_ID` div 와 `scrollIntoView`(:837)는 **그 자리에 남긴다.**
🔴 3818 의 주석(「맨 위에 둔다」)도 **같이 옮긴다** — 안 옮기면 주석이 거짓말을 한다.
```

### ⒜ 결론을 맨 위로 — **파일 1곳 · 이동 1건**
```
CommerceWorkspace.tsx
  🔴 <MarketPriceComparison … /> (3826) 를 <DomesticPriceIntelligencePanel …> (3656)
     **앞** 으로 옮긴다. props 는 그대로(`marketComparison` state 를 읽는다).
  🔴 `PRICE_COMPARISON_ANCHOR_ID` div 는 **그 자리에 남긴다** — 그 앵커는
     「MI 되물음 안의 근거 영역」을 가리키고 `scrollIntoView` 소비자가 있다(:837).
  🟢 깨질 수 있는 계약 — `mi-022`(패널 배선) · `wu-056r1`(구역 식별) ·
     `wu-130 F-3`(영역 하나) · `wu-132 B-1/B-2`. 🔴 **전부 영역 «안쪽» 을 보므로**
     이동만으로는 안 깨질 것으로 보이나 **확인 전에 단정하지 않는다**.
```

### ⒝ 시장별 독립 블록 — **selector 는 이미 있다**
```
🟢 `buildPriceGuide(judgement, "KR" | "OVERSEAS")` 가 시장별로
   sameCount · onSaleCount · pricedCount · unpricedCount · byCurrency · basis 를 낸다.
🔴 지금 화면은 그 블록을 **표 아래** 에 둔다 ⟹ CPO STEP 2 는 **맨 위** 를 요구한다.
🟢 그래서 `MarketPriceComparison` 안에서 **순서만** 바꾼다:
   ① 🇰🇷 국내 블록 + 🌎 해외 블록 (시장별 카운트 + 기준가 + 🔗)
   ② 결론 한 줄(verdict)
   ③ 전역 카운트 · market-split · 판매처 표
   ④ ▸ MI 상세 분석(기존 그대로)
🔴 `price-guide-*` testid 를 **유지** 한다(WU-139 계약 13건이 그것을 본다).
🔴 시장에 동일상품이 0 이면 그 블록을 **만들지 않는다**(계약 C-4 · 빈 틀 금지).
```

### ⒞ 🔴 CPO STEP 4 에 **한 칸이 비어 있다** — 국내가 0일 때의 «이유»
```
CPO STEP 6-4: 「『국내 없음』이 검색 실패인지 · 판정 실패인지 · 가격만 못 가져온
것인지 셀러가 구분하기 어렵다」
🟢 데이터는 이미 있다 — `countPendingCandidates` / `pendingNote`(WU-133)가
   「가격까지 확인됐지만 판정이 보류·충돌된 후보 N건 · 사유 …」를 낸다.
🔴 그런데 그것이 **시장별이 아니다**(전역이다). ⟹ 🇰🇷 블록 안에서 그 이유를
   말하려면 `countPendingCandidates(rows, market)` 로 **시장 인자를 더해야** 한다.
🟢 그 변경은 **집계 0 · 판정 0** 이고 기존 함수에 필터 한 줄이다.
```

---

## ⑤ 🔴 STEP 12 E2E — **하니스가 이미 있다**
```
WU_138_PROBE=1 → wu-138-same-funnel(S1 B226AC009) · wu-138-domestic-funnel(S1+S2)
🟢 S2 = **B226AC010** 이고 이미 들어 있다(CPO 가 요구한 「하드코딩 아님」 검증).
🔴 화면 축은 마운트 DOM 으로 본다 — `wu-136-…-render` · `wu-139-price-guide` 에
   블록 순서 단언을 **추가** 한다(「🇰🇷/🌎 블록이 판매처 표보다 앞에 있다」).
```

### 현재 실측값 (STEP 14 의 「전/후」 중 **전** 값 · 재측정 불필요)
```
🌎 해외  동일상품 5 · 판매중 3 · 가격확인 4 · 가격확인필요 1
         💰 GBP 37(2곳 · 전부 판매중) · USD 58(2곳 · 그중 판매중 1) · 둘 다 **SINGLE**
🇰🇷 국내  tier SAME **0** ⟹ 블록 자체가 서지 않는다
DIFFERENT 방어 4/4 · false SAME 0
회귀 8,586 · tsc 0 · build 0 · 배포 `3dc458b`
```

---

## ⑥ 🔴 이번에 **하지 않을 것** (CPO STEP 8 금지 전수)
```
❌ threshold 하향 · confidence 상향 · PRESUMED_SAME → SAME 강제
❌ human SAME → system SAME · 유사상품 가격비교 포함
❌ 국내 후보 부족을 이유로 느슨한 매칭 · NO_TITLE_OVERLAP 재개방
❌ 새 외부 AI / Gemini / Registry 확대 · 후보 URL 임의 삽입
❌ 등록 기능 변경(**실등록 STOP 유지**) · 543건 재추출
```

---

## ⑦ 🔴🔴 **CPO 정정 — 다음 세션은 이 순서로 구현한다** (2026-10-21 · 최종)

### 1. `MarketPriceComparison` 을 `DomesticPriceIntelligencePanel` **위로** 이동
```
🔴 현재 실제 JSX 순서가 root cause 다(①).
🟢 기존 props/state/data flow 는 **최대한 그대로** 유지한다.
🔴 `PRICE_COMPARISON_ANCHOR_ID` 는 **삭제하지 않는다**.
```

### 2. 🔴 결론 영역 **내부 순서** — CPO 가 고정한 순서는 아래다
```
📊 시장 판매 판단
├─ 🇰🇷 국내
├─ 🌎 해외
├─ 가격/판매 판단 결과
└─ ▸ 상세 근거
```
🔴🔴 **이것이 위 ④⒝ 에 내가 적은 순서와 다르다 — CPO 의 이 순서가 이긴다.**
내 초안은 `verdict → 시장 블록` 이었는데 CPO 는 **시장 블록이 «먼저»** 다
(셀러의 첫 질문이 「국내에 있나」이고 verdict 는 그 **요약** 이기 때문이다).
🟢 그래서 `market-verdict` · `market-sale-counts` · `market-split` · 판매처 표는
**「가격/판매 판단 결과」 구간으로 내려간다**(testid 는 **유지** — 계약이 본다).

### 3. 🔴🔴 시장별 **pending 네 상태** — 「단순 UI 수정이 아니다」(CPO)
셀러가 이 넷을 **구분할 수 있어야** 한다:
```
⒜ 검색 자체가 안 됨            (조회가 돌지 않았다 / 후보 0)
⒝ SAME 판정 대기·보류          (후보는 있는데 PRESUMED_SAME·CONFLICT)
⒞ SAME 이지만 가격 확인 필요    (판정은 됐고 가격이 없다 → 🔗 링크)
⒟ 가격 확인 완료               (기준가 표시)
```
🔴 CPO: 「`countPendingCandidates` 에 **market 인자** 를 추가하는 것은 단순 UI
수정이 아니라 **상태 의미를 정확히 만드는 핵심 수정**」.
🟢 현재 그 함수는 **전역** 이라 「🇰🇷 국내가 비었는데 이유를 말할 수 없다」 —
⒝ 와 ⒜ 가 화면에서 **같은 빈 칸** 으로 보인다. 그것이 CPO STEP 6-4 의 지적이다.
🔴 집계·판정은 **그대로** 다 — 필터 한 줄과 **문구 네 개** 다.

### 4. 🔴 기존 계약 **전수 유지** (CPO 열거 그대로)
```
SAME 만 최종 가격판단 · SOLD_OUT 제외 · threshold 완화 금지 ·
human review ≠ systemVerdict · 가격 미확인은 **후보 삭제가 아니라 링크** ·
SINGLE/RANGE 규칙 유지 · **평균/시세 오인 표현 금지** · 후보 상세는 **접힌 상태** 유지
```

### 5. 🔴 STEP 7 은 **다시 손대지 않는다**
```
`NO_TITLE_OVERLAP` 을 무리하게 풀지 않는다.
`biskuit SAME` 과 `luxboy DIFFERENT` 를 현재 증거축으로 **안전하게 분리하지
못한다** 는 결론을 **유지** 한다.
⟹ 🔴 이번 WU 의 목적은 **MI 정확도를 희생해 국내 SAME 을 만드는 것이 아니고**,
   **현재 정확한 결과를 셀러가 제대로 이해하고 쓸 수 있게 만드는 것** 이다.
```

### 🟢 완료 게이트 (한 번에 끝내고 **보고 1회**)
```
구현 → 계약 갱신 → 전체 회귀 → 2상품 E2E → typecheck → build →
production 배포 → 실제 화면 확인용 URL/시나리오 보고
```

### 🔴🔴 성공 기준 — **「위로 올라갔다」가 아니다**
> 페이지를 열었을 때 셀러가 **후보 목록을 읽지 않아도**
> 🇰🇷/🌎 의 **동일상품 수 · 판매중 수 · 확인 가격 · 가격 확인 필요 여부** 를
> **먼저** 이해할 수 있는가.

🔴 그래서 마운트 DOM 계약에 **순서 단언** 을 넣는다 — 「🇰🇷/🌎 블록이
`market-seller-table` 보다 **앞** 에 있다」(지금은 뒤에 있다).

---

## ⑧ 🟡 CEO Action
🔴 **지금 없다.** CPO 명시대로 CTO 가 **구현 → E2E → 배포까지 끝낸 뒤 실제 화면
최종 1회** 만 테스트한다.

---

# ⑨ 🟢🟢 실행 완료 기록 (2026-10-21 · 배포 `fae68f6e`)

## 9-1. 바뀐 파일 — 운영 **3** · 계약 **3**(신규 1 · 갱신 2)

```
운영  CommerceWorkspace.tsx        결론 영역을 후보 패널 «앞» 으로 이동 + HIDDEN 게이트
      MarketPriceComparison.tsx    내부 순서 재배치 + `MarketBlock` 신설
      mi-same-candidates.ts        countPendingCandidates(rows, **market**) ·
                                   countMarketCandidates · marketEmptyNote ·
                                   countUnresolvedMarketCandidates · marketUnresolvedNote ·
                                   MARKET_RESULT_HEADING
계약  wu-140-market-first.test.ts   **신규 21건**(순수 + 마운트 DOM «순서»)
      wu-132-…-price-comparison     C-3 갱신·강화 + **C-3b 신설**
      single-action-center          🔴 **주석을 벗기고** 센다(§5 · 공용 `stripComments`)
```

🔴 **MI 완화 0** — threshold · 8축 · SAME 기준 · confidence · `NO_TITLE_OVERLAP` 전부 불변.
🔴 집계·판정·알림 계산 **0** · 환산 **0** · 추천 판매가 **0** · Registry **0** · DB **0** ·
schema **0** · 실등록 **0** · Supabase 권한 **0**.

## 9-2. 🔴🔴 게이트 하나를 «반드시» 붙여야 했다 — 지시서에 없던 것

```
결론 영역을 탭 분기 **밖** 으로 올렸으므로 그대로 두면 **커머스 탭 본문 맨 위에
「📊 시장 판매 판단」이 선다.** 🔴 그것은 CEO 가 「MI 표시 = 제거」로 지운 모양이다
(stage-focus.ts: 「등록하러 온 화면에서 처음 읽는 문장이 『팔아도 되는가』였다 —
 등록을 막는 것이 판매 판단이라고 읽힐 수밖에 없다」).
🟢 그래서 `stageFocus.mi !== "HIDDEN"` 게이트를 붙였다(CHANNEL · COLLECTING 둘 다 커버).
🔴 규칙을 **복제하지 않았다** — owner 는 `resolveStageFocus` 하나이고 계약 C-3b 가
   그 owner 에서 두 축 중 하나를 빼면 FAIL 한다.
```

## 9-3. 🔴🔴🔴 라이브 E2E 가 **화면이 거짓말할 자리** 를 찾아냈다 (설계에 없던 수정)

```
실측(WU-138 하니스 · 실제 HTTP) — B226AC010 의 `www.beaumonde.co.kr` 은
**사람이 SAME 이라 한 `.kr` 후보** 인데 **가격이 없어서** 시장 축이 `UNKNOWN` 이다
(WU-077 의 ⒞ 「가격 자체가 없다」).
⟹ 🔴 `buildPriceGuide` 의 두 시장 **어디에도 들어가지 않는다**(WU-020 §4 — 그 계약은 **옳다**)
⟹ 🔴 그러면 🇰🇷 블록이 「후보를 찾지 못했습니다」라고 말한다 — **한국 도메인 후보가
   실재하는데** 말이다. 그대로 배포하면 **화면이 거짓말한다**.
🟢 그래서 한 문장을 더했다 — 「국내·해외 중 어디인지 확인하지 못한 후보 N곳은 위 두
   블록에 세지 않았습니다 — 아래 상세 근거와 후보 검토 구역에서 볼 수 있습니다.」
🔴 시장을 **지어내지 않았다**(UNKNOWN → KR 승격 **0**) · 새 영역 **0** · 집계 **0**.
```

## 9-4. 실측 (CPO STEP 14 의 「후」 값)

```
S1 B226AC009 (라이브 · 실제 HTTP)
   📊 verdict **ON_SALE** · 판매중 **3** · 확인불가 2 · 품절 0 · 🇰🇷 0 · 🌎 **3**
   💰 GBP 37(2곳 · 전부 판매중) · USD 58(2곳 · 그중 판매중 1) — 둘 다 **SINGLE**
   🟢 **WU-139 수치와 한 자리도 다르지 않다**(MI 완화 0 의 증거)
   DIFFERENT 방어 — human DIFFERENT 4건 중 최종 도달 **0**(누출 0)
S2 B226AC010 (라이브 · 국내 GT 전수)
   🇰🇷 국내 SAME 2건 → 최종 도달 **0** · DIFFERENT 3건 **누출 0**
   축 분해 — A MI 판정 2 · C Discovery 3 (WU-138 결론 그대로 재현)
회귀 **617 files / 8,616 passed · 0 failed** · tsc **0** · build exit **0**
```

🔴 **측정불가/한계 — 과장하지 않는다**
```
⒜ 🔴 **실제 따져 화면은 CTO 가 볼 수 없다**(로그인 뒤) ⟹ 위 화면 축은 **마운트 DOM** 이다.
   「Production UI PASS」로 적지 않는다 — CEO 확인 1회로만 닫힌다.
⒝ 🔴 S2 의 라이브 하니스는 **국내 GT URL 만** 넣는다(해외 자동풀 미포함) ⟹ S2 의
   «전체 화면» 수치는 측정하지 않았다. 구조 불변은 마운트 DOM 계약으로만 증명됐다.
⒞ 🔴 국내 tier SAME 은 **여전히 0** 이다. WU-140 은 그 0 을 **열지 않았다**(열면 완화다).
⒟ 🔴 `m.luxboy.com` 의 후보 생성이 실행 간 **O ↔ X 로 갈린다**(WU-138 이 기록한 불안정 ·
   원인 미규명). 이번 실행은 O 였고 **차단은 유지** 됐다.
```

## 9-5. 음성 대조 — **M1~M9 전부 FAIL → 복구 PASS**

```
M1 시장 블록을 판단 결과 «뒤» 로 되돌림              → 1 FAIL
M2 커머스 탭 보호 게이트 제거                        → 1 FAIL
M3a 결론 영역 **복제**(두 자리에 렌더)                → 1 FAIL
M3b 결론을 후보 패널 «뒤» 로 되돌림                   → 2 FAIL
M4 `countPendingCandidates` 가 market 인자 무시       → 3 FAIL
M5 ⒜ 와 ⒝ 를 «같은 빈 칸» 으로 되돌림                → 3 FAIL
M6 동일상품 0 인 시장에도 빈 기준가 틀을 세움          → 4 FAIL (기존 `wu-139 C-4` 포함)
M7 🌎 해외를 🇰🇷 국내보다 먼저 세움                    → 1 FAIL
M8 패널을 **실제로** 두 번 렌더(갱신한 가드 검증)      → 1 FAIL
M9 시장 미확정 후보 줄을 조용히 없앰                   → 1 FAIL
```

🔴 **두 번 틀렸고 둘 다 적는다**
```
⒜ 🔴 `python3` heredoc 으로 변이를 넣으려 했는데 **인터프리터가 없어 적용되지 않았다**.
   그 상태에서 테스트가 **37 passed** 로 나왔다 — 🔴 그대로 「가드가 약하다」로 읽었으면
   거짓이었다. 🟢 **적용 확인 마커**(`grep -c MUTATION`)를 두고 있었기 때문에 잡았다.
   ⟹ 이후 변이는 **Edit 로만** 넣었다(헌장 「정규식을 쉘/파이썬으로 편집하지 않는다」).
⒝ 🔴 `tsc … | grep -v` 의 종료코드를 **tsc 의 것으로 읽어** 「typecheck 실패」로 보고할
   뻔했다(grep 이 0줄이면 1 을 낸다). 🟢 파일로 받아 `error TS` 를 세어 **0** 을 확인했다.
```

## 9-6. 🔴 기존 계약 둘을 갱신했고 **약화시키지 않았다**

```
wu-132 C-3  「영역이 앵커 div **안쪽**」(좌표) ⟹ 의도적으로 깨졌다.
   🟢 지키려던 성질은 좌표가 아니라 ①영역은 하나 ②결론이 원자료보다 먼저 다.
   🔴 **강화** — JSX 가 **정확히 한 번**(이동↔복제를 숫자로 가른다) · **후보 패널보다
      먼저** · 앵커/두 드릴다운은 그 뒤에 유지 · **C-3b 게이트 단언 신설**.
single-action-center  「패널은 한 번만 렌더」가 **주석의 컴포넌트 이름까지 세고 있었다**
   ⟹ 배치가 옳은데 테스트만 FAIL 했다(헌장 §5 가 「여덟 번 걸린 함정」이라 적은 그것).
   🟢 이 폴더의 **공용 `stripComments`** 를 썼다 — 세는 대상이 「문서 포함 문자열」에서
      **「실제 코드」로 정확해진 것** 이고, M8 이 **실제 중복에서 여전히 FAIL** 함을 증명했다.
```

## 9-7. 🔴 CPO 지시 대조 (§2~§10)

```
§2  이동 + 앵커/scrollIntoView 보존 + 주석 동반 이동          🟢 완료
§3  내부 순서 🇰🇷→🌎→판단 결과→상세 근거                       🟢 완료(초안 순서 폐기)
§4  국내 SAME 만 · 0 이면 억지 블록 금지 / 해외 그대로 노출     🟢 완료
§5  countPendingCandidates 에 market                          🟢 완료(+ 보조 함수 둘)
§6  WU-139 가격 계약(SINGLE/RANGE · 🔗 · 버리지 않음)          🟢 불변(계약 통과)
§7  후보 영역은 삭제 아님 — 결론/근거 역할 분리                 🟢 완료(접힘 유지 · 삭제 0)
§8  절대 변경 금지 전수                                        🟢 위반 0
§9  Supabase ③ KEEP AS-IS                                     🟢 변경 0
§10 Supabase ④ — test table 생성 안 함 · 계약만 유지            🟢 변경 0
```
