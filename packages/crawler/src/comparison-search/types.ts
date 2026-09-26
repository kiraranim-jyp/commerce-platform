import type { CrossSellerBlocker } from "./cross-seller";
import type { ProductFacts } from "@commerce/shared";

export interface ComparisonCandidate {
  title: string;
  url: string;
  price: { amount: number; currency: string } | null;
  /** N-4.18-Q2 P0-4(대표님 지시, 2026-08-26: "정상가와 현재가를 뭉개지 않는다") —
   * 검색 목록에서 할인판매가(price)와 별도로 정가가 확인될 때만 채운다(실제
   * 할인이 있을 때만, 즉 정가 > 판매가일 때만). 사이트가 정가/할인가를 구분해서
   * 주지 않으면(또는 할인이 없으면) null — 지어내지 않는다. */
  regularPrice?: { amount: number; currency: string } | null;
  imageUrl: string | null;
  confidence: number;
  /** 사이트에서 브랜드가 별도 필드로 확인되는 경우(Shopify vendor, Childrensalon
   * designer 등) — 없으면 title에서 부분일치로만 판단한다. */
  brand?: string;
  /** 사이트에 명시적으로 존재하는 SKU/article code. 없는 사이트는 채우지 않는다(추측 금지). */
  sku?: string;
  /** GOLF-01.5 축 C(CEO 지시, 2026-09-16) — **마켓플레이스 안의 실제 판매 점포**.
   * CEO 가 MI 가 받아야 한다고 말한 7칸 중 «판매처»는 지금까지 판매처=사이트
   * 하나였다(ComparisonSearchResult.shopName). 마켓플레이스는 그 안에 판매자가
   * 여럿이라 그 칸 하나로는 사실이 사라진다 — Rakuten 응답의 shopName 이
   * 정확히 그 값이다. 그 정보를 주지 않는 소스는 채우지 않는다(추측 금지).
   *
   * 🔴 매칭·점수 계산에 쓰지 않는다. 표시용 사실 한 칸이다. */
  sellerName?: string;
  /** Sprint B-1.2 — 동일상품 판별 신뢰도 등급. UI 표시용. */
  matchLevel?: "very_high" | "high" | "medium" | "low";
  /** 어떤 신호로 이 confidence가 나왔는지(디버그/설명용). */
  matchReasons?: string[];
  /** P-7-B(CPO 지시, 2026-08-29) — match-truth.ts의 MatchTruth와 같은 값(순환
   * import를 피하려고 여기서는 리터럴을 그대로 복제한다 — matchLevel과 동일한
   * 기존 패턴). 채워지지 않으면(undefined) 이 후보에 대해 modelCode 증거 평가를
   * 아직 시도하지 않았다는 뜻 — UI는 matchLevel만으로 기존 배지를 그대로
   * 보여준다(하위호환, 회귀 없음). */
  matchTruth?: "EXACT_IDENTIFIER" | "STRONG_IDENTIFIER" | "TEXT_CONFIRMED" | "SIMILAR" | "CONFLICT" | "INSUFFICIENT_EVIDENCE";
  /** P-11 STEP 4(대표님/CPO 지시, 2026-08-30) — 해외 가격비교(comparison-search) 전용
   * 판정. 위 matchTruth(도메스틱 modelCode 증거 계층, P-7-B)와는 별개 값 체계다 —
   * product-identity.ts의 ProductMatchTruth와 같은 값을 리터럴로 복제한다(순환
   * import 방지, matchTruth와 동일한 기존 패턴). 채워지지 않으면(undefined) 이
   * 후보에 대해 identity 판정을 아직 시도하지 않았다는 뜻. */
  productMatchTruth?:
    | "EXACT_PRODUCT"
    | "CONFIRMED_PRODUCT"
    | "SAME_MODEL_VARIANT"
    | "VERY_SIMILAR"
    | "SIMILAR"
    | "CONFLICT"
    | "INSUFFICIENT_EVIDENCE";
  /** Sprint B-1.8 — "detail"은 상품 상세 API로 실제 가격을 확인한 것(신뢰 가능), "search"는
   * 검색 결과에 딸려온 값을 그대로 쓴 것(참고용). 매칭(동일상품 여부)과 가격확인은 별개
   * 단계이므로, 이 필드로 "이 가격을 얼마나 믿어도 되는지"를 구분한다. */
  priceSource?: "detail" | "search" | null;
  /** P-4-DATA-4(CPO 지시, 2026-08-29: "미검증 가격 숫자는 어떤 경우에도 셀러 화면에
   * 노출하지 않는다") — priceSource만으로는 "검증 대상이 아니었음"과 "검증을 시도했으나
   * 실패함"이 구분되지 않는다(둘 다 priceSource="search"로 남았다 — Hug Hairy Monster
   * 실측 사례: matchLevel=very_high인데 fetch 실패로 조용히 search 값이 남아있었음).
   * priceStatus가 UI가 실제로 숫자를 보여줘도 되는지를 결정하는 단일 진실 — VERIFIED_CURRENT만
   * price를 노출한다. UNVERIFIED_SEARCH/PRICE_UNAVAILABLE은 price 필드가 있어도 절대
   * 숫자를 보여주지 않는다(내부 참고용으로만 유지). */
  /** 원본 파서(shopify-suggest.ts 등 8개)는 이 필드를 채우지 않는다 — match.ts의
   * withConfidence()가 모든 후보 생성 경로가 공통으로 거치는 단일 지점이라, 거기서
   * priceSource 기준으로 기본값을 강제한 뒤에만 API 응답까지 나간다(파서 8개를
   * 개별 수정하지 않기 위한 의도적 설계 — derivePriceStatus 참고). 즉 optional
   * 타입이지만 실제로 API 밖으로 나가는 값은 항상 채워져 있다. */
  priceStatus?: "VERIFIED_CURRENT" | "UNVERIFIED_SEARCH" | "PRICE_UNAVAILABLE";
  /** true=상세 검증을 실제로 시도함(성공/실패 무관), false=애초에 검증 대상이 아니었음
   * (medium/low 등급이라 selectCandidatesForDetailConfirmation에서 제외됐거나 사이트당
   * 상한 초과). UI가 "가격 확인 필요"(시도 안 함) vs "가격 확인 실패"(시도했지만 실패)를
   * 다른 문구로 보여주기 위한 구분 — 둘 다 숫자는 안 보여주지만 셀러에게 주는 설명은 다르다. */
  verificationAttempted?: boolean;
  /** N-4.18-Q3 PART E-2 — 매칭 신뢰도(confidence/matchLevel)와 완전히 분리된 축.
   * true=품절이라고 실측 확인됨, false=판매중이라고 실측 확인됨, null/undefined=그
   * 사이트에서 재고 상태를 확인할 방법이 없거나 실측 근거가 없음(추측 금지 — null이
   * 기본값이며 "판매중"으로 임의 해석하지 않는다). */
  soldOut?: boolean | null;
  /** MATCHING-2.0-CORE(CEO 지시, 2026-09-13) — 이 후보에서 읽어낸 사실 묶음.
   * 파서가 채울 수 있으면 채우고, 못 채우면 undefined다(그 경우 판정은 기존
   * 텍스트 경로만 쓴다 — 하위호환). */
  facts?: ProductFacts;
  /** 양쪽 facts가 다 있을 때만 채워지는 교차판매처 판정. 이 값이 있으면
   * 화면 표시와 가격 정책이 이 값을 우선한다 — confidence/matchLevel은 그대로
   * 두고(기존 계산을 건드리지 않는다) 판정만 얹는 기존 계층 분리 패턴 그대로다. */
  crossSellerVerdict?: "SAME" | "PRESUMED_SAME" | "SIMILAR" | "UNKNOWN" | "CONFLICT";
  /** 그 판정의 근거/보류 사유(사람이 읽는 문장). */
  crossSellerReasons?: string[];
  /**
   * MI-3 / P0-1(CPO 지시, 2026-09-26) — 그 판정의 보류 사유를 «기계가 읽는 꼴» 로.
   *
   * 🔴 위 `crossSellerReasons` 는 사람이 읽는 문장이라 판정에 쓸 수 없다(문자열을
   * 다시 파싱하는 것이 이 저장소가 반복해서 고쳐 온 실수다). 품번 재사용을
   * 가려내려면 「같은 판매처가 두 상품으로 진열했다」를 «값» 으로 읽어야 한다.
   */
  crossSellerBlockers?: { blocker: CrossSellerBlocker }[];
  /**
   * P0-A.29-E ㉮ — **이 가격이 어느 옵션의 가격인가.**
   *
   *   SAME_OPTION       원상품이 고른 옵션과 «같은» 옵션의 가격이다 → 비교 가능
   *   SINGLE_PRICE      이 상품은 옵션이 달라도 값이 하나다 → 비교해도 안전하다
   *   OPTION_MISMATCH   🔴 옵션마다 값이 다른데 같은 옵션을 못 찾았다 → 숫자를
   *                     동일 옵션 가격처럼 보여주면 안 된다
   *
   * undefined = 이 축을 판단할 근거가 없었다(원상품이 옵션을 고르지 않았거나
   * 상세를 받지 못했다). 🔴 「문제 없음」이 아니라 「모른다」다.
   */
  priceOptionMatch?: "SAME_OPTION" | "SINGLE_PRICE" | "OPTION_MISMATCH";
  /** 이 후보에서 실제로 가격을 읽어낸 옵션. 상세를 받은 경우에만 채워진다. */
  priceOptionValues?: Record<string, string>;
  /**
   * P0-A.29-E ⑤ — 「동일 모델 · 옵션 다름」이 무엇 때문에 다른가. title 에서
   * 이미 잘라 쓰던 문자열을 버리지 않고 그대로 들고 온다.
   *
   * 🔴 `in` 뒤 문자열을 «색상» 이라고 부르지 않는다 — 소재가 들어올 수도 있다.
   *    화면도 「옵션」이라고만 말한다.
   */
  variantDifference?: { model: string; queryOption: string; candidateOption: string };
}

export interface ComparisonSearchResult {
  shopId: string;
  shopName: string;
  domain: string;
  /**
   * GOLF-01.5 축 C(CEO 지시, 2026-09-16) — 네 번째 값 "not_configured".
   *
   *   ok             자동 수집을 실제로 수행했다(결과는 0건일 수도 있다)
   *   unsupported    이 소스를 읽을 파서/어댑터가 없다 — 요청을 보내지 않았다
   *   error          수행했는데 실패했다
   *   not_configured 어댑터는 있는데 **자격증명이 없어** 요청을 보내지 않았다
   *
   * 🔴 왜 unsupported 로 뭉치면 안 되나. unsupported 는 셀러에게 "이 사이트는
   *    원래 자동 검색을 못 한다 — 직접 가 보세요"라고 말한다. 키가 없어서 못
   *    부른 것은 셀러가 할 일이 아니라 **우리가 키를 넣으면 풀리는 일**이다.
   *    둘을 같은 문구로 말하면 화면이 또 거짓말을 한다(이 저장소가 반복해서
   *    고쳐 온 실패 — unsupported vs NO_RESULT, BLOCKED vs 결과없음).
   * 🔴 빈 결과(ok + candidates 0건)와도 절대 같지 않다. 물어보지도 못한 것을
   *    "없다"고 말하지 않는다.
   */
  status: "ok" | "unsupported" | "error" | "not_configured";
  candidates: ComparisonCandidate[];
  error?: string;
  /** status="not_configured" 일 때만 채워진다. 🔴 비어 있는 환경변수 «이름»만
   * 담는다 — 값은 어떤 경우에도 담지 않는다. */
  missingCredentials?: string[];
  /** P-4-DATA-4(CPO 지시) — status="error"만으로는 "검색 서비스가 일시적으로 막힘
   * (429)"과 "그 외 오류"가 구분되지 않는다. 429는 "찾지 못했습니다"와 전혀 다른
   * 셀러 문구("요청이 많아 검색하지 못했습니다")를 써야 한다 — 실측 확인(2026-08-29):
   * 세션당 누적 호출량이 쌓이면 여러 Shopify 도메인이 동시에 429를 반환했고, 이게
   * 셀러 화면에는 "찾지 못했습니다"와 구분 없이 보였다. status가 "error"일 때만
   * 의미 있고, 그 외에는 undefined. */
  errorKind?: "RATE_LIMITED" | "TEMPORARY_ERROR";
  /** N-4.18-P-4 STEP P-4-2 — 원문 검색(searchTerm/title)이 0건이라 브랜드 한글
   * alias(brand-alias.ts)로 재검색해서 얻은 결과일 때만 채워진다. 없으면(undefined)
   * 원문 검색 결과라는 뜻 — 하위호환(기존 호출부는 이 필드를 몰라도 됨). */
  querySource?: "brand_alias";
}

export interface ComparisonQuery {
  title: string;
  brand?: string;
  /** 원본 상품 URL — URL slug 비교 신호에 사용(있으면). */
  sourceUrl?: string;
  /** 원본 상품에서 확인된 SKU/article code(있으면). */
  sku?: string;
  /** P-11 STEP 4(대표님/CPO 지시, 2026-08-30) — product-identity.ts가 sku가 비어있을
   * 때 "Article code: XXX" 텍스트를 직접 뽑아내는 폴백 소스로 쓴다(STEP 1 실측:
   * product.sku.value가 비어있어도 설명문에는 Article code가 그대로 있는 경우가
   * 흔함). 없으면(undefined) 이 폴백을 시도하지 않는다 — 하위호환(기존 호출부는
   * 이 필드를 몰라도 되고, 몰라도 동작이 바뀌지 않는다). */
  description?: string;
  /** N-4.18-C STEP3(대표님 지시: "검색 횟수보다 매칭 정확도를 우선한다") — 실제
   * 검색 API/키워드 파라미터에 보낼 최소화된 검색어(packages/shared의
   * buildDomesticShopQuery, SKU 단독 > 브랜드+모델명 > 브랜드+핵심 상품명
   * 순). 없으면 title을 그대로 검색어로 쓴다(하위호환 — B-1 해외 가격비교
   * 등 아직 이 필드를 안 채우는 호출부는 기존 동작 그대로 유지). title
   * 자체는 매칭 스코어링(scoreCandidateMatch)에 계속 그대로 쓰인다 —
   * 검색어를 좁히는 것과 동일상품 판정 신호를 넓게 쓰는 것은 별개다. */
  searchTerm?: string;
  /** MATCHING-2.0-CORE — "브랜드 + 명사 하나"로 한 번만 찾던 것을 좁은 말부터
   * 넓은 말 순서로 여러 번 찾기 위한 목록(buildCrossSellerSearchQueries).
   * 결과가 나오면 거기서 멈춘다. 없으면(undefined) 기존 searchTerm 한 개
   * 경로 그대로다 — 하위호환. */
  searchTerms?: string[];
  /** MATCHING-2.0-CORE — 등록상품(내 상품)에서 읽어낸 사실 묶음. 후보 쪽
   * facts와 짝이 될 때만 교차판매처 판정이 돌아간다. */
  facts?: ProductFacts;
  /**
   * P0-A.29-E ㉮(CEO 지시, 2026-09-20) — 원상품 URL 이 «고른» 옵션 값
   * (예: `{ Size: "29 EUR (UK 11)" }`). 원상품에 옵션 지정이 없으면 undefined 다.
   *
   * 🔴 이것으로 «같은 옵션끼리» 가격을 맞춘다. 샵 간 사이즈 환산은 하지 않는다 —
   *    실측(2026-09-20)에서 샵마다 표기 체계가 전부 달랐다(`29 EUR (UK 11)` /
   *    `29 EU (11 Little Kid US)` / `22` / `35`). 같은 샵 안에서는 옵션 값
   *    문자열의 89%가 상품끼리 재사용되어 문자열 일치가 안전하다.
   */
  selectedOptionValues?: Record<string, string>;
}

/** comparison_shops 테이블 행의 최소 부분집합 — packages/crawler는 apps/admin에 의존하지 않으므로
 * 호출 측(admin API 라우트)에서 이 형태로 넘겨준다. */
export interface ComparisonShopRef {
  id: string;
  name: string;
  domain: string;
  currency: string | null;
}

/** N-4.07 — domestic_price_sources 테이블 행의 최소 부분집합. collectionStrategy가
 * AUTO_API/AUTO_SCRAPE인 것만 실제로 검색을 시도한다(MANUAL/NOT_AVAILABLE은 아직
 * 실제 파서가 없다는 뜻이라 "unsupported"로 응답한다 — 추정 파서를 만들지 않는다). */
export interface DomesticSourceRef {
  id: string;
  name: string;
  domain: string;
  currency: string;
  collectionStrategy: "AUTO_API" | "AUTO_SCRAPE" | "MANUAL" | "NOT_AVAILABLE";
}
