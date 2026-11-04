import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compareCrossSellerProducts } from "../comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 7-6 — **FIT 표현 정규화는 «기록» 이고 «판정» 이 아니다**(CPO 우선순위 4)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 문장 그대로: 「정규화는 표현을 비교하기 위한 수단이지, 서로 다른 상품을
 *    SAME 으로 만드는 **판정 규칙이 아닙니다**.」
 *
 * 🔴🔴 **무조건 정규화를 실제로 넣어 보고 되돌렸다**(이 세션 실측):
 * ```
 * `FIT_CANONICAL` 에 `relaxed fit → loose fit` 추가 ⟹
 *   🟢 저장 GT 33쌍 SAME **6/18 → 7/18**(S1-4 `kolkid.ca` 회복) · FP **1 유지**
 *   🔴 **CEO 승인 R1 가드 2건이 샌다**(`fit-normalization.test.ts`)
 *   🔴 기준선 계약 **13 파일 / 15 테스트** FAIL
 * ```
 * ⟹ 🔴 그것은 **판정 룰 변경** 이라 **바이트 동일로 되돌렸다**(md5 `212b5904…` 확인).
 * 🟢 남긴 것은 **근거 문장 기록** 하나다 — 이 파일이 그 경계를 잠근다.
 */

const facts = (o: Partial<ProductFacts>): ProductFacts =>
  ({
    sourceUrl: "https://a.com/products/x",
    urlSlug: "x",
    brand: "Bobo Choses",
    brandModelCode: null,
    sellerSku: null,
    title: "Booty Ghosts Long Sleeve T-Shirt",
    coreTitleTokens: ["booty", "ghosts", "shirt"],
    categoryText: "T Shirt",
    colorText: "heather grey",
    materialText: null,
    fitText: null,
    ageRangeText: null,
    sizeLabels: [],
    audienceSignals: [],
    imageUrls: [],
    ...o,
  }) as ProductFacts;

const fitDetail = (a: string | null, b: string | null): string | undefined => {
  const r = compareCrossSellerProducts(facts({ fitText: a }), facts({ fitText: b }));
  const hit =
    r.blockers.find((x) => x.blocker === "FIT")?.detail ?? r.axes.find((x) => x.axis === "FIT")?.detail;
  return hit;
};

describe("STAGE 7-6 — A. 기록은 남고 판정은 그대로다", () => {
  it("A-1 🟢 `relaxed fit ↔ loose fit` 은 **표현 차이라고 기록** 된다", () => {
    const d = fitDetail("relaxed fit", "loose fit");
    expect(d).toContain("relaxed fit");
    expect(d).toContain("loose fit");
    /** 🟢 CPO 가 요구한 「정규화된 표현 별도 기록」 — 글자를 직접 단언한다. */
    expect(d).toContain("표현 차이로 보인다");
    expect(d).toContain("판정에는 반영하지 않았다");
  });

  it("A-2 🔴🔴 **판정은 바뀌지 않는다** — FIT 보류가 그대로 남는다(R1 가드 보존)", () => {
    const r = compareCrossSellerProducts(
      facts({ fitText: "relaxed fit" }),
      facts({ fitText: "loose fit" }),
    );
    expect(r.blockers.map((b) => b.blocker)).toContain("FIT");
    expect(r.axes.map((a) => a.axis)).not.toContain("FIT");
  });

  it("A-3 🔴 **원본 표현을 보존한다** — 한쪽 글자로 덮어쓰지 않는다", () => {
    const d = fitDetail("relaxed fit", "loose fit")!;
    /** 🔴 「핏 loose fit」 한 줄로 접히면 판매처가 실제로 뭐라 썼는지가 사라진다. */
    expect(d).toMatch(/relaxed fit\s*↔\s*loose fit/);
  });

  it("A-4 🔴🔴 실제로 다른 핏에는 **그 문장을 붙이지 않는다**(음성 대조)", () => {
    for (const [a, b] of [
      ["slim fit", "loose fit"],
      ["regular fit", "relaxed fit"],
      ["true to size", "loose fit"],
      ["oversized fit", "slim fit"],
    ] as const) {
      const d = fitDetail(a, b);
      expect(d, `🔴 ${a} ↔ ${b}`).not.toContain("표현 차이로 보인다");
      expect(d, `🔴 ${a} ↔ ${b}`).toContain(a);
    }
  });

  it("A-5 🟢 같은 값·표기 변형은 기존 문장 그대로다(동작 불변)", () => {
    expect(fitDetail("loose fit", "loose fit")).toBe("핏 loose fit");
    expect(fitDetail("oversize fit", "oversized fit")).toContain("표기 변형");
    expect(fitDetail("oversize fit", "oversized fit")).not.toContain("표현 차이로 보인다");
  });

  it("A-6 🟢 한쪽이 없으면 **보류도 기록도 없다**(「모른다」)", () => {
    expect(fitDetail(null, "loose fit")).toBeUndefined();
  });
});

describe("STAGE 7-6 — B. 경계 — 판정 룰을 바꾸지 않았다", () => {
  const SRC = readFileSync(join(__dirname, "..", "comparison-search", "cross-seller.ts"), "utf8");

  it("B-1 🔴🔴 `FIT_CANONICAL` 에 `relaxed fit` 을 **넣지 않았다**(판정 룰 변경 금지)", () => {
    const table = SRC.slice(SRC.indexOf("const FIT_CANONICAL"), SRC.indexOf("function canonicalFit"));
    expect(table).toContain("oversize fit");
    expect(table, "🔴 무조건 정규화가 들어왔다 — R1 가드가 샌다").not.toContain("relaxed fit");
  });

  it("B-2 🔴 R1 조건부 경로가 **그대로 살아 있다**", () => {
    expect(SRC).toContain("identifierBackedCrossSeller && isLooseRelaxedPair");
  });

  it("B-3 🔴 기록 문장이 **mismatch 분기에만** 붙는다(match 를 만들지 않는다)", () => {
    /**
     * 🔴 1차에 이 단언을 `function compareSize` 까지 잘라서 **거짓 FAIL** 했다 —
     *    그 구간에 `compareFit` 의 match 분기가 같이 들어왔다.
     * 🟢 그래서 **호출 자리** 로 단언한다 — 정의 1 + 호출 **1** 뿐이고,
     *    그 호출이 `outcome: "mismatch"` 블록 안에 있다.
     */
    expect(SRC.split("fitExpressionOnlyNote(").length - 1).toBe(2);
    const callAt = SRC.indexOf("${fitExpressionOnlyNote(x.fitText, y.fitText)}");
    expect(callAt, "🔴 기록 문장 호출이 사라졌다").toBeGreaterThan(-1);
    /**
     * 🔴 그 호출이 **mismatch 를 내는 줄** 에 있다 — 같은 반환 객체 안인지 본다.
     *    🔴 1차에 「구간 slice + not.toContain」으로 썼다가 **주석까지 걸려 거짓 FAIL** 했다
     *       (이 저장소가 반복해 적어 둔 「주석을 벗기고 본다」 그 자리).
     * 🟢 그래서 **코드만 남긴 뒤** 그 줄의 모양을 직접 본다.
     */
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const line = code
      .split(/\r?\n/)
      .findIndex((l) => l.includes("fitExpressionOnlyNote(x.fitText, y.fitText)"));
    expect(line).toBeGreaterThan(-1);
    const lines = code.split(/\r?\n/);
    /** 🔴 바로 위 줄이 `outcome: "mismatch"` 다(match 분기로 옮기면 FAIL 한다). */
    expect(lines[line - 1]).toContain('outcome: "mismatch"');
  });
});
