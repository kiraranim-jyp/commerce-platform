# WU-019F — 등록 단계의 Category / Sourcing 전수 추적 (조사만 · 코드 0)

🔴 운영 코드 변경 **0** · UI 0 · validation 0 · API 0 · Registry 0 · schema 0 ·
DB 쓰기 0 · MI 0 · threshold 0 · AI 0 · Gemini 0 · **HTTP 0** · 비용 ₩0 · 배포 0.

🟢 범위 — WU-019E 가 남긴 UNKNOWN 중 **「등록」 칸 하나**. 「가격」·「상단 Flow」·
「상품정보 영역」은 이 WU 에서 **열지 않았다**(UNKNOWN 유지).

---

## ⓪ 먼저 — 직전 세션의 전제 하나를 정정한다

```
직전 보고   grep "export function buildCoupangPayload"    → 0건
            find apps/admin/src -name build-payload.ts     → 0건
            → 「실제 정의 위치/시그니처가 가정과 다르다 · build-payload.ts 는 이 리포에 없다」

🔴 **틀렸다.** 검색 범위가 `apps/admin/src` 로 좁혀져 있었다.
🟢 정의는 전부 **`packages/listing/src`** 에 있다(실측):
```

| 함수 | 정의 | 줄수 |
|---|---|---|
| `buildCoupangPayload` | `packages/listing/src/coupang/build-payload.ts` | 2,035 |
| `buildSmartStorePayload` | `packages/listing/src/smartstore/build-payload.ts:44` | 77 |
| `buildLotteOnPayload` | `packages/listing/src/lotteon/build-payload.ts` | 538 |
| `resolveLotteOnNotice` | `packages/listing/src/lotteon/notice-resolve.ts:401` | 416 |
| `buildNaverProductPayload` | `packages/listing/src/naver/build-payload.ts` | — |

🔴 `buildSmartStorePayload` 를 **스마트스토어 실등록 경로로 읽지 않는다** — 그 파일
머리 주석이 명시한다: 「실제 네이버 커머스 API 요청 바디를 그대로 흉내내지 않는다 …
**DRY_RUN** 으로 보여주기 위한 내부 표현이다」. 실등록은 `buildNaverProductPayload` 다.

### 등록 입구 셋 (운영 호출부)

```
Coupang      api/coupang/register/route.ts:618   buildCoupangPayload(product, listing, {...})
LotteON      api/lotteon/_lib/build-context.ts → buildLotteOnPayload(context.input)
             (같은 조립을 payload-preview/route.ts:301 이 재사용한다)
SmartStore   api/smartstore/register/route.ts    buildNaverProductPayload(payloadInput)
```

---

## ① Category — ⚪ **등록에서 미사용** (전수 0건)

```
검색어  categoryScopes · marketCategoryProfileId · categoryScope
  api/coupang/register   **0건**
  api/lotteon/register   **0건**
  api/smartstore/register **0건**
  packages/listing/src    **0건**   (등록 payload 계층 전체)
  packages/marketplace/src **0건**
```

🔴🔴 **혼동 금지 — payload 안의 「카테고리」는 «다른 축» 이다.**

```
019E 의 Category = `categoryScopes`(KIDS_FASHION · TENNIS …)
                 ← 상품 + workspace 프로필에서 파생 · **Discovery 샵 선택** 에 쓰인다
등록 payload 의 카테고리 = **마켓 카테고리**
                 쿠팡 `displayCategoryCode`(register/route.ts:165·815)
                 네이버 `leafCategoryId`(smartstore/build-payload.ts)
                 출처는 `listing.category.candidate`(register/route.ts:549)
🟢 둘은 이름만 겹치고 **owner 도 값 공간도 다르다.** 「등록에 카테고리가 없다」로
   읽으면 틀린다 — 「**019E 가 말한 그 Category 가** 등록에 들어가지 않는다」가 맞다.
```

→ **019E 표의 Category / 등록 칸 = ⚪ 미사용 (확정)**

---

## ② Sourcing ① (사용자 선택) — ⚪ **payload 미사용** · 🟡 **게이트는 UI 하나뿐**

### 🔴 먼저 칸 이름부터 — `selectedSource` 라는 식별자는 리포에 **0건** 이다

```
grep "selectedSource|selected_source"  (*.ts · *.tsx · *.sql)  → **0 files**
🟢 실제 칸 = **`products.selected_sourcing_candidate_id`**
   owner: lib/selected-source-policy.ts:34  SELECTION_WRITABLE_COLUMNS
          「선택 시 selected_sourcing_candidate_id «만» 변경」을 구조로 못박은 자리
🔴 이 트랙에서 반복된 「칸 이름을 추측한다」 함정이 또 걸릴 자리였다
   (메모 measure-with-the-production-function).
```

### 소비자 전수 — 17 파일 중 등록 경로 **0**

```
grep "selected_sourcing_candidate_id|selectedCandidateId|sourcing_candidates" → 17 files
  pipeline/commerce/{workflow.ts, SourcingPanel.tsx}
  api/products/[productId]/{selected-source, sourcing-candidates}/… + _lib 2
  lib/{selected-source-policy.ts, sourcing-candidate-policy.ts, master-ready.ts}
  api/snapshots/_lib/types.ts(**주석만**) · 테스트 7
🔴 api/coupang|lotteon|smartstore/register  → **0**
🔴 packages/listing · packages/marketplace  → **0**
   (검색어 `sourcing|selected-source|selectedSource` 전체 0건)
```

### 유일한 다리 — 그리고 그 다리는 **등록 API 에 닿지 않는다**

```
selected_sourcing_candidate_id
  → computeMasterReady(lib/master-ready.ts:79 · 순수 함수)
      selectedCandidateId 가 null  → readyForCommerce **false** · stage SOURCING_READY
      선택됨 + 등록 readiness 통과 → readyForCommerce **true** · READY_FOR_COMMERCE
  → `readyForCommerce` 소비자 전수 = **SourcingPanel.tsx:317 하나**
```

🔴🔴 **그래서 사실 하나가 확정된다** — 서버 등록 API 셋 중 **어느 것도 소싱 선택을
읽지 않는다.** `readyForCommerce === false` 인 상태로 register 를 직접 호출해도 소싱
축에서는 막히지 않는다.

🔴 **이것을 「결함」으로 단정하지 않는다.** 등록에는 **다른** 서버 게이트가 있다 —
쿠팡은 `payload.displayCategoryCode == null → missing.push("쿠팡 카테고리 코드")`
(register/route.ts:165) 처럼 **payload 완결성** 으로 막는다. 즉 막는 축이 다를 뿐이고,
「소싱 미선택 상태의 등록이 실제로 통과하는가」는 **이 WU 에서 실행하지 않았다**(측정불가).

→ **019E 표의 Sourcing ① / 등록 칸 = ⚪ payload 미사용 · 🟡 게이트는 UI 전용**

---

## ③ 019E 표 갱신 — 등록 칸만

| 입력 | 등록 (019E) | 등록 (019F 실측) |
|---|---|---|
| Category (`categoryScopes`) | 🟡 UNKNOWN | ⚪ **미사용** (register 3 + listing + marketplace 전수 0) |
| Sourcing ① (`selected_sourcing_candidate_id`) | 🟡 UNKNOWN | ⚪ **payload 미사용** · 🟡 UI 게이트만 |

🔴 **나머지 UNKNOWN 은 그대로다** — 가격 · 상단 Flow · 상품정보 영역 · Sourcing ①의
「분석」 칸. 이 WU 는 등록 칸만 닫았다.

---

## ④ 🔴 UNKNOWN 으로 남긴 것 (0 으로 적지 않는다)

```
① 소싱 미선택 상태에서 register 가 실제로 통과하는가 — **미실행**(Production write 금지)
② 가격 칸 — categoryScopes/sourcing 의 가격 경로 사용 여부는 열지 않았다
③ 상단 Flow · 상품정보 영역 UI 2곳 — 019E 가 남긴 UNKNOWN 그대로
④ LotteON/SmartStore register 의 payload 완결성 게이트 목록 — 쿠팡만 한 줄 확인했다
```

## ⑤ 다음 작업 후보 — 1개

🟡 **가격 칸 + UI 2곳**(상단 Flow · 상품정보 영역)의 category/sourcing 추적.
019E 가 남긴 UNKNOWN 중 등록을 제외한 나머지를 닫는 것 하나다. 🔴 조사만.
