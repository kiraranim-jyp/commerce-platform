# 🔵 LONG-SPRINT BASELINE — **PHASE 0 산출물**(CTO · 2026-11-05)

> 🔴 CPO 지시: 「PHASE 0 은 **짧게 끝낸다**. 문서 정리 자체가 별도 장기 작업이 되어서는 안 된다.」
> 🔴 운영 코드 변경 **0** · DB 쓰기 **0** · 네트워크 **0**(DB 읽기 + 코드 읽기만).
> 🔴 **과거 조사를 다시 하지 않았다** — 기존 문서를 읽고 **현재 코드·DB 로 대조** 했다.

---

## 1. 현재 상태

```
HEAD        94327ee9  docs(STANDARD-V1 §14): 1차 집행 A·C·B
origin/main 0 ahead / 0 behind      작업트리 clean
최상위 기준  docs/STANDARD-V1.md (CPO Standard v1.0 · §12 매핑 · §13 불일치 9 · §14 1차 집행)
좌표         docs/START-HERE.md §NEXT SESSION
기준선 자료   docs/STANDARD-V1-INPUT-CURRENT-BEHAVIOUR.md (현행 동작 174줄)
```

**직전 품질 기준선**(STAGE 7-6 시점 · 2026-11-04)
```
회귀      apps/admin  784 files / 10,127 passed / 0 failed
typecheck error TS 0        build exit 0
🟡 flaky 1건  n05-step4-payload-identity (쿠팡 payload · 단독 18 passed · 전체 재실행 0 failed)
```

---

## 2. 🔴🔴🔴 `a0b3c08` 상태 — **문서만 있고 구현은 0 이다**

```
a0b3c08f  2026-09-13  docs(GLOBAL-MARKET-LOCAL-CURRENCY-PROBE)
변경       docs/global-market-local-currency-probe.md  **+103줄 한 파일**
그 문서의 자칭 상태   「🔵 **미착수**」
main 에 포함        YES (ancestor)
```
⟹ 🔴 **CPO 지시의 「미완료라면 우선 해결한다」에 해당한다** — 구현은 **시작되지 않았다**.
🟢 그 문서가 **금지 사항과 완료 조건을 이미 적어 뒀다**(재조사 불필요):
```
❌ 환율로 현지 통화를 만들어 내기        ❌ 국가 → 통화 목록 하드코딩(§F 금지)
❌ 기존 EUR 관측 삭제·재계산            ❌ 배송하지 않는 시장에 프로브
❌ 원본 가격 건드리기(이 작업은 글로벌 시장 카드 전용)
완료 조건 — JP 가 실제 JPY 관측 · US 가 실제 USD 관측 · 없으면 `—` ·
          원본가 불변(Smallable FR €75 / Bobo ES €75 / Junior Edition £37) · **라이브 실측**
```

---

## 3. 🔴🔴🔴 **그 문서의 숫자 둘이 지금은 «사실이 아니다»** — PHASE 1 의 전제가 바뀐다

| 문서(2026-09-13) | **현재 DB 실측(2026-11-05)** |
|---|---|
| 「Smallable 45행 전부 EUR」 | 🔴 **248행 전부 EUR** — 행이 늘었다 |
| 「JPY 관측이 단 한 건도 없다」 | 🔴 **JPY 27행이 실재한다** — 단 **Smallable 이 아니다** |

```sql
-- Smallable 관측 전체
{ n: 248, with_market_country: **0**, currency: ["EUR"] }
```
🔴🔴 **그래서 문제가 한 단계 «앞» 에 있다.** 「시장별로 EUR 이 반환된다」가 아니라
**`market_country` 가 붙은 Smallable 관측이 DB 에 «한 행도 없다»** —
즉 문서의 표(🇫🇷€75 / 🇰🇷€73 / 🇺🇸€79 / 🇯🇵€81)에 해당하는 **시장 행 자체가 지금 없다.**
🔴 「시장별 EUR 을 현지통화로 바꾼다」로 착수하면 **고칠 대상이 없는 자리를 고치게 된다.**
🔵 **PHASE 1 의 첫 질문이 바뀐다** — 「Smallable 시장 관측이 **왜 저장되지 않는가**」.

**JPY 27행의 출처**(전수)
```
bobochoses.co.jp        market_country=JP   10행   10-14 ~ 10-22
louisemisha.com         market_country=FR    1행   10-08
www.junioredition.com   market_country=null 16행   09-10 ~ 09-28
```
🟢 **JPY 는 사이트가 스스로 통화를 선언하는 Shopify 경로에서 나온다**(문서 §3 의 Bobo 축).
🔴 Smallable(비-Shopify · `?currency=` 축)에서는 **0 행** 이다.

**전체 시장 관측 통화 분포**(`market_country` 있는 행)
```
EUR 537 · KRW 263 · GBP 224 · USD 121 · AUD 114 · JPY 11 · CAD 1
🔴 위 JPY 11 은 「market_country 가 있는」 JPY 다(전체 JPY 는 27) — 분모를 섞지 않는다
```

---

## 4. 현재 코드 좌표 — PHASE 1 이 손댈 자리

```
packages/crawler/src/source-currency-policy.ts
  SOURCE_CURRENCY_RULES = [ { hostSuffix: "smallable.com", currency: "EUR",
      method: "URL_QUERY_OVERRIDE", queryParam: "currency",
      country: { queryParam: "country", value: "FR" } } ]            ← **항목 하나**
  expectedCurrencyFor(url) → "EUR"

packages/crawler/src/smallable-market-probe.ts
  SMALLABLE_CANDIDATE_MARKET_COUNTRIES = ["FR","KR","US","JP"]       (:54)
  🔴 :284  if (reading.currency !== expectedCurrency) return null;
     ⟹ 네 시장 **전부 EUR 만 통과** 한다 · JPY/USD 응답은 **구조적으로 버려진다**
  🟢 그 검사는 **지워선 안 되는 가드** 다 — 주석이 「파라미터가 무시될 수 있으니 응답을
     반드시 다시 확인한다」라고 적는다(통화 오인 방지)

packages/crawler/src/shopify-market-probe.ts
  🟢 marketMayBeObserved(shopMeta, marketCode) (:124) — 배송 안 하는 시장에 프로브 금지
     🔴 Smallable 경로에는 **그에 해당하는 가드가 없다**(문서 §4 질문 2 가 그 자리다)
```

🔴 **그래서 설계 결정이 아직 열려 있다**(문서 §4 · CTO 가 고르지 않았다):
① 시장 → 통화 대응을 어디에 두는가(코드 하드코딩은 §F 금지) ·
② Smallable 이 유효 시장 목록을 선언하는가 · ③ 한국 행은 `₩` 인가 `€` 인가 ·
④ 기존 EUR 관측과 현지통화 관측이 공존할 때 화면이 무엇을 고르는가.

---

## 5. 🔴 PHASE 0 에서 «확인하지 않은» 것 — 측정불가/미확인으로 남긴다

```
⒜ 🔴 **라이브 재실측 0** — 문서 §3 의 `?currency=JPY&country=JP → JPY 13,365` 는
   **2026-09-13 값** 이다(약 2개월 전). 사이트가 그대로인지 **확인하지 않았다** ⟹
   🔵 PHASE 1 의 **첫 실행이 그 라이브 확인** 이다(HTTP 4~6회 · 과금 0)
⒝ 🔴 선행조건 ①②(Bobo ORIGIN_FX 연결 · Production 화면 확인)의 완료 여부를
   **이 세션에서 확인하지 않았다** — 🟡 단 Bobo `.co.jp` JPY 10행이 실재하므로
   ①은 **적어도 부분적으로 동작한다**(「완료」로 적지 않는다)
⒞ 🔴 Junior Edition £37 · Bobo ES €75 의 **원본가 불변 기준선을 재측정하지 않았다**
   (PHASE 1 완료 조건 4번이 그것을 요구한다 ⟹ 변경 «전» 에 찍어야 한다)
⒟ 🔴 PHASE 2~9 의 기준선은 이 문서에 **없다** — 각 PHASE 착수 시점에 그 PHASE 의
   분모를 따로 찍는다(기존 분모와 섞지 않는다)
```

---

## 6. 🔵 다음 실행 — **PHASE 1 착수 라인**(조사 없이 바로 들어간다)

```
① 라이브 확인 — Smallable 한 상품에 축 6개를 던진다(문서 §3 과 «같은» 조합)
   ?currency=EUR&country=JP / ?currency=JPY&country=JP / ?currency=JPY&country=KR /
   ?currency=USD&country=US / ?currency=KRW&country=KR / ?country=JP(통화 미지정)
   🔴 확인할 것 — 요청 통화가 **실제로 먹는가** · 금액이 국가별로 **실제 달라지는가** ·
      JPY 13,365 가 **지금도 같은가**(아니면 그 숫자를 인용하지 않는다)
② 🔴 그 다음에 「왜 Smallable 시장 관측이 0행인가」를 **코드 경로로** 추적한다
   (probe 호출부 → 저장부 · §3 이 그 질문을 새로 만들었다)
③ 설계 결정 넷(§4)에 **데이터로** 답한 뒤 구현한다 — 🔴 ③「한국 행은 ₩ 인가 €」는
   **제품 정책** 이라 CTO 가 고르지 않는다(CPO 보고 사안)
🔴 금지 재확인 — 환산으로 현지통화 만들기 · 국가→통화 하드코딩 · 기존 EUR 관측 삭제 ·
   배송 안 하는 시장 프로브 · **원본가격 건드리기**
```

🟢 재현 도구 — `packages/database/scripts/phase0-baseline.mjs` · `phase0-jpy.mjs`
(READ-ONLY · 네트워크 0 · 과금 0 · 위 §3 숫자를 그대로 다시 낸다)

---

## 7. PHASE 0 완료 선언 범위

```
🟢 완료   현재 상태·기준선 확보 · `a0b3c08` 상태 확정(**문서만 · 미착수**) ·
         🔴 그 문서 숫자 둘 정정(248행 전부 EUR · Smallable 시장행 **0**) ·
         JPY 27행 출처 확정 · PHASE 1 코드 좌표 특정 · 착수 라인 고정
🔴 미완   라이브 재실측 · 선행조건 ①② 확인 · 원본가 불변 기준선 · PHASE 2~9 분모
🔴 **PHASE 0 을 「문제 해결」로 적지 않는다** — 출발점을 정확히 세운 것이 전부다
```
