# WU-019A-SEARCH-ALT-2 — 합법적 Non-API Discovery 경로 **Gate 조사**

🔴 구현 **0** · 검색 실행 **0** · DDG 재시도 **0** · AI API 0 · 키 생성 0 · 비용 **₩0** ·
운영 코드 변경 0 · commit(코드) 0 · deploy 0. 🟡 공식 문서 GET 몇 건만 썼다.
🔴 기준점 `cf225a40` · main ahead 27 · KPI 3층 규격(`rawSearchUrl`/`canonicalUrl`/`identityKey`) 불변.

---

## 1. 🔴 Ollama 를 먼저 가른다 — **두 개를 한 이름으로 부르면 안 된다**

```
⒜ Ollama **로컬 모델 실행**      🟢 키 0 · 계정 0 · 비용 0 · 로컬
⒝ Ollama **web search API**     🔴 **REST API + API 키 필수**
```
공식 블로그(`ollama.com/blog/web-search` · 2025-09-24) 원문 판독:
> "A new web search API is now available in Ollama." ·
> "**Create an API key from your Ollama account**" ·
> `curl https://ollama.com/api/web_search --header "Authorization: Bearer $OLLAMA_API_KEY"` ·
> "generous **free tier** … higher rate limits … via Ollama's **cloud**"

🔴 그러므로 ⒝는 **외부 검색 API + 키 발급 + 계정** 이고 지시서 §5 의 「API key 생성 ❌」에
그대로 걸린다. **free tier 라도 STOP** 이다(비용이 아니라 **구조** 가 금지 사유다).

🔴🔴 그리고 가장 중요한 사실 — **Ollama 는 검색엔진이 아니다.** ⒜만 쓰면 **웹 검색 능력이 0**
이고, 검색 source 는 **여전히 따로 필요하다.** 즉 Gate 의 병목은 Ollama 가 아니라 **source** 다.

### 구조 셋 (지시서 §6)
| | 구조 | 판정 |
|---|---|---|
| Case A | Ollama = **Query 생성** · Search = 외부 | 🟡 기술상 가능 · 🔴 **증분 가치 미확인** — 우리 Query owner 는 이미 `buildPrimaryQuery` 이고 규격이 그것을 재사용하도록 고정돼 있다. 바꾸면 「검색엔진 차이만 비교」가 깨진다 |
| Case B | Ollama = **결과 분석** · Search = 외부 | 🟡 가능 · 🔴 그러나 분석은 MI 의 일이다(AI 주장은 증거 아님 원칙). **중복 계층** |
| Case C | Ollama = 로컬 LLM · **search connector 별도** | 🔴 connector 가 ⒝(키) 또는 아래 source 중 하나로 **환원** 된다 — 새 경로가 아니다 |

🟢 결론: **Ollama 는 Gate 를 통과시키지 못한다** — 그것이 더하는 것은 LLM 이고, 막혀 있는 것은 **검색 source** 다.

---

## 2. Source 별 Gate 표

🟢 아래 ●표시는 **헌장/메모에 이미 닫힌 결론 인용** 이다(재조사 0 · 지시서 「재감사 금지」 준수).

| 항목 | Ollama web search | DuckDuckGo | Brave ● | Google/Bing ● | SearXNG ● | Mojeek ● | Marginalia ● | Common Crawl ● | 소매처 직접 ● |
|---|---|---|---|---|---|---|---|---|---|
| API 필요 | **YES** | NO | NO(API 별도) | NO | NO | YES(유료) | NO | NO | NO |
| 외부 **AI** API | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| Consumer AI UI 자동화 | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| 로그인/계정 | **YES** | NO | NO | NO | NO | YES | NO | NO | NO |
| 브라우저 자동화 | NO | NO | NO | NO | NO | NO | NO | NO | NO |
| robots 허용 | — | **YES**(`html.`/`lite.` = `Allow: /`) | **NO**(`Disallow: /search`) | NO | 상속 | — | — | YES | YES |
| ToS 자동접근 허용 근거 | **NO**(키 전제) | **UNKNOWN**(금지 문구 미발견) | NO | **NO**(명시 금지) | 상속 | YES(유료) | **NO**(CC-BY-NC-SA 비상업) | UNKNOWN | **UNKNOWN**(crawlable 명시 ≠ 저장 허용) |
| 결과 자동 추출 허용 근거 | NO | **UNKNOWN** | NO | NO | 상속 | YES | NO | UNKNOWN | UNKNOWN |
| CAPTCHA/Anomaly 위험 | LOW | **HIGH**(실측 4/6 `202`) | — | HIGH | HIGH | LOW | LOW | LOW | LOW |
| 상품 URL 추출 가능 | YES | **YES**(실측) | — | — | — | YES | UNKNOWN | **NO**(1~1.5개월 지연) | YES |
| 기존 crawler 연결 | YES | **YES**(실측) | — | — | — | YES | — | — | YES |
| 비용 | free tier(키) | ₩0 | — | — | ₩0 | **£3 CPM** | ₩0 | ₩0 | **₩0** |
| **§12 적합** | 🔴 **STOP** | 🟡 **측정완료·재시도 STOP** | 🔴 STOP | 🔴 STOP | 🔴 STOP | 🔴 STOP(유료) | 🔴 STOP(비상업) | 🟡 보조만 | 🟡 **정책 결정** |

🔴 **`UNKNOWN` 을 `YES` 로 읽지 않았다.** DDG 의 「금지 문구 미발견」도 `UNKNOWN` 이다.

---

## 3. GO 후보 — 🔴 **조건 ⑧까지 모두 만족하는 것은 없다**

```
Ollama web search  🔴 ①⑦ 위반(키·계정)
DDG                🟡 ⑧ 위반 — 차단이 실측됐다(4/6 `202 + anomaly`). 재시도는 회피다
Brave/Google/Bing  🔴 ④ 위반(robots/ToS 명시 금지)
SearXNG            🔴 ④ 위반(상위 엔진 약관 상속)
Mojeek             🔴 ⑦ 위반(£3 CPM)
Marginalia         🔴 ④ 위반(비상업 라이선스)
Common Crawl       🔴 ⑤ 부분 — 색인 1~1.5개월 지연이라 **가격·재고 축 불가**(보조만)
소매처 직접         🟡 ①②③⑤⑥⑦⑧ 통과 · 🔴 **④가 UNKNOWN**(「crawlable」 명시는 있고
                   **저장 허용 명시는 없다**) + 🔴🔴 커버리지 상한 = **Registry 크기** →
                   §12-0 「Registry 확대 금지」와 **정면으로 만난다** → **CPO 정책 결정**
```

🔴 즉 **이번 Gate 의 답은 「GO 후보 NONE, 단 하나가 CPO 결정 대기」** 다.

---

## 4. 이번 조사가 더한 것 (새 사실 2건)

```
🟢 ① Ollama web search 는 **키가 필수인 외부 API** 다 — 「로컬이라 공짜」가 아니다.
     그리고 Ollama 로컬 모델은 **웹 검색 능력이 0** 이다(둘을 한 이름으로 부르면 틀린다).
🟢 ② Ollama 를 Query 생성/결과 분석에 끼우는 구조(Case A/B)는 **우리 규격과 충돌** 한다 —
     Query owner 는 `buildPrimaryQuery` 로 고정돼 있고(「검색엔진 차이만 비교」),
     결과 분석은 MI 의 일이다(AI 주장은 증거가 아니다).
```

## 5. 변경 / 비용 / KPI
```
code 0 · commit(코드) 0 · deploy 0 · 이 문서 1개만 추가
API ₩0 · Search ₩0 · AI ₩0 · **총 ₩0**
KPI 영향 **없음** — 3층 규격·GT 독립·known-positive discovery rate 전부 불변
```
🔴 **CEO Action: NONE.**
