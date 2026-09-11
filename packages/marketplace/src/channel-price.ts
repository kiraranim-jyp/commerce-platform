import type { CanonicalProduct, FieldSource, PlatformId, ProvenanceField } from "@commerce/shared";
import { resolveListingPrice, type ListingPriceResolution } from "@commerce/pricing";
import type { ListingPricingContext } from "./types";

/**
 * PHASE 3.2(CPO 확정, 2026-09-11) — "채널별 최종 등록가격"의 유일한 해석 지점.
 *
 * 모델:
 *   [설정]     기본 마진/수수료
 *   [상품정보]  가격 계산 → 최종 판매가격          ← 상품의 기준가
 *   [각 커머스] 기본값 = 상품정보 가격, [수정] → 이 채널만의 최종 등록가격
 *   [등록]     이 함수의 결과 → ListingModel.priceKrw → 기존 payload builder
 *
 * 해석 순서(그 이상도 이하도 아니다):
 *   채널 최종가 있으면 → 채널 최종가
 *   없으면            → 상품정보 최종 판매가격(priceOverrideKrw)
 *   없으면            → 권장 판매가격(suggestedPriceKrw)
 *
 * "전역 override"라는 개념은 만들지 않는다 — 채널 값은 그 채널 하나에만 적용된다.
 *
 * resolveListingPrice()의 의미는 한 글자도 바꾸지 않았다. 그 함수는 여전히
 * "상품의 기준가가 무엇인가"를 계산하고, 채널 최종가는 그 함수의
 * priceOverrideKrw 입력으로 들어갈 뿐이다. 그래서 쿠팡 10원 단위/반품비 검증,
 * priceValidity 게이트, "판매가격" 준비항목이 채널 최종가에도 그대로 적용된다 —
 * 전부 "해석이 끝난 값"을 보기 때문이다(새 검증 경로를 만들지 않았다).
 *
 * 어댑터 세 개(coupang/smartstore/elevenst)가 각자 계산하지 않고 이 함수 하나를
 * 부른다 — P-4-H1-2-2에서 확인된 "어댑터별 자체 계산"이 바로 Voyage Dress
 * 오등록(₩153,120)의 원인이었다.
 */
export type ChannelPriceOrigin =
  /** 이 채널에만 지정된 최종 등록가격을 쓴다. */
  | "CHANNEL_OVERRIDE"
  /** 상품정보에서 셀러가 확정한 최종 판매가격(priceOverrideKrw)을 쓴다. */
  | "PRODUCT_OVERRIDE"
  /** 셀러 확정값이 아직 없어 권장 판매가격(마진 역산)을 쓴다. */
  | "PRODUCT_SUGGESTED"
  /** 원본 가격 자체를 못 읽어 등록가를 계산할 수 없다. */
  | "UNRESOLVED";

export interface ChannelPriceResolution extends ListingPriceResolution {
  origin: ChannelPriceOrigin;
  /** 이 채널에 지정된 최종 등록가격(없으면 null) — 화면이 "수정됨/기본값"을
   * 구분하는 근거다. priceKrw와 따로 두는 이유: 채널 최종가가 상품정보 가격과
   * 우연히 같은 금액일 수도 있어서, 금액 비교로는 둘을 구분할 수 없다. */
  channelOverrideKrw: number | null;
}

/** 이 채널에 지정된 최종 등록가격. 없으면 null(= 상품정보 가격을 그대로 쓴다). */
export function getChannelPriceOverrideKrw(product: CanonicalProduct, platform: PlatformId): number | null {
  return product.channelPriceOverrides?.[platform]?.value ?? null;
}

export function resolveChannelListingPrice(
  product: CanonicalProduct,
  platform: PlatformId,
  pricingContext?: ListingPricingContext,
): ChannelPriceResolution {
  const channelOverrideKrw = getChannelPriceOverrideKrw(product, platform);
  const resolution = resolveListingPrice(
    {
      // 채널 최종가가 있으면 그것이 이 채널의 확정값이고, 없으면 상품정보의
      // 최종 판매가격이 확정값이다. 두 값을 더하거나 섞지 않는다 — 하나가
      // 다른 하나를 **대체**한다.
      priceOverrideKrw: channelOverrideKrw ?? product.priceOverrideKrw?.value,
      originalAmount: product.price.value.amount,
      originalCurrency: product.price.value.currency,
      priceBreakdown: product.priceBreakdown,
      priceValidity: product.priceValidity,
    },
    pricingContext?.liveRates,
    pricingContext?.roundingUnit,
  );

  return { ...resolution, channelOverrideKrw, origin: toOrigin(channelOverrideKrw, resolution) };
}

/** 감사 기록("가격 출처")과 화면 문구가 같은 판정을 쓰게 하는 매핑. 여기서 새
 * 판정을 만들지 않는다 — 이미 정해진 두 사실(채널 최종가가 있었는가 /
 * resolveListingPrice가 무엇을 골랐는가)을 한 단어로 합칠 뿐이다. */
function toOrigin(channelOverrideKrw: number | null, resolution: ListingPriceResolution): ChannelPriceOrigin {
  if (resolution.source === "UNRESOLVED") return "UNRESOLVED";
  if (channelOverrideKrw != null) return "CHANNEL_OVERRIDE";
  return resolution.source === "SELLER_OVERRIDE" ? "PRODUCT_OVERRIDE" : "PRODUCT_SUGGESTED";
}

/** 감사 로그/화면에 그대로 쓰는 한국어 라벨 — 같은 개념에 두 가지 이름이 생기지
 * 않도록 여기 한 곳에만 둔다. */
export const CHANNEL_PRICE_ORIGIN_LABEL: Record<ChannelPriceOrigin, string> = {
  CHANNEL_OVERRIDE: "채널 최종 등록가격",
  PRODUCT_OVERRIDE: "상품정보 최종 판매가격",
  PRODUCT_SUGGESTED: "권장 판매가격",
  UNRESOLVED: "미확정",
};

/**
 * 채널 최종가를 지정한다(순수 함수 — 여기서 어떤 API도 부르지 않는다).
 *
 * 절대 건드리지 않는 것: priceOverrideKrw, price, priceBreakdown, priceValidity.
 * 채널 가격을 고쳤다고 상품의 기준가가 따라 움직이면 셀러는 상품정보로 돌아갔을
 * 때 자기가 정한 적 없는 숫자를 보게 된다 — 이 함수가 그 경계다.
 *
 * MI(시장 판단)도 여기서 다시 돌지 않는다. MI는 "이 상품을 팔 만한가"를 답하고,
 * 채널 최종가는 "이 채널에 얼마로 등록할 것인가"를 답한다 — 서로 다른 질문이라
 * 의도적으로 연결하지 않는다. MI가 읽는 입력(price/priceOverrideKrw/
 * priceBreakdown)이 그대로이므로 재판정할 근거 자체가 생기지 않는다.
 */
export function applyChannelPriceOverride(
  product: CanonicalProduct,
  platform: PlatformId,
  amountKrw: number,
  source: FieldSource = "USER_EDITED",
): CanonicalProduct {
  const field: ProvenanceField<number> = { value: amountKrw, source, confidence: 1 };
  return {
    ...product,
    channelPriceOverrides: { ...(product.channelPriceOverrides ?? {}), [platform]: field },
  };
}

/** 채널 최종가를 지우고 상품정보 가격으로 되돌린다 — 0을 저장하지 않는다
 * (0원 등록과 "지정하지 않음"은 완전히 다른 상태다). */
export function clearChannelPriceOverride(product: CanonicalProduct, platform: PlatformId): CanonicalProduct {
  const next = { ...(product.channelPriceOverrides ?? {}) };
  delete next[platform];
  return { ...product, channelPriceOverrides: next };
}
