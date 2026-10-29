import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 E2E-ROOTCAUSE-01 Track A — **입력 URL → ProductFacts → Query**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 문제 A 와 B 를 **섞지 않는다**(CPO 강조). 이 파일은 **A 만** 본다 —
 *    「내가 넣은 국내 URL 을 상품으로 읽는가」.
 * 🔴 운영 Query · Identity · MI · Market · Registry · adapter **변경 0**.
 * 🔴 **원인 확인 전에 URL parser/classifier 를 고치지 않는다**(CPO §5).
 */

const LIVE = process.env.RC01_LIVE === "1";
const FIX = join(__dirname, "fixtures");

/** 🔴 CPO 가 지정한 **실제 사용자 입력 URL** 둘. 바꾸지 않는다. */
const CASES = [
  {
    key: "A_littleluna",
    label: "Little Luna(국내 · 한글 percent-encoding)",
    url: "https://littleluna.co.kr/product/%EB%A9%94%EC%9D%B8%EC%8A%A4%ED%86%A0%EB%A6%AC-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/1/display/3/?icid=MAIN.product_listmain_2",
  },
  {
    key: "B_mainstory",
    label: "Main Story(해외 원상품)",
    url: "https://main-story.com/products/bubble-sweatshirt-grey-melange-1?srsltid=AYCX9vJugDIA1cXJ1iOHFtxJpDob_yD88Nv5ovEy22z5tohMimgsiKVv",
  },
] as const;

describe("RC-01 Track A — 입력 URL 비교", () => {
  it("🟢 분모 고정 — CPO 가 준 URL 둘 그대로다", () => {
    expect(CASES).toHaveLength(2);
    expect(CASES[0].url).toContain("littleluna.co.kr");
    expect(CASES[1].url).toContain("main-story.com");
  });

  it.runIf(LIVE)(
    "🔴🔴 normalize → shape → fetch → facts → Query 를 단계별로 가른다",
    async () => {
      const { classifyUrlShape } = await import("@commerce/crawler/src/comparison-search/url-shape");
      const { universalExtract } = await import("@commerce/crawler");
      const { buildProductIdentityDna } = await import("@commerce/shared");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { buildCompositeDiscoveryQuery } = await import(
        "@commerce/crawler/src/discovery-core/query-planner"
      );

      const out: Record<string, unknown>[] = [];
      for (const c of CASES) {
        const row: Record<string, unknown> = { key: c.key, label: c.label, url: c.url };
        /* ── ① URL 축 — 디코딩이 깨지는지 **문자 단위** 로 본다 ─────────── */
        let parsed: URL | null = null;
        try {
          parsed = new URL(c.url);
        } catch {
          /* 파싱 실패도 사실로 적는다 */
        }
        row.host = parsed?.hostname ?? null;
        row.pathname = parsed?.pathname ?? null;
        row.decodedPath = parsed ? decodeURIComponent(parsed.pathname) : null;
        row.query = parsed?.search ?? null;
        row.shape = classifyUrlShape(c.url);

        /* ── ② 운영 추출 경로 ──────────────────────────────────────────── */
        try {
          const ex = await universalExtract(c.url, { debug: false });
          const pd = ex.productData;
          row.extract = {
            ok: true,
            images: ex.images.length,
            title: pd.title ?? null,
            brand: pd.brand ?? null,
            sku: pd.sku ?? null,
            price: pd.price ? `${pd.price.amount} ${pd.price.currency}` : null,
            material: pd.material ?? null,
            description: pd.description ? String(pd.description).slice(0, 80) : null,
          };
          const product = buildCanonicalProduct(c.url, pd, ex.productDataSources, []);
          const dna = buildProductIdentityDna(product);
          row.dna = {
            brand: dna.brand.value || null,
            code: dna.brandModelCode,
            title: dna.title || null,
            color: dna.color,
            material: dna.material,
            fit: dna.fit,
            category: dna.category?.value ?? null,
          };
          const q = buildCompositeDiscoveryQuery({
            brand: dna.brand.value || null,
            productName: dna.title || null,
            productType: dna.category?.value ?? null,
            genderAge: null,
            color: dna.color,
            size: null,
            season: null,
            productCode: dna.brandModelCode,
            facts: [dna.material, dna.fit].filter((v): v is string => Boolean(v)),
            sourceUrl: c.url,
            sourceSite: null,
            sourceCountry: null,
            market: null,
          });
          row.query = { text: q.text, tokens: q.tokenCount };
        } catch (e) {
          row.extract = { ok: false, error: `${(e as Error).name}: ${(e as Error).message.slice(0, 180)}` };
        }

        out.push(row);
        /* eslint-disable no-console */
        console.log(`\n[RC01] ══ ${c.label} ══`);
        console.log(`  host=${row.host} shape=${row.shape}`);
        console.log(`  path=${String(row.pathname).slice(0, 90)}`);
        console.log(`  decoded=${String(row.decodedPath).slice(0, 90)}`);
        console.log(`  extract=${JSON.stringify(row.extract)}`);
        if (row.dna) console.log(`  dna=${JSON.stringify(row.dna)}`);
        console.log(`  query=${row.query ? (row.query as { text: string }).text : "(없음)"}`);
      }
      writeFileSync(join(FIX, "rc-01-input-url.json"), JSON.stringify(out, null, 2));
      expect(out).toHaveLength(2);
    },
    1_800_000,
  );
});
