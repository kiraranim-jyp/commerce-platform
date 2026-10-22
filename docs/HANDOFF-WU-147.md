# 🔵 WU-147 — **Unified Same-Product Discovery** (STEP 0~3 조사 완료 · 구현 0)

> 🔴🔴 **운영 코드 변경 0 · MI 변경 0 · DB 0 · UI 0 · 배포 0.** 작업트리 clean.
> 🟢 STEP 0 Frozen 전수 준수(threshold · NO_TITLE_OVERLAP · MODEL_CODE ·
> AUDIENCE_LINE · GARMENT_FORM · SAME/DIF 판단축 · `price_alerts` · 가격 계산 ·
> 추천 판매가 · 등록 · UI 추가 — **하나도 건드리지 않았다**).
>
> 🔴🔴 **STEP 4/5 라이브 측정은 «하지 않았다»** — 용량 판단(§4-C). 이 문서는
> **다음 세션이 조사 없이 STEP 4 하니스부터 바로 들어가도록** 쓴 것이다.

---

## 🟢🟢 STEP 1 의 답 — **Discovery 는 이미 하나다.** 전제가 반쯤 틀렸다

🔴 CPO 질문: 「국내와 해외가 **왜 서로 다른 candidate discovery pipeline** 을 타고 있는가?」
🟢 **코드 실측 답: 서로 다른 pipeline 이 아니다.** 두 함수가 **같은 파일**에 있고
(`packages/crawler/src/comparison-search/index.ts` — 해외 `:232` · 국내 `:406`)
**같은 단계·같은 계약·같은 점수기** 를 쓴다.

| 단계 | 해외 `searchOneShop`(:201) | 국내 `searchOneDomesticShop`(:266) |
|---|---|---|
| 어댑터 조회 | `findPriceSourceAdapter(domain, **"OVERSEAS"**)` | `findPriceSourceAdapter(domain, **"DOMESTIC"**)` |
| 없으면 | `unsupported` · **요청 0** | `unsupported` · **요청 0** |
| 자격증명 | `adapter.readiness()` → `not_configured` | 🟢 **같다** |
| 검색 | `adapter.search({ term, currency })` | 🟢 **같다** |
| 점수 | `withConfidence(query, candidates)` | 🟢 **같다** |
| 가격 보강 | `adapter.enrichScored` | 🟢 **같다** |
| 반환 타입 | `ComparisonSearchResult` + `ComparisonCandidate[]` | 🟢 **같다** |

🔴 **국내만 다른 것은 «둘» 이고 둘 다 알고리즘이 아니다**:
```
⒜ `collectionStrategy !== AUTO_API && !== AUTO_SCRAPE` → unsupported  (:271)
   🔴 해외엔 이 게이트가 없다 — 등록부 «테이블» 이 다르기 때문이다
      (국내 `domestic_price_sources` 에 그 칸이 있고 해외 `comparison_shops` 엔 없다)
⒝ 국내만 **검색어 사다리** 를 돈다(`query.searchTerms`) + `crossSellerVerdict==="SAME"`
   확정 시 break (:330~350). 해외는 `query.title` **하나** 로 1회만 검색한다
   🟢 즉 국내가 **더 많이** 시도한다 — 「국내가 덜 찾는다」는 이 구간에서는 사실이 아니다
```

---

## 🟢🟢 STEP 2 의 답 — **Candidate Contract 는 «이미» 통일돼 있다**

🔴 CPO 요구: 「국내라고 별도 후보 객체, 해외라고 별도 후보 객체를 만들지 않는다 ·
**시장만 property** 다」.
🟢 **그것이 현재 코드 상태다** — 두 경로가 **같은 `ComparisonCandidate`** 를 내고
`url · title · image · domain · currency · brand · modelCode · confidence ·
crossSellerVerdict · priceSource …` 를 공유한다. **국내 전용 후보 타입은 없다.**
🔴 ⟹ **STEP 2 는 구현할 것이 없다**(이미 충족). 새 계약을 만들면 **지금 있는 하나를 둘로 쪼개는 것** 이다.

🟢 그리고 합류 지점도 **이미 하나** 다 — `run-domestic-price-check.ts` 가 다섯 생산자를
**같은 배열**(`searchResults` / `transientPools`)로 모아 **같은 `judgeDomesticCandidate`**
에 넣는다(WU-130 이 해외 자동검색을 `__overseas_auto__` transient 로 합류시킨 그 구조):
```
① 국내 등록부   searchDomesticShops          (:1011 · :1014)
② 해외 등록부   collectOverseasAutoPool      (:1006) → shopId 를 `__overseas_auto__` 로 갈아 넣는다
③ AI URL       collectUrlCandidatePool      (:1128)
④ 재투입       collectUrlCandidatePool      (:1174 · `__reviewed_same__`)
⑤ Gemini       collectGeminiCandidatePool   (flag OFF)
⟹ 🟢 **MI 엔진은 이미 «하나» 다.** 「나중에 MI 에서 합치기」가 아니라 **입력이 한 배열** 이다
```

---

## 🔴🔴🔴 STEP 3 의 답 — **Registry 는 지금 «discovery ceiling» 이다.** 그리고 **divergence 지점은 «한 곳» 이다**

```
packages/crawler/src/comparison-search/price-source-adapter.ts:480
  const ADAPTER_BY_DOMAIN = new Map(PRICE_SOURCE_ADAPTERS.map((a) => [a.domain, a]));
:482 findPriceSourceAdapter(domain, catalog) =
  ADAPTER_BY_DOMAIN.get(domain) 의 **catalog 가 일치할 때만** 반환
```

🔴🔴 **그래서 `market` 이 「candidate 의 property」가 아니다 — «어댑터 등록부의 키» 다.**
한 도메인은 **catalog 하나만** 가질 수 있다(Map 키가 domain 이고 `catalog` 가 단일 값).
⟹ CPO 가 느낀 「국내/해외가 서로 다른 시스템」의 **실체가 정확히 이 한 줄** 이다.

🟢 **등록부 전수(실측 · `PRICE_SOURCE_ADAPTERS`)**:
```
OVERSEAS **13** = Shopify suggest 11(junioredition · nickis · isolabellakids ·
   petitemaisonkids · shoppiccoliandco · kidswearcollective · kidsatelier ·
   designerkidswear · kidbizkid · villagekids.co.uk · folkberlin)
   + childrensalon.com + rakuten.co.jp(🔴 NOT_CONFIGURED ⟹ 실효 **12**)
DOMESTIC  **8** = looxloo · bobochoses · rulii · skysport · deuxbebe ·
   littleluna · chocoel · foretforet
   🔴 skysport = **TENNIS** · 🔴 bobochoses = 등록부 **disabled** ⟹ 아동의류 실효 **6**
⟹ 🔴🔴 **해외 12 : 국내 6.** 그리고 국내 등록부 34곳 중 **26곳은 어댑터가 없다**(WU-115 실측)
```

🟢🟢 **그래서 「3일 동안 국내가 안 살아나는」 원인은 MI 도 UI 도 pipeline 분리도 아니다 —
어댑터 등록부의 (domain, catalog) 키 하나다.** 🔴 WU-115 가 이미 반사실로 증명했다:
MANUAL 샵에 `AUTO_SCRAPE` 를 **세워도** 후보가 **0** 이었다(막는 것은 전략이 아니라 **어댑터 부재**).

🔴 **그러나 이번에 Registry 를 확장하지 않았다**(STEP 3 명시 · §12-0 금지축) —
확장은 **CPO 결정** 이다. 🟢 대신 **그것이 ceiling 이라는 사실을 숫자로 확정** 했다.

---

## 🔴🔴🔴 그리고 **CEO 가 화면에서 본 중복은 MI 산출이 «아니다»** (별 원인)

🔴 CEO 관찰: 「해외 후보 7건 → 해외 동일상품 참고가격 → 판단 근거 → **아래에 다시
시장가격 비교 → 다시 해외 후보 24건 → 동일상품 추정/유사상품 15건**」.

🟢 **출처를 코드로 특정했다 — 자기 검색을 돌리는 레거시 패널 둘이다**:
```
apps/admin/src/app/pipeline/CommerceWorkspace.tsx:3884  <DomesticShopSearch …/>
                                              :3900  <ComparisonShopSearch …/>
  DomesticShopSearch:188    POST **/api/domestic-price-sources/search**   ← 자기 검색
  ComparisonShopSearch:227  POST **/api/comparison/search**              ← 자기 검색
  🔴 그 둘은 `mayShowCandidate`(match-display:248)로 **자기 게이트** 를 쓴다 —
     PRESUMED_SAME·SIMILAR 통과 · 품절/가격검증 **안 봄**
  🔴 그리고 그 둘은 `▸ 판단 근거`(패널 소유) **밖** 이다 — 워크스페이스가 직접 렌더한다
⟹ 🔴🔴 **그래서 「위 숫자와 아래 숫자가 다르다」** — 두 숫자는 **다른 집합 · 다른 게이트** 다.
   위는 `/check` 의 MI verdict(SAME·판매중·가격확인), 아래는 **클라이언트 자기 검색** 이다.
🟢 WU-132 가 이 구조를 발견해 적어 뒀고(그래서 `MarketPriceComparison` 이 생겼다)
   🔴 **그 두 패널을 제거하지는 않았다** — 「원자료 드릴다운」으로 남겼다.
```

🔴🔴 **STEP 7(「후보 7건/24건/15건 같은 숫자를 주 결과에서 제거」)의 실제 작업 대상이
바로 이 둘이다.** 🔴 CTO 가 제거하지 않았다 — 그 둘은 `wu-056r1` · `mi-022` ·
`wu-130 F-3` 계약이 보고 있고, **제거는 계약 셋을 동시에 갱신** 해야 한다(CPO 범위 결정).

---

## 🔴 STEP 5 — 「처음 갈라지는 지점」 (코드 기준 확정 · 라이브 미측정)

```
GT URL
  ↓
🟢 ③ AI URL 풀 · ④ 재투입   — market 무관 · **동일 경로**(국내/해외 차이 0)
  ↓
🔴 ①② 등록부 검색          — **여기서 처음 갈린다**
     findPriceSourceAdapter(domain, "DOMESTIC") → 8개(아동 실효 6)
     findPriceSourceAdapter(domain, "OVERSEAS") → 13개(실효 12)
     ⟹ 등록부 밖 도메인은 **요청 0 · unsupported** (국내 34곳 중 26곳)
  ↓
🟢 canonical · withConfidence · judgeDomesticCandidate · MI verdict — **완전히 동일**
  ↓
🟢 classifyCandidateMarket — KR 증거는 `.kr` TLD + 등록부 둘뿐(WU-020 계약)
  ↓
🟢 sale · price · 집계 · 화면 — 동일
```

🔴🔴 **그러므로 CPO 의 두 분기 중 답은 전자다**:
```
🟢 「KR ❌ Registry gate / OVERSEAS 🟢 candidate」  ⟸ **이쪽이다(코드 기준)**
🔴 「KR candidate 🟢 … MI 에서 KR SAME ❌」        ⟸ 🔴 **단, 이것도 «같이» 참이다**
```
🔴 **둘을 섞지 않는다** — WU-138 이 국내 human SAME 2건을 **AI URL 경로로** MI 까지
올렸고 거기서 `BRAND_MISMATCH`·`NO_TITLE_OVERLAP`·`BRAND_UNCONFIRMED` 로 막혔다.
⟹ 🔴 **국내는 «두 군데» 에서 막힌다** — ⒜ 등록부에 없어서 **후보가 안 생기고**(26/34)
⒝ 생긴 후보는 **MI 축** 에서 막힌다(분모 2 · 완화 REJECT).
🔴 **「divergence 지점이 하나」로 적지 않는다** — 그렇게 적으면 ⒝ 가 사라진다.

---

## 🟢🟢 STEP 4/5 — **측정 완료.** 그리고 전제가 «또» 뒤집혔다 (2026-10-22)

🟢 하니스 `wu-147-discovery-divergence.test.ts` — **HTTP 0 · DB 0 · 게이트 없이 항상 돈다**
(`findPriceSourceAdapter` 는 순수 Map 룩업이다 · GT 는 fixture 에서 **직접 읽는다**).

🔴🔴 **기존 funnel 하니스가 이 칸을 못 쟀던 이유를 먼저 적는다** —
`wu-138-domestic-funnel` · `wu-138-same-funnel` 은 GT URL 을 `collectUrlCandidatePool`
(= **AI URL 풀**)로 넣는다 ⟹ 그 경로는 **등록부·어댑터를 거치지 않는다**(URL 을 직접 받으니까).
그래서 그 하니스들은 **MI 축만** 쟀고 「등록부 검색이 그 판매처를 뒤질 수 있었는가」는
**한 번도 측정되지 않았다.** 🟢 이번에 그 칸을 처음 쟀다.

```
GT **36건**(고유 URL · wu-112 + wu-125) · human SAME **24** · DIFFERENT **10**

DOMESTIC  human SAME  **2**  → 어댑터 O **0** · X 2   (beaumonde.co.kr · biskuit.kr)
OVERSEAS  human SAME **22**  → 어댑터 O **3** · X 19
   🟢 O 는 `junioredition.com` **3건뿐**
   ⚠ `bobochoses.com` **2건** 은 **다른 catalog 에 어댑터가 있다**(DOMESTIC) ⟹ 단일 키가 막았다
human DIFFERENT 10 → 그중 어댑터 O **1** (🔴 어댑터를 늘리면 이쪽도 같이 들어온다)
등록부 전수 — DOMESTIC **8** · OVERSEAS **13**
```

🔴🔴🔴 **그래서 어댑터 게이트는 «국내/해외 divergence 지점이 아니다»**:
```
국내 0/2 (0%)   해외 3/22 (13.6%)
⟹ 🔴 **어댑터 ceiling 은 양쪽을 거의 같게 막는다.** 「해외는 별도 검색기가 후보를
   만들어 주고 국내는 제약이 많다」는 전제가 **이 숫자로 반증된다.**
🟢 해외가 화면에 후보를 많이 내는 이유는 **등록부 검색이 아니다** —
   **AI URL 풀 + `__overseas_auto__` transient** 다.
🔴 그리고 그 비대칭은 **WU-118 이 이미 측정** 했다 —
   AI 답변 URL 중 **국내 6개·4개** vs **해외 30개·25개.** ⟸ **이것이 진짜 공급 비대칭** 이다
```

### 🔴 STEP 6 Case A — **성립하지 않는다**(측정으로 기각)

CPO 가 고정한 우선순위를 **순서대로** 대조했다:
```
① 기존 adapter 가 그 domain 을 처리할 수 있는가
   🔴 아니다 — 등록된 8개는 **전부 사이트 전용 파서**(`searchLooxloo`·`searchRulii` …).
      biskuit.kr(Cafe24) · beaumonde.co.kr(`goods_view.php`)용 파서는 **없다**
② 동일 계열 adapter 재사용 가능한가
   🔴 아니다 — Cafe24/고도몰 **generic 파서가 등록부에 0개** 다(전부 도메인 1:1)
③ 기존 generic discovery 경로가 있는가
   🟢🟢 **있다 — `collectUrlCandidatePool`(AI URL 풀).** 그리고 그 경로가 **이미 이 GT 2건을
      MI 까지 올린다**(WU-138 이 전수로 측정했다: biskuit 는 PRESUMED_SAME · KRW 88,000 ·
      beaumonde 는 PRESUMED_SAME · market UNKNOWN)
⟹ 🔴🔴 **어댑터를 만들어도 이 GT SAME 2건은 «이미 도달해 있다»** — 어댑터 때문에
   사라지는 것이 아니다. ⟹ **Case A 의 「최소 확장」조차 불필요하다**
④ 그래서 최소 discovery 확장을 **하지 않았다**(CPO 금지: domain별 개별 예외 ·
   26개 일괄 생성 · Registry 대량 확장 — 2 도메인 전용 어댑터는 ①에 해당한다)
```

🔴 **`bobochoses.com` ⚠ 는 «수정 대상이 아니다»** — 그 호스트는 **원상품 자신** 이고
`isSelfReferenceCandidate` 가 올바르게 제외한다(WU-103/104 가 같은 것을 관측했다:
「bobochoses.com/ko-kr/… → 자기참조 제외」). 🟢 단일 catalog 키가 실재한다는 **구조적
사실은 계약으로 고정** 했고, **그 2건을 살리는 수정은 하지 않았다**(살려도 자기참조다).

### 🔴🔴 STEP 5 — 첫 divergence 확정 (국내는 «두 군데», 그 앞에 «하나» 가 더 있다)

```
① 🔴 **공급(AI URL)**        국내 6·4 : 해외 30·25  (WU-118 측정)   ← **첫 divergence**
② 🔴 **어댑터 게이트**        국내 0/2 : 해외 3/22    (이번 측정)     ← 양쪽 공통 · divergence 아님
③ 🔴 **MI 축**              국내 SAME 0(BRAND_* · NO_TITLE_OVERLAP · 분모 2 · 완화 REJECT)
🟢 ①②③ 사이의 모든 단계(canonical · withConfidence · judgeDomesticCandidate ·
   classifyCandidateMarket · sale · price · 집계 · 화면)는 **국내/해외가 동일** 하다
```

🔴🔴 **그러므로 이번 WU 에서 운영 코드를 바꾸지 않은 것이 결론이다** —
「첫 divergence 만 최소 수정」의 그 지점이 **① 공급** 이고, 공급을 늘리는 수단은
**AI 정책(Gemini flag · 비용) 또는 Registry 확대** 뿐이며 **둘 다 CPO 결정축** 이다.
🔴 **threshold 를 낮추거나 어댑터를 지어 국내 SAME 을 만들지 않았다**(CPO 명시 금지).

---

## 🟡 [기록] STEP 4/5 설계 (위에서 실행 완료)

🔴 **새 상품으로 테스트하지 않는다**(CPO) · **새 fixture 0** · GT 는 이미 있다:
```
국내 human GT   fixtures/wu-112-human-gt.json · wu-125-human-gt.json (URL 키)
                🔴 국내 human SAME 분모 **2**(biskuit.kr · beaumonde.co.kr)
해외 human GT   같은 fixture · B226AC009 13건 · B226AC010 11건
운영 함수 호출 순서(🔴 하니스가 이것을 그대로 베낀다 · §5-B)
  factsFromProductUrl → withConfidence → enrichCandidatePrices
  → attachMatchTruth → judgeDomesticCandidate → classifyCandidateMarket
  🔴 `judgeDomesticCandidate` 를 빼먹으면 verdict 가 과소 측정된다(여덟 번 걸린 함정)
기존 하니스 재사용  `wu-138-same-funnel.test.ts`(`WU_138_PROBE=1`) ·
                   `wu-138-domestic-funnel` — 🟢 **이미 이 funnel 을 돈다**
```

🔵 **STEP 5 표를 그 하니스에 추가하면 끝난다**(새 하니스 0):
```
| 단계                | KR | OVERSEAS |
| GT URL              |    |          |
| 등록부 진입(어댑터 O)  |    |          |   ← 🔴 이 줄이 이번 WU 의 핵심 숫자다
| candidate 생성        |    |          |
| MI 입력              |    |          |
| SAME                |    |          |
| 판매중               |    |          |
| 가격                 |    |          |
🔴 **열화 게이트를 반드시 넣는다** — 해외 샵 `outcomes.error > 0` 이면 funnel 을 내지 않고
   FAIL 한다(「측정불가」≠「0」 · WU-133 이 박아 둔 그 게이트).
```

🔴 **그 측정 뒤에도 CTO 가 열지 않는 것** — Registry 확장(CPO 결정) · MI 완화(CLOSED) ·
레거시 패널 둘 제거(계약 셋 동시 갱신 · CPO 범위).

---

## 🔴🔴 이번 WU 에서 «하지 않은» 것 (정직하게 적는다)

```
⒜ 🔴 **STEP 4/5 라이브 측정 0** — 용량 판단(§4-C)이다. 「코드로 divergence 를 특정했다」와
   「실제 GT URL 이 어디서 죽는지 세었다」는 **다른 증거** 다. 앞만 했다
⒝ 🔴 STEP 6(통합 구조 구현) **0** — 🟢 그런데 조사 결과 **통합할 것이 거의 없다**(STEP 1·2 가
   이미 하나다). 남은 통합 대상은 **어댑터 등록부의 catalog 키** 하나이고 **CPO 결정** 이다
⒞ 🔴 STEP 7(레거시 패널 둘 제거) **0** — 계약 셋(`wu-056r1`·`mi-022`·`wu-130 F-3`)을
   동시에 갱신해야 하고 CPO 가 범위를 열어야 한다
⒟ 🔴 국내 어댑터를 **하나도 만들지 않았다**(§12-0 금지축 · WU-115 와 같은 판단)
⒠ 🔴 `bobochoses.com` 이 **DOMESTIC catalog 인데 등록부 disabled** 인 모순은
   **건드리지 않았다**(그 도메인이 OVERSEAS 로도 등록될 수 없다는 사실만 기록)
```

🟢 **그래서 이 WU 가 CPO 에게 주는 것은 셋이다**:
```
① 🟢 「국내/해외가 서로 다른 pipeline 이다」는 **반증됐다** — 알고리즘·계약·MI 가 이미 하나다
② 🔴 갈리는 **단 하나의 구조적 지점** 을 코드 좌표로 확정했다 —
   `price-source-adapter.ts:480·482` 의 (domain → 단일 catalog) 키 · 해외 12 : 국내 6
③ 🔴 CEO 가 본 **화면 중복의 출처** 를 확정했다 — MI 산출이 아니라
   `CommerceWorkspace.tsx:3884·3900` 의 **자기 검색 패널 둘**(다른 API · 다른 게이트)
```
