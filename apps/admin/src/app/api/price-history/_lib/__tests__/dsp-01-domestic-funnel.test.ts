import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DOMESTIC-SAME-PROVIDER-01 §4·§7 — **국내 축 후보 소실 추적**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 질문 하나로 수렴한다 —
 * 「AI Search 가 찾은 국내 후보가 **동일/유사 국내 판매처 URL + 가격** 으로
 *   연결되어 `따져` 화면에 보이는가」
 *
 * 🔴 **새 Search 0** — 이미 DB 에 있는 사람 확정 후보(`candidate_reviews`)를
 *    운영 재투입 입력(`reviewedSameUrls`)으로 그대로 태운다. 그 경로는
 *    `/api/price-history/check` 가 실제로 쓰는 생산자다(`__reviewed_same__`).
 * 🔴 Query · Identity · Market Attribution · MI **변경 0**.
 *
 * ── 🔴 하니스가 운영과 다른 지점(먼저 적는다) ─────────────────────────────
 * ```
 * service-role 키가 없어 등록부가 비어서 돈다 ⟹ 등록부 검색 · 국내 목록 탐색 ·
 * 정책 게이트가 **돌지 않는다**. 🟢 이 측정의 관심은 **재투입 생산자 하나** 다.
 * ```
 */

const LIVE = process.env.DSP01_LIVE === "1";
const FIX = join(__dirname, "fixtures");
const ORIGIN = "https://bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt";
const SNAPSHOT = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";
const WORKSPACE = "b60b0ad7-d750-4f70-a1c3-a4d220f76756";

interface Row {
  url: string;
  domain: string | null;
  v: string;
  market: string | null;
  price_amount: number | null;
  price_currency: string | null;
}
function reviewed(): Row[] {
  return (JSON.parse(readFileSync(join(FIX, "dsp-01-reviewed-same.json"), "utf8")) as { rows: Row[] }).rows;
}

/** 🔴 **추정이 아니다** — 한국 TLD 만 센다. 그 외는 「국내가 아니다」가 아니라 «미확정» 이다. */
const isKrTld = (d: string | null) => Boolean(d && /\.kr$/i.test(d));

describe("DSP-01 — 분모(사람이 확정한 후보)", () => {
  it("🟢 B226AC009 의 human 라벨 전수", () => {
    const rows = reviewed();
    expect(rows.length).toBeGreaterThanOrEqual(23);
    const same = rows.filter((r) => r.v === "SAME");
    expect(same.length).toBeGreaterThanOrEqual(18);
  });

  /**
   * 🔴🔴 **CPO 전제를 실측으로 정정한다.** 「과거에 국내 후보가 여러 개 발견됐다」의
   *    분모를 보면, human SAME 중 **한국 TLD 는 하나뿐** 이다.
   *    🔴 그 외(`global.trenbe.com` · `tinyapple.net/en-kr`)는 한국 소비자를 보지만
   *       **TLD 가 한국이 아니다** ⟹ 운영 Market Attribution 은 KR 로 세지 않는다.
   *    🟢 그러므로 「국내 후보가 줄었다」가 아니라 **「애초에 국내 확정 후보가 1」** 이다.
   */
  it("🔴🔴 human SAME 중 **한국 TLD 는 1건** 이다(`biskuit.kr`)", () => {
    const krSame = reviewed().filter((r) => r.v === "SAME" && isKrTld(r.domain));
    expect(krSame.map((r) => r.domain)).toEqual(["biskuit.kr"]);
  });

  /** 🔴 한국 소비자용이지만 TLD 가 다른 것 — **별도로 센다**(§9 「너무 일찍 버리지 않는다」). */
  it("🟡 한국 소비자용인데 TLD 가 다른 후보를 **따로** 센다", () => {
    const koFacing = reviewed().filter(
      (r) => r.v === "SAME" && !isKrTld(r.domain) && /trenbe|en-kr/i.test(r.url),
    );
    expect(koFacing.length, "그 축이 사라졌다 — 분모를 다시 봐야 한다").toBeGreaterThan(0);
  });
});

describe("DSP-01 — 국내 축 funnel(재투입 · 새 Search 0)", () => {
  it.runIf(LIVE)(
    "🔴🔴 23 URL 을 운영 재투입 경로로 태운다",
    async () => {
      const { shopifySiteStrategy } = await import(
        "@commerce/crawler/src/site-strategies/shopify.site-strategy"
      );
      const { buildProductIdentityDna } = await import("@commerce/shared");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { runDomesticPriceCheck } = await import("../run-domestic-price-check");

      const rows = reviewed();
      const urls = [...new Set(rows.map((r) => r.url))];
      const extracted = await shopifySiteStrategy.extract(ORIGIN);
      const product = buildCanonicalProduct(ORIGIN, extracted!.productData as never, {} as never, []);
      const dna = buildProductIdentityDna(product);
      /* eslint-disable no-console */
      console.log(`[DSP01-origin] brand=${dna.brand.value} code=${dna.brandModelCode} 고유 URL=${urls.length}`);

      const r = (await runDomesticPriceCheck({
        snapshotId: SNAPSHOT,
        workspaceId: WORKSPACE,
        dna,
        description: product.description.value || undefined,
        /** 🔴 **검색이 아니다** — 이미 사람이 확정한 URL 을 다시 여는 운영 생산자다. */
        reviewedSameUrls: urls,
        webSearch: false,
      } as never)) as unknown as Record<string, unknown>;

      const ev = ((r.reviewedSameEvidence as Record<string, unknown>[] | null) ?? []).map((e) => ({
        domain: String(e.domain),
        url: String(e.discoveredUrl),
        market: String(e.market),
        tier: String(e.priceTier),
        verdict: String(e.crossSellerVerdict),
        price: e.priceAmount ?? null,
        currency: e.priceCurrency ?? null,
        priceStatus: String(e.priceStatus),
      }));
      const pool = r.reviewedSameUrlMetrics ?? r.webSearchUrlMetrics ?? null;

      const kr = ev.filter((e) => e.market === "KR");
      const withPrice = ev.filter((e) => e.price != null);
      console.log(
        `[DSP01-funnel] ${JSON.stringify({
          supplied: urls.length,
          evidence: ev.length,
          kr: kr.length,
          overseas: ev.filter((e) => e.market === "OVERSEAS").length,
          unknown: ev.filter((e) => e.market === "UNKNOWN").length,
          withPrice: withPrice.length,
          krWithPrice: kr.filter((e) => e.price != null).length,
          pool,
        })}`,
      );
      for (const e of ev) {
        console.log(
          `[DSP01-row] ${e.domain.padEnd(26)} market=${e.market.padEnd(9)} tier=${e.tier.padEnd(11)}` +
            ` verdict=${e.verdict.padEnd(14)} ${String(e.price ?? "-").padStart(8)} ${e.currency ?? ""} ${e.priceStatus}`,
        );
      }
      /** 🔴 어느 URL 이 **증거까지 못 왔는지** 를 그대로 적는다(「없다」로 뭉치지 않는다). */
      const arrived = new Set(ev.map((e) => e.url));
      const lost = urls.filter((u) => !arrived.has(u));
      console.log(`[DSP01-lost] ${lost.length}건`);
      for (const u of lost) console.log(`   - ${u.slice(0, 100)}`);

      writeFileSync(join(FIX, "dsp-01-funnel.json"), JSON.stringify({ urls, ev, lost, pool }, null, 2));
      expect(urls.length).toBeGreaterThan(0);
    },
    2_400_000,
  );
});
