import type { MarketProbeResult } from "./market-probe-result";
import { probeAdditionalShopifyMarkets } from "./shopify-market-probe";
import { extractShopifyHandle } from "./shopify-product-json";
import { isSmallableProductUrl, probeSmallableMarkets } from "./smallable-market-probe";

/**
 * SMALLABLE-MARKET-PROBE-1(CPO 지시, 2026-09-13) — "이 상품을 다른 시장에서도
 * 관측한다"는 하나의 요구에 경로가 둘이 되는 지점.
 *
 *   probeAdditionalMarkets()
 *     ├─ Shopify probe            로케일 프리픽스(/en-de/) · /meta.json 권위
 *     └─ 사이트별 probe            사이트마다 시장을 표현하는 방식이 다르다
 *           └─ smallable          배송국가 쿼리(?country=KR)
 *
 * ── 왜 Shopify를 일반화하지 않는가 ───────────────────────────────────────
 * Shopify 경로의 정확도는 Shopify 고유의 사실들 위에 서 있다(매장 기준통화가
 * /meta.json에 고정돼 있다 · 로케일 프리픽스 요청은 지오로케이션과 무관하다 ·
 * ?country=가 매장 기준 market을 고른다). 그 전제를 다른 사이트와 공유하는
 * 함수로 넓히면 전제가 전부 조건문이 되고, 조건문이 늘면 어느 사이트에서 어떤
 * 근거로 그 금액이 나왔는지 아무도 말할 수 없게 된다. 그래서 분기는 여기 한
 * 줄이고, Shopify 함수 본문은 이번 작업에서 한 글자도 바뀌지 않았다.
 *
 * ── 등록되지 않은 사이트는 시장이 없다 ───────────────────────────────────
 * 아무 사이트에나 `?country=`를 붙여 보고 값이 나오면 시장이라고 부르지 않는다.
 * 그 파라미터를 무시하는 사이트에서는 **같은 가격이 국가만 다른 시장 여러 개**로
 * 저장되고, 화면은 존재하지 않는 시장 네 곳을 진짜처럼 보여준다. 등록은 실측
 * 한 건당 한 줄씩만 늘어난다.
 */

interface SiteMarketProbe {
  name: string;
  /** 이 사이트의 **상품 URL**인가. 목록/브랜드 페이지는 받지 않는다. */
  supports(url: string): boolean;
  probe(sourceUrl: string, excludeMarketCodes: string[]): Promise<MarketProbeResult[]>;
}

const SITE_MARKET_PROBES: SiteMarketProbe[] = [
  { name: "smallable", supports: isSmallableProductUrl, probe: probeSmallableMarkets },
];

/**
 * 비-Shopify 사이트 중 시장 관측 경로가 **등록된** URL인가.
 *
 * 호출부(run-price-check.ts)가 이 값을 게이트로 쓴다. 지금까지는 "Shopify 기본
 * 조회가 성공했을 때만 확장 조회"였고, 그 게이트 때문에 smallable은 확장 조회
 * 자체에 도달하지 못했다. 게이트를 없애는 대신 조건을 하나 더 두는 이유는
 * PART H(비용) 때문이다 — 등록되지 않은 사이트에는 HTTP 요청을 한 건도 보내지
 * 않는다(요청을 보내 봐야 어차피 빈 배열이다).
 */
export function supportsSiteMarketProbe(url: string): boolean {
  return SITE_MARKET_PROBES.some((probe) => probe.supports(url));
}

/**
 * 추가 시장 관측. Shopify 상품 URL이면 지금까지와 **완전히 같은** 경로로만 가고,
 * 아니면 등록된 사이트별 probe를 쓴다. 어느 쪽도 아니면 빈 배열이다.
 */
export async function probeAdditionalMarkets(
  sourceUrl: string,
  excludeMarketCodes: string[],
): Promise<MarketProbeResult[]> {
  // Shopify 판별이 먼저다. handle을 뽑을 수 있으면 그 상품은 Shopify이고, 그
  // 경우 아래 사이트별 목록은 쳐다보지도 않는다(기존 동작 보존).
  if (extractShopifyHandle(sourceUrl)) {
    return probeAdditionalShopifyMarkets(sourceUrl, excludeMarketCodes);
  }
  const site = SITE_MARKET_PROBES.find((probe) => probe.supports(sourceUrl));
  return site ? site.probe(sourceUrl, excludeMarketCodes) : [];
}
