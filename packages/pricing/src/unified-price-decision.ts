import {
  computePriceDecision,
  priceLevelFromVerdict,
  type DomesticPriceBasis,
  type PriceDecisionVerdict,
  type PriceLevel,
} from "./price-decision";
import { resolveCategoryCostPolicy, type CategoryCostPolicy } from "./category-cost-policy";
import type { PriceTaxBasis } from "./price-basis";
import type { ShippingBasis, ShippingMethod } from "./shipping-basis";

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
 * 수수료까지 포함한 진짜 원가로 만들어주는 것"뿐이다(관세/부가세는
 * MI-COST-POLICY-1에서 빠졌다 — 구매자 부담이라 판매자 원가가 아니다). MAINTAIN/
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
  /**
   * P0-C STEP 5(CEO 지시, 2026-09-20) — 바로 위 금액이 «왜 그 값인가».
   *
   * 🔴 계산에 관여하지 않는다. 값과 나란히 실려 landedCostKrw 로 그대로 나간다.
   *    넘기지 않으면 UNKNOWN 이다 — 이 엔진이 배송방법이나 근거를 «추정하지
   *    않는다»는 뜻이고, 그것이 CEO 가 금지한 것이다.
   */
  shippingBasis?: ShippingBasis;
  shippingMethod?: ShippingMethod;
  /**
   * MI-UX-FINAL-4(대표님 결정, 2026-09-13) — **원가 합산에 참여하지 않는다.**
   *
   * 이 값은 P-3-2에서 LANDED_COST_PARTS에 들어갔고, 그 뒤로 착지원가 → 예상이익
   * → 마진 → verdict까지 그대로 흘렀다. 지난 두 번의 지시에서는 STOP이었다 —
   * 계산에 들어가는 값을 화면에서만 지우면 화면이 거짓말을 하기 때문이다.
   *
   * 이번에 대표님이 제거를 결정했다. 그래서 8ac100d(관부가세)가 세운 순서를
   * 그대로 따른다: **엔진에서 먼저 빼고**, 그 결과로 셀러에게 보여줄 이유가
   * 사라진 화면 블록(판매자 부담 비용)을 없앤다. 반대 순서로 하면 셀러가 보지도
   * 고치지도 못하는 값이 계속 마진을 깎는다.
   *
   * 필드를 지우지 않고 optional로 남기는 이유도 그때와 같다: 아직 이 값을 넘기는
   * 호출부가 생기더라도 결과가 달라지지 않는다는 사실을 타입과 테스트로 못 박기
   * 위해서다. Settings의 판매자 공통 기본값(seller_profiles.domestic_shipping_cost_krw)과
   * 이미 저장된 값은 건드리지 않는다 — 읽는 코드가 한 줄도 없을 뿐이다.
   *
   * @deprecated 판매 판단 계산에 들어가지 않는다. 읽지 않는다.
   */
  sellerDomesticShippingCostKrw?: PriceComponent;
  /** 고객에게 청구하는 배송비(SellerProfile.deliveryCharge와 연결 가능).
   * 원가 합산에 자동으로 더하지 않는다(STEP 8) — 판매 구조(배송비를 매출로
   * 잡고 배송원가를 비용으로 잡는 모델)가 아직 이 시스템에 없기 때문이다.
   * UnifiedPriceDecision에 그대로 통과시켜 화면에서 참고용으로만 보여준다. */
  customerChargedShippingKrw: PriceComponent;
  /**
   * GOLF-01 축B(CEO 지시, 2026-09-15) — 이 상품의 카테고리(CATEGORY_PROFILES의 id).
   *
   * **넘기지 않으면 오늘까지와 완전히 같게 동작한다**(DEFAULT 정책 = MI-COST-POLICY-1
   * + MI-UX-FINAL-4 상태 그대로). 기존 호출부를 한 곳도 고치지 않아도 숫자가
   * 움직이지 않는다는 뜻이고, 그것이 이 필드를 optional로 둔 이유다.
   *
   * 값이 "GOLF"일 때만 아래 customsDutyKrw/customsVatKrw가 **읽힌다**.
   * 아동의류(KIDS_FASHION)는 명시적으로 넘겨도 DEFAULT와 같은 정책이라
   * 관부가세가 원가에 오르지 않는다 — 카테고리별 분기가 아동의류를 건드릴 수
   * 있는 경로가 구조적으로 없다(category-cost-policy.ts 참고).
   */
  categoryProfileId?: string | null;
  /**
   * MI-COST-POLICY-1(대표님 결정, 2026-09-12) — **원가 합산에 참여하지 않는다.**
   *
   * "관세·부가세는 구매자 부담이며 판매자 가격/수익성 계산에 포함하지 않는다."
   * 해외직구 통관세는 수입자(=구매자) 명의로 부과되는 돈이라 판매자의 손익에
   * 들어가는 비용이 아니다. 그런데 P-3-2에서는 이 둘을 LANDED_COST_PARTS에
   * 넣어 착지원가에서 빼고 있었고, 그 결과 예상이익/마진/verdict가 판매자가
   * 실제로 치르지 않는 돈만큼 나쁘게 계산됐다. 이제 합산에서 완전히 뺀다 —
   * 화면에서만 감추면 화면이 거짓말을 하게 되므로 계산 경로 자체에서 뺀다.
   *
   * 필드를 지우지 않고 optional로 남기는 이유: 이 값을 아직 넘기는 호출부가
   * 생기더라도 결과가 달라지지 않는다는 사실을 타입과 테스트로 못 박기 위해서다
   * (읽는 코드가 한 줄도 없다 — 넘겨도 무시된다).
   *
   * ── GOLF-01-TAX(CEO 최종 결정, 2026-09-15) — 조건부 예외도 없어졌다 ────────
   * d72575f가 잠시 이 필드를 "GOLF 카테고리에서만 읽히는 값"으로 되살렸다.
   * CEO가 그 방향을 거뒀다: 관세·부가가치세는 **어떤 카테고리에서도** 판매자
   * 원가에 들어가지 않고, 별도의 «예상 구매자 부담»으로만 표시된다
   * (packages/pricing/src/buyer-import-charge.ts).
   *
   * 그래서 이 두 필드를 읽는 코드는 다시 **한 줄도 없다.** 아래
   * LANDED_COST_PARTS에 관세/부가세 자리가 없고, 그 배열이 정책에 따라 갈리지도
   * 않는다 — 넘길 수는 있지만 결과가 달라질 경로 자체가 사라졌다.
   *
   * @deprecated 판매자 원가가 아니다. 읽지 않는다.
   */
  customsDutyKrw?: PriceComponent;
  /** @deprecated 구매자 부담. customsDutyKrw와 같은 이유로 읽지 않는다. */
  customsVatKrw?: PriceComponent;
  /** 플랫폼 수수료율(%). 현재 판매가 기준으로 곱한다(computeLandedCost와
   * 동일한 이유 — 실제 정산은 원가가 아니라 판매가 기준으로 떼인다). */
  platformFeeRate: PriceComponent;
  currentSellingPriceKrw: PriceComponent;
  /**
   * 🔴 P0-D.2 — `basis` 가 이 숫자의 «의미» 다. EXACT 가 아니면 판정에 쓰이지
   *    않는다(제외될 뿐 0 이 되지 않는다). 넘기지 않으면 예전과 같게 동작한다.
   */
  domesticCompetitivePrice?: { lowest?: number | null; average?: number | null; basis?: DomesticPriceBasis };
}

export type DataCompleteness = "COMPLETE" | "ESTIMATED" | "INCOMPLETE";

export interface UnifiedPriceDecision {
  /** 현재 "확인 가능한" 원가만 더한 값이다 — unknown 항목은 0으로 채워
   * 넣지 않고 missingComponents에 그 사실을 남긴다(대표님 명시: "예상
   * 원가 = 148000만 반환하는 계약은 만들지 않는다"). */
  /**
   * 🔴 P0-C STEP 3 — `value` 가 **null 일 수 있다.** 원가 항 중 하나라도
   * 모르면(status="incomplete") 합계를 내지 않는다. 화면은 이 null 을 받아
   * 숫자 대신 「확인 필요」를 그린다 — 부분합에 «실구매원가» 라는 이름을
   * 붙이지 않기 위해서다.
   */
  landedCostKrw: {
    value: number | null;
    status: "actual" | "estimated" | "incomplete";
    /**
     * P0-C STEP 5(CEO 지시, 2026-09-20) — **원가가 숫자 하나가 아니라 «근거를 가진
     * 결과» 가 되게 하는 칸.** 「왜 이 상품 배송비가 이 값이야?」라는 질문에
     * 시스템이 스스로 답할 수 있어야 한다.
     *
     * 🔴 계산에는 관여하지 않는다 — 값은 그대로이고 근거만 함께 실린다.
     *    호출부가 넘기지 않으면 UNKNOWN 이다(추정하지 않는다).
     */
    shippingBasis: ShippingBasis;
    shippingMethod: ShippingMethod;
  };
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
  /** 원가 합산에서 제외된 항목의 한글 라벨 목록(예: ["국내 배송원가"]).
   * MI-COST-POLICY-1 이후 여기에 "관세"/"부가세"가 들어갈 경로는 없다 —
   * 판매자 원가가 아닌 값을 "아직 모른다"고 셀러에게 요구하지 않는다. */
  missingComponents: string[];
  /** STEP 8 — 원가 계산에 전혀 관여하지 않은 정보용 값을 그대로 통과시킨다. */
  customerChargedShippingKrw: PriceComponent;
  /**
   * GOLF-01 축B — 이 판단이 **어느 비용 정책으로** 내려졌는가. 화면이 "관세를
   * 왜 세지 않았는지"(또는 왜 세는지)를 셀러에게 말할 수 있는 유일한 근거다.
   * 정책을 숨기면 같은 화면이 상품에 따라 다른 원가를 말하면서 이유를 대지
   * 못한다.
   */
  costPolicy: {
    id: CategoryCostPolicy["id"];
    label: string;
    /**
     * 🔴 GOLF-01-TAX 이후 **언제나 false다.** 타입이 `false` 리터럴인 것이
     * 그 사실이다 — 정책에서 읽어 오는 값이 아니라 이 엔진이 관세·부가세를
     * 원가로 세는 경로를 갖고 있지 않다는 **엔진 자신의 사실**이다.
     *
     * 값이 하나로 굳었는데도 필드를 남긴 이유: MI-COST-POLICY-1이 세운 검사들이
     * 이 값을 보고 있고, 이제 그 검사들은 아동의류뿐 아니라 **모든 카테고리에서**
     * 참이 된다. 필드를 지우면 그 검사가 사라지고, 검사가 사라지면 다음 사람이
     * 다시 원가에 넣는다.
     */
    importTaxesInLandedCost: false;
    note: string;
  };
  /**
   * PRICING-BASIS-1 — 위 landedCostKrw가 **어느 세금 기준의 값인가**.
   * 국내 시장가(언제나 TAX_INCLUDED)와 나란히 놓아도 되는지가 이 값으로 정해진다
   * (price-basis.comparePriceBasis). 화면이 두 숫자를 그냥 빼지 못하게 하는 장치다.
   */
  landedCostTaxBasis: PriceTaxBasis;
}

/**
 * 착지원가의 정의. 이 배열이 곧 그 정의이고, 그 착지원가가 예상이익 → 마진 →
 * verdict까지 그대로 흐르므로, 여기서 빼는 것 하나로 계산 경로 전체에서 사라진다.
 * missingComponents/dataCompleteness도 같은 배열을 돌기 때문에 "그 값을 몰라서
 * INCOMPLETE"라는 판정 역시 함께 불가능해진다.
 *
 * MI-COST-POLICY-1(대표님 결정, 2026-09-12) — 관세/부가세 두 줄을 뺐다.
 * 구매자가 통관 때 따로 내는 돈이라 판매자 손익에 들어갈 자리가 없다.
 *
 * MI-UX-FINAL-4(대표님 결정, 2026-09-13) — 국내 배송원가 한 줄을 더 뺐다.
 * 같은 순서를 따른다: 엔진에서 먼저 빼고, 그 결과로 물어볼 이유가 사라진 화면
 * 블록을 없앤다. 숫자가 움직인다는 것은 의도다 — 착지원가가 그 금액만큼 낮아지고
 * 예상이익·마진이 그만큼 올라간다. 지금까지의 판정이 셀러가 실제로 치르는지
 * 확인된 적 없는 비용을 원가로 세고 있었다는 뜻이기도 하다(이 값은 Settings의
 * 판매자 공통 기본값이라 상품별 실비가 아니었다).
 *
 * 남은 두 줄은 상품마다 실제로 확인되는 값이다 — 원본 판매가와 국제배송비.
 *
 * 🔴 GOLF-01-TAX(CEO 최종 결정, 2026-09-15) — 이 배열은 **카테고리별로 갈리지
 * 않는다.** d72575f가 골프 정책에 한해 관세·부가세 두 줄을 뒤에 붙이던 분기를
 * 통째로 걷어냈다. 함수도 조건문도 남기지 않은 이유는, 남겨 두면 그것이 곧
 * "여기에 세금을 붙이는 방법"의 설명서가 되기 때문이다. 상수 하나가 곧 정의다.
 */
const LANDED_COST_PARTS: { key: keyof UnifiedPriceInput; label: string }[] = [
  { key: "sourceProductPriceKrw", label: "해외 상품가(환산)" },
  { key: "internationalShippingKrw", label: "국제배송비" },
];

export function computeUnifiedPriceDecision(input: UnifiedPriceInput): UnifiedPriceDecision {
  const costPolicy = resolveCategoryCostPolicy(input.categoryProfileId);
  let landedCostValue = 0;
  let hasUnknownCost = false;
  let hasEstimatedCost = false;
  const missingComponents: string[] = [];

  for (const part of LANDED_COST_PARTS) {
    const component = input[part.key] as PriceComponent | undefined;
    if (component == null || component.status === "unknown" || component.value == null) {
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
  /**
   * 🔴 P0-C STEP 3(CEO 승인, 2026-09-20) — **원가가 확정되지 않으면 마진도 없다.**
   *
   * ── 여기 있던 규칙과 그것이 틀린 이유 ──────────────────────────────────────
   * 예전 주석은 이랬다:
   *
   *   > 값 자체는 알 수 있는 항목만으로 계산해서 보여주되(0원 취급이 아니라
   *   > "최소 확인 가능한" 값), status로 "이 숫자는 아직 불완전하다"는 사실을
   *   > 함께 전달한다.
   *
   * 의도는 옳았지만 산술이 그 의도를 배신한다. 위 루프는 unknown 항을 합계에서
   * «빼는데», **항을 빼는 것은 0 을 더하는 것과 수치적으로 같다.** 그래서
   * landedCost 가 실제보다 작아지고, 마진은 실제보다 **높게** 나왔다. 판매자가
   * 보는 숫자는 「최소 확인 가능한 마진」이 아니라 **「최대 가능 마진」** 이었다 —
   * 보수적인 쪽이 아니라 낙관적인 쪽으로 틀린다.
   *
   * CEO 지시(P0-C STEP 3): 「배송비 UNKNOWN → 실구매원가 확정 불가 → 마진/권장가를
   * 확정값으로 표시하지 않는다」. 그래서 이제 «숫자를 만들지 않는다».
   * 라벨로 경고하는 대신 값을 null 로 둔다 — 라벨은 읽히지 않을 수 있지만
   * null 은 화면이 숫자를 그릴 방법이 아예 없다.
   *
   * 🔴 missingComponents 는 그대로 채워진다. 「무엇을 몰라서 못 셌는지」는
   *    여전히 말할 수 있어야 한다(모른다는 것과 침묵은 다르다).
   */
  if (sellingPriceValue != null && platformFeeValue != null && !hasUnknownCost) {
    estimatedProfitValue = sellingPriceValue - landedCostValue - platformFeeValue;
    marginPercentValue = Number(((estimatedProfitValue / sellingPriceValue) * 100).toFixed(1));
  }
  const profitStatus: "estimated" | "incomplete" = hasUnknownCost ? "incomplete" : "estimated";

  let verdict: PriceDecisionVerdict | null = null;
  let level: PriceLevel = "UNKNOWN";
  /**
   * 🔴 P0-C STEP 3 — 판정도 «만들지 않는다».
   *
   * verdict 는 바로 위에서 null 로 남긴 그 마진과 «같은 숫자» 에서 나온다
   * (costPriceKrw = 알려진 원가 + 수수료). 마진은 감추면서 판정만 내보내면,
   * 판매자는 근거 없는 GREEN 을 보고 등록한다 — 그것이 이 저장소가 존재하는
   * 이유의 정반대다. 「모를 때는 판단하지 않는다」가 TTAEJYO 의 규칙이다.
   */
  if (sellingPriceValue != null && !hasUnknownCost) {
    // STEP 6 목표 공식 그대로: marginPercent = (판매가 - 원가 - 수수료) / 판매가.
    // computePriceDecision()의 marginPercent = (판매가-costPriceKrw)/판매가이므로,
    // costPriceKrw에 "알려진 원가 + 수수료"를 합쳐서 넘기면 기존 함수를 한 글자도
    // 바꾸지 않고 이 공식을 그대로 재현할 수 있다.
    const decision = computePriceDecision({
      costPriceKrw: landedCostValue + (platformFeeValue ?? 0),
      currentSellingPriceKrw: sellingPriceValue,
      domesticAveragePriceKrw: input.domesticCompetitivePrice?.average ?? null,
      domesticLowestPriceKrw: input.domesticCompetitivePrice?.lowest ?? null,
      // 🔴 P0-D.2 — 국내가격의 «출처» 를 판정까지 그대로 들고 간다. 넘기지
      //    않으면 예전과 같게 동작한다(price-decision.ts 의 undefined 규칙).
      domesticBasis: input.domesticCompetitivePrice?.basis,
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
    // 🔴 P0-C STEP 3 — 항이 하나라도 비면 «합계» 를 말하지 않는다. 예전에는
    //    알려진 항만 더한 부분합을 status="incomplete" 와 함께 내보냈는데, 그
    //    숫자는 화면에서 「실구매원가」라는 이름을 달고 그려진다. 부분합에
    //    이름을 붙이는 순간 그것은 원가가 아니라 «원가처럼 보이는 것» 이다.
    //    무엇이 빠졌는지는 missingComponents 가 그대로 말한다.
    landedCostKrw: {
      value: hasUnknownCost ? null : landedCostValue,
      status: landedCostStatus,
      // 🔴 근거는 «받아 적는다». 여기서 판정하지 않는다(추정 금지).
      shippingBasis: input.shippingBasis ?? "UNKNOWN",
      shippingMethod: input.shippingMethod ?? "UNKNOWN",
    },
    platformFeeKrw: { value: platformFeeValue, status: platformFeeStatus },
    estimatedProfitKrw: { value: estimatedProfitValue, status: profitStatus },
    marginPercent: { value: marginPercentValue, status: profitStatus },
    verdict,
    level,
    dataCompleteness,
    missingComponents,
    customerChargedShippingKrw: input.customerChargedShippingKrw,
    costPolicy: {
      id: costPolicy.id,
      label: costPolicy.label,
      // 정책에서 읽어 오지 않는다 — 위 LANDED_COST_PARTS에 세금 자리가 없다는
      // 사실을 그대로 적는다. 정책이 무엇으로 바뀌어도 이 값은 false다.
      importTaxesInLandedCost: false,
      note: costPolicy.policyNote,
    },
    landedCostTaxBasis: costPolicy.landedCostTaxBasis,
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
