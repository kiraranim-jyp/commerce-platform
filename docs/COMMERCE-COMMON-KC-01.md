# COMMERCE-COMMON-KC-01 — 세 채널의 KC 는 같은 것인가

> CPO 작업지시(2026-09-28). **조사만.**
> UI ❌ · payload ❌ · migration ❌ · KC 자동 판정 ❌ · 새 KC 코드/사전 ❌.
> 🔴 법적·정책 해석이 필요한 것은 **정책 근거와 현재 구현을 분리해서** 보고한다.

---

## 0. 🔴 먼저 — 가장 무거운 발견

**세 채널의 KC 는 같은 개념이 아닙니다.** 그리고 그중 하나는 **법적 선언을
우리가 기본값으로 채워** 실제 등록에 내보내고 있습니다.

```
스마트스토어  「판매자가 확인했는가」        ← 확인(Confirmation) · 정책버전 · 등록을 «막는다»
쿠팡          「KC 면제 문구」               ← 우리가 «지어낸 기본값» 이 payload 로 나간다
롯데ON        「안전인증 목록(유형+번호)」    ← 실제 인증서의 값 · 없으면 막힌다
```

세 개를 「KC」라는 한 이름으로 합치면 **확인·문구·인증번호가 한 칸이 됩니다.**

---

## 1. 🔴 쿠팡 — 우리가 채우는 법적 선언 (제가 직접 확인)

```ts
// packages/listing/src/coupang/build-payload.ts:725
export const DEFAULT_KC_EXEMPTION_TEXT = "KC마크 없이 구매대행 가능한 품목";

// :800  어느 칸이 KC 칸인가
const COMPLIANCE_CRITICAL_SYNONYMS = ["kc", "인증"];
export function isComplianceCritical(fieldName: string): boolean { … }

// compliance 조립부
value: context.kcExemptionText || DEFAULT_KC_EXEMPTION_TEXT
```

- 셀러가 **고르는 것이 아닙니다.** 판매자 설정(`seller_settings.kc_exemption_text`)이
  비어 있으면 **우리 코드의 문구**가 들어갑니다.
- 근거는 기록돼 있습니다 — 「대부분의 해외구매대행 상품은 실제로 이 문구에
  해당한다」(A-12.3-P0-3, CPO 2차 지시).
- 🔴 **실제 등록 11건이 전부 이 기본값 경로였고, override 는 0건**이었습니다
  (`p0kc03-coupang-notice-gate.test.ts` 머리말).
- 그 뒤 P0-KC-03 에서 **모달로 그 문구를 판매자에게 보여주고 확인을 받게**
  했습니다. 다만 확인의 뜻은 원문 그대로 —

  > 「지금 등록될 문구가 무엇인지 확인했다」 하나뿐이다.
  > 「이 상품이 법적으로 KC 면제다」도, 「따져가 면제를 확인했다」도 아니다.

- 🔴 그리고 그 칸 판정은 **필드 이름**(`kc`/`인증` 포함)만 봅니다 —
  **상품이 어린이제품인지 보지 않습니다.**

### 🔴 그래서 채널 간 충돌이 하나 드러납니다

| 출처 | 문장 |
|---|---|
| **쿠팡 기본값**(우리 코드) | 「KC마크 없이 **구매대행 가능**한 품목」 |
| **롯데ON 공식 고시 품목표** `23 0200` | 「어린이제품 및 방송통신기자재는 개정 전안법 특례대상이 아니므로 **구매대행/병행수입을 선택할 수 없습니다**」 |

**아동의류는 품목 23(어린이제품)입니다.** 같은 상품에 대해 한쪽은 「구매대행
가능」을 선언하고, 다른 쪽 공식 문서는 「구매대행을 선택할 수 없다」고 합니다.

🔴 **저는 이것을 판정하지 않았습니다.** 코드도 바꾸지 않았습니다.
정책 근거와 현재 구현을 그대로 나란히 둡니다 — CPO STEP 5 지시대로입니다.
(롯데ON 1:1 문의 A-1~A-6 이 이미 이 질문을 담고 있습니다.)

---

## 2. 저장 구조 (STEP 2 · 제가 직접 확인)

### `seller_compliance_confirmations` — **스마트스토어 전용입니다**

```ts
// apps/admin/src/app/api/smartstore/_lib/seller-compliance.ts
saveSellerComplianceConfirmation()   // 🔴 덮어쓰지 않는다 — 매번 새 행(감사 로그)
getLatestSellerComplianceConfirmation(snapshotId)   // 최신 1건
```

- 호출부는 **둘뿐**이고 전부 `smartstore` 아래입니다
  (`smartstore/seller-compliance/route.ts`, `smartstore/register/route.ts`).
- `platform` 은 **컬럼이자 인자**인데 실제로 넘기는 값은 `"smartstore"` 하드코딩입니다.
- 쿠팡·롯데ON register 라우트에는 **같은 게이트가 없습니다**(grep 결과 0건).

→ **테이블은 다채널을 담을 수 있지만, 지금은 한 채널만 씁니다.**

### `smartStoreKcDeclaration` — 상품 JSON 안의 «선언»

`CanonicalProduct` 의 선택 키(`product-types.ts:437`)이고, 쓰는 곳은
`CommerceWorkspace.tsx`(셀러가 고름), 읽는 곳은 register·readiness·preview 입니다.

🔴 **둘은 다른 사실입니다.**

```
smartStoreKcDeclaration        판매자가 «고른 값»   (대상/비대상/면제 + 사유)
seller_compliance_confirmations 판매자가 «확인한 행위» (언제 · 어떤 정책버전 · 어떤 카테고리)
```

→ CPO 지시대로 **`smartStoreKcDeclaration` 을 이름만 바꿔 Common 필드로 올리지
않았습니다.** 올리면 「고른 값」과 「확인 행위」가 한 칸이 됩니다.

---

## 3. 🟢 정책 버전은 «실제로» 등록을 막습니다 (STEP 1-8)

```ts
// apps/admin/src/app/api/smartstore/register/route.ts:421
const row = await getLatestSellerComplianceConfirmation(snapshotId);
const sellerConfirmationValid =
  row?.confirmed === true &&
  row.policyVersion === COMPLIANCE_POLICY_VERSION &&
  row.categoryCode === leafCategoryId;
if (!sellerConfirmationValid) → FAILED (VALIDATION)
```

- 기록만 하는 것이 아니라 **등록을 막습니다.**
- **정책 버전이 다르면 과거 확인이 무효**입니다.
- **카테고리가 바뀌어도 무효**입니다.
- 🔴 그리고 **모든 카테고리**에 요구합니다 — 주석 원문: 「KIDS 여부와 무관하게」.
  즉 이것은 「KC 확인」이 아니라 **「판매 전 최종 확인」** 이고, `kcStatus` 는
  그 안에 실려 다니는 값입니다.
- 클라이언트가 보낸 상태를 신뢰하지 않고 **서버가 다시 조회**합니다.

🟢 이 구조는 `COMMON-DESIGN-01` 에서 설계한
`CommonConfirmation { confirmedAt, policyVersion }` 와 **그대로 맞습니다.**
새로 만들 것이 아니라 이미 도는 것을 일반화하면 됩니다.

---

## 4. 채널별 상세

### 4-A. 스마트스토어 — **셀러가 «라디오로 선언»하고, 시스템이 «판정»한다**

두 층이 분리돼 있습니다.

```ts
// ① 셀러가 고르는 것 — product-types.ts:264
SmartStoreKcDeclaration {
  child?:  "TARGET" | "EXCLUDED"                                  // 어린이제품 인증
  kc?:     "TARGET" | "EXCLUDED" | "EXEMPTION"                    // KC 인증
  exemptionReason?: "OVERSEAS" | "SAFE_CRITERION" | "PARALLEL_IMPORT"  // 면제 사유
}
// UI: PlatformPreview.tsx:313~ 라디오 3그룹 (「구매대행」·「안전기준 준수」·「병행수입」)

// ② 시스템이 내는 판정 — naver/compliance.ts:32
KcStatus = "NOT_APPLICABLE" | "CERTIFIED_REFERENCE" | "SELLER_REVIEW_REQUIRED" | "BLOCKED"
```

| KcStatus | 언제 | 등록 |
|---|---|---|
| `BLOCKED` | 카테고리 미확정 | 🔴 막는다(확인으로도 못 뚫음) |
| `SELLER_REVIEW_REQUIRED` | 어린이제품 범주인데 인증정보 없음 | 🟡 **확인해야** 통과 |
| `NOT_APPLICABLE` | 어린이제품 범주 아님 | 통과 |
| `CERTIFIED_REFERENCE` | 인증번호·업체·일자 3개 입력됨 | 통과 |

payload: `certificationTargetExcludeContent.{childCertifiedProductExclusionYn,
kcCertifiedProductExclusionYn, kcExemptionType}` — 조합이 유효하지 않으면
**키 자체를 만들지 않습니다**(`kc-declaration.ts:92`).

### 4-B. 쿠팡 — §1 참조. **선언이 아니라 「문구」이고, 기본값이 우리 것입니다.**

### 4-C. 롯데ON — **실제 인증서의 «구조화된 값»**

```ts
// lotteon/types.ts:46
LotteOnSafetyCertification { sftyAthnTypCd; sftyAthnOrgnNm?; sftyAthnNo }
// 유형코드 16종: CHL_ATHN/CHL_CFM/CHL_SUPS · ELC_* · LIFE_* · CMCN_* · CHEM_* · ETC
```

- 차단 조건(`validate-payload.ts:201`) — 항목이 불완전하거나, **품목 23 인데
  안전인증이 없으면** BLOCKED. 근거는 공식 문서 원문입니다:
  「품목코드가 23번 유아동인 경우 표준카테고리에 따라 **안전인증목록이 필수값**이다」
- 카테고리가 **요구 유형**(`safetyTypeCodes`)을 함께 알려주고 폼에 자동 반영됩니다.
  🔴 다만 **유형만** 자동이고 **인증번호는 셀러**가 넣습니다.
- 🔴 셀러가 `유형코드:인증번호[:기관명]` 를 **직접 타이핑**합니다(선택 목록 없음).
- `impPrxCd`(구매대행/병행수입/해당없음)는 전기·생활용품 계열에서만 필수이고
  **어린이제품에는 필요 없습니다.**
- 고시 `0200`(KC 인증정보)과 `sftyAthnLst` 는 **다른 값**입니다 — 앞은 고시
  텍스트 한 줄, 뒤는 payload 구조체. 🔴 **둘 다 넣어야 하는지는 확인 못 했습니다.**

---

## 5. 🔴 세 채널이 «같은 사실» 에 다른 말을 합니다

아동의류 한 상품을 놓고 —

| 채널 | 구매대행에 대해 무엇이 나가는가 | 누가 정했는가 |
|---|---|---|
| 스마트스토어 | KC 면제 사유 = **「구매대행」**(`OVERSEAS`) | **셀러가 라디오로 선택** |
| 쿠팡 | 「KC마크 없이 **구매대행 가능**한 품목」 | 🔴 **우리 코드 기본값** |
| 롯데ON | 공식 고시: 어린이제품은 **구매대행/병행수입을 선택할 수 없다** | 롯데ON 공식 문서 |

🔴 **한쪽은 구매대행을 면제 사유로 선언하고, 다른 쪽 공식 문서는 그것을
금지합니다.** 그리고 쿠팡 쪽은 셀러가 고른 적도 없는 문장입니다.

**저는 이것을 판정하지 않았습니다.** 그리고 관련해서 이미 기록된 경고가
있습니다 — `PlatformPreview.tsx:1372` 「구매대행이라고 해서 판매자가 법적으로…」
(N-3.45 STEP8, CPO 지시).

---

## 6. STEP 3 — Requirement 판정 (🔴 근거 있는 것만)

| 채널 | KC 요구도 | 근거 |
|---|---|---|
| 스마트스토어 | **`USER_CONFIRMATION`** | `SELLER_REVIEW_REQUIRED` 는 «확인해야» 통과한다. 그리고 register 게이트가 **모든 카테고리**에 확인을 요구한다 |
| 스마트스토어(인증번호) | **`CONDITIONAL_REQUIRED`** | 어린이제품 카테고리 + 셀러가 `EXCLUDED` 를 고르지 않았을 때만 |
| 롯데ON | **`CONDITIONAL_REQUIRED`** | 조건 = 품목코드 23. 공식 문서 원문 근거 있음 |
| 쿠팡 | 🔴 **확정 못 함** | `FieldRule` 에 KC 규칙이 «없다». 등록을 막지 않고, 대신 화면 모달이 문구를 보여준다. 요구도로 부를 것이 이것인지 CPO 판단이 필요하다 |

🔴 **「아동의류에서 KC 가 항상 같은 방식으로 요구되는가」에 대한 답: 아니오.**
롯데ON 은 품목코드로, 스마트스토어는 카테고리+셀러 선언으로, 쿠팡은 아예 막지
않습니다. **추측으로 세 채널에 같은 요구도를 부여하지 않았습니다.**

---

## 7. STEP 4 — Confirmation 과 Value 분리 — 🟢 현장이 이미 그렇습니다

```
값(Value)        smartStoreKcDeclaration · sftyAthnNo · kcExemptionText
확인(Confirmation) seller_compliance_confirmations (confirmed · policyVersion · confirmedAt)
```

**`CONFIRMED` 를 `valueState` 에 넣지 않았습니다.** 넣었다면 스마트스토어의
「선언은 했는데 확인은 안 함」을 표현할 수 없습니다 — 그리고 그 상태가 실제로
등록을 막는 상태입니다.

---

## 8. 그래서 Common KC 는 «한 필드» 가 아닙니다

```
KC 대상 여부        선언/판정    → 채널마다 «판정 방식» 이 다르다
KC 인증번호         실제 값      → 만들 수 없다 (3채널 공통)
KC 면제 사유        선언         → 🔴 채널 간 정책이 충돌한다
판매자 확인          행위         → 🟢 구조가 이미 있다 (스마트스토어 전용)
```

🔴 **하나로 합치면 「확인·문구·인증번호」가 한 칸이 됩니다.** 색상·소재에서와
같은 결론이지만 이유가 훨씬 무겁습니다 — 법적 선언이기 때문입니다.

---

## 9. CPO 판단이 필요한 것

1. **§5 의 정책 충돌** — 세 채널이 구매대행에 대해 다른 말을 합니다.
   🔴 코드로 판정하지 않았습니다. 롯데ON 1:1 문의(A-1~A-6)가 이미 그 질문을
   담고 있으니 **쿠팡·스마트스토어 쪽도 같은 확인이 필요한지** 정해 주십시오.
2. **쿠팡 기본 문구** — 셀러가 고른 적 없는 법적 선언이 payload 로 나갑니다.
   지금 동작이고 제가 바꾸지 않았습니다. **유지/재검토 결정이 필요합니다.**
3. **쿠팡 KC 요구도** — 「막지 않는다」를 `OPTIONAL` 로 부를지, 모달 확인을
   `USER_CONFIRMATION` 으로 볼지.
4. **롯데ON `0200` 과 `sftyAthnLst` 중복** — 둘 다 넣어야 하는지 확인 못 했습니다.

---

## 10. 이번에 «하지 않은» 것

UI ❌ · payload ❌ · migration ❌ · KC 자동 판정 ❌ · 새 KC 코드/사전 ❌ ·
기존 SmartStore 선언 변경 ❌ · 롯데ON 고시 구현 ❌.
**소스 변경 0.** 이번에 바뀐 파일은 이 문서 하나입니다.
