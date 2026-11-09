# DOMESTIC-STRUCTURED-BRAND-COVERAGE-1 — 국내 샵이 «구조화 brand» 를 선언하는가

> 🔴 **READ-ONLY 측정 전용.** 운영 코드 **0** · DB **0** · matcher **0** · BRAND Evidence **0** ·
> threshold/GT **0** · `PRESUMED_SAME` 승격 **0** · WU-020 **유지** · 미커밋 39건 보존.
> 🔴 **이 결과로 matcher 나 BRAND Evidence 를 바꾸지 않는다**(CPO 명시).
> 🔴 **국내 전체 시장의 성질로 확대 해석하지 않는다** — 이 표본의 관찰이다.
> 측정 도구 `apps/admin/.../__tests__/domestic-structured-brand-coverage-1.test.ts`(`DSBC_LIVE=1`).

---

## 0. 결론 — **「거의 제공하지 않는다」 쪽이다. 단 분모는 6 이다**

```
🟢🟢 CONTROL(운영이 **실제로 판정한** 국내 상품 상세 URL · 전부 HTTP 200 · N=6)
     Product JSON-LD 존재      **2 / 6**     ← 🟢 JSON-LD 를 «쓰기는» 쓴다
     **Product.brand 선언**    🔴🔴 **0 / 6**
     microdata Product         🔴 **0 / 6**
     본문에 브랜드명            🟢 **6 / 6**
⟹ 🔴 「JSON-LD 를 안 쓴다」가 아니라 **「Product 를 쓰면서도 brand 칸을 안 적는다」** 다.
⟹ 🟢 CPO 의 두 갈래 중 **「현재 상품군의 국내 판매처가 구조화 브랜드를 거의 제공하지
   않는다」** 쪽이다 — 🔴 **단 N=6** 이고 국내 전체가 아니다.
```

---

## 1. CONTROL — 유효 측정 (N=6)

| 도메인 | HTTP | JSON-LD | `Product.brand` | microdata | 본문 브랜드 | `og:site_name` |
|---|---|---|---|---|---|---|
| `donokids.com` | 200 | 🟢 **Product** | 🔴 **없음** | 🔴 없음 | 🟢 있음 | — |
| `vividvia.com` | 200 | 🔴 없음 | 🔴 없음 | 🔴 없음 | 🟢 있음 | **VIVIDVIA** |
| `miniboutique.co.kr` | 200 | 🔴 없음 | 🔴 없음 | 🔴 없음 | 🟢 있음 | 미니부띠끄 |
| `biskuit.kr` | 200 | 🔴 없음 | 🔴 없음 | 🔴 없음 | 🟢 있음 | **비스킷** |
| `coupleshot.com` | 200 | 🟢 **Product** | 🔴 **없음** | 🔴 없음 | 🟢 있음 | — |
| `kids-world.com` | 200 | 🔴 없음 | 🔴 없음 | 🔴 없음 | 🟢 있음 | — |

🔴🔴 **CPO 가 요구한 분리대로 적는다** — `Product.brand`(0/6)와 `og:site_name`·도메인명·
본문 텍스트는 **별도 칸** 이다. 🟢 그리고 `og:site_name` 이 **샵 이름**(「VIVIDVIA」·「비스킷」)
이라는 사실이 **왜 그것을 brand 로 승격하면 안 되는지** 를 그대로 보여준다(WU-009 반증의 재현).

🟢 이 표가 `DOMESTIC-EXACT-PRICE-DISCOVERY-1` 의 두 blocker 를 **설명한다**:
```
donokids  → Product 는 있는데 brand 칸이 없다      ⟹ `BRAND_UNCONFIRMED` = **정확한 상태**
vividvia  → brand 없음 · og:site_name 「VIVIDVIA」 ⟹ 샵 이름이 들어오면 `BRAND_MISMATCH` 모양
```

---

## 2. 🔴 frame 측정(N=19)의 **JSON-LD 숫자는 무효다** — 내가 먼저 의심했다

```
frame 실행값  조사 도메인 19 · 접근 가능한 상품 페이지 14 ·
              Product JSON-LD **0/14** · Product.brand 0/14 · 본문에만 브랜드 4
🔴🔴 **그 0 을 보고하지 않았다.** CONTROL 에서 **2/6** 이 나왔기 때문이다 ⟹ 모순이다.
🔴 원인 — frame 은 상품 URL 을 **홈 1-hop + `classifyUrlShape`** 으로 골랐는데
   **WU-073 이 기록한 오분류** 가 있다(한국 CMS 목록 `goods_list`·`product_list`·
   `shopbrand` 를 **`PRODUCT_PAGE` 로 읽는다**) ⟹ 일부는 **목록 페이지를 읽었다**.
🟢 그래서 frame 에서 살아남는 관측은 **접근성 · `og:site_name` · 본문 브랜드명** 뿐이다.
```

### frame 에서 유효한 부분만

| 측정 항목 | 결과 |
|---|---|
| 조사 도메인(분모) | **19** |
| robots 전면차단 | **0** |
| 홈 접근 실패 | **1** (`ocokorea.com`) |
| 상품 링크 미발견 | **3** (`coconjennie` · `karymarket` · `kids-world`) |
| 상품 페이지 HTTP 실패 | **1** (`bobochoses.com` **429**) |
| 페이지까지 도달 | **14** |
| `og:site_name` 이 **샵 이름** | 11/14 에서 관측(브랜드명 아님) |

🔴 **실패·차단을 분모에서 숨기지 않았다**(CPO ⑥) — 19 = 14 도달 + 5 미도달.

---

## 3. 🔴 분모가 **30 이 아니다** — 이유를 숨기지 않는다

```
⒜ `WebSearch` 가 **US-only** 다 — 「보보쇼즈 아동복 쇼핑몰」로 검색해도 결과가
   Nordstrom · thedoublef · nickis … **국내 쇼핑몰이 한 곳도 안 나온다**(실측)
⒝ **URL 을 지어내지 않는다**(이 저장소의 금지 행위) ⟹ 상품 URL 은 ⓐ DB 실측 또는
   ⓑ 그 사이트가 **스스로 건 링크**(홈 1-hop)에서만 얻는다
⒞ 등록부 35행 중 **21곳이 포털/오픈마켓/가격비교** 라 **약관으로 제외** 했다
   (메모 `portal-scraping-blocked-by-terms` · 성능 때문이 아니다)
⟹ 🟢 그래서 분모를 **「제품이 실제로 아는 국내 판매처 전수 19」** 로 잡았다.
   🔴 유효 측정(CONTROL)은 그중 **6** 이다.
```

---

## 4. CPO 보고 양식

| 측정 항목 | 결과 |
|---|---|
| 조사 도메인 | **19** (🔴 30 아님 · §3) |
| 접근 가능한 상품 페이지 | **14** (frame) · **6** (CONTROL · 유효) |
| Product JSON-LD 존재 | **2 / 6** (CONTROL) 🔴 frame 값 무효 |
| **Product.brand 선언** | 🔴🔴 **0 / 6** |
| 실제 브랜드와 일치 | **측정불가** — 선언이 0 이라 분모가 없다(0% 가 아니다) |
| brand 가 문자열/객체 | **측정불가** — 같은 이유 |
| 본문에만 브랜드 존재 | 🟢 **6 / 6** (CONTROL) |
| microdata Product | 🔴 **0 / 6** |

---

## 5. 이 측정이 **답한 것 / 답하지 못한 것**

```
🟢 답했다 — 「우리가 아직 못 찾은 것인가, 샵이 제공하지 않는 것인가」
   ⟹ **샵이 제공하지 않는다**. 운영이 실제로 만난 6곳에서 `Product.brand` **0/6** 이고
      본문엔 **6/6** 있다. 🔴 그 간극을 메울 수단은 **전부 동결·REJECT** 다
      (본문 라벨 WU-080 §10 · domain→brand 계약 · og:site_name WU-009 반증).
🔴 답하지 못했다
   ⒜ **N=6** 이다 — 국내 아동의류 전반의 비율이 아니다
   ⒝ frame 14곳의 **진짜 상품 페이지** 기준 비율(그 URL 선택이 오염됐다)
   ⒞ 포털/오픈마켓(21곳)은 **약관으로 측정 대상이 아니다** — 「0」으로 세지 않는다
   ⒟ JS 렌더로 **클라이언트에서** JSON-LD 를 주입하는 샵이 있는지(정적 HTML 만 봤다)
```

🟡 **더 재려면**(🔴 CTO 가 착수하지 않았다) — frame 의 URL 선택을 `classifyUrlShape` 가
아니라 **사이트맵(`sitemap.xml`)** 에서 뽑으면 ⒝ 가 닫힌다(추가 HTTP ~19 · 운영 변경 0).
