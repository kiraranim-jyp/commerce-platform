# WU-065 — `NO_TITLE_OVERLAP` 전수 검증 (롱스프린트 · 조사 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「`NO_TITLE_OVERLAP` 이 실제로 **다른 상품**을 의미하는지,
> 아니면 한국어↔영어 제목의 언어 차이 때문에 발생하는 **비교 불가** 인지 전수 검증」

---

## 0. 판정 — 🟡 **HOLD**

```
🔴 **단독 완화는 효과가 «0» 이다** — CF-1·CF-2·CF-3 전부 변화 **0건**
   (색상 축 `colorUnverified` 가 그 뒤에서 또 막는다)
🟡 결합(색상 복구 + 비차단)만 효과가 있다 — Human SAME **+1**(C47) · False SAME **0**
🔴 그러나 표본이 **4건** 이고 A 군(진짜 불일치) 분모가 **0건** 이다
   ⟹ CPO GO 조건 「**충분한 표본** 에서 SAME 회복」을 **충족하지 못한다**
🔴 REJECT 도 아니다 — False SAME 증가 0 이고 문자체계 판별은 안정적이다
⟹ **HOLD · 구현 0 · 운영 코드 변경 0**
```

---

## 1. 생산 조건 — 하나다

```
cross-seller.ts:861-871
  distinctive = 토큰 중 **카테고리 단어를 뺀 것**(shirt/pants… 는 CATEGORY 축이 따로 센다)
  titleOverlap = jaccard(distinctiveX, distinctiveY)
  titleOverlap === 0  →  blockers.push(NO_TITLE_OVERLAP)
```
🔴 **즉 「교집합이 0」일 뿐이다.** 한국어↔영어 제목은 **구조적으로** 0 이 된다.

---

## 2. 전수 (GT 51)

```
NO_TITLE_OVERLAP  **4/51** — 🔴 **전부 국내 후보** (원제목 `LA` → 후보 `MIXED`)
```

| | human | host | 원script | 후보script | 품번 | 독립증거 | tier | blockers |
|---|---|---|---|---|---|---|---|---|
| C07 | SAME | biskuit.kr | LA | MIXED | exact | 2 | COMPARISON | `BRAND_MISMATCH+NO_TITLE_OVERLAP` |
| C08 | **DIFFERENT** | m.luxboy.com | LA | MIXED | exact | 2 | COMPARISON | `NO_TITLE_OVERLAP` |
| C15 | SAME | mustit | LA | MIXED | exact | 1 | COMPARISON | `NO_TITLE_OVERLAP+BRAND_UNCONFIRMED` |
| C47 | SAME | biskuit.kr | LA | MIXED | exact | 1 | COMPARISON | `NO_TITLE_OVERLAP+BRAND_UNCONFIRMED` |

🔴 **문자체계는 추정하지 않고 «글자» 로 셌다**(한글 코드포인트 / 라틴 문자).

---

## 3. A/B/C 분리 — 🔴 **A 군이 0건이다**

```
A 같은 문자체계인데 겹침 0 (진짜 상품 불일치)   **0건**  ← 🔴 분모가 없다
B 언어만 다르고 독립증거 충분(품번 exact + ≥2)   2건   C07 **SAME** · C08 **DIFFERENT**
C 언어 다르고 독립증거 부족                      2건   C15 SAME · C47 SAME
```

🔴🔴 **B 군 2건 중 1건이 Human DIFFERENT 다 — CPO 가 제안한 B 기준이 동일성을 보장하지 않는다.**

토큰 실물이 그 이유를 보여준다:
```
C07  원[hug hairy monster shirt]  후[보보쇼즈 허그 헤어리 몬스터 티셔츠 b226ac009]
     🟢 「허그 헤어리 몬스터」= **음역** 이다. 같은 상품.
C08  원[hug hairy monster shirt]  후[보보쇼즈 키즈 긴팔티셔츠 b226ac009 since 2002]
     🔴 후보 제목에 **상품명이 아예 없다**(「키즈 긴팔티셔츠」는 일반 명사).
        Human DIFFERENT · 사유 **「컬러 다름」**.
```
⟹ 🔴 **둘 다 「품번 exact + 독립증거 2」인데 하나는 같고 하나는 다르다.**
   **독립증거 개수로는 가를 수 없다.**

---

## 4. Counterfactual

| | EXACT | SAME | DIFFERENT | precision | recall | 변화 |
|---|---|---|---|---|---|---|
| 현재 | 12 | 11 | 1 | 91.7% | 40.7% | — |
| **CF-1** 전면 비차단 | 12 | 11 | 1 | 91.7% | 40.7% | 🔴 **0건** |
| **CF-2** + 품번 exact | 12 | 11 | 1 | 91.7% | 40.7% | 🔴 **0건** |
| **CF-3** + 품번 exact & 독립증거 ≥2 | 12 | 11 | 1 | 91.7% | 40.7% | 🔴 **0건** |
| **CF-4** 색상 복구 **＋** 비차단 | **13** | **12** | 1 | **92.3%** | 44.4% | 🟡 C47 하나 |

🔴🔴 **CF-1 만 보고 결론 내리지 말라는 CPO 지시가 정확했다** — 단독 완화 셋이 **전부 효과 0** 이다.
그 뒤에서 **색상 축(`colorUnverified`)** 이 또 막기 때문이다. 둘을 **같이** 풀어야 움직인다.

---

## 5. 🟢 안전성 — C08 이 결합 CF 에서도 막힌다 (보호가 한 겹 더 있다)

```
CF-4 에서 C08 (Human DIFFERENT · 「컬러 다름」)
  colorUnverified **false**(복구됨) · blockers **[]**(NO_TITLE_OVERLAP 제거됨)
  🟢 그런데 tier = **COMPARISON** — `verdict = PRESUMED_SAME` 이라
     `crossSellerReserved`(match-truth.ts:233)가 식별자 경로를 막는다
⟹ 🟢 **blockers 가 비어도 verdict 보류가 남는다.** 이것이 세 번째 방어층이다.
```

### 🟢 C06 regression anchor

```
C06 `noOverlap = false` ⟹ CF-1·2·3 **전부 EXACT 불변**(Human DIFFERENT 1건 그대로)
🟢 이 WU 의 어떤 변경안도 C06 을 건드리지 않는다 — 계약으로 고정했다.
🔴 그리고 「품번 하나 맞으면 통과」로 변질되지 않았음을 B 군 측정이 보여준다(C08).
```

---

## 6~7. 구현 결과 / 변경 파일

```
운영 코드 변경  **0**  (title threshold · blocker · 색상사전 · meta · Registry ·
                가격 parser · market gate 전부 미변경 — CPO §6 금지 8항 준수)
테스트          wu-065-title-overlap.test.ts **1건**(전수 + CF 넷 + 계약 12 단언)
```

---

## 8. Negative / Mutation

baseline **22 passed** · 변형마다 원상복구

| | 변형 | 결과 |
|---|---|---|
| N1 | `NO_TITLE_OVERLAP` **push 제거** | 🔴 **3 failed** |
| N2 | OBSERVED 분류표에서 제거 | 🔴 **2 failed** |
| N3 | 겹침 0 도 TITLE 축으로 인정(`> 0` → `>= 0`) | 🔴 **3 failed** |
| — | 원상복구 | 🟢 **22 passed** |

---

## 9~11. Regression / Typecheck / Build

```
회귀      apps/admin  **572 files / 8,257 passed** / failed 0 (skipped 94)
typecheck **0 errors**     build **exit 0**
해외 회귀  WU-049 · 056 · 056-R1 · 062 **전건 유지**
```

---

## 12. Production

```
🔴 운영 코드 변경 0 ⟹ UI 변경 0 ⟹ Production 거동 불변
외부 API 0 · 외부 HTTP 0 · 키 0 · 결제 **₩0** · Gemini 잔액 ₩3,171 보존
```

---

## 13. 🔴 Known Unknowns

```
① 🔴 **표본 4건** 이다. 그중 A 군 **0건** — 「진짜 불일치인 NO_TITLE_OVERLAP」을
   이 데이터로는 **한 건도 관측하지 못했다**. 「A 가 없다」가 아니라 **분모가 없다**
② 🔴 CF-4 의 이득이 **N=1**(C47) 이고 그 색상 출처는 **meta description 산문**
   (WU-047 이 HOLD 한 자리)이다 — 두 금지를 동시에 풀어야 한다
③ 🔴 **음역 판별**(「허그 헤어리 몬스터」↔ "hug hairy monster")은 **구현하지 않았고
   측정하지도 않았다** — 새 매칭 축이고 이번 범위 밖이다
④ 🔴 문자체계 신호가 **원제목이 항상 라틴** 인 이 표본에서만 검증됐다
   (원상품 호스트 2개 · junioredition · bobochoses.co.jp)
⑤ 🔴 C08 이 왜 Human DIFFERENT 인지(같은 품번 · 「컬러 다름」)는 **페이지를 보지 않았다**
```

---

## 14. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

## 15. CEO Action — **없음** (운영 코드·UI 변경 0)

---

## 16. 🔴 CPO 판정 요청

| 안건 | CTO 권고 |
|---|---|
| `NO_TITLE_OVERLAP` 재분류 | 🟡 **HOLD 유지** — 단독으로는 효과 0 이고, 결합해도 이득이 N=1 이며 A 군 분모가 0 이다 |
| **GT 표본 확대** | 🟡 **권고** — 이 트랙의 모든 판단이 **GT 51 · 원상품 2개** 에 묶여 있다. 국내 후보를 더 모아 A 군을 관측해야 이 질문이 닫힌다 |

🟢 **이번 WU 가 확정한 것 — 다음 세션이 그대로 쓴다**:
```
국내 가격 비교의 마지막 구간은 **세 겹** 으로 막혀 있다:
  ① NO_TITLE_OVERLAP (한국어 제목)   ② colorUnverified (색상 추출 실패)
  ③ crossSellerReserved (PRESUMED_SAME 보류)
🔴 **하나만 풀면 아무 일도 일어나지 않는다**(CF-1/2/3 = 변화 0).
🟢 그리고 ③은 결합 CF 에서도 False SAME 을 막아 냈다(C08).
```
