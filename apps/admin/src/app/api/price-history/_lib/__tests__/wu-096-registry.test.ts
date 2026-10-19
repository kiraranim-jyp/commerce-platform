import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { searchDomesticShops, withConfidence, type ComparisonQuery } from "@commerce/crawler";
import { judgeDomesticCandidate } from "../run-domestic-price-check";

/**
 * WU-096 보조 — **등록부 검색 경로도 ⑧에서 DROPPED 되는가** (LIVE · 측정 전용)
 *
 * 🔴 WU-095 가 `matchLevel` 을 전건 `low` 로 되돌렸다. 그 경로(WU-093 S1)는
 *    수정 «전» 에 `very_high` 였으므로 ⑧ `isEvidenceEvaluationWorthwhile` 을
 *    **통과했을 수 있다**. 🔴 지금도 통과하는지 **측정** 한다 — 추측하지 않는다.
 * 🔴 운영 코드는 **한 줄도 바꾸지 않는다**.
 */
const LIVE = process.env.MI_P0_02_LIVE === "1";
const S1 = "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/";
const SHOPS = [
  { id: "bd66e5ab-94d0-44ce-bc45-bedf706aebcf", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
];

describe("WU-096 보조 — 등록부 경로 ⑧ (LIVE)", () => {
  (LIVE ? it : it.skip)("judgeDomesticCandidate 결과", async () => {
    const of_ = await factsFromProductUrl(S1);
    const q = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: of_.candidate!.facts } as ComparisonQuery;
    for (const r of await searchDomesticShops(q, SHOPS)) {
      const scored = withConfidence(q, r.candidates ?? []);
      // eslint-disable-next-line no-console
      console.log(`\n${r.domain} 후보 ${scored.length} · matchLevel ${JSON.stringify(scored.map((c) => c.matchLevel))}`);
      const j = await judgeDomesticCandidate({
        domain: r.domain,
        candidates: scored,
        sourceUrl: q.sourceUrl,
        foreignModelCode: q.facts?.brandModelCode ?? null,
        foreignColor: q.facts?.colorText ?? null,
        /** 🔴 추가 HTTP 0 — 도달 여부만 본다. */
        fetchModelCode: async () => null,
      });
      // eslint-disable-next-line no-console
      console.log(
        `  ⟹ **${j.kind}**` +
          (j.kind === "DROPPED" ? ` / gate=${j.gate}` : "") +
          (j.kind === "JUDGED" ? ` / tier=${j.priceTier} truth=${j.matchTruth} verified=${j.verified}` : ""),
      );
    }
    expect(true).toBe(true);
  }, 900_000);
});
