# WU-063 — 국내 가격 비교 E2E 정상화 (롱스프린트)

> 🔴 CPO 지시 2026-10-18. 「국내 가격 추출기 하나를 추가하는 것이 아니라 **전체 체인을
> 전수 검증하고 병목을 제거**」 · 「**잘못된 국내 최저가를 보여주는 것이 가격 미노출보다
> 더 큰 오류다**」

---

## 1. 국내 가격 비교의 **실제 병목** — 하나가 아니라 **셋**

국내/한국계 후보 **17건** 을 **운영 분기 순서 그대로**(`market-intelligence.ts:226~325`)
흘려 보낸 결과. 🔴 내가 분기를 재구성하지 않고 **그 파일의 순서를 그대로 베꼈다**.

| 종착지 | 건수 | 대상 | 성격 |
|---|---|---|---|
| 🟢 **국내 금액 버킷** | **5** | C07 C15 C23 C24 C47 | 전부 `COMPARISON` · **EXACT 0** |
| 🟢 해외 축 | 4 | C06 C10 C41(USD) · C14(JPY) | **올바른 판정** — 외화 판매처다 |
| 🔴 **KRW + market UNKNOWN** | **4** | C08 C21 C22 C43 | **최대 회수 대상**(WU-051 가드가 양축에서 뺀다) |
| 🔴 가격 증거 없음 | 2 | C13 C27 (beaumonde) | CPO HOLD |
| 🟢 tier EXCLUDED | 2 | C28 C32 (luksusbaby) | **올바른 차단** |

🔴🔴 **그래서 「국내 가격 비교가 약하다」를 한 문제로 취급하면 틀린 처방이 나온다.**
가격 parser 는 **17건 중 2건** 짜리 문제이고, 더 큰 것은 **시장 판정 4건** 이다.

---

## 2. 원인 — 단계별로 **다르다**

### 2-A. 🔴🔴 국내 `EXACT` 0 의 원인 = **색상 «미확인»** (MI 가 엄격해서가 아니다)

국내 버킷 5건이 **전부** 같은 모양이다:
```
verdict **SIMILAR** · modelCode **exact** · colorUnverified **true** → tier COMPARISON
```
🔴 그리고 후보 `colorText` 가 **전건 `null`** 이다 — **불일치가 아니라 추출 실패** 다
(biskuit · mustit · littleluna · miniboutique · donokids 전부 null).

```
⟹ 원인은 「국내 후보 페이지가 색상을 구조화해 노출하지 않는다」 이고
   **MI threshold · SAME 조건과 무관** 하다. 품번은 **맞는다**(전건 `exact`).
```

### 2-B. 🔴 시장 판정 — KR 증거가 **`.kr` TLD + 등록부 둘뿐** 이다

```
C08 m.luxboy.com  C21 C22 C43 donokids.com  — KRW 가격이 있는 한국 쇼핑몰인데
  `.kr` 이 아니고 등록부에도 없다 → `KRW_WITHOUT_DOMAIN_EVIDENCE` → **UNKNOWN**
  → WU-051 가드가 「KRW 는 해외 참고가격에 넣지 않는다」로 **양쪽 축에서 뺀다**
🟢 그 가드는 옳다 — 「🌐 해외 참고가격」에 `KRW 88,000` 이 뜨던 결함을 고친 것이다
```

### 2-C. 가격 증거 — **beaumonde 하나** (WU-061 에서 이미 확정)

---

## 3. 전수 데이터

### 3-A. Step2 — 해외 vs 국내 단계별 통과율

| 단계 | 국내(17) | 해외(34) | 판정 |
|---|---|---|---|
| C) 상품페이지 판별 | **17/17** | 34/34 | 🟢 차이 없음 |
| HTML 확보 | **17/17** | 34/34 | 🟢 차이 없음 |
| D) 가격 증거 | **15/17** | 34/34 | 🟢 거의 같다(실패 2 = beaumonde) |
| E) `VERIFIED_CURRENT` | **15/17** | 34/34 | 🟢 downstream 되돌림 **0**(WU-055 유지) |
| B) market 확정 | 11/17 | 13/34 | 🟡 양쪽 다 UNKNOWN 이 많다 |
| F) tier **EXACT** | **1/17** | **11/34** | 🔴🔴 **여기서 갈린다** |
| F) tier EXACT\|COMPARISON | 15/17 | 26/34 | 🟢 |

🔴🔴 **A) 후보 발견 · C) 상품페이지 · D) 가격 증거 · E) priceStatus 는 국내가 약하지 않다.**
갈리는 곳은 **F) identity(tier)** 와 **B) market** 둘이다.

### 3-B. Step5 — 국내 버킷 5건의 blocker 전수

| | human | domain | verdict | code | colorUnv | blockers |
|---|---|---|---|---|---|---|
| C07 | SAME | biskuit.kr | SIMILAR | exact | **true** | `BRAND_MISMATCH+NO_TITLE_OVERLAP` |
| C15 | SAME | mustit | SIMILAR | exact | **true** | `NO_TITLE_OVERLAP+BRAND_UNCONFIRMED` |
| C23 | **DIFFERENT** | littleluna.co.kr | SIMILAR | exact | **true** | **(없음)** |
| C24 | **DIFFERENT** | miniboutique.co.kr | SIMILAR | exact | **true** | **(없음)** |
| C47 | SAME | biskuit.kr | SIMILAR | exact | **true** | `NO_TITLE_OVERLAP+BRAND_UNCONFIRMED` |

🔴 **C23·C24 는 blockers 가 비어 있고 품번이 exact 다** — 색상 축이 **유일한** 방어다.

---

## 4. Step6 — 개선안 Counterfactual (전수)

### CF-4 색상 blocker 완화 → 🔴🔴 **순손실** (내 예측이 반증됐다)

```
🔴 내 예측: 5건 승격(SAME 3 + DIFFERENT 2)
🟢 측정   : **2건만 승격 — 둘 다 Human DIFFERENT**(C23 · C24)
   C07·C15·C47(Human SAME)은 `NO_TITLE_OVERLAP`/`BRAND_MISMATCH` 가
   `hasObservedDifference` 에 걸려 **색상과 무관하게** 막힌다
⟹ Recall 회복 **0** · **False EXACT +2** · precision 11/12 → **11/14 = 78.6%**
⟹ 🔴 **기각.** 교환이 아니라 순손실이다.
```

### CF-2 KR 증거 확대 → 🔴 **같은 샵 안에서 갈린다**

페이지 단위 KR 신호(사업자등록번호 · 통신판매업 신고 · `lang="ko"`)를 실측했다:

```
🟢 정밀도는 좋다 — **해외 후보 34건에서 오탐 0건**
🔴 그러나 **같은 샵 안에서 불안정하다**:
     donokids.com  C21 ✓(사업자등록·통신판매)  C22 ✓  **C43 ✗(세 신호 전부 없음)**
     m.luxboy.com  C08 ✓(세 신호 전부)
⟹ 같은 샵의 후보가 KR / UNKNOWN 으로 **갈린다** — 집계가 **페이지 운** 에 좌우된다
⟹ 🔴 **채택하지 않았다.** 안정적인 UNKNOWN 이 흔들리는 KR 보다 낫다.
🔴 그리고 Registry 확대로 푸는 것은 §12 금지다.
```

### CF-1 가격 evidence 완화 · CF-3 product-page 완화 · CF-5 tier 승격 변경

```
CF-1  🔴 해당 없음 — 국내 가격 회수가 **15/17** 이고 실패 2건은 **구조화 데이터 0**(§2-C)
      meta 3층 추가는 WU-061 이 이미 기각(증분 0 · 불일치 8.3%)
CF-3  🔴 해당 없음 — 상품페이지 판별 **17/17 통과**. 병목이 아니다
CF-5  🔴 기각 — `COMPARISON → EXACT` 승격은 정의상 False SAME 을 만든다
```

🔴🔴 **다섯 개선안 중 안전한 것이 «하나도 없다».** 전부 측정으로 기각됐다.

---

## 5~6. 변경 파일 / 변경 내용

```
운영 코드 변경  **0**
테스트          wu-063-domestic-chain.test.ts **7건** 신규 (체인 전수 + CF + 통화 가드)
삭제            측정 전용 스크래치 1개
```

🔴 CPO STOP 조건에 정확히 해당한다 — 「국내 가격을 늘리려면 MI 를 완화해야 함 /
False SAME 증가 / generic parser 필요 / `fixedPrice` 필요」가 **전부 발생** 했다.
그래서 **완화하지 않고 원인을 증명하고 종료** 한다.

---

## 7~8. KPI — 변경 전/후

```
변경 전 = 변경 후  (운영 코드를 바꾸지 않았다)
GT Precision  11/12 = **91.7%**        GT Recall  11/27 = **40.7%**
False SAME    **1**(C06 · WU-060 에서 「텍스트로 막을 수 없음」 확정)
국내 EXACT 0 · COMPARISON 5 · REFERENCE 0 · EXCLUDED 2(금액 버킷 밖)
🔴 CF-4 를 적용했다면 precision 91.7% → **78.6%**, recall **불변** 이었다
```

---

## 9. C13/C27 처리 결과

```
🔴 **HOLD 유지**(CPO 판정). 이번 WU 가 추가로 확인한 것:
  · `classifyCandidateMarket` 이 둘을 **UNKNOWN** 으로 낸다 — 🟢 `.kr` 인데도 그렇다.
    이유는 **통화가 없어서** 다(`NO_PRICE_EVIDENCE` · 설계된 ①번 분기).
  · ⟹ 가격만 생기면 **자동으로 KR 이 된다**. 시장 판정은 별도 작업이 아니다.
🔴 beaumonde 전용 파서 · `fixedPrice` · generic 숫자 파서 **전부 만들지 않았다**.
```

---

## 10. 해외 회귀

```
🟢 WU-049 · WU-056 · WU-056-R1 · WU-062 계약 **전건 유지**
🟢 해외 금액 집계에서 `EXCLUDED` 제외(WU-062) 유지 · 「동일상품 아님」 표시 유지
🟢 해외 구역 안 원화 혼입 **0** · 해외 EXACT 11건 불변
🟢 그리고 **KRW 를 내는 해외 도메인**(`junioredition.com/en-kr` C26·C33)이
   「해외 참고가격」에 들어가지 않는 것도 계약으로 고정했다 — `DROP_KRW_NO_KR_EVIDENCE`
```

---

## 11. Mutation (CPO §15)

baseline **40 passed** · 변형마다 원상복구

| | 변형 | 결과 |
|---|---|---|
| M1 | 국내 price evidence 제거 | 🔴 **1 failed** |
| M2 | `USD` 도 KR 통화로 인정 | 🟡 **40 passed** |
| M2b | `.kr` + 외화를 **KR** 로(충돌 제거) | 🔴 **1 failed** |
| M2c | **통화 단독** 으로 KR 결정 | 🔴 **6 failed** |
| M3 | MI `SAME → STRONG_IDENTIFIER` 승격 제거 | 🔴 **2 failed** |
| M4 | `EXCLUDED` 를 금액 집계에 재주입 | 🔴 **3 failed** |
| M5 | `priceSource` detail → search | 🔴 **1 failed** |
| — | 원상복구 | 🟢 **40 passed** |

🟡 **M2 가 통과한 것은 가드 공백이 아니라 «약한 변이» 였다** — `USD` 를 KRW 분기에
넣어도 그 안에서 `krTld`·등록부가 둘 다 false 라 결국 **같은 UNKNOWN** 이 나온다.
🟢 그래서 실제 가드를 겨냥한 **M2b·M2c** 로 다시 쟀고 둘 다 FAIL 했다.
🔴 **「통과했다」를 「가드가 없다」로 적지 않는다** — 변이가 동작을 바꿨는지 먼저 본다.

🔴 **M6(listing → product 강제 분류)은 이 표본으로 측정할 수 없다** — GT 51 이
**전건 `PRODUCT_PAGE`** 라 변이를 넣어도 바뀌는 행이 없다. 🔴 「PASS」로 적지 않고
**측정 불가** 로 적는다(기존 WU-052/054 계약이 그 축을 따로 들고 있다).

---

## 12~13. Regression / Typecheck / Build

```
회귀      apps/admin  **570 files / 8,251 passed** / failed 0 (skipped 94)
typecheck **0 errors**
build     **exit 0**
```

---

## 14. Production

```
🔴 운영 코드 변경 **0** ⟹ UI 변경 **0** ⟹ Production 거동이 바뀌지 않는다
smoke  / 200 · /pipeline 307 · /today 307 · POST /check 401
외부 API 0 · 외부 HTTP 0 · 키 0 · 결제 **₩0** · Gemini 잔액 ₩3,171 보존
```

---

## 15. 🔴 Known Unknowns

```
① 🔴 **분모 17**(국내/한국계) · GT 51 · 원상품 호스트 2개. 전수 498 값이 아니다
② 🔴 **국내 후보 색상 추출이 왜 전건 실패하는지** 는 사이트별로 조사하지 않았다 —
   「JSON-LD 에 color 가 없다」인지 「있는데 우리가 안 읽는다」인지 **미확정**
③ 🔴 CF-2 의 페이지 단위 불안정이 **donokids 하나의 성질** 인지 일반적인지 미측정(N=1 샵)
④ 🔴 사업자등록번호/통신판매신고를 KR 증거로 쓸 때의 **법적/정책적 적절성** 미검토
⑤ 🔴 M6(listing 오분류) 은 **측정 불가** — 표본이 전건 PRODUCT_PAGE 다
⑥ 🔴 실제 운영 Case A(국내 EXACT 가 나와야 하는 상품)를 **찾지 못했다** — GT 17건 중
   국내 EXACT 자격(품번+색상 둘 다 확인)을 갖춘 후보가 **0** 이다
```

🔴 ⑥이 CPO §14 Case A 에 대한 정직한 답이다 — **합성하지 않았다.**

---

## 16. CEO Action

**없음.** 운영 코드·UI 변경이 **0** 이므로 Production 테스트를 요청하지 않는다.

---

## 17. 최종 판정 — 🔴 **HOLD** (완화 불가를 증명하고 종료)

```
🔴 국내 가격 비교를 지금보다 넓히는 **안전한 변경이 존재하지 않는다**. 다섯 개선안이
   전부 측정으로 기각됐고, 그중 둘(CF-4 · CF-2)은 **적용하면 더 나빠진다**.
🟢 그러나 이 WU 가 **처방을 바꿨다** — 다음 작업은 「가격 추출기」가 아니라 둘이다:
   ① **국내 후보의 색상 증거 회수**(EXACT 0 의 직접 원인 · §15-② 선행 조사 필요)
   ② **안정적인 KR 시장 증거**(페이지 단위가 아니라 **샵 단위** 로 결정해야 한다)
🔴 둘 다 **새 데이터 수집이 선행** 이고, 지금 코드로 열면 precision 을 깎는다.
```

### 🔴 CPO 판정 요청 — 2건

| | 안건 | CTO 권고 |
|---|---|---|
| ① | **국내 색상 증거 조사 WU** 를 열 것인가 | 🟡 **권고** — EXACT 0 의 직접 원인이고 완화가 아니라 **증거 수집** 이다 |
| ② | **샵 단위 KR 시장 증거** 를 설계할 것인가 | 🟡 조건부 — 🔴 Registry 확대와 경계가 겹치므로 CPO 가 선을 그어야 한다 |
