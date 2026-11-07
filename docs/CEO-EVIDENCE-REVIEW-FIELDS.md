# CEO Evidence Review — 수집 필드 전수 목록 및 반영 여부

> 🔴 **운영 변경 0 · DB 쓰기 0 · 추가 크롤링 0 · 추가 번역 0.** 이 문서는 조사 산출이다.
> 화면 → `docs/ceo-evidence-review.html` · 생성기 → `ceo-evidence-review-build.test.ts`(네트워크 0).

## 0. 🔴 먼저 — **조사 대상은 11쌍이다**

지시서 §8-5 의 「6개 비교 쌍」을 **정정한다**. 기존 화면의 카드 수가 **11**(실측 · `<section class="card">` 개수)이고,
이번 화면도 **같은 11쌍**이다(분모를 바꾸면 기존 조서와 대조할 수 없다).

## 1. 원본 상품 — `product_snapshots.workspace.canonicalProduct` · 전수 **42칸** (분모 6 origin)

| 칸 | 값 보유 | 화면 반영 | 비고 |
|---|--:|:-:|---|
| `brand` | 5/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `brandResolution` | 5/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `careInstructions` | 3/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `categoryRecommendationCache` | 6/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `categoryResolverKpi` | 1/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `certification` | 0/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `certificationType` | 1/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `channelPriceOverrides` | 0/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `childCertification` | 1/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `color` | 5/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `countryOfOrigin` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `description` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `descriptionKo` | 1/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `images` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `importer` | 0/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `itemName` | 0/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `keywords` | 1/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `lotteOnChannelInfo` | 1/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `manufacturer` | 0/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `material` | 3/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `modelName` | 2/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `optionGroups` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `options` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `price` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `priceBreakdown` | 5/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `priceOverrideKrw` | 1/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `priceValidity` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `recommendedAge` | 1/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `regularPrice` | 1/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `returnPolicy` | 0/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `seoDescription` | 0/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `seoTitle` | 0/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `shippingFee` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `shopifyProductType` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `shopifyTags` | 6/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `sku` | 5/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `sourceUrl` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `stockQuantity` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `title` | 6/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `titleKo` | 1/6 | 🟢 비교표·가격 | ② 증거 비교 또는 ⑤ 가격 영역에 세웠다 |
| `variants` | 6/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |
| `weight` | 0/6 | 🟡 덤프만 | ⑥ 수집 전수 덤프에 **값·출처 그대로** 있다 |

🔴 **미반영 칸은 0** 이다 — 비교표에 세우지 않은 칸도 **⑥ 수집 전수 덤프**에 값과 `source` 가 같이 들어 있다.
🔴 칸 모양이 섞여 있다 — `{value,source,confidence}` 래퍼 **28칸** · 평평한 값 **14칸**(`images` `variants` `sourceUrl` `shopifyTags` `optionGroups` …). 래퍼를 **조건부로** 벗긴다.

## 2. 후보 상품 — `ProductFacts` · 전수 **17칸** (분모 11)

| 칸 | 값 보유 | 화면 반영 | 비고 |
|---|--:|:-:|---|
| `sourceUrl` | 11/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `urlSlug` | 11/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `brand` | 9/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `brandModelCode` | 3/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `sellerSku` | 0/11 | 🟢 반영 | 🔴 0/11 · matcher 가 읽지 않는다(보존용) |
| `title` | 11/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `coreTitleTokens` | 11/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `categoryText` | 7/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `colorText` | 7/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `materialText` | 8/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `fitText` | 3/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `ageRangeText` | 0/11 | 🟢 반영 | 🔴 0/11 |
| `sizeLabels` | 8/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `audienceSignals` | 9/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `imageUrls` | 9/11 | 🟢 반영 | ② 비교표 + ⑥ 덤프 |
| `description` | 0/11 | 🟢 반영 | 🔴 **0/11** — MI 가 상세설명을 보지 못했다는 직접 증거 |
| `evidence` | 0/11 | 🟢 반영 | 🔴 **0/11** — 축별 구조화 증거가 저장되지 않았다 |

## 3. 후보 — `candidate_reviews` · **19칸** (🔴 행 보유 **2/11**)

덤프 행 **3** → 정규화 URL 기준 고유 **2**. 🔴 `global.trenbe.com` 이 **2행** 이고 **하나만** verdict 를 갖는다 ⟹ 값이 있는 쪽을 **결정적으로** 고른다(1차 구현은 마지막 행이 **우연히** 이겼다).

| 칸 | 값 보유(분모 3행) | 화면 반영 |
|---|--:|:-:|
| `candidate_url` | 3/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `candidate_domain` | 3/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `origin_code` | 3/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `candidate_title` | 2/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `image_url` | 0/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `price_amount` | 2/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `price_currency` | 2/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `market` | 1/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `price_status` | 0/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `sold_out` | 0/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `system_verdict` | 1/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `match_truth` | 1/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `price_tier` | 2/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `blockers` | 0/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `human_verdict` | 2/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `human_note` | 0/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `source` | 3/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `first_seen_at` | 3/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |
| `last_seen_at` | 3/3 | 🟢 ④ MI · ⑤ 가격 · ⑥ 덤프 |

## 4. 11쌍 — 원본 ↔ 후보 URL 매핑 (§8-5)

| # | id | 원본 searchId | 원본 URL | 후보 판매처 | 후보 URL | 이전 CEO 판정 | fixture |
|--:|---|---|---|---|---|---|---|
| 1 | C27 | `S1` | https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses | beaumonde.co.kr | https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021 | SAME | `wu-059` |
| 2 | C50 | `S6` | https://bobochoses.co.jp/products/b226ac117-b-c-embossed-tracksuit-jacket | tinyapple.net | https://www.tinyapple.net/products/bobo-choses-bobo-choses-modern-tracksuit-jacket-multicolor | DIFFERENT | `wu-059` |
| 3 | C22 | `S4` | https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story?_pos=1&_sid=a0738e824&_ss=r | donokids.com | https://www.donokids.com/m/product.html?branduid=3362912 | DIFFERENT | `wu-059` |
| 4 | C05 | `S2` | https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses | tinyapple.net | https://www.tinyapple.net/products/bobo-choses-hug-hairy-monster-t-shirt-light-blue | SAME | `wu-059` |
| 5 | C06 | `S2` | https://www.junioredition.com/en-kr/collections/bobo-choses/products/hug-hairy-monster-t-shirt-by-bobo-choses | global.trenbe.com | https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p | DIFFERENT | `wu-059` |
| 6 | C19 | `S4` | https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story?_pos=1&_sid=a0738e824&_ss=r | junioredition.com | https://www.junioredition.com/products/bubble-sweatshirt-in-conker-stripe-by-main-story | DIFFERENT | `wu-059` |
| 7 | C20 | `S4` | https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story?_pos=1&_sid=a0738e824&_ss=r | junioredition.com | https://www.junioredition.com/products/bubble-sweatshirt-in-graystone-by-main-story | DIFFERENT | `wu-059` |
| 8 | C42 | `S4` | https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story?_pos=1&_sid=a0738e824&_ss=r | main-story.com | https://main-story.com/products/bubble-sweatshirt-grey-melange-1 | SAME | `wu-059` |
| 9 | C25 | `S4` | https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story?_pos=1&_sid=a0738e824&_ss=r | main-story.com | https://main-story.com/collections/shop/products/bubble-sweatshirt-graystone | DIFFERENT | `wu-059` |
| 10 | S1-5 | `S1` | https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses | www.junioredition.com | https://www.junioredition.com/en-kr/products/booty-ghosts-t-shirt-by-bobo-choses | DIFFERENT | `wu-068` |
| 11 | S1-6 | `S1` | https://www.junioredition.com/en-kr/collections/bobo-choses/products/booty-ghosts-long-sleeve-t-shirt-by-bobo-choses | www.tinyapple.net | https://www.tinyapple.net/products/bobo-choses-booty-ghosts-t-shirt | DIFFERENT | `wu-068` |

🔴 원본 `searchId` 는 **6개**(S1~S6)이고 후보가 11이다 — 같은 원본에 후보가 여럿 붙는다.

## 5. 🔴 지시서 §3 항목 중 **저장 칸 자체가 없는** 것

| 지시서 항목 | 상태 | 근거 |
|---|---|---|
| 상세설명 HTML · 구조화 콘텐츠 | 🔴 저장 칸 없음 | `ProductFacts` 에 html 칸이 없고 `canonicalProduct.description` 은 평문이다 |
| 상세설명 이미지 · 순서 | 🟡 원본만 부분 | `canonicalProduct.images[].useInDescription` 로 **원본은 구분 가능** · 🔴 후보측은 칸 없음 |
| 상세설명 수집 시점 · 수집 상태 | 🔴 저장 칸 없음 | 후보 수집 시점은 `candidate_reviews.first_seen_at/last_seen_at` 뿐이고 **설명문 단위 기록이 없다** |
| 상세설명에서 추출된 브랜드·코드·소재·색상 | 🔴 저장분 0 | 후보 `facts.evidence` **0/11** |
| 패턴 · 프린트 | 🔴 저장 칸 없음 | `ProductFacts`·`canonicalProduct` 양쪽에 그 칸이 없다 |
| 실루엣 | 🔴 저장 칸 없음 | `fitText` 가 가장 가깝고 그것은 «핏» 이다 |
| 상품 ID · 플랫폼 식별자 | 🟡 부분 | 후보는 `urlSlug`·`sellerSku`(0/11) · 원본은 `sku` |
| 성별 | 🔴 저장 칸 없음 | `audienceSignals` 원문 조각으로만 간접 관측된다 |
| 세일가 / 정상가 분리 | 🟡 원본만 | `canonicalProduct.regularPrice` 존재 · 🔴 후보측 칸 없음 |
| 가격 출처 URL | 🟡 대체 | 후보는 `candidate_url` 과 같다 ⟹ 별도 칸이 없다 |
| 파싱 상태 · 오류 정보 | 🔴 저장 칸 없음 | 후보 `price_status` 외에 파싱 오류 기록이 없다 |
| 상품 상태(신품/중고 등) | 🔴 저장 칸 없음 | 양쪽 모두 그 칸이 없다 |
| 디자이너 정보 | 🔴 저장 칸 없음 | `manufacturer`·`importer` 는 제조·수입이고 디자이너가 아니다 |

🔴 위 항목을 **임의로 만들거나 추정하지 않았다** — 화면에 `미수집` 또는
「저장 칸이 없습니다(확인 불가)」로 적었다(CPO §2 · §4).
