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

## §3 🔴 이번 스프린트에서 **이미 끝난 것**(다시 하지 않는다)

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
