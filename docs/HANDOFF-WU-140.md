# 🔴🔴 WU-140 — **셀러 의사결정 화면 전환** (STEP 1 확정 · STEP 2~ 구현 대기)

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

## ⑦ 🟡 CEO Action
🔴 **지금 없다.** CPO 명시대로 CTO 가 **구현 → E2E → 배포까지 끝낸 뒤 실제 화면
최종 1회** 만 테스트한다.
