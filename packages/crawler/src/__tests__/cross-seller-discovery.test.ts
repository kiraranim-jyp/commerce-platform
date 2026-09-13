import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — **후보 발견 → 판정**을
 * 운영 경로 그대로 돌린다.
 *
 * ── 왜 CORE 테스트로는 부족했나 ──────────────────────────────────────────
 * MATCHING-2.0-CORE의 인수 테스트는 두 ProductFacts를 손에 쥐고 비교기에 직접
 * 넣는다. 그래서 "비교대에 올라오기만 하면 옳게 판정한다"는 사실만 고정한다.
 * 프로덕션에서 실제로 깨져 있던 것은 그 앞 단계였다 — 비교대에 아무것도 올라오지
 * 않았다. 검색어가 판매처 자신의 재고번호(AAA1804922) 하나였고, 그 번호로 Bobo
 * 공식몰을 찌르면 언제나 0건이다. 0건은 링크도 관측도 만들지 않으므로 MI에는
 * "국내에 없는 상품"으로 보인다.
 *
 * 그래서 이 테스트는 비교기를 직접 부르지 않는다. 등록상품(CanonicalProduct)에서
 * 시작해 buildProductIdentityDna → buildCrossSellerSearchQueries →
 * searchDomesticShops → searchBoboChosesKorea → searchShopifySuggest →
 * withConfidence → compareCrossSellerProducts까지 **운영 코드가 그대로** 돈다.
 *
 * ── 가짜는 네트워크 하나뿐이다 ───────────────────────────────────────────
 * fetchWithDomainRateLimit만 바꿔 끼운다(도메인 속도 제어까지 그 함수 안에 있어,
 * 여기를 막으면 테스트가 실제 요청도 보내지 않고 대기도 하지 않는다). 응답
 * 본문은 2026-09-13에 두 사이트가 실제로 내려준 것을 저장한 픽스처 그대로이고,
 * 검색 결과를 고르는 방식도 실측된 동작을 따른다: Shopify suggest는 질의 토큰이
 * **전부** 들어 있는 상품만 돌려준다(그래서 "Bobo Choses stamp bloom"이 0건이고
 * "stamp bloom denim pants"는 맞는다 — bobochoses-kr.ts 주석의 실측 그대로).
 */

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const DOMAIN = "bobochoses.com";

interface BoboFixture {
  title: string;
  handle: string;
  url: string;
  description: string;
  vendor: string;
  type: string;
  tags: string[];
  options: { name?: string; values?: string[] }[];
  images: string[];
}

function boboFixture(code: string): BoboFixture {
  return JSON.parse(readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8")) as BoboFixture;
}

/** 공식몰 카탈로그. 검색이 이 목록에서만 고른다 — 실제 스토어의 부분집합이고,
 * 그 부분집합이 곧 "같은 유형 상품이 여럿 있다"는 실제 조건을 만든다. */
const CATALOG = ["B226AC018", "B226AC042", "B226AC043", "B226AC112", "B226AC114", "B226AD013"].map(boboFixture);

/** 관측된 한국 표시가(원). 실측 형태 그대로 — /ko-kr/products/{handle}.json은
 * KRW 절대가를 돌려준다(bobochoses-kr.ts 주석). */
const KRW_PRICE_BY_HANDLE: Record<string, number> = Object.fromEntries(
  CATALOG.map((p) => [p.handle, 168000]),
);

/**
 * Shopify `/search/suggest.json`의 실측 동작 — 질의 토큰이 전부 들어 있는 상품만
 * 돌려주고, 상위 5건까지다. 이 모양이 중요한 이유는 하나다: **없는 말로 찌르면
 * 0건**이라는 사실이 이번 사고의 원인이고, 그 사실이 테스트 안에 재현돼 있어야
 * "검색어를 넓혔다"는 수정이 실제로 무엇을 고쳤는지 증명된다.
 */
function suggestResponse(query: string) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const products = CATALOG.filter((p) => {
    const haystack = `${p.title} ${p.description} ${p.type} ${p.tags.join(" ")}`.toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  })
    .slice(0, 5)
    .map((p) => ({
      title: p.title,
      handle: p.handle,
      url: p.url,
      body: p.description,
      vendor: p.vendor,
      type: p.type,
      tags: p.tags,
      image: p.images[0],
      options: p.options,
    }));
  return { resources: { results: { products } } };
}

const requestedUrls: string[] = [];

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

vi.mock("../rate-limit/domain-rate-limiter", () => ({
  acquireDomainSlot: async () => () => {},
  recordRateLimitResponse: () => {},
  fetchWithDomainRateLimit: async (url: string) => {
    requestedUrls.push(url);
    const parsed = new URL(url);
    if (parsed.pathname === "/search/suggest.json") {
      return jsonResponse(suggestResponse(parsed.searchParams.get("q") ?? ""));
    }
    if (parsed.pathname === "/meta.json") {
      return jsonResponse({ currency: "EUR", country: "ES", name: "Bobo Choses" });
    }
    const detail = /^\/ko-kr\/products\/([^.]+)\.json$/.exec(parsed.pathname);
    if (detail) {
      const handle = detail[1];
      const fixture = CATALOG.find((p) => p.handle === handle);
      if (!fixture) return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response;
      return jsonResponse({
        product: {
          title: fixture.title,
          images: [],
          options: fixture.options,
          variants: [
            {
              id: 1,
              title: fixture.options[0]?.values?.[0] ?? "Default",
              price: String(KRW_PRICE_BY_HANDLE[handle]),
              price_currency: "KRW",
              available: true,
            },
          ],
        },
      });
    }
    return { ok: false, status: 404, headers: { get: () => null } } as unknown as Response;
  },
}));

const { searchDomesticShops } = await import("../comparison-search/index");
const { compareCrossSellerProducts } = await import("../comparison-search/cross-seller");
const { productFactsFromShopifyProduct, productFactsFromSmallableHtml, extractSmallableBreadcrumb, extractSmallableSizeLabels } =
  await import("../comparison-search/seller-facts");
const { buildCrossSellerSearchQueries, buildDomesticShopQuery, buildProductIdentityDna, productFactsFromIdentityDna } =
  await import("@commerce/shared");

/**
 * 등록상품을 실제 응답에서 만든다. 손으로 쓴 CanonicalProduct를 넣으면 이 테스트가
 * 확인하려는 것(실제 페이지의 값이 DNA를 거쳐 판정까지 도달하는가)을 통째로
 * 건너뛴다 — 그래서 값은 전부 운영 파서(productFactsFromSmallableHtml /
 * extractSmallableBreadcrumb / extractSmallableSizeLabels)가 그 HTML에서 읽어낸
 * 것이고, 이 함수는 칸만 옮긴다.
 */
function smallableProduct(file: string, productId: string): CanonicalProduct {
  const html = readFileSync(path.join(FIXTURES, file), "utf8");
  const facts = productFactsFromSmallableHtml(html, productId);
  if (!facts) throw new Error(`smallable 픽스처를 읽지 못했다: ${file}`);
  const field = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });
  return {
    sourceUrl: facts.sourceUrl,
    title: field(facts.title),
    brand: field(facts.brand ?? ""),
    sku: field(facts.sellerSku ?? ""),
    modelName: field(""),
    color: field(facts.colorText ?? ""),
    material: field(""),
    description: field(facts.materialText ?? ""),
    recommendedAge: field(""),
    images: [],
    optionGroups: [{ name: "Size", values: extractSmallableSizeLabels(html) }],
    breadcrumbPath: extractSmallableBreadcrumb(html),
  } as unknown as CanonicalProduct;
}

const BOBO_SOURCE = [
  {
    id: "bobo-kr",
    name: "Bobo Choses 공식몰",
    domain: DOMAIN,
    currency: "KRW",
    collectionStrategy: "AUTO_API" as const,
  },
];

/** 운영 라우트가 만드는 질의 그대로. 이 함수가 곧 이번 수정의 본체다 —
 * run-domestic-price-check가 지금까지 searchTerm 하나만 채우고 나머지 둘을
 * 비워 두고 있었다. */
function productionQuery(product: CanonicalProduct) {
  const dna = buildProductIdentityDna(product);
  return {
    title: product.title.value,
    brand: dna.brand.value || undefined,
    sourceUrl: dna.sourceUrl,
    sku: dna.identifier?.tier === "SKU" ? dna.identifier.value : undefined,
    searchTerm: buildDomesticShopQuery(dna),
    searchTerms: buildCrossSellerSearchQueries(dna),
    facts: productFactsFromIdentityDna(dna),
  };
}

beforeEach(() => {
  requestedUrls.length = 0;
});

describe("① 원본 → ② 후보 생성 → ③ 검색 → ④ URL 발견", () => {
  it("판매처 자신의 재고번호 하나로는 Bobo 공식몰에서 아무것도 찾지 못한다(수정 전 경로)", async () => {
    const product = smallableProduct("smallable-430701-product.html", "430701");
    const dna = buildProductIdentityDna(product);
    // 이 값이 예전 저장 경로의 유일한 검색어였다.
    expect(buildDomesticShopQuery(dna)).toBe("AAA1804922");

    const [result] = await searchDomesticShops(
      { title: product.title.value, brand: dna.brand.value, searchTerm: buildDomesticShopQuery(dna) },
      BOBO_SOURCE,
    );
    expect(result.status).toBe("ok");
    // 0건이다. 그리고 이 0건이 화면에서 "국내에 이 상품이 없다"로 읽혀 왔다.
    expect(result.candidates).toHaveLength(0);
  });

  it("좁은 말부터 차례로 찌르면 Bobo B226AC114의 상품 URL이 실제로 발견된다", async () => {
    const product = smallableProduct("smallable-430701-product.html", "430701");
    const query = productionQuery(product);
    // 판매처 재고번호는 목록의 어디에도 없다 — 0건을 부르는 말을 섞지 않는다.
    expect(query.searchTerms.some((term) => term.includes("AAA1804922"))).toBe(false);

    const [result] = await searchDomesticShops(query, BOBO_SOURCE);
    expect(result.status).toBe("ok");
    const bolder = result.candidates.find((c) => c.url.includes("b226ac114"));
    expect(bolder).toBeDefined();
    expect(bolder!.url).toBe("https://bobochoses.com/products/b226ac114-bobo-choses-bolder-half-zipped-sweatshirt");
    // 검색이 실제로 그 도메인을 찔렀다는 사실까지 남긴다(경로가 아니라 요청이다).
    expect(requestedUrls.some((u) => u.startsWith("https://bobochoses.com/search/suggest.json"))).toBe(true);
  });
});

describe("⑤ Bobo DNA 생성 → ⑥ 비교 → ⑦ 판정", () => {
  it("검색으로 만들어진 후보가 facts를 들고 오고, 그 자리에서 🟢 동일상품 판정이 붙는다", async () => {
    const product = smallableProduct("smallable-430701-product.html", "430701");
    const [result] = await searchDomesticShops(productionQuery(product), BOBO_SOURCE);
    const bolder = result.candidates.find((c) => c.url.includes("b226ac114"))!;

    // suggest 응답의 type/tags/body가 버려지지 않고 후보까지 실려 왔다.
    expect(bolder.facts).toBeDefined();
    expect(bolder.facts!.categoryText).toBe("Sweatshirts");
    expect(bolder.facts!.audienceSignals).toEqual(expect.arrayContaining(["Kid"]));
    // 그리고 판정이 검색 결과 위에 붙어 있다 — 화면이 따로 계산하지 않는다.
    expect(bolder.crossSellerVerdict).toBe("SAME");
    expect(bolder.crossSellerReasons?.length ?? 0).toBeGreaterThan(0);
    // 가격은 /ko-kr 상세에서 확정된 원화다(검색 목록 값이 아니다).
    expect(bolder.price).toEqual({ amount: 168000, currency: "KRW" });
  });

  it("같은 검색에서 나온 다른 후보가 있어도 반증된 것은 🟢이 되지 않는다", async () => {
    const product = smallableProduct("smallable-430701-product.html", "430701");
    const [result] = await searchDomesticShops(productionQuery(product), BOBO_SOURCE);
    for (const candidate of result.candidates) {
      if (candidate.url.includes("b226ac114")) continue;
      expect(candidate.crossSellerVerdict).not.toBe("SAME");
    }
  });
});

/**
 * 인수 기준 다섯 쌍 + P-10-F 회귀. **통합 경로의 facts로** 확인한다 — 등록상품
 * 쪽은 CanonicalProduct → DNA → ProductFacts를 거친 값이고, 후보 쪽은 suggest
 * 응답 → ProductFacts를 거친 값이다. CORE 테스트가 쓰는 값(HTML 파서 직접)과
 * 다른 경로라, 두 테스트가 함께 있어야 "판정은 맞는데 배선이 틀렸다"가 드러난다.
 */
describe("인수 기준 — 통합 경로의 facts로, 양방향으로", () => {
  function registered(file: string, productId: string) {
    return productFactsFromIdentityDna(buildProductIdentityDna(smallableProduct(file, productId)));
  }
  function candidateFacts(code: string) {
    const p = boboFixture(code);
    return productFactsFromShopifyProduct(
      { title: p.title, handle: p.handle, url: p.url, body: p.description, vendor: p.vendor, type: p.type, tags: p.tags, options: p.options },
      DOMAIN,
    );
  }
  /** 방향을 바꿔 두 번 돌리고, 두 답이 완전히 같을 때만 그 답을 인정한다. */
  function bothWays(a: ReturnType<typeof candidateFacts>, b: ReturnType<typeof candidateFacts>) {
    const forward = compareCrossSellerProducts(a, b);
    const backward = compareCrossSellerProducts(b, a);
    expect(backward).toEqual(forward);
    return forward.verdict;
  }

  it("Smallable 430701 ↔ Bobo B226AC114 = 🟢 동일상품 (방향 대칭)", () => {
    expect(bothWays(registered("smallable-430701-product.html", "430701"), candidateFacts("B226AC114"))).toBe("SAME");
    expect(bothWays(candidateFacts("B226AC114"), registered("smallable-430701-product.html", "430701"))).toBe("SAME");
  });

  it("Smallable 430632 ↔ Bobo B226AC018 = 🟢 동일상품", () => {
    expect(bothWays(registered("smallable-430632-product.html", "430632"), candidateFacts("B226AC018"))).toBe("SAME");
  });

  it("Smallable 430632 ↔ Bobo B226AD013 = 🔴 다른 상품", () => {
    expect(bothWays(registered("smallable-430632-product.html", "430632"), candidateFacts("B226AD013"))).toBe("CONFLICT");
  });

  it("Bobo B226AC114 ↔ Bobo B226AD013 = 🔴 다른 상품", () => {
    expect(bothWays(candidateFacts("B226AC114"), candidateFacts("B226AD013"))).toBe("CONFLICT");
  });

  it("P-10-F 회귀 — B226AC042 ↔ B226AC043은 제목이 같아도 갈린다", () => {
    expect(bothWays(candidateFacts("B226AC042"), candidateFacts("B226AC043"))).toBe("CONFLICT");
  });
});
