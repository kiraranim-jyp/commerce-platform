# [CTO 인수인계 · 즉시 실행] `MI-UNIFIED-MARKET-PRICE-COMPARISON-1`

> 기준일 **2026-11-10** · 담당 **CTO** · 승인·검증 **CPO** · 최종 의사결정 **CEO**
> 🔴 이 문서는 **조사를 다시 하지 않기 위한 것**이다. §3 의 값은 **확정값**이고 재조사 금지다.

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

### 🟢 배선 자리 (재배치 불필요)
```
market-intelligence.ts:720    await fetchLiveExchangeRates()   ← **이미 호출한다**
overseasEvidence  생성 ~:427 (루프 안)  →  소비 :1247 · :1278
⟹ 환율 확보(:720)가 소비(:1247) «앞» 이므로 순서를 바꾸지 않고 파생값을 계산할 수 있다

UI 자체 환산 제거 대상
  MarketPriceComparison.tsx:1857   convertToKrwStrict(c.lowest, c.currency)
  MarketPriceComparison.tsx:2486   convertToKrwStrict(row.priceAmount, row.priceCurrency)
```

---

## 4. 🔵 구현 순서

```
① 서버 파생값   overseasEvidence 원소에 priceKrwDerived · rateBasisAt · rateSource 추가
                🔴 원래 priceAmount·priceCurrency 를 **덮어쓰지 않는다**
                🔴 환율 없으면 priceKrwDerived = null (임의 환율 금지)
② 응답 계약     그 값이 UI 까지 가도록 기존 응답 타입에 **최소** 추가
③ UI 교체      :1857 · :2486 의 자체 환산 제거 → 서버 값 **읽기만**
④ 비교         국내 KRW ↔ 해외 파생 KRW (같은 기준)
🔴 금지        통화 **합산** 0 · overseas-reference.ts 통화별 집계 계약 **보존** ·
               CASE A/B/C/D 0 · 동일성 승격 0 · 환산값을 EXACT 근거로 쓰지 않음
```

🟢 **CPO 가 가른 핵심 구분** — 「**환산(비교용 파생값)**」 ≠ 「**합산**」.
`overseas-reference.ts` 가 금지한 것은 **통화를 합쳐 하나의 합계 칸을 만드는 것**이다.
후보별 KRW 파생값을 **따로** 제공하는 것은 그 계약을 건드리지 않는다 ⟹ **CEO 승인 불필요**.

---

## 5. 🔵 검증 (지시서 T1~T7)

```
T1 환산 계약     KRW/USD/EUR/GBP · 미지 통화 · 환율 누락 · 잘못된 가격 → null
T2 일관성       같은 입력·같은 환율 → 같은 결과 · 서버/UI 이중 계산 0
T3 UI 이중 환산  :1857 · :2486 의 convertToKrwStrict 호출이 **사라졌는지**
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
