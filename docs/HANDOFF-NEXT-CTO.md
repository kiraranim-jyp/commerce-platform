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

---

# 26. 🔵🔵🔵 **MI-SELLER-PRICE-RECOMMENDATION-VALIDATION-1 — 판정 완료** (2026-11-11)

🔴🔴 **새 페이지는 §23-0(전략) + §24 + §25 + 이 절만 읽는다.**

## 26-0. 🟢 결론

```
🟢 추천가격 사슬(원가 → CASE → 추천가)은 **실제 상품 16개에서 정책대로 돈다** — 오류 0
🔴 거짓 하나를 찾아 고쳤다 — **CASE C 의 «근거 문장» 이 숫자와 모순됐다**
   「국내 최저가 ₩202,000가 착지원가 ₩189,900보다 **낮아** …」 ⟹ 🔴 **202,000 > 189,900**
🟢 WU-021 이 「환율이 없어 marketCase 를 측정하지 못했다」고 남긴 **구멍을 닫았다**
```

## 26-1. 🟢 owner 와 계산 구조 (재조사 금지)

```
A 추천가격   computePriceRecommendation (packages/pricing/src/price-recommendation.ts:120)
  입력      totalCostKrw = cost.landedCostKrw          ← computePriceBreakdown(…, rates)
            domesticLowestPriceKrw / domesticBasis     ← summarizeDomesticMarketSplit(:690)
            minimumMarginPercent **10 하드코딩** · targetMarginPercent/expectedFeePercent
            ← breakdownInput = product.priceBreakdown ?? **폼 기본값**(fee 10 · margin 12 · ship 12,000)
            brandMedianPriceKrw ← usableBrandMarketProfile
  🔴 목표가 = 원가 ÷ (1 − 마진)  (**곱셈이 아니다** — 1차에 내 기대값이 틀렸다)
  CASE  D basis≠EXACT 또는 최저가 없음 → 추천가 **null**(brandMedian 은 참고치만)
        C netProfitAt(시장가) ≤ 0 → 추천가 **null**  🔴 경계는 **수수료 뺀 뒤**(MI-P0-COST-02)
        A 시장가 ≥ 목표가 → max(목표가, round(시장가×0.99))
        B 그 외 → **시장가 그대로**(시장가보다 비싸게 추천하지 않는다 · P-26)
  🔴 사슬 전체가 `canComputeCost && shippingKrw != null` **가드 안** 이다 ⟹ 환율/원가가
     없으면 `recommendation = null` 이고 MI 는 `recommendedPriceKrw: … ?? null` 을 내보낸다
     (🔴 원가 역산값 `cost.suggestedPriceKrw` 로 **메우지 않는다** — P-24 결함 방지)
B 판매 추천  computeSellability(:663) → deriveRepresentativeSellerVerdict(:675)
            → toSellerFacingVerdict(:698) → `{code, icon, title, reasons}`
  🔴 NOT_RECOMMENDED 는 **`HOLD` 하나에서만** 온다(`SELLER_FACING_MAP`)
  🔴 CASE B(목표마진 미달)는 **HOLD → 🔴 판매 비추천** 이다(`MI-SELLER-POLICY-A` · CEO 승인)
```

## 26-2. 🟢 실제 상품 16개 — 입력과 출력 (운영 DB 실데이터 · 읽기 전용)

```
상품                        원가입력   착지원가  국내basis   국내최저   CASE  추천가    마진%  최종판정
Bobo AAA1804424            150 EUR    238,119  NONE           -      D    없음      -     🟡 조건부
Bonjour                     73 GBP    143,900  NONE           -      D    없음      -     🟡 조건부
BOBO CHOSES              16,500 JPY   152,693  NONE           -      D    없음      -     🟡 조건부
Wynken WK21W97              91 GBP    176,424  NONE           -      D    없음      -     🟡 조건부
Bobo AAA1804916             50 EUR     87,373  NONE           -      D    없음      -     🟡 조건부
True Artist                126 GBP    239,664  NONE           -      D    없음      -     🟡 조건부
Pèpè 01195-VERNICE-NERO    119 GBP    227,016  EXACT      258,000    B    258,000   12    🔴 비추천
Pèpè (200 GBP)             200 GBP    373,371  EXACT      258,000    C    없음      -     🔴 비추천
Main Story AW26MS185        57 GBP    114,991  COMPARISON 117,000    D    없음      -     🟡 조건부
(브랜드 공백)                40 EUR     72,298  NONE           -      D    없음      -     🟡 조건부
Main Story                  57 GBP    114,991  NONE           -      D    없음      -     🟡 조건부
Wynken                      91 GBP    176,424  NONE           -      D    없음      -     🟡 조건부
Bobo (KRW 원상품)        177,900 KRW   189,900  EXACT      202,000    C    없음      -     🔴 비추천
Bobo B226AC010              37 GBP     78,854  EXACT       88,000    B     88,000  10.4   🔴 비추천
Bobo B126AI018            21.6 GBP     51,028  EXACT       78,400    A     77,616  34.3   🟢 추천
Bobo B226AC009              37 GBP     78,854  EXACT       88,000    B     88,000  10.4   🔴 비추천
요약 — 상품 **16** · 추천가 산출 **4** · CASE D **10**(국내 EXACT 근거 없음)
```

🟢 **정합성 — 전건 통과**: ① basis≠EXACT ⇒ CASE D ∧ 추천가 null ② 추천가 존재 ⇒ CASE A|B
③ 추천가 > 착지원가(**손실 추천 0**) ④ 표기 마진 == `marginPercentAt(추천가, 원가)`
⑤ CASE A ⇒ 추천가 ≥ 목표가 · CASE B ⇒ 추천가 == 시장가 ⑥ CASE D ⇒ **🟢 추천이 아니다**
⑦ 🟢 추천 ⇒ 추천가가 있다 ⑧ 추천이 아니면 **근거가 비어 있지 않다**

🔴 **「CASE B + 추천가 + 🔴 비추천」은 모순이 아니다** — 목표마진 미달이면 HOLD 라는
**CEO 승인 정책**(`MI-SELLER-POLICY-A`)이고 근거가 「예상 마진 10.4%」로 그 이유를 말한다.
🟢 이 WU 는 그 정책을 **바꾸지 않았고** 계약으로 **잠갔다**(누가 완화하면 FAIL 한다).

## 26-3. 🔴 고친 것 — CASE C 근거 문장 (운영 1 파일 · 판정 0)

```
🔴 전  `국내 최저가 ₩202,000가 착지원가 ₩189,900보다 **낮아** 시장가로 팔면 손해입니다`
🟢 후  `국내 최저가 ₩202,000에서 착지원가 ₩189,900와 **예상 수수료를 빼면 남지 않습니다**`
🔴 원인 — `MI-P0-COST-02` 가 CASE C 경계를 **Net(수수료 뺀 값)** 으로 옮겼는데 **사유 문장이
   따라오지 않았다** ⟹ 최저가가 원가보다 **높아도** CASE C 가 되고 그때 문장이 거짓이 된다
🟢 **두 모양을 가른다** — 진짜로 더 낮으면 **기존 문장 그대로**(Pèpè 258,000 < 373,371 실측)
🔴 수수료 **금액을 적지 않는다** — CASE C 는 `netProfitKrw` 가 null 이다(없는 숫자를 만들지 않는다)
🔴 **변경 0** — CASE 판정 · 추천가 공식 · verdict 매핑 · 마진/수수료 기본값 · 국내 basis ·
   집계 · 차액(추가 금지) · UI
```

## 26-4. 🟢 검증

```
신규 계약  mspr-1-recommendation-trace (11건)
  실측 1건  실제 상품 16개(LIVE · `MSPR1_OUT_DIR` 덤프) — 위 표 + 불변식 ①~⑧
  S1~S10    CPO §4 시나리오 — EXACT/유사만/근거없음/손실/목표미달/전수 경계/가드/CASE 집합/
            🔴 **S10 = 이 WU 가 고친 거짓**(양방향: 거짓 문구 복귀 금지 + 참이던 문구 보존)
음성대조   P1 사유 분기 제거 **1F** · P2 비교 뒤집기 **1F** · P3 CASE D 가드 제거 **3F** ·
           P4 CASE C 경계 되돌림 **2F** · P5 CASE C 추천가 생성 **4F** · P6 목표가 무시 **3F**
           🟢 전부 적용 확인 · 원상복구 **바이트 동일**
회귀 **848 files / 10,809 passed · 0 failed** · tsc **0** · build **exit 0**
```

🔴 **내가 이 구간에서 틀린 것 넷 — 다시 밟지 않는다**:
```
⒜ 표본을 `order by links desc` 로 뽑아 **같은 상품 12개** 가 나왔다(상품 5개 요건 미충족)
   → `(brand, sku)` 단위 `row_number() = 1` 로 고쳤다
⒝ 목표가를 **원가×(1+마진)** 으로 가정했다 — 실제는 **원가÷(1−마진)** 이라 CASE B 창이
   111,112~113,635 다(내 기대값이 틀렸고 코드가 맞았다)
⒞ 소스 검사에서 **주석을 벗기지 않아** P-24 주석의 설명 문장에 걸렸다(아홉 번째)
⒟ 🔴 `JSON.stringify(facing).includes("RECOMMENDED")` 로 추천을 판정했다 ⟹
   **`NOT_RECOMMENDED` 안의 `RECOMMENDED`** 가 걸려 「판매 비추천」을 「추천」으로 읽었다
   → enum 은 **부분문자열로 비교하지 않는다**(칸을 타입에서 읽어 동등 비교)
⒠ 정규식을 파이썬 heredoc 으로 편집해 `\r\n` 이 **실제 줄바꿈** 으로 박혔다(세 번째)
   → `split/join` 으로 바꿨다
```

## 26-5. 🔴 측정불가 / 잔여 위험

```
🔴 운영의 최종 verdict·CASE 는 **DB 에 저장되지 않는다** ⟹ 「운영이 낸 그 값을 재현했다」가
   아니다(WU-021 과 같은 한계). 🟢 **입력** 은 운영 실데이터다(스냅샷 16 · 관측 146 · 링크 10)
🔴 국내 basis EXACT 는 **6/16** 뿐이다 — CASE A/B/C 표본이 그만큼 좁다(A 1 · B 3 · C 2)
🔴 `brandMedianPriceKrw` 는 실측에서 **전건 null** 로 넣었다(그 profile 을 덤프하지 않았다)
   ⟹ CASE D 의 `referencePriceKrw` 경로는 **시나리오 테스트로만** 검증했다
🔴 실제 따져 화면은 CTO 가 볼 수 없다 ⟹ **Production UI PASS 로 적지 않는다**
🔴 A/B 가격 표시 동결(`§0-FREEZE`)은 **건드리지 않았다** — 재조사도 하지 않았다
```

## 26-6. 🔵 다음 한 수

```
🟡 CEO 화면 확인이 필요하면 좌표는 **CASE C 가 난 KRW 원상품**(착지원가 189,900 ·
   국내 최저 202,000) 하나다 — 그 사유 한 줄이 「수수료를 빼면 남지 않습니다」로 바뀌었다
🔵 전략 ①②③ 이 닫혔다 ⟹ 다음은 ④ **후보 템플릿 통일** 또는 ⑤ **전상품 E2E** (CPO 지정)
🔴 열어 둔 것 — CASE A/B/C 표본이 6상품뿐이다. 국내 EXACT 공급이 늘면 **그때 다시 잰다**
🔴 START-HERE.md · CTO-HANDOVER-NEXT.md 는 건드리지 않았다(보존 40건)
```

---

# 27. 🔵🔵🔵 **MI-SOURCING-CANDIDATE-TEMPLATE-UNIFICATION-1 — 판정 완료** (2026-11-11)

🔴🔴 **새 페이지는 §23-0 + §24 + §25 + §26 + 이 절만 읽는다.**

## 27-0. 🟢 결론

```
🟢 **카드는 이미 하나였다** — `MarketColumn` 하나 · `mi-candidate-row` 마크업 하나 ·
   카드 «안» 에 시장 분기 **0**(분기는 **통화** 로만 한다) ⟹ 🔴 **다시 만들지 않았다**
🔴 구멍은 **계약** 에 있었다 — 기존 `U-1` 은 「컴포넌트가 하나인가」만 보고
   「그 하나 안에서 시장으로 갈라지는가」를 **못 봤다** ⟹ 이번에 그것을 잠갔다
🟡 운영 변경은 **testid 둘** 뿐이다(`mi-candidate-title` · `mi-candidate-link`) —
   표시·순서·문구·조건·href **변경 0**
```

## 27-1. 🟢 국내·해외 구조 비교 (조사 결과 · 재조사 금지)

```
후보 데이터 타입   POST `GeminiTransientRow` · GET 복원 `SavedCandidateRow`  ← **시장 공통**
후보 생성 owner    `selectCandidateList(rows, market)` 하나                   ← 시장 공통
URL·중복 제거      `discoveredUrl` 단위                                      ← 시장 공통
그룹 분류          LIKELY / PRESUMED / POSSIBLE                               ← 시장 공통
카드 컴포넌트      `MarketColumn` + `mi-candidate-row`                        ← 시장 공통
반영 상태          `candidatePriceUse`(+ `SAME_AXIS_ONLY`)                    ← 시장 공통
Workspace 마운트   `<MarketColumn market="KR">` · `market="OVERSEAS"` 두 호출 **같은 컴포넌트**
🔴 **다른 것은 둘뿐이고 둘 다 「시장」이 아니라 「통화」 다**:
   ⒜ 원화 환산 줄   `row.priceCurrency !== "KRW"` 일 때만(KRW 후보에 중복 환산 금지)
   ⒝ 확정 버튼      가격 상태에서 파생(`confirm-price` ↔ `confirm-unavailable`)
🟢 집계 분모만 시장별로 다르다 — 국내 `sellerKey`(판매처) · 해외 레코드(§25-1) **보존**
```

## 27-2. 🟢 구현 — 운영 **1 파일 · testid 2**

```
🟢 `mi-candidate-title`  상품명 줄(`row.title`)에 testid 추가 — 전까지 계약이 **볼 수 없었다**
🟢 `mi-candidate-link`   원본 상품 링크(`href={row.discoveredUrl}`)에 testid 추가
🔴 **변경 0** — 표시·순서·문구·조건·href·target·rel · 가격 집계 · 판정 · CASE ·
   추천가격 · `candidatePriceUse` · `SAME_AXIS_ONLY` · 그룹 정책 · 정렬 · 후보 수
```

🔴🔴 **구현하지 않은 것 둘 — 데이터가 없다(지어내지 않았다)**:
```
CPO §4 ② 「브랜드」 별도 표시   `GeminiTransientRow` 에 **brand 칸이 없다**(상품명에만 섞여 있다)
CPO §4 ⑧ 「기본 상품 옵션 정보」 그 타입에 **옵션/사이즈 칸이 없다**
⟹ 🔴 둘 다 **새 데이터 수집** 이 필요하다 ⟹ **CPO 결정 사안** 으로 올린다
```

🟡 **CPO 판정 1건 — 정보 «순서»**: CPO §4 는 ①이미지 ②브랜드·상품명 ③그룹 ④판매처·링크
⑤가격 … 순서인데 현재 카드는 **이미지 → 그룹 → 가격 → 환산 → 미확인 → 반영상태 → 상품명 →
판매처 → 링크** 다. 🔴 **바꾸지 않았다** — 그 배치는 `SOURCING-CARD-MINIMAL-1` ·
`CANDIDATE-UX-REFINE-01` · FINAL UX REBUILD 가 **CEO/CPO 승인으로 만든 것** 이고,
결함이 아닌데 순서를 바꾸면 그 승인을 되돌리는 것이다(§9 「UI 개선을 이유로 축소 금지」와 같은 방향).
🟢 **국내·해외가 서로 같다는 요건은 이미 100% 충족** 이다 — 순서는 **두 시장이 같은 순서** 다.

## 27-3. 🟢 검증 — 실제 상품 5개 행(운영 DB 실측값)

```
bonbonverona.it      EUR 62      EXACT      SAME          VERIFIED
junioredition.com    GBP 58      COMPARISON PRESUMED_SAME VERIFIED
kids-world.com       KRW 106,000 COMPARISON PRESUMED_SAME VERIFIED
designerkidswear.com CAD 530     COMPARISON PRESUMED_SAME **UNVERIFIED**
coupleshot.com       KRW 135,000 COMPARISON PRESUMED_SAME VERIFIED
```
```
계약 mstu-1-candidate-template-unification (11건 · 마운트 DOM)
  A-1 카드 블록 «안» 시장 분기 **0**(`market ===` · `"KR"` · `"OVERSEAS"`) + 통화 분기 **존재**
  A-2 🔴🔴 **같은 후보를 🇰🇷/🌎 로 렌더 → testid 시퀀스 완전 동일**
  A-3 §4 요소(이미지·상품명·그룹·판매처·가격·반영상태·링크)가 **양 시장에** 선다
  A-4 환산 줄은 **통화로만** — KRW 후보 0 · 비KRW 후보 전건
  A-5 링크 `href == discoveredUrl` · `target=_blank` · `rel=noreferrer`(양 시장)
  A-6 실측 5행의 **골격이 하나** (가격·확정 파생 칸 제외)
  A-7 가격 미확인 후보는 「가격 미확인」을 적고 **반영 상태를 지어내지 않는다**
  B-1~B-4 카드 마크업 하나 유지 · 어휘 owner 불변 · 내부 토큰 노출 0 · **차액 어휘 0**
음성대조  Q1 시장 분기 삽입 **5F** · Q2 환산을 시장 기준으로 **2F** · Q3 상품명 testid 제거 **1F** ·
          Q4 링크 href 변조 **1F** · Q5 링크 제거 **2F** · Q6 내부 토큰 노출 **3F**
          🟢 전부 적용 확인 · 원상복구 **바이트 동일**
회귀 **849 files / 10,820 passed · 0 failed** · tsc **0** · build **exit 0**
```

🔴 **내가 틀린 것 하나** — A-6 의 골격 필터가 좁아 `confirm-price` ↔ `confirm-unavailable`
차이를 「시장에 따라 구조가 갈린다」로 **오진** 했다. 🟢 그 둘은 **가격 축** 이고(A-2 가 같은
행에서 동일함을 단언한다) 접두 둘을 빼도록 고쳤다.

## 27-4. 🔴 측정불가 / 잔여

```
🔴 실제 따져 화면은 CTO 가 볼 수 없다 ⟹ **Production UI PASS 로 적지 않는다**
   (화면 축은 **마운트 DOM** 이다 — jsdom 에 실제 후보 행을 넣어 렌더한 결과다)
🔴 후보 행은 **운영 DB 값** 이지만 렌더는 **하니스 조립** 이다 ⟹ 운영 Workspace 의
   실제 prop 배선은 소스 앵커(`sourcing-candidate-unified-ux-1` U-2 · `mopc-1` B-2)가 지킨다
🔴 ②브랜드·⑧옵션은 **데이터 부재** 로 미구현 — CPO 결정 대기
🟡 정보 순서(§27-2 마지막)는 **CPO 판정 1건** 으로 남긴다
```

## 27-5. 🔵 다음 한 수

```
🔵 전략 ④가 닫혔다 ⟹ 다음은 ⑤ **전상품 E2E**:
   `해외 URL → 국내 시장 가격 → 해외 소싱 후보 → 가격 정합성 → MI 판매 판단 →
    추천 판매가격 → 커머스 등록`
🔴 그 E2E 의 **알려진 병목 둘** 을 먼저 적는다(§26-5 실측):
   ⒜ 국내 basis EXACT 가 **6/16 상품** 뿐이다 ⟹ CASE A/B/C 표본이 좁다
   ⒝ 원상품 크롤이 `bobochoses.com` **429** 로 간헐 실패한다(라이브 E2E 의 첫 관문)
🔴 START-HERE.md · CTO-HANDOVER-NEXT.md 는 건드리지 않았다(보존 40건)
```

---

# 28. 🔵🔵🔵 **SMALLABLE-LOCAL-CURRENCY-FOLLOWUP — 판정 완료** (2026-11-11)

🔴🔴 **새 페이지는 §23-0 + §24~§27 + 이 절만 읽는다.**

## 28-0. 🟢 결론

```
🔴🔴 **§2 의 일곱 질문은 «이미» 답이 있다** — `a0b3c08`(CPO CLOSED 2026-11-07) ·
   전문 `docs/PHASE2-SMALLABLE-LOCAL-CURRENCY-VERDICT.md` · START-HERE §0-PHASE2
   ⟹ 🔴 **재조사하지 않았다**(재조사 금지 프로토콜). 숫자만 **재확인 1줄** 했다
🟢 그래서 이 WU 는 CPO 가 적은 **그 한 줄** 을 했다 —
   「한 사이트의 예외 처리가 목적이 아니다 — **국가별 가격·통화 정확성을 판정할 수 있는
    기준을 확보** 하는 작업이다」 ⟹ **기준을 모듈로 승격하고 운영 전수에 적용했다**
🔴 운영 코드 변경 **0** — 수집·통화 정책 · `market_country` 의미 · CASE · 추천가격 ·
   판매 판단 · 국내 매칭 **전부 불변**
```

## 28-1. 🟢 §2 일곱 항목 — 닫힌 판정 그대로(재측정 0)

```
FR  EUR                          🟢 (닫힌 판정)
JP  🔴 **EUR 이다 · JPY 가 아니다** — DB 전수 `market_code='jp'` **EUR 62행 · JPY 0행**
                                 (2026-11-11 **재확인 1줄** · 값 동일)
KR  EUR 49 / JPY 9,145 / USD 57  · 🔴 통화 미지정(`?country=KR` 류)은 **egress 가 통화를 정한다**
US  EUR 53 / JPY 9,892 / USD 62
국가·배송지에 따른 가격 변경      🔴 **하나의 환율표가 격자 전부를 설명한다**(편차 0.006%)
                                 ⟹ `?currency=` 는 **표시 계층** · 사이트 자체 환산
원본가 ↔ 세일가                   🟢 `ORIGIN_FX` **63행 실재**(닫힌 WU 의 BL-1 이 그 자리에서 닫혔다)
근거 ↔ 국가·통화 일치              🔴 `market_country` 는 「시장의 국가」가 **아니다**(판매처 자기 선언)
🔴🔴 **그러므로 JPY 를 «요청해» 받은 값은 「일본 시장가」가 아니다** — 저장하면
   `a0b3c08 §2` 가 절대 금지한 「EUR → 환율 → JPY」와 **같은 산술** 이다
```

## 28-2. 🟢 새로 만든 것 — **기준(판정기) 하나**

```
packages/crawler/src/__tests__/market-currency-evidence.ts   🔴 **운영 모듈이 아니다**(측정·계약 전용)
  classifyMarketCurrencyEvidence(관측[]) → SITE_FX | LOCAL_CURRENCY | INSUFFICIENT
  방법   **단일 환율 구간 교집합** — 통화쌍마다
         [ (x−ux/2)/(y+uy/2) , (x+ux/2)/(y−uy/2) ] 의 교집합이 비면 **현지 가격**
  🔴 **편차 임계값을 쓰지 않는다** — 그 계산이 `a0b3c08` 에서 USD 를 오판했다(계약 C-2)
  🔴 **「통화가 여러 개다 ⟹ 현지통화다」로 판정하지 않는다**(사이트가 환산해서 여러 통화를 낼 수 있다)
  🔴 **상품 1개로는 판정하지 않는다** — 비율 하나는 어떤 환율로도 설명된다(1식 1미지수)
  🔴 **「확인 불가」 ↔ 「수집 실패」 분리** — 통화 1개/표본 부족 = `INSUFFICIENT`(확인 불가) ·
     가격·통화 칸이 빈 행은 **입력이 아니다**(= 수집 실패는 이 모듈 밖)
  🔴 비교 축(`groupKey`)은 **호출부가 정한다** — 격자 축=국가 · 운영 축=상품(둘을 섞지 않는다)
```

## 28-3. 🟢 운영 전수 적용 결과 (읽기 전용 · `MARKET_PROBE` 1,073행)

```
판매처                   행    통화                     판정
bobochoses.com          526   EUR,USD                  🟢 LOCAL_CURRENCY (EUR/USD 설명 안 됨)
www.junioredition.com   278   AUD,GBP,JPY              🟢 LOCAL_CURRENCY (AUD/GBP)
www.smallable.com       248   EUR                      🔴 INSUFFICIENT — **통화가 하나뿐**
louisemisha.com          12   AUD,CAD,EUR,GBP,JPY,USD  🟢 LOCAL_CURRENCY (6쌍 설명 안 됨)
bobochoses.co.jp          5   JPY                      🔴 INSUFFICIENT — 통화 하나
main-story.com            2   GBP                      🔴 INSUFFICIENT — 통화 하나
luksusbaby.kr             1   KRW                      🔴 INSUFFICIENT — 통화 하나
www.wynken.co.uk          1   GBP                      🔴 INSUFFICIENT — 통화 하나
수집 실패(가격·통화 부재)  **0건** ⟹ 🟢 「확인 불가」와 「수집 실패」가 **실제로 갈린다**
```

🟢🟢 **이것이 닫힌 WU 의 주장을 «기준으로» 확인한 결과다** — 「다른 판매처에서는 현지통화가
이미 작동한다」가 **통화 다양성이 아니라 환율 비설명성으로** 확인됐다(3 판매처 LOCAL_CURRENCY).
🔴 그리고 Smallable 은 **「현지통화 없음」이 아니라 「확인 불가」** 다 — 통화가 하나뿐이라
그 판매처에서는 **판정 자체가 성립하지 않는다**(닫힌 STOP 과 같은 방향).

## 28-4. 🟢 검증

```
신규 계약  slcf-1-market-currency-standard (**9건**)
  A-1 통화 여러 개 ⟹ 현지통화 **아님**(사이트 환산을 잡는다) · A-2 환율 비설명 ⟹ LOCAL ·
  A-2b 🔴 **쌍 하나만 설명돼도 SITE_FX 가 아니다** · A-3 확인 불가 ↔ 수집 실패 분리(+0 금액) ·
  A-4 상품 1개 판정 불가 · A-5 임계값 금지(🔴 소스 **주석 벗기고** 검사)
  B-1 **Smallable 격자 → SITE_FX**(닫힌 판정 재현) · B-2 JP = EUR 62행 기록
  C   운영 전수 적용(위 표 · `SLCF1_OUT_DIR` 덤프)
음성대조   R1 표본 1개 판정 **1F** · R2 분모 반올림 누락 **2F** · R3 통화 1개 단정 **2F** ·
           R4 약한 쪽 단정 **1F** · R5 0 금액 입력 허용 **1F** · R6 임계값 복귀 **2F**
           🟢 전부 적용 확인 · 원상복구 **바이트 동일**
🟢 닫힌 WU 의 계약 10건(`phase2-market-currency-is-not-site-fx`) **전부 통과**(깨뜨리지 않았다)
회귀 **850 files / 10,828 passed · 0 failed** · tsc **0** · build **exit 0**
```

🔴🔴 **내가 이 구간에서 틀린 것 넷 — 전부 계약이 잡았다**:
```
⒜ **분모의 반올림을 빼먹어** 닫힌 판정(SITE_FX)을 재현하지 못했다(JPY/USD 쌍이 거짓으로 깨졌다)
   → [(x−ux/2)/(y+uy/2), (x+ux/2)/(y−uy/2)] 로 고쳤고 그 오판을 주석·계약에 남겼다
⒝ 비교 축을 `상품@국가` 로 묶어 **전 판매처 INSUFFICIENT** 가 나왔다(운영은 (상품,국가)당
   통화가 하나다) → **상품 축** 으로 고쳤다
⒞ A-5 에 「편차 0.5% 초과」를 **전제로 지어냈다** — 그 격자의 실제 편차는 0.29% 다
   → 숫자를 빼고 **금지 자체** 를 단언했다
⒟ 소스 검사에서 **주석을 벗기지 않아** 금지 문구가 주석에 걸렸다(열 번째)
🔴 그리고 변이 R4·R5 가 **1차 계약을 통과** 했다 — 쌍이 하나뿐이라 `some≡every` 였고,
   0 금액을 **분모** 에 둬서 가드가 건너뛰었다 → 둘 다 분모를 고쳐 **1F** 로 잠갔다
```

## 28-5. 🔴 측정불가 / 잔여

```
🔴 **라이브 재측정 0** — 닫힌 WU 의 격자(2026-11-07)를 **기록으로** 썼다(새 HTTP 0)
🔴 `louisemisha.com` 은 상품 **2개** 뿐이다(행 12) ⟹ LOCAL_CURRENCY 판정의 표본이 얇다
🔴 Smallable 은 **구조적으로 판정 불가** 다 — 통화를 하나만 저장한다(요청해도 표시 계층)
🔴 이 기준은 **운영 코드가 아니다** — 수집 경로가 그것을 읽지 않는다(CPO 승인 없이 넣지 않았다)
🔴 Production UI 영향 **0**(표시 변경 없음) ⟹ **Production UI PASS 로 적지 않는다**
```

## 28-6. 🔵 다음 한 수 (CEO 전략 순서)

```
🔵 ② **국내 동일상품 매칭 실제 상품 확대** ← CPO 가 지정한 다음 순서
   🔴 착수 전 읽을 것: 국내 basis EXACT 는 **6/16 상품** 뿐이다(§26-5) ·
      국내 tier SAME 은 여전히 **0** 이고 8축은 **CLOSED** 다(완화 금지)
🔵 그 뒤 ③ 해외 가격 비교 확대 → ④ WOMEN_FASHION 실제 상품 검증
🟡 이 기준을 **운영에 심을지** 는 CPO 결정이다(지금은 측정·계약 전용)
🔴 START-HERE.md · CTO-HANDOVER-NEXT.md 는 건드리지 않았다(보존 40건)
```

---

# 29. 🔵🔵🔵 **MI-PRICE-COMPARISON-AND-DECISION-CLOSEOUT — 판정 완료** (2026-11-11)

🔴🔴 **새 페이지는 §23-0 + §24~§28 + 이 절만 읽는다.**

## 29-0. 🟢 결론

```
🟢 A 가격 비교 — 실제 상품 후보로 **집계 ↔ 카드 ↔ Workspace 숫자** 가 일치한다(결함 0)
🟢 B MI 판단 — 실제 상품으로 **원가 → CASE → 추천가 → 화면 owner** 가 정책대로 연결된다(결함 0)
🔴🔴 그런데 **화면이 보여주는 「추천 판매가」는 B 가 아니라 A(원가 역산)** 이고,
   실측에서 **A 와 B 가 양방향으로 갈린다**(아래 §29-3) ⟹ 🔴 **동결 정책이라 고치지 않았다**
   (`ab-price-display-is-frozen` · CPO 2026-11-08 · 재조사 금지) · 🟡 **CPO 판정 1건**
🔴 운영 코드 변경 **0** — 집계 분모 · CASE · 8축 · GT · 임계값 · 마진·수수료 · 차액 전부 불변
```

## 29-1. 🟢 A — 가격 비교 (실제 상품 8개 · 후보 27행)

```
상품            후보  🇰🇷집계   🌎집계   반영  미확인  제외
Bobo AAA1804424   6   0곳      없음      0     6      0
Bonjour           4   0곳      없음      0     4      0
BOBO CHOSES(JP)   4   0곳      없음      0     4      0
Wynken WK21W97    3   0곳      없음      0     3      0
Bobo AAA1804916   3   0곳      없음      0     3      0
True Artist       3   0곳      없음      0     3      0
Main Story        2   0곳      없음      0     2      0
Wynken            2   0곳      없음      0     2      0
🔴🔴 **후보 27행 전건이 「가격 미확인」** 이다 — `price_status ≠ VERIFIED_CURRENT`
   ⟹ 🟢 그래서 집계가 **0곳** 이고 카드도 **반영/제외를 적지 않는다**(`NOT_PRICED`).
   🔴 이것은 **결함이 아니라 데이터 상태** 다(§25 ⑧ 분포 — COMPARISON+UNVERIFIED 70행).
```

🟢 **불변식 전건 통과** — ① 카드 수 ≤ 후보 수 ② 「반영」이 있으면 그 시장 집계에 금액이 있다
③ **반영 + 미확인 + 제외 == 카드 수**(어디로도 사라지지 않는다) ④ 미확인·제외는 금액 집계에 **없다**.
🟢 **Workspace 마운트** — 후보 수가 선택기 산출과 **같고**, `sameCount === 0` 분기에서
서버 집계 금액(`overseas-lowest`)이 **계산값 그대로** 그려진다.

## 29-2. 🟢 B — MI 판단 (실제 상품 15개 · §26 숫자 재현)

```
상품            원가입력     착지원가  basis       국내최저  CASE  B추천가   A권장가
Pèpè 01195       119 GBP     227,016  EXACT       258,000   B    258,000   324,300
Pèpè (200GBP)    200 GBP     373,371  EXACT       258,000   C    없음      478,700
Bobo (KRW)    177,900 KRW    189,900  EXACT       202,000   C    없음      243,500
Bobo B226AC010    37 GBP      78,854  EXACT        88,000   B     88,000   101,100
Bobo B126AI018  21.6 GBP      51,028  EXACT        78,400   A     77,616    72,900
Bobo B226AC009    37 GBP      78,854  EXACT        88,000   B     88,000   101,100
Main Story AW26   57 GBP     114,991  COMPARISON  117,000   D    없음      147,400
그 외 8개          —            —      NONE          -       D    없음       산출됨
🟢 §26 의 숫자와 **한 자리도 다르지 않다**(같은 owner · 같은 입력)
```

🟢 **불변식 전건 통과** — ① basis≠EXACT ⇒ CASE D ∧ **B 추천가 null** ② B 가 나면 **착지원가 초과**
③ A 는 CASE 와 무관하게 산출된다(동결 정책).

🔴 **내 하니스가 틀렸던 자리 하나** — 관측을 스프레드로 넘겨 `price_krw → priceKrw` 매핑이
빠졌고 **basis 가 전건 NONE** 으로 나왔다(Pèpè 가 §26 에서 `EXACT 258,000` 인데). 🟢 칸 이름을
맞춰 고쳤고 그러자 §26 숫자가 그대로 재현됐다 — 이 트랙이 열두 번 틀린 그 자리다.

## 29-3. 🔴🔴 **화면 금액은 A 다 — 그리고 A ↔ B 가 양방향으로 갈린다**

```
화면 owner   `market-recommended-price-amount` ← **resolveListingPrice**(= A · 원가 역산)
MI owner     `computePriceRecommendation`      ← **B**(시장가 기준 CASE A/B) · **금액 비노출**
🔴 CPO §2 의 「근거 부족 시 가격 미산출」은 **B** 를 말한다(CASE D ⇒ B null) —
   A 는 국내 근거와 무관하게 산출된다.
```
```
실측 괴리 — A 가 더 높은 상품 **3** · 더 낮은 상품 **1**
  6ab226c9  A 324,300 ↔ B 258,000   (A 가 국내 최저가보다 **높다**)
  1bc3705b  A 101,100 ↔ B  88,000   (A 가 국내 최저가보다 **높다**)
  cd93efd9  A 101,100 ↔ B  88,000   (같은 모양)
  de09c4bb  A  72,900 ↔ B  77,616   (A 가 **낮다** · 국내 최저가 78,400 보다도 낮다)
🔴 B 는 「시장가보다 비싸게 추천하지 않는다」(P-26)를 지키지만 **A 에는 그 규칙이 없다**.
🔴🔴 **고치지 않았다** — A/B 표시는 **동결**(CPO 2026-11-08)이고 재조사도 금지다.
🟢 대신 **계약으로 사실을 남겼다** — 한쪽을 다른 쪽에 맞춰 조용히 고치면 그 단언이 드러낸다.
🟡 **CPO 판정 1건** — 「셀러가 보는 권장가를 A 로 둘 것인가」(그대로면 §29-3 의 네 숫자가 운영 상태다)
```

## 29-4. 🟢 검증

```
신규 계약  mpcd-1-closeout-e2e (**5건**)
  A-1 실제 상품 8개 — 집계·카드·세 상태 합 불변식 · A-2 Workspace 마운트 숫자 일치
  B-1 실제 상품 15개 — CASE·B추천가·A권장가 + **A↔B 괴리 양방향 기록**
  C-1 화면 금액 == **A** (owner 단언 · B 금액 비노출 유지) · C-2 화면이 B 를 재계산하지 않는다
🔴 내가 틀린 둘 — ⒜ 관측 칸 매핑 누락(basis 전건 NONE) ⒝ 소스 검사 **주석 미제거**(열한 번째)
회귀 **851 files / 10,830 passed · 0 failed** · tsc **0** · build **exit 0**
```

## 29-5. 🔴 미완료 조건과 이유(임의 데이터로 PASS 처리하지 않았다)

```
🔴 「국내 참고가격 + 해외 가격이 **둘 다** 있는 상품」 — **표본 0**
   국내 축은 `domestic_product_links`+관측(6상품) · 해외 축은 `candidate_reviews`(8상품)이고
   **두 집합이 겹치는 상품이 없다** ⟹ 한 화면에서 두 금액을 같이 본 E2E 는 **미검증**
🔴 「가격 미확인이 아닌 후보」 — 덤프 27행 **전건 UNVERIFIED** ⟹ 카드 「참고가격에 반영」이
   실제 상품에서 뜨는 모양은 **미검증**(계약 `mstu-1`·`mopc-1` 이 실측값으로 잠그고 있다)
🔴 「원가가 부족한 상품」 — 표본 전건 `price_amount > 0` ⟹ `canComputeCost=false` 경로 **미검증**
🔴 Production UI — CTO 가 볼 수 없다(마운트 DOM 축) ⟹ **Production UI PASS 로 적지 않는다**
🔴 배포 — 이 커밋은 **테스트·문서만** 바꿨다(운영 코드 0) ⟹ **배포 트리거 없음** 이 정상이다
```

## 29-6. 🔵 다음 한 수

```
🟡 **CPO 판정 1건**(§29-3) — 권장가 owner 를 A 로 유지할지. 🔴 CTO 는 열지 않았다(동결)
🟡 **표본 하나만 생기면 §29-5 의 첫 줄이 닫힌다** — 「국내 링크 + 해외 후보가 같이 있는 상품」
   하나를 실제로 분석하면 된다(새 코드 0 · 기존 하니스에 상품 하나 추가)
🔴 START-HERE.md · CTO-HANDOVER-NEXT.md 는 건드리지 않았다(보존 40건)
```

---

# 30. 🔵🔵🔵 **MI-PRICE-COMPARISON-AND-DECISION-FINAL-E2E — 세 조건 확보 · 두 목표 종료** (2026-11-11)

🔴🔴 **새 페이지는 §23-0 + §24~§29 + 이 절만 읽는다.**

## 30-0. 🟢 결론

```
🟢 ① 국내 ∧ 해외 동시 E2E   — **실제 상품 1개** 로 끝까지(표본을 만들지 않았다)
🟢 ② VERIFIED_CURRENT 카드  — 「참고가격에 반영」 **3장** 이 집계 금액 안에 있다
🟢 ③ 원가 부족 경로         — 함수 계약 5건 · 🔴 **그 과정에서 실제 결함 1건을 찾아 고쳤다**
```

## 30-1. 🟢 ① 국내 ∧ 해외 가격 동시 E2E — `7b16eecc` (Bobo Choses **B226AC009**)

🔴 **표본 찾기에서 내가 축을 틀렸다** — 「`domestic_product_links` ∧ 해외 후보」로 찾으니
**운영 전체 0건** 이었다. 🔴 그런데 화면의 국내 참고가격 owner 는 그 축이 **아니다**
(`candidateDomesticPrice` = transient 후보 집계 · §24-1). 🟢 후보 축으로 다시 찾아 **8 상품**.

```
시장      판매처                 원본가      KRW 환산   tier         priceStatus        카드 상태
OVERSEAS  junioredition.com     GBP 33      59,626    COMPARISON   VERIFIED_CURRENT   참고가격 제외(상품 차이)
UNKNOWN   bobochoses.com        EUR 40      60,298    EXACT        VERIFIED_CURRENT   **참고가격에 반영**
OVERSEAS  tinyapple.net         USD 41      55,218    EXACT        VERIFIED_CURRENT   **참고가격에 반영**
OVERSEAS  peipeicollection.com  TWD 1,980   **없음**   COMPARISON   PRICE_UNAVAILABLE  (줄 없음)
OVERSEAS  kihanan.com           JPY 7,590   64,719    COMPARISON   UNVERIFIED_SEARCH  (줄 없음)
KR        donokids.com          KRW 88,000  88,000    COMPARISON   VERIFIED_CURRENT   **참고가격에 반영**
KR        vividvia.com          KRW 88,000  88,000    COMPARISON   VERIFIED_CURRENT   참고가격 제외(상품 차이)
🇰🇷 집계 **1곳 · 88,000**   🌎 집계 **EUR 40×1 · USD 41×1**
원가 37 GBP → 착지원가 **78,854** · CASE **D** · B 추천가 **없음** · A 권장가 **101,090**
```
🟢 **Workspace 출력** — 🇰🇷/🌎 **두 블록이 같은 화면에** 서고, `domestic-lowest` 가 **88,000**
그대로이며, 후보 수가 선택기 산출과 **두 시장 각각 일치**. 🟢 TWD 는 환율표에 없어 **환산 없음**
(🔴 숫자를 지어내지 않는다) · 미확인/제외/반영이 **서로 구분** 된다.
🔴 CASE D 는 **정상** 이다 — 이 상품의 `domesticBasis` 입력은 등록부 축이고 그 축이 비었다
(후보 축 참고가격은 **그 입력이 아니다** · 분모 분리 유지).

## 30-2. 🟢 ② VERIFIED_CURRENT 후보의 카드 ↔ 집계 일치

```
VERIFIED 후보 5 · 「반영」 카드 **3장**(bobochoses EUR 40 · tinyapple USD 41 · donokids KRW 88,000)
🔴 단언 — 「반영」이면 **그 통화 집계 칸이 존재** 하고 금액이 **[최저, 최고] 범위 안** 이다
🟢 화면의 `data-use="USED"` 카드 수 == 계산한 「반영」 수(🇰🇷+🌎 합산)
🔴 집계 분모·자격·상태 분류 **변경 0**
```
🔴 **내가 분모를 좁혀 1차 FAIL 했다** — 해외만 세고 DOM 은 두 시장을 세어 `1 ↔ 2` 가 됐다
(국내 donokids 도 「반영」이다). 🟢 카드 축을 **두 시장** 으로 맞췄다.

## 30-3. 🔴🔴 ③ 원가 부족 경로 — **함수 계약** · 실제 결함 1건 수정

```
③-1 금액 0            → 권장가 **null** 🟢 (기존 가드)
③-2 배송비 null       → 권장가 **null** 🟢 (기존 가드 · 「비운 값이 되살아나지 않는다」)
③-3 🔴 **환율표에 없는 통화** → **₩15,430 이 났다**(37 XYZ + 배송비 12,000)
    🔴 `convertToKrw` 가 모르는 통화의 금액을 **그대로 원화로** 돌려준다 —
       그 파일 주석이 적어 둔 「P0-B 의 CAD 84 → ₩84」 그 자리다
    🟢 **고쳤다** — `convertToKrwStrict`(「모르면 null」 owner)로 환산 가능성을 먼저 본다
③-4 원가 0 → B 추천가 **null** · CASE **D** 🟢
③-5 대조군 — 입력이 갖춰지면 **A·B 둘 다 산출된다**(가드가 과하지 않다)
```

🟢🟢 **오늘 운영 숫자는 한 원도 바뀌지 않는다**(원상품 통화 전수 실측):
```
GBP 254 · EUR 242 · USD 90 · KRW 28 · JPY 20 · CAD 2 · 빈 값 12
⟹ 환율표(12통화)에 **전건 있거나**(🟢 KRW 는 항등) **기존 가드가 이미 막는다**(빈 값 12)
⟹ 🔴 이 가드가 막는 것은 **새 통화가 들어오는 날** 의 거짓 가격이다
   (후보에서는 이미 **TWD** 가 관측됐고 그 통화는 환율표에 **없다**)
```
🔴 변경은 **운영 1 파일 · 가드 1개**(`packages/pricing/src/listing-price.ts`) — 공식·마진·수수료·
CASE·분모·A/B 정책 **전부 불변**.

## 30-4. 🟢 검증

```
신규 계약  mpcd-2-final-e2e (**7건**) — ① 실제 상품 1개 전 흐름 + Workspace · ② 카드↔집계 ·
           ③ 함수 계약 5(🔴 「운영 실측이 아니라 계약」임을 파일에 명시)
회귀       **852 files / 10,835 passed · 0 failed**(두 번째 실행)
           🔴 **1차 실행에서 2건 FAIL 했고 규명했다** — `lotteon-final-06` ·
              `step3fix-settings-reach-screen` 이고 **단독 실행 25/25 통과** ·
              2차 전체 실행 **0 failed** ⟹ **병렬 간섭(flaky)** 이고 이 변경과 무관하다
           🔴 「flaky 니까 넘어간다」로 적지 않는다 — 단독·재실행 **두 증거** 로 가렸다
tsc        🔴 **한때 2건** 이었다(내 테스트가 `domesticAveragePriceKrw` 필수 칸을 빠뜨렸다) →
           🟢 타입이 잡아 고쳤다 · 최종 **0**
build      exit 0
```

## 30-5. 🟡 Production UI / 배포

```
배포      🟢 **운영 코드가 바뀌었다**(`listing-price.ts`) ⟹ 이번에는 **배포가 생성된다**
Production UI 🔴 **미확인** — CTO 가 볼 수 없다(화면 축은 마운트 DOM)
🟢 화면 영향 — **오늘 데이터에서는 0** 이다(위 §30-3 의 통화 전수 근거)
```

## 30-6. 🟢 두 목표 종료 상태

```
A 가격 비교   🟢 수집·집계·카드·화면이 **실제 상품 1개에서 끝까지** 일치한다(§30-1·§30-2)
B MI 판단     🟢 원가·CASE·추천가·화면 owner 가 정책대로 연결된다(§29·§30-3)
🟡 남은 것은 **CEO 실화면 확인 1회** 뿐이다 — 좌표는 `7b16eecc`(B226AC009):
   「🇰🇷 88,000 1곳 · 🌎 EUR 40 / USD 41 · 후보 7 중 반영 3 · 추천 판매가 101,090」
🔴 START-HERE.md · CTO-HANDOVER-NEXT.md 는 건드리지 않았다(보존 40건)
```

---

# 31. 🔴🔴🔴 **PRODUCTION-WORKSPACE-VISIBLE-RESULT — 화면이 «다른 이름» 을 읽고 있었다** (2026-11-11)

🔴🔴 **새 페이지는 §23-0 + §24~§30 + 이 절만 읽는다.** CPO 가 §30 의 완료 판정을 **보류** 했고
그 판단이 맞았다 — 계산 PASS·마운트 DOM PASS 가 **Production 화면 PASS 가 아니다.**

## 31-0. 🔴 원인 — 한 줄로

```
GET(페이지 열기) 응답은 두 금액을 **candidateDomesticPrice / candidateOverseasPrice** 로 준다
POST(`/check`)는 같은 값을 **domesticReference / overseasReference** 로 **이름을 바꿔** 준다
🔴 패널은 `set*Reference` 를 **POST 두 곳에서만** 불렀다
   ① `autoCheckResult` effect(자동 1회차)  ② 「🔄 다시 분석」 핸들러
⟹ 🔴🔴 **재진입/페이지 열기(GET)로는 두 state 가 `null` 이라 블록이 렌더되지 않았다**
🟢 그런데 GET 응답은 그 값을 **이미 들고 있었다** — 그 라우트가 `restoreSavedCandidates: true`
   로 저장 후보를 복원해 **같은 집계기** 로 계산한다(`[snapshotId]/route.ts:32`)
🟢 후보 «행» 은 이미 `data?.savedCandidateRows` 로 폴백하고 있었다 ⟹
   **후보는 보이는데 가격 블록만 비는** 모양이었다(그것이 CEO 가 본 화면이다)
```

## 31-1. 🟢 수정 — 운영 **1 파일 · 소비 지점 2줄 + 타입 2칸 + deps 2줄**

```
domesticReference: domesticReference ?? data?.candidateDomesticPrice ?? null
overseasReference: overseasReference ?? data?.candidateOverseasPrice ?? null
🟢 **바로 위 `rows` 와 같은 규칙** 이다 — live(POST) 가 있으면 live 가 이기고 없으면 저장분(GET)
🔴 새 계산 0 · 새 집계 0 · 새 fetch 0 · 분모·자격·판정·CASE·A/B 정책 **불변**
   — **이미 서버가 낸 칸을 읽는 것** 뿐이다. 두 값을 **합치지 않는다**(POST ?? GET)
🔴 POST 배선(계약 `wu-049`·`wu-082`·`core-2t` 가 보는 줄들)은 **한 글자도** 안 바꿨다
```

## 31-2. 🟢 변경 전후 — 같은 GET 응답으로 마운트했을 때

```
                              변경 전            변경 후
국내 참고가격 블록              **없음**           🟢 선다
`domestic-lowest`              **없음**           🟢 **88,000**
해외 참고가격 블록              **없음**           🟢 선다
`overseas-lowest`              **없음**           🟢 **EUR 40** · **USD 41**(통화별 두 줄)
후보 카드                       🟢 1장(변화 없음)   🟢 1장
🔴 음성대조가 그 전후를 증명한다 — S1 국내 폴백 제거 **2 FAIL** · S2 해외 폴백 제거 **2 FAIL** ·
   S3 우선순위 뒤집기 **2 FAIL** · S4 deps 제거 **1 FAIL** · 원상복구 **바이트 동일**
```

## 31-3. 🔴🔴 **이 결함이 계약을 통과한 이유 — 다음 사람이 먼저 읽는다**

```
기존 하니스 전부가 후보·참고가격을 **`autoCheckResult`(= POST 응답)** 로 넣어 검증했다
⟹ 🔴 **「페이지를 그냥 열었을 때」(GET)는 한 번도 테스트되지 않았다**
⟹ 그 경로에서 블록이 비어 있는데 계약은 **전부 초록** 이었다
🟢 그래서 이번 계약(`pwvr-1-get-path-visible`)은 **`autoCheckResult` 를 넘기지 않는다** —
   그것이 이 파일의 전부다. 🔴 메모 `fixtures-must-not-invent-a-state-production-cannot-reach`
   의 **반대 실수** 다(그때는 GET fixture 로 POST 전용 값을 지어냈고, 이번엔 POST 로만 쟀다)
```

## 31-4. 🟡 같이 측정된 사실 — **고치지 않았다**(CPO 판정 사안)

```
🔴 실제 상품 `7b16eecc` 의 EUR 40 후보는 `market = "UNKNOWN"` 이다(§30-1 표)
   해외 «집계»  `market !== "KR"`      ⟹ UNKNOWN **포함** → EUR 40 이 금액에 든다
   후보 «카드»  `row.market === market` ⟹ UNKNOWN 은 **어느 칸에도 없다**
⟹ 🔴 **금액은 뜨는데 그 근거 카드가 없다**(화면 후보 1장 ↔ 집계 2건)
🔴 고치려면 `selectCandidateList` 의 시장 일치 규칙을 바꿔야 하고 그것은 **표시 정책 변경** 이다
   (계약 `cand-01` 이 `selectCandidateList([kr],"OVERSEAS") === 0` 으로 잠갔다) ⟹ 🟡 **CPO 판정**
🟢 계약 A-3 가 그 숫자를 **기록으로** 남겼다 — 누가 규칙을 바꾸면 FAIL 로 드러난다
```

## 31-5. 🟢 검증 · 배포

```
신규 계약  pwvr-1-get-path-visible (**6건**) — 🔴 `autoCheckResult` 없이 **GET 모양만** 으로
  A-1 국내 88,000 이 선다 · A-2 해외 EUR 40 · USD 41 이 선다(🔴 1차에 **엉뚱한 subtree** 를
  봤다 — 블록은 결론 영역이고 금액 노드는 통화마다 하나다) · A-3 §31-4 기록 ·
  A-4 **POST 가 GET 을 이긴다**(77,700) · A-5 값이 없으면 **블록도 없다** · B-1 배선 앵커
회귀 **853 files / 10,841 passed · 0 failed** · tsc **0** · build **exit 0**
배포 🟢 운영 코드가 바뀌었다 ⟹ **배포가 생성된다**
```

## 31-6. 🔴 Production UI 판정 — 세 등급을 갈라 적는다

```
계산 PASS            🟢 (§29·§30)
마운트 DOM PASS      🟢 (§31-2 · GET 경로 포함)
Production 화면 PASS 🔴 **미확인** — CTO 는 로그인 뒤 화면을 볼 수 없다
⟹ 🔴 이 WU 를 「완료」로 적지 않는다. **CEO 가 그 화면을 1회 열어야** 닫힌다
```

🟡 **CEO Action — 1회**: `/pipeline` → **B226AC009**(Bobo Choses) 열기 ·
🔴 **「🔄 다시 분석」을 누르지 않고** 그대로 본다. 기대:
```
🇰🇷 국내 참고가격  **₩88,000 · 확인 1곳**
🌎 해외 참고가격  **EUR 40** · **USD 41**
후보 카드         1장(🇰🇷 donokids) + 🔴 EUR 40 의 카드는 **없다**(§31-4 · 정상)
추천 판매가       **₩101,090**(A · 원가 역산 · CPO 판정으로 유지)
차액 표시         **없음**
```
🔴 그 화면에서 두 금액이 **여전히 안 보이면** 원인은 이 수정 밖이고 그때 다시 좌표를 잡는다.

---

## §32 `PRODUCTION-UI-MISMATCH` — CEO 화면은 **FAIL 이 아니었다 · 내 기대값이 틀렸다**

🔴🔴 **먼저 적는다 — §31 이 CEO 에게 준 기대값 넷 중 둘이 내 측정 입력 오류였다.**
그리고 그 과정에서 **진짜 결함 1건**(내가 §30 에서 만든 것)을 찾아 고쳤다.

### ① CEO 가 본 스냅샷을 특정했다 — `b6fe1871`

```
B226AC009 스냅샷은 **여럿** 이다(최신 12개 확인). CEO 화면과 맞는 것은 하나다:
  b6fe1871  국내 후보 **2장**(donokids ₩88,000 · vividvia ₩88,000) · 해외 후보 **4건**
🟢 CEO 가 적은 「국내 KRW 88,000 카드 2장 · 해외 후보 다수」와 **정확히 일치** 한다
🟢 그리고 「국내 참고가격 ₩88,000 · **1곳**」도 정상이다 —
   vividvia 는 `EXCLUDED_OBSERVED_DIFFERENCE`(§24 가 만든 그 라벨)라 **집계에 안 들어간다**
   ⟹ 🔴 **「블록 1곳 ↔ 카드 2장」은 불일치가 아니라 «자격 차이» 다**(라이브 E2E 재현)
```

### ② ₩101,090 ↔ ₩101,000 — 같은 함수이고 **갈린 입력이 둘** 이다

```
                환율(GBP)                반올림 단위              결과
내 §30 보고      1806.864865(11-10)       10(패키지 기본값)        ₩101,090
CEO 운영 화면    1797.306841(11-11)       **1000**(셀러 프로필)    ₩101,000
```
🔴 운영 호출부는 `resolveListingPrice(..., exchangeRates?.rates, priceRoundingUnit ?? undefined)`
이고 그 단위 owner 는 **`coupang_seller_profiles.price_rounding_unit`(운영 실측 1000)** 이다.
🔴 내 하니스가 `10` 을 **직접 넘겼다**. 🔴 그리고 환율은 **매일 갱신** 된다 —
같은 상품의 권장가가 날마다 달라지는 것은 **정상** 이다(`ORIGIN_FX.price_krw` 가 그 날짜값이다).
🔴 「UI 가 1,000원 단위로 **절삭**」도 아니다 — `100,641 → 101,000` 은 **반올림** 이다.
🟢 계약 `mpcd-2 ③-6` 이 **두 숫자를 각각 재현** 하고 절삭 가설을 FAIL 로 잠근다.
🟢 하니스/덤프도 고쳤다 — `rounding.json` 으로 **운영 단위를 읽어** 넘긴다(`10` 하드코딩 제거).

### ③ 🔴🔴🔴 진짜 결함 — **한 화면에 두 수집분이 섞였다**(§30 이 만들었다)

```
후보 카드   anyEvidence ? live 전부 : 저장분 전부     ← **축** 단위
§30 구현    POST ?? GET                               ← **칸** 단위 ⟹ 한 칸만 저장분으로 떨어진다
```
🔴 §30 주석은 「바로 위 `rows` 와 **같은 규칙**」이라 적어 놓고 **구현이 달랐다**.
⟹ live 축에서 국내 집계가 비면 **그 칸만** 저장분이 되어, **카드는 live · 국내 참고가격은 저장분**
이 한 화면에 선다(셀러가 보는 「판매처 N곳」과 카드가 서로 다른 수집분).
🟢 **실측이 그 모양이었다** — CEO 해외 블록 `GBP 37 · SGD 49 · USD 40.6`(live) ↔
저장분 집계 `EUR 40 · USD 41`. 🔴 **두 숫자 어느 쪽도 틀리지 않았고, 같이 세운 것이 틀렸다.**
🟢 수정 = `rows` 가 쓰는 **그 술어 하나**(`anyEvidence`)로 통일. 새 상태·새 규칙·새 fetch **0** ·
집계 분모·가격 자격·A/B 정책 **불변**. live 축에 집계가 없으면 **블록은 서지 않는다**(정직한 부재).

### 🔴 다시 조사하지 않을 것 — 세 숫자의 출처가 확정됐다

```
GBP 37   원상품 가격 그 자체(`canonicalProduct.price` = GBP 37 · `ORIGIN_FX`/`MARKET_PROBE en-int`)
SGD 49   🔴 **DB 전수에 SGD 통화 관측 0건** ⟹ 저장분이 아니다 = live 수집분이다
USD 40.6 🔴 **DB 전수에 USD 40~41 관측 0건** ⟹ 같은 이유(§22 의 「USD 40.6↔41」이 이 축이다)
🔴 하니스 함정 — `workspace::text like '%SGD%'` 가 **base64 썸네일**에 걸려 거짓 양성 12건을 냈다.
   통화를 **문자열 검색으로 세지 않는다** — `price_observations.currency` 로 센다.
```

### 검증

```
계약        pwvr-1 **7**(A-6 혼합 금지 신설 · B-1 앵커 갱신 + 칸 단위 폴백 **금지** 단언) ·
            mpcd-2 **8**(③-6 신설 · LIVE ① 이 운영 단위로 `A 101000` 재현)
음성대조    T1 칸 단위 폴백 복원 **2F** · T2 국내 저장분 고정 **4F** ·
            T3 축 술어 false **4F** · T4 해외만 칸 단위 **1F** → **바이트 동일 복구**
회귀        **853 files / 10,843 passed · 0 failed** · typecheck **0** · build **exit 0**
운영 변경   `DomesticPriceIntelligencePanel.tsx` **2줄**(폴백 술어) — 그 밖 **0**
```

🔴 **CEO 재확인은 지금 요청하지 않는다**(CPO 지시). 다음 확인 때 기대값은 **스냅샷을 먼저 고정**해
적는다 — 「B226AC009」만으로는 **12개 중 어느 것인지 정해지지 않는다**(이번 FAIL 의 1차 원인).

---

## §33 `MI-SELLER-RESULT-UX-REFINE-1` — **A 만 닫았다**(용량 판단 · §4-C)

🔴🔴 **먼저 적는다 — 이 WU 는 «끝나지 않았다».** 지시서 A~F 중 **A 를 완결·배포** 했고
**B·C·D 는 하지 않았다.** 그 이유와, 다음 세션이 **조사 없이 구현부터** 들어갈 좌표를 남긴다.

### A 완료 — 지표 이름이 「센 것」을 말한다(분모 변경 0)

```
국내  「확인 N곳」        → **「반영 판매처 N곳」**   (DOMESTIC_SELLER_COUNT_LABEL)
동일  「동일상품 확인 N곳」 → **「동일상품 확정 N곳」** (SAME_CONFIRMED_COUNT_LABEL)
해외  「판매처 N곳」       → **「반영 가격 N건」**     (OVERSEAS_SELLER_COUNT_LABEL) ← 🔴 F-③
```

🔴🔴 **해외 이름은 CPO 가 지시하지 않았다. 내가 F-3 검증에서 «거짓» 을 찾아 고쳤다**:
```
집계기 candidate-market 의 count 는 시장마다 «다른 것» 을 센다 —
  sellerKey 있음(국내) → **판매처 수**(판매처 단위로 접은 뒤)
  sellerKey 없음(해외) → **레코드 수**
🔴 그런데 해외 라벨이 「판매처 N곳」 이었다 ⟹ 같은 판매처의 리스팅 둘이 「2곳」이 된다
🔴 게다가 국내가 「반영 판매처」가 되면서 두 말이 **부분 문자열** 로 겹쳐
   「같은 지표의 시장별 값」으로 읽히게 됐다(CPO A 가 금지한 모양)
🟢 그래서 해외는 세는 **단위** 를 이름에 담았다 — 「반영 가격 N건」
```

🔴🔴 **계약이 내 설계 결함을 잡았다(그대로 배포했으면 화면에 떴다)**:
```
1차 구현은 `sellerCountLabel` 과 `sellerCountUnit` 을 **각각** 받았다
⟹ 라벨만 넘기는 기존 호출부에서 **「반영 판매처 3건」** 이 났다(wu-056 이 FAIL)
🟢 수정 — **라벨이 단위를 결정한다**(`COUNT_UNIT_BY_LABEL`). 호출부가 둘을 못 어긋낸다
```

🔴🔴 **보호 계약 하나를 «좁혔다» — 축은 그대로다**:
```
sprint2-screen-real-rows S-2 가 「동일상품 확정」을 **리터럴 금지** 로 들고 있었다
(축: 「PRESUMED_SAME 을 확정으로 단정하지 마라」 — 옳은 축이다)
🔴 그런데 CPO 가 그 말을 **집계 지표 이름** 으로 지정 ⟹ 올바른 문장이 FAIL
🟢 금지를 **「숫자가 붙지 않은 확정 어휘」** 로 좁혔다(「동일상품 확정 N곳」은 허용) ·
   🔴 같은 자리에 **「동일상품 추정」이 살아 있다** 는 단언을 **추가** 해 완화를 잠갔다
   (이 저장소가 「평균」을 리터럴 금지했다가 필수 부정문을 잡은 그 함정과 같은 계열)
```

```
계약   msrux-1-metric-naming **4**(신설) · 기존 **12 파일 문구 갱신**(리터럴 16+9건)
변이   U1 9F · U2 4F · U3 3F · U4 9F · U5 3F → **바이트 동일 복구**
회귀   **854 files / 10,847 passed · 0 failed** · typecheck **0** · build **exit 0**
운영   overseas-reference.ts · mi-same-candidates.ts · MarketPriceComparison.tsx — **라벨/단위뿐**
🔴 집계 분모 · 가격 자격 · CASE · A/B 정책 · 8축 · 후보 데이터 — **전부 변경 0**
```

### 🔴 남은 B·C·D — **owner 지도와 파급을 «이미» 쟀다**(다시 조사하지 않는다)

```
B 템플릿 통일   🔴 두 블록이 **다른 분기** 라서 모양이 다르다(컴포넌트가 다른 게 아니다):
                MarketPriceComparison:1771  `g.sameCount === 0 ? <OverseasReferencePrice> : price-guide`
                🇰🇷 는 sameCount 0 → 카드(금액+건수) · 🌎 는 sameCount>0 → 헤드라인
                (`marketPriceHeadline` · mi-same-candidates:1280)
                ⟹ 통일은 **SAME 분기도 같은 카드 셸로** 그리는 일이다(집계 변경 0)
C 기준 이동     owner `showPriceDetail` 토글(DomesticPriceIntelligencePanel:3847·3896·4679) ·
                요청 배선 MarketPriceComparison:370 · 파급 **계약 13 · 운영 9**
D UI 제거       「＋ 상세정보 보기」 MarketPriceComparison:612·894·1217·1660 (계약 8 · 운영 3)
                「💡 가격 판단 기준」 MarketPriceComparison:1335·1352       (계약 5 · 운영 2)
🔴 D 는 **그 UI 가 «있다» 를 단언하는 계약 13개를 방향 전환** 해야 한다 —
   지울 때 **보존 단언을 같이** 둔다(메모 `removal-contract-needs-paired-preservation`)
```

🔴 **왜 이번 세션에서 B·C·D 를 안 했나** — §4-C 「용량은 WU 단위로 판단한다」. 파급이
**계약 26+ 파일 · 운영 14 파일** 이고, 한 번의 전체 회귀가 6분이다. 중간에 끊기면
작업트리가 더러워진 채 남는다 ⟹ **A 를 끝까지(배포까지) 닫고** 좌표를 넘긴다.
🟢 다음 세션은 **위 좌표로 바로 구현** 하면 된다(조사 0).

### 🟡 CPO 판정이 필요한 것 1건

```
「동일상품 확정 N곳」의 **단위** — 그 숫자는 `buildPriceGuide.sameCount` 이고
**URL 단위로 중복 제거된 «후보» 수** 다(판매처 단위가 «아니다»).
🔴 CPO 지시서는 「확정된 **판매처** 수」라고 적었다 ⟹ 같은 판매처의 두 리스팅이
   「2곳」이 될 수 있다. 🔴 **분모를 바꾸지 않았다**(금지) — 사실만 올린다.
```

---

## §34 CPO 판정 반영 — **동일상품 지표의 단위는 「건」 이다**

```
「동일상품 확정 N곳」 → **「동일상품 확정 N건」**
```
🔴 근거(CPO 2026-11-11) — `sameCount` 는 **URL 중복 제거 기준의 후보 «건수»** 이고
**판매처 수가 아니다**. 🔴 판매처 단위로 바꾸면 **집계 분모와 기존 계약** 을 바꾸는 일이다
⟹ **데이터는 그대로 두고 표시 단위만** 바꾼다. 🔴 `PRESUMED_SAME` 승격 **0**(SAME 범위 불변).

🟢 **단위를 리터럴로 흩지 않았다** — `sameConfirmedCountText(n)` **함수 하나** 가 owner 다
(그 말이 나오는 자리가 **셋** 이다: 건수 줄 · 빈 상태 머리 · 1차 요약). 🔴 리터럴로 두면
한 곳만 고치는 날이 오고 그때 같은 축이 「N곳」과 「N건」으로 갈린다.

```
계약   msrux-1 **A-5 신설**(건 고정 · 「곳」 복귀 금지 · 국내 「반영 판매처 N곳」은 그대로) ·
       기존 **17 파일 리터럴 34건** 갱신(「확정 N곳」 21 + `${LABEL} N곳` 13)
변이   U6 단위 되돌림 **6F** · U7 owner 우회(리터럴 「곳」) **6F** → 바이트 동일 복구
회귀   **854 files / 10,848 passed · 0 failed** · typecheck **0** · build **exit 0**
🔴 tsc 가 내 계약 하나를 잡았다 — `OverseasPriceSummary` 에 **없는 칸**(`lowestKrw`)을 적었다
   (이 저장소에서 반복된 「칸 이름 추측」 함정 · 🟢 이번에도 **타입이 먼저** 잡았다)
```

🔴 **B·D·C 는 여전히 남아 있다** — 좌표는 **§33** 그대로다(재조사 금지).
