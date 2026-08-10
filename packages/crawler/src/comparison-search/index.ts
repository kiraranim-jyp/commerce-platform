import { extractShopifyHandle, extractShopifyLocalePrefix, fetchShopifyProductJson } from "../shopify-product-json";
import { searchChildrensalon } from "./childrensalon";
import { withConfidence } from "./match";
import { searchShopifySuggest } from "./shopify-suggest";
import type { ComparisonCandidate, ComparisonQuery, ComparisonSearchResult, ComparisonShopRef } from "./types";

export * from "./types";
export { scoreCandidate } from "./match";

/** Sprint B-1.5 — search-suggest.json의 가격은 신뢰하지 않는다(B-1.4에서 확인: Vercel에서
 * 로케일 프리픽스를 줘도 기본 통화 숫자가 그대로 돌아옴). 검색은 "후보 발견"까지만 담당하고,
 * 실제 판매가/통화는 이미 검증된 상품 상세 JSON 엔드포인트(fetchShopifyProductJson, B-1.1에서
 * /meta.json 기준으로 정확성 확인됨)에서 다시 확정한다. 비용을 위해 confidence가 가장 높은
 * 1건에 대해서만 상세 조회한다 — 후보 전체를 무차별로 조회하지 않는다. 원본 상품의
 * sourceUrl에 로케일 프리픽스(/en-kr/ 등)가 있으면 그 로케일로 후보 상세를 조회해서
 * 원본과 같은 로케일의 표시가를 맞춘다. 실패하면(네트워크 오류 등) 검색 결과의 가격을
 * 그대로 둔다 — 매칭 결과 자체를 막지 않는다. */
async function enrichTopCandidatePrice(
  candidates: ComparisonCandidate[],
  shopDomain: string,
  sourceUrl: string | undefined,
): Promise<ComparisonCandidate[]> {
  if (candidates.length === 0) return candidates;
  const top = candidates[0];
  const handle = extractShopifyHandle(top.url);
  if (!handle) return candidates;

  try {
    // 실측(Sprint B-1.5) — junioredition.com은 www. 없는 bare 도메인으로 로케일 프리픽스
    // 경로(/en-kr/products/...)를 요청하면 404가 난다(기본 경로는 bare/www 둘 다 200).
    // comparison_shops.domain은 bare로 저장되어 있어서(candidate.url도 그래서 bare) 여기서는
    // 항상 www.를 붙여서 요청한다 — 두 형태 모두에서 동작하는 것으로 실측 확인됨.
    const origin = `https://www.${shopDomain.replace(/^www\./, "")}`;
    const localePrefix = sourceUrl ? extractShopifyLocalePrefix(sourceUrl) : "";
    const detail = await fetchShopifyProductJson(`${origin}${localePrefix}/products/${handle}`);
    if (!detail?.productData.price) return candidates;
    return candidates.map((c, i) => (i === 0 ? { ...c, price: detail.productData.price! } : c));
  } catch {
    return candidates;
  }
}

/** 이 Phase에서 실제 파서가 있는 도메인만 여기 등록한다 — comparison_shops의 나머지 활성
 * 사이트는 자동으로 "unsupported"가 된다(하드코딩된 사이트 "허용 목록"이 아니라, 파서 존재 여부). */
async function searchOneShop(shop: ComparisonShopRef, query: ComparisonQuery): Promise<ComparisonSearchResult> {
  const base = { shopId: shop.id, shopName: shop.name, domain: shop.domain };
  try {
    if (shop.domain === "junioredition.com") {
      const candidates = await searchShopifySuggest(shop.domain, shop.currency, query.title);
      const scored = withConfidence(query, candidates);
      const enriched = await enrichTopCandidatePrice(scored, shop.domain, query.sourceUrl);
      return { ...base, status: "ok", candidates: enriched };
    }
    if (shop.domain === "childrensalon.com") {
      const candidates = await searchChildrensalon(shop.currency, query.title);
      return { ...base, status: "ok", candidates: withConfidence(query, candidates) };
    }
    return { ...base, status: "unsupported", candidates: [] };
  } catch (error) {
    return {
      ...base,
      status: "error",
      candidates: [],
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/** 활성 shop 목록을 대상으로 병렬 검색. 한 사이트의 실패가 다른 사이트 결과에 영향을 주지 않는다. */
export async function searchComparisonShops(
  query: ComparisonQuery,
  shops: ComparisonShopRef[],
): Promise<ComparisonSearchResult[]> {
  const settled = await Promise.allSettled(shops.map((shop) => searchOneShop(shop, query)));
  return settled.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : {
          shopId: shops[i].id,
          shopName: shops[i].name,
          domain: shops[i].domain,
          status: "error" as const,
          candidates: [],
          error: "검색 실패",
        },
  );
}
