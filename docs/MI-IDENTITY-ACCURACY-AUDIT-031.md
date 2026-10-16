# WU-031 — AI 후보 → MI Identity 정확도 감사

> 🔴 **측정 전용 WU 다.** MI 로직·threshold·색상사전·PRESUMED_SAME 정책은 **한 줄도
> 바꾸지 않았다.** AI 호출 **0** · 비용 **₩0** · 국내 HTTP **51 요청**(후보 페이지 재관측).
> 🔴 발견된 **표시 버그 1건만** 고쳤다(§12) — MI 가 아니라 직렬화다.

---

## 1. 무엇을 쟀나 — 그리고 GT 를 어디서 가져왔나

🔴🔴 **AI 의 판단을 정답으로 쓰지 않았다**(지시서 §3). GT 는 `mi-022-gt.json` 의
**사람이 확정한 SAME/DIFFERENT** 이고, 후보 URL 자체도 AI confidence 도 reason 도
정답 축에 **넣지 않았다.**

```
입력   mi-017-e2e-cases.json (원상품 6) × mi-022-gt.json (후보 51)
경로   운영 함수를 «그대로» 호출한다 — 복제식 0
       backfillCanonicalProduct → buildProductIdentityDna → productFactsFromIdentityDna
       → factsFromProductUrl(실제 HTTP) → withConfidence
       + compareCrossSellerProducts(origin, candidate)  ← axes 를 직접 읽기 위해
산출   $TEMP/mi-p0-02/wu-031-audit.json
```

🟢 **CONTROL PASS** — 이 하니스가 낸 KPI 가 기록된 WU-022 값과 **정확히 일치**한다
(n=51 · Precision 1.000 · False SAME 0 · 미연결 14). 🔴 「돌았다」가 아니라
**「운영이 낸 그 값이 재현된다」** 로 세운 게이트다(헌장 §5-B).

🔴 **`axes` 는 `withConfidence` 결과에 실리지 않는다** — `match.ts:539-548` 이
verdict/reasons/blockers/conflicts **넷만** 펼친다. 처음에 `crossSellerAxes` 라는
**없는 칸**을 읽어 전건 「정보 없음」이 나왔다. WU-013 이 적어 둔 그 함정을 또 밟았고,
owner 타입을 읽어 고쳤다.

---

## 2. KPI — 전수(n=51), 표본 아님

| | 값 |
|---|---|
| 측정 가능 / 전체 | **51 / 51** (측정불가 0) |
| GT SAME | 24 |
| GT DIFFERENT | 27 |
| MI 가 SAME 으로 연결 | **10** |
| **SAME MISS** | **14 (58.3%)** |
| **False SAME** | **0 (0.0%)** |
| **MI SAME 의 Precision** | **1.000** |
| 전체 정확도 | 0.725 |

🟢 **Precision 우선 원칙이 지켜지고 있다** — GT DIFFERENT 27건 중 SAME 으로 올라간 것이
**하나도 없다**(CONFLICT 10 · PRESUMED_SAME 14 · SIMILAR 3).

---

## 3. 🔴🔴 핵심 발견 — MISS 14건은 「틀렸다」가 아니라 「못 봤다」 다

지시서 §6 대로 **UNKNOWN 과 MISMATCH 를 합치지 않고** 셌다:

| 연결고리 | MATCH 아님 | 그중 **MISMATCH**(다르다고 관측) | **UNKNOWN / NOT_AVAILABLE**(확인 못 함) |
|---|---|---|---|
| brand | 10 | **1** | 9 |
| color | 9 | **0** | 9 |
| title | 4 | **4** | 0 |
| category | 4 | **0** | 4 |
| modelCode | 2 | **0** | 2 |

🔴🔴 **실제 「불일치」로 관측된 것은 5건뿐이고(brand 1 + title 4), 나머지 24개 연결고리는
전부 «정보가 없어서» 비었다.** MI 는 모순된 증거를 보고 틀린 것이 아니라, **증거가 없어서
승격을 보류했다.**

🟢 그 보류가 얼마나 아슬아슬한지가 결정적이다 — **MISS 14건 중 13건이 `PRESUMED_SAME`**
이다(나머지 1건만 `SIMILAR`). 즉 MI 는 이미 「아마 같다」까지 와 있고 **한 축이 모자라서**
SAME 을 안 준다. 🔴 그 한 축을 문턱으로 메우는 것이 바로 §15 가 금지한 행위다.

### 어느 쪽에 정보가 없나 — 후보 쪽이다

```
색상 미연결 9건  → 원상품만 없음 0 · **후보 쪽에만 없음 9** · 둘 다 없음 0
브랜드 미연결 10 → MISMATCH 1 · 원상품만 없음 4(전부 S6) · **후보 쪽에만 없음 5**
후보 51건 추출 성공률 — brand 43/51(84%) · **color 28/51(55%)**
```

🔴 **가장 약한 고리는 색상 추출(55%)** 이고, 그 9건이 **전부 SAME MISS 로 이어졌다.**

---

## 4. 원인 분류 — Case 1 / Case 2 를 섞지 않는다 (지시서 §9)

```
Case 1 정보 부족·추출 문제   **14 / 14**
Case 2 MI 로직 문제            **0 / 14**
```

🔴 **「MI 로직 1건」은 내 집계 오류였다.** 처음엔 S6 의 bobochoses.com 건(5축 전부 MATCH ·
8축 채점 · confidence 1.0 인데 `PRESUMED_SAME`)을 Case 2 로 올렸는데, 그 판단 근거였던
blocker 가 `"[object Object]"` 로 찍혀 있었다. 값을 제대로 꺼내 보니
**`BRAND_UNCONFIRMED`** 였고 — **S6 는 원상품 brand 가 `null`** 이다(`.co.jp` 스토어).
🟢 즉 그 건도 **정보 부족** 이고, MI 는 정확히 설계대로 동작했다.

🔴🔴 **같은 버그가 운영 화면에도 있었다** → §12.

### 상품별 분해

| 원상품 | GT SAME | 연결 | MISS | GT DIFF | False SAME | MISS 보류 사유 |
|---|---|---|---|---|---|---|
| S1 Bobo Choses B226AC010 | 4 | 3 | 1 | 5 | 0 | BRAND_UNCONFIRMED 1 |
| S2 Bobo Choses B226AC009 | 5 | 3 | 2 | 4 | 0 | BRAND_MISMATCH 1 · NO_TITLE_OVERLAP 2 |
| S3 Bobo Choses B126AI018 | 5 | 1 | 4 | 3 | 0 | BRAND_UNCONFIRMED 2 · MATERIAL 1 |
| S4 Main Story AW26MS185 | 4 | 1 | 3 | 9 | 0 | BRAND_UNCONFIRMED 2 · SIZE_SYSTEM 1 |
| S5 Pèpè Shoes | 2 | **2** | 0 | 3 | 0 | — |
| S6 Bobo Choses B226AC117 | 4 | **0** | 4 | 3 | 0 | BRAND_UNCONFIRMED 4 · NO_TITLE_OVERLAP 2 |

🔴 **S6 가 0/4 인 이유가 하나로 설명된다** — 원상품 brand 가 null 이라 **모든 후보에서
브랜드 축이 영구히 죽는다.** 헌장에 이미 기록된 「브랜드 공백」 문제의 직접 재현이다.

---

## 5. 병목 판정 — A / B / C

> **C (혼합). 단 「MI 로직」은 병목이 아니다.**

```
A  AI 후보 품질     🟡 후보 51 중 실제 SAME 24(47%) — 🔴 그러나 MISS 14건은
                      **전부 «맞는» 후보** 에서 났다. A 는 MISS 의 원인이 아니다
B  MI 연결          🔴 겉보기 병목(24 → 10) — 🟢 **그러나 MI 로직 결함 0**
C  진짜 병목        🔴🔴 **후보 페이지에서 상품 정보를 추출하지 못하는 것**
                      색상 55% · 브랜드 84% · 그리고 원상품 브랜드 공백(S6)
```

🔴 **「MI 를 고치면 된다」로 읽으면 틀린다.** 고칠 자리는 MI 판정기가 아니라 **후보 쪽
ProductFacts 를 채우는 추출 경로** 이고, 원상품 브랜드 공백은 **그 앞단** 이다.

---

## 6. 🔴🔴 그런데 그 수정을 «지금» 하지 않는다 — HOLD

가장 큰 레버(브랜드 9건)의 가장 뻔한 수정은 **이미 측정으로 위험이 확인돼 있다**:

```
🔴 og:site_name 을 브랜드로 쓰는 안 → WU-009 가 **반증** 했다
   우리 원본 도메인 25/26 이 멀티브랜드 리테일러다
   → 「Smallable」·「Junior Edition」이 브랜드로 박히고 **거짓 일치/거짓 충돌이 늘어난다**
```

🔴 지시서 §13 이 정확히 이 경우를 지정한다 — **「해결책이 불명확하거나 False SAME 위험이
있으면 구현하지 않고 HOLD 한다.」** 현재 False SAME 은 **0** 이고, 그것이 이 제품의 가장
비싼 자산이다. 🔴 Recall 58.3% 를 되찾자고 Precision 1.000 을 거는 교환은 하지 않는다.

### 🟡 다음 WU 에 올릴 후보 (전부 CPO 결정 · CTO 가 고르지 않았다)

```
① 색상 추출 보강 — 후보 51 중 28(55%)만 색상을 준다. 🟢 **추가 HTTP 0**
   (이미 받은 HTML 안에 있다) · 🔴 단 색상 «사전» 확대는 §15 금지라 축이 다르다
② 원상품 브랜드 공백 — S6 처럼 brand=null 이면 4/4 전건이 죽는다.
   🔴 해결책이 Registry 성격이라 §12-0 과 만난다(WU-009 ⒝ 와 같은 자리)
③ 🔴 아무것도 하지 않는다 — Precision 1.000 을 그대로 둔다
```

---

## 7. 금지 7항 전수 대조 (지시서 §15)

```
MI threshold 완화              변경 0
색상 dictionary 확대           변경 0
PRESUMED_SAME → SAME 승격      변경 0
UNKNOWN → SAME 승격            변경 0
AI verdict 를 MI 근거로 사용    0 (GT 에도 입력에도 쓰지 않았다)
AI confidence 를 SAME 근거로    0
False SAME 감수한 recall 확대   0  — 🟢 False SAME 은 여전히 **0**
```

---

## 8. 🔴 운영 결함 1건 — 찾았고, 고쳤다 (MI 아님)

```
`crossSellerBlockers` 는 `{ blocker }` **객체 배열** 인데(types.ts:95)
run-domestic-price-check.ts:1274 가 `String(b)` 로 옮기고 있었다
→ **`"[object Object]"`**
→ 일시 후보 구역의 **「보류 근거」로 셀러 화면에 그대로 출력**되고 있었다
   (WU-024 가 심었고 WU-027~030 배포로 **Production 에 떠 있었다**)
```

🟢 **판정 영향 0** — 표시 전용 칸이고, 보류 자체는 `compareCrossSellerProducts` 가
이미 verdict 에 반영했다. 🟢 하위호환(문자열이 오던 경로도 통과).
🟢 회귀 2건 추가(서버 계약 + 마운트 DOM) · 변이 M1(원코드 복귀) **1 FAIL** · 복구 27 passed.

🔴 이것은 지시서 범위 밖이지만 **내가 심은 버그이고 셀러 화면에 보이던 것** 이라
숨기지 않고 같이 닫았다(헌장 §13).

---

## 9. 검증

```
Positive      감사 하니스 PASS · CONTROL(WU-022 KPI 전건 재현) PASS
Negative      변이 M1 → 1 FAIL · 원상복구 27 passed
Regression    admin **552 files / 8,086 passed · failed 0**
Typecheck     0 (baseline 10 이하)
Build         exit 0
Deploy        🟢 `e813ef60` — 빌드 로그 `Commit: e813ef6`
Production    GET / **200** · /api/price-history/check **401**(정상 보호)
Git           clean · behind 0 / ahead 0
```

---

## 10. 최종 판정

```
측정            🟢 PASS — 전수 51 · 측정불가 0 · CONTROL 재현
원인 확정       🟢 **Case 1(정보 부족/추출) 14 / Case 2(MI 로직) 0**
병목            🔴 **C 혼합 — 실질 병목은 «후보 페이지 정보 추출»**
MI 코드 변경    🟢 **0** (§13·§15 준수)
표시 버그       🟢 FIX + 배포 완료
──────────────────────────────────────────
**HOLD** — 다음 레버는 전부 False SAME 위험을 동반하므로 CPO 정책 판정 사안이다
```

🔴 **CEO Action: NONE.**
