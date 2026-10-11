# ③ Smallable 실상품 E2E — 실측 기록 (CTO 1차, 2026-10-11)

## 🔴 LONG-SPRINT-03 재개 블록 (세션이 끊기면 여기부터)

```
CURRENT POSITION       🟢 COMMERCE CLOSE — 다음은 MI-P0 Replay harness
LATEST COMMIT          f74e4e14 (문서) · 마지막 «제품 코드» 커밋 001807b0
PRODUCTION LIVE        da4bc32 — 🔴 001807b0 «이후» 다. 즉 코드 변경 3건
                       (D-OPT fc3e115 · D-LOT-STOCK ccb0145f · D-CARE 001807b0)이
                       전부 반영돼 있다. 001807b0..HEAD 는 문서 1개만 변경.
SMOKE                  / 200 · /login 200 · /terms 200 · /pipeline 307 · /settings 307
                       🔴 307 은 인증 리다이렉트이고 route 증거가 아니다

DONE                   ① 재고 정책 CLOSE (ccb0145f) — 실상품 양방향 증명
                       ② 고시 공통 수집 + D-CARE CLOSE (001807b0)
                       ③ D-MODEL 조사 완료 — 결함 아님 (b155e885)
                       ④ 대표 실상품 3개 × 3채널 E2E (f74e4e14)
                       ⑤ 회귀 497/7461 · typecheck baseline · build PASS · deploy+smoke
                       🟢 **COMMERCE CLOSE**
IN PROGRESS            —
BLOCKED                실등록 🔴 STOP (CPO GO 전까지) — 그 외 없음
KNOWN DEFECTS          COUPANG-NOTICE-SEMANTIC-LOSS-01 (별도 backlog)
                       D-MODEL Q1/Q2 (CPO: MI 를 막지 않는다)
                       care 패턴 다른 어순(실측 근거 생기면)

NEXT EXACT ACTION      🔴 Replay 재측정 1회 — 아래 §MI-P0 Replay 의 «무효 KPI 3건»
                       (modelCode·color·material)을 `candidate.facts` «안» 에서
                       다시 센다. 최상위만 읽어 거짓 0 을 냈다. image·price 도
                       같은 자리에서 null 여부를 확인한다.
                       그 뒤 Identity(SAME/SIMILAR) 판정을 붙이고 KPI 14개를 완성한다.

TEST                   d-care 12 · d-lot-stock 10 · d-opt 5 · parity 16 — 전부 PASS
REGRESSION             497 files / 7461 passed · exit 0
TYPECHECK              listing 5 = baseline · admin 0 · crawler 2
BUILD                  PASS (static 104/104)
DEPLOY                 🟢 PASS (da4bc32 — 코드 변경 전부 반영)
CEO ACTION             없음 · 실등록 🔴 STOP
CEO TEST SCENARIO      docs/NOTICE-PARITY-02-HANDOFF.md §8 — 확인 항목 12개
                       🔴 스프린트가 넘어가도 유효하다. 포인터를 옮길 때 같이 끌고 간다.

## 🔴 MI-P0 Identity 데이터 품질 (CPO 승격, 2026-10-11)

P0-Identity-01  B-CODE   Bobo 공식몰 URL 에 품번 `b226ac043` 이 있는데 어느 칸에도
                         수집되지 않는다. 실제 품번은 가장 강한 Identity evidence 다.
                         🔴 URL 문자열에서 «무조건 추출하지 않는다» — 그 slug 가
                            manufacturer/article reference 인지 사이트 내부 slug 인지
                            source semantics 를 먼저 확인하고, 확인된 경우에만
                            강한 identifier 로 승격한다(CPO 명시).
P0-Identity-02  B-BRAND  같은 공식몰 상품에서 brand 가 «빈값» 이다. Brand evidence 가
                         비면 Identity precision 이 약화된다.
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

---

# D-MODEL INVESTIGATION (CTO 조사, 2026-10-11 · 🔴 수정 0건)

## 1. 원본에 실제 model/reference 존재 여부 — 🔴 **없다**

Smallable 430632 실측(운영 추출기로 측정):

```
extractProductCode(description)                → null
resolveModelNameFromDescription(description)   → null
resolveSeasonFromText(description/title)       → null
description 에 product/article code · ref 라벨  → 없음 (정규식 false)

있는 것:  sku "AAA1804532"       URL 꼬리 "430632"
원문:     "SIZE AND FIT  Loose fit  COMPOSITION  100% Organic Cotton
           Find out more  Wash Cold-30°  Made in Spain"
```

🔴 즉 **이 상품의 원본에는 제조사 모델번호가 적혀 있지 않다.** junioredition·
bobochoses 처럼 `Product code AW26MS185` 라벨을 쓰는 사이트와 다르다 —
Smallable 은 그 라벨을 쓰지 않는다.

## 2. 현재 title fallback 발생 경로 — 🔴 **의도된 동작이다**

```
buildCanonicalProduct
  └ buildCanonicalProductRaw   canonical-product.ts:430
        modelName = { value: "", source: "REQUIRED" }      ← 비워서 시작
  └ seedSeoContent             seed-seo-content.ts:127-136
        source 가 USER_EDITED / DETAIL_PAGE_REFERENCE 면 → skip (셀러 보호)
        값이 비어 있으면 → suggestModelName(product)
              seo-keywords.ts:208  return product.title.value || undefined
        → { value: <원상품명>, source: "ORIGINAL", confidence: 0.8 }
```

🔴 **SKU → title 사다리가 «아니다».** SKU 는 어느 칸에서도 후보로 쓰이지 않는다.
`suggestModelName` 은 title 하나만 보고, title 이 비면 `undefined` 를 돌려
**비워 둔다**(지어내지 않는다).

## 3. SKU 의 의미 — 🔴 **판매처 재고번호다 (실측으로 이미 결론)**

```
product-identity-dna.ts:129-143  Bobo 품번 B226AC114 와 Smallable 재고번호
                                 AAA1804922 는 «글자 구성이 같아 모양으로 못 가른다»
                                 → 「어디에 적혀 있었는지」로만 가른다
seo-keywords.ts:204-206          모델명은 원상품명 그대로. SKU·상품 ID·URL·
                                 브랜드+임의번호·AI 생성 «전부 금지(CPO 명시)»
                                 실측 근거: sku 가 STMRPWH2 · AAA1847110
```

🔴 이번 상품의 `AAA1804532` 는 그 **`AAA18…` 계열**이다 — 같은 Smallable 재고번호
형식이다. 다른 상품에서도 같은 의미(판매처 식별자)이고 제조사 모델번호가 아니다.

## 4. SKU 를 modelName 으로 사용할 근거 — 🔴 **없다. 이미 금지로 결론난 사안**

```
P5.6 P0-4/5 (CPO, 2026-10-09)  모델명 = 원상품명 그대로 · SKU 금지 «명시»
MI-DISCOVERY-P5-1 (2026-10-07) sku 를 brandModelCode 로 쓰면 오염된다
                               junioredition variant sku = "FF21-2" (자체 코드)
```

즉 §3·§4 는 **새 조사가 아니라 이미 닫힌 사안의 재확인**이다.

## 5. 3 Commerce 영향 (실측)

| 채널 | 들어가는 자리 | 필수 | 값 |
|---|---|---|---|
| Naver | `naverShoppingSearchInfo.modelName` | 🔴 NotEmpty 요구(`build-payload.ts:467`) | 원상품명 |
| Naver 고시 | KIDS/WEAR `modelName` (품명과 **두 칸**으로 분리, `common-notice-model.ts:237`) | 공통 모델 기준 | 원상품명 |
| LotteON | `spdLst[].mdlNo` (`build-payload.ts:424·444`) | 값 있으면 실림 | 원상품명 |
| LotteON 고시 | `0210` 「품명 및 모델명」 | 필수 | 원상품명(없으면 NEEDS_INPUT) |
| Coupang | 고시 「품명 및 모델명」 ← **`context.productName`** (`:1513`) | 메타 의존 | 🔴 modelName 을 **안 본다** |

🔴 **쿠팡은 이 축의 영향을 받지 않는다** — 자기 productName 을 쓴다.
🔴 셀러 수정 가능: `USER_EDITED` / `DETAIL_PAGE_REFERENCE` 면 `seedSeoContent` 가
   건드리지 않는다(화면 입력칸은 「기본정보」의 모델명 행 · `readiness.ts:470`).
🔴 기존 정상 상품 회귀 위험: **낮다.** 이 경로는 2026-10-09 부터 운영 중이고
   회귀 497 files / 7461 passed 가 그 동작을 이미 고정하고 있다.

## 6. 실제 상품 증거

```
상품   Smallable 430632 — All About Monsters Washed T-shirt Organic cotton | Blue
sku    AAA1804532              (Smallable 재고번호 계열)
URL id 430632                  (Smallable 자체 상품 ID)
model  🔴 원본에 없음
현재값 modelName = 원상품명 전체 (54자), source ORIGINAL, confidence 0.8
```

## 7. 결론

🔴 **D-MODEL 은 결함이 아니다.** 내가 ③ 에서 「상품명을 모델명으로 쓴다」고
적은 것은 **2026-10-09 CPO 결정(P5.6 P0-4/5)을 모른 상태의 오판** 이다.
현재 동작은 그 결정 그대로이고, 금지 목록(SKU·ID·URL·AI)도 지켜지고 있다.

남는 것은 결함이 아니라 **정책 질문 두 개** 다.

## 8. CPO 판정 필요사항

```
Q1. 채널이 「품명」과 「모델명」을 «두 칸» 으로 요구할 때(네이버 고시가 그렇다),
    두 칸에 같은 원상품명을 넣는 것이 맞는가?
    현재: 품명(itemName)은 비어 REQUIRED 로 남고 모델명에만 원상품명이 들어간다.
    → 「모델번호를 모를 때 모델명 칸을 비우고 셀러 입력으로 돌릴 것인가」가 쟁점.
    🔴 다만 네이버 naverShoppingSearchInfo.modelName 은 NotEmpty 요구이므로
       비우면 그 축이 막힌다 — 비우는 선택은 등록 가능성과 맞바꾸는 것이다.

Q2. LotteON `mdlNo` 에 54자 원상품명이 들어가는 것이 허용되는가?
    🔴 그 필드의 길이 제한·용도 제약을 이 저장소가 «실측한 적이 없다»(Known
       Unknown). 「모델번호 칸에 상품명」은 형식상 어색할 수 있다.
    → 실등록 전에 롯데ON 응답으로 확인되어야 할 축이다.

🔴 어느 쪽도 CTO 가 단독으로 바꾸지 않았다. source whitelist 정책
   (USER_EDITED · ORIGINAL · DETAIL_PAGE_REFERENCE 허용)은 그대로 유지했다.
```

---

# Commerce 최종 E2E — 대표 실제 상품 3개 × 3채널 (CTO 실측 2026-10-11)

🔴 손으로 만든 fixture 가 아니다. 리포에 실재가 확인된 URL 로 `universalExtract`
→ `buildCanonicalProduct` → 어댑터 → 세 builder + 검증기를 관통했다.

| | Smallable 430632 | Junior Edition Pupfish | Bobo 공식몰 B226AC043 |
|---|---|---|---|
| 가격 | 45 EUR | **31 GBP** | 75 EUR |
| brand | Bobo Choses | The Animals Observatory | 🔴 **빈값** |
| sku | AAA1804532 | F26100 | 🔴 없음 |
| material | 100% Organic Cotton | 100% Organic Cotton | 🔴 없음 |
| origin | Spain | Portugal | Spain |
| care | 케어라벨 참조 DEFAULT | 케어라벨 참조 DEFAULT | 케어라벨 참조 DEFAULT |
| 옵션 | 사이즈×6 | Size×5 | Clothing size×6 |
| **옵션별 재고** | ∅ 전부 없음 | 🟢 **1,3,2,2,2** | ∅ 전부 없음 |
| Naver 조합 | **0** | 🟢 **5** | **0** |
| Naver 재고 | 999 | 🟢 **10**(실측 합계) | 999 |
| LotteON stkQty | ∅×6 | 🟢 **1,3,2,2,2** | ∅×6 |
| LotteON 고시 | 7/13 | 7/13 | 6/13 |
| Coupang items | 6 | 5 | 6 |

## 🟢 재고 정책이 실제 상품에서 증명됐다

```
재고를 주는 상품(Junior Edition)   조합 5건 통과 · 상품재고 10(실측 합계)
                                   🔴 productStock 999[DEFAULT] 는 «무시된다»
재고를 안 주는 상품(2건)           조합 0건 → optionCombinations MISSING (D-OPT)
                                   stkQty 생략   → itmStkQty MISSING (D-LOT-STOCK)
```

🟢 **두 가드가 서로 다른 사이트의 실제 상품에서 발화했고, 재고가 있는 상품은
막지 않았다.** 「언제나 막는 가드」가 아니라는 대조군이 실상품으로 확보됐다.

## 공통으로 남는 차단 (3건 모두 동일 — 상품 결함이 아니다)

```
Naver   representativeImage   ← 하니스가 items:[] 로 불렀다(이미지 가공 단계 생략)
        deliveryInfo.deliveryCompany · afterServiceTelephoneNumber  ← 판매자 설정 공백
        고시 manufacturer·recommendedAge·certificationType·itemName·weight ← 원본에 없음
        BLOCKED: productCertificationInfos[].certificationNumber    ← 🔴 KC(지어낼 수 없다)
LotteON MISSING: itmImgLst(같은 이유) · BLOCKED: pdItmsArtlLst · sftyAthnLst(KC)
Coupang 고시 0건 ← categoryMeta 자격증명이 로컬에 없다(②에서 고정한 사실)
```

🔴 즉 **실등록을 막는 것은 상품 데이터가 아니라 ① 판매자 설정 ② KC ③ 자격증명**
세 갈래다. ①②는 셀러 화면에서 채워지고 ③은 Production 에서만 가능하다.

## 🔴 새 backlog 2건 (Commerce 가 아니라 MI 쪽이다)

```
B-BRAND  Bobo 공식몰에서 brand 가 «빈값» 이다. 브랜드 공식몰인데 브랜드가 비면
         MI 의 Identity 첫 축(Brand)이 무력해진다. → MI-P0 에서 본다.
B-CODE   같은 상품 URL 에 품번 `b226ac043` 이 있는데 어느 칸에도 들어오지 않는다.
         메모리([[brand-code-extraction-already-words]])는 공식몰 URL 앞머리
         조각이 품번이라고 기록해 두었다 — `extractCodeLikeSlugSegment` 가 이
         경로에서 호출되지 않는 것으로 보인다. 🔴 MI 의 «가장 강한 식별자» 축이라
         MI-P0 에서 최우선으로 확인한다.
```

## COMMERCE CLOSE 게이트

```
대표 실상품 3개 × 3채널 payload/validation   🟢 측정 완료
재고 정책 3-state                            🟢 실상품으로 증명
고시 공통 수집                               🟢 D-CARE 반영 확인
D-MODEL                                      🟢 조사 완료(결함 아님) · Q1/Q2 는 MI 를 막지 않음
전수 회귀                                    🟢 497 files / 7461 passed
typecheck                                    🟢 listing 5 = baseline · admin 0 · crawler 2
build                                        🟢 PASS
실등록                                        🔴 STOP (CPO GO 전까지)
```

---

# MI-P0 Replay — 1회 측정 (CTO 실측 2026-10-11)

운영 사슬 그대로: `Gemini grounding → resolveCandidate → PageProbe(GET) →
factsFromProductUrl`. 🔴 코드 추가 0건(임시 하니스 실행 후 삭제, 잔존 0).

## 측정값

```
Gemini 후보            29건 (쿼리 2개 · requests 2 · totalTokens 10,971)
resolve 시도           8건 (상위 4건 × 2쿼리 — Discovery STOP 조건)
resolve usable         4건  → 🔴 50%
  분류                 PRODUCT_PAGE 4 · LISTING_PAGE 3 · UNKNOWN_PAGE 1
Light Fetch            4/4 OK → 🟢 100%
수집 (최상위 키)        title 4/4 🟢 · brand 4/4 🟢
```

### 🔴 무효 KPI 3건 — 내 측정 오류다 (결함으로 보고하지 않는다)

```
modelCode · color · material  → 0/4 로 나왔지만 «무효» 다.
실제 candidate 키:  title · url · price · regularPrice · imageUrl · confidence
                   · brand · facts        ← 🔴 facts 가 «중첩» 돼 있다
color/material/modelCode 는 그 facts 안에 있고, 하니스는 최상위만 읽었다.
image·price 도 같은 자리에서 null 여부를 다시 확인해야 한다.
```

🔴 이 세션에서 같은 함정에 세 번째로 걸렸다(`stkQty` · `__name` · 여기).
**필드 이름을 추측하지 말고 키를 먼저 찍는다.**

## 🟢🟢 그래도 중요한 사실 둘이 확보됐다

```
① 국내 후보가 «실제로» 나온다
   kream.co.kr        "(Kids) Bobo Choses All About Monsters Short Sleeve"
   mustit.co.kr ×2    "보보쇼즈 26FW 올 어바우트 몬스터 반팔 남아 티셔츠 B226AC004 331"
   luxboy.com · petitlouie.co.kr · ssg.com · gsshop.com · trenbe.com
   → 「국내 후보가 검색에서 안 나온다」는 상태가 «아니다».
     memory [[domestic-discovery-dies-at-low-not-at-search]] 와 같은 결론이다.

② 🔴🔴 국내 판매처가 «제목에 브랜드 품번을 적는다»
   mustit 제목에 `B226AC004` 가 그대로 있다. brand 도 "보보쇼즈"(한글)로 수집됐다.
   → B-CODE 의 해법이 URL slug 가 아니라 **국내 제목 확인** 쪽에 있을 수 있다.
     [[brand-code-extraction-already-works]] 가 적어 둔 `confirmBrandCodeInTitle`
     (값을 지어내지 않고 «확인만» 하는 함수)이 이미 그 모양이다.
   🔴 단 `B226AC004` 가 이 상품의 품번인지는 «확인되지 않았다» — 원본(Smallable)
      에서 품번을 못 뽑았기 때문이다. 즉 지금은 대조할 기준값이 없다.
      그것이 B-CODE 가 P0-Identity-01 인 이유다.
```

## 🔴 Identity 판정은 아직 붙이지 않았다

KPI 9~14(SAME precision · SIMILAR contamination · 국내/해외 가격 매칭 ·
INSUFFICIENT 비율 · Human Review Rate)는 **측정하지 않았다.** 수집 KPI 3건이
무효인 상태로 Identity 를 돌리면 그 판정도 무효가 된다 — 순서를 지킨다.

---

# MI-P0 ②~⑥ 재측정 — 🔴 B-CODE 보고를 «정정» 한다 (2026-10-11)

후보 10건을 캐시해 두고(`scratchpad/mi-p0-candidates.json`) 실제 칸으로 다시 셌다.
🔴 앞 측정이 0 을 낸 이유는 내가 «없는 칸 이름»(`modelCode`·`productCode`)을 센 것이다.
실제 모양은 소스에서 확인했다 — `ComparisonCandidate{title,url,price,regularPrice,
imageUrl,confidence,brand?,sku?,facts?}` · `facts{brandModelCode,sellerSku,colorText,
materialText,categoryText,urlSlug,coreTitleTokens,sizeLabels,imageUrls,…}`.

## 측정값 (칸 이름 확인 후)

```
Gemini 후보 10건 → resolve usable 6 (🔴 60%) → Light Fetch 6/6 OK (🟢 100%)
분류            PRODUCT_PAGE 6 · LISTING_PAGE 2 · UNKNOWN_PAGE 2
수집            title 6/6 🟢 · brand 5/6 🟢 · imageUrl 3/6 🟡
                🔴 price 0/6 · regularPrice 0/6 · sku(최상위) 0/6
```

## 🔴🔴 ①번 정정 — B-CODE 는 MI 경로에서 «작동한다»

```
bobochoses.com(공식몰)  🟢 brandModelCode "B226AC004" · "B226AC018"
                          colorText "light green" · "midnight blue"
                          materialText "… Recycled Polyester 50%, Cotton 50% …"
mustit.co.kr            🔴 전부 null
4910.kr                 🔴 전부 null
donokids.com            🔴 전부 null
```

🔴 **앞서 Commerce E2E 에서 「Bobo 공식몰인데 brand 빈값 · 품번 없음」이라고 적은 것은
경로가 달랐던 것이다.** `universalExtract`→`buildCanonicalProduct`(Commerce 수집
경로)는 그 둘을 못 채우는데, `factsFromProductUrl`(MI 경로)은 **채운다.**
→ B-CODE/B-BRAND 는 「추출기가 없다」가 아니라 **「두 경로가 서로 다른 것을 읽는다」**다.
   P0-Identity-01/02 의 과제가 «구현» 에서 «경로 통합» 으로 바뀐다.

## 🔴 진짜 P0 결함 — 가격이 한 건도 수집되지 않는다

```
price 0/6 · regularPrice 0/6   (칸 이름 확인 후의 수치다 — 무효 측정이 아니다)
```

CPO 의 1순위는 「국내 동일상품이 한국에서 얼마에 팔리는가」인데, **Light Fetch 가
가격을 한 건도 주지 않는다.** 이것이 국내 가격비교를 막는 실제 지점이다.
🔴 `factsFromProductUrl` 의 어느 fetchPath 가 가격을 버리는지는 아직 특정하지 않았다.

## 🔴 국내 판매처는 식별 축이 «title+brand» 뿐이다

mustit·4910·donokids 에서 `brandModelCode·colorText·materialText` 전부 null.
CPO 기준(식별자 > 이미지/특성 > 제목 유사도)에서 **가장 약한 축만 남는다** —
즉 지금 국내 후보로 SAME 을 판정하면 「SIMILAR→SAME 오판」 위험 구간이다.
🟢 그래서 Identity 를 아직 붙이지 않은 판단이 맞았다.

## 🟡 Gemini 가 가져온 것은 «같은 상품» 이 아니다

공식몰 후보의 품번은 `B226AC004`(light green) · `B226AC018`(midnight blue) 인데
원본은 "All About Monsters Washed T-shirt … Blue" 다. 즉 **같은 시리즈의 다른 색/다른
품번**이다. 🔴 제목 유사도만 보면 SAME 으로 올라갈 수 있는 바로 그 조합이고,
품번이 있으면 NO_MATCH 로 갈라진다 — B-CODE 가 P0 인 이유가 실측으로 보인다.

## 다음 (순서 고정)

```
① price 0/6 의 원인 특정 — factsFromProductUrl 의 fetchPath 별로 가격 유실 지점
② B-CODE/B-BRAND 경로 통합 — Commerce 수집 경로가 MI 경로의 facts 를 못 보는 문제
③ 그 뒤 Identity 연결 → SAME/SIMILAR → Verified Price → KPI 9~14
🔴 ①② 전에 Identity 를 붙이면 그 판정이 무효다(수집 축이 title+brand 뿐이므로).
```

---

# 🔴 ① price 0/6 — 원인 특정: **결함이 아니다. 내가 또 틀렸다** (2026-10-11)

```
product-url-facts.ts:186   // 🔴 통화를 모르므로 가격을 만들지 않는다
                           price: null · regularPrice: null      ← SHOPIFY_JSON 경로
product-url-facts.ts:204-210
   🔴 비-Shopify 에는 «일반» 상품 사실 추출기가 없다. 목록 수준 사실(상품명·URL)만
      만든다 — 나머지 축은 null 로 남아 판정기가 「다름」이 아니라 «근거 없음» 으로 읽는다
   🔴 사이트별 상세 파서를 여기서 만들지 않는다. 그건 «어댑터의 일» 이고, 이 파일이
      도메인 분기를 갖기 시작하면 price-source-adapter 등록부와 둘로 갈린다
```

🟢 그 등록부는 실재한다 — `comparison-search/price-source-adapter.ts` · 어댑터 13개 ·
계약 테스트(`__tests__/price-source-adapter-contract.test.ts`)까지 있다.

🔴 **즉 `factsFromProductUrl` 은 가격을 담당하지 «않는다».** 나는 가격을 담당하지
않는 함수로 가격을 재고 「P0 결함」이라고 적었다. 이번 스프린트에서 **네 번째**
같은 오류다:

```
① stkQty  → stckQty/saleQty 로 재서 「필드 없음」 오판 직전
② __name  → tsx 실행 방식 문제를 상품 결함으로 오인
③ modelCode/productCode → 없는 칸을 세서 거짓 0
④ price   → 담당하지 않는 함수로 재서 「수집 안 된다」 오판
```

**공통 원인은 하나다 — 「측정 대상이 그 값을 담당하는 함수인지」를 먼저 확인하지
않았다.** [[measure-with-the-production-function]] 이 적어 둔 그 함정이고, 그 메모는
「운영 «경로» 로 재라」까지만 적혀 있었다. 축을 하나 더 적어야 한다:
🔴 **「그 값의 «주인» 함수로 재라」.** 운영 경로 안에도 담당이 갈려 있다.

## 그래서 ②(가격 수집 경로 수정)의 올바른 범위

```
❌ factsFromProductUrl 에 가격 파서를 넣는다      ← 그 파일 주석이 금지한다(등록부와 갈린다)
✅ price-source-adapter 등록부에 «국내 판매처» 가 있는지 확인하고,
   없으면 그 등록부 기준으로 다룬다(mustit·4910·kream 등)
🔴 그 확인은 아직 하지 않았다 — 다음 작업의 ①이다
```
