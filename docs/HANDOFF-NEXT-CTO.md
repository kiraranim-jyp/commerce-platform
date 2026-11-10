# [CTO 인수인계 · 즉시 실행] `MI-UNIFIED-MARKET-PRICE-COMPARISON-1`

> 기준일 **2026-11-10** · 담당 **CTO** · 승인·검증 **CPO** · 최종 의사결정 **CEO**
> 🔴 이 문서는 **조사를 다시 하지 않기 위한 것**이다. 재조사·재설계·범위 확장 **금지**.

## 🔵🔵🔵 읽는 순서 — **이 블록이 유일한 진입점이다** (CPO 확정 2026-11-10)

🔴🔴 **다른 절이 「여기서 시작하라」고 말해도 이 블록이 이긴다.** 이 트랙에서 진입 문서의
여러 절이 **서로 다른 현재**를 말해 사고가 났다 — 그래서 시작점을 **한 곳**으로 고정한다.

```
① §15  범위 원장      ← 🔵 **여기서 시작한다**(무엇이 신규인지 · 신규는 4·5·6 뿐)
② §3   확정 좌표      환율 가드 · UI 3지점 · 서버 경로  🔴 충돌 시 **§3 이 우선**
③ §4   구현 순서      ⓿ 환율 hoist 부터
④ §5   검증 T1~T7
⑤ §10  첫 명령 5값    착수 전 git 상태 대조
🟡 배경이 필요할 때만 — §14(정정 승인·문서 우선순위·**작업지시서 원문**) · §13(전략 기준)
🔴 repo 밖 1순위는 `docs/STANDARD-V1.md`(MI 정책 헌장) 하나다
🔴 **작업지시서는 repo 파일이 아니다** — 목표·완료조건은 **§14-③ 에 보존**돼 있다
```

### 🟢🟢🟢 현재 상태 — **두 WU 모두 «구현·배포 완료» 다** (2026-11-10)

🔴 **§3~§16 은 그 WU 를 «하기 전» 에 쓴 문서다.** 「미구현」·「14 failed」·「266줄 미커밋」
같은 서술이 그 안에 남아 있지만 **전부 낡았다.** 아래가 현재 사실이다.

```
🟢 MI-UNIFIED-MARKET-PRICE-COMPARISON-1   **41d44100** 구현·배포 완료
   8항목 전부 연결(신규 4·5·6) · T1~T7 29건 · 변이 4종 검출 · 회귀 0 failed
🟢 MI-DOMESTIC-COMPETITIVE-SELLABILITY STEP 1  **f06be8d6** 구현·배포 완료
   재고 3상태를 표시 경로로 전달 · 계약 10 · 변이 2종 · 상세는 §17
🟢 작업트리 = **보존 40건뿐** (WU 변경분은 전부 커밋됐다)
   🔴 그 40건(`docs/START-HERE.md` 포함)은 **수정·staging·커밋 전부 금지** · `git add -A` 금지
```
```bash
git status --porcelain | wc -l           # → 40  (보존분만)
cd apps/admin && npx tsc --noEmit        # → 0
git log -1 --format=%h -- apps packages  # ← 운영 기준 커밋
```
🔴 **이 문서에 남은 「미구현/실패」 서술을 작업 지시로 읽지 않는다.** 재구현 금지.
🔵 다음 범위는 **CPO 가 지정한다** — 사이트별 예외가 아니라 **공통 MI 성능** 이 우선이다(§17-⑤).

---

## 0. 🔴🔴 먼저 — 이 문서는 HEAD 해시를 박지 않는다

```
🔴 지난 인수인계가 「HEAD = <해시>」를 박았다가 **그 문서를 커밋한 순간 낡았다.**
   새 세션의 `git log -1` 과 어긋나 「인계가 틀렸다」로 읽히는 사고가 실제로 났다.
🟢 그래서 확인은 **해시 대조가 아니라 구조** 로 한다:
```
```bash
git log -3 --stat --oneline                  # 위쪽이 docs/ 만 건드리면 운영 동작 불변
git log -1 --format=%h -- apps packages      # ← 「운영 기준 커밋」
```
🔴 **이 문서를 커밋하면 HEAD 가 docs 커밋이 된다 — 정상이다.**

---

## 1. 🟢 지금 상태 (CTO 실측)

```
브랜치        main                     origin/main   0 / 0
운영 기준 커밋  4964224a  feat(MI-UNIFIED-PIPELINE-1)
tree          b0792a3afbefea766992af1efb5225e41ff259e6
Production    Commit: 4964224 · Build Completed · ● Ready · HTTP 200
작업트리       🔴 **보존 미커밋 40건**(수정 12 + 미추적 28) — 절대 건드리지 않는다
마지막 성공    npx vitest run → 841 files / 10,713 passed · tsc 0 · build exit 0
```

🔴 **`docs/START-HERE.md` 는 그 40건 «안» 에 있다.** 그래서 이번에도 **갱신하지 않았다**.
좌표 갱신이 필요하면 **CPO 지시를 받고** 하라(임의로 건드리면 보존 상태가 흔들린다).

---

## 2. 🔵 이번 WU 의 목적 (CPO 확정)

> **해외 후보의 원래 가격·통화는 보존하고, 서버에서 동일한 환율 기준으로 KRW 파생값을
> 계산하며, UI 는 서버가 계산한 결과만 표시한다.**

🔴 고치는 결함 — **환산이 지금 «두 경로» 에서 따로 일어난다**:
```
서버  convertToKrwStrict(…, params.rates)   라이브 환율을 넘긴다
UI    convertToKrwStrict(amount, currency)  3번째 인자를 **넘기지 않는다** → 내장 고정표
⟹ 같은 후보의 「약 ₩…」가 경로에 따라 달라질 수 있다
🔴 실제 괴리 폭은 **측정하지 않았다** — 「다를 수 있다」까지가 확정된 사실이다
```

---

## 3. 🔵🔵🔵 확정값 — **재조사 금지**

```ts
// 환산 owner — packages/pricing/src/currency.ts:73
convertToKrwStrict(amount, currency, liveRates?) : KrwPrice | null
  // hasKnownRateToKrw 가 false 면 **null**  ← 「환산 불가는 null」 조건과 정확히 일치

// 환율·기준시점 owner — apps/admin/src/lib/exchange-rates.ts:43
interface ExchangeRates {
  rates: Record<string, number>;
  fetchedAt: string;                                  // ← rateBasisAt 로 쓸 값(이미 있다)
  source: "frankfurter" | "last_known" | "fallback";  // ← 🔴 아래 경고 참조
}
```

### 🔴🔴 반드시 설계에 넣을 것 — `source === "fallback"` 은 **비상 고정표** 다
`FIXED_RATES_TO_KRW` 로 떨어지는 경로가 **실패 시 자동으로** 동작한다. 지시서가 금지한
「임의의 기본 환율로 대체」가 **조용히** 일어나는 자리다.
⟹ 🔴 `priceKrwDerived` 를 낼 때 **`source` 를 반드시 같이 내보낸다.** 숨기면 셀러가
고정표 환산을 실제 환율로 오인한다. (제외할지 표시할지는 구현 시 판단 — **숨기는 것만 금지**)

### 🟢 스키마 변경이 필요 없다
```
exchange_rates 테이블에 fetched_at TIMESTAMPTZ NOT NULL 이 **이미 있다**(migration 045)
fetchedAt = Frankfurter 응답의 `date` 기준일 ⟹ **없는 시각을 만들어내지 않는다**
⟹ 🔴 migration 0 · 새 테이블 0
```

### 🔴🔴🔴 배선 자리 — **2026-11-10 CTO 실측으로 «정정» 됐다**

🔴 이 절의 이전 내용(「재배치 불필요」· UI 2곳)은 **틀렸다.** 아래가 실측값이다.
그대로 구현하면 ⒜ 환율이 전건 `undefined` 가 되거나 ⒝ 표시값과 확정값이 갈린다.

#### ① 🔴 `liveRates` 는 «조건부» 다 — 가드 밖으로 올려야 한다

```
market-intelligence.ts:657   let liveRates: Record<string, number> | undefined;
market-intelligence.ts:719   if (canComputeCost && shippingKrw != null) {
market-intelligence.ts:720     const exchangeRates = await fetchLiveExchangeRates();
market-intelligence.ts:721     liveRates = exchangeRates.rates;        ← 🔴 **이 가드 «안» 이다**

canComputeCost (:660)
  costSource !== "STATIC_SNAPSHOT" ? hasResolvedPrice
                                   : priceValidity === "VALID" && hasResolvedPrice
hasResolvedPrice (:659)  resolvedOriginalAmount > 0 && Boolean(resolvedOriginalCurrency)
```

🔴🔴 ⟹ **원상품 가격이 해석되지 않았거나 배송비가 `null` 이면 `liveRates` 가
`undefined`** 다. 그 상태로 해외 후보 KRW 파생값을 만들면 **전건 `null`** 이 된다 —
그런데 해외 후보 가격 자체는 그 조건과 **무관하게 존재한다**(원상품 가격이 없어도
후보는 수집된다). ⟹ 🔴 **「위치가 앞이라 그대로 쓸 수 있다」는 틀렸다.**
🟢 필요한 것은 **`fetchLiveExchangeRates()` 를 가드 밖으로 올리는 것**이고,
`cost` 계산 쪽은 기존 가드를 **그대로 둔다**(원가 축 회귀 0).
🔴 올릴 때 **호출이 2회가 되지 않게** 한다 — 같은 값을 두 번 받으면 두 숫자가
서로 다른 환율 위에 설 수 있다(아래 ③ 의 주석이 경고하는 바로 그 사고다).

##### 🔴🔴🔴 2026-11-10 3차 정정 — **「가드 밖」이 아니라 「`:404` 보다 위」다**

```
market-intelligence.ts:186   function savedCandidateRowsToEvidence(…)   ← GET 복원 생산자
market-intelligence.ts:404   dedupeEvidenceByUrl(savedCandidateRowsToEvidence(savedCandidateRows))
market-intelligence.ts:720   await fetchLiveExchangeRates()             ← 🔴 **소비보다 «뒤» 다**
```
🔴🔴 **후보 evidence 가 만들어지는 자리(`:404`)가 환율 조회(`:720`)보다 «앞» 이다.**
⟹ 「가드 밖으로」만 옮기면 **GET 재진입 복원 후보는 환율을 못 본다**(그 경로가 바로
`MI-UNIFIED-PIPELINE-1` 이 살려 둔 길이다 · §9). ⟹ 🔴 hoist 목표 지점은
**`:404` 보다 위** 다. 🔴 §3-① 의 「소비 :1247」 서술도 **불완전했다** — 소비처가 둘이다
(`:404` evidence 생산 · `:1247~` 응답 집계).

#### ② 🔴🔴 UI 환산 지점은 **2곳이 아니라 셋** 이고, 셋째가 가장 위험하다

```
MarketPriceComparison.tsx:1857   convertToKrwStrict(c.lowest, c.currency)              표시
MarketPriceComparison.tsx:2486   convertToKrwStrict(row.priceAmount, row.priceCurrency) 표시
MarketPriceComparison.tsx:2658   convertToKrwStrict(row.priceAmount, row.priceCurrency)
                                 🔴🔴 **표시가 아니다 — `priceOverrideKrw`(확정 판매가)에 기록한다**
```

🔴🔴 `:2658` 은 CLOSE-3 §4 의 **「가격 확정」 버튼**이고, 그 자리 주석이 스스로
**「넘기는 값은 위 줄이 화면에 이미 보여준 그 환산값」**이라고 적어 뒀다 —
즉 **`:2486` 과 같은 숫자여야 한다는 계약**이다.
⟹ 🔴 **`:2486` 만 서버 파생값으로 바꾸고 `:2658` 을 두면 「화면에 보인 금액」과
「확정되는 금액」이 갈린다.** 지시서(§7-1)는 이 지점을 모른다 — **셋을 같이** 고친다.
🟢 `:2658` 은 `row.priceCurrency === "KRW"` 면 환산을 건너뛰고, 환율을 모르면
버튼을 그리지 않는다(`mi-candidate-confirm-unavailable`) — **그 두 성질은 보존한다.**

#### ③ 🟢 코드가 이미 이 WU 를 예고해 뒀다 (설계 근거로 쓴다)

`market-intelligence.ts:656` 의 주석이 `liveRates` 를 그 자리에 선언한 이유를
**「두 숫자가 서로 다른 환율 위에 서게 된다」**고 적어 뒀다.
⟹ 🟢 이 WU 는 새 정책이 아니라 **그 주석이 경고한 상태를 닫는 것**이다.

#### ④ 🔴 서버 경로가 «둘» 이다 — 이 WU 의 대상이 아닌 쪽을 고치지 않는다

```
run-price-check.ts:112 · :125 · :180 · :201   convertToKrwStrict(…, params.rates)
  🟢 **이미 라이브 환율을 넘긴다**(CPO §7-1 의 서술은 사실이다)
  🔴 그러나 이 파일은 **원가/ORIGIN_FX 관측 경로** 다 — 해외 «후보» 집계가 아니다
해외 후보 집계·소비                            market-intelligence.ts (위 ①)
```
🔴 ⟹ **`run-price-check.ts` 를 고치면 엉뚱한 파일이다.** 이 WU 의 서버측 구현 자리는
`market-intelligence.ts` 하나다. 🟢 `price-intelligence/route.ts:48` 도 이미 rates 를
넘긴다(참고 · 대상 아님).

---

## 4. 🔵 구현 순서

```
⓿ 환율 확보     fetchLiveExchangeRates() 를 canComputeCost 가드 **밖으로** 올린다(§3-①)
                🔴 호출은 **1회** 유지 · cost 쪽 기존 가드는 **그대로**(원가 축 회귀 0)
① 서버 파생값   overseasEvidence 원소에 priceKrwDerived · rateBasisAt · rateSource 추가
                🔴 원래 priceAmount·priceCurrency 를 **덮어쓰지 않는다**
                🔴 환율 없으면 priceKrwDerived = null (임의 환율 금지)
② 응답 계약     그 값이 UI 까지 가도록 기존 응답 타입에 **최소** 추가
③ UI 교체      :1857 · :2486 · **:2658** 의 자체 환산 제거 → 서버 값 **읽기만**
                🔴🔴 :2658 은 `priceOverrideKrw` 확정 경로다 — 빼먹으면 **표시값 ≠ 확정값**
                🟢 :2658 의 KRW 단축 + 「환율 모르면 버튼 없음」은 **보존**
④ 비교         국내 KRW ↔ 해외 파생 KRW (같은 기준)
🔴 금지        통화 **합산** 0 · overseas-reference.ts 통화별 집계 계약 **보존** ·
               CASE A/B/C/D 0 · 동일성 승격 0 · 환산값을 EXACT 근거로 쓰지 않음 ·
               **run-price-check.ts 수정 0**(§3-④ · 다른 축이다)
```

🟢 **CPO 가 가른 핵심 구분** — 「**환산(비교용 파생값)**」 ≠ 「**합산**」.
`overseas-reference.ts` 가 금지한 것은 **통화를 합쳐 하나의 합계 칸을 만드는 것**이다.
후보별 KRW 파생값을 **따로** 제공하는 것은 그 계약을 건드리지 않는다 ⟹ **CEO 승인 불필요**.

---

## 5. 🔵 검증 (지시서 T1~T7)

```
T1 환산 계약     KRW/USD/EUR/GBP · 미지 통화 · 환율 누락 · 잘못된 가격 → null
T2 일관성       같은 입력·같은 환율 → 같은 결과 · 서버/UI 이중 계산 0
T3 UI 이중 환산  :1857 · :2486 · **:2658** 의 convertToKrwStrict 호출이 **사라졌는지**
   🔴 「파일 전체에서 convertToKrwStrict 0회」로 단언한다 — **좌표로 세지 않는다**
      (좌표는 구현하면서 밀린다 · 이 트랙에서 slice 단언이 세 번 어긋났다)
   🔴 추가 단언 — **표시 KRW == 확정 KRW**(:2486 ↔ :2658 이 같은 값을 읽는가)
T4 POST/GET     국내 KRW · 해외 USD/EUR/GBP · 환산 실패 후보 대조
T5 가격 비교     동일상품 ↔ 추정·유사 분리 · 해외 최저 환산 · 국내 대비 차이
T6 정책 회귀     EXACT 유지 · COMPARISON → CASE D 유지 · 추천가/판매판정 불변
T7 변이 4종     환율 전달 제거 · UI 서버값 사용 제거 · null 가드 제거 · POST/GET 환율 분리
```
🔴 변이는 **Edit 또는 literal 치환**으로 넣고 **적용 확인(md5 + 좌표 개수)** 을 찍는다.
🔴 복구 후 `git diff --quiet` 로 **바이트 동일**을 확인한다.

---

## 6. 🔴 이 트랙에서 실제로 밟은 함정 (반복 금지)

```
① 내 단언이 **동어반복** 이었던 적이 두 번 — 변이가 둘 다 잡았다
   ⒜ 「호출이 정확히 2개」로 세다가, 다른 변이가 그 호출 하나를 같이 지워 **축이 엉켰다**
   ⒝ split 으로 자른 조각 끝에 **다음 줄의 접두가 붙어** 변이를 통과시켰다
   🟢 교훈 — **좌표로 자른다**(예: 삼항의 `?` ~ `:`). 개수 세기는 축을 흐린다
② 소스 문자열 계약은 **주석을 벗기고** 본다(이 트랙에서 여덟 번 걸렸다)
③ 「전체 회귀 N건 PASS」를 **실제 상품 E2E PASS 로 쓰지 않는다**
④ `vercel ls --meta githubCommitSha=` 는 **작동하지 않는다**(CONTROL 실패로 확인).
   배포 확인은 **빌드 로그의 `Commit:` 줄** 과 `gh api .../commits/<sha>/status` 로 한다
⑤ push 가 배포를 **안 만들 수 있다**(실제로 1회 발생). GitHub commit status 에
   Vercel 항목이 0건이면 webhook 미처리다 — 빈 커밋으로 재트리거한 선례가 있다
```

---

## 7. 🔴 금지 (CPO·CEO 승인 없이 변경 금지)

```
CASE A/B/C/D · EXACT 가격 적격성 · COMPARISON → CASE D · PRESUMED_SAME 승격 ·
matcher threshold · Identity 8축/Probe · 추천 판매가 공식 · 판매 판정 ·
recommendedPriceKrw ↔ recommendation.recommendedPrice 소유 관계 ·
B 시장가격 노출 정책 · 통화별 관측 집계 · ORIGIN_FX 의미와 우선순위 ·
docs/START-HERE.md(보존 40건 안) · 기존 미커밋 40건 · 광범위 staging · 불필요 migration
```

---

## 8. 🟡 남아 있는 미검증 (완료로 적지 않는다)

```
① 실제 상품 URL E2E — 로그인 뒤 경로라 **CTO 가 실행할 수 없다**
   ⟹ 합성 fixture 를 E2E PASS 로 보고하지 않는다. CEO 확인 최소 항목만 요청한다
② 서버/UI 환산 **괴리 폭** 미측정(「다를 수 있다」까지가 사실)
③ 해외 복원분의 `priceObservedAt`(관측 시점)은 저장 구조에 **없다**
   — 필요하면 migration 제안이 **선행** 돼야 한다(임의로 만들지 않는다)
④ migration 081 이전 저장 행은 `match_reasons` 가 비어 POSSIBLE 군 복원이 안 된다
```

---

## 9. 🔵 직전 WU 들이 이미 닫은 것 (재구현 금지)

```
JUDGEMENT-DEDUP-1            접힘 안팎 중복 제거            69c942a0
SOURCING-CARD-MINIMAL-1      셀러 카드는 결과만 말한다        7903e5dc
MI-SOURCING-…-INTEGRATION    국내 후보 가격이 재진입에 산다   f0b4b693
  └ test 분리(B-2a/B-2b)                                  a0467971
MI-UNIFIED-PIPELINE-1        해외 후보도 같은 길로 복원       4964224a
```
🔴 이 다섯은 **CPO 가 보고 접수했다.** 다시 조사하거나 되돌리지 않는다.
🟡 `JUDGEMENT-DEDUP-1`·`SOURCING-CARD-MINIMAL-1` 은 **MI 완료 조건에 포함되지 않는다**(CPO 확정).

---

## 10. 🟢 첫 명령 (복붙)

```bash
git fetch origin --quiet
git branch --show-current                        # main
git status --short | wc -l                       # 40
git log -1 --format=%h -- apps packages          # 4964224a
git rev-list --left-right --count origin/main...HEAD   # 0  0
```
🔴 `40` 이 줄었으면 **누가 지운 것** 이다 — 정리하지 말고 **멈추고 보고**한다.

---

## 11. 🔴 용량 규칙 (이 트랙에서 세 번 걸렸다)

```
착수 «전» 에 전체 범위(구현·계약·변이·회귀 7분·빌드 2분·커밋·배포)를 판단한다.
끝까지 갈 수 있으면 **중간 보고 없이** 끝까지 간다.
부족하면 — 코드 변경 **전** 이면 **착수하지 않는다**.
이미 변경했으면 안전한 체크포인트 · 작업트리 상태 · 마지막 성공 명령 ·
정확한 재개 지시를 남기고 **clean 으로** 멈춘다.
🔴 완료하지 않은 작업을 완료로 보고하지 않는다.
```

---

## 12. 🟢 CPO 에게 올리는 첫 보고에 포함할 것

```
① 첫 명령 5값 대조 결과       ② 구현한 파일과 실제 diff
③ 서버 환산 owner·환율 기준    ④ 국내·해외 KRW 비교 결과
⑤ POST/GET 일관성            ⑥ UI 이중 환산 제거 확인
⑦ 계약·변이 결과(적용 md5 + 실패 계약 + 바이트 동일 복구)
⑧ 회귀/typecheck/build       ⑨ 실제 상품 E2E(미검증이면 그렇게)
⑩ 커밋·배포·tree SHA          ⑪ 미완료 및 위험
```
🔴 **파일 첨부는 이 대화에서 도달하지 않았다**(두 번 실패) — 증거는 **본문에** 싣는다.

---

## 13. 🔵🔵 CPO 인수인계서(2026-11-10) — 전략 기준 · 위 절들과 중복 없는 항목만

🔴 아래는 CPO 가 「프로젝트 기준 문서」로 확정한 내용 중 **§0~§12 에 없던 것**이다.
🔴 전략은 **확정됐다** — 새 페이지에서 다시 논의하지 않는다.

### ① 🔵🔵 국내·해외는 «하나의» 공통 후보 구조다 (CEO 핵심 지시)

> **국내와 해외를 다르게 관리하는 것이 아니라, 하나의 상품 비교 시스템에서
> `market` 만 구분한다.**

```
공통   상품명 · 브랜드 · 모델코드 · 이미지 · URL · 판매처 · 원래가격 · 원래통화 ·
       원화환산가격 · 가격관측시점 · 동일상품판단 · 가격비교 적격성
갈리는 것은 둘뿐
  국내  market=KR        국내 «판매»가격 관측   원래통화 KRW     국내 가격 기준
  해외  market=OVERSEAS  해외 «조달»가격 관측   원래통화 보존     ORIGIN_FX 환산 필요
🔴 국내용 별도 시스템 / 해외용 별도 시스템을 **만들지 않는다**
```
🟢 이번 WU 가 바로 그 마지막 칸(**원화환산가격**)을 공통 구조에 채우는 작업이다.

### ② 🔴 추천가격 owner 가 «둘» 이다 — 혼동 금지

```
recommendedPriceKrw              원가 기반 추천가격
recommendation.recommendedPrice  시장가격 기반 추천가격
🔴 서로 다른 owner 다. 합치거나 한쪽을 다른 쪽으로 대체하지 않는다.
🔴 B(시장가격) 금액은 기존 정책상 **판매자 UI 에서 숨긴다**(동결).
```

### ③ 🔴 검증 등급은 서로 «대체 불가» 다

```
Source Contract PASS  ≠  Component Render PASS
                      ≠  실제 Workspace Surface Render PASS
                      ≠  Production 실제 상품 E2E PASS
🔴 CTO 테스트 PASS 만으로 실제 상품 기능 정상이라 판단하지 않는다.
🔴 실제 E2E 를 돌리지 않았으면 **합성 fixture 로 PASS 를 주장하지 않는다.**
게이트: CTO 1차 → CPO 2차 독립검증 → CEO 3차 Production 화면
```

### ④ 🔴 UI 는 이번 WU 가 끝나기 «전» 에 재설계하지 않는다

```
🔴 과거 `SOURCING-CARD-MINIMAL-1` · `JUDGEMENT-DEDUP-1` 은 코드 변경·배포 보고가
   있었는데 **실제 Production 화면에서 기대한 변화가 확인되지 않았다**
   ⟹ 그래서 **Production UI PASS 로 닫지 않았다**
🟢 CEO 기존 지시(기억만 해 둔다 · 지금 구현 대상 아님) —
   국내·해외 **같은 카드 컴포넌트** · 상품명·가격 간결 · 동일상품 배지는 기본정보 근처 ·
   가격비교 반영/제외 표시 · 🔴 내부 blocker 노출 금지 · 🔴 하단 「우리 판단」 영역 금지 ·
   🔴 세로로 긴 카드 금지
```

### ⑤ 🔴 MI 완료 전 방향 전환 금지 (P0 고정)

```
P0  국내 동일상품 매칭 정확도 · 국내 가격근거 MI 연결 · 해외 후보 가격복원 ·
    **해외 후보 KRW 환산(= 이번 WU)** · 국내·해외 가격비교 · 수익성 판단 · ORIGIN_FX 정확성
P1  상품군 일반화        P2  추가 커머스 채널
🔴 MI 완성 전에 UI 꾸미기 · 추가 채널 · 상품군 확장으로 방향을 돌리지 않는다.
🔴 MI 완료 판정은 **CPO**, 다음 단계 결정은 **CEO**.
```

---

## 14. 🟢🟢 CPO 정정 승인 (2026-11-10) — **이 절이 문서 우선순위의 주인이다**

### ① 🟢 정정 4건 **승인됨** — 새 CTO 는 이것을 되돌리지 않는다

```
환율 확보     기존 cost 경로 활용        → 🟢 :719~720 **가드 밖** 에서 확보
UI 환산       2곳                        → 🟢 **3곳** (1857 · 2486 · 2658)
서버 경로     run-price-check.ts 중심    → 🟢 후보 집계 owner 는 **market-intelligence.ts**
확정 판매가   확인 부족                  → 🟢 표시 KRW == **priceOverrideKrw** 필수
```
🔴🔴 **CPO 가 넷째를 핵심으로 지목했다** — 「화면에 표시한 환산 가격과 판매자가 확정하는
가격이 다르면 안 된다. 이것은 단순 UI 테스트가 아니라 **실제 가격 결정의 정확성에 관한
핵심 계약** 이다.」 ⟹ 🔴 T3 의 「표시 KRW == 확정 KRW」를 **선택 단언으로 쓰지 않는다.**

### ② 🔵🔵 문서 우선순위 (CPO 확정) — 충돌 시 아래가 이긴다

```
1순위  docs/STANDARD-V1.md         MI 정책 헌장      🟢 커밋됨(94327ee9) · 보존 40건 «밖»
2순위  docs/HANDOFF-NEXT-CTO.md    구현 좌표·정정    🟢 이 문서
3순위  MI-UNIFIED-… 작업지시서      목표·완료조건     🔴 **repo 파일이 아니다**(아래 ③)
🔵 충돌하면 → **이 문서 §3**(최신 실측 정정)이 우선한다
```

### ③ 🔴🔴 3순위는 **새 페이지에서 도달 불가** 다 — 그래서 아래에 보존한다

```
🔴 실측 — 「MI-UNIFIED-MARKET-PRICE-COMPARISON」을 담은 repo 파일은 **이 문서 하나** 다
   (docs/ 전수 grep). 작업지시서는 **이전 페이지 대화 안에만** 있었다
⟹ 🔴 새 CTO 가 「3순위 지시서를 열어라」를 따라갈 곳이 **없다**
⟹ 🟢 그래서 그 목표·완료조건을 **여기 옮겨 둔다. 이 문서가 3순위를 대신한다.**
```

#### 🔵 지시서 구현 목표 (원문 보존)
```
① 서버에서 해외 후보별 KRW 파생값 생성 — priceKrwDerived · rateBasisAt(또는 환율 기준
   정보) · 환산 실패 시 null · 기존 ORIGIN_FX 소스 재사용
② UI 자체 환산 제거 — UI 는 서버에서 계산된 KRW 값만 읽는다
③ 국내·해외 가격 비교 — 아래 **여덟 칸** 이 완료 조건이다
     국내 동일상품 가격 · 국내 유사상품 가격 · 해외 후보별 원래 가격 ·
     해외 후보별 KRW 환산 가격 · 해외 최저 환산 가격 · 국내 대비 가격 차이 ·
     예상 원가 · 예상 수익성
     🔴 §4 ④ 의 「국내 KRW ↔ 해외 파생 KRW」는 그 여덟 칸의 **일부** 다 — 전부로 읽지 않는다
④ POST/GET 일관성 — 동일 환율 기준에서 동일 결과 · 환율 기준 시점·근거의 저장 가능성 확인
   🟢 저장 불가하면 기존 구조로 가능한 범위를 구현하고 **필요한 최소 migration 만 별도 제안**
```

#### 🔴 지시서 정책 보호 (절대 변경 금지 · 원문 보존)
```
통화별 관측 집계 · CASE A/B/C/D · EXACT 가격 적격성 · PRESUMED_SAME 승격 ·
동일상품 matcher · 기존 판매 판정 · 추천가격 공식 · B 시장가격 노출 제한
🔴🔴 **환산은 비교용 파생값이다. 합산이 아니다.**
🔴 해외 가격을 하나의 통화별 합계로 만들지 않는다
🔴 환산 가격은 **동일상품 판정 증거가 아니다**
```

### ④ 🟢 CPO 가 지시서에 **추가한 것으로 간주** 한 6조건 — 전부 이미 반영돼 있다

```
① fetchLiveExchangeRates() 를 canComputeCost 가드 밖으로      → §3-① · §4 ⓿   🟢
② 해외 후보 환산에 동일한 라이브 환율 공급                      → §3-① · §4 ①   🟢
③ UI 세 환산 지점 모두 서버 파생값 사용                        → §3-② · §4 ③   🟢
④ priceOverrideKrw 도 화면 표시 가격과 동일한 값               → §3-② · §4 ③   🟢
⑤ MarketPriceComparison.tsx 전체에 자체 환산 호출 0회          → §5 T3         🟢
⑥ 표시 KRW 와 실제 확정 KRW 일치 검증                         → §5 T3         🟢
🔴 ⟹ **새로 설계할 것이 없다. 바로 구현한다.**
🟢 기존 CASE 정책과 통화별 관측 집계는 **변경하지 않는다**(CPO 재확인)
```

### ⑤ 🟢 CPO 가 기록한 Git 기준선 (2026-11-10)

```
최신 문서 커밋  26329280      운영 코드 기준  4964224a
문서 전용 변경  1건            운영 코드 변경  0
기존 미커밋 보존 40건          staging 교집합  0
배포            기존 4964224 기준 (docs 커밋이라 운영 동작 불변)
🔴 새 CTO 는 이 숫자를 **현재 상태로 가정하지 않는다** — §10 첫 명령으로 다시 센다
   (이 문서를 커밋하면 「최신 문서 커밋」이 또 바뀐다 — 정상이다 · §0)
```

---

## 15. 🔵🔵🔵 범위 원장 (2026-11-10 CTO 실측) — **8항목을 «이미 있는 것/새로 만들 것» 으로 갈랐다**

🔴 이 절은 **착수 전 용량 판단의 근거** 다. 새 페이지는 이 표로 바로 구현에 들어간다(조사 0).

### ① 8개 완료 항목 — 분해 결과 **신규는 셋** 이다

| # | 항목 | 상태 | owner (실측) |
|---|---|---|---|
| 1 | 국내 동일상품 가격 | 🟢 **있다** | `domesticSummary.lowestPriceKrw` (:600·:749·:903) |
| 2 | 국내 유사상품 가격 | 🟢 **있다** | `domesticCandidatePriceSummary.byCurrency.KRW` (:1291·:1294) |
| 3 | 해외 후보별 원래 가격·통화 | 🟢 **있다** | `byCurrency{count,lowestAmount,highestAmount}` (candidate-market.ts:348) |
| 4 | 해외 후보별 **KRW 환산** | 🔴 **신규** | — (이 WU 가 만든다) |
| 5 | 해외 **최저 환산** 가격 | 🔴 **신규·구조적** | 아래 ② 참조 |
| 6 | 국내 대비 가격 차이 | 🔴 **신규** | — |
| 7 | 예상 원가 | 🟢 **있다** | `computePriceBreakdown` → `cost.landedCostKrw` (:722·:1006) |
| 8 | 예상 수익성 | 🟢 **있다** | `targetMarginPercent`·`marginChangePercentPoints` (:612·:753) |

🟢 ⟹ **1·2·3·7·8 은 이미 돈다.** 이 WU 의 실제 신규 구현은 **4·5·6** 이고, 그 셋이
전부 **같은 입력(라이브 환율)** 을 요구한다 ⟹ §4 ⓿ 이 선행 조건인 이유가 이것이다.

### ② 🔴🔴 항목 5 는 「통화별 최저」가 아니다 — **통화를 넘는 최저** 가 필요하다

```
현재   byCurrency: Record<통화, { count, lowestAmount, highestAmount }>
       ⟹ GBP 최저 · USD 최저 를 **각각** 안다
항목 5 「해외 **최저** 환산 가격」 = 통화를 **넘어** 하나를 고르는 값
       ⟹ 🔴 KRW 로 환산한 뒤에야 비교가 가능하다 ⟹ 현재 구조에 **그 칸이 없다**
```
🔵 **정책 충돌 여부는 이미 해소돼 있다**(§4 · CPO 확정) — 금지된 것은
「통화를 합쳐 **합계** 칸을 만드는 것」이고, 항목 5 는 **최저 1건을 고르는 파생값** 이다.
⟹ 🟢 `byCurrency` 를 **그대로 두고** 파생 칸을 **따로** 추가한다. `byCurrency` 를
고치거나 대체하면 그때 계약 위반이다.

### ③ 🔴 계약 표면 — `byCurrency` 참조 테스트 **48 파일**

```
grep -rln "byCurrency" apps/admin/src --include=*.test.ts  →  **48**
```
🟢 **가산(additive) 필드면 48개가 깨지지 않는다** — 기존 칸의 의미·개수를 바꾸지 않는 한.
🔴 그래서 설계 원칙이 하나로 고정된다 — **기존 칸은 건드리지 않고 새 칸만 더한다.**
🔴 회귀는 **841 files / 10,713 passed** 가 기준선이다(그 아래로 내려가면 원인 규명 전 커밋 금지).

### ④-2 🔴🔴🔴 2026-11-10 3차 — **`:1857` 의 `g.byCurrency` 는 «서버 집계가 아니다»**

```
:1857  g.byCurrency[0] → buildPriceGuide(j, "OVERSEAS")
       owner = apps/admin/src/app/pipeline/commerce/**mi-same-candidates.ts:914**
       🔴 그 파일은 `app/pipeline/commerce/` = **클라이언트** 다
       🔴 즉 `summarizeCandidateOverseasPrices`(서버)의 산출이 **아니다**
       호출부 — mi-same-candidates.ts:1312·1313 · DomesticPriceIntelligencePanel.tsx:4131
```
🔴🔴 ⟹ **서버 집계에 `lowestKrw` 를 더해도 `:1857` 은 그것을 읽지 않는다.**
🟢 그래서 설계가 하나로 좁혀진다 — **후보 «행» 에 `priceKrwDerived` 를 서버가 실고,
`buildPriceGuide` 가 그 값을 «고르기만» 한다**(환산 0 · 그래야 §5 T3 「파일 전체 환산
호출 0회」를 지키면서 `:1857`·`:2486`·`:2658` 셋이 **같은 숫자**를 읽는다).
🔴 ⟹ **`mi-same-candidates.ts` 가 변경 대상 5번째 파일이다**(§15-④ 의 「예상 4」 정정).

### ④ 🔵 운영 변경 대상 파일 (🔴 **예상 4 → 실측 5~6**) · 수정하지 않을 파일

```
🟢 대상  market-intelligence.ts  (1303줄) ⓿ hoist(**:404 보다 위**) · ① 파생값 ·
                                          ② 응답 · GET 복원(:186·:404)도 같이 받는다
         candidate-market.ts     (512줄)  요약에 파생 칸 **가산**(기존 칸 불변)
         mi-same-candidates.ts   (버들)   🔴 **3차에 추가** — buildPriceGuide(:914)가
                                          후보 행의 KRW 를 **고르기만** 한다(환산 0)
         MarketPriceComparison.tsx(2740줄) ③ UI 3지점(:1857 · :2486 · :2658)
         + 후보 행 타입(`priceKrwDerived`) · 필요 시 Panel 배선
🔴 금지  run-price-check.ts (§3-④ · 다른 축) · overseas-reference.ts 통화별 집계 계약 ·
         docs/START-HERE.md (보존 40건 안)
```
🔴 `apps/admin/AGENTS.md` 경고 — 이 Next.js 는 학습 데이터와 다르다. **route handler 를
건드릴 때만** `node_modules/next/dist/docs/` 를 먼저 읽는다(이번 범위는 lib·client 중심).

### ⑤ 🔴🔴 착수 전 용량 계획 (이 WU 는 «한 덩어리» 로 끝내야 한다)

```
읽기    4,555줄(1303+512+2740) 중 필요 구간 + 응답 타입
구현    ⓿ hoist · ① 파생값 3칸 · ② 응답 가산 · ③ UI 3지점 · ④ 8항목 연결
검증    T1~T7 + 변이 4종(적용 md5 + 바이트 동일 복구)
회귀    841 files(약 7분) + typecheck + build(약 2분)
마감    명시 staging → commit → push → Production 배포 확인
🔴 보존 40건이 작업트리에 **그대로 있다** — 중간에 끊기면 그 위에 부분 수정이 얹힌다.
   그것이 헌장이 「가장 나쁘다」고 적은 상태다 ⟹ **한 세션에서 끝까지 갈 때만 착수한다.**
```

---

## 16. 🟢🟢 CPO 최종 확정 (2026-11-10) — **목표를 바꾸지 않고 완료만 추적한다**

### ① 🔵 확정된 다섯

```
1  이번(인수인계) 세션에서는 **구현하지 않는다** — 보존 40건 유지 · 부분 구현 남기지 않는다
2  다음 CTO 페이지는 **§15 범위 원장** 기준으로 시작한다
3  신규 구현은 **4·5·6 만** — 해외 후보별 KRW 환산 · 해외 최저 환산 · 국내 대비 차이
4  기존 `byCurrency` 구조와 **48개 계약 테스트의 «의미»** 는 변경하지 않는다
5  **§4 ⓿ 환율 hoist 부터** 시작해 테스트·회귀·build·배포까지 **한 번에** 완료한다
🔴 추가 조사 · 재설계 · 범위 확장 **금지**
```

🟢 **CPO 가 명시한 평가 기준 하나** — 「이번 보고에서 중요한 것은 작업을 **미룬 것이
아니라**, 다음 CTO 가 **조사와 범위 재산정 없이** 구현에 들어갈 수 있도록 **완료 범위를
확정**했다는 점이다.」 ⟹ 🔴 그러므로 다음 세션은 **§15 를 다시 계산하지 않는다.**

### ② 🔵 새 페이지 첫 메시지 (CPO 원문 · 그대로 쓴다)

> `docs/HANDOFF-NEXT-CTO.md` 를 읽고 **§15 범위 원장**부터 확인하라. 이번 작업은
> `MI-UNIFIED-MARKET-PRICE-COMPARISON-1` **하나뿐**이다. 8개 항목 중 **4·5·6 만 신규
> 구현**하고, **1·2·3·7·8 및 기존 `byCurrency` 계약은 변경하지 않는다.** **§4 ⓿ 환율
> 조회 hoist 부터** 시작해 테스트·회귀·typecheck·build·commit·push·Production 배포
> 확인까지 **한 세션에서 끝내라.** 기존 미커밋 **40건은 절대 훼손하지 말 것.**
> **추가 조사·재설계·범위 확장 금지.**

### ③ 🔴 그래서 다음 세션의 「완료」는 이것이다 (부분 완료 금지)

```
⓿ 환율 hoist → ① 파생 3칸 → ② 응답 가산 → ③ UI 3지점 → ④ 8항목 연결
→ T1~T7 + 변이 4종(md5 + 바이트 복구) → 회귀 **841 files / 10,713** → tsc 0 → build 0
→ 명시 staging → commit → push → **Production 배포 확인**
🔴 8항목 중 일부만 구현하고 완료 처리하지 않는다(CPO 명시) — 1·2·3·7·8 은 **이미 있으니**
   「연결 확인」이 완료 조건이고, **새로 만드는 것은 4·5·6** 이다
🔴 Production 실제 상품 E2E 는 **CTO 가 로그인 뒤 화면을 볼 수 없다** ⟹ 서버 응답·DB·
   테스트 증거까지 CTO 가 준비하고, **합성 fixture 로 PASS 를 주장하지 않는다**(§14-③·§8)
```

---

## 17. 🟢 `MI-DOMESTIC-COMPETITIVE-SELLABILITY` — STEP 1 배포 · looxloo **CLOSED**

🔴 **CPO 가 조사를 끊었다**(2026-11-10). 이 절은 **기록** 이고 착수점이 아니다.

### ① 🔵🔵 확정된 공통 원칙 — 사이트별 예외를 만들지 않는다

> **80% 공통 기능을 완성하기 위해 20% 예외를 무한히 파고들지 않는다.
> 수집할 수 있으면 수집하고, 못 하면 `UNKNOWN` 으로 넘긴다.**

```
🟢 신뢰할 수 있는 재고 신호를 주는 사이트 → 수집한다
🔴 안 주거나 해석이 불확실하면 → **UNKNOWN** (추정 금지)
🔴 재고 수집 실패를 **상품 매칭·가격 수집 실패로 전파하지 않는다**
🔴 특정 사이트의 재고 때문에 **전체 파이프라인을 지연시키지 않는다**
🔴 그 사이트를 위한 **예외 로직을 만들지 않는다**
```

### ② 🟢 STEP 1 배포 완료 (`f06be8d6`)

```
🟢 AggregationEvidence Pick 에 "soldOut" · GET 복원 `soldOut: r.soldOut`
🔴 국내 transient «판정 입력» 레코드는 **`soldOut: null` 유지** —
   거기에 실제 값을 넣었더니 `wu-061-price-closure:282` 가 FAIL 했고
   (`computeSellerAction` 의 `soldOutCount` 가 `DOMESTIC_SHOP` 행만 센다)
   **판매 판단이 조용히 바뀔** 자리였다 ⟹ 되돌렸다
🔵 **「재고를 수집하는 것」과 「판매 판단에 사용하는 것」은 서로 다른 승인이다**
계약 10 · 변이 2종(M1 2 FAIL · M2 3 FAIL) · 회귀 843 files / 10,752 passed · tsc 0 · build 0
```

### ③ 🔴 looxloo — **재조사 금지** (확정 사실만)

```
🔴 HTML 템플릿 마커는 재고 신호가 **아니다**(상품 5건에서 값이 전부 동일 = 상수)
🟢 JSON-LD 는 변동한다 — 단 `availability` 는 **옵션(variant) 단위** 다
   실측: ProductGroup `hasVariant` 3 중 1 OutOfStock · 2 InStock (같은 상품)
   ⟹ 「InStock+OutOfStock 혼재」는 모순이 아니라 **옵션별 상태** 다
🟢 옵션 선택 «전» 응답에 전 옵션 상태가 다 있다 ⟹ 선택 전후 변화 **없다** · 옵션 API 불필요
🔴 `OutOfStock` 만인 전체 품절 상품 — 30건 스캔에서 **0건**
   ⟹ 「없다」가 아니라 **「검색 경로로는 확보되지 않았다」**(미확인)
🔴 어댑터 구조적 원인 — `looxloo.ts:137` 이 **검색 결과만** 받고 상세를 열지 않는다
🔵 상세 Fetch 추가 = **보류 유지**(CPO)
```

### ④ 🟢 어댑터별 재고 생산 능력 (재조사 불필요)

```
🟢 littleluna(HTML 품절 마커) · foretforet(옵션 단위 · 「하나라도 SALE 이면 false」)
🔴 chocoel(**항상 null** · 주석이 명시) · deuxbebe(기본 null) · looxloo(코드 없음)
```

### ⑤ 🔵 다음 방향 — MI 본래 목표로 복귀 (CPO)

```
국내 동일상품 판매가격 → 국내 판매·재고 확인 가능 여부 → 해외 소싱 가격
→ 원화 환산 → 비용 반영 수익성 → **지금 판매할 가치가 있는가**
🔴 사이트별 예외 해결이 아니라 **여러 사이트에 적용되는 공통 MI 성능** 이 우선이다
```

---

## 18. 🔵🔵🔵 **다음 작업 = 화면 연결 하나** (CPO 승인 2026-11-10 · 조사 0으로 시작)

🔴🔴 **완료 기준은 배포 Ready 가 아니다.** 「판매자가 국내 시장가격과 해외 소싱가격의
차이를 **즉시 이해**하는 화면」이다. 테스트 숫자·배포 상태로 완료 보고하지 않는다.

### ① 🔴 끊긴 좌표 (실측 확정)
```
marketKrwComparison   market-intelligence.ts:1428 **생산 1회 · 소비처 0**
                      ⟹ 서버가 계산해서 «아무도 안 읽는다»
priceKrwDerived       컴포넌트 2곳이 읽는다(배선 있음)
                      🔴 그런데 **실제 화면에 원화 환산이 보이지 않는다**(CEO 스크린샷)
                         ⟹ 「배선 있음」과 「화면에 뜸」이 갈린다 — 원인 추적이 이 WU 안이다
```

### ② 🔵 할 일 (기능 추가 금지)
```
⒜ marketKrwComparison → 응답 → Workspace → **첫 화면 영역**
   「국내 ₩88,000 ↔ 해외 최저 약 ₩N ↔ 차이 ₩D」
⒝ 후보별 원화 환산이 **실제로 렌더되는지** 확인 · 안 되면 원인 수정
   🔴 환산 불가를 0원·추정금액으로 만들지 않는다
⒞ T6-1 재지정 — 「등장 1회」 → **「판정 owner 가 읽지 않는다」**(화면 소비는 허용)
   🔴 그 계약이 지금 **화면 연결까지 막고 있다**(내가 박은 것이다)
```

### ③ 🔴 금지
```
새 재고 조사 · 사이트별 예외 · 추천가격 공식 변경 · CASE/판매 판정 변경 ·
보존 40건(`docs/START-HERE.md` 포함) 수정 · 관련 없는 파일 수정 · `git add -A`
```

### ④ 🔴 보고는 **세 가지를 분리** 한다 (CPO 지정)
```
1 코드에서 연결됐는가   2 실제 Production 화면에 표시되는가
3 표시된 금액이 **가격 확정 버튼의 금액과 일치** 하는가
🔴 2·3 은 CTO 가 로그인 뒤 화면을 볼 수 없다 ⟹ **CEO 확인으로만 닫힌다**
```

### ⑤ 🟢 시작 상태
```
HEAD e6c44425 · 운영기준 f06be8d6 · 작업트리 **보존 40건뿐** · staged 0
tsc 0 · 회귀 843 files / 10,752 passed · build 0 · Production ● Ready
```

### ⑥ 🔴 이 구간에서 내가 틀린 것 (반복 금지)
```
서버 계산을 끝내고 「완료」라고 불렀다. 화면에 닿는지 확인하지 않았다.
🔴 `aggregated-field-nobody-reads` 메모리를 **갖고 있으면서** 같은 구멍을 만들었고,
   T6-1 계약으로 그 상태를 **고정** 까지 했다.
⟹ 앞으로 「집계/파생 칸을 추가한 WU 는 **그 칸의 소비처를 같은 WU 안에서** 만든다」.
```

---

## 19. 🔵 `MI-SELLER-PRICE-COMPARISON-UI-1` — B-1 완료 · **다음은 A 하나**

### ① 🟢 B-1 완료 (`100d6dfd`) — 재조사 금지
```
원인  후보 카드를 그리는 표면이 **둘** 인데 지난 WU 가 다른 쪽만 고쳤다
      gt-price(GeminiTransientCandidates) ← 화면에 서는 쪽 · **비어 있었다**
      mi-candidate-price(MarketPriceComparison) ← 그때 고친 쪽
🟢 priceKrwText(row) + `gt-price-krw` 줄 추가 · 원본 줄 불변 · UI 환산 0
🟢 계약 12 · mi-022 재지정(CPO §2) · 회귀 844 files / 10,761 passed · build 0
🟡 **CEO 확인 대기** — ① 약 ₩ 표시 ② 환산 불가 문구 ③ KRW 중복 없음
```

### ② 🔴🔴 A 착수 전 **반드시 알아야 할 사실** (2026-11-10 실측)
```
grep "candidateOverseasPrice|candidateDomesticPrice" pipeline/commerce/*.tsx
  → **전부 주석** 이다. 읽는 «코드» 가 0 이다.
⟹ 🔴 서버 집계 칸들이 **화면에 배선돼 있지 않다**
⟹ 🔴 A 는 「marketKrwComparison 한 줄 추가」가 **아니다** —
     응답 → Workspace prop → 첫 영역까지 **배선 자체를 새로 깔아야** 한다
🟡 그래서 A 는 B-1 보다 **크다.** 착수 전에 그 전제로 용량을 잡는다
```

### ③ 🔵 A 완료 형태 (CPO 지정)
```
국내 ₩88,000  ↔  해외 최저 약 ₩N  ↔  차이 ₩D
🔴 없는 값은 「국내 가격 없음」·「해외 가격 없음」·「환산 불가」로 적는다
🔴 비교 불가 상태에서 차액을 계산·추정하지 않는다 · 부호와 기준을 명시한다
🔴 T6-1 재작성 필요 — 지금 「등장 1회」라 **화면 소비를 막고 있다**
   → 「판정 owner 가 읽지 않는다」로 재지정(화면 소비 허용)
🔴 금지 — CASE/추천가격/sellerAction/matcher/재고 정책/DB 변경
```

---

## 20. 🔵🔵🔵 **다음 작업 = B-1 데이터 경로 연결** (CPO 설계 확정 2026-11-10)

🔴 **조사·설계 회의 끝났다. 1번부터 바로 구현한다.**

### ① 🔴 원인 (재조사 금지 · 실측 확정)
```
화면 카드   <GeminiTransientCandidates evidence={overseasAutoRest} />
            ← overseasAuto ← **domesticShop.overseasAutoEvidence**(Panel:2453·:2971)
내가 붙인 곳 computeMarketIntelligence 반환의 geminiEvidence · savedCandidateRows
⟹ 🔴 **서로 다른 배열** 이라 attachDerivedKrw 가 닿지 않는다 ⟹ 전건 「원화 환산 불가」
🟢 환율·환산 함수는 **무죄** 다 — FIXED_RATES_TO_KRW 에 USD·GBP·EUR·JPY·SEK 가 있어
   라이브 환율이 없어도 환산된다. 🔴 **SGD 는 그 표에 없다**(라이브 없으면 null 이 정상)
```

### ② 🔵 확정 설계 (CPO 승인)
```
환율 소유자   MI 한 곳          route 에서 별도 환율 조회 **금지**
전달 데이터   candidateKrwByUrl (URL → 환산 KRW 지도 · **환율표가 아니다**)
             🟢 그래서 내부 환율이 API 로 노출되지 않는다
적용         기존 attachDerivedKrw(rows, krwByUrl) **재사용**(새 로직 0)
대상         check/route.ts:218 의 PRODUCERS **6배열 전부**
             WEB_SEARCH · DOMESTIC_LISTING · OVERSEAS_AUTO ·
             SELLER_URL · GEMINI · REVIEWED_SAME
🔴 금지      run-domestic-price-check.ts 수정(그 파일은 환율을 모른다 · owner 둘 금지) ·
             원본 priceAmount/priceCurrency 변경 · SGD 를 억지로 맞추기
```

### ③ 🔵 실행 순서 (CPO 지정)
```
1 MI 반환에 candidateKrwByUrl 추가       2 route 6배열에 동일 지도 적용
3 배열 누락 방지 계약                     4 GBP/USD 숫자 · SGD null 검증
5 회귀 → tsc → build                     6 명시 staging → commit → 배포
7 **실제 카드 입력 배열에서 숫자형 KRW 생성 증명**
🔴 계약 축 — 6배열 중 하나라도 빠지면 FAIL(배열이 늘 때 조용히 빠지는 것이 이번 실패의 본질)
🔴 행마다 1회 · 저장분↔실시간 중복 환산 0(같은 지도를 보므로 구조적으로 불가)
```

### ④ 🔴🔴 완료 판정 — **둘을 구분한다**(CPO)
```
⒜ 서버가 환산값을 만들었다            ← 이것만으로 완료가 아니다
⒝ **실제 판매자 후보 카드가 그 값을 받는다**  ← 여기까지 증명해야 한다
🔴 ⒝ 까지 증명된 «뒤에» CEO 화면 확인을 요청한다. 그 전에 요청하지 않는다.
```

### ⑤ 🔴 이번 구간에서 내가 반복한 실수 (같은 계열 두 번)
```
B-1 1차   표면이 **둘**(gt-price ↔ mi-candidate-price)인데 **한 장만** 고쳤다
B-1 2차   배열이 **여섯**인데 **둘**(geminiEvidence·savedCandidateRows)에만 붙였다
⟹ 🔴 「연결했다」고 말하기 전에 **화면이 실제로 읽는 배열/컴포넌트를 끝까지 추적** 한다
   그리고 그 추적 결과를 **계약으로 고정** 한다(위 ③-3 이 그것이다)
```

---

## 21. 🔵 B-1 배포 완료(`0a774118`) · 🔴 **A 착수 전 경고 하나**

### ① 🟢 B-1 데이터 증명 (운영 함수 실측 · 재측정 불필요)
```
GBP 37 → 64,380 · USD 41 → 56,580 · SGD 70 → **null**(고정표에 SGD 없음 · 정상)
카드 입력 배열까지 전달 확인 · 원본 priceAmount/priceCurrency 불변
계약 15 · 변이 2종(M1 배열 누락 2 FAIL · M2 route 환율조회 1 FAIL)
회귀 845 files / 10,776 passed · tsc 0 · build 0 · 배포 ● Ready
🟡 남은 것 = **CEO 화면 확인 1회**(약 ₩64,380 · 약 ₩56,580 · 환산 불가 · KRW 중복 없음)
```

### ② 🔴🔴 A 의 「해외 최저」는 **카드 최저와 다를 수 있다**
```
카드 목록(B-1)   후보를 **넓게** 보여준다 — 자격 퍼널을 통과하지 않은 것도 선다
A 의 입력        overseasSummary.lowestKrw
                 ← 자격 퍼널 **전부 통과** 한 후보만(EXCLUDED·부적격 verdict·
                   관측된 차이·가격 미확인 **제외**)
⟹ 🔴 화면에 「약 ₩56,580」 카드가 보이는데 A 가 「해외 최저 약 ₩64,380」 이라고
   말할 수 있다. **버그가 아니다** — 분모가 다르다.
🔴 그래서 A 는 그 숫자 옆에 **무엇의 최저인지** 를 반드시 적는다
   (「동일상품 확인 후보 중 최저」 류 · 어휘 owner 는 기존 상수를 따른다).
🔴 적지 않으면 CEO 가 「카드엔 더 싼 게 있는데 왜 이 숫자냐」로 읽는다 —
   이 트랙이 반복해서 만든 「같은 화면에 두 숫자」 사고와 같은 모양이다.
```

### ③ 🔵 A 범위 (CPO 확정 · §20 과 별개 WU)
```
국내 참고가격 ₩88,000  ·  해외 최저 소싱가 약 ₩N  ·  가격 차이 ₩D
🔴 marketKrwComparison(market-intelligence.ts) → 응답 → Workspace → **첫 영역**
🔴 §19-② — 그 계열은 **배선이 아예 없다**(candidateOverseasPrice 등도 주석뿐)
   ⟹ A 는 B-1 보다 **크다**. 착수 전 그 전제로 용량을 잡는다
🔴 T6-1 재작성 필요(현재 「등장 1회」라 화면 소비를 막는다)
🔴 금지 — CASE/추천가격/sellerAction/matcher 변경
```

---

## 22. 🟢 B-1 **실제 화면 PASS** · 🔴 USD 불일치(별도 추적) · 🔵 A 착수

### ① 🟢 B-1 닫힘 (CEO 화면 확인 2026-11-10)
```
GBP 37 → 약 ₩66,854  PASS    USD 41 → 약 ₩55,218  PASS
국내 KRW 88,000 — 환산 중복 **없음**  PASS
SGD 70 — 카드 하단이 잘려 **미확인** 🟢 단 구조적으로 환산 불가가 «확정» 이다:
   FIXED_RATES_TO_KRW 에 SGD **없음** + TRACKED_CURRENCIES(라이브 symbols)에도 **없음**
   ⟹ 운영에서도 null 이다 ⟹ 🔴 **CEO 재확인을 요청하지 않는다**(계약으로 잠근다)
```

### ② 🔴🔴 **USD 40.6(요약) ↔ USD 41(카드)** — A 에서 «덮지 않는다»
```
🟡 유력 가설(미검증) — §21-② 가 경고한 「분모가 다르다」가 실제로 나타난 것.
   요약 「해외 최저 소싱가」  자격 퍼널 통과 후보만(EXCLUDED·부적격 verdict·
                            관측된 차이·가격 미확인 제외) + SAME_PRICE_CAP 상한
   카드 목록              후보를 **넓게** 보여준다
   ⟹ 두 숫자가 **서로 다른 후보** 일 수 있다
🔴 **단정하지 않는다.** A 착수 시 ⒜ 두 숫자의 생산자를 각각 특정하고
   ⒝ 같은 후보인지 다른 후보인지 **ID 로 대조** 한다.
🔴 **A 가 이 불일치를 임의로 덮지 않는다**(CPO 명시) — 원인을 밝히고 그 결과를 보고한다.
🔴 만약 «같은 후보» 인데 숫자가 다르면 그것은 가설이 아니라 **진짜 버그** 다.
```

### ③ 🔵 A 실행 범위 (CPO 승인 · 8항)
```
1 marketKrwComparison 서버 계산 확인      2 API 응답 연결
3 Workspace 전달                          4 **첫 화면** 에 국내 ↔ 해외 최저 ↔ 차액
5 해외 최저가의 **자격 범위를 퍼널 코드로 입증**
6 CASE·추천가격·판매자 판정 **변경 0**
7 T6-1 → **실제 화면 소비 검증** 으로 개편(「등장 1회」 폐기)
8 전체 회귀 · tsc · build · 배포
🔴 문구 금지 — **「참고가격 반영 후보」** (자격 축이 다르다 · CTO 가 정정했고 CPO 승인)
🔴 최종 문구는 **5번 입증 뒤** 결정한다 · 기존 어휘 owner(SAME_PRICE_LABEL 등)와 충돌 확인
🔴 §19-② 전제 — 그 계열은 **배선이 아예 없다** ⟹ A 는 B-1 보다 크다
```

### ④ 🔴 내가 이 구간에서 틀린 것 (반복 금지)
```
⒜ 후보가 안 보이는 화면에서 「네 항목 확인」을 요청했다 — **순서가 틀렸다**
⒝ SGD 기대값을 고정표만 보고 적었다 — 라이브 symbols 를 **안 봤다**(결론만 우연히 맞음)
⟹ 🔴 기대값은 **운영 경로의 입력까지 확인한 뒤** 적는다
```

---

# 23. 🔵🔵🔵 **새 페이지는 여기서 시작한다** (2026-11-11)

🔴🔴 **위 §1~§22 는 끝난 WU 의 기록이다.** 현재 좌표는 **이 절 하나** 다.

## 23-0. 🔵 전략 (CPO 재고정 2026-11-10 · 모든 작업의 기준)

> **가격 정보는 «정확하게 제공» 하고, 판매 판단은 «MI» 가 한다.
> 가격 차액이나 수익 계산으로 셀러의 선택을 대신하지 않는다.**

```
🔴 차액·가격차이 방향·그것으로 선택 유도 — **금지**(A 에서 구현했다 철회·제거 02b670a4)
🔴 국내·해외를 하나의 최저가/차액으로 **뭉치지 않는다** — 나란히 보여준다
🔴 가격 채널과 판단 채널을 **섞지 않는다**(판매 가능 여부는 CASE·MI 가 말한다)
🔵 우선순위  ① 국내 정합성 ② 해외 정합성 ③ MI 판단 ④ 후보 템플릿 통일 ⑤ 전상품 E2E
🔴 ①~③ 과 무관한 기술·UI 개선, 새 기능은 **착수하지 않는다**
```

## 23-1. 🟢 시작 상태 (착수 시 다시 센다)

```
HEAD 02b670a4 · origin/main 0 0 · 작업트리 **보존 40건뿐** · staged 0 · **코드 변경 0**
회귀 845 files / 10,777 passed · tsc 0 · build 0 · Production ● Ready / HTTP 200
🔴 보존 40건(`docs/START-HERE.md` 포함) 수정·staging·커밋 **금지** · `git add -A` 금지
```

## 23-2. 🔵 현재 WU — `MI-DOMESTIC-PRICE-CANDIDATE-CONSISTENCY-1` (P0)

**목표** 국내 참고가격·동일상품 확인 수·소싱 후보 수가 **실제 데이터와 정확히 연결**되고
셀러에게 **모순으로 읽히지 않게** 한다. 🔴 **숫자 셋을 같게 만드는 WU 가 아니다.**

**과녁(Production 실측)** 국내 참고가격 **확인 1곳** ↔ 국내 동일상품 확인 **0곳** ↔ 국내 소싱 후보 **2곳**

### 🟢 이미 확정된 것 — **재조사 금지**
```
B. 「동일상품 확인 N곳」  owner  buildPriceGuide → sameCount = mine.length
                                (mi-same-candidates.ts:915·978)
   분모  j.sellers 중 market==="KR"
         🔴 j.sellers = **SAME 후보 전수(URL 중복 접음)** ·
            SIMILAR·PRESUMED_SAME·CONFLICT 는 **들어오지 않는다**(:1951·:1959 주석)
   ⟹ 🟢 **B 는 정확하다.** 국내 SAME 0 이면 0 이 맞다(헌장의 「국내 tier SAME = 0」과 일치)
B-파생 「가격 확인 N곳」  pricedCount = mine.filter(price != null && sale !== "SOLD_OUT")
   ⟹ 🟢 **같은 분모에서 더 좁힌 값** 이다
```

### 🔴 남은 것 — 여기서 시작한다
```
① A owner 확정  「국내 참고가격 확인 N곳」 생산 지점(domesticReference 경로)
② C owner 확정  국내 소싱 후보 카드 목록의 카운트 생산 지점
③ Bobo Choses 후보 전수를 **URL 키** 로 세 분모에 매핑(§6 — 어느 후보가 어디서 빠지는가)
④ 판정  집계 오류면 **owner 수정** / 정상이면 **UI 문구로 의미 구분**
⑤ 계약 + 변이(분모 변경·owner 오연결 검출) → 회귀·tsc·build
⑥ 명시 staging → commit → push → 배포 → Production 숫자 확인
```

### 🟡 현 시점 가설 (🔴 **단정하지 않았다** — ①②로 검증할 것)
```
A(1) = 참고가격 축(tier EXACT|COMPARISON — **PRESUMED_SAME 포함**)일 가능성
C(2) = 표시 후보 전수(판정·가격 무관)일 가능성
⟹ 🟡 셋이 **서로 다른 분모의 정상값** 일 수 있다
   (선례: USD 40.6 ↔ 41 은 «후보가 둘» 이라 정상이었다 · §22)
⟹ 그러면 고칠 것은 집계가 아니라 **「무엇을 세는지」를 말하지 않는 UI** 다
```

### 🔴 구현 원칙 (CPO §5 — 반드시)
```
① 숫자를 맞추려고 **분모·집계 조건을 바꾸지 않는다**
② 의미가 다르면 **다른 숫자로 유지** 한다
③ 가격 없는 후보를 **가격 확인 후보로 세지 않는다**
④ 동일상품 미확인 후보를 **동일상품 확인으로 세지 않는다**
⑤ 동일 URL 중복은 **중복 제거** · 후보 수 ↔ 가격 확인 수는 **다른 개념**
🔴 보호 — SAME/PRESUMED/POSSIBLE 정책 · EXACT 기준 · CASE A/B/C/D ·
   추천가격 · 판매 판정 · 기존 후보 데이터 **변경·삭제 0** · 차액 기능 추가 **금지**
```

## 23-3. 🔴 직전에 끝난 것 — **재구현 금지**
```
41d44100  가격비교 8항목(신규 4·5·6)        f06be8d6  재고 3상태 표시 경로
100d6dfd  후보 카드 원화 렌더               0a774118  6배열 환산 배선(화면 도달)
158fd9a2  국내↔해외 비교 렌더               **02b670a4  그중 «차액» 제거(전략 정정)**
🟢 CEO Production 확인 PASS — GBP 37→약 ₩66,854 · USD 41→약 ₩55,218 · 차액 없음
```

## 23-4. 🔴 이 트랙에서 반복된 함정 (다시 밟지 않는다)
```
⒜ 같은 UI 를 그리는 **표면이 여럿** 이다 — 한 장만 고치면 화면이 안 바뀐다
   (MiPanelView 는 **운영에서 마운트되지 않는다**)
⒝ 소스 스캔 계약은 **주석을 벗기지 않는다** — 주석에 함수 이름을 «적지도» 않는다
⒞ 파생 칸을 추가한 WU 는 **그 칸의 소비처를 같은 WU 안에서** 만든다
⒟ 기대값은 **운영 경로의 입력까지 확인한 뒤** 적는다
⒠ 변이가 **적용됐는지** 확인한다 — 「적용 실패」를 「통과」로 읽지 않는다
⒡ `grep -c` 가 0 을 세면 **exit 1** 이라 `&&` 체인이 끊긴다(커밋이 조용히 안 됐다)
```

---

# 24. 🔵🔵🔵 **MI-DOMESTIC-PRICE-CANDIDATE-CONSISTENCY-1 — 판정 완료** (2026-11-11)

🔴🔴 **새 페이지는 §23-0(전략) + 이 절만 읽는다.** §1~§22 는 끝난 WU 기록이다.

## 24-0. 🟢 결론 한 줄

> **세 숫자(A 참고가격 확인 · B 동일상품 확인 · C 소싱 후보)는 «각자 정확하다» —
> 집계 오류가 아니었다. 틀린 것은 「그 금액을 썼는가」를 말하는 «후보 카드 한 줄» 이었다.**

## 24-1. 🟢 owner 와 분모 — **확정됐다(재조사 금지)**

```
A 「국내 참고가격 … 확인 N곳」
   owner  buildOverseasReference(summary, {sellerCountLabel: DOMESTIC_SELLER_COUNT_LABEL})
          → scope = `확인 ${v.count}곳`           (overseas-reference.ts:345 · 라벨 :155)
   분모   summarizeCandidateOverseasPrices(국내 레코드).byCurrency.KRW.count
          🔴 **판매처(domain) 단위** 다 — `sellerKey: e.domain`(market-intelligence.ts:674)로
             같은 판매처의 여러 레코드를 **최저 확인가 하나로 접은 뒤** 센다
B 「동일상품 확인 N곳」  buildPriceGuide(j,market).sameCount = SAME 후보(URL 중복 접음)
C 「국내 소싱 후보 N곳」  selectCandidateList(rows,market).length
   owner  MarketPriceComparison.tsx:2434 — 🔴 `list.length` **파생**(상수 아님)
   분모   LIKELY + PRESUMED + POSSIBLE · `discoveredUrl` 중복 제거 · CONFLICT/등급없음 제외
🟢 세 분모가 겹치는 관계는 **이미 계약으로 잠겨 있다** —
   `sourcing-candidate-count-denominators-1`(D-1~D-5 · 「합계 3」은 성립하지 않는다)
🔴 그래서 이 WU 는 그 숫자를 **다시 세지 않았다**(분모·집계 조건 변경 **0**)
```

## 24-2. 🔴🔴 찾은 결함 — **카드가 집계와 다른 게이트를 봤다**

```
집계기 summarizeCandidateOverseasPrices 의 게이트는 **넷** 이다:
  ① priceTier === "EXCLUDED"            ② verdict 가 자격 집합 밖(해외 축)
  ③ 관측된 차이(blockers)                ④ 금액 없음 / priceStatus 미확인
🔴 ⑧(`candidatePriceUse`)은 **③④ 만** 봤다 ⟹ ①②로 버려진 후보가 카드에서
   **「참고가격에 반영」** 이라고 적혀 있었다(= 화면이 거짓말한다).
🔴 가상의 모양이 아니다 — 「🟡 품번 충돌 · 참고」 군(`CANDIDATE-POSSIBLE-CONFLICT-01` ·
   실제 후보 `b226ab046` · 그 주석이 「실측으로 CEO SAME 2건(가격 보유)」라 적어 뒀다)이
   **가격을 들고** 그 자리에 선다. 그 군의 tier 는 `priceTierFromLink` 가 `EXCLUDED` 로 낸다.
```

🔴🔴 **1차 설계가 전수 계약(A-3)에서 «반증» 됐고 그것이 설계를 바꿨다 — 이 기록을 남긴다**:
```
1차: tier 게이트 하나만 더하고 「verdict 만으로 빠지는 행은 카드로 서지 않는다」를
     안전조건으로 단언 → 🔴 **FAIL.** `matchTruth EXACT_IDENTIFIER`(tier EXACT) +
     `verdict CONFLICT` 가 **카드로 선다**(display tier 는 matchTruth 가 정하고 verdict 를 안 본다)
2차: 카드도 verdict 게이트를 본다 — 🔴 **단 「해외 축에만»**
🔴 왜 시장으로 갈랐는가: 국내 생산자 `domesticTransientRecords.push` 는 **verdict 를 싣지
   않는다**(계약 `sprint3-p1 D-2` 가 그 비대칭을 «의도» 로 잠갔다) ⟹ 국내 집계는 그 게이트를
   보지 않는다. 국내에도 적용하면 **반대 방향으로 거짓** 이 된다 —
   집계에 «들어간» 금액을 카드가 「제외」라 적는다(= CEO 화면의 「확인 1곳」을 카드가 부정).
```

## 24-3. 🟢 구현 — 운영 **2 파일 + 신규 lib 1**

```
🟢 apps/admin/src/lib/price-eligible-verdicts.ts          **신규** — 자격 집합 owner 하나
   (`PRICE_DISQUALIFYING_BLOCKERS` 와 **같은 이유·같은 모양**: 집계기 파일은
    `@commerce/crawler` 루트 배럴을 import 해서 **화면이 읽을 수 없다** · 번들 오염)
🟢 candidate-market.ts        `const` → **import**(값·게이트 줄 **한 글자도** 안 바뀜)
🟢 mi-same-candidates.ts      `candidatePriceUse` 가 ①②를 본다(②는 `market !== "KR"` 에서만)
🔴 **고치지 않은 것** — 집계기 로직 · 분모 · 자격 조건 · tier · verdict · matchTruth ·
   판정 · CASE A/B/C/D · 추천가격 · SAME/PRESUMED/POSSIBLE 정책 · 후보 데이터 ·
   차액(추가 금지 유지) · UI 마크업/문구 · DB · schema **전부 0**
🔴 **새 상태·새 문구 0** — 집계기 ①도 ③도 「상품 차이가 관측됐다」는 같은 사실이라
   기존 라벨(「참고가격 제외 — 상품 차이가 확인됨」)을 그대로 쓴다
🔴 후보를 **숨기지 않는다** — 카드는 그대로 서고 바뀌는 것은 그 한 줄이다
```

## 24-4. 🟢 검증

```
신규 계약  mdpc-1-price-use-parity (12건) — A 평형 · B 보존
  A-2/A-3  🇰🇷/🌎 **전수 평형**(matchTruth 6 × verdict 6 × priceStatus 3 × blockers 3)
           「카드가 「반영」」 ⟺ 「집계가 그 금액을 쓴다」 · 🔴 분모 0 을 PASS 로 쓰지 않도록
           「카드가 서는 조합 수」와 「verdict 축이 측정된 수」를 **같이 단언** 한다
  A-3b     **비대칭이 의도임을 잠근다** — 같은 행이 🇰🇷「반영」 ↔ 🌎「제외」
  A-4      순서 계약 — 가격이 없으면 tier 가 EXCLUDED 여도 **줄을 만들지 않는다**
음성대조   M1 tier 제거 **3F** · M2 verdict 제거 **3F** · M3 비대칭 파괴 **2F** ·
           M4 순서 복제 **1F** · M5 tier 모를 때도 막음 **6F** · M6 집합 사본 **1F**
           🟢 전부 적용 확인 · 원상복구 **바이트 동일**
기존 계약  2건 갱신·**강화**(약화 0) — `core-2y Q2` · `sprint3-p1 D-3`
           (집합 «자리» 가 바뀌어 FAIL 했다 ⟹ ⒜값 ⒝owner 하나 ⒞집계기가 그것을 읽음
            ⒟게이트 줄 생존을 **전부** 단언하도록 고쳤다)
```

## 24-5. 🔴 측정불가 / 넘겨 읽지 않을 것

```
🔴 **라이브 E2E 를 돌리지 못했다** — 원상품 크롤이 `bobochoses.com` **429** 다
   (메모 `origin-brand-recovery-fails-intermittently` 의 그 간헐 실패 · WU-150 하니스도 같은 지점에서 FAIL)
   ⟹ 「실제 상품에서 카드 문구가 이렇게 바뀐다」는 **측정하지 않았다**(0 이 아니라 미측정)
🔴 CEO 화면의 그 두 후보(donokids · miniboutique)는 **tier COMPARISON** 이라
   이 수정의 영향이 **0** 이다 ⟹ 🟢 「확인 1곳 / 88,000」은 **그대로** 다(계약 B-4 가 잠금)
🔴 영향이 실제로 나타나는 자리는 **「품번 충돌 · 참고」 군에 가격이 있을 때** 다 —
   그 군의 실데이터는 **해외(bobochoses.com `b226ab046`)** 에서 관측돼 있다
🔴 실제 따져 화면은 CTO 가 볼 수 없다 ⟹ **Production UI PASS 로 적지 않는다**
```

## 24-6. 🔵 다음 한 수

```
🟡 CEO 화면 확인 1회 — 🔴 질문은 **하나** 다:
   「후보 카드의 「참고가격에 반영 / 참고가격 제외」가 위의 「확인 N곳」과 **어긋나 보이는가**」
   🟢 정상: 「후보 2곳」인데 「확인 1곳」 — 나머지 하나의 카드가 **그 이유를 적고 있다**
   🔴 FAIL: 반영이라 적힌 카드 수 > 확인 N곳
🔵 그 뒤 ② 해외 정합성 — 🔴 착수 전에 읽을 것 하나:
   「해외 「판매처 N곳」은 `sellerKey` 가 없어 **레코드 수** 다(국내처럼 판매처 단위로 접지
    않는다 · `candidate-market.ts:367` 이 그 사실을 적어 뒀다) ⟹ 같은 판매처가 여러 후보로
    오면 **부풀 수 있다**.」 🔴 그 축은 §9(해외 축 불변)이 보호하므로 **CPO 판정 사안** 이다
🔴 START-HERE.md 는 **건드리지 않았다** — 보존 40건에 들어 있다(§23-1 금지)
```

---

# 25. 🔵🔵🔵 **MI-OVERSEAS-PRICE-CANDIDATE-CONSISTENCY-1 — 판정 완료** (2026-11-11)

🔴🔴 **새 페이지는 §23-0(전략) + §24 + 이 절만 읽는다.**

## 25-0. 🟢 결론 두 줄

```
🟢 ① 「해외 판매처 N곳」 부풀림은 **구조적으로 가능하지만 현재 운영 데이터에서 0** 이다
      ⟹ `sellerKey` 를 **추가하지 않았다**(원칙 ① 분모 변경 금지 · §24-6 의 내 경고를 실측으로 정정)
🔴 ② 실재한 거짓은 **다른 것** 이었다 — 화면의 가격 owner 가 «분기» 하는데
      후보 카드가 그 분기를 모르고 「참고가격에 반영」이라 적었다 ⟹ **고쳤다**
```

## 25-1. 🟢 owner·분모 — 확정됐다(재조사 금지)

```
해외 「판매처 N곳」      summarizeCandidateOverseasPrices(해외 레코드).byCurrency[cur].count
                        🔴 `sellerKey` 가 **없다** ⟹ **레코드(=URL) 수** 다(국내는 domain 단위)
해외 「동일상품 확인 N곳」 buildPriceGuide(j,"OVERSEAS").sameCount
해외 「가격 확인 N곳」     같은 가이드의 pricedCount
해외 「소싱 후보 N곳」     selectCandidateList(rows,"OVERSEAS").length
통화별 최저/범위         byCurrency.lowestAmount / highestAmount (🔴 환산 0 · 통화 혼합 0)
원화 환산 가능 후보       candidateKrwByUrl → 행의 `priceKrwDerived`(convertToKrwStrict · 모르면 null)
🔴🔴 **단위가 둘이다** — 국내 집계만 **판매처**, 나머지 전부 **후보 URL** 인데 화면은 전부 「곳」이다
   (`buildMarketJudgement` 가 `discoveredUrl` 로 접고 타입 이름이 `MarketSeller` 라 혼동이 쉽다)
```

## 25-2. 🟢 운영 DB 실측(읽기 전용 · 2026-11-11) — 숫자를 먼저 적는다

```
②③ 한 스냅샷에 같은 domain · 다른 URL      짝 **4**(스냅샷 2 · 도메인 2)
   🔴 그런데 그 4 는 전부 **origin_code 축**(snapshot_id null) 또는 candidate_domain null
      ⟹ **해외 가격 집계 입력에는 0건**
④ 해외 자격 행에서 같은 domain 복수 URL     **0건**
⑥ 같은 판매처·같은 통화인데 금액 상이       **0건**
⑤ 스냅샷별 해외 자격 행                    rows == urls == domains (7/7/7 · 6/6/6 …)
   ⟹ 🟢 **오늘은 「판매처 N곳」 == 실제 판매처 수** 다
⑧ 해외 자격 행 tier×status 분포
   COMPARISON+UNVERIFIED 70 · COMPARISON+null 62 · EXACT+null 38 ·
   **COMPARISON+VERIFIED 33** · **EXACT+VERIFIED 31** · COMPARISON+PRICE_UNAVAILABLE 3 ·
   EXACT+UNVERIFIED 3 · EXCLUDED+null 3
⑪ 금액 자격 전수 통과 행                   EXACT **31행/20스냅샷** · COMPARISON **10행/10스냅샷**
⑩ 🔴🔴 카드는 「반영」인데 화면 숫자에 없는 후보  **1 스냅샷**
   `25a3bba7…`(B226AC033 Bobo Choses Pop sweatshirt) · screen_lo **62** ↔ aggregate_lo **58**
⑫ 같은 통화 «안» 에서 최저가가 갈리는 사례   **0건**
   ⟹ 🔴 틀어지는 것은 **통화 축의 유무와 건수** 이고 최저가 «숫자» 자체는 아니다(오늘)
```

🔴🔴 **그 1건의 내용(DB 원문 그대로)**:
```
bonbonverona.it   EUR 62 · EXACT      · SAME          · VERIFIED · blockers []
junioredition.com GBP 58 · COMPARISON · PRESUMED_SAME · VERIFIED · blockers ["MATERIAL"]
⟹ sameCount 1 > 0 이라 화면은 **SAME 전용 가이드** 로 분기 ⟹ **GBP 축이 화면에서 사라진다**
⟹ 그런데 그 카드는 「참고가격에 반영」 이라 적었다(서버 집계는 GBP 58 을 담으므로 «직전 WU 기준» 으로는 맞다)
```

## 25-3. 🔴 원인 — 화면의 가격 owner 가 분기한다

```
MarketBlock  sameCount === 0 → <OverseasReferencePrice>  = 서버 집계(SAME **+ 추정**)
             sameCount  > 0 → price-guide-*              = buildPriceGuide(**SAME 전용**)
🔴 두 분기의 **제목이 같다**(PRICE_GUIDE_TITLE ⊃ OVERSEAS_REFERENCE_TITLE)
⟹ SAME 이 하나 생기는 순간 추정 후보의 가격이 **조용히** 화면에서 빠진다
⟹ 직전 WU 가 카드를 «서버 집계» 와 맞춴 것으로는 **부족했다**(그 기준에서는 「반영」이 참이다)
```

## 25-4. 🟢 구현 — 운영 **2 파일** · 상태 **하나 추가**

```
🟢 mi-same-candidates.ts  `candidatePriceUse(row, { sameOnlyPriceAxis })` + 상태 `SAME_AXIS_ONLY`
   라벨 **「위 가격에는 미반영 — 동일상품 확정 후보만 집계」**
   🔴 「제외」라 적지 않았다 — 「제외」는 **상품 차이가 관측된** 것이고 이것은 **집계 범위** 다
   🔴 판정 어휘(추정·보류·유사)·내부 토큰 **0** — 등급은 그룹 배지가 이미 말한다
   🔴 **게이트 순서의 맨 끝** 이다 — 위로 올리면 「가격 미확인」·「상품 차이」 사유를 덮는다
🟢 MarketPriceComparison.tsx  `sameOnlyPriceAxis={buildPriceGuide(judgement, "<MK>").sameCount > 0}`
   🔴 **`MarketBlock` 의 분기와 같은 함수·같은 식** 이다(사본 0 · 새 계산 0) · 🇰🇷/🌎 **둘 다**
🔴 **변경 0** — 집계기 · `buildPriceGuide` · `buildMarketJudgement` · 분모 · 자격 조건 ·
   tier · verdict · 판정 · CASE · 추천가격 · 환산 · 차액 · DB · schema · 후보 데이터
🔴 **sellerKey 를 해외에 넣지 않았다**(④⑥ 이 0 이므로 숫자가 안 바뀐다 · CPO 가 지시하지 않았다)
```

## 25-5. 🟢 검증

```
신규 계약  mopc-1-overseas-price-axis-parity (10건)
  A-1 실측 두 행 — 「반영」 → `SAME_AXIS_ONLY`(화면/집계/카드 셋을 같이 단언)
  A-2 전수 평형 — 「반영」이라 적힌 후보의 **통화가 화면 숫자에 있다**(🇰🇷·🌎 · tier×truth×verdict)
      🔴 분모 0 을 PASS 로 쓰지 않도록 「카드 선 수」·「반영 난 수」를 같이 단언
  A-3 SAME 이 없으면 추정 후보는 **여전히 「반영」**(반대 방향 거짓 방지)
  A-4 국내도 같은 분기 · A-5 opts 미전달 시 동작 불변 · A-6 순서(사유 우선)
음성대조   N1 게이트 제거 **3F** · N2 항상 적용 **8F** · N3 순서 파괴 **2F** ·
           N4 🌎 배선 끊기 **1F** · N5 카드가 값 무시 **1F** · N6 「제외」 어휘 **1F**
           🟢 전부 적용 확인 · 원상복구 **바이트 동일**
🔴🔴 **N5 가 1차에 통과했고 그래서 앵커를 강화했다** — `candidatePriceUse(row, {...})` 가
   그 파일에 **네 번** 등장해 한 곳을 끊어도 `toContain` 이 통과했다 ⟹
   **「옵션 없이 부르는 호출이 0」** 을 세도록 바꿨다(등장 하나만 보는 앵커는 뚫린다)
기존 계약  2건 갱신·**강화** — `mdpc-1 B-3`(상태 셋 글자 불변으로 좁히고 집합 owner 는 새 계약) ·
           `sourcing-candidate-unified-ux-1 U-2`(호출 + **분기 값 출처** 를 같이 단언)
회귀 **847 files / 10,799 passed · 0 failed** · tsc **0** · build **exit 0**
```

## 25-6. 🔴 측정불가 / 넘겨 읽지 않을 것

```
🔴 라이브 크롤 E2E 는 하지 않았다 — `bobochoses.com` **429**(§24-5 와 같은 이유)
   🟢 대신 **운영 DB 실측** 으로 분모·거짓 1건을 특정했다(추측 0)
🔴 영향 범위는 **금액 자격을 통과한 COMPARISON 10행/10스냅샷** 이고, 그중 **SAME 과 공존하는
   것은 1스냅샷** 이다 — 「운영 전체가 틀렸다」로 읽지 않는다
🔴 「판매처 N곳」의 **단위** 는 여전히 해외=URL · 국내=domain 이다(오늘 숫자는 같다) ⟹
   그 비대칭을 없애는 것은 **CPO 판정 사안** 이고 이번에 건드리지 않았다
🔴 실제 따져 화면은 CTO 가 볼 수 없다 ⟹ **Production UI PASS 로 적지 않는다**
```

## 25-7. 🔵 다음 한 수

```
🔵 ③ MI 판매가격·추천 여부 검증(전략 우선순위 ③)으로 넘어갈 수 있다.
🟡 이번 수정의 실화면 확인은 **「SAME 과 추정이 같이 있는 상품」** 에서만 보인다 —
   운영 스냅샷 `25a3bba7…`(B226AC033)이 그 유일한 좌표다(CEO 확인이 필요하면 그 상품으로)
🔴 열어 둔 CPO 판정 1건 — 해외 「판매처」의 **단위**(URL ↔ domain). 오늘 숫자 차이는 **0** 이고
   `sellerKey` 를 넣으면 **미래의 중복만** 접는다(지금은 효과 0)
🔴 START-HERE.md · CTO-HANDOVER-NEXT.md 는 **건드리지 않았다**(보존 40건)
```
