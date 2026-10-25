import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { productFactsFromListing } from "@commerce/crawler/src/comparison-search/seller-facts";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2AC — **PLAIN_HTML Evidence Parity** (운영 변경 허용 · 범위 세 칸)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CPO 가 범위를 세 칸으로 고정했다**(2026-10-25):
 * ```
 * materialText · categoryText · audienceSignals  — 이 셋만
 * 🔴 brandModelCode ❌(seller SKU 오염 · CORE-2K · MODEL_CODE conflict 정책)
 * 🔴 fitText / sizeLabels / ageRangeText / coreTitleTokens ❌(범위 밖)
 * 🔴 「stockmann 을 SAME 으로 만들려고 TITLE 점수를 다시 넣지 않는다」
 * ```
 *
 * 🟢 **새 규칙 0** — Shopify 경로가 쓰는 **같은 의미** 를 쓴다:
 * ```
 * materialText      JSON-LD material ?? (설명문이 «소재 조성» 으로 파싱될 때만 설명문)
 * categoryText      JSON-LD Product.category   ← Shopify `type` 과 같은 자리
 * audienceSignals   [category]                 ← Shopify `[...tags, type]` 과 같은 구성
 * ```
 * 🟢 **추가 HTTP 0** — `extractFromJsonLd` 는 그 파일이 **이미 부르는** 함수다.
 *
 * ── 🔴 A/B 를 «한 실행에서» 잰다 ───────────────────────────────────────────────
 * 실행을 두 번 나눠 비교하면 네트워크 상태가 달라 분모가 흔들린다. 그래서
 * **운영 facts** 와 **그 세 칸만 비운 facts** 를 같이 만들어 같은 matcher 에 넣는다.
 * 🟢 세 칸이 **가산(additive)** 이고 `coreTitleTokens` 를 **건드리지 않았으므로**
 *    「비우면 배선 전과 같다」가 성립한다(그 성질 자체를 AC-1 이 단언한다).
 */

const LIVE = process.env.CORE2AC_LIVE === "1";
const ORIGIN = "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt";

const GT = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/core-2m-ceo-visual-gt.json"), "utf8"),
) as { candidates: Array<{ domain: string; url: string; calibrationLabel: "SAME" | "DIFFERENT" | "UNCERTAIN" }> };

const CRAWLER = path.join(__dirname, "../../../../../../../../packages/crawler/src");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const LISTING_SRC = strip(readFileSync(path.join(CRAWLER, "comparison-search/seller-facts.ts"), "utf8"));
const URL_FACTS_SRC = strip(readFileSync(path.join(CRAWLER, "comparison-search/product-url-facts.ts"), "utf8"));

function listingSeg(src: string): string {
  const start = src.indexOf("export function productFactsFromListing");
  return src.slice(start, src.indexOf("\n}", start));
}

/* ═════════════════════════ 계약 — 네트워크 0 (CI 상주) ═════════════════════════ */

describe("CORE-2AC 계약 — 세 칸만 · 배선은 하나 · 범위 밖은 그대로", () => {
  it("AC-1 🟢 세 칸을 **안 넘기면 배선 전과 동일** 하다(목록 경로 불변)", () => {
    /** 🔴 검색 «목록» 파서들은 이 셋을 안 넘긴다 — 그 경로가 안 바뀌는 것이 이 단언이다. */
    const bare = productFactsFromListing({ title: "Hug Hairy Monster T-shirt", url: "https://x.kr/p/1a" });
    expect(bare.categoryText).toBeNull();
    expect(bare.materialText).toBeNull();
    expect(bare.audienceSignals).toEqual([]);
    /** 🔴 범위 밖 칸은 **여전히** 비어 있다. */
    expect(bare.brandModelCode, "🔴 품번은 이번 범위가 아니다(CPO §3)").toBeNull();
    expect(bare.fitText).toBeNull();
    expect(bare.sizeLabels).toEqual([]);
  });

  it("AC-2 🟢 분류를 넘기면 `categoryText` + `audienceSignals` **둘만** 채워진다", () => {
    const f = productFactsFromListing({
      title: "Hug Hairy Monster T-shirt",
      url: "https://x.kr/p/1a",
      brand: "Bobo Choses",
      category: "Kids / T-shirts",
    });
    expect(f.categoryText).toBe("Kids / T-shirts");
    /** 🟢 Shopify 의 `[...tags, type]` 과 같은 구성 — PLAIN_HTML 엔 tags 가 없다. */
    expect(f.audienceSignals).toEqual(["Kids / T-shirts"]);
    /** 🔴🔴 범위 밖이 **움직이지 않았다** — 이것이 CPO §2 의 핵심 단언이다. */
    expect(f.brandModelCode, "🔴 품번이 채워졌다 — CPO §3 위반").toBeNull();
    expect(f.fitText, "🔴 fitText 는 범위 밖이다").toBeNull();
    expect(f.ageRangeText).toBeNull();
    expect(f.sizeLabels).toEqual([]);
  });

  it("AC-3 🔴🔴 `materialText` 는 **채우지 않는다** — 거짓 MATERIAL blocker 실측(순손실)", () => {
    /**
     * 🔴 CPO 가 승인한 세 칸 중 **소재는 구현하지 않았다**. 근거는 실측이다:
     * ```
     * 원상품    "… Organic Cotton 100% …"      ⟹ [organic cotton:100]
     * m.luxboy  "Outer & Lining : 100% Cotton"  ⟹ [cotton:100]
     * ⟹ MATERIAL blocker(거짓 충돌) · 둘 다 면 100% · CEO 는 **SAME** 이라 했다
     * stockmann "100% puuvill"                  ⟹ [] (어휘에 없다) ⟹ 축 0
     * 효과 — 새 축 **0** · 거짓 blocker **1**
     * ```
     * 🟢 이 단언은 **소재 어휘 정규화가 열리면 FAIL 로 뒤집히고 그것이 수정의 증거** 다.
     */
    const f = productFactsFromListing({ title: "T-shirt", url: "https://x.kr/p/1a", category: "Kids" });
    expect(f.materialText, "🔴 소재를 채우기 시작했다 — 거짓 blocker 측정을 다시 한다").toBeNull();
    /** 🔴 타입에도 그 칸을 두지 않았다(죽은 인자를 남기지 않는다). */
    const seg = listingSeg(LISTING_SRC);
    expect(seg, "🔴 소재 배선이 되돌아왔다").not.toContain("input.material");
    expect(seg).not.toContain("parseMaterialComposition");
  });

  it("AC-4 🔴 PLAIN_HTML 경로가 `description`/`material` 을 **넘기지 않는다**", () => {
    const start = URL_FACTS_SRC.indexOf("const facts = productFactsFromListing({");
    expect(start).toBeGreaterThan(-1);
    const seg = URL_FACTS_SRC.slice(start, URL_FACTS_SRC.indexOf("});", start));
    expect(seg).toContain("category:");
    expect(seg, "🔴 설명문을 넘기기 시작했다 — 소재 거짓 blocker 가 돌아온다").not.toContain("description:");
    expect(seg).not.toContain("material:");
  });

  it("AC-5 🔴 `coreTitleTokens` 의 4번째 인자를 **material 로 바꾸지 않았다**", () => {
    const seg = listingSeg(LISTING_SRC);
    expect(seg, "🔴 제목 토큰이 움직이면 TITLE/NO_TITLE_OVERLAP 축이 같이 흔들린다").toContain(
      "coreTokens(input.title, brand, color, null)",
    );
  });

  it("AC-6 🔴 `brandModelCode` 는 여전히 **하드코딩 null** 이다", () => {
    expect(listingSeg(LISTING_SRC)).toContain("brandModelCode: null");
  });

  it("AC-7 🟢 배선은 **PLAIN_HTML 한 자리** 이고 **추가 HTTP 0** 이다", () => {
    expect(URL_FACTS_SRC).toContain("const jsonLd = extractFromJsonLd(html);");
    /** 🔴 새 fetch 를 넣지 않았다 — 그 분기에서 html 은 이미 손에 있다. */
    const start = URL_FACTS_SRC.indexOf("const jsonLd = extractFromJsonLd(html);");
    const seg = URL_FACTS_SRC.slice(start, start + 420);
    for (const no of ["await fetch", "fetchPlainHtml", "fetchWithDomainRateLimit", "playwright"]) {
      expect(seg, `🔴 ${no} 가 들어왔다 — 추가 HTTP 0 이 깨졌다`).not.toContain(no);
    }
    /** 🔴 세 칸만 넘긴다 — `sku`/`price`/`brand` 를 JSON-LD 로 올리지 않는다(WU-053 이유). */
    for (const no of ["sellerSku: jsonLd", "brandModelCode: jsonLd"]) {
      expect(seg).not.toContain(no);
    }
  });

  it("AC-8 🔴 가격 owner `priceFromJsonLd` 를 **고치지 않았다**", () => {
    expect(URL_FACTS_SRC).toContain("function priceFromJsonLd(html: string)");
    const start = URL_FACTS_SRC.indexOf("function priceFromJsonLd(html: string)");
    const seg = URL_FACTS_SRC.slice(start, URL_FACTS_SRC.indexOf("\n}", start));
    expect(seg).toContain("extractFromJsonLd(html)");
    for (const no of ["description", "jsonLdCategory", "material"]) {
      expect(seg, `🔴 가격 함수가 ${no} 를 만지기 시작했다 — 범위 밖이다`).not.toContain(no);
    }
  });
});

/* ═════════════════════════════ 라이브 A/B ═════════════════════════════ */

describe.runIf(LIVE)("CORE-2AC 라이브 — 변경 전/후를 한 실행에서(GT 10건)", () => {
  it(
    "§9 Before/After · §10 안전성 · 세 칸 실측",
    async () => {
      const ex = await shopifySiteStrategy.extract(ORIGIN);
      expect(ex?.productData, "🔴 원상품 추출 실패 — 측정불가").toBeTruthy();
      let dna = buildProductIdentityDna(
        buildCanonicalProduct(ORIGIN, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
      );
      if (!dna.brand.value) {
        const h = await fetchPlainHtml(ORIGIN);
        const site = h ? extractSiteBrandName(h) : null;
        if (site?.value) {
          dna = buildProductIdentityDna(
            buildCanonicalProduct(
              ORIGIN,
              { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
              {} as Record<string, ProductDataSource>,
              [],
            ),
          );
        }
      }
      expect(dna.brand.value, "🔴 원상품 brand 가 비면 측정 열화 — 거부").toBeTruthy();
      const originFacts = productFactsFromIdentityDna(dna);

      console.log("\n════════ CORE-2AC — PLAIN_HTML Evidence Parity ════════");
      console.log("🔴 범위 세 칸 · threshold 0 · 품번 0 · 가격 0 · 추가 HTTP 0\n");
      console.log(`    ${"판매처".padEnd(22)}${"CEO".padEnd(10)}${"경로".padEnd(13)}${"Before".padEnd(16)}${"After".padEnd(16)}변화`);

      let sameAfter = 0;
      let sameBefore = 0;
      let diffLeak = 0;
      let uncLeak = 0;
      const filled: string[] = [];
      const newBlockers: string[] = [];

      for (const g of GT.candidates) {
        const r = await factsFromProductUrl(g.url);
        if (r.status !== "OK" || !r.candidate?.facts) {
          console.log(`    🔴 ${g.domain} 측정불가(${r.status})`);
          continue;
        }
        const post = r.candidate.facts;
        /**
         * 🟢 **배선 전 상태** — 세 칸만 비운다. 가산이고 `coreTitleTokens` 를 안 건드렸으므로
         *    이것이 정확히 배선 전 facts 다(AC-1 이 그 성질을 단언한다).
         *
         * 🔴🔴 **단 `PLAIN_HTML` 에서만 그렇다.** 1차에 전 경로에 적용했다가
         *    **Shopify 후보까지 비워져** `kids21` 이 「3/4p → 4/5p 변화 · AUDIENCE_LINE 신규」로
         *    찍혔다. 그건 **거짓 신호** 다 — 이 WU 의 변경은 `PLAIN_HTML` 분기에만 있고
         *    Shopify 후보는 **배선 전에도 그 세 칸이 채워져 있었다**.
         *    🔴 그대로 보고했으면 「내 배선이 Shopify 후보를 악화시켰다」는 거짓이었다.
         */
        const isTarget = r.fetchPath === "PLAIN_HTML";
        const pre: ProductFacts = isTarget
          ? { ...post, categoryText: null, materialText: null, audienceSignals: [] }
          : post;

        const before = compareCrossSellerProducts(originFacts, pre);
        const after = compareCrossSellerProducts(originFacts, post);
        const pts = (c: typeof after) => (c.axes ?? []).reduce((s, a) => s + (a.points ?? 0), 0);
        const changed = before.verdict !== after.verdict || pts(before) !== pts(after);
        console.log(
          `    ${g.domain.padEnd(22)}${g.calibrationLabel.padEnd(10)}${r.fetchPath.padEnd(13)}` +
            `${`${before.verdict} ${before.axes?.length ?? 0}/${pts(before)}p`.padEnd(17)}` +
            `${`${after.verdict} ${after.axes?.length ?? 0}/${pts(after)}p`.padEnd(17)}` +
            `${isTarget ? (changed ? "🟢 변화" : "─") : "해당없음(배선 대상 아님)"}`,
        );
        /** 🔴 대상 후보는 **축/blocker 를 같이** 적는다 — 「값은 들어갔는데 축이 안 늘었다」를 가르려고. */
        if (isTarget) {
          console.log(
            `        ↳ 축[${(after.axes ?? []).map((a) => `${a.axis}:${a.points}`).join(" ") || "없음"}]` +
              ` · blockers[${(after.blockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)).join(",") || "없음"}]` +
              ` · conflicts[${(after.conflicts ?? []).map((c) => (typeof c === "string" ? c : c.conflict)).join(",") || "없음"}]`,
          );
        }

        if (r.fetchPath === "PLAIN_HTML") {
          filled.push(
            `${g.domain} | category=${post.categoryText ?? "null"} | material=${(post.materialText ?? "null").slice(0, 46)} | audience=${post.audienceSignals.join(",") || "없음"}`,
          );
        }
        const bb = new Set((before.blockers ?? []).map((b) => (typeof b === "string" ? b : b.blocker)));
        for (const b of (after.blockers ?? []).map((x) => (typeof x === "string" ? x : x.blocker))) {
          if (!bb.has(b)) newBlockers.push(`${g.domain} → ${b}`);
        }
        if (before.verdict === "SAME") sameBefore += 1;
        if (after.verdict === "SAME") {
          if (g.calibrationLabel === "SAME") sameAfter += 1;
          if (g.calibrationLabel === "DIFFERENT") diffLeak += 1;
          if (g.calibrationLabel === "UNCERTAIN") uncLeak += 1;
        }
      }

      console.log("\n═══ PLAIN_HTML 후보에 «실제로» 채워진 세 칸 ═══");
      for (const f of filled) console.log(`    ${f}`);

      console.log("\n═══ 🔴 새로 생긴 blocker(위험 신호) ═══");
      console.log(newBlockers.length === 0 ? "    없음" : newBlockers.map((b) => `    ${b}`).join("\n"));

      const ceoSame = GT.candidates.filter((c) => c.calibrationLabel === "SAME").length;
      console.log(`\n    SAME(before) **${sameBefore}** → SAME recovery **${sameAfter}/${ceoSame}**`);
      console.log(`    DIFFERENT leakage **${diffLeak}** · UNCERTAIN leakage **${uncLeak}**`);

      /** 🔴🔴 §10 성공 기준 — recall 은 «줄지 않아야» 하고 누출은 **0** 이어야 한다. */
      expect(diffLeak, "🔴 DIFFERENT 가 SAME 으로 누출됐다 — 즉시 STOP").toBe(0);
      expect(uncLeak, "🔴 UNCERTAIN 이 SAME 으로 누출됐다 — 즉시 STOP").toBe(0);
    },
    20 * 60 * 1000,
  );
});
