# Commerce-6 Phase B — Canonical Concept 설계 (배송·운영 6개)

> CTO(2026-09-26). **코드 0 · DB 0 · migration 0 · 삭제 0.** 논리 모델과 매핑표뿐이다.
> 전제는 Phase A 결과(`commerce-6-phase-a-field-census.md`)다.

---

## 0. 🔴 이 Phase 가 «만들지 않은» 것

지시받은 금지선을 먼저 적는다.

```text
❌ CanonicalSource · FieldOrigin · AutoFillStatus  — 새 축을 만들지 않았다
❌ DB migration · 테이블 삭제 · 필드 이동
❌ lotteon_seller_settings 에 손대는 일
❌ coupang_seller_profiles 구조 변경
```

그리고 **만들려던 축이 이미 있었다.** 그것이 이 Phase 의 첫 결론이다.

---

## 1. 🔴 Canonical 축은 이미 코드에 있다 — `LotteOnSellerSettingUsage`

```typescript
// packages/listing/src/lotteon/seller-settings.ts:127-131
export type LotteOnSellerSettingUsage =
  | "AUTO_APPLIED"          // 공통 의미 · 채널 중립 → 그대로 적용된다
  | "SETTINGS_REQUIRED"     // 같은 개념인데 설정이 비어 있다
  | "CHANNEL_CODE_DIFFERS"  // 🔴 개념은 공통, 값은 채널 발급 → binding 이 필요하다
  | "NO_SETTING_CONCEPT"    // 공통 개념 자체가 없다 → CHANNEL_ONLY
```

이 네 값이 **Phase B 가 답해야 할 질문 그 자체**다 —
「왜 Common 인가」와 「왜 이 Commerce 에서는 별도 binding 이 필요한가」.

`describeLotteOnSellerSettings()` 가 배송 6개를 이미 이 축으로 분류했고
(`seller-settings.ts:191-245`), 테스트가 고정하고 있다
(`seller-settings.test.ts:64` · `commerce-tab-alignment.test.ts:802-804`).

### 🔴 그런데 두 가지가 부족하다

```text
① 롯데ON «전용» 이다        쿠팡 대응물(coupang/_lib/settings-status.ts)은
                          missing[] / recommended[] 문자열 배열뿐 — 축이 없다
② «설명» 함수다             저장 모델이 아니라 화면에 그릴 표를 만드는 함수다.
                          binding 을 «담는» 자리는 아직 없다
```

**Phase B 의 권고는 「새 축 정의」가 아니라 「이 축의 공통 승격」이다.**

---

## 2. 🔴 Canonical binding 의 «원형» 도 이미 있다 — 그리고 예상과 반대편에 있다

착수 노트가 「새 커머스니까 새 설정 테이블을 만든 나쁜 예」로 지목한
`lotteon_seller_settings` 가, 실은 **의미와 식별자를 분리한 유일한 저장소**다.

```sql
-- 058_lotteon_seller_settings.sql:24-42
--    그래서 설정 화면은 숫자를 입력받지 않고 **API Master 목록에서 고르게**
--    한다(150 · 166 · 89).
--    사람은 「서울 ○○센터」를 고르고, 저장되는 것은 그 번호다.
  outbound_place_no text,          -- owhpNo        출고지번호
  ...
-- 고른 «순간의» 표시 이름. 번호만 저장하면 설정 화면이 「12345」만 보여주게
-- 되고, 셀러는 그게 어느 센터인지 알 수 없다. 🔴 이 이름은 표시 전용이고
-- 등록 payload 에는 절대 들어가지 않는다 — payload 로 가는 것은 번호뿐이다.
  outbound_place_label text,
```

🔴 이것이 PIVOT-02 §1 이 요구한 바로 그 경계다 —
`"성남 물류센터"`(의미) ≠ `24496935`(식별자).
**`no` + `label` 쌍이 Canonical binding 의 원형이다.**

대조:

```text
롯데ON   outbound_place_no + outbound_place_label     ← 번호 + 의미, 쌍으로 저장
쿠팡     outbound_shipping_place_code (bigint)        ← 🔴 번호만. 이름조차 없다
네이버   (저장 없음)                                   ← 매번 조회, 번호만 payload
```

**구조가 더 나쁜 쪽은 쿠팡이다.** 문제는 롯데ON 이 테이블을 새로 만든 것이
아니라, 그 좋은 구조가 **한 채널 전용 테이블에 갇힌 것**이다.

---

## 3. 🔴 출고지 — Canonical 「의미 정보」를 우리가 **갖고 있지 않다**

지시받은 설계안:

```text
CanonicalOutboundPlace
    ├─ canonical identity
    ├─ address / contact 등 의미 정보     ← 🔴 이 칸을 채울 데이터가 «없다»
    └─ channelBindings { Naver, Coupang, LotteON }
```

전수 확인 결과:

| 채널 | 우리가 «저장» 하는 것 | 주소 | 이름 |
|---|---|---|---|
쿠팡 | `outbound_shipping_place_code` (bigint) | ✗ | ✗ |
네이버 | (없음 — 매번 주소록 조회) | ✗ | ✗ |
롯데ON | `outbound_place_no` + `outbound_place_label` | ✗ | ✅ |

**세 채널 중 출고지 주소를 저장하는 곳은 한 곳도 없다.**

### 🔴 다만 의미 정보의 «출처» 는 실재한다 — 저장하지 않을 뿐이다

```typescript
// apps/admin/src/app/api/coupang/_lib/shipping-place.ts:47-66
function toOption(item: RawShippingPlace): ShippingPlaceOption {
  ...
  return { code, name, countryCode: address?.countryCode ?? null, usable, createdAt, raw };
}
```

쿠팡 실시간 조회는 **이름 · 국가코드 · 사용가능여부**를 준다. 그리고
`selectOutboundShippingPlace()`(같은 파일 `:94-147`)는 **상품 원본 URL 의 호스트로
소싱 국가를 추정해 그 국가의 출고지를 고른다** — 이것은 순수한 «의미» 규칙이다.

🔴 **그 의미가 매 등록마다 계산되고 버려진다.** Canonical 의 몸이 될 재료는
거기에 있다.

### 판정

```text
CanonicalOutboundPlace      구조상 «설계 가능» (binding 3개는 실재한다)
       ├─ identity          🟡 지금은 「셀러가 고른 한 곳」 이상을 말할 근거가 없다
       ├─ 의미 정보          🔴 저장된 것이 없다 — 쿠팡 조회 응답이 유일한 후보
       └─ channelBindings   ✅ 세 채널 모두 발급 ID 가 실재한다
```

🔴 **「구조상 가능성」으로만 기록한다.** 의미 정보 칸을 지금 만들면 채울 값이 없다.

---

## 4. 반품지 — 유일하게 **의미 정보가 실재하는** 개념

```text
쿠팡     return_center_code + 주소 5값(return_charge_name · company_contact_number ·
         return_zip_code · return_address · return_address_detail)
         🔴 payload 에 «매번 전부» 전송된다(build-payload.ts:1599-1604)
네이버   refundAddressBookNo — 번호만. 주소는 네이버가 갖고 있다
롯데ON   rtrpNo + return_place_label — 번호 + 이름
```

🔴 출고지와 **비대칭**이다. 쿠팡은 반품지만 주소 원문을 우리가 소유하고,
출고지는 코드만 갖는다. 같은 「장소」인데 한쪽만 의미를 들고 있다.

### 판정

```text
CanonicalReturnPlace
       ├─ 의미 정보          ✅ 실재한다 — 단 쿠팡 반품지에만
       └─ channelBindings   ✅ 세 채널 모두

🔴 그러나 쿠팡을 «기준» 으로 삼을 수 없다. 쿠팡이 가진 주소가 네이버·롯데ON
   판매자센터에 등록된 장소와 같은 곳인지 확인할 방법이 코드에 없다.
   → Canonical identity 는 셀러가 «선언» 해야 하는 것이지 우리가 매칭할 수 없다.
```

---

## 5. 🔴 배송비 정책 — **같은 개념이 아니다** (확정)

지시대로 「같다고 가정하지 않고」 payload 근거로만 판정했다.

| 채널 | 우리 쪽 값 | payload | 성격 |
|---|---|---|---|
쿠팡 | `deliveryCharge: number` | `deliveryCharge` + `deliveryChargeType` | 🔴 **우리가 금액을 정해 보낸다** |
네이버 | `sellerDeliveryFee: number` | `deliveryFee.baseFee` + `deliveryFeeType` | 🔴 **우리가 금액을 정해 보낸다** |
롯데ON | `deliveryCostPolicyNo: string` | `dvCstPolNo` | 🔴 **채널이 가진 정책을 가리킨다** |

`packages/listing/src/lotteon/build-payload.ts` 전체에 **배송비 «금액» 을 보내는
키가 하나도 없다.**

### 🔴 본질은 「금액 vs 번호」가 아니라 「누가 정하는가」다

```text
쿠팡 · 네이버     배송비 결정 주체 = 우리      → 값을 계산해 매 상품 전송
롯데ON           배송비 결정 주체 = 채널      → 셀러가 판매자센터에 만든 정책을 «지목»
```

값 타입이 다른 것은 결과이고, 원인은 **결정 권한의 위치**다.
코드가 이미 같은 결론을 적어 두었다:

> `seller-settings.ts:157` — 「셀러 설정은 배송비를 **금액**으로 갖고 있고, 롯데ON은
> 판매자센터에 등록된 **정책 번호**를 요구합니다 — 같은 개념이 아니라 금액에서
> 번호를 만들 수 없습니다.」

### 🔴 확인하지 못한 것 — 정직하게 남긴다

우리 파서가 166 응답에서 읽는 것은 `dvCstPolNo` 와 `dvCstPolNm` 둘뿐이다
(`delivery-settings/route.ts:226-230`, 동적 파싱).
**「롯데ON 정책에 금액이 없다」는 뜻이 아니라 「우리가 안 읽는다」는 뜻이다.**
정책 안의 금액이 쿠팡·네이버의 `deliveryCharge` 와 같은 값이어야 하는지는 **미확인**.

### 판정

```text
Canonical 「배송비」        ✅ 개념으로는 하나다(고객이 내는 배송 대가)
       ├─ 표현 A  금액      쿠팡 · 네이버
       └─ 표현 B  정책참조   롯데ON

🔴 통합 «금지» — 금액에서 정책번호를 만들 수 없고, 그 반대도 미확인이다.
   binding 은 「값」이 아니라 「결정 주체」를 기록해야 한다.
```

---

## 6. 택배사 — 소유 경계가 흔들린 이유는 «기록되지 않았다»

### 6-1. `naver_delivery_company_code` 가 왜 쿠팡 테이블에 있는가

마이그레이션 주석은 **패턴의 동형성**만 말한다:

```sql
-- 021_brand_origin_price_and_naver_delivery.sql
-- coupang_seller_profiles.naver_delivery_company_code: Naver 출고 택배사 코드.
-- Coupang의 delivery_company_code와 동일한 패턴(공식 조회 API가 없어 판매자가
-- Settings에서 직접 입력) — Naver 쪽은 지금까지 이 입력 필드 자체가 없어서
-- BLOCKED였다.
```

커밋 `00c6ddf` 메시지도 같은 말만 한다.

🔴 **「왜 새 테이블을 만들지 않았는가」에 대한 기록은 없다.**
소유권을 판단한 흔적이 없다 — 「쿠팡과 같은 모양이니 옆에 붙인다」였다.

### 6-2. 그런데 설정 화면은 원칙을 «이미 말하고 있었다»

```text
settings/page.tsx:1496
  "배송비/출고 소요일은 두 플랫폼에 동일하게 적용됩니다 — 택배사만 플랫폼별로 따로 관리"
settings/page.tsx:1547
  "플랫폼별로 요구하는 코드 체계가 달라 위 쿠팡 택배사와 별도로 저장됩니다"
```

🔴 즉 이 저장소는 **「택배사는 채널마다 코드체계가 다르다」를 이미 설계 전제로
갖고 있었다.** 컬럼이 두 개인 것은 오염이 아니라 그 전제의 «올바른» 귀결이다.
**틀린 것은 그 두 컬럼이 «쿠팡» 이라는 이름의 테이블에 있다는 것뿐이다.**

### 6-3. 3채널 표현

| 채널 | 값의 성격 | 허용값 | 저장 | payload |
|---|---|---|---|---|
쿠팡 | 정적 코드 | 11개 (`CJGLS` `HANJIN` …) — 조회 API 없음, 문서 참조표 | `delivery_company_code` | `deliveryCompanyCode` |
네이버 | 🔴 자유 문자열 (`"CJ대한통운"` 추정) | 검증 없음 · 조회 API 없음(전수 확인) | `naver_delivery_company_code` | `deliveryInfo.deliveryCompany` |
롯데ON | 공통코드 `DV_CO_CD` | 🔴 **89 실시간 조회** | **저장소 없음** — 폼에만 | `hdcCd` |
네이버(반품) | 우선순위 타입 | 🔴 **실시간 조회** `GET /v2/product-delivery-info/return-delivery-companies` | 저장 안 함 | `returnDeliveryCompanyPriorityType` |
롯데ON(반품) | 같은 `DV_CO_CD` | 출고와 별도 선택 | 저장소 없음 | `rtngHdcCd` |

### 판정

```text
Canonical 「택배사」        ✅ 개념은 하나(물류사)
       └─ channelBindings  🔴 네 가지 «다른 종류» 의 값이 필요하다
                              정적코드 · 자유문자열 · 채널공통코드 · 우선순위타입

🔴 그러므로 binding 은 「채널 → 문자열」이 아니라
   「채널 → {값, 값의 종류, 획득 방법(저장/조회)}」 이어야 한다.
   네이버 반품 택배사처럼 «저장하지 않고 매번 조회» 하는 것도 binding 의 한 형태다.
   (PIVOT-02 §3-3 이 이미 「조회 방법도 표현할 수 있어야 한다」고 적었다)
```

---

## 7. 🔴 배송 운영 주체 — 개념은 실재하나 값이 **하나뿐이고, 채널마다 다르게 말한다**

| 채널 | payload | 값 | 성격 |
|---|---|---|---|
쿠팡 | `deliveryMethod` | `"AGENT_BUY"` (해외구매대행) | 🔴 하드코딩 |
쿠팡 | `deliveryChargeType` | 금액에서 파생 | 계산 |
네이버 | `deliveryType` / `deliveryAttributeType` | `"DELIVERY"` / `"NORMAL"` | 🔴 하드코딩 |
롯데ON | `dvProcTypCd` / `dvPdTypCd` / `dvMnsCd` | `"LO_ENTP"`(업체배송) / `"GNRL"` / `"DPCL"` | 🔴 하드코딩 |
롯데ON | `dmstOvsDvDvsCd` | `"DMST"` (**국내**) | 🔴 하드코딩 |

### 🔴 두 가지가 드러난다

**① 설정 컬럼이 살아 있는데 아무 payload 에도 가지 않는다**

```text
coupang_seller_profiles.delivery_method   존재 · 읽기 · 쓰기 · 설정화면 입력칸 · 요약카드 표시
        ↓
   payload 소비처 «0»    — 쿠팡은 build-payload.ts:1591 에서 "AGENT_BUY" 를 하드코딩한다
```

셀러가 설정 화면에서 「구매대행」을 입력하지만 **어느 채널에도 전달되지 않는다.**

**② 같은 상품을 두 채널에 서로 다르게 선언하고 있다**

```text
쿠팡     deliveryMethod = "AGENT_BUY"    해외구매대행
롯데ON   dmstOvsDvDvsCd = "DMST"         국내
```

🔴 어느 쪽이 맞는지 **판정하지 않는다** — 채널별 신고 의미가 같은지 확인한 바 없다.
그러나 **한 사업모델이 두 채널에 다르게 신고되고 있다는 사실 자체**를 기록한다.

### 판정

```text
Canonical 「배송 운영 주체」   🟡 개념은 실재한다(누가 배송을 수행/신고하는가)
                            그러나 현재 값이 사업모델당 하나뿐이라 «저장할 이유가 없다»
                            🔴 PIVOT-02 §10 ④ — 없는 요구로 스키마를 만들지 않는다

지금 해야 할 일은 저장소 신설이 아니라
  ① delivery_method 컬럼이 «쓰이지 않는다» 는 사실의 기록
  ② AGENT_BUY ↔ DMST 불일치의 의미 확인   ← 둘 다 Phase C 이후
```

---

## 8. A/S · 품질보증 — 가장 깨끗한 Canonical, 그러나 채널 하나가 빠진다

```text
seller_settings (059)   manufacturer · as_contact_number · quality_guarantee ·
                        kc_exemption_text · default_country_of_origin
        ↓
쿠팡     ✅ sellerConfig.asContactNumber / qualityGuarantee → notice
네이버   ✅ notice.afterServiceDirector / warrantyPolicy + afterServiceInfo
롯데ON   🔴 «쓰지 않는다» — 87 payload 에 대응 자리가 없다(grep 전수 확인)
```

🔴 Phase A 중간 조사에서 「롯데ON도 A/S·품질보증을 쓴다」는 보고가 있었으나
**직접 확인 결과 틀렸다.** `asContactNumber` / `qualityGuarantee` 의 소비처는
쿠팡·네이버뿐이다. 이 문서가 그것을 정정한다.

### 🔴 그리고 `manufacturer` 는 «제조사» 가 아니다

```text
build-context.ts:262-265
  seller_settings.manufacturer 에 실제로 들어 있는 것은 «판매 사업자»(규하맘샵)이고,
  판매자라는 이유만으로 제조자가 되지 않는다. 컬럼 이름이 legacy 라 그렇게 보였을 뿐이다.
```

같은 정정이 **3채널 전부**에 들어가 있다
(`coupang/build-payload.ts:1349` · `naver/_lib/resolve-context.ts:205` · 롯데ON).
`resolveManufacturer()` 의 입력에 `sellerSettingsManufacturer` 는 **아예 없다**.

🟡 다만 `coupang/register/route.ts:504` 가 아직 `manufacturer: sellerSettings.manufacturer`
를 넘긴다. 사다리에서는 빠졌고 고시 `KNOWN_VALUE` 경로에만 남은 것으로 보이나
**소비처를 끝까지 확정하지 못했다** — 「끊어도 된다」고 말하지 않는다.

### 판정

```text
Canonical 「A/S 연락처」 · 「품질보증기준」   ✅ 진짜 Common 이다
   근거  채널 발급 ID 가 아니다 · 코드체계가 없다 · 셀러가 한 번 정하면 끝난다
   🔴 롯데ON 은 «개념 자체가 없다»(NO_SETTING_CONCEPT) — 억지로 넣지 않는다

Canonical 「판매 사업자」   🔴 seller_settings.manufacturer 의 «실제 내용» 이다
   이름이 legacy 다. 「제조사」(PRODUCT)와 다른 개념이고, 이미 모든 사다리에서 분리됐다
```

---

## 9. 🔴 Canonical ≠ 자동수집 — 두 축을 따로 적는다

지시대로 **절대 합치지 않는다.**

| Canonical Concept | COMMON 관리 가능 | Extension 자동수집 | 획득 경로 |
|---|---|---|---|
출고지 | ✅ YES (binding 구조로) | 🔴 **NO** | 채널 판매자센터 · 쿠팡 조회 API |
반품지 | ✅ YES | 🔴 **NO** | 채널 판매자센터 · 쿠팡은 셀러 직접입력 |
배송비(금액) | ✅ YES | 🔴 **NO** | 셀러 설정 |
배송비 정책(롯데ON) | 🟡 binding 으로만 | 🔴 **NO** | 롯데ON 판매자센터 (166) |
택배사 | ✅ YES (binding 구조로) | 🔴 **NO** | 셀러 입력 · 롯데ON 은 89 조회 |
배송 운영 주체 | 🟡 값이 하나뿐 | 🔴 **NO** | 사업모델 상수 |
A/S 연락처 | ✅ YES | 🔴 **NO** | 셀러 사업자 정보 |
품질보증기준 | ✅ YES | 🔴 **NO** | 셀러 사업자 정보 |

🔴 **이 표의 자동수집 칸이 전부 NO 다.** 배송·운영 정보는 «상품 페이지에 없다».
Extension 이 아무리 좋아져도 이 여덟 줄은 채워지지 않는다.

그러므로 §13 목표 UX(「부족 필드만 표시」)는 처음부터 **두 줄로** 그려야 한다:

```text
「Extension 이 채울 것」          상품의 사실 — 소재 · 색상 · 이미지 · 가격 …
「셀러가 가져와야 할 것」          채널 발급 ID · 사업자 정보 · 배송 정책
                                 → ReadinessItem.externalHref 가 이미 그 자리다
```

---

## 10. 최종 매핑표 (지시 형식) — 🔴 `?` 를 추측으로 채우지 않았다

| Canonical Concept | 공통 의미 | Naver 표현 | Coupang 표현 | LotteON 표현 | 자동수집 | 현재 저장소 | 통합 후보 |
|---|---|---|---|---|---|---|---|
**출고지** | 🔴 저장된 의미 없음 (쿠팡 조회에 `name`·`countryCode` 존재, 버려짐) | `shippingAddressId` — 매번 조회 | `outboundShippingPlaceCode` bigint | `owhpNo` + `outbound_place_label` | NO | 쿠팡: 프로필 / 네이버: 없음 / 롯데ON: 전용표 | 🟡 **구조상 가능** — binding 3개 실재. 의미칸은 비어 있음 |
**반품지** | ✅ 주소·연락처·명칭 (쿠팡만) | `returnAddressId` — 매번 조회 | `returnCenterCode` + 주소 5값 (payload 매번 전송) | `rtrpNo` + `return_place_label` | NO | 쿠팡: 프로필 / 네이버: 없음 / 롯데ON: 전용표 | 🟡 **구조상 가능** — 단 쿠팡 주소가 타 채널 장소와 같은 곳인지 확인 불가 |
**배송비** | ✅ 고객이 내는 배송 대가 | `deliveryFee.baseFee` (금액) | `deliveryCharge` + `deliveryChargeType` (금액) | 🔴 `dvCstPolNo` (정책 참조) | NO | 쿠팡/네이버: `delivery_charge` / 롯데ON: `delivery_cost_policy_no` | 🔴 **통합 금지** — 결정 주체가 다르다. 금액↔번호 변환 불가 |
**택배사** | ✅ 물류사 | `deliveryCompany` (자유문자열) | `deliveryCompanyCode` (정적코드 11종) | `hdcCd` (공통코드 `DV_CO_CD`, 실시간 조회) | NO | 쿠팡·네이버: `coupang_seller_profiles` 두 컬럼 / 롯데ON: **저장소 없음** | 🟡 binding 구조 필요 — 값의 «종류» 가 4가지 |
**배송 운영주체** | 🟡 누가 배송을 수행/신고하는가 | `deliveryType`=`DELIVERY` (고정) | `deliveryMethod`=`AGENT_BUY` (고정) | `dvProcTypCd`=`LO_ENTP` · `dmstOvsDvDvsCd`=`DMST` (고정) | NO | `delivery_method` 컬럼 존재 — 🔴 **payload 소비처 0** | 🔴 **만들지 않는다** — 값이 하나뿐. 대신 ①미사용 컬럼 ②AGENT_BUY↔DMST 불일치를 기록 |
**A/S** | ✅ 판매자 A/S 연락처 | `afterServiceDirector` + `afterServiceTelephoneNumber` | notice A/S | 🔴 **개념 없음** | NO | `seller_settings.as_contact_number` | ✅ **이미 통합돼 있다**(059) — 할 일 없음 |
**품질보증** | ✅ 품질보증기준 | `notice.warrantyPolicy` | notice 품질보증 | 🔴 **개념 없음** | NO | `seller_settings.quality_guarantee` | ✅ **이미 통합돼 있다**(059) |

---

## 11. Phase B 완료 기준에 대한 답

> 「이 필드는 왜 Common 인가?」와 「이 Commerce 에서는 왜 별도 binding 이 필요한가?」

| Concept | 왜 Common 인가 | 왜 binding 이 필요한가 |
|---|---|---|
출고지 | 셀러의 물류 출발지는 채널과 무관한 «사실» 이다 | 세 채널이 **각자 발급한 번호**를 요구한다. 코드체계가 다르고 서로 변환 불가 |
반품지 | 같음 | 같음. 쿠팡만 주소 원문을 추가로 요구한다 |
배송비 | 고객이 내는 대가라는 «의미» 는 하나다 | 🔴 쿠팡·네이버는 우리가 금액을 정하고, 롯데ON은 채널 정책을 가리킨다 — **결정 주체가 다르다** |
택배사 | 물류사는 채널과 무관한 실체다 | 정적코드 / 자유문자열 / 채널공통코드 / 실시간조회 — **값의 종류가 4가지** |
배송 운영주체 | 사업모델 하나가 모든 채널에 같게 적용된다 | 🔴 binding 이 필요 없다(전부 고정값). 대신 **신고 내용이 채널마다 다르다**는 문제가 남는다 |
A/S · 품질보증 | 셀러 사업자 정보다. 코드체계가 없다 | 🔴 binding 이 «필요 없다». 롯데ON은 개념 자체가 없어 빈다 |

---

## 12. 🔴 확인하지 못한 것

```text
🔴 DB 실제 행/값               Phase A 와 동일 — 코드만 읽었다
🔴 166 정책 «안» 의 금액        우리 파서가 no/name 만 읽는다. 정책에 금액이 없다는 뜻이 아니다
🔴 AGENT_BUY ↔ DMST           두 신고가 같은 뜻인지 · 어느 쪽이 맞는지 확인한 바 없다
🔴 coupang register:504        sellerSettings.manufacturer 의 최종 소비처를 끝까지 못 쫓았다
🔴 네이버 택배사 값의 형식       "CJ대한통운" 인지 코드인지 — placeholder 로만 추정
🔴 쿠팡 11개 택배사 코드         문서 사이트 봇 차단으로 원문 미확인(코드 주석의 자기 고백)
🔴 afflTrCd                   150/166 이 요구하는 소속거래처코드의 정체 미확정(route.ts:27-29)
🔴 장소의 «동일성»              쿠팡 출고지와 롯데ON 출고지가 같은 곳인지 코드로 알 수 없다
```

---

## 13. Phase C 가 이 문서에서 받는 것

```text
① 새 축을 만들지 않는다 — LotteOnSellerSettingUsage 4값을 공통 승격한다      §1
② binding 의 원형은 no + label 쌍이다. 롯데ON 이 이미 갖고 있다              §2
③ 출고지 Canonical 은 «의미칸이 빈 채로» 설계된다 — 지금 채울 값이 없다        §3
④ 배송비는 통합 금지. binding 이 기록할 것은 값이 아니라 «결정 주체» 다        §5
⑤ 택배사 binding 은 {값, 종류, 획득방법} 세 칸이다 — 조회도 binding 이다      §6
⑥ delivery_method 컬럼은 payload 소비처가 0 이다                          §7
⑦ A/S·품질보증은 059 로 «이미 통합됐다». Phase C 대상이 아니다              §8
⑧ 자동수집 칸은 8줄 전부 NO 다 — UX 를 두 줄로 그려야 한다                  §9
```

🔴 **DB 변경·삭제·이동 0.** `lotteon_seller_settings` 그대로, `coupang_seller_profiles`
그대로. Phase C 는 실제 중복 구조와 통합 후보를 다루되, 위 §12 의 미확인 목록을
먼저 실측으로 닫아야 한다.
