# WU-006R — 외부 API **0원** AI Web Research 가능성 재조사 · **STOP**

> 🔴🔴 **판정: STOP.** CPO 가 제시한 8개 조건을 **동시에** 만족하는 경로는 조사한 모든
> provider 에서 **0건** 이다. 🔴 「가능하지 않다면 억지로 API 로 우회하지 않고 STOP」이라는
> 지시대로 **우회 경로를 설계하지 않았다.**
>
> 🟢 **단 조사가 끝이 아니다** — 「0원 + 키 없음 + 저장을 금지하는 중개 조항 없음」을
> 만족하는 경로가 **하나** 나왔다. 🔴 그것은 **AI 가 아니고 검색엔진도 아니다**(§4).
>
> 🔴 외부 API 호출 **0**(Gemini·Anthropic·OpenAI·Perplexity·Exa·Brave 전부) · 계정 생성 **0** ·
> 카드 등록 **0** · 결제 **0** · 운영 코드 변경 **0** · Gemini flag **OFF** · 잔액 **₩3,171 보존**.
> 🔴 우회·CAPTCHA·봇 감지 회피는 **조사 범위에서 제외** 했다.

---

## 1. CPO 8문 — 한 표로 답한다

| | 질문 | 답 | 근거(1차자료) |
|---|---|---|---|
| ① | Agent 가 실제 웹을 검색하는가 | 🟡 **일부 가능** | Gemini in Chrome `auto browse` · ChatGPT Workspace Agents 는 실재한다 |
| ② | 결과 **실제 URL** 을 우리 시스템으로 | 🟡 API 경로만 | 🔴 **비-API 무료 경로에는 인터페이스가 아예 없다**(문서 색인 0건) |
| ③ | 사람이 매번 복붙하지 않아도 되는가 | 🔴 **아니오** | Atlas/Copilot/Comet 전부 「클릭·우클릭·사이드패널」 |
| ④ | 로그인/승인 없이 자동 실행 | 🔴 **아니오** | Gemini in Chrome: "Sign in to Chrome" + "Review and confirm any sensitive steps" |
| ⑤ | 숨겨진 백그라운드 실행 | 🔴 **아니오** | 서버에서 호출 가능한 표면이 **없다**(Chrome 내장 AI 는 사용자 브라우저 전용) |
| ⑥ | **약관상 자동화 허용** | 🔴🔴 **금지** | 아래 §2 — 제공자마다 **이름을 적어** 금지한다 |
| ⑦ | 결과 URL 을 따져 파이프라인으로 | 🟢 기술상 가능 | 🔴 그러나 ⑥이 깨지므로 **의미 없다** |
| ⑧ | 외부 API 비용 0원 | 🔴 **불가** | 🔴 0원인 경로는 **웹 검색 능력이 0** 이다 |

🔴 **②와 ⑧이 만나지 않는다** — 이것이 이 조사의 핵심이다. 「검색을 할 수 있는 것은
전부 유료」이고 「0원인 것은 전부 검색을 못 한다」. 그 중간이 없다.

---

## 2. 🔴🔴 약관 — 제공자들이 **우리 설계를 글자 그대로** 금지한다

🔴 아래 넷은 **추론이 아니다.** 금지 문장이 우리가 하려는 행위를 지명한다.

### ① Google — 「링크를 모아 색인을 만들지 말라」 (`ai.google.dev/gemini-api/terms`)

> "it is a violation of these terms to use Grounding with Google Search to extract or
> collect one or more of these components for another purpose (**for example, using
> programmatic or automated means to collect Links, using Links to build an index, or
> using Links to identify destination pages for crawling or scraping**)"

> "as long as you **do not allow Grounded Results to be accessed or collected by automated
> or programmatic means or to be used to create a database**"

🔴 괄호 안 예시 **세 개가 우리 설계 그대로** 다. 그리고 상위 약관도 같다 —
`developers.google.com/terms` §5(e): "**Scrape, build databases, or otherwise create
permanent copies of such content**".
🔴 `google.com/robots.txt` 는 `Disallow: /search` 이고, Google ToS 는 **robots.txt 를 직접
참조** 해 「machine-readable instructions 위반 자동 접근」을 금지한다 → 검색결과 스크래핑은
**ToS 위반으로 직결** 된다.

### ② 🔴🔴 Anthropic — 「소비자 구독으로 요청을 라우팅하는 서비스」 금지 (**내가 직접 확인**)

`anthropic.com/legal/aup` 원문에서 이 문장을 **직접 받아 확인** 했다:

> "**Resell, proxy, or otherwise provide access to Claude through unauthorized means,
> including services that route requests through consumer subscriptions or misrepresent
> the product or client being used**"

그리고 Claude Code 법적 문서(`code.claude.com/docs/en/legal-and-compliance`):

> "**Anthropic does not permit third-party developers to offer Claude.ai login into their
> own applications, or to route requests through Free, Pro, or Max plan credentials on
> behalf of their users.**"
> "Advertised usage limits for Pro and Max plans assume **ordinary, individual usage**."
> "**Customers may not pay for, resell, or intermediate Claude usage on their end users' behalf.**"

🔴🔴 **그래서 「Claude Code / 구독으로 공짜로 돌린다」는 경로가 가장 먼저 닫힌다.**
🔴 이 경로를 선제적으로 닫아 둔 이유 — 우리가 **이미 Claude Code 를 쓰고 있어서** 새 세션이
「그걸 백엔드로 쓰면 0원이다」로 갈 수 있다. **금지 문장이 그 행위를 직접 지명한다.**
🟢 반대 경계도 명시돼 있다 — 「**자사의 인가된 사용자**(직원)가 쓰는 내부 용도」는 제한 대상이
아니다. 갈리는 축은 「상업적인가」가 아니라 **「최종 고객을 대신해 요청을 통과시키는가」** 다.

### ③ Microsoft — 「AI 서비스에서 데이터를 추출하지 말라」

`microsoft.com/en-us/servicesagreement` §14.s.iii:
> "Unless explicitly permitted, you may not use **web scraping, web harvesting, or web data
> extraction methods to extract data from the AI services**."

소비자 Copilot ToU: "**Don't use tools or computer programs (like bots or scrapers) to
access Copilot.**"
🔴 Bing Search API 는 **2025-08-11 종료** 됐고, 후속 Grounding with Bing 은 "**Copy, store,
cache, archive, or create a database of Output**" 를 금지한다.

### ④ Perplexity — 경쟁/유사 제품 금지 (🔴 헌장 표기 정정)

`perplexity.ai/hub/legal/aup` · 섹션 **"Avoid technical misuse"**(🔴 §3 이 아니다 — 헌장을 고친다):
> "Create or make available any products or services **competitive with, similar to, or that
> would otherwise be a substitute for** the Services"

ToS §5.2(i): "use any robot, spider, crawlers, scraper … that … **extracts** … information or data".

### 🟢 robots.txt 실측 (전문)

```
gemini.google.com/robots.txt   Allow: /app/download · **Disallow: /app/** · **Disallow: /chat/**
chatgpt.com/robots.txt          Allow 목록에 /c/ · /backend-api/ **없음** → "Disallow: /" 아래로 떨어진다
                                그리고 **Disallow: /backend-anon/conversation$** 가 이름으로 막혀 있다
```

---

## 3. 🔴 구조적 부재 — 「약관 전에 인터페이스가 없다」

🔴 ⑥(약관)만 보면 「허락을 받으면 된다」로 읽힌다. **그 전에 ②가 없다.**

```
ChatGPT Atlas / agent mode  🔴 developers.openai.com/llms.txt 전수 — Atlas 0건 · agent mode 0건
Gemini 자동화 API           🔴 Chrome 확장 API namespace 전수 — Gemini/assistant/agent 0건
Copilot 자동화 API          🔴 Edge 확장 API 표(~70개) — copilot/ai/languageModel 0건
Perplexity Comet            🔴 docs.perplexity.ai/llms.txt — "comet" 0건
```

🟢 **무료이고 로컬인 것들은 「검색 능력」이 0 이다** — 약관이 아니라 **능력** 이 막는다:
```
Chrome 내장 AI(Gemini Nano)  Translator·Summarizer·Prompt 등 7개 — 🔴 **웹검색 API 없음**
  공식 문구: "**No data is sent to Google or any third party when using the model.**"
  → 네트워크를 쓰지 않는 모델은 **정의상 웹 검색을 못 한다**
  🔴 그리고 실행 표면이 **웹페이지/확장** 뿐 → **사용자 브라우저가 반드시 필요** (⑤ 불가)
Windows AI Foundry           OCR·음성·이미지 10종 — 🔴 web search·grounding **0건**
```

### 🔴🔴 그리고 「역방향 primitive」가 폐기됐다 — 이것이 구조적 결론이다

MCP 공식 문서(`modelcontextprotocol.io`):
> "**MCP host — an AI application** … establishes connections to one or more MCP servers"
> "**Deprecated**: … as of protocol version `2026-07-28`. **Sampling**: Allows servers to
> request language model completions from the client's AI application …
> **New implementations should integrate directly with LLM provider APIs.**"

🔴 즉 **AI 앱이 우리 서버를 부르는 방향** 만 남았고, 우리 서버가 AI 앱을 부르던 유일한
primitive 는 **공식 폐기** 됐으며 공식 권고가 **「provider API 를 직접 쓰라」** 다.
🔴 「숨겨진 AI Web Research」는 업계 설계 방향과 **반대** 다.

### 🔴 Gemini CLI 무료 경로도 **이미 폐지됐다** (새 사실)

`developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals`:
> "Starting June 18, 2026 … **This also applies to usage of Gemini CLI. As part of the
> deprecation, you can no longer use the Login with Google option** to access the IDE
> extensions or Gemini CLI."

🔴 그리고 Gemini CLI 문서가 **외부에서 끌어 쓰는 것을 직접 금지** 한다:
> "**Directly accessing the services powering Gemini CLI … using third-party software,
> tools, or services … is a violation of applicable terms and policies.**"
🔴 무료 티어 grounding 은 가격표에서 **"Not available"**(2.5 Flash 레거시 500 RPD 만 예외) ·
무료 입력/출력은 **제품 개선에 쓰이고 사람이 읽는다**("human reviewers may read, annotate").

---

## 4. 🟢 그런데 — 「0원 + 키 없음 + 저장 금지 중개인 없음」이 **하나** 있다

🔴🔴 **이것은 AI 가 아니고 검색엔진도 아니다.** 그래서 ①~⑧ 중 ①(AI 가 검색한다)을
만족하지 않는다 — **CPO 가 물은 것의 답이 아니라, 그 질문이 닫혔을 때 남는 것** 이다.

### 왜 이것만 남는가 — 한 문장

> **금지 조항은 「검색 인덱스를 파는 사업자」에게서 나온다. 소매처와 직접 말하는 경로에는
> 그 사업자가 사슬에 없다.**

### 🟢 실측 (내가 직접 · 키 0 · 결제 0 · 읽기만)

`bobochoses.com/robots.txt` **머리 주석 원문** — 소매처가 **스스로 에이전트를 초대한다**:
```
# Shopify storefront. Public product, collection, page, blog, policy, cart, and localized HTML is crawlable.
# Agent instructions: https://bobochoses.com/agents.md
# UCP discovery: https://bobochoses.com/.well-known/ucp
# UCP/MCP endpoint: https://bobochoses.com/api/ucp/mcp
# Agents must:
# - Identify agent-initiated requests using the integration's required identity and authentication mechanisms.
# - Use supported UCP interfaces and provided WebMCP tools for browser shopping actions, without scripted workarounds.
User-agent: *
Allow: /
```

```
GET  /.well-known/ucp        → 🟢 HTTP **200** (키 0)
POST /api/ucp/mcp tools/list → 🟢 HTTP **200** · tools 13개 (키 0)
   Discovery 축 셋 — search_catalog · **lookup_catalog**("품번/식별자로 조회") · get_product
```

🟢🟢 **`lookup_catalog` 가 「브랜드 품번 → 상품」 조회다** — 그런 것이 **전역으로는 존재하지
않는다**(Wikidata 실측: 전 세계 GTIN 보유 2,620건 · 소매 URL 매핑 없음). 🔴 **샵 단위** 다.

🟢 그리고 **문서화된 무키 엔드포인트가 또 있다** — Shopify Predictive Search
(`shopify.dev/docs/api/ajax/reference/predictive-search`) `GET /search/suggest.json`:
인증 불필요 · 타입당 최대 10건 · 초과 시 **429 + `Retry-After`**.
🔴 반면 `/products.json` 은 **미문서화** 다 — 「공식 지원」으로 적지 않는다.

🟢 `sitemap.xml`(sitemaps.org) + `robots.txt`(RFC 9309)는 **표준** 이고, 실측에서 상품 URL
slug 에 **품번이 그대로** 있었다(`/products/b999cd009-ease-sweatshirt`) → WU-004 의
`confirmBrandCodeInEvidence`(URL·sku 까지 본다)와 **정확히 맞물린다.**

### 🔴 과장하지 않는다 — 네 가지

```
① 「저장 허용」이 **명시된 것은 아니다.** 명시된 것은 「crawlable」(접근) 이다.
   🟢 정확한 표현은 **「저장을 금지하는 제3자 중개 조항이 없다」** 다.
   저장 가능성은 각 소매처 ToS + 저작권으로 넘어가고 그 판단은 CTO 범위 밖이다.
② 「키 없음」에 준비물이 하나 있다 — UCP 는 `meta.ucp-agent.profile` 에 **공개 접근 가능한
   agent profile URI** 를 요구한다(에이전트 실측에서 `profile_unreachable`). 🟢 API 키·계정·
   결제가 아니라 **우리가 공개 URL 에 JSON 하나를 올리는 것** 이다.
③ robots.txt 가 **조건을 달았다** — 「identity/authentication 메커니즘으로 식별할 것」,
   「**scripted workarounds 없이** 지원 인터페이스를 쓸 것」. 🔴 조건부 허용이다.
④ 🔴🔴 **이것은 「웹 전체 검색」이 아니다.** 「이미 아는 소매처 안에서 찾기」다.
   → 커버리지 상한이 **Registry 크기** 이고, 그것은 §12-0 의 「사이트 Registry 를 늘리는
     것이 목적이 아니다」와 **긴장 관계** 에 있다. 🔴 **제품정책 판단이다(CPO).**
```

### 🟡 보조 후보 하나 — Common Crawl

```
🟢 0원 · 키 0 (실측 HTTP 200 · 헤더 0) · 실제 상품 URL 반환
🟢 ToU 전문에 `derivative`/`derived`/`redistribute`/`dataset` **0건**
   → 🔴 **저장 허용 명시도 없고 금지 명시도 없다**(침묵). Google·Bing·Brave·Exa 의
      **명시 금지와 성질이 다르다.** 🔴 단 ToU §2 가 **원 사이트 약관을 통과시킨다.**
🔴 색인이 **약 1~1.5개월 지연** 이고 CDX 는 강한 rate limit → **가격·재고 축에 쓸 수 없다.**
🟢 쓸 수 있는 자리는 하나 — 「이 품번이 **어느 도메인에 존재하는가**」의 1차 후보 발견.
```

🔴 **배제된 것들** (전부 1차자료): Marginalia(**CC-BY-NC-SA = 비상업 전용** → 0원과 상업
저장이 양립 불가) · Mojeek(🟢 저장을 **명시 허용** 하는 유일한 검색 provider — 🔴 단
**£3 CPM 유료 Business 이상**, 하위는 1시간 캐시) · IndexNow/Bing WMT(**질의 기능 자체가
없다** · 소유권 확인된 자기 사이트만) · SearxNG(**상위 엔진 약관을 그대로 상속** — 숨기는
것이지 해결이 아니다) · Wikidata(🟢 CC0 로 가장 깨끗하지만 **분모가 없다**).

---

## 5. 🔴 최종 판정

```
CPO 8문 동시 충족           🔴 **STOP** — 0건
AI Web Research(API 0원)    🔴 **STOP** — 능력 있는 것은 전부 유료 · 0원인 것은 능력 0
소비자 구독 우회            🔴 **STOP** — 금지 문장이 그 행위를 지명한다(내가 직접 확인)
브라우저 확장               🔴 STOP — 제3자 무단 접근 · 브라우징 활동 수집 · 2026 CWS AI 조항
Gemini 재개                 🔴 **없다** — 비용 외에 **저장 금지** 라는 독립 사유가 1차자료로 재확증
🟢 남은 0원 경로            소매처 직접(robots+sitemap+suggest+UCP/MCP) · 🟡 보조 Common Crawl
                            🔴 **단 이것은 제품정책 결정이다 — CTO 가 구현하지 않았다**
```

🔴 **다음 단계를 CTO 가 정하지 않는다.** CPO 결정 사항은 둘이다:
```
⒜ 「웹 전체 검색」을 **포기** 하고 소매처 직접 Discovery 로 갈 것인가
   → 🔴 그러면 커버리지 상한이 Registry 크기이고, §12-0 의 금지와 **정면으로 만난다**
⒝ Common Crawl 을 **1차 후보 발견에만** 쓸 것인가(가격·재고는 불가 · 1개월 지연)
```

🔴 **보고에 넣지 않은 것**: 상품당 비용 · 커버리지 · Recall 숫자. 이 WU 는 **약관·가능성
조사** 이고 성능 측정이 아니다. 「소매처 직접으로 몇 % 를 찾는다」는 **측정하지 않았으므로
적지 않는다.**

## 6. 🔴 미확인으로 남긴 것 (0 으로 적지 않는다)

```
① OpenAI ToU/Usage Policies 본문 — openai.com·help.openai.com 이 자동 fetch 에 **전 경로 403**.
   「Automatically or programmatically extract data or Output」의 정확한 문구·섹션 **미판독**.
   🔴 사람이 브라우저로 열어야 닫힌다(2분). 🔴 snippet 을 1차 판독으로 쓰지 않았다.
② CWS 2026 AI-guardrail 조항이 live 정책 본문에 렌더되는지 — **블로그만** 확인(시행 2026-08-01).
③ Shopify UCP 의 trust tier 별 rate limit — 공식 문서가 숫자를 주지 않는다.
④ Chrome 내장 AI 의 상업적 이용 전용 약관 — 공식 4페이지에 **명시 없음**(부재 확인이 아니다).
⑤ Gemini 무료 티어 RPM/RPD — 공식 페이지가 **숫자 비공개**(리포 문서 250/day ↔ README 1000/day **모순**).
⑥ Copilot Free 의 AI credit 분모 — 문서에 숫자 없음. `copilot -p '/research …'` 동작 미확인.
   🟢 참고: Copilot 은 약관 축에서 가장 깨끗하다(소유권 주장 0 · 학습 opt-out · 저장 금지 0 ·
   cron 운용 공식 안내) — 🔴 그러나 **web search 도구가 문서에 존재하지 않는다.**
```
