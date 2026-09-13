import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MI-MATCHING-3.0 STEP 0(CEO 지시, 2026-09-14) — **429는 "재고 없음"이 아니다.**
 *
 * 실측(2026-09-14, 같은 순간·같은 IP·같은 헤더, junioredition/nickis/villagekids
 * 3개 도메인에서 2회 재현): node fetch(undici)는 429, node:https는 200, node:http2도
 * 200, curl도 200이다. User-Agent를 curl 것으로 바꿔도 undici는 그대로 429이고,
 * 새 프로세스의 첫 요청도 429다 — 헤더도 요청량도 커넥션 재사용도 아니다.
 * 그런데 이 429가 화면에서는 "해외 편집샵에 그 상품이 없다"로 읽히고 있었다.
 *
 * 이 테스트가 고정하는 것은 그 결론이 아니라 **행동**이다: 429를 받으면 이미
 * 저장소에 있던 node:https 경로로 한 번 더 물어보고, 그마저 실패하면 429를 그대로
 * 돌려준다(조용히 "결과 없음"으로 바꾸지 않는다).
 */

const fetchHtmlDirect = vi.fn();
vi.mock("../utils/direct-html-fetch", () => ({ fetchHtmlDirect }));

const { fetchWithDomainRateLimit } = await import("../rate-limit/domain-rate-limiter");

const URL_429 = "https://example-shop-429.test/search/suggest.json?q=x";

function response(status: number, body = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body) as unknown,
  } as unknown as Response;
}

beforeEach(() => {
  fetchHtmlDirect.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** 백오프 sleep이 실제로 흐르지 않게 타이머를 밀어준다(테스트가 5초를 기다리지 않는다). */
async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then((value) => value);
  await vi.runAllTimersAsync();
  return settled;
}

describe("MI-MATCHING-3.0 — undici가 429를 받으면 node:https 경로로 한 번 더 묻는다", () => {
  it("undici 429 · direct 200 → direct 응답을 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(429)));
    fetchHtmlDirect.mockResolvedValue({ status: 200, html: '{"ok":true}', finalUrl: URL_429 });

    const result = await runWithTimers(
      fetchWithDomainRateLimit(URL_429, { headers: { Accept: "application/json", "User-Agent": "UA" } }),
    );

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toEqual({ ok: true });
    // 호출부가 쓰던 헤더가 그대로 전달돼야 한다 — suggest.json은 Accept가 다르면
    // 다른 응답을 준다.
    expect(fetchHtmlDirect).toHaveBeenCalledWith(URL_429, undefined, {
      Accept: "application/json",
      "User-Agent": "UA",
    });
  });

  it("direct도 실패하면 원래의 429를 그대로 돌려준다(결과 없음으로 바꾸지 않는다)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(429)));
    fetchHtmlDirect.mockResolvedValue(null);

    const result = await runWithTimers(fetchWithDomainRateLimit(URL_429));

    expect(result.status).toBe(429);
  });

  it("direct도 429면 429를 그대로 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(429)));
    fetchHtmlDirect.mockResolvedValue({ status: 429, html: "", finalUrl: URL_429 });

    const result = await runWithTimers(fetchWithDomainRateLimit(URL_429));

    expect(result.status).toBe(429);
  });

  it("200이면 direct 경로를 부르지 않는다(요청이 늘어나지 않는다)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(200, '{"ok":true}')));

    const result = await runWithTimers(fetchWithDomainRateLimit("https://example-shop-ok.test/x.json"));

    expect(result.status).toBe(200);
    expect(fetchHtmlDirect).not.toHaveBeenCalled();
  });
});
