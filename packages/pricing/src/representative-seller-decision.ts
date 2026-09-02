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
/**
 * P-23(CPO 지시, 2026-09-02) — P-22에서 "동일상품"/"비교상품" 문구는 basis에
 * 따라 갈랐지만, 코드/아이콘(🟢 READY)은 그대로 두었다. CPO 지적: COMPARISON
 * (식별자 없이 상품명만 유사) 기준으로도 마진만 맞으면 여전히 🟢 "판매
 * 추천"으로 보인다 — "동일상품 검증 완료"와 "시장 참고가만 있음"의 신뢰도
 * 차이를 화면이 구분하지 않는다. basis가 EXACT가 아니면(COMPARISON/NONE)
 * READY로 확정하지 않고 REVIEW_MATCH(🟡)로 낮춘다 — 마진 계산 자체는
 * 그대로 두고 "동일상품 근거가 약하다"는 사실만 등급에 반영한다(새 마진
 * 판정 아님).
 */
export type RepresentativeVerdictCode = "READY" | "REVIEW_MATCH" | "REVIEW_PRICE" | "MARKET_OPPORTUNITY" | "NEEDS_INFO" | "HOLD";

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
  /** P-22(CPO 지시, 2026-09-02) — 실측(Bobo Choses: COMPARISON만 있는데 화면
   * 문구는 "동일상품 가격을 확인했다"고 표시되는 버그)으로 발견. domesticMatched만
   * 보고 문구를 정하면 EXACT/COMPARISON을 구분하지 못한다. summarizeDomesticMarketSplit()이
   * 이미 계산한 basis를 그대로 받아 문구만 분기한다 — 새 판정 로직 아님. */
  domesticBasis: "EXACT" | "COMPARISON" | "NONE";
  /** P-24 Sprint 5-7(CPO 지시, 2026-09-02) — 실측(PèPè)에서 발견된 잔여 모순:
   * sellability(원가 vs 시장평균가, 배송비/수수료 미포함)는 GREEN이라 헤드라인이
   * 🟢였지만, 실제 "추천 판매가"(computePriceRecommendation — 착지원가+최소마진
   * 기준, 이미 시장가를 반영하는 기존 함수)는 ₩269,333으로 국내 최저가
   * ₩258,000보다 높았다 — 판매자가 마진 최소기준을 지키려면 시장가보다 비싸게
   * 팔아야 한다는 뜻인데도 화면은 "판매 추천"이라고 말했다. 새 마진 계산을
   * 만들지 않고, 이미 계산된 recommendedPrice와 domesticLowestPriceKrw 두 값만
   * 비교해서 헤드라인을 낮춘다(null이면 비교 대상 자체가 없으므로 기존 로직
   * 그대로 통과). */
  recommendation?: { recommendedPrice: number } | null;
  domesticLowestPriceKrw?: number | null;
}

const VERDICT_COPY: Record<RepresentativeVerdictCode, { icon: RepresentativeVerdict["icon"]; title: string; description: string }> = {
  READY: {
    icon: "🟢",
    title: "판매 진행 추천",
    description: "국내 시장에서 동일상품 가격을 확인했습니다. 현재 비용 기준으로 예상 수익성이 확보됩니다.",
  },
  REVIEW_MATCH: {
    icon: "🟡",
    title: "조건부 판매 검토",
    description: "동일상품은 확인되지 않았습니다. 비교상품(참고용) 시장가격을 참고한 예상 판매가입니다.",
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
  if (!input.domesticMatched) return "국내 동일상품을 자동으로 찾지 못함";
  if (input.domesticBasis === "EXACT") return `국내 동일상품 ${input.domesticSellerCount}곳에서 가격 확인됨`;
  // COMPARISON(식별자 근거 없이 상품명/브랜드만 유사한 후보) 기준이면 "동일상품"이라고
  // 말하지 않는다 — 참고용 시장가격이라는 사실을 그대로 전달한다.
  return `국내 동일상품은 확인되지 않음 — 비교상품(참고용) ${input.domesticSellerCount}곳 시장가격 기준`;
}

/** P-23 — REVIEW_MATCH는 basis===EXACT가 아닐 때만 등장하므로(마진 자체는
 * READY와 동일하게 통과) COMPARISON과 NONE을 구분해서 설명한다. NONE인데
 * "비교상품(참고용)"이라고 말하면 존재하지 않는 비교가격을 있는 것처럼
 * 말하는 것이므로(도메스틱 매칭이 아예 없는 경우) 절대 같은 문구를 쓰지
 * 않는다. */
function reviewMatchDescription(basis: RepresentativeVerdictInput["domesticBasis"]): string {
  if (basis === "COMPARISON") return VERDICT_COPY.REVIEW_MATCH.description;
  return "국내 시장가격을 확인하지 못했습니다. 원가 기준으로만 계산된 예상값이니 등록 전 시장가격을 직접 확인하는 것을 권장합니다.";
}

/** P-24 Sprint 5-7 — 🟢로 확정되려는 판정(READY/MARKET_OPPORTUNITY)만 마지막에
 * 한 번 더 검사한다: 실제 "추천 판매가"가 국내 최저가보다 비싸면(=마진 최소
 * 기준을 지키는 순간 가격 경쟁력을 잃으면) 🟢로 내보내지 않는다. 두 값 중
 * 하나라도 없으면(비교 대상이 없으면) 기존 판정을 그대로 둔다. */
function applyMarketPriceGuard(verdict: RepresentativeVerdict, input: RepresentativeVerdictInput): RepresentativeVerdict {
  if (verdict.code !== "READY" && verdict.code !== "MARKET_OPPORTUNITY") return verdict;
  if (input.recommendation == null || input.domesticLowestPriceKrw == null) return verdict;
  if (input.recommendation.recommendedPrice <= input.domesticLowestPriceKrw) return verdict;
  const gapReason = `국내 최저가 ₩${input.domesticLowestPriceKrw.toLocaleString()}보다 최소마진 확보 판매가 ₩${input.recommendation.recommendedPrice.toLocaleString()}이 더 높아 가격 경쟁력이 없습니다`;
  return {
    ...VERDICT_COPY.REVIEW_PRICE,
    code: "REVIEW_PRICE",
    reasons: [...verdict.reasons, gapReason],
  };
}

export function deriveRepresentativeSellerVerdict(input: RepresentativeVerdictInput): RepresentativeVerdict {
  return applyMarketPriceGuard(deriveBaseVerdict(input), input);
}

function deriveBaseVerdict(input: RepresentativeVerdictInput): RepresentativeVerdict {
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
    let code: RepresentativeVerdictCode =
      state.code === "READY"
        ? "READY"
        : state.code === "ADJUST"
          ? "REVIEW_PRICE"
          : state.code === "NOT_RECOMMENDED"
            ? "HOLD"
            : "NEEDS_INFO"; // NEEDS_COST_INFO | UNKNOWN — 여기선 여전히 "비용 계산 자체가 불완전"이라는 뜻
    // P-23 — 마진이 통과해도(READY) basis가 EXACT가 아니면 동일상품이
    // 검증된 게 아니므로 REVIEW_MATCH로 낮춘다.
    if (code === "READY" && input.domesticBasis !== "EXACT") code = "REVIEW_MATCH";
    const description = code === "REVIEW_MATCH" ? reviewMatchDescription(input.domesticBasis) : VERDICT_COPY[code].description;
    return { ...VERDICT_COPY[code], description, code, reasons };
  }

  // Priority 2 — 판매가 미확정(현재 프로덕션 대부분) 시 computeSellability()의
  // 국내 평균가 잠정 기준 판단을 그대로 옮긴다.
  if (input.sellability.level === "GREEN") {
    const reasons = [domesticReason(input)];
    if (input.sellability.estimatedMarginPercent != null) reasons.push(`예상 마진 ${input.sellability.estimatedMarginPercent}%`);
    const code: RepresentativeVerdictCode = input.domesticBasis === "EXACT" ? "READY" : "REVIEW_MATCH";
    const description = code === "REVIEW_MATCH" ? reviewMatchDescription(input.domesticBasis) : VERDICT_COPY.READY.description;
    return { ...VERDICT_COPY[code], description, code, reasons };
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
 * P-19-B Sprint 8(CPO 지시, 2026-09-02) — 기존 내부 판정(READY/MARKET_OPPORTUNITY/
 * REVIEW_PRICE/NEEDS_INFO/HOLD)은 그대로 유지한다(재계산 없음, 새 판정 로직
 * 아님) — 판매자에게 최종적으로 보여주는 화면만 3단계로 압축하는 순수
 * Presentation Layer. CPO가 확정한 매핑:
 * READY/MARKET_OPPORTUNITY → 🟢 판매 추천, REVIEW_PRICE/NEEDS_INFO → 🟡
 * 조건부 판매, HOLD → 🔴 판매 비추천. 내부 코드 용어는 화면에 노출하지
 * 않는다 — reasons는 deriveRepresentativeSellerVerdict()가 이미 만든 값을
 * 그대로 재사용한다.
 *
 * P-23(CPO 지시, 2026-09-02) — REVIEW_MATCH(신설, P-23 참고)도 여기 추가:
 * 🟡 조건부 판매. "동일상품 미검증"이 곧 마진 문제인 REVIEW_PRICE와 원인은
 * 다르지만, 판매자에게 "바로 등록해도 되는 상태가 아니다"를 전달한다는
 * 목적은 같으므로 같은 3단계 CONDITIONAL로 묶는다(신규 4단계 노출 안 함).
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
  // P-23 — REVIEW_MATCH(동일상품 미검증 + 마진은 통과)는 "판매 추천"으로
  // 뭉뚱그리지 않는다. "조건부 판매"로 낮춰 판매자가 시장가격을 직접
  // 확인해야 한다는 사실을 화면에서 놓치지 않게 한다.
  REVIEW_MATCH: "CONDITIONAL",
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
