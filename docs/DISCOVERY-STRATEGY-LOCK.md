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
APIFY AS SEARCH PROVIDER = HOLD (기존 Candidate URL 계약 통과 0/6)
DISCOVERY CORE = HOLD           (blocker 가 B → **C 의 URL 분류기** 로 «이동» 했다)
```

🔵 **CPO 결정 필요 3**:
① `classifyUrlShape` 과매치 수정을 **열 것인가**(WU-052 HOLD 해제 · 이 PoC 가 새 증거다)
② farfetch 류 **JS 렌더 사이트**를 공급원으로 볼 것인가(현재 PLAIN_HTML 로는 못 읽는다)
③ Query Planner 질의 **폭**(따옴표 2개 → 결과 7건) — 넓힐지 여부
