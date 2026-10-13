import { describe, expect, it } from "vitest";
import { buildPrimaryQuery } from "../query-generator";
import type { ProductIdentity } from "../types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-GEMINI-DISCOVERY-QUERY-014 — Primary Query 품질 (Gemini 호출 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 잠그는 것은 「식별력」이다. 길이가 아니다.**
 *    `Bobo Choses B226AC114` 가 `Bobo Choses kids blue cotton sweatshirt 2026 sale`
 *    보다 강하다 — 그 사실을 숫자로 고정한다.
 *
 * 🔴 실측에서 온 결함(sample 상품 N=15 · Gemini 호출 0):
 *    `generateQueries` 는 SPECS 순서로 열거하므로 `maxQueries = 1` 에서
 *    **항상 `Q1 = productName` 단독** 이 Primary 였다(15/15). 품번 보유 3상품 중
 *    품번 query 가 Primary 가 된 것은 **0** 이었다.
 */

const base: ProductIdentity = {
  brand: null, productName: null, productType: null, genderAge: null,
  color: null, size: null, season: null, productCode: null,
  sourceUrl: "https://example.com/products/x", sourceSite: "example.com",
  sourceCountry: null, market: null,
};
const id = (over: Partial<ProductIdentity>): ProductIdentity => ({ ...base, ...over });

/* ══════════════ 1. 품번 우선 ══════════════ */

describe("1. 🔴🔴 품번이 있으면 «브랜드 + 품번» 하나다", () => {
  it("색상·사이즈·마케팅을 붙이지 않는다", () => {
    const q = buildPrimaryQuery(
      id({
        brand: "Bobo Choses",
        productCode: "B226AC114",
        productName: "Booty Ghosts Long Sleeve T-Shirt Navy Blue 2026 Sale",
        color: "Navy blue",
      }),
    );
    expect(q.level).toBe("L1_MODEL_CODE");
    expect(q.text).toBe("Bobo Choses B226AC114");
    /** 🔴 상품명 토큰이 한 개도 섞이면 안 된다 — 그것이 확장을 부른다. */
    expect(q.text.toLowerCase()).not.toContain("booty");
    expect(q.text.toLowerCase()).not.toContain("navy");
    expect(q.text.toLowerCase()).not.toContain("sale");
  });

  it("🔴 품번이 있어도 **브랜드가 없으면** L1 이 아니다(브랜드 없는 품번은 약하다)", () => {
    const q = buildPrimaryQuery(id({ productCode: "B226AC114", productName: "Booty Ghosts T-Shirt" }));
    expect(q.level).not.toBe("L1_MODEL_CODE");
  });
});

/* ══════════════ 2. SKU fallback ══════════════ */

describe("2. 품번이 없으면 «브랜드 + 코어 상품명»", () => {
  it("브랜드 + 코어 토큰 2~4개를 쓴다", () => {
    const q = buildPrimaryQuery(
      id({ brand: "Louis Louise", productName: "Holly Hearts Ribbed Velvet Baby Pants" }),
    );
    expect(q.level).toBe("L2_BRAND_NAME");
    expect(q.text).toBe("Louis Louise Holly Hearts Ribbed Velvet");
    expect(q.tokens.length).toBeLessThanOrEqual(6); // 브랜드 2 + 코어 4
  });

  it("브랜드가 없으면 코어 토큰만 쓴다(L3)", () => {
    const q = buildPrimaryQuery(id({ productName: "Holly Hearts Baby Pants" }));
    expect(q.level).toBe("L3_NAME_ONLY");
    expect(q.text).toBe("Holly Hearts Baby Pants");
  });
});

/* ══════════════ 3. 과다 토큰 제거 ══════════════ */

describe("3. 🔴 무작정 토큰을 늘리지 않는다 — 코어 상한 4", () => {
  it("5번째 이후 토큰은 OVER_CAP 으로 버린다", () => {
    const q = buildPrimaryQuery(
      id({ brand: "Bobo", productName: "Alpha Beta Gamma Delta Epsilon Zeta" }),
    );
    expect(q.tokens).toEqual(["Bobo", "Alpha", "Beta", "Gamma", "Delta"]);
    expect(q.dropped.filter((d) => d.reason === "OVER_CAP").map((d) => d.token)).toEqual([
      "Epsilon", "Zeta",
    ]);
  });
});

/* ══════════════ 4~8. 제거 대상 ══════════════ */

describe("4~8. 🔴 제거해야 하는 토큰 (CPO STEP 3 목록 그대로)", () => {
  const drops = (name: string) =>
    buildPrimaryQuery(id({ brand: "Brand", productName: name }))
      .dropped.filter((d) => d.reason === "DENYLIST" || d.reason === "SEASON_YEAR")
      .map((d) => d.token.toLowerCase());

  it("색상을 제거한다", () => {
    expect(drops("Hearts Pink Navy Pants")).toContain("pink");
    expect(drops("Hearts Pink Navy Pants")).toContain("navy");
  });

  it("사이즈를 제거한다", () => {
    expect(drops("Hearts Pants XL Size")).toEqual(expect.arrayContaining(["xl", "size"]));
  });

  it("가격·할인을 제거한다", () => {
    expect(drops("Hearts Pants Sale Discount KRW")).toEqual(
      expect.arrayContaining(["sale", "discount", "krw"]),
    );
  });

  it("지역·배송(Korea · 직구 · 무료배송)을 제거한다", () => {
    expect(drops("Hearts Pants Korea 직구 무료배송")).toEqual(
      expect.arrayContaining(["korea", "직구", "무료배송"]),
    );
  });

  it("시즌·연도(SS · FW · 2026 · 26FW)를 제거한다", () => {
    expect(drops("Hearts Pants SS FW 2026 26FW")).toEqual(
      expect.arrayContaining(["ss", "fw", "2026", "26fw"]),
    );
  });

  it("마케팅 문구를 제거한다", () => {
    expect(drops("Hearts Pants New Best Limited Last Ones In Stock")).toEqual(
      expect.arrayContaining(["new", "best", "limited", "last", "ones", "stock"]),
    );
  });
});

/* ══════════════ 9. 디자인 토큰 보존 — 🔴 가장 중요하다 ══════════════ */

describe("9. 🔴🔴 고유 디자인명은 «보존» 한다 — 그것이 식별자다", () => {
  it("Holly Hearts · Cherry Print · T Bar 를 지우지 않는다", () => {
    for (const [name, keep] of [
      ["Holly Hearts Velvet Pants", ["Holly", "Hearts"]],
      ["Cherry Print Shirt", ["Cherry", "Print"]],
      ["Lulu T Bar Shoes", ["Lulu", "Bar"]],
    ] as const) {
      const q = buildPrimaryQuery(id({ brand: "Brand", productName: name }));
      for (const token of keep) expect(q.tokens).toContain(token);
    }
  });

  /** 🔴 denylist 라서 보존된다 — allowlist 로 가면 모르는 디자인명이 조용히 죽는다. */
  it("🔴 소재(Ribbed · Velvet · Cotton)는 제거 목록에 «없다» — CPO 예시가 유지한다", () => {
    const q = buildPrimaryQuery(id({ brand: "Louis Louise", productName: "Holly Hearts Ribbed Velvet Pants" }));
    expect(q.tokens).toContain("Ribbed");
    expect(q.tokens).toContain("Velvet");
  });
});

/* ══════════════ 10. 빈 query 방지 ══════════════ */

describe("10. 🔴 만들 수 없으면 «빈 값» 이다 — 지어내지 않는다", () => {
  it("브랜드만 있으면 UNAVAILABLE 이다(브랜드 메인 페이지만 나온다)", () => {
    const q = buildPrimaryQuery(id({ brand: "Bobo Choses" }));
    expect(q.level).toBe("UNAVAILABLE");
    expect(q.text).toBe("");
  });

  it("전부 비어 있으면 UNAVAILABLE 이다", () => {
    expect(buildPrimaryQuery(base).level).toBe("UNAVAILABLE");
  });

  it("상품명이 노이즈뿐이면 UNAVAILABLE 이다(빈 검색어를 던지지 않는다)", () => {
    const q = buildPrimaryQuery(id({ brand: "Brand", productName: "Sale 2026 Korea XL Pink" }));
    expect(q.level).toBe("UNAVAILABLE");
    expect(q.text).toBe("");
  });
});

/* ══════════════ 11. 중복 제거 ══════════════ */

describe("11. 🔴 브랜드가 상품명에 또 있으면 중복이다", () => {
  it("같은 근거를 두 번 세지 않는다", () => {
    const q = buildPrimaryQuery(id({ brand: "Bobo Choses", productName: "Bobo Choses Booty Ghosts T-Shirt" }));
    expect(q.text).toBe("Bobo Choses Booty Ghosts T-Shirt");
    expect(q.dropped.filter((d) => d.reason === "DUPLICATE").map((d) => d.token)).toEqual([
      "Bobo", "Choses",
    ]);
  });
});

/* ══════════════ 12. 식별력 — 이 WU 의 핵심 주장 ══════════════ */

describe("12. 🔴🔴 식별력 비교 — 길이가 아니라 식별력이다", () => {
  it("품번 있는 상품의 Primary 가 «짧고» 식별자를 포함한다", () => {
    const withCode = buildPrimaryQuery(
      id({
        brand: "Bobo Choses",
        productCode: "B226AC114",
        productName: "kids blue cotton sweatshirt autumn 2026 sale",
      }),
    );
    expect(withCode.tokens.length).toBe(3);
    expect(withCode.text).toContain("B226AC114");
  });

  it("🔴 노이즈가 많은 상품명도 코어만 남는다", () => {
    const q = buildPrimaryQuery(
      id({ brand: "Louis Louise", productName: "Holly Hearts Ribbed Velvet Baby Pants Pale Pink 2026 Sale" }),
    );
    expect(q.text).not.toMatch(/pink|2026|sale/i);
    expect(q.text).toContain("Holly Hearts");
  });
});
