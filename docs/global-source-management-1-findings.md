# GLOBAL-SOURCE-MANAGEMENT-1 · Phase 1 조사 결과

**조사일** 2026-09-13 · **범위** 읽기 전용(코드 변경 0줄 · 마이그레이션 0건 · DB 쓰기 0건)
**DB** Production Supabase, SELECT만 사용 · **Bobo Choses는 켜지 않았다**

---

## 0. 한 문장 결론

> **`seller_type`을 읽는 코드는 저장소 어디에도 없다.**
> Bobo Choses는 DB에서만 GLOBAL이고, 코드가 보는 세계에서는 나머지 15개 국내
> 편집샵과 완전히 동일한 행이다. 그래서 "국내 편집샵 체크박스 하나"가
> 글로벌 공식몰의 동일상품 비교까지 통째로 껐다.

---

## 1. §8 여섯 질문에 대한 답

### 질문 1 — `seller_type`이 실제로 읽히는가? → **읽히지 않는다**

저장소 전체(`seller_type` / `sellerType`) 전수 검색 결과, **실제 분기·필터에
쓰이는 곳이 0곳**이다. 등장하는 곳은 전부 다음뿐이다:

| 위치 | 무엇을 하는가 |
|---|---|
| `packages/database/prisma/migrations_manual/046_market_observation_context.sql:31,41,48` | 컬럼 생성 · CHECK 제약 · `bobochoses.com`을 GLOBAL로 UPDATE |
| `docs/global-source-management-1.md` | 이번 지시서 본문 |

**타입 정의에도 없다.** `DomesticPriceSourceRow`(`apps/admin/src/app/api/domestic-price-sources/_lib/domestic-price-source.ts:57–79`)에
`seller_type` 필드가 없고, `toSource()`(:81–103)도 매핑하지 않는다.
쿼리는 `select("*")`(:128)라 값은 서버까지 도착하지만 그 자리에서 버려진다.

**같은 일이 `source_type`(049)에도 일어나고 있다.** 이쪽은 매핑까지는 된다
(`:97 sourceType: row.source_type ?? null`). 그런데 그 `sourceType`을 읽는
코드가 또 0곳이다 — 설정 화면도 보여주지 않는다.

DB 실측:

| seller_type | source_type | 행 수 |
|---|---|---|
| DOMESTIC | MARKETPLACE | 4 |
| DOMESTIC | RETAILER | 10 |
| DOMESTIC | VERTICAL | 1 |
| **GLOBAL** | **GLOBAL** | **1** (bobochoses.com) |

> **그래서 무엇을 뜻하는가** — 046과 049는 "유형"이라는 사실을 DB에 두 번 적어
> 뒀지만, 그 사실을 읽고 행동을 바꾸는 코드가 한 줄도 없다. 이번 사건의 뿌리는
> 매칭도 카테고리도 아니고 **유형이 판정에 참여하지 않는다는 것** 그 자체다.

---

### 질문 2 — 한 소스를 끄면 무엇이 함께 꺼지는가?

실효값은 `enabled = 카탈로그 enabled AND 워크스페이스 enabled`
(`domestic-price-source.ts:98`). 이 실효값을 읽는 곳은 **저장소 전체에서 정확히 두 곳**이다:

| # | 위치 | 무엇을 거르는가 |
|---|---|---|
| ① | `api/domestic-price-sources/search/route.ts:179` | 화면의 라이브 국내 검색 대상 |
| ② | `api/price-history/_lib/run-domestic-price-check.ts:331` | 저장 경로(링크·관측 생성) 대상 |

그리고 ②의 결과인 `allSources`가 같은 파일 안에서 **한 번 더** 쓰인다:

- `run-domestic-price-check.ts:515` `const sourceById = new Map(allSources.map(...))`
  → STEP 2(기존 링크의 가격 재조회)가 이 Map에 없는 소스를 `continue`로 건너뛴다(:519–520).
  **이미 🟢 동일상품으로 확정된 링크의 가격 갱신까지 같은 플래그에 묶여 있다.**

네 가지가 각각 어떻게 갈리는지:

| 기능 | 그 한 플래그에 묶이는가 | 근거 |
|---|---|---|
| 국내 검색 대상에서 제외 | **예** | search/route.ts:179 · run-domestic-price-check.ts:331 |
| 글로벌 시장 관측(MARKET_PROBE) 중단 | **아니오 — 완전히 독립** | run-price-check.ts:266은 `domestic_price_sources`를 전혀 조회하지 않는다 |
| 동일상품 비교에서 사라짐 | **예(간접)** | 링크·관측을 만드는 유일한 루프가 ②다. 새 스냅샷에는 Bobo 링크가 생기지 않는다 |
| 이미 저장된 링크/관측의 **표시** | **아니오** | `listDomesticProductLinks()`(domestic-product-link.ts:127–140)와 `getPriceHistory(…,"DOMESTIC_SHOP")`에 enabled 필터가 없다 |
| 이미 저장된 링크의 **가격 갱신** | **예** | run-domestic-price-check.ts:515·519 |

DB 실측이 정확히 이 모양이다(off 시각 = 2026-09-11 03:03:59Z):

| 항목 | bobochoses.com 마지막 기록 |
|---|---|
| `domestic_product_links` 갱신 | 2026-09-10 17:26 — **off 이후 0건** |
| `price_observations` (DOMESTIC_SHOP) | 2026-09-10 17:27 — **off 이후 0건** |
| `price_observations` (SELLER_ORIGIN · MARKET_PROBE, host=bobochoses.com) | **2026-09-13 03:25 — off 이후에도 계속 돈다** |

> **그래서 무엇을 뜻하는가** — 체크박스 하나가 "국내 검색"과 "동일상품 비교"
> 둘을 동시에 끈다. 분기점이 없다. 다만 글로벌 시장 관측(MARKET_PROBE)만은
> 애초에 다른 파이프라인이라 영향을 받지 않았다 — 이 한 곳이 이미 분리돼 있다는
> 사실이 Phase 2 설계의 유일한 기존 선례다.

---

### 질문 3 — `market_code` / `market_country`가 소스 단위로 관리되는 자리가 있는가? → **없다. 관측 결과에만 있다**

`domestic_price_sources` 실제 컬럼 전수(19개): `id, name, domain, url, currency,
category_scope, priority, collection_strategy, status, last_error_code,
last_error_message, enabled, created_at, updated_at, source, last_checked_at,
last_success_at, seller_type, source_type`.
→ **`market_code` / `market_country`가 없다.** 046은 두 컬럼을
`price_observations`에만 추가했다(046:21–22).

소스가 시장에 대해 말할 수 있는 유일한 값은 `currency`인데, **전 16행이 KRW**다
(029 주석: 이 테이블은 정의상 한국 KRW 전용).

관측 쪽 실측 분포:

| market_code | market_country | 건수 | 사실상 누구 |
|---|---|---|---|
| en-au / en-kr / en-int | GB | 각 13 | junioredition |
| en-de / en-fr / en-kr / en-int / en-us | ES | 10–11 | bobochoses |
| us / jp / kr / fr | (null) | 각 9 | smallable |
| "" (빈 문자열) | ES | 1 | bobochoses |

> **그래서 무엇을 뜻하는가** — §3의 "B · 제공 시장" 축을 적을 자리가 소스
> 테이블에 **아예 없다.** 시장은 오직 "찔러 본 결과"로만 존재하고, "이 판매처가
> 어떤 시장을 갖고 있다"는 선언은 어디에도 저장되지 않는다. §6의 설정 화면
> (Bobo ├ KR ├ FR ├ US ├ JP)은 현재 스키마로 표현할 수 없다.

---

### 질문 4 — MARKET_PROBE는 어떤 플래그를 보고 도는가? → **소스 플래그를 전혀 보지 않는다**

게이트는 `run-price-check.ts:266` 한 줄이다:

```
if (marketProbe || supportsSiteMarketProbe(input.sourceUrl))
```

- `input.sourceUrl`은 **그 스냅샷의 원본 상품 URL**(`product_snapshots.source_url`)이다.
- `marketProbe`는 Shopify `/meta.json` 조회 성공 여부(:173).
- `supportsSiteMarketProbe`는 등록된 사이트별 probe 레지스트리
  (`packages/crawler/src/market-probe.ts:37–39`) — **현재 등록된 사이트는 smallable 하나뿐.**
- `domestic_price_sources`를 조회하는 줄이 이 파일에 없다.

저장 라벨은 `MARKET_PROBE`(`price-observations.ts:171`), 원가 계산에서 제외하는
필터는 `isCostBasisOriginObservation`(:176–178), 화면으로 보내는 곳은
`market-intelligence.ts:429 sellerGlobalMarkets = groupMarketObservations(originRecords)`
(필터 **전**의 전체 관측을 쓴다 — :58과 대비).

**한계가 결정적이다.** MARKET_PROBE는 오직 **원본 판매처 자신**의 시장만 찌른다.
Smallable 430701을 등록하면 smallable의 KR/US/JP/FR만 관측되고, **Bobo의 KR 가격은
이 경로로 절대 들어오지 않는다.** Bobo 시장 관측 43건은 전부 원본이
bobochoses.com이었던 스냅샷 11개에서 나온 것이다.

> **그래서 무엇을 뜻하는가** — "글로벌 시장 관측"은 국내 검색과 다른 플래그를
> 본다(=이미 분리돼 있다). 그런데 그 파이프라인은 "원본 판매처 1곳"만 다룬다 —
> §5의 "글로벌 시장 = 원본 판매처의 국가별 가격"은 이미 성립하지만, §5의
> "동일상품 판매처에 Bobo KR ₩168,000"은 이 경로로는 닿을 수 없다.

---

### 질문 5 — off된 5곳은 각각 어떤 유형이어야 하는가?

**현재 실제 값**(2026-09-13 Production):

| 도메인 | seller_type | source_type | priority | collection_strategy | status | catalog enabled | category_scope | ws OFF |
|---|---|---|---|---|---|---|---|---|
| ssfshop.com | DOMESTIC | MARKETPLACE | P0 | MANUAL | ACTIVE | false | FASHION_ACCESSORIES+KIDS_FASHION+WOMEN_FASHION | 6/6 |
| 29cm.co.kr | DOMESTIC | MARKETPLACE | P1 | MANUAL | ACTIVE | false | 〃 | 6/6 |
| musinsa.com | DOMESTIC | MARKETPLACE | P1 | MANUAL | ACTIVE | false | 〃 | 6/6 |
| wconcept.co.kr | DOMESTIC | MARKETPLACE | P2 | MANUAL | ACTIVE | false | 〃 | 6/6 |
| **bobochoses.com** | **GLOBAL** | **GLOBAL** | P1 | **AUTO_API** | ACTIVE | false | KIDS_FASHION | 6/6 |

**§3 기준 의견:**

| 도메인 | 있어야 할 유형 | 이유 |
|---|---|---|
| ssfshop / 29cm / musinsa / wconcept | **국내 판매처 · 마켓플레이스** (현재 값 그대로 맞다) | 한국 법인·한국 시장 전용. `seller_type=DOMESTIC` + `source_type=MARKETPLACE`가 이미 정확하다 |
| **bobochoses.com** | **글로벌 공식몰** — 국내 편집샵 목록에 있을 대상이 아니다 | 한 도메인이 KR/FR/DE/US/INT 다섯 시장을 동시에 갖는다(046 실측). 국내 판매처 목록에 넣는 순간 "국내 검색 노이즈를 끈다"는 행동이 "글로벌 공식몰의 KR 가격을 지운다"가 된다 |

**결정적인 비대칭 하나 — 네 마켓플레이스는 끄나 켜나 검색 결과가 0이다.**
`collection_strategy`가 `AUTO_API`/`AUTO_SCRAPE`가 아니면 크롤러가 HTTP 요청을
아예 보내지 않고 `status:"unsupported"`로 끝난다
(`packages/crawler/src/comparison-search/index.ts:307–309`). 네 곳은 전부 MANUAL이다.

반면 **bobochoses.com은 전용 파서가 있는 AUTO_API 소스다**
(`searchBoboChosesKorea`, index.ts:255 — 현재 파서가 있는 6개 도메인:
looxloo / **bobochoses** / rulii / deuxbebe / chocoel / foretforet).

> **그래서 무엇을 뜻하는가** — 2026-09-11 03:03:59에 한 동작으로 껐던 5곳 중
> **실제로 데이터를 잃은 곳은 Bobo 하나뿐**이다. 나머지 넷은 원래 아무것도
> 가져오지 않던 목록 노이즈였다. 껐던 행동 자체는 합리적이었고, 잘못은 성격이
> 전혀 다른 두 종류가 같은 화면·같은 체크박스에 섞여 있던 구조에 있다.

---

### 질문 6 — Smallable은 카탈로그에 있는가? 원본 판매처는 어떻게 표현되는가?

**`domestic_price_sources`에는 없다.** 다른 카탈로그 테이블(`comparison_shops`,
마이그레이션 019)에 있다:

| domain | name | country | currency | source | is_active |
|---|---|---|---|---|---|
| smallable.com | Smallable | France | EUR | SYSTEM | true |
| junioredition.com | Junior Edition | United Kingdom | GBP | SYSTEM | true |
| **bobochoses.com** | **Bobo Choses Global (공식)** | **(null)** | **(null)** | USER | true |
| … | (총 25행, 국가 있는 14 / 국가 없는 11) | | | | |

**즉 `bobochoses.com`은 두 카탈로그에 중복 등록돼 있다** — 국내 소스 하나,
해외 비교샵 하나. 두 행은 서로를 모른다.

`comparison_shops`가 쓰이는 곳:
- `api/comparison/search/route.ts:54` `.filter(s => s.isActive)` → `searchComparisonShops()`
- `country` 컬럼은 읽힌다(route.ts:66 → `ComparisonShopSearch.tsx:346,620,730` "판매처 국가" 열)
- **결과를 DB에 저장하지 않는다** — 응답으로만 돌려주는 화면 전용 경로다.

**원본 판매처의 실제 표현은 카탈로그 행이 아니라 `product_snapshots.source_url`이다.**

| 원본 호스트 | 스냅샷 수 |
|---|---|
| www.junioredition.com | 153 |
| www.smallable.com | 97 |
| bobochoses.com | 17 |
| houseofkids / designerkidswear / babyshop / theanimalsobservatory / childrensalon | 각 2–5 |

MI 화면의 "동일상품 판매처" 카드 첫 줄(원본)은 그 URL의 **호스트 문자열**에서
이름을 만든다 — `same-product-sellers.ts:99–110 sellerNameFromUrl()`
(`www.smallable.com` → "Smallable"). 카탈로그를 참조하지 않는다.

> **그래서 무엇을 뜻하는가** — 오늘 판매처를 표현하는 자리가 **세 개**다:
> ① `domestic_price_sources`(국내, KRW 고정) ② `comparison_shops`(해외, country 있음)
> ③ `product_snapshots.source_url`(원본, 카탈로그 없음). Bobo는 ①과 ②에 동시에
> 있고 Smallable은 ②와 ③에만 있다. §3의 "A · 판매처 유형" 축은 이 셋을 하나로
> 합치는 일이다.

---

## 2. §7 열 항목 — 코드가 하는 일 / DB에 든 것

| # | 항목 | 코드가 실제로 하는 일 | Production DB 실측 |
|---|---|---|---|
| 1 | `seller_type` | **읽는 코드 0곳.** 타입 정의에도 없다(`domestic-price-source.ts:57–79, 81–103`) | DOMESTIC 15 / GLOBAL 1(bobochoses) |
| 2 | source enabled (카탈로그) | `toSource:99 catalogEnabled` · `:98`에서 AND. **UI로 되돌릴 경로가 없다** — `UpdateDomesticPriceSourceInput`(:268–273)에 `enabled`가 의도적으로 빠져 있다 | true 11 / false 5 |
| 3 | workspace enabled (047) | `loadWorkspaceShopSettings:146–160`. 설정 행 없음 = ON | 30행(5 도메인 × 6 워크스페이스) **전부 false**, 전부 `2026-09-11T03:03:59.941Z`. 워크스페이스는 현재 8개 — 09-12 이후 생긴 2개는 설정 행이 없어 기본 ON이지만, 카탈로그가 false라 실효값은 여전히 false |
| 4 | category_scope / `sourceFitsScopes` | `packages/category/src/profiles.ts:390–394`. 상품 범위 null/빈 배열 → 통과, 소스 범위 빈 배열 → 통과, 그 외 교집합 | Bobo scope = `[KIDS_FASHION]`. Smallable 430701은 아동복 → **이 필터는 Bobo를 막지 않았다** |
| 5 | `market_code` | `price_observations`에만 존재. 소스 테이블에 없음 | en-kr / en-de / en-fr / en-int / en-us / en-au / kr / us / jp / fr / "" |
| 6 | `market_country` | 〃. "판매처가 스스로 선언한 국가"이지 시장 국가가 아니다(046:11–15) | bobochoses=ES(모든 시장에서), junioredition=GB, smallable=null |
| 7 | global market probe | `run-price-check.ts:266` 게이트 = 원본 URL이 Shopify거나 등록된 사이트. 라벨 `MARKET_PROBE`(price-observations.ts:171), 원가 제외 `isCostBasisOriginObservation`(:176), 화면 전달 `market-intelligence.ts:429` | MARKET_PROBE 105건 / 33스냅샷. 호스트별: bobochoses 43 · smallable 36 · junioredition 26. **Bobo 마지막 2026-09-13 03:25 — off 이후에도 계속 관측 중** |
| 8 | 동일상품 매칭 | `crossSellerVerdict` = `packages/crawler/src/comparison-search/cross-seller.ts:343 compareCrossSellerProducts()` (SAME/PRESUMED_SAME/SIMILAR/UNKNOWN/CONFLICT). 링크 저장은 `run-domestic-price-check.ts:485`, 조회 `listDomesticProductLinks:127` **(enabled 필터 없음)**, 등급 `priceTierFromLink:51–56` | 링크 총 70행 — bobochoses 32(EXACT_IDENTIFIER 22 · TEXT_CONFIRMED 4 · 무판정 4 · HIGH_CONFIDENCE 1 · SIMILAR 1) / foretforet 20 / deuxbebe 18. **Bobo 마지막 갱신 2026-09-10 17:26** |
| 9 | 국내 가격 집계 | `market-intelligence.ts:66–96`: 링크의 `matchTruth`로 DOMESTIC_SHOP 관측을 EXACT / COMPARISON 두 버킷으로 나눠 `summarizeDomesticMarketSplit`(`packages/pricing/src/price-history.ts:582–595`). 판매처 수는 URL 호스트 기준(`sellerIdentityKey:311`). **enabled 필터 없음** | DOMESTIC_SHOP 관측 248건: bobochoses 113 / foretforet 71 / deuxbebe 64. Bobo 관측 금액 실측 ₩162,000 · ₩202,000 · ₩142,000 · ₩88,000 (라벨 "Bobo Choses Korea(공식)") |
| 10 | 글로벌 판매처 가격 비교 | 🌎 글로벌 시장 = `global-market.ts:302 buildGlobalMarketCard` ← `data.sellerGlobalMarkets`(Panel:2296). 🟢 동일상품 판매처 = `same-product-sellers.ts:118` ← `domesticMarketSplit.exact.sampleListings`(Panel:2331–2333). **두 카드의 입력이 서로 다른 파이프라인이고 교집합이 없다** | — |

---

## 3. 추가 질문 — "국내 검색에서는 빼되 동일상품·글로벌에는 남긴다"가 가능한가?

**현재 구조로는 불가능하다.** 플래그 조합이 없다.

이유를 경로로:

1. 국내 검색 대상 = 실효 `enabled`(search/route.ts:179, run-domestic-price-check.ts:331).
2. **동일상품 비교에 Bobo가 들어오는 유일한 입구가 ②의 같은 루프다.** 링크와
   DOMESTIC_SHOP 관측은 그 루프 밖에서 생기지 않는다. 끄면 입구가 닫힌다.
3. MARKET_PROBE는 분리돼 있지만 **원본 판매처만** 본다. Smallable이 원본인
   상품에서 Bobo를 찌르는 경로가 코드에 존재하지 않는다.
4. `category_scope`로 우회해도(예: Bobo scope에서 KIDS_FASHION 제거) 같은 줄
   (`sourceFitsScopes`)에서 걸러지므로 ②도 함께 막힌다 — 결과는 동일하다.

가능한 것은 **"국내 검색 목록 화면에서만 감추기"**뿐인데, 그것도 오늘의
설정 화면이 제공하지 않는다(체크박스는 실효 enabled를 바꾼다).

> **그래서 무엇을 뜻하는가** — 코드를 고치지 않고 DB 값만 조작해서 CEO가 원하는
> 상태(국내 검색 제외 + 동일상품·글로벌 유지)를 만들 방법은 없다. Phase 2는
> 반드시 코드 분기를 추가해야 한다.

---

## 4. `domestic_price_sources` 전체 16행 (설계 논의 바닥 자료)

| 도메인 | seller_type | source_type | prio | strategy | status | catalog enabled | category_scope |
|---|---|---|---|---|---|---|---|
| chocoel.co.kr | DOMESTIC | RETAILER | P0 | AUTO_SCRAPE | ACTIVE | ✅ | KIDS_FASHION |
| foretforet.com | DOMESTIC | RETAILER | P0 | AUTO_SCRAPE | ACTIVE | ✅ | KIDS_FASHION |
| looxloo.com | DOMESTIC | RETAILER | P0 | AUTO_SCRAPE | ACTIVE | ✅ | KIDS_FASHION |
| rulii.co.kr | DOMESTIC | RETAILER | P0 | AUTO_SCRAPE | ACTIVE | ✅ | KIDS_FASHION |
| **ssfshop.com** | DOMESTIC | MARKETPLACE | P0 | MANUAL | ACTIVE | ❌ | FASHION_ACCESSORIES+KIDS_FASHION+WOMEN_FASHION |
| chouchouenfant.kr | DOMESTIC | RETAILER | P1 | MANUAL | ACTIVE | ✅ | KIDS_FASHION |
| coconjennie.com | DOMESTIC | RETAILER | P1 | MANUAL | ACTIVE | ✅ | KIDS_FASHION |
| deuxbebe.com | DOMESTIC | RETAILER | P1 | AUTO_SCRAPE | ACTIVE | ✅ | KIDS_FASHION |
| karymarket.com | DOMESTIC | RETAILER | P1 | MANUAL | ACTIVE | ✅ | KIDS_FASHION |
| kidikidi.elandmall.co.kr | DOMESTIC | VERTICAL | P1 | MANUAL | ACTIVE | ✅ | KIDS_FASHION+KIDS_GOODS |
| nokimore.com | DOMESTIC | RETAILER | P1 | MANUAL | ACTIVE | ✅ | KIDS_FASHION+KIDS_GOODS |
| ocokorea.com | DOMESTIC | RETAILER | P1 | MANUAL | ACTIVE | ✅ | KIDS_FASHION |
| **29cm.co.kr** | DOMESTIC | MARKETPLACE | P1 | MANUAL | ACTIVE | ❌ | FASHION_ACCESSORIES+KIDS_FASHION+WOMEN_FASHION |
| **bobochoses.com** | **GLOBAL** | **GLOBAL** | P1 | **AUTO_API** | ACTIVE | ❌ | KIDS_FASHION |
| **musinsa.com** | DOMESTIC | MARKETPLACE | P1 | MANUAL | ACTIVE | ❌ | FASHION_ACCESSORIES+KIDS_FASHION+WOMEN_FASHION |
| **wconcept.co.kr** | DOMESTIC | MARKETPLACE | P2 | MANUAL | ACTIVE | ❌ | FASHION_ACCESSORIES+KIDS_FASHION+WOMEN_FASHION |

- 전 16행 `currency = KRW`, `source = SYSTEM`. coupang.com은 **이 테이블에 없다**
  (034/049 마이그레이션이 언급하지만 현재 행이 없다 — 확인된 사실).
- 크롤러 파서가 실제로 있는 도메인은 6곳: looxloo · **bobochoses** · rulii ·
  deuxbebe · chocoel · foretforet (`comparison-search/index.ts:253–261`).
  나머지 10곳은 켜져 있어도 HTTP 요청이 나가지 않는다(index.ts:307–309).

> **그래서 무엇을 뜻하는가** — 16행 중 실제로 데이터를 만드는 것은 6행이고,
> 그중 하나(Bobo)만 성격이 다르다. "국내 편집샵 목록"이라는 이름 아래 세 종류
> (실동작 국내 편집샵 5 · 동작하지 않는 마켓플레이스/후보 10 · 글로벌 공식몰 1)가
> 섞여 있다.

---

## 5. 가장 작은 변경으로 개념 분리를 시작할 지점 (제안만, 구현 안 함)

### 마이그레이션이 **필요 없는** 것

| # | 지점 | 무엇이 달라지는가 | 크기 |
|---|---|---|---|
| **A** | `run-domestic-price-check.ts:515` — `sourceById`를 `allSources` 대신 **링크가 가리키는 소스 전체**로 만든다 | "이미 🟢 동일상품으로 확정된 링크의 가격 갱신"이 국내 검색 on/off에서 **떨어져 나온다**. §5의 "동일상품 판매처는 구분 없이 SAME만"에 가장 가까운 한 줄 | 1–3줄 |
| **B** | `search/route.ts:179`와 `run-domestic-price-check.ts:331`의 똑같은 필터식을 헬퍼 하나(`selectDomesticSearchSources()`)로 합친다 | 앞으로 `seller_type` 분기를 넣을 자리가 **한 곳**으로 고정된다. 지금은 복사본이 둘이라 한쪽만 고치는 사고가 예약돼 있다 | 이동만, 동작 변화 0 |
| **C** | `domestic-price-source.ts`의 Row 타입·`toSource()`에 `sellerType`을 매핑만 한다(읽는 곳은 안 만든다) | 046이 넣어 둔 사실이 코드 세계에 처음 **존재**하게 된다. 동작 변화 0 | 3줄 |
| **D** | 설정 화면 목록에 `sellerType` / `sourceType`을 **표시만** 한다 | CEO가 §6의 세 그룹으로 나누기 전에, 지금 무엇이 어떤 유형으로 등록돼 있는지 화면에서 확인할 수 있게 된다 | 표시 only |

**권장 출발점은 A와 B다.** A는 이번 사건의 피해(확정된 동일상품이 함께 사라짐)를
직접 끊고, B는 Phase 2의 분기가 들어갈 자리를 미리 하나로 만든다. 둘 다 판정
로직을 건드리지 않는다.

### 마이그레이션이 **필요한** 것

| # | 무엇 | 왜 미뤄야 하는가 |
|---|---|---|
| **E** | 소스 단위 시장 축 (`source_markets` 자식 테이블 또는 소스에 market 컬럼) | §6 화면(Bobo ├ KR ├ FR ├ US ├ JP)을 표현할 자리가 지금 없다. 새 테이블 설계가 필요하고, 어떤 시장을 "선언"으로 둘지 CEO 결정이 먼저다 |
| **F** | 국내 검색 대상 여부와 판매처 유형을 **다른 컬럼으로** 분리 (예: `domestic_search_enabled`) | 오늘 `enabled` 하나가 두 뜻을 겸한다. 컬럼을 나누면 질문 3의 "가능한 조합"이 생긴다 |
| **G** | 카탈로그 통합 (`domestic_price_sources` ↔ `comparison_shops`) | bobochoses.com이 양쪽에 중복돼 있다. 단 `domestic_price_sources.id`는 `price_observations.source_ref_id`와 `domestic_product_links.source_id`가 FK로 참조한다(047 주석) — **행을 옮기면 지금까지의 모든 관측·링크 근거가 끊긴다.** 047이 새 테이블을 안 만든 이유와 같다 |

> **그래서 무엇을 뜻하는가** — 개념 분리의 첫 삽은 마이그레이션이 아니라 코드
> 두 줄(A·B)이다. 스키마 변경(E·F·G)은 §6 화면 설계가 확정된 뒤에 한 번에 가는
> 것이 안전하다.

---

## 6. 확인하지 못한 것

정직하게 적는다. 아래는 **모른다**.

1. **누가 왜 5곳을 껐는지.** `audit_log`에 편집샵 토글 이벤트 타입이 아예 없다
   (전체 event_type 7종: AUTH_GOOGLE_START / AUTH_LOGIN_SUCCESS / AUTH_GOOGLE_CALLBACK /
   IMPERSONATION_STARTED / IMPERSONATION_ENDED / AUTH_LOGOUT / MARKETPLACE_REGISTERED).
   2026-09-11 03:03:59 전후 20분 구간에 로그가 **한 건도 없다**. 추적 불가.
2. **카탈로그 `enabled`를 false로 바꾼 주체와 경로**(지시서 §0의 2026-09-10 23:35:27Z).
   현재 코드에는 카탈로그 `enabled`를 false로 쓰는 경로가 없다
   (`UpdateDomesticPriceSourceInput`에 `enabled` 없음). 047 이전 코드였거나
   SQL 직접 실행으로 보이지만, **근거가 없어 단정하지 않는다.**
   참고로 `domestic_price_sources.updated_at`은 그 5행 모두 등록 시각 그대로다
   (예: ssfshop/29cm = 2026-08-23) — 즉 `enabled`를 바꾼 UPDATE가 `updated_at`을
   갱신하지 않았다. 이것도 경로 추정을 어렵게 한다.
3. **Bobo를 켰을 때 MI 화면에 실제로 무엇이 뜨는지.** 켜는 것이 금지되어 실측하지 못했다.
   위 서술은 전부 코드 경로와 기존 저장 데이터에서 나온 것이다.
4. **8개 워크스페이스 중 어느 것이 CEO의 것인지.** 전부 이름이 "기본 워크스페이스"다.
   047 시딩 당시 6개였고 지금 8개인데, 새 2개가 누구 것인지 확인하지 못했다.
5. **`comparison_shops` 검색 결과가 어딘가에 저장되는 다른 경로가 있는지.**
   `/api/comparison/search`는 응답으로만 돌려준다는 것까지는 확인했으나,
   화면에서 그 결과를 별도로 저장하는 후속 경로가 있는지는 확인하지 못했다.
6. **coupang.com이 왜 카탈로그에 없는지.** 034/049 마이그레이션이 쿠팡을
   언급하는데 현재 행이 없다. 삭제된 것인지 034가 미실행인지 확인하지 못했다.
7. **F-21**(`/api/price-history/check`에 `maxDuration` export 없음)은 이번에도
   그대로다(`check/route.ts` 전문 확인 — export 없음). 다만 실제 타임아웃이
   발생했는지는 Vercel 로그를 보지 않아 확인하지 못했다.
8. **430701 ↔ B226AC114 판정 자체**는 이번 조사 범위 밖이다. 다만 DB에 남은
   Smallable 원본 ↔ bobochoses 링크는 `SIMILAR` 1건뿐이고, 나머지 Bobo 링크
   31건은 전부 junioredition 또는 bobochoses가 원본인 스냅샷에서 나온 것이다.
