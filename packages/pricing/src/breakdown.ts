import { convertToKrw } from "./currency";

/**
 * P0-1(가격 계산 투명화) — "원가 → 최종 판매가"만 보여주던 걸 원본가격/환율/
 * 상품원가/배송비/수수료/마진 단계별로 전부 노출한다. 배송비/수수료/마진은
 * 실제 물류·정산 데이터가 없어 추정치다(환율의 isEstimate 플래그와 같은 이유로
 * "추정"임을 숨기지 않는다) — 사용자가 직접 값을 바꿀 수 있게 해서 각자 알고
 * 있는 실제 배송비/수수료율을 반영할 수 있게 한다.
 */
export interface PriceBreakdownInput {
  originalAmount: number;
  originalCurrency: string;
  /**
   * **해외물류비**(KRW) — 해외 판매처에서 물건을 받아 한국까지 들여오는 데
   * 판매자가 치르는 돈이다. 실제 물류 데이터가 없어 판매자가 직접 입력/수정하는
   * 값이고, 비어 있으면 DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw 가 들어온다.
   *
   * ── 🔴 SHIPPING-POLICY-01 ③ — 이 칸과 «섞이면 안 되는» 세 가지 ───────────
   * 이 저장소에는 "배송비"라는 말이 붙은 값이 넷이고, 넷 다 다른 돈이다.
   * 이름이 비슷하다는 이유로 연결하면 원가가 소리 없이 틀린다:
   *
   *   ① shippingKrw (이 칸)            해외 판매처 → 한국. 판매자가 «치르는» 돈.
   *                                     원가에 «들어간다».
   *   ② SellerProfile.deliveryCharge    국내 구매자에게 «청구하는» 배송비
   *      (Settings「배송비(원)」)        (쿠팡/스마트스토어 등록 payload 용).
   *                                     🔴 원가가 아니다 — unified-price-decision.ts:22
   *                                     의 결정 그대로 원가 합산에 넣지 않는다.
   *                                     UnifiedPriceInput.customerChargedShippingKrw
   *                                     로만 통과한다(참고 표시 전용).
   *   ③ 롯데ON·마켓 출고배송비          플랫폼 등록 정보. 국내 출고 조건이지
   *                                     해외물류비가 아니다.
   *   ④ sellerDomesticShippingCostKrw   판매자가 부담하는 «국내» 배송원가.
   *                                     MI-UX-FINAL-4 에서 계산에서 빠졌다(@deprecated).
   *
   * 이 셋(②③④) 중 어느 값도 이 칸으로 흘러들어오면 안 된다. 반대로 이 칸의
   * 값이 등록 payload 의 배송비로 나가서도 안 된다.
   */
  shippingKrw: number;
  /** 플랫폼 수수료율(%, 0~100). */
  feePercent: number;
  /** 목표 마진율(%, 0~100) — 최종 판매가에서 수수료를 제하고도 이 비율만큼
   * 원가 대비 남도록 역산한다. */
  marginPercent: number;
}

export interface PriceBreakdown extends PriceBreakdownInput {
  exchangeRate: number;
  isRateEstimate: boolean;
  /** 원본가격 * 환율. */
  costKrw: number;
  /** costKrw + shippingKrw — 마진/수수료를 계산하는 기준 원가. */
  landedCostKrw: number;
  /** landedCostKrw / (1 - fee% - margin%) — 수수료를 떼고도 목표 마진이
   * 남도록 역산한 제안 판매가. fee%+margin%가 100%를 넘으면(비현실적 입력)
   * landedCostKrw를 그대로 반환한다(음수/무한대 방지). */
  suggestedPriceKrw: number;
}

/** roundingUnit(기본 1 = 반올림 없음) — 쿠팡처럼 10원 단위 입력만 허용하는
 * 플랫폼에서 권장 판매가격을 그 단위로 맞출 때 쓴다(roundToUnit 재사용). */
export function computePriceBreakdown(
  input: PriceBreakdownInput,
  liveRates?: Record<string, number>,
  roundingUnit = 1,
): PriceBreakdown {
  const { originalAmount, originalCurrency, shippingKrw, feePercent, marginPercent } = input;
  const converted = convertToKrw(originalAmount, originalCurrency, liveRates);
  const rate = originalAmount === 0 ? 0 : converted.amountKrw / originalAmount;
  const costKrw = converted.amountKrw;
  const landedCostKrw = costKrw + shippingKrw;
  const retainedRatio = 1 - (feePercent + marginPercent) / 100;
  const suggestedPriceKrw =
    retainedRatio > 0 ? roundToUnit(landedCostKrw / retainedRatio, roundingUnit) : roundToUnit(landedCostKrw, roundingUnit);

  return {
    originalAmount,
    originalCurrency,
    shippingKrw,
    feePercent,
    marginPercent,
    exchangeRate: rate,
    isRateEstimate: converted.isEstimate,
    costKrw,
    landedCostKrw,
    suggestedPriceKrw,
  };
}

export type VariantPriceMode = "ABSOLUTE" | "DELTA" | "UNKNOWN";

export interface VariantFinalPriceResult {
  /** 이 옵션 조합에 실제로 적용해야 할 최종 판매가(KRW). */
  finalKrw: number;
  /** false면 옵션 원본가를 반영하지 못해(통화 불일치/UNKNOWN/값 없음)
   * 기본 상품의 최종가를 그대로 썼다는 뜻 — 화면이 "옵션가 미확인"으로
   * 구분해서 보여줄 수 있게 한다. */
  applied: boolean;
}

/**
 * Sprint A-4(CPO 지시: "옵션마다 환율/마진을 다시 독립적으로 계산하지 않는다,
 * 기본 상품의 최종 판매가 기준으로 옵션 가격 차이만 반영한다") —
 *
 * 발견된 버그(수정 대상): 기존 로직(packages/listing의 buildOptionCombinations)은
 * `convertToKrw(variant.price) - salePrice`를 그대로 옵션 가격차로 썼다.
 * salePrice는 이미 마진/수수료가 적용된 최종 판매가인데 variant.price는
 * 마진 없는 원본 환산값이라, 마진이 0이 아닌 한(기본값 20%+수수료 10%)
 * 항상 실제와 다른(대개 음수로 뒤집힌) 델타가 나왔다 — 예: 기본 $77→최종
 * ₩165,640(마진 포함)인데 옵션 Red $82(기본보다 비쌈)가
 * convertToKrw(82)-165,640 ≈ -55,000으로 계산돼 "옵션이 더 싸다"는 반대
 * 결과가 나왔다. 이 함수가 그 자리를 대체한다: 원본 통화 단계에서 먼저
 * 차액을 구하고, 그 차액만 환율로 환산해서(마진 재적용 없이) 기본
 * 최종가에 더한다.
 */
export function computeVariantFinalPriceKrw(
  base: { amount: number; currency: string; finalKrw: number },
  variant: { amount: number; currency: string; mode?: VariantPriceMode } | undefined,
  liveRates?: Record<string, number>,
): VariantFinalPriceResult {
  if (!variant) return { finalKrw: base.finalKrw, applied: false };
  const mode: VariantPriceMode = variant.mode ?? "ABSOLUTE";
  if (mode === "UNKNOWN") return { finalKrw: base.finalKrw, applied: false };
  if (variant.currency.toUpperCase() !== base.currency.toUpperCase()) {
    // 케이스 7(CPO 지시: "옵션별 통화가 서로 다른 경우 → UNRESOLVED") — 서로
    // 다른 통화의 절대값을 빼면 의미 없는 숫자가 나온다. 값을 지어내지 않고
    // 기본 상품가로 폴백한다.
    return { finalKrw: base.finalKrw, applied: false };
  }
  const deltaSourceAmount = mode === "DELTA" ? variant.amount : variant.amount - base.amount;
  if (deltaSourceAmount === 0) return { finalKrw: base.finalKrw, applied: true };
  const deltaKrw = convertToKrw(deltaSourceAmount, variant.currency, liveRates).amountKrw;
  return { finalKrw: base.finalKrw + deltaKrw, applied: true };
}

/**
 * 🔴 SHIPPING-POLICY-01 ② — **기본 해외물류비 ₩12,000. 없애지 않는다.**
 *
 * ── 이 값이 무엇인가 ────────────────────────────────────────────────────
 * 실제 배송비를 «모를 때» 쓰는 기본값이다. 어떤 실측의 결과도 아니고, 어떤
 * 나라·어떤 배송수단의 요금표도 아니다. 판매자가 화면에서 곧바로 고칠 수 있는
 * 자리를 비워 두지 않기 위한 출발값이다(P0-1 가격 계산 투명화, 629b33e).
 *
 * ── 🔴 이 값은 «일본 전제»가 아니다 ────────────────────────────────────
 * 이 상수는 중량·출발국이라는 개념이 이 저장소에 생기기 전부터 있었다
 * (parcel-weight.ts 도입 전까지 국제배송비는 언제나 이 한 칸이었다). 실제로
 * 이 값으로 굴러온 카테고리는 아동의류이고, 그 조달처는 유럽이다
 * (Bobo Choses = 스페인, EUR). 즉 **국가 무관 기본값**이지 특정 노선의
 * 요금이 아니다 — 그래서 출발국이 미상이어도 쓸 수 있다.
 *
 * 반대로, 이 값을 «일본 EMS 요금» 으로 재정의하면 안 된다. 일본발 중량기반
 * 요금은 EMS_JAPAN_TO_KOREA_BRACKETS 가 따로 갖고 있고, 그 표는 출발국이
 * 일본일 때만 열린다(hasConfirmedWeightBasedShippingRates).
 *
 * ── 쓸 수 있는 조건 / 쓰면 안 되는 조건 ─────────────────────────────────
 *   🟢 쓸 수 있다  판매자가 실제 배송비를 입력하지 않았고, 화면이 이 값을
 *                  «기본값» 이라고 구분해서 말할 때. 출발국을 몰라도 된다.
 *   🔴 쓰면 안 된다 이 값을 «실제 배송비» · «조회된 요금» 처럼 표시하는 것.
 *                  중량기반 카테고리(GOLF)의 «계산 불가» 자리를 이 값으로
 *                  메우는 것 — 그건 EMS 표가 답하지 못한 자리를 국가 무관
 *                  기본값으로 덮는 일이고, GOLF-04 가 막은 문제와 같다.
 *
 * 19,800 은 이 자리에 온 적이 없다. 그 숫자는 Settings「배송비(원)」의
 * placeholder(구매자 청구 배송비)와 스마트스토어 payload fixture 의 baseFee 뿐이다.
 */
export const DEFAULT_PRICE_BREAKDOWN_INPUT: Pick<PriceBreakdownInput, "shippingKrw" | "feePercent" | "marginPercent"> = {
  shippingKrw: 12000,
  feePercent: 10,
  marginPercent: 20,
};

/**
 * 🔴 SHIPPING-POLICY-01 ② — **이 배송비가 «기본값»인가 «판매자가 넣은 값»인가.**
 *
 * CEO 지시: "실제 배송비를 모를 때 기본값 12,000원을 쓰되 «실제 배송비라고
 * 표시하면 안 된다»". 그러려면 화면이 두 상태를 구분할 수 있어야 하는데,
 * 지금 구조가 실제로 구분할 수 있는 만큼만 답한다 — 더는 못 한다:
 *
 *   SELLER_INPUT   값이 기본값과 «다르다». shippingKrw 를 쓰는 곳이
 *                  PriceCalculationDetail 의 입력칸 하나뿐이므로(전수 확인),
 *                  기본값과 다른 값은 판매자가 직접 넣은 값일 수밖에 없다.
 *   DEFAULT        값이 기본값과 «같다». 판매자가 손대지 않았거나, 손댔는데
 *                  마침 같은 값을 넣었거나 — 🔴 이 둘은 지금 구조로 구분되지
 *                  않는다. 구분하려면 «판매자가 입력했다»는 사실 자체를
 *                  저장해야 하고, 그건 데이터 모델 변경이다(보고 §4).
 *
 * 구분이 안 되는 쪽을 DEFAULT 로 몰아 두는 것이 안전한 방향이다. 여기서 틀리면
 * 화면은 «확인되지 않았다»고 과하게 말할 뿐이고, 반대로 틀리면 기본값을 실측인
 * 것처럼 말하게 된다 — CEO 가 막으라고 한 것이 그 방향이다.
 */
export type OverseasShippingBasis = "DEFAULT" | "SELLER_INPUT";

export interface OverseasShippingBasisResult {
  basis: OverseasShippingBasis;
  /** 화면이 그대로 쓰는 한 줄. DEFAULT 는 절대 «실제 배송비»라고 말하지 않는다. */
  label: string;
}

export function resolveOverseasShippingBasis(shippingKrw: number): OverseasShippingBasisResult {
  return shippingKrw === DEFAULT_PRICE_BREAKDOWN_INPUT.shippingKrw
    ? {
        basis: "DEFAULT",
        label: `기본 해외물류비 적용 — 실제 배송비로 확인된 값이 아닙니다`,
      }
    : { basis: "SELLER_INPUT", label: "판매자가 입력한 해외물류비" };
}

/** Sprint N-3.8(가격 계산 모델 통일 — CPO 지시) — 예전에는 화면 상단 요약이
 * "환율변환가 × (1+마진%)"(마크업) 공식을, 아래 Breakdown이 "판매가 = 랜디드
 * 원가 / (1-수수료%-마진%)"(마진율) 공식을 각각 따로 써서 같은 "마진 20%"라는
 * 라벨로 서로 다른 숫자가 나오는 버그가 있었다(computeMarginPrice가 그 마크업
 * 공식이었다 — 이제 삭제). 이제는 computePriceBreakdown() 하나만 화면 전체
 * (요약 + Breakdown)에서 공유하고, "마진"은 항상 "판매가 기준으로 남기고 싶은
 * 비율"(마크업이 아니라 진짜 margin)로만 계산한다. DEFAULT_MARGIN_PERCENT도
 * DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent와 같은 값으로 맞췄다(전에는
 * 22%/20%로 서로 달라서 그 자체가 또 다른 불일치 원인이었다). */
export const DEFAULT_MARGIN_PERCENT = DEFAULT_PRICE_BREAKDOWN_INPUT.marginPercent;
export const DEFAULT_PRICE_ROUNDING_UNIT = 10;

/** 25,303 → 25,300 / 25,305 → 25,310 (CPO 예시 그대로) — 반올림 단위 기본
 * 10원, Settings에서 100/1000원으로 바꿀 수 있다(A-11 작업2). */
export function roundToUnit(amountKrw: number, unit: number): number {
  if (unit <= 0) return Math.round(amountKrw);
  return Math.round(amountKrw / unit) * unit;
}
