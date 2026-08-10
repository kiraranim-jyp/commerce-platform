import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface ShopifySuggestResponse {
  resources?: {
    results?: {
      // 실측(junioredition.com) 응답 기준 — price/currency 코드 필드는 응답에 없음(로케일
      // 프리픽스가 있어도 마찬가지). 통화는 로케일 프리픽스(REGION_CURRENCY)로 추정하고,
      // 추정 불가하면 comparison_shops.currency(DB)로 폴백한다.
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

/** Shopify Markets 로케일 프리픽스(/en-kr/, /en-gb/ 등)의 지역 코드로 통화를 추정한다 —
 * suggest.json은 product-json과 달리 price_currency 필드를 아예 안 주기 때문에, 실측으로
 * 확인된 지역만 최소한으로 매핑한다(모르는 지역은 억지로 채우지 않고 null). */
const REGION_CURRENCY: Record<string, string> = {
  KR: "KRW",
  GB: "GBP",
  US: "USD",
};

function currencyFromLocalePrefix(localePrefix: string): string | null {
  const match = /^\/?[a-z]{2}-([a-z]{2})$/i.exec(localePrefix);
  return match ? (REGION_CURRENCY[match[1].toUpperCase()] ?? null) : null;
}

/** URL 경로에서 "/products/" 앞의 로케일 프리픽스만 뽑는다(예: "/en-kr") — 없으면 "". */
function extractLocalePrefix(url: string | undefined): string {
  if (!url) return "";
  try {
    const pathname = new URL(url).pathname;
    const match = /^\/([a-z]{2}-[a-z]{2})\//i.exec(pathname);
    return match ? `/${match[1]}` : "";
  } catch {
    return "";
  }
}

/** junioredition.com 등 Shopify 기반 사이트의 공개 검색 제안 API. 인증 불필요, plain fetch.
 * sourceUrl에 Shopify Markets 로케일 프리픽스(/en-kr/ 등)가 있으면 같은 프리픽스로 먼저
 * 시도해 원본 상품과 동일한 로케일의 표시가를 얻는다(₩256,100 같은 실제 표시가 vs 기본
 * 매장 통화를 재환산하는 오류를 피함). 프리픽스 요청이 실패하면(그 로케일 미지원 등)
 * 기본 경로로 폴백한다 — 검색 자체가 막히면 안 되므로. */
export async function searchShopifySuggest(
  domain: string,
  currency: string | null,
  query: string,
  sourceUrl?: string,
): Promise<ComparisonCandidate[]> {
  const localePrefix = extractLocalePrefix(sourceUrl);
  const qs = `q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=5`;

  let response: Response | null = null;
  if (localePrefix) {
    try {
      const localizedResponse = await fetchWithDomainRateLimit(`https://${domain}${localePrefix}/search/suggest.json?${qs}`, {
        headers: { Accept: "application/json", "User-Agent": CHROME_UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (localizedResponse.ok) response = localizedResponse;
    } catch {
      // 로케일 경로 실패 — 아래에서 기본 경로로 폴백
    }
  }
  if (!response) {
    response = await fetchWithDomainRateLimit(`https://${domain}/search/suggest.json?${qs}`, {
      headers: { Accept: "application/json", "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  }
  if (!response.ok) throw new Error(`Shopify suggest API ${response.status}`);

  const data = (await response.json()) as ShopifySuggestResponse;
  const products = data.resources?.results?.products ?? [];
  const resolvedCurrency = (localePrefix && currencyFromLocalePrefix(localePrefix)) || currency;

  return products.map((p) => ({
    title: p.title ?? "",
    url: p.url ? `https://${domain}${p.url}` : `https://${domain}`,
    price: p.price && resolvedCurrency ? { amount: Number(p.price), currency: resolvedCurrency } : null,
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
