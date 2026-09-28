# COMMERCE-COMMON-KC-COUPANG-04 — provenance 를 가른다. 행동은 그대로 둔다.

> CPO 작업지시(2026-09-28). **Common KC 통합은 하지 않는다.** 쿠팡 KC 고시의
> provenance 와 판매자 안내만 바로잡는다.
> 금지: `CommonConfirmation` 확장 ❌ · Common KC Resolver ❌ · `SELLER_SETTINGS`
> 를 Common KC 허용 source 로 추가 ❌ · `kc_status` DB ❌ · `policyVersion` ❌ ·
> `certifications` ❌ · KC 기본 문구 변경 ❌.

---

## 0. 이번 작업의 한 줄 규칙

```
🔴 라벨은 바뀌지만 «행동» 은 바뀌지 않는다.
```

이번 수정의 위험은 「고치는 것」이 아니라 **「따라 움직이는 것」** 입니다 —

```
DEFAULT_VALUE 하나를 둘로 가른다
  → 어딘가에서 `=== "DEFAULT_VALUE"` 로 «세던» 곳이 한쪽을 놓친다
  → 지금 확인을 요구하던 13건이 조용히 요구하지 않게 된다
  → 🔴 판매자가 문장을 못 본 채 등록된다. 고치기 전보다 나쁘다.
```

그래서 테스트의 절반이 **「사라지지 않았는가」** 를 잽니다.

---

## 1. 무엇을 바꿨나 — 여섯 곳

| # | 파일 | 바뀐 것 |
|---|---|---|
| ① | `coupang/build-payload.ts` | `ComplianceFieldSource` 에 **`SETTINGS_DEFAULT`** 추가 · KC 분기가 출처를 가름 |
| ② | `coupang/compliance-report.ts` | `FIELD_CREDIT` 에 동점 추가 · `defaultsApplied` 가 **둘 다** 담고 `source` 를 실음 |
| ③ | `commerce/readiness.ts` | hint·`sourceStatus` 가 출처를 따름 |
| ④ | `CommerceWorkspace.tsx` | `autoFilled` 가 **두 출처 모두** 를 포함 · `source` 전달 |
| ⑤ | `ListingConfirmationModal.tsx` | 칸마다 출처 문장 · 옛 단정 제거 |
| ⑥ | `CategoryRequirementsEditor.tsx` | 출처 라벨 분리 |

### ① 값은 «한 글자도» 바뀌지 않았습니다

```ts
const fromSellerSettings = context.kcExemptionText;
return {
  value: fromSellerSettings || DEFAULT_KC_EXEMPTION_TEXT,           // ← 그대로
  source: fromSellerSettings ? "SETTINGS_DEFAULT" : "DEFAULT_VALUE", // ← 이것만
};
```

🔴 `||` 의 판정도 그대로입니다 — **공백 문자열이 truthy 인 것까지 포함**해서요.
쿠팡이 그 경로를 어떻게 다루는지 재 본 적이 없으므로 **판정 없이 고치지
않았습니다**(KC-COUPANG-02 §3 의 결정 그대로).

### 🔴 신뢰도·점수를 «일부러» 바꾸지 않았습니다

```ts
DEFAULT_VALUE: 0.7,
SETTINGS_DEFAULT: 0.7,   // 🔴 같은 값
```
판매자가 쓴 문구이니 더 높여야 한다는 주장이 가능합니다. 그러나 이 숫자는
Compliance Score 와 화면의 「높음/보통/낮음」에 그대로 들어갑니다 —
**이번 규칙은 「행동은 바뀌지 않는다」** 입니다. 재조정은 별도 판단 사안입니다.

---

## 2. 🔴 화면 문구 — 판매자가 읽는 문장이 사실과 맞는가

| 출처 | 전 | 후 |
|---|---|---|
| Settings 문구 | 「따져가 «자동으로» 입력한 기본값입니다」 🔴 **거짓** | **「판매자 설정에 입력된 문구입니다」** |
| 코드 기본값 | 같은 문장 | **「따져가가 기본으로 입력한 문구입니다」** |
| 상품별 입력 | (확인 카드에 안 뜸) | 그대로 |

그리고 공통 문장은 「**등록 전에 내용을 확인해 주세요.**」로 두고, 법적 판정을
하지 않는다는 문장은 **그대로 유지**했습니다.

준비도 카드(`readiness.ts`)와 카테고리 편집기 라벨도 같은 기준으로 갈랐습니다.

---

## 3. 검증 — 세 겹

### 🟢 ㉮ 동작 (빌더 출력)
`kc-coupang04-provenance-split.test.ts` **23건**
- 세 출처가 각각 제 이름을 받는가
- payload 값이 한 글자도 안 바뀌었는가(공백 경로 포함)
- **확인 요구가 두 출처 «모두» 에서 유지되는가**
- 준비도 목록에서 항목이 사라지지 않았는가 · **점수가 같은가**
- 다른 채널(네이버·롯데ON)과 Common 어휘를 건드리지 않았는가

### 🟢 ㉯ 화면 (마운트한 DOM) — 「소스 PASS ≠ Render PASS」
`kc-coupang04-modal-render.test.ts` **12건** — 실제로 `createRoot` 로 모달을
마운트해 `textContent` 를 읽습니다.
- 출처별 문장이 «화면에» 맞게 나오는가
- 🔴 판매자 문구를 「자동으로 넣었다」고 말하지 «않는가»
- 확인 체크박스가 두 출처 모두에서 «그려지는가»
- 내부 코드명(`SETTINGS_DEFAULT`·`DEFAULT_VALUE`)이 본문에 안 나오는가

### 🔴 ㉰ 음성 대조 — 세 번, 전부 잡혔습니다

| NC | 주입한 회귀 | 결과 |
|---|---|---|
| NC-1 | `autoFilled` 에서 `SETTINGS_DEFAULT` 누락 | 🟢 **1건 FAIL** |
| NC-2 | `defaultsApplied` 에서 `SETTINGS_DEFAULT` 누락 | 🟢 **2건 FAIL** |
| NC-3 | 모달 문구를 다시 하나로 뭉갬 | 🟢 **3건 FAIL** |

NC-1·NC-2 가 바로 **「확인 요구가 조용히 사라지는」** 회귀입니다.

---

## 4. 🔴 기존 가드가 저를 잡았습니다 — 옮겼고, 지우지 않았습니다

`p0kc03-coupang-notice-gate.test.ts` 가 FAIL 했습니다.

```ts
expect(BUILDER).toContain("value: context.kcExemptionText || DEFAULT_KC_EXEMPTION_TEXT,");
```

이 가드는 빌더의 **한 줄을 글자 그대로** 고정하고 있었고, 04 는 그 줄에서 출처
이름만 갈랐습니다. 지켜야 하는 것은 **그 줄의 글자가 아니라 「값을 고르는 규칙이
그대로인가」** 이므로, 문자열 대신 **실제 출력**으로 재도록 옮겼습니다 —
그게 원래 이 가드의 뜻이었습니다. 그리고 「확인 여부가 값에 영향을 주지
않는다」는 **행동 검증을 하나 더** 붙였습니다.

두 번째 FAIL 은 제 실수였습니다 — 새 문구를 줄바꿈해 넣는 바람에
`법적으로 판정하지 않습니다` 가 **두 줄로 갈렸고**, 가드가 정확히 그것을
잡았습니다. 한 줄로 되돌렸습니다.

---

## 5. 🔴 곁들여 고친 것 — 제가 앞서 넣은 tsc 오류 1건

KC-COUPANG-02 커밋에 `packages/listing` tsc 오류를 하나 남겼습니다
(`kc-coupang02-notice-content.test.ts:88`). 그때 **admin tsc 만 돌려서**
놓쳤습니다. `git stash` 로 대조해 확인했고, 고친 뒤 **기존 5건**으로
돌아왔습니다(나머지 5건은 이번 작업 전부터 있던 것).

---

## 6. Common KC 에는 연결하지 «않았습니다»

```
🔴 쿠팡의 kcExemptionText 는 Common KC 와 «같은 개념으로 취급하지 않는다».
```

- `FieldValueSource`(Common 어휘)에 `SETTINGS_DEFAULT` 를 **넣지 않았습니다**
  — 테스트가 고정합니다. `SETTINGS_DEFAULT` 는 **쿠팡 채점 어휘**입니다.
- `CommonConfirmation` · `policyVersion` · `kc_status` · `certifications` —
  전부 손대지 않았습니다.
- 네이버·롯데ON 빌더에 이 이름이 없다는 것도 테스트가 고정합니다.

---

## 7. 검증 요약

```
admin      374 파일 · 5057 테스트 PASS · tsc 0
listing     52 파일 ·  703 테스트 PASS · tsc 기존 5건(내 것 0)
음성 대조    3회 · 전부 FAIL 로 잡힘
화면        마운트한 DOM 으로 12건 확인
```

## 8. 이번에 «하지 않은» 것

Common KC 연결 ❌ · `CommonConfirmation` ❌ · `policyVersion` ❌ ·
`certifications` ❌ · KC 기본 문구 변경 ❌ · payload 값 변경 ❌ ·
공백 경로 수정 ❌ · 신뢰도/점수 재조정 ❌ · 확인 요구 축소 ❌ ·
DB migration ❌ · 다른 채널 변경 ❌.
