import { extractShopifyHandle, extractShopifyLocalePrefix, fetchShopifyProductJson } from "../shopify-product-json";
import { searchBoboChosesKorea } from "./bobochoses-kr";
import { lookupBrandAlias } from "./brand-alias";
import { searchChildrensalon } from "./childrensalon";
import { fetchChocoelProductPrice, searchChocoel } from "./chocoel";
import { fetchDeuxbebeProductPrice, searchDeuxbebe } from "./deuxbebe";
import { searchForetforet } from "./foretforet";
import { fetchLooxlooProductPrice, searchLooxloo } from "./looxloo";
import { withConfidence } from "./match";
import { selectCandidatesForDetailConfirmation } from "./price-confirmation";
import { fetchRuliiProductPrice, searchRulii } from "./rulii";
import { searchShopifySuggest } from "./shopify-suggest";
import type {
  ComparisonCandidate,
  ComparisonQuery,
  ComparisonSearchResult,
  ComparisonShopRef,
  DomesticSourceRef,
} from "./types";

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

/** N-3.11/N-3.12 Part A — 실제로 /search/suggest.json이 표준 Shopify 응답 구조({resources:
 * {results:{products:[...]}}})를 준다고 직접 fetch로 확인한 도메인만 여기 추가한다
 * (N-3.11: NICKIS/Isola Bella Kids/Petite Maison Kids/Piccoli & Co, N-3.12: Kidswear
 * Collective/Kids Atelier/Designer Kids Wear/Kid Biz/Village Kids/Folk Berlin —
 * 2026-08-12 실측 확인, /cart.json의 currency 필드까지 직접 fetch로 재확인). searchShopifySuggest는
 * 도메인에 종속되지 않으므로 새 파서를 만들 필요가 없다 — 이미 junioredition.com에 쓰던
 * 함수를 그대로 재사용한다(토큰 절약 원칙). */
const SHOPIFY_SUGGEST_DOMAINS = new Set([
  "junioredition.com",
  "nickis.com",
  "isolabellakids.com",
  "petitemaisonkids.com",
  "shoppiccoliandco.com",
  "kidswearcollective.com",
  "kidsatelier.com",
  "designerkidswear.com",
  "kidbizkid.com",
  "villagekids.co.uk",
  "folkberlin.com",
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

/** N-4.07 — domestic_price_sources 중 실제 파서가 있는 도메인만 여기 등록한다(원칙은
 * searchOneShop과 동일 — 하드코딩 "허용 목록"이 아니라 파서 존재 여부). collectionStrategy가
 * MANUAL/NOT_AVAILABLE인 소스는 실제 요청을 보내지 않고 "unsupported"로 응답한다.
 *
 * bobochoses.com만 priceSource를 "detail"로 강제한다(검색 결과 자체가 상세 가격이므로 —
 * 다른 도메인은 검색 목록 가격을 그대로 쓰므로 이 필드를 건드리지 않는다). 이 규칙은
 * 검색어가 원문이든 alias든(아래 참고) 동일하게 적용돼야 하므로 도메인 분기 자체를
 * 검색어와 분리된 헬퍼로 뺀다. */
async function searchDomesticShopCandidates(domain: string, term: string): Promise<ComparisonCandidate[] | null> {
  if (domain === "looxloo.com") return searchLooxloo(term);
  if (domain === "bobochoses.com") {
    const candidates = await searchBoboChosesKorea(term);
    return candidates.map((c) => ({ ...c, priceSource: "detail" as const }));
  }
  if (domain === "rulii.co.kr") return searchRulii(term);
  if (domain === "deuxbebe.com") return searchDeuxbebe(term);
  if (domain === "chocoel.co.kr") return searchChocoel(term);
  if (domain === "foretforet.com") return searchForetforet(term);
  return null;
}

async function searchOneDomesticShop(
  source: DomesticSourceRef,
  query: ComparisonQuery,
): Promise<ComparisonSearchResult> {
  const base = { shopId: source.id, shopName: source.name, domain: source.domain };
  if (source.collectionStrategy !== "AUTO_API" && source.collectionStrategy !== "AUTO_SCRAPE") {
    return { ...base, status: "unsupported", candidates: [] };
  }
  const searchTerm = query.searchTerm ?? query.title;
  try {
    const primary = await searchDomesticShopCandidates(source.domain, searchTerm);
    if (primary === null) return { ...base, status: "unsupported", candidates: [] };
    const primaryScored = withConfidence(query, primary);
    if (primaryScored.length > 0) return { ...base, status: "ok", candidates: primaryScored };

    // N-4.18-P-4 STEP P-4-2/3(대표님 지시, 2026-08-26) — 원문 검색이 NO_RESULT일
    // 때만, 실측 확인된 브랜드 한글 alias 1개로 딱 1회만 재검색한다(brand-alias.ts에
    // 없는 브랜드는 그대로 빈 결과 유지 — 폴백을 시도하지 않는다). 재검색 결과도
    // 기존 withConfidence/scoreCandidateMatch를 그대로 통과시켜 판정 기준을 원문
    // 검색과 완전히 동일하게 유지한다(별도 판정 로직 없음 — STEP P-4-5).
    const alias = lookupBrandAlias(query.brand);
    if (!alias) return { ...base, status: "ok", candidates: [] };
    const fallback = await searchDomesticShopCandidates(source.domain, alias);
    if (fallback === null || fallback.length === 0) return { ...base, status: "ok", candidates: [] };
    const fallbackScored = withConfidence(query, fallback);
    return {
      ...base,
      status: "ok",
      candidates: fallbackScored,
      ...(fallbackScored.length > 0 ? { querySource: "brand_alias" as const } : {}),
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      candidates: [],
      error: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

/** 활성 국내 편집샵 목록을 대상으로 병렬 검색. searchComparisonShops(해외)와 같은 격리
 * 원칙(Promise.allSettled) — 국내/해외를 하나의 함수로 합치지 않는다(Ref 타입 자체가
 * 다른 테이블 스키마를 반영하므로 억지로 합치면 오히려 타입이 흐려진다). */
export async function searchDomesticShops(
  query: ComparisonQuery,
  sources: DomesticSourceRef[],
): Promise<ComparisonSearchResult[]> {
  const settled = await Promise.allSettled(sources.map((source) => searchOneDomesticShop(source, query)));
  return settled.map((result, i) =>
    result.status === "fulfilled"
      ? result.value
      : {
          shopId: sources[i].id,
          shopName: sources[i].name,
          domain: sources[i].domain,
          status: "error" as const,
          candidates: [],
          error: "검색 실패",
        },
  );
}

export interface DomesticPriceRefreshResult {
  status: "OK" | "UNAVAILABLE" | "UNSUPPORTED" | "ERROR";
  price: { amount: number; currency: string } | null;
  error?: string;
  /** N-4.18-G STEP G-2/G-3(대표님 지시, 2026-08-25) — 실측된 사이트(RULII)만
   * 채운다. 나머지 사이트는 그 사이트용 판별 로직을 만들기 전까지 항상
   * undefined/null — "정보 없음"과 "판매중"을 같은 값으로 취급하지 않는다. */
  salePriceKrw?: number | null;
  originalPriceKrw?: number | null;
  soldOut?: boolean | null;
}

/** N-4.07 2차 — domestic_product_links로 이미 매칭이 확정된 특정 상품 1건의 "지금"
 * 가격만 다시 조회한다(검색이 아니라 단일 URL 재확인). daily cron이 이 함수로
 * 매일 가격을 갱신한다 — searchDomesticShops(후보 발견용)와 역할이 다르다. */
export async function refreshDomesticProductPrice(
  domain: string,
  externalUrl: string,
): Promise<DomesticPriceRefreshResult> {
  try {
    if (domain === "looxloo.com") {
      const result = await fetchLooxlooProductPrice(externalUrl);
      return result.available && result.price
        ? { status: "OK", price: result.price }
        : { status: "UNAVAILABLE", price: null };
    }
    if (domain === "bobochoses.com") {
      const handle = extractShopifyHandle(externalUrl);
      if (!handle) return { status: "ERROR", price: null, error: "상품 handle을 URL에서 찾을 수 없음" };
      const detail = await fetchShopifyProductJson(`https://bobochoses.com/ko-kr/products/${handle}`);
      return detail?.productData.price
        ? { status: "OK", price: detail.productData.price }
        : { status: "UNAVAILABLE", price: null };
    }
    if (domain === "rulii.co.kr") {
      const result = await fetchRuliiProductPrice(externalUrl);
      return result.available && result.price
        ? {
            status: "OK",
            price: result.price,
            salePriceKrw: result.salePriceKrw,
            originalPriceKrw: result.originalPriceKrw,
            soldOut: result.soldOut,
          }
        : { status: "UNAVAILABLE", price: null, soldOut: result.soldOut };
    }
    if (domain === "deuxbebe.com") {
      const result = await fetchDeuxbebeProductPrice(externalUrl);
      return result.available && result.price
        ? { status: "OK", price: result.price }
        : { status: "UNAVAILABLE", price: null };
    }
    if (domain === "chocoel.co.kr") {
      const result = await fetchChocoelProductPrice(externalUrl);
      return result.available && result.price
        ? {
            status: "OK",
            price: result.price,
            salePriceKrw: result.salePriceKrw,
            originalPriceKrw: result.originalPriceKrw,
            soldOut: result.soldOut,
          }
        : { status: "UNAVAILABLE", price: null };
    }
    return { status: "UNSUPPORTED", price: null };
  } catch (error) {
    return { status: "ERROR", price: null, error: error instanceof Error ? error.message : "알 수 없는 오류" };
  }
}
