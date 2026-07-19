import type { ExtractionContext, ExtractionStrategy, ImageCandidate } from "./types";

interface ShopifyProductImage {
  src: string;
  width?: number;
  height?: number;
}

interface ShopifyProductResponse {
  product?: { images?: ShopifyProductImage[] };
}

/** 상품 URL(/products/{handle} 또는 /ko/products/{handle} 등 로케일 프리픽스 포함)에서
 * handle을 뽑는다. */
function extractHandle(url: string): string | null {
  const match = /\/products\/([a-z0-9-]+)/i.exec(new URL(url).pathname);
  return match ? match[1] : null;
}

/** Shopify는 모든 스토어에 `/products/{handle}.json` 공개 엔드포인트를 제공한다(인증 불필요) —
 * 테마 DOM을 스캔하는 것보다 훨씬 신뢰도 높게 전체 상품 이미지(변형 포함)를 얻을 수 있다. */
export const shopifyStrategy: ExtractionStrategy = {
  name: "shopify",
  canHandle(ctx) {
    return /window\.shopify|shopify\.theme|cdn\.shopify\.com/i.test(ctx.html);
  },
  async extract(ctx: ExtractionContext): Promise<ImageCandidate[]> {
    const handle = extractHandle(ctx.url);
    if (!handle) return [];

    const origin = new URL(ctx.url).origin;
    const jsonUrl = `${origin}/products/${handle}.json`;

    let response: Response;
    try {
      response = await fetch(jsonUrl, { headers: { Accept: "application/json" } });
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
