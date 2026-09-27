import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-11 — **상품코드 ≠ 모델명 ≠ 채널 발급 번호**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 대상 상품의 원본 코드는 `B126AC096 SS26` 이다. CEO 가 못을 박았다:
 * 「임의로 상품코드/모델번호/고유번호를 같은 것으로 취급하지 않는다」.
 *
 * 실측으로 셋이 어디로 가는지 갈랐다.
 *
 *   sku(상품코드)   네이버 sellerManagementCode(판매자상품코드)
 *                   롯데ON eitmNo(업체단품번호)
 *                   쿠팡  externalVendorSku
 *   modelName       네이버 고시 modelName · 네이버쇼핑 검색정보
 *                   🔴 쿠팡·롯데ON payload 에는 «없다»
 *   채널 발급 번호   롯데ON epdNo/spdNo — 우리가 만들거나 sku 로 대신할 수 없다
 *
 * 🔴 그래서 「sku 를 모델명으로 쓴다」는 금지다. 같은 값이 우연히 맞는 브랜드가
 * 있어도 개념이 다르고, 틀리는 브랜드에서는 조용히 잘못된 고시가 나간다.
 */

const SRC = (...p: string[]) => readFileSync(join(__dirname, "..", ...p), "utf8").replace(/\r\n/g, "\n");

describe("① 상품코드는 세 채널 «모두» 에 도착한다", () => {
  /* 🔴 여기가 이번에 고친 곳이다. 쿠팡만 `variant?.sku` 하나만 봐서 옵션 없는
     단품에서는 상품코드가 통째로 빠졌다 — 바로 아래 재고는 이미 상품 값으로
     폴백하는데 이 줄만 빠져 있었다. */
  it("쿠팡 — 단품이면 상품의 sku 로 폴백한다", () => {
    const code = SRC("coupang", "build-payload.ts");
    expect(code).toContain("externalVendorSku: variant?.sku ?? (product.sku.value.trim() || undefined)");
  });

  it("스마트스토어 — 판매자상품코드로 간다", () => {
    expect(SRC("naver", "build-payload.ts")).toContain("sellerManagementCode: product.sku.value || undefined");
  });

  it("롯데ON — 업체단품번호로 간다", () => {
    expect(SRC("lotteon", "build-payload.ts")).toContain("eitmNo: product.sku.value.trim()");
  });
});

describe("② 🔴 sku 를 «모델명» 으로 옮기지 않는다", () => {
  /* 개념이 다르다. 모델명은 고시 항목이고 셀러가 확인해 적는 값이다. */
  it.each([
    ["쿠팡", ["coupang", "build-payload.ts"]],
    ["스마트스토어", ["naver", "build-payload.ts"]],
    ["롯데ON", ["lotteon", "build-payload.ts"]],
  ] as const)("%s 가 sku 를 modelName 에 대입하지 않는다", (_label, path) => {
    const code = SRC(...path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/modelName[^\n]*product\.sku/);
    expect(code).not.toMatch(/sku[^\n]*product\.modelName/);
  });
});

describe("③ 채널이 «발급» 하는 번호를 우리가 만들지 않는다", () => {
  it("롯데ON 업체상품번호(epdNo)는 sku 에서 오지 않는다", () => {
    const code = SRC("lotteon", "build-payload.ts").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/epdNo[^\n]*product\.sku/);
  });
});
