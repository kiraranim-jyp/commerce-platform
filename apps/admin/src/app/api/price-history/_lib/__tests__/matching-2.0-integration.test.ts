import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import type { ComparisonCandidate, ComparisonQuery, MatchTruth } from "@commerce/crawler";
import type { PriceObservationRecord } from "@commerce/pricing";

/**
 * MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — **판정 → 저장 → 집계 → 화면.**
 *
 * ── 이 테스트가 지키는 사실 ──────────────────────────────────────────────
 * MATCHING-2.0-CORE 이후에도 프로덕션 MI에서 Bobo는 보이지 않았다. 판정기는
 * 옳았고, 그 판정이 **저장 경로에 실리지 않았다**:
 *
 *   라이브 검색 라우트   deriveMatchTruth(level, modelCode, crossSellerVerdict)  🟢
 *   저장 파이프라인      deriveMatchTruth(level, modelCode)                      ⚪
 *
 * 같은 상품에 대해 화면과 DB가 다른 등급을 갖고 있었고, MI 집계가 읽는 것은
 * DB 쪽이다. 그래서 🟢이 동일상품 가격 버킷에 들어간 적이 없다.
 *
 * ── 무엇을 진짜로 돌리는가 ───────────────────────────────────────────────
 * runDomesticPriceCheck(저장 경로)를 실제로 돌린다. 매칭 점수(withConfidence),
 * 교차판매처 판정(compareCrossSellerProducts), 등급 산출(deriveMatchTruth),
 * 티어 분류(priceTierFromLink), 시장 집계(summarizeDomesticMarketSplit), 화면
 * 요약(buildMarketContext / buildDomesticMarketEvidence)까지 전부 운영 코드다.
 * 바꿔 끼운 것은 바깥 경계 셋뿐이다 — 편집샵 검색 응답, 가격 재조회, 저장소.
 *
 * 후보와 등록상품의 사실은 손으로 쓰지 않았다. 2026-09-13에 두 사이트가 실제로
 * 내려준 응답을 저장한 픽스처를 운영 파서로 읽는다(MATCHING-2.0-CORE와 같은 파일).
 */

const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const SNAPSHOT_ID = "0767b19b-0000-0000-0000-0000000000aa";
const BOBO_DOMAIN = "bobochoses.com";
const BOBO_KRW = 168000;

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../../../packages/crawler/src/__tests__/fixtures",
);

interface StoredLink {
  id: string;
  snapshotId: string;
  sourceId: string;
  externalUrl: string;
  matchType: string;
  matchTruth: MatchTruth | null;
  matchReasons: string[];
  verified: boolean;
  status: "ACTIVE" | "PAUSED" | "BROKEN_LINK";
}

const hoisted = vi.hoisted(() => ({
  /** runDomesticPriceCheck가 실제로 만들어 넘긴 질의. 검색어와 facts가 실려
   * 있는지를 여기서 그대로 확인한다(배선 자체가 검증 대상이다). */
  queries: [] as ComparisonQuery[],
  candidatesForSearch: [] as ComparisonCandidate[],
  storedLinks: [] as StoredLink[],
  observationBatches: [] as Array<Array<Record<string, unknown>>>,
  listDomesticPriceSources: vi.fn(),
  recordDomesticSourceCheckAttempt: vi.fn(),
}));

vi.mock("@commerce/crawler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@commerce/crawler")>();
  return {
    ...actual,
    // 검색 응답만 가짜다. 점수와 판정은 운영 함수(withConfidence)가 질의를 받아
    // 그 자리에서 계산한다 — 판정을 스텁으로 주면 이 테스트가 확인하려는 것
    // (질의에 facts가 실려서 판정이 실제로 돌았는가)이 통째로 사라진다.
    searchDomesticShops: vi.fn(async (query: ComparisonQuery) => {
      hoisted.queries.push(query);
      return [
        {
          shopId: "bobo-kr",
          shopName: "Bobo Choses 공식몰",
          domain: BOBO_DOMAIN,
          status: "ok" as const,
          candidates: actual.withConfidence(query, hoisted.candidatesForSearch),
        },
      ];
    }),
    refreshDomesticProductPrice: vi.fn(async () => ({
      status: "OK" as const,
      price: { amount: BOBO_KRW, currency: "KRW" },
      salePriceKrw: null,
      originalPriceKrw: null,
      soldOut: false,
    })),
  };
});

vi.mock("../../../domestic-price-sources/_lib/domestic-price-source", () => ({
  listDomesticPriceSources: hoisted.listDomesticPriceSources,
  recordDomesticSourceCheckAttempt: hoisted.recordDomesticSourceCheckAttempt,
}));

vi.mock("../../../domestic-price-sources/_lib/domestic-product-link", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../domestic-price-sources/_lib/domestic-product-link")>();
  return {
    ...actual,
    upsertDomesticProductLink: vi.fn(async (input: Record<string, unknown>) => {
      const link: StoredLink = {
        id: `${input.snapshotId}:${input.sourceId}`,
        snapshotId: input.snapshotId as string,
        sourceId: input.sourceId as string,
        externalUrl: input.externalUrl as string,
        matchType: input.matchType as string,
        matchTruth: (input.matchTruth as MatchTruth) ?? null,
        matchReasons: (input.matchReasons as string[]) ?? [],
        verified: input.verified as boolean,
        status: "ACTIVE",
      };
      const existing = hoisted.storedLinks.findIndex((l) => l.id === link.id);
      if (existing >= 0) hoisted.storedLinks[existing] = link;
      else hoisted.storedLinks.push(link);
      return { ok: true as const, link: link as never };
    }),
    listDomesticProductLinks: vi.fn(async (snapshotId: string) =>
      hoisted.storedLinks.filter((l) => l.snapshotId === snapshotId),
    ),
  };
});

vi.mock("../price-observations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../price-observations")>();
  return {
    ...actual,
    hasObservationToday: vi.fn(async () => false),
    recordPriceObservations: vi.fn(async (observations: Array<Record<string, unknown>>) => {
      if (observations.length > 0) hoisted.observationBatches.push(observations);
      return { ok: true as const, count: observations.length };
    }),
  };
});

const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
const { priceTierFromLink } = await import("../../../domestic-price-sources/_lib/domestic-product-link");
const { summarizeDomesticMarketSplit, DOMESTIC_ANALYSIS_MARKET_COUNTRY } = await import("@commerce/pricing");
const { buildMarketContext } = await import("@/app/pipeline/commerce/price-hierarchy");
const { buildDomesticMarketEvidence } = await import("@/app/pipeline/commerce/market-evidence");
const { tierCountsText } = await import("@/app/pipeline/commerce/market-evidence");
const {
  productFactsFromShopifyProduct,
  productFactsFromSmallableHtml,
  extractSmallableBreadcrumb,
  extractSmallableSizeLabels,
} = await import("@commerce/crawler/src/comparison-search/seller-facts");
const { buildProductIdentityDna } = await import("@commerce/shared");

/* ─────────────────────────── 실측 픽스처 → 입력 ─────────────────────────── */

interface BoboFixture {
  title: string;
  handle: string;
  url: string;
  description: string;
  vendor: string;
  type: string;
  tags: string[];
  options: { name?: string; values?: string[] }[];
}

function boboFixture(code: string): BoboFixture {
  return JSON.parse(readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8")) as BoboFixture;
}

const field = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });

/** 등록상품(Smallable). 값은 전부 운영 파서가 실제 HTML에서 읽어낸 것이다. */
function smallableProduct(file: string, productId: string): CanonicalProduct {
  const html = readFileSync(path.join(FIXTURES, file), "utf8");
  const facts = productFactsFromSmallableHtml(html, productId);
  if (!facts) throw new Error(`smallable 픽스처를 읽지 못했다: ${file}`);
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

/** 등록상품(Bobo 공식몰) — 방향을 바꾼 쪽. 같은 응답, 같은 파서. */
function boboProduct(code: string): CanonicalProduct {
  const p = boboFixture(code);
  return {
    sourceUrl: `https://${BOBO_DOMAIN}${p.url}`,
    title: field(p.title),
    brand: field("Bobo Choses"),
    sku: field(""),
    modelName: field(""),
    color: field(""),
    material: field(""),
    description: field(p.description.replace(/<[^>]+>/g, " ")),
    recommendedAge: field(""),
    images: [],
    optionGroups: p.options.map((o) => ({ name: o.name ?? "Size", values: o.values ?? [] })),
    breadcrumbPath: [p.type, ...p.tags],
  } as unknown as CanonicalProduct;
}

function boboCandidate(code: string): ComparisonCandidate {
  const p = boboFixture(code);
  return {
    title: p.title,
    url: `https://${BOBO_DOMAIN}${p.url}`,
    price: { amount: BOBO_KRW, currency: "KRW" },
    imageUrl: null,
    confidence: 0,
    priceSource: "detail",
    facts: productFactsFromShopifyProduct(
      { title: p.title, handle: p.handle, url: p.url, body: p.description, vendor: p.vendor, type: p.type, tags: p.tags, options: p.options },
      BOBO_DOMAIN,
    ),
  };
}

/** 방향을 바꾼 쪽의 후보 — Smallable 상품이 후보로 들어온다. */
function smallableCandidate(file: string, productId: string): ComparisonCandidate {
  const html = readFileSync(path.join(FIXTURES, file), "utf8");
  const facts = productFactsFromSmallableHtml(html, productId)!;
  return {
    title: facts.title,
    url: facts.sourceUrl,
    price: { amount: BOBO_KRW, currency: "KRW" },
    imageUrl: null,
    confidence: 0,
    priceSource: "detail",
    facts,
  };
}

function boboSource() {
  return {
    id: "bobo-kr",
    name: "Bobo Choses 공식몰",
    domain: BOBO_DOMAIN,
    url: `https://${BOBO_DOMAIN}`,
    currency: "KRW",
    categoryScope: [] as string[],
    priority: "P0" as const,
    collectionStrategy: "AUTO_API" as const,
    status: "ACTIVE" as const,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastCheckedAt: null,
    lastSuccessAt: null,
    source: "SYSTEM" as const,
    sourceType: "VERTICAL" as const,
    enabled: true,
    catalogEnabled: true,
    workspaceEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

async function runCheck(product: CanonicalProduct) {
  return runDomesticPriceCheck({
    snapshotId: SNAPSHOT_ID,
    workspaceId: WORKSPACE_ID,
    dna: buildProductIdentityDna(product),
    description: product.description?.value || undefined,
  });
}

/** market-intelligence.ts가 하는 그대로 — 링크의 티어로 관측을 두 버킷으로
 * 나누고 같은 분석 시장(한국)으로 집계한다. 새 계산을 만들지 않는다. */
function aggregateLikeMi() {
  const tierBySourceId = new Map(hoisted.storedLinks.map((l) => [l.sourceId, priceTierFromLink(l)]));
  const records: PriceObservationRecord[] = hoisted.observationBatches.flat().map((o, i) => ({
    id: `obs-${i}`,
    snapshotId: o.snapshotId as string,
    source: "DOMESTIC_SHOP",
    sourceLabel: (o.sourceLabel as string) ?? null,
    sourceProductUrl: (o.sourceProductUrl as string) ?? null,
    sourceRefId: (o.sourceRefId as string) ?? null,
    currency: o.currency as string,
    priceAmount: (o.priceAmount as number) ?? null,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: null,
    priceKrw: (o.priceKrw as number) ?? null,
    salePriceKrw: (o.salePriceKrw as number) ?? null,
    originalPriceKrw: (o.originalPriceKrw as number) ?? null,
    soldOut: (o.soldOut as boolean) ?? null,
    marketCode: null,
    marketCountry: null,
    checkedAt: "2026-09-13T00:00:00.000Z",
  }));
  const exact: PriceObservationRecord[] = [];
  const comparison: PriceObservationRecord[] = [];
  for (const record of records) {
    const tier = record.sourceRefId ? tierBySourceId.get(record.sourceRefId) : undefined;
    if (tier === "EXACT") exact.push(record);
    else if (tier === "COMPARISON") comparison.push(record);
  }
  return summarizeDomesticMarketSplit(exact, comparison, {
    analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY,
  });
}

beforeEach(() => {
  hoisted.queries.length = 0;
  hoisted.storedLinks.length = 0;
  hoisted.observationBatches.length = 0;
  hoisted.candidatesForSearch = [];
  hoisted.listDomesticPriceSources.mockReset();
  hoisted.recordDomesticSourceCheckAttempt.mockReset();
  hoisted.listDomesticPriceSources.mockResolvedValue([boboSource()]);
  hoisted.recordDomesticSourceCheckAttempt.mockResolvedValue(undefined);
});

/* ─────────────────────────── ② 후보 생성 배선 ─────────────────────────── */

describe("저장 경로가 라이브 검색과 같은 질의를 만든다", () => {
  it("검색어가 여럿이고, 판매처 재고번호는 그 목록에 없다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    const query = hoisted.queries[0]!;
    expect(query.searchTerms?.length ?? 0).toBeGreaterThan(1);
    // 이 번호 하나가 예전 저장 경로의 유일한 검색어였고, 그 값으로는 언제나 0건이다.
    expect(query.searchTerm).toBe("AAA1804922");
    expect(query.searchTerms!.some((t) => t.includes("AAA1804922"))).toBe(false);
  });

  it("등록상품의 사실 묶음이 질의에 실린다 — 이게 없으면 판정 자체가 돌지 않는다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    const facts = hoisted.queries[0]!.facts;
    expect(facts).toBeDefined();
    expect(facts!.brand).toBe("Bobo Choses");
    expect(facts!.colorText).toBe("Heather grey");
    // 판매처 재고번호는 브랜드 품번 칸에 절대 들어가지 않는다.
    expect(facts!.brandModelCode).toBeNull();
    expect(facts!.sellerSku).toBe("AAA1804922");
  });
});

/* ─────────────────── ⑦ 판정 → ⑧ 관측 연결 → ⑨ MI 표시 ─────────────────── */

describe("🟢 판정이 저장되고, 그 가격이 동일상품 집계에 들어간다", () => {
  it("Smallable 430701 → Bobo B226AC114: 링크가 동일상품 등급으로 저장된다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    const result = await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    expect(result.linksCreatedOrUpdated).toBe(1);
    const link = hoisted.storedLinks[0]!;
    expect(link.externalUrl).toContain("b226ac114");
    // 품번을 맞춰볼 수 없는 쌍이라 식별자 경로로는 절대 여기 올 수 없다 —
    // 교차판매처 판정이 실려 왔다는 사실 자체가 이 값이다.
    expect(link.matchTruth).toBe("STRONG_IDENTIFIER");
    expect(link.verified).toBe(true);
    // 근거가 남는다. "modelCode 일치"라고 적지 않는다(그건 없는 사실이다).
    expect(link.matchReasons.some((r) => r.includes("교차판매처 판정 동일상품"))).toBe(true);
    expect(link.matchReasons.every((r) => !r.includes("modelCode 완전 일치"))).toBe(true);
  });

  it("그 링크가 🟢 버킷으로 분류되고, 관측이 sourceRefId로 그 링크에 묶인다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    const result = await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    expect(priceTierFromLink(hoisted.storedLinks[0]!)).toBe("EXACT");
    expect(result.pricesRecorded).toBe(1);
    const [observation] = hoisted.observationBatches[0]!;
    // 관측과 매칭 상품의 연결 관계가 이 두 값이다 — 어느 판매처(sourceRefId)의
    // 어느 상품(sourceProductUrl)인지가 관측 자체에 적혀 있다.
    expect(observation.sourceRefId).toBe("bobo-kr");
    expect(observation.sourceProductUrl).toBe(hoisted.storedLinks[0]!.externalUrl);
    expect(observation.priceKrw).toBe(BOBO_KRW);
  });

  it("MI 집계가 그 가격을 동일상품 가격으로 읽고, 화면 요약이 🟢 기준이라고 말한다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    const split = aggregateLikeMi();
    expect(split.basis).toBe("EXACT");
    expect(split.resolved.lowestPriceKrw).toBe(BOBO_KRW);
    expect(split.exact.sellerCount).toBe(1);
    expect(split.comparison.sellerCount).toBe(0);

    const context = buildMarketContext({
      domesticBasis: split.basis,
      domesticAveragePriceKrw: split.resolved.averagePriceKrw,
      domesticLowestPriceKrw: split.resolved.lowestPriceKrw,
      domesticSellerCount: split.resolved.sellerCount,
      domesticUnresolved: split.resolved.priceMarketBasis === "UNRESOLVED",
    });
    const evidence = buildDomesticMarketEvidence({
      context,
      basis: split.basis,
      exactSellerCount: split.exact.sellerCount,
      comparisonSellerCount: split.comparison.sellerCount,
    });
    expect(evidence.figure).toBe("₩168,000");
    expect(tierCountsText(evidence.tiers)).toBe("🟢 동일상품 기준");
    expect(evidence.figureBasis).toContain("동일상품 기준");
  });
});

/* ────────────────────────── 방향 대칭(통합 경로) ────────────────────────── */

describe("방향이 바뀌어도 같은 관계가 저장된다", () => {
  it("Bobo B226AC114에서 출발해 Smallable 430701을 찾아도 같은 등급·같은 티어다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AC114")];
    await runCheck(smallableProduct("smallable-430701-product.html", "430701"));
    const forward = { truth: hoisted.storedLinks[0]!.matchTruth, tier: priceTierFromLink(hoisted.storedLinks[0]!) };

    hoisted.storedLinks.length = 0;
    hoisted.observationBatches.length = 0;
    hoisted.candidatesForSearch = [smallableCandidate("smallable-430701-product.html", "430701")];
    await runCheck(boboProduct("B226AC114"));
    const backward = { truth: hoisted.storedLinks[0]!.matchTruth, tier: priceTierFromLink(hoisted.storedLinks[0]!) };

    expect(backward).toEqual(forward);
    expect(backward.truth).toBe("STRONG_IDENTIFIER");
  });
});

/* ─────────────────────── 반증은 가격에 닿지 않는다 ─────────────────────── */

describe("🔴 다른 상품 가능성은 가격 어디에도 들어가지 않는다", () => {
  it("Smallable 430632 ↔ Bobo B226AD013(성인 핑크 티셔츠)은 링크도 관측도 만들지 않는다", async () => {
    hoisted.candidatesForSearch = [boboCandidate("B226AD013")];
    const result = await runCheck(smallableProduct("smallable-430632-product.html", "430632"));

    // 링크가 생기더라도 CONFLICT는 EXCLUDED라 가격 재조회 대상이 아니다.
    for (const link of hoisted.storedLinks) {
      expect(link.matchTruth).toBe("CONFLICT");
      expect(priceTierFromLink(link)).toBe("EXCLUDED");
    }
    expect(result.pricesRecorded).toBe(0);
    expect(aggregateLikeMi().basis).toBe("NONE");
  });

  it("텍스트 1위가 반증된 후보라도 같은 검색 안의 동일상품이 대표로 올라온다", async () => {
    // 실측 그대로: 제목이 글자 하나까지 같은 색상 변형(B226AC042/043)이 함께
    // 검색된다. 예전에는 텍스트 1위가 그대로 대표가 되어 그 판매처가 통째로
    // 버려졌다 — 지금은 반증된 후보가 대표 자리에서 빠진다.
    hoisted.candidatesForSearch = [
      { ...boboCandidate("B226AD013"), confidence: 0 },
      boboCandidate("B226AC114"),
    ];
    await runCheck(smallableProduct("smallable-430701-product.html", "430701"));

    expect(hoisted.storedLinks[0]!.externalUrl).toContain("b226ac114");
    expect(hoisted.storedLinks[0]!.matchTruth).toBe("STRONG_IDENTIFIER");
    expect(aggregateLikeMi().basis).toBe("EXACT");
  });
});
