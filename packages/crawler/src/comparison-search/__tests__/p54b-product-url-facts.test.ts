/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-B.3(CPO 지시, 2026-10-07) — **AI 후보 URL → 기존 MI 경로.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 지키는 것 둘:
 *   ① AI 가 준 맨 URL 하나로 Little Luna Grey Melange 가 **SAME** 에 닿는다.
 *   ② Graystone · Rose Shadow · Chocolate Brown 은 **SAME 으로 부활하지 않는다**
 *      (P5.3 에서 확보한 회귀 조건을 이 새 입력 경로에서도 그대로 보호한다).
 *
 * 🔴 fixture 는 실제 응답의 `<head>` 까지만 잘랐다(원본 약 188KB). 이 경로가
 *    읽는 것은 `og:title` 하나이고, 자른 범위를 파일 안에 주석으로 남겼다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compareCrossSellerProducts } from "../cross-seller";
import { confirmBrandCodeInTitle } from "../domestic-identifiers";
import { deriveMatchTruth, isColorUnverified } from "../match-truth";
import { withConfidence } from "../match";
import { compareModelCode } from "../model-code";
import { factsFromProductUrl } from "../product-url-facts";
import { searchDomesticShops } from "../index";
import { productFactsFromShopifyProduct } from "../seller-facts";
import type { ProductFacts } from "@commerce/shared";

const FIXTURES = path.join(__dirname, "..", "..", "__tests__", "fixtures");
const read = (f: string) => readFileSync(path.join(FIXTURES, f), "utf8");

/** 해외 원상품(JOB-261007-005) — 실측 fixture 에서 만든다. */
function foreignOrigin(): ProductFacts {
  const raw = JSON.parse(read("junioredition-bubble-sweatshirt-in-grey-melange-by-main-story.json")) as Record<
    string,
    unknown
  >;
  return {
    ...productFactsFromShopifyProduct(
      {
        title: raw.title as string,
        handle: raw.handle as string,
        url: `/products/${raw.handle as string}`,
        description: raw.description as string,
        vendor: raw.vendor as string,
        type: raw.type as string,
        tags: raw.tags as string[],
        options: raw.options as { name?: string; values?: string[] }[],
        images: raw.images as string[],
      },
      "junioredition.com",
    ),
    sourceUrl: `https://www.junioredition.com/en-kr/collections/kids-clothing/products/${raw.handle as string}`,
  };
}

/** AI 가 돌려준 «맨 URL» 이라고 가정한 Little Luna 상품 URL 4개. */
const AI_URLS = [
  { color: "Grey Melange", no: "4120", url: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/23/display/1/" },
  { color: "Graystone", no: "4119", url: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-graystone/4119/category/23/display/1/" },
  { color: "Rose Shadow", no: "4118", url: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-rose-shadow/4118/category/23/display/1/" },
  { color: "Chocolate Brown", no: "4117", url: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-chocolate-brown/4117/category/23/display/1/" },
];

/** fixture 를 그 URL 의 응답으로 돌려주는 stub. 가짜 HTML 을 만들지 않는다. */
function stubFixtures() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(typeof input === "string" ? input : (input as { url?: string })?.url ?? input);
      const hit = AI_URLS.find((u) => url.includes(u.no));
      if (!hit) return new Response("not found", { status: 404 });
      return new Response(read(`littleluna-product-${hit.no}-head.html`), {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }),
  );
}

const IS_SAME = (t: string) => t === "EXACT_IDENTIFIER" || t === "STRONG_IDENTIFIER";

/** 기존 MI 를 그대로 통과시킨다 — 이 테스트가 새 판정을 만들지 않는다는 증거. */
function judge(origin: ProductFacts, candidateFacts: ProductFacts, title: string) {
  const scored = withConfidence({ title: origin.title, facts: origin } as never, [
    { title, url: candidateFacts.sourceUrl, price: null, regularPrice: null, imageUrl: null, confidence: 0, facts: candidateFacts } as never,
  ]);
  const c = scored[0];
  return deriveMatchTruth(
    c.matchLevel ?? "low",
    compareModelCode(origin.brandModelCode, c.facts?.brandModelCode ?? null),
    c.crossSellerVerdict,
    c.crossSellerBlockers,
    c.crossSellerConflicts,
    isColorUnverified(origin.colorText, c.facts?.colorText),
  );
}

describe("P5.4-B.3 ① AI 후보 URL 하나가 MI 까지 닿는다", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("🟢 Grey Melange — HTTP 1회로 facts 를 만들고 SAME 에 닿는다", async () => {
    stubFixtures();
    const r = await factsFromProductUrl(AI_URLS[0].url);
    expect(r.status).toBe("OK");
    // 🔴 비용을 코드가 스스로 보고한다.
    expect(r.httpCalls).toBe(1);
    expect(r.fetchPath).toBe("PLAIN_HTML");
    expect(r.candidate?.title).toBe("[메인스토리] AW26MS185 - Bubble Sweatshirt - Grey Melange");
    /**
     * 🔴 `new URL().pathname` 은 한글을 퍼센트 인코딩한다. 그 사실을 여기 고정한다 —
     *    AI 가 디코딩된 URL 을 주고 어댑터가 인코딩된 URL 을 주면 **같은 상품이
     *    두 건으로 세어질 수 있다.** 아래 ③이 두 형태가 합쳐지는지 직접 본다.
     */
    expect(r.crawlerUrl).toBe(
      "https://littleluna.co.kr/product/%EB%A9%94%EC%9D%B8%EC%8A%A4%ED%86%A0%EB%A6%AC-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/23/display/1/",
    );
    expect(r.dedupeKey).toContain("littleluna.co.kr|");

    const origin = foreignOrigin();
    const facts = { ...r.candidate!.facts!, brandModelCode: confirmBrandCodeInTitle(origin.brandModelCode, r.candidate!.title) };
    expect(facts.brandModelCode).toBe("AW26MS185");
    expect(facts.colorText).toBe("Grey");
    // 🔴 브랜드를 읽지 못하면 BRAND_UNCONFIRMED 보류로 SAME 에 닿지 못한다(실측).
    expect(facts.brand).toBe("MAIN STORY");
    const cx = compareCrossSellerProducts(origin, facts);
    expect(cx.axes.map((a) => a.axis)).toEqual(expect.arrayContaining(["TITLE", "MODEL_CODE", "COLOR"]));
    expect(cx.blockers.map((b) => b.blocker)).not.toContain("BRAND_UNCONFIRMED");
    expect(cx.verdict).toBe("SAME");
    expect(IS_SAME(judge(origin, facts, r.candidate!.title))).toBe(true);
  });

  it("🔴 Graystone · Rose Shadow · Chocolate Brown 은 SAME 으로 부활하지 않는다", async () => {
    stubFixtures();
    const origin = foreignOrigin();
    for (const u of AI_URLS.slice(1)) {
      const r = await factsFromProductUrl(u.url);
      expect(r.status, u.color).toBe("OK");
      const facts = {
        ...r.candidate!.facts!,
        brandModelCode: confirmBrandCodeInTitle(origin.brandModelCode, r.candidate!.title),
      };
      // 품번은 네 건 모두 exact 다 — 그래도 SAME 이 되면 안 된다.
      expect(compareModelCode(origin.brandModelCode, facts.brandModelCode), u.color).toBe("exact");
      expect(IS_SAME(judge(origin, facts, r.candidate!.title)), `${u.color} 가 동일상품으로 올라갔다`).toBe(false);
    }
  });

  it("🔴 색상이 읽히는지/안 읽히는지가 세 건에서 갈린다 — 메커니즘까지 고정", async () => {
    stubFixtures();
    const got: Record<string, string | null> = {};
    for (const u of AI_URLS) {
      const r = await factsFromProductUrl(u.url);
      got[u.color] = r.candidate!.facts!.colorText;
    }
    expect(got["Grey Melange"]).toBe("Grey");
    expect(got["Chocolate Brown"]).toBe("Brown");
    // 🔴 이 둘은 색상 어휘에 없어 null 이다 — 그 사실이 Step 2 가드를 발화시킨다.
    expect(got["Graystone"]).toBeNull();
    expect(got["Rose Shadow"]).toBeNull();
  });
});

describe("P5.4-B.3 ② URL 모양 판별 — 요청을 보내지 않고 거른다", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("🔴 상품 URL 이 아니면 HTTP 를 «쓰지 않는다»", async () => {
    const spy = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    for (const bad of [
      "https://littleluna.co.kr/",
      "https://littleluna.co.kr/product/list.html?cate_no=110",
      "https://main-story.com/collections/all",
      "https://example.com/about.html",
      "not-a-url",
    ]) {
      const r = await factsFromProductUrl(bad);
      expect(r.status, bad).toBe("NOT_PRODUCT_URL");
      expect(r.httpCalls, bad).toBe(0);
      expect(r.candidate, bad).toBeNull();
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("응답을 못 받으면 «상품이 없다» 가 아니라 UNREACHABLE 이다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const r = await factsFromProductUrl(AI_URLS[0].url);
    expect(r.status).toBe("UNREACHABLE");
    expect(r.candidate).toBeNull();
    expect(r.httpCalls).toBe(1);
  });

  it("응답은 받았지만 상품명이 없으면 NO_FACTS — 지어내지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><head></head><body>x</body></html>", { status: 200 })));
    const r = await factsFromProductUrl(AI_URLS[0].url);
    expect(r.status).toBe("NO_FACTS");
    expect(r.candidate).toBeNull();
  });
});

describe("P5.4-B.3 ③ Shopify 는 JSON 한 번으로 끝낸다", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("🟢 /products/{handle}.json 1회 · 로케일이 떨어진다", async () => {
    const body = {
      product: {
        title: "Bubble Sweatshirt in Grey Melange by Main Story",
        handle: "bubble-sweatshirt-in-grey-melange-by-main-story",
        body_html: "<p>Colour - Grey Melange. 100% Organic Cotton. Product code AW26MS185</p>",
        vendor: "Main Story",
        product_type: "Sweatshirts",
        tags: ["Girl", "Boy"],
        options: [{ name: "Size", values: ["2 Years", "4 Years"] }],
        images: [{ src: "https://cdn.shopify.com/x.jpg" }],
      },
    };
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        calls.push(String(typeof input === "string" ? input : (input as { url?: string })?.url ?? input));
        return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
    // 🔴 로케일 프리픽스와 컬렉션 경로가 붙은 URL 을 넣는다(실측 저장 형태).
    const r = await factsFromProductUrl(
      "https://www.junioredition.com/en-kr/collections/kids-clothing/products/bubble-sweatshirt-in-grey-melange-by-main-story?_pos=1",
    );
    expect(r.status).toBe("OK");
    expect(r.httpCalls).toBe(1);
    expect(r.fetchPath).toBe("SHOPIFY_JSON");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(
      "https://www.junioredition.com/products/bubble-sweatshirt-in-grey-melange-by-main-story.json",
    );
    const f = r.candidate!.facts!;
    expect(f.brandModelCode).toBe("AW26MS185");
    expect(f.brand).toBe("Main Story");
    expect(f.categoryText).toBe("Sweatshirts");
    expect(f.sizeLabels).toEqual(["2 Years", "4 Years"]);
    // 🔴 통화를 모르므로 가격을 만들지 않는다.
    expect(r.candidate!.price).toBeNull();
  });

  it("🔴 Shopify 로 보였지만 JSON 이 막히면 HTML 로 내려간다 — 「상품 없음」이 아니다", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        return n === 1
          ? new Response("blocked", { status: 403 })
          : new Response('<html><head><meta property="og:title" content="Bubble Sweatshirt"></head></html>', {
              status: 200,
            });
      }),
    );
    const r = await factsFromProductUrl("https://main-story.com/products/bubble-sweatshirt-roast");
    expect(r.status).toBe("OK");
    expect(r.fetchPath).toBe("PLAIN_HTML");
    // JSON 1회 + HTML 1회 = 2회. 🔴 숨기지 않고 그대로 보고한다.
    expect(r.httpCalls).toBe(2);
  });
});

describe("P5.4-B.3 ③-b 인코딩 형태가 달라도 같은 상품으로 합쳐지는가", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("🔴 한글 slug 의 디코딩/인코딩 두 형태가 같은 dedupeKey 를 낸다", async () => {
    stubFixtures();
    const decoded = AI_URLS[0].url;
    const encoded =
      "https://littleluna.co.kr/product/%EB%A9%94%EC%9D%B8%EC%8A%A4%ED%86%A0%EB%A6%AC-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/23/display/1/";
    const a = await factsFromProductUrl(decoded);
    const b = await factsFromProductUrl(encoded);
    expect(a.status).toBe("OK");
    expect(b.status).toBe("OK");
    // 합쳐지지 않으면 AI 후보 20개 중 중복이 그대로 비용이 된다.
    expect(a.dedupeKey).toBe(b.dedupeKey);
    expect(a.crawlerUrl).toBe(b.crawlerUrl);
  });
});

describe("P5.4-B.3 ④ 자기참조는 외부 발견이 아니다", () => {
  it("원본과 같은 listing 은 isSelfReferenceCandidate 가 걸러낸다", () => {
    const origin = foreignOrigin();
    const cross = compareCrossSellerProducts(origin, origin);
    // 같은 상품이니 당연히 SAME 이다 — 그래서 STOP 조건에서 «제외» 해야 한다.
    expect(cross.verdict).toBe("SAME");
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-B.2 — **STOP 은 「후보가 생겼을 때」가 아니라 「외부 동일상품이
 * 확정됐을 때」다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 fixture 두 개는 같은 실제 응답에서 «블록만» 골라낸 것이다(바이트는 원문 그대로).
 *    ①칸: Chocolate Brown 하나만 → 후보는 있지만 SAME 이 아니다
 *    ②칸: 네 색상 전부      → Grey Melange 가 SAME 이다
 */
describe("P5.4-B.2 STOP — 후보가 나와도 SAME 이 아니면 다음 칸을 본다", () => {
  afterEach(() => vi.unstubAllGlobals());

  const SOURCES = [
    { id: "ll", name: "리틀루나", domain: "littleluna.co.kr", collectionStrategy: "AUTO_SCRAPE", currency: "KRW" },
  ] as never;

  /** 검색어에 따라 다른 fixture 를 돌려준다 — 사다리 칸을 흉내내는 것이 아니라 실제 응답이다. */
  function stubLadder(onRequest: (term: string) => void) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(typeof input === "string" ? input : (input as { url?: string })?.url ?? input);
        const term = decodeURIComponent(new URL(url).searchParams.get("keyword") ?? "");
        onRequest(term);
        const body = term === "AW26MS185" ? read("littleluna-search-only-choco.html") : read("littleluna-mainstory-aw26ms185-search.html");
        return new Response(body, { status: 200, headers: { "content-type": "text/html" } });
      }),
    );
  }

  it("🔴 ①칸이 「다른 색상」만 내면 멈추지 않고 ②칸까지 간다", async () => {
    const terms: string[] = [];
    stubLadder((t) => terms.push(t));
    const origin = foreignOrigin();
    const results = await searchDomesticShops(
      {
        title: origin.title,
        brand: origin.brand ?? undefined,
        sourceUrl: origin.sourceUrl,
        facts: origin,
        searchTerms: ["AW26MS185", "Main Story bubble sweatshirt"],
      } as never,
      SOURCES,
    );
    // 🔴 두 칸 모두 실행됐다 — 예전 `length > 0 → break` 라면 ①에서 멈췄다.
    expect(terms).toEqual(["AW26MS185", "Main Story bubble sweatshirt"]);
    const titles = results[0].candidates.map((c) => c.title);
    expect(titles.some((t) => t.includes("Grey Melange")), "정답이 수집되지 않았다").toBe(true);
    expect(titles.some((t) => t.includes("Chocolate Brown")), "①칸 후보가 버려졌다").toBe(true);
    // 🔴 같은 상품을 두 칸에서 다시 집어도 한 건이다.
    expect(new Set(results[0].candidates.map((c) => c.url)).size).toBe(results[0].candidates.length);
  });

  it("🟢 외부 SAME 이 확정되면 그 자리에서 멈춘다 — 뒤 칸은 실행되지 않는다", async () => {
    const terms: string[] = [];
    stubLadder((t) => terms.push(t));
    const origin = foreignOrigin();
    await searchDomesticShops(
      {
        title: origin.title,
        brand: origin.brand ?? undefined,
        sourceUrl: origin.sourceUrl,
        facts: origin,
        // ①칸이 네 색상을 내므로 Grey Melange = SAME 이 바로 확정된다.
        searchTerms: ["Main Story bubble sweatshirt", "뒤칸은-실행되면-안-된다"],
      } as never,
      SOURCES,
    );
    expect(terms).toEqual(["Main Story bubble sweatshirt"]);
  });

  it("🔴 facts 가 없는 호출부는 예전과 똑같이 첫 결과에서 멈춘다", async () => {
    const terms: string[] = [];
    stubLadder((t) => terms.push(t));
    await searchDomesticShops(
      { title: "아무 상품", searchTerms: ["AW26MS185", "두번째칸"] } as never,
      SOURCES,
    );
    // facts 가 없으면 판정할 근거가 없다 — 모든 칸을 소진하지 «않는다».
    expect(terms).toEqual(["AW26MS185"]);
  });
});
