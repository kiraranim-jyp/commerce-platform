# BETA-SECURITY-3 PHASE 2 — 설계안 (DB 무변경)

작성: 2026-09-09 · 상태: **설계 제출 / 변경 0건** · 선행: `beta-security-3-phase1-findings.md`

CPO 지시에 따라 2-A ~ 2-E 산출물을 제출한다. **DB migration은 승인 전 실행하지 않는다.**

---

## ⚠️ 이 문서에서 가장 중요한 한 가지

**RLS로는 교차사용자 문제를 고칠 수 없다.**

이 앱의 데이터 접근은 **전부 `service_role` 키를 경유한다**(36개 파일). `service_role`은
**RLS를 무조건 우회한다.** 따라서:

| 위협 | RLS로 막히나 | API 인가로 막히나 |
|---|---|---|
| anon 키로 Supabase REST 직접 호출 | ✅ **막힌다** | ❌ (API를 안 거침) |
| 로그인 사용자가 남의 snapshotId를 API에 넣음 | ❌ **안 막힌다** | ✅ 막힌다 |

**두 축은 서로를 대체하지 못한다.** RLS만 켜서 Security Advisor를 녹색으로 만들면
경고는 사라지지만 §2-B의 교차사용자 취약점은 **하나도 고쳐지지 않는다.**
CPO 지시의 판단이 기술적으로 정확하다.

→ 그래서 **P0 조치의 본체는 RLS가 아니라 API 인가**다. RLS는 anon 직결 경로 차단용이다.

---

## 2-A. Table Ownership Matrix

**현재 상태**(저장소 기준. 라이브 확인은 `beta-security-3-rls-audit.sql`).

anon/authenticated 접근 열은 **RLS ON + 정책 0개 = 차단**, **RLS OFF = Supabase 기본
GRANT면 전면 허용**이라는 규칙으로 도출한 것이다.

| 테이블 | 데이터 성격 | 민감도 | 현재 owner | workspace 관계 | RLS | policy | anon | authed | service_role |
|---|---|---|---|---|---|---|---|---|---|
| `product_snapshots` | 수집 상품 | 중 | `workspace_id` NOT NULL | **직접** ✅ | ON | 0 | 차단 | 차단 | 전권 |
| `workspaces` | 테넌트 | 중 | `created_by` | 자신 | ON | 0 | 차단 | 차단 | 전권 |
| `workspace_members` | 멤버십 | 중 | `user_id` | 직접 | ON | 0 | 차단 | 차단 | 전권 |
| `price_observations` | 가격 관측 | 중 | 없음 | `snapshot_id` **NOT NULL** | ON | 0 | 차단 | 차단 | 전권 |
| `price_alerts` | 가격 알림 | 중 | 없음 | `snapshot_id` **NOT NULL** | ON | 0 | 차단 | 차단 | 전권 |
| `domestic_product_links` | 국내 매칭 | 중 | 없음 | `snapshot_id` **NOT NULL** | ON | 0 | 차단 | 차단 | 전권 |
| `registration_attempts` | 등록 이력 | 중 | 없음 | `snapshot_id` **nullable** ⚠ | ON | 0 | 차단 | 차단 | 전권 |
| `seller_compliance_confirmations` | 판매 확인 | 중 | 없음 | `snapshot_id` **nullable** ⚠ | ON | 0 | 차단 | 차단 | 전권 |
| `image_assets` | 업로드 이미지 | 중 | **없음** | **없음** | ON | 0 | 차단 | 차단 | 전권 |
| `coupang_seller_settings` | 쿠팡 자격증명 | **최고** | **없음 · 전역 1행** | **없음** | ON | 0 | 차단 | 차단 | 전권 |
| `commerce_accounts` | 네이버/쿠팡 자격증명 | **최고** | **없음 · platform별 1행** | **없음** | **OFF** 🔴 | 0 | **전면 허용** | **전면 허용** | 전권 |
| `coupang_seller_profiles` | 배송 프로필 | 중 | 없음 | 없음 | ON | 0 | 차단 | 차단 | 전권 |
| `coupang_description_templates` | 상세 템플릿 | 하 | 없음 | 없음 | ON | 0 | 차단 | 차단 | 전권 |
| `coupang_brand_profiles` | 브랜드 프로필 | 하 | 없음 | 없음 | **OFF** 🔴 | 0 | **전면 허용** | **전면 허용** | 전권 |
| `audit_log` | 감사 로그 | 중 | `target_user_id` | 간접 | ON | 0 | 차단 | 차단 | 전권 |
| `support_inquiries` | 문의 | 중(PII) | 없음 | 없음 | ON | 0 | 차단 | 차단 | 전권 |
| `domestic_price_sources` | 참조(관리자) | 하 | 없음 | 공유 | ON | 0 | 차단 | 차단 | 전권 |
| `comparison_shops` | 참조(관리자) | 하 | 없음 | 공유 | ON | 0 | 차단 | 차단 | 전권 |
| `brand_dictionary` | 캐시 | 하 | 없음 | 공유 | **OFF** 🔴 | 0 | **전면 허용** | **전면 허용** | 전권 |
| `market_signal_cache` | 캐시 | 하 | 없음 | 공유 | ON | 0 | 차단 | 차단 | 전권 |
| `job_key_sequences` | 채번 | 하 | 없음 | 서버내부 | ON | 0 | 차단 | 차단 | 전권 |
| `Product` | Prisma init 잔재 | ? | 없음 | 없음 | **OFF** 🔴 | 0 | **전면 허용** | **전면 허용** | 전권 |

### 목표 상태 — 필요한 CRUD 권한

| 테이블 | authenticated SELECT | INSERT | UPDATE | DELETE | 근거 |
|---|---|---|---|---|---|
| `product_snapshots` | 내 workspace만 | 내 workspace만 | 내 workspace만 | 내 workspace만 | 테넌트 데이터 |
| snapshot 종속 5종 | 내 workspace만 | 내 workspace만 | 내 workspace만 | 내 workspace만 | 동상 |
| `image_assets` | 내 workspace만 | 내 workspace만 | ✕ | 내 workspace만 | 업로드물 |
| 자격증명 2종 | **없음** | 없음 | 없음 | 없음 | service_role 전용 |
| 프로필/템플릿 3종 | 내 workspace만 | 내 workspace만 | 내 workspace만 | 내 workspace만 | 사용자 설정 |
| 참조 4종 | 전체 | ✕ | ✕ | ✕ | 읽기 전용 공유 |
| `audit_log`/`support_inquiries`/`job_key_sequences`/`workspaces`/`workspace_members` | **없음** | 없음 | 없음 | 없음 | 서버 전용 |

> 참고: 위 "authenticated" 권한은 **anon 키 직결 경로에만 적용**된다. 앱은 service_role로
> 접근하므로 앱 동작에는 영향이 없다. 즉 **표의 왼쪽 절반(RLS)은 방어선 A, §2-B(API 인가)는
> 방어선 B이며, 지금 뚫려 있는 건 양쪽 다**다.

---

## 2-B. API Authorization Matrix

72개 라우트 전수. 판정 기준:

- **인증**: `proxy.ts`가 세션을 강제하는가 (matcher 제외는 `cron`/`debug`/`auth`/`support` 4개뿐)
- **인가**: 클라이언트가 준 리소스 ID가 **호출자 workspace 소유인지 검증**하는가

`requireUser()`를 호출하는 라우트는 **72개 중 12개뿐**이다(grep 확정).

### B-1. 교차사용자 취약 — 즉시 수정 대상 (13건)

| # | 경로 | 메서드 | 결함 | 공격 |
|---|---|---|---|---|
| 1 | `/api/settings/coupang` | GET/POST/DELETE | 전역 1행, 인가 없음 | B가 A의 쿠팡 자격증명 상태를 보고 **덮어씀** → A의 등록이 B 계정으로 나감 |
| 2 | `/api/settings/naver` | GET/POST/DELETE | 전역 1행, 인가 없음 | 동상 (네이버) |
| 3 | `/api/smartstore/register` | POST | `requireUser()` 없음 | B가 A의 `snapshotId`로 **실제 네이버 등록 실행** |
| 4 | `/api/coupang/register` | POST | `requireUser()` 없음 | B가 A의 `snapshotId`로 **실제 쿠팡 등록 실행** |
| 5 | `/api/smartstore/seller-compliance` | GET/POST | 인가 없음 | A의 판매 확인 기록 조회 + **임의로 "확인됨" 기록 생성** → 3번과 연쇄 |
| 6 | `/api/audit-log/[snapshotId]` | GET | 인가 없음 | A의 전체 활동 이력 열람 |
| 7 | `/api/price-history/[snapshotId]/alerts` | GET | 인가 없음 (부모는 있음) | A의 가격 알림 열람 |
| 8 | `/api/price-history/[snapshotId]/alerts` | PATCH | `alertId`만으로 조회 | A의 알림을 **확인 처리**해 경보 무력화 |
| 9 | `/api/price-alerts/summary` | GET | 필터 인자 자체가 없음 | **전 사용자 알림 집계** 노출 |
| 10 | `/api/domestic-price-sources/links/[id]` | PATCH | `id`만으로 조회 | A의 가격매칭을 `verified` 조작 |
| 11 | `/api/assets` | GET | 필터 없음 (`select("*")`) | **전 사용자 업로드 이미지 목록·URL 열람** |
| 12 | `/api/assets/[id]` | DELETE | `eq("id", id)`만 | **아무 사용자의 이미지나 삭제** |
| 13 | `/api/snapshots/[id]/category-recommendation` | POST | 소유권은 검증하나 **헬퍼가 샘** | 캐시 조회가 전체 스냅샷 200건 스캔 → 타 workspace 분석결과 유입 |
| 14 | `/api/settings/coupang/profiles/[id]` | PATCH/DELETE | `id`만으로 조회 | A의 배송 프로필 수정·삭제 |
| 15 | `/api/settings/coupang/templates/[id]` | PATCH/DELETE | 동상 | A의 상세 템플릿 수정·삭제 |
| 16 | `/api/settings/coupang/brand-profiles/[id]` | PATCH/DELETE | 동상 | A의 브랜드 프로필 수정·삭제 |

13번이 특히 중요하다. 라우트는 `requireUser()`도 하고 소유권 검증도 통과하는데,
그 뒤 호출하는 [`findReadyCategoryRecommendationCache()`](../apps/admin/src/app/api/snapshots/_lib/category-recommendation-cache.ts)가
필터 없이 스캔한다. **라우트만 봐서는 안 보이는 유형** — 수정 시 `_lib` 헬퍼를 전수 점검해야 한다.

같은 잠재 결함: `getAttemptsSummaryBySnapshot()`은 넘겨받은 `snapshotIds`를 무조건 신뢰한다.
현재 호출부가 안전해서 노출은 없지만, **타입만이 유일한 방어선**이다.

### B-2. 공유 참조 데이터에 무제한 쓰기 (4건)

| 경로 | 메서드 | 문제 |
|---|---|---|
| `/api/comparison-shops` | POST | 로그인한 누구나 비교샵 추가 |
| `/api/comparison-shops/[id]` | PATCH/DELETE | 누구나 수정·삭제 (SYSTEM 항목도 비활성화 가능) |
| `/api/domestic-price-sources` | POST | 누구나 가격소스 추가 |
| `/api/domestic-price-sources/[id]` | PATCH/DELETE | 누구나 `enabled=false` → **전 사용자 가격비교에서 그 소스 제외** |

프라이버시 유출은 아니지만 **전 사용자 데이터 무결성 훼손**이다. 관리자 전용으로 옮겨야 한다.

### B-3. 설정 공유 (인가 이전에 데이터 모델 문제)

`coupang_seller_profiles`, `coupang_description_templates`, `coupang_brand_profiles`에
소유권 컬럼이 없어서 `/api/settings/coupang/profiles|templates|brand-profiles`
(GET/POST/PATCH/DELETE)는 **전 사용자가 같은 레코드를 공유**한다. API만 고쳐서는 해결되지
않고 §2-C의 컬럼 추가가 선행돼야 한다.

### B-4. proxy matcher 제외 라우트 (무인증 도달 가능)

| 경로 | 가드 | 판정 |
|---|---|---|
| `/api/auth/*` | 설계상 무인증 | 정상 |
| `/api/support/inquiries` | **없음** | 🟡 무인증 service_role INSERT, 레이트리밋 없음 → 스팸/스토리지 남용 |
| `/api/cron/daily-price-check` | `CRON_SECRET` **fail-OPEN** | 🟠 미설정 시 누구나 호출 → 외부 API 호출 비용 유발 |
| `/api/debug/*` (4개) | `x-debug-token` **fail-CLOSED** | ✅ 미설정 시 항상 거부 — 안전 |

### B-5. 인가 결함 없음 (세션 게이트로 충분)

- **소유권 검증 정상(11)**: `/api/snapshots`(GET/POST), `/api/snapshots/[id]`(GET/DELETE),
  `/api/snapshots/[id]/duplicate`, `/api/dashboard/readiness`, `/api/price-history/[snapshotId]`(GET),
  `/api/price-history/check`, `/api/auth/me`, `/api/pipeline`, `/api/pipeline/retry`, `/api/pipeline/upload-image`
- **관리자 전용, HMAC 정상(9)**: `/api/admin/*` 전부.
  `ADMIN_SESSION_SECRET` 미설정 시 `verifySessionToken()`이 `false`를 반환해 **fail-CLOSED**다 ✅
- **DB 미접촉 외부 API 프록시(다수)**: `/api/coupang/{category-*,brand-search,return-centers,shipping-places,product-status,payload-preview,auth-test}`,
  `/api/naver/{category-*,resolve,provided-notice,auth-test}`, `/api/exchange-rates`,
  `/api/platform-status`, `/api/comparison/search`, `/api/price-intelligence`, `/api/diagnostics/proxy`
  → 테넌트 데이터가 없어 교차사용자 위험 없음. 단 **레이트리밋이 전무**하고
  `/api/extractor-test`, `/api/price-intelligence`는 **임의 URL을 서버가 fetch**한다(SSRF).
  로그인 필요라 외부 공격은 아니지만 P2로 남긴다.

---

## 2-C. Multi-tenant Ownership 설계

### 원칙

1. **`workspace_id`를 정본으로 한다.** `user_id`를 직접 붙이지 않는다 — 043이 팀 확장을
   위해 workspace를 둔 이유를 유지한다.
2. **FK 경유 소유권에 의존하지 않는다.** Postgres RLS는 FK를 타고 전파되지 않고,
   `snapshot_id`가 nullable인 테이블은 고아 행이 생긴다.
3. **043과 동일한 3단계**로만 컬럼을 추가한다: `nullable 추가 → backfill → NOT NULL`.
   한 번에 NOT NULL을 걸면 기존 행이 제약 위반으로 마이그레이션이 실패한다.

### ⚠️ 이름 충돌 경고

`product_snapshots`에는 **`workspace jsonb NOT NULL`**(파이프라인 데이터 blob, 016)과
**`workspace_id uuid`**(테넌트 경계, 043)가 **둘 다** 있다. 이름이 비슷하고 의미가 전혀
다르다. 정책·마이그레이션 작성 시 `workspace`를 참조하면 조용히 잘못 동작한다.

### 테이블별 귀속 방식

| 테이블 | 방식 | backfill 소스 | 비고 |
|---|---|---|---|
| `price_observations` | `workspace_id` 추가 | `snapshot_id` NOT NULL → JOIN | 안전 |
| `price_alerts` | `workspace_id` 추가 | 동상 | 안전 |
| `domestic_product_links` | `workspace_id` 추가 | 동상 | 안전 |
| `registration_attempts` | `workspace_id` 추가 | `snapshot_id` **nullable** | **고아 행 처리 방침 필요** ⓐ |
| `seller_compliance_confirmations` | `workspace_id` 추가 | `snapshot_id` **nullable** | 동상 ⓐ |
| `image_assets` | `workspace_id` 추가 | **추적 불가** | **결정 필요** ⓑ |
| `coupang_seller_profiles` | `workspace_id` 추가 | 전역 → 대표 workspace | 043 패턴 |
| `coupang_description_templates` | `workspace_id` 추가 | 동상 | 043 패턴 |
| `coupang_brand_profiles` | `workspace_id` 추가 | 동상 | 043 패턴 |
| `coupang_seller_settings` | **폐기 → `commerce_accounts` 통합** | 전역 1행 이관 | ⓒ |
| `commerce_accounts` | `workspace_id` 추가 + `unique(workspace_id, platform, label)` | 전역 → 대표 workspace | ⓒ |
| `audit_log` | 유지(`target_user_id`) | — | 서버 전용 |
| `support_inquiries` | 유지(소유자 없음) | — | 비로그인 제출이 설계 |
| 참조 4종 | 유지(공유) | — | |
| `Product` | **사용 여부 확인 후 drop** | — | ⓓ |

**ⓐ 고아 행**: `snapshot_id`가 NULL인 기존 행이 몇 건인지 먼저 세어야 한다(아래 확인 SQL).
043의 원칙("소유자를 추측해서 임의 UUID에 귀속시키지 않는다")을 따르면 선택지는
**보존 후 서버 전용 처리** 또는 **삭제**다. CPO 결정 필요.

**ⓑ `image_assets`**: 업로더를 알 수 있는 컬럼이 없다. `coupang_seller_profiles`와
`product_snapshots`가 `*_asset_id`로 참조하므로 **역참조로 일부는 추정 가능**하지만,
어디서도 참조되지 않는 자산은 소유자를 정할 수 없다. 현재 사용자가 1명이면 전량을
대표 workspace로 귀속시키는 것이 가장 단순하고 안전하다(043과 동일 논리).

**ⓒ 자격증명 통합**: `coupang_seller_settings`(전역 1행)와 `commerce_accounts`(platform별 1행)가
같은 일을 두 군데서 한다. `commerce_accounts`는 이미 다계정 구조라 이쪽으로 통합하는 것이
중복 제거 관점에서 맞다. 다만 **등록 파이프라인 배선 변경이 필요**하므로 별도 라운드를 권한다.
이번 라운드는 **양쪽 모두에 `workspace_id`만 추가**하고 통합은 다음으로 미루는 것이 안전하다.

**ⓓ `Product`**: Prisma init 잔재로 보이며 코드 참조가 확인되지 않는다. 라이브 행 수 확인 후 drop.

### 확인이 필요한 값 (읽기 전용, PHASE 3 착수 전)

```sql
select 'registration_attempts' t, count(*) filter (where snapshot_id is null) 고아, count(*) 전체
  from registration_attempts
union all select 'seller_compliance_confirmations',
  count(*) filter (where snapshot_id is null), count(*) from seller_compliance_confirmations
union all select 'image_assets', null, count(*) from image_assets
union all select 'Product', null, count(*) from "Product"
union all select 'commerce_accounts', null, count(*) from commerce_accounts;
```

---

## 2-D. RLS Policy Matrix

**`USING(true)` / `WITH CHECK(true)`는 쓰지 않는다**(CPO 지시). 아래 정책은 전부 조건부이거나
정책 자체를 두지 않는다.

### 공통 헬퍼 (먼저 정의)

```sql
-- SECURITY DEFINER가 필요하다: workspace_members 자신이 RLS로 잠겨 있으면
-- 정책 안에서 그 테이블을 조회할 수 없어 순환이 생긴다.
-- search_path를 고정하지 않으면 이 함수가 권한 상승 경로가 된다.
create or replace function auth_workspace_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$ select workspace_id from workspace_members where user_id = auth.uid() $$;
```

### 테이블별 정책

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `product_snapshots` | `workspace_id in (select auth_workspace_ids())` | 동일 조건 `WITH CHECK` | USING+WITH CHECK 동일 | 동일 |
| `price_observations` | 동일 | 동일 | 동일 | 동일 |
| `price_alerts` | 동일 | 동일 | 동일 | 동일 |
| `domestic_product_links` | 동일 | 동일 | 동일 | 동일 |
| `registration_attempts` | 동일 | 동일 | 동일 | 동일 |
| `seller_compliance_confirmations` | 동일 | 동일 | 동일 | 동일 |
| `image_assets` | 동일 | 동일 | **정책 없음**(불변) | 동일 |
| `coupang_seller_profiles` | 동일 | 동일 | 동일 | 동일 |
| `coupang_description_templates` | 동일 | 동일 | 동일 | 동일 |
| `coupang_brand_profiles` | 동일 | 동일 | 동일 | 동일 |
| `workspaces` | `id in (select auth_workspace_ids())` | **정책 없음** | 없음 | 없음 |
| `workspace_members` | `user_id = auth.uid()` | 없음 | 없음 | 없음 |
| **`commerce_accounts`** | **정책 없음** | 없음 | 없음 | 없음 |
| **`coupang_seller_settings`** | **정책 없음** | 없음 | 없음 | 없음 |
| `audit_log` | **정책 없음** | 없음 | 없음 | 없음 |
| `support_inquiries` | **정책 없음** | 없음 | 없음 | 없음 |
| `job_key_sequences` | **정책 없음** | 없음 | 없음 | 없음 |
| `domestic_price_sources` | `true` 아님 → **`enabled = true`** | 없음 | 없음 | 없음 |
| `comparison_shops` | **`is_active = true`** | 없음 | 없음 | 없음 |
| `brand_dictionary` | 정책 없음(서버 캐시) | 없음 | 없음 | 없음 |
| `market_signal_cache` | 정책 없음(서버 캐시) | 없음 | 없음 | 없음 |
| `Product` | drop 대상 | — | — | — |

**"정책 없음"의 의미**: RLS는 켜되 정책을 만들지 않는다 → `anon`/`authenticated` 전면 차단,
`service_role`만 통과. 현재 18개 테이블이 이미 이 상태이고, **그 상태가 올바른 목표 상태**다.
바꿔야 하는 건 RLS가 꺼진 4개뿐이다.

참조 2종의 SELECT 조건을 `true` 대신 `enabled/is_active`로 둔 이유: 비활성 소스는 클라이언트가
알 필요가 없고, `USING(true)` 금지 지시와도 부합한다.

### 적용 순서 (앱 무중단)

```
1) RLS OFF 4개 테이블 → enable row level security     [앱 영향 0 — 전부 service_role 경유]
2) auth_workspace_ids() 함수 생성                      [영향 0]
3) 정책 생성                                            [영향 0 — service_role은 정책 무관]
4) (별도) API 인가 수정                                 ← 실제 취약점이 닫히는 지점
```

1~3은 앱 동작을 바꾸지 않는다. **바꾸지 않기 때문에 취약점도 닫히지 않는다** —
닫히는 것은 anon 직결 경로뿐이다. 이 점을 혼동하면 안 된다.

---

## 2-E. Credential 보호 설계 (별개 축)

RLS·인가와 **독립된 문제**다. 지금 DB에는 마켓 API 시크릿이 **평문**으로 있다.

| 항목 | 현재 | 목표 |
|---|---|---|
| 저장 | `commerce_accounts.secret_key/client_secret` 평문<br>`coupang_seller_settings.secret_key` 평문 | 암호화 저장 |
| RLS | `commerce_accounts` **OFF** | ON + 정책 없음 |
| API 반환(시크릿) | 마스킹됨 ✅ (`secretKeySaved`/`clientSecretSaved` boolean) | 유지 |
| API 반환(식별자) | ⚠ `accessKeyMasked`/`clientIdMasked`가 **마지막 4자 노출** | 노출 축소 검토 |
| 진단 정보 | ⚠ `/api/coupang/auth-test`가 키 **길이·공백 여부** 반환 | 인증 후에도 축소 |
| 소유권 | 없음(전역 공유) | `workspace_id` |
| 키 관리 | — | 앱 레벨 암호화 키를 Vercel 환경변수(Sensitive)로 |
| 유출 시 대응 | 절차 없음 | **로테이션 절차 문서화** |

**중요**: `commerce_accounts`가 RLS OFF 상태로 운영돼 왔고 anon 키는 공개값이다.
④번 쿼리가 anon 권한을 확인해 주면, **그 시점까지 저장돼 있던 자격증명은 유출을
가정하고 로테이션하는 것이 원칙**이다. RLS를 켜는 것은 앞으로의 접근을 막을 뿐,
이미 읽혔을 가능성을 되돌리지 못한다.

암호화 방식은 두 갈래다 — CPO 결정 필요:
- **A. 앱 레벨 AES-GCM** — 구현 단순, 키는 Vercel 환경변수. DB 유출 시 안전.
- **B. Supabase Vault** — DB 네이티브, 운영 부담 적음. 단 service_role이 여전히 복호화 가능.

현재 위협모델(anon 직결 노출)에서는 **A가 더 실질적**이다.

---

## 진행 판단

| 순서 | 항목 | 상태 |
|---|---|---|
| PHASE 1 | 조사 | ✅ 승인 |
| — | ④번 anon 노출 확인 | ⏸ **콘솔 실행 필요 (제가 실행 불가)** |
| PHASE 2-A~E | 설계 | ✅ 본 문서 |
| PHASE 3 | migration + API 수정 | ⏸ 승인 대기 |
| PHASE 4 | 교차사용자 공격 테스트 | ⏸ |

### 결정이 필요한 사항

1. **P0 순서** — §2-B의 API 인가 수정(실제 취약점)과 RLS ON(anon 차단) 중 무엇을 먼저 할지.
   권고: **RLS ON 먼저**(영향 0, 즉시 가능) → **API 인가 수정**(본체).
2. **고아 행 처리(ⓐ)** — `snapshot_id` NULL 행 보존 vs 삭제.
3. **`image_assets` 귀속(ⓑ)** — 전량 대표 workspace 귀속을 승인할지.
4. **자격증명 테이블 통합(ⓒ)** — 이번 라운드에 통합할지, `workspace_id`만 추가하고 미룰지.
   권고: **미룬다**(등록 파이프라인 배선 변경 위험).
5. **암호화 방식(2-E)** — A(앱 레벨) vs B(Vault). 권고: **A**.
6. **자격증명 로테이션** — ④번 결과가 노출을 확인하면 즉시 로테이션할지.
7. **`Product` 테이블(ⓓ)** — drop 승인.
