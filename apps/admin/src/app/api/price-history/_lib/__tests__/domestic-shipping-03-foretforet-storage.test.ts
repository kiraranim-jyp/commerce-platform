import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import type { ShippingPolicyStatus } from "@commerce/pricing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DOMESTIC-SHIPPING-03(CEO 지시, 2026-09-16) — 「파서가 읽는다」가 아니라
 * 「observation에 그 값으로 «도착한다»」
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 운영 코드를 끝에서 끝까지 실제로 돌린다:
 *
 *   runDomesticPriceCheck  →  refreshDomesticProductPrice  →  포레포레 어댑터
 *                          →  resolveShippingPolicy       →  price_observations insert
 *
 * 바꿔 끼운 것은 바깥 경계 셋뿐이다 — 편집샵 «검색» 응답, 링크 저장소,
 * 그리고 HTTP(fetch)와 Supabase. 🔴 refreshDomesticProductPrice는 «스텁이 아니다» —
 * 배송비 정책이 어댑터에서 관측까지 실제로 흐르는지가 이 파일의 전부이므로,
 * 그 구간을 가짜로 채우면 재는 것이 없어진다.
 *
 * 🔴 DB write는 이 스텁 안에서만 일어난다. 프로덕션 행을 만들거나 고치지 않는다.
 */

const SNAPSHOT_ID = "0767b19b-0000-0000-0000-00000000f0f0";
const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const SOURCE_ID = "src-foretforet";
const PRODUCT_URL = "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592";

const FORETFORET_HTML = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../../../../packages/crawler/src/__tests__/fixtures/foretforet-shopdetail-10226592.html",
  ),
  "utf-8",
);

/** 2026-09-16 실측 원문(판매처가 쓴 문장 그대로). */
const MEASURED_NOTE = [
  "총 결제금액이 70,000원 미만시 배송비 3,000원이 청구됩니다.",
  "아래 지역에 배송비가 추가됩니다.",
  "진도군 조도면 : 3,000원(10,000,000원 미만시), 울릉군 : 3,000원(10,000,000원 미만시), 제주도 : 3,000원(10,000,000원 미만시), 서귀포시 : 3,000원(10,000,000원 미만시), 제주시 : 3,000원(10,000,000원 미만시), 제주,한경면 : 3,000원(10,000,000원 미만시)",
].join("\n");

/* ───────────────────────────── 경계 스텁 ───────────────────────────── */

const hoisted = vi.hoisted(() => ({
  listDomesticPriceSources: vi.fn(),
  recordDomesticSourceCheckAttempt: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@commerce/crawler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@commerce/crawler")>();
  return {
    ...actual,
    // 🔴 refreshDomesticProductPrice는 그대로 둔다(운영 코드가 돈다).
    searchDomesticShops: vi.fn(async () => [
      { shopId: SOURCE_ID, shopName: "포레포레", domain: "foretforet.com", status: "ok" as const, candidates: [] },
    ]),
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
    // 이미 «동일상품으로 확정된» 링크 1건 — STEP 2(가격 재조회)의 입력이다.
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

/** price_observations 한 테이블만 흉내낸다(shipping-policy-storage.test.ts와 같은 모양). */
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
const { recordPriceObservations } = await import("../price-observations");
const { buildProductIdentityDna } = await import("@commerce/shared");

/* ───────────────────────────── 입력 ───────────────────────────── */

const field = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 0.9 });

function pepeProduct(): CanonicalProduct {
  return {
    sourceUrl: "https://www.junioredition.com/products/lulu-t-bar-shoes-in-vernice-nero-by-pepe",
    title: field("Lulu T-Bar Shoes in Vernice Nero"),
    brand: field("PèPè"),
    sku: field(""),
    modelName: field(""),
    color: field("Vernice Nero"),
    material: field(""),
    description: field(""),
    recommendedAge: field(""),
    images: [],
    optionGroups: [],
    breadcrumbPath: [],
  } as unknown as CanonicalProduct;
}

function foretforetSource() {
  return {
    id: SOURCE_ID,
    name: "포레포레",
    domain: "foretforet.com",
    url: "https://www.foretforet.com",
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

/** 국내 편집샵 관측 하나(포레포레가 아닌 소스) — 불변조건 표에 쓰는 최소 입력. */
function observation(extra: Record<string, unknown> = {}) {
  return {
    snapshotId: SNAPSHOT_ID,
    source: "DOMESTIC_SHOP" as const,
    sourceLabel: "포레포레",
    sourceProductUrl: PRODUCT_URL,
    sourceRefId: SOURCE_ID,
    currency: "KRW",
    priceAmount: 258000,
    priceKrw: 258000,
    ...extra,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  hoisted.rows.length = 0;
  hoisted.listDomesticPriceSources.mockReset().mockResolvedValue([foretforetSource()]);
  hoisted.recordDomesticSourceCheckAttempt.mockReset().mockResolvedValue(undefined);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(FORETFORET_HTML, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }),
  );
});

/* ═══════ ① 포레포레 실제 저장 ═══════ */

describe("DOMESTIC-SHIPPING-03 ①: 실측 원문이 observation에 그 값으로 도착한다", () => {
  it("🔴 CONDITIONAL_FREE · 금액 null · note 원문 — insert payload에서 직접 확인한다", async () => {
    const result = await runDomesticPriceCheck({
      snapshotId: SNAPSHOT_ID,
      workspaceId: WORKSPACE_ID,
      dna: buildProductIdentityDna(pepeProduct()),
    });

    expect(result.pricesRecorded).toBe(1);
    expect(hoisted.rows).toHaveLength(1);
    const row = hoisted.rows[0]!;
    // 🔴 세 칸이 이번 작업의 전부다.
    expect(row.shipping_policy_status).toBe("CONDITIONAL_FREE");
    expect(row.shipping_cost_amount).toBeNull();
    expect(row.shipping_policy_note).toBe(MEASURED_NOTE);
    // 가격 경로는 예전 그대로 — 배송비를 만졌다고 가격이 달라지지 않았다.
    expect(row.price_krw).toBe(258000);
    expect(row.price_amount).toBe(258000);
    expect(row.currency).toBe("KRW");
    expect(row.sold_out).toBe(false);
    expect(row.source_product_url).toBe(PRODUCT_URL);
    expect(row.source_ref_id).toBe(SOURCE_ID);
  });

  it("🔴 note에 우리가 쓴 문장이 하나도 섞이지 않았다", async () => {
    await runDomesticPriceCheck({
      snapshotId: SNAPSHOT_ID,
      workspaceId: WORKSPACE_ID,
      dna: buildProductIdentityDna(pepeProduct()),
    });
    const note = hoisted.rows[0]!.shipping_policy_note as string;
    for (const ours of ["CONDITIONAL_FREE", "조건부", "확인됨", "포레포레 기본 배송비 기준"]) {
      expect(note).not.toContain(ours);
    }
    // 판매처 문장은 그대로 있다.
    expect(note).toContain("총 결제금액이 70,000원 미만시 배송비 3,000원이 청구됩니다.");
    expect(note).toContain("제주도 : 3,000원(10,000,000원 미만시)");
  });

  it("🔴 응답을 못 받으면 관측 자체가 만들어지지 않는다 — UNREAD를 지어내지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("", { status: 404 }));
    const result = await runDomesticPriceCheck({
      snapshotId: SNAPSHOT_ID,
      workspaceId: WORKSPACE_ID,
      dna: buildProductIdentityDna(pepeProduct()),
    });
    expect(result.pricesRecorded).toBe(0);
    expect(hoisted.rows).toHaveLength(0);
  });
});

/* ═══════ ② 역방향 — 저장 문이 계속 막는가 ═══════ */

describe("DOMESTIC-SHIPPING-03 ②: CONDITIONAL_FREE에 금액을 붙이면 «거절»된다", () => {
  it("🔴 포레포레의 「3,000원」을 금액 칸에 정규화해 넣으면 배치가 통째로 거절된다", async () => {
    // 이 테스트가 막는 유혹이 정확히 이것이다 — note에 3,000원이 보이니
    // shipping_cost_amount에도 넣고 싶어진다. 그러면 「70,000원 미만일 때만」이
    // 사라진 채 «이 상품의 배송비 3,000원»이라는 없는 사실이 생긴다.
    const result = await recordPriceObservations([
      observation({ shippingPolicyStatus: "CONDITIONAL_FREE", shippingPolicyNote: MEASURED_NOTE, shippingCostAmount: 3000 }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("CONDITIONAL_FREE");
    expect(hoisted.rows).toHaveLength(0);
  });

  it("금액 없이 같은 관측을 다시 넣으면 저장된다 — 막는 것은 «금액»뿐이다", async () => {
    const result = await recordPriceObservations([
      observation({ shippingPolicyStatus: "CONDITIONAL_FREE", shippingPolicyNote: MEASURED_NOTE }),
    ]);
    expect(result).toEqual({ ok: true, count: 1 });
    expect(hoisted.rows[0]).toMatchObject({
      shipping_policy_status: "CONDITIONAL_FREE",
      shipping_cost_amount: null,
      shipping_policy_note: MEASURED_NOTE,
    });
  });
});

/* ═══════ ③ 다섯 불변조건 ═══════ */

describe("DOMESTIC-SHIPPING-03 ③: 다섯 불변조건이 «저장 경로에서» 깨지지 않는다", () => {
  /** CEO §③ — 상태별로 금액 칸이 가질 수 있는 값. 표 한 줄이 곧 불변조건이다. */
  const CASES: Array<{ status: ShippingPolicyStatus; allowed: number | null; rejected: number[] }> = [
    { status: "UNREAD", allowed: null, rejected: [0, 3000] },
    { status: "ORDER_TIME", allowed: null, rejected: [0, 3000] },
    { status: "CONDITIONAL_FREE", allowed: null, rejected: [0, 3000, 70000] },
    { status: "FREE", allowed: 0, rejected: [3000] },
    { status: "FLAT", allowed: 3000, rejected: [0, -1] },
  ];

  it.each(CASES)("$status — 금액은 $allowed 로만 저장된다", async ({ status, allowed }) => {
    const input = allowed === null || status === "FREE" ? {} : { shippingCostAmount: allowed };
    const result = await recordPriceObservations([observation({ shippingPolicyStatus: status, ...input })]);
    if (status === "FLAT") {
      // FLAT은 금액을 «생략하면» 저장될 수 없다 — 숫자 없는 FLAT은 UNREAD다.
      const omitted = await recordPriceObservations([observation({ shippingPolicyStatus: "FLAT" })]);
      expect(omitted.ok).toBe(false);
    }
    expect(result).toEqual({ ok: true, count: 1 });
    expect(hoisted.rows.at(-1)!.shipping_policy_status).toBe(status);
    expect(hoisted.rows.at(-1)!.shipping_cost_amount).toBe(allowed);
  });

  it.each(CASES)("$status — 허용되지 않은 금액은 한 행도 쓰지 않는다", async ({ status, rejected }) => {
    for (const amount of rejected) {
      const result = await recordPriceObservations([
        observation({ shippingPolicyStatus: status, shippingCostAmount: amount }),
      ]);
      expect(result.ok, `${status} + ${amount}`).toBe(false);
      expect(hoisted.rows).toHaveLength(0);
    }
  });

  it("🔴 상태가 «없는»(null) 행에 금액만 넣는 것도 막는다 — 그 숫자를 설명할 칸이 없다", async () => {
    const result = await recordPriceObservations([observation({ shippingCostAmount: 3000 })]);
    expect(result.ok).toBe(false);
    expect(hoisted.rows).toHaveLength(0);
  });

  it("상태도 금액도 안 넘기는 기존 호출부는 두 칸이 null로 저장된다(무회귀)", async () => {
    const result = await recordPriceObservations([observation()]);
    expect(result).toEqual({ ok: true, count: 1 });
    expect(hoisted.rows[0]).toMatchObject({
      shipping_policy_status: null,
      shipping_policy_note: null,
      shipping_cost_amount: null,
      price_krw: 258000,
    });
  });
});
