import { CHANNEL_PRICE_ORIGIN_LABEL, type ChannelPriceOrigin, type ListingModel } from "@commerce/marketplace";
import type { CanonicalProduct, PlatformId } from "@commerce/shared";

/**
 * PHASE 3.2(CPO 확정, 2026-09-11) — 등록 감사 기록.
 *
 * 남겨야 하는 네 가지: 채널 · 최종 등록가격 · 가격 출처 · 등록 시점.
 *
 * 왜 기존 price_breakdown에 얹지 않았나: 그 컬럼의 뜻은 "등록 당시 상품
 * 가격 **계산** 결과"(원본가/환율 입력/배송비/수수료율/마진율)다. 여기에
 * 채널 최종가를 섞으면 지금까지 쌓인 모든 행의 의미가 소급해서 바뀐다 —
 * 과거 행에는 채널이라는 축이 아예 없었으므로 "채널 값이 없었다"인지
 * "그때는 이 개념이 없었다"인지 영원히 구분할 수 없게 된다. 그래서 새 구조를
 * 새 컬럼에 따로 기록하고, 과거 데이터는 한 줄도 건드리지 않는다(백필 없음).
 * 이 기록은 배포 시점 이후의 등록부터만 존재한다.
 */
export interface ChannelPriceAuditRecord {
  /** 어느 채널에 등록했는가. */
  platform: PlatformId;
  /** 실제로 이 채널의 등록 요청에 실려 나간 최종 판매가(KRW) — payload의
   * salePrice와 같은 값이다(둘 다 listing.priceKrw 하나에서 나온다). */
  finalPriceKrw: number;
  /** 그 값이 어디서 왔는가 — 채널 최종가 / 상품정보 최종 판매가격 / 권장 판매가격. */
  priceOrigin: ChannelPriceOrigin;
  /** 사람이 읽을 라벨. 코드가 사라져도 기록만으로 뜻이 통해야 한다(감사 기록은
   * 나중에 읽히는 게 목적이라 enum 값만 남기면 해석을 코드에 의존하게 된다). */
  priceOriginLabel: string;
  /** 등록 시점(ISO 8601). registration_attempts.created_at과 별개로 남긴다 —
   * 이 기록은 "이 가격이 이 시각에 이 채널로 나갔다"는 하나의 완결된 사실이다. */
  registeredAt: string;
}

export function buildChannelPriceAuditRecord(
  listing: ListingModel,
  registeredAt: string = new Date().toISOString(),
): ChannelPriceAuditRecord {
  return {
    platform: listing.platform,
    finalPriceKrw: listing.priceKrw,
    priceOrigin: listing.priceOrigin,
    priceOriginLabel: CHANNEL_PRICE_ORIGIN_LABEL[listing.priceOrigin],
    registeredAt,
  };
}

/**
 * P0-1(가격 계산 투명화) — 등록 시도 시점의 배송비/수수료율/마진율 입력값
 * 스냅샷. **의미를 바꾸지 않는다**: 여기 담기는 salePriceKrw는 예나 지금이나
 * "상품정보에서 셀러가 확정한 최종 판매가격"(priceOverrideKrw)이지, 채널의
 * 최종 등록가격이 아니다. 채널 값은 위 ChannelPriceAuditRecord에만 들어간다 —
 * 두 기록이 서로 다른 질문에 답하기 때문에 합치지 않는다.
 *
 * 쿠팡 register route에 인라인으로 있던 것을 그대로 옮겼다(계산 변경 없음) —
 * 이 뜻이 유지되는지를 테스트로 고정하기 위해 함수로 꺼냈을 뿐이다.
 */
export function buildPriceBreakdownSnapshot(product: CanonicalProduct) {
  return product.priceBreakdown
    ? {
        originalAmount: product.price.value.amount,
        originalCurrency: product.price.value.currency,
        ...product.priceBreakdown,
        salePriceKrw: product.priceOverrideKrw?.value ?? null,
      }
    : undefined;
}
