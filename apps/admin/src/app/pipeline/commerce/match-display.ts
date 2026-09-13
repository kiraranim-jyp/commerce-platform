import type { MatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { ProductMatchTruth } from "@commerce/crawler/src/comparison-search/product-identity";

/**
 * MATCHING-UNIFY-1(CPO 지시, 2026-09-06) — 국내/해외 가격비교의 매칭 상태를
 * 같은 의미면 같은 모양으로 보여주기 위한 단일 매핑.
 *
 * 그동안 세 곳(DomesticShopSearch / DomesticPriceIntelligencePanel /
 * ComparisonShopSearch)이 각자 라벨 맵을 들고 있어서, 같은 뜻인데 화면마다
 * 다르게 보였다. 예: 국내는 SIMILAR을 "🟡 비교상품", 해외는 "⚪ 유사상품"으로
 * 표시했다. 셀러 입장에서는 어느 쪽이 더 믿을 만한지 알 수 없다.
 *
 * 판정 알고리즘은 건드리지 않는다. matchTruth/productMatchTruth 값 자체와
 * 가격 반영 정책(EXACT/CONFIRMED만 동일상품 가격으로 사용)은 그대로이고,
 * 여기서는 **그 결과를 어떤 말로 부를지**만 통일한다.
 *
 * 두 축의 값 개수가 다르다는 점이 중요하다:
 *  - 국내 MatchTruth(6종)에는 옵션 차이를 나타내는 값이 없다.
 *  - 해외 ProductMatchTruth(7종)에는 SAME_MODEL_VARIANT("동일 모델인데 색상/
 *    사이즈 등 옵션이 다름")가 실제로 있다.
 * 그래서 "동일 모델 · 옵션 다름"은 해외에서만 나온다. 국내에서 이 라벨을
 * 만들어내면 시스템이 모르는 사실을 말하는 셈이라 만들지 않는다.
 */
export type MatchDisplayTier =
  | "SAME"
  | "SAME_MODEL_OPTION_DIFF"
  | "PRESUMED_SAME"
  | "SIMILAR"
  | "UNKNOWN"
  | "CONFLICT";

export interface MatchDisplay {
  tier: MatchDisplayTier;
  icon: string;
  /** 배지에 쓰는 짧은 라벨. */
  label: string;
  /** 라벨만으로 부족할 때 덧붙이는 한 줄 근거. */
  note: string;
  className: string;
}

const TIERS: Record<MatchDisplayTier, MatchDisplay> = {
  SAME: {
    tier: "SAME",
    icon: "🟢",
    label: "동일상품",
    // MATCHING-2.0-CORE(2026-09-13) — 이 등급에 오는 길이 둘이 됐다. 품번이 실제로
    // 일치한 경우와, 브랜드·상품군·색상·소재·핏·대상 연령이 한꺼번에 맞아 확인된
    // 경우다. 앞의 문구("정확한 상품 식별자 일치")는 뒤쪽 경우에 대해 화면이
    // 사실이 아닌 말을 하게 만든다 — 두 경우에 모두 참인 말로 바꾸고, 이 등급만
    // 가격 비교에 쓰인다는 정책까지 배지에서 읽히게 한다.
    note: "동일상품으로 확인됨 — 가격 비교에 사용",
    className: "bg-success-soft text-success",
  },
  SAME_MODEL_OPTION_DIFF: {
    tier: "SAME_MODEL_OPTION_DIFF",
    icon: "🔵",
    label: "동일 모델 · 옵션 다름",
    note: "같은 모델이지만 색상/사이즈 등 옵션이 다릅니다 — 참고 가격",
    className: "bg-primary/10 text-primary",
  },
  PRESUMED_SAME: {
    tier: "PRESUMED_SAME",
    icon: "🟡",
    label: "동일상품 추정",
    note: "식별자 미확인 · 상품명/카테고리 등으로 추정 — 참고 가격",
    className: "bg-warning-soft text-warning",
  },
  SIMILAR: {
    tier: "SIMILAR",
    icon: "⚪",
    label: "유사상품",
    note: "유사한 상품이지만 동일상품으로 확정할 수 없습니다",
    className: "bg-background text-text-tertiary",
  },
  UNKNOWN: {
    tier: "UNKNOWN",
    icon: "⚪",
    label: "판단 불가",
    note: "동일상품 여부를 판단할 충분한 정보가 없습니다",
    className: "bg-background text-text-tertiary",
  },
  CONFLICT: {
    tier: "CONFLICT",
    icon: "🔴",
    label: "다른 상품 가능성",
    // 반증의 종류도 늘었다 — 품번뿐 아니라 대상 연령(성인↔아동), 성별, 상품군,
    // 색상이 서로 어긋나는 경우가 여기로 온다.
    note: "대상·색상·상품군·품번 중 하나 이상이 서로 어긋납니다",
    className: "bg-error-soft text-error",
  },
};

/**
 * MI-UX-9(CPO 지시, 2026-09-07 §5/§6/§7) — 기본 가격비교 리스트에 무엇을 넣을지.
 *
 * MI의 목적은 "시장에 뭐가 얼마나 있는지 전부 보여주는 것"이 아니라 판매 판단
 * 근거를 주는 것이다. 그래서 매칭 가능성이 있는 등급만 기본으로 보여주고,
 * 판단 근거가 될 수 없는 등급은 "더 보기" 뒤로 보낸다.
 *
 * 기본 노출에서 빼는 두 가지:
 *  - CONFLICT: 식별자가 실제로 충돌한다 — 가격 근거로 쓰면 안 되는 값이다.
 *  - UNKNOWN(INSUFFICIENT_EVIDENCE): 판단 근거 자체가 부족하다.
 * 둘 다 데이터를 지우는 게 아니라 기본 노출에서만 뺀다(진단용으로 계속 필요).
 *
 * SAME_MODEL_OPTION_DIFF(해외 SAME_MODEL_VARIANT)는 CPO 지시서의 ①②③ 목록에
 * 명시되지 않았지만 기본 노출에 포함한다 — "같은 모델인데 옵션만 다름"은 충돌이
 * 아니라 참고 가격으로서 SIMILAR보다 판단 가치가 높고, §8이 이 배지를 유지하라고
 * 지시했기 때문이다. 가격 반영 정책은 그대로다(직접 반영 아님, 참고 가격).
 */
const DEFAULT_VISIBLE_TIERS = new Set<MatchDisplayTier>([
  "SAME",
  "SAME_MODEL_OPTION_DIFF",
  "PRESUMED_SAME",
  "SIMILAR",
]);

export function isDefaultVisibleTier(tier: MatchDisplayTier): boolean {
  return DEFAULT_VISIBLE_TIERS.has(tier);
}

/** 기본 화면에서 그룹을 쌓는 순서. 판단 가치가 높은 등급이 항상 위에 온다 —
 * 정렬 결과에 기대지 않고 렌더링 구조 자체로 순서를 고정한다(P-24 Sprint 2에서
 * 국내 표에 적용했던 원칙을 국내/해외 공통으로 올린 것). */
export const DEFAULT_TIER_ORDER: MatchDisplayTier[] = [
  "SAME",
  "SAME_MODEL_OPTION_DIFF",
  "PRESUMED_SAME",
  "SIMILAR",
];

/** 그룹 제목. 배지 라벨(TIERS[].label)과 같은 말을 쓴다 — 같은 판정을 그룹에서는
 * 다르게 부르면 MATCHING-UNIFY-1이 없앤 문제가 그대로 돌아온다. */
export function tierGroupLabel(tier: MatchDisplayTier): string {
  return `${TIERS[tier].icon} ${TIERS[tier].label}`;
}

/** MI-UX-9 §7 — 유사상품은 가격 판단에 의미가 있는 상위 몇 건만 기본 노출하고
 * 나머지는 "더 보기"로 넘긴다. 서버 정렬(랭킹 점수) 순서를 그대로 신뢰한다 —
 * 여기서 새로 정렬하지 않는다. */
export const SIMILAR_DEFAULT_LIMIT = 3;

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **확정되지 않은 등급은 셋까지.**
 *
 *   🟢 동일상품      전부
 *   🟡 동일상품 추정  상위 3건
 *   ⚪ 유사상품      상위 3건
 *   그 아래          기본 화면에 그리지 않는다(isDefaultVisibleTier)
 *
 * ── 왜 동일상품만 자르지 않는가 ─────────────────────────────────────────
 * 🟢은 "이 상품이 저기에도 있다"는 **사실의 목록**이다. 넷째 판매처를 감추면
 * 화면이 시장을 실제보다 좁게 말한다. 반면 🟡/⚪은 확정되지 않은 **후보**이고,
 * 후보는 길어질수록 판단을 돕는 게 아니라 판단을 미루게 만든다 — 실측에서 한
 * 검색이 유사상품 스무 건을 내놓는 일이 흔하다.
 *
 * 🔵 동일 모델 · 옵션 다름도 확정되지 않은 참고 등급이라 같은 상한을 쓴다
 * (해외에서만 나오는 값이다 — 국내 MatchTruth에는 이 값이 없다). 지시문의 세
 * 그룹에 이름이 없다는 이유로 그룹을 통째로 지우지는 않는다: 그건 상한이
 * 아니라 삭제이고, 지금 화면에 있는 사실이 사라진다.
 *
 * 자른 나머지는 버리지 않는다 — 호출부가 "더 보기" 묶음으로 넘긴다(데이터
 * 삭제가 아니라 기본 노출량 제한).
 */
const DEFAULT_LIMIT_BY_TIER: Partial<Record<MatchDisplayTier, number>> = {
  SAME_MODEL_OPTION_DIFF: SIMILAR_DEFAULT_LIMIT,
  PRESUMED_SAME: SIMILAR_DEFAULT_LIMIT,
  SIMILAR: SIMILAR_DEFAULT_LIMIT,
};

export function defaultLimitForTier(tier: MatchDisplayTier): number | null {
  return DEFAULT_LIMIT_BY_TIER[tier] ?? null;
}

/**
 * MI-MATCHING-INTEGRATION-2(CEO 지시, 2026-09-13) — **애초에 목록에 설 수 있는
 * 후보인가.**
 *
 * 지시가 적은 통과 조건은 다섯이다:
 *
 *   브랜드 일치 · 상품 유형 일치 · 대상(audience) 충돌 없음 ·
 *   명시적 색상/품번 충돌 없음 · 최소 유사도
 *
 * ── 여기서 판정을 새로 하지 않는다 ──────────────────────────────────────
 * 앞의 넷은 이미 계산된 값 하나에 그대로 들어 있다. compareCrossSellerProducts
 * (packages/crawler/comparison-search/cross-seller.ts)가 CONFLICT로 끝내는
 * 경우가 정확히 그 넷이다 — BRAND · CATEGORY(상품 유형) · AUDIENCE/GENDER ·
 * COLOR · MODEL_CODE. 그리고 브랜드를 확인하지 못했거나 상품 유형이 겹치지
 * 않으면 그 후보는 SAME 등급에 도달하지 못한다(blockers/coreAxes). 즉 다섯 축의
 * 결과는 crossSellerVerdict와 matchTruth/productMatchTruth 안에 이미 있고,
 * 화면이 할 일은 **그 값을 읽는 것**이지 같은 비교를 한 번 더 하는 것이 아니다.
 * 여기서 축을 다시 재면 판정기와 화면이 서로 다른 답을 내는 날이 온다.
 *
 * 다섯째(최소 유사도)만 이 층의 값이다. 텍스트 점수가 바닥인데 근거도 없는
 * 후보는 "유사상품"이라고 부를 근거조차 없다 — 다만 **근거가 있으면** 점수는
 * 보지 않는다(실측: Smallable 430701 ↔ Bobo B226AC114은 상품명 어휘가 거의
 * 겹치지 않아 텍스트로는 0.38인데 교차판매처 판정은 SAME이다). 점수 하한이
 * 근거를 이기면 이번 작업이 되살린 그 후보가 다시 화면에서 사라진다.
 */
export const MIN_DISPLAY_SIMILARITY = 0.2;

export interface CandidateDisplayGateInput {
  tier: MatchDisplayTier;
  /** scoreCandidateMatch가 이미 낸 텍스트 유사도. 다시 계산하지 않는다. */
  confidence: number;
  /** 교차판매처 판정(있으면). 없으면 이 후보에 대해 판정이 돌지 않았다는 뜻이다. */
  crossSellerVerdict?: "SAME" | "PRESUMED_SAME" | "SIMILAR" | "UNKNOWN" | "CONFLICT";
}

export function mayShowCandidate(input: CandidateDisplayGateInput): boolean {
  // ① 다섯 축 중 하나라도 명시적으로 어긋난 후보는 목록에 서지 않는다.
  //    (CONFLICT 등급은 그 반증이 있다는 뜻 그 자체다.)
  if (input.crossSellerVerdict === "CONFLICT") return false;
  if (!isDefaultVisibleTier(input.tier)) return false;
  // ② 근거로 올라온 등급은 텍스트 점수를 보지 않는다 — 점수 하한이 근거를
  //    이기면 "판매처마다 SKU가 다른" 바로 그 쌍이 다시 사라진다.
  if (input.tier === "SAME" || input.tier === "SAME_MODEL_OPTION_DIFF") return true;
  if (input.crossSellerVerdict === "SAME" || input.crossSellerVerdict === "PRESUMED_SAME") return true;
  // ③ 그 밖에는 최소 유사도.
  return input.confidence >= MIN_DISPLAY_SIMILARITY;
}

/** 국내(matchTruth) → 공통 표시. 국내에는 옵션 차이 데이터가 없으므로
 * SAME_MODEL_OPTION_DIFF는 나올 수 없다. */
export function domesticMatchDisplay(truth: MatchTruth): MatchDisplay {
  switch (truth) {
    case "EXACT_IDENTIFIER":
    case "STRONG_IDENTIFIER":
      return TIERS.SAME;
    case "TEXT_CONFIRMED":
      return TIERS.PRESUMED_SAME;
    case "SIMILAR":
      return TIERS.SIMILAR;
    case "CONFLICT":
      return TIERS.CONFLICT;
    case "INSUFFICIENT_EVIDENCE":
      return TIERS.UNKNOWN;
  }
}

/** 해외(productMatchTruth) → 공통 표시. VERY_SIMILAR는 "식별자 없이 텍스트로만
 * 강하게 유사"라 국내 TEXT_CONFIRMED와 같은 성격이므로 같은 등급으로 묶는다. */
export function overseasMatchDisplay(truth: ProductMatchTruth): MatchDisplay {
  switch (truth) {
    case "EXACT_PRODUCT":
    case "CONFIRMED_PRODUCT":
      return TIERS.SAME;
    case "SAME_MODEL_VARIANT":
      return TIERS.SAME_MODEL_OPTION_DIFF;
    case "VERY_SIMILAR":
      return TIERS.PRESUMED_SAME;
    case "SIMILAR":
      return TIERS.SIMILAR;
    case "CONFLICT":
      return TIERS.CONFLICT;
    case "INSUFFICIENT_EVIDENCE":
      return TIERS.UNKNOWN;
  }
}
