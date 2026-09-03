# P-34 STEP 1 — Registration Lifecycle & Monitoring 사실관계 조사

- 작성: CTO
- 작성일: 2026-09-03
- 성격: **조사 전용. 코드 변경 0건 · DB 마이그레이션 0건 · 외부 상품/가격/DataLab API 호출 0회**

---

## 산출물 1. 현재 등록 생애주기의 실제 구조

코드상 존재하는 상태 저장소는 **3개**이고, 서로 다른 층위를 담당한다.

| 저장소 | 값 | 층위 | 갱신 주체 |
|---|---|---|---|
| `product_snapshots.status` | `IN_PROGRESS` \| `REGISTERED` | 스냅샷 단위 단일 플래그 | 등록 성공 시 |
| `registration_attempts.status` | `SUBMITTED` \| `FAILED` | 플랫폼별 **제출 시도** 이력 | 등록 API 호출 시 |
| 플랫폼 실제 상태 | (미저장) | 검수중/승인/판매중 | **없음** |

### 이미 존재하는 연결 프리미티브 ✅

```ts
// apps/admin/src/app/api/snapshots/_lib/registration-status.ts
export async function getRegisteredPlatforms(snapshotId: string): Promise<Set<PlatformId>>
//   registration_attempts WHERE snapshot_id = ? AND status = 'SUBMITTED'
```

이 함수가 이미 **"어느 플랫폼에 실제로 등록됐는가"**를 정확히 돌려준다. P-34 1순위(감시 대상 전환)에 필요한 조회는 사실상 이미 구현돼 있고, 방향만 뒤집으면 된다(스냅샷→플랫폼 대신 전체 등록 스냅샷 목록).

이 파일 주석에는 **프로덕션 실측 근거**도 남아 있다: *"Hamster Kid Cap은 Coupang에는 실제로 등록됐지만(2026-08-03~09, registration_attempts 확인) SmartStore/Naver는 KC 미확정으로 BLOCKED"*. 즉 `registration_attempts`에 `snapshot_id`가 채워진 실제 데이터가 최소 1건 존재했음이 문서로 남아 있다(현재 상태는 §2에서 UNKNOWN으로 분류).

### 생애주기의 끊어진 지점 🔴

```
판매 판단 → 등록 준비 → SUBMITTED → [ 여기서 끊김 ] → 승인 → 판매중 → 모니터링
```

`SUBMITTED`는 **영구 상태**다. 제출 이후를 표현할 값도, 갱신하는 코드도 없다.

---

## 산출물 2. 프로덕션 DB 사실관계

### ⛔ 직접 조회 불가 — 정직 고지

로컬에 Supabase 자격증명이 없고(`.env.local` 키 1개, NAVER/SUPABASE 없음), `vercel env pull`은 이 세션에서 **권한 차단**되었습니다. **읽기 전용 조회조차 제 권한으로는 실행 불가능**합니다.

따라서 아래 표는 CPO 지시대로 **추정 없이** 분류했습니다.

| 대상 | 분류 | 근거 |
|---|---|---|
| `registration_attempts` 기본 컬럼 (003) | **CODE ONLY** | 마이그레이션 파일 + 코드가 사용 |
| `product_name` / `external_product_id` / `payload` / `response` (006) | **CODE ONLY** | 〃 |
| `compliance_*` (007) · `brand_resolution` (009) · `price_breakdown` (010) · `category_resolver_kpi` (011) | **CODE ONLY** | 코드가 컬럼 부재를 폴백으로 감수 중 |
| `snapshot_id` (016) | **UNKNOWN** | 문서상 2026-08 관측 근거는 있으나 현재 적용 상태 미확인 |
| `job_key` (025) | **UNKNOWN** | 025는 `product_snapshots` · `registration_attempts` · `support_inquiries` · `seller_compliance_confirmations` 4개 테이블에 추가 |
| 실제 행 수 / 플랫폼 분포 / status 분포 | **UNKNOWN** | 조회 불가 |
| `external_product_id` null 비율 | **UNKNOWN** | 조회 불가 |
| 최근 등록 시점 | **UNKNOWN** | 조회 불가 |

### ✅ CEO가 SQL 없이 확인하는 방법 (권장)

이미 만들어진 **관리자 API**가 정확히 이 데이터를 돌려줍니다. 읽기 전용이고, `middleware.ts`가 세션 쿠키로 보호하므로 **로그인된 브라우저에서 URL만 열면** 됩니다.

```
https://<프로덕션도메인>/api/admin/registrations
```

- 최근 **100건**의 `registration_attempts`를 `select("*")`로 반환
- **응답 JSON의 키 목록이 곧 프로덕션 실제 스키마**입니다 → `snapshot_id` / `job_key` 키가 보이면 마이그레이션 016 / 025 적용 확정
- 특정 상품만: `?snapshotId=<uuid>`

응답에서 `payload` / `response` 필드는 크기가 크므로, 저에게는 아래만 주시면 충분합니다:

1. `registrations` 배열의 **길이**
2. 첫 번째 항목의 **키 이름 목록** (값 말고 키만)
3. `platform` / `status` / `external_product_id`(null 여부) / `snapshot_id`(null 여부) / `created_at` — 5~10건 정도

**외부 상품 API 호출은 0회**입니다(DB만 읽습니다).

---

## 산출물 3. 플랫폼별 등록 후 상태 조회 가능 여부

### 쿠팡 — 🟢 **가능. 이미 구현돼 있고 호출부만 없다**

```
apps/admin/src/app/api/coupang/product-status/route.ts
  GET ?id=<sellerProductId>
  → callCoupangApi GET /v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{id}
  → { status, body }
```

| 항목 | 내용 |
|---|---|
| 입력값 | `sellerProductId` |
| `external_product_id`와 연결 | **가능성 높음** — 등록 응답에서 받은 판매자상품ID를 저장하는 컬럼. 단 실제 저장값 형식은 §2 UNKNOWN |
| 반환 상태 | 쿠팡 seller-products 상세 응답 전체(`body`). **구체적 상태 문자열 집합은 미확인** — 실호출 없이는 확정 불가 |
| 호출 비용/제한 | 상품 1건당 1회. 쿠팡 API 쿼터 정책 미확인 |
| caller가 없는 이유 | 주석에 "디버그/점검용"으로 명시. 운영 루프 설계 시점에 만들어진 것이 아니라 등록 검증(STEP 3) 도구로 만들어짐 |

### 스마트스토어 — 🔴 **불가. 상태 조회 경로가 존재하지 않는다**

```
apps/admin/src/app/api/smartstore/  →  register/route.ts, seller-compliance/route.ts
                                        (상태 조회 라우트 없음)
```

`packages/listing/src/smartstore/`, `naver/`에도 상태 조회 구현이 없습니다. 커머스API에 원상품/채널상품 조회가 존재하는지는 **문서 확인이 필요**하며, 이번 조사는 코드/문서 범위라 외부 호출로 확인하지 않았습니다.

> **P-34 설계 함의**: 후보 C(실제 ACTIVE 기준)는 **현재 스마트스토어에서 원천적으로 불가능**합니다.

---

## 산출물 4. Monitoring 대상 후보 A / B / C 비교

현행 코드:

```ts
// cron/daily-price-check/route.ts
const MAX_SNAPSHOTS_PER_RUN = 50;
const snapshots = await listRecentSnapshotsFull(MAX_SNAPSHOTS_PER_RUN);
// → product_snapshots ORDER BY last_opened_at DESC LIMIT 50
```

⚠️ 정렬 기준이 생성일이 아니라 **`last_opened_at`(마지막으로 열어본 시각)**입니다. 즉 **등록해서 팔고 있어도 아무도 화면을 안 열면 감시에서 빠집니다.** P-33 보고보다 결함이 한 단계 더 날카롭습니다.

| 기준 | **A. 최근 스냅샷** (현행) | **B. 등록 성공 상품** | **C. 실제 ACTIVE 상품** |
|---|---|---|---|
| 모집합 | `last_opened_at` 상위 50 | `registration_attempts.status='SUBMITTED'`의 distinct `snapshot_id` | 플랫폼이 판매중이라 답한 상품 |
| 정확성 | 🔴 낮음 — 운영 관점과 무관한 기준 | 🟢 높음 — "우리가 파는 상품" | 🟢 최고 |
| 누락 가능성 | 🔴 높음 — 안 열면 누락 | 🟡 낮음 — 플랫폼에서 내린 상품이 남을 수 있음 | 🟢 없음 |
| DB 비용 | 1 쿼리 | 1~2 쿼리 (`getRegisteredPlatforms` 확장) | B + 상태 저장 조회 |
| 외부 API 호출 | 50건 × 가격확인 | **등록 상품 수 × 가격확인** (현재는 A보다 적을 가능성) | B + **상품당 상태조회 1회 추가** |
| 신규 테이블/컬럼 | 불필요 | ✅ **불필요** | 🔴 필요(상태 저장) |
| 스마트스토어 지원 | 해당 없음 | ✅ 가능 | 🔴 **불가**(§3) |

### 권장 — **B**, 단 A를 폐기하지 않고 우선순위만 뒤집는다

```
1) 등록 성공 상품 전량을 먼저 처리   ← 운영상 반드시 봐야 하는 대상
2) 남은 예산(50 - 처리분)으로 최근 스냅샷 처리  ← 등록 전 상품의 판단용 데이터도 계속 갱신
```

이렇게 하면 **외부 API 호출 총량이 늘지 않으면서**(상한 50 유지) 우선순위만 정상화됩니다. 기존 동작을 제거하지 않으므로 회귀 위험도 낮습니다.

C는 §3 때문에 지금 채택 불가입니다. 쿠팡만 부분 도입하는 것도 가능하지만, **먼저 B로 모집합을 확정한 뒤**에 하는 것이 순서상 맞습니다.

---

## 산출물 5. P-34 실제 구현안

### 구조 판정: **구조 A (기존 테이블만 사용) — 마이그레이션 불필요** ✅

1순위 작업은 CPO가 제시한 구조 A에 정확히 해당합니다.

```
registration_attempts (status='SUBMITTED')
        ↓  distinct snapshot_id
등록 성공 상품 목록
        ↓
daily-price-check 대상 = 등록 상품 우선 + 최근 스냅샷 보충
```

### 예상 변경 파일 (1순위)

| 파일 | 변경 |
|---|---|
| `apps/admin/src/app/api/snapshots/_lib/registration-status.ts` | 함수 1개 추가 — 등록된 `snapshot_id` 목록 조회 (기존 `getRegisteredPlatforms`와 같은 테이블·같은 조건) |
| `apps/admin/src/app/api/cron/daily-price-check/route.ts` | 대상 선정만 교체. 처리 로직·상한 50 유지 |
| 신규 테스트 1개 | 대상 선정 순서/중복제거/상한 검증 |

- **DB 마이그레이션: 불필요**
- **외부 API 호출 총량: 증가 없음**(상한 유지)
- 보호 영역(payload builder·KC·CASE A-D·sellerFacingVerdict·등록 실행) 무변경

### 2순위 — 생애주기 상태 (설계만, 확정 금지)

CPO 제시안 기준 최소 후보:

```
SUBMITTED → PENDING → ACTIVE → INACTIVE / REJECTED,  그리고 UNKNOWN
```

**단, 지금 확정하면 안 됩니다.** 쿠팡이 실제로 어떤 상태 문자열을 반환하는지 미확인이고(§3), 스마트스토어는 조회 경로 자체가 없습니다. 실제 반환값을 모르는 채 enum을 고정하면 매핑되지 않는 상태가 생깁니다.

마이그레이션이 필요해지는 시점이며, **CEO/CPO 수동 실행 대상**입니다. 코드에는 기존 관례대로 컬럼 부재 폴백을 넣어야 합니다.

### 착수 전 필요한 확인 (블로커)

| # | 항목 | 해소 방법 | 비용 |
|---|---|---|---|
| 1 | `snapshot_id` 실제 존재·채워짐 여부 | `/api/admin/registrations` 열람 (§2) | DB 읽기만 |
| 2 | 등록 데이터 실제 규모 | 〃 | 〃 |
| 3 | 쿠팡 상태 문자열 집합 | 실제 `sellerProductId` 1건으로 1회 호출 | **쿠팡 API 1회** — 2순위 착수 시 |
| 4 | 스마트스토어 상태 조회 가능 여부 | 커머스API 문서 확인 | 0회 |

**1번이 해소되면 1순위는 즉시 구현 가능**합니다. 3·4번은 2순위 전제조건이라 1순위를 막지 않습니다.
