import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

/**
 * 🔴🔴 WU-025 — **DNS 도 모킹한다.** outbound 경계가 요청 직전에 목적지 이름을
 *    해석하고(사설이면 막는다 · 해석 실패도 막는다 = fail-closed), 그래서 이 단위
 *    테스트가 **실제 DNS 에 의존하게 됐다**. 가짜 호스트는 당연히 해석되지 않는다.
 *
 * 🔴 가드를 느슨하게 하는 쪽으로 고치지 않는다 — 단위 테스트가 네트워크/DNS 에
 *    의존하지 않도록 **여기서 공개 IP 로 해석된다고 고정** 한다(hermetic 해졌다).
 * 🟢 「사설로 해석되면 막힌다」는 WU-025 전용 하니스가 따로 단언한다.
 */
vi.mock("node:dns", () => ({
  lookup: (_host: string, _options: unknown, cb: (e: unknown, a: unknown) => void) =>
    cb(null, [{ address: "93.184.216.34", family: 4 }]),
}));

const { fetchWithDomainRateLimit } = await import("../rate-limit/domain-rate-limiter");
const { outboundDispatcher } = await import("../utils/outbound-guard");

/**
 * 🔴🔴 WU-025 — 호스트를 `.test` → `.com` 으로 바꿨다. **테스트 의도는 한 글자도
 *    바뀌지 않았다**(429 → node:https 폴백 행동을 고정한다).
 *
 * 왜 바꿨나: WU-025 의 outbound 경계가 **RFC 2606/6761 예약 TLD**(`.test`·`.invalid`·
 * `.local`·`.internal`)를 막는다. 그 TLD 는 공개 인터넷에서 해석되지 않고, 내부
 * resolver 가 사내 호스트로 매핑할 수 있는 자리다 — 즉 **막는 것이 맞다.**
 *
 * 🔴 **가드를 느슨하게 해서 이 테스트를 통과시키지 않는다.** 그것은 「벤치마크 통과용
 *    예외처리」와 같은 종류의 잘못이다. 고치는 쪽은 **fixture 호스트** 다.
 * 🟢 이 호스트는 `vi.stubGlobal("fetch")` 가 가로채므로 실제 요청은 나가지 않는다.
 */
const URL_429 = "https://example-shop-429.com/search/suggest.json?q=x";

function response(status: number, body = ""): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body) as unknown,
  } as unknown as Response;
}

/**
 * 🔴🔴 WU-026 — **fake timer 를 켜기 «전» 에 dispatcher 를 데운다.**
 *
 * dispatcher 의 첫 생성은 `await import("undici")` 라 **실제 비동기 로드** 다. fake
 * timer 아래에서 처음 로드하면 끝나지 않는다(실측: 15초 timeout). 🟢 운영에는 fake
 * timer 가 없고, 캐시되므로 요청당 비용도 아니다 — **하니스 전용 준비**다.
 */
beforeAll(async () => {
  await outboundDispatcher();
});

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

    const result = await runWithTimers(fetchWithDomainRateLimit("https://example-shop-ok.com/x.json"));

    expect(result.status).toBe(200);
    expect(fetchHtmlDirect).not.toHaveBeenCalled();
  });
});
