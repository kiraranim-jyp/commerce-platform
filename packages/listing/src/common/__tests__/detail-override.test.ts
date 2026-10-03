import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultDetailBlocks, resolveDetailBlocks, type DetailPageBlock } from "../../coupang/build-payload";
import {
  detailBlockIdentities,
  detailBlockIdentity,
  isEmptyDetailOverride,
  mergeProductDetailBlocks,
  newCustomTextId,
  resolveProductDetailBlocks,
  type ProductDetailOverride,
} from "../detail-override";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT-INFO-UX-06 — 상품별 상세페이지 override (CEO 확정 2026-10-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 재는 것은 「편집이 되는가」가 아니라 **「편집을 안 했을 때 아무것도 달라지지
 * 않는가」** 다. 그것이 기존 3채널 payload 계약을 지키는 유일한 축이다.
 */
const SELLER_SAVED: DetailPageBlock[] = [
  { id: "seller-0", kind: "COMMON_IMAGE", position: "top", enabled: false },
  { id: "seller-1", kind: "PRODUCT_IMAGES", enabled: true },
  { id: "seller-2", kind: "AI_DESCRIPTION", enabled: true },
  { id: "seller-3", kind: "TEMPLATE_SECTION", section: "shipping", enabled: false },
];

describe("① 🔴 override 가 없으면 «동일 참조» 를 돌려준다 — byte 동일의 구조적 근거", () => {
  for (const [label, empty] of [
    ["undefined", undefined],
    ["null", null],
    ["빈 객체", {}],
    ["빈 맵/배열만 있는 객체", { patches: {}, added: [], order: [] }],
  ] as [string, ProductDetailOverride | null | undefined][]) {
    it(`${label} → 입력 배열 그 자체(참조 동일)`, () => {
      expect(mergeProductDetailBlocks(SELLER_SAVED, empty)).toBe(SELLER_SAVED);
    });
  }

  it("🔴 resolveProductDetailBlocks 가 override 없이 resolveDetailBlocks 와 «완전히 같다»", () => {
    for (const sellerDefault of [SELLER_SAVED, null, undefined, []] as (DetailPageBlock[] | null | undefined)[]) {
      expect(resolveProductDetailBlocks(sellerDefault)).toEqual(resolveDetailBlocks(sellerDefault));
    }
    /* 셀러가 저장한 경우는 참조까지 같다. */
    expect(resolveProductDetailBlocks(SELLER_SAVED)).toBe(SELLER_SAVED);
  });

  it("🔴 빈 껍데기 override 가 남아도 payload 가 달라지지 않는다 — UI 가 켰다 껐다 해도 안전", () => {
    expect(isEmptyDetailOverride({ patches: {}, added: [], order: [] })).toBe(true);
    expect(isEmptyDetailOverride({ patches: { AI_DESCRIPTION: { enabled: false } } })).toBe(false);
  });
});

describe("② 🔴 식별자는 block.id 가 «아니다» (CEO 확정 ⓒ)", () => {
  it("의미/위치로 만든다", () => {
    expect(detailBlockIdentity({ id: "x", kind: "AI_DESCRIPTION", enabled: true })).toBe("AI_DESCRIPTION");
    expect(
      detailBlockIdentity({ id: "x", kind: "TEMPLATE_SECTION", section: "shipping", enabled: true }),
    ).toBe("TEMPLATE_SECTION:shipping");
    expect(detailBlockIdentity({ id: "x", kind: "COMMON_IMAGE", position: "bottom", enabled: true })).toBe(
      "COMMON_IMAGE:bottom",
    );
  });

  it("🔴 id 가 달라도 식별자는 «같다» — defaultDetailBlocks() 의 default-N 재생성을 견딘다", () => {
    const a = detailBlockIdentities(defaultDetailBlocks());
    const b = detailBlockIdentities(defaultDetailBlocks().map((x, i) => ({ ...x, id: `other-${i}` })));
    expect(a).toEqual(b);
    /* 그리고 어떤 식별자에도 블록 id 가 섞여 있지 않다. */
    for (const id of a) expect(id).not.toContain("default-");
  });

  it("🔴 기본 9블록의 식별자가 «모두 달라» 서 patch 가 엉뚱한 블록에 붙지 않는다", () => {
    const ids = detailBlockIdentities(defaultDetailBlocks());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("CUSTOM_TEXT 는 customTextId 로 구분된다", () => {
    expect(
      detailBlockIdentity({ id: "x", kind: "CUSTOM_TEXT", content: "a", enabled: true, customTextId: "ct-7" }),
    ).toBe("CUSTOM_TEXT:ct-7");
  });

  it("🔴 customTextId 가 없는 레거시 CUSTOM_TEXT 는 순서 폴백으로 «서로 구분된다»", () => {
    const legacy: DetailPageBlock[] = [
      { id: "a", kind: "CUSTOM_TEXT", content: "첫째", enabled: true },
      { id: "b", kind: "AI_DESCRIPTION", enabled: true },
      { id: "c", kind: "CUSTOM_TEXT", content: "둘째", enabled: true },
    ];
    expect(detailBlockIdentities(legacy)).toEqual(["CUSTOM_TEXT#0", "AI_DESCRIPTION", "CUSTOM_TEXT#1"]);
  });

  it("🔴 newCustomTextId 는 결정적이다 — Date.now()/random 을 쓰면 byte 동일성을 잴 수 없다", () => {
    expect(newCustomTextId(3)).toBe(newCustomTextId(3));
    expect(newCustomTextId(3)).not.toBe(newCustomTextId(4));
  });
});

describe("③ override 가 있으면 «바꾼 것만» 바뀐다", () => {
  it("enabled patch 가 그 블록에만 적용된다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, {
      patches: { "TEMPLATE_SECTION:shipping": { enabled: true } },
    });
    expect(merged).not.toBe(SELLER_SAVED);
    expect(merged.find((b) => b.kind === "TEMPLATE_SECTION")?.enabled).toBe(true);
    /* 나머지 세 블록은 «같은 객체» 다 — 건드리지 않았다. */
    expect(merged[0]).toBe(SELLER_SAVED[0]);
    expect(merged[1]).toBe(SELLER_SAVED[1]);
    expect(merged[2]).toBe(SELLER_SAVED[2]);
  });

  it("🔴 patch 가 «같은 값» 이면 새 객체를 만들지 않는다 — 무의미한 변경이 payload 를 흔들지 않는다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, {
      patches: { PRODUCT_IMAGES: { enabled: true } }, // 이미 true
      added: [{ id: "n", kind: "CUSTOM_TEXT", content: "x", enabled: true, customTextId: "ct-0" }],
    });
    expect(merged[1]).toBe(SELLER_SAVED[1]);
  });

  it("🔴 「삭제」는 enabled:false 다 — N-4.09 와 같은 규칙, removed 목록이 없다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, { patches: { AI_DESCRIPTION: { enabled: false } } });
    /* 블록이 «사라지지» 않는다 — 다시 켤 수 있어야 한다. */
    expect(merged).toHaveLength(SELLER_SAVED.length);
    expect(merged.find((b) => b.kind === "AI_DESCRIPTION")?.enabled).toBe(false);
    const src = readFileSync(join(__dirname, "../detail-override.ts"), "utf8");
    expect(src).not.toMatch(/^\s*removed\?:/m);
  });

  it("CUSTOM_TEXT 본문을 덮는다", () => {
    const base: DetailPageBlock[] = [
      { id: "a", kind: "CUSTOM_TEXT", content: "원래", enabled: true, customTextId: "ct-0" },
    ];
    const merged = mergeProductDetailBlocks(base, { patches: { "CUSTOM_TEXT:ct-0": { content: "바뀐 안내" } } });
    expect(merged[0]).toMatchObject({ kind: "CUSTOM_TEXT", content: "바뀐 안내", enabled: true });
  });

  it("🔴 content patch 는 CUSTOM_TEXT 가 아닌 블록을 오염시키지 않는다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, { patches: { AI_DESCRIPTION: { content: "침입" } } });
    expect(JSON.stringify(merged)).not.toContain("침입");
    /* 🔴 배열은 새로 만들어지지만(override 가 비어 있지 않으므로) 블록 «객체» 는
       하나도 안 바뀐다 — 그래서 payload 문자열이 같다. */
    expect(merged).toEqual(SELLER_SAVED);
    merged.forEach((b, i) => expect(b).toBe(SELLER_SAVED[i]));
  });

  it("added 블록이 뒤에 붙는다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, {
      added: [{ id: "n", kind: "CUSTOM_TEXT", content: "사이즈 안내", enabled: true, customTextId: "ct-0" }],
    });
    expect(merged).toHaveLength(5);
    expect(merged[4]).toMatchObject({ kind: "CUSTOM_TEXT", content: "사이즈 안내" });
  });

  it("🔴 셀러 기본값과 식별자가 겹치는 added 는 무시된다 — 같은 식별자가 둘이면 patch 가 갈린다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, {
      added: [{ id: "dup", kind: "AI_DESCRIPTION", enabled: true }],
    });
    expect(merged.filter((b) => b.kind === "AI_DESCRIPTION")).toHaveLength(1);
    expect(merged).toEqual(SELLER_SAVED);
    merged.forEach((b, i) => expect(b).toBe(SELLER_SAVED[i]));
  });
});

describe("④ 순서 변경", () => {
  it("order 가 지정한 순서대로 온다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, {
      order: ["AI_DESCRIPTION", "PRODUCT_IMAGES", "TEMPLATE_SECTION:shipping", "COMMON_IMAGE:top"],
    });
    expect(detailBlockIdentities(merged)).toEqual([
      "AI_DESCRIPTION",
      "PRODUCT_IMAGES",
      "TEMPLATE_SECTION:shipping",
      "COMMON_IMAGE:top",
    ]);
  });

  it("🔴 order 에 «없는» 블록도 사라지지 않는다 — 셀러가 설정에 블록을 추가해도 전파된다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, { order: ["AI_DESCRIPTION"] });
    expect(merged).toHaveLength(SELLER_SAVED.length);
    expect(detailBlockIdentities(merged)[0]).toBe("AI_DESCRIPTION");
    /* 나머지는 원래 상대순서를 지킨다. */
    expect(detailBlockIdentities(merged).slice(1)).toEqual([
      "COMMON_IMAGE:top",
      "PRODUCT_IMAGES",
      "TEMPLATE_SECTION:shipping",
    ]);
  });

  it("🔴 order 에 «모르는» 식별자가 있어도 블록이 늘거나 줄지 않는다", () => {
    const merged = mergeProductDetailBlocks(SELLER_SAVED, {
      order: ["없는블록", "AI_DESCRIPTION", "AI_DESCRIPTION"],
    });
    expect(merged).toHaveLength(SELLER_SAVED.length);
    expect(new Set(detailBlockIdentities(merged)).size).toBe(SELLER_SAVED.length);
  });
});

describe("⑤ 🔴 초기화 — override 를 지우면 기존 payload 로 «정확히» 돌아온다", () => {
  it("편집 → 초기화 → 동일 참조", () => {
    const edited = mergeProductDetailBlocks(SELLER_SAVED, {
      patches: { AI_DESCRIPTION: { enabled: false } },
      added: [{ id: "n", kind: "CUSTOM_TEXT", content: "임시", enabled: true, customTextId: "ct-0" }],
      order: ["PRODUCT_IMAGES"],
    });
    expect(edited).not.toEqual(SELLER_SAVED);
    const reset = mergeProductDetailBlocks(SELLER_SAVED, undefined);
    expect(reset).toBe(SELLER_SAVED);
    expect(JSON.stringify(reset)).toBe(JSON.stringify(SELLER_SAVED));
  });
});

describe("⑥ 🔴 resolveDetailBlocks 의 불변을 깨지 않는다", () => {
  it("절대 빈 배열을 돌려주지 않는다 — 빈 배열은 build-payload 의 레거시 하드코딩 경로를 깨운다", () => {
    for (const ov of [
      undefined,
      { order: ["없는것"] },
      { patches: { AI_DESCRIPTION: { enabled: false } } },
      { order: [] as string[], patches: {}, added: [] },
    ] as (ProductDetailOverride | undefined)[]) {
      expect(resolveProductDetailBlocks(null, ov).length).toBeGreaterThan(0);
      expect(resolveProductDetailBlocks(SELLER_SAVED, ov).length).toBeGreaterThan(0);
    }
  });

  it("셀러 기본값이 없으면 코드 상수 9블록 위에 override 가 얹힌다", () => {
    const merged = resolveProductDetailBlocks(null, { patches: { AI_DESCRIPTION: { enabled: false } } });
    expect(merged).toHaveLength(defaultDetailBlocks().length);
    expect(merged.find((b) => b.kind === "AI_DESCRIPTION")?.enabled).toBe(false);
  });
});

describe("⑦ 🔴 입력을 변형하지 않는다 (셀러 설정이 오염되면 다른 상품이 함께 바뀐다)", () => {
  it("merge 후에도 원본 배열과 그 블록들이 그대로다", () => {
    const snapshot = JSON.stringify(SELLER_SAVED);
    mergeProductDetailBlocks(SELLER_SAVED, {
      patches: { AI_DESCRIPTION: { enabled: false }, "COMMON_IMAGE:top": { enabled: true } },
      added: [{ id: "n", kind: "CUSTOM_TEXT", content: "x", enabled: true, customTextId: "ct-0" }],
      order: ["PRODUCT_IMAGES", "AI_DESCRIPTION"],
    });
    expect(JSON.stringify(SELLER_SAVED)).toBe(snapshot);
    expect(SELLER_SAVED).toHaveLength(4);
  });
});
