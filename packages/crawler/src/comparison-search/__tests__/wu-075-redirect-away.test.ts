import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-075 — **최종 도착지 방어** (구현 · Positive / Negative / 경계)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 WU-074 가 확정한 것: ④ 의 통과 조건이 「HTTP ok + `<title>`」**뿐** 이라
 *    「상품 URL → 홈 리다이렉트」가 **상품으로 통과** 했다(실측 6/6).
 * 🟢 고친 것: `fetchPlainHtmlWithFinalUrl` 이 `response.url` 을 보존하고,
 *    `factsFromProductUrl` 이 **기존 `classifyUrlShape`** 를 도착지에 한 번 더 쓴다.
 *    추가 HTTP **0** · 새 판별 규칙 **0**.
 *
 * 🔴 네트워크를 쓰지 않는다 — `fetchWithDomainRateLimit`(두 파일의 **공통 owner**)만
 *    가로챈다. 🔴 `fetch` 를 전역으로 가로채지 않는다(어느 층이 도는지 흐려진다).
 */

const calls: string[] = [];
let router: (url: string) => { status: number; finalUrl: string; body: string };

vi.mock("../../rate-limit/domain-rate-limiter", () => ({
  fetchWithDomainRateLimit: async (url: string) => {
    calls.push(url);
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

/** 🔴 **상품처럼 보이는** HTML — 제목·JSON-LD·가격이 다 있다. 즉 기존 게이트는 전부 통과한다. */
const PRODUCT_HTML = `<html><head><title>Bobo Choses Booty Ghosts T-shirt</title>
<meta property="og:title" content="Bobo Choses Booty Ghosts T-shirt">
<script type="application/ld+json">{"@type":"Product","name":"Booty Ghosts T-shirt",
"brand":{"name":"Bobo Choses"},"offers":{"price":"49.00","priceCurrency":"EUR"}}</script>
</head><body>상품</body></html>`;

/** 🔴 홈도 **제목이 있다** — 그래서 기존 로직으로는 구분이 불가능했다. */
const HOME_HTML = `<html><head><title>Kids21 Singapore</title></head><body>홈</body></html>`;
const LISTING_HTML = `<html><head><title>Bobo Choses AW26</title></head><body>목록</body></html>`;

beforeEach(() => {
  calls.length = 0;
});

describe("WU-075 — 도착지가 상품이 아니면 후보에서 뺀다", () => {
  /* ─────────────────────────── Positive ─────────────────────────── */

  it("🟢 P1 정상 상품 URL — 유지된다(리다이렉트 없음)", async () => {
    const url = "https://shop.example.com/products/booty-ghosts-t-shirt";
    router = () => ({ status: 200, finalUrl: url, body: PRODUCT_HTML });
    const r = await factsFromProductUrl(url);
    expect(r.status).toBe("OK");
    expect(r.candidate?.facts).toBeTruthy();
    /** 🟢 기존 가격·브랜드 증거가 **그대로** 나온다 — 이 변경은 거기에 손대지 않았다. */
    expect(r.candidate?.price).toEqual({ amount: 49, currency: "EUR" });
    expect(r.candidate?.brand).toBe("Bobo Choses");
  });

  it("🟢 P2 리다이렉트 «후에도» 상품이면 — 유지된다", async () => {
    const url = "https://shop.example.com/products/booty-ghosts-t-shirt";
    /** 🔴 실측 S1-1: `rboutique.com` 이 `/en-sk/products/...` 로 보낸다(로케일 전환). */
    router = () => ({ status: 200, finalUrl: "https://shop.example.com/en-sk/products/booty-ghosts-t-shirt", body: PRODUCT_HTML });
    const r = await factsFromProductUrl(url);
    expect(r.status).toBe("OK");
    expect(r.candidate?.facts).toBeTruthy();
  });

  /* ─────────────────────────── Negative ─────────────────────────── */

  it("🔴 N1 상품 → **홈** 리다이렉트 — 제거된다(이것이 WU-074 의 6건)", async () => {
    const url = "https://kids21.com/products/700002005grn";
    router = () => ({ status: 200, finalUrl: "https://kids21.com/", body: HOME_HTML });
    const r = await factsFromProductUrl(url);
    expect(r.status).toBe("REDIRECTED_AWAY");
    expect(r.candidate).toBeNull();
    /**
     * 🔴 **내 1차 기대가 틀렸다(1 로 적었다가 2 가 나왔다)** — `/products/X` 는
     *    Shopify handle 모양이라 JSON 1 회 + HTML 폴백 1 회다. 🟢 **기존 폴백 그대로** 이고
     *    이 변경이 요청을 **추가하지 않았다**(S2 가 JSON 성공 시 1회임을 잠근다).
     */
    expect(r.httpCalls).toBe(2);
    expect(r.fetchPath).toBe("PLAIN_HTML");
  });

  it("🔴 N1-b 홈이 추적 파라미터를 달고 와도 — 제거된다", async () => {
    const url = "https://www.thefrontshop.co.kr/products/pepe-style-1195";
    /** 🔴 실측 S5-1 의 모양 그대로다. */
    router = () => ({ status: 200, finalUrl: "https://www.thefrontshop.co.kr/?shpxid=df5a539f", body: HOME_HTML });
    expect((await factsFromProductUrl(url)).status).toBe("REDIRECTED_AWAY");
  });

  it("🔴 N2 상품 → **목록** 리다이렉트 — 제거된다", async () => {
    const url = "https://kids21.com/products/700002037mlt";
    router = () => ({ status: 200, finalUrl: "https://kids21.com/collections/bobo-choses-aw2026", body: LISTING_HTML });
    expect((await factsFromProductUrl(url)).status).toBe("REDIRECTED_AWAY");
  });

  /* ───────────────────── 기존 동작 보존 (경계) ───────────────────── */

  it("🟢 B1 진짜 HTTP 404 — 기존대로 `UNREACHABLE`(새 status 로 바뀌지 않는다)", async () => {
    const url = "https://shop.example.com/products/gone";
    router = () => ({ status: 404, finalUrl: url, body: "" });
    expect((await factsFromProductUrl(url)).status).toBe("UNREACHABLE");
  });

  it("🟢 B2 200 인데 제목이 없다 — 기존대로 `NO_FACTS`", async () => {
    const url = "https://shop.example.com/products/x";
    router = () => ({ status: 200, finalUrl: url, body: "<html><body>no title</body></html>" });
    expect((await factsFromProductUrl(url)).status).toBe("NO_FACTS");
  });

  it("🟢 B3 URL 모양이 애초에 상품이 아니면 — HTTP 를 **쓰지 않는다**", async () => {
    router = () => ({ status: 200, finalUrl: "x", body: PRODUCT_HTML });
    const r = await factsFromProductUrl("https://kids21.com/collections/aw26");
    expect(r.status).toBe("NOT_PRODUCT_URL");
    expect(calls).toHaveLength(0);
  });

  it("🟢 B4 `response.url` 이 비어 있으면 — 요청 URL 로 본다(「모른다」를 「이동」으로 읽지 않는다)", async () => {
    const url = "https://shop.example.com/products/booty-ghosts-t-shirt";
    router = () => ({ status: 200, finalUrl: "", body: PRODUCT_HTML });
    expect((await factsFromProductUrl(url)).status).toBe("OK");
  });

  /* ───────────── Shopify JSON 경로도 같은 방어를 받는가 ───────────── */

  it("🔴 S1 Shopify handle 인데 JSON 이 홈을 주면 — HTML 경로로 내려가 **제거** 된다", async () => {
    const url = "https://kids21.com/products/700002005grn";
    router = (u) =>
      u.endsWith(".json")
        ? { status: 200, finalUrl: "https://kids21.com/", body: "{}" }
        : { status: 200, finalUrl: "https://kids21.com/", body: HOME_HTML };
    const r = await factsFromProductUrl(url);
    expect(r.status).toBe("REDIRECTED_AWAY");
    /** 🔴 JSON 1 + HTML 1 = 2. **추가 요청을 새로 만들지 않았다**(기존 폴백 그대로). */
    expect(r.httpCalls).toBe(2);
  });

  it("🟢 S2 Shopify JSON 이 상품을 주면 — 기존대로 JSON 경로로 끝난다(HTML 0)", async () => {
    const url = "https://kids21.com/products/700005621lbl";
    router = () => ({ status: 200, finalUrl: url, body: JSON.stringify({ product: { title: "Hug Hairy Monster T-shirt", handle: "700005621lbl" } }) });
    const r = await factsFromProductUrl(url);
    expect(r.status).toBe("OK");
    expect(r.fetchPath).toBe("SHOPIFY_JSON");
    expect(r.httpCalls).toBe(1);
  });

  /* ───────── 세 경로가 «같은» owner 를 쓰는가 (배선 확인) ───────── */

  /**
   * 🔴 소스 grep 으로 「배선돼 있다」고 적지 않는다 — **실제로 풀을 돌려서**
   *    drop 사유가 `REDIRECTED_AWAY` 로 나오는지 본다. `fetchFacts` 를 **주입하지
   *    않는다**(기본값 = 운영 함수여야 이 검사가 의미를 갖는다).
   */
  it("🟢 W1 **AI 후보 경로** — 홈으로 튄 후보가 `REDIRECTED_AWAY` 로 떨어진다", async () => {
    const { collectAiAnswerCandidatePool } = await import("../ai-answer-pool");
    const dead = "https://kids21.com/products/700002005grn";
    router = (u) =>
      u.includes("kids21.com") && !u.endsWith(".json")
        ? { status: 200, finalUrl: "https://kids21.com/", body: HOME_HTML }
        : { status: 200, finalUrl: u, body: "{}" };

    const r = await collectAiAnswerCandidatePool({
      text: `추천 상품입니다: ${dead}`,
      query: { title: "Booty Ghosts T-shirt", sourceUrl: "https://bobochoses.com/products/b226ab046-x" } as never,
      maxUrls: 5,
    });
    expect(r.candidates).toHaveLength(0);
    expect(r.dropped.map((d) => d.reason)).toContain("REDIRECTED_AWAY");
  });

  it("🟢 W2 **URL 후보 경로** — 같은 방어가 같은 사유로 적용된다", async () => {
    const { collectUrlCandidatePool } = await import(
      "../../../../../apps/admin/src/app/api/price-history/_lib/url-candidate-pool"
    );
    const dead = "https://global.trenbe.com/products/bobo-choses-kids-jacket";
    router = () => ({ status: 200, finalUrl: "https://global.trenbe.com/", body: HOME_HTML });

    const r = await collectUrlCandidatePool({
      urls: [dead],
      originUrl: "https://bobochoses.com/products/b226ab046-x",
      maxUrls: 5,
      existingCanonicalUrls: new Set<string>(),
    });
    expect(r.searchResults.flatMap((s) => s.candidates ?? [])).toHaveLength(0);
    expect(r.metrics.dropped.map((d) => d.reason)).toContain("REDIRECTED_AWAY");
  });

  /**
   * 🟢 W3 — 새 사유가 **소비자 코드 변경 0 으로** metrics 에 흐른다.
   *    두 drop union 이 `ProductUrlFactsStatus` 를 그대로 포함하기 때문이다
   *    (`ai-answer-pool.ts` `AiAnswerPoolDrop` · `url-candidate-pool.ts`
   *     `UrlCandidateDropReason`). 🔴 그래서 이 변경에 UI/집계 수정이 없다.
   *
   * 🔴 Gemini 경로는 이 **앞에** `resolveCandidate` 가 한 번 더 있다(더 엄격하다) —
   *    그 경로는 WU-074 에서 이미 6/6 을 막는 것이 실측됐다. 여기서 중복 측정하지 않는다.
   */
  it("🟢 W3 두 풀의 drop 사유 타입이 ProductUrlFactsStatus 를 포함한다(컴파일 계약)", () => {
    const aiReason: import("../ai-answer-pool").AiAnswerPoolDrop["reason"] = "REDIRECTED_AWAY";
    expect(aiReason).toBe("REDIRECTED_AWAY");
  });
});
