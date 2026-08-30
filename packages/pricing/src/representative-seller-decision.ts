import { sellerDecisionStateFromUnifiedDecision, type UnifiedPriceDecision } from "./unified-price-decision";
import type { SellabilityResult } from "./sellability";

/**
 * P-8(대표님 지시, 2026-08-30) — "서로 독립된 판단 엔진이 같은 화면에서 각자
 * 결론을 표시하면서 상반된 메시지가 동시에 노출되는 문제"를 고친다. 이 파일은
 * 새 가격/매칭 판정을 만들지 않는다 — sellerDecisionStateFromUnifiedDecision과
 * computeSellability가 이미 계산해 낸 값을 어떤 우선순위로 "대표 판단 하나"로
 * 노출할지만 정하는 순수 Presentation Layer다.
 *
 * 왜 두 엔진 중 하나를 우선순위로 고르는가 — market-intelligence.ts 실측 확인:
 * decision/sellerAction/unifiedDecision은 전부 currentSellingPriceKrw(셀러가
 * 확정한 판매가)가 있어야만 값을 낸다. 하지만 현재 프로덕션에는 이 값이 채워진
 * 스냅샷이 사실상 없다(등록 완료 상품도 null) — 그래서 computeSellability(국내
 * 평균가를 잠정 기준으로 참고하는, 판매가 없이도 동작하는 유일한 엔진)가 실제로는
 * 대부분의 경우 유일하게 쓸 수 있는 신호다. sellingPriceKrw가 있으면(드묾) 더
 * 정밀한 unifiedDecision을 우선한다 — 있는 정보를 무시하지 않는다.
 */
export type RepresentativeVerdictCode = "READY" | "REVIEW_PRICE" | "NEEDS_INFO" | "HOLD";

export interface RepresentativeVerdict {
  code: RepresentativeVerdictCode;
  icon: "🟢" | "🟡" | "🟠" | "🔴";
  title: string;
  description: string;
  /** 최소 1개 이상 — 새 문구를 지어내지 않고 기존 엔진의 reason/margin 값을
   * 그대로 재사용해서 만든다. */
  reasons: string[];
}

export interface RepresentativeVerdictInput {
  /** null이거나 verdict가 없으면(=판매가 미확정) Priority 2(sellability)로 폴백한다. */
  unifiedDecision: Pick<UnifiedPriceDecision, "verdict" | "dataCompleteness" | "marginPercent" | "missingComponents"> | null;
  sellability: Pick<SellabilityResult, "level" | "estimatedMarginPercent" | "reason">;
  /** domesticCompetition.sellerCount > 0 — summarizeDomesticMarket이 이미 낸 값,
   * 새로 판정하지 않는다. */
  domesticMatched: boolean;
  domesticSellerCount: number;
}

const VERDICT_COPY: Record<RepresentativeVerdictCode, { icon: RepresentativeVerdict["icon"]; title: string; description: string }> = {
  READY: {
    icon: "🟢",
    title: "현재 조건에서는 등록 진행 가능",
    description: "국내 실제 판매가와 예상 수익 정보를 기준으로 판단했습니다.",
  },
  REVIEW_PRICE: {
    icon: "🟡",
    title: "가격 재검토를 권장합니다",
    description: "현재 가격으로는 예상 수익 또는 경쟁력이 부족할 수 있습니다.",
  },
  NEEDS_INFO: {
    icon: "🟠",
    title: "아직 등록 판단을 내리기 어렵습니다",
    description: "국내 동일상품 가격 또는 비용 정보가 부족합니다.",
  },
  HOLD: {
    icon: "🔴",
    title: "현재 조건에서는 보류를 권장합니다",
    description: "예상 수익성이 낮거나 시장 가격 대비 경쟁력이 부족합니다.",
  },
};

function domesticReason(input: RepresentativeVerdictInput): string {
  return input.domesticMatched
    ? `국내 동일상품 ${input.domesticSellerCount}곳에서 가격 확인됨`
    : "국내 동일상품을 자동으로 찾지 못함";
}

export function deriveRepresentativeSellerVerdict(input: RepresentativeVerdictInput): RepresentativeVerdict {
  // Priority 1 — 판매가가 확정된 경우 sellerDecisionStateFromUnifiedDecision()의
  // 기존 5-state 판단을 그대로 옮긴다(재계산 없음).
  if (input.unifiedDecision?.verdict != null) {
    const state = sellerDecisionStateFromUnifiedDecision(input.unifiedDecision);
    const reasons = [domesticReason(input)];
    if (input.unifiedDecision.marginPercent.value != null) {
      reasons.push(`예상 마진 ${input.unifiedDecision.marginPercent.value}%`);
    }
    if (input.unifiedDecision.dataCompleteness === "INCOMPLETE" && input.unifiedDecision.missingComponents.length > 0) {
      reasons.push(`확인되지 않은 비용: ${input.unifiedDecision.missingComponents.join(", ")}`);
    }
    const code: RepresentativeVerdictCode =
      state.code === "READY"
        ? "READY"
        : state.code === "ADJUST"
          ? "REVIEW_PRICE"
          : state.code === "NOT_RECOMMENDED"
            ? "HOLD"
            : "NEEDS_INFO"; // NEEDS_COST_INFO | UNKNOWN
    return { ...VERDICT_COPY[code], code, reasons };
  }

  // Priority 2 — 판매가 미확정(현재 프로덕션 대부분) 시 computeSellability()의
  // 국내 평균가 잠정 기준 판단을 그대로 옮긴다.
  const reasons = [domesticReason(input)];
  if (input.sellability.estimatedMarginPercent != null) {
    reasons.push(`예상 마진 ${input.sellability.estimatedMarginPercent}%`);
  }

  if (input.sellability.level === "GREEN") {
    return { ...VERDICT_COPY.READY, code: "READY", reasons };
  }
  if (input.sellability.level === "RED") {
    // sellability.ts가 이미 계산해 돌려준 estimatedMarginPercent의 부호만 본다
    // (새 마진 계산 없음) — 음수(원가가 판매가보다 높음)는 가격을 아무리
    // 조정해도 구조적으로 회복 불가능하므로 보류, 0 이상~기준(10%) 미만은
    // 가격 조정으로 회복 가능성이 있으므로 재검토로 구분한다.
    const code: RepresentativeVerdictCode = (input.sellability.estimatedMarginPercent ?? 0) < 0 ? "HOLD" : "REVIEW_PRICE";
    return { ...VERDICT_COPY[code], code, reasons };
  }
  // YELLOW(국내 동일상품 미확인) | UNKNOWN(원가 미확인) — sellability.reason이
  // 이미 두 경우를 정확히 구분해서 설명하므로 그 문장을 그대로 쓴다.
  return { ...VERDICT_COPY.NEEDS_INFO, code: "NEEDS_INFO", reasons: [input.sellability.reason] };
}
