# 🟡 WU-141-R2 — **셀러 의사결정 화면으로 재구성** (STEP 2 완료 · 1/3/5/6/7 남음)

> 🟢 **STEP 2 완료·배포**(`4e7de9bd`) — 탐색 과정이 `▸ 판단 근거 보기` 하나 뒤로 갔다.
> 🔴🔴 **STEP 1 + C-3 는 승인됐지만 구현 0 이다** — 착수 직전에 **세 번째 중복**(요약
> 카드의 「비교 가격 · 해외 시장」)을 찾았고, 그래서 작업 지점이 **둘 → 셋** 이 됐다.
> 🔴 그 상태로 두 곳만 고치면 **「C-3 완료」가 거짓** 이 되므로 멈췄다(§⑥-A 첫 블록).
> 🟡 **CPO 가 한 줄만 정해 주면 즉시 실행한다** — 요약 두 줄을 ⒜ **지울지**
> ⒝ **① 산출로 바꿀지**(숫자는 남지만 계산 owner 는 하나가 된다).
> 🔴 **STEP 1 · 3 · 5 · 6 · 7 은 구현 0** 이다. 🟢 **좌표는 전부 확보했다** —
> 다음 세션은 **조사 없이 1번부터** 들어간다(헌장 §4-C).
> 🔴 CEO 추가 테스트 **없다**(CPO 명시) — 전부 끝낸 뒤 **딱 한 번** 보여준다.

🎯 **목표 한 문장**(CPO) — 「탐색 시스템을 보여주는 화면이 아니라, 탐색 결과를 이용해
셀러의 의사결정을 도와주는 화면」. 🔴 **후보 수는 KPI 가 아니다.**

---

## ⓞ 🟢 STEP 2 **완료** — 왜 WU-136 으로 부족했는지

```
⒜ 구역 여섯 중 **둘이 접혀 있지 않았다** — 🔎 웹 후보(인라인) · 📚 이전에 확인한 후보
⒝ 🔴🔴 그리고 **STEP 4(저장 수정)가 `recordSeenCandidates` 를 되살렸다** —
   그 전엔 42P10 으로 한 행도 안 들어갔다 ⟹ 이제 📚 가 **본 후보 전부로 채워진다**
   ⟹ 고치지 않으면 CEO 가 본 「조사 로그」가 **더 심해졌을** 것이다(그래서 급했다)
🟢 `TransientCandidateSections` 반환 전체를 `<details data-testid="judgement-basis">` 로 감쌌다
🔴 삭제 0 · `open` 금지 · 출처 축(각 구역 머리 문구) 보존 · MI/가격/서버 0
계약 8(마운트 DOM + 소스) · 음성대조 M1 2F · M1b 1F
```

---

## ① 🔴 STEP 1 — ③ `buildOverseasMarketEvidence` 제거 **(최우선 · 좌표 확보)**

🟡 **설계안(어댑터 하나)** — 🔴 구현 0:
```
신규(순수)  overseasEvidenceFromRows(rows) : MarketEvidenceSummary
            🟢 게이트는 ① 그대로 — tier SAME + 품절 아님 + VERIFIED_CURRENT
            🔴 새 판정·새 집계 규칙을 만들지 않는다(`buildPriceGuide` 가 이미 낸 값을 옮긴다)
            🔴 환산 0 · 다중통화 처리는 기존 `buildOverseasMarketEvidence` 규칙을 그대로
```

| 할 일 | 좌표 |
|---|---|
| ③ 생산자 제거 | `ComparisonShopSearch.tsx:388~412`(`evidence` useMemo + `onEvidenceChange` effect) · 호출 `:405` |
| 공급을 ① 로 교체 | `CommerceWorkspace.tsx` 의 `setOverseasMarketEvidence` 배선 → `marketComparison` 에서 파생 |
| 소비처(불변) | `Panel.tsx:3240` `overseasEvidence` → `:3585` `<OverseasMarketEvidenceView>` |
| 판정 문구 | `mi-verdict-copy.ts:62` `hasOverseasRange` → ① 기반이 **자동으로** 된다 |

🟢 그러면 13단계의 **5번(mi-verdict-copy strict 전환)이 따로 작업 없이 닫힌다.**
🔴 **서버 `marketCase`·`computeMarketAlert`·`price_alerts` 는 건드리지 않는다**(경계 · R1 ④-B).

## ② 🔴 STEP 3 — `ComparisonShopSearch` 자체 검색 **0**

```
좌표  ComparisonShopSearch.tsx:224  fetch("/api/comparison/search")
      (+ :232 fetch("/api/exchange-rates"))
🟢 /check 가 **이미 같은 해외 검색** 을 돈다(WU-130 `__overseas_auto__`) ⟹ 중복 제거이고
   헌장이 적어 둔 「해외 검색이 두 번 돈다」도 같이 사라진다
🔴 **난이도가 여기 있다** — 그 패널의 표가 `ComparisonCandidate` 모양을 그린다.
   `/check` 의 `GeminiTransientRow` 로 바꾸려면 표 렌더를 맞춰야 한다 ⟹ **STEP 1 과
   분리해서** 진행하라(1 을 먼저 닫으면 셀러 화면의 「두 답」은 이미 사라진다).
🔴 그 패널을 보는 계약 — `mi-010` · `wu-091` · `default-visible-tier` ·
   `domestic-shop-search-tier` · `price-display-layout` · `golf01-wire-overseas-category`
```

## ③ 🔴 STEP 7 — 아래 「📊 시장 가격 비교」 영역 + 앵커

```
좌표  StageBody.tsx:242  title="📊 시장 가격 비교"  (그 접힘 안에 앵커 div + 두 패널)
      CommerceWorkspace.tsx  PRICE_COMPARISON_ANCHOR_ID div · scrollIntoView(:837)
🟢 CPO 확정 — **anchor 주인은 📊 시장 판매 판단** · scroll 동작 유지
🔴 그 영역을 **별도 결론 영역으로 존속시키지 않는다** — 두 패널은 「원자료 드릴다운」으로
   판단 근거 쪽으로 간다. 🔴 서버 가격 데이터/계산/알림은 **삭제·변경 0**(UI owner 만 통합)
```

## ④ 🟡 STEP 5 — 판단 근거 안의 순서 (SAME → 보류 → SIMILAR → DIFFERENT)

🔴🔴 **주의 — 출처 축과 충돌할 수 있다.** 현재 구역은 **출처별**(🇰🇷/🌎/🔁/🔗/📚)이고
그 축은 **WU-130 이 계약으로 잠갔다**(「넷을 하나로 합치면 출처가 사라진다」).
🟢 **권고** — 구역을 판정별로 **재편하지 말고**, 각 구역 **안의 행 순서** 를 판정 우선으로
정렬한다. 🔴 `DIFFERENT`(그리고 `human_verdict === "DIFFERENT"`)는 **접되 삭제 0**.
🔴 **상위 N 절단 금지**(CPO STEP 9).

## ⑤ 🔴 STEP 6 — 중복 전수 점검 (아직 안 했다)

```
동일 후보 URL · 동일 가격 · 동일 판매처 · 동일 MI 문구 · 동일 판매상태 ·
동일 가격대 · 동일 후보 이미지 — 위/아래에서 **다르게** 말하는 것을 금지
🟡 이미 확정된 중복 둘 — ③(R1 ②의 표) · 아래 패널의 자체 검색 집합(STEP 3)
🔴 나머지는 **미점검** 이다. STEP 1·3 을 닫은 «뒤» 에 점검해야 분모가 안정된다
```

---

## ⑥-A 🟢🟢 **CPO 결정 접수 — C-1~C-7 로 고정됐다**(2026-10-21)

```
⒝ 채택 — **판정 카드는 1차 화면에 유지** 한다(판매 가능성 · 마진 · 상품 상태 · MI 종합).
🔴 단 **C-3** — 판정 카드가 「국내/해외 가격 · 시장 가격 · 판매처 수」를 **다시 표시하지
   않는다**. ⟹ 내 ⒝ 제안의 구멍을 CPO 가 막았다(그대로 두면 WU-141 의 핵심 문제가
   카드 «안» 에 남는다). 🟢 CPO 지적이 맞다.
최종 순서 — 📊 시장 판매 판단 → 💡 판매가격 참고 → **판정 카드** → ▸ 판단 근거
```

### 🔴🔴🔴 **C-3 의 대상은 «둘» 이 아니라 «셋» 이다** (2026-10-21 추가 발견)

```
🔴 내가 앞서 「두 뷰」라고 올린 것은 **불완전했다.** 1차 화면 맨 위의 요약 카드가
   **국내/해외 가격 숫자를 또 찍는다**:
      judgement-summary.ts:113   row("비교 가격", input.domestic?.figure …)
      judgement-summary.ts:115   row("해외 시장", input.overseas?.figure …)
      → <ProductJudgementSummary>  (Panel.tsx:3362 — **패널의 첫 번째 자식**)
      ← 입력은 Panel.tsx:3382 `domestic: domesticEvidence` · `overseas: overseasMarketEvidence`
⟹ 🔴🔴 **두 뷰만 제거하고 「C-3 완료」로 보고하면 거짓이다** — 맨 위 카드가 여전히
   「비교 가격 ₩88,000 · 해외 시장 £37」을 1차 화면에 찍는다(CPO 검증기준 A 위반).
🟢 그래서 C-3 의 실제 작업 지점은 **셋** 이다(아래 둘 + 이 요약 두 줄).
🔴 `judgement-summary` 는 **순수 함수 + 자기 계약** 이 있다(WU-030) ⟹ 줄을 지우면
   그 계약이 FAIL 한다. **의도된 변경이므로 앵커를 갱신·강화** 해야 한다.
🟡 대안(더 안전) — 그 두 줄을 **지우지 않고** ① 산출로 바꾸는 것. 그러면 숫자가
   **한 곳(①)에서만 계산** 되므로 C-2(「독립적으로 존재하지 않음」)는 지켜진다.
   🔴 단 CPO 검증기준 A 는 「MI 패널의 국내/해외 **가격 숫자**」가 1차 화면에 있으면
      FAIL 이라고 적었다 ⟹ **그 둘 중 어느 해석인지 CPO 가 한 줄로 정해야 한다.**
```

### 🔴 나머지 둘 — **숫자/판매처 수를 내는 두 뷰** (좌표 확정)
```
Panel.tsx:3598  <MarketComparisonView  … evidence={domesticEvidence} …/>   🇰🇷 국내 시장
Panel.tsx:3622  <OverseasMarketEvidenceView evidence={overseasEvidence} …/> 🌎 해외 시장
   ⟹ 이 둘이 `figure`(₩/£ 숫자) · 등급 칩 · `scopeLabel`(「판매처 N곳 · M개 국가」)를 낸다
🟢 그리고 **4줄 판정 설명**(`mi-verdict-copy.ts` · 되물음 안)은 **그대로 둔다** —
   숫자도 판매처 수도 없는 **정성 문장** 이고(「경쟁 가능한 수준입니다」) 「네 줄」이
   **계약으로 잠겨 있다**(그 파일 주석: 「길이가 네 줄이라는 것은 취향이 아니라 계약」).
🔴 단 그 4줄의 입력 둘(`hasComparable`·`hasOverseasRange`)은 **②③ 에서 온다** ⟹
   ③ 을 제거하면 `hasOverseasRange` 가 **항상 false** 가 되어 「🌎 해외 판매처 가격대는
   확인되지 않았습니다」가 **거짓** 이 된다(📊 는 GBP 37·USD 58 을 보여주는데).
   🟢 그래서 **STEP 1 과 C-3 는 반드시 같이** 들어가고, 그 두 입력은 ① 에서 만든다:
      `hasComparable    = buildPriceGuide(buildMarketJudgement(rows),"KR").pricedCount > 0`
      `hasOverseasRange = buildPriceGuide(…,"OVERSEAS").pricedCount > 0`
      🟢 패널이 그 `rows` 를 **이미 들고 있다**(`marketComparisonInput` 을 만들어 올려보낸다)
      🔴 `evidenceBasis` 는 ① 이 SAME 전용이므로 가격이 있으면 **EXACT** 다
         (`COMPARISON` 분기는 ① 에서 **도달 불가** 가 된다 — 그 사실을 계약에 적어라)
```

---

## ⑥-B 🔴🔴🔴 **실행 전에 CPO 가 알아야 할 «지시 충돌» 하나**

🔴 **C-3 는 2026-09-12 CEO 지시를 되돌린다.** 내가 임의로 실행하지 않고 올린다(§4-B D).

```
그 자리의 주석 원문(Panel.tsx:3577~3596 · 「MI-MARKET-EVIDENCE-1(CEO 지시)」):
  「셀러가 묻는 순서는 넷이다: 원본 €50 → 🇰🇷 한국에서 얼마에 팔리나 → 🌎 해외에서는
   → 💰 내가 얼마에 팔면 되나. 네 번의 단순화를 거치며 **가운데 두 칸이 ② 단계의 베타
   패널로 내려갔고, 그 결과 판정은 근거 없이 내려온 숫자로 읽혔다.** 여기서 되돌리되
   요약으로만 되돌린다 …」
⟹ 🔴 즉 **이 두 칸을 카드에서 빼는 것은 과거에 한 번 실패한 배치** 다.

🟢 **그런데 그 실패 조건이 지금은 사라졌다** — WU-140-R1 이 「📊 시장 판매 판단」을
   패널 **위**(격자 밖 최상단)로 올렸다. 근거가 ②로 «내려간» 것이 아니라 판정보다
   **먼저** 온다 ⟹ 「근거 없이 내려온 숫자」가 되지 않는다.
🟡 그래서 C-3 는 **그 지시와 모순이 아니라 그 지시의 목적을 다른 배치로 만족** 시킨다.
🔴 그러나 그것은 **CEO 가 직접 지시한 화면 배치** 이므로 CTO 가 조용히 뒤집지 않는다.
   ⟹ 🔴 **CPO 확인 한 줄만 주면 즉시 실행한다**(실행 자체는 위 좌표로 준비 완료).
```

---

## ⑥-C 🔴 [기록] 내가 처음 올렸던 질문 (CPO 가 ⒝+C-3 로 답했다)

```
CPO 의 목표 화면 mock 에는 **📊 시장 판매 판단 + 💡 판매가격 참고 + ▸ 판단 근거** 뿐이다.
그런데 현재 셀러 1차 화면에는 MI 패널의 **판정 카드**(`Panel.tsx:3424~3679`)가 있고
그 안에 🇰🇷 국내 시장 / 🌎 해외 시장 요약(`:3562~3585`)과 수익성이 들어 있다.
⟹ 🔴 그 블록들도 「국내/해외 가격」을 **두 번째로** 말한다.

🟡 질문 — STEP 3 의 「📊 시장 판매 판단을 **유일한** seller-facing owner」가
   ⒜ 판정 카드의 🇰🇷/🌎 요약까지 **판단 근거로 내리는 것** 인가, 아니면
   ⒝ 판정 카드(팔아도 되는가 · 마진)는 **그대로 1차 화면에 두는 것** 인가.
🔴 ⒜ 면 계약 다수(`mi-ux-final` · `mi-simplify` · `mi-polish` · `mi-text-hierarchy` ·
   `price-display-layout`)를 같이 갱신해야 하고 **화면이 크게 바뀐다** ⟹ CPO 판정 사안.
🟢 ⒝ 면 STEP 1 만으로 「두 답」이 사라진다(요약이 ① 에서 나오므로).
```

---

## ⑦ 🔴 이번에도 0 변경 (CPO STEP 9 전수)

```
MI threshold ❌ · SAME 기준 ❌ · NO_TITLE_OVERLAP ❌ · 상위 N 절단 ❌ · 가격 추정 ❌ ·
환율 변환 ❌ · 추천 판매가 ❌ · Registry ❌ · 신규 카테고리 ❌ · 등록 기능 ❌ ·
DB schema ❌ · **후보 데이터 삭제 ❌**
```

## ⑦-B 🟢 **계약 C-1~C-7 (CPO 확정) · 변이 M1~M8**

```
C-1 「시장 판매 판단」 정확히 1개            🟢 wu-132 C-3 가 이미 잠근다(강화만)
C-2 가격/판매 집계가 다른 seller-facing 영역에 독립적으로 **없다**   🔴 신규
C-3 판정 카드가 국내/해외 가격 · 시장 가격 · 판매처 수를 **다시 표시하지 않는다**  🔴 신규
C-4 후보 리스트 기본 collapsed              🟢 `wu-141-r2-judgement-basis` 에서 **완료**
C-5 `buildOverseasMarketEvidence` 자기검색/독립 집계 **실행 0**      🔴 신규
C-6 SAME 아닌 후보는 시장 판매 판단 가격에 **안 들어간다**            🟢 wu-132 A-2 유지
C-7 `marketCase`/`price_alerts` 서버 경로 **불변**                   🔴 신규(소스 앵커)

M1 후보 details 에 open        🟢 **완료**(2 FAIL 확인)
M2 📚 history 를 밖으로         🟢 **완료**(1 FAIL 확인)
M3 두 번째 시장 판매 판단 추가   🟡 wu-132 C-3 의 「정확히 1회」가 이미 잡는다(재확인 필요)
M4 판정 카드에 국내 가격 복구    🔴 미실행
M5 판정 카드에 해외 가격 복구    🔴 미실행
M6 ③ 자기검색 복구             🔴 미실행
M7 참고가격을 최종 SAME 가격으로 승격  🔴 미실행
M8 marketCase/price_alerts 경로 변경   🔴 미실행
```

## ⑧ 🟢 완료 게이트 (CPO STEP 10)

```
계약  결론 영역 1 · 가격비교 영역 1 · 후보 기본 collapsed(🟢 STEP 2 에서 완료) ·
      SAME source = /check · ③ 자체 검색 호출 **0** · 가격판정 서버 로직 불변
변이  M1 후보 재노출 🟢완료 · M2 두 번째 가격비교 영역 · M3 ③ 자기검색 복구 ·
      M4 참고가격으로 최종판정 변경 · M5 SAME 아닌 후보를 가격판단에 포함
E2E   B226AC009 · B226AC010 — 판단 → 국내 → 해외 → 가격 → 판매상태 → 링크 → 근거 펼침
그리고 regression · typecheck · build · deploy → **CEO 1회**
```

🟡 **CEO 1회 때 같이 전달할 것**(미리 적어 둔다 · 안 적으면 「퇴화」로 읽힌다):
> 🇰🇷 줄이 「국내 동일상품 가격을 확인하지 못했습니다」인 것은 **정상** 이다 —
> 국내 tier SAME 이 0 이기 때문이고(WU-138 확정) **완화해서 만들지 않는다**.
