# WU-023 `MI-PRODUCTION-E2E-FINAL` — 실행 상태

> 🟢 ①②③④ 집행 완료. 🔴🔴 **⑤(flag ON) 직전에서 STOP** — 되돌릴 수 없는 지출이고
> CTO 혼자 끝낼 수 없는 구조적 장애 **둘** 이 확정됐다.
> 🔴 현재 Gemini 호출 **0** · credit 사용 **₩0** · 잔액 **₩3,171 보존** · flag **OFF**.

---

## 1. 집행한 것

| 단계 | 상태 | 증거 |
|---|---|---|
| ① 계측 로그 최소 보강 | 🟢 **완료** | `[MI-023-metrics]` 1줄 · flag 분기 «안» |
| ② `maxQueries` 상한 보장 | 🟢 **완료** | `2` → **`1`** · 테스트로 잠금 |
| ③ 테스트 빌드/회귀 | 🟢 **완료** | 516 files / **7,687 passed** · FAIL 0 · typecheck 10=baseline · build exit 0 |
| ④ Production 배포 | 🟡 **트리거됨 · 큐 대기** | `origin/main` `1f030313 → b65d1a14`(**98 커밋**) |
| ⑤ flag ON | 🔴 **STOP** | 아래 §3 |
| ⑥ 실상품 1건 테스트 | 🔴 **불가(구조)** | 아래 §3-② |
| ⑦~⑨ 비용 재확인/판단 | 🔴 미착수 | ⑤⑥ 선행 |
| ⑩ CEO 전달 | 🔴 미착수 | CPO 몫 |

### ② 가 왜 중요한가 — 상한을 **파라미터가** 지키게 바꿨다

```
전:  maxQueries: 2   ← 1 call 이 된 이유는 「buildPrimaryQuery 가 1개짜리 배열을 만들고
                        .slice(0, max(1, maxQueries)) 에 걸려서」였다. **우연이었다.**
후:  maxQueries: 1   ← 배열이 몇 개가 되든 **상품당 1 call** 이다.
🟢 테스트가 `2` 로 되돌리면 FAIL 한다.
```

### ① 이 없으면 §11 을 못 채운다

```
`geminiMetrics`(토큰·grounding query·discovered/usable URL·outcomes)는 POST `/check`
응답으로 **브라우저까지만** 간다(run-domestic-price-check.ts:1329). Production 화면은
로그인 뒤이고 **CTO 는 브라우저를 몰 수 없다.**
🟢 그래서 `[MI-016-gate]` 와 같은 규약으로 한 줄 찍는다 → Vercel 런타임 로그로 읽는다.
🔴 값을 **계산하지 않는다**(사칙연산·원가 어휘 금지를 테스트로 잠갔다 — 비용 추정 금지).
```

---

## 2. ④ 배포 — 사실만

```
origin/main   1f030313  →  **b65d1a14**   (98 커밋 · 이 트랙 전체가 처음 Production 으로)
working tree  clean · origin/main 과 HEAD **0/0**
Vercel        새 배포가 **Queued** 로 올라갔다(내 push 가 트리거)
Production    아직 **이전 배포를 서빙** 중 — read-only GET: `/` **200** · `/pipeline` **307**
🔴 그래서 「새 코드가 Production 에서 돈다」고 적지 않는다. **배포 완료 확인이 필요하다**:
     npx vercel ls --prod        → 해당 배포가 `Ready` 인지
🟢 기능 변화는 **0** 이다 — flag 가 OFF 라 Gemini 블록에 진입하지 않는다
   (`isGeminiDiscoveryEnabled()` 는 `=== "true"` 이고 env 에 **그 키가 없다**).
```

---

## 3. 🔴🔴 ⑤⑥ 에서 멈춘 이유 — 둘 다 「조심」이 아니라 **구조** 다

### ① flag ON 은 「상품 1개」 통제가 **아니다** — 전역 스위치다

`POST /api/price-history/check` 를 쏘는 곳이 **셋** 이고, flag 는 그 전부에 적용된다:

```
🔴 pipeline/page.tsx:465   **자동** — 새 스냅샷이 만들어지면 «무조건» 쏜다
                            → 상품 하나 분석할 때마다 Gemini 1 call
🔴 today/page.tsx:168      **일괄** — `bulkRecheck()` 가 전 상품에 동시성 3 으로 쏜다
                            → 버튼 한 번에 **상품 수만큼** call
🟢 Panel:1978              수동 「🔄 다시 분석」 — 우리가 쓰려던 그 경로
```

🔴🔴 **즉 flag 를 켠 순간부터 「상품 1개 = 1 call」이 보장되지 않는다.** 누가
`/today` 의 일괄 확인을 한 번 누르면 **잔액 ₩3,171 이 한 번에 소진될 수 있다.**
🔴 §5 의 「상품 1개 → 1 call」과 CPO 의 「처음부터 여러 상품을 돌리지 않는다」를
**flag 혼자서는 지킬 수 없다.**

### ② CTO 는 그 호출을 **일으킬 수 없다** — 세션 인증이다

```
check/route.ts:24   const auth = await requireUser();   ← 세션 쿠키
🔴 CLI/서버에서 부를 수 있는 토큰 우회가 **없다**(CRON_SECRET·x-api-key grep 0건).
→ 🔴 ⑥「실제 상품 1개만 테스트」는 **로그인한 사람이 화면에서 눌러야** 한다.
🔴 그런데 지시서는 「CEO Action Required: 지금은 없음」이다 — ⑥이 사람 클릭을
   요구하므로 그 둘이 **양립하지 않는다.** 그래서 보고한다(§13 「임의 수정 후 다시
   테스트하지 않는다」와 같은 원칙으로, 임의로 우회 경로를 만들지 않았다).
```

---

## 4. 🟢 제안 — 셋 중 하나를 CPO 가 고른다 (CTO 가 임의로 고르지 않는다)

| | 방법 | 비용 노출 | 「Production」 충족 | 필요 조건 |
|---|---|---|---|---|
| **A** | 배포 Ready 확인 → flag ON → **CEO/CPO 가 한 상품에서 「🔄 다시 분석」 1회** → 즉시 flag OFF | 🟡 창 동안 자동 1회차·일괄 버튼에 노출 | 🟢 **완전 충족** | 사람 클릭 1회 + 그 창 동안 `/today` 일괄 **금지** |
| **B** | flag 는 OFF 유지 → **로컬에서 운영 코드 경로로 1 call** 실측(같은 API key) | 🟢 **노출 1 call 로 고정** | 🔴 Production 아님(코드 경로는 동일) | CTO 단독 가능 · 즉시 |
| **C** | 호출을 **상품 단위로** 허용하는 장치 추가(예: 특정 snapshotId 만) | 🟢 가장 안전 | 🟢 충족 | 🔴 **코드 변경** — §2 금지와 충돌, 별 승인 필요 |

🔴 **CTO 추천: B → A 순서.** 이유는 CPO 가 쓴 그 문장이다 — 「비용이 예상보다 크면
즉시 중단」. **B 가 그 판단에 필요한 숫자를 1 call 로 먼저 준다.** 그 숫자를 보고
A 를 열지 결정하면, 전역 flag 를 **블라인드로** 켜는 구간이 사라진다.
🔴 A 를 먼저 열어도 되지만 그때는 **`/today` 일괄 확인 금지**를 CEO 에게 같이 전달해야 한다.

---

## 5. 지키고 있는 것

```
🟢 Gemini 호출 **0** · credit 사용 **₩0** · 잔액 **₩3,171** 보존
🟢 flag **OFF**(env 에 키 자체가 없다) · 판정/threshold/Registry/카테고리/가격추적 변경 **0**
🟢 microdata parser 추가 **0** · 해외 집계 추가 **0** · 외부 URL 저장 **0**
🟢 CEO 에게 직접 요청 **없음**(§10 — CPO 가 한 번에 전달한다)
🔴 flag 를 **CTO 가 임의로 바꾸지 않았다**(§3).
```
