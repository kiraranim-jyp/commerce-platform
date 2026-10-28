# DISCOVERY-E2E-HISTORY-10 — 히스토리 10건 실측

🔴 **운영 코드 변경 0.** 측정·계약 전용(2026-10-28).

---

## A. 상품별 결과

🔴 **「따져 노출」 열을 PASS 로 적을 수 있는 상품이 하나도 없다** — 그 앞 단계에서 멈춘다.

| 카테고리 | 상품 | 호스트 | 원본확정 | 품번 | Search | 유효후보 | Identity | 국내가격 | 해외최저 | 따져 노출 |
|---|---|---|---|---|---|---:|---|---|---|---|
| 아동 | Bobo Choses · Hug Hairy Monster T-shirt | bobochoses.com | 🟢 OK | `B226AC009` | 🟡 **질의 생성 O · 실행 측정불가** | — | — | — | — | 🔴 미도달 |
| 아동 | Main Story · Bubble Sweatshirt | junioredition.com | 🟢 OK | `AW26MS185` | 🟡 **질의 생성 O · 실행 측정불가** | — | — | — | — | 🔴 미도달 |
| 아동 | BOSS · Baby Boys White Logo Top | designerkidswear.com | 🟢 OK | **null** | 🔴 **NO_MODEL_CODE(0회)** | 0 | — | — | — | 🔴 미도달 |
| 아동 | Louis Louise · Holly Hearts Velvet Pants | smallable.com | 🟢 OK | **null** | 🔴 **NO_MODEL_CODE(0회)** | 0 | — | — | — | 🔴 미도달 |
| 아동 | Mini rodini · Violas aop Winter jacket | houseofkids.com | 🟢 OK | **null** | 🔴 **NO_MODEL_CODE(0회)** | 0 | — | — | — | 🔴 미도달 |
| 테니스 | Damarindo Pique Polo | tennis-warehouse.com | 🟢 OK | **null** | 🔴 **NO_MODEL_CODE(0회)** | 0 | — | — | — | 🔴 미도달 |
| 테니스 | Fall Cericho T-Shirt | tennis-warehouse.com | 🟢 OK | **null** | 🔴 **NO_MODEL_CODE(0회)** | 0 | — | — | — | 🔴 미도달 |
| 테니스 | Magro Long Sleeve | tennis-warehouse.com | 🟢 OK | **null** | 🔴 **NO_MODEL_CODE(0회)** | 0 | — | — | — | 🔴 미도달 |
| 테니스 | Racchetto Polo | tennis-warehouse.com | 🟢 OK | **null** | 🔴 **NO_MODEL_CODE(0회)** | 0 | — | — | — | 🔴 미도달 |
| 테니스 | Trattino Short | tennis-warehouse.com | 🟢 OK | **null** | 🔴 **NO_MODEL_CODE(0회)** | 0 | — | — | — | 🔴 미도달 |

```
아동의류   따져 화면 도달 **0 / 5**
테니스의류 따져 화면 도달 **0 / 5**
```

### 🟢 ① 원본 상품정보는 **10/10 확정된다**

운영 추출 경로(`universalExtract → buildCanonicalProduct → buildProductIdentityDna`) 실측 —
제목·브랜드·색상·가격이 **전건** 확정됐다.

```
Bobo Choses  40 EUR · Light blue      Main Story 57 GBP · Grey Melange
BOSS         84 CAD · White           Louis Louise 69 EUR · Pink
Mini rodini  104.79 EUR · 색상 null
Sergio Tacchini  53.97 / 54 / 120 / 53.97 / 88 USD
```
🔴 `images: 0` 은 **하니스 산출물** 이다(`items: []` 로 불렀다) — 제품 사실로 읽지 않는다.

---

## B. Funnel — **①에서 ②로 못 넘어간다**

```
Search raw → Shape → Policy → Crawl → Evidence → Identity → Price → MI → API → Client → DOM
  ↑
  🔴 **여기서 끊긴다.** 10건 중 8건은 Search 가 «실패» 한 것이 아니라 «실행되지 않았다».
```

| 단계 | 아동 5 | 테니스 5 |
|---|---:|---:|
| ① 원본 확정 | **5** | **5** |
| 품번 확보 | **2** | **0** |
| Discovery Query 생성 | **2** | **0** |
| Search 실행 | 🟡 측정불가 | **0** |
| 이후 전 단계 | 🔴 미도달 | 🔴 미도달 |

🔴 **drop reason 을 하나로 합치지 않는다** — 이번 손실은 전부 `NO_MODEL_CODE` 하나이고
`POLICY_BLOCKED` · `NOT_PRODUCT_PAGE` · `UNREACHABLE` · `NO_EVIDENCE` ·
`IDENTITY_NOT_MATCHED` · `MARKET_UNKNOWN` 은 **한 건도 발생하지 않았다**(도달 전이다).

---

## C. 🔴🔴🔴 원인 — **Discovery Query 가 품번 전용이고, 품번 생산자가 둘뿐이다**

```
query-planner.ts:97  buildDiscoverySearchQuery(identity)
                       const code = identity.productCode?.trim();
                       if (!code) return null;          ← 🔴 여기서 끝난다
web-search-pool.ts:128 if (!query) { metrics.skipped = "NO_MODEL_CODE"; return { urls: [] } }

product-identity-dna.ts:144  resolveBrandModelCode(product)
  ⒜ extractLabeledProductCode(product.description)   「Product code:」/「Article code:」 라벨
  ⒝ extractCodeLikeSlugSegment(extractUrlSlug(url))   URL 앞머리 품번 조각
  🔴 **그 둘뿐이다.** (함수 주석이 그 사실을 직접 적고 있다)
```

🟢 2건이 통과한 이유도 정확히 그 둘이다 — Main Story 는 ⒜(`라벨문구 O · AW26MS185`),
Bobo Choses 는 ⒝(`b226ac009-hug-hairy-monster-t-shirt`).

### 🔴🔴 그리고 「품번이 없는 상품」이 **아니다** — 원문에 있다

HTTP 200 원문 실측(9/10 · smallable 1건은 raw fetch `TypeError` 로 **미측정**):

| 상품 | 라벨문구 | 라벨 추출 | 🔴 원문의 품번 «모양»(관측) |
|---|---|---|---|
| Main Story | **O** | `AW26MS185` | — |
| Bobo Choses | X | null | URL slug 가 품번(⒝로 통과) |
| BOSS | X | null | **`HB-J53497-10P-`** · URL 에도 `j53497-10p` |
| Mini rodini | X | null | **`V276025-9848`** |
| Damarindo Pique Polo | X | null | **`STS226M50459`** |
| Fall Cericho T-Shirt | X | null | **`STF26M51696-`** |
| Magro Long Sleeve | X | null | **`STF26M51683-`** |
| Racchetto Polo | X | null | **`STS26M51567`** |
| Trattino Short | X | null | (샘플 상위에 TW 자체 SKU `STMFTS0` 만) |

🔴 **「모양 후보」는 관측이지 판정이 아니다** — 그 문자열이 제조사 품번이라고 **단정하지 않았다**.
🟢 단 BOSS 는 **URL 과 본문 두 곳에 같은 `J53497`** 이 있어 근거가 가장 강하다.
🔴 그리고 **고치지 않았다** — Identity/추출 규칙 변경은 이번 스프린트 금지 항목이다.

---

## D. 🔴 측정불가로 남긴 것 — **0 으로 적지 않는다**

```
⒜ 🔴🔴 **Search 실행 2건** — `APIFY_API_TOKEN` 이 **Production 전용 · Encrypted** 다.
   실측: `vercel env pull` → **빈 문자열**(§10 「Production Sensitive 는 읽을 수 없다」).
   ⟹ 로컬 결과는 `skipped: "NOT_CONFIGURED"` = **「못 물어봤다」** 이고
      🔴 **「웹에 후보가 없다」가 아니다**(운영 코드가 그 둘을 스스로 구분한다).
⒝ 등록부 검색 · 국내 목록 탐색 · **정책 게이트** — service-role 키 부재로 **돌지 않았다**
   ⟹ 이번 funnel 은 **정책 적용 «전»** 이다(이번엔 후보가 0 이라 영향도 0).
⒞ `computeMarketIntelligence` — 전건 `MI_NULL`(DB 권한). **「MI 가 0 을 냈다」가 아니다.**
⒟ Louis Louise 원문 품번 — smallable raw fetch 실패(WU-083/084 헤더 초과 계열) · **미측정**.
⒠ 🔴 **실제 Production 화면은 CTO 가 볼 수 없다**(로그인 뒤).
```

---

## E. 🔴 분모의 구조적 한계 (숨기지 않는다)

```
테니스 히스토리 27건이 **전부** `Sergio Tacchini` × `tennis-warehouse.com` 이다.
⟹ CPO §2 의 「특정 사이트 하나에 종속되지 않게」는 테니스 축에서 **충족 불가** 다.
🟢 아동 축은 충족했다 — **브랜드 5 · 호스트 5 전부 다름**(bobochoses · designerkidswear ·
   smallable · junioredition · houseofkids). 계약으로 잠갔다.
```

---

## F. 이번에 생긴 계약 7 + 음성 대조 2

```
분모 4   10건 실재 · 아동 브랜드/호스트 5·5 · 테니스 1·1(구조적 한계 고정) ·
         정책 집합 **DB 실측 13 도메인**
병목 3   Query 는 품번 전용 · 품번 생산자 **정확히 셋 호출**(순서까지) ·
         **[결함 고정] 10건 중 Query 2건**  ← 생산자가 넓어지면 **FAIL 로 뒤집힌다**
변이 M1  품번 없을 때 상품명으로 질의 생성 → **1 FAIL** → 바이트 동일 복구
변이 M2  생산자 추가(`?? extractUrlSlug(title)`) → 🔴 **1차 통과**(내 계약이 뚫렸다)
         원인: `new Set(...).size` 로 셌는데 그 이름이 **이미 집합에 있었다**
         🟢 **호출 개수와 순서** 로 강화 → **1 FAIL** → 바이트 동일 복구
```

🔴 **정정** — E2E-07/E2E-CLOSE 하니스가 `NOT_AVAILABLE` 을 **3 도메인**으로 쥐고 있었다.
운영 실측은 **13** 이다(`auction` · `cjonstyle` · `enuri` · `gsshop` · `hmall` · `kream` ·
`lotteon` · `shopping.naver` · `smartstore.naver` · `ssg` 추가) ⟹ 그때의 `blockedByPolicy` 는 **하한**이었다.

---

## G. 🟡 CPO 결정 — **셋 중 하나이고 CTO 가 고르지 않았다**

```
⒜ **Query 생산 축을 넓힌다** — 품번 없으면 브랜드+디자인명 축으로 간다
   🔴 `query-planner.ts:93` 주석이 「fallback 을 만들지 않는다(CPO §7 ⑨)」로 **명시 금지**
   🔴 그리고 SPRINT-05/06 이 「상품명 영어 질의 → 국내 결과 구조적 0」을 실측했다
⒝ **품번 생산자를 넓힌다** — 원문에 있는 제조사 품번을 더 읽는다(⒜보다 좁다)
   🟢 Discovery 뿐 아니라 Identity 품질도 같이 오른다
   🔴 **Identity 입력을 바꾸는 변경** 이다 — 8축 보호계약과 만난다(CPO 판정 사안)
⒞ **현행 유지** — 품번이 노출된 상품만 Discovery 대상으로 본다
   🔴 그러면 **테니스 축은 현재 정책으로 영구히 후보 0** 이다
```

🟡 **그리고 Search 실행 2건은 Production 에서만 가능하다** — CEO 가 `/pipeline` 에서
`Bobo Choses B226AC009` · `Main Story AW26MS185` 두 상품만 「🔄 다시 분석」 **1회씩** 누르면
그 축이 닫힌다(🔴 나머지 8건은 눌러도 Search 가 돌지 않는다 — 위 C 의 이유).

**최종 판정 — 🔴 FAIL** (성공 기준 「후보가 존재하는데 화면에서 사라지는가」 이전에,
**10건 중 8건은 후보 탐색 자체가 시작되지 않는다**).
