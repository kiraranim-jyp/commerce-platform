import { extractShopifyHandle, extractShopifyLocalePrefix, fetchShopifyProductJson } from "../shopify-product-json";
import { searchChildrensalon } from "./childrensalon";
import { withConfidence } from "./match";
import { selectCandidatesForDetailConfirmation } from "./price-confirmation";
import { searchShopifySuggest } from "./shopify-suggest";
import type { ComparisonCandidate, ComparisonQuery, ComparisonSearchResult, ComparisonShopRef } from "./types";

export * from "./types";
export { scoreCandidate } from "./match";
export { MAX_DETAIL_CONFIRMATIONS_PER_SHOP, selectCandidatesForDetailConfirmation } from "./price-confirmation";

/** Sprint B-1.5/B-1.8 — search-suggest.json의 가격은 신뢰하지 않는다(B-1.4에서 확인: Vercel에서
 * 로케일 프리픽스를 줘도 기본 통화 숫자가 그대로 돌아옴). 검색은 "후보 발견"까지만 담당하고,
 * 실제 판매가/통화는 이미 검증된 상품 상세 JSON 엔드포인트(fetchShopifyProductJson, B-1.1에서
 * /meta.json 기준으로 정확성 확인됨)에서 다시 확정한다.
 *
 * B-1.8 — "동일상품일 가능성"(matchLevel)과 "가격을 확인했는지"(priceSource)는 별개 상태다.
 * matchLevel이 very_high/high인 후보만(= 동일상품일 가능성이 높다고 이미 판단된 것만) 상세
 * 확인 대상으로 삼고, 그중에서도 최대 MAX_DETAIL_CONFIRMATIONS_PER_SHOP건까지만 실제로
 * 요청한다 — 검색 결과가 많다고 전부 호출하지 않는다. medium/low는 애초에 대상에서 제외한다
 * (동일상품인지도 불확실한데 가격까지 확인할 이유가 없다). 상세 확인이 실패하면(네트워크
 * 오류 등) 검색 결과 가격을 그대로 두고 priceSource="search"로 남긴다 — 매칭 결과 자체를
 * 지우지 않는다. 원본 상품의 sourceUrl에 로케일 프리픽스(/en-kr/ 등)가 있으면 그 로케일로
 * 상세를 조회해서 원본과 같은 로케일의 표시가를 맞춘다. */
export async function enrichCandidatePrices(
  candidates: ComparisonCandidate[],
  shopDomain: string,
  sourceUrl: string | undefined,
): Promise<ComparisonCandidate[]> {
  const withDefaultSource: ComparisonCandidate[] = candidates.map((c) => ({ ...c, priceSource: "search" }));
  const eligibleIndexes = selectCandidatesForDetailConfirmation(withDefaultSource);
  if (eligibleIndexes.length === 0) return withDefaultSource;

  const origin = `https://www.${shopDomain.replace(/^www\./, "")}`;
  const localePrefix = sourceUrl ? extractShopifyLocalePrefix(sourceUrl) : "";

  await Promise.all(
    eligibleIndexes.map(async (i) => {
      const candidate = withDefaultSource[i];
      const handle = extractShopifyHandle(candidate.url);
      if (!handle) return;
      try {
        const detail = await fetchShopifyProductJson(`${origin}${localePrefix}/products/${handle}`);
        if (detail?.productData.price) {
          withDefaultSource[i] = { ...candidate, price: detail.productData.price, priceSource: "detail" };
        }
      } catch {
        // 검색 결과 가격 + priceSource="search" 그대로 유지
      }
    }),
  );

  return withDefaultSource;
}

/** N-3.11 Part A — 실제로 /search/suggest.json이 표준 Shopify 응답 구조({resources:
 * {results:{products:[...]}}})를 준다고 직접 fetch로 확인한 도메인만 여기 추가한다
 * (NICKIS/Isola Bella Kids/Petite Maison Kids/Piccoli & Co, 2026-08-12 실측 확인 —
 * 4곳 모두 확인 없이 짐작으로 추가하지 않았다). searchShopifySuggest는 도메인에
 * 종속되지 않으므로 새 파서를 만들 필요가 없다 — 이미 junioredition.com에 쓰던
 * 함수를 그대로 재사용한다(토큰 절약 원칙). */
const SHOPIFY_SUGGEST_DOMAINS = new Set([
  "junioredition.com",
  "nickis.com",
  "isolabellakids.com",
  "petitemaisonkids.com",
  "shoppiccoliandco.com",
]);

/** 이 Phase에서 실제 파서가 있는 도메인만 여기 등록한다 — comparison_shops의 나머지 활성
 * 사이트는 자동으로 "unsupported"가 된다(하드코딩된 사이트 "허용 목록"이 아니라, 파서 존재 여부). */
async function searchOneShop(shop: ComparisonShopRef, query: ComparisonQuery): Promise<ComparisonSearchResult> {
  const base = { shopId: shop.id, shopName: shop.name, domain: shop.domain };
  try {
    if (SHOPIFY_SUGGEST_DOMAINS.has(shop.domain)) {
      const candidates = await searchShopifySuggest(shop.domain, shop.currency, query.title);
      const scored = withConfidence(query, candidates);
      const enriched = await enrichCandidatePrices(scored, shop.domain, query.sourceUrl);
      return { ...base, status: "ok", candidates: enriched };
    }
    if (shop.domain === "childrensalon.com") {
      // Childrensalon은 검색 HTML 자체에서 실제 판매가를 직접 파싱하므로(상세 페이지를 따로
      // 조회하지 않음) priceSource는 항상 "search"다 — 값 자체는 실제 표시가다.
      const candidates = await searchChildrensalon(shop.currency, query.title);
      const scored = withConfidence(query, candidates).map((c) => ({ ...c, priceSource: "search" as const }));
      return { ...base, status: "ok", candidates: scored };
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
