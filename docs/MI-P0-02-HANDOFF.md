# [MI-P0-02] Gemini Discovery Whitelist + Price Coverage — 착수점

> 🔴 **새 세션은 이 문서의 CURRENT POINTER → NEXT EXACT ACTION 을 읽고 즉시 실행한다.**
> 「어디부터 할까요」·「이대로 진행할까요」·「다음 단계로 갈까요」를 묻지 않는다.
> CPO 가 범위를 이미 결정했다. 중간 보고도 하지 않는다(§완료 보고 형식 하나만).

---

## CURRENT POINTER

```
SPRINT              MI-P0-02
HEAD                (git log -1 로 확인)
WORK                Gemini Discovery 에 «가격 owner 가 있는 판매처» whitelist 주입
DONE                COMMERCE CLOSE (bd81b064)
                    Discovery 정책 (가)/(나) CPO 판정 수령
                    2단계 측정 규칙 고정 (0f448c2f)
                    🟢 STEP A~I 전부 실측 완료 (2026-10-11) → §8 결과표
                       A registry 21개 확정 · B whitelist 주입 + 테스트 12개
                       C Gemini A/B 실측 16콜 · D resolve 60건
                       E/F 국내 가격 5분류 16쌍 · G Identity · H/I KPI
NOT DONE            🔴 KPI 「Domestic Same-Product Price Match Rate」 = **측정불가**
                       (분모 0 — 외부 SAME 후보가 0건이다. 0% 가 아니다)
                    Smallable 원상품 facts 경로(JOB-C 는 Identity 측정에서 빠졌다)
                    arm 순서 교대(counterbalance) 재측정
NEXT EXACT ACTION   🔴 **Identity 증거 보강 하나만 한다.** §8-③ 이 원인을 특정했다 —
                    foretforet 가 정답 상품 5건을 113,000~117,000 KRW 로 실제
                    가져왔는데 `SIMILAR` 로 떨어진다. 판매처 sku 가
                    `MA26KASST0577356`(판매처 자체 품번)이고 브랜드 품번
                    `AW26MS185` 가 «양쪽 다» 없어서 식별자 축이 비었다.
                    → `confirmBrandCodeInTitle` / `domestic-identifiers.ts` 가
                      이 축을 담당하는 owner 다. 먼저 **owner 를 열어 읽고**,
                      한글 제목에서 브랜드 품번을 못 찾는 것이 사실인지 확인한다.
                    🔴 **threshold 를 낮추지 않는다.** SIMILAR→SAME 으로 KPI 를
                      올리는 것은 §6 금지다. 증거를 «더 찾는» 쪽만 한다.
DO NOT REUSE        🔴 scratchpad/mi-p0-candidates.json — whitelist «적용 전» 결과다.
                    (이 세션에서 확인: 해당 파일은 이미 없다. 새 세션이 찾지 말 것)
                    🔴 「registry 10개」·「11개」 둘 다 틀렸다 — 21개다(§1)
OWNER VERIFIED      아래 §Owner Mapping (이번까지 실측 확정분)
TEST STATUS         🟢 회귀 498 files / 7473 passed · 2 skipped(live 전용) ·
                    targeted 12/12 · 음성대조 변이3→FAIL4→복구 PASS ·
                    typecheck crawler 2 = baseline(불변) · build 미실행
DEPLOY              🔴 미배포. 변경은 전부 discovery-benchmark 와 그 테스트다 —
                    Production 런타임이 import 하지 않는다(§9 주의 참고)
CEO ACTION          push 승인 1건(아래 §8 끝)
STOP CONDITION      외부 서비스 장애 · 인증/권한으로 실행 불가 ·
                    destructive production action · CEO 사업/정책 결정 필요
                    🔴 단순 코드 문제·테스트 실패·schema 불일치는 STOP «아니다» —
                       owner 확인 → 수정 → 테스트 → 회귀까지 같은 Sprint 에서 계속한다
ACTUAL REGISTRATION 🔴 STOP (CPO GO 전까지)
```

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

**Identity(STEP G)** — 외부 후보 16건(자기참조 2건 제외):

```
SAME 0 · PRESUMED_SAME 0 · SIMILAR 6 · CONFLICT 9 · UNKNOWN 1 · 미판정 0
```

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

## 9. CEO 판단 1건 — push

커밋은 되어 있고 작업트리는 clean 이다. 🔴 **push 하지 않았다** — push 가
Vercel 배포를 부르기 때문이다(`vercel-deploy-from-repo-root` 메모리).

판단에 필요한 사실:

```
변경 파일  packages/crawler/src/discovery-benchmark/ 안 5개(1 수정 · 4 신규)
           + docs/MI-P0-02-HANDOFF.md
Production 영향  없다 — 수정한 google-discovery.ts 와 신규 supported-sellers.ts 를
           Production 런타임이 import 하지 않는다
           🔴 단 §8-⑤ 의 가드 공백 때문에 「benchmark 는 안전하다」를 규칙으로
              믿지 않는다. 이번 변경 파일을 직접 확인한 결과다
회귀       498 files / 7473 passed · 0 FAIL
```

---

관련 메모리: `measure-with-the-production-function`(2단계 규칙) ·
`guard-predates-the-new-path` · `local-toolchain-silent-noops` ·
`gemini-discovery-is-unblocked-and-returns-url-only` ·
`portal-scraping-blocked-by-terms` · `domestic-discovery-dies-at-low-not-at-search` ·
`brand-code-extraction-already-works`
