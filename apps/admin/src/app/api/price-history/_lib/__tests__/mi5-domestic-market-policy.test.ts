import { describe, expect, it } from "vitest";
import {
  DOMESTIC_ANALYSIS_MARKET_COUNTRY,
  DOMESTIC_MARKET_AGGREGATION,
  computeSellability,
  summarizeDomesticMarketSplit,
  summarizeFrom,
  type PriceObservationRecord,
} from "@commerce/pricing";
import { readSourceAt, stripComments } from "../../../../pipeline/commerce/__tests__/source-text";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-5 / P0-2-B(CEO 지시, 2026-09-26) — **두 호출부가 같은 시장을 본다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 문제였나 ─────────────────────────────────────────────────────────
 * 국내 집계는 「어느 시장의 가격으로 최저/평균을 낼지」를 옵션으로 받고 있었고,
 * 프로덕션 호출부 «둘» 이 서로 다르게 불렀다:
 *
 *   market-intelligence.ts (상품 상세)   summarizeDomesticMarketSplit(…, { KR })
 *   compute-readiness.ts   (대시보드)    summarizeDomesticMarketSplit(…)   ← 없음
 *
 * 옵션이 없으면 시장이 둘 이상일 때 «판단 불가» 로 간다(UNRESOLVED) — 최저가도
 * 평균가도 null 이 된다. 즉 같은 상품·같은 관측에서 상세는 한국 가격으로
 * 판단하고 대시보드는 「국내 동일상품 확인 필요」로 떨어질 수 있었다.
 *
 * 🔴 오늘 결과가 같은 것은 국내 가격 확인 경로(run-domestic-price-check)가
 *    market_code 를 «남기지 않아» 시장 그룹이 하나뿐이기 때문일 뿐이다
 *    (basis="SINGLE"). 고장이 아니라 **잠긴 결함**이고, 그래서 「오늘 같으니
 *    두자」로 닫지 않았다.
 *
 * ── 무엇을 고쳤나 ───────────────────────────────────────────────────────────
 * 시장 기준을 인자에서 «없앴다». 국내 집계의 판단 시장은 함수 안에 한 번만
 * 적혀 있다(DOMESTIC_MARKET_AGGREGATION) — 같은 문자열을 두 호출부에
 * 하드코딩해 맞추는 대신, 어긋날 자리 자체를 없앴다.
 *
 * 🔴 판정은 바꾸지 않았다. 아래 ③이 그것을 고정한다.
 */

function record(overrides: Partial<PriceObservationRecord>): PriceObservationRecord {
  return {
    id: "id-1",
    snapshotId: "snap-1",
    source: "DOMESTIC_SHOP",
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
    marketCode: null,
    marketCountry: null,
    shippingPolicyStatus: null,
    shippingPolicyNote: null,
    checkedAt: "2026-09-26T01:00:00.000Z",
    ...overrides,
  };
}

/** 실측 모양 그대로(Bobo Choses): 한 상품이 시장마다 다른 가격을 낸다.
 *  국내 관측에 market_code 가 생기는 날 들어올 데이터가 정확히 이 모양이다. */
const MULTI_MARKET_EXACT: PriceObservationRecord[] = [
  record({
    id: "kr",
    priceKrw: 162000,
    marketCode: "en-kr",
    sourceProductUrl: "https://www.bobochoses.com/en-kr/products/b226ac043",
  }),
  record({
    id: "de",
    priceKrw: 250000,
    marketCode: "en-de",
    sourceProductUrl: "https://www.bobochoses.com/en-de/products/b226ac043",
  }),
];

describe("① 🔴 호출부가 «아무것도 넘기지 않아도» 국내 판단 시장은 한국이다", () => {
  it("시장이 둘이면 한국 시장 가격으로 최저/평균을 낸다 — 판단 불가로 떨어지지 않는다", () => {
    /* 🔴 고치기 «전» 이 단정은 대시보드(compute-readiness) 호출 모양에서
       빨갰다: priceMarketBasis="UNRESOLVED", lowest/average 가 null 이었다. */
    const split = summarizeDomesticMarketSplit(MULTI_MARKET_EXACT, []);
    expect(split.basis).toBe("EXACT");
    expect(split.exact.priceMarketBasis).toBe("ANALYSIS");
    expect(split.exact.priceMarketCode).toBe("en-kr");
    expect(split.exact.lowestPriceKrw).toBe(162000);
    expect(split.exact.averagePriceKrw).toBe(162000);
    /* 독일 가격은 «지워지지» 않는다 — 판단에서만 빠지고 markets 에 그대로 남는다. */
    expect(split.exact.markets.map((m) => m.marketCode)).toEqual(["en-de", "en-kr"]);
  });

  it("그래서 대시보드가 「국내 동일상품 확인 필요」로 «잘못» 떨어지지 않는다", () => {
    /* compute-readiness.ts 가 sellability 에 넘기는 것과 같은 두 값이다. */
    const split = summarizeDomesticMarketSplit(MULTI_MARKET_EXACT, []);
    const sellability = computeSellability({
      costPriceKrw: 100000,
      domestic: { matched: split.exact.sellerCount > 0, averagePriceKrw: split.exact.averagePriceKrw },
    });
    expect(sellability.level).not.toBe("YELLOW");
    expect(sellability.title).not.toBe("국내 동일상품 확인 필요");
  });

  it("비교상품 버킷도 같은 시장을 본다 — 두 버킷이 다른 시장을 고르면 비교가 무의미하다", () => {
    const split = summarizeDomesticMarketSplit([], MULTI_MARKET_EXACT);
    expect(split.basis).toBe("COMPARISON");
    expect(split.comparison.priceMarketCode).toBe("en-kr");
    expect(split.comparison.lowestPriceKrw).toBe(162000);
  });
});

describe("② 🔴 시장 정책은 «한 곳» 에만 있다", () => {
  it("DOMESTIC_MARKET_AGGREGATION 이 기존 경계(DOMESTIC_ANALYSIS_MARKET_COUNTRY)를 그대로 쓴다", () => {
    /* 새 상수에 "KR" 을 한 번 더 타이핑하면 정책이 둘이 된다. */
    expect(DOMESTIC_MARKET_AGGREGATION.analysisMarketCountry).toBe(DOMESTIC_ANALYSIS_MARKET_COUNTRY);
  });

  it("split 의 각 버킷은 그 정책을 그대로 적용한 summarizeFrom 과 동일하다", () => {
    const split = summarizeDomesticMarketSplit(MULTI_MARKET_EXACT, []);
    expect(split.exact).toEqual(summarizeFrom(MULTI_MARKET_EXACT, "PRIMARY", DOMESTIC_MARKET_AGGREGATION));
  });

  it("🔴 호출부가 «다른» 시장을 끼워 넣을 수 없다 — 타입이 거부한다", () => {
    /* 국내 집계는 시장 기준을 인자로 받지 않는다. 이 단정이 「@ts-expect-error 가
       사용되지 않았다」로 실패하는 날은 누군가 옵션 인자를 되살린 날이고, 그때
       두 호출부의 불일치도 함께 돌아온다. */
    // @ts-expect-error — MI-5/P0-2-B: 세 번째 인자는 존재하지 않는다.
    summarizeDomesticMarketSplit([], [], { analysisMarketCountry: "DE" });
    expect(true).toBe(true);
  });
});

describe("③ 🔴 오늘 판정은 한 글자도 바뀌지 않는다", () => {
  /** 저장돼 있는 국내 행은 전부 market_code=null 이다(046 마이그레이션은 backfill
   *  하지 않고, run-domestic-price-check 는 market_code 를 쓰지 않는다). */
  const LEGACY: PriceObservationRecord[] = [
    record({ id: "a", priceKrw: 258000, sourceProductUrl: "https://www.foretforet.com/a" }),
    record({ id: "b", priceKrw: 260000, sourceProductUrl: "https://www.deuxbebe.com/b" }),
  ];

  it("시장 그룹이 하나면 SINGLE 이고 값은 예전 그대로다", () => {
    const split = summarizeDomesticMarketSplit(LEGACY, []);
    expect(split.exact.priceMarketBasis).toBe("SINGLE");
    expect(split.exact.priceMarketCode).toBeNull();
    expect(split.exact.lowestPriceKrw).toBe(258000);
    expect(split.exact.averagePriceKrw).toBe(259000);
    expect(split.exact.sellerCount).toBe(2);
  });

  it("최저가 pool 과 평균가 pool 은 여전히 같은 표본이다(MI-4 조사 결과 유지)", () => {
    /* 🔴 P0-2 의 설계 결정(최저가 vs 평균가)은 여기서 «하지 않는다». 이번
       변경이 그 축을 건드리지 않았다는 사실만 고정한다. */
    const split = summarizeDomesticMarketSplit(LEGACY, []);
    expect(split.exact.lowestPriceKrw).toBe(258000);
    expect(split.exact.highestPriceKrw).toBe(260000);
    expect(split.exact.averagePriceKrw).toBe(259000);
  });
});

describe("④ 🔴 두 프로덕션 호출부 어디에도 시장 인자가 남아 있지 않다", () => {
  const read = (relative: string) => stripComments(readSourceAt(new URL(relative, import.meta.url)));
  const detail = read("../market-intelligence.ts");
  const dashboard = read("../../../snapshots/_lib/compute-readiness.ts");

  it.each([
    ["상품 상세(market-intelligence)", () => detail],
    ["대시보드(compute-readiness)", () => dashboard],
  ])("%s 는 판단 시장을 스스로 정하지 않는다", (_label, source) => {
    const code = source();
    expect(code).toContain("summarizeDomesticMarketSplit(");
    /* 🔴 주석은 걷어낸 뒤 본다 — 이 저장소의 주석은 「예전에는 이렇게 넘겼다」를
       길게 설명하므로, 문자열이 주석에 있는 것은 정상이다. */
    expect(code).not.toContain("analysisMarketCountry");
    expect(code).not.toContain("DOMESTIC_ANALYSIS_MARKET_COUNTRY");
    expect(code).not.toContain("marketOptions");
  });
});
