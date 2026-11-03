# 🔵🔵🔵 SPRINT 3 — DISCOVERY QUALITY + SELLER DECISION UI FINAL

> 🔴 **착수점은 이 문서 하나다.** CPO 작업지시서 수령(2026-11-02). 코드 **0** 으로 시작한다.
> 🔴 **아래 §0 을 읽기 «전» 에 조사를 시작하지 않는다** — CEO 캡처가 이미 세 가지를 확정했다.

---

## §0 🔴🔴🔴 CEO 캡처가 **확정한 것 셋**(다시 조사하지 않는다)

### ① 🟢🟢 **자동 시장분석은 «작동한다»** — 직전 스프린트의 열린 질문이 닫혔다

```
캡처 URL  ttaejyo.vercel.app/pipeline      ← 🔴 `?resume=` 가 **없다** = 신규 정상 진입
화면      「다시 분석」 **없음** · 국내/해외 소싱가 · 후보 카드 · 추천 판매가가 **전부 떠 있다**
⟹ 🔴 `MARKET ANALYSIS AUTO-LOAD` 의 분기 **A(자동 trigger 없음)는 반증됐다.**
   `page.tsx:529`(isFirstInsert 블록의 POST /check)가 **실제로 발화한다.**
🔴 그러므로 **그 스프린트를 다시 열지 않는다** — 자동 실행은 더 고칠 것이 없다.
🟢 그리고 직전 CEO 캡처 둘(`79a09cfb`)이 `resume` 이었다는 분석이 **옳았다**.
```

### ② 🔴🔴 TEST A 는 「후보 부족」이 아니라 **Precision 붕괴** 다 — 정답도 «같이» 들어와 있다

```
원상품  B226AC043 Mystery BC Half Zipped Sweatshirt
        https://bobochoses.com/en-kr/products/b226ac043-mystery-bc-half-zipped-sweatshirt

🟢 **정답 후보가 실제로 발견됐다**(캡처에서 직접 읽힌다):
   bobochoses(?) EUR 77.4  「BOBO CHOSES Mystery BC half zipped sweatshirt」
   JPY 16,500              「Mystery BC half zipped blue sweatshirt」
   donokids.com KRW 162,000 「[보보쇼즈] Mystery BC half zipped sweatshirt #B226AC043」
🔴 **그런데 전혀 다른 상품이 같은 층에 같은 배지로 서 있다**:
   EUR 39      Baby Sweater Suit "Blue Moon" Organic Cotton
   CAD 26,300  Stone Island Baby Blue Sweatshirt      ← **다른 브랜드**
   USD 12,700  Maya Knit: Blue Cotton Sweater Top …
   USD 11,300  Blue Basic Knitted Sweater
   GBP 39.5    Blue Half Zip Sweatshirt
🔴🔴 그리고 그 오염이 **집계까지 올라간다** — 1차 「해외 최저 소싱가」가
   `CAD 26,300 · EUR 39~77.4 · GBP 39.5 · JPY 16,500 · USD 11,300~12,700` 로 떴다.
   ⟹ **셀러가 보는 최저가가 다른 상품의 가격** 이다. 이것이 이 스프린트의 1순위다.
🟢 공통점 — 전부 **「blue」 + 「sweatshirt/sweater」** 다(색 + 품목만 맞는 후보).
```

### ③ 🔴 TEST B 는 **Recall** 이다(정확도 문제가 아니다)

```
원상품  B226AC010 Booty Ghosts T-Shirt
        https://bobochoses.com/en-kr/products/b226ac010-booty-ghosts-t-shirt
캡처    🇰🇷 donokids.com KRW 88,000 「[보보쇼즈] Booty Ghosts T-shirt #B226AC010」 **1곳**
        🌎 junioredition.com GBP 37 **1곳**
🔴 과거 실측(이 레포 기록)으로는 이 상품에 **해외 동일상품이 더 있다**
   (scoutandcokids · tinyapple · global.trenbe · cissywears · kids21 …).
⟹ 「검색에 없다 / crawl 실패 / identity 탈락 / visibility 제외」 중 **어디서 죽는지** 를 가른다.
```

### ④ 🔴 CEO UX 지적 — 원문 그대로

> 「머가 많은 정보가 있는데 **알고 싶지도 않은게 너무많아**.」

```
🔴 이 트랙이 「이동」으로 고쳐 온 것이 한계에 닿았다 — CPO 가 **덧대기 중단** 을 선언했다.
🟢 이번 목표는 **빼는 것** 이다(§3 의 네 질문만 남긴다).
```

---

## §1 🔴 CTO 용량 판단 — **이번 세션은 착수하지 않았다**(§4-C)

```
이 세션이 이미 한 것 — FINAL UX REBUILD(구현·계약·변이·회귀·배포 `63c54ec2`) +
  PRICE & CANDIDATE UX FINAL FIX(구현·계약·변이·회귀·배포 `484c6dfe`) +
  운영 DB 실측(6db15ecc · 79a09cfb) + AUTO-LOAD 호출그래프 조사
남은 범위 — 라이브 2상품 Discovery 진단 + Identity/visibility 수정 + UI 최소화 +
  계약 11 + 변이 7 + 전체 회귀 2회(각 ~5분) + build + deploy
⟹ 🔴 한 세션에 끝까지 갈 수 없다. 착수하면 **배선 절반에서 끊긴다**(헌장이 「가장 나쁘다」고
   적은 상태). 🟢 그래서 **코드 0 · 작업트리 clean** 으로 멈추고 이 문서를 남긴다.
```

🔴🔴 **다음 세션은 조사를 다시 하지 않는다** — §0 이 분기를 이미 좁혔다.

---

## §2 🔵 다음 세션의 실행 순서 (조사 0 에서 시작)

### STEP 1 — 라이브 진단 **먼저**(운영 함수 · 코드 변경 0)

두 URL 을 운영 파이프라인으로 돌려 **네 층의 분모** 를 기록한다(CPO §5·§6·§24):

```
층     search query → 검색결과 수 → URL 수 → crawl OK → identity 판정 →
       {SAME · PRESUMED_SAME · SIMILAR · DIFFERENT · CONFLICT · UNKNOWN} → price → visibility
🔴 화면만 보지 않는다. 🔴 네 층을 **합치지 않는다**.
```

🟢 **재사용할 하니스가 이미 있다** — `wu-138-same-funnel` · `wu-138-domestic-funnel` ·
`ux04-b3` 계열. 새 하니스를 만들기 전에 그것부터 본다.

### STEP 2 — TEST A 오탐의 **승격 경로** 를 한 지점으로 특정

```
질문   「Stone Island Baby Blue Sweatshirt」가 **어느 축** 으로 PRIMARY 가 됐는가
       (brand? category? 제목 토큰 blue/sweatshirt? snippet?)
🔴 추정하지 않는다 — `crossSellerVerdict` · `matchTruth` · `priceTier` · blockers 를 **값으로** 읽는다
🔴 **brand 가 다른데 통과했다면** 그것이 가장 좁은 수정 지점이다
```

### STEP 3 — 수정은 **한 지점만**

```
🔴 CPO §8 — 「가장 많이 누락시키는 한 지점을 고친다 · 여러 정책을 동시에 새로 만들지 않는다」
🔴 §9 의 recall 보호 넷(AB↔AC age-line · model-code-only · color variant ·
   same seller distinct listing)을 **제거하지 않는다**
🔴 §10 의 shortcut 넷(brand+modelCode 무조건 SAME · 검색 1위 → SAME · 결과 존재 → 후보 ·
   상품명 유사 → SAME) **금지**
```

### STEP 4 — UI 는 **빼는 작업만**

```
1차에 남는 것 넷 — ① 판매 판단 ② 소싱 가격(🇰🇷/🌎) ③ 후보 N곳 ④ 추천 판매가 + 확정 + ⓘ
🔴 **문구를 추가하지 않는다**(§2 금지 목록 전수)
🟢 기법은 **이미 있다** — `price-detail-fold` 로 내리는 「이동」과 계약의 **분모 분리**
```

---

## §3 🟢 **구현이 보존되는 것**(다시 만들지 않는다) — 🔴 **「UI 가 끝났다」가 아니다**

🔴🔴 **CEO/CPO 정정(2026-11-02)** — 아래 여섯은 **보존 대상** 이고 **UI/UX 종료 선언이 아니다.**
```
🟡 UI/UX FINAL = **아직 CLOSED 아니다.** CEO 지적이 **살아 있다** —
   「머가 많은 정보가 있는데 **알고 싶지도 않은게 너무많아**」
   「공통 UI/UX 너가 **노출하고 싶은 거 그냥 막 써놓은 듯**」
🔴 그러므로 이 절을 근거로 「UI 완료」라고 보고하지 않는다.
🔴 그렇다고 **지금 UI 를 또 건드리지도 않는다** — 순서는 §6 이다(데이터가 먼저다).
```

```
🟢 자동 시장분석 신규 진입 1회         `page.tsx:529`(isFirstInsert) — §0-① 로 **확인됨**
🟢 resume 복원(B-3)                    `savedCandidateRows` · 자동 /check **0**
🟢 「다시 분석」 정상 화면 제거          `canRecheck && !checkRan`(MarketPriceComparison:491)
🟢 후보 카드 접힘 깊이 **1**            `core-ux-rebuild-01-exposure-depth` 가 숫자로 센다
🟢 해외 소싱가 원화 병기                `convertToKrwStrict` · 통화 혼합/미지원이면 **숫자 0**
🟢 1차 [가격 수정] · 「후보 보기」        `market-edit-price-link` · `mi-candidate-list-hint`
```

🔴 **이 여섯을 되돌리는 방향으로 고치지 않는다.**

---

## §5 🟢🟢 **CPO 결정 — STOP-B ⒜ 승인됨**(2026-11-02) · 🔴 다시 묻지 않는다

```
🟢 **해외** 가격 집계 레코드에 **identity verdict 를 싣는 최소 계약 확장** 을 승인한다.
🔴 **국내 가격 집계 정책은 건드리지 않는다**(EXACT|COMPARISON 그대로) — 이번 P0 는 해외다.
🔴 새 verdict 체계를 만들지 않는다 — **기존 enum/type 을 재사용** 한다.
🔴 구현 범위가 그보다 커지는 순간에만 STOP-B 재보고.
```

### 🔵 구현 좌표 — **조사 0**(이 세션이 코드로 확정했다)

```
owner      apps/admin/src/app/api/price-history/_lib/candidate-market.ts:216
           summarizeCandidateOverseasPrices
현재 결함   :259  `if (r.priceTier === "EXCLUDED") continue;`   ← **EXCLUDED 하나만** 뺀다
           ⟹ `COMPARISON` · `REFERENCE` 금액이 「최저 확인가」가 된다(캡처의 CAD 26,300)
           🔴 바로 위 주석이 그 사실을 적어 뒀다 — 「`REFERENCE` 는 빼지 않는다.
              CPO 가 `EXCLUDED` 하나만 승인했고 …」(WU-062) ⟹ **이번에 그 승인이 확장됐다**
계약        `CandidateOverseasPriceRecord` 에 **`verdict` 가 없다**(지금은 `priceTier` 뿐)
           ⟹ 그래서 §5 ⒜ 확장이 필요하다. 생산자는 그 레코드를 만드는 곳
              (`market-intelligence.ts` 의 `overseasEvidence.push` 경로)이다
새 자격     `verdict ∈ {SAME, PRESUMED_SAME}` 만 **해외 1차 금액 집계**(byCurrency)
           🔴 `byMarket` · `byPriceTier` · `count` 는 **건드리지 않는다**(WU-062 가 남긴 관측)
```

🔴🔴 **tier 축으로 대신 좁히지 않는다 — 실측 선례가 있다**:
```
이 레포 기록 — 「국내 참고가격 자격은 tier(EXACT|COMPARISON)이고 **SAME 만 허용하면
국내 가격이 1 → 0 으로 사라진다**」. ⟹ tier 를 좁히는 길은 **이미 측정으로 닫혀 있다.**
그래서 CPO 가 verdict 축(⒜)을 고른 것이다.
```

---

## §4 🟡 CPO 판정이 필요한 것(CTO 가 고르지 않았다)

```
⒜ 🔴🔴 **오염된 집계** — 1차 「해외 최저 소싱가」가 다른 상품 가격(CAD 26,300 등)을
   최저가 후보로 싣는다. 후보 필터를 고치면 자동으로 닫히는가, 아니면 **집계 자격**
   (`buildPriceGuide` 입력)도 같이 좁혀야 하는가 ⟹ **가격 정책 경계** 라 CPO 결정.
⒝ 🔴 TEST A 의 정답 후보 하나가 **EUR 77.4 · 원상품과 같은 스토어** 로 보인다 —
   자기참조(다른 로케일)인지 다른 판매처인지 **미확인**. 자기참조면 그것은 후보가 아니다.
⒞ 🔴 덤프의 `GBP 30,200` 류 **가격/통화 적격성** 문제는 직전 스프린트에서 보류됐다.
```

🔴 **§4 ⒜ 는 §5 로 승인·해소됐다**(해외 집계 verdict 확장). 남은 판정은 ⒝ 자기참조 · ⒞ 가격 적격성 둘이다.
🔴🔴 **단 §5 의 «적용» 은 측정 뒤다**(CPO ③ · §6). 추정으로 필터를 바꾸지 않는다.

---

## §6 🔵🔵🔵 **CPO 정정 — 순서가 고정됐다**(2026-11-02) · 🔴 이 절이 §2 의 순서를 이긴다

### 🔴 현재 상태를 «갈라서» 적는다 — 하나로 뭉치면 거짓이 된다

```
🔴 SPRINT 3        **데이터/가격 후보 정확성 STOP**(권한 대기 · ① 운영 DB 읽기 차단)
🟡 UI/UX FINAL     **최종 종료 대기** — CLOSED 아니다
🟢 기존 구현        **보존**(§3 여섯 · 되돌리지 않는다)
🔴 CEO 지적        「정보가 너무 많다」는 **아직 최종 해결 대상으로 살아 있다**
```

🔴🔴 **왜 UI 를 먼저 끝내지 않는가** — UI 문제가 아니라 **공급 사슬** 문제이기 때문이다:
```
AI Search → 후보 → Identity → 가격집계
그 사슬에서 **엉뚱한 상품이 최저가로 들어온다** ⟹ UI 를 아무리 정리해도
  ❌ 「국내 얼마 / 해외 얼마」가 **틀릴 수 있다**
  ❌ **다른 상품의 가격** 이 최저가로 보일 수 있다
  ❌ 후보가 너무 적거나 엉뚱할 수 있다
⟹ 🟢 **UI 를 버린 것이 아니라, UI 최종 종료를 위해 데이터를 먼저 막는다.**
```

### 🔵 실행 순서 — **한 LONG SPRINT 로 묶는다**

```
P0  `후보 → Identity → 가격집계` **원인 확정**        ← 🔴 지금 여기(권한 대기)
      ① read-only 운영 DB dump  →  ② B226AC043 라이브 1회
      → Search / Crawl / Identity / Price 집계 **4층 연결**
      → **CAD 26,300 실제 후보의 verdict + tier 확정**
      → 🔴 `SIMILAR/UNKNOWN` ↔ `PRESUMED_SAME` 중 어느 쪽인지 **먼저** 확정
P1  엉뚱한 상품 가격이 **1차 소싱가에 들어가는 단 하나의 원인 지점** 수정
      🔴 후보 탐색 / Identity 자체를 **불필요하게 건드리지 않는다**
      🔴 **국내 가격 축을 회귀시키지 않는다**(tier 를 좁히면 국내가 1 → 0 이 된 실측 선례)
P2  **TEST A = Precision** · **TEST B = Recall**
      🔴 묻는 것은 한 문장이다 — 「**좋은 후보가 많이 나오면서 엉뚱한 상품 가격은
         1차 가격에 들어오지 않는가**」(둘을 따로 묻지 않는다)
P3  🔴🔴 **UI/UX FINAL — 반드시 수행한다.** CEO 가 지적한 UI 를 **다시 손본다**
      1차 화면은 **오직** 아래 순서로 읽혀야 한다:
      ① 상품 판단 → ② 동일상품 후보/판매처 → ③ 국내·해외 소싱 가격 → ④ 선택 → ⑤ 최종 판매가
      🔴 그 외에 셀러가 **알고 싶지 않은 정보가 1차에 쌓여 있으면 삭제 / 상세로 이동** 한다
FINAL  CEO 질문 **다섯이 모두 YES** 여야 종료
```

🔴🔴🔴 **P0~P2 만 끝내고 「Sprint 3 완료」로 닫지 않는다**(CPO 명시 2026-11-02).
```
P3 (UI/UX FINAL) 은 **선택이 아니라 종료 조건** 이다.
🔴 데이터가 정확해진 것은 **P3 를 할 수 있게 된 것** 이고 **끝난 것이 아니다.**
🔴 「가격이 맞게 나온다」를 FINAL 로 쓰지 않는다 — FINAL 은 **CEO 가 화면에서
   다섯 질문에 바로 답하는 것** 이다.
```

### 🔴🔴 FINAL 종료 기준 — 1차 화면이 답해야 하는 것은 **다섯** 이다

```
① 어떤 상품인가?
② 동일상품 후보는 **어디** 인가?
③ 국내/해외에서 **얼마** 인가?
④ **어느 판매처** 를 선택할 것인가?
⑤ **최종 판매가** 를 얼마로 확정할 것인가?
🔴 나머지는 **전부 증거/상세정보 «안» 으로** 들어간다.
🔴 목표는 **정보를 많이 보여주는 화면이 아니다**(§2 STEP 4 의 「빼는 작업만」이 이 뜻이다).
```

🔴 **STOP 중 금지** — UI 추가 수정 · §5 적용 · 운영 DB 우회 접근 · 권한 강제.

---

## §9 🔵🔵🔵 **SEARCH-RUN-OBSERVABILITY-02** — 🔴🔴 **현재 WU · 조사 0 · 질문 0 으로 시작**

🔴 **CPO 결정이 끝났다. 중간 검토·선택지를 «묻지 않는다».** 구현부터 배포까지 한 덩어리.

### 9-0 🟢 조사는 이미 끝났다(다시 하지 않는다)

```
🟢 응답 배선   **할 일 0** — `domesticShop.webSearchMetrics` 에 아홉 칸이 이미 나간다
               searches · pages · perPage · organic · failed ·
               errorName · errorStatus · errorCode · timeout
🟢 producer    응답의 생산자별 배열에서 그대로 센다 —
               `webSearchEvidence` · `overseasAutoEvidence` ·
               `domesticListingEvidence` · `geminiEvidence`
🔴 빠진 것     `snapshots/_lib/snapshot.ts` export 는 getSnapshot(Raw) · saveSnapshot ·
               duplicateSnapshot · deleteSnapshot · markSnapshotRegistered 뿐 ⟹
               **workspace 부분 갱신 helper 가 «없다»** ⟹ 그것을 세우는 것이 이 WU 다
```

### 9-1 저장 위치·의미(CPO 확정 2026-11-03 · 재질문 금지)

```
위치  **`product_snapshots.workspace.searchRun`** · 🔴 새 칸/테이블 **만들지 않는다** · migration **0**
의미  🔴 **「마지막 상품 분석 실행의 Search 실행 관측값」** — **상품 사실/속성이 아니다**
저장  searches · pages · perPage · organic · failed ·
      errorName · errorStatus · errorCode · timeout ·
      producer counts(WEB_SEARCH · OVERSEAS_AUTO · DOMESTIC_LISTING · GEMINI)
🔴 금지 저장 — token · Authorization · cookie · credential · URL secret ·
   response body · **error message 전문**
```

### 9-2 실행 순서 — **12단계 한 덩어리**

```
① snapshot.ts 에 workspace **부분 갱신 helper**(기존 saveSnapshot 패턴 재사용)
   🔴 `searchRun` **한 칸만** 덮는다 — canonicalProduct 등 다른 칸 불변
② /check 에서 `domesticShop.webSearchMetrics` + producer counts 를 그 칸에 저장
③ 저장 계약  ④ 보안 계약  ⑤ **다른 workspace 칸 불변** 계약  ⑥ **fail-soft** 계약
   (저장이 실패해도 분석이 죽지 않는다)
⑦ mutation  ⑧ 전체 regression  ⑨ typecheck  ⑩ build  ⑪ commit/push  ⑫ deploy
```

### 9-3 🔴 이번 WU 금지

```
query · search count · MAX_SEARCHES_PER_PRODUCT · MAX_PAGES_PER_QUERY · **2→1 롤백** ·
alias · relevance · Identity · price policy · candidate UI · mock data
```

### 9-4 완료 보고 — **1회 · 10절**

```
1 변경 파일/구현  2 계약 결과  3 mutation  4 regression  5 typecheck/build
6 commit/push/deploy  7 searchRun 저장 구조  8 보안 검증
9 운영 실행 필요 여부  10 다음 단계(있으면 **최대 1개**)
🔴 중간 보고 금지 · 🔴 **배포 전까지 CEO 에게 운영 실행을 요청하지 않는다**
```

🟡 **배포 뒤 단 한 줄만** 전한다 — 「이제 운영 1회 실행하면 됩니다」. 그 전 CEO 할 일 **0**.

---

## §8 🔵🔵🔵 **SEARCH-FAILURE-OBSERVABILITY-01**(CPO 2026-11-03) · 🟢 완료(`2351aff9`)

🔴🔴 **§7 보다 이 절이 «지금» 이긴다** — Sprint 3 의 현재 단계는 UI 가 아니라 **Search 실행 안정성** 이다.

### 8-0 출발 사실(운영 로그 실측 · 재조사 금지)

```
[SP07-websearch] query="…국내해외 동일상품 판매처" · searches 1
                 **pages 0 · perPage [] · organic 0 · failed TRUE**
[C06R-producers] WEB_SEARCH **0** · OVERSEAS_AUTO 4 · DOMESTIC_LISTING 0 · GEMINI 0
🟢 Query 조립 정상 · 1 product = 1 search 정상 · 국내 후보 **후단 처리 정상**
   (mustit → PRESUMED_SAME → TEXT_CONFIRMED → COMPARISON → KRW 109,000 → market KR)
🔴 Case B(relevance) **철회** · Case C(후단) **근거 없음**
🔴 `MAX_PAGES_PER_QUERY = 2` 가 원인인지 **미확정**(로그 1건)
```

### 8-1 범위 — **관측성만**

```
허용  error capture → safe normalization → SP07 telemetry
금지  query/variant/분리검색/검색횟수/MAX_* 변경 · **2→1 롤백** · alias · relevance ·
      Identity · price eligibility · candidate UI · mock 국내 후보 · 가격 계산
```

### 8-2 계측 — 🔴 **실제로 존재하는 값만**(임의 필드 금지)

```
필수  errorName · errorStatus · errorCode · timeout
가능  provider · phase
🔴🔴 **보안 최우선** — 토큰 · Authorization · 전체 header · **response body 전문** ·
   URL 속 token · credential · cookie · secret **전부 금지**.
   🟢 오류 «종류» 만 남긴다(예: errorName=TimeoutError · errorStatus=504 · timeout=true)
```

### 8-3 가려야 하는 실패 유형 셋

```
A Timeout            timeout=true
B Provider/HTTP      errorStatus 4xx·5xx 또는 안전한 error code
C 기타 실행 오류      errorName · errorCode
🟢 목표는 원인 추측이 아니라 **다음 운영 실행 «1회» 로 계열을 판정** 하는 것
```

### 8-4 보존 — 기존 계측이 사라지면 FAIL

```
searches · pages(=pagesReturned) · perPage(=organicPerPage) · organic · failed
🔴 2페이지가 실제로 몇 페이지 반환됐는지 확인 가능해야 한다
```

### 8-5 계약 5

```
TEST-01 provider error 주입 → failed=true · errorName 존재 · errorStatus|errorCode 존재
TEST-02 timeout          → failed=true · timeout=true
TEST-03 secret 보호       → 토큰·Authorization·credential·response body **미포함**
TEST-04 성공 회귀         → failed=false · pages · perPage · organic 기존과 동일
TEST-05 telemetry 회귀    → 기존 SEARCH-SUPPLY 계약 **9건 전부 유지**
```

### 8-6 🔵 **실행 → 보고를 «한 단계» 로 합친다**(CPO 정정 2026-11-03)

🔴 전에는 §10(검증 순서)·§11(재실행 보고)·§15(보고 형식)로 **세 곳에 갈려** 있었다 —
그래서 「어디까지가 실행이고 어디부터가 보고인가」가 흔들렸다. **하나로 적는다.**

```
① 계약 + 전체 regression   ② typecheck   ③ build   ④ commit · push · deploy
⑤ **B226AC017 운영 1회 재실행**        ⑥ CTO 가 **먼저** 로그 판독(CEO 화면 공개 0)
⑦ **완료 보고 1회** — 아래 여섯 절을 한 번에
   1 변경(파일·내용·운영 영향)   2 테스트(계약·regression·typecheck·build)
   3 배포(commit·push·production) 4 재실행 로그 원문
      query / searches / pages / perPage / organic / failed /
      errorName / errorStatus / errorCode / timeout
   5 원인 판정  **CASE T(timeout) · CASE P(provider) · CASE C(설정/런타임) · CASE U(불충분)**
   6 CPO 판단 선택지 **최대 2개** — 🔴 임의 구현 금지
🔴 중간 보고를 반복하지 않는다(⑦ 1회).
```

🔴🔴 **⑤ 의 제약을 먼저 적는다** — 운영 재실행은 **로그인 뒤 화면** 이라 CTO 가 트리거할 수
없다(메모 `production-payload-is-unreachable`). 🟢 ①~④ 까지는 CTO 가 끝내고, ⑤ 는
**셀러/CEO 가 상품을 한 번 분석할 때** 자동으로 남는다 ⟹ 그 뒤 ⑥⑦ 을 CTO 가 수행한다.

### 8-7 🔴 timeout 으로 나오더라도 **즉시 롤백하지 않는다**

```
함께 제출 — timeout 발생 시점 · provider 요청 구조 · page 1/2 처리 방식 · 현재 TIMEOUT_MS
그 뒤 **CPO 가** 고른다 — A) TIMEOUT_MS 상향 + 2페이지 유지   B) 1페이지 롤백
🔴 CTO 가 A/B 를 임의로 고르지 않는다.
```

### 8-8 완료 조건 — **7개**(🔴 「6개」는 오기였다 · CPO 정정)

```
□ 1 실패 원인이 로그에 **안전하게** 기록된다
□ 2 timeout / provider / runtime 오류를 **구분** 할 수 있다
□ 3 secret · response body **유출 0**
□ 4 기존 SP07 measurement(searches·pages·perPage·organic·failed) **유지**
□ 5 regression PASS
□ 6 typecheck · build · deploy PASS
□ 7 B226AC017 운영 재실행 결과를 **CTO 가 선판독**
```

### 8-9 성공했을 때만 다음으로 간다

```
failed=false · pages=2 · organic>0  ⟹ 그때 비로소
Search result URL → 국내 URL 존재 → candidate → Crawl → Identity → market → price 추적
🔴 그 전에는 **relevance/alias 작업을 시작하지 않는다.**
```

---

## §7 🔵🔵🔵 **CPO LONG SPRINT 작업지시서**(2026-11-02 수령) · 🟡 P3 규격(지금은 §8 이 우선)

🔴🔴 **이 절이 §2·§5 의 실행 조건을 이긴다.** §6 의 순서와 충돌하지 않는다(§6 = 순서 · §7 = 규격).

### 7-0 🔴🔴 먼저 — **§5 와 이 지시서 §7 의 충돌을 해소한다**(CTO 가 발견)

```
§5(앞)      「해외 집계 레코드에 verdict 를 싣는 최소 계약 확장을 **승인**」
지시서 §7    「**임의로 verdict 를 추가하지 않는다**」 + 확장은 아래 4단계를 거친다
⟹ 🟢 모순이 아니다 — **승인은 유효하고 «적용 조건» 이 강화됐다**(공식 실행본 §9 · **5단계**):
   ① **P0 측정**  ② 계약 확장 **필요성 증명**  ③ **영향 범위** 확인
   ④ **국내 가격 축 회귀 검사**  ⑤ **최소 변경**
🔴 그러므로 **P0 측정 «전» 에 verdict 계약을 구현하면 지시서 위반이다.**
🔴 그리고 `priceTier === SOME_TIER` **하나만으로 국내/해외 전체를 기계적으로 차단하지 않는다.**
```

### 7-0-b 🔴 STOP 중 허용되는 것은 **둘뿐** 이다 · 권한이 열리면 **묻지 않고 시작**

```
STOP 중 허용  측정기의 ⒜ **구문 검사** ⒝ **load/SKIP 검사** — 🔴 그 외 실행 **0**
STOP 중 금지  운영 DB 접근 **재시도** · 권한 우회 · **다른 방식의 DB 접근** ·
              측정 결과를 **추정으로 대체** · production re-analysis ·
              Search/Crawl · Identity · Price aggregation · UI ·
              migration/schema · FX · **commit/push**
🔵 권한이 열리면 — 🔴 **질문하거나 추가 승인을 요청하지 않는다.** §7-2 순서를
   **중간 종료 없이** 그대로 실행한다.
```

### 7-1 🔴 목표 — 가격을 맞추는 것이 **목표가 아니다**

> 셀러가 **첫 화면에서** 다섯을 바로 이해하는 상태를 만든다 —
> ① 어떤 상품 ② 동일상품 후보/판매처 **어디** ③ 국내/해외 **얼마에 소싱**
> ④ **어느 판매처** 선택 ⑤ **최종 판매가** 확정. 🔴 그 외는 **상세로 이동 또는 제거**.

### 7-2 🔴 실행 순서 — **변경 금지**

```
P0 측정 → 원인 확정 → P1 최소 수정 → 계약 → Mutation → 전체 Regression
→ Build → Deploy → P2 TEST A/B 운영 검증 → **P3 UI/UX FINAL** → 최종 Regression
→ CEO 5문항 Acceptance 준비 → Sprint 3 완료
🔴 **측정 전에 구현하지 않는다.**
```

### 7-3 P0 ① 운영 DB — `sprint3-discovery-dump.mjs`

```
조건  read-only SELECT · DB write 0 · migration 0 · 운영 데이터 변경 0 · 외부 API 0
확인  snapshot/workspace · candidate_reviews 전체 · candidate_url · seller/domain ·
      system_verdict · match_truth · price_tier · price_amount · currency ·
      price_status · human_verdict
🔴 **CAD 26,300 후보의 «실제 행» 을 특정한다.**
```

### 7-4 P0 ② 라이브 **1회** — B226AC043

```
https://bobochoses.com/en-kr/products/b226ac043-mystery-bc-half-zipped-sweatshirt
🔴 목적은 **후보를 다시 만들어 배포하는 것이 아니다** — 막힌 층을 재는 1회다.
층  Search → Crawl → Identity → **Visibility / Price aggregation**
🔴 **한 행** 으로 연결한다 — candidate → Search 발견 → Crawl 성공 → verdict
   → matchTruth → priceTier → visibility → **집계 진입 여부**
🔴 CAD 26,300 은 **반드시 그 한 행** 으로 연결한다.
```

### 7-5 🔴🔴 P0 핵심 분기 — **측정값으로 «하나» 를 고른다**(추정 금지)

```
Case A  SIMILAR / UNKNOWN 인데 집계 진입        → **가격 집계 «자격»** 문제
Case B  PRESUMED_SAME 인데 실제로 다른 상품      → **Identity 승격/판정** 문제
Case C  Search/Crawl 부터 잘못된 후보 생성       → **Discovery** 문제
Case D  Search/Crawl 에는 있는데 Visibility 에서 사라짐 → **Visibility** 문제
🔴🔴 **복수 원인이 발견돼도 P1 에서는 «실제 핵심 원인 1개» 만 최소 수정한다.**
```

### 7-6 P1 최소 수정 — **확정된 원인 지점 하나만**

```
❌ Discovery 전체 재설계  ❌ Identity 전체 재설계  ❌ 가격 정책 전체 재설계
❌ 후보 검색 쿼리 변경    ❌ FX 변경              ❌ DB schema 변경
❌ **기존 국내 가격 축 회귀**
🔴 실측 보호 — **tier 를 단순히 좁히면 국내 가격이 1 → 0 으로 사라진 선례** 가 있다
   ⟹ 🔴 **국내/해외를 동일 필터로 기계적으로 자르지 않는다.**
```

### 7-7 🔴🔴🔴 P1 가격 집계 원칙 — **두 자격을 혼동하지 않는다**

```
Candidate **Visibility**   ≠   **Price Aggregation Eligibility**
🟢 필요하면 두 계약을 **분리** 한다.
🟢 반대로 **정상 후보는 화면 «그리고» 가격 집계 양쪽에서 유지** 되어야 한다.
🔴 계약 확장이 필요하다는 판단이 나오면 7-0 의 **5단계** 를 그 순서로 거친다.
```

### 7-7-b 🟢🟢 **최종 가격 정책은 확정됐다** — 🔴 단 «적용 방식» 이 제약된다(공식 §11)

```
🟢 **1차 가격 판단에는 SAME / PRESUMED_SAME 후보만 사용한다.**(제품 정책 확정)
🔴 그러나 구현 «전» 에 **P0 실측 + 기존 age-line 정책을 반드시 대조** 한다.
🔴🔴 보호할 경로 — `PRESUMED_SAME → TEXT_CONFIRMED → COMPARISON → aggregation`
🔴 **절대 금지** — **`SAME-only` 를 먼저 적용해 Recall 을 죽이는 것.**
   (실측 선례: tier 를 좁혀 **국내 가격이 1 → 0** 으로 사라졌다)
⟹ 🟢 그래서 §5 의 verdict 자격(**SAME + PRESUMED_SAME**)이 **정책과 일치** 한다 —
   🔴 더 좁히지 않는다. 좁히는 것은 **정책 위반** 이다.
```

### 7-7-c 🔵 **Candidate 가 먼저다 — 가격은 그 속성이다**(공식 §12)

```
Candidate ├─ URL ├─ seller ├─ market ├─ verdict ├─ evidence ├─ price └─ currency
🔴 가격을 **별도의 독립 reference registry 로 만들지 않는다.**
🟢 **가격이 없어도 후보는 살아 있다** — `candidate exists + price unavailable = valid candidate`
```

### 7-7-d 🔵 **Visibility 정책**(공식 §13) — 🔴 Price Eligibility 와 같은 개념으로 취급하지 않는다

```
1차 노출 LIKELY   **SAME** · **SAME_MODEL_OPTION_DIFF** · **PRESUMED_SAME**
1차 노출 Reference 모델코드-only reference 등 **명시적으로 허용된 후보**
🔴 **SIMILAR 를 일반 「유사상품」 후보로 다시 크게 노출하지 않는다.**
🟢 현재 표현 유지 — **「🟡 품번 충돌 · 참고」** 같은 reference 어휘
```

### 7-8 P2 — TEST A / TEST B (**둘 다 실행**)

```
TEST A  Precision · B226AC043 — 엉뚱한 상품 가격이 **동일상품 소싱가로 올라오지 않는가**
        확인 유형 — Stone Island · 다른 브랜드 · **blue/sweatshirt 만 비슷** ·
                    다른 제품군 · 다른 모델
        🔴 다른 상품 가격이 **1차 최저가에 들어가면 FAIL**
TEST B  Recall · B226AC010 — 기존 유효 후보가 **과도하게 사라지지 않았는가**
🔴 두 테스트를 **따로 성공시키지 않는다** — 판단은 한 문장이다:
   「**좋은 후보가 충분히 나오면서 엉뚱한 상품의 가격은 1차 가격에 들어오지 않는다**」
```

### 7-9 계약 — **실제 실패/변경 지점 기준**

```
가격   잘못된 후보가 집계에 들어가면 FAIL · 정상 후보 가격은 **유지**
후보   유효 후보가 visibility 에서 **사라지지 않음** ·
       잘못된 후보가 **동일상품 가격 후보로 승격되지 않음**
시장   국내 회귀 없음 · 해외 회귀 없음 · **양쪽 의미 일관**
UI(P3) first-view exposure · fold depth · information priority ·
       domestic/overseas symmetry · candidate actionability
```

### 7-10 Mutation — P1

```
M1 잘못된 후보를 집계에 강제 포함            → FAIL
M2 정상 후보를 집계에서 제거                 → FAIL
M3 Identity 결과를 SIMILAR/UNKNOWN 으로 변조  → FAIL
M4 정상 후보 visibility 제거                 → FAIL
M5 국내 가격 축 제거                         → FAIL
M6 해외 가격 축 제거                         → FAIL
M7 집계 조건을 **원래 잘못된 조건으로 되돌림** → FAIL
🔴 **추가로 같이 막는다**(공식 §26) —
   **해외 원통화 가격을 KRW owner 에 «직접 주입»** · **FX 하드코딩** ·
   **가격 owner 우회**(`priceOverrideKrw` 밖) · **aggregation contract 우회**
🔴 **변이가 적용되지 않은 PASS 를 성공으로 기록하지 않는다** — 적용 확인 marker 를 남긴다.
🔴 P1 이후 **기존 데이터 계약 변이도 «재실행»** 한다(새로 만든 것만 돌리지 않는다).
```

### 7-11 Regression / Build / Deploy

```
전체 regression → typecheck → build → deploy · **기준선과 비교**
보고 — files · passed · failed · typecheck · build · commit · deploy
```

### 7-12~18 🔴🔴🔴 P3 — **UI/UX FINAL (= Sprint 3 종료조건)**

```
🔴 가격 정확성이 해결됐다고 **UI 를 종료하지 않는다.**
CEO 지적  「공통 UI/UX 너가 **노출하고 싶은 거 그냥 막 써놓은 듯**」
          「정보가 많은데 **알고 싶지도 않은 게 너무 많다**」
첫 화면   ① 상품 판단 → ② 동일상품 후보/판매처 → ③ 국내·해외 소싱 가격
          → ④ 판매처 선택 → ⑤ 최종 판매가 확정  **이 흐름만 남긴다**
방해 정보  **삭제 · 축약 · 상세 이동** 중 하나를 고른다
1차에 남길 것  동일상품 여부 · 후보 판매처 · 국내/해외 소싱가 · 선택 상태 ·
              추천 판매가 · 최종 확정 진입
상세로 보낼 것 긴 Evidence · 진단용 설명 · blocker/conflict 상세 · 내부 판단 근거 ·
              부가 가격 설명 · 기술적 상태 · 첫 판단에 불필요한 전부
🔴 **「보여줄 수 있으니 보여준다」는 이유로 1차에 추가하지 않는다.**
후보 UI   「동일상품 후보 N곳 [후보 보기]」로 이해 가능해야 한다 ·
          🔴 `mi-candidate-list` 에 `open` 을 **임의로 붙이지 않는다**(WU-091 불변식 유지)
대칭      국내/해외 **같은 구조**(시장 → 후보 → 소싱가 → 판매처 → 선택) ·
          차이는 **시장 · 통화 · 환산 표시** 뿐 · 해외는 `GBP 37` + `약 ₩XX,XXX` ·
          🔴 **환율을 만들거나 하드코딩하지 않는다**
가격 의미  **소싱 가격 / 추천 판매가 / 최종 확정 판매가** 가 섞여 보이면 **UX FAIL**
환산 불가  🔴 **「원화 환산 불가」** 로 적는다 — **숫자를 만들어내지 않는다**
          🔴🔴 그리고 **숫자 확정 CTA 를 «제공하지 않는다»**(공식 §21)
환산 owner 🟢 기존 **`convertToKrwStrict()`** 과 기존 FX 구조를 쓴다 · 🔴 **FX 하드코딩 0**
          표기 — `GBP 37` + `약 ₩64,380`(원통화 **그리고** 환산)
최종가 owner 🔴 기존 **`priceOverrideKrw` 를 유지한다** ·
            🟢 **`PriceEditor` · `updateSalePriceKrw` 유지** ·
            🔴 **새 price state / store 를 만들지 않는다**
확정 경로  KRW 후보 → 「이 가격으로 확정」 → `priceOverrideKrw` ·
          해외 → 환산 가능하면 **환산된 KRW 로 확정** · 환산 불가 → **확정 CTA 없음**
구조 owner 🟢 국내/해외는 기존 공통 **`MarketColumn` 구조를 유지** 한다 —
          🔴 서로 **다른 카드 구조를 갖지 않게** 한다(공식 §17)
후보 카드  판단 순서 **판정 → 가격 → 선택 → 상세** · fold **depth ≤ 1** ·
          🔴 `mi-candidate-list` 에 **`open` 금지** ·
          🔴 후보가 기본적으로 **「유력」해 보이는 UI 금지**
🔵 **「다시 분석」 버튼은 «문제가 아니다»**(공식 §23) — 최초 결과 화면의 **정상 자동 분석
   흐름을 유지** 한다. 🔴 핵심 문제는 버튼이 아니라 **자동 분석 결과의 후보군·가격 정확도**
   이므로 🔴 **자동 분석 로직을 UI 문제로 다시 뜯지 않는다.**
제거 기준  「이 정보가 **지금 판매처 선택 또는 가격 확정에** 필요한가?」 → NO 면 제거/상세
```

### 7-19 P3 계약 (UXR) — 🔴🔴 **뜻이 «재정의» 됐다**(공식 실행본 §24)

```
UXR-D  **Detail hierarchy / fold depth**      후보 상세 fold **depth ≤ 1**
UXR-F  **First-screen judgment**              첫 화면에서 **판단** 이 된다(5질문)
UXR-P  **Price meaning / price visibility**   소싱가 / 추천 판매가 / 최종 판매가가 **갈려 보인다**
UXR-S  **Seller selection**                   셀러가 **판매처를 선택** 할 수 있다
UXR-C  **Final price confirmation**           **최종 판매가 수정·확정** 이 된다
🔴 계약은 **실제 마운트 DOM 으로** 검증한다 — 🔴 **snapshot 기반으로 판단하지 않는다.**
```

🔴🔴 **정정 기록** — CTO 요약본의 이전 정의(`D`=fold · `F`=5흐름 존재 · `P`=정보 우선순위 ·
`S`=국내/해외 동일구조 · `C`=후보 행동)는 **폐기** 다. 🔴 그 정의로 계약을 만들면
**`UXR-P`(가격 의미)와 `UXR-C`(최종가 확정)를 한 건도 검증하지 못한다.**
🟢 「국내/해외 동일 구조」와 「정보 우선순위」는 사라진 것이 아니라 **7-12~18 의 본문 규칙**
으로 남아 있고, UXR 다섯은 **그 위에 올리는 축** 이다.

### 7-20 P3 Mutation (M-UX-1~7) — 🔴 **목적으로 적는다**(공식 실행본 §25)

```
후보가 **사라지는** 변이                       → FAIL
가격이 **사라지는** 변이                       → FAIL
**domestic/overseas 구조 불일치**              → FAIL
**final price owner 변경**(priceOverrideKrw 우회) → FAIL
**detail 을 first-screen 으로 끌어올리기**      → FAIL
**fold / open 계약 위반**(`mi-candidate-list` 에 `open`) → FAIL
**FX fallback 위반**(환산 불가인데 숫자를 만든다) → FAIL
🔴 **Mutation 을 통과시키기 위해 contract 를 약화하지 않는다.**
🔴 변이 **적용 확인 marker** 를 남긴다 — 적용 안 된 PASS 를 성공으로 기록하지 않는다.
```

### 7-21 CEO Acceptance — **다섯 모두 YES**

```
① 어떤 상품인가 ② 동일상품 후보가 어디인가 ③ 국내/해외에서 얼마인가
④ 어느 판매처를 선택할 것인가 ⑤ 최종 판매가를 얼마로 확정할 것인가
🔴 하나라도 「어디 있지?」·「이 숫자가 뭐지?」·「왜 이런 정보가 나오지?」·
   「다시 분석해야 하나?」가 나오면 **UI/UX FINAL FAIL**.
```

### 7-22 🔴 절대 금지 (13)

```
❌ P0 측정 전 구현            ❌ 데이터 부족을 UI 문제로 가리고 종료
❌ UI 를 «예쁘게» 만드는 작업   ❌ 새 기능 추가
❌ Discovery 전체 재설계       ❌ Search 전략 임의 변경
❌ Identity 정책 임의 변경     ❌ 가격 정책 임의 변경
❌ FX 정책 변경               ❌ schema/migration 임의 변경
❌ **국내 가격 축을 희생한 해외 필터 수정**
❌ **P0~P2 만 끝내고 Sprint 3 완료 선언**   ❌ **UI/UX 를 «선택사항» 으로 처리**
❌ **CEO acceptance 없이 CLOSED 선언**      ❌ 측정 결과 **추정** · 운영 DB 우회 · 권한 강제
❌ **새 price state / store 생성**
❌ 🔴🔴 **Mutation 약화**                   ❌ 🔴🔴 **테스트를 통과시키기 위한 계약 약화**
❌ 🔴 **기존 GT 삭제**                      ❌ **Recall 을 줄여 Precision 을 맞춤**
❌ **Precision 을 희생해 후보 수만 늘림**     ❌ **실측 전 `SAME-only` 필터 적용**
❌ **age-line 정책 무시**                   ❌ **후보 cap 을 원인으로 가정**
❌ **UI 를 데이터 문제의 «우회책» 으로 사용**  ❌ **`priceOverrideKrw` owner 우회**
❌ **FX 숫자 하드코딩**                     ❌ **「가격이 잘 나온다」만으로 Sprint 3 종료**
❌ **Search query 임의 변경**               ❌ **자동 분석 로직을 UI 문제로 다시 뜯기**
```

### 7-22-b 🔵 **실행 STEP 1~20**(공식 §35) — 🔴 중간에 UI 를 먼저 마무리하지 않는다

```
1 P0 DB read-only      2 TEST A live 1회     3 TEST B 측정        4 CAD 26,300 trace
5 Case A~D 확정        6 P1 원인 **1개** 수정  7 Contract          8 M1~M7
9 Regression          10 Typecheck/Build    11 Deploy           12 TEST A Precision
13 TEST B Recall      14 **P3 UI/UX FINAL** 15 UX Contract      16 UX Mutation
17 Final Regression   18 Production evidence 19 **CEO 5문항**     20 FINAL REPORT(22절)
```

### 7-23 최종 보고 형식 — **22절** · 🔴 중간 보고 반복 금지(**최종 1회**) · 🔴 **모든 수치에 분모**

```
 1 P0 실제 원인                     2 Search/Crawl/Identity/Visibility 분모
 3 **CAD 26,300 «한 행» 분석**       4 **Case A~D 판정**
 5 P1 최소 수정                     6 Contract
 7 Mutation M1~M7                   8 TEST A Precision
 9 TEST B Recall                   10 P3 UI/UX 변경
11 **UXR-D/F/P/S/C**               12 **M-UX-1~7**
13 Full Regression                 14 Typecheck
15 Build                           16 Commit
17 Deploy                          18 Production evidence
19 CEO 5문항                       20 Known Unknowns
21 STOP/Risk                       22 **SPRINT 3 최종 판정**
```
🔴 **보고 절을 19절로 적지 않는다** — 공식 실행본은 **22절** 이다(이 줄은 CTO 요약본이
   19절이었던 것을 정정한 기록이다).

### 7-24 🔴🔴 종료 규칙

```
[ ] P0 actual root cause      [ ] Search denominator      [ ] Crawl denominator
[ ] Identity denominator      [ ] Visibility denominator  [ ] Price eligibility denominator
[ ] **CAD 26,300 one-row trace**                         [ ] **Case A~D decision**
[ ] P1 minimal fix            [ ] Data Contract          [ ] Mutation M1~M7
[ ] **TEST A Precision**      [ ] **TEST B Recall**       [ ] **P3 UI/UX FINAL**
[ ] UXR-D [ ] UXR-F [ ] UXR-P [ ] UXR-S [ ] UXR-C        [ ] **M-UX-1~7**
[ ] Full Regression           [ ] Typecheck               [ ] Build
[ ] Deploy                    [ ] **Production evidence** [ ] **CEO 5-question acceptance**
🔴 **하나라도 빠지면 SPRINT 3 = INCOMPLETE** · 위 전부 ✅ ⟹ 🟢 SPRINT 3 = CLOSED
🔴 Production 검증은 **마운트 DOM 기준** 이다 — **`HTTP 200` 만으로 UI PASS 처리하지 않는다**
🔴🔴 **Sprint 3 CLOSED 전에는 «완료 보고» 를 하지 않는다**(공식 §40)
그 전에는 🔴 **SPRINT 3 = INCOMPLETE**
🔴 CLOSED 되기 전에는 **Sprint 4 / 새 Discovery 기능으로 넘어가지 않는다.**
```
