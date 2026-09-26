# Commerce-6 C-2A — 배송/물류 Common 과 Commerce binding

> CTO(2026-09-26). **DB 0 · migration 0 · push 0.**
> 판단 기준은 파일명·타입·import 가 아니라 **최종 payload 까지 값이 흐르는가** 하나다.

---

## 🔴 조사가 뒤집은 전제

C-2A 를 시작할 때의 그림은 「배송 프로필에 롯데ON 칸 3개를 더한다」였다.
실제 경로를 따라가 보니 **그 그림이 틀렸다.**

```text
스마트스토어 출고지/반품지   주소록을 «조회» 해서 RELEASE / REFUND_OR_EXCHANGE 로 고른다
스마트스토어 반품택배사      목록을 «조회» 해서 PRIMARY 를 고른다
쿠팡 출고지                  목록을 «조회» 해서 상품 «원산지 국가» 와 맞는 곳을 고른다
```

즉 **채널이 목록을 주는 값은 세 채널 어디서도 저장하지 않는다.** 런타임에 의미로
고른다. 반대로 우리 DB 에 채널 코드가 박혀 있는 세 칸은 전부 **목록 API 가 없어서**
셀러가 적어 둔 것이다 — 규칙이 아니라 예외다.

```text
Common 은 «의미» 를 갖는다        (역할 · 이름 · 금액 · 일수)
채널 코드는 «런타임에» 해석한다   (각 채널의 목록에서)
목록이 없는 채널에서만 저장한다   (예외)
```

🔴 그러므로 **「롯데ON 3개 필드 추가」는 하면 안 된다.** 출고지·반품지는 저장하는
순간 틀린 값이 되고(채널이 발급한다), 택배사만이 Common 이 이름을 가질 수 있다.

---

## ① 배송 프로필 각 필드의 실제 소비처 (전수)

| 개념 | 스마트스토어 | 쿠팡 | 롯데ON |
|---|---|---|---|
출고지 | 목록 `addressbooks-for-page` → `releaseAddressBookNo` | 목록 조회 → 원산지로 선택 → `outboundShippingPlaceCode` | 150 → `owhpNo` |
반품지 | 같은 목록 → `refundAddressBookNo` | 🔴 **저장값 그대로** `returnCenterCode` | 150 → `rtrpNo` |
택배사 | 저장값 `deliveryCompany` (목록 API 없음) | 저장값 `deliveryCompanyCode` | 89 → `hdcCd` |
반품 택배사 | 목록 → `returnDeliveryCompanyPriorityType` | **개념 없음**(0건) | 89 → `rtngHdcCd` |
배송비 | 금액 `deliveryFee` | 금액 `deliveryCharge` | 🔴 166 → `dvCstPolNo`(**정책**) |
출고 소요일 | 🔴 **payload 에 없음** | `outboundShippingTimeDay` | `sndBgtNday`(상한 3) |
도서산간 | 타입만 있고 안 채움 · 묻는 건 «추가비» | 🔴 **상수 `"N"`** | 89 → `dvRgsprGrpCd` |
발송마감 | 없음 | 없음 | 🟡 `nldySndCloseTm` UNKNOWN |

쓰기 UI / 소유: `coupang_seller_profiles` 는 **모든 값의 단일 입력처**이고
`seller_settings` 는 C-1b 로 workspace 축이 붙었다. `lotteon_seller_settings` 는
**쓰는 화면이 0건**이다(C-2 게이트 ①).

---

## ② Common 승격 대상

```text
PROMOTE      택배사 · 반품 택배사 · 배송비(금액) · 출고 소요일
ROLE_ONLY    출고지 · 반품지        ← 역할만 공통. 🔴 저장하면 틀린다
CHANNEL_ONLY 도서산간 · 발송마감    ← 채널마다 «묻는 것» 이 다르다
```

본체는 **택배사**다. 지금은 같은 「우체국택배」를 두 칸에 따로 적게 하고
(`delivery_company_code` · `naver_delivery_company_code`) 롯데ON 에서는 상품마다
다시 고르게 한다. Common 이 이름 하나를 가지면 셀러 입력이 한 번이 된다.

🔴 반대로 **배송비는 Common 승격이 「한 값으로 셋을 채운다」가 아니라는 반례**다 —
롯데ON 만 금액이 아니라 정책이다. 금액에서 정책을 만들 수 없다.

## ③ Commerce 별 binding 대상

`packages/listing/src/common/logistics.ts` 가 다섯 전략으로 고정한다.

```text
CHANNEL_LIST    채널이 목록을 준다 → 런타임 해석. 저장할 코드가 없다
SELLER_TYPED    목록 API 가 없다 → 셀러가 적고 우리가 저장한다(예외)
CONSTANT        우리가 상수로 박아 보낸다 — 🔴 셀러가 정한 적이 없다
NOT_APPLICABLE  그 채널에 개념이 없다
UNKNOWN         확인 못 했다 — 🔴 추정하지 않는다
```

🔴 `DV_CO_CD` · `DV_RGSPR_GRP_CD` 같은 채널 발급 ID 는 Common 값이 되지 않는다.
이 파일 어디에도 그 코드의 **값**이 없고, 테스트가 그것을 본다.

## ④ `lotteon_seller_settings` 존속 필요성

**남긴다. 단 지금 손대지 않는다.**
배송가능지역 칸은 여기에만 있고 `fixed()` 사다리도 살아 있다. 다만 workspace 축이
없어 기본값을 넣으면 C-1b/C-1c 가 없앤 공유 구조가 되살아난다. Common 확정 전
migration 은 **삭제 ❌ · backfill ❌ · 임의 workspace 연결 ❌ · 기본값 삽입 ❌.**

## ⑤ 기존 Coupang/Naver 설정과의 관계

두 칸(`delivery_company_code` · `naver_delivery_company_code`)은 **Common 의 원형**이
아니라 **목록 API 부재의 흔적**이다. Common 이 생기면 이 둘은 지워지는 게 아니라
**binding 으로 강등**된다(의미는 Common, 코드는 채널). 🔴 지금 옮기지 않는다 —
쿠팡은 유일하게 LIVE 등록에 성공한 경로다.

## ⑥ 필요한 DB migration — **이번엔 0건**

Common 이 확정되면 필요한 것(설계만):

```text
① 택배사 «의미» 한 칸 (workspace 범위, 043/059 패턴)
② 채널 binding 은 기존 두 칸을 재사용 — 새로 만들지 않는다
③ 롯데ON binding 은 89 목록에서 «셀러가 고른 것» 을 담는다(추정 금지)
```

## ⑦ UI 변경 — 🔴 F-7 이 놓친 자리를 하나 고쳤다

셀러 설정 판정표가 라벨 옆에 `→ owhpNo` `→ hdcCd` `→ dvCstPolNo` 를 **항상 보이게**
찍고 있었다. 입력칸 쪽 코드 노출은 F-7 에서 다 걷어냈는데 이 표만 남아 있었다.
데이터의 `lotteOnField` 는 두고 **화면에서만** 뺐다. 라벨도 의미로 바꿨다
(`배송가능지역코드 → 배송 가능 지역`, `반품택배사코드 → 반품 택배사`,
`배송비정책번호 → 배송비 정책`). note 의 `DV_CO_CD` 도 지웠다.

🔴 **CPO 판단이 필요한 것 하나** — 입력칸의 ⓘ 툴팁이 「롯데ON API 필드명 owhpNo」를
`title`/`sr-only` 로 갖고 있다. 이것은 REWORK-14 가 «의도적으로» 정한 것이라
(눈에 보이는 라벨은 사람 이름, 코드는 툴팁으로 보존) 임의로 바꾸지 않았다.
F-7 의 「보지 않는다」를 툴팁까지 적용할지는 제품 결정이다.

## ⑧ Readiness 연결

`describeUnresolvedBinding()` 이 **코드가 아니라 의미 + 어디서 해결** 을 돌려준다.

```text
채널 목록 있음  →  "택배사 목록에서 「우체국택배」을(를) 골라 주세요."
확인 안 됨      →  "… 아직 연결 방법이 확인되지 않았습니다."
개념 없음/상수  →  🔴 null — 없는 것을 «부족» 이라 하지 않는다
```

테스트가 `resolveHint` 에 「입력」이 들어가지 않는 것을 본다 — 「코드를 적으세요」가
결론이 되는 길을 구조적으로 막는다.

## ⑨ 기존 등록 payload 영향 — **0**

바뀐 것은 라벨·안내문·화면 표시뿐이다. payload 조립 경로는 한 줄도 건드리지 않았다.
`logistics.ts` 는 아직 어떤 payload 도 읽지 않는 **선언**이다.

## ⑩ 🔴 이번 조사에서 뒤집힌 «거짓 문장» 셋

```text
"쿠팡·스마트스토어는 반품 택배사를 구분하지 않습니다"
   → 스마트스토어는 목록 API 까지 있고 PRIMARY 를 고른다. 구분 안 하는 건 쿠팡뿐

"쿠팡·스마트스토어도 이 값(배송가능지역)을 쓰지 않습니다"
   → 쿠팡은 쓴다. 셀러에게 «묻지 않고» 「도서산간 배송 불가」로 고정해 보낸다

"배송비/출고 소요일은 두 플랫폼에 동일하게 적용됩니다"
   → 배송비는 맞다. 출고 소요일은 네이버 payload 에 «없다»
```

두 번째는 등록 결과에 영향을 준다 — 🔴 모든 쿠팡 상품이 셀러가 정한 적 없는
「도서산간 배송 불가」로 등록되고 있다. **이번에 고치지 않았다**(기존 등록 payload
불변 원칙). CPO 판단 대상으로 올린다.
