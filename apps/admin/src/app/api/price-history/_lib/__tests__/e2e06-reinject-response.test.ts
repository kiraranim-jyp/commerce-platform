import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 DISCOVERY E2E-06 — **이미 발생한 Search 결과를 «재주입» 해 response 까지 증명**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 확정(2026-10-28): 새 Search 금지. 이미 있는 결과를 **운영 pipeline 에 다시 태워**
 * `web-search pool → JUDGED → evidence → response` 를 직접 캡처한다.
 *
 * ── 🟢 어떻게 Apify 를 0 으로 만드는가 ──────────────────────────────────────
 * ```
 * `collectWebSearchUrls` **하나만** mock 한다(= 검색 호출 그 자체).
 * 🟢 그 뒤는 **전부 운영 코드** 다 — collectUrlCandidatePool · withConfidence ·
 *    enrichCandidatePrices · judgeDomesticCandidate · evidence push · 반환 조립.
 * 🔴 운영 입력을 손으로 만들지 않는다 — dna 는 운영 추출 경로로 만든다
 *    (`shopifySiteStrategy.extract` → `buildCanonicalProduct` → `buildProductIdentityDna`).
 *    1차에 `{title, sourceUrl}` 을 지어냈다가 `crossSellerVerdict` 가 전건 undefined 로
 *    나왔던 그 실수를 반복하지 않는다(E2E-05 기록).
 * ```
 *
 * ── 🔴 이 측정의 한계(먼저 적는다) ─────────────────────────────────────────
 * ```
 * ⒜ 🔴🔴 **URL 9건은 CEO 09:44 실행의 것이 아니다.** 운영은 검색 URL 을 로그에
 *    남기지 않는다 ⟹ 그 실행의 입력 집합은 **영구 측정불가** 다. 같은 질의
 *    (`"B226AC009"`)의 **다른 실행** 산출이고 SP-10 이 실행 간 겹침을 3~30% 로 쟀다.
 * ⒝ DB(service-role)가 없어 **등록부 검색은 비어서** 돈다 ⟹ 이 하니스의 관심은
 *    **web-search 경로 하나** 다(다른 생산자 수치를 운영 값으로 읽지 않는다).
 * ⒞ fetch 는 이 PC(한국 가정용 IP)에서 나간다 — 운영은 Vercel egress 다.
 * ```
 */

const LIVE = process.env.E2E06_LIVE === "1";
const CEO_SNAPSHOT = "c88d2ca4-bfe1-4851-9c1d-92f69222a3f2";
const CEO_WORKSPACE = "b60b0ad7-d750-4f70-a1c3-a4d220f76756";
const CEO_ORIGIN = "https://bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt";

function storedSearchUrls(): string[] {
  const raw = JSON.parse(
    readFileSync(join(__dirname, "fixtures/search-provider-05-raw.json"), "utf8"),
  ) as { runs: { productId: string; query: string; results: { url: string }[] }[] };
  const run = raw.runs.find((r) => r.productId === "S2" && r.query === '"B226AC009"');
  if (!run) throw new Error("저장된 운영 질의 run 을 찾지 못했다");
  return run.results.map((r) => r.url);
}

/** 🔴 **검색 호출만** 가짜다. 나머지는 운영 코드가 그대로 돈다. */
vi.mock("../web-search-pool", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    collectWebSearchUrls: vi.fn(async () => ({
      urls: storedSearchUrls(),
      metrics: {
        searches: 1,
        query: '"B226AC009"',
        organicResults: storedSearchUrls().length,
        skipped: null,
        failed: false,
      },
    })),
  };
});

describe("E2E-06 — 저장된 Search 결과 재주입 → response 직접 캡처", () => {
  it("🟢 분모 고정 — 재주입 URL 은 9건이고 **새로 만들지 않았다**", () => {
    expect(storedSearchUrls()).toHaveLength(9);
  });

  it.runIf(LIVE)(
    "🔴🔴 운영 `runDomesticPriceCheck` 를 그대로 태워 `webSearchEvidence` 를 캡처한다",
    async () => {
      const { shopifySiteStrategy } = await import(
        "@commerce/crawler/src/site-strategies/shopify.site-strategy"
      );
      const { buildProductIdentityDna } = await import("@commerce/shared");
      const { buildCanonicalProduct } = await import("../../../pipeline/canonical-product");
      const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
      const { collectWebSearchUrls } = await import("../web-search-pool");

      const extracted = await shopifySiteStrategy.extract(CEO_ORIGIN);
      const product = buildCanonicalProduct(CEO_ORIGIN, extracted!.productData as never, {} as never, []);
      const dna = buildProductIdentityDna(product);
      /* eslint-disable no-console */
      console.log(`[E2E06-origin] brand=${JSON.stringify(dna.brand)} code=${dna.brandModelCode}`);

      const result = await runDomesticPriceCheck({
        snapshotId: CEO_SNAPSHOT,
        workspaceId: CEO_WORKSPACE,
        dna,
        description: null,
        webSearch: true,
      } as never);

      /** 🔴 Apify 는 **한 번도** 불리지 않았다 — mock 호출 수로 증명한다. */
      expect(vi.mocked(collectWebSearchUrls)).toHaveBeenCalledTimes(1);

      const ev = (result as { webSearchEvidence?: unknown[] | null }).webSearchEvidence;
      const poolM = (result as { webSearchUrlMetrics?: Record<string, unknown> | null })
        .webSearchUrlMetrics;
      console.log(`[E2E06-pool] ${JSON.stringify(poolM)}`);
      console.log(
        `[E2E06-evidence] type=${ev === null ? "null" : Array.isArray(ev) ? `array(${ev.length})` : typeof ev}`,
      );
      for (const row of (ev ?? []) as Record<string, unknown>[]) {
        console.log(
          `[E2E06-row] ${String(row.domain).padEnd(22)} source=${String(row.source).padEnd(12)}` +
            ` market=${String(row.market).padEnd(9)} tier=${String(row.priceTier).padEnd(11)}` +
            ` verdict=${String(row.crossSellerVerdict)}`,
        );
      }
      /** 🔴 측정이다 — 수치를 미리 고정하지 않는다. 단, **형태** 는 단언한다. */
      expect(ev === null || Array.isArray(ev)).toBe(true);
    },
    600_000,
  );
});
