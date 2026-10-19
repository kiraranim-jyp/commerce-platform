import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { searchDomesticShops, withConfidence, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";

/**
 * WU-092 STEP 3-AXES — **brand 가 아니면 «무엇이» SAME 을 막는가** (LIVE · 측정 전용)
 *
 * 🔴 CF 에서 blockers 가 **사라졌는데도** verdict 가 안 바뀌었다 ⟹ 구속은 blocker 가
 *    아니라 **축(reasons) 수** 다. 운영 `crossSellerReasons` 를 **그대로 읽는다**.
 */
const LIVE = process.env.MI_P0_02_LIVE === "1";
const URL = "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/?utm_source=chatgpt.com";
const SHOPS = [{ id: "bd66e5ab-94d0-44ce-bc45-bedf706aebcf", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const }];

describe("WU-092 AXES (LIVE)", () => {
  (LIVE ? it : it.skip)("후보 축 전수", async () => {
    const of_ = await factsFromProductUrl(URL);
    const base = of_.candidate!.facts!;
    const q = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: { ...base, brand: "Bobo Choses" } } as ComparisonQuery;
    // eslint-disable-next-line no-console
    /** 🔴 `ProductFacts` 에 `category`/`materialComposition` 칸이 있다고 **추측하지 않는다** — 타입이 거부했으므로 **있는 칸만** 적는다(이 트랙 19번째 같은 실수를 타입이 막았다). */
    console.log(`
원상품 facts: ${JSON.stringify({ brand: "Bobo Choses(CF)", code: base.brandModelCode, color: base.colorText })}`);
    for (const r of await searchDomesticShops(q, SHOPS)) {
      const scored = withConfidence(q, (r.candidates ?? []).filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url)));
      for (const x of scored) {
        // eslint-disable-next-line no-console
        console.log(`\n  ${x.title.slice(0, 40)}`);
        // eslint-disable-next-line no-console
        console.log(`    verdict=${x.crossSellerVerdict} code=${JSON.stringify(x.facts?.brandModelCode)} color=${JSON.stringify(x.facts?.colorText)}`);
        // eslint-disable-next-line no-console
        console.log(`    🔴 reasons(축) ${(x.crossSellerReasons ?? []).length}: ${JSON.stringify(x.crossSellerReasons ?? [])}`);
      }
    }
    expect(true).toBe(true);
  }, 900_000);
});
