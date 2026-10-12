# MI-GEMINI-INTEGRATION-VALIDATION-002 — SAME 재현성 측정

> 🟢🟢 **재현됐다.** 다른 상품·다른 브랜드에서도 `SAME`(conf **1.0**)과
> `PRESUMED_SAME` 3건이 나왔다.
> 🔴🔴 **COUNTERFACTUAL / NON-PRODUCTION DISCOVERY MEASUREMENT** — Gemini Discovery
> 에는 운영 호출부가 **없다**(선행 WU 전수 확정). 이 숫자는 운영 성능이 아니다.
> 🔴 **코드 변경 0 · threshold 0 · DB 쓰기 0 · 배포 0.**

---

## 1. 측정 설계 — 전부 **기존 owner**

```
① 쿼리   generateQueries(identity)                     discovery-benchmark
② 발견   createGoogleDiscoveryProvider({}).discover(identity, query)   🔴 인자 둘
③ 해석   resolveCandidate(searchUrl, provenance, probe)  url-resolver.ts:52
         🟢 probe = **createLivePageProbe()** — 리포의 실제 HTTP 구현
④ 후보화 factsFromProductUrl(url)                       product-url-facts.ts:125
⑤ 판정   withConfidence(query, [candidate])             match.ts:476
```

🔴 `sample` — 상품 **N=5**(브랜드 전부 다름) · 상품당 후보 상한 **3**.
비용 — Gemini 호출 **5** · resolve **9** · fetch **14**. readiness `READY`.

---

## 2. 🔴🔴 첫 실행이 «거짓 결론» 을 냈다 — 내 probe 결함

```
1차 실행:  12/12 가 **UNKNOWN_PAGE** → 「Gemini 후보는 못 쓴다」로 읽힐 숫자
🔴 원인: `PageProbe` 를 손으로 만들었다.
   실제 타입은 `(url) => Promise<{status, finalUrl, canonicalUrl}>` 이고
   **리다이렉트를 따라가야** 한다. 내 probe 는 `{finalUrl: u, status: 200}` 을
   그대로 돌려줘서 finalUrl 이 **vertexaisearch 리다이렉트 URL** 그대로였다.
🟢 리포에 실제 구현이 **이미 있었다** — `createLivePageProbe`(live-page-probe.ts:87).
   선행 하니스 둘이 그것을 쓰고 있었다(mi-p0-02-live-measure · mi-p0-03).
🔴 메모 `gemini-discovery-is-unblocked-and-returns-url-only` 가 그 함정을
   **글자 그대로 적어 뒀는데** 내가 probe 를 자작해서 다시 밟았다.
```

🟢 교체 후 분류가 갈렸다 — `PRODUCT_PAGE` 6 · `LISTING_PAGE` 1 · `NOT_FOUND` 1 ·
`UNUSABLE` 1.

---

## 3. 결과 — 후보 단위 (🔴 Fetch 실패를 SAME 실패로 섞지 않았다)

```
SAME              **1**
PRESUMED_SAME     **3**
SIMILAR            2
NOT_PRODUCT_PAGE   3   ← 🔴 UNUSABLE 1 · NOT_FOUND 1 · LISTING_PAGE 1
FETCH_FAIL         0
UNKNOWN / CONFLICT 0
```

### 상품 단위 (N=5)

| 상품 | Gemini | 결과 |
|---|---:|---|
| **Bonjour** Tunique With Hair Clip | 20 | 🟢🟢 **SAME** (conf **1.0**) + SIMILAR 1 |
| **BOSS** Baby Boys White Logo Top | 12 | 🟡 **PRESUMED_SAME ×3** (conf 1.0 · 1.0 · 0.61) |
| **Arsène et Les Pipelettes** Short Fiorenza | 6 | 🔴 SIMILAR 1 (conf 0.38) |
| **Bobo Choses** Shirt and Pants Set | **0** | 🔴 Gemini 후보 0 |
| **Bonpoint** Lilibet Fleurie Dress | **0** | 🔴 Gemini 후보 0 |

### 🟢 `SAME` 의 근거 (시스템 값 그대로 — Bonjour)

```
후보 제목  "Tunique With Hair Clip in Blue Flower Field …"
reasons    핵심 상품명 clip/hair/tunique · 상품군 blouse · 소재 cotton:100 ·
           대상 KIDS · 사이즈 체계 AGE ↔ AGE
blockers 0 · conflicts 0 · confidence **1.0**
🟢 축 5개가 SAME_MIN_AXES=5 를 채웠다 — 🔴 **품번 없이** 또 SAME 에 닿았다
```

### 🟡 `PRESUMED_SAME` 3건의 이유 — **blocker 1개** (BOSS)

```
reasons    핵심 상품명 baby/boys/logo/top · 색상 WHITE · 소재 cotton:100 ·
           대상 KIDS · 사이즈 체계 AGE/MONTH ↔ AGE/MONTH
🔴 blockers **1** — 세 번째 후보의 reasons 에 그 정체가 찍혔다:
   「보류: **양쪽 브랜드를 확인하지 못했다**」
→ 🟢 즉 축은 5개가 쌓였는데 **brand 축이 확인 안 돼** SAME 이 보류됐다.
   🟢 보수적 동작이다(brandOk 가 SAME 의 전제다 — cross-seller.ts).
🔴 원상품 brand 는 "BOSS" 다. 후보 쪽 brand 를 못 읽은 것인지, 「BOSS ↔ HUGO BOSS」
   표기 차이인지는 **미조사** 다.
```

🟢 **같은 상품이 두 번 `PRESUMED_SAME`(conf 1.0)으로 나왔다** — 같은 상품을
파는 서로 다른 두 URL 이다. 🟢 재현성의 직접 증거다.

---

## 4. 🔴 Gemini 후보 0건이 2/5 다 — 그리고 그 둘은 공통점이 있다

```
Bobo Choses  "Organic Cotton Embroidered Shirt and Pants Set | Ecru"   color 🔴 null
Bonpoint     "Lilibet Fleurie Embroidered Dress | Ecru"                color 🔴 null
→ 🔴 둘 다 **색상이 null** 이고 상품명이 길고 일반적이다.
🔴 단 「색상 null 이 원인」이라고 **단정하지 않는다** — N=2 이고 쿼리 생성 결과를
   이 WU 에서 열어보지 않았다. 🟢 다만 색상이 있던 3건은 **전부 후보를 받았다.**
```

---

## 5. CPO 가 정한 세 갈래 중 — **「여러 상품에서 SAME 가능」**

```
🟢 여러 상품에서 동일하게 SAME 가능 → **Gemini → MI Integration 구현 WU 로 이동**
   근거: 상품 2개(Bonjour · BOSS)에서 SAME/PRESUMED_SAME 이 났고, 선행 WU 의
         Dinossi 건을 합치면 **서로 다른 3개 브랜드**에서 재현됐다
🔴 특정 상품군 반복 실패 → 해당 없음(실패 모양이 서로 다르다)
🔴 Fetch 실패가 많다 → **해당 없음.** FETCH_FAIL **0** 이다
   (NOT_PRODUCT_PAGE 3 은 fetch 실패가 아니라 **분류 단계** 다)
```

🔴 **단 Integration 구현은 Production 변경이고 CPO/CEO 결정 영역이다.** CTO 가
먼저 들어가지 않는다.

---

## 6. Known Unknowns

```
🔴 sample 상품 **N=5** · 후보 9개. 🔴 일반화 금지
🔴 BOSS 의 blocker 「양쪽 브랜드를 확인하지 못했다」의 정체 미조사
   (후보 brand 미추출 ↔ BOSS/HUGO BOSS 표기 차이)
🔴 Gemini 후보 0건 2건의 원인 미조사 — 쿼리 텍스트를 열어보지 않았다
🔴 `NOT_PRODUCT_PAGE` 3건(UNUSABLE·NOT_FOUND·LISTING_PAGE)을 더 파지 않았다
🔴 후보 가격은 이 경로에서 **전건 null** 이다(product-url-facts 의 의도된 동작).
   가격 비교까지 가려면 `enrichCandidatePrices` 가 더 필요하다
🔴 SAME 1건의 「사람 눈」 확인은 CTO 판독이다(CPO/CEO 확인 안 받았다)
🔴 Gemini 호출은 상품당 **쿼리 1개(queries[0])** 만 썼다 — 다른 축을 쓰면
   결과가 달라질 수 있다(미측정)
```
