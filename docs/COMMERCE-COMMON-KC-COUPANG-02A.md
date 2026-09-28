# COMMERCE-COMMON-KC-COUPANG-02A — 🔴 DB 접근 불가

> CPO 작업지시(2026-09-28). SELECT 4개 실행. 조건 ⑨ 「CEO 에게 요청하지 말고
> CTO 가 접근 가능한 환경에서 실행 가능한지 **먼저 시도**」 · 조건 ⑩ 「접근
> 불가하면 **「DB 접근 불가」로 정확히 종료**하고 추측하지 않음」.

## 결론

```
🔴 DB 접근 불가.  SQL 4개 «한 건도» 실행하지 못했습니다.
🔴 그래서 결과를 만들지 않았습니다 — 판정표의 「DB 접근 자체 불가 → STOP」.
```

**코드 변경 0 · DB 쓰기 0 · 자격증명 추가 요구 0.**

---

## 시도한 경로 넷 — 전부 실행해서 확인했습니다

| # | 경로 | 결과 |
|---|---|---|
| ① | 로컬 env (`.env.local`, `apps/admin/.env.local`) | 🔴 Supabase 키 **없음**. 있는 것은 `VERCEL_OIDC_TOKEN` · `QA_PROXY_TO_PROD` · `OCI_PROXY_URL` |
| ② | Supabase CLI | 🟢 설치됨(2.118.0) · 🔴 **프로젝트 링크 없음**(`supabase/` 에 `config.toml` 하나, `project-ref` 없음) · `psql` 없음 |
| ③ | `vercel env pull` (제가 이미 인증된 환경) | 🔴 **비밀값이 빈 문자열로 옵니다** — 아래 |
| ④ | `/api/debug/*` 읽기 전용 라우트 | 🔴 5개 전부 토큰 게이트이고 **토큰도 빈 값**. 그리고 `registration_attempts` 를 읽는 라우트는 **없음** |

### ③의 실측 — 「없다」가 아니라 「받아봤더니 비어 있다」

```
$ npx vercel env pull <scratchpad>/probe.env --environment=production
✓ Created … probe.env

전체 51 개 중 값이 «있는» 것 9 개
  NX_DAEMON · TURBO_CACHE · TURBO_DOWNLOAD_LOCAL_ENABLED · TURBO_REMOTE_ONLY
  TURBO_RUN_SUMMARY · VERCEL · VERCEL_ENV · VERCEL_OIDC_TOKEN · VERCEL_TARGET_ENV
  → 🔴 전부 Vercel/Turbo «빌드 시스템» 변수다
  → 🔴 SUPABASE_SERVICE_ROLE_KEY · NEXT_PUBLIC_SUPABASE_URL ·
       COUPANG_* · NAVER_* · ADMIN_* · DEBUG_*  = «빈 문자열»
```

🔴 **값은 한 글자도 출력하지 않았습니다** — 길이만 셌습니다.
🔴 받은 파일은 **즉시 삭제**했고(삭제 확인함), 저장소 안이 아니라 세션
스크래치패드에 받았습니다. 커밋된 것 없습니다.

즉 Production 비밀값은 Vercel 이 **쓰기 전용(sensitive)** 으로 잠가 둔 것이고,
배포 권한이 있어도 **읽을 수 없습니다.** 이것은 정책이지 고장이 아닙니다.

---

## 🔴 그래서 「추측하지 않은」 것

판정표의 여섯 갈래 중 **어느 것도 고르지 않았습니다.**

```
두 문구 모두 SUBMITTED?      모름
한 문구만 등록됨?            모름
둘 다 없음?                  모름
KC notices 자체가 없음?       모름
두 문구의 결과가 다름?        모름
```

🔴 특히 「지금까지 쿠팡 등록이 성공해 왔으니 기본 문구는 문제없었을 것」이라고
쓰고 싶은 유혹이 있는데, **그것이 정확히 이번에 금지된 추론**입니다 — 성공한
시도에 KC 고시 칸이 **있었는지조차** 우리는 모릅니다(KC-COUPANG-02 §2).

---

## 다음에 필요한 것 — 셋 중 하나면 됩니다

| 안 | 내용 | 비고 |
|---|---|---|
| **①** | **CPO/CEO 가 Supabase SQL Editor 에서 쿼리 4개 실행 후 결과만 전달** | 🟢 가장 단순. 쿼리는 `KC-COUPANG-02` §6 에 그대로 있다 |
| ② | 읽기 전용 값(예: `SUPABASE_SERVICE_ROLE_KEY`)을 CTO 가 쓸 수 있는 형태로 제공 | 🔴 **권하지 않습니다** — service role 은 전체 쓰기 권한입니다. 이 조사에 그만한 권한이 필요 없습니다 |
| ③ | `registration_attempts` 조회용 **읽기 전용 debug 라우트** 신설 + 토큰 전달 | 🟡 기존 패턴(GET·토큰·fail-closed)과 동일. 다만 KC-COUPANG-02 §8 ②와 같은 「조사용 라우트」 결정이 필요 |

🔴 **②를 권하지 않는 이유**를 분명히 합니다. 이번 작업은 **SELECT 4개**입니다.
그걸 위해 전체 DB 쓰기 권한 키를 움직이는 것은 필요 이상이고, 이 저장소가
지켜 온 「필요한 만큼만」 원칙과 맞지 않습니다.

---

## 이번에 «하지 않은» 것

SQL 실행 ❌(불가) · 결과 추정 ❌ · 판정표 선택 ❌ · 코드 변경 ❌ ·
DB INSERT/UPDATE/DELETE ❌ · 자격증명 «추가 요구» ❌ ·
자격증명 «값» 조회·출력·커밋 ❌ · CEO 에게 실행 요청 ❌(시도를 먼저 했고,
이 문서는 결과 보고입니다).
