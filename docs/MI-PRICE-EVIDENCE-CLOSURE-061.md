# WU-061 — PRICE EVIDENCE / COMPARISON CLOSURE (롱스프린트)

> 🔴 CPO 지시 2026-10-18. 「C06 을 억지로 고치는 대신 **AI 후보 → MI → 국내/해외 가격 비교**
> 에서 남은 실제 병목을 닫는다.」 · 「단순 숫자 추출 금지 · generic body-number fallback 금지」

---

## 0. 한 줄 결론

```
① 국내 가격 증거 회수율  🟢🟢 **11/13** — 실패 2건은 **둘 다 beaumonde.co.kr** 하나의 사이트다
② 가격 증거 계층         🔴🔴 **3층(meta)을 추가하면 증분 0 인데 불일치가 들어온다** → 추가 안 함
③ 국내/해외 의미 분리    🟢 어휘 5개 상호 비포함 · 🔴 `EXCLUDED` 영향도 **산출**(최저가 4.4~8.2배 차이)
④ transient → alert 경계 🟢🟢 **운영 함수를 직접 불러** 알림이 **생성되지 않음** 을 단언했다
⑤ Vision 실험 설계       🟢 숫자만 산출 — **구현 0**
⑥ E2E 체인 11구간        🟢 owner 전건 실재 확인
```

🔴 **운영 코드 변경 0.** 구현은 **계약 테스트 9건** 뿐이다.

---

## 1. 국내 가격 증거 회수율 — **전수 (운영 owner 재현 · HTTP 0)**

대상: GT 51 중 국내/한국계 후보 **13건**(`.kr` 6 + kihanan·mustit·trenbe 등 7) · 캐시 HTML 사용
🔴 추출은 **운영 owner 둘만** 썼다 — `extractFromJsonLd` · `extractMicrodataFromHtml`.

| | 도메인 | fetchPath | ①JSON-LD | ②microdata | ③meta(미구현) | 결과 |
|---|---|---|---|---|---|---|
| C06 | global.trenbe.com | SHOPIFY_JSON | 84 USD | — | 84 USD | 🟢 ① |
| C07 | biskuit.kr | PLAIN_HTML | **88,000 KRW** | — | 88,000 KRW | 🟢 ① |
| C10 | global.trenbe.com | SHOPIFY_JSON | 88 USD | — | 88 USD | 🟢 ① |
| C13 | **beaumonde.co.kr** | PLAIN_HTML | — | — | — | 🔴 **없음** |
| C14 | kihanan.com | SHOPIFY_JSON | 26,400 JPY | — | 26,400 JPY | 🟢 ① |
| C15 | m.web.mustit.co.kr | PLAIN_HTML | **226,000 KRW** | — | 🔴 **233,000 KRW** | 🟢 ① · **불일치** |
| C23 | littleluna.co.kr | PLAIN_HTML | **117,000 KRW** | — | 117,000 KRW | 🟢 ① |
| C24 | miniboutique.co.kr | PLAIN_HTML | **117,000 KRW** | — | 117,000 KRW | 🟢 ① |
| C27 | **beaumonde.co.kr** | PLAIN_HTML | — | — | — | 🔴 **없음** |
| C28 | luksusbaby.kr | SHOPIFY_JSON | **73,000 KRW** | — | 73,000 KRW | 🟢 ① |
| C32 | luksusbaby.kr | SHOPIFY_JSON | **122,000 KRW** | — | 122,000 KRW | 🟢 ① |
| C41 | global.trenbe.com | SHOPIFY_JSON | 87 USD | — | 87 USD | 🟢 ① |
| C47 | biskuit.kr | PLAIN_HTML | **258,000 KRW** | — | 258,000 KRW | 🟢 ① |

```
회수 **11/13** · 전부 ① JSON-LD · ② microdata 로만 가능 **0** · ③ meta 로만 가능 **0**
통화   KRW **7건**(국내 축 자격) · USD 3 · JPY 1
🔴 실패 2건 = **같은 사이트 하나**(beaumonde.co.kr) — ld 0 · micro 0 · meta 0
```

🟢🟢 **그래서 「국내 가격 증거가 안 잡힌다」는 더 이상 사실이 아니다.** 🔴 남은 것은
**사이트 하나** 이고, WU-059 §2 가 이미 그 사이트의 유일한 후보가 `set_goods_fixedPrice`
(= **정가** · 플랫폼 종속)라는 것을 확정했다 → **CPO 가 금지한 경로** 다.

🔴 **「국내 가격 증거 7건 있음」을 「국내 EXACT 있음」으로 읽지 않는다** — 그 7건의 tier 는
`COMPARISON`/`EXCLUDED` 이고 **EXACT 는 여전히 0** 이다(WU-059/060 §1). 두 축을 섞지 않는다.

---

## 2. 🔴🔴 가격 증거 우선순위 — **3층을 추가하지 않는 것이 맞다**

```
현행 후보 경로(product-url-facts.ts:248)
  const priced = priceFromJsonLd(html) ?? micro?.price ?? null;      ← **두 층**
```

🟡 3층 후보는 **이미 리포에 있다** — `extractFromOpenGraph`(product-data-extractor.ts:513).
🔴 그런데 후보 경로가 부르지 않는다(호출부는 `extractProductData:940` 와 shopify 전략 — **원상품 경로**).

**그것을 후보 경로에 넣으면 어떻게 되는가 — 측정했다**:
```
🔴 증분 회수            **0건** (meta 로만 가능한 후보가 없다 — 가진 11건은 전부 JSON-LD 도 가진다)
🔴🔴 불일치             **1/12 = 8.3%**
    C15 m.web.mustit.co.kr  ①JSON-LD **226,000 KRW**  ↔  ③meta **233,000 KRW**
    ⟹ fallback 순서에 따라 **7,000원** 이 달라진다
🔴 어느 쪽이 진짜 판매가인지 **CTO 가 확인할 수 없다**(mustit 은 리세일 플랫폼이라
   「즉시구매가 ↔ 최저가」가 공존할 수 있다 — **미확인**)
```
⟹ **이득 0 · 위험 실재** → **추가하지 않았다.** 🔴 그리고 그 사실을 계약으로 잠갔다
(후보 경로에 `extractFromOpenGraph` 가 들어오면 테스트가 깨진다).

🔴 **금지 두 항목도 같은 테스트가 지킨다** — generic body 숫자 파서 · `fixedPrice` 사용.

---

## 3. 국내/해외 의미 분리 + `EXCLUDED` 영향도

### 3-A. 🟢 다섯 어휘가 섞이지 않는다 (상호 비포함 · 전수)

```
「해외 동일상품 참고가격」 · 「국내 참고가격」 · 「원본 상품」 · 「동일상품 아님」 · 「가격 미확인」
🟢 어느 것도 다른 것을 **포함하지 않는다**(WU-056-R1 계약의 확장)
🟢 범위 문구가 축마다 **다른 사실** 을 말한다 —
   해외: 「판매판정과 국내 최저가에는 반영되지 않습니다」(사실)
   국내: 「이번 확인에만 쓰이고 저장되지 않습니다」 🔴 **「판매판정」을 쓰지 않는다**(국내는 판정 입력이다)
```

### 3-B. 🔴 `EXCLUDED` 집계 영향도 — **숫자 전후**

```
GT 51 tier 분포   EXACT 12 · COMPARISON 29 · REFERENCE 2 · **EXCLUDED 8 (15.7%)**
```

집계기(`summarizeCandidateOverseasPrices`)에 **같은 입력** 을 두 번 넣어 직접 비교했다:

| | 전 (현행) | 후 (EXCLUDED 제외) | 차이 |
|---|---|---|---|
| EUR | count 3 · 최저 **9** | count 2 · 최저 **40** | 🔴 **4.4배** |
| USD | count 2 · 최저 **12** | count 1 · 최저 **98** | 🔴 **8.2배** |

🔴🔴 **의미상 잘못된 집계다** — 구역 제목이 「해외 **동일상품** 참고가격」인데
「**동일상품 아님**」으로 라벨된 후보가 **최저가** 를 만든다.

🟡 **최소 수정안**(CTO 제안 · 구현하지 않았다):
```
summarizeCandidateOverseasPrices 의 **금액 집계에서만** `EXCLUDED` 를 제외한다
  🟢 `byPriceTier` 카운트는 **그대로 둔다** — 「동일상품 아님 N건」 표시가 사라지면 안 된다
  🟢 국내 축은 이미 적재 시점에 EXACT/COMPARISON 둘뿐이라 **대칭이 된다**
  🔴 변경 규모: 순수 함수 **한 줄**(`if (r.priceTier === "EXCLUDED") continue;` 를 금액 블록 앞에)
  🔴 영향: 위 표대로 **최저가 숫자가 올라간다**(사용자가 보는 값이 바뀐다)
🔴 **구현하지 않았다** — CPO §5 가 「숫자를 바꾸는 임의 필터링 금지」를 명시했고,
   이것은 셀러가 보는 금액을 바꾸는 **제품 정책** 이다. 전후 숫자를 계약으로 고정해 두었다.
```

---

## 4. 🟢🟢 transient → persistent alert 경계 — **함수를 직접 불러** 단언했다

🔴 **소스 grep 이 아니다.** 「transient 후보만 있는 상태」를 운영 입력 모양으로 만들어
`computeSellerAction` → `computeMarketAlert` 를 **실제로 돌렸다**.

```
입력 (transient 만 있는 상태)
  priceLevel      priceLevelFromVerdict(null) → **UNKNOWN**   ← 국내 EXACT 0 ⟹ decision 없음
  domestic        lowestPriceKrw 117,000 (🔴 transient COMPARISON 가격이 집계에 **들어와 있다**)
  trend           **null**  ← DB 전용(`getPriceHistory(…, "DOMESTIC_SHOP")`)
  soldOutCount    **0**     ← transient 는 `soldOut: null`
  origin.change   **null**
결과
  sellerAction.status      **INSUFFICIENT_DATA**
  sellerAction.opportunity **null**
  computeMarketAlert       🟢🟢 **null** ⟹ `openAlertIfNotActive` 가 호출되지 않는다
```

🔴 **그리고 어디서 열리는지도 같은 파일에 고정했다** — `priceLevel` 이 올라가면
(`MARGIN_RISK` → RED → `PRICE_ADJUST`) 알림이 **ACTION_REQUIRED 로 생성된다.**
⟹ **국내 EXACT 가 생기는 순간(CF-3 승인 등) 이 경로가 열린다.** 그 결합이 계약에 적혀 있다.

🟢 **차단안을 구현하지 않은 이유**: 지금 **부당한 알림 생성이 0** 이다(위 단언). CPO §4 는
「가능성이 있으면 차단안까지 구현 검증」인데, 가능성의 **전제(국내 EXACT)가 0** 이고
그것을 여는 결정이 **CF-3(HOLD)** 이다. 🔴 지금 차단 코드를 넣으면 **닫혀 있는 경로를
선제적으로 변경** 하는 것이고, CPO 가 ②에서 금지한 바로 그 행동이다.

### 🟢 refresh 경계 (WU-059 §3 재확인)

```
두 참고 축은 **POST 응답에서만** state 로 들어간다(Panel:2100-2101)
GET(`loadPriceHistory`)은 이 둘을 **건드리지 않는다** → 세션 내 생존 · **F5 에만 소멸**
🔴 client 영속화(session/localStorage) **없음** — 넣으면 판정(GET=DB)과 무한히 벌어진다
```

---

## 5. 🟢 Vision 실험 설계 — **숫자만** (구현 0)

```
분모(GT)                              **51**  (Human SAME 27 · DIFFERENT 23 · UNCERTAIN 1)
현행 EXACT                            **12**  (SAME 11 · DIFFERENT 1)
🔴 Vision 이 필요한 실제 FP 후보         **1건**  — C06 global.trenbe.com
🔴 텍스트로 해결 불가능한 후보           **1건**  — C05(Human SAME)와 `colorText` 가 **동일**
예상 개선 가능 FP                      상한 **1** · 하한 **0**  🔴 Vision 판별력 **미측정**
🔴 Recall 쪽 손실 후보(SAME 인데 EXACT 아님)  **16건**  ← 🔴 Vision 이 이쪽을 돕는지는 **미측정**
현재 precision / recall                **11/12 = 91.7%**  /  **11/27 = 40.7%**
추가 API/모델/비용                      🔴 **미측정** — 이 WU 에서 호출 0
운영 복잡도                            이미지 fetch + 모델 호출 + 캐시 + 실패 처리(= 새 축 4개)
도입하지 않을 경우의 한계               precision **91.7% 상한**(C06 클래스는 영구히 남는다)
                                      recall 은 Vision 과 **무관** 할 수 있다(미측정)
```

🔴🔴 **실험을 열 때의 설계 — 이대로만 연다**:
```
① 분모를 먼저 키운다 — FP 가 **1건** 이라 지금은 어떤 결과도 통계가 아니다(§5-B)
② 측정 대상은 **둘** 이다 — FP 감소(precision)와 MISS 회복(recall). 섞지 않는다
③ CONTROL — 운영이 이미 EXACT 를 낸 쌍을 표본에 섞고 **그 verdict 가 재현되는지** 본다
④ 비용은 **호출 수 × 단가** 를 실측하고, 「상품당」으로 환산해 보고한다
⑤ 🔴 실패 모드를 미리 적는다 — 이미지가 **양쪽 다 재업로드** 된 경우(C05/C06 이 그렇다)
   모델이 같은 상품으로 볼 수 있다. 그러면 개선이 **0** 이다
```

---

## 6. 🟢 최종 E2E 체인 — 11구간 owner 전건 실재

```
① AI 후보 URL 입력 → SSRF/URL 검증   url-candidate-pool.ts  `classifyOutboundUrl` · `guardedLookup`
② 상품 증거 + 가격                   product-url-facts.ts   `priceFromJsonLd ?? micro?.price`
③ 가격 신뢰도 승격                   product-url-facts.ts   `priceSource: "detail"` ⟹ VERIFIED_CURRENT
④ MI 판정                            run-domestic-price-check.ts  `judgeDomesticCandidate`
⑤ 시장 분류(KR/해외)                 run-domestic-price-check.ts  `classifyCandidateMarket`
⑥ 국내 집계                          market-intelligence.ts  `domesticTransientRecords`(EXACT|COMPARISON)
⑦ 해외 집계                          market-intelligence.ts  `overseasEvidence`(push 뒤 `continue`)
⑧ 응답 → UI                          check/route.ts  `domesticReference` · `overseasReference`
⑨ refresh 경계                       Panel  `setDomesticReference`(POST 전용)
⑩ alert 경계                         check/route.ts  `openAlertIfNotActive` (🟢 transient 로는 null)
⑪ transient 저장 차단                run-domestic-price-check.ts:1110  `isTransientShopId(shopId)`
```

🔴 **구간별로 «실제 데이터가 흐르는지» 까지 본 것은 ①~⑧ 이다**(캐시 기반). ⑨⑩은 **함수/계약**
수준이고, ⑪은 **소스 불변식** 이다. 🔴 「전 구간을 실데이터로 한 번에 통과시켰다」로 적지 않는다.

---

## 7~8. 구현 결과

```
운영 코드 변경  **0**
테스트          wu-061-price-closure.test.ts **9건** 신규 (②③④ 계약)
삭제            측정 전용 스크래치 하니스 2개
```

---

## 9. Negative / Mutation

baseline **31 passed**(WU-059 13 + WU-060 9 + WU-061 9) · 변형마다 원상복구

| | 변형 | 결과 |
|---|---|---|
| P1 | 후보 경로에 **meta 3층 추가** | 🔴 **1 failed** |
| P2 | 국내 문구에 「판매판정」 되살리기 | 🔴 **2 failed** |
| P3 | 국내 적재에 `REFERENCE` 허용 | 🔴 **2 failed** |
| P4 | 가격 구역 제목을 포함관계로 만들기 | 🔴 **1 failed** |
| — | 원상복구 | 🟢 **31 passed** |

---

## 10~12. Regression / Typecheck / Build

```
회귀      apps/admin  **569 files / 8,242 passed** / failed 0 (skipped 94)
typecheck **0 errors**
build     **exit 0**
```

🔴 **하니스가 또 틀렸고 기록한다** — ⒜ `ExtractedProductData.price` 를 숫자로 읽어
`[object Object]` 를 찍었다(실제는 `{amount, currency}` · 이 트랙 **13번째** 칸 이름 오류)
⒝ `priceLevelFromVerdict("LOWER_REQUIRED")` 로 **어휘를 지어냈다** — 실제 union 은
`MAINTAIN | CONSIDER_LOWER | MARGIN_RISK` 다. 타입에서 읽어 고쳤다.
⒞ E2E owner 확인 grep 의 **경로가 틀려** 3구간을 「없음」으로 찍었다 — 교정 후 전건 🟢.

---

## 13~16. Commit / Deploy / Evidence / External API

```
외부 API  AI 0 · Gemini 0 · 검색 API 0 · 키 0 · 결제 **₩0** · 외부 HTTP **0**(전부 캐시)
🟢 Gemini 잔액 ₩3,171 보존 · flag 미변경
🔴 운영 동작 변경 0 ⟹ Production 에서 «새로 보일 것» 이 없다 — §15 는 무변경 증거다
```

---

## 17. 🔴 Known Unknowns

```
① 🔴 C15 의 **진짜 판매가** — 226,000 ↔ 233,000 중 어느 쪽인지 미확인(로그인 뒤 화면)
② 🔴 분모 13(국내/한국계) · GT 51 · 원상품 호스트 2개. **전수 498 값이 아니다**
③ 🔴 `beaumonde.co.kr` 외에 구조화 데이터 0 인 국내 사이트가 더 있는지 **미측정**
④ 🔴 `EXCLUDED` 의 **운영 전수 영향도** 는 미측정 — §3-B 숫자는 GT tier 분포 + 합성 입력이다
⑤ 🔴 Vision 판별력·비용 **전부 미측정**(§5 는 설계일 뿐이다)
⑥ 🔴 ⑨⑩⑪ 구간은 실데이터가 아니라 함수/계약 수준으로 검증했다
```

---

## 18. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음(외부 호출 0)
Build PASS:  🟢        Production PASS:        🟡 동작 무변경 확인까지
```

---

## 19. 🔴 CPO 판정 요청 — **2건**

| | 안건 | CTO 권고 | 근거 |
|---|---|---|---|
| ① | **`EXCLUDED` 를 해외 금액 집계에서 제외** | 🟡 **권고** — 단 숫자가 바뀐다 | 구역 제목이 「동일상품」인데 「동일상품 아님」이 최저가를 만든다 · 변경 1줄 · 전후 숫자 §3-B |
| ② | **beaumonde 류(구조화 0) 사이트 처리** | 🔴 **현행 유지 권고** | 남은 실패가 **사이트 하나** 이고 유일한 경로가 「정가 칸」이다 |

🔴 **CEO Action: 없음.** UI·가격 비교 동작 변경이 **0** 이므로 Production 테스트를 요청하지 않는다.
🔴 ①을 승인하면 **셀러가 보는 최저가 숫자가 바뀐다** → 그때는 배포 후 **CEO 확인 1회** 를 요청한다.
