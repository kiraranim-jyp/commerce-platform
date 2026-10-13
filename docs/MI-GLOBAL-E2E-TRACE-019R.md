# WU-019R `MI-GLOBAL-E2E-TRACE` — 초기 2개 카테고리 MI 연결상태 조사

> 🔴🔴 **조사 WU 다. 운영 코드 변경 0 · Gemini 호출 0 · 외부 HTTP 0 · credit ₩0.**
> ₩3,300 보존 · flag OFF · Production HOLD · main merge 0 · CEO 액션 없음.
> 🟢 추가한 것은 **하니스 1파일**(`mi-019r-global-trace.test.ts`) 뿐이고, 그것도
> 네트워크를 쓰지 않는다 — 덤프 스냅샷에 **운영 owner 함수**를 돌린 순수 계산 +
> 선행 WU 가 이미 저장한 결과(`acc011-1.json`)의 재분류다.

---

## 1. 🔴🔴 단계별 연결 상태 표 (§13)

| 단계 | KIDS_FASHION | TENNIS | 근거 |
|---|---|---|---|
| Product Identity | 🟢 COMPLETE | 🟡 PARTIAL | `product-identity-dna.ts:219` · 아래 §2 |
| Gemini Discovery | 🟡 PARTIAL | 🟡 PARTIAL | `gemini-candidate-pool.ts:228-310` · flag OFF |
| 국내 Candidate | 🟢 COMPLETE | 🔴 MISSING | `comparison-search/index.ts:197` · TENNIS scope 샵 1곳 |
| 해외 Candidate | 🟢 COMPLETE | 🟢 COMPLETE | `gemini-candidate-pool.ts:314-336`(host 별 분리) |
| MI Verification | 🟢 COMPLETE | 🟢 COMPLETE | `run-domestic-price-check.ts:938·1009` **같은 루프·같은 함수** |
| 국내 Price Evidence | 🟡 PARTIAL | ⚪ NOT MEASURABLE | `market-intelligence.ts:183-220` · TENNIS 는 분모 0 |
| 해외 Price Evidence | 🟡 PARTIAL | 🔴 MISSING | Shopify 만 된다 — `price-source-adapter.ts:264` |
| Market Aggregation | 🟡 PARTIAL | ⚪ NOT MEASURABLE | 국내 KRW 만 · 해외는 **담을 칸이 없다**(§6) |
| Final MI | 🟡 PARTIAL | 🔴 MISSING | 가격을 통해서만 영향 · identity 단독은 소비자 0 |
| Registration Decision | 🟢 COMPLETE (설계상 분리) | 🟢 COMPLETE (설계상 분리) | P-32 `registration-readiness-outcome.ts:15-20·109` |

🔴 **「Registration Decision 🟢」을 「Gemini 가 등록 판단을 바꾼다」로 읽으면 틀린다.**
P-32 는 **판매 판정과 등록 준비가 서로에게 영향을 주지 않는다** 는 불변식이고,
`computeRegistrationReadiness(inputs: PlatformReadinessInput[])`(:109)는 **sellVerdict
인자를 받지 않는다.** 🟢 즉 그 칸이 COMPLETE 인 것은 **설계대로 분리돼 있다** 는 뜻이다.

---

## 2. Trace A — 원상품 Identity / Facts (운영 owner 산출 · HTTP 0)

`buildProductIdentityDna` → `productFactsFromIdentityDna`(`product-identity-dna.ts:219`)를
덤프 스냅샷에 직접 돌렸다. 🟢 그 함수는 **가공을 하지 않는다** — 칸 이름만 바꿔 담는다(:215-237).

| 칸(owner 이름) | KIDS_FASHION (N=17) | TENNIS (N=9) |
|---|---|---|
| `facts.brand` | **17/17 100%** | **9/9 100%** |
| `facts.sellerSku` | 14/17 82% | **9/9 100%** |
| `facts.brandModelCode` | 🟡 6/17 35% | 🔴 **0/9 0%** |
| `facts.coreTitleTokens ≥1` | **17/17 100%** | **9/9 100%** |
| `facts.colorText` | 13/17 76% | 7/9 78% |
| `facts.materialText` | **17/17 100%** | 8/9 89% |
| `facts.categoryText` | **17/17 100%** | 🔴 **0/9 0%** |
| `dna.brand.confident=true` | 🟡 4/17 24% | 🔴 0/9 0% |
| `dna.identifier.tier` | SKU 14 · 없음 3 | SKU 9 |

🔴 **Identity 전체의 confidence 칸은 «없다».** `ProductFacts`(product-facts.ts:652-678)에
confidence 칸이 없고, `ProductIdentityDna` 에는 `brand.confident`(boolean) 하나만 있다
(product-identity-dna.ts:56) — 그리고 **facts 로 옮겨지지 않는다**(facts.brand 는 `string|null`).
→ 🔴 지시서 §3 의 「Identity confidence」는 **제품에 그 칸이 없어서 측정 불가** 다.

🔴 **TENNIS 가 PARTIAL 인 이유 둘** — 둘 다 「코드 결함」이 아니라 **입력 성질** 이다:
```
categoryText 0/9   → resolveCategory(:171-182)는 breadcrumb/JSON-LD/Shopify type
                      셋 중 하나가 있어야 채운다. 그 소스가 셋 다 없으면 null 이 «맞다».
brandModelCode 0/9 → 브랜드 품번을 사이트가 적지 않는다. 🟢 sellerSku 는 9/9 있다.
                      🔴 그런데 SKU 는 «판매처» 번호라 다른 샵과 맞출 수 없다
                      (product-identity-dna.ts:90 주석이 두 칸을 섞지 말라고 명시).
```

---

## 3. Trace B — Gemini Global Discovery (구조 추적 · 호출 0)

```
ProductIdentity
  → buildPrimaryQuery(discovery-core/query-generator.ts)      L1/L2/L3 · UNAVAILABLE 이면 호출 0
  → collectGeminiCandidatePool(gemini-candidate-pool.ts:228)   1 상품 = 1 Primary = 1 call
  → discovery.urls                                            metrics.discoveredUrls
  → resolveCandidate + createLivePageProbe(:295)              classification !== PRODUCT_PAGE → 버린다
  → factsFromProductUrl(:303)                                  OK 가 아니면 버린다
  → host 별 ComparisonSearchResult(:314-336)                   🟢 실제 host 로 가른다
```

🟢 **역할 분리는 코드에 실재한다** — pool 은 **판정을 하지 않는다.** verdict 를 만드는
함수를 pool 이 호출하지 않고, 후보를 `ComparisonCandidate` 로만 돌려준다.
🔴 ON 축 실측은 **지금 불가** 다(402 · 선행 WU). 그래서 🟡 PARTIAL 이다.

---

## 4. Trace C — Gemini → MI 연결 🟢 **같은 루프 · 같은 판정 함수**

지시서 §5 의 다섯 질문에 코드로 답한다.

| 질문 | 답 | 근거 |
|---|---|---|
| ① Gemini 후보가 기존 MI 에 들어가는가 | 🟢 **YES** | pool 결과를 `searchResults.push`(run-domestic-price-check.ts:870-900) → 아래 같은 루프 |
| ② 국내 후보와 **같은** 판정 함수인가 | 🟢 **YES** | 루프 `:938` 하나 · `judgeDomesticCandidate(:1009)` 하나. 분기 없음 |
| ③ Gemini 전용 판정 규칙이 있는가 | 🟢 **NO (없다)** | Gemini 분기는 **둘뿐** — `:934` 확인기록 skip · `:1067` 저장 차단 |
| ④ 해외 후보도 MI 가 판정하는가 | 🟢 **YES (실측)** | `tennis-warehouse.com` PRESUMED_SAME · `yahoo.co.jp` PRESUMED_SAME/SIMILAR |
| ⑤ 5종 verdict 가 실제로 생성되는가 | 🟢 **YES** | WU-011 저장값: SAME 2 · PRESUMED_SAME 5 · SIMILAR 1 · DROPPED 5 |

🟢🟢 **「MI 는 후보의 시장을 보지 않는다」** — 그래서 해외 후보가 자동으로 판정된다.
🔴 같은 이유로 **「국내인지 해외인지」를 MI 가 알지 못한다.** 그게 §5 의 문제다.

🟢 `withConfidence` 는 Gemini 경로에서 **명시적으로** 호출된다(`:881` 부근) — 국내
경로는 `searchDomesticShops` 안(`comparison-search/index.ts:197`)에서 이미 불린다.
🔴 이 비대칭은 VALIDATION-CLOSE 에서 찾아 고친 그 결함이고, 지금은 양쪽이 맞다.

---

## 5. §6 — 국내 / 해외 분리 🔴🔴 **제품에 그 칸이 없다**

```
grep "market|country|locale|region"  packages/crawler/src/comparison-search/types.ts
  → **0건**
```

🔴🔴 **`ComparisonCandidate` 에 시장 칸이 없다.** 그래서 지시서 §6 의 「Source Market」
열은 **운영이 내는 값이 아니고**, 내가 TLD·등록부·통화로 **사후 추정** 한 것이다.

### 저장된 Gemini 후보(선행 WU · 신규 호출 0)를 시장별로 가른 결과

| 시장 | 도메인 | 후보 | 가격 획득 |
|---|---:|---:|---:|
| KR (증거 있음) | 4 | 6 | **1** |
| 해외 (증거 있음) | 1 | 4 | 0 |
| 🔴 UNKNOWN | 6 | 7 | 0 |

| domain | 시장 | 분류 근거 | 후보 | 가격 | 통화 | tier |
|---|---|---|---:|---:|---|---|
| `bobochoses.com` | 🔴 **KR?** | 국내 등록부 도메인 | 1 | **1** | **EUR** | EXACT |
| `babybubble.co.kr` | KR | TLD(.kr) | 1 | 0 | — | — |
| `lotteon.com` | KR | 등록부 | 2 | 0 | — | — |
| `musinsa.com` | KR | 등록부 | 2 | 0 | — | — |
| `store.shopping.yahoo.co.jp` | 해외 | 국가 TLD | 4 | 0 | — | COMPARISON 2 |
| `tinyapple.net` | UNKNOWN | 증거 없음 | 1 | 0 | — | **EXACT** |
| `familynet.looxloo.com` | UNKNOWN | 증거 없음 | 1 | 0 | — | — |
| `checkanddot.com` | UNKNOWN | 증거 없음 | 1 | 0 | — | — |
| `tennis-warehouse.com` | UNKNOWN | 증거 없음 | 2 | 0 | — | COMPARISON 2 |
| `pickleballwarehouse.com` | UNKNOWN | 증거 없음 | 1 | 0 | — | COMPARISON 1 |
| `sergiotacchini.com` | UNKNOWN | 증거 없음 | 1 | 0 | — | COMPARISON 1 |

### 🔴🔴 그리고 분류 충돌이 하나 나왔다 — 이것이 §6 의 실제 위험이다

```
`bobochoses.com` 은 국내 등록부에 **「Bobo Choses Korea(공식)」· AUTO_API ·
   categoryScope [KIDS_FASHION]** 로 등록돼 있다(enabled=false).
🔴 그런데 그 후보에서 실제로 돌아온 가격 증거는 **EUR** 였다.
→ 🔴🔴 **「등록부에 있다」가 「국내 시장이다」를 뜻하지 않는다.**
🟢 그 EUR 가 국내 KRW 축으로 들어가지 못하게 막은 것은 **통화 게이트 하나** 다
   (market-intelligence.ts:185 `priceKrw == null` → drop · :195 `currency: "KRW"` 고정).
🟢 즉 헌장 §12 의 WU-012 안전규칙(「KRW 가 아니면 국내 가격 증거로 승격하지 않는다」)이
   **이 표본에서 실제로 발화했다.** 🔴 그 게이트가 없으면 EUR 가 국내 최저가가 된다.
```

🔴 `tinyapple.net` 이 UNKNOWN 인 것도 그대로 적는다 — tier **EXACT**(SAME)를 받은
후보인데 **시장 증거가 없다**(가격 미획득 → 통화 없음 · 등록부 밖 · `.net`).
🔴 「아마 국내 샵」으로 적지 않는다.

---

## 6. Trace D / E — 가격 Evidence 🔴🔴 **여기가 끊긴다. 그런데 「없어서」가 아니다**

### 🟢 공통 가격+통화 추출 계층은 **존재하고 운영에서 돈다**

```
universalExtract(universal-extractor.ts:176)
  → tryFastPath(:132) → trySiteStrategies   🔴 등록 전략 **둘뿐** (shopify · prestashop)
  → 안 걸리면 **Playwright** 로 전체 추출
  → extractProductData(product-data-extractor.ts:858)
       JSON-LD offers.price/priceCurrency(:195-210) → microdata → OpenGraph
운영 호출부  🟢 **있다** — pipeline/route.ts:151 이 부르고 :280-283 이 그 productData 를
             buildCanonicalProduct 로 넣는다(가격·priceValidity·priceRawText 포함).
```

🔴🔴 **그래서 「해외 가격 추출기를 새로 개발해야 한다」는 부정확하다.**
추출기는 있고 **원상품 경로에서 매일 돈다.** 문제는 **후보 경로가 그것을 부르지 않는다** 는
것이다 — 즉 **개발이 아니라 배선** 이다. 🔴 단 비용 축이 다르다(아래).

### 🔴 후보 경로가 실제로 쓰는 것 둘 — 둘 다 일반 사이트 가격을 못 준다

```
① factsFromProductUrl(product-url-facts.ts)   → **price: null 을 «의도적으로» 넣는다**
   (:187 · :236, 주석 :31-38 — Shopify variants[].price 에 통화 코드가 없어서
    가격비교에서 정직하게 제외하려고 비운다)
② enrichCandidatePrices(price-source-adapter.ts:243)
   → `extractShopifyHandle(candidate.url)`(:264) 이 null 이면 **즉시 포기**
   → `priceStatus: "PRICE_UNAVAILABLE"`(:281·:284) 로 fail-soft
```

🟢 실측이 그것과 정확히 일치한다 — 해외/국내 11 도메인 중 **가격을 얻은 것은
`bobochoses.com` 하나**(Shopify)이고 **EUR** 였다. 나머지 **10 도메인 전부 priceOk 0.**

### 🔴 배선할 때 CPO 가 알아야 할 비용 사실

```
fast-path SiteStrategy 는 **shopify · prestashop 둘뿐** (site-strategies/registry.ts:10)
→ 그 둘이 아니면 universalExtract 가 **Chromium 을 띄운다**(universal-extractor.ts:187~)
🔴 후보 3개 × 상품 N 에 그대로 붙이면 **상품당 Playwright 최대 3회** 다.
🟢 비용 0 인 대안 축이 있다 — JSON-LD/microdata 는 **HTML 한 장만** 있으면 읽힌다
   (extractFromJsonLd 는 순수 함수다). `factsFromProductUrl` 의 PLAIN_HTML 경로가
   **이미 HTML 을 받아 온다**(:199-246) — 🔴 그 HTML 로 가격을 읽지 않고 버리는 것이다.
🔴 **구현하지 않았다.** 어느 쪽을 택할지는 CPO 결정이다.
```

### Trace E — 국내 가격 Evidence: 🟢 **같은 aggregation 에 들어간다**

```
market-intelligence.ts:183-220  Gemini transient → exactShopRecords / comparisonShopRecords
  → summarizeDomesticMarketSplit(price-history.ts:630)   🟢 **기존 국내 증거와 같은 배열**
게이트 넷   priceKrw != null(:185) · currency "KRW" 고정(:195) · tier EXACT|COMPARISON(:211)
            · sourceRefId null(등록부 샵이 아니다)
🔴 REFERENCE/EXCLUDED 는 기존 국내 후보와 **같은 이유로** 가격 버킷에 안 들어간다.
```

---

## 7. Trace F — 최종 MI 🔴🔴 **해외 가격에는 «담을 칸» 이 없다**

```
PRICE_OBSERVATION_SOURCES = ["SELLER_ORIGIN", "NAVER_SHOPPING", "DOMESTIC_SHOP"]
                                                          (price-history.ts:21)
🔴 「발견한 해외 **경쟁** 판매처의 가격」에 해당하는 값이 **없다.**
🔴 `SELLER_ORIGIN` 은 **원상품 자신의 판매처** 축이다 — 거기에 얹으면 **원가가 오염된다.**
🟢 `MARKET_PROBE` 는 같은 판매처의 «다른 시장» 이고 원가에서 명시적으로 제외된다
   (isCostBasisOriginObservation · run-price-check.ts:128-133).
```

🟢🟢 **이 질문은 리포가 이미 답해 뒀다** — `overseas-observation-storage-impact.test.ts`
(GOLF-01.6 축 B)가 세 경우를 나란히 고정해 놓았다:

```
① 기준선                     — 현재 숫자
② **새 source 값으로 저장**   → 🟢 한 원도 움직이지 않는다
   이유: 읽는 쪽 네 곳이 **전부 source 를 명시** 한다(market-intelligence ·
         compute-readiness · brand-market · price-observations)
   🟢 DB 는 `source text not null` 이고 CHECK/트리거가 없다 → **migration 불필요**,
      막는 것은 TypeScript 배열 한 줄이다
③ **SELLER_ORIGIN 에 얹기**   → 🔴 움직인다(원가·마진 오염) — **안전하지 않다**
```

🔴 즉 **「해외 축 추가」는 schema 문제가 아니라 «읽는 쪽을 만드는» 문제** 다.

### 지시서 §9 다섯 질문

| # | 질문 | 답 | 근거 |
|---|---|---|---|
| 1 | Gemini SAME/PRESUMED 가 최종 MI 에 영향을 줄 수 있는가 | 🟡 **가격을 통해서만** | tier EXACT/COMPARISON **＋ priceKrw** 둘 다 필요(:185·:211) |
| 2 | 해외 가격이 최종 MI 에 영향을 줄 수 있는가 | 🔴 **NO** | 담을 source 값 없음 · `RepresentativeVerdictInput` 에 해외 칸 없음 |
| 3 | 국내 가격이면 기존 국내 가격과 합쳐지는가 | 🟢 **YES** | 같은 `exact/comparisonShopRecords` 배열 |
| 4 | 가격이 없으면 identity evidence 로 남는가 | 🔴 **사실상 아니다** | `geminiEvidence` 는 반환되지만(:872) **읽는 곳이 0** — grep 전수 |
| 5 | 최종 등록 판단까지 연결되는가 | 🟢 **설계상 분리** | P-32 — 등록은 sellVerdict 를 읽지 않는다(:109) |

🔴 ④ 를 그대로 적는다 — `geminiEvidence` · `geminiPricedCount` 를 **소비하는 UI/판정
코드가 없다**(apps/admin 전수 grep: 생산 지점만 나오고 소비 지점 0).
→ 🔴 **가격 없는 Gemini 후보는 현재 화면에 존재하지 않는다.** 「남는다」로 적지 않는다.

---

## 8. 🔴 §10 — 세 축을 섞지 않는다

| 축 | KIDS_FASHION | TENNIS |
|---|---|---|
| **A. Discovery Success** | 🟢 후보를 찾는다 | 🟢 후보를 찾는다(해외) |
| **B. MI Verification** | 🟢 판정이 돈다 (SAME 2 · PRESUMED 5) | 🟢 판정이 돈다 (PRESUMED_SAME) |
| **C. Registration/Business** | 🔴 유효 국내 EXACT **0** | 🔴 **0** |

🔴🔴 **A 성공 · C 실패는 Gemini 실패가 아니다.** 끊기는 자리는 **A↔C 사이의 가격**이다.

---

## 9. §12 — TENNIS 별도 표

| 단계 | 상태 | 근거 |
|---|---|---|
| Original | 🟢 9/9 | 덤프 전수 |
| Identity | 🟡 brand·sku 9/9 · 🔴 category 0/9 · brandModelCode 0/9 | §2 |
| Gemini | 🟡 구조 있음(flag OFF) · 저장값에서 후보 4개 도메인 | §5 |
| 해외 후보 | 🟢 **있다** — tennis-warehouse 2 · pickleball 1 · sergiotacchini 1 | §5 |
| MI | 🟢 **돈다** — PRESUMED_SAME · tier COMPARISON | §4-④ |
| 해외 가격 | 🔴 **0/4** — 넷 다 비-Shopify | §6 |
| 국내 후보 | 🔴 **0** (9/9) — TENNIS scope 샵 1곳 · 교집합 0 | 선행 WU 확정 |
| 최종 MI | 🔴 도달 못 함 | 가격 0 |

🟢 **그래서 TENNIS 는 CASE C 다** — 국내 source 부재이고 **공통 MI 문제가 아니다.**
🔴 `tennis-warehouse.com` 자기참조 정책은 **건드리지 않았다**(008A CLOSED 정책 유지).
그 2건은 자기참조로 처리된 것이 아니라 **PRESUMED_SAME 판정을 받았다** — 원상품이
Sergio Tacchini 공식/다른 호스트라 자기참조가 아니었다.

---

## 10. 🔴🔴 §15 종료 조건 판정 — **CASE B · 그리고 TENNIS 는 CASE C**

```
CASE A (공통 구조 완료)       ❌ 아니다
CASE B (공통 연결 하나 빠짐)   🟢 **해당 — 빠진 공통 연결이 «둘» 이다**
CASE C (특정 카테고리 source)  🟢 **해당 — TENNIS 국내 source 부재**(공통 문제로 확대 금지)
CASE D (해외 가격 extraction 이 구조적으로 부족) 🟡 **부분 해당 — 단 표현을 고쳐야 한다**
       🔴 추출기는 **이미 있고 운영에서 돈다**(universalExtract → extractProductData).
          부족한 것은 **후보 경로의 배선** 과 **비-Shopify 의 비용 전략** 이다.
```

### 🔴 빠진 «공통» 연결 둘 — 이것이 이 WU 의 산출물이다

```
① 후보 가격 추출 배선
   현재: factsFromProductUrl 이 price 를 «의도적으로» null 로 둔다 + enrich 는 Shopify 전용
   있는 것: JSON-LD/microdata/OG 추출기(순수 함수) · PLAIN_HTML 경로가 이미 HTML 을 받는다
   🔴 결정 필요: ⒜ 받은 HTML 로 JSON-LD 가격만 읽는다(HTTP 추가 0) ⒝ universalExtract 를
      부른다(Playwright 비용) ⒞ 안 한다

② 해외 가격을 담는 축
   현재: source 어휘 셋 다 국내/원가 축이다 · RepresentativeVerdictInput 에 해외 칸 없음
   🟢 schema 변경은 **불필요** (source 는 text · CHECK 없음)
   🔴 필요한 것은 **읽는 쪽** 이다 — 새 값으로 저장만 하면 **한 원도 움직이지 않는다**
      (리포의 기존 테스트가 그것을 고정해 뒀다)
   🔴 그리고 **SELLER_ORIGIN 에 얹는 것은 금지** — 원가가 오염된다(같은 테스트 ③)
```

🔴 **CTO 가 ①②중 아무것도 구현하지 않았다.** 둘 다 가격 의미·판정면 변경이라 CPO 결정이다.

---

## 11. §14 — 일곱 질문에 YES / NO / PARTIAL

| # | 질문 | 답 |
|---|---|---|
| 1 | Gemini 가 1차 Global Candidate Discovery 로 정상 **분리** 되어 있는가 | 🟢 **YES** — pool 은 판정 함수를 부르지 않는다 |
| 2 | Gemini 후보가 기존 MI 로 정상 검증되는가 | 🟢 **YES** — 같은 루프·같은 `judgeDomesticCandidate`, 전용 규칙 0 |
| 3 | 해외 후보도 동일한 MI 구조로 검증 가능한가 | 🟢 **YES** — 실측(tennis-warehouse · yahoo.co.jp PRESUMED_SAME) |
| 4 | 검증된 해외 후보에서 실제 가격 evidence 를 얻을 수 있는가 | 🟡 **PARTIAL** — Shopify 만. 실측 **1/11 도메인**(EUR) |
| 5 | 국내 + 해외 evidence 를 기존 aggregation 에 넣을 수 있는가 | 🟡 **PARTIAL** — 국내 KRW 🟢 / **해외 🔴 NO**(담을 칸·읽는 쪽 없음) |
| 6 | 최종 MI 가 그 evidence 로 판매 판단까지 연결되는가 | 🟡 **PARTIAL** — 국내 KRW 가격이 있을 때만. identity 단독은 소비자 0 |
| 7 | 두 카테고리가 다음 카테고리로 넘어갈 만큼 공통 구조가 완성됐는가 | 🔴 **NO** — §10 의 공통 연결 둘이 빠져 있다 |

---

## 12. 준수 사항 / 한계

```
🟢 Gemini 호출 0 · grounding 0 · 외부 HTTP 0 · credit ₩0 · ₩3,300 보존 · flag OFF
🟢 운영 코드 변경 **0** · DB schema 0 · DB 쓰기 0 · Registry 0 · adapter 0 · UI 0
🟢 threshold 0 · 영구 URL 저장 0 · 가격추적 0 · P-32 0 · main merge 0 · deploy 0
🟢 008A 자기참조 정책 · tennis-warehouse 정책 **변경 0**
🟢 추가한 것은 하니스 1파일(네트워크 미사용)
```

🔴 **한계 — 넘겨 읽지 않는다**:
```
🔴 Trace A 는 덤프 표본(아동 17 · 테니스 9)이고 운영 전수 498 이 아니다.
🔴 §5 의 Gemini 후보 수치는 **선행 WU 실행 시점의 저장값** 이다 — 다시 재지 않았다.
🔴 시장 분류는 **제품 기능이 아니라 내 사후 추정** 이다. UNKNOWN 6 도메인 / 후보 7 을
   KR 로도 해외로도 세지 않았다.
🔴 ON 축(flag ON) 동작은 **여전히 미측정** 이다(402). 이 WU 가 그것을 바꾸지 않았다.
🔴 「Gemini Recall」·「동일상품 X건 발견」·「비용 X원」을 적지 않았다.
```
