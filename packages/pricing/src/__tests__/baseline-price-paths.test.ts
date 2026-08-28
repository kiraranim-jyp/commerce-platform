import { describe, expect, it } from "vitest";
import { computePriceBreakdown } from "../breakdown";
import { computePriceDecision } from "../price-decision";

/**
 * P-1-3 STEP 1(대표님 지시, 2026-08-28) — "코드 변경 전에 먼저 현재 계산
 * 결과를 고정한다." 이 파일은 기존 계산식(computePriceBreakdown/
 * computePriceDecision)을 단 한 줄도 바꾸지 않고, 5개 상품 시나리오(고마진/
 * 저마진/손실위험/해외가격만존재/국내경쟁가격존재)에 대해 두 경로가 실제로
 * 반환하는 값을 그대로 고정한다 — P-1-3 STEP 2 이후 UnifiedPriceDecision을
 * 도입했을 때 "왜 결과가 달라졌는지"를 이 파일과 diff해서 정확히 추적하기
 * 위한 기준선이다.
 *
 * PriceEditor.tsx(경로 A)가 실제로 하는 계산(finalPriceKrw/feeAmountKrw/
 * netProfitKrw, PriceEditor.tsx:261-263)을 그대로 재현해서 경로 B
 * (computePriceBreakdown)와 경로 C(computePriceDecision)를 나란히 비교한다.
 * 값은 전부 실제 함수를 호출해 얻은 것이고(손계산 아님), FIXED_RATES_TO_KRW
 * (currency.ts)만 사용해 liveRates 없이 결정론적으로 재현 가능하다.
 *
 * 핵심 관찰(대표님이 지적하신 "계산 경로가 두 개" 문제의 실측 증거):
 * 모든 케이스에서 경로 A/B의 "마진"(배송비+수수료를 뺀 실제 순이익률)과
 * 경로 C의 marginPercent(해외 원가만 빼고 배송비/수수료 전혀 미반영)가
 * 서로 다른 숫자를 낸다 — 대부분 경로 C가 실제보다 훨씬 높은 마진으로
 * 나온다(Case 1: 30.0% vs 46.3%, Case 2: 8.0% vs 26.5%, Case 5: 25.0% vs
 * 43.4%). Case 3(손실위험)만 방향은 같지만(둘 다 음수) 심각도가 다르다
 * (-41.0% vs -11.0%).
 */
function computePathA_B(input: {
  originalAmount: number;
  originalCurrency: string;
  shippingKrw: number;
  feePercent: number;
  marginPercent: number;
  overrideSellingPriceKrw?: number;
}) {
  const breakdown = computePriceBreakdown(
    {
      originalAmount: input.originalAmount,
      originalCurrency: input.originalCurrency,
      shippingKrw: input.shippingKrw,
      feePercent: input.feePercent,
      marginPercent: input.marginPercent,
    },
    undefined,
    10,
  );
  // PriceEditor.tsx:261-263과 동일한 계산 — 사용자가 판매가를 직접 override
  // 하지 않았으면 breakdown.suggestedPriceKrw를 그대로 쓴다.
  const finalPriceKrw = input.overrideSellingPriceKrw ?? breakdown.suggestedPriceKrw;
  const feeAmountKrw = Math.round((finalPriceKrw * input.feePercent) / 100);
  const netProfitKrw = finalPriceKrw - breakdown.landedCostKrw - feeAmountKrw;
  return { breakdown, finalPriceKrw, feeAmountKrw, netProfitKrw };
}

describe("P-1-3 STEP 1: 기존 계산 경로 3개 기준선 고정(코드 미변경)", () => {
  it("Case 1 — 고마진: GBP £59, shipping ₩12,000, fee 10%, margin 30% → 경로A/B netProfit 30.0% vs 경로C marginPercent 46.3%", () => {
    const { breakdown, finalPriceKrw, feeAmountKrw, netProfitKrw } = computePathA_B({
      originalAmount: 59,
      originalCurrency: "GBP",
      shippingKrw: 12000,
      feePercent: 10,
      marginPercent: 30,
    });
    expect(breakdown.costKrw).toBe(102660);
    expect(breakdown.landedCostKrw).toBe(114660);
    expect(breakdown.suggestedPriceKrw).toBe(191100);
    expect(finalPriceKrw).toBe(191100);
    expect(feeAmountKrw).toBe(19110);
    expect(netProfitKrw).toBe(57330);
    expect(Number(((netProfitKrw / finalPriceKrw) * 100).toFixed(1))).toBe(30);

    const decision = computePriceDecision({
      costPriceKrw: breakdown.costKrw,
      currentSellingPriceKrw: finalPriceKrw,
      domesticAveragePriceKrw: 220000,
      domesticLowestPriceKrw: 210000,
    });
    expect(decision.marginPercent).toBe(46.3);
    expect(decision.verdict).toBe("MAINTAIN");
  });

  it("Case 2 — 저마진: EUR €70, shipping ₩12,000, fee 10%, margin 8% → 경로A/B netProfit 8.0%(저마진)인데 경로C는 26.5%로 GREEN 오판", () => {
    const { breakdown, finalPriceKrw, feeAmountKrw, netProfitKrw } = computePathA_B({
      originalAmount: 70,
      originalCurrency: "EUR",
      shippingKrw: 12000,
      feePercent: 10,
      marginPercent: 8,
    });
    expect(breakdown.costKrw).toBe(103600);
    expect(breakdown.landedCostKrw).toBe(115600);
    expect(breakdown.suggestedPriceKrw).toBe(140980);
    expect(finalPriceKrw).toBe(140980);
    expect(feeAmountKrw).toBe(14098);
    expect(netProfitKrw).toBe(11282);
    expect(Number(((netProfitKrw / finalPriceKrw) * 100).toFixed(1))).toBe(8);

    const decision = computePriceDecision({
      costPriceKrw: breakdown.costKrw,
      currentSellingPriceKrw: finalPriceKrw,
      domesticAveragePriceKrw: 145000,
      domesticLowestPriceKrw: 138000,
    });
    // 실제 순이익률은 8%(저마진 경계)인데, 배송비/수수료를 전혀 빼지 않는
    // 경로C는 26.5%로 계산해 verdict=MAINTAIN(GREEN)을 낸다 — 셀러가 대시보드만
    // 보면 "괜찮은 상품"으로 오판할 수 있는 실제 사례.
    expect(decision.marginPercent).toBe(26.5);
    expect(decision.verdict).toBe("MAINTAIN");
  });

  it("Case 3 — 손실위험: EUR €45, 판매가 직접 ₩60,000으로 원가보다 낮게 설정 → 두 경로 모두 손실로 판정하지만 심각도가 다르다(-41.0% vs -11.0%)", () => {
    const { breakdown, finalPriceKrw, feeAmountKrw, netProfitKrw } = computePathA_B({
      originalAmount: 45,
      originalCurrency: "EUR",
      shippingKrw: 12000,
      feePercent: 10,
      marginPercent: 15,
      overrideSellingPriceKrw: 60000,
    });
    expect(breakdown.costKrw).toBe(66600);
    expect(breakdown.landedCostKrw).toBe(78600);
    expect(finalPriceKrw).toBe(60000);
    expect(feeAmountKrw).toBe(6000);
    expect(netProfitKrw).toBe(-24600);
    expect(Number(((netProfitKrw / finalPriceKrw) * 100).toFixed(1))).toBe(-41);

    const decision = computePriceDecision({
      costPriceKrw: breakdown.costKrw,
      currentSellingPriceKrw: finalPriceKrw,
      domesticAveragePriceKrw: 75000,
      domesticLowestPriceKrw: 70000,
    });
    expect(decision.marginPercent).toBe(-11);
    expect(decision.verdict).toBe("MARGIN_RISK");
  });

  it("Case 4 — 해외가격만 존재(국내 경쟁가 없음): GBP £35 → 경로C는 국내 데이터 없이 마진만으로 MAINTAIN 판정", () => {
    const { breakdown, finalPriceKrw, feeAmountKrw, netProfitKrw } = computePathA_B({
      originalAmount: 35,
      originalCurrency: "GBP",
      shippingKrw: 12000,
      feePercent: 10,
      marginPercent: 20,
    });
    expect(breakdown.costKrw).toBe(60900);
    expect(finalPriceKrw).toBe(104140);
    expect(feeAmountKrw).toBe(10414);
    expect(netProfitKrw).toBe(20826);
    expect(Number(((netProfitKrw / finalPriceKrw) * 100).toFixed(1))).toBe(20);

    const decision = computePriceDecision({
      costPriceKrw: breakdown.costKrw,
      currentSellingPriceKrw: finalPriceKrw,
      domesticAveragePriceKrw: null,
      domesticLowestPriceKrw: null,
    });
    expect(decision.marginPercent).toBe(41.5);
    expect(decision.priceGapVsAveragePercent).toBeNull();
    expect(decision.verdict).toBe("MAINTAIN");
  });

  it("Case 5 — 국내 경쟁가격 존재(판매가가 더 비쌈): EUR €55 → 경로C는 CONSIDER_LOWER(YELLOW), 경로A/B 마진(25.0%)과 경로C 마진(43.4%) 불일치", () => {
    const { breakdown, finalPriceKrw, feeAmountKrw, netProfitKrw } = computePathA_B({
      originalAmount: 55,
      originalCurrency: "EUR",
      shippingKrw: 12000,
      feePercent: 10,
      marginPercent: 25,
    });
    expect(breakdown.costKrw).toBe(81400);
    expect(finalPriceKrw).toBe(143690);
    expect(feeAmountKrw).toBe(14369);
    expect(netProfitKrw).toBe(35921);
    expect(Number(((netProfitKrw / finalPriceKrw) * 100).toFixed(1))).toBe(25);

    const decision = computePriceDecision({
      costPriceKrw: breakdown.costKrw,
      currentSellingPriceKrw: finalPriceKrw,
      domesticAveragePriceKrw: 120000,
      domesticLowestPriceKrw: 115000,
    });
    expect(decision.marginPercent).toBe(43.4);
    expect(decision.priceGapVsAveragePercent).toBe(19.7);
    expect(decision.priceGapVsLowestPercent).toBe(24.9);
    expect(decision.verdict).toBe("CONSIDER_LOWER");
  });
});
