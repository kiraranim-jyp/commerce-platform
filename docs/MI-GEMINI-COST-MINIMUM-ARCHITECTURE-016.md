# MI-GEMINI-COST-MINIMUM-ARCHITECTURE-016 — Gemini 를 «최후의 보조층» 으로 내린다

> 🔴🔴 **Gemini API 호출 0 · grounding 0 · credit 0 · ₩3,300 보존.**
> 🟢 비용 0 으로 **구조를 먼저 완성** 했다. 실제 검증(1~2 상품)은 맨 마지막이다.
> 🔴 Billing 을 기다리며 멈춰 있지 않고, **지출 없이 할 수 있는 것을 끝냈다.**

---

## 0. 확정된 개발 원칙 (CPO 2026-10-13)

```
기존 MI / 국내 검색
        ↓
결정적으로 찾을 수 있는 후보 우선
        ↓
그래도 못 찾은 경우만 Gemini
        ↓
Gemini 1회 · Primary 1개 · 후보 최대 3
        ↓
기존 MI 판정
        ↓
가격 확인 가능한 경우만 등록 판단에 반영
```

🔴 **Gemini 를 기본 검색엔진으로 쓰지 않는다.**

---

## 1. 🟢🟢 리포에 이미 있던 선례 셋 — 새로 만든 것이 적다

조사에서 먼저 확인했다. 🔴 **새 장치를 만들기 전에 있는 것을 찾았다.**

```
① `foundVeryHighInP0` (run-domestic-price-check.ts:789)
   「very_high 매칭이 하나라도 나오면 P1/P2 를 더 뒤지지 않는다」
   🟢 **「충분히 찾았으면 더 안 뒤진다」가 이미 제품 규칙이다.**
② `hasObservationToday(snapshotId, "DOMESTIC_SHOP")` (:696) → :700 early return
   🟢 일 단위 멱등 장치가 이미 있다.
③ `visionCallCount = { n: 0 }` (:705)
   🟢 Vision 호출 카운터가 이미 있다 — 🔴 다만 **반환되지 않았다.**
```

---

## 2. 구현 — 운영 1파일 (`run-domestic-price-check.ts`)

### ① 🔴🔴 결정적 후보가 있으면 Gemini 를 부르지 않는다

```ts
const deterministicHit = searchResults.some((r) =>
  r.status === "ok" ? r.candidates.some((c) => c.matchLevel === "very_high") : false,
);
```

🟢 **새 threshold 를 만들지 않았다** — `:789` 의 `foundVeryHighInP0` 가 쓰는
**그 조건 그대로** 다. 🔴 「threshold 변경 금지」를 지키면서 비용을 깎는 유일한 방법이
기존 술어의 재사용이다. 테스트가 `matchLevel === "very_high"` 등장이 **정확히 2곳**
임을 잠근다(기존 + 새 게이트).

### ② 🔴 같은 상품을 같은 날 다시 부르지 않는다

```ts
const checkedToday = deterministicHit ? false : await hasObservationToday(input.snapshotId, "DOMESTIC_SHOP");
```

🔴🔴 **전체 경로가 아니라 Gemini 블록만 막는다.** `skipIfCheckedToday` 를 켜는 것은
**기존 제품 동작 변경** 이다 — 「지금 확인」 route(`check/route.ts`)는 그 플래그를
쓰지 **않으며**, 켜면 셀러의 수동 재확인이 막힌다.

```
🟢 그래서 국내 재확인은 전과 똑같이 돈다.
🟢 다만 셀러가 「가격 다시 확인」을 여러 번 눌러도 **Gemini 비용은 하루 1회** 다.
🟢 DB 는 **읽기만** 한다 — 새 저장 0(저장 금지 정책 준수).
🟢 deterministic 히트면 그 조회조차 하지 않는다(DB 읽기도 아낀다).
```

### ⑥ 🔴 Vision 을 Discovery 와 분리해 돌려준다

```
결과 칸 셋이 각각 있다:
  geminiMetrics            Discovery(호출·토큰·grounding)
  geminiPriceEnrichCalls   가격 보강 HTTP
  visionCalls              **Vision 호출 수**   ← 016 에서 추가
```

🔴 Vision 은 같은 `GEMINI_API_KEY` 를 쓰지만 **이미지를 보낸다** — 단가 구조가 다르다.
**합산하지 않는다.** 테스트가 `geminiCalls += visionCallCount` 류 합산이 없음을 잠근다.

### 🔴 「0 회」와 「건너뛴 이유」를 가른다

```
geminiSkipReason: "DETERMINISTIC_HIT" | "ALREADY_CHECKED_TODAY" | null
```

🔴 비용 보고에서 **「호출 0」과 「스킵됨」은 다른 상태** 다. 앞은 flag OFF 이거나
Primary 를 못 만든 것이고, 뒤는 **구조가 돈을 아낀 것** 이다. 섞으면 최적화 효과를
측정할 수 없다.

---

## 3. 7항 대조 — 어디까지 했는가

| # | CPO 항목 | 상태 |
|---|---|---|
| ① | Gemini 호출 자체를 최소화 | 🟢 **구현** — deterministic 게이트 + 당일 가드 |
| ② | grounding query 최소화 | 🟢 WU-014 에서 완료(Primary 1개 · prompt v2) · 🔴 **감소량은 미측정** |
| ③ | 후보 최대 3 | 🟢 기존 `maxCandidates: 3` — 테스트로 **잠갔다**(모듈 하드코딩 없음 확인) |
| ④ | 가격 불가 후보에 추가 호출 금지 | 🟢 **구조적으로 없다** — 호출은 상품당 1회고 후보 루프 안에 호출이 없다(테스트로 확인) |
| ⑤ | 같은 상품 반복 호출 방지 | 🟢 **구현** — 당일 가드(기존 멱등 장치 읽기) |
| ⑥ | Vision 을 별도 비용으로 관리 | 🟢 **구현** — `visionCalls` 분리 반환 |
| ⑦ | 가치 없는 후보 즉시 폐기 | 🟢 기존 장치 조합 — self-ref 선제거 · `priceKrw == null` 집계 제외 · 후보 상한 3 |

🔴 ②의 **실제 감소량은 이번에도 미측정** 이다(Gemini 호출 0). 등급을 유지한다.

---

## 4. Tests — 21건 · 음성대조 4종

`apps/admin/.../__tests__/mi-gemini-016-cost-minimum.test.ts`

```
① 게이트가 Gemini 호출 «앞» (인덱스 순서) · 기존 very_high 조건 재사용(등장 2곳) ·
   Gemini 전용 threshold 어휘 0 · 스킵 조건이 호출부에 함께 걸려 있음
⑤ 기존 멱등 장치를 읽기만 · 🔴 check route 가 `skipIfCheckedToday` 를 **쓰지 않음**
   (= 기존 제품 동작 불변) · deterministic 히트면 DB 조회조차 안 함
③ 상한 3 은 호출부가 주고 pool 이 지킨다 · 모듈 하드코딩 없음
② Primary 1개 · `generateQueries` 미사용 · NO_PRIMARY_QUERY 는 **return 으로 끝난다**
④⑦ 후보 루프 안에 Gemini 호출 없음 · self-ref 가 enrich «앞» · priceKrw null 제외
⑥ visionCalls 분리 반환 · 합산 코드 없음
금지 사항 — migration/ALTER/CREATE 0 · flag 기본 OFF · threshold 어휘 0
```

🟢 **음성 대조**:

```
정상                                   21/21 PASS
① deterministic 게이트 무력화          → **1 FAIL**
② 당일 가드 제거                       → **1 FAIL**
③ 스킵 조건을 호출부에서 떼기           → **1 FAIL**
④ Vision 을 Discovery 에 합산           → **1 FAIL**
원상복구                               21/21 PASS
```

### 🔴 그리고 내 «기존 테스트» 의 약한 프록시 하나를 고쳤다

```
WU-010R 의 「enrichCandidatePrices 가 flag 분기 안에 있다」가
`flag ~ enrich` 구간에 「블록 닫힘이 없다」로 검사했다.
🔴 016 이 flag 블록을 **둘** 로 만들자(게이트 + 실행) 첫 블록의 닫힘이 그 구간에
   들어와 깨졌다. 🔴 「위치만 보면 속는다」고 주석에 써 놓고 내가 그 함정에 걸렸다.
🟢 **실행 블록의 opener 를 정확히 지목** 하도록 고쳤다 —
   `isGeminiDiscoveryEnabled() && geminiSkipReason === null` 뒤에 호출부가 온다.
🔴 그 수정에서 또 한 번 틀렸다 — `indexOf("enrichCandidatePrices")` 가 맨 위
   **import 문**(index 259)을 집었다. 🟢 테스트가 그것을 잡아 `("...(scored")` 로
   호출부를 지목하게 고쳤다. **식별자가 아니라 호출 위치가 의도다.**
```

---

## 5. Regression / Typecheck / Build / Guard

```
🟢 admin   **512 files / 7,635 tests passed** / 53 skipped · failed **0**
🟢 crawler Files 1 failed / **62 passed** / 19 skipped ·
           Tests **871 passed** / 23 skipped · 실패 «테스트» **0**
           🔴 그 1 파일은 선재 collection failure(match-truth-priority → `@/lib` alias)
🟢 typecheck 전 패키지 **10 = baseline 10**
🟢 guard     no-production-coupling **6/6**
🟢 build     exit 0 · Compiled successfully
```

---

## 6. 🔴 예상 비용 변화 — **구조적 추론이고 측정값이 아니다**

```
🟢 구조적으로 확실한 것
   · 국내 경로가 very_high 를 내면 Gemini 호출 **0**
   · 같은 상품 당일 재확인에서 Gemini 호출 **0**
   · Primary 가 1개라 상품당 호출이 **1회 이하**
   · Primary 를 못 만들면 호출 **0**
🔴 측정되지 않은 것
   · 위 게이트가 실제 표본에서 **몇 %의 상품을 걸러내는가**
   · grounding N 이 신 Primary 로 얼마나 줄어드는가
🔴 그래서 「비용이 X% 줄었다」를 적지 않는다(§25 금지 표현).
```

🟢 **게이트 적중률은 Gemini 호출 없이 잴 수 있다** — 기존 국내 검색만 돌려
`very_high` 가 나오는 상품 비율을 세면 된다. 🔴 이번 WU 범위에 넣지 않았다(국내
검색도 외부 HTTP 를 쓴다). 다음 WU 후보로 남긴다.

---

## 7. 준수 사항 (§23)

```
🟢 Gemini API 호출 **0** · grounding **0** · credit **0** · ₩3,300 **보존**
🟢 MI threshold 0 · SAME 판정 정책 0 · P-32 0 · Registration policy 0
🟢 Registry 확장 0 · DB schema 0 · migration 0 · 영구 URL 저장 0 · 가격추적 0
🟢 UI 0 · merge 0 · deploy 0 · flag **OFF**
🔴 명백한 구현 결함(내 테스트의 약한 프록시 2건)만 정책 변경 없이 고쳤다
```

## 다음 — 🔴 여전히 Billing 이 먼저다

```
🟢 지출 없이 할 수 있는 구조 작업은 **이번 WU 로 끝났다**
🔴 남은 것은 **실측 1~2 상품** 이고 그것만 비용을 쓴다
   (설계는 013 문서 §6 에 미리 등록돼 있다 — 구 Primary vs 신 Primary 분리)
🔴 재개 트리거는 CPO 의 Billing reconciliation 하나다
```
