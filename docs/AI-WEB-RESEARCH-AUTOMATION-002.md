# AI-WEB-RESEARCH-AUTOMATION-002 — CTO 기술검토 보고

> 🔴 **Gemini API 호출 0 · credit ₩0 · flag OFF 유지 · 브라우저 자동화 실행 0 ·
> 코드 변경 0 · DB 0 · Registry 구현 0 · CEO 요청 0.**
> 🔴🔴 **§5 의 「실제 실행 가능성 확인」을 수행하지 않았다.** 그 실행이 §3-D·§10 이
> 제외한 행위(AI 웹 UI 자동 조작)와 **같은 행위** 이기 때문이다 — 이유는 §0 에 적었다.

---

## 0. 🔴🔴 먼저 — 지시서 안에 충돌이 하나 있다

```
§5   「실제 상품 1개를 기준으로 실행 가능성까지 확인한다」
§3-D 「AI 서비스의 보호장치 우회 / 탐지 우회 / 비정상 계정 자동화는 검토 대상에서 제외」
§10  「우회 방법을 찾아내는 것이 목표가 아니다」
```

🔴 **그런데 gemini.google.com / chatgpt.com 에 프롬프트를 자동 입력하는 행위 자체가
「허용되지 않는 자동화」** 다. 우회 기술을 쓰지 않아도 그렇다 — 근거는 공개 문서다:

```
gemini.google.com/robots.txt   Disallow: /app/   Disallow: /chat/
Google ToS (효력 2026-07-30)   "using automated means to access content from any of
                                our services in violation of the machine-readable
                                instructions on our web pages (for example,
                                robots.txt files that disallow crawling...)"

OpenAI ToU (효력 2026-01-01)   "Automatically or programmatically extract data or Output"
                               "bypass any protective measures"
                               "You may not share your account credentials or make
                                your account available to anyone else"
chatgpt.com/robots.txt         `/c/*` · `/backend-api/*` 에 Allow 가 **한 줄도 없고**
                               `Disallow: /` 가 마지막에 온다 · `/auth/login?*` 별도 차단
실측                            curl 기본 UA → **403 · `Cf-Mitigated: challenge`**
```

🔴 **그래서 그 테스트를 「조심해서」 할 방법이 없다.** 실행하면 §3-D/§10 을 위반하고,
위반하지 않으려면 실행할 수 없다. **그래서 실행하지 않고 STOP 보고한다**(헌장 §3 —
정책/규제 위험은 STOP 조건이다).

🔴 그리고 제재가 **우리가 아니라 셀러 계정** 에 떨어진다 — Google ToS 는 **계정 삭제**
까지 가고, Google 자신의 `gemini-cli` 문서가 3자 도구 접근을
**"grounds for suspension or termination of your account"** 로 명문화했다.

---

## 1. Executive Verdict

```
최종 판정        🔴🔴 **STOP** (브라우저로 AI 웹 UI 를 자동화하는 경로)
                 🟡 **CONDITIONAL GO** (아래 §11 의 대체 경로 셋 중 하나)
추천 Browser     🔴 **없음** — 어떤 브라우저를 쓰든 대상(AI 웹 UI)이 막는다
사람 개입        🔴 AI-UI 경로에서는 **필수** (로그인·CAPTCHA·승인) → ZERO-HUMAN **FAIL**
Gemini API 사용  🔴 이번 WU 에서 **0** (조사 전용)
Search API 사용  🔴 이번 WU 에서 **0** (1차 해법으로 쓰지 않음 — 지시 준수)
예상 운영환경     🟢 **이미 있다** — Vercel 서버리스에서 headless Chromium 이 **현재 돌고 있다**
                 (`@sparticuz/chromium` + `playwright-core` · browser-launcher.ts:41-59)
                 🔴 즉 막힌 것은 **인프라가 아니라 대상 사이트의 약관** 이다
```

### 🔴 한 문장으로

> **「상품 URL 하나만 넣으면 사람이 아무것도 하지 않아도 Gemini Web 또는 ChatGPT Web
> 이 실제 웹을 조사하고 동일상품 URL 을 따져로 가져오는 시스템」은 — 기술적으로는
> 만들 수 있고, 약관으로는 만들 수 없다. 답은 「불가능」이다.**
>
> 🟢 단 **「AI 가 웹을 조사해 구조화된 후보 URL 을 돌려주는」 부분만은 공식 경로가
> 존재한다** — 그 경로는 **브라우저가 아니라 서버측 API** 다(§11).

---

## 2. Architecture — 현재 가능한 전체 흐름

🔴 지시서 §12 의 목표 구조에서 **「Browser Worker → Gemini/ChatGPT Web」 한 칸만** 바꾸면
나머지는 **전부 그대로 성립한다.** 그 칸이 유일한 불가 지점이다.

```
사용자 → 상품 URL
   ↓
상품정보 추출                     🟢 **이미 있다** universalExtract → canonicalProduct
   ↓
AI Web Research Job              🟢 큐 구조는 만들 수 있다
   ↓
┌──────────────────────────────────────────────────────────────┐
│ 🔴🔴 **여기만 불가** — Browser Worker → Gemini/ChatGPT Web     │
│    기술: 🟢 가능 (우리는 이미 Chromium 을 띄운다)                │
│    약관: 🔴 **금지** (robots.txt + ToS + 계정 공유 금지)         │
│    결과회수: 🔴 그 자체가 "programmatically extract Output"      │
├──────────────────────────────────────────────────────────────┤
│ 🟢 **대체 가능** — 제공자가 «검색을 대신 수행하는» 서버측 API     │
│    Gemini API+Grounding / OpenAI web_search / Perplexity Search│
│    → 구조화된 결과를 **공식적으로** 돌려받는다                   │
└──────────────────────────────────────────────────────────────┘
   ↓
후보 URL + 근거
   ↓
후보 페이지 실제 수집              🟢 **이미 있다** factsFromProductUrl (+JSON-LD 가격)
   ↓
검증                              🟢 **이미 있다** withConfidence → judgeDomesticCandidate
   ↓
Same Product Registry             🟡 **이미 70% 있다** domestic_product_links (§7)
   ↓
가격 Scheduler                    🟡 주기는 **이미 측정됐다**(2~3일 · 선행 WU) · cron 만 없다
```

---

## 3. Gemini Web 검증

| 항목 | 판정 | 근거 |
|---|---|---|
| 새 탭 | 🟢 **PASS** | 우리는 Vercel 에서 Chromium 을 띄운다(browser-launcher.ts:41) |
| 로그인(자동) | 🔴 **FAIL** | `robots.txt` 가 `/app/`·`/chat/` 차단 · 2FA/승인은 사람 |
| 기존 세션 재사용 | 🟡 PARTIAL(기술) / 🔴 **FAIL(약관)** | ToS 「distribute, sell, or lease」 + 계정 책임 조항 |
| Prompt 입력 | 🟡 PARTIAL(기술) / 🔴 **FAIL(약관)** | 입력 자체가 차단 경로(`/app/`)에 대한 automated access |
| Web Research | 🟢 가능(제품 기능) | — |
| 페이지 탐색 | 🟢 가능(AI 가 함) | — |
| **응답 회수** | 🔴🔴 **FAIL** | ToS 의 automated-means 조항에 정면 충돌 |
| URL 추출 / 구조화 | 🔴 FAIL | 회수가 막히면 성립 불가 |
| **Zero-human** | 🔴 **FAIL** | 로그인·CAPTCHA·세션 복구에 사람이 필요 |
| 정책 | 🔴 **금지** | robots.txt + ToS + `gemini-cli` 선례(계정 정지) |
| 비용 | 🟡 구독료(AI Pro/Ultra) | 🔴 **그러나 가격이 쟁점이 아니다** — 약관이 막는다 |

🔴 **Chrome auto browse**(Gemini 의 공식 agentic 브라우징)도 확인했다 — 2026 에 실재하고
"AI Pro and Ultra subscribers in the U.S." 대상인데 **외부 프로그램이 트리거하는 공식
API 가 0** 이다. 🔴 `Project Mariner` 는 **2026-05-05 에 공식 제품 목록에서 제거**됐다.

---

## 4. ChatGPT Web 검증

| 항목 | 판정 | 근거 |
|---|---|---|
| 새 탭 | 🟢 PASS | 동일 |
| 로그인(자동) | 🔴 **FAIL** | `robots.txt` 가 `/auth/login?*` 별도 차단 · Cloudflare challenge 실측(403) |
| 기존 세션 재사용 | 🔴 **FAIL** | ToU 「may not share your account credentials」 · Services Agreement §3.1/3.2 |
| Prompt 입력 | 🟡 PARTIAL(기술) / 🔴 FAIL(약관) | — |
| Web Research / 탐색 | 🟢 가능(제품 기능) | — |
| **응답 회수** | 🔴🔴 **FAIL** | ToU **「Automatically or programmatically extract data or Output」** 직격 |
| URL 추출 / 구조화 | 🔴 FAIL | 동일 |
| **Zero-human** | 🔴 **FAIL** | Cloudflare `Cf-Mitigated: challenge` |
| 정책 | 🔴 **금지** | 위 + 「bypass any protective measures」 |
| 비용 | 🟡 구독료 | 🔴 쟁점 아님 |

### 🔴🔴 공식 경로가 하나 있었는데 **결과를 돌려주지 않는다**

```
Workspace Agents API  —  외부 시스템이 ChatGPT 를 «트리거» 하는 **공식** 경로
  POST /v1/workspace_agents/{id}/trigger   → 202 { conversation_url }
🔴 공식 문서 원문: "The agent's response **cannot currently be retrieved through the API**."
→ 🔴 즉 「시키는 것」은 되고 「받는 것」이 안 된다. 그 URL 을 긁으면 §4 의 금지로 돌아간다.
→ **조사 엔진으로 성립하지 않는다.**
```

---

## 5. Browser Worker 환경

| 환경 | 기술 | 🔴 대상(AI 웹 UI) 약관 | 종합 |
|---|---|---|---|
| **환경1 개발자 PC Chrome** | 🟢 PASS | 🔴 FAIL | 🔴 **FAIL** |
| **환경2 Vercel 서버리스** | 🟢 **PASS — 이미 돌고 있다** | 🔴 FAIL | 🔴 **FAIL** |
| 환경2-b VPS/Docker/Cloud Run | 🟢 PASS | 🔴 FAIL | 🔴 FAIL |
| **환경3 별도 Browser Worker** | 🟢 PASS | 🔴 FAIL | 🔴 **FAIL** |

### 🟢🟢 §8 의 질문(「Vercel 에서 브라우저가 현실적인가」)에는 **이미 답이 있다**

```
packages/crawler/src/browser-launcher.ts:41-59
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);
  if (isServerless) → @sparticuz/chromium + playwright-core 로 launch
의존성: "@sparticuz/chromium": "^149.0.0" · "playwright-core": "^1.61.1"
🟢 그리고 이 경로가 **운영에서 실제로 쓰인다** — universalExtract → pipeline/route.ts:151
   (원상품 추출이 그걸로 돈다). 🔴 즉 「브라우저를 못 띄운다」는 **우리 문제가 아니다.**
🟢 Vercel 도 공식 가이드가 있다(puppeteer-core + @sparticuz/chromium-min · 번들 250MB
   → Large Functions 5GB beta · max duration 300s/800s).
🔴 그래서 §8 의 결론은 「환경이 안 된다」가 아니라 **「환경은 되는데 대상이 막는다」** 다.
```

🔴 **Opera Neon 만 공식 자동화 경로를 갖고 있다**(MCP server + CLI, 「external AI tools
… can connect to your live Neon browser session」) — 🔴 그러나 **로컬 데스크톱 전용** 이라
서버 SaaS 구조에 맞지 않는다. Perplexity Comet·Edge 는 약관이 자동화를 **명문 금지**
(Perplexity ToS: "use any robot, spider, crawlers, scraper … that … 'mines,' scrapes,
extracts, or otherwise accesses the Services"). Edge Copilot Mode 는 **2026-05-13 폐지**.

---

## 6. 실제 B226AC117 테스트 — 🔴 **수행하지 않았다**

```
발견 후보 수        — (미수행)
정확 후보           — (미수행)
잘못된 후보         — (미수행)
URL 회수 성공 여부   — (미수행)
자동화 성공 여부     🔴 **수행 불가** (§0 의 이유)
```

🔴 **「측정 불가」가 아니라 「수행하지 않음」이다** — 기술적으로는 가능하고, **정책이 막아서
하지 않았다.** 헌장 §5-B 의 어휘 규칙대로 둘을 구분해 적는다.

🟢 **다만 같은 브랜드·같은 품번 체계 상품의 «실측» 이 이미 있다**(WU-023B · Gemini API
경로 · 1 call):
```
Primary = L1_MODEL_CODE "Bobo Choses B226AC010" (3토큰)
Gemini 내부 검색어 3개가 **전부 품번** 을 썼다
discovered 5 → usable 2 → MI candidates 2
판정: global.trenbe.com **SAME**(0.53) · m.web.mustit.co.kr PRESUMED_SAME(0.02 · KRW 74,000)
🟢 즉 **「품번 기반 조사로 국내 리세일 후보를 찾는 것」 자체는 이미 실증됐다.**
🔴 그 실증은 **브라우저가 아니라 API 경로** 에서 나왔다.
```

---

## 7. Registry 연계 가능성 — 🟢 **이미 70% 있다**

지시서 §13 의 최소 저장 대상을 현행 `domestic_product_links` 와 1:1 대조했다
(칸 이름은 `information_schema` 로 읽었다 — 추측 아님):

| §13 요구 | 현행 칸 | |
|---|---|---|
| source_product | `snapshot_id` | 🟢 |
| brand | `matched_brand` | 🟢 |
| product_name | `matched_title` | 🟢 |
| sku | `matched_model_name` · `external_product_id` | 🟢 |
| candidate_url | `external_url` | 🟢 |
| seller | `source_id` (등록부 FK) | 🟡 **등록된 샵만** |
| country / market | 🔴 **없다** | 🔴 |
| identity_confidence | `match_confidence` | 🟢 |
| identity_reason | `match_reasons` · `cross_seller_verdict` · `match_truth` | 🟢 |
| discovered_at | `created_at` | 🟢 |
| last_verified_at | `verified_at` · `updated_at` | 🟢 |
| status | `status` | 🟢 |

🔴 **빠진 것은 둘이고 둘 다 알려진 것이다**:
```
① country/market 칸이 없다 — 🟢 단 그 «계산기» 는 WU-020 에서 만들었다
   (classifyCandidateMarket · KR/OVERSEAS/UNKNOWN + basis). 칸만 없다.
② `source_id` 가 **등록부 샵 FK** 라 임의 URL(트렌비·머스트잇)을 넣을 수 없다
   — 🔴 이것이 헌장 §12 에 적힌 「P0-1 별 WU」 그 제약이다(Registry 구조 변경).
```

### 🟢 「최초 발견을 자산화」는 **이미 그 구조다**

```
AI/검색 → 후보 발견 → 검증 → **domestic_product_links 저장** → 이후 price_observations
🟢 즉 「매번 Discovery 를 부르는 구조가 아니라 최초 발견을 자산화」는 **현행 설계** 다.
🟢 재관측 주기도 **이미 측정됐다** — 최적 **2~3일**(선행 WU · 효율 1.78x) · 없는 것은 cron 하나.
🔴 단 **Gemini 후보는 저장하지 않는다**(`:1067` 저장 차단 불변식 · 외부 URL 영구 저장 금지).
   → 🔴🔴 **자산화하려면 그 불변식을 CPO 가 바꿔야 한다.** CTO 가 임의로 못 바꾼다.
```

---

## 8. 정책 / 약관 리스크

| 대상 | 기술 | 약관 | 상업 SaaS |
|---|---|---|---|
| gemini.google.com 자동화 | 🟢 가능 | 🔴 **금지** | 🔴 불가 |
| chatgpt.com 자동화 | 🟢 가능 | 🔴 **금지** | 🔴 불가 |
| 셀러 계정 대리 사용 | 🟢 가능 | 🔴 **금지** | 🔴 불가 · **리스크가 셀러에게** |
| Chrome Extension 배포 | 🟢 가능 | 🔴 **금지(실효)** — CWS §4.4.1(1) 3자 ToS 위반 + §7.2 **원격 제거** | 🔴 불가 |
| computer-use 모델 3종 | 🟢 가능 | 🟢 제공자 허용 | 🔴 **대상 사이트 약관이 우리 책임** |
| Chrome 내장 AI | 🟡 LLM 만 | 🟢 허용 | 🔴 **검색 기능이 없다** |

### 🔴 computer-use 3종이 왜 탈락인가 — 공식 문서가 책임을 우리에게 돌린다

```
Google  "you will need to implement the client-side execution environment"
        + CAPTCHA 는 "You MUST NEVER attempt to solve or bypass"
Anthropic AUP "Users are responsible for ensuring that agents they build or deploy
        comply with this usage policy, **including actions performed through tools,
        browsers, and connected systems.**"
OpenAI  "**You provide the environment and execute the model's requests**"
→ 🔴 즉 검색엔진·쇼핑몰에 실제 요청을 보내는 주체가 **우리** 다. Google 검색을 대상으로
   하면 `google.com/robots.txt: Disallow: /search` 가 적용되고, 봇 감지에 걸리면
   **합법적으로 진행할 방법이 없다**(CAPTCHA 해결은 금지).
```

### 🔴🔴 그리고 **현재 경로(Gemini API Grounding)에 법무 확인 1건이 생겼다**

```
Gemini API Additional ToS (Grounding 절):
  "You will not ... **cache, frame, syndicate, resell, analyze, train on, or otherwise
   learn from Grounded Results or Search Suggestions.**"
🟢 유리한 사실 — 우리는 Gemini 후보를 **DB 에 저장하지 않는다**(`:1067`) → cache/database 축은 지켜져 있다
🔴 그러나 "**analyze ... or otherwise learn from**" 이 「MI 가 그 후보를 판정 입력으로
   쓰는 것」에 걸리는지는 **법무 해석** 이다. 🔴 CTO 는 「문제 없다」로도 「위반이다」로도
   **단정하지 않는다** → CPO/법무 판단 사안. 🔴 그리고 Search Suggestions **표시 의무** 도 있다.
```

---

## 9. 비용 구조

🔴 §11 의 요구(「계정 구독 비용으로 어느 정도 지속 가능한가」)에는 **답할 수 없다** —
그 구조 자체가 약관으로 막혀 **측정 대상이 되지 못한다.** 추정하지 않는다.

🟢 대신 **공식 가격표** 로 확인된 것(환산 0 · 출처 공식):

| 경로 | 과금 단위 | 단가 | 무료 |
|---|---|---|---|
| **Gemini API Grounding · 3세대+** | **검색 요청당** | **$14 / 1,000** | 🟢 **월 5,000 requests** |
| Gemini API Grounding · 2.5세대 | grounded prompt 당 | **$35 / 1,000** | 500 RPD |
| OpenAI Responses `web_search` | **호출당 + content 토큰** | **$10 / 1,000 calls** | 없음 |
| Perplexity Search API | request 당 | **$5 / 1,000** (Fast $1) | 불명확 |
| Chrome 내장 AI | — | 🟢 과금 항목 없음 | 🔴 **검색 불가** |
| computer-use 3종 | 토큰 + 스크린샷 토큰 | 🔴 **스텝 수 미실측 → 산출 불가** | — |

🔴🔴 **E 재평가 포인트(WU-001 과 동일 · 더 강한 근거로 재확인)**:
```
우리는 `"gemini-flash-latest"` **별칭** 을 쓴다 → 2.5세대($35/1k) 인지 3세대+($14/1k +
월 5,000 무료) 인지 **코드로 알 수 없다.**
🟢 모델을 3세대+ 로 **고정** 하면 월 5,000 검색 = 상품당 3쿼리 기준 **약 1,600 상품/월 $0** 다.
   (WU-023B 실측 grounding 3 기준)
🔴 단 무료 tier 는 ① 입력이 제품 개선에 사용되고 ② EEA/영국 대상은 유료 필수 — 제품정책 사안.
🔴 **₩21,700 소진의 원인 후보가 여기 있다** — 2.5세대 요율 × 호출당 5.5쿼리 조합.
   🔴 Billing 원장이 ground truth 이므로 CTO 가 단정하지 않는다.
```

---

## 10. Failure Points

| 실패 | AI-UI 경로 | 🟢 API 경로 |
|---|---|---|
| 로그인 만료 / 2FA | 🔴 **사람 필요** | 해당 없음 |
| CAPTCHA | 🔴 **합법적 해결 불가**(우회 금지) | 해당 없음 |
| Bot detection | 🔴 Cloudflare challenge 실측 | 해당 없음 |
| **계정 정지** | 🔴🔴 **셀러 계정** 삭제 가능 | 해당 없음 |
| 응답 회수 | 🔴 약관 직격 | 🟢 공식 반환 |
| 세션 격리(멀티테넌트) | 🔴 계정 공유 금지와 충돌 | 🟢 API 키 하나 |
| 제공자 UI 변경 | 🔴 **DOM 셀렉터가 수시로 깨진다** | 🟢 영향 없음 |
| 제공자 정책 변경 | 🔴 즉시 중단 | 🟡 provider 교체 |
| 쿼리 수 폭주 | 🔴 통제 불가 | 🟢 1 request = 1 단위 |

---

## 11. 최종 GO / CONDITIONAL GO / STOP

```
🔴🔴 **STOP** — 「브라우저로 Gemini Web / ChatGPT Web 을 자동 조작하는」 구조
   사유(§14 STOP 기준 중 **셋** 에 해당):
     · 사람 개입 필수 (로그인·CAPTCHA)
     · 결과 자동 회수 불가 (약관 직격)
     · 약관상 상업적 자동화 불가
   🔴 그리고 네 번째 — **리스크가 셀러 계정에 떨어진다.**

🟡 **CONDITIONAL GO** — 「AI 가 웹을 조사해 구조화된 후보를 돌려주는」 목적 자체는 살린다
   조건: **브라우저를 버리고 서버측 공식 API 를 쓴다.** 세 후보 전부 세 축 PASS:
     ① Gemini API + Grounding (3세대+ 고정 · 월 5,000 무료) 🔴 단 법무 1건(§8)
     ② OpenAI Responses `web_search` ($10/1k calls + 토큰) 🔴 inline citation 노출 의무
     ③ Perplexity Search API ($5/1k · 상업 이용 명문 허용)
   🟢 그리고 **우리 코드는 이미 그 모양이다** — WU-019R 실측대로 Gemini 전용 판정 규칙이
      **0** 이고 교체 지점은 Discovery 한 칸이다.
```

🔴 **「우회하면 된다」는 선택지를 적지 않았다** — §10 지시이자 헌장 원칙이다.

---

## 12. 다음 구현 WU (구현한다면 정확한 범위)

🔴 **CTO 가 착수하지 않았다.** CPO 결정용 범위만 적는다.

```
WU 후보 ⒜ 「Discovery Provider 경계 1칸 추상화」 — 가장 작다
   범위: gemini-candidate-pool.ts 를 `DiscoveryProvider` 뒤로 숨기고 provider 를 **둘** 둔다
         (기존 Gemini Grounding + 신규 1개). 🔴 MI·판정·UI·DB **무변경**.
   근거: WU-019R 이 경계를 코드로 확인했다(전용 판정 규칙 0).
   비용: 구현 중 외부 호출 **0** (기존 fixture·덤프로 테스트)

WU 후보 ⒝ 「모델 세대 고정」 — 가장 효과가 클 수 있다
   범위: `"gemini-flash-latest"` **별칭을 버리고** 3세대+ 모델 ID 를 **박는다** + modelVersion 기록
   근거: 별칭이라 과금 구조가 코드 없이 바뀐다(메모) · 3세대+ 는 월 5,000 무료
   🔴 선행: CPO/법무가 무료 tier 의 데이터 사용 조건을 수용하는가

WU 후보 ⒞ 「커버리지 1회 측정」 — 비용 0 으로 가능
   범위: 후보 API 의 **무료 tier** 로 상품 소수에 대해 「후보 URL 을 실제로 주는가」만 측정
   🔴 이것이 WU-001 §9 의 선행조건 ①이었고 아직 미측정이다

🔴 **셋 다 CPO 승인 사안이고, 내가 고르지 않았다.**
🔴 Registry 자산화(§7)는 **저장 불변식 변경** 이라 별 판단이 필요하다.
```

---

## 13. 준수 사항

```
🟢 Gemini API 호출 **0** · credit **₩0** · 잔액 **₩3,171 보존** · flag **OFF**
   (env `MI_GEMINI_DISCOVERY_ENABLED` 0건 · 재배포 success · 런타임 로그 `[MI-023-metrics]` 0건)
🟢 브라우저 자동화 실행 **0** · AI 웹 UI 접속 **0** · Search API 호출 **0**
🟢 코드 변경 **0** · DB/schema **0** · Registry 구현 **0** · 가격 스케줄러 **0** · UI **0**
🔴 §5 실제 상품 테스트 **미수행** — 이유를 §0/§6 에 적었다(「측정 불가」가 아니라 「정책상 미수행」)
🔴 우회 방법 **보고하지 않았다**(§10) · CAPTCHA/탐지 관련 일체 제외(§3-D)
🔴 현재 MI 판정 성능을 **정답으로 가정하지 않았다**(§2) — 이 보고서는 MI 성능을 평가하지 않는다
🟢 CEO 요청 **없음**
```
