import { describe, expect, it } from "vitest";
import {
  summarizeDomesticMarket,
  summarizeDomesticMarketSplit,
  summarizeFrom,
  computePriceChange,
  computePriceTrend,
  type PriceObservationRecord,
} from "../price-history";

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
    salePriceKrw: null,
    originalPriceKrw: null,
    soldOut: null,
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

  it("N-4.18-G STEP G-4: soldOut===true인 리스팅은 최저/평균/최고가 계산에서 제외하고 soldOutListings로 따로 담는다", () => {
    const records = [
      record({ id: "a", source: "DOMESTIC_SHOP", priceKrw: 20000, sourceLabel: "판매중몰", soldOut: false }),
      record({ id: "b", source: "DOMESTIC_SHOP", priceKrw: 5000, sourceLabel: "품절몰", soldOut: true }),
    ];
    const summary = summarizeDomesticMarket(records);
    expect(summary.sellerCount).toBe(1);
    expect(summary.lowestPriceKrw).toBe(20000); // 품절(5000원)이 포함됐다면 5000이 나왔을 것
    expect(summary.soldOutListings).toHaveLength(1);
    expect(summary.soldOutListings[0].mallName).toBe("품절몰");
  });

  it("N-4.18-G STEP G-4: soldOut===null(그 사이트 품절 감지 미구현)은 기존과 동일하게 가격 계산에 포함한다 — 회귀 없음", () => {
    const records = [
      record({ id: "a", source: "DOMESTIC_SHOP", priceKrw: 30000, sourceLabel: "A몰", soldOut: null }),
      record({ id: "b", source: "DOMESTIC_SHOP", priceKrw: 20000, sourceLabel: "B몰", soldOut: null }),
    ];
    const summary = summarizeDomesticMarket(records);
    expect(summary.sellerCount).toBe(2);
    expect(summary.lowestPriceKrw).toBe(20000);
    expect(summary.soldOutListings).toHaveLength(0);
  });

  it("N-4.18-G STEP G-4: 전량 품절이면 가격 필드는 null(0원을 지어내지 않는다), soldOutListings에는 남는다", () => {
    const records = [record({ id: "a", source: "DOMESTIC_SHOP", priceKrw: 5000, sourceLabel: "품절몰", soldOut: true })];
    const summary = summarizeDomesticMarket(records);
    expect(summary.sellerCount).toBe(0);
    expect(summary.lowestPriceKrw).toBeNull();
    expect(summary.soldOutListings).toHaveLength(1);
  });

  it("N-4.18-Q3 PART E-1: price=null + soldOut=true(완전 품절, 가격 자체가 없음)도 soldOutListings에 담기고 가격 계산에서 제외된다", () => {
    const records = [
      record({ id: "a", source: "DOMESTIC_SHOP", priceKrw: 20000, priceAmount: 20000, sourceLabel: "판매중몰", soldOut: false }),
      record({
        id: "b",
        source: "DOMESTIC_SHOP",
        priceKrw: null,
        priceAmount: null,
        sourceLabel: "완전품절몰",
        soldOut: true,
      }),
    ];
    const summary = summarizeDomesticMarket(records);
    expect(summary.sellerCount).toBe(1);
    expect(summary.lowestPriceKrw).toBe(20000);
    expect(summary.soldOutListings).toHaveLength(1);
    expect(summary.soldOutListings[0].mallName).toBe("완전품절몰");
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

  it("N-4.18-Q3 PART E-1: priceKrw=null(완전 품절) 관측치는 가격 변화 비교에서 제외한다", () => {
    const records = [
      record({ id: "priced-old", priceKrw: 189000, checkedAt: "2026-08-21T16:00:00.000Z" }),
      record({ id: "soldout", priceKrw: null, checkedAt: "2026-08-22T16:00:00.000Z", soldOut: true }),
      record({ id: "priced-new", priceKrw: 179000, checkedAt: "2026-08-23T16:00:00.000Z" }),
    ];
    const change = computePriceChange(records);
    // soldout(가격 null) 관측치를 건너뛰고 실제 가격이 있는 두 관측치끼리만 비교한다.
    expect(change!.oldPriceKrw).toBe(189000);
    expect(change!.newPriceKrw).toBe(179000);
  });
});

describe("computePriceTrend", () => {
  it("N-4.18-Q3 PART E-1: 최신 관측치가 priceKrw=null(완전 품절)이면 그 이전의 실제 가격을 current로 쓴다", () => {
    const records = [
      record({ id: "priced", priceKrw: 179000, checkedAt: "2026-08-20T16:00:00.000Z" }),
      record({ id: "soldout", priceKrw: null, checkedAt: "2026-08-23T16:00:00.000Z", soldOut: true }),
    ];
    const trend = computePriceTrend(records, 0);
    expect(trend.current).toBe(179000);
  });
});

/**
 * P-19-B Sprint 7/10(CPO 지시, 2026-09-02) — "동일상품 가격"과 "비교상품 시장가격"을
 * 완전히 분리된 두 버킷으로 집계하고, 우선순위(1순위 동일상품가격, 없으면 2순위
 * 비교상품 시장가격, 둘 다 없으면 시장 데이터 부족)를 정확히 지킨다. T5/T6/T7에
 * 해당한다. 어떻게 두 배열로 나누는지는 호출부(market-intelligence.ts)의 책임이라
 * 여기서는 이미 나뉜 배열만 받는다.
 */
describe("summarizeDomesticMarketSplit", () => {
  it("T5) 동일상품 가격 + 비교상품 가격 동시 존재 → 동일상품 가격 우선(basis=EXACT)", () => {
    const exact = [record({ id: "e1", priceKrw: 89000 })];
    const comparison = [record({ id: "c1", priceKrw: 79000 }), record({ id: "c2", priceKrw: 109000 })];
    const split = summarizeDomesticMarketSplit(exact, comparison);
    expect(split.basis).toBe("EXACT");
    expect(split.resolved.lowestPriceKrw).toBe(89000);
    expect(split.exact.sellerCount).toBe(1);
    expect(split.comparison.sellerCount).toBe(2);
  });

  it("T6) 비교상품만 존재 → 시장 참고가격 사용(basis=COMPARISON), 동일상품 가격으로 표시하지 않는다", () => {
    const split = summarizeDomesticMarketSplit(
      [],
      [record({ id: "c1", priceKrw: 79000 }), record({ id: "c2", priceKrw: 109000 })],
    );
    expect(split.basis).toBe("COMPARISON");
    expect(split.resolved.lowestPriceKrw).toBe(79000);
    expect(split.exact.sellerCount).toBe(0);
  });

  it("T7) 매칭 데이터 없음(둘 다 빈 배열) → 시장 데이터 부족(basis=NONE)", () => {
    const split = summarizeDomesticMarketSplit([], []);
    expect(split.basis).toBe("NONE");
    expect(split.resolved.sellerCount).toBe(0);
    expect(split.resolved.lowestPriceKrw).toBeNull();
  });
});

/**
 * P-21(CPO 지시, 2026-09-02) — sellerCount는 "가격 관측 횟수"가 아니라 "실제
 * 판매처 수"여야 한다. CPO 실측 사례: PèPè의 포레포레가 두 시점에 관측돼
 * observation 2개가 쌓였는데도 sellerCount는 계속 1이어야 한다.
 */
describe("summarizeFrom — sellerCount는 observation 수가 아니라 unique 판매처 수", () => {
  it("T1) 동일 판매처(같은 URL 호스트) 여러 observation → sellerCount = 1", () => {
    const records = [
      record({ id: "o1", priceKrw: 258000, sourceLabel: "포레포레", sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", checkedAt: "2026-09-02T02:44:34.000Z" }),
      record({ id: "o2", priceKrw: 258000, sourceLabel: "포레포레", sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", checkedAt: "2026-09-02T03:16:14.000Z" }),
      record({ id: "o3", priceKrw: 258000, sourceLabel: "포레포레", sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", checkedAt: "2026-09-01T01:00:00.000Z" }),
    ];
    const summary = summarizeFrom(records, "PRIMARY");
    expect(summary.sellerCount).toBe(1);
  });

  it("T2) 서로 다른 판매처(다른 호스트) → sellerCount = 2", () => {
    const records = [
      record({ id: "o1", priceKrw: 258000, sourceLabel: "포레포레", sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592" }),
      record({ id: "o2", priceKrw: 234900, sourceLabel: "듀베베", sourceProductUrl: "https://www.deuxbebe.com/product/detail.html?product_no=8021" }),
    ];
    const summary = summarizeFrom(records, "PRIMARY");
    expect(summary.sellerCount).toBe(2);
  });

  it("T3) EXACT/COMPARISON 버킷을 각각 독립적으로 판매처 수를 센다 — foretforet×3 observations → exactSellerCount=1, deuxbebe×2 observations → comparisonSellerCount=1", () => {
    const exactRecords = [
      record({ id: "e1", priceKrw: 258000, sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592" }),
      record({ id: "e2", priceKrw: 258000, sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592" }),
      record({ id: "e3", priceKrw: 258000, sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592" }),
    ];
    const comparisonRecords = [
      record({ id: "c1", priceKrw: 234900, sourceProductUrl: "https://www.deuxbebe.com/product/detail.html?product_no=8021" }),
      record({ id: "c2", priceKrw: 234900, sourceProductUrl: "https://www.deuxbebe.com/product/detail.html?product_no=8021" }),
    ];
    const split = summarizeDomesticMarketSplit(exactRecords, comparisonRecords);
    expect(split.exact.sellerCount).toBe(1);
    expect(split.comparison.sellerCount).toBe(1);
  });

  it("T4) sellerCount 계산 방식이 바뀌어도 lowestPriceKrw/averagePriceKrw는 회귀하지 않는다(observation 전부 반영)", () => {
    const records = [
      record({ id: "o1", priceKrw: 258000, sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", checkedAt: "2026-09-02T02:44:34.000Z" }),
      record({ id: "o2", priceKrw: 260000, sourceProductUrl: "https://www.foretforet.com/shop/shopdetail.html?branduid=10226592", checkedAt: "2026-09-02T03:16:14.000Z" }),
    ];
    const summary = summarizeFrom(records, "PRIMARY");
    expect(summary.sellerCount).toBe(1);
    // 가격 계산은 여전히 모든 observation을 그대로 쓴다 — sellerCount 수정과 무관.
    expect(summary.lowestPriceKrw).toBe(258000);
    expect(summary.averagePriceKrw).toBe(259000);
  });
});
