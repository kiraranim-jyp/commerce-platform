import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * DOMESTIC-SHIPPING-02 ③(CEO 지시, 2026-09-16)
 * 「마이그레이션이 아직 반영 안 된 세션에서도 가격 저장이 계속된다」
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 원문:
 *   "price-observations.ts 의 isMissingColumnError() 폴백은 038 이 추가한 3컬럼만
 *    벗겨낸다. 새 컬럼 2개를 base row 에 넣고 «폴백에 반영 안 하면» 마이그레이션
 *    반영 전 세션에서 «전 소스 가격저장이 통째로 실패» 한다. 2026-08-25
 *    프로덕션 실측 회귀가 이미 한 번 났다."
 *
 * 그래서 이 파일은 «컬럼이 없는 DB»를 흉내내고, 그 상태에서 가격이 계속 저장되는지
 * — 그리고 «무엇이 남고 무엇이 비는지» — 를 실제 insert 호출로 잰다.
 */

const supabaseRef = vi.hoisted(() => ({ current: null as ReturnType<typeof makeSupabaseStub> | null }));

vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => supabaseRef.current }));

const { recordPriceObservations } = await import("../price-observations");

/**
 * price_observations 한 테이블만 흉내내는 최소 스텁(global-market-observations.test.ts
 * 와 같은 모양). 다른 점 하나: `knownColumns` 를 주면 «그 컬럼만 존재하는 DB»가
 * 되어, 그 밖의 컬럼이 payload 에 있으면 PostgREST 와 같은 문구의 에러를 낸다.
 */
function makeSupabaseStub(knownColumns?: Set<string>) {
  const rows: Array<Record<string, unknown>> = [];
  const attempts: Array<{ columns: string[]; rejected: string | null }> = [];

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
      then: (resolve: (value: { data: unknown; error: { message: string } | null; count: number }) => unknown) => {
        if (!pending) return resolve({ data: [], error: null, count: 0 });
        const columns = Object.keys(pending[0] ?? {});
        const missing = knownColumns ? columns.find((c) => !knownColumns.has(c)) : undefined;
        attempts.push({ columns, rejected: missing ?? null });
        if (missing) {
          // PostgREST 가 실제로 내는 문구 그대로(isMissingColumnError 가 이 모양을 본다).
          return resolve({
            data: null,
            error: { message: `Could not find the '${missing}' column of 'price_observations' in the schema cache` },
            count: 0,
          });
        }
        for (const row of pending) rows.push({ id: `row-${rows.length + 1}`, ...row });
        return resolve({ data: null, error: null, count: pending.length });
      },
    };
    return chain;
  }

  return { from: () => builder(), rows, attempts };
}

/** 027/031 이 만든 컬럼 — 이보다 더 벗을 것이 없는 바닥. */
const BASE_COLUMNS = [
  "snapshot_id",
  "source",
  "source_label",
  "source_product_url",
  "source_ref_id",
  "market_code",
  "market_country",
  "currency",
  "price_amount",
  "shipping_cost_amount",
  "tax_amount",
  "exchange_rate",
  "price_krw",
];
const COLUMNS_038 = ["sale_price_krw", "original_price_krw", "sold_out"];
const COLUMNS_054 = ["shipping_policy_status", "shipping_policy_note"];

/** 국내 편집샵 관측 하나 — run-domestic-price-check.ts 가 만드는 모양 그대로. */
function domesticObservation(extra: Record<string, unknown> = {}) {
  return {
    snapshotId: "snap-1",
    source: "DOMESTIC_SHOP" as const,
    sourceLabel: "RULII",
    sourceProductUrl: "https://rulii.co.kr/product/1",
    sourceRefId: "src-1",
    currency: "KRW",
    priceAmount: 129000,
    priceKrw: 129000,
    salePriceKrw: 129000,
    originalPriceKrw: 159000,
    soldOut: false,
    ...extra,
  };
}

beforeEach(() => {
  supabaseRef.current = null;
});

/* ═══════ ① 054 가 반영된 정상 세션 ═══════ */

describe("DOMESTIC-SHIPPING-02 ③-①: 054 반영 세션에서는 두 칸이 그대로 저장된다", () => {
  it("shipping_policy_status · shipping_policy_note 가 첫 시도에 저장된다", async () => {
    const stub = makeSupabaseStub(new Set([...BASE_COLUMNS, ...COLUMNS_038, ...COLUMNS_054]));
    supabaseRef.current = stub;

    const result = await recordPriceObservations([
      domesticObservation({
        shippingPolicyStatus: "CONDITIONAL_FREE",
        shippingPolicyNote: "5만원 이상 무료배송",
      }),
    ]);

    expect(result).toEqual({ ok: true, count: 1 });
    expect(stub.attempts).toHaveLength(1); // 폴백이 돌지 않았다
    expect(stub.rows[0]).toMatchObject({
      shipping_policy_status: "CONDITIONAL_FREE",
      shipping_policy_note: "5만원 이상 무료배송",
      shipping_cost_amount: null, // 🔴 조건을 숫자 한 칸에 욱여넣지 않는다
      price_krw: 129000,
    });
  });

  it("상태를 안 넘긴 기존 호출부는 두 칸이 null 로 저장된다 — UNREAD 로 승격되지 않는다", async () => {
    const stub = makeSupabaseStub(new Set([...BASE_COLUMNS, ...COLUMNS_038, ...COLUMNS_054]));
    supabaseRef.current = stub;

    const result = await recordPriceObservations([domesticObservation()]);

    expect(result).toEqual({ ok: true, count: 1 });
    expect(stub.rows[0]!.shipping_policy_status).toBeNull();
    expect(stub.rows[0]!.shipping_policy_note).toBeNull();
    expect(stub.rows[0]!.shipping_cost_amount).toBeNull();
  });
});

/* ═══════ ② 054 미반영 — 여기서 멈추면 프로덕션이 멈춘다 ═══════ */

describe("DOMESTIC-SHIPPING-02 ③-②: 054 가 아직 반영되지 않아도 가격 저장은 계속된다", () => {
  it("🔴 054 미반영 세션 — insert 가 통째로 실패하지 않고 가격이 저장된다", async () => {
    const stub = makeSupabaseStub(new Set([...BASE_COLUMNS, ...COLUMNS_038]));
    supabaseRef.current = stub;

    const result = await recordPriceObservations([
      domesticObservation({ shippingPolicyStatus: "ORDER_TIME", shippingPolicyNote: "고객직접선택" }),
      domesticObservation({ sourceLabel: "DEUXBEBE", sourceRefId: "src-2", priceKrw: 131000 }),
    ]);

    // 🔴 2026-08-25 회귀의 재발 여부가 정확히 이 줄이다.
    expect(result).toEqual({ ok: true, count: 2 });
    expect(stub.rows).toHaveLength(2);
    expect(stub.rows[0]).toMatchObject({ price_krw: 129000, source_label: "RULII" });
    expect(stub.rows[1]).toMatchObject({ price_krw: 131000, source_label: "DEUXBEBE" });
  });

  it("🔴 054 만 벗는다 — 038 의 할인가·정가·품절은 «그대로 남는다»", async () => {
    const stub = makeSupabaseStub(new Set([...BASE_COLUMNS, ...COLUMNS_038]));
    supabaseRef.current = stub;

    await recordPriceObservations([domesticObservation({ shippingPolicyStatus: "UNREAD" })]);

    expect(stub.attempts).toHaveLength(2); // ① 전체 → ② 054 제외
    expect(stub.attempts[0]!.rejected).toMatch(/shipping_policy_/);
    expect(stub.attempts[1]!.rejected).toBeNull();
    // 알고 있던 사실을 스키마 지연 때문에 잃지 않는다.
    expect(stub.rows[0]).toMatchObject({
      sale_price_krw: 129000,
      original_price_krw: 159000,
      sold_out: false,
    });
    // 새 두 칸만 «없다». 상태가 UNREAD 였다는 사실은 이번 행에 남지 않는다 —
    // 그러나 그게 0원이나 FREE 로 둔갑하지도 않는다.
    expect(stub.rows[0]).not.toHaveProperty("shipping_policy_status");
  });

  it("038 도 054 도 미반영인 가장 오래된 세션에서도 저장된다(바닥까지 벗는다)", async () => {
    const stub = makeSupabaseStub(new Set(BASE_COLUMNS));
    supabaseRef.current = stub;

    const result = await recordPriceObservations([domesticObservation({ shippingPolicyStatus: "FREE" })]);

    expect(result).toEqual({ ok: true, count: 1 });
    expect(stub.attempts.map((a) => a.rejected !== null)).toEqual([true, true, false]);
    expect(stub.rows[0]).toMatchObject({ price_krw: 129000 });
    expect(Object.keys(stub.rows[0]!).sort()).toEqual(["id", ...BASE_COLUMNS].sort());
  });

  it("컬럼 부재가 «아닌» 실패는 폴백으로 덮지 않는다 — 조용한 성공을 만들지 않는다", async () => {
    const stub = makeSupabaseStub();
    supabaseRef.current = {
      ...stub,
      from: () => ({
        insert: () => ({
          then: (resolve: (v: { data: null; error: { message: string }; count: number }) => unknown) =>
            resolve({ data: null, error: { message: 'insert violates foreign key constraint "..._snapshot_id_fkey"' }, count: 0 }),
        }),
      }),
    } as unknown as ReturnType<typeof makeSupabaseStub>;

    const result = await recordPriceObservations([domesticObservation()]);
    expect(result.ok).toBe(false);
  });
});

/* ═══════ ③ 저장 «전»에 모순을 막는다 ═══════ */

describe("DOMESTIC-SHIPPING-02 ③-③: 모순된 배송비는 DB 에 닿기 전에 거절된다", () => {
  it("🔴 UNREAD 인데 배송비 0원 — 한 행도 쓰지 않고 거절한다", async () => {
    const stub = makeSupabaseStub(new Set([...BASE_COLUMNS, ...COLUMNS_038, ...COLUMNS_054]));
    supabaseRef.current = stub;

    const result = await recordPriceObservations([
      domesticObservation({ shippingPolicyStatus: "UNREAD", shippingCostAmount: 0 }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("UNREAD");
    // 🔴 배치 전체가 쓰이지 않는다 — "0원인 UNREAD" 행이 하나라도 남으면
    //    그 0원은 다음 단계에서 «확인된 무료배송»과 구분되지 않는다.
    expect(stub.rows).toHaveLength(0);
    expect(stub.attempts).toHaveLength(0);
  });

  it("🔴 ORDER_TIME 인데 배송비 12,000원 — 거절한다(45885bf 가 잡은 그 자리)", async () => {
    const stub = makeSupabaseStub(new Set([...BASE_COLUMNS, ...COLUMNS_038, ...COLUMNS_054]));
    supabaseRef.current = stub;

    const result = await recordPriceObservations([
      domesticObservation({ shippingPolicyStatus: "ORDER_TIME", shippingCostAmount: 12000 }),
    ]);
    expect(result.ok).toBe(false);
    expect(stub.rows).toHaveLength(0);
  });

  it("FREE·FLAT 만 금액과 함께 저장된다 — FREE 는 0, FLAT 은 실측값", async () => {
    const stub = makeSupabaseStub(new Set([...BASE_COLUMNS, ...COLUMNS_038, ...COLUMNS_054]));
    supabaseRef.current = stub;

    const result = await recordPriceObservations([
      domesticObservation({ shippingPolicyStatus: "FREE" }),
      domesticObservation({ sourceRefId: "src-2", shippingPolicyStatus: "FLAT", shippingCostAmount: 3000 }),
    ]);

    expect(result).toEqual({ ok: true, count: 2 });
    expect(stub.rows[0]).toMatchObject({ shipping_policy_status: "FREE", shipping_cost_amount: 0 });
    expect(stub.rows[1]).toMatchObject({ shipping_policy_status: "FLAT", shipping_cost_amount: 3000 });
  });

  it("한 배치에 모순 행이 하나라도 있으면 «정상 행까지» 저장하지 않는다", async () => {
    const stub = makeSupabaseStub(new Set([...BASE_COLUMNS, ...COLUMNS_038, ...COLUMNS_054]));
    supabaseRef.current = stub;

    const result = await recordPriceObservations([
      domesticObservation({ shippingPolicyStatus: "FREE" }),
      domesticObservation({ sourceRefId: "src-2", shippingPolicyStatus: "CONDITIONAL_FREE", shippingCostAmount: 50000 }),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("관측 #2");
    expect(stub.rows).toHaveLength(0);
  });
});
