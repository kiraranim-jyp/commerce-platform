# Commerce-3 — 3개 Commerce 마무리 점검

> CTO 보고(2026-09-26). 전수 조사 + 정합 고정. **capability 값은 한 글자도 올리지 않았다.**

## 0. 결론 먼저

```
「등록」 축   SmartStore ✅   Coupang ✅   LotteON ✅      → 세 채널 완료
「수정」 축   SmartStore ✅   Coupang ⏸    LotteON ⏸       → 한 채널만 완료

Commerce Sprint 전체 완료 판정   🔴 «하지 않는다»
                                 이유: 구현 부채가 아니라 «조사 부채» 다.
```

두 채널이 막힌 지점은 하나로 같다 — **등록된 상품을 GET 으로 읽은 실측이 0건**이다.
토큰 값이 Sensitive 라 CTO 가 읽을 수 없고, 보안 설정 변경과 CEO 에게 토큰 요구는
둘 다 금지선이다. 그래서 「코드·공식문서로 확정 가능한 범위」까지만 손댔다.

## 1. Commerce Core — 🟢 leakage 없음

`channel-edit-model.ts` · `commerce-edit-adapter.ts` · `channel-field-capability.ts` ·
`ChannelEditPanel.tsx` · `ChannelEditSummary.tsx` · `ChannelRegistrationFrame.tsx` 의
**실행 코드에 채널 이름이 없다.** 벤더 API 필드명(`originProduct` ·
`smartstoreChannelProduct` · `sellerProductId` · `spdNo` · `epdNo`)도 없다.
채널 이름을 아는 자리는 둘뿐이고, 그 둘은 아는 것이 일이다:

```
commerce-registry.ts   CommerceId union · COMMERCE_ORDER · label
channel-lifecycle.ts   CHANNEL_CAPABILITY 표
```

🔴 이제 그 사실을 테스트가 센다(`commerce3-capability-parity.test.ts` §④) — 주석이
아니라 검사다.

### 🔴 1-1. 다만 «Core 밖» 에 한 채널 고정이 있다 — 앞선 보고를 정정한다

```
CommerceWorkspace.tsx:2551   fetch(`/api/smartstore/registered-product?...`)
                    :2535   basePayload: NaverProductRegistrationPayload
                    :2599   smartStoreEditAdapter.editedFields(...)
```

Core 는 중립인데 **수정 orchestration 은 smartstore 를 직접 부른다.** 이것을
「leakage」라고 부를지는 판단이지만, 「Core 가 중립이니 세 채널이 이미 된다」로
읽히면 안 되는 사실이다. 🔴 두 채널의 capability 가 UNKNOWN 인 동안은 이을 대상이
없으므로 **지금 일반화하면 채울 수 없는 껍데기를 만드는 것**이다. 그래서 일반화하지
않고 «세어 두었다»(§⑤) — 두 번째 채널이 이어지는 날 그 테스트가 빨개지면서 같이
고쳐야 하는 자리가 드러난다.

## 2. SmartStore — ✅ 완료

lifecycle 다섯 상태가 모두 «구현되고» 테스트로 고정돼 있다:

| | 자리 | 비고 |
|---|---|---|
CREATE | `smartstore/register/route.ts:1017-1249` | `resolveCreateGate` 통과 후 POST |
UPDATE | `:725-953` → `_lib/update-product.ts:142-199` | GET → compare → preserve → 손실검사 → PUT |
RECREATE | `:955-989` → `:1186-1198` | 셀러 «동의» 필수 · `replaceChannelProductLink` |
NOOP | `:997-1014` | 전수 비교했을 때만 |
BLOCKED | `:997-1014` · `:1041-1076` | 네이버에 아무것도 보내지 않는다 |

* 수정 기준값은 **ChannelProduct 의 등록 ID** 로 GET 한 것이고(`:679`),
  `expectedExternalProductId` 불일치 게이트가 네이버 호출 «앞» 에 있다(`:651-674`).
* 테스트 10개 파일(admin 7 · listing 3)이 이 사슬을 덮는다.
* **죽은 코드·중복 매핑 없음** — 6개 핵심 함수 전부 호출부가 있다.

### 🔴 2-1. 보고할 것: 미리보기와 실전이 «다른 빌더» 다

```
실제 등록   register route → packages/listing/src/naver/build-payload.ts
미리보기    executor       → packages/listing/src/smartstore/build-payload.ts  (DRY_RUN 전용)
```

그리고 `CommerceWorkspace.tsx:2906-2908` 이 **smartstore 는 언제나 DRY_RUN** 으로
고정한다 — 즉 executor 경로는 네이버에 아무것도 보내지 않는다. 기능상 사고는 아니지만
**셀러가 보는 미리보기와 실제로 나가는 payload 가 서로 다른 코드에서 나온다.**
🔴 지우지 않았다 — 화면이 아직 그 경로를 쓴다. 정리 여부는 「미리보기를 실전 빌더로
바꿀 것인가」라는 결정이고, 그 결정 없이 지우면 미리보기가 사라진다.

## 3. Coupang — 등록 ✅ / 수정 ⏸ UNKNOWN

### 가능 범위(실측 없이 확정된 것)

* **등록**: `POST .../marketplace/seller-products` 구현 완료. 성공 시
  `sellerProductId` 를 `channel_products.external_product_id` 로 저장(`route.ts:832`).
* **RECREATE**: 카테고리 변경은 공식 가이드가 「불가」로 «명시» →
  `categoryUpdate: NOT_SUPPORTED` → RECREATE, 셀러 동의 필수, 성공 시
  `replaceChannelProductLink`.
* **읽기**: `fetchRegisteredCoupangCategory` 가 `displayCategoryCode` «하나만» 읽는다.
  🔴 의도된 최소 독해다 — 결과를 바꾸지 않는 비교를 실측 없는 응답 모양 위에 짓지
  않는다. 읽지 못하면 CREATE 로 내려보내지 않고 **멈춘다**(`route.ts:649-670`).
* **ID 축**: `sellerProductId` 만 쓴다. `productId` 는 묶음/해제로 «바뀌므로» 키로
  쓰지 않는다. `vendorItemId` · `sellerProductItemId` 는 저장하지 않는다(설계 결정).

### 🔴 UNKNOWN 범위 — 올리는 조건

```
update: UNKNOWN          문서 근거는 «있다»(PUT .../seller-products 전문 되보내기 ·
                         vendorItemId 별 가격/수량 PUT). 없는 것은 실측이다:
                           · GET 응답의 실제 모양
                           · 승인 대기 중 상품의 수정 가능성
                           · 수정 후 sellerProductId 유지 여부
```

🔴 `_lib/client.ts:46` 이 method 를 `"GET" | "POST"` 로 «타입에서» 막고 있어 지금
코드로는 PUT 을 보낼 수 없다. **이 경계를 지금 넓히지 않았다** — 호출부가 없는 채로
넓히면 「쿠팡에 PUT 을 보낼 수 없다」는 컴파일 시점 보장만 잃고 얻는 것이 없다.
실측이 끝나 어댑터를 쓸 때 같이 넓힌다.

probe 는 준비돼 있다(`/api/debug/coupang-product-get-raw`, `DEBUG_COUPANG_PROBE_TOKEN`
게이트, 읽기 전용이 테스트로 고정). **한 번도 성공적으로 돌린 적이 없다.**

## 4. LotteON — 등록 ✅ / 수정·가격·재고 ⏸ UNKNOWN

### apiNo 연결 실태

| apiNo | 이름 | 상태 |
|---|---|---|
87 | 상품등록 | ✅ 구현 (`/api/lotteon/register`) |
93 | 상품목록 | ✅ 구현 (`/api/lotteon/product-status` — 승인상태 `fnlAprvYn`) |
207 · 205 · 206 · 89 · 150 · 166 | 인증·카테고리·공통코드·배송지/배송비 | ✅ 전부 구현(읽기) |
**94** | 상품상세조회 | 🔴 `LOTTEON_READ_PATHS.productDetail` 상수는 «있고» 호출부는 0 |
**90** | 승인상품수정 | ❌ 미구현 |
**91 · 86** | 아이템 가격 · 재고 변경 | ❌ 미구현 |
92 · 111 | 상품·아이템 상태변경 | ❌ 미구현 |
210 외 주문/배송/클레임 쓰기 | — | 🔴 `forbidden-endpoints.ts` 가 «금지» |

### ID 축 — `epdNo / spdNo / itemNo` 관계

```
apiNo 87 응답 = epdNo · spdNo · resultCode · resultMessage   (네 개뿐)
  spdNo   판매자상품번호  → channel_products.external_product_id 로 저장 ✅
  epdNo   업체상품번호    → 저장하지 «않는다». registration_attempts.response(jsonb)
                            와 라우트 응답 rows 에는 실려 있어 «잃지는» 않는다.
  itemNo(sitmNo) 단품번호 → 🔴 87 응답에 «없다». apiNo 93 의 sitmNoLst 로만 얻는다.
```

🔴 그래서 **아이템 단위 수정(91 가격 · 86 재고)은 오늘 코드로는 대상 자체를 지목할
수 없다.** apiNo 90 을 확인하는 것과 별개의 선결조건이다 — 93 을 한 번 더 불러
sitmNo 를 확보하는 경로가 먼저 있어야 한다. 이것을 「수정 미구현」과 같은 줄에
적으면 조사 범위를 잘못 잡는다.

### 🔴 UNKNOWN 을 올리는 조건

```
update: UNKNOWN          apiNo 90 은 이름이 「상품 수정」이 아니라 «승인 상품 수정»
                         이고, 어떤 «상태» 의 어떤 «필드» 를 바꿀 수 있는지 인용된
                         바 없다. 되돌림 수단도 기록에 없다(87 은 92 로 되돌릴 수
                         있었다). 🔴 옵션명·옵션값 사후 수정 «불가» 는 문서로 확인됨
                         → 전체를 SUPPORTED 라고 말할 수 없다.
categoryUpdate: UNKNOWN  표준(scatNo) + 전시(dcatLst[]) «2중 구조» 라 「카테고리 하나」
                         를 견줄 수 없다. 무엇이 같아야 같은 것인지부터 미정.
```

그래서 기등록 상품은 **항상** `categoryUnknown: true` 로 판단에 들어가고 결과가
BLOCKED 다(`route.ts:239-246`). 🔴 RECREATE 가 발행되는 경로가 «문법적으로 없어서»
`replaceChannelProductLink` 도 없다 — 누락이 아니라 일치다.

## 5. 공통 경계 — 세 라우트가 «같은 함수» 로 판단한다

```
findChannelProductBySnapshot → resolveCreateGate → resolveLifecycle → link/replace/touch
```

세 라우트 전부 이 네 개를 쓴다. 판단을 복제한 곳이 없고, capability 표를 라우트가
다시 쓰는 곳도 없다. 🔴 이번에 테스트로 고정했다(§③).

## 6. 🔴 이번에 «찾은» 것

### 6-1. capability ↔ 어댑터 ↔ 문구 정합이 주석으로만 막혀 있었다 → 고정함

`editUnavailableNote()` 는 어댑터가 있으면 `undefined` 를 낸다. 즉 **UNKNOWN 인
채널을 `EDIT_ADAPTERS` 에 한 줄 적는 순간 「확인되지 않았습니다」가 조용히
사라진다.** 지금까지 이것을 막는 것은 `edit-adapters/index.ts:17-26` 의 주석뿐이었다.

검증: coupang 을 `EDIT_ADAPTERS` 에 임시로 넣어 보니 새 테스트 5건이 빨개졌다
(문구 소실 포함). 되돌렸다. **가드가 실제로 일한다는 것을 실행으로 확인했다.**

### 6-2. 🔴 그 문구가 «아무 화면에도 닿지 않는다»

`editUnavailableNote` · `editAdapterFor` · `channelEditScope` 의 **프로덕션 호출부가
0건**이다(테스트만 부른다). 수정 UI 는 smartstore 전용 경로로만 서므로, Coupang ·
LotteON 을 연 셀러는 「등록된 상품을 수정할 수 있는지」에 대해 **아무 말도 듣지
못한다** — 「확인되지 않았습니다」조차 못 듣는다.

🔴 이번에 고치지 않았다. 두 채널에는 「수정」 화면 자체가 없어서, 문구를 띄우려면
**없던 UI 자리를 새로 만들어야** 한다 — 그것은 CPO 의 화면 결정이고 CTO 가 조용히
만들 것이 아니다. §7 에 올린다.

### 6-3. Coupang UNKNOWN 의 «이유» 가 두 목소리였다 → 고쳤다

```
channel-lifecycle.ts (2026-09-26)   「문서 근거 확보 · 실측 대기」
coupang/register/route.ts            「수정 엔드포인트 근거 «없음»」   ← 옛 이유
```

이 주석을 읽은 다음 사람은 이미 끝난 STEP 6 조사를 다시 한다. 라우트 주석과
최종 매트릭스 테스트 이름을 표의 현재 이유로 맞췄다. **값(UNKNOWN)은 그대로다.**

## 7. CPO 결정이 필요한 것

| # | 내용 | 왜 CTO 가 정하지 않는가 |
|---|---|---|
1 | Coupang · LotteON 에 「수정 안내」 자리를 만들 것인가 | 없던 화면을 만드는 결정(§6-2) |
2 | SmartStore 미리보기를 실전 빌더로 옮길 것인가 | 옮기지 않으면 두 빌더가 남고, 옮기면 미리보기 동작이 바뀐다(§2-1) |
3 | LotteON `sitmNo` 확보 경로(apiNo 93 재호출)를 90 조사보다 먼저 둘 것인가 | 조사 순서 결정(§4) |

## 8. 확인 못 한 것

* Coupang GET 응답의 실제 모양 — probe 준비됨, 토큰 값 없음
* LotteON apiNo 94 응답의 실제 모양 — 호출부 없음
* Coupang 수정 후 `sellerProductId` 유지 여부 · 승인 대기 중 수정 가능성
* LotteON apiNo 90 의 대상 상태 · 수정 가능 필드 · 되돌림 수단
* SmartStore Production UPDATE 는 앞선 세션에서 검증됐다고 기록돼 있으나, **이번
  세션에서 다시 실행하지 않았다**(그 기록을 재검증 없이 그대로 옮긴다)
