export * from "./browser-launcher";
export * from "./config";
export * from "./image-extractor";
export * from "./universal-extractor";
export * from "./description-facts";
export * from "./brand-resolver";
/** 🔴 WU-134 — 사이트가 밝힌 이름(브랜드 «결정» 은 호출부가 한다). */
export * from "./site-brand-name";
export type { ExtractedProductData, ProductDataSource } from "./product-data-extractor";
export {
  extractProductGroupOptions,
  extractFromJsonLd,
  /** 🔴 WU-053 — HTML 문자열에서 읽는 순수 microdata 리더(Playwright 0). */
  extractMicrodataFromHtml,
} from "./product-data-extractor";
export type { ExtractionTrace } from "./scoring";
export type { StrategySource } from "./strategies/types";
export * from "./comparison-search";
export * from "./market-probe-result";
export * from "./market-probe";
export * from "./shopify-market-probe";
export * from "./smallable-market-probe";
export { fetchShopifyShopMeta, stripShopifyLocalePrefix, type ShopifyShopMeta } from "./shopify-product-json";
export { normalizeUrl } from "./utils/url.util";
/**
 * 🔴🔴 WU-025 — **outbound 목적지 경계(SSRF)는 이 barrel 에서 re-export 하지 «않는다».**
 *
 * 왜: 그 모듈은 `node:dns` 를 쓴다. 이 `index.ts` 는 **클라이언트 번들에도 끌려오므로**
 * (`app/pipeline/page.tsx` → … → `@commerce/crawler`) barrel 에 올리면 빌드가
 * **깨진다** — 실측 에러: `the chunking context (unknown) does not support external
 * modules (request: node:dns)`. 🔴 추정이 아니라 이 WU 에서 실제로 깨뜨려 보고 확인했다.
 *
 * 🟢 그래서 **서버 전용 호출부가 깊은 경로로 직접 import** 한다 —
 *    `@commerce/crawler/src/utils/outbound-guard`. 이 저장소에 이미 있는 방식이다
 *    (`@commerce/crawler/src/discovery-core` 와 같은 모양).
 * 🔴 소유자는 여전히 **그 파일 하나** 다. 사설 IP 규칙을 다른 곳에 다시 적지 않는다.
 */
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
/* 🔴 P5.6 P2(CPO 결정) — 브랜드 공식몰에서 «확인된» 제조국만 쓴다. */
export * from "./official-site-origin";
export * from "./utils/robots-gate";
