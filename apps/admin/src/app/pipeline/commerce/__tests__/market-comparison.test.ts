import { describe, expect, it } from "vitest";
import { buildGlobalMarketCard, type MarketObservationInput } from "../global-market";
import { buildMarketComparison } from "../market-comparison";
import { buildMarketContext, PRICE_MEANING_LABEL, PRICE_SECTION_TITLE, type MarketContextInput } from "../price-hierarchy";

/**
 * UX 2.4.1(CEO 지시, 2026-09-11) — 고정하려는 문장.
 *
 * 셀러가 이 화면에서 실제로 내리는 판단은 한 줄이다:
 * "이 판매자는 한국에서 ₩78,000에 파는데, 한국의 다른 판매자들은 ₩116,600에 판다."
 *
 * 두 숫자는 라벨도 모양도 비슷해서(둘 다 🇰🇷 ₩) 따로 떨어져 있으면 같은 값으로
 * 읽힌다. 그래서 ③에서만, 나란히, 무엇과 무엇인지 적어서 보여준다 — 그리고
 * 화면의 다른 어디에서도 비교하지 않는다.
 */
const OBSERVATIONS: MarketObservationInput[] = [
  {
    marketCode: "en-kr",
    marketCountry: "ES",
    currency: "KRW",
    priceAmount: 78000,
    priceKrw: 78000,
    soldOut: false,
    productUrl: "https://bobochoses.com/en-kr/products/x",
    checkedAt: "2026-09-11T02:00:00.000Z",
  },
  {
    marketCode: "en-de",
    marketCountry: "ES",
    currency: "EUR",
    priceAmount: 37,
    priceKrw: 57756,
    soldOut: false,
    productUrl: null,
    checkedAt: "2026-09-11T02:00:00.000Z",
  },
];

const MARKET: MarketContextInput = {
  domesticBasis: "EXACT",
  domesticAveragePriceKrw: 116600,
  domesticLowestPriceKrw: 109000,
  domesticSellerCount: 3,
  domesticUnresolved: false,
};

const CARD = buildGlobalMarketCard({ observations: OBSERVATIONS, costBasisIsTargetMarket: true });
const CONTEXT = buildMarketContext(MARKET);
const COMPARISON = buildMarketComparison(CARD, CONTEXT);

describe("③은 판매자 한국 가격과 국내 비교상품만 짝짓는다", () => {
  it("왼쪽은 이 판매처가 한국에서 받는 값, 오른쪽은 다른 한국 판매자들의 값이다", () => {
    expect(COMPARISON.title).toBe(PRICE_SECTION_TITLE.DOMESTIC_COMPETITION);
    expect(COMPARISON.seller.label).toBe(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
    expect(COMPARISON.seller.value).toBe("₩78,000");
    expect(COMPARISON.domestic.label).toBe(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
    expect(COMPARISON.domestic.value).toBe("₩116,600");
    expect(COMPARISON.versus).toBe("VS");
  });

  it("비교에 끼어드는 세 번째 값이 없다 — 두 칸뿐이다", () => {
    // €37(DE)이나 $53(US)이 여기 들어오면 "한국 시장 경쟁가격"이 아니게 된다.
    const sides = Object.entries(COMPARISON).filter(([, v]) => v != null && typeof v === "object" && "value" in v);
    expect(sides.map(([k]) => k).sort()).toEqual(["domestic", "seller"]);
    expect(JSON.stringify(COMPARISON)).not.toContain("57,756");
  });

  it("차액을 계산하지 않는다 — 빼는 일은 ④ 수익성의 몫이다", () => {
    // ₩38,600은 매력적이지만 그 사이에는 국제배송비·수수료가 있다.
    expect(JSON.stringify(COMPARISON)).not.toContain("38,600");
  });

  it("두 값이 무엇과 무엇인지 문장으로 말한다", () => {
    expect(COMPARISON.versusNote).toContain("직접 받는 값");
    expect(COMPARISON.versusNote).toContain("다른 대한민국 판매자");
  });

  it("같은 관측이 ④ 사슬의 출발점이면 그 사실을 왼쪽 칸이 밝힌다", () => {
    // 밝히지 않으면 셀러가 같은 숫자를 두 번 센다.
    expect(COMPARISON.seller.basis).toContain("착지원가 기준");
    expect(COMPARISON.seller.basis).toContain("이 판매처가 직접 파는 값");
  });
});

describe("모르면 고르지 않는다", () => {
  it("이 판매처의 한국 시장 관측이 없으면 '검색 데이터 없음'이다", () => {
    const card = buildGlobalMarketCard({
      observations: OBSERVATIONS.filter((o) => o.marketCode !== "en-kr"),
      costBasisIsTargetMarket: false,
    });
    const comparison = buildMarketComparison(card, CONTEXT);
    expect(comparison.seller.value).toBeNull();
    expect(comparison.seller.empty?.kind).toBe("NO_SEARCH_DATA");
    // 한쪽이 비어도 다른 쪽은 그대로다 — 두 축은 서로의 입력이 아니다.
    expect(comparison.domestic.value).toBe("₩116,600");
  });

  it("한국 시장 관측이 여러 개면 아무거나 골라 판매자 한국 가격이라고 부르지 않는다", () => {
    const card = buildGlobalMarketCard({
      observations: [...OBSERVATIONS, { ...OBSERVATIONS[0]!, marketCode: "kr", priceAmount: 81000, priceKrw: 81000 }],
      costBasisIsTargetMarket: true,
    });
    const comparison = buildMarketComparison(card, CONTEXT);
    expect(comparison.seller.value).toBeNull();
    expect(comparison.seller.empty?.kind).toBe("UNVERIFIABLE");
  });

  it("국내 비교상품이 0건이어도 판매자 한국 가격은 그대로 남는다", () => {
    const empty = buildMarketContext({
      domesticBasis: "NONE",
      domesticAveragePriceKrw: null,
      domesticLowestPriceKrw: null,
      domesticSellerCount: 0,
      domesticUnresolved: false,
    });
    const comparison = buildMarketComparison(CARD, empty);
    expect(comparison.seller.value).toBe("₩78,000");
    expect(comparison.domestic.value).toBeNull();
    expect(comparison.domestic.empty?.chip).toBe("⚪ 검색 데이터 없음");
  });
});
