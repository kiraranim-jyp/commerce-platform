import type { Page } from "playwright-core";

export type ProductDataSource = "json-ld" | "microdata" | "open-graph" | "dom" | "shopify-json";

export interface ExtractedProductData {
  title?: string;
  brand?: string;
  price?: { amount: number; currency: string };
  sku?: string;
  description?: string;
  /** 옵션 "종류"(Color/Size 등) — 값 목록까지는 사이트마다 구조가 너무 달라 이번 범위에서는
   * 다루지 않는다(구조화 데이터에 없으면 대부분 JS 드롭다운 안에만 있다). */
  options: string[];
  material?: string;
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
      const product = findProductNode(node);
      if (!product) continue;
      const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
      const brand =
        typeof product.brand === "string" ? product.brand : product.brand?.name;
      const offerCurrency = offers?.priceCurrency ?? offers?.priceSpecification?.priceCurrency;
      return {
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
      };
    }
  }
  return null;
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
  };

  return { data, sources };
}
