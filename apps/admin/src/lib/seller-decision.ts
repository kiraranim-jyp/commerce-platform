/** P-5(CPO 지시, 2026-08-29) — P-4-DATA로 신뢰할 수 있게 만든 3개 축(매칭 신뢰도
 * matchLevel, 가격 신뢰 상태 PriceStatus, 검색 상태 ComparisonResultState) 위에
 * "그래서 셀러가 지금 무엇을 해야 하는가"를 판단하는 4번째 축을 추가한다.
 *
 * 절대 원칙(CPO 지시, STEP2/STEP7) — 이 축은 기존 3축을 대체하거나 하나로
 * 합치지 않는다. 이 파일은 그 3축의 "요약 해석"만 만들 뿐, resolveListingPrice()나
 * 등록가격 엔진과는 어떤 코드 경로로도 연결되지 않는다 — 여기서 계산한 값은
 * 오직 화면에 표시되는 판단 카드(SellerDecisionCard)로만 흘러간다. 가격을
 * 자동으로 바꾸거나 등록을 자동으로 트리거하는 코드는 이 파일에 존재하지 않는다. */

import type { ComparisonResultState } from "./comparison-result-status";
import type { PriceStatus } from "./price-truth";
import { computeKrwAmount } from "./price-truth";

export type SellerDecisionState = "READY_TO_LIST" | "REVIEW_PRICE" | "NEEDS_RECHECK" | "HOLD";

/**
 * P-8 STEP 1-3(대표님 지시, 2026-08-30) — 이 카드는 "해외 원본 상품과의 가격/
 * 매칭 검증 결과"이지 최종 등록 판단이 아니다. deriveSellerDecisionState()의
 * 판정 로직(state 코드)은 그대로 유지하고(STEP 9: "판단 알고리즘 자체를
 * 변경하지 않는다"), 화면에 보이는 제목 문구만 최종 승인으로 읽히던 표현에서
 * "확인됨" 계열로 낮춘다 — 실측(Pepe Shoes, Bruno Cut Out Sandals)으로 확인된
 * 문제: 이 카드가 "🟢 등록 진행 가능"이라고 말하는 동시에 Market Intelligence가
 * "⚪ 판단 불가"라고 말해서 셀러가 어느 쪽을 믿어야 할지 모순됐다. 최종 대표
 * 판단은 DomesticPriceIntelligencePanel의 representativeVerdict 하나뿐이다. */
export const SELLER_DECISION_LABEL: Record<SellerDecisionState, { icon: string; title: string }> = {
  READY_TO_LIST: { icon: "🟢", title: "원본 가격/매칭 확인됨" },
  REVIEW_PRICE: { icon: "🟡", title: "가격 재검토 권장" },
  NEEDS_RECHECK: { icon: "🟠", title: "재확인 필요" },
  HOLD: { icon: "🔴", title: "보류 권장" },
};

type MatchLevel = "very_high" | "high" | "medium" | "low";

export interface SellerDecisionCandidateInput {
  matchLevel?: MatchLevel;
  priceStatus?: PriceStatus;
}

/**
 * 후보 1건만 놓고 봤을 때 "이 후보가 뒷받침할 수 있는 최선의 판단"이 뭔지 계산한다.
 * matchLevel="low"거나 없으면 애초에 판단 근거로 쓰지 않는다(N-4.21 70% 경계 원칙과
 * 동일하게 이 축에서도 low는 후보 취급하지 않는다) — null 반환.
 */
function candidateOutcome(candidate: SellerDecisionCandidateInput): SellerDecisionState | null {
  if (!candidate.matchLevel || candidate.matchLevel === "low") return null;
  const isStrongMatch = candidate.matchLevel === "very_high" || candidate.matchLevel === "high";
  if (candidate.priceStatus === "VERIFIED_CURRENT") {
    return isStrongMatch ? "READY_TO_LIST" : "REVIEW_PRICE";
  }
  // 동일상품이든 유사상품이든, 가격이 검증되지 않았으면(UNVERIFIED_SEARCH/PRICE_UNAVAILABLE/
  // undefined) "재확인 필요" 이상으로 올라갈 수 없다 — matchLevel이 아무리 높아도 예외 없음
  // (price-truth.ts의 불변조건 1과 동일한 정신: 매칭 신뢰도와 가격 신뢰도는 별개다).
  return "NEEDS_RECHECK";
}

const STATE_FAVORABILITY: Record<SellerDecisionState, number> = {
  READY_TO_LIST: 3,
  REVIEW_PRICE: 2,
  NEEDS_RECHECK: 1,
  HOLD: 0,
};

/** 후보 목록 중 "가장 낙관적으로 판단할 수 있는" 후보 하나를 고른다 — 여러 판매처
 * 후보가 섞여 있어도(자기 자신의 재검증 결과 + 다른 유사상품들) 이 중 가장 신뢰할
 * 수 있는 근거 하나를 기준으로 판단한다는 뜻(STEP6 "판단 카드는 근거 1건을 대표로
 * 보여준다"는 설계와 대응). 동률이면 배열의 앞선 후보를 유지한다. */
export function pickBestAcceptableCandidate<T extends SellerDecisionCandidateInput>(candidates: T[]): T | null {
  let best: T | null = null;
  let bestRank = -1;
  for (const candidate of candidates) {
    const outcome = candidateOutcome(candidate);
    if (outcome == null) continue;
    const rank = STATE_FAVORABILITY[outcome];
    if (rank > bestRank) {
      best = candidate;
      bestRank = rank;
    }
  }
  return best;
}

export interface SellerDecisionInput {
  /** SourceVerificationCard의 verification.status와 동일한 값. sourceUrl이 아예
   * 없는 상품은 NOT_APPLICABLE — 이 경우 "원본을 확인 못 했다"는 이유로 HOLD하지
   * 않는다(애초에 확인할 원본 URL이 없는 것과, URL은 있는데 확인에 실패한 것은
   * 다른 상황이다). */
  sourceVerificationStatus: "VERIFIED_CURRENT" | "PRICE_UNAVAILABLE" | "NOT_APPLICABLE" | null;
  searchState: ComparisonResultState;
  /** matchLevel !== "low"인 후보만 넘겨도 되고 전체를 넘겨도 된다 — low는 이 함수
   * 안에서도 다시 걸러진다(candidateOutcome이 null 반환). */
  candidates: SellerDecisionCandidateInput[];
}

export interface SellerDecisionResult {
  state: SellerDecisionState;
  reason: string;
}

/**
 * STEP3 우선순위(위에서부터 먼저 만족하는 조건이 이긴다) — CPO의 STEP9 실측
 * 예시(Booty Ghosts Long Sleeve→🟢, Booty Ghosts T-Shirt 후보→🟡, Misha & Puff
 * Mink 후보→🟠, Stamp Bloom 검색 0건 당시→🟠)와 교차검증 완료:
 *
 * 1. searchState="ERROR"(검색 시스템 자체 오류) → HOLD — 판단 근거 자체를 못 만든다.
 * 2. sourceVerification이 "확인 시도했으나 실패"(PRICE_UNAVAILABLE)이고, 이를
 *    대신할 만큼 강한 후보(동일상품+가격검증완료)도 없으면 → HOLD — 원본도
 *    모르고 대체 근거도 없는, 가장 위험한 상태.
 * 3. searchState가 RATE_LIMITED/PARTIAL_FAILURE(일부만 확인됨) → NEEDS_RECHECK.
 * 4. searchState가 NO_RESULTS이거나 판단에 쓸 후보가 아예 없으면 → NEEDS_RECHECK.
 * 5. 그 외(RESULTS_FOUND + 후보 있음) → 그 후보들 중 가장 낙관적인 결과를 그대로 채택.
 */
export function deriveSellerDecisionState(input: SellerDecisionInput): SellerDecisionResult {
  const { sourceVerificationStatus, searchState, candidates } = input;
  const best = pickBestAcceptableCandidate(candidates);
  const bestOutcome = best ? candidateOutcome(best) : null;

  if (searchState === "ERROR") {
    return { state: "HOLD", reason: "가격 비교 시스템에 오류가 발생해 판단 근거를 확인할 수 없습니다." };
  }
  if (sourceVerificationStatus === "PRICE_UNAVAILABLE" && bestOutcome !== "READY_TO_LIST") {
    return {
      state: "HOLD",
      reason: "원본 상품의 현재 가격을 확인하지 못했고, 이를 대신할 만큼 확실한 비교 상품도 없습니다.",
    };
  }
  if (searchState === "RATE_LIMITED" || searchState === "PARTIAL_FAILURE") {
    return { state: "NEEDS_RECHECK", reason: "일부 판매처를 확인하지 못해 비교 결과가 아직 완전하지 않습니다." };
  }
  if (searchState === "NO_RESULTS" || !best || !bestOutcome) {
    return { state: "NEEDS_RECHECK", reason: "비교할 수 있는 상품을 찾지 못해 판단 근거가 부족합니다." };
  }
  const reasons: Record<SellerDecisionState, string> = {
    READY_TO_LIST: "동일상품으로 확인된 후보의 현재 가격이 검증되었습니다.",
    REVIEW_PRICE: "유사상품 후보의 가격은 확인되었지만, 동일상품인지는 확실하지 않습니다.",
    NEEDS_RECHECK: "일치 가능성이 있는 후보는 있지만 가격이 아직 확인되지 않았습니다.",
    HOLD: "판단 근거가 부족합니다.",
  };
  return { state: bestOutcome, reason: reasons[bestOutcome] };
}

export interface PriceDifferenceSide {
  status: PriceStatus | undefined;
  price: { amount: number; currency: string } | null;
}

export interface PriceDifferenceResult {
  status: "COMPUTED" | "NOT_COMPUTABLE";
  reason?: string;
  originalKrw?: number;
  comparisonKrw?: number;
  diffKrw?: number;
  diffPercent?: number;
}

/**
 * STEP4(CPO 지시) — 원본과 비교 대상이 "둘 다" VERIFIED_CURRENT일 때만 가격 차이를
 * 계산한다. 하나라도 검증되지 않았으면 절대 숫자를 만들지 않고 "가격 차이 계산
 * 불가"만 반환한다 — 임의 추정 금지. krwRates는 이 함수를 호출하는 컴포넌트가
 * 한 번 조회한 값을 그대로 넘긴다(price-truth.ts의 computeKrwAmount를 그대로
 * 재사용하므로 단일 FX 엔진 원칙이 코드 레벨에서 보장된다 — 별도 환율 계산 없음).
 */
export function computePriceDifference(
  original: PriceDifferenceSide | null,
  comparison: PriceDifferenceSide | null,
  krwRates: Record<string, number> | null,
): PriceDifferenceResult {
  if (!original || original.status !== "VERIFIED_CURRENT" || !original.price) {
    return { status: "NOT_COMPUTABLE", reason: "원본 가격이 검증되지 않아 가격 차이를 계산할 수 없습니다." };
  }
  if (!comparison || comparison.status !== "VERIFIED_CURRENT" || !comparison.price) {
    return { status: "NOT_COMPUTABLE", reason: "비교 상품 가격이 검증되지 않아 가격 차이를 계산할 수 없습니다." };
  }
  const originalKrw = computeKrwAmount(original.price.amount, original.price.currency, krwRates);
  const comparisonKrw = computeKrwAmount(comparison.price.amount, comparison.price.currency, krwRates);
  if (originalKrw == null || comparisonKrw == null) {
    return { status: "NOT_COMPUTABLE", reason: "환율 정보를 확인할 수 없어 가격 차이를 계산할 수 없습니다." };
  }
  const diffKrw = comparisonKrw - originalKrw;
  const diffPercent = (diffKrw / originalKrw) * 100;
  return { status: "COMPUTED", originalKrw, comparisonKrw, diffKrw, diffPercent };
}
