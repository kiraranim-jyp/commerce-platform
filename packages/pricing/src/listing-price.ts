import { computePriceBreakdown, DEFAULT_PRICE_BREAKDOWN_INPUT, DEFAULT_PRICE_ROUNDING_UNIT, type PriceBreakdownInput } from "./breakdown";

/**
 * P-4-H1-2-2(대표님 지시, 2026-08-28) — 실제 등록가(쿠팡/스마트스토어 어댑터가
 * 각자 계산하던 "priceOverrideKrw ?? 마진 0% 원본 환산가" 폴백)와 화면에 보이는
 * "권장 판매가격"(PriceEditor의 computePriceBreakdown)이 서로 다른 공식이었다 —
 * override가 없는 상품은 화면에 안 보이는 마진 0%짜리 가격으로 조용히 등록됐다
 * (실제 확인된 사례: Voyage Dress ₩153,120 원본환산가로 실등록됨, 정상 계산
 * 시 ₩211,690이어야 함). 이 함수 하나가 이제 "등록에 쓸 판매가가 무엇인가"의
 * 유일한 판단 지점이다 — 쿠팡/스마트스토어 어댑터가 각자 계산하지 않고 이 함수를
 * 그대로 호출한다(computePriceBreakdown/computeUnifiedPriceDecision 등 기존
 * 가격 엔진은 건드리지 않고 재사용만 한다).
 */
export type ListingPriceSource = "SELLER_OVERRIDE" | "SYSTEM_SUGGESTED" | "UNRESOLVED";

export interface ListingPriceResolution {
  priceKrw: number | null;
  source: ListingPriceSource;
  isEstimate: boolean;
  reason?: string;
}

export interface ListingPriceInput {
  /** product.priceOverrideKrw?.value — 있으면 항상 최우선(SELLER_OVERRIDE). */
  priceOverrideKrw: number | null | undefined;
  originalAmount: number;
  originalCurrency: string;
  /** product.priceBreakdown — 없으면 packages/pricing 전역 기본값(DEFAULT_PRICE_BREAKDOWN_INPUT)을 쓴다
   * (PriceEditor가 사용자가 아직 아무것도 저장하지 않았을 때 쓰는 것과 동일한 기본값). */
  priceBreakdown?:
    | (Pick<PriceBreakdownInput, "feePercent" | "marginPercent"> & {
        /** 🔴 P0-C STEP 3 — null 은 「해외물류비를 모른다」다. 0(무료 확인)과 다르다. */
        shippingKrw: number | null;
      })
    | null;
  /** product.priceValidity — VALID가 아니면(원본 가격 자체를 못 읽음) 원본가 기반
   * 마진 계산을 아예 시도하지 않는다(원본이 없는데 계산하면 의미 없는 숫자가 나온다). */
  priceValidity: "VALID" | "MISSING" | "INVALID" | "UNRESOLVED";
}

/**
 * 우선순위: priceOverrideKrw(사용자 확정값) > computePriceBreakdown()의
 * suggestedPriceKrw(기존 PriceEditor가 이미 쓰는 마진 역산 공식, 새 공식 없음) >
 * UNRESOLVED(원본 가격을 원화로 환산해서 그대로 쓰는 것은 절대 안 함 — 이게 이번에
 * 고치는 버그의 원인이었다).
 *
 * liveRates/roundingUnit을 PriceEditor와 동일하게 넘기면(CommerceWorkspace.tsx가
 * 실제 등록 직전 호출부에서 그렇게 한다) 화면에 보인 숫자와 등록되는 숫자가
 * 정확히 같아진다 — 넘기지 않으면(서버 전용 read-only 경로 등) 고정 환율표/
 * 기본 반올림 단위(10원)로 폴백한다(기존 convertToKrw의 isEstimate 관례와 동일).
 */
export function resolveListingPrice(
  input: ListingPriceInput,
  liveRates?: Record<string, number>,
  roundingUnit: number = DEFAULT_PRICE_ROUNDING_UNIT,
): ListingPriceResolution {
  if (input.priceOverrideKrw != null) {
    return { priceKrw: input.priceOverrideKrw, source: "SELLER_OVERRIDE", isEstimate: false };
  }

  if (input.priceValidity !== "VALID") {
    return {
      priceKrw: null,
      source: "UNRESOLVED",
      isEstimate: true,
      reason: "원본 상품 가격을 확인할 수 없습니다.",
    };
  }

  const breakdownInput = input.priceBreakdown ?? DEFAULT_PRICE_BREAKDOWN_INPUT;
  /**
   * 🔴 P0-C STEP 3(CEO 승인, 2026-09-20) — **배송비를 모르면 등록가를 제안하지 않는다.**
   *
   * 판매자가 해외물류비 입력칸을 «비웠으면»(null) 원가를 셀 수 없고, 원가를
   * 셀 수 없으면 권장 판매가도 없다. 여기서 기본값을 다시 끼워 넣으면 판매자가
   * «지운» 값이 등록 직전에 되살아난다 — 그것도 아무도 보지 않는 자리에서.
   *
   * 🔴 이 경로가 특히 위험한 이유: 화면 계산기는 근거 라벨이라도 붙지만, 이
   *    함수는 등록가를 «사람이 보지 않는 채» 만든다(listing-price 는 등록 직전에
   *    불린다). 그래서 여기서 조용히 기본값을 쓰면 아무도 그 사실을 모른다.
   *
   * 기존 UNRESOLVED 의미를 그대로 쓴다 — 새 상태를 만들지 않는다.
   */
  if (breakdownInput.shippingKrw == null) {
    return {
      priceKrw: null,
      source: "UNRESOLVED",
      isEstimate: true,
      reason: "해외물류비가 확인되지 않아 판매가격을 계산할 수 없습니다.",
    };
  }
  const breakdown = computePriceBreakdown(
    {
      originalAmount: input.originalAmount,
      originalCurrency: input.originalCurrency,
      ...breakdownInput,
      shippingKrw: breakdownInput.shippingKrw,
    },
    liveRates,
    roundingUnit,
  );

  if (!(breakdown.suggestedPriceKrw > 0)) {
    return {
      priceKrw: null,
      source: "UNRESOLVED",
      isEstimate: true,
      reason: "권장 판매가격을 계산할 수 없습니다.",
    };
  }

  return { priceKrw: breakdown.suggestedPriceKrw, source: "SYSTEM_SUGGESTED", isEstimate: breakdown.isRateEstimate };
}
