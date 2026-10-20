# WU-130 — 국내+해외 자동 후보 공급 **합류 완료** (①②③④ · 구현/배포)

> 🔴🔴 **CPO 정정 반영(2026-10-20)**: ①에서 멈추지 않고 **국내까지 같은 최종 경로로**
> 확인·수정하고, 국내+해외가 **하나의 영역** 에서 자동으로 나타나는 상태까지 닫았다.
>
> 🔴 **아래 §1~§9 는 ①(해외 합류)의 기록이고, §A~§E 가 ②③④ 다.**

> 🟢 **결과 한 줄** — 셀러가 **아무것도 붙여넣지 않아도** 해외 동일상품 후보가
> `/check → MI 판정 → 해외 금액 집계` 까지 **실제로 간다**(실측으로 확인).
>
> 🔴 **CTO 가 「동일상품이다」를 확정하지 않았다.** 산출된 판정은 운영 MI 의 값이고
> SAME/DIFFERENT 는 CEO 육안 GT 의 몫이다(§00-B).

---

## 1 Scope

```
⒜ transient-candidates.ts      일시 샵 세 번째(`__overseas_auto__`) 추가 · 술어 하나 유지
⒝ overseas-auto-pool.ts(신규)   `/api/comparison/search` 가 쓰는 네 함수를 같은 순서로 부른다
⒞ run-domestic-price-check.ts   `searchResults` 합류(병렬) + evidence 출처 **세 번째 가지**
⒟ check/route.ts               그 배열을 `computeMarketIntelligence` 에 **같이** 넘긴다
UI                             🌎 해외 자동검색 후보 구역 + 출처 배지 + 요약 반영
```

🔴 **하지 않은 것** — MI 8축 · threshold · SAME/PRESUMED 기준 · 가격 계산/판정 ·
`domesticTransientRecords` · `candidateDomesticPrice` · `computeMarketAlert` ·
Registry 확대 · 새 adapter · schema/migration · 외부 AI/Gemini · 새 검색 provider ·
`priceStatus` 정책 · 가격 집계 조건 · UI 가격 표시 · 「붙여넣기」 UI 제거(③은 ② 뒤다).

## 2 🔴🔴🔴 합류 전에 확정한 **파괴적 함정** (이것 때문에 설계가 이 모양이다)

```
`searchComparisonShops` 의 shopId 는 **`comparison_shops` 의 실제 uuid** 다.
그 값을 `/check` 후보 루프에 그대로 넣으면 루프가 「등록된 국내 샵」으로 보고
`upsertDomesticProductLink` 를 부른다 ⟹ **해외 판매처가 «국내» 링크 테이블에 저장된다**
(`domestic_product_links.source_id` 는 `domestic_price_sources` FK).
🔴 번지는 범위 — ⒜ FK/의미 오염 ⒝ 국내 최저가·판정 입력 오염 ⒞ `price_alerts` 오발화.
🟢 그래서 `collectOverseasAutoPool` 이 **shopId 를 일시 id 로 갈아** 넣는다 —
   `isTransientShopId()` 가 upsert «앞» 에서 끊는다 ⟹ **오염이 구조적으로 불가능.**
🔴 계약 A-1/A-2 가 그 한 줄을 잠근다(지우면 **2건 FAIL** · 실측).
```

## 3 조사 결과 — 합류 전 실측 2건 (추측 금지 · 실제로 돌렸다)

```
① `searchComparisonShops` 반환 모양  🟢 `ComparisonSearchResult`
   (`shopId`·`shopName`·`domain`·`status`·`candidates`) — 국내 루프가 읽는 칸과 동일
   🟢🟢 **그리고 `searchOneShop` 안에서 `withConfidence` 가 이미 돈다** —
        반환 후보의 `matchLevel` **4/4** 채워짐 · `priceStatus` 도 채워짐
   ⟹ 🔴 그래서 `transientPools`(재점수 + `enrichCandidatePrices`) 로 **보내지 않았다**.
      보내면 **같은 일을 두 번** 하고 HTTP 비용이 늘어난다(계약 C-2 가 잠근다)
② 해외 도메인에 국내 품번 추출기가 발화하는가  🟢 **null 4/4**
   (`DOMESTIC_IDENTIFIER_EXTRACTORS` 는 `foretforet.com`·`bobochoses.com` **둘뿐**)
   🔴 단 `bobochoses.com` 은 그 등록부에 **있다** — 공식몰이라 URL 에서 품번을 읽는 것이
      정답이고, 기존 두 transient 생산자도 **이미 같은 경로** 를 탄다(새 성질이 아니다)
```

🟢 **추가 확정 — 해외 비교 등록부에 KR 오염원이 없다**(DB 실측 35행):
`.kr` TLD **0** · `currency = KRW` **0** ⟹ `classifyCandidateMarket` 이 그 후보를
국내 축으로 올릴 경로가 없다. `bobochoses.com` 만 국내 등록부에도 있는데 가격이 EUR 라
**충돌 → UNKNOWN** 이 되어 어느 금액 축에도 안 들어간다(WU-019R 실측과 동일).

## 4 🔴🔴 왜 이 WU 가 필요했나 — **해외 검색은 이미 돌았는데 MI 에 닿지 않았다**

```
`ComparisonShopSearch` → `useCollectOnce` → POST `/api/comparison/search`
  ⟹ 🟢 해외 후보는 **이미 자동으로** 조회되고 표에도 보인다
  ⟹ 🔴 그런데 그 결과는 **브라우저에만** 있고 `judgeDomesticCandidate` 를 통과한 적도,
       `candidateOverseasPrice`(= 「🧾 해외 동일상품 참고가격」)에 들어간 적도 **없다**
  ⟹ 🔴 그 구역은 **셀러가 URL 을 붙여넣을 때만** 채워졌다 — 그것이 이번에 닫힌 구멍이다
```

🔴 **대가를 적는다 — 지금은 해외 검색이 «두 번» 돈다**(브라우저 1 + `/check` 서버 1).
🟢 비용은 HTTP 뿐이다(유료 provider 0 · Rakuten 은 `not_configured`). 🔴 한쪽을
없애는 것은 **④「시장 가격 비교」 통합** 에서 owner 가 하나가 될 때의 일이다 —
지금 지우면 셀러가 보던 해외 표가 사라진다.

## 5 구현 결과 (운영 4 파일 + 신규 1 · UI 2)

```
⒝ overseas-auto-pool.ts — **얇다.** 검색 로직 0 · 판정 로직 0
   listComparisonShops() → isActive && isCollectableAccess && sourceFitsScopes
   → searchComparisonShops() → **shopId 만** 교체 · `domain` 은 그대로
   🔴 scope 를 **다시 계산하지 않는다** — 호출부(`resolveMarketCategoryScopes`)가 준 값을 받는다
      (그 함수가 `/api/comparison/search` 의 `selectedMarketSourceScopes ?? 자동추정` 과 **같은 규칙** 이다)
⒞ 합류 — `[...p0Results, ...otherResults, ...(overseasAuto?.searchResults ?? [])]`
   🟢 **병렬** 이다(국내 검색 앞에서 promise 를 띄운다) ⟹ 벽시계 추가 ≈ 0(실측 해외 1회 3.1초)
   🟢 실패해도 국내 경로를 멈추지 않는다(`.catch(() => null)` → metrics `null`)
```

🔴 **합류 위치가 만든 변화 둘을 적는다**(숨기지 않는다):
```
🟢 이득 — 중복 집합(`existingCanonicalUrls`·`existingUrls`)이 해외 후보를 **같이 본다**
   ⟹ 붙여넣은 URL 이 이미 자동으로 찾아진 후보면 `ALREADY_CANDIDATE` 로 빠지고 HTTP 0
🔴 대가 — Gemini 게이트의 `deterministicHit` 가 이제 해외 후보의 `very_high` 도 본다
   (= Gemini 를 더 자주 건너뛴다). 🟢 flag **OFF** 라 **현재 효과 0** 이고, 조건의 뜻
   (「결정적 후보가 이미 있으면 안 부른다」)은 그대로다
🟢 국내 검색 «범위» 는 불변 — `foundVeryHighInP0` 는 합류 **앞** 에서 국내 결과만으로 확정된다
   (계약 C-5 가 그 순서를 잠근다)
🔴 그리고 해외 샵의 `status:"error"` 가 이제 `domesticShop.sourceErrors` 에 실린다
   (`해외 자동검색(일시) · {domain}: {사유}`). 실측 30곳 중 **1건**. 🟢 `unsupported`(20)·
   `not_configured` 는 **조용히 건너뛴다**(기존 루프 규칙 그대로)
```

## 6 🟢🟢 E2E 실측 — **운영 함수를 같은 순서로** 돌렸다 (게이트 `WU_130_PROBE=1`)

🔴 로컬에서 `runDomesticPriceCheck` 전체는 못 돈다(`listDomesticPriceSources` 가
service-role 요구 · 헌장 §10). 그래서 **합류 이후 구간의 운영 함수들** 을 운영과
같은 순서로 불렀다 — `collectOverseasAutoPool`(검색은 **실제 HTTP**) →
`judgeDomesticCandidate` → `priceTierFromLink` → `classifyCandidateMarket` →
MI 해외 가지와 **같은 레코드** → `summarizeCandidateOverseasPrices`.

원상품 = `bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt`
(🔴 `b226ac010` 스냅샷은 **DB 에 없다** — 「S1 없음」이 실측값이다).

```
등록부 35 → 자격 30 → outcomes { unsupported 20 · ok 9 · error 1 } → 후보 22
판정 도달 5샵 — JUDGED **2** · DROPPED **3**(전부 `EVIDENCE_NOT_WORTHWHILE`)
  junioredition.com   PRESUMED_SAME · TEXT_CONFIRMED · tier COMPARISON · GBP 37   · VERIFIED_CURRENT
  villagekids.co.uk   PRESUMED_SAME · TEXT_CONFIRMED · tier COMPARISON · GBP 21.2 · UNVERIFIED_SEARCH
🟢🟢 🧾 해외 동일상품 참고가격 = { count 2 · GBP { count 2 · lowest **21.2** } ·
     byMarket { OVERSEAS 2 } · byPriceTier { COMPARISON 2 } }
🟢 산출물의 shopId **전건 `__overseas_auto__`**(등록부 uuid 0) · providerCalls **0**
```

🔴🔴 **그 숫자를 넘겨 읽지 않는다 — 세 가지를 갈라 적는다**:
```
① 🔴 두 건 다 **PRESUMED_SAME(보류)** 이고 tier `COMPARISON` 으로 금액 집계에 들어간다.
   🔴 그것이 WU-123/125 가 지적한 **그 모양** 이다(보류 4/4 가 Human DIFFERENT 였다).
   🟢 **내가 만든 규칙이 아니다** — 기존 집계 조건이고 §00-B 로 **가격 단계 보류** 다
② 🔴 최저가 GBP **21.2** 의 `priceStatus` 가 **`UNVERIFIED_SEARCH`** 다 ⟹ WU-111 이
   기록한 「집계는 priceStatus 를 안 보고 UI 는 VERIFIED 만 숫자를 낸다」 모순이 **재현** 된다.
   🟢 WU-110 과 **같은 모양** 이다 — 이번 합류가 **만든 것이 아니라 드러낸 것** 이고,
   🔴 고치지 않았다(가격 정책 · CPO 판정 사안)
③ 🔴 **DROPPED 3건은 기존 ⑧ 게이트** 다(`isEvidenceEvaluationWorthwhile`). WU-112 에서
   그 게이트가 Human SAME 3건을 버린 것이 측정됐지만 **그 축은 이 WU 범위가 아니다**
```

🔴 **측정 한계** — 표본 **원상품 1개** · 해외 검색 1회 · `isRegisteredDomesticShop` 를
로컬에서 읽을 수 없어 **`false` 로 넣었다**(해외 도메인이라 운영값과 같지만 `bobochoses.com`
이 ok+후보로 올라오는 경우는 미측정) · 그리고 **실제 따져 화면은 CTO 가 볼 수 없다**.

## 7 Positive / Negative / Mutation / Regression

```
계약 **22**(`wu-130-overseas-auto-pool.test.ts` · 네트워크 0 · DB 0)
  A 생산자 8 — shopId 교체 · domain 보존 · 세 필터 · 후보 무변경 · 계측 정직 ·
              자격 0 이면 호출 0 · 저장/AI 어휘 0 · scope 재계산 0
  B 저장차단 2 · C 배선 6 · D 화면 6
음성 대조 **7종 전부 FAIL → 복구 후 전건 PASS**(적용 여부를 grep 으로 확인했다):
  M1 shopId 교체 제거            → **2 FAIL**(A-1 · A-2 깊이방어)
  M2 접근차단 필터 제거          → 1 FAIL (A-3)
  M3 `searchResults` 합류 제거   → 1 FAIL (C-1)
  M4 MI 입력에서 제거            → 1 FAIL (C-3)
  M5 출처 삼분기 → 이분기        → 1 FAIL (wu-024 D · + C-3b 로 보강)
  M6 UI 구역 렌더 제거           → 1 FAIL (D-4)
  M7 `transientPools` 로 보냄    → 1 FAIL (C-2)
회귀 **606 files / 8,429 passed · failed 0** · typecheck **0** · build exit **0**
```

🔴 **기존 계약 3건이 FAIL 했고 셋 다 «의도된 변경» 이라 앵커를 갱신·강화했다**:
```
wu-024 C 「일시 샵이 둘」      → **집합 전수를 돌려** 잠갔다(숫자만 고치는 길을 없앴다)
wu-024 D 「출처 이분기」       → 세 id ↔ 세 배열 **대응** 과 「세 배열이 다른 변수다」까지 본다
mi-022 ⑥ 「krRows 파생」       → 세 입력이 **전부** 들어가야 한다(하나 빠지면 KR 후보가 조용히 사라진다)
```

## 8 🔴 [**낡음 — §A~§G 가 이긴다**] ①을 닫은 시점의 「남은 것」 기록

> 🔴🔴 **아래 네 줄은 ① 직후의 상태이고 지금은 ②③④ 가 전부 끝났다.**
> 🟢 현재 상태는 **§A~§G** 다. 이 절은 「그때 순서를 왜 그렇게 잡았는가」의 기록으로만 남긴다.


```
② CEO 가 **배포된 따져 화면** 에서 「아무것도 붙여넣지 않고 후보가 뜨는가」 확인  ← 다음
③ 「+ AI 조사 결과 붙여넣기」 **사용자 UI 제거**  🔴 지시서가 「②가 확인된 뒤」로 고정했다
   (먼저 지우면 화면이 완전히 비어 보인다 · 파서는 보존)
④ 🇰🇷/🧾 두 참고가격 **표시 구역 제거** → 「시장 가격 비교」 한 구역으로
   🔴 계약 `wu-056r1-price-section-identity` 갱신을 **동반** 한다
```

## 9 [**낡음**] ① 시점의 CEO Action — 🟢 최종본은 **§G** 다

---

# §A ② 🇰🇷 **국내 자동검색 전수 확인 — 코드 수정 지점이 «없다»**

🔴 CPO 질문: 「국내 자동검색이 실제로 `/check → MI → sink → 시장 가격 비교` 까지
제대로 들어가는지 **전수 확인**」. 🟢 운영 함수로 두 상품을 돌려 답했다.

## A-1 🔴🔴 먼저 — **국내는 sink 를 타지 «않는다». 그것이 결함이 아니다.**

```
🇰🇷 국내 등록부 후보  shopId 가 **실제 uuid** → `isTransientShopId` false
   → `upsertDomesticProductLink` → `domestic_product_links`(영속)
   → GET `/api/price-history` → **`domesticCompetition`(권위 집계)** + 후보 목록
🌎/AI 일시 후보       shopId 가 일시 → sink → `candidateOverseasPrice`/`candidateDomesticPrice`(참고 축)
🔴🔴 그래서 국내 등록부 후보를 **sink 에 넣으면 «이중 집계» 가 된다**
   (`domesticCompetition` «그리고» `candidateDomesticPrice`) ⟹ 가격 오염 · 금지
🟢 계약 E-3 이 그 경계를 잠근다(sink push 는 일시 샵 가드 «안» 에 **하나**).
```

## A-2 🟢 실측 — 국내 경로는 **돌고 있다** (운영 함수 · 두 상품 · 실제 HTTP)

```
                          S1 B226AC042            S2 B226AC009
등록부                     34                      34
이 workspace 가시           34                      34
isBatchSurveyTarget 통과    **18** (AUTO_* 6)       **18** (AUTO_* 6)
검색 status                {ok 6 · unsupported 12} {ok 6 · unsupported 12}
🟢 후보                     **15**                  **5**     ← 전부 looxloo.com
judgeDomesticCandidate     DROPPED/EVIDENCE_NOT_WORTHWHILE (둘 다)
JUDGED                     **0**                   **0**
저장된 링크                 0                       0
```

## A-3 🔴🔴 **후보 내용을 확인했고, 그래서 차단이 «올바르다» 가 확정됐다**

```
S1 후보 15건 — 보보쇼즈 베이비 게임펀올오버스웨트셔츠 · 해브펀코듀로이셔츠 ·
   BR BC앰버데님팬츠 · 핑크베어다운자켓 · 코듀로이드레스가방SET · 루루플라워바디슈트 ·
   도기앞치마세트 · 플라워앞치마세트 · 모노하트이유식턱받이 · mom&baby밴드 ·
   후르츠뱀부7부우주복 · 드로잉플라워7부내의 · 리리7부내의 · 멀티도트캐릭터7부내의 ·
   구름모달배내바디수트C      ⟹ 🔴 **원상품(Mystery BC half zipped sweatshirt)과 다른 상품**
S2 후보 5건 — BLUEDOG레깅스 · BLUEDOG 퀼팅 우주복 · BLUEDOG 가디건 상하세트 ·
   LL_Hugh Rabbit · 봉통 LU반다나스커트   ⟹ 🔴 **전부 다른 상품**
confidence **전건 0.00~0.10** · matchLevel **전건 low**
```

🟢🟢 ⟹ **⑧ 게이트(`EVIDENCE_NOT_WORTHWHILE`)의 DROPPED 는 «정확한 차단» 이다.**
🔴 「게이트가 국내 동일상품을 버린다」로 **읽으면 틀린다** — 이 표본에서 버릴 동일상품이 **없었다**.
🟢 WU-008/093/114 의 결론(looxloo 가 BLUEDOG 레깅스·쁘띠북을 낸 그 실측)과 **같다** —
   🔴 **이번에는 후보 «내용» 까지 확인해서** 확정했다.

## A-4 🔴 WU-114 의 「등록부 검색 후보 0」을 **정정** 한다

```
WU-114  「S1·S2 둘 다 샵 응답 {ok 6} 인데 **후보 0**」
이번     ok 6 · **후보 15 / 5** (검색어 사다리 5개를 운영과 같게 넘겼다)
⟹ 🔴 후보 «수» 는 0 이 아니었다. 🟢 그러나 결론(국내 JUDGED 0)은 **같다** —
   후보가 **전부 다른 상품** 이기 때문이다. 두 보고를 같은 문장으로 적지 않는다.
```

## A-5 🔴 그래서 **막는 것 둘** 이고 둘 다 CTO 범위 밖이다

```
⒜ **18곳 중 12곳이 `unsupported`** — 전략이 AUTO_* 가 아니거나 **도메인 어댑터가 없다**
   (WU-115 가 이미 확정: 진짜 게이트는 **어댑터 부재** 다 · 등록부 34 중 26곳 어댑터 0)
⒝ 응답한 6곳 중 후보를 내는 곳은 **looxloo 하나** 이고 **그 상품을 팔지 않는다**
⟹ 🔴 해결 방향은 **샵별 어댑터 추가 / Registry 확대** 하나이고 **§12-0 이 금지한 방향** 이다
⟹ 🔴 **CTO 는 어댑터를 만들지 않았다.** CPO 결정 사안이다.
🟢 **그리고 국내 경로 자체에 수정할 코드가 없다** — 그것이 이 ②의 답이다.
```

# §B ② 화면 — **「조회했다」와 「후보가 없다」를 가른다** (이것이 유일한 수정)

```
🔴 전: `showDomesticReview = krRows.length > 0 || !!domesticReference`
   ⟹ 국내 후보 0 이면 🇰🇷 구역이 **아예 렌더되지 않았다** →
      셀러에게는 「국내는 조회조차 안 했나?」로 보인다
🟢 후: `showDomesticReview = checkRan`(세 배열 중 하나라도 «돌았으면» 선다)
   + 빈 상태 문구 갱신 — 「국내 판매처를 **조회했지만** 동일상품 후보를 찾지 못했습니다.」
🔴 「국내에 동일상품이 없다」로 **적지 않는다**(부재 ≠ 미발견 · WU-091 어휘 계약)
🟢 실측이 그 필요를 증명한다 — 두 상품 **모두 국내 후보 0** 이므로 그것이 곧 CEO 가 본 화면이다
```

# §C ③ 「AI 조사 결과 붙여넣기」 — **셀러 경로에서 숨겼다. 지우지 않았다.**

```
🟢 `isSuppliedUrlInputVisible()` = `NEXT_PUBLIC_MI_SUPPLIED_URL_INPUT === "true"` · **기본 false**
🔴 **기능 보존**(CPO 조건 ③) — 파서(`extractCandidateUrlsFromAiAnswer`) · 풀
   (`collectUrlCandidatePool`) · API 경계(`candidateUrls`) · 상태 · 배선 **한 줄도 안 지웠다**
🟢 **상수가 아니라 함수** 다 — 그래야 하니스가 **켠 상태로 마운트** 해 「배선이 그대로 산다」를
   증명할 수 있다(`wu-049r-url-input-reachability` 가 그 역할을 그대로 유지한다)
🔴 왜 지금인가 — 국내·해외가 **둘 다 자동으로** 돌게 된 «뒤» 다(지시서가 고정한 순서)
```

# §D ④ 중복 참고가격 **두 구역 → 한 영역**

```
🟢 `data-testid="unified-price-comparison"` 한 영역 · 제목 **「📊 동일상품 가격 비교」** ·
   그 **안에서** 🇰🇷 국내 / 🌎 해외 분리
🔴 **표시만** 바꿨다(CPO 조건 ②) — `domesticTransientRecords` · `candidateDomesticPrice` ·
   `computeMarketAlert` · 통화/환산 규칙 · 집계 계산 **한 글자도 안 건드렸다**(계약 F-4)
🟢 안쪽 두 블록의 testid·제목·🧾 아이콘·「환산 없음」 성질은 **그대로** ⟹
   `wu-056r1` 계약 다섯이 **깨지지 않고** 「구역 «안» 분리」로 강화됐다
🔴 값이 둘 다 없으면 **빈 테두리를 만들지 않는다**(계약 F-5)
🔴 StageBody 의 기존 「📊 시장 가격 비교」(원자료 표 2개)는 **건드리지 않았다** —
   제목이 서로 포함하지 않으므로 화면에서 두 영역이 구별된다
```

# §E 검증 / Gate

```
계약 **30**(wu-130 · 네트워크 0 · DB 0) — A 생산자 8 · B 저장차단 2 · C 배선 7 ·
     D 화면 6 · **E 국내 3** · **F ③④ 5**
음성 대조 **11종 전부 FAIL → 복구 후 전건 PASS**(적용 여부를 **grep 으로 확인**):
  M1 shopId 교체 제거 → **2 FAIL**     M7 transientPools 경유 → 1 FAIL
  M2 접근차단 필터 제거 → 1 FAIL        M8 국내 구역 조건 되돌림 → **2 FAIL**
  M3 searchResults 합류 제거 → 1 FAIL   M9 붙여넣기 숨김 해제 → **2 FAIL**
  M4 MI 입력 제거 → 1 FAIL             M10 두 참고가격 영역 밖으로 → 1 FAIL
  M5 출처 삼분기 → 이분기 → 1 FAIL      M11 sink 가드 제거 → **2 FAIL**
  M6 UI 구역 렌더 제거 → 1 FAIL
🔴 **변이 한 번이 「적용 실패」였다** — 쉘에 `python3` 가 없어 치환이 **안 됐는데 테스트는
   통과** 했다. grep 으로 적용을 확인하는 절차가 그 거짓 통과를 잡았다(메모 그대로).
회귀 **606 files / 8,438 passed · failed 0** · typecheck **0** · build exit **0**
🔴 중간에 `packages/listing` 쿠팡 고시 1건이 FAIL 했고 **단독 실행 7/7 PASS** ·
   그 패키지 변경 **0** ⟹ 병렬 부하 flake 로 확정(최종 전수에서 사라졌다)
```

🔴 **기존 계약 7건이 FAIL 했고 전부 «의도된 변경» 이라 앵커를 갱신·강화했다**:
`wu-024 C·D` · `mi-022 ⑥` · `product-tab-mounted`(붙여넣기 두 줄 사라짐 + **없음을 직접 단언**) ·
`wu-049r` ×2(**켠 상태로** 마운트) · `wu-082`(빈 상태 문구 + **국내 구역이 선다** 추가).

# §F 🔴 남은 것 — **국내 공급은 CPO 결정 사안이다**

```
🟢 끝난 것 — 국내·해외 **두 자동 공급원이 같은 최종 경로에 연결됐다** ·
   화면이 「조회했다/후보 없음」을 가른다 · 참고가격이 한 영역이다 · 붙여넣기는 숨었다
🔴 남은 것 — **국내 후보 자체가 0 이다.** 원인은 ⒜ 어댑터 부재 12/18 ⒝ 취급 부재이고
   둘 다 §12-0 이 금지한 방향(Registry/어댑터 확대)이라 **CTO 가 열지 않았다**
🔴 가격 작업은 **여전히 HOLD** 다(§00-B) — ①~④ 가 실제 따져 화면에서 확인된 뒤다
```

# §G CEO Action — **1회**

> 「배포했습니다. **아무것도 붙여넣지 마시고** `B226AC009` 와 `B226AC042` 를 열어서
> 🌎 **해외 자동검색 후보** 가 자동으로 뜨는지, 그리고 **📊 동일상품 가격 비교** 한 영역에
> 🇰🇷 국내 / 🌎 해외가 같이 보이는지만 확인해 주십시오.」

🔴 **정상인데 FAIL 로 보이기 쉬운 것 넷**:
```
① 🇰🇷 국내는 「조회했지만 후보를 찾지 못했습니다」가 **정상** 이다 — 실측에서 국내 후보 0
   이고 그 원인은 **등록부 어댑터 부재** 다(화면·MI 결함이 아니다)
② 「AI 조사 결과 붙여넣기」 칸이 **사라진 것이 정상** 이다(기능은 남아 있다)
③ 후보 줄에 「보류」·「동일상품 아님」이 보이는 것은 **정상**(행마다 판정을 적는 계약)
④ 「가격 확인 필요」가 같이 뜰 수 있다 — WU-111 이 기록한 **가격 정책 보류** 사안
```
🔴 `B226AC010` 은 **스냅샷이 DB 에 없다**(전수 검색 확인) — 그 상품으로 확인하지 않는다.
