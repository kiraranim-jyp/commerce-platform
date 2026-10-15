/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-019A / 019A-EXT — **Identity Benchmark 의 단일 owner**(테스트가 아니다)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 WU-019A-EXT §2 — 「기존 14건을 그대로 쓰고 새 synthetic case 를 만들지 않는다」.
 *    그 요구는 **데이터가 한 벌일 때만** 지켜진다. 그래서 019A 테스트에서 이 블록을
 *    꺼내 019A 와 019A-EXT 가 **같은 배열** 을 읽게 한다(사본 금지).
 * 🔴 이 파일은 `__tests__` 안이지만 `*.test.ts` 가 아니므로 러너가 수집하지 않는다.
 * 🟢 값은 한 줄도 바꾸지 않았다 — 019A 에 있던 것을 그대로 옮기고 `export` 만 붙였다.
 */
/** 6유형. 🔴 측정용 어휘이고 제품 판정 어휘가 아니다. */
export type ProductType =
  | "EXACT_SAME"
  | "SAME_OTHER_MARKET"
  | "SAME_BRAND_DIFF_MODEL"
  | "SAME_MODEL_DIFF_COLOR"
  | "SIMILAR"
  | "DIFFERENT";

/** 🟢 GT 는 **두 값** 뿐이다 — 「이 후보를 동일상품으로 쓸 수 있는가」. */
export type Gt = "SAME" | "DIFFERENT";
export const GT_OF: Record<ProductType, Gt> = {
  EXACT_SAME: "SAME",
  SAME_OTHER_MARKET: "SAME",
  /* 🔴 색상만 달라도 동일상품이 아니다 — 판매/가격 축에서 다른 상품이다. */
  SAME_MODEL_DIFF_COLOR: "DIFFERENT",
  SAME_BRAND_DIFF_MODEL: "DIFFERENT",
  SIMILAR: "DIFFERENT",
  DIFFERENT: "DIFFERENT",
};

export type ThreeWay = "SAME" | "DIFFERENT" | "UNCERTAIN";

export interface BenchCase {
  caseId: string;
  productType: ProductType;
  /** 원상품 스냅샷 id 앞 8자리(읽기전용 덤프 키). */
  origin: string;
  candidateUrl: string;
  /** 🔴 GT 근거 — 추측 금지. 아래 `gtToken` 으로 **관측된 제목과 대조** 한다. */
  gtReason: string;
  /**
   * 🟢 **GT 독립 검증 장치**(WU-018 에 없던 것) — 실제로 가져온 후보 제목에
   *    이 토큰이 «있어야/없어야» 한다. GT 가 페이지와 어긋나면 측정 전에 깨진다.
   */
  gtToken?: { mustInclude?: string[]; mustExclude?: string[] };
}

const BOBO = "https://bobochoses.com/products";
/**
 * 🟢 쌍 **14건 전부 운영 DB 실데이터** 다(덤프 `mi-017-e2e-urlset.json` / `-cases.json`).
 * 🔴 WU-018 의 GT 를 **그대로 베끼지 않았다** — 유형을 다시 적고 `gtToken` 으로
 *    **실제 페이지 제목과 대조하는 검증 장치를 추가** 했다(지시서 §1).
 */
export const CASES: BenchCase[] = [
  { caseId: "B01", productType: "EXACT_SAME", origin: "c0725ecc", candidateUrl: `${BOBO}/b226ac010-booty-ghosts-t-shirt`,
    gtReason: "원상품 sku B226AC010 · 후보 handle 에 b226ac010 · 제목 Booty Ghosts 동일",
    gtToken: { mustInclude: ["booty", "ghosts"] } },
  { caseId: "B02", productType: "SIMILAR", origin: "c0725ecc", candidateUrl: `${BOBO}/b226ac009-hug-hairy-monster-t-shirt`,
    gtReason: "같은 브랜드·같은 상품군(T-shirt)·다른 품번 B226AC009",
    gtToken: { mustInclude: ["hug"], mustExclude: ["booty"] } },
  { caseId: "B03", productType: "SAME_BRAND_DIFF_MODEL", origin: "c0725ecc", candidateUrl: `${BOBO}/b226ac070-stamp-bloom-all-over-denim-pants`,
    gtReason: "같은 브랜드 · 품번 B226AC070 · 상품군 denim pants(원상품은 긴팔 티셔츠)",
    gtToken: { mustInclude: ["denim"], mustExclude: ["booty"] } },
  { caseId: "B04", productType: "DIFFERENT", origin: "c0725ecc", candidateUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10278273",
    gtReason: "제목 「[마이마이]532 캐너피슈즈」 — 브랜드·상품군 모두 다르다",
    gtToken: { mustExclude: ["bobo", "booty"] } },

  { caseId: "B05", productType: "EXACT_SAME", origin: "cd93efd9", candidateUrl: `${BOBO}/b226ac009-hug-hairy-monster-t-shirt`,
    gtReason: "원상품 sku B226AC009 · 후보 handle 에 b226ac009",
    gtToken: { mustInclude: ["hug", "monster"] } },
  { caseId: "B06", productType: "SIMILAR", origin: "cd93efd9", candidateUrl: `${BOBO}/b226ac010-booty-ghosts-t-shirt`,
    gtReason: "B02 의 반대 방향 — 방향 대칭성 확인용",
    gtToken: { mustInclude: ["booty"], mustExclude: ["monster"] } },

  { caseId: "B07", productType: "EXACT_SAME", origin: "c5395889", candidateUrl: `${BOBO}/b126ai018-curious-turnip-all-over-swim-cap`,
    gtReason: "원상품 sku B126AI018 · 후보 handle 에 b126ai018 (🔴 WU-018 실측에서 이 URL 은 404 였다)" },
  { caseId: "B08", productType: "SAME_BRAND_DIFF_MODEL", origin: "c5395889", candidateUrl: `${BOBO}/b226ac010-booty-ghosts-t-shirt`,
    gtReason: "같은 브랜드 · 상품군이 다르다(수영모 ↔ 티셔츠)",
    gtToken: { mustInclude: ["booty"], mustExclude: ["swim"] } },

  { caseId: "B09", productType: "EXACT_SAME", origin: "c27d4727",
    candidateUrl: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/2",
    gtReason: "국내 샵 제목에 품번 AW26MS185 + 색상 Grey Melange 가 그대로 있다",
    gtToken: { mustInclude: ["aw26ms185", "grey"] } },
  /** 🔴🔴 **P10 — 필수 regression case**(지시서 §9). */
  { caseId: "B10", productType: "SAME_MODEL_DIFF_COLOR", origin: "c27d4727",
    candidateUrl: "https://www.deuxbebe.com/product/detail.html?product_no=18285&cate_no=293&display_group=1",
    gtReason: "🔴 제목 「AW26MS185 - Bubble Sweatshirt - Rose Shadow」 — 같은 품번, 색상이 다르다(원상품 Grey Melange)",
    gtToken: { mustInclude: ["aw26ms185", "rose"], mustExclude: ["grey melange"] } },

  { caseId: "B11", productType: "EXACT_SAME", origin: "32f7b651", candidateUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592",
    gtReason: "제목 「VERNICE NERO T-스트랩 슈즈-PP24KASHE1195NER」 — 색상·모델(1195) 일치",
    gtToken: { mustInclude: ["vernice", "nero"] } },
  { caseId: "B12", productType: "EXACT_SAME", origin: "32f7b651",
    candidateUrl: "https://www.deuxbebe.com/product/detail.html?product_no=8021&cate_no=62&display_group=1",
    gtReason: "제목 「페페 VERNICE NERO」 — 브랜드·색상 일치",
    gtToken: { mustInclude: ["vernice", "nero"] } },
  { caseId: "B13", productType: "SAME_MODEL_DIFF_COLOR", origin: "32f7b651",
    candidateUrl: "https://www.junioredition.com/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe",
    gtReason: "운영 DB sku 01195-NEVADA-TOBACCO — 같은 모델 01195, 색상이 다르다",
    gtToken: { mustInclude: ["tobacco"], mustExclude: ["vernice"] } },

  { caseId: "B14", productType: "SAME_OTHER_MARKET", origin: "278d4c38", candidateUrl: `${BOBO}/b226ac117-b-c-embossed-tracksuit-jacket`,
    gtReason: "같은 품번 b226ac117 의 .com(Global) 스토어 — 원상품은 .co.jp",
    gtToken: { mustInclude: ["embossed", "tracksuit"] } },
];

/**
 * 🔴 AI 원문 verdict 를 **세 값으로만** 정규화한다. 🔴 설명·confidence·가격은 읽지 않는다.
 * 🟢 순수 함수라 AI 데이터 없이도 테스트된다(아래 ③).
 */
export function normalizeAiVerdict(raw: string | null | undefined): ThreeWay | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === "SAME" || v === "DIFFERENT" || v === "UNCERTAIN") return v;
  return null;
}

/**
 * 🔴 MI verdict → 세 값. **두 가지 정규화를 같이 낸다**(하나만 쓰면 결과가 숨는다):
 * ```
 * strict      SAME · PRESUMED_SAME → SAME        ← WU-018 이 쓴 기준(False SAME 엄격)
 * threeWay    PRESUMED_SAME → UNCERTAIN          ← AI 와 같은 3값 비교용
 * ```
 * 🔴 **판정 정책을 바꾸는 것이 아니다** — 집계 라벨이다.
 */
export function normalizeMi(verdict: string | null): { strict: ThreeWay; threeWay: ThreeWay } {
  if (verdict === "SAME") return { strict: "SAME", threeWay: "SAME" };
  if (verdict === "PRESUMED_SAME") return { strict: "SAME", threeWay: "UNCERTAIN" };
  if (verdict === "UNKNOWN" || verdict === null) return { strict: "UNCERTAIN", threeWay: "UNCERTAIN" };
  return { strict: "DIFFERENT", threeWay: "DIFFERENT" };
}
