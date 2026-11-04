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

---
---

# 🔵 PHASE 1 — 실측 결과와 **원인 확정**(2026-11-05 · 운영 코드 변경 0)

## 1. 🔴🔴 먼저 — **PHASE 0 의 내 서술을 정정한다**

> PHASE 0 §3 이 「`market_country` 가 붙은 Smallable 관측이 **한 행도 없다** ⟹ 시장 행
> 자체가 지금 없다」고 적었다. 🔴 **그 두 번째 문장이 틀렸다.**

```
Smallable 관측 248행 = **4시장 × 62행** (DB 실측)
  market_code=fr  EUR 50~159      market_code=kr  EUR 49~155
  market_code=us  EUR 53~167      market_code=jp  EUR 54~172
  market_country  **전건 null**           last_checked  2026-10-29
```
⟹ 🟢 **시장 관측은 정상적으로 생성·저장되고 있다.** `market_code` 가 네 시장 전부 들어가고
**금액도 시장별로 실제 다르다**(49 / 50 / 53 / 54 — 문서 §3 의 73/75/79/81 과 같은 순서).
🔴 비어 있는 것은 **`market_country` 칸 하나** 와 **`currency` 가 전건 EUR** 이라는 것이다.

---

## 2. 🟢🟢 라이브 실측 — **요청 통화가 실제로 먹는다**

🔴 **raw `node:https` 로는 6조합 전건 403 이었다.** 그것을 「사이트가 막는다」로 단정하지
않고(WU-105 교훈) **운영 fetch 경로**(`fetchPlainHtmlWithFinalUrl` + Chrome UA)로 다시 쟀다.

| 요청 | **실측(2026-11-05)** | 문서(2026-09-13) |
|---|---|---|
| `?currency=EUR&country=JP` | **EUR 54** | EUR 81 |
| `?currency=JPY&country=JP` | 🟢🟢 **JPY 10,078** | JPY 13,365 |
| `?currency=JPY&country=KR` | **JPY 9,145** | JPY 12,045 |
| `?currency=USD&country=US` | 🟢 **USD 62** | USD 91 |
| `?currency=KRW&country=KR` | 🟢 **KRW 82,673** | KRW 114,464 |
| `?country=JP`(통화 미지정) | 🔴 **KRW 91,108** | KRW 127,008 |

```
🟢🟢 통화 **4종**(EUR · JPY · USD · KRW)이 모두 돌아온다 ⟹ **현지통화 관측이 가능하다**
🔴 금액이 문서와 다른 이유는 **상품이 다르다** — 문서는 430701/430651, 이번은 **430753**
   ⟹ 🔴 「JPY 13,365 가 유지되는가」는 **다른 상품이라 비교할 수 없다**(그 값을 인용하지 않는다)
🟢 **구조적 결론은 그대로 유지된다** — 통화를 주지 않으면 **egress 가 국가를 정한다**
   (문서 「KRW 127,008」 ↔ 이번 「KRW 91,108」 · 둘 다 한국 egress 의 결과)
🟡 `?currency=JPY&country=KR` → JPY 9,145 는 **한국 가격을 엔화로 쓴 것** 이고
   **일본 가격이 아니다**(문서 §3 의 그 경고가 지금도 유효하다)
```

---

## 3. 🔴🔴🔴 원인 **완전 확정** — 둘이고 서로 다른 자리다

**운영 probe 반환**(`probeSmallableMarkets` · 실측 4건)
```json
{"marketCode":"fr","amount":50,"currency":"EUR","sourceUrl":"…?currency=EUR&country=FR",
 "shopMeta":null,"regularPrice":null,"available":true}
반환 칸 — marketCode · amount · currency · sourceUrl · **shopMeta** · regularPrice · available
```

| # | 증상 | 원인(코드 좌표) |
|---|---|---|
| ① | `market_country` **전건 null** | 🔴 probe 반환에 **country 칸이 없다**. 저장부 `run-price-check.ts:137·218` 이 **`probe.shopMeta?.country` 만** 본다 ⟹ Smallable 은 Shopify 가 아니라 **`shopMeta: null`**(실측) ⟹ 언제나 null |
| ② | `currency` **전건 EUR** | 🔴 `source-currency-policy.ts` `SOURCE_CURRENCY_RULES` 가 smallable 에 `currency:"EUR"` 를 강제하고, probe 가 **그 통화로만 요청** 한다. `:284` 가드는 **응답 통화가 요청 통화와 같은지** 확인하는 것이고 **정상 동작** 이다(🔴 지우지 않는다) |

🟢 ①과 ②는 **독립** 이다 — ①은 통화를 바꾸지 않고도 닫을 수 있다.

---

## 4. 🔵🔵 그래서 **정책 충돌 1건** — 지시서 §11 에 따라 멈추고 보고한다

### ① `market_country` 채우기 — 🟢 **정책 충돌 없다. 구현 가능하다.**
```
🟢 probe 가 `?country=XX` 를 **스스로 요청** 했으므로 그 국가는 **관측된 사실** 이다
   (시장을 통화·URL·판매처에서 **역추론하는 것이 아니다** — run-price-check:73 금지 조항 준수)
🟢 그리고 응답이 그 국가를 **확인해 주는지 검증할 함수가 이미 있다** —
   `readSmallableRequestedCountry(html)`(smallable-market-probe.ts:186)
🔵 설계 — probe 반환에 `marketCountry` 를 더하고(요청 국가 · 응답으로 **검증된 경우만**)
   저장부가 `probe.shopMeta?.country ?? probe.marketCountry` 를 쓴다
   🔴 Shopify 경로는 **그대로** 다(`shopMeta` 가 먼저) · 🔴 검증 실패면 **null**(추정 금지)
```

### ② 현지통화 관측 — 🔴🔴 **CPO 정책 결정이 선행한다**
```
🔴 Smallable 은 통화를 **스스로 선언하지 않는다** — 요청한 통화를 **되돌려 준다**(실측 4종).
🔴 통화를 주지 않으면 **egress 가 정한다**(KRW 91,108) ⟹ 「사이트가 정하게 두기」는 **불가**.
⟹ 🔴🔴 현지통화 관측에는 **「시장 → 통화」 대응을 우리가 정하는 것** 이 반드시 필요하다.
   그런데 그것은 `GLOBAL-SOURCE-PRICE-POLICY-FINAL` **§F 가 금지한 하드코딩** 이다
   (문서 §4 질문 1 이 적어 둔 바로 그 자리).

🔵 **CPO 결정이 필요한 것 — 셋 중 하나다**
   ⒜ §F 를 **열고** 시장→통화 대응표를 둔다(어디에? 코드 / 등록부 / 사이트별 규칙 파일)
   ⒝ **현지통화 관측을 포기** 하고 Smallable 은 EUR 단일 통화로 둔다
      (그러면 완료 조건 1·2 「JP 가 실제 JPY」는 **달성 불가** 로 남는다)
   ⒞ Shopify 처럼 **사이트가 통화를 선언하는 판매처에서만** 현지통화를 쓴다
      (🟢 그 경로는 **이미 동작한다** — `bobochoses.co.jp` JPY 10행이 그 증거다)
🔴 CTO 는 셋 중 **아무것도 고르지 않았다.** 환산으로 만들지 않았고, 하드코딩하지 않았다.
```

🔴 **그리고 한국 행 표기**(문서 §4 질문 3)도 그대로 열려 있다 — CPO 의 이번 정책은
「한국 시장 비교에는 **실제 확인된 KRW 만**」이고 「한국 배송에서 EUR 가 오면 **EUR 그대로
보존**」이다 ⟹ 🟢 그 둘은 **②가 닫히기 전에도 지킬 수 있다**(EUR 49 를 KRW 로 바꾸지 않는다).

---

## 5. 🔵 다음 세션 착수 라인 — 조사 없이 구현부터

```
① 🟢 **`market_country` 구현**(정책 충돌 0) — §4-① 설계 그대로
   probe 반환 `marketCountry` 추가 → 저장부 폴백 한 줄 → 계약 + 음성대조 + 회귀 + 배포
   🔴 `shopMeta` 우선순위 불변 · 🔴 검증 실패 시 null · 🔴 역추론 금지
   🟢 효과 — Smallable 248행이 다음 관측부터 **국가를 갖는다**(기존 행은 **고치지 않는다**)
② 🔵 **②는 CPO 결정 대기** — 그 전에는 `currency` 를 건드리지 않는다
③ 그 뒤 PHASE 2(국내) → PHASE 3(해외) → … 지시서 순서대로
```

🟢 재현 도구(커밋됨) — `packages/crawler/src/__tests__/phase1-smallable-live.test.ts`
(`PHASE1_LIVE=1` · 운영 fetch 경로 · 과금 0) · `packages/database/scripts/phase1-smallable.mjs`
(READ-ONLY · 위 §1 분포를 다시 낸다) · `phase1-live-probe.mjs`(🔴 raw fetch 403 재현용)

🔴 **PHASE 1 을 완료로 적지 않는다** — ①은 구현 전이고 ②는 정책 대기다.
