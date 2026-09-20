# 기술부채 등록부

> CEO 지시(2026-09-20, P0-B 종료 보고): 「**칩으로 묻어두면 안 된다.**
> 별도 기술부채 작업으로 **반드시 등록**해야 한다.」
>
> 이 문서는 **스프린트 범위에 끌어오지 않기로 결정했지만 잊으면 안 되는 것**만
> 적는다. 「나중에 하면 좋겠다」는 여기 적지 않는다 — 여기 적는 것은
> **이미 깨져 있거나, 이미 틀린 모양으로 굳어 있는 것**뿐이다.

---

## TD-1 🔴 `pnpm -r typecheck` 가 깨져 있다 — 저장소 전체 게이트를 믿을 수 없다

| | |
|---|---|
| 등록 | 2026-09-20 (P0-B 종료 보고) |
| 원인 커밋 | `327b54d` — fix(P0-A.29-F) **CTO 본인이 만든 것** |
| 상태 | 🔴 미해결 |
| 배포 영향 | **없음** — `next build` 는 `pnpm -r typecheck` 를 부르지 않는다 |

### 무엇이 깨졌나

`packages/crawler/src/comparison-search/__tests__/match-truth-priority.test.ts:10` 이
패키지 경계를 넘어 `apps/admin` 을 import 한다.

```
../../apps/admin/.../domestic-product-link.ts(1,34):
  error TS2307: Cannot find module '@/lib/supabase-admin'
src/comparison-search/__tests__/match-truth-priority.test.ts(10,35):
  error TS6059: File '.../apps/admin/.../domestic-product-link.ts'
  is not under 'rootDir' '.../packages/crawler/src'
```

### 🔴 그 import 는 «실수가 아니다» — 없애는 방향으로 고치면 안 된다

그 줄 위에 이유가 적혀 있고, 그 이유는 여전히 유효하다:

> 가격 티어 규칙을 여기에 다시 적지 않는다. 이 저장소가 반복해서 다친 곳이
> 「같은 질문에 답하는 두 번째 기준」이라, 돈이 움직이는 칸은 운영 함수를
> 그대로 부른다.

런타임에서는 성립한다 — vitest 러너 하나(`apps/admin/vitest.config.ts`)가 두
워크스페이스를 함께 돌리므로 `@` 별칭이 그 파일에서도 산다. **`tsc` 의 프로젝트
경계만 이것을 거부한다.**

### 고칠 때의 조건

테스트가 **실제 `priceTierFromLink` 를 계속 부르는 것**이 조건이다(티어 규칙을
테스트에 복사하는 «해결»은 이 부채가 막으려던 사고 그 자체다). 선택지:

- `priceTierFromLink` 를 공용 패키지로 옮기고 `apps/admin` 이 재수출
- 이 테스트 파일을 `apps/admin` 테스트 트리로 이동
- `packages/crawler/tsconfig.json` 이 `__tests__` 를 컴파일 대상에서 제외
  (🔴 다른 패키지가 실제로 그렇게 돼 있는지 **먼저 확인** — 가정하지 말 것)

검증: `pnpm -r typecheck` = 0 · `cd apps/admin && npx vitest run` 무회귀
(2026-09-20 기준 199 파일 2,515 테스트).

### 🔴 그때까지 보고 규칙 (CEO 지시)

「전체 회귀 통과」라고 뭉뚱그려 쓰지 않는다. **범위를 갈라서** 적는다.

```text
apps/admin typecheck = PASS
pnpm -r typecheck    = FAIL (기존 known issue, TD-1)
```

---

## TD-2 🟡 해외 경로는 「모르는 가격」을 «지운다» — 이번에 정한 원칙과 다르다

| | |
|---|---|
| 등록 | 2026-09-20 (P0-B 종료 보고) |
| 상태 | 🟡 설계 이슈 — 다음 스프린트(P0-C)에서 다룬다 |
| 범위 판단 | CEO: 「이번 `df57a3f` 에서 건드리지 않은 판단은 맞다」 |

### 두 경로가 서로 다르게 답한다

```text
국내 (df57a3f 이후)         해외 (SELLER_ORIGIN, 현재)
  price_amount  보존          ← 행 자체를 저장하지 않는다
  currency      보존          ←
  exchange_rate null          ←
  price_krw     null          ←
  → UNRESOLVED                → 관측이 «없었던 것» 이 된다
```

`run-price-check.ts` 는 환율을 모르면 `convertToKrwStrict` 가 null 을 주고
**그 시장 행을 통째로 건너뛴다**(에러 메시지만 남는다).

### 왜 지금의 모양이 틀렸나 (CEO 판단)

> **「가격을 모르면 없애지 말고, 모른다고 표시한다」** 가 더 올바른 데이터
> 모델이다.

행을 지우면 「그 시장을 확인했는데 환율을 몰랐다」와 「그 시장을 확인하지
않았다」가 같은 모양이 된다 — 이 저장소가 반복해서 거절해 온 바로 그 혼동이다.
원본가가 `product_snapshots` 에 남아 «완전 소실» 은 아니지만, **가격 관측
시계열에서는 사라진다.**

### 고칠 때의 조건

P0-B 에서 승인된 원칙을 그대로 쓴다 — 새 상태를 만들지 않는다.
기존 행은 소급 수정하지 않는다.

---

## TD-3 🟡 배송비 `shipping_cost_amount` 1,123/1,123 null

| | |
|---|---|
| 등록 | 2026-09-20 (P0-B 조사) |
| 상태 | 🟡 **미구현이지 결함이 아니다**(CEO 판정) — P0-C 의 주제 |

🔴 **버그라고 무작정 채우면 안 된다**(CEO). 배송비는 상품·국가·배송방법에 따라
달라진다. P0-C 에서 「어디서 결정되어야 하는가 / 지금 데이터로 무엇을 알 수
있고 무엇을 모르는가 / 모를 때 어떻게 표시하는가」를 먼저 확정한다.
