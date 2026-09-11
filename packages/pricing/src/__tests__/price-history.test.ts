import { describe, expect, it } from "vitest";
import {
  summarizeDomesticMarket,
  summarizeDomesticMarketSplit,
  summarizeFrom,
  computePriceChange,
  computePriceTrend,
  DOMESTIC_ANALYSIS_MARKET_COUNTRY,
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
    // 기존 데이터는 전부 market_code/market_country가 null이다(046 마이그레이션은
    // backfill하지 않는다) — 이 기본값이 곧 "예전 동작 그대로"의 기준선이다.
    marketCode: null,
    marketCountry: null,
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

/**
 * GLOBAL-MARKET ②(CPO 지시, 2026-09-11) — 한 GLOBAL 판매처의 여러 시장 관측이
 * 집계를 오염시키지 않아야 한다. 실측(Bobo Choses, B226AC043): 같은 상품이
 * /en-kr ₩162,000 · /en-de €75 · /en-int €84로 시장마다 다른 가격을 낸다.
 * €75(DE)와 €84(INT)는 통화까지 같아서 "통화가 같으면 같은 시장"이 성립하지
 * 않는다는 근거이기도 하다.
 *
 * 지켜야 할 두 줄:
 *   가격        = Source + Market 단위 (시장끼리 합산·비교하지 않는다)
 *   sellerCount = Source 단위 distinct (한 판매처는 N개 시장에 있어도 한 곳)
 */
describe("summarizeFrom — GLOBAL Source 1개 × Market 3개(KR/DE/INT)", () => {
  const BOBO = "https://bobochoses.com";
  // 세 관측 모두 같은 판매처(호스트가 같다)이고, 다른 것은 시장뿐이다.
  const globalRecords = [
    record({
      id: "kr",
      source: "DOMESTIC_SHOP",
      sourceLabel: "Bobo Choses",
      sourceProductUrl: `${BOBO}/en-kr/products/b226ac043`,
      sourceRefId: "bobo",
      marketCode: "en-kr",
      marketCountry: "ES",
      currency: "KRW",
      priceAmount: 162000,
      priceKrw: 162000,
    }),
    record({
      id: "de",
      source: "DOMESTIC_SHOP",
      sourceLabel: "Bobo Choses",
      sourceProductUrl: `${BOBO}/en-de/products/b226ac043`,
      sourceRefId: "bobo",
      marketCode: "en-de",
      marketCountry: "ES",
      currency: "EUR",
      priceAmount: 75,
      priceKrw: 117000,
    }),
    record({
      id: "int",
      source: "DOMESTIC_SHOP",
      sourceLabel: "Bobo Choses",
      sourceProductUrl: `${BOBO}/en-int/products/b226ac043`,
      sourceRefId: "bobo",
      marketCode: "en-int",
      marketCountry: "ES",
      currency: "EUR",
      priceAmount: 84,
      priceKrw: 131000,
    }),
  ];

  const summary = summarizeFrom(globalRecords, "PRIMARY", {
    analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY,
  });

  it("sellerCount === 1 — 시장이 셋이어도 판매처는 한 곳이다", () => {
    expect(summary.sellerCount).toBe(1);
    expect(summary.sellers).toHaveLength(1);
    expect(summary.sellers[0].markets).toHaveLength(3);
  });

  it("가격은 market별로 독립 — 셋이 합산·혼합되지 않는다", () => {
    const byCode = new Map(summary.markets.map((m) => [m.marketCode, m]));
    expect(summary.markets).toHaveLength(3);
    expect(byCode.get("en-kr")!.lowestPriceKrw).toBe(162000);
    expect(byCode.get("en-de")!.lowestPriceKrw).toBe(117000);
    expect(byCode.get("en-int")!.lowestPriceKrw).toBe(131000);
    // 각 시장의 평균은 그 시장 가격 자신이다(다른 시장이 섞였다면 달라졌을 것).
    expect(byCode.get("en-de")!.averagePriceKrw).toBe(117000);
    // 시장별로도 판매처는 한 곳씩이다.
    for (const market of summary.markets) expect(market.sellerCount).toBe(1);
  });

  it("KR 가격이 EU 최저가를 대체하지 않는다 — DE 시장 최저가는 여전히 €75(₩117,000)", () => {
    const de = summary.markets.find((m) => m.marketCode === "en-de")!;
    expect(de.lowestPriceKrw).toBe(117000);
    expect(de.highestPriceKrw).toBe(117000);
    // KR(₩162,000)이 DE 집계로 흘러들어갔다면 highest가 162000이 됐을 것이다.
    expect(de.highestPriceKrw).not.toBe(162000);
  });

  it("EU 가격이 KR 가격 판단에 들어가지 않는다 — 국내 판단가는 ₩162,000 하나뿐", () => {
    expect(summary.priceMarketBasis).toBe("ANALYSIS");
    expect(summary.priceMarketCode).toBe("en-kr");
    expect(summary.lowestPriceKrw).toBe(162000);
    expect(summary.averagePriceKrw).toBe(162000);
    expect(summary.highestPriceKrw).toBe(162000);
    // 예전 집계라면 min(162000, 117000, 131000)=117000, 평균 136667이 나왔다.
    expect(summary.lowestPriceKrw).not.toBe(117000);
    expect(summary.averagePriceKrw).not.toBe(136667);
    // 화면에 뿌릴 리스팅도 판단 시장의 것만 남는다.
    expect(summary.sampleListings).toHaveLength(1);
    expect(summary.sampleListings[0].priceKrw).toBe(162000);
  });

  it("판단 시장을 모르면(옵션 없음) 아무 시장이나 고르지 않고 판단 불가로 둔다 — 시장 데이터 자체는 남긴다", () => {
    const unresolved = summarizeFrom(globalRecords, "PRIMARY");
    expect(unresolved.priceMarketBasis).toBe("UNRESOLVED");
    expect(unresolved.priceMarketCode).toBeNull();
    expect(unresolved.lowestPriceKrw).toBeNull();
    expect(unresolved.averagePriceKrw).toBeNull();
    // 행을 숨기거나 버리지 않는다 — 판매처/시장은 그대로 보인다.
    expect(unresolved.sellerCount).toBe(1);
    expect(unresolved.markets).toHaveLength(3);
  });

  it("market_code가 null이거나 \"\"면 시장 미확인 한 그룹으로 묶고 추측하지 않는다", () => {
    const summaryUnknownMarket = summarizeFrom(
      [
        record({ id: "n", priceKrw: 30000, sourceProductUrl: "https://a.example/p", marketCode: null }),
        record({ id: "e", priceKrw: 20000, sourceProductUrl: "https://b.example/p", marketCode: "" }),
      ],
      "PRIMARY",
      { analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY },
    );
    expect(summaryUnknownMarket.markets).toHaveLength(1);
    expect(summaryUnknownMarket.markets[0].marketCode).toBeNull();
    expect(summaryUnknownMarket.markets[0].marketCountry).toBeNull();
    // 시장이 하나뿐이라 예전과 동일하게 전부 집계에 들어간다(회귀 없음).
    expect(summaryUnknownMarket.priceMarketBasis).toBe("SINGLE");
    expect(summaryUnknownMarket.lowestPriceKrw).toBe(20000);
    expect(summaryUnknownMarket.averagePriceKrw).toBe(25000);
    expect(summaryUnknownMarket.sellerCount).toBe(2);
  });

  it("기존 동작 보존 — market_code가 전부 null인 단일 시장 데이터는 예전과 같은 결과를 낸다", () => {
    const legacy = [
      record({ id: "a", priceKrw: 30000, sourceLabel: "A몰", sourceProductUrl: "https://a.example/p" }),
      record({ id: "b", priceKrw: 20000, sourceLabel: "B몰", sourceProductUrl: "https://b.example/p" }),
      record({ id: "c", priceKrw: 40000, sourceLabel: "C몰", sourceProductUrl: "https://c.example/p" }),
    ];
    const withOption = summarizeFrom(legacy, "PRIMARY", {
      analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY,
    });
    const withoutOption = summarizeFrom(legacy, "PRIMARY");
    expect(withOption.lowestPriceKrw).toBe(20000);
    expect(withOption.highestPriceKrw).toBe(40000);
    expect(withOption.averagePriceKrw).toBe(30000);
    expect(withOption.sellerCount).toBe(3);
    expect(withOption.sampleListings).toHaveLength(3);
    expect(withOption.stockCounts).toEqual({ onSale: 0, unknown: 3, soldOut: 0 });
    // 분석 시장 옵션의 유무가 단일 시장 데이터의 결과를 바꾸지 않는다.
    expect(withoutOption).toEqual(withOption);
  });

  it("GLOBAL 판매처가 섞여 있어도 다른 국내 판매처의 KR 가격과는 같은 시장에서 비교된다", () => {
    // 국내 편집샵은 market_code가 없다(시장 미확인). Bobo의 en-kr과 같은
    // 시장이라고 단정할 수 없으므로 서로 다른 그룹으로 남는다 — 그 결과
    // 판단 시장(en-kr)에는 Bobo의 ₩162,000만 들어간다. 없는 사실을 만들어
    // 두 그룹을 합치지 않는다.
    const mixed = [
      ...globalRecords,
      record({ id: "shop", source: "DOMESTIC_SHOP", priceKrw: 149000, sourceProductUrl: "https://kidsshop.example/p" }),
    ];
    const summaryMixed = summarizeFrom(mixed, "PRIMARY", {
      analysisMarketCountry: DOMESTIC_ANALYSIS_MARKET_COUNTRY,
    });
    expect(summaryMixed.sellerCount).toBe(2);
    expect(summaryMixed.priceMarketCode).toBe("en-kr");
    expect(summaryMixed.lowestPriceKrw).toBe(162000);
    expect(summaryMixed.markets.find((m) => m.marketCode === null)!.lowestPriceKrw).toBe(149000);
  });
});
