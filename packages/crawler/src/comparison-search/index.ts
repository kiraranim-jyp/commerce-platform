import type { ShippingPolicyStatus } from "@commerce/pricing";
import { extractShopifyHandle, fetchShopifyProductJson, stripShopifyLocalePrefix } from "../shopify-product-json";
import { lookupBrandAlias } from "./brand-alias";
import { fetchChocoelProductPrice } from "./chocoel";
import { fetchDeuxbebeProductPrice } from "./deuxbebe";
import { fetchForetforetProductPrice } from "./foretforet";
import { fetchLooxlooProductPrice } from "./looxloo";
import { splitModelColor, withConfidence } from "./match";
import { findPriceSourceAdapter } from "./price-source-adapter";
import type { PriceSourceCollectionMethod } from "./price-source-adapter";
import { fetchRuliiProductPrice } from "./rulii";
import type {
  ComparisonCandidate,
  ComparisonQuery,
  ComparisonSearchResult,
  ComparisonShopRef,
  DomesticSourceRef,
} from "./types";

export * from "./types";
export { scoreCandidate, withConfidence } from "./match";
export { MAX_DETAIL_CONFIRMATIONS_PER_SHOP, selectCandidatesForDetailConfirmation } from "./price-confirmation";
/** N-4.18-Q3 PART H-3-1 — 동일상품 판별 증거 데이터 계약. */
export * from "./evidence";
/** N-4.18-Q3 PART H-3-2 — FORETFORET mpn 추출 + modelCode 비교(exact/partial/
 * unavailable/conflict). 아직 confidence/matchLevel 계산에는 연결하지 않는다
 * (H-3-5에서 연결 예정). */
export { extractForetforetModelCode, fetchForetforetModelCode } from "./foretforet";
/** DOMESTIC-SHIPPING-03(CEO 지시, 2026-09-16) — 포레포레 배송비 «정책» 파서.
 * 금액은 뽑지 않는다(foretforet.ts 실측 주석 참고). */
export { extractForetforetShippingPolicy, type ForetforetShippingPolicy } from "./foretforet";
export { compareModelCode, extractForeignModelCode } from "./model-code";
/** P-28(CPO 지시, 2026-09-03) — 도메인별 국내 식별자 추출기 레지스트리.
 * fetchForetforetModelCode 하드코딩을 일반화한 것 — foretforet.com/
 * bobochoses.com 둘 다 여기로 흡수된다. */
export { extractBobochosesModelCode, fetchDomesticModelCode, supportsDomesticIdentifierExtraction } from "./domestic-identifiers";
/** N-4.18-Q3 PART H-3-3 — Cafe24 3개 사이트(RULII/LOOXLOO/DEUXBEBE) JSON-LD offers[]
 * 추출. 아직 옵션 유사도 판정/confidence/matchLevel에는 연결하지 않는다(다음 단계). */
export { extractRuliiOptions } from "./rulii";
export { extractLooxlooOptions } from "./looxloo";
export { extractDeuxbebeOptions } from "./deuxbebe";
/** N-4.18-Q3 PART H-3-4 — dHash 이미지 교차비교(Evidence 저장까지만, confidence/
 * matchLevel 미연결). */
export { classifyImageEvidence, computeMinImageDistance, hashImageUrl } from "./image-evidence";
/** N-4.18-Q3 PART H-3-5 — Evidence 기반 자동확정/검토필요/기존판단유지 결정
 * 레이어. 기존 scoreCandidateMatch/classifyMatchLevel은 재계산하지 않고
 * 참조만 한다. domestic_product_links 자동확정 흐름과는 아직 연결하지
 * 않는다(대표님 지시: 그다음 단계). */
export { decideCandidateEvidence } from "./decision";
export type { AutoDecision, CandidateEvidenceDecision, CandidateEvidenceInput } from "./decision";
/** N-4.18-Q3 PART H-3-8 — scoreCandidateMatch() 입력 title 정제(실측 확인된
 * 재고상태/가격 suffix만 제거). 계산식/threshold는 변경하지 않는다. */
export { normalizeMatchingTitle } from "./title-normalize";
/** P-7-B(CPO 지시, 2026-08-29) — "점수와 Match Truth 분리". decideCandidateEvidence와
 * 같은 입력을 쓰지만 목적이 다르다(자동확정 여부가 아니라 화면 표시 신뢰 등급).
 * scoreCandidateMatch/classifyMatchLevel/decideCandidateEvidence 전부 미변경. */
export { deriveMatchTruth, MATCH_TRUTH_RANK } from "./match-truth";
export type { MatchTruth } from "./match-truth";
/** P-9-A(대표님 지시, 2026-08-30) — 국내 동일상품 후보를 verified 우선(그 안에서
 * 식별자 근거 우선, 그다음 confidence)으로 화면에 보여준다. 새 판정 로직이 아니라
 * 이미 API가 돌려주는 필드만으로 정렬 순서를 정하는 presentation-layer 함수. */
export { compareDomesticCandidateTrust, sortDomesticCandidatesByTrust } from "./display-priority";
export type { DomesticCandidateTrust } from "./display-priority";
/** P-11 STEP 4(대표님/CPO 지시, 2026-08-30) — 해외 가격비교(comparison-search) 전용
 * "동일상품 vs 유사상품 vs 다른 상품" 판정 계층. scoreCandidateMatch/confidence/
 * classifyMatchLevel은 전혀 재계산하지 않는다 — 이미 있는 title 모델명(splitModelColor)과
 * 구조화 코드 완전일치만으로 별도 판정을 얹는다. */
export { attachProductMatchTruth, deriveProductMatchTruth, PRODUCT_MATCH_TRUTH_RANK } from "./product-identity";
export type { ProductMatchTruth } from "./product-identity";
/** MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 판매처가 달라도 같은 물건인지
 * 판정하는 계층. 방향을 바꿔도 같은 답이 나오고, 강한 반증은 점수로 뒤집히지
 * 않는다. scoreCandidateMatch/confidence/matchLevel은 전혀 재계산하지 않는다. */
/* MATCHING-FIX-01 Phase B(CEO 지시, 2026-09-16) — isSameProductForPricing 은
   여기서도 사라졌다. 「이 후보를 동일상품 가격에 쓸 것인가」를 답하는 함수는
   이제 deriveMatchTruth 하나뿐이다(cross-seller.ts 맨 아래 주석이 그 함수가
   지키려던 의도를 어디에 남겼는지 적고 있다). */
export { compareCrossSellerProducts, CROSS_SELLER_IMAGE_STRONG_MAX_DISTANCE } from "./cross-seller";
export type {
  CrossSellerAxis,
  CrossSellerBlocker,
  CrossSellerConflict,
  CrossSellerImageEvidence,
  CrossSellerMatch,
  CrossSellerVerdict,
} from "./cross-seller";
/** 판매처 응답 → ProductFacts 어댑터. 사이트별 차이는 전부 여기서 흡수하고
 * 판정기는 사이트를 모른다. */
export {
  extractSmallableBreadcrumb,
  extractSmallableSizeLabels,
  productFactsFromListing,
  productFactsFromShopifyProduct,
  productFactsFromSmallableHtml,
} from "./seller-facts";
export type { ListingProductLike, ShopifyProductLike } from "./seller-facts";
/** GOLF-01.5 축 C(CEO 지시, 2026-09-16) — 가격소스 수집 표준. 어댑터가 수집
 * 방식(API/FEED/WEB)을 자기 «안»에 숨기고, 호출부와 MI 는 공통
 * ComparisonCandidate 만 본다. 흩어져 있던 파서 등록부 6곳이 이 한 곳으로
 * 모였다 — 새 수집 경로가 아니라 기존 경로의 등록부를 합친 것이다. */
export {
  enrichCandidatePrices,
  findPriceSourceAdapter,
  listPriceSourceAdapters,
} from "./price-source-adapter";
export type {
  PriceSourceAdapter,
  PriceSourceCollectionMethod,
  PriceSourceReadiness,
  PriceSourceSearchInput,
} from "./price-source-adapter";
export { RAKUTEN_ACCESS_KEY_ENV, RAKUTEN_APPLICATION_ID_ENV } from "./rakuten-ichiba";

/**
 * GOLF-01.5 축 A(CEO 지시, 2026-09-16) — "이 도메인에 자동 수집 파서가 있는가"를
 * **검색을 실행하지 않고** 물어보는 자리. 값을 새로 정의하지 않는다 —
 * searchOneShop이 실제로 분기하는 그 조건을 그대로 돌려준다(두 곳에 적으면
 * 언젠가 화면이 "수집 가능"이라고 말하는데 실제로는 unsupported가 된다).
 *
 * GOLF-01.5 축 C(2026-09-16) — 그 "조건"이 이제 등록부 하나다. 목록을 여기
 * 따로 적지 않는다: searchOneShop 이 찾는 어댑터를 똑같이 찾아본다.
 *
 * 🔴 access_status(열리는가)와 섞지 않는다. 이건 "우리가 읽을 수 있는가"다.
 * 🔴 자격증명 유무와도 섞지 않는다. Rakuten 은 어댑터가 «있고»(true) 키가
 *    «없다» — 그 둘은 화면이 서로 다른 말을 해야 하는 서로 다른 사실이다
 *    (comparisonShopCollectability 참고).
 */
export function supportsComparisonShopSearch(domain: string): boolean {
  return findPriceSourceAdapter(domain, "OVERSEAS") !== null;
}

/** 화면이 한 소스에 대해 말해야 하는 «수집 능력» 전부. /api/comparison-shops 가
 * 이 값을 그대로 내려보내고 설정 화면이 그대로 읽는다 — 파서 유무와 키 유무를
 * 각자 따로 계산하지 않게 한다. */
export interface ComparisonShopCollectability {
  /** 어댑터가 등록돼 있는가. */
  parserAvailable: boolean;
  /** 어떻게 수집하는가(API/FEED/WEB). 어댑터가 없으면 null.
   * 🔴 표시용이다 — 이 값으로 분기하는 코드는 없어야 한다. */
  collectionMethod: PriceSourceCollectionMethod | null;
  /** 자격증명이 필요 없거나 이미 설정돼 있으면 true. 어댑터가 없으면 null
   * ("파서가 없다"와 "키가 없다"를 같은 칸에서 말하지 않는다). */
  credentialsConfigured: boolean | null;
  /** 비어 있는 환경변수 «이름»만. 🔴 값은 담지 않는다. */
  missingCredentials: string[];
}

export function comparisonShopCollectability(domain: string): ComparisonShopCollectability {
  const adapter = findPriceSourceAdapter(domain, "OVERSEAS");
  if (!adapter) {
    return { parserAvailable: false, collectionMethod: null, credentialsConfigured: null, missingCredentials: [] };
  }
  const readiness = adapter.readiness();
  return {
    parserAvailable: true,
    collectionMethod: adapter.method,
    credentialsConfigured: readiness.state === "READY",
    missingCredentials: readiness.state === "NOT_CONFIGURED" ? readiness.missing : [],
  };
}

/**
 * 한 해외 소스 1곳에 대한 수집 1회.
 *
 * GOLF-01.5 축 C — 도메인별 if 분기가 사라지고 등록부 조회 한 줄이 됐다.
 * 🔴 이 함수는 어댑터가 API 인지 WEB 인지 **묻지 않는다**. 수집 방식은 어댑터
 *    «안»에 있고, 여기서부터 위(=화면·MI)로는 공통 ComparisonCandidate 만 간다.
 *    그것이 "MI 는 수집 방법을 몰라야 한다"는 CEO 지시의 구현이다.
 */
async function searchOneShop(shop: ComparisonShopRef, query: ComparisonQuery): Promise<ComparisonSearchResult> {
  const base = { shopId: shop.id, shopName: shop.name, domain: shop.domain };
  const adapter = findPriceSourceAdapter(shop.domain, "OVERSEAS");
  // 등록부에 없는 도메인은 요청 자체를 보내지 않는다(하드코딩 허용목록이 아니라
  // 어댑터 존재 여부 — comparison_shops 의 나머지 활성 사이트가 여기로 온다).
  if (!adapter) return { ...base, status: "unsupported", candidates: [] };

  // 🔴 자격증명이 없으면 **부르지 않는다**. 빈 결과로 흉내 내지 않는다.
  const readiness = adapter.readiness();
  if (readiness.state === "NOT_CONFIGURED") {
    return { ...base, status: "not_configured", candidates: [], missingCredentials: readiness.missing };
  }

  try {
    const candidates = await adapter.search({ term: query.title, currency: shop.currency });
    const scored = withConfidence(query, candidates);
    const enriched = adapter.enrichScored ? await adapter.enrichScored(scored, query) : scored;
    return { ...base, status: "ok", candidates: enriched };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    // P-4-DATA-4(CPO 지시) — 429는 "찾지 못했습니다"와 전혀 다른 셀러 문구가 필요하다.
    // 어댑터들이 던지는 에러 메시지에 상태코드가 그대로 포함되어 있어
    // (`Shopify suggest API ${status}` · `Rakuten Ichiba Item Search API ${status}`)
    // 여기서 문자열로 판별한다 — 별도 커스텀 에러 클래스를 새로 만들지 않고
    // 기존 에러 메시지 포맷을 그대로 재사용.
    const errorKind: "RATE_LIMITED" | "TEMPORARY_ERROR" = /\b429\b/.test(message) ? "RATE_LIMITED" : "TEMPORARY_ERROR";
    return { ...base, status: "error", candidates: [], error: message, errorKind };
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
/** GOLF-01.5 축 A — 해외의 supportsComparisonShopSearch와 같은 이유·같은 역할.
 * GOLF-01.5 축 C — 그 "유일한 진실"이 이제 해외와 **같은 등록부**다. 국내용
 * 목록을 따로 적지 않는다(그 목록이 세 벌이던 것이 이번에 한 벌이 됐다). */
export function supportsDomesticShopSearch(domain: string): boolean {
  return findPriceSourceAdapter(domain, "DOMESTIC") !== null;
}

async function searchOneDomesticShop(
  source: DomesticSourceRef,
  query: ComparisonQuery,
): Promise<ComparisonSearchResult> {
  const base = { shopId: source.id, shopName: source.name, domain: source.domain };
  if (source.collectionStrategy !== "AUTO_API" && source.collectionStrategy !== "AUTO_SCRAPE") {
    return { ...base, status: "unsupported", candidates: [] };
  }
  // 🔴 어댑터 조회를 «검색어 루프 밖»에서 한 번만 한다. 어댑터가 없으면 검색어를
  //    바꿔도 달라지지 않는다(예전 searchDomesticShopCandidates 가 null 을
  //    돌려주면 즉시 멈추던 것과 같은 동작이다 — 요청을 한 번도 보내지 않는다).
  const adapter = findPriceSourceAdapter(source.domain, "DOMESTIC");
  if (!adapter) return { ...base, status: "unsupported", candidates: [] };

  // 국내 어댑터는 오늘 전부 자격증명이 필요 없다(전부 공개 페이지 WEB 파서).
  // 그래도 «같은 표준»을 통과시킨다 — 언젠가 국내에 API 소스가 생겼을 때
  // 이 자리를 다시 고칠 필요가 없고, 그때도 화면 문구는 이미 준비돼 있다.
  const readiness = adapter.readiness();
  if (readiness.state === "NOT_CONFIGURED") {
    return { ...base, status: "not_configured", candidates: [], missingCredentials: readiness.missing };
  }

  const searchTerm = query.searchTerm ?? query.title;
  const searchWith = (term: string) => adapter.search({ term, currency: source.currency });
  const enrich = (candidates: ComparisonCandidate[]) =>
    adapter.enrichScored ? adapter.enrichScored(candidates) : Promise.resolve(candidates);
  try {
    // MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 좁은 검색어부터 차례로 시도하고
    // 결과가 나오면 멈춘다. 검색어 하나가 0건이라는 사실은 "이 상품이 국내에
    // 없다"가 아니라 "그 말로는 못 찾았다"일 뿐인데, 지금까지 그 둘이 구분되지
    // 않았다. 이 목록이 없으면(하위호환) 기존처럼 searchTerm 하나만 쓴다.
    const terms = query.searchTerms?.length ? query.searchTerms : [searchTerm];
    let primary: ComparisonCandidate[] = [];
    for (const term of terms) {
      primary = await searchWith(term);
      if (primary.length > 0) break;
    }
    const primaryScored = withConfidence(query, primary);
    if (primaryScored.length > 0) {
      return { ...base, status: "ok", candidates: await enrich(primaryScored) };
    }

    // N-4.18-P-4 STEP P-4-2/3(대표님 지시, 2026-08-25) — 원문 검색이 NO_RESULT일
    // 때만, 실측 확인된 브랜드 한글 alias로 재검색한다(brand-alias.ts에 없는 브랜드는
    // 그대로 빈 결과 유지 — 폴백을 시도하지 않는다). 재검색 결과도 기존
    // withConfidence/scoreCandidateMatch를 그대로 통과시켜 판정 기준을 원문 검색과
    // 완전히 동일하게 유지한다(별도 판정 로직 없음 — STEP P-4-5).
    //
    // N-4.18-Q3 PART G/K(대표님 실측 골든케이스, 2026-08-26) — alias 단독 재검색은
    // 실측에서 실패로 확인됐다: PèPè "Lulu T-Bar Shoes in Vernice Nero" 검색 시
    // "페페" 단독 재검색은 실제로 100건(브랜드 전체 상품)을 반환하는데,
    // searchDomesticShopCandidates가 사이트별 상위 5건까지만 반환하므로(각 파서의
    // 실측 확인된 한도) 목표 상품이 상위 5건 밖으로 밀려나 사실상 못 찾는다. 실측
    // 확인(curl): "페페 Vernice Nero"처럼 alias에 원문 제목에서 분리한 색상/스타일
    // 단어를 덧붙이면 foretforet.com에서 정확히 3건으로 좁혀지고 목표 상품이 그
    // 안에 포함된다 — alias 단독보다 "alias + 색상"이 실제로 더 좁고 정확한 결과를
    // 낸다(추측이 아니라 실측 재현). 색상이 분리되지 않는 제목(원문에 "in X by Y"
    // 패턴이 없는 경우)은 기존처럼 alias 단독만 시도한다 — 억지로 지어내지 않는다.
    const alias = lookupBrandAlias(query.brand);
    if (!alias) return { ...base, status: "ok", candidates: [] };
    const { color } = splitModelColor(query.title);
    const aliasQuery = color ? `${alias} ${color}` : alias;
    const fallback = await searchWith(aliasQuery);
    // 색상을 붙인 쿼리가 결과 0건이면(사이트 검색이 AND 매칭이라 너무 좁아졌을 수
    // 있음) alias 단독으로 한 번 더 시도한다 — 이것도 실패하면 빈 결과 유지.
    const finalFallback = fallback.length > 0 || !color ? fallback : await searchWith(alias);
    if (finalFallback.length === 0) return { ...base, status: "ok", candidates: [] };
    const fallbackScored = withConfidence(query, finalFallback);
    const enrichedFallback = await enrich(fallbackScored);
    return {
      ...base,
      status: "ok",
      candidates: enrichedFallback,
      ...(enrichedFallback.length > 0 ? { querySource: "brand_alias" as const } : {}),
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

export interface SourcePriceVerification {
  status: "VERIFIED_CURRENT" | "PRICE_UNAVAILABLE" | "NOT_APPLICABLE";
  price: { amount: number; currency: string } | null;
  regularPrice: { amount: number; currency: string } | null;
}

/** P-4-DATA-4 STEP 4(CPO 지시, 2026-08-29) — "비교 사이트 검색"과는 완전히 다른
 * 목적이다: 셀러가 이미 갖고 있는 원본 상품 sourceUrl 자체가 Shopify 상품 페이지면,
 * 다른 사이트를 검색할 필요 없이 그 URL을 직접 다시 조회해서 "지금 이 순간의 원본
 * 판매가"를 확정한다. P-4-DATA-3 실측 조사(실제 상품 30개)에서 이 경로가 적용 가능한
 * 18개(60%) 전부 정확한 가격을 100% 성공률로 반환했다 — 검색(search/suggest.json)
 * 보다 훨씬 신뢰도가 높다. Shopify가 아니거나 handle을 못 뽑으면(나머지 40%,
 * 실측상 전부 smallable.com 계열) NOT_APPLICABLE — 이 결과가 없다고 원본 상품이
 * 없다는 뜻은 아니다(추측 금지, 그냥 이 경로로는 확인 못 했다는 뜻).
 *
 * P-4-DATA-6 P0-2(CPO 지시, 2026-08-29) — 실제 저장된 sourceUrl은 전부 /en-kr/
 * 로케일 프리픽스가 붙어 있다(실측 확인, F5). 프리픽스를 그대로 두고 조회하면
 * enrichCandidatePrices와 같은 문제(Shopify Markets 자체 환산 KRW가 "원본가격"
 * 자리에 들어옴)가 여기서도 재현된다 — "원본 판매가 확정"이 이 함수의 목적이므로
 * 항상 로케일을 벗긴 URL로만 조회한다(shopify.site-strategy.ts의 extract()와
 * 동일한 방식, stripShopifyLocalePrefix 공유). */
export async function verifySourcePriceDirect(sourceUrl: string): Promise<SourcePriceVerification> {
  const handle = extractShopifyHandle(sourceUrl);
  if (!handle) return { status: "NOT_APPLICABLE", price: null, regularPrice: null };
  try {
    const detail = await fetchShopifyProductJson(stripShopifyLocalePrefix(sourceUrl));
    if (!detail?.productData.price) return { status: "PRICE_UNAVAILABLE", price: null, regularPrice: null };
    return {
      status: "VERIFIED_CURRENT",
      price: detail.productData.price,
      regularPrice: detail.productData.regularPrice ?? null,
    };
  } catch {
    return { status: "PRICE_UNAVAILABLE", price: null, regularPrice: null };
  }
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
  /**
   * DOMESTIC-SHIPPING-03(CEO 지시, 2026-09-16) — 🔴 바로 위 soldOut 선례를 그대로
   * 따른다. 배송 정책을 «실측한» 사이트(foretforet.com)만 채우고, 나머지 5개
   * 어댑터는 값을 넘기지 않는다 → undefined → 저장 시 null. 그래서 그 다섯
   * 어댑터는 이번 작업에서 코드 변경이 «0줄»이다(시그니처를 강제로 넓히지 않는다).
   *
   * 여기서의 null(= 안 넘김)은 «배송비 상태 데이터 없음»이다 — UNREAD("읽었지만
   * 못 찾음")도, FREE도, 0원도 아니다. 그 구분이 DOMESTIC-SHIPPING-02의 전부다.
   */
  shippingPolicyStatus?: ShippingPolicyStatus | null;
  shippingPolicyNote?: string | null;
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
      // N-4.18-Q3 PART E-2 — RULII와 동일 원칙(index.ts:275-285): soldOut은
      // price 유무와 별개로 항상 전달한다(가격을 못 찾아도 품절 확인은
      // 그대로 남겨야 한다 — E-1에서 고친 파이프라인 버그가 이 신호도 살린다).
      return result.available && result.price
        ? { status: "OK", price: result.price, soldOut: result.soldOut }
        : { status: "UNAVAILABLE", price: null, soldOut: result.soldOut };
    }
    if (domain === "chocoel.co.kr") {
      const result = await fetchChocoelProductPrice(externalUrl);
      // N-4.18-Q3 PART E-2 — RULII/DEUXBEBE와 동일하게 UNAVAILABLE 분기에서도
      // soldOut을 전달한다(chocoel은 실측에서 신호를 못 찾아 항상 null이지만,
      // 세 사이트의 처리 방식을 통일해둔다 — 나중에 chocoel용 신호를 찾으면
      // 이 분기를 또 고칠 필요가 없다).
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
    if (domain === "foretforet.com") {
      const result = await fetchForetforetProductPrice(externalUrl);
      // N-4.18-Q3 PART E-10 — 다른 3개 사이트와 동일 원칙: soldOut은 price 유무와
      // 별개로 항상 전달한다(changeOpt2value는 죽은 코드였고, 실제 신호는
      // sto_state — foretforet.ts 실측 주석 참고).
      //
      // DOMESTIC-SHIPPING-03(CEO 지시, 2026-09-16) — 배송비 «상태»도 정확히 같은
      // 이유로 같은 자리에 싣는다. 가격을 못 찾은 경우(UNAVAILABLE)에도 "배송비
      // 정책을 확인했다"는 사실 자체는 관측이다. 🔴 어댑터가 준 값을 그대로
      // 옮기기만 한다 — 여기서 기본값을 채우거나 상태를 바꾸지 않는다.
      const shipping = {
        shippingPolicyStatus: result.shippingPolicyStatus,
        shippingPolicyNote: result.shippingPolicyNote,
      };
      return result.available && result.price
        ? { status: "OK", price: result.price, soldOut: result.soldOut, ...shipping }
        : { status: "UNAVAILABLE", price: null, soldOut: result.soldOut, ...shipping };
    }
    return { status: "UNSUPPORTED", price: null };
  } catch (error) {
    return { status: "ERROR", price: null, error: error instanceof Error ? error.message : "알 수 없는 오류" };
  }
}
