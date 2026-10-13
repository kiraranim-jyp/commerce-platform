# WU-020 `MI-CANDIDATE-PRICE-EVIDENCE` — 후보 가격 evidence · 시장 분리

> 🟢 **CPO 판정 2026-10-13 — CLOSED / PARTIAL.** 추가 구현은 하지 않는다.
>
> 🔴🔴 **이 WU 의 결과를 적는 «정확한 표현» 은 이것이고, 다른 말로 바꾸지 않는다**(CPO 확정):
> ```
> 공통 후보 가격 배선과 국내/해외 시장 분리 규칙은 **구현·검증 완료**.
> JSON-LD 기반 후보는 **추가 HTTP 없이** 가격 증거를 연결할 수 있다.
> TENNIS 해외처럼 **microdata-only 사이트의 가격은 현재 미지원.**
> ```
> 🔴 **「해외 가격이 완전히 해결됐다」로 기록하지 않는다.**
> 🔴 TENNIS 해외 microdata = **현재 알려진 범위의 제한사항으로 기록하고 종료.**
>    새 순수 parser 는 기술적으로 가능하고 비용도 거의 없지만 **공통 파이프라인을 닫는 데
>    반드시 필요한 작업이 아니다** — 여기서 extractor 범위를 늘리면 WU 가 끝없이 확장된다.
> 🔴 **해외 축을 UI 에 노출하거나 등록판정에 넣는 것도 지금 하지 않는다**(의도적 보류).
>    현재 목표는 가격 추적 서비스가 아니라 **「상품 → Gemini Global Discovery → MI 검증
>    → 시장 증거 → 초기 등록 판단」 공통 구조를 닫는 것** 이다.

> 🔴🔴 **Gemini 호출 0 · grounding 0 · credit ₩0 · ₩3,300 보존 · flag OFF · deploy 0 · main merge 0.**
> 🔴 **추가 HTTP 0 · Playwright 0 · 실제 URL 재접속 0** — 측정은 리포에 **이미 있는
> 캡처 fixture** 로만 했다. 🔴 DB schema 변경 **0** · 새 `source` 값 **0** · DB 쓰기 **0** ·
> Registry 0 · UI 0 · threshold 0 · P-32 0.
> 🟢 **판정: PARTIAL** — ①은 닫혔고 ②는 닫혔으나 **TENNIS 해외 가격 하나가 남았다**(원인 규명됨).

---

## 1. §12 결과 표

| Evidence | KIDS 국내 | KIDS 해외 | TENNIS 국내 | TENNIS 해외 |
|---|---|---|---|---|
| Candidate 존재 | 🟢 | 🟢 | 🔴 0 (scope 샵 1곳) | 🟢 |
| MI SAME/PRESUMED | 🟢 | 🟢 | ⚪ 분모 0 | 🟢 PRESUMED_SAME |
| **Price 추출** | 🟢 **4/4** (KRW) | 🟢 **8/8** (EUR) | ⚪ 분모 0 | 🔴 **0/1** |
| Currency 보존 | 🟢 KRW | 🟢 EUR | ⚪ | ⚪ 가격 0 |
| Market 구분 | 🟢 `KR` | 🟢 `OVERSEAS` | ⚪ | ⚪ |
| MI aggregation 연결 | 🟢 기존 국내 축에 **합쳐진다** | 🟢 **해외 축**(환산 0) | ⚪ | ⚪ |
| Final MI 영향 가능 | 🟢 | 🔴 **NO — 설계상 분리** | ⚪ | 🔴 |

🔴 **「KIDS 해외 → Final MI 🔴」를 결함으로 읽지 않는다.** 그것이 §5 의 요구(「해외 가격이
원가/국내 가격으로 오인되지 않아야 한다」)의 **구현** 이다 — 해외 축은 판매 판정·원가·마진
계산에 **들어가지 않는다.** 들어가면 M1/M2 mutation 이 FAIL 한다.

🔴 Price 추출 숫자의 분모는 **fixture** 다(아래 §3). 🔴 운영 Gemini 후보 표본이 아니다.

---

## 2. 무엇을 바꿨는가 — 운영 3파일 + 신규 1모듈

```
① packages/crawler/.../product-url-facts.ts   htmlPath 가 **이미 받아 둔 html** 로
     priceFromJsonLd(html) 을 부른다 → candidate.price · priceStatus
     🟢 `extractFromJsonLd`(product-data-extractor.ts:175)는 **HTML 문자열만 받는
        순수 함수** 이고 운영 원상품 경로가 이미 그것을 쓴다 → **새 추출기 0**
     🔴 fetch 호출 수는 **그대로 1회** 다(테스트가 잠근다)
② apps/admin/.../candidate-market.ts (신규)   classifyCandidateMarket(순수) +
     summarizeCandidateOverseasPrices(순수)
③ run-domestic-price-check.ts   evidence 에 `market` · `basis` 를 **같이** 싣는다
     🔴 등록부 집합은 scope 필터 «전» 목록으로 만든다(충돌을 놓치지 않기 위해)
④ market-intelligence.ts   국내 축 진입 조건에 **`market === "KR"`** 를 추가하고
     그 외 «가격 있는» 후보를 **해외 축** 으로 모아 집계해 반환한다
```

🔴 **`universalExtract` 를 후보 경로에서 부르지 않았다**(§1 금지). 소스 단언으로 잠갔다.

---

## 3. 🟢 측정 — 실제 캡처 HTML 20건 (추가 HTTP 0)

```
fixture 전수            **20**
🟢 JSON-LD 가격 획득     **12**
🔴 미획득                 8
통화     KRW **4** · EUR **8**
시장     KR / KR_TLD_AND_KRW **4**
         OVERSEAS / FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE **8**
```

| fixture(대표) | host | 가격 | 시장 | 근거 |
|---|---|---|---|---|
| `littleluna-product-4117~4120-head` | `littleluna.co.kr` | **113,000 / 117,000 KRW** | 🟢 **KR** | `KR_TLD_AND_KRW` |
| `smallable-430632/430651/430700/430701/430705` (8건) | `smallable.com` | **44~75 EUR** | 🟢 **OVERSEAS** | `FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE` |
| `tennis-warehouse-magro-offers` | `tennis-warehouse.com` | 🔴 **없음** | UNKNOWN | `NO_PRICE_EVIDENCE` |
| 목록/검색/부분 캡처 8건 | 🔴 host 미해석 | — | — | `UNRESOLVED_HOST` |

🔴 **해석 한계**: 이 fixture 들은 **다른 WU 가 다른 목적으로** 캡처한 것이고 Gemini 후보
표본이 아니다. 🔴 그래서 **12/20 = 60%** 를 「Gemini 후보 가격 획득률」로 쓰지 않는다.
🔴 8건 중 상당수는 **상품 상세가 아닌 목록/검색 캡처** 거나 `-head.html`(head 만) 이다.

### 🔴🔴 TENNIS 해외가 0 인 **이유가 규명됐다** — 추측이 아니다

```
tennis-warehouse-magro-offers.html
  application/ld+json          **0개**   → JSON-LD 경로로는 구조적으로 0 이다
  og:price / product:price     **0개**   → extractFromOpenGraph(순수)도 못 읽는다
  🟢 가격은 **microdata** 에 있다 — `itemprop="price" content="120.00"` ·
     `itemprop="priceCurrency" content="US…"`  (즉 페이지에는 **있다**)
🔴 그런데 기존 microdata 추출기 `extractFromMicrodata(page: Page)`(:476)는
   `page.evaluate()` 를 쓰는 **Playwright 의존** 함수다 — **순수 함수가 아니다.**
   → §1 의 「Playwright 0 · universalExtract 호출 0」과 **정면 충돌** 한다.
🔴 그래서 **새 microdata 파서를 만들지 않았다**(§0 「새 추출기를 만드는 것이 아니다」).
```

🟢 **다음 레버가 하나 보이고 비용이 0 이다** — 「microdata(`itemprop`)를 **순수 함수로**
읽는 작은 파서」. HTML 은 이미 받아 뒀으므로 **추가 HTTP 0 · Playwright 0** 이다.
🔴 다만 그것은 **새 추출기** 이므로 CPO 승인 사안이다. 이 WU 에서 하지 않았다.

---

## 4. §4 — 시장 분류 (증거가 «일치» 할 때만 단정)

```
                     currency KRW      currency 외화          currency 없음
.kr TLD              🟢 KR             🔴 UNKNOWN(충돌)       🔴 UNKNOWN
등록부 샵             🟢 KR             🔴 UNKNOWN(충돌)       🔴 UNKNOWN
증거 없음             🔴 UNKNOWN        🟢 OVERSEAS            🔴 UNKNOWN
```

🔴 **등록부 소속은 「시장 증거」가 아니다** — WU-019R 실측이 반증했다(`bobochoses.com` 이
국내 등록부 「Bobo Choses Korea(공식)」인데 가격이 **EUR**). 그래서 이 파일에서 등록부는
**충돌 감지에만** 쓰인다.
🔴 **통화 단독으로 결정하지 않는다** — KRW 인데 도메인 증거가 없으면 `UNKNOWN`
(`KRW_WITHOUT_DOMAIN_EVIDENCE`). 실측 예: `tinyapple.net`.
🔴 **가격(통화)이 없으면 시장을 판정하지 않는다** — 귀속시킬 것이 없다.

---

## 5. §8 다섯 케이스 — 🟢 **실제 집계기로** 확인했다

`summarizeDomesticMarketSplit`(운영 owner)을 직접 불러 **금액으로** 단언했다.

| CASE | 내용 | 결과 |
|---|---|---|
| 1 | 국내 KRW 후보 | 🟢 기존 국내 축에 합쳐진다 — `sellerCount 2→3` · 최저가 198,000 → **150,000** |
| 2 | 해외 EUR 후보 | 🟢 국내 숫자 **불변**(sellerCount·최저가 동일) · 🟢 해외 축에 `EUR {count:1, lowest:100}` 로 **남는다** |
| **3** | **등록부 + EUR (Bobo)** | 🟢 `market=UNKNOWN` · 국내 레코드 **0건** · 최저가 **불변** · `byMarket={UNKNOWN:1}` |
| 4 | 가격 없음 | 🟢 evidence 에 **보존** (분기 진입~push 사이에 조기 이탈 **없음** 을 단언) |
| 5 | SIMILAR(=REFERENCE) | 🟢 가격 버킷에 **안 들어간다** · 최저가 198,000 유지 |

---

## 6. §9 Mutation — 🔴 **전부 FAIL 해야 하고, 전부 FAIL 한다**

| 변형 | 내용 | 결과 |
|---|---|---|
| M0 / 원상복구 | 정상 | 🟢 **46 passed** |
| M1 | `market !== "KR"` 게이트 무력화(외화를 국내로) | 🔴 **1 FAIL** |
| M2 | 해외 evidence 에 `source: "SELLER_ORIGIN"` 부여 | 🔴 **1 FAIL** |
| M3 | 가격 없는 후보를 `continue` 로 제거 | 🔴 **1 FAIL** |
| M3b | 같은 제거를 `if (!best.price) { continue; }` 로 위장 | 🔴 **1 FAIL** |
| M4 | `REFERENCE` 를 EXACT 가격으로 승격 | 🔴 **1 FAIL** |
| M5 | 충돌(등록부+외화)을 `KR` 로 강제 | 🔴 **2 FAIL** |
| M6 | JSON-LD 를 **다시 fetch** 해서 읽기(추가 HTTP) | 🔴 **2 FAIL** |

### 🔴🔴 M3 는 처음에 **통과했다** — 가드를 고쳤다

```
처음 단언은 slice 를 `geminiEvidence.push({` «부터» 잡았는데, 변이는 그 **앞** 에
`if (best.price == null) continue;` 를 넣었다 → **46/46 통과.**
🟢 그래서 **분기 «진입» 부터 push 까지** 를 보도록 고쳤다 — 조기 이탈(`continue`/`return`)
   과 `best.price` 참조가 그 구간에 **없어야** 한다. M3·M3b 가 둘 다 FAIL 로 바뀌었다.
🔴 WU-018 의 가드 공백과 **같은 계열** 이다 — 「그 줄이 있는가」가 아니라
   **「그 줄을 못 밟게 만드는 것」** 을 봐야 한다.
```

---

## 7. §12 일곱 질문

| # | 질문 | 답 |
|---|---|---|
| 1 | 추가 HTTP 없이 후보 가격을 얻었는가 | 🟢 **YES** — fixture **12/20**, `fetchPlainHtml` 호출 **1회 유지**(테스트로 잠금) |
| 2 | 가격 없는 후보를 보존하는가 | 🟢 **YES** — M3/M3b 로 잠금 |
| 3 | KRW 와 해외 통화를 분리하는가 | 🟢 **YES** — 통화별로만 집계 · 환산 0 · 합계 금액 칸 **없음** |
| 4 | 등록부/EUR 충돌을 안전하게 처리하는가 | 🟢 **YES** — `UNKNOWN`(국내도 해외도 아니다) |
| 5 | 해외 가격이 원가/국내를 오염시키는가 | 🟢 **NO (오염 없음)** — 금액 단언 + M1/M2 |
| 6 | 가격 evidence 가 기존 MI aggregation 까지 연결되는가 | 🟡 **PARTIAL** — 국내 KRW 🟢 / 해외는 **별 축까지** 🟢, 🔴 판매 판정에는 **의도적으로 미연결** · UI 소비자 **0**(§11 UI 변경 금지) |
| 7 | 두 카테고리가 같은 공통 구조를 쓰는가 | 🟡 **PARTIAL** — 코드 경로는 **완전히 동일**, 🔴 단 TENNIS 해외는 microdata 라 가격 0 |

---

## 8. 🔴 §13 종료 기준 판정 — **PARTIAL**

```
🟢 PASS 조건  Candidate → MI → Price Evidence → Market Separation → MI Aggregation
   KIDS 국내 🟢 · KIDS 해외 🟢 · TENNIS 국내 ⚪(source 부재 — CASE C) ·
   🔴 **TENNIS 해외 ✕** (가격 추출 0)
🟢 FAIL 조건(오염)  **해당 없음** — 국내/원가 숫자가 움직이지 않음을 금액으로 확인
→ 🟡 **PARTIAL**: 「가격 추출은 되지만 한 사이트군(microdata)이 남았다」
```

🔴 **CPO 결정 대기 2건**:
```
① microdata(`itemprop`) 를 **순수 함수로** 읽는 작은 파서를 추가할 것인가
   🟢 추가 HTTP 0 · Playwright 0 · 이미 받은 HTML 사용
   🔴 단 「새 추출기」라 §0/§2 범위 밖이다. TENNIS 해외를 닫는 유일한 무비용 경로다.
② 해외 가격 축을 **화면/판정에 노출할 것인가**
   🟢 지금은 MI 반환까지 와 있다(`candidateOverseasPrice` · `candidateOverseasEvidence`).
   🔴 UI 소비자는 **0** 이다 — 이 WU 가 UI 를 못 바꾸기 때문이다(§11).
   🔴 그리고 판매 판정에 넣는 것은 **가격 의미 변경** 이라 CPO 결정이다.
```

---

## 9. 검증

```
🟢 admin 전수 회귀   Test Files **514 passed** / 48 skipped (562)
                     Tests      **7663 passed** / 56 skipped (7719) · FAIL **0**
🟢 typecheck         **10** (baseline 10 — 추가 0)
🟢 build             `Compiled successfully` · exit 0
🟢 coupling guard    6 passed
🟢 mutation          M1~M6 (+M3b) 전부 FAIL · 원상복구 46 passed
🟢 Gemini 0 · HTTP 0 · credit ₩0 · flag OFF · deploy 0 · merge 0 · DB 쓰기 0 · schema 0
```

🔴 **회귀는 `apps/admin` 에서만 센다** — `packages/crawler` 단독 실행은 러너가 없어
거짓 FAIL 을 낸다(WU-018 에서 규명).
