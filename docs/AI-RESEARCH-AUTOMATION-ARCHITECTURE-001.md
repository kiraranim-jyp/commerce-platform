# AI-RESEARCH-AUTOMATION-ARCHITECTURE-001 — 기술검토 (구현 0)

> 🔴 **코드 변경 0 · Gemini 호출 0 · API 호출 0 · Playwright 설치 0 · 비용 ₩0.**
> 🟢 flag **OFF 복구 완료** — `env ls` 0건 · 재배포 success · 런타임 로그에
> `[MI-023-metrics]` **0건**(= Production Gemini 호출 **0** · ₩3,171 보존).
> 🔴 아래는 **공식 문서·공식 가격·약관 원문** 기반이다. 3자 블로그 수치는 「불명확」으로 표시했다.

---

## §1. 결론

> **현재 기술/정책/비용 조건에서 추천하는 구조는
> 「AI 채팅을 쓰지 않고, 도메인 필터를 지원하는 «검색 API» 로 후보 URL 만 받아
> 기존 MI 가 검증하는 구조」(= OPTION F) 다.**

```
ZERO HUMAN        🟢 **가능**
ZERO GEMINI API   🟢 **가능** (단 「AI 를 쓰지 않는다」는 뜻이고, 「AI 웹 UI 를 자동화한다」는
                     🔴 **불가능** — 약관이 막는다)
```

🔴🔴 **그리고 이 WU 의 가장 중요한 발견은 추천안이 아니라 이것이다**:

```
CPO 가 그리신 「브라우저로 Gemini/ChatGPT 를 열어 자동으로 쓰는」 구조는
**기술적으로는 되고, 약관으로는 막힌다.** 그 근거는 추론이 아니라 공개 문서 두 줄이다:

  gemini.google.com/robots.txt   →  Disallow: /app/   Disallow: /chat/
  Google ToS (효력 2026-07-30)   →  "using automated means to access content ...
                                     in violation of the machine-readable
                                     instructions on our web pages
                                     (for example, robots.txt files ...)"

  chatgpt.com — OpenAI ToU (효력 2026-01-01)
                → "**Automatically or programmatically extract data or Output**"
                → "**You may not share your account credentials or make your
                    account available to anyone else**"
```

🔴 즉 **「AI 웹 UI 자동화」 노선 전체(OPTION A·B·D 의 AI-UI 변종)는 정책상 탈락** 이다.
🔴 제재 수준도 확인됐다 — Google ToS 는 **계정 삭제** 까지, 그리고 Google 자신의
`gemini-cli` 문서가 3자 도구 접근을 **"grounds for suspension or termination of your
account"** 로 명문화했다. 🔴 **리스크가 우리 계정이 아니라 «셀러 계정» 에 떨어진다.**

---

## §2. 후보별 판정

| 후보 | 기술 가능 | Zero Human | 비용 | 상용화 | 정책 리스크 | 종합 |
|---|---|---|---|---|---|---|
| **A. Chrome Extension + 사용자 브라우저 + AI Web** | 🟢 가능(확정) | 🔴 **불가** — 브라우저가 켜져 있어야 함 | 🟢 낮음 | 🔴 **불가** | 🔴🔴 **금지 실효** | 🔴 **탈락** |
| **B. Server + Cloud Browser + AI Web Agent** | 🟢 가능 | 🟢 가능 | 🔴 불명확(브라우저+AI 이중) | 🔴 불가 | 🔴🔴 **금지** | 🔴 **탈락** |
| **C. 공식 AI Agent / Browser capability** | 🔴 **API 가 없다** | — | — | — | 🟢 — | 🔴 **탈락(제품 부재)** |
| **D. 별도 AI Browser Agent Provider** | 🟢 가능 | 🟢 가능 | 🔴 불명확 | 🟡 벤더는 상용 | 🔴 **대상 사이트 약관이 지배** | 🔴 **조건부 탈락** |
| **E. 현재 Gemini API 구조 유지** | 🟢 **작동 실증**(WU-023B) | 🟢 가능 | 🔴 **쿼리당 $14~$35/1k · 상한 통제 불가** | 🟢 가능 | 🟢 허용(조건부) | 🟡 **2순위** |
| **🆕 F. 검색 API(도메인 필터) + 기존 MI** | 🟢 가능 | 🟢 **가능** | 🟢 **$1~8/1k · 쿼리 수 100% 통제** | 🟢 가능 | 🟡 제공자별 저장조항 | 🟢 **1순위** |

🔴 **F 는 지시서 §12 의 A~E 목록에 없던 후보다.** 조사 과정에서 전제가 바뀌어 생겼고,
숨기지 않고 **새 후보로 명시** 한다(§9 에 선정 이유).

### 각 탈락의 «결정적» 한 줄

```
A  Chrome Web Store Developer Agreement §4.4.1(1) — 제품이 "knowingly violates a
   third party's terms of service" 면 Google 이 조치하고, §7.2 로 **이미 배포된 고객
   단말에서 원격 제거** 까지 가능하다. 🔴 Gemini/ChatGPT UI 자동화가 그 「third party
   ToS 위반」에 정확히 해당한다(§1). → 배포 자체가 성립하지 않는다.
   🔴 그리고 Zero Human 도 깨진다 — **사용자 PC·브라우저가 켜져 있어야** 한다.

B/D 클라우드 브라우저(Browserbase 류)는 **인프라** 일 뿐이고 약관 문제는 **대상 사이트**
   에서 난다. AI 웹 UI 를 대상으로 하면 §1 의 금지가 그대로 적용되고, Google 검색을
   대상으로 하면 `google.com/robots.txt` 의 `Disallow: /search` 가 적용된다.
   🔴 **벤더를 사면 인프라와 면책조항을 사는 것이고, 권한(authorization)을 사는 것이 아니다.**
   🔴 ScrapingBee T&C §10 이 그것을 명문화한다 — "User is **solely responsible** that
      web scraping operations ... are duly authorized by the ... terms of the targeted" 사이트.

C  공식 경로는 **「사람이 UI 에서 쓰는 것」 뿐** 이다.
   · ChatGPT Browser — "available in ChatGPT on the web and in the desktop app" (API 0)
   · Atlas — ChatGPT 로 통합됨(공식 help 제목 확인 · 🔴 본문은 Cloudflare 403 으로 미확인)
   · **Workspace Agents API** 는 외부에서 ChatGPT 를 «트리거» 할 수 있는 공식 경로인데
     🔴🔴 공식 문서가 **"The agent's response cannot currently be retrieved through
     the API."** 라고 적는다 → **조사 엔진으로 성립하지 않는다.**
   · Gemini 쪽에 그에 상당하는 비-API 자동 경로는 **찾지 못했다(불명확/부재)**.
```

---

## §3. 추천 Architecture (OPTION F)

```
[User: 상품 URL 1개]
      ↓
[Original Product Extraction]           🟢 **기존 그대로** universalExtract → canonicalProduct
      ↓
[Product Identity]                      🟢 **기존 그대로** buildProductIdentityDna → ProductFacts
      ↓
[Research Job]                           (큐 · 상품당 1 job · 재시도 상한)
      ↓
┌─────────────────────────────────────────────────────────────┐
│ [AI-less Discovery Worker]   ← 🔴 여기가 유일한 교체 지점      │
│   ① buildPrimaryQuery(기존)  → 「브랜드 + 품번」 한 줄         │
│   ② SearchProvider.search({ query, includeDomains, limit })  │
│       🟢 도메인 필터로 **국내 등록부 도메인** 을 직접 지정       │
│       🟢 1 request = 1 과금 단위 (쿼리 수를 우리가 센다)        │
│   ③ URL 목록만 받는다 (스니펫·요약·AI 판정 **쓰지 않는다**)     │
└─────────────────────────────────────────────────────────────┘
      ↓  Candidate URLs (최대 N · 상한은 우리가 건다)
[Candidate Fetch]                        🟢 **기존 그대로** factsFromProductUrl
      ↓                                     (+ JSON-LD 가격 — WU-020)
[MI Identity Verification]               🟢 **기존 그대로** withConfidence →
      ↓                                     judgeDomesticCandidate
[SAME / PRESUMED_SAME / SIMILAR / CONFLICT / UNKNOWN]
      ↓  (가격 축에 들어가는 것은 EXACT/COMPARISON + 검증된 가격만)
[Market / Currency / Price]              🟢 **기존 그대로** classifyCandidateMarket(WU-020)
      ↓
[MI Sales Decision]                      🟢 **기존 그대로** sellability →
      ↓                                     representative → sellerFacing
[Registration]                           🟢 **기존 그대로** P-32 분리 유지
```

### 각 단계의 책임

| 단계 | 책임 | 하지 않는 것 |
|---|---|---|
| Discovery Worker | **후보 URL 을 찾는다** | 🔴 SAME 판정 · 가격 확정 · 시장 단정 |
| Candidate Fetch | 실제 페이지를 **1회** 받는다 | 🔴 추가 fetch · Playwright(JSON-LD 범위) |
| MI Identity | **동일상품 여부를 판정한다** | 🔴 검색 제공자의 랭킹을 신뢰하지 않는다 |
| Market/Price | 통화·시장을 **증거 일치 시에만** 단정 | 🔴 환산 · UNKNOWN 승격 |
| Sales Decision | 최종 판매 판정 | 🔴 등록 판정(P-32) |

🟢 **AI 가 사라지는 것이 이 구조의 핵심이 아니다** — 핵심은 **「발견」과 「판정」의 분리** 이고,
그 분리는 **이미 우리 코드가 하고 있다.** Gemini 는 발견만 하고 있었고(WU-019R: Gemini 전용
판정 규칙 **0**), 그 발견을 더 싸고 통제 가능한 수단으로 바꾸는 것뿐이다.

---

## §4. 비용 모델

🔴 **환율 환산을 하지 않는다**(USD/GBP 원문). 🔴 `*` = 공식 단가에서 산술한 값.

| 방식 | 과금 단위 | 상품 1건 | 1,000건 | 10,000건 | 비고 |
|---|---|---|---|---|---|
| **E. Gemini API (3세대+)** | **검색 쿼리당** | 쿼리 **3개**(실측) | **$42*** | **$420*** | 🟢 월 **5,000 쿼리 무료**(≈1,600건) · 🔴 쿼리 수 **통제 불가** |
| E-b. Gemini API (2.5세대) | 검색 쿼리당 | 3 쿼리 | **$105*** | **$1,050*** | 🔴 $35/1k |
| OpenAI `web_search` | **호출당 + 토큰** | 1 call+토큰 | **$10 +토큰** | **$100 +토큰** | 🔴 content 토큰이 모델별로 **고정 아님** |
| Grounding with Bing | tool call | — | $14 | $140 | 🔴🔴 **raw URL 접근 금지** → 사용 불가 |
| **F. Tavily (basic)** | request | 1 | **$8*** | **$80*** | 🟢 월 1,000 무료 · 도메인 필터 **300개** |
| **F. Exa (Instant)** | search | 1 | **$4** | **$40*** | 🟢 월 $10 무료(리셋) · wildcard 도메인 |
| **F. Brave** | request | 1 | **$5** | **$50*** | 🔴 저장·**benchmark 금지** 조항 |
| **F. Mojeek** | CPM | 1 | **£2** (GBP) | **£20*** | 🟢 상업·AI 사용 **명시 허용** · 🔴 인덱스 9B |
| A. Chrome Extension | 구독료 | — | — | — | 🔴 **정책 탈락** |
| B/D. Cloud Browser | 세션당 | 불명확 | 불명확 | 불명확 | 🔴 **정책 탈락** · 공식 단가 미확인 |
| C. 공식 Agent | — | — | — | — | 🔴 **제품 부재** |

🔴 **100,000건은 추정하지 않는다** — 어느 제공자도 그 구간의 공식 단가/한도를 공개하지
않았고(전부 「문의」), 우리 쪽 전수도 현재 **498건** 이다. 선형 외삽은 §12 금지에 걸린다.

### 🔴🔴 E 를 재평가해야 하는 발견 하나

```
Gemini Search Grounding 공식 가격이 **세대별로 다르다**:
   Gemini 3 세대 이상  **$14 / 1,000 queries** + 월 **5,000 쿼리 무료**
   Gemini 2.5 세대      **$35 / 1,000 queries** (무료 1,500 RPD)
🔴 우리는 `"gemini-flash-latest"` **별칭** 을 쓴다 — 어느 세대로 해석되는지 **코드로는 모른다**
   (메모 `gemini-cost-is-per-search-query-not-per-call`: 별칭이라 과금 구조가 코드 없이 바뀐다).
→ 🔴 즉 ₩21,700 소진이 **2.5 세대 요율 + 쿼리 5.5개/호출** 조합이었을 가능성이 있다.
🟢 **모델을 3 세대로 «고정» 하고 쿼리를 1~3개로 묶으면 월 5,000 무료 구간에 들어갈 수 있다**
   — 상품 1,600건/월 까지 **$0** 이다.
🔴 단 무료 tier 는 ① 입력이 **제품 개선에 사용** 되고 ② EEA/영국 대상 서비스는 **유료 필수**
   라는 조건이 붙는다(공식 Additional ToS). **제품정책 판단 사안** 이다.
```

---

## §5. 정책 / 약관 — **「기술적으로 가능」을 「가능」으로 뭉개지 않는다**

| 후보 | 분류 | 근거 (원문 · 출처) |
|---|---|---|
| gemini.google.com 자동화 | 🔴 **금지** | `robots.txt: Disallow: /app/ /chat/` + Google ToS "automated means ... in violation of the machine-readable instructions" |
| 1계정 다수고객 공유(Google) | 🔴 **금지** | ToS "distribute, sell, or lease any part of our services" · 제재 "delete your Google Account" |
| chatgpt.com 자동화 | 🔴 **금지** | OpenAI ToU "Automatically or programmatically extract data or Output" · "bypass any protective measures" |
| 고객 ChatGPT 계정 대리 로그인 | 🔴 **금지** | ToU "may not share your account credentials" · Services Agreement §3.1/3.2 |
| Chrome Extension 배포 | 🔴 **금지(실효)** | CWS Developer Agreement §4.4.1(1) third-party ToS 위반 + §7.2 원격 제거 |
| 3자 SERP API(Google 대상) | 🔴 **채택 불가** | `google.com/robots.txt: Disallow: /search` + ToS robots 참조 편입 · 벤더 약관이 책임을 **고객에게** 전가 |
| Grounding with Bing | 🔴 **금지(용도)** | "Developers and end users **don't have access to raw content**" · ToU §3(c) "using links for crawling or scraping" 금지 |
| 네이버 검색 API | 🔴 **조건 충돌** | 특약 2.3 — 복사·저장·캐싱 금지 · **AI 입력/학습/평가 금지** · 수익화 금지. 🔴 쇼핑 API 는 **2026-07-31 종료(대체 없음)** |
| Google CSE | 🔴 **채택 불가** | "**closed to new customers**" · **2027-01-01 종료** |
| **Gemini/OpenAI 공식 API** | 🟡 **조건부 허용** | Gemini: Grounded Results **재판매·분석·학습 금지**, 2년 보관 예외, Search Suggestions **표시 의무** · OpenAI: **inline citation 노출 의무** |
| **Tavily** | 🟢 **허용** | 서비스 ToS 가 상업적 사용 **명시 허용** (🔴 웹사이트 약관은 non-commercial — 문서 둘) |
| **Mojeek** | 🟢 **허용** | 상업 사용 · 광고 병치 · **"AI and machine learning applications"** 명시 허용 |
| **Brave** | 🟡 **조건부** | ToS §3(b)(i) 저장/캐시 금지(transient 만) · 🔴 §3(b)(xiii) **`evaluate`/`benchmark` 금지** |
| **Exa** | 🟡 **불명확** | 저장 금지 조항 존재하나 **ToS PDF 본문 미확인** → 채택 전 직접 확인 선행 |

### 🔴 두 층을 섞지 않는다 (CPO 지적이 정확했다)

```
층 1  검색 API 로 «URL 목록을 받는» 행위     → 검색 제공자 약관이 지배
층 2  그 URL 의 «페이지를 직접 fetch» 하는 행위 → 🔴 **대상 사이트** 의 robots/약관이 지배
🟢 Brave 가 이것을 명문화했다 — "does not grant any rights to third-party content
   such as webpages ... must ensure their access to those webpages complies with
   the copyright terms of the page publishers."
🟢 우리는 층 2 를 **이미 따로** 다뤄 왔다(메모 `auto-source-adoption-standard`:
   「우리 UA 가 robots 에서 허용되는가」). **검색 제공자를 바꿔도 그 축은 변하지 않는다.**
🔴 단 **Bing 경로만은 층 2 자체를 금지** 한다 → 그래서 사용 불가다.
```

---

## §6. 계정 / 세션 모델

```
🟢 추천(F)      계정 개념이 **없다.** 따져의 **서버측 API 키** 하나로 호출하고
                셀러는 결과만 본다. session isolation·쿠키 보관·OAuth·만료 복구가
                **전부 불필요** 하다 → §8/§9 의 보안 항목 대부분이 **소멸** 한다.
🟡 E(Gemini API) 동일 — 따져 조직 키. OpenAI Services Agreement 의 **End User** 정의가
                「고객의 customers 가 Customer Application 을 통해 쓰는 것」을 정상 모델로
                전제한다 → 🟢 **우리 키로 다수 셀러에게 서비스하는 것은 허용** 이다.
🔴 A/B/D       「셀러 개인 AI 계정을 우리 서버가 대신 쓴다」 → **약관 금지** (§5).
                그리고 리스크가 **셀러 계정 정지** 로 떨어진다. 🔴 상용 SaaS 로 성립 안 함.
🟡 대안 1개 존재  OpenAI **Sign in with ChatGPT + plan usage**(OAuth PKCE) 는 고객 요금제를
                합법적으로 쓰는 공식 경로다. 🔴 단 ① **유료/원격호스팅은 신청 승인제**
                ② `background` 미지원(장시간 조사 불가) ③ web search 가용이 계정 정책에
                달려 **보장되지 않는다** → 지금 제품 요구에 **못 맞는다**.
```

---

## §7. Failure Mode

| 실패 | OPTION F 에서의 대응 | 🔴 A/B/D 였다면 |
|---|---|---|
| 로그인 만료 | **해당 없음**(계정 없음) | 🔴 전면 중단 · 사람 개입 |
| CAPTCHA / bot detection | **해당 없음** | 🔴 Cloudflare `Cf-Mitigated: challenge` 실측 |
| 계정 정지 | **해당 없음** | 🔴🔴 **셀러 계정** 삭제 가능 |
| 검색 실패 / 0건 | 🟢 기존 처리 그대로 — 후보 0 은 **정상 결과**(FAIL 이 아니다) | 동일 |
| 제공자 장애 | 🟢 `SearchProvider` 교체 — **MI 는 불변** | 🔴 UI 변경에 연동돼 깨진다 |
| rate limit | 🟢 1 request = 1 단위라 **우리가 센다** · 큐에서 조절 | 🔴 통제 불가 |
| 잘못된 candidate | 🟢 **MI 가 거른다**(기존 판정) — 검색 랭킹을 신뢰하지 않는 설계 | 동일 |
| duplicate candidate | 🟢 `normalizeCandidateUrl` + self-reference(008A) 기존 그대로 | 동일 |
| browser crash / timeout | **해당 없음** | 🔴 세션 복구 필요 |
| 제공자 정책 변경 | 🟡 provider 교체로 흡수 · 🔴 **저장 조항은 계약 전 확인** | 🔴 즉시 중단 위험 |
| 비용 급증 | 🟢 **구조적으로 불가** — 쿼리 수 = 우리가 거는 상한 | 🔴 Gemini 는 호출당 N 쿼리 |

---

## §8. 기존 따져 시스템 영향

```
🟢 유지 (그대로 재사용 — 다시 만들지 않는다)
   universalExtract / extractProductData(JSON-LD)      원상품 + 후보 가격
   buildProductIdentityDna / productFactsFromIdentityDna
   buildPrimaryQuery (WU-014)                          🟢 검색어 생성은 이미 우리 것이다
   factsFromProductUrl / createLivePageProbe / normalizeCandidateUrl
   isSelfReferenceCandidate (008A 정책)
   withConfidence / compareCrossSellerProducts / judgeDomesticCandidate
   classifyCandidateMarket / summarizeCandidateOverseasPrices (WU-020)
   summarizeDomesticMarketSplit / sellability / representative / sellerFacing
   registration readiness (P-32)
   GeminiTransientCandidates UI (WU-022)  ← 🔴 이름만 provider 중립으로 바꾸면 그대로 쓴다

🟡 수정 필요 (작다)
   gemini-candidate-pool.ts → `DiscoveryProvider` 뒤로 숨긴다(§6 추상화)
   run-domestic-price-check.ts 의 flag 분기 → provider 선택으로 일반화
   [MI-023-metrics] 로그 → provider 중립 필드명

🔴 폐기 후보 (단 «지금» 지우지 않는다)
   Gemini Search Grounding «기본 경로» 로서의 지위
   → 🟢 코드는 **보존** 한다(WU-023B 가 작동을 실증했다). provider 하나로 남긴다.
```

🔴 **「AI 검색 문제 때문에 검증/판정 로직을 다시 만들지 않는다」는 지시를 그대로 지킨다** —
교체 지점은 **Discovery 한 칸** 이고, 그 칸 뒤의 모든 것이 그대로다. WU-019R 이 그
경계를 이미 코드로 확인했다(Gemini 전용 판정 규칙 **0**).

---

## §9. 최종 추천

```
1순위  🆕 **OPTION F — 검색 API(도메인 필터 지원) + 기존 MI**
2순위  🟡 **OPTION E — Gemini API 유지, 단 «모델 세대 고정 + 쿼리 상한» 조건부**
탈락   🔴 A(Chrome Extension) · B(Cloud Browser + AI Web) · C(공식 Agent) ·
        D(AI Browser Agent Provider) · 3자 SERP(Google 대상) · Bing · CSE
```

### 왜 F 인가 — 장단점 나열이 아니라 **결정 근거 넷**

```
① 🟢🟢 **비용 상한이 «구조적으로» 생긴다.** 헌장 §12 가 적어 둔 「비용 상한 4중」 중
   ②상품당 grounding query 상한 ③전체 실행 query 상한 ④KRW 상한이 **없었다.**
   검색 API 는 **1 request = 1 과금 단위** 라 셋이 전부 **우리 손에** 들어온다.
   🔴 Gemini 는 「호출 1회 = 내부 검색어 N개」를 파라미터로 고정할 수 없었고
      (실측 5.5 · WU-023B 3), 그것이 ₩21,700 미조정의 구조적 원인 축이었다.

② 🟢🟢 **WU-023B 가 찾은 실제 결함을 F 가 직접 고친다.** 그 실측에서 Gemini 는 우리가
   넘긴 `preferredDomains` 를 **무시하고** 스스로 `site:item.rakuten.co.jp` 를 골랐다.
   → 검색 API 의 `include_domains`(Tavily 300 · Exa wildcard)는 **우리 국내 등록부를
     그대로 지정** 한다. 「어디를 뒤질지」를 처음으로 우리가 결정한다.

③ 🟢 **AI 가 애초에 필요한 일을 하고 있지 않았다.** WU-019R 실측 — Gemini 전용 판정
   규칙 **0** · 같은 `judgeDomesticCandidate` 를 통과. 즉 Gemini 는 **URL 목록 생성기**
   로만 쓰였다. 🔴 그 일에 추론 토큰 3,989개(WU-023B)를 쓰는 것이 비효율의 본질이다.

④ 🟢 **계정·세션·보안 리스크가 통째로 사라진다**(§6/§7). 그리고 **Zero Human** 이
   유일하게 성립하는 경로다 — A 는 사용자 브라우저가 켜져 있어야 하고, C 는 응답을
   API 로 받을 수 없다.
```

### 🔴 F 를 1순위로 두면서도 **확정하지 않은 것** — 채택 전 선행조건 넷

```
① 🔴🔴 **커버리지 미측정.** 어느 제공자도 「우리 상품의 국내/해외 동일상품 후보를
   실제로 준다」를 증명하지 않았다. Mojeek 인덱스는 9B pages 다(Google 대비 작다).
   → **이것이 다음 WU 의 유일한 질문이어야 한다**(무료 tier 로 비용 0 측정 가능).
② 🔴 **저장 조항 확인.** Brave `evaluate/benchmark` 금지는 우리 측정 관행과 충돌하고,
   Exa 저장 조항은 PDF 미확인이다. 🟢 Tavily·Mojeek 이 가장 깨끗하다.
③ 🔴 **네이버는 쓸 수 없다고 봐야 한다** — 쇼핑 API 종료(대체 없음) + 생존 vertical 의
   「AI 입력 금지 · 저장 금지 · 수익화 금지」 3중 조항. **법무/제품정책 사안** 이다.
④ 🔴 **E 를 지우지 않는다.** 모델 세대를 3+ 로 **고정** 하면 월 5,000 쿼리 무료
   (≈1,600 상품)이고, 그 구간에서는 E 가 **F 보다 싸다**. 🔴 단 무료 tier 의 데이터
   사용 조건이 제품정책 판단 대상이다.
```

---

## §10. 종료 조건 (§14) 에 대한 답

> **「사용자가 URL 하나만 넣으면, 사람의 추가 개입 없이 AI 가 웹을 조사하고 후보를
> 수집한 뒤, 기존 MI 가 실제 페이지를 검증하여 동일상품 가격 비교와 판매판정까지
> 수행할 수 있는 상용 SaaS 구조가 무엇인가?」**

```
🟢 답: **있다 — 단 「AI 가 조사한다」를 「검색 API 가 후보를 준다」로 바꿔야 한다.**
       (OPTION F · §3 구조)

Gemini API 비용 없이   🟢 **가능**
Human 0                🟢 **가능**
상용화 가능             🟢 **가능**
정책상 허용 경로        🟢 **있다** (Tavily · Mojeek 은 상업·AI 사용 명시 허용)
기존 MI 재사용          🟢 **전부 재사용** — 교체는 Discovery 한 칸

🔴 그러나 「브라우저로 AI 웹 UI 를 자동으로 쓰는」 형태로는 **불가능** 하다.
   기술이 막는 것이 아니라 **약관이 막는다**(§1 · §5). 그리고 그 리스크는
   우리가 아니라 **셀러 계정** 에 떨어진다.
```

---

## §11. 준수 사항

```
🟢 코드 변경 **0** · Gemini 호출 **0** · 외부 API 호출 **0** · Playwright 설치 **0**
🟢 DB/schema/UI/Production 배포(기능) **0** · 새 API key **0** · 비용 **₩0**
🟢 flag **OFF 복구 완료** — env 0건 · 재배포 success · `[MI-023-metrics]` 로그 **0건**
   → 🟢 **CEO 클릭 없었고 Production Gemini 호출 0** · 잔액 ₩3,171 보존
🔴 interface 를 **코드로 만들지 않았다**(§6 지시) — 아키텍처 수준 제안까지만
🔴 특정 벤더를 **채택하지 않았다** — 커버리지 미측정이므로 선행조건을 붙였다
🔴 100,000건 비용을 **추정하지 않았다**(공식 단가 부재 + 선형 외삽 금지)
```
