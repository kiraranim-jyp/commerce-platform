# HANDOFF — CORE-2R-4 (다음 세션 전용 · 2026-10-24)

> 🔴🔴🔴 **이 문서는 「막혔을 때 여는 상세 문서」다. 진입점은 여전히 `docs/START-HERE.md §6` 하나다.**
> 🔴 **재조사 금지.** 아래 좌표는 전부 **코드/DB/실측으로 확정된 값** 이다. 다시 조사하면 시간을 버린다.
> 🟢 다음 세션은 **STEP 2 구현부터** 시작한다.

---

## 1. 제품 목적 / 핵심 전략

> **「따져보고 판매하라.」** — 상품을 많이 등록하는 것이 목적이 아니다.

```
해외 상품 발견 → 상품 사실 확인 → 시장/가격/수익성 판단 → 판매 가능 여부 판단 → Commerce 등록
```

**현재 1차 제품 목표(CPO 확정)** — 이 한 줄이 작업 선별 기준이다:

```
상품 1개 입력 → 동일상품 확인 → 국내 시장가격 → 해외 최저 소싱가격 → MI 판매 판단
🔴 「국내/해외 가격비교가 정확하게 되느냐?」에 «직접» 영향을 주는 작업만 한다.
```

---

## 2. 역할과 보고 방식

| | |
|---|---|
| **CEO** | 제품 방향 · 사업 승인 · **실제 Production 화면 최종 확인**. 🔴 중간 디버깅/테스트를 하지 않는다 |
| **CPO (GPT)** | 범위·우선순위 확정 · 작업지시서 · **중간 선택지 판단** · PASS/REWORK/HOLD 판정 |
| **CTO (Claude)** | 조사 → 구현 → 테스트 → 음성대조 → 회귀 → 배포 → 증거 → **보고 1회** |

```
🔴 CTO 는 「이렇게 할까요?」를 반복하지 않는다. 한 번 시작하면 가능한 범위까지 자율로 끝낸다.
🔴 CTO 는 「⒜⒝⒞ 중 무엇을 열까요」를 **CEO** 에게 묻지 않는다 → **CPO** 에게 올린다.
🔴 게이트 — CTO 1차 → CPO 2차 → CEO 최종. **CTO→CEO 직행 금지.**
🔴 용량이 부족하면 작업을 쪼개지 말고 **안전 종료 지점까지 가고 clean 으로 handoff** 한다
   (헌장 §4-C). 작업트리를 더럽힌 채 끊기는 것이 가장 나쁘다.
```

---

## 3. 현재 상태 — 배포 · 작업트리 · DB

```
배포      🟢 **완료** — `2364b048 → aa8b7e5e` **18커밋** push 됨
          `behind 0` ⟹ production branch 가 전부 받았다(구조적 증거)
          Production `/` **HTTP 200** · `/pipeline` 307 · `/api/price-history/check` 401(정상 보호)
          🟢 그 안에 **WU-145 / 146 / 148 / 149** 의 UI 정리가 **처음** 올라갔다
          🔴 「Production UI PASS」로 적지 않았다 — 빌드 로그의 `Commit:` 줄을 CTO 가 읽을 수 없다

작업트리  🟢 **clean**
미push    🔴 **문서 커밋 4개**(`0709f4de` · `00ea0a17` · `1a508680` · 이 문서)
          🔴 **push 하지 않았다** — CPO 승인은 **18커밋에 한정** 이었고 `main` push 는 배포를 부른다

DB        🟢 `domestic_price_sources` 에 **`donokids.com` 1행 적용 완료**(CORE-2R-1)
          `도노키즈 / donokids.com / **MANUAL** / enabled=true / scope=KIDS_FASHION / workspace_id=**NULL**`
          34행 → **35행** · 두 번 적용해도 1행(**멱등 실측**)
          SQL `packages/database/prisma/migrations_manual/080_domestic_price_source_donokids.sql`
          적용 수단 `cd packages/database && npx prisma db execute --file … --schema prisma/schema.prisma`
```

### 🔴🔴 DB 함정 — 42P10 (다음 세션이 또 밟지 않도록)

```
029 DDL 은 `domain text not null unique` 라고 적는다. 🔴 **Production 은 다르다**:
  domestic_price_sources_owner_domain_key
    UNIQUE INDEX ON (COALESCE(workspace_id,'00000000-0000-0000-0000-000000000000'::uuid), **domain**)
⟹ `on conflict (domain)` 은 **42P10** 로 거부된다. 🟢 **타깃을 생략한 `on conflict do nothing`** 을 쓴다.
🔴 교훈 — **DDL 파일이 적는 제약과 실제 Production 제약이 다를 수 있다**
   (`migrations_manual` 은 사람이 적용하므로 drift 가 생긴다 · WU-141-R1 과 같은 계열).
🟢 DB 조회 수단 — `pg` 모듈이 **없다**. `prisma db execute` 는 **행을 돌려주지 않으므로**
   `do $$ … raise exception '%', v; end $$;` 로 값을 꺼낸다(읽기 전용 · 롤백된다).
```

---

## 4. CORE-2R-4 현재 상태 — **CEO 화면 FAIL 의 원인은 «A 단계»**

```
CEO 테스트 결과(2026-10-24) — **FAIL**
  국내가격 미표시 ❌ · 가격 결과 중복 ❌ · 다시 분석 부재 ❌
```

> ### 🔴🔴 **A~F 중 «A 단계(데이터 생성)» 에서 ₩88,000 이 소실된다.**
> 정확히는 **「소실」이 아니라 «애초에 생성되지 않는다»** — `donokids` 후보가 운영에서 만들어지지 않는다.

```
`packages/crawler/src/comparison-search/index.ts`
  :271  collectionStrategy 가 `AUTO_API`/`AUTO_SCRAPE` 아니면 → **status "unsupported" · candidates []**
        🔴 우리가 넣은 행은 **`MANUAL`** 이라 **여기서 즉시 멈춘다**
  :278  `findPriceSourceAdapter(domain,"DOMESTIC")` 없으면 → **"unsupported" · candidates []**
        🔴 `donokids` 어댑터는 **존재하지 않는다**(전수 grep — 주석 1건이 전부)
⟹ 🔴 게이트가 **둘** 이고 **둘 다 막는다**(WU-115 가 측정한 그 구조).
⟹ 🔴 **등록부 경로로는 열 수 없다** — CPO 가 새 어댑터를 금지했다.
🟢 그래서 CORE-2R-1 의 1행이 고친 것은 **「market 판정」 하나** 다 —
   후보가 **주어졌을 때** KR 이 되게 했고, **후보를 만들지는 못한다**.
🔴 B~F 단계는 **검사할 입력이 없어서** FAIL 이고 **그 단계들의 결함이 아니다.**
```

---

## 5. WU-063 ↔ Market Evidence 판단 정리 (CPO 확정)

```
🟢 **WU-063 은 유지된다** · `mi-020` 계약도 **폐기하지 않는다**.
   WU-063 이 막은 것 = 「**단일 페이지 신호를 KR 판정의 «결정자»로** 사용하는 것」
   실측 근거 — 페이지 단위 신호(사업자등록 · `lang=ko`)는 **같은 샵에서 갈린다**
              (donokids C21 ✓ · C22 ✓ · **C43 ✗**)
🟢 이번 작업 = 「**여러 증거를 모으는 구조**」 ⟹ **충돌하지 않는다**(CPO 정리).

❌ 금지 — `lang=ko` 단독 → KR · 사업자등록 단독 → KR · `.com+KRW` 단독 → KR ·
          **registry 등록 단독 → KR** · 특정 신호 하나로 `market=KR` 강제
🟢 허용 — TLD · currency · URL/domain · 기존 Extract · shipping · customs · payment ·
          business information · footer · address · 판매조건을 **종합**
🟢 부족하면 **최소 추가 evidence** · 그래도 불명확하면 **UNKNOWN**
```

### 🔴🔴 그리고 그 첫 질문은 **이미 닫혔다**

```
CPO: 「KR 판정용 composite evidence gate 가 «현재 데이터» 로 가능한가를 먼저 측정하라」
🔴 답: **불가능하다**(2026-10-24 코드 전수 확인)
   `ProductFacts`(packages/shared) · `ComparisonCandidate`(crawler types) ·
   `product-data-extractor` 전수 grep —
     businessRegistration · 사업자 · 통신판매 · mailOrder · bizNo ·
     companyAddress · customsCode · 통관  ⟹ **0건**
🟢 `ProductFacts` 의 실제 칸은 **14개** 다:
   urlSlug · brand · brandModelCode · sellerSku · title · coreTitleTokens ·
   categoryText · colorText · materialText · fitText · ageRangeText ·
   sizeLabels · audienceSignals · imageUrls
⟹ 🟢 그래서 **「최소 추가 evidence 수집」이 선행** 이다(STEP 3).
```

---

## 6. 🔵 다음 세션 작업 순서 — **재조사 없이 STEP 2 부터**

```
① 기존 **WU-149 코드/계약 확인**  🔴 Production UI PASS 로 주장하지 않는다(화면 못 봄)
② **2-hop production wiring**     ← 🟢 **여기부터 구현**
③ **별도 `marketEvidence`** 최소 추출 구조 추가
④ evidence **composite** 로 KR / OVERSEAS / UNKNOWN 판정
⑤ B226AC009 → Dono **₩88,000** 실제 연결
⑥ `domestic.exact.averagePriceKrw` → 기존 MI
⑦ seller UI / 중복 / 다시 분석 확인
⑧ 회귀 + clean + 배포
⑨ 그때 **CEO 최종 1회** 테스트
```

### STEP 2 — 2-hop 운영 배선 (좌표 고정)

```
🟢 모듈은 **이미 있다** · 🔴 **운영 호출부 0**(전수 grep 확인)
  apps/admin/src/app/api/price-history/_lib/domestic-listing-hop.ts
     expandDomesticListing(entryUrl, code)  ← robots → sitemap.xml(HTTP 1) → 목록 HTML
     pickDetailUrlsForCode · extractSitemapLocs · extractHrefs · robotsAllowsAll
     상수 LISTING_LINK_LIMIT=5000 · DETAIL_PICK_LIMIT=10 · MIN_CODE_LENGTH=4
  apps/admin/src/app/api/price-history/_lib/domestic-listing-hop-2.ts
     collectListingEntries(html, baseUrl, detailMarker)  🔴 **href 중복제거를 하지 않는다**
        (도노키즈는 한 상품을 두 번 링크하고, 먼저 dedupe 하면 상품명이 없는 썸네일 창만 남아
         **품번 일치 0** 이 난다 — 1차에 그 거짓 결론이 났다)
     pickByListingText(entries, code) · codeVariants(code) · extractPageLinks · uniqueHrefCount
     상수 BLOCK_WINDOW=1200 · PICK_LIMIT=10 · MAX_PAGES=6
     🔴 `codeVariants` 는 **두 꼴뿐** — 원형 `B226AC009` · 선행 영문자 제거 `226AC009`
        (도노키즈가 `#226AC009` 로 적는다 — **실측된 표기** 이고 추측이 아니다)

🟢 붙일 자리 = **transient 생산자 «네 번째»**. 🟢 선례를 그대로 베낀다 —
   WU-130 의 `__overseas_auto__`(`_lib/overseas-auto-pool.ts` · `transient-candidates.ts`)

🔴🔴 계약 넷을 **동시에** 지킨다(하나라도 빠지면 DB/집계가 오염된다)
  ⒜ `TRANSIENT_SHOP_IDS` 에 **반드시 추가** — 빠뜨리면 `upsertDomesticProductLink` 로
     **DB 에 흘러간다**(국내 최저가·판정 입력·`price_alerts` 오염)
  ⒝ `shopId` 에 **등록부 uuid 를 넣지 않는다** — 전용 상수를 쓴다
  ⒞ `GeminiTransientEvidence.source` 를 **새 값으로 가른다**(「그 외는 Gemini」로 두지 않는다)
  ⒟ **국내 등록부 후보는 sink 로 보내지 않는다** — `domesticCompetition` 와 **이중 집계** 된다
🔴 `donokids` 전용 하드코딩 **금지** · 새 어댑터 **금지** · 새 검색엔진 **금지**
```

### STEP 3 — `marketEvidence` (CPO 가 타입 설계를 수정했다)

```
❌ `ProductFacts` 14칸에 시장정보를 **추가하지 않는다** — 그 타입은 **상품 identity/evidence 용**
   이고, 섞으면 「상품 ↔ 판매자/사이트 ↔ 시장」이 다시 뒤섞인다
🟢 **별도 구조** 로 붙인다:
      ComparisonCandidate
        ├─ productFacts
        └─ **marketEvidence**
🟢 추출은 **이미 Fetch 한 HTML** 에서 — **추가 HTTP 원칙적으로 0**
   (`fetchPlainHtml` 이 본문을 이미 받는다 · WU-053 microdata reader 와 **같은 모양**)

최소 범위(CPO 고정 · 처음부터 전부 구조화하지 않는다)
  강한 증거  businessRegistration · mailOrderRegistration · businessAddress ·
            customs / import-duty / customs-clearance 신호
  보조 증거  shipping · payment · 기존 TLD / currency / domain
  판정       기존 데이터 → marketEvidence → **복수 증거 종합** → KR / OVERSEAS / UNKNOWN
🔴 **어느 한 필드 하나만으로 KR 확정 금지**
🔴 DB 의 `donokids` 행은 **삭제하지 않는다**(CPO 명시) — 다만 **KR 판정의 원인이 되면 안 된다**
```

### STEP 4~6 — 기존 배선 좌표 (전부 확정)

```
market 판정   apps/admin/src/app/api/price-history/_lib/candidate-market.ts
              `CandidateMarketInput`:54 = { **domain** · **currency** · **isRegisteredDomesticShop** }
              basis 값 — KR_TLD_AND_KRW · REGISTERED_SHOP_AND_KRW ·
                         KRW_WITHOUT_DOMAIN_EVIDENCE · FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE ·
                         CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY · NO_PRICE_EVIDENCE
              호출부 `run-domestic-price-check.ts:1574` ← `registeredDomains`(:949 · **필터 «전»** 목록)

국내 가격 적재 apps/admin/src/app/api/price-history/_lib/market-intelligence.ts
              :247  `market !== "KR"` 분기에서 KRW → `krwWithoutKrEvidence += 1` → **continue**
                    🔴 **KRW 라도 market 이 KR 이 아니면 가격 축에 안 들어간다**(WU-020 §4)
              :318  `priceTier === "EXACT" || "COMPARISON"` → 적재
                    🟢 **CPO 가 확정한 현행 정책이 이 줄** 이다(PRESUMED_SAME 강제 승격 0)

MI 입력       :720  computeSellability({ costPriceKrw, domestic: {
                      matched: domesticMarketSplit.**exact**.sellerCount > 0,
                      averagePriceKrw: domesticMarketSplit.**exact**.averagePriceKrw } })
              :753  toSellerFacingVerdict(representativeVerdict)
              :762  buildSellerDecision({ priceVerdict, signals })
              :886  응답에 finalVerdict 실림

판정식        packages/pricing/src/sellability.ts:44  computeSellability — 분기 **다섯**
                1 costPriceKrw == null || <= 0                → **UNKNOWN**
                2 !domestic.matched || averagePriceKrw 없음     → **YELLOW**
                3 referencePrice = **domestic.averagePriceKrw**
                  marginPercent = ((ref − cost) / ref) × 100
                4 marginPercent < **marginFloor(기본 10)**      → **RED**
                5 else                                         → **GREEN**
              🔴 해외 물류비·수수료는 **들어가지 않는다**(소스 문구)
              packages/pricing/src/representative-seller-decision.ts:315 toSellerFacingVerdict
              packages/pricing/src/seller-decision.ts:209 buildSellerDecision → **finalVerdict**

화면 가격축   apps/admin/src/app/pipeline/commerce/mi-same-candidates.ts
              :48   transientDisplayTier(row) — **`row.matchTruth` 를 먼저** 읽는다(없으면 crossSellerVerdict)
              :99   isPriceConfirmed = priceStatus **VERIFIED_CURRENT** && 금액 && 통화
              :268  buildPriceGuide(j, market)
              :1004 buildMarketJudgement · **:1012 `if (transientDisplayTier(row) !== "SAME") continue;`**
              🔴🔴 **가격 축(화면)은 `SAME` 하나만 받는다** — `exact` 버킷(위)과 **다른 경로** 다
```

---

## 7. 허용 / 금지

```
🟢 허용
   · 기존 2-hop production wiring
   · 필요한 **최소** market evidence extraction/gate(별도 `marketEvidence`)
   · 국내 가격 → 기존 MI 입력 연결
   · 필요한 UI 연결 / 버그 수정

🔴 금지(전부 CLOSED 유지)
   SAME 기준 · product-code weighting · code normalization(`226AC009 → B226AC009` 보정) ·
   `crossSellerReserved` · `NO_TITLE_OVERLAP` · MI threshold · `SAME_MIN_AXES` ·
   가격 계산 로직 · `computeSellability` 판정식 · 추천 판매가 · 마진/원가 시스템 ·
   검색엔진 변경 · AI API(Gemini/OpenAI/Naver) · 유료 API · 신규 adapter ·
   `donokids` 전용 하드코딩 · 다른 쇼핑몰 추가 · `domestic_price_sources` 추가 등록 ·
   Mini Boutique 재조사 · seller UI 대규모 개편
```

---

## 8. B226AC009 최종 E2E 목표

```
① B226AC009(Bobo Choses Hug Hairy Monster T-shirt)
      ↓
② donokids 후보 **생성**(2-hop)
      ↓
③ 상세 URL Fetch / Extract
      ↓
④ SAME(또는 현행 가격 정책이 허용하는 등급)
      ↓
⑤ **marketEvidence 종합 → market = KR**
      ↓
⑥ **KRW 88,000**
      ↓
⑦ `domestic.exact`
      ↓
⑧ `averagePriceKrw = 88,000` → `computeSellability`
      ↓
⑨ 셀러 화면 표시
⑩ 가격 중복 없음   ⑪ 「🔄 다시 분석」 동작
```

### 확정된 실측값 (재측정 불필요)

```
donokids.com  상세 URL `https://www.donokids.com/shop/shopdetail.html?branduid=3362785`
              가격 **KRW 88,000** · priceStatus **VERIFIED_CURRENT** · robots **Allow: /**
              🔴 `og:title` 이 **빈 문자열** · 상품명에 `#226AC009`(**선행 B 없음**)
              🔴 등록부 없으면 market **UNKNOWN**(`KRW_WITHOUT_DOMAIN_EVIDENCE`)
              🟢 등록부 있으면 market **KR**(`REGISTERED_SHOP_AND_KRW`) ← 운영 함수로 실측
              운영 등급 **PRESUMED_SAME / TEXT_CONFIRMED**(품번 칸 null · 축 ["TITLE","CATEGORY"])
miniboutique.co.kr  🔴 **5회 연속 UNREACHABLE** — **측정불가**(0 으로 세지 않는다 · 범위 밖)
              🟢 `.co.kr` 이라 등록부 없이도 KR 이 될 수 있다 · 가격 KRW 88,000(CORE-2F 실측)

CEO Visual GT  `apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/core-2m-ceo-visual-gt.json`
               **SAME 8 · DIFFERENT 1(parkette) · UNCERTAIN 1(bornyesterdaykids)** · URL 키
               `ceoUiLabel`(동일/유사/판단불가) ↔ `calibrationLabel`(SAME/DIFFERENT/UNCERTAIN) 분리
               `historicalConflicts` 2건 보존(m.luxboy DIFFERENT→SAME · bornyesterday SAME→UNCERTAIN)

회귀 기준선   **650 files / 8,918 passed / 1 failed** · typecheck **0** · build exit **0**
              🔴 유일한 실패 `packages/crawler/.../p54c1-grounding-redirect.test.ts` —
                 **이 트랙과 무관** 하고 CPO 가 **합산 제외** 로 확정했다(원인 미규명 · 별도 WU)
```

---

## 9. CEO 테스트 — **마지막 1회만**

```
🔴 지금은 CEO 가 볼 차례가 아니다. ②~⑦ 을 전부 끝낸 뒤 **딱 한 번** 넘긴다.
URL    https://ttaejyo.vercel.app/pipeline  (로그인 필요)
상품   **B226AC009** · Bobo Choses · Hug Hairy Monster T-shirt
기대   · 🇰🇷 국내 동일상품 **₩88,000** 표시(확인 1곳)
       · 🔴 **가격대(`₩88,000 ~ ₩88,000`)로 표시하면 FAIL** — 1곳이면 **단일 참고가격**
       · 🌎 해외 결과 유지(GBP 37 · USD 58 계열) · 국내와 **섞이지 않음**
       · MI 판단에 국내 가격 반영 · 🟢 원가 미입력이라 **UNKNOWN 이어도 정상**
       · 동일 가격 결과 **중복 노출 없음** · 「🔄 다시 분석」 **존재**
       · 🔴 후보 리스트가 핵심 판단을 **압도하지 않음**
```

---

## 10. 🔴 이전 실수 2건 — 재발 방지

```
⒜ **「하니스 PASS」를 `E2E PASS` 로 적었다**(CORE-2R-2)
   🔴 재발 방지 — **셀러 화면을 확인하지 못하면 `E2E PASS` 로 닫지 않는다.**
      CTO 는 로그인 뒤 화면을 볼 수 없다(`/pipeline` 307 · 메모 `production-payload-is-unreachable`)
      ⟹ 화면 축은 **마운트 DOM / 소스 계약** 이고, **Production UI PASS 는 CEO 1회로만** 닫힌다.

⒝ **CORE-2R-1 에서 `MANUAL` 을 고르고 「후보가 생성되지 않는다」는 귀결을 적지 않았다**
   🔴 재발 방지 — **선택의 «귀결» 을 끝까지 적는다.** 「검색은 돌지 않고 판정만 얻는다」까지
      쓰고 멈추면, 읽는 사람은 「연결됐다」로 읽는다.
```

### 🔴 이 트랙에서 반복된 함정 (전부 실제로 밟았다)

```
① **칸 이름/타입을 추측했다** — 15회 이상. 🟢 타입/소스에서 **읽고** 쓴다
   실례 — `ComparisonCandidate.price` 는 숫자가 아니라 **`{amount,currency}|null`**(types.ts:7) ·
          `CandidateMarketResult.reason`✗(실제 `basis`) · `MiSameRow`✗(실제 `GeminiTransientRow`) ·
          `PriceGuide.priceUnknownCount`✗(실제 `unpricedCount`) · `KrwPrice.amount`✗(`amountKrw`) ·
          `GeminiTransientRow` 의 owner 는 `mi-same-candidates` 가 **아니라 그 컴포넌트 파일**
② **정규식/코드를 쉘·파이썬으로 편집했다** — 6회. 백슬래시·`\n` 이 소실돼 파일이 깨진다
   🟢 **Edit 툴로만** 쓴다. 🔴 템플릿 리터럴 안에 **백틱 중첩** 금지
③ **변이가 적용됐는지 확인하지 않았다** — 「적용 실패」를 「통과」로 읽은 적이 있다
   🟢 변이마다 **적용 확인 grep** 을 넣고, 복구 후 **`git diff` 로 바이트 확인**
④ **`.test.tsx` 는 vitest 가 수집하지 않는다**(`include` 가 `*.test.ts`)
   🟢 DOM 테스트는 `.test.ts` + `createElement` + `IS_REACT_ACT_ENVIRONMENT = true`
⑤ **단언 좌표가 틀렸다** — `not.toContain("checked")` 가 내 `:checked` 선택자에 걸렸고,
   `not.toContain("<")` 가 `i<a.length` 에 걸렸다. 🟢 **범위를 좁혀** 단언한다
⑥ **하니스에 운영 호출 순서를 빠뜨렸다** — `withConfidence` 를 안 불러 확인 배선이 죽었고
   `priceTier` 만 채워 가격이 0 이 됐다. 🟢 **운영 호출 순서를 그대로 베낀다**(§5-B)
⑦ **「측정불가」를 0 으로 적지 않는다** — `miniboutique` UNREACHABLE 이 그 자리다
```

---

## 11. 토큰/컨텍스트 절약 원칙

```
🟢 측정은 **한 하니스 · 한 실행** 으로 묶는다(라이브 fetch 는 1건당 수십 초다)
🟢 파일 전체를 읽지 말고 **`grep -n … -A/-B`** 로 필요한 구간만 읽는다
🟢 소스 확인은 **주석을 벗기고**(`/\*…\*/`·`//`) 한다 — 여덟 번 걸린 함정
🟢 회귀는 **마지막에 한 번**(8,900건 · 수 분). 중간에 반복하지 않는다
🔴 같은 것을 다시 조사하지 않는다 — 이 문서의 좌표를 **그대로 쓴다**
🔴 용량이 부족하면 **구현을 시작하지 말고** clean 으로 handoff 한다(§4-C)
```

---

## 12. CTO 보고 형식

```
1 Scope          2 변경 내용       3 조사 결과      4 구현 결과
5 Data/DB        6 Payload         7 UI/Render      8 Positive Test
9 Negative/Mutation  10 Regression  11 Typecheck    12 Build
13 Commit/Push   14 Deploy         15 Production Evidence
16 External API Evidence           17 Known Unknowns  18 Final Gate

마지막에 반드시(🔴 등급을 섞지 않는다):
Code PASS:            Deploy PASS:
Test PASS:            Production UI PASS:
Type PASS:            Production API PASS:
Build PASS:           Production PASS:

🔴 Git 절에는 **clean 여부와 ahead/behind 숫자를 같이** 적는다
   `git fetch origin --quiet && git status && git rev-list --left-right --count origin/main...HEAD`
🔴 「측정불가」와 「0」을 구분한다 · 표본 숫자에는 **`sample N=x`** 를 적는다
🔴 보고 전 3문 — ① 전수인가 표본인가 ② 그 숫자가 다음 단계를 통과했는가
   ③ 거부/null/0 을 「올바른 부재」로 가정했는가
```

---

## 13. 첫 명령 (복붙)

```bash
cd /c/Users/김성길/Documents/GitHub/commerce-platform
git fetch origin --quiet && git status && git rev-list --left-right --count origin/main...HEAD
# 그 다음 — 재조사 없이 STEP 2 구현부터:
#   apps/admin/src/app/api/price-history/_lib/domestic-listing-hop.ts
#   apps/admin/src/app/api/price-history/_lib/domestic-listing-hop-2.ts
#   선례: _lib/overseas-auto-pool.ts · _lib/transient-candidates.ts (WU-130)
```
