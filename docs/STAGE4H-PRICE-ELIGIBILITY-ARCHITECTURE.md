# STAGE 4-H — SELLER DECISION / PRICE ELIGIBILITY ARCHITECTURE REVIEW (2026-11-04)

> 🔴 **분석 전용.** 운영 코드 **0** · A 구현 **0** · B 구현 **0** · 점수/threshold **0** ·
> 계약 수정 **0** · Legacy GT **0** · 가격/Search/UI/DB/Migration **0** · **네트워크 0 · 과금 0**.
> 기준 HEAD **`dfde2009`** · 작업트리 clean · `cross-seller.ts` md5 `212b5904…` **불변**.
> 🟢 사슬은 **운영 함수를 직접 불러** 고정했다 — `stage4h-price-eligibility-coupling.test.ts`(11건).

---

## 0. 핵심 질문의 답

> **「동일상품이 100% 확정되지 않아도, 후보를 보존하면서 셀러가 신뢰할 수 있는 가격 비교를
> 제공하려면 현재 구조에서 무엇을 분리해야 하는가?」**

```
🟢🟢 분리해야 하는 것은 «하나» 다 —  **「후보 노출 등급」과 「가격 eligibility」가
     `matchTruth` 한 칸을 공유하는 것.**

matchTruth ──┬─ priceTierFromLink      → 가격 eligibility   (EXACT/COMPARISON/REFERENCE/EXCLUDED)
             ├─ domesticMatchDisplay   → 화면 배지(가능성)   (SAME/PRESUMED_SAME/SIMILAR/UNKNOWN)
             └─ isDefaultVisibleTier   → **기본 노출 여부**
```
🔴 그래서 **「추정 근거를 거두는」 변경이 자동으로 「후보를 화면에서 내리는」 변경이 된다.**
🟢 그리고 **CPO 가 원하는 4단계 신뢰도 분리는 이미 코드에 있다**(§1) — 없는 것은
   **「후보로는 보존 · 가격으로는 불가」를 «동시에» 말하는 자리** 하나다.

---

## 1. 조사 ① — 판정별 가격 비교 가능 범위 (owner 를 호출해 확정)

`priceTierFromLink`(domestic-product-link.ts:86) — **전수 매핑**:
```
EXACT_IDENTIFIER | STRONG_IDENTIFIER → EXACT
TEXT_CONFIRMED                        → COMPARISON
SIMILAR                               → REFERENCE
CONFLICT | INSUFFICIENT_EVIDENCE      → EXCLUDED
그 외(null)                           → verified ? EXACT : **COMPARISON**   ← 🔴 폴백 기본값
```

| cross-seller verdict | matchTruth | **tier** | 가격 «판정» 입력 | 국내 버킷 | 해외 집계 | 기본 노출 |
|---|---|---|---|---|---|---|
| **SAME** | STRONG_IDENTIFIER | **EXACT** | 🟢 **O (유일)** | 🟢 O | 🟢 O | 🟢 O |
| **PRESUMED_SAME** | TEXT_CONFIRMED | **COMPARISON** | 🔴 **X** | 🟢 O | 🟢 O | 🟢 O |
| **SIMILAR** (level low) | INSUFFICIENT_EVIDENCE | **EXCLUDED** | 🔴 X | 🔴 **X** | 🔴 X | 🔴 **X** |
| SIMILAR (level high+) | SIMILAR | REFERENCE | 🔴 X | 🔴 **X** | 🟢 **O** | 🟢 O |
| CONFLICT | CONFLICT | EXCLUDED | 🔴 X | 🔴 X | 🔴 X | 🔴 X |

🟢🟢 **CPO 의 4단계가 이미 존재한다**:
```
동일상품 가격        = tier EXACT       (판정 입력 O)
동일상품 «추정» 가격  = tier COMPARISON  (🔴 판정 입력 X · 표시 O)   ← PRESUMED_SAME
유사상품 참고 가격    = tier REFERENCE   (🟡 해외만)                 ← SIMILAR
가격 비교 불가       = tier EXCLUDED
```
🟢 그 분리는 **CPO 결정으로 코드에 박혀 있다** — `market-intelligence.ts:747`
「**가격판정 입력은 EXACT 뿐이다**」(MI-7/P0-2 · 2026-09-26) ·
`computePriceDecision`·`computePriceRecommendation` 둘 다 `domesticBasis !== "EXACT"` 를 본다.
🔴 단 **표시용 `resolved` 는 EXACT 가 없으면 COMPARISON 으로 폴백** 한다(:752) ⟹
   셀러가 보는 «숫자» 만으로는 둘을 구별할 수 없다(🟢 `domesticBasis` 가 같이 전달된다 :824).

---

## 2. 조사 ② — Generic-only 후보의 후보 목록 보존 여부 🔴🔴 **보존되지 않는다**

운영 후보의 `matchLevel` 은 **전건 low** 다(WU-088 실측 64/64). 그 조건에서 A 를 적용하면:

```
A 적용 → crossSeller **PRESUMED_SAME → SIMILAR**
       → deriveMatchTruth 의  `if (crossSeller === "SIMILAR") return textOnly`
       → textOnly(level low) = **INSUFFICIENT_EVIDENCE**        ← 🔴 SIMILAR 가 «아니다»
       → priceTierFromLink → **EXCLUDED**                        (가격 축에서 완전 제거)
       → domesticMatchDisplay → **TIERS.UNKNOWN**
       → mayShowCandidate ①  `!isDefaultVisibleTier("UNKNOWN")` → **false**
⟹ 🔴🔴 **기본 화면에서 내려간다**(「더 보기」 뒤) · 🔴 **참고 가격도 되지 못한다**
```
🟢 계약으로 고정했다 — `H-1`~`H-4`(운영 함수 직접 호출).

🔴🔴 **그래서 A 는 CPO 의 정제된 요구를 «현재 형태로는» 충족하지 못한다.** CPO 문장:
> 「Generic-only 는 SAME/PRESUMED_SAME 의 근거로 인정하지 않되, **검색 후보와 SIMILAR
> 참고 정보는 보존해야 합니다**」

A 는 그 후보를 **SIMILAR 로 내리는 것처럼 보이지만, 실제 도착지는 UNKNOWN/EXCLUDED** 다.
🟢 원인은 A 가 아니라 **`deriveMatchTruth` 의 `SIMILAR → textOnly` 한 줄** 이다
(P0-A.29-F R1 · 2026-09-20 · 「SIMILAR 은 «닮았다» 가 아니라 «반증이 없다»」).
🔴 **그 줄은 올바르다** — 그때 국내 후보 18건 중 10건이 그 경로로 「비교 가능한 유사상품」이
되어 화면에 섰고 전부 다른 신발이었다(실측 기록). **완화하면 그 사고가 돌아온다.**

🔴 **측정불가** — 그 9건의 `confidence` 가 운영 fixture 에 **칸이 없다** ⟹
`mayShowCandidate` ③(`confidence ≥ 0.2`)에 몇 건이 걸리는지는 **재수집 없이는 알 수 없다**.
🟢 단 ①(`!isDefaultVisibleTier`)이 **먼저** 걸러내므로 ③까지 가지 못한다 — 그것은 확정이다.

---

## 3. 조사 ③ — 다른 색상·사이즈 후보의 가격 참고 처리

```
🟢 해외   `SAME_MODEL_OPTION_DIFF`(= SAME_MODEL_VARIANT) 등급이 **있다** ·
          기본 노출 **포함**(DEFAULT_VISIBLE_TIERS) · 배지 「같은 모델이지만 색상/사이즈 등
          옵션이 다릅니다 — **참고 가격**」 ⟹ CPO 전략과 **이미 일치**
🔴 국내   그 등급이 **구조적으로 존재하지 않는다** — `domesticMatchDisplay` 의 5분기에
          그 값이 없고, 주석이 이유를 적는다: 「국내에는 옵션 차이 데이터가 없다」
🟢 보류   `COLOR_VARIANT` 보류(WU-044)가 「색조 같음 + 이름 다름」을 **SAME 만** 막고
          CONFLICT 로 내리지 않는다 ⟹ **후보는 살아 있고 COMPARISON 으로 남는다**
🟢 비차단 `SIZE_SYSTEM` 은 WU-045 에서 **비차단** 이 됐다(사이즈 라인 차이는 SAME 을 막지 않는다)
```
🟢🟢 ⟹ **「다른 색상·사이즈 후보 보존」은 이미 전략대로 동작한다.** R2 가 B 를 NO-GO 로
닫은 것이 **그 보존을 지킨 것** 이다(B-2 는 그 보류를 없애 C25 를 EXACT 로 올렸다).
🔴 남은 비대칭 하나 — **국내에는 「옵션만 다름」 등급이 없다**(데이터 부재 · 코드 결함 아님).

---

## 4. 조사 ④ — p4 불변식이 보호하는 기존 기능 (R2 §2 요약 + 이번 추가)

```
보호 대상   MI-DISCOVERY-P4(e7bfca87) 변경 A 의 **과잉 차단 대조군**
근거        저장소 전제 「판매처마다 상품명이 다르다」 ⟹ 교차판매처 제목 불일치는 **정상**
보존 명시   그 커밋 「보존 확인」 목록에 `430700↔B226AC112 PRESUMED_SAME` 가 **이름으로** 있다
🔴 이번 추가 — 그 불변식이 지키는 것은 「판정」이 아니라 **「후보가 화면에 남는 것」** 이다
   (§2 사슬: PRESUMED_SAME 이 아니면 UNKNOWN 으로 떨어져 기본 노출에서 빠진다)
⟹ 🔵 **그래서 p4 불변식과 CPO 의 「Recall 우선」 전략은 «같은 것을 지킨다».**
   🔴 R2 는 그 둘을 「같은 축의 양 끝」이라 적었는데, 4-H 가 더 정확히 말한다 —
      **p4 가 지키는 것은 «노출» 이고 A 가 거두려는 것은 «추정 근거» 다.
      지금 그 둘이 한 칸을 공유해서 분리가 안 될 뿐이다.**
```

---

## 5. 조사 ⑤ — `crossSellerReserved` 와 CF-3 승격의 실제 역할

```js
// match-truth.ts:233
const crossSellerReserved = crossSeller === "PRESUMED_SAME";
if (!observedDifference && !crossSellerReserved && !colorUnverified) {
  if (modelCode === "exact")   return HIGH_OR_ABOVE.has(level) ? "EXACT_IDENTIFIER" : "STRONG_IDENTIFIER";
  if (modelCode === "partial") return "STRONG_IDENTIFIER";
}
```
🟢🟢 **`crossSellerReserved` 는 CPO 가 원하는 분리의 «구현체» 다** —
> 「**추정(PRESUMED_SAME)은 품번이 exact 여도 확정 가격(EXACT)이 되지 못한다.**」

🟢 계약으로 확인했다(`H-5`): `(low, exact, PRESUMED_SAME)` → **TEXT_CONFIRMED → COMPARISON** ·
대조로 `(low, exact, SAME)` → **STRONG_IDENTIFIER → EXACT**.

🔴 **CF-3 은 그 상한을 «푸는» 반사실** 이다(`dropReserve` → `PRESUMED_SAME` 을 `SAME` 으로 승격).
⟹ 🔴🔴 **CF-3 폐기와 CPO 의 신전략은 «같은 문장» 이다** — 「추정 가격을 확정 가격처럼
표시하지 않는다」. R2 실측이 그것을 재확인했다(CF-3 precision **62.5%** < 운영 **87.5%**).
🟢 즉 **CF-3 은 다시 열 이유가 없고**, 열 필요도 없다 — 추정 가격은 `COMPARISON` 으로
**이미 보존되고 표시된다**.

---

## 6. 조사 ⑥ — 후보 발견과 가격 eligibility 가 서로 영향을 주는가 🔴 **준다. 세 지점**

| # | 결합 지점 | owner | 성격 | 상태 |
|---|---|---|---|---|
| ① | `matchTruth` 한 칸이 **tier · 배지 · 기본 노출** 셋을 결정 | `deriveMatchTruth` → `priceTierFromLink` / `domesticMatchDisplay` | 🔴 **구조적 결합** | 🔴 미분리 |
| ② | `transientEvidenceSink` 가 **화면 배열이자 가격 집계 입력** · `priceTier` **필수** | `run-domestic-price-check` → `market-intelligence:226` | 🔴 결합 | 🔴 유지(WU-097 계약) |
| ③ | ⑧ `isEvidenceEvaluationWorthwhile`(**HTTP 비용** 게이트)가 노출까지 결정 | `run-domestic-price-check:376` | 🟡 결합이었다 | 🟢 **이미 분리됨** — 주석 「되살린 것은 「평가」가 아니라 **「표시」뿐이다**」(추가 HTTP 0) |

🟢🟢 **그리고 분리의 선례가 이미 있다** — `priceTierWithVerifiedSame`(:249):
> 「`priceTierFromLink` 는 손대지 않고 **그 산출 위에 자격을 «덮는» 별도 입력 경로**」 ·
> 「이 칸이 바꾸는 것은 `priceTier` **하나** 다. `matchTruth`·`verified` 는 건드리지 않는다」

🔵 ⟹ **①을 분리할 자리의 모양이 그 함수에 이미 있다**(🔴 CTO 는 구현하지 않았다).

---

## 7. 조사 ⑦ — UI 가 후보 가능성과 가격 신뢰도를 구분할 수 있는가 🟡 **반만**

```
🟢 후보 카드 쪽은 정확하다 — match-display `TIERS`
   SAME            🟢 「동일상품」
   PRESUMED_SAME   🟡 「**동일상품 추정**」 · note 「식별자 미확인 … — **참고 가격**」
   SAME_MODEL_OPTION_DIFF 🔵 「같은 모델이지만 색상/사이즈 등 옵션이 다릅니다 — 참고 가격」
   SIMILAR / UNKNOWN / CONFLICT
🔴🔴 가격 집계 쪽은 **같은 상태를 다르게 부른다** — overseas-reference `TIER_LABEL`
   EXACT: "동일상품"  ·  **COMPARISON: "유사상품"**  ·  REFERENCE: "참고"
```
🔴🔴 **`TEXT_CONFIRMED` 하나가 두 이름을 갖는다** — 후보 카드에서는 「동일상품 **추정**」,
가격 집계에서는 「**유사상품**」. ⟹ CPO 4단계의 **둘째 칸이 가격 쪽에서 과소 표현** 되고,
셀러가 그 가격을 「다른 상품 가격」으로 읽어 **버릴 수 있다**. 🟢 계약 `H-6`·`H-7` 로 고정했다.

🟢 **그 문제를 국내에서는 이미 한 번 막았다** — `CORE-2U-A` 가 `showTierNote` 로 등급 분포
줄을 껐다(CEO 화면의 「국내 가격 형성대 **유사상품 1**」이 그 줄이었다).
🔴 **그런데 기본값이 `true`** 라 **해외 축에는 그대로 남아 있다**(`H-8`).
🔴 그리고 그 파일 주석은 「등급 어휘는 owner(`match-display`)와 **같은 말을 쓴다**」고
적어 두었는데 **실제로는 다른 말을 쓴다** — 주석과 코드가 어긋난 자리다.

---

## 8. 🔵 그래서 분리 방향 — 세 선택지(🔴 CTO 는 구현하지 않았고 고르지도 않았다)

```
Ⓐ **어휘만 고친다**(가장 좁다 · 판정 0 · 점수 0)
   `TIER_LABEL.COMPARISON` 「유사상품」 → 「동일상품 추정」(match-display 와 같은 말)
   🟢 비용 거의 0 · 🟢 CPO 4단계와 즉시 일치 · 🔴 계약 갱신 1~2건(어휘 단언)
   🔴 A·B 와 **무관** 하고 **후보 보존 문제는 그대로 남는다**

Ⓑ **노출 등급과 가격 등급을 가른다**(①의 분리 · 중간)
   `priceTierWithVerifiedSame` 과 **같은 모양** 으로, `matchTruth` 를 건드리지 않고
   「후보로는 보존 · 가격으로는 EXCLUDED」를 말하는 칸을 하나 더 둔다
   🟢 그러면 **A 를 넣어도 후보가 화면에 남는다** ⟹ CPO 의 정제된 요구가 충족된다
   🔴 `DEFAULT_VISIBLE_TIERS` 와 `mayShowCandidate` 의 입력이 바뀐다 ⟹ 계약 영향 측정 필요

Ⓒ **국내에 「참고 가격」 축을 만든다**(가장 넓다)
   국내 버킷이 `REFERENCE` 를 **별도 축으로** 받는다(현재는 제외 · 해외는 포함)
   🟢 CPO 4단계의 셋째 칸이 국내에도 생긴다
   🔴🔴 **가격 집계 구조 변경** 이고 `computePriceDecision` 의 분모를 건드릴 위험이 있다 ⟹
      §00-B 「가격 작업 보류」와 정면으로 만난다
```

🔵 **CTO 권고 — `Ⓐ` 를 먼저, 그 다음 `Ⓑ` 를 측정한다.**
```
🟢 Ⓐ 는 **판정·점수·eligibility 를 한 글자도 바꾸지 않고** CPO 4단계를 화면에서 성립시킨다 —
   「추정 가격」이 「유사상품」으로 읽히는 **현재 진행 중인 오해** 를 지금 없앤다
🟡 Ⓑ 는 A 의 전제조건이다 — **Ⓑ 없이 A 를 넣으면 후보가 기본 화면에서 내려간다**(§2)
🔴 Ⓒ 는 가격 구조 변경이라 **열지 않기를 권고** 한다(지금 단계가 아니다)
```

🔴🔴 **그리고 A 에 대한 권고를 R2 에서 «정정» 한다**:
> R2 는 「p4 계약 변경을 전제로 A 적용 준비(선택 B)」를 권고했다.
> 🔴 4-H 가 **빠진 전제** 를 찾았다 — **A 는 후보를 SIMILAR 로 내리지 않고 UNKNOWN 으로 내린다.**
> ⟹ 🔵 **권고 수정: `Ⓑ 분리` 가 선행되지 않으면 A 를 적용하지 않는다.**
> 그래야 CPO 의 「Generic-only 는 추정 근거로 인정하지 않되 **후보는 보존**」이 동시에 성립한다.

---

## 9. 최종 권고 — **READY(Ⓐ) · HOLD(A · Ⓑ 선행) · NO-GO(Ⓒ)**

```
Ⓐ 어휘 정합      🟢 **READY** — 기존 계약 변경 없이 안전한 구현 가능(판정 0 · 점수 0 · eligibility 0)
Ⓑ 등급 분리      🟡 **CONTRACT REVISION** — `mayShowCandidate`/`DEFAULT_VISIBLE_TIERS` 계약 영향 측정 필요
A  Generic-only  🟡 **HOLD — Ⓑ 선행 조건** (R2 권고를 정정한다)
Ⓒ 국내 REFERENCE 🔴 **NO-GO (지금)** — 가격 집계 구조 변경 · §00-B 와 충돌
B  COLOR/SIZE    🔴 **NO-GO 유지**(R2 확정) · 🟢 「다른 색상·사이즈 후보 보존」 전략은 **이미 동작한다**
```

🔵 **CTO 는 정책을 결정하지 않았다.**

---

## 10. 측정불가로 남긴 것

```
⒜ 🔴 Generic-only 9건의 `confidence` — 운영 fixture 에 **칸이 없다** ⟹ `mayShowCandidate` ③
   통과 여부 미확정 (🟢 단 ①이 먼저 거른다는 사실은 확정)
⒝ 🔴 `TIER_LABEL` 이 셀러 화면의 **어느 자리** 에 실제로 찍히는지 — 해외 축의 렌더 위치는
   코드로 추적했으나 **실제 따져 화면은 CTO 가 볼 수 없다**
⒞ 🔴 Ⓑ 를 넣었을 때 깨지는 계약 수 — **측정하지 않았다**(구현 금지 범위)
⒟ 🔴 국내 「옵션만 다름」 등급 부재가 **실제로 몇 건의 후보를 놓치는지** — 국내 후보에
   옵션 데이터가 없어 **분모 자체가 없다**
```
