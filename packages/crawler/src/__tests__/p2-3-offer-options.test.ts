import { describe, expect, it } from "vitest";
import { longestCommonPrefix, looksLikeApparelSizes, offerRowsToOptions } from "../product-data-extractor";
import { extractColor } from "../description-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-3 — schema.org `Offer` 로 사이즈·재고·SKU (CPO 확정, 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 사고: 성인 테니스 의류의 사이즈가 `[]` 였다. 기존 추출기는 `<select>`
 * 전용인데 이 페이지는 **행마다 하나의 Offer** 다.
 *
 * 🔴 아래 다섯 행은 실제 응답(STMMLS, HTTP 200 · 195,101 bytes)에서 떠 온 값
 * 그대로다 — 이름·SKU·재고 전부. 손으로 만든 값이 하나도 없다.
 *
 * 🔴 **함정 하나를 테스트가 지킨다**: 같은 페이지 본문에 「Small / True to Size /
 * Large」라는 **핏 척도** 가 있다(Overall Sizing 패널). 그것이 사이즈로 들어가면
 * 셀러는 존재하지 않는 사이즈를 파는 상품을 등록한다.
 */
const MAGRO_OFFERS = [
  { name: "Sergio Tacchini Men's Magro Long Sleeve White S", sku: "STMMLSWH1", availability: "InStock", stock: 1 },
  { name: "Sergio Tacchini Men's Magro Long Sleeve White M", sku: "STMMLSWH2", availability: "InStock", stock: 4 },
  { name: "Sergio Tacchini Men's Magro Long Sleeve White L", sku: "STMMLSWH3", availability: "InStock", stock: 2 },
  { name: "Sergio Tacchini Men's Magro Long Sleeve White XL", sku: "STMMLSWH4", availability: "InStock", stock: 3 },
  { name: "Sergio Tacchini Men's Magro Long Sleeve White XXL", sku: "STMMLSWH5", availability: "InStock", stock: 1 },
];

describe("① 🔴 실측 5행 → 사이즈 5개 · 재고 5개 · SKU 5개", () => {
  const result = offerRowsToOptions(MAGRO_OFFERS)!;

  it("축 이름이 「사이즈」다 — 치수 고시가 이 이름을 찾는다", () => {
    /* resolveSizeFromOptions 가 /size|사이즈/i 로 그룹을 찾는다. 이름이 틀리면
       고시가 조용히 빈다 — 그래서 이름 자체가 계약이다. */
    expect(result.optionGroups).toHaveLength(1);
    expect(result.optionGroups[0].name).toBe("사이즈");
  });

  it("🔴 값이 S·M·L·XL·XXL 이다 — 공통 접두사를 지운 나머지", () => {
    expect(result.optionGroups[0].values).toEqual(["S", "M", "L", "XL", "XXL"]);
  });

  it("🔴 재고가 실측값 그대로다 — 1·4·2·3·1", () => {
    expect(result.variants.map((v) => v.stockQuantity)).toEqual([1, 4, 2, 3, 1]);
  });

  it("SKU 가 행마다 실린다", () => {
    expect(result.variants.map((v) => v.sku)).toEqual([
      "STMMLSWH1",
      "STMMLSWH2",
      "STMMLSWH3",
      "STMMLSWH4",
      "STMMLSWH5",
    ]);
  });

  it("variant 의 optionValues 가 그룹 이름을 가리킨다 — 타입 계약", () => {
    for (const v of result.variants) {
      expect(Object.keys(v.optionValues)).toEqual(["사이즈"]);
      expect(result.optionGroups[0].values).toContain(v.optionValues["사이즈"]);
    }
  });
});

describe("② 🔴 「Small / True to Size / Large」는 사이즈가 «아니다»", () => {
  it("핏 척도 세 값은 의류 사이즈 토큰이 아니다", () => {
    /* 이것이 이 상품 본문에 실제로 있는 문구다(Overall Sizing 패널). */
    expect(looksLikeApparelSizes(["Small", "True to Size", "Large"])).toBe(false);
  });

  it("🔴 그 값들이 Offer 로 와도 「사이즈」로 분류하지 «않는다»", () => {
    const fit = offerRowsToOptions([
      { name: "Magro Long Sleeve Small" },
      { name: "Magro Long Sleeve True to Size" },
      { name: "Magro Long Sleeve Large" },
    ])!;
    /* 값은 읽되 축 이름을 「사이즈」로 붙이지 않는다 — 치수 고시가 비는 쪽으로
       안전하게 실패하고, readiness 가 셀러에게 그 사실을 말한다. */
    expect(fit.optionGroups[0].name).toBe("옵션");
  });

  it("🔴 상세설명에 그 문구가 있어도 색상 추출이 오염되지 않는다", () => {
    /* 같은 본문에 「Colors: Brilliant White」가 있다 — 그쪽이 색상이다. */
    expect(extractColor("Small: We find this garment to run small. Colors: Brilliant White")).toBe(
      "Brilliant White",
    );
  });
});

describe("③ 🔴 값을 «지어내지» 않는다", () => {
  it("행이 하나면 아무것도 돌려주지 않는다 — 공통 접두사를 셀 수 없다", () => {
    expect(offerRowsToOptions([{ name: "Magro Long Sleeve White S" }])).toBeNull();
  });

  it("이름이 없으면 돌려주지 않는다", () => {
    expect(offerRowsToOptions([{ name: "" }, { name: "" }])).toBeNull();
  });

  it("🔴 공통 접두사가 이름 «전체» 를 먹으면 포기한다 — 빈 옵션값을 만들지 않는다", () => {
    expect(offerRowsToOptions([{ name: "같은 이름" }, { name: "같은 이름" }])).toBeNull();
  });

  it("🔴 재고를 못 읽은 행에는 수량을 «넣지 않는다»", () => {
    const r = offerRowsToOptions([
      { name: "Shirt S", stock: 2 },
      { name: "Shirt M" },
    ])!;
    expect(r.variants[0].stockQuantity).toBe(2);
    expect(r.variants[1].stockQuantity).toBeUndefined();
  });

  it("🔴 재고 0 은 「품절」이라는 정보다 — 지우지 않는다", () => {
    const r = offerRowsToOptions([
      { name: "Shirt S", stock: 0 },
      { name: "Shirt M", stock: 3 },
    ])!;
    expect(r.variants[0].stockQuantity).toBe(0);
  });
});

describe("④ 사이즈 토큰 판정", () => {
  it("의류 사이즈 집합", () => {
    expect(looksLikeApparelSizes(["S", "M", "L"])).toBe(true);
    expect(looksLikeApparelSizes(["XS", "S", "M", "L", "XL", "XXL"])).toBe(true);
    expect(looksLikeApparelSizes(["2XL", "3XL"])).toBe(true);
    expect(looksLikeApparelSizes(["Free"])).toBe(true);
  });

  it("🔴 하나라도 이상하면 false — 억지로 사이즈로 만들지 않는다", () => {
    expect(looksLikeApparelSizes(["S", "M", "빨강"])).toBe(false);
    expect(looksLikeApparelSizes(["95", "100"])).toBe(false); // 숫자 치수는 이 집합이 아니다
    expect(looksLikeApparelSizes([])).toBe(false);
  });
});

describe("⑤ 공통 접두사 — 단위", () => {
  it("공통부를 정확히 센다", () => {
    expect(longestCommonPrefix(["abc S", "abc M"])).toBe("abc ");
    expect(longestCommonPrefix(["xyz", "abc"])).toBe("");
    expect(longestCommonPrefix(["only one"])).toBe("");
  });
});

describe("⑥ 🔴 기존 경로를 «대체하지» 않았다", () => {
  it("select 추출이 먼저이고 Offer 는 그것이 0건일 때만 묻는다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    /* 🔴 주석을 벗기고 본다 — 이 순서를 «설명하는» 주석이 같은 파일에 길게 있다. */
    const code = readFileSync(join(__dirname, "../product-data-extractor.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain("!productGroupOptions && domOptionGroups.length === 0");
    /* 본문 텍스트 스캔은 Offer «뒤» 다 — 핏 척도가 먼저 답할 길을 막는다. */
    expect(code).toContain("!productGroupOptions && !offerOptions");
    /* 🔴 사이트 전용 selector 를 쓰지 않았다. */
    expect(code).not.toContain("js-ordering");
    expect(code).not.toContain("tennis-warehouse");
  });
});
