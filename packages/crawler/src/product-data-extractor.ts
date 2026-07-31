import type { Page } from "playwright-core";
import type { CanonicalProductOptionGroup, CanonicalProductVariant } from "@commerce/shared";

export type ProductDataSource = "json-ld" | "microdata" | "open-graph" | "dom" | "shopify-json";

export interface ExtractedProductData {
  title?: string;
  brand?: string;
  price?: { amount: number; currency: string };
  sku?: string;
  description?: string;
  /** @deprecated optionGroups[].name으로 대체됐다 — Shopify처럼 값 목록/Variant까지
   * 나오는 소스는 optionGroups/variants를 채운다. 이 필드는 이름만 필요한 기존
   * 코드(검색태그 등) 하위호환용으로 남겨뒀다. */
  options: string[];
  /** Shopify처럼 옵션 값 목록까지 구조화 데이터로 주는 소스에서만 채워진다 —
   * DOM 드롭다운만 있는 사이트는 사이트마다 구조가 너무 달라 이번 범위에서
   * 다루지 않는다(빈 배열). */
  optionGroups?: CanonicalProductOptionGroup[];
  variants?: CanonicalProductVariant[];
  material?: string;
  /** Sprint A-2(Category Resolver 보강) — JSON-LD BreadcrumbList가 있으면
   * ["Home", "Kids", "Shoes", "Sneakers"]처럼 사이트가 자체적으로 분류해둔
   * 카테고리 경로를 그대로 담는다. title/description에 나이·성별 신호가 전혀
   * 없는 상품(예: Veja 스니커즈 — 성인/키즈 라인이 이름만으로 구분 안 됨)도
   * 사이트 자신의 분류(예: "Kids Shoes" 섹션)는 갖고 있는 경우가 많아서,
   * 쿠팡 predict API의 오분류를 잡아내는 추가 신호로 쓴다. */
  breadcrumbPath?: string[];
  /** Sprint A-2.5(Category Resolver 2.0) — schema.org Product.category(있으면).
   * "Apparel > Shoes" 처럼 슬래시/화살표로 구분된 문자열이거나 단일 카테고리명
   * 문자열이다. 사이트가 자체적으로 붙인 값이라 breadcrumbPath와 같은 급의
   * 신호다(둘 다 없는 사이트도 많다). */
  jsonLdCategory?: string;
  /** Sprint A-2.5(Category Resolver 2.0) — Shopify 전용 신호. Shopify 상품은
   * fast-path(shopify-product-json.ts)로 처리되어 breadcrumbPath/jsonLdCategory를
   * 채우는 JSON-LD 파싱을 안 타는 경우가 많다 — vendor 필드에 시즌코드가 들어오는
   * 매장(bobochoses.com 실측: vendor="SS26")도 있어 tags/product_type이 나이·성별·
   * 상품유형을 판단할 유일한 신호가 되는 경우가 있다. Shopify가 아닌 소스는 항상
   * undefined. */
  shopifyTags?: string;
  shopifyProductType?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "$": "USD",
  "£": "GBP",
  "kr": "SEK",
};

/**
 * explicitCurrency는 schema.org Offer의 형제 필드(priceCurrency)에서 온 값이다 —
 * price 자체는 "2450"처럼 통화 기호 없는 순수 숫자인 경우가 흔해서, 있으면 이걸
 * 최우선으로 신뢰한다. 없을 때만 문자열 안의 기호/통화코드 추측으로 폴백한다.
 */
function parsePrice(
  raw: unknown,
  explicitCurrency?: string,
): { amount: number; currency: string } | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") return { amount: raw, currency: explicitCurrency ?? "" };
  if (typeof raw !== "string") return undefined;
  const numMatch = /[\d.,]+/.exec(raw);
  if (!numMatch) return undefined;
  const amount = Number(numMatch[0].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return undefined;
  if (explicitCurrency) return { amount, currency: explicitCurrency.toUpperCase() };
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (raw.includes(symbol)) return { amount, currency: code };
  }
  const codeMatch = /\b([A-Z]{3})\b/.exec(raw);
  return { amount, currency: codeMatch?.[1] ?? "" };
}

/** JSON-LD Product 노드에서 name/brand/offers/sku/description을 뽑는다.
 * 이미지 추출용 json-ld.strategy.ts와 같은 스크립트 태그를 다시 파싱하지만, 여기서는
 * 이미지가 아니라 상품 정보 필드가 관심사라 별도 파서로 둔다(관심사 분리).
 * shopify.site-strategy.ts가 통화(currency) 보강용으로 재사용하므로 export한다. */
export function extractFromJsonLd(html: string): ExtractedProductData | null {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let productResult: ExtractedProductData | null = null;
  let breadcrumbPath: string[] | undefined;
  for (const match of html.matchAll(scriptRe)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (!productResult) {
        const product = findProductNode(node);
        if (product) {
          const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          const brand = typeof product.brand === "string" ? product.brand : product.brand?.name;
          const offerCurrency = offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency;
          productResult = {
            title: typeof product.name === "string" ? product.name : undefined,
            brand: typeof brand === "string" ? brand : undefined,
            price: offers
              ? parsePrice(
                  offers.price ?? offers.priceSpecification?.price,
                  typeof offerCurrency === "string" ? offerCurrency : undefined,
                )
              : undefined,
            sku: typeof product.sku === "string" ? product.sku : undefined,
            description: typeof product.description === "string" ? product.description : undefined,
            options: [],
            material: typeof product.material === "string" ? product.material : undefined,
            jsonLdCategory: typeof product.category === "string" ? product.category : undefined,
          };
        }
      }
      // BreadcrumbList는 보통 Product와 같은 @graph 안에 형제로 있다 — Product를
      // 찾았다고 바로 끝내지 않고 나머지 노드도 계속 훑어서 같이 챙긴다.
      if (!breadcrumbPath) {
        breadcrumbPath = findBreadcrumbPath(node) ?? undefined;
      }
    }
  }
  if (!productResult) return null;
  return breadcrumbPath ? { ...productResult, breadcrumbPath } : productResult;
}

function findProductNode(node: unknown): Record<string, any> | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, any>;
  if (Array.isArray(obj["@graph"])) {
    for (const child of obj["@graph"]) {
      const found = findProductNode(child);
      if (found) return found;
    }
    return null;
  }
  const type = obj["@type"];
  const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
  return isProduct ? obj : null;
}

/** schema.org BreadcrumbList — itemListElement를 position 순으로 정렬해서
 * 이름만 뽑는다("item": {"name": ...}} 형태와 바로 "name" 형태 둘 다 흔하다). */
function findBreadcrumbPath(node: unknown): string[] | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, any>;
  if (Array.isArray(obj["@graph"])) {
    for (const child of obj["@graph"]) {
      const found = findBreadcrumbPath(child);
      if (found) return found;
    }
    return null;
  }
  const type = obj["@type"];
  const isBreadcrumb = type === "BreadcrumbList" || (Array.isArray(type) && type.includes("BreadcrumbList"));
  if (!isBreadcrumb || !Array.isArray(obj.itemListElement)) return null;
  const items = [...obj.itemListElement]
    .sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))
    .map((item: any) => {
      const name = item?.name ?? item?.item?.name;
      return typeof name === "string" ? name.trim() : undefined;
    })
    .filter((name): name is string => !!name);
  return items.length > 0 ? items : null;
}

/** OpenGraph 메타 태그 — JSON-LD가 없거나 일부 필드가 비어 있을 때 보강용으로 쓴다.
 * shopify.site-strategy.ts가 통화(currency) 보강용으로 재사용하므로 export한다. */
export function extractFromOpenGraph(html: string): Partial<ExtractedProductData> {
  const get = (property: string): string | undefined => {
    const re = new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    return re.exec(html)?.[1];
  };
  const title = get("og:title");
  const description = get("og:description");
  const priceAmount = get("product:price:amount") ?? get("og:price:amount");
  const priceCurrency = get("product:price:currency") ?? get("og:price:currency");
  const brand = get("product:brand") ?? get("og:brand");

  return {
    title,
    description,
    brand,
    price:
      priceAmount != null
        ? { amount: Number(priceAmount), currency: priceCurrency ?? "" }
        : undefined,
  };
}

/**
 * schema.org Microdata(itemprop 속성) — JSON-LD가 없는 사이트에서 흔히 이 방식으로
 * 구조화 데이터를 노출한다(PrestaShop 계열이 대표적: LillaMode/LojaDada 등 이미
 * 검증된 사이트도 실제로 이 형식을 쓴다 — JSON-LD가 아예 없고 OpenGraph에도 가격이
 * 없어서, 개선 전에는 price가 항상 0으로 빠졌다). price/priceCurrency는 반드시
 * itemprop="offers" 범위 안에서 우선 찾는다 — 그래야 같은 페이지의 관련상품 가격과
 * 섞이지 않는다.
 */
async function extractFromMicrodata(page: Page): Promise<Partial<ExtractedProductData>> {
  const raw = await page.evaluate(() => {
    const text = (el: Element | null | undefined) => el?.textContent?.trim() || undefined;
    const attr = (el: Element | null | undefined, name: string) =>
      el?.getAttribute(name)?.trim() || undefined;

    const offerScope = document.querySelector('[itemprop="offers"]');
    const priceEl =
      offerScope?.querySelector('[itemprop="price"]') ?? document.querySelector('[itemprop="price"]');
    const currencyEl =
      offerScope?.querySelector('[itemprop="priceCurrency"]') ??
      document.querySelector('[itemprop="priceCurrency"]');
    const nameEl = document.querySelector('[itemprop="name"]');
    const brandEl = document.querySelector('[itemprop="brand"]');
    const skuEl = document.querySelector('[itemprop="sku"]');

    return {
      title: text(nameEl),
      brand: attr(brandEl, "content") || text(brandEl),
      priceRaw: attr(priceEl, "content") || text(priceEl),
      currency: attr(currencyEl, "content") || text(currencyEl),
      sku: attr(skuEl, "content") || text(skuEl),
    };
  });

  return {
    title: raw.title,
    brand: raw.brand,
    sku: raw.sku,
    price: raw.priceRaw ? parsePrice(raw.priceRaw, raw.currency) : undefined,
  };
}

/** <title>/<h1> 같은 아주 기본적인 DOM 요소 — 구조화 데이터가 전혀 없는 사이트를 위한
 * 최후의 보루. 신뢰도가 가장 낮으므로(Confidence 계산에서 낮게 잡는다) 다른 소스가
 * 있으면 절대 우선순위를 뺏지 않는다. */
async function extractFromDom(page: Page): Promise<Partial<ExtractedProductData>> {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent?.trim();
    const title = h1 || document.title.trim();
    return { title: title || undefined };
  });
}

/** JSON-LD → Microdata → OpenGraph → DOM 순으로 시도하고, 필드 단위로 부족한 부분을
 * 다음 소스로 보강한다(예: JSON-LD에 title은 있는데 price가 없으면 Microdata의
 * price로 채운다). Microdata를 OpenGraph보다 앞에 두는 이유: 둘 다 "구조화 데이터"로
 * 신뢰도가 비슷하지만, 실제로 많은 사이트가 og:price를 아예 안 넣는 반면 상품
 * 페이지의 itemprop="offers"는 결제 흐름에 실제로 쓰이는 값이라 더 정확하다. */
export async function extractProductData(
  html: string,
  page: Page,
): Promise<{
  data: ExtractedProductData;
  sources: Record<string, ProductDataSource>;
}> {
  const jsonLd = extractFromJsonLd(html);
  const microdata = await extractFromMicrodata(page);
  const og = extractFromOpenGraph(html);
  const dom = await extractFromDom(page);

  const sources: Record<string, ProductDataSource> = {};
  const pick = <K extends keyof ExtractedProductData>(
    field: K,
  ): ExtractedProductData[K] | undefined => {
    if (jsonLd?.[field] != null) {
      sources[field as string] = "json-ld";
      return jsonLd[field];
    }
    if (microdata[field] != null) {
      sources[field as string] = "microdata";
      return microdata[field] as ExtractedProductData[K];
    }
    if (og[field] != null) {
      sources[field as string] = "open-graph";
      return og[field] as ExtractedProductData[K];
    }
    if (dom[field] != null) {
      sources[field as string] = "dom";
      return dom[field] as ExtractedProductData[K];
    }
    return undefined;
  };

  const data: ExtractedProductData = {
    title: pick("title"),
    brand: pick("brand"),
    price: pick("price"),
    sku: pick("sku"),
    description: pick("description"),
    material: pick("material"),
    options: jsonLd?.options ?? [],
    breadcrumbPath: jsonLd?.breadcrumbPath,
    jsonLdCategory: jsonLd?.jsonLdCategory,
  };

  return { data, sources };
}
