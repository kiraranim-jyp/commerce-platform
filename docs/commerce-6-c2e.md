# Commerce-6 C-2E — 원본 재고 정책 확정 + MI 연결 조사

> CTO(2026-09-26). **migration 0 · MI 알고리즘 신설 0 · push 0.**

---

## 🔴 먼저 — **C-2D 의 수정도 무효였다**

C-2D 에서 「재고 0 이 세 채널에서 조용히 통과한다」를 고쳤다고 보고했다.
그 수정이 **작동하지 않았다.**

```text
내가 쓴 규칙   product.stockQuantity.value > 0
그 값의 실제   canonical-product.ts:243  { value: 999, source: "DEFAULT" }
               → 이 값을 덮어쓰는 경로가 코드에 «없다»(전수 확인)
결과           내가 고친 규칙도 «절대 실패하지 않았다»
```

🔴 같은 함정에 두 번 빠졌고 원인은 같다 — **「값이 있다」를 「사실이다」로 읽었다.**
네이버의 `|| 1` 을 비웃으면서 999 에 똑같이 속았다.

### 원본의 «사실» 은 어디에 있나

크롤러가 실제로 읽는 재고는 **옵션(variant) 레벨에만** 들어온다.

```text
Shopify      inventory_management 가 켜져 있을 때만 inventory_quantity
             (꺼져 있으면 숫자를 믿을 수 없어 «채우지 않는다»)
schema.org   availability === "OutOfStock" → 0 / "InStock" → undefined
PrestaShop   수량이 유한할 때만
상품 레벨    🔴 항상 999/DEFAULT — 아무도 덮어쓰지 않는다
```

---

## ① 정책 구현 (CEO 확정)

해석을 **한 곳**에만 둔다 — `packages/shared/src/source-stock.ts`.
`listing` 이 아니라 `shared` 인 이유: 쿠팡 어댑터(`marketplace`)도 써야 하는데
그쪽은 `listing` 을 import 하지 않는다(넣으면 순환이다). 그리고 이것은 등록의
성질이 아니라 **상품의 사실**이다.

```text
판정 순서   옵션 실측 → 상품 실측 → 모름

IN_STOCK       등록 가능
OUT_OF_STOCK   🔴 BLOCKED  "원본 상품의 재고가 없어 등록할 수 없습니다."
INVALID        BLOCKED     음수·비정상 → 원본 확인 필요
UNKNOWN        🔴 «막지 않는다» — 모른다는 것은 품절이 아니다
```

세 채널 배선:

| | |
|---|---|
스마트스토어 | 빌더가 `payloadStockQuantity()` 를 쓴다 — 품절이면 0 이 그대로 나가고 기존 검증기가 막는다 |
쿠팡 | `stock` 규칙(ERROR) + `stockUnknown` 규칙(WARNING, 막지 않음) |
롯데ON | `itmStkQty` — **BLOCKED**(`SOURCE_STOCK_UNAVAILABLE`). UNKNOWN 은 `재고(원본 미확인)` 라벨로 READY |

🔴 롯데ON 이 MISSING 이 아니라 BLOCKED 인 이유: 이 탭에서 **셀러가 채울 수 있는
값이 아니다.** 원본 상품의 사실이라 숫자를 고쳐 해결할 일이 아니다.

### 🔴 두 가지 함정을 테스트로 막았다

```text
① 수량을 «안 준» 옵션을 0 으로 세지 않는다
     모르는 것을 품절로 만들면 정상 상품의 등록이 막힌다 — 더 나쁘다
② hydrate 폴백 emptyField(0) 은 값이 0 이고 source 가 REQUIRED 다
     그냥 읽으면 «품절» 로 오해된다 → UNKNOWN 으로 본다
③ 채널이 자기 판정을 «다시» 만들지 못한다
     `stockQuantity.value > 0` 이 채널 파일에 다시 나타나면 테스트가 막는다
④ `|| 1` 류 보정이 세 빌더 어디에도 없다
```

---

## ② MI 연결 조사 (코드 변경 0 — CPO 범위 지시)

### 재고 0 이 지금 MI 에 표시되는가 — 🔴 **표시될 수 없다**

```text
DomesticPriceIntelligencePanel 은 product 를 «통째로 받지 않는다».
   근거: 파일 주석 + price-single-surface.test.ts 가 «마운트 지점에서» 검사한다
   이유: 숫자 하나 고칠 때마다 10~20초짜리 재분석이 붙는 것을 막으려고
         상태·핸들러 소유권을 CommerceWorkspace 에 남긴 설계다
```

즉 **원본 재고는 MI 패널이 구조적으로 모른다.**

### MI 가 이미 가진 재고는 «다른 축» 이다

```text
MI-STOCK-CLARITY-1   stockCounts { onSale, unknown, soldOut }
N-4.18-G STEP G-4    soldOutListings — 품절 확인된 «국내 경쟁» 리스팅
```

🔴 이것은 **국내 경쟁 상품의 재고**다. 원본 상품의 재고와 축이 다르다.
같은 카드에 섞으면 셀러가 「내 원본이 품절」과 「국내 경쟁사가 품절」을
혼동한다 — 후자는 오히려 기회 신호다.

### 안내를 놓을 «위치» (구현 안 함)

기존 규칙을 깨지 않는 길은 하나뿐이다.

```text
CommerceWorkspace (product 소유)
        │  resolveSourceStock(product) → SourceStockFact
        ↓  기존 슬롯 패턴과 «같은» 방식(priceCalculationDetail · profitability 가
           이미 그렇게 한다 — 숫자/노드만 내려보낸다)
MarketIntelligence 패널
        └ 🌎 해외 원가 · 국내 시장가 «옆»에 「원본 재고 없음」 한 줄
```

🔴 새 prop **하나**면 된다. 패널이 product 를 받게 만드는 것은 그 설계를
되돌리는 일이고, `price-single-surface.test.ts` 가 그것을 막는다 — 그 가드는
옳으므로 우회하지 않는다.

그리고 문구는 **사실 + 가이드**이지 판단이 아니다(CEO 지시):

```text
원본 재고 없음 — 현재 원본 상품의 재고가 0개입니다. 등록은 차단됩니다.
가격 검토      — 국내 시장가격과 원본 가격을 비교해 보세요.
               판매 여부와 판매가격은 셀러가 판단합니다.
```

---

## 상태

| | |
|---|---|
재고 사실 해석 단일화 | 🟢 `shared/source-stock.ts` |
재고 0 → 등록 차단 | 🟢 3채널 |
UNKNOWN → 막지 않음 | 🟢 (쿠팡 WARNING · 롯데ON 라벨 · 네이버 통과) |
임의 보정 금지 | 🟢 테스트로 고정(`\|\| 1` · `.value > 0` 둘 다) |
MI 원본 재고 표시 | 🔴 **불가** — 패널이 product 를 안 받는다. 위치만 확정 |
MI 판단 알고리즘 | ⬜ 범위 밖(CPO 명시) |
