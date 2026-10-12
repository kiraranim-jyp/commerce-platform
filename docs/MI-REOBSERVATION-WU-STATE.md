# MI Re-observation → Market Change Intelligence Value WU

> 🟢 **종료.** 최종 판정은 §8 다 — **GO CANDIDATE (조건부)**.
> 🔴 **Production 변경 0.** cron 을 만들지 않았다(§9). GO 가 나와도 구현은 별 WU 다.
> 🔴 §10 `Historical Data Integrity Risk` 는 재관측 가치와 **합산하지 않았다.**

---

## 1. STEP 0 §5-B Preflight — 새로 확인한 것만 (지난 WU owner 는 재조사 안 함)

| 축 | owner | 실측 |
|---|---|---|
| 재관측 실행 | `runPriceCheck` `run-price-check.ts:236` | ✓ |
| 🔴 **멱등성** | `hasObservationToday(snapshotId, source)` `:242` | **하루 1회**로 묶는다 |
| 시장 멱등성 | `getObservedMarketKeysToday` `:347` | snapshot+source+market+날짜 |
| 일괄 실행 | `bulkRecheck` `today/page.tsx:156` | 동시성 **3** |
| 추가 시장 probe | `probeAdditionalMarkes(sourceUrl, ["", "en-kr"])` `:341` | 기본 **2시장** |
| 자동 스케줄 | 🔴 **없다** — `apps/admin/vercel.json` 에 `crons` 없음 | 재확인 |

### 🔴🔴 이 WU 가 새로 찾은 **구조적 상한** 둘

```
① 시계열 해상도의 상한이 「일」 이다
   `hasObservationToday` 가 (snapshot, source, 날짜) 로 멱등을 잡는다.
   → 🔴 하루에 여러 번 눌러도 1행이다. **「매시간 감시」는 현재 구조로 불가능** 하다.
   🔴 cron 주기를 하루보다 짧게 잡는 것은 **의미가 없다**(코드가 버린다).

② `bulkRecheck` 가 `status !== "REGISTERED"` 로 **등록 상품을 제외** 한다
   🔴 단 **지금은 영향이 없다** — 실측으로 내 가설이 반증됐다:
      IN_PROGRESS 464건 평균 관측일 **1.35** · REGISTERED 33건 평균 **1.36**
   🟢 거의 같다. 제외 때문에 등록 상품이 덜 관측된 증거가 **없다.**
   🔴 그러나 등록 상품이 늘면 이 제외가 «판매 중인 상품을 감시하지 않는» 구조가
      된다 — 지금 숫자로는 측정불가. CPO 가 알아야 할 설계 사실로만 기록한다.
```

---

## 2. STEP 1 — 관측 간격별 변화 검출력 (FULL POPULATION n=400)

🟢 지난 WU baseline 을 그대로 쓴다(재측정 금지):
```
1일 304건 → **0.0%**    2일 37건 → 21.6%
3일  16건 → 50.0%        4일+ 40건 → **65.0%**
```
🔴 1일뿐인 304건의 0 은 **구조적 측정불가** 다. 「가격이 안 변한다」가 아니다.

### 실제 재관측 실행 이력 (실측)

```
체크가 일어난 (스냅샷 × 날짜) 쌍   **673**
서로 다른 상품 400 · 서로 다른 날 **41**  (2026-08-23 ~ 2026-10-10)
→ 41일 동안 상품 400개에 673회 = 🔴 **상품당 1.68회** 다
평균 행/회  SELLER_ORIGIN 2.20 · DOMESTIC_SHOP 1.58  (최대 9)
```

---

## 3. STEP 5 — Before/After 반사실 (핵심)

**Before** = 그 상품의 **첫 관측일** 행만 · **After** = 실제로 쌓인 전체.
두 입력을 **같은 운영 owner** 에 넣어 비교했다. 🔴 새 HTTP 0 — 과거 관측의 재분할이다.

```
분모(재관측이 실제로 있었던 상품)   **94/400**
🔴 1일뿐이라 반사실을 못 만드는 상품  306  (측정불가, 0% 가 아니다)

verdict (합 94 = 분모, 정합성 확인)
  NO_NEW_INFORMATION   **52**
  PRICE_CHANGE         **33**
  FALSE_SIGNAL          **8**
  ACTIONABLE_SIGNAL     **1**
  AVAILABILITY_CHANGE    0   🔴 측정불가 (§4 참조)
  NEW_MARKET_SIGNAL      0

🟢 새 신호가 생긴 상품 **42/94 (45%)**
🔴 신호가 «사라진» 상품 3 — 재관측은 정보를 **지우기도** 한다
   (전부 Lulu T Bar: 「국내 경쟁가격 하락」이 빠지고 「시장 가격 상승」으로 바뀐다)
🟢 Before 에 없던 opportunity 가 생긴 상품 **1**

새로 생긴 신호 종류
  해외 원가 하락 23 · 해외 원가 상승 19 · 시장 가격 상승 6 ·
  시장 가격 변동 3 · 가격 전략 재검토 2
```

### 🔴 priceLevel 을 고정했다 — 그래서 재지 «않은» 것

`computeSellerAction` 의 `priceLevel` 은 `status/title` 만 정하고 `signals[]` 를
만들지 않으므로 양쪽 동일하게 `YELLOW` 로 고정했다. 🔴 따라서 이 측정은
**status 변화를 재지 않는다.**

🔴🔴 그리고 `computeMarketAlert` 를 **부르지 않았다.** 그 함수는 판정을
`sellerAction.status` **하나로만** 한다(market-alert.ts L-6 주석). `priceLevel` 을
고정한 상태로 부르면 **전건 REVIEW** 가 나오고, 그것은 재관측이 만든 숫자가 아니라
**내 상수가 만든 숫자**다. 처음에 `as never` 캐스트로 불렀다가 발견했다.

---

## 4. STEP 2 — 변화 «품질» (정합성 42 = 7 + 1 + 34)

```
After 에 변화율 ≠ 0 인 상품        **42**
  🔴 환율 기인 (원통화 금액 동일)    **7**   ← 전부 ORIGIN_FX / USD
  🔴 혼재 시계열 (축이 다름)         **1**   ← 보보쇼즈 26FW, −1.72%
  🟢 단일 축 · 실제 가격 변동       **34**
→ 🟢 유효 비율 **34/42 = 81%** · 🔴 거짓 **8/42 = 19%**
```

🔴 혼재 시계열은 전체로는 **4건** 이고(Voyage · Lucy · Ginevra · 보보쇼즈) 그중
변화율 ≠ 0 인 것이 1건이다. 🔴 「혼재 4」와 「거짓 8」을 더하면 틀린다 — 집합이
분할이 아니다.

### 🔴 내 측정 결함 1건 — 보고 전 자가감사에서 잡았다

처음 계산은 `A.originChange` 존재만 보고 `fxOnly` 를 재서 **「환율 기인 58」 >
「변화 있는 상품 42」** 라는 **불가능한 숫자**를 냈다(변화가 «없는» 것을 환율
기인으로 셌다). 🟢 변화율 0 을 제외해 고쳤고 그래서 FALSE_SIGNAL 이 59 → 8 로 바뀌었다.
🔴 두 숫자를 교차검증하지 않았으면 **19배 과장된 거짓 비율**을 보고했을 것이다.

---

## 5. STEP 3 — Availability 🔴 **측정불가** (0% 가 아니다)

```
국내 품절 관측이 있는 상품  **0**
품절 전이(true↔false)      **0/400**
```

🔴🔴 **이유를 정확히 적는다** — `seller-action.ts:117` 의 `soldOutCount` 는
**`DOMESTIC_SHOP` 행만** 센다. 그런데 `DOMESTIC_SHOP` 279행 중 `sold_out=true` 가
**0행** 이다(false 166 · null 113).
→ 🔴 **「경쟁상품 품절」 신호는 구조적으로 발화할 수 없다.** 「국내에 품절이 없다」가
아니라 **국내 어댑터가 품절을 `true` 로 적은 적이 없다**는 뜻이다.

🟢 참고 — `SELLER_ORIGIN` 에는 `sold_out=true` 가 319행/66스냅샷 있고 그것은
**원가 선택**에 쓰인다(`market-intelligence.ts:216`). 즉 품절 데이터 자체는 있고
**국내 축에만 없다.**

🔴 그래서 RESTOCK 은 여전히 **측정불가** 다 — owner 도 없고 전이 데이터도 없다.

---

## 6. STEP 4 — Seller Action 연결 (전수)

```
After 에 signal 이 하나라도 있는 상품  **46/400**
signal 종류
  해외 원가 하락 23 · 해외 원가 상승 19 · 시장 가격 상승 14 ·
  시장 가격 변동 3 · 국내 경쟁가격 하락 3 · 가격 전략 재검토 2
opportunity   「가격 인하 기회」 **1** · null 399
```

🟢 즉 `signal → seller action` 연결은 **실제로 작동한다**(46건 산출).
🔴 단 그중 7건은 환율 기인이고 1건은 혼재 축이다.

---

## 7. STEP 7 — 비용 모델 (🔴 cron 을 만들지 않았다)

```
재관측 1회(1상품)  외부 요청 = 원산지 1 + 추가 시장 probe 2(`["", "en-kr"]`) +
                   국내 후보 N → 🔴 상품당 **최소 3회**, 기록 행 평균 2.20
일괄 실행          동시성 3 · 상품당 HTTP 왕복 1회(`/api/price-history/check`)
현재 실적          41일 / 673회 / 상품당 **1.68회**

전수 497 상품 기준 예상 실행 수
  매일        497회/일   · 월 **14,910**
  2일마다     249회/일   · 월 7,455
  3일마다     166회/일   · 월 4,970
  주 1회       71회/일   · 월 2,131
🔴 하루보다 짧은 주기는 **의미 없다** — `hasObservationToday` 가 버린다.

🔴 금액은 **측정불가** — 외부 API 요금 체계를 CTO 가 읽을 수 없다(토큰 없음).
🟢 산출 지표
  incremental information / product = 42 / 94 = **0.45**  (sample 재관측 94)
  actionable signal / product        =  1 / 94 = **0.011**
  🔴 1일뿐 306건을 분모에 넣으면 0.11 / 0.0025 — **분모를 섞지 않는다.**
```

---

## 8. STEP 8 — 자동화 GO Gate → **GO CANDIDATE (조건부)**

| 조건 | 실측 | 판정 |
|---|---|---|
| 재관측으로 실제 변화가 반복 발견 | 42/94 (45%) · 용량-반응 0→65% | 🟢 **충족** |
| False Signal 통제 | 거짓 8/42 (19%) — 환율 7 · 혼재 1 | 🟡 **조건부** |
| Seller Action 연결 | signal 46건 산출 · 연결 작동 | 🟢 **충족** |
| 기존 정보 대비 incremental | 0.45 info/product | 🟢 **충족** |
| 비용 수용 가능 | 월 2,131~14,910회 · 🔴 금액 측정불가 | 🟡 **조건부** |

🔴 **GO 가 아니라 GO CANDIDATE 다.** 두 조건이 조건부이고, 선행 조치 둘이 필요하다:

```
① 🔴 환율 기인 변화를 「가격 변화」로 내보내지 않는 것
   현재 `computePriceChange` 는 `priceKrw` 만 본다 → 원통화 금액이 같아도 변화가 난다.
   실측 7/42 (17%)가 그것이다. 재관측을 자동화하면 이 거짓 신호도 **같이 늘어난다.**
   🔴 단 이것을 「결함」으로 단정하지 않는다 — 셀러가 실제 지불하는 통화는 KRW 이므로
      «KRW 기준 원가가 올랐다» 는 참이다. 문제는 **문구가 「해외 비교가격」이라고
      말하는 것** 이다. → 제품 정책 경계 · CPO 판정.
② 🔴 혼재 시계열 4건 (§10)
```

🔴 **Availability 는 GO 근거에 넣지 않았다** — 측정불가다(국내 `sold_out=true` 0행).

---

## 9. Production 변경 — **0**
cron ✗ · 스케줄 ✗ · schema ✗ · 알림 정책 ✗ · threshold ✗ · 코드 ✗. DB 는 SELECT 만.

---

## 10. 🔴 Historical Data Integrity Risk (재관측 가치와 **합산하지 않았다**)

```
과거 혼재 스냅샷        **4**   (Voyage · Lucy · Ginevra · 보보쇼즈 26FW)
실제로 난 거짓 alert    **3**   (-39.11% · -36.27% · +3.76%)
현재 필터로 차단        **136/136**  (ORIGIN_FX·KR_MARKET 공존 전건)
```
🔴 그 4건은 `ORIGIN_FX` 라벨이 없어 `price-observations.ts:299` 가 명시한 대로
예전 동작이 유지된다. 🔴 **재관측을 자동화하면 그 4건에 새 행이 붙어 같은 거짓
신호가 다시 날 수 있다.** 별 과제 `Historical Alert Integrity` 로 분리한다.

---

## 11. 최종 보고 전 Numeric Gate

```
① 전수 vs 표본
   🟢 전수 — 스냅샷 400 · 관측 1755행 · 체크 673회 · 혼재 4 · 차단 136/136
   🔴 표본 — Before/After 는 `sample N=94`(재관측이 있었던 상품만)
           incremental 0.45 / actionable 0.011 도 **전부 N=94 기준**
   🔴 분모를 섞지 않았다. 306건(1일뿐)은 별도로 「측정불가」로 적었다
② 다음 단계 통과 여부
   🟢 변화 42 → 유효 34 → signal 42 → opportunity 1 까지 각 단계를 셌다
③ 0 / UNKNOWN / 측정불가
   🔴 Availability 0 · RESTOCK 0 · NEW_MARKET_SIGNAL 0 을 **성공도 실패도 아닌
      측정불가** 로 적었다. 1일 관측 304건의 0% 를 「가격이 안 변한다」로 쓰지 않았다
```

---

## 12. Known Unknowns

```
🔴 Before/After 는 sample N=94 다. 전수 400 으로 일반화 금지
🔴 금액 비용은 측정불가 — 외부 API 요금을 CTO 가 읽을 수 없다
🔴 Availability / RESTOCK / NEW_SELLER / NEW 는 전부 측정불가 (owner 또는 데이터 부재)
🔴 국내 `sold_out=true` 가 0행인 «이유» 는 미조사 — 어댑터가 안 적는지, 실제로
   품절이 없었는지 구분하지 않았다. 🔴 추측하지 않는다
🔴 status 변화(PRICE_KEEP↔ADJUST)는 priceLevel 고정 때문에 재지 않았다
🔴 `computeMarketAlert` 산출은 재지 않았다(상수가 결과를 만들어서)
🔴 환율 기인 7건이 「거짓」인지 「KRW 기준 참」인지는 **정책 판단** 이다. CTO 가
   단정하지 않았다
🔴 REGISTERED 제외의 미래 영향은 측정불가(현재 33건, 평균 관측일 차이 0.01일)
🔴 하루 1회 상한 때문에 「시간 단위 감시」의 가치는 **이 구조에서 측정 자체가 불가능**
```
