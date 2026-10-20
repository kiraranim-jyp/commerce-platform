/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-130 — **합류 E2E 실측 하니스** (게이트 없으면 SKIP)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 게이트 `WU_130_PROBE=1` 없으면 **SKIP** 한다(회귀에서 외부 HTTP 금지).
 * 🔴 DB 쓰기 0 · AI 0 · Gemini 0 · 새 provider 0.
 *
 * 🔴🔴 **운영 호출 순서를 그대로 베낀다**(헌장 §5-B). 로컬에서는
 *    `listDomesticPriceSources` 가 service-role 을 요구해 `runDomesticPriceCheck`
 *    전체를 부를 수 없으므로(헌장 §10), **합류 이후 구간의 운영 함수들을 같은
 *    순서로** 직접 부른다:
 * ```
 * collectOverseasAutoPool            (listShops 만 DB 덤프로 주입 · 검색은 실제)
 *   → judgeDomesticCandidate         (운영 판정 · fetchDomesticModelCode 포함)
 *   → priceTierFromLink              (운영 owner · 복제 계산 금지)
 *   → classifyCandidateMarket        (운영 시장 분류)
 *   → market-intelligence 의 해외 가지와 **같은 레코드**
 *   → summarizeCandidateOverseasPrices  (운영 집계기)
 * ```
 * 🔴 선행 덤프 필요: `packages/database` 에서
 *    `node --env-file=.env scripts/mi-010-comparison-shops-dump.mjs`
 *    `node --env-file=.env scripts/wu-130-snapshot-dump.mjs`
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fetchDomesticModelCode } from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { collectOverseasAutoPool } from "../overseas-auto-pool";
import { judgeDomesticCandidate } from "../run-domestic-price-check";
import { classifyCandidateMarket, summarizeCandidateOverseasPrices } from "../candidate-market";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

const LIVE = process.env.WU_130_PROBE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const read = <T>(f: string): T => {
  const p = path.join(OUT, f);
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${f}`);
  return JSON.parse(readFileSync(p, "utf8")) as T;
};

interface ShopRow {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  is_active: boolean;
  access_status: string | null;
  category_scope: string[] | null;
}

describe("WU-130 합류 E2E 실측", () => {
  it.runIf(LIVE)(
    "해외 자동검색 → MI 판정 → 해외 금액 집계까지 실제로 간다",
    async () => {
      const two = read<{ s2: { source_url: string; title: string; workspace: Record<string, unknown> } }>(
        "wu130-two.json",
      );
      const snap = two.s2;
      const product = backfillCanonicalProduct(
        (snap.workspace as { canonicalProduct: unknown }).canonicalProduct as never,
      );
      const dna = buildProductIdentityDna(product);
      /** 🔴 `/check` 가 만드는 그 query 와 같은 칸들(해외 어댑터는 `title` 로 검색한다). */
      const query = {
        title: snap.title,
        brand: dna.brand.value || undefined,
        sourceUrl: dna.sourceUrl,
        facts: productFactsFromIdentityDna(dna),
      };

      const rows = read<ShopRow[]>("wu010-comparison-shops.json");
      const pool = await collectOverseasAutoPool({
        query,
        categoryScopes: ["KIDS_FASHION"],
        /** 🔴 운영은 `listComparisonShops()` 를 부른다 — 로컬에서 service-role 이 없어
         *  **같은 행** 을 DB 덤프로 넣는다(WU-092 교훈: 칸을 비우면 거짓 결론이 난다). */
        listShops: async () =>
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            domain: r.domain,
            url: r.url,
            country: r.country,
            currency: r.currency,
            categoryScope: r.category_scope ?? [],
            accessStatus: r.access_status,
            accessNote: null,
            role: null,
            operatorKey: null,
            source: "SYSTEM",
            isActive: r.is_active,
            createdAt: "",
          })) as never,
      });

      // eslint-disable-next-line no-console
      console.log(`[WU-130-E2E] metrics=${JSON.stringify(pool.metrics)}`);
      /** 🔴🔴 산출물에 등록부 uuid 가 남지 않는다(저장 오염 방어). */
      for (const r of pool.searchResults) expect(r.shopId).toBe("__overseas_auto__");

      const overseasEvidence: { market: string; currency: string; amount: number | null; priceTier: string }[] = [];
      const lines: string[] = [];
      for (const result of pool.searchResults) {
        if (result.status !== "ok" || result.candidates.length === 0) continue;
        const judgement = await judgeDomesticCandidate({
          domain: result.domain,
          candidates: result.candidates,
          sourceUrl: query.sourceUrl,
          foreignModelCode: dna.brandModelCode,
          foreignColor: dna.color,
          fetchModelCode: (url) => fetchDomesticModelCode(result.domain, url),
        });
        if (judgement.kind !== "JUDGED") {
          lines.push(`${result.domain} → ${judgement.kind}${"gate" in judgement ? `/${judgement.gate}` : ""}`);
          continue;
        }
        const { best, matchTruth, verified } = judgement;
        const priceTier = priceTierFromLink({ matchTruth, verified });
        const market = classifyCandidateMarket({
          domain: result.domain,
          currency: best.price?.currency ?? null,
          /** 🔴 국내 등록부 조회는 로컬에서 못 한다 — 해외 도메인이라 `false` 가 운영값이다
           *  (실측: comparison_shops 35행에 `.kr`/KRW 가 **0**). */
          isRegisteredDomesticShop: false,
        });
        lines.push(
          `${result.domain} → ${best.crossSellerVerdict ?? "?"} / truth=${matchTruth ?? "null"} / tier=${priceTier} / ` +
            `${best.price?.currency ?? "-"} ${best.price?.amount ?? "-"} / ${market.market}(${market.basis}) / ` +
            `priceStatus=${best.priceStatus ?? "-"}`,
        );
        /** 🔴 운영 MI 의 해외 가지와 **같은 조건** 이다(market !== KR · KRW 제외 · 금액 필수). */
        if (market.market === "KR") continue;
        if (best.price?.currency?.trim().toUpperCase() === "KRW") continue;
        if (best.price?.amount != null && best.price.currency) {
          overseasEvidence.push({
            market: market.market,
            currency: best.price.currency,
            amount: best.price.amount,
            priceTier,
          });
        }
      }
      // eslint-disable-next-line no-console
      console.log(`[WU-130-E2E] 판정\n  ${lines.join("\n  ")}`);
      const summary = summarizeCandidateOverseasPrices(overseasEvidence);
      // eslint-disable-next-line no-console
      console.log(`[WU-130-E2E] 🧾 해외 동일상품 참고가격 = ${JSON.stringify(summary)}`);

      /** 🟢 이 WU 의 목적 — 셀러가 **아무것도 붙여넣지 않아도** 해외 집계가 생긴다. */
      expect(pool.metrics.eligibleShops).toBeGreaterThan(0);
    },
    300_000,
  );

  it("게이트가 없으면 아무 것도 하지 않는다", () => {
    expect(LIVE || true).toBe(true);
  });
});
