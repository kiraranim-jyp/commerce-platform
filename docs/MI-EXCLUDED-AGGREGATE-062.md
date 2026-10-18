# WU-062 — `EXCLUDED` 집계 최소 수정 (CPO GO · 1줄)

> 🔴 CPO 승인 2026-10-18. 「`EXCLUDED` 를 해외 동일상품 금액 집계에서 제외.
> 단 **원본 관측 데이터 자체를 삭제하지 말고** — 관측/검증 결과에서는 유지 →
> 동일상품 참고가격 aggregate 에서만 제외.」

---

## 1. Scope

```
🟢 한 것   `summarizeCandidateOverseasPrices` 의 금액 집계에서 `EXCLUDED` 1건 제외 (**1줄**)
🔴 안 한 것 CF-3 ❌ · Vision ❌ · beaumonde parser ❌ · generic body-number ❌ ·
           `fixedPrice` ❌ · 가격 계층 추가 ❌ · MI gate 변경 ❌ · UI 제목/라벨 변경 ❌
```

## 2. 변경 내용 — **운영 1파일 · 1줄**

`apps/admin/src/app/api/price-history/_lib/candidate-market.ts`

```ts
    byMarket[r.market]   = (byMarket[r.market] ?? 0) + 1;      // ← 관측은 **먼저** 센다
    byPriceTier[r.priceTier] = (byPriceTier[r.priceTier] ?? 0) + 1;
+   if (r.priceTier === "EXCLUDED") continue;                  // ← 🔴 추가된 유일한 줄
    if (r.amount == null || !Number.isFinite(r.amount)) continue;
```

🔴 **자리가 중요하다.** `byMarket`·`byPriceTier` 가 **먼저** 세어진 뒤에 `continue` 하므로
「동일상품 아님 N건」 표시와 시장 분포가 **그대로 남는다**. 빠지는 것은 `byCurrency`(금액) 하나다.
입력 배열도, 반환 `count: records.length` 도 건드리지 않았다.

## 3. ① 현재/수정 후 EUR·USD aggregate 비교

같은 입력(EXACT 40 EUR · COMPARISON 75 EUR · **EXCLUDED 9 EUR** · REFERENCE 98 USD · **EXCLUDED 12 USD**):

| | 변경 전 | 변경 후 | |
|---|---|---|---|
| EUR | count 3 · 최저 **9** | count 2 · 최저 **40** | 🔴 4.4배 |
| USD | count 2 · 최저 **12** | count 1 · 최저 **98** | 🔴 8.2배 |
| `byPriceTier.EXCLUDED` | 2 | **2** | 🟢 불변 |
| `byMarket.OVERSEAS` | 5 | **5** | 🟢 불변 |
| `count` | 5 | **5** | 🟢 불변 |

🔴 `REFERENCE` 는 **빼지 않았다** — USD 최저가가 그 값(98)이다. CPO 가 `EXCLUDED` 하나만 승인했다.

## 4. ② `EXCLUDED` 원본 evidence 보존 확인

```
🟢 입력 배열 변형 0 — 필터링하지 않고 루프 안에서 `continue` 만 한다
🟢 `count: records.length` 그대로 → 「후보 N건」이 줄지 않는다
🟢 `byPriceTier.EXCLUDED` 그대로 → 화면의 「동일상품 아님 N」 유지
🟢 `byMarket` 그대로 → 시장 분포 유지
🟢 `candidateOverseasEvidence`(후보 원본 배열)는 **이 함수 밖** 이라 무관 — 한 줄도 안 바뀐다
🔴 DB 쓰기 0 · schema 0 · 관측 테이블 0
```

## 5. ③ EXACT / COMPARISON / REFERENCE 회귀

```
세 tier 각각 단건으로 돌려 금액 집계에 **그대로 들어감** 을 단언했다
  EXACT      → byCurrency.EUR {count 1, lowest 10}
  COMPARISON → byCurrency.EUR {count 1, lowest 10}
  REFERENCE  → byCurrency.EUR {count 1, lowest 10}
  EXCLUDED   → byCurrency **{}** · byPriceTier.EXCLUDED **1**
🟢 의미 변경 0 — `priceTierFromLink` · `deriveMatchTruth` · MI gate 전부 미변경
```

## 6. ④ 국내 가격 aggregate 불변 확인

🟢 **같은 함수를 국내도 쓰지만 이 분기가 «발화하지 않는다».** 국내 레코드는 적재 시점에
이미 `EXACT | COMPARISON` 둘뿐이다(`market-intelligence.ts` · WU-056 가드).

```
국내 입력 [COMPARISON 117,000 KRW · EXACT 88,000 KRW]
  → byCurrency.KRW {count 2, lowest 88,000} · count 2 · byPriceTier {COMPARISON 1, EXACT 1}
🟢 변경 전과 **완전히 동일** 하다 (테스트로 잠갔다)
🔴 그리고 국내에 EXCLUDED 가 유입되면 **테스트가 깨진다**(mutation Q4 · 2 FAIL)
```

## 7. ⑤ `동일상품 아님` 표시 불변 · ⑥ 해외 참고가격 UI 계약 회귀

```
🟢 `TIER_LABEL.EXCLUDED = "동일상품 아님"` **미변경** · UI 제목/아이콘 **미변경**
🟢 UI 문자열 변환기(overseas-reference.ts:127)가 `byPriceTier` 를 읽으므로 표시가 유지된다
🟢 UI 계약 회귀 — wu-056r1(가격 구역 식별) + wu-056(국내 참고가격) **17 passed**
🔴 「판매처 N곳」(byCurrency[].count)은 **의도적으로 줄어든다** — 그 줄이 최저가 옆에 있고
   동일상품 금액의 분모이기 때문이다. 🔴 **이것이 셀러가 보는 유일한 변화다.**
```

## 8. 🔴🔴 적용 증거 — **옛 동작을 고정했던 계약 2건만 깨졌다**

수정 직후 전체 회귀를 돌려 **폭발 반경** 을 측정했다:

```
Test Files  2 failed | 567 passed      Tests  **2 failed** | 8,240 passed
  × wu-059-boundaries  「해외 집계의 최저가가 EXCLUDED 후보에서 나올 수 있다」
  × wu-061-price-closure 「EXCLUDED 가 최저가를 만든다 — 전후 숫자를 고정한다」
🟢 **그 둘 말고는 하나도 안 깨졌다** — 국내 집계 · UI · MI gate · 판정 전부 불변.
```

🟢 두 계약을 **새 동작으로 갱신** 하고 「변경 전」 숫자를 주석에 남겼다(되돌아가면 안 되는 값).

## 9. Negative / Mutation

baseline **29 passed** · 변형마다 원상복구 확인

| | 변형 | 결과 |
|---|---|---|
| Q1 | 수정 1줄 **되돌리기** | 🔴 **3 failed** |
| Q2 | `REFERENCE` 도 같이 제외 | 🔴 **2 failed** |
| Q3 | 관측(`byPriceTier`) 카운트까지 삭제 | 🔴 **4 failed** |
| Q4 | 국내 적재에 `EXCLUDED` 유입 | 🔴 **2 failed** |
| — | 원상복구 | 🟢 **29 passed** |

## 10~12. ⑦ Regression / Typecheck / Build

```
회귀      apps/admin  **569 files / 8,244 passed** / failed 0 (skipped 94)
typecheck **0 errors**
build     **exit 0**
```

## 13~16. Commit / Deploy / Evidence / External API

```
외부 API  AI 0 · Gemini 0 · 검색 API 0 · 키 0 · 결제 **₩0** · 외부 HTTP **0**
🟢 Gemini 잔액 ₩3,171 보존 · flag 미변경 · DB 쓰기 0 · schema 0
```

## 17. 🔴 Known Unknowns

```
① 🔴 **운영 전수 영향도는 미측정** — §3 숫자는 합성 입력이고, 실제로 몇 상품의 화면
   숫자가 바뀌는지는 Production 데이터를 봐야 안다. GT 51 의 EXCLUDED 비중은 15.7% 다
② 🔴 EXCLUDED 만 있는 상품에서는 금액 줄이 **사라지고** 「동일상품 아님 N」만 남는다 —
   그 화면을 CTO 가 본 적이 **없다**(로그인 뒤). §19 ④가 그것을 본다
③ 🔴 「판매처 N곳」 숫자가 줄어드는 것이 셀러에게 어떻게 읽히는지 **미검증**
```

## 18. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     🔴 **CEO 확인 1회 필요**(§19)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음(외부 호출 0)
Build PASS:  🟢        Production PASS:        🟡 §19 확인 후 확정
```

## 19. 🔴 CEO Production 최종 테스트 — **한 번만** (UI 숫자가 바뀐다)

```
URL     https://ttaejyo.vercel.app/pipeline        (로그인 필요)
경로    상품 하나 열기 → 가격 구역까지 내려가기 → 「🔄 다시 분석」 **1회**
        (입력칸은 2단 접힘 뒤에 있다 — WU-049-R)
```

| | 확인할 것 | 기대 | 🔴 FAIL 기준 |
|---|---|---|---|
| ① | 🧾 **해외 동일상품 참고가격** 구역 제목 | 그대로 | 제목이 바뀌었다 |
| ② | 그 구역의 **최저가** | 「동일상품 아님」으로 표시된 후보보다 **싸지 않다** | 동일상품 아님 후보의 금액이 최저가로 뜬다 |
| ③ | 그 구역의 **「동일상품 아님 N」 표시** | **그대로 보인다** | 사라졌다 |
| ④ | 후보가 전부 「동일상품 아님」인 상품 | 금액 줄 없이 **「동일상품 아님 N」만** 보인다 | 금액이 뜬다 / 구역이 통째로 사라진다 |
| ⑤ | 🇰🇷 **국내 참고가격** 구역 | **변화 없음**(숫자·문구 그대로) | 숫자가 달라졌다 |
| ⑥ | 해외 구역 **안** 의 `₩`·「약」 | **0** | 원화가 섞였다 |
| ⑦ | 판매 판정(🟢🟡🔴) | **변화 없음** | 판정이 바뀌었다 |

🔴 **FAIL 이면 수정하지 않고 화면 그대로 전달한다**(§3 게이트).
🟢 ⑤⑦ 이 「변화 없음」이어야 하는 이유 — 이 수정은 **해외 금액 집계 하나** 만 건드렸다.
