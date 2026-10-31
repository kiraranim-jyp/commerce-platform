# IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 — §2~§4 분모 확정 (조사 전용)

> 🔴 **운영 코드 변경 0 · 배포 0 · 작업트리 clean.** 이 문서는 스프린트의 **입력**이다.
> 🔴 다음 세션은 **조사를 다시 하지 않는다** — 아래가 §2(상품 범위) · §3(CEO GT) ·
> §4(corpus 수집)의 답이다.

## 0. 착수 전 용량 판단 (§4-C)

🔴 산출물 **8종 × 전 상품 × 후보별 raw evidence**는 한 세션에 들어가지 않는다.
🟢 그래서 **분모 확정까지만** 하고 clean 으로 넘긴다. 나머지는 이 문서를 입력으로 바로 시작한다.

## 1. 라벨 보유 fixture 전수 — 16 / 35

```
fixture                           SAME DIFF UNC  URL  origin codes
cand-02-rows.json                   24   12   8   43  AC010 AB046 AI018 AC117   ← 🔴 라벨은 사본
wu-112-human-gt.json                19    6   2   27  AC010 AC009 AB046 AB040
core-2m-ceo-visual-gt.json          18    1  14   11  AC009 AB040
wu-068-new-gt.json                  10    3   6   48  AC010 AC141 AB046 AC009 AB040
core-same03-human-gt.json            8    1   9   10  AC009 AC010
query-adopt-01-production.json       7    0   0   81  AC009
wu-059-gt-facts.json                 7    7   1  117  AC010 AI018 AC117 AC009 B126AC151
query-arch-01-production.json        6    0   0   85  AC009
wu-125-human-gt.json                 5    5   0    9  AC010 AC009
core-2aj-human-gt.json               4    0   0    4  AC009 AC010
core-desc-review-ceo-gt.json         4    7   2    0  AC010 AC009
dmc-01-trace.json                    3    0   3    5  AC009
wu-093-human-gt.json                 2   12   1    0  🔴 키가 «판매처 SKU» — URL 없음
dsp-01-funnel.json                   1    0   0   21  AC009 AB040
core-2al-human-gt.json               0    6   0    9  AC018 AC157 AB043 AB048
discovery-e2e-ceo-check.json         0    0   0    4  AC009  🔴 human 전건 null(판정 대기)
```
🔴 **SAME 합계 118 은 «중복 포함» 이다** — 같은 URL 이 여러 fixture 에 있다(예: AC010 후보가
`wu-112` · `wu-068` · `wu-059` · `cand-02` 에 동시 등장). **URL 단위 고유화가 §3 의 첫 작업이다.**
🔴 `cand-02-rows.json` 의 라벨은 **다른 fixture 에서 조인해 온 사본** 이다 ⟹ 분모에 **두 번 세지 않는다**
(`core-same06` 계약이 이미 그 이유로 그 파일을 제외 분류해 뒀다).

## 2. 상품 범위 — CPO 목록 **7** 보다 많다

```
CPO 가 지정한 7      B226AC009 · B226AC010 · B126AI018 · AW26MS185 ·
                     01195-VERNICE-NERO · B226AC117 · B226AB046
🟢 추가로 발견된 7   B226AB040 · B226AB043 · B226AB048 · B226AC018 ·
                     B226AC141 · B226AC157 · B126AC151
⟹ 최소 **14 개 상품** 이 GT 에 등장한다
```
🔴 `AW26MS185`(Main Story) · `01195-VERNICE-NERO`(Pèpè) 는 품번 모양이 `B###XX###` 가 아니라
위 표의 자동 추출에 **잡히지 않는다** — `wu-059-gt-facts.json` 의 `origins` 와
`wu-067-blind-review-set.json` 에 있다. 🔴 「표에 없다 = 없다」로 읽지 않는다.

## 3. 원상품 facts 의 owner — 두 곳

```
wu-059-gt-facts.json          origins S1~S6  저장 canonicalProduct «전문»
                              S1 B226AC010 · S2 B226AC009 · S3 B126AI018 ·
                              S4 AW26MS185 · S5 01195-VERNICE-NERO · S6 B226AC117(sku 공란)
search-provider-11-origins.json  S5 The Animals Observatory · S6 Konges Sløjd (품번 없는 2건)
wu-067-blind-review-set.json     sid → 원상품 URL + 후보 items (블라인드 입력 세트 · 라벨 없음)
wu-068-new-gt.json               그 세트의 **CEO 라벨**(같은 sid 공간 · 검증됨)
```
🟢 **sid 공간이 fixture 사이에서 일치한다**(CAND-02-A 계약이 6/6 단언). 🔴 단 S4 는
`wu-059` 쪽 URL 에 Shopify 검색 문맥 쿼리가 붙어 있어 **경로로** 비교해야 한다.

## 4. 운영 DB 에서 가져올 수 있는 것 (읽기 전용 · 실측)

```
product_snapshots      AC010 19행 · 01195 30행 · AW26MS185 12행 · AI018 6행 · AC009 4행
candidate_reviews      118행 · system_verdict/match_truth/price_tier/blockers/price 포함
                       🔴 human_verdict 는 대부분 null (CEO 가 화면에서 누른 것만 채워진다)
price_observations     source/currency/price_amount/price_krw/market_code/checked_at
domestic_product_links 영속 후보(match_truth · cross_seller_verdict · verified)
🔴 Search 결과 테이블은 **없다** — raw title/snippet/rank 는 어댑터가 읽지도 않는다
   (CORPUS-ROOT-CAUSE 조사 확정) ⟹ §5 의 「raw snippet」은 **구조적 측정불가**
```
🟢 접근 수단: `packages/database` 에서 Prisma `$queryRawUnsafe`(읽기). 🔴 칸 이름을
**추측하지 않는다** — `information_schema` 로 읽는다(이 트랙에서 14번 틀렸다 ·
`price_observations.checked_at`(≠observed_at) · `domestic_product_links` 에 `price_krw` **없음**).

## 5. 후보별 Identity/Evidence 를 «운영 함수로» 재생하는 검증된 경로

```
저장 canonicalProduct → backfillCanonicalProduct → buildProductIdentityDna
  → collectUrlCandidatePool(REVIEWED_SAME_SHOP_ID)
  → isSelfReferenceCandidate → withConfidence → enrichCandidatePrices
  → judgeDomesticCandidate → classifyCandidateMarket
  → selectCandidateList / selectMiSameCandidates / buildMarketJudgement
```
🟢 그대로 쓸 수 있는 하니스 **셋** — `cand-02-multi-product`(5상품 · 재투입) ·
`ab046-evidence`(한 쌍 전문 덤프) · `wu-142-two-product-mi`(7축 분류).
🔴 **로컬 제약**: `APIFY_API_TOKEN` 부재(새 Search 불가) · service-role 부재(등록부 빈 상태 ·
DB 쓰기 구조적 불가) ⟹ §6 의 `PRESENT_BUT_NOT_COLLECTED` ↔ `NOT_PRESENT_ON_SITE` 구분은
**후보 페이지를 실제 fetch 해서** 가려야 한다(네트워크는 된다).

## 6. 다음 세션의 실행 순서 (준비 없이 시작)

```
① URL 단위 고유화 — 위 16 fixture 를 합쳐 (상품, 후보URL) → CEO_GT 하나로 접는다
   🔴 cand-02-rows 는 분모에서 제외(사본) · wu-093 은 URL 없음(측정불가로 적는다)
② 상품 ID 부여 PRODUCT-01..N 하고 상품별 corpus 를 섞지 않는다
③ 상품별로 §5 경로를 돌려 후보별 raw evidence + Identity 산출을 덤프
④ §6 네 상태(AVAILABLE / PRESENT_BUT_NOT_COLLECTED / NOT_PRESENT_ON_SITE /
   UNAVAILABLE_TO_CRAWLER)로 칸마다 분류 — 🔴 null 을 DIFFERENT 로 읽지 않는다
⑤ 산출물 A~H 작성 · 모든 숫자에 분자/분모/% 를 적는다
```
🔴 **CTO 는 정책 결정을 하지 않는다** — 자료 수집과 사실 분류까지다(§22).

## 7. 이 문서가 확정한 것 / 확정하지 못한 것

```
🟢 확정  라벨 보유 fixture 16 · 상품 최소 14 · 원상품 facts owner 2곳 ·
         DB 에서 읽을 수 있는 칸 · 운영 재생 경로 · 로컬 제약
🔴 미확정 URL 단위 고유 SAME 수(118 은 중복 포함) · 후보별 raw evidence ·
         네 상태 분류 · FN/FP 목록 — 전부 ①~⑤ 의 산출물이다
```
