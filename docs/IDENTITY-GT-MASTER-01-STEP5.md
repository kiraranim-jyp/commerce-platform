# IDENTITY-GT-EVIDENCE-MASTER-REVIEW-01 — Step 5 (Identity Policy Master Review)

> 🔴🔴 **정책 분석만 했다.** 코드 변경 **0** · 배포 **0** · DB **0** · GT **0** ·
> threshold **0** · blocker **0** · composition collector **0** · sellerSku 승격 **0** ·
> Search/Price/UI/Registry 재진입 **0**.
> 🔴 **CTO 는 정책을 결정하지 않는다** — 측정값과 후보만 제출한다.

```
기준점   6a8782a3 (Step 4 CLOSED) → Step 5
분모     공식 GT **80 rows** LOCK · 보조 고유 **70 (product,URL)**
         CEO SAME 43 · DIFFERENT 24 · REVIEW 10 · 생성기 CONFLICT 3 LOCK
         🔴 Step 4 관측 GT conflict **4** 는 **별도 기록**(섞지 않는다)
성능 분모 🔴 **DIFFERENT-FP 0 / 8 reached** · **SAME-FN 12 / 23 reached**
         (24 · 43 으로 적지 않는다 — CPO ⑤ LOCK)
```

---

## E. `SAME_SELLER_DISTINCT_LISTING` — 🔴 **CPO 가 옳았다. 내 축 매핑이 틀렸다**

CPO ④ 판정대로 **승인하지 않고 코드로 확정했다**(cross-seller.ts:762 전수):

```ts
function sameSellerDistinctListing(x, y) {
  hostX = sellerHost(x.sourceUrl); hostY = sellerHost(y.sourceUrl);
  if (!hostX || !hostY || hostX !== hostY) return false;
  slugX = x.urlSlug ?? extractUrlSlug(x.sourceUrl); slugY = …;
  if (!slugX || !slugY) return false;
  return slugX !== slugY;
}
```

```
🔴 입력은 **`sourceUrl` 의 host + `urlSlug`** 뿐이다 — **`sellerSku` 사용 0회**
🟢 그러므로 그 축의 증거는 **URL 이고 항상 `A`** 다
🔴 Step 4 의 「SAME_SELLER_DISTINCT_LISTING → sellerSku · B 2」는 **정정된다**
```

### 🔴 왜 이 축이 이 분모에서 발화하는가 — **원상품이 리테일러다**

```
원상품 host — PRODUCT-02·03·04·05·06 = **junioredition.com**(리테일러) ·
              PRODUCT-07 = bobochoses.co.jp · PRODUCT-08 = smallable.com
후보가 원상품과 **같은 host** 인 것 **7 / 70**(전부 junioredition)
그중 Identity 도달 3 — 🔴 **CEO SAME 1 · DIFFERENT 1 로 갈린다**(+ conflict 1건)
```

🔴🔴 **그 축 단독으로는 둘을 가를 수 없다.** 그리고 그 함수 주석의 전제
(「같은 판매처끼리의 비교는 가격 비교에 쓰이지 않으므로 보류에 피해가 없다」)는
**가격 축에서는 참** 이지만 **Identity 측정에서는 FN 으로 나타난다** — 원상품이
브랜드 공식몰이 아니라 리테일러일 때 생기는 **구조적 귀결** 이다.
🟡 단 그 1건(junioredition P-02)은 `MODEL_CODE_AGE_LINE`·`FIT` 도 같이 달려 있어
**이 축만 풀어도 열리지 않는다**.

### 🟢 [정정] blocker 축 × 그 축의 증거 — **15 / 18 이 A**

| blocker → 축 | 건 | A | B | C |
|---|---:|---:|---:|---:|
| `BRAND_UNCONFIRMED` → brand | 5 | 2 | **1** | **2** |
| `FIT` → fitText | 4 | **4** | 0 | 0 |
| `AUDIENCE_LINE` → audienceSignals | 2 | 2 | 0 | 0 |
| `NO_TITLE_OVERLAP` → title | 2 | 2 | 0 | 0 |
| `MODEL_CODE_AGE_LINE` → brandModelCode | 2 | 2 | 0 | 0 |
| `SAME_SELLER_DISTINCT_LISTING` → **URL(host+slug)** | 2 | **2** | 0 | 0 |
| `BRAND_MISMATCH` → brand | 1 | 1 | 0 | 0 |
| **합계** | **18** | **15** | **1** | **2** |

🔴 Step 4 는 13/18 로 적었다 — **정정값은 15/18** 이고 결론은 **더 강해진다**.

---

## A. SAME-FN 12 / 23 — 5원인 분해 (🔴 양쪽 공백을 갈랐다)

| 원인 | 건 | 사례 |
|---|---:|---|
| ④ **실제 conflict** (`MODEL_CODE`) | **4** | cemarose.ca · bobochoses.com(P-02) · junioredition.com(P-02) · bobochoses.com(P-03) |
| ③ **증거를 갖고 «다르다»고 판단** | **3** | kolkid.ca(P-02) `FIT:A` · kolkid.ca(P-03) `FIT:A` · biskuit.kr `BRAND_MISMATCH:A`+`NO_TITLE_OVERLAP:A` |
| ⑤ **축 부족**(`SAME_MIN_AXES`) | **2** | cissywears.com(P-02) · rboutique.com(P-03) — blocker·conflict **둘 다 없음** |
| ① **증거 부재 — 후보측 사이트에 없다** | **1** | donokids.com(P-02) `brand: C` |
| ①-b 🔴 **증거 부재 — «원상품» 측 공백** | **1** | kihanan.com(P-07) — 후보 brand 는 **A** 인데 원상품(S6)이 `ORIGIN_BRAND_BLANK` |
| ② **증거 미수집**(고칠 수 있는 유일한 자리) | **1** | bobochoses.co.jp(P-04) `brand: B` |

🔴🔴 **내 분류를 한 번 더 정정했다** — `kihanan.com` 을 처음에 ③으로 넣었다. 후보 brand 가
`A` 인데 막혔으니 「증거를 갖고 판단」으로 읽힌 것이다. 🟢 실제 원인은 **원상품 쪽 공백**
이고(`brandKnown = Boolean(x.brand && y.brand)`), 그래서 **PRODUCT-07 의 모든 후보가 걸린다**
— WU-133 이 확정한 사슬의 머리 그 자리다.

### 🟡 blocker 없는 FN 3건 — CPO 가 지목한 그 셋 (별도 분석)

```
cissywears.com(P-02)  TEXT_CONFIRMED / PRESUMED_SAME · blocker 0 · conflict 0
rboutique.com(P-03)   TEXT_CONFIRMED / PRESUMED_SAME · blocker 0 · conflict 0
   🔴 둘 다 **보호축이 막은 것이 아니다** — 축이 `SAME_MIN_AXES` 에 모자랐다
   증거 상태 — cissywears: modelCode C · color C · material C · fit C · age C
              rboutique : modelCode C · color C · material C · size C
   ⟹ 🔴 **사이트가 그 칸들을 말하지 않는다**(C) ⟹ 수집을 고쳐도 축이 안 생긴다
🟢 세 번째(bobochoses.com P-03)는 blocker 0 이지만 **conflict MODEL_CODE** 가 있어
   ④로 분류했다 — 「blocker 없음」을 「막는 것이 없음」으로 읽지 않는다
```

🔴 ⟹ **⑤ 2건은 threshold 를 낮추는 것 말고 레버가 없고, 그것은 CPO 금지축이다.**

---

## B. DIFFERENT-FP = **0 / 8 reached** — 🟢 보호축이 일하고 있다

차단 8건의 **차단 수단 전수**:

```
AUDIENCE_LINE 2 · BRAND_UNCONFIRMED 2 · SAME_SELLER_DISTINCT_LISTING 1 ·
⚠COLOR 1 · ⚠MODEL_CODE 1 · ⚠COLOR+MODEL_CODE 1
```

🔴 **분모는 8 이다**(CEO DIFFERENT 24 중 16 미도달). 🟢 그래도 방향은 분명하다 —
**오포함 0 · 가격 축 진입 0**. 🔴 **보호축을 약화시키는 제안은 이 표를 먼저 깨야 한다.**

---

## C. Composition — 🔴🔴🔴 **내 Step 4 측정이 «다른 것» 을 쟀다. 정정한다**

```
운영  COMPOSITION_PATTERN (cross-seller.ts:477)
      /\b(\d+)\s*[-\s]?pack\b|\bpack of (\d+)\b|\bset\b|\bbundle\b|\bkit\b|\b(two|three)[- ]piece\b/i
      ⟹ **「세트 구성 · 묶음 수량」** (2-pack · set · bundle · kit · two-piece)
내 Step 4 분류 reader
      /(\d{1,3}\s*%\s*[a-z가-힣]{3,20}|…)/i
      ⟹ **「소재 조성 비율」** (100% cotton)
```

🔴🔴 **같은 영어 단어 `composition` 을 두 개념으로 읽었다.** ⟹ Step 4 의
`composition B 51` 과 「51/51 이 제목에 없어 그 축이 발화 못 한다」는 **운영 COMPOSITION
축과 무관한 숫자** 다. 🔴 그 문장을 폐기한다.

### 🟢 정정 후 — 두 축이 갈린다

```
① 세트 구성(운영 COMPOSITION) — **conflict 전용** 이다(:980 `conflicts.push`) ·
   positive axis 로 쌓이는 자리가 **없다**(전수 grep)
   ⟹ 🔴🔴 **확대해도 SAME 회수는 구조적으로 0** 이다. 늘어나는 것은 **차단** 뿐이다
   🟢 그리고 그 축은 **드물게 발화하도록 설계됐다** — 그 함수 주석이 직접 적는다:
      「표본의 97%가 양쪽 다 표시 없음이라 이 규칙은 «드물게» 발화한다」
   ⟹ 🟢 이번 70후보에서 **발화 0 은 결함이 아니라 설계대로** 다
② 소재 조성 — owner 는 **`materialText` / `MATERIAL`** 이고 **이미 측정·거부됐다**
   `seller-facts.ts:317` 이 그 칸을 **의도적으로 비운다**:
      원상품 "Organic Cotton 100%" ↔ m.luxboy "100% Cotton"
      ⟹ 🔴 **거짓 MATERIAL blocker** (CEO 는 그 후보를 SAME 이라 했다)
      stockmann "100% puuvill"(에스토니아어) ⟹ 어휘에 없어 **축 0**
   🟢 측정 결과 — **새 축 0 · 거짓 blocker 1**(= 순손실) ⟹ 채우지 않았다
   🔴 레버는 「소재 어휘 정규화」(`organic cotton ≡ cotton`)이고 **`compareMaterial` 변경**
      이라 CPO 판정 사안이다
```

🔴 **그러므로 CPO ② 의 「본문까지 evidence 확장」은 ①에 적용하면 SAME 회수 0 이고,
②에 적용하면 이미 순손실로 측정된 축이다.** 🟢 메모
`description-evidence-turns-same-into-blockers` 가 같은 방향을 이미 기록해 뒀다.

---

## D. 🟢🟢🟢 AB ↔ AC — **이 트랙에서 처음으로 «분리 가능한» 축이 나왔다**

`MODEL_CODE` conflict **6건 전수**(원상품 품번 ↔ 후보 품번):

| CEO GT | 상품 | 후보 | 원상품 | 후보 | 라인 |
|---|---|---|---|---|---|
| **SAME** | P-02 | cemarose.ca | `B226AC009` | `B226AB040` | 🟡 **AC ↔ AB** |
| **SAME** | P-02 | bobochoses.com | `B226AC009` | `B226AB040` | 🟡 **AC ↔ AB** |
| **SAME** | P-02 | junioredition.com | `B226AC009` | `B226AB040` | 🟡 **AC ↔ AB** |
| **SAME** | P-03 | bobochoses.com | `B226AC010` | `B226AB046` | 🟡 **AC ↔ AB** |
| **DIFFERENT** | P-03 | tinyapple.net | `B226AC010` | `B226AC141` | 🔴 **AC ↔ AC** |
| **DIFFERENT** | P-03 | junioredition.com | `B226AC010` | `B226AC141` | 🔴 **AC ↔ AC** |

```
🟢🟢 두 모양이 **깨끗하게 갈린다** —
   AC↔AB (kids ↔ baby 라인 차이)  → CEO **SAME 4/4**
   AC↔AC (같은 라인 · 다른 번호)   → CEO **DIFFERENT 2/2**
⟹ 🔴 **라인 차이만 비차단으로 바꾸는 완화는 DIFFERENT 2건의 사정거리 밖이다**
   (그 둘은 라인이 **같고** 번호가 다르다)
```

🔴🔴 **여덟 축에서 측정된 「완화 = Human DIFFERENT 동반 개방」 패턴의 첫 예외 후보** 다.
🟢 그리고 **선례가 같은 방향을 말한다** — WU-070 이 L4(라인 비차단)를 26쌍에서 재서
**False SAME 증가 0 · 여는 3건 전부 SAME** 을 측정했다. 🟢 WU-112 CEO GT 도
「AC↔AB = 동일상품」을 N=3 으로 확인했고 **이번에 N=4 가 됐다**.

🔴 **그러나 넘겨 읽지 않는다**:
```
⒜ 장치가 **둘** 이다 — `conflicts: MODEL_CODE`(6건 전부)와
   `blockers: MODEL_CODE_AGE_LINE`(2건만 · bobochoses.com·junioredition.com P-02)
   ⟹ 🔴 **둘을 같이 설계해야** 한다(하나만 풀면 WU-069 의 「삼중 잠금」처럼 변화 0)
⒝ WU-069/070 은 그 완화를 **「품번 보호의 해체」** 로 평가했다 — 그 평가가 이 분모에서도
   유효한지는 **반사실 재측정이 필요** 하고 🔴 **CTO 가 돌리지 않았다**(Step 5 = 분석만)
⒞ 분모는 **6** 이다. 백분율로 일반화하지 않는다
⒟ 메모 `ceo-visual-gt-overturned-the-luxboy-counterexample` 가 반대면(「품번 같아도
   색 다르면 DIFFERENT」)의 반례를 뒤집었다고 적는다 ⟹ 🔴 그 메모와 WU-069 중
   어느 쪽이 현재 기준인지 **CPO 확인이 필요** 하다
```

🔴 **Age 축** — `MODEL_CODE_AGE_LINE` 2건은 **품번 증거가 양쪽 다 `A`** 다(수집 문제 아님).
`ageRangeText` 는 **A 0/70** 이지만 그 blocker 의 입력이 아니다 — **품번의 라인 코드** 다.
🔴 Baby/Kids 를 자동 DIFFERENT 로 되돌리는 제안은 **하지 않았다**.

---

## E2. sellerSku 의 역할 — 코드 경로 기준

```
🔴 `sameSellerDistinctListing` 은 sellerSku 를 **쓰지 않는다**(위 E) ⟹ 「방어축」도 아니다
🟢 `ProductFacts.sellerSku` 는 존재하고, 승격 경로는 **URL slug → 품번** 쪽이다
   (`extractCodeLikeSlugSegment` · WU-071 이 kids21 `700005621lbl` 통과를 실측)
🔴 수집 실적 — **A 0 / 70**. 즉 **이 분모에서 sellerSku 는 아무 축에도 입력되지 않았다**
```

🔴 CPO ① 판정대로 **글로벌 동일상품 식별자로 취급하지 않는다.** 🟢 Step 5 의 판단:
**현재 분모에서 sellerSku 는 보조증거로도 작동하지 않는다**(입력 0) ⟹ 승격·강제 비교 제안 **없음**.

---

## F. 정책 후보 표 — 🔴 CTO 는 GO/HOLD 를 적지 않았다

| # | 정책 후보 | 근거 건수 | SAME 회수(측정) | DIFFERENT 위험(측정) | 부작용 | CPO 판단 |
|---|---|---:|---|---|---|---|
| **P1** | 🟡 **품번 «라인 차이»(AC↔AB)를 conflict/blocker 에서 제외** | 6 (SAME 4 · DIFF 2) | 🟢 **최대 4건**(cemarose · bobochoses×2 · junioredition) | 🟢 **이 분모에서 0** — DIFF 2건은 AC↔AC 라 사정거리 밖 | 🔴 장치 **둘**(conflict + `MODEL_CODE_AGE_LINE`)을 같이 바꿔야 한다 · WU-069/070 은 「품번 보호 해체」로 평가 · **반사실 재측정 미실시** | |
| **P2** | 🟡 **후보측 brand 수집 보강**(`shopify.vendor` 미수집 1건) | 1 | 🟢 **최대 1건**(bobochoses.co.jp) | ⚪ 미측정 | 🔴 WU-080 이 REJECT 한 것은 **원상품측** 공백 메우기다 — 이 건은 **후보측** 이라 같은 축인지 **확인 필요** | |
| **P3** | 🔴 **원상품 brand 공백 복구**(PRODUCT-07 S6) | 1 상품 · 후보 8 | ⚪ 미측정 | 🔴 WU-080 실측: 보류→**충돌** 악화(SAME 4 더 막힘 · DIFF 2 열림) | 🔴 그 WU 가 이미 REJECT 했다 — 재개 근거 없음 | |
| **P4** | 🔴 **세트 구성(COMPOSITION) evidence 를 본문까지 확대** | 0 | 🔴 **구조적으로 0**(conflict 전용 · positive axis 없음) | 🔴 차단만 늘어난다 | 🔴 **제안하지 않는다** | |
| **P5** | 🔴 **소재 조성(`materialText`) 채우기** | — | 🔴 **새 축 0**(실측) | 🔴 **거짓 blocker 1**(CEO SAME 후보) | 🔴 `seller-facts.ts:317` 이 이미 순손실로 거부 · 레버는 **어휘 정규화**(`compareMaterial` 변경) | |
| **P6** | 🔴 **`sellerSku` 를 식별자/보조증거로 승격** | 0 | 🔴 입력 **A 0/70** ⟹ 효과 0 | 🔴 판매처 내부 식별자 | 🔴 CPO ① 이 이미 금지 | |
| **P7** | 🔴 **threshold / `SAME_MIN_AXES` 완화** | ⑤ 2건 | 🟡 2건 | 🔴 **보호축 전체** · FP 0/8 을 깬다 | 🔴 CPO 금지축 | |

🟢🟢 **표의 결론 한 줄** — **실측 근거가 있는 후보는 P1 하나이고, P2 가 그 다음이다.**
나머지 다섯은 **측정이 이미 「효과 0」 또는 「순손실」을 말한다.**

---

## G. 측정불가 / 한계

```
🔴 P1 반사실 **미실시** — 라인 비차단 시 전체 70 후보에서의 영향을 재지 않았다
   (CPO 「코드 변경 0」 범위를 지켰다) ⟹ 「SAME 최대 4건」은 **상한** 이다
🔴 P2 는 **1건** · P1 은 **6건** 분모다. 백분율로 적지 않는다
🔴 CEO DIFFERENT 16 · CEO SAME 20 · REVIEW 10 이 **미도달** 이라 그 구간은 측정 밖이다
🔴 PRODUCT-01 AC157 — 원상품 facts 없음(CPO ③ 판정 유지 · 측정불가)
🔴 GT conflict — 공식 LOCK **3** · Step 4 관측 **4**. 🔴 **섞지 않았고 어느 쪽도 고르지 않았다**
🔴 축 매핑은 E 에서 하나(`SAME_SELLER…`)만 코드로 확정했다 — 나머지는 **이름 대응** 이다
```

---

## H. 🔴 내 결함 3건 — 전부 적는다

```
① 🔴 축 매핑 `SAME_SELLER_DISTINCT_LISTING → sellerSku` 가 **틀렸다** —
   그 함수는 sellerSku 를 **0회** 쓴다. 🟢 **CPO 가 승인 보류해서 잡혔다**
   ⟹ blocker 증거 비율이 13/18 → **15/18** 로 정정됐다
② 🔴 `kihanan.com` 을 「증거를 갖고 판단」으로 분류했다 — 실제는 **원상품측 brand 공백**
   이다(후보 brand 는 A). 🟢 양쪽을 갈라 다시 셌다
③ 🔴🔴 Step 4 의 `composition` 측정이 **운영과 다른 개념** 이었다(세트 구성 ↔ 소재 조성).
   🟢 운영 패턴을 직접 읽어 잡았고, Step 4 의 그 문장을 **폐기** 한다
```

---

## I. 현재 좌표 / 다음 한 수

```
현재   🟢 **Step 5 CLOSED(분석)** — A~F 6문 전부 답했다 · 코드 변경 0 · 배포 0
       🟢🟢 핵심 — **blocker 15/18 이 증거를 «갖고» 막았다** ⟹ threshold 완화 근거 없음
       🟢🟢 그리고 **처음으로 분리 가능한 축이 나왔다** — AC↔AB 는 CEO SAME 4/4 ·
          AC↔AC 는 CEO DIFFERENT 2/2 ⟹ P1 완화는 이 분모에서 DIFFERENT 를 열지 않는다
       🔴 나머지 후보는 측정이 「효과 0」 또는 「순손실」을 말한다

다음   🔴 **CPO 가 F 표의 P1 / P2 를 판정한다.** GO 면 그 다음이 CTO 의 일이다 —
       **P1 반사실 측정**(라인 비차단 시 70 후보 전체 영향 · conflict + MODEL_CODE_AGE_LINE
       두 장치 동시) → 그 결과로만 구현 판단. 🔴 CTO 는 승인 전 코드를 만지지 않는다
🔴 Search · Price · UI · Registry 재진입 금지 · GT 수정 금지 · 분모 재계산 금지
```
