# WU-017-E2E — 주어진 URL 에 대한 **판정 정확도** 실측 (AI/API ₩0)

🔴 AI 호출 **0** · Gemini **0** · 외부 검색 API **0** · 키 **0** · 결제 **0** ·
DB 쓰기 **0** · schema **0** · UI **0** · 배포 **0** · threshold **0** · Registry **0**.
🟡 쓴 비용은 **판매처 GET 9회** 뿐이다(선행 WU 들과 같은 종류).

---

## 1. 🔴🔴 먼저 — 이 측정은 「AI Recall」이 아니다

지시서 §2 는 「사람이 브라우저에서 AI 로 조사해 답변을 붙여넣는다」 다.
🔴 **CTO 는 그것을 할 수 없다** — 소비자 AI 웹 UI 자동화는 헌장 §12 에서 STOP 이고
AI API 는 CPO 가 전면 금지했다. 그래서 **AI 가 찾아온 URL 을 쓰지 않았다.**

🟢 대신 입력 URL 을 **운영 DB 실데이터** 에서 가져왔다(읽기 전용 덤프 2개 ·
`mi-017-e2e-urlset-dump.mjs` · `mi-017-e2e-case-dump.mjs`). 체인은 URL 이 어디서
왔는지 모르므로(`collectAiAnswerCandidatePool` 은 텍스트만 받는다) **그 뒤 판정
정확도는 그대로 측정된다.**

```
🟢 적을 수 있는 것   「주어진 URL 에 대한 판정 정확도」
🔴 적을 수 없는 것   「AI 가 동일상품을 얼마나 찾아오는가」 — 분모가 AI 가 아니다
```

🟢 원상품 query 는 **운영 owner 로** 만들었다(복제 0):
`buildProductIdentityDna` → `productFactsFromIdentityDna`(check/route.ts:52 ·
run-domestic-price-check.ts:732·733·801·808 과 1:1).
🔴 GT 는 **우리 판정(`match_truth`)이 아니다** — 품번(sku)·상품명·색상으로 CTO 가
손으로 정하고 케이스마다 근거를 적었다.

---

## 2. 후보별 GT / 판정 비교표 — **sample: 원상품 3 · 케이스 4 · URL 11**

| # | GT | 입력 URL | 체인 결과 | 판정 |
|---|---|---|---|---|
| 1 | SAME | bobochoses.com/products/**b226ac010**-booty-ghosts-t-shirt | `SAME` / very_high / **0.97** | 🟢 |
| 2 | DIFFERENT_SAME_BRAND | bobochoses.com/products/**b226ac070**-stamp-bloom-… | `CONFLICT` / low / 0.3 | 🟢 |
| 3 | NOT_PRODUCT_PAGE | bobochoses.com/collections/new-arrivals-kid | 제외 `NOT_PRODUCT_PAGE` (**HTTP 0**) | 🟢 |
| 4 | SELF | junioredition.com/products/booty-ghosts-… | 제외 `SELF_REFERENCE` | 🟢 |
| 5 | SAME_OTHER_MARKET | junioredition.com/**en-kr**/collections/…/products/booty-ghosts-… | 제외 `SELF_REFERENCE` | 🔴 |
| 6 | SAME_OTHER_MARKET | bobochoses.com/products/b226ac117-… | `PRESUMED_SAME` / very_high / 1.0 | 🟢 |
| 7 | SAME_OTHER_MARKET | bobochoses.com/**en-kr**/products/b226ac117-… | 제외 `DUPLICATE` | 🔴 |
| 8 | UNREACHABLE(404 실측) | bobochoses.co.jp/**en-kr**/products/b226ac117-… | 제외 `SELF_REFERENCE` | 🟡 제외는 맞고 **이유가 틀렸다** |
| 9 | SAME | foretforet.com/shop/shopdetail.html?**branduid**=10226592 | `SIMILAR` / low / 0.55 | 🟡 |
| 10 | SAME | deuxbebe.com/product/detail.html?**product_no**=8021 | `SIMILAR` / low / 0.58 | 🟡 |
| 11 | DIFFERENT_COLOR | junioredition.com/en-kr/products/lulu-t-bar-shoes-**in-tobacco**-by-pepe | `CONFLICT` / medium / 0.78 | 🟢 |

🔴 9·10 은 **수정 전에는 `NO_FACTS` / `UNREACHABLE`** 이었다(아래 §4).

---

## 3. Precision / Recall — 🔴 분모를 같이 적는다

```
Precision (동일상품으로 «올린» 것 중 실제 동일)   2/2 = **100%**   sample N=2
  🟢 거짓 SAME **0** — GT 가 「다르다」류인 2건(브랜드만 같음 · 색상만 다름)이
     둘 다 `CONFLICT` 였다. 특히 **같은 모델 01195 의 다른 색상을 CONFLICT 로 갈랐다.**
Recall (GT 동일상품 6건 중 동일상품 판정)        2/6 = **33%**     sample N=6
  손실 4건 = 로케일 병합 2 + 국내 축 부족 2
```

🔴 **N=2 / N=6 을 「우리 시스템의 정확도」로 일반화하지 않는다.** 그리고
**threshold 를 낮춰 Recall 을 올리지 않았다**(CPO·헌장 금지).

---

## 4. 🔴🔴 오판 원인 — **함수 하나다**

```
toCrawlerUrl(url-shape.ts:105)
  ① 쿼리스트링을 뗀다  → ?branduid= · ?product_no= 가 사라져 **빈 페이지** 를 읽는다
  ② 로케일을 뗀다      → /en-kr/ 를 넣어도 **Global 페이지** 를 읽는다
```

🟢 **실측으로 특정했다**(추측 아님):
```
foretforet.com/shop/shopdetail.html?branduid=10226592 → shopdetail.html → **89바이트** → NO_FACTS
deuxbebe.com/product/detail.html?product_no=8021&…    → detail.html     → **응답 없음** → UNREACHABLE
🟢 두 URL 을 직접 열면 **200 · og:title 정상**(243,951B / 212,603B)
```

### 4-A. 🟢 고쳤다 — ① 식별 파라미터 보존 (최소 수정)

🔴 **비-Shopify 분기 한 곳** 만 바꿨다. `canonicalizeProductUrl`(WU-009C)을 통과시켜
추적·검색 문맥 파라미터만 걷고 `?branduid=`·`?product_no=`·`?variant=` 는 **남긴다**.
🟢 **새 규칙 0** — self-reference.ts 가 이미 「그 셋은 식별 정보다」라고 적어 뒀다.
🟢 기존 계약 전수 확인: 비-Shopify 쿼리 제거를 단언한 테스트는 **없었다**(회귀 0건 실패).
🟢 효과: 국내 2건이 **제외 → 후보** 로 살아났다(`SIMILAR` 0.55 · 0.58).

### 4-B. 🔴 고치지 않았다 — ② 로케일 (**CPO 판정 사안**)

Shopify 분기의 로케일 제거는 **명시적 제품 계약** 이다 — 「KR 방문자가 보는 KRW 가
들어오면 원산지 기준가가 아니다」(discovery-benchmark.test.ts:123-125 가 이유까지 적어 뒀다).
🔴 그 대가가 지금 측정에 그대로 나왔다:
```
`/en-kr/` 를 넣어도 Global 페이지를 읽으므로 **KR 시장 증거를 이 경로로는 얻을 수 없다**
→ WU-008 이 `.com/en-kr` 에서 `KRW 258,000` 을 실측했는데 그 시장에 **닿지 못한다**
→ 로케일 URL 은 `DUPLICATE`(같은 페이지) 또는 `SELF_REFERENCE`(원상품과 같은 listing)로 접힌다
```
🔴 **내가 이 비교 기준을 바꿔 봤고 더 나빠져서 되돌렸다**(실측):
```
입력 URL 기준으로 바꾸면 →
  bobochoses.com/products/… 와 …/en-kr/products/… 가 **같은 페이지인데 후보 2건**
  junioredition en-kr → 열린 것이 **원상품 자기 자신** 🔴 자기참조가 열렸다(가격 오염 경로)
→ 그래서 「열린 페이지」 기준이 **옳다**. 로케일은 **정규화기 쪽 정책** 으로 풀어야 한다.
```

### 4-C. 🟡 남은 성질 — 404 를 404 로 말하지 못한다

`.co.jp/en-kr/...`(실측 404)는 로케일이 떨어져 **실존하는 `.co.jp/products/...`** 를 연다.
🟢 결과적으로 자기참조로 제외돼 **안전** 하지만 🔴 이유가 틀리게 적힌다. 원인은 4-B 와 **같다**.

---

## 5. 🟡 국내 2건이 `SIMILAR/low` 에 머무는 이유 — 기존 결론과 정합

🟢 이제 **사실을 읽는다**(제목·브랜드 획득). 🔴 그런데 SAME 에 못 닿는다 —
국내 샵 상세 제목이 해외 품번을 적지 않아 **MODEL_CODE 축이 생기지 않는다**
(헌장 §12 · 메모 `domestic-discovery-dies-at-low-not-at-search` 와 같은 결론).
🔴 `confidence 0.55 / 0.58` 은 운영 DB 의 그 링크 값(0.42 · 0.71 · 0.72)과 **다르다** —
운영은 어댑터(목록 마크업) 경로로 더 많은 사실을 얻는다. 🔴 **어느 쪽이 맞다고 단정하지 않는다.**

---

## 6. UI / route 연결 필요 범위

🔴 **지금 UI 를 붙이면 셀러가 보는 것은 대부분 「후보 없음」또는 `SIMILAR/low`** 다.
🟢 배선 자체는 작다(WU-022 의 transient 구역과 같은 모양 · 저장 0).
🔴 그러나 **순서를 뒤집지 않는다** — ⒜ 로케일 정책(4-B) ⒝ 국내 SAME 승격 가능성(§5)이
CPO 판단으로 정리된 **뒤** 에 붙이는 것이 맞다. 지금 붙이면 화면이 「국내에 없다」처럼
읽히는데 실제로는 **「우리가 축을 못 모았다」** 다.

---

## 7. 완료 조건 대조

| 항목 | 상태 |
|---|---|
| 실제 상품 테스트 결과 | 🟢 원상품 3 · URL 11 · HTTP 9 |
| 후보별 GT/판정 비교표 | 🟢 §2 |
| Precision | 🟢 2/2 (sample N=2) · 거짓 SAME **0** |
| Recall | 🟢 2/6 = 33% (sample N=6) |
| 오판 사례 원인 | 🟢 **함수 하나**(§4) |
| 로케일 자기참조 재현 | 🟢 **재현됨 2건** + 원인 특정(4-B) |
| UI/route 연결 범위 | 🟢 §6 — 🔴 아직 붙이지 않는다 |
| 최소 수정 + 재검증 | 🟢 ① 수정 + 라이브 재검증 · 🔴 ② 는 CPO 판정 |

🔴 **CEO Action: NONE.**
