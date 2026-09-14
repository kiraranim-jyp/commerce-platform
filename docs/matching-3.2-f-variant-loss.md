# MATCHING-3.2-F · VARIANT EXTRACTION LOSS (READ ONLY)

- 지시: CEO, 2026-09-14 · 실측 2026-09-14, 브랜치 `main`, 시작/종료 HEAD `8aecc02`
- **코드 0줄 수정. 커밋 0건. DB write 0건(SELECT만). 외부에는 GET 만.**
  임시 스크립트는 저장소 밖(`packages/database/node_modules/.mi-scratch`, gitignore 대상)
  에서 돌리고 지웠다. `docs/matching-3.2-c/d/e-*`, `docs/seller-edit-*`,
  `docs/beta-security-3-*` 는 미추적 그대로 두었고, `docs/lotteon-*` 은 열지 않았다.
- 직전 조사 `docs/matching-3.2-e-color-safety.md` / `-d-color-authority.md` 를
  재사용했고, 거기서 확정된 수치는 다시 측정하지 않았다.

---

# 0. 핵심 질문에 대한 답

> **`optionGroups` 를 Matching evidence 로 쓰기 전에, "색상 variant 집합"이라는
> 의미를 안전하게 판별할 수 있는가?**

## 🟡 **질문을 둘로 갈라야 답이 나온다. 하나는 가능, 하나는 불가능이다.**

```
Q-A  "이 값들이 이 리스팅이 실제로 파는 색 집합인가"
       → 🟢 판별 가능하다. 저장된 CanonicalProduct 만으로 판별된다(§8 조건 D).
         근거 관측: DB 67행 + 외부 642상품(3개 판매처).

Q-B  "optionGroups 가 원본이 선언한 variant 를 빠짐없이 담았는가"
       → 🔴 판별 불가능하다. ProductGroup 경로에서 버려진 원소는 저장 데이터에
         아무 흔적도 남기지 않는다. 카운터도, 플래그도, 로그도 없다(§2).
```

그리고 **Matching 이 필요로 하는 것은 Q-A 이지 Q-B 가 아니다.** 근거는 §1 에서
실측한 다음 한 줄이다 — **버려지는 원소는 "이 리스팅의 다른 variant"가 아니라
"다른 리스팅(다른 URL·다른 model·다른 SKU)으로 가는 링크"였다. 34개 원소 전부.**

> 🔴 그러나 이것은 **"optionGroups 가 더 정확하다"는 말이 아니다.**
> §8 의 조건 D 를 통과하는 오늘의 DB 색상 축은 여전히 **5/67 행뿐**이고,
> 그 5행은 전부 판매처 한 곳(smallable)이다. 조건 D 는 "권위를 올려도 된다"가
> 아니라 **"이 모양은 색 집합이 아니다"를 걸러내는 거름망**이다. 그리고 조건 D 는
> Q-B 를 보증하지 못한다 — **ProductGroup 경로의 완전성은 여전히 미검증이다.**

---

# 1. `hasVariant` 전체 구조 — 원소별 키 전수

## 1-1. 표본

```
www.smallable.com  80 URL (운영 DB 20 + 사이트맵 60, 사이트맵은 products1/5/9 에서 등간격)
                   전부 HTTP 200, 실패 0
                   ProductGroup 보유 19 · 미보유 61
                   ProductGroup 보유 19건 전부 variesBy = "https://schema.org/color"
```

## 1-2. `hasVariant` 배열 길이 분포 (19 상품)

```
2개 14 · 3개 2 · 4개 1 · 6개 1 · 9개 1      원소 합계 53
```

## 1-3. 원소 키 전수 — **모양이 정확히 두 가지뿐이다**

```
×34   ["url"]                                                          ← url-only
×19   ["@context","@type","name","image","description","brand",
       "model","sku","color","logo","offers"]                          ← 완전 원소

url-only 비율  34 / 53 = 64.2%
완전 원소      19 / 53 = 35.8%   — 상품당 정확히 1개. 19/19 예외 없음.
```

`size` 키를 가진 원소는 **0개**다. `additionalProperty` 를 가진 원소도 **0개**다.
즉 smallable 의 ProductGroup 이 말하는 축은 색 하나뿐이고, 사이즈는 JSON-LD 에
아예 없다(그래서 DB smallable 20행 중 Size 축을 가진 행이 0건이고,
`resolveSizeRange`(product-identity-dna.ts:153)는 smallable 질의에서 항상 빈 배열이다).

## 1-4. 그래서 추출기가 남기는 것

```
추출기가 KEEP 하는 variant 수    상품당 1개 — 19/19 상품 전부
추출기가 내놓는 Color 값 개수    1개        — 19/19 상품 전부
버려지는 원소 수 분포            1개×14 · 2개×2 · 3개×1 · 5개×1 · 8개×1
원소가 하나라도 버려진 상품      19 / 19  (100%)
```

> **"Color 값이 1개"는 이 판매처에서 관측이 아니라 상수다.** 실제 색 가족의 크기가
> 2색이든 9색이든 저장값은 언제나 1이다. **그래서 이 숫자에는 색 개수에 관한
> 정보가 0비트 들어 있다.** 3.2-E §3-1 이 센 "색상 축 values 길이 1개 5건"은
> 상품의 성질이 아니라 추출기의 성질이었다.

## 1-5. 가장 큰 손실 사례 (원문 그대로)

```
chamois-merino-wool-socks-cherry-red-collegien-435123   hasVariant = 9
  [0] 완전 원소  color="Cherry red"  sku=AAA1824560      ← 이것만 남는다
  [1..8] url-only  navy-blue / light-grey / purple / charcoal-grey /
                   black / beige / dusty-pink / taupe-brown            ← 8개가 사라진다

elasticated-lace-sneakers-9060-pink-new-balance-428902  hasVariant = 6  (5개 사라짐)
tote-l-zipped-black-vanessa-bruno-432157                hasVariant = 4  (3개 사라짐)
```

## 1-6. 🟢 그런데 버려지는 것은 "이 리스팅의 variant"가 아니다

url-only 원소 34개 전부, 링크가 가리키는 곳은 **다른 상품 페이지**다
(다른 URL · 다른 model 번호 · 다른 SKU). 실제로 따라가 확인한 것은 §3.

```
430663 (Lavender, model 430663, sku AAA1804712)
  → url-only 가 가리키는 430664 는 model 430664, sku AAA1804718, color "Navy blue"
    = 스몰러블에서 별도로 파는 별개 리스팅이다.
```

즉 smallable 의 `hasVariant` 는 **"이 페이지의 구매 옵션 목록"이 아니라
"이 색 가족의 형제 페이지 목록"**이다. 추출기가 union 을 만들려고 설계됐는데
(:246-259 주석: "축 이름별로 등장한 값의 합집합"), 실제로 들어오는 데이터에서는
그 union 이 만들어지면 **오히려 틀린다** — 한 색만 파는 페이지에 9색이 붙는다.
**:226 의 skip 이 결과적으로 그것을 막고 있다. 의도해서가 아니라 우연히.**

---

# 2. `:225`(실제로는 `:226`)에서 버려지는 이유

## 2-1. 정확한 조건

```ts
// product-data-extractor.ts:222-226
const axes: Record<string, string> = {};
if (typeof v.color === "string" && v.color.trim()) axes["Color"] = v.color.trim();
if (typeof v.size  === "string" && v.size.trim())  axes["Size"]  = v.size.trim();
Object.assign(axes, readAdditionalProperties(v));
if (Object.keys(axes).length === 0) continue;   // ◀ 여기
```

탈락 조건은 정확히 하나다 — **`color` / `size` / `additionalProperty` 중 어느 것도
문자열 값으로 읽히지 않으면 그 원소를 통째로 버린다.** url-only 원소는 `color` 도
`size` 도 `additionalProperty` 도 없으므로 `axes` 가 비고, 100% 탈락한다.

## 2-2. 🟡 **의도적 방어다. 다만 그 방어의 부작용이 미처리다.**

```
의도적인 부분   주석이 명시한다 — "축을 하나도 못 찾으면 이 variant는 옵션 조합에
                못 쓴다 — 건너뛴다(지어내지 않는다)". 함수 상단 주석(:159)도
                "축 이름이 없는 값은 절대 지어내지 않는다"고 못 박는다.
                값을 만들어내는 것을 막는 방어로서는 옳고, 실제로 그 방어가
                §1-6 의 사고(형제 색이 이 페이지 색으로 합쳐지는 것)를 막고 있다.

미처리인 부분   ① **몇 개를 버렸는지 어디에도 남기지 않는다.** 카운터도 플래그도
                   로그도 없다. `optionGroups`/`variants`/`sources` 어느 칸에도
                   "불완전"이라는 표시가 없다.
                ② **복원 열쇠인 `v.url` 을 그 자리에서 버린다.** 이 함수는 `v.url`
                   을 한 번도 읽지 않는다(:237-242 의 push 에 url 칸이 없다).
                   §3 에서 보듯 그 url 하나면 색을 되살릴 수 있는데, 추출 시점에
                   손에 쥐고 있다가 놓는다.
                ③ **소비자 쪽에서 "1값"과 "1값으로 줄어든 것"을 구분할 수 없다.**
                   `resolveSizeRange`(product-identity-dna.ts:153)도 똑같이
                   `group.values` 를 그대로 믿는다.
                ④ 전 원소가 탈락하면 `rawVariants.length === 0` → `:244` 에서
                   **함수가 통째로 null 을 반환**하고 DOM select 폴백으로 내려간다.
                   §4-2 의 Shopify ProductGroup 마크업이 정확히 이 경로다.
```

> 한 줄로: **"값을 지어내지 않는다"는 방어는 성공했고, "값을 잃었다는 사실을
> 남긴다"는 처리는 존재하지 않는다.**

---

# 3. URL 로 복원 가능한가 — 실제 GET 결과

## 3-1. 실측 (2026-09-14, 읽기 전용 GET, 총 11회)

```
430663  bobo-choses-organic-cotton-ample-joggers-lavender-430663
  본체     color="Lavender"   sku=AAA1804712
  url-only 1개 → GET 1회
    [200] ...ample-joggers-navy-blue-bobo-choses-430664
          color="Navy blue"  sku=AAA1804718  그 페이지의 hasVariant 도 2개
  ▶ 🟢 복원 성공 1/1.  추가 요청 1회.

435123  chamois-merino-wool-socks-cherry-red-collegien-435123
  본체     color="Cherry red" sku=AAA1824560
  url-only 8개 → GET 8회
    [200] charcoal-grey-283971  color="Charcoal grey"  sku=AAA1219656   ✅
    [200] black-324890          color="Black"          sku=AAA1385042   ✅
    [200] dusty-pink-324889     color="Dusty Pink"     sku=AAA1385038   ✅
    [200] navy-blue-283972      JSON-LD 자체가 0개                       ❌
    [200] light-grey-283973     JSON-LD 자체가 0개                       ❌
    [200] purple-401199         JSON-LD 자체가 0개                       ❌
    [200] beige-364708          JSON-LD 자체가 0개                       ❌
    [200] taupe-brown-324887    JSON-LD 자체가 0개                       ❌
  ▶ 🟡 복원 3/8.  추가 요청 8회.
```

실패한 5건은 **품절 페이지**다. HTTP 200 이지만 본문이 722KB → 386KB 로 줄고
`application/ld+json` 스크립트가 **한 개도 없다**(품절 표기는 본문에 있다).
즉 **이 경로는 재고 상태에 의존한다.**

## 3-2. 비용

```
상품 1건당 추가 GET = (hasVariant 길이 − 1)
이번 표본 19 상품 기준 총 34회 추가 (상품당 평균 1.8회, 최대 8회)
페이지당 본문 ~0.4–0.7MB → 34회 ≈ 20MB
크롤 시점에 동기로 하면 상세 1건 수집 시간이 최대 9배가 된다.
```

## 3-3. 🟡 요청 없이 복원하는 길도 보이지만 **추론이다**

url slug 에 색이 들어 있다 — `...-socks-navy-blue-collegien-283972`,
`...-joggers-navy-blue-bobo-choses-430664`. 형식은 `{상품명}-{색}-{브랜드}-{id}` 로
보이고 19상품 34링크에서 형식이 깨진 것은 없었다. **그러나 이것은 원문 필드가
아니라 문자열 추측이다.** 브랜드명에 색 단어가 들어간 경우(예: `...-pink-...`가
브랜드의 일부)를 가려낼 방법을 이 조사에서는 검증하지 않았다. 이 저장소의 원칙
("지어내지 않는다")에 비추어 **권장하지 않는다.** 사실로만 남긴다.

---

# 4. 같은 패턴이 얼마나 흔한가

## 4-1. smallable — **ProductGroup 을 쓰는 상품에서는 100%**

```
표본 80 상품 → ProductGroup 19 · 미보유 61
ProductGroup 19건 중 원소가 버려진 상품 = 19 (100%)
url-only 원소 비율 = 34/53 = 64.2%
색 가족 크기 분포(=hasVariant 길이)  2색 14 · 3색 2 · 4색 1 · 6색 1 · 9색 1
  ⇒ **표본의 모든 ProductGroup 상품이 2색 이상 가족에 속한다. 저장값은 전부 1이다.**
```

운영 DB 의 smallable 20 URL 중 오늘 ProductGroup 이 살아 있는 것은 3건
(430651 · 430663 · 409775, 전부 `hasVariant=2`)이고, 나머지 17건은 오늘
ProductGroup 이 없다. 그중 `426478` · `424671` 는 **DB 에 Color 값이 있는데 오늘은
JSON-LD 가 0개**다(§3-1 과 같은 품절 페이지 모양). 즉 그 두 행은 재고가 있던
수집 시점의 값이다.

## 4-2. 다른 판매처 — **두 번째 손실 모양이 나왔다**

운영 DB 의 나머지 7 호스트를 실제로 열었다(호스트당 1–6 URL):

| 호스트 | ProductGroup | hasVariant | url-only | 축 키를 가진 원소 |
|---|---|---|---|---|
| www.junioredition.com | **있음** | 6·6·4·5·2·5 | 0 | **0** |
| houseofkids.com | **있음** | 4 | 0 | **0** |
| bobochoses.com | 없음(`Product`) | — | — | — |
| designerkidswear.com | 없음 | — | — | — |
| www.theanimalsobservatory.com | 없음 | — | — | — |
| www.childrensalon.com | 없음(`Organization` 만) | — | — | — |
| www.babyshop.com | **403** | — | — | — |

junioredition / houseofkids 의 ProductGroup 은 Shopify 가 찍는 모양이고,
`hasVariant` 원소 32개 전부가 이렇다:

```
keys = ["@id","@type","gtin","image","name","offers","sku"]
color 없음 · size 없음 · additionalProperty 없음
사이즈는 name 안에 접미사로만 있다 —
   "Booty Ghosts Long Sleeve T-Shirt by Bobo Choses - 2-3 Years"
```

```
⇒ extractProductGroupOptions 는 이 32개를 **전부** :226 에서 버리고,
  rawVariants 가 비어 :244 에서 **null 을 반환한다.**
  이 호스트들에서 이 함수는 옵션을 0개 만든다.
```

**두 판매처 형태를 합치면 이렇다.**

```
JSON-LD hasVariant 원소 총 85개 (smallable 53 + Shopify형 32)
  :226 에서 탈락 66개 = 77.6%
  탈락 사유 두 가지 —  url-only 34 (smallable)
                      축 키 자체가 없음 32 (Shopify ProductGroup)
```

## 4-3. 🔴 그리고 **한 페이지에서 여러 색을 파는 상품을 찾았다**

3.2-E GATE 2 가 5,983 상품에서 0건이라고 적은 그 사례다. **Shopify `products.json`
경로(§5)로 들어오는 형태로 존재하고, 흔하다.**

| 스토어 | 색상 옵션 보유 | 실제 다색 리스팅 | 단일색 리스팅 | 선언⊃실제(가족목록) | 한 페이지 최대 색 수 |
|---|---|---|---|---|---|
| www.brooklinen.com | 144 | **122** | 21 | 1 | **42** |
| www.rothys.com | 250 | **17** | 1 | **232** | 12 |
| www.vessi.com | 248 | 0 | 248 | 0 | 1 |
| **합** | **642** | **139** | **270** | **233** | |

```
판별 기준(§8 D3): 옵션이 선언한 색 값 집합 == variants[] 가 실제로 쓰는 색 값 집합
  같다 + 값이 2개 이상  →  진짜 다색 리스팅        139건
  같다 + 값이 1개       →  진짜 단일색 리스팅      270건
  선언이 더 크다        →  "가족 목록"(이 페이지는 그중 한 색만 판다)  233건
```

`www.rothys.com/products/womens-point-flat-iii-revelvet-mulberry` 실측 —
`options[0] = {Color, 12값}` 인데 `variants` 17개는 전부 `option1 = "ReVelvet™
Mulberry"` 한 색이다(17 = 1색 × 17사이즈). **옵션 선언이 12색, 실제 판매는 1색.**

이 URL 들은 `/products/{handle}` 패턴이므로 **오늘의 파이프라인에서
`shopifySiteStrategy.detect` 가 곧바로 참을 돌려주고**(shopify.site-strategy.ts:66-68)
`shopify-product-json.ts:413` 이 그 12색을 그대로 `optionGroups` 에 넣는다.

> 🔴 **3.2-E GATE 2-d 의 "가상 2값 입력"은 더 이상 가상이 아니다.**
> 오늘 이 저장소의 크롤러에 rothys 상품 URL 한 줄을 넣으면
> `optionGroups = [{Color, 12값}]` 이 그대로 저장된다. 그리고 3.2-E 가 코드로
> 확인한 대로, 값이 2개가 되는 순간 `intersects()` 는 오답을 SAME 으로 통과시킨다.
> **빈도 미확인이라고 적었던 칸이 채워졌다 — 642 상품 중 372 상품(139+233)이
> 색 값 2개 이상이다.**
>
> 🟡 정직하게 함께 적는다: 이 세 스토어는 **성인 신발/침구/아동복 밖의 카테고리**이고
> 오늘 운영 DB 의 8 판매처에는 포함되지 않는다. "이미 들어와 있다"가 아니라
> **"들어오는 것을 막는 것이 아무것도 없다"** 가 정확한 표현이다.

---

# 5. 생성 경로 — **4개가 아니라 5개이고, 운영에서 실제로 도는 것은 2개다**

3.2-E §2-e 의 표는 `packages/crawler/src/product-data-extractor.ts` 안의 3개 +
PrestaShop 1개였다. **Shopify `products.json` 경로가 빠져 있었다.** 그리고 운영
DB 의 옵션은 **거의 전부 그 빠진 경로에서 온다.**

| # | 경로 | 코드 | `optionGroups` 에 넣는 것 | "구매 가능한 변형"인가 | `variants` | DB 실적(dedup 67) |
|---|---|---|---|---|---|---|
| 1 | Shopify products.json | `shopify-product-json.ts:413` | `product.options[].values` 원문 | 🟡 **대체로 그렇다. 단 판매처가 가족 목록을 넣으면 아니다**(rothys 232/250) | 실옵션일 때만 채움 | **44행**(진짜 옵션 42 + 자리표시자 2) |
| 2 | JSON-LD ProductGroup | `product-data-extractor.ts:192` | 축을 말한 `hasVariant` 원소들의 합집합 | 🔴 **아니다 — smallable 에서는 "형제 리스팅 가족"이고, 실제로는 1개만 살아남는다** | 남은 원소 수만큼 | **5행** |
| 3 | DOM `<select>` | `:439` | 드롭다운 선택지(한국어로 정규화된 축명 `사이즈`/`색상`) | 🟢 그렇다(값 2개 이상만 채택, :480) | **항상 비어 있다** | **0행** |
| 4 | 본문 텍스트 | `:494` | 나이 범위 나열 / **치수 스펙 cm** | 🔴 **아니다 — 스펙이다** | **항상 비어 있다** | **0행** |
| 5 | PrestaShop | `prestashop.site-strategy.ts:299-341` | `combinations` 합집합(품절 포함) | 🟢 그렇다 | combinations 있을 때만 | **0행** |

## 5-1. 🟢 경로를 사후에 구분할 단서가 **있다** — `variants[].id` 의 모양

지금까지 "어느 경로로 만들어졌는지 저장되지 않는다"(3.2-D §1-2, 3.2-E §2-e)고
적혀 있었는데, **id 문자열 모양이 경로를 그대로 드러낸다.** DB 전수 실측:

```
variants[0].id 가 /^variant-\d+$/     →  경로 2 (ProductGroup)   42행 중 0, 전체 5행
   (product-data-extractor.ts:266  id: `variant-${i}`)
variants[0].id 가 /^\d+$/ (Shopify variant id) → 경로 1 (Shopify)  42행
   (shopify-product-json.ts:424  id: String(v.id))
PrestaShop 은 combinations 의 키(숫자 문자열) → 경로 1 과 구분 불가  0행

보조 단서
   shopifyTags / shopifyProductType 가 채워져 있다      → 경로 1 (또는 Shopify 계열)
   축 이름이 `사이즈` / `색상` (한국어)                  → 경로 3 뿐
   축 이름이 임의 영문 라벨이고 값이 `\d+cm`             → 경로 4 뿐
   variants 가 비어 있는데 optionGroups 가 있다          → 경로 3·4, 또는 경로 1의 자리표시자
```

DB 47행(옵션+변형 보유) 전부가 이 규칙으로 분류됐다: **Shopify 42 · ProductGroup 5.**

> 🟢 이것은 3.2-E §7-3 이 "미확정"으로 남긴 질문의 답이기도 하다 —
> **bobochoses / junioredition 의 `Clothing size`·`Size` 는 `extractProductGroupOptions`
> 가 만든 것이 아니라 Shopify `products.json` 이 만든 것이다.** 그래서 정적 HTML 에
> `ProductGroup` 이 없어도 값이 채워졌다. 실측 확인:
> `bobochoses.com/en-int/products/b226ac114-....json` →
> `options=[{"name":"Clothing size","values":["2-3Y",...,"12-13Y"]}]`, variant id
> `57626186580351` = DB 에 저장된 값과 동일.
> 렌더 시점 주입 가설은 **틀렸다. Playwright 는 이 경로에 아예 관여하지 않는다**
> (`universal-extract.ts:158` fast path 가 먼저 확정한다).

---

# 6. 가짜 옵션값의 유입 경로

| 값 | 경로 | 근거 |
|---|---|---|
| **`Default Title`** | **경로 1 (Shopify products.json)** | 라이브 실측 — `www.junioredition.com/.../lemon-teether-by-konges-slojd.json` → `options=[{"name":"Title","values":["Default Title"]}]`, `variants[0].title="Default Title"`. 매장이 옵션을 안 쓰면 Shopify 가 항상 이 한 쌍을 만든다. 코드도 이미 알고 있다 — `shopify-product-json.ts:416-419` 가 `hasRealOptions` 로 **variants 만** 비우고 **optionGroups 는 그대로 저장한다.** |
| **`OS`** | **경로 1 (Shopify)** | 저장 모양으로 특정 — `www.theanimalsobservatory.com` 1행, `shopifyProductType` 채워짐, `variants=0`, 축 1개·값 1개. 🟡 **재확인 실패**: 오늘 그 핸들의 `.json` 이 404(상품 내림). 라이브로 다시 못 봤다는 사실을 그대로 적는다. |
| **치수 스펙 `cm`** | **경로 4 (본문 텍스트)** | `product-data-extractor.ts:521` `SPEC_LINE_PATTERN` 이 `"Dress length: 53cm/56cm"` 를 잡아 **본문 라벨을 그대로 축 이름으로** 만든다. 구매 옵션이 아니라 치수표다. **운영 DB 실적 0행** — 코드 경로로만 존재한다. |

```
세 값의 공통점 — 셋 다 `variants` 가 비어 있다.
  Default Title / OS  : shopify-product-json.ts:420  hasRealOptions=false → variants=[]
  치수 cm             : product-data-extractor.ts:627 경로 4는 variants 를 절대 안 채운다
⇒ 이것이 §8 조건 D2 의 근거다.
```

---

# 7. DB 표본화 — 세 부류

운영 DB `product_snapshots.workspace.canonicalProduct`, `source_url` dedup 67행.

| 부류 | 건수 | 내용 |
|---|---|---|
| **비색상 option 상품(진짜 옵션)** | **42** | Shopify `Size`(junioredition 28 · designerkidswear 1 · houseofkids 1) / `Clothing size`(bobochoses 12) — 값 2~13개, `variants` 가 값 수와 일치 |
| **가짜 옵션(=옵션 없음)** | **2** | `Title=["Default Title"]`(junioredition) · `Size=["OS"]`(theanimalsobservatory) — 둘 다 `variants=0` |
| **색상 축 보유** | **5** | smallable 전부. 전부 값 1개 · `variants=1` · id `variant-0` |
| 옵션 없음 | 18 | babyshop 2 · childrensalon 1 · smallable 15 |
| **합** | **67** | |

## 7-1. 색상 5건을 다시 나누면

```
"실제 단일색 리스팅"   5 / 5     ← 각 페이지가 파는 색은 실제로 1색이다
                                   (본체 원소의 color 와 sku 가 그 색 하나뿐)
"다색상 variant 상품"  0 / 5     ← 한 페이지에서 두 색을 파는 DB 행은 없다
"다색 가족에 속한 것"  3 / 5 확인 · 2 / 5 미확인
     430651 · 430663 · 409775  라이브 hasVariant=2 → 전부 2색 가족의 한 장
     426478 · 424671           오늘 JSON-LD 0개(품절) → 가족 크기 확인 불가
```

## 7-2. 🔴 **"다색상 variant 상품"을 운영 DB 에서는 못 찾았다**

없다고 쓰지 않는다. **DB 67행 안에는 0건**이고, **DB 밖에서는 139건을 찾았다**
(§4-3, brooklinen 122 + rothys 17). 두 문장은 모순이 아니다 — 오늘의 8 판매처가
그런 상품을 안 팔 뿐, 파이프라인이 그런 상품을 거부하지는 않는다.

---

# 8. 판별 조건 제안 — **구현하지 않았다**

Q-A("이 값들이 이 리스팅이 실제로 파는 색 집합인가")만 판별한다.
저장된 `CanonicalProduct` 만으로 계산된다. 판정기·문턱·점수·synonym 을 건드리지 않는다.

```
색상 축을 Matching 근거로 쓸 수 있는 조건 (전부 만족할 때만)

D1  optionGroups 에 /colou?r/i 로 걸리는 축이 정확히 1개 있다
D2  variants 가 비어 있지 않다
D3  그 축의 values 집합 == variants[].optionValues[축이름] 집합
       (같아야 한다. values 가 더 크면 "가족 목록"이므로 버린다)
D4  경로가 Shopify(= variants[].id 가 /^\d+$/)이면 D1–D3 로 충분
    경로가 ProductGroup(= variants[].id 가 /^variant-\d+$/)이면
      values.length === 1 이고 variants.length === 1 일 때만 쓴다
      (그 1값은 "이 리스팅의 대표색"으로만 쓰고 "이 상품의 색 집합"으로 쓰지 않는다)
```

## 8-1. 무엇을 근거로 판별하는가 · 몇 건에서 관측됐는가

| 조건 | 무엇을 막는가 | 관측 건수 |
|---|---|---|
| **D2** | 경로 3·4(DOM select·치수 cm)와 Shopify 자리표시자. 이 경로들은 **구조적으로** variants 를 안 채운다 | 코드 3곳(`:627`, `:420`, `:337`) + DB 자리표시자 **2/2 정확히 걸러짐** |
| **D3** | "선언은 12색, 실제 판매는 1색"인 가족 목록 | 외부 **642 상품** 중 **233건 차단** · **409건 통과** · 판정 불능 0건. DB **47행 전부 통과**(즉 오늘의 정상 데이터를 하나도 잃지 않는다) |
| **D4** | ProductGroup 경로의 부분 목록. 오늘 관측된 그 경로의 출력은 언제나 "1값/1변형"이고, 2값 이상이 나오면 그것은 §1-6 의 가족 합집합일 수 있으므로 쓰지 않는다 | smallable 라이브 **19/19 상품에서 값 1·변형 1** · DB **5/5 행에서 값 1·변형 1** |
| **D1** | 축이 2개 이상 색으로 걸리는 애매한 경우 | DB 에서 발생 0건(관측 없음 — 방어만) |

## 8-2. 🔴 이 조건이 **하지 못하는 것**

```
① Q-B 를 보증하지 않는다. ProductGroup 경로에서 몇 개가 버려졌는지는
   저장 데이터로 알 수 없고, D4 는 "모르니까 대표색으로만 쓴다"로 피해갈 뿐이다.
② "한 페이지에서 여러 색을 파는데 그중 일부 원소만 축을 가진" 상품에서
   D3 는 통과하면서 값이 부분 목록일 수 있다. 이 모양은 **관측 0건**이다
   (smallable 19상품에서 축을 가진 원소는 언제나 정확히 1개였다). 미관측 위험이다.
③ PrestaShop 경로는 variants[].id 가 숫자라 Shopify 와 구분되지 않는다.
   DB 실적 0행이라 이번 표본으로는 분리할 근거를 만들지 못했다.
④ 프랑스어 색상(`Bleu jean`·`Rouge cerise`)은 D1–D4 를 통과해도
   `resolveColorHueGroups` 가 못 읽어 여전히 "모름"이다(3.2-D §5-⑥ 그대로).
⑤ 조건을 통과하는 오늘의 DB 색상 축은 **5/67 행**이다. 커버리지는 하나도
   늘지 않는다. 이 조건은 정확도를 올리는 장치가 아니라 사고를 막는 장치다.
```

---

# 9. 확인하지 못한 것

1. **ProductGroup 경로의 손실을 저장 데이터로 탐지하는 방법.** 없다. 추출 시점에
   기록하지 않으면 사후 복원은 §3 의 재요청(상품당 최대 8회)뿐이다.
   기록하는 코드를 넣는 일은 이번 범위 밖이라 손대지 않았다.
2. **smallable 이 형제 원소에 `color` 를 채우기 시작하면 어떻게 되는가.**
   그 순간 `optionGroups` 는 9색 목록이 되고 `intersects()` 가 무력해진다
   (3.2-E GATE 2-d). 오늘은 34/34 원소가 url-only 라 발생하지 않는다.
   **사이트 마크업이 바뀌면 코드 변경 없이 의미가 뒤집힌다.**
3. **품절 페이지.** smallable 은 품절이면 JSON-LD 를 통째로 내리는 것으로 보인다
   (386KB, `ld+json` 0개 — 5건 관측). 이것이 재고 때문인지 다른 조건 때문인지
   가리지 않았다. DB 의 `426478`·`424671` 이 여기 해당한다.
4. **babyshop.com** 403(3.2-E 와 동일). **childrensalon** 은 상품 JSON-LD 자체가
   없어 옵션 경로를 판단할 수 없었다.
5. **`OS` 의 라이브 재확인.** 해당 핸들의 `.json` 이 오늘 404 다(§6).
6. **PrestaShop 경로의 실데이터.** DB 0행. 코드만 읽었다.
7. **rothys / brooklinen 을 실제 파이프라인에 태워보지 않았다.** `products.json`
   원문과 `shopify-product-json.ts:413` 코드로 추론한 것이고, 크롤러를 돌려
   `CanonicalProduct` 를 만들어 확인하지는 않았다(쓰기 금지 범위 때문).
8. **`compareColor` 재판정.** 이번 조사는 판정 시뮬레이션을 돌리지 않았다.
   다중값이 오답을 SAME 으로 뒤집는다는 사실은 3.2-E GATE 2-d 의 실측을
   그대로 인용했고, 새로 세지 않았다.
