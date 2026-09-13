import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/**
 * MATCHING-2.0-INTEGRATION-3(CEO 지시, 2026-09-13) — "stripBrandPrefix는 되돌리지
 * 않는다. 다만 브랜드 포함/제거에 대한 회귀 케이스를 남긴다."
 *
 * ── 이 테스트가 고정하는 사실 ───────────────────────────────────────────────
 * 같은 상품을 찾는 같은 질의인데, 브랜드 단어를 떼면 **다른 상품이 1위가 된다**
 * (2026-09-13 실측):
 *
 *   브랜드 포함  "Bobo Choses zipped sweat organic cotton Heather grey"
 *       #1 b226ac114-…-bolder-half-zipped-sweatshirt   ← 정답
 *       #5 b226ac049-…-pixel-abduction-all-over-zipped-hoodie
 *
 *   브랜드 제거  "zipped sweat organic cotton heather grey"
 *       #1 b226ac049-…-pixel-abduction-all-over-zipped-hoodie   ← 다른 상품
 *       #2 b226ac114-…-bolder-half-zipped-sweatshirt
 *
 * bobochoses-kr.ts의 MAX_DETAIL_LOOKUPS가 상위 3건만 상세 조회하므로 순위는 곧
 * "이 후보가 파이프라인에 들어오는가"다. 브랜드를 붙이면 엉뚱한 후드집업이 5위로
 * 밀려 아예 들어오지 못하고, 떼면 그것이 1위로 들어온다.
 *
 * ── 라이브 네트워크를 쓰지 않는다 ───────────────────────────────────────────
 * 검색 순위는 스토어 사정으로 계속 움직인다. 매번 다시 찌르는 테스트는 오늘 옳은
 * 답을 내일 틀렸다고 말한다. 그래서 오늘 받은 **실제 응답**을 픽스처로 저장하고
 * (fixtures/bobochoses-suggest-*.json, 파일 안 _capture 칸에 언제·어디서·무엇으로
 * 받았는지 적어 두었다) 그 위에서 운영 코드의 동작만 검증한다. 가짜는 네트워크
 * 하나뿐이고, 파싱·순위·상세조회·상한은 전부 운영 코드가 그대로 돈다
 * (cross-seller-discovery.test.ts와 같은 방식).
 */
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const WITH_BRAND = "Bobo Choses zipped sweat organic cotton Heather grey";
const WITHOUT_BRAND = "zipped sweat organic cotton heather grey";

interface SuggestFixture {
  resources: { results: { products: { handle: string }[] } };
}

function suggestFixture(file: string): SuggestFixture {
  return JSON.parse(readFileSync(path.join(FIXTURES, file), "utf8")) as SuggestFixture;
}

const RESPONSE_BY_QUERY: Record<string, SuggestFixture> = {
  [WITH_BRAND]: suggestFixture("bobochoses-suggest-with-brand-prefix.json"),
  [WITHOUT_BRAND]: suggestFixture("bobochoses-suggest-no-brand-prefix.json"),
};

/** 상세 조회는 가격만 확정한다(bobochoses-kr.ts 주석) — 이 테스트가 보는 것은
 * 순위라서, 어떤 handle이든 같은 KRW 절대가를 돌려주면 충분하다. */
function detailResponse() {
  return {
    product: {
      title: "(상세 응답의 한글 제목 — 매칭에 쓰이지 않는다)",
      images: [],
      options: [{ name: "Clothing size", values: ["2-3Y"] }],
      variants: [{ id: 1, title: "2-3Y", price: "168000", price_currency: "KRW", available: true }],
    },
  };
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => body } as unknown as Response;
}

vi.mock("../rate-limit/domain-rate-limiter", () => ({
  acquireDomainSlot: async () => () => {},
  recordRateLimitResponse: () => {},
  fetchWithDomainRateLimit: async (url: string) => {
    const parsed = new URL(url);
    if (parsed.pathname === "/search/suggest.json") {
      const query = parsed.searchParams.get("q") ?? "";
      const fixture = RESPONSE_BY_QUERY[query];
      if (!fixture) throw new Error(`픽스처에 없는 질의다: ${query}`);
      return jsonResponse(fixture);
    }
    if (parsed.pathname === "/meta.json") return jsonResponse({ currency: "EUR", country: "ES" });
    if (/^\/ko-kr\/products\/[^.]+\.json$/.test(parsed.pathname)) return jsonResponse(detailResponse());
    return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response;
  },
}));

const { searchBoboChosesKorea } = await import("../comparison-search/bobochoses-kr");

const BOLDER = "b226ac114-bobo-choses-bolder-half-zipped-sweatshirt";
const HOODIE = "b226ac049-pixel-abduction-all-over-zipped-hoodie";

describe("bobochoses.com 검색어에서 브랜드 접두어를 떼면 안 된다", () => {
  it("브랜드를 붙이면 정답이 1위이고, 다른 상품은 상세조회 상한 밖으로 밀린다", async () => {
    const handles = (await searchBoboChosesKorea(WITH_BRAND)).map((c) => c.url);
    expect(handles[0]).toContain(BOLDER);
    // 상위 3건만 상세 조회하므로, 5위였던 후드집업은 파이프라인에 아예 들어오지 못한다.
    expect(handles.some((u) => u.includes(HOODIE))).toBe(false);
  });

  it("브랜드를 떼면 전혀 다른 상품(후드집업)이 1위로 들어온다 — 그래서 되돌리지 않는다", async () => {
    const handles = (await searchBoboChosesKorea(WITHOUT_BRAND)).map((c) => c.url);
    expect(handles[0]).toContain(HOODIE);
    expect(handles.some((u) => u.includes(BOLDER))).toBe(true);
  });

  it("두 질의의 차이는 브랜드 단어뿐이다 — 순위 차이가 다른 변수 때문이 아니라는 것", () => {
    expect(WITH_BRAND.toLowerCase()).toBe(`bobo choses ${WITHOUT_BRAND}`);
  });
});
