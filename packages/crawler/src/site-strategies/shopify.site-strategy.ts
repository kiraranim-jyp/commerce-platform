import { extractFromJsonLd, extractFromOpenGraph } from "../product-data-extractor";
import {
  extractShopifyHandle,
  fetchPlainHtml,
  fetchShopifyProductJs,
  fetchShopifyProductJson,
  stripShopifyLocalePrefix,
  type ShopifyProductResult,
} from "../shopify-product-json";
import type { SiteStrategy, SiteStrategyResult } from "./types";

/** N-3.76(2차, CPO 지시: "원본 통화와 판매가격 통화를 절대로 같은 필드로 처리하지
 * 않는다" / "en-kr URL → 한국 상품 → KRW 금지") — 사용자가 입력한 sourceUrl에
 * 로케일 프리픽스(/en-kr/ 등)가 붙어 있으면(예: 한국 로케일로 브라우징하다 복사한
 * 링크) fetchShopifyProductJson이 그 로케일의 presentment 가격(방문자 로케일에
 * 맞춰 변환된 표시가, 실제 매장 통화가 아님)을 그대로 돌려준다 — 이게 Junior
 * Edition(shopMeta.country=GB, shopMeta.currency=GBP)인데도 원본 가격이 ₩로
 * 표시되던 버그의 root cause였다(실측 확인: en-kr 요청은 GBP 90짜리 상품을
 * KRW로 반환). CanonicalProduct의 "원본 가격/원본 통화"는 매장의 실제 기준
 * 통화여야 하므로, 이 파일(extract())은 항상 로케일 프리픽스를 벗긴 URL로만
 * 요청한다 — handle은 매장 전체에서 유일해서 로케일을 빼도 항상 같은 상품을
 * 정확히 찾는다.
 *
 * P-4-DATA-6(2026-08-29) 정정 — 이 주석은 원래 "shopify-market-probe.ts와
 * comparison-search는 의도적으로 로케일을 그대로 쓴다"고 적혀 있었으나 틀렸다.
 * comparison-search도 실측으로 같은 문제(F5, 최대 6% 가격 불일치)를 겪었고
 * 이제 여기(shopify-product-json.ts)로 옮긴 stripShopifyLocalePrefix export를
 * 그대로 재사용해 동일하게 로케일을 벗긴다. shopify-market-probe.ts만 "여러
 * market의 실제 표시가를 의도적으로 비교"하는 목적이라 로케일을 그대로 쓴다. */

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
    const sourceUrl = stripShopifyLocalePrefix(url);
    const result = await fetchShopifyProductJson(sourceUrl);
    if (!result) return null;
    return fillMissingCurrency(result, sourceUrl);
  },

  async fallback(url) {
    const result = await fetchShopifyProductJs(url);
    if (!result) return null;
    return fillMissingCurrency(result, url);
  },
};
