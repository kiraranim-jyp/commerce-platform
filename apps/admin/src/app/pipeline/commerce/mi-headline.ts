import { KR_TARGET_MARKET, type TargetMarket } from "./market-target";
import { miEmptyState, type MiEmptyState } from "./mi-empty-state";

/**
 * MI-FLOW-2(CEO 지시, 2026-09-11) — 헤드라인 "핵심 숫자" 네 칸을 만든다.
 *
 * ── 이 파일이 계산하지 않는 것 ───────────────────────────────────────────
 * 아무것도 계산하지 않는다. 서버가 이미 낸 값(cost / domesticCompetition /
 * recommendation / decision)을 고르고 라벨을 붙일 뿐이다. 환율·착지원가·마진·
 * 추천가 산식은 전부 packages/pricing 그대로다.
 *
 * ── 라벨이 이 파일의 본체다 ──────────────────────────────────────────────
 * 지금까지 헤드라인에는 "€37 ≈ ₩57,756"처럼 통화만 바뀐 한 쌍이 떠 있었다.
 * 그 두 숫자는 같은 가격의 다른 표기가 아니다 — 앞은 *원본 판매자 페이지의
 * 판매가*고, 뒤는 그것을 환율로 환산한 값이거나(경우에 따라) *한국 시장에서
 * 관측된 가격*이다. 둘을 "≈"로 이으면 셀러는 "한국에서도 5만 8천 원이구나"로
 * 읽는다. 그래서 여기서는 어떤 숫자도 기준 없이 내보내지 않는다:
 *   원본 판매가격 → 원본 판매자 페이지 기준
 *   한국 시장 가격 → 한국 시장 기준
 * 두 값은 나란히 놓되 절대 하나의 등식으로 잇지 않는다.
 */
export type HeadlineNumberKey = "originPrice" | "targetMarketPrice" | "landedCost" | "estimatedMargin";

export interface HeadlineNumber {
  key: HeadlineNumberKey;
  label: string;
  /** 이 숫자가 무엇을 기준으로 한 값인지. 라벨만으로 오해될 수 있는 값에만 붙인다. */
  basis: string | null;
  /** 화면에 그대로 쓰는 문자열. 값이 없으면 null이고 그때는 empty를 쓴다. */
  value: string | null;
  /** 값이 없는 이유. value가 있으면 항상 null이다. */
  empty: MiEmptyState | null;
}

export interface HeadlineNumbersInput {
  /** 원본 판매자 페이지에서 읽은 판매가(통화 그대로). 못 읽었으면 null. */
  originPrice: { amount: number; currency: string } | null;
  /** 판단 시장에서 관측된 평균가. 표본이 얇아 계산 못 했으면 null. */
  targetMarketAveragePriceKrw: number | null;
  /** 판단 시장에서 관측된 최저가. 평균가가 없을 때만 대표값으로 쓴다. */
  targetMarketLowestPriceKrw: number | null;
  /** 그 가격이 동일상품 기준인지 비교상품(참고) 기준인지. NONE이면 근거가 없다. */
  targetMarketBasis: "EXACT" | "COMPARISON" | "NONE";
  /** 관측된 시장이 여러 개인데 판단 시장을 확정하지 못한 경우. */
  targetMarketUnresolved: boolean;
  landedCostKrw: number | null;
  /** 추천가 기준 마진(CASE A/B에서만 값이 있다). */
  recommendedMarginPercent: number | null;
  /** 현재 판매가 기준 마진(판매가를 이미 정한 경우에만 있다). */
  currentMarginPercent: number | null;
}

export function formatKrwAmount(krw: number): string {
  return `₩${krw.toLocaleString("ko-KR")}`;
}

/**
 * 원본 통화 금액을 그 통화 그대로 보여준다. 원화로 바꾸지 않는다 — 환산은
 * 착지원가 칸이 이미 책임지고 있고, 여기서 또 환산하면 "원본가 = 한국가"라는
 * 오해가 그대로 돌아온다. Intl이 모르는 통화면 코드를 그대로 붙인다(지어내지 않음).
 */
export function formatOriginAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
      maximumFractionDigits: currency.toUpperCase() === "KRW" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("ko-KR")} ${currency.toUpperCase()}`;
  }
}

/**
 * 판단 시장의 대표 가격을 고른다. 새로 계산하지 않고 우선순위만 정한다:
 *   ① 평균가 — 최저가는 이상치 한 건에 끌려갈 수 있어 대표값으로 쓰지 않는다(UX-1D).
 *   ② 평균가가 없으면 최저가 — 단, 최저가라는 사실을 라벨에 밝힌다.
 *   ③ 둘 다 없으면 값 없음.
 */
export function pickTargetMarketPrice(input: HeadlineNumbersInput): { krw: number; basis: string } | null {
  const grade =
    input.targetMarketBasis === "EXACT" ? "동일상품 기준" : "비교상품 참고가 기준";
  if (input.targetMarketAveragePriceKrw != null) {
    return { krw: input.targetMarketAveragePriceKrw, basis: `한국 시장 평균가 · ${grade}` };
  }
  if (input.targetMarketLowestPriceKrw != null) {
    return { krw: input.targetMarketLowestPriceKrw, basis: `한국 시장 최저가 · ${grade}` };
  }
  return null;
}

export function buildHeadlineNumbers(
  input: HeadlineNumbersInput,
  market: TargetMarket = KR_TARGET_MARKET,
): HeadlineNumber[] {
  const marketPrice = input.targetMarketBasis === "NONE" ? null : pickTargetMarketPrice(input);
  const marginPercent = input.recommendedMarginPercent ?? input.currentMarginPercent;

  return [
    {
      key: "originPrice",
      label: "원본 판매가격",
      basis: "원본 판매자 페이지 기준",
      value: input.originPrice ? formatOriginAmount(input.originPrice.amount, input.originPrice.currency) : null,
      empty: input.originPrice ? null : miEmptyState("UNVERIFIABLE", "원본 상품 가격을 읽지 못했습니다"),
    },
    {
      key: "targetMarketPrice",
      /**
       * UX 2.3(CEO 지시, 2026-09-11) — 라벨을 "한국 시장 가격"에서 "국내 비교상품"
       * 으로 바꾼다. 이 숫자는 한국 편집샵에서 관측된 *남의 판매가*인데, 화면에는
       * 같은 이름을 쓰는 다른 사실이 하나 더 있다: 원본 판매자가 한국 방문자에게
       * 직접 보여주는 가격(currentPrice.costBasis === "KR_MARKET", 내가 살 값).
       * 한 라벨이 둘을 겸하면 셀러는 "내가 살 값"과 "남이 파는 값"을 구분할 수
       * 없다 — 그래서 두 의미에 각각 다른 라벨을 준다(price-hierarchy.ts).
       * 어느 시장의 관측인지는 basis가 계속 말한다(시장 정보를 잃지 않는다).
       */
      label: "국내 비교상품",
      basis: marketPrice ? marketPrice.basis : `${market.label} 시장 관측`,
      value: marketPrice ? formatKrwAmount(marketPrice.krw) : null,
      empty: marketPrice
        ? null
        : input.targetMarketUnresolved
          ? // 시장이 여러 개인데 어느 것이 한국 관측인지 확정 못 한 경우 —
            // 아무 시장이나 골라 "한국 가격"이라고 부르지 않는다.
            miEmptyState("UNVERIFIABLE", "관측된 시장이 여러 개라 한국 기준 가격을 확정하지 못했습니다")
          : miEmptyState("NO_SEARCH_DATA", null),
    },
    {
      key: "landedCost",
      label: "착지원가",
      basis: "배송·수수료 포함 매입 원가",
      value: input.landedCostKrw != null ? formatKrwAmount(input.landedCostKrw) : null,
      empty:
        input.landedCostKrw != null
          ? null
          : miEmptyState("UNVERIFIABLE", "원본 가격을 확인하지 못해 원가를 계산할 수 없습니다"),
    },
    {
      key: "estimatedMargin",
      label: "예상 마진",
      basis: input.recommendedMarginPercent != null ? "추천 판매가 기준" : "현재 판매가 기준",
      value: marginPercent != null ? `${marginPercent.toFixed(1)}%` : null,
      empty:
        marginPercent != null
          ? null
          : miEmptyState("UNVERIFIABLE", "한국 시장 가격이 없어 마진을 계산할 수 없습니다"),
    },
  ];
}
