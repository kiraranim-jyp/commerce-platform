import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeOptionModel } from "../common-option-model";

/**
 * P5.6 Phase 1(CPO 승인, 2026-10-09) — 사이트별 추출 결과가 지나는 «한 문».
 *
 * 🔴 최우선 불변식: **기존 옵션 결과를 하나도 잃지 않는다.**
 *    실측(universalExtract, 7사이트) — 이 변경 전후가 같다:
 *      Smallable Dalila 6 · Tender 5 · GiftCard 0 · NB 530 13
 *      Tennis STMMLS 5 · junioredition 5 · main-story 8
 */
const g = (name: string, values: string[]) => ({ name, values });
const v = (vals: Record<string, string>, id = Object.values(vals).join("/")) => ({ id, optionValues: vals });

describe("🔴🔴 ① 멀쩡한 옵션은 그대로 통과한다", () => {
  it("실측 Dalila — 사이즈 6개·조합 6개가 그대로", () => {
    const sizes = ["2 years", "3 years", "4 years", "6 years", "8 years", "10 years"];
    const r = normalizeOptionModel([g("사이즈", sizes)], sizes.map((s) => v({ 사이즈: s })));
    expect(r.optionGroups[0].values).toEqual(sizes);
    expect(r.variants).toHaveLength(6);
  });

  it("축 이름을 «바꾸지 않는다» — 사이트가 쓴 말 그대로", () => {
    expect(normalizeOptionModel([g("Size", ["S", "M"])], []).optionGroups[0].name).toBe("Size");
    expect(normalizeOptionModel([g("사이즈", ["S", "M"])], []).optionGroups[0].name).toBe("사이즈");
    expect(normalizeOptionModel([g("옵션", ["Bl/White S", "Humus L"])], []).optionGroups[0].name).toBe("옵션");
  });

  it("값을 번역·정규화하지 않는다", () => {
    const r = normalizeOptionModel([g("사이즈", ["27,5EU", "2 years"])], []);
    expect(r.optionGroups[0].values).toEqual(["27,5EU", "2 years"]);
  });

  it("🔴 variants 가 비어도 축은 남긴다 — Smallable 이 그 모양이다", () => {
    const r = normalizeOptionModel([g("사이즈", ["2 years", "3 years"])], []);
    expect(r.optionGroups).toHaveLength(1);
    expect(r.variants).toHaveLength(0);
  });
});

describe("🔴🔴 ② 쓸 수 없는 것만 떨어낸다", () => {
  it("1축×1값은 옵션이 아니다 — 공용 판정 그대로", () => {
    expect(normalizeOptionModel([g("Color", ["Pink"])], [v({ Color: "Pink" })]).optionGroups).toHaveLength(0);
  });

  it("이름 없는 축·값 없는 축은 뺀다", () => {
    const r = normalizeOptionModel([g("", ["A", "B"]), g("Size", []), g("Color", ["red", "blue"])], []);
    expect(r.optionGroups.map((x) => x.name)).toEqual(["Color"]);
  });

  it("🔴 값 «안» 의 빈 문자열과 중복을 뺀다 — 빈 옵션값은 채널이 거절한다", () => {
    const r = normalizeOptionModel([g("Size", ["S", "", "  ", "S", "M"])], []);
    expect(r.optionGroups[0].values).toEqual(["S", "M"]);
  });

  it("🔴🔴 축에 «없는» 값을 가리키는 조합은 떨어낸다 — 고쳐서 살리지 않는다", () => {
    const r = normalizeOptionModel([g("Size", ["S", "M"])], [v({ Size: "S" }), v({ Size: "XL" })]);
    expect(r.variants).toHaveLength(1);
    expect(r.variants[0].optionValues).toEqual({ Size: "S" });
  });

  it("optionValues 가 빈 조합도 떨어낸다", () => {
    expect(normalizeOptionModel([g("Size", ["S", "M"])], [v({})]).variants).toHaveLength(0);
  });

  it("축이 없어지면 조합도 함께 비운다 — 가리킬 축이 없다", () => {
    expect(normalizeOptionModel([g("Color", ["Pink"])], [v({ Color: "Pink" })]).variants).toHaveLength(0);
  });
});

describe("🔴 ③ 없는 것을 만들지 않는다", () => {
  it("입력이 비면 출력도 빈다", () => {
    expect(normalizeOptionModel(undefined, undefined)).toEqual({ optionGroups: [], variants: [] });
    expect(normalizeOptionModel([], [])).toEqual({ optionGroups: [], variants: [] });
  });

  it("축만 있고 조합이 없을 때 조합을 «지어내지» 않는다", () => {
    expect(normalizeOptionModel([g("Size", ["S", "M"])], undefined).variants).toHaveLength(0);
  });
});

describe("🔴 ④ 멱등 — 두 번 지나도 같다", () => {
  it("같은 결과가 나온다", () => {
    const once = normalizeOptionModel([g("Size", ["S", "M"])], [v({ Size: "S" })]);
    const twice = normalizeOptionModel(once.optionGroups, once.variants);
    expect(twice).toEqual(once);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   🔴 배선 — 두 쓰기 지점이 «모두» 이 문을 지나는지.
   🔴 mutation T5(배선 제거)가 순수 테스트에 안 잡혔다. 동작으로 잠그려면
      Playwright page 가 필요해 새 harness 가 되므로 소스로 확인하고,
      그 강도 한계를 여기 적어 둔다 — 동작 보장은 위 ①~④ 가 한다.
   ───────────────────────────────────────────────────────────────────────── */
describe("🔴🔴 ⑤ 옵션이 CanonicalProduct 로 가는 길이 «하나» 다", () => {
  const src = (rel: string) =>
    readFileSync(new URL(rel, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it.each([
    ["../universal-extractor.ts", "site-strategy 경로"],
    ["../product-data-extractor.ts", "universal 경로"],
  ])("%s (%s) 가 normalizeOptionModel 을 지난다", (file) => {
    expect(src(file)).toContain("normalizeOptionModel(");
  });

  it("🔴 두 경로 모두 optionGroups 를 «직접» 대입하지 않는다", () => {
    for (const f of ["../universal-extractor.ts", "../product-data-extractor.ts"]) {
      expect(src(f), `${f} 가 문을 건너뛴다`).not.toMatch(
        /optionGroups:\s*(siteResult\.productData\.optionGroups|resolvedOptionGroups)/,
      );
    }
  });

  it("🔴 판정을 복제하지 않는다 — 공용 hasRealOptionAxes 를 쓴다", () => {
    expect(src("../common-option-model.ts")).toContain("hasRealOptionAxes(cleanedGroups)");
    expect(src("../common-option-model.ts")).not.toMatch(/values\.length === 1/);
  });
});
