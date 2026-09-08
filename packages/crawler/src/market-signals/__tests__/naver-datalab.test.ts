import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNaverSearchTrendRatio } from "../naver-datalab";

/**
 * NAVER-API-HUB-RECOVERY-2(CPO 지시, 2026-09-08).
 *
 * 이 테스트가 고정하는 것은 "어디로, 어떤 헤더로 부르는가"다. 구 개발자센터
 * 엔드포인트로 되돌아가거나 헤더 이름이 바뀌면 Production에서 401이 나는데,
 * 그 실패는 로그인 세션이 있어야 재현되므로 로컬에서 잡히지 않는다.
 *
 * 실제 자격증명은 쓰지 않는다 — fetch를 가로채서 요청 모양만 검사한다.
 */
const FAKE = { clientId: "test-client-id", clientSecret: "test-client-secret" };

afterEach(() => {
  vi.restoreAllMocks();
});

/** fetch를 가로채 호출 인자를 돌려준다. */
function mockFetch(response: { status: number; body?: unknown }) {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: async () => response.body ?? {},
    text: async () => JSON.stringify(response.body ?? {}),
  } as unknown as Response);
  return spy;
}

const OK_BODY = {
  startDate: "2026-08-01",
  endDate: "2026-09-01",
  timeUnit: "month",
  results: [{ title: "brand", keywords: ["brand"], data: [{ period: "2026-09-01", ratio: 42.4 }] }],
};

describe("NAVER API HUB 전환 — 엔드포인트/헤더 규격", () => {
  it("구 개발자센터가 아니라 API HUB 검색어트렌드로 호출한다", async () => {
    const spy = mockFetch({ status: 200, body: OK_BODY });
    await fetchNaverSearchTrendRatio(FAKE, "테스트브랜드");

    const [url] = spy.mock.calls[0];
    expect(String(url)).toBe("https://naverapihub.apigw.ntruss.com/search-trend/v1/search");
    // 구 엔드포인트로 되돌아가면 Production에서 401이 난다.
    expect(String(url)).not.toContain("openapi.naver.com");
  });

  it("API HUB 인증 헤더를 쓴다 — 구 X-Naver-Client-* 를 쓰지 않는다", async () => {
    const spy = mockFetch({ status: 200, body: OK_BODY });
    await fetchNaverSearchTrendRatio(FAKE, "테스트브랜드");

    const init = spy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-NCP-APIGW-API-KEY-ID"]).toBe(FAKE.clientId);
    expect(headers["X-NCP-APIGW-API-KEY"]).toBe(FAKE.clientSecret);
    expect(headers["X-Naver-Client-Id"]).toBeUndefined();
    expect(headers["X-Naver-Client-Secret"]).toBeUndefined();
    expect(init.method).toBe("POST");
  });

  it("request body 스키마는 그대로 유지된다", async () => {
    const spy = mockFetch({ status: 200, body: OK_BODY });
    await fetchNaverSearchTrendRatio(FAKE, "테스트브랜드");

    const init = spy.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toHaveProperty("startDate");
    expect(body).toHaveProperty("endDate");
    expect(body).toHaveProperty("timeUnit");
    expect(Array.isArray(body.keywordGroups)).toBe(true);
    expect(body.keywordGroups[0]).toHaveProperty("groupName");
    expect(Array.isArray(body.keywordGroups[0].keywords)).toBe(true);
  });
});

describe("응답 처리 — 기존 계약 유지", () => {
  it("results[].data[].ratio를 그대로 파싱한다", async () => {
    mockFetch({ status: 200, body: OK_BODY });
    const out = await fetchNaverSearchTrendRatio(FAKE, "테스트브랜드");
    expect(out.status).toBe("OK");
    expect(out.ratio).toBe(42); // Math.round
    expect(out.httpStatus).toBe(200);
  });

  it("401은 AUTH_ERROR로 분류된다 — 재시도해도 소용없는 상태", async () => {
    mockFetch({ status: 401, body: { errorCode: "024" } });
    const out = await fetchNaverSearchTrendRatio(FAKE, "테스트브랜드");
    expect(out.status).toBe("AUTH_ERROR");
    expect(out.ratio).toBeNull();
  });

  it("429/5xx는 일시 오류로 분류된다", async () => {
    mockFetch({ status: 429 });
    expect((await fetchNaverSearchTrendRatio(FAKE, "브랜드")).status).toBe("TRANSIENT_ERROR");
  });

  it("자격증명이 없으면 호출하지 않고 NOT_CONFIGURED", async () => {
    const spy = mockFetch({ status: 200, body: OK_BODY });
    const out = await fetchNaverSearchTrendRatio({ clientId: "", clientSecret: "" }, "브랜드");
    expect(out.status).toBe("NOT_CONFIGURED");
    expect(spy).not.toHaveBeenCalled();
  });

  it("데이터가 비면 NO_DATA — ratio를 지어내지 않는다", async () => {
    mockFetch({ status: 200, body: { results: [] } });
    const out = await fetchNaverSearchTrendRatio(FAKE, "브랜드");
    expect(out.status).toBe("NO_DATA");
    expect(out.ratio).toBeNull();
  });
});
