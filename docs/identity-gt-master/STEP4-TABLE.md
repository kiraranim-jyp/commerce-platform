# Step 4 — 후보 70 전수표 (CPO §6)

> 🔴 **측정만** 했다 — 정책·threshold·blocker·GT **변경 0**.
> 🔴 `A/B/C/D` 는 **17 필드 전체** 기준이고 「핵심 blocker」는 운영 산출 그대로다.
> 🔴 `FN/FP` 는 **도달한 후보에만** 붙는다 — 미도달은 `미도달`(공급 축)이다.

| 상품 | 후보(샵) | CEO GT | 추출 | A | B | C | D | 현재 Identity | 핵심 blocker | FN/FP |
|---|---|---|---|---:|---:|---:|---:|---|---|---|
| PRODUCT-01 | billsstore.com.au | DIFFERENT | OK | 10 | 2 | 5 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-02 | biskuit.kr | SAME | OK | 5 | 3 | 9 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | BRAND_MISMATCH, NO_TITLE_OVERLAP | 🔴 FN |
| PRODUCT-02 | bobochoses.com | SAME | OK | 12 | 3 | 2 | 0 | CONFLICT / PRESUMED_SAME / tier EXCLUDED | MODEL_CODE_AGE_LINE, FIT | 🔴 FN |
| PRODUCT-02 | bornyesterdaykids.com | GT_CONFLICT | OK | 8 | 1 | 8 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-02 | cemarose.ca | SAME | OK | 10 | 2 | 5 | 0 | CONFLICT / CONFLICT / tier EXCLUDED | ⚠MODEL_CODE | 🔴 FN |
| PRODUCT-02 | cemarose.ca | DIFFERENT | OK | 10 | 2 | 5 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-02 | cissywears.com | SAME | OK | 8 | 2 | 7 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | — | 🔴 FN |
| PRODUCT-02 | donokids.com | SAME | OK | 6 | 3 | 8 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | BRAND_UNCONFIRMED | 🔴 FN |
| PRODUCT-02 | global.trenbe.com | GT_CONFLICT_CROSS_ORIGIN | OK | 9 | 2 | 6 | 0 | EXACT_IDENTIFIER / SAME / tier EXACT | — | (분모 밖) |
| PRODUCT-02 | junioredition.com | SAME | OK | 12 | 4 | 1 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | MODEL_CODE_AGE_LINE, FIT, SAME_SELLER_DISTINCT_LISTING | 🔴 FN |
| PRODUCT-02 | junioredition.com | SAME | OK | 12 | 4 | 1 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-02 | kids21.com | SAME | OK | 9 | 5 | 3 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-02 | kolkid.ca | SAME | OK | 11 | 3 | 3 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | FIT | 🔴 FN |
| PRODUCT-02 | m.luxboy.com | GT_CONFLICT | OK | 5 | 7 | 5 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | NO_TITLE_OVERLAP | (분모 밖) |
| PRODUCT-02 | miniboutique.co.kr | REVIEW | UNREACHABLE | 0 | 0 | 0 | 17 | 🔴 미도달 | — | 미도달 |
| PRODUCT-02 | parkette.ca | DIFFERENT | OK | 10 | 3 | 4 | 0 | CONFLICT / CONFLICT / tier EXCLUDED | ⚠COLOR | 🟢 TN |
| PRODUCT-02 | scoutandcokids.com | SAME | OK | 9 | 1 | 7 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-02 | stockmann.ee | SAME | OK | 5 | 5 | 7 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-02 | thefrontshop.com | SAME | OK | 9 | 4 | 4 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-02 | tinyapple.net | SAME | OK | 11 | 3 | 3 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-02 | tinyapple.net | SAME | OK | 11 | 3 | 3 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-02 | tinyapple.net | DIFFERENT | OK | 11 | 3 | 3 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | beaumonde.co.kr | REVIEW | OK | 1 | 6 | 10 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | beaumonde.co.kr | SAME | OK | 3 | 5 | 9 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-03 | billsstore.com.au | SAME | OK | 9 | 2 | 6 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-03 | bobochoses.com | SAME | OK | 12 | 3 | 2 | 0 | CONFLICT / CONFLICT / tier EXCLUDED | ⚠MODEL_CODE | 🔴 FN |
| PRODUCT-03 | cissywears.com | SAME | OK | 8 | 2 | 7 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | cissywears.com | SAME | OK | 8 | 2 | 7 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | cissywears.com | SAME | OK | 8 | 2 | 7 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-03 | eraldo.com | SAME | REDIRECTED_AWAY | 0 | 6 | 11 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | eraldo.com | SAME | REDIRECTED_AWAY | 0 | 6 | 11 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | junioredition.com | DIFFERENT | OK | 12 | 4 | 1 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | junioredition.com | DIFFERENT | OK | 12 | 4 | 1 | 0 | CONFLICT / CONFLICT / tier EXCLUDED | ⚠COLOR, ⚠MODEL_CODE | 🟢 TN |
| PRODUCT-03 | junioredition.com | SAME | OK | 12 | 4 | 1 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | kolkid.ca | SAME | OK | 11 | 3 | 3 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | FIT | 🔴 FN |
| PRODUCT-03 | kream.co.kr | REVIEW | OK | 6 | 4 | 7 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | luksusbaby.kr | GT_CONFLICT | OK | 11 | 3 | 3 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | luksusbaby.kr | REVIEW | OK | 10 | 3 | 4 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | rboutique.com | SAME | OK | 7 | 5 | 5 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | rboutique.com | SAME | OK | 7 | 5 | 5 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | — | 🔴 FN |
| PRODUCT-03 | scoutandcokids.com | SAME | OK | 9 | 1 | 7 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-03 | tinyapple.net | DIFFERENT | OK | 10 | 3 | 4 | 0 | CONFLICT / CONFLICT / tier EXCLUDED | ⚠MODEL_CODE | 🟢 TN |
| PRODUCT-03 | tinyapple.net | SAME | OK | 11 | 3 | 3 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-03 | tinyapple.net | DIFFERENT | OK | 10 | 3 | 4 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | tinyapple.net | DIFFERENT | OK | 10 | 3 | 4 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-03 | tinyapple.net | DIFFERENT | UNREACHABLE | 0 | 0 | 0 | 17 | 🔴 미도달 | — | 미도달 |
| PRODUCT-04 | bobochoses.co.jp | SAME | OK | 10 | 4 | 3 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-04 | bobochoses.co.jp | SAME | OK | 10 | 4 | 3 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | BRAND_UNCONFIRMED | 🔴 FN |
| PRODUCT-04 | kids21.com | REVIEW | REDIRECTED_AWAY | 0 | 7 | 10 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-04 | stadtlandkind.ch | SAME | UNREACHABLE | 0 | 0 | 0 | 17 | 🔴 미도달 | — | 미도달 |
| PRODUCT-05 | donokids.com | DIFFERENT | OK | 6 | 3 | 8 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | BRAND_UNCONFIRMED | 🟢 TN |
| PRODUCT-05 | junioredition.com | DIFFERENT | OK | 12 | 4 | 1 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | SAME_SELLER_DISTINCT_LISTING | 🟢 TN |
| PRODUCT-05 | junioredition.com | DIFFERENT | OK | 12 | 4 | 1 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-05 | main-story.com | SAME | OK | 9 | 4 | 4 | 0 | STRONG_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-05 | main-story.com | DIFFERENT | OK | 9 | 4 | 4 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-05 | main-story.com | REVIEW | REDIRECTED_AWAY | 0 | 5 | 12 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-06 | thefrontshop.com | REVIEW | REDIRECTED_AWAY | 0 | 5 | 12 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-07 | bobochoses.com | SAME | OK | 12 | 3 | 2 | 0 | EXACT_IDENTIFIER / SAME / tier EXACT | — | 🟢 TP |
| PRODUCT-07 | global.trenbe.com | REVIEW | UNREACHABLE | 0 | 0 | 0 | 17 | 🔴 미도달 | — | 미도달 |
| PRODUCT-07 | global.trenbe.com | REVIEW | UNREACHABLE | 0 | 0 | 0 | 17 | 🔴 미도달 | — | 미도달 |
| PRODUCT-07 | kids21.com | REVIEW | REDIRECTED_AWAY | 0 | 7 | 10 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-07 | kihanan.com | SAME | OK | 8 | 2 | 7 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | BRAND_UNCONFIRMED | 🔴 FN |
| PRODUCT-07 | ladida.com | DIFFERENT | OK | 7 | 2 | 8 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | BRAND_UNCONFIRMED | 🟢 TN |
| PRODUCT-07 | tinyapple.net | DIFFERENT | UNREACHABLE | 0 | 0 | 0 | 17 | 🔴 미도달 | — | 미도달 |
| PRODUCT-07 | wconcept.co.kr | DIFFERENT | OK | 1 | 5 | 11 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-08 | bobochoses.com | DIFFERENT | OK | 12 | 3 | 2 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | AUDIENCE_LINE | 🟢 TN |
| PRODUCT-08 | bobochoses.com | DIFFERENT | OK | 12 | 3 | 2 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-08 | junioredition.com | DIFFERENT | OK | 12 | 4 | 1 | 0 | 🔴 미도달 | — | 미도달 |
| PRODUCT-08 | junioredition.com | DIFFERENT | OK | 12 | 5 | 0 | 0 | TEXT_CONFIRMED / PRESUMED_SAME / tier COMPARISON | AUDIENCE_LINE | 🟢 TN |
| PRODUCT-08 | junioredition.com | DIFFERENT | OK | 12 | 5 | 0 | 0 | 🔴 미도달 | — | 미도달 |
