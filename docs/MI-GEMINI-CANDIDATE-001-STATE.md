# MI-GEMINI-CANDIDATE-001 — Gemini 후보를 MI 가 SAME 으로 인정하는가

> 🟢🟢 **답: 인정한다. `Dinossi` 후보가 `SAME` 이다.**
> 🔴 **조사 전용.** 코드 0 · threshold 0 · scoring 0 · Discovery 0 · UI 0 · 배포 0 ·
> DB 쓰기 0 · 검색 재실행 0.
> 🔴🔴 **원인 판정 = ⑤ + ①** — MI 는 정상이고, 실제 문제는 **Gemini 결과를 MI 후보
> 입력으로 연결하는 Discovery/Integration 계층** 이다.

---

## 1. 대상

```
원본   Holly Hearts Ribbed Velvet Baby Pants | Pale Pink
       smallable.com/.../holly-hearts-ribbed-velvet-baby-pants-pale-pink-louis-louise-…
       brand Louis Louise · color Pink · sku AAA1847110 · EUR 69   🟢 **DB 에 실재**
후보   Gemini 가 준 URL **3개 그대로**(검색 재실행 0)
```

### 🔴🔴 지시서 모순을 먼저 기록한다 (추측으로 고치지 않았다)

지시서 §1 은 「Smallable — **정확한 Pale Pink** 상품 페이지」를 1순위로 적었다.
🔴 그런데 함께 준 URL 은 `…baby-pants-**navy-blue**-louis-louise-441172` 다.
🟢 URL 을 **그대로** 썼고(§1 「Gemini 가 실제로 찾아온 URL 그대로」) 색상 불일치를
표에 명시했다. 🔴 **navy 를 pink 로 바꿔 부르지 않았다** — 그러면 「다른 색상을
SAME 으로」가 된다.

---

## 2. Step 1 — 원본 ProductFacts (운영이 Identity 에 실제로 넘기는 값)

```
brand            🟢 "Louis Louise"
brandModelCode   🔴 null
coreTitleTokens  🟢 ["holly","hearts","ribbed","velvet","baby","pants","pale"]
colorText        🟢 "Pink"
materialText     🟢 "100% Cotton"
categoryText     🟢 "Home > Fashion Baby > Girl > Trousers, Jeans, Leggings, …"
sellerSku        🟢 "AAA1847110"
sizeLabels       🟢 ["6 months","12 months","18 months","24 months"]
audienceSignals  🟢 [5] (Home · Fashion Baby · Girl · …)
```
🟢 **원본 facts 는 충분하다.** 🔴 `brandModelCode` 만 null 이다(Smallable 은 자체
SKU `AAA…` 를 쓰고 브랜드 품번을 적지 않는다 — 선행 WU 와 정합).

---

## 3·4·5. 후보별 결과 — 🟢 **운영 owner 경로 그대로**

경로: `factsFromProductUrl(url)`(product-url-facts.ts:125) → `withConfidence(query, [candidate])`

| 후보 | fetch | 후보 facts | **crossSellerVerdict** | confidence |
|---|---|---|---|---|
| **Smallable** (navy) | 🔴 **UNREACHABLE** · PLAIN_HTML · 1 call | 🔴 없음 | 🔴 **판정 불가** | — |
| **Hive Boutiques** | 🟢 OK · **SHOPIFY_JSON** · 1 call | 🟢 brand·color·tokens 있음 | 🟡 **PRESUMED_SAME** | 0.44 (`low`) |
| **Dinossi** | 🟢 OK · **SHOPIFY_JSON** · 1 call | 🟢 전 축 있음 | 🟢🟢 **SAME** | **0.81** (`medium`) |

### 🟢 Dinossi — `SAME` 의 근거 (시스템이 낸 값 그대로)

```
title     "Louis Louise - Holly Hearts Ribbed Velvet Baby Pants | Light Powder Pink"
reasons   근거: 핵심 상품명 baby/hearts/holly/ribbed/velvet
          근거: 상품군 pants
          근거: 색상 PINK
          근거: 소재 cotton:100
          근거: 대상 KIDS
blockers  []        conflicts  []
matchReasons  모델명 유사도 70% · 카테고리 일치 · 브랜드 일치
```
🟢 **축 5개가 쌓여 `SAME_MIN_AXES = 5` 를 채웠다.** 품번 없이도 SAME 에 닿았다 —
`cross-seller.ts` 주석이 설계로 적어 둔 그대로다(「430701 은 TITLE 없이도 SAME 에
닿는 설계다」).

### 🟡 Hive Boutiques — `PRESUMED_SAME` 인 이유

```
title     "Baby Girls' Holly Trouser"       ← 🔴 상품명이 «Holly Trouser» 다
reasons   핵심 상품명 «일부» baby/holly · 색상 PINK · 대상 KIDS ·
          사이즈 체계 AGE/MONTH ↔ MONTH
blockers  []   conflicts  []
materialText 🔴 null   categoryText "Children - Clothing - Baby - Bottoms"
```
🟢 `hearts`·`ribbed`·`velvet`·`pants` 가 제목에 **없다**(그 샵이 축약명을 쓴다).
→ 축이 4개여서 **5 에 한 칸 모자라** `PRESUMED_SAME` 이다. 🟢 **정상 판정이다.**

### 🔴 Smallable — `UNREACHABLE`

```
status UNREACHABLE · fetchPath PLAIN_HTML · httpCalls 1
```
🔴 Smallable 은 HTML 경로이고 **이 환경에서 가져오지 못했다.** 🟢 선행 메모가 그
원인을 이미 적어 뒀다 — `smallable-market-is-shipping-destination`·
`measure-with-the-production-function`: **CSP 헤더가 17KB 라 기본 fetch 는
`UND_ERR_HEADERS_OVERFLOW` 로 죽고, 리포는 `node:https` + `maxHeaderSize 64KB` 로
해결했다.** 🔴 `factsFromProductUrl` 의 PLAIN_HTML 경로가 그 설정을 쓰는지는
**이 WU 에서 확인하지 않았다**(미조사).
🔴 그리고 그 URL 은 애초에 **navy-blue** 라 성공했어도 색상 불일치였다.

---

## 6. 원인 판정 — **⑤ + ①** (①~⑤ 중)

```
① MI Identity 정상 → Gemini 후보 자체가 동일상품이 아님
   🟡 **부분 해당** — Smallable 후보는 **navy** 였다(원본은 Pale Pink).
      Gemini 가 색을 틀리게 준 것이다
② ProductFacts 추출 문제        🟢 해당 없음 — 2/3 에서 전 축 추출됨
③ ProductFacts → Identity 전달  🟢 해당 없음 — 키 수 before == after
④ Identity 판정 로직 문제        🟢 **해당 없음**
⑤ Gemini 후보는 동일상품이며 MI 도 SAME 정상
   🟢🟢 **해당** — Dinossi 가 `SAME`(confidence 0.81 · blockers 0 · conflicts 0)
```

### 🔴🔴 그러므로 §14 의 분기 중 **아래쪽**이다

> 「MI 가 해당 후보를 정상적으로 **SAME** 으로 판단한다면 → **MI 는 정상**이고
>  실제 문제는 **Gemini 결과를 우리 MI 후보 입력으로 연결하는
>  Discovery/Integration 계층** 이다」

🟢 **MI 검증 계층을 수정 대상으로 올리지 않는다.** 🔴 그리고 이 결과는
「국내 판매처에 식별정보가 부족하다」는 기존 설명과 **충돌하지 않는다** — 이번
후보 셋은 **전부 해외 샵**(Dinossi US · Hive US · Smallable EU)이고 **Shopify
JSON 을 주는 샵** 이었다. 🔴 국내 샵(Cafe24 목록)에는 그 JSON 이 없다.

---

## 7. 코드 변경 — **없음**
🟢 하니스 1개만 추가했다(`mi-gemini-cand-01.test.ts`). 런타임 변경 0 · 배포 0.

## 8. 결론

```
MI 문제인가?            🟢 **아니다** — 정보가 있으면 SAME 을 낸다(0.81)
ProductFacts 문제인가?   🟢 아니다 — 2/3 에서 전 축 추출
Pipeline 문제인가?       🟢 아니다 — 전달 손실 0
Gemini 후보 문제인가?    🟡 **일부 그렇다** — Smallable 후보가 navy(색 불일치)였고
                        Hive 는 축약 상품명이라 축이 한 칸 모자랐다
🔴 그리고 **Smallable 을 못 읽는 것** 이 별 문제로 남았다(UNREACHABLE)
```

## 9. 다음 WU 필요 여부 — 🟡 **있다. 단 MI 가 아니라 Integration 이다**

```
🔴 가장 가치 있는 하나 — **Gemini 결과를 MI 후보로 «연결하는» 운영 경로가 없다.**
   선행 WU 가 전수로 확정했다(경로 D: 운영 호출부 0 · counterfactual).
   🟢 이 WU 가 그 연결의 «가치» 를 처음으로 증명했다 — 해외 샵 후보 하나가
      품번 없이도 SAME 에 닿았다.
🔴 단 그것은 **Production 변경** 이고 CPO/CEO 결정 영역이다. CTO 가 먼저 들어가지 않는다.
🔴 부수 과제 — factsFromProductUrl 의 PLAIN_HTML 경로가 maxHeaderSize 를 쓰는지
   (Smallable UNREACHABLE 의 원인). 🔴 이 WU 에서 확인하지 않았다.
```

## 10. Known Unknowns

```
🔴 sample N=1 상품 / 후보 3개. 🔴 일반화 금지
🔴 Smallable UNREACHABLE 의 «정확한» 원인 미조사(헤더 초과인지 차단인지)
🔴 후보 가격이 3건 모두 null 이다 — product-url-facts.ts 가 의도적으로 가격을
   채우지 않는다(선행 WU 확정: 「모르는 가격을 숫자로 만들지 않는다」).
   🟢 결함이 아니다. 🔴 단 가격 비교까지 가려면 enrichCandidatePrices 가 더 필요하다
🔴 Dinossi SAME 1건이 «사람 눈으로도» 동일상품인지 CPO/CEO 확인을 받지 않았다
   (CTO 판독: 제목·색·소재·상품군이 전부 일치한다)
🔴 Hive 의 PRESUMED_SAME 을 SAME 으로 올려야 하는지는 **정책 판단** 이다.
   🔴 threshold 를 건드리지 않았다
```
