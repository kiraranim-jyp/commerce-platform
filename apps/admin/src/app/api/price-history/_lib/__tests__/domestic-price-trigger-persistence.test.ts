import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";

/**
 * DOMESTIC-PRICE-TRIGGER-1(CEO 지시, 2026-09-12) — 트리거가 실제로 **남기는지**.
 *
 * seam 테스트(snapshots/__tests__/domestic-price-trigger-seam.test.ts)는 "언제
 * 한 번 걸리는가"만 본다. 여기서 보는 건 그 한 번이 끝났을 때 DB에 무엇이
 * 남는가다 — Production에서 0행이었던 바로 그 두 자리:
 *
 *     domestic_product_links          국내 동일/비교상품 링크
 *     price_observations (DOMESTIC_SHOP)  그 링크의 국내 가격 관측
 *
 * 쓰기 경로는 새로 만들지 않았다. 전부 기존 runDomesticPriceCheck()가 한다 —
 * 그래서 이 테스트는 그 함수를 실제로 돌리고(매칭/증거/티어 판정은 전부 진짜
 * 코드다), 바깥 경계(검색·가격조회·저장)만 스텁으로 관찰한다.
 */

const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const SNAPSHOT_ID = "0767b19b-0000-0000-0000-000000000001";
/** 국내측 modelCode 추출기가 없는 도메인을 일부러 쓴다 — 실제 HTTP fetch가
 * 일어나는 경로(foretforet.com 등)를 테스트가 건드리지 않게 하기 위함이다.
 * 판정 규칙 자체는 손대지 않는다(compareModelCode가 "unavailable"을 내고
 * deriveMatchTruth가 정직하게 텍스트 등급으로 처리하는 기존 동작 그대로). */
const SHOP_DOMAIN = "kidsboutique.example.com";

interface StoredLink {
  id: string;
  snapshotId: string;
  sourceId: string;
  externalUrl: string;
  matchType: string;
  matchTruth: string | null;
  verified: boolean;
  status: "ACTIVE" | "PAUSED" | "BROKEN_LINK";
}

const hoisted = vi.hoisted(() => ({
  searchDomesticShops: vi.fn(),
  refreshDomesticProductPrice: vi.fn(),
  listDomesticPriceSources: vi.fn(),
  recordDomesticSourceCheckAttempt: vi.fn(),
  upsertCalls: [] as Array<Record<string, unknown>>,
  storedLinks: [] as StoredLink[],
  observationBatches: [] as Array<Array<Record<string, unknown>>>,
  hasObservationTodayCalls: [] as Array<[string, string]>,
  observationExistsToday: false,
}));

vi.mock("@commerce/crawler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@commerce/crawler")>();
  // 매칭 규칙(scoreCandidateMatch/compareModelCode/deriveMatchTruth/
  // decideCandidateEvidence)은 진짜를 그대로 쓴다 — 이번 작업은 판정을 바꾸는
  // 작업이 아니므로, 스텁으로 갈아끼우면 검증의 의미가 사라진다.
  return {
    ...actual,
    searchDomesticShops: hoisted.searchDomesticShops,
    refreshDomesticProductPrice: hoisted.refreshDomesticProductPrice,
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
    // upsert는 (snapshot_id, source_id) 충돌 키를 가진 진짜 업서트다
    // (domestic-product-link.ts의 onConflict). 스텁도 같은 키로 덮어쓴다 —
    // 같은 스냅샷을 다시 조사해도 링크 행이 늘지 않는다는 성질을 그대로 재현.
    upsertDomesticProductLink: vi.fn(async (input: Record<string, unknown>) => {
      hoisted.upsertCalls.push(input);
      const key = `${input.snapshotId}:${input.sourceId}`;
      const link: StoredLink = {
        id: key,
        snapshotId: input.snapshotId as string,
        sourceId: input.sourceId as string,
        externalUrl: input.externalUrl as string,
        matchType: input.matchType as string,
        matchTruth: (input.matchTruth as string) ?? null,
        verified: input.verified as boolean,
        status: "ACTIVE",
      };
      const existing = hoisted.storedLinks.findIndex((l) => l.id === key);
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
    hasObservationToday: vi.fn(async (snapshotId: string, source: string) => {
      hoisted.hasObservationTodayCalls.push([snapshotId, source]);
      return hoisted.observationExistsToday;
    }),
    recordPriceObservations: vi.fn(async (observations: Array<Record<string, unknown>>) => {
      if (observations.length > 0) hoisted.observationBatches.push(observations);
      return { ok: true as const, count: observations.length };
    }),
  };
});

// vi.mock 은 호이스팅되므로 이 static import는 이미 스텁이 끼워진 모듈 그래프를
// 받는다 — 테스트 안에서 await import()로 부르면 @commerce/crawler 변환 비용이
// 첫 테스트의 타임아웃으로 잡힌다(실제로 그랬다).
const { runDomesticPriceCheckForNewSnapshot } = await import("../trigger-domestic-price-check");

function field<T>(value: T, source: FieldSource = "ORIGINAL"): ProvenanceField<T> {
  return { value, source, confidence: 0.9 };
}

function makeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://bobochoses.com/en-kr/products/b226ac043-mystery-bc-half-zipped-sweatshirt",
    title: field("Mystery BC Half Zipped Sweatshirt"),
    brand: field("Bobo Choses"),
    price: field({ amount: 75, currency: "EUR" }),
    priceValidity: "VALID",
    sku: field("B226AC043"),
    description: field("Product code B226AC043"),
    material: field(""),
    color: field(""),
    recommendedAge: field(""),
    manufacturer: field(""),
  } as unknown as CanonicalProduct;
}

function makeSource() {
  return {
    id: "source-1",
    name: "키즈부티크",
    domain: SHOP_DOMAIN,
    url: `https://${SHOP_DOMAIN}`,
    currency: "KRW",
    // 빈 배열 = category_scope를 주장하지 않는 소스. sourceFitsScopes가 항상
    // 통과시킨다(카테고리 엔진은 이번 작업에서 건드리지 않는다).
    categoryScope: [] as string[],
    priority: "P0" as const,
    collectionStrategy: "AUTO_SCRAPE" as const,
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

function searchHit() {
  return [
    {
      shopId: "source-1",
      shopName: "키즈부티크",
      domain: SHOP_DOMAIN,
      status: "ok" as const,
      candidates: [
        {
          title: "보보쇼즈 미스터리 BC 하프집 스웨트셔츠",
          url: `https://${SHOP_DOMAIN}/product/b226ac043`,
          price: { amount: 129000, currency: "KRW" },
          imageUrl: null,
          confidence: 0.97,
          matchLevel: "very_high" as const,
          matchReasons: ["브랜드 일치", "상품명 일치"],
        },
      ],
    },
  ];
}

beforeEach(() => {
  hoisted.upsertCalls.length = 0;
  hoisted.storedLinks.length = 0;
  hoisted.observationBatches.length = 0;
  hoisted.hasObservationTodayCalls.length = 0;
  hoisted.observationExistsToday = false;
  hoisted.searchDomesticShops.mockReset();
  hoisted.refreshDomesticProductPrice.mockReset();
  hoisted.listDomesticPriceSources.mockReset();
  hoisted.recordDomesticSourceCheckAttempt.mockReset();

  hoisted.listDomesticPriceSources.mockResolvedValue([makeSource()]);
  hoisted.searchDomesticShops.mockResolvedValue(searchHit());
  hoisted.refreshDomesticProductPrice.mockResolvedValue({
    status: "OK",
    price: { amount: 129000, currency: "KRW" },
    salePriceKrw: null,
    originalPriceKrw: null,
    soldOut: false,
  });
  hoisted.recordDomesticSourceCheckAttempt.mockResolvedValue(undefined);
});

async function runTrigger() {
  return runDomesticPriceCheckForNewSnapshot({
    snapshotId: SNAPSHOT_ID,
    workspaceId: WORKSPACE_ID,
    canonicalProduct: makeProduct(),
  });
}

describe("DOMESTIC-PRICE-TRIGGER-1: 분석 직후 조사가 실제로 남기는 것", () => {
  it("1) 국내 후보가 있으면 domestic_product_links에 쓴다", async () => {
    const result = await runTrigger();

    expect(hoisted.upsertCalls).toHaveLength(1);
    expect(hoisted.upsertCalls[0]).toMatchObject({
      snapshotId: SNAPSHOT_ID,
      sourceId: "source-1",
      externalUrl: `https://${SHOP_DOMAIN}/product/b226ac043`,
    });
    expect(result?.linksCreatedOrUpdated).toBe(1);
    // 판매자가 켜 둔 편집샵만 뒤진다 — workspaceId 없이 카탈로그 전체를
    // 뒤지던 시절로 돌아가지 않는다(GLOBAL-MARKET ③-2).
    expect(hoisted.listDomesticPriceSources).toHaveBeenCalledWith(WORKSPACE_ID);
  });

  it("2) 국내 가격이 잡히면 price_observations에 source=DOMESTIC_SHOP으로 쓴다", async () => {
    const result = await runTrigger();

    expect(hoisted.observationBatches).toHaveLength(1);
    const [observation] = hoisted.observationBatches[0];
    expect(observation).toMatchObject({
      snapshotId: SNAPSHOT_ID,
      source: "DOMESTIC_SHOP",
      sourceRefId: "source-1",
      currency: "KRW",
      priceAmount: 129000,
      priceKrw: 129000,
    });
    expect(result?.pricesRecorded).toBe(1);
  });

  it("3) 같은 스냅샷을 다시 불러도 관측치가 중복으로 쌓이지 않는다", async () => {
    await runTrigger();
    expect(hoisted.observationBatches).toHaveLength(1);

    // 첫 조사가 오늘자 DOMESTIC_SHOP 관측을 남긴 상태 그대로 재호출한다.
    // 멱등성은 새로 만든 장치가 아니라 기존 정책(skipIfCheckedToday →
    // hasObservationToday)이 그대로 맡는다.
    hoisted.observationExistsToday = true;
    hoisted.searchDomesticShops.mockClear();
    const second = await runTrigger();

    expect(hoisted.hasObservationTodayCalls.at(-1)).toEqual([SNAPSHOT_ID, "DOMESTIC_SHOP"]);
    expect(hoisted.searchDomesticShops).not.toHaveBeenCalled();
    expect(hoisted.observationBatches).toHaveLength(1);
    expect(second?.pricesRecorded).toBe(0);
    expect(second?.linksCreatedOrUpdated).toBe(0);
    // 링크도 늘지 않는다 — upsert 충돌 키가 (snapshot_id, source_id)라
    // 검색이 다시 돌았더라도 행 수는 그대로다.
    expect(hoisted.storedLinks).toHaveLength(1);
  });

  it("4) 국내 검색이 통째로 터져도 트리거는 throw하지 않는다(상품 분석과 분리)", async () => {
    hoisted.searchDomesticShops.mockRejectedValue(new Error("편집샵 검색 실패"));

    await expect(runTrigger()).resolves.toBeNull();
    expect(hoisted.observationBatches).toHaveLength(0);
  });

  it("5) 국내 가격 조회가 실패해도 예외가 밖으로 새지 않고 링크는 남는다", async () => {
    hoisted.refreshDomesticProductPrice.mockResolvedValue({
      status: "ERROR",
      price: null,
      salePriceKrw: null,
      originalPriceKrw: null,
      soldOut: null,
      error: "타임아웃",
    });

    const result = await runTrigger();

    expect(result?.linksCreatedOrUpdated).toBe(1);
    expect(result?.pricesRecorded).toBe(0);
    expect(result?.sourceErrors.some((e) => e.includes("타임아웃"))).toBe(true);
  });
});
