# 🟡 WU-141-R2 — **셀러 의사결정 화면으로 재구성** (STEP 2 완료 · 1/3/5/6/7 남음)

> 🟢 **STEP 2 완료·배포**(`4e7de9bd`) — 탐색 과정이 `▸ 판단 근거 보기` 하나 뒤로 갔다.
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

## ⑥ 🔴🔴 **CPO 에게 올릴 질문 하나 — CTO 가 정하지 않았다**

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
