# Commerce-6 Phase A — 3 Commerce 전수 필드 분류표

> CTO(2026-09-26). **코드·DB 변경 0 · push 0.** 이 문서는 «조사 결과»다.
> 착수 노트 `commerce-6-unified-information-architecture-kickoff.md` §3 이 지시한
> 「검증기 → 필수 필드 → ①③④ 대조 → 13열 분류표」를 끝까지 수행한 기록이다.
>
> 🔴 Phase B(Canonical 설계) 이후는 **미착수**다. 중간 구현을 하지 않았다.

---

## 0. 조사 경로와 «실제로 읽은» 것

착수 노트 §3 의 입구 넷을 전부 열었다.

| | 입구 | 실제로 읽은 파일 |
|---|---|---|
② | 검증기 | `naver/validate-payload.ts`(873) · `lotteon/validate-payload.ts`(291) · `smartstore/validate-listing.ts`(54) · `coupang/compliance-report.ts`(253) · `coupang/register/route.ts:155` |
① | 빌더 | `lotteon/build-payload.ts` · `coupang/build-payload.ts` · `lotteon/_lib/build-context.ts` |
③ | 화면 | `LotteOnRegistrationPanel.tsx` · `lotteon-channel-form.ts` · `PlatformPreview.tsx` |
④ | 설정 | `seller_settings`(059) · `coupang_seller_profiles`(004~062) · `lotteon_seller_settings`(058) · `coupang_brand_profiles`(014) · `commerce_accounts`(023/050) |

---

## 1. 🔴 착수 노트를 «정정» 하는 것 넷

전수 조사의 첫 성과는 표가 아니라 **전제의 정정**이다. 아래 넷은 착수 노트가
사실과 다르게 적고 있었고, 그대로 두면 Phase B 설계가 틀린 지도 위에 선다.

### 1-1. `FieldSource` 의 값이 다르다 — 두 타입이 한 줄로 합쳐져 있었다

```text
착수 노트 §2-4   FieldSource: ORIGINAL · AI · MANUAL · SETTINGS_DEFAULT · DEFAULT_VALUE · REQUIRED
실제 코드        FieldSource = ORIGINAL | AI_GENERATED | USER_EDITED | DEFAULT | REQUIRED | DETAIL_PAGE_REFERENCE
```
`packages/shared/src/product-types.ts:26`

`SETTINGS_DEFAULT` 는 `FieldSource` 에 **없다.** 그것은 `ReadinessItem.sourceStatus`
(`readiness.ts:34`)의 값이다. 두 타입은 서로 **다른 질문**에 답하며, 코드가 그
사실을 이미 명시하고 있다(`product-types.ts:29-40`).

```text
FieldSource   「어디서 왔는가」      ORIGINAL · AI_GENERATED · USER_EDITED · DEFAULT · REQUIRED · DETAIL_PAGE_REFERENCE
InputMode     「어떻게 쓰는가」      VALUE · REQUIRES_INPUT · DETAIL_REFERENCE        (product-types.ts:41)
sourceStatus  「누가 채우는가」      AUTO · SETTINGS_DEFAULT · MANUAL_REQUIRED · DEFAULT_VALUE   (readiness.ts:34)
```

🔴 **축은 하나가 아니라 셋이다.** Phase B 는 이 셋을 합치려 들지 말 것 —
합치려다 실제 사고가 났던 기록이 `product-types.ts:32-39` 에 남아 있다.

### 1-2. 설정 저장소는 «둘» 이 아니라 **넷** 이다 — 그리고 PIVOT-02 001/002 는 이미 끝났다

착수 노트 §2-1 은 저장소를 (1) sellerProfile (2) `lotteon_seller_settings` 둘로 그렸다.
실제로는 넷이고, 그 사이에 **마이그레이션이 이미 실행됐다.**

| | 저장소 | 담긴 것 | 근거 |
|---|---|---|---|
**(1)** | `seller_settings` | `manufacturer` · `as_contact_number` · `quality_guarantee` · `kc_exemption_text` · `default_country_of_origin` | 059 신설 |
**(2)** | `coupang_seller_profiles` | 배송 «의미» + 쿠팡 채널ID + **네이버 채널ID** + 가격정책 + 공통이미지 + 상세블록 (30컬럼) | 004~062 |
**(3)** | `lotteon_seller_settings` | 롯데ON 채널ID 4 + 마감시간 2 + `default_import_proxy_code`(HOLD) | 058 |
**(4)** | `coupang_brand_profiles` | 브랜드별 `manufacturer` · `country_of_origin` · 소개/이미지 | 014 |
(+) | `commerce_accounts` | 채널별 자격증명 | 023 · 050 |

```text
059  seller_settings 신설 + backfill
060  dual-write 임시 다리
061  dual-write DROP
062  coupang_seller_profiles 에서 판매자 5칸 DROP   ← 🔴 실행 완료 · 되돌릴 수 없음
```

🔴 **PIVOT-02 §9 의 Migration 001·002 는 「설계」가 아니라 「완료」다.**
`062_drop_legacy_seller_settings_columns.sql` 이 그 종착점이고, 지문(hash)과
실행 전 검증 결과까지 파일에 적혀 있다. Phase C 가 001/002 를 다시 계획하면
**이미 한 일을 두 번 한다.**

### 1-3. 🔴 롯데ON 화면이 비는 원인 — **후보 3개가 «전부» 실제 경로를 짚지 못했다**

착수 노트 §2-3 의 세 후보는 「`sellerFixed` 가 폼 초기값에 연결됐는가」를 물었다.
코드를 읽은 답은 **그 질문 자체가 어긋나 있다**는 것이다.

```text
폼 초기값        EMPTY_LOTTEON_CHANNEL_FORM = ""          (lotteon-channel-form.ts:135)
                        ↓
자동 채우기       /api/lotteon/delivery-settings  →  autoPick()
                 🔴 이것은 DB 설정이 아니라 «롯데ON 실시간 조회» 다
                    (207 identity → 150 출고지/반품지 → 166 배송비정책 → 89 공통코드)
                        ↓
autoPick 규칙     isDefault 표시가 있거나 «후보가 정확히 하나» 일 때만 채운다
                 그 외에는 null 을 돌려주고 칸은 «빈 채로 남는다»   (Panel.tsx:230-235)
                        ↓
sellerFixed      /api/settings/lotteon-seller → 🔴 «표시 전용» 이다. 폼을 채우지 않는다
                 CEO 확정: "이 값으로 폼을 채우지 않는다"           (Panel.tsx:594-597)
                        ↓
실제 합류         서버 한 곳에서만 일어난다
                 fixed(form값, sellerSettings값)                   (build-context.ts:222-225)
```

🔴 **「화면이 비어 있다」는 버그가 아니라 설계다.** 폼은 상품별 «명시» 값만 담고,
설정값은 서버에서 합류한다(`resolveLotteOnSellerFixedValue`, 사다리 순서 = **폼 우선**).
`build-context.ts:220-221` 이 그 이유를 직접 적었다 — 「출고지가 두 곳인 판매자에게
autoPick 규칙은 아무 도움이 안 됐다」.

따라서 Phase E 가 고칠 대상은 「폼 초기값 연결」이 **아니다.** 남은 실제 위험은 둘:

```text
(c′)  /api/settings/lotteon-seller 실패를 catch 가 조용히 삼킨다   (Panel.tsx:643-646)
      → 조회 장애와 「설정 없음」이 화면에서 같은 얼굴이 된다
      🔴 서버측은 이미 이 구분을 한다(R6-FS, sellerSettingsError) — 화면만 안 한다

(a′)  lotteon_seller_settings 행이 비어 있으면 서버 합류도 빈 값이다
      → 검증기가 SELLER_PLACE_REQUIRED 로 정상 차단한다(오동작 아님)
```

### 1-4. 쿠팡에는 `validate-*.ts` 가 없다 — 검증이 **세 곳으로 흩어져** 있다

```text
네이버   validate-payload.ts        한 파일 · READY/MISSING/BLOCKED
롯데ON   validate-payload.ts        한 파일 · READY/MISSING/BLOCKED + BlockCode 8종
쿠팡     ① build-payload.ts         buildCoupangCompliance() — 필드별 source 7종
        ② compliance-report.ts      점수·verdict(FAIL) 환산
        ③ register/route.ts:155     missingSellerConfigFields() — 설정 10칸 게이트
```

그리고 쿠팡은 **네 번째 어휘**를 쓴다:

```text
ComplianceFieldResult.source
  USER_INPUT · OPTION_MATCH · PRODUCT_FIELD · KNOWN_VALUE · DETERMINISTIC · DEFAULT_VALUE · PLACEHOLDER
                                                                        (compliance-report.ts:83-93)
```

🔴 §1-1 의 축 셋에 더해 **네 번째 「어디서 왔는가」 어휘**가 쿠팡 안에만 있다.
`FieldSource` 와 개념이 겹치지만(USER_EDITED↔USER_INPUT, DEFAULT↔DEFAULT_VALUE) 같은
타입이 아니다.

---

## 2. 🔴 축은 있는데 «달려 있지 않다» — §2-5 에 대한 답

착수 노트 §2-5 는 「모든 필드가 그 축을 제대로 달고 있는지 보면 된다」고 했다.
답: **달려 있지 않다. 세 군데가 끊겨 있다.**

### 2-1. 네이버는 전 필드가 `MANUAL_REQUIRED` 다

```typescript
// readiness.ts:250
sourceStatus: f.status === "READY" ? undefined : ("MANUAL_REQUIRED" as const)
```

같은 파일이 **이미 두 번** 「이건 설정값이다」를 알고 있는데도 반영하지 않는다:

```typescript
// readiness.ts:247  — group 은 가른다
NAVER_SETTINGS_FIELD_PREFIXES.some((p) => f.field.startsWith(p)) ? "BUSINESS_SETTINGS" : …
// readiness.ts:262
const NAVER_SETTINGS_FIELD_PREFIXES = ["claimDeliveryInfo", "deliveryInfo"];
// readiness.ts:410-412 — externalHref 도 가른다
const NAVER_NOTICE_FIELD_EXTERNAL_HREF = { warrantyPolicy: "/settings", afterServiceDirector: "/settings" };
```

**그 결과가 무엇인지** `classifyMissing()` 이 말한다:

```typescript
// commerce-registry.ts:131
return sourceStatuses.every((s) => s === "MANUAL_REQUIRED") ? "INPUT" : "CONFIRM";
```

🔴 네이버는 `every(MANUAL_REQUIRED)` 가 **항상 참**이므로 **영원히 `INPUT`(입력 필요)** 이고
`CONFIRM`(확인 필요) 이 될 수 없다. 출고지·반품지·택배사·반품배송비·교환배송비·
품질보증·A/S 연락처 7종이 Settings 에 이미 있어도 「직접입력 필요」로 표시된다.

### 2-2. 롯데ON 은 `sourceStatus` 를 **한 번도 달지 못한다**

`readiness.ts` 의 진입점은 둘뿐이다 — `computeChecklistReadiness`(쿠팡/11번가)와
`computeNaverPayloadReadiness`(네이버). 롯데ON 18개 필드는 `LotteOnRegistrationPanel`
이 서버 검증 결과를 **직접** 받아 그린다. `ReadinessItem` 을 거치지 않으므로
`sourceStatus` 도 `classifyMissing()` 도 적용되지 않는다.

### 2-3. 쿠팡만 «진짜» 축을 달고 있다 — 그러나 자기 어휘로

`computeChecklistReadiness` 는 `AUTO` / `SETTINGS_DEFAULT` / `DEFAULT_VALUE` /
`MANUAL_REQUIRED` 를 실제로 구분해 붙인다(`readiness.ts:151·165·175·194`).
**세 채널 중 하나만 축이 살아 있다.**

```text
쿠팡     AUTO · SETTINGS_DEFAULT · DEFAULT_VALUE · MANUAL_REQUIRED   ✅ 4값 전부
네이버   MANUAL_REQUIRED                                             🔴 1값 고정
롯데ON   (없음)                                                       🔴 경로 자체가 없음
```

---

## 3. 13열 전수 분류표

### 열의 정의 — 🔴 새 축을 만들지 않았다

| # | 열 | 값의 출처 | 근거 |
|---|---|---|---|
1 | **개념** | 우리 말(Canonical 후보명) | — |
2 | **SmartStore** | 네이버 payload 키 / 검증기 field | `naver/validate-payload.ts` |
3 | **Coupang** | 쿠팡 payload 키 / notice·attribute 이름 | `coupang/build-payload.ts` |
4 | **LotteON** | 87 payload 키 | `lotteon/build-payload.ts` |
5 | **필수도** | `필수` / `조건부` / `선택` / `—`(개념 없음) | 각 검증기 |
6 | **Ownership** | PIVOT-02 §1 6값 | `pivot-02-data-ownership-design.md:26-33` |
7 | **InputMode** | PIVOT-02 §4 5값 | 같은 문서 `:199-205` |
8 | **sourceStatus(현재)** | 지금 «실제로 달려 있는» 값 | `readiness.ts` |
9 | **저장 위치** | 실제 저장소/컬럼 | 마이그레이션 |
10 | **화면 입력칸** | `있음` / `읽기전용` / `없음` | ③ |
11 | **참조 대체** | 「상세페이지 참조」 허용 | `notice/reference-eligibility.ts:20` |
12 | **🔴 자동수집 가능성** | Extension 이 «지금» 수집 가능한가 | 🔴 6열과 **별개 칸** |
13 | **🔴 끊긴 곳** | 축 누락 · 경로 부재 · 중복 | 본 조사 |

> 🔴 **12열이 6열과 분리된 이유가 고정 원칙 그 자체다** —
> 「COMMON 으로 관리할 수 있다」 ≠ 「지금 자동으로 채울 수 있다」.
> 11열(참조 대체)은 12열의 대용물이 **아니다**. 참조 대체는 값을 채우는 것이
> 아니라 「채널이 문구를 받아 준다」는 뜻이다.

---

### A. `PRODUCT` — 상품의 «사실»

| 개념 | SmartStore | Coupang | LotteON | 필수도 | Own | InputMode | srcStatus | 저장 | 화면 | 참조 | 🔴자동수집 | 🔴끊긴 곳 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
상품명 | `originProduct.name` | `sellerProductName` | `spdNm` | 필수×3 | PRODUCT | VALUE | MANUAL | 상품 | 상품탭 | ✗ | ✅ 가능 | — |
판매가 | `originProduct.salePrice` | `items[].salePrice` | `slPrc` | 필수×3 | PRODUCT | VALUE | MANUAL | 상품+pricing | 상품탭 | ✗ | ✅ 가능 | 쿠팡만 10원단위 제약 |
재고 | `stockQuantity` | `items[].maximumBuyCount` | (단품) | 필수×3 | PRODUCT | VALUE | MANUAL | 상품 | 상품탭 | ✗ | ✅ 가능 | — |
대표이미지 | `images.representativeImage` | `items[0].images` | `itmImgLst` | 필수×3 | PRODUCT | VALUE | MANUAL | 상품 | 상품탭 | ✗ | ✅ 가능 | 롯데ON jpg/png 한정 |
상세설명 | `detailContent` | `items[].contents` | `epnLst` | 필수×3 | PRODUCT | VALUE | MANUAL | 상품+블록 | 상품탭 | ✗ | ✅ 가능 | 롯데ON 임시경로 차단 |
옵션/단품 | `optionCombinations` | `items[].attributes` | `itmLst` | 조건부×3 | PRODUCT | VALUE | MANUAL | 상품 | 상품탭 | ✗ | ✅ 가능 | 롯데ON 500개 상한 |
카테고리 | `leafCategoryId` | `displayCategoryCode` | `scatNo` | 필수×3 | CHANNEL_MAPPING | VALUE | — | 상품별 확정 | 있음 | ✗ | 🔴 불가(채널코드) | 3채널 코드체계 전부 다름 |
소재 | `notice.material` | notice 소재 | 고시항목 | 조건부×3 | PRODUCT | DETAIL_REF_ALLOWED | MANUAL | 상품 | 있음 | ✅ | ✅ 가능 | 롯데ON 은 텍스트로 합류 |
색상 | `notice.color` | attr 색상 | 고시항목 | 조건부×3 | PRODUCT | 🔴 채널별로 다름 | MANUAL | 상품 | 있음 | ✅ | ✅ 가능 | 🔴 쿠팡 구매옵션은 참조 **금지**(실측) |
사용연령 | `KIDS.recommendedAge` | notice | 고시항목 | 조건부 | PRODUCT | DETAIL_REF_ALLOWED | MANUAL | 상품 | 있음 | ✅ | 🟡 부분 | — |
취급방법 | `notice.caution` | notice | 고시항목 | 조건부 | PRODUCT | DETAIL_REF_ALLOWED | MANUAL | 상품 | 있음 | ✅ | 🟡 부분 | — |
품명 | `KIDS.itemName` | notice 품명 | 고시항목 | 조건부 | PRODUCT | DETAIL_REF_ALLOWED | MANUAL | 상품 | 있음 | ✅ | 🟡 부분 | 이름이 네이버 용어 |
모델명(고시) | `KIDS.modelName` | notice | 고시항목 | 조건부 | PRODUCT | DETAIL_REF_ALLOWED | MANUAL | 상품 | 있음 | ✅ | 🟡 부분 | 🔴 아래 카탈로그 모델명과 **다른 값** |
중량 | `KIDS.weight` | notice | 고시항목 | 조건부 | PRODUCT | DETAIL_REF_ALLOWED | MANUAL | 상품 | 있음 | ✅ | 🟡 부분 | — |
제조사 | `notice.manufacturer` | `manufacture`+notice | `mfcrNm` | 조건부×3 | PRODUCT→BRAND→SELLER | DETAIL_REF_ALLOWED | MANUAL | 상품/브랜드/설정 | 있음 | ✅ | 🟡 부분 | ✅ **유일하게 완성된 사다리** |
원산지 | `originAreaCode` | notice 원산지 | `oplcCd` | 필수×3 | PRODUCT→BRAND→SELLER | VALUE | MANUAL | 상품/브랜드/설정 | 있음 | ✗ | 🟡 부분 | 🔴 롯데ON 만 **코드**(OPLC_CD) |
수입사 | `originAreaInfo.importer` | — | — | 조건부(수입산) | PRODUCT | DETAIL_REF_ALLOWED | MANUAL | 상품 | 있음 | ✅ | 🔴 불가 | 네이버에만 개념 존재 |
브랜드 | (카탈로그) | `brand` | `brandNo` | 선택 | PRODUCT / CHANNEL_MAPPING | VALUE | — | 상품 / 폼 | 있음 | ✗ | ✅/🔴 | 🔴 롯데ON 은 **발급번호** — 같은 칸이 아니다 |

### B. `PRODUCT` — 규제(KC) 🔴 참조 대체 영구 금지

| 개념 | SmartStore | Coupang | LotteON | 필수도 | Own | InputMode | srcStatus | 저장 | 화면 | 참조 | 🔴자동수집 | 🔴끊긴 곳 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
KC 인증번호 | `productCertificationInfos[].certificationNumber` | notice KC | `sftyAthnNo` | 조건부×3 | PRODUCT | REQUIRES_INPUT | MANUAL | 상품 | 있음 | 🔴**금지** | 🔴 **불가** | — |
KC 인증기관명 | `productCertificationInfos[].name` | — | — | 조건부 | PRODUCT | REQUIRES_INPUT | MANUAL | 상품 | 있음 | 🔴금지 | 🔴 불가 | `1042`(공급자적합성)만 예외 |
KC 인증유형 | `KIDS.certificationType` | — | `sftyAthnTypCd` | 조건부 | PRODUCT | REQUIRES_INPUT | MANUAL | 상품 | 있음 | 🔴금지 | 🔴 불가 | 🔴 규제신고와 **다른 축**(P0-KC-12) |
KC 대상제외 신고 | `certificationTargetExcludeContent` | — | — | 조건부 | PRODUCT | VALUE | — | 상품 | 있음 | 🔴금지 | 🔴 불가 | 네이버에만 존재 |
KC 면제문구 | (고시 경유) | notice KC 기본값 | — | 조건부 | SELLER_SETTINGS | CHANNEL_DEFAULT | SETTINGS_DEFAULT | `seller_settings` | /settings | 🔴금지 | 🔴 불가 | 롯데ON 대응 없음 |
수입대행코드 | — | — | `impPrxCd` | 조건부 | CHANNEL_ONLY | REQUIRES_INPUT | — | 폼 | 있음 | ✗ | 🔴 불가 | 🔴 `default_import_proxy_code` 컬럼은 **HOLD·미사용** |

### C. `SELLER_SETTINGS` — 판매자가 한 번 정하고 반복

| 개념 | SmartStore | Coupang | LotteON | 필수도 | Own | InputMode | srcStatus | 저장 | 화면 | 참조 | 🔴자동수집 | 🔴끊긴 곳 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
A/S 연락처(고시) | `notice.afterServiceDirector` | notice | — | 필수 / 조건부 / — | SELLER_SETTINGS | VALUE | 🔴MANUAL | `seller_settings` | /settings | ✗ | 🔴 불가 | 🔴 네이버가 SETTINGS_DEFAULT 로 안 달림 |
A/S 전화번호 | `afterServiceInfo.afterServiceTelephoneNumber` | `companyContactNumber` | — | 필수 | SELLER_SETTINGS | VALUE | 🔴MANUAL | `seller_settings`/프로필 | /settings | ✗ | 🔴 불가 | 네이버 형식제약(`[0-9+-]`)만 별도 |
품질보증기준 | `notice.warrantyPolicy` | notice | — | 필수 / 조건부 / — | SELLER_SETTINGS | VALUE | 🔴MANUAL | `seller_settings` | /settings | ✗ | 🔴 불가 | 같은 끊김 |
원산지 기본값 | (폴백) | (폴백) | 🔴미사용 | 폴백 | SELLER_SETTINGS | VALUE | SETTINGS_DEFAULT | `seller_settings` | /settings | ✗ | 🔴 불가 | 🔴 롯데ON 만 이 폴백을 안 쓴다 |

### D. `SHIPPING_PROFILE` — 배송의 «의미»

| 개념 | SmartStore | Coupang | LotteON | 필수도 | Own | InputMode | srcStatus | 저장 | 화면 | 참조 | 🔴자동수집 | 🔴끊긴 곳 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
배송비 | `deliveryFee` | `deliveryCharge` | 🔴정책번호로 | 필수×3 | SHIPPING_PROFILE (+PRODUCT_OVERRIDE) | VALUE | 🔴MANUAL/AUTO | `coupang_seller_profiles` | /settings | ✗ | 🔴 불가 | 🔴 **롯데ON 만 금액이 아니라 «번호»** |
반품배송비 | `claimDeliveryInfo.returnDeliveryFee` | `returnCharge` | (정책 포함) | 필수 / 필수 / — | SHIPPING_PROFILE | VALUE | 🔴MANUAL | 프로필 | /settings | ✗ | 🔴 불가 | 쿠팡은 판매가 상한 검증 |
교환배송비 | `exchangeDeliveryFee` | `exchangeCharge` | — | 필수 / 선택 / — | SHIPPING_PROFILE | VALUE | 🔴MANUAL | 프로필 | /settings | ✗ | 🔴 불가 | — |
출고소요일 | (고정값) | `outboundShippingTimeDay` | `sndBgtNday` | 선택×3 | SHIPPING_PROFILE | CHANNEL_DEFAULT | DEFAULT_VALUE | 프로필 | /settings | ✗ | 🔴 불가 | 롯데ON 상한 3일 · 쿠팡 폴백 7일 |
평일 발송마감 | — | — | `nldySndCloseTm` | 필수 | SHIPPING_PROFILE | CHANNEL_DEFAULT | — | `lotteon_seller_settings` | 있음 | ✗ | 🔴 불가 | 🔴 하드코딩 기본값 `"1400"`(2곳) |
토요일 발송마감 | — | — | `satSndCloseTm` | 조건부 | SHIPPING_PROFILE | VALUE | — | `lotteon_seller_settings` | 있음 | ✗ | 🔴 불가 | — |
국내배송원가 | (가격계산) | (가격계산) | (가격계산) | — | SELLER_SETTINGS | VALUE | — | 프로필 | /settings | ✗ | 🔴 불가 | 🔴 «판매자 정보» 인데 배송프로필에 산다 |

### E. `CHANNEL_MAPPING` — 플랫폼이 «발급» 한 식별자 🔴 통합 금지 영역

> PIVOT-02 §1 이 못박은 경계: `"성남 물류센터"`(의미) ≠ `24496935`(쿠팡 식별자).
> 🔴 아래는 **전부 「Canonical 개념 1개 + 채널별 발급번호 N개」** 로 가야 하는 줄이다.

| 개념 | SmartStore | Coupang | LotteON | 필수도 | Own | InputMode | srcStatus | 저장 | 화면 | 🔴자동수집 | 🔴끊긴 곳 |
|---|---|---|---|---|---|---|---|---|---|---|---|
출고지 | `shippingAddressId` 🔴**실시간 조회** | `outboundShippingPlaceCode` | `owhpNo` | 필수×3 | CHANNEL_MAPPING | VALUE | 🔴MANUAL/AUTO/없음 | 조회 / 프로필 / `lotteon_seller_settings` | 읽기/설정/있음 | 🔴 불가 | 🔴 **저장 방식이 3채널 모두 다르다** |
반품지 | `returnAddressId` 🔴**실시간 조회** | `returnCenterCode` | `rtrpNo` | 필수×3 | CHANNEL_MAPPING | VALUE | 🔴같음 | 같음 | 같음 | 🔴 불가 | 같음 |
택배사(출고) | `deliveryCompany` | `deliveryCompanyCode` | `hdcCd` | 필수 / 필수 / 선택 | CHANNEL_MAPPING | VALUE | 🔴MANUAL/AUTO/없음 | `naver_delivery_company_code` / `delivery_company_code` / **미저장** | /settings ×2 · 폼 ×1 | 🔴 불가 | 🔴 롯데ON 만 저장소가 없다 |
택배사(반품) | `returnDeliveryCompanyPriorityType` | (동일) | `rtngHdcCd` | 필수 / — / 선택 | CHANNEL_MAPPING | VALUE | 🔴MANUAL | 🔴**Wing 계정 실시간 조회** | 없음 | 🔴 불가 | 네이버는 조회 실패와 미등록을 구분 |
배송비정책 | — | — | `dvCstPolNo` | — / — / 필수 | CHANNEL_MAPPING | VALUE | 없음 | `delivery_cost_policy_no` | 있음 | 🔴 불가 | 🔴 `4279402` = 이 값(확정) |
배송가능지역 | — | — | `dvRgsprGrpCd` | — / — / 필수 | CHANNEL_MAPPING | VALUE | 없음 | `delivery_region_group_code` | 있음 | 🔴 불가 | 🔴 autoPick 대상이 **아니다** — 늘 수동 |
반품지 주소·우편·명 | (주소록에 포함) | `returnAddress` `returnZipCode` `returnChargeName` | (반품지번호에 포함) | — / 필수 / — | CHANNEL_MAPPING | VALUE | AUTO | 프로필 | /settings | 🔴 불가 | 🔴 쿠팡만 «주소 원문» 을 따로 든다 |
거래처 | — | `vendorId` | `trGrpCd`+`trNo` | 필수 | COMMERCE_ACCOUNT | VALUE | — | `commerce_accounts` / 🔴207 조회 | 없음 | 🔴 불가 | 롯데ON 은 저장 안 하고 매번 조회 |
Wing 계정 | — | `vendorUserId` | — | 필수 | COMMERCE_ACCOUNT | VALUE | — | `commerce_accounts` | /settings | 🔴 불가 | — |

### F. `CHANNEL_ONLY` — 그 채널에만 있는 개념

| 개념 | 채널 | payload 키 | 필수도 | InputMode | 화면 | 🔴끊긴 곳 |
|---|---|---|---|---|---|---|
전시카테고리 | LotteON | `dcatLst` | 필수 | VALUE | 있음 | 표준/전시 2중 구조는 롯데ON 뿐 |
고시 품목코드 | LotteON | `pdItmsCd` | 필수 | VALUE | 있음(89 코드목록) | 품목 `23`=유아동 → KC 필수 |
고시 항목 | LotteON | `pdItmsArtlLst` | 필수 | VALUE | 있음 | 🔴 `pdArtlCd` 항목코드 **API 미제공** |
과세유형 | LotteON | `taxTypeCode` | 필수 | CHANNEL_DEFAULT | 있음 | 하드코딩 `"01"` |
판매기간 | LotteON | `slStrtDttm`/`slEndDttm` | 필수 | CHANNEL_DEFAULT | 자동 | — |
업체상품번호 | LotteON | `externalProductNo` | 선택 | VALUE | 있음 | — |
네이버 카탈로그 모델명 | SmartStore | `naverShoppingSearchInfo.modelName` | 조건부(KIDS) | REQUIRES_INPUT | 있음 | 🔴 참조 대체 **불가** · 고시 모델명과 별개 |
네이버쇼핑 노출 | SmartStore | `naverShoppingRegistration` | advisory | CHANNEL_DEFAULT | 없음 | Gate 제외 — 계정 상태 |
관부가세 | SmartStore | `customsTaxType` | 필수 | CHANNEL_DEFAULT | 없음 | 고정 `INCLUDED` |
미성년자 구매 | SmartStore | `minorPurchasable` | 필수 | CHANNEL_DEFAULT | 없음 | 고정 `true` |
배송유형/속성 | SmartStore | `deliveryType`/`deliveryAttributeType` | 필수 | CHANNEL_DEFAULT | 없음 | 고정 `DELIVERY`/`NORMAL` |
구매옵션 동적필드 | Coupang | `attributes[]` | 조건부 | 🔴DETAIL_REF_**FORBIDDEN** | 있음(카테고리별) | 실등록 거절 실측 |

---

## 4. 🔴 분류표가 «세어 낸» 것 — Phase B/C 입력값

### 4-1. 개념 중복은 **값** 이 아니라 **구조** 에 있다

조사 중 「출고지 쿠팡코드 ≠ 롯데ON번호이므로 중복이 아니다」라는 판정이 한 번
나왔다. 🔴 **그 판정은 질문을 잘못 읽은 것이다.** 착수 노트 §2-1 이 이미
그것을 예견했다(`:55-58`) — 값이 다른 것은 당연하고, Commerce-6 이 묻는 것은
**「같은 개념을 서로 다른 모양으로 N번 표현하고 있는가」** 다. 답은 **그렇다**:

```text
「출고지」 라는 하나의 개념이 지금 세 가지 «다른 모양» 으로 산다
  네이버   저장하지 않음 — 매번 주소록 조회                 (조회 방법)
  쿠팡     coupang_seller_profiles.outbound_shipping_place_code  (bigint 컬럼)
  롯데ON   lotteon_seller_settings.outbound_place_no             (text 컬럼, 별 테이블)

「택배사」 는 네 가지
  네이버   naver_delivery_company_code   ← 🔴 «coupang_» 테이블 안에 산다
  쿠팡     delivery_company_code
  롯데ON   저장소 «없음» — 폼에만 산다
  반품택배사 Wing 실시간 조회
```

🔴 `coupang_seller_profiles` 가 **네이버 채널ID를 품고 있다**는 것이 PIVOT-02 §1 이
말한 오염의 가장 선명한 증거다. 이름은 쿠팡인데 내용은 3채널이다.

### 4-2. 「지금 자동으로 채울 수 있는 것」은 생각보다 **적다**

12열을 전부 세면:

```text
✅ Extension 이 수집 가능      상품명 · 가격 · 재고 · 이미지 · 상세설명 · 옵션 · 소재 · 색상
🟡 부분적으로 가능             품명 · 모델명 · 중량 · 사용연령 · 취급방법 · 제조사 · 원산지
🔴 «원리상» 불가              KC 전부 · 채널 발급 ID 전부 · 셀러 사업자 정보 전부 ·
                             배송비/반품비 정책 · 카테고리 코드
```

🔴 **채널 발급 ID 는 Extension 이 아무리 좋아져도 «상품 페이지» 에 없다.**
그것은 판매자센터에 있다. 따라서 Phase B 가 설계할 「부족 필드만 표시」 UX 는
**「Extension 이 채울 것」과 「셀러가 판매자센터에서 가져와야 할 것」을 처음부터
다른 줄로** 그려야 한다. `ReadinessItem.externalHref` 가 이미 그 자리다.

### 4-3. Phase C(중복 통합) 후보 — 🔴 **삭제하지 않았다**

| # | 후보 | 판정 | 🔴 전제 |
|---|---|---|---|
C-1 | `coupang_seller_profiles.naver_delivery_company_code` | 이름이 틀렸다 — 쿠팡 테이블의 네이버 값 | 이름 변경도 Production 확인 후 |
C-2 | 출고지/반품지 3채널 | Canonical 개념 1 + 발급번호 N 으로 | 🔴 쿠팡 실등록 회귀 필수(PIVOT-02 §9 004) |
C-3 | `lotteon_seller_settings` 배송 4값 | CHANNEL_MAPPING 으로 흡수 대상 | 🔴 **행 수 미확인** — 0행 전제는 PIVOT-02 시점 실측이다 |
C-4 | `default_import_proxy_code` | HOLD 유지 | API contract 미확인 그대로 |
C-5 | 국내배송원가·마진·반올림 | 배송프로필이 아니라 SELLER_SETTINGS | 059 가 이미 길을 냈다 |

🔴 **어느 것도 이번에 실행하지 않았다.** 고정 원칙 ① 그대로 —
`lotteon_seller_settings` 를 지우거나 합치지 않았고, Production 데이터 호환성을
확인한 바 없다.

---

## 5. 🔴 이번에 확인하지 «못한» 것

추측으로 채우지 않았다.

```text
🔴 DB 실제 행/값            lotteon_seller_settings 행 수 · seller_settings 값 ·
                           coupang_seller_profiles 3행의 현재 내용 — 전부 «코드만» 읽었다
🔴 롯데ON 구매옵션 InputMode  실등록이 거기까지 간 적이 없다(PIVOT-02 §4 그대로)
🔴 pdArtlCd 항목코드         롯데ON API 미제공 — 판매자센터 실물 필요
🔴 쿠팡 카테고리 동적필드     카테고리마다 달라 「전수」가 성립하지 않는다.
                           카테고리 하나를 고정해야 셀 수 있다
🔴 11번가                   PlatformId 에는 있으나 이번 3채널 범위 밖
🔴 값이 «같은지»             출고지 쿠팡코드와 롯데ON번호가 같은 물류센터를 가리키는지는
                           DB·판매자센터 대조 없이는 알 수 없다
```

---

## 6. Phase B 가 «이 문서에서» 받아야 할 것

```text
① 축 셋(FieldSource · InputMode · sourceStatus)을 «합치지 않는다» — §1-1
② PIVOT-02 Migration 001·002 는 «완료» 다. 다시 계획하지 않는다 — §1-2
③ 롯데ON 폼-설정 분리는 «설계» 다. 연결하는 것이 수정이 아니다 — §1-3
④ 고칠 곳은 셋이다 — §2
     네이버 sourceStatus 1값 고정        readiness.ts:250
     롯데ON readiness 경로 부재          진입점 없음
     화면의 「조회 실패 ≠ 설정 없음」      Panel.tsx:643-646 (서버는 이미 구분함)
⑤ Canonical 후보는 CHANNEL_MAPPING 줄 전체다 — §3-E · §4-1
⑥ 「자동수집 가능」은 12열 하나뿐이고, 채널 발급 ID 는 전부 🔴 다 — §4-2
```

🔴 **Phase B 설계 전까지 DB 변경·중간 구현 없음.** 이 문서까지가 Phase A 다.
