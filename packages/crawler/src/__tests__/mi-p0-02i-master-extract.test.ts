/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02i (CPO 지시, 2026-10-11) — **Golden 3 을 `universalExtract` 로 실제 돌린다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 돈다(브라우저가 뜰 수 있다).
 * 🔴 **코드 수정 0건.** 측정만 한다(CPO 명시).
 *
 * ── 🔴 schema 를 «먼저» 읽었다. 이번엔 추측하지 않는다 ──────────────────────
 * 이 세션에서 칸 이름을 추측해 **네 번** 틀렸다(light.facts · f.material ·
 * f.category · crossSellerVerdict). 그래서 실제 타입을 먼저 읽고 적는다:
 *
 *   universalExtract(url: string, options?: UniversalExtractOptions)
 *     → Promise<UniversalExtractResult>
 *
 *   UniversalExtractResult {
 *     images · productData · productDataSources · trace? ·
 *     strategyCounts? · sourceRepresentativeUrl?
 *   }
 *
 *   ExtractedProductData {
 *     title? · brand? · price? · regularPrice? · available? · priceValidity? ·
 *     priceRawText? · sku? · description? · options · optionGroups? ·
 *     variants? · selectedVariant? · material? · manufacturer? ·
 *     breadcrumbPath? · jsonLdCategory? · shopifyTags? · shopifyProductType?
 *   }
 *
 * 🔴 **그 안에 없는 칸을 적는다 — 이것이 단절 1 의 실제 모양이다:**
 *      `color`   없다 → 색상은 options/optionGroups/variants 안에 있다
 *      `season`  없다
 *      `audience`/`genderAge` 없다 → breadcrumbPath·shopifyTags 가 원재료다
 *      `brandModelCode` 없다 → `sku` 하나뿐이고, 그것이 브랜드 품번인지
 *                              판매처 재고번호인지 **이 타입은 구분하지 않는다**
 *
 * 🔴 **`ProductDataSource` 는 CPO 가 말한 SOURCE/DEFAULT/INFERRED 가 아니다.**
 *    실제 어휘는 `"json-ld" | "microdata" | "open-graph" | "dom" | "shopify-json"`
 *    — 즉 「**어느 추출 방법으로 읽었는가**」다. 「지어낸 값인가」를 말하지 않는다.
 *    그 둘을 같은 것으로 적으면 provenance 를 과대평가하게 된다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { universalExtract } from "../universal-extractor";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(os.tmpdir(), "mi-p0-02");

const URLS = [
  { jobKey: "JOB-JE-MAINSTORY", url: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story", knownBrandCode: "AW26MS185" },
  { jobKey: "JOB-BOBO-B226AC114", url: "https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt", knownBrandCode: "B226AC114" },
  { jobKey: "JOB-SMALLABLE-430632", url: "https://www.smallable.com/en/product/all-about-monsters-washed-t-shirt-organic-cotton-blue-bobo-choses-430632", knownBrandCode: null as string | null },
] as const;

describe.skipIf(!LIVE)("🔴 MI-P0-02i — Golden 3 universalExtract 실측(코드 수정 0건)", () => {
  it(
    "실제 반환 schema · 실제 값 · provenance 를 그대로 기록한다",
    async () => {
      const rows: Record<string, unknown>[] = [];

      for (const t of URLS) {
        let r: Awaited<ReturnType<typeof universalExtract>> | null = null;
        let error: string | null = null;
        try {
          r = await universalExtract(t.url);
        } catch (e) {
          error = e instanceof Error ? `${e.name}: ${e.message}` : "unknown";
        }
        const p = r?.productData;

        rows.push({
          jobKey: t.jobKey,
          url: t.url,
          knownBrandCode: t.knownBrandCode,
          error,
          /** 🔴 어느 경로로 뽑혔는가 — fast path(Playwright 없음) 인지 보여 준다. */
          strategyCounts: r?.strategyCounts ?? null,
          imageCount: r?.images?.length ?? null,
          sourceRepresentativeUrl: r?.sourceRepresentativeUrl ?? null,
          traceCount: r?.trace?.length ?? null,
          /** 🔴 「어느 추출 방법으로 읽었는가」. SOURCE/DEFAULT/INFERRED 가 아니다. */
          productDataSources: r?.productDataSources ?? null,
          productData: p
            ? {
                title: p.title ?? null,
                brand: p.brand ?? null,
                // 🔴 이 타입은 브랜드 품번과 판매처 재고번호를 «구분하지 않는다».
                sku: p.sku ?? null,
                skuEqualsKnownBrandCode:
                  t.knownBrandCode != null && p.sku != null
                    ? p.sku.toUpperCase() === t.knownBrandCode.toUpperCase()
                    : null,
                price: p.price ?? null,
                regularPrice: p.regularPrice ?? null,
                available: p.available ?? null,
                priceValidity: p.priceValidity ?? null,
                material: p.material ?? null,
                manufacturer: p.manufacturer ?? null,
                breadcrumbPath: p.breadcrumbPath ?? null,
                jsonLdCategory: p.jsonLdCategory ?? null,
                shopifyProductType: p.shopifyProductType ?? null,
                shopifyTags: p.shopifyTags ?? null,
                descriptionLength: p.description?.length ?? null,
                optionCount: p.options?.length ?? null,
                optionGroupNames: p.optionGroups?.map((g) => g.name) ?? null,
                variantCount: p.variants?.length ?? null,
                selectedVariant: p.selectedVariant ?? null,
              }
            : null,
          /** 🔴 이 타입에 «없는» 칸 — 단절 1 의 실제 모양이다. */
          absentFromSchema: ["color", "season", "audience/genderAge", "brandModelCode(sku 와 구분 없음)"],
        });

        const row = rows[rows.length - 1];
        const pd = row.productData as Record<string, unknown> | null;
        // eslint-disable-next-line no-console
        console.log(
          `${t.jobKey} ${error ? `ERROR=${error}` : ""}\n` +
            `   sku=${String(pd?.sku)} (=brandCode? ${String(pd?.skuEqualsKnownBrandCode)}) brand=${String(pd?.brand)}\n` +
            `   material=${String(pd?.material)?.slice(0, 40)} jsonLdCategory=${String(pd?.jsonLdCategory)} shopifyType=${String(pd?.shopifyProductType)}\n` +
            `   breadcrumb=${JSON.stringify(pd?.breadcrumbPath)} optionGroups=${JSON.stringify(pd?.optionGroupNames)} variants=${String(pd?.variantCount)}\n` +
            `   images=${String(row.imageCount)} price=${JSON.stringify(pd?.price)} sources=${JSON.stringify(row.productDataSources)}`,
        );
      }

      const report = {
        schemaFacts: {
          universalExtract: "(url, options?) => Promise<UniversalExtractResult>",
          UniversalExtractResult: ["images", "productData", "productDataSources", "trace?", "strategyCounts?", "sourceRepresentativeUrl?"],
          ProductDataSource: ["json-ld", "microdata", "open-graph", "dom", "shopify-json"],
          "🔴 ProductDataSource 의 의미": "«어느 추출 방법으로 읽었는가» 다. SOURCE/DEFAULT/INFERRED(지어낸 값인가)가 아니다.",
          "🔴 ExtractedProductData 에 없는 칸": ["color", "season", "audience/genderAge", "brandModelCode"],
        },
        notDone: ["ExtractedProductData → CanonicalProduct 변환 설계 안 했다", "ProductIdentityDna·ProductIdentity 연결 안 했다", "buildPrompt 수정 안 했다"],
        rows,
      };
      mkdirSync(OUT_DIR, { recursive: true });
      writeFileSync(path.join(OUT_DIR, "mi-p0-02i-master-extract.json"), JSON.stringify(report, null, 1), "utf8");

      // 🔴 결과 방향을 단언하지 않는다. 3건을 실제로 돌았다는 것만 단언한다.
      expect(rows).toHaveLength(3);
    },
    30 * 60 * 1000,
  );
});
