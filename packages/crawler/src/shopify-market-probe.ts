import { extractShopifyHandle, fetchShopifyProductJson } from "./shopify-product-json";

/**
 * Sprint N-3.2 — 한 상품 URL에 대해 여러 Shopify Markets locale(예: "en-kr")을
 * probe해서 실제로 존재하는 market의 가격만 모은다. 새 fetch 로직을 만들지
 * 않고 이미 검증된 fetchShopifyProductJson(로케일 프리픽스가 있으면
 * price_currency를 그대로 신뢰, 없으면 shopCurrency로 override하는 로직 포함)을
 * 그대로 재사용한다 — 이 파일은 "어떤 marketCode를 어떤 순서로 시도할지"만
 * 관장한다.
 */

export interface ShopifyMarketProbeResult {
  marketCode: string;
  amount: number;
  currency: string;
  sourceUrl: string;
  /** N-3.7 — 이 요청이 내부적으로 이미 가져온 판매처 메타(/meta.json). 별도로
   * 다시 fetch하지 않고 fetchShopifyProductJson이 가져온 걸 그대로 넘긴다. */
  shopMeta: import("./shopify-product-json").ShopifyShopMeta | null;
}

async function probeMarket(origin: string, handle: string, marketCode: string): Promise<ShopifyMarketProbeResult | null> {
  const prefix = marketCode ? `/${marketCode}` : "";
  const url = `${origin}${prefix}/products/${handle}`;
  const result = await fetchShopifyProductJson(url);
  const price = result?.productData.price;
  if (!price || !price.currency) return null;
  return {
    marketCode,
    amount: price.amount,
    currency: price.currency,
    sourceUrl: `${url}.json`,
    shopMeta: result?.shopMeta ?? null,
  };
}

/** 기본 조회 — 원본(사이트 기본, 프리픽스 없음) + 한국(en-kr) 두 곳만.
 * PART H(비용 최적화) — "기본 요청에서는 국가별 가격 전체 조회를 하지 않는다."
 * handle을 못 뽑으면(Shopify가 아니거나 URL 형식이 다름) null. */
export async function probeOriginAndKrMarkets(
  sourceUrl: string,
): Promise<{ origin: ShopifyMarketProbeResult | null; kr: ShopifyMarketProbeResult | null } | null> {
  const handle = extractShopifyHandle(sourceUrl);
  if (!handle) return null;
  const origin = new URL(sourceUrl).origin;
  const [originResult, krResult] = await Promise.all([
    probeMarket(origin, handle, ""),
    probeMarket(origin, handle, "en-kr"),
  ]);
  return { origin: originResult, kr: krResult };
}

/** 확장 조회 — 흔히 쓰이는 Shopify Markets locale 코드 후보를 실제로 찔러보고
 * 성공한 것만 반환한다. 이 목록은 "존재를 단정"하는 게 아니라 "확인해볼
 * 후보"일 뿐이다 — 404/오류가 나면 그 market은 존재하지 않는 것으로 취급하고
 * 결과에서 완전히 제외한다(추측으로 채우지 않는다).
 *
 * N-3.2 실측(2026-08-10) — "xx"(언어만, 지역 없음) 형태 후보("fr","de","es",
 * "ja")는 junioredition.com에서 200을 반환하지만 실제로는 별도 market이
 * 아니라 그냥 기본(원본) 가격을 그대로 되돌려줬다(4개 코드 전부 정확히
 * 같은 GBP 74 — 우연이라기엔 너무 정확히 일치). 이걸 "실제 market"으로
 * 보여주면 실제로는 없는 프랑스/독일/스페인/일본 시장이 있는 것처럼
 * 오해를 준다(CPO 금지 원칙 위반) — 그래서 확인된 진짜 Shopify Markets
 * 프리픽스 형태("xx-yy", 예: "en-kr"/"en-au")만 후보로 남긴다. */
export const EXPAND_CANDIDATE_MARKET_CODES = ["en-us", "en-gb", "en-fr", "en-de", "en-jp", "en-au", "en-ca"];

export async function probeAdditionalMarkets(
  sourceUrl: string,
  excludeMarketCodes: string[],
): Promise<ShopifyMarketProbeResult[]> {
  const handle = extractShopifyHandle(sourceUrl);
  if (!handle) return [];
  const origin = new URL(sourceUrl).origin;
  const candidates = EXPAND_CANDIDATE_MARKET_CODES.filter((code) => !excludeMarketCodes.includes(code));
  const results = await Promise.all(candidates.map((code) => probeMarket(origin, handle, code)));
  return results.filter((r): r is ShopifyMarketProbeResult => r !== null);
}
