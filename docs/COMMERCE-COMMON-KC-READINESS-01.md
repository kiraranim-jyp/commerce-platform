# COMMERCE-COMMON-KC-READINESS-01 — 확인은 언제 REQUIRED 인가

> CPO 작업지시(2026-09-28). **조사만. 코드 변경 0.**
> Readiness ❌ · payload ❌ · UI ❌ · `certifications` ❌ · `OVERSEAS` 차단 ❌ ·
> 롯데ON 고시 ❌ · migration ❌ · confirmation 저장 구조 ❌.

---

## 0. 🔴 먼저 — KC-03 의 제 문장을 정정합니다

KC-03 에서 「`kcStatus` 는 게이트가 쓰지 않는다」고 썼습니다.
**등록 게이트에 대해서는 맞지만, Readiness 는 씁니다.**

```ts
// apps/admin/src/app/pipeline/commerce/readiness-state.ts:37
export function resolveRegistrationReadinessState(summary, priceValid, kcStatus?) {
  if (!priceValid) return "BLOCKED";
  if (kcStatus === "BLOCKED") return "BLOCKED";
  if (kcStatus === "SELLER_REVIEW_REQUIRED") return "SELLER_REVIEW";   // ← 전용 상태
  if (!summary.allRequiredPassed) return "NEEDS_REVIEW";
  return "READY";
}
```

🔴 그리고 **두 `kcStatus` 는 서로 다른 값입니다.**

```
validation.kcStatus   «지금» 계산한 값 — Readiness 가 쓴다
row.kcStatus          확인 기록에 저장된 값 — 감사용, 아무도 판정에 쓰지 않는다
```

---

## 1. 채널별 — KC 가 Readiness 로 들어가는 경로

| 채널 | 경로 | 가능한 상태 |
|---|---|---|
| **스마트스토어** | `validation.kcStatus` → `resolveRegistrationReadinessState` (`compute-readiness.ts:360`) | 🟢 **`SELLER_REVIEW` 전용 상태** · `BLOCKED` |
| **쿠팡** | 🔴 **안 들어간다** (`:389` 는 `kcStatus` 를 넘기지 않는다) | 없음 |
| **롯데ON** | `sftyAthnLst` BLOCKED → `allRequiredPassed=false` → `NEEDS_REVIEW` (패널 `:1151`, `kcStatus` 미전달) | 전용 상태 없음 |

### 🔴 쿠팡이 빠진 이유는 «기록돼 있습니다»

```
// compute-readiness.ts:381 (원문)
compliance report(고시/KC 등)는 카테고리 API 실시간 조회가 필요해 이번 대시보드
배치 계산에서는 제외한다 … 이 카드는 "1차 판단"이지 최종 게이트와 100% 동일하지 않다.
```

→ **「KC 요구도가 없다」가 아니라 「이 계산에서 뺐다」** 입니다.
KC-02 에서 「쿠팡 요구도 확정 못 함」이라고 한 판단이 여기서도 유지됩니다.

---

## 2. 스마트스토어 — 확인이 REQUIRED 인 조건

| 질문 | 답 |
|---|---|
| 어떤 조건에서 REQUIRED 인가 | **모든 카테고리.** `register/route.ts` 주석 원문: 「SELLER_CONFIRMED … 를 **모든 카테고리(KIDS 여부와 무관하게)** 에 대해 서버에서 다시 검증한다」 |
| 왜 모든 카테고리인가 | 같은 주석: 「DATA_READY + PLATFORM_READY 만으로는 등록을 허용하지 않는다」 — 「API 등록 가능」과 「판매 가능」을 분리한 결정(N-3.52) |
| `kcStatus` 가 readiness 계산에 필요한가 | 🟢 **필요하다** — `SELLER_REVIEW` 상태를 만드는 유일한 입력이다 |

### 🔴 `policyVersion`/`categoryCode` 불일치 시 Readiness

**Readiness 는 저장된 확인 기록을 «읽지 않습니다».**
`getLatestSellerComplianceConfirmation` 호출부는 둘뿐이고(확인 저장 라우트 ·
등록 라우트) **readiness 경로에는 없습니다.**

```
정책/카테고리 불일치  →  등록 라우트   FAILED(VALIDATION)
                     →  Readiness    모른다 (그 축을 보지 않는다)
```

→ 🔴 **화면이 READY 인데 등록이 실패할 수 있는 구간이 구조적으로 존재합니다.**

🟢 다만 실제로는 좁습니다. 확인 모달이 **등록 직전에 매번 새로 POST** 하므로
(`ListingConfirmationModal.tsx:156`) 정상 흐름에서는 저장값이 항상 최신입니다.
간극이 드러나는 경우는 **확인 후 모달을 다시 열지 않은 채 정책/카테고리가
바뀐 뒤 등록**할 때입니다.

---

## 3. 🟢 확인 «화면» 은 이미 3채널 공용입니다

`ListingConfirmationModal` 을 **스마트스토어·쿠팡·롯데ON 이 함께** 씁니다
(롯데ON 패널 `:2300` 에서 `platformLabel: "롯데ON"` 으로 연다).

```ts
// ListingConfirmationModal.tsx:142~147
kcRegistrable          = !hasSmartstoreKcCard || (!kcBlocked && (!kcNeedsReview || reviewConfirmed))
coupangNoticeRegistrable = !coupangNoticeNeedsReview || coupangNoticeConfirmed
canConfirm = general && priceInfo && responsibility && kcRegistrable && coupangNoticeRegistrable && readinessOk
```

🔴 **그런데 저장(POST)은 스마트스토어일 때만 일어납니다** —
`if (hasSmartstoreKcCard && smartstoreCategoryCode && smartstoreKcStatus)`.

```
확인 «행위»   3채널 공용 (화면)
확인 «기록»   스마트스토어만 (DB)
확인 «게이트» 스마트스토어만 (서버 재검증)
```

→ 공통화의 빈 칸은 **화면이 아니라 「기록과 게이트」** 입니다.

---

## 4. 롯데ON — 현재 requirement 와 표현

| 항목 | requirement | Readiness 표현 |
|---|---|---|
| `sftyAthnLst` | **조건부 필수** — 품목 23 이면 필수(공식 문서 원문, KC-02 §C 확인) | `BLOCKED` 항목 → `NEEDS_REVIEW` |
| 고시 `0200` | 품목표상 **필수(Y)** | 🔴 현재 Readiness 에 **따로 서지 않는다** — 고시 항목 묶음(`pdItmsArtlLst`)의 일부이고, 그 검사는 「1개 이상」이라 통과한다 |
| confirmation | **없음** | 없음 |

🔴 **인증정보와 확인의 관계**: 롯데ON 에는 확인 개념이 없고, `sftyAthnNo`(실제
인증번호)가 있으면 통과합니다. 즉 **「값이 있으면 통과」** 이고, 스마트스토어의
**「값이 있어도 확인해야 통과」** 와 다릅니다.

---

## 5. STEP 4 — KC 「확인 행위」는 어느 요구도인가

증거를 채널별로 나누면 답이 하나가 아닙니다.

| 채널 | 확인 행위의 요구도 | 근거 |
|---|---|---|
| **스마트스토어** | 🟢 **`REQUIRED`** | 「모든 카테고리에 대해」 서버가 재검증한다. `USER_CONFIRMATION` 보다 강하다 — 조건이 없다 |
| 스마트스토어 KC «값» | `CONDITIONAL_REQUIRED` | 어린이제품 카테고리 + 셀러가 `EXCLUDED` 를 고르지 않았을 때 |
| **쿠팡** | 🔴 **확정 못 함** | `FieldRule` 에 없고, 대시보드 계산에서도 «제외» 됐다. 없는 것이 아니라 **재지 않은 것** |
| **롯데ON** | 🔴 **존재하지 않음** | 확인 개념 자체가 없다. 값(인증번호)만 본다 |

### 🔴 그래서 「KC 확인 = 공통 `USER_CONFIRMATION`」이라고 말할 수 없습니다

- 스마트스토어의 확인은 **KC 확인이 아니라 「판매 전 최종 확인」** 입니다
  (KIDS 무관·모든 카테고리). `kcStatus` 는 그 안에 실려 다니는 값입니다.
- 롯데ON 의 KC 는 **값**이지 확인이 아닙니다.
- 쿠팡은 **측정되지 않았습니다.**

→ **요구도를 공통으로 부여할 근거가 지금 없습니다.**

---

## 6. 결론 — Common KC Readiness 를 «지금» 만들면 안 되는 이유

```
공통으로 쓸 수 있는 것   확인 «읽기 계약»(KC-IMPLEMENT-01) · 확인 «화면»(이미 공용)
공통으로 만들 수 없는 것  「언제 REQUIRED 인가」 — 채널마다 근거가 다르고 하나는 아예 없다
```

🔴 `CommonConfirmation` 이 생겼다고 Readiness 가 따라오지 않습니다. 지금
Common KC Readiness 를 만들면 **쿠팡·롯데ON 에 없던 요구를 우리가 만드는**
셈이 됩니다 — 그리고 쿠팡 쪽은 「없다」가 아니라 「재지 않았다」입니다.

---

## 7. CPO 판단을 위한 선택지 (제 권고 포함)

| 안 | 내용 | 대가 |
|---|---|---|
| **①** | **스마트스토어에만** Common 계약을 적용해 지금 동작을 그대로 재현 | 🟢 위험 0. 계약이 실제로 도는지 검증됨. **제 권고** |
| ② | 쿠팡 readiness 에 compliance 를 넣어 «측정부터» 한다 | 실시간 카테고리 조회가 필요(성능) · 요구도 결정은 그 다음 |
| ③ | 3채널에 Common KC Readiness 도입 | 🔴 **권하지 않음** — 없던 요구를 만든다 |

그리고 §2 의 **「화면 READY / 등록 FAILED」 구간**을 어떻게 다룰지도
결정이 필요합니다(지금은 모달이 매번 새로 쓰기 때문에 좁습니다).

---

## 8. 이번에 «하지 않은» 것

코드 변경 **0**. Readiness ❌ · payload ❌ · UI ❌ · `certifications` ❌ ·
`OVERSEAS` 차단 ❌ · 롯데ON 고시 ❌ · migration ❌ ·
confirmation 저장 구조 ❌ · 요구도 임의 부여 ❌.
