# Commerce-6 Phase D — Canonical 구조 · 최소 변경 설계

> CTO(2026-09-26). **코드 0 · DB 0 · migration 0 · 삭제 0 · UI 0.**
> C-1(Production DB)은 `UNVERIFIED` 로 두고 진행했다 — 값을 얻으려 CEO 를 부르지 않았다.
>
> 전제: Phase A(`…field-census`) · B(`…canonical-concepts`) · C(`…integration-candidates`).

---

## 0. 🔴 먼저 — 설계의 전제 하나가 틀렸다

이 Phase 의 장기 목표는 「Chrome Extension → Canonical → Commerce 재사용」이다.
그 전제를 확인했다.

```text
manifest.json                  0건 (node_modules 제외)
extension/ · chrome-extension/ 없음
chrome.runtime · manifest_version  0건
packages/browser               Playwright 자동화 코어다 — 브라우저 확장이 «아니다»
```

🔴 **Chrome Extension 은 저장소에 존재하지 않는다.** 지금 정보를 수집하는 것은
`packages/crawler`(Playwright + JSON-LD/Microdata/OpenGraph/DOM)다.
그리고 `docs/shopify-extraction-strategy.md` 의 결론은
**「Extension 이 필요한 게 아니라 크롤러 개선(JSON 우선 경로)」** 이다.

그러므로 이 문서는 12열을 「Extension 자동수집」이 아니라
**「수집기(crawler)가 «지금» 뽑고 있는가」** 로 읽는다. 없는 자산을 설계 전제로
삼지 않는다.

### 수집기가 «실제로» 뽑는 것 (코드 확인)

```text
✅ 뽑는다   title · brand · price · regularPrice(Shopify) · sku · description ·
            material · color · recommendedAge · careInstructions · countryOfOrigin ·
            manufacturer · optionGroups/variants(Shopify 거의 전부, 그 외 부분) ·
            breadcrumbPath · jsonLdCategory · shopifyTags

🔴 안 뽑는다  itemName · modelName · weight · importer ·
            childCertification(번호·기관·취득일) · certificationType ·
            returnPolicy · shippingFee · stockQuantity · certification

🔴 «있을 수 없다»  판매자 사업자명 · A/S 연락처 · 품질보증기준 ·
            출고지/반품지 주소 · 택배사 · 배송비 정책 · 채널 발급 ID 전부
            → 상품 페이지가 아니라 판매자센터에 있다
```

🔴 크롤러는 **판매자 정보를 수집하는 코드가 아예 없다.** Shopify 의 `vendor` 는
브랜드명이지 판매자가 아니다(`shopify-product-json.ts:124`).

---

## 1. ① Canonical 구조

### 1-1. 형태

```text
Canonical Concept
   ├─ Common Value          채널과 무관한 «업무 의미». 우리가 소유한다.
   └─ Channel Binding[]     채널이 «발급» 한 값. 채널 수만큼 있고 서로 변환되지 않는다.
        ├─ channel          smartstore | coupang | lotteon
        ├─ value            발급된 번호/코드/문자열 (없으면 null)
        ├─ kind             STATIC_CODE | FREE_TEXT | CHANNEL_COMMON_CODE | ADDRESS_BOOK_NO
        └─ acquisition      STORED | FETCHED_EACH_TIME   ← 🔴 「조회」도 binding 의 한 형태다
```

`acquisition` 은 새 축이 아니다 — PIVOT-02 §3-3 이 이미
「CHANNEL_MAPPING 은 「저장된 값」만이 아니라 「조회 방법」도 표현할 수 있어야 한다」고
적었고, 네이버 주소록·롯데ON `DV_CO_CD`·쿠팡 출고지가 전부 그 경우다.

### 1-2. 🔴 Common Value 에 «무엇을» 담는가 — 담지 않는 것부터

| 후보 | 담는가 | 근거 |
|---|---|---|
발급 번호/코드 | 🔴 **아니다** | binding 이다. 채널 간 변환 불가 |
표시 이름(label) | 🔴 **아니다** | §2 참조 — stale 이 된다 |
주소·연락처 | 🟡 **출고지는 담을 것이 없다** | 세 채널 중 저장하는 곳이 0 |
**셀러가 붙인 이름** | ✅ **이것뿐이다** | 「성남 물류센터」 — 우리가 만들고 우리가 소유한다 |

```text
CanonicalLogisticsPlace
   ├─ id                 우리가 발급
   ├─ displayName        🔴 «셀러가 붙인» 이름. 채널에서 가져온 것이 아니다
   ├─ kind               OUTBOUND | RETURN
   └─ bindings[]         { channel, value, kind, acquisition }
```

🔴 **`displayName` 은 채널 label 의 복사본이 아니다.** 채널 이름을 복사하면 §2 의
stale 문제를 그대로 물려받는다. 셀러가 「이 셋은 같은 창고다」라고 묶을 때 붙이는
이름이고, 그것이 Phase C §2 가 말한 **「동일성은 셀러가 선언한다」** 의 실체다.

### 1-3. 🔴 자동 병합을 하지 않는다

```text
❌ 쿠팡 24496935 + 롯데ON 115 를 «같은 장소» 로 묶는 migration
   근거가 없다. 주소를 저장하는 채널이 하나도 없어 대조할 것이 없다.

⭕ 셀러가 화면에서 묶는다 → 그 선언이 CanonicalLogisticsPlace 한 행이 된다
   묶기 전에는 binding 세 개가 «각각 따로» 존재한다. 그것도 정상 상태다.
```

---

## 2. ② `no + label` 일반화 — 🔴 **Phase B 의 내 판단을 부분 정정한다**

Phase B §2 는 롯데ON 의 `no + label` 을 「Canonical binding 의 원형」이라고 적었다.
D-2 조사 결과 **구조는 옳고 저장 방식은 틀렸다.**

### 2-1. label 의 성격 (확정)

| 질문 | 답 | 근거 |
|---|---|---|
Canonical 의미인가 | 🔴 **아니다** | payload 도달 0건(grep). `LotteOnChannelConfig` 에 필드 자체가 없다 |
UI 표시용인가 | ✅ **그렇다** | 058:36-38 「이 이름은 표시 전용이고 등록 payload 에는 절대 들어가지 않는다」 |
수집기가 얻을 수 있나 | 🔴 **아니다** | 판매자센터 값이다. 상품 페이지에 없다 |

### 2-2. 🔴 저장 방식의 결함 — stale 을 알릴 장치가 없다

```text
058:36  「고른 «순간의» 표시 이름」
            ↓
롯데ON 판매자센터에서 출고지 이름을 바꾸면
            ↓
우리 label 은 «옛 이름» 그대로 남는다
            ↓
🔴 그것이 stale 임을 알리는 코드가 없다 (재조회·비교·경고 전부 0)
```

대조 — **쿠팡은 이름을 저장하지 않고 매번 조회한다**(`fetchShippingPlaces()` 가
`name`·`countryCode` 를 준다). 이름에 관해서는 **쿠팡 방식이 옳다.**

### 2-3. 판정

```text
「번호 옆에 사람이 읽을 이름을 둔다」   ✅ 일반화할 가치가 «있다»
                                     없으면 셀러는 「24496935」만 보고 아무것도 못 고른다
                                     그리고 §1-3 의 «선언» 을 하려면 이름이 반드시 필요하다

「그 이름을 우리 DB 에 저장한다」       🔴 일반화하지 «않는다»
                                     채널 이름은 채널이 소유한다. 복사하면 stale 이 된다.
                                     조회해서 보여주고, 저장하는 이름은 §1-2 의
                                     displayName(셀러가 붙인 것) 하나뿐이다
```

🔴 **기존 `*_label` 4컬럼은 지우지 않는다.** 조회가 실패했을 때 「12345」만 보여주는
것보다는 옛 이름이라도 보여주는 편이 낫다 — 다만 **옛 이름임을 말해야** 한다.

---

## 3. ③ 택배사 — 구조만 세우고 매핑표는 만들지 않는다

```text
CanonicalCarrier
   ├─ displayName   「CJ대한통운」 — 셀러가 읽는 이름
   └─ bindings[]
        ├─ coupang     { value: "CJGLS",     kind: STATIC_CODE,          acquisition: STORED }
        ├─ smartstore  { value: "CJ대한통운", kind: FREE_TEXT,            acquisition: STORED }
        └─ lotteon     { value: ?,           kind: CHANNEL_COMMON_CODE,  acquisition: FETCHED_EACH_TIME }
```

🔴 **`?` 를 채우지 않는다.** 롯데ON `DV_CO_CD` 값 목록은 89 실시간 조회로만 알 수 있고,
쿠팡 11종조차 원문 미확인이다(`courier-codes.ts` 가 스스로 적어 둔 고백).
네이버 값이 한글 이름인지 코드인지도 placeholder 추정뿐이다.

```text
택배사 = CHANNEL_CODE_DIFFERS 로 유지한다
        채널 간 «변환» 은 설계에 넣지 않는다. 셀러가 채널마다 고른다.
```

🔴 네이버 **반품** 택배사는 애초에 다른 개념이다 — 택배사가 아니라 「우선순위 타입」이고
Wing 실시간 조회다. Canonical Carrier 에 넣지 않는다.

---

## 4. ④ `delivery_method` — legacy 확정 · Canonical 제외

```text
도입   마이그레이션 012 (Sprint A-8) — 배송비·출고소요일과 «한 묶음» 으로 들어왔다
화면   settings/page.tsx:1558  자유 텍스트 · 기본값 "구매대행"
       hint "현재 따져는 해외구매대행으로만 등록합니다"   ← 스스로 「하나뿐」이라고 말한다
소비   🔴 payload 도달 0. 쿠팡은 build-payload.ts:1591 에서 "AGENT_BUY" 하드코딩
```

```text
판정   legacy
       → 현재 payload source 아님
       → 신규 Canonical 설계에서 «제외»
       → 컬럼 삭제 안 함(Phase D 범위 아님)
       → 🔴 Phase E UX 정리 후보 1순위
```

🔴 `CoupangPayloadInspector:71` 이 보여주는 `payload.deliveryMethod` 는 하드코딩된
`"AGENT_BUY"` 이지 셀러가 입력한 값이 아니다 — **화면이 설정값을 반영하는 것처럼
보이지만 아니다.**

`AGENT_BUY`(조달) ↔ `DMST`(배송 구간) 는 여전히 **판정하지 않는다**(Phase C §5-4).

---

## 5. ⑤ `seller_settings.manufacturer`

> ## 🔴 [CORRECTION] (CPO 확정, 2026-09-26)
>
> **아래 §5 의 「LEGACY · 제거 후보」 판정은 «취소한다».**
>
> ```text
> ❌ 취소   manufacturer 가 안 쓰임 → legacy → 제거 후보
> ✅ 정정   manufacturer 는 Commerce Common 의 유효한 Canonical 개념이다.
>          판매자 값이 그 컬럼에 들어갈 수 있었던 것은 «의미/소유» 의 문제이지
>          개념의 폐기 근거가 아니다.
>          Common 은 manufacturer / importer / seller 를 의미적으로 «분리» 하고,
>          각 Commerce 는 Adapter 에서 자기 payload 형식으로 mapping 한다.
> ```
>
> §9 의 수정 목록 **D-7 도 같이 정정된다** — 「제조자(수입자) hint 가 사실이
> 아니다」는 맞았으나, Phase E 가 넣은 대체 문구(「판매 사업자 정보 기록용」)도
> 틀렸다. 확정 문구는 「실제 상품을 제조한 사업자입니다」다.
>
> 🔴 조사 «사실»(소비처 0 · 실측 NULL)은 그대로 보존한다.

### (원문 유지) 추적 결과 — 소비처 0

Phase C 에서 「끝까지 못 쫓았다」고 남긴 것을 닫는다.

```text
CoupangSellerConfig.manufacturer
   선언    build-payload.ts:51
   기본값  build-payload.ts:103  ("")
   읽기    🔴 0건
           :1349 는 「사라졌다」는 주석이고
           :1355 는 resolver 결과 `manufacture` 를 쓴다
```

`resolveManufacturer()` 입력에 판매자 값이 없다. 사다리는
`상품 원문 → 브랜드 프로필 → 브랜드명 → 없음`. 네이버·롯데ON 동일하고,
롯데ON 은 **테스트가 계약으로 고정**한다(`pivot03-lotteon-seller-source.test.ts`).

```text
판정   LEGACY — 사용처 0 · 제거 후보
       🔴 rename 도 하지 않는다(Phase D 범위 아님)
       🔴 실측값이 NULL 이다(059:91) — 지워도 잃을 값이 없을 «가능성» 이 높으나
          C-1 이 UNVERIFIED 라 «확정하지 않는다»
```

### 🔴 그런데 화면은 아직 다른 말을 한다

```tsx
// settings/page.tsx:1721
<Field label="제조자(수입자)" hint="… 여기 입력하면 상품마다 자동 채워집니다">
  <input placeholder="예: 대표님 사업자명" />
```

라벨은 「제조자(수입자)」, placeholder 는 「대표님 사업자명」 —
**처음부터 판매 사업자 칸이었고 이름만 제조자였다.**
hint 의 「자동 채워집니다」는 **사실이 아니다.** `settings-status.ts:34` 는 이 값이 비면
권장 목록에 넣어 **효과 없는 항목을 채우라고 안내한다.**

→ Phase E UX 정리 후보.

---

## 6. ⑥ Readiness 축 — 🔴 새 축 없이 공통 적용하는 설계

### 6-1. 지금 상태 (실측)

```text
선언된 4값   AUTO · SETTINGS_DEFAULT · MANUAL_REQUIRED · DEFAULT_VALUE
쿠팡         SETTINGS_DEFAULT · MANUAL_REQUIRED · DEFAULT_VALUE   (3값)
네이버       MANUAL_REQUIRED «고정»                                (readiness.ts:250)
롯데ON       (없음 — ReadinessItem 을 거치지 않는다)
```

### 6-2. 🔴 `AUTO` 는 규칙상 붙을 수 없다

```typescript
// readiness.ts:28-30
/** … 통과(passed=true)한 항목엔 표시하지 않는다. */
sourceStatus?: "AUTO" | …
```

`AUTO` = 「자동으로 채워졌다」 = passed. **그런데 passed 에는 안 붙인다.**
전수 grep 결과 프로덕션에서 `sourceStatus: "AUTO"` 를 부여하는 코드는 **0건**이고
타입 선언과 테스트에만 있다.

지시하신 목표가 정확히 여기 걸린다:

```text
COMMON DATA → AUTO / SETTINGS_DEFAULT      ← AUTO 가 도달 불가능한 값이다
```

**해결은 하나뿐이고, 새 축이 아니다** — 「passed 에는 안 붙인다」는 **규칙을 넓힌다.**

```text
현재   sourceStatus 는 «부족 항목» 의 해결 장소를 말한다
목표   sourceStatus 는 «모든 항목» 의 현재 출처를 말한다
         passed  + AUTO             수집기가 채웠다
         passed  + SETTINGS_DEFAULT 설정값이 적용됐다
         passed  + DEFAULT_VALUE    채널/코드 기본값이 적용됐다
         !passed + MANUAL_REQUIRED  셀러가 직접 적어야 한다
```

🔴 이것이 지시하신 **「설정값이 존재한다」 ≠ 「현재 화면에 자동으로 채워졌다」** 의 답이다.
전자는 Settings 의 상태이고 후자는 **이 상품의 이 필드가 실제로 그 값으로 채워졌는가**다.
지금은 둘을 구분할 자리가 없는 것이 아니라, **구분할 자리(`AUTO`)를 쓰지 않고 있다.**

`classifyMissing()`(`commerce-registry.ts:131`)은 손대지 않는다 — 규칙이 넓어지면
네이버가 `every(MANUAL_REQUIRED)` 를 벗어나 `CONFIRM`(확인 필요)을 말할 수 있게 된다.

### 6-3. 🔴 롯데ON 은 «더 나은» 축을 이미 갖고 있다

```typescript
// lotteon-channel-form.ts:766-776
/** 부족한 항목을 **어디서** 채우는가. "입력하세요"가 아니라 "여기로 가세요"를 말하기 위한 것. */
export type LotteOnFixLocation =
  | "COMMON_PRODUCT" | "LOTTEON_TAB" | "SETTINGS"
  | "LOTTEON_SELLER_CENTER";   // 🔴 우리가 만들 수 없는 값 — 채널에 먼저 등록해야 생긴다
```
필드마다 `why` / `what` 문장까지 붙어 있다.

```text
쿠팡·네이버   sourceStatus + externalHref("/settings")  →  「설정으로 가라」까지만
롯데ON        LotteOnFixLocation + why/what             →  「판매자센터에 먼저 등록하라」
```

🔴 `LOTTEON_SELLER_CENTER` 는 Phase C §8 의 「수집 불가 · 판매자센터 발급 ID」와
**정확히 같은 범주**다. 그런데 쿠팡 `outboundShippingPlaceCode` · 네이버 주소록번호도
성격이 같은데 `/settings` 로 보낸다 — **Wing 에 출고지가 없으면 설정 화면에 가도
고칠 수 없다.**

그리고 롯데ON 항목은 `CommerceWorkspace.tsx:497-503` 에서 `kind` 없이 옮겨져
**「확인 필요 / 입력 필요」 배지가 아예 안 나온다.**

### 6-4. 설계 (구현 아님)

```text
① sourceStatus 규칙을 넓힌다 — passed 항목에도 붙인다            새 축 0
② 네이버 per-field 부여 — 이미 같은 파일이 아는 것을 쓴다        새 축 0
     NAVER_SETTINGS_FIELD_PREFIXES(:262) → SETTINGS_DEFAULT
     NAVER_NOTICE_FIELD_EXTERNAL_HREF(:410) → SETTINGS_DEFAULT
     나머지 → MANUAL_REQUIRED (지금과 동일)
③ 롯데ON 항목에 kind 를 붙인다 — LotteOnFixLocation → sourceStatus 매핑
     LOTTEON_SELLER_CENTER · SETTINGS → (해결 장소가 밖) 
     COMMON_PRODUCT · LOTTEON_TAB     → MANUAL_REQUIRED
④ 🔴 externalHref 로 표현되지 않는 곳이 있다 — 「채널 판매자센터」
     이것을 어떻게 말할지는 Phase E 가 정한다. 지금 새 필드를 만들지 않는다.
```

---

## 7. ⑦ LotteON 오류 표시 — 🔴 원인이 `catch` 가 아니었다

### 7-1. 실제 원인

```typescript
// api/lotteon/_lib/seller-settings.ts:137-151
if (!supabase) return EMPTY_LOTTEON_SELLER_SETTINGS;          // 연결 없음
if (error) { console.warn(…); return EMPTY_LOTTEON_SELLER_SETTINGS; }  // 조회 실패
return data ? fromRow(data) : EMPTY_LOTTEON_SELLER_SETTINGS;  // 값 없음
// 🔴 세 경우가 «같은 값» 으로 돌아온다

// api/settings/lotteon-seller/route.ts:19-22
export async function GET() {
  const values = await loadLotteOnSellerSettings();
  return NextResponse.json({ ok: true, values });   // 🔴 «항상» ok:true
}
```

화면의 `catch`(`Panel.tsx:643-646`)는 **네트워크 실패에만** 걸린다.
API 가 이미 「실패」와 「없음」을 합쳐 버린다.

### 7-2. 🔴 형제 함수는 이미 옳게 한다 — 새 패턴을 만들지 않는다

```typescript
// lib/seller-settings.ts:187-210  (PIVOT-03 R6-FS)
export async function loadSellerSettings(): Promise<ResolvedSellerSettings> {
  if (primary.status === "ERROR") return { …EMPTY, source: "ERROR", failed: true };
  if (primary.status === "FOUND" && hasAny(…)) return { …values, source: "SELLER_SETTINGS", failed: false };
  return { …EMPTY, source: "NONE", failed: false };
}
export const SELLER_SETTINGS_UNAVAILABLE_MESSAGE = "판매자 정보를 확인하지 못해 등록을 진행할 수 없습니다.";
```
주석이 직접 말한다 — 「아래 두 줄은 «다른 말» 이다. 셋째 줄에서 호출부는 멈춰야 하고,
둘째 줄에서는 멈추면 안 된다」. **문구 상수까지 「세 채널이 같은 글자를 쓴다」고 적혀 있다.**

### 7-3. 최소 수정안

```text
① loadLotteOnSellerSettings() 반환형을 형제 함수 모양으로
      LotteOnSellerSettings → ResolvedLotteOnSellerSettings { …, source, failed }
      🔴 새 타입 이름이 아니라 «같은 모양» 이다
② GET 이 ok:true 고정을 멈추고 failed 를 실어 보낸다
③ Panel 이 failed 면 「설정을 확인하지 못했습니다」를 말한다
      🔴 빈 칸을 「설정 없음」이라고 말하지 않는다
```

```text
DB 변경        없음
Production 영향 읽기 경로만. 등록 게이트는 그대로(빈 값은 검증기가 SELLER_PLACE_REQUIRED 로 잡는다)
🔴 4279402 를 폼에 주입하지 «않는다»
```

---

## 8. ② 현재 → 목표 매핑

| 현재 저장소 | Canonical Concept | Channel Binding | 이동? |
|---|---|---|---|
`coupang_seller_profiles.outbound_shipping_place_code` | CanonicalLogisticsPlace(OUTBOUND) | coupang / STATIC_CODE / STORED | 🔴 지금 안 옮긴다 |
(네이버 — 저장 없음) | 같음 | smartstore / ADDRESS_BOOK_NO / **FETCHED_EACH_TIME** | — |
`lotteon_seller_settings.outbound_place_no` | 같음 | lotteon / STATIC_CODE / STORED | 🔴 지금 안 옮긴다 |
`…return_center_code` · `…return_place_no` | CanonicalLogisticsPlace(RETURN) | 동형 | 🔴 안 옮긴다 |
`…return_address` 외 4값 | 🔴 **CHANNEL-SPECIFIC** (쿠팡만 payload 필수) | coupang | 그대로 |
`delivery_company_code` · `naver_delivery_company_code` | CanonicalCarrier | coupang / smartstore | 🟡 테이블 이름만 틀렸다 |
(롯데ON 택배사 — 저장 없음) | 같음 | lotteon / CHANNEL_COMMON_CODE / FETCHED | — |
`delivery_charge` | 「배송비 금액」 | 쿠팡·네이버 공용 | 그대로 |
`delivery_cost_policy_no` | 🔴 **CHANNEL-SPECIFIC** | lotteon | 그대로 |
`*_label` 4컬럼 | 🔴 Canonical 아님 — UI 표시 | — | 그대로(지우지 않음) |
`seller_settings.as_contact_number` · `quality_guarantee` | ✅ 이미 Canonical | — | **완료** |
`seller_settings.manufacturer` | 「판매 사업자」(이름이 legacy) | — | 🔴 사용처 0 |
`delivery_method` | 🔴 Canonical 제외 | — | 🔴 legacy |

---

## 9. ③ 실제 수정 필요 목록

우선순위 순. 🔴 **이번에 실행하지 않았다.**

| # | 필드/지점 | 현재 문제 | 목표 | 변경 파일 | DB | Production 영향 |
|---|---|---|---|---|---|---|
**D-1** | 롯데ON 설정 조회 | 「조회 실패」와 「설정 없음」이 같은 얼굴 | 형제 함수 모양(`source`/`failed`) | `api/lotteon/_lib/seller-settings.ts` · `api/settings/lotteon-seller/route.ts` · `LotteOnRegistrationPanel.tsx` | **없음** | 읽기 경로만. 게이트 불변 |
**D-2** | `readiness.ts:250` | 네이버 전 필드 `MANUAL_REQUIRED` 고정 → 영원히 「입력 필요」 | 같은 파일이 이미 아는 prefix/href 로 per-field 부여 | `readiness.ts` | 없음 | 🟡 배지 문구가 바뀐다. 게이트(ok/required) 불변 |
**D-3** | 롯데ON `kind` 부재 | 「확인/입력」 배지가 안 나온다 | `LotteOnFixLocation` → `sourceStatus` 매핑 후 `kind` 부여 | `CommerceWorkspace.tsx:497-503` | 없음 | 🟡 배지 추가. 게이트 불변 |
**D-4** | `sourceStatus` 규칙 | `AUTO` 가 도달 불가 | passed 항목에도 부여 | `readiness.ts` + 소비처 | 없음 | 🔴 화면 표시가 넓어진다 — Phase E 와 함께 |
**D-5** | `*_label` stale | 옛 이름을 옛 이름이라 말하지 않는다 | 조회값과 다르면 표시 | `LotteOnRegistrationPanel.tsx` | 없음 | 🟡 표시만 |
**D-6** | `delivery_method` UI | 입력받고 어디에도 안 보낸다 | 입력칸 제거 또는 「전송되지 않음」 명시 | `settings/page.tsx` · `SellerProfileSummaryCard.tsx` | 🔴 컬럼은 남긴다 | UX only |
**D-7** | 「제조자(수입자)」 hint | 「자동 채워집니다」가 사실이 아님 | 문구 수정 또는 칸 정리 | `settings/page.tsx:1721` · `settings-status.ts:34` | 컬럼 남김 | UX only |
**D-8** | `naver_delivery_company_code` 위치 | 「쿠팡」 테이블에 네이버 값 | 테이블/개념 분리 | — | 🔴 **migration 필요** | 🔴 Phase F 이후 |
**D-9** | CanonicalLogisticsPlace 신설 | 셀러가 장소를 묶을 자리가 없다 | §1-2 구조 | — | 🔴 **migration 필요** | 🔴 C-1 확인 후 |

🔴 **D-1 ~ D-7 은 DB 변경이 «전혀» 없다.** D-8·D-9 만 migration 이 필요하고,
그 둘은 C-1(Production DB)이 `UNVERIFIED` 인 한 착수하지 않는다.

---

## 10. ④ DB 미확정 영역 — `UNVERIFIED`

```text
UNVERIFIED  lotteon_seller_settings 의 행 존재 여부와 4개 번호의 실제 값
UNVERIFIED  coupang_seller_profiles is_default 행의 출고지/반품지/택배사 실제 값
UNVERIFIED  seller_settings 1행의 다섯 칸 실제 값 (manufacturer 는 NULL 로 기록됨)
UNVERIFIED  coupang_brand_profiles · commerce_accounts 행수
UNVERIFIED  쿠팡 출고지와 롯데ON 출고지가 «같은 장소인지»
UNVERIFIED  롯데ON 166 응답의 정책 내부 필드(금액 포함 여부)
UNVERIFIED  DV_CO_CD 값 목록 · 쿠팡 11종 코드 원문 · 네이버 택배사 값 형식
UNVERIFIED  AGENT_BUY ↔ DMST 가 같은 축인지
```

🔴 위 어느 것도 추측으로 채우지 않았다. 특히 **`4279402` 를 코드에 넣지 않았다.**

---

## 11. 🔴 이번에 만들지 «않은» 것

```text
❌ CanonicalSource · FieldOrigin · AutoFillStatus · 새 Provenance 체계
❌ DB migration · 테이블 삭제 · 필드 이동
❌ lotteon_seller_settings / coupang_seller_profiles 변경
❌ 실제 채널 ID 자동 병합
❌ 4279402 하드코딩
❌ Extension 구현 · 새 Commerce · 카테고리 확장 · MI 작업
❌ delivery_method / seller_settings.manufacturer 제거
```

## 12. Phase E 가 받는 것

```text
① Extension 은 «없다». 지금 수집기는 crawler 다 — 설계 문서를 그렇게 읽을 것   §0
② Canonical 의 Common Value 는 «셀러가 붙인 이름» 하나뿐이다                 §1-2
③ 채널 label 은 저장하지 않는다 — 조회해서 보여준다(Phase B 판단 부분 정정)   §2
④ AUTO 는 규칙을 넓혀야 쓸 수 있다. 새 축이 아니다                          §6-2
⑤ 「채널 판매자센터」를 말할 자리가 쿠팡·네이버에 없다                        §6-3
⑥ 화면이 사실이 아닌 말을 하는 곳 둘 — D-6 · D-7                            §9
⑦ D-1~D-7 은 DB 0 이다. 먼저 할 수 있다                                    §9
```
