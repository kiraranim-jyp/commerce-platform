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
    note: "정확한 상품 식별자 일치",
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
    note: "상품 식별자가 달라 동일상품으로 보기 어렵습니다",
    className: "bg-error-soft text-error",
  },
};

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
