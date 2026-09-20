import { computePriceBreakdown, type PriceBreakdown, type PriceBreakdownInput } from "@commerce/pricing";

/**
 * MI-FINAL-UX-3(CEO 지시, 2026-09-12) — 수익성 요약과 상세 계산이 **같은 세 숫자**를
 * 말하게 하는 단 하나의 지점.
 *
 * ── 무엇이 문제였나(실측) ────────────────────────────────────────────────
 * 프로덕션 화면에서 「수익성」은 ⚪ 확인 불가인데, 바로 아래 [ⓘ 가격 계산 기준]을
 * 펼치면 착지원가 · 권장 판매가격 · 예상 이익이 전부 숫자로 적혀 있었다. 두
 * 화면이 서로 다른 계산을 한 것이 아니라 **입력이 갈라져 있었다**:
 *
 *   수익성 요약  서버 응답의 currentPrice.sellingPriceKrw
 *                = product.priceOverrideKrw (market-intelligence.ts:116)
 *                → 셀러가 아직 가격을 확정하지 않은 ② 시장 판단 단계에서는 항상 null.
 *                  그 null이 unifiedDecision을 통째로 null로 만들고
 *                  (market-intelligence.ts:234 `cost != null && currentSellingPriceKrw != null`)
 *                  예상 수익·마진이 ⚪ 확인 불가로 떨어졌다.
 *   상세 계산    priceOverrideKrw ?? breakdown.suggestedPriceKrw
 *                → 확정 전에는 **권장 판매가로 폴백**하므로 언제나 숫자가 있다.
 *
 * 즉 확정 전 상품에서 두 화면은 구조적으로 어긋나 있었다. 고칠 자리는 폴백
 * 규칙이고, 그 규칙은 한 곳에만 있어야 한다 — 이 파일이 그 한 곳이다.
 *
 * ── 새 계산이 아니다 ────────────────────────────────────────────────────
 * 아래 세 줄은 PriceCalculationDetail이 지금까지 자기 안에서 하던 식을 **글자
 * 그대로** 옮긴 것이다. 산식(computePriceBreakdown)도, feePercent의 의미(최종
 * 판매가 기준 비율)도, 반올림 단위도 건드리지 않았다. 바뀐 것은 그 식이 사는
 * 자리뿐이고, 그래서 요약이 상세의 **사본**이 아니라 같은 함수의 같은 결과가 된다.
 */
export interface ProfitabilitySource {
  /** product.price.value — 원본 통화 금액. 상세 계산은 타이핑 중인 draft를 넘긴다. */
  originalAmount: number;
  originalCurrency: string;
  /**
   * product.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT — 국제배송비·수수료율·목표마진.
   *
   * 🔴 P0-C STEP 3 — `shippingKrw` 가 **null 일 수 있다**(판매자가 입력칸을 비웠다 =
   *    「모른다」). 0 과 다른 사실이다 — 0 은 「무료라고 확인했다」는 주장이다.
   */
  breakdownInput: Pick<PriceBreakdownInput, "feePercent" | "marginPercent"> & { shippingKrw: number | null };
  /**
   * product.priceValidity !== "VALID"면 원본 가격을 못 읽은 상품이다.
   * 그때 상세 계산도 숫자를 그리지 않고 경고 배너만 세우므로(N-3.54), 요약도
   * 숫자를 갖지 않는다 — "상세에는 값이 있는데 요약만 확인 불가"가 다시 생기는
   * 경로를 여기서 막는다.
   */
  priceResolved: boolean;
  /** product.priceOverrideKrw?.value — 셀러가 확정한 값. 없으면 권장가로 폴백한다. */
  priceOverrideKrw: number | null;
}

export interface ProfitabilityNumbers {
  /** 상세 계산이 자기 사슬(원본가 → 환율 → 원화 환산 → …)을 그릴 때 쓰는 원본. */
  breakdown: PriceBreakdown;
  /** 원화 환산 + 국제배송비. 상세의 「착지원가」 줄과 같은 값이다. */
  landedCostKrw: number;
  /** 착지원가 / (1 − 수수료% − 마진%). 상세의 「권장 판매가」 줄과 같은 값이다. */
  recommendedPriceKrw: number;
  /** 실제로 팔 값 — 확정했으면 그 값, 아니면 권장가. 이익이 무엇 기준인지 정한다. */
  finalPriceKrw: number;
  feeAmountKrw: number;
  /** 최종 판매가 − 착지원가 − 수수료. 상세의 「예상 이익」 줄과 같은 값이다. */
  expectedProfitKrw: number;
}

export function computeProfitabilityNumbers(
  source: ProfitabilitySource,
  liveRates: Record<string, number> | undefined,
  roundingUnit: number,
): ProfitabilityNumbers | null {
  if (!source.priceResolved) return null;
  /**
   * 🔴 P0-D(2026-09-20) — **priceValidity 를 믿지 않고 값 자체를 본다.**
   *
   * 실측(snapshot f43c931f): `priceValidity="VALID"` 인데 `amount 0 · currency ""`.
   * 그러면 위 문은 통과하고, 아래 계산은 상품가 0 에 해외물류비만 더한
   * 「배송비로 만든 가격」을 낸다. resolveListingPrice 에 같은 문을 달았으므로
   * 여기에도 단다 — 한쪽만 막으면 화면의 권장가와 등록가가 갈린다.
   */
  if (!(source.originalAmount > 0) || !source.originalCurrency) return null;
  /**
   * 🔴 P0-C STEP 3(CEO 승인, 2026-09-20) — **배송비를 모르면 숫자를 그리지 않는다.**
   *
   * 바로 위 `priceResolved` 문과 «같은 문»이다. 원본 가격을 못 읽었을 때 이
   * 화면이 숫자 대신 경고를 세우는 것처럼, 해외물류비를 모를 때도 착지원가·
   * 권장가·예상이익을 만들지 않는다. 배송비를 빼고 더한 착지원가는 「최소
   * 확인 가능한 원가」가 아니라 **배송비를 0 으로 친 원가**이고, 그 위에 선
   * 권장가·이익은 전부 낙관적으로 틀린다(unified-price-decision 에서 고친 것과
   * 같은 사고다).
   *
   * 🔴 0 은 여기 걸리지 않는다. 판매자가 «0 을 입력한» 것은 「무료라고 확인했다」는
   *    유효한 관측이다(CEO 지시). 걸리는 것은 «비운» 경우(null)뿐이다.
   */
  const shippingKrw = source.breakdownInput.shippingKrw;
  if (shippingKrw == null) return null;
  const breakdown = computePriceBreakdown(
    {
      originalAmount: source.originalAmount,
      originalCurrency: source.originalCurrency,
      ...source.breakdownInput,
      shippingKrw,
    },
    liveRates,
    roundingUnit,
  );
  // 사용자가 아직 아무것도 커밋하지 않았으면(priceOverrideKrw == null) 권장
  // 판매가격을 그대로 쓴다(자동 커밋 아님 — 확정은 ③ 등록 준비의 [적용] 하나뿐).
  // 예상 이익은 "실제로 팔 값" 기준이어야 하므로 여기서도 같은 규칙으로 고른다.
  const finalPriceKrw = source.priceOverrideKrw ?? breakdown.suggestedPriceKrw;
  const feeAmountKrw = Math.round((finalPriceKrw * source.breakdownInput.feePercent) / 100);
  return {
    breakdown,
    landedCostKrw: breakdown.landedCostKrw,
    recommendedPriceKrw: breakdown.suggestedPriceKrw,
    finalPriceKrw,
    feeAmountKrw,
    expectedProfitKrw: finalPriceKrw - breakdown.landedCostKrw - feeAmountKrw,
  };
}
