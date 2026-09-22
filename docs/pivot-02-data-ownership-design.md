# [TTAEJYO-PIVOT-02] DATA OWNERSHIP / CARDINALITY / RESOLVER STANDARD

> **Phase 1 — 설계 전용. 코드·DB·UI 변경 0건.**
> CPO 검수 전까지 구현에 들어가지 않는다.

작성 2026-09-22 · 근거는 전부 PIVOT-01 실측(코드 읽기 + 실제 DB 조회)이다.
추정에는 🟡, 미확인에는 🔴 미확인 을 붙였다.

---

## 0. 이 문서가 고정하려는 한 문장

> **커머스가 TTAEJYO 의 데이터 모델을 결정하지 않는다.**
> TTAEJYO 는 상품의 «사실» 과 판매자의 «설정» 을 소유하고,
> 각 커머스는 그것을 자기 API 표현으로 «변환» 하는 마지막 어댑터다.

오늘 롯데ON 하나를 붙이면서 그 반대가 일어났다 — 채널이 요구할 때마다 상품 모델과
설정 화면에 필드가 하나씩 붙었다. 이 문서는 그 방향을 되돌리기 위한 기준선이다.

---

## 1. Ownership Matrix

여섯 개 소유권만 쓴다. 새 값이 생기면 반드시 이 중 하나로 분류한 뒤 저장 위치를 정한다.

| 소유권 | 정의 | 판별 질문 |
|---|---|---|
| `PRODUCT` | 상품의 **사실**. 상품이 바뀌면 바뀐다. | 「이 값은 상품을 설명하는가?」 |
| `PRODUCT_OVERRIDE` | 이 상품에서만 기본값을 덮는 값. | 「보통은 설정에서 오지만 이 상품만 다른가?」 |
| `SELLER_SETTINGS` | 판매자가 한 번 정하고 반복 사용. 채널 무관. | 「상품이 바뀌어도 그대로인가?」 |
| `SHIPPING_PROFILE` | 배송의 **의미**. 여러 개 가질 수 있다. | 「출고지·배송비의 «뜻» 인가?」 |
| `CHANNEL_MAPPING` | 같은 의미의 **플랫폼 식별자**. | 「플랫폼이 «발급» 한 번호/코드인가?」 |
| `CHANNEL_ONLY` | 그 채널에만 존재하는 개념. | 「다른 채널에는 대응 개념이 없는가?」 |

### 🔴 가장 중요한 경계

```text
"성남 물류센터"            SHIPPING_PROFILE   ← TTAEJYO 의 의미
쿠팡 24496935              CHANNEL_MAPPING    ← 플랫폼이 발급한 식별자
네이버 releaseAddressBookNo CHANNEL_MAPPING
롯데ON owhpNo               CHANNEL_MAPPING
```

이 둘을 같은 칸에 넣으면 채널이 늘 때마다 공통 구조가 오염된다. 지금
`coupang_seller_profiles.outbound_shipping_place_code` 가 정확히 그 상태다 —
«공통 프로필» 이라는 자리에 쿠팡 ID 가 들어 있다.

---

## 2. Cardinality Matrix

🔴 `workspace` 를 **설계상 최상위 소유자**로 둔다.
🔴 실제 `workspace_id` 마이그레이션과 격리 구현은 **이번 범위가 아니다**(Beta Security 트랙).

| 자원 | Cardinality | 현재 실측 | 근거 |
|---|---|---|---|
| `workspace` | 루트 | 15행 | `workspaces` |
| `SELLER_SETTINGS` | workspace × **?** | 🔴 scope 축 없음 | §2-1 |
| `BRAND_PROFILE` | workspace × brand | 2행(전역) | `coupang_brand_profiles` |
| `SHIPPING_PROFILE` | workspace × N | 3행(전역) | `coupang_seller_profiles` `name`+`is_default` |
| `CHANNEL_MAPPING` | shipping_profile × channel × 0..1 | 없음 | 지금은 프로필 컬럼에 섞임 |
| `COMMERCE_ACCOUNT` | workspace × channel × N | 2행(전역) | `commerce_accounts` `platform`+`is_default` |
| `PRODUCT` | workspace × N | 355행 ✅ | `product_snapshots.workspace_id` |

### 2-1. 🔴 `SELLER_SETTINGS` 의 cardinality — **아직 확정하지 않는다**

CPO 지시대로 「workspace 당 1행」을 DB 설계로 못박지 않는다. 먼저 **scope 축이 몇 개인지**
근거로 답한다.

현재 데이터에서 **실재가 확인된 scope 축**:

| 축 | 실재 | 근거 |
|---|---|---|
| workspace | ✅ 있다 | `workspaces` 15행 · 상품은 이미 이 축으로 나뉜다 |
| brand | ✅ 있다 | `coupang_brand_profiles` 가 manufacturer/origin 을 브랜드별로 갖는다 |
| shipping profile | ✅ 있다 | `name` + `is_default` 로 여러 개가 정상인 유일한 축 |
| channel | ✅ 있다 | `commerce_accounts.platform` |
| 사업자 / 스토어 / 판매방식 / 국가 | 🔴 없다 | 코드·DB 어디에도 없다. 지금 만들면 «쓰이지 않는 축» 이 된다 |

**판정**

```text
SELLER_SETTINGS = workspace × 1        (현 시점 근거 기준)

근거  판매자 정보(제조사·A/S·품질보증·KC문구·원산지 기본)를 «둘 이상» 갖는
      이유가 현재 코드·데이터·화면 어디에도 없다. 지금 3행이 존재하는 것은
      그것이 «배송 프로필» 과 같은 행에 얹혀 있기 때문이지, 판매자 정보가
      여러 벌 필요해서가 아니다(실측: is_default 아닌 2행은 전부 null).

🔴 다만 «1행» 을 스키마로 강제하지 않는다.
   PK 를 `workspace_id` 단독으로 두면 나중에 축이 늘 때 PK 를 바꿔야 한다.
   대신 `(workspace_id, scope_key)` 형태로 두고 지금은 scope_key 를 고정값으로
   쓰는 것을 권고한다 — 축이 늘어도 행만 늘고 스키마는 그대로다.
```

### 2-2. 가격정책의 소유권 — **`SELLER_SETTINGS` 로 «바로» 넣지 않는다**

CPO 지적대로 「지금 `coupang_seller_profiles` 에 있다」와 「그러므로 SELLER_SETTINGS 다」는
별개다. 세 층이 필요해질 가능성이 높다.

```text
default_margin_percent · price_rounding_unit · include_shipping_in_price
· domestic_shipping_cost_krw
```

| 층 | 필요한가 | 근거 |
|---|---|---|
| 판매자 기본 | ✅ 있다 | 지금 쓰고 있다(`defaultMarginPercent` → CommerceWorkspace) |
| 채널별 | 🟡 가능성 | 채널 수수료가 달라 마진을 다르게 잡을 이유가 실재한다. 다만 **지금 구현은 없다** |
| 상품별 | ✅ 있다 | `priceBreakdown.marginPercent`(상품) · `channelPriceOverrides`(채널별 최종가) |

**판정**

```text
PRICING = SELLER_SETTINGS(기본) + PRODUCT_OVERRIDE(상품)
          + 🟡 CHANNEL 층은 «자리만» 설계에 두고 지금 만들지 않는다

🔴 지금 결정하지 않는 것: 채널별 가격정책을 CHANNEL_MAPPING 에 둘지
   SELLER_SETTINGS 안의 채널 칸에 둘지. 실제 요구가 생길 때 결정한다.
   (없는 요구로 스키마를 만들면 그것이 다음 오염이 된다)
```

---

## 3. Field-level Resolver Matrix

🔴 **단일 거대 사다리를 만들지 않는다.** 데이터 종류마다 resolver 가 다르다(CPO §7).

### 3-1. Product Fact Resolver — 상품의 «사실»

```text
상품 명시값 → 상품 Override → Brand Profile → Seller Settings → 없음
```

| 필드 | 상품 | Brand | Seller | 현재 구현 |
|---|---|---|---|---|
| 상품명·색상·소재·옵션·이미지 | ✅ | — | — | 상품만 |
| 제조사 | ✅ | ✅ | ✅ | ✅ 이미 이 사다리 (`ManufacturerResolutionNote`) |
| 원산지 | ✅ | ✅ | ✅ | `default_country_of_origin` 존재 |
| 품명·모델명·중량·인증유형 | ✅ | — | — | 🔴 §5 참조(네이버 종속) |
| A/S 연락처 | — | — | ✅ | `as_contact_number` |
| 품질보증기준 | — | — | ✅ | `quality_guarantee` |
| KC 면제 문구 | — | — | ✅ | `kc_exemption_text` |

**제조사 사다리가 유일하게 이미 완성된 선례다. 이것을 표준으로 승격한다.**

### 3-2. Shipping Resolver — 배송의 «의미»

```text
상품 배송 Override → Shipping Profile
```

🔴 상품 단위 출고지/반품지 override 는 **현재 존재하지 않는다**(PIVOT-01 확인).
`shippingFee` 만 상품 override 가 가능하다. 설계에는 자리를 두되 구현 요구는 없다.

### 3-3. Channel ID Resolver — 플랫폼 «식별자»

```text
Shipping Profile → Channel Mapping
```

🔴 **Brand / Seller Settings 를 거치지 않는다**(CPO §7). 「쿠팡 출고지 ID」를 찾는 데
브랜드 프로필을 뒤지는 것은 의미가 없다.

| 의미 | 쿠팡 | 네이버 | 롯데ON |
|---|---|---|---|
| 출고지 | `outboundShippingPlaceCode` | `releaseAddressBookNo` (실시간 조회) | `owhpNo` |
| 반품지 | `returnCenterCode` | `refundAddressBookNo` (실시간 조회) | `rtrpNo` |
| 배송비정책 | — | — | `dvCstPolNo` |
| 배송가능지역 | — | — | `dvRgsprGrpCd` |
| 택배사 | `deliveryCompanyCode` | `naverDeliveryCompanyCode` | `courierCode` |

🔴 네이버는 **저장하지 않고 매번 조회한다**(`GET /v1/seller/addressbooks-for-page`).
→ CHANNEL_MAPPING 은 「저장된 값」만이 아니라 「조회 방법」도 표현할 수 있어야 한다.

### 3-4. Channel Field Resolver — 채널 «표현»

```text
위 셋의 결과 → Channel Schema → Channel Input Mode
```

이 계층이 §4 다.

---

## 4. Channel Input Mode Matrix

🔴 **「상세페이지 참조」는 상품 값이 아니라 «채널 입력 방식» 이다.**

```text
Product.material = UNKNOWN
        ↓
Channel Schema
        ↓
롯데ON 고시 항목  DETAIL_REFERENCE_ALLOWED  → "상품상세참조"
쿠팡 구매옵션     DETAIL_REFERENCE_FORBIDDEN → REQUIRES_INPUT
```

| Mode | 뜻 | 화면 |
|---|---|---|
| `VALUE` | 실제 값이 있다 | 값을 보여준다 |
| `DETAIL_REFERENCE_ALLOWED` | 값은 없지만 채널이 상세참조를 받는다 | 「상세페이지 참조로 등록됩니다」 |
| `DETAIL_REFERENCE_FORBIDDEN` | 채널이 상세참조를 거부한다 | 🔴 등록 전에 입력을 요구한다 |
| `REQUIRES_INPUT` | 값도 없고 대체도 없다 | blocker + 해결 경로 |
| `CHANNEL_DEFAULT` | 채널이 정한 기본값이 있다 | 자동, 근거 표시 |

### 실측 근거 (오늘 확보)

| 채널 | 필드군 | Mode | 근거 |
|---|---|---|---|
| 쿠팡 | 구매옵션(attributes) | `DETAIL_REFERENCE_FORBIDDEN` | 실등록 거절 — 「허용되지 않는 구매옵션 값」(attempt a7572b88) |
| 쿠팡 | 고시정보(notices) | `DETAIL_REFERENCE_ALLOWED` | 「전체 상품 상세페이지 참조」로 성공(2026-07-30) |
| 롯데ON | 고시 항목 | `DETAIL_REFERENCE_ALLOWED` | 판매자센터 9개 항목 전부 「상품상세참조」 체크박스 존재 |
| 롯데ON | 구매옵션(itmOptLst) | 🔴 미확인 | 실등록이 거기까지 가지 않았다 |

🔴 **이 표가 오늘 하루 실패에서 건진 가장 값비싼 자산이다.** 같은 문구가 채널·필드군마다
다르게 취급된다는 것을 실측으로 확인했다.

---

## 5. Master Product Pollution Audit

| 필드 | 현재 위치 | 실제 사용 채널 | 목표 소유권 |
|---|---|---|---|
| `lotteOnChannelInfo` | CanonicalProduct:331 | 롯데ON | 🔴 `CHANNEL_ONLY` — 상품 밖으로 |
| `categoryFieldOverrides` | CanonicalProduct:347 | 쿠팡만 | 🔴 `CHANNEL_ONLY` (이름에 채널이 없어 더 위험) |
| `certificationType` | CanonicalProduct:514 | 네이버 KIDS | 🟡 `PRODUCT` — 「KC 인증유형」은 상품의 사실. 이름만 네이버 용어 |
| `itemName` `modelName` `weight` | CanonicalProduct:505~510 | 네이버 KIDS | 🟡 `PRODUCT` — 품명·모델명·중량은 상품의 사실 |
| `priceBreakdown` | CanonicalProduct:288 | 롯데ON만 읽음 | 🟡 `PRODUCT_OVERRIDE`(가격 근거) — 채널 종속 아님 |
| `channelPriceOverrides` | CanonicalProduct:307 | 전 채널 | ✅ **올바른 선례** `Record<PlatformId, …>` |

### 🔴 판정

```text
진짜 오염 2개   lotteOnChannelInfo · categoryFieldOverrides
                → 상품이 아니라 «그 상품을 그 채널에 등록하기 위한 표현» 이다

오해였던 것 4개  certificationType · itemName · modelName · weight
                → 네이버 용어로 이름이 붙었을 뿐 상품의 사실이다. 이름만 바꾸면 된다.
                → 🔴 이름 때문에 채널 종속으로 «보이는» 것이 더 위험하다.
                   다음 사람이 「네이버 거니까 지워도 되겠지」라고 읽는다.
```

### 🔴 `PlatformId` 에 `lotteon` 이 없다

```text
packages/shared/src/product-types.ts:601
  PlatformId = "smartstore" | "coupang" | "elevenst"
```

롯데ON 은 정식 채널이 아니라 **병렬 시스템**으로 자랐다. 오늘 내가 한 작업이 전부
그 병렬 경로 위에 쌓였다. `channelPriceOverrides` 같은 올바른 패턴의 혜택도 못 받는다.

### 🔴 채널 간 직접 의존

```text
packages/listing/src/naver/build-payload.ts:6
  import { assembleContentsFromBlocks, BLANK_COUPANG_SELLER_CONFIG } from "../coupang/build-payload";
```

네이버가 쿠팡 코드를 직접 쓴다. **쿠팡 상세페이지 조립을 고치면 네이버가 같이 바뀐다.**

---

## 6. Current → Target Mapping

| 현재 | 목표 소유권 | Cardinality | Migration |
|---|---|---|---|
| `commerce_accounts` (자격증명) | `COMMERCE_ACCOUNT` | ws × channel × N | 🔴 workspace 축 (Beta Security) |
| `commerce_accounts.vendor_user_id` 외 | — | — | — |
| `coupang_seller_profiles.vendor_user_id` | `COMMERCE_ACCOUNT` | ws × channel | 🟢 위치 정정(단일 값) |
| `coupang_seller_profiles` 배송 «의미» | `SHIPPING_PROFILE` | ws × N | 🟠 분리 |
| `coupang_seller_profiles` 쿠팡 ID 3종 | `CHANNEL_MAPPING` | profile × coupang | 🔴 쿠팡 실등록 경로 |
| `coupang_seller_profiles` 판매자 5종 | `SELLER_SETTINGS` | ws × 1 | 🟠 is_default 행만 이동 |
| `coupang_seller_profiles` 가격 4종 | `SELLER_SETTINGS`(+상품 override) | ws × 1 | 🟠 |
| `coupang_brand_profiles` | `BRAND_PROFILE` | ws × brand | 🟢 그대로 |
| `lotteon_seller_settings` 배송 4종 | `CHANNEL_MAPPING` | profile × lotteon | 🟢 0행 |
| `lotteon_seller_settings` 마감 2종 | `SHIPPING_PROFILE` | ws × N | 🟢 0행 |
| `lotteon_seller_settings.default_import_proxy_code` | 🔴 HOLD | — | API contract 미확인 |

### 🔴 데이터 유실 위험 (실측)

```text
coupang_seller_profiles 3행
  is_default=true   → 값이 «있는» 유일한 행. 이 한 행만 옮기면 된다.
  is_default=false  → 판매자·가격 컬럼이 전부 null (2행)
lotteon_seller_settings 0행 → 유실 없음
coupang_brand_profiles 2행 → 이동 없음
```

---

## 7. Workspace Scope

```text
workspace (루트, 15개)
├── COMMERCE_ACCOUNT      channel × N
├── SELLER_SETTINGS       1  (scope_key 로 확장 여지)
├── BRAND_PROFILE         brand × N
└── SHIPPING_PROFILE      N
        └── CHANNEL_MAPPING   channel × 0..1
```

🔴 설계에만 포함한다. `workspace_id` 추가·격리 구현은 이번 범위가 아니다.

---

## 8. 🔴 Security Risk — P0

```text
commerce_accounts 에 workspace_id 가 «없다»

workspaces        15개
product_snapshots 355행 · workspace_id 있음   ← 상품은 나뉜다
commerce_accounts   2행 · workspace_id 없음   ← 🔴 인증키는 «공유» 된다
```

**한 워크스페이스의 쿠팡/네이버/롯데ON 인증키를 다른 워크스페이스가 그대로 쓴다.**
지금은 셀러가 한 명이라 드러나지 않지만, 둘이 되는 순간 **남의 계정으로 상품이 등록된다.**

같은 문제가 `coupang_seller_profiles`(판매자 정보·배송지) ·
`coupang_brand_profiles` 에도 있다.

→ **Beta Security 트랙 이관 대상. PIVOT-02 구현 범위 아님.**

---

## 9. Migration Order (설계만 · 실행 금지)

| # | 내용 | 위험 | 전제 |
|---|---|---|---|
| 001 | `SELLER_SETTINGS` 신설 + is_default 행 backfill | 🟠 | dual-read |
| 002 | reader 를 `SELLER_SETTINGS` 로 전환 | 🟠 | 001 검증 |
| 003 | `SHIPPING_PROFILE` 에서 «의미» 만 남기기 | 🟠 | 002 |
| 004 | `CHANNEL_MAPPING` 신설 + 쿠팡 ID 3종 이동 | 🔴 | 쿠팡 실등록 회귀 검증 필수 |
| 005 | `lotteon_seller_settings` 흡수 | 🟢 | 0행 |
| 006 | `PlatformId` 에 `lotteon` 정식 등록 | 🔴 | 레지스트리 3곳 동시 |
| 007 | naver ↔ coupang import 분리 (`common/` 승격) | 🟠 | 두 채널 회귀 |
| 008 | `CHANNEL_ONLY` 분리 (lotteOnChannelInfo · categoryFieldOverrides) | 🟠 | 006 |
| 009 | 네이버 용어 필드 이름 정정 (itemName 등) | 🟡 | 이름만 |
| — | workspace 격리 | 🔴 | **Beta Security 트랙** |

**004 가 이 전체에서 가장 위험하다** — 쿠팡은 오늘 실제 LIVE 등록에 성공한
유일한 경로다(externalProductId 16392432073).

---

## 10. 설계 원칙 (CPO 확정)

```text
① Resolver 는 값을 «만드는» 계층이 아니라 «찾는» 계층이다.
   ❌ Brand=Bobo Choses  → Manufacturer=Bobo Choses  (추론 금지)
   ❌ UNKNOWN            → "상품상세참조"            (Product Resolver 의 일이 아니다)
   ⭕ UNKNOWN → Channel Schema → DETAIL_REFERENCE_ALLOWED → "상품상세참조"

② 커머스가 데이터 모델을 결정하지 않는다.
   새 값이 생기면 먼저 §1 여섯 소유권 중 하나로 분류한다.
   「API 가 요구하니 상품에 컬럼을 하나」는 금지.

③ 의미와 식별자를 같은 칸에 넣지 않는다.
   "성남 물류센터"(의미) ≠ 24496935(쿠팡 식별자)

④ 없는 요구로 스키마를 만들지 않는다.
   사업자/스토어/판매방식/국가 scope 는 현재 근거가 없다 — 만들지 않는다.
   대신 `(workspace_id, scope_key)` 로 «늘어날 자리» 만 남긴다.
```

---

## 남은 미확정 (Phase 2 에서 결정)

```text
🔴 채널별 가격정책 층의 저장 위치      실제 요구 발생 시 결정
🔴 롯데ON 구매옵션의 Input Mode       실등록이 거기까지 가지 않았다
🔴 pdItmsArtlLst 항목코드             롯데ON API 미제공 확정 · 판매자센터 실물 필요
🔴 impPrxCd 코드값                    API contract 미확인 · HOLD
🔴 SELLER_SETTINGS scope_key 의 초기값 정의
```
