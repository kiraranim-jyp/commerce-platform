import { describe, expect, it } from "vitest";
import { summarizeFrom, type PriceObservationRecord } from "../price-history";

/**
 * MI-STOCK-CLARITY-1(CPO 지시, 2026-09-10).
 *
 * 지키는 불변조건: **`soldOut = null`을 판매중으로 부르지 않는다.**
 *
 * soldOut은 세 상태다 — true=품절 확인, false=판매중 확인, null=재고를 확인할
 * 방법이 없음. 그런데 국내 자동검색 6곳 중 재고 판정이 구현된 곳은 2곳뿐이라
 * null이 예외가 아니라 기본값이고, 집계 필터가 `soldOut !== true`라 null이
 * 판매중과 함께 최저가/평균가에 들어간다.
 *
 * CPO 결정은 C안이다 — 계산 방식은 그대로 두고(B안처럼 null을 빼면 사이트별
 * 재고 판정 구현 수준이 곧 가격 모집단이 된다) 확인되지 않았다는 사실만 별도로
 * 드러낸다. 그래서 이 테스트는 두 가지를 동시에 지킨다:
 *   ① 가격 계산 결과가 바뀌지 않는다
 *   ② 재고 상태가 셋으로 분리돼 나온다
 */
const rec = (priceKrw: number, soldOut: boolean | null | undefined, mall = "샵"): PriceObservationRecord =>
  ({
    priceKrw,
    soldOut,
    checkedAt: "2026-09-10T00:00:00.000Z",
    sourceLabel: mall,
    sourceProductUrl: `https://${encodeURIComponent(mall)}.example.com/p`,
    salePriceKrw: null,
    originalPriceKrw: null,
    source: "DOMESTIC_SHOP",
  }) as unknown as PriceObservationRecord;

describe("재고 3분류를 계산에 들어간 리스팅 기준으로 센다", () => {
  it("핵심 회귀: null은 unknown으로 세고 onSale에 넣지 않는다", () => {
    const s = summarizeFrom([rec(10000, false), rec(20000, null), rec(30000, undefined)], "PRIMARY");
    expect(s.stockCounts).toEqual({ onSale: 1, unknown: 2, soldOut: 0 });
  });

  it("품절은 계산에서 빠지고 soldOut으로만 잡힌다", () => {
    const s = summarizeFrom([rec(10000, false), rec(5000, true)], "PRIMARY");
    expect(s.stockCounts).toEqual({ onSale: 1, unknown: 0, soldOut: 1 });
    // 5,000원짜리 품절이 최저가가 되면 안 된다(기존 정책).
    expect(s.lowestPriceKrw).toBe(10000);
  });

  it("핵심 회귀: 재고 불명이 섞여도 가격 계산 결과는 그대로다(C안 — B로 바꾸지 않음)", () => {
    // 재고 불명(8,000원)이 최저가가 되고 판매처로도 세어진다 — 계산에서 빼지 않는다.
    const withUnknown = summarizeFrom([rec(10000, false, "A샵"), rec(8000, null, "B샵")], "PRIMARY");
    expect(withUnknown.lowestPriceKrw).toBe(8000);
    expect(withUnknown.sellerCount).toBe(2);
    expect(withUnknown.stockCounts.unknown).toBe(1);
  });

  it("가격이 없는 행은 어느 분류에도 들어가지 않는다", () => {
    const s = summarizeFrom([rec(10000, false), { ...rec(0, null), priceKrw: null } as PriceObservationRecord], "PRIMARY");
    expect(s.stockCounts).toEqual({ onSale: 1, unknown: 0, soldOut: 0 });
  });

  it("전부 품절이면 가격이 없고 soldOut만 남는다", () => {
    const s = summarizeFrom([rec(10000, true), rec(20000, true)], "PRIMARY");
    expect(s.lowestPriceKrw).toBeNull();
    expect(s.stockCounts).toEqual({ onSale: 0, unknown: 0, soldOut: 2 });
  });
});
