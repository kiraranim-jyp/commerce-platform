import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { searchDomesticShops, withConfidence, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";

/** WU-094 보조 — **왜 conf 가 정확히 0.95 인가.** `match.ts` 에 바닥값이 «둘» 있다:
 *  ⒜ `URL slug 일치` ⒝ `품번이 URL에 포함됨`. 어느 쪽이 발화했는지 **reasons 로** 읽는다. */
const LIVE = process.env.MI_P0_02_LIVE === "1";
const URL = "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/";
const SHOPS = [{ id: "bd66e5ab-94d0-44ce-bc45-bedf706aebcf", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const }];

describe("WU-094 — 왜 0.95 인가 (LIVE)", () => {
  (LIVE ? it : it.skip)("matchReasons 전수", async () => {
    const of_ = await factsFromProductUrl(URL);
    const q = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: of_.candidate!.facts, sku: of_.candidate?.sku } as ComparisonQuery;
    // eslint-disable-next-line no-console
    console.log(`\n원상품 sku=${JSON.stringify(of_.candidate?.sku)} sourceUrl=${of_.crawlerUrl}`);
    for (const r of await searchDomesticShops(q, SHOPS))
      for (const x of withConfidence(q, (r.candidates ?? []).filter((c) => !isSelfReferenceCandidate(q.sourceUrl, c.url))))
        // eslint-disable-next-line no-console
        console.log(`  conf=${x.confidence} sku=${JSON.stringify(x.sku)}\n     reasons=${JSON.stringify(x.matchReasons)}\n     ${x.title.slice(0, 36)}`);
    expect(true).toBe(true);
  }, 900_000);
});
