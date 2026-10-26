import { describe, expect, it } from "vitest";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import { factsFromProductUrl, withConfidence } from "@commerce/crawler";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { fetchPlainHtml } from "@commerce/crawler/src/shopify-product-json";
import { extractSiteBrandName } from "@commerce/crawler/src/site-brand-name";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import type { ComparisonQuery } from "@commerce/crawler/src/comparison-search/types";
import type { ProductFacts } from "@commerce/shared";
import { buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { buildCanonicalProduct } from "../../../pipeline/canonical-product";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";
import { classifyCandidateMarket } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-MI-PRICE-01 — **국내 「가격 형성대」 집계기가 «둘» 이다**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **새 가격 산식을 만들지 않았다**(§6·§9). 이 파일은 **기존 두 집계기의 수를
 *    같은 상품에서 나란히 세어** CPO 의 Level 0/1/2/3 기준이 **어느 집계기 위에서
 *    성립하는지** 를 밝힌다. 🔴 UI 변경 0 · matcher 0 · threshold 0.
 *
 * ── 🔴🔴🔴 왜 이것이 §9 의 STOP 판단 지점인가 ──────────────────────────────
 * ```
 * 집계기 ①  buildPriceGuide(mi-same-candidates.ts)   ← **SAME tier 만** 센다
 *            basis SINGLE(1건) / RANGE(2건+) · 「가격대 확정 불가」 문구의 주인
 * 집계기 ②  domesticReference(market-intelligence.ts:318)
 *            ← **`priceTier` 가 `EXACT` 또는 `COMPARISON`** 이면 적재(= PRESUMED_SAME 포함)
 * ⟹ 🔴 같은 상품에서 ①은 1건, ②는 2건이 될 수 있다.
 *    CPO Level 2(「신뢰 가능한 국내 동일상품 2~3개 ⟹ 가격 형성대」)가
 *    **①에서는 성립하지 않고 ②에서는 성립** 하면, 그 선택은 **제품 정책** 이다.
 * 🔴 **CTO 가 고르지 않는다** — 수만 내고 STOP 한다(§9 「UI 계약을 바꿔야 하면 STOP」).
 * ```
 *
 * ── 🟢 재조사하지 않은 것 ───────────────────────────────────────────────────
 * ```
 * WU-172(상품 3종 퍼널) · WU-FINAL-3(자동 공급) 이 **이미** 측정했다 —
 * 그 결과를 다시 만들지 않고 **그 입력(human GT 국내 URL)을 그대로** 쓴다.
 * 🔴 국내 후보 URL 을 **지어내지 않았다** — WU-172 가 쓰는 그 URL 들이다.
 * ```
 */

const LIVE = process.env.CORE_MI_PRICE_01_LIVE === "1";

/** 🔴 WU-172 와 **같은 입력** — human GT 에 있는 실제 국내 URL(지어낸 것 0). */
const PRODUCTS: { code: string; originUrl: string; domestic: { url: string; human: string }[] }[] = [
  {
    code: "B226AC009",
    originUrl: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
    domestic: [
      { url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/", human: "SAME" },
      { url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021", human: "SAME" },
      { url: "https://m.luxboy.com/product/A14338197CB8698CD92C86431CCE8D05", human: "SAME" },
      { url: "https://www.donokids.com/shop/shopdetail.html?branduid=3362785", human: "SAME" },
    ],
  },
  {
    code: "B226AC010",
    originUrl: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
    domestic: [
      { url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021", human: "SAME" },
      { url: "https://luksusbaby.kr/products/bobo-choses-light-blue-booty-ghosts-t-shirt", human: "UNDETERMINED" },
      { url: "https://kream.co.kr/products/1030865", human: "DIFFERENT" },
    ],
  },
  {
    code: "B226AC117",
    originUrl: "https://bobochoses.com/products/b226ac117-b-c-embossed-tracksuit-jacket",
    domestic: [
      { url: "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-bc-%EC%97%A0%EB%B3%B4%EC%8A%A4-%ED%8A%B8%EB%9E%99%EC%88%98%ED%8A%B8-%EC%9E%90%EA%B2%9F-b226ac117/8905/category/367/display/1/", human: "SAME" },
      { url: "https://m.web.mustit.co.kr/product/detail/2863124", human: "SAME" },
    ],
  },
];

/** 🔴 CPO §2 의 Level — **숫자를 해석하는 규칙이고 새 산식이 아니다**. */
function cpoLevel(n: number): string {
  if (n === 0) return "Level 0 — 국내 참고가격 없음(정상)";
  if (n === 1) return "Level 1 — 제한된 근거";
  if (n <= 3) return "Level 2 — 가격 형성대 판단 가능 🟢";
  return "Level 3 — 풍부(제품 성공조건 아님)";
}

async function originFacts(code: string, url: string): Promise<ProductFacts> {
  const ex = await shopifySiteStrategy.extract(url);
  expect(ex?.productData, `🔴 원상품(${code}) 추출 실패`).toBeTruthy();
  let dna = buildProductIdentityDna(
    buildCanonicalProduct(url, ex!.productData as ExtractedProductData, {} as Record<string, ProductDataSource>, []),
  );
  if (!dna.brand.value) {
    const html = await fetchPlainHtml(url);
    const site = html ? extractSiteBrandName(html) : null;
    if (site?.value) {
      dna = buildProductIdentityDna(
        buildCanonicalProduct(
          url,
          { ...(ex!.productData as ExtractedProductData), siteBrandName: site.value } as ExtractedProductData,
          {} as Record<string, ProductDataSource>,
          [],
        ),
      );
    }
  }
  return productFactsFromIdentityDna(dna);
}

describe("CORE-MI-PRICE-01 — 국내 가격 형성대: 두 집계기를 나란히 센다(운영 변경 0)", () => {
  it.runIf(LIVE)(
    "상품별로 ①SAME-only 와 ②domesticReference 를 같은 자리에서 센다",
    async () => {
      const rows: {
        code: string;
        sameOnly: number[];
        domRef: number[];
        tiers: string[];
        leak: number;
      }[] = [];

      for (const p of PRODUCTS) {
        const origin = await originFacts(p.code, p.originUrl);
        const sameOnly: number[] = [];
        const domRef: number[] = [];
        const tiers: string[] = [];
        let leak = 0;
        console.log(`\n══════════ ${p.code} ══════════`);
        console.log(`  원상품 — brand=${origin.brand} code=${origin.brandModelCode}`);

        for (const c of p.domestic) {
          const f = await factsFromProductUrl(c.url);
          const host = new URL(c.url).host.replace(/^www\./, "");
          if (f.status !== "OK" || !f.candidate?.facts) {
            console.log(`    ${host.padEnd(24)} 🔴 ${f.status} — 측정불가(가격 0 으로 세지 않는다)`);
            continue;
          }
          const query = {
            title: origin.title,
            brand: origin.brand ?? undefined,
            sourceUrl: p.originUrl,
            sku: origin.brandModelCode ?? undefined,
            facts: origin,
          } as ComparisonQuery;
          const [scored] = withConfidence(query, [f.candidate]);
          const facts = scored?.facts ?? f.candidate.facts;
          const cross = compareCrossSellerProducts(origin, facts);
          const truth = deriveMatchTruth(
            scored?.matchLevel ?? "low",
            compareModelCode(origin.brandModelCode, facts.brandModelCode ?? null),
            cross.verdict,
            cross.blockers,
            cross.conflicts,
            !facts.colorText,
          );
          const tier = priceTierFromLink({ matchTruth: truth, verified: false });
          const price = scored?.price ?? f.candidate.price ?? null;
          const market = classifyCandidateMarket({
            domain: host,
            currency: price?.currency ?? null,
            isRegisteredDomesticShop: false,
          });
          const krw = price && price.currency.toUpperCase() === "KRW" ? price.amount : null;

          /** ① 기존 밴드 주인 — **SAME tier 만** 센다. */
          const inSameOnly = cross.verdict === "SAME" && krw != null;
          /** ② domesticReference — `EXACT|COMPARISON` 이면 적재(market-intelligence.ts:318). */
          const inDomRef = market.market === "KR" && krw != null && (tier === "EXACT" || tier === "COMPARISON");

          if (inSameOnly) sameOnly.push(krw!);
          if (inDomRef) domRef.push(krw!);
          tiers.push(`${host}:${tier}`);
          /** 🔴🔴 **오염 감시** — human DIFFERENT 가 가격 축에 들어가면 그것이 사고다. */
          if (c.human === "DIFFERENT" && inDomRef) leak += 1;

          console.log(
            `    ${host.padEnd(24)} human=${c.human.padEnd(13)} verdict=${String(cross.verdict).padEnd(14)} ` +
              `tier=${tier.padEnd(11)} market=${market.market.padEnd(8)} ` +
              `${krw != null ? `KRW ${krw.toLocaleString()}` : `가격 ${price ? price.currency : "없음"}`} ` +
              `① ${inSameOnly ? "포함" : "—   "} ② ${inDomRef ? "포함" : "—"}`,
          );
        }

        const band = (xs: number[]) =>
          xs.length === 0
            ? "없음"
            : xs.length === 1
              ? `${xs[0].toLocaleString()} (🔴 가격대 확정 불가)`
              : `${Math.min(...xs).toLocaleString()} ~ ${Math.max(...xs).toLocaleString()} 🟢`;
        console.log(`  ① SAME-only       ${sameOnly.length}건 · ${band(sameOnly)} · ${cpoLevel(sameOnly.length)}`);
        console.log(`  ② domesticRef     ${domRef.length}건 · ${band(domRef)} · ${cpoLevel(domRef.length)}`);
        console.log(`  🔴 DIFFERENT 오염  ${leak}`);
        rows.push({ code: p.code, sameOnly, domRef, tiers, leak });
      }

      /* ── 요약 ──────────────────────────────────────────────────────────── */
      console.log(`\n${"═".repeat(84)}\n  §15 보고표 — CPO Level 은 «어느 집계기» 위에서 성립하는가\n${"═".repeat(84)}`);
      const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
      console.log(`  ${pad("상품", 12)}${pad("①SAME", 8)}${pad("①Level", 34)}${pad("②domRef", 9)}${pad("②Level", 34)}오염`);
      for (const r of rows) {
        console.log(
          `  ${pad(r.code, 12)}${pad(String(r.sameOnly.length), 8)}${pad(cpoLevel(r.sameOnly.length), 34)}` +
            `${pad(String(r.domRef.length), 9)}${pad(cpoLevel(r.domRef.length), 34)}${r.leak}`,
        );
      }
      const lvl2SameOnly = rows.filter((r) => r.sameOnly.length >= 2).length;
      const lvl2DomRef = rows.filter((r) => r.domRef.length >= 2).length;
      console.log(
        `\n  🔴 Level 2 도달 — ① SAME-only **${lvl2SameOnly} / ${rows.length}** · ② domesticRef **${lvl2DomRef} / ${rows.length}**`,
      );
      console.log(`  🟢 DIFFERENT 오염 합계 **${rows.reduce((s, r) => s + r.leak, 0)}**`);

      /** 🔴🔴 **가장 중요한 단언** — human DIFFERENT 가 가격 축에 들어가면 FAIL 이다. */
      expect(rows.reduce((s, r) => s + r.leak, 0), "🔴 human DIFFERENT 가 국내 가격에 섞였다").toBe(0);
      expect(rows).toHaveLength(PRODUCTS.length);
      /** 🔴 두 집계기의 수가 **다를 수 있다** 는 것이 이 WU 의 관측이다 — 단정하지 않는다. */
      expect(lvl2SameOnly).toBeLessThanOrEqual(lvl2DomRef);
    },
    1_800_000,
  );

  it("라이브 축은 환경변수로만 돈다", () => {
    expect(LIVE, LIVE ? "" : "🟡 CORE_MI_PRICE_01_LIVE=1 이 아니라 건너뛴다").toBe(LIVE);
  });
});
