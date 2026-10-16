import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareCrossSellerProducts } from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-044 — **색상 증거: 색조가 같아도 «이름» 이 다르면 보류한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 왜 필요했나(실측): `compareColor` 는 **색조 그룹** 을 비교한다. 그래서
 * ```
 * Grey Melange ↔ Graystone   둘 다 GREY → match   🔴 Human 은 DIFFERENT
 * ```
 * 가 되고, 그 쌍을 막고 있던 것은 색상이 아니라 **`SIZE_SYSTEM` 이 우연히** 였다
 * (WU-043 이 그것을 풀자 즉시 새 False SAME 이 됐다).
 *
 * 🔴🔴 **이 파일이 같이 잠그는 것**:
 * ```
 * 새 색상 사전 0 (오히려 색조 사전에 «덜» 기댄다) · threshold 0 ·
 * SIZE_SYSTEM 완화 0 · PRESUMED 승격 0 · 충돌(DIFFERENT) 승격 0 — **보류** 다
 * ```
 */

const base: ProductFacts = {
  sourceUrl: "https://a.com/products/x",
  urlSlug: null,
  brand: "Main Story",
  brandModelCode: "AW26MS185",
  sellerSku: null,
  title: "Bubble Sweatshirt",
  coreTitleTokens: ["bubble"],
  categoryText: "Sweatshirt",
  colorText: null,
  materialText: null,
  fitText: null,
  ageRangeText: null,
  sizeLabels: [],
  audienceSignals: [],
  imageUrls: [],
};
const blockersOf = (x: ProductFacts, y: ProductFacts) =>
  (compareCrossSellerProducts(x, y)?.blockers ?? []).map((b: { blocker?: string } | string) =>
    typeof b === "string" ? b : (b.blocker ?? ""),
  );
const conflictsOf = (x: ProductFacts, y: ProductFacts) =>
  (compareCrossSellerProducts(x, y)?.conflicts ?? []).map((c: { conflict?: string } | string) =>
    typeof c === "string" ? c : (c.conflict ?? ""),
  );

describe("A. 색조가 같아도 이름이 다르면 보류한다", () => {
  /** 🔴 이 저장소에서 실제로 새던 쌍이다(C20 · C25). */
  it("🔴 Grey Melange ↔ Graystone → COLOR_VARIANT 보류", () => {
    const b = blockersOf({ ...base, colorText: "Grey Melange" }, { ...base, colorText: "Graystone" });
    expect(b).toContain("COLOR_VARIANT");
  });

  /** 🔴 추출 오염(`"sweatshirt in graystone"`)에도 걸러야 한다 — 상품군 낱말은
   *    **기존 `extractCategoryTaxon`** 이 걷는다(새 사전 아님). */
  it("🔴 상품군 낱말이 섞인 색상 문자열에서도 걸린다", () => {
    const b = blockersOf({ ...base, colorText: "Grey Melange" }, { ...base, colorText: "sweatshirt in graystone" });
    expect(b).toContain("COLOR_VARIANT");
  });

  it("🟢 같은 이름이면 보류하지 않는다", () => {
    const b = blockersOf({ ...base, colorText: "Grey Melange" }, { ...base, colorText: "grey melange" });
    expect(b).not.toContain("COLOR_VARIANT");
  });

  /** 🟢 표기가 조금 달라도 **낱말이 하나라도 겹치면** 통과한다 — 과잉 차단 방지. */
  it("🟢 낱말이 겹치면 통과한다 (Heather Grey ↔ Grey)", () => {
    const b = blockersOf({ ...base, colorText: "Heather Grey" }, { ...base, colorText: "Grey" });
    expect(b).not.toContain("COLOR_VARIANT");
  });

  /** 🔴 한쪽이라도 색상이 없으면 **아무것도 하지 않는다**(기존 정책 유지). */
  it("🔴 색상이 한쪽만 있으면 보류하지 않는다", () => {
    expect(blockersOf({ ...base, colorText: "Grey Melange" }, { ...base, colorText: null })).not.toContain(
      "COLOR_VARIANT",
    );
    expect(blockersOf({ ...base, colorText: null }, { ...base, colorText: null })).not.toContain("COLOR_VARIANT");
  });

  /** 🔴🔴 **충돌로 올리지 않는다** — 다국어/표기 차이로 이름이 갈릴 수 있다. */
  it("🔴 COLOR 충돌로 승격하지 않는다 (보류에 머문다)", () => {
    const c = conflictsOf({ ...base, colorText: "Grey Melange" }, { ...base, colorText: "Graystone" });
    expect(c).not.toContain("COLOR");
  });

  /** 🟢 색조가 이미 다르면 기존 충돌이 더 강하다 — 보류를 겹쳐 두지 않는다. */
  it("🟢 색조가 다르면 COLOR 충돌이고 보류는 겹치지 않는다", () => {
    const x = { ...base, colorText: "Grey Melange" };
    const y = { ...base, colorText: "Chocolate Brown" };
    expect(conflictsOf(x, y)).toContain("COLOR");
    expect(blockersOf(x, y)).not.toContain("COLOR_VARIANT");
  });
});

/* ══════════════ B. 🔴 소스 가드 — 술어까지 잠근다 ══════════════ */

describe("B. 적용 조건이 소스에서 유지된다", () => {
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

  /** 🔴 대입만 보면 `if (false)` 로 죽여도 통과한다 — **술어** 를 단언한다. */
  it("색조 일치 «그리고» 이름 불일치일 때만 보류한다", () => {
    expect(src).toContain('color.outcome === "match" && color.nameOutcome === "mismatch"');
  });

  /** 🔴 새 색상 사전을 만들지 않았다는 것을 고정한다 — 기존 owner 재사용. */
  it("상품군 낱말은 기존 extractCategoryTaxon 으로 걷는다", () => {
    const fn = src.slice(src.indexOf("function colorNameTokens"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toContain("extractCategoryTaxon(t) === null");
  });

  /**
   * 🔴🔴 **WU-045 에서 갱신했다.** 원래는 「이 WU 는 SIZE_SYSTEM 을 건드리지
   *    않는다」를 고정했는데, 색상 보호가 선 «뒤» CPO 가 제품 정의를 확정했다 —
   *    「사이즈만 다르면 SAME_PRODUCT」. 그래서 WU-045 가 그 보류를 비차단으로 바꿨다.
   * 🟢 보장은 약해지지 않았다 — 이 파일의 역할은 **색상 보호가 살아 있는지** 이고,
   *    그 단언(위 두 개)은 그대로다. 사이즈 쪽 계약은 `wu-045-size-line` 이 갖는다.
   */
  it("사이즈 라인은 WU-045 에서 비차단이 됐다 (색상 보호는 그대로)", () => {
    expect(src).not.toContain('blockers.push({ blocker: "SIZE_SYSTEM"');
    expect(src).toContain('blockers.push({ blocker: "COLOR_VARIANT"');
  });
});
