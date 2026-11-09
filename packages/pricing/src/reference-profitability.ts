import { marginPercentAt } from "./price-recommendation";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 REFERENCE-PRICE-PROFITABILITY-AXIS-1 — **참고가격 기준 예상 수익성**(CPO 승인)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇인가 ────────────────────────────────────────────────────────────────
 * 「수집된 후보 가격(참고가격)으로 팔면 **예상 마진이 몇 %인가**」만 낸다.
 * 🔴 **그 이상은 하지 않는다.**
 *
 * ── 🔴🔴 왜 «별도 축» 인가 — 기존 정책과의 경계(CPO 확정 2026-11-09) ────────────
 * ```
 * 기존 `computePriceDecision`   COMPARISON 가격으로 **판매 verdict 를 만들지 않는다** → 유지
 * 신규 이 함수                   COMPARISON 가격으로 **예상 마진율만** 계산한다       → 허용
 * ```
 * 🔴 그 분리에는 **실측 근거** 가 있다(`price-decision.ts:16-40` · CEO 명시) —
 *    EXACT 없이 COMPARISON 만 있는 **6건 중 4건이 `CONSIDER_LOWER`** 였고, 그것은
 *    「같은 상품이 아닌 물건의 가격으로 **가격을 낮추라고 권한** 것」이었다.
 * 🟢 그래서 이 함수는 **행동 권고를 구조적으로 만들 수 없다** — 아래 타입에
 *    `verdict`·`recommendation`·`action` 칸이 **없다**(계약이 그것을 문다).
 *
 * ── 🔴 하지 않는 것(전부 CPO 금지 조항) ──────────────────────────────────────
 * ```
 * ❌ 판매 추천/비추천 · 가격 인하 권고 · 「경쟁력」 판정
 * ❌ `marketCase`(CASE A~D) · `finalVerdict` · `recommendedPriceKrw` 에 영향
 * ❌ `PRESUMED_SAME` → `EXACT` 승격 · tier 변경
 * ❌ **새 공식** — 마진율은 `marginPercentAt`(기존 owner)를 **그대로** 부른다
 * ❌ 통화 환산 — 입력은 **이미 KRW 로 좁혀진** 참고가격이다(호출부 책임)
 * ```
 */

export interface ReferenceProfitabilityInput {
  /**
   * 🔴 **참고가격(KRW).** 호출부가 `candidateDomesticPrice.byCurrency.KRW.lowestAmount`
   *    를 그대로 넘긴다 — 이 함수는 **집계하지 않는다**.
   *    🔴 `null` 이면 계산하지 않는다(없는 가격으로 수익성을 지어내지 않는다).
   */
  referencePriceKrw: number | null;
  /** 🔴 착지원가(KRW). `cost.landedCostKrw` 그대로 · 여기서 다시 계산하지 않는다. */
  landedCostKrw: number | null;
  /** 목표 마진(%). `priceBreakdown.marginPercent` 그대로. */
  targetMarginPercent: number | null;
  /** 🟢 근거가 된 **판매처 수**(집계기가 이미 센 값). */
  sellerCount: number;
  /** 🔴 「가격 미확인」으로 금액에서 빠진 수(집계기의 `unverifiedCount`). */
  excludedUnverified: number;
  /** 🔴 「관측된 차이」로 금액에서 빠진 수(집계기의 `observedDifferenceCount`). */
  excludedObservedDifference: number;
}

export interface ReferenceProfitabilityResult {
  /**
   * 🔴 **이 축이 무엇에 근거하는가.** 값이 하나뿐인 이유는 그것이 **사실** 이기 때문이다 —
   *    이 축은 **언제나** 「참고가격 기준 · 동일상품 미검증」이다.
   */
  basis: "REFERENCE_PRICE";
  /** 참고가격으로 팔 때의 예상 마진율(%). 🔴 입력이 모자라면 `null`. */
  marginPercent: number | null;
  /** 🟢 목표마진 충족 여부. 🔴 **권고가 아니다** — 사실 비교 하나다. */
  meetsTargetMargin: boolean | null;
  /**
   * 🔴 그대로 되돌려 준다 — 화면이 목표마진을 **다른 경로에서 다시 찾지 않게** 한다.
   *    🔴 받는 쪽이 `priceBreakdown` 을 따로 읽으면 **두 값이 갈릴 수 있는 구조** 가 된다.
   */
  targetMarginPercent: number | null;
  /** 화면이 「근거 N곳」으로 쓰는 값. */
  sellerCount: number;
  /** 화면이 「제외 M곳」으로 쓰는 값(두 사유의 합). */
  excludedCount: number;
  excludedUnverified: number;
  excludedObservedDifference: number;
  /** 🔴 그대로 되돌려 준다 — 화면이 금액을 **다시 찾지 않게** 한다(owner 하나). */
  referencePriceKrw: number | null;
}

/**
 * 🔴 **순수 함수.** 네트워크 0 · DB 0 · 집계 0 · 환산 0.
 * 🔴 입력이 모자라면 **계산하지 않고 `null`** 을 낸다(「0%」로 적지 않는다 — 측정불가다).
 */
export function computeReferenceProfitability(
  input: ReferenceProfitabilityInput,
): ReferenceProfitabilityResult {
  const { referencePriceKrw, landedCostKrw, targetMarginPercent } = input;
  const computable =
    referencePriceKrw != null && referencePriceKrw > 0 && landedCostKrw != null && landedCostKrw >= 0;
  /** 🔴 **기존 공식 그대로** — 사본 0(`marginPercentAt` 가 유일한 owner). */
  const marginPercent = computable ? marginPercentAt(referencePriceKrw, landedCostKrw) : null;
  return {
    basis: "REFERENCE_PRICE",
    marginPercent,
    meetsTargetMargin:
      marginPercent == null || targetMarginPercent == null ? null : marginPercent >= targetMarginPercent,
    targetMarginPercent,
    sellerCount: input.sellerCount,
    excludedCount: input.excludedUnverified + input.excludedObservedDifference,
    excludedUnverified: input.excludedUnverified,
    excludedObservedDifference: input.excludedObservedDifference,
    referencePriceKrw: computable ? referencePriceKrw : null,
  };
}
