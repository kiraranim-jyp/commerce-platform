import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mergeResolved, normalizeForDedupe, poolDiscovered, summarizePool } from "../candidate-pool";
import { runLane, tallyFailures } from "../harness";
import { computeJobKpi, ratio, renderRatio } from "../kpi";
import { generateQueries, unaskedQueryIds } from "../query-generator";
import { classifyUrlShape, isCrawlable, resolveCandidate, toCrawlerUrl, type PageProbe } from "../url-resolver";
import type { DiscoveredUrl, DiscoveryProvider, JobFixture, ProductIdentity, ResolvedCandidate } from "../types";

/**
 * MI-DISCOVERY-LONGSPRINT-P1 — 하니스 계약 테스트.
 *
 * 🔴 픽스처는 **2026-10-07 실측값** 이다. Main Story Bubble Sweatshirt Grey Melange
 *    (AW26MS185)와 그 상품을 검색해 실제로 돌아온 URL 10개가 그대로 들어 있다.
 *    깨끗한 값으로 만들면 「목록 페이지 7건」같은 현실을 놓친다.
 */

const IDENTITY: ProductIdentity = {
  brand: "Main Story",
  productName: "Bubble Sweatshirt",
  productType: "sweatshirt",
  genderAge: "kids",
  color: "Grey Melange",
  size: "2-12",
  season: "AW26",
  productCode: "AW26MS185",
  sourceUrl: "https://www.junioredition.com/products/bubble-sweatshirt-in-grey-melange-by-main-story",
  sourceSite: "junioredition.com",
  sourceCountry: "GB",
  market: "GB",
};

/* ═════════════ ① QueryGenerator ═════════════ */

describe("P1 ①: QueryGenerator", () => {
  it("칸이 다 있으면 여덟 축을 전부 만든다", () => {
    const qs = generateQueries(IDENTITY);
    expect(qs.map((q) => q.id)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"]);
    expect(qs.find((q) => q.id === "Q4")?.text).toBe("Main Story Bubble Sweatshirt Grey Melange");
    expect(qs.find((q) => q.id === "Q5")?.text).toBe("AW26MS185");
  });

  /** 🔴 없는 칸으로 쿼리를 «지어내지» 않는다 — 그러면 「못 물어본 것」이
   *  「검색이 실패한 것」으로 둔갑한다. */
  it("색상이 없으면 색상 축을 만들지 않고, 못 물어본 축으로 «보고한다»", () => {
    const noColor: ProductIdentity = { ...IDENTITY, color: null };
    const ids = generateQueries(noColor).map((q) => q.id);
    expect(ids).not.toContain("Q3");
    expect(ids).not.toContain("Q4");
    expect(unaskedQueryIds(noColor)).toEqual(["Q3", "Q4"]);
  });

  it("빈 문자열·공백도 «없는 것» 으로 본다", () => {
    const blank: ProductIdentity = { ...IDENTITY, productCode: "   " };
    expect(generateQueries(blank).map((q) => q.id)).not.toContain("Q5");
  });
});

/* ═════════════ ② URL 분류 — 실측 10건 ═════════════ */

describe("P1 ②: URL 모양 분류 (2026-10-07 실측 URL)", () => {
  it("상품 상세 URL", () => {
    expect(classifyUrlShape("https://www.junioredition.com/products/bubble-sweatshirt-in-grey-melange-by-main-story")).toBe("PRODUCT_PAGE");
    expect(classifyUrlShape("https://www.wonderforkids.nl/main-story-bubble-sweatshirt-grey-melange-fleece.html")).toBe("PRODUCT_PAGE");
  });

  it("목록/브랜드 페이지 — 실측에서 7건이 이것이었다", () => {
    for (const u of [
      "https://www.junioredition.com/collections/bobo-choses",
      "https://thegetalongshop.com/collections/bobo-choses",
      "https://www.kodomoboston.com/collections/bobo-choses",
      "https://www.ladida.com/collections/bobo-choses",
      "https://main-story.com/collections/all",
      "https://main-story.com/collections/new-arrivals",
    ]) {
      expect(classifyUrlShape(u), u).toBe("LISTING_PAGE");
    }
  });

  /**
   * 🔴 **순서가 계약이다.** Shopify 는 목록 «아래» 에 상품을 둔다 — 저장소
   * scripts/register-voyage-dress-live.ts 의 실제 URL 이 이 모양이다. 목록 판별이
   * 먼저 오면 진짜 상품이 버려진다.
   */
  it("🔴 목록 «아래» 중첩된 상품 URL 은 상품이다", () => {
    expect(
      classifyUrlShape(
        "https://www.junioredition.com/en-kr/collections/misha-and-puff-sale/products/voyage-dress-in-bright-sky-blossom-plaid-by-misha-puff",
      ),
    ).toBe("PRODUCT_PAGE");
  });

  it("모르는 모양은 PRODUCT 로 올리지 않는다", () => {
    expect(classifyUrlShape("https://main-story.com/")).toBe("UNKNOWN_PAGE");
    expect(classifyUrlShape("https://microapartment.jp/?cbid=1994048&mode=cate")).toBe("UNKNOWN_PAGE");
    expect(classifyUrlShape("not a url")).toBe("UNUSABLE");
  });

  /** 🔴 `.html` «자체» 는 상품의 증거가 아니다. 지시서 §2-A 가 `/...html` 을 상품
   *  후보로 넣었지만, 그대로 두면 회사소개·목록 페이지까지 상품이 되어 크롤러가
   *  엉뚱한 페이지를 상품으로 읽는다. 확실히 아닌 파일명만 걸러 낸다. */
  it("🔴 .html 이라도 확실히 상품이 아닌 파일명은 상품으로 올리지 않는다", () => {
    for (const u of [
      "https://shop.example/index.html",
      "https://shop.example/about-us.html",
      "https://shop.example/category.html",
      "https://shop.example/en/collections.html",
    ]) {
      expect(classifyUrlShape(u), u).toBe("UNKNOWN_PAGE");
    }
    // 🟢 그러면서 실측 상품(.html)은 그대로 상품이다 — 과잉 차단이 아니다.
    expect(
      classifyUrlShape("https://www.wonderforkids.nl/main-story-bubble-sweatshirt-grey-melange-fleece.html"),
    ).toBe("PRODUCT_PAGE");
  });
});

/* ═════════════ ③ 크롤러용 URL 재조립 (P1.1 §3) ═════════════ */

describe("P1 ③: 검색 URL 을 그대로 크롤러에 넘기지 않는다", () => {
  /** 🔴 실측: junioredition 상품 URL 은 `/en-kr/` 로 리다이렉트된다. 기존 크롤러는
   *  로케일이 있으면 그 로케일 가격(KRW)을 믿는 분기를 탄다 — 원산지 기준가가 아니다. */
  it("🔴 로케일 프리픽스를 떼고 origin+handle 로 재조립한다", () => {
    const r = toCrawlerUrl(
      "https://www.junioredition.com/en-kr/collections/misha-and-puff-sale/products/voyage-dress-in-bright-sky-blossom-plaid-by-misha-puff",
      "PRODUCT_PAGE",
    );
    expect(r.crawlerUrl).toBe(
      "https://www.junioredition.com/products/voyage-dress-in-bright-sky-blossom-plaid-by-misha-puff",
    );
    expect(r.localeNormalized).toBe(true);
    // 🔴 목록 경로도 함께 사라진다 — 재조립이지 문자열 치환이 아니다.
    expect(r.crawlerUrl).not.toContain("collections");
    expect(r.crawlerUrl).not.toContain("en-kr");
  });

  it("🔴 목록 페이지에는 크롤러 URL 을 주지 않는다", () => {
    expect(toCrawlerUrl("https://main-story.com/collections/all", "LISTING_PAGE").crawlerUrl).toBeNull();
  });

  it("판매처(origin)가 dedupe 키에 들어간다 — 판매처를 합치지 않는다", () => {
    const a = toCrawlerUrl("https://a.com/products/x", "PRODUCT_PAGE");
    const b = toCrawlerUrl("https://b.com/products/x", "PRODUCT_PAGE");
    expect(a.dedupeKey).not.toBe(b.dedupeKey);
  });

  /**
   * 🔴 **가드가 둘이다 — 그리고 둘 다 테스트가 지킨다.**
   *
   * ① `toCrawlerUrl` 의 shape 게이트 (변이 실측: 지우면 3건 실패)
   * ② `isCrawlable` 의 classification 확인
   *
   * 변이 대조에서 ②를 지웠더니 **아무 테스트도 실패하지 않았다** — ①이 이미
   * `crawlerUrl` 을 null 로 만들어서 ②가 도달 불가였기 때문이다. 즉 ②는 의도된
   * 이중 방어인데 «검증되지 않은» 상태였다. 아래가 그 자리를 메운다: ①이 어떤
   * 이유로 뚫려도(배선 실수·리팩터) ②가 혼자서 막는다는 것을 직접 단언한다.
   */
  it("🔴 이중 방어 — classification 이 상품이 아니면 crawlerUrl 이 «있어도» 크롤하지 않는다", () => {
    const wired: ResolvedCandidate = {
      searchUrl: "https://a.com/collections/all",
      finalUrl: "https://a.com/collections/all",
      // 있을 수 없는 조합이지만, 누군가 배선을 잘못하면 생길 수 있는 상태다.
      crawlerUrl: "https://a.com/collections/all",
      classification: "LISTING_PAGE",
      steps: ["SEARCH_URL"],
      httpStatus: 200,
      dedupeKey: "https://a.com|/collections/all",
      provenance: [],
    };
    expect(isCrawlable(wired)).toBe(false);
  });
});

/* ═════════════ ④ Resolver — 실측 실패 3종 ═════════════ */

function probeFrom(table: Record<string, { status: number; finalUrl?: string; canonicalUrl?: string | null }>): PageProbe {
  return async (url: string) => {
    const hit = table[url];
    if (!hit) throw new Error(`픽스처에 없는 URL: ${url}`);
    return { status: hit.status, finalUrl: hit.finalUrl ?? url, canonicalUrl: hit.canonicalUrl ?? null };
  };
}

const PROV: DiscoveredUrl[] = [
  { url: "x", providerId: "test", queryId: "Q4", rank: 1, title: null, snippet: null, priceHint: null },
];

describe("P1 ④: Resolver — 실측된 실패 3종", () => {
  it("🔴 302 → 홈: URL 모양이 상품이어도 UNUSABLE 이다 (main-story 실측)", async () => {
    const url = "https://main-story.com/products/bubble-sweatshirt-grey-melange";
    const r = await resolveCandidate(url, PROV, probeFrom({ [url]: { status: 200, finalUrl: "https://main-story.com/" } }));
    expect(r.classification).toBe("UNUSABLE");
    expect(r.steps).toContain("REDIRECTED");
    expect(r.crawlerUrl).toBeNull();
    expect(isCrawlable(r)).toBe(false);
  });

  it("404: 검색 색인이 낡았다 (wonderforkids 실측)", async () => {
    const url = "https://www.wonderforkids.nl/main-story-bubble-sweatshirt-grey-melange-fleece.html";
    const r = await resolveCandidate(url, PROV, probeFrom({ [url]: { status: 404 } }));
    expect(r.classification).toBe("NOT_FOUND");
    expect(isCrawlable(r)).toBe(false);
  });

  it("🔴 목록 페이지는 보류한다 — 상품을 «추출하지 않는다»", async () => {
    const url = "https://www.ladida.com/collections/bobo-choses";
    const r = await resolveCandidate(url, PROV, probeFrom({ [url]: { status: 200 } }));
    expect(r.classification).toBe("LISTING_PAGE");
    expect(r.crawlerUrl).toBeNull();
    expect(isCrawlable(r)).toBe(false);
  });

  it("canonical 이 다르면 따라가고 기록한다 (main-story `-1` 실측)", async () => {
    const url = "https://main-story.com/products/bubble-sweatshirt-grey-melange-x";
    const canonical = "https://main-story.com/products/bubble-sweatshirt-grey-melange-1";
    const r = await resolveCandidate(url, PROV, probeFrom({ [url]: { status: 200, canonicalUrl: canonical } }));
    expect(r.steps).toContain("CANONICALIZED");
    expect(r.finalUrl).toBe(canonical);
    expect(r.crawlerUrl).toBe(canonical);
  });

  it("네트워크 실패를 「상품 없음」으로 적지 않는다", async () => {
    const r = await resolveCandidate("https://x.com/products/y", PROV, async () => {
      throw new Error("ENOTFOUND");
    });
    expect(r.classification).toBe("UNUSABLE");
    expect(r.classification).not.toBe("NOT_FOUND");
  });
});

/* ═════════════ ⑤ Dedup ═════════════ */

describe("P1 ⑤: Dedup", () => {
  it("추적 파라미터만 지운다", () => {
    expect(normalizeForDedupe("https://a.com/products/x?utm_source=g&ref=y")).toBe("https://a.com/products/x");
  });

  /** 🔴 이 저장소는 `?variant=` 를 버렸다가 「UK 11 을 골라 준 URL 이 UK 4 가격으로
   *  바뀐」 사고를 냈다(P0-A.29-E). 쿼리스트링을 통째로 지우지 않는다. */
  it("🔴 ?variant= 는 지우지 않는다 — 다른 옵션은 다른 상품이다", () => {
    const a = normalizeForDedupe("https://a.com/products/x?variant=111");
    const b = normalizeForDedupe("https://a.com/products/x?variant=222");
    expect(a).not.toBe(b);
    expect(a).toContain("variant=111");
  });

  it("같은 URL 을 여러 쿼리가 찾으면 provenance 가 쌓인다", () => {
    const d = (q: DiscoveredUrl["queryId"]): DiscoveredUrl => ({
      url: "https://a.com/products/x",
      providerId: "p",
      queryId: q,
      rank: 1,
      title: null,
      snippet: null,
      priceHint: null,
    });
    const pooled = poolDiscovered([d("Q1"), d("Q4")]);
    expect(pooled).toHaveLength(1);
    expect(pooled[0].provenance.map((p) => p.queryId)).toEqual(["Q1", "Q4"]);
  });

  it("🔴 dedupeKey 가 null 인 후보는 병합하지 않는다 — 실패 원인이 서로 다르다", () => {
    const mk = (searchUrl: string): ResolvedCandidate => ({
      searchUrl,
      finalUrl: searchUrl,
      crawlerUrl: null,
      classification: "LISTING_PAGE",
      steps: ["SEARCH_URL"],
      httpStatus: 200,
      dedupeKey: null,
      provenance: [],
    });
    expect(mergeResolved([mk("https://a.com/collections/p"), mk("https://b.com/collections/q")])).toHaveLength(2);
  });
});

/* ═════════════ ⑥ Harness end-to-end (가짜 provider/crawler/MI) ═════════════ */

const LISTING = "https://www.ladida.com/collections/bobo-choses";
const PRODUCT = "https://www.junioredition.com/products/bubble-sweatshirt-in-grey-melange-by-main-story";
const DEAD = "https://www.wonderforkids.nl/main-story-bubble-sweatshirt-grey-melange-fleece.html";

function fakeProvider(urls: string[]): DiscoveryProvider {
  return {
    id: "fake",
    label: "fake",
    lane: "EXTERNAL",
    discover: async (_identity, query) =>
      urls.map((url, i) => ({ url, providerId: "fake", queryId: query.id, rank: i + 1, title: null, snippet: null, priceHint: null })),
  };
}

const JOB: JobFixture = {
  jobKey: "JOB-261007-005",
  snapshotId: "c80bd78a-92b9-4ca6-838d-5c6680352093",
  identity: IDENTITY,
  currentCandidates: [],
  groundTruth: {
    state: "CONFIRMED_SAME",
    entries: [
      { url: PRODUCT, sellerLabel: "Junior Edition", market: "OVERSEAS", verdict: "SAME", basis: "실측 fixture" },
      { url: "https://little-luna.example/products/x", sellerLabel: "Little Luna", market: "DOMESTIC", verdict: "SAME", basis: "CEO 확인" },
    ],
  },
};

const DEPS = {
  probe: probeFrom({
    [LISTING]: { status: 200 },
    [PRODUCT]: { status: 200 },
    [DEAD]: { status: 404 },
  }),
  crawler: { crawl: async () => ({ ok: true, facts: { title: "Bubble Sweatshirt - Grey Melange" }, reason: null }) },
  mi: {
    identify: async () => "EXACT_IDENTIFIER",
    priceTier: () => "EXACT",
  },
};

describe("P1 ⑥: Harness", () => {
  it("🔴 목록 페이지는 크롤러에 «한 번도» 가지 않는다", async () => {
    let crawled: string[] = [];
    const lane = await runLane("Hybrid", JOB, [fakeProvider([LISTING, PRODUCT, DEAD])], {
      ...DEPS,
      crawler: {
        crawl: async (u) => {
          crawled.push(u);
          return { ok: true, facts: {}, reason: null };
        },
      },
    });
    expect(crawled.every((u) => !u.includes("/collections/"))).toBe(true);
    expect(crawled).toHaveLength(1); // PRODUCT 하나만
    const held = lane.candidates.filter((c) => c.failureStage === "LISTING_PAGE_HELD");
    expect(held).toHaveLength(1);
  });

  it("🔴 크롤러에 간 URL 에는 로케일이 없다", async () => {
    const localeUrl = "https://www.junioredition.com/en-kr/products/abc";
    const crawled: string[] = [];
    await runLane("Hybrid", JOB, [fakeProvider([localeUrl])], {
      ...DEPS,
      probe: probeFrom({ [localeUrl]: { status: 200 } }),
      crawler: {
        crawl: async (u) => {
          crawled.push(u);
          return { ok: true, facts: {}, reason: null };
        },
      },
    });
    expect(crawled).toEqual(["https://www.junioredition.com/products/abc"]);
  });

  it("같은 URL 을 중복 크롤링하지 않는다 — 호출 수 비교가 왜곡되지 않게", async () => {
    const lane = await runLane("Hybrid", JOB, [fakeProvider([PRODUCT, PRODUCT])], DEPS);
    expect(lane.cost.crawlCalls).toBe(1);
  });

  it("실패 분류가 단계별로 갈린다", async () => {
    const lane = await runLane("Hybrid", JOB, [fakeProvider([LISTING, PRODUCT, DEAD])], DEPS);
    const tally = tallyFailures(lane);
    expect(tally.LISTING_PAGE_HELD).toBe(1);
    expect(tally.SEARCH_URL_INVALID).toBe(1);
    expect(tally.PASSED).toBe(1);
  });

  it("보류 건수를 숫자로 남긴다 — 조용히 버리지 않는다", async () => {
    const lane = await runLane("Hybrid", JOB, [fakeProvider([LISTING, PRODUCT, DEAD])], DEPS);
    const s = summarizePool(lane.candidates.map((c) => c.resolved));
    expect(s).toMatchObject({ total: 3, productPage: 1, listingPageHeld: 1, notFound: 1, crawlable: 1 });
  });
});

/* ═════════════ ⑦ KPI — 못 재는 것을 0 으로 적지 않는다 ═════════════ */

describe("P1 ⑦: KPI", () => {
  it("🔴 분모가 0 이면 null 이다 — 0% 가 아니다", () => {
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(0, 3)).toEqual({ value: 0, numerator: 0, denominator: 3 });
    expect(renderRatio(null)).toBe("—");
    expect(renderRatio(ratio(1, 2))).toBe("50% (1/2)");
  });

  it("🔴 Ground Truth 가 UNKNOWN 이면 recall/precision 을 «계산하지 않는다»", async () => {
    const job: JobFixture = { ...JOB, groundTruth: { state: "UNKNOWN", entries: [] } };
    const lane = await runLane("Current", job, [fakeProvider([PRODUCT])], DEPS);
    const kpi = computeJobKpi(lane, job.groundTruth);
    expect(kpi.discoveryRecallDomestic).toBeNull();
    expect(kpi.discoveryRecallOverseas).toBeNull();
    expect(kpi.samePrecision).toBeNull();
    expect(kpi.similarPrecision).toBeNull();
    // 🔴 단, Ground Truth 와 무관한 지표는 그래도 잰다.
    expect(kpi.crawlSuccess).not.toBeNull();
  });

  it("국내/해외 recall 을 갈라 낸다", async () => {
    const lane = await runLane("Current", JOB, [fakeProvider([PRODUCT])], DEPS);
    const kpi = computeJobKpi(lane, JOB.groundTruth);
    // 해외 GT 1건 중 1건 발견 · 국내 GT 1건 중 0건 발견
    expect(kpi.discoveryRecallOverseas).toEqual({ value: 1, numerator: 1, denominator: 1 });
    expect(kpi.discoveryRecallDomestic).toEqual({ value: 0, numerator: 0, denominator: 1 });
  });

  it("🔴 GT SAME 이 있는데 EXACT 를 못 세우면 SEARCH_INSUFFICIENT 다 — NO_MATCH 가 아니다", async () => {
    const lane = await runLane("Current", JOB, [fakeProvider([LISTING])], {
      ...DEPS,
      probe: probeFrom({ [LISTING]: { status: 200 } }),
    });
    const kpi = computeJobKpi(lane, JOB.groundTruth);
    expect(kpi.noMatchVerdict).toBe("SEARCH_INSUFFICIENT");
    expect(kpi.noMatchVerdict).not.toBe("NO_MATCH_CONFIRMED");
  });
});

/* ═════════════ ⑧ 경계 — Production 에 섞이지 않는다 ═════════════ */

describe("P1 ⑧: Architecture Boundary", () => {
  /** 🔴 `@commerce/crawler` 의 공개 표면에 하니스가 «없어야» 한다. 있으면 Production
   *  코드가 실수로 import 할 수 있고, 그 순간 실험 코드가 런타임에 올라간다. */
  it("crawler 의 index.ts 가 discovery-benchmark 를 export 하지 않는다", () => {
    const indexPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../index.ts");
    const source = readFileSync(indexPath, "utf8");
    // 🔴 주석을 벗기고 본다 — 이 저장소에서 여덟 번 걸린 함정이다.
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(stripped).not.toContain("discovery-benchmark");
    // 벗기기가 실제로 동작했는지도 확인한다(빈 문자열을 통과시키지 않는다).
    expect(stripped.length).toBeGreaterThan(100);
  });

  /** 🔴 외부 검색이 SAME/SIMILAR 를 «말할 자리가 없다» — 계약에 그 칸이 없다. */
  it("DiscoveredUrl 에 판정 칸이 없다", () => {
    const d: DiscoveredUrl = {
      url: "https://a.com/products/x",
      providerId: "p",
      queryId: "Q1",
      rank: 1,
      title: null,
      snippet: null,
      priceHint: null,
    };
    const keys = Object.keys(d);
    for (const forbidden of ["verdict", "matchTruth", "isSame", "similarity", "identity", "tier"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});
