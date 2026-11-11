# MSRUX-1 D·C — 계약 스윕 착수 노트 (브랜치 `wip/msrux-1-dc` 전용)

🔴 **스윕을 시작하기 «전» 에 고쳐야 할 결함이 하나 있다.** 그대로 스윕하면 **틀린 기반**을
정답으로 굳힌다.

## 🔴🔴 결함 — D 수술이 「동일상품 확정 N건」 줄을 잃었다

```
증상   해외 SAME **3건** 인데 화면에는 「동일상품 확정 0건」(국내)만 있고
       해외의 「동일상품 확정 3건」 줄이 **없다**
잡은 것 내 B 계약 `msrux-1b-card-shell-parity.test.ts` B-4
       (D 적용 «전» 에는 4/4 PASS 였다 ⟹ **D 가 만든 회귀** 다)
```
🔴 즉 D 수술의 유지 목록(`market-judgement`·`seller-decision(-line)`·`market-split`·
`market-verdict`)이 **충분하지 않았다** — `market-same-count-{suffix}`(건수 줄)도
**판단 결과** 이고 CPO 유지 목록에 암묵적으로 포함된다(A 에서 이름을 바꾼 그 지표다).

🟢 **고치는 법** — `d-surgery.mjs` 의 유지 범위에 그 줄을 **추가** 한다. 좌표는
`MarketPriceComparison.tsx` 의 `market-same-count-${suffix}` 블록 둘(0분기 · price-guide 분기)
이고, 둘 다 `isSummary` 조건 안에 있다.

## 스윕 범위(실측)

```
통합 회귀   **127 failed / 10,734 passed**  · 실패 테스트 파일 **약 40**
분류 규칙   ⒜ 유지 testid → 유지 단언 **추가**
            ⒝ 제거한 UI → 제거 단언으로 갱신 + **보존 단언을 같이** 둔다
            ⒞ `Cannot read properties of null (reading 'textContent')` 11건은
               제거된 testid 를 쿼리한 뒤 바로 읽는 모양이다(기계적 갱신 대상)
🔴 테스트 제외(skip)·무력화로 해결하지 않는다(CPO 금지).
```

## 순서

1. 위 결함 수정 → `msrux-1b` **4/4 복구** 확인
2. 127건 전수 분류·갱신
3. B·D·C 통합 회귀 · typecheck · build
4. **전부 PASS 일 때만** main 병합 → Production 배포 확인

---

# 📋 계약 스윕 진행표 (묶음마다 갱신·커밋한다)

🔴 **다음 세션은 처음부터 다시 재지 않는다** — 아래 표가 기준이다.
🔴 분류 규칙: **유지**(존재·내용 보존 단언) · **제거**(제거 단언 **+ 보존 단언 동반**) ·
**이동**(owner 가 바뀐 것). 🔴 skip·무력화·제외 **금지**.

```
기준     24f1a84a (D 회귀 수정 완료) · 전체 125 failed / 35 파일
갱신 뒤  (묶음마다 아래 표의 「남은」 열을 고친다)
```

| 파일 | 실패 | 분류 | 갱신 | 결과 | 비고 |
|---|---:|---|---:|---|---|
| core-2t-domestic-price-band | 1 | 제거(설명문장)+유지(건수줄) | 1 | 🟢 PASS | `market-empty-*` 제거 ⟹ `market-same-count-*` 로 본다 |
| core-2e-price-purpose | 1 | 제거(`market-price-range`) | 1 | 🟢 PASS | 환산 금지 축은 **남은 가격 자리**에서 본다 |
| price-display-layout | 1 | 제거(ⓘ 토글·펼침) | 1 | 🟢 PASS | 🔴 **주석을 벗기고** 본다(내 주석에 그 글자가 있다) |
| core-2s-seller-screen | 10 | — | 0 | 🔴 남음 | |
| wu-140-market-first | 8 | — | 0 | 🔴 남음 | |
| seller-surface-render-harness-1 | 8 | — | 0 | 🔴 남음 | |
| wu-146-seller-decision-contract | 7 | — | 0 | 🔴 남음 | |
| core-2ao-r1-screen-dump | 7 | — | 0 | 🔴 남음 | |
| wu-136-market-judgement-render | 6 | — | 0 | 🔴 남음 | |
| core-2v-seller-reading-order | 6 | — | 0 | 🔴 남음 | |
| core-2u-domestic-price-meaning | 6 | — | 0 | 🔴 남음 | |
| wu-145-seller-decision-screen | 5 | — | 0 | 🔴 남음 | |
| wu-144-seller-decision-e2e | 4 | — | 0 | 🔴 남음 | |
| r2-final-price-and-cta | 4 | — | 0 | 🔴 남음 | |
| product-tab-mounted | 4 | — | 0 | 🔴 남음 | |
| product-tab-first-screen | 4 | — | 0 | 🔴 남음 | |
| mi-ux-final | 4 | — | 0 | 🔴 남음 | |
| mi-polish | 4 | — | 0 | 🔴 남음 | |
| core-ux-seller-01-decision-order | 4 | — | 0 | 🔴 남음 | |
| core-ux-rebuild-01-exposure-depth | 4 | — | 0 | 🔴 남음 | |
| wu-148-market-price-signal | 3 | — | 0 | 🔴 남음 | |
| wu-139-price-guide | 3 | — | 0 | 🔴 남음 | |
| wu-136-market-judgement | 3 | — | 0 | 🔴 남음 | |
| core-next-step4-recommended-price | 3 | — | 0 | 🔴 남음 | |
| wu-133-pending-note-render | 2 | — | 0 | 🔴 남음 | |
| wu-132-mi-same-price-comparison | 2 | — | 0 | 🔴 남음 | |
| mi-simplify | 2 | — | 0 | 🔴 남음 | |
| core-ux-rebuild-02-price-candidate | 2 | — | 0 | 🔴 남음 | |
| (1건짜리 7파일) | 7 | — | 0 | 🔴 남음 | reference-profitability-production-wiring-1 · reference-price-profitability-axis-1 · price-single-surface · price-judgement-card · mi-ux-final-4 · core-2w-price-qualification · core-2r5-domestic-reference-to-mi |

## 🔴 묶음 1 에서 배운 함정 둘(다음 묶음이 반복하지 않게)

```
⒜ **주석을 벗기지 않는 소스 계약이 있다** — 내가 쓴 설명 주석에 제거 대상 글자가 들어가
   「되살아났다」로 FAIL 한다. ⟹ 제거 단언은 **주석 제거 뒤** 본다.
⒝ 테스트마다 **쓸 수 있는 변수가 다르다**(`el`·`panel`·`range`) — 보존 단언을 더할 때
   그 스코프에 **실제로 있는** 변수만 쓴다(없는 이름을 쓰면 `is not defined` 로 죽는다).
```

---

## 묶음 2 사전 분류 — `core-2s-seller-screen`(10건) · 🔴 **수정 전 · 분류만 끝났다**

🟢 다음 세션은 **이 표로 바로 수정** 하면 된다(실패 재측정 불필요).

| 테스트 | 실패 모양 | 분류 | 할 일 |
|---|---|---|---|
| A-2 | 「동일상품 확인 0곳」 문장 `indexOf -1` | **제거**(설명 문장) | 문장 제거 단언 + **건수 줄**(`market-same-count-domestic`) 보존 단언 |
| A-3 | `null.textContent` | **제거**(`🔎 동일상품 확인` 라벨) | 그 라벨 제거 단언 · 🔴 쿼리 결과를 바로 읽지 말 것 |
| A-4 | `''` 에 「동일상품 확정 0건」 없음 | **이동** | owner 가 `market-empty-*` → `market-same-count-*` 로 바뀌었다 |
| B-4 | 해외 순서 `-1 > -1` | **이동** | 🌎 도 A 와 같은 owner 로 본다(가격 → 건수 순서) |
| E-1 | `null.tagName` | **제거**(「💡 가격 판단 기준」 영역) | 영역 제거 단언 + 판단 결과 보존 단언 |
| E-1b | 근거 문장 없음 | **제거** | 「접었지만 남아 있다」 → 「**제거했고 계산은 보존**」으로 뒤집는다 |
| E-2 | 위치 `177 < -1` | **제거** | 위치 계약 폐기 · 대신 **그 영역이 없다** 를 단언 |
| F-1 | 원가 보류 줄 없음 | **제거**(`market-cost-hold`) | 제거 단언 + 🔴 `priceCalculationDetail` 보존 단언 |
| F-2 | 비용 축 줄 없음 | **제거** | 위와 같은 쌍 |
| G-1 | `market-verdict` 가 1차에 있다 | 🔴🔴 **의미 전환** | D 로 접힘이 사라져 **1차에 서는 것이 정상** 이다 ⟹ 계약을 「2차에 있다」가 아니라 **「결론(`seller-decision`)과 같은 말을 하지 않는다」** 로 바꾼다(원래 의도 보존) |

🔴 **G-1 이 이 파일에서 가장 위험한 줄이다** — 「1차에 없다」를 그대로 두면 D 를 되돌리게 되고,
무심코 지우면 **결론 중복 금지** 라는 원래 보호가 사라진다. **의도를 옮겨 적는다.**

### 묶음 2 진행 — `core-2s-seller-screen` **10 → 6**(4건 해소 · 커밋 완료)

| 테스트 | 처리 | 결과 |
|---|---|---|
| A-2 | 문장 제거 단언 + 건수 줄 보존 | 🟢 PASS |
| A-3 | 상세 블록 제거 단언(null) + 건수 줄 보존 · `block.innerHTML` → `el.innerHTML` | 🟢 PASS |
| A-4 | owner 이동(`market-empty-*` → `market-same-count-*`) + 문장 제거 단언 | 🟢 PASS |
| B-4 | 해외도 같은 이동(대칭) + 문장 제거 단언 | 🟢 PASS |
| E-1 · E-1b · E-2 | **제거**(「💡 가격 판단 기준」 영역) | 🔴 남음 |
| F-1 · F-2 | **제거**(`market-cost-hold`) + `priceCalculationDetail` 보존 | 🔴 남음 |
| G-1 | **의미 전환**(위치 계약 폐기 → 결론 중복 금지) | 🔴 남음 |

🔴 **함정 ⒞ 추가** — 이 파일은 단언 사이에 **주석이 끼어 있어 블록 치환이 깨진다**.
**한 줄씩** 치환한다(`A-3a~A-3d` 가 그 방식이다).

```
잔여  **118건 / 32파일**(core-2s 6 포함)
```

### 🟢 묶음 2 **완료** — `core-2s-seller-screen` **10 → 0**(35/35 PASS)

| 테스트 | 분류 | 처리 |
|---|---|---|
| E-1 | 제거 | 「접힘이다」 → **`price-basis` 가 없다** + 판매 판단 보존 단언 |
| E-1b | 제거 | 「문장이 남아 있다」 → **화면에서 제거** + 🟢 `priceBasisLines` **계산 보존** 단언 |
| E-2 | 제거 | 위치 계약 폐기 → 영역 부재 + **남은 둘의 순서**(시장 → 결론) |
| F-1 | 제거 | `market-cost-hold` 부재 + 두 문장 제거 + 판매 판단 보존 |
| F-2 | 제거 | 비용 설명 줄 제거 |
| G-1 | 🔴 **의미 전환** | 「1차에 없다」 폐기 → **둘 다 존재하되 «같은 말을 반복하지 않는다»** |

🔴🔴 **G-1 이 이 파일의 핵심이다** — 접힘이 사라져 `market-verdict` 는 **1차에 서는 것이 정상**
이다. 위치 단언을 두면 **D 를 되돌리고**, 지우면 **결론 중복 금지 보호가 사라진다**.
🟢 그래서 `verdict` 와 `seller-decision` 이 **둘 다 있고** 결론이 분류 라벨 문장을
**포함하지 않는다** 로 옮겨 적었다(원래 의도 보존).

```
잔여  **112건 / 31파일**  ·  다음: wu-140(8) → seller-surface-render-harness-1(8) → 표 순서
```
