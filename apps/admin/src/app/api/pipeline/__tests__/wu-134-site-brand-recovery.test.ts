import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { resolveBrandName } from "@commerce/crawler/src/brand-resolver";
import { buildCanonicalProduct } from "../canonical-product";
import type { ExtractedProductData } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-134 — **원상품 브랜드 확정성 복구** (순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴🔴 **이 파일이 잠그는 것은 「브랜드를 채웠다」가 아니라 「언제 «안» 채우는가」다.**
 *
 * WU-080 이 「원상품 brand 공백을 메우면 **악화** 된다」로 REJECT 한 자리이고,
 * CPO 가 이번에 **좁은 축 하나만** 열었다:
 * ```
 * ✅ 원상품이 brand 를 적어 뒀는데 그 값이 **시즌코드로 거부된** 경우
 * ❌ brand 가 애초에 **없는** 경우 — 「모르면 채우지 않는다」
 * ❌ 후보/도메인/판매처 이름 — WU-080 금지 그대로(계약이 따로 잠근다)
 * ❌ 시즌명/컬렉션명/카테고리명을 브랜드로 쓰기
 * ```
 *
 * ── 🔴 실측 전제(WU-134 STEP 1 · `wu-134-signals.json`) ───────────────────
 * ```
 * 원상품 bobochoses.com  Product.brand="AW26" · og:site_name == Organization.name == "Bobo Choses"
 * 후보 17건              Product.brand 보유 11 · null 6 ⟹ 발화 조건에 걸리는 리테일러 **0**
 * ```
 */

const EMPTY_SOURCES = {} as Record<string, never>;
const build = (productData: Partial<ExtractedProductData>) =>
  buildCanonicalProduct(
    "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt",
    { options: [], ...productData } as ExtractedProductData,
    EMPTY_SOURCES as never,
    [],
  );

/** 🔴 실측 모양 그대로다 — 원상품 페이지의 두 자리(`wu-134-signals.json`). */
const html = (siteName: string | null, orgName: string | null) =>
  [
    siteName == null ? "" : `<meta property="og:site_name" content="${siteName}">`,
    orgName == null
      ? ""
      : `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebSite", url: "https://bobochoses.com" },
            { "@type": "Organization", name: orgName },
            { "@type": "Product", name: "Hug Hairy Monster", brand: { "@type": "Brand", name: "AW26" } },
          ],
        })}</script>`,
  ].join("\n");

/* ═════════════ A. 🔴 사이트 이름 추출 — 두 자리가 «같을 때만» ═════════════ */

describe("A. extractSiteBrandName (순수)", () => {
  it("A-1 🟢 두 자리가 같으면 그 이름을 돌려준다", () => {
    const got = extractSiteBrandName(html("Bobo Choses", "Bobo Choses"));
    expect(got?.value).toBe("Bobo Choses");
    /** 🔴 어디서 왔는지를 **같이** 들고 나온다 — 「추측이 아니다」의 증거다. */
    expect(got?.evidence).toBe("OG_SITE_NAME_AND_JSONLD_ORGANIZATION");
  });

  it("A-2 🔴🔴 두 자리가 **다르면 모른다**(null) — 고르지 않는다", () => {
    expect(extractSiteBrandName(html("Bobo Choses", "Shopify Payments"))).toBeNull();
    expect(extractSiteBrandName(html("Tinyapple", "Bobo Choses"))).toBeNull();
  });

  it("A-3 🔴 한쪽만 있으면 **쓰지 않는다**", () => {
    expect(extractSiteBrandName(html("Bobo Choses", null))).toBeNull();
    expect(extractSiteBrandName(html(null, "Bobo Choses"))).toBeNull();
  });

  it("A-4 🔴🔴 시즌/마케팅/카테고리 문구는 **브랜드가 아니다**(규칙 owner 재사용)", () => {
    /** 🔴 사이트가 자기를 「AW26」이라 불러도 그것은 브랜드가 아니다. */
    expect(extractSiteBrandName(html("AW26", "AW26"))).toBeNull();
    /** 🟢 꼬리표는 **정리** 된다 — owner 가 아는 규칙 그대로다. */
    expect(extractSiteBrandName(html("Bobo Choses Kids", "Bobo Choses Kids"))?.value).toBe("Bobo Choses");
  });

  it("A-5 🟢 `&amp;` 류를 푼다(실측에 있던 모양)", () => {
    expect(extractSiteBrandName(html("Scout &amp; Co", "Scout &amp; Co"))?.value).toBe("Scout & Co");
  });

  it("A-6 🔴 `Organization` **이 아닌** 노드의 이름은 보지 않는다", () => {
    const h =
      `<meta property="og:site_name" content="Bobo Choses">` +
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "WebSite",
        name: "Bobo Choses",
      })}</script>`;
    expect(extractSiteBrandName(h)).toBeNull();
  });

  it("A-7 🟢 깨진 ld+json 블록이 있어도 **다른 블록을 읽는다**", () => {
    const h =
      `<meta property="og:site_name" content="Bobo Choses">` +
      `<script type="application/ld+json">{ this is not json </script>` +
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Organization", name: "Bobo Choses" })}</script>`;
    expect(extractSiteBrandName(h)?.value).toBe("Bobo Choses");
  });

  it("A-8 🔴 도메인을 **쓰지 않는다** — 그 파일에 도메인 어휘가 없다", () => {
    const src = readFileSync(
      path.join(__dirname, "..", "..", "..", "..", "..", "..", "..", "packages", "crawler", "src", "site-brand-name.ts"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const forbidden of ["hostname", "new URL", "domain", "apex"]) {
      expect(src).not.toContain(forbidden);
    }
  });
});

/* ═════════════ B. 🔴🔴 복구는 «거부된 경우» 에만 발화한다 ═════════════ */

describe("B. 🔴 canonical-product 의 좁은 조건", () => {
  it("B-1 🟢 brand 가 시즌코드로 거부됐고 사이트 이름이 있으면 **복구된다**", () => {
    const p = build({ brand: "AW26", siteBrandName: "Bobo Choses" });
    expect(p.brand.value).toBe("Bobo Choses");
    /** 🟢 거부 기록은 **지우지 않는다** — 무슨 일이 있었는지 남아야 한다. */
    expect(p.brandResolution?.raw).toBe("AW26");
    expect(p.brandResolution?.ruleApplied).toContain("SEASON_CODE");
  });

  it("B-2 🔴🔴 brand 가 **애초에 없으면** 복구하지 않는다 — 「모르면 채우지 않는다」", () => {
    /** 🔴 이 모양이 멀티브랜드 리테일러의 위험 모양이다(WU-080 이 측정한 그 자리). */
    const p = build({ brand: undefined, siteBrandName: "Smallable" });
    expect(p.brand.value).toBe("");
    expect(p.brand.source).toBe("REQUIRED");
  });

  it("B-3 🔴 brand 가 **정상이면** 사이트 이름을 보지 않는다", () => {
    const p = build({ brand: "Bobo Choses", siteBrandName: "Tinyapple" });
    expect(p.brand.value).toBe("Bobo Choses");
  });

  it("B-4 🔴 거부됐지만 사이트 이름이 **없으면** 그대로 빈 값이다(지어내지 않는다)", () => {
    const p = build({ brand: "AW26" });
    expect(p.brand.value).toBe("");
    expect(p.brand.source).toBe("REQUIRED");
  });

  it("B-5 🔴 거부가 **아닌** 정제(꼬리표 제거)는 기존 동작 그대로다", () => {
    /** 🟢 `resolveBrandName` 이 값을 남기면 그것이 이긴다 — 복구가 끼어들지 않는다. */
    expect(resolveBrandName("Bobo Choses SS26")?.cleaned).toBe("Bobo Choses");
    const p = build({ brand: "Bobo Choses SS26", siteBrandName: "Tinyapple" });
    expect(p.brand.value).toBe("Bobo Choses");
  });
});

/* ═════════════ C. 🔴 배선 — 조건부 1회 HTML (소스 앵커) ═════════════ */

describe("C. 🔴 Shopify 경로 배선", () => {
  const strategy = readFileSync(
    path.join(
      __dirname, "..", "..", "..", "..", "..", "..", "..",
      "packages", "crawler", "src", "site-strategies", "shopify.site-strategy.ts",
    ),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it("C-1 🔴🔴 두 진입점(extract · fallback)이 **둘 다** 그 보강을 거친다", () => {
    expect(strategy).toContain("return fillRejectedBrand(await fillMissingCurrency(result, sourceUrl), sourceUrl);");
    expect(strategy).toContain("return fillRejectedBrand(await fillMissingCurrency(result, url), url);");
  });

  it("C-2 🔴 brand 가 없거나 정상이면 **HTTP 를 쓰지 않는다**(조건이 fetch 앞에 있다)", () => {
    const fn = strategy.slice(strategy.indexOf("async function fillRejectedBrand"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    const guardNoBrand = body.indexOf("if (!raw) return result;");
    const guardResolved = body.indexOf("resolution.cleaned.trim()");
    const fetchAt = body.indexOf("fetchPlainHtml(");
    expect(guardNoBrand).toBeGreaterThan(-1);
    expect(guardResolved).toBeGreaterThan(-1);
    /** 🔴 **두 가드가 fetch «앞»** 이어야 한다 — 뒤면 매 상품마다 HTTP 가 하나 늘어난다. */
    expect(fetchAt).toBeGreaterThan(guardNoBrand);
    expect(fetchAt).toBeGreaterThan(guardResolved);
  });

  it("C-3 🔴 브랜드 규칙을 **복제하지 않는다** — owner 를 부른다", () => {
    expect(strategy).toContain("resolveBrandName(raw)");
    for (const forbidden of ["SEASON_CODE_PATTERN", "/\\bSS|AW/", "AW26"]) {
      expect(strategy).not.toContain(forbidden);
    }
  });
});
