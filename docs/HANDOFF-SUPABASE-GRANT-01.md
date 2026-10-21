# 🔴🔴 SUPABASE-GRANT-01 — **권한 실측 완료 · 변경 0** (10/30 대응)

> 🔴 CPO: 「메일의 `anon` CRUD 전부 GRANT 예시를 **그대로 적용하지 않는다.** 실제 접근
> 경로와 RLS 를 확인한 뒤 **최소 권한** 으로 migration 에 명시. **기존 테이블 일괄
> 재GRANT 금지** · default privilege 를 **임의로 revoke 하지 않는다.**」
>
> 🟢 **이 작업은 DB 를 한 글자도 바꾸지 않았다** — GRANT/REVOKE 0 · DDL 0 · 읽기만.
> 🔴 하니스: `packages/database/scripts/supabase-grant-audit.mjs` (read-only · 재실행 가능)

---

## ① 🟢 실측 (2026-10-21 · `current_user = postgres`)

```
public 테이블 **32**개
  anon           권한 보유 **32/32**  (DGIRSTU 전권)
  authenticated  권한 보유 **32/32**  (DGIRSTU 전권)
  service_role   권한 보유 **32/32**  (DGIRSTU 전권)

🔴🔴 RLS ON · **정책 0** = **31/32**
🔴   RLS OFF        = **1/32**  (`_prisma_migrations`) — 🔴 거기에도 anon 전권
🔴   migration 31개 중 `GRANT` 문을 가진 파일 = **0건**

pg_default_acl — 🔴 **`postgres → public [r]` 에 anon/authenticated/service_role
                 arwdDxtm 전권** 이 이미 걸려 있다
```

---

## ② 🟢🟢 **10/30 영향 평가 — 운영은 깨지지 않는다** (근거 둘)

```
⒜ Supabase 공지: **기존 테이블의 현재 권한은 유지** 된다 ⟹ 32개 테이블 영향 **0**
⒝ 🟢 우리 앱은 Data API 를 거의 쓰지 않는다 — service-role 키가 **없고**
   `DATABASE_URL`(postgres)로 직접 접근한다(메모 `production-secrets-are-write-only`
   의 정정분). ⟹ anon/authenticated 경로 의존이 **낮다**
```

🔴 **그래서 지금 급하게 GRANT 를 덮어쓸 이유가 없다**(CPO 판단과 일치).

### 🔴 단 하나 «미확정» 인 것 — 단정하지 않는다
```
`postgres → public [r]` default ACL 이 **현재는 있다** ⟹ 지금 `postgres` 로 만드는
새 테이블은 anon/auth/svc 에 **자동으로** GRANT 된다.
🔴 10/30 변경의 «구현 방식» 이 그 default ACL 을 **제거하는 것인지** 공지만으로는
   확정할 수 없다. 🔴 그래서 「새 테이블도 괜찮다」로 **적지 않는다.**
🟢 검증 방법은 하나다 — **10/30 이후에 테스트 테이블을 하나 만들어 실제로 확인한다**
   (아래 ④-E2E). 그 전에 추측으로 migration 을 바꾸지 않는다.
```

---

## ③ 🔴🔴 **더 중요한 발견 — 지금 안전한 이유가 GRANT 가 아니다**

```
RLS ON · 정책 0 = 31/32  +  anon 에 **DELETE/UPDATE/TRUNCATE 까지** GRANT
⟹ 🟢 지금은 RLS 가 **모든 행을 차단** 하므로 anon 이 아무것도 못 한다
⟹ 🔴🔴 그러나 **누군가 정책을 하나 추가하는 순간** anon 이 그 테이블에
        **삭제·수정까지** 할 수 있다. 막고 있는 것은 **얇은 층 하나** 다
```

🔴 Supabase 공식 문서: **RLS 와 GRANT 는 서로 다른 보안 계층** 이고 **최소 권한**
원칙을 쓰라고 명시한다. ⟹ 🔴 **이것이 10/30 보다 더 실질적인 위험이다.**

🔴 **그런데 지금 고치지 않았다** — 이유 셋:
```
⒜ 🔴 운영 32개 테이블의 GRANT 를 줄이는 것은 **되돌리기 어려운 Production 변경** 이고
   Data API 소비자를 전수 확인하기 전에는 **무엇이 깨질지 모른다**(§3 STOP 조건)
⒝ 🔴 CPO 가 「기존 테이블 일괄 재GRANT 금지」를 명시했고, **일괄 revoke 도 같은 성질** 이다
⒞ 🔴 `_prisma_migrations`(RLS OFF + anon 전권)만은 **단독 검토 대상** 이다 —
   Prisma 내부 테이블이고 Data API 가 읽을 이유가 없다. 🔴 단 그것을 건드리면
   migration 도구가 깨질 수 있어 **확인 전에 손대지 않았다**
```

---

## ③-B 🟢🟢 **STEP 3 완료 — anon 클라이언트는 «테이블을 읽지 않는다»**

🔴 문자열 `anon` 이 아니라 **실제 Data API 소비 경로** 로 찾았다(CPO ①).

### Supabase 클라이언트 생성부 — 전수 **3곳**
| 파일 | 생성 함수 | key |
|---|---|---|
| `lib/supabase-admin.ts:13` | `createClient` | **service-role** |
| `lib/supabase-browser.ts:25` | `createBrowserClient` | **anon** |
| `lib/supabase-server.ts:23` | `createServerClient` | **anon** |
| `proxy.ts:106` | `createServerClient` | **anon** (미들웨어) |

### anon 클라이언트 소비처 — 전수 **6곳** · 🔴 **테이블 접근 0**
| 경로 | role | 대상 테이블 | 읽기/쓰기 | 용도 |
|---|---|---|---|---|
| `app/api/auth/event/route.ts` | anon | **없음** | — | `auth.*` |
| `app/api/auth/logout/route.ts` | anon | **없음** | — | `auth.*` |
| `app/api/auth/me/route.ts` | anon | **없음** | — | `auth.*` |
| `app/auth/callback/route.ts` | anon | **없음** | — | `auth.*` |
| `app/login/page.tsx` | anon | **없음** | — | `auth.*` |
| `lib/auth/require-user.ts:67` | anon | **없음** | — | `auth.*` |
| `proxy.ts:121` | anon | **없음** | — | `auth.getUser()` |
| `lib/auth/require-user.ts:104~129` | 🟢 **service-role** | `workspace_members` · `workspaces` | 읽기 | 권한 확인 |

```
🟢🟢 **`.from(...)` / `.rpc(...)` 호출이 anon 경로에 «0건» 이다.**
   그 넷은 전부 `auth.*`(세션/로그인)만 쓴다 — `auth` 스키마이고 `public` 이 아니다.
🟢 `require-user.ts` 의 테이블 읽기 **4건은 `getSupabaseAdmin()`(service-role)** 이다
   (:95·:104 가 admin 을 따로 만든다 · anon 클라이언트는 :67 에서 `auth` 전용).
```

### 🔴🔴 그래서 확정되는 것 둘
```
⒜ 🟢 **`public` 32개 테이블에 대한 anon 권한은 «현재 아무도 쓰지 않는다».**
   ⟹ anon GRANT 축소의 «기능 위험» 은 이 코드베이스 안에서 **0 으로 측정됐다**
⒝ 🔴 그래도 **이번에 축소하지 않는다** — 코드 밖 소비자를 배제하지 못했다:
   Supabase Studio(Table Editor) · GraphiQL · 외부 도구 · 과거 스크립트 ·
   Realtime 구독. 🔴 그 전수 확인은 **Supabase 대시보드/로그** 영역이고
   CTO 가 읽을 수 없다(메모 `production-payload-is-unreachable` 계열).
   ⟹ 🟡 **별도 보안 WU** 로 CPO 가 열 사안이다(CPO 가 적은 그 순서 그대로).
```

🟢 **그리고 이것이 ②(10/30 영향 0)의 근거를 하나 더 준다** — Data API 를 통해
`public` 테이블을 읽는 운영 경로가 **코드에 없다**. 10/30 에 새 테이블이 노출되지
않아도 **지금 기능은 영향이 없다**.

---

## ③-C 🟡 **PART D 완료 — `_prisma_migrations` 판정 = 「추가 확인 필요」**

🔴 **변경 0** — REVOKE · RLS 토글 · POLICY · GRANT 변경을 **하나도 실행하지 않았다**(CPO 금지).

### 실측
```
① Prisma 접속 — `schema.prisma:7·8` = `env("DATABASE_URL")` / `env("DIRECT_URL")`
   ⟹ 🟢 **postgres direct connection** 이다. Data API(PostgREST)를 **쓰지 않는다**
② 앱 코드가 `_prisma_migrations` 를 참조하는 곳 — **0건**(apps·packages 전수 · 테스트 제외)
③ 🟢 `@prisma/client` 를 import 하는 **운영** 파일 — **0건**(테스트 2개뿐)
   ⟹ 런타임은 Prisma 를 쓰지 않는다. Prisma 는 **migration/스크립트 도구** 다
```

### 🟡 판정 — **추가 확인 필요** (SAFE 로 올리지 않는다)
```
🟢 SAFE 쪽 근거 — ⒜ Data API 소비자 0 ⒝ 앱 참조 0 ⒞ Prisma 는 postgres 로 접속하므로
   anon/authenticated GRANT 가 **필요하지 않다** ⟹ 그 둘을 revoke 해도 migration 은 돈다
🔴 그래도 SAFE 로 **적지 않는 이유 둘**:
   ⒜ Supabase 플랫폼이 그 테이블을 **자체적으로** 읽는지 확인하지 못했다
      (Studio 의 migration 뷰 · Supabase CLI `db` 명령 · 플랫폼 내부 작업)
   ⒝ 🔴 RLS OFF 를 **ON 으로 바꾸는 것** 은 더 위험하다 — Prisma 는 `postgres`(테이블
      소유자)로 접속하고 소유자는 기본적으로 RLS 를 우회하지만, `FORCE ROW LEVEL
      SECURITY` 나 소유자 변경이 끼면 **migration 이 멈춘다**. 🔴 그 조건을 실측하지 않았다
⟹ 🔴 **KEEP AS-IS + 추가 확인 필요.** 확인해야 할 것은 「Supabase 플랫폼이 이 테이블에
   anon/authenticated 로 접근하는가」 하나이고, 그것은 **Supabase 대시보드/지원 문서**
   영역이다(CTO 가 읽을 수 없다) ⟹ CPO 판정 사안.
🟢 🔴 그리고 이것은 **10/30 기한과 무관** 하다 — 기존 테이블이고 권한이 유지된다.
```

---

## ③-D 🟡 **PART E 준비 — 10/30 검증은 «그 날» 한다**

🔴 **production test table 을 만들지 않았다**(CPO 금지). 🟢 검증 절차만 고정한다:
```
그 날 할 것 (한 번 · 테스트 테이블 1개)
  ① create table public.grant_probe_YYYYMMDD (id uuid primary key);
  ② 즉시 `supabase-grant-audit.mjs` 재실행 → 그 테이블의 anon/auth/svc GRANT 를 읽는다
  ③ 🔴 핵심 질문 — `postgres → public [r]` default ACL 이 **그 테이블에도 적용됐는가**
  ④ drop table (cleanup)
분기
  Case A 자동 적용됨   → 현재 migration 계약 유지 · 추가 권한 변경 불필요
  Case B 자동 부여 안 됨 → 🟢 **anon 은 그대로 두고**(소비자 0) authenticated/
                          service_role 중 **실제 필요한 role 만** migration 에 명시
  Case C 예상과 다름    → 🔴 **임의 수정 금지 · STOP + 증거 보고**
```
🟢 ②의 하니스는 **이미 커밋돼 있다** — 새로 만들 것이 없다.

---

## ④ 🟡 다음 세션이 할 것 (CPO STEP 1~12 중 남은 것)

```
STEP 1 권한 dump            🟢 **완료**(위 ①) · 하니스 재실행으로 언제든 갱신
STEP 2 migration CREATE TABLE 전수  🟡 **부분** — .sql 31개 중 `GRANT` **0건** 확인.
                            🔴 테이블별 CREATE/RLS/POLICY/GRANT 매핑은 **미완**
STEP 3 Data API 실제 사용 매핑  🟢 **완료**(③-B) — anon 경로의 `.from`/`.rpc` **0건**
STEP 4 RLS/policy/GRANT 불일치  🟢 **최대 불일치는 ③ 하나** 로 확정(정책 0 + 전권)
STEP 5 필요한 테이블만 명시 GRANT  🔴 **STEP 3 이 끝나기 전에 하지 않는다**
STEP 6 신규 테이블 API E2E   🔴 **10/30 이후** 에 해야 의미가 있다(위 ② 미확정 항목)
STEP 11 10/30 이후 안전 증명  🔴 같은 이유로 **그 날 이후**
```

### 🟢 지금 바로 넣어도 안전한 것 — **migration 계약** (CPO STEP 3)
```
🔴 운영 DB 를 안 건드리고 **앞으로의 migration 규칙만** 고정하는 것이라 위험이 0 이다.
🟢 새 public 테이블을 만드는 migration 은 **그 파일 안에서** 셋을 같이 적는다:

   create table public.example (...);
   alter table public.example enable row level security;
   -- 🔴 실제 필요한 role 에만 · 🔴 anon 에 CRUD 전부를 주지 않는다
   grant select on public.example to authenticated;

🟢 그것을 **계약 테스트로 잠근다** — `migrations_manual/*.sql` 중 `create table public.`
   을 포함하는 파일은 **같은 파일에 `enable row level security` 와 `grant` 가 있어야**
   한다(없으면 FAIL). 🔴 기존 31개는 **예외 목록으로 고정**(소급 변경 금지 · 그 목록이
   줄어드는 방향으로만 바뀐다).
```

---

## ⑤ 🔴 이번에 하지 않은 것 (전수)
```
❌ grant ... on all tables in schema public to anon, authenticated, service_role
❌ 기존 32개 테이블의 GRANT 변경(추가도 축소도)
❌ pg_default_acl 의 revoke/alter
❌ RLS 토글 · 정책 추가/삭제
❌ `_prisma_migrations` 권한 변경
❌ MI · 가격비교 · 등록 로직 · 기존 기능 변경
```

🟢 **작업트리 clean · 운영 DB 변경 0 · 추가된 것은 read-only 하니스 1개와 이 문서뿐.**

🔴 **기한** — 2026-10-30. 🟢 **운영이 그날 깨지지 않는다**(②) ⟹ 남은 9일은
**STEP 3(Data API 사용 매핑) → migration 계약 → 10/30 이후 E2E** 순서로 쓰면 된다.
