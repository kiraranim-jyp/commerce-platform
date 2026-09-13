import { describe, expect, it } from "vitest";
import {
  computePriceBreakdown,
  computePriceDecision,
  computeUnifiedPriceDecision,
  sellerDecisionStateFromUnifiedDecision,
  type PriceComponent,
  type UnifiedPriceInput,
} from "../index";

/**
 * MI-UX-FINAL-4(대표님 결정, 2026-09-13) — **판매자 부담 비용(국내 배송원가)을
 * 판매 판단 계산에서 뺀다.**
 *
 * ── 왜 이번엔 뺐나 ──────────────────────────────────────────────────────
 * 이 값은 P-3-2에서 LANDED_COST_PARTS에 들어갔고, 그 뒤로 착지원가 → 예상이익
 * → 마진 → verdict까지 그대로 흘렀다. 지난 두 번의 UX 지시에서는 STOP이었다:
 * 계산에 들어가는 값을 화면에서만 지우면, 셀러가 보지도 고치지도 못하는 숫자가
 * 계속 마진을 깎는다. 이번에 대표님이 제거를 결정했고, 8ac100d(관부가세)가
 * 세운 순서를 그대로 따랐다 — 엔진에서 먼저 빼고, 그 결과로 물어볼 이유가
 * 사라진 화면 블록을 없앴다.
 *
 * ── 이 파일이 막는 회귀 ────────────────────────────────────────────────
 * 하나다: **입력에 이 값이 들어와도 결과가 한 글자도 달라지지 않는다.** 값이
 * 있든(actual) 없든(unknown) 넘기지 않든 셋이 전부 같은 답이어야 한다 —
 * 하나라도 다르면 어딘가에서 다시 읽고 있다는 뜻이다.
 *
 * 그리고 숫자가 **얼마나** 움직였는지를 숨기지 않고 적는다. 과거 스냅샷에 남은
 * 판정은 전부 옛 기준으로 계산된 값이라는 뜻이기도 하다(그 기록은 고치지 않는다).
 */
function pc(value: number | null, status: PriceComponent["status"], source?: string): PriceComponent {
  return { value, status, source };
}

/** 국내 배송원가 외에는 아무것도 모자라지 않은 입력. 세 변형의 기준선이다. */
const BASE_INPUT: UnifiedPriceInput = {
  sourceProductPriceKrw: pc(150000, "actual"),
  exchangeRate: pc(1, "actual"),
  internationalShippingKrw: pc(15000, "estimated", "seller_default"),
  customerChargedShippingKrw: pc(null, "unknown"),
  platformFeeRate: pc(10, "estimated", "default"),
  currentSellingPriceKrw: pc(220000, "actual"),
  domesticCompetitivePrice: { average: 240000, lowest: 228000 },
};

/** Settings의 판매자 공통 기본값에서 오던 그 숫자. */
const DOMESTIC_SHIPPING = 5000;

describe("MI-UX-FINAL-4 ①: 국내 배송원가가 입력에 있어도 계산은 움직이지 않는다", () => {
  it("actual로 넣든 / unknown으로 넣든 / 아예 넘기지 않든 결과 객체가 완전히 같다", () => {
    const without = computeUnifiedPriceDecision(BASE_INPUT);
    const withActual = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      sellerDomesticShippingCostKrw: pc(DOMESTIC_SHIPPING, "estimated", "SellerProfile.domesticShippingCostKrw"),
    });
    const withUnknown = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      sellerDomesticShippingCostKrw: pc(null, "unknown"),
    });

    // toEqual로 객체 전체를 비교하는 것이 핵심이다 — landedCost만 보면
    // missingComponents/dataCompleteness 쪽으로 새는 경로를 놓친다.
    expect(withActual).toEqual(without);
    expect(withUnknown).toEqual(without);
  });

  it("모른다는 사실이 완전성을 깎지 않는다 — 🟠 비용 확인 필요가 이 값 때문에 뜨는 경로가 없다", () => {
    const result = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      sellerDomesticShippingCostKrw: pc(null, "unknown"),
    });
    expect(result.missingComponents).toEqual([]);
    expect(result.missingComponents).not.toContain("국내 배송원가");
    expect(result.dataCompleteness).not.toBe("INCOMPLETE");
    expect(sellerDecisionStateFromUnifiedDecision(result).code).not.toBe("NEEDS_COST_INFO");
  });

  it("착지원가는 남은 두 항목의 합 그대로다 — 상세 계산의 착지원가와 같은 숫자다", () => {
    const breakdown = computePriceBreakdown({
      originalAmount: 150000,
      originalCurrency: "KRW",
      shippingKrw: 15000,
      feePercent: 10,
      marginPercent: 20,
    });
    const unified = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      sellerDomesticShippingCostKrw: pc(DOMESTIC_SHIPPING, "estimated"),
    });
    // 예전에는 이 둘이 5,000만큼 달랐다 — 같은 카드 안에서 "착지원가"라는
    // 한 이름이 두 숫자를 가리키고 있었다는 뜻이다.
    expect(unified.landedCostKrw.value).toBe(breakdown.landedCostKrw);
    expect(unified.landedCostKrw.value).toBe(165000);
  });
});

/**
 * ② 대표님께 보고할 "숫자가 얼마나 움직이는가".
 *
 * 같은 상품(해외 150,000 + 국제배송 15,000, 판매가 220,000, 수수료 10%)에
 * 국내 배송원가 5,000이 Settings 기본값으로 들어가 있던 경우:
 *
 *   구정책: 착지원가 170,000 → 예상이익 +28,000 → 마진 12.7%
 *   신정책: 착지원가 165,000 → 예상이익 +33,000 → 마진 15.0%
 *
 * 이익이 정확히 5,000원 올라가고 마진이 2.3%p 올라간다. 판정(verdict)은 이
 * 예시에서 뒤집히지 않지만(둘 다 MAINTAIN), 목표 마진 근처의 상품에서는
 * 뒤집힌다 — 아래 케이스가 그 경계를 직접 보여준다.
 */
describe("MI-UX-FINAL-4 ②: 정책 변경이 숫자를 얼마나 움직이는가(실측 예시)", () => {
  it("신정책 — 착지원가 165,000 / 예상이익 +33,000 / 마진 15.0%", () => {
    const result = computeUnifiedPriceDecision({
      ...BASE_INPUT,
      sellerDomesticShippingCostKrw: pc(DOMESTIC_SHIPPING, "estimated"),
    });
    expect(result.landedCostKrw.value).toBe(165000);
    expect(result.platformFeeKrw.value).toBe(22000);
    expect(result.estimatedProfitKrw.value).toBe(33000);
    expect(result.marginPercent.value).toBe(15);
    expect(result.verdict).toBe("MAINTAIN");
  });

  it("구정책(국내 배송원가를 원가로 치던 계산)을 재현하면 같은 상품이 12.7%였다", () => {
    // 엔진에는 더 이상 이 경로가 없으므로, 그때의 costPriceKrw를 손으로
    // 재현해서 computePriceDecision을 직접 부른다(옛 동작을 되살리는 것이
    // 아니라 "무엇이 달라졌는지"를 숫자로 남기기 위해서다).
    const oldLandedCost = 165000 + DOMESTIC_SHIPPING;
    const platformFee = 22000;
    const oldProfit = 220000 - oldLandedCost - platformFee;
    const oldDecision = computePriceDecision({
      costPriceKrw: oldLandedCost + platformFee,
      currentSellingPriceKrw: 220000,
      domesticAveragePriceKrw: 240000,
      domesticLowestPriceKrw: 228000,
    });
    expect(oldLandedCost).toBe(170000);
    expect(oldProfit).toBe(28000);
    expect(oldDecision.marginPercent).toBe(12.7);

    // 차이는 정확히 국내 배송원가만큼이다 — 다른 무엇도 함께 바뀌지 않았다.
    const now = computeUnifiedPriceDecision(BASE_INPUT);
    expect(now.estimatedProfitKrw.value! - oldProfit).toBe(DOMESTIC_SHIPPING);
  });

  /**
   * 판정이 실제로 뒤집히는 경계. 이 줄이 없으면 "숫자만 조금 움직였다"로
   * 읽히는데, 마진 하한(10%) 바로 아래에 있던 상품은 판정 자체가 바뀐다.
   */
  it("마진 하한 근처의 상품은 판정이 뒤집힌다 — 숨기지 않고 적어 둔다", () => {
    const borderline: UnifiedPriceInput = {
      ...BASE_INPUT,
      sourceProductPriceKrw: pc(100000, "actual"),
      internationalShippingKrw: pc(12000, "estimated"),
      currentSellingPriceKrw: pc(140000, "actual"),
      domesticCompetitivePrice: { average: 145000, lowest: 138000 },
    };
    const now = computeUnifiedPriceDecision(borderline);
    // 신정책 — 착지원가 112,000 · 수수료 14,000 · 이익 14,000 · 마진 10.0%
    expect(now.landedCostKrw.value).toBe(112000);
    expect(now.marginPercent.value).toBe(10);
    expect(now.verdict).toBe("MAINTAIN");

    // 구정책이었다면 국내 배송원가 5,000이 더해져 마진이 하한 아래로 내려간다.
    const oldDecision = computePriceDecision({
      costPriceKrw: 112000 + DOMESTIC_SHIPPING + 14000,
      currentSellingPriceKrw: 140000,
      domesticAveragePriceKrw: 145000,
      domesticLowestPriceKrw: 138000,
    });
    expect(oldDecision.marginPercent).toBe(6.4);
    expect(oldDecision.verdict).toBe("MARGIN_RISK");
  });
});
