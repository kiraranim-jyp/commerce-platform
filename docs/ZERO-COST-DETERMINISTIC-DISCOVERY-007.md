# WU-007 — Zero-Cost Deterministic Discovery **Feasibility** · 🔴 STOP + 🔴🔴 운영 결함 1건

> 🔴 **AI 를 한 번도 부르지 않았다.** Gemini 0 · Anthropic 0 · OpenAI 0 · Perplexity 0 ·
> 검색 API 0 · API 키 0 · 계정 생성 0 · 결제 0 · **비용 ₩0**.
> 🔴 Registry schema 0 · DB 쓰기 0 · Production 변경 **0** · UI 0 · Gemini flag **OFF** ·
> 잔액 **₩3,171 보존**. 🔴 robots.txt 가 막은 경로는 **부르지 않았다**(우회 0).
> 🟢 사용한 자원은 **무키 HTTP 58 요청**(예의 지연 400ms) + 읽기 전용 DB 질의다.
>
> 🔴🔴 **그런데 이 WU 의 가장 중요한 결과는 feasibility 숫자가 아니다.**
> 측정 과정에서 **운영에 살아 있는 거짓 양성 경로** 를 찾았다(§3). CPO 가 FP 를 최상위
> KPI 로 지정한 바로 그 종류다 — 「잘못된 상품의 가격을 가져오는 것은 검색을 못한 것보다
> 더 위험하다」.

---

## 1. 🔴 핵심 답 — **STOP**

> **AI API 없이, 품번/브랜드/상품명 하나로 「새로」 찾아낸 동일상품 판매 URL = 0 건.**

| 축 | 측정값 (분모 = 기존 26개 상품) |
|---|---|
| ① 질의 가능 도메인 상한 | 등록부 **34** → 자동수집 가능 **8** → 🟢 **무키 구조화 검색 가능 1** (`bobochoses.com`) |
| ① 무키 구조화 Discovery **증분** | 🔴 **Code Hit Rate 0/6 = 0%** |
| ② 공개 웹 데이터(Common Crawl) | 🔴 **새 도메인 0** — 구조적으로 도메인이 **먼저** 있어야 질의된다 |
| ③ 기존 Registry 보유 | 링크 보유 **4/26** · 링크 5건 (`EXACT_IDENTIFIER` 1 · `STRONG_IDENTIFIER` 1 · `TEXT_CONFIRMED` 1 · `SIMILAR` 2) |
| 기존 운영 국내검색(재측정 안 함) | WU-017 실측 인용 — 후보 175 · deterministic `very_high` **1/26 = 3.8%** |

🔴 **품번 없는 20건은 「측정불가」** 다 — 결정적 식별자가 없고, 새 매칭 규칙을 만드는 것은
이 WU 범위가 아니다(그리고 금지된 threshold 완화가 된다).

---

## 2. 🔴🔴 왜 0 인가 — 「도메인을 찾아 주는 무키 색인이 없다」

```
소매처 직접 Discovery 는 «도메인을 이미 알고 있을 때» 만 성립한다.
그러면 도메인 목록은 어디서 오는가? → **우리 Registry 뿐이다.**
→ 🔴 따라서 이 경로의 커버리지 상한은 **Registry 크기** 다. §12-0 의
   「Registry 확대가 목적이 아니다」와 **정면으로 만난다**(CPO 가 이미 지적한 그 긴장).
```

### 🟢 Common Crawl 이 그 빈칸을 메우지 못한다 — 구조적 이유를 실측했다

```
질의 ① 도메인 지정        url=bobochoses.com/products/*   → 🟢 HTTP 200 · 실제 상품 URL
질의 ② 도메인 없이 경로만  url=*/products/b226ac010*       → 🔴 {"message":"No Captures found"}
🔴 이유는 응답이 직접 보여준다 — urlkey 가 **"com,bobochoses)/products/…"** 다.
   **역순 도메인이 키의 앞부분** 이라, 도메인 없는 패턴은 범위 스캔이 성립하지 않는다.
→ 🔴 CC 는 「이 품번을 **어느 도메인** 이 파는가」에 **답할 수 없다.**
   답할 수 있는 것은 「**이 도메인** 에 그 URL 이 있었는가」뿐이다.
```

🔴 그리고 도메인을 주고 물어봐도 이 표본에서는 **0** 이었다:
```
junioredition.com  capture **46건** · 그중 품번 포함 URL **0**
🔴 질의 1건은 HTTP **400**(일시 오류 추정 · 재시도하지 않았다) — 0 으로 세지 않았다
🔴 색인 신선도는 약 1~1.5개월 지연(최신 CC-MAIN-2026-39) → 가격·재고 축에는 **부적합**
```

### 🔴 무키 구조화 엔드포인트는 **34 중 1개** 에만 있었다

```
등록부 34 도메인 전수 robots.txt + `/search/suggest.json` 역량 조사(58 요청)
  🟢 무키 구조화 검색 가능 — **bobochoses.com 1개**(Shopify Predictive Search · 공식 문서화)
  🔴 나머지 33 — 엔드포인트 없음 / robots 미확인
🔴 그 1개는 **브랜드 공식몰** 이고, 등록부에서 **workspace 설정 OFF** 상태다.
🔴 국내 샵 다수는 Cafe24 계열이라 Shopify 엔드포인트가 애초에 없다
   (운영은 그 샵들을 전용 어댑터로 이미 검색한다 — WU-017 이 측정했다).
```

---

## 3. 🔴🔴 **운영 결함 — 우리 검색어가 「상대 페이지의 증거」로 재활용된다**

🔴 이것이 이 WU 의 최대 산출물이다. **측정 중에 내 숫자가 거짓으로 나와서** 찾았다.

### 어떻게 드러났는가

1차 집계가 **`Code Hit Rate 5/6 = 83%`** 를 냈다. 🔴 그대로 보고하면 「무키 경로가 83% 를
찾는다」가 된다. 🟢 §5-B 의 「**후보가 나왔다 ≠ 그 값이 재현된다**」에 따라 후보를 열어 봤다:

```
질의 "Bobo Choses B226AC010" → 반환된 후보
  rank1  Poma green T-shirt      (다른 상품)   codeFound = **true**  ← 🔴
  rank2  Flower gift bag         (기프트백)    codeFound = **true**  ← 🔴
  rank3  Cup gift bag            (기프트백)    codeFound = **true**  ← 🔴
질의 "Pèpè Shoes 01195-VERNICE-NERO" → Veja 운동화 10건 전부 codeFound = **true** ← 🔴
```

### 원인 — 순환 증거(circular evidence)

```
Shopify Predictive Search 는 응답 URL 에 **우리가 보낸 검색어** 를 되돌려 넣는다:
  /products/pony-gift-bag?_pos=1&_psq=Bobo+Choses+B226AC010&_psid=…&_ss=sc
                                       └──────── 우리 질의 ────────┘
그 URL 을 그대로 건초더미에 넣으면 **우리 질의가 상대의 식별 증거로 승격** 된다.
```

### 🔴 운영 노출 경로 — 전수 확인했다 (추측 아님)

```
① buildCrossSellerSearchQueries(product-identity-dna.ts:432)
   → **1번 후보가 `dna.brandModelCode` 단독** 이다. 즉 운영이 품번만으로 검색한다
② searchShopifySuggest(shopify-suggest.ts:58-60)
   → `url: https://${domain}${p.url}` — **쿼리를 벗기지 않는다**
   적용 도메인: `shopifySuggestAdapter` 목록 **11개(OVERSEAS)** + `bobochoses-kr.ts`
③ match.ts:514 (🔴 **WU-004 에서 내가 URL 을 건초더미에 넣은 줄**)
   → `candidateFacts.brandModelCode = confirmBrandCodeInEvidence(…, { url: c.url … })`
   → MODEL_CODE 축이 **exact** 가 된다
④ attach-match-truth.ts:124 · 143 → `matchTruth` 를 EXACT/STRONG 으로 올린다
⑤ priceTierFromLink → **EXACT tier** → 국내 최저가·판매판정에 그 가격이 들어간다
```

### 실측된 노출량 (이 표본)

```
날것 URL 기준 Code Hit Rate   **5/6 = 83%**
날것 기준 품번 확인 후보       **27건**
🔴🔴 거짓 양성(날것 true · 정규화 false)  **27 / 27 = 100%**
🟢 정규화 후 Code Hit Rate     **0/6 = 0%** ← 진짜 값
```

🔴 즉 **이 경로가 만든 「품번 일치」는 전부 거짓이었다.**

### 🟢 고치는 방법은 1줄이고 **새 정책이 아니다** — 리포가 이미 그렇게 적어 뒀다

`self-reference.ts:63-67` 원문:
> 「Shopify 는 검색/컬렉션 문맥을 `_pos` `_psq` `_ss` `_v` `_fid` 처럼 밑줄로 시작하는
>  파라미터에 싣는다 — **전부 listing 을 가리지 못한다**」

🟢 즉 **「`_psq` 는 우리 검색 문맥이고 페이지의 신원이 아니다」는 이미 확정된 제품 정책** 이다.
🟢 정규화기도 이미 있다 — `normalizeCandidateUrl`(gemini-candidate-pool.ts:162-173)이
`u.search = ""` 로 쿼리를 벗긴다.

🔴🔴 **그런데 고치지 않았다** — 이 WU 가 **Production 변경 금지** 이기 때문이다(CPO).
대신 **①-4 테스트가 현재(결함) 동작을 글자로 고정** 했다. 🔴 CPO 가 수정을 승인하면
**그 테스트가 FAIL 로 뒤집힌다** — 그것이 수정이 실제로 들어갔다는 증거다(쿠팡 고시 선례와 같은 방식).

🔴 **CPO 가 판단할 교환 하나**: 쿼리를 벗기면 「쿼리 파라미터에 **진짜** 품번을 싣는 샵」의
증거도 같이 사라진다. 🔴 그런 샵이 있는지는 **미측정** 이다(Cafe24 의 `?product_no=8021` 은
판매처 내부 번호이고 해외 품번이 아니다 — 그건 영향 없다).

---

## 4. 측정 방법 (재현 가능 · AI 0)

```
하니스  apps/admin/src/app/api/price-history/_lib/__tests__/mi-007-zero-cost-discovery.test.ts
게이트  `MI_P0_02_ZC=1` 없으면 **SKIP**(회귀에서 외부 HTTP 가 나가지 않는다)
덤프    packages/database/scripts/mi-007-discovery-inventory-dump.mjs (**READ ONLY**)
        🟢 칸 이름을 추측하지 않고 `information_schema` 로 읽었다(이 트랙 아홉 번째 함정)
판정기  confirmBrandCodeInEvidence · classifyUrlShape · normalizeCandidateUrl ·
        isSelfReferenceCandidate · buildPrimaryQuery ∘ identityFromDna — **전부 운영 함수**
예의    도메인별 요청 사이 400ms 지연 · robots `Disallow` 면 **호출하지 않음** · 재시도 0
```

### 사전검증 5건 (HTTP 0 · 비용 0 · 항상 돈다)
```
①-1 분모 26 / 품번 보유 6 · 6/6 L1_MODEL_CODE
①-2 🔴 질의 가능 도메인 상한 — 등록부 34 · AUTO_* 8 (상한을 단언으로 잠갔다)
①-3 🔴 Common Crawl 은 도메인 없이 질의 불가 (urlkey 구조)
①-4 🔴🔴 **운영 결함 재현** — 날것 URL 이면 거짓 양성, 정규화하면 사라지고,
     🟢 **진짜 양성은 정규화 뒤에도 살아 있다**(과잉 수정 방지 단언까지 넣었다)
```

---

## 5. 🔴 이 숫자로 «하지 않을» 해석

```
❌ 「무키 경로가 83% 를 찾는다」          → 🔴 전부 거짓 양성이었다(§3)
❌ 「소매처 직접 Discovery 는 쓸모없다」  → 🔴 아니다. 운영 국내검색은 **이미 그 경로** 이고
   후보 175개를 낸다(WU-017). 이 WU 가 잰 것은 **무키 구조화 엔드포인트의 «증분»** 이다
❌ 「Common Crawl 은 가치가 0」          → 🔴 「도메인을 모르는 발견」에 쓸 수 없다는 뜻이다.
   도메인을 아는 보조 용도는 이 표본에서 0 이었을 뿐이고 전수 측정이 아니다
❌ 「26개 중 4개만 찾았으니 15%」        → 🔴 axis ③ 는 «이미 보유한 것» 이고 이 WU 의 산출이 아니다
❌ 품번 없는 20건에 대한 어떤 비율       → 🔴 **측정불가**(식별자 부재)
```

---

## 6. 🔴 CPO 판정이 필요한 것 — **둘이고, CTO 는 아무것도 구현하지 않았다**

```
⒜ 🔴🔴 **거짓 양성 수정 여부**(§3) — 1줄 · 리포의 기존 정책과 일치 · 영향 범위는
   Shopify suggest 를 쓰는 **12 도메인 × 품번 보유 상품**. 🔴 identity→가격 경로를
   건드리므로 CTO 가 임의로 고치지 않았다. 🟡 **권고: 고치는 쪽** — 현재 상태가
   「다른 상품의 가격을 국내 최저가로 들여보낼 수 있는」 경로다
⒝ Zero-cost Discovery 를 **포기할 것인가** — 증분이 0 이고 상한이 Registry 크기다
```

🟢 **CEO Action: NONE.**

## 7. 검증
```
WU-007 하니스  사전검증 4 + 실측 1 = **5 passed** · HTTP **58** · AI 호출 **0**
회귀 admin     (§본문 보고 참조) · typecheck baseline 10 대조 · build exit 0
🔴 운영 코드 변경 **0** — 추가된 것은 하니스 1개 · 읽기전용 덤프 1개 · 문서뿐이다
```
