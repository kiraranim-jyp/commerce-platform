/**
 * N-4.18-Q3(대표님 지시, 2026-08-26) — "가격 비교"가 아니라 "이 상품을 등록해도
 * 되는가?"라는 등록 전 질문에 직접 답한다. computePriceDecision/computeSellerAction은
 * 이미 판매가(currentSellingPriceKrw)가 정해진(=대부분 이미 등록된) 상품의 "가격을
 * 유지/조정할지" 판단이라 전제가 다르다 — 이 함수는 아직 판매가가 없는 상품도
 * 다룬다(국내 동일상품 평균가를 잠정 판매가로 참고만 한다).
 *
 * PèPè 실측 사례(2026-08-26)가 이 함수가 필요한 이유의 근거다: 국내 동일상품
 * 자동 검색이 실패했을 때 화면에 아무 판단도 없으면 사용자가 "£200×환율=₩377,400"과
 * "실제 한국 표시가 ₩234,800"을 직접 비교해야 했다 — 이 함수는 그 대신 "국내
 * 동일상품을 못 찾아 확정할 수 없다"를 명시적으로 알려준다(있지도 않은 국내
 * 판매가를 지어내지 않는다).
 */
export type SellabilityLevel = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export interface SellabilityDomesticInput {
  /** 국내 동일상품을 실제로 찾아 가격까지 확인했는지. false면 아래 가격
   * 필드는 참고하지 않는다(찾지 못한 상태에서 가격을 지어내지 않는다). */
  matched: boolean;
  averagePriceKrw: number | null;
}

export interface SellabilityInput {
  /** 실제 해외 구매원가(KRW) — 호출부가 이미 "한국 로케일 표시가 우선,
   * 없으면 원문×환율" 우선순위를 적용해서 넘긴다(이 함수는 그 우선순위를
   * 다시 판단하지 않는다). */
  costPriceKrw: number | null;
  domestic: SellabilityDomesticInput;
  /** 마진율이 이 값(%) 미만이면 등록 비추천 — computePriceDecision과 같은
   * 기본값(10%)을 쓴다(임의의 새 기준을 만들지 않는다). */
  marginFloorPercent?: number;
}

export interface SellabilityResult {
  level: SellabilityLevel;
  title: string;
  reason: string;
  /** 국내 평균가 대비 예상 마진(%) — 동일상품을 못 찾았거나 원가를 모르면 null. */
  estimatedMarginPercent: number | null;
}

const DEFAULT_MARGIN_FLOOR_PERCENT = 10;

export function computeSellability(input: SellabilityInput): SellabilityResult {
  if (input.costPriceKrw == null || input.costPriceKrw <= 0) {
    return {
      level: "UNKNOWN",
      title: "원가 확인 필요",
      reason: "실제 구매 가능 가격을 아직 확인하지 못했습니다.",
      estimatedMarginPercent: null,
    };
  }

  if (!input.domestic.matched || input.domestic.averagePriceKrw == null || input.domestic.averagePriceKrw <= 0) {
    return {
      level: "YELLOW",
      title: "국내 동일상품 확인 필요",
      reason: "국내 동일상품을 자동으로 찾지 못했습니다 — 가격 기준을 확정할 수 없어 등록 전 직접 확인이 필요합니다.",
      estimatedMarginPercent: null,
    };
  }

  const marginFloor = input.marginFloorPercent ?? DEFAULT_MARGIN_FLOOR_PERCENT;
  const referencePrice = input.domestic.averagePriceKrw;
  const marginPercent = Number((((referencePrice - input.costPriceKrw) / referencePrice) * 100).toFixed(1));

  if (marginPercent < marginFloor) {
    return {
      level: "RED",
      title: "판매 비추천",
      reason:
        marginPercent < 0
          ? `실제 구매원가(₩${input.costPriceKrw.toLocaleString()})가 국내 판매가(₩${referencePrice.toLocaleString()})보다 높습니다 — 마진을 남길 수 없습니다.`
          : `국내 판매가(₩${referencePrice.toLocaleString()}) 기준 예상 마진이 ${marginPercent}%로 최소 기준(${marginFloor}%) 미만입니다.`,
      estimatedMarginPercent: marginPercent,
    };
  }

  return {
    level: "GREEN",
    title: "판매 추천",
    reason: `실제 구매원가 ₩${input.costPriceKrw.toLocaleString()}, 국내 판매가 ₩${referencePrice.toLocaleString()} — 예상 마진 ${marginPercent}%로 가격 경쟁력이 있습니다.`,
    estimatedMarginPercent: marginPercent,
  };
}
