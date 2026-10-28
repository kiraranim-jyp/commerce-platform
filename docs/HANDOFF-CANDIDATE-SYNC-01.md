# DISCOVERY-CANDIDATE-SYNC-01 — 후보 소실 + 가격 의미 추적

🔴 Query · Search · Identity · Market Attribution · MI 계산식 · Registry · adapter **변경 0**.
🟢 운영 변경은 **UI 문구 한 자리**(§6) 뿐이다.

---

## 1. Bobo Choses — 단계별 분모 (현재 Production 데이터 · 새 Search 0)

```
Search raw        4        🔴 Apify 가 4건만 돌려줬다(다른 상품은 7~9)
Pool supplied     4
Policy allowed    4        (NOT_AVAILABLE 13 도메인 중 해당 **0**)
Crawl             4        fetchCalls 4
Evidence usable   3        🔴 탈락 1 = `UNREACHABLE` bridge.babyshop.com
MI 자격           3
Identity          SAME 4 · PRESUMED_SAME 1 (생산자 합산 5행)
Market            🇰🇷 KR **1** · 🌎 OVERSEAS 3 · UNKNOWN 1
Price             KRW 88,000 / GBP 37 / EUR 40 / USD 58
MI                candidateDomesticPrice count **1** · candidateOverseasPrice count 4
API               5행    Client 5행    mounted DOM **5행**(소실 0)
```

### 🔴🔴 국내 후보가 「몇 → 몇」으로 줄었나 — **줄지 않았다. 애초에 1이었다**

```
WEB_SEARCH(AI Search)가 낸 3행 = bobochoses.com · tinyapple.net · junioredition.com
                                 ⟹ 🔴 **국내 0건**
🇰🇷 1건은 **DOMESTIC_LISTING**(donokids.com) 산출이다 — 다른 생산자다.
```
⟹ CPO 분류 **A. Search coverage** 다. B(pool)·C(policy)·D(crawl/evidence)·
E(market)·F(price)·G(UI) 에서 **잃은 국내 후보는 0** 이다.

### 🔴🔴🔴 그런데 **내 §17 측정이 생산자 하나를 빠뜨렸다** — 그것이 축소의 큰 몫이다

```
운영 `/api/price-history/check` 는 runner 에 이것을 **같이** 넘긴다:
    reviewedSameUrls      ← listReviewedSameUrls({snapshotId, originCode, …})
    verifiedSameUrlKeys   ← listSnapshotVerifiedSameKeys(…)
🔴 §17 의 1회용 라우트는 **그 둘을 넘기지 않았다** ⟹ `__reviewed_same__` 생산자가
   **한 줄도 돌지 않았다**.
🟢 DB 실측 — `candidate_reviews` 에 `origin_code='B226AC009'` · `human_verdict='SAME'`
   **13행** 이 있다(WU-131 GT 시딩). 그 13 이 바로 **과거에 발견된 국내 후보들** 이다.
⟹ 🔴 **「Production 에서 후보가 1건」은 내 하니스 수치이고, 실제 `/check` 경로의
   수치가 아니다.** 제품 결함으로 적지 않는다.
```
🔴 **CEO 가 실제 화면에서 「🔄 다시 분석」을 누르면 그 13이 재투입된다** — 그 경로는
`/check` 가 쥐고 있고 **코드 변경이 필요하지 않다**.

---

## 2. §5 — `domesticLowestKrw` vs 후보 집계 owner (질문 5개 답)

| # | 질문 | 답 |
|---|---|---|
| 1 | `domesticLowestKrw` owner | `domesticCompetition.lowestPriceKrw` ← `summarizeDomesticMarketSplit(exact, [comparison, history])` ← **`price_observations`(source=`DOMESTIC_SHOP`)** · **영속 테이블** |
| 2 | 국내 후보 목록 가격 owner | `candidateDomesticPrice` = `summarizeCandidateOverseasPrices(domesticTransientRecords)` ← **일시 후보 evidence** (tier `EXACT\|COMPARISON`) |
| 3 | 서로 다른 source 인가 | 🔴 **그렇다.** 하나는 DB 관측, 하나는 이번 실행의 런타임 배열 |
| 4 | 왜 한쪽은 117 · 한쪽은 117,000 | 🔴 **DB 에 `117` 이 실제로 저장돼 있다**(아래) |
| 5 | 화면 「국내 참고가격」이 쓰는 값 | 🟢 **`candidateDomesticPrice`** 다 — 즉 **117,000 쪽** 이고 `117` 은 그 블록에 뜨지 않는다 |

### 🔴🔴🔴 `117` 의 정체 — **Production 가격 쓰기 결함 1건(원인 한 줄까지 특정)**

```
price_observations (snapshot = Main Story) · source = DOMESTIC_SHOP · label 「DEUXBEBE(듀베베)」
  2026-10-08  price_krw = 117,000   ← 정상
  2026-10-08  price_krw = 117,000   ← 정상
  2026-10-28  price_krw =     117   🔴 **§17 실행이 쓴 값**
같은 `source_product_url` 이다(product_no=18285).
최근 6시간 DOMESTIC_SHOP 쓰기 전수 = **그 1행뿐**.

원인 — `packages/crawler/src/comparison-search/deuxbebe.ts:47`
   const DETAIL_PRICE_RE = /id="span_product_price_text"[^>]*>\s*([0-9]+)/;
🔴 `[0-9]+` 가 **콤마를 못 받는다** ⟹ `117,000` 에서 **`117` 만** 집고 멈춘다.
🟢 같은 파일 주석(:127)이 이미 적어 뒀다 — 「RULII/LOOXLOO 는 콤마 포함 — **이 도메인만 다름**」.
   ⟹ 그 전제가 **깨졌다**(사이트가 콤마를 넣기 시작했거나, 과거 값은 다른 경로 산출).
🟢 그리고 **국내 목록 탐색 경로는 같은 상품을 117,000 으로 정확히 읽었다** ⟹
   결함은 **그 어댑터 한 곳** 이다.
```
🔴 **고치지 않았다** — §1·§12 가 「Site adapter」를 금지하고 §5 가 「원인 추적만」이라
했다. 🟡 **한 줄 수정**(`([0-9][0-9,]*)` + 콤마 제거)이면 닫히고, 🔴 **CPO GO 가 필요하다**.
🔴 그때 **이미 저장된 `117` 행도 같이 정리해야** 한다 — `summarizeFrom` 이 **최저가** 를
취하므로 그 행이 살아 있는 동안 `domesticLowestPriceKrw` 는 **117** 이다.

---

## 3. §6·§7 — UI 의미 충돌 제거 (운영 변경 **이 한 자리뿐**)

### 🔴 먼저 내가 1차에 틀린 것을 적는다

```
1차 수정에서 **문장 셋을 전부** 뺐고, 근거로 「숫자 owner 가 영속 관측이라
`저장되지 않습니다` 는 거짓」이라고 적었다. 🔴 **그 판단이 틀렸다** —
이 블록 숫자는 `candidateDomesticPrice`(**일시** 후보 집계)다.
⟹ 🟢 `note`·`scope` 를 **되돌려 놨다**(둘 다 `!compact` = **상세 전용** 이라
   §7 의 「기본 화면에서 제거」는 **이미** 충족돼 있었다).
🟢 회귀가 그것을 잡았다 — 「이동이 아니라 삭제가 됐다」 계약 **4건 FAIL**.
```

### 🟢 남은 진짜 모순 **하나** 를 고쳤다

```
전  「국내 참고가격 ₩88,000」 + 「동일상품으로 확정된 국내 판매처는 **없습니다**」
    ⟹ 가격은 **있는데** 판매처는 **없다** 로 읽힌다(CPO §9 금지 문구)
후  「국내 참고가격 ₩88,000」 + **「국내 가격 참고값」**   ← CPO §6 이 쓴 문구 그대로
```
🔴 **부정문을 쓰지 않는다** · 🔴 숫자·집계·판정 **한 글자도 안 바꿨다** ·
🔴 상수 삭제 **0**(`DOMESTIC_SAME_NOT_CONFIRMED` 는 남아 있다) ·
🟢 같은 사실은 **「동일상품 확인 0곳」 숫자 줄** 이 1차에서 계속 말한다(CORE-UX-SELLER-02).

🟡 **§7 의 장문 제거는 추가 작업이 없었다** — 세 문장 전부 **이미 상세 전용** 이다
(`OverseasReferencePrice` 가 `!compact` 뒤에 둔다 · 마운트 DOM 으로 확인).
🔴 그래서 **CEO 캡처는 상세가 펼쳐진 상태** 로 읽힌다.

---

## 4. 계약 7 + 음성 대조 2

```
A-1 부정문을 가격 옆에 두지 않는다         A-2 짧은 근거 라벨이 선다(판정 어휘 0)
A-3 🟢 상세 근거 문장 둘은 **남아 있다**    B-1 금액·testid·「확인 N곳」 보존
B-2 상수 셋을 **지우지 않았다**            B-3 해외 축 불변
B-4 「동일상품 확인 N곳」 숫자 줄 보존

S1 부정문 복귀      → **2 FAIL**    S2 상세 근거 제거 → **1 FAIL**
복구 후 7 passed
```
🟢 **기존 계약 4파일이 내 1차 과잉 제거를 잡았다**(core-2ao-r1 · core-2u · core-2v ·
core-2w) — 약화하지 않고 **문자열만 교체** 했다(CPO §6·§9 가 그 문구를 대체했으므로).

---

## 5. 보고

```
원인       ⒜ 국내 후보 1건 = **Search coverage**(AI Search 가 국내를 0건 냈다) +
              🔴 **내 §17 하니스가 `reviewedSameUrls` 재투입을 빠뜨렸다**(SAME 13행 실재)
           ⒝ 117 vs 117,000 = **다른 owner** + `deuxbebe.ts:47` 콤마 미지원 **쓰기 결함**
           ⒞ 의미 충돌 = 가격(일시 후보 집계) 옆에 **등급 축 부정문** 을 둔 것
수정       UI 문구 **한 자리**(부정문 → 「국내 가격 참고값」). 그 외 운영 변경 0
회귀       730 files / 9,612 passed / 0 failed
Typecheck  0
Build      exit 0
Git        아래 커밋 · worktree clean · origin/main 0/0
Deploy     push = Production 배포
판정       🟡 **PARTIAL**
```

🟡 **PARTIAL 인 이유 — 남은 둘은 CPO 결정이다**
```
① `deuxbebe.ts:47` 한 줄 수정 + 저장된 `117` 행 정리  → 🔴 Site adapter 금지라 **GO 필요**
② 후보 축소의 나머지 축 = **CEO 가 실제 화면에서 「🔄 다시 분석」** 을 누르면
   `reviewedSameUrls` 13 이 재투입된다 ⟹ 그때 국내 후보 수를 **다시 센다**(코드 변경 0)
```
🟡 **CEO Action 1회** — Bobo Choses(B226AC009) 화면에서 ① 「국내 참고가격 ₩88,000」 옆에
**부정문이 없는지** ② 후보가 몇 건 서는지.
