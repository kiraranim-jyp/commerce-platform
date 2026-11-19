/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 범용 MI — **수집 실패 사유를 «돌려준다»**(네트워크 0 · 정책 변경 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 범용 과제로 승격됐나**(CPO 기준: 「한 사이트만 실패 → 패스 · 여러 사이트에서
 *    같은 문제 반복 → 범용 MI 개선」). 분모 **22**(A군 GT 쌍) 실측:
 *
 * ```
 * FETCH_FAIL      14건 · **12 호스트**   HTTP_429 **12** · TimeoutError 2   ← 반복 확정
 * NO_DESCRIPTION   1건 ·  1 호스트                                         ← 단일 ⟹ 패스
 * OK               7건 ·  7 호스트
 * ```
 *    ⟹ 🔴 **특정 사이트 예외 처리가 아니다.** 호스트 조건·사이트 전용 분기 **0** 이다.
 *
 * 🔴 고친 것은 **분류의 정직성** 하나다 — `UNREACHABLE` 이 「그 판매처가 **우리를
 *    막는다**(4xx)」와 「우리가 **닿지 못했다**(타임아웃·DNS)」를 같은 글자로 만들고
 *    있었다(WU-105 가 이미 관측한 자리).
 *
 * 🔴 **하지 않은 것** — 429 우회(UA 변경·회전) · 재시도 추가 · 타임아웃 상향 ·
 *    실패를 성공으로 바꾸기 · `status` union 확장 · SAME 기준 · 가격 로직.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/** 🔴 운영 limiter 를 **대역** 한다 — 실제 네트워크를 쓰지 않는다. */
const fetchMock = vi.fn();
vi.mock("../../rate-limit/domain-rate-limiter", () => ({
  fetchWithDomainRateLimit: (url: string, init?: unknown) => fetchMock(url, init),
}));

/**
 * 🔴 Shopify 가 **아닌** 상품 URL 이어야 `htmlPath`(PLAIN_HTML)로 간다.
 *    🟢 모양을 테스트가 **스스로 확인** 한다(아래 B-0) — 분류기가 바뀌어 이 URL 이
 *       `NOT_PRODUCT_URL` 로 떨어지면 「사유가 없다」가 아니라 **그 사실이** FAIL 로 뜬다.
 * 🔴 실제 판매처 도메인을 쓰지 않는다 — 이 계약은 **사이트와 무관** 하다.
 */
const PLAIN_URL = "https://shop.example.co.kr/product/detail.html?no=1";

const facts = async () => (await import("../product-url-facts")).factsFromProductUrl;
const shape = async () => (await import("../url-shape")).classifyUrlShape;

afterEach(() => {
  fetchMock.mockReset();
});

/* ══════════════════ A. 사유가 «반환» 된다 — 로그만이 아니다 ══════════════════ */

describe("A 🔵 실패 사유 반환", () => {
  it("B-0 🟢 대역 전제 — 이 URL 이 **PLAIN_HTML 경로** 로 간다", async () => {
    expect(await (await shape())(PLAIN_URL)).toBe("PRODUCT_PAGE");
    const { extractShopifyHandle } = await import("../../shopify-product-json");
    expect(extractShopifyHandle(PLAIN_URL), "🔴 Shopify 경로로 가면 이 계약이 헛돈다").toBeNull();
  });

  /**
   * 🔴🔴 **이것이 이 스프린트의 핵심 단언이다.** 전까지 호출부가 받는 것은 `null`
   *    하나뿐이라 429 와 타임아웃이 **같은 글자** 가 됐다.
   */
  it("A-1 🔴🔴 **거부(4xx)** 는 상태코드로 돌아온다 — `HTTP_429`", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    const r = await (await facts())(PLAIN_URL);
    expect(r.status).toBe("UNREACHABLE");
    expect(r.failureReason).toBe("HTTP_429");
    expect(r.fetchPath).toBe("PLAIN_HTML");
    /** 🔴 HTTP 를 더 쓰지 않았다 — 재시도를 붙이지 않았다는 증거다. */
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("A-2 🟢 404 도 **같은 축으로** 구분된다(429 전용 분기가 아니다)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    expect((await (await facts())(PLAIN_URL)).failureReason).toBe("HTTP_404");
  });

  it("A-3 🔴 **닿지 못함** 은 예외 이름으로 돌아온다 — `TimeoutError`", async () => {
    const err = new Error("The operation was aborted due to timeout");
    err.name = "TimeoutError";
    fetchMock.mockRejectedValue(err);
    const r = await (await facts())(PLAIN_URL);
    expect(r.status).toBe("UNREACHABLE");
    expect(r.failureReason).toBe("TimeoutError");
  });

  /** 🔴 `TypeError: fetch failed` 는 DNS·거부·타임아웃이 **같은 문구** 다(WU-084 함정). */
  it("A-4 🟢 undici `cause.code` 가 **문구보다 먼저** 다 — `ENOTFOUND`", async () => {
    const err = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    fetchMock.mockRejectedValue(err);
    expect((await (await facts())(PLAIN_URL)).failureReason).toBe("ENOTFOUND");
  });

  it("A-5 🟢 모양을 모르는 예외는 **지어내지 않는다** — `UNKNOWN_ERROR`", async () => {
    fetchMock.mockRejectedValue({});
    expect((await (await facts())(PLAIN_URL)).failureReason).toBe("UNKNOWN_ERROR");
  });

  /**
   * 🔴 성공 경로에 사유를 붙이지 않는다 — 「모른다」를 빈 문자열로 만들면 소비자가
   *    `failureReason` 의 존재만 보고 실패로 읽는다.
   */
  it("A-6 🔴 성공·비(非)fetch 경로에는 `failureReason` 이 **없다**", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      url: PLAIN_URL,
      text: async () => "<html><head><title>검정 티셔츠</title></head><body></body></html>",
    });
    const ok = await (await facts())(PLAIN_URL);
    expect(ok.status).not.toBe("UNREACHABLE");
    expect(ok.failureReason).toBeUndefined();

    /** 🟢 HTTP 를 쓰지 않는 경로(목록 URL)도 마찬가지다. */
    const listing = await (await facts())("https://shop.example.co.kr/product/list.html?cate=1");
    expect(listing.status).toBe("NOT_PRODUCT_URL");
    expect(listing.failureReason).toBeUndefined();
  });

  /**
   * 🔴🔴 **Shopify 경로도 같이 덮는다.** `/products/{handle}.json` 이 막히면 운영은
   *    **HTML 로 내려간다**(「상품 없음」이 아니다 · `htmlPath(…, 1)`). 그 2차 시도가
   *    실패했을 때도 사유가 와야 한다 — 그러지 않으면 Shopify 후보만 조용히 뭉개진다.
   * 🟢 `httpCalls` **2** 가 그 경로를 지나왔다는 증거다(비용을 숨기지 않는다).
   */
  it("A-7 🟢 **Shopify → HTML 폴백** 경로에서도 사유가 온다", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    const r = await (await facts())("https://brand.example.com/products/some-handle");
    expect(r.status).toBe("UNREACHABLE");
    expect(r.failureReason).toBe("HTTP_429");
    expect(r.httpCalls, "🔴 JSON 1 + HTML 1 — 경로를 지나온 증거").toBe(2);
  });
});

/* ══════════════ B. union 은 «그대로» 다 — 소비자 영향 0 ══════════════ */

const CRAWLER = path.join(process.cwd(), "..", "..", "packages", "crawler", "src");
/** 🔴 주석을 **벗긴다** — 주석 속 설명이 「구현됐다」로 세어지는 함정(여덟 번 걸렸다). */
const bare = (p: string) =>
  readFileSync(path.join(CRAWLER, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");

describe("B 🔴 상태 union 불변", () => {
  /**
   * 🔴🔴 `UNREACHABLE` 을 쪼개면 `AiUrlDropReason` · `UrlCandidateDropReason` ·
   *    화면 집계가 **같이** 갈라진다. ⟹ 상태는 하나로 두고 사유를 **칸으로** 붙였다.
   */
  it("B-1 🔴🔴 `ProductUrlFactsStatus` 가 **정확히 다섯** 이다", () => {
    const src = bare("comparison-search/product-url-facts.ts");
    const at = src.indexOf("export type ProductUrlFactsStatus");
    const seg = src.slice(at, src.indexOf("export interface ProductUrlFactsResult"));
    const values = (seg.match(/"[A-Z_]+"/g) ?? []).map((v) => v.replaceAll('"', ""));
    expect(new Set(values)).toEqual(
      new Set(["OK", "NOT_PRODUCT_URL", "UNREACHABLE", "NO_FACTS", "REDIRECTED_AWAY"]),
    );
  });

  it("B-2 🔴 사유를 **새 상태 이름** 으로 만들지 않았다", () => {
    const src = bare("comparison-search/product-url-facts.ts");
    for (const banned of ["ACCESS_DENIED", "RATE_LIMITED", "UNREACHABLE_", "FETCH_FAILED"]) {
      expect(src, `🔴 ${banned} — 「이름만 바꿔 완료」 금지(CPO)`).not.toContain(banned);
    }
  });

  it("B-3 🟢 사유 칸은 **옵셔널** 이다(기존 소비자가 깨지지 않는다)", () => {
    expect(bare("comparison-search/product-url-facts.ts")).toContain("failureReason?: string;");
  });
});

/* ══════════ C. fetch 규칙 owner 는 «하나» · 정책은 그대로 ══════════ */

describe("C 🔴 owner 단일 · 정책 보존", () => {
  const SHOPIFY = "shopify-product-json.ts";
  const detailed = () => {
    const src = bare(SHOPIFY);
    const at = src.indexOf("export async function fetchPlainHtmlWithFinalUrlDetailed");
    expect(at, "🔴 fetch owner 가 사라졌다").toBeGreaterThan(0);
    const end = src.indexOf("export async function fetchPlainHtmlWithFinalUrl(", at);
    expect(end, "🔴 위임 껍데기가 사라졌다 — 규칙이 둘로 갈린다").toBeGreaterThan(at);
    return { src, body: src.slice(at, end), shell: src.slice(end) };
  };

  /**
   * 🔴🔴 **껍데기가 규칙을 «다시 적지 않는다».** WU-075 가 `fetchPlainHtml` 에 쓴
   *    그 패턴이다 — 헤더/타임아웃/상태코드가 두 곳에 있으면 한쪽만 고쳐져 갈린다.
   */
  it("C-1 🔴🔴 껍데기는 **위임만** 한다", () => {
    const { shell } = detailed();
    expect(shell).toContain("fetchPlainHtmlWithFinalUrlDetailed(url)");
    for (const rule of ["User-Agent", "AbortSignal.timeout", "fetchWithDomainRateLimit"]) {
      expect(shell, `🔴 껍데기에 ${rule} 가 생겼다 — owner 가 둘이 됐다`).not.toContain(rule);
    }
  });

  it("C-2 🔴 두 실패 경로가 **둘 다** 사유를 반환한다", () => {
    const { body } = detailed();
    expect((body.match(/recordPlainHtmlFailure\(/g) ?? []).length).toBe(2);
    expect((body.match(/return \{ ok: false, reason \}/g) ?? []).length).toBe(2);
    expect(body, "🔴 빈 catch 가 돌아왔다 — 원인이 사라진다").not.toMatch(
      /catch\s*\{\s*return null;\s*\}/,
    );
  });

  /**
   * 🔴🔴🔴 **가장 중요한 단언 — 차단을 «우회» 하지 않는다.**
   *    429 는 UA 를 바꾸면 사라진다. 그것은 접근 차단 우회이고 제품 정책 사안이다.
   *    🔴 호스트 **12곳** 이 429 를 주는 것이 실측됐고 CPO 가 **현상 유지** 를 확정했다.
   */
  it("C-3 🔴🔴 UA 하나·고정 · 재시도 0 · 타임아웃 10000 **그대로**", () => {
    const { src, body } = detailed();
    expect((src.match(/Mozilla\/5\.0[^"`]*/g) ?? []).length, "🔴 UA 가 둘 이상이다").toBe(1);
    for (const banned of ["UA_POOL", "randomUserAgent", "rotateUa", "USER_AGENTS"]) {
      expect(src, `🔴 ${banned} — UA 회전은 차단 우회다`).not.toContain(banned);
    }
    expect(body).toContain("AbortSignal.timeout(FETCH_TIMEOUT_MS)");
    expect(body, "🔴 스스로 재시도하면 limiter 와 둘로 갈린다").not.toContain("while (");
    expect(src).toContain("FETCH_TIMEOUT_MS = 10000");
  });

  /** 🔴 사유를 보고 **재시도·성공 처리** 하지 않는다 — 실패는 그대로 실패다. */
  it("C-4 🔴 호출부는 사유를 **적기만** 한다", () => {
    const src = bare("comparison-search/product-url-facts.ts");
    const at = src.indexOf("async function htmlPath");
    const seg = src.slice(at, at + 1400);
    expect(seg).toContain("failureReason: fetched.reason");
    expect(seg).toContain('status: "UNREACHABLE"');
    for (const banned of ["reason ===", "reason.includes", "reason.startsWith"]) {
      expect(seg, "🔴 사유로 분기하면 사이트별 예외가 들어온다").not.toContain(banned);
    }
    expect(seg, "🔴 재시도 금지").not.toMatch(/for \(|while \(/);
  });

  /** 🔴 로그에 URL 원문·인증정보를 넣지 않는다 — host 와 사유까지다. */
  it("C-5 🔴 로그 범위가 **host · reason** 그대로다", () => {
    const src = bare(SHOPIFY);
    const at = src.indexOf("function recordPlainHtmlFailure");
    const seg = src.slice(at, at + 700);
    expect(seg).toContain("new URL(url).hostname");
    expect(seg).toContain("{ host, reason }");
    for (const banned of ["Authorization", "cookie", "token"]) {
      expect(seg, `🔴 로그에 ${banned} 가 섞였다`).not.toContain(banned);
    }
  });

  /** 🔴 사이트별 분기를 넣지 않았다 — 이 스프린트의 전제다(CPO 방향 수정). */
  it("C-6 🔴🔴 **호스트 조건이 0** 이다(사이트 전용 예외 금지)", () => {
    const src = bare(SHOPIFY);
    for (const banned of ["trenbe", "smallable", "wconcept", "main-story"]) {
      expect(src, `🔴 ${banned} — 개별 사이트 예외 처리는 제품 전략이 아니다`).not.toContain(
        banned,
      );
    }
  });
});
