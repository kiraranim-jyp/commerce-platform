import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDiscoveryQuerySet, DEFAULT_MAX_QUERIES } from "../query-planner";
import type { ProductIdentity } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-1 — **Query Planner 계약**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 「Search 는 넓게 / MI 는 좁게」 — 이 파일의 핵심은 **그 경계를 기계로 잠그는 것** 이다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const SRC = strip(readFileSync(path.join(HERE, "..", "query-planner.ts"), "utf8"));

const identity = (over: Partial<ProductIdentity>): ProductIdentity => ({
  brand: "Bobo Choses",
  productName: "Hug Hairy Monster T-shirt",
  productType: "T-shirts",
  genderAge: null,
  color: "Light blue",
  size: null,
  season: null,
  productCode: "B226AC009",
  sourceUrl: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
  sourceSite: "bobochoses.com",
  sourceCountry: null,
  market: null,
  ...over,
});

const axesOf = (qs: { axis: string }[]) => qs.map((q) => q.axis);

describe("CORE-1 A — 상품이 가진 증거만으로 질의를 만든다(고정 N 금지)", () => {
  it("A-1 🟢 브랜드·품번·디자인명이 다 있으면 여러 축이 선다", () => {
    const qs = buildDiscoveryQuerySet(identity({}));
    expect(qs.length).toBeGreaterThan(3);
    expect(axesOf(qs)).toContain("BRAND_CODE");
    expect(axesOf(qs)).toContain("BRAND_CODE_KO");
    expect(axesOf(qs)).toContain("PURCHASE_KO");
  });

  it("A-2 🔴 품번이 **없으면** 품번 축을 만들지 않는다", () => {
    const qs = buildDiscoveryQuerySet(identity({ productCode: null }));
    for (const a of ["BRAND_CODE", "BRAND_CODE_KO", "CODE_ONLY", "PURCHASE_KO", "PRICE_KO", "SHOP_EN"]) {
      expect(axesOf(qs), `🔴 품번이 없는데 ${a} 가 생겼다`).not.toContain(a);
    }
    /** 🟢 그래도 디자인명 축은 선다 — 「증거가 있는 축만」이 규칙이다. */
    expect(axesOf(qs)).toContain("BRAND_DESIGN");
  });

  it("A-3 🔴 브랜드가 **없으면** 브랜드 축을 만들지 않는다", () => {
    const qs = buildDiscoveryQuerySet(identity({ brand: null }));
    for (const a of ["BRAND_CODE", "BRAND_CODE_KO", "BRAND_DESIGN", "BRAND_DESIGN_KO", "SHOP_EN"]) {
      expect(axesOf(qs)).not.toContain(a);
    }
    expect(axesOf(qs), "🟢 품번 단독 축은 남는다").toContain("CODE_ONLY");
  });

  it("A-4 🔴 한글 alias 가 **없는 브랜드** 면 한글 축을 만들지 않는다", () => {
    const qs = buildDiscoveryQuerySet(identity({ brand: "Totally Unknown Brand" }));
    for (const a of ["BRAND_CODE_KO", "BRAND_DESIGN_KO", "PURCHASE_KO", "PRICE_KO"]) {
      expect(axesOf(qs), `🔴 alias 가 없는데 ${a} 가 생겼다 — 지어낸 것이다`).not.toContain(a);
    }
  });
});

describe("CORE-1 B — 한글 브랜드 alias 는 «기존 자산» 만 쓴다", () => {
  it("B-1 🟢 `보보쇼즈` 는 기존 alias 에서 온다", () => {
    const qs = buildDiscoveryQuerySet(identity({}));
    const ko = qs.find((q) => q.axis === "BRAND_CODE_KO");
    expect(ko?.text).toContain("보보쇼즈");
    expect(ko?.text).toContain("B226AC009");
  });

  /**
   * 🔴🔴 **이 계약이 FINAL-2 의 경계를 지킨다** — CPO 가 추가하지 않기로 한
   *    「디자인명 한글 음역 사전」을 이 파일이 몰래 만들지 못하게 한다.
   */
  it("B-2 🔴 소스에 **한글 디자인명 리터럴이 없다**(새 사전 금지)", () => {
    const koWords = SRC.match(/"[^"]*[가-힣][^"]*"/g) ?? [];
    /** 🟢 허용되는 한글은 **의도 키워드 두 개** 뿐이다(고정 어휘 · 사전이 아니다). */
    const allowed = new Set(['"구매"', '"가격"']);
    const unexpected = koWords.filter((w) => !allowed.has(w));
    expect(unexpected, `🔴 새 한글 어휘가 생겼다: ${JSON.stringify(unexpected)}`).toHaveLength(0);
  });

  it("B-3 🔴 자체 alias 표를 만들지 않았다(기존 함수만 쓴다)", () => {
    expect(SRC).toContain("lookupBrandAlias");
    expect(SRC, "🔴 alias 배열을 이 파일에 만들면 사전이 된다").not.toMatch(/alias\s*:\s*["']/);
  });
});

describe("CORE-1 C — 🔴 MI 경계를 넘지 않는다", () => {
  /**
   * 🔴🔴 「Search 는 넓게 / MI 는 좁게」 — synonym 이 **판정** 으로 새면
   *    WU-171 이 측정한 대로 **DIFFERENT 5/6 이 같이 열린다**.
   */
  it("C-1 🔴 planner 가 MI 모듈을 import 하지 않는다", () => {
    for (const banned of ["cross-seller", "match-truth", "mi-same-candidates", "product-facts"]) {
      expect(SRC, `🔴 "${banned}" 를 import 했다 — Search 가 MI 로 샜다`).not.toContain(banned);
    }
  });

  it("C-2 🔴 MI 쪽에서 planner 를 import 하지 않는다(역방향)", () => {
    const root = path.join(HERE, "..", "..");
    for (const f of ["comparison-search/cross-seller.ts", "comparison-search/match-truth.ts", "comparison-search/match.ts"]) {
      const src = readFileSync(path.join(root, f), "utf8");
      expect(src, `🔴 ${f} 가 query-planner 를 참조한다`).not.toContain("query-planner");
    }
  });

  it("C-3 🟢 순수 함수다 — HTTP 가 없다", () => {
    for (const banned of ["fetch(", "axios", "http", "Playwright"]) {
      expect(SRC, `🔴 "${banned}" 가 생겼다 — planner 는 순수해야 한다`).not.toContain(banned);
    }
  });
});

describe("CORE-1 D — 중복·상한·순서", () => {
  it("D-1 🔴 같은 문장이 두 번 들어가지 않는다", () => {
    const qs = buildDiscoveryQuerySet(identity({}));
    expect(new Set(qs.map((q) => q.text)).size).toBe(qs.length);
  });

  it("D-2 🔴 상한을 지킨다 · 기본값이 고정돼 있다", () => {
    expect(buildDiscoveryQuerySet(identity({}), { max: 2 })).toHaveLength(2);
    expect(buildDiscoveryQuerySet(identity({})).length).toBeLessThanOrEqual(DEFAULT_MAX_QUERIES);
  });

  it("D-3 🔴 상한으로 자를 때 **강한 축이 먼저** 살아남는다", () => {
    const qs = buildDiscoveryQuerySet(identity({}), { max: 1 });
    expect(qs[0].axis).toBe("BRAND_CODE");
  });

  /** 🔴 같은 근거를 두 축으로 세지 않는다 — 디자인명에 품번·브랜드가 섞이면 안 된다. */
  it("D-4 🔴 디자인명 축에 품번·브랜드 토큰이 섞이지 않는다", () => {
    const qs = buildDiscoveryQuerySet(identity({}));
    const d = qs.find((q) => q.axis === "BRAND_DESIGN");
    expect(d, "🔴 디자인명 축이 없다").toBeDefined();
    const designPart = d!.text.replace(/^"Bobo Choses"\s*/, "");
    expect(designPart.toLowerCase()).not.toContain("b226ac009");
    expect(designPart.toLowerCase()).not.toContain("bobo");
  });
});
