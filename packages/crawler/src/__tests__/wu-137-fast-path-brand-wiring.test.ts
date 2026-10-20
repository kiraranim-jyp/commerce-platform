import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-137 — **빠른 경로가 브랜드 복구 칸을 버리지 않는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **이 계약이 생긴 이유 — WU-134 가 운영에서 발화하지 않았다.**
 * ```
 * WU-134 는 shopifySiteStrategy 가 `siteBrandName` 을 채우고
 * canonical-product 가 그것으로 거부된 브랜드(vendor "AW26")를 복구하게 만들었다.
 * 🔴 그런데 `universalExtract` 의 **빠른 경로**(`tryFastPath`)가 productData 를
 *    칸 하나씩 손으로 옮기면서 그 칸을 빠뜨렸다 ⟹ 운영 「새 상품 분석」
 *    (`/api/pipeline` → universalExtract)에서 복구가 **한 번도 돌지 않았다.**
 * 🔴 실측: WU-134 배포(18:24 KST) 뒤 20시 스냅샷도 brand="" · B226AC009 16/16 전건.
 * 🔴🔴 WU-134 의 라이브 테스트가 `shopifySiteStrategy.extract` 를 **직접** 불러
 *    「전략은 채운다」까지만 증명했다 — **WU-110 이 기록한 그 함정의 재발** 이다.
 * ```
 * 🟢 그래서 이 계약은 **「전략이 채운다」가 아니라 「경로가 옮긴다」** 를 단언한다.
 * 🔴 네트워크 0.
 */

const SRC = readFileSync(path.join(__dirname, "..", "universal-extractor.ts"), "utf8");
/** 🔴 주석을 벗긴다 — 주석에 적힌 칸 이름을 배선으로 읽으면 가드가 거짓 통과한다(헌장 §5). */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/** 🔴 좌표를 추측하지 않는다 — 그 함수 본문만 자른다. */
function fastPathBody(src: string): string {
  const start = src.indexOf("async function tryFastPath");
  expect(start).toBeGreaterThan(-1);
  const at = src.indexOf("const productData: ExtractedProductData = {", start);
  expect(at).toBeGreaterThan(-1);
  const end = src.indexOf("return {", at);
  expect(end).toBeGreaterThan(at);
  return src.slice(at, end);
}

describe("WU-137 — tryFastPath 가 brand 복구 칸을 옮긴다", () => {
  it("🔴🔴 A-1 `siteBrandName` 을 **그 리터럴 안에서** 옮긴다", () => {
    const body = fastPathBody(CODE);
    expect(body).toContain("siteBrandName: siteResult.productData.siteBrandName");
  });

  it("🔴 A-2 브랜드를 **여기서 정하지 않는다** — 복구 판단은 canonical-product 소관이다", () => {
    const body = fastPathBody(CODE);
    /** 🔴 이 경로에 브랜드 규칙 어휘가 들어오면 owner 가 둘이 된다. */
    for (const forbidden of ["resolveBrandName", "extractSiteBrandName", "og:site_name", "Organization"]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it("🔴🔴 A-3 그 리터럴이 전략 결과를 «손으로» 옮기는 모양임을 고정한다", () => {
    /**
     * 🔴 이 함수의 위험은 **「칸을 추가했는데 여기를 안 고치는 것」** 이다. 그래서
     *    새 칸이 생길 때 **반드시 보게 되는** 축을 단언한다 — 전략이 채우는 칸 전수가
     *    여기에도 있어야 한다. 🟢 실제로 이번 버그가 정확히 그 모양이었다.
     */
    const body = fastPathBody(CODE);
    for (const field of ["title", "brand", "siteBrandName", "price", "sku", "description", "material"]) {
      expect(body, field).toContain(`${field}: siteResult.productData.${field}`);
    }
  });

  it("🟢 A-4 느린 경로는 추출기를 그대로 쓴다 — 칸을 손으로 옮기지 않는다", () => {
    /** 🟢 그래서 그 경로에는 이 버그가 **없었다**(Shopify 만 빠른 경로를 탄다). */
    expect(CODE).toContain("extractProductData(html, page)");
  });

  it("🔴 A-5 `ExtractedProductData` 에 그 칸이 선언돼 있다", () => {
    const ext = readFileSync(path.join(__dirname, "..", "product-data-extractor.ts"), "utf8");
    expect(ext).toMatch(/siteBrandName\?:\s*string/);
  });
});
