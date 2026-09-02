import { describe, expect, it } from "vitest";
import { computePriceRecommendation } from "../price-recommendation";

describe("computePriceRecommendation", () => {
  it("대표님 예시: 국내 최저가가 있으면 최저가 근접 competitivePrice를 추천한다", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 101000,
      currentSellingPriceKrw: 149000,
      domesticLowestPriceKrw: 129000,
      domesticAveragePriceKrw: 139000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.minimumPrice).toBeLessThanOrEqual(result.recommendedPrice);
    expect(result.competitivePrice).not.toBeNull();
    expect(result.competitivePrice!).toBeLessThan(129000);
    expect(result.recommendedPrice).toBe(result.competitivePrice);
  });

  it("국내 경쟁가격이 없으면 competitivePrice는 null, 추천가는 targetPrice", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.competitivePrice).toBeNull();
    expect(result.recommendedPrice).toBe(result.targetPrice);
  });

  it("경쟁가격이 최소마진 가격보다 낮으면 절대 minimumPrice 밑으로 추천하지 않는다", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 200000,
      currentSellingPriceKrw: 210000,
      domesticLowestPriceKrw: 150000, // 원가+최소마진보다 훨씬 낮음
      domesticAveragePriceKrw: 160000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.recommendedPrice).toBeGreaterThanOrEqual(result.minimumPrice);
    expect(result.recommendedPrice).toBe(result.minimumPrice);
  });

  it("minimumPrice < targetPrice(마진율이 클수록 기준가가 높다)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(result.minimumPrice).toBeLessThan(result.targetPrice);
  });
});

describe("computePriceRecommendation — P-13A CPO 2차 검증 항목 3/5: 브랜드 시장 데이터와 국내 최저가/원가의 우선순위·분리", () => {
  it("항목 5: 국내 최저가가 있으면 brandMedianPriceKrw가 있어도 무시된다(domesticLowest가 항상 우선)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: 129000,
      domesticAveragePriceKrw: 139000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
      brandMedianPriceKrw: 300000, // 국내 최저가와 크게 다른 값이어도 영향 없어야 한다
    });
    expect(result.competitiveBasis).toBe("DOMESTIC_LOWEST");
  });

  it("항목 3: brandMedianPriceKrw가 없으면(INSUFFICIENT라 서버가 null로 걸렀을 때와 동일 조건) competitiveBasis가 null이고 추천가는 targetPrice와 같다 — 브랜드 데이터 없을 때와 완전히 동일하게 동작", () => {
    const withoutBrand = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
      brandMedianPriceKrw: null,
    });
    const noBrandFieldAtAll = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(withoutBrand.competitiveBasis).toBeNull();
    expect(withoutBrand.recommendedPrice).toBe(withoutBrand.targetPrice);
    expect(withoutBrand).toEqual(noBrandFieldAtAll);
  });

  it("국내 최저가 없고 brandMedianPriceKrw만 있으면 competitiveBasis는 BRAND_MEDIAN, 추천가는 중앙값의 95%를 넘지 않는다", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 50000,
      currentSellingPriceKrw: 100000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 50, // targetPrice를 일부러 높게 잡아 브랜드 중앙값이 실제로 상한 역할을 하는지 확인
      brandMedianPriceKrw: 120000,
    });
    expect(result.competitiveBasis).toBe("BRAND_MEDIAN");
    expect(result.recommendedPrice).toBeLessThanOrEqual(Math.round(120000 * 0.95));
  });

  it("brandMedianPriceKrw가 targetPrice보다 훨씬 높아도 추천가가 targetPrice 위로 올라가지 않는다(브랜드 데이터가 가격을 밀어올리지 않는다)", () => {
    const result = computePriceRecommendation({
      totalCostKrw: 100000,
      currentSellingPriceKrw: 150000,
      domesticLowestPriceKrw: null,
      domesticAveragePriceKrw: null,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
      brandMedianPriceKrw: 1000000,
    });
    expect(result.recommendedPrice).toBeLessThanOrEqual(result.targetPrice);
  });
});

/**
 * P-24 Sprint 4/9(CPO 지시, 2026-09-02) — 실측(PèPè): 판매가가 아직 확정되지
 * 않은(currentSellingPriceKrw=null인) 실제 프로덕션 대부분의 상품에서도 이
 * 함수가 시장가 기준 추천가를 내야 한다. currentSellingPriceKrw는 이 함수
 * 본문 어디서도 쓰이지 않는 값이라(위 CASE들과 동일 계산) optional로 바꿔도
 * 결과가 달라지지 않는다는 것을 고정한다. 원인 조사에서 발견된 실제 버그:
 * market-intelligence.ts가 currentSellingPriceKrw!=null일 때만 이 함수를
 * 호출해서, 판매가 미확정 상품은 항상 cost.suggestedPriceKrw(시장가 무관
 * 원가×목표마진 역산)를 "추천 판매가"로 보여줬다 — 실제 PèPè 사례에서 국내
 * EXACT 최저가 ₩258,000이 있는데도 ₩346,286을 추천한 근본 원인이다.
 */
describe("computePriceRecommendation — P-24: currentSellingPriceKrw 없이도(판매가 미확정) 시장가 기준 추천가를 낸다", () => {
  it("T4/T5 — PèPè 실측과 같은 패턴(목표마진가 > 국내 EXACT 최저가 ₩258,000, 최소마진가는 시장가 아래) — 추천가는 목표마진가를 그대로 쓰지 않고 시장가에 근접한 값으로 낮아진다", () => {
    // 계산 검증(node -e로 직접 재현): minimumPrice=244,444 / targetPrice=275,000 /
    // competitivePrice=255,420 / recommendedPrice=255,420 — 손으로 재계산해
    // 확인한 값이다(추측 아님).
    const result = computePriceRecommendation({
      totalCostKrw: 220000,
      domesticLowestPriceKrw: 258000,
      domesticAveragePriceKrw: 258000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20, // 목표마진 기준가(cost.suggestedPriceKrw와 동일한 성격 — 시장가 무시)가 시장가보다 높게 나오는 조건
    });
    expect(result.minimumPrice).toBe(244444);
    expect(result.targetPrice).toBe(275000);
    // T4 — 시장가보다 높은 목표 마진 가격이 그대로 추천가가 되면 안 된다.
    expect(result.targetPrice).toBeGreaterThan(258000);
    expect(result.recommendedPrice).toBeLessThan(result.targetPrice);
    // T5 — 국내 최저가(₩258,000)에 근접한, 최소마진 이상을 보장하는 값으로 추천된다.
    expect(result.recommendedPrice).toBe(255420);
    expect(result.recommendedPrice).toBeLessThan(258000);
    expect(result.recommendedPrice).toBeGreaterThanOrEqual(result.minimumPrice);
    expect(result.competitiveBasis).toBe("DOMESTIC_LOWEST");
  });

  it("currentSellingPriceKrw를 생략해도 값을 넘겼을 때와 완전히 동일한 결과를 낸다(내부에서 쓰이지 않는 필드)", () => {
    const withValue = computePriceRecommendation({
      totalCostKrw: 242400,
      currentSellingPriceKrw: 999999,
      domesticLowestPriceKrw: 258000,
      domesticAveragePriceKrw: 258000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    const withoutValue = computePriceRecommendation({
      totalCostKrw: 242400,
      domesticLowestPriceKrw: 258000,
      domesticAveragePriceKrw: 258000,
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(withoutValue).toEqual(withValue);
  });
});
