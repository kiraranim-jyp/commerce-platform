# WU-053 FINAL — Microdata Product Evidence 안전 도입

> 🟢🟢 **판정 = GO.** JSON-LD 가 **없는** 정상 상품 페이지(tennis-warehouse)가
> **USD 98 · brand Sergio Tacchini** 를 얻었다. 🔴 False SAME 증가 **0** ·
> 추가 HTTP **0** · Playwright **0** · 기존 상품페이지 회귀 **0**.

---

## 1. WU-020 보류 사유 — 🟢 **「가치 없음」이 아니라 「호출 수단이 없음」이었다**

```
기존  extractFromMicrodata(page: Page)   product-data-extractor.ts:476
      └─ 내부가 `page.evaluate()` → **Playwright 의존**
후보 경로  factsFromProductUrl → fetchPlainHtml → **HTML 문자열뿐**
⟹ 🔴 그 함수를 **부를 수가 없었다.** 그것이 WU-020 이 microdata 를 보류한 이유다.
```
🟢 이 사실을 테스트로 고정했다(`wu-053-microdata-evidence.test.ts` §1-b) — 다음 세션이
「microdata 는 가치가 없다」로 오독하지 않도록.

---

## 2. 🔴🔴 구현 전에 **안전 질문** 을 먼저 쟀다

내가 처음 세운 우려는 이것이었다:

> 「목록 페이지는 각 상품을 microdata 로 마킹한다(ItemList 안의 Product).
> 첫 `[itemprop="name"]` 을 읽으면 **목록의 첫 상품** 이 상품 증거가 된다.」

실측(운영 `fetchPlainHtml` · 8건):

| GT | host | ld Product | **Product scope** | 목록 scope | name/sku/price/cur/brand/offers |
|---|---|---|---|---|---|
| PRODUCT | bobochoses ×2 | Y | **0** | 2 | 4/0/0/0/0/0 |
| PRODUCT | tinyapple.net | Y | **0** | 0 | 0/0/0/0/0/0 |
| PRODUCT | foretforet.com | Y | **0** | 0 | 0/0/0/0/0/0 |
| PRODUCT | 🔴🔴 tennis-warehouse ×2 | **N** | **1** | 0 | **2/5/5/5/1/5** |
| LISTING | beaumonde.co.kr | N | **0** | 0 | **0/0/0/0/0/0** |
| LISTING | coupleshot.com | N | **0** | 0 | **0/0/0/0/0/0** |

```
🟢 내 우려가 **발생하지 않았다** — 목록 2건은 microdata 가 **전무** 하다.
🟢 JSON-LD 상품 4건은 Product scope **0** → 이 기능이 **발화하지 않는다**(회귀 0).
🔴 그래도 **게이트를 넣었다** — N=2 로 「목록엔 microdata 가 없다」를 법칙으로 쓰지 않는다.
```

---

## 3. 구현 — 운영 3파일 · 🔴 **보강만 한다**

```
packages/crawler/src/product-data-extractor.ts
  + extractMicrodataFromHtml(html)   **순수 함수** · Playwright 0 · HTTP 0
    🔴 안전 게이트: schema.org/Product scope 가 **정확히 1개** 일 때만 읽는다
       0개  → 읽을 것이 없다
       2개+ → **목록** 이다 → 읽지 않는다
    🟢 기존 `resolvePriceField` 재사용 — 통화 없는 금액은 가격으로 만들지 않는다
    🟢 DOM 판과 **같은 규약**: `[itemprop]` 문서순 첫 요소 · `content` 우선, 없으면 텍스트
packages/crawler/src/index.ts            + barrel export
packages/crawler/src/comparison-search/product-url-facts.ts
    const micro  = extractMicrodataFromHtml(html);          ← 이미 받은 html
    const brand  = brandFromHtml(html)  ?? micro?.brand ?? null;
    const priced = priceFromJsonLd(html) ?? micro?.price ?? null;
```

🔴🔴 **`sku` 는 올리지 않았다** — `match.ts:461` 의 SKU exact-match 로 들어가
identity 를 바꿀 수 있고, CPO 가 「False SAME 증가 = 즉시 HOLD」로 못 박았다.
🟢 대신 **반사실로 측정** 했다(§5). 🔴 `extractFromMicrodata`(Playwright 판)는
**한 줄도 바꾸지 않았다.**

---

## 4. 🟢 CONTROL 여섯 유형 — 실측 (운영 `factsFromProductUrl`)

| 유형 | status | HTTP | price | priceStatus | brand | sku |
|---|---|---|---|---|---|---|
| JSON-LD 상품 (bobochoses) | OK | 1 | 없음 | — | Bobo Choses | — |
| JSON-LD 상품 국내 (tinyapple) | OK | 1 | 없음 | — | Bobo Choses | — |
| JSON-LD 상품 Cafe24 (foretforet) | OK | 1 | **KRW 258000** | VERIFIED_CURRENT | PEPE SHOES | — |
| 🔴🔴 **microdata-only** (tennis-warehouse) | OK | 1 | 🟢 **USD 98** | 🟢 **VERIFIED_CURRENT** | 🟢 **Sergio Tacchini** | — |
| 🔴 목록 (beaumonde) | OK | 1 | 없음 | — | — | — |
| 🔴 목록 (coupleshot) | NO_FACTS | 1 | — | — | — | — |

```
HTTP 합계 **6** = 6건 × 1회  → 🟢 **microdata 때문에 늘지 않았다**
목록 2건  🟢 가격 획득 **0** — 거짓 상품 증거 **0**
🟢 Shopify 경로(bobochoses·tinyapple)는 `price: null` 이 **설계** 다(통화 미상 ·
   product-url-facts.ts:189) — 가격은 뒤의 `enrichCandidatePrices` 가 채운다
```

🔴🔴 **내 단언이 한 번 틀렸다 — 숨기지 않고 적는다.** 그 두 Shopify 건을
「JSON-LD 상품」으로 묶고 `VERIFIED_CURRENT` 를 기대했다가 FAIL 했다. HTML+JSON-LD
경로의 회귀 대조군은 **foretforet** 이다. 단언을 사실에 맞게 고쳤다.

---

## 5. 🔴 KPI 전수 — CPO §5 항목을 **각각** 적는다

```
FALSE PRODUCT-PAGE    2/5 → **2/5** (변화 0 — 이 WU 는 차단을 손대지 않았다)
FALSE LISTING-PAGE    0/5 → **0/5** (변화 0)
NO_FACTS              coupleshot 1건 → **그대로** (목록이 상품이 되지 않았다)
가격검증              🟢 **+1** — microdata-only 상품이 VERIFIED_CURRENT 획득
HTTP 횟수             6 → **6** (추가 0)
MI SAME               WU-038 GT 셋 **불변**(그 후보는 전부 Product scope 0)
🔴 False SAME         **0 → 0**
🟡 SAME MISS          변화 0
기존 상품페이지 회귀    **0** — JSON-LD 상품 4건 전부 Product scope 0 → 발화 안 함
```

### 🔴🔴 sku 반사실 — **올려도 되는지 «실제로» 쟀다**

```
원상품  Sergio Tacchini Men's Trattino **Short**  (sku `STMFTS0BL01`)
후보    Sergio Tacchini Men's Trattino **Polo**   (microdata sku `STMFTP0`)
GT      **DIFFERENT** (다른 품목)
현행(sku 미올림)   verdict = **SIMILAR**   🟢 False SAME 아님
반사실(sku 올림)   verdict = **SIMILAR**   🟢 False SAME 아님
```

🔴 **그런데 N=1 이고, 그 하나로 「안전하다」고 단정하지 않는다** — 그래서 **올리지
않았다.** 🟡 올릴 가치가 생기면 **표본을 늘려** 다시 재는 것이 순서다.

🔴🔴 **이 반사실이 처음엔 무효였다 — 이것도 적는다.** 나는 `dna.sku?.value` 로 썼고
**그 칸은 존재하지 않는다**(실제는 `identifier` 이고 `tier === "SKU"` 일 때만 쓴다 ·
`ProductIdentityDna:57`). 그래서 1차 실행은 `query.sku === undefined` 로 돌아
**`match.ts:461` 경로가 발화조차 하지 않았다.** 운영 식(run-domestic-price-check.ts:786)
을 베껴 고친 뒤 비로소 유효해졌다. 🔴 이 트랙 **열한 번째** 칸 이름 추측 실수다.

---

## 6. 음성 대조

```
M1 microdata **가격** 보강 제거   **2 FAIL**  (tennis 가격이 사라진다)
M2 microdata **브랜드** 보강 제거 **2 FAIL**  → 🟢 브랜드가 microdata 출처임의 증명
M3 **Product scope 1개 게이트** 제거(`!== 1` → `< 1`)  **1 FAIL** (목록 방어 무력화)
원상복구 **12 passed**
```

🔴 **계약 테스트 1건을 «의도적으로» 갱신했다** — `mi-020-candidate-price-evidence.test.ts`
가 import 줄을 **문자열로** 고정하고 있었다(`{ extractFromJsonLd }` 정확히).
🟢 WU-020 이 지키려던 것은 그 **이름** 이 아니라 **「Playwright 를 끌어오지 않는 순수
함수만 쓴다 · 추가 HTTP 0」** 이므로, **허용 목록** 으로 다시 적었다 —
`["extractFromJsonLd", "extractMicrodataFromHtml"]`. 🔴 이름이 하나라도 늘면 **다시
깨지고 승인이 필요하다.** 느슨하게 지우지 않았다.

---

## 7. 검증

```
신규 하니스  wu-053-microdata-evidence(§1 관측 · §1-b 보류사유) ·
             wu-053-microdata-wiring(게이트 6 · 배선 3 · 실측 1)
기본 실행    **12 passed** (live 포함) / 기본 skip 시 11 passed
회귀         admin **562 files / 8,188 passed · failed 0**
typecheck    **0**
build        **exit 0**
security     🟢 fetch 경로 **무변경** — SSRF·redirect·DNS rebinding·사설IP 경계
             (`classifyOutboundUrl`·`guardedLookup`) 한 줄도 건드리지 않았다.
             🟢 **client bundle 위험 0** — 새 함수는 **순수 문자열 처리** 이고
             `node:dns`·Playwright 를 끌어오지 않는다(WU-025 규약 유지 · build 0 확인)
금지 전수    URL blacklist 0 · 파일명 지식 0 · 「JSON-LD 부재 = 목록」 0 ·
             threshold 0 · MI SAME 정책 0 · COLOR/SKU/GTIN 정책 0 · Registry 0 ·
             AI 0 · Gemini 0 · sourcing 연결 0 · 가격 «정책» 0 · 새 identity 축 0
```

---

## 8. 최종 판정

```
🟢 GO    — **그렇다.** microdata 를 기존 증거 체계에 편입했고, tennis-warehouse 가
           살아났으며(USD 98 · brand 획득), False SAME 증가 **0** 이다
🟡 HOLD  — 아니다
🔴 STOP  — 아니다
──────────────────────────────────────────
**GO**
```

🔴 **과장하지 않는다** — 이 WU 가 한 것은 **「JSON-LD 가 없는 상품 페이지의 가격·브랜드
증거를 살린 것」** 하나다. 「목록 URL 차단」(WU-052 HOLD)은 **여전히 미해결** 이고
「AI 가 상품 URL 을 찾아오는 문제」도 **손대지 않았다.**

---

## 9. 남은 문제

```
🟡 ⒜ WU-052 가 HOLD 한 목록 차단 — 🟢 **그 전제가 바뀌었다.** 이제 tennis-warehouse 가
     **microdata Product 증거를 갖는다** ⟹ 「Product 증거(JSON-LD **또는** microdata)가
     없으면 후보로 올리지 않는다」가 이 표본에서 **FALSE LISTING-PAGE 0** 이 된다.
     🔴 단 그것은 **차단 규칙** 이라 별 WU 이고 CPO 판정이다(표본도 N=5 로 작다).
🔴 ⒝ `sku`/`sellerSku` 승격 — N=1 반사실만 있다. 표본을 늘려야 판단 가능.
🔴 ⒞ microdata `description`·`color`·`material` 은 **읽지 않았다** — 범위를 넓히면
     WU 가 끝없이 커진다(WU-020 이 같은 이유로 선을 그었다).
🟡 ⒟ 정규식 리더의 한계: 중첩 scope 추적 없음 · 태그가 끼면 텍스트가 빈다(그때
     `undefined` — 지어내지 않는다). 🔴 사이트가 늘면 재측정이 필요하다.
```

---

## 10. Production

```
🔴 미배포 — 커밋/푸시 후 Vercel 이 받는다(main push = 배포).
운영 3파일 변경 · 기능 변화는 **microdata-only 상품에서만** 발생한다
(JSON-LD 상품은 Product scope 0 이라 한 글자도 바뀌지 않는다).
```

## 11. CEO Action — **NONE**

🔴 화면에 새 구역이 생기지 않는다. 변하는 것은 **테니스 해외 후보가 가격을 갖게 되는
것** 이고, 그 가격은 WU-049/051 규칙대로 **「🌐 해외 참고가격」(USD)** 으로만 쓰인다 —
국내 최저가·판매판정에는 들어가지 않는다.
