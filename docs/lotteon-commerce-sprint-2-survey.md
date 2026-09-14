# LOTTEON COMMERCE SPRINT 2 — STEP 1 + STEP 6 + STEP 11 선행 조사

- 작성: CTO
- 작성일: 2026-09-14
- 기준: `main` @ `8aecc02`
- 성격: **조사 전용.** 코드 변경 0건 · 커밋 0건 · DB write 0건 · 마이그레이션 0건 · 쓰기 API 호출 0회
- 외부 호출: 롯데ON **공개 문서 백엔드**(무인증) 조회 + 무자격 `GET /v1/openapi/common/v1/identity` 연결성 확인(401 응답 확인용) — **비즈니스 API 호출 없음, 인증키 사용 없음**
- 11번가 / 매칭 트랙 파일 접근 없음 (`packages/marketplace/src/soon/*` 는 **읽기만** — 계약 구조 확인 목적)

---

# 1. 현재 아키텍처 — 세 축의 실제 call graph

## 1-1. 설정 → credential → commerce connection

### 호출 사슬 (Coupang)

```
apps/admin/src/app/settings/page.tsx : CommerceAccountManager (L2489~2845)
  └ handleSaveAccount()            → POST /api/settings/coupang
  └ checkCoupang()                 → POST /api/coupang/auth-test
  └ handleClearCoupang()           → DELETE /api/settings/coupang

apps/admin/src/app/api/settings/coupang/route.ts : GET/POST/DELETE
  └ apps/admin/src/app/api/coupang/_lib/env.ts
        : getCoupangSettingsStatus() / getCoupangAccountSettingsForDisplay()
        : saveCoupangAccountSettings() / clearCoupangAccountSettings()
        : getCoupangCredentials() / getVendorUserId()
        └ Supabase table  coupang_seller_settings  (id='default' 단일 행)

apps/admin/src/app/api/coupang/auth-test/route.ts : POST
  └ getCoupangCredentials()
  └ apps/admin/src/app/api/coupang/_lib/client.ts : callCoupangApi()
        └ apps/admin/src/app/api/coupang/_lib/signing.ts : signCoupangRequest()  [HMAC-SHA256 / CEA]
        └ apps/admin/src/lib/outbound-proxy.ts : createOutboundProxyDispatcher()
        └ GET /v2/providers/seller_api/.../display-category-codes/78877  (읽기 전용 meta)
```

### 호출 사슬 (Naver / SmartStore)

```
apps/admin/src/app/settings/page.tsx : CommerceAccountManager (L2732~2825)
  └ handleSaveNaverAccount()       → POST /api/settings/naver
  └ checkNaver()                   → POST /api/naver/auth-test
  └ handleClearNaverAccount()      → DELETE /api/settings/naver

apps/admin/src/app/api/settings/naver/route.ts : GET/POST/DELETE
  └ apps/admin/src/app/api/naver/_lib/account.ts
        : saveNaverAccountSettings() / clearNaverAccountSettings()
        : getNaverAccountSettingsForDisplay()
  └ apps/admin/src/app/api/naver/_lib/env.ts : getNaverCredentials()
        └ Supabase table  commerce_accounts  (platform='naver' 첫 행)

apps/admin/src/app/api/naver/auth-test/route.ts : POST
  └ getNaverCredentials()
  └ apps/admin/src/app/api/naver/_lib/client.ts
        : buildClientSecretSign()   [bcrypt(clientId_timestamp, salt=clientSecret) → base64]
        : issueNaverAccessToken()   → POST https://api.commerce.naver.com/external/v1/oauth2/token
        : callNaverApi(accessToken) → GET /v1/seller/account
        └ apps/admin/src/lib/outbound-proxy.ts : createOutboundProxyDispatcher()
```

### credential 저장 방식 — **실측(Production DB SELECT)**

| 항목 | 실측 결과 |
|---|---|
| Coupang 테이블 | `coupang_seller_settings` — `id, access_key, secret_key, vendor_id, vendor_user_id, …` (싱글톤 `id='default'`) |
| Naver 테이블 | `commerce_accounts` — `id, platform, label, is_default, access_key, secret_key, vendor_id, vendor_user_id, client_id, client_secret, seller_id, created_at, updated_at` |
| `commerce_accounts` CHECK | `CHECK (platform = ANY (ARRAY['naver','coupang']))` |
| `commerce_accounts` 실제 행 | **1행뿐** — `platform='naver'`, `client_id`/`client_secret` 有, `seller_id` NULL, 생성 2026-08-19 |
| 암호화 | **없음.** 저장소 전체에 encrypt/decrypt/cipher/aes 헬퍼가 존재하지 않는다. 평문이다. |
| workspace 스코프 | **없음.** `workspaces`/`workspace_members` 테이블은 있고 `product_snapshots.workspace_id`는 있으나, `commerce_accounts`·`coupang_seller_settings`에는 workspace 컬럼 자체가 없다 — credential은 **전역 싱글톤**이다. |
| env 폴백 | 두 채널 모두 "DB 우선 → env 폴백" (`COUPANG_*` / `SMARTSTORE_*`) |
| 마스킹 | `••••{last4}` + `secretKeySaved: boolean`. 값은 응답에 넣지 않는다. |

### 공통 vs 채널 어댑터 (설정 축)

| 층 | 공통 | 채널 전용 |
|---|---|---|
| UI | `settings/page.tsx` 의 아코디언 셸, 마스킹 표기, "연결 테스트" 버튼 패턴 | 필드 구성 자체(accessKey/secretKey/vendorId vs clientId/clientSecret) |
| 저장 | "빈 문자열이면 기존값 유지" merge 규칙, `getSupabaseAdmin()` | 테이블(`coupang_seller_settings` vs `commerce_accounts`), save/clear 함수 |
| 네트워크 | `apps/admin/src/lib/outbound-proxy.ts` (OCI→FIXIE→DIRECT), 20초 타임아웃, `describeErrorCauseChain()` | 서명 방식(HMAC vs bcrypt+OAuth), base URL, auth-test 엔드포인트 |
| 상태 | `NOT_CONFIGURED / AUTH_FAILED / CONNECTED` 3값 규약 | 단계별 debug 페이로드 |

> **아웃바운드 IP는 이미 고정이다.** `OCI_PROXY_URL`(Oracle Tinyproxy 161.33.39.233:8888) → `FIXIE_URL` 순으로 폴백한다. Vercel 함수의 동적 IP가 아니라 프록시 egress IP가 외부에 보인다. 이것이 STEP 6의 IP allowlist 요건과 직결된다(§6-3).

---

## 1-2. 상품관리 → 상품 → channel payload → register

### 공통 모델 3층

```
Layer 1  CanonicalProduct           packages/shared/src/product-types.ts (L148~372)
         └ 크롤러/AI 산출물. 플랫폼 무관. ProvenanceField<T>로 전 필드 출처 추적.
         └ 저장: product_snapshots.workspace (jsonb), workspace_id로 워크스페이스 스코프.
Layer 2  ListingModel               packages/marketplace/src/types.ts (L21~48)
         └ "이렇게 등록될 것이다" Preview 모델. 실제 API 바디가 아니다.
Layer 3  {Naver|Coupang}Payload     packages/listing/src/{naver,coupang}/build-payload.ts
         └ 각 채널 공식 스키마. 서버에서만 만든다.
```

`PlatformId = "smartstore" | "coupang" | "elevenst"` — `packages/shared/src/product-types.ts:458`.

### 어댑터 계약 (실제 인터페이스)

```ts
// packages/marketplace/src/types.ts:87
export interface PlatformAdapter {
  platform: PlatformId;
  label: string;
  toListingModel(
    product: CanonicalProduct,
    categorySelection: CategorySelection,
    pricingContext: ListingPricingContext | undefined,
    platform: PlatformId,        // PHASE 3.2 — 4개 인자 전부 필수(누락은 컴파일 에러)
  ): ListingModel;
}

// packages/listing/src/executor.ts:17
export interface ListingExecutor {
  platform: ListingModel["platform"];
  execute(
    product: CanonicalProduct,
    listing: ListingModel,
    mode: ExecutionMode,          // DRY_RUN | PREVIEW | LIVE
    context?: { snapshotId?: string; jobKey?: string },
  ): Promise<ListingResult>;
}
```

`packages/marketplace/src/types.ts` 주석이 이미 못 박아 뒀다 — **CommerceAdapter 단일 인터페이스는 존재하지 않고, 만들지도 않는다.** 실제 계약은 5개 지점이다: `resolveCategory / validate / buildPayload / preview / register`.

### 등록 실행 사슬

```
apps/admin/src/app/pipeline/CommerceWorkspace.tsx
  └ activeTab: "source" | "content" | PlatformId          (PLATFORM_ORDER 순)
  └ PLATFORM_ADAPTERS[platform].toListingModel(...)        [공통 레지스트리]
  └ commerce/PlatformPreview.tsx / RegistrationReadinessCard.tsx
  └ ListingConfirmationModal → LISTING_EXECUTORS[platform].execute(mode)

packages/listing/src/executors/coupang.executor.ts
  ├ DRY_RUN/PREVIEW → fetch /api/coupang/payload-preview
  └ LIVE            → fetch /api/coupang/register
packages/listing/src/executors/smartstore.executor.ts
  ├ DRY_RUN/PREVIEW → validateSmartStoreListing() + buildSmartStorePayload()  (로컬)
  └ LIVE            → fetch /api/smartstore/register
packages/listing/src/executors/not-implemented.executor.ts
  └ createNotImplementedExecutor(platform, label) → 항상 FAILED + step="NOT_IMPLEMENTED"
     (지금 elevenst가 이걸 쓴다 — 미구현 채널의 표준 처리 방식)

apps/admin/src/app/api/coupang/register/route.ts
  └ getCoupangCredentials() / getDefaultSellerProfile() / fetchCategoryMeta() / findBrandProfileByName()
  └ buildCoupangPayload()            packages/listing/src/coupang/build-payload.ts:1242
  └ buildCoupangCompliance()         :930
  └ validateCoupangPricing()         :1425
  └ callCoupangApi()  POST /v1/marketplace/seller-products
  └ logRegistrationAttempt()  → registration_attempts        [공통]
  └ markSnapshotRegistered()  → product_snapshots.status='REGISTERED'   [공통]

apps/admin/src/app/api/smartstore/register/route.ts
  └ getNaverCredentials() → issueNaverAccessToken()
  └ resolveNaverContext()  (addressBooks / categoryMeta / originAreaCodes / deliveryCompanies 실시간 조회)
  └ buildNaverProductPayload(NaverPayloadInput)   packages/listing/src/naver/build-payload.ts:453
  └ validateNaverPayload()                        packages/listing/src/naver/validate-payload.ts
  └ uploadNaverProductImages()
  └ callNaverApi()  POST /v2/products
  └ logRegistrationAttempt() / markSnapshotRegistered()      [공통]
```

### 공통 / 전용 경계 (상품관리 축)

| 층 | 공통 | 채널 전용 |
|---|---|---|
| 모델 | `CanonicalProduct`, `ListingModel`, `ListingResult`, `ListingStatus`, `ExecutionMode` | `NaverProductRegistrationPayload`, `CoupangPayload`, `SmartStorePayload` |
| 가격 | `resolveChannelListingPrice()` / `resolveListingPrice()` (채널 가격 단일 출처), `channelPriceOverrides` | 없음 — 두 채널 모두 같은 함수를 쓴다 |
| 카테고리 | `CategorySelection` (`packages/category/src/types.ts:53`), `PLATFORM_CATEGORY_TABLES` | `naver/category-*.ts`, `coupang/category-meta` API |
| 검증 | `runValidation()` / `scoreValidations()` / `ValidationResult` | `validateNaverPayload()`, `buildCoupangCompliance()` |
| 상세페이지 | `DetailPageBlock[]` / `resolveDetailBlocks()` / `assembleContentsFromBlocks()` — **Coupang 파일에 있지만 Naver도 공유한다**(`assembleNaverDetailContent`) | 조립 결과 HTML 포맷 |
| 레지스트리 | `PLATFORM_ADAPTERS`, `LISTING_EXECUTORS`, `MARKETPLACE_DESCRIPTORS`, `FIELD_CAPABILITY_MATRIX`, `PLATFORM_CATEGORY_TABLES` | 각 항목의 값 |
| 셀러 기본값 | — | `coupang_seller_profiles` (단, `naver_delivery_company_code`가 이미 들어 있어 사실상 반쯤 공통) |

`packages/marketplace/src/field-capability-matrix.ts` 가 13개 필드 × 4마켓(smartstore/coupang/elevenst/esm)을 `COMMON | MAPPED | SMARTSTORE_ONLY | COUPANG_ONLY` × `SUPPORTED | PARTIAL | NOT_APPLICABLE | SOON` 로 이미 분류해 두었다. 롯데ON은 **여기에 컬럼 하나 추가**가 자연스러운 자리다.

---

## 1-3. 판매관리 → 주문/배송/취소/반품/교환/환불

**§2 참조. 결론은 "없음"이다.**

---

# 2. 판매관리 실태 — **없음**

## 2-1. DB 실측 (Production, SELECT only)

`information_schema.tables` 전수 조회 결과 public 스키마 테이블 **25개**:

```
Product, _prisma_migrations, audit_log, brand_dictionary, commerce_accounts,
comparison_shops, coupang_brand_profiles, coupang_description_templates,
coupang_seller_profiles, coupang_seller_settings, domestic_price_sources,
domestic_product_links, exchange_rates, image_assets, job_key_sequences,
market_signal_cache, price_alerts, price_observations, product_snapshots,
registration_attempts, seller_compliance_confirmations, support_inquiries,
workspace_domestic_shop_settings, workspace_members, workspaces
```

주문/배송/클레임 관련 테이블은 **0개**다. `orders` / `order_items` / `shipments` / `claims` / `returns` / `exchanges` / `refunds` / `invoices` — 전부 존재하지 않는다.

## 2-2. API 라우트 실측

`apps/admin/src/app/api/**/route.ts` 전수(78개) 확인. 주문/배송/클레임 라우트 **0개**. 가장 근접한 것:

| 파일 | 실체 |
|---|---|
| `apps/admin/src/app/api/coupang/product-status/route.ts` | 등록한 `sellerProductId`의 **상품** 검수/승인 상태 조회. 주문과 무관. |
| `apps/admin/src/app/api/coupang/_lib/courier-codes.ts` | 택배사 코드 **정적 룩업 테이블**. `settings/page.tsx`의 배송 프로필 드롭다운과 `SellerProfileSummaryCard` 라벨링에만 쓰인다. 배송 처리 배선 없음. |
| `apps/admin/src/app/api/coupang/_lib/shipping-place.ts` / `return-centers` | 출고지·반품지 **설정** 조회. 등록 payload 채우기용. |
| `apps/admin/src/app/api/naver/_lib/delivery.ts` | 반품택배사 메타. 등록 시점용. |

## 2-3. 판정

| 기능 | 판정 |
|---|---|
| 주문 조회 / 주문 상세 | **없음** |
| 신규 주문 수집 | **없음** |
| 배송 처리 / 송장 등록 / 발송 처리 | **없음** (택배사 코드표만 존재, 데드 배선) |
| 취소 / 반품 / 교환 / 환불 | **없음** |
| 정산 | **없음** |

> 이 저장소는 **상품 등록 + 가격/시장 인텔리전스 플랫폼**이다. 판매 후(post-sale) 영역은 모델도 테이블도 라우트도 UI도 하나도 없다. **STEP 7은 0에서 시작한다.**

---

# 3. 상품 ↔ 채널 매핑

## 3-1. 저장 자리 — 있다. 단, 감사 로그 한 줄뿐이다.

`registration_attempts` **실제 DB 컬럼**(실측, 마이그레이션 파일 아님):

```
id, platform, status, error_code, trace_id, duration_ms, created_at,
product_name, external_product_id, payload, response,
compliance_score, compliance_report, brand_resolution,
category_resolver_kpi, snapshot_id, job_key, channel_price_record
```

- `external_product_id` = 채널 상품 ID. Coupang `sellerProductId`, Naver `originProductNo`. 실측 예: smartstore `13672322468`.
- `price_breakdown` 컬럼은 **DB에 없다** (마이그레이션 010 미실행) — 기지 사실 재확인됨.
- `channel_price_record`(048)는 컬럼은 있으나 **74행 전부 NULL** — 기지 사실 재확인됨.

## 3-2. 실측 등록 이력

| platform | status | 건수 | external_product_id 有 | 최종 |
|---|---|---|---|---|
| coupang | SUBMITTED | 24 | 24 | 2026-08-19 |
| coupang | FAILED | 14 | 0 | 2026-08-14 |
| smartstore | SUBMITTED | 10 | 7 | 2026-08-24 |
| smartstore | FAILED | 26 | 0 | 2026-08-20 |

총 74행 / `snapshot_id` 채워진 행 46 / `compliance_report` 30 / `category_resolver_kpi` 20 / `channel_price_record` **0**.

## 3-3. 없는 것

- **전용 매핑 테이블 없음.** `product_channel_mappings` / `channel_listings` / `listings` / `channel_products` — 전부 부재.
- **옵션 단위 채널 ID 저장 자리 없음.** Coupang `vendorItemId`, Naver 옵션 ID를 담는 컬럼이 없다. `response` jsonb 안에 우연히 남아 있을 수는 있으나 조회 계약이 없다.
- **"현재 유효한 등록" 개념 없음.** `registration_attempts`는 append-only 시도 로그다. 같은 스냅샷을 4번 등록하면 4행이 남고 어느 것이 살아 있는지 모델이 모른다(실측: 동일 상품명 smartstore 4건).
- **채널별 상태 없음.** `product_snapshots.status`는 `IN_PROGRESS | REGISTERED` 단일 플래그다(`markSnapshotRegistered()` — `apps/admin/src/app/api/snapshots/_lib/snapshot.ts:308`). 어느 채널에 등록됐는지는 `getRegisteredPlatforms()`(`.../snapshots/_lib/registration-status.ts`)가 `registration_attempts`를 역조회해서 재구성한다.

> 즉 **상품↔채널 매핑은 "감사 로그에서 유추"하는 구조다.** 판매관리(주문→상품 역참조)를 붙이려면 이 자리가 먼저 필요하다. 이것은 롯데ON 고유 문제가 아니라 기존 2채널에도 이미 있는 구멍이다.

---

# 4. 롯데ON — 저장소 내 코드 / 인증키

## 4-1. 코드 — **없음**

전수 검색(`lotte`, `lotteon`, `롯데`, 대소문자 무시, `.ts/.tsx/.sql/.json/.md/.env*`) 결과 4개 파일만 히트했고 **전부 롯데ON과 무관**하다:

| 파일 | 히트 내용 |
|---|---|
| `apps/admin/src/app/api/coupang/_lib/courier-codes.ts:16` | `{ code: "LOTTE", label: "롯데택배" }` — 택배사 |
| `apps/admin/src/app/settings/page.tsx:126` | 동일 택배사 목록 |
| `apps/admin/src/app/pipeline/commerce/SellerProfileSummaryCard.tsx:37` | `LOTTE: "롯데택배"` |
| `packages/marketplace/src/registry.ts:22,49` | **주석뿐.** "승인 대기 5개 커머스" 우선순위(①카카오 ②SSG ③롯데ON ④G마켓 ⑤11번가)와 `LotteOnAdapter`가 채워야 할 7개 자리를 문서로만 남겨둠. 코드 0줄. |

`PlatformId`에 `lotteon`은 없다. 어댑터·executor·payload 빌더·라우트 전부 없다.

## 4-2. 인증키 — **시스템 어디에도 없다**

값은 출력하지 않는다. 존재 여부만:

| 위치 | 결과 |
|---|---|
| `.env.example` | LOTTE* 변수 **없음** (COUPANG_*, NAVER_*, SMARTSTORE_*, ELEVENST_*, ESM_* 만 존재) |
| `.env.local` / `apps/admin/.env.local` / `packages/database/.env` / `scripts/.env` | **없음** |
| Vercel Production/Preview env (`vercel env ls`, 26개 변수, 이름만 확인) | **없음** |
| Production DB `commerce_accounts` | **없음.** 행 자체가 naver 1개뿐이고, CHECK 제약이 `platform IN ('naver','coupang')`이라 lotteon 행은 **삽입 자체가 불가능**하다. |
| 그 외 테이블 | 롯데ON credential을 담을 테이블 자체가 없음 |

> **CEO가 "발급 완료"라고 한 인증키는 롯데ON 판매자센터에만 있고, 이 시스템에는 단 한 번도 입력된 적이 없다.** 따라서 이번 조사에서 **인증이 필요한 롯데ON API는 단 1회도 호출하지 않았다**(호출할 수단이 없었다). 무자격 401 확인만 수행했다(§6-2).

---

# 5. 롯데ON API 능력 — 문서 근거 기반

## 5-0. 조사 방법 (재현 가능)

`api.lotteon.com`은 Nuxt SPA라 WebFetch로는 "Loading…"만 나온다. SPA가 쓰는 **무인증 공개 문서 백엔드**를 JS 번들에서 찾아 직접 조회했다. 아래 URL은 누구나 재현 가능하다:

```
카탈로그  GET https://soapi.lotteon.com/soapi/v1/openapi/o/apiguide/getApiLnbList/SL/V1
개별문서  GET https://soapi.lotteon.com/soapi/v1/openapi/o/apiguide/getApiGuideDetailInfo
              ?apiNo={N}&apiMjrVerCd=V1&apiMnrVerNm=1.0&mdulDvsCd=SL
FAQ       GET https://soapi.lotteon.com/soapi/v1/bocommon/o/faq/selectFaqDetailList
              ?faqTargetDivisionCode=openApi&siteDivisionCode=OPEN_API_FAQ&useYn=Y&soFaqMode=SO
공지      GET https://soapi.lotteon.com/soapi/v1/bocommon/o/notice/noticemattermgr/selectNoticeMatterList?...
```

> **`mdulDvsCd` 구분이 결정적이다.** `SL` = 일반 판매자(api.lotteon.com), `EC` = 계열사(ecapi.lotteon.com). **우리는 SL이다.** EC에만 있는 API를 SL이 있다고 착각하면 UI를 헛으로 만든다. 아래 표는 전부 **SL 카탈로그**다.

SL 카탈로그 = 12개 모듈 / 115개 API.
사람이 볼 URL: `https://api.lotteon.com/apiService/?menuIdx={i}&apiNo={N}&apiMjrVerCd=V1&apiMnrVerNm=1.0`

## 5-1. 인증 · 규격 (문서 원문 확인)

출처: `https://api.lotteon.com/apiService/?apiNm=GetStarted`, `https://api.lotteon.com/apiGuide`

| 항목 | 값 |
|---|---|
| 호출 도메인 | `https://openapi.lotteon.com` (단, 카테고리/속성/브랜드만 `https://onpick-api.lotteon.com`) |
| 방식 | REST, **GET/POST만** 지원. HTTPS. JSON/XML. |
| 인증 | `Authorization: Bearer {인증키}` — **정적 키. OAuth 없음, 서명 없음.** |
| 필수 헤더 | `Authorization`, `Accept: application/json`, `Accept-Language: ko`, `X-Timezone: GMT+09:00`, `Content-Type: application/json`(POST) |
| 키 발급 | 판매자센터 > 판매자정보 > OpenAPI관리. **상위거래처 기준**, 거래처당 **최대 3개**, 유효기간 **1년**(만료 전 메일/문자 알림). |
| IP allowlist | **필수.** 키에 등록된 출발지 IP만 허용. 세미콜론 구분 다중 등록, CIDR 표기 가능. 고정 IP여야 한다. |
| 키에 테넌트 포함 | "인증키로 접속하면 상위 거래처 정보를 가지고 있으므로 따로 거래처 정보를 파라미터에 넣지 않아도 됩니다" |
| 에러 (HTTP) | 401 인증키 무효/만료 · 403 IP 미등록 · 404 비정상 Request · 429 접속량 초과 · 500 시스템 오류 |
| 에러 (body) | `returnCode` — `0000`=정상. **HTTP 200이어도 returnCode를 반드시 파싱해야 한다** ("정상처리, 체크에서 에러값은 리턴코드로 출력"). 응답 봉투: `{returnCode, message, subMessages, dataCount, data}` |
| 접속 제한 | **문서 간 모순.** GetStarted·이용안내: **"분당 10,000회"** / FAQ: **"10초당 10,000회"**. 2:1로 분당 기준이 우세하므로 **분당 10,000회로 설계**한다. 증설은 스토어센터 1:1 문의. |

## 5-2. 기능 표 (전부 SL 카탈로그 실측. 경로 접두사 `https://openapi.lotteon.com`)

R/W 열: **R**=조회 전용(부작용 없음) · **W**=상태 변경(부작용 있음). **HTTP 메서드로 판단하면 안 된다 — 조회도 대부분 POST다.**

### 주문

| 기능 | 지원 | apiNo | 엔드포인트 | R/W | 비고 |
|---|---|---|---|---|---|
| 주문 조회 | ✅ | 209 | `/v1/openapi/delivery/v1/SellerDeliveryOrdersSearch` | R | **배송 모듈에 있다.** FAQ 원문: *"주문 정보 조회를 위한 API는 '출고/회수지시(주문정보) 조회'로 사용하시면 됩니다."* |
| 신규 주문 | ✅ | 209 | 동일 | R | `ifCplYN='N'` = 연동 미완료(=신규)만. `srchStrtDt`/`srchEndDt` 또는 `odNo` 필수. |
| 주문 상세 | ✅ | 209 | 동일 | R | 별도 상세 API 없음. 209 응답이 곧 상세. |
| 주문 상태 | ✅ | 209 / 140 | 209 + `/v1/openapi/delivery/v1/SellerDeliveryProgressStateSearch` | R | 209는 `odPrgsStepCd` 11=출고지시 / 23=회수지시, `odTypCd` 10=주문 30=교환 40=반품 50=AS. **연동완료 후에는 140을 써야 한다**(209는 계속 출고/회수지시 상태로만 보인다). |
| 주문 연동완료 통보 | ✅ | 210 | `/v1/openapi/delivery/v1/SellerIfCompleteInform` | **W** | 209 문서 원문: *"주문진행상태가 출고지시, 회수지시인 경우 즉시 주문취소·회수철회될 수 있으므로 데이터 수신 후 연동완료 통보를 필히 수행"*. 호출 시 **상품준비중/회수진행으로 자동 변경**된다. |
| 장기 미처리 주문 | ✅ | 272 | `/v1/openapi/delivery/v1/longTermUntreated` | R | |
| 셀러 주문혜택 조회 | ✅ | 245 | `/v1/openapi/order/v1/getSROrderList` | R | SL의 `주문(OD)` 모듈에는 **이것 하나뿐**이다. |
| 발송가능여부 체크 | ✅ | 208 | `/v1/openapi/claim/v1/deliveryClaimExtApi/getSendPossibleYn` | R | 발송 처리 전 사전 검증. GET. |
| 주문정보 조회(`getOrderList`) | ❌ SL 미지원 | 80 | — | — | **EC(계열사) 전용.** 일반 셀러 카탈로그에 없다. |
| 실시간 주문발생 여부 | ❌ SL 미지원 | 275 | — | — | 검색엔진에는 남아 있으나 SL 문서 백엔드가 **null 반환**. 폐기된 것으로 취급. |

### 상품 / 옵션 / 배송·반품 정책

| 기능 | 지원 | apiNo | 엔드포인트 | R/W |
|---|---|---|---|---|
| 상품 등록 | ✅ | 87 | `/v1/openapi/product/v1/product/registration/request` | **W** |
| 승인 상품 수정 | ✅ | 90 | `/v1/openapi/product/v1/product/modification/request` | **W** |
| 상품 목록 조회 | ✅ | 93 | `/v1/openapi/product/v1/product/list` | R |
| 상품 상세 조회 | ✅ | 94 | `/v1/openapi/product/v1/product/detail` | R |
| 재고 변경 | ✅ | 86 | `/v1/openapi/product/v1/item/stock/change` | **W** |
| 가격 변경 | ✅ | 91 | `/v1/openapi/product/v1/item/price/change` | **W** |
| 상품 판매상태 변경 | ✅ | 92 | `/v1/openapi/product/v1/product/status/change` | **W** |
| 단품(옵션) 판매상태 변경 | ✅ | 111 | `/v1/openapi/product/v1/item/status/change` | **W** |
| 승인상태 변경이력 | ✅ | 95 | `/v1/openapi/product/v1/product/approve/history/list` | R |
| 표준카테고리 조회 | ✅ | 205 | `https://onpick-api.lotteon.com/cheetah/econCheetah.ecn?job=cheetahStandardCategory` | R |
| 전시카테고리 조회 | ✅ | 206 | `…econCheetah.ecn?job=cheetahDisplayCategory` | R |
| 속성 조회 | ✅ | 203 | `…econCheetah.ecn?job=cheetahAttr` | R |
| 브랜드 조회 | ✅ | 204 | `…econCheetah.ecn?job=cheetahBrnd` | R |
| 공통코드 그룹/상세 | ✅ | 88 / 89 | `/v1/openapi/bocommon/v1/code/{getGroupCodeList,getDetailCodeList}` | R |
| 출고지/반품지 조회·등록·수정·삭제 | ✅ | 150 / 151 / 152 / 153 | `/v1/openapi/contract/v1/dvp/{getDvpListSr,registDvpSr,updateDvpSr,deleteDvpSr}` | R / W |
| 배송비정책 조회·등록·수정·삭제 | ✅ | 166 / 168 / 169 / 170 | `/v1/openapi/contract/v1/dvl/{getDvCstListSr,registDvCstSr,updateDvCstSr,deleteDvCstSr}` | R / W |
| 토큰 Identity 조회 | ✅ | 207 | `/v1/openapi/common/v1/identity` | R |

> `Sr` 접미사 = **판매자(Seller)용**. 접미사 없는 쌍둥이 API는 계열사용이다. 혼동 금지.

**상품정보제공고시 / 옵션 / 인증정보는 별도 API가 아니라 `상품 등록`(87) payload 내부 필드다:**

| 개념 | 87 payload 필드 | 근거(문서 원문) |
|---|---|---|
| 상품정보제공고시 | `pdItmsCd`(품목코드) + 고시 항목 배열 | *"23년 1월 상품정보제공고시 개정반영"*, 품목코드 23=유아동 |
| 인증정보(KC) | `sftyAthnLst[]` — `sftyAthnTypCd`, `sftyAthnNo`, `sftyAthn기관명`, `impPrxCd`(수입대행코드) | *"품목코드가 23번 유아동인 경우 표준카테고리에 따라 **안전인증목록이 필수값**이다"*, *"'KC인증'에 해당할 경우 수입대행코드는 필수 값이다"*. 유형: `CHL_ATHN/CHL_CFM`(어린이제품), `ELC_CFM`(전기용품), `LIFE_CFM`(생활용품), `KC_CHL_PKG` 등 |
| 옵션 | `spdLst[].` 단품 배열 | FAQ: *"한번 등록한 옵션값/옵션명은 수정이 불가능하고 상태(가격/재고/판매상태)만 수정 가능. 옵션 추가는 가능, 최대 500개"* |
| 카테고리 | `scatNo`(표준카테고리번호) **+** `dcatLst[]`(전시카테고리 목록, `mallCd='LTON'`, `lfDcatNo`) | **표준·전시 2중 카테고리.** 네이버/쿠팡의 단일 leaf와 구조가 다르다. |
| 거래처 | `trGrpCd`, `trNo`, (선택)`lrtrNo` | Identity API(207)로 조회 가능 |

### 배송

| 기능 | 지원 | apiNo | 엔드포인트 | R/W |
|---|---|---|---|---|
| 배송 처리 / 송장번호 등록 / 발송 처리 | ✅ | 137 | `/v1/openapi/delivery/v1/SellerDeliveryProgressStateInform` | **W** |
| 배송상태 통보 V2 | ✅ | 298 | `/v1/openapi/delivery/v2/SellerDeliveryProgressStateInform` | **W** |
| 송장 수정 | ✅ | 139 | `/v1/openapi/delivery/v1/SellerInvoiceNoModifyInform` | **W** |
| 발송약정일 통보 | ✅ | 138 | `/v1/openapi/delivery/v1/SellerDeliveryAppointmentInform` | **W** |
| 회수예외 통보 | ✅ | 141 | `/v1/openapi/delivery/v1/SellerRetrievalExceptionInform` | **W** |
| 롯데ON 배송상태 조회 | ✅ | 140 | `/v1/openapi/delivery/v1/SellerDeliveryProgressStateSearch` | R |

> **송장번호 등록은 독립 엔드포인트가 아니다.** 137에 배송상태코드 + 택배사코드 + 송장번호를 함께 실어 보낸다. 택배사/배송권역 코드는 공통코드 API(89)로 조회한다(예: `grpCd=DV_RGSPR_GRP_CD`).

### 취소 / 반품 / 교환 / 환불

| 기능 | 지원 | apiNo | 엔드포인트 | R/W |
|---|---|---|---|---|
| 취소요청(완료) 조회 | ✅ | 50 | `/v1/openapi/claim/v1/cancellationOpenApi/getCancellationRequestAndComplateList` | R |
| 취소요청 승인 / 거부 | ✅ | 60 / 59 | `…/cancellationOpenApi/{cnclRequestApproval,cnclRequestHold}` | **W** |
| 판매자 직접취소 | ✅ | 225 | `…/cancellationOpenApi/slrDirectCnclProc` | **W** |
| 구매확정 후 취소 조회 / 처리 | ✅ | 63 / 64 | `…/cancellationOpenApi/{purCfrmCnclSearch,purCfrmCncl}` | R / **W** |
| 클레임혜택 취소 조회 | ✅ | 128 | `…/cancellationOpenApi/purFvrCnclSearch` | R |
| 반품 요청/접수 목록조회 | ✅ | 51 | `/v1/openapi/claim/v1/returningOpenApi/returnRequestSearch` | R |
| 반품 승인 / 거부 | ✅ | 52 / 53 | `…/returningOpenApi/{returnRequestApproval,returnRequestHold}` | **W** |
| 반품(요청)취소 목록 조회 | ✅ | 67 | `…/returningOpenApi/returnWithdrawSearch` | R |
| 교환 요청/접수 목록조회 | ✅ | 69 | `/v1/openapi/claim/v1/exchangeOpenApi/exchangeSearch` | R |
| 교환 승인 / 거부 | ✅ | 71 / 72 | `…/exchangeOpenApi/{exchangeRequestApproval,exchangeRequestHold}` | **W** |
| 교환(요청)취소 목록 조회 | ✅ | 70 | `…/exchangeOpenApi/exchangeWithdrawSearch` | R |
| 미수령신고 조회 / 철회요청 | ✅ | 68 / 66 | `…/nonReceiptDeclareOpenApi/{noReceiveSearch,noReceiveCancelReq}` | R / **W** |
| **환불 (독립 API)** | ❌ **미지원** | — | — | — |

> **환불은 독립 API가 없다.** 취소/반품 승인의 부수 효과로 처리되고, 금액 확인은 정산 모듈(42~46: 주문내역/할인/배송비/차감/수수료)로 한다. "환불 처리" 버튼을 UI에 만들면 헛것이다.

### 그 외 SL 카탈로그 (이번 스프린트 범위 밖이지만 존재 사실만 기록)

판촉(PR, 6개) · 고객센터(CS, 11개: 판매자 연락/문의/보상) · 정산(SE, 6개) · 전시(DP, 홈쇼핑 편성표 4개) · 스마트픽(SPP, 픽업 8개) · e쿠폰(DV 163~165).

## 5-3. 읽기 API / 쓰기 API 구분 요약

**읽기(부작용 없음) — 안전:**
`207 Identity` · `209 주문조회` · `140 배송상태조회` · `272 장기미처리` · `208 발송가능여부` · `50/63/128 취소조회` · `51/67 반품조회` · `69/70 교환조회` · `68 미수령조회` · `93/94/95 상품조회` · `203/204/205/206 카테고리·속성·브랜드` · `88/89 공통코드` · `150/166 출고지·배송비정책 조회` · `245 주문혜택` · `42~46 정산`

**쓰기(부작용 있음) — 위험:**
`87 상품등록` · `90 상품수정` · `86 재고` · `91 가격` · `92/111 판매상태` · `210 연동완료통보` · `137/298 배송상태` · `138 발송약정일` · `139 송장수정` · `141 회수예외` · `52/53 반품승인·거부` · `59/60 취소승인·거부` · `64 구매확정후취소` · `71/72 교환승인·거부` · `66 미수령철회` · `225 판매자직접취소` · `151~153 출고지 CRUD` · `168~170 배송비정책 CRUD`

---

# 6. 쓰기 API 검증 수단 — **없다 (판매관리 한정 STOP-F)**

## 6-1. 샌드박스 조사 결과

| 소스 | 조사 범위 | 테스트/샌드박스 언급 |
|---|---|---|
| GetStarted 개발가이드 | 전문 | **없음.** "호출 도메인 주소: https://openapi.lotteon.com" 단일 도메인만 명시 |
| 이용안내(apiGuide) | 전문 | **없음.** 인증키 발급 절차는 운영계 하나뿐 |
| FAQ | 64건 전수 | **없음** (테스트/샌드박스/개발계/스테이징/시뮬/모의 전부 0건) |
| 공지사항 | 60건 전수 | **없음** |
| SL API 문서 | 115개 카탈로그 | **없음** |

## 6-2. 인프라는 있으나 셀러에게 열려 있지 않다 (직접 확인)

무자격 `GET /v1/openapi/common/v1/identity` 호출 결과:

| 호스트 | HTTP |
|---|---|
| `openapi.lotteon.com` | 401 |
| `stg-openapi.lotteon.com` | 401 |
| `test-openapi.lotteon.com` | 401 |
| `dev-openapi.lotteon.com` | DNS 없음 |

stg/test 환경은 **존재한다**. 그러나 판매자센터는 **운영 인증키만 발급**하고, stg/test용 키를 받는 경로가 문서에 없다. 키가 있어도 그 환경에 IP가 등록돼 있지 않으면 403이다. → **셀러 입장에서 샌드박스는 없는 것과 같다.** (문서사이트에도 `stg-api` / `dev-api` 미러가 있으나 그건 문서 SPA 환경이지 API가 아니다.)

## 6-3. 축별 판정

| 축 | 안전 검증 가능? | 근거 |
|---|---|---|
| **연결성**(키+IP 유효성) | ✅ **가능** | `207 Identity` — 파라미터 0개, 부작용 0. 쿠팡 `auth-test` / 네이버 `auth-test`와 정확히 같은 자리. |
| **읽기 전부** | ✅ 가능 | 부작용 없음 |
| **상품 쓰기** | ⚠️ **조건부 가능** | ① 등록 후 **2단계 승인**을 통과해야 노출된다(FAQ: *"상품 승인은 2가지... 2가지 모두 승인되어야 사용자 화면에 노출"*) ② `92 상품 판매상태 변경`으로 즉시 판매중지 가능 ③ 이 저장소는 이미 쿠팡/스마트스토어에서 같은 방식으로 실검증했다(DB 실측: `[TEST] Color Block Zipped Sweatshirt`). **기존 관행 그대로 적용 가능.** |
| **판매관리 쓰기** | ❌ **불가능 → STOP-F** | 테스트 주문을 만들 수단이 없다(주문 생성 API가 SL에 없다). `137 배송상태 통보`, `52 반품승인`, `60 취소승인`, `225 판매자직접취소`는 **실제 고객 주문**을 건드린다. 되돌릴 수 없고, 잘못 호출하면 고객 클레임이 된다. |
| **연동완료 통보(210)** | ❌ 불가능 | 주문을 상품준비중으로 **자동 전이**시킨다. 읽기(209)만 하고 210을 안 하면 주문이 조용히 취소/철회될 수 있다고 문서가 경고한다 — **"읽기만 하는 주문 수집"도 롯데ON 설계상 완전히 무해하지 않다.** |

---

# 7. 공통화 경계 (STEP 11 선행)

## 7-1. CEO 지시 재확인

> 공통화할 수 있는 것을 공통화하되, **단순히 3개 채널이 있다는 이유로 거대한 추상화 layer를 새로 만들지 않는다.**
> 이번 롯데ON 탭은 **임시 UI layer**다. 롯데ON 탭 구조가 향후 데이터 모델의 중심이 되면 안 된다.

이 저장소는 이미 이 판단을 한 번 내렸다 — `packages/marketplace/src/types.ts` 주석: *"하나의 CommerceAdapter 인터페이스로 강제 통합하지 않는다 — 지금 이 3그룹을 억지로 하나로 묶으면 SmartStore/Coupang의 이미 동작 중인 등록 코드를 전부 건드려야 한다."* **그 결정을 뒤집지 않는다.**

## 7-2. 공통 / 채널전용 초안 (Naver / Coupang / LotteON)

| 항목 | 판정 | 근거 |
|---|---|---|
| 상품명·브랜드·제조사 | **공통** | 3채널 모두 `CanonicalProduct` 그대로 |
| 가격 | **공통** | `resolveChannelListingPrice()` 단일 출처. 롯데ON도 `channelPriceOverrides["lotteon"]`로 붙는다. ⚠️ 단, 롯데ON은 **할인 전 가격 기준 수수료** 관행이 있어 pricing 엔진의 마진 계산은 별도 검증 필요 |
| 재고 | **공통** | 3채널 모두 단품 단위. ⚠️ 롯데ON은 재고 0 → 자동 품절 전이 |
| 대표/추가 이미지 | **공통** (상한만 다름) | Naver 20 / Coupang 9 / 롯데ON 문서 확인 필요 |
| 상세페이지 | **공통** | `DetailPageBlock[]` → `assembleContentsFromBlocks()` 이미 2채널 공유 |
| 상품정보제공고시 | **MAPPED** | 3채널 다 있으나 필드 구조가 전부 다름(Naver `productInfoProvidedNotice` 구조체 / Coupang `notices[]` 느슨 매칭 / 롯데ON `pdItmsCd`+고시항목 배열) |
| 옵션 | **MAPPED** | Naver `optionCombinations` / Coupang `items[]` / 롯데ON `spdLst` 단품. ⚠️ **롯데ON만 옵션명·옵션값 사후 수정 불가**(최대 500) |
| 원산지 | **MAPPED** | |
| KC 인증 | **MAPPED** (기존엔 SMARTSTORE_ONLY) | 롯데ON은 `sftyAthnLst[]`로 **필수**인 케이스가 있다(유아동 품목코드 23). 이 저장소의 주력 카테고리가 유아동이므로 **회피 불가**. 지금 Coupang은 의도적으로 KC를 payload에서 제외한다 — 롯데ON은 그럴 수 없다. |
| 카테고리 | **채널 전용** | Naver/Coupang은 leaf 1개. **롯데ON은 표준카테고리(`scatNo`) + 전시카테고리 목록(`dcatLst[]`) 2중 구조.** `CategorySelection`은 candidate 1개만 담는다. |
| 거래처(`trGrpCd`/`trNo`) | **롯데ON 전용** | Identity API로 조회 가능. 셀러 프로필성 값. |
| 출고지/반품지 번호, 배송비정책코드 | **롯데ON 전용** | 다만 개념은 Coupang `outbound_shipping_place_code`/`return_center_code`와 **같은 층**이다 — `coupang_seller_profiles`와 같은 자리에 들어간다. |
| 네이버쇼핑 검색정보 | **SMARTSTORE_ONLY** | 롯데ON/Coupang에 대응 개념 없음 |
| 홈쇼핑 편성표 / 스마트픽 / e쿠폰 | **롯데ON 전용, 범위 밖** | |

## 7-3. 기존 모델을 얼마나 건드려야 하는가 — **작다. 기계적이다.**

### 경로 A (권장, 이번 스프린트): `soon/` 네임스페이스에 얹는다 — **기존 모델 변경 0**

`packages/marketplace/src/soon/types.ts`에 이미 `NextGenMarketplaceAdapter<TPayload>` 계약이 있다:

```ts
readonly id / label / status: "SOON"
resolveConnectionStatus(hasCredentials) : SoonConnectionStatus
resolveCategory / resolveOptions / resolveAttributes / resolveDelivery
buildPayload / validate / register
```

파일 주석이 명시한다: *"SmartStore/Coupang의 기존 어댑터는 이 인터페이스를 구현하도록 리팩터링하지 않는다 — 새 마켓플레이스만 이 계약으로 시작한다."*
→ **`PlatformId`를 건드리지 않고**, `lotteon-soon.adapter.ts` 하나 + `/api/platform-status`에 한 줄로 롯데ON을 "탭 없이" 붙일 수 있다. **임시 UI layer라는 CEO 요구에 정확히 맞는 자리다.**

### 경로 B (실등록까지 갈 때): `PlatformId`에 `"lotteon"` 추가

TS 소진 검사 때문에 **컴파일 에러로 드러나는 자리**는 다음 9곳 + 목록 3곳뿐이다(전수 확인):

```
packages/shared/src/product-types.ts:458            PlatformId 유니언
packages/marketplace/src/registry.ts:7,13           PLATFORM_ADAPTERS, PLATFORM_ORDER
packages/marketplace/src/capabilities.ts:33         MARKETPLACE_DESCRIPTORS
packages/listing/src/registry.ts:8                  LISTING_EXECUTORS
packages/category/src/platform-categories/index.ts:10  PLATFORM_CATEGORY_TABLES
apps/admin/src/app/api/snapshots/_lib/types.ts:51   categoryMappings
apps/admin/src/app/pipeline/commerce/registration-channels.ts:38
apps/admin/src/app/pipeline/CommerceWorkspace.tsx:112,118,124,1130
apps/admin/src/app/api/snapshots/_lib/compute-readiness.ts:98  SUPPORTED_PLATFORMS
packages/marketplace/src/field-capability-matrix.ts  FieldCapabilityRow에 lotteon 컬럼(13행)
apps/admin/src/app/settings/page.tsx:2831            플랫폼 라벨 목록
```

`elevenst`가 이미 이 모든 자리를 채우고 `createNotImplementedExecutor()`로 안전하게 실패하는 선례를 만들어 두었다. **`CanonicalProduct` 자체는 한 줄도 바뀌지 않는다.**

### 실제로 확장이 필요한 곳 — **2개뿐**

1. **`commerce_accounts.platform` CHECK 제약** — `('naver','coupang')` → lotteon 추가 마이그레이션 1줄. 컬럼은 재사용 가능하다(롯데ON은 `Authorization: Bearer {키}` 하나 + 거래처번호 → `access_key` + `seller_id`/`vendor_id`에 매핑되거나, 깔끔하게 신규 컬럼 1~2개).
2. **2중 카테고리(표준 + 전시)** — `CategorySelection`은 candidate 1개만 담는다. 단, **선례가 있다**: Naver도 `leafCategoryId` 말고 `addressIds`/`originAreaCode`/`childCertificationInfoId`/`attributes`를 `CategorySelection`이 아니라 채널 전용 `NaverPayloadInput`에 담는다. 롯데ON의 `dcatLst[]`도 같은 방식으로 `LotteOnPayloadInput`에 담으면 **공통 모델은 안 건드린다.**

> **결론: 대규모 변경은 필요 없다. STOP-B 미발동.**

## 7-4. 장기(체크박스 UI)에 대한 메모

CEO가 말한 `☑스마트스토어 ☑쿠팡 ☑롯데ON` 체크박스 모델은 지금 구조와 **충돌하지 않는다** — `PLATFORM_ADAPTERS`/`LISTING_EXECUTORS`가 이미 레지스트리이고 `CommerceWorkspace`는 `PLATFORM_ORDER`를 순회할 뿐이다. 탭→체크박스는 UI 레이어 교체다.
다만 그 전에 **§3의 구멍(상품↔채널 매핑 테이블 부재, 채널별 등록 상태 부재)을 먼저 메워야 한다.** 체크박스는 "이 상품이 어느 채널에 지금 살아 있는가"를 보여주는 UI인데, 그 값을 담을 테이블이 지금 없다.

---

# 8. STOP 판정

| 코드 | 조건 | 판정 | 근거 |
|---|---|---|---|
| **STOP-A** | 롯데ON 인증이 기존 credential architecture와 충돌 | **미발동** | 롯데ON은 정적 Bearer 키 하나 + IP allowlist다. 쿠팡 HMAC·네이버 bcrypt+OAuth보다 **단순하다**. `commerce_accounts` 스키마에 그대로 들어간다(CHECK 제약 1줄만 확장). **IP allowlist도 이미 충족 가능하다** — `apps/admin/src/lib/outbound-proxy.ts`가 OCI Tinyproxy(161.33.39.233) / Fixie로 고정 egress를 이미 쓰고 있다. ⚠️ 단 두 가지 부대조건: ① **키 1년 만료**(쿠팡/네이버엔 없는 운영 부담 — 만료 알림/교체 절차 필요) ② 프록시 IP가 바뀌면 즉시 403 — **프록시 IP를 롯데ON에 등록해야 하며, 프록시를 바꾸면 롯데ON도 같이 바꿔야 한다.** |
| **STOP-B** | 상품등록을 위해 기존 공통 상품 모델을 대규모 변경해야 함 | **미발동** | `CanonicalProduct` 변경 0. 확장 필요한 곳은 `commerce_accounts` CHECK 1줄 + 2중 카테고리를 채널 전용 PayloadInput에 담기(Naver 선례 그대로). `PlatformId` 확장 시 컴파일 에러로 드러나는 자리 12곳은 전부 기계적이고 `elevenst` 선례가 있다. |
| **STOP-C** | 판매관리 API가 문서와 실제 동작에서 불일치 | **판정 불가 (증거 없음)** | 인증키가 시스템에 없어 실호출을 하지 못했다. 문서 자체의 내부 모순은 2건 확인됨(① 접속 제한 "분당 10,000" vs "10초당 10,000" ② `실시간주문발생여부`(275)가 검색엔진엔 있으나 SL 문서 백엔드는 null). **문서↔실동작 불일치는 인증키 투입 후 읽기 API로만 판정 가능하다.** 지금 발동/미발동 어느 쪽으로도 결론 내리지 않는다. |
| **STOP-F** | 쓰기 API를 Production에서 안전하게 검증할 방법이 없음 | **⚠️ 부분 발동 — 판매관리 축에 한해 발동** | 샌드박스 없음(문서/FAQ/공지 전수 확인). stg/test 호스트는 존재하나 셀러용 키 발급 경로 없음. **상품 축**은 2단계 승인 + 판매중지 전환으로 기존 쿠팡/스마트스토어와 동일하게 검증 가능 → 쓰기 진행 가능. **주문/배송/클레임 축**은 테스트 주문 생성 수단이 없고 실제 고객 주문을 되돌릴 수 없게 바꾼다 → **읽기까지만 구현하고 쓰기는 STOP.** 특히 `210 연동완료통보`는 "읽기만 하는 주문 수집"조차 완전 무해하지 않게 만든다. |

---

# 9. 구현 범위 제안 (이번 스프린트 — **구현하지 말 것**)

STOP-F 부분 발동을 반영한 제안이다. 순서대로다.

**Phase 0 — 전제(코드 아님)**
- CEO가 롯데ON 판매자센터에서 **프록시 egress IP를 IP allowlist에 등록**. 값 확인은 `/api/diagnostics/proxy`(host/port만 노출)로 가능.
- 인증키를 설정 화면으로 입력할 수 있게 되기 전까지는 아무것도 검증 못 한다.

**Phase 1 — 설정 축 (쓰기 없음, 위험 0)**
1. `commerce_accounts.platform` CHECK에 `'lotteon'` 추가 (마이그레이션 1줄) — 또는 롯데ON 전용 컬럼 최소 추가(`api_key`, `trader_no`)
2. `/api/settings/lotteon` GET/POST/DELETE — 기존 naver 라우트 복제 수준
3. `/api/lotteon/auth-test` — **`GET /v1/openapi/common/v1/identity` 단 하나.** 키+IP 유효성 + 거래처번호(`trNo`) 확인까지 한 번에 된다. 쿠팡/네이버 auth-test와 동형.
4. 설정 화면 `CommerceAccountManager`에 아코디언 1개 추가

→ 이 단계에서 **STOP-C 판정이 처음으로 가능해진다.**

**Phase 2 — 읽기 축 (부작용 0)**
5. `/api/lotteon/category-tree` — `onpick-api` 표준/전시 카테고리 조회(별도 호스트라 client 하나 더 필요)
6. `/api/lotteon/product-status` — `93/94`로 등록 상품 상태 조회
7. 주문 **조회 전용** 화면: `209 SellerDeliveryOrdersSearch` + `140` + `272`
   **⚠️ `210 연동완료통보`는 절대 호출하지 않는다.** 읽기 전용임을 UI에 명시하고, "실제 주문 처리는 롯데ON 판매자센터에서 하십시오" 안내를 붙인다.
8. 클레임 **조회 전용**: `50 / 51 / 69` 목록조회

**Phase 3 — 상품 등록 쓰기 (조건부)**
9. `buildLotteOnPayload()` + `validateLotteOnPayload()` — `packages/listing/src/lotteon/`
10. `lotteonAdapter` + `lotteonExecutor` + `PlatformId` 확장(§7-3 경로 B의 12곳)
11. `/api/lotteon/payload-preview` → `/api/lotteon/register`(DRY_RUN/LIVE 분기, `logRegistrationAttempt` 재사용)
12. 첫 실등록은 **판매중지 상태 테스트 상품 1건**으로. 쿠팡/스마트스토어 때와 동일 관행.

**Phase 4 — 하지 않는다 (STOP-F)**
- `210` 연동완료통보 · `137/298` 배송상태 통보 · `139` 송장수정 · `52/53` 반품 승인·거부 · `59/60` 취소 승인·거부 · `71/72` 교환 승인·거부 · `225` 판매자직접취소 · `64` 구매확정후취소
- 이 목록은 **롯데ON이 테스트 주문 수단을 제공하거나, CEO가 "실주문 1건을 희생해도 된다"고 명시적으로 승인하기 전까지 구현 금지.**

**범위 밖(이번 스프린트 명시 제외)**: 환불 전용 기능(API 없음) · 판촉 · 정산 · 홈쇼핑 · 스마트픽 · e쿠폰 · 11번가 · 매칭 트랙

---

# 10. CEO 필요 행동

1. **[필수·차단] 롯데ON 판매자센터에 서버 IP 등록** — 등록할 IP는 Vercel IP가 아니라 **아웃바운드 프록시의 egress IP**다(현재 OCI Tinyproxy `161.33.39.233`, 폴백 Fixie). 프록시를 바꾸면 롯데ON 쪽도 같이 바꿔야 한다. 다중 IP는 세미콜론 구분, CIDR 가능.
   - 판매자센터 > 판매자정보 > OpenAPI관리 > 정보설정 > **서버 IP 등록**(셀러툴사 선택이 아니라 직접 입력)
2. **[필수·차단] 인증키를 시스템에 입력** — 현재 이 시스템 어디에도 없다. Phase 1 설정 화면이 생긴 뒤 CEO가 직접 붙여넣어야 한다(CTO가 값을 받아서 넣지 않는다).
3. **[운영] 인증키 만료 관리 체계** — 1년 만료, 거래처당 최대 3개. 쿠팡/네이버에는 없던 새 운영 부담이다. 만료 3개월 전 알림 → 신규 발급 → 시스템 교체 → 구 키 삭제. 놓치면 연동이 조용히 죽는다.
4. **[의사결정] 판매관리 쓰기 범위** — STOP-F 때문에 이번 스프린트는 주문/배송/클레임을 **조회만** 한다. 쓰기까지 가려면 "실제 고객 주문 1건으로 검증해도 된다"는 CEO의 명시적 승인이 필요하다. 승인 없으면 Phase 4는 영구 보류다.
5. **[선택·장기] 롯데ON에 stg/test 환경 키 발급 가능 여부 문의** — `stg-openapi.lotteon.com` / `test-openapi.lotteon.com`은 실재한다(401 응답 확인). 셀러에게 열어주는 경로가 있는지는 문서에 없다. 스토어센터 1:1 문의 또는 `apitool@lotte.net`으로 물어볼 가치가 있다. 열린다면 STOP-F가 해제된다.

---

# 11. 확인하지 못한 것

정직하게 적는다. 아래는 **추정하지 않았고, 위 결론에도 반영하지 않았다.**

1. **실제 API 동작 일체.** 인증키가 시스템에 없어 인증이 필요한 호출을 단 1회도 하지 못했다. 위 §5의 모든 내용은 **공개 문서 기반**이며, 문서와 실동작의 일치 여부는 **미확인**이다(STOP-C 판정 불가의 이유).
2. **`onpick-api.lotteon.com` 카테고리 API의 인증 요구 여부.** 다른 호스트이고 쿼리 문법도 다르다(`job`/`skip`/`limit`/`filter_N`). Bearer 키를 받는지, 공개인지 확인 못 했다.
3. **`returnCode` 전체 코드표.** 문서는 "0000, 1001, 1002 … 밑에 참조"라고 하고 개별 API 문서마다 부분 목록만 준다. 통합 에러 코드표를 찾지 못했다.
4. **접속 제한 실제 값.** 문서 2곳이 "분당 10,000", FAQ가 "10초당 10,000"으로 모순된다. 실측 불가.
5. **롯데ON 이미지 요구사항**(개수 상한/해상도/호스팅 정책). 87 payload 전문을 다 펼치지 않았다. 2026-07-01 공지 *"상품기술서 내 임시 이미지 URL 사용 제한"*이 있으니 등록 구현 전 반드시 확인해야 한다.
6. **표준카테고리 ↔ 전시카테고리 매핑 난이도.** 문서상 "속성모듈 API로 표준카테고리에 매핑된 전시카테고리를 받아 하나 이상 선택"이라고 하나, 실제 트리 규모와 이 저장소 카테고리 추천기와의 접합 비용은 미평가다.
7. **`registration_attempts.response` jsonb 안에 채널 옵션 ID가 실제로 들어 있는지.** 표본 4건의 앞 300자만 확인했고 전체 구조는 열어보지 않았다.
8. **셀러툴사 등록(`apitool@lotte.net`, 1~2주)이 이번 케이스에 필요한지.** 이용안내상 "서버 IP 등록 **또는** 셀러툴사 선택"이므로 **자사 계정 직접 연동에는 IP 등록만으로 충분해 보인다.** 다만 확정하지 못했다 — CEO가 이미 키를 발급받았다면 이 경로는 이미 통과했을 가능성이 높다.
9. **`price_breakdown`(010) 마이그레이션 미실행이 롯데ON 등록에 미치는 영향.** 기존 2채널과 동일 조건이므로 신규 리스크는 아니나, 롯데ON 등록 로깅도 같은 폴백을 타게 된다.

---

# 12. 구현 중 확정된 사실 (LOTTEON SPRINT 2 Phase 1·2·3, 2026-09-14)

§11 "확인하지 못한 것" 중 일부가 **구현 과정에서 실제로 확인됐다.** 근거를 함께 적는다.
여전히 미확인인 것은 §12-3에 남긴다.

## 12-1. 해소된 항목

| §11 번호 | 항목 | 확인 결과 | 근거 |
|---|---|---|---|
| 2 | `onpick-api.lotteon.com` 인증 요구 여부 | **인증 필요.** 같은 Bearer 인증키를 요구한다 | 2026-09-14 무자격 probe 실측 — `Authorization` 없음 → **HTTP 401**, 잘못된 Bearer → **HTTP 401**. 문서(205/206/203/204)의 Status Message 표에도 401 "등록되지 않은 OpenAPI Key" 존재 |
| 2 | onpick-api 응답 규약 | **`{returnCode,…}` 봉투가 아니다.** `{ "itemList": [ { "data": {…}, … } ] }` | 205/206/203/204 문서 Response Sample |
| 7 | 등록 응답에 옵션(단품) ID가 있는가 | **없다.** `87` 응답 Received Message는 `epdNo / spdNo / resultCode / resultMessage` 4개뿐 | 87 문서 원문. 단품번호(`sitmNo`)는 `93 상품 목록 조회`의 `sitmNoLst`로만 얻는다 |
| — | `209` 조회 기간 상한 | **1일을 초과할 수 없다** (returnCode `2003`) | 209 문서 Return Message 표 |
| — | `209` HTTP 메서드/파라미터 | **POST**, body `{srchStrtDt, srchEndDt, odNo, odPrgsStepCd, odTypCd, lrtrNo, ifCplYN}` | 209 문서 Request Parameters |
| — | `207` 응답 | `data.{trGrpCd, trDvsCd, trNo, trNm}` — 상품등록(87)·상품목록(93)의 필수 거래처 값이 여기서 나온다 | 207 문서 |
| — | `50/51/69` 파라미터 | 셋 다 POST, `srchStrtDttm`/`srchEndDttm` **필수**, 응답은 `data[]` 안에 `odNo/cmNo/itemList[]` | 50·51·69 문서 |
| — | `93` 필수 파라미터 | `trGrpCd`·`trNo`(=207 결과) + `regStrtDttm`/`regEndDttm` + `pageNo`/`rowsPerPage` | 93 문서 |
| — | 2단계 승인의 실제 필드 | `catAprvStatCd`(카테고리 승인) + `pdInfoAprvStatCd`(상품정보 승인) → `fnlAprvYn` | 93 문서 |
| — | KC 유형별 `impPrxCd` 필수 여부 | 문서 표의 "수입대행코드 필수" 비고가 붙은 15종만 필수. 어린이제품 `CHL_ATHN/CHL_CFM/CHL_SUPS`와 `CHEM_*`는 **불필요** | 87 문서 `sftyAthnTypCd` 표 |
| 5 | 롯데ON 이미지 요구사항 | 단품당 **최대 10개**, 확장자 **jpg/jpeg/png**. 상세페이지 HTML에 `doc-pub.lotteon.com/ec/public` 경로를 넣으면 **이미지가 사라진다**(임시/비영구 저장 경로) | 87 문서 `itmImgLst` · `epnLst.cnts` 주의사항 |

재현 방법(무인증, 누구나 가능):
```
GET https://soapi.lotteon.com/soapi/v1/openapi/o/apiguide/getApiGuideDetailInfo
    ?apiNo={207|209|50|51|69|93|94|87|203|204|205|206}&apiMjrVerCd=V1&apiMnrVerNm=1.0&mdulDvsCd=SL
```

## 12-2. 구현 결정 (조사 §7 초안 대비 확정본)

- **`PlatformId`를 넓히지 않았다.** 롯데ON은 `packages/marketplace/src/soon/`의
  `NextGenMarketplaceAdapter` 계약으로 구현했다(CPO 확정). 계약은 marketplace에,
  구현은 `packages/listing/src/lotteon/`에 둔다(listing → marketplace 단방향 의존).
  `CanonicalProduct` 변경 **0줄**.
- `NextGenMarketplaceAdapter.status`만 `"SOON"` → `"SOON" | "LIVE"`로 **넓혔다**(1줄).
  기존 11번가/ESM 어댑터는 변경 0줄.
- 롯데ON 전용 값은 전부 `LotteOnChannelConfig`(채널 전용 입력)에 담았다 —
  Naver `NaverPayloadInput` 선례 그대로.
- 가격은 `resolveListingPrice()` / `computeVariantFinalPriceKrw()` 기존 단일 출처만 쓴다.
  단, 롯데ON `itmLst[].slPrc`는 **차액이 아니라 절대 판매가**다(Naver와 반대).

## 12-3. 여전히 확인하지 못한 것

1. **실제 API 동작 일체.** 인증키가 아직 시스템에 없어 인증이 필요한 호출을 단 1회도 하지 못했다.
   위 12-1은 전부 **공개 문서 원문**이며, 문서↔실동작 일치 여부는 미확인이다(STOP-C 판정 불가 유지).
2. `returnCode` **통합** 코드표. API별 부분 목록만 확인했다(209: 0000/2000/2001/2002/2003/9000/9001/9002,
   207: 0000/3000).
3. 접속 제한 실제 값(문서 간 모순 유지 — 207 문서는 429 메시지에 "1분 후", 209 문서는 "00분 후").
4. 표준↔전시 카테고리 트리의 실제 규모와 이 저장소 카테고리 추천기와의 접합 비용.
5. `pdArtlCd`(고시 항목코드) 코드표 — 품목코드마다 다르고 문서에 통합 표가 없다. 그래서
   **자동 생성하지 않고** 셀러 입력으로 받는다.

---

# 13. SPRINT 3 갱신 (2026-09-14)

## 13-1. 범위 변경

CEO가 **판매관리를 제품 범위에서 제거**했다. §2·§5-2의 주문/클레임 조사 결과는
그대로 유효하지만, 그 축의 **구현물은 저장소에서 삭제**됐다.
삭제 범위와 복원 방법은 `docs/lotteon-commerce-sprint-3-scope-reversal.md`에 있다.
**210 guard는 삭제하지 않았다** — 이유는 같은 문서 §3.

## 13-2. STOP-C — **여전히 판정 불가** (§12-3-1 유지)

Sprint 3에서도 롯데ON 실 API를 **단 1회도 호출하지 못했다.** 이유가 §12-3 때와
다르다. 그때는 "인증키가 시스템에 없어서"였고, 지금은 **우리 앱에 로그인할 수단이
에이전트에게 없어서**다.

실측(2026-09-14, 배포본 `https://commerce-platform-mocha.vercel.app`):

| 호출 | 결과 |
|---|---|
| `GET /api/settings/lotteon` | **HTTP 401** `{"ok":false,"error":"로그인이 필요합니다."}` |
| `POST /api/lotteon/auth-test` | **HTTP 401** (동일) |
| `GET /api/lotteon/categories?job=cheetahStandardCategory` | **HTTP 401** (동일) |
| `GET /login` | HTTP 200 (배포 자체는 정상) |

BETA-SECURITY-2 §15 이후 `/api/*` 전체가 `src/proxy.ts`의 Seller 인증(Supabase
세션 쿠키) 뒤에 있다. 롯데ON 라우트 자체의 문제가 아니다 — Naver/Coupang 라우트도
같은 401을 준다. 로컬 dev 서버도 대안이 되지 못한다: `apps/admin/.env.local`에는
`QA_PROXY_TO_PROD=1` 하나뿐이라 Supabase 설정이 없고, `QA_PROXY_TO_PROD` 경로는
API 호출을 프로덕션으로 넘기므로 같은 401에 도달한다.

따라서 다음 셋은 **이번에도 확인하지 못했다** — 추정으로 채우지 않는다:

1. `207` 실 응답(문서의 `data.{trGrpCd,trDvsCd,trNo,trNm}`과 일치하는가)
2. onpick `205/206` 실 응답의 **필드명** — 그래서 카테고리 조회 결과 표시는
   "알아보면 선택지로, 못 알아보면 원문 그대로"로 구현했다
   (`describeLotteOnCategoryItem()`이 추측이라는 사실을 숨기지 않는다)
3. `87` 상품등록의 실제 동작 및 `returnCode` 실값

해소 조건은 하나다: **인증된 세션에서 읽기 API(207/93/onpick)를 호출할 수 있으면
된다.** 등록(87)까지 가지 않아도 STOP-C 판정은 가능하다.

---

# 14. SPRINT 4 갱신 (2026-09-14) — 카테고리 응답 스키마 확보 · 경계 판정

## 14-1. §12-3 미해결 항목 중 해소된 것

**확보 방법(무인증, 누구나 재현 가능 — §12-1과 같은 경로):**
```
GET https://soapi.lotteon.com/soapi/v1/openapi/o/apiguide/getApiGuideDetailInfo
    ?apiNo={205|206|87}&apiMjrVerCd=V1&apiMnrVerNm=1.0&mdulDvsCd=SL
→ data.apiGdeCnts (HTML)에 Received Message 표 + Response Sample(json) 전문이 들어 있다
```

| §12-3 | 항목 | 확인 결과 |
|---|---|---|
| 4 | 표준↔전시 카테고리 접합 비용 | **작다. 접합이 필요 없다.** 205 응답의 `disp_list[]`가 그 표준카테고리에 매핑된 전시카테고리(`disp_cat_id`)를 직접 준다. 87의 `dcatLst`에는 그중 1개 이상을 넣는다 → **전시카테고리를 따로 추천/검색할 필요가 없다** |
| 5 | `pdItmsCd`(고시 품목코드) | **카테고리가 알려준다.** 205 응답의 `pd_Itms_list[].pd_Itms_cd`. 유아동(23) 여부가 여기서 드러난다 — 셀러가 찾아 넣을 필요가 없다. ⚠️ `pdArtlCd`(고시 **항목**코드) 코드표는 여전히 미확인 |

## 14-2. 205 표준카테고리 응답 — 문서 원문 필드 (구현이 쓰는 이름)

```
std_cat_id · std_cat_nm · upr_std_cat_id · depth_no · leaf_yn · use_yn
disp_list[]    { mall_dvs_cd, std_cat_id, disp_cat_id }   → 87 dcatLst 후보
pd_Itms_list[] { std_cat_id, pd_Itms_cd }                 → 87 pdItmsCd
   ⚠️ 문서 표는 pd_Itms_list, 같은 문서의 Response Sample은 pd_itms_list —
      어느 쪽이 실제인지 확인 못 해서 파서가 둘 다 읽는다
attr_list[]    { attr_pi_type(P=scatAttrLst / I=itmOptLst), attr_id, prio_rnk }
tdf_cd → 87 tdfDvsCd · age_limit_cd → 87 ageLmtCd
chl_athn chl_cfm chl_sups elc_athn elc_cfm elc_sups life_athn life_cfm
life_sups life_std cmcn_athn cmcn_reg cmcn_tntt chem_life chem_bioc etc
   → 이 카테고리가 요구하는 87 sftyAthnTypCd 유형
```

206 전시카테고리: `disp_cat_id · disp_cat_nm · upr_disp_cat_id · depth_no ·
leaf_yn · mall_dvs_cd · disp_yn · use_yn` + 브랜드/거래처 제어 목록.

🔴 **`elc_athn`(205) → `ELC_AHTN`(87)** — 87 공통코드표의 철자가 `ELC_AHTN`이다.
오타로 보여도 고치면 안 된다(고치면 롯데ON이 모르는 코드가 된다).

## 14-3. 확인된 결함 — 카테고리 조회가 깊이번호를 카테고리번호로 넣고 있었다

SPRINT 3의 `describeLotteOnCategoryItem()`은 필드명을 정규식으로 짐작했다
(`/(^|_)(scat|dcat|cat)?_?no$/i` → 폴백 `/no$/i`). 205/206 응답의 첫 필드가
`depth_no`라서 **그 정규식이 깊이번호에 먼저 걸린다** — 셀러가 조회 결과를
누르면 `scatNo`에 `"3"`이 들어간다. 문서 원문 필드로 교체했고, 회귀 테스트로
고정했다(`lotteon-sprint4-boundary.test.ts`).

## 14-4. 경계 판정 — **A** (공통 구조 변경 불필요)

| 축 | 판정 |
|---|---|
| 공통 상품정보를 롯데ON 탭이 재입력받는가 | **아니다.** 입력칸이 없다(렌더 테스트로 고정) |
| 스마트스토어/쿠팡이 공통정보를 재입력받는가 | **아니다.** Naver 고시는 `CanonicalProduct`+SellerProfile에서 전부 파생되고(`naver/build-payload.ts`), Coupang 고시도 동의어 매칭으로 파생된다. 쿠팡의 `CategoryRequirementsEditor`는 **덮어쓰기**를 `product.categoryFieldOverrides`(공통 모델)에 저장한다 — 사본이 아니라 한 벌이다 |
| 공통 모델이 경계를 지원하는가 | **한다.** 소재·색상·제조사·원산지·취급방법·권장연령·품명·모델명·수입사·`certificationType`·`childCertification`이 전부 `CanonicalProduct`에 있다 |

→ **A. 공통 구조 변경 0.** 롯데ON이 그 값을 **읽지 않고 있었을 뿐**이다.

## 14-5. 다만 — readiness 계산에 책임 혼재가 있다 (이번에 고치지 않음)

CEO가 스크린샷에서 짚은 "상품 준비 상태와 채널 등록 상태가 한 화면에 섞였다"는
문구 문제가 아니라 **계산 문제**다. 실측:

| 위치 | 사실 |
|---|---|
| `CommerceWorkspace.tsx:1375` `commonInfoLevel` | 상품 전용이다(title/images/priceValidity/brand/description). 채널 입력 0 — **정상** |
| `CommerceWorkspace.tsx:1433` `categoryVerified` | `Object.values(categoryMappings).some(isVerifiedCategorySelected)` — **어느 한 채널이라도** 확정이면 true. 이 값이 상품정보 탭의 "등록할 카테고리를 확정해주세요"(`StageBody.tsx:436`)를 켠다 → 쿠팡만 확정해도 상품 수준에서 "확정됨"이 된다 |
| `provisionalReadiness`(`~1141`) · `resolveRegistrationReadinessState` | 채널 상태를 계산하면서 **상품 수준** `priceValid`를 채널마다 그대로 재사용한다 |
| `compute-readiness.ts:308` 주석 | *"최종 등록 게이트(register route)는 이 계산을 그대로 쓰지 않으므로 이 카드는 1차 판단"* — 저장소가 이미 인정하고 있다 |

이것을 고치면 스마트스토어/쿠팡의 준비도 표시가 함께 바뀐다 = **공통 구조
변경**이라 이번 작업에서 손대지 않았다(지시: "공통 구조를 바꿔야 하면 영향
범위를 먼저 보고하고 멈춰라"). 롯데ON은 이 혼재된 값을 **쓰지 않는다** — 자기
등록 가능성을 `validateLotteOnPayload` 결과에서만 계산한다.

## 14-6. 쿠팡 쪽 기존 결함(확인만 — 이번 범위 아님)

`decision === "AUTO_SELECT"`여도 캐시 하이드레이트가 `selectCategory()`를
부르지 않아 `categoryMappings`가 `UNRESOLVED`로 남는다
(`CommerceWorkspace.tsx` 하이드레이트 effect). 롯데ON에는 같은 구멍을 만들지
않았다 — 추천 후보를 누르면 그 자리에서 폼에 반영된다.

## 14-7. STOP-C — 여전히 판정 불가

카테고리 **응답 스키마**는 문서 원문으로 확보했지만 **실동작**은 여전히 0회다.
`/api/*` 전체가 Seller 세션 뒤에 있고(§13-2) 에이전트에게 로그인 수단이 없다.
그래서 파서는 문서 원문 필드로 읽고, 못 읽으면 원문을 그대로 보여준다.
`unrecognizedCount`를 응답과 화면에 실어 **"몇 건을 못 읽었는지"를 숨기지
않는다.**
