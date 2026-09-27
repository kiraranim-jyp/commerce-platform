import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { payloadStockQuantity, resolveSourceStock } from "@commerce/shared";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-17 — **999 가 재고로 «되살아나지» 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 실화면: 옵션이 0·0·3·0·0 인데 전체 재고가 **999** 로 떠 있었다.
 * 999 는 파이프라인이 넣은 「모른다」의 표시이지 재고가 아니다.
 *
 * C-2E 가 해석(`resolveSourceStock`)을 한 곳에 모았는데, payload 쪽에 그 해석을
 * «거치지 않는» 경로가 넷 남아 있었다 — 그래서 화면과 등록이 갈라졌다.
 *
 *     쿠팡 단품      maximumBuyCount: variant?.stockQuantity ?? product…value
 *     롯데ON         defaultStock = product…value ?? 0
 *     스마트스토어   build-payload(구형 경로) stockQuantity: product…value
 *
 * 🔴 전부 공용 해석으로 돌렸다. 「옵션 실측이 있으면 그 합계」가 유일한 답이다.
 */

const field = <T,>(value: T, source = "ORIGINAL") => ({ value, source, confidence: 1 }) as never;

/** CEO 화면 그대로 — 4-5:0 · 6-7:0 · 8-9:3 · 10-11:0 · 12-13:0 */
function ceoScreenProduct(): CanonicalProduct {
  return {
    stockQuantity: field(999, "DEFAULT"),
    variants: [
      { id: "v1", optionValues: { Size: "4-5 Years" }, stockQuantity: 0 },
      { id: "v2", optionValues: { Size: "6-7 Years" }, stockQuantity: 0 },
      { id: "v3", optionValues: { Size: "8-9 Years" }, stockQuantity: 3 },
      { id: "v4", optionValues: { Size: "10-11 Years" }, stockQuantity: 0 },
      { id: "v5", optionValues: { Size: "12-13 Years" }, stockQuantity: 0 },
    ],
  } as unknown as CanonicalProduct;
}

describe("① 🔴 CEO 화면의 그 상품 — 전체 재고는 999 가 아니라 «3» 이다", () => {
  it("옵션 실측의 합계가 전체 재고다", () => {
    const fact = resolveSourceStock(ceoScreenProduct());
    expect(fact.state).toBe("IN_STOCK");
    expect(fact.quantity).toBe(3);
    expect(fact.from).toBe("VARIANTS");
  });

  it("payload 에도 3 이 실린다 — 999 가 아니다", () => {
    expect(payloadStockQuantity(ceoScreenProduct())).toBe(3);
  });
});

describe("② 999 가 payload 로 «되살아나는» 경로가 없다", () => {
  const SRC = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8").replace(/\r\n/g, "\n");

  /* 🔴 채널이 product.stockQuantity.value 를 «직접» 실으면 그 순간 999 가 나간다.
     주석에는 그 이름이 설명으로 나오므로 코드만 본다. */
  it.each([
    ["쿠팡", ["coupang", "build-payload.ts"]],
    ["롯데ON", ["lotteon", "build-payload.ts"]],
    ["스마트스토어", ["naver", "build-payload.ts"]],
    ["스마트스토어(구형)", ["smartstore", "build-payload.ts"]],
  ] as const)("%s 가 상품 재고를 «직접» 싣지 않는다", (_label, path) => {
    const code = SRC(...path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    /* 옵션 레벨(variant.stockQuantity ?? product…)은 «옵션» 값이 먼저이므로
       허용된다 — 옵션이 자기 재고를 말하는 것은 사실이다. 금지하는 것은
       «상품 전체» 자리에 product…value 를 그대로 놓는 것이다. */
    const topLevel = code.match(/^\s{4}stockQuantity: product\.stockQuantity\.value/m);
    expect(topLevel, "상품 전체 재고에 999 가 그대로 실린다").toBeNull();
    expect(code).not.toMatch(/maximumBuyCount:[^\n]*\?\?\s*product\.stockQuantity\.value/);
    expect(code).not.toMatch(/defaultStock\s*=\s*product\.stockQuantity\.value/);
  });
});

describe("③ 재고 정책 넷이 그대로다", () => {
  it("실측 0 은 OUT_OF_STOCK — 등록을 막는다", () => {
    const p = { stockQuantity: field(0, "ORIGINAL"), variants: [] } as unknown as CanonicalProduct;
    expect(resolveSourceStock(p).state).toBe("OUT_OF_STOCK");
  });

  it("🔴 999/DEFAULT 는 UNKNOWN — 막지 않는다", () => {
    const p = { stockQuantity: field(999, "DEFAULT"), variants: [] } as unknown as CanonicalProduct;
    expect(resolveSourceStock(p).state).toBe("UNKNOWN");
  });

  it("음수는 INVALID", () => {
    const p = { stockQuantity: field(-1, "ORIGINAL"), variants: [] } as unknown as CanonicalProduct;
    expect(resolveSourceStock(p).state).toBe("INVALID");
  });
});
