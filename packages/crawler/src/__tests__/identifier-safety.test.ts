import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductFacts } from "@commerce/shared";
import { describe, expect, it, vi } from "vitest";

/**
 * MATCHING-3.1 IDENTIFIER SAFETY(CEO 지시, 2026-09-14) — "품번 하나만 맞는다고
 * 동일상품으로 확정하는 문제를 제거하되, 기존의 정확한 동일상품 판정은 보존한다."
 *
 * ── 무엇이 잘못돼 있었나(라이브 실측, 2026-09-14) ───────────────────────────
 * `compareCrossSellerProducts`에는 `if (identifierConfirmed) return "SAME"`이
 * 있었다. 보류도, 브랜드 확인도, 축 개수도 보지 않는 면제권이었다. 그 전제는
 * "브랜드 품번이 같으면 같은 상품"인데, junioredition.com 은 **서로 다른 두
 * 상품에 글자 하나까지 같은 Product Code를 적는다**:
 *
 *   Minnie Newborn Body / Minnie Newborn Onesie            둘 다 KS106168-P05261
 *   Bubble Sweatshirt Grey Melange / Graystone             둘 다 AW26MS185
 *   Giulia Flower Sandals Ombretto Pink / Bubblegum / Camelia / Cacao   전부 01325
 *
 * ── 픽스처는 손으로 쓰지 않았다 ─────────────────────────────────────────────
 * 아래 JSON은 2026-09-14에 junioredition.com `/products/{handle}.js`와
 * foretforet.com `/shop/product_list.action.html`이 **실제로 내려준 응답 원문**
 * 이고, 테스트는 운영 어댑터(productFactsFromShopifyProduct / searchForetforet)로
 * 그 파일을 읽는다. 손으로 만든 모양을 넣으면 실제 응답에만 있는 경로를 통째로
 * 못 보고 지나간다 — 이 저장소가 이미 세 번 겪은 사고다.
 *
 * ── 7건을 가르는 상품 증거 축은 없었다(실측) ───────────────────────────────
 *   색상 표기가 다르다    7건 중 3건만   판매처 분류가 다르다  7건 중 3건만
 *   핵심 상품명이 다르다  7건 중 6건만   옷의 형태가 다르다    0건(어휘에 없다)
 * 7건 전부에서 참인 사실은 하나뿐이다 — **같은 판매처가 둘을 서로 다른 두 상품
 * 페이지로 진열해 두었다**. 그래서 그 사실을 보류 축으로 쓴다.
 */

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

/** 포레포레 골든 쌍은 실제 검색 응답을 그대로 통과시킨다 — 네트워크만 가짜다. */
vi.mock("../rate-limit/domain-rate-limiter", () => ({
  acquireDomainSlot: async () => () => {},
  recordRateLimitResponse: () => {},
  fetchWithDomainRateLimit: async (url: string) => {
    if (url.includes("foretforet.com")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => JSON.parse(readFileSync(path.join(FIXTURES, "foretforet-search-pp24kashe1195ner.json"), "utf8")),
      } as unknown as Response;
    }
    return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response;
  },
}));

const { compareCrossSellerProducts } = await import("../comparison-search/cross-seller");
const { compareModelCode } = await import("../comparison-search/model-code");
const { deriveMatchTruth } = await import("../comparison-search/match-truth");

/**
 * MATCHING-FIX-01 Phase E(CEO 지시, 2026-09-16) — **실제 사고 입력으로 바꾼다.**
 *
 * 여기 있던 단언들은 `deriveMatchTruth("low", "unavailable", verdict)` 를 불렀다.
 * 그런데 **같은 파일이 그 입력이 거짓임을 스스로 증명하고 있었다** — 아래
 * 「품번은 여전히 글자 하나까지 같다」가 `compareModelCode(...) === "exact"` 를
 * 단언한다. 즉 실제 파이프라인이 deriveMatchTruth 에 넣는 값은 "unavailable" 이
 * 아니라 "exact"(또는 Misha&Puff 두 쌍은 "partial")다.
 *
 * 그래서 이 헬퍼는 **픽스처에서 읽어낸 실제 값**으로 판정을 돌린다. 손으로 적은
 * "unavailable" 을 다시 넣을 수 없게 modelCode 인자 자체를 없앴다.
 */
const realModelCode = (a: ProductFacts, b: ProductFacts) => compareModelCode(a.brandModelCode, b.brandModelCode);

/** 이 쌍이 **동일상품 가격**(priceTierFromLink === "EXACT")에 들어가는가.
 *  domestic-product-link.ts:52 의 규칙 그대로 — EXACT_IDENTIFIER/STRONG_IDENTIFIER
 *  가 곧 EXACT tier 다. 삭제된 isSameProductForPricing 이 물으려던 질문을,
 *  이제 실제로 그 답을 내는 경로에 그대로 묻는다. */
function goesIntoSameProductPrice(a: ProductFacts, b: ProductFacts, level: "low" | "medium" | "high" | "very_high") {
  const truth = deriveMatchTruth(level, realModelCode(a, b), compareCrossSellerProducts(a, b).verdict);
  return { truth, exactTier: truth === "EXACT_IDENTIFIER" || truth === "STRONG_IDENTIFIER" };
}
const { productFactsFromShopifyProduct } = await import("../comparison-search/seller-facts");
const { searchForetforet } = await import("../comparison-search/foretforet");

/**
 * 검색으로 발견된 후보. 응답이 주는 `url`("/products/{handle}")을 그대로 넘긴다 —
 * 운영 경로(shopify-suggest.ts)와 같은 모양이다.
 */
function candidate(handle: string): ProductFacts {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, `junioredition-${handle}.json`), "utf8")) as Record<
    string,
    unknown
  >;
  return productFactsFromShopifyProduct(
    {
      title: raw.title as string,
      handle: raw.handle as string,
      url: `/products/${raw.handle as string}`,
      description: raw.description as string,
      vendor: raw.vendor as string,
      type: raw.type as string,
      tags: raw.tags as string[],
      options: raw.options as { name?: string; values?: string[] }[],
      images: raw.images as string[],
    },
    "junioredition.com",
  );
}

/**
 * 등록상품(원본). 같은 상품이지만 **운영 DB에 실제로 저장된 URL 모양**을 쓴다 —
 * `www.` 와 로케일/컬렉션 프리픽스가 붙어 있고(실측), 검색 응답 URL에는 없다.
 * 이 차이를 흡수하지 못하면 같은 가게를 다른 가게로 읽어 규칙이 통째로 죽는다.
 */
function registered(handle: string, collection: string): ProductFacts {
  return {
    ...candidate(handle),
    sourceUrl: `https://www.junioredition.com/en-kr/collections/${collection}/products/${handle}`,
  };
}

/** 양방향으로 돌려보고, 두 답이 완전히 같을 때만 그 답을 돌려준다. */
function bothWays(a: ProductFacts, b: ProductFacts) {
  const forward = compareCrossSellerProducts(a, b);
  const backward = compareCrossSellerProducts(b, a);
  expect(backward).toEqual(forward);
  return forward;
}

/** 실측된 거짓 SAME — [원본 handle, 원본 컬렉션, 상대 handle, 왜 다른 상품인가] */
const FALSE_SAME_PAIRS: [string, string, string, string][] = [
  [
    "minnie-newborn-body-in-rosetto-by-konges-slojd",
    "konges-slojd",
    "minnie-newborn-onesie-in-rosetto-by-konges-slojd",
    "바디수트 vs 우주복",
  ],
  [
    "bubble-sweatshirt-in-grey-melange-by-main-story",
    "kids-clothing",
    "bubble-sweatshirt-in-graystone-by-main-story",
    "다른 색",
  ],
  [
    "baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff",
    "misha-puff",
    "baby-circus-stripe-romper-in-antique-rose-by-misha-puff",
    "가디건 vs 롬퍼",
  ],
  [
    "baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff",
    "misha-puff",
    "circus-stripe-cardigan-in-mink-by-misha-puff",
    "다른 색 · 베이비 아님",
  ],
  [
    "giulia-flower-sandals-in-ombretto-pink-by-pepe",
    "pepe-shoes",
    "giulia-flower-sandals-in-bubblegum-pink-patent-by-pepe",
    "다른 색 · 다른 소재",
  ],
  [
    "giulia-flower-sandals-in-ombretto-pink-by-pepe",
    "pepe-shoes",
    "giulia-flower-sandals-in-camelia-by-pepe",
    "다른 색",
  ],
  ["giulia-flower-sandals-in-ombretto-pink-by-pepe", "pepe-shoes", "giulia-flower-sandals-in-cacao-by-pepe", "다른 색"],
];

describe("거짓 SAME 7건 — 판매처가 같은 품번을 여러 상품에 적는다", () => {
  it.each(FALSE_SAME_PAIRS)("%s ↔ %s 는 SAME이 아니다 (%s)", (handle, collection, other) => {
    const match = bothWays(registered(handle, collection), candidate(other));
    expect(match.verdict).not.toBe("SAME");
    expect(match.verdict).toBe("PRESUMED_SAME");
    // 같은 판매처가 두 상품으로 진열했다는 사실이 실제 보류 사유로 남는다.
    expect(match.blockers.map((b) => b.blocker)).toContain("SAME_SELLER_DISTINCT_LISTING");
  });

  it("7건 전부 SAME 이 아니다 — 교차판매처 판정 자체는 이 사고를 막았다", () => {
    for (const [handle, collection, other] of FALSE_SAME_PAIRS) {
      const match = compareCrossSellerProducts(registered(handle, collection), candidate(other));
      expect(match.verdict).toBe("PRESUMED_SAME");
      // 교차판매처 축 «하나만» 놓고 보면 PRESUMED_SAME 은 동일상품 가격에 닿지 못한다.
      expect(deriveMatchTruth("low", "unavailable", match.verdict)).not.toBe("STRONG_IDENTIFIER");
    }
  });

  /**
   * 🔴🔴 MATCHING-FIX-01 Phase E — **이 단언은 «옳은 동작»이 아니라 «오늘의 사실»이다.**
   *
   * 바로 위 테스트가 "막혔다"고 말하는 것은 modelCode 를 "unavailable" 이라고
   * 손으로 적어 넣었을 때의 이야기다. 실제 파이프라인이 넣는 값을 그대로 쓰면
   * 답이 뒤집힌다(2026-09-16, 픽스처 실측):
   *
   *   Minnie Body ↔ Onesie          modelCode=exact    → high 이상이면 EXACT_IDENTIFIER
   *   Bubble Grey Melange ↔ Graystone  modelCode=exact → high 이상이면 EXACT_IDENTIFIER
   *   Misha&Puff 두 쌍              modelCode=partial  → 모든 등급에서 STRONG_IDENTIFIER
   *   Giulia 세 쌍                  modelCode=exact    → high 이상이면 EXACT_IDENTIFIER
   *
   * EXACT_IDENTIFIER/STRONG_IDENTIFIER 는 priceTierFromLink 에서 **EXACT** 다.
   * 즉 «같은 판매처가 두 상품으로 진열해 둔 서로 다른 상품 7쌍이 지금도 동일상품
   * 가격에 들어간다». MATCHING-3.1 이 막은 것은 `verdict === "SAME"` 한 경로뿐이고,
   * deriveMatchTruth 는 modelCode 를 **교차판매처 보류보다 먼저** 본다
   * (match-truth.ts:77-80 — crossSeller 는 CONFLICT 일 때만 먼저 이긴다).
   *
   * 🔴 이 테스트를 통과시키려고 단언을 약화하지 않았다. 반대로, 사고가 사고인
   *    채로 **실행되는 사실**로 못박는다. 고치는 날 이 테스트는 빨개져야 하고,
   *    그때 «무엇을 바꿨는지»를 의식적으로 적게 된다.
   * 🔴 이번 작업에서 고치지 않는 이유: 고치려면 deriveMatchTruth 의 우선순위를
   *    바꿔야 하고, 그건 기존 판정을 바꾸는 일이다(이 저장소 최상위 금지사항).
   *    판정 «정의» 단계의 과제다.
   */
  it("🔴 미해결 — 실제 modelCode 를 넣으면 7건이 «동일상품 가격»에 들어간다", () => {
    const landed: string[] = [];
    for (const [handle, collection, other] of FALSE_SAME_PAIRS) {
      const a = registered(handle, collection);
      const b = candidate(other);
      // 손으로 적은 "unavailable" 이 아니라 픽스처가 실제로 가진 품번으로 비교한다.
      expect(realModelCode(a, b)).not.toBe("unavailable");
      const { exactTier } = goesIntoSameProductPrice(a, b, "low");
      expect(exactTier).toBe(true); // ← 여기가 사고다. true 가 정상이라는 뜻이 아니다.
      landed.push(`${handle} ↔ ${other}`);
    }
    expect(landed).toHaveLength(FALSE_SAME_PAIRS.length);
  });

  it("품번은 여전히 글자 하나까지 같다 — 검색어나 추출을 바꿔서 가린 것이 아니다", () => {
    const shared: [string, string, string][] = [
      ["minnie-newborn-body-in-rosetto-by-konges-slojd", "minnie-newborn-onesie-in-rosetto-by-konges-slojd", "KS106168-P05261"],
      ["bubble-sweatshirt-in-grey-melange-by-main-story", "bubble-sweatshirt-in-graystone-by-main-story", "AW26MS185"],
      ["giulia-flower-sandals-in-ombretto-pink-by-pepe", "giulia-flower-sandals-in-camelia-by-pepe", "01325"],
    ];
    for (const [left, right, code] of shared) {
      expect(candidate(left).brandModelCode).toBe(code);
      expect(candidate(right).brandModelCode).toBe(code);
      expect(compareModelCode(candidate(left).brandModelCode, candidate(right).brandModelCode)).toBe("exact");
      // 품번이 확인됐다는 사실 자체는 그대로 기록된다 — 다만 그것이 등급을 정하지 않는다.
      expect(compareCrossSellerProducts(candidate(left), candidate(right)).identifierConfirmed).toBe(true);
    }
  });

  it("Misha & Puff 두 쌍은 애초에 품번 확인 경로가 아니었다 — 부분 일치 + 라인 공통 축이었다", () => {
    // 지시서 전제("7건 전부 identifierConfirmed 경로")의 실측 정정. 이 둘은 품번이
    // 서로 다르고(B1408F26-670 / B1453F26-670 / K1408F26-1A8), compareModelCode가
    // partial(+2)을 주면서 라인 공통 축만으로 SAME_MIN_AXES가 채워졌다.
    const origin = registered("baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff", "misha-puff");
    for (const other of [
      "baby-circus-stripe-romper-in-antique-rose-by-misha-puff",
      "circus-stripe-cardigan-in-mink-by-misha-puff",
    ]) {
      const match = compareCrossSellerProducts(origin, candidate(other));
      expect(match.identifierConfirmed).toBe(false);
      expect(compareModelCode(origin.brandModelCode, candidate(other).brandModelCode)).toBe("partial");
      expect(match.verdict).not.toBe("SAME");
    }
  });
});

describe("정상 판정은 보존된다", () => {
  /** 검색이 원본 상품 **자신**을 물어온 경우(실측 18건 중 11건). 같은 URL이므로
   * 판매처 진열 분리가 아니고, 품번 축이 그대로 살아 SAME을 유지한다. */
  const SELF: [string, string][] = [
    ["lulu-t-bar-shoes-in-vernice-nero-by-pepe", "pepe-shoes"],
    ["minnie-newborn-body-in-rosetto-by-konges-slojd", "konges-slojd"],
    ["bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing"],
    ["baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff", "misha-puff"],
    ["giulia-flower-sandals-in-ombretto-pink-by-pepe", "pepe-shoes"],
  ];

  it.each(SELF)("원본 상품 자신(%s)은 여전히 SAME이고 동일상품 가격에 들어간다", (handle, collection) => {
    const match = bothWays(registered(handle, collection), candidate(handle));
    expect(match.verdict).toBe("SAME");
    expect(match.blockers).toEqual([]);
    // 삭제된 isSameProductForPricing 대신, 실제로 가격 등급을 정하는 경로로 확인한다.
    expect(goesIntoSameProductPrice(registered(handle, collection), candidate(handle), "low").exactTier).toBe(true);
  });

  it("품번 일치는 가장 강한 축이다 — 부분 일치보다 크고, 혼자서는 동일상품을 만들지 못한다", () => {
    const match = compareCrossSellerProducts(
      registered("giulia-flower-sandals-in-ombretto-pink-by-pepe", "pepe-shoes"),
      candidate("giulia-flower-sandals-in-ombretto-pink-by-pepe"),
    );
    const identifier = match.axes.find((a) => a.axis === "MODEL_CODE");
    expect(identifier).toBeDefined();
    // 부분 일치(2점)보다 크다.
    expect(identifier!.points).toBeGreaterThan(2);
    // 그런데 혼자서는 SAME의 문턱에 닿지 못한다 — 다른 축이 반드시 함께 있어야 한다.
    expect(identifier!.points).toBeLessThan(5);
  });

  it("포레포레 골든 쌍은 STRONG_IDENTIFIER를 유지한다", async () => {
    // 운영 파서가 실제 검색 응답에서 만든 후보 그대로.
    const candidates = await searchForetforet("PP24KASHE1195NER");
    const foret = candidates.find((c) => c.sku === "PP24KASHE1195NER");
    expect(foret).toBeDefined();
    expect(foret!.facts).toBeDefined();
    // 국내 유통사 코드는 브랜드 품번 칸에 절대 들어가지 않는다(그 규칙이 살아 있어야
    // 이 쌍이 "없는 품번 충돌"로 떨어지지 않는다).
    expect(foret!.facts!.brandModelCode).toBeNull();
    expect(foret!.facts!.sellerSku).toBe("PP24KASHE1195NER");

    const junior = registered("lulu-t-bar-shoes-in-vernice-nero-by-pepe", "pepe-shoes");
    const cross = compareCrossSellerProducts(junior, foret!.facts!);
    expect(cross.verdict).not.toBe("CONFLICT");

    // 등급을 정하는 것은 modelCode 증거다 — 이 경로는 이번 변경과 무관하게 그대로다.
    const modelCode = compareModelCode(junior.brandModelCode, "PP24KASHE1195NER");
    expect(modelCode).toBe("partial");
    expect(deriveMatchTruth("low", modelCode, cross.verdict)).toBe("STRONG_IDENTIFIER");
  });
});

/**
 * ── 8번째 거짓 SAME(MATCHING-3.2-B 작업 중 발견, 2026-09-14) ────────────────
 * 위 7건과 같은 사고인데 고정되지 않은 채로 남아 있었다. AW26MS185 를 쓰는
 * junioredition 상품은 Grey Melange · Graystone **두 개가 아니라 세 개**다 —
 * Conker Stripe 도 본문에 같은 `Product code AW26MS185` 를 적는다(실측).
 * 그래서 Bubble Sweatshirt 는 두 쌍이 아니라 세 쌍이 같은 품번으로 묶인다.
 *
 * 픽스처 `junioredition-bubble-sweatshirt-in-conker-stripe-by-main-story.json` 은
 * 손으로 쓰지 않았다 — 2026-09-14 에
 * `https://www.junioredition.com/products/bubble-sweatshirt-in-conker-stripe-by-main-story.js`
 * 가 내려준 응답 원문이고, 위 7건과 같은 운영 어댑터로 읽는다.
 */
const CONKER = "bubble-sweatshirt-in-conker-stripe-by-main-story";

/** Conker Stripe 와 품번이 같은 나머지 두 진열. [원본 handle, 원본 컬렉션] */
const CONKER_PAIRS: [string, string][] = [
  ["bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing"],
  ["bubble-sweatshirt-in-graystone-by-main-story", "kids-clothing"],
];

describe("8번째 거짓 SAME — AW26MS185 는 세 상품이 나눠 쓴다", () => {
  it("세 진열의 품번은 글자 하나까지 같다 — 추출을 바꿔서 가린 것이 아니다", () => {
    for (const [handle] of CONKER_PAIRS) {
      expect(candidate(handle).brandModelCode).toBe("AW26MS185");
      expect(
        compareModelCode(candidate(handle).brandModelCode, candidate(CONKER).brandModelCode),
      ).toBe("exact");
      // 품번이 확인됐다는 사실은 그대로 기록된다 — 다만 그것이 등급을 정하지 않는다.
      expect(
        compareCrossSellerProducts(candidate(handle), candidate(CONKER)).identifierConfirmed,
      ).toBe(true);
    }
    expect(candidate(CONKER).brandModelCode).toBe("AW26MS185");
  });

  it.each(CONKER_PAIRS)("%s ↔ Conker Stripe 는 SAME이 아니다 (다른 색)", (handle, collection) => {
    const match = bothWays(registered(handle, collection), candidate(CONKER));
    expect(match.verdict).not.toBe("SAME");
    expect(match.verdict).toBe("PRESUMED_SAME");
    // 같은 판매처가 세 상품으로 진열했다는 사실이 실제 보류 사유로 남는다.
    expect(match.blockers.map((b) => b.blocker)).toContain("SAME_SELLER_DISTINCT_LISTING");
  });

  it("두 쌍 다 SAME 이 아니다 — 교차판매처 축만 보면 막혔다", () => {
    for (const [handle, collection] of CONKER_PAIRS) {
      const match = compareCrossSellerProducts(registered(handle, collection), candidate(CONKER));
      expect(match.verdict).toBe("PRESUMED_SAME");
      expect(deriveMatchTruth("low", "unavailable", match.verdict)).not.toBe("STRONG_IDENTIFIER");
    }
  });

  /** 🔴 위 「🔴 미해결」과 **같은 사고**다. Conker Stripe 쌍도 modelCode 가
   *  exact(AW26MS185)라, 실제 입력을 넣으면 동일상품 가격에 들어간다. */
  it("🔴 미해결 — 실제 modelCode 를 넣으면 이 두 쌍도 «동일상품 가격»에 들어간다", () => {
    for (const [handle, collection] of CONKER_PAIRS) {
      const a = registered(handle, collection);
      const b = candidate(CONKER);
      expect(realModelCode(a, b)).toBe("exact");
      expect(goesIntoSameProductPrice(a, b, "low").truth).toBe("STRONG_IDENTIFIER");
      expect(goesIntoSameProductPrice(a, b, "very_high").truth).toBe("EXACT_IDENTIFIER");
      expect(goesIntoSameProductPrice(a, b, "low").exactTier).toBe(true); // ← 사고다
    }
  });
});

/**
 * ── 원본 자기 자신은 SAME 이다 ─────────────────────────────────────────────
 * 3.1 보고의 "원본 자기 자신 11건 SAME 유지"를 픽스처가 있는 **전부**로 넓혀
 * 고정한다. 위 `정상 판정은 보존된다` 의 SELF 는 그중 5건만 덮고 있어서, 나머지가
 * 조용히 깨져도 드러나지 않았다. 검색이 원본 상품 자신을 물어온 경우는 같은 URL
 * 이므로 판매처 진열 분리가 아니고, 어떤 보류도 붙지 않아야 한다.
 */
const ALL_SELF_HANDLES: readonly string[] = [
  "baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff",
  "baby-circus-stripe-romper-in-antique-rose-by-misha-puff",
  "bobo-choses-color-all-over-baby-t-shirt-by-bobo-choses",
  "bubble-sweatshirt-in-conker-stripe-by-main-story",
  "bubble-sweatshirt-in-graystone-by-main-story",
  "bubble-sweatshirt-in-grey-melange-by-main-story",
  "circus-stripe-cardigan-in-mink-by-misha-puff",
  "giulia-flower-sandals-in-bubblegum-pink-patent-by-pepe",
  "giulia-flower-sandals-in-cacao-by-pepe",
  "giulia-flower-sandals-in-camelia-by-pepe",
  "giulia-flower-sandals-in-ombretto-pink-by-pepe",
  "juicy-tomatoes-all-over-baby-t-shirt-by-bobo-choses",
  "lulu-t-bar-shoes-in-vernice-nero-by-pepe",
  "minnie-newborn-body-in-rosetto-by-konges-slojd",
  "minnie-newborn-onesie-in-rosetto-by-konges-slojd",
  "mush-monster-duo-all-over-baby-t-shirt-by-bobo-choses",
];

describe("원본 자기 자신 — 픽스처로 가진 junioredition 상품 전부", () => {
  it.each(ALL_SELF_HANDLES)("%s 자신은 SAME이고 보류가 없다", (handle) => {
    // 컬렉션 프리픽스는 URL 모양을 만들기 위한 것일 뿐 판정에 쓰이지 않는다 —
    // 같은 상품을 `www.` + 로케일/컬렉션이 붙은 등록 URL 모양으로 한 번 더 만든다.
    const match = bothWays(registered(handle, "kids-clothing"), candidate(handle));
    expect(match.verdict).toBe("SAME");
    expect(match.blockers).toEqual([]);
    expect(goesIntoSameProductPrice(registered(handle, "kids-clothing"), candidate(handle), "low").exactTier).toBe(true);
  });
});
