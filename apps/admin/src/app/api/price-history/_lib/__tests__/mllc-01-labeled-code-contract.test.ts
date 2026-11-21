import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { productFactsFromListing } from "@commerce/crawler/src/comparison-search/seller-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MLLC-01 STEP D — **라벨 전용 품번 복구의 «경계» 를 잠근다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 부분 해제 범위(2026-11-21)는 **한 줄** 이다 —
 *    `productFactsFromListing` 의 `brandModelCode` 를
 *    `extractLabeledProductCode(input.description) ?? null` 로 채운다.
 *
 * 🔴 **명시적 제외 범위**(CPO §2 · 이 파일이 그것을 지킨다):
 * ```
 * slug 폴백 금지 · 판매처 SKU 금지 · 라벨 없는 코드 금지 · 일반 숫자열 금지 ·
 * materialText/fitText/ageRangeText/sizeLabels 불변 · raw description → comparator 금지 ·
 * 브랜드 점수·등록부·alias 불변 · 임계값·blocker·가격 적격성 불변
 * ```
 * 🔴 **순효과 측정은 이 파일이 아니다** — 반사실은
 *    `mllc-01-labeled-code-counterfactual.test.ts`(분모 109 · 확인 배선 포함)가 들고 있다.
 */

const SRC = path.join(
  __dirname, "..", "..", "..", "..", "..", "..", "..", "..",
  "packages", "crawler", "src", "comparison-search", "seller-facts.ts",
);
/** 🔴 주석을 벗기고 본다 — 주석의 낱말을 코드로 읽지 않는다(이 트랙의 함정). */
const bareSource = (): string =>
  readFileSync(SRC, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/[^\n]*$/gm, " ");

const listing = (input: Parameters<typeof productFactsFromListing>[0]) =>
  productFactsFromListing(input);

const BASE = { title: "Hug Hairy Monster T-Shirt by Bobo Choses", url: "https://x.test/products/a" };

describe("MLLC-01 D — 라벨 있는 설명에서 품번을 복구한다", () => {
  it("D-1 🟢 라벨 뒤의 값을 읽는다 — 실측 모양(`Product code B226AC009 AW26`)", () => {
    const f = listing({
      ...BASE,
      description: "Relaxed fit tee. 100% Organic Cotton. Product code B226AC009 AW26 Made in Portugal.",
    });
    expect(f.brandModelCode).toBe("B226AC009");
  });

  it("D-2 🟢 Bobo 모양이 «아닌» 품번도 읽는다 — 운영 복구기가 못 읽는 그 공백(실측)", () => {
    for (const [desc, code] of [
      ["Double Deerstalker Cap by Wynken. Product code WK21A165", "WK21A165"],
      ["Sweatshirt. Article code AW26MS185", "AW26MS185"],
      ["Jacket. Product code BJ87", "BJ87"],
      ["Trousers. Product code SS25-250", "SS25-250"],
    ] as const) {
      expect(listing({ ...BASE, description: desc }).brandModelCode).toBe(code);
    }
  });

  it("D-3 🔴 라벨이 없으면 **null 을 유지** 한다 — 모양만으로 승격하지 않는다", () => {
    expect(listing({ ...BASE, description: "Relaxed fit tee B226AC009 made in Portugal." }).brandModelCode)
      .toBeNull();
  });

  it("D-4 🔴 설명이 없으면 null 이다(기존 동작 불변)", () => {
    expect(listing({ ...BASE }).brandModelCode).toBeNull();
    expect(listing({ ...BASE, description: null }).brandModelCode).toBeNull();
  });

  it("D-5 🔴 복수의 «서로 다른» 라벨 코드면 null — 기존 Contract M 그대로", () => {
    expect(
      listing({ ...BASE, description: "Product code B226AC009. Article code B226AC033." }).brandModelCode,
    ).toBeNull();
  });

  it("D-6 🟢 같은 값이 반복되면 그 값을 쓴다(Contract M 은 «다른 값» 을 막는다)", () => {
    expect(
      listing({ ...BASE, description: "Product code B226AC009. Model code B226AC009." }).brandModelCode,
    ).toBe("B226AC009");
  });

  it("D-7 🔴🔴 통화 꼬리표는 품번이 아니다 — 가격 숫자 오인 추출 방지", () => {
    for (const d of ["Model code 88000 won", "상품코드 88000원", "Product code 88000₩"]) {
      expect(listing({ ...BASE, description: d }).brandModelCode).toBeNull();
    }
  });

  it("D-8 🔴🔴 **판매처 SKU 가 품번으로 가지 않는다** — 칸이 서로 다르다", () => {
    const f = listing({ ...BASE, sellerSku: "76A7D-320-01", description: "No labelled code here." });
    expect(f.sellerSku).toBe("76A7D-320-01");
    expect(f.brandModelCode).toBeNull();
  });

  it("D-9 🔴🔴 **slug 폴백이 없다** — URL 앞머리를 품번으로 쓰지 않는다", () => {
    const f = listing({
      title: "Bolder Half Zipped Sweatshirt",
      url: "https://x.test/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt",
      description: "No labelled code here.",
    });
    expect(f.brandModelCode).toBeNull();
    /** 🔴 소스 단언 — 금지 토큰은 **런타임 조립**(내 목록이 내 파일을 잡는 함정 방지). */
    const body = bareSource();
    const start = body.indexOf("export function productFactsFromListing");
    const seg = body.slice(start, body.indexOf("\n}", start));
    for (const banned of [
      ["extractCodeLike", "SlugSegment"].join(""),
      ["extractCodeLike", "TitleToken"].join(""),
      "brandModelCode: input.sellerSku",
    ]) {
      expect(seg, `🔴 ${banned} 가 들어왔다 — MLLC-01 이 제외한 범위다`).not.toContain(banned);
    }
  });
});

describe("MLLC-01 D — 해제 범위 밖은 한 글자도 바뀌지 않았다", () => {
  it("D-10 🔴 CPO 가 유지한 네 칸은 여전히 비어 있다", () => {
    const f = listing({
      ...BASE,
      description: "Loose fit. 100% Organic Cotton. Sizes 2-3Y 4-5Y. Product code B226AC009",
    });
    expect(f.materialText).toBeNull();
    expect(f.fitText).toBeNull();
    expect(f.ageRangeText).toBeNull();
    expect(f.sizeLabels).toEqual([]);
  });

  it("D-11 🟢 `description` 칸은 그대로 담긴다(Evidence Layer · Contract P2 불변)", () => {
    const d = "Product code B226AC009 AW26";
    expect(listing({ ...BASE, description: d }).description).toBe(d);
  });

  it("D-12 🔴 원상품 경로(Shopify 팩토리)의 slug 폴백은 **유지** 된다 — 좁히지 않았다", () => {
    const body = bareSource();
    const shopifyAt = body.indexOf("export function productFactsFromShopifyProduct");
    const seg = body.slice(shopifyAt, body.indexOf("\n}", shopifyAt));
    expect(seg).toContain(["extractCodeLike", "SlugSegment"].join(""));
  });
});
