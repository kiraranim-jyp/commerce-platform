# COUPANG-UPDATE-CAPABILITY-01 — GET 실측

> CPO 작업지시(2026-09-28). **읽기 전용 GET 실측만.** 코드 변경 0.
> 금지: 실제 UPDATE ❌ · CREATE/RECREATE ❌ · payload 변경 ❌ · DB 변경 ❌ ·
> 새 Commerce 기능 ❌.
>
> 🔴 이 문서에는 **연락처·주소를 적지 않습니다.** 응답에 들어 있었고(반품지
> 주소·업체 전화번호), 조사 결론에 필요하지 않습니다.

---

## 0. 결론

```
🟢 UPDATE baseline 은 «확보 가능하다». GET 이 보낸 것을 거의 그대로 돌려준다.
🔴 다만 그 증명은 «임시저장 상품» 에 대해서만 성립한다 —
   우리 쿠팡 상품 4건이 «전부» 임시저장이고, 승인된 상품이 하나도 없다.
```

그리고 세 번 막혀 있던 **P1-2 가 풀렸습니다**(`commerce-6-phase-f5:135`).

---

## 1. 실측 — GET 4건 전부 성공

```
GET /api/debug/coupang-product-get-raw?sellerProductId=…   (읽기 전용 프로브)
  16394846257  SUCCESS · SAVED/임시저장   ← 정상 등록 건
  16336681622  SUCCESS · SAVED/임시저장   ┐
  16338809221  SUCCESS · SAVED/임시저장   ├ 중복 3건
  16340176952  SUCCESS · SAVED/임시저장   ┘
```

| 질문(CPO) | 답 |
|---|---|
| 등록 상품 조회 가능 여부 | 🟢 **가능.** 4/4 `code: SUCCESS` |
| 상품 ID | `sellerProductId` · 옵션별 **`sellerProductItemId`** · `productId`·`vendorItemId` 는 **`null`** |
| 판매 상태 | `status: "SAVED"` · `statusName: "임시저장"` · `requested: false` |

### 🟢 KC-COUPANG-02 §4 의 판독이 확증됐습니다

공식 문서로만 읽었던 「`requested:false` → 임시저장 → 미노출」이
**라이브 응답으로 확인**됩니다. 그리고 공식 수정 문서가 한 줄 더 보탭니다 —
> `vendorItemId` — "The value Null indicates it is '**temporarily saved**' status"

우리 응답의 `vendorItemId: null` 이 정확히 그것입니다.

---

## 2. 🔴 UPDATE baseline — 「보낸 것이 돌아오는가」

공식 수정 API 는 **부분 수정이 아니라 전체 교체**입니다.

```
PUT /v2/providers/seller_api/apis/api/v1/marketplace/seller-products
원문: "edit only the value you wish to modify from the JSON message queried
       and then send the entire JSON message."
```

→ **「조회한 JSON 을 고쳐서 통째로 되보낸다」.** 그러므로 **GET 이 곧 baseline** 이고,
질문은 하나로 좁혀집니다 — *보낸 것이 다 돌아오는가?*

### 실측 대조 (`CoupangPayload` ↔ GET 응답)

| 층 | 우리가 보내는 칸 | 돌아오는 칸 | 🔴 안 돌아오는 것 |
|---|---:|---:|---|
| 상품 | 29 | 56 | **`displayCategoryPath` 하나** |
| `items[]` | 19 | 38 | **없음 (100%)** |

🟢 **상품 28/29 · 옵션 19/19.** baseline 으로 쓸 수 있습니다.

### 🟢 쿠팡이 «덧붙여» 주는 것 (우리가 안 보낸 칸)

```
정체성   sellerProductItemId · productId · itemId · vendorItemId · trackingId
상태     status · statusName · mdId · mdName · roleCode · contributorType
비어 있음 productOrigin · afterServiceContactNumber · afterServiceInformation
         extraInfoMessage · productGroup · barcode · modelNo · offerDescription
기타     categoryId(≠displayCategoryCode) · exchangeType · certifications · …
```

🔴 **전체 교체 방식이라 이 칸들을 «되보내야» 합니다.** 지금 우리 빌더는 이것들을
만들지 않으므로, UPDATE 를 붙일 때는 **「빌더가 만든 payload」가 아니라
「GET 응답을 고친 것」을 보내야 합니다.** 두 방식을 섞으면 쿠팡이 관리하는 칸이
조용히 지워집니다.

---

## 3. 🔴 옵션 수정의 제약 — 공식 문서 원문

| 규칙 | 원문 |
|---|---|
| 기존 옵션 수정 | `sellerProductItemId` **필요** |
| 새 옵션 추가 | `sellerProductItemId` **생략** |
| 옵션 삭제 | 배열에서 빼면 삭제된다 |
| 🔴 **승인 이력이 있는 옵션** | "an option that had a record of having been '**approved**' **cannot be deleted**" |
| 🔴 승인 후 가격 | 「Change price by item」 **별도 API** |
| 🔴 승인 후 재고 | 별도 API |

→ **승인 전후로 규칙이 다릅니다.** 그리고 우리는 **승인된 상품을 한 건도 갖고
있지 않습니다.**

---

## 4. 🔴 그래서 «말할 수 없는» 것

```
말할 수 있다  「임시저장 상품에 대해 GET → 수정 → PUT 의 baseline 이 확보된다」
말할 수 없다  「승인된 상품도 같은 방식으로 수정된다」  ← 실측 대상이 없다
말할 수 없다  「UPDATE 가 실제로 성공한다」           ← PUT 을 하지 않았다(금지)
```

승인 후 경로는 **가격·재고가 별도 API 로 갈라지고, 옵션 삭제가 막힙니다.**
그것을 재려면 승인된 상품이 있어야 하고, 승인은 **판매 개시 결정**이라
CTO 가 할 일이 아닙니다.

---

## 5. 현재 TTAEJYO UPDATE capability — 어디까지 실측됐나

```ts
// edit-adapters/index.ts:28
const EDIT_ADAPTERS = { smartstore: smartStoreEditAdapter };   // 쿠팡 «없음»
```

그 파일의 주석이 이번 작업을 정확히 예고하고 있었습니다 —
> 「지금 여기 없는 것은 «구현 부채가 아니라 **조사 부채**» 다. 조사(GET 응답
>  실측 · UPDATE 지원 확인)가 끝나면 그때 한 줄이 는다.」

| 축 | 전 | 후 |
|---|---|---|
| GET 응답 실측 | 🔴 없음 | 🟢 **완료**(4건) |
| UPDATE 지원 확인 | 🔴 UNKNOWN | 🟡 **공식 스펙 확인 · 임시저장 baseline 확보 · 실행 미검증** |
| 어댑터 추가 | — | 🔴 **아직 아니다** — §4 의 두 UNKNOWN 이 남아 있다 |

🔴 **어댑터를 지금 추가하면 안 됩니다.** 같은 파일이 경고합니다 —
「문서에 API 가 있다」는 것은 capability 근거가 아니다(롯데ON apiNo 90 에서 겪음).

---

## 6. 곁다리로 확증된 것 둘

### 🟢 ① `certifications` — KC-COUPANG-01 결론의 라이브 확증

```
items[*].certifications = []   (5개 옵션 전부)
```
소스 참조 0건이라고 보고했던 것이 **쿠팡 쪽 실제 데이터로도 빈 배열**입니다.

### 🟢 ② KC-COUPANG-04 의 대상이 실제로 Settings 값이었다

쿠팡에 올라간 고시 칸(원문 그대로) —
```
[기타 재화] 품명 및 모델명        「Bubble Sweatshirt in Grey Melange by Main Story」
[기타 재화] 인증/허가 사항        「KC인증 어린이제품 공급자적합성확인」   ← 🔴 Settings 값
[기타 재화] 제조국(원산지)        「Portugal」
[기타 재화] 제조자(수입자)        「main story」
[기타 재화] 소비자상담 전화번호    «이 문서에 적지 않음»
```

🔴 **코드 기본값 `KC마크 없이 구매대행 가능한 품목` 이 아닙니다.** KC-COUPANG-04
에서 고친 provenance 가 **실제 등록 데이터와 일치**함을 라이브로 확인했습니다.

🔴 그리고 다섯 칸 중 하나가 **전화번호**입니다 — 02B 에서 프로브 설계를 값이
아니라 «분류» 로 한 이유가 여기서 다시 확인됩니다.

---

## 7. 다음에 필요한 결정 (CPO)

| # | 항목 | 비고 |
|---|---|---|
| ① | 승인된 상품 확보 여부 | 🔴 **판매 개시 결정** — CTO 사안 아님. 없으면 승인 후 경로는 UNKNOWN 으로 남는다 |
| ② | UPDATE 어댑터 구현 | 🟡 임시저장 범위로 한정하면 지금도 가능. 다만 「수정 가능」이라고 화면에 적는 순간 승인 후까지 포함해 읽힌다 |
| ③ | 전체 교체 방식 수용 | 🔴 GET 응답을 기반으로 PUT 해야 한다 — 빌더 payload 를 그대로 보내면 쿠팡 관리 칸이 지워진다 |

---

## 8. 프로브 토큰

CPO 지시대로 **이 실측이 끝났으므로 폐기합니다** — 별도 커밋에서
`DEBUG_COUPANG_PRODUCT_PROBE_TOKEN` 을 Production 에서 제거하고, 제 사본도
삭제한 뒤 라우트가 닫혔는지(404) 확인합니다.

## 9. 이번에 «하지 않은» 것

PUT/UPDATE ❌ · CREATE/RECREATE ❌ · payload 변경 ❌ · DB 변경 ❌ ·
어댑터 추가 ❌ · 코드 변경 **0** · 승인 요청 ❌ · 연락처·주소 기록 ❌.
