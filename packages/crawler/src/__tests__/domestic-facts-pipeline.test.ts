import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/**
 * MI-MATCHING-3.0 STEP 3(CEO 지시, 2026-09-14) — **국내 편집샵 후보가 판정대에
 * 올라오는지**를 운영 경로 그대로 고정한다.
 *
 * ── 무엇이 깨져 있었나(실측, 2026-09-14 재현) ──────────────────────────────
 * 국내 후보 전부가 `crossSellerVerdict = undefined`였다. match.ts의
 * `query.facts && c.facts` 관문이 언제나 거짓이었기 때문인데, 이유는 데이터가
 * 없어서가 아니었다 — 파서는 브랜드("BOBO CHOSES")·이미지·판매처 상품코드를
 * 이미 읽고 있었고, 그 값을 `ComparisonCandidate.brand/.imageUrl/.sku`에만
 * 담았다. 판정기는 그 세 칸을 보지 않는다.
 *
 * ── 픽스처는 손으로 쓰지 않았다 ────────────────────────────────────────────
 * looxloo.com 검색 HTML과 foretforet.com 검색 AJAX(JSON) 응답을 2026-09-14에
 * 실제로 받아 상품 목록 구간만 **바이트 그대로** 잘라 저장한 것이다. 테스트는
 * 운영 파서(searchLooxloo/searchForetforet)가 그 응답을 읽게 한다 — 가짜는
 * 네트워크 하나뿐이다(cross-seller-discovery.test.ts와 같은 원칙).
 */

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf8");
}

function textResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body) as unknown,
  } as unknown as Response;
}

vi.mock("../rate-limit/domain-rate-limiter", () => ({
  acquireDomainSlot: async () => () => {},
  recordRateLimitResponse: () => {},
  fetchWithDomainRateLimit: async (url: string) => {
    const host = new URL(url).hostname;
    if (host.endsWith("looxloo.com")) return textResponse(fixture("looxloo-search-bobo.html"));
    if (host.endsWith("foretforet.com")) return textResponse(fixture("foretforet-search-bobo.json"));
    return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response;
  },
}));

const { searchDomesticShops } = await import("../comparison-search/index");
const { productFactsFromSmallableHtml } = await import("../comparison-search/seller-facts");
const { searchLooxloo } = await import("../comparison-search/looxloo");
const { searchForetforet } = await import("../comparison-search/foretforet");

const SMALLABLE_430701 = () => {
  const facts = productFactsFromSmallableHtml(fixture("smallable-430701-product.html"), "430701");
  if (!facts) throw new Error("smallable 픽스처를 읽지 못했다");
  return facts;
};

const SOURCES = [
  {
    id: "looxloo",
    name: "LOOXLOO",
    domain: "looxloo.com",
    currency: "KRW",
    collectionStrategy: "AUTO_SCRAPE" as const,
  },
  {
    id: "foretforet",
    name: "포레포레",
    domain: "foretforet.com",
    currency: "KRW",
    collectionStrategy: "AUTO_SCRAPE" as const,
  },
];

async function runPipeline() {
  const facts = SMALLABLE_430701();
  const results = await searchDomesticShops(
    {
      title: facts.title,
      brand: facts.brand ?? undefined,
      sourceUrl: facts.sourceUrl,
      sku: facts.sellerSku ?? undefined,
      searchTerm: "Bobo Choses zipped sweat Heather grey",
      searchTerms: ["Bobo Choses zipped sweat Heather grey"],
      facts,
    },
    SOURCES,
  );
  return results;
}

describe("MI-MATCHING-3.0 — 국내 편집샵 후보가 Matching 2.0 판정대에 올라온다", () => {
  it("파서가 목록에서 읽은 사실을 facts 칸에 담는다(브랜드·제목·이미지·URL)", async () => {
    const looxloo = await searchLooxloo("Bobo Choses zipped sweat Heather grey");
    expect(looxloo.length).toBeGreaterThan(0);
    for (const candidate of looxloo) {
      expect(candidate.facts).toBeDefined();
      expect(candidate.facts!.title).toBe(candidate.title);
      expect(candidate.facts!.sourceUrl).toBe(candidate.url);
      expect(candidate.facts!.brand).toBe(candidate.brand ?? null);
      expect(candidate.facts!.imageUrls).toEqual(candidate.imageUrl ? [candidate.imageUrl] : []);
    }
    expect(looxloo.some((c) => c.facts!.brand === "BOBO CHOSES")).toBe(true);
  });

  it("판매처 상품코드는 brandModelCode가 아니라 sellerSku 칸에만 들어간다", async () => {
    // 포레포레 `BB26KSSOCI008BLU` · LOOXLOO `75A7D-415-16`은 국내 유통사/판매처
    // 번호이지 브랜드 품번이 아니다. brandModelCode에 넣으면 compareModelCode가
    // 없는 충돌을 지어내고, slugCarriesCode가 걸리면 근거 없는 SAME이 만들어진다.
    const all = [
      ...(await searchLooxloo("Bobo Choses")),
      ...(await searchForetforet("Bobo Choses Sweatshirts")),
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const candidate of all) {
      expect(candidate.facts!.brandModelCode).toBeNull();
      expect(candidate.facts!.sellerSku).toBe(candidate.sku ?? null);
    }
    expect(all.some((c) => c.facts!.sellerSku !== null)).toBe(true);
  });

  it("모든 국내 후보가 판정을 받는다 — crossSellerVerdict가 undefined인 후보가 없다", async () => {
    const results = await runPipeline();
    const candidates = results.flatMap((r) => r.candidates);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(candidate.crossSellerVerdict).toBeDefined();
    }
  });

  it("근거가 없는 국내 후보를 SAME으로 올리지 않는다", async () => {
    // 한국어 제목은 영문 원제목과 겹치는 말이 없어 NO_TITLE_OVERLAP 보류가 붙고,
    // brandModelCode가 없으니 식별자 확정 경로도 닫혀 있다 — 구조적으로 SAME에
    // 도달할 수 없다. 이 테스트가 깨진다면 facts 충전이 새 오탐을 만든 것이다.
    const results = await runPipeline();
    const candidates = results.flatMap((r) => r.candidates);
    expect(candidates.filter((c) => c.crossSellerVerdict === "SAME")).toHaveLength(0);
  });

  it("브랜드/상품군이 어긋나는 국내 후보는 CONFLICT로 걸러진다", async () => {
    const results = await runPipeline();
    const candidates = results.flatMap((r) => r.candidates);
    // 실측: LOOXLOO는 질의와 무관한 상품까지 돌려주므로(느슨한 검색), 트랙수트팬츠
    // 처럼 상품군이 다른 후보가 섞인다. 지금까지는 판정 자체가 실행되지 않아
    // 그 후보들이 아무 반증 없이 남아 있었다.
    expect(candidates.some((c) => c.crossSellerVerdict === "CONFLICT")).toBe(true);
  });
});
