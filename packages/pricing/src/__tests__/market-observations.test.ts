import { describe, expect, it } from "vitest";
import { groupMarketObservations, type PriceObservationRecord } from "../price-history";

/**
 * UX 2.4(CEO 지시, 2026-09-11) — 판매자가 시장마다 낸 가격을 화면까지 올린다.
 *
 * GLOBAL-MARKET ②③이 en-kr/en-us/en-fr/en-de/en-int를 전부 price_observations에
 * 저장해 왔는데, 응답이 들고 있던 것은 **원가 근거 행만 남긴 목록**이라 그
 * 시장들이 화면에 한 줄도 나오지 않았다. 이 함수는 그 행들을 시장별 최신
 * 1건으로 고르기만 한다 — 최저/평균을 내지 않고, 시장끼리 비교하지 않는다.
 */
function record(over: Partial<PriceObservationRecord>): PriceObservationRecord {
  return {
    id: "id",
    snapshotId: "snap",
    source: "SELLER_ORIGIN",
    sourceLabel: null,
    sourceProductUrl: null,
    sourceRefId: null,
    currency: "EUR",
    priceAmount: 37,
    shippingCostAmount: null,
    taxAmount: null,
    exchangeRate: 1561,
    priceKrw: 57756,
    salePriceKrw: null,
    originalPriceKrw: null,
    soldOut: null,
    marketCode: "en-de",
    marketCountry: "ES",
    checkedAt: "2026-09-11T02:00:00.000Z",
    ...over,
  };
}

describe("시장 행은 market_code에서만 나온다", () => {
  it("통화가 같아도 시장이 다르면 두 줄이다", () => {
    // 실측(Bobo Choses B226AC043): /en-de €75.00과 /en-int €84.00. "통화가 같으면
    // 같은 시장"이 성립하지 않는다는 실증이라, 통화로 묶으면 둘 다 거짓이 된다.
    const rows = groupMarketObservations([
      record({ marketCode: "en-de", priceAmount: 75, priceKrw: 117075 }),
      record({ marketCode: "en-int", priceAmount: 84, priceKrw: 131124 }),
    ]);
    expect(rows.map((r) => r.marketCode)).toEqual(["en-de", "en-int"]);
    expect(rows.map((r) => r.priceAmount)).toEqual([75, 84]);
  });

  it("market_code가 비어 있으면 시장이 아니다 — 원본 관측일 뿐이다", () => {
    // ""/null은 로케일 프리픽스 없는 기본 요청, 즉 원본 판매자 페이지 그 자체다.
    // 화면에서 이미 "원본 판매가격"으로 한 번 나오므로 여기 담으면 사본이 된다.
    const rows = groupMarketObservations([
      record({ marketCode: null }),
      record({ marketCode: "" }),
      record({ marketCode: "en-kr", currency: "KRW", priceAmount: 78000, priceKrw: 78000 }),
    ]);
    expect(rows.map((r) => r.marketCode)).toEqual(["en-kr"]);
  });

  it("MARKET_PROBE 행도 시장 행으로 올라온다 — 원가 근거에서만 빠져 있을 뿐이다", () => {
    const rows = groupMarketObservations([
      record({ marketCode: "en-kr", sourceLabel: "KR_MARKET", currency: "KRW", priceAmount: 78000, priceKrw: 78000 }),
      record({ marketCode: "en-us", sourceLabel: "MARKET_PROBE", currency: "USD", priceAmount: 53, priceKrw: 71221 }),
    ]);
    expect(rows.map((r) => r.marketCode)).toEqual(["en-kr", "en-us"]);
  });

  it("한 시장의 여러 관측은 가장 최근 1건으로 접는다 — 평균 내지 않는다", () => {
    const rows = groupMarketObservations([
      record({ marketCode: "en-de", priceAmount: 75, priceKrw: 117075, checkedAt: "2026-09-09T02:00:00.000Z" }),
      record({ marketCode: "en-de", priceAmount: 37, priceKrw: 57756, checkedAt: "2026-09-11T02:00:00.000Z" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.priceAmount).toBe(37);
  });

  it("가격이 없는 행(완전 품절)은 시장 가격 줄이 되지 못한다 — 0원을 지어내지 않는다", () => {
    const rows = groupMarketObservations([record({ marketCode: "en-fr", priceAmount: null, priceKrw: null })]);
    expect(rows).toHaveLength(0);
  });

  it("판매 상태 세 가지를 그대로 들고 온다 — 확인 못 한 것을 판매중으로 바꾸지 않는다", () => {
    const rows = groupMarketObservations([
      record({ marketCode: "en-de", soldOut: true }),
      record({ marketCode: "en-fr", soldOut: false }),
      record({ marketCode: "en-us", soldOut: null }),
    ]);
    expect(rows.map((r) => r.soldOut)).toEqual([rows[0]!.soldOut, rows[1]!.soldOut, rows[2]!.soldOut]);
    expect(new Map(rows.map((r) => [r.marketCode, r.soldOut]))).toEqual(
      new Map([
        ["en-de", true],
        ["en-fr", false],
        ["en-us", null],
      ]),
    );
  });

  it("시장이 서로 다른 기준 국가를 선언하면 하나로 단정하지 않는다", () => {
    const rows = groupMarketObservations([
      record({ marketCode: "en-de", marketCountry: "ES", checkedAt: "2026-09-11T02:00:00.000Z" }),
      record({ marketCode: "en-de", marketCountry: "DE", checkedAt: "2026-09-10T02:00:00.000Z" }),
    ]);
    expect(rows[0]!.marketCountry).toBeNull();
  });
});
