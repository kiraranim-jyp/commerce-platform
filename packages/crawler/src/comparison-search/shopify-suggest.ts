import { fetchWithDomainRateLimit } from "../rate-limit/domain-rate-limiter";
import type { ComparisonCandidate } from "./types";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface ShopifySuggestResponse {
  resources?: {
    results?: {
      // 실측(junioredition.com) 응답 기준 — price/currency 코드 필드는 응답에 없음. 통화는
      // comparison_shops.currency(DB)를 그대로 쓴다.
      //
      // Sprint B-1.3에서 sourceUrl의 로케일 프리픽스(/en-kr/ 등)로 이 엔드포인트를 다시
      // 요청하면 로컬 curl 테스트에서는 로케일화된 가격이 나왔지만, 배포된 Vercel
      // 서버리스 환경에서 동일 요청을 재현하면 로케일 프리픽스 유무와 무관하게 항상 같은
      // (기본 통화) 숫자가 돌아왔다(실측 확인, 2회 재현) — 이 엔드포인트는
      // `/products/{handle}.json`(B-1.1에서 고친 것, `/meta.json` 기준 통화를 함께 반환)과
      // 달리 URL 로케일 프리픽스만으로 신뢰성 있게 로케일 가격을 주지 않는 것으로 보인다.
      // 확실하지 않은 통화 라벨을 붙이는 것이 더 위험해서(예: "210 KRW" 같은 말이 안 되는
      // 값), 이 엔드포인트는 로케일 추정을 하지 않고 항상 DB 기준 통화만 쓴다.
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
