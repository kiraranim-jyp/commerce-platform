# MI-GEMINI-SAME-DAY-GUARD-RATE-018 — 당일 가드 발화 측정

> 🔴🔴 **Gemini API 호출 0.** 🔴 국내 검색 HTTP **111 요청**(상품당 4.27) 사용 —
> 「무료」가 아니다. 🔴 threshold 0 · DB 쓰기 0 · schema 0 · flag OFF.
> 🔴🔴 **결론: 공짜 게이트 셋이 합쳐서 막는 비율이 3.8% 다.** 그대로 적는다.

---

## 1. 다섯 범주 — 운영 게이트와 **같은 순서** (`sample 상품 N=26`)

```
① veryHighSkipped              **1**     (3.8%)
③ geminiSkippedBySameDayGuard  **0**     (0.0%)
④ noPrimaryQuery               **0**     (0.0%)
⑤ geminiEligible               **25**    (**96.2%**)
                               ────────
합계                             26
🟢 세 게이트가 합쳐서 막는 비율   **3.8%**
```

🔴 즉 WU-016 에 넣은 **세 장치 전부를 합쳐도** 이 표본에서 Gemini 는 96.2% 의
상품에서 호출된다.

---

## 2. 🔴 `sameDayChecked = 0/26` — **표본 성질이다. 가드가 쓸모없다는 증거가 아니다**

```
이 표본의 국내 관측 행은 전부 **8~9월** 것이다 → 「오늘 확인됨」이 0 이 나온다.
🔴 당일 가드는 **같은 날 재확인이 올 때만** 발화한다. 표본에 그 상황이 없었다.
→ 🔴🔴 그래서 「0.0%」를 **「가드가 효과 없다」로 읽으면 틀린다.**
   이 숫자는 「이 표본에, 지금 시점에, 재확인이 오면 막힐 상품이 0」이라는 뜻이다.
```

### 🟢 그런데 「막을 것이 있다」는 간접 증거가 하나 나왔다

```
「같은 날 여러 관측 행이 남은 상품」 = **2**
🔴 `hasObservationToday` 멱등이 돌았다면 같은 날 두 행이 남지 않는다.
🟢 즉 운영에서 **같은 날 반복 확인이 실제로 일어났다** —
   「지금 확인」 route 가 `skipIfCheckedToday` 를 쓰지 않기 때문이다(016 에서 확인).
🔴 단 **N=2 · 과거 데이터** 다. 빈도로 일반화하지 않는다.
```

---

## 3. 🔴🔴 잴 수 없는 것 — 「상품당 재확인 **횟수**」

```
🔴 `hasObservationToday` 멱등 때문에 같은 날 반복 확인은 **대체로 행을 남기지 않는다.**
   → 「당일 가드가 실제로 몇 번 막았는가」는 **이 데이터로 측정 불가** 다.
🟢 이번에 잰 것은 **발화 «자격률»** 이다 — 「재확인이 지금 오면 막힐 상품 수」.
🔴 **둘을 같은 숫자로 쓰지 않는다.** 그리고 **운영 전수 절감액·% 를 산출하지 않는다**
   (Billing 과 운영 빈도 없이는 불가 — 지시서 「중요한 제한」).
```

### 🟢 측정 가능해지는 조건 — **로그 한 줄을 넣었다**(§5 범위)

```ts
// run-domestic-price-check.ts · Gemini flag 분기 «안»
console.log(`[MI-016-gate] snapshot=… skip=… veryHigh=… checkedToday=…`);
```

```
🟢 기존 `[H-3-11]` 로그 규약과 같은 형태다. flag OFF 면 **한 줄도 찍히지 않는다.**
🟢 flag 를 켜면 매 호출의 skip 이유가 찍히므로 그 로그를 세면
   **실제 발화 «횟수»** 가 나온다 — 지금은 없는 그 분모가 생긴다.
🔴 DB·schema·UI 를 건드리지 않았다.
```

---

## 4. 🟢 부수 확인 — `noPrimaryQuery = 0` 은 WU-014 가 잘 작동한다는 뜻이다

```
primary level 분포   L1_MODEL_CODE **6** · L2_BRAND_NAME **20** · UNAVAILABLE **0**
🟢 26 상품 전건에서 Primary Query 를 만들 수 있었다.
🟢 그중 6건은 **품번 기반(L1)** 이다 — WU-014 전에는 품번이 Primary 에 들어간 것이
   **0/3** 이었다(그 표본 기준). 이제 품번이 있으면 L1 이 나간다.
🔴 그래서 ④ 게이트(Primary 없음 → 호출 0)는 **이 표본에서 발화하지 않는다.**
   비용 레버로 기대할 수 없다.
```

---

## 5. 🔴 그래서 비용 구조에 대한 현재 결론

```
① deterministic very_high   🔴 1/26 = 3.8%   (017 에서 확정)
② 당일 가드                  🔴 자격률 0/26 — 🔴 실제 발화 횟수는 **측정 불가**
                            🟢 단 「막을 것이 있다」는 간접 증거 N=2
③ NO_PRIMARY_QUERY          🔴 0/26 — 발화하지 않는다
────────────────────────────────────────────────
세 게이트 합계               🔴 **3.8%** 만 막는다
⑤ Gemini 필요                🔴 **96.2%**
```

🔴🔴 **공짜 레버는 여기서 거의 소진됐다.** 남은 선택지는 전부 **제품 정책** 이다:

```
🔴 ⒜ 쓸 수 있는 샵이 사실상 없는 카테고리에서 Gemini 를 부르지 않는다
     (테니스 9/9 후보 0 · Gemini 도 KRW 증거 0 — 017/011 실측)
     → **그 카테고리 Discovery 포기** 다. CPO 결정.
🔴 ⒝ 「지금 확인」에 당일 가드를 적용한다
     → **수동 재확인을 막는다** = 기존 제품 동작 변경. CPO 결정.
🔴 ⒞ Gemini 를 특정 조건(예: 브랜드가 국내 유통되는 경우)에만 부른다
     → 새 정책 축 신설. CPO 결정.
🔴 ⒟ Grounded Search 구조 자체를 폐기하고 다른 Discovery 로 간다
     → CPO 가 이미 「현 비용 수준에서 Production 후보 제외」로 적어 둔 방향.
```

🔴 **CTO 가 ⒜~⒟ 중 어느 것도 구현하지 않았다.** 전부 제품 범위 결정이다.

---

## 6. 국내 HTTP (Gemini 와 다른 축)

```
샵 검색 요청 **111** · 상품당 **4.27** · 🔴 Gemini 호출 **0**
🔴 이 숫자를 Gemini 비용과 합산하지 않는다.
```

---

## 7. 🔴🔴 음성 대조가 **가드 공백을 하나 찾아냈다** — 이 WU 의 실질 산출물이다

```
🔴 M2「deterministic 게이트를 if (false) 로 죽인다」 → **42/42 전부 통과했다.**
   즉 WU-016 의 가드는 게이트가 통째로 죽어도 **아무 소리를 내지 않았다.**
🔴 원인: 단언이 `geminiSkipReason = "DETERMINISTIC_HIT"` 라는 **대입문의 문자열만**
   보고 «무엇이 그 대입을 일으키는가» 를 보지 않았다.
🟢 조치: 술어까지 잠갔다(**가드 강화** — 약화가 아니다).
   `if (deterministicHit) …` · `else if (checkedToday) …` ·
   `const deterministicHit = searchResults.some(` 셋을 단언에 넣었다.
```

### 음성 대조 5종 — 강화 후 전부 FAIL 한다

| 변형 | 내용 | 결과 |
|---|---|---|
| M0 | 정상 | 🟢 **43 passed** |
| M1 | 당일 가드 분기 **삭제** | 🔴 **1 FAIL** |
| M2 | deterministic 게이트 `if (false)` | 🔴 **1 FAIL** (강화 전에는 통과했다) |
| M3 | `&& geminiSkipReason === null` 제거 | 🔴 **1 FAIL** |
| M4 | 당일 가드 `else if (false)` | 🔴 **1 FAIL** |
| M5 | `searchResults.some(` → `[].some(` | 🔴 **2 FAIL** |
| 원상복구 | — | 🟢 **43 passed** |

🔴 이 가드 공백은 「소스 문자열 검사는 **주석을 벗기고** 한다」와 **다른** 함정이다.
주석은 이미 벗기고 있었다. 빠진 것은 **「그 줄을 일으키는 조건」** 이다.

---

## 8. 검증

```
🟢 admin 전체 회귀   Test Files **512 passed** / 47 skipped (559)
                     Tests      **7635 passed** / 55 skipped (7690) · FAIL **0**
                     🔴 baseline 505/7520 보다 늘어난 것은 **내가 추가한 테스트** 다
🟢 typecheck         전 패키지 **10** (baseline **10** 과 동일 — 추가 0)
🟢 build             `Compiled successfully` · exit 0
🟢 coupling guard    `no-production-coupling` 6 passed
🟢 mutation          위 §7 — 5종 전부 FAIL · 원상복구 PASS
🟢 Gemini 호출 **0** · grounding **0** · credit **0** · ₩3,300 **보존**
🟢 threshold 0 · DB schema 0 · DB 쓰기 0 · 가격추적 0 · 영구 URL 저장 0 · Vision 0
🟢 UI 0 · P-32 0 · flag **OFF** · main merge 0 · deploy 0
🟢 「지금 확인」의 기존 제품 동작 **변경 0**(`skipIfCheckedToday` 를 켜지 않았다)
```

### 🔴 하니스 함정 — `packages/crawler` 를 **단독으로 돌리지 않는다**

```
`cd packages/crawler && npx vitest run` → exit **1** 이 났다.
🔴 그런데 회귀가 아니다 — `packages/crawler` 에는 **테스트 러너가 없다**
   (vitest config 0 · package.json `test` script 0).
🟢 유일한 러너는 apps/admin 이고 config 의 `include` 가 crawler·pricing·shared·
   category 를 **끌어온다**(그 주석이 이유를 적어 뒀다: 러너를 둘로 가르면 빠뜨린다).
🔴 단독 실행은 `@/` 별칭이 없어 `match-truth-priority.test.ts` 가 로드조차 못 한다.
🟢 내 diff 를 stash 하고 돌려도 **같은 실패** 가 났다 → 전부터 그렇다.
🟢 admin 전수 로그에는 그 파일이 `✓ 16 tests` 로 찍혀 있다.
🔴 **회귀는 「apps/admin 에서 `npx vitest run`」으로만 센다.**
```

🔴 **운영 코드 변경은 로그 한 줄** 이다(`[MI-016-gate]`). 판정·게이트 로직은 016 그대로다.
🔴 그 외 변경은 **테스트 강화 1건** 이다(§7).
