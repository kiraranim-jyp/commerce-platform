# Commerce-5 — 공통값 자동주입 / LotteON 등록정보 정리 · 착수 노트

> CTO(2026-09-26). 🔴 **코드 변경 0.** 이 문서는 «시작점» 이다 — 첫 확인 하나를
> 마치고 컨텍스트 한계로 인수인계한다. 추측한 것은 추측이라고 적었다.

## 1. 🔴 `4279402` 의 정체 — 추측하지 않고 확인했다

화면의 「해외배송정책번호\*」 칸(`4279402 / 업체배송_무기한없음 유료 / 도서산간 3000원 /
제주시 3000원`)은 LotteON apiNo 87 payload 의 **`dvCstPolNo`(배송비정책번호)** 다.

근거(전부 기존 코드):

| 자리 | 근거 |
|---|---|
어댑터 필드명 | `packages/listing/src/lotteon/adapter.ts:152` — `["dvCstPolNo", "배송비정책번호"]` |
payload 생성 | `build-payload.ts:435` — `dvCstPolNo: channel.deliveryCostPolicyNo ?? ""` |
검증 | `validate-payload.ts:242` — 없으면 BLOCKED |
타입 | `types.ts:212` |
조회 API | `/api/lotteon/delivery-settings` → apiNo **166**(`getDvCstListSr`) |
UI | `LotteOnRegistrationPanel.tsx:1351` · `lotteon-channel-form.ts:860` |

## 2. 🔴 그래서 진단이 «default 값 넣기» 가 아니다

작업지시서가 요구한 구조는 **LotteON 배송 축에 이미 구현돼 있다**:

```
seller_settings.delivery_cost_policy_no      ← 저장 자리가 «있다»
        ↓  _lib/seller-settings.ts:40 · :88   (deliveryCostPolicyNo)
Registration Context
        ↓  build-payload.ts:435
LotteON payload.dvCstPolNo
```

즉 **COMMON → Context → payload 경로가 끊겨 있는 것이 아니다.** 그리고 자동 선택도
이미 있다 — `lotteon-delivery-autopick.test.ts`.

🔴 **그러면 왜 화면이 비어 있는가.** 가설 두 개이고, **둘 다 아직 확인하지 않았다**:

| # | 가설 | 확인 방법 |
|---|---|---|
**①** | `seller_settings` 에 값이 **저장된 적이 없다** | 설정 화면에서 배송비정책이 선택돼 있는지 |
**②** | 🔴 **apiNo 150/166 조회가 실패해 목록이 비었고, 그래서 autopick 이 고를 것이 없었다** | `docs/tech-debt-register.md:535` 가 「LOTTEON connectivity — intermittent / UNRESOLVED」와 20초 타임아웃을 기록한다. 같은 화면의 여러 칸이 «동시에» 빈 것이 이 가설과 맞는다 |

②가 맞다면 **고쳐야 하는 것은 default 값이 아니라 조회 실패 경로**다 — 값을 하드코딩하면
연결이 끊긴 사실이 화면에서 사라지고, 셀러는 잘못된 정책번호로 등록하게 된다.

🔴 **그래서 `4279402` 를 상수로 박아 넣지 않았다.** 지시서도 「필드 의미를 임의로 추측하지
말고 실제 API contract 기준으로 연결」하라고 했고, 지금 상태는 **연결이 없는 것이 아니라
값이 도착하지 않은 것**으로 보인다.

## 3. 다음 CTO 가 이어서 할 순서

```
STEP 1  ①/② 판별 — 설정 화면의 배송비정책 값 존재 여부 · delivery-settings 응답 관찰
        🔴 이것이 먼저다. 원인에 따라 고칠 자리가 «완전히» 다르다.
STEP 2  전 필드 분류표 작성 — COMMON_SELLER_SETTING / CHANNEL_OPERATION / PRODUCT
        세 채널 payload 와 UI 입력칸 전수. 지시서 §7 매트릭스 형태로.
STEP 3  COMMON 축이 «출처 → UI → payload» 세 단계 모두 연결되는지 확인
        (UI defaultValue 만 넣는 방식은 PASS 가 아니다 — 지시서 §2)
STEP 4  끊긴 곳만 최소 수정. 🔴 공통값을 커머스별로 복사 저장하지 않는다(§5 금지)
STEP 5  회귀 — SmartStore/Coupang Production PASS 기능 무변경 확인
```

### 🔴 STEP 2 에서 이미 아는 것(재조사 금지)

LotteON 선결 4값은 문서로 확정돼 있다 — `owhpNo`(출고지) · `rtrpNo`(반품지) ·
`dvCstPolNo`(배송비정책) · `dvRgsprGrpCd`(배송등록자그룹). 넷 다
`_lib/seller-settings.ts` 에 저장 자리가 있고 apiNo 150/166 으로 조회한다.
→ **넷 다 COMMON_SELLER_SETTING 이다**(채널 고유 운영정보가 아니다).

화면에서 「입력 필요」로 뜬 나머지(고시정보 `상품품목코드` 등)는 STEP 2 에서 분류한다.

## 4. 이번에 하지 않은 것

코드 변경 0 · 카테고리/비교사이트 확대 0 · MI 작업 0 · LotteON UPDATE 설계 0 ·
추측 API 0 · 공통값 중복 저장 0 · push 0.

🔴 그리고 **`4279402` 하드코딩도 하지 않았다** — §2 의 이유 때문이다. ①로 확인되면
그때는 「설정에 저장」이 답이고, ②로 확인되면 「조회 실패를 드러내고 고치는 것」이 답이다.
어느 쪽이든 상수 박기는 답이 아니다.
