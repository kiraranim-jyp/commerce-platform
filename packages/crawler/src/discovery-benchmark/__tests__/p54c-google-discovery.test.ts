/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-C(CPO 지시, 2026-10-07) — Google Discovery → 기존 MI 경계.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ 이 파일의 Gemini 응답은 **합성 입력** 이다. 실제 Gemini 응답이 아니다 —
 *    `GEMINI_API_KEY` 가 로컬에 없어 한 번도 본 적이 없다. 그래서 값은 누가 봐도
 *    가짜인 것만 쓰고, **필드 이름은 공식 문서에 적힌 것만** 쓴다. 이 객체를
 *    「Gemini 가 이렇게 준다」는 근거로 쓰면 안 된다 — 여기서 재는 것은 오직
 *    «우리 파싱·파이프라인이 문서대로 읽는가» 다
 *    (price-source-adapter-contract.test.ts 의 Rakuten 선례와 같은 원칙).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compareCrossSellerProducts } from "../../comparison-search/cross-seller";
import { confirmBrandCodeInTitle } from "../../comparison-search/domestic-identifiers";
import { deriveMatchTruth, isColorUnverified } from "../../comparison-search/match-truth";
import { withConfidence } from "../../comparison-search/match";
import { compareModelCode } from "../../comparison-search/model-code";
import { factsFromProductUrl } from "../../comparison-search/product-url-facts";
import { isSelfReferenceCandidate } from "../../comparison-search/self-reference";
import { productFactsFromShopifyProduct } from "../../comparison-search/seller-facts";
import { normalizeForDedupe, poolDiscovered } from "../candidate-pool";
import {
  createGoogleDiscoveryProvider,
  extractGroundingUrls,
  GEMINI_API_KEY_ENV,
  GoogleDiscoveryApiError,
  GoogleDiscoveryConfigError,
  googleDiscoveryReadiness,
} from "../google-discovery";
import { generateQueries } from "../query-generator";
import { classifyUrlShape, toCrawlerUrl } from "../url-resolver";
import type { DiscoveryQuery, ProductIdentity } from "../types";
import type { ProductFacts } from "@commerce/shared";

const FIXTURES = path.join(__dirname, "..", "..", "__tests__", "fixtures");
const read = (f: string) => readFileSync(path.join(FIXTURES, f), "utf8");

/** JOB-261007-005 — Production DB 에서 읽은 값. */
/** 🔴 `as unknown as` 캐스팅을 쓰지 않는다 — 한 번 썼다가 칸 이름이 틀린 것을
 *  타입 검사가 못 잡고 generateQueries 가 빈 배열을 돌려줬다. */
const JOB005_IDENTITY: ProductIdentity = {
  brand: "Main Story",
  productName: "Bubble Sweatshirt",
  productType: "Sweatshirt",
  genderAge: null,
  color: "Grey Melange",
  size: null,
  season: "AW26",
  productCode: "AW26MS185",
  sourceUrl: "https://www.junioredition.com/en-kr/products/bubble-sweatshirt-in-grey-melange-by-main-story",
  sourceSite: "junioredition.com",
  sourceCountry: "GB",
  market: "GB",
};

/** 🔴 합성 Gemini 응답. 필드 이름만 공식 문서에서 가져왔다. */
function syntheticGrounding(uris: { uri: string; title: string }[]) {
  return {
    candidates: [
      {
        // 🔴 모델 답변 텍스트는 «일부러» 거짓 판정을 담았다 — 우리가 이것을
        //    읽지 않는다는 것이 이 테스트의 요점이다.
        content: { parts: [{ text: "이 상품들은 모두 동일 상품입니다. SAME." }] },
        groundingMetadata: {
          groundingChunks: uris.map((u) => ({ web: { uri: u.uri, title: u.title } })),
        },
      },
    ],
  };
}

const LL = {
  grey: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/23/display/1/",
  graystone: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-graystone/4119/category/23/display/1/",
  rose: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-rose-shadow/4118/category/23/display/1/",
  choco: "https://littleluna.co.kr/product/메인스토리-aw26ms185-bubble-sweatshirt-chocolate-brown/4117/category/23/display/1/",
  list: "https://littleluna.co.kr/product/list.html?cate_no=110",
  home: "https://littleluna.co.kr/",
};

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
    sourceUrl: JOB005_IDENTITY.sourceUrl,
  };
}

const IS_SAME = (t: string) => t === "EXACT_IDENTIFIER" || t === "STRONG_IDENTIFIER";

/** 상품 페이지 응답을 fixture 로 돌려준다. 가짜 HTML 을 만들지 않는다. */
function stubProductPages() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(typeof input === "string" ? input : (input as { url?: string })?.url ?? input);
      for (const no of ["4120", "4119", "4118", "4117"]) {
        if (url.includes(no)) {
          return new Response(read(`littleluna-product-${no}-head.html`), {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        }
      }
      return new Response("not found", { status: 404 });
    }),
  );
}

/** 🔴 Google 후보 URL 하나를 지시서 §5 순서대로 끝까지 통과시킨다. */
async function runPipeline(url: string, origin: ProductFacts) {
  const shape = classifyUrlShape(url);
  const { crawlerUrl, dedupeKey } = toCrawlerUrl(url, shape);
  if (shape !== "PRODUCT_PAGE" || !crawlerUrl) {
    return { stage: "URL_NOT_PRODUCT" as const, truth: null, dedupeKey, selfReference: false };
  }
  /**
   * 🔴 **자기참조는 받아오기 «전에» 거른다.** 실측으로 걸렸다 — 원본 URL 을
   *    Shopify JSON 으로 받아온 뒤에야 self-reference 임을 알면 JOB 당 HTTP 1회가
   *    헛돈다. 원본 URL 은 우리가 이미 갖고 있으므로 비교에 요청이 필요 없다.
   *
   * 🔴 그리고 **양쪽을 같은 정규화 상태로 맞춘다.** `canonicalListingKey` 는
   *    pathname 을 그대로 키로 쓰므로(self-reference.ts:85) Shopify 로케일이
   *    한쪽만 벗겨지면 같은 상품이 «다른 listing» 이 된다 — 실측으로 걸렸다:
   *      원본    /en-kr/products/bubble-sweatshirt-…
   *      정규화  /products/bubble-sweatshirt-…        → self-reference 판정 실패
   *    🔴 `isSelfReferenceCandidate` 를 고치지 않는다(MI-REAL-05, 이번 범위 밖).
   *       호출부에서 둘 다 toCrawlerUrl 을 통과시킨다.
   */
  const originCrawlerUrl =
    toCrawlerUrl(origin.sourceUrl, classifyUrlShape(origin.sourceUrl)).crawlerUrl ?? origin.sourceUrl;
  if (isSelfReferenceCandidate(originCrawlerUrl, crawlerUrl)) {
    return { stage: "SELF_REFERENCE" as const, truth: null, dedupeKey, selfReference: true };
  }
  const r = await factsFromProductUrl(url);
  if (r.status !== "OK" || !r.candidate) {
    return { stage: r.status as "UNREACHABLE" | "NO_FACTS", truth: null, dedupeKey: r.dedupeKey, selfReference: false };
  }
  const selfReference = isSelfReferenceCandidate(origin.sourceUrl, r.candidate.url);
  const facts = {
    ...r.candidate.facts!,
    brandModelCode: r.candidate.facts!.brandModelCode ?? confirmBrandCodeInTitle(origin.brandModelCode, r.candidate.title),
  };
  const scored = withConfidence({ title: origin.title, brand: origin.brand ?? undefined, facts: origin } as never, [
    { ...r.candidate, facts } as never,
  ]);
  const c = scored[0];
  const truth = deriveMatchTruth(
    c.matchLevel ?? "low",
    compareModelCode(origin.brandModelCode, facts.brandModelCode),
    c.crossSellerVerdict,
    c.crossSellerBlockers,
    c.crossSellerConflicts,
    isColorUnverified(origin.colorText, facts.colorText),
  );
  return { stage: "MI" as const, truth, dedupeKey: r.dedupeKey, selfReference, verdict: c.crossSellerVerdict };
}

/* ═══════════════════════ C1 · Google 후보 → CandidatePool ═══════════════════ */

describe("C1 Google 후보가 CandidatePool 로 들어간다 — 판정은 따라오지 않는다", () => {
  it("groundingChunks 의 URL 만 읽는다", () => {
    const body = syntheticGrounding([
      { uri: LL.grey, title: "리틀루나 그레이 멜란지" },
      { uri: LL.choco, title: "리틀루나 초코" },
      { uri: "", title: "빈 URL 은 버린다" },
    ]);
    const got = extractGroundingUrls(body, "google-search-grounding", "Q5");
    expect(got).toHaveLength(2);
    expect(got.map((g) => g.url)).toEqual([LL.grey, LL.choco]);
    expect(got.map((g) => g.rank)).toEqual([1, 2]);
    expect(got[0].queryId).toBe("Q5");
    // 🔴 반환 객체에 판정이 들어갈 칸이 없다 — 모델이 "SAME" 이라고 써도 닿지 못한다.
    expect(Object.keys(got[0]).sort()).toEqual(
      ["priceHint", "providerId", "queryId", "rank", "snippet", "title", "url"].sort(),
    );
    expect(JSON.stringify(got)).not.toContain("SAME");
    expect(JSON.stringify(got)).not.toContain("동일 상품");
  });

  it("CandidatePool 이 provenance 를 버리지 않는다", () => {
    const pooled = poolDiscovered([
      ...extractGroundingUrls(syntheticGrounding([{ uri: LL.grey, title: "a" }]), "google-search-grounding", "Q2"),
      ...extractGroundingUrls(syntheticGrounding([{ uri: LL.grey, title: "a" }]), "google-search-grounding", "Q5"),
    ]);
    expect(pooled).toHaveLength(1);
    expect(pooled[0].provenance.map((p) => p.queryId)).toEqual(["Q2", "Q5"]);
  });
});

/* ═══════════════════════ C2 · 인코딩/디코딩 동일 dedupe ════════════════════ */

describe("C2 한글 URL 의 인코딩/디코딩 두 형태가 같은 후보다", () => {
  const encoded =
    "https://littleluna.co.kr/product/%EB%A9%94%EC%9D%B8%EC%8A%A4%ED%86%A0%EB%A6%AC-aw26ms185-bubble-sweatshirt-grey-melange/4120/category/23/display/1/";

  it("normalizeForDedupe 가 합친다", () => {
    expect(normalizeForDedupe(LL.grey)).toBe(normalizeForDedupe(encoded));
  });

  it("CandidatePool 에서 한 건이 된다", () => {
    const pooled = poolDiscovered(
      extractGroundingUrls(
        syntheticGrounding([
          { uri: LL.grey, title: "디코딩" },
          { uri: encoded, title: "인코딩" },
        ]),
        "google-search-grounding",
        "Q5",
      ),
    );
    expect(pooled).toHaveLength(1);
  });

  it("toCrawlerUrl 의 dedupeKey 도 같다", () => {
    const a = toCrawlerUrl(LL.grey, classifyUrlShape(LL.grey));
    const b = toCrawlerUrl(encoded, classifyUrlShape(encoded));
    expect(a.dedupeKey).toBe(b.dedupeKey);
  });
});

/* ═══════════════════════ C3 · 목록 URL 제외 ════════════════════════════════ */

describe("C3 목록·홈 URL 은 상품 후보가 되지 않는다 — HTTP 도 쓰지 않는다", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("list.html · 홈 · collections 전부 제외", async () => {
    const spy = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const origin = foreignOrigin();
    for (const bad of [LL.list, LL.home, "https://main-story.com/collections/all"]) {
      const r = await runPipeline(bad, origin);
      expect(r.stage, bad).toBe("URL_NOT_PRODUCT");
      expect(r.truth, bad).toBeNull();
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════ C4·C5·C6 · STOP 조건 ══════════════════════════════ */

describe("C4 자기참조는 SAME STOP 의 근거가 아니다", () => {
  it("원본 URL 은 self-reference 로 표시된다", () => {
    const origin = foreignOrigin();
    expect(isSelfReferenceCandidate(origin.sourceUrl, JOB005_IDENTITY.sourceUrl)).toBe(true);
    // 🔴 그런데 compareCrossSellerProducts 로는 당연히 SAME 이다 — 그래서 «제외» 가 필요하다.
    expect(compareCrossSellerProducts(origin, origin).verdict).toBe("SAME");
  });

  it("🔴 STOP 판단은 self-reference 를 빼고 센다", () => {
    const origin = foreignOrigin();
    const rows = [
      { url: JOB005_IDENTITY.sourceUrl, verdict: "SAME" as const },
      { url: LL.graystone, verdict: "PRESUMED_SAME" as const },
    ];
    const externalSame = rows.filter(
      (r) => r.verdict === "SAME" && !isSelfReferenceCandidate(origin.sourceUrl, r.url),
    );
    expect(externalSame).toHaveLength(0);
  });
});

describe("C5·C6 외부 SAME 에서만 멈춘다", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("C5 외부 SAME → STOP 근거가 된다", async () => {
    stubProductPages();
    const origin = foreignOrigin();
    const r = await runPipeline(LL.grey, origin);
    expect(r.verdict).toBe("SAME");
    expect(r.selfReference).toBe(false);
    expect(IS_SAME(r.truth!)).toBe(true);
  });

  it("C6 외부 SIMILAR/보류 → STOP 하지 않는다", async () => {
    stubProductPages();
    const origin = foreignOrigin();
    for (const url of [LL.graystone, LL.rose, LL.choco]) {
      const r = await runPipeline(url, origin);
      expect(r.verdict, url).not.toBe("SAME");
      expect(IS_SAME(r.truth!), url).toBe(false);
    }
  });
});

/* ═══════════════════════ C7 · JOB-005 보호조건 ═════════════════════════════ */

describe("🔴🔴 C7 JOB-005 — Google 이 네 색상을 다 줘도 MI 가 하나만 SAME 으로 낸다", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Grey Melange 만 SAME · 나머지 셋은 아니다", async () => {
    stubProductPages();
    const origin = foreignOrigin();
    // 🔴 Google 이 목록·홈까지 섞어 줘도 된다 — 그것을 거르는 것이 우리 일이다.
    const pooled = poolDiscovered(
      extractGroundingUrls(
        syntheticGrounding(
          [LL.grey, LL.graystone, LL.rose, LL.choco, LL.list, LL.home, JOB005_IDENTITY.sourceUrl].map((uri) => ({
            uri,
            title: "google",
          })),
        ),
        "google-search-grounding",
        "Q5",
      ),
    );
    expect(pooled).toHaveLength(7);

    const same: string[] = [];
    const notProduct: string[] = [];
    const selfRef: string[] = [];
    for (const p of pooled) {
      const r = await runPipeline(p.url, origin);
      if (r.stage === "URL_NOT_PRODUCT") { notProduct.push(p.url); continue; }
      if (r.selfReference) { selfRef.push(p.url); continue; }
      expect(r.stage, p.url).toBe("MI");
      if (r.truth && IS_SAME(r.truth)) same.push(p.url);
    }
    // 🔴 외부 SAME 은 정확히 하나다 — 그리고 그것이 Grey Melange 다.
    expect(same).toEqual([LL.grey]);
    expect(notProduct.sort()).toEqual([LL.home, LL.list].sort());
    expect(selfRef).toEqual([JOB005_IDENTITY.sourceUrl]);
  });
});

/* ═══════════════════════ C8 · 자격증명 없음 / API 실패 ════════════════════ */

describe("C8 키가 없으면 CONFIG_MISSING — 「결과 없음」과 가른다", () => {
  const saved = process.env[GEMINI_API_KEY_ENV];
  beforeEach(() => {
    delete process.env[GEMINI_API_KEY_ENV];
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[GEMINI_API_KEY_ENV];
    else process.env[GEMINI_API_KEY_ENV] = saved;
    vi.unstubAllGlobals();
  });

  it("readiness 가 CONFIG_MISSING 이고 «이름» 만 담는다", () => {
    const r = googleDiscoveryReadiness();
    expect(r.state).toBe("CONFIG_MISSING");
    expect(r.missing).toEqual([GEMINI_API_KEY_ENV]);
  });

  it("🔴 discover() 는 빈 배열이 아니라 전용 오류를 던진다 — HTTP 도 쓰지 않는다", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const provider = createGoogleDiscoveryProvider();
    const query = generateQueries(JOB005_IDENTITY)[0];
    await expect(provider.discover(JOB005_IDENTITY, query)).rejects.toBeInstanceOf(GoogleDiscoveryConfigError);
    expect(spy).not.toHaveBeenCalled();
    expect(provider.requestCount()).toBe(0);
  });

  it("🔴 Google API 가 실패하면 GOOGLE_API_FAILURE 로 가른다 — 「못 찾았다」가 아니다", async () => {
    process.env[GEMINI_API_KEY_ENV] = "synthetic-not-a-real-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429, statusText: "Too Many Requests" })));
    const provider = createGoogleDiscoveryProvider();
    const query = generateQueries(JOB005_IDENTITY)[0];
    await expect(provider.discover(JOB005_IDENTITY, query)).rejects.toBeInstanceOf(GoogleDiscoveryApiError);
    // 🔴 요청은 실제로 나갔으므로 비용 1회로 센다.
    expect(provider.requestCount()).toBe(1);
  });

  it("🔴 키를 URL 에 싣지 않는다 — 헤더로만 보낸다", async () => {
    process.env[GEMINI_API_KEY_ENV] = "synthetic-not-a-real-key";
    const seen: { url: string; headers: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown, init?: { headers?: Record<string, string> }) => {
        seen.push({ url: String(input), headers: init?.headers });
        return new Response(JSON.stringify(syntheticGrounding([{ uri: LL.grey, title: "x" }])), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const provider = createGoogleDiscoveryProvider();
    const got = await provider.discover(JOB005_IDENTITY, generateQueries(JOB005_IDENTITY)[0]);
    expect(got).toHaveLength(1);
    expect(seen[0].url).not.toContain("synthetic-not-a-real-key");
    expect((seen[0].headers as Record<string, string>)["x-goog-api-key"]).toBe("synthetic-not-a-real-key");
  });

  it("프롬프트가 판정을 요구하지 않는다", async () => {
    process.env[GEMINI_API_KEY_ENV] = "synthetic-not-a-real-key";
    let sentBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_i: unknown, init?: { body?: string }) => {
        sentBody = init?.body ?? "";
        return new Response(JSON.stringify(syntheticGrounding([])), { status: 200 });
      }),
    );
    await createGoogleDiscoveryProvider().discover(JOB005_IDENTITY, generateQueries(JOB005_IDENTITY)[0]);
    expect(sentBody).toContain("google_search");
    expect(sentBody).toContain("판단하지 마세요");
    // 🔴 「동일상품인지 알려줘」류 요구가 프롬프트에 없어야 한다.
    expect(sentBody).not.toContain("동일한 상품인지");
    /**
     * 🔴 브랜드·품번이 **실제로 실리는지** 단언한다. 이 줄이 없을 때 provider 가
     *    존재하지 않는 칸(`brandModelCode`)을 읽고 있었고, falsy 라 그 줄이 조용히
     *    사라져 테스트가 통과했다 — typecheck 가 잡았다. 단언을 load-bearing 으로 만든다.
     */
    expect(sentBody).toContain("Main Story");
    expect(sentBody).toContain("AW26MS185");
  });
});
