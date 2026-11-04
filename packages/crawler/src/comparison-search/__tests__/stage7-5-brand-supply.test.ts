import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { productFactsFromShopifyProduct } from "../seller-facts";
import {
  recoverSiteBrandNameIfVendorRejected,
  siteBrandNameIfPageDeclaredBrandRejected,
} from "../product-url-facts";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 7-5 — **브랜드 Evidence 공급**(CPO 승인 · 실행 우선순위 3)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO: 「브랜드 정보의 **공급률을 높이되**, 실제 브랜드 충돌을 무시하지 않습니다.」
 *    ⟹ 🔴 **`BRAND_MISMATCH` 완화 0** · 공백 보충만.
 *
 * 🔴 **먼저 측정했다**(`05845358`) — 「상세설명 BRAND 증거로 메운다」는 회수 **0** 이었다.
 *    🟢 그래서 WU-134 의 회수기(`extractSiteBrandName`)를 **후보 경로에 배선** 했다.
 *
 * 🔴🔴 **발화 조건 셋을 지킨다** — vendor 가 **있고** · **시즌코드로 거부되고** ·
 *    사이트가 자기 이름을 **두 자리에 같이** 적었을 때만.
 *    🔴 ②가 멀티브랜드 편집샵을 **구조적으로 배제** 한다(WU-009 FP 재현 불가).
 */

const shopify = (o: Record<string, unknown>) =>
  productFactsFromShopifyProduct(
    { title: "Hug Hairy Monster T-Shirt", handle: "b226ac009-hug", ...o },
    String(o.domain ?? "bobochoses.co.jp"),
  );

describe("STAGE 7-5 — A. 공식몰 브랜드 공백 회수(도메인 표 확대 0)", () => {
  it("A-1 🟢 vendor 가 시즌코드이고 사이트 이름이 있으면 **그 이름을 쓴다**(C11·C37)", () => {
    const f = shopify({ vendor: "AW26", siteBrandName: "Bobo Choses" });
    expect(f.brand).toBe("Bobo Choses");
  });

  it("A-2 🔴🔴 vendor 가 **없으면** 쓰지 않는다 — 「모르면 채우지 않는다」", () => {
    expect(shopify({ siteBrandName: "Smallable" }).brand).toBeNull();
    expect(shopify({ vendor: "", siteBrandName: "Smallable" }).brand).toBeNull();
  });

  it("A-3 🔴🔴 **거부되지 않은 vendor 가 이긴다** — 편집샵에 사이트 이름이 박히지 않는다", () => {
    /**
     * 🔴 WU-009 실측 — `og:site_name` 을 브랜드로 쓰면 **리테일러 25/26** 에
     *    「Smallable」·「Junior Edition」이 박혀 거짓 일치/거짓 충돌이 난다.
     * 🟢 그 모양이 **구조적으로 불가능** 하다는 것을 여기서 단언한다.
     */
    const f = shopify({ vendor: "Bobo Choses", siteBrandName: "Smallable", domain: "smallable.com" });
    expect(f.brand).toBe("Bobo Choses");
  });

  it("A-4 🟢 기존 도메인 표가 **먼저** 다 — `.com` 의 값이 바뀌지 않는다", () => {
    const f = shopify({ vendor: "AW26", siteBrandName: "Something Else", domain: "bobochoses.com" });
    expect(f.brand).toBe("Bobo Choses");
  });

  it("A-5 🟢 title by절 ∩ vendor 가 **최우선** 이다(기존 ① 불변)", () => {
    const f = productFactsFromShopifyProduct(
      { title: "Booty Ghosts T-Shirt by Bobo Choses", vendor: "Bobo Choses - Last One", siteBrandName: "X" },
      "junioredition.com",
    );
    expect(f.brand).toBe("Bobo Choses");
  });

  it("A-6 🟢 `siteBrandName` 을 안 넘기면 **동작이 한 글자도 바뀌지 않는다**(하위호환)", () => {
    expect(shopify({ vendor: "AW26" }).brand).toBeNull();
    expect(shopify({ vendor: "Main Story" }).brand).toBe("Main Story");
  });

  it("A-7 🔴 공백 문자열은 **값이 아니다**", () => {
    expect(shopify({ vendor: "AW26", siteBrandName: "   " }).brand).toBeNull();
  });
});

describe("STAGE 7-5 — B. PLAIN_HTML 후보 — 추가 HTTP 0 · 같은 조건", () => {
  const SITE = `<meta property="og:site_name" content="Bobo Choses">
    <script type="application/ld+json">{"@type":"Organization","name":"Bobo Choses"}</script>`;

  it("B-1 🔴🔴 브랜드 자리가 **비어 있으면** 회수하지 않는다(편집샵 전부에 박히는 것을 막는다)", () => {
    expect(siteBrandNameIfPageDeclaredBrandRejected(SITE)).toBeNull();
  });

  it("B-2 🟢 브랜드를 **적어 뒀는데** 그 값이 거부되면 사이트 이름을 쓴다", () => {
    const html = `${SITE}<meta property="product:brand" content="AW26">`;
    expect(siteBrandNameIfPageDeclaredBrandRejected(html)).toBe("Bobo Choses");
  });

  it("B-3 🔴 두 자리가 **다르면** `null` 이다 — 한쪽만으로 만들지 않는다", () => {
    const html = `<meta property="og:site_name" content="Bobo Choses">
      <script type="application/ld+json">{"@type":"Organization","name":"Smallable"}</script>
      <meta property="product:brand" content="AW26">`;
    expect(siteBrandNameIfPageDeclaredBrandRejected(html)).toBeNull();
  });
});

describe("STAGE 7-5 — C. 경계 — 불일치 완화 0 · 비용 정직", () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  /**
   * 🔴 이 파일에서는 **주석을 벗기지 않는다** — 정규식 리터럴이 많아 주석 제거기가
   *    코드를 같이 먹었다(1차에 C-5 가 거짓 FAIL 했다). 🟢 대신 **코드에만 나타나는
   *    모양**(뒤에 쉼표가 붙은 속성 줄)으로 단언한다.
   */
  const PUF_RAW = readFileSync(join(__dirname, "..", "product-url-facts.ts"), "utf8");
  const PUF = strip(PUF_RAW);
  const SF = strip(readFileSync(join(__dirname, "..", "seller-facts.ts"), "utf8"));

  it("C-1 🔴 **BRAND_MISMATCH 를 건드리지 않았다**(CPO: 불일치 판정 유지)", () => {
    expect(PUF_RAW).not.toContain("BRAND_MISMATCH");
    expect(SF).not.toContain("BRAND_MISMATCH");
  });

  it("C-2 🔴🔴 **도메인 표를 늘리지 않았다** — 항목은 그대로 하나다", () => {
    const table = SF.slice(SF.indexOf("OFFICIAL_STORE_BRANDS"), SF.indexOf("SEASON_CODE_ONLY_RE"));
    expect(table.split('":').length - 1).toBe(1);
    expect(table).toContain("bobochoses.com");
    expect(table).not.toContain("co.jp");
  });

  it("C-3 🔴 **추가 HTTP 를 숨기지 않는다** — 회수 1회를 httpCalls 에 더한다", () => {
    expect(PUF_RAW).toContain("httpCalls: 1 + siteBrandName.httpCalls,");
  });

  it("C-4 🔴 vendor 가 없거나 거부되지 않으면 **HTTP 를 쓰지 않는다**(게이트가 fetch 앞이다)", () => {
    const fn = PUF_RAW.slice(
      PUF_RAW.indexOf("export async function recoverSiteBrandNameIfVendorRejected"),
      PUF_RAW.indexOf("export function siteBrandNameIfPageDeclaredBrandRejected"),
    );
    expect(fn.indexOf("if (!v) return")).toBeLessThan(fn.indexOf("fetchPlainHtmlWithFinalUrl"));
    expect(fn.indexOf("SEASON_CODE_ONLY_FOR_RECOVERY.test(v)")).toBeLessThan(
      fn.indexOf("fetchPlainHtmlWithFinalUrl"),
    );
  });

  it("C-4b 🔴🔴 **게이트를 «행동» 으로 단언한다** — vendor 가 거부되지 않으면 HTTP 0 이다", async () => {
    /**
     * 🔴🔴 **1차에 Q3(시즌코드 게이트 제거) 변이가 통과했다.** C-4 는 **순서** 만 봤고
     *    그 줄을 **지우면** `indexOf` 가 `-1` 이 되어 「앞에 있다」가 참이 됐다.
     *    ⟹ 🔴 「순서 단언」은 **줄이 삭제되는 변이를 못 잡는다**(이 저장소의 반복 함정).
     * 🟢 그래서 **네트워크 없이** 행동을 단언한다 — 게이트가 살아 있으면 fetch 를
     *    **시도조차 하지 않으므로** `httpCalls` 가 0 이다(게이트를 지우면 1 이 된다).
     */
    const noVendor = await recoverSiteBrandNameIfVendorRejected(undefined, "https://example.com/products/x");
    expect(noVendor).toEqual({ value: null, httpCalls: 0 });
    const realVendor = await recoverSiteBrandNameIfVendorRejected(
      "Bobo Choses",
      "https://example.com/products/x",
    );
    expect(realVendor).toEqual({ value: null, httpCalls: 0 });
  });

  it("C-5 🔴 두 후보 경로 **둘 다** 배선됐다(원상품 경로는 그대로)", () => {
    expect(PUF_RAW).toContain("siteBrandName: siteBrandName.value,");
    expect(PUF_RAW).toContain("?? siteBrandNameIfPageDeclaredBrandRejected(html);");
  });

  it("C-6 🔴 브랜드를 **도메인 문자열에서 만들지 않는다**(wu-080 금지축)", () => {
    const fn = PUF_RAW.slice(
      PUF_RAW.indexOf("export async function recoverSiteBrandNameIfVendorRejected"),
      PUF_RAW.indexOf("export async function factsFromProductUrl"),
    );
    expect(fn).not.toMatch(/hostname|domain\s*\.\s*replace|new URL\(.*hostname/);
  });
});
