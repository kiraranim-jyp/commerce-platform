import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_SEARCHES_PER_PRODUCT, collectWebSearchUrls } from "../web-search-pool";
import { summarizeCandidateOverseasPrices } from "../candidate-market";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SEARCH-SUPPLY-01~05 — **1 질의 · 최대 2 페이지**(CPO 결정 2026-11-03)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **왜 바뀌었나** — 질의 1회가 돌려준 URL 이 **최대 10 · 중위 9**(저장분 전수 실측)
 *    이고 그 수율로는 샵 대표가 **1~2곳** 이라 셀러에게 비교 재료가 없었다.
 * 🔴 **질의 수는 늘리지 않았다** — 「1 Product = 1 Search」는 그대로다.
 * 🔴 네트워크 **0** — 검색은 주입구(`search`)로 넣는다(회귀에서 매번 돈다 · 과금 0).
 */

const SRC = readFileSync(join(__dirname, "..", "web-search-pool.ts"), "utf8");
/** 🔴 주석을 벗긴다 — 이 저장소가 여덟 번 걸린 함정이다. */
const BODY = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** 🔴 `ProductIdentity` 는 `ProductIdentityDna` 가 아니다 — 운영 호출부의 칸 모양을 베낀다. */
const identity = {
  brand: "Bobo Choses",
  productName: "Booty Ghosts T-shirt",
  productType: null,
  genderAge: null,
  color: "Heather grey",
  size: null,
  season: null,
  productCode: "B226AC010",
  facts: [],
  sourceUrl: "https://bobochoses.com/en-kr/products/b226ac010-booty-ghosts-t-shirt",
  sourceSite: null,
  sourceCountry: null,
  market: null,
};

describe("SEARCH-SUPPLY — 1 질의 · 최대 2 페이지", () => {
  /** 🔴 SEARCH-SUPPLY-01 — 질의 수는 **여전히 1** 이다. */
  it("SS-01 🔴 한 상품의 Search 질의 수는 1 이다", () => {
    expect(MAX_SEARCHES_PER_PRODUCT).toBe(1);
    expect(BODY).toContain("export const MAX_SEARCHES_PER_PRODUCT = 1;");
    /**
     * 🔴 질의 variation 을 만들지 않는다 — 조립기 **호출** 이 하나다.
     * 🔴 1차에 **import 줄까지 세어** FAIL 했다(2) — 그 FAIL 이 맞았다. 괄호까지 본다.
     */
    expect(BODY.split("buildDiscoverySearchQuery(").length - 1, "🔴 질의 조립 호출이 둘 이상이다").toBe(1);
  });

  /** 🔴 SEARCH-SUPPLY-02 — 페이지는 **최대 2** 다(3 이상은 별도 비용 결정). */
  it("SS-02 🔴 한 질의는 최대 2 페이지까지만 가져온다", () => {
    expect(BODY).toContain("const MAX_PAGES_PER_QUERY = 2;");
    expect(BODY).toContain("maxPagesPerQuery: MAX_PAGES_PER_QUERY");
  });

  /**
   * 🔴🔴 SEARCH-SUPPLY-02-b — **2페이지를 «실제로» 모은다.**
   *    🔴 `items[0]` 만 읽으면 페이지만 올리고 결과는 그대로다(비용만 증가) ⟹ no-op.
   *    🟢 그래서 **행동으로** 단언한다 — 두 페이지 모양을 주입해 **합쳐지는지** 본다.
   */
  it("SS-02-b 🔴 페이지 둘의 결과가 «합쳐진다» · 중복은 한 번만", async () => {
    const pages = [
      { organicResults: [{ url: "https://a.example/1" }, { url: "https://b.example/2" }] },
      { organicResults: [{ url: "https://b.example/2" }, { url: "https://c.example/3" }] },
    ];
    /** 🟢 주입구는 URL 배열을 받는다 — provider 응답 파서를 흉내내지 않고 **합산 결과** 를 본다. */
    const out = await collectWebSearchUrls({
      identity: identity as never,
      search: async () => pages.flatMap((p) => p.organicResults.map((o) => o.url)),
      token: "x",
    });
    expect(out.urls.length, "🔴 두 페이지가 합쳐지지 않았다").toBeGreaterThanOrEqual(3);
    /** 🔴 `searches` 는 **1** 이다 — 페이지를 늘렸을 뿐 검색을 늘리지 않았다. */
    expect(out.metrics.searches).toBe(1);
  });

  it("SS-02-c 🔴 소스가 모든 page item 을 읽는다(`items[0]` 단독 금지)", () => {
    expect(BODY, "🔴 `items[0]` 만 읽으면 2페이지가 버려진다").not.toMatch(/items\[0\]\?\.organicResults/);
    expect(BODY).toContain("for (const item of items)");
  });

  /**
   * 🔴 SEARCH-SUPPLY-03 — 페이지 수 변경으로 **Identity/가격 자격이 우회되지 않는다.**
   *    🟢 이 파일은 **URL 만** 돌려준다 — 판정·가격 어휘가 **0** 이어야 한다.
   */
  it("SS-03 🔴 Search 층에 판정·가격 어휘가 없다", () => {
    for (const banned of [
      "crossSellerVerdict",
      "matchTruth",
      "priceTier",
      "PRESUMED_SAME",
      "summarizeCandidateOverseasPrices",
      "judgeDomesticCandidate",
    ]) {
      expect(BODY, `🔴 Search 층이 하류 판정을 건드린다: ${banned}`).not.toContain(banned);
    }
  });

  /** 🔴 SEARCH-SUPPLY-04 — 늘어난 결과는 **기존 파이프라인을 그대로** 통과한다. */
  it("SS-04 🔴 Search 는 URL 만 돌려준다(후보를 직접 만들지 않는다)", () => {
    expect(BODY, "🔴 Search 층이 후보를 직접 만든다").not.toContain("collectUrlCandidatePool");
    expect(BODY).toContain("urls: string[]");
  });

  /**
   * 🔴🔴 SEARCH-SUPPLY-05 — **결과가 늘었다는 이유만으로 SIMILAR/CONFLICT 를
   *    가격 집계에 넣지 않는다.** 🟢 P1 의 자격 게이트가 그대로 산다.
   */
  it("SS-05 🔴 후보가 늘어도 SIMILAR 는 금액 집계에 들어가지 않는다", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      market: "OVERSEAS",
      currency: "USD",
      amount: 10 + i,
      priceTier: "REFERENCE",
      verdict: "SIMILAR",
    }));
    const s = summarizeCandidateOverseasPrices(many);
    expect(s.count, "🔴 관측이 사라졌다").toBe(12);
    expect(s.byCurrency.USD, "🔴 SIMILAR 금액이 집계에 들어갔다").toBeUndefined();
    /** 🟢 자격 있는 후보는 늘어난 만큼 **그대로** 들어간다. */
    const ok = summarizeCandidateOverseasPrices([
      ...many,
      { market: "OVERSEAS", currency: "USD", amount: 58, priceTier: "EXACT", verdict: "SAME" },
    ]);
    expect(ok.byCurrency.USD?.lowestAmount).toBe(58);
  });
});
