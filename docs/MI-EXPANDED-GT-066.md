# WU-066 — GT 표본 확대 + 국내 가격 비교 판별력 검증 (롱스프린트 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「WU-059~065 의 결론이 GT 51 이라는 작은 표본에 갇혀 있는지 검증」
> 🔴 「**A군 분모 0 을 반드시 깨야 합니다**」 · 「CF-3 은 구현하지 않고 counterfactual 만」

---

## 0. 판정

```
🟢🟢 **A 군 분모를 깼다** — WU-065 에서 **0** 이었던 것이 **18쌍** 이 됐고 **전부 DIFFERENT** 다
🔴🔴 **CF-3(`crossSellerReserved` 우회) REJECT 확정** — precision 91.7% → **55.6%** ·
     False SAME **1 → 16** · C08 이 뚫린다. CPO 의 「구현하지 말라」가 정확했다
🟡 CF-1 효과 **0**(확대 표본에서도) · CF-2 **+1 SAME · False SAME 0** — 안전성은 강해졌으나
   이득이 여전히 **1건** ⟹ GO 조건(「의미 있는 EXACT 회복」) 미충족
⟹ **HOLD · 구현 0 · 운영 코드 변경 0**
```

---

## 1. 🔴 Human GT 는 CTO 가 만들 수 없다 — 그래서 «함의» 만 썼다

WU-036 의 51건은 **CEO 블라인드 리뷰** 산출물이다. 🔴 **새 사람 라벨을 지어내지 않았다.**

```
전제  원상품 S1~S6 가 **서로 다른 여섯 상품** 이다 (제목 전수 확인)
        S1 Booty Ghosts LS T-Shirt · S2 Hug Hairy Monster T-Shirt · S3 Curious Turnip Swim Cap
        S4 Bubble Sweatshirt · S5 Lulu T Bar Shoes · S6 B.C. Embossed tracksuit jacket
규칙  후보 c 가 S_i 에 Human **SAME** 이면, j≠i 에 대해 (S_j, c) 는 **DIFFERENT** 다
      — c 는 «하나의 상품 페이지» 이므로 두 상품일 수 없다
산출  Human SAME 27 × 5 = **파생 DIFFERENT 135쌍**   ⟹ 총 **186쌍**
```

🔴 **Human DIFFERENT 후보는 파생에 쓰지 않았다** — 그것이 다른 원상품에는 SAME 일 수 있다.

🔴🔴 **한계를 먼저 적는다**:
```
① 파생 쌍은 **운영에서 만들어지지 않는 조합** 이다(후보는 자기 원상품하고만 비교된다)
   ⟹ 「게이트가 **비동일 쌍을 거절하는가**」를 재는 **정밀도 시험** 으로만 쓴다. Recall 분모로 쓰지 않는다
② **SAME 은 한 건도 늘지 않았다**(27 그대로) — 늘리는 길은 사람 라벨뿐이다
③ 후보 도메인·원상품은 그대로다 — 「새 샵」이 들어온 것이 아니다
🔴 그래서 CPO 가 요구한 10개 조합 중 **「한국어↔한국어」·「신규 샵」** 은 확보하지 못했다
```

---

## 2. 🟢🟢 A 군 분모가 깨졌다 — 그리고 **18/18 이 DIFFERENT 다**

```
NO_TITLE_OVERLAP  **36쌍** (Human 4 · 파생 32)
  문자체계 분포   LA→MIXED **18** (한국어 후보)  ·  LA→LA **18** (= **A 군**)
  🔴 A 군 18쌍 **전부 DIFFERENT**
```

🔴🔴 **이것이 WU-065 의 미결을 닫는다.** WU-065 는 A 군이 0 이라
「`NO_TITLE_OVERLAP` 이 진짜 불일치를 의미하는가」를 검증할 수 없었다.
이제 **같은 문자체계(영어↔영어)인데 제목 겹침이 0 인 18쌍이 전부 실제로 다른 상품** 이다.

⟹ 🟢 **`NO_TITLE_OVERLAP` 은 실제로 「다른 상품」을 잘 잡는다. 전면 비차단은 위험하다.**

🔴 **집계 버그를 하나 잡았다** — 처음에 `x.oScript` 로 읽어 `undefined === undefined` 가
**전부 참** 이 되어 A 군이 **36/36** 으로 찍혔다. owner 결과(`x.base.oScript`)에서 읽도록 고쳤다.

---

## 3. 정책별 측정 (전체 **186쌍**)

| 정책 | EXACT | SAME | 🔴 False SAME | precision | recall |
|---|---|---|---|---|---|
| **Baseline** (현재) | 12 | 11 | **1** | **91.7%** | 40.7% |
| **CF-1** `NO_TITLE_OVERLAP` 비차단 | 12 | 11 | **1** | 91.7% | 40.7% |
| **CF-2** + color | **13** | **12** | **1** | **92.3%** | 44.4% |
| 🔴 **CF-3** + `crossSellerReserved` 우회 | **36** | 20 | 🔴 **16** | 🔴 **55.6%** | 74.1% |

**파생 분모(135쌍)에서만 본 False SAME**:
```
base **0/135**   cf1 **0/135**   cf2 **0/135**   🔴 cf3 **4/135**
   cf3 누출: S4/C03 · S2/C30 · S4/C30 · S1/C42  ← **완전히 다른 상품끼리 EXACT**
```

🔴🔴 **CF-3 이 참사다.** `crossSellerReserved`(PRESUMED_SAME 보류)를 우회하면
precision 이 **91.7% → 55.6%** 로 무너진다. CPO 가 「CF-3 은 실제 구현하지 않고
counterfactual 만 측정」하라고 한 판단이 **데이터로 정당화됐다**.

### 🔴 회귀 anchor

| | label | base | cf1 | cf2 | cf3 |
|---|---|---|---|---|---|
| C06 | DIFFERENT | EXACT | EXACT | EXACT | EXACT |
| C08 | DIFFERENT | COMPARISON | COMPARISON | COMPARISON | 🔴 **EXACT** |

🟢 **C08 이 CF-3 에서만 뚫린다** — WU-065 가 「③이 막는다」고 한 그 보호가 유일한 방어였고,
확대 표본이 그것을 **직접 확인** 했다.
🔴 C06 은 네 정책 모두 EXACT 다 — WU-060 이 「텍스트로 막을 수 없다」고 확정한 그 건이다.

---

## 4~5. 구현 / 변경 파일

```
운영 코드 변경  **0**  (NO_TITLE_OVERLAP · crossSellerReserved · color blocker · threshold ·
                Registry · 가격 parser · market gate 전부 미변경 — CPO 금지 8항 준수)
테스트          wu-066-expanded-gt.test.ts **1건**(186쌍 · 정책 4 · 계약 12 단언)
```

---

## 6. Mutation — **세 보호층을 각각 죽여 본다**

baseline **16 passed** · 변형마다 원상복구

| | 변형 | 결과 |
|---|---|---|
| U1 | `crossSellerReserved = false` (③ 우회) | 🔴 **2 failed** |
| U2 | `NO_TITLE_OVERLAP` push 제거 (① 제거) | 🔴 **3 failed** |
| U3 | EXACT 게이트에서 색상 축 제거 (② 제거) | 🔴 **4 failed** |
| — | 원상복구 | 🟢 **16 passed** |

🟢 **세 층이 전부 계약으로 잠겨 있다.**

---

## 7~8. Regression / Typecheck / Build

```
회귀      apps/admin  **573 files / 8,258 passed** / failed 0 (skipped 94)
typecheck **0 errors**     build **exit 0**
해외 회귀  WU-049 · 056 · 056-R1 · 062 **전건 유지**
```

---

## 9. Production

```
🔴 운영 코드 변경 0 ⟹ UI 변경 0 ⟹ Production 거동 불변
외부 API 0 · 외부 HTTP 0 · 키 0 · 결제 **₩0** · Gemini 잔액 ₩3,171 보존
```

---

## 10. 🔴 Known Unknowns

```
① 🔴 **SAME 분모는 27 그대로** 다. 파생으로는 DIFFERENT 만 늘릴 수 있다
   ⟹ 「의미 있는 EXACT 회복」을 증명하려면 **사람 라벨이 더 필요하다**
② 🔴 CPO 가 요구한 10조합 중 **「한국어↔한국어」·「신규 샵」·「같은 품번+다른 모델」** 미확보
③ 🔴 파생 쌍은 **운영 비재현 조합** 이다 — 정밀도 시험으로만 유효하다
④ 🔴 A 군 18쌍은 전부 **파생** 이다(Human A 군은 여전히 0)
⑤ 🔴 CF-2 의 색상 출처가 **meta description 산문** 이라 WU-047 HOLD 와 묶여 있다
```

---

## 11. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

## 12. CEO Action — **없음** (운영 코드·UI 변경 0)

---

## 13. 🔴 CPO 판정 요청

| 안건 | 측정 결과 | CTO 권고 |
|---|---|---|
| **CF-3** `crossSellerReserved` 우회 | precision **55.6%** · False SAME **16** | 🔴 **REJECT (영구 폐기)** |
| **CF-1** `NO_TITLE_OVERLAP` 단독 비차단 | 효과 **0** · A 군 18/18 DIFFERENT | 🔴 **폐기 권고** — blocker 가 실제로 유효하다 |
| **CF-2** `NO_TITLE_OVERLAP` + color | +1 SAME · **False SAME 0** (186쌍) | 🟡 **HOLD 유지** — 안전하나 이득이 1건 |
| **사람 라벨 확대** | SAME 분모가 27 에서 멈춰 있다 | 🟡 **CEO 블라인드 리뷰 2차** 가 유일한 길 |

🟢🟢 **이번 WU 가 확정한 세 문장 — 다음 세션이 그대로 쓴다**:
```
① `NO_TITLE_OVERLAP` 은 **진짜 다른 상품을 잘 잡는다**(A 군 18/18 DIFFERENT). 풀지 않는다.
② `crossSellerReserved` 는 **정밀도의 기둥** 이다. 우회하면 91.7% → 55.6% 로 무너진다.
③ 남은 안전한 레버는 **CF-2 하나** 이고 그 이득은 **1건** 이다 —
   더 가려면 **코드가 아니라 사람 라벨** 이 필요하다.
```
