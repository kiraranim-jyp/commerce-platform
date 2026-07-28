import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import { extractShopifyHandle } from "../shopify-product-json";
import type { ExtractionContext, ExtractionStrategy, ImageCandidate } from "./types";

interface ShopifyProductImage {
  src: string;
  width?: number;
  height?: number;
}

interface ShopifyProductResponse {
  product?: { images?: ShopifyProductImage[] };
}

/**
 * Shopify는 모든 스토어에 `/products/{handle}.json` 공개 엔드포인트를 제공한다(인증 불필요) —
 * 테마 DOM을 스캔하는 것보다 훨씬 신뢰도 높게 전체 상품 이미지(변형 포함)를 얻을 수 있다.
 *
 * URL이 `/products/{handle}` 패턴에 걸리는 경우는 대부분 universal-extractor.ts의
 * SiteStrategy 빠른 경로(Playwright 없이 먼저 시도)에서 이미 처리된다 — 이 Strategy는
 * 그 빠른 경로가 실패했는데도(예: 일시적 네트워크 오류) Playwright 네비게이션 자체는
 * 성공한 드문 경우를 위한 안전망으로 남겨둔다.
 */
export const shopifyStrategy: ExtractionStrategy = {
  name: "shopify",
  canHandle(ctx) {
    return /window\.shopify|shopify\.theme|cdn\.shopify\.com/i.test(ctx.html);
  },
  async extract(ctx: ExtractionContext): Promise<ImageCandidate[]> {
    const handle = extractShopifyHandle(ctx.url);
    if (!handle) return [];

    const origin = new URL(ctx.url).origin;
    const jsonUrl = `${origin}/products/${handle}.json`;

    let response: Response;
    try {
      response = await fetchWithDomainRateLimit(jsonUrl, { headers: { Accept: "application/json" } });
    } catch {
      return [];
    }
    if (!response.ok) return [];

    let data: ShopifyProductResponse;
    try {
      data = (await response.json()) as ShopifyProductResponse;
    } catch {
      return [];
    }

    const images = data.product?.images ?? [];
    return images
      .filter((img) => Boolean(img.src))
      .map((img) => ({
        url: img.src,
        width: img.width,
        height: img.height,
        source: "shopify" as const,
      }));
  },
};
