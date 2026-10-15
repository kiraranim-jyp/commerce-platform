# WU-020 — Chrome Extension AI Search PoC · 🔴🔴 **STOP 보고** (구현 0)

🔴 Extension 구현 **0** · manifest 0 · 브라우저 자동화 실행 **0** · AI 웹 UI 접속 **0** ·
AI API 0 · 키 0 · 결제 **₩0** · 운영 코드 0 · DB 0 · schema 0 · UI 0 · 배포 0 · HTTP 0.

🔴 헌장 §3 **STOP 조건 2개 해당** — 「보안/규제 위험」 · 「정책 결정 필요」.
🟢 그래서 실행하지 않고 보고한다. 🔴 **목표를 거부하는 것이 아니다** — §4 에 비용 ₩0 ·
위험 0 으로 **오늘 당장** 같은 목표를 닫는 경로를 적었다.

---

## 1. 🔴🔴 결론 먼저 — WU-020 이 새로 짓자는 것은 **단 한 조각**이고, 그 조각이 STOP 이다

```
WU-020 STEP 4~11 (rawAnswer 규격 · URL 추출 · identity · Discovery 집계 ·
                  AI verdict validator · 독립 GT · AI vs MI KPI)
   → 🟢🟢 **이미 전부 구현돼 있고 테스트가 통과 중이다** (§3)

WU-020 STEP 1~3 (Chrome Extension 으로 사용자 AI Web UI 를 자동 조작해 rawAnswer 수집)
   → 🔴🔴 **WU-002 가 1차자료로 STOP 판정한 바로 그 경로다** (§2)
```

🔴 즉 이 WU 는 「측정 하니스를 만드는 일」이 아니라 **「이미 완성된 하니스의 입력을
사람 대신 Extension 으로 채우는 일」** 이고, 막힌 곳은 **입력 수집 방법 하나** 다.

---

## 2. 왜 STOP 인가 — 지시서의 안전장치가 **다른 축을 막고 있다**

WU-020 §5 는 금지 6항을 적었다: 자동 로그인 · 세션 탈취 · 쿠키 추출 · CAPTCHA 우회 ·
UA spoof · 보안장치 우회. 🟢 **그 여섯은 전부 「우회 기술」 축이다.**

🔴🔴 **그런데 WU-002 가 찾은 차단 사유는 그 축이 아니다** — 원문 그대로 인용한다
(`docs/AI-WEB-RESEARCH-AUTOMATION-002.md:17-19`):

> 「gemini.google.com / chatgpt.com 에 프롬프트를 자동 입력하는 **행위 자체가
> 「허용되지 않는 자동화」** 다. **우회 기술을 쓰지 않아도 그렇다** — 근거는 공개 문서다」

### 1차자료 (WU-002 가 확보 · 재조사하지 않았다)

```
gemini.google.com/robots.txt   Disallow: /app/   Disallow: /chat/
Google ToS (효력 2026-07-30)   "using automated means to access content from any of our
                                services in violation of the machine-readable instructions
                                on our web pages (for example, robots.txt files that
                                disallow crawling...)"
OpenAI ToU (효력 2026-01-01)   "Automatically or programmatically extract data or Output"
                               "You may not share your account credentials or make your
                                account available to anyone else"
chatgpt.com/robots.txt         `/c/*` · `/backend-api/*` 에 Allow **0줄** · `Disallow: /`
실측                            curl 기본 UA → **403 · Cf-Mitigated: challenge**
```

### 🔴 Extension 배포 경로도 따로 막혀 있다 (002:261)

```
| Chrome Extension 배포 | 기술상 🟢 가능 | 🔴 **금지(실효)** — CWS §4.4.1(1) 3자 ToS 위반
                                           + §7.2 **원격 제거** | 결론 🔴 불가 |
```

### 🔴🔴 그리고 제재가 **우리가 아니라 셀러 계정에 떨어진다** (002:41-43)

```
Google ToS 는 **계정 삭제** 까지 가고, Google 자신의 gemini-cli 문서가 3자 도구 접근을
"grounds for suspension or termination of your account" 로 **명문화** 했다.
🔴 즉 실패 모드가 「우리 기능이 죽는다」가 아니라 **「셀러의 Google/OpenAI 계정이 죽는다」** 다.
```

### 🔴 Claude 를 쓰는 변형도 같은 이유로 닫힌다 (헌장 §12 · CTO 가 원문 확인한 건)

```
Anthropic Usage Policy — 「Resell, proxy, or otherwise provide access to Claude through
  unauthorized means, **including services that route requests through consumer
  subscriptions** or misrepresent the product or client being used」
→ 🔴 「사용자가 로그인한 AI Web UI 를 따져가 쿼리에 쓴다」는 이 문장이 **직접 지명** 한다.
🟢 반대 경계도 그대로다 — 「자사 인가 사용자(직원)의 내부 용도」는 제한 대상이 아니다.
   축은 「상업적인가」가 아니라 **「최종 고객을 대신해 요청을 통과시키는가」** 다.
   🔴 따져의 Extension 은 **셀러(= 최종 고객)를 대신해** 통과시키는 구조다.
```

🔴 **「조심해서 PoC 만」이 성립하지 않는다**(002:38-39): 실행하면 위반이고, 위반하지
않으려면 실행할 수 없다. 그래서 **실행 0 으로 보고한다.**

---

## 3. 🟢🟢 이미 있는 것 — WU-020 ①~⑪ 의 **대부분이 구현·테스트 완료다**

🔴 **그러므로 새로 만들지 않는다.** 전수 확인(코드 실측):

| WU-020 STEP | 요구 | 리포 실재 | 상태 |
|---|---|---|---|
| 4 Query | 기존 `buildPrimaryQuery` 재사용 | `discovery-core/query-generator.ts:180` | 🟢 있다 |
| 5 rawAnswer 규격 | model·searchId·rawAnswer 보존 | `docs/AI-SEARCH-COLLECTION-019A-SEARCH.md` §4 | 🟢 규격 확정 |
| 6 URL 추출 | `extractCandidateUrlsFromAiAnswer` **재사용** | `comparison-search/ai-answer-urls.ts:70` | 🟢 있다 |
| 6 URL identity | rawSearchUrl / canonicalUrl / identityKey | `comparison-search/discovery-url-identity.ts:37,49` | 🟢 있다 |
| 7 Discovery 측정 | **known-positive discovery rate**(Recall 금지) | 019A-SEARCH §5 · `matchesKnownPositive(:62)` | 🟢 용어까지 동일 |
| 8 후보 → MI | `factsFromProductUrl` → `withConfidence` → verdict | 기존 운영 owner | 🟢 있다 |
| 9 AI verdict validator | SAME/DIFFERENT/UNCERTAIN 만 · prose 금지 | 019A-EXT 규격 · `mi-019a-ai-verdicts.json` | 🟢 있다 |
| 10 독립 GT | AI≠GT · MI≠GT | `docs/AI-VS-MI-IDENTITY-BENCHMARK-019A.md` | 🟢 있다 |
| 11 AI vs MI KPI | Accuracy·FalseSAME·Agreement·4분면 | 같은 문서 | 🟢 있다 |
| 1~3 Extension | query 전달 → rawAnswer 반환 | `find -name manifest.json` → **0건** | 🔴 **없다 · STOP** |

🟢 하니스는 **살아 있고 정직하게 비어 있다** — `mi-019a-search-ingest.test.ts:278-285`
가 입력 파일이 없으면 **skip 하고 「없음」을 단언** 한다(「AI 가 못 찾았다」로 적지 않는다).
🟢 검증기가 이미 잡는 것: `model` 누락 · 빈 `rawAnswer` · 모르는 `searchId` ·
`(model, searchId)` 중복 · 최상위 비배열.

### 🔴 019A-SEARCH 가 **이미** 적어 둔 현재 상태 (§7) — 이 문장이 여전히 유효하다

```
AI Search 결과   🔴 **측정불가** — 아직 수집하지 않았다(「AI 가 못 찾았다」가 아니다)
파이프라인       🟢 준비 완료 · 검증기 + Discovery 집계 테스트 6건 PASS(AI 0 · HTTP 0)
```

---

## 4. 🟢 그래서 **오늘 ₩0 · 위험 0 으로 같은 목표를 닫는 길이 있다**

```
작업량 = 원상품 **6건** × 모델 1개 = **붙여넣기 6회**     (019A-SEARCH §0·§3)
방법   = 사람이 AI Web UI 에 **직접** 프롬프트를 넣고(자동화 0) 답변 원문을 복사
저장   = %TEMP%\mi-p0-02\mi-019a-search-results.json
         [{ "searchId":"S1", "model":"<모델>", "rawAnswer":"<답변 원문 전체>" }, …]
프롬프트 = 019A-SEARCH §2 의 **고정 프롬프트**(모델마다 동일 · 변형 금지)
원상품 6건 = 019A-SEARCH §3 작업표(S1~S6 · 전부 운영 DB 실데이터)
```

🟢 **그 파일이 들어오면 추가 개발 0 으로 ①~⑪ 이 그대로 나온다**(019A-SEARCH §6).
🟢 **그리고 이 경로에는 ToS 문제가 없다** — 사람이 자기 브라우저에서 직접 쓰는 것은
자동화가 아니다. WU-002 가 STOP 한 것은 **「자동 입력」** 이지 「사람이 쓰는 것」이 아니다.

🔴 **분모 과장 금지**(019A-SEARCH §5 그대로): known-positive 분모는 **5건**(S3 제외 —
그 정답 URL 이 404 다). 🔴 「후보 Recall」로 적지 않는다. 🔴 우리 목록에 없는 URL 은
**오탐이 아니라 「미검증 신규 후보」** 다.

🔴🔴 **그런데 이 경로는 WU-020 의 「CEO Action: NONE」과 충돌한다** — 유일하게 합법인
수집 방법이 **사람의 손** 이기 때문이다. 🔴 그리고 §3 에 따라 **CTO 가 CEO 에게 직접
요청하지 않는다.** 전달 여부는 CPO 판단이다.

---

## 5. 🔴 CPO 결정 사항 — 넷 (CTO 가 고르지 않았다)

```
⒜ WU-002 의 STOP 을 유지한다  → Extension 트랙 폐기 · §4 의 사람 수집 6회로 전환
⒝ WU-002 를 «명시적으로 뒤집는다» → 🔴 그러려면 셀러 계정 제재 위험(Google ToS 계정
   삭제 · CWS §7.2 원격 제거)을 **사업 결정으로 수용** 한다는 기록이 필요하다.
   🔴 이것은 CPO 범위를 넘는 **CEO 사업 결정** 으로 보인다(헌장 §3 의 「채널 개폐」와 같은 급).
⒞ 유료 API 로 간다 → 🔴 WU-006R 의 「외부 AI/검색 API 전면 STOP」을 뒤집는 결정이다
⒟ AI Search 축을 접고 Shopify Suggest 단독으로 간다 → 🟢 baseline 은 이미 있다
```

🔴 **CTO 는 넷 중 아무것도 실행하지 않았다.**

---

## 6. WU-020 완료 Gate 대조 — 🔴 **미완료**

```
Extension → AI Web UI → rawAnswer → candidate URLs → crawler → MI → independent GT
   🔴 STOP      🔴 0        🔴 0          ⚪ 대기        🟢 준비   🟢 준비   🟢 준비
```
🔴 **「최소 하나의 실제 측정 케이스 통과」를 달성하지 못했다.** 그러므로 §19 의
①~⑪ 중 ③④⑤⑥⑦⑧⑨⑩⑪ 은 **측정불가** 이고 **0 으로 적지 않는다.**

🟢 §19 ⑫ Category/Sourcing 영향 = **없다**(이번 WU 에서 손대지 않았다 · WU-019G 판정 유지).

---

## 7. 변경 없음 확인

```
Extension 0 · manifest 0 · 운영 코드 0 · MI 0 · threshold 0 · color dictionary 0 ·
PRESUMED_SAME 정책 0 · production Discovery 0 · Category/Sourcing 0 · schema 0 ·
등록 payload 0 · Registry 0 · 브라우저 자동화 실행 0 · AI 웹 UI 접속 0 · HTTP 0 · ₩0
산출물 = 이 문서 **1파일**
```
