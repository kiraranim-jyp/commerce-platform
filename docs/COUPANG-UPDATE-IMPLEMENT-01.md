# COUPANG-UPDATE-IMPLEMENT-01 — 🟡 실행부까지 완료 · 배선은 다음 커밋

> CPO 작업지시(2026-09-28). Phase 1~5.
> 🔴 **결론부터: 「구현 완료 · 배포」가 아닙니다.** 서버 실행부와 안전장치는
> 만들어졌고 검증됐지만, **화면 배선을 이번에 하지 않았습니다.** 이유는 §4 입니다.

```
admin     376 파일 · 5112 테스트 PASS · tsc 0
listing    54 파일 ·  735 테스트 PASS · tsc 기존 5건
음성 대조   4회 · 전부 FAIL 로 잡힘
```

---

## 1. 만든 것 (Phase 1~4)

| # | 파일 | 역할 |
|---|---|---|
| ① | `listing/coupang/registered-baseline.ts` | **overlay** — baseline 복사 후 «고친 칸만» 덮는다 · **상태 게이트** |
| ② | `listing/coupang/update-preflight.ts` | **손실 가드** — 사라지거나 줄면 BLOCKED |
| ③ | `api/coupang/_lib/update-product.ts` | **GET → 상태 → overlay → 손실검사 → PUT → 상품번호 검증** |
| ④ | `api/coupang/_lib/client.ts` | `PUT` 허용(`DELETE` 는 여전히 불가) |
| ⑤ | `channel-lifecycle.ts` | `SUPPORTED_WHEN_SAVED` 상태 + `resolveSavedScopedUpdate()` |

### 🔴 Master 재생성 경로가 «없다» (CPO 최우선 금지)

```ts
// update-product.ts — 순서가 곧 안전장치다
const fetched = await fetchCoupangBaseline(...)     // ① baseline 없으면 실패
const gate    = coupangUpdateGate(baseline)          // ② SAVED 아니면 막는다
const outgoing = applyCoupangEdits(baseline, edits)  // ③ 고친 칸만 덮는다
const risks   = detectCoupangUpdateLoss(baseline, outgoing)  // ④ 줄면 막는다
await callCoupangApi(..., { method: "PUT", body: outgoing }) // ⑤ 넷을 통과해야만
```

테스트가 **호출 순서까지** 고정하고, `buildCoupangPayload`·`toListingModel`·
`CanonicalProduct` 가 이 파일에 **없다**는 것도 고정합니다.

### Phase 3 — `displayCategoryPath`: **변환할 것이 없습니다**

공식 필드가 아닙니다(빌더 주석 `build-payload.ts:196`). 쿠팡이 저장한 적이 없어서
GET 에 안 돌아온 것이고, UPDATE 때 보내지 않으면 끝입니다. 🔴 앞선 보고의
「28/29」는 제 오류였고 `CAPABILITY-01` 문서에서 정정했습니다 — **공식 필드 왕복률 100%**.

---

## 2. Phase 5 — negative test

`coupang-update-baseline.test.ts` **32건** + `coupang-update-implement-01.test.ts` **23건**.
CPO 지정 9가지를 그대로 잽니다.

| CPO 케이스 | 결과 |
|---|---|
| Master 값으로 baseline 덮어씀 | 🟢 FAIL 로 잡힘 |
| 쿠팡 관리 필드 사라짐 | 🟢 FAIL |
| `items[]` 일부 누락 | 🟢 FAIL |
| `sellerProductItemId` 누락 | 🟢 FAIL |
| `certifications` 임의 생성 | 🟢 FAIL (`FABRICATED`) |
| SAVED 아닌 상태 UPDATE | 🟢 BLOCK |
| GET baseline 없이 PUT | 🟢 BLOCK |
| 실제 수정 필드만 변경 | 🟢 PASS |
| 수정 안 한 필드 → GET 값 유지 | 🟢 PASS |

**음성 대조 4회**: capability 를 `SUPPORTED` 로 올림(8건 FAIL) · 손실검사 무력화(1건) ·
`autoFilled` 축소(KC-04) · 문구 뭉갬(KC-04). 전부 잡혔습니다.

🔴 `certifications` 는 **줄어드는 것뿐 아니라 «늘어나는 것»** 도 막습니다. 실측에서
5개 옵션 전부 `[]` 였고, 전체 교체라 누가 값을 만들어 넣으면 그대로 인증 기록이
생깁니다 — KC 번호를 지어내지 않는다는 고정 원칙(「12313ㄹㅇ」 사건)의 연장입니다.

---

## 3. 🔴 하지 «않은» 것 — capability 를 올리지 않았고, 어댑터를 등록하지 않았습니다

```
CHANNEL_CAPABILITY.coupang.update  =  "UNKNOWN"   ← 그대로
EDIT_ADAPTERS                      =  { smartstore }  ← 그대로
```

---

## 4. 🔴 왜 — 가드 셋이 «나를 잡았습니다»

capability 를 올리고 어댑터를 등록하자 **22건이 FAIL** 했습니다. 읽어 보니
셋 다 같은 말을 하고 있었습니다.

| 가드 | 말한 것 |
|---|---|
| `commerce3-capability-parity ⑤` | 「수정 배선이 있는 채널은 하나다」 — `CommerceWorkspace` 가 아직 `/api/smartstore/registered-product` 만 부른다 |
| `commerce3-capability-parity ①` | 「어댑터가 등록되면 화면의 «확인되지 않았습니다» 가 사라진다」 |
| `p0channel03-sprintA-commerce-core ②` | 「어댑터 폴더 파일 수 = 등록된 커머스 수」 — 등록 안 된 어댑터 파일을 두지 않는다 |
| `p0channel03-lifecycle ⑥` | `resolveLifecycle.length === 3` — 판단 입력이 셋뿐이다 |

🔴 **가드가 옳았습니다.** capability 를 올리면 화면은 쿠팡 필드를 「고칠 수 있다」로
그리는데, `CommerceWorkspace` 의 수정 orchestration 이
`NaverProductRegistrationPayload` 에 **타입 수준에서 묶여 있어** 누를 곳이 없습니다.
그것은 「한 줄 배선」이 아니라 orchestration 리팩터이고, 지금 서두르면
**Production 검증이 끝난 SmartStore 수정 경로**를 흔듭니다.

### 그래서 한 일

```
🔴 가드를 약화시키지 않았다.  «사실» 을 가드에 맞췄다.
```

- `edit-adapters/coupang.ts` 를 **거뒀습니다**(배선 커밋에서 같이 들어갑니다).
- `api/coupang/registered-product` 라우트도 **거뒀습니다** — 부르는 화면이 없으면
  죽은 코드이고, 존재 자체가 「할 수 있다」는 주장이 됩니다.
- `resolveLifecycle` 의 4번째 인자를 **되돌렸습니다**. 대신 조건부 판정을
  `resolveSavedScopedUpdate(change, status)` 로 떼어 **직접 검증**합니다 —
  로직은 한 벌 그대로이고, 배선이 오면 호출부가 상태를 넘깁니다.
- `capability` 값은 **UNKNOWN 유지**. 대신 「올릴 값이 `SUPPORTED_WHEN_SAVED` 다」를
  소스와 테스트가 고정합니다.

사실과 달라진 가드 **하나만** 옮겼습니다 — `p0channel03-step6` 의 「값을 올리지
않았다」는 이제 「올릴 값이 무엇이고, 근거가 문서가 아니라 실측인가」를 잽니다.

---

## 5. 🔴 그리고 아직 «실행» 된 적이 없습니다

```
말할 수 있다  「이 경로는 만들어졌고 단위 검증됐다」
말할 수 없다  「쿠팡 PUT 이 실제로 성공한다」   ← 한 번도 보내지 않았다
말할 수 없다  「수정 후 sellerProductId 가 유지된다」 ← 문서 인용 없음 · 미측정
말할 수 없다  「승인된 상품도 된다」            ← 승인 상품이 0건
```

`SUBMIT`·`VERIFY` 단계는 **실패 경로까지 코드로는 있지만 실측이 없습니다.**

---

## 6. 다음 커밋에서 «같이» 올라가는 것

```
① CommerceWorkspace 수정 orchestration 을 채널 중립으로
   (basePayload 가 NaverProductRegistrationPayload 에 묶인 곳)
② api/coupang/registered-product 라우트
③ edit-adapters/coupang.ts + EDIT_ADAPTERS 등록
④ CHANNEL_CAPABILITY.coupang.update = "SUPPORTED_WHEN_SAVED"
⑤ resolveLifecycle 호출부가 상품 상태를 넘기도록
```

🔴 **넷을 나눠 올리면 그 사이마다 화면이 거짓말을 합니다.** 가드가 그것을 세고
있고, 이번에 그 값을 했습니다.

## 7. 이번에 «하지 않은» 것

실제 PUT ❌ · CREATE/RECREATE ❌ · 승인 요청 ❌ · DB 변경 ❌ ·
Master 재생성 경로 ❌ · capability 상승 ❌ · 어댑터 등록 ❌ ·
SmartStore 수정 경로 변경 ❌ · 가드 약화 ❌.
