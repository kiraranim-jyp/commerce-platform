/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-CASE-ACCURACY-06 — **추천 입력 구성의 «순수» 진입점**(CPO 선택지 A 승인)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 이 파일이 생겼는가.** `computeMarketIntelligence(snapshotId, workspaceId)` 는
 *    머리에서 **DB 를 세 번** 부른다(`getSnapshot` · `listSnapshotCandidateReviews` ·
 *    `getPriceHistory` ×3). 그래서 **DB 없이는 가격 계산 경로에 도달조차 못 한다** —
 *    MI-CASE-ACCURACY-05 가 그 차단을 확정했다(순수 진입점 부재 · export 4개 전수).
 *    ⟹ GT 검증이 fixture 의 **손으로 쓴 `recommendation` 스텁** 을 비교 기준으로 쓰게 되고,
 *       그 스텁은 운영 로직과 **실제로 달랐다**(`brandMedian × 0.95` 미적용 · 84,459 ↔ 80,236).
 *
 * 🟢 그래서 **계산식을 옮기지 않고** 「입력을 구성해 `computePriceRecommendation` 을 부르는
 *    그 한 조각」만 순수 함수로 꺼낸다. 운영은 이 함수를 부르고, 테스트도 **같은 함수** 를 부른다.
 *
 * ── 🔴 이 파일이 **하지 않는** 것 ─────────────────────────────────────────────
 * ```
 * ❌ 계산식 변경          ❌ CASE A/B/C/D 조건 변경    ❌ 수수료·마진 정책 변경
 * ❌ 새 기본값·새 상수     ❌ DB 조회                   ❌ 응답 스키마 변경
 * 🟢 하는 일은 하나다 — **운영이 넘기던 그 인자 묶음을 그대로 만들어 그대로 넘긴다.**
 * ```
 * 🔴 `minimumMarginPercent: 10` 은 **운영에 하드코딩돼 있던 값** 이다. 여기로 옮겼을 뿐이고
 *    바꾸지 않았다 — 기본값으로 숨기지 않고 **상수로 드러내** 다음 사람이 보게 한다.
 * 🔴 환율 추정 게이트(`isRateEstimate`)는 **호출부에 그대로 남긴다** — 그것은 「계산하지 말라」는
 *    «정책» 이고 입력 구성이 아니다. 여기로 끌어오면 두 곳이 같은 판단을 하게 된다.
 */
import { computePriceRecommendation } from "@commerce/pricing";

/**
 * 🔵 순수 함수의 입력 스키마 — **운영이 그 자리에서 이미 들고 있던 값들** 이다.
 *
 * 🔴 이름을 운영 변수명 그대로 둔다(`landedCostKrw` · `domesticBasis` …). 새 어휘를 만들면
 *    다음 사람이 「여기서 또 뭔가를 판정한다」고 읽는다.
 */
export interface RecommendationInput {
  /** `cost.landedCostKrw` — `costKrw + shippingKrw`(breakdown.ts). 🔴 관세·부가세는 들어오지 않는다(CEO 정책). */
  landedCostKrw: number;
  /** `currentSellingPriceKrw ?? undefined` — 없으면 넘기지 않는다. */
  currentSellingPriceKrw?: number | null;
  /** `domesticSummary.lowestPriceKrw` */
  domesticLowestPriceKrw: number | null;
  /** `domesticSummary.averagePriceKrw` */
  domesticAveragePriceKrw: number | null;
  /** `domesticMarketSplit.basis` — `"EXACT"` 가 아니면 CASE D 다. */
  domesticBasis: Parameters<typeof computePriceRecommendation>[0]["domesticBasis"];
  /** `breakdownInput.marginPercent` */
  targetMarginPercent: number;
  /** `breakdownInput.feePercent` — 「예상 수수료」이지 특정 채널 요율이 아니다. */
  expectedFeePercent: number;
  /** `usableBrandMarketProfile?.medianPriceKrw ?? null` — CASE D 에서만 쓰인다(P-13A). */
  brandMedianPriceKrw: number | null;
}

/**
 * 🔴 **운영에 하드코딩돼 있던 최소 마진.** 값을 바꾸지 않았다 — 옮기면서 **드러냈다**.
 *    (market-intelligence.ts 의 `minimumMarginPercent: 10` 그 줄)
 */
export const MI_MINIMUM_MARGIN_PERCENT = 10;

/**
 * 🔵🔵 **운영 경로와 테스트 경로가 «같은» 함수를 쓰게 하는 지점.**
 *
 * 🔴 테스트 전용 계산식을 만들지 않는다 — 이 함수가 유일한 구성자이고, 그 안에서
 *    부르는 것은 기존 `computePriceRecommendation` **그대로** 다.
 * 🟢 그래서 fixture 입력으로 돌린 결과가 **운영이 내는 결과와 같다**(같은 코드를 지난다).
 */
export function buildRecommendationFromInput(input: RecommendationInput) {
  return computePriceRecommendation({
    totalCostKrw: input.landedCostKrw,
    currentSellingPriceKrw: input.currentSellingPriceKrw ?? undefined,
    domesticLowestPriceKrw: input.domesticLowestPriceKrw,
    domesticAveragePriceKrw: input.domesticAveragePriceKrw,
    domesticBasis: input.domesticBasis,
    minimumMarginPercent: MI_MINIMUM_MARGIN_PERCENT,
    targetMarginPercent: input.targetMarginPercent,
    // 🔴 MI-P0-COST-02 — 손익 경계를 Net 으로 옮기는 단 하나의 입력.
    expectedFeePercent: input.expectedFeePercent,
    // P-13A — EXACT 시장가가 없을 때(CASE D)만 이 값이 실제로 쓰인다.
    brandMedianPriceKrw: input.brandMedianPriceKrw,
  });
}
