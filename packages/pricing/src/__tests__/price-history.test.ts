import { describe, expect, it } from "vitest";
import { summarizeDomesticMarket, computePriceChange, type PriceObservationRecord } from "../price-history";

function record(overrides: Partial<PriceObservationRecord>): PriceObservationRecord {
  return {
    id: "id-1",
    snapshotId: "snap-1",
    source: "NAVER_SHOPPING",
    sourceLabel: null,
    sourceProductUrl: null,
    sourceRefId: null,
    currency: "KRW",
    priceAmount: 10000,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: null,
    priceKrw: 10000,
    checkedAt: "2026-08-23T01:00:00.000Z",
    ...overrides,
  };
}

describe("summarizeDomesticMarket", () => {
  it("리스팅이 없으면 null 필드로 정직하게 남긴다(0원을 지어내지 않는다)", () => {
    const summary = summarizeDomesticMarket([]);
    expect(summary.lowestPriceKrw).toBeNull();
    expect(summary.highestPriceKrw).toBeNull();
    expect(summary.averagePriceKrw).toBeNull();
    expect(summary.sellerCount).toBe(0);
  });

  it("SELLER_ORIGIN 소스는 국내 시장 요약에서 제외한다", () => {
    const records = [
      record({ id: "a", source: "SELLER_ORIGIN", priceKrw: 50000 }),
      record({ id: "b", source: "NAVER_SHOPPING", priceKrw: 20000 }),
    ];
    const summary = summarizeDomesticMarket(records);
    expect(summary.sellerCount).toBe(1);
    expect(summary.lowestPriceKrw).toBe(20000);
  });

  it("최저/최고/평균가를 정확히 계산한다(NAVER_SHOPPING만 있으면 SECONDARY)", () => {
    const records = [
      record({ id: "a", priceKrw: 30000, sourceLabel: "A몰" }),
      record({ id: "b", priceKrw: 20000, sourceLabel: "B몰" }),
      record({ id: "c", priceKrw: 40000, sourceLabel: "C몰" }),
    ];
    const summary = summarizeDomesticMarket(records);
    expect(summary.tier).toBe("SECONDARY");
    expect(summary.lowestPriceKrw).toBe(20000);
    expect(summary.highestPriceKrw).toBe(40000);
    expect(summary.averagePriceKrw).toBe(30000);
    expect(summary.sellerCount).toBe(3);
    expect(summary.sampleListings[0].mallName).toBe("B몰"); // 최저가 순 정렬
  });

  it("N-4.06 — DOMESTIC_SHOP이 있으면 PRIMARY이고 NAVER_SHOPPING은 무시한다(검증 안 된 후보를 확정가에 섞지 않는다)", () => {
    const records = [
      record({ id: "a", source: "NAVER_SHOPPING", priceKrw: 10000, sourceLabel: "검증안됨" }),
      record({ id: "b", source: "DOMESTIC_SHOP", priceKrw: 189000, sourceLabel: "편집샵A", sourceRefId: "shop-1" }),
    ];
    const summary = summarizeDomesticMarket(records);
    expect(summary.tier).toBe("PRIMARY");
    expect(summary.sellerCount).toBe(1);
    expect(summary.lowestPriceKrw).toBe(189000);
  });

  it("아무 소스도 없으면 tier는 NONE", () => {
    expect(summarizeDomesticMarket([]).tier).toBe("NONE");
  });
});

describe("computePriceChange", () => {
  it("관측치가 1개뿐이면 비교 불가(null) — 어제 데이터가 없는데 변화율을 지어내지 않는다", () => {
    expect(computePriceChange([record({ priceKrw: 10000 })])).toBeNull();
    expect(computePriceChange([])).toBeNull();
  });

  it("가장 최근 2개 관측치의 차액/변화율을 계산한다", () => {
    const records = [
      record({ id: "old", priceKrw: 189000, checkedAt: "2026-08-22T16:00:00.000Z" }),
      record({ id: "new", priceKrw: 179000, checkedAt: "2026-08-23T16:00:00.000Z" }),
    ];
    const change = computePriceChange(records);
    expect(change).not.toBeNull();
    expect(change!.oldPriceKrw).toBe(189000);
    expect(change!.newPriceKrw).toBe(179000);
    expect(change!.changeAmountKrw).toBe(-10000);
    expect(change!.changeRatePercent).toBeCloseTo(-5.29, 1);
  });

  it("3개 이상이어도 가장 최근 2개만 비교한다(전전일과 비교하지 않는다)", () => {
    const records = [
      record({ id: "oldest", priceKrw: 200000, checkedAt: "2026-08-21T16:00:00.000Z" }),
      record({ id: "old", priceKrw: 189000, checkedAt: "2026-08-22T16:00:00.000Z" }),
      record({ id: "new", priceKrw: 179000, checkedAt: "2026-08-23T16:00:00.000Z" }),
    ];
    const change = computePriceChange(records);
    expect(change!.oldPriceKrw).toBe(189000);
    expect(change!.newPriceKrw).toBe(179000);
  });
});
