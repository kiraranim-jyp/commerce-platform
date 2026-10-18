import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WU-076 생산자 계약 — **지금 운영이 이 모양을 «통과시킨다»** (네트워크 0)
 *
 * 🔴 측정 하니스(`apps/admin/.../wu-076-soft404.test.ts`)는 **캐시를 읽는다.**
 *    그래서 운영 코드를 바꿔도 깨지지 않는다(WU-064·WU-074 에서 당한 함정).
 *    🟢 여기서는 운영 owner `factsFromProductUrl` 을 **직접** 부른다.
 *
 * 🔴 실측 기반 — `www.littleluna.co.kr` 의 CONTROL(없는 상품번호) 응답 신호 그대로다:
 * ```
 * HTTP 200 · 리다이렉트 없음 · <title> = 사이트명 · og:type = website
 * canonical = https://littleluna.co.kr/  ← **루트**
 * JSON-LD Product 없음 · 본문에 금액 문자열은 있다
 * ```
 * 🔴 **고치지 않는다**(CPO: 조사 우선 · 구현 금지). 이 계약은 **구멍의 모양을 고정** 한다 —
 *    나중에 막으면 이 단언이 **FAIL 로 뒤집히고**, 그것이 수정이 들어간 증거다(쿠팡 고시 선례).
 */

let router: (url: string) => { status: number; finalUrl: string; body: string };

vi.mock("../../rate-limit/domain-rate-limiter", () => ({
  fetchWithDomainRateLimit: async (url: string) => {
    const r = router(url);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      url: r.finalUrl,
      text: async () => r.body,
      json: async () => JSON.parse(r.body),
    } as unknown as Response;
  },
}));

const { factsFromProductUrl } = await import("../product-url-facts");

/** 🔴 관측된 신호만 담았다 — 없는 신호를 지어내지 않았다. */
const SOFT404_200 = `<html><head>
<title>LITTLE LUNA ♥ 리틀루나 키즈편집샵</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="리틀루나(LITTLE LUNA)">
<link rel="canonical" href="https://littleluna.co.kr/">
</head><body><div>신상품 29,000원</div></body></html>`;

const URL_IN = "https://www.littleluna.co.kr/product/x/4119/category/1/display/3/";

beforeEach(() => {
  router = () => ({ status: 200, finalUrl: URL_IN, body: SOFT404_200 });
});

describe("WU-076 — 리다이렉트 없는 200 soft-404 의 «현재» 거동", () => {
  it("🔴 현재 운영은 이것을 **통과시킨다**(status OK) — 구멍이 실재한다", async () => {
    const r = await factsFromProductUrl(URL_IN);
    expect(r.status).toBe("OK");
    /** 🔴 그리고 **사이트명이 상품명으로** 들어간다. */
    expect(r.candidate?.title).toBe("LITTLE LUNA ♥ 리틀루나 키즈편집샵");
  });

  it("🔴 WU-075 의 축(최종 URL 모양)은 이것을 **못 잡는다** — 리다이렉트가 없다", async () => {
    const r = await factsFromProductUrl(URL_IN);
    expect(r.status).not.toBe("REDIRECTED_AWAY");
  });

  it("🟢 같은 페이지가 **리다이렉트까지** 하면 WU-075 가 잡는다(두 구멍이 다르다)", async () => {
    router = () => ({ status: 200, finalUrl: "https://littleluna.co.kr/", body: SOFT404_200 });
    expect((await factsFromProductUrl(URL_IN)).status).toBe("REDIRECTED_AWAY");
  });

  it("🟢 wconcept 모양(제목 없음)은 **기존 게이트가 이미 막는다** — 새 규칙이 필요 없다", async () => {
    router = () => ({ status: 200, finalUrl: "https://www.wconcept.co.kr/Product/999", body: "<html></html>" });
    expect((await factsFromProductUrl("https://www.wconcept.co.kr/Product/999")).status).toBe("NO_FACTS");
  });
});
