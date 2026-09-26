# Commerce-6 Phase F-1/F-2 — Common → Commerce 매핑 검증

> CTO(2026-09-26). **코드 변경 0 · DB 0 · push 0.** (문구 정정 2건은 별도 커밋)
>
> 🔴 **방향이 정정됐다.** Phase A~E 는 「Commerce 별 설정 → Common 통합」으로
> 거꾸로 접근했다. 정확한 방향은 그 반대다.

---

## 0. 고정된 방향

```
                 COMMERCE COMMON  (Canonical — 확보 가능한 정보를 최대 보유)
                          │
        ┌─────────────────┼─────────────────┐
     SmartStore        Coupang           LotteON
     Adapter mapping   Adapter mapping   Adapter mapping
```

묻는 순서가 바뀐다:

```text
❌ 「이 Commerce 가 요구하는 것을 Common 에 넣을까」
✅ 「Common 이 이미 가진 것을 이 Commerce 가 어떻게 쓸 것인가」
```

🔴 그리고 **「최대 보유」는 「모든 Commerce 필드의 합집합을 한 테이블에 복사」가
아니다.** 실제 업무 의미 → Canonical → Adapter 변환이다.

### 🔴 [CORRECTION] — Phase C/D 의 `manufacturer` 판정 취소

```text
❌ 취소   seller_settings.manufacturer = LEGACY · 제거 후보
✅ 정정   manufacturer 는 Common 의 유효한 Canonical 개념이다.
         판매자 값이 그 컬럼에 들어앉아 있던 것은 «의미/소유» 의 문제이지
         개념의 폐기 근거가 아니다.

         제조사(manufacturer) ≠ 수입사(importer) ≠ 판매자(seller)
```
`commerce-6-phase-c-…md §6` · `commerce-6-phase-d-…md §5` 에 같은 정정 노트를 남겼다.
조사 «사실»(소비처 0 · 실측 NULL)은 보존한다.

---

## 1. 🔴 가장 먼저 — 이름이 실제 사용 범위를 말하지 않는다

**테이블 이름·파일 경로로 「이건 쿠팡 전용」이라고 판단하지 않는다.** 실제 소비처로 판정한다.

| 저장소 | 이름이 말하는 것 | 실제 소비 | 판정 |
|---|---|---|---|
`coupang_brand_profiles` | 쿠팡 전용 | 🔴 **쿠팡 · 네이버 · 롯데ON 전부** | ✅ **Common 자산** |
`coupang_seller_profiles` | 쿠팡 전용 | 배송 의미·가격정책·상세페이지 = 3채널 / 채널 ID = 각자 | 🟡 **혼재** |
`seller_settings`(059) | 중립 | 3채널(롯데ON 은 일부) | ✅ Common |
`lotteon_seller_settings` | 롯데ON | 롯데ON | ✅ 채널 binding(정상) |

```text
findBrandProfileByName() 호출부
  coupang/register/route.ts · coupang/payload-preview/route.ts
  naver/_lib/resolve-context.ts:125
  lotteon/_lib/build-context.ts:174
```

🔴 **이름 때문에 migration 하지 않는다.** `coupang_brand_profiles` 는 이미 Common 이고,
옮길 이유는 「이름이 틀렸다」뿐이다 — 그건 Production 위험을 감수할 이유가 못 된다.

---

## 2. 🔴 조사 보고를 «세 군데» 뒤집었다

F-1 위임 조사가 돌아왔지만 표 안에서 서로 모순되는 칸이 있어 직접 확인했다.
**아래 셋은 위임 보고가 틀렸고, 내가 코드로 정정한 것이다.**

### 2-1. 「SmartStore 가 `itemName`·`modelName`·`weight` 를 안 쓴다」 → **틀렸다**

```typescript
// packages/listing/src/naver/build-payload.ts:701-703
itemName:  resolveNoticeFieldValue("itemName",  product.itemName),
modelName: resolveNoticeFieldValue("modelName", product.modelName),
weight:    resolveNoticeFieldValue("weight",    product.weight),
```
네이버 KIDS 고시로 **실제로 나간다.** (Phase A 의 검증기 조사와도 일치한다 —
`validate-payload.ts` 가 이 셋을 MISSING 으로 잡는다.)

### 2-2. 「가격정책 3종을 어느 build-payload 도 안 읽는다 → 미사용」 → **오독이다**

```text
settings 저장
   → CommerceWorkspace.tsx:1061   defaultMarginPercent → product.priceBreakdown.marginPercent
   → priceRoundingUnit            → roundingUnit
        → packages/pricing  resolveListingPrice() · breakdown.ts:64-73
        → 3채널 «전부» 의 등록가가 이 값으로 계산된다
```

🔴 `build-payload` 가 안 읽는 것이 맞다 — **그게 옳은 구조다.** 가격은 payload 조립보다
한 층 위(`packages/pricing`)에서 정해지고 세 채널이 그 결과를 쓴다.
**「build-payload 에 없다 = 미사용」은 성립하지 않는다.**

### 2-3. 「`coupang_brand_profiles` 는 쿠팡 전용」 → **틀렸다** (§1 참조)

---

## 3. F-1 매핑표 — 6단계 기준

각 칸: `✅ 사용` / `🔴 미사용` / `🟡 부분`. 근거는 전부 직접 확인했다.

### 3-1. `seller_settings`(059) — 판매자 공통

| Common 정보 | 의미 | SmartStore | Coupang | LotteON | payload 도달 |
|---|---|---|---|---|---|
`manufacturer` | 제조사 | 🟡 | 🟡 | 🟡 | 🔴 §4-1 참조 — 사다리에서 빠져 있다 |
`as_contact_number` | A/S 연락처 | ✅ | ✅ | 🔴 | 네이버 `afterServiceDirector`/`afterServiceInfo` · 쿠팡 notice |
`quality_guarantee` | 품질보증기준 | ✅ | ✅ | 🔴 | 네이버 `warrantyPolicy` · 쿠팡 notice |
`kc_exemption_text` | KC 면제문구 | 🟡 | ✅ | 🔴 | 쿠팡 notice `DEFAULT_VALUE` 경로 |
`default_country_of_origin` | 원산지 기본값 | ✅ | ✅ | 🔴 | 🔴 **§4-2 — 진짜 누락** |

🔴 롯데ON 의 A/S·품질보증·KC문구 미사용은 **87 payload 에 대응 자리가 없다**(확인됨).
누락이 아니라 채널 부재다.

### 3-2. `coupang_brand_profiles`(014) — 🔴 이름만 쿠팡, 실제는 Common

| Common 정보 | SmartStore | Coupang | LotteON | 도달 |
|---|---|---|---|---|
`name` | ✅ | ✅ | ✅ | `findBrandProfileByName()` 조회 키 |
`manufacturer` | ✅ | ✅ | ✅ | 제조사 사다리 2단계 |
`brand_intro` | ✅ | ✅ | ✅ | `resolve-context.ts:225` · `register/route.ts:521` · `build-context.ts:124` |
`country_of_origin` | ✅ | ✅ | 🔴 | §4-2 |
`representative_image_url` | 🔴 | 🔴 | 🔴 | 🔴 **어느 채널도 안 쓴다** |
`common_description` | 🔴 | 🔴 | 🔴 | 🔴 **어느 채널도 안 쓴다** |

### 3-3. `coupang_seller_profiles` — 🟡 Common 과 채널 ID 가 한 테이블에

| Common 정보 | SmartStore | Coupang | LotteON | 비고 |
|---|---|---|---|---|
`top/bottom_common_image_*` | ✅ | ✅ | ✅ | 3채널 공유 `assembleContentsFromBlocks()` |
`default_detail_blocks` | ✅ | ✅ | ✅ | 같음 |
`delivery_charge` | ✅ | ✅ | 🔴 | 롯데ON 은 정책번호(개념이 다르다 — Phase B 확정) |
`return_delivery_charge` | ✅ | ✅ | 🔴 | 같음 |
`exchange_delivery_charge` | ✅ | 🔴 | 🔴 | 🔴 쿠팡 payload 에 교환배송비 «자리가 없다» |
`outbound_lead_time_days` | 🔴 | ✅ | ✅ | 🟡 §4-3 |
`default_margin_percent` | ✅ | ✅ | ✅ | pricing 층 경유(§2-2) |
`price_rounding_unit` | ✅ | ✅ | ✅ | 같음 |
`include_shipping_in_price` | 🔴 | 🔴 | 🔴 | 🔴 CRUD 만 있고 읽는 곳 0 |
`domestic_shipping_cost_krw` | 🔴 | 🔴 | 🔴 | 🔴 **의도적 제거**(MI-UX-FINAL-4) — §4-4 |
채널 ID 6종(출고지·반품지·택배사 2·반품주소 등) | — | — | — | Common 아님 · binding |

---

## 4. F-2 — 누락 · 오연결

### 4-1. 🔴 `manufacturer` — Common 에 있는데 사다리가 «건너뛴다»

```text
resolveManufacturer()  입력
    상품 원문 → 브랜드 프로필 → 브랜드명 → 없음
                                    ↑
                          🔴 seller_settings.manufacturer 가 «없다»
```

PIVOT NEXT-04c-2 가 그 단계를 뺀 이유는 **그 칸에 판매자 이름이 들어 있었기 때문**이다
(`build-context.ts:263`). 개념이 죽어서가 아니다.

🔴 **이번에 고치지 않는다.** 제조사 fallback 정책은 확정 사안이고(F-4), 값·소유를
정리하기 전에 사다리에 되꽂으면 판매자 이름이 다시 제조사로 나간다.
**먼저 §4-5(판매자 칸 부재)를 풀어야 한다.**

### 4-2. 🔴 원산지 — Common 은 «텍스트», 롯데ON 은 «코드». Adapter 에 변환이 없다

```text
Common        default_country_of_origin · brandProfile.country_of_origin   (텍스트)
   ├─ 쿠팡    notice 원산지            ✅ 텍스트 그대로
   ├─ 네이버  originAreaCode           ✅ 535개 코드로 매칭(GET /v1/product-origin-areas)
   └─ 롯데ON  oplcCd (공통코드 OPLC_CD) 🔴 «변환 없음» — 셀러가 매번 고른다
```

🔴 **이것이 F-2 의 1순위 누락이다.** 네이버는 텍스트→코드 변환을 이미 하고 있고,
롯데ON 만 안 한다. Common 에 값이 있는데 셀러가 상품마다 다시 고르고 있다.

🔴 다만 `OPLC_CD` 코드표는 89 실시간 조회로만 얻는다 — 매핑 구현은 C-4(택배사)와
같은 제약을 받는다. **여기서 표를 지어내지 않는다.**

### 4-3. 🟡 `outbound_lead_time_days` — 네이버 미사용

쿠팡 `outboundShippingTimeDay` · 롯데ON `sndBgtNday` 로는 간다.
🔴 네이버에 대응 필드가 있는지 **확인하지 못했다** — `naver/types.ts` 에는
`releaseDate`/`releaseDateText` 만 보인다. 채널 부재인지 누락인지 **미확정**.

### 4-4. ✅ `domestic_shipping_cost_krw` — 누락이 아니라 «결정»

```text
market-intelligence.ts:310
  「… sellerProfile.domesticShippingCostKrw 자체는 지우지 않는다 —
    Settings 에 저장된 판매자 값이고, 읽는 곳이 없을 뿐이다.」  (MI-UX-FINAL-4, CEO)
```
🔴 고치지 않는다. 기록만 한다.

### 4-5. 🔴 판매자(사업자) 정보를 담는 Common 칸이 **없다**

지시하신 「판매자 정보가 어디에 존재하는지 먼저 확인」의 답이다.

```text
저장소 전수 grep (사업자 · businessNumber · companyName · sellerName …)

  seller_settings.manufacturer   🔴 «값» 이 여기 들어앉아 있다 (build-context.ts:263)
  companyName                    전부 KC 인증기관명 (childCertification)
  sellerName                     해외 «판매처»(경쟁 셀러) 이름 — 우리 사업자가 아니다
  company_contact_number         반품지 연락처(배송 프로필)

  🔴 사업자등록번호 · 상호 · 대표자명을 담는 칸은 «어디에도 없다»
```

판정: F-3 의 ①②③ 중 **②(같은 의미의 Common 필드가 필요)** 다 —
③(채널 발급 ID)이 아니다. 판매자 정보는 채널이 발급하는 값이 아니라
셀러 자신의 사실이다.

🔴 **`seller` 칸을 이번에 만들지 않았다**(지시). 개념만 확정한다:
```text
manufacturer → 실제 제조사
importer     → 실제 수입사   (현재 CanonicalProduct.importer — 상품별)
seller       → 실제 판매자   (🔴 저장 위치 없음)
```

### 4-6. 🔴 `representative_image_url` · `common_description` — Common 에 있는데 자리가 없다

브랜드 프로필의 두 칸은 저장·편집은 되는데 3채널 어디에도 나가지 않는다.
의미상 상세페이지 블록(`brand_intro` 와 같은 자리)에 들어갈 수 있는 값이다.
🔴 F-3 후보로만 올린다.

---

## 5. F-3 판정 — ①②③

| 항목 | ① Common 에 이미 있나 | ② 통합 가능한가 | ③ 채널 발급 ID 인가 | 판정 |
|---|---|---|---|---|
원산지 코드(롯데ON) | ✅ 텍스트로 있다 | ✅ 개념 1 + 표현 N | ✗ | **Adapter 변환 추가** |
판매자 정보 | 🔴 없다(칸이 없다) | ✅ Common 에 둘 의미 | ✗ | **Common 신설 후보** |
브랜드 대표이미지·공통설명 | ✅ 있다 | ✅ 상세페이지 블록 | ✗ | **연결 추가 후보** |
`include_shipping_in_price` | ✅ 있다 | 🟡 pricing 의미 | ✗ | **미확정 — 의도 확인 필요** |
출고지·반품지·택배사·배송비정책 | — | ✗ | ✅ | **binding 유지**(변경 없음) |
`outbound_lead_time_days`(네이버) | ✅ | 🔴 미확정 | ✗ | **채널 capability 확인 필요** |

---

## 6. 🔴 확인하지 못한 것

```text
UNVERIFIED  DB 실제 행/값 전부 (C-1 그대로)
UNVERIFIED  네이버에 출고소요일 대응 필드가 있는가
UNVERIFIED  OPLC_CD 코드 목록 (89 실시간 조회 필요)
UNVERIFIED  include_shipping_in_price 가 «한 번도» 쓰인 적 없는지, 제거된 것인지
UNVERIFIED  롯데ON 87 payload 에 A/S·품질보증 자리가 정말 없는지(문서 미확보 · grep 근거만)
```

## 7. 이번에 하지 «않은» 것

```text
❌ DB migration · 테이블 이름 변경 · seller 칸 신설
❌ manufacturer 삭제/rename · 제조사 사다리 수정
❌ 제조사/수입사/A/S/KC/원산지 «의미» 재논의
❌ 원산지 텍스트→코드 매핑표 작성(코드 목록 미확보)
❌ push
```
