# Commerce-3B — Commerce UX / Boundary Completion

> CTO 보고(2026-09-26). 4개 항목 중 **②만 구현**하고 ①③은 설계까지, ④는 조사까지.
> capability 값은 한 글자도 올리지 않았다.

## ① SmartStore 고정 orchestration — 조사 + 최소 변경안(구현 ✗)

### 무엇이 박혀 있나 — 네 곳뿐이다

```
CommerceWorkspace.tsx:2518  useState<NaverProductRegistrationPayload | null>   타입
                    :2551  fetch(`/api/smartstore/registered-product?…`)       라우트
                    :2599  smartStoreEditAdapter.editedFields(…)               어댑터
                    :2602  smartStoreEditAdapter.projectOutgoing(…)            어댑터
      (그리고 :3787  tab === "smartstore" && … 라는 렌더 게이트)
```

### 왜 지금 필요한가

세 가지가 **채널마다 실제로 다르고**, 두 채널에는 아직 존재하지 않는다:

| 필요한 것 | SmartStore | Coupang | LotteON |
|---|---|---|---|
`/{channel}/registered-product` 라우트 | ✅ 있다 | ❌ 없다 | ❌ 없다 |
「보낼 payload」 타입 | `NaverProductRegistrationPayload` | `CoupangPayload`(등록용만) | `LotteOnProductRegistrationPayload`(등록용만) |
`CommerceEditAdapter` | ✅ 있다 | ❌ 없다 | ❌ 없다 |

🔴 **그래서 지금 일반화하면 채울 수 없는 껍데기가 된다.** `editAdapterFor()` 가
`undefined` 를 내는 채널에 대해 orchestration 이 할 수 있는 일은 「아무것도 하지
않기」뿐이고, 그것은 이미 지금의 동작이다.

### 최소 변경안 — 🔴 **두 번째 채널이 생기는 날에만** 값이 있다

```
1. useState 의 payload 타입을 «채널별 union» 이 아니라 어댑터의 Outgoing 으로 세운다
   → CommerceEditAdapter<Registered, Outgoing> 의 Outgoing 을 그대로 쓰는 훅 하나
2. 라우트 경로를 `/api/${commerceId}/registered-product` 로 조립
3. `smartStoreEditAdapter.X(…)` → `editAdapterFor(commerceId)!.X(…)`
4. 렌더 게이트를 `tab === "smartstore"` → `editAdapterFor(tab) != null` 로
```

비용은 작지만(4곳) **효용이 0 이다** — 지금 `editAdapterFor` 가 비어 있지 않은
채널이 하나뿐이라 ①~④를 다 해도 동작이 한 글자도 달라지지 않는다. 그리고
`commerce3-capability-parity.test.ts §⑤` 가 이미 「수정 배선이 한 채널」이라는 사실을
세고 있어, 두 번째 채널이 이어지는 날 **그 테스트가 빨개지면서 이 네 곳을 가리킨다.**

**권고: 지금 하지 않는다.** 두 번째 어댑터가 생기는 커밋에서 «같이» 한다.

## ② UNKNOWN UX — 🔴 **자리가 있었다. 구현했다.**

### 자리를 새로 만들지 않았다

우측 요약에는 이미 슬롯이 있다 — `PlatformPreview.tsx:914` 의 `{editSummary}`.
SmartStore 는 그 자리에 「등록된 내용 불러오기」 카드를 세우고, **다른 채널에서는
그 자리가 비어 있었다.** 빈 칸은 「없다」가 아니라 「아무 말도 하지 않은 것」이다.

```
전   Coupang 탭 우측:  [등록 준비 상태 / 필수 확인 / 등록 시작]        ← 끝
후   Coupang 탭 우측:  [등록 준비 상태 / 필수 확인 / 등록 시작]
                       [등록 후 관리 · 등록된 상품 수정
                        쿠팡 — 확인되지 않음
                        이 커머스에서 등록된 상품을 수정할 수 있는지
                        아직 확인되지 않았습니다.]
```

### 🔴 문구를 지어내지 않았다

카드는 `note` 를 **받는다**. 문장은 `editUnavailableNote()`(capability 계층)가 이미
정한 것이고, 그 함수는 어댑터가 있으면 `undefined` 를 낸다 — 그래서

* 호출부에 `if (channel === …)` 조건이 **하나도 없다**(채널 이름을 화면에 박으면
  표가 바뀌어도 화면은 옛말을 한다).
* 어댑터가 생기는 날 **카드가 스스로 사라진다**.
* 카드에 **버튼이 없다** — 누를 것이 없는 상태이므로.
* 「지원하지 않습니다」라고 말하지 않는다 — 확인되지 않았을 뿐이다.

### 바꾼 파일

```
ChannelEditSummary.tsx        + ChannelEditUnavailableCard (중립 · note undefined → null)
PlatformPreview.tsx            {editSummary} → {editSummary ?? <Card …/>}   (쿠팡·11번가)
LotteOnRegistrationPanel.tsx   요약을 space-y-6 로 감싸고 같은 카드를 아래에
```

### 🔴 「그려지는지」를 실행으로 확인했다

개수만 세는 검사는 카드가 아예 안 그려져도 통과한다 — 이 저장소가 반복해 겪은
실패 모양이다. 그래서 실제 DOM 마운트에서 **있다** 를 단정했다
(`rework12-ceo-capture.test.ts`): Coupang · LotteON 에는 카드가 있고 「확인되지 않음」
문구와 **버튼 0개**를 확인, SmartStore 에는 **없다**(어댑터가 있으므로).

### 기존 가드 둘이 빨개졌다 — 🔴 풀지 않고 «좁혔다»

| 테스트 | 왜 깨졌나 | 어떻게 했나 |
|---|---|---|
`p0channel03-f14-5` 「카드를 합치지 않는다」 | 슬롯 문자열이 `{editSummary}` → `{editSummary ??` | 문자열만 갱신 + **순서 단정은 그대로** + 🔴 대체 카드가 `onLoad`/`onSubmit` 을 갖지 못한다는 검사를 **추가** |
`rework12` 「우측 요약이 하나」 | 우측 `[data-summary]` 총개수 == 1 을 요구 | 세는 대상을 `[data-summary="channel-registration"]` 로 좁힘(형제 테스트 :219-222 가 이미 쓰는 선택자) + 🔴 **종류별 중복 금지 · 등록 요약이 맨 위** 두 단정을 추가 |

🔴 두 번째가 중요하다: 그 letter 는 **이미 프로덕션에서 거짓이었다**. 등록된
SmartStore 상품의 우측에는 예전부터 카드가 두 장 선다(등록 요약 + 불러오기). 테스트가
1을 요구하며 통과한 것은 그 렌더에서 `editSummary` 를 넘기지 않았기 때문이다.

## ③ 미리보기 ↔ 실제 전송 builder 이중화 — 조사 + 설계(구현 ✗)

### 🔴 앞선 보고를 정정한다

Commerce-3 보고서에 「`CommerceWorkspace.tsx:2906-2908` 이 smartstore 를 언제나
DRY_RUN 으로 고정한다」고 적었다. **틀렸다.** 실제 코드는:

```ts
if (platform === "coupang") return connection === "CONNECTED" ? "LIVE" : "DRY_RUN";
if (platform === "smartstore") return "LIVE";      // ← 항상 LIVE
return "DRY_RUN";
```

2026-08-19 CEO 실측 보고(「스마트스토어 등록이 안 됨」)로 이미 고쳐진 자리였다.
내가 `return "DRY_RUN"`(11번가 폴백)을 smartstore 의 것으로 잘못 읽었다.

### 그래서 실제 이중화는 «더 좁다»

```
LIVE(프로덕션 전부)   executor:35  validateSmartStoreListing()   ← 게이트로 «쓰인다»
                      executor:53  buildSmartStorePayload()      ← 🔴 결과가 버려진다
                      executor:83  POST /api/smartstore/register → 서버가 naver/build-payload 로
                                                                   «진짜» payload 를 만든다
```

* smartstore 의 프로덕션 mode 는 **항상 LIVE** 이므로, DRY_RUN/PREVIEW 분기는
  프로덕션에서 도달하지 않는다(테스트만 그 경로를 쓴다).
* 🔴 그래서 `buildSmartStorePayload()` 의 결과가 셀러에게 닿는 경로는 **하나뿐**이다:
  `fetch` 가 던졌을 때의 실패 결과에 `payload` 로 실린다(executor:113).
  즉 **네트워크 오류 화면에서만**, 그리고 그때 보이는 것은 「보낼 적이 없는 payload」다
  (그 파일은 스스로 「실제 스키마가 아니다」라고 적어 두었다).

### 최소 변경안 — 한 줄

```
executor:108-119  catch 블록의 `payload` 를 «싣지 않는다».
```

서버가 무엇을 만들었을지 모르는 상태이므로 **모른다고 두는 것이 정확하다**.
이렇게 하면 `buildSmartStorePayload` 는 프로덕션 경로에서 완전히 빠지고, 남는 소비처는
DRY_RUN/PREVIEW(테스트)뿐이 된다 — 그때 파일을 지울지 결정할 수 있다.

🔴 **구현하지 않았다.** `payload` 가 빠진 실패 결과를 화면(ListingSection ·
RegistrationHistoryPanel)이 어떻게 그리는지 확인이 필요하고, 그것은 「미리보기를
없앨 것인가」라는 CPO 결정과 붙어 있다.

## ④ LotteON — A/B/C 를 분리한다

지시서의 「A. apiNo 90 등록상품 상세 GET 계약」을 그대로 쓰지 않는다 — **90 은 수정이고
상세 조회는 94 다.** 넷으로 가른다.

| | 코드 | 문서 | 남은 것 |
|---|---|---|---|
**A. 90 승인상품수정** | 경로 상수는 `LOTTEON_WRITE_PATHS` 에 **있다**(`client.ts:231-234`), 호출부 0 | 🔴 대상 «상태» · 수정 가능 «필드» · 되돌림 수단 **전부 기록 없음** | 공식 문서 확보가 먼저 |
**B. 93 상품목록** | ✅ **구현됨**(`product-status/route.ts`) | 응답에 `sitmNoLst` · `fnlAprvYn` **둘 다 있다**(`:92,:95`) | 🔴 **없다 — 이미 된다** |
**C. 91 가격 · 86 재고** | 경로 상수 **없음**, 호출부 0 | 🔴 요구 식별자(`sitmNo`? `spdNo`?) **기록 없음** | 요청 스펙 확보 |
**D. 94 상품상세** | 상수 `LOTTEON_READ_PATHS.productDetail` **있다**, 호출부 0 | 🔴 요청 파라미터 · 응답 모양 **둘 다 기록 없음** | 실측 |

### 🔴 B 는 이미 끝났다 — 그리고 «막고 있는 것» 은 다른 것이다

지시대로 A 가 B 를 막지 않는다. 실제로 B(93)는 **이미 구현돼 있고 `sitmNoLst` 를
응답에 싣는다.** 그러니 sitmNo 는 오늘도 얻을 수 있다.

🔴 다만 93 의 «좁히기» 파라미터가 `epdNo` 배열(최대 100)이고,
**우리는 `epdNo` 를 저장하지 않는다**(§Commerce-3 §4). 우회는 있다 — 날짜 구간 +
페이징으로 받아 `spdNo` 로 매칭. 즉 **불가능이 아니라 비용 차이**다.
그리고 CPO 결정대로 **sitmNo 를 DB 에 미리 캐시하지 않는다** — 수정 시점의 93 응답을
authoritative state 로 쓴다. 그 설계에서는 `epdNo` 저장이 「캐시」가 아니라
「조회 키 보관」이라 금지선 밖이다. 🔴 그러나 이번에 저장하지 않았다 — 마이그레이션이
필요하고, 91/86 요청 스펙이 확인되기 전에는 쓸 곳이 없다.

### 그리고 문서가 «확인해 준» 것 하나

> FAQ: *"한번 등록한 옵션값/옵션명은 수정이 불가능하고 **상태(가격/재고/판매상태)만
> 수정 가능**. 옵션 추가는 가능, 최대 500개"* — 조사 §5-1

🔴 이것은 두 방향으로 읽힌다: **옵션 축은 수정 불가가 «확인됨»** 이고,
**가격·재고·판매상태는 수정 가능하다고 «문서가 말한다»**. 후자는 C(91/86)를
A(90)보다 **먼저** 확인할 근거다 — 90 은 「승인 상품 수정」이라는 이름과 미확인
계약뿐인데, 91/86 은 FAQ 가 가능하다고 적었다.

**권고 순서: C(91/86 요청 스펙) → D(94 실측) → A(90 계약).** B 는 완료.

## ⑤ 회귀

```
typecheck admin 0 · admin 4,319/313 · build PASS
eslint  🔴 4건(3 error + 1 warning) — «사전 존재». baseline(0d6a6d7)에서 같은 4건이
        같은 종류로 나온다(706/709/761 → 내 import 4줄로 710/713/765 로 밀림).
        PlatformPreview 의 기존 훅 문제이고 이번 변경과 무관하다.
```

### 🔴 비결정적 실패 1건을 보고한다

`packages/listing/src/coupang/__tests__/notice-regression.test.ts` 가 전체 스위트
실행 **4회 중 1회** 실패했다. 단독 실행은 통과하고, 같은 코드로 이후 2회 전체
통과했다. baseline 스위트도 1회 통과. **즉 실행 간 비결정성이고 이번 변경으로
재현 가능하게 생긴 것이 아니다.** 🔴 원인은 확인하지 못했다 — 숨기지 않고 적는다.

## ⑥ CPO 결정이 필요한 것

| # | 내용 | 근거 |
|---|---|---|
1 | 「무엇이 확인되면 수정이 열리는가」 한 줄을 카드에 넣을 것인가 | 넣으려면 그 문장이 `CHANNEL_CAPABILITY` 의 **필드**여야 한다(지금은 주석에만 있어 화면에 못 온다). 화면에 채널별로 적으면 leakage 다 — 그래서 카드에 인자를 «미리 만들어 두지 않았다» |
2 | executor 실패 결과에서 가짜 payload 를 뺄 것인가(③ 한 줄) | 화면 세 곳의 표시가 바뀐다 |
3 | LotteON `epdNo` 를 저장할 것인가 | 93 을 「그 상품만」으로 좁히는 조회 키. 캐시가 아니다 |
4 | LotteON 조사 순서 C → D → A 승인 | FAQ 가 가격/재고/판매상태 수정을 «가능» 이라 적었다 |
