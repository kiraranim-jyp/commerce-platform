import { describe, expect, it } from "vitest";
import { computePriceTrend, type PriceObservationRecord } from "../price-history";

const NOW = new Date("2026-08-24T01:00:00.000Z");

function record(daysAgoFromNow: number, priceKrw: number): PriceObservationRecord {
  const checkedAt = new Date(NOW.getTime() - daysAgoFromNow * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `id-${daysAgoFromNow}`,
    snapshotId: "snap-1",
    source: "NAVER_SHOPPING",
    sourceLabel: null,
    sourceProductUrl: null,
    sourceRefId: null,
    currency: "KRW",
    priceAmount: priceKrw,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: null,
    priceKrw,
    checkedAt,
  };
}

describe("computePriceTrend", () => {
  it("관측치가 없으면 NEW, current도 null", () => {
    const trend = computePriceTrend([], 1, NOW);
    expect(trend.trend).toBe("NEW");
    expect(trend.current).toBeNull();
  });

  it("관측치가 1개뿐이면(비교할 과거 없음) NEW — UNCHANGED와 구분", () => {
    const trend = computePriceTrend([record(0, 129000)], 1, NOW);
    expect(trend.current).toBe(129000);
    expect(trend.trend).toBe("NEW");
    expect(trend.previous).toBeNull();
  });

  it("어제보다 가격이 내려갔으면 DOWN", () => {
    const records = [record(0, 119000), record(1, 129000)];
    const trend = computePriceTrend(records, 1, NOW);
    expect(trend.current).toBe(119000);
    expect(trend.previous).toBe(129000);
    expect(trend.change).toBe(-10000);
    expect(trend.trend).toBe("DOWN");
  });

  it("어제보다 가격이 올라갔으면 UP", () => {
    const records = [record(0, 139000), record(1, 129000)];
    const trend = computePriceTrend(records, 1, NOW);
    expect(trend.trend).toBe("UP");
  });

  it("가격 변화가 없으면 UNCHANGED", () => {
    const records = [record(0, 129000), record(1, 129000)];
    const trend = computePriceTrend(records, 1, NOW);
    expect(trend.trend).toBe("UNCHANGED");
  });

  it("7일전 기준 — 정확히 7일 전 관측치가 없어도 그 이전 중 가장 최근 값을 쓴다", () => {
    const records = [record(0, 110000), record(3, 120000), record(10, 150000)];
    const trend = computePriceTrend(records, 7, NOW);
    // 7일 전 시점(now-7d) 이하인 관측치 중 최신 = 10일전(150000). 3일전은 7일전보다 최근이라 제외.
    expect(trend.current).toBe(110000);
    expect(trend.previous).toBe(150000);
  });

  it("30일전 기준으로도 동작한다", () => {
    const records = [record(0, 100000), record(35, 140000)];
    const trend = computePriceTrend(records, 30, NOW);
    expect(trend.previous).toBe(140000);
    expect(trend.trend).toBe("DOWN");
  });
});
