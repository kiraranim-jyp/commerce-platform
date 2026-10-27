import { describe, expect, it } from "vitest";
import { collectWebSearchUrls } from "../web-search-pool";

/**
 * 🔵 SEARCH-PROVIDER-07 — **운영 함수를 실제 provider 에 1회 쏜다**(라이브 게이트).
 * 🔴 기본 SKIP. `CORE_SP07_LIVE=1` + 토큰이 있을 때만 돈다. 🔴 검색 **1회** 다.
 */
const LIVE = process.env.CORE_SP07_LIVE === "1";

describe.skipIf(!LIVE)("SP-07 라이브 — 운영 경로가 실제로 URL 을 받아 온다", () => {
  it(
    "품번 1건 · 검색 1회",
    async () => {
      const r = await collectWebSearchUrls({
        identity: {
          brand: "Bobo Choses",
          productName: null,
          productType: null,
          genderAge: null,
          color: null,
          size: null,
          season: null,
          productCode: "B226AC009",
          sourceUrl: "https://bobochoses.com/en-kr/products/b226ac009-hug-hairy-monster-t-shirt",
          sourceSite: null,
          sourceCountry: null,
          market: null,
        },
      });
      console.log(
        `  query=${r.metrics.query} searches=${r.metrics.searches} organic=${r.metrics.organicResults} skipped=${r.metrics.skipped} failed=${r.metrics.failed}`,
      );
      for (const u of r.urls) console.log(`   ${u}`);
      expect(r.metrics.searches).toBe(1);
      expect(r.metrics.skipped).toBeNull();
      expect(r.metrics.failed).toBe(false);
      expect(r.urls.length).toBeGreaterThan(0);
    },
    300_000,
  );
});
