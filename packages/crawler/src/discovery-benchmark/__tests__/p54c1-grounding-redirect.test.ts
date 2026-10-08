/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-C.1(CPO 승인, 2026-10-07) — Google grounding redirect 경로.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **이 파일이 막는 사고**: grounding URL 은 `/grounding-api-redirect/…` 이고
 *    모양만 보면 `UNKNOWN_PAGE` 다. `resolveCandidate` 를 건너뛰면 Google 후보가
 *    **전부** 버려지고, 측정 결과가 「Google 이 쓸 만한 후보를 0건 줬다」로
 *    거짓으로 읽힌다. P5.4-C 의 C1~C8 은 직접 상품 URL 로 테스트했기 때문에
 *    이 모양에 대해 **무력했다**.
 *
 * 🔴 살아 있는 Google redirect token 에 의존하지 않는다(CPO §5). redirect 토큰은
 *    수명이 짧아 테스트가 언젠가 조용히 깨진다. 그래서 두 계층으로 나눈다:
 *      ① Unit   — probe 를 stub 해서 「redirect 뒤 어디로 가는가」만 고정
 *      ② Live   — 실제 사이트(main-story / littleluna / junioredition)로 probe 자체를 검증
 */
import { describe, expect, it, vi } from "vitest";
import { normalizeForDedupe } from "../candidate-pool";
import { createLivePageProbe, extractCanonicalUrl } from "../live-page-probe";
import { classifyUrlShape, isCrawlable, resolveCandidate, toCrawlerUrl, type PageProbe } from "../url-resolver";
import { isSelfReferenceCandidate } from "../../comparison-search/self-reference";
import type { DiscoveredUrl } from "../types";

/** 🔴 합성 grounding redirect URL. 실제 토큰이 아니다(누가 봐도 가짜인 문자열). */
const GROUNDING = (token: string) =>
  `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${token}`;

const LL_GREY_ENC =
  "https://littleluna.co.kr/product/%EB%A9%94%EC%9D%B8%EC%8A%A4%ED%86%A0%EB%A6%AC-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/23/display/1/";
const LL_GREY_DEC =
  "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/23/display/1/";

const PROV: DiscoveredUrl[] = [
  { url: GROUNDING("synthetic-token"), providerId: "google-search-grounding", queryId: "Q5", rank: 1, title: null, snippet: null, priceHint: null },
];

/** probe 를 표로 흉내낸다 — 실제 HTTP 없이 「도착지가 어디인가」만 고정한다. */
function probeFrom(table: Record<string, { status: number; finalUrl?: string; canonicalUrl?: string | null }>): PageProbe {
  return async (url) => {
    const row = table[url];
    if (!row) throw new Error(`probe 표에 없는 URL: ${url}`);
    return { status: row.status, finalUrl: row.finalUrl ?? url, canonicalUrl: row.canonicalUrl ?? null };
  };
}

/* ══════════════ C1 — grounding redirect → 상품 ══════════════ */

describe("C1 grounding redirect 가 상품 URL 까지 도달한다", () => {
  it("🔴 resolveCandidate 없이 분류하면 UNKNOWN_PAGE 다 — 이것이 막으려는 사고다", () => {
    expect(classifyUrlShape(GROUNDING("synthetic-token"))).toBe("UNKNOWN_PAGE");
    expect(toCrawlerUrl(GROUNDING("synthetic-token"), "UNKNOWN_PAGE").crawlerUrl).toBeNull();
  });

  it("🟢 resolveCandidate 를 통과하면 PRODUCT_PAGE 가 되고 crawlerUrl 이 나온다", async () => {
    const search = GROUNDING("synthetic-token");
    const resolved = await resolveCandidate(
      search,
      PROV,
      probeFrom({ [search]: { status: 200, finalUrl: LL_GREY_ENC } }),
    );
    expect(resolved.classification).toBe("PRODUCT_PAGE");
    expect(resolved.steps).toContain("REDIRECTED");
    expect(resolved.crawlerUrl).not.toBeNull();
    expect(isCrawlable(resolved)).toBe(true);
    // 🔴 검색 URL 원문을 버리지 않는다 — 실패를 되짚는 유일한 근거다.
    expect(resolved.searchUrl).toBe(search);
    expect(resolved.provenance[0].providerId).toBe("google-search-grounding");
  });

  it("🟢 canonical 이 다르면 그것을 쓴다 — littleluna 실측 모양", async () => {
    const search = GROUNDING("t2");
    const resolved = await resolveCandidate(
      search,
      PROV,
      probeFrom({ [search]: { status: 200, finalUrl: "https://littleluna.co.kr/product/x/4120/", canonicalUrl: LL_GREY_DEC } }),
    );
    expect(resolved.steps).toContain("CANONICALIZED");
    expect(resolved.finalUrl).toBe(LL_GREY_DEC);
    expect(resolved.classification).toBe("PRODUCT_PAGE");
  });
});

/* ══════════════ C2 — grounding redirect → 홈 ══════════════ */

describe("C2 도착지가 홈이면 상품이 아니다", () => {
  it("🔴 redirect 끝이 홈/목록이면 크롤러에 넘기지 않는다", async () => {
    for (const dest of ["https://littleluna.co.kr/", "https://main-story.com/collections/all"]) {
      const search = GROUNDING(`home-${dest.length}`);
      const resolved = await resolveCandidate(search, PROV, probeFrom({ [search]: { status: 200, finalUrl: dest } }));
      expect(resolved.classification, dest).not.toBe("PRODUCT_PAGE");
      expect(isCrawlable(resolved), dest).toBe(false);
    }
  });

  it("404 도착은 NOT_FOUND 다 — 「상품이 없다」와 「네트워크 실패」를 가른다", async () => {
    const search = GROUNDING("gone");
    const resolved = await resolveCandidate(
      search,
      PROV,
      probeFrom({ [search]: { status: 404, finalUrl: "https://main-story.com/products/bubble-sweatshirt-grey-melange" } }),
    );
    expect(resolved.classification).toBe("NOT_FOUND");
    expect(resolved.httpStatus).toBe(404);
    expect(isCrawlable(resolved)).toBe(false);
  });

  it("probe 가 던지면 UNUSABLE 이다 — 「상품이 없다」로 적지 않는다", async () => {
    const search = GROUNDING("neterr");
    const resolved = await resolveCandidate(search, PROV, async () => {
      throw new Error("ECONNRESET");
    });
    expect(resolved.classification).toBe("UNUSABLE");
    expect(resolved.httpStatus).toBeNull();
  });
});

/* ══════════════ C3 — 모양은 상품인데 도착지는 홈 ══════════════ */

describe("🔴 C3 출발 URL 모양만 보고 상품으로 확정하지 않는다", () => {
  it("/products/… 가 302 로 홈에 가면 UNUSABLE", async () => {
    const search = "https://main-story.com/products/bubble-sweatshirt-grey-melange";
    // 출발은 PRODUCT_PAGE 다 — 그래서 이 가드가 없으면 홈페이지를 상품으로 읽는다.
    expect(classifyUrlShape(search)).toBe("PRODUCT_PAGE");
    const resolved = await resolveCandidate(
      search,
      PROV,
      probeFrom({ [search]: { status: 200, finalUrl: "https://main-story.com/" } }),
    );
    expect(resolved.classification).toBe("UNUSABLE");
    expect(isCrawlable(resolved)).toBe(false);
  });
});

/* ══════════════ C4 — 목록 ══════════════ */

describe("C4 목록 URL 은 상품이 아니다", () => {
  it("/product/list.html 은 도착지여도 제외된다", async () => {
    const search = GROUNDING("listing");
    const resolved = await resolveCandidate(
      search,
      PROV,
      probeFrom({ [search]: { status: 200, finalUrl: "https://littleluna.co.kr/product/list.html?cate_no=110" } }),
    );
    expect(resolved.classification).not.toBe("PRODUCT_PAGE");
    expect(isCrawlable(resolved)).toBe(false);
  });
});

/* ══════════════ C5 — 자기참조 사전 제외 ══════════════ */

describe("C5 자기참조는 Light Fetch «전에» 제외한다", () => {
  const ORIGIN = "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story";

  it("🔴 양쪽을 toCrawlerUrl 로 맞춘 뒤 비교해야 걸린다", async () => {
    const search = GROUNDING("selfref");
    const resolved = await resolveCandidate(
      search,
      PROV,
      probeFrom({ [search]: { status: 200, finalUrl: "https://www.junioredition.com/products/bubble-sweatshirt-in-grey-melange-by-main-story" } }),
    );
    expect(resolved.classification).toBe("PRODUCT_PAGE");
    const originCrawler = toCrawlerUrl(ORIGIN, classifyUrlShape(ORIGIN)).crawlerUrl!;
    // 🔴 정규화 «전» 으로 비교하면 로케일 때문에 놓친다 — 그 사실을 고정한다.
    expect(isSelfReferenceCandidate(ORIGIN, resolved.crawlerUrl)).toBe(false);
    expect(isSelfReferenceCandidate(originCrawler, resolved.crawlerUrl)).toBe(true);
  });
});

/* ══════════════ C6 — 인코딩/디코딩 dedupe ══════════════ */

describe("C6 인코딩 형태가 달라도 같은 후보다", () => {
  it("normalizeForDedupe · toCrawlerUrl 둘 다 합친다", () => {
    expect(normalizeForDedupe(LL_GREY_ENC)).toBe(normalizeForDedupe(LL_GREY_DEC));
    expect(toCrawlerUrl(LL_GREY_ENC, "PRODUCT_PAGE").dedupeKey).toBe(
      toCrawlerUrl(LL_GREY_DEC, "PRODUCT_PAGE").dedupeKey,
    );
  });

  it("서로 다른 grounding 토큰이 같은 상품으로 해석되면 dedupeKey 가 같다", async () => {
    const a = GROUNDING("tokenA");
    const b = GROUNDING("tokenB");
    const probe = probeFrom({ [a]: { status: 200, finalUrl: LL_GREY_ENC }, [b]: { status: 200, finalUrl: LL_GREY_DEC } });
    const ra = await resolveCandidate(a, PROV, probe);
    const rb = await resolveCandidate(b, PROV, probe);
    expect(ra.dedupeKey).toBe(rb.dedupeKey);
  });
});

/* ══════════════ canonical 추출 ══════════════ */

describe("extractCanonicalUrl — 속성 순서가 달라도 읽는다", () => {
  it("rel 먼저 · href 먼저 둘 다", () => {
    const base = "https://x.com/p/1";
    expect(extractCanonicalUrl('<link rel="canonical" href="https://x.com/p/2">', base)).toBe("https://x.com/p/2");
    expect(extractCanonicalUrl('<link href="https://x.com/p/3" rel="canonical">', base)).toBe("https://x.com/p/3");
  });

  it("상대 경로 canonical 을 절대화한다", () => {
    expect(extractCanonicalUrl('<link rel="canonical" href="/p/4">', "https://x.com/p/1")).toBe("https://x.com/p/4");
  });

  it("없으면 null — 지어내지 않는다", () => {
    expect(extractCanonicalUrl("<html><head></head></html>", "https://x.com/p/1")).toBeNull();
  });
});

/* ══════════════ live probe — 실제 사이트 ══════════════ */

describe("live PageProbe — 실제 응답으로 검증(Gemini 호출 0)", () => {
  it("🔴 GET 하나로 status·finalUrl·canonical 을 모두 얻는다", async () => {
    const seen: { bytes: number; httpCalls: number }[] = [];
    const probe = createLivePageProbe({ onResult: (r) => seen.push({ bytes: r.bytes, httpCalls: r.httpCalls }) });
    // www 리다이렉트가 실측으로 확인된 URL.
    const got = await probe("https://junioredition.com/products/bubble-sweatshirt-in-grey-melange-by-main-story");
    expect(got.status).toBe(200);
    expect(got.finalUrl).toContain("www.junioredition.com");
    expect(got.canonicalUrl).toContain("/products/bubble-sweatshirt-in-grey-melange-by-main-story");
    // 🔴 probe 는 요청 «한 번» 이다(리다이렉트는 fetch 가 내부에서 따라간다).
    expect(seen[0].httpCalls).toBe(1);
    expect(seen[0].bytes).toBeGreaterThan(0);
  }, 60_000);

  it("🔴 canonical 이 요청 URL 과 다른 사이트도 읽는다(littleluna 실측)", async () => {
    const probe = createLivePageProbe();
    const got = await probe("https://littleluna.co.kr/product/x/4120/");
    expect(got.status).toBe(200);
    expect(got.canonicalUrl).not.toBeNull();
    expect(decodeURIComponent(got.canonicalUrl!)).toContain("aw26ms185-bubble-sweatshirt-grey-melange");
  }, 60_000);

  /**
   * 🔴🔴 **살아 있는 사이트의 «특정 status» 를 단언하지 않는다.** 처음에 404 를
   *    단언했다가 실패했고, 원인은 사이트가 아니라 **클라이언트 차이** 였다 —
   *    실측(2026-10-07, 같은 URL·같은 헤더):
   *
   *      curl -L      → 404 · title "404 Not Found" · canonical /404
   *      node fetch   → 200 · url https://main-story.com/ · canonical /
   *
   *    🔴 운영 경로는 node fetch 다. curl 로 잰 숫자를 운영 동작으로 쓰면 안 된다.
   *
   * 🟢 그리고 이 실측이 C3 를 «실제로» 재현한다 — 출발은 `/products/…`(상품 모양)
   *    인데 도착은 홈이다. 아래는 그 계약을 단언한다: 무슨 status 든 우리는
   *    도착지를 보고 «상품이 아니다» 라고 말해야 한다.
   */
  it("🔴 존재하지 않는 상품 URL — 도착지로 판단해 상품에서 제외한다(C3 live)", async () => {
    const search = "https://main-story.com/products/bubble-sweatshirt-grey-melange";
    expect(classifyUrlShape(search)).toBe("PRODUCT_PAGE");
    const resolved = await resolveCandidate(search, PROV, createLivePageProbe());
    // 404(NOT_FOUND) 든 홈 리다이렉트(UNUSABLE) 든 — 크롤러에 넘기지 «않는다».
    expect(["NOT_FOUND", "UNUSABLE"]).toContain(resolved.classification);
    expect(isCrawlable(resolved)).toBe(false);
  }, 60_000);

  it("🟢 grounding redirect 를 흉내낸 end-to-end — resolveCandidate + live probe", async () => {
    const probe = createLivePageProbe();
    // 🔴 실제 grounding 토큰이 없으므로 「리다이렉트가 끝난 URL」을 직접 넣는다.
    //    여기서 재는 것은 live probe 가 resolveCandidate 계약을 만족하는가다.
    const resolved = await resolveCandidate("https://littleluna.co.kr/product/x/4120/", PROV, probe);
    expect(resolved.classification).toBe("PRODUCT_PAGE");
    expect(resolved.steps).toContain("CANONICALIZED");
    expect(isCrawlable(resolved)).toBe(true);
  }, 60_000);
});
