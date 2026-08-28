import { computePriceDecision, priceLevelFromVerdict, type PriceDecisionVerdict, type PriceLevel } from "./price-decision";

/**
 * P-1-3(대표님 지시, 2026-08-28) — 단일 가격판단 엔진. P-1-2 조사에서 확인된
 * 문제: 같은 상품인데 PriceEditor(computePriceBreakdown 기반, 배송비/수수료
 * 반영)와 Market Intelligence/대시보드(computePriceDecision 기반, 해외
 * 원가만 반영)가 서로 다른 "마진" 숫자를 보여준다(P-1-3 STEP 1 기준선 테스트
 * 실측: 같은 상품이 경로별로 30.0% vs 46.3%, 8.0% vs 26.5%로 다르게 나옴).
 *
 * 이 파일은 기존 computePriceBreakdown/computePriceDecision을 대체하지
 * 않는다("기존 계산식 임의 수정 금지", "computeLandedCost()를 삭제하거나
 * 재작성 금지") — computePriceDecision()의 verdict/level 계산 로직은 그대로
 * 재사용하고, 이 함수가 하는 일은 오직 "그 함수에 넘길 costPriceKrw를 배송비/
 * 관부가세/수수료까지 포함한 진짜 원가로 만들어주는 것"뿐이다. MAINTAIN/
 * CONSIDER_LOWER/MARGIN_RISK, GREEN/YELLOW/RED라는 이름은 절대 바꾸지
 * 않는다(P-1-2에서 확인: 이미 대시보드/UI 전역에서 쓰이는 값이라 이름을
 * 바꾸면 그 자체가 회귀 위험).
 *
 * 핵심 원칙(대표님 명시, P-1-3 지시) — "SellerProfile.deliveryCharge를
 * 원가에 넣으면 안 된다." 그 값은 고객에게 청구하는 배송비이지 판매자가
 * 부담하는 국내 배송원가가 아니다(P-1-2 실측: packages/listing/src/coupang/
 * build-payload.ts의 deliveryChargeType/deliveryCharge가 그대로 증거).
 * sellerDomesticShippingCostKrw(판매자 실제 부담 원가)는 현재 시스템에 없는
 * 값이라 항상 status="unknown"이 기본이고, customerChargedShippingKrw(고객
 * 청구 배송비, SellerProfile.deliveryCharge 연결 가능)는 이 파일의 원가
 * 합산에는 전혀 참여하지 않는 정보용 필드로만 남긴다(STEP 8).
 */
export type PriceValueStatus = "actual" | "estimated" | "unknown";

export interface PriceComponent {
  value: number | null;
  status: PriceValueStatus;
  source?: string;
}

export interface UnifiedPriceInput {
  /** 해외 상품가를 이미 KRW로 환산한 값(실제 크롤러 추출 + convertToKrw 결과).
   * 통화 변환 자체는 이 함수의 책임이 아니다 — 호출부가 packages/pricing의
   * convertToKrw()로 미리 환산해서 넘긴다(중복 환산 로직을 만들지 않는다). */
  sourceProductPriceKrw: PriceComponent;
  /** 환율 자체 값(예: 1740) — 원가 합산에는 쓰이지 않는다(sourceProductPriceKrw가
   * 이미 환산된 값이므로). "환율이 실제값인지 fallback인지"를 화면에 그대로
   * 보여주기 위한 투명성 목적의 필드다. */
  exchangeRate: PriceComponent;
  internationalShippingKrw: PriceComponent;
  /** 판매자가 실제로 부담하는 국내 배송원가. P-1-2 실측 결과 현재 시스템에
   * 이 값을 추적하는 곳이 전혀 없다 — 호출부가 값을 지어내지 않는 한 항상
   * { value: null, status: "unknown" }이 기본이다. */
  sellerDomesticShippingCostKrw: PriceComponent;
  /** 고객에게 청구하는 배송비(SellerProfile.deliveryCharge와 연결 가능).
   * 원가 합산에 자동으로 더하지 않는다(STEP 8) — 판매 구조(배송비를 매출로
   * 잡고 배송원가를 비용으로 잡는 모델)가 아직 이 시스템에 없기 때문이다.
   * UnifiedPriceDecision에 그대로 통과시켜 화면에서 참고용으로만 보여준다. */
  customerChargedShippingKrw: PriceComponent;
  customsDutyKrw: PriceComponent;
  customsVatKrw: PriceComponent;
  /** 플랫폼 수수료율(%). 현재 판매가 기준으로 곱한다(computeLandedCost와
   * 동일한 이유 — 실제 정산은 원가가 아니라 판매가 기준으로 떼인다). */
  platformFeeRate: PriceComponent;
  currentSellingPriceKrw: PriceComponent;
  domesticCompetitivePrice?: { lowest?: number | null; average?: number | null };
}

export type DataCompleteness = "COMPLETE" | "ESTIMATED" | "INCOMPLETE";

export interface UnifiedPriceDecision {
  /** 현재 "확인 가능한" 원가만 더한 값이다 — unknown 항목은 0으로 채워
   * 넣지 않고 missingComponents에 그 사실을 남긴다(대표님 명시: "예상
   * 원가 = 148000만 반환하는 계약은 만들지 않는다"). */
  landedCostKrw: { value: number; status: "actual" | "estimated" | "incomplete" };
  platformFeeKrw: { value: number | null; status: "actual" | "estimated" };
  estimatedProfitKrw: { value: number | null; status: "estimated" | "incomplete" };
  marginPercent: { value: number | null; status: "estimated" | "incomplete" };
  /** 기존 computePriceDecision()을 그대로 호출해서 얻은 값 — 이름/의미
   * 전혀 변경 없음. 판매가가 아직 없으면(currentSellingPriceKrw.value===null)
   * 계산 자체가 불가능하므로 null. */
  verdict: PriceDecisionVerdict | null;
  level: PriceLevel;
  /** verdict/level(가격 판단)과 완전히 분리된 별도 축 — "판단이 얼마나
   * 신뢰할 수 있는 데이터로 내려졌는가"만 나타낸다(대표님 명시: "MARGIN_RISK
   * vs SHIPPING_UNKNOWN처럼 서로 다른 차원의 개념을 하나의 enum으로 합치지
   * 않는다"). */
  dataCompleteness: DataCompleteness;
  /** 원가 합산에서 제외된 항목의 한글 라벨 목록(예: ["국내 배송원가", "관부가세"]). */
  missingComponents: string[];
  /** STEP 8 — 원가 계산에 전혀 관여하지 않은 정보용 값을 그대로 통과시킨다. */
  customerChargedShippingKrw: PriceComponent;
}

const LANDED_COST_PARTS: { key: keyof UnifiedPriceInput; label: string }[] = [
  { key: "sourceProductPriceKrw", label: "해외 상품가(환산)" },
  { key: "internationalShippingKrw", label: "국제배송비" },
  { key: "sellerDomesticShippingCostKrw", label: "국내 배송원가" },
  { key: "customsDutyKrw", label: "관세" },
  { key: "customsVatKrw", label: "부가세" },
];

export function computeUnifiedPriceDecision(input: UnifiedPriceInput): UnifiedPriceDecision {
  let landedCostValue = 0;
  let hasUnknownCost = false;
  let hasEstimatedCost = false;
  const missingComponents: string[] = [];

  for (const part of LANDED_COST_PARTS) {
    const component = input[part.key] as PriceComponent;
    if (component.status === "unknown" || component.value == null) {
      hasUnknownCost = true;
      missingComponents.push(part.label);
      continue;
    }
    landedCostValue += component.value;
    if (component.status === "estimated") hasEstimatedCost = true;
  }
  const landedCostStatus: "actual" | "estimated" | "incomplete" = hasUnknownCost
    ? "incomplete"
    : hasEstimatedCost
      ? "estimated"
      : "actual";

  const sellingPriceValue = input.currentSellingPriceKrw.value;
  const feeRateValue = input.platformFeeRate.value;
  const platformFeeValue =
    sellingPriceValue != null && feeRateValue != null ? Math.round((sellingPriceValue * feeRateValue) / 100) : null;
  const platformFeeStatus: "actual" | "estimated" = input.platformFeeRate.status === "actual" ? "actual" : "estimated";

  let estimatedProfitValue: number | null = null;
  let marginPercentValue: number | null = null;
  if (sellingPriceValue != null && platformFeeValue != null) {
    estimatedProfitValue = sellingPriceValue - landedCostValue - platformFeeValue;
    marginPercentValue = Number(((estimatedProfitValue / sellingPriceValue) * 100).toFixed(1));
  }
  // "unknown 비용은 계산값을 조작하지 않고 incomplete 상태로 남긴다"(STEP 6) —
  // 값 자체는 알 수 있는 항목만으로 계산해서 보여주되(0원 취급이 아니라
  // "최소 확인 가능한" 값), status로 "이 숫자는 아직 불완전하다"는 사실을
  // 함께 전달한다.
  const profitStatus: "estimated" | "incomplete" = hasUnknownCost ? "incomplete" : "estimated";

  let verdict: PriceDecisionVerdict | null = null;
  let level: PriceLevel = "UNKNOWN";
  if (sellingPriceValue != null) {
    // STEP 6 목표 공식 그대로: marginPercent = (판매가 - 원가 - 수수료) / 판매가.
    // computePriceDecision()의 marginPercent = (판매가-costPriceKrw)/판매가이므로,
    // costPriceKrw에 "알려진 원가 + 수수료"를 합쳐서 넘기면 기존 함수를 한 글자도
    // 바꾸지 않고 이 공식을 그대로 재현할 수 있다.
    const decision = computePriceDecision({
      costPriceKrw: landedCostValue + (platformFeeValue ?? 0),
      currentSellingPriceKrw: sellingPriceValue,
      domesticAveragePriceKrw: input.domesticCompetitivePrice?.average ?? null,
      domesticLowestPriceKrw: input.domesticCompetitivePrice?.lowest ?? null,
    });
    verdict = decision.verdict;
    level = priceLevelFromVerdict(decision.verdict);
  }

  const dataCompleteness: DataCompleteness = hasUnknownCost
    ? "INCOMPLETE"
    : hasEstimatedCost || platformFeeStatus === "estimated"
      ? "ESTIMATED"
      : "COMPLETE";

  return {
    landedCostKrw: { value: landedCostValue, status: landedCostStatus },
    platformFeeKrw: { value: platformFeeValue, status: platformFeeStatus },
    estimatedProfitKrw: { value: estimatedProfitValue, status: profitStatus },
    marginPercent: { value: marginPercentValue, status: profitStatus },
    verdict,
    level,
    dataCompleteness,
    missingComponents,
    customerChargedShippingKrw: input.customerChargedShippingKrw,
  };
}

/**
 * P-2-3(대표님 지시, 2026-08-28) — "셀러가 10초 안에 알아야 하는 것"을 5개
 * 상태로 압축한다. verdict/level 이름은 절대 바꾸지 않고(computePriceDecision
 * 결과 그대로), 그 위에 dataCompleteness를 우선순위 필터로만 얹는다.
 *
 * 핵심 원칙(대표님 명시) — "dataCompleteness 때문에 기존 RED/YELLOW를
 * 덮어쓰지 않는다." RED/YELLOW는 그 자체로 이미 "위험/조정 필요" 신호라 그대로
 * 신뢰하고, MAINTAIN(GREEN)만 INCOMPLETE 여부로 재검토한다 — INCOMPLETE는
 * 항상 낙관적 방향으로만 왜곡되기 때문이다(모르는 비용은 원가에서 빠지므로
 * 마진이 실제보다 높게 계산된다. 반대로 이미 RED/YELLOW로 나온 판정은 실제
 * 비용을 더 반영해도 나빠지면 나빠졌지 좋아질 수 없다). */
export type SellerDecisionStateCode = "READY" | "ADJUST" | "NEEDS_COST_INFO" | "NOT_RECOMMENDED" | "UNKNOWN";

export interface SellerDecisionState {
  code: SellerDecisionStateCode;
  icon: "🟢" | "🟡" | "🟠" | "🔴" | "⚪";
  title: string;
}

export function sellerDecisionStateFromUnifiedDecision(
  decision: Pick<UnifiedPriceDecision, "verdict" | "dataCompleteness"> | null,
): SellerDecisionState {
  if (!decision || decision.verdict == null) {
    return { code: "UNKNOWN", icon: "⚪", title: "판단 불가" };
  }
  if (decision.verdict === "MARGIN_RISK") {
    return { code: "NOT_RECOMMENDED", icon: "🔴", title: "판매 비추천" };
  }
  if (decision.verdict === "CONSIDER_LOWER") {
    return { code: "ADJUST", icon: "🟡", title: "가격 조정 필요" };
  }
  // verdict === "MAINTAIN"
  if (decision.dataCompleteness === "INCOMPLETE") {
    return { code: "NEEDS_COST_INFO", icon: "🟠", title: "비용 확인 필요" };
  }
  return { code: "READY", icon: "🟢", title: "바로 판매 가능" };
}
