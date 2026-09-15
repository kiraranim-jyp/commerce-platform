import { describe, expect, it } from "vitest";
import {
  CATEGORY_COST_POLICIES,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  DEFAULT_PRICE_ROUNDING_UNIT,
  computePriceBreakdown,
  computeUnifiedPriceDecision,
  resolveBuyerImportCharge,
  type BuyerImportChargeEstimate,
  type ImportChargeAxisId,
} from "../index";

/**
 * GOLF-01-TAX(CEO 최종 결정, 2026-09-15) —
 * "관세·부가가치세를 판매자 원가/수익성 계산에 포함시키지 않는다.
 *  모든 카테고리에서 별도의 예상 구매자 부담 정보로 표시한다."
 *
 * 이 파일이 지키는 것은 넷이다:
 *   ① **공통 구조** — 아동의류도 골프도 같은 블록이 나온다.
 *   ② **분리** — 그 블록의 어떤 숫자도 판매자 원가·마진·verdict에 닿지 않는다.
 *   ③ **해당 여부가 먼저** — 세율을 알아도 해당 여부를 모르면 «확인 필요»다.
 *   ④ **임의 계산 금지** — 확정되지 않은 값이 금액 자리에 오지 않는다.
 */

/** 여섯 축이 빠짐없이, 그리고 그 여섯만 나오는가. */
const SIX_AXES: ImportChargeAxisId[] = [
  "DESTINATION",
  "ORIGIN",
  "ITEM_HS",
  "CUSTOMS_VALUE",
  "DELIVERY_TERMS",
  "IMPORT_MODE",
];

/** CEO 실측 예시: ¥107,800 클럽 · 125×20×20 박스 → EMS ₩97,520. */
const GOLF = { goodsValueKrw: 991_760, customsValueKrw: 1_089_280 };
/** 실상품 Bobo Choses B226AC043 €75 → 환산 ₩111,000 · 착지원가 ₩123,000. */
const KIDS = { goodsValueKrw: 111_000, customsValueKrw: 123_000 };

function charge(extra: Parameters<typeof resolveBuyerImportCharge>[0] = {}): BuyerImportChargeEstimate {
  return resolveBuyerImportCharge({ destinationCountry: "KR", ...extra });
}

/* ═════════════════ ① 공통 구조 — 카테고리가 모양을 가르지 않는다 ═════════════════ */

describe("GOLF-01-TAX ①: 모든 카테고리가 같은 «예상 구매자 부담» 구조를 쓴다", () => {
  const everyCategory = Object.keys(CATEGORY_COST_POLICIES);

  it("어느 카테고리로 부르든 관세 · 부가가치세 두 줄과 여섯 축이 그대로 나온다", () => {
    expect(everyCategory.length).toBeGreaterThan(1);
    for (const id of everyCategory) {
      const result = charge({ categoryProfileId: id, ...GOLF });
      expect(result.duty.label, id).toBe("관세");
      expect(result.vat.label, id).toBe("부가가치세");
      expect(result.axes.map((a) => a.id), id).toEqual(SIX_AXES);
      // 축 라벨도 CEO가 쓴 이름 그대로다.
      expect(result.axes.map((a) => a.label), id).toEqual([
        "국가",
        "원산지",
        "품목/HS",
        "과세가격",
        "배송 조건",
        "수입 형태",
      ]);
    }
  });

  it("카테고리를 아예 모를 때도 같은 구조다 — 구버전 스냅샷이 빈 화면을 받지 않는다", () => {
    const unknown = charge({ categoryProfileId: null, ...KIDS });
    expect(unknown.policyId).toBe("DEFAULT");
    expect(unknown.axes).toHaveLength(6);
    expect([unknown.duty.applicability, unknown.vat.applicability]).toEqual(["NEEDS_REVIEW", "NEEDS_REVIEW"]);
  });

  it("갈리는 것은 «값»이지 «모양»이 아니다 — 골프만 품목/HS를 답할 수 있다", () => {
    const golf = charge({ categoryProfileId: "GOLF", ...GOLF });
    const kids = charge({ categoryProfileId: "KIDS_FASHION", ...GOLF });
    const axisOf = (r: BuyerImportChargeEstimate, id: ImportChargeAxisId) => r.axes.find((a) => a.id === id)!;
    expect(axisOf(golf, "ITEM_HS").known).toBe(true);
    expect(axisOf(golf, "ITEM_HS").value).toBe("9506.31.00.00");
    expect(axisOf(kids, "ITEM_HS").known).toBe(false);
    // 구조는 같다 — 줄 수도, 축도, 라벨도.
    expect(golf.axes.map((a) => a.id)).toEqual(kids.axes.map((a) => a.id));
  });
});

/* ═══════════ ② 분리 — 참고 블록의 숫자가 판매자 원가에 닿지 않는다 ═══════════ */

describe("GOLF-01-TAX ②: 구매자 부담은 판매자 원가와 «다른 곳»에 산다", () => {
  it("🔴 반환 타입 어디에도 원가·마진·verdict가 없다 — 이어 붙일 필드가 없다", () => {
    const result = charge({ categoryProfileId: "GOLF", ...GOLF });
    for (const forbidden of ["landedCostKrw", "marginPercent", "verdict", "estimatedProfitKrw", "level"]) {
      expect(result, forbidden).not.toHaveProperty(forbidden);
    }
  });

  it("골프 예시 — 참고 블록은 ₩204,784를 말하고, 판매자 원가는 ₩1,089,280에서 멈춘다", () => {
    const result = charge({ categoryProfileId: "GOLF", ...GOLF });
    expect(result.duty.display).toBe("예상 ₩87,142");
    expect(result.vat.display).toBe("예상 ₩117,642");
    expect(result.totalKrw).toBe(204_784);
    expect(result.totalDisplay).toBe("예상 ₩204,784");
    // 🔴 CIF에 각각 곱해 더하면 180,000+... 으로 과소계산된다(부가세 과세표준에
    //    관세가 들어간다). 그 함정을 참고 블록에서도 그대로 피한다.
    expect(result.vat.amountKrw).toBe(Math.round((GOLF.customsValueKrw + 87_142) * 0.1));

    // 같은 상품의 판매자 원가를 실제로 계산해 본다 — 세금이 한 원도 없다.
    const decision = computeUnifiedPriceDecision({
      categoryProfileId: "GOLF",
      sourceProductPriceKrw: { value: GOLF.goodsValueKrw, status: "actual" },
      exchangeRate: { value: 9.2, status: "actual" },
      internationalShippingKrw: { value: 97_520, status: "estimated" },
      customerChargedShippingKrw: { value: null, status: "unknown" },
      platformFeeRate: { value: 10, status: "estimated" },
      currentSellingPriceKrw: { value: 1_600_000, status: "actual" },
    });
    expect(decision.landedCostKrw.value).toBe(GOLF.customsValueKrw);
    expect(decision.landedCostKrw.value).not.toBe(GOLF.customsValueKrw + result.totalKrw!);
    expect(decision.missingComponents).toEqual([]);
  });

  it("🔴 아동의류 실상품(€75)의 숫자가 참고 블록과 무관하게 그대로다", () => {
    const breakdown = computePriceBreakdown(
      { originalAmount: 75, originalCurrency: "EUR", ...DEFAULT_PRICE_BREAKDOWN_INPUT },
      undefined,
      DEFAULT_PRICE_ROUNDING_UNIT,
    );
    expect(breakdown.landedCostKrw).toBe(123_000);
    // 참고 블록을 «사업자 정식수입»으로 켜서 세금이 실제로 해당되게 만들어도,
    // 판매자 원가는 그 값을 볼 수 있는 경로 자체가 없다.
    const applicable = charge({ categoryProfileId: "KIDS_FASHION", ...KIDS, importMode: "COMMERCIAL_IMPORT" });
    expect(applicable.duty.applicability).toBe("APPLICABLE");
    const decision = computeUnifiedPriceDecision({
      categoryProfileId: "KIDS_FASHION",
      sourceProductPriceKrw: { value: breakdown.costKrw, status: "estimated" },
      exchangeRate: { value: breakdown.exchangeRate, status: "estimated" },
      internationalShippingKrw: { value: breakdown.shippingKrw, status: "estimated" },
      customerChargedShippingKrw: { value: null, status: "unknown" },
      platformFeeRate: { value: breakdown.feePercent, status: "estimated" },
      currentSellingPriceKrw: { value: breakdown.suggestedPriceKrw, status: "actual" },
      domesticCompetitivePrice: { lowest: 198_000, average: 214_000 },
    });
    expect(decision.landedCostKrw.value).toBe(123_000);
    expect(decision.estimatedProfitKrw.value).toBe(35_139);
    expect(decision.marginPercent.value).toBe(20);
    expect(decision.verdict).toBe("MAINTAIN");
  });
});

/* ═════════ ③ 해당 판단 — 여섯 축이 «해당/비해당/확인 필요»를 가른다 ═════════ */

describe("GOLF-01-TAX ③: 해당 여부를 여섯 축으로 답한다", () => {
  it("🔴 수입 형태를 모르면 «확인 필요»다 — 한쪽을 가정하지 않는다", () => {
    const result = charge({ categoryProfileId: "KIDS_FASHION", ...KIDS });
    expect(result.duty.applicability).toBe("NEEDS_REVIEW");
    expect(result.vat.applicability).toBe("NEEDS_REVIEW");
    expect(result.duty.blockingAxes).toContain("IMPORT_MODE");
    expect(result.duty.display).toBe("확인 필요");
    expect(result.totalKrw).toBeNull();
    expect(result.totalDisplay).toBe("확인 필요");
    expect(result.needsReview).toBe(true);
  });

  it("구매대행(자가사용) + 소액이면 «비해당» — 관세가 면제되면 부가세도 함께 면제된다", () => {
    const result = charge({ categoryProfileId: "KIDS_FASHION", ...KIDS, importMode: "PERSONAL_CLEARANCE" });
    expect([result.duty.applicability, result.vat.applicability]).toEqual(["NOT_APPLICABLE", "NOT_APPLICABLE"]);
    expect(result.duty.display).toBe("비해당");
    // 비해당은 «모름»이 아니다 — 0원이라고 말할 수 있는 상태다.
    expect(result.totalKrw).toBe(0);
    expect(result.needsReview).toBe(false);
  });

  it("사업자 정식수입이면 금액과 무관하게 «해당»이다 — 판매 목적은 소액면세 대상이 아니다", () => {
    const result = charge({ categoryProfileId: "KIDS_FASHION", ...KIDS, importMode: "COMMERCIAL_IMPORT" });
    expect(result.duty.applicability).toBe("APPLICABLE");
    expect(result.duty.basis).toBeTruthy();
    // 다만 아동의류는 품목/HS가 확정되지 않아 «금액»은 확인 필요다.
    expect(result.duty.display).toBe("확인 필요");
    expect(result.duty.blockingAxes).toContain("ITEM_HS");
  });

  it("🔴 골프는 금액이 커서 수입 형태를 몰라도 «해당»이 정해진다 — 두 해석이 같은 답을 낸다", () => {
    const unknownMode = charge({ categoryProfileId: "GOLF", ...GOLF });
    const personal = charge({ categoryProfileId: "GOLF", ...GOLF, importMode: "PERSONAL_CLEARANCE" });
    const commercial = charge({ categoryProfileId: "GOLF", ...GOLF, importMode: "COMMERCIAL_IMPORT" });
    for (const r of [unknownMode, personal, commercial]) {
      expect(r.duty.applicability).toBe("APPLICABLE");
      expect(r.totalKrw).toBe(204_784);
    }
  });

  it("두 면세 한도(150/200달러) 사이 금액은 원산지에 따라 갈려 «확인 필요»다", () => {
    // 고정 환율표 USD 1,380 기준 — 150달러 ₩207,000 / 200달러 ₩276,000.
    const between = charge({
      categoryProfileId: "GOLF",
      goodsValueKrw: 250_000,
      customsValueKrw: 262_000,
      importMode: "PERSONAL_CLEARANCE",
    });
    expect(between.duty.applicability).toBe("NEEDS_REVIEW");
    expect(between.duty.blockingAxes).toContain("ORIGIN");
    expect(between.totalKrw).toBeNull();
  });

  it("USD 환율을 모르면 달러 한도를 원화와 비교하지 않는다 — 지어낸 환율로 재지 않는다", () => {
    const noUsd = charge({
      categoryProfileId: "GOLF",
      goodsValueKrw: 991_760,
      customsValueKrw: 1_089_280,
      // liveRates에 USD가 없으면 FIXED_RATES_TO_KRW 폴백이 있으므로, 이 검사는
      // 폴백조차 없는 상황을 흉내내지 않는다. 대신 폴백이 실제로 쓰였고 그
      // 사실이 note에 남는지를 본다.
    });
    expect(noUsd.notes.join(" ")).toContain("소액면세 한도");
  });

  it("배송 조건이 DDP면 구매자가 별도로 부담하지 않는다 — «비해당»", () => {
    const ddp = charge({ categoryProfileId: "GOLF", ...GOLF, deliveryTerms: "DDP" });
    expect([ddp.duty.applicability, ddp.vat.applicability]).toEqual(["NOT_APPLICABLE", "NOT_APPLICABLE"]);
    expect(ddp.totalKrw).toBe(0);
  });

  it("배송 조건을 모르면 «수취인 부담 기준의 참고값»이라고 스스로 밝힌다", () => {
    const result = charge({ categoryProfileId: "GOLF", ...GOLF });
    expect(result.notes.join(" ")).toContain("배송 조건(DDP/DDU) 미확인");
    expect(result.axes.find((a) => a.id === "DELIVERY_TERMS")!.known).toBe(false);
  });

  it("수입국을 모르면 아무것도 계산하지 않는다 — 한국을 기본값으로 가정하지 않는다", () => {
    const noCountry = resolveBuyerImportCharge({ categoryProfileId: "GOLF", ...GOLF });
    expect(noCountry.duty.applicability).toBe("NEEDS_REVIEW");
    expect(noCountry.duty.blockingAxes).toEqual(["DESTINATION"]);
    expect(noCountry.importTax).toBeNull();
  });
});

/* ═════════ ④ 임의 계산 금지 — 확정되지 않은 값이 금액 자리에 오지 않는다 ═════════ */

describe("GOLF-01-TAX ④: 세율이 확정되지 않으면 금액이 아니라 «확인 필요»다", () => {
  it("🔴 품목/HS가 없는 카테고리는 «해당»이어도 금액을 만들지 않는다", () => {
    const result = charge({
      categoryProfileId: "HOME_LIFESTYLE",
      goodsValueKrw: 900_000,
      customsValueKrw: 1_000_000,
    });
    expect(result.duty.applicability).toBe("APPLICABLE");
    expect(result.duty.amountKrw).toBeNull();
    expect(result.duty.ratePercent).toBeNull();
    expect(result.duty.display).toBe("확인 필요");
    // 부가세율(10%)은 법정이라 확정이지만, 과세표준에 관세가 들어가므로
    // 관세를 모르면 부가세 금액도 낼 수 없다.
    expect(result.vat.amountKrw).toBeNull();
    expect(result.totalDisplay).toBe("확인 필요");
  });

  it("셀러가 관세율을 직접 확인해 넘기면 그 값으로 금액이 나온다 — 우리가 지어내지 않았을 뿐이다", () => {
    const confirmed = charge({
      categoryProfileId: "HOME_LIFESTYLE",
      goodsValueKrw: 900_000,
      customsValueKrw: 1_000_000,
      sellerConfirmedDutyRatePercent: 13,
    });
    expect(confirmed.duty.amountKrw).toBe(130_000);
    expect(confirmed.vat.amountKrw).toBe(113_000);
    expect(confirmed.totalKrw).toBe(243_000);
  });

  it("🔴 참고금액(provisional)은 별도 필드로만 존재한다 — display에 새지 않는다", () => {
    // 세율은 있지만 «확인 필요» 상태인 정책을 흉내낸다.
    const unverified = {
      ...CATEGORY_COST_POLICIES.GOLF,
      customsDutyRate: { ...CATEGORY_COST_POLICIES.GOLF.customsDutyRate!, confidence: "NEEDS_VERIFICATION" as const },
    };
    const original = CATEGORY_COST_POLICIES.GOLF;
    try {
      (CATEGORY_COST_POLICIES as Record<string, unknown>).GOLF = unverified;
      const result = charge({ categoryProfileId: "GOLF", ...GOLF });
      expect(result.duty.amountKrw).toBeNull();
      expect(result.duty.display).toBe("확인 필요");
      expect(result.totalDisplay).toBe("확인 필요");
      // 참고금액은 남아 있다 — 다만 금액 자리에 오지 않는다.
      expect(result.provisionalTotalKrw).toBeGreaterThan(0);
      expect(result.duty.display).not.toContain(String(result.provisionalTotalKrw));
    } finally {
      (CATEGORY_COST_POLICIES as Record<string, unknown>).GOLF = original;
    }
  });

  it("관세율 0%(무관세 확인)는 «모름»과 구분된다 — 0과 null을 섞지 않는다", () => {
    const zero = charge({
      categoryProfileId: "GOLF",
      ...GOLF,
      sellerConfirmedDutyRatePercent: 0,
    });
    expect(zero.duty.amountKrw).toBe(0);
    expect(zero.duty.display).toBe("예상 ₩0");
    expect(zero.vat.amountKrw).toBe(Math.round(GOLF.customsValueKrw * 0.1));
  });
});
