import { describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-084 — **헤더 초과만 직접 스택으로 되돌린다** (네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 실측(WU-083/084): 일부 사이트가 응답 헤더를 **19KB** 보낸다. Node `fetch`(undici)
 *    기본 상한은 **16KB** 라 본문 전에 끊긴다 — `cause.code = UND_ERR_HEADERS_OVERFLOW`.
 * 🔴 **`TypeError: fetch failed` 문구만으로 판단하지 않는다** — DNS 실패·연결 거부도
 *    같은 문구다(실측). 그래서 **전용 코드** 로만 가른다.
 * 🟢 되돌리는 곳은 **429 폴백이 이미 쓰는 직접 스택** 이다(새 fetch 방식 0 ·
 *    `maxHeaderSize 64KB` · `classifyOutboundUrl`+`guardedLookup` 계약 유지).
 */

const direct = vi.fn();
vi.mock("../../utils/direct-html-fetch", () => ({
  fetchHtmlDirect: (...args: unknown[]) => direct(...args),
}));

const overflow = () => {
  const e = new TypeError("fetch failed");
  (e as { cause?: unknown }).cause = { name: "HeadersOverflowError", code: "UND_ERR_HEADERS_OVERFLOW" };
  return e;
};
const dnsFail = () => {
  const e = new TypeError("fetch failed");
  (e as { cause?: unknown }).cause = { name: "Error", code: "ENOTFOUND" };
  return e;
};

const { fetchWithDomainRateLimit } = await import("../domain-rate-limiter");
const URL_OK = "https://example.com/products/x";

describe("WU-084 — 헤더 초과 폴백", () => {
  it("🟢 정상 URL — 직접 스택을 **부르지 않는다**(불필요한 2차 fetch 0)", async () => {
    direct.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>ok</html>", { status: 200 })));
    const r = await fetchWithDomainRateLimit(URL_OK);
    expect(r.status).toBe(200);
    expect(direct).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("🔴 **헤더 초과** — 직접 스택으로 1회 되돌리고 본문을 돌려준다", async () => {
    direct.mockClear();
    direct.mockResolvedValue({ status: 200, html: "<html>big-header</html>", finalUrl: URL_OK });
    vi.stubGlobal("fetch", vi.fn(async () => { throw overflow(); }));
    const r = await fetchWithDomainRateLimit(URL_OK);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("big-header");
    expect(direct).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("🔴 **DNS 실패는 재시도하지 않는다** — 무차별 retry 금지", async () => {
    direct.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => { throw dnsFail(); }));
    await expect(fetchWithDomainRateLimit(URL_OK)).rejects.toThrow("fetch failed");
    expect(direct).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("🔴 헤더 초과인데 직접 스택도 실패하면 — **원래 오류를 던진다**(조용히 삼키지 않는다)", async () => {
    direct.mockClear();
    direct.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn(async () => { throw overflow(); }));
    await expect(fetchWithDomainRateLimit(URL_OK)).rejects.toThrow("fetch failed");
    expect(direct).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("🔴 HTTP 4xx/5xx 는 **오류가 아니다** — 그대로 돌려주고 재시도하지 않는다", async () => {
    direct.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const r = await fetchWithDomainRateLimit(URL_OK);
    expect(r.status).toBe(404);
    expect(direct).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
