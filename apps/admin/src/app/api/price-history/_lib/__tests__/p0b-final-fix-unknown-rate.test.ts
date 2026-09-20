import { beforeEach, describe, expect, it, vi } from "vitest";
import { summarizeDomesticMarketSplit, type PriceObservationRecord } from "@commerce/pricing";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-B FINAL FIX(CEO 지시, 2026-09-20) — **환율을 모르면 원화를 만들지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 이 파일이 지키는 한 문장 ────────────────────────────────────────────────
 * 「원화 칸에는 원화만 들어간다.」 통화가 KRW가 아닌데 금액을 그대로 price_krw에
 * 적으면, 그것은 환율 1을 조용히 적용한 값이다. €84가 ₩84가 되고, 한 번 저장되면
 * 최저가·마진·CASE 판정이 전부 그 숫자를 믿는다.
 *
 * ── 🔴 이 테스트가 «오늘» 막는 행은 0건이다 ─────────────────────────────────
 * 그 사실을 숨기지 않는다. 2026-09-20 Production 실측:
 *
 *     DOMESTIC_SHOP  KRW 250건 · 비-KRW 0건       (등록된 국내 소스 12곳 전부 KRW)
 *     SELLER_ORIGIN  CAD 4건이 price_krw=price_amount
 *
 * 그 CAD 4건은 2026-09-09~10에 저장됐고, 같은 사고는 2026-09-11 `51758aa`
 * (PRICE-ACCURACY-REGRESSION-1.1)이 convertToKrwStrict로 이미 막았다. 즉 CAD는
 * «지금 새는 구멍»이 아니라 그 수리 이전의 흔적이다(CEO 지시: 소급 수정 금지).
 *
 * 남아 있던 것은 국내 경로 한 줄뿐이었다 — run-domestic-price-check.ts가 통화를
 * 보지 않고 `priceKrw: priceResult.price?.amount`를 적고 있었다. 지금은 KRW가
 * 아닌 것을 막는다. refreshDomesticProductPrice의 bobochoses.com 분기가 Shopify
 * /ko-kr JSON의 통화를 그대로 돌려주므로, 그 분기가 살아나는 날 이 줄이 환율 1을
 * 적는 자리가 된다. 그래서 그 날이 오기 전에 잠근다.
 */

const SNAPSHOT_ID = "0767b19b-0000-0000-0000-0000000b0b0b";
const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const SOURCE_ID = "src-bobo-kr";
const PRODUCT_URL = "https://bobochoses.com/ko-kr/products/b226ac043";

/* ───────────────────────────── 경계 스텁 ───────────────────────────── */

const hoisted = vi.hoisted(() => ({
  listDomesticPriceSources: vi.fn(),
  recordDomesticSourceCheckAttempt: vi.fn(),
  refreshDomesticProductPrice: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@commerce/crawler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@commerce/crawler")>();
  return {
    ...actual,
    searchDomesticShops: vi.fn(async () => [
      { shopId: SOURCE_ID, shopName: "보보쇼즈 KR", domain: "bobochoses.com", status: "ok" as const, candidates: [] },
    ]),
    /* 🔴 여기만 가짜다. 이 테스트가 재는 것은 「어댑터가 통화를 어떻게 읽는가」가
       아니라 「운영 코드가 그 통화를 받고 원화 칸에 무엇을 적는가」다. */
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
    upsertDomesticProductLink: vi.fn(async () => ({ ok: true as const, link: null as never })),
    listDomesticProductLinks: vi.fn(async () => [
      {
        id: "link-1",
        snapshotId: SNAPSHOT_ID,
        sourceId: SOURCE_ID,
        externalUrl: PRODUCT_URL,
        matchTruth: "EXACT_IDENTIFIER",
        verified: true,
        status: "ACTIVE",
        matchReasons: [],
      },
    ]),
  };
});

/** price_observations 한 테이블만 흉내낸다(domestic-shipping-03 테스트와 같은 모양). */
function makeSupabaseStub() {
  function builder() {
    let pending: Array<Record<string, unknown>> | null = null;
    const chain = {
      insert: (payload: Array<Record<string, unknown>>) => {
        pending = payload;
        return chain;
      },
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      limit: () => chain,
      then: (resolve: (value: { data: unknown; error: null; count: number }) => unknown) => {
        if (!pending) return resolve({ data: [], error: null, count: 0 });
        for (const row of pending) hoisted.rows.push({ id: `row-${hoisted.rows.length + 1}`, ...row });
        return resolve({ data: null, error: null, count: pending.length });
      },
    };
    return chain;
  }
  return { from: () => builder() };
}

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => makeSupabaseStub() }));

const { runDomesticPriceCheck } = await import("../run-domestic-price-check");
const { buildProductIdentityDna } = await import("@commerce/shared");

/* ───────────────────────────── 입력 ───────────────────────────── */

const field = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });

function boboProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://bobochoses.com/en-int/products/b226ac043",
    title: field("Mystery BC Ribbed T-Shirt"),
    brand: field("Bobo Choses"),
    sku: field("B226AC043"),
    modelName: field(""),
    color: field("Blue"),
    material: field(""),
    description: field(""),
    recommendedAge: field(""),
    images: [],
    optionGroups: [],
    breadcrumbPath: [],
  } as unknown as CanonicalProduct;
}

function boboSource() {
  return {
    id: SOURCE_ID,
    name: "보보쇼즈 KR",
    domain: "bobochoses.com",
    url: "https://bobochoses.com",
    currency: "KRW",
    categoryScope: [] as string[],
    priority: "P0" as const,
    collectionStrategy: "AUTO_WEB" as const,
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

async function runWith(price: { amount: number; currency: string } | null, soldOut?: boolean | null) {
  hoisted.refreshDomesticProductPrice.mockResolvedValue({
    status: price ? "OK" : "UNAVAILABLE",
    price,
    soldOut: soldOut ?? null,
  });
  return runDomesticPriceCheck({
    snapshotId: SNAPSHOT_ID,
    workspaceId: WORKSPACE_ID,
    dna: buildProductIdentityDna(boboProduct()),
  });
}

beforeEach(() => {
  hoisted.rows.length = 0;
  hoisted.listDomesticPriceSources.mockReset().mockResolvedValue([boboSource()]);
  hoisted.recordDomesticSourceCheckAttempt.mockReset().mockResolvedValue(undefined);
  hoisted.refreshDomesticProductPrice.mockReset();
});

/* ═══════ ① 저장 경로 ═══════ */

describe("P0-B FINAL FIX ①: 국내 관측의 원화 칸", () => {
  it("KRW는 예전 그대로 저장된다 — 무회귀(이것이 오늘의 250건 전부다)", async () => {
    const result = await runWith({ amount: 162000, currency: "KRW" });
    expect(result.pricesRecorded).toBe(1);
    expect(hoisted.rows[0]).toMatchObject({ currency: "KRW", price_amount: 162000, price_krw: 162000 });
  });

  it("🔴 통화가 KRW가 아니면 price_krw를 만들지 않는다 — €84를 ₩84로 적지 않는다", async () => {
    const result = await runWith({ amount: 84, currency: "EUR" });
    expect(result.pricesRecorded).toBe(1);
    expect(hoisted.rows[0]!.price_krw).toBeNull();
  });

  it("🔴 가격을 «버리지» 않는다 — 원통화 금액과 통화는 그대로 남는다", async () => {
    await runWith({ amount: 84, currency: "EUR" });
    expect(hoisted.rows[0]).toMatchObject({ price_amount: 84, currency: "EUR", price_krw: null });
    // 이 경로는 환율을 애초에 들고 다니지 않는다 — 없는 환율을 여기서 지어내지도 않는다.
    expect(hoisted.rows[0]!.exchange_rate ?? null).toBeNull();
  });

  it("소문자 통화 표기에도 같은 규칙이 선다 — 표기 차이로 구멍이 생기지 않는다", async () => {
    await runWith({ amount: 162000, currency: "krw" });
    expect(hoisted.rows[0]!.price_krw).toBe(162000);
  });

  it("가격 없이 품절만 확인된 행은 예전과 똑같다(N-4.18-Q3 PART E-1 무회귀)", async () => {
    const result = await runWith(null, true);
    expect(result.pricesRecorded).toBe(1);
    expect(hoisted.rows[0]).toMatchObject({ price_amount: null, price_krw: null, sold_out: true, currency: "KRW" });
  });
});

/* ═══════ ② 그 null이 최저가로 새지 않는가 ═══════ */

let seq = 0;
function obs(partial: Partial<PriceObservationRecord> & { source: string }): PriceObservationRecord {
  seq += 1;
  return {
    id: `obs-${seq}`,
    snapshotId: SNAPSHOT_ID,
    sourceLabel: null,
    sourceProductUrl: null,
    sourceRefId: null,
    currency: "KRW",
    priceAmount: null,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: null,
    priceKrw: null,
    salePriceKrw: null,
    originalPriceKrw: null,
    soldOut: null,
    marketCode: null,
    marketCountry: null,
    shippingPolicyStatus: null,
    shippingPolicyNote: null,
    checkedAt: "2026-09-20T00:00:00.000Z",
    ...partial,
  } as PriceObservationRecord;
}

describe("P0-B FINAL FIX ②: 원화를 모르는 관측은 국내 최저가가 되지 않는다", () => {
  it("🔴 price_krw=null 행 하나뿐이면 국내 가격은 «없다» — 84원이 최저가로 뜨지 않는다", () => {
    const split = summarizeDomesticMarketSplit(
      [obs({ source: "DOMESTIC_SHOP", sourceLabel: "보보쇼즈 KR", currency: "EUR", priceAmount: 84, priceKrw: null })],
      [],
    );
    expect(split.exact.sellerCount).toBe(0);
    expect(split.basis).toBe("NONE");
    expect(split.resolved.lowestPriceKrw ?? null).toBeNull();
    expect(split.resolved.sampleListings).toHaveLength(0);
  });

  it("정상 행과 섞여도 정상 행만 집계된다 — null이 최저가를 끌어내리지 않는다", () => {
    const split = summarizeDomesticMarketSplit(
      [
        obs({ source: "DOMESTIC_SHOP", sourceLabel: "룰리", priceAmount: 162000, priceKrw: 162000 }),
        obs({ source: "DOMESTIC_SHOP", sourceLabel: "보보쇼즈 KR", currency: "EUR", priceAmount: 84, priceKrw: null }),
      ],
      [],
    );
    expect(split.basis).toBe("EXACT");
    expect(split.resolved.lowestPriceKrw).toBe(162000);
    expect(split.resolved.sellerCount).toBe(1);
    // 🔴 84가 리스팅으로도 새지 않는다 — 집계에서만 빠지고 화면에 남으면 같은 사고다.
    expect(split.resolved.sampleListings.map((l) => l.priceKrw)).toEqual([162000]);
  });
});
