# COMMERCE-COMMON-KC-COUPANG-03 — 쿠팡에서 «무엇을» 확인한 것인가

> CPO 작업지시(2026-09-28). Phase 1 조사 · Phase 2 적합성 판정. **코드 변경 0.**
> 금지: `CommonConfirmation` DB 확장 ❌ · `policyVersion` 임의 생성 ❌ ·
> REQUIRED/OPTIONAL 임의 확정 ❌ · `DEFAULT_KC_EXEMPTION_TEXT` 변경 ❌ ·
> `certifications` ❌ · KC payload ❌ · 새 KC 기본 문구 ❌.

---

## 0. 결론

```
🔴 지금 쿠팡의 «확인» 은 Common Confirmation 으로 승격할 수 없다.
   근거가 없어서가 아니라 — 확인하는 «대상» 이 뒤바뀌어 있기 때문이다.

   시스템은 판매자에게 «판매자 자신이 쓴 문장» 을 보여주며
   「따져가 자동으로 입력한 기본값입니다」 라고 말하고 있다.
```

그리고 CPO 가 지목한 provenance 어긋남은 **실재하고**, 이 저장소는 그것을
가릴 어휘를 **이미 갖고 있으면서 쓰지 않고 있습니다**(§2).

---

# Phase 1 — 조사

## 1-1 ~ 1-3. 확인의 대상과 조건

```ts
// ListingConfirmationModal.tsx:139~143
const autoFilledCoupangNotices = (coupangKcNotices ?? []).filter((n) => n.autoFilled);
const coupangNoticeNeedsReview  = autoFilledCoupangNotices.length > 0;
const coupangNoticeRegistrable  = !coupangNoticeNeedsReview || coupangNoticeConfirmed;

// CommerceWorkspace.tsx:2181~2185 — autoFilled 의 정의
compliancePreview.noticeResults
  .filter((r) => isComplianceCritical(r.fieldName))            // 이름에 인증·허가
  .map((r) => ({ …, autoFilled: r.source === "DEFAULT_VALUE" }))
```

| 질문 | 답 |
|---|---|
| **1-1** 무엇을 확인하는가 | **KC/인증 이름이 붙은 고시 칸 중 `source === "DEFAULT_VALUE"` 인 것**의 «문구» |
| **1-2** 확인 대상의 성격 | 🔴 셋 중 **어느 것도 아니다** — 아래 |
| **1-3** `needsReview` 조건 | `source === "DEFAULT_VALUE"` 인 KC 칸이 **1개 이상**일 때 |

### 1-2 자세히 — 셋 중 어느 것도 아닙니다

| CPO 후보 | 맞는가 |
|---|---|
| KC 면제 문구 자체 | 🔴 아니다 — 모달 주석 원문: 「「이 상품이 KC 면제 대상임을 판매자가 증명했다」가 **아니다**」 |
| 전체 상품정보제공고시 | 🔴 아니다 — `isComplianceCritical` 로 **KC 칸만** 거른다. 나머지 고시 칸은 확인 대상이 아니다 |
| 등록 직전 seller acknowledgement | 🟡 **가장 가깝다. 그러나 범위가 좁다** — 「지금 등록될 문구가 무엇인지 봤다」 하나뿐이다 |

원문(P0-KC-03): 「확인의 뜻은 「지금 등록될 문구를 봤다」뿐이다 — 「이 상품이
법적으로 KC 면제다」도, 「따져가 면제를 확인했다」도 아니다.」

→ **「봤다(seen)」이지 「판단했다(judged)」가 아닙니다.**

---

## 1-4. `kcExemptionText` 의 실제 provenance — 🟢 추적 완료

```
seller_settings.kc_exemption_text            ← DB 컬럼
  → seller-settings.ts:104  kcExemptionText: row.kc_exemption_text
  → coupang/register/route.ts:512  kcExemptionText: sellerSettings.kcExemptionText ?? ""
  → build-payload.ts:1351  context.kcExemptionText || DEFAULT_KC_EXEMPTION_TEXT
```

🟢 **Settings 값입니다.** Category 도 Default 도 아닙니다.
02B 실측이 이것을 확증합니다 — 2026-08-04 이후 나간 문구
`KC인증 어린이제품 공급자적합성확인` 은 코드 기본값과 **다른데** `source` 는
`DEFAULT_VALUE` 였습니다. 그 분기는 **하나뿐**이므로 `context.kcExemptionText` 가
채워져 있었다는 뜻이고, 그 값의 출처는 위 사슬대로 `seller_settings` 입니다.

---

## 1-5. 🔴 `source: "DEFAULT_VALUE"` 가 붙는 자리 — 여기가 문제의 지점

```ts
// build-payload.ts:1348~1355
if (isComplianceCritical(detail.noticeCategoryDetailName)) {
  return {
    …,
    value: context.kcExemptionText || DEFAULT_KC_EXEMPTION_TEXT,
    source: "DEFAULT_VALUE" as const,        // 🔴 둘 다 «같은» 라벨을 받는다
  };
}
```

**한 줄이 두 가지 «다른 사실» 을 같은 이름으로 기록합니다.**

```
판매자가 Settings 에 직접 쓴 문장   →  DEFAULT_VALUE
우리가 코드에 박아 둔 관용 문구      →  DEFAULT_VALUE
```

### 🔴 그리고 그 라벨이 판매자에게 «문장» 으로 나갑니다

```
ListingConfirmationModal.tsx:357
  「위 문구는 따져가 «자동으로» 입력한 기본값입니다.」

CategoryRequirementsEditor.tsx:160
  DEFAULT_VALUE: "업계 관용 기본값 자동 적용"
```

→ 🔴 **판매자가 자기가 쓴 문장을 보면서 「따져가가 자동으로 넣은 기본값」이라는
설명을 읽고 있습니다.** 02B 기준으로 이 경로가 **최근 13건 전부**입니다.

### 🟢 이 저장소는 그것을 가릴 어휘를 이미 갖고 있습니다

```ts
// readiness.ts:31~34 (원문 주석)
// DEFAULT_VALUE는 "CartPilot이 대신 관용적 기본값을 채웠다"는 뜻으로, 실제
// 데이터를 확인한 AUTO나 Settings에서 가져온 SETTINGS_DEFAULT와는 다른
// 신뢰 수준이라 별도 배지로 구분한다.
sourceStatus?: "AUTO" | "SETTINGS_DEFAULT" | "MANUAL_REQUIRED" | "DEFAULT_VALUE";
```

🔴 **Readiness 층은 둘을 가르고 있는데, payload 빌더 층은 합치고 있습니다.**
없는 개념을 새로 만들자는 것이 아니라 **이미 있는 구분이 한 층에서 무너진** 것입니다.

---

## 1-6. `USER_INPUT` 3건 vs Settings 11건 — 🔴 의미가 있고, 방향이 뒤집혀 있습니다

| | 누가 썼나 | `source` | `autoFilled` | **확인을 요구하는가** |
|---|---|---|---|---|
| 상품별 입력 (3건) | 판매자 | `USER_INPUT` | `false` | 🔴 **아니오** |
| Settings 문구 (11건) | 판매자 | `DEFAULT_VALUE` | `true` | 🟢 **예** |
| 코드 기본값 (5건) | **우리** | `DEFAULT_VALUE` | `true` | 🟢 예 |

**둘 다 판매자가 쓴 문장인데 한쪽만 확인을 요구합니다.**

🟡 이것이 **반드시 틀린 것은 아닙니다** — 상품별 입력은 방금 타이핑한 것이라
「봤다」가 자명하고, Settings 값은 언제 썼는지 모릅니다. 확인을 요구할 이유가
있습니다.

🔴 그러나 **지금 시스템이 그 이유로 그렇게 하고 있는 것이 아닙니다.**
기준은 「판매자가 썼는가」가 아니라 「`source` 가 `DEFAULT_VALUE` 인가」이고,
그 라벨은 §1-5 대로 **두 사실을 뭉쳐 놓은 것**입니다. 결과가 우연히 그럴듯한
것이지 의도된 규칙이 아닙니다.

---

## 1-7. 확인 후 저장이 없는 이유 — 기록돼 있습니다

**① 명시적 범위 결정** (P0-KC-03 테스트 헤더 원문)
> 「스마트스토어의 KcStatus / `seller_compliance_confirmations` 체계를 쿠팡에
>  **복사하지 않았다**」

**② 구조적 이유** (KC-03) — `seller_compliance_confirmations.kc_status` 가
`NOT NULL` 이고 CHECK 가 **네이버 어휘 네 값**에 묶여 있어, 쿠팡 확인을 넣으려면
네이버 상태값을 지어내야 합니다. CHECK 확장은 migration 입니다.

**③ 결과** — `useState(false)` 뿐이라 새로고침하면 사라지고, 서버는 읽지 않습니다.

---

# Phase 2 — Common Confirmation 적합성 판정

## 2-1. 세 개념의 현재 상태

| 개념 | 현재 | 🔴 주의 |
|---|---|---|
| 판매자가 KC/고시 문구를 «제공» | 🟢 있음 (Settings 11건 + 상품별 3건) | **그런데 `DEFAULT_VALUE` 로 기록된다** |
| 시스템이 문구를 «생성» | 🟢 있음 (코드 기본값 5건) | 2026-08-04 이후 실사용 **없음** |
| 판매자가 «확인했다는 행위» | 🟡 UI 에 있음, 저장 없음 | 대상이 위 둘을 **구별하지 못한다** |

## 2-2. 🔴 하나로 합칠 수 있는가 — **아니오**

**합치면 안 되는 이유는 「저장소가 없어서」가 아닙니다. 그건 고칠 수 있습니다.**
**대상이 섞여 있기 때문입니다.**

```
지금 확인이 참이 되는 조건 = 「source 가 DEFAULT_VALUE 다」
그 조건은 「판매자가 썼다」와 「우리가 썼다」를 구별하지 못한다
→ 확인 기록을 남겨도 «무엇에 대한 확인인지» 를 사후에 말할 수 없다
```

🔴 `CommonConfirmation` 에는 **「무엇을 확인했는가」 칸이 없습니다.** 범위 세 축은
`platform` · `categoryCode` · `policyVersion` 뿐입니다(설계상 의도).
대상이 섞인 채로 그 구조에 넣으면 **섞였다는 사실 자체가 사라집니다.**

## 2-3. 구조가 쿠팡의 확인을 표현할 수 있는가 — 칸별 대조

| 칸 | 쿠팡 | 판정 |
|---|---|---|
| `confirmed` | `coupangNoticeConfirmed` | 🟢 있다 |
| `confirmedAt` | 없음 (만들 수 있음) | 🟡 |
| `platform` | `"coupang"` | 🟢 |
| `categoryCode` | `displayCategoryCode` | 🟢 |
| `policyVersion` | 🔴 **없다** | 🔴 만들면 «새 정책» — 이번 금지 항목 |

그리고 **뜻이 다릅니다** —

```
스마트스토어  「판매 전 최종 확인」   모든 카테고리 · 서버가 재검증
쿠팡          「이 문구를 봤다」      KC 칸에 DEFAULT_VALUE 가 있을 때만
```

같은 `CommonConfirmation` 으로 읽으면 **이 차이가 표현되지 않습니다.**

## 2-4. 🔴 그리고 Common 계약이 이미 금지하고 있습니다

```ts
// packages/shared/src/field-requirement.ts:43~44 (원문)
// 🔴 다만 «모든 필드에 이 순서를 그대로» 적용하지 않는다. 필드마다 허용되는
// 출처가 다르다(KC 는 SELLER_SETTINGS 에서 올 수 없다).
```

🔴 **지금 쿠팡 KC 문구는 정확히 `SELLER_SETTINGS` 에서 오고 있습니다.**

이것을 「규칙 위반이니 막자」로 읽으면 안 됩니다 — **지금 등록되는 상품이 막힙니다**
(CPO 고정 금지: 「Coupang `WARNING` → `BLOCKED` 승격 ❌」). 그리고 판매자가
스스로 쓴 문장을 막을 근거도 없습니다.

읽어야 할 방향은 이것입니다 —

> **Common 계약은 「KC 값이 Settings 에서 오는 상태」를 «정상» 으로 상정한 적이
> 없습니다. 그러니 그 상태를 Common Confirmation 으로 승격시키는 것은 계약을
> 쓰는 것이 아니라 계약을 우회하는 것입니다.**

---

## 2-5. 판정

```
🔴 Common Confirmation 편입 — HOLD. 지금은 근거가 «없는 것이 아니라 어긋나 있다».
```

| 안 | 내용 | 판단 |
|---|---|---|
| **①** | **provenance 부터 바로잡는다** — Settings 값과 코드 기본값을 다른 `source` 로 기록 | 🟢 **선행 조건. 제 권고** |
| ② | 지금 상태로 Confirmation 저장만 추가 | 🔴 섞인 대상을 그대로 굳힌다 |
| ③ | 쿠팡 `policyVersion` 을 만들어 Common 편입 | 🔴 이번 금지 항목 · ①이 먼저다 |

### 🔴 ①을 하면 무엇이 달라지는가 (구현 아님 — 판단 재료)

```
지금       DEFAULT_VALUE  =  { 판매자가 쓴 문장, 우리가 쓴 문장 }
①이후      SELLER_SETTINGS =  판매자가 쓴 문장      ← 확인의 «뜻» 이 달라진다
           DEFAULT_VALUE   =  우리가 쓴 문장        ← 이것만 「대신 적었다」
```

그러면 비로소 두 질문을 나눠 물을 수 있습니다 —
「판매자가 **자기 문장**을 확인했는가」와
「판매자가 **우리 문장**을 확인했는가」.

🔴 **다만 ①은 payload 를 바꾸지 않더라도 «화면 문구와 확인 조건» 을 바꿉니다**
(`autoFilled` 판정이 달라짐). 지금 확인을 요구하던 13건이 요구하지 않게 될 수
있습니다. 그래서 **제가 결정하지 않고 여기서 STOP 합니다.**

---

## 3. 이번에 «하지 않은» 것

코드 변경 **0**. `CommonConfirmation` DB 확장 ❌ · `policyVersion` 생성 ❌ ·
REQUIRED/OPTIONAL 확정 ❌ · `DEFAULT_KC_EXEMPTION_TEXT` 변경 ❌ ·
`certifications` ❌ · KC payload ❌ · 새 KC 문구 ❌ · provenance 수정 ❌
(판정이 필요해서 «찾기만» 했습니다) · 모달 문구 수정 ❌.
