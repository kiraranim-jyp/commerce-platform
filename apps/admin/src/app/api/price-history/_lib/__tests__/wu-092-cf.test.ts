import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler/src/comparison-search/product-url-facts";
import { searchDomesticShops, withConfidence, isSelfReferenceCandidate, type ComparisonQuery } from "@commerce/crawler";

/**
 * WU-092 STEP 3-CF — **S1 의 구속 조건이 「원상품 brand 오염」인지** 확정한다 (LIVE)
 *
 * 🔴 **구현이 아니라 측정이다.** 운영 코드는 **한 줄도 바꾸지 않는다**(CPO 금지).
 *    원상품 facts 의 `brand` 만 **입력으로** 바꿔 같은 운영 함수에 넣는다.
 * 🔴 이것은 「brand 축을 완화한다」가 **아니다** — 「원상품이 올바른 브랜드를 가졌다면
 *    무슨 일이 일어나는가」를 재는 것이다. 두 질문을 섞지 않는다.
 */
const LIVE = process.env.MI_P0_02_LIVE === "1";
const URL = "https://biskuit.kr/product/%EB%B3%B4%EB%B3%B4%EC%87%BC%EC%A6%88-%ED%97%88%EA%B7%B8-%ED%97%A4%EC%96%B4%EB%A6%AC-%EB%AA%AC%EC%8A%A4%ED%84%B0-%ED%8B%B0%EC%85%94%EC%B8%A0-b226ac009/8891/category/367/display/1/?utm_source=chatgpt.com";
const SHOPS = [
  { id: "bd66e5ab-94d0-44ce-bc45-bedf706aebcf", name: "LOOXLOO", domain: "looxloo.com", currency: "KRW", collectionStrategy: "AUTO_SCRAPE" as const },
];

describe("WU-092 CF — 원상품 brand 오염의 효과 (LIVE)", () => {
  (LIVE ? it : it.skip)("brand 「비스킷」 ↔ 「Bobo Choses」", async () => {
    const of_ = await factsFromProductUrl(URL);
    const base = of_.candidate!.facts!;
    const run = async (brand: string | null, label: string) => {
      /** 🔴 facts 를 **복제** 해서 brand 칸만 바꾼다. 다른 칸은 운영이 만든 그대로다. */
      const q = { title: of_.candidate!.title, sourceUrl: of_.crawlerUrl!, facts: { ...base, brand } } as ComparisonQuery;
      const rs = await searchDomesticShops(q, SHOPS);
      const out: string[] = [];
      for (const r of rs) {
        const scored = withConfidence(q, (r.candidates ?? []).filter((x) => !isSelfReferenceCandidate(q.sourceUrl, x.url)));
        for (const x of scored)
          out.push(`${String(x.crossSellerVerdict).padEnd(14)} ${String(x.matchLevel).padEnd(10)} blockers=${JSON.stringify((x.crossSellerBlockers ?? []).map((b) => (b as { blocker: string }).blocker))}  ${x.title.slice(0, 40)}`);
      }
      // eslint-disable-next-line no-console
      console.log(`\n── ${label} (brand=${JSON.stringify(brand)}) ──`);
      for (const l of out) console.log(`   ${l}`);
      return out;
    };
    const now = await run(base.brand ?? null, "현재(운영)");
    const cf = await run("Bobo Choses", "CF — 원상품 브랜드가 올바르다면");
    const cfNull = await run(null, "CF2 — 원상품 브랜드가 «비어» 있다면");
    // eslint-disable-next-line no-console
    console.log(`\n🔴 SAME 수  현재 ${now.filter((x) => x.startsWith("SAME")).length} · CF ${cf.filter((x) => x.startsWith("SAME")).length} · CF2 ${cfNull.filter((x) => x.startsWith("SAME")).length}`);
    expect(now.length).toBeGreaterThan(0);
  }, 900_000);
});
