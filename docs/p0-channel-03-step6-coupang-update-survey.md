# P0-CHANNEL-03 STEP 6 — Coupang 등록상품 수정 조사

> CPO 지시(2026-09-26) STEP 6-1·6-2·6-6. **조사 결과 문서이며, capability 를 올린
> 것이 아니다.** 코드·저장소·공식 문서에서 확인한 것을 있는 그대로 적는다.
>
> 🔴 **「문서에 있다」는 capability 근거가 아니다.** 이 문서의 결론은
> `update: UNKNOWN` 을 «유지» 하는 것이고, 바뀐 것은 그 «이유» 다 —
> 「근거 없음」에서 「문서 근거 확보 · 실측 대기」로.

## 1. 코드 전수 조사 (STEP 6-1)

### 쿠팡에 나가는 호출 전부

| 방향 | 메서드 | 경로 | 쓰는 곳 |
|---|---|---|---|
| 쓰기 | POST | `.../marketplace/seller-products` | 등록(register route) |
| 읽기 | GET | `.../marketplace/seller-products/{id}` | `registered-product.ts` · `product-status` |
| 읽기 | GET | `.../marketplace/meta/display-categories` 등 | 카테고리·브랜드·배송지 |

🔴 **수정 호출이 한 줄도 없다.** 그리고 우연이 아니다 —
`coupang/_lib/client.ts` 가 메서드를 **타입 수준에서** 제한한다:

```ts
{ method: "GET" | "POST"; path: string; query?: string; body?: unknown }
```

즉 지금 코드로는 `PUT` 을 **보낼 수 없다**. 쿠팡 수정을 붙이려면 이 경계를
먼저 넓혀야 하고, 그것은 조사 결과가 나온 뒤의 일이다.

### 읽는 것은 한 칸뿐

`fetchRegisteredCoupangCategory()` 가 GET 응답에서 읽는 것은
`data.displayCategoryCode` **하나**다. 그 파일이 스스로 적어 두었듯이:

> 🔴 응답 모양을 «실측한 적이 없다». 등록 요청 payload 와 같은 이름일 것이라는
> 대칭 가정 위에 있다.

그 가정이 틀리면 쿠팡 판단은 **항상** `UNKNOWN → BLOCKED` 로 가고, 셀러는 쿠팡
상품을 영영 고칠 수 없다. **지금이 그 상태인지 아닌지 아무도 모른다.**

## 2. 등록 ID 의 의미 (STEP 6-1 · 확정)

공식 문서가 네 축을 구분한다:

| ID | 뜻 | 바뀌는가 |
|---|---|:---:|
| `sellerProductId` | **등록상품 전체**. 「완성된 상품」 하나 | 🔴 **불변** |
| `productId` | «노출» 상품 ID. 묶음/해제로 **언제든 바뀐다** | ⚠️ **변함** |
| `vendorItemId` | 옵션 단위. 쿠팡에서 팔리는 최소 식별자 | 🔴 불변 |
| `sellerProductItemId` | 옵션 «값» 을 수정할 때 필요 | — |

### 우리 코드가 쓰는 것

등록 응답은 평평하고 `data` 가 새로 생성된 `sellerProductId`(숫자)다(실등록으로
확인된 주석). register 라우트가 `String(parsed.data)` 로
`ChannelProduct.external_product_id` 에 넣는다.

```
쿠팡 external_product_id = sellerProductId   ✅ 옳다(불변 축)
```

🔴 **`productId` 를 키로 쓰면 안 된다** — 「묶음/해제로 언제든 바뀐다」. 바뀌는
것을 키로 쓴 것이 SmartStore 외부번호 6개를 만든 사고와 «같은 부류» 다.

🔴 그리고 **가격·재고 수정은 `sellerProductId` 가 아니라 `vendorItemId` 로 한다**
(아래 3번). 우리는 그 값을 **저장하고 있지 않다** — GET 응답의 옵션별로 읽어야 한다.

## 3. 수정 API — 공식 문서가 말하는 것 (STEP 6-6)

| 메서드 | 경로 | 용도 |
|---|---|---|
| PUT | `.../marketplace/seller-products` | **상품 수정(승인필요)** |
| PUT | `.../marketplace/seller-products/{sellerProductId}/partial` | 상품 수정(승인불필요) |
| PUT | `.../marketplace/vendor-items/{vendorItemId}/prices/{price}` | 아이템별 **가격** |
| PUT | `.../marketplace/vendor-items/{vendorItemId}/quantities/{quantity}` | 아이템별 **수량** |
| PUT | `.../marketplace/vendor-items/{vendorItemId}/original-prices/{originalPrice}` | 할인 기준가 |
| GET | `.../marketplace/seller-products/{sellerProductId}/partial` | 조회(승인불필요) |
| DELETE | `.../marketplace/seller-products/{sellerProductId}` | 삭제 |

### 🔴 전체 수정은 「전체 JSON 전문 전송」이다

공식 안내가 그대로 말한다:

> 상품 조회 API 를 이용하여 조회된 JSON 전문에서 **원하는 값만 수정 후, 전체
> JSON 전문을 전송**하여 수정이 가능합니다.

그리고 body 에 `sellerProductId` 와 `sellerProductItemId` 를 넣는다.

**이것이 우리가 F-14-7 에서 세운 규칙과 «같은 모양» 이다:**

```
전체 payload = 지금 등록된 값(GET) + 셀러가 실제로 고친 값
```

🔴 SmartStore 에서는 그 규칙을 우리가 «사고를 겪고» 만들었는데, 쿠팡에서는 그것이
**공식이 지시하는 방법**이다. 즉 Commerce Core 의 F-14-7 정책은 쿠팡에 더 잘 맞는다.

### 옵션 수정 규칙 (문서)

* **수정** — 그 옵션 항목 위에 `sellerProductItemId` + `vendorItemId` 를 넣고 보낸다
* **삭제** — `items` 배열에서 그 항목을 빼고, 남길 항목에 `sellerProductItemId` 를 넣는다
  🔴 **이미 승인완료된 옵션은 삭제 불가**
* **추가** — `sellerProductItemId` 없이 `items` 에 추가

### 승인불필요 부분 수정의 범위

`sellerProductId` 외 전부 비필수라 「원하는 항목만」 보낼 수 있다. 🔴 다만 그
항목들이 **배송·반품 축**이다(`deliveryMethod` · `returnCenterCode` ·
`returnAddress` · `outboundShippingPlaceCode` 등). **상품명·가격·재고·상세설명은
그 목록에 없다** — 그쪽은 전체 수정(승인필요)이나 아이템별 PUT 으로 간다.

## 4. 그래서 지금 확정된 것과 확정되지 않은 것

| 질문 | 답 | 근거 |
|---|---|---|
| UPDATE 엔드포인트가 있는가 | **있다(문서)** | 공식 Product APIs |
| 어떤 ID 로 하는가 | 전체=`sellerProductId`+`sellerProductItemId` · 가격/재고=`vendorItemId` | 공식 |
| 전체 교체인가 | **그렇다** — GET JSON 전문을 되보낸다 | 공식 안내 문구 |
| 누락하면 지워지는가 | 옵션은 «빼면 삭제» 로 명시 | 공식 |
| 카테고리 변경 | 🔴 **수정 불가**(기존 확정, 변경 없음) | 공식 가이드 |
| GET 응답의 실제 모양 | ❌ **모른다** | 실측 없음 |
| 우리 코드가 PUT 을 보낼 수 있는가 | ❌ **못 한다** | `client.ts` 타입 제한 |
| 승인 대기 중 상품도 수정되는가 | ❌ 모른다 | 문서 인용 없음 |
| 수정 후 `sellerProductId` 가 유지되는가 | ❌ 모른다 | 문서 인용 없음 |

## 5. 결론 — capability 는 그대로 UNKNOWN

```
coupang.update          UNKNOWN          ← 유지
coupang.categoryUpdate  NOT_SUPPORTED    ← 유지(공식 명시)
Coupang 수정 어댑터      없음              ← 유지
```

🔴 **문서 근거가 늘었다고 capability 를 올리지 않는다.** LotteON `apiNo 90` 에서
이미 겪은 혼동이 그것이다 — 「문서에 있다」와 「우리 상품에서 된다」는 다르다.

### 어댑터를 만들 조건(STEP 6-8) 중 남은 것

```
[x] 등록 ID 의미 확정            sellerProductId (불변 축)
[x] Update API 존재·모양(문서)    전체 JSON 전문 · vendorItemId 별 부분 PUT
[x] 변경하지 않은 값 보존 방법     GET JSON 되보내기 = F-14-7 규칙과 동일
[ ] 🔴 실제 GET 확인              probe 가 준비됐고 토큰 값이 없어 못 돌린다
[ ] 🔴 GET → ChannelFieldValues   실제 응답을 봐야 경로를 적을 수 있다
[ ] 🔴 client.ts 에 PUT 허용      조사 확정 뒤에 넓힌다
[ ] 🔴 승인 상태·ID 유지 확인      문서 인용 없음 → 실측 필요
[ ] Capability 확정
```

## 6. 같이 발견한 것 — 등록 축의 위험

공식 공지: **「필수 구매옵션 입력 의무화 및 API 변경 안내 (2026년 2월 2일 시행)」**.
오늘(2026-09-26)은 그 시행일 «이후» 다. 🔴 이것은 수정이 아니라 **등록** 경로에
영향을 줄 수 있고, 우리 쿠팡 등록 payload 가 그 변경을 반영했는지는 이 조사의
범위가 아니다 — 별도로 확인해야 한다.

## 출처

- [Product APIs (섹션 목록)](https://developers.coupang.com/hc/en-us/sections/360005046534-Product-APIs)
- [상품 수정 (승인필요)](https://developers.coupang.com/ko/api/products/modify-product)
- [Product Modification (Approval not required)](https://developers.coupangcorp.com/hc/en-us/articles/360042169352-Product-Modification-Approval-not-required)
- [각 ID 의 의미](https://developers.coupang.com/hc/en-us/articles/360023110773-I-don-t-understand-what-each-ID-means)
- [필수 구매옵션 의무화 공지(2026-02-02 시행)](https://developers.coupangcorp.com/hc/ko/articles/54700630775577)
