import type { Page } from "playwright-core";

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
 * 이미지가 아니라 상품 정보 필드가 관심사라 별도 파서로 둔다(관심사 분리). */
function extractFromJsonLd(html: string): ExtractedProductData | null {
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

/** OpenGraph 메타 태그 — JSON-LD가 없거나 일부 필드가 비어 있을 때 보강용으로 쓴다. */
function extractFromOpenGraph(html: string): Partial<ExtractedProductData> {
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

/** JSON-LD → OpenGraph → DOM 순으로 시도하고, 필드 단위로 부족한 부분을 다음 소스로
 * 보강한다(예: JSON-LD에 title은 있는데 price가 없으면 OG의 price로 채운다). */
export async function extractProductData(
  html: string,
  page: Page,
): Promise<{ data: ExtractedProductData; sources: Record<string, "json-ld" | "open-graph" | "dom"> }> {
  const jsonLd = extractFromJsonLd(html);
  const og = extractFromOpenGraph(html);
  const dom = await extractFromDom(page);

  const sources: Record<string, "json-ld" | "open-graph" | "dom"> = {};
  const pick = <K extends keyof ExtractedProductData>(
    field: K,
  ): ExtractedProductData[K] | undefined => {
    if (jsonLd?.[field] != null) {
      sources[field as string] = "json-ld";
      return jsonLd[field];
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
