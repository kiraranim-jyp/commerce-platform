# [CTO 인수인계 · 즉시 실행] `MI-UNIFIED-MARKET-PRICE-COMPARISON-1`

> 기준일 **2026-11-10** · 담당 **CTO** · 승인·검증 **CPO** · 최종 의사결정 **CEO**
> 🔴 이 문서는 **조사를 다시 하지 않기 위한 것**이다. §3 의 값은 **확정값**이고 재조사 금지다.
> 🔴🔴 **2026-11-10 2차 — §3 배선 자리가 «정정» 됐다.** 환율이 가드 안에 있고(§3-①)
> UI 환산 지점이 **셋**이다(§3-②). 1차 내용과 CPO 지시서 §7-1 은 그 둘을 몰랐다.
> 🟢 §13 CPO 전략 기준 · 🟢🟢 **§14 CPO 정정 승인 + 문서 우선순위**(거기서 시작해도 된다)
> 🔴 **작업지시서는 repo 파일이 아니다** — 그 목표·완료조건은 **§14-③ 에 보존**돼 있다.

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

### ④ 🔵 운영 변경 대상 파일 (예상 4) · 수정하지 않을 파일

```
🟢 대상  market-intelligence.ts (1303줄)  ⓿ 환율 hoist · ① 파생값 · ② 응답
         candidate-market.ts     (512줄)  요약 타입에 파생 칸 가산
         MarketPriceComparison.tsx(2740줄) ③ UI 3지점(:1857 · :2486 · :2658)
         + 응답 타입/route 최소 가산
🔴 금지  run-price-check.ts (§3-④ · 다른 축) · overseas-reference.ts 통화별 집계 계약 ·
         docs/START-HERE.md (보존 40건 안)
```

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
