import { extractShopifyHandle, fetchShopifyProductJson, stripShopifyLocalePrefix } from "../shopify-product-json";
import { searchBoboChosesKorea } from "./bobochoses-kr";
import { lookupBrandAlias } from "./brand-alias";
import { searchChildrensalon } from "./childrensalon";
import { fetchChocoelProductPrice, searchChocoel } from "./chocoel";
import { fetchDeuxbebeProductPrice, searchDeuxbebe } from "./deuxbebe";
import { fetchForetforetProductPrice, searchForetforet } from "./foretforet";
import { fetchLooxlooProductPrice, searchLooxloo } from "./looxloo";
import { splitModelColor, withConfidence } from "./match";
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
export { scoreCandidate, withConfidence } from "./match";
export { MAX_DETAIL_CONFIRMATIONS_PER_SHOP, selectCandidatesForDetailConfirmation } from "./price-confirmation";
/** N-4.18-Q3 PART H-3-1 — 동일상품 판별 증거 데이터 계약. */
export * from "./evidence";
/** N-4.18-Q3 PART H-3-2 — FORETFORET mpn 추출 + modelCode 비교(exact/partial/
 * unavailable/conflict). 아직 confidence/matchLevel 계산에는 연결하지 않는다
 * (H-3-5에서 연결 예정). */
export { extractForetforetModelCode, fetchForetforetModelCode } from "./foretforet";
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
 * 지우지 않는다.
 *
 * P-4-DATA-6 P0-2(CPO 지시, 2026-08-29: "Shopify Markets 가격을 환율로 취급하면 안
 * 된다") — 이전엔 원본 상품의 sourceUrl에 로케일 프리픽스(/en-kr/ 등)가 있으면 그
 * 로케일로 후보 상세를 조회했다. 실측 확인(P-4-DATA-5): 이 경로는 Shopify Markets가
 * 자체 판단한 KRW "지역 표시가"를 그대로 돌려주며, 우리 앱의 Frankfurter/ECB 환율과
 * 최대 6% 차이가 났다(같은 상품, 같은 순간인데 £35 → ₩68,200 vs ₩64,820) — 셀러가
 * 화면에서 구분할 방법이 없는 채로 두 값이 섞여 나왔다. 이제 candidate 상세조회는
 * 항상 로케일 없는 기본 URL(=매장 기준통화, fetchShopifyProductJson이 /meta.json으로
 * 강제하는 shopCurrency)만 쓴다 — KRW 참고환산은 언제나 UI가 /api/exchange-rates
 * 하나로만 계산하도록(단일 FX 엔진), price 필드에는 절대 Shopify 자체 환산 통화가
 * 섞이지 않는다. */
export async function enrichCandidatePrices(
  candidates: ComparisonCandidate[],
  shopDomain: string,
): Promise<ComparisonCandidate[]> {
  const withDefaultSource: ComparisonCandidate[] = candidates.map((c) => ({
    ...c,
    priceSource: "search",
    priceStatus: "UNVERIFIED_SEARCH",
    verificationAttempted: false,
  }));
  const eligibleIndexes = selectCandidatesForDetailConfirmation(withDefaultSource);
  if (eligibleIndexes.length === 0) return withDefaultSource;

  const origin = `https://www.${shopDomain.replace(/^www\./, "")}`;

  // P-4-DATA-4(CPO 지시, 2026-08-29: "조용한 실패(silent failure)를 금지한다") — 이전엔
  // catch{}가 에러를 그냥 삼키고 검증 전 search 값을 그대로 뒀다. 실측 확인된 실제 사고
  // (Hug Hairy Monster: matchLevel=very_high인데 fetch 실패로 £62가 화면에 뜰 뻔함)가
  // 바로 이 경로였다 — "검증 시도했으나 실패"와 "애초에 대상 아님"을 구분해야 하므로,
  // 검증을 시도한 후보는 성공/실패 여부와 무관하게 verificationAttempted=true를 남긴다.
  // 실패 시에는 price 필드를 건드리지 않는다(원 검색값이 남아있어도 priceStatus가
  // PRICE_UNAVAILABLE이면 UI가 숫자를 절대 보여주지 않으므로 안전 — 원칙 1).
  await Promise.all(
    eligibleIndexes.map(async (i) => {
      const candidate = withDefaultSource[i];
      const handle = extractShopifyHandle(candidate.url);
      if (!handle) return;
      try {
        const detail = await fetchShopifyProductJson(`${origin}/products/${handle}`);
        if (detail?.productData.price) {
          withDefaultSource[i] = {
            ...candidate,
            price: detail.productData.price,
            regularPrice: detail.productData.regularPrice ?? null,
            priceSource: "detail",
            priceStatus: "VERIFIED_CURRENT",
            verificationAttempted: true,
          };
        } else {
          withDefaultSource[i] = { ...candidate, priceStatus: "PRICE_UNAVAILABLE", verificationAttempted: true };
        }
      } catch {
        withDefaultSource[i] = { ...candidate, priceStatus: "PRICE_UNAVAILABLE", verificationAttempted: true };
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
      const enriched = await enrichCandidatePrices(scored, shop.domain);
      return { ...base, status: "ok", candidates: enriched };
    }
    if (shop.domain === "childrensalon.com") {
      // Childrensalon은 검색 HTML 자체에서 실제 판매가를 직접 파싱한다(상세 페이지를 따로
      // 조회하지 않음). P-4-DATA-4(CPO 지시) 이전에는 이 값을 "신뢰 가능"으로 취급해
      // priceSource="search"인데도 화면에 그대로 노출했다 — 그러나 다른 사이트의 검색
      // 결과 오염 사례(Booty Ghosts £59, Misha & Puff Mink £270)와 근본적으로 같은
      // 구조(검색 시점 값을 상세 재확인 없이 신뢰)라, "검증되지 않은 가격 숫자는 어떤
      // 경우에도 노출하지 않는다"는 새 원칙을 예외 없이 적용한다 — 별도의 상세 조회
      // 경로가 이 사이트에 아직 없으므로 UNVERIFIED_SEARCH로 남는다(withConfidence의
      // derivePriceStatus가 priceSource!=="detail"이면 자동으로 이렇게 분류한다).
      const candidates = await searchChildrensalon(shop.currency, query.title);
      const scored = withConfidence(query, candidates);
      return { ...base, status: "ok", candidates: scored };
    }
    return { ...base, status: "unsupported", candidates: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    // P-4-DATA-4(CPO 지시) — 429는 "찾지 못했습니다"와 전혀 다른 셀러 문구가 필요하다.
    // searchShopifySuggest가 던지는 에러 메시지에 상태코드가 그대로 포함되어 있어
    // (`Shopify suggest API ${status}`) 여기서 문자열로 판별한다 — 별도 커스텀 에러
    // 클래스를 새로 만들지 않고 기존 에러 메시지 포맷을 그대로 재사용.
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

/** N-4.18-Q3 PART E-2/E-10(대표님 지시, 2026-08-27) — RULII/FORETFORET 둘 다 검색
 * 목록 HTML/AJAX 응답 자체에는 품절 신호가 없다(실측 확인: RULII "원피스" 검색결과에
 * soldout/품절 문자열 0건, FORETFORET product_list.action.html 응답에 sto_state
 * 0건). 반면 상세페이지에는 각자 실측 검증된 soldOut 신호가 있다(rulii.ts의
 * DETAIL_SOLDOUT_RE, foretforet.ts의 sto_state). 그래서 매칭 신뢰도가 높은
 * (very_high/high) 후보만, Sprint B-1.8과 같은 상한(MAX_DETAIL_CONFIRMATIONS_PER_SHOP)
 * 으로 상세페이지를 재확인해 soldOut을 채운다 — 검색 결과 전체를 상세 조회하지
 * 않는다(비용 제한). 실패해도 매칭 결과 자체는 지우지 않고 soldOut만 비워둔다
 * (추측 금지). 두 사이트가 fetchDetail 함수 시그니처만 다르므로 제네릭 헬퍼로 공유한다. */
async function enrichSoldOutViaDetail(
  candidates: ComparisonCandidate[],
  fetchDetail: (url: string) => Promise<{ soldOut: boolean | null }>,
): Promise<ComparisonCandidate[]> {
  const eligible = selectCandidatesForDetailConfirmation(candidates);
  if (eligible.length === 0) return candidates;
  const result = [...candidates];
  await Promise.all(
    eligible.map(async (i) => {
      try {
        const detail = await fetchDetail(candidates[i].url);
        result[i] = { ...candidates[i], soldOut: detail.soldOut };
      } catch {
        // soldOut 미채움 유지 — 검색 매칭 결과 자체는 그대로 둔다
      }
    }),
  );
  return result;
}

/** 검색-시점 soldOut 상세확인을 지원하는 사이트만 여기 등록한다(파서 존재 여부와
 * 같은 원칙 — 하드코딩 허용목록이 아니라 실측 검증된 것만). */
function soldOutDetailFetcher(domain: string): ((url: string) => Promise<{ soldOut: boolean | null }>) | null {
  if (domain === "rulii.co.kr") return fetchRuliiProductPrice;
  if (domain === "foretforet.com") return fetchForetforetProductPrice;
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
    if (primaryScored.length > 0) {
      const fetcher = soldOutDetailFetcher(source.domain);
      const enriched = fetcher ? await enrichSoldOutViaDetail(primaryScored, fetcher) : primaryScored;
      return { ...base, status: "ok", candidates: enriched };
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
    const fallback = await searchDomesticShopCandidates(source.domain, aliasQuery);
    const fallbackHasResults = fallback !== null && fallback.length > 0;
    // 색상을 붙인 쿼리가 결과 0건이면(사이트 검색이 AND 매칭이라 너무 좁아졌을 수
    // 있음) alias 단독으로 한 번 더 시도한다 — 이것도 실패하면 빈 결과 유지.
    const finalFallback =
      fallbackHasResults || !color ? fallback : await searchDomesticShopCandidates(source.domain, alias);
    if (finalFallback === null || finalFallback.length === 0) return { ...base, status: "ok", candidates: [] };
    const fallbackScored = withConfidence(query, finalFallback);
    const fallbackFetcher = soldOutDetailFetcher(source.domain);
    const enrichedFallback = fallbackFetcher
      ? await enrichSoldOutViaDetail(fallbackScored, fallbackFetcher)
      : fallbackScored;
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
      return result.available && result.price
        ? { status: "OK", price: result.price, soldOut: result.soldOut }
        : { status: "UNAVAILABLE", price: null, soldOut: result.soldOut };
    }
    return { status: "UNSUPPORTED", price: null };
  } catch (error) {
    return { status: "ERROR", price: null, error: error instanceof Error ? error.message : "알 수 없는 오류" };
  }
}
