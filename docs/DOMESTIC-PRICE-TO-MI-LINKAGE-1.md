# DOMESTIC-PRICE-TO-MI-LINKAGE-1 — KRW 88,000 의 데이터 계보

> 🔴 **조사 전용.** 운영 코드 변경 **0** · Identity/Probe **0** · matcher/threshold/GT **0** ·
> 국내 EXACT 자격 완화 **0** · `PRESUMED_SAME` 승격 **0** · 가격 산출 공식 **0** · 미커밋 39건 보존.
> 기준 Production **`a19c7db6`**(Ready · Commit `a19c7db` = HEAD).

---

## 0. 결론 — **원인 E(복합)** 이고 사슬이 «둘» 이다

```
🟢 가격과 Identity 는 **끊기지 않았다** — 같은 후보 행에 둘 다 있다 ⟹ 🔴 원인 **B 아님**
🟢 표시 owner 는 서로 다르지만 **각자 정확한 것** 을 말한다 ⟹ 🔴 원인 **D 아님**
🔴 ① KR 후보 2건은 가격·판별이 **둘 다 있는데** BRAND 축 blocker 로
     `PRESUMED_SAME` → tier **COMPARISON** ⟹ EXACT 자격 탈락            = 원인 **C**
🔴 ② 유일한 **SAME · EXACT · blockers 0** 후보(`bobochoses.com`)가
     **market 충돌**(국내 등록부 소속 ↔ 가격 **EUR**)로 `UNKNOWN` ⟹ 국내·해외 **양쪽에서 제외**
⟹ `domesticBasis = COMPARISON` → `marketCase D` → 수익성 **판단 불가**
```

🔴🔴 **화면의 두 숫자는 모순이 아니다 — 서로 다른 게이트다**(설계대로):
```
「국내 참고가격 KRW 88,000」   tier **EXACT | COMPARISON** 을 받는 «참고» 축
「동일상품 확인 0곳」          displayTier **SAME** 만 세는 축 (PRESUMED_SAME 은 SAME 이 아니다)
```

---

## 1. 대상 — CEO 가 본 «바로 그» 스냅샷

```
snapshot  16155f19-eef8-4300-9016-f275cc569bcd
title     Hug Hairy Monster T-Shirt by Bobo Choses
last_opened_at  2026-11-08T23:39:53Z   ← 🟢 배포(23:28) **직후** 열람
```
🟢 그 화면이 **「국내 판매 사례 확인 필요」** 를 말한 것은 직전 배포(`MARKET_OPPORTUNITY` 분리)가
**운영에 도달했다** 는 직접 증거다(전에는 「조건부 판매」였다).

---

## 2. 후보별 계보 (DB `candidate_reviews` 전수 · 6건)

| # | 후보 | market | verdict | match_truth | tier | 가격 | priceStatus | blockers | source |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `vividvia.com` | **KR** | PRESUMED_SAME | TEXT_CONFIRMED | **COMPARISON** | **KRW 88,000** | VERIFIED_CURRENT | **BRAND_MISMATCH** | WEB_SEARCH |
| 2 | `donokids.com` | **KR** | PRESUMED_SAME | TEXT_CONFIRMED | **COMPARISON** | **KRW 88,000** | VERIFIED_CURRENT | **BRAND_UNCONFIRMED** | DOMESTIC_LISTING |
| 3 | `peipeicollection.com` | OVERSEAS | PRESUMED_SAME | TEXT_CONFIRMED | COMPARISON | TWD 1,980 | PRICE_UNAVAILABLE | BRAND_UNCONFIRMED | WEB_SEARCH |
| 4 | `kihanan.com` | OVERSEAS | PRESUMED_SAME | TEXT_CONFIRMED | COMPARISON | JPY 7,590 | UNVERIFIED_SEARCH | BRAND_MISMATCH | WEB_SEARCH |
| 5 | `junioredition.com` | OVERSEAS | PRESUMED_SAME | TEXT_CONFIRMED | COMPARISON | GBP 33 | VERIFIED_CURRENT | MODEL_CODE_AGE_LINE · FIT · SAME_SELLER_DISTINCT_LISTING · MODEL_CODE | OVERSEAS_AUTO |
| 6 | 🔴🔴 `bobochoses.com` | **UNKNOWN** | **SAME** | **EXACT_IDENTIFIER** | **EXACT** | **EUR 40** | VERIFIED_CURRENT | **[]** | WEB_SEARCH |

### 요구한 표(가격 → Identity → L3 → tier → 수익성 사용)

| 후보 | 가격 수집 | Identity 판별 | L3 결과(blocker) | 최종 tier | 수익성 판단 사용 |
|---|---|---|---|---|---|
| vividvia.com | 🟢 KRW 88,000 | 🟢 **돌았다** | 🔴 BRAND_MISMATCH | COMPARISON | 🔴 **아니오** |
| donokids.com | 🟢 KRW 88,000 | 🟢 **돌았다** | 🔴 BRAND_UNCONFIRMED | COMPARISON | 🔴 **아니오** |
| bobochoses.com | 🟢 EUR 40 | 🟢 **돌았다** | 🟢 **blocker 0** | **EXACT** | 🔴 **아니오**(market UNKNOWN) |

🟢 `domestic_product_links` = **0행** ⟹ 국내 후보는 전부 **transient** 경로다(저장 링크 없음).

---

## 3. 왜 EXACT 가 되지 않았나 — 두 사슬을 갈라서 적는다

### 사슬 ① — KR 후보 2건은 **BRAND 축** 에서 멈춘다

```
PRESUMED_SAME (crossSellerVerdict)
  → match-truth 의 `crossSellerReserved` 가 식별자 경로를 막는다
  → matchTruth TEXT_CONFIRMED → priceTier **COMPARISON**
  → market-intelligence.ts:354  `if (e.priceTier === "EXACT")` 에 **안 걸린다**
  → `exactShopRecords` 비어 있음 → `domesticMarketSplit.basis = COMPARISON`
```
🔴 blocker 는 **BRAND_MISMATCH / BRAND_UNCONFIRMED** 둘이다. 🔴🔴 그 축은
**WU-080 에서 CPO REJECT · WU-138 에서 완화 REJECT** 된 **동결축** 이고 CTO 가 열지 않았다.

### 사슬 ② — 🔴🔴 **유일한 EXACT 후보가 «시장 충돌» 로 버려진다**

```
bobochoses.com   SAME · EXACT_IDENTIFIER · tier **EXACT** · blockers **0** · EUR 40 검증됨
DB 등록부 실측    name「Bobo Choses Korea(공식)」 · domain `bobochoses.com`
                 enabled **false** · AUTO_API · scope KIDS_FASHION
⟹ `classifyCandidateMarket` — **등록부 소속(KR 증거) + 외화(EUR) = 충돌 → UNKNOWN**
⟹ 국내 축 조건(`market === "KR"`) ✗ · 해외 축(`OVERSEAS`) ✗ ⟹ **양쪽에서 제외**
```

🟢 **이것은 버그가 아니다** — WU-020/051 이 세운 보호다(「통화 단독으로 시장을 정하지 않는다」·
「EUR 가격을 국내 시장가로 쓰지 않는다」). 그 페이지는 브랜드 **글로벌** 몰이고 EUR 40 을
「국내 시장가격」이라 부르면 **화면이 거짓말한다**.
🔴 그러나 **결과** 는 분명하다 — 국내 EXACT 가 **구조적으로 0** 이 된다.

---

## 4. 수익성 판단 경로 — 끊기는 한 줄

```
price-recommendation.ts:123
  if (input.domesticBasis !== "EXACT" || input.domesticLowestPriceKrw == null) → marketCase **"D"**
      ⟹ recommendedPrice **null** · estimatedMarginPercent **null**
  (호출부 market-intelligence.ts:600 · `domesticBasis: domesticMarketSplit.basis`)
      ↓
sellability **YELLOW**(원가는 있고 국내 동일상품 없음)
      ↓
representative **MARKET_OPPORTUNITY** → facing **CONDITIONAL**
      ↓
화면 「국내 판매 사례 확인 필요」 + 「가격 수익성: 확인 불가 — 국내 동일상품 가격 근거가 없어…」
```

🔴 즉 **「국내 판매 사례 확인 필요」의 직접 입력값은 `sellability.level === "YELLOW"`** 이고,
그 YELLOW 의 뿌리는 `domesticBasis !== "EXACT"` 하나다.

### 「KRW 88,000 이 B 국내 참고가격에 반영되는 조건」

```
🟢 반영됨      tier ∈ {EXACT, COMPARISON} + market KR + priceKrw  → `domesticTransientRecords`
                → `candidateDomesticPrice` → 화면 「국내 참고가격」
🔴 반영 안 됨   `domesticLowestPriceKrw`(= 수익성 입력)는 **basis EXACT** 를 같이 요구한다
⟹ **같은 88,000 이 「참고가격」에는 들어가고 「수익성 입력」에는 안 들어간다.**
   🔴 두 칸의 owner 가 다른 것이 **의도** 다(WU-039/059 가 세운 경계).
```

---

## 5. 🔴 측정 경계 — 넘겨 읽지 않는다

```
🔴 `candidate_reviews` 는 **저장된(열람된) 부분집합** 이다. 화면은 국내 **3곳** · 해외 **11곳**
   인데 DB 는 KR 2 · OVERSEAS 3 · UNKNOWN 1 = **6건** 이다 ⟹ DB ⊂ 화면.
   🔴 그래서 「국내 후보 3건 중 나머지 1건」은 **이 조사로 특정하지 못했다**(transient 전용).
🔴 화면 「확인 **1곳**」 ↔ DB 의 KRW 88,000 **2건** 이 어긋난다. 집계기의 판매처 단위
   중복 제거인지, 열람 시점 transient 집합이 달랐는지 **가르지 못했다**.
🔴 화면의 해외 최저가(GBP 37 · SGD 70 · USD 40.6)가 DB(GBP 33)와 다르다 ⟹ 같은 이유다.
🔴 `marketCase`·`sellability`·`representative` 는 **저장되지 않는 계산값** 이라 §4 는
   **코드 추적** 이고 그 스냅샷의 실행값을 다시 재지 않았다.
```

---

## 6. 원인 분류

```
A 동일상품이 아님                     🔴 아니다 — 6번은 **SAME · blocker 0** 이다
B 가격과 MI 판별이 연결되지 않음        🔴 아니다 — **같은 후보 행** 에 둘 다 있다
C 판별은 있는데 가격 자격에서 탈락       🟢 **그렇다**(KR 2건 · BRAND 축)
D 표시 owner 가 다른 데이터를 보여줌     🔴 아니다 — 다른 **게이트** 를 정확히 보여준다
E 복합                               🟢🟢 **이것이다** — C **+** 「유일한 EXACT 가 market
                                     충돌로 양쪽 축에서 제외」
```

---

## 7. 🟡 CPO 판정이 필요한 지점 (🔴 CTO 가 열지 않았다)

```
⒜ **BRAND 축**(BRAND_MISMATCH · BRAND_UNCONFIRMED) — KR 2건을 막는 유일한 blocker.
   🔴 WU-080 CPO REJECT · WU-138 완화 REJECT 된 **동결축** 이다.
⒝ 🔴🔴 **등록부 소속 ↔ 외화 충돌** — 브랜드 **공식 글로벌몰** 이 국내 등록부에 있어서
   그 후보가 **SAME/EXACT 인데도** 양쪽 축에서 빠진다.
   🟡 선택지(전부 정책) — ① 등록부에서 그 도메인을 내린다(enabled=false 인데 **분류에는
   여전히 쓰인다**) ② 「등록부 소속」을 KR 증거에서 빼고 `.kr` TLD 만 쓴다
   ③ 그 후보를 **해외** 로 분류한다(EUR 이므로) ④ 현상 유지
   🔴 ②③은 `classifyCandidateMarket` 변경이고 **WU-020 계약** 과 만난다.
⒞ 🔴 그리고 ⒜⒝ 를 둘 다 풀어도 **국내 EXACT 가격은 여전히 0** 이다 —
   6번의 가격은 **EUR** 이고 그것을 국내 시장가로 쓰는 것은 금지돼 있다.
   ⟹ 「국내 수익성 판단」을 열려면 **국내 통화로 된 EXACT 후보** 가 필요하다.
```

---

# 8. ⒝ 등록부 정정 — 🔴 **STOP · 적용하지 않았다**(CPO 5단계 수행 결과)

> CPO 지시 ①~④ 를 수행했고 **⑤(「데이터 정정만으로 해결되지 않으면 중단하고 별도 보고」)에
> 걸렸다.** 🔴 DB 변경 **0** · 운영 코드 변경 **0**.

## 8-1. ① 등록 경위 · 사용처

```
id 2d9cceb0-2530-4cfb-a040-2fd51cbfc90a
name「Bobo Choses Korea(공식)」 · domain `bobochoses.com` · enabled **false** ·
AUTO_API · priority P1 · created 2026-08-23 · updated 2026-09-10
```

🔴🔴 **`enabled=false` 가 충돌을 막지 못하는 이유를 코드에서 확인했다** —
`run-domestic-price-check.ts:1329` 의 `registeredDomains` 는 **필터 «전»** 목록이다.
그 바로 위 주석(:1325)이 **의도** 를 적어 둔다:

> 「scope/활성 필터를 거치면 **「등록부에 있는데 외화가 왔다」는 충돌을 그 상품 scope
> 밖에서는 못 보게 된다**」

⟹ 🔴 **`enabled` 를 끄는 것으로는 제외되지 않는다**(이미 꺼져 있다). 정정 = **행 제거**.

**사용처 둘**
```
① `registeredDomains`(충돌 집합)      — 행의 **존재만으로** 효력이 있다(필터 전)
② `isBatchSurveyTarget`(검색 대상)    — `enabled=false` 라 **이미 제외** 돼 있다
```

## 8-2. ② 🔴🔴 **「글로벌 전용 도메인」 전제가 반증됐다**

```
price_observations · source_label「Bobo Choses Korea(공식)」
  source DOMESTIC_SHOP · currency **KRW** · **113건** · ₩75,000 ~ ₩202,000
```

⟹ 🔴 그 도메인은 **한국 시장 페이지를 실제로 운영** 하고(`/en-kr/` 로케일 · WU-008 실측)
**원화 가격을 113건** 냈다. 「국내 운영 도메인이 아니다」는 **사실이 아니다** —
**글로벌 공식 도메인이면서 한국 시장 스토어프런트를 같이 가진** 경우다.

## 8-3. ③④ 정정안과 **변경 전후 실측**(운영 함수 `classifyCandidateMarket` 직접 호출)

| 등록부 | 통화 | market | basis |
|---|---|---|---|
| **있음(현재)** | EUR | 🔴 UNKNOWN | `CONFLICT_REGISTERED_SHOP_WITH_FOREIGN_CURRENCY` |
| **있음(현재)** | KRW | 🟢 **KR** | `REGISTERED_SHOP_AND_KRW` |
| 제거(정정 후) | EUR | 🟢 **OVERSEAS** | `FOREIGN_CURRENCY_AND_NO_KR_EVIDENCE` |
| 제거(정정 후) | KRW | 🔴 **UNKNOWN** | `KRW_WITHOUT_DOMAIN_EVIDENCE` |

🔴🔴 **정정은 «고치기» 가 아니라 «맞바꾸기» 다**:
```
🟢 얻는 것  EUR 후보가 UNKNOWN → OVERSEAS (해외 소싱가로 쓸 수 있게 된다)
🔴 잃는 것  **KRW 후보가 KR → UNKNOWN** — 그 도메인이 **113건** 의 원화 관측을 낸
            바로 그 경로다. 국내 비교가격에서 **통째로 빠진다**
```

## 8-4. 추가 위험 — FK 32행

```
domestic_product_links 중 이 source_id 를 참조하는 행 **32**
⟹ 행 삭제는 FK 위반이거나(제약에 따라) **그 32행의 cascade 삭제** 다.
🔴 그 32행은 과거 국내 비교 이력이다 — 지우면 되돌릴 수 없다.
```

## 8-5. ⑤ 판정 — **STOP**

```
🔴 데이터 정정 **단독으로 해결되지 않는다.** 같은 도메인의 두 성질(글로벌 EUR ·
   한국 KRW)을 **도메인 하나로는 가를 수 없고**, 등록부 행은 그 둘에 **같이** 작용한다.
🔴 그래서 **DB 를 바꾸지 않았다**(CPO 지시 ⑤ · 헌장 §4-B D).
```

🟡 **CPO 가 고를 선택지(🔴 CTO 가 고르지 않았다)**
```
① 그대로 둔다 — EUR 후보 1건을 잃고 KRW 113건 경로를 지킨다(현재 상태)
② 행을 지운다 — EUR 후보를 얻고 **KRW 경로와 FK 32행을 잃는다**(비권장)
③ 🔴 **코드 변경이 필요한 안** — 충돌 판정을 「도메인」이 아니라 **「로케일/시장 경로」**
   로 좁힌다(예: `/en-kr/` 는 KR, 그 외 경로는 해외). 🔴 `classifyCandidateMarket`
   변경이고 **WU-020 계약** 과 만난다 ⟹ CPO 승인 사안
④ 등록부의 `domain` 을 **한국 경로로 좁혀** 적는다(예: `bobochoses.com/en-kr`).
   🔴 현재 매칭이 `domain` **완전일치** 라 코드가 받아들이지 못한다 ⟹ ③과 같은 범위
```

🔴 **그리고 ①~④ 중 무엇을 골라도 §3 의 결론은 바뀌지 않는다** — 그 후보의 가격은 **EUR** 이고
**국내 수익성 입력이 될 수 없다**(WU-020 외화 보호 유지). 국내 수익성을 열려면
**원화로 된 EXACT 후보** 가 필요하다.
