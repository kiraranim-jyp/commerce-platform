import type { ExtractedProductData } from "../product-data-extractor";
import type { ImageCandidate } from "../strategies/types";

export interface SiteStrategyResult {
  images: ImageCandidate[];
  productData: Partial<ExtractedProductData>;
}

/**
 * 커머스 플랫폼(Shopify/Cafe24/WooCommerce 등)마다 Playwright 없이 먼저 시도할 수
 * 있는 전용 데이터 경로(공개 API/JSON 엔드포인트 등)가 있을 때 이 인터페이스를
 * 구현한다. detect()는 URL 문자열만으로 판별해야 한다 — 이 시점에는 아직 Playwright
 * 네비게이션이 실행되지 않았으므로 HTML을 참조할 수 없다. extract()가 null이거나
 * 빈 이미지 배열을 반환하면 fallback()을 시도하고, 그것도 실패하면 오케스트레이터
 * (universal-extractor.ts)가 기존 Playwright 파이프라인으로 넘어간다.
 */
export interface SiteStrategy {
  name: string;
  detect(url: string): Promise<boolean>;
  extract(url: string): Promise<SiteStrategyResult | null>;
  fallback(url: string): Promise<SiteStrategyResult | null>;
}
