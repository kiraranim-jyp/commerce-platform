# WU-074 — Product Evidence / soft-404 오염 전수 규명 (측정 전용 · 구현 0)

> 🔴 CPO 지시 2026-10-18. 「원인 확정 → 전수검토 → 최적안 → 보고」까지.
> hard gate 즉시 구현 ❌ · JSON-LD 필수화 ❌ · URL classifier 수정 ❌ · MI 완화 ❌

---

## 0. 결론 — 🟢🟢 **최적안이 이미 리포에 있고, 비용이 0 이다**

```
① 원인   ④ 의 게이트는 **둘뿐** 이다 — HTTP ok + `<title>` 존재.
         🔴 그래서 「`/products/X` 를 요청했는데 **홈이 왔다**」를 구분할 수 없다.
         🔴🔴 CEO 가 「404」라고 본 4건이 **전부 HTTP 200** 이다 ⟹ 진짜 soft-404.
② 최적축 **최종 도착 URL 의 모양을 다시 본다.** 비상품 **6/6 차단** · 오차단 **0/64**.
         🟢 기존 운영 함수 `resolveCandidate` 가 **이미 그 일을 한다**(배선만 없다).
         🟢🟢 그리고 추가 HTTP **0** — `fetchPlainHtml` 은 **이미 리다이렉트를 따라가고**
            `response.url` 을 **버리고 있을 뿐** 이다.
③ 기각   JSON-LD 필수화 · 구조화+가격 · og:type · soft-404 텍스트 · HTTP 404 — 전부 기각.
         🔴 특히 soft-404 **텍스트** 는 **정상 상품에서 더 많이** 터진다(11 > 2).
```

---

## 1. ① 코드 레벨 원인 — **확정**

```
⒜ fetchPlainHtml(shopify-product-json.ts:602)
     if (!response.ok) return null;          ← 상태코드 게이트는 여기 하나
     return await response.text();           ← 🔴 `response.url`(최종 도착지)을 «버린다»
⒝ product-url-facts.ts:226-228
     const title = titleFromHtml(html);
     if (!title) return NO_FACTS;            ← 🔴 **통과 조건이 이것뿐이다**
⟹ 「요청한 URL」과 「응답을 만든 URL」이 다를 수 있다는 사실이 **표현되지 않는다.**
```

🔴 그리고 **HTTP 404 는 이 표본에서 한 건도 없다** — CEO 가 404 라고 본 4건이 전부 **200** 이다.
⟹ `!response.ok` 가드는 **soft-404 에 대해 구조적으로 무력** 하다.

### 🟢🟢 그런데 방어는 **이미 구현돼 있다 — 이 경로에 배선되지 않았을 뿐이다**

```
resolveCandidate(discovery-core/url-resolver.ts:78-101)
   ⒜ status 404|410              → NOT_FOUND
   ⒝ rel=canonical 이 다르면        → target 을 그쪽으로 옮긴다(CANONICALIZED)
   ⒞ 「모양은 상품인데 도착지가 상품이 아니면」 → UNUSABLE
🟢 그 주석이 **`main-story.com` 을 실측 사례로 지명** 한다 — CEO 의 **S4-1 바로 그것** 이다.
🟢 `live-page-probe.ts:19-24` 주석도 **`canonical=/404`** 를 이미 적어 뒀다.
```

🔴🔴 **배선 비대칭(전수 grep · 이것이 결함의 정확한 형태다)**:

| 후보 경로 | `resolveCandidate` | `factsFromProductUrl` |
|---|---|---|
| **Gemini** 후보 | 🟢 `gemini-candidate-pool.ts:290` | :298 |
| **AI** 후보 | 🔴 **없다** | `ai-answer-pool.ts:95` **직접** |
| **URL** 후보 | 🔴 **없다** | `url-candidate-pool.ts:154` **직접** |

🔴 WU-073 이 funnel 을 잰 경로가 바로 **AI 후보** 다 — 방어가 없는 쪽이다.

---

## 2. ② 축별 전수 — 차단 vs 오차단

분모: **비상품 6**(🔴 CEO 가 직접 적은 사유로만 — CTO 라벨 0) · **정상상품 64**(CEO 13 + WU-036 GT 51)

| 축 | 비상품 차단 | 🔴 정상상품 오차단 | 판정 |
|---|---:|---:|---|
| CF-6 **현재 로직**(title 만) | 0/6 = **0%** | 0/64 | 🔴 오염 전량 통과 |
| CF-3 HTTP 404/410 | 0/6 = **0%** | 0/64 | 🔴 **무력**(전건 200) |
| CF-5 soft-404 **텍스트** | 2/6 = 33.3% | **11/64 = 17.2%** | 🔴 **기각**(오탐이 더 많다) |
| CF-1 JSON-LD Product 없음 | 6/6 = 100% | **8/64 = 12.5%** | 🔴 기각 |
| CF-2 구조화 Product + 가격 없음 | 6/6 = 100% | **8/64 = 12.5%** | 🔴 기각 |
| CF-2b `og:type` ≠ product | 6/6 = 100% | **6/64 = 9.4%** | 🔴 기각 |
| CF-4 `canonical` → 루트 | 6/6 = 100% | **0/64 = 0%** | 🟡 가능 |
| 🟢 **CF-7 `resolveCandidate`(운영)** | **6/6 = 100%** | **0/64 = 0%** | 🟢 **최적** |
| 🟢🟢 **CF-8 최종 URL 모양 ≠ 상품** | **6/6 = 100%** | **0/64 = 0%** | 🟢🟢 **최소·무비용** |

### 🔴 오차단되는 정상 상품 — 누가 죽는지 이름으로 적는다

```
og:type 축 (6건) — **전부 한국 쇼핑몰** 이다
   wconcept · luxboy · mustit · donokids ×3
   ⟹ 이 축을 채택하면 국내 recall 을 더 깎는다(WU-073 의 ⑥ 병목과 같은 방향)
구조화 축 (8건) — rboutique · eraldo · junioredition · thefrontshop ·
   kids21 · wconcept · **beaumonde ×2**
   ⟹ 🔴 **WU-054 가 「Human SAME 1건이 죽는다」고 HOLD 한 그 beaumonde** 가 또 나온다
soft-404 텍스트 (11건) — 정상 상품 본문에 「Not Found」류 글자가 흔하다
```

---

## 3. ③ 🔴 변이가 내 인과 설명을 **정정했다**

**Mutation** — baseline **2 passed**

| | 변형 | 결과 | 해석 |
|---|---|---|---|
| W1 | 도착지 모양 가드(`shape="UNUSABLE"`) 제거 | 🟡 **2 passed** | 🔴 **내 설명이 틀렸다**(아래) |
| W2 | `isCrawlable` 항상 true | 🔴 **1 failed** | 🟢 이것이 진짜 잠금 |
| W3 | `404/410` 분기 제거 | 🟡 2 passed | 🟢 전건 200 이라 **원래 안 쓰인다** |
| W4 | `canonical` 분기 제거 | 🟡 2 passed | 🟢 이 표본은 **리다이렉트만으로** 루트에 닿는다 |
| W5 | 도착지 대신 **요청 URL** 로 분류 | 🔴 **1 failed** | 🟢🟢 **축의 정체를 확정** |
| — | 원상복구 | 🟢 2 passed | |

🔴🔴 **W1 이 통과한 이유 — 그리고 그것이 더 좋은 소식이다**:
```
루트 URL 은 애초에 `PRODUCT_PAGE` 가 아니고, `isCrawlable` 이
`classification === "PRODUCT_PAGE"` 를 요구하므로 **이미 막힌다.**
⟹ 막는 것은 `UNUSABLE` 라인이 아니라 **「최종 URL 의 모양을 본다」는 사실 하나** 다.
🟢 그래서 필요한 것은 함수 전체 배선이 아니라 **그 한 가지 성질** 이다(CF-8).
```

🟢 **CF-8 의 비용이 0 인 근거** — `fetchPlainHtml` 의 `fetch` 는 **이미 리다이렉트를
따라간다**(기본값). 지금은 `response.url` 을 **읽지 않을 뿐** 이다.
⟹ 추가 HTTP **0** · 새 파서 **0** · 새 규칙 **0**(기존 `classifyUrlShape` 재사용).

---

## 4. 🔴 오염이 «어디까지» 가는가 (하류 추적)

```
비상품 6건의 하류 — 🟢 **가격에는 들어가지 않는다**
   price `null` · priceStatus `PRICE_UNAVAILABLE` **6/6**
   ⟹ ⑤ 가격 게이트가 막는다(깊이방어 작동 · WU-073 과 동일 결론)
🔴 그러나 **두 곳이 오염된다**:
   ⒜ 화면 후보 목록 — 「상품」으로 보인다(WU-010 이 관측한 성질)
   ⒝ 🔴 **판정 입력** — kids21 2건의 `facts.brand` 가 **"Kids21"**(= 사이트명) 이다.
      브랜드 축에 쓰레기가 들어간다. 🟢 지금은 BRAND_MISMATCH 쪽(= 안전 방향)이지만
      **거짓 충돌** 이고, 반대 방향으로 터질 모양은 **미측정** 이다.
```

---

## 5. 전수검토 10축

| 축 | 결과 |
|---|---|
| ① 기존 코드 재사용 | 🟢🟢 **성립** — `resolveCandidate` · `classifyUrlShape` · probe 의 canonical 추출기가 **전부 이미 있다** |
| ② 기존 계약 확장 | 🟡 `fetchPlainHtml` 이 `{html, finalUrl}` 을 돌려주는 **최소 변경** — 호출부 1곳 |
| ③ 다른 기존 producer | 🟢 Gemini 경로가 **이미 올바르게** 한다(배선 비대칭이 결함의 형태) |
| ④ transient 경로 | ⚪ 해당 없음 |
| ⑤ Registry | 🔴 금지(§12-0) · 그리고 불필요 |
| ⑥ 외부 Search | 🔴 금지 |
| ⑦ AI | 🔴 금지 |
| ⑧ 데이터/UX 우회 | 🟡 「확인 불가」 뱃지 — 🔴 노출을 늘리는 변경이라 안 골랐다 |
| ⑨ **현재 금지된 방법** | 🔴 JSON-LD 필수화 — CPO 가 금지했고 **데이터도 기각**(오차단 8/64) |
| ⑩ 새 비용/ToS/보안 | 🟢 **없다** — 추가 요청 0 · 키 0 · 외부 서비스 0 |

---

## 6. 회귀 / Type / Build

```
apps/admin  **580 files / 8,266 passed** / failed **0** (skipped 97)
🔴 CPO §10 포착 장치 적용 — 포착된 실패명 **없음**
typecheck **0** — 🔴 한때 **1** 이었다(내 캐시 타입 선언에 `finalUrl` 누락) · baseline 대비로 잡았다
build **exit 0** · WU-073 baseline(579/8,264)에서 **+1 file / +2 test**
```

🔴 금지 준수 — 운영 코드 변경 **0** · hard gate 0 · JSON-LD 필수화 0 · classifier 수정 0 ·
MI gate 0 · 가격 parser 0 · 국내시장 판정 0 · **새 AI/API 0** · 배포 0.
🟡 HTTP **89 요청**(19 수집 + 70 resolve) — read-only GET · 키 0 · 결제 0.

---

## 7. 🔴 Known Unknowns

```
① 🔴 **비상품 분모가 6 이다.** CEO 가 라벨한 것만 쓴다(CTO 가 만들지 않았다).
   「오차단 0%」도 **N=64 에서의 0** 이지 전수 0 이 아니다
② 🔴 **soft-404 가 리다이렉트하지 «않는» 형태는 이 표본에 없다** — 같은 URL 에
   200 으로 「없는 상품입니다」를 그리는 사이트에서는 CF-8 이 **발화하지 않는다.**
   🔴 그 모양은 **미측정** 이고 CF-8 의 진짜 상한이다
③ 🔴 CEO 는 **브라우저** 로 봤고 우리는 **서버 fetch** 다. 🟢 제목이 WU-067 때와
   전건 일치해 드리프트는 0 이었지만, 두 관측이 같다고 **단정하지 않는다**
④ 🔴 `facts.brand = "Kids21"` 이 반대 방향(거짓 일치)으로 터지는 경우는 미측정
⑤ 🔴 ②번 배선을 넣으면 **Shopify JSON 경로**(`/products/X.json`)에도 같은 질문이
   생긴다 — 그 경로의 리다이렉트 거동은 **측정하지 않았다**
```

---

## 8. Final Gate

```
Code PASS:   ⚪ 해당 없음(운영 변경 0)   Deploy PASS:         ⚪ 해당 없음
Test PASS:   🟢                        Production UI PASS:  ⚪ 해당 없음
Type PASS:   🟢                        Production API PASS: ⚪ 해당 없음
Build PASS:  🟢                        Production PASS:     ⚪ 해당 없음
```

## 9. CEO Action — **없음**

---

## 10. 🟡 CPO 판단용 — 구현안 (CTO 가 고르지 않았다 · 구현 0)

```
안 A (최소 · 권고 후보)  `fetchPlainHtml` 이 `response.url` 을 함께 돌려주고
   `factsFromProductUrl` 이 **최종 URL 로 모양을 다시 본다**. 다르면 `NOT_PRODUCT_URL`.
   🟢 추가 HTTP 0 · 파일 2개 · 기존 `classifyUrlShape` 재사용 · 비상품 6/6 · 오차단 0/64
   🔴 교환 — ②번 Known Unknown(리다이렉트 없는 soft-404)은 **여전히 통과한다**

안 B (전체 배선)  AI/URL 후보 경로도 `resolveCandidate` 를 거치게 한다.
   🟢 Gemini 경로와 **동작이 하나로 합쳐진다**(지금은 둘로 갈려 있다)
   🔴 후보당 **+1 HTTP**(probe) · 🔴 그리고 A 가 주는 것 이상을 이 표본에서 주지 않는다

🔴 **둘 다 「판별 정책 변경」** 이다 — WU-052 가 HOLD 한 영역과 인접하므로 CPO 판정 사안.
🟢 단 WU-052 의 HOLD 사유(「URL **문자열** 로 목록/상품을 가를 안전 증거가 없다」)와는
   **다른 축** 이다 — 이것은 문자열 추측이 아니라 **서버가 실제로 어디로 보냈는가** 다.
```
