import { describe, expect, it } from "vitest";
import {
  buildMarketContext,
  buildPriceChain,
  PRICE_LINE_LABEL,
  PRICE_MEANING_LABEL,
  type MarketContextInput,
  type PriceChainInput,
} from "../price-hierarchy";

/**
 * UX 2.3(CEO 지시, 2026-09-11) — 고정하려는 실제 화면.
 *
 * 프로덕션 화면에 £55 · ₩99,928 · 국내 비교가격 · 한국 시장 가격 · 판매가격이
 * 전부 같은 모양의 숫자로 떠 있었다. 그중 "한국 시장 가격"이라는 한 라벨이 두
 * 사실(원본 판매자의 한국 표시가 / 국내 편집샵 비교가)을 겸했고, 국내 비교상품이
 * 0건이면 화면 전체가 "판단 불가"처럼 읽혔다.
 *
 * 이 테스트가 못박는 것은 두 가지다:
 *   ① 여덟 가지 의미가 한 라벨로 합쳐지지 않는다.
 *   ② 국내 데이터가 비어도 수익성 사슬은 전부 살아 있고, 저하되는 것은
 *      가격 경쟁력 하나뿐이다(시장 비교 불가 ≠ 수익성 계산 불가).
 */
const CHAIN: PriceChainInput = {
  originPrice: { amount: 55, currency: "GBP" },
  originPriceBasis: "저장된 가격 기준",
  costBasisIsKrMarket: false,
  sourcePriceKrw: 99928,
  exchangeRate: 1816.87,
  exchangeRateIsEstimate: false,
  internationalShippingKrw: 12000,
  landedCostKrw: 111928,
  sellerPlannedPriceKrw: 150000,
  expectedProfitKrw: 23072,
  platformFeeKrw: 15000,
  costIncomplete: false,
  marginPercent: 15.4,
  marginBasis: "PLANNED",
};

const MARKET: MarketContextInput = {
  domesticBasis: "EXACT",
  domesticAveragePriceKrw: 116600,
  domesticLowestPriceKrw: 109000,
  domesticSellerCount: 3,
  domesticUnresolved: false,
  overseasMarketCount: 2,
};

describe("여덟 가지 가격은 한 라벨로 합쳐지지 않는다", () => {
  it("의미마다 라벨이 하나씩이고 서로 겹치지 않는다", () => {
    const labels = Object.values(PRICE_MEANING_LABEL);
    expect(labels).toHaveLength(8);
    expect(new Set(labels).size).toBe(8);
  });

  it("착지원가에 더해지는 비용은 여덟 가격 중 어느 이름도 쓰지 않는다", () => {
    // "국제배송비"가 아홉 번째 가격으로 섞이면 그 순간 이 파일의 약속이 깨진다.
    expect(Object.values(PRICE_MEANING_LABEL)).not.toContain(PRICE_LINE_LABEL.INTERNATIONAL_SHIPPING);
  });

  it("사슬의 한 줄은 의미를 하나씩만 갖는다", () => {
    const rows = buildPriceChain(CHAIN);
    const keys = rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of rows) expect(row.label).toBe(PRICE_LINE_LABEL[row.key]);
  });

  it("원본 통화 가격과 원화 환산은 서로 다른 줄이고 한 숫자로 뭉개지지 않는다", () => {
    const rows = buildPriceChain(CHAIN);
    const origin = rows.find((r) => r.key === "SOURCE_ORIGINAL_PRICE")!;
    const converted = rows.find((r) => r.key === "SOURCE_PRICE_KRW")!;
    // 원본 줄은 원본 통화 그대로 — 원화 기호도 "≈"도 붙지 않는다.
    expect(origin.value).toContain("55");
    expect(origin.value).not.toContain("₩");
    expect(origin.value).not.toContain("≈");
    // 환산 줄은 자기 라벨과 환율 근거를 갖는다.
    expect(converted.value).toBe("₩99,928");
    expect(converted.basis).toContain("1 GBP = ₩1,817");
  });

  it("원본 통화가 원화면 환산 줄을 만들지 않는다 — 같은 숫자에 라벨을 두 번 붙이지 않는다", () => {
    const rows = buildPriceChain({
      ...CHAIN,
      originPrice: { amount: 162000, currency: "KRW" },
      sourcePriceKrw: 162000,
    });
    expect(rows.some((r) => r.key === "SOURCE_PRICE_KRW")).toBe(false);
    expect(rows.some((r) => r.key === "SOURCE_ORIGINAL_PRICE")).toBe(true);
  });

  it("원본 판매자의 한국 표시가는 '원본 판매가격'이라고 부르지 않는다", () => {
    // 실측 근거(PèPè): £200×환율=₩377,400인데 실제 한국 로케일 표시가는
    // ₩234,800이었다. 둘을 같은 라벨로 부르면 차액 ₩142,600이 화면에서 사라진다.
    const rows = buildPriceChain({ ...CHAIN, costBasisIsKrMarket: true, sourcePriceKrw: 234800 });
    const head = rows[0]!;
    expect(head.key).toBe("KR_MARKET_PRICE");
    expect(head.label).toBe(PRICE_MEANING_LABEL.KR_MARKET_PRICE);
    expect(head.basis).toContain("환율 환산이 아닙니다");
    expect(rows.some((r) => r.key === "SOURCE_ORIGINAL_PRICE")).toBe(false);
  });

  it("원본 판매자 한국 표시가와 국내 비교상품은 절대 같은 라벨을 쓰지 않는다", () => {
    // 이 둘이 같은 이름("한국 시장 가격")을 쓰던 것이 이번 지시의 출발점이다.
    // 하나는 내가 살 값이고 하나는 남이 파는 값이다.
    expect(PRICE_MEANING_LABEL.KR_MARKET_PRICE).not.toBe(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
    const context = buildMarketContext(MARKET);
    expect(context.comparable.label).toBe(PRICE_MEANING_LABEL.DOMESTIC_COMPARABLE_PRICE);
  });

  it("예상 마진은 어느 판매가 기준인지 항상 밝힌다", () => {
    const planned = buildPriceChain(CHAIN).find((r) => r.key === "EXPECTED_MARGIN")!;
    expect(planned.basis).toBe("내 판매가 기준");
    const recommended = buildPriceChain({ ...CHAIN, marginBasis: "RECOMMENDED" }).find(
      (r) => r.key === "EXPECTED_MARGIN",
    )!;
    expect(recommended.basis).toBe("추천 판매가 기준");
  });

  it("예상 수익이 착지원가만 뺀 값이 아니라는 사실을 숨기지 않는다", () => {
    const profit = buildPriceChain(CHAIN).find((r) => r.key === "EXPECTED_PROFIT")!;
    expect(profit.basis).toContain("플랫폼 수수료");
    expect(profit.basis).toContain("₩15,000");
  });
});

describe("판매가를 정하지 않아도 원가 사슬은 끊기지 않는다", () => {
  const noPlan = buildPriceChain({
    ...CHAIN,
    sellerPlannedPriceKrw: null,
    expectedProfitKrw: null,
    platformFeeKrw: null,
    marginPercent: 22.4,
    marginBasis: "RECOMMENDED",
  });

  it("추천가가 '내 판매가격' 자리를 대신 채우지 않는다", () => {
    // 채우면 셀러는 이미 그 가격으로 팔기로 되어 있다고 읽는다.
    const plan = noPlan.find((r) => r.key === "SELLER_PLANNED_PRICE")!;
    expect(plan.value).toBeNull();
    expect(plan.empty?.chip).toBe("⚪ 확인 불가");
  });

  it("원본가격·환산·국제배송·착지원가는 그대로 값을 갖는다", () => {
    for (const key of ["SOURCE_ORIGINAL_PRICE", "SOURCE_PRICE_KRW", "INTERNATIONAL_SHIPPING", "LANDED_COST"]) {
      expect(noPlan.find((r) => r.key === key)?.value).not.toBeNull();
    }
  });
});

describe("국내 검색 결과가 없어도 수익성 계산은 그대로다", () => {
  const empty = buildMarketContext({
    domesticBasis: "NONE",
    domesticAveragePriceKrw: null,
    domesticLowestPriceKrw: null,
    domesticSellerCount: 0,
    domesticUnresolved: false,
    overseasMarketCount: 4,
  });

  it("국내 비교상품은 '검색 데이터 없음'이다 — 판단 실패가 아니다", () => {
    expect(empty.competitiveness).toBe("NO_DATA");
    expect(empty.comparable.value).toBeNull();
    expect(empty.comparable.empty?.kind).toBe("NO_SEARCH_DATA");
    expect(empty.comparable.empty?.chip).toBe("⚪ 검색 데이터 없음");
  });

  it("무너지는 것은 가격 경쟁력 하나뿐이라고 화면이 직접 말한다", () => {
    expect(empty.competitivenessNote).toContain("시장 경쟁가격은 확인할 수 없습니다");
    expect(empty.competitivenessNote).toContain("원가·수익 계산은 그대로");
  });

  it("같은 입력으로 만든 사슬은 여섯 줄 전부 계산된 채로 남는다", () => {
    // buildMarketContext와 buildPriceChain은 서로의 입력을 받지 않는다 —
    // 국내가 비었다고 마진이 사라지는 코드가 들어올 자리 자체가 없다.
    const rows = buildPriceChain(CHAIN);
    for (const row of rows) {
      expect(row.value, `${row.label}이(가) 비었다`).not.toBeNull();
    }
  });
});

describe("해외 시장 가격은 국내 경쟁가로 흘러들 수 없다", () => {
  it("해외 관측이 아무리 많아도 국내 비교상품 칸을 채우지 않는다", () => {
    const context = buildMarketContext({
      domesticBasis: "NONE",
      domesticAveragePriceKrw: null,
      domesticLowestPriceKrw: null,
      domesticSellerCount: 0,
      domesticUnresolved: false,
      overseasMarketCount: 12,
    });
    expect(context.comparable.value).toBeNull();
    expect(context.overseas.count).toBe(12);
  });

  it("해외 블록은 그 값이 한국 경쟁가가 아니라는 사실을 항상 함께 말한다", () => {
    const context = buildMarketContext(MARKET);
    expect(context.overseas.label).toContain("해외 시장 참고");
    expect(context.overseas.note).toContain("국내 비교상품 가격으로 쓰지 않습니다");
  });

  it("시장을 확정하지 못하면 아무 시장 가격이나 국내 비교상품이라고 부르지 않는다", () => {
    const context = buildMarketContext({ ...MARKET, domesticUnresolved: true });
    expect(context.competitiveness).toBe("UNRESOLVED");
    expect(context.comparable.value).toBeNull();
    expect(context.comparable.empty?.kind).toBe("UNVERIFIABLE");
    expect(context.competitivenessNote).toContain("원가·수익 계산은 그대로");
  });

  it("동일상품이 아닌 참고가뿐이면 그 사실을 밝히되 원가 계산은 건드리지 않는다", () => {
    const context = buildMarketContext({ ...MARKET, domesticBasis: "COMPARISON" });
    expect(context.competitiveness).toBe("REFERENCE_ONLY");
    expect(context.comparable.basis).toContain("비교상품 참고가 기준");
    expect(context.competitivenessNote).toContain("원가·수익 계산은 그대로");
  });
});
