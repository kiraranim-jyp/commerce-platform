# IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 — Step 3 (8상품 운영 경로 재생)

> 🔴 **운영 코드 변경 0 · 배포 0 · DB 쓰기 0.** 이 문서는 Step 4·5 의 **입력**이다.
> 🔴 **분모는 LOCK 이다**(commit `2b431fbf`) — 이 문서는 그것을 **다시 계산하지 않는다**.
> 🔴 **CTO 는 정책을 결정하지 않는다**(§26) — 사실 수집과 분류까지다.

## 0. 기준선

```
HEAD(착수)   2b431fbf
LOCK         PRODUCT 8 · CANDIDATE 80 · CEO SAME 43 · DIFFERENT 24 · REVIEW 10 · CONFLICT 3
하니스       apps/admin/src/app/api/price-history/_lib/__tests__/gt-master-step3.test.ts
게이트       GTM3_LIVE=1 (없으면 LIVE SKIP · 회귀에서 외부 HTTP 0)
산출물       docs/identity-gt-master/STEP3-REPLAY.json
```

🔴 **과거 자료를 재조사하지 않았다** — TTAEJYO9 이하 · 「최소 14개 상품」 · 분모 118 ·
분모 14 는 **전부 폐기된 기준** 이고 이 문서가 참조하지 않는다.

---

## 1. 🔴🔴 인수인계 정정 둘 (실측)

### 정정 ① SM430632 는 원상품 facts 가 **있다**

인수인계는 「AC157 · SM430632 둘 다 facts 없음」이라 적었다. **DB 실측으로 반증됐다.**

```
product_snapshots 조회(읽기 전용)
  %430632%   → 1행  id=1b070e39-24fc-4156-ba12-bc089fd6d755 · canonicalProduct **있음**
  %b226ac157% → **0행**
  %ac157%     → 0행 · cp.sku like %AC157% → 0행
```

🟢 그래서 **측정 가능한 상품이 6 → 7 로 늘었다**. 🔴 AC157 **하나만** 측정불가다.

🔴 그 저장분을 `fixtures/gt-master-origins.json` 에 **가공 없이** 덤프했다(값 생성 0).
🔴 검색에 걸린 `b226ac043`(Mystery BC **half zipped sweatshirt**)은 **다른 상품** 이라
대체로 쓰지 않았다 — 품번이 AC157 이 아니고 옷 종류도 다르다.

### 정정 ② typecheck baseline 은 이 앱에서 **0** 이다

메모 `main-is-not-typecheck-clean` 의 「baseline 10」은 더 이상 맞지 않는다.
`npx tsc --noEmit` → **error TS 0건 · exit 0** 이고, 새 하니스가 실제로 포함된다
(`--listFiles | grep gt-master-step3` → 1). 🔴 내가 줄인 것이 아니라 **현재 baseline 이 0** 이다.

---

## 2. 🔴🔴🔴 DATA-ANOMALY 둘 — 분모를 바꾸지 않고 기록한다 (CPO §31)

### ANOMALY-01 — LOCK 80 은 `originRaw` 단위이고, (상품,URL) 기준 고유는 **70** 이다

```
생성기 키        originRaw || dedupeKey      (docs/identity-gt-master/build-master-gt.mjs:113)
그런데           S1 ↔ B226AC010 · S2 ↔ B226AC009 가 **같은 상품** 으로 정규화된다
⟹ 같은 (상품, URL) 쌍이 **두 행** 으로 들어가 있다 — 중복 그룹 **10** · 잉여 행 **10**
⟹ (productId, URL) 기준 고유 = **70**
```

🔴 **분모 80 을 바꾸지 않았다**(CPO LOCK). 대신 **두 입도를 갈라서** 적는다 —
생성기 행은 **80**, fetch 단위는 **70**. 🔴 이 둘을 같은 표에 섞지 않는다.

상품별 (상품,URL) 고유 분해:

| PRODUCT | 생성기 행 | 고유 | SAME | DIFFERENT | REVIEW | 생성기 CONFLICT | 교차상충 |
|---|---:|---:|---:|---:|---:|---:|---:|
| PRODUCT-01 AC157 | 1 | 1 | 0 | 1 | 0 | 0 | 0 |
| PRODUCT-02 B226AC009 | 27 | 21 | 14 | 3 | 1 | 2 | **1** |
| PRODUCT-03 B226AC010 | 28 | 24 | 14 | 6 | 3 | 1 | 0 |
| PRODUCT-04 S3 / B126AI018 | 4 | 4 | 3 | 0 | 1 | 0 | 0 |
| PRODUCT-05 S4 / AW26MS185 | 6 | 6 | 1 | 4 | 1 | 0 | 0 |
| PRODUCT-06 S5 / 01195-VERNICE-NERO | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| PRODUCT-07 S6 / B226AC117 | 8 | 8 | 2 | 3 | 3 | 0 | 0 |
| PRODUCT-08 SM430632 | 5 | 5 | 0 | 5 | 0 | 0 | 0 |
| **TOTAL** | **80** | **70** | **34** | **22** | **10** | **3** | **1** |

🟢 합계 검산 — 34 + 22 + 10 + 3 + 1 = **70**.

### ANOMALY-02 — 🔴 CEO 라벨이 상충하는데 `GT_CONFLICT` 가 **놓쳤다** (1건)

```
PRODUCT-02 · global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-
            long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p
  originRaw=B226AC009  → **SAME**       ← core-same03-human-gt.json + wu-112-human-gt.json
  originRaw=S2         → **DIFFERENT**  ← wu-059-gt-facts.json
  🔴 두 행 모두 GT_CONFLICT = **false**
```

🔴 **원인은 생성기 키다** — 키가 `originRaw` 를 포함하므로 **같은 (상품,URL) 의 서로 다른
origin 축 라벨이 구조적으로 비교되지 않았다**. `GT_CONFLICT` 가 센 3건은 **같은 originRaw
안에서의** 상충뿐이다.

🔴🔴 **CTO 가 한쪽을 고르지 않았다** — CEO 판단을 대신 정하는 것이고 §26 이 금지한다.
🟢 재생에서는 `GT_CONFLICT_CROSS_ORIGIN` 으로 표시하고 **SAME/DIFFERENT 어느 분모에도
넣지 않았다**. ⟹ **CPO 판정 사안**(§9 에 다시 적는다).

---

## 2-B. 🔴🔴🔴 구조적 상한 — 「미도달」의 최대 덩어리는 «샵당 1건» 이다

🔴 이것을 **「우리가 동일상품을 버렸다」로 적으면 거짓이다.**

```
운영 sink 는 **샵당 best 1건** 만 싣는다(WU-109 확정 ·
  `transientEvidenceSink.push` 가 JUDGED 분기 «안» 에 하나)
⟹ 같은 샵의 다른 리스팅은 **구조적으로** 행이 되지 않는다

측정(네트워크 0 · 계약 GTM3-G)
  고유 (상품,URL)  **70**
  고유 (상품,샵)   **46**
  ⟹ 🔴 샵당 1건이 접는 후보 **24건**
```

🔴 이 24 는 **상한(20)과 무관** 하다 — 둘을 합치지 않는다.
🟢 그래서 「미도달」을 보고할 때 **네 축으로 갈라** 적는다:
`샵당 1건 접힘` · `fetch 실패` · `URL 단계 탈락` · `원상품 facts 없음`.

---

## 2-C. 🔴 내 하니스 결함 둘 — 둘 다 적는다

1차 라이브가 두 거짓을 찍었고 **둘 다 내 잘못** 이다.

### 결함 ① join 키를 자작해서 같은 후보를 두 번 셌다

```
GT      scoutandcokids.com/**collections/bobo-choses**/products/bobo-choses-hug-hairy-monster-t-shirt
도달 행  scoutandcokids.com/products/bobo-choses-hug-hairy-monster-t-shirt
⟹ 내 `host+path` 키로는 **다른 URL** 이라 「미도달 1 + GT 라벨 없음 1」로 **두 번** 셌다(×2 상품)
```

🔴 원인은 운영이 Shopify **목록 세그먼트** 를 접는 것이다(`self-reference.ts` ·
메모 `self-reference-collapses-collections-not-locale`).
🟢 고침 — join owner 를 **운영 `canonicalListingKey`** 로 바꿨다(규칙을 두 벌 갖지 않는다).
🟢 계약 GTM3-F 가 그 성질을 양방향으로 잠근다 — **목록은 접고 · 로케일은 안 접는다**.
🔴 **GT 원장 «안» 에는 그 중복이 없었다**(두 키 모두 고유 70) ⟹ `ANOMALY-03` 은
**존재하지 않는다**. 처음에 그렇게 적었다가 측정으로 **스스로 반증했다**.

### 결함 ② 고유 분모와 공급 분모를 섞어 「69」를 찍었다

```
PRODUCT-01 은 고유 후보 **1** 인데 facts 가 없어 **공급 0** 이다
⟹ `suppliedCount` 합계로 분모를 세니 70 이 아니라 **69** 가 나왔다
```

🟢 `uniqueGtPairs`(70 축)와 `suppliedCount`(공급 축)를 **갈랐고**,
`공급 == 고유 − facts 없는 상품의 고유` 를 단언으로 잠갔다.
🟢 🔴 **그 거짓을 잡은 것은 내 단언이다** — 그대로 보고했으면 분모가 틀렸다.

### 결함 ③ 🔴 결함 ① 을 고치면서 **키를 섞었다**

```
2차 라이브 — GT 쪽은 `dedupeKey`(경로만) · 도달 쪽은 `joinKey`(경로+식별쿼리)
⟹ URL 이 **글자 그대로 같은데도** 5건이 「라벨없음 + 미도달」로 **두 번** 셌다
   donokids.com/shop/shopdetail.html?branduid=3362785
   donokids.com/m/product.html?branduid=3362912
   beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021
   scoutandcokids.com/.../bobo-choses-hug-hairy-monster-t-shirt
   scoutandcokids.com/.../bobo-choses-booty-ghosts-t-shirt
```

🟢 양쪽을 **운영 `joinKey` 하나로** 통일했고, 3차에서 **라벨없는 도달 행 0**.
🟢🟢 **그리고 이 부류를 영구히 잡는 단언을 박았다** — 이 하니스는 `webSearch:false` 이고
등록부가 비어 있으므로 **공급한 URL 말고는 행이 설 수 없다** ⟹ 「라벨 없는 도달 행 0」이
불변식이다. 🔴 나중에 FAIL 하면 ⒜ join owner 가 또 갈렸거나 ⒝ 공급 URL 이 **다른 상품으로
리다이렉트** 된 것이다 — **삼키지 말고 가른다**.

### 🟢 확인된 것 하나 — `dedupeKey` 가 쿼리를 버려도 **이 데이터에서는** 거짓 병합 0

한국 CMS URL(`goods_view.php?goodsNo=` · `shopdetail.html?branduid=`)은 **경로가 같고
쿼리만 다르다** ⟹ 생성기의 경로-only 키가 **다른 상품을 합칠 수 있는 모양** 이다.
🟢 전수 확인 — `dedupeKey` 그룹 70개 중 **서로 다른 URL 을 합친 그룹 0**.
🔴 그래서 네 번째 ANOMALY 로 적지 않는다. 🔴 단 **입력이 늘면 발화할 수 있는 모양** 이고
그때는 운영 `joinKey` 로 세야 한다(계약 GTM3-F 가 그 자리를 지킨다).

---

## 3. 원상품 facts owner — 8/8 확정

| PRODUCT | originKey | facts owner | brand | 품번 | 색상 | 전제 |
|---|---|---|---|---|---|---|
| PRODUCT-01 | AC157 | 🔴 **없음** | — | — | — | `ORIGIN_FACTS_UNAVAILABLE` |
| PRODUCT-02 | B226AC009 | `wu-059#origins.S2` | Bobo Choses | B226AC009 | Light Blue | 없음 |
| PRODUCT-03 | B226AC010 | `wu-059#origins.S1` | Bobo Choses | B226AC010 | Heather Grey | 없음 |
| PRODUCT-04 | S3 | `wu-059#origins.S3` | Bobo Choses | B126AI018 | Green | 없음 |
| PRODUCT-05 | S4 | `wu-059#origins.S4` | Main Story | AW26MS185 | Grey Melange | 없음 |
| PRODUCT-06 | S5 | `wu-059#origins.S5` | Pèpè Shoes | 01195-VERNICE-NERO | 🔴 공란 | `ORIGIN_COLOR_BLANK` |
| PRODUCT-07 | S6 | `wu-059#origins.S6` | 🔴 공란 | 🔴 공란 | Blue | `ORIGIN_BRAND_BLANK` · `ORIGIN_MODEL_CODE_BLANK` |
| PRODUCT-08 | SM430632 | `gt-master-origins#SM430632` | Bobo Choses | 🔴 Smallable 자체 SKU | Blue | (아래) |

🔴 **매핑을 손으로 적지 않았다** — `S3`~`S6` 은 sid 가 그대로 키이고 `B226AC009`/`B226AC010`
은 **저장분의 `cp.sku.value` 로** 풀었다. 그 매핑이 틀리면 후보가 **엉뚱한 원상품** 에 붙어
측정 전체가 조용히 틀린다(CAND-02-A 가 잡은 그 자리 · 계약 GTM3-C 가 잠근다).

### 🔴🔴 전제 셋 — 이 상품들의 판정 숫자는 그 아래에서 읽어야 한다

```
PRODUCT-07 S6   brand **공란** + 품번 **공란**
  ⟹ brandKnown=false 라 **모든 후보가 BRAND_UNCONFIRMED** 가 된다(WU-133 사슬의 머리)
  🔴 임의로 채우지 않았다 — 채우면 보류가 **충돌** 로 악화된다(WU-080 실측)
PRODUCT-06 S5   색상 **공란** ⟹ COLOR 축이 서지 않는다(2차 키도 발화하지 않는다 · WU-113)
PRODUCT-08 SM430632  sku = **AAA1804532**(Smallable 자체 SKU) ·
  🔴 Bobo 품번이 아니다 ⟹ MODEL_CODE 축이 **원상품 쪽에서** 서지 않는다
  (`core-2al` 주석이 이미 적어 둔 그 성질 — 「Smallable 은 품번을 싣지 않는다」)
```

---

## 4. 재생 방법 — 왜 재투입인가 · 상한을 어떻게 다뤘는가

```
저장 canonicalProduct → backfillCanonicalProduct → buildProductIdentityDna
  → runDomesticPriceCheck({ reviewedSameUrls, webSearch:false })
  → (6 출처 concat: gemini · urlCandidate · overseasAuto · reviewedSame · domesticListing · webSearch)
  → selectCandidateList(market) / selectMiSameCandidates(market).priced
```

🔴 **「사람이 SAME 이라 했다」가 판정을 승격하지 않는다** — 그 경로는 URL 을 **다시 열어
보는 것** 뿐이고 SAME/DIFFERENT 는 기존 판정기가 처음부터 다시 낸다(운영 주석).
🔴 그래서 **CEO DIFFERENT 후보도 같이 넣었다** — FP 를 재려면 그쪽이 분모다.

🔴 **쓰기 불가를 측정 «전» 에 증명했다**(이중 방어 · 하니스 단언):
`getSupabaseAdmin() === null` **그리고** `isTransientShopId(REVIEWED_SAME_SHOP_ID) === true`.

### 🔴🔴 상한 20 — 「운영이 동일상품을 자른다」로 적지 않는다

```
MAX_SUPPLIED_CANDIDATE_URLS = 20 (운영 상수에서 읽는다 · 하드코딩 0)
초과 PRODUCT-02 21건(청크 2) · PRODUCT-03 24건(청크 2)
```

🔴 그 초과는 **운영 발견이 아니라 하니스가 분모를 한 통에 담은 결과** 다 — 운영에서 그
21·24 건은 **여러 차례의 발견 라운드** 로 나뉘어 도착했다.
🟢 그래서 ≤20 으로 **청크** 해 돌리고 청크마다 `notFetchedOverLimit.length === 0` 을
**단언** 했다 ⟹ **상한이 아무것도 조용히 버리지 않았다**는 증거를 남겼다.
🔴 「후보 없음」과 「fetch 되지 않음」을 섞지 않는다.

---

## 5. 측정 결과 (라이브 3차 · 계약 8/8 PASS · 산출 `STEP3-REPLAY.json`)

### 5-1. 상품별

| PRODUCT | 행80 | 고유 | 공급 | 도달 | 표시 | 가격 | 미도달 | 전제 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| PRODUCT-01 AC157 | 1 | 1 | **0** | 0 | 0 | 0 | 1 | `ORIGIN_FACTS_UNAVAILABLE` |
| PRODUCT-02 B226AC009 | 27 | 21 | 21 | 14 | 11 | 4 | 7 | — |
| PRODUCT-03 B226AC010 | 28 | 24 | 24 | 10 | 9 | 4 | 14 | — |
| PRODUCT-04 S3 / B126AI018 | 4 | 4 | 4 | 1 | 1 | 0 | 3 | — |
| PRODUCT-05 S4 / AW26MS185 | 6 | 6 | 6 | 3 | 3 | 1 | 3 | — |
| PRODUCT-06 S5 / 01195 | 1 | 1 | 1 | 0 | 0 | 0 | 1 | `ORIGIN_COLOR_BLANK` |
| PRODUCT-07 S6 / B226AC117 | 8 | 8 | 8 | 3 | 3 | 1 | 5 | `ORIGIN_BRAND_BLANK` |
| PRODUCT-08 SM430632 | 5 | 5 | 5 | 2 | 2 | 0 | 3 | `ORIGIN_MODEL_CODE_BLANK` |
| **TOTAL** | **80** | **70** | **69** | **33** | **29** | **10** | **37** | |

🟢 검산 — 도달 33 + 미도달 37 = **70** · 🔴 **GT 라벨 없는 도달 행 0**(단언으로 잠금).

### 5-2. URL 풀 funnel (운영 `reviewedSameMetrics`)

```
supplied 69 → accepted 67 → usable 56 → miEligible 51     (fetchCalls 81)
dropped — REDIRECTED_AWAY 6 · UNREACHABLE 5 · DUPLICATE 5 · SELF_REFERENCE 2
🟢 notFetchedOverLimit — **전 청크 0**(상한이 조용히 버린 것이 없다)
```

🔴 `miEligible 51` 인데 **도달 행은 33** 이다. 그 간극이 §5-3 의 ⒞⒟ 다.

### 5-3. 🔴🔴 미도달 37 — 네 축으로 «가른다»

| 축 | 건수 | 의미 |
|---|---:|---|
| ⒜ 원상품 facts 없음 | **1** | PRODUCT-01 — 재생 자체가 불가(측정불가) |
| ⒝ URL 풀 단계 탈락 | **14** | REDIRECTED_AWAY · UNREACHABLE · DUPLICATE · SELF_REFERENCE |
| ⒞ 🔴 **샵당 1건 접힘** | **15** | 구조적 상한(WU-109) — 「버렸다」가 **아니다** |
| ⒟ 그 밖(판정 단계) | **7** | ⑧ 게이트 · 샵 대표 선정 등 |

상품별 ⒝/⒞/⒟ — P-02 3/2/2 · P-03 4/7/3 · P-04 1/1/1 · P-05 1/2/0 · P-06 1/0/0 ·
P-07 4/0/1 · P-08 0/3/0.

🔴 **「우리 Identity 가 동일상품 37건을 버렸다」로 적으면 거짓이다** — ⒜⒝⒞ 합 **30**
은 Identity 판정 «이전» 이고 ⒞ 15 는 설계된 상한이다.

### 5-4. CEO GT × 운영

| CEO GT | 고유 | 도달 | 표시 | 가격 | 미도달 |
|---|---:|---:|---:|---:|---:|
| SAME | 34 | 23 | 21 | **10** | 11 |
| DIFFERENT | 22 | 8 | 6 | **0** | 14 |
| REVIEW | 10 | **0** | 0 | 0 | 10 |
| GT_CONFLICT(생성기) | 3 | 1 | 1 | 0 | 2 |
| GT_CONFLICT_CROSS_ORIGIN | 1 | 1 | 1 | 0 | 0 |

🔴 **CEO REVIEW 10건이 전건 미도달** 이다. 🔴 그 이유를 「목록 URL 이라서」로 적지
않는다 — 실제로는 **대부분 진짜 상품 페이지** 다(kream · luksusbaby · kids21 ×2 ·
main-story · thefrontshop · trenbe ×2 · miniboutique · 🔴 목록은 beaumonde 1건뿐).
⟹ 🔴 **그 10건의 미도달 사유는 Step 4 에서 URL 단위로 가른다**(지금 단정하지 않는다).

### 5-5. 🟢🟢 DIFFERENT-FP = **0** — 단 분모를 같이 적는다

```
도달 CEO DIFFERENT **8** 중 운영이 SAME/STRONG/EXACT 로 올린 것 **0**
그리고 그 8건 중 **가격 축에 들어간 것도 0** 이다
```

🔴 **「FP 0」을 그대로 쓰지 않는다** — 분모가 **22 가 아니라 8** 이다(14건은 미도달).
🟢 그래도 의미는 있다 — **현재 Identity 의 오류는 전부 recall 방향** 이고 오포함이 아니다
(메모 `ceo-visual-gt-overturned-the-luxboy-counterexample` 의 그 방향과 일치).

### 5-6. 🔴 SAME-FN = **12 / 23**

```
도달 CEO SAME 23 → 운영 SAME **11** · FN **12**
  🟢 운영 SAME 11 중 **10건이 가격 축까지** 들어갔다(10/11)
FN 의 모양  TEXT_CONFIRMED / PRESUMED_SAME **9** · CONFLICT / CONFLICT 2 · CONFLICT / PRESUMED_SAME 1
FN blockers FIT 4 · BRAND_UNCONFIRMED 3 · MODEL_CODE_AGE_LINE 2 ·
            BRAND_MISMATCH 1 · NO_TITLE_OVERLAP 1 · SAME_SELLER_DISTINCT_LISTING 1
            🔴 **blockers 가 아예 없는 FN 3건** (cissywears · cemarose · rboutique · bobochoses 중)
```

🔴🔴 **「blocker 없는 FN」과 「blocker 있는 FN」을 같은 처방으로 묶지 않는다** —
전자는 **축 수 부족**(`SAME_MIN_AXES`)이고 후자는 **보호축** 이다. 🔴 둘 다 CPO 정책이다.

### 5-7. 운영 산출 분포 (도달 33행)

```
matchTruth     TEXT_CONFIRMED 15 · STRONG_IDENTIFIER 10 · CONFLICT 6 · EXACT_IDENTIFIER 2
verdict        PRESUMED_SAME 16 · SAME 12 · CONFLICT 5
priceTier      COMPARISON 15 · EXACT 12 · EXCLUDED 6
market         OVERSEAS 28 · KR **4** · UNKNOWN 1
display        PRESUMED 14 · LIKELY 12 · POSSIBLE 3 · **표시 안 됨 4**
```

🔴 **표시되지 않는 도달 행 4건의 사유가 갈린다**(전수):

```
bobochoses.com    CEO SAME      CONFLICT / EXCLUDED              ⟹ tier 로 제외
donokids.com      CEO SAME      TEXT_CONFIRMED / COMPARISON ·
                                🔴 **market UNKNOWN** ⟹ 🇰🇷/🌎 어느 블록에도 안 든다
parkette.ca       CEO DIFFERENT CONFLICT / EXCLUDED              ⟹ 🟢 올바른 제외
junioredition.com CEO DIFFERENT CONFLICT / EXCLUDED              ⟹ 🟢 올바른 제외
```

🟢 `donokids` 는 **WU-140 ⒟ 가 적어 둔 그 모양** 이다(가격이 있어도 market 미확정이면
두 블록 어디에도 서지 않는다). 🔴 **고치지 않았다** — 시장 분류는 보호 계약이다.

---

## 6. 구조적 측정불가 (추정으로 채우지 않는다)

```
AC157 원상품 facts        product_snapshots 전수 0행 ⟹ PRODUCT-01 재생 불가
                          🔴 후보 분모(80/70)는 **그대로** 다. 0 으로 세지 않는다
                          🔴 원상품 URL 을 새로 크롤하지 않았다 — 그것은 pipeline(「새 상품
                             분석」) 경로이고 이 WU 가 보는 `/check` 경로가 아니다
Search raw title/snippet/rank  어댑터가 url 만 읽는다 ⟹ SEARCH_RAW_NOT_PERSISTED
APIFY_API_TOKEN 부재       새 Search 불가 ⟹ 발견 능력을 재지 않았다(이 WU 범위 밖)
service-role 부재          등록부가 **빈 상태** 로 돌았다(registrySources 0) ·
                          DB 쓰기 구조적 불가
wu-093 12건 · core-desc-review  URL 없음 ⟹ **이미 분모 80 밖** 이다
CEO REVIEW 10건의 미도달 사유  🔴 Step 3 에서 URL 단위로 가르지 않았다(Step 4 범위)
CEO DIFFERENT 14건            미도달 ⟹ 🔴 **FP 분모가 8** 이다(22 가 아니다)
```

🔴 **그리고 「측정불가」를 0 으로 적지 않는다** — ⒜ PRODUCT-01 의 후보 1건은 「운영이
놓쳤다」가 아니라 **재생 자체를 못 했다** ⒝ 미도달 37 중 30 은 Identity 판정 «이전» 이다.

---

## 7. 이 WU 가 **하지 않은** 것

```
Search 0 · Query 0 · Apify 0 · Registry 0 · Adapter 0 · Identity 운영 로직 0 ·
threshold 0 · matchTruth 0 · priceTier 0 · candidate selector 0 · cap 0 ·
가격 정책 0 · UI 0 · self-reference 0 · DB schema 0 · DB 쓰기 0 · 배포 0
```

🔴 정책 결정도 **하나도 하지 않았다** — Brand+Model=SAME · N Evidence=SAME ·
Model mismatch=DIFFERENT · Image same=SAME · Baby/Kids 판단 전부 **CPO 몫** 이다.

---

## 8. 변경 파일 (조사 전용)

```
신규  apps/.../__tests__/gt-master-step3.test.ts          하니스 · 계약 7 + LIVE 1(게이트 OFF 면 SKIP)
신규  apps/.../__tests__/fixtures/gt-master-origins.json  운영 DB 저장분 덤프(가공 0)
신규  docs/IDENTITY-GT-MASTER-01-STEP3.md                 이 문서
신규  docs/identity-gt-master/STEP3-REPLAY.json           재생 산출물(상품 8 · 행 전수)
수정  apps/.../__tests__/core-same06-safety-gt-search.test.ts   새 fixture 를 **분류 목록에 등록**
```

🔴🔴 **그 수정은 가드를 «느슨하게» 한 것이 아니다** — `core-same06` 은 「fixture 전수가
분류돼야 「전수」로 보고할 수 있다」는 계약이고, 내가 fixture 를 하나 더하자 **FAIL 로
잡았다**. 🟢 제외 사유를 적어 **등록** 했다(라벨 없음 · GT 분모와 겹치지 않음).
🔴 단언을 지우거나 조건을 약하게 바꾸지 않았다.

### 계약 목록 (네트워크 0 · 7건)

```
GTM3-A  LOCK 8/80/43/24/10/3 이 파일 안에서 일관된다(재계산 아님 · 대조)
GTM3-B  생성기 키(originRaw||URL) 80 고유 + 내 대조 규칙이 생성기와 같다
GTM3-E  🔴 ANOMALY-01·02 를 수치로 고정(70 / 중복 10 / 교차상충 1 · GT_CONFLICT 가 놓쳤다)
GTM3-F  join owner 는 운영 `canonicalListingKey` — **목록은 접고 · 로케일은 안 접는다**(양방향)
GTM3-G  🔴 샵당 1건이 접는 후보 수(70 → 46 = **24**)를 측정 «전» 에 센다
GTM3-C  8상품 중 7개 facts 있고 **AC157 만 없다** · owner 문자열 보존
GTM3-D  상한 20 초과 상품과 청크 수를 기록(「초과 0」이 아니라 **알고 있다**를 단언)
LIVE    쓰기 불가 2중 단언 · 청크별 notFetchedOverLimit 0 · **라벨없는 도달 행 0** ·
        분모 80/70/공급 을 **갈라서** 단언
```

---

## 8-B. 🔴 관측 1건 — 전체 회귀가 작업트리를 더럽힌다 (기존 동작 · 고치지 않았다)

```
core-2m-visual-review-build.test.ts:619  writeFileSync(outPath, html)  ← **게이트 없음**
⟹ 전체 회귀를 돌릴 때마다 `docs/core-2m-visual-review.html` 이 재생성된다
🔴 그 파일의 「상세 설명 발췌」 칸은 **크롤된 페이지 본문** 이라 사이트 배너 문구가
   바뀌면 같이 흔들린다(이번에 12줄 변경 — 전부 그 칸).
```

🟢 **내 변경이 아니므로 되돌렸다**(`git checkout --`). 🔴 내 구현을 되돌린 것이 **아니다**
(메모 `WU-113` 의 그 금지와 다른 상황이다 — 생성 산출물이고 저자가 내가 아니다).
🔴 **고치지 않았다** — 게이트를 붙이는 것은 그 WU 의 소관이다. 🟡 CPO 가 알아 둘 사항:
**회귀만 돌려도 clean 이 깨지므로** 다음 세션이 그것을 자기 변경으로 오인할 수 있다.

---

## 9. CPO 판정 대기 (CTO 가 고르지 않았다)

```
① ANOMALY-02 — global.trenbe.com B226AC009 후보의 CEO 라벨 상충
   core-same03 + wu-112 → SAME   ↔   wu-059 → DIFFERENT
   🔴 어느 쪽이 CEO 의 최종 판단인가. 분모 LOCK 유지 여부도 같이 판정해야 한다
② ANOMALY-01 — 보고 분모를 80(생성기 행)과 70(고유 쌍) 중 **무엇으로 적을 것인가**
   🟢 CTO 는 둘을 **갈라서** 적었다. Step 5 의 A~H 도 같은 방식으로 갈지 결정이 필요하다
③ PRODUCT-01 AC157 — 저장 facts 가 없다. ⒜ 측정불가로 남긴다 ⒝ 원상품을 새로
   분석해 스냅샷을 만든다(🔴 그것은 운영 쓰기이고 CTO 범위 밖) 중 어느 쪽인가
④ 🔴 **FP 분모가 8 이다**(CEO DIFFERENT 22 중 14 미도달). 「DIFFERENT-FP 0」을
   그대로 Step 5 의 H 에 적을 것인가, ⒜ 미도달 14 를 먼저 열 것인가
⑤ 🔴 **샵당 1건 접힘 15건** — Step 5 가 그것을 「손실」로 셀 것인가 「구조적 상한」으로
   별 축에 적을 것인가(🔴 P1~P3 보류 목록과 같은 자리다 · WU-112)
```

🔴 **CTO 는 ①~⑤ 중 아무것도 고르지 않았다.**

---

## 10. 현재 좌표 / 다음 한 수

```
현재   🟢 **Step 3 CLOSED** — 8상품 재생 완료 · 계약 7 + LIVE 1 전부 PASS ·
       분모 LOCK 유지(80/70) · DATA-ANOMALY 2건 기록 · 내 하니스 결함 3건 기록 ·
       운영 코드 변경 **0** · 배포 **0** · DB 쓰기 **0**
       산출물 `docs/identity-gt-master/STEP3-REPLAY.json`(상품 8 · 도달 33행 전수)

다음   **Step 4** — 고유 70 후보의 raw evidence 를 필드마다 A/B/C/D 로 분류
       🟢 **도달 33행은 이미 운영 산출을 들고 있다**(STEP3-REPLAY.json) ⟹ Step 4 는
          그 33행에 **필드 단위 evidence** 를 붙이는 것부터 시작한다(재조사 0)
       🔴 미도달 37 은 **네 축으로 이미 갈려 있다** — ⒜1 ⒝14 ⒞15 ⒟7.
          🔴 그 37 에 대해 「사이트에 있는데 미수집(B)」을 말하려면 **후보 페이지를 직접
          열어야** 하고, 그 fetch 가 Step 4 의 주된 용량이다
       🔴 CEO REVIEW 10건 전건 미도달의 사유는 **Step 4 에서 URL 단위로** 가른다

🔴 Search · Price · UI · Registry 로 되돌아가지 않는다. Identity 정책도 결정하지 않는다.
🔴 과거 자료(TTAEJYO9 이하 · 「14개 상품」 · 분모 118/14)를 **다시 열지 않는다**.
```
