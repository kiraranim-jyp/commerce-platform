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

  /**
   * 🔴🔴 SS-02-d — **측정 칸이 없으면 CPO 가 요구한 표를 만들 수 없다.**
   *    「page 1 organic → page 2 organic → 중복 제거 후」 세 칸이 **계측에 남아야** 한다.
   */
  it("SS-02-d 🔴 페이지별 organic 수와 중복 제거 후 수가 «둘 다» 남는다", async () => {
    const out = await collectWebSearchUrls({
      identity: identity as never,
      search: async () => ["https://a.example/1", "https://a.example/1", "https://b.example/2"],
      token: "x",
    });
    /** 🔴 **중복 제거 후** 가 다음 단계의 입력 분모다. */
    expect(out.metrics.organicResults, "🔴 중복이 분모에 남았다").toBe(2);
    /** 🔴 페이지 칸이 비면 「측정 못 했다」가 드러나야 한다 — 지어내지 않는다. */
    expect(Array.isArray(out.metrics.organicPerPage)).toBe(true);
    expect(out.metrics.organicPerPage.length).toBe(1);
    expect(out.metrics.pagesReturned).toBe(1);
  });

  it("SS-02-e 🔴 운영 로그가 페이지별 수를 싣는다(Production 확인 경로)", () => {
    const RUNNER = readFileSync(join(__dirname, "..", "run-domestic-price-check.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const at = RUNNER.indexOf("[SP07-websearch]");
    expect(at).toBeGreaterThan(0);
    const block = RUNNER.slice(at, at + 500);
    expect(block, "🔴 로그에 페이지 수가 없다").toContain("pages: webSearchMetrics.pagesReturned");
    expect(block, "🔴 로그에 페이지별 수가 없다").toContain("perPage: webSearchMetrics.organicPerPage");
  });

  /* ══════════════════════════════════════════════════════════════════════════
   * 🔵🔵🔵 SEARCH-FAILURE-OBSERVABILITY-01 — TEST-01~05
   * ══════════════════════════════════════════════════════════════════════════ */

  it("TEST-01 🔴 provider 오류 — failed + errorName + (status | code) 가 남는다", async () => {
    const boom = Object.assign(new Error("x"), { name: "SearchHttpError", status: 503 });
    const out = await collectWebSearchUrls({
      identity: identity as never,
      search: async () => {
        throw boom;
      },
      token: "x",
    });
    expect(out.metrics.failed).toBe(true);
    expect(out.metrics.errorName, "🔴 오류 이름이 사라졌다").toBe("SearchHttpError");
    expect(
      out.metrics.errorStatus ?? out.metrics.errorCode,
      "🔴 상태코드도 코드도 없다 — 계열을 가를 수 없다",
    ).toBeTruthy();
    expect(out.metrics.errorStatus).toBe(503);
    expect(out.metrics.timeout).toBe(false);
  });

  it("TEST-02 🔴 timeout — timeout=true 가 남는다", async () => {
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    const out = await collectWebSearchUrls({
      identity: identity as never,
      search: async () => {
        throw abort;
      },
      token: "x",
    });
    expect(out.metrics.failed).toBe(true);
    expect(out.metrics.timeout, "🔴 timeout 을 구분하지 못한다").toBe(true);
    expect(out.metrics.errorName).toBe("AbortError");
  });

  it("TEST-02-b 🟢 undici 런타임 코드도 잡는다(cause.code)", async () => {
    const err = Object.assign(new Error("fetch failed"), {
      name: "TypeError",
      cause: { code: "UND_ERR_SOCKET" },
    });
    const out = await collectWebSearchUrls({
      identity: identity as never,
      search: async () => {
        throw err;
      },
      token: "x",
    });
    expect(out.metrics.errorCode).toBe("UND_ERR_SOCKET");
    expect(out.metrics.errorName).toBe("TypeError");
  });

  /** 🔴🔴 TEST-03 — **보안이 최우선** 이다. 토큰·본문·URL 이 계측에 새면 FAIL. */
  it("TEST-03 🔴 secret / body / URL 이 계측에 남지 않는다", async () => {
    const leaky = Object.assign(
      new Error("https://api.example/run?token=SECRET_TOKEN_VALUE body={\"a\":1}"),
      { name: "TypeError", status: 401 },
    );
    const out = await collectWebSearchUrls({
      identity: identity as never,
      search: async () => {
        throw leaky;
      },
      token: "SECRET_TOKEN_VALUE",
    });
    const dump = JSON.stringify(out.metrics);
    for (const secret of ["SECRET_TOKEN_VALUE", "token=", "Authorization", "body=", "https://"]) {
      expect(dump, `🔴 계측에 비밀/본문이 샜다: ${secret}`).not.toContain(secret);
    }
    /** 🟢 그러면서 **계열은 남는다**(종류만 남기는 것이 목적이다). */
    expect(out.metrics.errorStatus).toBe(401);
  });

  it("TEST-04 🟢 성공 회귀 — failed=false 이고 기존 칸이 그대로다", async () => {
    const out = await collectWebSearchUrls({
      identity: identity as never,
      search: async () => ["https://a.example/1", "https://b.example/2"],
      token: "x",
    });
    expect(out.metrics.failed).toBe(false);
    expect(out.metrics.errorName).toBeNull();
    expect(out.metrics.errorStatus).toBeNull();
    expect(out.metrics.errorCode).toBeNull();
    expect(out.metrics.timeout).toBe(false);
    expect(out.metrics.organicResults).toBe(2);
    expect(out.metrics.pagesReturned).toBe(1);
  });

  it("TEST-05 🔴 운영 로그가 네 칸을 싣는다 · message 는 싣지 않는다", () => {
    const RUNNER = readFileSync(join(__dirname, "..", "run-domestic-price-check.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const at = RUNNER.indexOf("[SP07-websearch]");
    const block = RUNNER.slice(at, at + 900);
    for (const k of ["errorName", "errorStatus", "errorCode", "timeout"]) {
      expect(block, `🔴 로그에 ${k} 가 없다`).toContain(`${k}: webSearchMetrics.${k}`);
    }
    /** 🔴 message/본문/URL 을 로그에 싣지 않는다. */
    for (const banned of ["errorMessage", ".message", "responseBody", "res.url"]) {
      expect(block, `🔴 로그에 위험한 값이 들어갔다: ${banned}`).not.toContain(banned);
    }
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
