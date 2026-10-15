import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProductUrlFactsResult } from "@commerce/crawler";
import { collectUrlCandidatePool, isPubliclyRoutableHttpUrl } from "../url-candidate-pool";
import {
  GEMINI_VIRTUAL_SHOP_ID,
  isTransientShopId,
  TRANSIENT_SHOP_IDS,
  TRANSIENT_URL_SHOP_ID,
} from "../transient-candidates";
import {
  GeminiTransientCandidates,
  SUPPLIED_URL_HEADING,
  WEB_SEARCH_HEADING,
} from "../../../../pipeline/commerce/GeminiTransientCandidates";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-024 — **Registry 밖 후보를 일시 pipeline 에 공급하는 생산자 계약**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **AI 0 · 외부 검색 API 0 · Gemini 0 · 키 0 · 비용 0 · DB 쓰기 0 · HTTP 0**
 *    (아래 전부 `fetchFacts` 주입구로 돌린다 — 실제 네트워크를 타지 않는다).
 *
 * 🔴 소스 문자열 검사는 **주석을 벗기고** 한다(헌장 §5 · 여덟 번 걸린 함정).
 * 🔴 가드는 **술어까지** 잠근다(메모 source-guard-must-lock-the-predicate) —
 *    「그 줄이 있다」가 아니라 「그 줄을 일으키는 조건이 맞다」를 본다.
 */

const LIB = path.join(__dirname, "..");
const strip = (f: string) =>
  readFileSync(path.join(LIB, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const RUNNER = strip("run-domestic-price-check.ts");
const POOL = strip("url-candidate-pool.ts");
const LEAF = strip("transient-candidates.ts");
const ROUTE = strip(path.join("..", "check", "route.ts"));

/** 🔴 GT(WU-022)로 확정된 **등록부 밖 국내 판매처** 5곳의 실제 상품 URL 모양. */
const GT_URLS = {
  biskuit: "https://biskuit.kr/product/bobo-b226ac009/8891/category/367/display/1/",
  luxboy: "https://m.luxboy.com/product/A14338197CB8698CD92C86431CCE8D05",
  mustit: "https://m.web.mustit.co.kr/v2/m/product/product_detail/127093801?from_keyword=%EC%9E%90%EC%BC%93",
  beaumonde: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014021",
  donokids: "https://www.donokids.com/shop/shopdetail.html?branduid=3362908",
} as const;

const ORIGIN_URL = "https://www.junioredition.com/en-kr/products/hug-hairy-monster-t-shirt-by-bobo-choses";

function okFacts(url: string, title = "후보 상품"): ProductUrlFactsResult {
  const u = new URL(url);
  return {
    status: "OK",
    crawlerUrl: url,
    dedupeKey: `${u.origin}|${u.pathname}${u.search}`,
    candidate: { title, url, price: null, regularPrice: null, imageUrl: null, confidence: 0 },
    httpCalls: 1,
    fetchPath: "PLAIN_HTML",
  };
}

const EMPTY = new Set<string>();

/* ══════════════════ A. 🔴 서버측 fetch 안전 경계 (SSRF · 순수) ══════════════════ */

describe("A. 🔴🔴 사용자가 준 URL 로 내부 네트워크를 때리지 않는다", () => {
  it("공개 상품 URL 은 통과한다", () => {
    for (const url of Object.values(GT_URLS)) expect(isPubliclyRoutableHttpUrl(url)).toBe(true);
    expect(isPubliclyRoutableHttpUrl("http://example.com/products/x")).toBe(true);
  });

  /**
   * 🔴 이 목록이 이 WU 의 **보안 계약** 이다. 클라우드 메타데이터(169.254.169.254)와
   *    루프백은 서버측 fetch 에서 가장 먼저 노려지는 자리다.
   */
  it.each([
    ["http://localhost/products/x", "점 없는 내부 이름"],
    ["http://intranet/products/x", "점 없는 내부 이름"],
    ["http://foo.localhost/products/x", "localhost 서브도메인"],
    ["http://svc.internal/products/x", "내부 TLD"],
    ["http://db.local/products/x", "내부 TLD"],
    ["http://127.0.0.1/products/x", "루프백"],
    ["http://10.1.2.3/products/x", "사설"],
    ["http://172.16.0.9/products/x", "사설"],
    ["http://172.31.255.1/products/x", "사설 경계"],
    ["http://192.168.0.1/products/x", "사설"],
    ["http://169.254.169.254/products/x", "링크로컬 = 클라우드 메타데이터"],
    ["http://0.0.0.0/products/x", "this-network"],
    ["http://100.64.0.1/products/x", "CGNAT"],
    ["http://239.1.1.1/products/x", "멀티캐스트"],
    ["http://2130706433/products/x", "10진 IP 표기"],
    ["http://[::1]/products/x", "IPv6 루프백"],
    ["http://[fc00::1]/products/x", "IPv6 unique-local"],
    ["http://[fe80::1]/products/x", "IPv6 링크로컬"],
    ["http://[::ffff:127.0.0.1]/products/x", "IPv4-mapped 우회"],
    ["https://example.com:8080/products/x", "비표준 포트 = 내부 포트 탐색"],
    ["ftp://example.com/products/x", "http 아님"],
    ["not a url", "파싱 불가"],
  ])("%s 는 거절된다 (%s)", (url) => {
    expect(isPubliclyRoutableHttpUrl(url)).toBe(false);
  });

  it("🔴 사설 호스트는 **HTTP 를 쓰기 전에** 걸러진다 — fetch 가 0 이다", async () => {
    let calls = 0;
    const r = await collectUrlCandidatePool({
      urls: ["http://169.254.169.254/products/x", "http://127.0.0.1/products/y"],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async (u) => {
        calls += 1;
        return okFacts(u);
      },
    });
    expect(calls).toBe(0);
    expect(r.metrics.fetchCalls).toBe(0);
    expect(r.searchResults).toEqual([]);
    expect(r.metrics.dropped.map((d) => d.reason)).toEqual(["NOT_PUBLIC_HOST", "NOT_PUBLIC_HOST"]);
  });
});

/* ══════════════════ B. 🟢 생산자 계약 — Registry 없이 후보가 들어온다 ══════════════════ */

describe("B. 🟢🟢 병목 A — 등록부에 없는 판매처의 후보가 공급된다", () => {
  it("GT 5곳 전부 후보가 되고 **host 별로** 갈라진다", async () => {
    const urls = Object.values(GT_URLS);
    const r = await collectUrlCandidatePool({
      urls,
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async (u) => okFacts(u),
    });
    expect(r.metrics.suppliedUrls).toBe(5);
    expect(r.metrics.acceptedUrls).toBe(5);
    expect(r.metrics.miEligibleCandidates).toBe(5);
    /** 🔴 host 를 합치면 샵당 1건만 살아남는다(`selectDomesticCandidate`) — 5개여야 한다. */
    expect(r.searchResults).toHaveLength(5);
    expect(r.searchResults.map((s) => s.domain).sort()).toEqual(
      ["beaumonde.co.kr", "biskuit.kr", "donokids.com", "m.luxboy.com", "m.web.mustit.co.kr"].sort(),
    );
    /** 🟢 저장 차단의 기준 — shopId 는 전부 가상이고 domain 은 **실제 host** 다. */
    expect(r.searchResults.every((s) => s.shopId === TRANSIENT_URL_SHOP_ID)).toBe(true);
    expect(r.searchResults.every((s) => s.status === "ok")).toBe(true);
    /** 🔴 외부 provider 를 부르지 않는다 — 구조상 0 이다. */
    expect(r.metrics.providerCalls).toBe(0);
  });

  it("🔴 국내 Cafe24 계열의 **쿼리 식별자가 보존** 된다 — 다른 상품이 접히지 않는다", async () => {
    const a = "https://www.donokids.com/shop/shopdetail.html?branduid=3362908";
    const b = "https://www.donokids.com/shop/shopdetail.html?branduid=9999999";
    const r = await collectUrlCandidatePool({
      urls: [a, b],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async (u) => okFacts(u),
    });
    /** 🔴🔴 `normalizeCandidateUrl`(쿼리 전체 제거)로 dedupe 하면 이 둘이 **1건** 이 된다. */
    expect(r.metrics.miEligibleCandidates).toBe(2);
    expect(r.searchResults).toHaveLength(1);
    expect(r.searchResults[0].candidates).toHaveLength(2);
  });

  it("목록/검색 URL 은 후보가 아니다 — 이유가 남는다", async () => {
    const r = await collectUrlCandidatePool({
      urls: ["https://biskuit.kr/category/367/", "https://www.donokids.com/"],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async (u) => okFacts(u),
    });
    expect(r.metrics.dropped.map((d) => d.reason)).toEqual(["NOT_PRODUCT_PAGE", "NOT_PRODUCT_PAGE"]);
    expect(r.metrics.acceptedUrls).toBe(0);
  });

  it("자기참조(원본과 같은 listing)는 후보가 아니다", async () => {
    const r = await collectUrlCandidatePool({
      urls: [ORIGIN_URL],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async (u) => okFacts(u),
    });
    expect(r.metrics.dropped[0]?.reason).toBe("SELF_REFERENCE");
  });

  it("이미 후보인 URL 은 **HTTP 없이** 제외된다", async () => {
    let calls = 0;
    const r = await collectUrlCandidatePool({
      urls: [GT_URLS.biskuit],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: new Set([GT_URLS.biskuit.toLowerCase()]),
      fetchFacts: async (u) => {
        calls += 1;
        return okFacts(u);
      },
    });
    expect(calls).toBe(0);
    expect(r.metrics.dropped[0]?.reason).toBe("ALREADY_CANDIDATE");
  });

  /** 🔴 §5-B — 「열어 보지 않았다」를 「상품이 없다」로 적지 않는다. */
  it("상한을 넘은 URL 은 «미확인» 으로 남는다 — 「없다」가 아니다", async () => {
    const r = await collectUrlCandidatePool({
      urls: [GT_URLS.biskuit, GT_URLS.luxboy, GT_URLS.mustit],
      originUrl: ORIGIN_URL,
      maxUrls: 1,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async (u) => okFacts(u),
    });
    expect(r.metrics.miEligibleCandidates).toBe(1);
    expect(r.metrics.notFetchedOverLimit).toHaveLength(2);
    /** 🔴 미확인은 `dropped` 에 들어가지 않는다 — 다른 사실이다. */
    expect(r.metrics.dropped).toEqual([]);
  });

  it("같은 페이지를 여는 서로 다른 URL 은 DUPLICATE 로 접힌다", async () => {
    const canonical = GT_URLS.luxboy;
    const r = await collectUrlCandidatePool({
      urls: [canonical, `${canonical}?utm_source=x`],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async () => okFacts(canonical),
    });
    expect(r.metrics.miEligibleCandidates).toBe(1);
  });

  it("🔴 후보 하나의 실패가 나머지를 죽이지 않는다 — throw 하지 않는다", async () => {
    const r = await collectUrlCandidatePool({
      urls: [GT_URLS.biskuit, GT_URLS.luxboy],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async (u) => {
        if (u.includes("biskuit")) throw new Error("boom");
        return okFacts(u);
      },
    });
    expect(r.metrics.dropped.map((d) => d.reason)).toContain("UNREACHABLE");
    expect(r.metrics.miEligibleCandidates).toBe(1);
  });

  it("상태 어휘를 뭉치지 않는다 — fetch 함수가 낸 값을 그대로 적는다", async () => {
    const r = await collectUrlCandidatePool({
      urls: [GT_URLS.biskuit, GT_URLS.luxboy],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async (u) =>
        u.includes("biskuit")
          ? { status: "NO_FACTS", crawlerUrl: u, dedupeKey: u, candidate: null, httpCalls: 1, fetchPath: "PLAIN_HTML" }
          : { status: "UNREACHABLE", crawlerUrl: u, dedupeKey: u, candidate: null, httpCalls: 1, fetchPath: "PLAIN_HTML" },
    });
    expect(r.metrics.dropped.map((d) => d.reason).sort()).toEqual(["NO_FACTS", "UNREACHABLE"]);
    expect(r.metrics.fetchCalls).toBe(2);
  });

  it("URL 을 공급하지 않으면 아무 일도 일어나지 않는다", async () => {
    const r = await collectUrlCandidatePool({
      urls: [],
      originUrl: ORIGIN_URL,
      maxUrls: 10,
      existingCanonicalUrls: EMPTY,
      fetchFacts: async () => {
        throw new Error("불려서는 안 된다");
      },
    });
    expect(r.searchResults).toEqual([]);
    expect(r.metrics.fetchCalls).toBe(0);
  });
});

/* ══════════════════ C. 🔴🔴 저장 차단 — 이 WU 의 가장 강한 제약 ══════════════════ */

describe("C. 🔴🔴 공급된 URL 은 저장되지 않는다 (등록부·링크 모두)", () => {
  it("일시 샵 술어가 **두 id 전부** 를 막는다 — 등록부 id 는 막지 않는다", () => {
    expect(isTransientShopId(TRANSIENT_URL_SHOP_ID)).toBe(true);
    expect(isTransientShopId(GEMINI_VIRTUAL_SHOP_ID)).toBe(true);
    expect(TRANSIENT_SHOP_IDS.size).toBe(2);
    /** 🔴 등록부 id(uuid)를 막으면 **진짜 샵의 저장이 멈춘다**. */
    expect(isTransientShopId("3f2a7c18-9b11-4a55-8c21-0d7b6e5f4a33")).toBe(false);
    expect(isTransientShopId("")).toBe(false);
  });

  it("가상 샵 id 는 등록부 id 모양(uuid)이 아니다 — FK 로 들어갈 수 없는 값이다", () => {
    expect(TRANSIENT_URL_SHOP_ID).toBe("__url_candidates__");
    expect(TRANSIENT_URL_SHOP_ID).not.toMatch(/^[0-9a-f-]{36}$/i);
  });

  /** 🔴 가드가 upsert **앞** 이어야 한다 — 뒤면 이미 저장된 뒤다. */
  it("upsertDomesticProductLink «앞» 에서 술어가 끊는다", () => {
    const upsert = RUNNER.indexOf("const upsertResult = await upsertDomesticProductLink(");
    const guard = RUNNER.lastIndexOf("isTransientShopId(result.shopId)", upsert);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(upsert);
    expect(RUNNER.slice(guard, upsert)).toContain("continue");
  });

  /**
   * 🔴🔴 **두 가드가 «같은 술어» 를 봐야 한다.** 갈라지면 한쪽만 고쳐져
   *    FK 없는 id 가 `recordDomesticSourceCheckAttempt` 나 upsert 로 흘러간다
   *    (WU-007A 가 같은 이유로 호출부 2곳을 각각 고치지 않았다).
   */
  it("등록부 쓰기 두 곳이 같은 술어를 쓴다 — id 직접 비교가 남아 있지 않다", () => {
    const wrapper = RUNNER.slice(RUNNER.indexOf("const recordCheckAttempt"));
    expect(wrapper.slice(0, 400)).toContain("isTransientShopId(shopId)");
    /** 🔴 저장 경로에서 **id 하나와 직접 비교** 하는 가드가 없어야 한다. */
    expect(RUNNER).not.toContain("shopId === GEMINI_VIRTUAL_SHOP_ID");
  });

  it("🔴 생산자 모듈에 DB/저장 어휘가 «없다»", () => {
    for (const forbidden of ["supabase", "prisma", "insert(", "upsert", "INSERT", 'from("']) {
      expect(POOL).not.toContain(forbidden);
      expect(LEAF).not.toContain(forbidden);
    }
  });

  it("🔴 등록부에 도메인을 추가하는 코드가 없다", () => {
    for (const src of [POOL, LEAF]) {
      expect(src).not.toMatch(/domestic_price_sources|createDomesticPriceSource|registerShop/i);
    }
  });
});

/* ══════════════════ D. 🔴 출처 보존 — 「웹 검색」과 「사람이 준 URL」을 섞지 않는다 ══════════════════ */

describe("D. 🔴 출처를 잃지 않는다", () => {
  it("evidence 가 출처별 «다른 배열» 로 나간다", () => {
    expect(RUNNER).toContain("const transientEvidenceSink = isSuppliedUrl ? urlCandidateEvidence : geminiEvidence;");
    expect(RUNNER).toContain('source: isSuppliedUrl ? "SELLER_URL" : "GEMINI_DISCOVERY",');
    /** 🔴 공급받지 않았으면 `null` — 「후보 0」과 구분한다. */
    expect(RUNNER).toContain("urlCandidateEvidence: urlCandidateMetrics === null ? null : urlCandidateEvidence");
  });

  it("🔴 두 경로의 HTTP 비용을 합산하지 않는다", () => {
    expect(RUNNER).toContain("if (isUrlPool) urlCandidatePriceEnrichCalls += 1;");
    expect(RUNNER).toContain("else geminiPriceEnrichCalls += 1;");
  });

  it("화면 머리 문구가 출처별로 다르다 — 같은 컴포넌트, 다른 구역", () => {
    expect(SUPPLIED_URL_HEADING).not.toBe(WEB_SEARCH_HEADING);
    const web = renderToStaticMarkup(
      GeminiTransientCandidates({ evidence: [{ domain: "a.com", discoveredUrl: "https://a.com/products/1" }] }) as never,
    );
    const supplied = renderToStaticMarkup(
      GeminiTransientCandidates({
        evidence: [{ domain: "biskuit.kr", discoveredUrl: GT_URLS.biskuit }],
        heading: SUPPLIED_URL_HEADING,
        testId: "url-candidate-transient",
      }) as never,
    );
    expect(web).toContain(WEB_SEARCH_HEADING);
    expect(web).not.toContain(SUPPLIED_URL_HEADING);
    expect(supplied).toContain(SUPPLIED_URL_HEADING);
    expect(supplied).not.toContain(WEB_SEARCH_HEADING);
    /** 🟢 두 구역의 **고정 안내문과 저장 금지 성질** 은 같다 — 출처만 다르다. */
    for (const html of [web, supplied]) {
      expect(html).toContain("이번 확인에만 쓰이고 저장되지 않습니다.");
      expect(html).toContain("국내 최저가 및 판매판정에 영향을 주지 않습니다.");
      /** 🔴 승격 버튼(DB 저장)을 달지 않는다. */
      expect(html).not.toContain("동일상품 확인");
    }
    expect(supplied).toContain('data-testid="url-candidate-transient"');
  });
});

/* ══════════════════ E. 🟢 공급이 없으면 기존 동작 100% 유지 ══════════════════ */

describe("E. 🟢 URL 미공급 · Gemini OFF → 기존 경로와 완전히 같다", () => {
  it("URL 경로가 **공급받았을 때만** 돈다", () => {
    expect(RUNNER).toContain("if (input.candidateUrls && input.candidateUrls.length > 0) {");
  });

  /**
   * 🔴🔴 **공통 소비 루프가 Gemini flag 분기 «밖» 이어야 한다.** 안에 있으면 URL
   *    경로가 Gemini flag 에 묶이고(= AI 전제가 되살아난다) 그것이 WU-023 의 병목이었다.
   * 🟢 그리고 둘 다 비면 **한 번도 돌지 않는다** — 그래서 기존 동작이 유지된다.
   */
  it("일시 후보 소비 루프가 flag 분기 밖에 있다", () => {
    const flagBlock = RUNNER.indexOf("isGeminiDiscoveryEnabled() && geminiSkipReason === null");
    const loop = RUNNER.indexOf("for (const r of transientPools) {");
    expect(flagBlock).toBeGreaterThan(-1);
    expect(loop).toBeGreaterThan(flagBlock);
    /** 🔴 루프가 그 if 블록 «안» 이면 사이에 닫는 괄호가 없다 — 닫힘이 있어야 밖이다. */
    expect(RUNNER.slice(flagBlock, loop)).toContain("\n  }");
  });

  it("Gemini 후보도 **같은 루프** 를 통과한다 — 사본이 없다", () => {
    expect((RUNNER.match(/enrichCandidatePrices\(scored/g) ?? []).length).toBe(1);
    expect((RUNNER.match(/transientPools\.push/g) ?? []).length).toBe(2);
  });
});

/* ══════════════════ F. 🔴 라우트 경계 ══════════════════ */

describe("F. 🔴 라우트가 모양만 검사하고 상한을 공유한다", () => {
  it("상한 상수를 **import** 한다 — 두 곳이 다른 값을 갖지 않는다", () => {
    expect(ROUTE).toContain("MAX_SUPPLIED_CANDIDATE_URLS");
    expect(ROUTE).toContain("MAX_CANDIDATE_URL_PAYLOAD = MAX_SUPPLIED_CANDIDATE_URLS");
    expect(RUNNER).toContain("export const MAX_SUPPLIED_CANDIDATE_URLS = 10;");
  });

  it("배열이 아니거나 너무 크면 400 이다", () => {
    expect(ROUTE).toContain("if (!Array.isArray(body.candidateUrls))");
    expect(ROUTE).toContain("if (body.candidateUrls.length > MAX_CANDIDATE_URL_PAYLOAD)");
  });

  it("🔴 라우트가 «판정» 을 하지 않는다 — 입력 경계는 pool 이 소유한다", () => {
    for (const forbidden of ["classifyUrlShape", "isSelfReference", "isPubliclyRoutableHttpUrl", "factsFromProductUrl"]) {
      expect(ROUTE).not.toContain(forbidden);
    }
  });

  it("인증이 먼저다 — 크롤러를 돌리는 경로다", () => {
    expect(ROUTE.indexOf("await requireUser()")).toBeLessThan(ROUTE.indexOf("candidateUrls"));
  });
});
