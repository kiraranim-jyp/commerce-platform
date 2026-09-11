import { describe, expect, it } from "vitest";
import { buildHeadlineNumbers, formatOriginAmount, type HeadlineNumbersInput } from "../mi-headline";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 헤드라인 숫자는 기준 없이 나가지 않는다.
 *
 * 고정하려는 실제 버그: 헤드라인에 "€37 ≈ ₩57,756"이 떠 있었다. 그 두 값은
 * 같은 가격의 다른 표기가 아니라 *원본 판매자 페이지 가격*과 *환산값*이고,
 * 바로 옆에는 한국 시장에서 관측된 전혀 다른 가격이 있다. 등식으로 이으면
 * 셀러는 "한국에서도 5만 8천 원"이라는 없는 사실을 읽는다.
 */
const BASE: HeadlineNumbersInput = {
  originPrice: { amount: 37, currency: "EUR" },
  targetMarketAveragePriceKrw: 78000,
  targetMarketLowestPriceKrw: 69000,
  targetMarketBasis: "EXACT",
  targetMarketUnresolved: false,
  landedCostKrw: 57756,
  recommendedMarginPercent: 26.4,
  currentMarginPercent: null,
};

describe("buildHeadlineNumbers()", () => {
  it("네 칸 모두 기준 라벨을 갖는다", () => {
    for (const n of buildHeadlineNumbers(BASE)) {
      expect(n.label.length).toBeGreaterThan(0);
      expect(n.basis).not.toBeNull();
    }
  });

  it("원본 판매가격은 원본 통화 그대로 두고 원화와 잇지 않는다", () => {
    const origin = buildHeadlineNumbers(BASE).find((n) => n.key === "originPrice")!;
    expect(origin.value).toContain("37");
    // 원화로 환산하거나 "≈"로 두 통화를 잇지 않는다.
    expect(origin.value).not.toContain("₩");
    expect(origin.value).not.toContain("≈");
    expect(origin.basis).toBe("원본 판매자 페이지 기준");
  });

  it("한국 시장 가격은 평균가를 대표값으로 쓰고 어느 기준인지 밝힌다", () => {
    const kr = buildHeadlineNumbers(BASE).find((n) => n.key === "targetMarketPrice")!;
    expect(kr.value).toBe("₩78,000");
    expect(kr.basis).toContain("평균가");
    expect(kr.basis).toContain("동일상품");
  });

  it("평균가가 없으면 최저가를 쓰되 최저가라고 말한다", () => {
    const kr = buildHeadlineNumbers({ ...BASE, targetMarketAveragePriceKrw: null }).find(
      (n) => n.key === "targetMarketPrice",
    )!;
    expect(kr.value).toBe("₩69,000");
    expect(kr.basis).toContain("최저가");
  });

  it("국내 근거가 없으면 값을 지어내지 않고 '검색 데이터 없음'으로 둔다", () => {
    const kr = buildHeadlineNumbers({
      ...BASE,
      targetMarketBasis: "NONE",
      targetMarketAveragePriceKrw: null,
      targetMarketLowestPriceKrw: null,
    }).find((n) => n.key === "targetMarketPrice")!;
    expect(kr.value).toBeNull();
    expect(kr.empty?.kind).toBe("NO_SEARCH_DATA");
  });

  it("시장을 확정하지 못했으면 아무 시장 가격이나 한국 가격이라고 부르지 않는다", () => {
    const kr = buildHeadlineNumbers({
      ...BASE,
      targetMarketBasis: "COMPARISON",
      targetMarketAveragePriceKrw: null,
      targetMarketLowestPriceKrw: null,
      targetMarketUnresolved: true,
    }).find((n) => n.key === "targetMarketPrice")!;
    expect(kr.value).toBeNull();
    expect(kr.empty?.kind).toBe("UNVERIFIABLE");
    expect(kr.empty?.reason).toContain("여러 개");
  });

  it("추천가 기준 마진이 없으면 현재 판매가 기준 마진으로 떨어지고 그 사실을 밝힌다", () => {
    const margin = buildHeadlineNumbers({
      ...BASE,
      recommendedMarginPercent: null,
      currentMarginPercent: 12,
    }).find((n) => n.key === "estimatedMargin")!;
    expect(margin.value).toBe("12.0%");
    expect(margin.basis).toBe("현재 판매가 기준");
  });

  it("원본 가격을 못 읽으면 원가·마진을 0으로 만들지 않는다", () => {
    const numbers = buildHeadlineNumbers({ ...BASE, originPrice: null, landedCostKrw: null });
    const origin = numbers.find((n) => n.key === "originPrice")!;
    const landed = numbers.find((n) => n.key === "landedCost")!;
    expect(origin.value).toBeNull();
    expect(landed.value).toBeNull();
    expect(landed.empty?.kind).toBe("UNVERIFIABLE");
  });
});

describe("formatOriginAmount()", () => {
  it("Intl이 받아들이지 못하는 통화 코드에서도 숫자를 잃지 않는다", () => {
    // Intl은 3자 코드면 모르는 통화라도 그대로 붙여 주지만(예: "XYZ"),
    // 형식 자체가 통화 코드가 아니면 RangeError를 던진다. 그때 화면이 죽거나
    // 통화를 지어내지 않고 값과 코드를 그대로 보여준다.
    expect(formatOriginAmount(1200, "EURO_")).toBe("1,200 EURO_");
  });

  it("원화는 소수점을 만들지 않는다", () => {
    expect(formatOriginAmount(78000, "KRW")).not.toContain(".");
  });
});
