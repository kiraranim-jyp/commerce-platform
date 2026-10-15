# WU-021 — Chrome Native AI / WebMCP / Extension / Local AI **최종 Gate** (조사만 · 코드 0)

🔴 Extension 구현 0 · manifest 0 · AI 웹 UI 접속 0 · DOM scraping 0 · Playwright 0 ·
AI API 0 · 키 0 · 결제 **₩0** · 운영 코드 0 · MI 0 · Registry 0 · Shopify Suggest 0 ·
Category/Sourcing 0 · schema 0 · 배포 0. 🟢 사용한 것은 **공식 문서 fetch** 뿐이다.

🟢 **CPO 의 축 분리는 옳았다** — 「3자 AI Web UI DOM 조작」과 「Chrome 공식 AI 경로」는
다른 축이다. 🔴 **그러나 다시 조사한 결과 끝나는 자리가 같고, Chrome 쪽은 금지 조항이
하나 더 많다**(2026-08-01 신설).

---

## 1. 🔴🔴 WINNER

```
WINNER = **Shopify Suggest (현행 baseline 유지)**
AI Search = 🟡 **보류 — 단 「측정 불가」가 아니다.** 사람 수집 6회로 «오늘» 잴 수 있다(§7)
```

🔴 Chrome Native AI · Chrome Extension · Local AI **셋 다 탈락** 이고, 탈락 사유가 서로 다르다:

```
Chrome Native AI (Prompt API)  🔴 **능력** 부재 — 추론 시 네트워크를 쓰지 않는다
WebMCP                         🔴 **방향** 반대 — 우리가 받는 경로가 아니라 남이 우리를 부르는 경로
Gemini in Chrome / AI Mode     🔴 **공식 API 0** + 약관 + 미국한정·유료
Chrome Extension + 3자 AI UI   🔴 WU-002 STOP **유지 · 그리고 강화됐다**
Local AI                       🔴 **검색 다리 부재** — WU-006R 이 이미 전수 판정
```

---

## 2. Chrome Native AI — 🔴 **능력이 없다**(약관 문제가 아니다 · 1차자료 재확인)

🟢 헌장 §12 의 기존 한 줄(「Chrome 내장 AI 는 웹검색 능력 0 — 약관이 아니라 능력」)이
**1차자료로 재확인**됐다. 추정이 아니었다.

```
Prompt API 는 Gemini Nano 를 쓴다 — developer.chrome.com/docs/ai/prompt-api
  "No data is sent to Google or any third party when using the model."
  "The network requirement is **only for the initial download of the model**.
   Subsequent use of the model **does not require a network connection**."
🔴🔴 추론 시 네트워크를 안 쓴다고 «공식 문서가 명시» 하므로, 웹 검색은
    「옵션이 없는 것」이 아니라 **구조적으로 존재할 수 없다.**
→ 「이 상품 파는 URL 찾아줘」를 물으면 **가중치에 기억된 URL 문자열을 생성한다.**
   외부 검색 API 는 최소한 「지금 존재하는 페이지」를 주지만, Nano 는 **학습 시점의 기억** 이다.
```

🟡 **tool use 는 스펙에 있다 — 그러나 우리 문제를 풀지 않는다**(explainer · webmachinelearning/prompt-api):
```
"when the model decides to invoke a tool, it returns tool call requests … to
 **the application, which executes the tool**"
🔴 도구를 실행하는 것은 브라우저가 아니라 **앱** 이고, Chrome 내장 검색 도구는 **0개** 다.
🔴 즉 tool use 가 출시돼도 「검색 수단을 우리가 가져와야 한다」로 **원점 복귀** 한다
   — 그 지점이 WU-006R 에서 이미 STOP 됐다.
🔴 Chrome 출시 여부는 **UNKNOWN**(Chrome 문서·chromestatus 에 항목 없음 · explainer 에만 있다).
```

### 🟢 상태표 (2026-10 · Extensions 가 Web 보다 먼저 열렸다)

```
Stable(ext 138)  Translator · Language Detector · Summarizer · **Prompt API**
Trial/OT         Writer · Rewriter · Proofreader
🔴 Prompt API 의 **Web 측** 등급은 UNKNOWN(두 판독이 엇갈렸다 · 버전 148 만 일치)
```

### 🔴 실사용 제약 (Discovery 가 아니어도 걸린다)

```
디스크 **22GB** · VRAM **>4GB**(또는 RAM 16GB + 4코어) · 모바일 미지원
🔴 "the model can be deleted at any time, **even mid-session**" — 자동 재다운로드 안 한다
🔴 2B / 4B 변종을 Chrome 이 고르고 **우리가 통제할 수 없다** → 판정 재현성 위험
🔴 그리고 **셀러 브라우저에서만 돈다** — 서버사이드 MI 파이프라인에 그대로 안 꽂힌다
```

---

## 3. WebMCP — 🔴 **방향이 반대다**(이것이 이 WU 의 가장 중요한 발견)

우리가 그린 화살표:
```
따져 → WebMCP → Gemini agent → 웹 검색 → 후보 URL 을 «받는다»
```
🔴 **규격의 화살표는 정반대다**(webmachinelearning.github.io/webmcp IDL 전수):
```
브라우저 안 Agent ──① getTools() ──▶ 웹페이지(= tool 등록자)
                  ──② executeTool() ─▶
                  ◀─③ 결과 문자열 ────
🔴 페이지 → agent 로 «질의» 를 보내는 화살표가 **없다**
```

```
interface ModelContext : EventTarget {
  registerTool(...)   getTools(...)   executeTool(...)      ← 메서드가 **셋뿐**
}
🔴 「모델을 부른다」·「검색을 요청한다」에 해당하는 멤버가 **0개** 다.
🔴 explainer Goals / Non-Goals **어디에도** 그 항목이 없다 — 애초에 논의 대상이 아니다.
```

> "WebMCP is a proposed web standard to help you build and **expose structured tools for
> AI agents**." — developer.chrome.com/docs/ai/webmcp
> "two APIs that **exclusively interact with a browser's built-in agent**" — .../compare-mcp

🔴🔴 **그러므로 따져가 WebMCP 를 붙이면 얻는 것은 「Gemini 가 우리 사이트를 조작할 수 있게
되는 것」이고, 우리가 찾던 「후보 URL 을 받는 것」이 아니다.**

🔴 상태: **Proposed** · Origin Trial Chrome **149→156**(162 연장) · "subject to change".
🔴 진입점 주의 — 지시서에 적힌 `navigator.modelContext` / `provideContext` 는 **현행 1차자료와
다르다**. 규격·문서 모두 **`document.modelContext`** 이고 `provideContext` 는 IDL 에 **없다**.
🔴 호출자 agent 의 정체는 **UNKNOWN** — 공식 문서들이 「내장 agent」와 「확장 agent」로 **엇갈려** 적는다.

### 🔴 역방향 primitive 는 생태계에서 닫히는 중이다 (1차자료 재확인)

> **Deprecated**: The Sampling feature is deprecated as of protocol version `2026-07-28`
> … **New implementations SHOULD NOT adopt it; existing implementations SHOULD migrate
> to integrating directly with LLM provider APIs.** — modelcontextprotocol.io

🟢 헌장 §12 의 기존 기록과 일치하고, 이번에 **원문으로 재확인**했다.

---

## 4. Gemini in Chrome / AI Mode — 🔴 **기능은 있다. 개발자 경로가 없다.**

🔴 **세 축을 갈라야 한다 — 「기능 존재」 ≠ 「프로그래밍 접근」 ≠ 「약관 허용」**

| | Gemini in Chrome | AI Mode | Chrome Built-in AI |
|---|---|---|---|
| A 기능 존재 | 🟢 (한국 포함) | 🟢 | 🟢 |
| B 프로그래밍 접근 | 🔴 **공식 API 0** | 🔴 **공식 API 0** | 🟢 있다 — 🔴 검색 능력 0 |
| C 약관 허용 | 🔴 우회 경로 금지 | 🔴 robots + ToS 금지 | 🟢 허용(단 B 때문에 무의미) |

### 🔴 B 를 **세 개의 독립 공식 목록**으로 확인했다

```
① chrome.* 네임스페이스 전수(developer.chrome.com/docs/extensions/reference/api)
   → Gemini · AI assistant · browser agent 네임스페이스 **0건**
② Extensions 용 AI API 전수(docs/extensions/ai)
   → Prompt · Writer · Rewriter · Translator · LanguageDetector · Summarizer · Proofreader **7개뿐**
③ "AI in Chrome" 개발자 surface 허브(docs/ai)
   → **Gemini in Chrome 이 개발자 호출 surface 로 등재돼 있지 않다.**
     Gemini 가 나오는 유일한 자리는 **DevTools 안의 채팅**(개발자 본인용 도구)이다
```

🔴🔴 **함정 — 「build AI-powered Extensions with Gemini」를 오독하지 않는다.** 그 문장이
가리키는 것은 ⒜ **Gemini Cloud API**(키·과금 · 전략상 제외) 또는 ⒝ **Gemini Nano**(온디바이스)다.
**브라우저의 Gemini 어시스턴트가 아니다.**

🔴 증거 등급: 이것은 **「공식 API surface 에 존재하지 않는다」**(3개 목록 교차)이고
**「Google 이 금지한다고 적었다」는 아니다**(그 문장은 UNKNOWN). 실무 판단으로는 「없다」가 맞다.

### 🔴🔴 그리고 auto browse 는 **우리 제품 조건에 구조적으로 안 맞는다**

```
support.google.com/chrome/answer/16821166
  "Be 18 or over and **in the US**."
  Google AI **Pro** "up to 20 requests per day" · **Ultra** "up to 200 requests per day"
🔴 미국 한정 + **유료 구독 필수** + 일일 할당. 한국 셀러 도구의 Discovery 엔진이 될 수 없다.
🟢 기본 Gemini in Chrome(요약·탭 비교)은 한국 제공 — 🔴 그러나 그것은 **웹 검색 Discovery 가 아니다.**
```

### 🔴🔴 신설 조항 — **WU-002 이후에 생겼고, STOP 을 강화한다**

```
CWS 2026 정책 갱신(developer.chrome.com/blog/cws-policy-updates-2026) · **시행 2026-08-01**
  Malicious and Prohibited Products 에 추가 —
  "Extensions designed to circumvent safety guardrails, **usage restrictions**, or other
   protective measures implemented by **AI-powered services**"
🔴 auto browse 의 **20회/일 · 200회/일** 이 바로 그 「usage restriction」 이다.
   프로그램으로 소비·우회하는 구조는 이 조항의 **문언 사정권 안**이다.
🔴 Google 이 우리 사례를 그렇게 판정할지는 UNKNOWN — 조항이 그 «행위 유형» 을 지명한다는 것은 확정.
그리고 기존 둘이 그대로 유효하다:
  CWS §4.4.1 "knowingly violates a third party's terms of service"
  Google ToS "using automated means to access content … in violation of … robots.txt"
  google.com/robots.txt  `Disallow: /search`  (AI Mode 가 그 경로 위에서 돈다)
🔴 Google ToS 에 한 줄 더 있다 — "using AI-generated content from our services to
   **develop machine learning models or related AI technology**"
```

---

## 5. Local AI — 🔴 **검색 다리가 없다**(재조사하지 않았다 · WU-006R 결론 적용)

```
질문: Local AI 가 «직접» 검색하는가, 검색 «결과를 받아» 정리하는가?
답:   **후자다.** 로컬 LLM 은 검색하지 않는다 → Search source 가 **따로** 필요하다.
🔴 그 Search source 를 WU-006R 가 전수 판정했고 **0원 + 저장 허용** 을 동시에 만족하는 것이 **0건** 이다:
   Mojeek 🟢저장 허용인데 **£3 CPM 유료** · Marginalia **CC-BY-NC-SA 비상업 전용** ·
   SearXNG **상위 엔진 약관 상속** · Brave/Bing/Google/Exa **DB 생성 금지 명시** ·
   IndexNow/Bing WMT **질의 기능 0** · Wikidata 🟢CC0인데 **분모 0**
🔴 Custom Search JSON API — 1차자료 **재확인**: "closed to new customers" ·
   기존 고객도 **2027-01-01** 까지. 헌장의 그 줄은 추정이 아니라 사실이었다.
→ 🔴 Local AI 는 **Prompt API 와 같은 벽**(검색 부재)에 **GPU/PC 비용**이 더해진 것이다.
```

---

## 6. STEP 4 평가표 — 같은 기준

| 항목 | Chrome Native AI | Extension + 3자 AI UI | Local AI | **Shopify Suggest** |
|---|---|---|---|---|
| 웹 검색 | 🔴 **능력 0** | 🟡 AI 가 함 | 🔴 능력 0 | 🟢 샵 내부 검색 |
| 후보 URL 반환 | 🔴 환각 위험 | 🟡 가능 | 🔴 환각 위험 | 🟢 실재 URL |
| 원문 결과 획득 | 🟢 | 🟡 DOM 뿐 | 🟢 | 🟢 JSON |
| 사용자 로그인 | 🟢 불필요 | 🔴 필요 | 🟢 불필요 | 🟢 불필요 |
| 별도 API / Key | 🟢 0 / 0 | 🟢 0 / 0 | 🟢 0 / 0 | 🟢 **0 / 0** |
| 서버 비용 | 🟢 0 | 🟢 0 | 🟢 0 | 🟢 0 |
| 로컬 비용 | 🔴 22GB + >4GB VRAM | 🟢 낮음 | 🔴 GPU/PC | 🟢 0 |
| 자동화 가능 | 🟢 공식 | 🔴 **약관 금지** | 🟢 | 🟢 |
| 공식 지원 경로 | 🟢 Chrome 138 ext stable | 🔴 **0** | 🟢 | 🟢 공식 문서화 |
| 현재 사용 가능 | 🟢 | 🔴 | 🟢 | 🟢 **운영 중** |
| 6건 benchmark 실행 | 🔴 **무의미**(검색 0) | 🔴 금지 | 🔴 무의미 | 🟢 **이미 했다** |
| 기존 harness 연결 | 🟡 판정보조만 | 🟡 | 🟡 | 🟢 **연결됨** |
| 예상 정확도 | 🔴 측정불가 | 🔴 측정불가 | 🔴 측정불가 | 🟢 **실측 있음** |
| 구현 난이도 | 중 | 중 | 상 | 🟢 **0(완료)** |
| **정책/기술 STOP** | 🔴 **기술 STOP** | 🔴 **정책 STOP** | 🔴 **기술 STOP** | 🟢 **없음** |

---

## 7. baseline 과 그 **정확한 단서** (재실행 0)

`docs/SUGGEST-DISCOVERY-GT-019A-ALT3.md` 실측:

```
suggest 호출 66/66 성공 · 후보 **148**
MI SAME          5/5 → GT SAME 5 · DIFFERENT 0   🟢🟢 **False SAME = 0**
MI PRESUMED_SAME 6/6 → GT SAME 0 · DIFFERENT 6
Precision(SAME 만)       5/5  = **100%**
Precision(SAME+PRESUMED) 5/11 = **45%**
🔴 두 기준을 «같이» 적는다 — 하나만 쓰면 결과가 숨는다(원문 §37)
```

🔴🔴 **단서 — 분모를 과장하지 않는다**: 원문 §8-9 이 명시한다. 「**148 전수 GT 를 하지
않았다** · MI 판정을 GT 로 쓰지 않았다」. GT 가 붙은 것은 **11건**(MI 가 SAME/PRESUMED_SAME 을
준 것)이다. 🔴 따라서 「Shopify Suggest 정확도 100%」로 **단독 인용하지 않는다.**

### 🟢 AI Search 는 「측정 불가」가 아니다 — 오늘 잴 수 있다

```
WU-020 보고가 확인한 것 — ①~⑪ 하니스가 **이미 전부 구현·테스트 완료** 이고
빠진 것은 입력 하나다:
  작업량 = 원상품 **6건**(019A-SEARCH §3 작업표) × 모델 1개 = **붙여넣기 6회**
  방법   = 사람이 자기 브라우저에서 **직접** 입력(자동화 0) → 답변 «원문 전체» 복사
  저장   = %TEMP%\mi-p0-02\mi-019a-search-results.json
🟢 ToS 문제 **없다** — WU-002 가 막은 것은 「자동 입력」이지 「사람이 쓰는 것」이 아니다.
🟢 그 파일이 들어오면 **추가 개발 0** 으로 AI vs MI KPI 가 나온다.
🔴 known-positive 분모는 **5**(S3 는 정답 URL 404) · 「Recall」로 적지 않는다.
```

---

## 8. 🟡 부수 관측 하나 — **Discovery 가 아니라 「판정 보조」 축**(제안 아님 · CPO 판단)

```
🟢 Prompt API 는 Extensions 에서 **Chrome 138 stable** 이고 비용 0 · 키 0 · 네트워크 0 이다.
   우리가 «이미 가져온» HTML/상품 텍스트를 넣어 분류·요약시키는 것은 **기술적으로 가능** 하다.
🔴 그러나 ⒜ 22GB + >4GB VRAM ⒝ 2B/4B 변종 통제 불가 ⒞ 세션 중 모델 삭제 가능
   ⒟ **서버가 아니라 셀러 브라우저에서만 돈다** → 현재 서버사이드 MI 에 그대로 안 꽂힌다.
🔴 그리고 MI 는 지금 **보수적 Identity 판정기로 유지** 가 확정이다 → CTO 가 제안으로 올리지 않는다.
```

---

## 9. 다음 단계 — 🔴 **CPO 선택 3안** (CTO 는 실행하지 않았다)

```
⒜ 🟢 **권고** — Shopify Suggest 를 유지하고, AI Search 는 **사람 수집 6회**로 측정한다.
   비용 ₩0 · ToS 위험 0 · 추가 개발 0. 들어오면 AI vs MI KPI 가 바로 나온다.
   🔴 단 「CEO Action: NONE」과 충돌한다 — 유일한 합법 수집 수단이 사람의 손이다.
      §3 에 따라 **CTO 가 CEO 에게 직접 요청하지 않는다.**
⒝ AI Search 축을 **완전히 접는다** — Shopify Suggest + 기존 국내 검색으로 간다.
⒞ 유료 API 로 간다 → 🔴 WU-006R 「외부 AI/검색 API 전면 STOP」을 뒤집는 결정.
```

🔴 **Extension / Chrome Native AI / Local AI 를 다음 WU 로 올리지 않는다** — 셋 다
이번 Gate 에서 탈락했고, 탈락 사유가 **우리가 바꿀 수 없는 것**(모델 능력 · 규격 방향 · 타사 약관)이다.

---

## 10. 변경 없음 확인

```
Extension 0 · manifest 0 · DOM scraping 0 · AI 웹 UI 접속 0 · Playwright 0 ·
AI API 0 · 키 0 · 결제 ₩0 · DDG 0 · Shopify Suggest 0 · MI threshold 0 ·
색상사전 0 · Category/Sourcing 0 · Registry 0 · Production 0 · schema 0 · 배포 0
산출물 = 이 문서 **1파일**
```
