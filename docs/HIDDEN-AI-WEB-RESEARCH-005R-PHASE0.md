# WU-005R Phase 0 — Hidden AI Web Research Architecture Feasibility

> 🔴 **호출 0** — Gemini·GPT·Perplexity·Exa·Anthropic·Azure **전부 0** · 카드 0 ·
> 결제 0 · 계정 생성 0 · Production 변경 0 · 코드 변경 0 · Gemini 잔액 **₩3,171 보존** ·
> flag **OFF**. 🟢 공식 문서만 읽었다.
> 🔴 CPO 지시대로 **Exa 키를 CEO 에게 요구하지 않는다**(WU-005 Phase 1 요청을 **철회**).

---

## §0. 🔴🔴 결론 — 한 문장

> **「AI 가 실제로 웹을 탐색해 동일상품 후보를 찾아오고 그 결과만 따져가 회수하는」 구조는
> 🟡 **가능하다**. 단 그것은 「숨겨진 소비자 AI 브라우저」 형태로는 **불가능** 하고,
> **서버측 agent 도구** 형태로만 가능하다. 그리고 채택을 가르는 변수는 **가격이 아니라
> 「그 결과를 우리 DB 에 저장해도 되는가」** 다.**

```
Type A (AI 가 직접 웹 탐색)   🟡 **CONDITIONAL — 실재한다**
Type B (우리가 AI 웹 UI 조작)  🔴 **STOP** (WU-001/002 에서 1차 자료로 확정 · 재조사 안 함)
Type C (단순 검색 API)         🔴 기본 아키텍처로 쓰지 않는다(CPO 지시 유지)
```

### 🔴🔴 그리고 이 WU 가 찾은 **하나의 패턴이 전부를 가른다**

```
**자체 검색 인덱스를 가진 사업자는 전부 「그 결과로 DB 를 만들지 말라」를 명시한다.**
  Google   "cache, frame, syndicate, resell, **analyze**, train on, or otherwise learn from
            Grounded Results"            → 금지
  Bing     "**creating a database of Bing Services Output**, indexing links…,
            using links for crawling or scraping" → 금지(예시가 우리 설계와 거의 글자 그대로 같다)
  Brave    "shall not **store, cache, or create a database of Search Results**"
  Exa      ToS §4.2(a) 브라우저 임시캐시 외 복제·파생 금지

🟢 **자체 검색 인덱스를 팔지 않는 사업자만** Output 소유권을 넘기고 저장을 규율하지 않는다.
```

🔴 **그들의 본업과 우리 Registry 가 경합하기 때문이다.** CPO 가 §1-18 에서 「결과를
Registry 에 저장할 수 있는가」를 물은 것이 **정확히 그 축을 짚었다.**

---

## §1. 산출물 ① — Architecture

🔴 **CPO 가 그린 구조에서 한 칸만 바뀐다** — 「Hidden AI Web Research Worker」가
«소비자 AI 탭» 이 아니라 **«서버측 agent 도구»** 다. 나머지는 전부 그대로다.

```
사용자 → 원상품 URL
   ↓
Product Extraction                 🟢 기존 universalExtract → canonicalProduct → DNA
   ↓
Research Job (background)          🟢 비동기 · webhook/polling · 사용자 화면에 노출 0
   ↓
┌───────── AI Web Research Worker (provider 교체 가능) ─────────┐
│  🔴 **소비자 AI 탭을 열지 않는다**(Type B = STOP)               │
│  🟢 **서버측 agent 도구** 로 부른다 — AI 가 검색하고 페이지를 읽는다 │
│     · 도메인 allowlist 로 «어디를 뒤질지» 우리가 정한다           │
│     · 호출 상한 파라미터로 비용 상한을 **코드에 박는다**            │
│     · 결과: 후보 URL + 근거 + 메타데이터                        │
└──────────────────────────────────────────────────────────────┘
   ↓  Discovery Candidate  🔴 **동일상품 판정이 아니다**(CPO §5)
   ↓
normalizeCandidateUrl              🟢 기존
   ↓
isSelfReferenceCandidate (008A)    🟢 기존 — 자기참조 제거
   ↓
classifyUrlShape                   🟢 기존 — PRODUCT_PAGE 만 통과
   ↓
factsFromProductUrl (+JSON-LD)     🟢 기존 — 실제 페이지 1회 fetch
   ↓
confirmBrandCodeInEvidence         🟢 **WU-004** — 원상품 품번을 url/title/sku 에서 찾는다
   ↓
MI Identity (withConfidence → judgeDomesticCandidate)   🟢 기존
   ↓  VERIFIED 만
classifyCandidateMarket / price    🟢 기존 WU-020 (통화 그대로 · 증거 일치 시에만 단정)
   ↓
Sales Decision                     🟢 기존 WU-021 (26/26 도달 확인)
   ↓
사용자에게는 **최종 결과만**
```

🟢 **역할 분리는 CPO 고정안 그대로다** — `AI Web → 찾는다` / `따져 → 확인한다` / `MI → 판단한다`.
🔴 **새 동일상품 규칙을 만들지 않았다**(CPO §6).

### 🟢 §5 의 Worker 인터페이스 — 설계만 (코드 0)

```
AIWebResearchWorker.research(input) → output

input   productUrl · brand · title · modelCode · color · coreTitleTokens · researchPrompt
        🟢 전부 기존 DNA/ProductFacts 에 **이미 있는 칸** 이다(새 칸 0)
        🔴 + maxToolCalls(비용 상한) · allowedDomains(탐색 범위) — provider 공통 축
output  provider · candidateUrls[] · evidence[] · reasoning[] · researchMetadata
        · executionStatus · elapsedMs · failureReason
candidateUrls[]  url · rank · source · reason · evidence
🔴 그리고 **전부 transient** 다 — 저장은 MI 가 VERIFIED 를 낸 «뒤» 에만 한다(WU-004 §7).
```

🔴 **이 인터페이스를 코드로 만들지 않았다**(CPO §5 지시).

---

## §2. 산출물 ② — Provider Capability Matrix (CPO §9 표)

| 항목 | Gemini Web | GPT Web | Perplexity Web | 🟢 Anthropic<br>web_search+fetch | 🟡 Azure<br>Browser Automation | 🟡 OpenAI<br>web_search+bg | 🔴 Gemini<br>Managed Agents |
|---|---|---|---|---|---|---|---|
| Hidden 실행 | 🔴 | 🔴 | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 |
| 자동 prompt | 🔴 금지 | 🔴 금지 | 🔴 금지 | 🟢 | 🟢 | 🟢 | 🟢 |
| **실제 Web 탐색** | 🟢(제품) | 🟢(제품) | 🟢(제품) | 🟢 서버가 검색 실행 | 🟢🟢 **실제 브라우저**(Playwright) | 🟢 | 🔴🔴 **브라우저 없음** |
| 후보 URL 회수 | 🔴 | 🔴 | 🔴 | 🟢 `url`·`title` | 🟢 | 🟢🟢 **`sources`= 방문 URL 전체** | 🟡 |
| 근거 회수 | 🔴 | 🔴 | 🔴 | 🟢 `cited_text`(≤150자) | 🟡 | 🟢 `url_citation` | 🟡 |
| 서버 실행 | 🔴 | 🔴 | 🔴 | 🟢 + Batches(−50%) | 🟢 GA | 🟢 background+webhook | 🟢 bg+webhook |
| 로그인 필요 | 🔴 | 🔴 | 🔴 | 🟢 API 키 | 🟢 | 🟢 | 🟢 |
| 공식 automation 지원 | 🔴 **없음** | 🔴 없음 | 🔴 **ToS 가 금지** | 🟢 | 🟢 **공식 use case 로 명기** | 🟢 | 🟡 Preview |
| 상업적 사용 | 🔴 | 🔴 | 🔴 | 🟢 **명시 허용** | 🟡 | 🟡 불명확 | 🔴 |
| Output 내부 분석 | 🔴 | 🔴 | 🔴 | 🟢 | 🟡 | 🟡 **불명확** | 🔴 금지 |
| **Registry 저장** | 🔴 | 🔴 | 🟡 | 🟢🟢 **GO** | 🟡 | 🟡 **불명확** | 🔴🔴 **STOP** |
| 비용 | 구독 | 구독 | 구독 | $10/1k searches + 토큰 · **fetch 무료** | 🔴 금액 비공개 | $10/1k + 토큰 | 토큰(100k~3M/건) |
| 정책 위험 | 🔴🔴 계정 정지 | 🔴🔴 | 🔴🔴 | 🟢 낮음 | 🟡 **대상 사이트 책임이 우리에게** | 🟡 미확인 | 🔴 저장 금지 |
| **최종 판정** | 🔴 **STOP** | 🔴 **STOP** | 🔴 **STOP** | 🟢🟢 **GO** | 🟡 **CONDITIONAL** | 🟡 **CONDITIONAL** | 🔴 **STOP** |

### 🔴 전제 셋이 바뀌어 있었다 (조사 중 확인)

```
① Gemini Managed Agents 샌드박스에 **브라우저가 없다** — 사전설치 도구가
   curl·wget·git·jq… 이고 에이전트 도구는 `google_search` · `url_context` ·
   `code_execution` · `mcp_server` 뿐이다. 🔴 「AI 가 브라우저를 돈다」가 아니다.
② OpenAI 전용 Deep Research 모델은 **2026-07-23 종료** 됐다(이미 과거).
③ Perplexity **async 지원이 2026-09-27 종료** 됐다 → Agent API background 로 이전.
🔴 세 전제를 그대로 두고 설계했으면 전부 틀렸다.
```

---

## §3. 산출물 ③ — Policy / Commercial Matrix (기술↔정책 분리)

| 제품 | (i) 기술 | (ii) **저장·내부분석** | (iii) 상업 SaaS | 결정적 근거 |
|---|---|---|---|---|
| **Anthropic** `web_search`+`web_fetch` | 🟢 | 🟢 **GO** | 🟢 **GO** | Commercial Terms §B "Customer … **owns its Outputs**" + "**assigns to Customer** its right, title and interest" · §A.1 "including to power products and services **Customer makes available to its own customers**" · 🟢 저장·캐시 제한 조항 **없음** |
| OpenAI `web_search` | 🟢🟢 | 🟡 **불명확** | 🟡 불명확 | 🟢 `sources` = "the **complete list of URLs** the model consulted" · 🔴 정책 4페이지가 **403** 으로 읽히지 않았다 → **사람이 열어야 한다** · 🔴 "inline citations **must** be … visible and clickable" |
| Azure Browser Automation | 🟢 GA | 🟡 | 🟡 | 🟢 공식 use case: "**Web research and data extraction**" · Playwright Workspaces · 🔴 제3자 사이트 제한 조항 **없음** = **리스크가 우리에게 이전** |
| Perplexity Agent API | 🟡 | 🟡(소유권 🟢) | 🔴 **법무 선행** | 🟢 ToS 2.3.1 "**owns all Output**" · 🔴 AUP §3 "products or services **competitive with, similar to**… except with express prior written permission" + ToS 2.5 단독 해지권 |
| **Gemini** (Grounding/Agents) | 🟡 | 🔴🔴 **STOP** | 🔴 | "cache … **analyze** … or otherwise learn from Grounded Results" 금지 + "display … **to the end user who submitted the prompt**" · 🔴 agent 예외 조항 **없음** |
| Bing grounding | 🟢 | 🔴🔴 **STOP** | 🔴 | "**creating a database of Bing Services Output**, indexing links…, using links for crawling or scraping" — 🔴 우리 설계와 거의 글자 그대로 |
| Brave / Exa | 🔴 단순 API | 🔴 STOP(기본) | 🟡 | Brave "shall not store, cache, or **create a database**"(🟢 유료 storage plan 예외 명시) · Exa §4.2(a) 임시캐시 외 금지 |
| Gemini/GPT/Perplexity **Web UI** | 🟢 가능 | — | 🔴 | WU-001/002 1차 자료 — robots.txt `Disallow: /app/ /chat/` + ToS automated-means · "Automatically or programmatically extract data or Output" · 계정 공유 금지 |

### 🔴🔴 Gemini 경로가 **두 번째 독립 사유로** 닫혔다

```
기존 사유(헌장 §12)      **비용** — 쿼리당 과금 · 상한 파라미터 없음 · ₩21,700 미조정
🔴 새 사유(이 WU)        **저장 금지** — Grounded Results 를 `cache`·`analyze` 할 수 없다
→ 🔴🔴 **비용이 해결돼도 저장 금지가 남는다.** 즉 「Gemini 로 찾아 Registry 에 쌓는다」는
   조합 자체가 약관과 충돌한다. 🟢 이것은 가격 비교가 아니라 **구조 판정** 이다.
```

---

## §4. CPO §1 의 19문 답

### A. 실행 가능성

| # | 질문 | Type B(소비자 Web) | 🟢 Type A(서버측 agent) |
|---|---|---|---|
| 1 | 별도 세션 생성 | 🟢 기술 가능 / 🔴 약관 금지 | 🟢 요청 단위로 독립 |
| 2 | 화면 비노출 실행 | 🟢 / 🔴 | 🟢 **기본이 서버측** |
| 3 | prompt 자동 전달 | 🔴 **금지** | 🟢 |
| 4 | 실제 웹 검색·탐색 | 🟢(제품 기능) | 🟢 — 🔴 단 Gemini Managed Agents 는 **브라우저 없음** |
| 5 | 상품 URL 회수 | 🔴 회수가 곧 금지 행위 | 🟢 OpenAI `sources` 가 **방문 URL 전체** |
| 6 | 여러 페이지 순차 탐색 | 🟢 / 🔴 | 🟢 agent loop · Azure 는 실브라우저 |
| 7 | URL + 근거 회수 | 🔴 | 🟢 Anthropic `cited_text` · OpenAI `url_citation` |

### B. 운영 가능성

| # | 질문 | 답 |
|---|---|---|
| 8 | 서버/백그라운드 | 🟢 — OpenAI `background:true`+webhook 4종 · Anthropic Batches(비동기 **−50%**) · Gemini bg+webhook |
| 9 | 로그인 없이 | 🟢 **API 키만**(사람 로그인·2FA·CAPTCHA 가 **사라진다**) |
| 10 | 세션이 필요하면 공식 지원인가 | 🟢 **세션 자체가 필요 없다** — 이것이 Type A 의 핵심 이점이다 |
| 11 | 실행시간·동시성 | 🟡 OpenAI "**tens of minutes**" · Anthropic Batches "대부분 1시간 내" · 🔴 Anthropic Batches 는 **조직 단위 web search throttle** · 🔴 Perplexity 동시실행 한도 불명확 |
| 12 | 실패·timeout 재시도 | 🟢 — 🟢 Anthropic 은 "**error 시 web search 는 과금되지 않는다**" |
| 13 | 구조화 JSON | 🟡 **각 provider 모두 「검색도구 × 구조화출력 동시 사용」이 불명확** 🔴 그래서 설계는 **URL 을 schema 가 아니라 «검색결과 배열»에서** 받는 2단 구조여야 한다 — Perplexity 문서가 그 이유를 직접 적었다: "**never count on the model to return valid links directly as part of the JSON response content**"(환각·깨진 링크) |

### C. 정책/사업 가능성

| # | 질문 | 답 |
|---|---|---|
| 14 | 자동화된 Web Research 허용 | 🟢 Anthropic·Azure·OpenAI(agent 도구는 **허용된 경로**) / 🔴 소비자 Web UI 는 금지 |
| 15 | 숨겨진 브라우저 실행 허용 | 🟢 **우리 브라우저라면** 허용 · 🔴 **그들의 웹 UI 를 여는 것은 금지** |
| 16 | 상업용 사용 | 🟢 Anthropic 명시 · 🟡 OpenAI/Azure 불명확 · 🔴 Perplexity AUP §3 |
| 17 | Output 을 내부 분석에 전달 | 🟢 Anthropic · 🟡 OpenAI 불명확 · 🔴 **Gemini 금지(`analyze`)** |
| 18 | **Registry 저장** | 🟢 **Anthropic 만 명확히 가능** · 🔴 Gemini·Bing·Brave·Exa **금지** |
| 19 | credential 자동화 | 🟢 **필요 없다**(Type A 는 API 키) · 🔴 Type B 에서는 금지 |

🔴 **「정책상 불명확한 것을 PASS 로 처리하지 않았다」**(CPO §1 지시) — OpenAI·Azure 는
🟡 로 남겼고, 그 이유(정책 페이지 403 · 조항 부재)를 적었다.

---

## §5. Research Prompt 규격 (설계만 · 전송 0)

🟢 CPO 예시를 그대로 쓰되 **우리 코드가 이미 가진 값만** 넣고, 🔴 **AI 에게 판정을 시키지
않는다**(「동일상품을 판정하라」가 아니라 「후보와 근거를 모아라」).

```
You are researching the web to find product-detail pages that sell the SAME
commercial product as the one described below.

Original product
  Brand        {{facts.brand}}
  Title        {{facts.title}}
  Model code   {{facts.brandModelCode}}        ← 🔴 없으면 이 줄을 **넣지 않는다**
  Color        {{facts.colorText}}
  Key tokens   {{facts.coreTitleTokens}}
  Source URL   {{facts.sourceUrl}}

Rules
  1. Return ONLY actual product-detail pages. No listing/category/search pages.
  2. Do NOT return the source URL itself or other pages of the same shop/listing.
  3. Do NOT decide whether a candidate is the same product — we verify that ourselves.
     Return candidates with the evidence you observed.
  4. If the model code appears on the page/URL, quote where you saw it.
  5. Cover both Korea and other markets. Do not translate or convert prices.
  6. If you cannot establish a plausible candidate, return an empty list.

For each candidate report
  url · seller/store · country or market (as observed) · model code evidence (verbatim)
  · why it appears to be the same product · any conflicting evidence
```

🔴 **설계 원칙 넷을 그 문구에 박았다**:
```
① 「판정하지 마라」 — AI 산출물은 **Discovery Candidate** 다(CPO §5)
② 「상세 페이지만」 — 우리 `classifyUrlShape` 와 같은 기준을 미리 건다
③ 「자기참조 금지」 — 008A 정책을 프롬프트에서도 한 번 건다
④ 「환산 금지」 — WU-020 의 통화 정책과 같은 문장
🔴 품번이 없는 상품(20/26)에서는 Model code 줄을 **지운다** — 없는 값을 넣으면 AI 가 지어낸다
```

---

## §6. 산출물 ④ — Next Step (실측을 한다면)

```
① 어떤 Worker 부터
   🟢 **Anthropic `web_search` + `web_fetch`** — 3축(기술·약관·상업) 모두 GO 인 **유일** 경로
   🔴 이유는 「싸서」가 아니다 — **저장·내부분석이 약관으로 허용되는 유일한 곳** 이기 때문이다
      (CPO §1-17/18 이 물은 그 축). 🟢 비용 구조도 예측 가능하다:
      $10/1,000 searches + 토큰 · **`web_fetch` 추가비용 없음** · Batches 비동기 −50% ·
      `max_uses` 로 호출 상한 · `allowed_domains` 로 탐색 범위 통제
   🔴 설계 제약 하나: `web_fetch` 는 **대화 맥락에 이미 등장한 URL 만** 가져온다 →
      🟢 우리 설계는 맞는다(입력 상품 URL + web_search 가 찾은 URL 둘 다 허용 소스다)

② 어떤 방식으로
   🔴 Production 0 · Registry 저장 0 · transient artifact 만(WU-005 P1 하니스와 같은 방식)
   🟢 **판정기는 이미 준비돼 있다** — WU-005 P1 하니스의 측정 파이프라인은 **provider 중립**
      이라 worker 만 바꿔 끼우면 된다(confirmBrandCodeInEvidence · classifyUrlShape ·
      normalizeCandidateUrl · isSelfReferenceCandidate · identityFromDna)
   🔴 호출 상한을 **코드에 박는다** — `max_uses` + 상품 수 상한 + 재시도 0

③ 어떤 테스트 상품으로
   🟢 **품번 보유 6건 먼저**(B226AC010 · B226AC035 · B126AC050 · B226AC058 ·
      01195-VERNICE-NERO · B1408F26-670) — 🟢 라벨 없이도 객관적 판정이 되는 유일한 구간
   🔴 품번 없는 20건은 **섞지 않는다**(CPO 가 WU-005 에서 고정)

④ 무엇을 측정할지
   Code Hit Rate · Top-1/3/10 · Product Detail Rate · KR/해외(추정) · Self-reference ·
   **근거 회수율**(AI 가 품번 근거를 실제로 인용했는가) · 호출 수 · **실제 과금액**
   🔴 Recall/Precision 은 라벨이 없어 **집계하지 않는다**
```

### 🔴 실측 «전» 에 사람이 해야 하는 것 둘

```
① 🔴 **OpenAI 정책 4페이지를 사람이 열어야 한다** — services-agreement · business-terms ·
   usage-policies · service-terms 가 자동 조회에서 **403** 이다. 저장 조항을 확인하지
   못했고, 「조항을 못 찾았다」를 「허용」으로 쓰지 않았다.
② 🔴 **Anthropic 채택 시에도 법무 확인 1건** — 인용 요건이 공식 Note 로 있다
   ("display citations as appropriate based on consultation with your legal team").
   🟢 단 그것은 「최종 사용자에게 직접 보여줄 때」이고, 우리 구조는 **내부 검증** 이다.
```

---

## §7. 🔴 CPO §10 금지 결론을 범하지 않았다

```
❌ 「Gemini Web 이 안 되니 Gemini API 를 쓰자」      → 🔴 그 반대다. Gemini 는 **API 쪽도**
                                                      저장 금지로 **STOP** 이다(§3)
❌ 「GPT Web 이 안 되니 OpenAI Search API 를 쓰자」  → 🟡 OpenAI 는 **CONDITIONAL** 이고
                                                      정책 미확인이라 1순위로 올리지 않았다
❌ 「Exa 가 싸니까 Exa 를 쓰자」                      → 🔴 Exa 는 **저장 금지로 STOP** 이다.
                                                      그리고 **CEO 키 요청을 철회** 했다
🟢 이번 1순위의 근거는 **가격이 아니라 「저장·내부분석·상업사용이 모두 허용되는 유일한
   경로」** 다 — CPO 가 §1-17/18 에서 직접 지정한 판정축이다.
```

---

## §8. 준수 사항

```
🟢 호출 **0**(Gemini·GPT·Perplexity·Exa·Anthropic·Azure 전부) · 카드 0 · 결제 0 ·
   계정 생성 0 · 코드 변경 **0** · Production 변경 0 · DB 0 · UI 0
🟢 Gemini flag **OFF**(env 0건) · 잔액 **₩3,167+ 보존**(이 WU 에서 0원 사용)
🔴 **Exa 키 요청 철회** — WU-005 P1 하니스는 리포에 남지만 **SKIP 상태** 이고,
   🟢 그 측정 파이프라인은 **provider 중립** 이라 버려지지 않는다
🔴 Type B(웹 UI 자동 조작) 방법을 **적지 않았다** · 우회·CAPTCHA 일체 제외
🔴 불명확을 **PASS 로 처리하지 않았다**(OpenAI·Azure 🟡 유지)
🔴 새 동일상품 판정 규칙 **0** · Worker 인터페이스를 **코드로 만들지 않았다**
```
