import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductFacts } from "@commerce/shared";
import { describe, expect, it } from "vitest";
import {
  compareCrossSellerProducts,
  CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE,
  isSameProductForPricing,
  type CrossSellerVerdict,
} from "../comparison-search/cross-seller";
import { withConfidence } from "../comparison-search/match";
import { deriveMatchTruth } from "../comparison-search/match-truth";
import { compareModelCode } from "../comparison-search/model-code";
import { deriveProductMatchTruth } from "../comparison-search/product-identity";
import {
  productFactsFromShopifyProduct,
  productFactsFromSmallableHtml,
  type ShopifyProductLike,
} from "../comparison-search/seller-facts";
import type { ComparisonCandidate, ComparisonQuery } from "../comparison-search/types";

/**
 * MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 고정 인수 테스트.
 *
 * 픽스처는 손으로 쓰지 않았다. smallable.com과 bobochoses.com이 2026-09-13에
 * 실제로 내려준 응답을 그대로 저장한 것이고(HTML의 JSON-LD와 Shopify 상품
 * JSON), 테스트는 운영 코드가 쓰는 바로 그 파서로 그 파일을 읽는다. 손으로 만든
 * 모양을 넣으면 실제 응답에만 있는 경로(예: 색상 변형이 있는 상품은 Product가
 * ProductGroup.hasVariant 안에 들어온다)를 통째로 못 보고 지나간다 — 이 저장소가
 * 한 번 겪은 사고다. 그래서 430651은 ProductGroup 형태의 실측 픽스처를 일부러
 * 그대로 쓴다.
 */
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function smallable(file: string, productId: string): ProductFacts {
  const facts = productFactsFromSmallableHtml(readFileSync(path.join(FIXTURES, file), "utf8"), productId);
  if (!facts) throw new Error(`smallable fixture를 읽지 못했다: ${file}`);
  return facts;
}

function bobo(code: string): ProductFacts {
  const raw = JSON.parse(readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8")) as ShopifyProductLike;
  return productFactsFromShopifyProduct(raw, "bobochoses.com");
}

const SMALLABLE_430701 = () => smallable("smallable-430701-product.html", "430701");
const SMALLABLE_430700 = () => smallable("smallable-430700-product.html", "430700");
const SMALLABLE_430632 = () => smallable("smallable-430632-product.html", "430632");
const SMALLABLE_430651 = () => smallable("smallable-430651-fr.html", "430651");

/** 양방향으로 돌려보고, 두 답이 완전히 같을 때만 그 답을 돌려준다. 테스트가
 * 우연히 한 방향만 통과하는 일을 구조적으로 막는다. */
function verdictBothWays(a: ProductFacts, b: ProductFacts): CrossSellerVerdict {
  const forward = compareCrossSellerProducts(a, b);
  const backward = compareCrossSellerProducts(b, a);
  expect(backward).toEqual(forward);
  return forward.verdict;
}

describe("MATCHING-2.0-CORE 인수 테스트 A~E", () => {
  it("A: Smallable 430701 ↔ Bobo B226AC114 = 동일상품", () => {
    const match = compareCrossSellerProducts(SMALLABLE_430701(), bobo("B226AC114"));
    expect(match.verdict).toBe("SAME");
    expect(match.conflicts).toEqual([]);
    // 어느 하나의 신호로 올라간 것이 아니라는 사실을 고정한다 — 서로 다른 축이
    // 동시에 맞았기 때문에 동일상품이다.
    const axes = match.axes.map((a) => a.axis).sort();
    expect(axes).toEqual(expect.arrayContaining(["AUDIENCE", "CATEGORY", "COLOR", "FIT", "MATERIAL", "TITLE"]));
  });

  it("B: Bobo B226AC114 ↔ Smallable 430701 = 동일상품 (방향 대칭)", () => {
    expect(verdictBothWays(bobo("B226AC114"), SMALLABLE_430701())).toBe("SAME");
  });

  it("C: Bobo B226AC114 ↔ Bobo B226AD013 = 다른 상품 가능성", () => {
    const match = compareCrossSellerProducts(bobo("B226AC114"), bobo("B226AD013"));
    expect(match.verdict).toBe("CONFLICT");
    const kinds = match.conflicts.map((c) => c.conflict).sort();
    expect(kinds).toContain("AUDIENCE");
    expect(kinds).toContain("COLOR");
    expect(kinds).toContain("MODEL_CODE");
    // 반증이 있으면 점수 축은 아예 세지 않는다 — 점수로 뒤집을 자리가 없다.
    expect(match.axes).toEqual([]);
  });

  it("D: Smallable 430632 ↔ Bobo B226AC018 = 동일상품", () => {
    const match = compareCrossSellerProducts(SMALLABLE_430632(), bobo("B226AC018"));
    expect(match.verdict).toBe("SAME");
    expect(match.conflicts).toEqual([]);
  });

  it("E: Smallable 430632 ↔ Bobo B226AD013 = 다른 상품 가능성", () => {
    const match = compareCrossSellerProducts(SMALLABLE_430632(), bobo("B226AD013"));
    expect(match.verdict).toBe("CONFLICT");
    const kinds = match.conflicts.map((c) => c.conflict);
    expect(kinds).toContain("AUDIENCE");
    expect(kinds).toContain("COLOR");
  });

  it("A~E 전부가 방향을 바꿔도 같은 판정과 같은 근거를 낸다", () => {
    const pairs: [ProductFacts, ProductFacts, CrossSellerVerdict][] = [
      [SMALLABLE_430701(), bobo("B226AC114"), "SAME"],
      [bobo("B226AC114"), SMALLABLE_430701(), "SAME"],
      [bobo("B226AC114"), bobo("B226AD013"), "CONFLICT"],
      [SMALLABLE_430632(), bobo("B226AC018"), "SAME"],
      [SMALLABLE_430632(), bobo("B226AD013"), "CONFLICT"],
    ];
    for (const [left, right, expected] of pairs) {
      expect(verdictBothWays(left, right)).toBe(expected);
    }
  });
});

describe("판매처가 서로 다른 SKU를 쓰는 것은 반증이 아니다", () => {
  it("Smallable은 Bobo 품번을 싣지 않는다 — 그래서 품번 비교는 '불가'이지 '충돌'이 아니다", () => {
    const smallableFacts = SMALLABLE_430701();
    const boboFacts = bobo("B226AC114");
    expect(smallableFacts.sellerSku).toBe("AAA1804922");
    expect(smallableFacts.brandModelCode).toBeNull();
    expect(boboFacts.brandModelCode).toBe("B226AC114");
    expect(compareModelCode(smallableFacts.brandModelCode, boboFacts.brandModelCode)).toBe("unavailable");
  });

  it("판매처 SKU는 ProductFacts의 품번 칸에 절대 들어가지 않는다", () => {
    for (const facts of [SMALLABLE_430632(), SMALLABLE_430700(), SMALLABLE_430651()]) {
      expect(facts.brandModelCode).toBeNull();
      expect(facts.sellerSku).toMatch(/^AAA\d+$/);
    }
  });
});

describe("강한 반증은 점수로 뒤집을 수 없다", () => {
  it("제목·소재·상품군이 전부 같아도 색상이 충돌하면 CONFLICT다 (P-10-F 회귀)", () => {
    const left = bobo("B226AC042");
    const right = bobo("B226AC043");
    // 두 상품은 제목이 글자 하나까지 같다 — 텍스트로는 원리상 구분되지 않는다.
    expect(left.title).toBe(right.title);
    const match = compareCrossSellerProducts(left, right);
    expect(match.verdict).toBe("CONFLICT");
    expect(match.conflicts.map((c) => c.conflict)).toEqual(expect.arrayContaining(["COLOR", "MODEL_CODE"]));
    expect(isSameProductForPricing(match)).toBe(false);
  });

  it("compareModelCode의 접두사 규칙 자체가 그대로 살아 있다", () => {
    expect(compareModelCode("B226AC042", "B226AC043")).toBe("conflict");
    expect(compareModelCode("B226AC114", "B226AD013")).toBe("conflict");
    expect(compareModelCode("B126AI018", "B126AI01831152")).toBe("partial");
    expect(compareModelCode("01195-VERNICE-NERO", "PP24KASHE1195NER")).toBe("partial");
  });

  it("색상이 충돌하면 나머지 근거가 아무리 많아도 동일상품이 되지 않는다", () => {
    // 430651(네이비)과 B226AC042(라벤더)는 브랜드·상품군·소재·핏·대상·사이즈가
    // 전부 같다. 오직 색만 다르다.
    const match = compareCrossSellerProducts(SMALLABLE_430651(), bobo("B226AC042"));
    expect(match.verdict).toBe("CONFLICT");
    expect(match.conflicts.map((c) => c.conflict)).toContain("COLOR");
  });
});

describe("가격 정책", () => {
  it("🟢 동일상품만 가격 비교에 쓴다", () => {
    expect(isSameProductForPricing(compareCrossSellerProducts(SMALLABLE_430701(), bobo("B226AC114")))).toBe(true);
    expect(isSameProductForPricing(compareCrossSellerProducts(SMALLABLE_430632(), bobo("B226AD013")))).toBe(false);
    expect(isSameProductForPricing(compareCrossSellerProducts(SMALLABLE_430700(), bobo("B226AC112")))).toBe(false);
  });
});

describe("이미지 증거는 합산되되 혼자 결론을 내지 못한다", () => {
  it("실측 거리(동일 86 < 다른 상품 107/119)를 가르는 자리에 선이 있다", () => {
    const pair = () => [SMALLABLE_430700(), bobo("B226AC112")] as const;
    const near = compareCrossSellerProducts(...pair(), { minDistance: 86 });
    const far = compareCrossSellerProducts(...pair(), { minDistance: 107 });
    expect(near.axes.map((a) => a.axis)).toContain("IMAGE");
    expect(far.axes.map((a) => a.axis)).not.toContain("IMAGE");
    expect(CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE).toBeGreaterThan(86);
    expect(CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE).toBeLessThan(107);
  });

  it("이미지가 아무리 가까워도 그것만으로 동일상품 등급을 만들지 못한다", () => {
    // 실측 표본이 3쌍뿐이라, 이 축은 가격에 쓰이는 등급의 정원에 들어가지 않는다.
    const withImage = compareCrossSellerProducts(SMALLABLE_430700(), bobo("B226AC112"), { minDistance: 0 });
    expect(withImage.axes.map((a) => a.axis)).toContain("IMAGE");
    expect(withImage.verdict).not.toBe("SAME");
  });

  it("반증이 있으면 이미지가 완벽히 일치해도 CONFLICT다", () => {
    const match = compareCrossSellerProducts(bobo("B226AC042"), bobo("B226AC043"), { minDistance: 0 });
    expect(match.verdict).toBe("CONFLICT");
  });
});

describe("파이프라인 배선 — 판정이 실제 검색 경로를 타고 나온다", () => {
  /** Shopify `/search/suggest.json`이 실제로 주는 칸들(실측). 지금까지 type/tags를
   * 그대로 버리고 있었고, 그래서 대상 연령/상품군이 매칭에 도달한 적이 없다. */
  function suggestPayload(code: string): ShopifyProductLike {
    const raw = JSON.parse(readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8")) as Record<
      string,
      unknown
    >;
    return {
      title: raw.title as string,
      url: raw.url as string,
      handle: raw.handle as string,
      body: raw.description as string,
      vendor: raw.vendor as string,
      type: raw.type as string,
      tags: raw.tags as string[],
      options: raw.options as { name?: string; values?: string[] }[],
    };
  }

  it("withConfidence가 양쪽 facts를 짝지어 판정을 얹는다 — confidence는 건드리지 않는다", () => {
    const query: ComparisonQuery = {
      title: "Bobo Choses Zipped Sweat Organic Cotton | Heather grey",
      brand: "Bobo Choses",
      sku: "AAA1804922",
      sourceUrl: "https://www.smallable.com/en/product/bobo-choses-zipped-sweat-organic-cotton-heather-grey-bobo-choses-430701",
      facts: SMALLABLE_430701(),
    };
    const candidates: ComparisonCandidate[] = [
      {
        title: "Bobo Choses Bolder half zipped sweatshirt",
        url: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
        price: null,
        imageUrl: null,
        confidence: 0,
        facts: productFactsFromShopifyProduct(suggestPayload("B226AC114"), "bobochoses.com"),
      },
      {
        title: "All About Monsters oversize T-shirt",
        url: "https://bobochoses.com/products/b226ad013-all-about-monsters-oversize-t-shirt",
        price: null,
        imageUrl: null,
        confidence: 0,
        facts: productFactsFromShopifyProduct(suggestPayload("B226AD013"), "bobochoses.com"),
      },
    ];

    const scored = withConfidence(query, candidates);
    const bolder = scored.find((c) => c.url.includes("b226ac114"))!;
    const womens = scored.find((c) => c.url.includes("b226ad013"))!;

    expect(bolder.crossSellerVerdict).toBe("SAME");
    expect(womens.crossSellerVerdict).toBe("CONFLICT");
    // 기존 텍스트 점수는 그대로 계산돼 남는다 — 새 판정이 그것을 덮어쓰지 않는다.
    expect(typeof bolder.confidence).toBe("number");
    expect(bolder.matchLevel).toBeDefined();
  });

  it("화면과 가격 정책이 읽는 값(productMatchTruth / matchTruth)까지 이어진다", () => {
    const same: ComparisonCandidate = {
      title: "x",
      url: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
      price: null,
      imageUrl: null,
      confidence: 0.2,
      matchLevel: "low",
      crossSellerVerdict: "SAME",
    };
    const conflict: ComparisonCandidate = { ...same, crossSellerVerdict: "CONFLICT", confidence: 0.99, matchLevel: "very_high" };
    const query: ComparisonQuery = { title: "x" };

    // 해외 축: 🟢 동일상품으로 표시되고 동일상품 가격으로 쓰이는 값.
    expect(deriveProductMatchTruth(query, same, same.confidence)).toBe("CONFIRMED_PRODUCT");
    // 텍스트 점수가 99%여도 반증이 있으면 올라가지 못한다.
    expect(deriveProductMatchTruth(query, conflict, conflict.confidence)).toBe("CONFLICT");

    // 기존 해외 계층이 "같은 모델 · 옵션 다름"이라고 더 구체적으로 말할 수 있으면
    // 그 말을 잃지 않는다 — 가격 정책상으로는 CONFLICT와 똑같이 동일상품 가격에
    // 쓰이지 않으면서, 셀러에게는 더 쓸모 있는 설명이 남는다.
    const variantQuery: ComparisonQuery = { title: "Lulu T Bar Shoes in Vernice Nero by PèPè" };
    const variantCandidate: ComparisonCandidate = {
      title: "Lulu T Bar Shoes in Vernice Bianco by PèPè",
      url: "https://junioredition.com/products/lulu-t-bar-shoes-bianco",
      price: null,
      imageUrl: null,
      confidence: 0.9,
      matchLevel: "high",
    };
    expect(deriveProductMatchTruth(variantQuery, variantCandidate, 0.9)).toBe("SAME_MODEL_VARIANT");
    expect(
      deriveProductMatchTruth(variantQuery, { ...variantCandidate, crossSellerVerdict: "CONFLICT" }, 0.9),
    ).toBe("SAME_MODEL_VARIANT");

    // 국내 축: 같은 규칙.
    expect(deriveMatchTruth("low", "unavailable", "SAME")).toBe("STRONG_IDENTIFIER");
    expect(deriveMatchTruth("very_high", "exact", "CONFLICT")).toBe("CONFLICT");
    expect(deriveMatchTruth("very_high", "unavailable", "PRESUMED_SAME")).toBe("TEXT_CONFIRMED");
    // 판정이 없으면(하위호환) 기존 경로 그대로다.
    expect(deriveMatchTruth("very_high", "exact")).toBe("EXACT_IDENTIFIER");
  });
});

/**
 * MATCHING-2.0-INTEGRATION-3(CEO 지시, 2026-09-13) — 0.09짜리 오판정 회귀.
 *
 * ── 무엇이 잘못돼 있었나 ────────────────────────────────────────────────────
 * Smallable 430701(하프집업 스웨트셔츠)과 B226AC049(전면 프린트 후드집업)는 서로
 * 다른 상품인데 SAME으로 올라왔고, SAME은 deriveMatchTruth에서 STRONG_IDENTIFIER가
 * 되어 priceTierFromLink의 EXACT — 즉 **동일상품 가격 집계**에 들어간다. 다른
 * 상품의 가격이 이 상품의 가격으로 쓰이고 있었다는 뜻이다.
 *
 * ── 왜 점수로는 구분되지 않았나(라이브 실측) ────────────────────────────────
 * 정답 쌍(430701↔B226AC114)과 오판정 쌍(430701↔B226AC049)은 판정기가 세는 **모든
 * 축에서 글자 하나까지 같은 답**을 냈다 — TITLE 1(겹치는 말은 "zipped" 하나) ·
 * CATEGORY 1 · COLOR 1 · MATERIAL 1 · FIT 1 · AUDIENCE 1 · SIZE 1, 합 7점,
 * 충돌 없음, 보류 없음, identifierConfirmed 둘 다 false. 그래서 개수를 세는
 * 규칙(SAME_MIN_AXES)으로는 둘을 가를 방법이 원리적으로 없었다.
 *
 * 색상·소재·핏이 셋 다 같았던 이유도 실측으로 확인했다: bobochoses.com 카탈로그
 * 3,000건 중 **여섯 상품이 글자 하나까지 같은 설명문을 공유**한다("Light heather
 * grey sweatshirt. Organic Cotton 100%. Loose fit. Responsibly made in
 * Portugal." — B226AC114/B226AC049/B226AC027/B226AC036/B226AB055/B226AB058).
 * 세 축이 아니라 한 문장을 세 번 센 것이고, 그 문장은 후드집업에 대해서는 사실도
 * 아니다.
 *
 * ── 그래서 무엇을 고쳤나 ────────────────────────────────────────────────────
 * 상품을 실제로 구별하는 말은 제목에 있었다("sweatshirt" ↔ "hoodie"). 그런데 그
 * 말은 두 축 사이의 틈으로 사라지고 있었다 — 제목 축은 "상품군 축이 세고 있으니"
 * 유형어를 지우고, 상품군 축은 판매처 자신의 분류만 보고 제목을 보지 않는다.
 * Bobo는 후드집업도 type="Sweatshirts"에 넣으므로 판매처 분류로는 원리상 구분되지
 * 않는다. 그 틈을 GarmentForm 축으로 메웠다(product-facts.ts).
 */
describe("MATCHING-2.0-INTEGRATION-3 회귀 — 다른 상품이 동일상품 가격에 들어오지 않는다", () => {
  const B226AC049 = () => bobo("B226AC049");

  it("쌍 B: Smallable 430701 ↔ B226AC049 는 SAME이 아니다", () => {
    const match = compareCrossSellerProducts(SMALLABLE_430701(), B226AC049());
    expect(match.verdict).not.toBe("SAME");
    expect(match.identifierConfirmed).toBe(false);
    expect(match.blockers.map((b) => b.blocker)).toContain("GARMENT_FORM");
  });

  it("쌍 B는 동일상품 가격에 쓰이지 않는다 — 이 사고의 실제 피해가 막혔는지", () => {
    const match = compareCrossSellerProducts(SMALLABLE_430701(), B226AC049());
    expect(isSameProductForPricing(match)).toBe(false);
    // SAME만이 STRONG_IDENTIFIER로 승격되고, STRONG_IDENTIFIER만 EXACT(동일상품
    // 가격)가 된다. 그 승격이 더 이상 일어나지 않는다는 것을 여기서 못박는다.
    expect(deriveMatchTruth("low", "unavailable", match.verdict)).not.toBe("STRONG_IDENTIFIER");
  });

  it("쌍 A: Smallable 430701 ↔ B226AC114 는 여전히 SAME이다 — 수정이 정답을 죽이지 않았다", () => {
    const match = compareCrossSellerProducts(SMALLABLE_430701(), bobo("B226AC114"));
    expect(match.verdict).toBe("SAME");
    expect(match.blockers).toEqual([]);
    expect(deriveMatchTruth("low", "unavailable", match.verdict)).toBe("STRONG_IDENTIFIER");
  });

  it("쌍 C: B226AC114 ↔ B226AC049 는 서로 다른 상품이다", () => {
    const match = compareCrossSellerProducts(bobo("B226AC114"), B226AC049());
    expect(match.verdict).toBe("CONFLICT");
    expect(match.conflicts.map((c) => c.conflict)).toContain("MODEL_CODE");
  });

  it("세 쌍 전부 방향을 바꿔도 같은 답이다", () => {
    expect(verdictBothWays(SMALLABLE_430701(), bobo("B226AC114"))).toBe("SAME");
    expect(verdictBothWays(SMALLABLE_430701(), B226AC049())).not.toBe("SAME");
    expect(verdictBothWays(bobo("B226AC114"), B226AC049())).toBe("CONFLICT");
  });

  it("판정을 가른 것은 점수가 아니다 — 두 쌍의 점수 축은 완전히 같다", () => {
    // 이 단언이 깨지면 "숫자를 올려서 고쳤다"는 뜻이다. 실측 그대로, 정답 쌍과
    // 오판정 쌍은 점수로는 구분되지 않는다.
    const good = compareCrossSellerProducts(SMALLABLE_430701(), bobo("B226AC114"));
    const bad = compareCrossSellerProducts(SMALLABLE_430701(), B226AC049());
    const points = (m: typeof good) =>
      m.axes.filter((a) => a.axis !== "IMAGE").reduce((sum, a) => sum + a.points, 0);
    expect(points(bad)).toBe(points(good));
    expect(bad.axes.map((a) => a.axis).sort()).toEqual(good.axes.map((a) => a.axis).sort());
  });

  it("옷의 형태가 같으면 보류하지 않는다 — 이 규칙이 아무 데나 발화하지 않는다는 것", () => {
    // 430632(티셔츠)↔B226AC018(티셔츠), 430651(스웨트셔츠)↔B226AC043(스웨트셔츠).
    for (const [left, right] of [
      [SMALLABLE_430632(), bobo("B226AC018")],
      [SMALLABLE_430651(), bobo("B226AC043")],
    ] as const) {
      const match = compareCrossSellerProducts(left, right);
      expect(match.blockers.map((b) => b.blocker)).not.toContain("GARMENT_FORM");
    }
  });

  it("한쪽이 두 형태를 함께 말하면 보류하지 않는다 — 'hooded sweatshirt'는 둘 다다", () => {
    const hooded = { ...B226AC049(), title: "Pixel Abduction all over hooded sweatshirt" };
    const match = compareCrossSellerProducts(SMALLABLE_430701(), hooded);
    expect(match.blockers.map((b) => b.blocker)).not.toContain("GARMENT_FORM");
  });
});

/**
 * 이전부터 쌓아 온 미매칭 쌍. 답이 확정된 인수 테스트가 아니라 **계속 추적하기
 * 위한** 항목이라, 지금 어떤 등급에 서는지와 그 이유를 그대로 고정해 둔다 —
 * 다음에 누가 무엇을 바꾸든 이 두 쌍의 상태 변화가 테스트로 드러난다.
 */
describe("추적 중인 미매칭 쌍", () => {
  it("430651 ↔ B226AC043: 근거가 여섯 축에서 맞아 동일상품으로 올라온다", () => {
    const match = compareCrossSellerProducts(SMALLABLE_430651(), bobo("B226AC043"));
    expect(match.conflicts).toEqual([]);
    expect(match.verdict).toBe("SAME");
    expect(match.axes.map((a) => a.axis).sort()).toEqual(
      ["AUDIENCE", "CATEGORY", "COLOR", "FIT", "MATERIAL", "TITLE"].sort(),
    );
  });

  it("430700 ↔ B226AC112: 상품명에 겹치는 말이 없어 동일상품으로 올리지 않는다", () => {
    const match = compareCrossSellerProducts(SMALLABLE_430700(), bobo("B226AC112"));
    expect(match.conflicts).toEqual([]);
    expect(match.verdict).not.toBe("SAME");
    expect(match.blockers.map((b) => b.blocker)).toContain("NO_TITLE_OVERLAP");
  });
});
