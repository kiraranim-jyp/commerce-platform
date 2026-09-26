# Commerce Core — 「상품 전체 수정」과 「아이템 단위 수정」 두 축

> CPO 지시(2026-09-26) ①~⑦. **설계 검토 문서이며 구현이 아니다.** 실측이 필요한
> 지점은 `UNKNOWN` 으로 명시하고 구현하지 않는다.
>
> 🔴 결론을 먼저: **Coupang·LotteON 은 구조가 «같은 모양» 이다.** 그리고 그 모양은
> SmartStore 와 «다르다». 그래서 SmartStore 어댑터를 복사하면 두 채널 모두 틀린다.

## 1. 세 채널의 수정 축 (코드 + 공식문서)

| | SmartStore | Coupang | LotteON |
|---|---|---|---|
| 상품 전체 수정 | `PUT /v2/products/origin-products/{no}` | `PUT .../seller-products` | apiNo **90** 승인상품수정 |
| 전체 교체인가 | 🔴 예(공식: 미포함 정보는 제거) | 🔴 예(공식: GET JSON 전문 되보내기) | ❓ 미확인 |
| 아이템 단위 가격 | 없음(전체에 포함) | `PUT .../vendor-items/{vendorItemId}/prices/{price}` | apiNo **91** |
| 아이템 단위 재고 | 없음(전체에 포함) | `PUT .../vendor-items/{vendorItemId}/quantities/{q}` | apiNo **86** |
| 아이템 ID | 없음 | `vendorItemId` | 단품번호(`sitmNo`) |
| 등록 응답이 아이템 ID 를 주는가 | — | 🔴 **아니다**(`data`=sellerProductId 뿐) | 🔴 **아니다**(`epdNo`/`spdNo` 뿐) |
| 옵션명·옵션값 수정 | 가능(전체 교체) | 조건부(승인완료 옵션 삭제 불가) | 🔴 **불가**(공식 FAQ) |
| 카테고리 | RECREATE_ONLY | NOT_SUPPORTED(공식 명시) | 표준+전시 **2중** |

### 🔴 여기서 드러난 공통 패턴

```
SmartStore :  전체 payload 하나 → 한 번의 PUT
Coupang    :  전체 수정  +  아이템별 가격/재고   (축이 둘)
LotteON    :  전체 수정  +  아이템별 가격/재고   (축이 둘)
```

두 채널이 «둘 다» 두 축이고, 그 아이템 ID 를 **등록 시점에 알 수 없다**. 즉 두
채널 모두 「가격만 고치기」조차 **조회를 먼저 해야** 가능하다. SmartStore 에는 없는
제약이다.

## 2. ②·③ `vendorItemId` / 단품번호를 어디서 얻고, 저장할 것인가

### 확보 가능성 — 등록 시점에는 «불가능»

* Coupang 등록 응답: `{ code, message, data, details, errorItems }` 에서 `data` 가
  sellerProductId(숫자) **하나**. 코드 전체에 `vendorItemId` 라는 이름이 **없다**.
* LotteON 등록(87) 응답: `epdNo` / `spdNo` 뿐. 코드 주석이 그대로 적어 뒀다 —
  「단품(옵션) 번호가 포함되지 않습니다 … 단품번호가 필요하면 상품 목록 조회(93)의
  `sitmNoLst` 로 별도 조회해야 합니다.」

→ **아이템 ID 는 조회(GET)로만 얻는다.**

### 🔴 저장하지 «않는다» — 그리고 그것이 설계 결정이다

`ChannelProduct` 에 `sellerProductId → vendorItemId[]` 를 넣을 수 있는가? 넣을 수는
있다(자식 표 하나). **그러나 넣지 않는다:**

1. **채널 상태를 우리 DB 에 캐시해 기준값으로 쓰지 않는다.** 이 스프린트가 F-14-3
   에서 세운 불변조건이 그것이다 — 셀러가 커머스 관리자에서 옵션을 고치면 우리가
   저장한 목록은 그 순간 «현재값이 아니다». 그 목록으로 가격을 보내면 없는 옵션에
   보내거나 남의 옵션에 보낸다.
2. **옵션은 늘고 줄어든다.** 쿠팡은 승인완료 옵션 삭제 불가·추가 가능, LotteON 은
   옵션 추가 가능(최대 500)·옵션명 수정 불가. 저장한 목록은 그 변화를 따라갈 수단이
   없다.
3. **필요한 시점에 이미 GET 을 한다.** 「등록된 내용 불러오기」가 바로 그 GET 이고,
   아이템 ID 는 그 응답에 «함께» 온다. 저장은 중복이고, 중복은 갈라진다.

🔴 즉 `ChannelProduct` 는 지금 모양(불변 축 하나)을 **유지한다**. 스키마 변경 없음.

## 3. ④ Core 가 두 축을 수용할 수 있는가

### 수용한다 — Core 를 고치지 않고

Core 의 계약은 「**무엇이 바뀌었는가**」까지다(`ChangeSet` · `EditGate`).
「**어떻게 보내는가**」는 채널의 일이다. 두 축은 전부 «어떻게» 쪽에 있다:

```
        Core                              Adapter
────────────────────────────  │  ────────────────────────────────
ChannelFieldValues            │  전체 수정 payload 조립
ChannelEditModel              │  아이템별 PUT 대상 고르기
ChangeSet(무엇이 바뀌었는가)    │  두 축으로 «나누기»
EditGate(보낼 수 있는가)        │  순서·실패 처리
```

예: 셀러가 쿠팡에서 「가격 + 상품명」을 고쳤다면 —
Core 는 `ChangeSet = [salePrice, name]` 을 낸다(오늘 이미 그렇게 한다).
어댑터가 그것을 「상품명 → 전체 수정 PUT」과 「가격 → vendorItemId 별 PUT」으로
나눈다. **Core 는 그 분리를 알 필요가 없다.**

### 🔴 그래서 지금 Core 에 «추가하지 않는» 것

`planUpdate()` / `update()` / `recreate()` 를 인터페이스에 지금 적지 않는다. 적으면
아무도 구현하지 않는 빈 계약이 되고, 그것은 「문서에 있다 = 된다」와 같은 종류의
거짓이다. **구현이 가능해지는 시점에 그 구현과 «함께» 올린다.**

## 4. ⑤ 중립 계약에서 «발견된 한계» 하나

🔴 `ChannelFieldValues.categoryId` 는 **문자열 하나**다. 그런데 LotteON 카테고리는
**표준(`scatNo`) + 전시(`dcatLst[]`) 2중 구조**다 — 네이버/쿠팡의 단일 leaf 와 다르다.

* 지금은 문제가 되지 «않는다». 카테고리는 세 채널 모두 수정 대상이 아니고
  (RECREATE_ONLY / NOT_SUPPORTED), 화면에서 «보여주기» 만 한다. 어댑터가 둘 중
  하나를 골라(또는 합쳐) 문자열로 주면 표시는 정확하다.
* 🔴 그러나 **카테고리 수정이 언젠가 열리면 이 칸으로는 표현할 수 없다.** 그때
  Core 를 고쳐야 하고, 그 순간이 오면 «왜 필요한지» 를 먼저 판단한다(CPO 지시 §6-9).
  지금 미리 늘리지 않는다 — 쓰지 않는 구조를 먼저 만들면 그것도 부채다.

## 5. ⑥ LotteON 조사 결과 (코드 + 공식문서)

### 읽기 경로는 «이미 있다» — 다만 쓰이지 않는다

`LOTTEON_READ_PATHS` 에 `productDetail: /v1/openapi/product/v1/product/detail`
(apiNo 94)가 **선언돼 있고 호출부가 하나도 없다**. 즉 LotteON 은 SmartStore·Coupang
과 달리 「상세 조회」 경로를 이미 상수로 갖고 있다 — 응답 모양은 미확인.

### 수정 축(문서)

| apiNo | 기능 | R/W |
|---|---|---|
| 90 | 승인 상품 수정 | W |
| 91 | 가격 변경(아이템) | W |
| 86 | 재고 변경(아이템) | W |
| 92 / 111 | 판매상태 변경(상품 / 단품) | W |
| 93 / 94 | 상품 목록 / 상세 조회 | R |

🔴 그리고 코드에는 **쓰기가 87(등록) 하나뿐**이고, `client.ts` 에 「이 목록에 쓰기
API 를 추가하지 마라」 가드가 있다. 90·91·86 은 **전부 미구현**이다.

### 🔴 공식 FAQ 가 명시한 «수정 불가» 축

> 한번 등록한 옵션값/옵션명은 수정이 불가능하고 상태(가격/재고/판매상태)만 수정
> 가능. 옵션 추가는 가능, 최대 500개.

이것은 **확인된 제약**이다(추측이 아니다). 그래서 LotteON 의 옵션 축은 앞으로
`RECREATE_ONLY` 로 갈 후보이고, 가격·재고는 `EDITABLE` 후보다 — **둘 다 실측 뒤에.**

## 6. ⑦ 지금 `UNKNOWN` 으로 «남기는» 것

```
Coupang
  GET 응답의 실제 모양                    UNKNOWN  (토큰 값 접근 불가)
  승인 대기 중 상품의 수정 가능성           UNKNOWN  (문서 인용 없음)
  수정 후 sellerProductId 유지 여부        UNKNOWN  (문서 인용 없음)
  → capability.update                    UNKNOWN  (유지)

LotteON
  apiNo 94 응답의 실제 모양                UNKNOWN
  apiNo 90 의 대상 상태·수정 가능 필드      UNKNOWN  (조사 §5-2 가 인용된 바 없다고 적음)
  90 의 되돌림 수단                        UNKNOWN
  전체 교체 여부                           UNKNOWN
  → capability.update                    UNKNOWN  (유지)
```

🔴 **두 채널 모두 어댑터를 만들지 않는다.** 등록표(`edit-adapters/index.ts`)에
smartstore 하나뿐인 상태가 유지되고, 테스트가 그것을 고정한다.

## 7. 실측이 열리면 할 일 — 순서까지 정해 둔다

```
① probe 실행(토큰 필요)         → GET 응답 모양 확보
② 중립 통화 매핑 경로 확정        → adapter.readRegistered 작성
③ client 의 메서드 제한 넓히기    → Coupang: GET|POST → +PUT / LotteON: 쓰기 경로 추가
④ 두 축 분리 구현               → adapter 안에서. Core 무변경
⑤ capability 확정               → 필드별로. 근거 없는 칸은 UNKNOWN 유지
⑥ 어댑터 등록                   → edit-adapters 한 줄
⑦ 공통 계약 테스트              → MockCommerce 와 «같은» 검사를 실제 채널로
⑧ Production 1회               → 커머스당 핵심 시나리오 하나
```

🔴 ③이 «가장 위험한 칸» 이다. `client.ts` 의 메서드 제한은 실수로 쓰기를 보내는 것을
막아 온 장치다. 넓힐 때는 「어느 경로에 어떤 메서드를 허용하는가」를 경로 목록으로
좁혀서 넓힌다 — `method: string` 으로 여는 것이 아니다.

## 출처

- 코드: `coupang/_lib/client.ts` · `coupang/register/route.ts` ·
  `coupang/_lib/registered-product.ts` · `lotteon/_lib/client.ts` ·
  `lotteon/register/route.ts`
- [Coupang Product APIs](https://developers.coupang.com/hc/en-us/sections/360005046534-Product-APIs)
- [Coupang 각 ID 의 의미](https://developers.coupang.com/hc/en-us/articles/360023110773-I-don-t-understand-what-each-ID-means)
- `docs/lotteon-commerce-sprint-2-survey.md` §5-2 · §7-2
- `docs/p0-channel-03-step6-coupang-update-survey.md`
