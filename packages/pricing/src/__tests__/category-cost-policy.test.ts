import { describe, expect, it } from "vitest";
import {
  CATEGORY_COST_POLICIES,
  DEFAULT_PRICE_BREAKDOWN_INPUT,
  DEFAULT_PRICE_ROUNDING_UNIT,
  computeGolfLandedCost,
  computeImportTaxes,
  computePriceBreakdown,
  computePriceRecommendation,
  computeRadar,
  computeUnifiedPriceDecision,
  comparePriceBasis,
  estimateEmsJapanToKorea,
  isUsableRate,
  GOLF_CLUB_RCEP_JAPAN_DUTY_RATE_2026,
  resolveCategoryCostPolicy,
  resolveChargeableWeight,
  sellerDecisionStateFromUnifiedDecision,
  volumetricWeightKg,
  type PriceComponent,
  type UnifiedPriceInput,
} from "../index";

/**
 * GOLF-01 축B(CEO 지시, 2026-09-15) — 카테고리별 비용 정책.
 *
 * 이 파일이 지키는 것은 두 가지이고, 둘이 서로를 감시한다:
 *   ① 골프에서는 관세·수입부가세·용적중량이 **실제로** 계산에 들어간다.
 *   ② 그 분기가 아동의류에 **한 원도** 새지 않는다.
 *
 * mi-cost-policy-customs-removed.test.ts는 한 줄도 지우지 않았다. 그 파일은
 * 카테고리를 넘기지 않는 입력(=오늘까지의 모든 호출부)을 검사하고, 이 파일은
 * 카테고리를 명시적으로 넘겼을 때를 검사한다. 두 파일이 같은 사실의 양쪽이다.
 */
function pc(value: number | null, status: PriceComponent["status"], source?: string): PriceComponent {
  return { value, status, source };
}

/* ════════════════════════ ① 아동의류 회귀 — 실상품 ════════════════════════ */

/**
 * 실상품: Bobo Choses B226AC043 "Mystery BC half zipped sweatshirt" €75.00.
 * (packages/crawler/src/__tests__/fixtures/bobochoses-b226ac043.json의 price
 *  7500 = €75.00 — 우리가 지어낸 상품이 아니라 저장소가 이미 크롤링해 둔 실제
 *  상품이고, price-hierarchy.ts 주석이 실측 근거로 인용하는 바로 그 상품이다.)
 *
 * 아래 숫자는 **수정 전 코드(c865a79)를 별도 worktree에서 실제로 돌려 받은 값**
 * 이다. 손으로 계산한 값이 아니고, 수정 후 코드에서도 한 글자도 다르지 않다.
 */
const KIDS_PRODUCT = { originalAmount: 75, originalCurrency: "EUR" } as const;
const KIDS_DOMESTIC = { lowest: 198000, average: 214000 } as const;

/** 수정 전 코드가 실제로 낸 값(worktree 실측). */
const KIDS_BEFORE = {
  costKrw: 111000,
  landedCostKrw: 123000,
  suggestedPriceKrw: 175710,
  platformFeeKrw: 17571,
  estimatedProfitKrw: 35139,
  marginPercent: 20,
  verdict: "MAINTAIN",
  level: "GREEN",
  dataCompleteness: "ESTIMATED",
  missingComponents: [] as string[],
  sellerStateCode: "READY",
  marketCase: "A",
  recommendedPrice: 196020,
  estimatedMarginPercent: 37.3,
  minimumPrice: 136667,
  targetPrice: 153750,
} as const;

function kidsBreakdown() {
  return computePriceBreakdown(
    { ...KIDS_PRODUCT, ...DEFAULT_PRICE_BREAKDOWN_INPUT },
    undefined,
    DEFAULT_PRICE_ROUNDING_UNIT,
  );
}

function kidsUnifiedInput(extra: Partial<UnifiedPriceInput> = {}): UnifiedPriceInput {
  const breakdown = kidsBreakdown();
  return {
    sourceProductPriceKrw: pc(breakdown.costKrw, "estimated"),
    exchangeRate: pc(breakdown.exchangeRate, "estimated"),
    internationalShippingKrw: pc(breakdown.shippingKrw, "estimated", "seller_default"),
    customerChargedShippingKrw: pc(null, "unknown"),
    platformFeeRate: pc(breakdown.feePercent, "estimated", "default"),
    currentSellingPriceKrw: pc(breakdown.suggestedPriceKrw, "actual"),
    domesticCompetitivePrice: KIDS_DOMESTIC,
    ...extra,
  };
}

describe("GOLF-01 축B ①: 아동의류 실상품(Bobo Choses B226AC043 €75)의 숫자가 수정 전과 같다", () => {
  it("원가 사슬 — 환산 · 착지원가 · 권장 판매가가 수정 전 실측값과 동일하다", () => {
    const breakdown = kidsBreakdown();
    expect(breakdown.costKrw).toBe(KIDS_BEFORE.costKrw);
    expect(breakdown.landedCostKrw).toBe(KIDS_BEFORE.landedCostKrw);
    expect(breakdown.suggestedPriceKrw).toBe(KIDS_BEFORE.suggestedPriceKrw);
  });

  it("통합 판정 — 수수료 · 예상이익 · 마진 · verdict · 완전성이 전부 동일하다", () => {
    const unified = computeUnifiedPriceDecision(kidsUnifiedInput());
    expect(unified.landedCostKrw.value).toBe(KIDS_BEFORE.landedCostKrw);
    expect(unified.platformFeeKrw.value).toBe(KIDS_BEFORE.platformFeeKrw);
    expect(unified.estimatedProfitKrw.value).toBe(KIDS_BEFORE.estimatedProfitKrw);
    expect(unified.marginPercent.value).toBe(KIDS_BEFORE.marginPercent);
    expect(unified.verdict).toBe(KIDS_BEFORE.verdict);
    expect(unified.level).toBe(KIDS_BEFORE.level);
    expect(unified.dataCompleteness).toBe(KIDS_BEFORE.dataCompleteness);
    expect(unified.missingComponents).toEqual(KIDS_BEFORE.missingComponents);
    expect(sellerDecisionStateFromUnifiedDecision(unified).code).toBe(KIDS_BEFORE.sellerStateCode);
  });

  it("CASE 판정 · 추천가 · Radar까지 동일하다 — 사슬 끝까지 한 원도 움직이지 않았다", () => {
    const breakdown = kidsBreakdown();
    const recommendation = computePriceRecommendation({
      totalCostKrw: breakdown.landedCostKrw,
      domesticLowestPriceKrw: KIDS_DOMESTIC.lowest,
      domesticAveragePriceKrw: KIDS_DOMESTIC.average,
      domesticBasis: "EXACT",
      minimumMarginPercent: 10,
      targetMarginPercent: DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent,
    });
    expect(recommendation.marketCase).toBe(KIDS_BEFORE.marketCase);
    expect(recommendation.recommendedPrice).toBe(KIDS_BEFORE.recommendedPrice);
    expect(recommendation.estimatedMarginPercent).toBe(KIDS_BEFORE.estimatedMarginPercent);
    expect(recommendation.minimumPrice).toBe(KIDS_BEFORE.minimumPrice);
    expect(recommendation.targetPrice).toBe(KIDS_BEFORE.targetPrice);

    const radar = computeRadar({
      marketCase: recommendation.marketCase,
      landedCostKrw: breakdown.landedCostKrw,
      recommendedPriceKrw: recommendation.recommendedPrice,
      domesticLowestPriceKrw: KIDS_DOMESTIC.lowest,
      domesticAveragePriceKrw: KIDS_DOMESTIC.average,
      domesticBasis: "EXACT",
      searchInterest: "medium",
      bestMatchTruth: "EXACT_IDENTIFIER",
    });
    expect(radar.axes.map((a) => [a.key, a.state])).toEqual([
      ["profitability", { status: "SCORED", level: "HIGH" }],
      ["priceCompetitiveness", { status: "SCORED", level: "HIGH" }],
      ["marketDemand", { status: "SCORED", level: "MEDIUM" }],
      ["matchConfidence", { status: "SCORED", level: "HIGH" }],
    ]);
  });

  it("🔴 카테고리를 KIDS_FASHION으로 **명시해도** 관세·부가세가 원가에 붙지 않는다", () => {
    const withoutCategory = computeUnifiedPriceDecision(kidsUnifiedInput());
    const asKids = computeUnifiedPriceDecision(kidsUnifiedInput({ categoryProfileId: "KIDS_FASHION" }));
    const asKidsWithCustoms = computeUnifiedPriceDecision(
      kidsUnifiedInput({
        categoryProfileId: "KIDS_FASHION",
        customsDutyKrw: pc(9840, "actual"),
        customsVatKrw: pc(13284, "actual"),
      }),
    );

    // 정책 라벨만 다르고(DEFAULT vs KIDS_FASHION) 숫자는 전부 같다.
    for (const result of [asKids, asKidsWithCustoms]) {
      expect(result.landedCostKrw).toEqual(withoutCategory.landedCostKrw);
      expect(result.estimatedProfitKrw).toEqual(withoutCategory.estimatedProfitKrw);
      expect(result.marginPercent).toEqual(withoutCategory.marginPercent);
      expect(result.verdict).toBe(withoutCategory.verdict);
      expect(result.dataCompleteness).toBe(withoutCategory.dataCompleteness);
      expect(result.missingComponents).toEqual([]);
      expect(result.landedCostTaxBasis).toBe("TAX_EXCLUDED");
      expect(result.costPolicy.importTaxesInLandedCost).toBe(false);
    }
    // 관부가세가 들어갔다면 착지원가가 146,124였을 것이다.
    expect(asKidsWithCustoms.landedCostKrw.value).not.toBe(123000 + 9840 + 13284);
  });

  it("아동의류 정책은 DEFAULT와 필드 하나까지 같다 — 나중에 한쪽만 고치면 이 검사가 먼저 깨진다", () => {
    const { id, label, ...kids } = CATEGORY_COST_POLICIES.KIDS_FASHION;
    const { id: dId, label: dLabel, ...def } = CATEGORY_COST_POLICIES.DEFAULT;
    expect(kids).toEqual(def);
    expect([id, dId]).toEqual(["KIDS_FASHION", "DEFAULT"]);
    expect(label).not.toBe(dLabel);
  });

  it("모르는 카테고리는 DEFAULT다 — 아동의류로 둔갑시키지 않는다", () => {
    expect(resolveCategoryCostPolicy(null).id).toBe("DEFAULT");
    expect(resolveCategoryCostPolicy("BEAUTY").id).toBe("DEFAULT");
    expect(resolveCategoryCostPolicy(undefined).id).toBe("DEFAULT");
  });
});

/* ═══════════ ② 골프 — 🔴 GOLF-01-TAX에서 방향이 뒤집힌 자리 ═══════════ */

/**
 * ── 이 블록은 «반대 사실»을 지키도록 다시 쓰였다 ────────────────────────────
 *
 * d72575f(GOLF-01 축B)에서 이 자리는 "골프는 관세·수입부가세가 착지원가 항목이
 * 된다"를 지켰다. CEO가 그 방향을 거뒀다(GOLF-01-TAX): 관부가세는 어떤
 * 카테고리에서도 판매자 원가에 들어가지 않는다.
 *
 * 그래서 검사를 지우지 않고 **반대쪽을 고정한다**. 지웠다면 "골프에서 세금이
 * 원가에 들어가는가"를 아무도 보지 않게 되고, 그때 이 코드는 조용히 예전
 * 방향으로 되돌아갈 수 있다. 같은 자리에서 정반대의 사실을 지키는 것이
 * 방향 전환을 기록하는 방법이다.
 */
describe("GOLF-01-TAX ②: 골프에서도 관세·부가가치세는 착지원가에 들어가지 않는다", () => {
  // 과세가격 1,000,000원을 만드는 단순한 수치로 계산을 손으로 검증한다.
  const base: UnifiedPriceInput = {
    categoryProfileId: "GOLF",
    sourceProductPriceKrw: pc(900000, "actual"),
    exchangeRate: pc(9.2, "estimated"),
    internationalShippingKrw: pc(100000, "estimated", "EMS"),
    customerChargedShippingKrw: pc(null, "unknown"),
    platformFeeRate: pc(10, "estimated", "default"),
    currentSellingPriceKrw: pc(1500000, "actual"),
    domesticCompetitivePrice: { lowest: 1490000, average: 1560000 },
  };

  it("🔴 관세 80,000 · 부가세 108,000을 «넘겨도» 착지원가가 1,000,000에서 움직이지 않는다", () => {
    const plain = computeUnifiedPriceDecision(base);
    const withTaxes = computeUnifiedPriceDecision({
      ...base,
      customsDutyKrw: pc(80000, "actual"),
      customsVatKrw: pc(108000, "actual"),
    });
    expect(plain.landedCostKrw.value).toBe(1000000);
    expect(withTaxes.landedCostKrw).toEqual(plain.landedCostKrw);
    expect(withTaxes.estimatedProfitKrw).toEqual(plain.estimatedProfitKrw);
    expect(withTaxes.marginPercent).toEqual(plain.marginPercent);
    expect(withTaxes.verdict).toBe(plain.verdict);
    // 예전 방향이었다면 1,188,000이었을 것이다.
    expect(withTaxes.landedCostKrw.value).not.toBe(1188000);
  });

  it("골프와 아동의류의 원가가 **같아졌다** — 카테고리가 원가 구성을 가르지 않는다", () => {
    const customs = { customsDutyKrw: pc(80000, "actual"), customsVatKrw: pc(108000, "actual") };
    const asGolf = computeUnifiedPriceDecision({ ...base, ...customs });
    const asKids = computeUnifiedPriceDecision({ ...base, ...customs, categoryProfileId: "KIDS_FASHION" });
    expect(asGolf.landedCostKrw.value! - asKids.landedCostKrw.value!).toBe(0);
    expect(asGolf.estimatedProfitKrw).toEqual(asKids.estimatedProfitKrw);
    // 라벨만 다르다. 정책이 사라진 것이 아니라 «원가를 가르지 않는» 것이다.
    expect([asGolf.costPolicy.id, asKids.costPolicy.id]).toEqual(["GOLF", "KIDS_FASHION"]);
  });

  it("세금을 몰라도 골프 상품의 판정이 🟠으로 내려가지 않는다 — 판매자가 치르지 않는 돈이다", () => {
    const unknownTaxes = computeUnifiedPriceDecision({
      ...base,
      customsDutyKrw: pc(null, "unknown"),
      customsVatKrw: pc(null, "unknown"),
    });
    // 예전에는 여기서 ["관세","수입부가세"]가 나왔고 dataCompleteness가 INCOMPLETE였다.
    expect(unknownTaxes.missingComponents).toEqual([]);
    expect(unknownTaxes.dataCompleteness).not.toBe("INCOMPLETE");
    expect(sellerDecisionStateFromUnifiedDecision(unknownTaxes).code).not.toBe("NEEDS_COST_INFO");
  });

  it("어떤 카테고리에서도 costPolicy.importTaxesInLandedCost는 false다 — 켤 수 있는 스위치가 없다", () => {
    for (const id of [undefined, null, "GOLF", "KIDS_FASHION", "BEAUTY"]) {
      const result = computeUnifiedPriceDecision({ ...base, categoryProfileId: id });
      expect(result.costPolicy.importTaxesInLandedCost).toBe(false);
      expect(result.landedCostTaxBasis).toBe("TAX_EXCLUDED");
    }
    // 정책 표에도 그런 칸이 없다(있으면 언젠가 true가 된다).
    expect(CATEGORY_COST_POLICIES.GOLF).not.toHaveProperty("importTaxesInLandedCost");
  });
});

/* ══════════════════════ ③ 관세율 — 확정과 «확인 필요»를 가른다 ══════════════════════ */

describe("GOLF-01 축B ③: 관세율 — 확정된 것만 계산에 들어간다", () => {
  it("골프 기본세율 8%는 RCEP 부속서 한국 양허표 base rate 근거로 확정이고, 확인 시점과 남은 숙제를 함께 들고 다닌다", () => {
    const duty = CATEGORY_COST_POLICIES.GOLF.customsDutyRate!;
    expect(duty.percent).toBe(8);
    expect(duty.confidence).toBe("CONFIRMED");
    expect(isUsableRate(duty)).toBe(true);
    expect(duty.verifiedOn).toBe("2026-09-15");
    // 확정이어도 남은 미확인 조각을 숨기지 않는다.
    expect(duty.reviewNote).toContain("unipass");
    expect(duty.sources.some((s) => s.includes("rcep"))).toBe(true);
    // 수입부가세 10%도 법정 세율이라 확정이다.
    expect(isUsableRate(CATEGORY_COST_POLICIES.GOLF.importVatRate)).toBe(true);
  });

  it("관세 8% → 부가세는 (CIF + 관세) × 10% — 과세표준에 관세가 들어간다", () => {
    const result = computeImportTaxes({
      customsValueKrw: 1000000,
      dutyRate: CATEGORY_COST_POLICIES.GOLF.customsDutyRate,
      vatRate: CATEGORY_COST_POLICIES.GOLF.importVatRate,
    });
    expect(result.resolved).toBe(true);
    expect(result.appliedDutyRatePercent).toBe(8);
    expect(result.customsDutyKrw).toBe(80000);
    expect(result.vatBaseKrw).toBe(1080000);
    expect(result.importVatKrw).toBe(108000);
    expect(result.totalImportTaxKrw).toBe(188000);
    // 🔴 CIF에 각각 곱해서 더하면 100,000+80,000=180,000으로 8,000 과소계산된다.
    expect(result.totalImportTaxKrw).not.toBe(180000);
  });

  it("🔴 세율이 확인 필요 상태이면 금액이 null이고 참고금액만 별도 필드로 나온다", () => {
    const unverified = { ...CATEGORY_COST_POLICIES.GOLF.customsDutyRate!, confidence: "NEEDS_VERIFICATION" as const };
    const result = computeImportTaxes({
      customsValueKrw: 1000000,
      dutyRate: unverified,
      vatRate: CATEGORY_COST_POLICIES.GOLF.importVatRate,
    });
    expect(result.resolved).toBe(false);
    expect(result.customsDutyKrw).toBeNull();
    expect(result.importVatKrw).toBeNull();
    expect(result.totalImportTaxKrw).toBeNull();
    // 참고 금액은 **별도 필드**로만 존재한다 — 원가에 흘러갈 자리가 없다.
    expect(result.provisionalTotalImportTaxKrw).toBe(80000 + 108000);
  });

  it("🔴 RCEP 5.3%는 정책에 연결되지 않는다 — 원산지증명서가 있어야 받는 세율이다", () => {
    // 기본 정책이 쓰는 세율은 어디까지나 기본세율 8%다.
    expect(CATEGORY_COST_POLICIES.GOLF.customsDutyRate!.percent).toBe(8);
    expect(GOLF_CLUB_RCEP_JAPAN_DUTY_RATE_2026.percent).toBe(5.3);
    expect(GOLF_CLUB_RCEP_JAPAN_DUTY_RATE_2026.basis).toContain("원산지증명서");
    // 셀러가 서류를 갖고 있을 때만 직접 입력해서 쓴다.
    const withCo = computeImportTaxes({
      customsValueKrw: 1000000,
      dutyRate: CATEGORY_COST_POLICIES.GOLF.customsDutyRate,
      vatRate: CATEGORY_COST_POLICIES.GOLF.importVatRate,
      sellerConfirmedDutyRatePercent: GOLF_CLUB_RCEP_JAPAN_DUTY_RATE_2026.percent!,
    });
    expect(withCo.customsDutyKrw).toBe(53000);
    expect(withCo.importVatKrw).toBe(105300);
  });

  it("관세율 0%(무관세 확인)도 «모름»과 구분된다 — 0과 null을 섞지 않는다", () => {
    const zero = computeImportTaxes({
      customsValueKrw: 1000000,
      dutyRate: CATEGORY_COST_POLICIES.GOLF.customsDutyRate,
      vatRate: CATEGORY_COST_POLICIES.GOLF.importVatRate,
      sellerConfirmedDutyRatePercent: 0,
    });
    expect(zero.resolved).toBe(true);
    expect(zero.customsDutyKrw).toBe(0);
    expect(zero.importVatKrw).toBe(100000);
  });
});

/* ═════════════════════ ④ 중량 · 용적중량 — CEO 실측 예시 ═════════════════════ */

describe("GOLF-01 축B ④: 용적중량이 배송비를 가른다(CEO 실측 예시)", () => {
  it("46인치 클럽 125×20×20 박스 → 용적 10kg → EMS ¥10,600", () => {
    expect(volumetricWeightKg({ lengthCm: 125, widthCm: 20, heightCm: 20 })).toBe(10);
    const weight = resolveChargeableWeight({
      actualWeightKg: 1.2,
      dimensionsCm: { lengthCm: 125, widthCm: 20, heightCm: 20 },
    });
    expect(weight.basis).toBe("VOLUMETRIC");
    expect(weight.chargeableWeightKg).toBe(10);
    const ems = estimateEmsJapanToKorea(weight.chargeableWeightKg)!;
    expect(ems.jpy).toBe(10600);
    expect(ems.exactBracket).toBe(true);
  });

  it("같은 클럽 슬림 튜브 120×15×15 → 용적 5.4kg → 상위 구간 7kg 요금 ¥8,200", () => {
    expect(volumetricWeightKg({ lengthCm: 120, widthCm: 15, heightCm: 15 })).toBe(5.4);
    const ems = estimateEmsJapanToKorea(5.4)!;
    expect(ems.jpy).toBe(8200);
    expect(ems.bracketUptoKg).toBe(7);
    // 요금표에 5.4kg 구간이 없다는 사실을 숨기지 않는다.
    expect(ems.exactBracket).toBe(false);
    expect(ems.note).toContain("요금표에 없는 중량");
  });

  it("🔴 포장 하나로 배송비가 갈린다 — 두 박스의 차이가 실제 금액으로 나온다", () => {
    const big = estimateEmsJapanToKorea(10)!;
    const slim = estimateEmsJapanToKorea(5.4)!;
    expect(big.jpy - slim.jpy).toBe(2400);
    // 고정 환율표(JPY 9.2) 기준 — liveRates가 없으면 isRateEstimate=true다.
    expect(big.krw).toBe(Math.round(10600 * 9.2));
    expect(big.isRateEstimate).toBe(true);
  });

  it("실중량이 용적중량보다 크면 실중량으로 과금된다", () => {
    const weight = resolveChargeableWeight({
      actualWeightKg: 6,
      dimensionsCm: { lengthCm: 30, widthCm: 30, heightCm: 30 },
    });
    expect(weight.volumetricWeightKg).toBe(5.4);
    expect(weight.basis).toBe("ACTUAL");
    expect(weight.chargeableWeightKg).toBe(6);
  });

  it("치수도 실중량도 없으면 배송 중량은 null이다 — 0kg으로 채우지 않는다", () => {
    const weight = resolveChargeableWeight({});
    expect(weight.chargeableWeightKg).toBeNull();
    expect(weight.basis).toBe("UNKNOWN");
    expect(estimateEmsJapanToKorea(weight.chargeableWeightKg)).toBeNull();
  });

  it("확인된 요금표(최대 10kg) 밖이면 null이다 — 비례식으로 늘리지 않는다", () => {
    expect(estimateEmsJapanToKorea(10.1)).toBeNull();
    expect(estimateEmsJapanToKorea(25)).toBeNull();
  });
});

/* ═══════════════ ⑤ 골프 착지원가 조립 — 조각이 실제로 이어지는가 ═══════════════ */

describe("GOLF-01 축B ⑤: computeGolfLandedCost가 상품가 → 중량 → 배송비 → 세금을 잇는다", () => {
  const JP_RATES = { JPY: 9.2 };

  it("CEO 실측 예시 ¥107,800 클럽 · 125×20×20 박스 — 상품가 → 용적중량 → EMS → CIF → 관세 → 부가세가 한 줄로 이어진다", () => {
    const result = computeGolfLandedCost({
      sourcePriceAmount: 107800,
      sourcePriceCurrency: "JPY",
      liveRates: JP_RATES,
      dimensionsCm: { lengthCm: 125, widthCm: 20, heightCm: 20 },
    });
    expect(result.policy.id).toBe("GOLF");
    // ① 상품가 ¥107,800 × 9.2 = ₩991,760
    expect(result.productCostKrw).toBe(991760);
    // ② 용적중량 125×20×20÷5,000 = 10kg (실중량보다 크다)
    expect(result.weight.chargeableWeightKg).toBe(10);
    expect(result.weight.basis).toBe("VOLUMETRIC");
    // ③ EMS 10kg 구간 ¥10,600 × 9.2 = ₩97,520 (CEO 실측 "≈97,520원"과 일치)
    expect(result.internationalShippingKrw).toBe(97520);
    // ④ 과세가격(CIF) = ①+③
    expect(result.customsValueKrw).toBe(1089280);
    // ⑤ 🔴 GOLF-01-TAX — 관세 8% · 부가세 10%×(CIF+관세)는 계산되지만 그것은
    //    **구매자 부담 참고정보**다. 판매자 원가는 ①+③에서 끝난다.
    const tax = result.buyerImportCharge.importTax!;
    expect(tax.resolved).toBe(true);
    expect(tax.customsDutyKrw).toBe(87142);
    expect(tax.importVatKrw).toBe(117642);
    expect(tax.totalImportTaxKrw).toBe(204784);
    expect(result.buyerImportCharge.totalKrw).toBe(204784);

    // 🔴 판매자 원가는 세금을 한 원도 세지 않는다.
    const sellerCost = result.components.sourceProductPriceKrw.value! + result.components.internationalShippingKrw.value!;
    expect(sellerCost).toBe(1089280);
    expect(sellerCost).not.toBe(1294064);
    // 🔴 기본 배송비 ₩12,000만 쓰던 예전 계산과의 차이는 «배송비»에서만 온다.
    expect(sellerCost - (991760 + 12000)).toBe(85520);
  });

  it("셀러가 RCEP 원산지증명서를 갖고 있으면 그 세율이 우선한다 — 단, 참고 블록에서만이다", () => {
    const result = computeGolfLandedCost({
      sourcePriceAmount: 107800,
      sourcePriceCurrency: "JPY",
      liveRates: JP_RATES,
      dimensionsCm: { lengthCm: 125, widthCm: 20, heightCm: 20 },
      sellerConfirmedDutyRatePercent: GOLF_CLUB_RCEP_JAPAN_DUTY_RATE_2026.percent!,
    });
    expect(result.buyerImportCharge.importTax?.resolved).toBe(true);
    expect(result.buyerImportCharge.duty.ratePercent).toBe(5.3);
    // 🔴 components에는 세금 칸 자체가 없다 — 이어 붙일 자리가 없다.
    expect(Object.keys(result.components)).toEqual(["sourceProductPriceKrw", "internationalShippingKrw"]);

    const decision = computeUnifiedPriceDecision({
      categoryProfileId: "GOLF",
      ...result.components,
      exchangeRate: { value: 9.2, status: "actual" },
      customerChargedShippingKrw: { value: null, status: "unknown" },
      platformFeeRate: { value: 10, status: "estimated" },
      currentSellingPriceKrw: { value: 1_600_000, status: "actual" },
      domesticCompetitivePrice: { lowest: 1_580_000, average: 1_650_000 },
    });
    expect(decision.missingComponents).toEqual([]);
    expect(decision.dataCompleteness).not.toBe("INCOMPLETE");
    expect(decision.landedCostKrw.value).toBe(result.productCostKrw! + result.internationalShippingKrw!);
    expect(decision.landedCostTaxBasis).toBe("TAX_EXCLUDED");
  });

  it("셀러가 실제 배송비를 알고 있으면 EMS 추정보다 우선한다", () => {
    const result = computeGolfLandedCost({
      sourcePriceAmount: 107800,
      sourcePriceCurrency: "JPY",
      liveRates: JP_RATES,
      dimensionsCm: { lengthCm: 125, widthCm: 20, heightCm: 20 },
      knownInternationalShippingKrw: 45000,
    });
    expect(result.internationalShippingKrw).toBe(45000);
    expect(result.shippingStatus).toBe("actual");
    expect(result.emsEstimate).toBeNull();
  });

  it("치수를 모르면 배송비도 과세가격도 세금도 전부 null이다 — 추정 박스를 지어내지 않는다", () => {
    const result = computeGolfLandedCost({
      sourcePriceAmount: 107800,
      sourcePriceCurrency: "JPY",
      liveRates: JP_RATES,
    });
    expect(result.weight.chargeableWeightKg).toBeNull();
    expect(result.internationalShippingKrw).toBeNull();
    expect(result.customsValueKrw).toBeNull();
    // 세금도 금액이 없다. 다만 «해당 여부»는 물품가격만으로 답할 수 있으므로
    // 「해당 · 금액 확인 필요」다 — 모르는 것과 안 붙는 것을 섞지 않는다.
    expect(result.buyerImportCharge.importTax).toBeNull();
    expect(result.buyerImportCharge.duty.applicability).toBe("APPLICABLE");
    expect(result.buyerImportCharge.duty.display).toBe("확인 필요");
    expect(result.buyerImportCharge.totalKrw).toBeNull();
  });
});

/* ══════════════════ ⑥ PRICING-BASIS-1 — 기준이 다른 뺄셈을 막는다 ══════════════════ */

describe("GOLF-01 축B ⑥: 세전 원가와 세후 시장가를 그대로 빼지 않는다", () => {
  const domestic = { amountKrw: 529000, basis: "TAX_INCLUDED" as const, label: "국내 시장가격" };

  it("🔴 세전(TAX_EXCLUDED) 원가와 세후 국내가는 비교 불가 — 차액을 숫자로 내지 않는다", () => {
    const result = comparePriceBasis(domestic, {
      amountKrw: 400000,
      basis: "TAX_EXCLUDED",
      label: "해외 구매가격",
    });
    expect(result.comparable).toBe(false);
    expect(result.gapKrw).toBeNull();
    expect(result.reason).toContain("세금 기준이 달라");
  });

  it("한국 도착 기준(LANDED_TAXED) 원가는 세후 국내가와 비교할 수 있다", () => {
    const result = comparePriceBasis(domestic, {
      amountKrw: 470000,
      basis: "LANDED_TAXED",
      label: "한국 도착 예상원가",
    });
    expect(result.comparable).toBe(true);
    expect(result.gapKrw).toBe(59000);
    expect(result.reason).toContain("세금 포함");
  });

  it("기준을 모르는 값은 비교하지 않는다", () => {
    expect(comparePriceBasis(domestic, { amountKrw: 470000, basis: "UNKNOWN", label: "x" }).comparable).toBe(false);
    expect(comparePriceBasis(domestic, { amountKrw: null, basis: "LANDED_TAXED", label: "x" }).comparable).toBe(false);
  });

  /**
   * 🔴 GOLF-01-TAX — 이 기대값도 뒤집혔다. 골프 착지원가에서 관부가세가 빠졌으니
   * 골프도 세전이다. 즉 **어떤 카테고리의 착지원가도** 세후인 국내 시장가와
   * 그냥 뺄 수 없고, comparePriceBasis가 그 뺄셈을 전부 막는다.
   */
  it("모든 카테고리의 착지원가가 TAX_EXCLUDED다 — 국내가와 그냥 뺄 수 있는 원가는 없다", () => {
    for (const policy of Object.values(CATEGORY_COST_POLICIES)) {
      expect(policy.landedCostTaxBasis, `${policy.id}`).toBe("TAX_EXCLUDED");
    }
    expect(
      comparePriceBasis(domestic, { amountKrw: 1089280, basis: "TAX_EXCLUDED", label: "착지원가" }).gapKrw,
    ).toBeNull();
  });
});
