export * from "./browser-launcher";
export * from "./config";
export * from "./image-extractor";
export * from "./universal-extractor";
export * from "./description-facts";
export * from "./brand-resolver";
export type { ExtractedProductData, ProductDataSource } from "./product-data-extractor";
export { extractProductGroupOptions, extractFromJsonLd } from "./product-data-extractor";
export type { ExtractionTrace } from "./scoring";
export type { StrategySource } from "./strategies/types";
export * from "./comparison-search";
export * from "./market-probe-result";
export * from "./market-probe";
export * from "./shopify-market-probe";
export * from "./smallable-market-probe";
export { fetchShopifyShopMeta, stripShopifyLocalePrefix, type ShopifyShopMeta } from "./shopify-product-json";
export { normalizeUrl } from "./utils/url.util";
export { withTimeout, ExtractionTimeoutError } from "./with-timeout";
export {
  fetchNaverSearchTrendRatio,
  type NaverDataLabCredentials,
  type SearchTrendStatus,
  type SearchTrendOutcome,
} from "./market-signals/naver-datalab";
/* A-1 — 원소스가 «명시한» 대표 이미지 1장을 찾는다(단일 선언만 인정). */
export {
  findSourceRepresentativeImageUrl,
  findSourceRepresentativeIndex,
  representativeIdForIndex,
} from "./source-representative";
