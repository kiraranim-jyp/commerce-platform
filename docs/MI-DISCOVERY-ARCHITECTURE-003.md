# MI-DISCOVERY-ARCHITECTURE-003 FINAL — Production-safe Discovery Core 경계 설계

> 🔴 **설계 전용. 코드 변경 0 · DB 변경 0 · push 0 · deploy 0 · 가드 완화 0.**
> 🟢🟢 **핵심 결론: 4개 모듈을 benchmark 에 묶는 끈은 «`./types` 하나» 다.**
> 그 파일이 두 덩어리로 깔끔하게 갈리므로, **파일 이동이 아니라 `types.ts` 분할**
> 이 올바른 1수다. CPO 가 요구한 「공통 core」 구조가 **실측으로 성립한다.**

---

## 1. 현재 dependency graph (주석 벗기고 전수 측정)

| 모듈 | 상대 import | env | HTTP | DB | benchmark 내부 끈 |
|---|---|---|---|---|---|
| `query-generator.ts`<br>`generateQueries` | `./types` | 없음 | 🟢 없음 | 🟢 없음 | **`./types` 뿐** |
| `google-discovery.ts`<br>`createGoogleDiscoveryProvider` | `./supported-sellers` · `./types` | `GEMINI_API_KEY` · `GEMINI_MODEL` | 🔴 **있음** | 🟢 없음 | `./types` · `./supported-sellers` |
| `url-resolver.ts`<br>`resolveCandidate` | **`../comparison-search/url-shape`** · `./types` | 없음 | 🟢 없음 | 🟢 없음 | **`./types` 뿐** |
| `live-page-probe.ts`<br>`createLivePageProbe` | **`../rate-limit/domain-rate-limiter`** · **`../utils/user-agent`** · `./url-resolver` | 없음 | 🟢 없음* | 🟢 없음 | `./url-resolver` |

🟢 **패키지 import 가 넷 다 0 이다** — 외부 의존이 없다.
🟢 `url-resolver` 와 `live-page-probe` 는 **이미 Production 쪽을 가리킨다**
(`comparison-search/url-shape` · `rate-limit` · `utils/user-agent`) — 방향이 옳다.
🔴 `*` **보고 전에 실제로 확인했다** — `live-page-probe` 의 HTTP 수단은
`fetchWithDomainRateLimit`(`../rate-limit/domain-rate-limiter`)이고 `redirect:
"follow"` · `AbortSignal.timeout` 을 쓴다. 🟢 즉 **Production 공용 레이트리미터를
그대로 쓰는 구조** 라 Production-safe 하다. 🔴 내 정규식이 `fetch(` 만 봐서 놓쳤다.

### 🔴🔴 `supported-sellers.ts` 는 **이미 Production 을 import 한다**

```
supported-sellers.ts:1
  import { listPriceSourceAdapters } from "../comparison-search/price-source-adapter";
```
🟢 즉 그 파일은 benchmark→Production 방향(허용)이고, **Production-safe 하다.**

---

## 2. 🟢🟢 `types.ts` 가 두 덩어리로 «깔끔하게» 갈린다

`types.ts` 의 export 19개를 용도로 가르면:

| Discovery Core 가 필요한 것 (🟢 Production-safe) | benchmark 전용 (🔴 남겨야 함) |
|---|---|
| `ProductIdentity` | `GroundTruthVerdict` · `GroundTruthEntry` |
| `QueryId` · `DiscoveryQuery` | `GroundTruthState` · `JobGroundTruth` |
| `DiscoveredUrl` · `DiscoveryProvider` | `JobFixture` · `CurrentCandidateRow` |
| `ResolutionStep` · `ResolutionClass` | `CrawlerAdapter` · `MiAdapter` |
| `ResolvedCandidate` (🟢 `UrlShape` 경유로 Production 의존 — 허용 방향) | `FailureStage` · `BenchmarkCandidateResult` · `LaneResult` |

🟢 **왼쪽 9개는 「상품을 어떻게 찾고 URL 을 어떻게 해석하는가」** 의 계약이다.
🔴 **오른쪽 10개는 「정답표·픽스처·어댑터 주입·레인 결과」** — 측정 하니스 어휘다.
🟢 **섞여 있지 않다.** 그래서 분할이 기계적이다.

🟢 그리고 `types.ts` 는 이미 `../comparison-search/url-shape` 에서 `UrlShape` 를
받아 온다 — **Production 타입을 쓰는 구조가 이미 있다.**

---

## 3. 모듈별 판정 (CPO 가 준 4지 중 하나)

| 모듈 | 판정 | 근거 |
|---|---|---|
| `query-generator` | **① 그대로 Production core 로 이동** | 의존이 `./types` 하나 · HTTP 0 · DB 0 · env 0. **순수 함수** 다 |
| `url-resolver` | **① 그대로 이동** | 이미 `comparison-search/url-shape` 를 쓴다 · HTTP 0 · DB 0 |
| `live-page-probe` | **① 그대로 이동** | `rate-limit` · `utils/user-agent` 는 Production 공용. `url-resolver` 와 **같이** 움직인다(`PageProbe` 타입) |
| `google-discovery` | **③ Production용 wrapper 필요** | 🔴 외부 API 를 치고 **env 2개**를 요구한다. 키 없으면 `GoogleDiscoveryConfigError` 를 던진다 → 운영 경로가 그 예외로 죽으면 **가격 확인 전체가 깨진다**. 🟢 wrapper 가 「키 없으면 후보 0, 기존 동작 그대로」로 **fail-soft** 해야 한다 |
| `types.ts` | **② 공통 core 로 추출** | 위 §2 대로 **9개만** core 로. 나머지 10개는 benchmark 에 남는다 |
| `supported-sellers` | **④ benchmark 에 남겨도 된다** | 🟢 이미 Production 을 import 하는 방향이라 core 가 아니어도 문제가 없다. 🔴 단 `google-discovery` 가 이것을 쓰므로 core 로 옮길 때 **같이 보거나 인자로 주입**해야 한다 |

🟢 **CPO 가 제시한 목표 구조가 성립한다** — 「4개 파일을 통째로 이동」이 아니라
**`types.ts` 분할 + 3개 이동 + 1개 wrapper** 다.

---

## 4. Production Integration Point

`run-domestic-price-check.ts:726` 을 중심으로 확인했다.

```
현재
  const p0Results    = await searchDomesticShops(query, p0Sources.map(toRef));   :726
  const otherResults = … searchDomesticShops(query, otherSources.map(toRef))     :729
  const searchResults = [...p0Results, ...otherResults];                         :730
       ↓
  (샵별 루프) judgeDomesticCandidate({ … fetchModelCode })                       :817~
       ↓ JUDGED → priceTierFromLink → upsertDomesticProductLink
```

🟢 **합치는 자리는 `:730` 이다.** `searchResults` 가 `ComparisonSearchResult[]`
(샵 단위 묶음)이므로, Gemini 후보도 **같은 모양의 «가상 샵 결과» 한 건**으로
감싸 넣으면 그 뒤 파이프라인이 그대로 돈다.

### 🔴 합칠 때의 타입 계약 (실측)

```
ComparisonSearchResult = { shopId, shopName, domain, status, candidates[], error? }
ComparisonCandidate    = { title, url, price, imageUrl, confidence, facts?, … }
🟢 factsFromProductUrl 이 돌려주는 `candidate` 가 **이미 ComparisonCandidate** 다
   (product-url-facts.ts:57 주석: 「기존 MI 가 그대로 먹는 모양」)
→ 🟢 **타입 변환이 필요 없다.** Gemini 후보 N개를 한 `ComparisonSearchResult` 로
   묶어 `searchResults` 에 **append** 하면 된다.
🔴 단 `shopId`/`domain` 에 무엇을 넣을지가 §5 의 문제다.
```

---

## 5. Candidate 데이터 모델 문제 — 🔴 **일시 pool 로는 되고, 영구 저장은 막힌다**

```
🟢 판정까지는 «일시 Candidate Pool» 로 충분하다
   searchResults 는 메모리 배열이고 DB 를 거치지 않는다 →
   withConfidence · judgeDomesticCandidate · crossSellerVerdict 까지 **그대로 작동**
   (이번 트랙에서 SAME 3개 브랜드 재현이 그 증거다)

🔴 영구 저장은 막힌다 — `upsertDomesticProductLink` 가 `source_id` 를 요구하고
   그 칸은 **등록된 샵(`domestic_price_sources`)을 가리키는 FK** 다.
   Gemini 후보의 도메인(dinossi.us · hiveboutiques.com …)은 등록부에 **없다.**
```

### 🔴 그래서 구현 WU 는 둘로 갈라야 한다

```
구현 WU-1 (작다 · 안전)  「판정만」 — Gemini 후보를 pool 에 합쳐 verdict 를 «화면에»
  보여준다. DB 쓰기 0. 🟢 source_id 문제를 **건드리지 않는다**
구현 WU-2 (크다 · 설계 필요)  「저장」 — 해외 후보를 영구 저장한다.
  🔴 새 source semantics(가상 source 행?) ↔ 별도 table ↔ nullable FK 중 선택이
     필요하고 그것은 **Registry 의미 변경** 이다(CPO 가 금지한 영역).
```

🟢 **CPO 가 D 에서 요구한 분리가 성립한다** — 일시 pool 만으로 **가치의 대부분**
(SAME 판정 + 근거 표시)을 줄 수 있다.

---

## 6. 호출량 산정 — 🔴 **금액은 계산하지 않는다**

이번 WU 실측(상품 5개 · 후보 상한 3):
```
Gemini discovery 호출   5  → 상품당 **1.0**
query 수               상품당 **1** (queries[0] 만 썼다 — 🔴 다른 축은 미측정)
candidate 수           Gemini 가 준 raw = 6·0·20·0·12 → 상품당 평균 **7.6**
                       🔴 상한 3 을 적용해 실제 처리한 것은 상품당 **1.8**(9/5)
resolve 호출           9  → 상품당 **1.8**
fetch 호출            14  → 상품당 **2.8**
──────────────────────────────────────────────
🟢 상품 1회당 외부 호출 합계 = 1.0 + 1.8 + 2.8 = **5.6회**
```

### 497 상품 기준 (🔴 계산 가정 · 실적이 아니다)

| 주기 | 체크 수 | 외부 호출(×5.6) |
|---|---:|---:|
| 1회(전수 한 번) | 497 | **~2,783** |
| 3일 주기 · 월 | 4,970 | **~27,800** |
| 7일 주기 · 월 | 2,130 | **~11,900** |

🔴 **금액은 산출하지 않았다** — Gemini 요금을 CTO 가 읽을 수 없다(헌장 §10).
🔴 직전 보고의 「월 ~35,000」은 **거친 추정**이었다. 🟢 실측 기준 재산출값은
**3일 주기 월 ~27,800** 이다. 🔴 둘 다 **가정** 이고 상한 3 에 의존한다.

---

## 7. Architecture 변경 범위 (구현 WU 가 손댈 것)

```
🟢 새로 만든다
   packages/crawler/src/discovery-core/types.ts          ← types.ts 의 «9개» 만
   packages/crawler/src/discovery-core/query-generator.ts
   packages/crawler/src/discovery-core/url-resolver.ts
   packages/crawler/src/discovery-core/live-page-probe.ts
   packages/crawler/src/discovery-core/google-discovery.ts   (+ fail-soft wrapper)
   packages/crawler/src/discovery-core/index.ts           ← 배럴

🟡 고친다
   discovery-benchmark/types.ts        → core 9개를 **re-export** (나머지 10개 유지)
   discovery-benchmark/{query-generator,url-resolver,live-page-probe,google-discovery}.ts
                                       → core 를 re-export 하는 얇은 파일로
   🟢 benchmark → core 는 **허용 방향** 이라 기존 하니스가 한 줄도 안 바뀐다
   discovery-benchmark/__tests__/no-production-coupling.test.ts
     🔴 **완화하지 않는다.** `discovery-core` 를 허용 목록에 더하는 것이 아니라,
        Production 이 `discovery-benchmark/` 를 import 하지 않는다는 단정을
        **그대로 유지** 한다(core 는 다른 디렉터리이므로 가드가 그대로 통과한다)

🔴 건드리지 않는다
   threshold · SAME_MIN_AXES · scoring · ProductFacts · DB schema · Registry
```

---

## 8. 구현 WU 의 정확한 범위 — **변경 순서까지**

### 구현 WU-1 「Discovery Core 추출」 (DB 0 · 운영 동작 변화 0)

```
1. discovery-core/types.ts 신규 — types.ts 의 Core 9개를 «그대로 복사»
2. discovery-benchmark/types.ts → 그 9개를 core 에서 import 해 re-export
   🟢 이 단계에서 **기존 테스트가 전부 그대로 통과해야 한다**(동작 변화 0)
3. query-generator → core 로 이동 · benchmark 쪽은 re-export 1줄
4. url-resolver → core 로 이동 · 같은 방식
5. live-page-probe → core 로 이동 (🔴 url-resolver 와 «같은 커밋»)
6. google-discovery → core 로 이동 + createProductionGoogleDiscovery() wrapper
   🔴 wrapper 계약: 키 없음/예외 → **후보 0 을 돌려주고 throw 하지 않는다**
7. discovery-core/index.ts 배럴
8. 회귀 — 전체 vitest · 전 패키지 typecheck(baseline 10 과 비교)
🔴 이 WU 는 **운영 호출부를 추가하지 않는다.** 순수 리팩터다.
```

### 구현 WU-2 「후보 pool 합류」 (DB 0 · 🔴 운영 동작 변화 있음)

```
9.  run-domestic-price-check.ts:730 에서 Gemini 결과를 searchResults 에 append
    🔴 feature flag 로 감싼다(기본 OFF) — 켜는 것은 CPO 결정
10. shopId/domain 에 무엇을 넣을지 확정 (저장하지 않으므로 가상값 허용)
11. 저장 경로 분기 — `source_id` 가 없는 후보는 **upsert 하지 않는다**(일시 pool)
12. 회귀 + negative test(키 없음 · Gemini 예외 · 후보 0 · 저장 스킵)
```

### 구현 WU-3 「영구 저장」 — 🔴 **설계 미정 · 이번에 범위를 정하지 않는다**
`source_id` FK 의미 변경이 필요하다. Registry 의미 결정 영역이다.

---

## 9. Production 변경 — **0**
코드 0 · DB 0 · push 0 · deploy 0 · 가드 완화 0 · threshold 0.
🟢 이 WU 에서 쓴 것은 **문서 한 파일** 이다.

## 10. Known Unknowns

```
🟢 (해소) `live-page-probe` HTTP 수단 = `fetchWithDomainRateLimit` +
   `redirect:"follow"` — **Production 공용 유틸** 이다
🟢 (해소) core 타입 **8개가 benchmark 전용 11개를 하나도 참조하지 않는다**
   (선언 블록 전수 검사). 🔴 단 `ResolutionClass` 는 `UrlShape`(Production)를
   참조하므로 core 가 **comparison-search 를 의존** 한다 — 허용 방향이다
🔴 상품당 호출 5.6회는 **후보 상한 3** 에 의존한다. 상한을 올리면 선형으로 는다
🔴 query 축을 **1개(queries[0])** 만 썼다. 다른 축을 쓰면 호출량과 후보 수가 바뀐다
🔴 `google-discovery` wrapper 의 fail-soft 계약은 **설계안** 이고 구현·검증 전이다
🔴 Gemini 금액은 측정불가(§10) — 호출 수만 냈다
🔴 `searchResults` 에 append 할 때 **샵별 `isBatchSurveyTarget` 필터를 우회**하게
   되는데, 그것이 category scope 정책과 충돌하는지 **미검토**
```
