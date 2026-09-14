# COMMERCE-CREDENTIAL-SECURITY — workspace scoped + encrypted credential

**등록일** 2026-09-14 · **등록자** CTO · **지시** CPO, 2026-09-14
**상태** 🟡 별건 등록 — **롯데ON Sprint 2의 BLOCKER로 만들지 않는다**
**발견 경위** `LOTTEON COMMERCE SPRINT 2` STEP 1 아키텍처 조사

---

## 1. 무엇이 발견됐나

채널 인증정보가 **평문으로, 워크스페이스 구분 없이** 저장돼 있다.

```
Naver     평문 · 전역 싱글톤
Coupang   평문 · 전역 싱글톤   (coupang_seller_settings, id='default')
LotteON   같은 구조로 추가될 예정
```

실측:
- 저장소 전체에 `encrypt` / `aes` 계열 헬퍼 **0건**
- `commerce_accounts` · `coupang_seller_settings` 에 `workspace_id` 없음
- `workspace_id` 를 가진 테이블은 `product_snapshots` 등 일부뿐

## 2. 왜 지금 고치지 않는가

CPO 판단:

> 이번 Sprint에서 갑자기 **전체 credential architecture를 갈아엎지 말 것.**

롯데ON만 암호화하면 **세 채널이 서로 다른 방식을 쓰게 되어 더 나빠진다.** 그리고
이 문제는 롯데ON이 만든 것이 아니라 **이미 있던 것**이다. 채널을 하나 더 얹는다고
위험이 새로 생기지는 않는다 — 다만 **같은 상태가 하나 늘어난다.**

## 3. 목표 구조

```
workspace
   ↓
commerce account
   ↓
encrypted credential
```

## 4. 조사·설계에서 답해야 할 것

1. **암호화 키를 어디에 두는가.** Vercel env / KMS / Supabase Vault — 각각의 운영 부담.
2. **기존 행을 어떻게 옮기는가.** 평문 → 암호문 마이그레이션 중 서비스가 끊기지 않아야 한다.
3. **워크스페이스 스코프를 어떻게 넣는가.** 지금은 전역 싱글톤이라
   `id='default'` 한 행에 모두가 의존한다. 다중 판매자가 되는 순간 터진다.
4. **읽는 지점이 몇 곳인가.** `getCoupangCredentials()` / `getNaverCredentials()` 외에
   직접 읽는 곳이 있는지 전수.
5. **로그·마스킹 규약이 이미 있다** — 그것과 어떻게 맞물리는가.

## 5. 하지 말 것

```
❌ 롯데ON 만 암호화             세 채널이 서로 다른 방식을 쓰게 된다
❌ 채널별로 따로 고치기          같은 이유
❌ 이번 롯데ON Sprint 안에서 처리  범위가 터진다 (CPO 명시)
❌ 키를 코드/저장소에 두기
```

## 6. 우선순위

롯데ON Sprint 2 이후 **별도 보안 Sprint**로 잡는다.
다중 판매자(워크스페이스 여럿)가 실제로 생기기 **전에** 끝내야 한다 — 그 뒤에는
마이그레이션 비용이 급격히 오른다.

## 7. 관련

- `docs/lotteon-commerce-sprint-2-survey.md` — 이 발견의 출처
- `docs/beta-security-3-*` — 별개 트랙(다른 세션 산출물, 미추적)
