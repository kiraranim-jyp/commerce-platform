import { searchChildrensalon } from "./childrensalon";
import { withConfidence } from "./match";
import { searchShopifySuggest } from "./shopify-suggest";
import type { ComparisonQuery, ComparisonSearchResult, ComparisonShopRef } from "./types";

export * from "./types";
export { scoreCandidate } from "./match";

/** 이 Phase에서 실제 파서가 있는 도메인만 여기 등록한다 — comparison_shops의 나머지 활성
 * 사이트는 자동으로 "unsupported"가 된다(하드코딩된 사이트 "허용 목록"이 아니라, 파서 존재 여부). */
async function searchOneShop(shop: ComparisonShopRef, query: ComparisonQuery): Promise<ComparisonSearchResult> {
  const base = { shopId: shop.id, shopName: shop.name, domain: shop.domain };
  try {
    if (shop.domain === "junioredition.com") {
      const candidates = await searchShopifySuggest(shop.domain, shop.currency, query.title, query.sourceUrl);
      return { ...base, status: "ok", candidates: withConfidence(query, candidates) };
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
