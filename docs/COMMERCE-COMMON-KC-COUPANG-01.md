# COMMERCE-COMMON-KC-COUPANG-01 — 쿠팡에 Common Confirmation 의 근거가 있는가

> CPO 작업지시(2026-09-28). **조사만. 코드 변경 0.**
> 쿠팡 payload ❌ · 기본 문구 삭제/변경 ❌ · `certifications` 연결 ❌ ·
> Common Confirmation 연결 ❌ · KC Readiness 변경 ❌ · UI ❌ · migration ❌ ·
> 롯데ON 작업 ❌.

---

## 0. 🔴 먼저 — 필드 이름 정정과 «네 개» 의 실제 자리

작업지시의 `notices[].certifications` 는 공식 스펙에 없습니다.
공식은 **`items[].certifications`** 로, `items[].notices` 의 **형제**입니다.
둘은 부모-자식이 아니라 **나란한 두 칸**입니다 — 이 구분이 Q1 의 답 전부입니다.

```
items[]
 ├─ notices[]         고시정보 — 소비자에게 «보이는 문장»      🟢 우리가 채운다
 ├─ certifications[]  인증 기록 — 인증유형·인증번호·첨부파일   🔴 우리 참조 0건
 └─ deliveryMethod / pccNeeded   배송·통관 축 — 구매대행 «선언»  🟢 우리가 쓴다
```

| 개념 | 어디에 사는가 | 누가 정하는가 | 지금 우리 상태 |
|---|---|---|---|
| `DEFAULT_KC_EXEMPTION_TEXT` | `notices[].content` 한 칸의 **값** | 🔴 **우리** (공식 기본값 아님) | 채우고 있다 |
| `CommonConfirmation` | DB `seller_compliance_confirmations` | 우리 | 🔴 쿠팡은 **저장 0** |
| KC certification | `items[].certifications[]` | 쿠팡(공식 스펙) | 🔴 **참조 0건** |
| `AGENT_BUY` / `pccNeeded` | `items` 최상위 배송/통관 축 | 쿠팡(공식 스펙) | 🟢 올바르게 쓰고 있다 |

🔴 **넷은 서로를 대신하지 않습니다.** 아래 전부 이 표를 기준으로 답합니다.

---

## Q1. 공식 `items[].certifications` 와 현재 payload 의 관계

**관계가 없습니다 — 서로 다른 칸이고, 우리는 한쪽만 씁니다.**

```
$ grep -rn "certifications" --include=*.ts --include=*.tsx packages apps
apps/admin/.../lotteon-channel-form.ts:334   ← 롯데ON sftyAthnLst 파싱
apps/admin/.../lotteon-channel-form.ts:339   ← 롯데ON 건수 표시
→ 쿠팡 참조 «0건»
```

| | `notices[].content` | `items[].certifications[]` |
|---|---|---|
| 성격 | **문장** (소비자 노출) | **구조화 기록** (`certificationType`·`certificationCode`·`certificationAttachments`) |
| 공식 요구도 | 배열은 선택, 보내면 `noticeCategoryName`·`content` 필수 | **선택** |
| 우리 | 🟢 채운다 | 🔴 0건 |

🔴 그래서 **「KC 문구를 넣었으니 인증을 선언했다」가 성립하지 않습니다.**
우리는 인증 칸을 **한 번도 건드린 적이 없고**, 채운 것은 고시 문장 한 줄입니다.
이 저장소에 같은 혼동의 선례가 이미 기록돼 있습니다 — `manufacture`(최상위)와
`notices` 의 제조사를 하나로 다루다 48건 전부 최상위가 빈 채 나갔습니다
(`build-payload.ts:208~217`: 「두 자리는 «다른 것» 이다 … 하나의 manufacturer 로
합쳐 다루면 같은 사고가 다시 난다」).

---

## Q2. `AGENT_BUY` + `pccNeeded` 와 KC 확인/면제의 관계

**KC 와 관계가 없습니다. 다른 축입니다.**

```ts
// build-payload.ts:223~228 — 공식 문서 근거 주석 원문 포함
deliveryMethod: "AGENT_BUY"   // 해외 구매대행
pccNeeded: boolean            // 공식: AGENT_BUY 면 true 여야 한다
```
> 원문: 「…AGENT_BUY를 쓰면 출고지가 반드시 해외 주소여야 하고, pccNeeded도
> true여야 한다」 (developers.coupang.com, "overseas buying agent" 문서로 확인)

| 축 | 무엇을 말하는가 | 쿠팡 공식 기전 |
|---|---|---|
| 배송/통관 | **「이 상품은 구매대행이다」** | 🟢 `AGENT_BUY` + `pccNeeded` |
| 인증 | **「이 상품의 인증은 무엇인가」** | `certifications[]` (우리 미사용) |
| 고시 | **「소비자에게 무엇을 보여주는가」** | `notices[].content` |

### 🔴 그래서 기본 문구는 «두 조각» 이고, 성격이 다릅니다

```
"KC마크 없이  |  구매대행 가능한 품목"
      ↑                 ↑
 검증되지 않은      이미 AGENT_BUY 로
 인증 관련 주장      선언한 사실 — 중복
```

🔴 **이것은 관찰이지 수정 제안이 아닙니다.** KC-02 에서 이미 같은 결론에
도달했고, 문구 변경은 CPO **HOLD**(정책 리스크) 상태 그대로 둡니다.

---

## Q3. 기본 문구가 «실제 등록에 필요한 값» 인가

**칸은 필요합니다. 그 «문장» 은 아닙니다.** 둘을 나눠야 답이 나옵니다.

### 🟢 (a) 칸 — 필요하다 (실측 근거 있음)

```
// apps/admin/src/app/api/coupang/_lib/category-meta.ts:5~8 (원문)
register 라우트가 등록 시점에 매번 호출해서 payload의 items[].attributes[]/
notices[]를 채운다. 빈 배열로 보내면 실제 쿠팡 API가 "고시정보 입력해야
합니다"로 거부한다(실등록 시도로 확인).
```
register 라우트 `:406~408` 에 같은 문장이 다시 적혀 있습니다.
→ **「고시정보를 안 보내면 거부당한다」는 실측으로 확인된 사실입니다.**

그리고 채우는 대상은 **MANDATORY 만** 입니다.

```ts
// build-payload.ts:1309
.filter((detail) => detail.required === "MANDATORY")
```

### 🔴 (b) 문장 — 쿠팡이 정한 값이 아니다

KC-02 A-2: 공식 문서에 **기본값·placeholder 정의가 없습니다.**
`DEFAULT_KC_EXEMPTION_TEXT` 는 **우리가 지은 문장**입니다.

### 🟢 (c) 그리고 이 칸은 «자주 나타나지도 않습니다»

조사 중 새로 확인한 것 — 빌더가 **KC 필수가 없는 고시 카테고리를 우선**합니다.

```ts
// build-payload.ts:852~856
const noticeCategoryHasMandatoryKc = (c) =>
  c.noticeCategoryDetailNames.some(
    (d) => d.required === "MANDATORY" &&
      (d.noticeCategoryDetailName.includes("인증") || d.noticeCategoryDetailName.includes("허가")),
  );
```
> 원문: 「KC가 필요 없는 카테고리부터 실제 등록 성공을 확보하라 … KC가 아예
> 없는 대안이 있고 그 이름이 실제 상품명과 관련 있어 보일 때만 그쪽을 우선한다」

🔴 단, **어린이제품은 이 우선 규칙보다 뒤에 오는 분기가 이깁니다**
(`:865` — `isLikelyChildrenProduct` 면 「어린이」 고시 카테고리를 강제).
→ **우리 주력 품목(아동의류)에서는 KC-free 회피가 작동하지 않을 수 있습니다.**

**Q3 답**: 고시 **칸**은 필수(실측). **그 문장**은 우리 선택이고 공식 근거 없음.

---

## Q4. 그 문구가 없으면 실제로 실패하는가

**두 경우를 나눠야 하고, 한쪽은 «모릅니다».**

| 경우 | 실패하는가 | 근거 |
|---|---|---|
| `notices` 를 **아예 안 보냄** | 🟢 **실패한다** | 실등록 확인 — "고시정보 입력해야 합니다" |
| MANDATORY 인증 칸의 `content` 가 **빈 문자열** | 🔴 **모른다 — 재본 적이 없다** | 아래 |

### 🔴 왜 모르는가 — 빈 값이 «구조적으로 생기지 않는다»

```ts
// build-payload.ts:1364~1371 — 마지막 분기가 항상 값을 낸다
return { fieldName: …, value: NOTICE_DEFAULT_CONTENT, source: "DEFAULT_VALUE", … };

// :1375~1380 — 그 결과를 그대로 옮길 뿐, 빈 값 필터가 없다
const notices = noticeResults.map((r) => ({ …, content: r.value }));
```
사다리가 **반드시** 값을 채웁니다(`USER_INPUT → KNOWN_VALUE → PRODUCT_FIELD →
KC 기본값 → 고시 기본값`). 그래서 「빈 content」 상태는 **실행된 적이 없고**,
쿠팡이 그것을 거부하는지도 **측정된 적이 없습니다.**

🔴 코드 주석은 「이 기본값 하나만으로 **KC 블로커가 즉시 풀린다**」(`:1345`)고
말하지만, 그 「블로커」는 **우리 쪽 미충족 상태**를 가리키는 표현이고
**쿠팡 서버의 거부 실측이 아닙니다.** 이 둘을 섞으면 안 됩니다.

**Q4 답**: 「고시 자체가 없으면 실패」는 🟢 확인됨. 「이 문구가 없으면 실패」는
🔴 **확인되지 않음.** 그리고 지금 구조에서는 확인할 방법이 없습니다
(실제 등록을 일부러 빈 값으로 시도해야 하므로 — **하지 않았습니다**).

---

## Q5. 쿠팡 서버/API 가 seller confirmation 을 요구하는가

🔴 **아니오. 쿠팡에는 확인(confirmation) 개념 자체가 없습니다.**

- 공식 상품 생성 API 에 확인 관련 필드 **없음**(KC-02 A-1).
- `confirmed` / `policyVersion` / `confirmedAt` 에 대응하는 칸 **없음**.
- 우리 모달은 **우리가 만든 것**입니다.

→ 쿠팡 확인은 **규제 요구가 아니라 우리 내부 통제**입니다. 이 구분이 Q8 의
전제가 됩니다.

---

## Q6. 🔴 「모달이 열리지만 게이트가 없다」 — 전제가 절반 틀렸습니다

**게이트는 있습니다. 없는 것은 «기록» 과 «서버 재검증» 입니다.**

```ts
// ListingConfirmationModal.tsx:139~143
const autoFilledCoupangNotices = (coupangKcNotices ?? []).filter((n) => n.autoFilled);
const coupangNoticeNeedsReview = autoFilledCoupangNotices.length > 0;
const coupangNoticeRegistrable = !coupangNoticeNeedsReview || coupangNoticeConfirmed;
// :143 → canConfirm 에 들어간다 = 체크 안 하면 확인 버튼이 «안 눌린다»
```

```
확인 «행위»     🟢 있다 — 3채널 공용 모달
확인 «게이트»   🟢 있다 — 클라이언트(버튼 차단), P0-KC-03
확인 «기록»     🔴 없다 — POST 는 스마트스토어일 때만 (:152)
서버 «재검증»   🔴 없다 — coupang/register 는 확인을 읽지 않는다
```

### 왜 그렇게 됐는지 «기록돼 있습니다»

P0-KC-03 테스트 헤더 원문 —
> 「스마트스토어의 KcStatus / `seller_compliance_confirmations` 체계를 쿠팡에
>  **복사하지 않았다**」

그리고 복사할 수 없었던 구조적 이유는 KC-03 에 있습니다 —
`seller_compliance_confirmations.kc_status` 가 `NOT NULL` 이고 CHECK 가
**네이버 어휘 네 값**에 묶여 있어, 쿠팡 확인을 저장하려면 **네이버 상태값을
지어내야** 합니다. CHECK 확장은 migration 입니다.

### 🔴 그래서 지금 쿠팡 확인은 «사라집니다»

```
판매자가 문구를 보고 체크    →   등록 진행
                              →   🔴 확인했다는 사실이 «어디에도 안 남는다»
```
새로고침하면 `useState(false)` 로 돌아가고, 감사 기록도 없습니다.
→ **빈 칸은 「게이트」가 아니라 「기록·재검증」 두 개입니다.**

### 🔴 뜻의 차이도 같이 봐야 합니다

| | 확인의 «뜻» |
|---|---|
| 스마트스토어 | 「**판매 전 최종 확인**」 — 모든 카테고리, KIDS 무관 |
| 쿠팡 | 「**지금 등록될 문구가 무엇인지 봤다**」 그 하나뿐 |

P0-KC-03 원문: 「그 확인의 뜻은 「지금 등록될 문구를 봤다」뿐이다 — 「이 상품이
법적으로 KC 면제다」도, 「따져가 면제를 확인했다」도 아니다.」

---

## Q7. `FieldRule` 에 KC 가 없는 것은 셋 중 무엇인가

**① 진짜 OPTIONAL 인가 / ② readiness 계산에서 제외인가 / ③ 실시간 API 부족인가**

### 답: 🔴 **①이 아니다. ②와 ③이 맞고, 둘은 같은 원인의 앞뒤다.**

#### ① 진짜 OPTIONAL? — **아니다. 그 층에 개념 자체가 없다**

```
$ grep -n "field:" packages/marketplace/src/adapters/coupang.adapter.ts
title · brand · representativeImage · price · stock · stockUnknown ·
options · shipping · description                                    ← 9개

$ grep -n "KC\|인증\|고시\|notice\|complian" .../coupang.adapter.ts
(결과 없음)
```
→ 🔴 **「OPTIONAL 로 판정」된 적이 없습니다. 판정 대상에 오른 적이 없습니다.**
「없음」과 「OPTIONAL」은 다른 사실입니다.

#### ② readiness 제외? — **맞다. 명시적으로 기록돼 있다**

```
// compute-readiness.ts:381~386 (원문)
compliance report(고시/KC 등)는 카테고리 API 실시간 조회가 필요해 이번 대시보드
배치 계산에서는 제외한다 … 이 카드는 "1차 판단"이지 최종 게이트와 100% 동일하지 않다.
```
그리고 쿠팡 경로는 `kcStatus` 를 **넘기지도 않습니다**
(`:389 resolveRegistrationReadinessState(summary, priceValid)` — 3번째 인자 없음).
대조군: 스마트스토어 `:360` 은 `(summary, priceValid, validation.kcStatus)`.

#### ③ 실시간 API 부족? — **맞다. 그리고 이것이 ②의 원인이다**

「어느 고시 항목이 MANDATORY 인가」는 **카테고리 메타 API 응답에만** 있습니다
(`CategoryNoticeDetailMeta.required`). 그런데 adapter 의 `toListingModel` 은
**네트워크 없는 순수 함수**라 그 사실에 닿을 수 없습니다.

```
쿠팡 KC 요구도는 «카테고리마다 다르다»  →  live API 가 있어야 안다
adapter/배치 계산은 네트워크를 안 탄다  →  구조적으로 알 수 없다
                                       →  FieldRule 에 «못 쓴 것»
```

**Q7 답**: 🔴 **「없다」가 아니라 「재지 않았다」.** KC-READINESS-01 §1 의 결론이
adapter 층에서도 그대로 확인됩니다.

---

## Q8. 🔴 Common Confirmation 을 쿠팡에 적용할 근거가 있는가

### 답: **근거는 «반쪽» 있습니다 — 그리고 지금 연결하면 안 됩니다.**

#### 🟢 있는 쪽 — 확인 행위가 이미 실재하고, 이미 막고 있다

| Common Confirmation 이 요구하는 칸 | 쿠팡에 있는가 |
|---|---|
| `confirmed` | 🟢 있다 — `coupangNoticeConfirmed` |
| `confirmedAt` | 🟡 만들 수 있다 |
| `platform` | 🟢 `"coupang"` |
| `categoryCode` | 🟢 `displayCategoryCode` |
| `policyVersion` | 🔴 **없다** |

그리고 **실재하는 빈 칸**이 하나 있습니다 — 판매자가 체크한 사실이
**아무 데도 남지 않습니다**(Q6). 감사 관점에서 이것은 진짜 결함입니다.

#### 🔴 없는 쪽 — 연결하려면 «새로 만들어야 하는 것» 이 둘

```
① policyVersion   COMPLIANCE_POLICY_VERSION 은 naver/compliance.ts 안에 있고
                  쓰는 곳도 네이버뿐이다. Common 계약은 «채널이 버전의 주인»
                  이라고 정했다 → 쿠팡 정책 버전을 «우리가 새로 정의» 해야 한다.
                  🔴 그것은 읽기 계약이 아니라 «새 정책» 이다.

② 저장 자리       seller_compliance_confirmations.kc_status 는 NOT NULL 이고
                  CHECK 가 네이버 4값. 쿠팡 확인을 넣으려면 네이버 상태값을
                  지어내거나 CHECK 를 넓혀야 한다 → 🔴 migration.
```

#### 🔴 그리고 섞으면 안 되는 위험이 하나 더

두 확인의 **뜻이 다릅니다**(Q6 표). 같은 `CommonConfirmation` 으로 읽는 순간
「문구를 봤다」가 「판매 전 최종 확인을 마쳤다」와 **구별되지 않습니다.**
`CommonConfirmation` 에는 **「무엇을 확인했는가」 칸이 없습니다** — 범위 세 축은
`platform`·`categoryCode`·`policyVersion` 뿐입니다(설계상 의도).

→ 🔴 **이 상태로 붙이면 없던 동등성을 우리가 만들어냅니다.**

---

## 정리표 — 8문 8답

| # | 질문 | 답 |
|---|---|---|
| 1 | `certifications` 와 payload 관계 | 🔴 **관계 없음.** 형제 칸이고 참조 0건 |
| 2 | `AGENT_BUY`+`pccNeeded` ↔ KC | 🔴 **다른 축.** 구매대행 선언은 이미 올바른 자리에서 함 |
| 3 | 기본 문구가 필요한 값인가 | 🟡 **칸은 필수(실측), 문장은 우리 것** |
| 4 | 없으면 실패하는가 | 🟡 고시 자체 없으면 🟢 실패 / **그 문구가 없을 때는 🔴 미측정** |
| 5 | 서버가 confirmation 요구? | 🔴 **아니오 — 개념 자체가 없음** |
| 6 | 모달은 열리는데 게이트가 없는 이유 | 🔴 **전제 정정: 게이트는 있음.** 없는 건 «기록·서버 재검증» |
| 7 | `FieldRule` 에 KC 없음의 뜻 | 🔴 **「재지 않았다」** — 실시간 API 필요 → 배치에서 제외 |
| 8 | Common Confirmation 근거 | 🟡 **반쪽.** 행위는 있으나 정책버전·저장자리를 «새로 만들어야» 함 |

---

## 권고 (CPO 결정용, 제 권고 포함)

| 안 | 내용 | 대가 |
|---|---|---|
| **①** | **지금은 연결하지 않는다.** 쿠팡은 Common Confirmation 대상에서 보류 | 🟢 위험 0. Q6 의 기록 빈 칸은 남는다. **제 권고** |
| ② | 쿠팡 «정책 버전» 을 먼저 정의한 뒤 연결 | 🔴 새 정책 결정 — CPO/CEO 사안 |
| ③ | 저장만 먼저 만든다(확인 기록) | 🔴 migration — CEO 승인 필요 |

🔴 ①을 권하는 이유는 「쿠팡에 KC 요구가 없어서」가 **아닙니다.**
**요구를 재 본 적이 없기 때문**입니다(Q7). 재지 않은 것을 근거로 공통 계약을
붙이면, KC-READINESS-01 에서 피한 실수 — **없던 요구를 우리가 만드는 것** —
을 다른 문으로 다시 하게 됩니다.

### 🔴 별도로 남겨야 할 사실 (HOLD 아님, 결함)

**판매자가 쿠팡 문구를 확인한 기록이 어디에도 남지 않습니다.**
이것은 Common 화 여부와 무관한 **감사 빈 칸**입니다. ①을 택하더라도 이 사실은
지워지지 않으므로 별도 항목으로 추적하기를 권합니다.

---

## 이번에 «하지 않은» 것

코드 변경 **0**. 쿠팡 payload ❌ · 기본 문구 삭제/변경 ❌ · `certifications`
연결 ❌ · Common Confirmation 연결 ❌ · KC Readiness 변경 ❌ · UI ❌ ·
migration ❌ · 롯데ON ❌ · 빈 값 실등록 시도 ❌ · KC 면제 판정 ❌.
