import type { AgeGroup } from "./product-resolver";

/**
 * Sprint A-2.6(Resolver Accuracy Validation) — CPO 작업지시: "Category Resolver
 * 2.0이 실제 운영 데이터에서 얼마나 정확한지 수치로 입증한다." 8개 카테고리 ×
 * 10개, 총 80개의 실제 상품 URL과 정답(Expected)을 미리 지정해둔다.
 *
 * 모든 URL은 Shopify 스토어에서 골랐다 — 이유는 두 가지다.
 * 1) universalExtract()의 Shopify fast-path(tryFastPath)는 Playwright를 켜지 않고
 *    공개 JSON 엔드포인트만 쓰기 때문에, 80개를 한 번에 돌려도 서버리스 함수
 *    타임아웃 위험 없이 몇 초 안에 끝난다.
 * 2) 이번 스프린트 이전 라운드에서 Veja/Eastpak 같은 비-Shopify 사이트가
 *    Cloudflare로 직접 curl 요청 자체를 막아 재현이 불가능했다 — Shopify
 *    스토어는 이런 봇 차단 없이 안정적으로 재현 가능하다는 게 실측으로 확인됐다.
 *
 * 각 항목의 URL은 이 파일 작성 시점에 실제 200 응답(products/{handle}.json)을
 * 확인했다 — 지어낸 URL이 아니다. expectedAgeGroup/expectedProductType은 해당
 * 상품 페이지의 실제 태그/product_type/브랜드 성격(예: goorin.com은 모자
 * 전문 브랜드, plantoys.com/melissaanddoug.com은 완구 전문 브랜드)에서 판단한
 * 사람의 정답이다.
 */

export type GoldenBucket =
  | "kids"
  | "adult"
  | "shoes"
  | "bag"
  | "hat"
  | "toy"
  | "home"
  | "beauty";

export interface GoldenDatasetItem {
  url: string;
  bucket: GoldenBucket;
  /** 사람이 읽는 정답 레이블 — 리포트/실패 로그에 그대로 노출한다. */
  expectedLabel: string;
  /** kids/adult 버킷의 정답 판정 기준. "kids 계열"(baby/kids/teen) vs "adult"(adult
   * 또는 unknown — predict API 기본값이 성인 쪽이라 unknown도 사실상 안전).
   * shoes/bag/hat/toy/home/beauty 버킷에서는 연령 신호가 무관하므로 비워둔다. */
  expectedAgeGroup?: Extract<AgeGroup, "kids" | "adult">;
  /** shoes/bag/hat/toy/home/beauty 버킷의 정답 판정 기준 — product-resolver.ts의
   * PRODUCT_TYPE_KEYWORDS type 값과 정확히 같은 문자열이어야 한다. */
  expectedProductType?: string;
  /** 정답 근거 — 실패 분석 시 "왜 이게 정답인지" 사람이 다시 확인할 수 있게. */
  note: string;
}

export const GOLDEN_DATASET: GoldenDatasetItem[] = [
  // ── Kids Apparel × 10 ──────────────────────────────────────────────
  {
    url: "https://bobochoses.com/products/b226ac035-beast-sweatshirt",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "Shopify tags: children,Kid",
  },
  {
    url: "https://bobochoses.com/products/b226ac001-taxi-saurus-t-shirt",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "Shopify tags: children,Kid",
  },
  {
    url: "https://bobochoses.com/products/b226ac002-boo-bo-choses-t-shirt",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "Shopify tags: children,Kid",
  },
  {
    url: "https://bobochoses.com/products/b226ac004-all-about-monsters-t-shirt",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "Shopify tags: children,Kid",
  },
  {
    url: "https://bobochoses.com/products/b226ac003-softpaw-monster-t-shirt",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "Shopify tags: children,Kid",
  },
  {
    url: "https://bobochoses.com/products/b226ac005-everyday-ghosts-t-shirt",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "Shopify tags: children,Kid",
  },
  {
    url: "https://bobochoses.com/products/b226ac006-long-puff-t-shirt",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "Shopify tags: children,Kid",
  },
  {
    url: "https://bobochoses.com/products/b226ac007-bigtooth-lemon-t-shirt",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "Shopify tags: children,Kid",
  },
  {
    url: "https://brixton.com/products/serpent-baby-t-shirt-chalk-pink-black",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "product_type은 'BRX/Women/...'로 오분류돼 있지만 tags에 'Baby'가 명시됨 — brand/product_type 신호 충돌 사례",
  },
  {
    url: "https://brixton.com/products/sunny-days-baby-t-shirt-black-white",
    bucket: "kids",
    expectedLabel: "Kids Apparel",
    expectedAgeGroup: "kids",
    note: "product_type은 'BRX/Women/...'로 오분류돼 있지만 tags에 'Baby'가 명시됨 — brand/product_type 신호 충돌 사례",
  },

  // ── Adult Apparel × 10 ─────────────────────────────────────────────
  {
    url: "https://everlane.com/products/womens-lightweight-loose-wide-leg-jean-long-black",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "tags: female, category: denim",
  },
  {
    url: "https://everlane.com/products/womens-knit-form-tube-dress-coffee-bean",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "tags: female, category: dresses",
  },
  {
    url: "https://everlane.com/products/mens-japanese-selvedge-jean-indigo-rinse",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "tags: male, category: denim",
  },
  {
    url: "https://everlane.com/products/mens-lightweight-denim-easy-short-medium-indigo",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "tags: male, category: bottoms",
  },
  {
    url: "https://girlfriend.com/products/black-meredith-bow-tank",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "women's activewear, boldmetrics:womens_tops_alpha",
  },
  {
    url: "https://girlfriend.com/products/black-amelia-v-neck-bodysuit",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "women's activewear, boldmetrics:womens_tops_alpha",
  },
  {
    url: "https://girlfriend.com/products/black-katie-crew-bodysuit",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "women's activewear, boldmetrics:womens_tops_alpha",
  },
  {
    url: "https://brixton.com/products/shift-short-sleeve-t-shirt-navy",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "product_type: BRX/Men/Clothing — tags에 Baby 없음(성인 대조군)",
  },
  {
    url: "https://brixton.com/products/salem-short-sleeve-t-shirt-black",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "product_type: BRX/Men/Clothing — tags에 Baby 없음(성인 대조군)",
  },
  {
    url: "https://brixton.com/products/rudder-short-sleeve-t-shirt-black",
    bucket: "adult",
    expectedLabel: "Adult Apparel",
    expectedAgeGroup: "adult",
    note: "product_type: BRX/Men/Clothing — tags에 Baby 없음(성인 대조군)",
  },

  // ── Shoes × 10 ─────────────────────────────────────────────────────
  {
    url: "https://allbirds.com/products/mens-cruiser-shadow-blue-natural-white-sole",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Shoes",
  },
  {
    url: "https://allbirds.com/products/womens-cruiser-slip-on-canvas-sea-spray-natural-white-sole",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Shoes",
  },
  {
    url: "https://allbirds.com/products/mens-cruiser-terralux-anthracite",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Shoes, tags: allbirds::gender => mens",
  },
  {
    url: "https://allbirds.com/products/womens-wool-runner-nz-mid-waterproof",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Shoes, tags: allbirds::gender => womens",
  },
  {
    url: "https://allbirds.com/products/womens-wool-runner-up-mizzles-hazy-indigo",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Shoes, tags: allbirds::gender => womens",
  },
  {
    url: "https://koio.co/products/capri-triple-white-womens",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Women's Footwear",
  },
  {
    url: "https://koio.co/products/monza-suede-sneaker-in-meadow",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Men's Footwear",
  },
  {
    url: "https://koio.co/products/parma-leather-sneaker-in-bone",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Men's Footwear",
  },
  {
    url: "https://koio.co/products/catania-suede-loafer-in-cognac",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Men's Footwear, Filter:Silhouette:Slip-ons — 'sneaker' 키워드 없이 loafer만으로 매칭돼야 하는 사례",
  },
  {
    url: "https://koio.co/products/firenze-suede-runner-in-grey",
    bucket: "shoes",
    expectedLabel: "Shoes",
    expectedProductType: "신발",
    note: "product_type: Men's Footwear",
  },

  // ── Bag × 10 ───────────────────────────────────────────────────────
  {
    url: "https://cuyana.com/products/flower-system-flap-bag",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "product_type: Small Leather Goods, 제목에 'bag'",
  },
  {
    url: "https://cuyana.com/products/mini-system-tote-croco",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "product_type: Bags",
  },
  {
    url: "https://cuyana.com/products/mini-barela-bag",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "product_type: Bags",
  },
  {
    url: "https://herschel.com/products/minecraft-herschel-classic-xl-backpack-1",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "product_type: Bags, tags: ADULT,BACKPACKS — Eastpak 유사 사례(성인 백팩)",
  },
  {
    url: "https://herschel.com/products/minecraft-herschel-classic-backpack-1",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "product_type: Bags, tags: ADULT,BACKPACKS",
  },
  {
    url: "https://herschel.com/products/minecraft-cube-backpack",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "product_type: Bags, tags: ADULT,BACKPACKS",
  },
  {
    url: "https://dagnedover.com/products/landon-carryall-small-storm-reset",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "product 제목: 'Landon Carryall' — carryall 키워드 매칭 필요",
  },
  {
    url: "https://dagnedover.com/products/petra-convertible-tote-ash-grey",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "제목에 'tote'",
  },
  {
    url: "https://dagnedover.com/products/dakota-stadium-backpack-clear",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "제목에 'backpack'",
  },
  {
    url: "https://sherpani.com/products/lima-crossbody-purse",
    bucket: "bag",
    expectedLabel: "Bag",
    expectedProductType: "가방",
    note: "product_type: Anti-theft Crossbody, tags: Crossbody",
  },

  // ── Hat × 10 ───────────────────────────────────────────────────────
  {
    url: "https://goorin.com/products/the-lucky-duck-beanie",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    note: "goorin.com은 모자 전문 브랜드, product_type: Knit(비니)",
  },
  {
    url: "https://goorin.com/products/the-beware-dog-beanie",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    note: "product_type: Knit(비니)",
  },
  {
    url: "https://goorin.com/products/bulletproof-trucker-1",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    note: "product_type: OG Trucker — 'trucker' 키워드 매칭 필요",
  },
  {
    url: "https://goorin.com/products/suede-scorpion",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    note: "product_type: OG Trucker",
  },
  {
    url: "https://goorin.com/products/las-vegas",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    note: "product_type: OG Trucker, tags: Baseball,Flat Brim",
  },
  {
    url: "https://goorin.com/products/smear-campaign",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    note: "product_type: OG Trucker",
  },
  {
    url: "https://goorin.com/products/clean-denim-papa",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    note: "product_type: Papa Cap — 'cap' 키워드 매칭 필요",
  },
  {
    url: "https://goorin.com/products/goorin-script",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    note: "product_type: Baseball(cap)",
  },
  {
    url: "https://herschel.com/products/minecraft-sylas-kids-cap",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    expectedAgeGroup: "kids",
    note: "제목에 'kids cap' — 모자+연령 신호 동시 검증(tags: CAPS)",
  },
  {
    url: "https://herschel.com/products/minecraft-elmer-kids-beanie",
    bucket: "hat",
    expectedLabel: "Hat",
    expectedProductType: "모자",
    expectedAgeGroup: "kids",
    note: "제목에 'kids beanie' — 모자+연령 신호 동시 검증(tags: BEANIES)",
  },

  // ── Toy × 10 ───────────────────────────────────────────────────────
  {
    url: "https://plantoys.com/products/farmers-market-mix-basket",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "plantoys.com은 완구 전문 브랜드, tags: 3Yrs+",
  },
  {
    url: "https://plantoys.com/products/rainbow-fiesta-basket",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "tags: 3Yrs+",
  },
  {
    url: "https://plantoys.com/products/rainbow-veggie-basket",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "tags: 3Yrs+",
  },
  {
    url: "https://plantoys.com/products/winter-harvest-basket",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "tags: 3Yrs+",
  },
  {
    url: "https://plantoys.com/products/weightlifting-acrobat-1",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "tags: 3Yrs+",
  },
  {
    url: "https://melissaanddoug.com/products/ocean-waves-bounce-back-links-trio",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "product_type: Baby Toys",
  },
  {
    url: "https://melissaanddoug.com/products/farmers-market-3-in-1-activity-center",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "product_type: Baby Toys",
  },
  {
    url: "https://melissaanddoug.com/products/ocean-waves-press-and-stack-seahorse",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "product_type: Baby Toys",
  },
  {
    url: "https://melissaanddoug.com/products/wooden-fairy-tale-play-set",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "product_type: Play Sets — 'toy'/'toys' 단어가 제목에 없는 사례(playset 키워드 필요)",
  },
  {
    url: "https://melissaanddoug.com/products/wooden-dinosaurs-play-set",
    bucket: "toy",
    expectedLabel: "Toy",
    expectedProductType: "완구",
    note: "product_type: Play Sets",
  },

  // ── Home × 10 ──────────────────────────────────────────────────────
  {
    url: "https://parachutehome.com/products/organic-oasis-shower-curtain-natural-and-tobacco",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Shower Curtains",
  },
  {
    url: "https://parachutehome.com/products/organic-cloud-cotton-euro-sham-evergreen",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Euro Shams",
  },
  {
    url: "https://parachutehome.com/products/organic-cloud-cotton-sham-set-evergreen",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Sham Sets",
  },
  {
    url: "https://parachutehome.com/products/organic-cloud-cotton-quilt-evergreen",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Quilts & Blankets",
  },
  {
    url: "https://parachutehome.com/products/linen-box-quilted-sham-set-onyx",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Sham Sets",
  },
  {
    url: "https://parachutehome.com/products/linen-box-quilted-euro-sham-onyx",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Euro Shams",
  },
  {
    url: "https://parachutehome.com/products/linen-box-quilt-onyx",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Quilts & Blankets",
  },
  {
    url: "https://brooklinen.com/products/dreamweave-waffle-robe-last-call",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Robes",
  },
  {
    url: "https://brooklinen.com/products/luxe-pillowcases-last-call",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Pillowcases",
  },
  {
    url: "https://brooklinen.com/products/alpaca-gradient-throw-blanket-last-call",
    bucket: "home",
    expectedLabel: "Home",
    expectedProductType: "홈/리빙",
    note: "product_type: Blankets",
  },

  // ── Beauty × 10 ────────────────────────────────────────────────────
  {
    url: "https://glossier.com/products/the-glossier-icons",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: Makeup",
  },
  {
    url: "https://glossier.com/products/balm-dotcom-trio",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: Balms",
  },
  {
    url: "https://glossier.com/products/balm-dotcom-quintet",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: Skincare",
  },
  {
    url: "https://glossier.com/products/the-skincare-icons",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: Makeup, tags: Sub-Category: Skincare",
  },
  {
    url: "https://kosas.com/products/air-brow-clear",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: brow gel clear",
  },
  {
    url: "https://kosas.com/products/air-brow-tinted",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: brow gel tinted",
  },
  {
    url: "https://kosas.com/products/brow-pop",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: brow pencil",
  },
  {
    url: "https://kosas.com/products/brow-pop-nano",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: brow pencil",
  },
  {
    url: "https://kosas.com/products/chemistry-deodorant",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: deodorant",
  },
  {
    url: "https://kosas.com/products/blush-is-life",
    bucket: "beauty",
    expectedLabel: "Beauty",
    expectedProductType: "뷰티",
    note: "product_type: blush",
  },
];
