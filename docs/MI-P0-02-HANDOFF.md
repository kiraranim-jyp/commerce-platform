# [MI-P0-02] Gemini Discovery Whitelist + Price Coverage — 착수점

> 🔴 **새 세션은 이 문서의 CURRENT POINTER → NEXT EXACT ACTION 을 읽고 즉시 실행한다.**
> 「어디부터 할까요」·「이대로 진행할까요」·「다음 단계로 갈까요」를 묻지 않는다.
> CPO 가 범위를 이미 결정했다. 중간 보고도 하지 않는다(§완료 보고 형식 하나만).

---

## CURRENT POINTER

```
SPRINT              MI-P0-02l  (Brand Evidence Owner 확정)
HEAD                e48aae90 · clean · ahead 9 · behind 0 · 🔴 미push
NEXT EXACT ACTION   🔴 **MI-P0-02l STEP 1 부터.** §12 를 읽고 즉시 실행한다.
                    Brand Owner 가 확정되기 «전» 에는 구현으로 넘어가지 않는다.
CPO 판정 이력        02b 🟢 · 02c 🟢 · 02d 🟢(되돌림 포함) · 02e~02k 🟢 PASS
PRODUCTION 변경      🔴 없음(02e 이후 전부 측정/문서)
CEO ACTION          없음
실등록               🔴 STOP
```

### 🔴🔴 이 세션(02b~02k)에서 «확정» 된 것 — 다시 조사하지 않는다

```
최종 Identity owner   matchTruth  (crossSellerVerdict 는 그 «입력» 중 하나다)
최종 가격 owner        priceTierFromLink  → EXACT·COMPARISON·REFERENCE·EXCLUDED
자기참조               분모에 «절대» 넣지 않는다(두 경로 다 제외하도록 고쳤다)
분모 0                「측정불가」다. 「0%」가 «아니다»
registry              21개 (OVERSEAS 13 · DOMESTIC 8) — 테스트로 잠겼다
whitelist 효과         🟢 2회 독립 재현(22.3→33.3% · 25.5→31.5%, arm 교대)
Extract 품질           🟢 낮지 않다. Light Fetch 가 필요한 축을 이미 준다
provenance            productDataSources 는 «추출 방법»(json-ld/dom/shopify-json)
                      이고 SOURCE/DEFAULT/INFERRED 가 «아니다»
단절 둘                ExtractedProductData ✖ CanonicalProduct ✖ ProductIdentity
                      → ProductIdentity 를 채우는 운영 경로가 «없다».
                      🔴 그래서 buildPrompt 를 고쳐도 Production 은 바뀌지 않는다
```

### 🔴🔴 Evidence Owner Matrix (02k 확정)

| Axis | Master | Light Fetch | Preferred Owner | Discovery |
|---|---|---|---|---|
| title | 3/3 | 2/3 | **Master** | 🟢 사용 |
| brandModelCode | 0/3 | **2/3** | **Light Fetch** | 🟢 사용 |
| color | **0/3**(칸 없음) | **2/3** | **Light Fetch** | 🟢 사용 |
| brand | 3/3(2건 오염) | 2/3(1건 오염) | 🔴 **없음** | 🔴 02l 과제 |
| category | 3/3 칸 상이 | Master 파생 | Master | 🟡 보류 |
| audience | 3/3 칸 상이 | Master 파생 | Master | 🟡 보류 |
| season | brand 안 | code 안 | 🔴 없음 | 🔴 미사용 |
| material | 0/3 | 설명문 전체 | Light(성분만) | 🟡 성분만 |
| size | 이름만 | 값 2/3 | Light | 🔴 **미사용**(변별력 0) |
| image | **3/3**+대표 | 2/3 | Master | 🔴 미사용(Gemini 입력 경로 없음) |

```
Gap   CATEGORY SEMANTICALLY_UNSAFE · AUDIENCE PARTIAL(성별 1/3) ·
      SEASON SEMANTICALLY_UNSAFE(독립 칸 없음) · MATERIAL NOT_COMPARABLE ·
      BRAND CONTAMINATED_BOTH · SIZE NO_DISCOVERY_VALUE · IMAGE NOT_APPLICABLE
```

### 🔴 brand 오판 정정 (02k 에서 내가 뒤집었다)

02j 에서 「Light Fetch brand 가 더 정확하다」고 보고했다. **1/3 에서만 참이다.**

```
SEASON_CODE_ONLY_RE = /^(ss|aw|fw|pe)\d{2}$/i   ← «문자열 전체» 일치만 본다
"AW26"            → 가드 발화 🟢 → "Bobo Choses"
"Main Story AW26" → 🔴 가드 통과 → 오염된 값이 그대로 나간다
```

### 🔴🔴 반복 패턴 — 「수정이 한쪽 경로에만 있다」 **4건**

```
① listing 은 brandModelCode:null 로 막고 extractor 경로는 안 막았다
② 저장경로는 자기참조를 걸렀고 실시간 라우트는 안 걸렀다 (02b 에서 고침)
③ 가드가 index.ts export 만 보고 deep import 를 못 막았다 (02b 에서 고침)
④ 시즌코드/공식몰 brand 가드가 Light Fetch 에만 있고 Master 에는 없다
```

🔴 **「고쳤다」가 「전 경로에서 고쳤다」가 아니었다.** 수정할 때 같은 의미의 다른
경로를 반드시 같이 본다.

### 🔴🔴 CTO 가 이 세션에서 틀린 5건 — 같은 유형이다

```
① crossSellerVerdict 를 최종 판정으로 봄        → owner 는 matchTruth
② foretforet 추출기를 한 브랜드로 일반화해 제거  → PèPè 골든케이스가 잡았다(되돌림)
③ light.facts 로 읽음                          → candidate.facts
④ f.material / f.category 로 읽음              → materialText / categoryText
⑤ 「Light Fetch brand 우위」                    → 1/3 에서만 참
```

🔴 전부 **2단계 규칙 ④(signature/schema 확인)를 건너뛴** 결과다. 매번 측정값이
「없다」로 나왔고 그 「없다」를 제품 결함으로 보고할 뻔했다.
**숫자를 적기 전에 타입을 연다.**

### 🔴 폐기된 가설 — 다시 하지 않는다

```
❌ 「국내 가격 수집 불능」        가격 파서는 후보가 오면 100% KRW 를 준다
❌ 「registry 10개/11개」        21개다
❌ 「평가 상한(3)이 정답을 가렸다」 정답도 conflict 였다. 상한은 원인이 아니다
❌ 「Smallable 접근 차단」        universalExtract 로는 읽힌다(Light Fetch 한정 문제)
❌ 「Extract 품질이 낮다」        낮지 않다
❌ 「foretforet 추출기 제거」     PèPè 가 load-bearing 이다
```

### 측정 산출물 (scratchpad · 원문 그대로)

```
mi-p0-02c-whitelist-counterbalanced.json · mi-p0-02c-counterbalance-summary.json
mi-p0-02c-savepath.json · mi-p0-02c-cap-probe.json
mi-p0-02d-foretforet-brandcode.json · mi-p0-02e-extract-quality.json
mi-p0-02f-smallable-cause.json · mi-p0-02i-master-extract.json
```

---

## 12. 🔴 MI-P0-02l — Brand Evidence Owner 확정 (CPO 지시, 다음 착수점)

🔴 `SEASON_CODE_ONLY_RE` 를 **바로 고치지 않는다.** 먼저 Owner 를 확정한다.

```
STEP 1  brand evidence 경로 셋 추적 — Master · Light Fetch · Canonical/Identity
        어디서 처음 생성되고 · 어디서 정규화되고 · 어디서 raw 로 덮이는가
STEP 2  "Main Story AW26" 이 실제로 vendor 인가 ·
        "Main Story" 와 "AW26" 을 가를 «독립 evidence» 가 있는가
        네 값의 source 추적: Main Story · Main Story AW26 · AW26 · AW26MS185
STEP 3  후보 셋 비교 — A 현재방식 · B vendor 에서 season suffix 제거 ·
        C 독립 brand evidence 우선(vendor 는 fallback)
STEP 4  🔴 False Positive — `.*AW26` 식으로 regex 를 넓히지 않는다.
        상품명/브랜드명이 그 문자열을 포함할 가능성을 배제할 수 없다
STEP 5  🔴 Golden 3 만으로 결론 내리지 않는다. 기존 fixture 를 재사용해
        brand 사례를 넓힌다(새 네트워크 호출 불필요)
STEP 6  종료 조건 — PASS-A(단일 owner) 또는 PASS-B(evidence priority 확정).
        🔴 「그냥 X 가 더 나음」·「regex 넓히면 될 것 같음」은 FAIL
```

🔴 금지(02l 에서도): ProductIdentity · buildPrompt · Gemini prompt · Query Planner ·
alias · compareModelCode · category/audience/season/material 구현 · threshold ·
Quality Gate · Gemini 후보를 SAME 으로 승격 · **Brand Owner 확정 전 Production 수정**

---

## 0. 목적

병목은 Commerce 가 아니라 **MI 정확도** 다. 현재 확인된 문제는 **「국내 가격 수집
불능」이 아니다** — 정확히는:

> **Discovery Recall ↔ Price Adapter Coverage 불일치.**
> Gemini 가 «가격 owner 가 있는 판매처» 를 충분히 발견하지 못한다.

목표:

```
Original → Gemini(whitelist) → supported seller 후보 → resolveCandidate
→ Light Fetch → Price Adapter → 실제 가격 → Identity → SAME → Verified Price
```

🔴 이번 Sprint 의 1차 목표는 **adapter 를 새로 만드는 것이 아니다.** 이미 owner 가
있는 10곳을 Gemini 가 실제로 발견하게 만드는 것이다.

---

## 1. 🔴🔴 Price Adapter Registry — **21개다.** (STEP A 실측 정정 2026-10-11)

`packages/crawler/src/comparison-search/price-source-adapter.ts`
`PRICE_SOURCE_ADAPTERS` (:356-456)

`listPriceSourceAdapters()` 를 **호출해서** 얻은 값이다:

```
total 21 · OVERSEAS 13 · DOMESTIC 8 · 중복 0 · NOT_CONFIGURED 1(rakuten.co.jp)
```

```
OVERSEAS 13   junioredition.com · nickis.com · isolabellakids.com ·
              petitemaisonkids.com · shoppiccoliandco.com ·
              kidswearcollective.com · kidsatelier.com · designerkidswear.com ·
              kidbizkid.com · villagekids.co.uk · folkberlin.com   ← 11개는 spread
              childrensalon.com · rakuten.co.jp                     ← 2개는 리터럴
DOMESTIC  8   looxloo.com · bobochoses.com · rulii.co.kr · skysport.co.kr ·
              deuxbebe.com · littleluna.co.kr · chocoel.co.kr · foretforet.com
```

### 🔴 이 문서의 이전 판이 **두 군데 틀렸다**

```
❌ 「합계 10」
   배열 첫 줄 `...SHOPIFY_SUGGEST_DOMAINS.map(shopifySuggestAdapter)` (:357) 가
   11개를 더 넣는다. 그 줄을 세지 않았다.

❌ 「🟢 배열 안 shopifySuggestAdapter() 호출 0건 — 동적 추가 없음」
   **거짓이다.** :357 에 있다. 이 문장 때문에 「10개」가 그럴듯해 보였다.

❌ 「해외 3 … bobochoses.com」
   bobochoses.com 의 `catalog` 는 **DOMESTIC** 이다(:396).
   `/ko-kr/products/{handle}.json` 이 KRW 절대가를 주기 때문이고
   (bobochoses-kr.ts 실측), 브랜드 국적 때문이 아니다.
```

### 🔴 절대 금지 — 이 방식으로 다시 세지 않는다

```bash
grep -c "domain:"      # ❌ 타입 선언(:153)·함수 인자(:338·:463)가 섞인다
```

세는 방법이 세 번 틀렸다 — 11(grep) · 10(리터럴만) · 실제 21.
**owner 는 문자열도 리터럴도 아니라 `listPriceSourceAdapters()` 다.** 호출한다.

🟢 이제 **테스트가 잠근다** —
`discovery-benchmark/__tests__/mi-p0-02-whitelist.test.ts`
(21/13/8 · 중복 0 · spread 존재 · 「grep 은 owner 와 다른 숫자를 준다」).
어댑터를 추가하면 그 테스트가 깨진다. **그것이 목적이다.**

---

## 2. 고정된 Discovery 정책

```
Gemini = Recall          우리 MI = Precision / Truth
Gemini 결과 = SEARCH_CANDIDATE    🔴 SAME 으로 취급하지 않는다
```

### 가격 단계

```
Discovery Candidate → URL Resolve → Light Fetch → Price Adapter
→ VERIFIED_SOURCE_PRICE → Identity SAME → MI_PRICE
```

🔴 `DISCOVERY_PRICE` 계층은 **제거됐다**(CPO 판정 (가)). 실측에서 Gemini 는
`snippet`·`priceHint` 를 **전건 null** 로 주고 `title` 은 상품명이 아니라 «도메인»
이다. **별도 Gemini 가격 호출을 추가하지 않는다.**

### Marketplace 정책 — (나)

```
KREAM · MUSTIT · SSG · GSSHOP · TRENBE 등
→ 가격 수집 대상으로 «확장하지 않는다» (약관 · no-portal-scraping.test.ts 로 잠김)
→ title · brand · identifier · image 만 Identity evidence 로 쓴다(가격 없음)
🔴 약관/정책 변경도 하지 않는다
```

---

## 3. 🔴🔴 2단계 측정 규칙 (이 프로젝트 최상위 운영 규칙)

```
① 측정값 정의 → ② 운영 Path 확인 → ③ 🔴 그 값의 owner 함수/adapter/resolver 확인
→ ④ 실제 signature/schema 확인 → ⑤ owner 에서 측정
→ ⑥ null/missing/default 의 «의미» 확인 → ⑦ defect 판단 → ⑧ KPI 반영
```

### 금지

```
❌ grep 숫자 → 추정 → KPI
❌ 필드 이름 추측 → 「값 없음」 → defect 판정
❌ 같은 함수에서 expected 생성 → 같은 함수 결과와 비교 → PASS (순환)
```

🔴 이 규칙을 세운 «직후» 에도 내가 registry 개수를 grep 으로 세서 틀렸다.
**규칙을 아는 것과 지키는 것은 다르다.** 숫자를 적기 전에 owner 를 먼저 연다.

### Owner Mapping (실측 확정분)

```
Gemini Discovery     discover(identity, query)        ← 인자 «둘»
grounding 후보        resolveCandidate() 통과 «후» 판단 (vertexaisearch 리다이렉트다)
candidate brand/model candidate.facts.brandModelCode
site article code     candidate.sku
가격                  price-source-adapter registry    ← factsFromProductUrl «아님»
LotteON 재고          itmLst[].stkQty
```

🔴 `factsFromProductUrl` 의 `price: null` 은 **결함이 아니다** — 그 파일 주석이
「통화를 모르므로 가격을 만들지 않는다」·「사이트별 상세 파서는 어댑터의 일이다」
라고 적어 뒀다. 담당하지 않는 함수의 null 을 결함으로 판정하지 않는다.

### 로컬 실행 함정 (전부 실측으로 걸린 것)

```
🔴 @commerce/crawler 배럴에 discovery-benchmark 가 «없다» → 깊은 import
🔴 GEMINI_API_KEY 는 scripts/.env — vitest 가 «자동 로드하지 않는다»(하니스가 직접 읽는다)
🔴 pnpm --filter @commerce/crawler test → test 스크립트가 없어 exit 0 · 출력 0줄
   → 반드시 cd apps/admin && npx vitest run <path> (그 config 가 전 패키지를 포함한다)
🔴 tsx + page.evaluate → __name is not defined (esbuild keepNames) → vitest 로 돌린다
🔴 변이(mutation) needle 에 줄끝을 넣지 않는다 — CRLF 라 매치가 안 되고 SKIP 된다.
   SKIP 을 「가드가 살아 있다」로 읽으면 음성 대조가 위증이 된다
🔴 긴 실측을 백그라운드로 돌릴 때 `| tail -N` 을 붙이지 않는다 — tail 이 EOF 까지
   버퍼링해서 **출력이 0바이트로 보인다**. 17분 동안 「죽었나」 의심했다.
   → `--reporter=basic` 을 쓰고 파이프를 «붙이지 않는다»
🔴 live 측정은 `describe.skipIf(!LIVE)` 로 감싼다(vitest 2.1.9 에서 동작 확인).
   회귀 스위트에서 skipped 로 세어지고, 과금이 매번 일어나지 않는다
```

---

## 4. STEP A~I — 🟢 **전부 실행됐다 (2026-10-11).** 결과는 §8.

> 🔴 아래는 «무엇을 어떻게 재는가» 의 정의로 남긴다. 재실행이 필요하면
> `MI_P0_02_LIVE=1` 로 같은 하니스를 다시 돌린다 —
> `discovery-benchmark/__tests__/mi-p0-02-live-measure.test.ts`(STEP C·D) ·
> `mi-p0-02-price-identity.test.ts`(STEP E~I).
> 🔴 **재구현하지 않는다.** 하니스가 이미 있다.

```
A  registry 재확인 — 10개·도메인·domestic/overseas·중복·동적등록
B  Discovery query builder 에 whitelist 주입
   🔴 단순 문자열 append 가 아니라 현재 Discovery architecture 에 맞는 방식으로.
      기존 grounding semantics 를 깨지 않는지 실제 구현을 확인한다
C  실제 Gemini 재검색 (캐시 사용 금지) — Golden: Bobo · Junior Edition · Smallable
   + false-positive / false-negative 후보 포함
   기록: query · candidate count · domain · URL · rank · resolve status
D  resolveCandidate — PRODUCT_PAGE / LISTING_PAGE / UNKNOWN_PAGE 를 그대로 기록
   🔴 UNKNOWN_PAGE 를 억지로 PRODUCT_PAGE 로 승격하지 않는다
E  Light Fetch — title·brand·identifier/model·image·material·color·category·
   price owner 가용성. 🔴 각 필드는 실제 schema/owner 확인 후 측정
F  🔴 핵심 — Price Adapter 실제 가격 측정. 다섯을 «갈라» 적는다:
     adapter 없음 / adapter 있음+parser 실패 / adapter 있음+가격 없음 /
     가격 있음+currency 없음 / 가격 정상
   → 하나의 price=0 으로 뭉개지 않는다
G  Identity — 식별자 > 이미지·속성 > 제목 유사도
     같은 브랜드 + 제목 95% 유사 + 다른 model code = NO_MATCH
     같은 실제 model/reference + 제목 표기 차이 = SAME 가능
   🔴 SIMILAR ≠ SAME · INSUFFICIENT_EVIDENCE ≠ NO_MATCH
H  Verified Price — candidate + 실제 URL + Light Fetch + adapter + valid price
   + Identity SAME 이 «전부» 충족될 때만. 그 뒤 MI_PRICE
I  KPI — Discovery / Price Coverage / Identity + 핵심 KPI:
     Domestic Same-Product Price Match Rate
       = (SAME 후보 중 VERIFIED_SOURCE_PRICE 확보 건수) / (SAME 후보 건수)
     🔴 분모·분자의 실제 데이터 정의를 명시한다
```

### MI 최종 상태

```
AUTO_GO · REVIEW · NO_GO · INSUFFICIENT
🔴 가격을 못 찾았다고 자동 NO_GO 하지 않는다 —
   「국내 동일상품 evidence 없음」은 INSUFFICIENT 또는 REVIEW 다.
   No price → 낮은 가격 추정 → NO_GO 는 «금지».
```

### 테스트

```
targeted → 🔴 negative/mutation(가드를 일부러 깨고 FAIL 확인 → 복구) →
regression → typecheck(baseline 과 «비교») → build
🔴 Identity 에서는 「SIMILAR → SAME」 오판 방지 테스트를 «우선» 한다
```

---

## 5. 완료 보고 형식 (이것 하나만 올린다)

```
[MI-P0-02 COMPLETE]
1 Registry            2 Discovery(whitelist·candidate·supported·resolve rate)
3 Price(adapter match·price success·currency success)
4 Identity(SAME/SIMILAR/NO_MATCH/INSUFFICIENT)
5 Domestic Same-Product Price Match (분자/분모/%)
6 False Positive      7 False Negative
8 Tests(targeted·negative·regression·typecheck·build)
9 Deploy(commit·smoke)  10 CPO 판단(PASS/PARTIAL/BLOCKED)
11 NEXT EXACT ACTION (한 가지)      CEO ACTION 없음
```

---

## 6. 성공 기준

```
Discovery Recall ↑  +  Price Adapter Coverage ↑  +  Identity Precision 유지
+  Verified Price 확보  +  Human Review Rate ↓
```

🔴 **Recall 을 높이려고 Identity threshold 를 낮추지 않는다.**
🔴 **SIMILAR 를 SAME 으로 희생해 KPI 를 올리지 않는다.**

---

## 7. 세션 안정성 (프로젝트 운영 규칙)

```
Long Sprint = 재개 가능한 «독립» 작업 단위. 세션이 끊겨도 손실되지 않는다.
Sprint START → implementation → CHECKPOINT COMMIT → long test → fix →
FINAL COMMIT → handoff(이 문서의 CURRENT POINTER 갱신)
🔴 불필요한 commit 남발은 하지 않는다. 의미 있는 코드 상태에서만 체크포인트.
🔴 Sprint 종료마다 이 문서 맨 위 CURRENT POINTER 를 갱신한다 — 그것이 재개점이다.
```

---

## 8. 🔴🔴 STEP A~I 실측 결과 (2026-10-11)

원본 데이터: `scratchpad/mi-p0-whitelist-candidates.json` ·
`mi-p0-resolve.json` · `mi-p0-price-identity.json` (URL 원문 그대로, 자르지 않음)

### ① STEP C/D — whitelist 는 **효과가 있다**

🔴 **ON arm 에서 Gemini TimeoutError 3건이 났다.** 그래서 raw 총계를 비교하면
안 된다 — 양쪽이 «둘 다 OK» 인 5쌍만 짝지어 비교한다.

| | 호출 | 발견 URL | registry 적중 | 적중률 |
|---|---|---|---|---|
| OFF (대조군) | 5 | 94 | 21 | 22.3% |
| ON (whitelist) | 5 | 96 | 32 | **33.3%** |

🟢 **질적으로 결정적인 것은 숫자가 아니다 — `foretforet.com` 이다.**

```
OFF   foretforet.com  0건
ON    foretforet.com  6건 (Q2·Q4·Q6 «셋 다»)
```

그리고 §8-③ 에서 **foretforet 가 Main Story 버블 스웻셔츠를 실제 KRW 가격까지
가져온 유일한 국내 판매처**였다. whitelist 가 「가격 owner 가 있는 판매처」를
실제로 새로 발견시켰다 — 이 스프린트의 가설이 맞았다.

**resolve(STEP D)** — 🔴 UNKNOWN_PAGE 승격 없음. 분류 그대로:

```
probe 대상 60건(registry 적중만) · probe 안 한 건 171건(적중 아님 — 사실로 적는다)
OFF   PRODUCT_PAGE 26 · LISTING_PAGE 2 · crawlable 26
ON    PRODUCT_PAGE 27 · LISTING_PAGE 5 · crawlable 27
NOT_FOUND 0 · UNUSABLE 0 · UNKNOWN_PAGE 0   ← resolve 계층은 건강하다
```

### ② 부작용과 UNKNOWN — 🔴 좋은 쪽만 적지 않는다

```
🟢 OFF 에 있던 kream.co.kr · ssg.com · feelway.com 이 ON 에서 사라졌다
   → 정책 (나)(가격 수집 대상 아님)와 맞는 방향이다
🟢 배타적으로 작동하지 «않았다» — ON 에서 목록 «밖» 도메인이 새로 나왔다
   (smallable.com · james-james.be · petitpourquoi.com · checkanddot.com)
   → 「목록에만 한정하지 마세요」가 실제로 먹혔다
🟡 distinct 도메인 53 → 35. recall 이 «집중» 된다. 잡음이 줄지만 신규 판매처
   발견도 줄 수 있다 — 양면이다
🔴 cafe24.com · cafe24api.com · base.shop 이 후보로 올라온다 — 판매처가 아니라
   «호스팅 플랫폼» 이다. grounding 의 `web.title` 이 도메인만 주므로 가릴 수 없다
   → false positive 로 기록. 해결은 resolve 단계의 일이다
🔴 TimeoutError 3건이 전부 ON arm 에 몰렸다. **원인 UNKNOWN.**
   프롬프트가 21개 도메인만큼 길어져 thinking 이 늘었을 수도 있고, ON 을 나중에
   돌린 «순서 효과» 일 수도 있다. 🔴 근거 없이 단정하지 않는다 —
   재측정 시 **arm 순서를 교대(counterbalance)** 한다
```

### ③ STEP E/F/G/H/I — 🔴🔴 **사슬이 끊기는 곳은 가격이 아니다**

운영 경로 그대로 실측(`buildCrossSellerSearchQueries` → `adapter.search`
→ `withConfidence`). DOMESTIC 8곳 × Golden 2 = 16쌍.

**가격 5분류 — 🔴 하나의 `price=0` 으로 뭉개지 않았다:**

```
PRICE_OK                  4       ← 후보가 나온 «모든» 경우
ADAPTER_NO_CANDIDATES    12
ADAPTER_PARSER_FAILED     0
CANDIDATE_NO_PRICE        0
PRICE_NO_CURRENCY         0
```

> 🟢 **「국내 가격 수집 불능」은 없는 결함이다.** 후보가 하나라도 나오면 가격
> 파서는 KRW 절대가를 100% 준다(4/4). 지시서 §0 의 진단이 맞았다.

**Identity(STEP G)** — 🔴🔴 **이 측정은 틀렸다. §10-① 이 정정한다.**

```
외부 후보 16건(자기참조 2건 제외) — 🔴 crossSellerVerdict 를 셌다
SAME 0 · PRESUMED_SAME 0 · SIMILAR 6 · CONFLICT 9 · UNKNOWN 1 · 미판정 0
```

🔴 `crossSellerVerdict` 는 **최종 판정이 아니라 `deriveMatchTruth` 의 여섯 인자 중
하나** 다. 운영의 최종 판정은 `matchTruth` 이고 이 측정은 그것을 돌리지 않았다
(그래서 `matchTruth` 가 전건 null 이었는데 그 null 의 의미를 짚지 못했다).
**정정된 숫자는 §10-① 에 있다.** 결론(분모 0 → 측정불가)은 바뀌지 않았다.

**핵심 KPI(STEP I)**

```
Domestic Same-Product Price Match Rate
  분모 정의  DOMESTIC 어댑터 후보 중 자기참조 아니고 crossSellerVerdict==='SAME'
  분모       0
  분자 정의  그중 price.amount «그리고» price.currency 가 둘 다 있는 건수
  분자       0
  결과       🔴 **측정불가(분모 0)**. 「0%」가 «아니다» — 다른 사실이다
```

### ④ 🔴 원인은 특정됐다 — 품번 축이 양쪽 다 비어 있다

```
foretforet.com 이 돌려준 5건 (전부 113,000~117,000 KRW · 가격 있음)
  AW26 2차[메인스토리]멜란지 버블 스웻셔츠-MA26KASST0577356   ← 「멜란지」=Grey Melange
  … 그린 / 초코브라운 / 로즈 / 그레이스톤 4건 더
판정  전부 SIMILAR
이유  판매처 sku = MA26KASST0577356 (판매처 «자체» 품번)
      원상품 브랜드 품번 = AW26MS185
      → 식별자 축이 «양쪽 다» 비어 제목 유사도만 남고, 제목은 한글이다
```

🟢 **Identity 엔진 자체는 정상이다.** 자기참조 2건(bobochoses.com,
검색어 `B226AC114`)이 정확히 `SAME` 으로 나왔다 — 같은 상품을 주면 SAME 을 낸다.
외부 SAME 0 은 엔진 결함이 아니라 **증거 부족**이다.

🔴 그리고 **자기참조를 분모에서 뺀 것이 load-bearing 이었다.** 빼지 않았으면
KPI 가 `2/2 = 100%` 로 나와 거짓 보고가 됐다.

### ⑤ 같이 발견된 사실 (고치지 않았다 — 사실로만 적는다)

```
🔴 운영 사다리가 2칸뿐이다
   buildCrossSellerSearchQueries(identityDnaFromFields({title,brand,sku,
   sourceUrl,color,material})) → ②~⑥ 이 중복 제거돼 2개만 남는다.
   운영 라우트(domestic-price-sources/search/route.ts:241)가 «정확히 같은»
   입력을 쓰므로 이것은 측정 왜곡이 아니라 **운영 실태** 다.
   🟡 단 run-domestic-price-check.ts:486 은 Master 의 dna 를 써서 더 풍부할 수
      있다 — **두 번째 owner 이고 이번에 측정하지 않았다**
🔴 `matchTruth` 가 전건 null 이다. withConfidence 는 crossSellerVerdict 만
   채우고 matchTruth 는 attachProductMatchTruth 가 따로 채운다
🔴 bobochoses.com 이 「Main Story bubble sweatshirt Grey Melange」 검색에
   자기 브랜드 상품 4건을 돌려준다 → 전부 CONFLICT 로 «정확히» 막혔다(가드 정상)
🔴 types.ts:7 이 「`__tests__/no-production-coupling.test.ts` 가 지킨다」고
   적었는데 **그 파일은 없다.** 실제 가드는
   discovery-benchmark.test.ts:422 이고 **index.ts 의 export 만** 본다.
   그래서 production 의 `comparison-search/product-url-facts.ts:4` 가
   `discovery-benchmark/url-resolver` 를 **직접 import 하는 것을 막지 못한다** —
   「Production 이 하나도 import 하지 않는다」는 주석은 **거짓이다**.
   🔴 url-resolver 를 고치면 Production 이 바뀐다(이번엔 안 고쳤다)
🔴 Smallable Q6(품번축)이 OFF/ON 양쪽 다 0건. productCode=AAA1804532 는
   Smallable «자체» SKU 다 — 사이트 품번은 Discovery 축으로 쓸모가 없다
```

### ⑥ 이 스프린트가 **하지 않은** 것

```
DB(domestic_price_sources) 미사용 → collectionStrategy 게이트를 건너뛰었다
JOB-SMALLABLE 은 Identity 측정에서 빠졌다(Shopify facts 경로가 없다)
arm 순서 교대 재측정 미실시
build 미실행 · 미배포 · 미push
```

---

## 10. 🔴🔴 MI-P0-02b — Long Sprint ①~⑥ (CPO 지시, 2026-10-11)

CPO 판정: MI-P0-02 는 CLOSE 가 아니다. push 보류. 아래를 끝낸 뒤 CPO 가 결정한다.

### ① 🔴 1차 측정이 «입력» 을 «결과» 로 보고했다

운영 사슬을 끝까지 열어 보니 최종 Identity 판정은 route 계층에 있었다:

```
identityDnaFromFields → buildCrossSellerSearchQueries → searchDomesticShops
  (안에 lookupBrandAlias 폴백이 있다)
→ foreignModelCode = extractForeignModelCode(description)
                     ?? extractModelCodeFromSourceUrl(sourceUrl)
→ attachMatchTruth
    confirmBrandCodeInTitle → compareModelCode → deriveMatchTruth(인자 6개)
→ 🔴 matchTruth  ← 최종 판정은 «이것» 이다
```

`attachMatchTruth` 가 `search/route.ts` 안의 비공개 함수여서 하니스가 운영 판정을
부를 수 없었다. 그래서 `_lib/attach-match-truth.ts` 로 **옮겼다(로직 무변경)** 고
운영 함수를 직접 부르도록 재측정했다 — 합성을 재구현하면 circular test 가 된다.

**정정된 숫자** (`scratchpad/mi-p0-02b-identity.json`):

```
foreignModelCode   JOB-JE   AW26MS185  (description 경로)
                   JOB-BOBO B226AC114  (sourceUrl 폴백 — 두 갈래 다 실제로 돌았다)
matchTruth         CONFLICT 12 · INSUFFICIENT_EVIDENCE 4 · EXACT_IDENTIFIER 2
KPI                EXACT 2건은 «자기참조» 다 → 외부 분모 0 → 🔴 측정불가
```

🔴 **결론은 바뀌지 않았다.** 다만 어휘가 정확해졌다 — 정답 상품
(foretforet 멜란지)은 `SIMILAR` 가 아니라 `INSUFFICIENT_EVIDENCE` 다. 엔진이
「비슷하다」고 **주장하지 않고** 「증거가 부족하다」고 말한다. 그게 옳은 동작이다.

🟢 그리고 1차의 「후보 없음 12/16」은 **과대가 아니었다.** 외부 후보는 1차 16건 ·
2차 16건으로 **같다** — alias 폴백을 건너뛴 것은 하니스의 공백이었지만 이번
측정에는 영향이 0이었다(이유는 ③). 공백과 영향을 구분해 적는다.

### ② 운영 호출부는 둘이다

```
domestic-price-sources/search/route.ts:241   실시간 화면 — 이번에 측정한 경로
price-history/_lib/run-domestic-price-check.ts:486   저장 파이프라인
  🔴 이쪽은 Master 의 dna 를 쓴다 → 사다리가 더 풍부할 수 있다. 미측정으로 남는다
```

### ③ 🟢🟢 **한글 제목에서 브랜드 품번 확인은 «된다».** 실측했다

`scratchpad/mi-p0-02b-alias-probe.json`:

```
메인스토리 @ littleluna.co.kr   5건 · 🟢 품번확인 4건
   ✅ [메인스토리] AW26MS185 - Bubble Sweatshirt - Grey Melange   ← 원상품과 같은 색
   ✅ … Graystone / Rose Shadow / Chocolate Brown   ← 같은 품번 «다른 색»
메인스토리 @ deuxbebe.com       5건 · 품번확인 0  (AW26MS252·231·260 — 다른 상품)
메인스토리 @ foretforet.com     5건 · 품번확인 0  (자체코드 MA26KA… 만 적는다)
메인스토리 @ bobochoses.com     2건 · 품번확인 0  🔴 브랜드 무관 상품 = 오탐
보보쇼즈   @ looxloo/bobochoses/rulii/foretforet  총 16건 · 품번확인 0
```

🔴 **그래서 「0/18」은 함수의 실패가 아니었다.** 품번을 제목에 적는 판매처가 후보를
0건 돌려줬을 뿐이고, 그 원인은 하나다:

```
lookupBrandAlias → BRAND_ALIASES 에 브랜드가 «3개» 뿐이다
  Pèpè Shoes · Emile et Ida · Konges Slojd Clothing
  🔴 「Main Story」·「Bobo Choses」 둘 다 없다 → 폴백이 발화할 수 없다
  littleluna·deuxbebe 는 영문 질의에 0건이고 한글에만 반응한다(실측)
→ 품번 축은 «비교에 실패한 것이 아니라 비교할 기회가 없었다»
```

### ④ 🔴 alias 등록은 **하지 않았다** — CPO 판정 사안이다

`brand-alias.ts` 가 스스로 요건을 적어 뒀다: 「실측으로 동일 브랜드 후보가
돌아오는 것이 확인된 표기만 · **오탐 0건** · 추론/자동번역/유사발음 생성 금지」.

```
🟢 요건 충족분   메인스토리 → littleluna 4건이 정확히 그 품번이다
🔴 요건 미충족   메인스토리 → bobochoses.com 이 브랜드 무관 2건을 돌려준다(오탐)
                alias 는 «브랜드» 단위라 샵을 골라 끌 수 없다
🟡 판단 재료     그 오탐 2건은 Identity 계층에서 CONFLICT/INSUFFICIENT_EVIDENCE
                로 «이미» 걸러진다(1차 측정에서 실측). 2026-08-26 당시의
                「오탐 0」은 검색 계층에서 잰 값이고, 그 뒤 Identity 가 강해졌다
```

🔴 **「오탐 0」의 해석을 CTO 가 바꾸지 않는다.** 등록하면 그 브랜드를 파는 모든
셀러의 검색 동작이 바뀐다 — 제품 정책 경계다. 측정까지가 CTO 의 일이다.

🟢 등록했을 때의 가장 큰 위험(같은 품번 다른 색 4건이 전부 SAME 으로 올라가는
것)은 **이미 테스트로 잠겨 있다** — `p54c-google-discovery.test.ts` 의
「🔴🔴 C7 JOB-005 — Google 이 네 색상을 다 줘도 MI 가 하나만 SAME 으로 낸다」가
**바로 이 상품 · 이 판매처** 다.

### ⑤ 🔴 고친 결함 — 자기참조가 셀러 화면에 「국내 동일상품」으로 나갔다

```
run-domestic-price-check.ts:630   저장 경로 → isSelfReferenceCandidate 로 «걸렀다»
search/route.ts                   실시간 화면 → 🔴 그 가드가 «없었다»
```

실측: 원상품이 `bobochoses.com/products/b226ac114-…` 일 때 국내 검색이 **같은
URL**(쿼리파라미터만 다름)을 2건 돌려주고, 품번이 글자까지 같으니
`attachMatchTruth` 가 `EXACT_IDENTIFIER` 로 올린다. 즉 셀러가 **자기가 사 온 그
페이지를 「국내 동일상품 168,000원」으로** 본다. 그리고 그 2건이 KPI 를
「확보율 100%」로 만든다 — 이번 측정에서 실제로 그 숫자가 나왔다.

🔴 이것은 `search/route.ts` 머리 주석이 「실시간 검색 화면과 저장 파이프라인이
서로 다른 상품 진실 판정 기준을 가지면 안 된다」고 적어 둔 바로 그 원칙 위반이다.

고침: `_lib/attach-match-truth.ts` 의 `excludeSelfReference`.
🔴 **threshold 는 한 글자도 바뀌지 않았다** — 외부 후보의 판정이 가드 전후로
동일하다는 것을 테스트가 단언한다. 뺀 건수는 funnel 로그에 숫자로 남는다
(조용히 버리지 않는다).

### ⑥ 🔴 coupling guard — 방향을 바로잡았다 (allowlist 가 아니다)

```
이전   types.ts 주석: 「no-production-coupling.test.ts 가 지킨다」 → 🔴 그 파일 없음
       실제 가드: discovery-benchmark.test.ts → index.ts «export» 만 봄
       실제 구멍: comparison-search/product-url-facts.ts:4
                  → discovery-benchmark/url-resolver 를 «깊은 import»
```

🔴 benchmark 를 Production 에 연결해 해결하지 «않았다». 반대로 했다 —
URL 모양 판별은 애초에 Production 로직이므로 Production 이 **소유**하게 했다:

```
신규  comparison-search/url-shape.ts     ← classifyUrlShape · toCrawlerUrl (로직 무변경)
      url-resolver.ts 는 re-export 로 기존 import 경로를 살려 둔다
      types.ts 의 ResolutionClass = UrlShape (어휘를 두 벌 적지 않는다)
→ 방향이 benchmark → Production 하나로 고정된다
```

🟢 이동이 동작을 바꾸지 않았음은 **기존 단언들이 증명한다** — benchmark 테스트를
한 줄도 고치지 않았고 `p54b-product-url-facts.test.ts` 13개가 그대로 통과한다.

신규 가드 `discovery-benchmark/__tests__/no-production-coupling.test.ts` 는
**파일명이 아니라 import graph** 를 본다: 정적 `from` · 동적 `import()` ·
`require()` 를 전부 보고, 주석을 벗기고, 상대경로를 해소해 benchmark 안쪽을
가리키는지 판정한다. 배럴 export 축도 유지하고, 역방향(benchmark → Production)이
**실제로 존재하는지** 도 같이 잠근다(0건이면 하니스가 기존 MI 를 재는 것이 아니다).
🔴 「glob 이 0건이면 전부 공짜로 통과」를 막는 단언도 같이 넣었다.

### ⑦~⑪ 테스트·회귀·타입·빌드

```
targeted      14/14 PASS (coupling 4 · 자기참조 10)
음성 대조     변이 2건(역방향 import 복원 · 자기참조 필터 무력화)
              → 가드 4개 FAIL → 원상복구 PASS
회귀          500 files / 7487 passed · 3 skipped(live) · 0 FAIL
              직전 498/7473 → +3 파일 +14 테스트. 회귀 0
typecheck     admin 0 = baseline · crawler 2 = baseline
              listing 7줄 = baseline (🔴 stash 로 clean 대조해 확인했다.
              「5」는 줄 수가 아니라 «오류 개수» 였다 — 연속줄 2개 포함 7줄)
build         PASS
```

### ⑫ 다음 — 🔴 CTO 가 임의로 진행하지 않는다

```
CPO 판정 필요 ①  BRAND_ALIASES 에 「메인스토리」·「보보쇼즈」를 등록하는가
                  (오탐 0 요건의 해석 — 검색 계층 기준인가 Identity 계층 기준인가)
CPO 판정 필요 ②  등록 후 KPI 재측정 범위
미측정으로 남음   run-domestic-price-check 경로(Master dna 사다리)
                  Smallable JOB-C Identity
                  arm 순서 교대 재측정(§8-② TimeoutError UNKNOWN)
```

---

## 11. 🔴🔴 MI-P0-02c — 재측정 (CPO 지시, 2026-10-11)

원본: `scratchpad/mi-p0-02c-savepath.json` · `mi-p0-02c-cap-probe.json` ·
`mi-p0-02c-whitelist-counterbalanced.json`

### ① alias 등록 — 🔴 CPO 보류 확정, 유지

「Identity 가 뒤에서 CONFLICT 로 막는 것은 alias 등록 조건의 오탐 0 을 충족시키는
것이 아니다」(CPO). `BRAND_ALIASES` 를 **건드리지 않았다.** 그리고 그 결정 때문에
한글 품번 추출 «기능» 도 고칠 필요가 없다 — 코드가 못 찾는 문제가 아니다.

### ② 🔴 최종 owner 는 `priceTierFromLink` 다 (4단계)

`runDomesticPriceCheck` 에는 실시간 라우트에 **없는 판정이 더 있다**:

```
① 자기참조 제외       isSelfReferenceCandidate            ← 이미 있었다
② Gate 1              isEvidenceEvaluationWorthwhile      false → 링크 «없음»
③ 대표 1건 선정        selectDomesticCandidate             ← 샵당 1건만
④ matchType + rescue 둘 toDomesticMatchType                NOT_MATCHED → 링크 «없음»
⑤ verified            decideCandidateEvidence → applyEvidenceDecision
⑥ matchTruth          evidenceDecision.truth
⑦ 🔴🔴 최종 owner     priceTierFromLink({matchTruth, verified})
       EXACT · COMPARISON · REFERENCE · EXCLUDED
```

🔴 **라우트에는 ②④가 없고 ③도 없다.** 라우트는 후보 «전부» 에 matchTruth 를 붙이고,
저장경로는 게이트 둘을 통과한 **샵당 대표 1건** 만 링크로 만든다.
→ **두 경로의 KPI 분모가 구조적으로 다르다.** 섞어 쓰면 그게 거짓 보고다.

측정 가능하게 만든 방법: 판정 구간을 `judgeDomesticCandidate` 로 **옮겼다**
(`run-domestic-price-check.ts` 안, 같은 파일 — 순환 import 를 피했다).
`runDomesticPriceCheck` 가 그것을 부른다. **사본이 아니다.** 로직 무변경.

**저장경로 실측 — Golden 3 × DOMESTIC 8 = 24**

```
NO_CANDIDATES                    18
DROPPED_EVIDENCE_NOT_WORTHWHILE   4   ← Gate 1
DROPPED_NOT_MATCHED               1   ← Gate 2
JUDGED                            1   → tier COMPARISON 1 · EXACT 0

KPI(최종 owner 기준)  분모 0 → 🔴 측정불가
```

🔴 **대조:** 같은 입력에서 라우트는 후보 18건에 matchTruth 를 붙였고, 저장경로는
**링크 1건** 을 만든다. 라우트 숫자를 「국내 동일상품 후보」로 읽으면 18배 과대다.

🟢 Gate 1 이 떨어뜨린 4건은 **전부 진짜 다른 상품** 이었다(Beast Tag polo ·
데님윈터캡 · Mystery BC · 트랙수트팬츠). 게이트가 올바르게 일한다.

### ③ Smallable JOB-C — 🔴 해외 품번이 «구조적으로» 없다

fixture JSON-LD 실측(`smallable-430632-product.html`):

```
name  All About Monsters Washed T-shirt Organic cotton | Blue
sku   AAA1804532     ← 🔴 Smallable «자체» 재고번호
brand Bobo Choses    color Blue
mpn   없음           gtin 없음        ← 🔴 브랜드 품번이 JSON-LD 에 «없다»
desc  "SIZE AND FIT … COMPOSITION 100% Organic Cotton …"
      ← 🔴 「Product code」 표기가 «없다»
→ foreignModelCode = null  (description·sourceUrl 폴백 «둘 다» 실패)
```

🔴 **SKU 를 model/reference 로 승격하지 않았다**(CPO 금지). null 을 null 로 쟀다.

🟢 그런데 **후보는 나왔고 가격도 나왔다** — bobochoses.com, JUDGED 1건:

```
title               All About Monsters T-shirt      ← 정답 상품이다
price               98,000 KRW
crossSellerVerdict  PRESUMED_SAME
domesticModelCode   B226AC018      ← 🟢 «국내 쪽은» 품번을 읽었다
modelCodeEvidence   unavailable    ← 🔴 해외 쪽이 null 이라 비교 자체가 불가
matchTruth          TEXT_CONFIRMED · verified false
priceTier           COMPARISON     ← EXACT 가 «아니다»
```

🔴 즉 Smallable 의 FN 은 국내 수집도 Identity 도 아니라 **해외 품번 부재** 다.
그리고 `COMPARISON` 은 옳다 — B226AC018 이 같은 상품인지 확인할 근거가 없다.

### ⑧ 🔴🔴 FN 원인 특정 — **내 가설이 실측으로 반증됐다**

처음에 「정답이 후보 #5 인데 `MAX_EVIDENCE_CANDIDATES=3` 이라 평가 기회를 못 받았다」
고 봤다. **추측하지 않고 다섯 건 품번을 전부 실제로 읽었다:**

```
#1 그린       cap IN   MA26KASST0577196  conflict
#2 초코브라운  cap IN   MA26KASST0576878  conflict
#3 로즈       cap IN   MA26KASST0577592  conflict
#4 그레이스톤  cap OUT  MA26KASST0577271  conflict
#5 멜란지(정답) cap OUT  MA26KASST0577356  conflict   ← 🟢 정답도 conflict 다
```

🟢 **상한은 원인이 «아니다».** 올려도 풀리지 않는다.

🔴🔴 **진짜 원인:** `fetchForetforetModelCode` 가 **판매처 자체코드** 를 돌려주고,

```
compareModelCode("AW26MS185", "MA26KASST0577356") → 🔴 "conflict"
사실은                                             → "unavailable" 이어야 한다
```

`conflict` 는 「품번이 달라서 **다른 상품이다**」라는 뜻이다. 실제 사실은 「비교할
브랜드 품번을 못 얻었다」다. **없는 반증을 지어내고 있다.**

그래서 구조적이다 — 5건이 전부 conflict 라 `selectDomesticCandidate` 가 conflict
아닌 후보를 못 찾고 `evaluated[0]` 을 대표로 주며, rescue 도 발화하지 않아
(modelCode 가 exact/partial 아니고 crossSeller 도 SAME 아님) Gate 2 에서 떨어진다.
**정답 상품이 117,000원 가격까지 있는데 링크가 만들어지지 않는다.**

🔴 **이 위험은 이미 문서화돼 있었다.** `domestic-identifiers.ts` 주석:
「포레포레 `MA26KASST0577356` 를 품번 칸에 넣으면 compareModelCode 가 접두사부터
갈라져 「모델코드 충돌」을 **지어낸다**」 —
**listing 경로는 막았고(`brandModelCode: null` 하드코딩) extractor 경로는 막지
않았다.** 가드가 한쪽에만 있는 그 패턴이 이 스프린트에서 세 번째다.

🔴 **CTO 가 고치지 않았다.** 현재 동작을 테스트로 **고정** 했다
(`mi-p0-02c-cap-probe.test.ts` — 고치면 그 테스트가 깨진다. 그게 신호다).
고치지 않은 이유 둘:
```
① fetchForetforetModelCode 를 바꾸면 foretforet 의 «모든» 상품 판정이 바뀐다
② 「foretforet 상세에 브랜드 품번이 애초에 있는가」를 아직 재지 않았다
   있으면 extractor 가 그것을 읽어야 하고, 없으면 null 을 돌려줘야 한다
   (그러면 unavailable 이 되어 텍스트·교차판매처 경로가 살아난다)
   🔴 어느 쪽인지 모른 채 고치면 그게 추측이다
```

### ④ 🟢 arm 순서 교대 — whitelist 효과가 **재현**됐다

R1(OFF→ON) · R2(ON→OFF), 같은 query set, 캐시 없음, 총 32콜.

**arm 축 — 🟢 양쪽 다 OK 인 11쌍만 짝지었다(timeout 0)**

```
OFF   발견 208 · registry 적중 53 (25.5%) · distinct 5
ON    발견 235 · registry 적중 74 (31.5%) · distinct 6  ← rakuten.co.jp 가 ON 에서만
```

🟢 **1차(22.3% → 33.3%)와 방향이 같다. 순서를 뒤집어도 같다.**
독립 2회 측정에서 재현됐으므로 「whitelist 가 registry 판매처 발견을 늘린다」는
이제 단발 관측이 아니다.

**순서 축 — 🔴 timeout 은 순서만의 효과가 «아니다»**

```
timeout  arm      OFF 2 · ON 4
         armOrder first 2 · second 4
         round    R1 4 · R2 2
```

교대했는데도 **ON 쪽이 여전히 많다**(4 vs 2). 완전한 순서 효과라면 arm 별로
균등해야 한다. 그래서 1차의 UNKNOWN 이 한 칸 좁혀진다 —
**whitelist 가 프롬프트를 길게 만들어 thinking 이 늘어나는 쪽이 더 유력하다.**

🔴 **단정하지 않는다.** timeout 총 6건이라 표본이 작고, 5건 중 **4건이 Q4**
(브랜드+상품명+색상 = 가장 긴 쿼리)에 쏠려 있다. 그 쏠림은 「프롬프트 총 길이」
가설과 일관되지만 그것을 증명하지는 않는다. 다음 재측정에서 **쿼리 길이를 축으로**
가르면 갈린다.

🔴 버린 쌍 5개를 숫자로 남겼다(`droppedPairs`) — 실패한 호출의 0 을
「못 찾았다」로 세지 않았다.

### ⑤⑥⑦ 고정된 정의 — 다시 바꾸지 않는다

```
자기참조   분모에 «절대» 넣지 않는다 (라우트·저장경로 둘 다 이제 제외한다)
최종 판정  matchTruth → priceTierFromLink. crossSellerVerdict 를 결과로 쓰지 않는다
분모 0     🔴 「측정불가」. 「0%」가 아니다
Identity   INSUFFICIENT_EVIDENCE → SIMILAR → SAME 방향으로 threshold 를 낮추지 않는다
```

---

## 9. push/deploy — 🔴 CPO 보류 (2026-10-11)

CPO 판정: 「`3624ee0b` 는 지금 push 하지 않는다. CTO 에게 push 여부를 다시 묻지
않는다. Identity + coupling guard + 회귀까지 끝난 시점에서 CPO 가 결정한다.」

그 세 가지는 §10 에서 끝났다. 현재 상태:

```
Code/Test       🟢  targeted 14/14 · 음성대조 2라운드 복구 PASS
Build           🟢
회귀            🟢  500 files / 7487 passed · 0 FAIL
Identity        🟢  운영 사슬 전체로 재측정 완료 · 1차 측정 오류 정정 · 원인 특정
Coupling guard  🟢  import graph 가드로 교체 · 역방향 import 제거
KPI             🔴  측정불가(분모 0) — BRAND_ALIASES 등록이 CPO 판정 대기
Push / Deploy   🔴  CPO 결정 대기
CEO action      없음
```

🔴 **CTO 는 push 를 묻지 않는다.** CPO 가 그렇게 지시했다.

---

관련 메모리: `measure-with-the-production-function`(2단계 규칙) ·
`guard-predates-the-new-path` · `local-toolchain-silent-noops` ·
`gemini-discovery-is-unblocked-and-returns-url-only` ·
`portal-scraping-blocked-by-terms` · `domestic-discovery-dies-at-low-not-at-search` ·
`brand-code-extraction-already-works`
