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
 *
 * P-9-B(대표님 지시, 2026-08-30) — "국내 동일상품 없음 = 판단 불가"라는 철학을
 * 버린다. computeSellability()는 costPriceKrw가 없으면 UNKNOWN을, costPriceKrw는
 * 있는데 국내 동일상품만 없으면 YELLOW를 낸다(sellability.ts 44행 이후 순서:
 * cost 없음을 먼저 걸러내므로 YELLOW에 도달했다는 것 자체가 "비용은 이미
 * 안다"는 뜻) — 이 두 갈래는 지금까지 이 파일에서 똑같이 NEEDS_INFO로
 * 뭉뚱그려져 있었다(P-9 STEP 2 조사에서 확인된 실제 버그). 이제 명확히
 * 분리한다: YELLOW → MARKET_OPPORTUNITY(경쟁 데이터는 없지만 비용 계산은
 * 가능 = 신규/독점 판매 기회일 수 있음), UNKNOWN → NEEDS_INFO(비용 자체를
 * 모름 = 정말 계산할 수 없음). "국내에 없어서 기회"와 "수요가 없어서 없는
 * 것"을 시스템이 구분할 수 없다는 점은 문구에서 단정하지 않는다("독점
 * 상품입니다" 같은 표현 금지, "확인하지 못했습니다" 정도로만 표현).
 */
export type RepresentativeVerdictCode = "READY" | "REVIEW_PRICE" | "MARKET_OPPORTUNITY" | "NEEDS_INFO" | "HOLD";

export interface RepresentativeVerdict {
  code: RepresentativeVerdictCode;
  icon: "🟢" | "🟡" | "🟣" | "🟠" | "🔴";
  title: string;
  description: string;
  /** 최소 1개 이상 — 새 문구를 지어내지 않고 기존 엔진의 reason/margin 값을
   * 그대로 재사용해서 만든다(단, MARKET_OPPORTUNITY는 컨설팅 톤으로 재서술 —
   * 판정 자체(YELLOW라는 사실)는 그대로 두고 표현만 바꾼다). */
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
    title: "판매 진행 추천",
    description: "국내 시장에서 동일상품 가격을 확인했습니다. 현재 비용 기준으로 예상 수익성이 확보됩니다.",
  },
  REVIEW_PRICE: {
    icon: "🟡",
    title: "가격 전략 재검토 추천",
    description: "국내 경쟁 가격은 확인됐지만 현재 비용 기준으로 목표 수익성이 부족합니다.",
  },
  MARKET_OPPORTUNITY: {
    icon: "🟣",
    title: "시장 진입 기회",
    description:
      "국내에서 동일상품 판매 사례를 아직 확인하지 못했습니다. 경쟁 가격 데이터는 부족하지만, 현재 원가와 예상 비용 기준으로 수익성은 계산할 수 있습니다.",
  },
  NEEDS_INFO: {
    icon: "🟠",
    title: "추가 정보가 필요합니다",
    description: "원가, 국제 배송비, 관세/부가세 등 실제 계산에 필요한 정보가 없습니다.",
  },
  HOLD: {
    icon: "🔴",
    title: "판매 조건 재검토 필요",
    description: "현재 비용과 가격 조건에서는 예상 수익이 마이너스입니다. 판매가 또는 매입 조건을 조정한 뒤 다시 검토하는 것을 권장합니다.",
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
            : "NEEDS_INFO"; // NEEDS_COST_INFO | UNKNOWN — 여기선 여전히 "비용 계산 자체가 불완전"이라는 뜻
    return { ...VERDICT_COPY[code], code, reasons };
  }

  // Priority 2 — 판매가 미확정(현재 프로덕션 대부분) 시 computeSellability()의
  // 국내 평균가 잠정 기준 판단을 그대로 옮긴다.
  if (input.sellability.level === "GREEN") {
    const reasons = [domesticReason(input)];
    if (input.sellability.estimatedMarginPercent != null) reasons.push(`예상 마진 ${input.sellability.estimatedMarginPercent}%`);
    return { ...VERDICT_COPY.READY, code: "READY", reasons };
  }
  if (input.sellability.level === "RED") {
    const reasons = [domesticReason(input)];
    if (input.sellability.estimatedMarginPercent != null) reasons.push(`예상 마진 ${input.sellability.estimatedMarginPercent}%`);
    // sellability.ts가 이미 계산해 돌려준 estimatedMarginPercent의 부호만 본다
    // (새 마진 계산 없음) — 음수(원가가 판매가보다 높음)는 가격을 아무리
    // 조정해도 구조적으로 회복 불가능하므로 보류, 0 이상~기준(10%) 미만은
    // 가격 조정으로 회복 가능성이 있으므로 재검토로 구분한다.
    const code: RepresentativeVerdictCode = (input.sellability.estimatedMarginPercent ?? 0) < 0 ? "HOLD" : "REVIEW_PRICE";
    return { ...VERDICT_COPY[code], code, reasons };
  }
  if (input.sellability.level === "YELLOW") {
    // P-9-B — 국내 동일상품이 없어도(sellability가 이 분기에 도달했다는 것
    // 자체가 costPriceKrw는 이미 확인됐다는 뜻, sellability.ts 참고) "판단
    // 불가"로 끝내지 않는다. "독점 상품"이라고 단정하지 않고, 시스템이 아직
    // 확인하지 못했다는 사실만 정직하게 전달한다.
    return {
      ...VERDICT_COPY.MARKET_OPPORTUNITY,
      code: "MARKET_OPPORTUNITY",
      reasons: [
        "국내 자동 검색 기준 동일상품 판매 사례를 확인하지 못했습니다",
        "상품 원가와 예상 비용은 확인되었습니다",
      ],
    };
  }
  // UNKNOWN — 원가 자체를 모른다. sellability.reason이 이미 정확히 설명하므로
  // 그 문장을 그대로 쓴다(새 문구를 지어내지 않는다).
  return { ...VERDICT_COPY.NEEDS_INFO, code: "NEEDS_INFO", reasons: [input.sellability.reason] };
}

/**
 * P-19-B Sprint 8(CPO 지시, 2026-09-02) — 기존 5단계 내부 판정(READY/
 * MARKET_OPPORTUNITY/REVIEW_PRICE/NEEDS_INFO/HOLD)은 그대로 유지한다(재계산
 * 없음, 새 판정 로직 아님) — 판매자에게 최종적으로 보여주는 화면만 3단계로
 * 압축하는 순수 Presentation Layer. CPO가 확정한 매핑 그대로:
 * READY/MARKET_OPPORTUNITY → 🟢 판매 추천, REVIEW_PRICE/NEEDS_INFO → 🟡
 * 조건부 판매, HOLD → 🔴 판매 비추천. 내부 코드/5단계 용어는 화면에 노출하지
 * 않는다 — reasons는 deriveRepresentativeSellerVerdict()가 이미 만든 값을
 * 그대로 재사용한다.
 */
export type SellerFacingVerdictCode = "RECOMMENDED" | "CONDITIONAL" | "NOT_RECOMMENDED";

export interface SellerFacingVerdict {
  code: SellerFacingVerdictCode;
  icon: "🟢" | "🟡" | "🔴";
  title: string;
  reasons: string[];
}

const SELLER_FACING_MAP: Record<RepresentativeVerdictCode, SellerFacingVerdictCode> = {
  READY: "RECOMMENDED",
  MARKET_OPPORTUNITY: "RECOMMENDED",
  REVIEW_PRICE: "CONDITIONAL",
  NEEDS_INFO: "CONDITIONAL",
  HOLD: "NOT_RECOMMENDED",
};

const SELLER_FACING_COPY: Record<SellerFacingVerdictCode, { icon: SellerFacingVerdict["icon"]; title: string }> = {
  RECOMMENDED: { icon: "🟢", title: "판매 추천" },
  CONDITIONAL: { icon: "🟡", title: "조건부 판매" },
  NOT_RECOMMENDED: { icon: "🔴", title: "판매 비추천" },
};

export function toSellerFacingVerdict(verdict: RepresentativeVerdict): SellerFacingVerdict {
  const code = SELLER_FACING_MAP[verdict.code];
  return { ...SELLER_FACING_COPY[code], code, reasons: verdict.reasons };
}
