# BETA-SECURITY-3 PHASE 1 — 조사 결과 보고 (DB 무변경)

작성: 2026-09-09 · 상태: **조사 완료 / 변경 0건**

지시하신 원칙대로 **DB·코드를 하나도 변경하지 않았습니다.** 저장소 정적 분석
결과이며, 라이브 DB에서만 확인 가능한 항목은 §6에 별도로 모았습니다.

> 원본 작업지시서(PHASE 1~5 정의)는 이 저장소에 없습니다. 그래서 지시 메일의
> **핵심 지시 5개 항목**을 조사 범위로 삼았습니다. PHASE 구분이 다르면 알려주세요.

---

## 0. 세 줄 요약

1. **익명 노출은 API 레이어에는 없다.** `proxy.ts`(Next 16에서 middleware의 새
   이름)가 `/api/*` 전체를 Supabase 세션으로 막고 있다.
2. **진짜 구멍은 인가(테넌트 격리)다.** 72개 라우트 중 `requireUser()`를 쓰는 건
   12개뿐이고, 쿠팡 자격증명은 **전역 1행 싱글턴**이라 로그인한 아무 사용자나
   서로의 API 키를 읽고 덮어쓸 수 있다.
3. **두 번째 구멍은 anon 키 직결이다.** `commerce_accounts`(마켓 시크릿 평문)에
   RLS가 꺼져 있다. 브라우저에 노출된 anon 키로 앱을 우회해 직접 읽힐 수 있다 —
   실제 여부는 라이브 DB 확인 필요(§6).

---

## 1. 현재 상태 — 테이블 / RLS / 정책 / 권한

### 1-1. public 테이블 22개와 RLS 상태 (저장소 기준)

| # | 테이블 | RLS | 정책 | 소유권 컬럼 |
|---|---|---|---|---|
| 1 | `workspaces` | ON | **0개** | `created_by` |
| 2 | `workspace_members` | ON | **0개** | `user_id` |
| 3 | `product_snapshots` | ON | **0개** | `workspace_id` NOT NULL ✅ |
| 4 | `registration_attempts` | ON | **0개** | `snapshot_id` (간접) |
| 5 | `price_observations` | ON | **0개** | `snapshot_id` (간접) |
| 6 | `price_alerts` | ON | **0개** | `snapshot_id` (간접) |
| 7 | `domestic_product_links` | ON | **0개** | `snapshot_id` (간접) |
| 8 | `seller_compliance_confirmations` | ON | **0개** | `snapshot_id` (간접) |
| 9 | `audit_log` | ON | **0개** | `target_user_id` |
| 10 | `image_assets` | ON | **0개** | 없음 |
| 11 | `coupang_seller_settings` | ON | **0개** | 없음 — **전역 1행** 🔴 |
| 12 | `coupang_seller_profiles` | ON | **0개** | 없음 |
| 13 | `coupang_description_templates` | ON | **0개** | 없음 |
| 14 | `support_inquiries` | ON | **0개** | 없음 |
| 15 | `comparison_shops` | ON | **0개** | 없음 |
| 16 | `domestic_price_sources` | ON | **0개** | 없음 |
| 17 | `market_signal_cache` | ON | **0개** | 없음 |
| 18 | `job_key_sequences` | ON | **0개** | 없음 |
| 19 | **`commerce_accounts`** | **OFF** 🔴 | 0개 | 없음 — **시크릿 평문** |
| 20 | `coupang_brand_profiles` | **OFF** | 0개 | 없음 |
| 21 | `brand_dictionary` | **OFF** | 0개 | 없음 |
| 22 | `Product` (Prisma init) | **OFF** | 0개 | 없음 — 사용 여부 확인 필요 |

### 1-2. 정책 / 권한

- **`CREATE POLICY`가 저장소 전체에 단 한 줄도 없다.** 45개 마이그레이션 전수 확인.
- **`GRANT` / `REVOKE`도 한 줄도 없다.** 즉 권한은 전부 Supabase 기본값에 맡겨져 있다.

이게 의미하는 바:

- **RLS ON + 정책 0개** = `anon`/`authenticated`는 그 테이블에서 **아무것도 못 읽는다**
  (deny-all). `service_role`만 통과한다. → 의도된 설계이고, 안전한 쪽이다.
- **RLS OFF** = Supabase 기본 GRANT가 살아 있으면 `anon` 키로 **전부 읽고 쓸 수 있다.**
  → 19~22번 4개가 여기 해당. §6에서 확인해야 한다.

### 1-3. 역할별 사용처

| 역할 | 어디서 쓰나 | 파일 |
|---|---|---|
| `service_role` | 모든 서버 데이터 접근 (36개 파일) | `lib/supabase-admin.ts` |
| `anon` (SSR) | 세션 검증·갱신만 | `lib/supabase-server.ts`, `proxy.ts` |
| `anon` (브라우저) | **로그인/로그아웃만** — 테이블 직접 쿼리 없음 ✅ | `lib/supabase-browser.ts` |

**키 유출 점검: 이상 없음.** `SUPABASE_SERVICE_ROLE_KEY`는 `NEXT_PUBLIC_` 접두사가
없고, `"use client"` 파일에서 `supabase-admin`을 import하는 곳이 0개다.

---

## 2. 인증 구조 — 실제로 동작하는 것

### 2-1. 전역 게이트: `apps/admin/src/proxy.ts`

Next 16에서 `middleware.ts` → `proxy.ts`로 이름이 바뀌었다. **이 파일이 유일한
전역 인증 게이트다.**

- `/admin/*`, `/api/admin/*` → `ADMIN_SESSION_SECRET` HMAC 쿠키 필수
  (예외: `/api/admin/login`, `/api/admin/logout`)
- 그 외 전부 → Supabase 세션 필수. 없으면 API는 401, 화면은 `/login` 리다이렉트
- 공개 경로: `/`, `/login`, `/auth/callback`, `/terms`, `/privacy`, `/privacy-settings`
- **matcher 제외**: `api/cron`, `api/debug`, `api/auth`, `api/support` (각자 자체 인증)

인증 축이 둘이고 서로 침범하지 않는다(Admin 쿠키로 Seller 화면 못 들어감). 이 설계는 타당하다.

### 2-2. 라우트 레벨 인가: `requireUser()`

`apps/admin/src/lib/auth/require-user.ts` — 세션 검증 + `workspaceId` 해석 +
없으면 기본 workspace 자동 생성. Admin impersonation도 여기서 흡수한다.

**하지만 72개 라우트 중 12개만 이걸 호출한다:**

```
admin/users, auth/me, dashboard/readiness, pipeline, pipeline/retry,
pipeline/upload-image, price-history/check, price-history/[snapshotId],
snapshots, snapshots/[id], snapshots/[id]/category-recommendation,
snapshots/[id]/duplicate
```

나머지 60개는 "로그인은 했는지" 확인되지만 **"이 데이터가 이 사용자 것인지"는
확인하지 않는다.**

---

## 3. 발견된 위험 — 심각도순

### 🔴 R1. `coupang_seller_settings` 전역 싱글턴 — 사용자 간 자격증명 공유

`apps/admin/src/app/api/coupang/_lib/env.ts:43`

```ts
.from("coupang_seller_settings").select("*").eq("id", SETTINGS_ROW_ID)
```

행이 하나뿐이고 workspace 컬럼이 없다. `/api/settings/coupang`은 `requireUser()`를
쓰지 않는다. 결과:

- 로그인한 사용자 B가 `GET /api/settings/coupang` → 사용자 A의 쿠팡 Access/Secret Key 조회
- `POST` → A의 자격증명을 덮어쓰기 (A의 상품등록이 조용히 B 계정으로 나감)

`/api/settings/naver`도 동일 구조다.

**Beta에 사용자가 1명뿐이라 지금은 사고가 안 났을 뿐이다. 두 번째 사용자가
가입하는 순간 즉시 사고가 난다.**

### 🔴 R2. `commerce_accounts` — RLS OFF + 시크릿 평문

`packages/database/prisma/migrations_manual/023_commerce_accounts.sql:15`

```sql
create table if not exists commerce_accounts (
  access_key text, secret_key text,        -- 쿠팡
  client_id text, client_secret text,      -- 네이버
);
-- enable row level security 가 없다
```

`proxy.ts`는 **API만** 막는다. anon 키는 브라우저에 노출되므로, RLS가 꺼져 있고
Supabase 기본 GRANT가 살아 있으면 **앱을 거치지 않고 Supabase REST로 직접 읽힌다.**

같은 조건에 걸리는 나머지: `coupang_brand_profiles`, `brand_dictionary`, `Product`.

→ **§6 ④번 쿼리가 이 위험의 실재 여부를 판정한다.**

### 🟠 R3. snapshot 종속 테이블에 소유자 검증 없음

`requireUser()`를 안 쓰면서 `snapshotId`를 URL로 받는 라우트:

- `/api/audit-log/[snapshotId]`
- `/api/price-history/[snapshotId]/alerts`

다른 사용자의 snapshot ID만 알면 그 데이터를 읽을 수 있다. (`price-history/[snapshotId]`
본체는 `requireUser()`를 쓰는데 **하위 경로 `/alerts`는 안 쓴다** — 전형적인 누락 패턴.)

> **중요한 오해 정정:** "snapshot에 FK가 있으니 snapshot의 RLS로 자동 보호된다"는
> 것은 **사실이 아니다.** Postgres RLS는 외래키를 타고 전파되지 않는다.
> `registration_attempts`, `price_observations`, `price_alerts`,
> `domestic_product_links`, `seller_compliance_confirmations`는 **각자 정책이
> 필요하다.** PHASE 2 설계에서 이걸 놓치면 구멍이 그대로 남는다.

### 🟠 R4. `/api/coupang/register`, `/api/smartstore/register` — 등록 라우트에 소유권 검사 없음

둘 다 `getSupabaseAdmin()`(service_role)을 쓰면서 `requireUser()`를 호출하지 않는다.
로그인만 되어 있으면 남의 snapshot ID로 등록을 실행시킬 수 있다.

### 🟡 R5. `/api/support/inquiries` — 무인증 service_role INSERT

`proxy.ts` matcher에서 제외 + 라우트 내 가드 없음 + 레이트리밋 없음.
설계 의도(비로그인 사용자도 문의 가능)는 타당하지만, 현재는 누구나 무제한으로
`support_inquiries`에 쓸 수 있다. 스팸/스토리지 남용 수준이며 데이터 유출은 아니다.

### 🟡 R6. `/api/cron/daily-price-check` — CRON_SECRET 미설정 시 fail-open

```ts
const cronSecret = process.env.CRON_SECRET;
if (cronSecret) { /* 검증 */ }   // 미설정이면 검증 자체를 건너뛴다
```

`proxy.ts` matcher에서도 제외되어 있다. `CRON_SECRET`이 프로덕션에 설정돼 있는지
확인 필요(§6 밖 — Vercel 환경변수 확인 사항).

> 참고: `/api/debug/*`는 `x-debug-token`으로 **fail-closed**다(토큰 미설정 시 항상 거부).
> 이쪽은 문제없다.

---

## 4. 테이블별 보안등급 (지시 3번 — 5분류)

| 등급 | 정의 | 테이블 | 목표 정책 |
|---|---|---|---|
| **S4 민감(자격증명)** | 유출 시 외부 계정 탈취 | `commerce_accounts`, `coupang_seller_settings` | RLS ON + **정책 0개**(service_role 전용) + workspace 컬럼 추가 + 암호화 검토 |
| **S3 Workspace 데이터** | 테넌트 경계 필수 | `product_snapshots`, `registration_attempts`, `price_observations`, `price_alerts`, `domestic_product_links`, `seller_compliance_confirmations`, `image_assets` | workspace_id 추가 후 `workspace_id in (내 workspace)` 정책 |
| **S2 사용자 설정** | 사용자별이어야 하나 지금은 전역 | `coupang_seller_profiles`, `coupang_description_templates`, `coupang_brand_profiles` | workspace_id 추가 후 동일 정책 |
| **S1 공개/참조** | 전 사용자 공통, 관리자만 수정 | `domestic_price_sources`, `comparison_shops`, `brand_dictionary`, `market_signal_cache` | `authenticated` SELECT 허용 + 쓰기는 service_role만 |
| **S0 서버 전용** | 사용자가 볼 이유 없음 | `job_key_sequences`, `audit_log`, `support_inquiries`, `workspaces`, `workspace_members` | RLS ON + 정책 0개 유지 (현행 유지) |
| — 미분류 | | `Product` | **사용 여부 확인 후 삭제 검토** |

---

## 5. 조치 우선순위 (PHASE 2 이후 제안 — 승인 전 실행 안 함)

**기존 기능(상품등록/쿠팡/스마트스토어/MI/Snapshot/자동화)을 깨지 않는 순서로 배열했다.**

| 순서 | 조치 | 기존 기능 영향 |
|---|---|---|
| P0-1 | `commerce_accounts` 등 4개 테이블 **RLS ON** | **없음** — 모든 접근이 이미 service_role이므로 무영향 |
| P0-2 | `Product` 테이블 사용 여부 확인 → 미사용이면 drop | 확인 후 판단 |
| P1-1 | `settings/coupang`, `settings/naver`에 `requireUser()` 추가 | 없음(현재 사용자 1명) |
| P1-2 | `audit-log/[snapshotId]`, `price-history/[snapshotId]/alerts`, 등록 라우트 2개에 소유권 검사 추가 | 없음 |
| P2 | S3/S2 테이블에 `workspace_id` 추가 + backfill (043과 동일 패턴) | **주의** — nullable 추가 → backfill → NOT NULL 3단계 필수 |
| P3 | 실제 RLS 정책 작성 | service_role은 정책 무관하게 통과 → 무영향 |
| P4 | `support/inquiries` 레이트리밋, `CRON_SECRET` fail-closed 전환 | 없음 |

**P0-1이 영향 0인 이유:** 애플리케이션이 이 테이블들에 접근할 때 전부 service_role
키를 쓰는데, service_role은 RLS를 우회한다. 따라서 RLS를 켜도 앱 동작은 그대로이고
anon 경로만 닫힌다. 가장 위험이 낮으면서 효과가 큰 조치다.

---

## 6. 라이브 DB에서만 확인 가능한 것 (읽기 전용)

`docs/beta-security-3-rls-audit.sql`을 Supabase SQL Editor에서 실행하고 결과를
회신해 주세요. **전부 SELECT입니다.**

| 쿼리 | 확인하는 것 | 기대값 |
|---|---|---|
| ① | 전체 테이블 RLS ON/OFF + 정책 수 | 저장소 §1-1과 일치해야 함 |
| ② | 실제 존재하는 RLS 정책 | 0행 (콘솔에서 손으로 만든 게 없다면) |
| ③ | anon/authenticated GRANT 현황 | — |
| ④ | **RLS OFF + anon 권한 있는 테이블** | **0행. 아니면 R2가 실재한다** |
| ⑤ | 소유권 컬럼 현황 | — |
| ⑥ | workspace/사용자 수 | 사용자가 2명 이상이면 R1이 이미 실사고 |
| ⑦ | security definer 함수/뷰 (RLS 우회 경로) | — |

추가로 Vercel 환경변수에서 확인할 것: `CRON_SECRET`, `ADMIN_SESSION_SECRET`이
프로덕션에 설정돼 있는지 (둘 다 미설정 시 fail-open/기능정지).

---

## 7. 결정이 필요한 사항

1. **④번 결과가 0행이 아니면** — `commerce_accounts` RLS를 즉시 켤지, 아니면
   조사 완료 후 일괄 적용할지. (권고: **즉시**. 앱 영향 0이고 시크릿 노출이다.)
2. **`coupang_seller_settings` 싱글턴 구조** — workspace별로 쪼갤지, 아니면
   `commerce_accounts`(이미 다계정 구조)로 통합할지. 후자가 중복 제거 관점에서
   낫지만 등록 파이프라인 배선 변경이 필요하다.
3. **`Product` 테이블** — 실제로 쓰이는지. 안 쓰이면 이번에 정리.
4. **팀 기능 시점** — 지금 `workspace_id`만 넣을지, `workspace_members` 기반
   다중 멤버 정책까지 한 번에 설계할지.
