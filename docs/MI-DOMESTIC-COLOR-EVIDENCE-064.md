# WU-064 — 국내 색상 Evidence 복구 (롱스프린트 · 조사 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「`colorText=null` 원인 확정 및 **False SAME 을 증가시키지 않는**
> 방식으로 색상 evidence 복구」 · STEP 9「가격·시장·MI threshold 건드리지 않음」

---

## 0. 한 줄 결론

```
🔴🔴 **색상을 «완벽히» 복구해도 국내 EXACT 는 하나도 늘지 않는다** (tier 변화 **0건**).
     WU-063 의 「색상 미확인이 직접 원인」을 **정정한다** — 그것은 EXACT 게이트에서
     **마지막으로** 걸리는 조건이었고, **그것만 풀면 EXACT 가 된다는 뜻이 아니었다.**
🟢 진짜로 막는 것은 **한국어 제목** 이다 → `NO_TITLE_OVERLAP`(관측된 차이) → 영구 차단.
🟡 색상 복구 **+** `NO_TITLE_OVERLAP` 비차단을 **같이** 하면 국내 EXACT 가 **처음으로 1건**
   생기고 **False SAME 은 0** 이다(precision 91.7% → 92.3%). 🔴 단 **금지 둘** 을 풀어야 한다.
⟹ **구현 0 · HOLD.** 운영 코드 변경 **0**.
```

---

## 1. STEP1~3 — 원인 확정: **생산자가 제목 전용이다**

```
seller-facts.ts:264    colorText = extractColorFromTitle(input.title)
description-facts.ts   extractColorFromTitle → COLOR_TITLE_PATTERN(KNOWN_COLOR_WORDS **화이트리스트**)
                       🟢 그 함수 주석이 한계를 **스스로 적어 뒀다**:
                          「화이트리스트 밖 색상(예: 브랜드가 지어낸 "Dark Gum")은 놓친다」
product-url-facts.ts:109-110  「읽는 자리를 셋으로 한정한다 … **색상·소재·상품군은 건드리지 않는다**」
```

⟹ 🔴 **후보 경로는 HTML 의 색상을 «아예 보지 않는다».** 제목에 **영어** 색상 단어가 없으면
`null` 이고, 국내 제목은 한국어라 대부분 없다. **해외/국내 extractor 차이가 바로 이것이다** —
같은 함수인데 **입력(제목)의 언어** 가 다르다.

---

## 2. STEP1 — 「없다」와 「있는데 못 읽는다」를 갈랐다 (국내 17건 HTML 전수)

```
JSON-LD `color`   **1/17**  (C08 `"블루"` — 🔴 그마저 국내 버킷 밖이다)
`itemprop=color`  **0/17**      `og:color` / `product:color`  **0/17**
```

국내 **버킷 5건** 의 색상 소재지를 HTML 에서 직접 확인했다:

| | 소재지 | 실제 글자 | 판정 |
|---|---|---|---|
| C07 C47 | 🟡 **meta description 산문** | 「…오가닉 코튼 100% **라이트 블루 컬러**의…」 | 🔴 **WU-047 이 채택 불가로 HOLD** 한 자리 |
| C23 C24 | 🟡 **제목에 있다** | 「… - **Graystone**」 | 🔴 브랜드 고유 색상명 → **색상사전 확대 필요**(WU-044 금지) |
| C15 | 🔴 **없다** | `color` 는 전부 CSS/JS 노이즈 | — |

🟢 **그러므로 「안전한 구조화 색상 source」는 국내 후보에 사실상 존재하지 않는다.**

---

## 3. STEP6 — 색상을 **완벽히** 복구했다고 가정한 Counterfactual

🔴 **지어낸 값이 아니다** — 위 표에서 **실제로 페이지에 있는 글자만** 주입했다.

| | human | 원상품 색상 ↔ 복구 색상 | 전 | 후 | tier |
|---|---|---|---|---|---|
| C07 | SAME | `Light Blue` ↔ `라이트 블루` | `SIMILAR` · colorUnv true | `SIMILAR` · colorUnv **false** | COMPARISON → **COMPARISON** |
| C47 | SAME | `Blue` ↔ `블루` | 〃 | 〃 | COMPARISON → **COMPARISON** |
| C23 | DIFFERENT | `Grey Melange` ↔ `Graystone` | `SIMILAR` · blockers [] | `PRESUMED_SAME` · **[COLOR_VARIANT]** | COMPARISON → **COMPARISON** |
| C24 | DIFFERENT | 〃 | 〃 | 〃 | COMPARISON → **COMPARISON** |
| C08 | DIFFERENT | `Light Blue` ↔ `블루` | 〃 | `PRESUMED_SAME` | COMPARISON → **COMPARISON** |

```
전수 KPI (GT 51)
  EXACT 12 → **12** (SAME 11 · DIFFERENT 1 — 불변)
  COMPARISON 29 → 29 · REFERENCE 2 → 2 · EXCLUDED 8 → 8
  🔴 tier 가 바뀌는 후보 **0건** · Human SAME 회복 **0** · False SAME 증가 **0**
```

🟢 **그래도 질적으로는 좋아진다** — C23·C24 의 방어가 「색상 **미확인**」에서
「**관측된 차이**(`COLOR_VARIANT`)」로 바뀐다. 🔴 그러나 **tier 는 그대로** 다.

---

## 4. 🔴🔴 진짜 원인 — **한국어 제목**

```
C07 C15 C47  한국어 제목 → 원상품(영문)과 토큰 겹침 **0** → **NO_TITLE_OVERLAP**
             그 blocker 는 `hasObservedDifference` 집합이라
             **색상·품번과 무관하게** EXACT 를 막는다
C23 C24      제목이 **영어**("Bubble Sweatshirt - Graystone") → NO_TITLE_OVERLAP **없음**
             → 그래서 blockers 가 비어 있었고 **색상 축만이 유일한 방어** 였다(WU-063 CF-4)
```

실제 제목:
```
C07  「[보보쇼즈] 허그 헤어리 몬스터 티셔츠 B226AC009 - 비스킷」
     ↔ 원상품 "Hug Hairy Monster T-Shirt by Bobo Choses"      겹침 0
C15  「보보쇼즈 26FW BC 엠보싱 트렉슈트 바람막이 자켓 B226AC117 | 머스트잇」
     ↔ 원상품 "B.C. Embossed tracksuit jacket"                 겹침 0
```

🔴 즉 `NO_TITLE_OVERLAP` 이 **「다른 상품이다」가 아니라 「언어가 달라 비교 불가」** 인데
**「관측된 차이」로 분류** 돼 있다. 🟡 WU-045 의 `SIZE_SYSTEM` 과 **정확히 같은 계열** 이다
(그때는 「사이즈 라인 차이는 단독으로 SAME 을 막지 않는다」로 비차단 처리했다).

---

## 5. 🟡 결합 CF — 국내 EXACT 가 **처음으로 1건** 생긴다

```
색상 복구 **+** `NO_TITLE_OVERLAP` 비차단
  C47 biskuit.kr (Human **SAME**)   COMPARISON → **EXACT**
      blockers 전[NO_TITLE_OVERLAP+BRAND_UNCONFIRMED] → 후[BRAND_UNCONFIRMED]
  EXACT 12 → **13** (SAME 11→**12** · DIFFERENT 1→**1**)
  🟢 Human SAME 회복 **1** · 🟢 **False SAME 증가 0** · precision 91.7% → **92.3%**
```

🔴🔴 **그래도 구현하지 않았다 — 이유 셋**:
```
① 색상 출처가 **meta description 산문** 이다 → WU-047 이 **6 안전기준 미달** 로 HOLD 한 자리
② `NO_TITLE_OVERLAP` 비차단은 **MI blocker 완화** 다 → CPO STEP 9 가 금지한 범위
③ **N=1** 이다 — 분모 하나로 전략 판단을 하지 않는다(§5-B)
```

---

## 6. STEP8 — 국내 **Case A** 확보 여부

```
🔴 **없다.** 품번 + 색상이 둘 다 확인되고 Human SAME 인 국내 후보가 **0건** 이다.
   🔴 **합성하지 않았다**(CPO 지시). 그리고 이제 그 이유가 구조로 설명된다:
     한국어 제목 후보 → NO_TITLE_OVERLAP 로 영구 차단
     영어 제목 후보(C23·C24) → Human **DIFFERENT**
   ⟹ 표본에 「국내 EXACT 가 될 자격이 있는 Human SAME」이 **구조적으로 없다**.
```

---

## 7~8. 변경 파일 / 변경 내용

```
운영 코드 변경  **0**  (가격·시장·MI·Registry·해외 집계 전부 미변경 — STEP 9 준수)
테스트          wu-064-color-evidence.test.ts **5건** 신규
                ① 색상 단독 복구 CF + 결합 CF (GT 캐시 게이트)
                ②~⑤ 🔴 **생산자 계약** — `productFactsFromListing` 을 **직접 호출**
```

---

## 9. 🔴🔴 Mutation — **첫 시도에서 M1·M2·M3 가 전부 통과했다 (진짜 가드 공백)**

```
🔴 원인: 내 counterfactual 들이 **캐시된 facts(출력)** 를 읽어서
   생산자(`productFactsFromListing`)를 변조해도 **잡지 못했다.**
   §5-B 의 「운영 «함수» 를 부른다」를 내가 어긴 것이다.
🟢 생산자를 직접 호출하는 단언 4개를 추가해 구멍을 막았다.
```

baseline **34 passed** · 변형마다 원상복구

| | 변형 | 보강 전 | 보강 후 |
|---|---|---|---|
| M1 | 색상 evidence 제거(`color = null`) | 🔴 통과 | 🟢 **3 failed** |
| M2 | 고정 색상 주입(`"Grey Melange"`) | 🔴 통과 | 🟢 **3 failed** |
| M3 | 임의 텍스트를 색상으로(`title.slice(0,12)`) | 🔴 통과 | 🟢 **1 failed** |
| M4 | `NO_TITLE_OVERLAP` 비차단 | 🟢 2 failed | 🟢 **2 failed** |
| — | 원상복구 | — | 🟢 **34 passed** |

🔴 **M5(C06 재현)는 WU-060 계약이 이미 들고 있다** — 이 파일에서 중복하지 않았다.

---

## 10~12. Regression / Typecheck / Build

```
회귀      apps/admin  **571 files / 8,256 passed** / failed 0 (skipped 94)
typecheck **0 errors**
build     **exit 0**
해외 회귀  WU-049 · 056 · 056-R1 · 062 계약 **전건 유지**
```

---

## 13. Production

```
🔴 운영 코드 변경 **0** ⟹ UI 변경 **0** ⟹ Production 거동 불변
외부 API 0 · 외부 HTTP 0 · 키 0 · 결제 **₩0** · Gemini 잔액 ₩3,171 보존
```

---

## 14. 🔴 Known Unknowns

```
① 🔴 **분모 17** · GT 51 · 원상품 호스트 2개. 전수 498 값이 아니다
② 🔴 결합 CF 의 이득이 **N=1**(C47) 이다 — 일반화하지 않는다
③ 🔴 `NO_TITLE_OVERLAP` 을 비차단으로 바꿨을 때의 **전수 False SAME 영향** 은
   GT 51 에서만 쟀다(증가 0). 다른 표본에서 어떤지는 **미측정**
④ 🔴 한국어↔영어 제목의 **토큰 정규화**(번역·음역 매칭)는 **조사하지 않았다** —
   그것은 새 매칭 축이고 이번 범위 밖이다
⑤ 🔴 국내 샵이 색상을 **옵션 UI(JS 렌더)** 로만 노출하는지는 미확인(캐시 HTML 기준)
```

---

## 15. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

---

## 16. CEO Action

**없음.** 운영 코드·UI 변경이 **0** 이다.

---

## 17. 최종 판정 — 🔴 **HOLD** (색상은 원인이 아니었다)

### 🔴 CPO 판정 요청 — 1건

| 안건 | 내용 | CTO 권고 |
|---|---|---|
| **`NO_TITLE_OVERLAP` 재분류** | 한국어↔영어 제목에서 「관측된 차이」가 아니라 **「비교 불가」** 로 볼 것인가 (WU-045 `SIZE_SYSTEM` 선례) | 🟡 **조사 WU 를 권고** — GT 51 에서 FP 증가 0 이지만 **N=1 이득** 이라 더 큰 표본이 선행돼야 한다 |

🔴 **그리고 다음 두 가지는 제안하지 않는다**(측정으로 닫혔다):
```
❌ 색상사전 확대 — "Graystone" 을 읽어도 **tier 가 안 바뀐다**(효과 0 · WU-044 금지)
❌ meta description 색상 채택 — 효과가 `NO_TITLE_OVERLAP` 완화와 **결합할 때만** 나고
   그 자체는 WU-047 이 HOLD 한 자리다
```

🟢 **WU-063 → WU-064 로 원인이 한 겹 더 내려갔다**:
```
「가격이 안 잡힌다」(반증)  →  「색상이 없다」(반증)  →  **「제목 언어가 다르다」**
```
