import { describe, expect, it } from "vitest";
import { computeVariantFinalPriceKrw, computePriceBreakdown } from "../breakdown";

/**
 * Sprint A-4(CPO 작업지시서 12개 테스트 기준 중 옵션 최종가 계산에 해당하는
 * 항목) — 발견된 버그(수정 대상): 이전 buildOptionCombinations는
 * `convertToKrw(variant.price) - salePrice`를 델타로 썼다. salePrice는 이미
 * 마진/수수료가 적용된 값인데 variant.price 환산값은 마진이 없어서, 마진이
 * 0이 아닌 한(기본값 20%+수수료10%) 실제와 다른(대개 부호가 뒤집힌) 델타가
 * 나왔다. 기존 계약 테스트(option-price-contract.test.ts)가 이걸 못 잡은
 * 이유도 확인했다 — 그 테스트는 원본 통화가 이미 KRW고 마진이 0(기본 원본가
 * = 최종 salePrice)인 인위적 픽스처를 썼다(환율 1, 마진 0이면 버그가 수학적
 *으로 안 보인다). 여기서는 CPO가 breakdown.test.ts에서 이미 검증해둔
 * 실제 참조값($44 → ₩105,674, 환율 1408.45, 수수료10%+마진20%)을 기준
 * 상품으로 써서 진짜 마진이 걸린 상태로 검증한다.
 */
describe("computeVariantFinalPriceKrw", () => {
  // CPO 참조 케이스(breakdown.test.ts와 동일) — $44 → 최종 판매가 ₩105,674.
  const base = { amount: 44, currency: "USD", finalKrw: 105674 };
  const liveRates = { USD: 1408.45 };

  it("케이스 3 — 옵션 absolute price(기본보다 비쌈): 마진 재적용 없이 원본 차액만 환산해서 더한다", () => {
    // Red $49(기본 $44보다 $5 비쌈). 버그 있는 옛 계산이면
    // convertToKrw(49)=69,014 - 105,674 = -36,660(반대 부호) 이 나왔을 것.
    const result = computeVariantFinalPriceKrw(base, { amount: 49, currency: "USD" }, liveRates);
    expect(result.applied).toBe(true);
    // 5 * 1408.45 = 7042.25 → round 7042.
    expect(result.finalKrw).toBe(105674 + 7042);
    expect(result.finalKrw).toBeGreaterThan(base.finalKrw); // 비싼 옵션은 반드시 더 비싸야 한다(부호 검증).
  });

  it("케이스 4 — 옵션 가격 차이가 마이너스(기본보다 쌈)도 부호가 올바르다", () => {
    const result = computeVariantFinalPriceKrw(base, { amount: 39, currency: "USD" }, liveRates);
    // -5 * 1408.45 = -7042.25 → round -7042.
    expect(result.finalKrw).toBe(105674 - 7042);
    expect(result.finalKrw).toBeLessThan(base.finalKrw);
  });

  it("케이스 5 — 옵션 가격이 기본과 동일하면 최종가도 기본과 동일하다", () => {
    const result = computeVariantFinalPriceKrw(base, { amount: 44, currency: "USD" }, liveRates);
    expect(result.finalKrw).toBe(base.finalKrw);
    expect(result.applied).toBe(true);
  });

  it("케이스 7 — 옵션별 통화가 기본과 다르면 UNRESOLVED로 보고 기본가로 폴백한다(지어내지 않음)", () => {
    const result = computeVariantFinalPriceKrw(base, { amount: 49, currency: "EUR" }, liveRates);
    expect(result.applied).toBe(false);
    expect(result.finalKrw).toBe(base.finalKrw);
  });

  it("케이스 8 — 옵션 가격 자체가 없으면(원본에서 못 읽음) 기본가로 폴백하고 지어내지 않는다", () => {
    const result = computeVariantFinalPriceKrw(base, undefined, liveRates);
    expect(result.applied).toBe(false);
    expect(result.finalKrw).toBe(base.finalKrw);
  });

  it("DELTA 모드 — 원본이 절대가가 아니라 차액 자체를 줄 때는 환산만 하고 기본가 차감을 하지 않는다", () => {
    // 원본이 "+$5"라고 명시한 경우(절대가 아님) — ABSOLUTE처럼 base.amount를
    // 빼면 안 된다, 그대로 환산만 한다.
    const result = computeVariantFinalPriceKrw(base, { amount: 5, currency: "USD", mode: "DELTA" }, liveRates);
    expect(result.finalKrw).toBe(105674 + 7042);
  });

  it("UNKNOWN 모드 — 원본이 절대가/차액 여부를 명시하지 않으면 추정하지 않고 기본가로 폴백한다", () => {
    const result = computeVariantFinalPriceKrw(base, { amount: 49, currency: "USD", mode: "UNKNOWN" }, liveRates);
    expect(result.applied).toBe(false);
    expect(result.finalKrw).toBe(base.finalKrw);
  });

  it("케이스 9/10 — 셀러가 최종 판매가를 수동으로 다시 확정하면(base.finalKrw 변경) 옵션 최종가도 새 기준으로 재계산된다", () => {
    // 판매자가 최종가를 ₩120,000으로 직접 수정했다고 가정 — 옵션 델타는
    // 여전히 원본 통화 차액 기준(환산 7042)이라 마진 재계산 없이 그대로
    // 새 기준값에 얹힌다.
    const manuallyConfirmedBase = { amount: 44, currency: "USD", finalKrw: 120000 };
    const result = computeVariantFinalPriceKrw(manuallyConfirmedBase, { amount: 49, currency: "USD" }, liveRates);
    expect(result.finalKrw).toBe(120000 + 7042);
  });

  it("실측 회귀 방지 — 마진 20%+수수료10%가 걸린 실제 상황에서 옛 버그(convertToKrw(variant)-salePrice)와 다른 값을 낸다", () => {
    // 옛 버그 재현: convertToKrw(49, USD, liveRates) - base.finalKrw
    const buggyDelta = Math.round(49 * 1408.45) - base.finalKrw; // 69014 - 105674 = -36660
    const result = computeVariantFinalPriceKrw(base, { amount: 49, currency: "USD" }, liveRates);
    const fixedDelta = result.finalKrw - base.finalKrw;
    expect(fixedDelta).not.toBe(buggyDelta);
    expect(fixedDelta).toBeGreaterThan(0); // 옛 버그는 음수(반대 부호)였다 — 고친 값은 양수여야 한다.
  });
});

describe("computeVariantFinalPriceKrw + computePriceBreakdown 통합 — Layer1→2→3 전체 파이프라인", () => {
  it("원본 EUR 상품 + 옵션 델타까지 3단계를 순서대로 거쳐도 이중환산이 발생하지 않는다", () => {
    const breakdown = computePriceBreakdown(
      { originalAmount: 29, originalCurrency: "EUR", shippingKrw: 12000, feePercent: 10, marginPercent: 20 },
      { EUR: 1480 },
    );
    const base = { amount: 29, currency: "EUR", finalKrw: breakdown.suggestedPriceKrw };
    const variantResult = computeVariantFinalPriceKrw(base, { amount: 34, currency: "EUR" }, { EUR: 1480 });
    // 5EUR * 1480 = 7400.
    expect(variantResult.finalKrw! - base.finalKrw).toBe(7400);
  });
});

/**
 * 🔴 S2-① — **환율을 모르는 통화의 옵션 차액이 「금액 그대로 KRW」로 더해지던 결함.**
 *
 * convertToKrw 는 환율을 모르는 통화를 `{amountKrw: 금액 그대로, isEstimate:true}` 로
 * 돌려준다(currency.ts:48-50 의 최후 폴백). 그래서 옵션 차액 `+84 CAD` 가 **`+₩84`** 로
 * 더해져 세 채널 등록 payload 의 판매가가 됐다 — 실제 ₩84,000 선과 천 배가 어긋난다.
 *
 * 🔴 `isEstimate` 로는 못 가른다 — 「고정표를 썼다(환율은 안다)」와 「환율을 아예
 * 모른다」가 **둘 다 true** 다. 두 상태를 실제로 가르는 술어는 `hasKnownRateToKrw`
 * 이고 그것을 쓰는 것이 `convertToKrwStrict`(모르면 null)다.
 */
describe("S2-① 환율 미확정 옵션가 — 지어내지도, 조용히 떨어뜨리지도 않는다", () => {
  const base = { amount: 44, currency: "USD", finalKrw: 105674 };
  /** CAD 는 FIXED_RATES_TO_KRW(KRW·EUR·USD·GBP·SEK·JPY)에 «없다». */
  const baseCad = { amount: 100, currency: "CAD", finalKrw: 150000 };

  it("🔴 결함 재현 방지 — 환율을 모르는 통화(CAD)의 차액을 «금액 그대로» 더하지 않는다", () => {
    const result = computeVariantFinalPriceKrw(baseCad, { amount: 184, currency: "CAD" }, { USD: 1408.45 });
    // 옛 동작: convertToKrw(84,"CAD").amountKrw === 84 → 150000 + 84 = 150084.
    expect(result.finalKrw).not.toBe(150084);
    expect(result.finalKrw).toBeNull();
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("RATE_UNAVAILABLE");
  });

  it("🔴 환율을 모르면 기본가로 «폴백하지 않는다» — 옵션 추가금이 조용히 사라지는 것을 막는다", () => {
    const result = computeVariantFinalPriceKrw(baseCad, { amount: 184, currency: "CAD" });
    expect(result.finalKrw).not.toBe(baseCad.finalKrw);
    expect(result.finalKrw).toBeNull();
  });

  it("환율이 주어지면 그 통화도 정상 계산된다 — 막는 것은 «모를 때»뿐이다", () => {
    const result = computeVariantFinalPriceKrw(baseCad, { amount: 184, currency: "CAD" }, { CAD: 1000 });
    expect(result.finalKrw).toBe(150000 + 84000);
    expect(result.applied).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("고정표에 있는 통화(EUR)는 liveRates 가 없어도 계산된다 — 기존 동작 불변", () => {
    const baseEur = { amount: 29, currency: "EUR", finalKrw: 100000 };
    const result = computeVariantFinalPriceKrw(baseEur, { amount: 34, currency: "EUR" });
    expect(result.finalKrw).toBe(100000 + 5 * 1480);
    expect(result.applied).toBe(true);
  });

  it("폴백 세 경우는 «기본가 폴백» 그대로이고 이유만 갈라 적힌다(CPO 케이스 7·8 불변)", () => {
    const noPrice = computeVariantFinalPriceKrw(base, undefined);
    const unknownMode = computeVariantFinalPriceKrw(base, { amount: 49, currency: "USD", mode: "UNKNOWN" });
    const mismatch = computeVariantFinalPriceKrw(base, { amount: 49, currency: "EUR" });
    expect(noPrice.reason).toBe("NO_VARIANT_PRICE");
    expect(unknownMode.reason).toBe("UNKNOWN_PRICE_MODE");
    expect(mismatch.reason).toBe("CURRENCY_MISMATCH");
    for (const r of [noPrice, unknownMode, mismatch]) {
      expect(r.finalKrw).toBe(base.finalKrw); // 🔴 이 셋은 null 이 «아니다».
      expect(r.applied).toBe(false);
    }
  });

  it("차액이 0이면 환율을 몰라도 환산할 것이 없다 — 기본가 그대로 적용된다", () => {
    const result = computeVariantFinalPriceKrw(baseCad, { amount: 100, currency: "CAD" });
    expect(result.finalKrw).toBe(150000);
    expect(result.applied).toBe(true);
  });
});
