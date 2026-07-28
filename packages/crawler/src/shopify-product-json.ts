import type { ExtractedProductData } from "./product-data-extractor";
import { fetchWithDomainRateLimit } from "./rate-limit/domain-rate-limiter";
import type { ImageCandidate } from "./strategies/types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** 상품 URL(/products/{handle} 또는 /ko/products/{handle} 등 로케일 프리픽스 포함)에서
 * handle을 뽑는다. Shopify의 공개 상품 JSON/JS 엔드포인트는 항상 이 handle 하나로만
 * 접근할 수 있어서, 이 정규식이 URL 기반 Shopify 판별의 유일한 근거가 된다. */
export function extractShopifyHandle(url: string): string | null {
  const match = /\/products\/([a-z0-9-]+)/i.exec(new URL(url).pathname);
  return match ? match[1] : null;
}

function toAbsoluteUrl(src: string): string {
  return src.startsWith("//") ? `https:${src}` : src;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

interface ShopifyJsonImage {
  src: string;
  width?: number;
  height?: number;
}
interface ShopifyJsonVariant {
  price?: string;
  price_currency?: string;
}
interface ShopifyJsonOption {
  name?: string;
}
interface ShopifyJsonProduct {
  title?: string;
  body_html?: string;
  vendor?: string;
  images?: ShopifyJsonImage[];
  variants?: ShopifyJsonVariant[];
  options?: ShopifyJsonOption[];
}

interface ShopifyJsMedia {
  src: string;
  width?: number;
  height?: number;
  media_type?: string;
}
interface ShopifyJsVariant {
  price?: number;
}
interface ShopifyJsOption {
  name?: string;
}
interface ShopifyJsProduct {
  title?: string;
  description?: string;
  vendor?: string;
  price?: number;
  images?: string[];
  media?: ShopifyJsMedia[];
  variants?: ShopifyJsVariant[];
  options?: ShopifyJsOption[];
}

export interface ShopifyProductResult {
  images: ImageCandidate[];
  productData: Partial<ExtractedProductData>;
}

/** Shopify 공개 REST 엔드포인트 — 인증 불필요, 모든 스토어에서 동작한다.
 * .json은 variants[].price_currency까지 포함해서 통화까지 한 번에 확정할 수 있어
 * 1순위로 쓴다(.js는 가격이 센트 단위 정수로만 있고 통화 코드가 없다). */
export async function fetchShopifyProductJson(url: string): Promise<ShopifyProductResult | null> {
  const handle = extractShopifyHandle(url);
  if (!handle) return null;
  const origin = new URL(url).origin;

  let response: Response;
  try {
    response = await fetchWithDomainRateLimit(`${origin}/products/${handle}.json`, {
      headers: { Accept: "application/json", "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let product: ShopifyJsonProduct | undefined;
  try {
    product = ((await response.json()) as { product?: ShopifyJsonProduct }).product;
  } catch {
    return null;
  }
  if (!product) return null;

  const images: ImageCandidate[] = (product.images ?? [])
    .filter((img) => Boolean(img.src))
    .map((img) => ({
      url: toAbsoluteUrl(img.src),
      width: img.width,
      height: img.height,
      source: "shopify" as const,
    }));

  const variant = product.variants?.[0];
  const price =
    variant?.price != null
      ? { amount: Number(variant.price), currency: (variant.price_currency ?? "").toUpperCase() }
      : undefined;

  return {
    images,
    productData: {
      title: product.title,
      brand: product.vendor,
      description: product.body_html ? stripHtmlTags(product.body_html) : undefined,
      price,
      options: (product.options ?? []).map((o) => o.name).filter((n): n is string => Boolean(n)),
    },
  };
}

/** .json이 실패했을 때(커스텀 테마가 응답 스키마를 바꿨거나 일시적 오류인 경우)의
 * 2차 시도. .js는 통화 코드가 없으므로 호출부(shopify.site-strategy.ts)가 필요하면
 * plain HTML fetch로 별도 보강한다. */
export async function fetchShopifyProductJs(url: string): Promise<ShopifyProductResult | null> {
  const handle = extractShopifyHandle(url);
  if (!handle) return null;
  const origin = new URL(url).origin;

  let response: Response;
  try {
    response = await fetchWithDomainRateLimit(`${origin}/products/${handle}.js`, {
      headers: { Accept: "application/json", "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let product: ShopifyJsProduct;
  try {
    product = (await response.json()) as ShopifyJsProduct;
  } catch {
    return null;
  }

  // media[]가 있으면 width/height가 붙어 있어 images[](문자열 배열, 해상도 정보
  // 없음)보다 낫다 — 있을 때만 우선 사용한다.
  const mediaImages = (product.media ?? []).filter((m) => !m.media_type || m.media_type === "image");
  const images: ImageCandidate[] =
    mediaImages.length > 0
      ? mediaImages
          .filter((m) => Boolean(m.src))
          .map((m) => ({
            url: toAbsoluteUrl(m.src),
            width: m.width,
            height: m.height,
            source: "shopify" as const,
          }))
      : (product.images ?? [])
          .filter(Boolean)
          .map((src) => ({ url: toAbsoluteUrl(src), source: "shopify" as const }));

  const centsAmount = product.variants?.[0]?.price ?? product.price;

  return {
    images,
    productData: {
      title: product.title,
      brand: product.vendor,
      description: product.description ? stripHtmlTags(product.description) : undefined,
      price: centsAmount != null ? { amount: centsAmount / 100, currency: "" } : undefined,
      options: (product.options ?? []).map((o) => o.name).filter((n): n is string => Boolean(n)),
    },
  };
}

/** Playwright 없이 plain fetch로만 HTML을 가져온다 — 통화처럼 Shopify JSON에
 * 빠져 있는 필드를 JSON-LD/OpenGraph 메타에서 보강할 때만 쓰는 best-effort 헬퍼다. */
export async function fetchPlainHtml(url: string): Promise<string | null> {
  try {
    const response = await fetchWithDomainRateLimit(url, {
      headers: { "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
