# 🟡 WU-141-R3 — **가격 owner 단일화** (구현 완료 · 계약 계층만 남음)

> 🔴🔴 **이 브랜치에서 시작한다** — `git checkout wu-141-r3-price-owner` (`7c02054c`).
> 🔴 **재조사 금지 · 재구현 금지.** 구현은 끝났고 typecheck 0 이다.
> 🟢 main(`240169a5`)은 clean/green/배포 0 — 머지 조건(§5)을 다 채운 뒤에만 머지한다.
> 🔴 **CEO Action 지금 없다.** 전부 끝낸 뒤 딱 1회(§7).

🎯 **R3 의 성공 기준**(CPO 그대로) — 「**우리 MI 가 뭘 판단했는지 셀러가 한 곳에서
신뢰할 수 있게 만드는 것**」. 🔴 **국내 SAME 을 만들려고 하지 마라** — 그 병목은 국내 MI
정밀도이고 R3 의 목적이 아니다.

---

## ① 🟢 이미 구현된 것 (브랜치 `7c02054c` · 다시 하지 않는다)

```
① judgement-summary — 「비교 가격」·「해외 시장」 행 제거 + **독자 fallback 계산 제거**
   (`comparePrice = domestic?.figure ?? (priced ? priceText(priced.row) : null)` ·
    `firstPricedRow` 삭제 — 그 폴백이 C-2 위반의 실체였다)
② Panel 판정 카드 — `<MarketComparisonView>` · `<OverseasMarketEvidenceView>` 제거
③ Panel — `hasOverseasRange` owner 를 ③ → ①(`buildPriceGuide(…,"OVERSEAS")`)
④ ComparisonShopSearch — ③ aggregate 호출 + `onEvidenceChange` **prop 자체** 제거
⑤ CommerceWorkspace — 배선·setter 제거
🔴 서버 불변 — marketCase · computeMarketAlert · price_alerts · 가격판정 · threshold ·
   SAME 기준 · 8축 · Registry · sale status · price verification **전부 0**
```

---

## ② 🔴 남은 일 1 — 실패 계약 **30건 / 8파일** 을 «분류» 하고 갱신

🔴🔴 **기계적으로 문구만 고치지 않는다**(CPO §1). 각 실패를 넷으로 가른다:

| 분류 | 뜻 | 처리 |
|---|---|---|
| **A** | 삭제된 seller-facing 가격 owner 를 기대 | 계약 삭제 또는 **새 owner(①)로 재작성** |
| **B** | 기존 UI «위치» 만 기대 | **새 최종 위치를 단언** 하도록 강화 |
| **C** | 실제 보호해야 할 전략 규칙 | **유지** + 새 구조 기준으로 재작성 |
| **D** | 이제 **존재하면 안 되는** 구조를 기대 | 🔴 **negative contract 로 전환** |

```
wu-030-judgement-summary        mi-polish        mi-simplify        mi-ux-final
product-tab-first-screen        product-tab-mounted
wu-055-e2e-chain                wu-072-domestic-color-and-sku
```
🔴 각각 **왜 과거 계약이 현재 전략과 충돌하는지** 를 주석에 적고 바꾼다(앵커 갱신 선례 다수).
🟢 실패 목록 재확인: `cd apps/admin && npx vitest run` → 30 failed / 8 files.

---

## ③ 🔴 남은 일 2 — **새 계약**: 가격 owner 는 하나다

```
seller-facing price figure   count = **1** · owner = `MarketPriceComparison`(📊 시장 판매 판단)
🔴 아래 넷이 `figure` 를 **직접 출력하면 FAIL**:
   ProductJudgementSummary · MarketComparisonView ·
   OverseasMarketEvidenceView · ComparisonShopSearch
🟢 단 **서버 내부 계산값은 제외** — 「가격 데이터가 시스템에 존재하는 것」과
   「셀러 화면에 가격을 출력하는 것」을 **구분** 한다(CPO 문장).
```

🔴🔴 **`ProductJudgementSummary` 는 «강하게» 잠근다**(이번 발견의 핵심):
```
price figure 생성 **0** · price **fallback 0** · market range 생성 **0**
🔴 `domestic?.figure` · `priced.row` · `firstPricedRow` 가 **다시 살아나는 것** 까지 막는다
```

🔴 `ComparisonShopSearch` 는 **검색 UI 만** 담당한다:
```
❌ 해외 가격 aggregate · min/max · 판매처 수 · 국가 수 · 시장 가격대를 **독립 계산해 publish**
🟢 **검색 자체를 없애라는 뜻이 아니다** — 결과의 «판단 owner» 가 따로 생기지 않게 한다
```

🔴 후보 1차 노출 금지(R2 에서 완료 · R3 에서 되살아나면 FAIL):
```
`▸ 판단 근거 보기` 기본 **closed** · 그 안에서 후보 확인 가능
🟢 데이터 삭제 **0** — candidate rows · candidate_reviews · human_verdict ·
   history · URL · 이미지 **전부 유지**. **표시 위치만** 바꾼다
```

---

## ④ 🔴 남은 일 3 — 변이 **M-R3-01~09** (적용 marker 를 먼저 확인한다)

```
01 ProductJudgementSummary 가격 출력 복구        → FAIL
02 MarketComparisonView figure 복구             → FAIL
03 OverseasMarketEvidenceView figure 복구        → FAIL
04 ComparisonShopSearch aggregate 복구           → FAIL
05 candidate details `open=true`                 → FAIL  (🟢 R2 에서 2F 확인됨)
06 두 번째 seller-facing price owner 생성        → FAIL
07 human_verdict 가 systemVerdict 변경           → FAIL
08 가격 없는 SAME candidate 삭제                 → FAIL
09 SAME 아닌 candidate 가 price guide 진입        → FAIL
```
🔴🔴 **변이가 «적용됐는지» 를 먼저 확인하고 PASS 를 센다** — 이 세션에서 `python3` 가
없어 변이가 적용되지 않은 채 「37 passed」가 나온 적이 있다(적용 marker 가 잡았다).
🔴 변이는 **Edit 로만** 넣는다(perl/python 은 CRLF·이스케이프에서 조용히 실패한다).

---

## ⑤ 🔴 E2E 두 상품 — **R3 전후 숫자가 같아야 한다**

```
S1 B226AC009 (WU-139 baseline)
   해외 SAME · 판매중 **3** · **GBP 37** · **USD 58** · 가격 확인 필요 **1**
   🔴 이 숫자가 R3 전후 **동일** 해야 한다(표시 통합이지 판정 변경이 아니므로)
   추가 — seller-facing price figure **1개 영역** · candidate primary **0**
S2 B226AC010
   국내 human SAME 2 · **MI SAME 0** · DIFFERENT 3 — 기존 MI 결과 유지
   🔴 후보가 있는데 가격이 없을 때 **「후보 없음」으로 표현하지 않는다**
라이브 하니스: WU_138_PROBE=1 npx vitest run …/wu-138-same-funnel.test.ts
                WU_138_PROBE=1 npx vitest run …/wu-138-domestic-funnel.test.ts
```

🔴 **§9 검증 — `mi-verdict-copy`**: ③ aggregate 가 없어졌다고 해서 **실제 가격이 있는데
「가격 없음」으로 바뀌면 안 된다.** 입력이 ① 이 됐으므로 S1 에서 「해외 가격대」가
나오는지 **반드시 E2E 로 확인** 한다.

---

## ⑥ 🔴 회귀 점검 포인트 (R3 때문에 깨지기 쉬운 것)

```
PRICE_COMPARISON_ANCHOR_ID · scrollIntoView · market split · price guide ·
sale status · candidate review 저장 · review history · MI verdict copy ·
상세 근거 접힘 · 기존 testid · 탭별 렌더링
```

## ⑦ 🟢 머지 조건 — **전부 PASS 일 때만** main 으로

```
계약 PASS · mutation PASS · S1 E2E PASS · S2 E2E PASS ·
regression PASS · typecheck PASS · build PASS · worktree clean
🔴 그 전에는 배포하지 않는다. main push = Production 배포다.
```

## ⑧ 🟡 CEO 테스트 — 배포 후 **딱 1회** (`/today → B226AC009`, 스크롤 없이)

```
PASS  단계 표시 → 탭 → 📊 시장 판매 판단 → 🇰🇷/🌎 → 판매·가격 판단 → ▸ 판단 근거
      · 위/아래 가격 숫자가 다르지 않다
      · 별도 「시장 가격 비교」가 또 나오지 않는다
      · 후보 리스트가 처음부터 길게 나오지 않는다
      · 판단 근거를 열면 후보를 볼 수 있다
      · 동일/유사/다른 저장이 유지된다
🟡 같이 전달할 것 — 🇰🇷 에 금액이 없고 「확인하지 못했습니다」인 것은 **정상** 이다
   (국내 tier SAME 0 · WU-138 확정 · 완화 REJECT). 「퇴화」가 아니다.
```

🔴 **R3 에서 다시 열지 않는 것** — MI SAME threshold · `NO_TITLE_OVERLAP` ·
`BRAND_MISMATCH` · `BRAND_UNCONFIRMED` · 8축 · Registry · sale status ·
price verification · `human_verdict` 저장 경로(STEP 4 에서 이미 해결 · 건드리지 않는다).
