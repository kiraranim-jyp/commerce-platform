import { describe, expect, it } from "vitest";
import type { ProductFacts } from "@commerce/shared";
import { compareCrossSellerProducts } from "../comparison-search/cross-seller";
import { productFactsFromShopifyProduct } from "../comparison-search/seller-facts";

/**
 * P0-A.17 SAFE FIT NORMALIZATION(CEO 승인, 2026-09-18).
 *
 * 승인 범위는 **"oversize fit" ↔ "oversized fit" 하나뿐**이다. 이 테스트는 그 하나가
 * 접히는지와, **나머지가 접히지 않는지**를 같은 무게로 잰다 — 후자가 더 중요하다.
 *
 * 실측 근거(3,000건 표집): bobochoses 는 `oversize fit`(1건), junioredition 은
 * `oversized fit`(6건)을 쓴다. 서로 다른 철자라 두 판매처 사이에서 같은
 * 오버사이즈 상품이 만나면 «항상» FIT 보류가 났다.
 */

/** 핏 문구 말고는 **모든 것이 같은** 두 상품을 만든다 — FIT 축만 남겨 재기 위해서다. */
function productWithFit(fitPhrase: string, domain: string): ProductFacts {
  return productFactsFromShopifyProduct(
    {
      title: "Booty Ghosts T-shirt",
      handle: "b226ac010-booty-ghosts-t-shirt",
      url: "/products/b226ac010-booty-ghosts-t-shirt",
      body: `Heather grey t-shirt. Organic Cotton 100%. ${fitPhrase}. Responsibly made in Portugal.`,
      vendor: "Bobo Choses",
      type: "T-shirts",
      tags: "children, clothing, t-shirts",
    },
    domain,
  );
}

function fitOutcome(leftFit: string, rightFit: string): { axis: boolean; blocked: boolean; detail: string } {
  const match = compareCrossSellerProducts(
    productWithFit(leftFit, "bobochoses.com"),
    productWithFit(rightFit, "junioredition.com"),
  );
  const axis = match.axes.find((a) => a.axis === "FIT");
  const blocker = match.blockers.find((b) => b.blocker === "FIT");
  return { axis: Boolean(axis), blocked: Boolean(blocker), detail: axis?.detail ?? blocker?.detail ?? "(핏 축 없음)" };
}

describe("① 승인된 표기 변형만 같은 값으로 읽는다", () => {
  it("oversize fit ↔ oversized fit → 동일 (보류 없음)", () => {
    const r = fitOutcome("An oversize fit", "An oversized fit");
    expect(r.blocked, "🔴 d 한 글자 때문에 다시 보류가 났다").toBe(false);
    expect(r.axis).toBe(true);
  });

  it("글자가 달랐다는 사실을 근거 문장에 남긴다 — 원문을 지우지 않는다", () => {
    const r = fitOutcome("An oversize fit", "An oversized fit");
    expect(r.detail).toContain("oversize fit");
    expect(r.detail).toContain("oversized fit");
    expect(r.detail).toContain("표기 변형");
  });

  it("양방향으로 같다", () => {
    expect(fitOutcome("An oversized fit", "An oversize fit").blocked).toBe(false);
  });

  it("완전히 같은 문구면 기존처럼 한 번만 적는다", () => {
    const r = fitOutcome("An oversized fit", "An oversized fit");
    expect(r.blocked).toBe(false);
    expect(r.detail).not.toContain("표기 변형");
  });
});

describe("🔴 ② 나머지는 «접히지 않는다» — 이번 승인 범위 밖", () => {
  const stillDifferent: [string, string][] = [
    ["An oversize fit", "A loose fit"],
    ["An oversized fit", "A relaxed fit"],
    // CEO 보류 — loose ↔ relaxed 는 이번에 넣지 않았다(P0-A.16 별도 안건).
    ["A loose fit", "A relaxed fit"],
    ["A slim fit", "A loose fit"],
    ["A regular fit", "A relaxed fit"],
    ["A slim fit", "A regular fit"],
    ["It fits true to size", "A loose fit"],
    ["An oversized fit", "A slim fit"],
  ];
  for (const [a, b] of stillDifferent) {
    it(`${a} ↔ ${b} → 여전히 다름`, () => {
      const r = fitOutcome(a, b);
      expect(r.blocked, `🔴 ${a} 와 ${b} 가 같은 값으로 접혔다 — 승인 범위를 넘었다`).toBe(true);
    });
  }
});

describe("③ 같은 핏이면 예전처럼 축이 붙는다 (회귀)", () => {
  for (const phrase of ["A loose fit", "A relaxed fit", "A slim fit", "A regular fit", "It fits true to size"]) {
    it(`${phrase} 끼리는 일치`, () => {
      const r = fitOutcome(phrase, phrase);
      expect(r.blocked).toBe(false);
      expect(r.axis).toBe(true);
    });
  }
});

describe("④ 한쪽에 핏 문구가 없으면 여전히 «모른다» — 보류가 아니다", () => {
  it("핏 없는 쪽이 있으면 축도 보류도 없다", () => {
    const r = fitOutcome("An oversized fit", "Made in Portugal");
    expect(r.blocked).toBe(false);
    expect(r.axis).toBe(false);
  });
});
