// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildProductIdentityDna } from "@commerce/shared";
import { BRAND_MODEL_CODE_LABEL, SourceDataView } from "../SourceDataView";
import { makeProduct } from "./product-tab-composition";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-150 STEP 6 — **「브랜드 품번」은 MI 가 쓰는 그 값이어야 한다**
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CEO 지적(2026-10-22): 「Source Data 에 SKU 가 없다」.
 * 🔴 실측 결과 **데이터가 사라진 것이 아니었다** — 두 값이 다른 것이었다:
 * ```
 * product.sku.value    ""            판매처 자신의 재고번호(해당 상품엔 없다)
 * brandModelCode       "B226AC009"   🟢 브랜드 품번 — **살아 있었고 MI 가 쓰고 있었다**
 * ```
 * 🔴 그래서 고친 것은 **표시 하나** 다(추출·판정·검색·가격 변경 **0**).
 *
 * ── 🔴 이 파일이 막는 회귀 ───────────────────────────────────────────────────
 * ```
 * ⒜ 그 줄이 사라진다                      → FAIL
 * ⒝ 화면이 **MI 와 다른 값** 을 보여준다   → FAIL  ← 가장 중요하다
 * ⒞ 셀러가 고칠 수 있는 입력칸이 된다       → FAIL (파생값이다)
 * ```
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const noop = () => {};

async function render(product = makeProduct()): Promise<void> {
  await act(async () => {
    root.render(
      createElement(SourceDataView, {
        product,
        onUpdateField: noop,
        onUpdatePrice: noop,
        onUpdateKeywords: noop,
        onUpdateVariant: noop,
        exchangeRates: null,
      } as never),
    );
  });
}

/** 「브랜드 품번」 줄(라벨 셀 → 그 행 전체). */
function brandCodeRow(): HTMLTableRowElement {
  const cell = Array.from(container.querySelectorAll("td")).find(
    (td) => (td.textContent ?? "").trim() === BRAND_MODEL_CODE_LABEL,
  );
  if (!cell) throw new Error(`「Source Data」에 '${BRAND_MODEL_CODE_LABEL}' 줄이 없다`);
  return cell.closest("tr") as HTMLTableRowElement;
}

describe("WU-150 STEP 6 — Source Data 「브랜드 품번」", () => {
  it("🟢 A-1 그 줄이 화면에 선다", async () => {
    await render();
    expect(brandCodeRow().textContent ?? "").toContain(BRAND_MODEL_CODE_LABEL);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 **이 단언이 이 파일의 핵심이다 — 그리고 1차에 «뚫렸다».**
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 1차에는 `makeProduct()` 를 그대로 썼다. 그 fixture 는
   *    `sku === brandModelCode === "B226AC043"` 이라 **두 값이 같다** ⟹ 화면이
   *    `product.sku` 를 보여주도록 바꾸는 변이(M9)가 **그대로 통과** 했다.
   *    🔴 「기대값과 구현이 같은 자리에서 온다」 계열의 동어반복이다.
   * 🟢 그래서 **두 값이 갈리는 실제 모양** 으로 바꿨다 — CEO 가 보고 있는 그 상품이다:
   * ```
   * sku            ""             ← Shopify variant sku 가 없다(실측)
   * sourceUrl      …/products/b226ac009-hug-hairy-monster-t-shirt
   * brandModelCode "B226AC009"    ← URL/제목에서 파생된다
   * ```
   * 🔴 기대값을 **구현 상수에서 가져오지 않는다** — owner 함수를 **직접 불러** 비교한다.
   */
  it("🔴🔴 A-2 화면의 값 == MI 가 쓰는 `brandModelCode`(sku 와 «다른» 값으로 검증)", async () => {
    const base = makeProduct();
    const product = {
      ...base,
      sku: { ...base.sku, value: "" },
      title: { ...base.title, value: "Hug Hairy Monster T-shirt" },
      sourceUrl: "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
    } as typeof base;

    const expected = buildProductIdentityDna(product).brandModelCode;
    expect(expected, "이 fixture 에 품번이 없으면 이 계약이 공허해진다").toBeTruthy();
    /** 🔴 **두 값이 실제로 갈려 있어야** 이 계약이 뜻을 갖는다. */
    expect(String(expected)).not.toBe(product.sku.value);

    await render(product);
    const shown = brandCodeRow().textContent ?? "";
    expect(shown).toContain(String(expected));
    /** 🔴 그리고 **「확인되지 않음」이 아니어야** 한다(sku 를 보여주면 빈 값이 된다). */
    expect(shown).not.toContain("확인되지 않음");
  });

  /** 🔴 파생값이라 셀러가 고치지 않는다 — 입력칸이 생기면 「원본 사실」과 섞인다. */
  it("🔴 A-3 읽기 전용이다(입력칸·textarea 0)", async () => {
    await render();
    const row = brandCodeRow();
    expect(row.querySelectorAll("input")).toHaveLength(0);
    expect(row.querySelectorAll("textarea")).toHaveLength(0);
  });

  /** 🟢 SKU 와 **다른 줄** 이고 **다른 이름** 이다(둘을 같은 값으로 읽지 않게). */
  it("🟢 A-4 SKU 와 분리돼 있고 자기 도착지를 말한다", async () => {
    await render();
    expect(BRAND_MODEL_CODE_LABEL).not.toBe("SKU");
    expect(brandCodeRow().textContent ?? "").toContain("동일상품을 찾을 때 쓰는 기준");
    /** SKU 줄은 그대로 살아 있다(교체가 아니라 추가다). */
    expect(
      Array.from(container.querySelectorAll("td")).some((td) => (td.textContent ?? "").trim() === "SKU"),
      "SKU 줄이 사라졌다",
    ).toBe(true);
  });

  /**
   * 🔴 품번을 **지어내지 않는다** — owner 가 못 찾으면 화면도 「확인되지 않음」이라
   *    말한다(이 저장소의 「모르면 채우지 않는다」 원칙).
   */
  it("🔴 A-5 품번이 없으면 「확인되지 않음」이라고 말한다", async () => {
    const blank = makeProduct();
    const stripped = {
      ...blank,
      title: { ...blank.title, value: "플레인 티셔츠" },
      sku: { ...blank.sku, value: "" },
      sourceUrl: "https://example.com/products/plain-tee",
    } as typeof blank;
    expect(buildProductIdentityDna(stripped).brandModelCode ?? null).toBeNull();
    await render(stripped);
    expect(brandCodeRow().textContent ?? "").toContain("확인되지 않음");
  });
});
