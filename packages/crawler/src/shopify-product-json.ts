import type { CanonicalProductOptionGroup, CanonicalProductVariant } from "@commerce/shared";
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
  id?: number;
  src: string;
  width?: number;
  height?: number;
  /** 이 이미지가 연결된 variant id 목록 — 매장이 옵션별(주로 색상) 대표컷을
   * 지정해뒀을 때만 값이 있다. */
  variant_ids?: number[];
}
interface ShopifyJsonVariant {
  id?: number;
  title?: string;
  price?: string;
  price_currency?: string;
  sku?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  inventory_quantity?: number;
  /** inventory_management가 없으면(null) 매장이 재고 추적을 안 한다는 뜻이라
   * inventory_quantity 숫자를 신뢰할 수 없다 — 이 경우 stockQuantity를 채우지
   * 않는다("모른다"를 "0이다"로 취급하지 않는다). */
  inventory_management?: string | null;
  image_id?: number | null;
}
interface ShopifyJsonOption {
  name?: string;
  values?: string[];
}
interface ShopifyJsonProduct {
  title?: string;
  body_html?: string;
  vendor?: string;
  images?: ShopifyJsonImage[];
  variants?: ShopifyJsonVariant[];
  options?: ShopifyJsonOption[];
  /** Sprint A-2.5(Category Resolver 2.0) — Shopify 상품은 breadcrumbPath/
   * jsonLdCategory 경로를 안 타므로(fillMissingCurrency만 HTML을 보강 조회한다)
   * vendor에 시즌코드("SS26")가 들어오는 등 브랜드 필드가 신뢰 안 될 때도
   * tags/product_type이 유일하게 남는 나이·성별·상품유형 신호인 경우가 실측으로
   * 확인됐다(bobochoses.com: vendor="SS26"이지만 tags에 "children","Kid" 포함). */
  tags?: string;
  product_type?: string;
}

/** variants[].option1/2/3 + options[].name을 CanonicalProductVariant.optionValues
 * (옵션명 -> 선택값 맵)로 합친다 — Shopify는 옵션을 이름이 아니라 순서(1/2/3)로
 * variant에 연결하기 때문에 options 배열의 순서와 맞춰서 읽어야 한다. */
function buildOptionValues(
  variant: ShopifyJsonVariant,
  optionNames: string[],
): Record<string, string> {
  const positions = [variant.option1, variant.option2, variant.option3];
  const optionValues: Record<string, string> = {};
  optionNames.forEach((name, index) => {
    const value = positions[index];
    if (value) optionValues[name] = value;
  });
  return optionValues;
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
  /** N-3.7 — 이 요청이 내부적으로 이미 가져온 판매처 메타(country/name/currency).
   * shopify-market-probe.ts가 별도로 /meta.json을 다시 fetch하지 않고 이 값을
   * 그대로 재사용하도록 노출한다. */
  shopMeta: ShopifyShopMeta | null;
}

export interface ShopifyShopMeta {
  currency: string | null;
  /** N-3.7 — 판매처(편집샵) 원본 시장 국가. `/meta.json`이 실제로 그 매장의
   * 등록 국가를 돌려준다(실측 확인, 2026-08-11: junioredition.com/meta.json →
   * country: "GB"). URL locale이나 브랜드 국가로 추정하지 않고 이 값을 그대로
   * 쓴다 — 지금까지는 currency만 뽑고 이 필드를 버리고 있었다. */
  country: string | null;
  /** 매장 표시명(예: "Junior Edition") — 있으면 UI에 그대로 쓴다. */
  name: string | null;
}

/** 실측 확인(2026-08-03, CEO 리포트) — Shopify Markets를 쓰는 스토어는
 * `/products/{handle}.json`의 `variants[].price_currency`가 "요청이 어느
 * 지역에서 왔는지"에 따라 달라진다(presentment currency, 지오 기반). 영국
 * 매장(junioredition.com, GB)을 로컬에서 curl하면 GBP가 오지만 Vercel(미국
 * 리전) 서버에서 같은 요청을 보내면 USD로 바뀌는 걸 실측으로 확인했다 —
 * 상품 원가가 실제와 다른 통화로 잘못 표시/환산되는 심각한 버그였다.
 * `/meta.json`(모든 Shopify 스토어가 공개하는 매장 메타데이터)의 `currency`
 * 필드는 매장 관리자가 설정한 고정 기준 통화라 지역에 관계없이 항상 같다 —
 * 이 값을 always-authoritative override로 쓴다(있으면 무조건 우선, 없을 때만
 * variant.price_currency로 폴백). */
export async function fetchShopifyShopMeta(origin: string): Promise<ShopifyShopMeta | null> {
  try {
    const response = await fetchWithDomainRateLimit(`${origin}/meta.json`, {
      headers: { Accept: "application/json", "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const meta = (await response.json()) as { currency?: string; country?: string; name?: string };
    return {
      currency: meta.currency ? meta.currency.toUpperCase() : null,
      country: meta.country ? meta.country.toUpperCase() : null,
      name: meta.name ? meta.name.trim() : null,
    };
  } catch {
    return null;
  }
}

/** URL에 Shopify Markets 로케일 프리픽스(/en-kr/products/... 등)가 있으면 그대로
 * 돌려준다("/en-kr") — 없으면 "". 이 프리픽스가 붙은 상품 JSON 요청은 방문자의
 * 실제 로케일로 고정된 가격(예: KRW 직접 표시가)을 돌려주므로, 프리픽스 없는
 * 기본 요청과 섞어 쓰면 안 된다(아래 shopCurrency 오버라이드 분기 참고).
 *
 * 로케일 세그먼트만 뽑는다(경로 시작 바로 뒤, xx-xx 형태) — "/products/" 앞의 전체
 * 문자열을 취하면 "/en-kr/collections/pepe-shoes/products/handle"처럼 중간에 다른
 * 경로 세그먼트가 낀 실제 URL(컬렉션 경유 상품 링크)에서 "/en-kr/collections/pepe-shoes"를
 * 통째로 잘못 붙잡아 존재하지 않는 경로를 만들고 404가 나는 버그가 있었다(Sprint B-1.5
 * 실측 확인). */
export function extractShopifyLocalePrefix(url: string): string {
  const pathname = new URL(url).pathname;
  const match = /^\/([a-z]{2}-[a-z]{2})\//i.exec(pathname);
  return match ? `/${match[1]}` : "";
}

/** Shopify 공개 REST 엔드포인트 — 인증 불필요, 모든 스토어에서 동작한다.
 * .json은 variants[].price_currency까지 포함해서 통화까지 한 번에 확정할 수 있어
 * 1순위로 쓴다(.js는 가격이 센트 단위 정수로만 있고 통화 코드가 없다). */
export async function fetchShopifyProductJson(url: string): Promise<ShopifyProductResult | null> {
  const handle = extractShopifyHandle(url);
  if (!handle) return null;
  const origin = new URL(url).origin;
  const localePrefix = extractShopifyLocalePrefix(url);

  let response: Response;
  let shopMeta: ShopifyShopMeta | null;
  try {
    [response, shopMeta] = await Promise.all([
      fetchWithDomainRateLimit(`${origin}${localePrefix}/products/${handle}.json`, {
        headers: { Accept: "application/json", "User-Agent": CHROME_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
      fetchShopifyShopMeta(origin),
    ]);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const shopCurrency = shopMeta?.currency ?? null;

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

  // 로케일 프리픽스가 있는 요청(/en-kr/products/...)은 방문자가 실제로 보는
  // 로케일에 고정된 가격+통화 쌍을 돌려준다(예: 248200 KRW) — 이 경우
  // price_currency를 그대로 믿는다. 로케일이 없는 기본 요청만 shopCurrency
  // 오버라이드를 쓴다(요청 서버 위치에 따라 presentment currency가 흔들리는
  // 문제를 막기 위한 기존 처리, 로케일이 명시된 요청에는 적용 대상이 아니다).
  const variant = product.variants?.[0];
  const price =
    variant?.price != null
      ? {
          amount: Number(variant.price),
          currency:
            localePrefix && variant.price_currency
              ? variant.price_currency.toUpperCase()
              : (shopCurrency ?? (variant.price_currency ?? "").toUpperCase()),
        }
      : undefined;

  const optionNames = (product.options ?? []).map((o) => o.name).filter((n): n is string => Boolean(n));
  const optionGroups: CanonicalProductOptionGroup[] = (product.options ?? [])
    .filter((o): o is Required<Pick<ShopifyJsonOption, "name" | "values">> => Boolean(o.name && o.values))
    .map((o) => ({ name: o.name, values: o.values }));
  // 옵션이 하나뿐이고 값도 하나뿐이면(사실상 "옵션 없음"과 같은 Shopify 기본
  // 상태 — 매장이 옵션을 안 쓰면 항상 {name:"Title", values:["Default Title"]}
  // 하나만 온다) variant를 별도로 만들 필요가 없다.
  const hasRealOptions = optionGroups.length > 0 && !(optionGroups.length === 1 && optionGroups[0].values.length === 1);
  const variants: CanonicalProductVariant[] = hasRealOptions
    ? (product.variants ?? [])
        .filter((v) => v.id != null)
        .map((v) => ({
          id: String(v.id),
          optionValues: buildOptionValues(v, optionNames),
          sku: v.sku || undefined,
          price:
            v.price != null
              ? {
                  amount: Number(v.price),
                  currency:
                    localePrefix && v.price_currency
                      ? v.price_currency.toUpperCase()
                      : (shopCurrency ?? (v.price_currency ?? "").toUpperCase()),
                }
              : undefined,
          // inventory_management가 없으면(재고 추적 꺼진 매장) 숫자를 신뢰할 수
          // 없어서 채우지 않는다 — "모른다"를 "0개"로 잘못 전달하지 않기 위함.
          stockQuantity: v.inventory_management ? v.inventory_quantity : undefined,
          // TODO(P1-6): image_id는 Shopify 내부 이미지 id라 파이프라인이 다운로드 후
          // 새로 부여하는 CanonicalProductImage.id와 다르다 — URL 기준 매칭이
          // 필요하다(canonical-product.ts가 원본 URL을 알고 있을 때만 가능).
          // 지금은 채우지 않는다(빈 값 = "모른다", 지어내지 않는다).
        }))
    : [];

  return {
    images,
    shopMeta,
    productData: {
      title: product.title,
      brand: product.vendor,
      description: product.body_html ? stripHtmlTags(product.body_html) : undefined,
      price,
      options: optionNames,
      optionGroups,
      variants,
      shopifyTags: product.tags,
      shopifyProductType: product.product_type,
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
  let shopMeta: ShopifyShopMeta | null;
  try {
    [response, shopMeta] = await Promise.all([
      fetchWithDomainRateLimit(`${origin}/products/${handle}.js`, {
        headers: { Accept: "application/json", "User-Agent": CHROME_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }),
      fetchShopifyShopMeta(origin),
    ]);
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const shopCurrency = shopMeta?.currency ?? null;

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
    shopMeta,
    productData: {
      title: product.title,
      brand: product.vendor,
      description: product.description ? stripHtmlTags(product.description) : undefined,
      price: centsAmount != null ? { amount: centsAmount / 100, currency: shopCurrency ?? "" } : undefined,
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
