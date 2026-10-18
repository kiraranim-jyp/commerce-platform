# WU-075 — 최종 URL 도착지 방어 최소 구현 (안 A · 구현 + E2E)

> 🔴 CPO GO 2026-10-18. 「안 A 만 구현 · 추가 fetch 금지 · `resolveCandidate` 전체 배선 금지 ·
> JSON-LD 필수화 금지 · `og:type` 게이트 금지 · soft-404 텍스트 휴리스틱 금지」

---

## 0. 결론 — 🟢🟢 **GO. 실데이터에서 6/6 제거 · 13/13 유지 · 오차단 0**

```
운영 변경 **2 파일** · 추가 HTTP **0** · 새 판별 규칙 **0** · 새 파서 **0**
실데이터 E2E(CEO 라벨 19건 · 실제 HTTP) — 비상품 **6/6 REDIRECTED_AWAY** ·
                                        정상 **13/13 OK** · 오차단 **0**
```

---

## 1. 변경 내용 — 2 파일

### ⒜ `shopify-product-json.ts` — `response.url` 을 보존한다

```ts
export async function fetchPlainHtmlWithFinalUrl(url)
  : Promise<{ html: string; finalUrl: string } | null>
  …
  return { html, finalUrl: response.url || url };   // 🟢 같은 응답에서 한 칸 더 읽을 뿐
```

🔴 기존 `fetchPlainHtml` 은 **지우지 않았다** — 새 함수에 위임하는 **얇은 껍데기** 로 남겼다.
```
운영 호출부가 둘이다 — product-url-facts(바꿨다) · site-strategies/shopify(안 바꿨다)
🔴 fetch 규칙(UA·타임아웃·상태코드)의 owner 를 **둘로 갈라 두지 않는다** —
   갈리면 한쪽만 고쳐져 조용히 달라진다(이 저장소에서 반복된 함정).
🟢 그래서 기존 호출부·기존 테스트는 **한 줄도 바꾸지 않았다.**
```

🔴 `response.url` 이 빈 문자열인 구현을 대비해 `|| url` 로 둔다 —
**「모른다」를 「다른 곳에 도착했다」로 읽지 않는다**(B4 가 잠근다).

### ⒝ `product-url-facts.ts` — 도착지의 모양을 본다

```ts
if (classifyUrlShape(finalUrl) !== "PRODUCT_PAGE") {
  return { status: "REDIRECTED_AWAY", … candidate: null };
}
```

🟢 **판별기를 새로 만들지 않았다** — 입구에서 이미 쓴 `classifyUrlShape` 를 **도착지에
한 번 더** 적용할 뿐이다. 입구에서 `PRODUCT_PAGE` 임을 확인했으므로, 여기서 달라졌다면
**서버가 우리를 다른 곳으로 보냈다** 는 뜻이다.

🟢🟢 **새 status 가 소비자 변경 0 으로 흐른다** — 두 drop union 이 `ProductUrlFactsStatus`
를 **그대로 포함** 한다(`AiAnswerPoolDrop` · `UrlCandidateDropReason`). UI/집계 수정 **0**.

---

## 2. 🔴 왜 `UNREACHABLE` 에 합치지 않았는가

```
UNREACHABLE  = 「응답을 **못 받았다**」(네트워크 실패 · HTTP 4xx/5xx)
REDIRECTED_AWAY = 「응답을 **받았는데 다른 것이었다**」(HTTP **200** · 홈/목록)
🔴 WU-074 실측 — CEO 가 「404」라 한 4건이 **전부 200** 이다. 둘을 합치면
   「우리가 못 받았다」와 「상대가 지웠다」가 한 칸에 뭉쳐 원인 추적이 끊긴다.
```

---

## 3. Positive / Negative / 경계 (네트워크 0 · 운영 함수 직접)

🔴 전역 `fetch` 를 가로채지 않았다 — 두 파일의 **공통 owner** 인
`fetchWithDomainRateLimit` 만 가로챘다(어느 층이 도는지 흐려지지 않게).

| | 시나리오 | 기대 | 결과 |
|---|---|---|---|
| P1 | 정상 상품 URL(리다이렉트 없음) | `OK` + 가격/브랜드 **그대로** | 🟢 |
| P2 | 리다이렉트 **후에도** 상품(`/en-sk/products/…`) | `OK` | 🟢 |
| N1 | 상품 → **홈** 리다이렉트 | `REDIRECTED_AWAY` | 🟢 |
| N1-b | 홈 + 추적 파라미터(`/?shpxid=…`) | `REDIRECTED_AWAY` | 🟢 |
| N2 | 상품 → **목록** 리다이렉트 | `REDIRECTED_AWAY` | 🟢 |
| B1 | 진짜 HTTP 404 | 기존대로 `UNREACHABLE` | 🟢 |
| B2 | 200 인데 제목 없음 | 기존대로 `NO_FACTS` | 🟢 |
| B3 | URL 모양이 애초에 상품 아님 | `NOT_PRODUCT_URL` · **HTTP 0** | 🟢 |
| B4 | `response.url` 이 빈 문자열 | `OK`(요청 URL 로 본다) | 🟢 |
| S1 | Shopify JSON 이 홈을 줌 | HTML 폴백 → `REDIRECTED_AWAY` | 🟢 |
| S2 | Shopify JSON 이 상품을 줌 | `SHOPIFY_JSON` · **httpCalls 1** | 🟢 |
| W1 | **AI 후보 경로** 실제 실행 | `dropped` 에 `REDIRECTED_AWAY` | 🟢 |
| W2 | **URL 후보 경로** 실제 실행 | 동일 | 🟢 |
| W3 | drop 사유 타입 포함(컴파일 계약) | — | 🟢 |

🔴 **W1·W2 는 `fetchFacts` 를 주입하지 않았다** — 기본값이 운영 함수여야 배선 검사가
의미를 갖는다. 소스 grep 으로 「배선돼 있다」고 적지 않았다.

🔴 **내 기대가 한 번 틀렸다** — N1 의 `httpCalls` 를 **1** 로 적었는데 실제 **2** 다.
`/products/X` 는 Shopify handle 모양이라 JSON 1 + HTML 폴백 1 이다(**기존 폴백 그대로** ·
이 변경이 요청을 늘린 것이 아니다 — S2 가 JSON 성공 시 1회임을 잠근다).

### 🟢🟢 실데이터 E2E — CEO 라벨 19건 · **실제 HTTP**

```
S1-1~S1-7 · S2-1~S2-4 · S3-1 · S6-4   상품   → **OK**        (13/13)
S3-2 S4-1 S5-1 S6-1 S6-2 S6-3         비상품 → **REDIRECTED_AWAY** (6/6)
오차단 **0**
```

---

## 4. Mutation — 🔴 CPO 가 요구한 **두 방향 + 둘 더**

baseline **14 passed**

| | 변형 | 결과 |
|---|---|---|
| M1 | **최종 URL 분류 제거**(`if (false)`) | 🔴 **6 failed** |
| M2 | **요청 URL** 로 다시 분류 | 🔴 **6 failed** |
| M3 | 🔴 **`response.url` 을 안 쓴다**(`finalUrl: url`) | 🔴 **6 failed** |
| M4 | 상태코드 가드(`!response.ok`) 제거 | 🔴 **1 failed** |
| — | 원상복구 | 🟢 **14 passed** |

🟢 **M3 이 CPO 가 요구한 증명이다** — 「실제로 `response.url` 을 쓰고 있다」.

---

## 5. 회귀 / Type / Build

```
apps/admin  **581 files / 8,280 passed** / failed **0** (skipped 98)
typecheck **0** · build **exit 0**
🟢 WU-074 baseline(580/8,266)에서 **+1 file / +14 test**
```

### 🔴 §10 — 회귀에서 **1 failed 가 실제로 나왔고 이름을 포착했다**

```
mi-020-candidate-price-evidence.test.ts
  › 「htmlPath 의 HTTP 는 **여전히 1회** 다」
원인: WU-020 의 가드가 **함수 «이름» 문자열**(`await fetchPlainHtml(`)을 세고 있었다.
      🟢 성질(HTTP 1회)은 **보존** 됐고 owner 이름만 바뀌었다.
조치: 가드를 **유지하고 이름을 넓혔다**(`fetchPlainHtml\w*`) — 그리고 **강화** 했다:
      `fetchWithDomainRateLimit` · `await fetch(` 로 몰래 늘리는 길도 막는다.
      🔴 이름만 보던 그 가드는 원시 fetch 추가를 **막지 못하고 있었다.**
```

🔴 금지 준수 — 추가 fetch **0** · `resolveCandidate` 전체 배선 **안 함** ·
JSON-LD 필수화 **0** · `og:type` 게이트 **0** · soft-404 텍스트 휴리스틱 **0** ·
MI/가격/시장판정 변경 **0** · schema **0** · UI **0**.

---

## 6. 🔴 Known Unknowns

```
① 🔴🔴 **리다이렉트하지 «않는» 200 soft-404 는 여전히 통과한다** —
   같은 URL 에 200 으로 「없는 상품입니다」를 그리는 사이트. WU-074 표본에 **0건** 이고
   **미측정** 이다. 🔴 CPO 지시대로 텍스트 휴리스틱을 **넣지 않았다**(WU-076 대상)
② 🔴 「오차단 0」은 **N=64**(CEO 13 + WU-036 GT 51)에서의 0 이다. 전수 0 이 아니다
③ 🔴 상품 → **다른 상품** 으로 보내는 리다이렉트는 `OK` 로 남는다(모양이 상품이라서).
   그것이 옳은지는 **제품 정책** 이고 이 WU 범위 밖이다
④ 🔴 `site-strategies/shopify` 는 기존 `fetchPlainHtml` 을 그대로 쓴다 —
   그 경로에는 이 방어가 **없다**(원상품 수집 경로이고 후보 경로가 아니다)
⑤ 🔴 WU-074 가 관측한 **`facts.brand = "Kids21"`**(사이트명 오염)은 이번 변경으로
   그 6건에서는 사라지지만, **다른 모양의 사이트명 오염** 은 미측정이다
```

---

## 7. Final Gate

```
Code PASS:   🟢        Deploy PASS:            🟢
Test PASS:   🟢        Production UI PASS:     ⚪ 해당 없음(UI 변경 0)
Type PASS:   🟢        Production API PASS:    ⚪ 해당 없음
Build PASS:  🟢        Production PASS:        🟡 동작 확인은 아래 §8
```

🟡 **셀러가 보는 변화** — AI/URL 후보 목록에서 **홈·목록으로 튄 후보가 사라진다**.
🟢 가격·판정·집계 숫자는 **바뀌지 않는다**(그 6건은 이미 `PRICE_UNAVAILABLE` 이었다 · WU-074).

## 8. CEO Action — **없음**
