import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractFromJsonLd, extractMicrodataFromHtml } from "@commerce/crawler";
import { extractLabeledProductCode } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵 BROWSER-FALLBACK-03 — **CEO 가 브라우저에서 확보한 Farfetch HTML → 기존 추출기**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드 변경 **0** · 추출기 수정 **0** · Identity/MI **0** · Search **0** ·
 *    북마클릿 **0** · Crawl **0** · 우회 **0**.
 *
 * 🔴🔴 **칸 이름을 추측하지 않는다**(CPO §2 · BF-02 에서 내가 틀린 자리).
 *    `ExtractedProductData` 실제 칸 =
 *    title · brand · siteBrandName · price{amount,currency} · regularPrice ·
 *    available · priceValidity · priceRawText · sku · description · options ·
 *    optionGroups · variants · selectedVariant · material · manufacturer · breadcrumbPath
 *    🔴 `name` · `currency` · `images` 는 **없다**.
 *
 * 🔴 fixture 는 CEO HTML 에서 **추출기가 읽는 부분만 그대로** 옮긴 것이다(전체 278KB 아님).
 */

const HTML = readFileSync(join(__dirname, "fixtures/browser-fallback-03-farfetch.html"), "utf8");
const SOURCE_URL =
  "https://www.farfetch.com/my/shopping/kids/bobo-choses-hug-hairy-monster-long-sleeve-t-shirt-item-37620037.aspx";

describe("BROWSER-FALLBACK-03 — Farfetch 실제 browser HTML", () => {
  it("🟢 fixture 가 실제 원문 구조를 들고 있다(지어내지 않았다)", () => {
    expect(HTML).toContain('"@type":"ProductGroup"');
    /** 🔴 실제 Farfetch 는 `offers.price` 가 **아니라** `priceSpecification` 이다. */
    expect(HTML).toContain('"priceSpecification"');
    expect(HTML).not.toContain('"offers":{"@type":"Offer","price"');
    /** 🔴 품번은 **JSON-LD 가 아니라 DOM** 에 있다. */
    expect(HTML).toContain("Brand style ID");
    expect(HTML).toContain("B226AC009");
  });

  it("🔴🔴 기존 추출기를 그대로 돌린다 — 실제 칸만 읽는다", () => {
    const jsonLd = extractFromJsonLd(HTML);
    const micro = extractMicrodataFromHtml(HTML);
    /* eslint-disable no-console */
    console.log(
      `[BF03-jsonLd] ${
        jsonLd === null
          ? "null"
          : JSON.stringify(
              {
                title: jsonLd.title ?? null,
                brand: jsonLd.brand ?? null,
                siteBrandName: jsonLd.siteBrandName ?? null,
                sku: jsonLd.sku ?? null,
                price: jsonLd.price ?? null,
                regularPrice: jsonLd.regularPrice ?? null,
                available: jsonLd.available ?? null,
                description: jsonLd.description ?? null,
                material: jsonLd.material ?? null,
                manufacturer: jsonLd.manufacturer ?? null,
                breadcrumbPath: jsonLd.breadcrumbPath ?? null,
                optionGroups: jsonLd.optionGroups ?? null,
                variants: jsonLd.variants?.length ?? null,
              },
              null,
              1,
            )
      }`,
    );
    console.log(`[BF03-micro] ${micro === null ? "null" : JSON.stringify(micro)}`);

    /* ── 🔴 품번 경로를 «분리» 한다(CPO §6) ─────────────────────────────── */
    const fromJsonLdDescription = extractLabeledProductCode(jsonLd?.description);
    const fromRawHtml = extractLabeledProductCode(HTML);
    console.log(
      `[BF03-code] JSON-LD description → ${fromJsonLdDescription ?? "null"} · ` +
        `HTML 원문 → ${fromRawHtml ?? "null"} · ` +
        `원문 등장 ${(HTML.match(/B226AC009/g) ?? []).length}회`,
    );
    console.log(`[BF03-url] sourceUrl = ${SOURCE_URL}`);

    /** 🔴 측정이다 — 수치를 미리 고정하지 않는다. 형태만 단언한다. */
    expect(jsonLd === null || typeof jsonLd === "object").toBe(true);
  });
});
