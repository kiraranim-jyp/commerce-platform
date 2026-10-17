# WU-052 FINAL — 국내 후보 URL 상품페이지 판별

> 🔴🔴 **판정 = HOLD. 구현하지 않았다.**
> 🔴 이유: **안전한 판별 증거가 없다.** 유일한 분리축(「JSON-LD Product 부재」)을 쓰면
> **우리 실제 취급 카테고리의 상품 페이지가 즉시 오차단된다**(tennis-warehouse).
> 🔴 운영 코드 변경 **0** · 새 URL 정규화기 **0** · 패턴 추가 **0**.

---

## 1. 현재 상품페이지 판별 구조 — **URL 단계 하나뿐이고 HTTP 앞이다**

```
candidateUrls
 → extractCandidateUrlsFromAiAnswer   canonicalizeProductUrl · 자기참조 제거
 → **classifyUrlShape**(url-shape.ts:59)   ← 🔴 판별은 «여기서만» 일어난다 (HTTP 0)
      NON_PRODUCT_FILE → UNKNOWN_PAGE      (index·about·list·search… **`.html?$` 일 때만**)
      PRODUCT_PATH     → PRODUCT_PAGE      (products|product|dp|itm|**goods**)/…
      PRODUCT_SUFFIX   → PRODUCT_PAGE      (**`.html` 이면 상품**)
      LISTING_PATH     → LISTING_PAGE      (collections|category|search|shop|brands|c)/
      그 외            → UNKNOWN_PAGE
 → (PRODUCT_PAGE 만) factsFromProductUrl → **HTTP 1회**
 → titleFromHtml 성공 → candidate 생성 → MI
```

🔴 **즉 HTTP 뒤에는 「상품인가」를 묻는 단계가 없다.** `titleFromHtml` 만 성공하면
후보가 된다 — 목록 페이지도 `<title>` 이 있으므로 통과한다.

---

## 2. 기존 증거 전수 관측 (실측 · 운영 `fetchPlainHtml` 사용)

| GT | host | shape | HTTP | JSON-LD `@type` | `og:type` | ld Product |
|---|---|---|---|---|---|---|
| LISTING | beaumonde.co.kr | 🔴 PRODUCT_PAGE | Y | **없음** | website | N |
| LISTING | coupleshot.com | 🔴 PRODUCT_PAGE | Y | **없음** | website | N |
| LISTING | lfmall.co.kr | 🟢 LISTING_PAGE | **N** | — | — | — |
| LISTING | lotteon.com | 🟢 LISTING_PAGE | **N** | — | — | — |
| LISTING | foretforet `/product/list.html` | 🟢 UNKNOWN_PAGE | **N** | — | — | — |
| PRODUCT | bobochoses.com | 🟢 PRODUCT_PAGE | Y | …**Product**… | product | Y |
| PRODUCT | tinyapple.net | 🟢 PRODUCT_PAGE | Y | Organization,**Product**,Offer | product | Y |
| PRODUCT | bobochoses.com | 🟢 PRODUCT_PAGE | Y | …**Product**… | product | Y |
| PRODUCT | foretforet.com | 🟢 PRODUCT_PAGE | Y | **Product**,Brand,Offer | website | Y |
| PRODUCT | 🔴🔴 **tennis-warehouse.com** | 🟢 PRODUCT_PAGE | Y | **없음** | — | **N** |

```
현재 분류기   FALSE PRODUCT-PAGE **2/5** · FALSE LISTING-PAGE **0/5**
```

🔴 **칸 이름을 또 추측했다** — 1차 관측에서 `ExtractedProductData.name` 을 읽어
**8/8 을 전부 `N`** 으로 잘못 적었다. 실제 칸은 **`title`**(:28)이다. 타입에서 읽어
고치자 상품 4건이 전부 `Y` 로 바뀌었다. 🔴 이 트랙 **열 번째** 같은 실수다.

---

## 3. 10축 — 핵심 질문의 답은 🔴 **아니오**

| 축 | 관측 | 판정 |
|---|---|---|
| ① URL shape | 판별은 여기서만 일어난다 | 🔴 `.php` 목록·`.html` 접미를 가르지 못한다 |
| ② extractor 결과 | 목록도 `title` 을 준다 | 🔴 분리력 0 |
| ③ product facts 존재 | 목록도 facts 를 만든다 | 🔴 분리력 0 |
| ④ **JSON-LD Product** | 상품 4/5 Y · 목록 0/2 Y | 🟡 **상관은 높다** — 🔴 그러나 §4 참조 |
| ⑤ Shopify 구조 | 상품 2건만 해당 | 🔴 커버리지 부족(국내 샵 0) |
| ⑥ title/product-name | 목록 title 도 상품명처럼 보인다 | 🔴 분리력 0 |
| ⑦ SKU/model | 목록에 없고 **상품에도 자주 없다** | 🔴 분리력 0 |
| ⑧ canonical URL | 둘 다 자기 자신을 가리킨다 | 🔴 분리력 0 |
| ⑨ `NO_FACTS` 처리 | 🟢 coupleshot 를 이미 막았다 | 🟢 **이미 동작** — 후보 생성 0 |
| ⑩ MI 진입 게이트 | 🟢 목록 2건을 **SIMILAR 로 거부** | 🟢 **이미 동작** — 가격/판정 영향 0 |

### 🔴🔴 ④ 가 왜 채택 불가인가 — **양성 목록 증거가 «존재하지 않는다»**

```
반사실 측정: 「ld@type 에 ItemList/CollectionPage/SearchResultsPage 가 있고
             Product 가 없으면 차단」  →  **차단 0건**
🔴 두 FALSE PRODUCT-PAGE 는 JSON-LD 를 **아예 갖고 있지 않다**(`ld=[-]`).
⟹ 「목록이라는 양성 증거」로는 **한 건도 막을 수 없다.** 효과 0.
```

🔴 그러므로 남는 규칙은 **「Product 증거의 부재로 차단」** 하나이고, 그 방향은
**금지된 방향**(확신 없이 차단)이다. 그리고 실측이 그 위험을 **실제 사례로** 보여준다.

---

## 4. 🔴🔴 안전성 측정 — 그 규칙을 쓰면 **FALSE LISTING-PAGE 가 0 → 1**

```
규칙 「JSON-LD Product 없으면 candidate pool 진입 차단」
  🟢 FALSE PRODUCT-PAGE   2 → 0   (beaumonde · coupleshot 제거)
  🔴 FALSE LISTING-PAGE   0 → **1**  ← **tennis-warehouse 상품 페이지**
```

🔴🔴 **tennis-warehouse 는 가설이 아니다**:
```
· WU-020 이 이미 실측했다 — 「`application/ld+json` **0개** · 가격은 **microdata** 에 있다」
· 이 WU 가 재확인했다 — `ld=[-]` · `og:type` **없음** → **FALSE PRODUCT-PAGE 2건과 모양이 같다**
· 🔴 그리고 **테니스의류는 우리 초기 2개 카테고리 중 하나다**(헌장 §12 Phase A).
  그 사이트의 상품 URL 을 영구히 못 읽게 된다.
```

🔴 CPO §4 의 기준(「상품페이지가 아닌 URL 을 잘못 차단하는 것이 실제 상품페이지를
차단하는 것보다 안전한지 **측정**」)에 **실측이 「아니다」로 답한다.**

### 🔴 「파일명을 더 넣자」도 금지이자 위험하다

```
beaumonde  `/goods/goods_list.php`   PRODUCT_PATH 의 `goods/` 에 걸린다.
                                     🔴 `NON_PRODUCT_FILE` 은 **`.html?$` 일 때만** 적용된다
                                        → `.php` 목록은 그 가드를 **지나간다**(§1-b 로 고정)
coupleshot `/shop/shopbrand.html`    PRODUCT_SUFFIX(`.html`)만으로 상품이 된다
🔴🔴 그리고 결정적으로 —
   `shopbrand.html`(목록) 과 `shopdetail.html`(상품) 은 **같은 분기로 통과** 한다.
   둘을 가르는 것은 **샵별 파일명 어휘 지식** 이고 우리에게 없다(§1-b 단언으로 고정).
⟹ 이름을 넣는 것은 CPO 가 금지한 「URL 문자열 패턴 차단」이고, 넣으면 그 어휘를
   다르게 쓰는 샵의 **진짜 상품** 이 조용히 죽는다.
```

---

## 5. 효과·비용 — 🔴 절감은 작고 위험은 영구적이다

```
이번 표본에서 목록에 쓴 비용   HTTP **3회** · MI 후보 **2개** · UI 가짜 후보 **0** (※)
  ※ 🟢 MI 가 둘 다 **SIMILAR** 로 거부했고 `MIN_DISPLAY_SIMILARITY` 하한 때문에
     화면 노출도 사실상 막힌다 — 가격·판매판정 영향 **0**(WU-051 실측)
🔴 반대쪽 비용  tennis-warehouse 계열 상품 **영구 차단** (테니스 카테고리 전체)
🔴 분모 주의    이 표본은 **AI 가 준 URL 이 전부 목록** 이라 적대적이다 —
                「HTTP 100% 절감」으로 일반화하지 않는다. N=6 이다.
```

---

## 6. CONTROL 결과

```
🟢 WU-051 6건 중 4건 재사용 + 실제 상품 CONTROL **5건** + 과거 결함 URL 1건 = **10건**
🟢 과거 결함 회귀  `/product/list.html?cate_no=110` → **UNKNOWN_PAGE** (여전히 막힌다)
🟢 실제 상품 5건  전부 **PRODUCT_PAGE** → FALSE LISTING-PAGE **0**
🔴 개선 여부      **개선하지 않았다** — 그래서 6건의 결과는 WU-051 과 **동일** 하다
```

---

## 7. 검증

```
하니스   wu-052-listing-page-evidence.test.ts
         §1/§2 실측(`WU_052_LIVE=1` · HTTP 6회 · 읽기 전용) + **§1-b 순수 관측 6건**
기본실행 **6 passed / 1 skipped** (live 는 기본 skip — 운영 CI 에서 외부 HTTP 0)
회귀     admin **560 files / 8,178 passed · failed 0**  (직전 559/8,172 → +1파일 +6)
typecheck **0**
build    🔴 미실행 — **운영 코드 변경 0**. 🟢 같은 tsconfig 의 `tsc --noEmit` 이 0
mutation 🔴 **없다** — 바꾼 운영 코드가 0 이라 변이 대상이 없다.
         🟢 대신 §1-b 가 **현재 적용 범위를 단언으로 고정** 한다 → 누군가 패턴을
            넣으면 그 단언이 FAIL 로 뒤집혀 「무엇이 바뀌었는지」가 드러난다
security 🟢 fetch/URL 경로 **무변경** — SSRF·redirect·DNS rebinding·사설IP 경계
         (`classifyOutboundUrl`·`guardedLookup`) 한 줄도 건드리지 않았다.
         🔴 하니스가 crawler 깊은 경로를 import 하지만 **테스트 파일** 이라 번들에
            들어가지 않는다(운영 `_lib` 의 WU-025 규약과 구분된다)
금지 전수 AI 0 · Gemini 0 · Registry 0 · 소싱→가격비교 0 · threshold 0 ·
         색상사전 0 · SKU/GTIN 0 · 시장분류 완화 0 · KRW→KR 0 · 환율 0 ·
         transient 저장 0 · **새 URL 정규화기 0** · **패턴 추가 0**
```

---

## 8. Production 상태

```
운영 코드 변경 0 → 기능 변화 0 · 화면 변화 0 · 배포 영향 0
직전 배포(ab551888 · WU-051)가 그대로 유효하다
```

---

## 9. 최종 판정

```
🟢 GO    — 아니다. 안전한 차단 규칙이 없다(§3·§4)
🟡 HOLD  — **그렇다.** 유일한 분리축이 실제 취급 카테고리의 상품을 오차단한다.
           🟢 그리고 현재 피해가 **이미 0** 이다 — ⑨⑩(NO_FACTS · MI)이 막고 있다
🔴 STOP  — 아니다. 외부 API/비용/ToS/보안 요인 없음
──────────────────────────────────────────
**HOLD**
```

🔴 **CPO 의 종료 조건과 일치한다** — 「안전한 판별 방법이 없으면 구현하지 않고 HOLD」.
🔴 그리고 「AI 가 실제 상품 URL 을 찾아오는 문제」는 **손대지 않았다** — 해결했다고
적지 않는다.

---

## 10. 남은 문제 (🔴 CTO 가 고르지 않았다)

```
🟡 ⒜ URL 단계는 포기하고 **HTTP 뒤 게이트** 를 두는가 — 「JSON-LD Product 도 없고
     og:type 도 product 가 아니면 **후보로는 만들되 표시/집계에서 내린다**」.
     🟢 차단이 아니라 **등급 강하** 라 FALSE LISTING-PAGE 가 0 이다.
     🔴 그러나 HTTP 는 절감되지 않고, tennis-warehouse 가 등급 강하 대상이 된다 →
        **테니스 카테고리의 유일한 가격원** 이므로 제품 영향이 있다. CPO 판정.
🟡 ⒝ microdata 순수 파서를 만들어 tennis-warehouse 를 **Product 증거 보유** 로 끌어올린
     «뒤» 에 ④ 규칙을 채택한다. 🟢 그러면 FALSE LISTING-PAGE 가 0 이 된다.
     🔴 WU-020 이 「공통 파이프라인을 닫는 데 반드시 필요하지 않다」며 보류한 바로 그
        파서다 — 순서가 **먼저 파서, 그 다음 차단** 이 된다. CPO 판정.
🔴 ⒞ 현상 유지 — 피해 0 이므로 아무것도 하지 않는다.
🔴 그리고 §1-b 가 드러낸 사실 하나: `NON_PRODUCT_FILE` 의 의도는 주석보다 **좁다**
   (`.html?$` 한정). 🔴 넓히는 것은 패턴 추가라 하지 않았다.
```

---

## 11. CEO Action — **NONE**
