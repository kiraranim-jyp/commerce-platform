import type { ShopifyShopMeta } from "./shopify-product-json";

/**
 * SMALLABLE-MARKET-PROBE-1(CPO 지시, 2026-09-13) — 시장 관측 한 건의 모양.
 *
 * 원래 shopify-market-probe.ts 안에 있던 ShopifyMarketProbeResult를 그대로 옮겨
 * 왔다(필드도 주석도 그대로다). 옮긴 이유는 하나다: 시장을 관측하는 경로가 둘이
 * 됐는데(Shopify Markets · 사이트별 probe) 저장부(run-price-check.ts의
 * buildAdditionalMarketObservations)가 읽는 모양은 하나여야 하기 때문이다. 두 벌로
 * 두면 언젠가 한쪽에만 필드가 생기고, 그 필드는 화면까지 오지 못한다.
 *
 * 이 타입은 "관측한 사실"만 담는다. 해석(어느 나라인가·원가로 쓸 값인가)은 전부
 * 저장부와 화면의 일이다.
 */
export interface MarketProbeResult {
  /** 실제로 요청/확인된 시장 코드 그대로. Shopify는 로케일 프리픽스("en-de"),
   * 사이트별 probe는 실제로 요청한 배송국가 코드("kr")다. 통화·도메인·판매처
   * 신고 국가에서 역추론한 값이 절대 아니다. */
  marketCode: string;
  amount: number;
  currency: string;
  /** 이 금액을 실제로 읽어 온 URL. 관측 근거이자 판매처 식별(호스트)의 출처다. */
  sourceUrl: string;
  /** N-3.7 — 이 요청이 내부적으로 이미 가져온 판매처 메타(/meta.json). 별도로
   * 다시 fetch하지 않고 fetchShopifyProductJson이 가져온 걸 그대로 넘긴다.
   *
   * SMALLABLE-MARKET-PROBE-1 — Shopify가 아닌 사이트는 이런 매장 메타 엔드포인트가
   * 없으므로 null이다. null은 "판매처가 선언한 기준 국가를 확인하지 못했다"이지
   * "국가가 없다"가 아니다 — 저장부가 market_country를 null로 남기고, 통화나
   * 요청한 배송국가로 그 칸을 채우지 않는다. */
  shopMeta: ShopifyShopMeta | null;
  /** P-12A(대표님/CPO 지시, 2026-08-31) — fetchShopifyProductJson이 이미
   * 추출하던 productData.regularPrice/available을 그대로 노출한다(신규 fetch
   * 없음). regularPrice가 amount보다 클 때만 "실제 할인 중"이다. */
  regularPrice: { amount: number; currency: string } | null;
  /** true=판매 가능 확인, false=품절 확인, undefined=**확인 못 함**. 셋을 하나로
   * 뭉개지 않는다 — 저장부가 undefined를 sold_out=false(판매중)로 바꿔 적으면
   * 관측하지 않은 사실이 DB에 들어간다. */
  available: boolean | undefined;
}
