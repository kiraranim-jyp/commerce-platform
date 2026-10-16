import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-045 — **사이즈 라인 차이는 SAME 을 막지 않는다** (CPO 제품 정의)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ```
 * 같은 모델 + 같은 색상/디자인 + 같은 상품군 + **사이즈만 다름** → SAME_PRODUCT
 * 단품↔세트 · 다른 모델 · 다른 색상 · 구성 상이                 → DIFFERENT
 * ```
 *
 * 🔴🔴 **WU-043 에서 한 번 시도했다가 되돌린 변경이다.** 그때는 색상 보호가 없어
 *    `Grey Melange ↔ Graystone` 이 새 False SAME 이 됐다 — 그 쌍을 막던 것은
 *    사이즈가 아니라 **`SIZE_SYSTEM` 이 «우연히»** 였다.
 *    🟢 WU-044 의 `COLOR_VARIANT` 가 그 구멍을 닫은 «뒤» 에야 이 변경이 안전해졌다.
 *    그래서 이 파일은 **둘을 같이** 잠근다.
 *
 * 🔴 이 파일이 같이 잠그는 금지 사항:
 * ```
 * 무차별 blocker 제거 0 — 색상·모델·구성·상품형태·연령라인·소재는 **그대로 막는다**
 * threshold 0 · 색상사전 0 · PRESUMED 자동승격 0
 * ```
 */

const base: ProductFacts = {
  sourceUrl: "https://a.com/products/x",
  urlSlug: null,
  brand: "Bobo Choses",
  brandModelCode: "B226AC010",
  sellerSku: null,
  title: "Booty Ghosts T-Shirt",
  coreTitleTokens: ["booty", "ghosts"],
  categoryText: "T Shirt",
  colorText: "Heather Grey",
  materialText: "100% Organic Cotton",
  fitText: null,
  ageRangeText: null,
  sizeLabels: ["4-5Y", "6-7Y"],
  audienceSignals: ["kids"],
  imageUrls: [],
};
/** 🟢 **사이즈 라인만** 다른 짝 — 개월 라인(baby). 나머지는 전부 같다. */
const babyLine: ProductFacts = { ...base, sourceUrl: "https://b.com/products/x", sizeLabels: ["6-12M", "12-18M"] };

const cmp = (x: ProductFacts, y: ProductFacts) => compareCrossSellerProducts(x, y);
const blockersOf = (x: ProductFacts, y: ProductFacts) =>
  (cmp(x, y)?.blockers ?? []).map((b: { blocker?: string } | string) => (typeof b === "string" ? b : (b.blocker ?? "")));
const reasonsOf = (x: ProductFacts, y: ProductFacts) => (cmp(x, y)?.reasons ?? []).join(" | ");

describe("A. 사이즈 라인 차이는 보류가 아니다", () => {
  it("🟢 사이즈 라인만 다르면 SIZE_SYSTEM 보류가 서지 않는다", () => {
    expect(blockersOf(base, babyLine)).not.toContain("SIZE_SYSTEM");
  });

  /** 🟢 **사실은 버리지 않는다** — 막지 않을 뿐 근거에 남는다. */
  it("🟢 그래도 «관측» 으로는 남는다", () => {
    expect(reasonsOf(base, babyLine)).toContain("사이즈 라인 차이");
  });

  it("🟢 사이즈 체계가 같으면 아무 관측도 만들지 않는다", () => {
    expect(reasonsOf(base, { ...base, sourceUrl: "https://b.com/products/x" })).not.toContain("사이즈 라인 차이");
  });
});

/* ══════════════ B. 🔴🔴 다른 차이는 «전부» 그대로 막는다 ══════════════ */

describe("B. 무차별 제거가 아니다", () => {
  /** 🔴🔴 WU-043 이 터뜨린 바로 그 쌍 — 색상 이름이 다르면 사이즈와 무관하게 막힌다. */
  it("🔴 색상 이름이 다르면(색조는 같아도) 보류가 선다", () => {
    const grey = { ...base, colorText: "Grey Melange" };
    const graystone = { ...babyLine, colorText: "Graystone" };
    expect(blockersOf(grey, graystone)).toContain("COLOR_VARIANT");
  });

  it("🔴 모델코드가 갈리면 충돌이 그대로 선다", () => {
    const other = { ...babyLine, brandModelCode: "B226AB040" };
    const conflicts = (cmp(base, other)?.conflicts ?? []).map((c: { conflict?: string } | string) =>
      typeof c === "string" ? c : (c.conflict ?? ""),
    );
    expect(conflicts).toContain("MODEL_CODE");
  });

  it("🔴 소재가 다르면 보류가 그대로 선다", () => {
    expect(blockersOf(base, { ...babyLine, materialText: "100% Polyester" })).toContain("MATERIAL");
  });
});

/* ══════════════ C. 🔴 소스 가드 — 술어까지 잠근다 ══════════════ */

describe("C. 소스에서 조건이 유지된다", () => {
  const repoRoot = (() => {
    let dir = __dirname;
    for (let i = 0; i < 12; i++) {
      if (existsSync(path.join(dir, "packages", "crawler", "package.json"))) return dir;
      dir = path.dirname(dir);
    }
    throw new Error("repo 루트를 찾지 못했다");
  })();
  const src = readFileSync(path.join(repoRoot, "packages/crawler/src/comparison-search/cross-seller.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  /** 🔴 **보류를 다시 넣지 않는다.** 대입만 보면 속으므로 push 자체를 단언한다. */
  it("SIZE_SYSTEM 보류 push 가 없다", () => {
    expect(src).not.toContain('blockers.push({ blocker: "SIZE_SYSTEM"');
  });

  it("관측은 조건부로만 만든다", () => {
    expect(src).toContain('size.systemOutcome === "mismatch" ? size.detail : null');
  });

  /** 🔴🔴 **색상 보호가 살아 있어야 이 변경이 안전하다** — 같이 잠근다. */
  it("색상 보호(COLOR_VARIANT)가 그대로 있다", () => {
    expect(src).toContain('color.outcome === "match" && color.nameOutcome === "mismatch"');
    expect(src).toContain('blockers.push({ blocker: "COLOR_VARIANT"');
  });

  /** 🔴 나머지 보류는 하나도 지우지 않았다. */
  it.each(["MATERIAL", "FIT", "GARMENT_FORM", "AUDIENCE_LINE"])("%s 보류가 남아 있다", (b) => {
    expect(src).toContain(`blocker: "${b}"`);
  });
});
