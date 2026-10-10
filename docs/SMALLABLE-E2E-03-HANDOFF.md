# ③ Smallable 실상품 E2E — 실측 기록 (CTO 1차, 2026-10-11)

## 🔴 LONG-SPRINT-03 재개 블록 (세션이 끊기면 여기부터)

```
CURRENT POSITION       ③ Smallable E2E — 결함 판정 단계
LATEST COMMIT          f5bb9172
PRODUCTION LIVE        4f8a1c5  (코드 변경 fc3e115 = D-OPT 반영됨)

DONE                   P0.1 수집 · P0.3 옵션/재고 · P0.4/P0.5 승격 · P0.6 3채널 payload
                       D-OPT 수정+배포 (fc3e115d)
IN PROGRESS            D-LOT-STOCK 조사 — 🔴 아래 「되돌아본 사실」 때문에 보류
BLOCKED                D-OPT·D-LOT-STOCK 이 «한 개의 정책 질문» 으로 합쳐졌다 → CPO 판정 필요
KNOWN DEFECTS          D-LOT-STOCK(P0) · D-CARE · D-MODEL · COUPANG-NOTICE-SEMANTIC-LOSS-01
NEXT EXACT ACTION      🔴 CPO 판정 먼저: 「원본·셀러 어디서도 재고를 모를 때 등록을
                       막는가?」 — 막는다면 LotteON 도 Naver(D-OPT)와 같게 닫고,
                       허용한다면 D-OPT 를 되돌린다. 둘 중 하나를 고른 «뒤» 에
                       KNOWN_ZERO/SELLER_DEFAULT/UNKNOWN 3종 회귀를 쓴다.

TEST                   d-opt 5 PASS · parity 16 PASS
REGRESSION             495 files / 7438 passed · exit 0
TYPECHECK              listing 5 = baseline · admin 0 · crawler 2
BUILD                  PASS (static 104/104)
DEPLOY                 PASS (4f8a1c5)
SMOKE                  / 200 · /pipeline 307 · /settings 307
CEO ACTION             없음 · 실등록 🔴 STOP
CEO TEST SCENARIO      docs/NOTICE-PARITY-02-HANDOFF.md §8 — 확인 항목 12개
                       🔴 ② 가 PARTIAL CLOSED 돼도 그 12항은 «그대로 유효하다».
                          ②③④ 전부 끝나고 CPO 검토 뒤 «한 번» 전달한다.
                          (TTAEJYO 13 의 산출물이다 — 포인터가 끊겨 있던 것을 복구)
```

### 🔴🔴 되돌아본 사실 (TTAEJYO 13 커밋 확인, 2026-10-11)

`0871a416`(2026-10-09) 커밋 메시지에 **이미 적혀 있었다**:

> payload 는 바뀌지 않았다 — **전부 모르면 옵션 조합이 모두 빠지고 단일 상품으로
> 나가며**, 그때 상품 재고는 기존 경로가 정한다.

즉 내가 D-OPT 라고 부르며 막은 상태는 **앞 세션이 「이렇게 나간다」고 기록해 둔
경로** 다. 내 수정은 순수한 버그픽스가 아니라 **동작 변경** 이다. 중요한 귀결:

```
Smallable 은 재고를 «한 칸도» 주지 않는다(smallable-size-options.ts:90, 앞 세션 실측)
→ D-OPT 수정 뒤에는 Smallable 상품은 셀러가 「기본 재고 수량」을 넣기 «전까지»
  네이버 등록이 막힌다
```

🟢 셀러 입력은 실제로 배선돼 있다(`SourceDataView.tsx:418` — 「이 옵션들은 N개로
등록됩니다」). 그래서 막는 것이 셀러가 풀 수 있는 상태이긴 하다.
🟢 기존 테스트 중 옛 경로를 고정한 것은 «없었다»(회귀 495/7438 green).

🔴 그래도 **CPO 판정 없이 유지할 변경이 아니다.** 그리고 LotteON(D-LOT-STOCK)은
같은 사실에 다르게 반응하므로, 둘은 **하나의 질문** 이다:

```
Q.  원본에도 셀러 기본값에도 재고가 없을 때 — 등록을 막는가?
    (가) 막는다   → Naver 는 이미 그렇게 됐다(D-OPT). LotteON 도 같게 닫는다.
                    대가: Smallable 류는 셀러가 기본 재고를 넣어야 등록된다.
    (나) 허용한다 → D-OPT 를 되돌린다. 대가: 6사이즈가 단품으로, LotteON 은 품절로 등록된다.
🔴 지금은 Naver 만 (가), LotteON 은 (나) 로 «어긋난 상태» 다. 그게 제일 나쁘다.
```

---

> 🔴 **실제 상품 1건으로 운영 경로를 관통한 기록이다.** 손으로 만든 fixture 가
> 아니다. 재조사하지 말고 이 숫자를 쓴다.

```
상품   https://www.smallable.com/en/product/
       all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632
경로   universalExtract → buildCanonicalProduct(api/pipeline/canonical-product.ts)
       → adapter.toListingModel → 세 builder
```

🔴 **실등록은 하지 않았다** (STOP 유지).

---

## P0.1 — 실제 수집값 (운영 `universalExtract`)

```
title           "All About Monsters Washed T-shirt Organic cotton | Blue"   json-ld
brand           "Bobo Choses"                                              json-ld
price           45 EUR · priceValidity VALID                               json-ld
sku             "AAA1804532"                                               json-ld
description     "… 100% Organic Cotton … Wash Cold-30°  Made in Spain "     json-ld
optionGroups    사이즈 × 6 (2/3·4/5·6/7·8/9·10/11·12/13 years)              dom
variants        6건 — 🔴 stockQuantity «전부 없음»
images          4장 (staticv3.smallable.com)
breadcrumb      Home > Fashion Children > Boy > Blouses, T-shirts
strategyCounts  json-ld 1 · open-graph 1 · dom-scan 9
```

🔴 **구조화 필드로 «없는» 것**: material · color · countryOfOrigin ·
careInstructions 는 독립 필드가 아니라 **description 텍스트 안에만** 있다.
manufacturer · importer · itemName · modelName · weight · certificationType ·
recommendedAge 는 **아예 없다.**

---

## P0.4/P0.5 — 운영 변환 뒤 (`buildCanonicalProduct`)

| 필드 | 값 | source | 판정 |
|---|---|---|---|
| material | `100% Organic Cotton` | ORIGINAL | 🟢 description 에서 승격 |
| color | `Blue` (0.7) | ORIGINAL | 🟢 title 에서 승격 |
| countryOfOrigin | `Spain` (0.75) | ORIGINAL | 🟡 `Made in Spain` → 정규화 |
| careInstructions | `케어라벨 참조` | **DEFAULT** | 🔴 원문에 `Wash Cold-30°` 가 «있다» |
| modelName | title 전체 (0.8) | ORIGINAL | 🟡 상품명을 모델명으로 쓴다(sku 는 `AAA1804532`) |
| stockQuantity | **999** | DEFAULT | 사다리 마지막 칸(§아래) |
| manufacturer · importer · recommendedAge · itemName · weight · certificationType | `""` | REQUIRED | 🟢 지어내지 않는다 |

### 🟡 남은 결함 후보 2건 (이번 배치에서 고치지 않았다)

```
D-CARE  careInstructions  원문 "Wash Cold-30°" 를 extractCareInstructions() 가
        못 잡아 source=DEFAULT 의 "케어라벨 참조" 로 덮인다.
        🔴 값이 있는데 기본값이 들어가는 것이라 「값 손실」이다.
        (쿠팡 치수 placeholder 와 같은 류 → COUPANG-NOTICE-SEMANTIC-LOSS-01 참조)

D-MODEL modelName 에 상품명 전체가 들어간다. LotteON resolver 는 「상품코드(SKU)를
        모델명으로 대신 쓰지 않습니다」라는 가드를 갖고 있는데, title 은 그 가드를
        통과한다. CEO 테스트 5번(「모델명 AI 생성 없음」)과 같은 축이다.
        🔴 AI 생성은 «아니다» — 그래서 위반인지 판단이 필요하다(CPO).
```

---

## P0.3 — 옵션/재고 · 🔴 **D-OPT (고쳤다 · `fc3e115d`)**

```
optionGroups   사이즈 6개
variants       6건 전부 stockQuantity 없음 → 「재고 모름」
```

🟢 **옵션별 재고에 999/0 을 만들지 않는다** — `variantStockWithSellerDefault` 가
`null` 이면 그 조합을 **빼낸다**(P5.6). 0 으로 메우면 팔 수 있는 옵션이 품절로
등록되기 때문이다. 판매자 기본값이 999 여도 거부한다.

🔴 **그래서 조합이 0건이 됐고, 그 상태가 통과했다**:

```
hasRealProductOptions        true    ← variants 6건이라 기존 가드를 통과
optionGroupName1             "사이즈"  ← 그룹은 선언됨
optionCombinations           []
originProduct.stockQuantity  999     ← READY
blockedCount                 0       ← 빈 조합을 지적하는 필드가 하나도 없었다
```

→ **6사이즈 상품이 「단품 999」처럼 등록 시도된다.** `hasRealProductOptions` 의
주석이 금지한 그 「깨진 payload」다. 원인은 그 가드가 `variants.length === 0` «만»
보고, P5.6 의 필터 경로는 가드보다 **뒤** 에 있다는 것
([[guard-predates-the-new-path]]).

**고친 것** — 🔴 재고를 숫자로 메우지 않고 막는다:

```
validate-payload.ts   조합 0건 → MISSING + 「기본 재고 수량」 안내
readiness.ts          라벨 「옵션별 재고」 · sectionId "section-options"
readiness.test.ts     representativeFields 에 추가(그 목록의 주석이 요구한 갱신)
테스트                d-opt-empty-option-combinations.test.ts 5건
                      (재현 · 차단 · 셀러 기본값으로 복구 · 999 는 복구 못 함 ·
                       옵션 없는 단품은 안 막힌다 ← 대조군 둘)
음성 대조             가드 제거 2 FAIL · sectionId 제거 1 FAIL · 복구 PASS
```

### 상품 레벨 999 는 결함이 «아니다»

`payloadStockQuantity` = 실측 → 판매자 기본값 → `PIPELINE_DEFAULT_STOCK`
(`source-stock.ts:184`). 채널 API 가 숫자를 요구하므로 마지막 칸이 남아 있고,
화면은 `state === "UNKNOWN"` 일 때 「원본 재고 미확인」으로 표시한다.
🔴 **옵션별** 999 는 P5.6 에서 닫혔다 — 그 둘을 섞어 보고하지 않는다.

---

## P0.6 — 3채널 payload (실제 builder)

```
Naver     고시·옵션·재고 조립됨 · 🔴 D-OPT 상태였다(위)
Coupang   items 6건(사이즈별) · itemName "Bobo Choses … 남아 티셔츠 - 2/3 years"
          originalPrice/salePrice 112,290 · maximumBuyCount 999(구매제한, 재고 아님)
          🔴 notices [] — categoryMeta 가 «없어서» 다(자격증명 필요). ②에서 고정한 사실.
LotteON   🟢 측정했다(품목 23). 고시 5건 채워짐:
            0780 크기,중량  "2/3 years, 4/5 years, … 12/13 years"  ← 사이즈 6개 전부
            0020 색상       "Blue"
            0410 재질       "100% Organic Cotton"
            0060 제조국     "Spain"
            0800 취급방법   "케어라벨 참조"   ← 🔴 D-CARE 가 «규제 신고 값» 까지 전파된다
          NEEDS_INPUT 8건: 품명/모델명 · KC · 사용연령 · 크기체중한계 · 출시년월 ·
            제조자/수입자 · 품질보증 · A/S  (뒤 둘은 판매자 설정을 안 넘긴 내 입력 공백)
          옵션 6건 · optSrtLst 정상 · slPrc 112,290
          🔴 stkQty = 0 (6건 전부) → D-LOT-STOCK (아래)
```

🔴 **로컬에서 못 받는 축**(지어내지 않는다): 쿠팡 categoryMeta · resolvedBrand ·
출고지 · 카테고리 Resolver. 전부 Production 자격증명이 필요하다.

---

### 🔴🔴 D-LOT-STOCK — LotteON 은 재고 모름을 「품절」로 싣고, 검증기가 막지 않는다

```
build-payload.ts:265   const defaultStock = measuredStock ?? 0
build-payload.ts:315   stkQty: variantStockWithSellerDefault(...) ?? defaultStock
                       → 실측도 셀러 기본값도 없으면 «0» 이 나간다
validate-payload.ts:415  stockFact.state === "UNKNOWN"
                       → ready("itmStkQty", "재고(원본 미확인)")   ← 🔴 READY 다
```

🔴 `:263` 의 주석은 「품절로 두고 셀러가 채우는 쪽이 안전하다(**검증기가 그 사실을
셀러에게 말한다**)」고 적혀 있다. **그 전제가 반만 사실이다** — 라벨로는 「원본
미확인」이라고 말하지만 **등록을 막지 않는다.** C-2D 이력이 「재고 0 인 상품이
「등록 가능」으로」 되는 것을 막으려 했는데 **UNKNOWN 분기가 그 구멍으로 남았다.**

같은 사실(재고 모름)에 세 채널이 서로 다르게 반응한다:

```
Naver     옵션을 빼낸다 → (D-OPT 수정으로) 이제 MISSING 으로 막힌다
Coupang   maximumBuyCount 999 는 «구매제한» 이고 재고 축은 별도
LotteON   stkQty 0 을 싣는다 → READY → 6사이즈 전부 「품절」로 등록된다
```

🔴 **고치지 않았다 — CPO 판정 대기.** 세 번째 채널의 등록 가부를 바꾸는 것이고,
`ready("재고(원본 미확인)")` 가 의도적 선택일 수 있다(막으면 과차단 위험).
쿠팡 2건(`COUPANG-NOTICE-SEMANTIC-LOSS-01`)과 **같은 기준** 으로 올린다.

---

## P0.2 — Identity (MI)

🔴 **이 배치에서 실행하지 않았다.** MI 판정은 비교 후보 수집이 선행이고 그
경로는 외부 검색을 탄다. **UNKNOWN 으로 남긴다** — 「검색 결과를 truth 로 쓰지
않는다」는 기준을 지키려면 후보 확보부터 따로 해야 한다.

---

## 남은 것 (다음 세션)

```
① D-CARE · D-MODEL 판정 (CPO)              — 위 §P0.4/P0.5
② P0.2 MI 판정 실행                         — 후보 수집 경로부터
③ 🔴🔴 D-LOT-STOCK 판정 (CPO) — 위 §P0.6, 세 채널 재고 정책이 어긋난다
④ ④ 3-Commerce 최종 E2E                     — 실등록은 STOP 유지
⑤ Seller 요청 5개 실제 상품 기준 검증        — 미착수
⑥ COUPANG-NOTICE-SEMANTIC-LOSS-01           — 별도 backlog(②에서 분리)
```

## 재현

```bash
cd apps/admin && npx vitest run \
  ../../packages/listing/src/naver/__tests__/d-opt-empty-option-combinations.test.ts
```

🔴 수집 하니스는 임시 파일이라 **리포에 남기지 않았다**(실행 → 확인 → 삭제).
운영 수집을 로컬에서 다시 재려면 `tsx` 가 아니라 **vitest** 로 돈다
([[local-toolchain-silent-noops]] ④⑤).
