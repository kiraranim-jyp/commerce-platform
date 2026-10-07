/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.3(CPO 지시, 2026-10-07) — **확인된 품번이 판정기까지 닿는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 는 「품번 exact + 색상 양쪽 확인 + 색상 일치」일 때만 PRESUMED_SAME 을 넘어
 * 확정을 허용하라고 지시했다. 🔴 **전수 측정 결과 새 규칙이 필요하지 않았다** —
 * 그 조건은 `compareCrossSellerProducts` 가 이미 `axes` 로 표현하고 있고
 * (COLOR 축은 `compareColor` 가 «양쪽 모두 읽혔고 일치» 일 때만 밀어 넣는다),
 * 품번이 facts 에 실리면 MODEL_CODE 축까지 더해져 verdict 가 SAME 이 된다.
 *
 * 빠져 있던 것은 한 칸이었다. P5.2 가 `confirmBrandCodeInTitle` 로 품번을
 * 확인하고도 그 값을 `compareModelCode` 에만 썼고, 판정기는 `facts` 만 본다.
 *
 *   facts 에 싣지 않음  axes=[TITLE,CATEGORY]                  → PRESUMED_SAME
 *   facts 에 실음        axes=[TITLE,MODEL_CODE,CATEGORY,COLOR]  → SAME
 *
 * 🔴 그래서 `6568fb2` 가드도 `hasObservedDifference` 도 **건드리지 않았다.**
 *    같은 판매처가 품번을 재사용한 쌍은 blocker 로 계속 막힌다 — 아래 ②가 그
 *    10쌍을 전수로 고정한다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compareCrossSellerProducts } from "../cross-seller";
import { confirmBrandCodeInTitle } from "../domestic-identifiers";
import { deriveMatchTruth, isColorUnverified } from "../match-truth";
import { withConfidence } from "../match";
import { compareModelCode } from "../model-code";
import { searchLittleluna } from "../littleluna";
import { productFactsFromShopifyProduct } from "../seller-facts";
import type { ProductFacts } from "@commerce/shared";

const FIXTURES = path.join(__dirname, "..", "..", "__tests__", "fixtures");

function junioredition(handle: string): ProductFacts {
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
const registered = (handle: string, collection: string): ProductFacts => ({
  ...junioredition(handle),
  sourceUrl: `https://www.junioredition.com/en-kr/collections/${collection}/products/${handle}`,
});

/** 🔴 운영 경로 그대로 — withConfidence 가 facts 를 채우고 판정을 얹는다. */
async function littlelunaThroughPipeline(foreign: ProductFacts) {
  const html = readFileSync(path.join(FIXTURES, "littleluna-mainstory-aw26ms185-search.html"), "utf8");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(html, { status: 200 })));
  const raw = await searchLittleluna("메인스토리");
  vi.unstubAllGlobals();
  const scored = withConfidence(
    { title: foreign.title, brand: foreign.brand ?? undefined, facts: foreign } as never,
    raw,
  );
  return scored.map((c) => {
    const truth = deriveMatchTruth(
      c.matchLevel ?? "low",
      compareModelCode(foreign.brandModelCode, c.facts?.brandModelCode ?? null),
      c.crossSellerVerdict,
      c.crossSellerBlockers,
      c.crossSellerConflicts,
      isColorUnverified(foreign.colorText, c.facts?.colorText),
    );
    return { title: c.title, truth, verdict: c.crossSellerVerdict, facts: c.facts };
  });
}

const IS_SAME_PRODUCT = (t: string) => t === "EXACT_IDENTIFIER" || t === "STRONG_IDENTIFIER";

describe("🔴🔴 P5.3 ① 네 색상이 운영 경로에서 갈린다", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Grey Melange 만 동일상품이고 나머지 셋은 아니다", async () => {
    const foreign = registered("bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing");
    expect(foreign.brandModelCode).toBe("AW26MS185");
    expect(foreign.colorText).toBe("Grey Melange");

    const got = await littlelunaThroughPipeline(foreign);
    const by = (needle: string) => got.find((g) => g.title.includes(needle))!;

    // 🟢 품번 exact + 색상 양쪽 읽힘 + 일치 → SAME → 동일상품
    expect(by("Grey Melange").verdict).toBe("SAME");
    expect(IS_SAME_PRODUCT(by("Grey Melange").truth)).toBe(true);

    // 🔴 색상을 못 읽었다 → PRESUMED_SAME → 확정하지 않는다
    for (const needle of ["Graystone", "Rose Shadow"]) {
      expect(by(needle).facts?.colorText).toBeNull();
      expect(by(needle).verdict).toBe("PRESUMED_SAME");
      expect(IS_SAME_PRODUCT(by(needle).truth)).toBe(false);
    }

    // 🔴 색상이 읽혔고 어긋났다 → CONFLICT → P4 변경 B → SIMILAR
    expect(by("Chocolate Brown").facts?.colorText).toBe("Brown");
    expect(by("Chocolate Brown").verdict).toBe("CONFLICT");
    expect(by("Chocolate Brown").truth).toBe("SIMILAR");
  });

  it("🔴 확인된 품번이 facts 에 실린다 — 네 건 모두", async () => {
    const foreign = registered("bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing");
    const got = await littlelunaThroughPipeline(foreign);
    expect(got).toHaveLength(4);
    expect(got.every((g) => g.facts?.brandModelCode === "AW26MS185")).toBe(true);
  });

  it("🔴 품번이 확인되지 «않는» 판매처는 예전과 같다 — facts 가 오염되지 않는다", async () => {
    const foreign = registered("bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing");
    // 포레포레 모양의 제목(자체코드만). 어댑터를 타지 않고 withConfidence 만 본다.
    const scored = withConfidence({ title: foreign.title, facts: foreign } as never, [
      {
        title: "AW26 2차[메인스토리]멜란지 버블 스웻셔츠-MA26KASST0577356",
        url: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277461",
        price: { amount: 117000, currency: "KRW" },
        regularPrice: null,
        imageUrl: null,
        confidence: 0,
        facts: {
          sourceUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10277461",
          urlSlug: "shopdetail.html",
          brand: null,
          brandModelCode: null,
          sellerSku: "MA26KASST0577356",
          title: "AW26 2차[메인스토리]멜란지 버블 스웻셔츠-MA26KASST0577356",
          coreTitleTokens: [],
          categoryText: null,
          colorText: null,
          materialText: null,
          fitText: null,
          ageRangeText: null,
          sizeLabels: [],
          audienceSignals: [],
          imageUrls: [],
        },
      } as never,
    ]);
    // 🔴 자체코드는 해외 품번과 같을 수 없으므로 채택되지 않는다 → null 유지.
    expect(scored[0].facts?.brandModelCode).toBeNull();
    expect(scored[0].facts?.sellerSku).toBe("MA26KASST0577356");
  });
});

/** 실측된 거짓 SAME — identifier-safety.test.ts 의 FALSE_SAME_PAIRS 와 같은 출처. */
const FALSE_SAME: [string, string, string, string][] = [
  ["minnie-newborn-body-in-rosetto-by-konges-slojd", "konges-slojd", "minnie-newborn-onesie-in-rosetto-by-konges-slojd", "바디수트 vs 우주복(색상 동일)"],
  ["bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing", "bubble-sweatshirt-in-graystone-by-main-story", "다른 색(Graystone)"],
  ["bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing", "bubble-sweatshirt-in-conker-stripe-by-main-story", "다른 색(Conker Stripe)"],
  ["baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff", "misha-puff", "baby-circus-stripe-romper-in-antique-rose-by-misha-puff", "가디건 vs 롬퍼(색상 동일)"],
  ["baby-circus-stripe-cardigan-in-antique-rose-by-misha-puff", "misha-puff", "circus-stripe-cardigan-in-mink-by-misha-puff", "가디건 다른 색"],
  ["giulia-flower-sandals-in-bubblegum-pink-patent-by-pepe", "pepe", "giulia-flower-sandals-in-cacao-by-pepe", "샌들 다른 색(Cacao)"],
  ["giulia-flower-sandals-in-bubblegum-pink-patent-by-pepe", "pepe", "giulia-flower-sandals-in-camelia-by-pepe", "샌들 다른 색(Camelia)"],
  ["giulia-flower-sandals-in-bubblegum-pink-patent-by-pepe", "pepe", "giulia-flower-sandals-in-ombretto-pink-by-pepe", "샌들 다른 색(Ombretto — 같은 pink 계열)"],
  ["bobo-choses-color-all-over-baby-t-shirt-by-bobo-choses", "bobo-choses", "juicy-tomatoes-all-over-baby-t-shirt-by-bobo-choses", "다른 프린트 티셔츠"],
  ["bobo-choses-color-all-over-baby-t-shirt-by-bobo-choses", "bobo-choses", "mush-monster-duo-all-over-baby-t-shirt-by-bobo-choses", "다른 프린트 티셔츠"],
];

describe("🔴🔴 P5.3 ② 거짓 SAME 10쌍은 그대로 막혀 있다", () => {
  it.each(FALSE_SAME)("%s ↔ %s — %s 는 동일상품이 아니다", (aH, coll, bH) => {
    const a = registered(aH, coll);
    const b = junioredition(bH);
    const cross = compareCrossSellerProducts(a, b);
    const truth = deriveMatchTruth(
      "low",
      compareModelCode(a.brandModelCode, b.brandModelCode),
      cross.verdict,
      cross.blockers,
      cross.conflicts,
      isColorUnverified(a.colorText, b.colorText),
    );
    expect(IS_SAME_PRODUCT(truth), `${aH} ↔ ${bH} 가 동일상품으로 올라갔다`).toBe(false);
  });

  it("🔴 Ombretto 쌍은 색상 계열이 «겹치는데도» 막힌다 — 계열 일치를 동일로 읽지 않는 근거", () => {
    const a = registered("giulia-flower-sandals-in-bubblegum-pink-patent-by-pepe", "pepe");
    const b = junioredition("giulia-flower-sandals-in-ombretto-pink-by-pepe");
    const cross = compareCrossSellerProducts(a, b);
    // 🔴 COLOR 축이 «맞았다»(둘 다 pink 계열). 그래도 확정되지 않는다 —
    //    SAME_SELLER_DISTINCT_LISTING 이 hasObservedDifference 로 막는다.
    expect(cross.axes.some((x) => x.axis === "COLOR")).toBe(true);
    expect(cross.blockers.map((x) => x.blocker)).toContain("SAME_SELLER_DISTINCT_LISTING");
    expect(compareModelCode(a.brandModelCode, b.brandModelCode)).toBe("exact");
    expect(
      IS_SAME_PRODUCT(deriveMatchTruth("low", "exact", cross.verdict, cross.blockers, cross.conflicts, false)),
    ).toBe(false);
  });
});

describe("P5.3 ③ confirmBrandCodeInTitle 의 적용 범위", () => {
  it("🔴 후보가 자기 품번을 이미 갖고 있으면 덮어쓰지 않는다 — 해외↔해외 쌍 보호", () => {
    const a = registered("bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing");
    const b = junioredition("bubble-sweatshirt-in-graystone-by-main-story");
    expect(b.brandModelCode).toBe("AW26MS185");
    const scored = withConfidence({ title: a.title, facts: a } as never, [
      { title: b.title, url: b.sourceUrl, price: null, regularPrice: null, imageUrl: null, confidence: 0, facts: b } as never,
    ]);
    // 원래 값이 그대로다(confirm 이 개입할 자리가 아니다).
    expect(scored[0].facts?.brandModelCode).toBe("AW26MS185");
    expect(scored[0].facts).toEqual(b);
  });

  it("🔴 해외 품번이 없으면 국내 facts 를 건드리지 않는다", () => {
    const foreignNoCode: ProductFacts = {
      ...registered("bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing"),
      brandModelCode: null,
    };
    const scored = withConfidence({ title: foreignNoCode.title, facts: foreignNoCode } as never, [
      {
        title: "[메인스토리]  AW26MS185 - Bubble Sweatshirt - Grey Melange",
        url: "https://littleluna.co.kr/product/x/4120/",
        price: null,
        regularPrice: null,
        imageUrl: null,
        confidence: 0,
        facts: { ...registered("bubble-sweatshirt-in-grey-melange-by-main-story", "kids-clothing"), brandModelCode: null },
      } as never,
    ]);
    expect(scored[0].facts?.brandModelCode).toBeNull();
  });
});
