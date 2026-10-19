# WU-094 — `matchLevel very_high` 의미/사용처 검증 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-19. 「**현재 SAME 판정을 변경하지 않고** `very_high` 가 실제로
> 무엇을 의미하는지 확정한다.」 · §5 금지 11항 · 「**코드 변경 필요 없으면 0줄로 종료**」

---

# WU-094 FINAL

## 0. 결론 — 🔴🔴🔴 **그 값은 지금 «신뢰할 수 없다». 운영 결함이다**

```
CPO 의 세 질문에 답하기 «전에» 나온 사실:
   WU-093 의 `very_high 5/5` 는 **텍스트 유사도가 높아서가 아니다.**
   `extractSlug` 가 **경로의 마지막 세그먼트** 를 쓰는데 Cafe24 상품 URL 은
   전부 `…/display/**1**/` 로 끝나서 **slug 가 서로 「1」로 같아진다.**
   그러면 `score = Math.max(score, 0.95)` 바닥값이 **무조건** 발화한다.
🔴 **counterfactual: 그 바닥값만 끄면 conf 0.95 → 0.1 / 0.0 이다.**
⟹ 🔴 그 5건의 **진짜 텍스트 점수는 0.1 이하** 이고 전부 `low` 여야 한다.
```

## 1. STEP 1 — owner 전수

### 생산자 — **confidence 하나의 순수 함수**
```
scoreCandidateMatch → confidence → classifyMatchLevel(match.ts:316)
   ≥0.95 very_high · ≥0.85 high · ≥0.70 medium · 그 외 low
🟢 운영 로그가 이 값을 **「입력 텍스트등급」** 이라 부른다(match-provenance.ts:125)
```
🟢 **실행으로 확인**: `0.9499→high · 0.95→very_high · 0.85→high · 0.7→medium · 0.69→low`.
⟹ **동일성 판정이 아니라 텍스트 점수의 구간 이름** 이다.

### 🔴 소비처 **여섯** — 생각보다 넓다
| # | 위치 | 하는 일 |
|---|---|---|
| ① | `toDomesticMatchType` | 🔴 `very_high → matchType **EXACT**, autoVerified **true**`(초기값) |
| ② | `selectCandidatesForDetailConfirmation:51` | 가격 **상세확인 자격**(= 외부 HTTP 비용) |
| ③ | `run-domestic-price-check:872·969` `foundVeryHighInP0` | 🔴🔴 **Gemini 호출을 스킵**(WU-016 게이트) |
| ④ | `:364` `isEvidenceEvaluationWorthwhile` | `matchLevel !== "low"` 면 증거평가 진행 |
| ⑤ | `attach-match-truth:101` | `deriveMatchTruth` 의 **첫 인자** |
| ⑥ | `ComparisonShopSearch.tsx:83` | 🔴 해외 폴백에서 `very_high → tier **"SAME"**` 표시 |

🟢 ①은 **초기값** 이다 — `:693 let matchType = initialMatchType` 뒤에 `matchTruth` 가 덮는다.

## 2. STEP 2 — WU-093 GT 10건 교차 (🔴 **N=10 · 1상품 2건 · 일반화 금지**)

| matchLevel | 합 | human SAME | human DIFF | verdict SAME | SIMILAR | CONFLICT | UNKNOWN |
|---|---:|---:|---:|---:|---:|---:|---:|
| **very_high** | **5** | **2** | 🔴 **3** | 0 | 3 | 2 | 0 |
| high / medium | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| low | 5 | 0 | 5 | 0 | 0 | 1 | 4 |

🔴 **`very_high` 자체의 정밀도는 2/5 = 40%** 다(= FP 60%).

### 전수
```
S1-1 conf 0.95 very_high → EXACT(초기) truth TEXT_CONFIRMED  verdict SIMILAR  가격자격 🟢 human SAME
S1-2 conf 0.95 very_high → EXACT(초기) truth CONFLICT        verdict CONFLICT 가격자격 🔴 human DIFFERENT
S1-3 conf 0.95 very_high → EXACT(초기) truth CONFLICT        verdict CONFLICT 가격자격 🔴 human DIFFERENT
S1-4 conf 0.95 very_high → EXACT(초기) truth TEXT_CONFIRMED  verdict SIMILAR  가격자격 🟢 human SAME
S1-5 conf 0.95 very_high → EXACT(초기) truth TEXT_CONFIRMED  verdict SIMILAR  가격자격 🔴 human DIFFERENT
S2-1 conf 0.03 low · S2-2~5 conf 0 low → 전부 NOT_MATCHED · human DIFFERENT
matchTruth 분포 {TEXT_CONFIRMED 3 · CONFLICT 3 · INSUFFICIENT_EVIDENCE 4}
```
🟢🟢 **`matchTruth` 가 EXACT 를 하나도 내지 않았다** ⟹ 거짓 `very_high` 가 **최종 판정에는
닿지 못했다**(깊이방어 작동 · False SAME **0**). 🔴 단 「안전하다」가 아니라
**「다른 축이 막아 줬다」** 다.

## 3. STEP 3 — 🔴 모집단 셋을 **섞지 않는다**

| 모집단 | very_high | low | 출처 |
|---|---:|---:|---|
| ① AI URL 후보 | 0 | **64/64** | WU-088 |
| ② Registry 검색 후보 | **1** | 173(+medium 1) | WU-017 (후보 175) |
| ③ WU-093 CEO 검증 후보 | **5** | 5 | 이 WU |

🔴🔴 **③이 유별난 이유는 «모집단 차이» 가 아니라 «버그» 였다.** WU-093 이 「분모가
다르다」로 적은 것을 **정정한다** — ③의 `very_high` 는 Cafe24 URL 모양이 만든 거짓값이다.

## 4. STEP 4 — 가격비교 경로 도달

```
very_high 5 → 상세확인 자격 **2** (상한 MAX_DETAIL_CONFIRMATIONS_PER_SHOP=2 가 **발화했다**)
🔴 WU-088 의 「상한 발화 **0**」과 다르다 — 그쪽은 자격 필터에서 전건 탈락했다(모집단 차이)
```

🔴🔴 **그 2건이 Human SAME 2건과 일치했지만 «rank 가 가른 것이 아니다»**:
```
deriveProductMatchTruth = EXACT_PRODUCT 가 **3건**(S1-1 · S1-4 · 🔴 **S1-5**)
⟹ 셋이 **rank 동률** 이고 안정정렬이라 **배열 앞의 둘** 이 뽑혔다.
⟹ 🔴 **검색 결과 순서가 바뀌면 Human DIFFERENT(S1-5)가 그 칸에 앉는다.** 운이었다.
```
🔴 「precision 2/2」로 적지 않는다.

## 5. 🔴🔴🔴 근본 원인 — `extractSlug` 의 마지막 세그먼트

```ts
// match.ts:81
const segments = pathname.split("/").filter(Boolean);
const last = segments[segments.length - 1];        // 🔴 **마지막 칸**
```
```
원상품  /product/보보쇼즈-허그-헤어리-몬스터-티셔츠-b226ac009/8891/category/367/display/**1**/
후보    /product/보보쇼즈-베이비-허그헤어리몬스터티셔츠-76a7d-l30-05/11453/category/28/display/**1**/
⟹ 양쪽 slug 가 **"1"** ⟹ `querySlug === candidateSlug` **항상 참**
⟹ match.ts:477 `score = Math.max(score, 0.95)` **무조건 발화**
```
🟢 **증거가 화면에 이미 있었다** — `reasons` 가 **「모델명 유사도 0%」와 「URL slug 일치」를
동시에** 적고 있다. 🔴 두 문장은 같이 설 수 없다.

🟢 **WU-076 이 같은 성질을 이미 기록했다** — 「Cafe24 는 `…/display/1/` 꼬리표라 경로
마지막 칸을 바꿔도 **같은 상품** 이 온다」. 🔴 그때는 **CONTROL 설계 문제** 로만 읽었고
**운영 점수 경로에 같은 함정이 있다는 것을 보지 못했다.**

### 분모 (저장된 후보 URL 전수 · N=4,259)
```
마지막 세그먼트 유형 — 고유문자열 3,927 · **숫자 157** · 빈값 175
🟢 빈값은 `extractSlug` 가 null 을 주므로 **발화하지 않는다**
🔴 숫자 중 값 **"1" 이 26건** ⟹ 그 26건끼리 서로 「slug 일치」로 판정된다
   호스트: looxloo 20 · biskuit 19 · miniboutique 18 · mustit 17 · littleluna 19 ·
           luxboy 9 · wconcept 3  ⟹ 🔴 **전부 한국 쇼핑몰** 이다
🟢 해외(Shopify handle 등)는 고유 문자열이라 **이 함정에 걸리지 않는다**
🔴 「404」 25건은 WU-076 의 probe URL 이라 **운영 분모가 아니다**(노이즈로 표시)
```

## 6. 🔴 CPO 세 질문의 답

```
A. very_high 가 단순 ranking 신호인가?
   🟡 **설계상 그렇다**(confidence 구간 이름). 🔴 **그러나 지금 그 값 자체가 틀렸다** —
      Cafe24 계열에서 **텍스트 점수와 무관하게** 0.95 로 올라간다.
B. 가격비교에 유용한 «독립» 신호인가?
   🔴 **NO.** 이 표본에서 자격을 준 2건은 **거짓 very_high** 가 만든 자격이고,
      둘이 Human SAME 이었던 것은 **배열 순서** 때문이다.
C. SAME 판정과 결합할 «안전한» 근거가 있는가?
   🔴🔴 **NO.** very_high 자체의 정밀도가 **2/5(40%)** 이고, 그 값이 **거짓** 이다.
      ⟹ CPO 의 선언대로 **SAME 로직에 넣지 않는다.**
```

## 7. 🔴 구현하지 않았다 — **CPO 판정 사안**

```
🔴 이 결함을 CTO 가 임의로 고치지 않는다. 영향이 **여섯 소비처** 에 걸치고 그중 둘은
   비용·탐색 정책이다:
   ② 가격 상세확인 자격 → 외부 HTTP **비용**
   ③ `foundVeryHighInP0` → 🔴🔴 **거짓 very_high 가 Gemini 호출을 막는다**(WU-016 게이트)
🔴 §5 금지 목록에 `extractSlug` 는 **없지만**, WU-094 의 지시는
   「owner/데이터 검증을 먼저 하고 **필요할 때만 이후 구현을 결정**」 이다.
🟢 그래서 **운영 코드 0줄** 로 종료한다.
```

## 8. 검증

```
운영 코드 변경 **0** · 배포 0 · DB 0 · AI 0 · Registry 0 · 8축 0 · UI 0 · 가격 정책 0
🟢 CF 는 **복구를 확인했다** — `git status` 로 `match.ts` **무변경** 단언
typecheck **0**(🔴 한때 1 — `reduce` 누적 타입 미명시)
apps/admin **598 files / 8,354 passed** · failed **0**
```

---

## 🔴 Known Unknowns

```
① 🔴 **표본 N=10 · 1상품 2건 · 1샵.** `very_high` 정밀도 40% 를 전체 지표로 쓰지 않는다
② 🔴 **분모 4,259 는 「저장된 측정 산출물」** 이다 — 운영 전수 트래픽이 아니다
③ 🔴 「숫자 157건」 중 실제로 **서로 충돌해 0.95 를 만든 쌍의 수** 는 세지 않았다
   (쌍 비교가 필요하고 이 WU 범위 밖이다)
④ 🔴 `extractSlug` 가 **다른 경로**(자기참조 판정 등)에서도 같은 오류를 내는지 **미측정**
⑤ 🔴 WU-017 의 `very_high 1/175` 가 **같은 원인인지** 확인하지 않았다(그 데이터가 없다)
⑥ 🔴 ③ Gemini 게이트가 **실제로 몇 번 거짓 스킵했는지** 는 flag OFF 라 **측정불가**
⑦ 🔴 「올바른 slug 추출」이 무엇인지 **정의하지 않았다** — 그것은 설계이고 CPO 영역이다
```

## 판정 — 🔴 **결함 보고 / 구현 0 · CPO 판정 대기**

```
🔴 C 는 명확히 **NO** 다 — `very_high` 를 SAME 로직에 결합하지 않는다
🔴 그리고 그 전에 **값 자체가 틀렸다** — 이것이 이 WU 의 핵심 산출이다
🟢 다행히 **False SAME 은 0** 이다. `matchTruth` 가 막았다(깊이방어)
🔴 그러나 비용(②)과 탐색(③)에는 **이미 영향을 주고 있을 수 있다**
```

## CEO Action — **없음**
