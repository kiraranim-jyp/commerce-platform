# WU-079 — 국내 가격 증거 회수 경로 전수 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「generic 숫자 parser ❌ · 가격이 있다는 이유만으로
> `VERIFIED_CURRENT` ❌ · site adapter 선제 구현 ❌ · MI/시장/AI 전부 ❌」

---

# WU-079 FINAL

## 1. 가격 실패 원인

```
🔴🔴 **분모를 먼저 정정한다** — 내가 `factsFromProductUrl` «하나만» 불러
   「실패군 4건」으로 셌는데, 운영 **전체 체인** 에서는 luksusbaby 2건이
   `enrichCandidatePrices` 로 채워져 **`VERIFIED_CURRENT · priceSource="detail"`** 다.
   ⟹ **진짜 실패군은 beaumonde 2건뿐** 이다.
```

| id | 도메인 | fetchPath | 구조화 | 운영 전체 체인 결과 |
|---|---|---|---|---|
| C13 | beaumonde.co.kr | `PLAIN_HTML` | JSON-LD 0 · micro 0 · meta 0 | 🔴 `PRICE_UNAVAILABLE` |
| C27 | beaumonde.co.kr | `PLAIN_HTML` | JSON-LD 0 · micro 0 · meta 0 | 🔴 `PRICE_UNAVAILABLE` |
| C28 | luksusbaby.kr | **`SHOPIFY_JSON`** | 🟢 JSON-LD **Product 있음** | 🟢 `VERIFIED_CURRENT · detail` |
| C32 | luksusbaby.kr | **`SHOPIFY_JSON`** | 🟢 JSON-LD **Product 있음** | 🟢 `VERIFIED_CURRENT · detail` |

🟢 **그래도 luksusbaby 에서 구조적 사실 하나를 확정했다** —
`fetchPath = SHOPIFY_JSON` 인 후보는 **HTML 을 아예 받지 않으므로** 그 페이지의
JSON-LD(`offers.price = 54750, priceCurrency = "KRW"`)를 **영구히 보지 못한다**.
🔴 지금은 `enrichCandidatePrices` 가 뒤에서 메우고 있어 **증상이 없다.**

---

## 2. beaumonde 2건 전수 증거

| 위치 | C13 | C27 |
|---|---|---|
| JSON-LD | **0** | **0** |
| microdata `itemprop=price` | **0** | **0** |
| `<meta>` 가격류 | **0** | **0** |
| `data-*price` | **0** | **0** |
| embedded state(명시 field) | **0** | **0** |
| `class` 에 price/sale/cost | 13개 | 17개 |
| 본문 「N원」 | 20개 | 16개 |

🔴 **미치환 서버 템플릿** 이 HTML 에 그대로 있다 — `class="option_price_display_<%=displayOptionkey%>"`.
⟹ 이 페이지는 **가격 영역을 JS 로 렌더** 한다는 강한 신호다.

가격 후보별 판정:

| 값 | 라벨/문맥 | 현재상품 연결 | 판정 |
|---|---|---|---|
| C13 `170,000` | **「판매가」 라벨 직후** | 🟢 명확 | 🟡 **HOLD**(아래 §8 이유) |
| C13 `170,000` | 「정가」 | 🟢 명확 | 🔴 판매가와 **같다**(할인 없음) |
| C13 `52,000 / 210,000 / 58,600 / 55,200 / 150,000 / 132,000` | `class="cost"` | 🔴 **불명 — 추천 상품** | 🔴 **REJECT** |
| C13 `3,500 / 1,000` | 배송비 · 적립금 | — | 🔴 REJECT |
| C27 「판매가」 | 🔴 **뒤에 숫자가 없다**(「판매가 + 옵션가 + 추가상품가」 **설명 문구**) | — | 🔴 회수 **불가** |
| C27 `88,000` | 「정가」 | 🟢 명확 | 🔴 **정가다**(타임세일 5% 진행 중) |
| C27 `83,600` | `time_sale_cost_r` 첫 값 | 🟡 불명 | 🔴 뒤의 74,100/198,400/… 은 **다른 상품** |

---

## 3. 성공/실패/경계 대조군

수집 **13건**(실패군 2 + 성공군 9 + 드리프트 2). 전부 HTTP 200 · 운영 owner 호출.
🔴 경계군이 자연스럽게 들어왔다 — 배송비(3,300/3,500) · 적립금(2,340/5,850) ·
타임세일(5%) · 옵션가 · 추천상품 금액 · 품절(C32 `OutOfStock`).

---

## 4. Production branch trace (owner 기준 · 추측 0)

```
factsFromProductUrl(url)
 ├ classifyUrlShape(url) ≠ PRODUCT_PAGE          → NOT_PRODUCT_URL (HTTP 0)
 ├ extractShopifyHandle(url) 있음 → /products/X.json
 │    └ body.title 있음 → productFactsFromShopifyProduct → 🔴 **price: null 고정**
 │                                                   (통화를 모른다 · 파일 주석)
 └ 없으면 htmlPath → fetchPlainHtmlWithFinalUrl (WU-075)
      ├ classifyUrlShape(finalUrl) ≠ PRODUCT_PAGE → REDIRECTED_AWAY
      ├ titleFromHtml 없음                        → NO_FACTS
      └ **가격 계층은 «둘» 뿐** (WU-061 계약)
           priceFromJsonLd(html)  ?? extractMicrodataFromHtml(html)?.price
             └ extractFromJsonLd → resolvePriceField → **resolveSourcePrice**
                  (🟢 통화 가드의 «진짜 owner» 는 `packages/pricing/src/price-validity.ts` 다)
 → derivePriceStatus(match.ts:537): priceSource === "detail" ⟹ VERIFIED_CURRENT
```

🔴 **`PRICE_UNAVAILABLE` 이 되는 정확한 조건** — JSON-LD 도 microdata 도 **유효 금액+통화**
를 주지 않을 때. beaumonde 는 **둘 다 0** 이므로 **「놓쳤다」가 아니라 「없다」** 다.

---

## 5. CF-1 ~ CF-4 결과

| CF | 정의 | 실패군 회수 | 🔴 성공군 오추출 |
|---|---|---|---|
| **CF-1** | 「판매가」 **라벨 직후** 금액만 | **1/2**(C13만) | 🟢 **0/9** |
| CF-2 | embedded state 명시 field | **0/2**(beaumonde 는 0개) | — |
| CF-3 | `class`(price/sale/cost/amount) 내용 | 2/2 | 🔴 **5/9** |
| CF-4 | beaumonde 전용 구조 | 🔴 **안정 구조 없음**(JS 렌더 · 미치환 템플릿) | — |

🔴 **CF-3 이 성공군에서 잡는 틀린 값**: 배송비 `3,300`·`3,500` · 적립금 `2,340`·`5,850` ·
다른 상품 `168,200`·`233,000`·`252,000`. ⟹ **즉시 REJECT**.

🟢 **CF-1 은 안전하다** — 성공군 9건에서 오추출 **0**(잡은 4건 모두 JSON-LD 값과 **일치**).

---

## 6. Price recovery

```
CF-1 로 안전하게 회수 가능한 것: **1건(C13 ₩170,000)**
C27 은 **회수 불가** — 「판매가」가 라벨이 아니라 **설명 문구** 다.
```

---

## 7. False price / safety

| 축 | 결과 |
|---|---|
| False Price Extraction (CF-1) | 🟢 **0/9** |
| False Price Extraction (CF-3) | 🔴 **5/9** |
| Wrong Currency | 🟢 0 — 통화 가드가 `resolveSourcePrice` 에 있다 |
| Regular-vs-Sale Misread | 🔴 **C27 에서 실재** — 「정가 88,000」 ↔ 타임세일 83,600 |
| Shipping-vs-Product | 🔴 CF-3 에서 실재(3,300/3,500) |
| Option-vs-Base | 🟡 C27 「판매가 + 옵션가」 문구가 그 위험을 자인한다 |
| Stale/Reference | 🔴 C13 의 `class="cost"` 는 **추천 상품** 금액이다 |

---

## 8. 🔴🔴 Downstream — **안전한 회수 1건이 하필 «틀린 상품» 이다**

```
C13 Human **DIFFERENT** · tier COMPARISON · `.kr` 도메인
  ⟹ 가격이 생기면 market 이 UNKNOWN → **KR** 로 바뀌고 **국내 버킷에 진입한다**
C27 Human **SAME**  ⟹ 🔴 **회수 불가**
```

| | 현재 | CF-1 적용 후 |
|---|---:|---:|
| 국내 버킷 | 5 | **6** |
| SAME | 3 | 3 |
| 🔴 DIFFERENT | 2 | **3** |
| precision | **60.0%** | **50.0%** |
| 최저가 | ₩88,000(SAME) | ₩88,000(불변 · 170,000 은 더 비싸다) |

🔴 **회수 방향이 거꾸로다** — 안전한 축이 **DIFFERENT 만** 회수하고 **SAME 은 못 회수한다.**
WU-063 제1원칙(「틀린 국내 가격이 미노출보다 더 큰 오류」)과 WU-077 의 결론이 **또 반복됐다**.

---

## 9. Mutation / Harness

🔴🔴 **1차 하니스가 CPO §11 을 위반했다 — 내가 잡아서 고쳤다.**
```
캐시 HTML 만 읽는 테스트라 `extractFromJsonLd` 를 **죽여도 통과** 했다.
🟢 그래서 운영 owner 를 직접 부르는 생산자 계약(네트워크 0) 6건을 **추가** 했다.
```

**Producer-level mutation** — baseline **6 passed**

| | 변형 | 결과 |
|---|---|---|
| V1 | `extractFromJsonLd` 무력화 | 🔴 **2 failed** |
| V2 | precedence 역전(micro 우선) | 🔴 **1 failed** |
| V3 | `priceFromJsonLd` 의 통화 가드 제거 | 🟡 **6 passed** |
| V3b | 🟢 **진짜 owner** `resolveSourcePrice` 의 통화 가드 제거 | 🔴 **4 failed** |
| V4 | **generic 숫자 parser 주입**(「N원」) | 🔴 **4 failed** |
| — | 원상복구 | 🟢 6 passed |

🔴 **V3 를 조사했다 — 가드 공백이 아니다.** 통화 가드의 owner 는
`packages/pricing/src/price-validity.ts:resolveSourcePrice` 이고, `priceFromJsonLd` 의
`if (!currency)` 는 **도달하지 않는 두 번째 방어선** 이다(V3b 가 증명).

🟢 **V4 가 이 WU 의 핵심 안전 계약이다** — generic 숫자 parser 가 들어오면 **4건이 깨진다.**

---

## 10. Regression / typecheck / build

```
apps/admin  **587 files / 8,294 passed** / failed **0** (skipped 101)
🔴 CPO §10 포착 장치 — 포착된 실패명 **없음**
typecheck **0** · build **exit 0**
🟢 기존 계약 동반 확인 — WU-075 final URL · mi-020 HTTP 1회 · WU-056R1 가격구역 ·
   해외 참고가격 · 국내 가격 계약 **전부 통과**
```

🔴 금지 준수 — 운영 코드 변경 **0** · generic parser 0 · site adapter 0 · MI 0 ·
market 0 · AI/번역/Vision 0 · 배포 0. 🟡 HTTP **15 요청**(read-only GET).

---

## 11. Git / Production

`clean` · `behind/ahead 0 0` · Production `/` **200**. 🔴 운영 동작 변화 **0**(테스트·문서만).

---

## 12. Known Unknowns

```
① 🔴 **실패군 분모가 2** 다. 전수 498 이 아니라 WU-063 표본이다
② 🔴 **드리프트 관측** — 표(WU-063)의 C28 73,000 / C32 122,000 ↔ 오늘 JSON-LD
   54,750 / 91,500 · C22 117,000 → 134,000. **같은 시점 비교가 아니다**
③ 🔴 beaumonde 의 **진짜 판매가를 CTO 가 확정할 수 없다**(사람 확인 불가).
   그래서 「회수했다」가 아니라 **「CF 들이 서로 어긋난다」** 로만 적었다
④ 🔴 C27 타임세일 83,600 이 **현재 판매가인지** 미확인 — 「13일 남음」 문구만 있다
⑤ 🔴 `SHOPIFY_JSON` 경로가 HTML JSON-LD 를 못 보는 것은 **지금 증상이 없다**
   (`enrichCandidatePrices` 가 메운다). 그 경로가 실패하는 조건은 **미측정**
⑥ 🔴 CF-1 의 「판매가」 라벨은 **Cafe24/메이크샵 계열 관습** 이다 — 일반성 미측정
```

---

## 13. CPO 판단에 필요한 핵심 수치

```
진짜 실패군              **2** (beaumonde · 구조화 증거 0/0/0)
안전 축(CF-1) 오추출      **0/9**
안전 축 회수             **1/2**  ← 🔴 그 1건이 Human **DIFFERENT**
위험 축(CF-3) 오추출      **5/9**  → REJECT
downstream precision     60.0% → **50.0%** (버킷 5→6 · DIFFERENT 2→3)
최저가 변화              **없음**(₩88,000 유지)
generic parser 안전계약   **V4 4 FAIL** 로 잠금
```

---

## 14. 🔴 **REJECT**

> §15 의 세 등급 중 **REJECT** 다.

근거 셋 — §10 의 최소 성공 기준 **A·C 가 모두 미충족**:

```
A 회수 효과  🔴 안전하게 회수되는 1건이 **Human DIFFERENT** 다(SAME 은 회수 불가)
B 안전성     🟢 CF-1 은 False Extraction 0/9 — **이 축만 충족**
C downstream 🔴 국내 가격비교 precision 이 **60.0% → 50.0% 로 나빠진다**
⟹ 「가격을 더 찾는 것보다 틀린 가격을 찾지 않는 것이 우선」이라는 이번 WU 의
   전제를 **그대로 적용하면 REJECT** 다.
```

🔴 그리고 **Q7 의 답** — 「가격 추출이 국내 가격비교의 실질적 다음 병목인가」:
```
🔴 **아니다.** 진짜 실패군은 **2건** 이고 그중 회수 가능한 1건은 틀린 상품이다.
🟢 구조화 데이터가 있는 국내 샵은 **이미 전부 회수되고 있다**(성공군 9/9 · 오추출 0).
⟹ 남은 2건은 **JS 렌더 사이트 1곳** 의 문제이고 「가격 추출 축」이 아니라
   **「그 사이트를 어떻게 다룰 것인가」** 라는 site 정책 문제다(WU-054 가 이미 HOLD).
```

🟡 **보류 보관할 것 하나** — `SHOPIFY_JSON` 경로가 HTML JSON-LD 를 못 보는 구조.
지금은 `enrichCandidatePrices` 가 메워서 증상이 없지만, **그 경로가 실패하면 즉시
`PRICE_UNAVAILABLE`** 이 된다. 🔴 측정되지 않았으므로 WU 로 열지 않는다.

---

## 15. CEO Action — **없음**
