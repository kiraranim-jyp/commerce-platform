import { extractFromJsonLd, extractFromOpenGraph } from "../product-data-extractor";
import {
  extractShopifyHandle,
  fetchPlainHtml,
  fetchShopifyProductJs,
  fetchShopifyProductJson,
  type ShopifyProductResult,
} from "../shopify-product-json";
import type { SiteStrategy, SiteStrategyResult } from "./types";

/** .json/.js 둘 다 통화 정보가 없을 때만(.json은 보통 variants[].price_currency로
 * 있음 — 드문 경우) plain fetch로 HTML을 한 번 더 가져와 JSON-LD/OpenGraph 메타에서
 * 통화를 보강한다. 이미 통화가 있으면 추가 요청을 하지 않는다 — "가능하면 HTML을
 * 아예 안 읽는다"는 원칙을 지키면서도 가격 표시에 통화가 비는 걸 막는다. */
async function fillMissingCurrency(
  result: ShopifyProductResult,
  url: string,
): Promise<SiteStrategyResult> {
  if (!result.productData.price || result.productData.price.currency) {
    return result;
  }
  const html = await fetchPlainHtml(url);
  if (!html) return result;

  const jsonLd = extractFromJsonLd(html);
  const og = extractFromOpenGraph(html);
  const currency = jsonLd?.price?.currency || og.price?.currency;
  if (!currency) return result;

  return {
    ...result,
    productData: { ...result.productData, price: { ...result.productData.price, currency } },
  };
}

/**
 * Shopify는 모든 스토어에 인증 없이 접근 가능한 공개 상품 JSON(`/products/{handle}.json`,
 * `/products/{handle}.js`) 엔드포인트를 제공한다. detect()는 URL의 `/products/{handle}`
 * 패턴만 보고 판별하므로 Playwright 네비게이션이 실행되기 전에도 안전하게 호출할 수
 * 있다 — Cloudflare가 Playwright의 자동화 패턴만 차단하고 plain fetch는 막지 않는
 * 사이트(실측: junioredition.com)에서도 이 경로는 영향을 받지 않는다.
 */
export const shopifySiteStrategy: SiteStrategy = {
  name: "shopify",

  async detect(url) {
    return extractShopifyHandle(url) !== null;
  },

  async extract(url) {
    const result = await fetchShopifyProductJson(url);
    if (!result) return null;
    return fillMissingCurrency(result, url);
  },

  async fallback(url) {
    const result = await fetchShopifyProductJs(url);
    if (!result) return null;
    return fillMissingCurrency(result, url);
  },
};
