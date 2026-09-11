import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  summarizeFrom,
  DOMESTIC_ANALYSIS_MARKET_COUNTRY,
  type PriceObservationRecord,
} from "@commerce/pricing";
import type { ShopifyMarketProbeResult } from "@commerce/crawler";

/**
 * GLOBAL-MARKET ③(CPO 지시, 2026-09-11) — 화면에서만 보이던 추가 시장 가격이
 * 실제로 DB(price_observations)에 저장되는지를 고정한다.
 *
 * 실측(Bobo Choses B226AC043, 2026-09-11): 같은 상품이 /en-kr ₩162,000 ·
 * /en-de €75.00 · /en-int €84.00 · 루트 €75.00로 서로 다른 값을 내고,
 * /meta.json은 country=ES다. €75(DE)와 €84(INT)는 통화까지 같으므로
 * "통화가 같으면 같은 시장"이 성립하지 않는다는 근거이기도 하다.
 *
 * 여기서 검증하는 계약:
 *   A) 시장이 셋이어도 판매처(Source)는 하나다.
 *   B) 시장별 가격은 절대 섞이지 않는다(옛 혼합값 117,000/136,667이 안 나온다).
 *   C) 분석 시장이 KR이면 KR 관측만 가격 판단을 만든다.
 *   D) market_code의 NULL/""는 "시장 미확인"으로 남는다 — 국가로 채우지 않는다.
 *   E) 같은 날 재실행해도 source+market_code가 중복 저장되지 않는다.
 *   F) 추가 시장이 없는(또는 Shopify가 아닌) 기존 상품은 예전과 완전히 동일하다.
 */

const RATES = vi.hoisted(() => ({
  // 실측 환산 비교를 단순하게 하려고 고정한 환율(1 EUR = ₩1,560).
  // €75 → ₩117,000, €84 → ₩131,040 — 둘이 서로 다른 값이라는 점이 핵심이다.
  EUR: 1560,
  GBP: 1887,
}));

const crawler = vi.hoisted(() => ({
  probeOriginAndKrMarkets: vi.fn(),
  probeAdditionalMarkets: vi.fn(),
}));

const supabaseRef = vi.hoisted(() => ({ current: null as ReturnType<typeof makeSupabaseStub> | null }));

vi.mock("@commerce/crawler", () => crawler);
vi.mock("@/lib/exchange-rates", () => ({
  fetchLiveExchangeRates: async () => ({ rates: RATES, isEstimate: false }),
}));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => supabaseRef.current,
}));

const { runPriceCheck, buildAdditionalMarketObservations } = await import("../run-price-check");
const { MARKET_PROBE_SOURCE_LABEL, isCostBasisOriginObservation, normalizeMarketKey } = await import(
  "../price-observations"
);

/** price_observations 한 테이블만 흉내내는 최소 Supabase 스텁. insert는 실제로
 * 행을 쌓고, select+eq/gte 필터도 실제로 적용한다 — 멱등성(E)을 "쿼리 결과"가
 * 아니라 "실제 쌓인 행"으로 검증하기 위함이다. */
function makeSupabaseStub() {
  const rows: Array<Record<string, unknown>> = [];

  function builder() {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let pending: Array<Record<string, unknown>> | null = null;
    let take = Number.POSITIVE_INFINITY;

    const chain = {
      insert: (payload: Array<Record<string, unknown>>) => {
        pending = payload;
        return chain;
      },
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters.push((row) => row[col] === val);
        return chain;
      },
      gte: (col: string, val: string) => {
        filters.push((row) => String(row[col]) >= val);
        return chain;
      },
      limit: (n: number) => {
        take = n;
        return chain;
      },
      then: (resolve: (value: { data: unknown; error: null; count: number }) => unknown) => {
        if (pending) {
          for (const row of pending) {
            rows.push({ id: `row-${rows.length + 1}`, checked_at: new Date().toISOString(), ...row });
          }
          return resolve({ data: null, error: null, count: pending.length });
        }
        const data = rows.filter((row) => filters.every((f) => f(row))).slice(0, take);
        return resolve({ data, error: null, count: data.length });
      },
    };
    return chain;
  }

  return { from: () => builder(), rows };
}

const BOBO = "https://bobochoses.com";
const HANDLE = "b226ac043";
/** 실측 /meta.json — 모든 시장에서 country=ES다(= "판매처가 선언한 국가"이지
 * "그 시장의 국가"가 아니다). */
const SHOP_META = { name: "Bobo Choses", country: "ES", currency: "EUR" };

function probe(marketCode: string, amount: number, currency: string): ShopifyMarketProbeResult {
  const prefix = marketCode ? `/${marketCode}` : "";
  return {
    marketCode,
    amount,
    currency,
    sourceUrl: `${BOBO}${prefix}/products/${HANDLE}.json`,
    shopMeta: SHOP_META,
    regularPrice: null,
    available: true,
  };
}

const BOBO_ORIGIN = probe("", 75, "EUR");
const BOBO_KR = probe("en-kr", 162000, "KRW");
const BOBO_DE = probe("en-de", 75, "EUR");
const BOBO_INT = probe("en-int", 84, "EUR");

const SNAPSHOT = "snap-bobo";

function baseInput() {
  return {
    snapshotId: SNAPSHOT,
    sourceUrl: `${BOBO}/products/${HANDLE}`,
    originalPriceAmount: 75,
    originalCurrency: "EUR",
  };
}

/** 저장된 행을 집계가 읽는 형태(PriceObservationRecord)로 되돌린다 — 화면/판정이
 * 실제로 보게 될 값 그대로 검증하기 위함(새 변환 규칙을 만들지 않는다). */
function toRecords(rows: Array<Record<string, unknown>>): PriceObservationRecord[] {
  return rows.map((row, index) => ({
    id: String(row.id ?? index),
    snapshotId: String(row.snapshot_id),
    source: row.source as PriceObservationRecord["source"],
    sourceLabel: (row.source_label as string | null) ?? null,
    sourceProductUrl: (row.source_product_url as string | null) ?? null,
    sourceRefId: (row.source_ref_id as string | null) ?? null,
    currency: String(row.currency),
    priceAmount: (row.price_amount as number | null) ?? null,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: (row.exchange_rate as number | null) ?? null,
    priceKrw: (row.price_krw as number | null) ?? null,
    salePriceKrw: (row.sale_price_krw as number | null) ?? null,
    originalPriceKrw: (row.original_price_krw as number | null) ?? null,
    soldOut: (row.sold_out as boolean | null) ?? null,
    marketCode: (row.market_code as string | null) ?? null,
    marketCountry: (row.market_country as string | null) ?? null,
    checkedAt: String(row.checked_at),
  }));
}

beforeEach(() => {
  supabaseRef.current = makeSupabaseStub();
  crawler.probeOriginAndKrMarkets.mockReset();
  crawler.probeAdditionalMarkets.mockReset();
  crawler.probeOriginAndKrMarkets.mockResolvedValue({ origin: BOBO_ORIGIN, kr: BOBO_KR });
  crawler.probeAdditionalMarkets.mockResolvedValue([BOBO_DE, BOBO_INT]);
});

describe("GLOBAL-MARKET ③ — 추가 시장 관측이 실제로 저장된다", () => {
  it("Bobo Choses 한 상품이 SELLER_ORIGIN 3행(en-kr/en-de/en-int)으로 저장된다", async () => {
    const result = await runPriceCheck(baseInput());
    expect(result.status).toBe("SUCCESS");

    const rows = supabaseRef.current!.rows;
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.source))).toEqual(new Set(["SELLER_ORIGIN"]));

    const byMarket = new Map(rows.map((r) => [r.market_code, r]));
    expect([...byMarket.keys()].sort()).toEqual(["en-de", "en-int", "en-kr"]);
    // 실측값이 그대로 들어간다(원문 통화/금액은 건드리지 않는다).
    expect(byMarket.get("en-kr")).toMatchObject({ currency: "KRW", price_amount: 162000, price_krw: 162000 });
    expect(byMarket.get("en-de")).toMatchObject({ currency: "EUR", price_amount: 75, price_krw: 117000 });
    expect(byMarket.get("en-int")).toMatchObject({ currency: "EUR", price_amount: 84, price_krw: 131040 });

    // 확장 조회는 이미 확인한 두 시장을 다시 찌르지 않는다.
    expect(crawler.probeAdditionalMarkets).toHaveBeenCalledWith(baseInput().sourceUrl, ["", "en-kr"]);
  });

  it("A) sellerCount === 1 — 시장이 셋이어도 판매처는 Bobo Choses 한 곳이다", async () => {
    await runPriceCheck(baseInput());
    const summary = summarizeFrom(toRecords(supabaseRef.current!.rows), "PRIMARY", {
      analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY,
    });
    expect(summary.sellerCount).toBe(1);
    expect(summary.sellers).toHaveLength(1);
    expect(summary.sellers[0].markets).toHaveLength(3);
  });

  it("B) DE €75 / INT €84 / KR ₩162,000은 절대 섞이지 않는다 — 옛 혼합값이 나오지 않는다", async () => {
    await runPriceCheck(baseInput());
    const summary = summarizeFrom(toRecords(supabaseRef.current!.rows), "PRIMARY", {
      analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY,
    });
    const byCode = new Map(summary.markets.map((m) => [m.marketCode, m]));
    expect(summary.markets).toHaveLength(3);
    expect(byCode.get("en-kr")!.lowestPriceKrw).toBe(162000);
    expect(byCode.get("en-de")!.lowestPriceKrw).toBe(117000);
    expect(byCode.get("en-int")!.lowestPriceKrw).toBe(131040);
    // DE 시장에 KR/INT가 흘러들어갔다면 최고가/평균이 달라졌을 것이다.
    expect(byCode.get("en-de")!.highestPriceKrw).toBe(117000);
    expect(byCode.get("en-de")!.averagePriceKrw).toBe(117000);
    // 예전 뭉개진 집계가 내던 값들(min=117,000, 평균=136,667)이 어디에도 없다.
    expect(summary.lowestPriceKrw).not.toBe(117000);
    expect(summary.averagePriceKrw).not.toBe(136667);
    expect(summary.markets.map((m) => m.averagePriceKrw)).not.toContain(136667);
  });

  it("C) 분석 시장이 KR이면 KR 관측(₩162,000)만 가격 판단을 만든다", async () => {
    await runPriceCheck(baseInput());
    const summary = summarizeFrom(toRecords(supabaseRef.current!.rows), "PRIMARY", {
      analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY,
    });
    expect(summary.priceMarketBasis).toBe("ANALYSIS");
    expect(summary.priceMarketCode).toBe("en-kr");
    expect(summary.lowestPriceKrw).toBe(162000);
    expect(summary.averagePriceKrw).toBe(162000);
    expect(summary.highestPriceKrw).toBe(162000);
    expect(summary.sampleListings).toHaveLength(1);
  });

  it("C-2) 원가 판단은 여전히 KR_MARKET 관측 1건이다 — 추가 시장 행은 원가로 읽히지 않는다", async () => {
    await runPriceCheck(baseInput());
    const records = toRecords(supabaseRef.current!.rows);
    // market-intelligence/compute-readiness/brand-market이 쓰는 필터 그대로.
    const costBasisRecords = records.filter(isCostBasisOriginObservation);
    expect(costBasisRecords).toHaveLength(1);
    expect(costBasisRecords[0].sourceLabel).toBe("KR_MARKET");
    expect(costBasisRecords[0].priceKrw).toBe(162000);
    // 필터가 없었다면 €84(₩131,040) 행이 원가가 될 수 있었다.
    expect(records.some((r) => r.priceKrw === 131040)).toBe(true);
  });

  it("D) market_code의 NULL과 \"\"는 시장 미확인으로 남는다 — 국가로 채우지 않는다", async () => {
    // 추가 시장 probe가 로케일 없는 기본 요청("")을 돌려줘도 추가 시장으로
    // 저장하지 않는다 — 저장하면 origin 관측과 구분이 불가능해진다.
    crawler.probeAdditionalMarkets.mockResolvedValue([probe("", 75, "EUR"), BOBO_DE]);
    await runPriceCheck(baseInput());
    const marketCodes = supabaseRef.current!.rows.map((r) => r.market_code);
    expect(marketCodes).toEqual(["en-kr", "en-de"]);

    // NULL/""가 섞인 관측은 한 그룹("시장 미확인")으로만 묶이고 국가가 생기지 않는다.
    const built = buildAdditionalMarketObservations({
      snapshotId: SNAPSHOT,
      probes: [probe("", 75, "EUR"), probe("   ", 75, "EUR")],
      rates: RATES,
      alreadyRecordedMarketKeys: new Set<string>(),
    });
    expect(built.observations).toHaveLength(0);
    expect(normalizeMarketKey(null)).toBe("");
    expect(normalizeMarketKey("")).toBe("");
    expect(normalizeMarketKey("  ")).toBe("");

    const unknownMarket = summarizeFrom(
      [
        {
          ...toRecords(supabaseRef.current!.rows)[0],
          id: "null-market",
          marketCode: null,
          marketCountry: null,
          sourceProductUrl: "https://a.example/p",
          priceKrw: 30000,
        },
        {
          ...toRecords(supabaseRef.current!.rows)[0],
          id: "empty-market",
          marketCode: "",
          marketCountry: null,
          sourceProductUrl: "https://b.example/p",
          priceKrw: 20000,
        },
      ],
      "PRIMARY",
      { analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY },
    );
    expect(unknownMarket.markets).toHaveLength(1);
    expect(unknownMarket.markets[0].marketCode).toBeNull();
    expect(unknownMarket.markets[0].marketCountry).toBeNull();
    // 실제 시장으로 승격되지 않는다 — 판단 근거는 "시장이 하나뿐"(SINGLE)이다.
    expect(unknownMarket.priceMarketBasis).toBe("SINGLE");
    expect(unknownMarket.priceMarketCode).toBeNull();
  });

  it("D-2) market_country는 /meta.json이 선언한 값만 쓴다 — en-int는 어떤 국가도 되지 않는다", async () => {
    await runPriceCheck(baseInput());
    const rows = supabaseRef.current!.rows;
    // Bobo는 모든 시장에서 country=ES를 선언한다 — DE 시장이라고 "DE"로 적지 않는다.
    expect(rows.map((r) => r.market_country)).toEqual(["ES", "ES", "ES"]);

    // 선언이 없으면 null이다(통화 EUR에서 국가를 지어내지 않는다).
    const noMeta = buildAdditionalMarketObservations({
      snapshotId: SNAPSHOT,
      probes: [{ ...BOBO_DE, shopMeta: null }],
      rates: RATES,
      alreadyRecordedMarketKeys: new Set<string>(),
    });
    expect(noMeta.observations[0].marketCountry).toBeNull();
    expect(noMeta.observations[0].marketCode).toBe("en-de");

    // en-int는 저장에서도 집계에서도 국가가 생기지 않는다.
    const intRow = rows.find((r) => r.market_code === "en-int")!;
    expect(intRow.market_country).toBe("ES"); // 판매처 선언 국가일 뿐, "INT 국가"가 아니다
    const summary = summarizeFrom(toRecords(rows), "PRIMARY", { analysisMarketCountry: "INT" });
    // "INT"라는 국가는 없으므로 판단 시장을 고르지 못한다 — 아무 시장이나 고르지 않는다.
    expect(summary.priceMarketBasis).toBe("UNRESOLVED");
    expect(summary.priceMarketCode).toBeNull();
  });

  it("E) 같은 날 재실행해도 snapshot+source+market_code가 중복 저장되지 않는다", async () => {
    await runPriceCheck(baseInput());
    expect(supabaseRef.current!.rows).toHaveLength(3);

    // cron 재실행(skipIfCheckedToday) — 기존대로 아무것도 추가하지 않는다.
    const cron = await runPriceCheck({ ...baseInput(), skipIfCheckedToday: true });
    expect(cron.savedCount).toBe(0);
    expect(supabaseRef.current!.rows).toHaveLength(3);

    // 수동 "지금 확인" 재실행 — 원가 관측은 기존 동작대로 시계열로 한 번 더
    // 쌓이지만, 추가 시장(en-de/en-int)은 오늘 이미 저장돼 있으므로 다시
    // 쌓이지 않는다(시장당 하루 한 행).
    await runPriceCheck(baseInput());
    const rows = supabaseRef.current!.rows;
    const marketProbeRows = rows.filter((r) => r.source_label === MARKET_PROBE_SOURCE_LABEL);
    expect(marketProbeRows.map((r) => r.market_code).sort()).toEqual(["en-de", "en-int"]);

    const dedupeKey = (r: Record<string, unknown>) => `${r.source}|${r.market_code}`;
    const marketProbeKeys = marketProbeRows.map(dedupeKey);
    expect(new Set(marketProbeKeys).size).toBe(marketProbeKeys.length);
  });

  it("E-2) 같은 실행 안에서도 en-kr은 두 번 저장되지 않는다(KR_MARKET 관측과 중복)", async () => {
    // 확장 조회가 어떤 이유로 en-kr을 되돌려줘도(제외 목록이 무시된 경우)
    // 이미 담긴 시장이므로 버린다.
    crawler.probeAdditionalMarkets.mockResolvedValue([BOBO_KR, BOBO_DE]);
    await runPriceCheck(baseInput());
    const rows = supabaseRef.current!.rows;
    expect(rows.filter((r) => r.market_code === "en-kr")).toHaveLength(1);
    expect(rows.filter((r) => r.market_code === "en-kr")[0].source_label).toBe("KR_MARKET");
    expect(rows.map((r) => r.market_code)).toEqual(["en-kr", "en-de"]);
  });

  it("F) 추가 시장이 없는 상품은 예전과 완전히 동일하게 1행만 저장된다", async () => {
    crawler.probeAdditionalMarkets.mockResolvedValue([]);
    const result = await runPriceCheck(baseInput());
    expect(result.status).toBe("SUCCESS");
    const rows = supabaseRef.current!.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "SELLER_ORIGIN",
      source_label: "KR_MARKET",
      market_code: "en-kr",
      price_krw: 162000,
    });
  });

  it("F-2) Shopify가 아닌 상품(probe 실패)은 확장 조회 자체를 하지 않고 예전 동작 그대로다", async () => {
    crawler.probeOriginAndKrMarkets.mockResolvedValue(null);
    const result = await runPriceCheck({
      snapshotId: SNAPSHOT,
      sourceUrl: "https://not-shopify.example/product/1",
      originalPriceAmount: 120,
      originalCurrency: "GBP",
    });
    expect(result.status).toBe("SUCCESS");
    expect(crawler.probeAdditionalMarkets).not.toHaveBeenCalled();
    const rows = supabaseRef.current!.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source_label: "ORIGIN_FX",
      currency: "GBP",
      price_amount: 120,
      market_code: null,
      market_country: null,
      source_product_url: null,
    });
  });

  it("F-3) 확장 조회가 실패해도 기존 원가 저장은 그대로 성공한다", async () => {
    crawler.probeAdditionalMarkets.mockRejectedValue(new Error("network"));
    const result = await runPriceCheck(baseInput());
    expect(result.status).toBe("SUCCESS");
    expect(supabaseRef.current!.rows).toHaveLength(1);
    expect(supabaseRef.current!.rows[0].source_label).toBe("KR_MARKET");
  });

  it("환율을 모르는 통화의 시장은 값을 지어내지 않고 건너뛴다(사유는 errors에 남는다)", () => {
    const built = buildAdditionalMarketObservations({
      snapshotId: SNAPSHOT,
      probes: [probe("en-zz", 499, "ZZZ"), BOBO_DE],
      rates: RATES,
      alreadyRecordedMarketKeys: new Set<string>(),
    });
    expect(built.observations.map((o) => o.marketCode)).toEqual(["en-de"]);
    expect(built.errors[0]).toContain("환율 정보 없음(ZZZ)");
  });

  it("isCostBasisOriginObservation — 과거 관측(sourceLabel=null)과 KR_MARKET/ORIGIN_FX는 원가 근거로 남는다", () => {
    expect(isCostBasisOriginObservation({ sourceLabel: null })).toBe(true);
    expect(isCostBasisOriginObservation({ sourceLabel: "KR_MARKET" })).toBe(true);
    expect(isCostBasisOriginObservation({ sourceLabel: "ORIGIN_FX" })).toBe(true);
    expect(isCostBasisOriginObservation({ sourceLabel: MARKET_PROBE_SOURCE_LABEL })).toBe(false);
  });
});
