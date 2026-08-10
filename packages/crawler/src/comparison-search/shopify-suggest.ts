import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface ShopifySuggestResponse {
  resources?: {
    results?: {
      // 실측(junioredition.com) 응답 기준 — price/currency 코드 필드는 응답에 없음, 통화는
      // comparison_shops.currency(DB)를 그대로 사용한다.
      products?: Array<{
        title?: string;
        url?: string;
        price?: string;
        image?: string;
        vendor?: string;
        body?: string;
      }>;
    };
  };
}

/** junioredition.com 등 Shopify 기반 사이트의 공개 검색 제안 API. 인증 불필요, plain fetch. */
export async function searchShopifySuggest(
  domain: string,
  currency: string | null,
  query: string,
): Promise<ComparisonCandidate[]> {
  const url = `https://${domain}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=5`;
  const response = await fetchWithDomainRateLimit(url, {
    headers: { Accept: "application/json", "User-Agent": CHROME_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Shopify suggest API ${response.status}`);

  const data = (await response.json()) as ShopifySuggestResponse;
  const products = data.resources?.results?.products ?? [];

  return products.map((p) => ({
    title: p.title ?? "",
    url: p.url ? `https://${domain}${p.url}` : `https://${domain}`,
    price: p.price && currency ? { amount: Number(p.price), currency } : null,
    imageUrl: p.image ?? null,
    confidence: 0,
    brand: p.vendor || undefined,
    sku: extractArticleCode(p.body),
  }));
}

/** 상품 설명(body)에 "Article code: XXX" 형식으로 적혀 있는 경우만 뽑는다 —
 * 없는 상품에서 억지로 만들지 않는다. */
function extractArticleCode(body: string | undefined): string | undefined {
  if (!body) return undefined;
  const match = /Article code:\s*([^.<\n]+)/i.exec(body);
  return match ? match[1].trim().slice(0, 100) : undefined;
}
