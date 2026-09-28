# COUPANG-UPDATE-WIRE-01 · Phase 1 — outgoing source seam 판정

> CTO 조사 보고(2026-09-28, `4b5a63d` 기준). **코드 변경 0줄.**
> 지시서와 실제 구조가 다른 곳이 둘 있어 §7 에 증거와 함께 적는다.

## 0. 먼저 — 지시서의 경로 두 개가 실제와 다르다

```
지시서/인수인계             실제
pipeline/commerce/CommerceWorkspace.tsx   →  apps/admin/src/app/pipeline/CommerceWorkspace.tsx
node_modules/next/dist/docs/              →  apps/admin/node_modules/next/dist/docs/
                                             (루트에는 없다 · pnpm · Next 16.2.10)
```

Next 문서는 `01-app` · `02-pages` · `03-architecture` · `04-community` 네 묶음이다.
Phase 1 은 코드를 쓰지 않으므로 Route Handler 문서는 ③(GET 라우트) 직전에 읽는다.

---

## 1. SmartStore outgoing source

```
Master(product/listing)
  → 클라이언트가 계산한 payload           smartStorePayload           :2537
  → 「불러오기」 순간의 사본               channelEdit.basePayload     :2585
  → 지금 값                               current = smartStorePayload ?? basePayload   :2608
  → 무엇을 고쳤나                          editedFields(basePayload, current)           :2618
  → 초안                                   channelEditDraft(model, projectOutgoing(current), edited)  :2621
```

🔴 **SmartStore 의 「보낼 값」은 Master 재생성물이다.** 이것이 설계다 —
`basePayload` 는 채널 값이 아니라 «우리 화면에서 달라졌는가» 의 기준점이다
([CommerceWorkspace.tsx:2548](apps/admin/src/app/pipeline/CommerceWorkspace.tsx:2548)).

## 2. Coupang outgoing source

서버 실행부는 이미 **Master 를 만지지 않는다**:

```
updateCoupangProduct(creds, sellerProductId, edits, prefetched?)   update-product.ts:77
  ① GET baseline   ② 상태 게이트(SAVED)   ③ applyCoupangEdits(baseline, edits)
  ④ detectCoupangUpdateLoss   ⑤ PUT   ⑥ sellerProductId 대조
```

`applyCoupangEdits` 는 **baseline 의 모든 칸을 그대로 나르고 고친 칸만 덮는다**
([registered-baseline.ts:133](packages/listing/src/coupang/registered-baseline.ts:133)).

🔴 **비어 있는 것은 단 하나 — 「`CoupangProductEdits` 를 누가 만드는가」.**

## 3. Common seam — 어디를 갈라야 하는가

Core 계약은 **이미 채널 중립**이다. 여기는 손댈 필요가 없다:

```ts
CommerceEditAdapter<Registered, Outgoing>     commerce-edit-adapter.ts:65
  readRegistered(registered) → ChannelFieldValues
  projectOutgoing(outgoing)  → ChannelFieldValues
  editedFields(before, after) → EditableField[]
```

채널에 묶여 있는 것은 Core 가 아니라 **Workspace 의 세 줄**이다:

```ts
basePayload: NaverProductRegistrationPayload      :2554   ← 타입이 네이버다
`/api/smartstore/registered-product?...`          :2570   ← URL 하드코딩
const current = smartStorePayload ?? ...          :2608   ← 출처가 하나다
smartStoreEditAdapter.editedFields/projectOutgoing :2618/:2621  ← registry 를 안 거친다
```

**seam = 「`outgoing` 을 무엇으로 삼는가」 하나.** 타입 제네릭이 아니라 «출처» 다.

```
SmartStore  outgoing := Master 재생성 payload                (지금 그대로)
Coupang     outgoing := applyCoupangEdits(GET baseline, edits)
```

## 4. SmartStore 기존 동작을 보존하는 이유

Production 검증이 끝난 유일한 수정 경로다. 그리고 `channelEditDraft` 의 규칙
(「고친 축은 내 값, 나머지는 지금 등록된 값」)은 **서버의 `preserveRegisteredValues`
와 한 문장이어야** 한다([channel-edit-model.ts:215](apps/admin/src/app/pipeline/commerce/channel-edit-model.ts:215)).
한쪽만 바꾸면 화면이 보여준 변경과 실제로 나가는 내용이 갈린다.

## 5. Coupang draft → `CoupangProductEdits` 변환

`CoupangProductEdits` 가 표현할 수 있는 것은 **셋뿐**이다:

```ts
{ name?: string;
  items?: Record<sellerProductItemId, { salePrice?: number; maximumBuyCount?: number }> }
```

Core 의 편집 축은 **여덟**이다(`FIELD_ORDER`). 대응은 이렇게 갈린다:

| Core 축 | Coupang edits | 비고 |
|---|---|---|
| `name` | `name` | 1:1. `sellerProductName` + `displayProductName` 둘 다 |
| `salePrice` | `items[*].salePrice` | 🔴 Core 는 스칼라, 쿠팡은 **옵션별** |
| `stockQuantity` | `items[*].maximumBuyCount` | 🔴 같은 문제 |
| `detailContent` | **없음** | |
| `images` | **없음** | |
| `options` | **없음** | |
| `providedNotice` | **없음** | |
| `category` | 해당 없음 | `categoryUpdate: "NOT_SUPPORTED"` → RECREATE_ONLY |

## 6. Master 가 Coupang UPDATE 에 개입하는 지점 → **PUT payload 생성에는 없음**

지시서의 「반드시 없음」을 정확히 적으면:

```
🟢 없다   Master 가 PUT 전문을 «만드는» 길      — 전문은 GET baseline 이 만든다
🟡 있다   Master 가 «바뀐 값을 공급하는» 길     — 그 외의 입력면이 존재하지 않는다
```

이유는 §7-A 다. 이 구분을 뭉개면 둘 중 하나가 된다 — 지시서를 글자대로 지키려다
셀러 입력을 잃거나, 편하다고 Master 재생성 PUT 으로 가거나.

---

## 7. 🔴 지시서와 실제 구조가 다른 두 곳

### A. 「seller draft edits」라는 별도 입력면이 **존재하지 않는다**

`ChannelEditPanel` 은 130줄이고 **`<input>`·`<textarea>`·`onChange` 가 0개**다.
그리고 그것이 사고가 아니라 결정이다:

> 🔴 여기에 입력칸을 두지 «않는다»(CEO 확정, 2026-09-26) … 값은 각자의
> 편집기(가격·이미지·옵션…)에서 고치고, 이 화면은 «지금 값과 보낼 값» 을
> 나란히 보여주고 보낼지를 묻는다
> — [ChannelEditPanel.tsx:27](apps/admin/src/app/pipeline/commerce/ChannelEditPanel.tsx:27)

즉 셀러의 「수정」은 **Master 를 고치는 것**이다. 그래서 쿠팡에도 «바뀐 값» 의
출처는 Master 밖에 없다. 다행히 쿠팡에도 대응 축이 이미 있다:

```ts
payloadPreview: { payload: CoupangPayload; complianceReport }   :2219
  POST /api/coupang/payload-preview  ← product/listing 이 바뀔 때마다(1.2초 디바운스)
  조건: tab === "coupang" && 카테고리 확정                        :2230
```

🔴 **이것을 PUT 전문으로 쓰면 안 된다.** 쓸 곳은 하나다 — `editedFields` 로
**「어느 축이 어떤 값으로 바뀌었는가」만** 뽑고, 그 값만 `CoupangProductEdits` 에
담아 baseline 에 overlay 한다. Master 는 «값의 출처» 이지 «전문의 출처» 가 아니다.

### B. `SUPPORTED_WHEN_SAVED` 로 올리면 화면이 **네 축을 거짓으로 연다**

```ts
if (cap.update === "SUPPORTED_WHEN_SAVED") return "EDITABLE";
   // channel-field-capability.ts:100 — category 를 뺀 «일곱 축 전부»
```

현재 `coupang: { update: "UNKNOWN", categoryUpdate: "NOT_SUPPORTED" }`
([channel-lifecycle.ts:115](apps/admin/src/app/pipeline/commerce/channel-lifecycle.ts:115)).
Phase 3 에서 `SUPPORTED_WHEN_SAVED` 로 올리면:

```
name · salePrice · stockQuantity   → EDITABLE  ✅ edits 가 표현할 수 있다
detailContent · images · options · providedNotice
                                   → EDITABLE  🔴 edits 가 표현하지 «못한다»
```

그 네 축은 화면에 **「수정할 수 있습니다」**(`fieldCapabilityNote`)로 뜨는데,
`applyCoupangEdits` 가 그 값을 나르지 않으므로 baseline 그대로 나간다.
🔴 **`detectCoupangUpdateLoss` 도 이것을 잡지 못한다** — outgoing 이 baseline 과
같으니 「손실」이 아니다. 셀러는 고쳤는데 아무 일도 일어나지 않는다.

같은 파일이 이 경우를 미리 적어 두었다:

> 🔴 필드별로 더 좁힐 근거가 생기면 «그때» 예외를 둔다
> — [channel-field-capability.ts:86](apps/admin/src/app/pipeline/commerce/channel-field-capability.ts:86)

**그 근거가 지금 생겼다.** 근거 없이 지어낸 예외가 아니다.

### B-2. `salePrice`/`stockQuantity` 는 축 자체가 어긋난다

Core 의 `ChannelFieldValues.salePrice` 는 **상품 하나의 스칼라**이고
([commerce-edit-adapter.ts:42](apps/admin/src/app/pipeline/commerce/commerce-edit-adapter.ts:42)),
쿠팡의 가격/재고는 **`sellerProductItemId` 별**이다. 옵션이 둘 이상이면 Core 의
한 값이 «어느 item 으로» 가야 하는지 결정할 수 없다. 🔴 임의로 「전체 적용」하면
셀러가 지정하지 않은 옵션의 가격을 우리가 바꾸는 것이 된다.

---

## 8. Phase 2 로 넘기는 최소 seam 제안

```
① Workspace 의 channelEdit 상태에서 네이버 타입을 걷어내고
   「baseline(model) · outgoing · adapter」 셋만 채널별로 고른다.
② outgoing 의 «출처» 만 채널이 정한다:
      smartstore → smartStorePayload (지금 그대로)
      coupang    → applyCoupangEdits(GET baseline, edits)
③ edits 는 payloadPreview.payload 의 «변경 축» 에서만 뽑는다.
④ 어댑터는 editAdapterFor(commerceId) 로 가져온다(registry 경유).
```

🔴 Core(`commerce-edit-adapter.ts` · `channel-edit-model.ts` · `channel-field-capability.ts`)
는 **재설계하지 않는다.** 이미 중립이다.

## 9. Phase 2 착수 전 CPO 판단이 필요한 것 — 두 개

```
Q1  §7-B 의 네 축(detailContent·images·options·providedNotice)을
    쿠팡에서 어떻게 할 것인가.
      (a) fieldCapability 에 쿠팡 예외를 두어 UNKNOWN 으로 «좁힌다»  ← CTO 권장
      (b) CoupangProductEdits 를 넓힌다 — 🔴 GET/PUT 왕복 실측이 «먼저» 필요
      (c) 그대로 둔다 — 🔴 화면이 거짓말한다. 권장하지 않는다.

Q2  §7-B-2 의 옵션별 가격/재고를 이번 스프린트 범위에 넣는가.
      Production 실측이 「상품명 하나」로 고정돼 있으므로,
      CTO 권장은 «이번엔 name 만 열고 가격/재고는 다음 스프린트» 다.
```

🔴 두 질문 모두 **제품 정책·안전 경계**라 CPO 결정 사항이다(헌장 §3 STOP 조건).
결정 전에는 capability 를 올리지 않는다 — 올리는 순간 화면이 말을 시작한다.

## 9-A. 🟢 CPO 결정 (2026-09-28)

```
Q1 → (a) fieldCapability 에 쿠팡 예외를 두어 «좁힌다»
Q2 → 이번 스프린트는 name 하나만 연다 (가격·재고는 다음 스프린트)
```

그래서 쿠팡의 필드 표는 이렇게 «하나만» 열린다:

```
name           EDITABLE        ← 이번 스프린트의 전부
salePrice      UNKNOWN         ← 옵션별 매핑 미결정(§7-B-2)
stockQuantity  UNKNOWN         ← 〃
detailContent  UNKNOWN   images UNKNOWN   options UNKNOWN   providedNotice UNKNOWN
category       RECREATE_ONLY   ← categoryUpdate: NOT_SUPPORTED (기존 그대로)
```

🔴 UNKNOWN 은 「안 됩니다」가 아니라 「아직 확인되지 않았습니다」로 셀러에게
나간다(`fieldCapabilityNote`) — 실측하지 않은 것을 못 한다고 말하지 않는다.
Production 실측 범위(상품명 하나)와 화면이 여는 범위가 **정확히 같아진다.**

## 9-B. Phase 2 설계 — seam 은 생각보다 «작다»

실행기 계약을 읽고 나니 클라이언트에 payload 배선을 새로 깔 필요가 없다.
기존 수정 계약이 이미 **「값이 아니라 바뀐 항목 «이름»만 보낸다」** 이기 때문이다:

> 🔴 셀러가 «이번에 고친» 항목의 이름. 서버가 이 목록으로 나머지 칸을 지금
> 등록된 값으로 되돌린다. **값은 보내지 않는다.**
> — [CommerceWorkspace.tsx:3039](apps/admin/src/app/pipeline/CommerceWorkspace.tsx:3039)

쿠팡도 같은 계약을 쓰면:

```
클라이언트   editedFields: ["name"]  +  expectedExternalProductId
      ↓
서버(register route)  resolveLifecycle → SAVED → UPDATE 분기
      ↓
      buildCoupangPayload(product, listing)      ← 값의 «출처» (Master)
      ↓  editedFields ∩ {name} 만 꺼낸다
      CoupangProductEdits { name }
      ↓
      updateCoupangProduct(creds, sellerProductId, edits)
        GET baseline → 상태 게이트 → applyCoupangEdits → 손실검사 → PUT → 번호대조
```

🔴 **Master 는 「바뀐 한 칸의 값」만 공급하고, 전문은 baseline 이 만든다.**
`buildCoupangPayload` 의 결과가 그대로 PUT 되는 길은 어디에도 생기지 않는다.

### 바꿔야 하는 곳 (최소)

```
① CommerceWorkspace :2554  basePayload 타입이 네이버다        → 채널별로
② CommerceWorkspace :2570  GET URL 하드코딩                   → 채널별 라우트
③ CommerceWorkspace :2608  outgoing 출처가 하나다             → 채널별 출처
④ CommerceWorkspace :2618/:2621  어댑터 직접 호출             → editAdapterFor()
⑤ CommerceWorkspace :3038/:3045  두 게이트가 "smartstore" 고정 → 어댑터 有無로
⑥ CommerceWorkspace :3095  전송 후 기준값 폐기도 "smartstore" 고정 → 〃
⑦ api/coupang/registered-product (신규 GET 라우트)
⑧ edit-adapters/coupang.ts (신규) + registry 한 줄
⑨ channel-field-capability 에 쿠팡 필드 예외(9-A)
⑩ channel-lifecycle 의 coupang.update → SUPPORTED_WHEN_SAVED
```

```
⑪ api/coupang/register/route.ts 에 UPDATE 실행 분기  ← 🔴 E. 가장 크고 위험하다
```

🔴 ⑦~⑪ 은 **한 커밋에서 «같이»** 올린다. 먼저 올리면 죽은 코드이고, 먼저
capability 만 올리면 화면이 거짓말한다 — 가드 넷이 정확히 그것을 세고 있다.

### 🔴 E — Coupang register route 의 UPDATE 실행 경계 (CPO 확정 2026-09-29)

기존 Coupang register route 에는 **UPDATE operation 이 존재하지 않는다.** 이는
의도적으로 CREATE/RECREATE 와 분리되어 있었다. 이번 UPDATE wire 에서 실제 실행
경계를 연결해야 하므로 **A–D 와 동일한 atomic implementation scope 에 포함한다.**
CREATE/RECREATE semantics 와 분리하며, UPDATE 는
`GET baseline → SAVED gate → edited-field overlay → loss detection → PUT` 순서를 쓴다.

**발견 사항(2026-09-28 실측):**

```
api/coupang/register/route.ts    ≈ 933 lines
plannedOperation                 = "CREATE" | "RECREATE"      :651
UPDATE branch                    = 없음
```

그리고 그것은 사고가 아니라 결정이었다:

> 🔴 그래서 UPDATE 경로를 «만들지 않았다». 없는 것을 만들어 두면 다음 사람이
> 「있으니까 쓸 수 있다」고 읽는다
> — [register/route.ts:641](apps/admin/src/app/api/coupang/register/route.ts:641)

**🔴 E 의 절대 금지 — CREATE ≠ UPDATE**

```
✅ UPDATE → sellerProductId 식별 → GET baseline → SAVED 확인
          → 상품명 edit «만» overlay → loss detection → PUT

❌ UPDATE → buildCoupangPayload() → POST CREATE
```

UPDATE 가 CREATE payload 생성 경로에 섞이면, 수정이 아니라 **중복 등록**이 나간다 —
이 프로젝트가 이미 겪은 「쿠팡 중복 3건」([register/route.ts:659](apps/admin/src/app/api/coupang/register/route.ts:659))이
그 모양이다.

🔴 **기존 `plannedOperation` 의 `CREATE | RECREATE` 의미를 훼손하지 않는다.**
UPDATE 를 더하더라도 CREATE/RECREATE 의 기존 lifecycle semantics 변경 금지가
«우선» 이다.

### E 를 별도 Phase 로 떼지 않는 이유 (CPO)

```
A~D 만 완료  →  화면·서버에 UPDATE capability 가 «존재»
             →  실제 실행부는 «없음»          ← 우리가 계속 막아 온 「부분 착지」
```

A–E 는 **하나의 Coupang UPDATE 기능 경로**다. E 는 보조 작업이 아니라
「실제 UPDATE 요청이 CREATE 경로와 분리되어 안전하게 실행되는 최종 실행 경계」다.

🔴 Core 세 파일(`commerce-edit-adapter` · `channel-edit-model` ·
`channel-field-capability` 의 구조)은 **재설계하지 않는다.** ⑨만 예외를 더한다.

## 9-C. 🔴 Phase 3 착수 중 확인된 구조적 제약 (2026-09-29)

A(GET 라우트)와 B(어댑터)를 실제로 써 본 뒤 나온 것들이다. **설계가 바뀐다.**

### ① C 를 Core 에 넣을 수 «없다» — 가드가 막는다

```ts
CORE_FILES = [channel-edit-model.ts, channel-field-capability.ts,
              commerce-edit-adapter.ts, ChannelEditPanel.tsx, ChannelEditSummary.tsx]
for (const id of COMMERCE_ORDER)
  expect(source).not.toContain(`"${id}"`)   // p0channel03-sprintA-commerce-core.test.ts:74
```

`channel-field-capability.ts` 는 CORE_FILE 이라 **`"coupang"` 문자열을 담을 수 없다.**
그래서 필드 예외를 거기 if 문으로 넣는 설계는 성립하지 않는다(가드를 약화시켜야만
가능한데, 그건 금지다).

🔴 **대신 `ChannelCapability` 표를 넓힌다** — 채널별 사실은 `channel-lifecycle.ts`
(CORE_FILE 아님)에 있고, Core 는 그 «데이터» 를 읽기만 한다:

```ts
export interface ChannelCapability {
  create: boolean; update: CapabilityState; categoryUpdate: CapabilityState;
  /** 🔴 update 가 열려도 «이 축만» 확인됐다. 없으면 전 축이 update 를 따른다. */
  updateFields?: readonly EditableField[];
}
// coupang: { …, update: "SUPPORTED_WHEN_SAVED", updateFields: ["name"] }

// channel-field-capability.ts — 이름 분기 «없이» 데이터만 읽는다
if (cap.update === "SUPPORTED_WHEN_SAVED") {
  if (cap.updateFields && !cap.updateFields.includes(field)) return "UNKNOWN";
  return "EDITABLE";
}
```

`EditableField` 는 타입뿐이므로 `import type` 으로 받으면 순환 참조가 생기지 않는다.

### ② 같은 커밋에서 «갱신할» 가드 목록 (약화 금지 · 새 사실로)

```
p0channel03-sprintA-commerce-core.test.ts
  :62  어댑터 파일 수 = 등록 커머스 수 + index      → coupang.ts 가 늘어난다
  :80  EDIT_ADAPTER_COMMERCE_IDS = ["smartstore"]   → coupang 추가
  :82  editAdapterFor("coupang") = undefined        → defined 로
  :119 editUnavailableNote("coupang") 안내 존재      → 어댑터가 생기면 안내가 사라진다
  :125 CHANNEL_CAPABILITY.coupang.update = UNKNOWN  → SUPPORTED_WHEN_SAVED
commerce3-capability-parity.test.ts ①·⑤ · p0channel03-lifecycle.test.ts ⑥
```

### ③ E 의 배치 — UPDATE 분기는 payload 생성 «앞» 이다

```
:296  credentials            :486  buildCoupangPayload(...)   :650  findChannelProductBySnapshot
```

지시서의 「`buildCoupangPayload` 가 UPDATE 경로에 있으면 FAIL」을 구조로 지키려면
UPDATE 분기가 **`:486` 보다 앞**이어야 한다. 그리고 그것이 「CREATE ≠ UPDATE」의
실제 구현이다 — UPDATE 인데 CREATE payload 를 조립할 이유가 없다.

🔴 **새 상품명 값은 `payload.sellerProductName` 이 아니라 `listing.title` 에서 온다.**
빌더가 그 칸을 그렇게 만든다(`build-payload.ts:1717`) — 같은 값을 빌더 «없이» 얻는다.

🔴 **안전 성질**: UPDATE 분기 전체를 `editedFields !== undefined` 로 막으면, 그 필드를
보내는 클라이언트가 현재 «하나도 없으므로» 기존 CREATE/RECREATE 트래픽의 동작이
**비트 단위로 동일**하다. 회귀 위험을 구조로 0 에 가깝게 만든다.

### ④ 진행 상태 — A·B 는 «작성됐고 커밋하지 않았다»

두 파일을 실제로 작성했지만 **리포지터리에 남기지 않았다.** A~E 는 한 커밋이어야
하고, 부르는 화면 없이 라우트·어댑터만 올리면 죽은 코드이기 때문이다(가드 넷이
정확히 그것을 센다). 다음 세션이 바로 복원할 수 있게 세션 스크래치패드에 뒀다:

```
scratchpad/phase3-wip/A-registered-product-route.ts
scratchpad/phase3-wip/B-edit-adapter-coupang.ts
```

내용 요지 — A 는 SmartStore 형제 라우트와 같은 계약(`snapshotId` 만 받고 번호는
서버가 찾는다 · GET 전용 · 실패를 빈 기준값으로 내리지 않는다). B 는
`CommerceEditAdapter<CoupangRegisteredProduct, CoupangRegisteredProduct>` 로
**Registered 와 Outgoing 을 같은 타입으로** 둬서 「빌더 산출물을 PUT 한다」를
타입에서 막고, 가격·재고는 **옵션이 정확히 하나일 때만** 읽는다(둘 이상이면
어느 값이 그 상품의 가격인지 적을 근거가 없다).

## 10. 이번 조사에서 «하지 않은» 것

* 코드 변경 0줄. 테스트 실행 없음(변경이 없으므로).
* `edit-adapters/coupang.ts` 를 만들지 않았다 — 부르는 화면이 없으면 죽은 코드다.
* capability 를 올리지 않았다. `coupang.update` 는 여전히 `UNKNOWN` 이다.
* `resolveLifecycle` 의 SAVED 분기 동작은 §9 결정 뒤 Phase 2 에서 읽는다.
