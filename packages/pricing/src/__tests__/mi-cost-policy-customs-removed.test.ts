import { describe, expect, it } from "vitest";
import {
  computePriceBreakdown,
  computePriceDecision,
  computePriceRecommendation,
  computeRadar,
  computeUnifiedPriceDecision,
  sellerDecisionStateFromUnifiedDecision,
  type PriceComponent,
  type UnifiedPriceInput,
} from "../index";

/**
 * MI-COST-POLICY-1 FINAL(대표님 결정, 2026-09-12) —
 * "관세·부가세는 구매자 부담이며 판매자 가격/수익성 계산에 포함하지 않는다."
 *
 * ── 이 파일이 막는 회귀 ────────────────────────────────────────────────
 * 이전 시도는 화면에서만 관부가세를 숨기려다 멈췄다. 숨기고 계산에 남기면
 * 셀러가 볼 수 없는 돈이 마진을 깎는 상태가 되고, 그건 화면이 거짓말을 하는
 * 것이다. 그래서 이번에는 LANDED_COST_PARTS에서 빼는 방식으로 계산 경로에서
 * 제거했다. 이 테스트가 고정하는 것은 그 사실 하나다: **입력에 관부가세가
 * 들어와도 결과가 한 글자도 달라지지 않는다.** 값이 있든(actual) 없든
 * (unknown) 넣지 않았든 셋이 전부 같은 답이어야 한다 — 하나라도 다르면
 * 어딘가에서 다시 읽고 있다는 뜻이다.
 */
function pc(value: number | null, status: PriceComponent["status"], source?: string): PriceComponent {
  return { value, status, source };
}

/** 관부가세 외에는 아무것도 모자라지 않은 입력. 세 변형의 기준선이다. */
const BASE_INPUT: UnifiedPriceInput = {
  sourceProductPriceKrw: pc(150000, "actual"),
  exchangeRate: pc(1, "actual"),
  internationalShippingKrw: pc(15000, "estimated", "seller_default"),
  sellerDomesticShippingCostKrw: pc(5000, "estimated", "SellerProfile.domesticShippingCostKrw"),
  customerChargedShippingKrw: pc(null, "unknown"),
  platformFeeRate: pc(10, "estimated", "default"),
  currentSellingPriceKrw: pc(220000, "actual"),
  domesticCompetitivePrice: { average: 240000, lowest: 228000 },
};

describe("MI-COST-POLICY-1 ①: 관부가세가 입력에 있어도 계산은 움직이지 않는다", () => {
  it("actual 값으로 넣든 / unknown으로 넣든 / 아예 넘기지 않든 결과 객체가 완전히 같다", () => {
    const withoutCustoms = computeUnifiedPriceDecision(BASE_INPUT);
    const withActualCustoms = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      customsDutyKrw: pc(13000, "actual", "product.customsDutyKrw"),
      customsVatKrw: pc(18000, "actual", "product.customsVatKrw"),
    });
    const withUnknownCustoms = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      customsDutyKrw: pc(null, "unknown"),
      customsVatKrw: pc(null, "unknown"),
    });

    // toEqual로 객체 전체를 비교하는 것이 핵심이다 — landedCost만 보면
    // missingComponents/dataCompleteness 쪽으로 새는 경로를 놓친다.
    expect(withActualCustoms).toEqual(withoutCustoms);
    expect(withUnknownCustoms).toEqual(withoutCustoms);
  });

  it("착지원가는 판매자가 실제로 부담하는 항목의 합 그대로다 — 관부가세가 낄 자리가 없다", () => {
    const result = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      customsDutyKrw: pc(13000, "actual"),
      customsVatKrw: pc(18000, "actual"),
    });
    // 150,000(해외 상품가) + 15,000(국제배송비)
    // MI-UX-FINAL-4(2026-09-13) — 세 번째 항목이던 국내 배송원가 5,000이 빠져
    // 170,000 → 165,000이 됐다. 이 파일의 주제(관부가세)는 그대로다.
    expect(result.landedCostKrw.value).toBe(165000);
    // 관부가세가 더해졌다면 196,000이었을 것이다.
    expect(result.landedCostKrw.value).not.toBe(196000);
  });
});

describe("MI-COST-POLICY-1 ②: 관부가세를 몰라도 데이터 완전성이 깎이지 않는다", () => {
  it("missingComponents에 관세/부가세가 오르지 않고, 그 이유로 INCOMPLETE가 되지 않는다", () => {
    const result = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      customsDutyKrw: pc(null, "unknown"),
      customsVatKrw: pc(null, "unknown"),
    });
    expect(result.missingComponents).toEqual([]);
    expect(result.missingComponents).not.toContain("관세");
    expect(result.missingComponents).not.toContain("부가세");
    expect(result.dataCompleteness).not.toBe("INCOMPLETE");
    // 🟠 "비용 확인 필요"는 관부가세를 몰라서 뜨는 상태가 더 이상 아니다.
    expect(sellerDecisionStateFromUnifiedDecision(result).code).not.toBe("NEEDS_COST_INFO");
  });

  it("여전히 판매자 원가인 국제배송비를 모르면 INCOMPLETE다 — 완전성 판정을 통째로 약화시킨 게 아니다", () => {
    // MI-UX-FINAL-4(2026-09-13) — 예전에는 이 자리가 국내 배송원가였다. 그 값이
    // 착지원가에서 빠지면서, "원가인데 모르는 항목"의 예시를 실제로 원가인
    // 항목으로 바꿨다. 검사하는 성질은 한 글자도 달라지지 않았다.
    const result = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      internationalShippingKrw: pc(null, "unknown"),
      customsDutyKrw: pc(null, "unknown"),
      customsVatKrw: pc(null, "unknown"),
    });
    expect(result.missingComponents).toEqual(["국제배송비"]);
    expect(result.dataCompleteness).toBe("INCOMPLETE");
  });
});

/**
 * ③ 대표님께 보고할 "숫자가 얼마나 움직이는가"를 테스트로 못 박는다.
 *
 * 같은 상품(해외 150,000 + 국제배송 15,000 + 국내배송 5,000, 판매가 220,000,
 * 수수료 10%)에 관세 13,000 · 부가세 18,000이 입력돼 있던 경우:
 *
 *   구정책: 착지원가 201,000 → 예상이익 −3,000 → 마진 −1.4% → MARGIN_RISK/RED
 *   신정책: 착지원가 170,000 → 예상이익 +28,000 → 마진 12.7% → MAINTAIN/GREEN
 *
 * 즉 31,000원(=관세+부가세)만큼 이익이 올라가고 판정이 뒤집힌다. 과거 스냅샷에
 * 남아 있는 판정은 전부 구정책 기준으로 계산된 값이라는 뜻이기도 하다 —
 * 그래서 이 차이를 숨기지 않고 테스트로 적어 둔다.
 */
describe("MI-COST-POLICY-1 ③: 정책 변경이 숫자를 얼마나 움직이는가(실측 예시)", () => {
  const DUTY = 13000;
  const VAT = 18000;
  const input: UnifiedPriceInput = { ...BASE_INPUT, customsDutyKrw: pc(DUTY, "actual"), customsVatKrw: pc(VAT, "actual") };

  it("신정책 — 예상이익 +33,000 / 마진 15.0% / MAINTAIN·GREEN", () => {
    const result = computeUnifiedPriceDecision(input);
    // MI-UX-FINAL-4(2026-09-13) — 국내 배송원가 5,000이 더 빠지면서 이 예시가
    // 한 번 더 움직였다: 170,000 → 165,000, 이익 28,000 → 33,000, 12.7% → 15.0%.
    expect(result.landedCostKrw.value).toBe(165000);
    expect(result.platformFeeKrw.value).toBe(22000);
    expect(result.estimatedProfitKrw.value).toBe(33000);
    expect(result.marginPercent.value).toBe(15);
    expect(result.verdict).toBe("MAINTAIN");
    expect(result.level).toBe("GREEN");
    expect(sellerDecisionStateFromUnifiedDecision(result).code).toBe("READY");
  });

  it("구정책(관부가세를 원가로 치던 계산)을 재현하면 같은 상품이 MARGIN_RISK·RED였다", () => {
    // 엔진에는 더 이상 이 경로가 없으므로, 그때의 costPriceKrw를 손으로
    // 재현해서 computePriceDecision을 직접 부른다(옛 동작을 되살리는 것이
    // 아니라 "무엇이 달라졌는지"를 숫자로 남기기 위해서다).
    const oldLandedCost = 170000 + DUTY + VAT;
    const platformFee = 22000;
    const oldProfit = 220000 - oldLandedCost - platformFee;
    const oldDecision = computePriceDecision({
      costPriceKrw: oldLandedCost + platformFee,
      currentSellingPriceKrw: 220000,
      domesticAveragePriceKrw: 240000,
      domesticLowestPriceKrw: 228000,
    });
    expect(oldLandedCost).toBe(201000);
    expect(oldProfit).toBe(-3000);
    expect(oldDecision.marginPercent).toBe(-1.4);
    expect(oldDecision.verdict).toBe("MARGIN_RISK");

    // 차이는 정확히 "원가에서 빠진 항목들"만큼이다 — 다른 무엇도 함께 바뀌지
    // 않았다. MI-COST-POLICY-1이 뺀 관세+부가세에, MI-UX-FINAL-4가 뺀 국내
    // 배송원가 5,000이 더해져 36,000이다.
    const now = computeUnifiedPriceDecision(input);
    expect(now.estimatedProfitKrw.value! - oldProfit).toBe(DUTY + VAT + 5000);
  });
});

/**
 * ④ 사슬이 끝에서 끝까지 한 기준으로 이어지는가.
 *
 *   상품가격 + 해외배송비 → 착지원가 → 예상이익 → 마진 → CASE → Radar
 *
 * CASE A~D와 Radar 수익성 축은 원래도 computePriceBreakdown(관부가세 없음)
 * 기준이었다. 그래서 이번 변경으로 바뀌는 것이 아니라, **어느 단계에
 * 관부가세를 넣어도 흔들리지 않는다**는 사실을 여기서 고정한다. 예전에는
 * 화면의 착지원가(관부가세 없음)와 예상 수익(관부가세 있음)이 서로 다른
 * 기준이라 "판매가 − 착지원가 − 수수료"가 맞지 않았다 — 그 어긋남이 사라진다.
 */
describe("MI-COST-POLICY-1 ④: 상품가격 + 해외배송비 → 착지원가 → 예상이익 → 마진 → CASE → Radar", () => {
  const breakdown = computePriceBreakdown({
    originalAmount: 150000,
    originalCurrency: "KRW",
    shippingKrw: 15000,
    feePercent: 10,
    marginPercent: 20,
  });

  it("① 상품가격 + 해외배송비 = 착지원가", () => {
    expect(breakdown.costKrw).toBe(150000);
    expect(breakdown.landedCostKrw).toBe(150000 + 15000);
  });

  it("② 통합 판단의 착지원가는 그 값과 정확히 같다 — 제3의 항목이 없다", () => {
    // MI-UX-FINAL-4(2026-09-13) — 예전에는 여기에 국내 배송원가 5,000이 더
    // 붙어서, 상세 계산의 착지원가와 판단의 착지원가가 서로 다른 숫자였다.
    // 이제 두 경로가 같은 값을 말한다.
    const unified = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      customsDutyKrw: pc(13000, "actual"),
      customsVatKrw: pc(18000, "actual"),
    });
    expect(unified.landedCostKrw.value).toBe(breakdown.landedCostKrw);
  });

  it("③ 예상이익 = 판매가 − 착지원가 − 수수료, ④ 마진 = 예상이익 / 판매가 (손으로 계산한 값과 일치)", () => {
    const unified = computeUnifiedPriceDecision(BASE_INPUT);
    const selling = BASE_INPUT.currentSellingPriceKrw.value!;
    const expectedProfit = selling - unified.landedCostKrw.value - unified.platformFeeKrw.value!;
    expect(unified.estimatedProfitKrw.value).toBe(expectedProfit);
    expect(unified.marginPercent.value).toBe(Number(((expectedProfit / selling) * 100).toFixed(1)));
  });

  it("⑤ CASE 판정은 착지원가 하나만 보고 갈린다 — 관부가세를 원가에 태워도 태우지 않아도 같은 CASE A다", () => {
    const recommendation = computePriceRecommendation({
      totalCostKrw: breakdown.landedCostKrw,
      domesticLowestPriceKrw: 228000,
      domesticAveragePriceKrw: 240000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(recommendation.marketCase).toBe("A");
    expect(recommendation.recommendedPrice).toBe(225720);

    // computePriceBreakdown에는 관부가세를 넣을 인자 자체가 없다(그래서
    // CASE는 구조적으로 관부가세와 무관하다). 같은 입력을 다시 계산해도
    // 같은 CASE라는 것이 그 구조의 증거다.
    const again = computePriceRecommendation({
      totalCostKrw: computePriceBreakdown({
        originalAmount: 150000,
        originalCurrency: "KRW",
        shippingKrw: 15000,
        feePercent: 10,
        marginPercent: 20,
      }).landedCostKrw,
      domesticLowestPriceKrw: 228000,
      domesticAveragePriceKrw: 240000,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: 20,
    });
    expect(again).toEqual(recommendation);
  });

  it("⑥ Radar 수익성 축은 그 CASE를 그대로 받는다 — 관부가세가 등급을 낮추는 경로가 없다", () => {
    const radar = computeRadar({
      marketCase: "A",
      landedCostKrw: breakdown.landedCostKrw,
      recommendedPriceKrw: 225720,
      domesticLowestPriceKrw: 228000,
      domesticAveragePriceKrw: 240000,
      domesticBasis: "EXACT",
      searchInterest: "medium",
      bestMatchTruth: "EXACT_IDENTIFIER",
    });
    const profitability = radar.axes.find((a) => a.key === "profitability");
    expect(profitability?.state).toEqual({ status: "SCORED", level: "HIGH" });
    // 축 구조 자체는 그대로다(네 축, 이름/순서 불변) — 이번 지시는 축을
    // 없애거나 더하는 일이 아니다.
    expect(radar.axes.map((a) => a.key)).toEqual([
      "profitability",
      "priceCompetitiveness",
      "marketDemand",
      "matchConfidence",
    ]);
  });
});
