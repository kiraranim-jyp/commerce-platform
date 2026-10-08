import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SMALLABLE_SIZE_LISTBOX_SELECTOR,
  parseSmallableSizeRow,
  smallableRowsToOptions,
} from "../smallable-size-options";

/**
 * P5.5-B — Smallable 사이즈 옵션. 🔴 fixture 는 «실측 그대로» 다.
 *   Dalila 434530  6행 · Tender 434534  5행 · NB 530 428894  13행 · GiftCard 0행
 */
const DALILA = ["2 years Only a few left", "3 years Only a few left", "4 years In stock",
  "6 years In stock", "8 years Only a few left", "10 years Last item in stock"];
const TENDER = ["2 years Only a few left", "3 years In stock", "4 years In stock",
  "6 years In stock", "8 years In stock"];
const NB = ["23EU Last item in stock", "24EU Only a few left", "25EU Only a few left",
  "26EU In stock", "27,5EU In stock", "28EU Last item in stock", "29EU Only a few left",
  "30EU Only a few left", "31EU Only a few left", "32EU Last item in stock",
  "33EU In stock", "34EU In stock", "35EU In stock"];
const rows = (a: string[]) => a.map(parseSmallableSizeRow).filter((r) => r !== null) as NonNullable<ReturnType<typeof parseSmallableSizeRow>>[];

describe("🔴 ① 실측 상품별 사이즈 수", () => {
  it("Dalila → 6", () => expect(smallableRowsToOptions(rows(DALILA))!.optionGroups[0].values)
    .toEqual(["2 years", "3 years", "4 years", "6 years", "8 years", "10 years"]));
  it("Tender → 5", () => expect(smallableRowsToOptions(rows(TENDER))!.variants).toHaveLength(5));
  it("New Balance → 13 (EU 체계·소수점 포함)", () => {
    const o = smallableRowsToOptions(rows(NB))!;
    expect(o.variants).toHaveLength(13);
    expect(o.optionGroups[0].values).toContain("27,5EU");
  });
  it("GiftCard → 행 0 이면 옵션 없음", () => expect(smallableRowsToOptions([])).toBeNull());
});

describe("🔴🔴 ② 재고는 «상태» 다 — 수량으로 바꾸지 않는다", () => {
  it("세 문구가 원문 그대로 남는다", () => {
    const r = rows(DALILA);
    expect(r[0].stockStatus).toBe("Only a few left");
    expect(r[2].stockStatus).toBe("In stock");
    expect(r[5].stockStatus).toBe("Last item in stock");
  });
  it("🔴 「Last item in stock」이 「In stock」으로 먼저 갈리지 않는다 — 사이즈 오염", () => {
    const p = parseSmallableSizeRow("10 years Last item in stock")!;
    expect(p.size).toBe("10 years");
    expect(p.size).not.toContain("Last");
  });
  it("🔴 숫자 수량이 생기지 않는다", () => {
    for (const r of rows(DALILA)) expect(r).not.toHaveProperty("stockQuantity");
  });
});

describe("🔴🔴 ③ variant ID / SKU 를 지어내지 않는다", () => {
  it("sku 칸이 «아예 없다»", () => {
    for (const v of smallableRowsToOptions(rows(DALILA))!.variants) {
      expect(v.sku).toBeUndefined();
      expect(v.optionValues).toEqual({ 사이즈: v.id });
    }
  });
});

describe("🔴🔴 ④ 오염이 들어오지 않는다", () => {
  it("재고 문구가 없는 텍스트는 «행이 아니다» — 내비/추천 배제", () => {
    for (const t of ["Gifts 2-4 years", "3/6 years", "Size guide", "2 years"]) {
      expect(parseSmallableSizeRow(t), t).toBeNull();
    }
  });
  it("🔴 ProductColorPicker 링크 텍스트가 사이즈가 되지 않는다", () => {
    expect(parseSmallableSizeRow("Burgundy")).toBeNull();
    expect(parseSmallableSizeRow("Pale blue")).toBeNull();
  });
  it("값이 중복이면 만들지 않는다", () =>
    expect(smallableRowsToOptions(rows(["2 years In stock", "2 years In stock"]))).toBeNull());
  it("1개뿐이면 만들지 않는다 — 고를 것이 없다", () =>
    expect(smallableRowsToOptions(rows(["2 years In stock"]))).toBeNull());
});

describe("🔴🔴 ⑤ 선택자는 해시에 의존하지 않는다", () => {
  it("role 과 aria 를 «함께» 요구한다 — 기프트카드 금액 listbox 배제", () => {
    expect(SMALLABLE_SIZE_LISTBOX_SELECTOR).toContain('[role="listbox"]');
    expect(SMALLABLE_SIZE_LISTBOX_SELECTOR).toContain("productSize");
  });
  it("🔴 CSS Module 해시가 선택자에 없다", () => {
    expect(SMALLABLE_SIZE_LISTBOX_SELECTOR).not.toMatch(/_{2,3}[A-Za-z0-9]{5,8}/);
  });
});

/* ─────────────────────────────────────────────────────────────────────────
   🔴 아래 둘은 DOM/배선 동작이라 «순수 테스트가 못 닿는다»(mutation P2·P7 이
   통과한 자리). Playwright page 마운트는 새 harness 라 하지 않고, 소스로
   잠근다 — 보장 범위가 약하다는 것을 숨기지 않고 적어 둔다.
   ───────────────────────────────────────────────────────────────────────── */
describe("🔴 ⑥ DOM·배선 경계 (소스 단언 — 강도 한계 명시)", () => {
  const src = (rel: string) =>
    readFileSync(new URL(rel, import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("🔴 listbox 가 «정확히 1개» 일 때만 읽는다 — 다축이면 만들지 않는다", () => {
    expect(src("../smallable-size-options.ts")).toContain("boxes.length !== 1");
  });

  it("🔴🔴 fallback 이 기존 네 경로를 «덮지 않는다» — 전부 빈 경우에만 돈다", () => {
    const s = src("../product-data-extractor.ts");
    const at = s.indexOf("extractSmallableSizeOptions(page)");
    expect(at).toBeGreaterThan(-1);
    const guard = s.slice(Math.max(0, at - 420), at);
    for (const cond of [
      "!productGroupOptions",
      "domOptionGroups.length === 0",
      "!offerOptions",
      "textOptionGroups.length === 0",
    ]) {
      expect(guard, `가드에 ${cond} 가 없다 — 기존 경로를 덮을 수 있다`).toContain(cond);
    }
  });

  it("🔴 variants 사다리에서도 «마지막» 이다", () => {
    expect(src("../product-data-extractor.ts")).toContain(
      "productGroupOptions?.variants ?? offerOptions?.variants ?? smallableOptions?.variants",
    );
  });
});
