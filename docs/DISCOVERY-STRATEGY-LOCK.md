# DISCOVERY STRATEGY LOCK

> 🔴🔴🔴 **이 문서는 「인수인계 필수 산출물」이다.** Discovery 관련 작업을 시작하는
> 모든 새 세션/새 페이지는 **이 문서를 먼저** 기준으로 삼는다.
> 🔴 **CPO 가 명시적으로 바꾸기 전까지 §LOCK 은 변경하지 않는다.**
> 🟢 진입점은 여전히 `docs/START-HERE.md` 하나이고, 이 문서는 **그 안에서 Discovery 축만** 고정한다.

---

## FINAL PRODUCT FLOW

```
상품 URL
→ Query Planner
→ 자동 Search
→ Candidate URLs
→ Crawl
→ Evidence
→ Identity
→ 국내 참고가격
→ 해외 최저 소싱가
→ MI
→ 판매판단
→ 등록
```

---

## NON-NEGOTIABLE

```
사용자는 Discovery 과정에 개입하지 않는다.

사용자 브라우저 실행은 최종 제품 구조가 아니다.
비용 제약 하에서의 임시 실행/검증 수단일 뿐이다.

국내 Registry는 가격 참고 자산이다.
장기 Discovery 엔진이 아니다.

특정 쇼핑몰 목록 확대는 Discovery 전략이 아니다.

Gemini 및 유료 Search API는 별도 비용/정책 결정 없이는 활성화하지 않는다.
```

---

## CURRENT STATE (2026-10-27 · 코드 실측)

| 단계 | 상태 | 실제 위치 |
|---|---|---|
| **Query Planner** | 🟢 **구현됨 · 동작함**(순수 · HTTP 0) · 🟡 운영 배선은 **QA 표시용 1곳** | `packages/crawler/src/discovery-core/query-planner.ts` `buildDiscoveryQuerySet` |
| **Search Execution** | 🔴🔴 **없다 — 이것이 유일한 blocker** | 서버측 검색 실행자 **0건**(전수 grep) |
| **Candidate URL** | 🟢 구현됨 — 입력만 주면 동작 | `url-candidate-pool.ts` `collectUrlCandidatePool` · 입력 경계 `candidateUrls` |
| **Crawl** | 🟢 | `product-url-facts.ts` `factsFromProductUrl` |
| **Evidence** | 🟢 | `product-evidence.ts` · `evidence-explain.ts` · `visual-signature.util.ts` |
| **Identity** | 🟢 | `cross-seller.ts` → `match-truth.ts` → `priceTierFromLink` (**MATCHING-3.1**) |
| **Domestic Price** | 🟢 | `domestic_price_sources` → `domestic_product_links` → `domesticCompetition` |
| **Overseas Sourcing** | 🟢 | `overseas-auto-pool.ts` → `candidateOverseasPrice` |
| **MI** | 🟢 | `computeMarketIntelligence` → `sellerFacingVerdict` · `recommendation` |

### 🔴 현재 실제로 도는 후보 생산자 6개

| # | Producer | 입력 | 운영 | 전략 판정 |
|---|---|---|---|---|
| ① | `__gemini_discovery__` | Gemini API | 🔴 flag **OFF** | ALIGNED(비용 미승인) |
| ② | `__url_candidates__` | `candidateUrls` | 🟢 | ALIGNED(수신단) |
| ③ | `__overseas_auto__` | `comparison_shops` | 🟢 | LEGACY/FALLBACK |
| ④ | `__reviewed_same__` | 과거 human SAME | 🟢 | ALIGNED(재사용) |
| ⑤ | `__domestic_listing__` | **등록부 seed** + 1-hop | 🟢 | 🔴 **CONFLICT** |
| ⑥ | (비-transient) | **등록부 34** | 🟢 | LEGACY/FALLBACK |

---

## CURRENT BLOCKER

```
DISCOVERY AUTO SEARCH = BLOCKED
위치 = B (Search Execution)
```

🔴 **A(Query Planner)와 C~I 는 전부 정상이다.** 막힌 칸은 **B 하나** 다.

### 🔴 검토한 실행수단 전수(실측 근거 포함)

| 수단 | 상태 | 근거 |
|---|---|---|
| 서버측 검색 API(Google/Bing/Brave/Exa/Serp 등) | 🔴 **미도입** | 운영 코드 호출부 **0건**(전수 grep) |
| Gemini Grounded Search | 🔴 **402 — 선불 크레딧 0** | 2026-10-27 재실측 · grounding 없는 1토큰 호출도 **402** · 과금 0 |
| DuckDuckGo HTML 서버 파싱 | 🔴 **불가** | `html.duckduckgo.com` 이 **Origin 헤더를 보내면 403**(실측 · `supplied-url-handoff.ts`) |
| 소매처 직접(suggest.json · sitemap) | 🔴 **전략 불가** | 커버리지 상한 = Registry 크기 · WU-007 증분 **0/6** |
| 사용자 브라우저(북마크릿) | 🟡 **동작하지만 최종 구조 아님** | `SmartSearchBookmarklet.tsx` · `pipeline/page.tsx:1291` |

🔴 **「CTO 의 WebSearch 도구로 됐다」를 근거로 쓰지 않는다** — 그것은 개발자 도구이고
**배포된 서비스가 쓸 수 있는 capability 가 아니다**(과거 WU-116 의 `cto-websearch` 표기 주의).

---

## NEXT ACTION

```
🔵 **Search Provider 단독 의사결정** — CPO/CEO 영역이고 CTO 가 고르지 않는다.
   선택지는 셋이고 전부 비용/정책 결정이다:
   ⒜ Gemini Grounded Search 활성화   (🔴 선불 크레딧 필요 · 402 실측 · 월 5,000 무료 구간 기록 있으나
                                        크레딧 없이는 호출 자체가 안 된다)
   ⒝ 유료 Search API 도입            (🔴 약관상 「결과로 DB 구축」 금지 조항 확인 필요 · WU-005R)
   ⒞ 제3의 실행수단                   (현재 저장소에 후보 **없음**)

🔴 그 결정이 내려지기 «전» 에는 다음을 하지 않는다 —
   ❌ 국내 Registry 확대로 문제를 덮는다
   ❌ 사용자에게 후보 URL 을 넣게 하는 것을 최종 UX 로 확정한다
   ❌ 임의 Search Provider 를 고른다
```

---

## DO NOT CHANGE

```
❌ 국내 쇼핑몰 추가 · Registry 확대 · 카테고리 Adapter 추가
❌ Registry 기반 Discovery Recall 개선 · Registry 수를 KPI 로 삼기
❌ Gemini 임의 활성화 · 유료 Search API 임의 도입
❌ Identity / MATCHING-3.1 / Evidence / Image Evidence
❌ 국내 참고가격 · 해외 최저 소싱가 · A/B 가격 정책
❌ MI · 판매판단 · READY/LIMITED/HOLD
❌ 기존 pipeline 재작성 · 새 Discovery ranking 엔진
❌ Discovery 문제 때문에 Identity/MI 를 수정하는 것
```

---

## 🔴 과거에 이 전략을 잃어버린 지점(재발 방지용 기록)

```
확인된 원인 = C + D (부분적으로 E)
  C 기존 코드 구조가 유도했다 — 채택 전략 둘(Query Planner · Gemini)이 **실행 불가** 였고,
    실제로 도는 공급원이 **등록부뿐** 이라 「국내 후보 0」을 고치려는 WU 가 전부 그쪽으로 수렴했다
  D 이전 측정이 **등록부를 분모로** 삼았고(WU-114~116 · 130 · 147), 그 분모가 다음 WU 의 출발점이 됐다
  E START-HERE §0 에 **Discovery 전략 줄이 없었다**(CURRENT WU/NEXT/CEO/CLOSED/Git/회귀 6줄뿐)
🟢 그래서 이 문서를 만들었다 — §0 이 회전해도 **이 파일은 남는다**.
```

---

## 작업지시서 필수 5항 (이것이 없는 지시서는 인수인계용으로 인정하지 않는다)

```
① Strategy Lock   최종 제품이 무엇인지      ← 이 문서 §FINAL PRODUCT FLOW
② Current State   현재 어디까지 되어 있는지  ← 이 문서 §CURRENT STATE
③ Non-goals       무엇을 하면 안 되는지      ← 이 문서 §DO NOT CHANGE
④ Current Sprint  이번에 무엇을 하는지
⑤ Next Action     완료 후 무엇을 하는지      ← 이 문서 §NEXT ACTION
```

---

## 부록 — `DISCOVERY-SEARCH-PROVIDER-01` PHASE 1 (2026-10-27)

🔴🔴 **Gemini 를 채택한 것이 아니다** — Search Provider **후보 실험** 이고 전략 LOCK 은 불변이다.

```
결과  🔴 **PHASE 1 측정불가** — 실제 상품 3건 전부 **HTTP 402**(과금 0)
원인  선불 크레딧 **$0**. 🔴 grounding 없는 **1토큰** 호출도 402 다
      ⟹ **월 5,000 무료 구간도 크레딧이 있어야 도달한다**(무료 ≠ 크레딧 없이 가능)
```

🟢 **돈을 쓰기 전에 잠가 둔 것**(`search-cost-ledger.ts` · 계약 11):

```
🔴🔴 상한을 «호출 수» 가 아니라 **«검색 쿼리 수»** 로 건다
   — 공식 문서와 이 저장소 실측이 같다: **1 API 호출이 내부에서 여러 검색 쿼리를 만들고
     그 각각이 과금된다**(실측 호출 1회 → 6쿼리 · 평균 5.5). 과거 ₩21,700 의 구조적 원인.
① 상품당 호출 1 · 우리 쿼리 1       ② 출력은 **URL 배열만**(판단·가격·설명 금지)
③ 호출 **«전»** 예산 게이트(예상 6쿼리를 **보수적으로** 가정 — 1 로 가정하면 상한이 뚫린다)
④ URL 상한 절단  ⑤ 원장 1행/호출(쿼리수·검색어 원문·토큰·URL수·추정비용)
🔴 추정 비용은 **추정** 이다 — ground truth 는 Billing 이다
```

🔵 **다음 — CEO 비용 결정 하나.** 크레딧이 들어오면 `CORE_SEARCH_PROVIDER_LIVE=1` 로
PHASE 1 이 **그대로 실행**된다(코드 작업 0). 예상 규모: 상품 10개 × 약 6쿼리 ≈ **60 쿼리**
⟹ 월 5,000 무료 구간 안이라 **추가 과금 $0** 으로 측정이 끝난다(🔴 크레딧 활성화는 별개).

---

## 부록 — `DISCOVERY-SEARCH-PROVIDER-01` Apify PoC (2026-10-27)

🔴🔴 **Apify 를 채택한 것이 아니다** — B(Search Execution) **하나만** 검증했다. 운영 배선 **0**.

```
계정   Apify FREE · 월 **$5** 크레딧 · isPaying false
Actor  `apify/google-search-scraper` · PAY_PER_EVENT
과금   `search-page-scraped` = **$0.0045 / 검색결과 페이지**(FREE 티어)
       🟢 **과금 단위가 «우리가 통제하는 값» 이다** — Gemini 는 1 호출이 내부에서
          검색 쿼리를 여러 개 만들었다(실측 평균 5.5). 그 불확실성이 여기엔 없다
       ⟹ 월 $5 ÷ $0.0045 ≈ **약 1,111 검색/월 무료**
```

### 🟢 B 는 «열린다» — 검색 실행 자체는 성공

```
Query  [BRAND_CODE] "Bobo Choses" "B226AC010"   ← 기존 Query Planner 1순위 그대로
호출   1회 · HTTP **201** · **26,066 ms** · organic **7** · 고유 7 · 중복 **0**
```

### 🔴 그런데 기존 Candidate URL 계약을 **0/6** 으로 통과한다

| 축 | 결과 |
|---|---|
| ① 현재 운영 경로 `factsFromProductUrl` | 🔴 **0/6** — 전건 `NOT_PRODUCT_URL` |
| ② 반사실(분류기 우회 · HTTP 직접) | 🟡 **1/6** 만 JSON-LD `Product` 보유 |

🔴🔴 **두 숫자를 하나로 적지 않는다** — ①은 **우리 분류기**가 막은 것이고 ②는 **공급 품질**이다.

```
원인 1  `classifyUrlShape` **부분문자열 과매치** — `LISTING_PATH` 의 `shop` 이
        **`shopping` 안에서 매치**된다 ⟹ farfetch 상품 상세 6건이 LISTING_PAGE
        🔴 **WU-073 이 「양방향 오류」로 이미 기록** 했고 **WU-052 가 HOLD** 한 자리다
原因 2  `/p/` 상세 경로를 PRODUCT_PAGE 로 읽지 않는다 ⟹ answear.ro 가 UNKNOWN_PAGE
        🔴 그 URL 에는 **우리 품번 `b226ac010` 이 그대로 있다**(진짜 동일상품 후보였다)
원인 3  farfetch 는 HTTP 200 인데 **JSON-LD Product 가 없다**(JS 렌더/보호)
        ⟹ 🔴 분류기를 고쳐도 그 6건은 **PLAIN_HTML 경로로는 못 읽는다**
```

🔴 **CTO 가 분류기를 고치지 않았다** — WU-052 HOLD 이고 이번 지시의 금지축이다.
🟢 대신 **현재 동작을 계약 3건으로 고정** 했다 — 고치면 FAIL 하고 **그것이 수정의 증거** 다.

### 🔴 표본 한계

```
상품 **1개** · Query **1개** · 검색 **1회** · organic **7**
그중 6건이 **farfetch 로케일 중복**(상품 2종) ⟹ 실질 판매처 **2곳**
🔴 「Apify 의 Recall 이 낮다」로 **일반화하지 않는다** — 질의가 따옴표 2개로 매우 좁았다
```

### 판정

```
APIFY SEARCH EXECUTION = PASS   (B 는 실행된다 · 비용 단위가 명확하고 통제 가능하다)
APIFY AS SEARCH PROVIDER = HOLD (SPRINT-02 에서 0/6 → **1/6** · 아래 부록)
DISCOVERY CORE = HOLD           (blocker 가 B → **C 의 URL 분류기** 로 «이동» 했다)
```

🔵 **CPO 결정 필요 3**:
① `classifyUrlShape` 과매치 수정을 **열 것인가**(WU-052 HOLD 해제 · 이 PoC 가 새 증거다)
② farfetch 류 **JS 렌더 사이트**를 공급원으로 볼 것인가(현재 PLAIN_HTML 로는 못 읽는다)
③ Query Planner 질의 **폭**(따옴표 2개 → 결과 7건) — 넓힐지 여부

---

## 부록 — `DISCOVERY-SEARCH-PROVIDER-02` URL 분류 정확성 복구 (2026-10-27)

🔴 **Apify 를 위한 새 기능이 아니다** — 기존 Candidate URL 계약의 **거짓 음성 제거** 다.

### Before → After (동일 Apify 결과 · 분모 유지)

| | Before | After |
|---|---:|---:|
| PRODUCT_PAGE | **0/6** | 🟢 **1/6** |
| LISTING_PAGE | 5/6 | **0/6** |
| UNKNOWN_PAGE | 1/6 | 5/6 |
| `factsFromProductUrl` 성공 | **0/6** | 🟢 **1/6** |

🟢🟢 **①(우리 분류기)이 ②(공급 품질)를 따라잡았다** — 둘 다 **1/6** 이다.
⟹ 🔴 **이제 분류기는 병목이 아니다.** 남은 한계는 **farfetch 의 JSON-LD 부재**(JS 렌더)다.

### 고친 것 — 두 줄

```
① `LISTING_PATH` 끝 `\/?`(선택) → **`(?:\/|$)`(세그먼트 경계)**
   🔴🔴 **보고보다 결함이 넓었다** — `c` 토큰 때문에 **「c 로 시작하는 모든 세그먼트」**
      가 목록이었다(`/clothing/…` · `/cart/…` · `/contact`). Apify 와 **무관한 전역 결함**.
   🟢 토큰 목록은 **한 글자도 안 바꿨다** ⟹ 진짜 목록 판정 불변(M2 전수 계약)
② `PRODUCT_PATH` 에 **`p` 하나** 추가 — 뒤의 `\/[^/]+` 가 슬러그를 요구하므로
   `/p` · `/p/` 는 상품이 아니고 `NON_PRODUCT_FILE` 이 먼저 돌아 `/p/index.html` 도 걸린다
```

### 🟢 독립 코퍼스(AI URL **181**) 교차검증 — 탈락 **91 → 89**

```
🟢 UNKNOWN → PRODUCT  answear.com/p/…-**b226ac117**-…   ← 우리 품번이 URL 에 있다
🟢 UNKNOWN → PRODUCT  babyshop.com/…-turtledove `/p/` 340481
🟡 LISTING → UNKNOWN  m.gsshop.com/section/`brandSect`/263304
   (`brand` ⊂ `brandSect` · 🟢 **행동 변화 0** — `toCrawlerUrl` 은 PRODUCT_PAGE 아닌 것을 전부 버린다)
⟹ 🟢 **진짜 상품 2건 회수 · 행동상 손실 0**
```

### 🔴 남은 세 번째 결함 — **고치지 않았다**(CPO 판정 대기)

```
farfetch 5건이 **UNKNOWN_PAGE** 에 머문다 — `PRODUCT_SUFFIX` 가 **`.html` 만** 본다(**`.aspx`** 미지원)
🔴 넣지 않은 이유 ⒜ `NON_PRODUCT_FILE` 도 같이 넓혀야 하고 그러면 `about.aspx` 가 상품이 된다
                 ⒝ 근거가 **N=1 사이트** 이고 🔴 그 사이트는 **JSON-LD Product 가 없다**(0/6)
                    ⟹ PRODUCT_PAGE 가 돼도 Evidence 가 안 나온다
```

### 🔴 URL 분류 ≠ HTML 렌더 ≠ Evidence — 갈라서 적는다

| farfetch | 결과 |
|---|---|
| URL classification | 🟡 UNKNOWN_PAGE (`.aspx` 미지원) |
| Crawl(HTTP) | 🟢 **200** |
| Evidence | 🔴 **JSON-LD Product 없음**(JS 렌더) ⟹ PLAIN_HTML 로는 **못 읽는다** |

🔴 **억지로 성공 처리하지 않았다.** Farfetch JS 렌더는 이번 범위가 아니다.

---

## 부록 — `DISCOVERY-SEARCH-PROVIDER-03` Query 폭 × Search Recall (2026-10-27)

🔴 **운영 Query Planner 를 바꾸지 않았다**(CPO §13). Q1 은 Planner 산출 **그대로**,
Q2/Q3 는 **하니스 안에서만** 만들었다(따옴표 제거 · Planner 의 `BRAND_DESIGN` 축 재사용 ·
**새 의미 추론 0**). 운영 코드 변경 **0**.

### 🔴🔴 먼저 — **같은 질의를 두 번 돌렸더니 숫자가 달랐다**

```
             Q1 판매처   Q2 판매처   Q3 판매처   dedupe 판매처 / 상품URL
실행 A           11          10          15          28 / 56
실행 B            4          11          14          22 / 59
🔴 Google 검색 결과는 **시점·개인화로 변한다** ⟹ **한 번의 숫자를 확정값으로 쓰지 않는다**
🟢 그래도 **두 실행에서 같은 방향** 이 나왔다 — 아래가 그 «재현된» 부분이다
```

### 🟢 재현된 결론 — **병목은 Apify 가 아니라 «우리 질의» 였다**

```
Q1 `"BRAND" "CODE"`(현재 운영)   🔴 **가장 약하다**
   · S3(B126AI018)는 **두 실행 모두 organic 0** — 따옴표 완전일치가 결과를 0 으로 만든다
   · 판매처 실행 A 11 / B 4 — **변동이 가장 크다**
Q2 `BRAND CODE`(따옴표만 제거)    🟢 판매처 10 / 11 · 상품URL 19 / 25
Q3 `+ 디자인명`                   🟢 판매처 **15 / 14** — 두 실행 모두 **가장 넓다**
⟹ 🟢 따옴표 하나를 떼는 것만으로 판매처가 **배 이상** 늘었다(S3 는 0 → 3·7)
```

### 🟢🟢 Crawl / Evidence — 🔴 Search 와 «갈라서» 적는다

```
중복 제거 상품URL **59** → Crawl OK **50/59(84.7%)** · Evidence **49/59(83.1%)**
🟢 1차 PoC 의 1/6 에서 **크게 올라갔다** — 이유 둘:
   ⒜ SPRINT-02 의 URL 분류 수정 ⒝ Q2/Q3 가 **JSON-LD 를 주는 리테일러** 를 더 데려왔다
🔴 실패 9건은 **Search 실패가 아니다** — `cettire`(UNREACHABLE) ·
   `editorialist`(NO_FACTS) 류의 **Crawl/Evidence 제한** 이다
```

### 💵 비용 — 실측 단가 × 실측 횟수

```
검색 **12회**(상품 4 × Query 3) · 추정 **$0.0540** · 상품당 **$0.0135**
🔴 추정치다 — 실제 청구는 Apify Billing 이 ground truth 다
🟢 월 $5 FREE 크레딧 기준 ≈ **370 상품/월**(Query 3개 유지 시)
```

### 판정

```
APIFY SEARCH PROVIDER = 🟢 PASS — 운영 채택 «후보» 로 승격
🔴 단 조건 둘 — ⒜ **Q1 단독은 쓰지 않는다**(0 결과가 실재한다)
                ⒝ 검색 결과가 **비결정적** 이므로 Recall 을 단일 측정으로 확정하지 않는다
DISCOVERY CORE = 🟡 HOLD — 운영 배선은 **CPO 결정** 이다(이번에 하지 않았다)
```

🔵 **CPO 결정 필요** — Q1 유지 / Q2 채택 / Q3 채택 / Query Set 다중 실행(비용 ×N) 중 하나.
🔴 CTO 는 고르지 않았다. 🔴 `.aspx` 는 **HOLD 유지**(이번에 건드리지 않았다).

---

## 🔵🔵🔵 CPO 결정 — **Query 전략 확정**(2026-10-27 · SPRINT-03 결과 기준)

🔴 **이 결정은 세션이 바뀌어도 유지된다.** 다시 묻지 않는다.

| 항목 | 판정 |
|---|---|
| Apify Search 실행 | 🟢 **PASS** |
| `Q1 "BRAND" "CODE"` 단독 | 🔴 **폐기** |
| `Q2 BRAND CODE` | 🟢 **채택** |
| `Q3 BRAND CODE + 디자인명` | 🟢 **채택** |
| 채택 형태 | 🟢 **Q2 + Q3 병행**(상품당 Search **2회**) |
| Search 결과 비결정성 | ⚠️ **운영상 인정** — 단일 측정으로 Recall 확정 금지 |
| `.aspx` | 🟡 HOLD |
| Discovery 운영 배선 | 🟡 **HOLD** — 별도 작업(SPRINT-04) |

```
🔴 **이번 결과로 Discovery Core 를 PASS 시키지 않는다.**
   입증된 것은 **「Search Provider 가 채택 가능한 수준」** 까지다.
```

### 운영 배선 전에 고정할 계약 10(CPO)

```
① 상품당 Search **2회**        ② **Q1 사용 금지**        ③ Q2/Q3 결과 합산
④ URL dedupe                   ⑤ 기존 `classifyUrlShape` 적용
⑥ Crawl/Evidence 는 기존 파이프라인 그대로
⑦ 🔴 Search 결과 자체를 **SAME 판정에 직접 사용하지 않는다**
⑧ `.aspx` 수정 금지            ⑨ 국내 Registry 를 Discovery 엔진으로 확대 금지
⑩ Apify 비용은 **실제 Billing 기준으로 추후 검증**
```

### 🔴🔴 SPRINT-04 착수 전 알아야 할 «범위 사실»(CTO 실측 2026-10-27)

```
🔴 **Q2 · Q3 는 현재 Query Planner 에 «존재하지 않는 축» 이다.**
   `query-planner.ts:124-132` — **8개 축 전부가 `quote()` 로 감싼다**.
   ⟹ Q2(`BRAND CODE` 따옴표 없음)는 내가 하니스에서 **따옴표를 떼어** 만든 것이고,
      Q3(`BRAND CODE DESIGN`)도 축이 없다(`BRAND_DESIGN` 은 **품번이 빠진** `"brand" "design"`).
⟹ 🔴 SPRINT-04 는 「기존 축 2개를 고르는 일」이 **아니다** —
   **Planner 가 무따옴표 축 2개를 새로 내도록** 하는 **운영 변경** 이다.
🔴 그리고 기존 계약이 그 자리를 잠그고 있다 —
   `core-1-query-planner.test.ts:137` 가 **`qs[0].axis === "BRAND_CODE"`**(= Q1 이 1순위)를
   단언한다. Q1 을 폐기하면 **그 계약이 FAIL 하고 그것이 의도된 변경의 증거** 다.
```

🔵 **다음 작업** = `DISCOVERY-SEARCH-PROVIDER-04 — Q2+Q3 운영 배선`(CPO 지시 대기).

---

## 부록 — `DISCOVERY-SEARCH-PROVIDER-04` Q2 vs Q3 단일 Query (2026-10-27)

🔴 **운영 배선 0 · Query Planner 운영 코드 0**(`qs[0] === BRAND_CODE` 계약도 그대로).
질의는 하니스 안에서만 만들었고 **Q3 에서 MODEL_CODE 를 빼지 않았다**(CPO §3).

### 측정(Search **8회** · 상품 4 × Query 2 · 추정 $0.0360)

| 상품 | Q | organic | unique | 상품URL | 판매처 | Crawl | Evid | 품번관측 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| S1 | Q2 | 10 | 10 | 5 | 3 | 4 | 4 | 2 |
| S1 | Q3 | 9 | 9 | 5 | 4 | 3 | 3 | 1 |
| S2 | Q2 | 9 | 9 | 9 | **1** | 9 | 9 | 0 |
| S2 | Q3 | 9 | 9 | 6 | 6 | 3 | 3 | 1 |
| S4 | Q2 | 9 | 9 | 4 | 4 | 3 | 3 | 0 |
| S4 | Q3 | 9 | 9 | 2 | 2 | 2 | 2 | 0 |
| S3 | Q2 | 9 | 9 | 3 | 2 | 3 | 3 | 0 |
| S3 | Q3 | 9 | 9 | 5 | 4 | 3 | 3 | 0 |

```
Q2  상품URL 20 · 판매처  9 · Crawl 18 · Evidence 18 · 로케일중복 **11** · 비상품 16
Q3  상품URL 18 · 판매처 **12** · Crawl 11 · Evidence 11 · 로케일중복  **2** · 비상품 18
🟢 **둘 다 상품URL 0 인 상품이 없다** — Q1 의 치명적 약점(S3 organic 0)이 양쪽에서 해소됐다
```

### 🔴🔴 측정하지 않은 «결정적» 지표 — 그래서 승자를 선언하지 않는다

```
CPO §9 의 1순위는 「실제 판매처 상품 후보」인데, 내가 집계한 것은
**URL 단위 Crawl/Evidence 개수** 다 ⟹ 🔴 **로케일 중복이 많은 Query 가 유리해진다**.
실증 — S2/Q2 는 상품URL **9 가 판매처 «1곳»**(bobochoses 로케일)이고,
      그 9 가 Q2 의 Crawl 18 · Evidence 18 을 **혼자 절반 가까이** 만들었다.
⟹ 🔴 필요한 숫자는 **「Evidence 를 내는 서로 다른 판매처 수」** 이고 **이번에 재지 않았다**.
🟡 가진 값으로 경계만 지으면 — Q2 ≤ 9곳 · Q3 ≈ 10~11곳(로케일중복이 2뿐) ⟹ **Q3 우세 «추정»**.
🔴 추정을 측정으로 적지 않는다.
```

🟢 **하니스에 그 지표를 추가했다**(`Evidence 를 내는 판매처 N곳`) — 🔴 그러나 **재실행하지
않았다**: CPO §6/§17 이 **8회 초과 시 STOP** 을 지시한다. 재측정은 **8회 추가 · 약 $0.036** 다.

### 판정

```
Q2 강점  로케일 포함 Crawl/Evidence 총량이 크다 · 질의가 가장 단순하다
Q2 약점  🔴 **판매처 다양성이 낮다**(로케일중복 11) — 같은 샵 페이지를 여러 번 받는다
Q3 강점  🟢 **판매처 다양성 12** · 로케일중복 **2** · 새 리테일러를 데려온다
Q3 약점  Crawl/Evidence «개수» 가 낮다(11) — 단 그 분모가 다양한 샵이라 성질이 다르다
⟹ 🟡 **둘 다 불충분이 아니다. 그러나 단일 승자를 이 데이터로 확정할 수 없다.**
🔴 품번 관측이 **양쪽 2** 로 낮다 — 검색이 데려온 것이 「그 브랜드」이지 「그 품번」이
   아닐 수 있다. 🔴 단 동일상품 판정은 MI 의 일이라 여기서 판단하지 않았다.
```

**🔴 STOP — Search 상한 도달. 재측정(8회 · $0.036) 승인 여부는 CPO 결정.**

---

## 부록 — `SEARCH-PROVIDER-04` QA 육안 검증 화면 (2026-10-27)

🔴🔴 **재검색 0 · 추가 과금 0.** Apify 가 **서버에 보관한 run 8건** 을 그대로 받아
`search-provider-04-raw.json`(결과 **73건**)으로 고정했다. 🔴 CTO 가 URL 을 지어내지 않았다.

```
🔴 내가 8회 결과의 raw URL 을 **저장하지 않았다**(집계만 출력했다) — 그대로였다면
   재검색이 필요했을 것이다. 🟢 Apify 보관본으로 **무과금 복구** 했고, 이제 fixture 가
   있으므로 **앞으로 영원히 재검색이 필요 없다**.
```

🟢 화면 `/qa/search` — 상품 4개 × (Q2 | Q3) **나란히** · 원본 URL **클릭 가능** ·
제목 · 도메인 · 기존 `classifyUrlShape` 의 「상품상세」 표시 · 「품번 보임」(**관측**) ·
「같은 판매처 반복」(로케일 중복 의심).
🔴 MI **0** · SAME/DIFFERENT **0** · Query 확정 **0** · 운영 배선 **0** ·
   🔴 QA 페이지에 `fetch`/Apify 호출이 **없다**(계약이 잠근다).

### 도메인 분포(육안 판단 전 참고 · 🔴 CTO 는 판정하지 않았다)

| 상품 | Q2 도메인 | Q3 도메인 |
|---|---:|---:|
| S1 B226AC010 | 4 | **6** |
| S2 B226AC009 | **1**(bobochoses 로케일만) | **7** |
| S3 B126AI018 | 4 | 5 |
| S4 AW26MS185 | 8 | 9 |

🔴 **S4 는 양쪽 다 무관 도메인이 섞인다**(`whirlpoolparts` · `awbridal` · `goat` · `etsy` ·
`walmart` · `pinterest`) — 품번 `AW26MS185` 가 **범용 문자열에 가까워** 보인다(관측).
🟢 **S2 가 Q2/Q3 차이를 가장 크게 보여준다** — Q2 는 **판매처 1곳**, Q3 는 **7곳**.

**🔵 다음 — CPO 육안 검증 후 단일 Query 확정.** 🔴 CTO 는 고르지 않았다.

---

## 부록 — `SEARCH-PROVIDER-05` 정의된 Query **전수** 실검색 (2026-10-27)

### ① 「Q1~Q5」라는 이름이 이 저장소에 **세 벌** 있다 (CPO §2 의 답)

| 체계 | 정의 위치 | 내용 |
|---|---|---|
| **운영 열거기** | `discovery-core/query-generator.ts:30-39` · 타입 `types.ts:50` | 🟢 **Q1~Q8 이 literal 로 실재한다** — Q1 상품명 / Q2 브랜드+상품명 / Q3 상품명+색상 / Q4 브랜드+상품명+색상 / Q5 상품코드 / Q6 브랜드+상품코드 / Q7 상품명+buy / Q8 브랜드+상품명+buy |
| **운영 Planner** | `discovery-core/query-planner.ts:66-83` | 이름 있는 **8축**(BRAND_CODE · BRAND_CODE_KO · CODE_ONLY · BRAND_DESIGN · BRAND_DESIGN_KO · PURCHASE_KO · PRICE_KO · SHOP_EN) — **Q 번호가 없다** |
| **SPRINT-03/04 하니스** | `__tests__/search-provider-03-query-width.test.ts:17-19` | 🔴 거기의 Q1/Q2/Q3 는 **위 Q1~Q3 와 뜻이 완전히 다르다**(따옴표 제거 변형) |

🔴🔴 **그러므로 「Q4/Q5 는 정의 없음」이 아니다** — 운영 코드가 **Q1~Q8** 을 정의한다.
🟢 이번에는 **세 체계를 전부** 만들고 **문자열로 dedupe** 한 뒤 전수 실행했다(`G-` · `P-` · `H-` 접두).

### ② 실행 — 상품 4 × 정의된 질의 전수 = **64회 · 결과 526건**

🟢 상품 정의는 **기존 GT fixture**(`wu-059-gt-facts.json` canonicalProduct) 그대로다(새 상품 0).
🔴 `sourceUrl` 은 Query 축이 **한 번도 읽지 않는다**(SPECS 의 fields 는 brand/productName/color/productCode) ⟹ URL 을 지어내지 않았다.
🟢 Apify 설정은 전 질의 **동일**(maxPagesPerQuery 1 · resultsPerPage 20) — 변수는 `queries` 문자열 하나뿐.

### ③ Query 축 집계 — 🔴 **CTO 가 1위를 고르지 않았다**

```
Query                 상품  결과 상품URL 판매처 Crawl Evid  Evid판매처 품번  0건
G-Q3  상품명+색상        4   35    26    19    21   21      14     2   0
G-Q7  상품명+buy        4   36    22    18    18   18      14     3   0
G-Q1  상품명            4   36    21    18    17   17      14     3   0
G-Q5  품번 단독          4   36    21    21    14   14      14     4   0
P-BRAND_DESIGN        4   36    20    15    18   18      13     2   0
P-CODE_ONLY           4   35    23    20    14   14      13     3   0
G-Q2  브랜드+상품명      4   36    23    17    18   18      12     1   0
G-Q8  브랜드+상품명+buy  4   36    18    15    15   15      12     3   0
P-BRAND_CODE          4   27    20    16    17   15      12     6   1
H-Q3  (03/04 라벨)      4   36    23    14    20   20      11     1   0
G-Q4  브랜드+상품명+색상 4   36    19    16    14   14      11     0   0
P-SHOP_EN             4   28    22    16    17   11      11     5   1
P-PURCHASE_KO         3   26    16    14    11   10       9     2   0
G-Q6  브랜드+품번        4   37    22    10    20   20       8     2   0
P-BRAND_CODE_KO       3   15    10     7     8    8       6     3   1
P-PRICE_KO            3   17     8     7     6    6       6     1   1
P-BRAND_DESIGN_KO     3   18     5     4     5    4       3     1   1
```

🔴🔴 **가장 중요한 관측 — 「브랜드+품번」이 Evidence 판매처가 «가장 적다»**:
```
G-Q6 「Bobo Choses B226AC010」 — 결과 37(최다) · Crawl 20(최다급) 인데
     **판매처 10 · Evidence 판매처 8**(전 질의 중 최하위권)
🟢 이유가 화면에 보인다 — **같은 브랜드 공식몰의 로케일 URL 이 자리를 먹는다**
   (실측: S2 G-Q6 는 결과 9건이 **bobochoses.com 한 곳**)
🔴 즉 **결과 개수로 Query 를 고르면 정확히 반대로 고른다**(CPO §9 가 경고한 그것).
```
🔴 그리고 **한글 브랜드 축(KO)은 상품 3개에서만 생성된다**(Main Story 는 alias 가 없다) ⟹ 분모가 다르다. 🔴 **합계를 평균으로 환산하지 않았다.**

### ④ 🔴🔴 「결과 0」을 「결과 없음」으로 읽지 않는다 — **2/5 가 재현되지 않았다**

```
S1 P-BRAND_CODE_KO   0 → 재확인 **0**
S1 P-BRAND_DESIGN_KO 0 → 재확인 **0**
S1 P-PRICE_KO        0 → 재확인 **9**   🔴 재현 안 됨
S3 P-BRAND_CODE      0 → 재확인 **1**   🔴 재현 안 됨
S3 P-SHOP_EN         0 → 재확인 **0**
```
🟢 1차 값을 **덮어쓰지 않고** `recheckOrganicCount` 로 **같이** 적었고, 화면이 그 경고를 직접 말한다.
🔴 **Google/Apify 결과는 실행마다 달라진다** — 이 Sprint 의 모든 숫자는 **그 시점의 1회 관측** 이다.

### ⑤ 화면 — `/qa/search` (인증 뒤) · `docs/search-provider-05-urls.html` (로그인 없이)

🔴 로컬 실측 `/qa/search` → **307 → /login** ⟹ 클릭 검증이 로그인에 막히지 않도록 **같은 컴포넌트** 로
자립형 HTML(489KB · 링크 **526**)을 같이 떨궜다. 🔴 생성기는 `CORE_SP05_HTML=1` 일 때만 쓴다
(회귀마다 산출물이 바뀌어 작업트리를 더럽히는 선례를 피한다).

🔴 화면은 **판정하지 않는다** — MI 0 · SAME/DIFFERENT 0 · **A/B/C/D 자동 분류 0**(기준만 적고 판단은 사람이 한다).

**🔵 상태 — `DISCOVERY SEARCH QUERY SELECTION = HOLD`. CPO 가 육안 확인 후 단일 Query 를 고른다.**

---

## 부록 — `SEARCH-PROVIDER-06` **목적형(Intent) Query** 실험 (2026-10-27)

### ① CPO 재정의 — Query 는 검색어가 아니라 **Discovery Intent** 다

> 「검색어를 잘 만드는 것보다 **무엇을 찾으라고 검색하는지** 를 명시하는 것이 먼저다.」

🔴 **한글/영어를 Query 축으로 삼지 않는다**(검색엔진의 지역/언어 편향을 Query 로 간접
유도하지 않는다). 셋 다 **영어로 통일** 하고, 국내/해외가 결과에서 «실제로» 어떻게 분포하는지만 본다.

```
I-1  BRAND + MODEL_CODE + PRODUCT_NAME                   동일상품 URL 탐색
I-2  BRAND + MODEL_CODE + PRODUCT_NAME + exact product   동일상품 상세페이지 집중
I-3  BRAND + MODEL_CODE + PRODUCT_NAME + buy             실제 판매처 집중
```
🟢 상품명은 GT 제목이 아니라 **운영 Planner 의 코어 토큰**(`BRAND_DESIGN` 축)을 그대로 쓴다
(GT 제목에는 `by {브랜드}` 와 재고/사이즈 꼬리표가 붙어 브랜드가 두 번 들어간다).
🟢 **I-1 은 SPRINT-05 의 `H-Q3` 와 문자열이 같아 재검색 0** 으로 결과를 복사했다(실검색 **8회**).

### ② 🔴🔴 CPO 의 질문에 대한 답 — **한 Query 가 국내+해외를 섞어 주는가**

```
Query                 결과 상품URL 판매처 Crawl Evid Evid판매처  🇰🇷(.kr) 공식몰 해외도메인
I-1                    36    23    14    20   20       11      1(1)     2      16
I-2 exact product      36    24    14    15   15        8      1(1)     2      14
I-3 buy                36    23    13    19   19       10      0(0)     2      14
──────────────────────────────────────────────────────────────────────────────
참고 G-Q3 상품명+색상   35    26    19    21   21       14      0(0)     1      25
참고 G-Q5 품번 단독     36    21    21    14   14       14      7(7)     0      24
참고 P-CODE_ONLY "품번" 35    23    20    14   14       13      8(8)     0      —
```

🔴🔴🔴 **목적어("exact product" / "buy")가 국내를 불러오지 못한다.** Query 축별 🇰🇷 도메인 전수:

```
P-CODE_ONLY   "B226AC010"              **8**  mustit · gmarket · 11st · lfmall · kurate ·
                                              donokids · deuxbebe · littleluna
P-PURCHASE_KO "보보쇼즈" "품번" 구매      **8**  wconcept · gmarket · lfmall · jente · posty ·
                                              gsshop · miniboutique · mustit
G-Q5          B226AC010                **7**  11st · gmarket · biskuit · kurate · mustit ·
                                              reebonz · lfmall
P-BRAND_CODE  "브랜드" "품번"             4
G-Q6          브랜드 + 품번                2
I-1 / I-2                                1    (littleluna · S4 에서만)
I-3 · G-Q1 · G-Q2 · G-Q3 · G-Q4 · G-Q7 · G-Q8 · P-BRAND_DESIGN   **0**
```

🔴🔴 **상품명이 들어간 영어 Query 는 국내가 «구조적으로» 0 이다** — I-1/I-2/I-3 셋 다 그 모양이다.
🟢🟢 **섞어 주는 축은 「품번」 하나다** — `P-CODE_ONLY` 는 **상품 4개 전부** 에서 국내와 해외를 같이 낸다:

```
S1 🇰🇷 mustit                          · 🌎 6
S2 🇰🇷 gmarket · 11st · lfmall          · 🌎 5
S3 🇰🇷 kurate · lfmall                  · 🌎 6
S4 🇰🇷 donokids · deuxbebe · littleluna · 🌎 5
```
🔴 `G-Q5`(따옴표 없는 품번)는 **S1·S4 에서 국내 0** 이다 ⟹ 따옴표 유무가 갈린다(관측 · 원인 미규명).

⟹ 🔵 **「상품 1개 = Search 1회」로 국내+해외를 동시에 얻는 것은 «가능해 보인다» — 단 축이
   「품번」일 때만이고, I-1/I-2/I-3 은 그 역할을 못 한다.** 🔴 CTO 가 확정하지 않았다.

### ③ 🔴 시장 표시는 **관측** 이다 — 운영 판정기를 쓸 수 없다

`classifyCandidateMarket` 은 **가격과 통화** 를 요구하는데 검색 결과에는 URL/제목뿐이다.
그래서 `market-observation.ts` 가 **URL 단계에서 보이는 것만** 적고, 🇰🇷 는 **`.kr` TLD 와
국내 등록부 소속을 갈라서** 센다 — 🔴 「등록부에 있다」≠「국내 시장이다」(WU-019R 에서
등록부 소속 공식몰이 **EUR** 를 냈다). 🟢 브랜드 공식몰은 **별도 칸** 으로 뺐다.

### ④ 표본 한계 — 넘겨 읽지 않는다

🔴 원상품 **4개** · 브랜드 **2개**(Bobo Choses 3 · Main Story 1) · 1회 관측 ·
Google/Apify 결과는 **실행마다 다르다**. 🔴 「품번 축이 항상 국내를 낸다」로 일반화하지 않는다.

**🔵 상태 — `DISCOVERY SEARCH QUERY SELECTION = HOLD`. CPO 가 단일 Query 를 고른다.**

---

## 🟢🟢🟢 `SEARCH-PROVIDER-07` — **Single Query 운영 배선 완료** (2026-10-27)

### ① 확정된 계약 — 이 네 줄이 전부다

```
Discovery Query   "{MODEL_CODE}"            owner = buildDiscoverySearchQuery (query-planner.ts)
Search 횟수        상품 1개 = **정확히 1회**   MAX_SEARCHES_PER_PRODUCT = 1
국내/해외          **같은 Search 결과** 에서 혼합 확보
Identity          🔴 Search 와 **분리** — 품번은 「어디서 찾을지」이지 「같은 상품인지」가 아니다
```

### ② 경로 — 새 후보 생성 코드가 **없다**

```
ProductIdentity
  → buildDiscoverySearchQuery   `"{MODEL_CODE}"` (품번 없으면 **null · 검색 안 함**)
  → collectWebSearchUrls        외부 provider **1회** → **URL 만** 돌려준다
  → collectUrlCandidatePool     🟢 **기존 함수 그대로**(shopId 만 `__web_search__`)
  → 기존 Crawl / Evidence / Identity / 가격 / MI   🔴 **한 줄도 바꾸지 않았다**
```
🟢 `web-search-pool.ts` 에 `factsFromProductUrl`·`withConfidence`·`enrichCandidatePrices`·
`classifyUrlShape` 가 **하나도 없다**(계약으로 잠금) — 검색만 하는 얇은 층이다.

### ③ 🔴 「숨은 2차 Search」를 구조적으로 막았다

```
❌ 재시도           실패해도 **1회** 다(계약: 성공/실패 모두 호출 1회)
❌ fallback        품번이 없으면 **검색하지 않는다**(브랜드/상품명으로 대신하지 않는다)
❌ 2차 질의         결과가 0 이어도, 국내만/해외만 나와도 **다시 부르지 않는다**
❌ 소스 어휘        `retry`/`fallback`/`secondQuery`/`widen` 이 그 파일에 **없다**(계약)
🔴 켜는 곳은 **하나** — 「지금 확인 / 🔄 다시 분석」. 일괄 cron 3곳은 **켜지 않는다**
   (계약이 호출부 4곳을 전수로 본다 · 유일한 **유료** 경로라 비용이 상품 수만큼 곱해진다)
```

### ④ 🔴 「못 물어봤다」와 「결과 없다」를 가른다

```
NO_MODEL_CODE    품번이 없어 질의를 만들지 않았다      · searches 0
NOT_CONFIGURED   토큰이 없어 **못 물어봤다**          · searches 0 · 🔴 「웹에 없다」가 아니다
failed: true     불렀는데 실패했다                   · 🔴 **빈 결과와 구별된다**(계약)
```
🔴 토큰은 **로그·응답·오류 메시지 어디에도 싣지 않는다**(쿼리스트링에 들어가는 호출이라
`console.log` 와 `res.url` 을 그 파일에서 **금지** 했다 · 계약).

### ⑤ 🟢🟢 운영 함수 실측 — **국내+해외가 한 번에 왔다**

`collectWebSearchUrls`(운영 함수)를 실제 provider 에 **1회** 호출(B226AC009):
```
query "B226AC009" · searches 1 · organic 9 · skipped null · failed false
🇰🇷 gmarket · 11st · coupang · bibandi · danawa · lfmall
🌎 babyshop(en-sk) · rakuten(jp) · answear(ro)
```
🔴 그중 일부는 검색/마켓 페이지다 — **그 선별은 기존 입력 경계와 `classifyUrlShape` 가 한다**
(이 WU 가 새 규칙을 만들지 않았다).

### ⑥ 변이 8종 — 전부 FAIL → 복구

```
M1 품번 fallback 2F · M2 상품명 추가 2F · M3 상한 2 로 2F · M4 실패를 0 으로 2F ·
M5 「못 물어봄」을 0 으로 1F · M6 저장차단 집합에서 제외 1F · M7 켜는 곳 제거 1F ·
M8 재시도 추가 1F   → 원상복구 16 passed
🔴 M6 은 1차에 **적용되지 않았다**(CRLF) — 「미적용」을 「통과」로 읽지 않도록 적용 확인 후 재측정했다
```

### ⑦ 기존 계약 3건이 FAIL 했고 **갱신·강화** 했다

```
TRANSIENT_SHOP_IDS.size 5 → 🟢 **집합 전체를 이름으로** 단언(숫자만 맞추는 길 제거)
transientPools.push 4 → 5  (🟢 「소비 루프는 하나」가 본체라는 것을 주석으로 명시)
collectUrlCandidatePool 호출 3 → 4 (🟢 `shopId: WEB_SEARCH_SHOP_ID` 를 **이름으로** 추가 단언)
```

### ⑧ 🔴 이번에 **하지 않은 것**

MI 연결 ❌ · Identity 변경 ❌ · 가격 로직 ❌ · Registry 확장 ❌ · Gemini ❌ ·
국내/해외 2회 Search ❌ · 언어 기반 질의 ❌ · schema/DB ❌ · UI ❌.

**🔵 상태 — `DISCOVERY SEARCH QUERY SELECTION = GO (배선 완료)`.
다음은 실제 상품에서 Candidate URL → Crawl → Evidence → Identity 확인이다.**

---

## 부록 — `SEARCH-PROVIDER-08` **검색 「목적 문구」 PoC** (2026-10-27 · 구현 0)

CPO 지시 — 「Query 에 **검색 목적** 을 자연어로 붙이면 국내 비중이 오르는가」.
🔴 **구현하지 않았다**(운영 코드 변경 0 · SP-07 배선은 그대로).

```
A  BRAND + CODE + 상품명                                   🟢 기존 기준선(= I-1 · **재검색 0**)
B  A + 「국내/해외 동일상품 URL 찾아줘」
C  A + 「국내와 해외에서 이 상품을 판매하는 동일상품 URL을 찾아줘」
D  BRAND + 상품명 + 「국내/해외 …」                           🔴 **품번 없이**(품번 없는 상품 조건)
E  A + "find stores selling this exact product in Korea and overseas"
   🔴🔴 **CTO 가 추가한 CONTROL** — 지시서에 없다
```

### 🔴🔴 CONTROL 을 추가한 이유 — 그대로 쟀으면 **원인을 잘못 짚었다**

B·C·D 의 목적 문구는 **한국어** 다. 효과가 나와도 ⒜「목적을 말해서」인지
⒝「한국어 토큰이 들어가서」인지 **가를 수 없다**. 🟢 그래서 같은 목적을 **영어로** 말하는
E 를 CONTROL 로 붙였다.

### 결과 (상품 4 합계 · 검색 16회 · $0.072)

```
Query          결과 상품URL Crawl Evid Evid판매처  🇰🇷  🌎  ⚠
A 기존           36    23    20   20      11     1  16   0
B 목적(한,짧게)   36    23    19   17      12    🟢4  14   5
C 목적(한,길게)   31    14    12   11       5     2   9   9   🔴 전면 악화
D 품번 없이       31    13    10   10       7     1  15   2   🔴 품번을 빼면 나빠진다
E 목적(영) CONTROL 36   23    20   20    🟢14     1  16   0
────────────────────────────────────────────────────────────
현재 운영 배선 `"{CODE}"`  35  23  14  14    13   🟢**8**  16   3
참고 G-Q5 품번(따옴표 없음) 36 21  14  14      14     7 🟢**24** 0
```

### 🔴🔴🔴 결론 — **효과의 정체는 「목적」이 아니라 「한국어」다**

```
같은 목적을 **영어로** 말한 E 는 국내가 **전혀 늘지 않았다**(1 = A 와 동일).
한국어로 말한 B 만 늘었다(4). ⟹ 올린 것은 **한국어 토큰** 이다.
🔴 그러므로 「검색 목적을 명시하면 국내가 는다」로 적지 않는다.
```

🔴 그리고 CPO 기준(**「국내 비중 증가 + 해외 후보 유지」**)으로 보면
**목적 문구 어느 것도 현재 운영 배선을 이기지 못했다** — B 의 🇰🇷 4 는 `"{CODE}"` 의
**8 의 절반** 이고, B 는 해외를 16 → 14 로 **줄이고** 노이즈를 0 → 5 로 **늘린다**.

🟢 유일하게 해롭지 않은 것은 **E** 다(해외 16 유지 · Evid판매처 11 → **14** 로 최고 ·
노이즈 0). 🔴 단 **국내는 못 올린다** ⟹ 이번 목적(국내 확보)에는 답이 아니다.

### 🔴 측정 한계

⒜ 상품 **4개** · 브랜드 2개 · **1회 관측** · Google/Apify 는 실행마다 다르다.
⒝ 🔴 **S4 의 C·D 는 결과가 4건** 이었다(다른 질의는 9). 일시적 열화일 수 있고 **재확인하지
   않았다** — C·D 합계가 그만큼 과소일 수 있다. 🟢 단 C·D 는 **네 상품 전부에서** 약했으므로
   순위가 뒤집히지는 않는다.
⒞ B 의 🇰🇷 4 중 **3 곳이 S4 하나에서** 나왔다(S1·S2 는 0) — 상품 편향이 크다.

**🔵 상태 — 운영 Query 는 `"{MODEL_CODE}"` 그대로 유지. 목적 문구 채택 **NO-GO** 를
권고하되, 🔴 최종 판정은 CPO 다.**

---

## 부록 — `SEARCH-PROVIDER-09` **짧은 판매처 Signal** PoC (2026-10-27 · 구현 0)

CPO 판정 반영 — 목적 자연어 NO-GO · `"{MODEL_CODE}"` 단독도 NO-GO · 기본 골격은
**`BRAND + PRODUCT_NAME + [MODEL_CODE 있으면]`**(품번은 **optional**).
🔴 **운영 Query 를 수정하지 않았다**(CPO 명시) · 구현 0.

```
S-A   기준선 BRAND + [CODE] + 상품명                 🟢 재검색 0
S-A2  🔴 CONTROL — 기준선에서 **끊긴 전치사만** 제거
S-B   + 「동일상품 판매처」
S-C   + 「국내외 판매처」
S-D   **품번 제외** + 「동일상품 판매처」
```

### 🔴 CONTROL `S-A2` 를 붙인 이유

품번 없는 상품에서 운영 코어 토큰이 `tokens.slice(0,4)` 라 질의가
`The Animals Observatory Pupfish Kid T-Shirt **in**` 처럼 **끊긴 구** 가 된다.
그대로 재면 결과가 나빠졌을 때 ⒜「품번이 없어서」인지 ⒝「질의가 끊겨서」인지 **가를 수 없다**.

### 🟢🟢 표본 — **품번이 «구조적으로» 없는 실제 상품 2개를 넣었다**

운영 DB 실측으로 **스냅샷 전건에 `sku` 가 없는 브랜드** 에서 골랐다
(The Animals Observatory 18/18 · Konges Slojd 12/12).
🔴 `brand="AW26"` 인 Bobo 스냅샷은 **쓰지 않았다** — URL 에 품번이 있는데 추출만 실패한
것이라 「품번 없는 상품」과 **다른 조건** 이다.

### 결과 ⓐ 품번 **있는** 상품 4개

```
Query  결과 상품URL Crawl Evid Evid판매처 🇰🇷Evid판매처
S-A     36    23    17   17      9        1
S-A2    36    23    17   17      9        1   (= S-A · 꼬리 없음)
S-B     34    21    13   13     11        1
S-C     28    17     8    8      8      🟢3
S-D     35  🟢24  🟢21 🟢21   🟢17        1
```

### 결과 ⓑ 🔴 품번 **없는** 상품 2개 — **CPO 의 핵심 질문**

```
Query  결과 상품URL Crawl Evid Evid판매처 🇰🇷Evid판매처
S-A     18     9     9    9      5        0
S-A2    19  🟢10  🟢10 🟢10   🟢 6        0
S-B     17     5     5    5      4        0
S-C     18     8     7    7      5      🟢1
S-D     18     6     5    5      4        0
```

🟢🟢 **「품번이 없으면 Search 0」이 아니다** — 다섯 질의 **전부** 후보를 확보했고
Evidence 까지 **5~10건** 살아남았다. 🔴 CPO 가 우려한 구조적 탈락은 **발생하지 않는다**.
🟡 꼬리 전치사를 떼면(`S-A2`) 조금 낫다(Evid판매처 5 → 6) — 🔴 **N=2** 다.

### 🔴🔴 트레이드오프가 분명하다 — 둘을 동시에 주는 질의가 **없다**

```
S-C 「국내외 판매처」  🇰🇷Evid 1 → **3**   하지만 Crawl 17 → **8**(절반 이하) · 결과 36 → 28
                      🔴 S3 는 **해외가 0** 이 됐다(CPO 기준 「해외 유지」 실패)
S-D 품번 제외+「동일상품 판매처」  Evid판매처 9 → **17** · Crawl 21 · 상품URL 24  🇰🇷Evid 1
                      🔴 품번을 **뺐는데** 전체 Evidence 가 가장 좋다
S-B 「동일상품 판매처」  국내 효과 **없음** · Crawl 17 → 13 ⟹ 🔴 단독으로는 이득이 없다
```
🔴 **CTO 는 고르지 않았다.** 「국내 Evidence(S-C)」와 「전체 Evidence(S-D)」 중 무엇을
사는지는 제품 결정이다.

### 🔴🔴🔴 사고 하나와, 그 사고가 준 증거

```
품번 없는 상품에서 `S-D` 는 품번이 없으니 `S-B` 와 **문자열이 같다**. 하니스의 dedupe
맵이 루프 중 갱신되지 않아 **같은 질의를 두 번 검색** 했다($0.009 낭비).
🟢 **계약이 잡았다**(「중복 행은 복사본이어야 한다」) · 숨기지 않고 `accidentalDuplicateOf`
   로 표시했고 **정확히 2건** 으로 못박았다(하나라도 늘면 FAIL).
🔴🔴 그리고 그 사고가 이 트랙에서 가장 중요한 증거를 줬다 —
   **같은 질의를 몇 분 뒤 다시 돌렸더니 S6 는 8↔9건 중 «3건» 만 겹쳤다**(S5 는 9/9 동일).
⟹ 🔴 **이 트랙의 모든 Query 비교는 「1회 관측」이고 실행 간 변동이 그만큼 크다.**
   순위 차이가 작은 항목(예: S-A vs S-A2)은 **차이로 읽지 않는다.**
```
🔴 같은 이유로 **Crawl 수치도 패스마다 달랐다**(같은 URL 집합에서 S-A 20 → 17) —
외부 사이트 응답이 흔들린다. 🔴 Crawl/Evidence 절대값을 고정값으로 쓰지 않는다.

### 🔴 그리고 내가 또 밟은 함정

정규식/템플릿 리터럴을 **쉘 한 줄로** 편집하다 `byKey.set(, copy)` 로 깨뜨렸다
(메모 `정규식을 쉘/파이썬으로 편집하지 않는다` 재발 · 🟢 즉시 Edit 도구로 복구).

**🔵 상태 — `Query Selection = HOLD` 유지. 운영 Query 는 그대로(CPO 지시).**

---

## 🔴🔴 `SEARCH-PROVIDER-10` — **Query 안정성 2회 관측** (2026-10-27 · 구현 0)

```
POC_REPEAT = true        OPERATING_SEARCH = 0
추가 검색 **정확히 18회**(6 상품 × S-A/S-C/S-D × 1) · $0.081 · 18회 초과 0
🔴 운영 Query 변경 0 · Planner 0 · Provider 0 · retry 0 · fallback 0 · MI 0 · Identity 0
🟢 운영 계약 **「1 Product = 1 Search」는 그대로** 다(`MAX_SEARCHES_PER_PRODUCT = 1` · 계약으로 확인)
```

### ⑦ 최종 비교표 — 2회 관측 합계 · 상품 6

| Query | 국내 Evid 판매처 | 해외 Evid 판매처 | 전체 Evid 판매처 | Evidence율 | 노이즈 | URL 1↔2 | **판매처 1↔2** |
|---|---:|---:|---:|---:|---:|---:|---:|
| **S-A** 기준선 | 1 | 35 | 36 | **90%** | **1** | **3%** | 42% |
| **S-C** 국내외 판매처 | **7** | 26 | 33 | 71% | 3 | 12% | 31% |
| **S-D** 품번제외+동일상품 판매처 | 3 | **36** | **39** | 84% | 7 | **30%** | **47%** |

판매처 overlap 분포 — S-A 중앙 67%(최소 9%) · S-C 중앙 67%(**최소 0%**) · S-D 중앙 83%(최소 17%).

### 🔴🔴🔴 가장 중요한 발견 — **검색은 Query 선택을 지지할 만큼 안정적이지 않다**

```
같은 질의 · 같은 설정 · 몇 분 간격인데 **URL 겹침이 3~30%** 다.
S-A 는 **3%** — 사실상 **매번 다른 URL** 이 온다.
🟢 판매처(domain) 단위는 31~47% 로 낫지만 그래도 절반이 안 된다.
⟹ 🔴 S-A(36) vs S-D(39) 같은 전체 Evidence 차이는 **변동 폭 안에 있다** —
   2회 관측으로 우열을 가릴 수 없다.
```

### 🔴🔴 두 번째 발견 — **국내 Evidence 는 Query 가 아니라 «상품» 이 정한다**

```
국내 Evidence 판매처 **11건 중 9건(82%)이 S4(Main Story) 한 상품** 에서 나왔다.
S-D 의 국내 3건은 **3건 전부 S4** · S-A 의 1건도 S4.
S-C 만 S1·S6 에서 1건씩 더 냈다.
⟹ 🔴 **Query 문구를 바꿔서 국내를 여는 것이 아니다.** 그 브랜드/상품이 국내에
   유통되는가가 결정한다(CPO NO-GO 조건 「특정 상품에만 효과」에 셋 다 걸린다).
```

### ⑧ 판정 기준 7개 대조 — **셋 다 전부 만족하지 못한다**

| 기준 | S-A | S-C | S-D |
|---|---|---|---|
| ① 국내 Evidence 확보 | 🔴 1 | 🟢 7 | 🟡 3 |
| ② 해외 Evidence 유지 | 🟢 35 | 🔴 26 | 🟢 36 |
| ③ 전체 Evidence 충분 | 🟢 36 | 🟡 33 | 🟢 39 |
| ④ Crawl/Evidence 안정 | 🟢 90% | 🔴 71% | 🟡 84% |
| ⑤ 판매처 overlap | 🟡 42% | 🔴 31% | 🟢 47% |
| ⑥ 특정 상품 몰림 없음 | 🔴 S4 | 🔴 S4 5/7 | 🔴 **S4 3/3** |
| ⑦ 품번 없는 상품 작동 | 🟢 12 | 🟡 11 | 🔴 **8**(최약) |

🔴 **S-C** — 국내를 올리는 대신 **해외가 26 으로 줄고**(①↔② 교환) Evidence율 71%·overlap 31% 로 **가장 불안정**.
🔴 **S-D** — 전체·안정성은 최고지만 **code-less 상품에서 가장 약하다**(8 vs S-A 12) ⟹ CPO NO-GO 조건에 직접 걸린다.
🔴 **S-A** — Evidence율·code-less 최고지만 **국내가 1** 이다.

### 🔵 결론

```
Query Selection = **HOLD**   (CPO §11 — 결과가 명확하지 않으면 HOLD 로 종료한다)
🔴 CTO 는 승자를 고르지 않았다.
🔴 그리고 **추가 Search 를 임의로 돌리지 않았다**(18회에서 STOP · CPO §4·§12).
```

🔴 **CPO 가 마지막에 물은 질문에 대한 재료** — 「Query 문구 최적화를 계속하는 것이 비용
대비 가치가 있는가」: 이 데이터는 **아니다** 쪽을 가리킨다. 국내 Evidence 의 82% 가 **한
상품** 에서 나오고, 질의 간 차이는 **실행 간 변동 폭 안** 에 있다.

---

## 🔵🔵🔵 `SEARCH-PROVIDER-11` — **Candidate URL → Crawl → Evidence → Identity 전수** (2026-10-27)

🔴 **추가 검색 0**(저장된 URL 재사용) · 구현 0 · 운영 변경 0 · MI 0 · Identity 규칙 0.
🟢 판정은 전부 **운영 함수** 가 냈다(`collectUrlCandidatePool` → `withConfidence` →
`enrichCandidatePrices` → `judgeDomesticCandidate` → `priceTierFromLink` → `classifyCandidateMarket`).

### 🔴🔴🔴 먼저 — **SPRINT-09 의 라벨을 정정한다**

```
`sku` 와 `brandModelCode` 는 **다른 칸** 이고 Discovery 가 쓰는 것은 **후자** 다.
SP-09 에서 「품번이 구조적으로 없는 상품」을 `sku = ''` 로 골랐는데 실측하니:
   S5  sku ""  →  brandModelCode **"F26100"**     (설명문의 Product code 라벨에서 복구)
   S6  sku ""  →  brandModelCode **"KS105721"**
⟹ 🔴 SP-09 의 그 두 상품은 **품번이 있다**. 「품번 없는 상품에서도 Search 가 돈다」는
   결론은 **그 두 상품으로는 지지되지 않는다**(질의에서 품번을 뺀 효과를 잰 것은 유효하다).
```

### 🔵🔵 그래서 **운영 전수로 다시 쟀다** — 품번 부재가 실제 문제다

```
운영 `product_snapshots` 의 canonicalProduct **133건**(원본 URL 기준 중복 제거)
   품번(brandModelCode) 없음 **63건 = 47%**
   브랜드 없음 16 · **둘 다 없음 6**
⟹ 🔴🔴 현재 운영 Query `"{MODEL_CODE}"` 로는 그 **47% 가 Search 0** 이 된다.
   CPO 가 「`"{MODEL_CODE}"` 단독 확정 NO-GO」라 한 근거가 **숫자로 확인됐다**.
```

### ①~⑥ funnel — URL **151건**(상품 6 × 질의 3 · 1차 관측)

```
Query  URL ①상품상세 ②Crawl ③Evidence ④브랜드 ④상품명 ④품번 ⑤최종후보 ⑥국내 ⑥해외
S-A     52    30      20     20      19     20     3      9     0     7
S-C     46    25      11     11       9     11     4      4     1     3
S-D     53    30      20     20      18     20     4     11     0    10
ALL    151    85      51     51      46     51    11     24     1    20
```

**사라진 «첫» 칸** (합 151)
```
① 상품상세 아님                         **66**  (44%)
🟢 최종 후보                              24
⑤ 샵 판정 전 탈락(EVIDENCE_NOT_WORTHWHILE) 18
② Crawl 실패(사유 미기록)                  16   🔴 측정불가 — 아래 한계 ⒝
② 입력경계/접근(UNREACHABLE)              14
⑤ 샵 대표 아님                             9
② 입력경계/접근(NO_FACTS)                   3
② 입력경계/접근(REDIRECTED_AWAY)             1
```

**상품별 최종 후보** — S1 2 · S2 8 · S3 5 · S4 1 · S5 1 · S6 7 (= 24) · 🇰🇷 **1**(S6) · 🌎 20 · ❔ 3

### 🔴 읽어야 할 사실 넷

```
① **가장 큰 손실은 「상품 상세가 아닌 URL」 66건(44%)** 이다 — 검색 결과의 절반 가까이가
   애초에 상품 페이지가 아니다(목록·검색·마켓·기사).
② 🟢 **Crawl 이 되면 Evidence 는 «항상» 있다**(51/51 · 100%). ⟹ Evidence 추출은 병목이 아니다.
③ 🔴🔴 **후보 쪽 품번은 51건 중 11건(22%) 뿐** 이다. 원상품의 47% 가 품번이 없는 것과 겹치면
   **품번으로 동일성을 가르는 경로가 양쪽에서 좁다**.
④ 🔴 **국내 최종 후보는 1건** 이다(S6). SP-10 의 「국내는 상품이 정한다」와 같은 그림이다.
```

### 🔴 측정 한계

```
⒜ 1차 관측이다 — SP-10 이 보인 변동(URL 겹침 3~30%)이 이 숫자에도 그대로 걸린다.
⒝ 「② Crawl 실패(사유 미기록) 16」은 **측정불가** 다 — pool 이 사유를 남기지 않은 경로다.
   🔴 「우리가 못 읽었다」로 단정하지 않는다.
⒞ 상품 **6개** · 질의 3개. 전수 환산 금지.
```

### 🔴 내가 틀린 것 셋 — 전부 보고 직전에 잡았다

```
⒜ **URL 키가 어긋났다** — 검색 결과의 `?srsltid=` 추적 파라미터를 입력 경계가 걷어 내는데
   내 표는 원문 URL 로 맞췄다 ⟹ 1차 측정이 **Crawl 27**, 느슨한 키로 고치니 **51** 이었다.
   🔴 그대로였으면 「Crawl 에서 절반이 더 죽는다」는 거짓 원인이었다.
⒝ **`modelName` 칸이 없는 오래된 스냅샷** 에서 TypeError — 운영 builder 의 **기본값 그대로**
   복원했다(값을 채워 넣지 않았다).
⒞ **자기 금지어 때문에 자기 계약이 FAIL** 했다(「추가 검색 0」 단언에 provider 이름을 통짜로
   적었다) ⟹ 금지어를 쪼개 적었다.
```

**🔵 다음 — CPO 판정.** 이 데이터가 가리키는 자리는 둘이다: **① 상품상세가 아닌 URL 44%**
(입구 손실)와 **② 원상품 품번 부재 47%**(현재 운영 Query 가 작동하지 않는 구간).
🔴 CTO 는 둘 다 **열지 않았다**.

---

## 🔴🔴🔴 `SEARCH-PROVIDER-12` — **입구 손실 44% 의 절반은 «우리 분류기» 였다** (2026-10-27)

🔴 추가 Search **0** · Query 변경 0 · 1-hop **구현 0** · MI 0 · Identity 0 · Registry 0 · 재시도 0.
🟢 입력은 **이미 확보한 URL** 뿐이고, 1차 분류는 **운영 `classifyUrlShape`** 가 한다.

### ① 유형별 — 상품상세 아님 **60건 / 143**

```
유형                 건수  샘플
OTHER                 41  farfetch.com/fi/shopping/kids/bobo-choses-booty-ghost-print-long-sleeve-…
LISTING_CATEGORY      12  kobitodepunch.com/categories/1367770
BRAND_STORE_HOME       3  kinuandkotta.shop-pro.jp/?mode=cate&…
MARKETPLACE            2  ebay.com/shop/bobo-choses
SEARCH_PAGE            1  lfmall.co.kr/app/search/result/보보쇼즈…
SOCIAL_NOISE           1  youtube.com/watch?v=…
```
🔴 유형 라벨은 **보고용 관측** 이고 운영 규칙이 아니다(운영 코드가 import 하지 않음을 계약이 잠근다).

### 🔴🔴 ② 1차 측정이 «순환» 이었다 — 같은 게이트를 두 번 쟀다

```
`factsFromProductUrl` 에 넣었더니 **60/60 전부 `NOT_PRODUCT_URL`** → 「놓친 상품 0건」.
🔴 그 함수는 **안에서 `classifyUrlShape` 로 먼저 막는다** — 내가 검증하려던 바로 그 분류기다.
   (WU-120 이 기록한 「모양 게이트를 두 번 쟀다」의 재발 · 그대로 보고했으면 거짓 결론)
```

### 🟢🟢 ②-b **raw fetch 로 다시 물었다 — 27건이 스스로 「상품」이라 한다**

```
raw fetch 성공 **47/60** · 페이지가 `@type:Product` 또는 `og:type=product` 를 **스스로 적은 것 27건**
   OTHER 23  ·  LISTING_CATEGORY 4
샘플 — farfetch.com/{fi,ph,sg,om,jp,ro,uk,hk}/shopping/kids/…-item-{id}.aspx
```
🔴🔴 ⟹ **입구 손실의 절반 가까이가 검색 품질이 아니라 «우리 URL 분류기» 다.**
`farfetch` 의 `/{locale}/shopping/kids/{slug}-item-{id}.aspx` 는 `classifyUrlShape` 의
상품 경로 목록(`products|product|dp|itm|goods|p`)에 **없어서** `UNKNOWN_PAGE` 로 떨어진다.
🔴 이것은 SPRINT-03 이 **「`.aspx` 분류 확장 = HOLD」** 로 닫아 둔 바로 그 자리다 ⟹ **CPO 판정 사안**.

🔴 과장하지 않는다 — `og:type=product` 를 목록 페이지가 다는 경우가 있다(LISTING_CATEGORY 4건이
그 모양일 수 있다). 🔴 **「27건이 전부 진짜 상품」으로 적지 않는다** — 「스스로 상품이라 적었다」가 정확하다.

### ③ 현재 운영 1-hop 모듈로 상세를 얻는가 — **얻는다(14건)**

```
`collectDomesticListingUrls`(기존 모듈 · 새 구현 0) 로 목록/홈 **16곳** 시도 → **상세 URL 14건**
막힌 사유 — NO_BRAND_LISTING 5 · URL_CODE 4 · NO_BRAND_BLOCK 4 · ROBOTS_DISALLOW_ALL 2 · ENTRY_TEXT 1
```
🟢 즉 **1-hop 은 이미 있고 실제로 작동한다**. 🔴 운영에 켜는 것은 CPO 결정이다(이번에 켜지 않았다).

### ④ SP-11 의 「Crawl 실패(사유 미기록) 16」 — **미지의 실패가 아니었다**

```
URL 을 **하나씩** pool 에 넣으니 사유가 전부 나온다:
   상품상세 83건 중 후보 성립 **65** · 탈락 18
   UNREACHABLE 14 · NO_FACTS 3 · REDIRECTED_AWAY 1
```
🔴 SP-11 에서 사유가 비었던 것은 **배치 안에서 사유가 다른 URL 에 귀속된 것** 이고
「알 수 없는 실패」가 아니었다. 🟢 **「측정불가」를 실패 원인으로 해석하지 않는다**(CPO 지시 그대로).

### 🔴 측정 한계

```
⒜ URL 수가 SP-11 의 151 이 아니라 **143** 이다 — 여기서는 (상품, loose URL) 로 **중복을 접었다**.
⒝ raw fetch 실패 13건은 **측정불가** 다(「상품이 아니다」가 아니다).
⒞ `og:type=product` 는 **사이트의 자기 선언** 이다 — 동일상품 여부와 무관하다.
⒟ 1차 관측 · 상품 6개. SP-10 의 변동성이 그대로 걸린다.
```

**🔵 다음 — CPO 판정 둘.** ① `classifyUrlShape` 에 `.aspx`/`/shopping/` 류를 열 것인가
(SPRINT-03 HOLD 해제) ② 운영에서 **목록 → 1-hop 상세** 를 켤 것인가. 🔴 CTO 는 둘 다 열지 않았다.

---

## 🟢 `SEARCH-PROVIDER-13` — `-item-{id}.aspx` 상품 분류 (2026-10-27 · 운영 1줄)

🔴 추가 Search **0** · Query 0 · 1-hop **0** · MI 0 · Identity 0 · Registry 0 · 재시도 0.

### 추가한 것 — **구체 패턴 하나**

```ts
const PRODUCT_ITEM_ID_SUFFIX = /(?:^|\/)shopping\/[^?#]+-item-\d+\.aspx$/i;
```
🔴 **`.aspx` 전체 금지** · 🔴 **`shopping` 포함만으로도 금지** · 🔴 `og:type` 역수입 금지 ·
🔴 **호스트 이름을 보지 않는다**(사이트 전용 규칙 금지 — 계약이 `hostname`/`farfetch` 를 막는다).

### 수치 — corpus **749 URL**(SP-12 확보분 · 추가 Search 0)

```
Farfetch .aspx 대상
- 총 대상            50
- PRODUCT → PRODUCT   0
- UNKNOWN → PRODUCT  **50**
- LISTING → PRODUCT   0
- 기타 오분류          0

Negative
- 기존 non-product   699
- PRODUCT 로 잘못 바뀐 수  **0**

전체 corpus
- 변경 전 PRODUCT_PAGE  467  → 후 **517**
- 변경 전 LISTING_PAGE   64  → 후  64
- 변경 전 UNKNOWN_PAGE  218  → 후 **168**
- 새로 회수된 상품 후보   **50**
- 행동 손실               0
- 오분류                  0
```
🟢 「새로 상품이 된 것이 **전부 그 패턴**」을 계약이 **수식으로** 단언한다(차이 == 적중 수).

### 🔴🔴 그러나 — **실제 회수는 현재 0 이다**

```
그 도메인에 **Chrome UA 로** 다시 요청 → **50/50 전부 HTTP 403**(전수 고정 · 증거 fixture).
⟹ 분류를 고쳐도 지금은 후보가 생기지 않는다. 🔴 「funnel 이 좋아졌다」로 적지 않는다.
🟡 단 **간헐적** 이다 — 같은 날 SP-12 의 raw fetch 에서는 23건이 열렸다.
```
🟢 그래도 패턴을 넣는 이유는 **분류가 틀린 것은 사실** 이기 때문이고, 차단은 **다른 축** 이다.
🔴 **STOP-RISK** — 이 URL 들이 이제 pool 로 들어가 `UNREACHABLE` 로 떨어진다 ⟹
   **HTTP 비용이 늘고 회수는 0** 일 수 있다. 되돌리는 비용은 **1줄** 이다.

### 음성 대조 6종

```
M1 패턴 제거 4F · M2 `.aspx` 전체 허용 1F · M3 `shopping` 포함만 2F ·
M4 id 숫자 아님 허용 1F · M5 호스트 종속 규칙 3F
🔴 **M6(LISTING 뒤로 이동) 0F — 순서는 계약이 아니었다.** 1차 주석이 「먼저 본다」고
   암시했는데 **반증됐다**(SPRINT-02 가 `shop` 토큰에 세그먼트 경계를 넣어서 `shopping` 이
   애초에 걸리지 않는다) ⟹ 🟢 가짜 계약을 만들지 않고 **주석을 사실로 고쳤다**.
🔴 M4 는 1차에 **쉘이 백슬래시를 먹어** 미적용이었다(문서화된 그 함정) — 파일 스크립트로 재측정.
```

### 기존 계약 3건이 FAIL → **갱신**(그것이 수정의 증거다)

```
search-provider-02  「`.aspx` 는 아직 상품이 아니다」 → 상품이다 + **`about/sale.aspx` 는 아니다** 추가
search-provider-01  PRODUCT_PAGE 1 → **6**(분모 6 불변) + 「403 이라 회수와 다르다」 주석
core-same06         증거 fixture 등록(미분류 0 유지)
```

**🔵 다음 — SP-14(1-hop 활성화 여부)는 CPO 가 연다.** 🔴 CTO 는 열지 않았다.
