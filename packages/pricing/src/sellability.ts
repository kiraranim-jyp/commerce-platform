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

  /**
   * ════════════════════════════════════════════════════════════════════════
   * MI-6 / P0-2(CPO 결정, 2026-09-26) — **이 숫자를 「국내 판매가」라고 부르지 않는다.**
   * ════════════════════════════════════════════════════════════════════════
   *
   * 아래 문장들이 이 값을 「국내 판매가」로 적고 있었다. 실제로 들어오는 것은
   * «국내 동일상품 시장 평균가» 이고, 그 둘은 다른 것이다:
   *
   *   국내 판매가        내가 팔 가격 · 실제로 성립하는 가격(CASE 는 최저가로 본다)
   *   시장 평균가         관측된 판매처들의 평균 — 최저가보다 «항상 높거나 같다»
   *
   * 🔴 대시보드(`/today`)가 이 문장을 tooltip 으로 그대로 보여 주므로, 셀러는
   * 평균가를 「국내 판매가」로 읽고 그 마진을 실제 마진으로 읽었다.
   *
   * 🔴 그리고 이 마진은 «해외물류비·수수료를 빼지 않은» 값이다. CASE 는
   * landedCost + 예상수수료로 손익을 보므로 두 숫자는 같은 기준이 아니다 —
   * 그 사실을 문장이 말하지 않으면 같은 상품에서 두 마진이 모순으로 보인다.
   *
   * 🔴 판정식은 한 줄도 바꾸지 않았다. GREEN/RED 경계 · marginFloor · 입력 필드
   *    전부 그대로다. 바뀐 것은 «무엇을 근거로 했는지 말하는 방식» 뿐이다.
   */
  const marginFloor = input.marginFloorPercent ?? DEFAULT_MARGIN_FLOOR_PERCENT;
  const referencePrice = input.domestic.averagePriceKrw;
  const marginPercent = Number((((referencePrice - input.costPriceKrw) / referencePrice) * 100).toFixed(1));

  if (marginPercent < marginFloor) {
    return {
      level: "RED",
      title: "판매 비추천",
      reason:
        marginPercent < 0
          ? `실제 구매원가(₩${input.costPriceKrw.toLocaleString()})가 국내 시장 평균가(₩${referencePrice.toLocaleString()})보다 높습니다 — 마진을 남길 수 없습니다.`
          : `국내 시장 평균가(₩${referencePrice.toLocaleString()}) 기준 예상 마진이 ${marginPercent}%로 최소 기준(${marginFloor}%) 미만입니다(해외물류비·수수료 제외).`,
      estimatedMarginPercent: marginPercent,
    };
  }

  return {
    level: "GREEN",
    title: "판매 추천",
    /* 🔴 「가격 경쟁력이 있습니다」를 «단정하지» 않는다. 이 마진은 해외물류비와
       수수료를 빼지 않은 값이라, 같은 상품에서 CASE 가 손실로 볼 수도 있다
       (평균가 ≥ 최저가 이므로 이 값이 «항상 더 낙관적» 이다). 판정(GREEN)은
       그대로 두고, 그 GREEN 이 무엇을 근거로 한 것인지만 사실대로 적는다. */
    reason: `실제 구매원가 ₩${input.costPriceKrw.toLocaleString()}, 국내 시장 평균가 ₩${referencePrice.toLocaleString()} 기준 예상 마진 ${marginPercent}% — 해외물류비·수수료를 제외한 값입니다.`,
    estimatedMarginPercent: marginPercent,
  };
}
