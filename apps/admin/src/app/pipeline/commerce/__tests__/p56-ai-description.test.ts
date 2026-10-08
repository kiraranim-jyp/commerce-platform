import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mockProductContentProvider } from "@commerce/content";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 Phase 5(CPO 승인, 2026-10-09) — **AI 상세설명은 원문만 말한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 고친 결함 둘:
 *   ① `product.options` 는 deprecated — 옵션 «이름» 만 들어 있어 "옵션: Size"
 *      처럼 값 없는 줄이 나갔다. 실제 선택지는 optionGroups 에 있다.
 *   ② 색상이 빠져 있었다(product.color 에 원문 값이 있는데 쓰지 않았다).
 *
 * 🔴 가장 중요한 단언은 ③ 이다 — **원문에 없는 것을 만들지 않는다.**
 */
const f = <T>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });

function product(over: Partial<CanonicalProduct> = {}): CanonicalProduct {
  return {
    title: f("Dalila Reversible Fur Coat"),
    brand: f("Louise Misha"),
    color: f("Framboise"),
    material: f(""),
    description: f(""),
    options: f([] as string[]),
    optionGroups: [],
    variants: [],
    ...(over as object),
  } as unknown as CanonicalProduct;
}

describe("🔴 ① 실제 옵션 «값» 이 들어간다 (deprecated 이름만이 아니라)", () => {
  it("실측 Dalila — 사이즈 6개가 그대로 나온다", () => {
    const got = mockProductContentProvider.generateDescription(
      product({ optionGroups: [{ name: "사이즈", values: ["2 years", "3 years", "4 years", "6 years", "8 years", "10 years"] }] }),
    );
    expect(got.value).toContain("사이즈: 2 years, 3 years, 4 years, 6 years, 8 years, 10 years");
  });

  it("🔴 값이 없는 축은 넣지 않는다 — 셀러에게 줄 정보가 없다", () => {
    const got = mockProductContentProvider.generateDescription(
      product({ optionGroups: [{ name: "사이즈", values: [] }] }),
    );
    expect(got.value).not.toContain("사이즈");
  });

  it("구형 데이터(optionGroups 없음)는 이름이라도 남긴다 — 회귀", () => {
    const got = mockProductContentProvider.generateDescription(product({ options: f(["Size"]) }));
    expect(got.value).toContain("옵션: Size");
  });
});

describe("🔴 ② 색상이 들어간다", () => {
  it("원문 색상을 그대로 적는다", () => {
    expect(mockProductContentProvider.generateDescription(product()).value).toContain("색상: Framboise");
  });
  it("색상이 비면 그 줄이 없다", () => {
    expect(mockProductContentProvider.generateDescription(product({ color: f("") })).value).not.toContain("색상");
  });
});

describe("🔴🔴 ③ 없는 사실을 만들지 않는다", () => {
  /* 🔴 상품명에서 추론한 「상품 종류」도 «원문 근거» 다(제목이 입력이다).
     그래서 「근거가 전부 없다」를 재려면 제목까지 비워야 한다 —
     처음에 제목을 남겨 두고 빈 문자열을 기대했다가 테스트가 틀렸다. */
  const bare = mockProductContentProvider.generateDescription(
    product({ title: f(""), brand: f(""), color: f(""), material: f(""), description: f(""), options: f([] as string[]) }),
  );

  it("모든 근거가 비면 «빈 문자열» 이다 — 문장을 지어내지 않는다", () => {
    expect(bare.value).toBe("");
    expect(bare.confidence).toBe(0);
  });

  it("🔴 소재가 없는데 소재를 만들지 않는다", () => {
    expect(bare.value).not.toMatch(/cotton|면|울|폴리|소재/i);
  });

  it("🔴 기능·인증·원산지를 만들지 않는다", () => {
    const got = mockProductContentProvider.generateDescription(product({ material: f("") }));
    for (const forbidden of ["방수", "친환경", "프리미엄", "정품", "made in", "제조국", "인증"]) {
      expect(got.value.toLowerCase(), forbidden).not.toContain(forbidden.toLowerCase());
    }
  });

  it("🔴 출력의 «모든 조각» 이 입력에 있던 값이다", () => {
    const got = mockProductContentProvider.generateDescription(
      product({ material: f("Faux fur"), optionGroups: [{ name: "사이즈", values: ["2 years"] }] }),
    );
    for (const token of ["Louise Misha", "Framboise", "Faux fur", "2 years"]) {
      expect(got.value).toContain(token);
    }
    /* 🔴 라벨 외에 «새 명사» 가 섞이지 않았는지 — 길이로 거칠게 가른다. */
    expect(got.value.length).toBeLessThan(260);
  });
});

describe("🔴 ④ deprecated 필드에 의존하지 않는다 (소스 경계)", () => {
  it("optionGroups 를 읽는다", () => {
    const src = readFileSync(
      new URL("../../../../../../../packages/content/src/providers/mock.provider.ts", import.meta.url),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(src).toContain("product.optionGroups");
    expect(src).toContain("product.color");
  });
});
